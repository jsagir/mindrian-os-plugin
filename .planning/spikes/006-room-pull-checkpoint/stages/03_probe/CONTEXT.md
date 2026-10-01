# Stage 03: probe, stress, demo

Last updated: 2026-10-02

## Inputs
| Source | File/Location | Scope | Why |
| :--- | :--- | :--- | :--- |
| Stages 01-02 (Layer 4) | servers + built page | all | the system under test |
| Real room (never opened) | `~/MindrianRooms/egain-des-liquid-conductor` | copied, stat-only | fixture source |

## Process
1. `launch.cjs`: mkdtemp copy, MCP server (`MINDRIAN_MCP_FIRST=cowork`), pull server; kills only its own pids (environ check).
2. `run.cjs [journal|ts|settle]`: phases P1-P11 in headless Chromium; `burst-stress.cjs`, `epoch-reload.cjs`: focused probes.
3. `demo.cjs` + `write.cjs`: the navigator's live page.

## Outputs
| Artifact | Location | Format |
| :--- | :--- | :--- |
| Headline log | `../../results.json` (journal) | JSON |
| Comparison logs | `output/results-*.json`, `output/burst-stress-*.json` | JSON |
| Screenshot | `output/page.png` | PNG |
