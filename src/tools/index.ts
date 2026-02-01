/**
 * Tool Registry
 * Exports all tool definitions and handlers
 */

// Object tools
export {
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
} from './objects.js';

// Media tools
export {
  mediaTools,
  handleListMedia,
  handleGetMedia,
  handleUploadMedia,
  handleDeleteMedia,
  listMediaSchema,
  getMediaSchema,
  uploadMediaSchema,
  deleteMediaSchema,
} from './media.js';

// Object type tools
export {
  objectTypeTools,
  handleListObjectTypes,
  handleGetObjectType,
  handleCreateObjectType,
  handleUpdateObjectType,
  handleDeleteObjectType,
  listObjectTypesSchema,
  getObjectTypeSchema,
  createObjectTypeSchema,
  updateObjectTypeSchema,
  deleteObjectTypeSchema,
} from './object-types.js';

// AI tools
export {
  aiTools,
  handleGenerateText,
  handleGenerateImage,
  handleGenerateVideo,
  generateTextSchema,
  generateImageSchema,
  generateVideoSchema,
} from './ai.js';

// Combined tool list
export const allTools = [
  ...objectTools,
  ...mediaTools,
  ...objectTypeTools,
  ...aiTools,
];
