/**
 * MCP Server Factory
 *
 * Builds an `@modelcontextprotocol/sdk` Server instance with all tools wired.
 * Used by both the stdio entry (`stdio.ts`) and the HTTP entry (`http.ts`).
 *
 * Tool handlers themselves resolve the bucket-scoped Cosmic client via
 * `getCosmicClient()`, which reads from `AsyncLocalStorage` in HTTP mode or
 * falls back to env-driven singleton in stdio mode. See `client.ts`.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

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
  handleGenerateAudio,
  generateTextSchema,
  generateImageSchema,
  generateVideoSchema,
  generateAudioSchema,
} from './tools/ai.js';

export const SERVER_NAME = 'cosmic-mcp';
export const SERVER_VERSION = '1.2.0';

/**
 * Server scope. v1 ships only `bucket`. `account` is reserved for the future
 * account-level MCP at `/v1/account` (PAT-authenticated, cross-bucket tools).
 */
export type ServerScope = 'bucket' | 'account';

export interface CreateServerOptions {
  scope?: ServerScope;
}

const bucketTools = [
  ...objectTools,
  ...mediaTools,
  ...objectTypeTools,
  ...aiTools,
];

function toCallToolResult(result: {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}): CallToolResult {
  return {
    content: result.content,
    isError: result.isError,
  };
}

export function getToolsForScope(scope: ServerScope) {
  if (scope === 'bucket') return bucketTools;
  return bucketTools;
}

export function createServer(options: CreateServerOptions = {}): Server {
  const scope: ServerScope = options.scope ?? 'bucket';
  const tools = getToolsForScope(scope);

  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
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
        case 'cosmic_ai_generate_audio': {
          const params = generateAudioSchema.parse(args);
          return toCallToolResult(await handleGenerateAudio(params));
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

  return server;
}
