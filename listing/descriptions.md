# Cosmic

One-liner (86 characters):

Manage Cosmic CMS content, media, object types, and AI generation from any MCP client.

## Short

Official MCP server for the Cosmic headless CMS. Read and write content and media, edit object types, and generate text, images, video, and audio into a bucket.

## Long

Cosmic is a headless CMS with a hosted MCP server. An agent can list, create, update, and delete objects and media, change object types, and generate text, images, video, and audio into the media library. The hosted endpoint is `https://mcp.cosmicjs.com/v1/buckets/{bucket_slug}`. Send `Authorization: Bearer <read_key>` for read-only tools, or `Authorization: Bearer <read_key>:<write_key>` for writes. The same server installs locally with `npx -y @cosmicjs/mcp`. A separate signup endpoint, `https://mcp.cosmicjs.com/v1/agent`, lets an agent provision a project with no existing account.
