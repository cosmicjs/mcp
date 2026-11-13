# Install

These blocks match the README. The registry name is `com.cosmicjs/mcp`. The npm package is `@cosmicjs/mcp` at 1.7.1.

## Hosted (streamable HTTP)

URL: `https://mcp.cosmicjs.com/v1/buckets/{bucket_slug}`

```json
{
  "mcpServers": {
    "cosmic": {
      "url": "https://mcp.cosmicjs.com/v1/buckets/your-bucket-slug",
      "headers": {
        "Authorization": "Bearer your-bucket-read-key:your-bucket-write-key"
      }
    }
  }
}
```

Use the read key alone for read-only tools: `Bearer your-bucket-read-key`.

## Local stdio

```bash
npx -y @cosmicjs/mcp
```

```json
{
  "mcpServers": {
    "cosmic": {
      "command": "npx",
      "args": ["-y", "@cosmicjs/mcp"],
      "env": {
        "COSMIC_BUCKET_SLUG": "your-bucket-slug",
        "COSMIC_READ_KEY": "your-read-key",
        "COSMIC_WRITE_KEY": "your-write-key"
      }
    }
  }
}
```
