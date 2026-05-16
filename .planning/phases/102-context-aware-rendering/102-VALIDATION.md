---
phase: 102
slug: context-aware-rendering
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-30
verified: 2026-05-16
verified_by: phase-121.5-04-subplan-e
---

# Phase 102 -- Validation Strategy

> Flipped out of `status: draft / nyquist_compliant: false` by Phase 121.5-04
> Sub-plan E. The per-task verification map below holds; the renderer's
> import-surface byte-stability fence (RENDER-102-06) holds; render-v2's
> disposition is recorded at `lib/render/ROOM.md` and verified at
> `102-VERIFICATION.md`.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node.js IIFE (Phase 100 inheritance) |
| Quick run | `node tests/test-render-v2-signature.cjs` |
| Phase 102 suite | `for t in tests/test-render-v2*.cjs; do node "$t" || break; done` |
| Disposition gate | `node lib/memory/render-v2-disposition.test.cjs` (Phase 121.5-04 addition) |
| Operator audit | `node scripts/disposition-render-v2.cjs --json` (Phase 121.5-04 addition) |
| Estimated runtime | ~5s for the 5 Phase 102 tests + ~1s for the disposition gate |
| Isolation | `MINDRIAN_ROOMS_HOME` env override |
| Registry | `lib/memory/run-feynman-tests.cjs` |

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test | Command | Status |
|------|------|------|-------------|------|---------|--------|
| 102-00-T1 | 102-00 | 0 | REQUIREMENTS HMI-102-01..06 registered + JTBD-PALETTES.md skeleton | structural | `grep -c "HMI-102-0[1-6]" .planning/REQUIREMENTS.md` returns 12 | ✓ |
| 102-00-T2 | 102-00 | 0 | STATE.md row + 5 Wave-0 test stubs + JTBD-PALETTES.md skeleton | structural | `ls tests/test-render-v2*.cjs | wc -l` returns 5 + `test -f lib/render/JTBD-PALETTES.md` | ✓ |
| 102-01-T1 | 102-01 | 1 | render-v2 module + composeZones with footer-shape contract | unit | inline node verify + smoke render | ✓ |
| 102-01-T2 | 102-01 | 1 | render.cjs v1 shim returns string | regression | inline node verify | ✓ |
| 102-01-T3 | 102-01 | 1 | tests/test-render-v2-signature.cjs full suite passes (5 assertions) | unit | `node tests/test-render-v2-signature.cjs` | ✓ |
| 102-02-T1 | 102-02 | 2 | compaction wired into render-v2 (isCompact + applyCompaction helpers) | unit | inline node verify with CLAUDE_CONTEXT_USED_PCT=85 | ✓ |
| 102-02-T2 | 102-02 | 2 | tests/test-render-v2-compaction.cjs full suite passes (8 assertions) | unit | `node tests/test-render-v2-compaction.cjs` | ✓ |
| 102-03-T1 | 102-03 | 2 | JTBD-aware Zone 4 wired (BUILD_ROOM-with-null-jtbd canonical-10 fallback included; JUST_TALK + METHODOLOGY suppression; footer.rendered contract honored) | unit | inline node verify | ✓ |
| 102-03-T2 | 102-03 | 2 | tests/test-render-v2-jtbd-zone4.cjs full suite passes (6 assertions) | unit | `node tests/test-render-v2-jtbd-zone4.cjs` | ✓ |
| 102-04-T1 | 102-04 | 2 | provenance enrichment + Mode B prefix wired (LOCAL-side jtbd add; prefix dedup; 0.7 confidence gate; Canon Part 8 source grep returns 0) | unit | inline node verify + grep audit | ✓ |
| 102-04-T2 | 102-04 | 2 | tests/test-render-v2-provenance.cjs full suite passes (7 assertions incl. part8 audit) | unit | `node tests/test-render-v2-provenance.cjs` | ✓ |
| 102-05-T1 | 102-05 | 2 | CLI color overlay wired (Zone 1 accent per JTBD; TTY gate; compact drops) | unit | inline node verify | ✓ |
| 102-05-T2 | 102-05 | 2 | lib/render/JTBD-PALETTES.md filled with CLI + Mondrian dual-palette tables (13 JTBDs each) | structural | `grep -c "Mondrian" lib/render/JTBD-PALETTES.md` >= 1 + 13-JTBD coverage check | ✓ |
| 102-05-T3 | 102-05 | 2 | tests/test-render-v2-color-overlay.cjs full suite passes (6 assertions incl. palette_complete) | unit | `node tests/test-render-v2-color-overlay.cjs` | ✓ |
| 121.5-04-T1 | 121.5-04 | E | Disposition CI gate registered; verdict HOLDS | unit | `node lib/memory/render-v2-disposition.test.cjs` | ✓ |
| 121.5-04-T2 | 121.5-04 | E | Disposition audit script reports HOLDS | structural | `node scripts/disposition-render-v2.cjs --json` returns verdict HOLDS | ✓ |

*Status: ⬜ pending · ✓ green · ⚠ red · ⚡ flaky*

**Nyquist check:** 16 task rows (14 Phase 102 + 2 Sub-plan E closure). No 3 consecutive without automated verify. ✓

## Wave 0 Stubs (shipped)

- [x] `tests/test-render-v2-signature.cjs`
- [x] `tests/test-render-v2-compaction.cjs`
- [x] `tests/test-render-v2-jtbd-zone4.cjs`
- [x] `tests/test-render-v2-provenance.cjs`
- [x] `tests/test-render-v2-color-overlay.cjs`
- [x] Registration in `lib/memory/run-feynman-tests.cjs`
- [x] `lib/memory/render-v2-disposition.test.cjs` (Phase 121.5-04 addition)

## Manual-Only

| Behavior | Why | How |
|----------|-----|-----|
| Compaction visual at 80% boundary | Visual conformance | Run a real `/mos:doctor` or `/mos:status` invocation with context filled to 85% (paste a long file into a prior turn). Verify Zone 1 collapses to single line, Zone 2 truncates with `... <N more rows>`, Zone 4 has 2 verbs. |
| Zone 1 left-rail accent visual | Visual; ANSI color rendering depends on terminal | Set JTBD = `find-bottleneck` (red), run any command. Verify a colored ■ at start of Zone 1 header. Switch to JTBD = `prepare-pitch` (green); verify color shift. |
| Mondrian palette on HTML surfaces (D-06b deferred to downstream phases) | HTML rendering -- no Phase 102 surface | Documented for Phase 19 (wiki-dashboard), Phase 25 (export), Phase 30 (presentation). |

## Sign-Off

- [x] All tasks have automated verify or Wave 0 dependency
- [x] No 3 consecutive tasks without automated
- [x] Wave 0 covers 5 missing tests + disposition gate
- [x] No watch flags
- [x] Latency < 5s suite
- [x] Canon Part 8 audit (Brain never sees JTBD): zero matches in test
- [x] `nyquist_compliant: true` set (Sub-plan E execution wave, 2026-05-16)

**Approval:** verified by Phase 121.5-04 Sub-plan E (the v1.13.0 terminal coherence capstone's render-v2 disposition + Phase 102 closure work). See `102-VERIFICATION.md` for the verification record + canon compliance.
