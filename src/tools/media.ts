/**
 * Media Management Tools
 * Tools for listing, getting, uploading, and deleting Cosmic media files
 */

import { z } from 'zod';
import { getCosmicClient, requireWriteAccess } from '../client.js';
import type { ToolResult } from '../types.js';

// Schema definitions for tool inputs
export const listMediaSchema = z.object({
  folder: z.string().optional().describe('Filter by folder slug'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe('Maximum number of media files to return'),
  skip: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe('Number of media files to skip for pagination'),
  props: z
    .array(z.string())
    .optional()
    .describe('Specific properties to return'),
});

export const getMediaSchema = z.object({
  id: z.string().describe('Media file ID'),
  props: z.array(z.string()).optional().describe('Specific properties to return'),
});

export const uploadMediaSchema = z.object({
  media: z
    .string()
    .describe('URL to fetch media from, or base64-encoded data with data URI prefix'),
  folder: z.string().optional().describe('Folder to upload to'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Additional metadata for the media file'),
  trigger_webhook: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to trigger webhooks on upload'),
});

export const deleteMediaSchema = z.object({
  id: z.string().describe('Media file ID to delete'),
  trigger_webhook: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to trigger webhooks on delete'),
});

// Tool definitions
export const mediaTools = [
  {
    name: 'cosmic_media_list',
    description:
      'List media files from the Cosmic bucket with optional folder filter and pagination.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        folder: {
          type: 'string',
          description: 'Filter by folder slug',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of media files to return (1-100)',
          default: 10,
        },
        skip: {
          type: 'number',
          description: 'Number of media files to skip for pagination',
          default: 0,
        },
        props: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific properties to return',
        },
      },
    },
  },
  {
    name: 'cosmic_media_get',
    description:
      'Get details of a single media file by ID. Returns the full media object with URL and metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Media file ID',
        },
        props: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific properties to return',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'cosmic_media_upload',
    description:
      'Upload a media file to the Cosmic bucket from a URL or base64-encoded data. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        media: {
          type: 'string',
          description:
            'URL to fetch media from, or base64-encoded data with data URI prefix (e.g., "data:image/png;base64,...")',
        },
        folder: {
          type: 'string',
          description: 'Folder to upload to',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the media file',
        },
        trigger_webhook: {
          type: 'boolean',
          description: 'Whether to trigger webhooks on upload',
          default: true,
        },
      },
      required: ['media'],
    },
  },
  {
    name: 'cosmic_media_delete',
    description:
      'Delete a media file by ID. This action is permanent. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Media file ID to delete',
        },
        trigger_webhook: {
          type: 'boolean',
          description: 'Whether to trigger webhooks on delete',
          default: true,
        },
      },
      required: ['id'],
    },
  },
];

// Tool handlers
export async function handleListMedia(
  params: z.infer<typeof listMediaSchema>
): Promise<ToolResult> {
  try {
    const cosmic = getCosmicClient();
    const query: Record<string, unknown> = {};

    if (params.folder) {
      query.folder = params.folder;
    }

    let request = cosmic.media.find(query);

    if (params.props) {
      request = request.props(params.props);
    }
    if (params.limit) {
      request = request.limit(params.limit);
    }
    if (params.skip) {
      request = request.skip(params.skip);
    }

    const response = await request;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              media: response.media,
              total: response.total,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error listing media: ${message}` }],
      isError: true,
    };
  }
}

export async function handleGetMedia(
  params: z.infer<typeof getMediaSchema>
): Promise<ToolResult> {
  try {
    const cosmic = getCosmicClient();

    let request = cosmic.media.findOne({ id: params.id });

    if (params.props) {
      request = request.props(params.props);
    }

    const response = await request;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.media, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error getting media: ${message}` }],
      isError: true,
    };
  }
}

export async function handleUploadMedia(
  params: z.infer<typeof uploadMediaSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();

    // Determine if it's a URL or base64 data
    let mediaInput: string | Buffer;
    if (params.media.startsWith('data:')) {
      // Base64 data URI - extract the base64 part and convert to Buffer
      const matches = params.media.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Invalid base64 data URI format. Expected format: data:<mimetype>;base64,<data>',
            },
          ],
          isError: true,
        };
      }
      mediaInput = Buffer.from(matches[2], 'base64');
    } else {
      // Assume it's a URL
      mediaInput = params.media;
    }

    const response = await cosmic.media.insertOne({
      media: mediaInput,
      folder: params.folder,
      metadata: params.metadata,
      trigger_webhook: params.trigger_webhook,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Media uploaded successfully',
              media: response.media,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error uploading media: ${message}` }],
      isError: true,
    };
  }
}

export async function handleDeleteMedia(
  params: z.infer<typeof deleteMediaSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();
    await cosmic.media.deleteOne(params.id, params.trigger_webhook);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Media deleted successfully',
              id: params.id,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error deleting media: ${message}` }],
      isError: true,
    };
  }
}
