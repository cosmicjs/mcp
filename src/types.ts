/**
 * Cosmic MCP Server Types
 */

export interface CosmicConfig {
  bucketSlug: string;
  readKey: string;
  writeKey?: string;
}

export interface CosmicObject {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: 'published' | 'draft';
  metadata?: Record<string, unknown>;
  content?: string;
  created_at: string;
  modified_at: string;
  published_at?: string;
  locale?: string;
}

export interface CosmicMedia {
  id: string;
  name: string;
  original_name: string;
  size: number;
  type: string;
  url: string;
  imgix_url?: string;
  folder?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CosmicObjectType {
  slug: string;
  title: string;
  singular: string;
  metafields?: Metafield[];
  options?: ObjectTypeOptions;
}

export interface Metafield {
  key: string;
  title: string;
  type: MetafieldType;
  required?: boolean;
  value?: unknown;
  options?: MetafieldOption[];
  children?: Metafield[];
}

export type MetafieldType =
  | 'text'
  | 'textarea'
  | 'html-textarea'
  | 'markdown'
  | 'number'
  | 'date'
  | 'switch'
  | 'select-dropdown'
  | 'radio-buttons'
  | 'check-boxes'
  | 'file'
  | 'object'
  | 'objects'
  | 'repeater'
  | 'parent';

export interface MetafieldOption {
  key: string;
  value: string;
}

export interface ObjectTypeOptions {
  slug_field?: boolean;
  content_editor?: boolean;
}

export interface ListObjectsParams {
  type?: string;
  status?: 'published' | 'draft' | 'any';
  limit?: number;
  skip?: number;
  props?: string[];
  query?: Record<string, unknown>;
  sort?: string;
  depth?: number;
}

export interface ListMediaParams {
  folder?: string;
  limit?: number;
  skip?: number;
  props?: string[];
}

export interface CreateObjectParams {
  title: string;
  type: string;
  slug?: string;
  content?: string;
  status?: 'published' | 'draft';
  metadata?: Record<string, unknown>;
  locale?: string;
}

export interface UpdateObjectParams {
  title?: string;
  slug?: string;
  content?: string;
  status?: 'published' | 'draft';
  metadata?: Record<string, unknown>;
}

export interface UploadMediaParams {
  media: string; // URL or base64
  folder?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateObjectTypeParams {
  title: string;
  slug: string;
  singular?: string;
  metafields?: Metafield[];
  options?: ObjectTypeOptions;
}

export interface UpdateObjectTypeParams {
  title?: string;
  singular?: string;
  metafields?: Metafield[];
  options?: ObjectTypeOptions;
}

export interface GenerateTextParams {
  prompt: string;
  model?: string;
  max_tokens?: number;
}

export interface GenerateImageParams {
  prompt: string;
  model?: string;
  folder?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerateVideoParams {
  prompt: string;
  model?: string;
  duration?: 4 | 6 | 8;
  resolution?: '720p' | '1080p';
  folder?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}
