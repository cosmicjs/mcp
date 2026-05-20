#!/usr/bin/env node

/**
 * Cosmic MCP - stdio entry
 *
 * The npm-published `cosmic-mcp` binary. Reads bucket credentials from env
 * (`COSMIC_BUCKET_SLUG`, `COSMIC_READ_KEY`, `COSMIC_WRITE_KEY`) and speaks
 * stdio to a parent process (Claude Desktop, Cursor, etc.).
 *
 * For the hosted streamable-HTTP entry, see `http.ts`.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConfig } from './client.js';
import { createServer, type ServerScope } from './server.js';

// Scope selection for stdio mode:
//   - Default: `bucket` (back-compat with existing installs).
//   - Set `COSMIC_MCP_SCOPE=agent` to expose only the signup tools. This is
//     useful for bootstrap installs where the user has no bucket yet.
function resolveScope(): ServerScope {
  const raw = (process.env.COSMIC_MCP_SCOPE ?? '').toLowerCase().trim();
  if (raw === 'agent') return 'agent';
  return 'bucket';
}

function validateConfig(scope: ServerScope): void {
  if (scope === 'agent') {
    if (process.env.COSMIC_AGENT_KEY) {
      console.error(
        '[cosmic-mcp] Agent scope: COSMIC_AGENT_KEY detected; verify/status calls will be authenticated.',
      );
    } else {
      console.error(
        '[cosmic-mcp] Agent scope: no COSMIC_AGENT_KEY set; only cosmic_agent_signup will work until you run it and capture the returned key.',
      );
    }
    return;
  }
  try {
    const config = getConfig();
    console.error(`[cosmic-mcp] Connected to bucket: ${config.bucketSlug}`);
    if (!config.writeKey) {
      console.error('[cosmic-mcp] Write key not provided - write operations will be disabled');
    }
  } catch (error) {
    console.error(`[cosmic-mcp] Configuration error: ${(error as Error).message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const scope = resolveScope();
  validateConfig(scope);

  const server = createServer({ scope });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[cosmic-mcp] Server started successfully (scope=${scope})`);
}

main().catch((error) => {
  console.error('[cosmic-mcp] Fatal error:', error);
  process.exit(1);
});
