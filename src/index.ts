#!/usr/bin/env node

/**
 * Cosmic MCP Server
 * Exposes Cosmic CMS functionality as MCP tools for AI assistants
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig } from './client.js';

// Import tool arrays and handlers directly from each module
import {
  objectTools,
  handleListObjects,
  handleGetObject,
  handleCreateObject,
  handleUpdateObject,
  handleDeleteObject,
  listObjectsSchema,
  getObjectSchema,
  createObjectSchema,
  updateObjectSchema,
  deleteObjectSchema,
} from './tools/objects.js';

import {
  mediaTools,
  handleListMedia,
  handleGetMedia,
  handleUploadMedia,
  handleDeleteMedia,
  listMediaSchema,
  getMediaSchema,
  uploadMediaSchema,
  deleteMediaSchema,
} from './tools/media.js';

import {
  objectTypeTools,
  handleListObjectTypes,
  handleGetObjectType,
  handleCreateObjectType,
  handleUpdateObjectType,
  handleDeleteObjectType,
  getObjectTypeSchema,
  createObjectTypeSchema,
  updateObjectTypeSchema,
  deleteObjectTypeSchema,
} from './tools/object-types.js';

import {
  aiTools,
  handleGenerateText,
  handleGenerateImage,
  handleGenerateVideo,
  generateTextSchema,
  generateImageSchema,
  generateVideoSchema,
} from './tools/ai.js';

// Combine all tools
const allTools = [
  ...objectTools,
  ...mediaTools,
  ...objectTypeTools,
  ...aiTools,
];

// Helper to convert our ToolResult to MCP CallToolResult
function toCallToolResult(result: { content: Array<{ type: 'text'; text: string }>; isError?: boolean }): CallToolResult {
  return {
    content: result.content,
    isError: result.isError,
  };
}

// Validate configuration on startup
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

// Create MCP server
const server = new Server(
  {
    name: 'cosmic-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Object tools
      case 'cosmic_objects_list': {
        const params = listObjectsSchema.parse(args);
        return toCallToolResult(await handleListObjects(params));
      }
      case 'cosmic_objects_get': {
        const params = getObjectSchema.parse(args);
        return toCallToolResult(await handleGetObject(params));
      }
      case 'cosmic_objects_create': {
        const params = createObjectSchema.parse(args);
        return toCallToolResult(await handleCreateObject(params));
      }
      case 'cosmic_objects_update': {
        const params = updateObjectSchema.parse(args);
        return toCallToolResult(await handleUpdateObject(params));
      }
      case 'cosmic_objects_delete': {
        const params = deleteObjectSchema.parse(args);
        return toCallToolResult(await handleDeleteObject(params));
      }

      // Media tools
      case 'cosmic_media_list': {
        const params = listMediaSchema.parse(args);
        return toCallToolResult(await handleListMedia(params));
      }
      case 'cosmic_media_get': {
        const params = getMediaSchema.parse(args);
        return toCallToolResult(await handleGetMedia(params));
      }
      case 'cosmic_media_upload': {
        const params = uploadMediaSchema.parse(args);
        return toCallToolResult(await handleUploadMedia(params));
      }
      case 'cosmic_media_delete': {
        const params = deleteMediaSchema.parse(args);
        return toCallToolResult(await handleDeleteMedia(params));
      }

      // Object type tools
      case 'cosmic_types_list': {
        return toCallToolResult(await handleListObjectTypes());
      }
      case 'cosmic_types_get': {
        const params = getObjectTypeSchema.parse(args);
        return toCallToolResult(await handleGetObjectType(params));
      }
      case 'cosmic_types_create': {
        const params = createObjectTypeSchema.parse(args);
        return toCallToolResult(await handleCreateObjectType(params));
      }
      case 'cosmic_types_update': {
        const params = updateObjectTypeSchema.parse(args);
        return toCallToolResult(await handleUpdateObjectType(params));
      }
      case 'cosmic_types_delete': {
        const params = deleteObjectTypeSchema.parse(args);
        return toCallToolResult(await handleDeleteObjectType(params));
      }

      // AI tools
      case 'cosmic_ai_generate_text': {
        const params = generateTextSchema.parse(args);
        return toCallToolResult(await handleGenerateText(params));
      }
      case 'cosmic_ai_generate_image': {
        const params = generateImageSchema.parse(args);
        return toCallToolResult(await handleGenerateImage(params));
      }
      case 'cosmic_ai_generate_video': {
        const params = generateVideoSchema.parse(args);
        return toCallToolResult(await handleGenerateVideo(params));
      }

      default:
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error executing tool ${name}: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Main function
async function main(): Promise<void> {
  validateConfig();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[cosmic-mcp] Server started successfully');
}

// Run server
main().catch((error) => {
  console.error('[cosmic-mcp] Fatal error:', error);
  process.exit(1);
});
