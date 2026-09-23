---
phase: 359
slug: missed-fork-detection-larry-poses-a-genuine-decision-in-pros
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-23
---

# Phase 359 - Validation Strategy

> This is the per-phase validation contract, taken verbatim from the 359-RESEARCH.md "Validation Architecture"
> section. Navigator rulings N-3 to N-6 in 359-CONTEXT take precedence: the moonshot `What if` last label,
> the R9 fallback and vacuity floor, and Sonnet 5.


### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with `node:assert/strict` plus bash `run_if` runners (repo convention; no jest/vitest) |
| Config file | none; runners are `tests/run-all-<phase>.sh` |
| Quick run command | `node tests/test-359-fork-declaration.cjs && node tests/test-359-declared-arm.cjs` |
| Full suite command | `bash tests/run-all-359.sh && bash tests/run-all-238.sh && bash tests/run-all-357.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORK359-01 | fixture exists; >= 15/15 floors; every `prose_fork:true` has >= 2 `fork_labels`; the source is opt-in; labeler refuses dogfood (357 L1 still green) | unit | `node tests/test-359-corpus.cjs && node tests/test-357-labeler-refusal.cjs` | no, Wave 0 (357 file lands in 357-04) |
| FORK359-02 | pre-359 `fork359.missed_forks` == count of `prose_fork:true` entries; `baseline-359.json` written | integration (replay) | `node scripts/replay-card-fire.cjs --code-root git:$(node -p "require('./tests/fixtures/card-fire-replay/baseline-359.json').meta.pre_phase_sha") --source synthetic-359 --fork359 --json` then assert in `tests/test-359-replay.cjs` L1 | no, Wave 0 |
| FORK359-03 | parser valid 2/5 labels; not-last; 1 label; 6 labels; over-cap; glyph; bracket; type-1-2-3; empty and non-string; no throw; zero network (fetch stubbed to throw) | unit | `node tests/test-359-fork-declaration.cjs` | no, Wave 0 |
| FORK359-04 | legs: declared+no card -> `declared-fork-no-card`; +card -> `card-fired`; yes/no -> `gate-is-simple-binary`; retry ceiling / session ceiling -> degrade with exact strings; D-07 stale-PRIMARY + declaration -> declared; key suffix only when declared; stale declaration before the last user record -> not declared | unit | `node tests/test-359-declared-arm.cjs` | no, Wave 0 |
| FORK359-05 | 357 corpus `--surface both --baseline compare`: 0 class diffs, false_blocks 0, new_misses 0; regex literal byte identity; `classifyCardFire` source tripwire | integration + static | `node scripts/replay-card-fire.cjs --surface both --baseline compare --json` (exit 0) + `node tests/test-359-declared-arm.cjs --tripwires` | no, Wave 0 |
| FORK359-06 | declared_catch_rate 100% (yes/no reported separately); control_false_blocks 0; declared-variant missed_forks 0 | integration | `node scripts/replay-card-fire.cjs --source synthetic-359 --fork359 --surface both --json` asserted by `tests/test-359-replay.cjs` L2 | no, Wave 0 |
| FORK359-07 | CLI/MCP class parity on R5+R6 entries; MCP `rendered` options == `declared_labels`; two declared forks in one MCP session both fire | integration | `node tests/test-359-replay.cjs` (L3, L4) | no, Wave 0 |
| FORK359-08 | net bytes <= 400 across 4 surfaces; doctrine < 900 raw; MCP <= 2000; pinned phrases present; D-05 drift (prefix + separator literal on all 4 surfaces); manifest check | static | `node tests/test-359-prose-budget.cjs && node tests/test-251-skeleton-split.cjs && node lib/mcp/no-instructions.test.cjs && node tests/test-gate-native-fire-w1.cjs && node tests/test-larry-voice-mark-182.cjs && node tests/test-205-voice-mark-hybrid.cjs && node tests/test-larry-handoff-seam.cjs && node scripts/build-harness-manifest.cjs --check` | no, Wave 0 (others exist) |
| FORK359-09 | forward run: post misses <= 50% of pre (with the floor), 0 control blocks, or recorded falsification | manual-only (paid, nondeterministic, navigator-gated) | `node scripts/forward-fork-scenarios-359.cjs --arm pre --smoke` then the full batch; not in CI | no, Wave 0 |
| FORK359-10 | standing gate wired; M1 (arm removed) and M2 (free-text regex) each fail; R9 script and probe not imported from `lib/`/`hooks/`; `grep -r api.typesafe.ai lib/ hooks/` empty | integration + static | `node tests/test-359-replay.cjs --mutation && node tests/test-359-devonly-tripwire.cjs && bash tests/run-all-359.sh` | no, Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run command plus the specific leg for the requirement touched.
- **Per wave merge:** `bash tests/run-all-359.sh` plus `node scripts/replay-card-fire.cjs --surface both --baseline compare`.
- **Phase gate:** `bash tests/run-all-359.sh && bash tests/run-all-238.sh && bash tests/run-all-357.sh && bash tests/run-all-251.sh && node scripts/build-harness-manifest.cjs --check`. Known pre-existing reds in 179/209/238/relevance-gate are recorded per 357 R-J, not fixed. R9 results go in the SUMMARY.

### Wave 0 Gaps
- [ ] `tests/test-359-fork-declaration.cjs`: covers FORK359-03 (and the D-05 drift leg once R8 lands)
- [ ] `tests/test-359-declared-arm.cjs`: FORK359-04, FORK359-05 tripwires
- [ ] `tests/test-359-corpus.cjs`: FORK359-01
- [ ] `tests/test-359-replay.cjs` (with `--mutation`): FORK359-02, -06, -07, -10
- [ ] `tests/test-359-prose-budget.cjs`: FORK359-08
- [ ] `tests/test-359-devonly-tripwire.cjs`: FORK359-10 (R9 script and probe not required from `lib/`/`hooks/`; no `api.typesafe.ai` under `lib/`/`hooks/`)
- [ ] `tests/run-all-359.sh` plus one `run_if` leg appended to `tests/run-all-238.sh`
- [ ] Framework install: none


## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paid forward run | R9 | It is paid, capped at $60 (Sonnet 5) and gated by the navigator | A smoke run first, then the full run; if it is below the vacuity floor, record INCONCLUSIVE |
| Moonshot quality | N-3 | Scored by Jev at dev time on synthetic scenario text only | Review the relevant/radical Score distribution in the R9 report |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
