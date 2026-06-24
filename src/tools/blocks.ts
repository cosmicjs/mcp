/**
 * Content Block Tools
 * Read-only access to a bucket's reusable rich-text Content Blocks
 * (`settings.content_blocks`). Blocks are referenced inside rich-text fields
 * with a `{{name /}}` token, so listing them lets a model emit valid tokens.
 */

import { z } from 'zod';
import { getCosmicClient } from '../client.js';
import { formatToolError, isNotFoundError } from '../errors.js';
import type { ToolResult } from '../types.js';

// Schema definitions for tool inputs
export const listBlocksSchema = z.object({});

// Tool definitions
export const blockTools = [
  {
    name: 'cosmic_blocks_list',
    description:
      'List the reusable rich-text Content Blocks defined in the Cosmic bucket. Blocks are referenced inside rich-text metafields with a {{name /}} token. Use this to discover which block shortcodes exist before writing rich-text content that references them. Returns each block\'s name (shortcode), title, description, editor type, and content.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// Tool handlers
export async function handleListBlocks(): Promise<ToolResult> {
  try {
    const cosmic = getCosmicClient();
    const response = await cosmic.blocks.find();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ blocks: response.blocks }, null, 2),
        },
      ],
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ blocks: [] }, null, 2),
          },
        ],
      };
    }
    const message = formatToolError(error);
    return {
      content: [{ type: 'text', text: `Error listing blocks: ${message}` }],
      isError: true,
    };
  }
}
