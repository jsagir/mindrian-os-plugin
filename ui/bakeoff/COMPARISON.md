# Bake-off comparison: workroom (A) against agent-native (B)

Source: `ui/bakeoff/results.json`, written by `node ui/bakeoff/measure.cjs --candidate both` on this machine
(Linux WSL2, 12 CPUs, Node v22.23.1, headless Chromium), 2026-10-03. Both candidates were set up and
production-built fresh by their own `setup.sh` and `build.sh` in that run. Both slices declare the same six
actions with the same exposures (parity checked before any number was taken). Every number below is read from
`results.json`; the method for each is in that file and in `ui/bakeoff/README.md`. One run per measure on one
machine: single timings (the ones under 150 ms in particular) carry noise of tens of milliseconds, so two
values within that band are called equal.

| # | Measure | A: workroom | B: agent-native | Better on this measure (from the numbers only) |
|---|---------|-------------|-----------------|------------------------------------------------|
| 1 | Architecture distorted | 5 bypass markers (3 globalThis singletons, 1 bundler-ignore, 1 lint silence); 22 framework paths deleted; 0 files outside its folder and ui/shared | 21 bypass markers (12 per-action agent and MCP exposure switches, 3 UI-only guards, 2 default plugins disabled, 2 singletons, 1 bundler-ignore, 1 lint silence); 24 paths deleted; 0 files outside | Workroom (5 against 21; outside-file count equal at 0) |
| 2 | Workroom code surviving | 347 of 2,911 snapshot lines byte-identical (11.9 percent, 8 of 35 files) | 0 of 2,911 (0 percent) | Workroom (by construction: it is the workroom) |
| 3 | Selected UI state reaches Claude | Pass: with the room-proposal adapter, clicking a claim then "Ask Claude" returned a proposal carrying the selected node id and showed the gate in 517 ms; 3 HTTP hops, 0 processes spawned | Fail in this run: the same click answered HTTP 500 after 8.3 s ("claude-adapter does not export a proposal source"); the selection is only settable through a URL parameter, the page has no selection control; same 3 hops by design | Workroom. The cause is B's overlay wiring (it looks for an export the shipped adapter does not have), not the chassis; with the fixed source both candidates mint the gate |
| 4 | New persistent-state assumptions | 15 items: 1 cookie, 14 IndexedDB databases (the shared RxDB); 0 server files added; 0 browser storage keys | 20 items: 3 cookies, 2 localStorage keys, 1 sessionStorage key, 14 IndexedDB databases; 0 server files added | Workroom (15 against 20) |
| 5 | Reconnect after a dropped connection | Not recovered: after the daemon was killed and restarted, 6 claims written by another process never appeared (6 of 6 missing after 30 s); the feed route answered `room_unbound`; a page reload recovered all 6 | Recovered: all 6 claims showed 315 ms after the write, 0 missing, no reload | Agent-native. A's `openRoom` binds through the generated adapter call, not the pool's `bind`, so the pool never records the room to restore after a reconnect (likely cause, not tested by a fix) |
| 6 | Startup errors | 1: 0 server error events, 0 console errors, 1 uncaught page error with no message | 28: 22 server error events (43 error-looking lines: hosted-database refusal, auth guard "app is locked"), 4 console errors, 2 page errors (one React #418 hydration), 4 HTTP 4xx and 5xx on first load. Known and measured, not fixed | Workroom (1 against 28) |
| 7 | Dependency removal | 4 removal patterns (`@blocknote/xl-*`, `@ai-sdk/*`, `ai`, `gray-matter`); build stayed green; 9 dependencies and 8 dev dependencies remain | 0 packages removed (code removed, not packages); build stayed green; 34 dependencies and 52 dev dependencies remain | Workroom on what remains (17 against 86 packages); equal on build green |
| 8 | Direct file-write replacement | 0 direct fs or process-spawn uses (overlay 0, generated server source 0) | 0 (overlay 0, generated server source 0) | Equal (0 and 0) |
| 9 | Packaging | Build 16.9 s; output 59.7 MB in 1,262 files, of which 1,028 are a traced `node_modules` tree (RULE 8 flag), 15 runtime packages not in the root manifest (next, react, sharp binaries and others); copy started from a temp dir with plain `node`: yes, ready in 432 ms; first paint median 68 ms; projected release payload 3,258 entries and 92.7 MB | Build 57.8 s; output 31.4 MB in 192 files, of which 19 are a traced `node_modules` (RULE 8 flag), 1 runtime package not in the root manifest (`node-pty`); copy started with plain `node`: yes, ready in 688 ms; first paint median 256 ms; projected payload 2,188 entries and 64.4 MB | Split. Agent-native: smaller output, 6.6 times fewer files, 1 against 15 non-root packages. Workroom: faster build (16.9 s against 57.8 s) and faster first paint (68 ms against 256 ms). Both are inside the 20,000-entry and 256 MiB ceiling; both carry a traced `node_modules` that RULE 8 does not allow in the tarball |
| E1 | Gate click to view, ms | Confirm to confirmation shown 112 ms; to the decision appearing in the replica-fed list 171 ms; `change_seq` 5 to 14; `room.changed` hint 92 ms after the click | Confirm to confirmation shown 115 ms; the page shows no replica-fed decision or standing after Confirm, so that step is NOT MEASURED; `change_seq` 5 to 13; hint 88 ms | Equal (112 against 115 ms is inside noise) |
| E2 | CSP, `style-src 'self'` | Document did not render under the UI-SPEC contract policy verbatim (5 violations: 4 inline scripts blocked by `default-src 'self'`, 1 style attribute). With scripts allowed to isolate styles: document renders, 12 `style-src` violations (11 inline style elements, 1 style attribute) | Document did not render under the contract policy verbatim (29 violations: 11 inline scripts, 18 style). With scripts allowed: document renders, 27 `style-src` violations (10 inline style elements, 17 style attributes) | Workroom on violation count (12 against 27); neither passes the contract policy as built |

Shared finding, recorded once (not a per-candidate defect): both builds bundle RxDB through `ui/shared`, whose
error-message link strings contain the literal `rxdb.info` (inert text, never fetched; each run contacted only
127.0.0.1). Workroom's output carries it in 16 files; agent-native's `build.sh` rewrites it after the build
(0 files, 6 files carry the rewritten `rxdb.invalid`). UI-SPEC check C2 as worded ("zero literal occurrences")
cannot pass for any chassis that bundles RxDB unless a build-time rewrite is added.

## Who wins what

- Workroom is better on: 1 architecture distorted, 2 code surviving, 3 selected state (this run), 4 persistent
  state, 6 startup errors, 7 dependencies remaining, E2 CSP violation count.
- Agent-native is better on: 5 reconnect, and the output-size half of 9 packaging.
- Equal: 8 direct file writes, E1 gate latency.
- Packaging is split inside the one measure (build and paint speed to the workroom, output size and file count
  to agent-native).

The comparison splits. Two results trace to one-file overlay wiring rather than to the chassis: measure 5 for A
(`openRoom` skipping the pool's `bind`) and measure 3 for B (`proposeDecision` naming an adapter export that does
not exist). They are reported as measured, not corrected.

## What D-07's tie-break implies on this split

D-07 rules the only tie-break: on a split the workroom chassis default holds and the losing candidate's winning
parts are transplanted; the UI build tool follows the winner (Next for the workroom, Vite for agent-native);
assets are always built at release. Agent-native's winning parts, as transplant candidates:

1. Reconnect (measure 5): B restores the room after a daemon restart because `openRoom` uses the shared pool's
   `bind`. The transplant is that call, a one-line wiring change in the workroom's `openRoom`.
2. Output footprint (measure 9): B's Nitro output is 192 files with one traced package against the Next
   standalone's 1,262 files with a 1,028-file `node_modules` tree. This bears on open question 2 (where the shell
   server lives) and on RULE 8, which forbids a vendored `node_modules` tree in the tarball: the Next standalone
   output qualifies only if that tree is eliminated, and agent-native's output still carries `node-pty`.

## CSP finding (UI-SPEC implementability check)

Under `default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self'; frame-src
'none'; object-src 'none'` neither candidate renders the document as built: the framework's inline hydration
scripts are blocked first. With scripts allowed to isolate styles, the BlockNote document text renders in both,
but `style-src 'self'` still records 12 violations in A and 27 in B (inline `<style>` elements and inline `style`
attributes injected by BlockNote's UI primitives). A nonce or hash can cover style elements; a style attribute
is governed separately (`style-src-attr`) and a nonce does not cover it. A nonce or hash policy was not
exercised here, so whether it renders cleanly is NOT MEASURED. `'unsafe-inline'` was not used in any shipped
configuration; the one measurement run that allowed inline scripts is labelled and is not a policy.
