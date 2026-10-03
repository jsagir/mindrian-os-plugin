---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 15
subsystem: ui-bakeoff
tags: [bake-off, workroom, nextjs, chassis, d-05, d-06, d-13, blocknote, rxdb]

requires:
  - phase: 369-07
    provides: sessionful legacy MCP contract, host identity, the env scrub
  - phase: 369-08
    provides: ui/shared (session pool, feed relay, replica, action registry, proposal contract, generated adapter)
  - phase: 369-13
    provides: room_changes and room_artifact (landed while this plan ran, so the live arms ran for real)
provides:
  - reproducible candidate A (workroom chassis): setup.sh, build.sh, serve.sh, snapshot.json, REMOVE.txt, package-patch.json, overlay/
  - the D-05 slice production-built and walked end to end in a real browser and over HTTP
  - tests/test-369-bakeoff-workroom.cjs (9 static arms, 6 built arms)
affects: [369-18 bake-off measurement, 369-16 (same pinned exposure map), 369-28 (C2 wording)]

tech-stack:
  added: ["Next 16.2.10 / React 19.2.4 / BlockNote 0.51.4 (the workroom's own lockfile, inside ui/bakeoff/workroom/app only)"]
  patterns:
    - "snapshot, remove, overlay, install: the generated app is git-ignored and rebuilt by one script"
    - "process singletons on globalThis because every Next route is its own bundle"
    - "browser click triggers, agent-exposed action proposes, human-exposed action answers"

key-files:
  created:
    - ui/bakeoff/workroom/setup.sh
    - ui/bakeoff/workroom/build.sh
    - ui/bakeoff/workroom/serve.sh
    - ui/bakeoff/workroom/.gitignore
    - ui/bakeoff/workroom/snapshot.json
    - ui/bakeoff/workroom/REMOVE.txt
    - ui/bakeoff/workroom/package-patch.json
    - "ui/bakeoff/workroom/overlay/ (23 files: server/, app/api/*, app/slice/, components/slice/, layout, page, next.config, tsconfig, slice.css)"
    - tests/test-369-bakeoff-workroom.cjs
  modified: []

key-decisions:
  - "mos-ui-shared is installed with --install-links (a copy into app/node_modules), not a symlink: npm never touches ui/shared/node_modules or its lockfile (checked: lockfile sha unchanged) and the build is self-contained"
  - "approveDecision takes { gateId, chosen } only; the verdict is derived on the server from the option chosen (approve and reject map to themselves, anything else is defer), so a browser body never supplies a verdict"
  - "'Ask Claude' is POST /api/ask, which calls the agent-exposed proposeDecision in process with the agent principal; no HTTP route maps to proposeDecision itself, and a browser call to it is 403"
  - "bake-off session = per-process HMAC-signed random cookie issued by src/proxy.ts on first page load (HttpOnly, SameSite=Strict); plan 19 owns the real one-time code exchange"

requirements-completed: [BAKE369-01]

duration: about 2h 15m
completed: 2026-10-03
---

# Phase 369 Plan 15: Bake-off candidate A (workroom chassis) Summary

**The D-05 slice is production-built on the workroom (Next 16.2.10, React 19.2.4, BlockNote 0.51.4) with every room read and write replaced by six exposure-checked actions over the ui/shared MCP session pool; a real-browser walk (open room, read-only BlockNote document, Ask Claude, gate card with the recommended option preselected, Confirm, decision on the replica) passes with 127.0.0.1 the only host contacted.**

## What was built

- `setup.sh` copies the workroom (never writing into it) to the git-ignored `app/`, snapshots it, deletes CLAUDE.md, AGENTS.md, `.env*`, `.vercel`, `.snapshots`, demo data and docs, deletes every path in `REMOVE.txt`, lays `overlay/`, runs `npm ci --ignore-scripts` on the workroom's own lockfile, then applies `package-patch.json` (uninstall `@blocknote/xl-docx-exporter`, `@blocknote/xl-pdf-exporter`, `ai` (and with it every `@ai-sdk/*`), `gray-matter`; install `mos-ui-shared` from `file:../../../shared`).
- `overlay/src/server/slice-actions.ts`: `listRooms` both (room_list), `openRoom` human (room_bind), `readArtifact` both (room_artifact), `listEvidence` both (room_changes snapshot of nodes), `proposeDecision` agent (ProposalSource, then gate_render on the human browser session), `approveDecision` human (gate_answer on the same session). `invoke()` takes the principal only from the route and deletes any `principal` key from the body.
- Routes: `/api/actions/[name]` (POST only, human), `/api/ask` (the one in-process agent caller), `/api/feed/changes` (room_changes pages through the feed relay), `/api/feed/hint` (SSE, relay hints plus the poll net). `src/proxy.ts` issues the session cookie. `src/server/session.ts` guards every request: Host must be 127.0.0.1, an Origin must equal ours, cross-site fetches are refused, the cookie must verify.
- Slice page (`/slice/[room]`): BlockNote read-only through the workroom's own `read-only-markdown.tsx` (tightened: `editable={false}`, side menu, formatting toolbar, slash menu, link toolbar, file panel, table handles, emoji picker all off), an evidence list and a decisions list fed by the ui/shared replica (RESYNC on hints), the Ask Claude control, and the gate card rendered from `rendered.contract.superset_options` with the recommended option preselected, the server's why-line (`contract.notice`) shown, and one Confirm control.
- `layout.tsx` has no font-host loader; `slice.css` defines the UI-SPEC fallback stacks (Fraunces/Georgia, DM Sans/Arial, JetBrains Mono/monospace) and the two variables the workroom CSS expected from the removed loader.

## Measurements (informal; plan 18 measures formally)

- Workroom snapshot: 35 files, `total_lines` 2,911, `ts_tsx_lines` 2,645 (equals the RESEARCH Pattern 6 figure and the floor). The workroom is not under git (it has no commit to record); the per-file sha256 in `snapshot.json` is the identity, and the checkout was unchanged by every setup run (find -newer marker: nothing).
- Workroom code surviving, diffed against the snapshot: 8 files unchanged (347 lines), 6 modified (`next.config.ts`, `package.json`, `tsconfig.json`, `layout.tsx`, `page.tsx`, `read-only-markdown.tsx`), 21 removed (2,292 lines). TS and TSX lines surviving unchanged: 186 of 2,645 (7 percent). New overlay code: 1,188 lines TS, TSX and CSS.
- First `setup.sh`: 42 s (npm ci about 23 s, patch install about 18 s). `build.sh`: 14 to 28 s across runs (Turbopack compile about 11 s, TypeScript about 2.3 s). Standalone output 59.7 MB, `.next/static` 3.39 MB.
- Browser walk (Playwright, headless, hermetic daemon, scratch driver, not committed): the BlockNote editor reports `contenteditable=false`; evidence row appears; Ask Claude mints a gate with `approve` preselected and three options; Confirm shows "Recorded: approve."; the decision appears in the decisions list 137 to 166 ms after the click; hosts contacted: only 127.0.0.1; console and page errors: none.

## Test results

- `node tests/test-369-bakeoff-workroom.cjs`: PASS=9 FAIL=0 (static arms; arm 9 checks the generated copy when present)
- `node tests/test-369-bakeoff-workroom.cjs --built`: PASS=15 FAIL=0 NOT_PROVEN=0 (arms 10, 11a to 11e: bundle scan, page 200 plus cookie, refusals, listRooms and openRoom and readArtifact, feed snapshot then delta, ask then Confirm ratifies, decision on the feed, `latest_seq` increments)
- `node tests/test-369-walled-manifest.cjs`: 7 passed, 0 failed; `git diff --quiet -- package.json npm-shrinkwrap.json` exits 0
- `node tests/test-369-ts-erasable-gate.cjs`: 8 passed, 0 failed (was 7/1 on a tsconfig path alias, fixed, see Deviations)
- Acceptance: `bash -n` setup.sh, build.sh, serve.sh pass; `app/` has no CLAUDE.md, AGENTS.md or `src/lib/rooms.ts`; `grep -rlE "from 'node:fs'|require\('fs'\)|child_process|execFile" overlay/src` prints nothing; `git status --short ui/bakeoff/workroom` shows nothing under `app/` or `node_modules/`; `serve.sh` without `MOS_DAEMON_URL` exits 1.
- The adapter source was also run once (`MOS_PROPOSAL_SOURCE=adapter`): plan 14's `roomProposalSource` loads at run time from the repo and answers `no_proposal` on a fixture room with no Larry-filed claim. The full adapter proposal path (a Larry-filed proposed claim naming the node) was not exercised here; plan 18 does that.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Step order in setup.sh: npm ci before the manifest patch**
- **Issue:** applying the package patch before `npm ci` makes `npm ci` fail on a lockfile mismatch.
- **Fix:** copy, snapshot, remove, overlay, `npm ci` on the untouched manifest, then uninstall and install for the patch. Same end state as the plan's list.

**2. [Rule 3 - Blocking] mos-ui-shared installed with --install-links**
- **Issue:** a plain `file:` install symlinks ui/shared and lets npm resolve its dependencies into ui/shared/node_modules, outside this plan's files and walled package.
- **Fix:** `--install-links` copies it into app/node_modules and installs its pinned dependencies there. ui/shared's lockfile and tree are unchanged (checked). Source changes to ui/shared need a re-run of setup.sh.

**3. [Rule 2 - Missing critical] Extra overlay files and routes the plan did not name**
- `src/proxy.ts`, `src/server/session.ts` (Host, Origin, Sec-Fetch-Site guard plus cookie), `src/server/snapshot.ts`, `src/server/proposal-source.ts`, `src/app/api/ask/route.ts`, `src/app/slice.css`, `src/components/read-only-markdown.tsx` (overwrite), `tsconfig.json`. The ask route is how a browser click reaches an agent-only action without exposing it (D-14, D-15); the session guard is the minimum for an HTTP surface that writes through a gate. All sit inside `overlay/`, which the plan names.

**4. [Rule 1 - Bug] D-17 gate: TS path alias and `@/` imports**
- **Found by:** the orchestrator's note and `tests/test-369-ts-erasable-gate.cjs` (7/1, "TS path alias found in ui/bakeoff/workroom/app/tsconfig.json").
- **Fix:** the overlay tsconfig carries no `paths` or `baseUrl`; every overlay import is relative. The workroom's own surviving components had no `@/` imports. Gate now 8/8; the candidate test arms 3 and 9 pin it.

**5. [Rule 1 - Bug] proposeDecision turned a source's "nothing to propose" into a 502**
- **Found during:** an adapter-mode run. **Fix:** commit 7c184dea4; the refusal reasons (`no_proposal`, `room_unavailable`, `proposal_invalid`, `invalid_request`) come back as the action result.

**6. [Judgment] Built-arm bundle scan splits hard hosts from the literal C2 hosts**
- The plan's arm says the bundle contains no `rxdb.info`. It does contain it, in any build that bundles RxDB. See Findings. The arm hard-fails on `fonts.googleapis`, `fonts.gstatic`, `@blocknote/xl-` and `dev-mode-iframe`, requires every `rxdb.info` hit to be a plain doc link and every `cdn.jsdelivr` hit to sit in emoji-mart, and prints the counts as a FINDING instead of asserting zero.

### Orchestrator note: long-dash guard

The guard in `tests/run-all-369.sh` scans all of `ui/bakeoff` except node_modules, dist, build, out, .next, .vite. In my tree (`ui/bakeoff/workroom`, including the generated `app/`, the copied workroom sources and the overlay) there are no U+2014 or U+2013 characters (verified with the guard's own find and grep). The hits that remain in `ui/bakeoff` are all under `ui/bakeoff/agent-native/app/` (plan 16: AGENTS.md, DEVELOPING.md, README.md, `.agents/skills/**`, `.generated/**`, and the built `.output/**` bundle, which the guard does not prune). I did not touch them. Plan 16 will need to delete or prune that content, and `.output` is not on the guard's prune list.

## Findings (for plan 18 and plan 28)

- **UI-SPEC check C2 as written cannot pass for any chassis that bundles RxDB.** Zero literal occurrences of `rxdb.info` and `cdn.jsdelivr` is required, but in this build 16 files under `.next/static` and `.next/server` carry `https://rxdb.info/...` (RxDB error-message `link:` strings, inert text) and 2 carry `cdn.jsdelivr` (emoji-mart's default data fetch, never called with the emoji picker off). The browser walk contacted only 127.0.0.1. `unpkg.com` appears only in `.next/standalone/node_modules/next/dist/server/config.js`, a server-side copy of Next, not a built asset. Candidate B and plan 28's `tests/test-369-ui-dist-fresh.cjs` (which also asserts the literal) will see the same strings from ui/shared. Decision needed: reword C2 to egress-capable references (script, iframe, font, fetch targets) or add a build-time rewrite of the inert strings.
- The UI-SPEC CSP implementability check (`style-src 'self'` against BlockNote's inline styles) is not measured here; the bake-off serves no CSP header. It belongs to plan 18.
- `room_changes` snapshot answers `docs[]`, delta answers `changes[]`; the replica's pull handler expects `through` and change rows, so its first pull is a delta from `after: 0`. A room whose change log is absent answers `change_log_absent` and the replica retries every second; the snapshot-bootstrap and reset handling is plan 23's, not built here.
- Claim selection uses node type exactly `claim` (an `EvidenceClaim` type also matches a loose regex and was picked first until fixed).
- Phase 365's floor makes the gate's approve label and why-line room-dependent ("Approve, mark as needs evidence"; "This room asks for at least a source document, so approving files it as needs evidence"); the card shows the server's own labels from `superset_options` and its `contract.notice`.

## Known Stubs

None. The `fixed` proposal source is the deterministic measurement source by design (D-14, plan 18 measures with `adapter`).

## Threat Flags

None beyond the plan's register. T-369-15-01 to -06 mitigated: rooms.ts and file routes removed with a static no-fs arm; `ai` and `@ai-sdk/*` removed; no font host and no dev-mode, bundle scanned; CLAUDE.md, AGENTS.md and env files never copied; `HOSTNAME=127.0.0.1` pinned; `@blocknote/xl-*` removed before any build and scanned for in the bundle.

## Self-Check: PASSED

- FOUND: ui/bakeoff/workroom/setup.sh, build.sh, serve.sh, .gitignore, snapshot.json, REMOVE.txt, package-patch.json, overlay/, tests/test-369-bakeoff-workroom.cjs
- FOUND commits: 170b39df8, c9646da63, 7c184dea4
- app/ and node_modules are git-ignored and uncommitted; ui/shared and the root manifests unchanged
