/**
 * Cosmic SDK Client Wrapper
 * Handles initialization and configuration from environment variables
 */

import { createBucketClient } from '@cosmicjs/sdk';
import type { CosmicConfig } from './types.js';

// Type for the Cosmic SDK client
export type CosmicClient = ReturnType<typeof createBucketClient>;

let cosmicClient: CosmicClient | null = null;

/**
 * Get configuration from environment variables
 */
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

/**
 * Initialize and get the Cosmic SDK client
 * Creates a singleton instance
 */
export function getCosmicClient(): CosmicClient {
  if (cosmicClient) {
    return cosmicClient;
  }

  const config = getConfig();

  cosmicClient = createBucketClient({
    bucketSlug: config.bucketSlug,
    readKey: config.readKey,
    writeKey: config.writeKey,
  });

  return cosmicClient;
}

/**
 * Check if write operations are available
 */
export function hasWriteAccess(): boolean {
  return !!process.env.COSMIC_WRITE_KEY;
}

/**
 * Validate that write access is available
 * Throws an error if write key is not configured
 */
export function requireWriteAccess(): void {
  if (!hasWriteAccess()) {
    throw new Error(
      'Write operations require COSMIC_WRITE_KEY environment variable to be set'
    );
  }
}

/**
 * Reset the client (useful for testing)
 */
export function resetClient(): void {
  cosmicClient = null;
}
