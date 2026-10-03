---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 16
subsystem: ui-bakeoff
tags: [bake-off, agent-native, vite, react-router, nitro, chassis, d-05, d-06, wave-2]

requires:
  - phase: 369-08
    provides: ui/shared core (legacy MCP session pool, feed relay, replica, action registry, proposal contract)
  - phase: 369-13
    provides: room_changes and room_artifact MCP tools (served by the daemon in the working tree at run time)
provides:
  - ui/bakeoff/agent-native reproducible candidate B (setup.sh, build.sh, serve.sh, overlay, MIT notice)
  - tests/test-369-bakeoff-agent-native.cjs (static arms plus --built arms)
  - measured data points for the nine judged bake-off measures (below), for plan 18
affects: [369-18, 369-19, 369-20]

tech-stack:
  added: ["@agent-native/core 0.198.8 (scaffold, git-ignored app/)", "@blocknote/core, react, mantine 0.51.4 (exact)", "mos-ui-shared (local link)"]
  patterns:
    - "scaffold plus overlay: the generated app is git-ignored; setup.sh rebuilds it from the CLI, a removal list and overlay/"
    - "every slice action is a thin defineAction over a ui/shared defineShellAction registry entry; the pool key comes from an HttpOnly cookie, never the body"
    - "post-build scrub step (long dashes, outside-host literals) followed by a refresh of Nitro's public-asset size table"

key-files:
  created:
    - ui/bakeoff/agent-native/setup.sh
    - ui/bakeoff/agent-native/build.sh
    - ui/bakeoff/agent-native/serve.sh
    - ui/bakeoff/agent-native/.gitignore
    - ui/bakeoff/agent-native/LICENSE-agent-native.txt
    - ui/bakeoff/agent-native/overlay/ (6 actions, server/lib x4, middleware, plugin, 2 feed routes, root.tsx, 2 routes, reader, css)
    - tests/test-369-bakeoff-agent-native.cjs
  modified: []

key-decisions:
  - "agent-native mounts its action HTTP routes only inside its agent-chat plugin; with chat removed (D-14) a small overlay Nitro plugin mounts the same routes from the same static registry, and serve.sh refuses the framework's agent-chat, integrations, terminal, onboarding, observational-memory and context-xray default plugins"
  - "human-only actions (openRoom, approveDecision) are uiOnly in agent-native; that guard needs the UI-capability route and a session owner, neither of which boots without a hosted database, so the overlay plugin mounts the capability route and supplies the owner"
  - "the bake-off browser session is a per-process random HttpOnly SameSite=Strict cookie (plan 19 owns the one-time bootstrap code and idle expiry)"
  - "outside-host literals in the vendor bundles are neutralized after the build (analytics, rxdb.info, Google Fonts), so the output names none and a later config change cannot send anything off the machine"

requirements-completed: [BAKE369-02]

duration: about 3h (two production build iterations around a size-table bug, scaffold plugin discovery)
completed: 2026-10-03
---

# Phase 369 Plan 16: Bake-off candidate B (agent-native) Summary

**The identical D-05 slice runs on the agent-native scaffold, production-built and served on 127.0.0.1 only: a real Chromium click opened a room, listed evidence from the live replica, minted a gate on the human session with the recommendation preselected, and Confirm recorded the decision in 116 ms, with every room read and write going through the shared legacy MCP pool.**

## Accomplishments

- **Reproducible candidate.** `setup.sh` rebuilds `app/` from nothing in 19 s: pinned `@agent-native/core@0.198.8` scaffold, spike 007 hygiene (telemetry env on every command; CLAUDE.md, `.claude`, `.mcp.json` deleted, plus AGENTS.md and `.agents` as the orchestrator ruled), a commented removal list (13 routes, chat and layout component folders, three chat state files, the agent-chat server plugin, five default actions including the outbound `provider-api-request`), the overlay, no TS path alias, exact BlockNote 0.51.4, `mos-ui-shared` linked. The v1 MCP SDK is not added. The MIT notice is carried by hand and copied next to the output.
- **Six actions, same names and exposures as candidate A.** `server/lib/slice-actions.ts` declares `listRooms` both, `openRoom` human, `readArtifact` both, `listEvidence` both, `proposeDecision` agent, `approveDecision` human with `defineShellAction`, registered in the shared registry. Each `actions/<name>.ts` is a `defineAction` wrapper with `agentTool: false`, `mcpTool: false` and an `authorize` that requires the browser session cookie; the two human actions are also `uiOnly`. No `mcp.config.json`: agent-native's own MCP client never touches the daemon.
- **The slice UI.** Full-bleed `/slice/<room>` (no chat shell): read-only BlockNote (`editable={false}`, no menus or panels, client-only), an "Ask Claude" control, the gate from the rendered contract's `superset_options` with the proposal's recommendation preselected and one Confirm, and an evidence list fed by the ui/shared replica (pull only, RESYNC on SSE hints) through two relay routes. System font stacks, no outside host.
- **Production build and loopback serve.** `build.sh` 53 s (fresh run; earlier iterations 51 to 72 s), `.output` 31,429,195 bytes in 192 files. `serve.sh` binds 127.0.0.1 (default port 8092), requires `MOS_DAEMON_URL`, never runs dev.

## Task Commits

1. Task 1, setup, overlay, licence, gitignore: `dbeeeaf62`
2. Task 2, build and serve scripts and the hygiene test: `fa127aabf`

## Test Results

- `node tests/test-369-bakeoff-agent-native.cjs`: 11 passed, 0 failed (static arms, including the six-action name-to-exposure map).
- `node tests/test-369-bakeoff-agent-native.cjs --built`: 13 passed, 0 failed, after a from-nothing `setup.sh` then `build.sh`. Prints `startup errors: 24 error events, 48 error-looking lines (server stdout and stderr, first 5 s)`.
- `node tests/test-369-walled-manifest.cjs`: 7 passed, 0 failed; `git diff --quiet -- package.json npm-shrinkwrap.json`: clean.
- `node tests/test-369-ts-erasable-gate.cjs`: 8 passed, 0 failed (after dropping the scaffold's `paths` alias).
- Long-dash scan with the exact `tests/run-all-369.sh` find rules over `ui/bakeoff`: no hit (committed files and the generated app, including `.output`).
- Not committed, run by me: a headless Chromium (Playwright) run against the production build and the hermetic daemon. Hosts contacted: `127.0.0.1:8192` only. Ask control enabled 0.7 s after navigation (SSR 328 ms), gate shown with `approve_enough` preselected, Confirm to "Decision recorded in the room." in 116 ms. The evidence list showed the seeded claim via the replica (the feed was live: plan 13's `room_changes` and `room_artifact` were served, 47 tools). The document pane was not exercised against a real artifact (the fixture room holds no `.md`).

## Measures (data for plan 18)

| Measure | Candidate B observation |
|---|---|
| dependency removal | removed code, not packages: app `package.json` keeps 34 dependencies and 52 dev dependencies; `ai`, the `@ai-sdk/*` providers, `node-pty` and the rest stay in the bundle. Nothing from the plan's removal list (xl-*, v1 SDK) was ever added. |
| startup errors | server: 24 error events in the first 5 s (hosted-database refusal: Better Auth init failure then "Auth guard registered despite init failure, app is locked", identity rekey, migrations skipped). Browser: 500 on `/_agent-native/actions/get-localization-preference` and `/_agent-native/application-state/localization`, 404 on `/_agent-native/webmcp/manifest`, agent-native's own "Configuration error (2 issues)" toast, and an intermittent React error 418 (hydration mismatch). None blocks the slice. |
| packaging | build 53 s, 31.4 MB, 192 files, runs from `.output` with `pnpm start`; the app's `node_modules` is about 1.0 GB, so the install weight stays on the build machine only. |
| direct-file-write replacement | zero fs, child_process or execFile in the overlay (static arm). |
| new persistent-state assumptions | one HttpOnly cookie (`mos_sid`), agent-native's UI-capability cookie, the RxDB/Dexie database, theme and locale in localStorage; no server database (production refuses PGlite). |
| code surviving | n/a for this candidate; the overlay is 945 lines against the scaffold. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Link path one level off**
- **Issue:** the plan says link `mos-ui-shared` from `../../shared`; from `ui/bakeoff/agent-native/app/` that is `ui/bakeoff/shared`.
- **Fix:** `pnpm add mos-ui-shared@link:../../../shared` (matches plan 15's `file:../../../shared`).

**2. [Rule 3 - Blocking] Action routes vanished with the chat plugin**
- **Found during:** first production serve (every action answered 404; log: "No actions found").
- **Issue:** agent-native mounts action HTTP routes only inside `createAgentChatPlugin`, which the removal list deletes (D-14) and which needs a hosted database.
- **Fix:** overlay `server/plugins/mos-actions.ts` mounts the same routes from the same static registry, plus the UI-capability route and a session owner (without an owner, `uiOnly` answers 403 forever); `serve.sh` sets `AGENT_NATIVE_DISABLED_PLUGINS` for the chat family. This adds one overlay file beyond the plan's list; it lives inside `overlay/`.

**3. [Rule 1 - Bug] Post-build edits truncated served files**
- **Found during:** headless browser run ("Unexpected end of input", blank page).
- **Issue:** Nitro records each public asset's byte size and sends it as Content-Length; scrubbing long dashes changed the sizes.
- **Fix:** `build.sh` refreshes the size table in `.output/server/index.mjs` after every scrub. Also note: killing the `serve.sh` wrapper leaves the Nitro server running (pnpm detaches it), so the test kills the process group and the listener by port.

**4. [Rule 2 - Part 8] Outside-host literals in the vendor bundles**
- **Found during:** the built-output scan the plan specifies.
- **Issue:** `analytics.agent-native.com/track` is the client analytics default (used only when a public key is configured, none is), `rxdb.info` appears in RxDB's console notice and error links, and the server core names Google Fonts hosts. The plan's scan would fail on all of them.
- **Fix:** `build.sh` rewrites them to loopback or `.invalid` in the output. Contacted hosts in the browser run confirm nothing left the machine either way. **Plans 15, 18 and 20 will hit the same `rxdb.info` strings** (they come from ui/shared's RxDB, not from the chassis).

**5. [Rule 3 - Orchestrator] No TS path alias, no long dash**
- The scaffold's `tsconfig.json` declares `paths` (`@/*`, `@shared/*`, `*`) and its files import through them; `tests/test-369-ts-erasable-gate.cjs` failed on it. `setup.sh` now drops `paths` and rewrites the kept files' imports to relative paths. The scaffold's markdown and the built output carry long dashes; `setup.sh` and `build.sh` rewrite them (hyphen in prose, `\u` escape in code and JSON), so the guard over `ui/bakeoff` finds none. The built `.output`, `.generated` and `app/` are git-ignored and never committed.

**6. [Rule 2 - Scope] AGENTS.md and `.agents/` deleted too**
- Per the orchestrator, treated like CLAUDE.md. The build is unaffected.

**7. [Rule 1 - Bug] `.gitignore` pattern**
- The plan's `app/` also matched `overlay/app/` and hid the UI files from git. Anchored as `/app/`; the static arm checks it.

### Notes (not deviations)

- `setup.sh` embeds a short `node -` script (alias rewrite) as a heredoc inside the script itself.
- The scaffold's `pnpm-workspace.yaml` allows install scripts for `node-pty`, `esbuild`, `tesseract.js` and `ffmpeg-static`; I did not inspect what those fetch at install time. Worth a look before the winner ships.
- Production HTML carries `cache-control: public ... s-maxage` together with `Set-Cookie`; harmless on loopback, wrong behind any shared cache.
- `AUTH_DISABLED=true` stays in `serve.sh`: without a hosted database the framework's own auth cannot start ("app is locked"), so the slice's real door is the browser cookie, as the plan describes.

## Known Stubs

None. The per-process cookie is the stated bake-off stand-in for plan 19's bootstrap. The `adapter` proposal source loads plan 14's `mos-ui-shared/claude-adapter` lazily and fails with a clear error if absent; `fixed` is the default.

## Threat Flags

None beyond the register. T-369-16-01 through -06 mitigated: telemetry env plus built scan and neutralization, hygiene files deleted (static arm), production-only loopback serve (static and live `ss` arm), no MCP client config, `agentTool`/`mcpTool` false on all six with `/mcp` and the WebMCP manifest refusing (live arm), notice carried by hand.

## Self-Check: PASSED

- FOUND: all files listed under key-files.created (22 files in `dbeeeaf62`, 3 in `fa127aabf`)
- FOUND commits: dbeeeaf62, fa127aabf
