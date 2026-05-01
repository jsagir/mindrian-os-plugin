---
phase: 101-selector-library-jtbd-aware
plan: 05
subsystem: hmi
tags: [mode-a, mode-b, tier-0, graceful-degradation, dispatcher, canon-part-3]
canon_parts:
  - "Part 3 (Tri-Context Decision Gate; Option generation tier-awareness; Mode A vs Mode B vs Tier 0)"
  - "Part 7 (Reuse Before Build; defense-in-depth around existing F.6 mode contract)"
requires:
  - "Phase 100 (lib/hmi/jtbd-state.cjs for F-shape JTBD-state read)"
  - "Phase 101-01 (lib/hmi/shape-f6-renderer.cjs already enforces Mode A/B internally)"
  - "Phase 101-02 (lib/hmi/shape-g-renderer.cjs base; extended this plan)"
  - "Phase 101-03 (lib/hmi/shape-h-renderer.cjs base; extended this plan)"
provides:
  - "lib/hmi/tier-check.cjs (v1 stub: getTier + modeForTier)"
  - "lib/hmi/selector-dispatcher.cjs (single integration point with Mode A/B/Tier 0 routing)"
  - "tests/test-shape-f6-mode-b.cjs (7-assertion harness, replaces 101-00 stub)"
  - "Mode-aware footer logic in shape-g-renderer.cjs and shape-h-renderer.cjs"
affects:
  - "Phase 101-04 (sibling; this plan authored the dispatcher first per Wave-2 stub-creation pattern)"
  - "Phase 102 context-aware renderer surface (will consume pickShape() entry)"
  - "Phase 90 follow-on (tier-check stub will be replaced by full Brain-ping helper)"
tech-stack:
  added: []
  patterns:
    - "Single-entry dispatcher with shape-renderer fan-out"
    - "Defense-in-depth: tier check at dispatcher AND per-renderer suppression"
    - "safeRequire for optional shape modules (Phase 88.2 F.1 absent path tolerated)"
    - "No-throw invariant: dispatcher try/catch returns { shape: 'error' } envelope"
    - "Free-Text appended at dispatcher level so no JTBD verb set can drop it (D-10)"
key-files:
  created:
    - "lib/hmi/tier-check.cjs"
    - "lib/hmi/selector-dispatcher.cjs"
    - "tests/test-shape-f6-mode-b.cjs"
  modified:
    - "lib/hmi/shape-g-renderer.cjs"
    - "lib/hmi/shape-h-renderer.cjs"
decisions:
  - "tier-check helper landed as lib/hmi/tier-check.cjs (v1 stub) since no extant helper found in main; documented Phase 90 follow-on path inline"
  - "Mode B prefix line is dispatcher-injected before the renderer's Zone 1 header, not encoded inside each renderer (single source of truth)"
  - "Tier 0 returns { shape: 'error', error: 'tier-0-refused' } per Canon Part 3 Rule 2; exact error code is the regression contract for Phase 102+"
  - "Sibling plan 101-04's selector-dispatcher base did not land first; this plan authored the dispatcher per the 101-04 frontmatter contract and tolerated absence of shape-f1-fallback.cjs via safeRequire"
  - "G and H renderers gained an explicit `mode` field on contract output for downstream tooling and forward compat with Phase 102 introspection"
metrics:
  duration: "~5m"
  completed: "2026-05-01"
  tasks: 3
  files: 5
  commits: 3
  lines:
    tier-check: 63
    dispatcher: 243
    shape-g-mods: "+18"
    shape-h-mods: "+18"
    tests: 267
requirements:
  - HMI-101-05
---

# Phase 101 Plan 05: Mode A / Mode B / Tier 0 Graceful Degradation Summary

Defense-in-depth wiring of Canon Part 3 "Option generation tier-awareness" across the F.6 + G + H renderer surface and a new selector-dispatcher entry point, so that Brain unreachability never surfaces a Brain-only RECOMMENDED marker, and a brand-new room with no graph cleanly refuses expensive shapes instead of crashing.

## What Was Built

### Task 1: lib/hmi/tier-check.cjs (NEW, 63 lines)

A v1 stub helper that returns `2` if `process.env.MINDRIAN_BRAIN_KEY` is set, else `1`. The in-source comment block documents:

- which canon part defines the tier-vs-mode mapping (Part 3, "Option generation tier-awareness")
- expected return type: integer in `{0, 1, 2, 3}`
- the Phase 90 follow-on path that replaces this stub with a full Brain-ping + reachability cache + BRAIN.md presence audit

A search for any pre-existing `tier-check.cjs` / `checkTier()` / `getTier()` symbol in `lib/` and `scripts/` returned nothing on main as of 2026-05-01, so the stub is the canonical helper for now. The stub also exports `modeForTier(tier)` returning `'A' | 'B' | '0'` for callers that prefer the canonical mode label over the integer tier.

### Task 2: lib/hmi/selector-dispatcher.cjs (NEW, 243 lines) + G/H renderer mods

The dispatcher is the SOLE integration point for shape rendering per the sibling Plan 101-04 contract. Its `pickShape({ requestedShape, roomDir, operator, tier, payload })` API:

1. **Resolves the tier.** If the caller passes `tier`, that value is honored; otherwise the dispatcher calls `tier-check.getTier()`. If the helper is absent or throws, the dispatcher defaults to `1` (Mode B), the safer default.
2. **Maps tier to mode.**
   - `tier >= 2` -> Mode A (Full Loop): RECOMMENDED `▶` marker rendered when caller supplies `recommendedVerb`.
   - `tier === 1` -> Mode B (Local Only): RECOMMENDED suppressed across all shapes; Zone 1 header is prepended with `⚠ Brain unreachable; running on local graph only.`.
   - `tier === 0` -> dispatcher refuses immediately with `{ shape: 'error', rendered: { error: 'tier-0-refused', detail: '/mos:setup brain or graph required for selectors' } }` per Canon Part 3 Rule 2.
3. **Dispatches by shape.**
   - `'F'` + non-null JTBD state -> calls `renderShapeF6` (Phase 101-01) with explicit `tier`. The F.6 renderer already enforces Mode A/B internally; the dispatcher does not double-suppress.
   - `'F'` + null JTBD state -> tries `shape-f1-renderer.cjs` (Phase 88.2), falls back to `shape-f1-fallback.cjs` (Phase 101-04 deliverable) via `safeRequire`. If neither is present, returns `{ shape: 'error', error: 'no-f-renderer' }`.
   - `'G'` -> calls `renderShapeG` with `mode` and `tier` propagated; degenerate matrices fall through to `{ shape: 'E' }` per Plan 101-02.
   - `'H'` -> calls `renderShapeH` with `mode` and `tier` propagated; bad input returns `{ shape: 'error' }` per Plan 101-03.
   - `'A'` / `'B'` / `'C'` / `'D'` / `'E'` -> `{ shape, passthrough: true }` per D-11.
4. **Defense-in-depth:**
   - `ensureFreeTextLast()` mutates any F-shape contract to append `Free-Text` if the verb list does not already end on it (D-10).
   - In Mode B, `applyModeBPrefix()` inserts the Brain-unreachable line BEFORE the renderer's own Zone 1 header (a separate line; the renderer's header follows verbatim).
   - The entire body is wrapped in `try / catch`; on error the dispatcher returns `{ shape: 'error', rendered: { error: 'dispatch-failed', detail: ... } }` rather than throwing.

**Shape G (lib/hmi/shape-g-renderer.cjs):** `renderFooter()` now takes a `mode` argument. In Mode B, every footer glyph is hard-overridden to `▷` regardless of the caller-supplied glyph or the default-first-verb `▶`. `renderShapeG()` derives mode from `opts.mode`, `opts.tier`, or defaults to `'A'` for back-compat with pre-101-05 callers (the existing 7-assertion suite passes through this default). `contract.mode` is added for downstream introspection.

**Shape H (lib/hmi/shape-h-renderer.cjs):** Same contract as G applied to `buildFooter()`, with the empty-triangle constant `ALT` (`▷`) replacing the primary `PRIMARY` (`▶`) in Mode B. `contract.mode` is added.

### Task 3: tests/test-shape-f6-mode-b.cjs (NEW, 267 lines)

IIFE harness that replaces the 101-00 stub. Exits 0 when all 7 assertions pass:

| # | Assertion                       | Inputs                              | Expected                                                |
|---|---------------------------------|-------------------------------------|---------------------------------------------------------|
| 1 | mode_b_no_recommend             | F.6, tier:1, recommendedVerb        | zero `▶` markers in rendered output                     |
| 2 | zone1_prefix                    | F.6, tier:1                         | header contains `Brain unreachable; running on local graph only.` |
| 3 | mode_a_recommend_preserved      | F.6, tier:2, recommendedVerb        | exactly 1 `▶` and it lands on `Run Methodology`        |
| 4 | mode_a_no_prefix                | F.6, tier:2                         | header has NO Brain-unreachable prefix                  |
| 5 | g_mode_b                        | G, tier:1                           | footer has zero `▶`, has at least one `▷`               |
| 6 | h_mode_b                        | H, tier:1                           | same Zone 4 contract as G                               |
| 7 | tier_0_refuse                   | F, tier:0                           | `{ shape: 'error', error: 'tier-0-refused' }`          |

Each assertion uses an isolated `mkdtempSync('/tmp/test-101-05-')` room with its own JTBD state, and a try/finally guarantees cleanup even when an assertion fails.

## Verification

| Check                                            | Result |
|--------------------------------------------------|--------|
| `node tests/test-shape-f6-mode-b.cjs`            | PASS (7/7) |
| `node tests/test-shape-f6.cjs` (regression)      | PASS (7/7) |
| `node tests/test-shape-g.cjs` (regression)       | PASS (7/7) |
| `node tests/test-shape-h.cjs` (regression)       | PASS (7/7) |
| `grep "Brain unreachable" lib/hmi/selector-dispatcher.cjs` | 2 matches |

`tests/test-selector-dispatcher.cjs` (named in the verification block) is the deliverable of sibling Plan 101-04 and was not present on main at execution time; running it would error with `MODULE_NOT_FOUND`. Once 101-04 lands, the dispatcher this plan ships will satisfy 101-04's contract verbatim (the dispatcher was authored against the 101-04 plan frontmatter).

## Deviations from Plan

### Sibling-plan stub creation (Wave-2 mirror of Phase 99-02 pattern)

**Plan 101-04** (sibling, parallel) ships `lib/hmi/selector-dispatcher.cjs` + `lib/hmi/shape-f1-fallback.cjs` + `tests/test-selector-dispatcher.cjs`. At execution time of 101-05 (Wave 2), 101-04's commits had not yet merged into main. Per the wave_2_context directive ("If sibling 101-04's dispatcher hasn't merged when you reach that step, write your changes against the dispatcher file you EXPECT to exist"), this plan authored the dispatcher in full per the 101-04 plan frontmatter (`pickShape({ requestedShape, roomDir, operator, tier, payload }) -> { shape, rendered }`) plus the 101-05 Mode A/B/Tier 0 extensions. When sibling 101-04 lands, the dispatcher already in place will satisfy its 9-assertion test suite without rework. Sibling 101-04's `shape-f1-fallback.cjs` is referenced via `safeRequire` so its absence does not block this plan's F.6 / G / H paths.

**Files affected by deviation:** `lib/hmi/selector-dispatcher.cjs` (created here, sibling 101-04 will not need to recreate).

### tier-check helper landed as a stub

Plan 101-05 Task 1 explicitly authorizes a `lib/hmi/tier-check.cjs` v1 stub if no extant helper is found. A search across `lib/` + `scripts/` for `checkTier()` / `getTier()` / `tier-check*` returned nothing on main as of 2026-05-01 (the closest analog is `lib/core/brain-client.cjs#isAvailable()`, which is a boolean rather than the 4-tier integer mapping the dispatcher needs). The stub is the canonical helper for v1.12.3 and is documented for replacement when Phase 90's full Brain-ping helper lands.

**No other deviations.** Plan executed exactly as written for Tasks 2 and 3.

## Auth gates

None encountered.

## Known Stubs

| File                          | Stub                                              | Future resolution                                    |
|-------------------------------|---------------------------------------------------|------------------------------------------------------|
| `lib/hmi/tier-check.cjs`      | `getTier()` returns 2 if env var set, else 1     | Phase 90 follow-on: full Brain-ping + cache + BRAIN.md presence audit |

The stub is intentional and is documented in the file's header comment. It is the deliberate landing point for v1.12.3 per the plan's authorization; a Phase 90 follow-on plan will replace it without changing the dispatcher's call surface.

## Self-Check: PASSED

Files created (all FOUND):
- `lib/hmi/tier-check.cjs` (commit b78949c)
- `lib/hmi/selector-dispatcher.cjs` (commit ed31391)
- `tests/test-shape-f6-mode-b.cjs` (commit d1f0791)

Files modified (all FOUND):
- `lib/hmi/shape-g-renderer.cjs` (commit ed31391)
- `lib/hmi/shape-h-renderer.cjs` (commit ed31391)

Commits (all FOUND in git log):
- b78949c (Task 1)
- ed31391 (Task 2)
- d1f0791 (Task 3)
