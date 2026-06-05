---
phase: 141
slug: local-retrieval-spine-and-capability-dial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 141 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node CJS test scripts (`tests/test-*.cjs`) + per-phase bash runner |
| **Config file** | none - `tests/run-all-141.sh` aggregates the CJS suites (mirror `tests/run-all-126.sh`) |
| **Quick run command** | `node tests/test-<suite>.cjs` |
| **Full suite command** | `bash tests/run-all-141.sh` |
| **Estimated runtime** | ~30-60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the single suite for that task (e.g. `node tests/test-get-room-context.cjs`)
- **After every plan wave:** Run `bash tests/run-all-141.sh`
- **Before `/gsd:verify-work`:** Full `run-all-141.sh` must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| RETR-01 | 3-leg fusion returns {summary, recentMessages, relevantNodes} from a fixture room.db | unit | `node tests/test-get-room-context.cjs` | ❌ W0 | ⬜ pending |
| RETR-02 | per-turn path forwards a conversation seed (not null) into LOCAL retrieval only | unit | `node tests/test-retrieval-seed.cjs` | ❌ W0 | ⬜ pending |
| RETR-03 | getRoomContext output is RAW prose, ZERO sha256/hash; no packet.cjs require | unit (adversarial) | `node tests/test-room-context-part8-invariant.cjs` | ❌ W0 | ⬜ pending |
| RETR-04 | per-turn assembly under 1200ms on a populated fixture room.db | perf/bench | `node tests/test-room-context-latency.cjs` | ❌ W0 | ⬜ pending |
| LARRY-01 | dial section in HEAD; canon_parts frontmatter present; CHANGELOG entry present | smoke | `node tests/test-capability-dial-committed.cjs` | ❌ W0 | ⬜ pending |
| LARRY-02 | version bumped (beta.7) with the dial as a release-noted change | smoke | `node tests/test-capability-dial-committed.cjs` | ❌ W0 | ⬜ pending |
| LARRY-03 | reach bank covers EXACTLY 5 ids {context_block, contradiction, cross_room, brain_consult, deep_research} | drift (adversarial) | `node tests/test-reach-ids-drift.cjs` | ❌ W0 | ⬜ pending |
| LARRY-04 | doctrine section present (Usher division + quotes); posture bank covers EXACTLY 3 ids {push_forward, hold, pull_back} | drift (adversarial) | `node tests/test-posture-ids-drift.cjs` | ❌ W0 | ⬜ pending |
| DRSCH-01..04 | deep-research dial row + reach rule 6 present (doctrine-only) | smoke | `node tests/test-capability-dial-committed.cjs` | ❌ W0 | ⬜ pending |
| FILEVAL-02 | read-back-validation wrapper over writeEvidenceClaim; artifact_path field present; surfaces a failed filing | unit (fixture) | `node tests/test-fileval-readback.cjs` | ❌ W0 | ⬜ pending |
| BUG-01 | build-graph exits 0 against a no-room-db dir (guard reaches graceful path) | regression | `node tests/test-build-graph-guard.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-141.sh` - scoped runner (mirror `tests/run-all-126.sh` header + CJS_SUITES list)
- [ ] `tests/test-get-room-context.cjs` - RETR-01 fusion shape + raw-prose assertion
- [ ] `tests/test-retrieval-seed.cjs` - RETR-02 seed wiring (LOCAL-only fence)
- [ ] `tests/test-room-context-part8-invariant.cjs` - RETR-03 adversarial forbidden-substring sweep (mirror Phase 90 / 110-05 / 124 idiom)
- [ ] `tests/test-room-context-latency.cjs` - RETR-04 1200ms budget on a populated fixture
- [ ] `tests/test-capability-dial-committed.cjs` - LARRY-01/02 + DRSCH doctrine (HEAD + frontmatter + CHANGELOG)
- [ ] `tests/test-reach-ids-drift.cjs` - LARRY-03 exact-5 reach-id drift test
- [ ] `tests/test-posture-ids-drift.cjs` - LARRY-04 exact-3 posture-id drift test
- [ ] `tests/test-fileval-readback.cjs` - FILEVAL-02 read-back wrapper + artifact_path, fixture-based
- [ ] `tests/test-build-graph-guard.cjs` - BUG-01 exit-0 regression
- [ ] A populated fixture room.db (fragments + nodes + edges) under `tests/fixtures/`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The dial doctrine reads coherently in Larry's voice and quotes Aronhime correctly | LARRY-01, LARRY-04 | Prose quality is not machine-assertable beyond presence checks | Read the committed SKILL.md dial + Hierarchical Navigator section; confirm the Usher division, the 3 quotes, and Reach rule 7 read coherently |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
