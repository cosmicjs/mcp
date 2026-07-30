#!/usr/bin/env node
/**
 * Propagates package.json's version to the two places that must agree with it:
 *
 *   - server.json: the MCP registry verifies that the npm package referenced by
 *     the manifest exists at exactly that version, so a stale value here fails
 *     `mcp-publisher publish`.
 *   - SERVER_VERSION in src/server.ts: reported to clients during initialize and
 *     served in the HTTP descriptor. This had already drifted to 1.2.0 while the
 *     package was at 1.5.0.
 *
 * Run automatically by scripts/release.sh after `changeset version`, so the
 * release commit always carries matching versions.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const { version } = JSON.parse(read('package.json'));
if (!version) {
  console.error('Could not read version from package.json');
  process.exit(1);
}

const changed = [];

// server.json: top-level version plus every npm package entry.
const manifestPath = 'server.json';
const manifest = JSON.parse(read(manifestPath));
let manifestDirty = false;

if (manifest.version !== version) {
  manifest.version = version;
  manifestDirty = true;
}
for (const pkg of manifest.packages ?? []) {
  if (pkg.registryType === 'npm' && pkg.version !== version) {
    pkg.version = version;
    manifestDirty = true;
  }
}
if (manifestDirty) {
  writeFileSync(join(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
  changed.push(manifestPath);
}

// src/server.ts: the SERVER_VERSION literal.
const serverPath = 'src/server.ts';
const serverSource = read(serverPath);
const versionPattern = /^export const SERVER_VERSION = '[^']*';$/m;
if (!versionPattern.test(serverSource)) {
  console.error(`Could not find the SERVER_VERSION declaration in ${serverPath}`);
  process.exit(1);
}
const nextServerSource = serverSource.replace(
  versionPattern,
  `export const SERVER_VERSION = '${version}';`,
);
if (nextServerSource !== serverSource) {
  writeFileSync(join(root, serverPath), nextServerSource);
  changed.push(serverPath);
}

if (changed.length === 0) {
  console.log(`Versions already in sync at ${version}`);
} else {
  console.log(`Synced ${changed.join(' and ')} to ${version}`);
}
