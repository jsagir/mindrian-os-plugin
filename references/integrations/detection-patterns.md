# Integration Detection Patterns

Reference for `lib/core/integration-registry.cjs` -- documents how each integration is detected, when Larry offers it, and the rules for non-blocking behavior.

---

## Integration Catalog

### Brain (Teaching Graph)

| Field | Value |
|-------|-------|
| **Detection** | `MINDRIAN_BRAIN_KEY` env var OR `mindrian-brain` in .mcp.json |
| **Benefit** | Enhanced framework suggestions, grading calibration, cross-domain connections |
| **Setup** | `/mos:setup brain` |

**Trigger signals:** User mentions "suggest-next", "grade", "connections", "framework" while Brain is not connected.

**Offer text:** "By the way -- I'd be sharper with my teaching graph connected. One command: `/mos:setup brain`"

---

### Velma (Transcription)

| Field | Value |
|-------|-------|
| **Detection** | `MODULATE_API_KEY` env var |
| **Benefit** | Audio transcription with speaker diarization and emotion detection |
| **Setup** | `/mos:setup transcription` |

**Trigger signals:** User mentions "audio", "transcript", "recording", "meeting recording" while Velma is not connected.

**Offer text:** "I can transcribe that with speaker identification if you connect Velma -- `/mos:setup transcription`"

---

### Obsidian (Vault Sync)

| Field | Value |
|-------|-------|
| **Detection** | `.obsidian/` directory found in workspace or up to 3 parent directories |
| **Benefit** | Vault sync -- room sections as Obsidian pages with graph view |
| **Setup** | `/mos:setup obsidian` (future) |

**Trigger signals:** User mentions "notes", "vault", "obsidian", "knowledge base" while no vault detected.

**Offer text:** "I noticed you might use Obsidian. Room sections could sync there -- that's on the roadmap."

---

### Notion (Workspace Sync)

| Field | Value |
|-------|-------|
| **Detection** | `NOTION_API_KEY` env var OR `notion` in .mcp.json mcpServers |
| **Benefit** | Workspace sync -- room intelligence in Notion pages |
| **Setup** | `/mos:setup notion` (future) |

**Trigger signals:** User mentions "notion", "workspace", "wiki" while Notion is not connected.

**Offer text:** "Notion sync is coming. For now, `/mos:export` gets your room into any format."

---

### Meeting Source (Auto-Fetch)

| Field | Value |
|-------|-------|
| **Detection** | MCP server keys containing `read-ai`, `vexa`, or `recall-ai` in .mcp.json |
| **Benefit** | Auto-fetch latest meeting transcripts |
| **Setup** | `/mos:setup meetings` |

**Trigger signals:** User mentions "latest meeting", "auto-fetch", "meeting source" while no meeting source connected.

**Offer text:** "I can auto-fetch meeting transcripts if you connect a source -- `/mos:setup meetings`"

---

## Non-Blocking Rules

These rules ensure integration offers NEVER interrupt the user's workflow:

1. **Never during active methodology** -- if `roomState.activeMethodology` is truthy, suppress ALL offers
2. **Maximum ONE offer per conversation** -- not per turn, per entire conversation
3. **Answer first, offer second** -- the user's question always gets a complete answer before any integration mention
4. **No repeats** -- if the user ignores an offer, do not repeat it in the same session
5. **No pricing mentions** -- offers describe capability, never cost
6. **No force** -- offers are suggestions ("By the way..."), never requirements ("You need to...")
7. **Respect opted-out** -- if a user explicitly declines, never offer that integration again in the session

## Context Signal Priority

When multiple integrations could be suggested, the registry returns only the first match in catalog order:

1. Brain (highest -- enriches everything)
2. Velma (audio-specific)
3. Obsidian (note-taking context)
4. Notion (workspace context)
5. Meeting source (meeting context)

This ensures only the most impactful suggestion surfaces.
