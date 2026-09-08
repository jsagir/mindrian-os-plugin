---
phase: 298
slug: seed-032-harness-as-code-declare-and-machine-enforce-the-min
status: final
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-07
---

# Phase 298 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `298-RESEARCH.md` section "Validation Architecture" (requirement-to-proof table) plus the LangTalks grounding takeaways 4 and 5 (producer/critic separation; error classes decide exits).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None by design. Plain `node` scripts under `tests/`, using `node:assert/strict` or the local `record(name, fn)` counter; exit 0 pass / exit 1 fail |
| **Config file** | none - Wave 0 creates `tests/run-all-298.sh` from `tests/run-all-201.sh` (the `run_if <label> <guard-file> <cmd>` idiom, so a partially-landed phase exits with SKIPs, not FAILs) |
| **Quick run command** | `node tests/test-298-<name>.cjs` (the single owning test for the task) |
| **Full suite command** | `bash tests/run-all-298.sh` |
| **Estimated runtime** | not yet measured; the analog `bash tests/run-all-201.sh` is the reference once Wave 0 lands |

---

## Sampling Rate

- **After every task commit:** Run the task's owning `node tests/test-298-<name>.cjs`, then `node scripts/build-harness-manifest.cjs --check`, then confirm `git status --porcelain` is empty
- **After every plan wave:** Run `bash tests/run-all-298.sh`, `bash tests/run-all-167.sh`, `bash tests/run-all-201.sh`, `node lib/mcp/no-instructions.test.cjs`
- **Before `/gsd-verify-work`:** `node scripts/doctor.cjs --acceptance --pre-tag` green, `scripts/verify-release` green, and the pre-existing red-test baseline (captured before any edit) unchanged
- **Max feedback latency:** bounded by the single owning test per task; the full suite runs only at wave boundaries

---

## Per-Task Verification Map

Task IDs are assigned by the planner; the rows below are the requirement-level proofs every task must map onto. The executor fills the Task ID and Plan columns and flips Status as each lands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-298-01 | 298-12 | 1 | R-01 manifest v2 keys | T-298-01 | generated JSON only; no code execution from manifest data | unit | `node tests/test-201-harness-manifest.cjs` (extended: 8 top-level keys in order, `maps.length === 3`) then `node scripts/build-harness-manifest.cjs && git status --porcelain data/harness-manifest.json` -> empty | extend | green |
| T-298-02 | 298-12 | 1 | R-01 Part 8 allowlist | T-298-02 | allowlist widened by exactly three names, nothing user-bearing | unit | `node tests/test-harness-manifest-part8-boundary.cjs` -> exit 0; `NODE_FIELD_ALLOWLIST.length === 8` | extend | green |
| T-298-03 | 298-09 | 1 | R-02 policy schema | T-298-03 | closed schema; unknown key rejected at `--check` | unit | `node tests/test-298-policies-schema.cjs` -> exit 0; negative temp policy with key `xyz` -> `build-harness-manifest.cjs --check` exit 1 naming file and key | W0 | green |
| T-298-04 | 298-09 | 1 | R-02 gate reachability | T-298-04 | every `runner` path resolves inside the repo root (no traversal) | unit | for each policy `fs.existsSync(path.join(REPO_ROOT, policy.runner))` or `runner === null` declared ghost; zero unintentional ghosts in slice 1 | W0 | green |
| T-298-05 | 298-10 | 1 | R-03 rung ladder | T-298-05 | runner never promotes; `evaluatePromotion` is side-effect free | unit | `['declared','logged','blocking'].includes(p.rung)` for all; `grep -c "rung.*=" scripts/run-harness.cjs` -> 0 assignments; call `evaluatePromotion` twice, log mtime unchanged | W0 | green |
| T-298-06 | 298-10 | 1 | R-04 tiered check | T-298-06 | `--tier` filters strictly by `applies_to` | unit | `node scripts/run-harness.cjs --check --tier pre-tag --json` -> every id's `applies_to` contains `pre-tag` | W0 | green |
| T-298-07 | 298-10 | 1 | R-04 rung exit contract | T-298-07 | `blocking` failure exits 1; `logged` failure exits 0 with one JSONL line | unit | temp policy `runner: node -e "process.exit(1)"` at `logged` -> exit 0 + 1 line; at `blocking` -> exit 1 | W0 | green |
| T-298-08 | 298-11 | 1 | R-04 converged no-op | T-298-08 | runner writes only `<room>/.mindrian/harness-run.json`; second run is byte-identical | integration | `node scripts/run-harness.cjs --room data/harness-fixtures/converged-room` twice -> exit 0, `converged: true`, `git status --porcelain` empty, reports byte-identical | W0 | green |
| T-298-09 | 298-11 | 1 | R-04 read-only door | T-298-09 | runner never opens the write path (D-03a) | unit | after a fixture run `.mindrian` absent under the fixture; `grep -c "openGraph\|openRoomDbForCaller\|room-db.cjs" scripts/run-harness.cjs` -> 0 | W0 | green |
| T-298-10 | 298-06 | 1 | R-05 derive-health | T-298-10 | thin wrapper over `detectRoomHealth()`; no second detector | unit | `node tests/test-298-derive-health.cjs`: throwaway db with BELONGS_TO and zero cascade edges -> `status === 'fail'`, exit 1; fixture -> `status === 'skip'`, exit 0 | W0 | green |
| T-298-11 | 298-11 | 1 | R-05 ghost refusal | T-298-11 | ghost gate is the "missing information" class: refuse `converged: true`, never retry | unit | temp policy dir with `runner: null` for `gate-graph-derive-health` -> report `ghost`, `converged: false` | W0 | green |
| T-298-12 | 298-13 | 1 | R-06 contract parity | T-298-12 | dropped phrase fails `--check` naming surface and phrase | integration | `node tests/test-298-contract-parity.cjs`: delete one pinned phrase from `agents/larry-extended.md` in try-finally -> exit 1; restore -> exit 0 | W0 | green |
| T-298-13 | 298-13 | 1 | R-06 byte budget | T-298-13 | Desktop wire <= 1,950 bytes (reads 1,944 today) | unit | `node -e "const b=Buffer.byteLength(require('./lib/mcp/runtime-instructions.cjs').RUNTIME_INSTRUCTIONS,'utf8'); process.exit(b<=1950?0:1)"` -> exit 0; `node lib/mcp/no-instructions.test.cjs` -> 9/9 | exists | green |
| T-298-14 | 298-13 | 1 | R-06 frozen phrases | T-298-14 | nine frozen-phrase tests unchanged | integration | `test-143.2-doctrine-presence.cjs`, `test-larry-handoff-seam.cjs`, `test-canon-entry-38-sourced-claims-floor.cjs`, `test-gate-native-fire-w1.cjs`, `test-chain-executor-part8-leak.cjs`, `bash tests/test-115-persona-variants.sh`, `bash tests/test-114-substrate-preload.sh` -> exit 0 each; `test-205` and `test-115-surfaces-grep.sh` unchanged-red baseline | exists | green |
| T-298-15 | 298-09 | 1 | R-07 memory-write policy | T-298-15 | policy declares the four channel mappings and `basket_fires_at >= 2`; SKILL carries the phrases the policy names | unit | assertion over `data/harness-policies/memory-write-policy.json` and `skills/larry-personality/SKILL.md` | W0 | green |
| T-298-16 | 298-04 | 1 | R-07 readable basket rows | T-298-16 | label is claim text, description `<kind> -> <section>, conf 0.xx, from <path>`; no claim body enters any `brain_*` call | unit | extended F.8 test: `superset_options[0].description` matches `/^\w+ -> .+, conf 0\.\d+, from /`; `options[0].label` is not a candidate id | W0 | green |
| T-298-17 | 298-03 | 2 | R-08 transcript-reader lift | T-298-17 | ten pinned export names unchanged; card-fire behavior identical | unit | `node -e` export-surface probe (ten functions); card-fire's existing tests exit 0 | partial | green |
| T-298-18 | 298-07 | 2 | R-08 voice log Stop hook | T-298-18 | always `{continue: true}`; log line only under `MINDRIAN_HOME`; never throws | unit | `node tests/test-298-voice-log.cjs`: em-dash turn -> `{continue: true}`, exit 0, exactly one new line in `$MINDRIAN_HOME/voice-style.jsonl`; clean turn -> zero new lines | W0 | green |
| T-298-19 | 298-07 | 2 | R-08 hook schema gate | T-298-19 | new Stop entry passes the schema gate | integration | `node scripts/check-hook-schema-compatibility.cjs` -> exit 0 | exists | green |
| T-298-20 | 298-15 | 2 | R-09 doctor point | T-298-20 | `harness-policies` spawns the runner; blocks on failure | integration | `node scripts/doctor.cjs --acceptance --pre-tag` -> `harness-policies` PASS; `DOCTOR_TEST_FAIL_POINT=harness-policies ...` -> exit 1; `node tests/test-doctor-acceptance-self-coverage.cjs` exit 0 | W0 | green |
| T-298-21 | 298-14 | 1 | R-10 recipe-maps tolerance | T-298-21 | `policies` exposed; read-joins byte-unchanged | unit | `node -e "console.log(require('./lib/core/recipe-maps.cjs').loadManifest().policies)"` -> object; `test-201-harness-manifest.cjs` Task 3 exit 0 | extend | green |
| T-298-22 | 298-14 | 2 | R-10 T-side payload | T-298-22 | `command-registry.json` unchanged | integration | `git diff --stat HEAD -- data/command-registry.json lib/core/recipe-maps.cjs` at phase close: registry 0 changes; recipe-maps changed only in `_loadManifest` and exports | W0 | green |
| T-298-23 | 298-15 | 2 | R-11 suite + baseline | T-298-23 | no new failures anywhere | integration | `bash tests/run-all-298.sh` -> `FAIL=0`; before/after set of the pre-existing red tests identical | W0 | green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] **Baseline capture before any edit** - record the pre-existing red tests verbatim (the two manifest-cluster tests `test-harness-manifest-precommit-wiring.cjs` and `test-harness-167-verdict.cjs`, plus the four persona-cluster tests the research names), so "no new failures" is provable
- [x] `tests/run-all-298.sh` - copy `tests/run-all-201.sh`; no framework to install
- [x] `tests/test-298-policies-schema.cjs` - covers R-02, R-03
- [x] `tests/test-298-runner-idempotent.cjs` - covers R-04
- [x] `tests/test-298-derive-health.cjs` - covers R-05 (and hosts the D-03 throwaway-db `governance.cjs:57` unit test)
- [x] `tests/test-298-voice-log.cjs` - covers R-08
- [x] `tests/test-298-contract-parity.cjs` - covers R-06
- [x] `data/harness-fixtures/converged-room/` - scaffold-born, exactly 33 text files, em-dashes and ANSI escapes scrubbed from the `compute-state` output before commit (research Pitfall 3), landed by plan 298-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A fresh Larry passes the four beta.27 behavioral tests on Desktop and Cowork and shows a governance basket for a two-candidate write | Spec Acceptance | Desktop and Cowork have no hook or script runtime to drive from a test | Open a fresh session on each surface, run the four beta.27 prompts, then state two claims in one turn and confirm the F.8 card renders readable rows (claim text as label; kind, section, confidence, source in the description) and Larry stays silent after confirm |
| Promotion review reads correctly to a human | R-03 / D-02 | The `MET / NOT MET` verdict and the one-line edit are judged by the navigator | Run `node scripts/run-harness.cjs --policy <id>` on a policy with a populated evidence log; confirm the doctor line echoes the same verdict |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency bounded by the single owning test per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-08
