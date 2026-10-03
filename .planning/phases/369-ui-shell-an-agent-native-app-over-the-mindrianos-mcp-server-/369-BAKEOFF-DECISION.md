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
