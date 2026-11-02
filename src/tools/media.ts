/**
 * Media Management Tools
 * Tools for listing, getting, uploading, and deleting Cosmic media files
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import { getCosmicClient, requireWriteAccess } from '../client.js';
import { formatToolError, isNotFoundError } from '../errors.js';
import type { ToolResult } from '../types.js';
import { additiveTool, destructiveTool, readOnlyTool } from './annotations.js';

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
  props: z.array(z.string()).optional().describe('Specific properties to return'),
});

export const getMediaSchema = z.object({
  id: z.string().describe('Media file ID'),
  props: z.array(z.string()).optional().describe('Specific properties to return'),
});

export const uploadMediaSchema = z.object({
  media: z
    .string()
    .describe('URL to fetch media from, or base64-encoded data with data URI prefix'),
  filename: z
    .string()
    .optional()
    .describe('File name to store, e.g. "cover.webp". Defaults to the URL file name.'),
  content_type: z
    .string()
    .optional()
    .describe('MIME type, e.g. "image/webp". Defaults to the response or data URI type.'),
  folder: z.string().optional().describe('Folder to upload to'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata for the media file'),
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
    ...readOnlyTool('List media'),
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
    ...readOnlyTool('Get media file'),
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
    ...additiveTool('Upload media'),
    description:
      'Upload a media file to the Cosmic bucket from a URL or base64-encoded data. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        media: {
          type: 'string',
          description:
            'Public http(s) URL to fetch media from, or base64-encoded data with data URI prefix (e.g., "data:image/png;base64,...")',
        },
        filename: {
          type: 'string',
          description:
            'File name to store, including extension (e.g., "cover.webp"). Defaults to the file name in the URL, or a generated name with an extension from the MIME type.',
        },
        content_type: {
          type: 'string',
          description:
            'MIME type of the file (e.g., "image/webp"). Defaults to the URL response Content-Type or the data URI MIME type.',
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
    ...destructiveTool('Delete media'),
    description: 'Delete a media file by ID. This action is permanent. Requires write access.',
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
    if (isNotFoundError(error)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ media: [], total: 0 }, null, 2),
          },
        ],
      };
    }
    const message = formatToolError(error);
    return {
      content: [{ type: 'text', text: `Error listing media: ${message}` }],
      isError: true,
    };
  }
}

export async function handleGetMedia(params: z.infer<typeof getMediaSchema>): Promise<ToolResult> {
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
    const message = formatToolError(error);
    return {
      content: [{ type: 'text', text: `Error getting media: ${message}` }],
      isError: true,
    };
  }
}

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/x-icon': 'ico',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'application/zip': 'zip',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const EXTENSION_MIMES: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXTENSIONS).map(([mime, ext]) => [ext, mime])
);
EXTENSION_MIMES.jpeg = 'image/jpeg';

function extensionOf(filename: string): string | undefined {
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : undefined;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveFilename(candidate: string | undefined, contentType: string | undefined): string {
  const base = (candidate || '').trim() || `upload-${Date.now()}`;
  if (extensionOf(base)) return base;
  const ext = contentType ? MIME_EXTENSIONS[contentType] : undefined;
  return ext ? `${base}.${ext}` : base;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80')
  );
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol "${url.protocol}". Use http or https.`);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true })).map((entry) => entry.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error(`URL host "${url.hostname}" is not publicly reachable.`);
  }
}

async function fetchRemoteMedia(
  rawUrl: string
): Promise<{ buffer: Buffer; contentType?: string; filename?: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(
      'media must be an http(s) URL or a base64 data URI (data:<mimetype>;base64,<data>)'
    );
  }

  let response: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    response = await fetch(url, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    break;
  }

  if (!response || (response.status >= 300 && response.status < 400)) {
    throw new Error(`Too many redirects fetching ${rawUrl}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${rawUrl}: HTTP ${response.status}`);
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (declaredLength > MAX_MEDIA_BYTES) {
    throw new Error(`Remote file exceeds the ${MAX_MEDIA_BYTES / 1024 / 1024} MB limit`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_MEDIA_BYTES) {
    throw new Error(`Remote file exceeds the ${MAX_MEDIA_BYTES / 1024 / 1024} MB limit`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const dispositionName = response.headers
    .get('content-disposition')
    ?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];
  const pathName = safeDecode(url.pathname.split('/').pop() || '');

  return {
    buffer,
    contentType:
      contentType && contentType !== 'application/octet-stream' ? contentType : undefined,
    filename: dispositionName ? safeDecode(dispositionName) : pathName || undefined,
  };
}

export async function handleUploadMedia(
  params: z.infer<typeof uploadMediaSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();

    let buffer: Buffer;
    let detectedType: string | undefined;
    let detectedName: string | undefined;
    if (params.media.startsWith('data:')) {
      const matches = params.media.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s);
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
      detectedType = matches[1].toLowerCase();
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      const remote = await fetchRemoteMedia(params.media);
      buffer = remote.buffer;
      detectedType = remote.contentType;
      detectedName = remote.filename;
    }

    const originalname = resolveFilename(
      params.filename || detectedName,
      params.content_type || detectedType
    );
    const type =
      params.content_type ||
      detectedType ||
      EXTENSION_MIMES[extensionOf(originalname) || ''] ||
      'application/octet-stream';

    const response = await cosmic.media.insertOne({
      media: { buffer, originalname, type },
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
    const message = formatToolError(error);
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
    const message = formatToolError(error);
    return {
      content: [{ type: 'text', text: `Error deleting media: ${message}` }],
      isError: true,
    };
  }
}
