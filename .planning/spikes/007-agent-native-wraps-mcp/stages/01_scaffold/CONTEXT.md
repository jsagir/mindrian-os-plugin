# Stage 01: scaffold and serve

Last updated: 2026-10-02

## Inputs
| Source | File/Location | Scope | Why |
| :--- | :--- | :--- | :--- |
| agent-native (Layer 3, pinned) | `@agent-native/core@0.198.8`, template `chat`, `--standalone` | whole app shell | the shell under test |
| Overlay (Layer 4) | `../02_actions/overlay/`, `../02_actions/env.spike` | actions, bridge, gate route, root layout | the spike's own code |

## Process
1. `setup.sh`: create the app (telemetry off), delete its CLAUDE.md, .claude/ and .mcp.json, copy the overlay, install.
2. `serve.sh`: production build on 127.0.0.1:8090 (default) or `--dev` on :8080.

## Outputs
| Artifact | Location | Format |
| :--- | :--- | :--- |
| The app | `../../mos-ui/` (git-ignored) | agent-native app |
