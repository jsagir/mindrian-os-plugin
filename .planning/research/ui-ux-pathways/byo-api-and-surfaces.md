---
type: architecture-extension
status: concept
source: Session 2026-04-16 discussion (Jonathan + Larry)
extends: architecture-vision.md
---

# BYO API + Multi-Surface Architecture

## The insight (Jonathan, 2026-04-16)

"Maybe tonight's answer can be wrapped in a plugin that also has a BYO API that you can talk to the room."

This reframes the localhost server from a RENDERER into an API SERVER. The dashboard is just one client. The API surface serves every other client: Chrome extension, Discord bot, mobile app, Slack integration, or any HTTP client with a BYO API key.

## BYO API design

The user brings their own Anthropic API key. MindrianOS handles context injection (room state, Brain, intelligence). The user's key handles the LLM call. MindrianOS never touches or stores the key.

### Endpoints (on localhost:3131)

```
GET  /                         Dashboard UI (Phase 86)
GET  /events                   SSE live-reload stream (Phase 86)

GET  /api/room/status          Room state JSON (sections, entries, stage, intelligence)
GET  /api/room/graph           Cytoscape-compatible graph from room.db
GET  /api/room/section/:name   Section artifacts with frontmatter
GET  /api/room/intelligence    Current convergence, contradictions, gaps
GET  /api/room/meetings        Meeting index with key signals

POST /api/room/chat            BYO API chat
     Body: { "message": "...", "api_key": "sk-ant-...", "model": "claude-sonnet-4-20250514" }
     Response: Larry response with full room context injected
     (room state + Brain enrichment + intelligence strip + Larry personality)

POST /api/room/command         Queue a methodology command
     Body: { "command": "/mos:analyze-needs", "args": {"section": "market-analysis"} }
     Response: { "queued": true, "id": "cmd-001" } (Phase 87 v2 command queue)

POST /api/room/query           Natural language graph query
     Body: { "question": "What contradicts my market analysis?" }
     Response: Brain + room.db cross-referenced answer
```

### Security model

- All endpoints are localhost-only by default (bind to 127.0.0.1, not 0.0.0.0)
- BYO API key is passed per-request, never stored on disk
- Optional: expose via ngrok/cloudflare tunnel for remote access (user's responsibility)
- Optional: add a room-level access token for multi-user scenarios

### Token economics

- GET endpoints: zero tokens (pure filesystem + SQLite reads)
- POST /api/room/chat: user's tokens via their API key (MindrianOS adds ~2K tokens of room context injection, the rest is the user's conversation)
- POST /api/room/command: zero tokens (just queues a file)
- POST /api/room/query: depends on Brain MCP call (remote, Jonathan's cost) + optional LLM synthesis (user's cost via BYO key)

## Discord as a surface (Jonathan, 2026-04-16)

"What about Discord with channels as rooms where we can also have video calls?"

### Mapping

| Discord | MindrianOS |
|---------|-----------|
| Server | MindrianOS installation (one per team) |
| Channel | Room section (problem-definition, market-analysis, etc.) |
| Thread | Methodology session (one thread per /mos:* command run) |
| Voice/Video | Meeting (transcribed via Velma, filed via /mos:file-meeting) |
| Bot | Larry (connects via localhost API or MCP Streamable HTTP) |
| Embed | Room status card, intelligence alerts, artifact previews |
| Slash command | /mos:* commands (registered as Discord slash commands) |

### Architecture

```
Discord ←→ Discord Bot (Node) ←→ localhost:3131/api/* ←→ room/ + room.db
                                        ↓
                                  BYO API key for chat
                                  Brain MCP for enrichment
```

The Discord bot is a thin client that:
1. Listens for slash commands in channels
2. Translates them to localhost API calls
3. Renders responses as Discord embeds (Mondrian-styled)
4. Transcribes voice channel audio via Velma integration
5. Files meeting intelligence automatically

### Why Discord specifically

- Lital's students are already on Discord (university tech programs live there)
- Voice/video is built in (no Zoom link needed for meetings)
- Threading maps naturally to methodology sessions
- Channels map naturally to room sections
- Bot API is well-documented and free
- Mobile app is excellent (MindrianOS on phone for free)
- Lawrence can run a Discord server for his JHU class

### Phase mapping

| Phase | What | When |
|-------|------|------|
| 86 | Localhost server + dashboard (the foundation) | v1.11.0 |
| 87 | Operational buttons + command queue + BYO API chat | v1.11.x |
| 88 | Chrome extension (reads from localhost API) | v1.12.x |
| 89 | Discord bot (reads from localhost API) | v1.12.x |
| 90 | Mobile PWA (reads from localhost API via tunnel) | v1.13.x |

Every surface after Phase 86 is a CLIENT of the same localhost API. Build the API once, every surface gets it for free.

## Cross-references

- [[solution-design/ui-ux-pathways/architecture-vision]] -- the bidirectional architecture this extends
- [[solution-design/ui-ux-pathways/phase-86-localhost-spec]] -- the foundation this builds on
- [[solution-design/ui-ux-pathways/token-economics]] -- why this scales
- [[mindrian-gtm/gtm-strategy/bsl-1.1-ip-protection]] -- the BSL covers the API surface too
- [[competitive-analysis/causal-claims-from-meetings]] -- Claim 6 ("frameworks die when student sits alone") is what Discord solves
