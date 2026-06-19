---
phase: 169
slug: graph-derivation-harness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 169 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 169-RESEARCH.md "## Validation Architecture". Harness-as-code: the Verify wave owns the adversarial structured verdict + the phase gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in (`node:test` / bare `assert` CJS); repo convention is `tests/run-all-<phase>.sh` aggregator + `tests/test-*.cjs` |
| **Config file** | none — self-contained CJS scripts |
| **Quick run command** | `node tests/test-doc-text-extractor.cjs` (single file) |
| **Full suite command** | `bash tests/run-all-169.sh` |
| **Estimated runtime** | ~30-60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-<module>.cjs` for the module touched
- **After every plan wave:** Run `bash tests/run-all-169.sh`
- **Before `/gsd-verify-work`:** Full 169 suite green + carried Phase 168 floor test green + Part 8 boundary scan returning 0 forbidden matches + the real-b2 manual-verify gate captured (see Manual-Only Verifications)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| GDH-01 | `.room-root` resolver returns the SUB-ROOM db for a file inside a sub-room while parent is active | unit | `node tests/test-room-root-resolver.cjs` | ❌ W0 | ⬜ pending |
| GDH-02 | Stop sweep ENQUEUES a derive request; SessionStart drain DRAINS it (round-trip); per-write structural index unaffected | unit | `node tests/test-graph-derive-sweep.cjs` | ❌ W0 | ⬜ pending |
| GDH-03 | rebuildGraph recurses sub-rooms + a ROOT-FILES pass; parent rollup sees sub-room edges via read-side ATTACH | integration | `node tests/test-subroom-rollup.cjs` | ❌ W0 | ⬜ pending |
| GDH-04 | extractDocxText returns >0 runs for the b2 fixture; .html via cheerio; source byte-unchanged | unit | `node tests/test-doc-text-extractor.cjs` | ❌ W0 | ⬜ pending |
| GDH-05 (producer) | the LLM candidate PRODUCER (produceCandidates) emits BOTH a CONTRADICTS AND a CONVERGES candidate from artifact-pair text, frozen-cascade-subset only, no Brain call (D-169-06) | unit | `node tests/test-candidate-producer.cjs` | ❌ W0 | ⬜ pending |
| GDH-05 (loop) | runDerivation drives the producer via deriveFn, bridges via candidateToFinding, writes a proposed NODE + typed edge via navigation.writeEdge; fable-mode rejects a bad CONTRADICTS | integration | `node tests/test-graph-derivation-loop.cjs` | ❌ W0 | ⬜ pending |
| GDH-06 | `/mos:graph --derive` on the b2 fixture takes typed-edge count 0 → N (THE acceptance fixture; real-b2 non-skippable when present, synthetic fallback only when absent) | acceptance | `node tests/test-derive-backfill-acceptance.cjs` | ❌ W0 | ⬜ pending |
| GDH-07 | re-run is a no-op: no duplicate proposed nodes; confirmed edges untouched | integration | `node tests/test-derive-idempotence.cjs` | ❌ W0 | ⬜ pending |
| MEDIUM-4 | no derivation-owned cascade edge type (CONTRADICTS/INFORMS/ENABLES/INVALIDATES) is raw-INSERTed in the indexer path; derivation is the sole cascade writer (D-169-08) | adversarial | covered by `node tests/test-graph-derivation-verdict.cjs` (MEDIUM-4 check) | ❌ W0 | ⬜ pending |
| Part 8 | boundary scan: no user bytes reach Brain in graph-derivation.cjs + graph-candidate-producer.cjs + the sweep + drain hooks + brain-derive | adversarial | `node tests/test-169-brain-boundary.cjs` (forbidden-substring sweep, Phase 90 5-tripwire pattern) | ❌ W0 | ⬜ pending |
| Part 4/9 | every derived edge type is in ALLOWED_EDGE_TYPES (frozen-set floor) | unit | extend `tests/test-edges-part4-cascade-floor.cjs` (Phase 168) | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-169.sh` — the phase aggregator (none exists yet)
- [ ] `tests/test-doc-text-extractor.cjs` — GDH-04 (b2 fixture + a tiny stored-method .docx)
- [ ] `tests/test-room-root-resolver.cjs` — GDH-01
- [ ] `tests/test-subroom-rollup.cjs` — GDH-03 (two temp room.db files, ATTACH, UNION)
- [ ] `tests/test-candidate-producer.cjs` — GDH-05 producer (stub llm; both CONTRADICTS + CONVERGES; D-169-06)
- [ ] `tests/test-graph-derivation-loop.cjs` — GDH-05 loop (stub deriveFn/selfCritiqueFn; candidateToFinding)
- [ ] `tests/test-derive-idempotence.cjs` — GDH-07
- [ ] `tests/test-derive-backfill-acceptance.cjs` — GDH-06 (the b2 0 → N count)
- [ ] `tests/test-graph-derive-sweep.cjs` — GDH-02 enqueue-then-drain round-trip (created Plan 05; MEDIUM-5)
- [ ] `tests/test-169-brain-boundary.cjs` — Part 8 adversarial sweep
- [ ] `tests/test-graph-derivation-verdict.cjs` — the adversarial structured `{passed, findings[]}` verdict (harness-as-code property 6; mirror Phase 166 W8 / 163 W6 / 167 Plan 05) + the MEDIUM-4 sole-cascade-writer check + the real-b2 0 → N proof

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real b2 fixture, typed-edge count before/after captured | GDH-06 | The real b2 path exists only on the dogfood/maintainer box; CI uses the synthetic fallback. The verdict runs the real-b2 0 → N NON-SKIPPABLY when the fixture is present, but the captured count + edge types must be reviewed before the phase closes | Before `/gsd-verify-work` closes the phase, on the dogfood box run `node tests/test-graph-derivation-verdict.cjs` with the b2 fixture present; confirm the SUMMARY records the actual N (typed-edge count after the backfill) + the derived edge types; assert N > 0 against the SEED-034 baseline of 0 (D-169-08) |
| Live Stop-hook fire + SessionStart drain on a real session (debounced sweep enqueues, drain runs derivation) | GDH-02 | Hook fire is a Claude Code runtime event; the unit test covers the enqueue-then-drain round-trip, not the live hook trigger | After execute, end a session in a room with new artifacts; confirm a derive request was enqueued, then start a new session and confirm the SessionStart drain ran derivation and cleared the queue |
| Desktop/Cowork surfaces (no Stop hook) reach derivation via `/mos:graph --derive` backfill | GDH-06 | Desktop/Cowork have no PostToolUse/Stop hooks | Run `/mos:graph --derive` on Desktop; confirm the backfill is the universal net |

---

## Security Domain (Canon Part 8 dominant)

| ASVS / Pattern | Applies | Control |
|----------------|---------|---------|
| V5 Input Validation | yes | The .docx/.html extractor parses attacker-influenceable bytes — cap ZIP entry count, cap inflated size (zip-bomb guard via `inflateRawSync` size cap ~10MB), never eval/exec content, treat extracted text as data only |
| Part 8 breach (user .docx bytes → Brain) | yes | Boundary scan over graph-derivation.cjs + graph-candidate-producer.cjs (the LLM producer reads LOCAL text only) + the sweep + drain hooks + brain-derive-command.cjs; the LOCAL derivers + the LLM producer never touch the wire; Brain queries carry only generic handles/enums |
| Room-boundary leak (cross-room ATTACH) | yes | Read-side ATTACH only; NEVER copy sub-room rows into the parent db; cross-room typed edges stay deferred (Phase 83) |
| Bad CONTRADICTS misleads navigator | yes | fable-mode selfCritiqueFn rejects unjustified edges; every derived edge lands as a PROPOSED node; human confirms (Part 3/9) |
| Chokepoint bypass (raw SQL) | yes | The legacy raw-SQL cascade in lazygraph-ops _indexArtifactBody is DISABLED (D-169-08) so derivation via navigation.writeEdge is the sole cascade writer; the Phase 109 pre-commit substrate guard rejects a new direct room-db require outside the allow-list; the verdict's MEDIUM-4 check asserts no raw cascade INSERT remains |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] The real-b2 manual-verify gate (GDH-06) is captured before phase close (D-169-08)
- [ ] `nyquist_compliant: true` set in frontmatter (set by the planner once every task maps to a test)

**Approval:** pending
