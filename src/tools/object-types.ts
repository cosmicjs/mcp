/**
 * Object Types Management Tools
 * Tools for listing, getting, creating, updating, and deleting Cosmic object types
 */

import { z } from 'zod';
import { getCosmicClient, requireWriteAccess } from '../client.js';
import type { ToolResult } from '../types.js';

// Metafield schema for validation
const metafieldSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    key: z.string().describe('Unique key for the metafield'),
    title: z.string().describe('Display title for the metafield'),
    type: z
      .enum([
        'text',
        'textarea',
        'html-textarea',
        'markdown',
        'number',
        'date',
        'switch',
        'select-dropdown',
        'radio-buttons',
        'check-boxes',
        'file',
        'object',
        'objects',
        'repeater',
        'parent',
      ])
      .describe('Metafield type'),
    required: z.boolean().optional().describe('Whether this field is required'),
    value: z.unknown().optional().describe('Default value'),
    options: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
        })
      )
      .optional()
      .describe('Options for select/radio/checkbox types'),
    children: z.array(metafieldSchema).optional().describe('Child metafields for repeater/parent types'),
    object_type: z.string().optional().describe('Object type slug for object/objects type metafields'),
  })
);

// Schema definitions for tool inputs
export const listObjectTypesSchema = z.object({});

export const getObjectTypeSchema = z.object({
  slug: z.string().describe('Object type slug'),
});

export const createObjectTypeSchema = z.object({
  title: z.string().describe('Object type title (plural form)'),
  slug: z.string().describe('Object type slug (URL-friendly identifier)'),
  singular: z.string().optional().describe('Singular form of the title'),
  metafields: z
    .array(metafieldSchema as z.ZodType<Record<string, unknown>>)
    .optional()
    .describe('Array of metafield definitions for this object type'),
  options: z
    .object({
      slug_field: z.boolean().optional().describe('Enable slug field'),
      content_editor: z.boolean().optional().describe('Enable content editor'),
    })
    .optional()
    .describe('Object type options'),
});

export const updateObjectTypeSchema = z.object({
  slug: z.string().describe('Object type slug to update'),
  title: z.string().optional().describe('New object type title'),
  singular: z.string().optional().describe('New singular form of the title'),
  metafields: z
    .array(metafieldSchema as z.ZodType<Record<string, unknown>>)
    .optional()
    .describe('Updated array of metafield definitions'),
  options: z
    .object({
      slug_field: z.boolean().optional(),
      content_editor: z.boolean().optional(),
    })
    .optional()
    .describe('Updated object type options'),
});

export const deleteObjectTypeSchema = z.object({
  slug: z.string().describe('Object type slug to delete'),
});

// Tool definitions
export const objectTypeTools = [
  {
    name: 'cosmic_types_list',
    description:
      'List all object types in the Cosmic bucket. Returns the schema definitions including metafields for each type.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'cosmic_types_get',
    description:
      'Get a single object type by slug. Returns the full schema including all metafield definitions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'Object type slug',
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'cosmic_types_create',
    description:
      'Create a new object type with a custom schema. Define metafields to structure your content. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Object type title (plural form, e.g., "Blog Posts")',
        },
        slug: {
          type: 'string',
          description: 'Object type slug (URL-friendly identifier, e.g., "blog-posts")',
        },
        singular: {
          type: 'string',
          description: 'Singular form of the title (e.g., "Blog Post")',
        },
        metafields: {
          type: 'array',
          description: 'Array of metafield definitions',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Unique key' },
              title: { type: 'string', description: 'Display title' },
              type: {
                type: 'string',
                enum: [
                  'text',
                  'textarea',
                  'html-textarea',
                  'markdown',
                  'number',
                  'date',
                  'switch',
                  'select-dropdown',
                  'radio-buttons',
                  'check-boxes',
                  'file',
                  'object',
                  'objects',
                  'repeater',
                  'parent',
                ],
                description: 'Metafield type',
              },
              required: { type: 'boolean', description: 'Whether required' },
            },
            required: ['key', 'title', 'type'],
          },
        },
        options: {
          type: 'object',
          description: 'Object type options',
          properties: {
            slug_field: { type: 'boolean', description: 'Enable slug field' },
            content_editor: { type: 'boolean', description: 'Enable content editor' },
          },
        },
      },
      required: ['title', 'slug'],
    },
  },
  {
    name: 'cosmic_types_update',
    description:
      'Update an existing object type schema. Can modify title, metafields, and options. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'Object type slug to update',
        },
        title: {
          type: 'string',
          description: 'New object type title',
        },
        singular: {
          type: 'string',
          description: 'New singular form of the title',
        },
        metafields: {
          type: 'array',
          description: 'Updated array of metafield definitions',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              title: { type: 'string' },
              type: { type: 'string' },
              required: { type: 'boolean' },
            },
          },
        },
        options: {
          type: 'object',
          description: 'Updated object type options',
          properties: {
            slug_field: { type: 'boolean' },
            content_editor: { type: 'boolean' },
          },
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'cosmic_types_delete',
    description:
      'Delete an object type by slug. WARNING: This will also delete all objects of this type. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'Object type slug to delete',
        },
      },
      required: ['slug'],
    },
  },
];

// Tool handlers
export async function handleListObjectTypes(): Promise<ToolResult> {
  try {
    const cosmic = getCosmicClient();
    const response = await cosmic.objectTypes.find();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              object_types: response.object_types,
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
      content: [{ type: 'text', text: `Error listing object types: ${message}` }],
      isError: true,
    };
  }
}

export async function handleGetObjectType(
  params: z.infer<typeof getObjectTypeSchema>
): Promise<ToolResult> {
  try {
    const cosmic = getCosmicClient();
    const response = await cosmic.objectTypes.findOne(params.slug);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.object_type, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error getting object type: ${message}` }],
      isError: true,
    };
  }
}

export async function handleCreateObjectType(
  params: z.infer<typeof createObjectTypeSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();
    const response = await cosmic.objectTypes.insertOne({
      title: params.title,
      slug: params.slug,
      singular: params.singular,
      metafields: params.metafields,
      options: params.options,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Object type created successfully',
              object_type: response.object_type,
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
      content: [{ type: 'text', text: `Error creating object type: ${message}` }],
      isError: true,
    };
  }
}

export async function handleUpdateObjectType(
  params: z.infer<typeof updateObjectTypeSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();
    const updates: Record<string, unknown> = {};

    if (params.title !== undefined) updates.title = params.title;
    if (params.singular !== undefined) updates.singular = params.singular;
    if (params.metafields !== undefined) updates.metafields = params.metafields;
    if (params.options !== undefined) updates.options = params.options;

    const response = await cosmic.objectTypes.updateOne(params.slug, updates);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Object type updated successfully',
              object_type: response.object_type,
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
      content: [{ type: 'text', text: `Error updating object type: ${message}` }],
      isError: true,
    };
  }
}

export async function handleDeleteObjectType(
  params: z.infer<typeof deleteObjectTypeSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();
    await cosmic.objectTypes.deleteOne(params.slug);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Object type deleted successfully',
              slug: params.slug,
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
      content: [{ type: 'text', text: `Error deleting object type: ${message}` }],
      isError: true,
    };
  }
}
