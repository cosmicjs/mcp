/**
 * Lightweight dapi (cosmic-backend) client for the agent-scope MCP tools.
 *
 * The bucket-scope MCP talks to api.cosmicjs.com (the data plane) via the
 * Cosmic SDK. The agent scope talks to a *different* API: dapi.cosmicjs.com
 * (the control plane / dashboard API) where /v3/agents/* lives. Both go to
 * different hosts and use different auth shapes, so they need separate
 * clients.
 *
 * No SDK exists for dapi; we just use fetch.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export type DapiEnvironment = 'production' | 'staging';

export interface AgentRequestContext {
  /** Optional agent_key for verify/status. signup does not require one. */
  agentKey?: string;
}

const agentRequestContextStorage = new AsyncLocalStorage<AgentRequestContext>();

export function withAgentRequestContext<T>(
  ctx: AgentRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return agentRequestContextStorage.run(ctx, fn);
}

export function getAgentRequestContext(): AgentRequestContext | undefined {
  return agentRequestContextStorage.getStore();
}

export function getDapiEnvironment(): DapiEnvironment {
  const raw = (process.env.COSMIC_API_ENVIRONMENT ?? '').toLowerCase().trim();
  return raw === 'staging' ? 'staging' : 'production';
}

export function getDapiBaseUrl(): string {
  const override = process.env.COSMIC_DAPI_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  return getDapiEnvironment() === 'staging'
    ? 'https://dapi.cosmic-staging.com/v3'
    : 'https://dapi.cosmicjs.com/v3';
}

/**
 * Resolve the agent_key to use for an authenticated call. Order of precedence:
 *   1. Per-request context (HTTP mode).
 *   2. COSMIC_AGENT_KEY env var (stdio mode).
 * Throws a Zod-friendly Error if neither is set.
 */
export function getAgentKey(): string {
  const ctx = agentRequestContextStorage.getStore();
  if (ctx?.agentKey) return ctx.agentKey;
  const env = process.env.COSMIC_AGENT_KEY?.trim();
  if (env) return env;
  throw new Error(
    'Agent key is required. In HTTP mode, send `Authorization: Bearer agk_<...>`. In stdio mode, set COSMIC_AGENT_KEY.',
  );
}

interface DapiRequestOptions {
  method: 'GET' | 'POST';
  path: string; // e.g. '/agents/sign-up'
  body?: unknown;
  authenticated?: boolean;
}

export interface DapiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
}

export async function dapiRequest<T>(opts: DapiRequestOptions): Promise<T> {
  const url = `${getDapiBaseUrl()}${opts.path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.authenticated) {
    headers['Authorization'] = `Bearer ${getAgentKey()}`;
  }

  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const err = new Error(
      typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message?: unknown }).message)
        : `dapi request failed (${res.status})`,
    ) as DapiError;
    err.status = res.status;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'code' in parsed &&
      typeof (parsed as { code?: unknown }).code === 'string'
    ) {
      err.code = (parsed as { code: string }).code;
    }
    err.body = parsed;
    throw err;
  }

  return parsed as T;
}
