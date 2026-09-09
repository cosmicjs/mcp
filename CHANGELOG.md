# @cosmicjs/mcp

## 1.6.0

### Minor Changes

- 2797b78: Add tool annotations and an official MCP registry manifest.

  Every tool now advertises a `title` plus the applicable `readOnlyHint`,
  `destructiveHint`, `idempotentHint`, and `openWorldHint`. Clients use these to
  auto-approve safe reads and to prompt before destructive calls, and the
  Anthropic connector directory requires them.

  Adds `server.json` and an `mcpName` field so the server can be published to
  `registry.modelcontextprotocol.io` under the `com.cosmicjs` namespace. Also
  fixes `SERVER_VERSION`, which had drifted to 1.2.0, and keeps it in sync with
  `package.json` on release.

## 1.5.0

### Minor Changes

- bb7e732: Add `cosmic_blocks_list` tool to list a bucket's reusable rich-text Content Blocks. This lets models discover the `{{name /}}` block shortcodes that exist in a bucket before writing rich-text content that references them. Requires `@cosmicjs/sdk` >= 2.1.0 (`cosmic.blocks.find()`).
