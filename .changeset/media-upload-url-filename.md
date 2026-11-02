---
"@cosmicjs/mcp": patch
---

Fix `cosmic_media_upload`: URLs are now fetched server-side instead of failing, and uploads keep a file name and MIME type (from the URL, response headers, or data URI). Adds optional `filename` and `content_type` parameters.
