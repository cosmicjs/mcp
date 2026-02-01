/**
 * AI Generation Tools
 * Tools for generating text, images, and videos using Cosmic AI
 */

import { z } from 'zod';
import { getCosmicClient, requireWriteAccess } from '../client.js';
import type { ToolResult } from '../types.js';

// Schema definitions for tool inputs
export const generateTextSchema = z.object({
  prompt: z.string().describe('The prompt to generate text from'),
  model: z
    .string()
    .optional()
    .describe('AI model to use (e.g., "gpt-4", "claude-3-opus")'),
  max_tokens: z
    .number()
    .min(1)
    .max(100000)
    .optional()
    .describe('Maximum number of tokens to generate'),
});

export const generateImageSchema = z.object({
  prompt: z.string().describe('The prompt describing the image to generate'),
  model: z
    .string()
    .optional()
    .describe('AI model to use for image generation'),
  folder: z
    .string()
    .optional()
    .describe('Folder to save the generated image to'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Additional metadata for the generated image'),
  alt_text: z
    .string()
    .optional()
    .describe('Alt text for the generated image'),
});

export const generateVideoSchema = z.object({
  prompt: z.string().describe('The prompt describing the video to generate'),
  model: z
    .string()
    .optional()
    .describe('AI model to use for video generation'),
  duration: z
    .enum(['4', '6', '8'])
    .optional()
    .describe('Video duration in seconds'),
  resolution: z
    .enum(['720p', '1080p'])
    .optional()
    .describe('Video resolution'),
  folder: z
    .string()
    .optional()
    .describe('Folder to save the generated video to'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Additional metadata for the generated video'),
});

// Tool definitions
export const aiTools = [
  {
    name: 'cosmic_ai_generate_text',
    description:
      'Generate text content using Cosmic AI. Useful for creating content, descriptions, summaries, and more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to generate text from',
        },
        model: {
          type: 'string',
          description: 'AI model to use (e.g., "gpt-4", "claude-3-opus")',
        },
        max_tokens: {
          type: 'number',
          description: 'Maximum number of tokens to generate',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'cosmic_ai_generate_image',
    description:
      'Generate an image using Cosmic AI and automatically upload it to your media library. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt describing the image to generate',
        },
        model: {
          type: 'string',
          description: 'AI model to use for image generation',
        },
        folder: {
          type: 'string',
          description: 'Folder to save the generated image to',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the generated image',
        },
        alt_text: {
          type: 'string',
          description: 'Alt text for the generated image',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'cosmic_ai_generate_video',
    description:
      'Generate a video using Cosmic AI (powered by Veo) and automatically upload it to your media library. Requires write access.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt describing the video to generate',
        },
        model: {
          type: 'string',
          description: 'AI model to use for video generation',
        },
        duration: {
          type: 'string',
          enum: ['4', '6', '8'],
          description: 'Video duration in seconds (4, 6, or 8)',
        },
        resolution: {
          type: 'string',
          enum: ['720p', '1080p'],
          description: 'Video resolution',
        },
        folder: {
          type: 'string',
          description: 'Folder to save the generated video to',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the generated video',
        },
      },
      required: ['prompt'],
    },
  },
];

// Tool handlers
export async function handleGenerateText(
  params: z.infer<typeof generateTextSchema>
): Promise<ToolResult> {
  try {
    const cosmic = getCosmicClient();

    const response = await cosmic.ai.generateText({
      prompt: params.prompt,
      model: params.model,
      max_tokens: params.max_tokens,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Text generated successfully',
              text: response.text,
              model: response.model,
              usage: response.usage,
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
      content: [{ type: 'text', text: `Error generating text: ${message}` }],
      isError: true,
    };
  }
}

export async function handleGenerateImage(
  params: z.infer<typeof generateImageSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();

    const response = await cosmic.ai.generateImage({
      prompt: params.prompt,
      model: params.model,
      folder: params.folder,
      metadata: params.metadata,
      alt_text: params.alt_text,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Image generated successfully',
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
      content: [{ type: 'text', text: `Error generating image: ${message}` }],
      isError: true,
    };
  }
}

export async function handleGenerateVideo(
  params: z.infer<typeof generateVideoSchema>
): Promise<ToolResult> {
  try {
    requireWriteAccess();

    const cosmic = getCosmicClient();

    // Convert duration string to number if provided
    const duration = params.duration
      ? (parseInt(params.duration, 10) as 4 | 6 | 8)
      : undefined;

    const response = await cosmic.ai.generateVideo({
      prompt: params.prompt,
      model: params.model,
      duration,
      resolution: params.resolution,
      folder: params.folder,
      metadata: params.metadata,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Video generated successfully',
              media: response.media,
              usage: response.usage,
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
      content: [{ type: 'text', text: `Error generating video: ${message}` }],
      isError: true,
    };
  }
}
