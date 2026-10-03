---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 19
subsystem: ui-shell
tags: [ui-shell, server, auth, csp, bootstrap, d-07, d-08, next, rule-8]
requires: [369-07, 369-08, 369-18]
provides:
  - ui/shell walled package (mos-ui-shell) on the Next chassis, lockfile committed
  - server security layer: config, one-time bootstrap, sessions, CSRF, Host/Origin guard, nonce CSP, control channel
  - client frame (App, empty route registry, api client, UI-SPEC copy)
affects: [369-20, 369-21, 369-22, 369-23, 369-32, 369-28]
key-files:
  created:
    - ui/shell/package.json
    - ui/shell/package-lock.json
    - ui/shell/server/config.ts
    - ui/shell/server/bootstrap.ts
    - ui/shell/server/auth.ts
    - ui/shell/server/origin-guard.ts
    - ui/shell/server/csp.ts
    - ui/shell/server/control.ts
    - ui/shell/client/App.tsx
    - ui/shell/client/routes.ts
    - ui/shell/client/api.ts
    - ui/shell/client/copy.ts
    - ui/shell/app/page.tsx
    - ui/shell/app/layout.tsx
    - ui/shell/app/auth/bootstrap/route.ts
    - ui/shell/app/control/bootstrap/route.ts
    - ui/shell/proxy.ts
    - ui/shell/instrumentation.ts
    - ui/shell/next.config.ts
    - ui/shell/scripts/postbuild.mjs
    - tests/test-369-shell-server.cjs
  modified: []
decisions:
  - "Nonce CSP variant (per the bake-off ruling): script-src and style-src carry a per-response nonce; base-uri, form-action, frame-ancestors added (tightening only); no unsafe-inline"
  - "Session state in globalThis slots (Symbol.for) because the chassis bundles proxy, routes and pages separately in one Node process"
  - "Cookie has no Secure attribute (plain loopback HTTP), stated in auth.ts"
  - "Control endpoint refuses any request carrying Origin or Sec-Fetch-Site (a browser is never the launcher)"
  - "RULE 8 (ruled 2026-10-03, Next as a per-machine dependency): next 16.2.10, react 19.2.4, react-dom 19.2.4 are exact-pinned root dependencies; postbuild strips the standalone node_modules; the shell runs against the plugin root's node_modules"
metrics:
  tasks: 2
  commits: 6
  completed: 2026-10-03
---

# Phase 369 Plan 19: Shell server package and security layer Summary

A walled `ui/shell` package on the Next chassis with the full D-08 security layer working end to end (verified live, including in a real browser), and and the RULE 8 condition this plan was written to check, which first failed (the Next standalone output carried a traced `node_modules` tree), now resolved by the navigator's 2026-10-03 ruling "Next as a per-machine dependency": next, react and react-dom are root dependencies and the standalone output ships no `node_modules`.

## What was built

- **Package** `ui/shell` (`mos-ui-shell`, private, ESM, Next 16.2.10, React 19.2.4, BlockNote 0.51.4, rxdb/rxjs/dexie/zod pinned, `mos-ui-shared` as `file:../shared`, lockfile committed, build and start scripts with telemetry off). Folders `server/` (framework-free erasable TS), `client/`, `app/` (thin glue).
- **server/** `config.ts` (one env source; daemon host must be http://127.0.0.1; default port 3369), `bootstrap.ts` (sha256, 60 s, single use, burned on a matching attempt, per-process store), `auth.ts` (in-memory sessions `{createdAt,lastSeen,csrf,mcpKey}`, 30 min idle, cookie `HttpOnly; SameSite=Strict; Path=/`, `requireCsrf`, the exchange handler with the cross-site refusal before the code is touched, 303 to `/`), `origin-guard.ts`, `csp.ts`, `control.ts` (0600 token file in a 0700 dir, `POST /control/bootstrap`, and `startShellServer`, which exits 1 on a bad config).
- **client/** `App.tsx` (registry, "No room open", "Server unreachable"), `routes.ts` (empty registry), `api.ts` (`callAction`, `feed` helpers, CSRF from a meta tag, no storage), `copy.ts` (UI-SPEC strings, `LAUNCH_COMMAND` placeholder).
- **Glue** `app/page.tsx`, `app/auth/bootstrap/route.ts`, `app/control/bootstrap/route.ts`, plus `proxy.ts` (Host/Origin/cross-site guard on every request and the per-response CSP nonce) and `instrumentation.ts` (start-up hook).
- **Test** `tests/test-369-shell-server.cjs`: 34 scenarios (unit, static, build-output RULE 8 scan, live arm over real HTTP against the built server).

## Verification

| Check | Result |
|-------|--------|
| `cd ui/shell && npm run build` | exit 0 (Turbopack, typecheck clean) |
| `node tests/test-369-shell-server.cjs` | 35 passed, 0 failed (exit 0), after the ruling: RULE 8 scenarios flipped to the ruled shape (first run: 32 passed, 2 failed on the traced tree) |
| `node tests/test-369-walled-manifest.cjs` | 8 passed, 0 failed (7 before; one new scenario pins the three root versions to ui/shell) |
| `node tests/test-341-shrinkwrap-no-dev.cjs`, `node tests/test-236-engines-floor.cjs` | PASS=4 FAIL=0; 5 passed, 0 failed |
| `node tests/test-369-ts-erasable-gate.cjs` | 8 passed, 0 failed |
| root manifest | changed only by the ruling: three exact-pinned dependencies and the regenerated shrinkwrap (see below) |
| live arm | 127.0.0.1-only listener (also refused on the external interface IP), 303 + cookie + code-free Location, reuse shows Not signed in, cross-site/same-site/foreign Origin/foreign Host all 403 and the code still signs in afterwards, control channel needs the token, nonce CSP on every HTML response, inline scripts all carry the nonce, non-loopback daemon makes the server exit 1 |
| real Chromium (one-off, not committed) | link signs in, lands on `/` hydrated, 0 CSP violations, cookie HttpOnly + SameSite=Strict, localStorage and sessionStorage empty |

## RULE 8: first failed, then ruled (2026-10-03)

First measurement (plan 19 build, before the ruling): `.next/standalone` was 1,139 files and 34.3 MB, 1,014 of them a `node_modules` tree of 13 top-level packages, none in the root manifest; the import scan found 18 bare `next` and `next/dist/...` specifiers. `images.unoptimized: true` did not remove sharp from the trace. A time-boxed esbuild experiment (scratchpad, deleted) bundled `server.js` plus next into one file that started without the tree but returned 500 on the first request, because Turbopack's generated chunks `require('next/dist/...')` at run time. That went to the navigator, who ruled, verbatim: "Next as a per-machine dependency". Rejected: express over a static export; an esbuild bundling post-step.

Applied (recorded in full, with the install-size table, in 369-BAKEOFF-DECISION.md "Ruling 2026-10-03 (RULE 8, plan 19)"):

- Root `package.json`: `next` 16.2.10, `react` 19.2.4, `react-dom` 19.2.4, exact pins, `dependencies`; `npm-shrinkwrap.json` regenerated (zero dev entries). The behaviour-minimal set: with only these three plus their 12 transitive packages, the stripped output started clean (no warning) without sharp and without the SWC binary, answered 200 on `/`, and the sign-in exchange worked.
- `ui/shell/scripts/postbuild.mjs` strips every `node_modules` directory from the standalone output (125 files, 2.1 MB remain).
- `tests/test-369-walled-manifest.cjs`: only `next`, `react`, `react-dom` left the denylist (13 entries stay); the mutation arm pins typescript, @blocknote/core and rxdb as denied and next as allowed; a new arm fails on version drift against `ui/shell/package.json`.
- `tests/test-369-shell-server.cjs`: (a) no `node_modules` and no file outside server.js, package.json, `.next/`, `public/`; (b) every live check runs against a copy under a plugin-like tree that reaches only the root `node_modules` (the repo's when it carries next, otherwise an `npm ci` of the repo's manifest and shrinkwrap cached under the OS temp dir by hash, about 500 MB, built once).
- Install-size delta, `npm ci --ignore-scripts` (no `--omit`) in temp copies on this machine (linux aarch64): 51M to 511M, +460M, 120 to 144 packages. The platform SWC binaries are 120M each and npm installed both the gnu and the musl one, and `@img` is 34M. The runtime does not need sharp or SWC, so a loader `--omit=optional` for these is a follow-on for plan 28 (the loader is not touched here). Plan 28 carries the CHANGELOG line and the RULE 5 / RULE 8 wording.

## Deviations from Plan

**1. [Rule 3 - Blocking] Files outside `files_modified`, all inside the new walled package.** Next requires them: `app/layout.tsx` (root layout; no style attribute, no font host), `next.config.ts` (standalone output, `transpilePackages`), `proxy.ts` (the only place a per-request Host/Origin guard and the CSP nonce can live on this chassis), `instrumentation.ts` (the only start-up hook, needed to write the control token and refuse a bad daemon host), `scripts/postbuild.mjs` (copies `.next/static` into standalone, as the bake-off build.sh did), `package-lock.json` (the plan says commit the lockfile). No plan 20-32 file list owns any of these; plan 32 and later plans should treat them as plan 19 artifacts. `startShellServer` was folded into `control.ts` to keep the plan's six server modules.

**2. [Rule 2 - Missing critical] "Refuse to start" made real.** First build kept listening after a bad `MOS_DAEMON_URL` (Next logs the instrumentation error and carries on). `startShellServer` now logs and `process.exit(1)`; the live arm proves it.

**4. Ruling applied (navigator, 2026-10-03).** Files outside `files_modified`: `package.json`, `npm-shrinkwrap.json`, `tests/test-369-walled-manifest.cjs` (denylist narrowed for exactly three names, version-pin scenario added, count 7 to 8), `ui/shell/scripts/postbuild.mjs`, `ui/shell/README.md` and `369-BAKEOFF-DECISION.md`. `package-lock.json` at the repo root is stale (beta.30) and was left alone. The shrinkwrap was regenerated with `npm install --package-lock-only` in a temp copy and copied back, not with a bare `npm install` in the shared tree: a dry run of that in the shared root listed 121 removals and 175 additions, which would have rewritten a peer-shared `node_modules`. The root `node_modules` was therefore not changed; the shell test builds its own root-equivalent tree.

**3. Task commit split.** Commit 1 holds the scaffold (package, config, client frame, layout, next.config, postbuild); commit 2 holds the security modules, the page and route glue (they import the security modules), `proxy.ts`, `instrumentation.ts` and the test. The plan lists the three route files under Task 1; they moved to commit 2 so each commit is self-consistent.

## Known limits (not blockers)

- The framework's built-in 404 page renders inline `style` attributes, which the nonce CSP does not cover. Only a 404 is affected. A custom `app/not-found.tsx` (plan 20 or later) removes it.
- A style attribute from BlockNote (1 measured in 369-18) still needs plan 21 or a hash with `'unsafe-hashes'`; nothing in this plan renders BlockNote.
- `/api/status` and the other `/api/*` endpoints do not exist until plan 369-32; the client helpers are written against those names, so the browser console shows one 404 for `/api/status` today and the "Server unreachable" copy appears only when the fetch itself fails.
- The build-output scan is regex-based, skips `.next/static` and comment lines (Turbopack's runtime documents a `require("something")` in a comment).
- `tsconfig.json` was extended by Next on first build (`.next/dev/types`); harmless.

## Known Stubs

None. `LAUNCH_COMMAND` is `{launch command}` on purpose (plan 369-22 fills it), and `routes` starts empty on purpose (plan 369-32 appends).

## Threat Flags

None beyond the plan's register. T-369-19-01 to -07 mitigated and tested (T-369-19-07 by the ruled shape: no `node_modules` in the output, every bare import a root dependency).

## Commits

- `042d88d78` feat(369-19): walled ui/shell package on the Next chassis, config source and client frame
- `fa88e35b5` feat(369-19): shell security layer: loopback guard, nonce CSP, one-time bootstrap sign-in, CSRF, control channel
- `aa97e7cba` docs(369-19): first summary
- `28d9196fe` feat(369-19): next, react, react-dom as root dependencies (RULE 8 ruling 2026-10-03); standalone ships no node_modules
- `1d2c50e40` feat(369-19): postbuild strips the standalone node_modules; RULE 8 scenarios flipped to the ruled shape
- the BAKEOFF-DECISION ruling section and this SUMMARY update (see git log)

## Self-Check: PASSED

All created files exist and the commits are on `main`; all three tests are green.

## Docs that now contradict the ruling (read-only check, NOT edited; for the orchestrator to route a quick)

- `CLAUDE.md:138`: "TypeScript, UI and build packages never enter the root package.json, not even as devDependencies (...); they live in walled-off packages with their own lockfiles (`tools/ts-check/`, `ui/*`), the Phase 232 `lib/wiki/editor-src` precedent." (`next`, `react`, `react-dom` are now root dependencies.)
- `.planning/codebase/CONVENTIONS.md:9`: the same sentence, verbatim.
- `.claude/includes/decisions.md:21` (row 17): "...the UI is a walled package built for the release (Phase 369 D-17, 2026-10-02) ... what CJS-only protected (...) is kept by erasable-only stripping, walled packages and release-built assets." (Partly stale: the UI package is still walled, but its framework runtime is not.)
- `CLAUDE.md:137` and `.planning/codebase/CONVENTIONS.md:8`: "UI packages under `ui/` are ESM TypeScript and TSX, built for the release, and only their built assets ship." Still true; worth a clause that the built output has no `node_modules` and resolves next and react from the root.
- `.planning/spikes/CONVENTIONS.md:10`: "...that never touches the root manifest" refers to spikes, not the shell; no contradiction.
- `tools/ts-check/README.md:22` ("Anything in the root `package.json`, even a devDependency, is installed on every user's machine") still holds and is the reason for the exact-pin and size note, not a contradiction.
