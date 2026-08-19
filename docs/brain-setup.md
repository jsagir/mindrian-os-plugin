# Connecting to the MindrianOS Brain

## What is Brain?

Brain is MindrianOS's knowledge graph and semantic search layer. It contains:

- **27,904 nodes** in Neo4j -- frameworks, tools, connections, and teaching intelligence (incl. 12,401 MethodologyChunk substrate; ~15.4K teaching-graph core)
- **19,987 relationships** in Neo4j -- how frameworks chain, overlap, and apply
- **12,485 vectors** in Pinecone (pws-brain, 1024-dim) -- semantic vectors across the PWS curriculum

(Live read 2026-06-27 -- see docs/MINDRIAN-CANON.md Appendix D.)

Brain is a paid-tier feature. Contact Jonathan for an API key.

## Quick Setup

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mindrian-brain": {
      "url": "https://pws-brain-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Then restart Claude Desktop. Six Brain tools will appear automatically.

This works on both **Claude Desktop** and **Cowork**.

## What Brain Adds

| Tool | What it does |
|------|-------------|
| `brain_schema` | Explore the knowledge graph structure (labels, relationships, properties) |
| `brain_query` | Run Cypher queries (read-only) against the teaching graph |
| `brain_write` | Write data to the graph (with confirmation prompt) |
| `brain_search` | Semantic search across the PWS knowledge vectors (Pinecone pws-brain) |
| `brain_stats` | Check index health and record counts |
| `brain_ask` | Flagship GUIDED DirectiveEnvelope tool -- Larry frames the question, chains the frameworks, and teaches the next move |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "401 Invalid Brain API key" | Wrong or missing API key | Check your key with Jonathan (support@mindrian-os.com) |
| First request takes 30-60s | Render free tier cold start | Retry -- subsequent requests are fast |
| "ECONNREFUSED" | Server redeploying | Wait 1 minute, then retry |
| Tools don't appear | Config not loaded | Restart Claude Desktop after editing config |

## For Administrators

**Generate an API key:**

```bash
node -e "console.log(require('crypto').randomUUID())"
```

**Add key to Render:** Go to the Render Dashboard, open the mindrian-brain service,
navigate to Environment, and append the new key to `BRAIN_API_KEYS` (comma-separated).

**Revoke a key:** Remove it from `BRAIN_API_KEYS` and redeploy.

No user database needed. Keys are simple Bearer tokens validated against the env var.
