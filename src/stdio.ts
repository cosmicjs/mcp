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
import { createServer } from './server.js';

function validateConfig(): void {
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
  validateConfig();

  const server = createServer({ scope: 'bucket' });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[cosmic-mcp] Server started successfully');
}

main().catch((error) => {
  console.error('[cosmic-mcp] Fatal error:', error);
  process.exit(1);
});
