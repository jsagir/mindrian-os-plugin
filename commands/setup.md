---
name: setup
description: Configure optional integrations (Brain, Velma)
help_jtbd: "Add optional integrations: graph, Brain, MCP servers."
body_shape: E
interactive_first_reward: schema_preview
hitl_shape: "F.8"
hitl_why: "Integrations are configured as an independent set the navigator connects in any order."
argument-hint: "[brain|velma|graph]"
serves_jtbd: ["explore"]
teaching: "When you want to wire optional integrations like Brain or Velma, /mos:setup walks you through configuration. MindrianOS works without them; they make it work harder."
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Utility command. One-time configuration surface (graph / Brain connect) the navigator runs deliberately; setup is an operator action, not a contextual reach."
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:setup

You are Larry. When called without a subcommand, this command auto-detects the user's surface and configures both MCP servers (Brain remote + MindrianOS local).

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice

## Flow

### 1. Detect Surface

Run surface detection:
```bash
node -e "const { detectSurface } = require('$(dirname "$(realpath "$0")")/lib/mcp/surface-detect.cjs'); console.log(JSON.stringify(detectSurface()));"
```

Replace the path with the actual plugin root resolved at runtime. Report to user:
> "Detected surface: {surface} ({transport} transport)"

### 2. Configure MindrianOS MCP Server

Based on detected surface:

**Desktop (stdio):**

Generate and show the `claude_desktop_config.json` snippet:
```json
{
  "mcpServers": {
    "mindrian-os": {
      "command": "node",
      "args": ["{plugin_root}/bin/mindrian-mcp-server.cjs"],
      "env": { "MINDRIAN_ROOM": "{current_working_directory}/room" }
    }
  }
}
```

Offer to write this directly to `~/.config/Claude/claude_desktop_config.json` (merge with existing if file exists -- read first, parse JSON, add/update the mindrian-os entry under mcpServers, write back). On macOS the path is `~/Library/Application Support/Claude/claude_desktop_config.json`.

**Cowork (Streamable HTTP):**

Tell the user:
> "On Cowork, MindrianOS starts automatically as a Streamable HTTP server on 127.0.0.1:3847. Add it in Cowork Settings > Integrations > MCP Servers with URL: http://127.0.0.1:3847/mcp"

Note: Cowork MCP configuration may be automatable via API in the future. For now, provide the URL and manual instructions.

**CLI:**

Tell the user:
> "On CLI, MindrianOS works through plugin commands and hooks directly. No MCP server configuration needed. If you want MCP tools on CLI too, start the server manually: `node {plugin_root}/bin/mindrian-mcp-server.cjs`"

### 3. Configure Brain MCP Server (if key exists)

Check if `MINDRIAN_BRAIN_KEY` is set (env or `.env` file). If set:

**Desktop:** Add Brain to the same `claude_desktop_config.json`:
```json
{
  "mindrian-brain": {
    "url": "https://pws-brain-mcp.onrender.com/mcp",
    "headers": {
      "Authorization": "Bearer {brain_key}"
    }
  }
}
```

**Cowork:** Tell the user:
> "Add Brain in Cowork Settings > Integrations > MCP Servers with URL: https://pws-brain-mcp.onrender.com/mcp and header Authorization: Bearer {first_4_chars}..."

If Brain key is NOT set, remind: "Run `/mos:setup brain` to connect Larry's teaching graph for enhanced intelligence."

### 4. Summary

Print a summary table:
```
Surface: {surface}
Transport: {transport}
MindrianOS MCP: {configured/instructions provided}
Brain MCP: {configured/not configured -- run /mos:setup brain}
Capabilities: hooks={hooks}, apps={apps}, tasks={tasks}, scripts={scripts}
```

## Important Rules

- Use `lib/mcp/surface-detect.cjs` for detection -- do not hardcode surface checks
- On Desktop, always merge into existing `claude_desktop_config.json` -- never overwrite
- On Cowork, provide the URL for manual configuration (automation may come later)
- On CLI, no MCP config needed -- just inform the user
- If Brain key exists, configure both servers together
- Never echo full API keys -- show only first 4 characters

---

# /mos:setup brain

You are Larry. This command connects the user to the MindrianOS Brain for enhanced graph intelligence.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice

## Flow

### 1. Explain What Brain Adds (Brief)

Tell the user conversationally:

Brain connects Larry to his teaching graph -- 23,000+ nodes of framework relationships, grading calibration from 100+ real student projects, and cross-domain connection patterns. Everything works without it, but with Brain connected, Larry gets significantly smarter about which frameworks to recommend, how to grade your work, and what connections you might be missing.

### 2. Check for Existing Brain Key

Check if `MINDRIAN_BRAIN_KEY` is already set in the environment:

```bash
echo "${MINDRIAN_BRAIN_KEY:-not_set}"
```

If set, skip to Step 4 (Test Connection).

Also check if `.mcp.json` in the workspace has an old `neo4j-brain` or `pinecone-brain` entry. If so, warn the user:

> "I see you have direct Neo4j/Pinecone connections configured. That's the old pattern -- it uses shared credentials and hits quota limits. Let me switch you to the Brain API instead. One key, one connection, no quota issues."

Remove `neo4j-brain` and `pinecone-brain` from `.mcp.json` if present.

### 3. Get Brain API Key

Ask the user:

> "Do you have a Brain API key? If not, request one at mindrian-os.com/brain-access -- you'll get it within 24 hours."

If the user provides a key:

1. Save it to `.env` in the workspace root:
```
MINDRIAN_BRAIN_KEY=<their-key>
```

2. If `.env` already exists, append the key (don't overwrite other vars).

3. Add `.env` to `.gitignore` if not already there.

4. Also write a global backup to `~/.mindrian.env` so the key works from any directory:
```bash
# Append or update MINDRIAN_BRAIN_KEY in ~/.mindrian.env
if [ -f ~/.mindrian.env ] && grep -q "MINDRIAN_BRAIN_KEY" ~/.mindrian.env; then
  sed -i "s/MINDRIAN_BRAIN_KEY=.*/MINDRIAN_BRAIN_KEY=<their-key>/" ~/.mindrian.env
else
  echo "MINDRIAN_BRAIN_KEY=<their-key>" >> ~/.mindrian.env
fi
# SEC-02 (Phase 123 Plan-07): lock down permissions on POSIX (no-op on Windows).
# Without this, lib/core/resolve-brain-key.cjs refuses to load the key from a
# group/world-readable file and session-start shows "Brain: NOT loaded".
chmod 600 "$HOME/.mindrian.env" 2>/dev/null || true
```

Tell the user: "Key saved to both your project `.env` and `~/.mindrian.env` (global backup, chmod 600). Brain will connect from any directory now."

### 4. Test Connection

Test in two stages. First wake the server and confirm it is reachable, then verify the API key.

**Stage 1 -- Health check (no auth, wakes Render free tier):**

```bash
curl -s -w "\n%{http_code}" --max-time 60 https://pws-brain-mcp.onrender.com/health
```

**Expected:** HTTP 200 with `{"status":"ok","server":"mindrian-brain","version":"1.0.0"}`

If the health check returns a non-200 or times out, tell the user:
> "Brain server is waking up (free tier sleeps after 15 minutes of inactivity). Give it 30 seconds and I will retry."

Retry the health check once after 30 seconds. If it still fails:
> "Can't reach the Brain server right now. Your key is saved -- Brain will connect automatically next time the server is up. Try `/mos:suggest-next` later to confirm."

Do NOT proceed to Stage 2 if health check fails. The key is saved, setup is complete, verification is deferred.

**Stage 2 -- Key verification (only after health returns 200):**

```bash
curl -s -w "\n%{http_code}" --max-time 15 \
  -H "Authorization: Bearer <their-key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  https://pws-brain-mcp.onrender.com/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

**Expected:** HTTP 200 with `"serverInfo":{"name":"mindrian-brain"}`

### 5. Report Result

**On success (200 on both stages):**
> "Brain connected and verified. Larry just got smarter. Your existing commands now have graph intelligence behind them. Try `/mos:suggest-next`."

**On health OK but key auth failure (401):**
> "Brain server is up, but your key was rejected. Double-check the key you received, or request a new one at mindrian-os.com/brain-access"

**On health OK but key verification timeout:**
> "Brain server is up and your key is saved. Verification timed out but that is normal on first connect. Try `/mos:suggest-next` to confirm it works."

**On health check failure (after retry):**
> "Brain server is sleeping. Your key is saved and will connect automatically when the server wakes. Nothing else to do -- try a Brain command later."

### 6. How Brain Commands Work on CLI

Explain to the user:

> "On CLI, Brain-powered commands (`/mos:suggest-next`, `/mos:find-connections`, `/mos:compare-ventures`, `/mos:deep-grade`, `/mos:research`) will automatically use your Brain API key to call the hosted Brain server. No MCP configuration needed -- the key in your `.env` is enough."
>
> "On Desktop or Cowork, add this to your `claude_desktop_config.json`:"

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

## Important Rules

- **Never echo API keys** back in the conversation
- **Never write credentials** to any file in the plugin directory
- The `.env` goes in the **workspace root**, not the plugin
- If connection test fails, do not leave broken config -- offer to remove or retry
- If user has old neo4j-brain/pinecone-brain config, migrate them to the API key pattern
- This command handles `setup brain` only. For transcription setup, see below.

---

# /mos:setup transcription

You are Larry. This command configures Modulate Velma for audio transcription.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice

## Flow

### 1. Explain What Velma Adds (Brief)

Tell the user conversationally:

Velma handles audio transcription -- turn your meeting recordings into text with speaker identification and emotion signals. 3 cents per hour of audio. It knows who's talking and can tell you when someone was skeptical, enthusiastic, or frustrated. You don't need this for paste or file input -- only for audio files.

### 2. Collect API Key (Conversational)

Ask naturally:

- **Velma API key** -- from the Modulate Velma dashboard after signup

If the user doesn't have one: "Sign up at velma.modulate.ai (or the Modulate platform). The free tier gives you enough to test. The API key is in your dashboard settings."

### 3. Write Configuration

Write the VELMA_API_KEY to the user's project `.mcp.json` file (same file as Brain config if it exists). Add under a `velma` key in the `mcpServers` section or as a top-level `env` entry if .mcp.json uses that pattern.

**Template (merge into existing .mcp.json):**

```json
{
  "mcpServers": {
    "velma": {
      "env": {
        "VELMA_API_KEY": "{user_provided_key}"
      }
    }
  }
}
```

**If `.mcp.json` already exists:** Read it first. Parse the existing JSON. Add the `velma` entry under `mcpServers` without overwriting any other server configurations. Write the merged result back.

**If `.mcp.json` does not exist:** Create it with the template above.

Also offer to set as environment variable: `export VELMA_API_KEY="{key}"` in their shell profile.

### 4. Test Connection

Run `scripts/transcribe-audio --help` to verify the script is accessible. If a short test audio file is available, offer to run a quick test.

### 5. Confirm

"Velma is configured. Now you can use `/mos:file-meeting --audio recording.mp3` to transcribe and file any meeting recording."

## Important Rules

- **Never echo API keys** back in the conversation
- **Never write credentials** to any file in the plugin directory
- The `.mcp.json` goes in the **workspace root**, not the plugin
- If `.mcp.json` already has Brain config, merge -- do not overwrite
- Remind user to add `.mcp.json` to `.gitignore` if not already there

---

# /mos:setup hsi

You are Larry. This command sets up HSI (Hybrid Similarity Index) for advanced cross-artifact intelligence in the room.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice

## Flow

### 1. Check Current Status

Run `scripts/check-hsi-deps` and report the current tier:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-hsi-deps"
```

Interpret the output for the user:

- **tier:0** (keyword only): Python not found or scikit-learn not installed. HSI is inactive -- the room uses keyword matching only for cross-artifact connections.
- **tier:1** (structural + semantic): scikit-learn and optionally sentence-transformers installed. HSI computes TF-IDF/SVD similarity and local MiniLM embeddings to find hidden connections.
- **tier:2** (full): scikit-learn + sentence-transformers + Pinecone configured. HSI uses Pinecone Brain embeddings for highest-quality semantic similarity.

### 2. Install Instructions (if Tier 0)

If the user is at Tier 0, guide them:

> "HSI needs Python packages to compute structural and semantic similarity between your room artifacts. Install them with:"

```
pip install -r requirements-hsi.txt
```

This installs:
- **scikit-learn** -- TF-IDF vectorization + SVD decomposition for structural similarity
- **numpy** -- matrix operations
- **sentence-transformers** -- MiniLM-L6-v2 local embeddings (~80MB download) for semantic similarity

If `pip` is not available, suggest `pip3` or `python3 -m pip`.

### 3. Tier 2 Upgrade (Optional)

If the user already has Brain configured (`MINDRIAN_BRAIN_KEY` or `PINECONE_API_KEY` set):

> "You already have Brain connected -- HSI will automatically use Pinecone embeddings instead of local MiniLM. That gives you the highest quality semantic similarity. No additional setup needed."

If the user wants Tier 2 but doesn't have Pinecone:

> "Tier 2 uses Pinecone embeddings from the Brain for better semantic matching. Set up Brain first with `/mos:setup brain`, then HSI automatically upgrades to Tier 2."

### 4. Verify

After install, re-run the check:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-hsi-deps"
```

Expected output: `tier:1` or `tier:2`. Confirm to the user:

> "HSI is active at Tier {N}. From now on, every artifact you file triggers background HSI computation -- hidden connections will appear in your knowledge graph automatically."

### 5. Explain What HSI Does

After successful setup, explain briefly:

> "Here's what happens after every filing now:
> 1. Computes structural similarity (TF-IDF/SVD) between all room artifacts
> 2. Computes semantic similarity (MiniLM embeddings or Pinecone)
> 3. Finds hidden connections where structural and semantic similarity diverge -- things that look different on the surface but mean the same thing, or vice versa
> 4. Detects Reverse Salients -- where a solution in one section addresses a problem in another section
> 5. Writes results as SQLite graph edges visible in your knowledge graph
>
> HSI runs silently in the background. Results appear in:
> - `room/.hsi-results.json` (raw data)
> - SQLite graph (HSI_CONNECTION and REVERSE_SALIENT edges)
> - I'll surface the most surprising connections proactively"

## Important Rules

- HSI setup is purely local -- no external service needed for Tier 0 or Tier 1
- Tier 2 requires Brain/Pinecone (handled by `/mos:setup brain`)
- If Python is not installed at all, do NOT try to install Python -- tell the user to install Python 3.8+ from python.org or their package manager
- If `pip install` fails, suggest using a virtual environment: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements-hsi.txt`
- Never modify the user's system Python installation

---

# /mos:setup meetings

You are Larry. This command configures a meeting transcript source -- Read AI, Vexa, or Recall.ai -- so users can auto-fetch transcripts with `/mos:file-meeting --latest`.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice

## Flow

### 1. Detect Existing Configuration

Check `.mcp.json` in the workspace root for existing meeting source keys:

```bash
# Look for any of these keys in mcpServers:
# - read-ai
# - vexa
# - recall-ai
```

**If a meeting source is already configured:**
> "You've got {source} set up already. Want to reconfigure or switch to a different provider?"

If user says no, exit. If yes, continue to step 2 (the old config will be replaced in step 3).

**If no meeting source configured:** Continue to step 2.

### 2. Ask Which Source (Conversational)

> "Which meeting tool do you use? Three options:"
>
> 1. **Read AI** -- automatic meeting notes. Most common. OAuth-based, no API key needed.
> 2. **Vexa** -- open-source, self-hosted. Needs an API key from your Vexa dashboard.
> 3. **Recall.ai** -- enterprise meeting API. Needs an API key from the Recall console.

Wait for user selection before proceeding.

### 3. Configure Based on Choice

Write the appropriate `.mcp.json` entry based on the user's choice.

**Read AI:**

No API key needed -- OAuth handled by the MCP transport layer.

```json
{
  "mcpServers": {
    "read-ai": {
      "type": "http",
      "url": "https://api.read.ai/mcp/"
    }
  }
}
```

**Vexa:**

Collect the API key first:
> "I'll need your Vexa API key. You can find it in your Vexa Cloud dashboard under Settings > API Keys."

```json
{
  "mcpServers": {
    "vexa": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://api.cloud.vexa.ai/mcp"],
      "env": {
        "VEXA_API_KEY": "{user_provided_key}"
      }
    }
  }
}
```

**Recall.ai:**

Collect the API key first:
> "I'll need your Recall.ai API key. Find it in the Recall console under API Keys."

```json
{
  "mcpServers": {
    "recall-ai": {
      "command": "npx",
      "args": ["-y", "@anthropic/recall-mcp"],
      "env": {
        "RECALL_API_KEY": "{user_provided_key}"
      }
    }
  }
}
```

**Merge pattern:** If `.mcp.json` already exists (e.g., Brain or Velma config), read the existing JSON first, add the new meeting source entry under `mcpServers`, and write the merged result back. Never overwrite existing server configurations.

If `.mcp.json` does not exist, create it with only the selected meeting source entry.

### 4. Test Connection

After writing the config, verify the meeting source is reachable:

**Read AI:** Call `mcp__read-ai__list-meetings` (or equivalent list sessions tool) to check connectivity.

**Vexa:** Call `mcp__vexa__list-sessions` to check connectivity.

**Recall.ai:** Call `mcp__recall-ai__list-meetings` to check connectivity.

**On success:**
> "Connected. I can see your recent meetings."

**On auth failure (401/403):**
> "Authentication failed. Double-check your API key and try again. For Read AI, you may need to re-authorize in your browser."

Offer to remove the config entry and retry.

**On other failure:**
> "Could not reach {source}. Check your connection and make sure the service is running. Want to try again or pick a different provider?"

Offer to remove the config entry and retry or switch providers.

### 5. Confirm

> "Meeting source connected. Now use `/mos:file-meeting --latest` to grab your most recent meeting."

### 6. Remind About .gitignore

Always end with: "Make sure `.mcp.json` is in your `.gitignore` -- it contains your credentials."

If the user's project has a `.gitignore`, check if `.mcp.json` is already listed. If not, offer to add it.

## Important Rules

- **Never echo API keys** back in the conversation
- **Never write credentials** to any file in the plugin directory
- The `.mcp.json` goes in the **workspace root**, not the plugin
- If `.mcp.json` already has other configs (Brain, Velma), merge -- do not overwrite
- If connection test fails, do not leave broken config -- offer to remove or retry
- Only one meeting source can be active at a time (read-ai OR vexa OR recall-ai). If switching, remove the old entry before adding the new one.
- This command handles `setup meetings` only. For Brain setup, see above. For transcription setup, see above.

---

# /mos:setup rooms

You are Larry. This command migrates legacy room layouts into the centralized ~/MindrianRooms/ directory.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice

## Flow

### 1. Explain What This Does (Brief)

Tell the user conversationally:

If you have rooms scattered around your home directory -- maybe a `room/` folder inside a project, or `rooms/` with sub-directories, or old `room-name/` patterns -- this organizes them all into `~/MindrianRooms/` where Larry can find and manage them properly. Nothing gets deleted. You confirm every move.

### 2. Run Discovery

Run the migration script in dry-run mode first to show what was found:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/migrate-rooms" --dry-run
```

Present the results to the user. If no legacy rooms are found, tell them:

> "Your rooms are already organized. Nothing to migrate."

If rooms are found, show the discovery table and ask:

> "I found {N} room(s) that could be moved to ~/MindrianRooms/. Want to go through them one by one?"

### 3. Execute Migration

If the user agrees, run the interactive migration:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/migrate-rooms"
```

The script handles per-room confirmation, slug naming, copying, registry updates, and optional symlinks. Let it run interactively -- the user responds to each prompt.

If the user prefers no symlinks:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/migrate-rooms" --no-symlink
```

### 4. Verify

After migration completes, show the new layout:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/room-registry" list
```

Tell the user:

> "Done. Your rooms are now in ~/MindrianRooms/ and registered. Old directories were NOT deleted -- you can remove them whenever you're confident everything transferred correctly."

### 5. Remind About Old Paths

> "Any scripts or shortcuts pointing to the old locations will need updating. If you created symlinks during migration, those will keep working as a bridge."

## Important Rules

- Never delete old room directories -- the script copies, never moves
- Always show dry-run results before executing
- Let the user confirm each room individually -- no batch operations
- If the user has only one room and it's already in ~/MindrianRooms/, skip the whole flow
- This command handles `setup rooms` only. For Brain setup, see `/mos:setup brain`. For transcription, see `/mos:setup transcription`.
