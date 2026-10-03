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
  - "RULE 8 arms are a hard FAIL by measurement, not softened: the Next standalone output cannot ship as built"
metrics:
  tasks: 2
  commits: 2
  completed: 2026-10-03
---

# Phase 369 Plan 19: Shell server package and security layer Summary

A walled `ui/shell` package on the Next chassis with the full D-08 security layer working end to end (verified live, including in a real browser), and one blocker that needs the navigator: the Next standalone output fails the RULE 8 condition, which this plan was written to check, and the decision record says that case goes back to the navigator.

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
| `node tests/test-369-shell-server.cjs` | 32 passed, 2 failed (exit 1): the two RULE 8 build-output scenarios, by design of the measurement |
| `node tests/test-369-walled-manifest.cjs` | 7 passed, 0 failed |
| `node tests/test-369-ts-erasable-gate.cjs` | 8 passed, 0 failed |
| `git diff --quiet -- package.json npm-shrinkwrap.json` | exit 0 (root manifest untouched) |
| live arm | 127.0.0.1-only listener (also refused on the external interface IP), 303 + cookie + code-free Location, reuse shows Not signed in, cross-site/same-site/foreign Origin/foreign Host all 403 and the code still signs in afterwards, control channel needs the token, nonce CSP on every HTML response, inline scripts all carry the nonce, non-loopback daemon makes the server exit 1 |
| real Chromium (one-off, not committed) | link signs in, lands on `/` hydrated, 0 CSP violations, cookie HttpOnly + SameSite=Strict, localStorage and sessionStorage empty |

## BLOCKER: RULE 8 (needs the navigator)

369-BAKEOFF-DECISION.md left the Next standalone form qualified only if the traced `node_modules` tree can be eliminated, and said the fallback (express server over a static export) goes back to the navigator before it is taken. Measured here, on this plan's build:

- `.next/standalone` is 1,139 files, 34.3 MB, of which 1,014 files are a `node_modules` tree with 13 top-level packages, none in the root manifest: `next`, `react`, `react-dom`, `styled-jsx`, `semver`, `client-only`, `detect-libc`, `sharp`, `@img/colour`, `@img/sharp-libvips-linux-arm64`, `@img/sharp-linux-arm64`, `@next/env`, `@swc/helpers`.
- The build-output scan finds 18 distinct bare specifiers outside the root dependencies and Node built-ins, all `next` and `next/dist/...`, in `server.js` and in the generated `.next/server/chunks`.
- `images: { unoptimized: true }` does not remove sharp from the trace (tried, reverted, no effect on the 1,139 files).
- Time-boxed elimination experiment (scratchpad only, deleted): esbuild bundled `server.js` plus all of `next` into one 10.8 MB CJS file, which started ("Ready in 0ms") with `node_modules` moved away. The first request then returned 500: Turbopack's generated chunks `require('next/dist/...')` at run time (`next/dist/build/adapter/setup-node-env.external.js` and 17 more). Removing the tree would need a Next-internals-aware bundler step plus rewriting or resolve-hooking every generated chunk, and esbuild as a new build dependency. I judged that out of scope and not something to take without a ruling.

So the two build-output scenarios in `tests/test-369-shell-server.cjs` fail and print this inventory. I did not soften them (the plan says a violation FAILs with its name and file, and an exit 77 would hide it). The test stays red until the navigator rules between: (a) a custom bundling post-step (esbuild plus chunk rewriting, unproven), or (b) the decision record's alternative, a plugin-side Node server on express (a root dependency) over a static client export of the Next UI, re-hosting the guard, actions and feed relay from `ui/shared` (unbuilt, unmeasured). The security layer is chassis-neutral by design (framework-free `server/` modules, thin `app/` glue), so option (b) re-hosts these same modules unchanged.

## Deviations from Plan

**1. [Rule 3 - Blocking] Files outside `files_modified`, all inside the new walled package.** Next requires them: `app/layout.tsx` (root layout; no style attribute, no font host), `next.config.ts` (standalone output, `transpilePackages`), `proxy.ts` (the only place a per-request Host/Origin guard and the CSP nonce can live on this chassis), `instrumentation.ts` (the only start-up hook, needed to write the control token and refuse a bad daemon host), `scripts/postbuild.mjs` (copies `.next/static` into standalone, as the bake-off build.sh did), `package-lock.json` (the plan says commit the lockfile). No plan 20-32 file list owns any of these; plan 32 and later plans should treat them as plan 19 artifacts. `startShellServer` was folded into `control.ts` to keep the plan's six server modules.

**2. [Rule 2 - Missing critical] "Refuse to start" made real.** First build kept listening after a bad `MOS_DAEMON_URL` (Next logs the instrumentation error and carries on). `startShellServer` now logs and `process.exit(1)`; the live arm proves it.

**3. Task commit split.** Commit 1 holds the scaffold (package, config, client frame, layout, next.config, postbuild); commit 2 holds the security modules, the page and route glue (they import the security modules), `proxy.ts`, `instrumentation.ts` and the test. The plan lists the three route files under Task 1; they moved to commit 2 so each commit is self-consistent.

## Known limits (not blockers)

- The framework's built-in 404 page renders inline `style` attributes, which the nonce CSP does not cover. Only a 404 is affected. A custom `app/not-found.tsx` (plan 20 or later) removes it.
- A style attribute from BlockNote (1 measured in 369-18) still needs plan 21 or a hash with `'unsafe-hashes'`; nothing in this plan renders BlockNote.
- `/api/status` and the other `/api/*` endpoints do not exist until plan 369-32; the client helpers are written against those names, so the browser console shows one 404 for `/api/status` today and the "Server unreachable" copy appears only when the fetch itself fails.
- The build-output scan is regex-based and skips `node_modules` and `.next/static`; with the tree present it also reports the tree itself.
- `tsconfig.json` was extended by Next on first build (`.next/dev/types`); harmless.

## Known Stubs

None. `LAUNCH_COMMAND` is `{launch command}` on purpose (plan 369-22 fills it), and `routes` starts empty on purpose (plan 369-32 appends).

## Threat Flags

None beyond the plan's register. T-369-19-01 to -06 mitigated and tested; T-369-19-07 is the open RULE 8 blocker above.

## Commits

- `042d88d78` feat(369-19): walled ui/shell package on the Next chassis, config source and client frame
- `fa88e35b5` feat(369-19): shell security layer: loopback guard, nonce CSP, one-time bootstrap sign-in, CSRF, control channel

## Self-Check: PASSED

All created files exist and both commits are on `main`. The only red item is the intentional RULE 8 measurement documented above.
