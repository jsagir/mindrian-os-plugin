---
phase: 360
slug: room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-23
---

# Phase 360 - Validation Strategy

> This file is the per-phase validation contract. Its source is the "Validation Architecture" section of
> 360-RESEARCH.md, copied verbatim below. The phase depends on 357: `turn-text` 'harness' class,
> `run-all-357.sh` and the 357 replay baseline.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with `node:assert` plus bash aggregators (repo convention) |
| Config file | none; `tests/run-all-360.sh` is the aggregator (Wave 0) |
| Quick run command | `node tests/test-360-leads.cjs && node tests/test-360-harness-picker.cjs </dev/null` |
| Full suite command | `bash tests/run-all-360.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIND360-01 | Harness prompt in an unbound scoring session emits no room-resolution output and makes no side writes; the human control fires | integration (spawn) | `node tests/test-360-harness-picker.cjs --only r1` | no - Wave 0 |
| BIND360-02 | Harness turn does not invoke the binding consumer (spy: 1 call pre, 0 post); a following exact-label human turn binds | integration (spawn + preload spy) | `node tests/test-360-harness-picker.cjs --only r2` | no - Wave 0 |
| BIND360-03 | Human-origin fixture stdout byte-identical: `PLAN_BASE` archive vs HEAD; R3 suites no worse than baseline | integration + suite compare | `node tests/test-360-harness-picker.cjs --only r3 && bash tests/run-all-360.sh --r3-compare` | no - Wave 0 |
| BIND360-04 | No lead literal / `isMeta` comparison in intent-classifier; leads defined in exactly one file | static tripwire | `node tests/test-360-tripwire.cjs --only r4` | no - Wave 0 |
| BIND360-05 | 5 leads (plus both peer framing variants) return harness; a mid-text quote returns non-harness; Skill body returns typed; 357 replay still green | unit + replay | `node tests/test-360-leads.cjs && bash tests/run-all-357.sh` | no - Wave 0 (357 runner from 357) |
| BIND360-06 | Throwing export and missing export: the human turn fires unchanged, exit 0 | integration (preload) | `node tests/test-360-harness-picker.cjs --only r6` | no - Wave 0 |
| BIND360-07 | Snapshot replay: unbound harness 33 -> 0, human 2 -> 2, 0 human with a harness verdict; SKIP when absent | local replay | `node tests/test-360-snapshot-replay.cjs` | no - Wave 0 |
| BIND360-08 | Fixtures carry `sanitization_statement`; 0 hits for snapshot UUIDs, `uds:/run/user`, real peer names; no `.jsonl` added | static grep | `node tests/test-360-tripwire.cjs --only r8` | no - Wave 0 |
| BIND360-09 | No `lib/mcp/` path in 360's own commits; four MCP room-bind suites green | static + suites | `node tests/test-360-tripwire.cjs --only r9 && node tests/test-248-room-bind-honest-return.cjs` (plus the other 3) | partial (MCP suites exist) |

All legs run under 30 s except the R3 compare (about 15 s total, dominated by `userpromptsubmit-integration` at 11.7 s).

### Sampling Rate
- **Per task commit:** the quick run command, plus `node tests/test-360-tripwire.cjs`.
- **Per wave merge:** `bash tests/run-all-360.sh`.
- **Phase gate:** full suite green (known reds unchanged) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] 357 dependency halt check (D-19, plus Pitfall 1 additions)
- [ ] Record `PLAN_BASE` and the R3 baseline counts (isolated env), in the first SUMMARY
- [ ] `tests/fixtures/ups-harness-360/cases.json` plus the three preload stubs
- [ ] `tests/test-360-leads.cjs`, `tests/test-360-harness-picker.cjs`, `tests/test-360-tripwire.cjs`, `tests/test-360-snapshot-replay.cjs` (RED where applicable; R2 RED is the spy leg)
- [ ] `tests/run-all-360.sh` with isolated `HOME` for every leg


## Manual-Only Verifications

All phase behaviors have automated verification. BIND360-07 runs locally only and SKIPs when the snapshot is
absent.

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
