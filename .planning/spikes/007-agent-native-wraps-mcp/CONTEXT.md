# Spike 007 workspace: agent-native shell over the MindrianOS MCP tools

Last updated: 2026-10-02

ICM Layer 0/1 (a CONTEXT.md, deliberately not a CLAUDE.md). One job: prove an agent-native app
can carry a MindrianOS decision gate to one click, with every room read and write going through
the MCP server, and the spike 006 read copy showing the result live.

| Task | Go to | Read |
|------|-------|------|
| Rebuild or serve the app | stages/01_scaffold/ | CONTEXT.md |
| Change the three actions, the bridge, the gate view | stages/02_actions/ | CONTEXT.md |
| Run the click test | stages/03_click-test/ | CONTEXT.md |

Layer 3: `../006-room-pull-checkpoint/_config/canon-v3-tokens.css` and
`~/dev/mindrian-website/docs/DESIGN-CANON.md` (the gate view inlines the same tokens).
Layer 4: `mos-ui/` (generated, git-ignored), each stage's `output/`, and `results.json`.

Invariants: no room data in agent-native's database; one MCP session per UI session key
(gates are session-owned); telemetry off; the scaffold's CLAUDE.md is removed.
