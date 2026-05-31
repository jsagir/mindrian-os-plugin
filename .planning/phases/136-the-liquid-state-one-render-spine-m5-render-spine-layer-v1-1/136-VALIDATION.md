---
phase: 136
slug: the-liquid-state-one-render-spine-m5-render-spine-layer-v1-1
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 136 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 136-RESEARCH.md "Validation Architecture" (requirement-level). Task IDs are filled by the planner; the per-requirement test map below is the binding source for the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) - `const test = require('node:test')` / `describe/it` |
| **Config file** | none - tests are `tests/136-*.test.cjs` + a per-phase `tests/run-all-136.sh` harness |
| **Quick run command** | `node --test tests/136-*.test.cjs` |
| **Full suite command** | `bash tests/run-all-136.sh` (create in Wave 0, mirror `tests/run-all-121.5.sh`) |
| **Estimated runtime** | ~60 seconds (full suite, excluding tmux-present integration) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/136-<touched-area>.test.cjs` (< 30s) + `node scripts/check-substrate.cjs --diff`
- **After every plan wave:** Run `bash tests/run-all-136.sh`
- **Before `/gsd:verify-work`:** Full 136 suite green + `brain-boundary-scan` clean + the vendoring native-addon grep empty
- **Max feedback latency:** 30 seconds (quick), 60 seconds (full)

---

## Per-Requirement Verification Map

> The planner maps each Plan/Task to a Requirement row below. The per-task map (Task ID | Plan | Wave) is populated during planning; the test + assertion column is binding now.

| Req | Behavior | Test Type | Automated Command / Assertion | File Exists | Status |
|-----|----------|-----------|-------------------------------|-------------|--------|
| Req 1 | every (shape x delivery) renders; no legacy render body remains | unit + grep | `node --test tests/136-engine-shapes.test.cjs` + `grep -L 'render --shape' commands/{dashboard,wiki,present,publish,export,visualize,snapshot}.md` (no inline render body) | ❌ W0 | ⬜ pending |
| Req 2 | inline spawns zero processes; web reuses existing express; both work with ink absent | integration | `node --test tests/136-seamless-no-ink.test.cjs` (rm-ink fixture; inline child_process count == 0; web binds wiki-server app) | ❌ W0 | ⬜ pending |
| Req 3 | zero direct sqlite opens outside core; identical state across inline/web/sim-tui; concurrency clean | grep + integration | `node scripts/check-substrate.cjs --baseline` + `node --test tests/136-thin-clients-converge.test.cjs` + concurrent read+write loop asserts no SQLITE_BUSY | ❌ W0 | ⬜ pending |
| Req 4 | tui arrow-navigates + restores terminal; works with ink absent; zero native addons | integration + release-gate | `node --test tests/136-tui-boot.test.cjs` (boot + simulated input + clean exit) + `find node_modules -iregex '.*\.\(node\|wasm\|gyp\)$'` empty | ❌ W0 | ⬜ pending |
| Req 5 | launcher composes workspace with tmux; routes otherwise; tmux focus -> memory_event | integration | `node --test tests/136-launcher-detect.test.cjs` (env-var matrix asserts probe order) + tmux-present harness asserts focus_changed row after window-switch | ❌ W0 | ⬜ pending |
| Req 6 | toggle 2 options + free-text -> 3 writes (2 DECISION + 1 FREE_TEXT) via navigation.cjs; preview before confirm; one fan-out event | unit | `node --test tests/136-gate-write-node.test.cjs` (exactly 3 edges via writeEdge; preview reflects pending; one fan-out event) | ❌ W0 | ⬜ pending |
| Req 7 | linter fails on planted hardcoded hex/glyph, passes on engine; semantic pairs pass contrast; 4 glyphs in vocab | unit | `node --test tests/136-token-linter.test.cjs` (planted-violation fails; engine passes) + WCAG contrast assertion (3:1 UI / 4.5:1 text) per pair | ❌ W0 | ⬜ pending |
| Req 8 | 4+ levels render; zoom re-roots + writes focus event; bud -> registered sub-room; cross-wall edge shows, tree order byte-identical | unit + integration | `node --test tests/136-fractal.test.cjs` (focus_changed after zoom; sub-room registered after bud; tree-order snapshot byte-identical) | ❌ W0 | ⬜ pending |
| Req 9 | injecting a suggestion leaves tree order byte-identical; slot silent when nothing relevant changed | unit | `node --test tests/136-lazygraph-overlay.test.cjs` (byte-identical tree snapshot; empty slot on no-change) | ❌ W0 | ⬜ pending |
| Req 10 | a seeded CONTRADICTS edge produces a visible edge AND a sentence in one render | unit | `node --test tests/136-dual-render.test.cjs` | ❌ W0 | ⬜ pending |
| Req 11 | inline + web pass on Win/Mac/Linux; no native addon; Node 22+ floor pinned; launcher platform-routes | grep + matrix | vendoring grep (Req 4) + `grep '"node": ">=22' package.json` + launcher detect matrix (Req 5) | ⚠️ partial (floor exists) | ⬜ pending |
| Req 12 | brain-boundary-scan passes on new files; zero direct sqlite opens outside core | grep | `brain-boundary-scan` on new files + `node scripts/check-substrate.cjs --diff` on staged | ⚠️ partial (gates exist) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-136.sh` - the phase harness (mirror `tests/run-all-121.5.sh`)
- [ ] `tests/136-seamless-no-ink.test.cjs` - the ink-absent seamless-base guard (Req 2 / Req 4, load-bearing)
- [ ] `tests/136-thin-clients-converge.test.cjs` + a concurrency loop (Req 3)
- [ ] `tests/fixtures/136-seeded-room/` - a 4+-level seeded room.db with a CONTRADICTS edge (Req 8 / Req 10)
- [ ] Confirm the SEED-001 BUD callable target (RESEARCH Open Question 1 / A3) before the fractal wave
- [ ] Add the vendoring native-addon grep as a `release.sh` Step 6.7 assertion (Req 4 / Req 11)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| tmux focus-hook fires a `focus_changed` event on a live multiplexer | Req 5 | CI runners lack tmux; hook firing (RESEARCH A4) not live-tested | On a machine with tmux: launch `mos` workspace, switch windows, assert a `focus_changed` row appears in the event log |
| inline + web render identically on native Windows | Req 11 | no Windows CI; Windows testers in the loop (beta.32/36 path fixes) | Windows tester runs inline + web twin on a seeded room; confirms parity + correct launcher routing (WezTerm/mprocs/web) |
| `mos tui` renders + restores the terminal cleanly across real terminals | Req 4 | terminal restore is environment-sensitive | Launch `mos tui`, arrow-navigate, quit with `q`; confirm shell prompt restored, no escape-sequence residue |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
