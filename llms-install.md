# Install Cosmic MCP

The hosted server needs no install. To add it in Cursor, write this `.cursor/mcp.json`. Replace the slug and keys from the bucket's API Access settings at https://app.cosmicjs.com.

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

Read-only access uses `Bearer your-bucket-read-key` with no colon.

If the client cannot use a remote URL, install the stdio server. Node.js 18 or newer is required.

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

`COSMIC_WRITE_KEY` is optional. Without it, create, update, delete, and AI generation tools fail and the read tools still work.

Success: the client lists tools whose names start with `cosmic_`, including `cosmic_objects_list`.
