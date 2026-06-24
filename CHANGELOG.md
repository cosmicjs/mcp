# @cosmicjs/mcp

## 1.5.0

### Minor Changes

- bb7e732: Add `cosmic_blocks_list` tool to list a bucket's reusable rich-text Content Blocks. This lets models discover the `{{name /}}` block shortcodes that exist in a bucket before writing rich-text content that references them. Requires `@cosmicjs/sdk` >= 2.1.0 (`cosmic.blocks.find()`).
