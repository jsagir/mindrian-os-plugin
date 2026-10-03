# 369 Bake-off decision (BAKE369-04, D-07)

Source of the measured evidence: `ui/bakeoff/results.json` and `ui/bakeoff/COMPARISON.md`
(plan 369-18, commit 94cd635d1), measured on one machine, one run per measure.

## The navigator's ruling

Date: 2026-10-03. The Decision Gate (AskUserQuestion card with the measured comparison) was put to the
navigator by the orchestrator, which relayed the reply to the executor. Reply, verbatim:

> workroom (Recommended)

Transplants relayed with the reply: the default two, no additions and no removals. D-07 applied: the comparison
split (workroom better on measures 1, 2, 3, 4, 6, 7 and the CSP violation count; agent-native better on
reconnect and the output-size half of packaging; equal on direct file writes and gate latency), so the workroom
default held and agent-native's winning parts are transplanted.

## The record

Winner: workroom

Transplants: (1) agent-native's pool-`bind`-based `openRoom`, so the shell restores the room after a daemon restart: in the bake-off the workroom's `openRoom` bound through the generated adapter call, the pool never recorded the bound room, and after a daemon kill and restart the feed answered `room_unbound` with 6 of 6 new claims missing after 30 s (a reload recovered them), while agent-native showed all 6 at 315 ms; the transplant is the shared pool's `bind(sessionKey, roomSlug)` in the shell's open-room action. (2) agent-native's Nitro output footprint (192 files, 31.4 MB, one traced package) as an input to open question 2 and to RULE 8, not as a chassis part; see the Shell server line.

Build tool: Next (the workroom's Next 16.2.10 with React 19.2.4 and BlockNote 0.51.4, production-built at release; assets are never built on the user's machine)

Shell server: a Next standalone server (`.next/standalone/server.js`, started with plain `node`) living under `ui/shell/`, started by the launcher, with a RULE 8 condition that is NOT yet met. Measured for the workroom: build 16.9 s; output 59.7 MB in 1,262 files, of which 1,028 are a traced `node_modules` tree; 16 packages in that tree, 15 of them not in the root manifest dependencies (next, react, @swc/helpers, the sharp binaries and others); a copy of the output started from a temp dir with plain `node` and no build step served the slice (ready in 432 ms, first paint median 68 ms); projected release payload 3,258 entries and 92.7 MB against the 20,000-entry and 256 MiB ceiling (inside it). RULE 8 forbids a vendored `node_modules` tree in the tarball, and the walled-manifest rule allows no runtime package outside the root manifest's existing dependencies (express, @modelcontextprotocol/client, zod and the others it lists), so the Next standalone form qualifies ONLY if that traced tree is eliminated and everything it needs is inlined into the built bundle. The bake-off did not show that is possible (NOT MEASURED), so plan 28's payload and freshness tests must prove it before the form ships. If it cannot be eliminated, the alternative is a plugin-side Node server on express (already a root dependency) over a static client export of the Next UI, with the session guard, the action routes and the feed relay re-hosted on that server from `ui/shared`; that form was neither built nor measured here, changes where the guard code lives, and goes back to the navigator before it is taken. Agent-native's Nitro output (192 files, one traced package, `node-pty`, which is also outside the root manifest) is not adopted: it belongs to the other chassis and still carries a traced tree.

Route directory: `ui/shell/app/`. Both chassis keep routes under `app/`; the winner's convention is the Next App Router: a page is `app/<route>/page.tsx`, a server route is `app/api/<name>/route.ts`, the session cookie issue and guards live in `proxy.ts`, and the bake-off candidate placed these under `src/app/` (the shell may keep `src/` or drop it, one choice for all plans, recorded here as `ui/shell/app/`).

Server entry: the built `server.js` of the Next standalone output, started with plain `node` on 127.0.0.1 only; the launcher records its path later in `lib/ui-shell/dist/manifest.json` (plan 28).

CSP: a nonce or hash policy is needed and has NOT been exercised. The UI-SPEC contract policy (`default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self'; frame-src 'none'; object-src 'none'`) applied verbatim stopped the workroom document from rendering at all (inline hydration scripts blocked by `default-src 'self'`: 4 script-src-elem violations plus 1 style-src-attr). With scripts allowed in a labelled measurement-only run, the read-only document text renders and `style-src 'self'` still records 12 violations (11 inline style elements, 1 style attribute) from BlockNote's UI primitives. A nonce or hash covers style and script elements; a style attribute is governed separately (`style-src-attr`) and a nonce does not cover it, so the one attribute violation needs removing or a hash with `'unsafe-hashes'`. The shell server uses a per-response nonce on its own inline script and style elements; `'unsafe-inline'` is never allowed without a navigator ruling.

Measured baseline: workroom, one run each, for the counter-metrics. Gate click to confirmation shown 112 ms; Confirm to the decision appearing in the replica-fed list 171 ms; `room.changed` hint 92 ms after the click; `change_seq` 5 to 14; steady-state one external write to the evidence view 147 ms; time to the live feed on first load 597 ms; first paint median 68 ms (3 loads, from a temp-dir copy); startup errors 1 (one uncaught page error with no message, 0 server error events); persistent state 15 items (1 cookie, 14 IndexedDB databases, 0 server files). Reconnect after a daemon restart: NOT recovered as built (6 of 6 claims missing after 30 s, a reload recovered all 6); the target after transplant 1 is agent-native's measured 315 ms to show all 6 with no reload.

## Ruling 2026-10-03 (RULE 8, plan 19)

Plan 19 measured the condition this record left open ("RULE 8 condition NOT yet met"): the Next standalone output of `ui/shell` is 1,139 files and 34.3 MB, of which 1,014 files are a traced `node_modules` tree of 13 top-level packages, none in the root manifest (next, react, react-dom, styled-jsx, semver, client-only, detect-libc, sharp, @img/colour, two @img/sharp binaries, @next/env, @swc/helpers). A time-boxed esbuild bundling experiment started the server with no tree but failed on the first request, because Turbopack's generated chunks `require('next/dist/...')` at run time. The matter went to the navigator through the orchestrator's AskUserQuestion card.

Reply, verbatim:

> Next as a per-machine dependency

Meaning, as applied: the shell's runtime framework packages are ROOT dependencies installed per machine by the loader like every other dependency (nothing vendored in the tarball, so RULE 8 holds). The standalone output ships WITHOUT its `node_modules` tree, and `server.js` resolves `next` and `react` from the plugin root's `node_modules`.

Rejected options: (1) an express server over a static export of the Next UI (the alternative this record named); (2) an esbuild bundling post-step with chunk rewriting.

Scope of the exception (orchestrator ruling under this reply): `tests/test-369-walled-manifest.cjs` codified D-17's "no UI package at the root"; the ruling opens it for exactly the framework runtime and nothing else. Only `next`, `react` and `react-dom` left its denylist (13 entries stay: typescript, @types/, vite, rxdb, rxjs, dexie, @blocknote/, @agent-native/, esbuild, tsx, ts-node, @fontsource, playwright), and a new scenario pins the three root versions byte-equal to `ui/shell/package.json`.

Final root dependency list added (exact pins, `dependencies`, no caret): `next` 16.2.10, `react` 19.2.4, `react-dom` 19.2.4. Minimal by behaviour: with only these three (and the 12 packages they pull in: @next/env, @swc/helpers, styled-jsx, client-only, scheduler, postcss, picocolors, nanoid, source-map-js, caniuse-lite, baseline-browser-mapping, tslib) the stripped standalone output started clean ("Ready in 0ms", no warning), answered 200 on `/`, completed the bootstrap sign-in exchange and served a static chunk. It ran WITHOUT sharp and without the SWC binary (both are optional dependencies of next). `images.unoptimized` has no effect on the file trace (tried: still 1,139 files, sharp still traced). The stripped output is 125 files, 2.1 MB.

Install-size delta, measured on this machine (linux aarch64, Node 22.23.1, npm ci in temp copies of the manifest and shrinkwrap, same command the loader runs, `npm ci --ignore-scripts`, no `--omit`):

| | node_modules size | top-level entries | packages installed |
|---|---|---|---|
| before (root manifest at HEAD) | 51M (34,862,704 bytes) | 115 | 120 |
| after (plus next, react, react-dom) | 511M (486,359,536 bytes) | 134 | 144 |
| delta | +460M | +19 | +24 |

Of the delta, the platform SWC binaries are 120M each and `npm ci` installed BOTH `@next/swc-linux-arm64-gnu` and `@next/swc-linux-arm64-musl` (240M), and `@img` (sharp and libvips) is 34M. Earlier scratch installs of just the three packages, before the shrinkwrap was regenerated: 188M (15 packages) with `--omit=optional`, 325M (22 packages) with optional dependencies via `npm install`. The ceiling in RULE 8 (20,000 entries, 256 MiB) governs the tarball, which is unaffected (the tarball ships no node_modules and no ui/ path); the per-machine install is what grows.

Follow-on for plan 28 (not changed here): because the runtime starts without sharp and without the SWC binary, a loader `--omit=optional` for these packages would cut most of the +460M. The loader is not touched by plan 19.

Plan 28 carries the CHANGELOG line and the RULE 5 / RULE 8 wording (`docs/RELEASE-CEREMONY-RULING-SYSTEM.md`) for this exception.

Also recorded: files outside plan 19's `files_modified` that this ruling changed: `package.json`, `npm-shrinkwrap.json`, `tests/test-369-walled-manifest.cjs`, `ui/shell/scripts/postbuild.mjs` (strips the tree) and this record. `package-lock.json` at the repo root is stale (version beta.30, not maintained between releases) and was left alone; the release's `npm shrinkwrap` step regenerates the shrinkwrap.
