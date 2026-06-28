---
phase: 187
slug: statusline-navigator-cockpit
status: COMPLETE
completed: 2026-06-28
milestone: v1.15.0 "Cure Under-Invocation"
canon_parts: [3, 5, 9, 10, 12]
contract: docs/STATUSLINE-CONTRACT.md (LOCKED 2026-06-28)
---

# Phase 187 - Statusline Navigator Cockpit - SUMMARY

## What shipped

The statusline is rebuilt to serve the NAVIGATOR (not the operator), implementing the four-tier
cockpit from the LOCKED docs/STATUSLINE-CONTRACT.md. Color is carried by EMOJI GLYPHS
(host-independent; this host strips ANSI to literal text, same finding as Phase 182.1).

- `lib/statusline/cockpit-renderer.cjs` - PURE four-tier renderer. Renders the 4 states (healthy /
  caution / context-cliff / post-update-drift), the 50/80 emoji thresholds (green<50 / orange50-79 /
  red>=80), REORDER-AT-CLIFF (at >=80% the warning takes the hero slot), the doctor-fix corrective.
  `renderCockpit` never throws/blanks (degrades to `Mindrian glyph + MindrianOS`). `analyze()` is the
  single source of truth for state/hero/band/has_fix. Binds the Tier-1 Voice glyph via the Phase 182.1
  detector (187-04).
- `lib/statusline/cockpit-signals.cjs` - LOCAL signal collector (187-01/03/04). Maps host-exposed
  ctx%/room/brain + health cache + post-update touch-file + voice side-channel + next-move proxy to
  the cockpit state. Every fs op try/caught.
- `lib/statusline/cockpit-telemetry.cjs` - INV-SL-2 measurement hook (187-05). Debounced LOCAL JSONL
  at `~/.mindrian/telemetry/statusline-exposure.jsonl`, scalar/enum only, zero network.
- `scripts/context-monitor` - lazy-requires the 3 cockpit modules (graceful), emits the cockpit as
  the hero line above the preserved two-row block, records the INV-SL-2 exposure, malformed-stdin
  fallback that never blanks. Touches only the statusline render path.

## Verification (2026-06-28)

- tests/test-statusline-cockpit-187.cjs: 14 tests / 117 assertions PASS
- tests/run-all-187.sh: 2/2 (cockpit suite + the context-monitor D-02 broadcast fence 7/7) GREEN
- No em-dashes (U+2014 grep clean). Part 8 clean (no fetch/http/curl/brain in the 3 new modules).
- Frozen Part 3 contracts UNTOUCHED (MAX_K=3 / DIAL_REACH_K=6 / 0.70-0.15 / 6-reach bank / dial glyphs);
  the two-row D-02 broadcast is byte-intact (its fence still 7/7).
- Glyph carve-out: cockpit modules contain none of the 3 exclusive dial glyphs (suite Test 8 enforces).

## Named debts (host signals not exposed on the hot path - recorded honestly per the contract)

1. **Room-health (Tier 2 warn/broken).** `/mos:doctor` does NOT write a room-health STATUS cache today
   (it writes `doctor-applied.json`, not a health status). The cockpit READ path is wired to
   `~/.mindrian/room-health.json {status}` and defaults to the sound state; the warn/broken states
   light up the instant doctor (or a session-start hook) starts writing that cache. NEXT: wire the
   doctor write side (or a session-start health-status writer).
2. **Voice Signature glyph (Tier 1) write side.** The host does not hand the statusline Larry's
   last-turn text, so the glyph is read from a `~/.mindrian/voice-mark.json` side-channel and bound via
   the Phase 182.1 detector. The WRITE side (a turn-capture hook recording the last-turn voice mark) is
   not yet wired; absent the side-channel the Tier-1 glyph is omitted (Mindrian + Brain glyphs still
   render). NEXT: a Stop-hook turn-capture writer (sibling to the Phase 182.1 deferred Stop interceptor).
3. **Next-move (Tier 3).** No dedicated imperative next-move signal on the hot path. `jtbd` is the
   honest proxy (then governing-thought, then "continue").
4. **Post-update drift.** WIRED today via the `~/.mindrian/post-update-restart-pending` touch-file
   (written by `doctor --post-update`); escalates health to drift and promotes the doctor-fix corrective.

## Out-of-scope discovery (NOT fixed here)

The global `tests/test-statusline-glyph-isolation.cjs` fence is PRE-EXISTING red on
`scripts/coherence-smoke-test.cjs` (contains the chart/target glyphs; last changed commit ecd4aa01,
untouched by this phase). Phase 187's own glyph contract is gated by suite Test 8; the global fence is
a separate pre-existing item to resolve before the release --acceptance gate.

## Canon / boundary

Application of Parts 3/5/9/10/12 (decision gate, evidence-by-context, memory locality, conversation-as-
product, Voice Signature). No canon amendment (does not touch the entry-31 self-binding clause).
Part 8 LOCAL. No em-dashes.
