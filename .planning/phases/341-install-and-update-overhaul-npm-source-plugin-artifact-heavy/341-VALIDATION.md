---
phase: 341
slug: install-and-update-overhaul-npm-source-plugin-artifact-heavy
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-09
---

# Phase 341 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Generated from the ten
> committed plans' own `<automated>` verify commands and 341-RESEARCH.md "Validation Architecture"
> (2026-09-09), after the plan-checker flagged the unfilled template.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain `node` assertion scripts (`node:assert`) plus bash aggregators; no jest, no vitest, no mocha (341-RESEARCH.md, Validation Architecture) |
| **Config file** | none; discovery is the per-phase aggregator `tests/run-all-341.sh` (glob discovery, found-eq-0 guard, the run-all-310.sh idiom); Wave 0 (plan 341-01) creates it |
| **Quick run command** | `node tests/test-341-<name>.cjs` (the task's own `<automated>` command, listed per task below) |
| **Full suite command** | `bash tests/run-all-341.sh` (PASS/FAIL/SKIP/EXPECTED-RED lanes; zero network) |
| **Release-tier command** | `node scripts/doctor.cjs --acceptance --pre-tag` (spawns `scripts/run-harness.cjs`, which runs the two new policies); full `--acceptance` only at Step 9.8 |
| **Standalone harness** | `node scripts/run-harness.cjs --check`, `--tier pre-tag`, `--policy release-payload-ceiling` |
| **Estimated runtime** | not measured yet: the aggregator does not exist until Wave 0 lands; plan 341-01 Task 3's acceptance criteria record the first measured full-suite time (the pre-existing run-all-310.sh leg is the floor) |

---

## Sampling Rate

- **After every task commit:** run that task's `<automated>` command (per-task map below)
- **After every plan wave:** run `bash tests/run-all-341.sh` (must report FAIL=0; EXPECTED-RED legs are counted separately and must be exactly the two tripwires until plan 341-04 lands, then zero)
- **Before `/gsd-verify-work`:** `bash tests/run-all-341.sh` green AND `node scripts/doctor.cjs --acceptance --pre-tag` green
- **Max feedback latency:** the per-task commands are single node scripts or `bash -n` checks; the full suite is bounded by `bash tests/run-all-310.sh` (already green today) plus the new legs; measured and recorded at Wave 0 (see runtime row)
- **Zero-network rule:** no leg performs a real `git push`, `npm publish`, `npm view`, heavy-stack `npm install`, or GitHub call; the only real install is the 341-06 human checkpoint

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 341-01-01 | 01 | 1 | D-02,D-03,D-04,D-13 | T-341-01 | per plan `<threat_model>` | suite | `bash -n tests/run-all-341.sh &amp;&amp; test -x tests/run-all-341.sh &amp;&amp; bash tests/run-all-341.sh 2>&amp;1 \\| tail -5 \\| grep -qE 'FAIL=0'` | yes | pending |
| 341-01-02 | 01 | 1 | D-02,D-03,D-04,D-13 | T-341-01 | per plan `<threat_model>` | unit | `node tests/test-341-payload-shrinkwrap-present.cjs; test $? -eq 1` | yes | pending |
| 341-01-03 | 01 | 1 | D-02,D-03,D-04,D-13 | n/a (forward ref: T-341-04 in 341-04-PLAN.md) | per plan `<threat_model>` | unit | `node tests/test-341-no-heavy-dep.cjs; test $? -eq 1` | yes | pending |
| 341-02-01 | 02 | 2 | D-09,D-12,D-13 | T-341-06 | per plan `<threat_model>` | unit | `node tests/test-341-eureka-deps-resolver.cjs &amp;&amp; node -e "require('./lib/core/eureka/embedding-spine.cjs')" &amp;&amp; node tests/test-eureka-smoke.cjs` | yes | pending |
| 341-02-02 | 02 | 2 | D-09,D-12,D-13 | T-341-06 | per plan `<threat_model>` | unit | `node tests/test-341-eureka-enable-argv.cjs &amp;&amp; node scripts/eureka-command.cjs help \\| grep -q enable &amp;&amp; node scripts/check-shape-declaration.cjs --check` | yes | pending |
| 341-02-03 | 02 | 2 | D-09,D-12,D-13 | T-341-06 | per plan `<threat_model>` | harness | `node -e "const c=require('./lib/core/doctor/class-s-eureka-smoke.cjs'); const r=c.fixEurekaSmoke({}); if(typeof r.fixed!=='boolean'\\|\\|typeof r.reason!=='string') process.exit(1)" &amp;&amp; node tests/test-eureka-smoke.cjs &amp;&amp; node scripts/doctor.cjs --eureka-smoke --json \\| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); process.exit(Array.isArray(j.layers)&amp;&amp;j.layers.length===4?0:1)})"` | yes | pending |
| 341-03-01 | 03 | 3 | D-10,D-11,D-12,D-13 | T-341-09 | per plan `<threat_model>` | harness | `node tests/test-341-class-s-layer-split.cjs &amp;&amp; node tests/test-eureka-smoke.cjs &amp;&amp; node scripts/doctor.cjs --eureka-smoke --json \\| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); process.exit(j.layers.length===5&amp;&amp;j.layers[4].id==='model_installed'?0:1)})"` | yes | pending |
| 341-03-02 | 03 | 3 | D-10,D-11,D-12,D-13 | T-341-09 | per plan `<threat_model>` | unit | `node tests/test-341-slim-install-honest-degrade.cjs &amp;&amp; node tests/test-eureka-smoke.cjs &amp;&amp; node -e "const s=require('./lib/core/eureka/embedding-spine.cjs'); if(typeof s.ENCODER_UNAVAILABLE_HINT!=='string'\\|\\|!/\/mos:eureka enable/.test(s.ENCODER_UNAVAILABLE_HINT)) process.exit(1)"` | yes | pending |
| 341-03-03 | 03 | 3 | D-10,D-11,D-12,D-13 | T-341-09 | per plan `<threat_model>` | unit | `node tests/test-341-eureka-no-brain-reach.cjs` | yes | pending |
| 341-04-01 | 04 | 4 | D-02,D-03,D-04,D-05,D-08,D-13 | T-341-01 | per plan `<threat_model>` | unit | `node tests/test-341-shrinkwrap-no-dev.cjs &amp;&amp; node tests/test-341-shrinkwrap-platform-coverage.cjs &amp;&amp; node tests/test-341-payload-shrinkwrap-present.cjs &amp;&amp; node tests/test-341-no-heavy-dep.cjs` | yes | pending |
| 341-04-02 | 04 | 4 | D-02,D-03,D-04,D-05,D-08,D-13 | T-341-01 | per plan `<threat_model>` | harness | `node scripts/check-release-payload-ceiling.cjs --check &amp;&amp; node scripts/run-harness.cjs --check &amp;&amp; node scripts/build-harness-manifest.cjs --check &amp;&amp; node tests/test-341-payload-ceiling.cjs` | yes | pending |
| 341-04-03 | 04 | 4 | D-02,D-03,D-04,D-05,D-08,D-13 | T-341-01 | per plan `<threat_model>` | harness | `node scripts/check-registry-drift.cjs --check &amp;&amp; node scripts/run-harness.cjs --check &amp;&amp; node scripts/build-harness-manifest.cjs --check &amp;&amp; node tests/test-341-registry-drift.cjs` | yes | pending |
| 341-05-01 | 05 | 5 | D-01,D-04,D-06,D-08,D-13 | T-341-01 | per plan `<threat_model>` | unit | `bash -n scripts/release.sh &amp;&amp; bash -n scripts/release-lib/shrinkwrap-gate.sh &amp;&amp; node tests/test-341-release-shrinkwrap-gate.cjs &amp;&amp; grep -c 'MOS_SKIP_VENDOR' scripts/release.sh \\| grep -q '^0$'` | yes | pending |
| 341-05-02 | 05 | 5 | D-01,D-04,D-06,D-08,D-13 | T-341-01 | per plan `<threat_model>` | suite | `bash tests/run-all-310.sh &amp;&amp; bash tests/run-all-341.sh` | yes | pending |
| 341-05-03 | 05 | 5 | D-01,D-04,D-06,D-08,D-13 | T-341-01 | per plan `<threat_model>` | harness | `node tests/test-341-version-of-record-source-version.cjs &amp;&amp; node tests/test-341-marketplace-npm-source.cjs &amp;&amp; node tests/test-release-bump-tag-and-publish-gates.cjs &amp;&amp; node scripts/doctor.cjs --acceptance --pre-tag` | yes | pending |
| 341-06-01 | 06 | 6 | D-01,D-04,D-13 | T-341-02 | per plan `<threat_model>` | cli | `node scripts/collect-cold-install-evidence.cjs --json \\| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const need=['schema','collected_at','platform','arch','node','plugin_version','marketplace_source','npm_cache_present','cache_dir','node_modules_present','completion_record_present','installed_package_count','mcp_servers','doctor_acceptance','eureka_smoke','longest_relative_path','first_install_seconds','notes'];need.forEach(k=>{if(!(k in j)){console.error('missing '+k);process.exit(1)}});process.exit(j.schema==='mos-cold-install-evidence/1'?0:1)})"` | n/a | pending |
| 341-06-03 | 06 | 6 | D-01,D-04,D-13 | T-341-02 | per plan `<threat_model>` | unit | `node tests/test-341-cold-install-evidence.cjs` | no (W0/plan creates) | pending |
| 341-07-01 | 07 | 7 | D-05,D-13 | T-341-05 | per plan `<threat_model>` | harness | `node tests/test-341-legacy-install-teardown.cjs &amp;&amp; node scripts/migrate-legacy-install-location.cjs --dry-run --json &amp;&amp; node scripts/doctor.cjs --acceptance --pre-flight` | no (W0/plan creates) | pending |
| 341-07-02 | 07 | 7 | D-05,D-13 | T-341-05 | per plan `<threat_model>` | harness | `node tests/test-341-install-sh-retired.cjs &amp;&amp; node scripts/check-first-touch-drift.cjs &amp;&amp; node scripts/doctor.cjs --acceptance --pre-tag` | no (W0/plan creates) | pending |
| 341-07-03 | 07 | 7 | D-05,D-13 | T-341-05 | per plan `<threat_model>` | cli | `test -f docs/install/PACKAGING-PATHS.md &amp;&amp; grep -q "@mindrian_os/cli" docs/install/PACKAGING-PATHS.md &amp;&amp; test "$(grep -c '@mindrian_os/install' docs/install/PACKAGING-PATHS.md)" = "0" &amp;&amp; grep -q "npm-shrinkwrap.json" docs/install/PACKAGING-PATHS.md &amp;&amp; test "$(grep -c "$(printf '\xe2\x80\x94')" docs/install/PACKAGING-PATHS.md)" = "0"` | n/a | pending |
| 341-08-01 | 08 | 8 | D-07,D-07a,D-07b,D-13 | T-341-26 | per plan `<threat_model>` | cli | `test "$(grep -c '^### Step ' commands/update.md)" = "4" &amp;&amp; test "$(grep -c 'post-update-restart-pending' commands/update.md)" = "0" &amp;&amp; test "$(grep -c 'SHA_DIFFERS_INVERSION_HOTFIX' commands/update.md)" = "0" &amp;&amp; node scripts/check-shape-declaration.cjs --check` | n/a | pending |
| 341-08-02 | 08 | 8 | D-07,D-07a,D-07b,D-13 | T-341-26 | per plan `<threat_model>` | cli | `node scripts/check-version-and-sha.cjs \\| head -1 \\| grep -qE '^STATUS=(UP_TO_DATE\\|VERSION_DIFFERS\\|NETWORK_ERROR\\|ERROR)$' &amp;&amp; test "$(grep -c 'api.github.com' scripts/check-version-and-sha.cjs)" = "0" &amp;&amp; test "$(grep -rc 'SHA_DIFFERS_INVERSION_HOTFIX' scripts/check-version-and-sha.cjs commands/update.md \\| grep -vc ':0$')" = "0"` | n/a | pending |
| 341-08-03 | 08 | 8 | D-07,D-07a,D-07b,D-13 | T-341-26 | per plan `<threat_model>` | suite | `node tests/test-341-session-verify-state.cjs &amp;&amp; node tests/test-341-update-collapsed.cjs &amp;&amp; node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))" &amp;&amp; node tests/test-statusline-glyph-isolation.cjs &amp;&amp; bash -n tests/run-all-341.sh` | no (W0/plan creates) | pending |
| 341-08-04 | 08 | 8 | D-07,D-07a,D-07b,D-13 | T-341-26 | per plan `<threat_model>` | harness | `node tests/test-341-session-start-tier.cjs &amp;&amp; node tests/test-341-eureka-optin-once.cjs &amp;&amp; node scripts/check-eureka-optin-once.cjs --check &amp;&amp; node scripts/run-harness.cjs --tier session-start --json &amp;&amp; node scripts/build-harness-manifest.cjs --check &amp;&amp; node scripts/run-harness.cjs --check &amp;&amp; node scripts/doctor.cjs --acceptance --pre-tag` | no (W0/plan creates) | pending |
| 341-08-05 | 08 | 8 | D-07,D-07a,D-07b,D-13 | T-341-26 | per plan `<threat_model>` | suite | `node tests/test-341-session-start-verify-hook.cjs &amp;&amp; node tests/test-341-verify-insight-delivery.cjs &amp;&amp; node tests/test-update-restart-cue.cjs &amp;&amp; node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))" &amp;&amp; bash tests/run-all-341.sh` | no (W0/plan creates) | pending |
| 341-08-06 | 08 | 8 | D-07,D-07a,D-07b,D-13 | T-341-26 | per plan `<threat_model>` | harness | `node tests/test-341-eureka-optin-card.cjs &amp;&amp; node tests/test-341-eureka-optin-once.cjs &amp;&amp; node scripts/check-eureka-optin-once.cjs --check &amp;&amp; node scripts/check-shape-declaration.cjs --check &amp;&amp; node scripts/doctor.cjs --acceptance --pre-tag &amp;&amp; bash tests/run-all-341.sh` | no (W0/plan creates) | pending |
| 341-09-01 | 09 | 9 | D-13 | T-341-05 | per plan `<threat_model>` | harness | `node tests/test-doctor-module-contract-parity.cjs &amp;&amp; node tests/test-doctor-doc-parity.cjs &amp;&amp; node scripts/doctor.cjs --statusline-visibility --json &amp;&amp; node scripts/doctor.cjs --acceptance --pre-tag` | yes | pending |
| 341-09-02 | 09 | 9 | D-13 | T-341-05 | per plan `<threat_model>` | harness | `node scripts/doctor.cjs --json &amp;&amp; node scripts/doctor.cjs --fix --json &amp;&amp; node tests/test-doctor-module-contract-parity.cjs &amp;&amp; node tests/test-doctor-doc-parity.cjs &amp;&amp; node scripts/doctor.cjs --acceptance --pre-tag` | yes | pending |
| 341-09-03 | 09 | 9 | D-13 | T-341-05 | per plan `<threat_model>` | suite | `node tests/test-341-retired-classes-a-h.cjs &amp;&amp; bash tests/run-all-341.sh` | no (W0/plan creates) | pending |
| 341-10-01 | 10 | 10 | D-01,D-02,D-03,D-04,D-05,D-06,D-07,D-08,D-09,D-10,D-11,D-12,D-13 | T-341-34 | per plan `<threat_model>` | harness | `node tests/test-doctor-module-contract-parity.cjs &amp;&amp; node tests/test-doctor-doc-parity.cjs &amp;&amp; node scripts/doctor.cjs --install-state --json &amp;&amp; node scripts/doctor.cjs --acceptance --pre-tag` | yes | pending |
| 341-10-02 | 10 | 10 | D-01,D-02,D-03,D-04,D-05,D-06,D-07,D-08,D-09,D-10,D-11,D-12,D-13 | T-341-34 | per plan `<threat_model>` | suite | `node tests/test-341-retired-topology-halves.cjs &amp;&amp; bash tests/run-all-341.sh` | no (W0/plan creates) | pending |
| 341-10-03 | 10 | 10 | D-01,D-02,D-03,D-04,D-05,D-06,D-07,D-08,D-09,D-10,D-11,D-12,D-13 | T-341-34 | per plan `<threat_model>` | cli | `test -f docs/install/INSTALL-OVERHAUL-341.md &amp;&amp; for d in D-01 D-02 D-03 D-04 D-05 D-06 D-07 D-08 D-09 D-10 D-11 D-12 D-13; do grep -q "$d" docs/install/INSTALL-OVERHAUL-341.md \\|\\| { echo "MISSING $d"; exit 1; }; done &amp;&amp; grep -q "INSTALL-OVERHAUL-341" docs/OPEN-HANDOFFS.md &amp;&amp; test "$(grep -c "$(printf '\xe2\x80\x94')" docs/install/INSTALL-OVERHAUL-341.md)" = "0"` | n/a | pending |

*Status: pending until the task commit lands and its command exits 0; green / red / flaky recorded by the executor in SUMMARY.md.*
*"File Exists" = the test file named in the command is on disk today; "no (W0/plan creates)" means the same plan (or Wave 0) creates it before the command runs.*

---

## Wave 0 Requirements

Plan 341-01 (wave 1) is Wave 0. It creates:

- [ ] `tests/run-all-341.sh`
- [ ] `tests/test-341-payload-shrinkwrap-present.cjs`
- [ ] `tests/test-341-no-heavy-dep.cjs`
- [ ] `run_red_until` lane in the aggregator: an EXPECTED-RED tripwire that PASSES while its artifact guard (`npm-shrinkwrap.json`) is absent is reported as FAIL (a tripwire that stops tripping is a defect)
- Every later test file is created by the plan whose task it verifies and is `run_if`-guarded in the aggregator (SKIP until the artifact lands, never FAIL), so no plan depends on a test that a later plan writes.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Task 2: Cold-install proof on Windows, macOS and Linux (D-13 step 2) (341-06-02) | D-01,D-04,D-13 | Cold install on three real machines needs the real loader, the real npm registry and real network; forbidden inside any automated gate (Phase 310 precedent). Also answers RESEARCH assumption A6 (Desktop/Cowork loader pipeline) as PROVEN or DEFERRED. | Follow plan 341-06 Task instructions: `/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace` on Windows 11, macOS, Linux; record `claude plugin list` version, both MCP servers loading (`/mcp`), `node scripts/doctor.cjs --acceptance` output, elapsed time, and the A6 verdict in 341-06-SUMMARY.md. Blocking gate: nothing in waves 7-10 executes until this is green. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (32 automated tasks after the 2026-09-10 revisions of plan 341-08 to six tasks for D-07a and D-07b; the single non-automated task is the 341-06 blocking human checkpoint, listed under Manual-Only)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only one manual task in the phase)
- [x] Wave 0 covers all MISSING references (plan 341-01 creates the aggregator and the two tripwires; every other test file is created by its own plan and `run_if`-guarded)
- [x] No watch-mode flags (grep of every `<automated>` command for `--watch`: 0)
- [ ] Feedback latency measured at Wave 0 (recorded in 341-01-SUMMARY.md; the per-task commands are single-process node scripts)
- [x] `nyquist_compliant: true` set in frontmatter (structure verified by gsd-plan-checker 2026-09-09; the runtime row is the one open measurement)

**Approval:** pending navigator sign-off (plan-checker structural pass 2026-09-09)
