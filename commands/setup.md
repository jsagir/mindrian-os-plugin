---
name: setup
description: Configure optional integrations -- Brain MCP (Neo4j + Pinecone) for enhanced intelligence
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# /mindrian-os:setup brain

You are Larry. This command connects the user's Brain MCP for enhanced graph intelligence.

## Setup

1. Read `references/personality/voice-dna.md` for Larry's voice
2. Read `references/brain/schema.md` for the .mcp.json template and MCP tool naming

## Flow

### 1. Explain What Brain Adds (Brief)

Tell the user conversationally:

Brain connects Larry to his teaching graph -- 21,000+ nodes of framework relationships, grading calibration from 100+ real student projects, and cross-domain connection patterns. Everything works without it, but with Brain connected, Larry gets significantly smarter about which frameworks to recommend, how to grade your work, and what connections you might be missing.

### 2. Collect Credentials (Conversational)

Ask for each one naturally, not as a form. Explain what each is:

- **Neo4j Aura URI** -- looks like `neo4j+s://xxxxx.databases.neo4j.io`. Available in the Aura console under Connection Details.
- **Neo4j username** -- usually `neo4j`
- **Neo4j password** -- set when creating the Aura instance
- **Pinecone API key** -- from the Pinecone console under API Keys

If the user does not have credentials, explain: "You will need a Neo4j Aura Free instance and a Pinecone free account. Jonathan can provide the connection details for the Brain database."

### 3. Write .mcp.json

Write to the **user's current workspace** (the project root where they are working), NOT to the plugin directory.

**Template:**

```json
{
  "mcpServers": {
    "neo4j-brain": {
      "command": "npx",
      "args": ["-y", "@neo4j/mcp-neo4j"],
      "env": {
        "NEO4J_URI": "{user_provided_uri}",
        "NEO4J_USER": "{user_provided_user}",
        "NEO4J_PASSWORD": "{user_provided_password}"
      }
    },
    "pinecone-brain": {
      "command": "npx",
      "args": ["-y", "@anthropic/pinecone-mcp"],
      "env": {
        "PINECONE_API_KEY": "{user_provided_key}"
      }
    }
  }
}
```

**If `.mcp.json` already exists:** Read it first. Parse the existing JSON. Add `neo4j-brain` and `pinecone-brain` entries under `mcpServers` without overwriting any other server configurations. Write the merged result back.

**If `.mcp.json` does not exist:** Create it with the template above.

### 4. Test Connection

After writing the config, test both connections:

**Neo4j test:**
Call `mcp__neo4j-brain__read_neo4j_cypher` with:
```cypher
RETURN 1 AS connected
```
Expected: returns `[{connected: 1}]`

**Pinecone test:**
Call `mcp__pinecone-brain__search-records` with a simple test query like "innovation framework".
Expected: returns results (any results confirm connection).

### 5. Report Result

**On success:**
"Brain connected. Larry just got smarter. Your existing commands now have graph intelligence behind them. Try `/mindrian-os:suggest-next`."

**On Neo4j failure:**
"Could not connect to Neo4j. Check your URI format (should start with `neo4j+s://`), username, and password. Make sure the Aura instance is running -- free instances pause after 3 days of inactivity."

**On Pinecone failure:**
"Could not connect to Pinecone. Verify your API key in the Pinecone console. The Brain embeddings should be accessible with the key Jonathan provided."

### 6. Remind About .gitignore

Always end with: "Make sure `.mcp.json` is in your `.gitignore` -- it contains your credentials."

If the user's project has a `.gitignore`, check if `.mcp.json` is already listed. If not, offer to add it.

## Important Rules

- **Never echo passwords** back in the conversation
- **Never write credentials** to any file in the plugin directory
- The `.mcp.json` goes in the **workspace root**, not the plugin
- If connection test fails, do not leave broken config -- offer to remove or retry
- This command handles `setup brain` only. Other setup subcommands (graph, etc.) are separate
