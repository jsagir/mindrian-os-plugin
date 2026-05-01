---
phase: 102
plan: 04
subsystem: lib/render + tests + .planning/REQUIREMENTS
tags:
  - context-aware-rendering
  - provenance-envelope
  - canon-part-8
  - local-only
  - audit-trail
canon_parts:
  - "4"
  - "8"
dependency-graph:
  requires:
    - render-102-00-jtbd-palettes-asset
    - render-102-01-stable-signature
    - canon-mindrian-canon-v1.3
  provides:
    - render-102-04-provenance-envelope
    - canon-part-8-render-time-fence
    - render-v2-audit-surface
  affects:
    - sibling-plan-102-02-compaction
    - sibling-plan-102-03-jtbd-zone4
    - sibling-plan-102-05-color-overlay
    - downstream-phase-100-jtbd-engine-consumers
tech-stack:
  added: []
  patterns:
    - non-enumerable-property-via-defineProperty
    - frozen-scalar-only-audit-envelope
    - runtime-tripwire-fs-net-fence
    - static-source-audit-defense-in-depth
key-files:
  created:
    - .planning/phases/102-context-aware-rendering/102-04-SUMMARY.md
  modified:
    - lib/render/render-v2.cjs
    - tests/test-render-v2-provenance.cjs
    - .planning/REQUIREMENTS.md
decisions:
  - _provenance is non-enumerable so Object.keys(env) still equals ['contract','rendered'] (RENDER-102-06 byte-stability fence preserved)
  - JSON.stringify drops _provenance (zero serialization egress; defense-in-depth on Canon Part 8)
  - Caller-supplied `provenance` arg intentionally NOT folded into _provenance to prevent user-content leaks into the LOCAL audit envelope
  - _provenance is Object.frozen so downstream consumers cannot mutate the audit trail
  - Source audit (test 11) catches lazy-require bypass at static analysis time, complementing the runtime trip-wires (tests 9-10)
metrics:
  duration: 5m
  completed-date: 2026-05-01
---

# Phase 102 Plan 04: _provenance Envelope (LOCAL-only) Summary

LOCAL-only audit envelope landed on render-v2: every render result now carries a non-enumerable, frozen `_provenance: { renderer, version, operator, tier, mode, jtbd }` field. Phase 99-03 -> 102 byte-stability invariant (`Object.keys` and `JSON.stringify`) preserved by construction. Canon Part 8 fences locked in at three independent layers (runtime FS trip-wire, runtime network trip-wire, static source audit), plus a fourth fence asserts a Brain-shaped caller `provenance` arg never leaks into the LOCAL `_provenance` audit envelope.

## What was built

**Task 1 -- Add `_provenance` envelope to render-v2.cjs** (commit `b0329a0`)

- New `attachProvenance(envelope, provenance)` helper at module scope. Uses `Object.defineProperty` with `enumerable: false, configurable: false, writable: false` so the field is reachable as `env._provenance` but invisible to `Object.keys`, `for..in`, and `JSON.stringify`.
- `_provenance` descriptor is built once per `render()` call at the top of the function body (algorithm step 4, promoted from TODO marker to live code) and frozen via `Object.freeze`.
- Six canonical fields, all framework-handle scalars:
  - `renderer: 'render-v2'` (LOCAL string constant)
  - `version: '102'` (LOCAL string constant)
  - `operator` (one of 5 frozen canonical operators, or null)
  - `tier` (numeric 0-3, generic enum like 'tier-0'/'mode-a'/'mode-b', or arbitrary scalar)
  - `mode` (cli/desktop/cowork/A/B/tier-0 generic enum)
  - `jtbd` (one of 13 JTBD handles from JTBD-PALETTES.md, or null)
- Both return paths attach `_provenance`: the JUST_TALK suppressed path (`{rendered: '', contract: { suppressed, reason }}`) and the normal compose path (`{rendered: composed, contract: {}}`).
- Caller-supplied `provenance` arg (which CAN carry Brain context per CONTEXT D-09) is intentionally NOT folded into `_provenance`. Comment block in render-v2.cjs explicitly documents the rationale: caller-supplied user content stays in `zones.signals` if the caller wants it surfaced; the LOCAL audit envelope stays scalar-only.
- JSDoc updated to document the non-enumerable contract and the RENDER-102-06 byte-stability invariant.

**Task 2 -- Replace test stub with 12-IIFE regression fence** (commit `7410902`)

- `tests/test-render-v2-provenance.cjs`: 33-line stub (`process.exit(0)`) replaced with 555-line full body. 18 assertions across 12 IIFE blocks.
- Functional fences (1-7): shape (6 canonical fields), renderer constant, version constant, operator passthrough across all 5 canonical operators + null + undefined, mode passthrough across cli/desktop/cowork + arbitrary + default, tier passthrough across 0/1/2/3/string + default, jtbd default-null + 4-handle passthrough.
- Byte-stability fence (8): `Object.keys(env).sort() === ['contract','rendered']` (RENDER-102-06 preserved); `JSON.stringify(env)` does NOT contain `_provenance` or `'render-v2'`; `for..in` does NOT visit `_provenance`; explicit `env._provenance` access still works.
- Canon Part 8 fences (9-12):
  - **Test 9 (fs_scope):** Runtime trip-wires on `fs.readFileSync`, `fs.readFile`, `fs.openSync`, `fs.open`, `fs.createReadStream`. Records every path read during a representative slice of `render()` invocations (4 operator + jtbd permutations). Asserts every recorded path is either empty (current state) or ends with `JTBD-PALETTES.md` (allow-list room for sibling 102-03 to read at module load). Patches restored via try/finally.
  - **Test 10 (net_silence):** Runtime trip-wires on `http.request`, `https.request`, `net.connect`, `dns.lookup`, `global.fetch`. Each wire throws on invocation. Asserts zero trips during the same 4-permutation slice. Patches restored via try/finally.
  - **Test 11 (source_audit):** Static scan of `lib/render/render-v2.cjs` source for 11 forbidden tokens: `require('node:http')`, `require('node:https')`, `require('node:net')`, `require('node:dns')`, `require('http')`, `require('https')`, `fetch(`, `XMLHttpRequest`, `mcp-server-brain`, `brain.mindrian.ai`, `JSON.stringify(provenance)`. Allows in-comment occurrences only for the two doc-mention tokens (mcp-server-brain, brain.mindrian.ai) so JSDoc can name the boundary. Defense-in-depth against lazy-require bypass in unreached branches.
  - **Test 12 (provenance_no_user_content):** Realistic Brain-shaped caller `provenance` arg with `graphQuery: 'CONFIDENTIAL_USER_QUERY'`, `userArtifactId: 'opp-01-quantum-brain-imaging'`, `meetingTranscriptHash: 'sha256:DO_NOT_LEAK'`, `frameworks: ['rs-fetch','rs-thesis']`. Asserts `_provenance` keys are exactly the 6 canonical fields AND none of the forbidden strings appear in `JSON.stringify(env._provenance)`.
- Pure CJS, node built-ins only, zero new runtime deps (Phase 87 invariant).

**Task 3 -- Canon Part 8 audit (verified clean)**

- Direct grep on `lib/render/render-v2.cjs` for `brain|http|https|fetch|net.connect|dns.|require`: only 1 hit, on line 91, inside a `//` comment block reserving the selector-dispatcher require for sibling 102-03 (NOT a Brain/network surface).
- Direct grep on the test file: 11 hits, all in the deliberate trip-wire / forbidden-token list (the test that ENFORCES the boundary).
- Test 11 (source_audit) re-runs this exact audit on every test execution -- so the audit is now an automated regression fence, not a one-shot manual check.

**Task 4 -- Mark RENDER-102-04 complete in REQUIREMENTS.md**

- Bullet `- [ ]` -> `- [x]` on line 144.
- Traceability row `RENDER-102-04 | Phase 102 | Pending` -> `RENDER-102-04 | Phase 102 | Complete` on line 295.

**Task 5 -- This summary + final metadata commit** (this commit)

## Why it matters

Phase 102's renderer is the universal output formatter for every `/mos:` command. Without an audit envelope, downstream consumers (hooks, telemetry, the Phase 100 JTBD engine, external diagnostic tools) have no way to attribute a render to a renderer/version/operator/tier/mode/jtbd tuple at the boundary where output is emitted. With the envelope:

- **Telemetry can attribute** every emitted output to a specific `(operator, tier, mode, jtbd)` decision context.
- **Phase 100 JTBD engine** can verify that JTBD handles round-trip through render-v2 cleanly without ever touching user content.
- **Phase 95.1 doctor** can sweep for renders missing `_provenance` (a stale renderer would not carry the field, surfacing drift).
- **Future drift-detection (Phase 92 proposed)** has a stable, scalar-only audit surface to scan over.

The non-enumerable + JSON-stringify-invisible design means the envelope ships free across every consumer that cared about exactly-2-keys: nobody breaks; everyone who explicitly asks for `_provenance` gets it.

## Canon compliance

- **Part 4 (Every Choice Is Graph Data):** `_provenance` carries the operator + tier + mode + jtbd that produced this render. Together with the typed-edge writes already shipped in Phase 90 (BRAIN.md quadruple) and Phase 84 (cascade edges), every render result is now traceable to its decision-gate context. Future graph writers can read `env._provenance` and link the output back to its STATE.md operator transition. (No graph writer added in this plan -- the surface is reserved for follow-on consumers.)
- **Part 8 (The Graph Boundary):** The `_provenance` envelope is LOCAL-only by construction:
  - Zero Brain queries during render (test 10 net_silence runtime fence + test 11 source_audit static fence).
  - Zero network IO (test 10 net_silence runtime fence on http/https/net/dns/fetch).
  - Zero filesystem reads outside `lib/render/JTBD-PALETTES.md` (test 9 fs_scope runtime fence; current implementation reads zero FS at render time, with allow-list room for sibling 102-03 module-load read).
  - Zero user-content strings in the envelope (test 12 provenance_no_user_content with realistic Brain-shaped caller payload).
  - JSON.stringify drops the envelope (test 8 non_enumerable; defense-in-depth on serialization egress).
- **Part 7 (Reuse Before Build):** No new module created. The envelope is a property attached to the existing render-v2 return value via a 12-line `attachProvenance` helper. Zero new runtime deps. The test promotes a Wave-0 stub at the same path the feynman runner already had registered (`tests/test-render-v2-provenance.cjs`); no new test path added to the runner.

## Sibling-plan compatibility

This plan ran in Wave 2 alongside parallel siblings 102-02 (compaction), 102-03 (jtbd-zone4), 102-05 (color-overlay), all of which also modify `lib/render/render-v2.cjs`. The hand-off is clean by construction:

- The `_provenance` descriptor is built at the TOP of `render()`, before algorithm steps 1-3 + 5-7. Sibling plans 102-02/03/05 wire into algorithm steps 1, 2, 3, 5, 7 (compaction decision, JTBD-aware Zone 4, color overlay on Zone 1, compaction application, Mode B prefix). None of those steps touch the `_provenance` descriptor.
- `attachProvenance` is appended at module scope, AFTER the existing `composeZones` helper. Other plans appending helpers append at the same anchor point, so a 3-way merge sees additive-only diffs in the helper region.
- Test file `tests/test-render-v2-provenance.cjs` is owned exclusively by this plan; no sibling plan touches it.
- `JTBD-PALETTES.md` is read-only for this plan (test 9 fs_scope just allow-lists it). Sibling 102-03 owns the parser; this plan's tests are forward-compatible because the fs trip-wire allows reads of that exact path.
- Operator gates (steps 6) for `JUST_TALK` + `METHODOLOGY` are preserved verbatim from the 102-01 baseline; this plan only refactored the JUST_TALK return into a call to `attachProvenance`, which is a structurally identical edit.

If a 3-way merge surfaces a conflict, it will be in the algorithm-step comments around step 4, which is the line each sibling visits to wire its respective hook. The conflict resolution is mechanical (concat the comments).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No on-disk `102-04-PLAN.md`**
- **Found during:** init phase before Task 1
- **Issue:** `.planning/phases/102-context-aware-rendering/` contained only `102-00-SUMMARY.md`; no PLAN files for 102-01..05 (consistent with the 102-00 SUMMARY's note that PLAN files are gitignored under the `.planning/` rule, and with the 102-00 SUMMARY's resolution to treat the orchestrator-supplied `<objective>` + `<success_criteria>` blocks as the task envelope).
- **Fix:** Treated the prompt's `<objective>` + `<success_criteria>` as the canonical task list. Each criterion executed as one atomic deliverable (Task 1 = envelope, Task 2 = test body, Task 3 = audit, Task 4 = REQUIREMENTS.md). The same recovery pattern Phase 102-00 used.
- **Files affected:** none -- the phase directory already exists.
- **Commit:** none -- the discovery happened before any commit; this summary's commit is the only artifact.

**2. [Rule 2 - Missing critical functionality] RENDER-102-04 spec requires LOCAL-only fence; spec also needs explicit defense against caller-supplied provenance leak**
- **Found during:** Task 2 test design
- **Issue:** RENDER-102-04 spec says "Provenance is LOCAL-only per Canon Part 8". The renderer args include a `provenance` field (set up in 102-01 for Brain-aware callers per CONTEXT D-09). Without an explicit fence, a future change could fold the caller's `provenance` arg into the LOCAL `_provenance` envelope, silently leaking user content into the audit trail.
- **Fix:** Two-layer defense added in this plan: (a) implementation comment in render-v2.cjs explicitly documents that the caller `provenance` arg is NOT folded into `_provenance`; (b) test 12 (`provenance_no_user_content`) verifies this with a realistic Brain-shaped caller payload containing `CONFIDENTIAL_USER_QUERY`, `userArtifactId`, and `meetingTranscriptHash` markers. Future regressions surface in the test ledger.
- **Files modified:** `lib/render/render-v2.cjs`, `tests/test-render-v2-provenance.cjs`
- **Commits:** `b0329a0` (impl comment), `7410902` (test 12)

### Auth gates

None.

## Self-Check: PASSED

- FOUND: `lib/render/render-v2.cjs` (modified; `_provenance` envelope attached via non-enumerable property)
- FOUND: `tests/test-render-v2-provenance.cjs` (modified; 18-assertion 12-IIFE body replacing the Wave-0 stub)
- FOUND: `.planning/REQUIREMENTS.md` (modified; RENDER-102-04 marked `- [x]` + traceability row `Complete`)
- FOUND commit: `b0329a0` -- `feat(102-04): add LOCAL-only _provenance envelope to render-v2`
- FOUND commit: `7410902` -- `test(102-04): replace _provenance stub with 12-IIFE regression fence`
- VERIFIED: `node tests/test-render-v2-provenance.cjs` -> 18 passed, 0 failed
- VERIFIED: `node tests/test-render-v2-signature.cjs` -> 5 passed, 0 failed (102-01 sibling, byte-stability holds)
- VERIFIED: `node lib/render/render-v2.test.cjs` -> 12 passed, 0 failed (Phase 99-03 -> 102 byte-stability fence holds; Object.keys still ['contract','rendered'])
- VERIFIED: 3 sibling Wave-0 stubs (compaction, jtbd-zone4, color-overlay) still exit 0 cleanly
- VERIFIED: grep audit on `lib/render/render-v2.cjs` source for `brain|http|https|fetch|net.connect|dns.|require` -> single hit on line 91, inside a `//` comment block (selector-dispatcher require reservation for sibling 102-03; not a Brain/network surface)
- VERIFIED: test 11 (source_audit) is itself the runtime version of this grep audit; runs on every test execution

## Known Stubs

None. All Wave-2 work for Plan 102-04 ships in this plan. The sibling Wave-0 stubs at `tests/test-render-v2-compaction.cjs`, `tests/test-render-v2-jtbd-zone4.cjs`, and `tests/test-render-v2-color-overlay.cjs` are owned by sibling plans 102-02, 102-03, 102-05 respectively (NOT this plan).

## Commits

| Hash | Message | Files |
|------|---------|-------|
| `b0329a0` | feat(102-04): add LOCAL-only _provenance envelope to render-v2 | lib/render/render-v2.cjs |
| `7410902` | test(102-04): replace _provenance stub with 12-IIFE regression fence | tests/test-render-v2-provenance.cjs |
| (this) | docs(102-04): complete _provenance envelope plan | .planning/REQUIREMENTS.md, .planning/phases/102-context-aware-rendering/102-04-SUMMARY.md |

## See also

- `lib/render/render-v2.cjs` -- Phase 102-01 baseline; this plan added the `_provenance` envelope at algorithm step 4 + the `attachProvenance` helper.
- `lib/render/render-v2.test.cjs` -- Phase 99-03 -> 102 import-surface byte-stability fence; scenario 5 still passes after this plan (RENDER-102-06 preserved).
- `tests/test-render-v2-signature.cjs` -- Phase 102-01 signature contract test; still passes after this plan.
- `lib/render/JTBD-PALETTES.md` -- Phase 102-00 data asset; this plan's test 9 fs_scope allow-lists this exact path so sibling 102-03 can read it at module load without tripping the LOCAL-only fence.
- `docs/MINDRIAN-CANON.md` v1.3 Part 4 (Every Choice Is Graph Data) + Part 8 (The Graph Boundary).
- `.planning/REQUIREMENTS.md` -- RENDER-102-04 now marked `- [x]` Complete.
