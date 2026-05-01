/**
 * Cosmic SDK Client Wrapper
 *
 * Two operating modes:
 *  - stdio (singleton): credentials come from env vars, one client lives for the
 *    lifetime of the process. Used by the npx-installed `cosmic-mcp` binary.
 *  - http (per-request): credentials are extracted from the HTTP request and
 *    flow through `AsyncLocalStorage`. The HTTP entry wraps each request in
 *    `withRequestContext({ client, hasWriteAccess })` so every tool handler
 *    that calls `getCosmicClient()` resolves the right per-tenant client
 *    without changing tool signatures.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { createBucketClient } from '@cosmicjs/sdk';
import type { CosmicConfig } from './types.js';

export type CosmicClient = ReturnType<typeof createBucketClient>;
export type CosmicApiEnvironment = 'production' | 'staging';

export interface RequestContext {
  client: CosmicClient;
  bucketSlug: string;
  hasWriteAccess: boolean;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return requestContextStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

// The hosted MCP runs in two AWS environments and talks to two distinct
// Cosmic API backends. `mcp.cosmicjs.com` -> api.cosmicjs.com (production),
// `mcp.cosmic-staging.com` -> api.cosmic-staging.com (staging). The mode is
// pinned per-task-definition via `COSMIC_API_ENVIRONMENT`. For escape-hatch
// scenarios (custom workers URL during migration, local dev against a
// localhost API, etc.), `COSMIC_API_URL` + `COSMIC_UPLOAD_URL` override.
export function getApiEnvironment(): CosmicApiEnvironment {
  const raw = (process.env.COSMIC_API_ENVIRONMENT ?? '').toLowerCase().trim();
  return raw === 'staging' ? 'staging' : 'production';
}

interface ConnectionOptions {
  apiEnvironment?: CosmicApiEnvironment;
  custom?: { apiUrl: string; uploadUrl: string };
}

function getConnectionOptions(): ConnectionOptions {
  const apiUrl = process.env.COSMIC_API_URL?.trim();
  const uploadUrl = process.env.COSMIC_UPLOAD_URL?.trim();
  if (apiUrl && uploadUrl) {
    return { custom: { apiUrl, uploadUrl } };
  }
  return { apiEnvironment: getApiEnvironment() };
}

export function createBucketClientForRequest(opts: {
  bucketSlug: string;
  readKey: string;
  writeKey?: string;
}): CosmicClient {
  return createBucketClient({
    bucketSlug: opts.bucketSlug,
    readKey: opts.readKey,
    writeKey: opts.writeKey,
    ...getConnectionOptions(),
  });
}

let stdioSingleton: CosmicClient | null = null;

export function getConfig(): CosmicConfig {
  const bucketSlug = process.env.COSMIC_BUCKET_SLUG;
  const readKey = process.env.COSMIC_READ_KEY;
  const writeKey = process.env.COSMIC_WRITE_KEY;

  if (!bucketSlug) {
    throw new Error('COSMIC_BUCKET_SLUG environment variable is required');
  }

  if (!readKey) {
    throw new Error('COSMIC_READ_KEY environment variable is required');
  }

  return {
    bucketSlug,
    readKey,
    writeKey,
  };
}

export function getCosmicClient(): CosmicClient {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    return ctx.client;
  }

  if (stdioSingleton) {
    return stdioSingleton;
  }

  const config = getConfig();
  stdioSingleton = createBucketClient({
    bucketSlug: config.bucketSlug,
    readKey: config.readKey,
    writeKey: config.writeKey,
    ...getConnectionOptions(),
  });
  return stdioSingleton;
}

export function hasWriteAccess(): boolean {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    return ctx.hasWriteAccess;
  }
  return !!process.env.COSMIC_WRITE_KEY;
}

export function requireWriteAccess(): void {
  if (!hasWriteAccess()) {
    throw new Error(
      'Write operations require a write key. In HTTP mode, send the bucket write key as the bearer token; in stdio mode, set COSMIC_WRITE_KEY.'
    );
  }
}

export function resetClient(): void {
  stdioSingleton = null;
}
