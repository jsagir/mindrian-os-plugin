# Stage 03: the one-click test

Last updated: 2026-10-02

## Inputs
| Source | File/Location | Scope | Why |
| :--- | :--- | :--- | :--- |
| Spike 006 stack (Layer 4) | `../006-room-pull-checkpoint/stages/03_probe/output/stack.json` | MCP + pull URLs | the room and its live copy |
| The app (Layer 4) | `APP_URL` (default 127.0.0.1:8080; prod 8090) | `/gate` | the surface under test |

## Process
1. Open the 006 room view and the gate view in headless Chromium.
2. Arms A (grant, preselected), B (gate_render, preselected), C (grant, Not now).
3. Record time to gate, click to answer, click to decision in the room view, grant state, egress.

## Outputs
| Artifact | Location | Format |
| :--- | :--- | :--- |
| Run logs | `output/results-dev.json`, `output/results-prod.json` | JSON |
| Screenshots | `output/*-before.png`, `output/*-after.png`, `output/room-view-after.png` | PNG |
