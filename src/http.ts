#!/usr/bin/env node

/**
 * Cosmic MCP - hosted streamable-HTTP entry
 *
 * Per-request multi-tenant MCP server. Each HTTP request carries the bucket
 * scope in the URL path and the bucket key in the `Authorization` header,
 * gets a fresh `StreamableHTTPServerTransport` (stateless mode), and tool
 * handlers resolve the bucket-scoped Cosmic SDK client via AsyncLocalStorage.
 *
 * Routes:
 *   GET  /                                          - descriptor JSON
 *   GET  /healthz                                   - liveness for ALB
 *   GET  /.well-known/oauth-protected-resource      - RFC 9728 PRM
 *   POST /v1/buckets/:slug                          - MCP request entry
 *   GET  /v1/buckets/:slug                          - MCP SSE entry
 *   DEL  /v1/buckets/:slug                          - MCP session terminate
 *   *    /v1/account, /v1/*                         - 404 reserved
 *
 * For stdio mode, see `stdio.ts`. Tool definitions live in `./tools/*` and
 * are wired up by `createServer()` in `./server.ts`.
 */

import http, {
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import {
  createBucketClientForRequest,
  withRequestContext,
} from './client.js';
import { withAgentRequestContext } from './dapiClient.js';
import {
  SERVER_NAME,
  SERVER_VERSION,
  createServer,
  getToolsForScope,
} from './server.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const PROTOCOL_VERSION = '2025-06-18';

const ORIGIN_ALLOWLIST = [
  /^https:\/\/claude\.ai$/,
  /^https:\/\/.*\.claude\.ai$/,
  /^https:\/\/chatgpt\.com$/,
  /^https:\/\/.*\.chatgpt\.com$/,
  /^https:\/\/.*\.cursor\.sh$/,
  /^https:\/\/.*\.cursor\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return ORIGIN_ALLOWLIST.some((re) => re.test(origin));
}

function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function send401(res: ServerResponse, error: string, errorDescription: string): void {
  const resourceMetadataUrl =
    process.env.MCP_RESOURCE_METADATA_URL ??
    `http://localhost:${PORT}/.well-known/oauth-protected-resource`;
  res.writeHead(401, {
    'Content-Type': 'application/json; charset=utf-8',
    'WWW-Authenticate': `Bearer realm="cosmic-mcp", error="${error}", error_description="${errorDescription}", resource_metadata="${resourceMetadataUrl}"`,
  });
  res.end(
    JSON.stringify({
      error,
      error_description: errorDescription,
    })
  );
}

function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function getDescriptor() {
  const bucketToolDescriptors = getToolsForScope('bucket').map((t) => ({
    name: t.name,
    description: t.description,
  }));
  const agentToolDescriptors = getToolsForScope('agent').map((t) => ({
    name: t.name,
    description: t.description,
  }));
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    protocol: 'MCP',
    protocolVersion: PROTOCOL_VERSION,
    transport: 'streamable-http',
    description:
      'Cosmic CMS MCP server. Two scopes: `/v1/buckets/{slug}` for bucket-scoped tools (objects, media, types, AI gen) authenticated with bucket keys, and `/v1/agent` for the agent signup flow (no prior credentials required) where an AI agent can provision a Cosmic project tied to a human email.',
    endpoints: {
      bucket: '/v1/buckets/{bucket-slug}',
      agent: '/v1/agent',
      account: '/v1/account (reserved for future use)',
    },
    documentation: 'https://www.cosmicjs.com/docs',
    tools: {
      bucket: bucketToolDescriptors,
      agent: agentToolDescriptors,
    },
  };
}

function getProtectedResourceMetadata(host: string) {
  return {
    resource: `https://${host}`,
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://www.cosmicjs.com/docs',
    resource_signing_alg_values_supported: [],
    authorization_servers: [],
    cosmic: {
      auth_model:
        'Bucket-scoped bearer tokens. `Authorization: Bearer <read_key>` enables read-only tools; `Authorization: Bearer <read_key>:<write_key>` enables write tools as well. The write key may also be sent via the `X-Cosmic-Write-Key` header. Keys are issued in the Cosmic dashboard at https://app.cosmicjs.com under each bucket\'s API Access settings.',
    },
  };
}

const RESERVED_V1_PATH_RESPONSE = {
  error: 'not_found',
  error_description:
    'This path is reserved. v1 currently exposes only `/v1/buckets/{slug}`. `/v1/account` and other namespaces are planned for future use.',
};

interface RouteMatch {
  bucketSlug: string;
}

function matchBucketRoute(pathname: string): RouteMatch | null {
  const m = pathname.match(/^\/v1\/buckets\/([^\/?#]+)\/?$/);
  if (!m) return null;
  return { bucketSlug: decodeURIComponent(m[1]) };
}

function matchAgentRoute(pathname: string): boolean {
  return /^\/v1\/agent\/?$/.test(pathname);
}

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  bucketSlug: string,
): Promise<void> {
  const auth = req.headers['authorization'];
  if (!auth || typeof auth !== 'string') {
    return send401(
      res,
      'invalid_request',
      'Missing Authorization header. Send `Authorization: Bearer <read_key>` for read-only access or `Authorization: Bearer <read_key>:<write_key>` for full access.',
    );
  }
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return send401(
      res,
      'invalid_request',
      'Authorization header must be `Bearer <read_key>` or `Bearer <read_key>:<write_key>`.',
    );
  }
  const bearerToken = m[1].trim();
  if (!bearerToken) {
    return send401(res, 'invalid_token', 'Empty bearer token.');
  }

  // Cosmic uses separate read and write keys; the read key cannot write and
  // the write key cannot read. To fit both into one MCP bearer, we accept
  // `<read_key>` for read-only access or `<read_key>:<write_key>` for full
  // access. The fallback header `X-Cosmic-Write-Key` lets clients that can't
  // colon-pack a token (e.g. UIs that strictly validate base64-ish tokens)
  // send the write key out-of-band.
  const colonIdx = bearerToken.indexOf(':');
  let readKey: string;
  let writeKey: string | undefined;
  if (colonIdx >= 0) {
    readKey = bearerToken.slice(0, colonIdx);
    const tail = bearerToken.slice(colonIdx + 1);
    writeKey = tail.length > 0 ? tail : undefined;
  } else {
    readKey = bearerToken;
    writeKey = undefined;
  }

  const headerWriteKey = req.headers['x-cosmic-write-key'];
  if (!writeKey && typeof headerWriteKey === 'string' && headerWriteKey.trim()) {
    writeKey = headerWriteKey.trim();
  }

  if (!readKey) {
    return send401(
      res,
      'invalid_token',
      'Bearer token is empty or only contains a write key. Send `Bearer <read_key>` or `Bearer <read_key>:<write_key>`.',
    );
  }

  const hasWriteAccess = !!writeKey;

  const client = createBucketClientForRequest({
    bucketSlug,
    readKey,
    writeKey,
  });

  let parsedBody: unknown = undefined;
  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      parsedBody = raw.length === 0 ? undefined : JSON.parse(raw);
    } catch (error) {
      return sendJson(res, 400, {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: { detail: (error as Error).message },
        },
        id: null,
      });
    }
  }

  // Stateless mode: per-request transport + server. Each MCP call is fully
  // isolated, no session state shared across requests, no concurrency
  // surprises if multiple long-running tool calls overlap. This is the
  // canonical pattern from the SDK docs for `sessionIdGenerator: undefined`.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const mcpServer = createServer({ scope: 'bucket' });

  res.on('close', () => {
    transport.close().catch(() => {});
  });

  await mcpServer.connect(transport);

  await withRequestContext(
    { client, bucketSlug, hasWriteAccess },
    async () => {
      await transport.handleRequest(req, res, parsedBody);
    },
  );
}

async function handleAgentMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Agent scope auth: Bearer is OPTIONAL because cosmic_agent_signup is
  // public. cosmic_agent_verify and cosmic_agent_status will throw inside
  // their handlers (via `getAgentKey()`) if no key is present.
  let agentKey: string | undefined;
  const auth = req.headers['authorization'];
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const token = m[1].trim();
      if (token) agentKey = token;
    }
  }

  let parsedBody: unknown = undefined;
  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      parsedBody = raw.length === 0 ? undefined : JSON.parse(raw);
    } catch (error) {
      return sendJson(res, 400, {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: { detail: (error as Error).message },
        },
        id: null,
      });
    }
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const mcpServer = createServer({ scope: 'agent' });

  res.on('close', () => {
    transport.close().catch(() => {});
  });

  await mcpServer.connect(transport);

  await withAgentRequestContext({ agentKey }, async () => {
    await transport.handleRequest(req, res, parsedBody);
  });
}

const server = http.createServer(async (req, res) => {
  const requestStart = Date.now();
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (method !== 'GET' && method !== 'HEAD' && !isOriginAllowed(req.headers.origin)) {
    return sendJson(res, 403, {
      error: 'forbidden_origin',
      error_description: 'Origin not allowed.',
    });
  }

  try {
    if ((method === 'GET' || method === 'HEAD') && pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('ok');
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/') {
      return sendJson(res, 200, getDescriptor());
    }

    if (
      (method === 'GET' || method === 'HEAD') &&
      pathname === '/.well-known/oauth-protected-resource'
    ) {
      return sendJson(res, 200, getProtectedResourceMetadata(req.headers.host ?? 'localhost'));
    }

    const bucketMatch = matchBucketRoute(pathname);
    if (bucketMatch) {
      if (method !== 'POST' && method !== 'GET' && method !== 'DELETE') {
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, GET, DELETE' });
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }
      await handleMcpRequest(req, res, bucketMatch.bucketSlug);
      return;
    }

    if (matchAgentRoute(pathname)) {
      if (method !== 'POST' && method !== 'GET' && method !== 'DELETE') {
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, GET, DELETE' });
        return res.end(JSON.stringify({ error: 'method_not_allowed' }));
      }
      await handleAgentMcpRequest(req, res);
      return;
    }

    if (pathname === '/v1/account' || pathname.startsWith('/v1/')) {
      return sendJson(res, 404, RESERVED_V1_PATH_RESPONSE);
    }

    return sendJson(res, 404, {
      error: 'not_found',
      error_description: `No handler for ${method} ${pathname}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'unhandled_request_error',
        method,
        pathname,
        error: message,
        latencyMs: Date.now() - requestStart,
      }),
    );
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'internal_error', error_description: message });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'mcp_http_listening',
      port: PORT,
      version: SERVER_VERSION,
      protocolVersion: PROTOCOL_VERSION,
    }),
  );
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: 'info', msg: 'mcp_http_shutdown_starting', signal }));

  server.close(() => {
    console.log(JSON.stringify({ level: 'info', msg: 'mcp_http_shutdown_complete' }));
    process.exit(0);
  });

  setTimeout(() => {
    console.warn(JSON.stringify({ level: 'warn', msg: 'mcp_http_shutdown_force_exit' }));
    process.exit(0);
  }, 25_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
