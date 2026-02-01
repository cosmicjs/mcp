/**
 * Object Management Tools
 * Tools for listing, getting, creating, updating, and deleting Cosmic objects
 */

import { z } from 'zod';
import { getCosmicClient, requireWriteAccess } from '../client.js';
import type { ToolResult } from '../types.js';

// Schema definitions for tool inputs
export const listObjectsSchema = z.object({
  type: z.string().optional().describe('Object type slug to filter by'),
  status: z
    .enum(['published', 'draft', 'any'])
    .optional()
    .default('any')
    .describe('Filter by publication status'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe('Maximum number of objects to return'),
  skip: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe('Number of objects to skip for pagination'),
  props: z
    .array(z.string())
    .optional()
    .describe('Specific properties to return'),
  sort: z
    .string()
    .optional()
    .describe('Sort order (e.g., "-created_at" for descending)'),
  depth: z
    .number()
    .min(0)
    .max(3)
    .optional()
    .describe('Depth of nested object relationships to include'),
  query: z
    .record(z.unknown())
    .optional()
    .describe('Custom query object for advanced filtering'),
});

export const getObjectSchema = z.object({
  id: z.string().optional().describe('Object ID'),
  slug: z.string().optional().describe('Object slug'),
  type: z
    .string()
    .optional()
    .describe('Object type slug (required when using slug)'),
  props: z.array(z.string()).optional().describe('Specific properties to return'),
  status: z
    .enum(['published', 'draft', 'any'])
    .optional()
    .default('any')
    .describe('Filter by publication status'),
});

export const createObjectSchema = z.object({
  title: z.string().describe('Object title'),
  type: z.string().describe('Object type slug'),
  slug: z.string().optional().describe('Custom slug (auto-generated if not provided)'),
  content: z.string().optional().describe('Object content (HTML or plain text)'),
  status: z
    .enum(['published', 'draft'])
    .optional()
    .default('draft')
    .describe('Publication status'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Metadata fields matching the object type schema'),
  locale: z.string().optional().describe('Locale code for localized content'),
});

export const updateObjectSchema = z.object({
  id: z.string().describe('Object ID to update'),
  title: z.string().optional().describe('New object title'),
  slug: z.string().optional().describe('New object slug'),
  content: z.string().optional().describe('New object content'),
  status: z
    .enum(['published', 'draft'])
    .optional()
    .describe('New publication status'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Updated metadata fields'),
});

export const deleteObjectSchema = z.object({
  id: z.string().describe('Object ID to delete'),
  trigger_webhook: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to trigger webhooks on delete'),
});

// Tool definitions
export const objectTools = [
  {
    name: 'cosmic_objects_list',
    description:
      'List objects from the Cosmic bucket with optional filters for type, status, and pagination. Returns an array of objects with their metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          description: 'Object type slug to filter by',
        },
        status: {
          type: 'string',
          enum: ['published', 'draft', 'any'],
          description: 'Filter by publication status',
          default: 'any',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of objects to return (1-100)',
          default: 10,
        },
        skip: {
          type: 'number',
          description: 'Number of objects to skip for pagination',
          default: 0,
        },
        props: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific properties to return',
        },
        sort: {
          type: 'string',
          description: 'Sort order (e.g., "-created_at" for descending)',
        },
        depth: {
          type: 'number',
          description: 'Depth of nested object relationships to include (0-3)',
        },
        query: {
          type: 'object',
          description: 'Custom query object for advanced filtering',
        },
      },
    },
  },
  {
    name: 'cosmic_objects_get',
    description:
      'Get a single object by ID or by slug+type. Returns the full object with all metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Object ID',
        },
        slug: {
          type: 'string',
          description: 'Object slug (requires type parameter)',
        },
        type: {
          type: 'string',
          description: 'Object type slug (required when using slug)',
        },
        props: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific properties to return',
        },
        status: {
          type: 'string',
          enum: ['published', 'draft', 'any'],
          description: 'Filter by publication status',
          default: 'any',
        },
      },
    },
  },
  {
    name: 'cosmic_objects_create',
    description:
      'Create a new object in the Cosmic bucket. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Object title',
        },
        type: {
          type: 'string',
          description: 'Object type slug',
        },
        slug: {
          type: 'string',
          description: 'Custom slug (auto-generated if not provided)',
        },
        content: {
          type: 'string',
          description: 'Object content (HTML or plain text)',
        },
        status: {
          type: 'string',
          enum: ['published', 'draft'],
          description: 'Publication status',
          default: 'draft',
        },
        metadata: {
          type: 'object',
          description: 'Metadata fields matching the object type schema',
        },
        locale: {
          type: 'string',
          description: 'Locale code for localized content',
        },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'cosmic_objects_update',
    description:
      'Update an existing object by ID. Only provided fields will be updated. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Object ID to update',
        },
        title: {
          type: 'string',
          description: 'New object title',
        },
        slug: {
          type: 'string',
          description: 'New object slug',
        },
        content: {
          type: 'string',
          description: 'New object content',
        },
        status: {
          type: 'string',
          enum: ['published', 'draft'],
          description: 'New publication status',
        },
        metadata: {
          type: 'object',
          description: 'Updated metadata fields',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'cosmic_objects_delete',
    description:
      'Delete an object by ID. This action is permanent. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Object ID to delete',
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
export async function handleListObjects(
  params: z.infer<typeof listObjectsSchema>
): Promise<ToolResult> {
  try {
    const cosmic = getCosmicClient();
    const query: Record<string, unknown> = params.query || {};

    if (params.type) {
      query.type = params.type;
    }

    let request = cosmic.objects.find(query);

    if (params.props) {
      request = request.props(params.props);
    }
    if (params.limit) {
      request = request.limit(params.limit);
    }
    if (params.skip) {
      request = request.skip(params.skip);
    }
    if (params.sort) {
      request = request.sort(params.sort);
    }
    if (params.status) {
      request = request.status(params.status);
    }
    if (params.depth !== undefined) {
      request = request.depth(params.depth);
    }

    const response = await request;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              objects: response.objects,
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
      content: [{ type: 'text', text: `Error listing objects: ${message}` }],
      isError: true,
    };
  }
}

export async function handleGetObject(
  params: z.infer<typeof getObjectSchema>
): Promise<ToolResult> {
  try {
    if (!params.id && !params.slug) {
      return {
        content: [
          { type: 'text', text: 'Error: Either id or slug must be provided' },
        ],
        isError: true,
      };
    }

    if (params.slug && !params.type) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: type is required when using slug to get an object',
          },
        ],
        isError: true,
      };
    }

    const cosmic = getCosmicClient();

    let request;
    if (params.id) {
      request = cosmic.objects.findOne({ id: params.id });
    } else {
      request = cosmic.objects.findOne({
        type: params.type!,
        slug: params.slug!,
      });
    }

    if (params.props) {
      request = request.props(params.props);
    }
    if (params.status) {
      request = request.status(params.status);
    }

    const response = await request;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.object, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error getting object: ${message}` }],
      isError: true,
    };
  }
}

export async function handleCreateObject(
  params: z.infer<typeof createObjectSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();
    const response = await cosmic.objects.insertOne({
      title: params.title,
      type: params.type,
      slug: params.slug,
      content: params.content,
      status: params.status,
      metadata: params.metadata,
      locale: params.locale,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Object created successfully',
              object: response.object,
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
      content: [{ type: 'text', text: `Error creating object: ${message}` }],
      isError: true,
    };
  }
}

export async function handleUpdateObject(
  params: z.infer<typeof updateObjectSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();
    const updates: Record<string, unknown> = {};

    if (params.title !== undefined) updates.title = params.title;
    if (params.slug !== undefined) updates.slug = params.slug;
    if (params.content !== undefined) updates.content = params.content;
    if (params.status !== undefined) updates.status = params.status;
    if (params.metadata !== undefined) updates.metadata = params.metadata;

    const response = await cosmic.objects.updateOne(params.id, updates);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Object updated successfully',
              object: response.object,
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
      content: [{ type: 'text', text: `Error updating object: ${message}` }],
      isError: true,
    };
  }
}

export async function handleDeleteObject(
  params: z.infer<typeof deleteObjectSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();
    await cosmic.objects.deleteOne(params.id, params.trigger_webhook);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Object deleted successfully',
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
      content: [{ type: 'text', text: `Error deleting object: ${message}` }],
      isError: true,
    };
  }
}
