---
phase: 381
slug: room-scan-once-render-three-times-node-renderers-behind-comp
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-29
---

# Phase 381 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 381-RESEARCH.md "Validation Architecture" (PROVEN baseline runs on 2026-10-29).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain `node:assert/strict` CJS scripts, exit 0/1 (repo convention, as `tests/test-363.1-compute-state.cjs`); runner `tests/run-all-381.sh` on the `run-all-363.1.sh` pattern (glob `tests/test-381-*.cjs`, PASS/FAIL/SKIP counts) |
| **Config file** | none; Wave 0 creates `tests/run-all-381.sh` |
| **Quick run command** | `node tests/test-381-bash-assoc.cjs && node tests/test-381-bash-dialect.cjs` (target under 10 s) |
| **Full suite command** | `bash tests/run-all-381.sh` plus the pinning list: `node tests/test-363.1-compute-state.cjs`, `node tests/test-compute-state-persists.cjs`, `node tests/test-261029-kqv-stop-skip-recompute.cjs`, `node tests/test-261029-lx3-sessionstart-skip.cjs`, `node tests/test-266-room-state-description.cjs`, `bash tests/run-all-2401.sh`, `bash tests/run-all-363.1.sh`, `node tests/test-frontmatter-schema-reconcile.cjs`, `bash tests/test-phase-13.sh`, `bash tests/test-phase-27-room-structure.sh`, `node tests/test-369-hook-require-graph.cjs`, `node tests/test-369-installed-layout.cjs`, `node tests/test-365-falsify-missing-five.cjs`, `node tests/test-365-falsify-contradiction.cjs`, `node lib/memory/statusline-active-room-write.test.cjs` |
| **Estimated runtime** | quick about 10 s; parity about 40-60 s (OLD analyze-room alone is 15.2 s on the `272/room` fixture); full pinning list about 60 s more |

Baseline PROVEN green on 2026-10-29 before any change: test-363.1-compute-state (6.3 s), test-compute-state-persists (4.3 s), both test-240.1 tests, test-frontmatter-schema-reconcile (2.5 s), test-369-hook-require-graph (0.2 s), both test-365-falsify tests (2 s each), statusline-active-room-write (8 s). Not run: kqv and lx3 tests (green per their SUMMARYs), test-phase-13.sh and test-phase-27 (test-phase-13 runs analyze-room IN PLACE on a tracked fixture: run only on a clean tree and check `git status` after).

---

## Sampling Rate

- **After every task commit:** Run the quick run command, plus `node tests/test-381-parity.cjs --only <script>` for the script the task touched
- **After every plan wave:** Run `bash tests/run-all-381.sh` and the pinning list
- **Before `/gsd-verify-work`:** Full suite green, real-room-copy parity zero diff recorded in `381-PARITY.md`, before/after measurements recorded in CHANGELOG Unreleased
- **Max feedback latency:** 60 seconds for the per-task sample

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 381-01-01 | 381-01 | 1 | PERF381-01, PERF381-05 | T-381-01, T-381-03 | builders refuse any MindrianRooms or ~/.mindrian target; payloads stay data | unit (builder smoke and refusal) | `cd /home/jsagi/dev/MindrianOS-Plugin && T=$(mktemp -d) && for k in edge bad-stage small divergence; do node tests/fixtures/room-381/build-fixture.cjs "$T/$k" $k >/dev/null \|\| echo "FAIL $k"; done; node -e "const b=require('./tests/fixtures/room-381/build-fixture.cjs');try{b.assertSafeTarget('/mnt/c/Users/x/MindrianRooms/r');console.log('FAIL no refusal')}catch(e){console.log('refused ok')}"; node -e "const o=require('./tests/helpers/oracle-381.cjs');console.log(/^[0-9a-f]{40}$/.test(o.BASE_SHA)?'base ok':'FAIL base')"; rm -rf "$T"` | W0 | pending |
| 381-01-02 | 381-01 | 1 | PERF381-01 | T-381-02, T-381-03, T-381-04, T-381-05 | fresh copies only, read-only git, net guard on every node child | integration (harness self-check and prove-fail) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs --self-check > "${TMPDIR:-/tmp}/381-01-self.txt" 2>&1; echo "exit=$?"; tail -1 "${TMPDIR:-/tmp}/381-01-self.txt"; node tests/test-381-parity.cjs --direct --only compute-team \| tail -1; bash tests/run-all-381.sh > "${TMPDIR:-/tmp}/381-01-runall.txt" 2>&1; echo "runall=$?"` | W0 | pending |
| 381-02-01 | 381-02 | 2 | PERF381-07 | T-381-03 | timing runs only on a copy; the audit original stays unchanged | smoke (bench copy and fixture dry run) | `cd /home/jsagi/dev/MindrianOS-Plugin && P=.planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/bench && grep -c "SessionStart" $P/hook-bench-381.cjs && grep -c "// 381:" $P/hook-bench-381.cjs && sha256sum /home/jsagi/.mindrian/perf-audit-2026-10-29/hook-bench-parallel.cjs && node $P/script-timing-381.cjs --script compute-state --side old --runs 1 --source tests/fixtures/sample-room --copy "${TMPDIR:-/tmp}/st381/sample-room" --refresh \| grep -E "^script=compute-state side=old runs=1 median_ms=[0-9]+"` | no (task creates the bench files) | pending |
| 381-02-02 | 381-02 | 2 | PERF381-07 | T-381-03b, T-381-04, T-381-06 | real room touched only by the normal hooks; raw lines stored | manual measurement record (grep) | `cd /home/jsagi/dev/MindrianOS-Plugin && M=.planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-MEASUREMENTS.md && grep -c "^## Before" $M && grep -cE "script=(compute-team\|compute-state\|analyze-room\|compute-meetings-intelligence) side=old runs=3 median_ms=[0-9]+" $M && grep -cE "^SessionStart +hooks=[0-9]+ wall median=[0-9]+ ms" $M && grep -c "on-stop-state-bg done elapsed_s=" $M` | no (task creates 381-MEASUREMENTS.md) | pending |
| 381-03-01 | 381-03 | 2 | PERF381-04, PERF381-08 | T-381-01, T-381-04 | live-tool calls use constant programs; no python, no network module | unit (emulation vs live bash, sort, xargs, date, grep) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-bash-assoc.cjs && node tests/test-381-bash-dialect.cjs && node tests/test-369-hook-require-graph.cjs > /dev/null && echo OK` | no (task creates test-381-bash-*); test-369 yes | pending |
| 381-03-02 | 381-03 | 2 | PERF381-03, PERF381-08 | T-381-02, T-381-04, T-381-07 | walk never enters a symlink; fan-out capped at 32 | unit (fan-out, byte order, glob and find vs live tools) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-room-scan.cjs && bash tests/run-all-381.sh > "${TMPDIR:-/tmp}/381-03-runall.txt" 2>&1; echo "runall=$?"; grep -E "Part 8\|room-scan" "${TMPDIR:-/tmp}/381-03-runall.txt" \| head -5` | no (task creates test-381-room-scan.cjs); run-all-381 W0 | pending |
| 381-04-01 | 381-04 | 3 | PERF381-01, PERF381-02 | T-381-01, T-381-02, T-381-02b, T-381-15 | no python, no program text from room data; Node floor refuses below 22.18.0 | integration (direct parity) plus floor check | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs --direct --only compute-team > "${TMPDIR:-/tmp}/381-04-t1.txt" 2>&1; echo "exit=$?"; tail -1 "${TMPDIR:-/tmp}/381-04-t1.txt"; MINDRIAN_TEST_MODE=1 MINDRIAN_TEST_NODE_VERSION=20.19.5 node lib/core/room-render.cjs team /nonexistent-381; echo "floor=$?"` | W0 | pending |
| 381-04-02 | 381-04 | 3 | PERF381-01, PERF381-08 | T-381-03 | entry-point parity on copies only; no .ts reachable from a hook | integration (entry-point and legacy parity) plus pinning | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs > "${TMPDIR:-/tmp}/381-04-t2.txt" 2>&1; echo "parity=$?"; tail -1 "${TMPDIR:-/tmp}/381-04-t2.txt"; node tests/test-381-parity.cjs --legacy-switch --only compute-team,compute-state \| tail -1; node tests/test-369-hook-require-graph.cjs > /dev/null && echo graph-ok; node tests/test-363.1-compute-state.cjs > /dev/null && echo 3631-ok` | W0; test-369 and test-363.1 yes | pending |
| 381-04-03 | 381-04 | 3 | PERF381-02, PERF381-05 | T-381-01, T-381-04 | injection sentinel never created; only allowlisted -c programs; empty net guard log | unit and integration (divergence, spawn budget) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-known-divergence.cjs && node tests/test-381-spawn-budget.cjs && bash tests/run-all-381.sh > "${TMPDIR:-/tmp}/381-04-runall.txt" 2>&1; echo "runall=$?"` | no (task creates both tests); run-all-381 W0 | pending |
| 381-05-01 | 381-05 | 4 | PERF381-01, PERF381-02 | T-381-01, T-381-01b | names reach grep only as argv; no JS regex beyond the plain or BRE subset | integration (direct parity, stdout prefix) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs --direct --only analyze-room --until "## Cross-References" --no-tree > "${TMPDIR:-/tmp}/381-05-t1.txt" 2>&1; echo "exit=$?"; tail -1 "${TMPDIR:-/tmp}/381-05-t1.txt"; git diff --quiet HEAD -- scripts/analyze-room && echo analyze-room-untouched` | W0 | pending |
| 381-05-02 | 381-05 | 4 | PERF381-01, PERF381-02 | T-381-01, T-381-02, T-381-04, T-381-08 | EDGE text in-process (no node -e); sweep writes only glob-found files; nothing to /tmp | integration (direct parity, stdout prefix and tree) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs --direct --only analyze-room --until "## Meeting Coverage" > "${TMPDIR:-/tmp}/381-05-t2.txt" 2>&1; echo "exit=$?"; tail -1 "${TMPDIR:-/tmp}/381-05-t2.txt"` | W0 | pending |
| 381-06-01 | 381-06 | 5 | PERF381-01, PERF381-02 | T-381-01, T-381-02 | xargs gets data on stdin with argv []; date parsing is pure | integration (direct parity, full output and tree) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs --direct --only analyze-room > "${TMPDIR:-/tmp}/381-06-t1.txt" 2>&1; echo "exit=$?"; tail -1 "${TMPDIR:-/tmp}/381-06-t1.txt"` | W0 | pending |
| 381-06-02 | 381-06 | 5 | PERF381-01, PERF381-06, PERF381-08 | T-381-09 | renderer module mtimes invalidate the analyze cache; scripts/session-start untouched | integration (entry-point parity) plus lx3 case and static | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs > "${TMPDIR:-/tmp}/381-06-t2.txt" 2>&1; echo "parity=$?"; tail -1 "${TMPDIR:-/tmp}/381-06-t2.txt"; node tests/test-261029-lx3-sessionstart-skip.cjs > "${TMPDIR:-/tmp}/381-06-lx3.txt" 2>&1; echo "lx3=$?"; grep -c "reason=renderer\\|renderer module newer" "${TMPDIR:-/tmp}/381-06-lx3.txt"; node tests/test-369-hook-require-graph.cjs > /dev/null && echo graph-ok; git diff --quiet HEAD -- scripts/session-start && echo session-start-untouched` | W0; lx3 test yes (extend); test-369 yes | pending |
| 381-06-03 | 381-06 | 5 | PERF381-02, PERF381-05 | T-381-01, T-381-04 | analyze divergences pinned; spawn count constant; empty net guard log | unit and integration (divergence, spawn budget) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-known-divergence.cjs && node tests/test-381-spawn-budget.cjs && bash tests/run-all-381.sh > "${TMPDIR:-/tmp}/381-06-runall.txt" 2>&1; echo "runall=$?"` | no (381-04 creates, task extends); run-all-381 W0 | pending |
| 381-07-01 | 381-07 | 6 | PERF381-01, PERF381-02 | T-381-01, T-381-02 | registry read is JSON.parse (no python); children get argv only | integration (direct parity) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs --direct --only compute-state > "${TMPDIR:-/tmp}/381-07-t1.txt" 2>&1; echo "exit=$?"; tail -1 "${TMPDIR:-/tmp}/381-07-t1.txt"` | W0 | pending |
| 381-07-02 | 381-07 | 6 | PERF381-01, PERF381-08 | T-381-10 | stop-gate STATE.md write goes through persistState and keeps the stamps | integration (entry-point parity) plus unit (stop-gate persist) and pinning | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-parity.cjs > "${TMPDIR:-/tmp}/381-07-t2.txt" 2>&1; echo "parity=$?"; tail -1 "${TMPDIR:-/tmp}/381-07-t2.txt"; node tests/test-381-stop-gate-persist.cjs && node tests/test-363.1-compute-state.cjs > /dev/null && node tests/test-369-hook-require-graph.cjs > /dev/null && echo pins-ok` | W0; test-381-stop-gate-persist no (task creates); test-363.1 and test-369 yes | pending |
| 381-07-03 | 381-07 | 6 | PERF381-02, PERF381-05 | T-381-01, T-381-04 | no python3 or node spawn; empty renderer stderr; empty net guard log | unit and integration (divergence, spawn budget) | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-381-known-divergence.cjs && node tests/test-381-spawn-budget.cjs && bash tests/run-all-381.sh > "${TMPDIR:-/tmp}/381-07-runall.txt" 2>&1; echo "runall=$?"` | no (381-04 creates, task extends); run-all-381 W0 | pending |
| 381-08-01 | 381-08 | 7 | PERF381-01 | T-381-03 | parity on a fresh cp -a copy; the real room is never a script argument | integration (recorded parity) plus full suite | `cd /home/jsagi/dev/MindrianOS-Plugin && P=.planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-PARITY.md && grep -c "parity: 0 diffs" $P && grep -c "recorded zero-diff run" $P && bash tests/run-all-381.sh > /dev/null 2>&1 && echo runall-ok` | no (task creates 381-PARITY.md); run-all-381 W0 | pending |
| 381-08-02 | 381-08 | 7 | PERF381-07 | T-381-03b, T-381-06 | real numbers only; raw bench lines stored | manual measurement record (grep) | `cd /home/jsagi/dev/MindrianOS-Plugin && M=.planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-MEASUREMENTS.md && awk '/^## After/{a=1} a' $M \| grep -cE "script=(compute-team\|compute-state\|analyze-room\|compute-meetings-intelligence) side=(old\|new) runs=3 median_ms=[0-9]+" && awk '/^## After/{a=1} a' $M \| grep -cE "^(SessionStart\|Stop) +hooks=[0-9]+ wall median=[0-9]+ ms"` | no (381-02 creates 381-MEASUREMENTS.md) | pending |
| 381-08-03 | 381-08 | 7 | PERF381-07 | T-381-06, T-381-11 | refuses a CHANGELOG with peer edits; every number traced | static (CHANGELOG grep) | `cd /home/jsagi/dev/MindrianOS-Plugin && awk '/^## \[Unreleased\]/{u=1} /^## \[2/{u=0} u' CHANGELOG.md \| grep -c "Not live until a release carries it." && git log -1 --format=%s -- CHANGELOG.md` | yes (CHANGELOG.md) | pending |
| 381-09-01 | 381-09 | 8 | PERF381-09 | T-381-13 | removal waits for a person to read the recorded run | checkpoint (human-verify) with grep | `cd /home/jsagi/dev/MindrianOS-Plugin && grep -c "parity: 0 diffs" .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-PARITY.md` | no (381-08 creates 381-PARITY.md) | pending |
| 381-09-02 | 381-09 | 8 | PERF381-09 | T-381-01, T-381-12 | no python3 or node -e site remains; honest exit 1 without node or below 22.18.0 | static plus integration (parity) plus floor check | `cd /home/jsagi/dev/MindrianOS-Plugin && for s in compute-team analyze-room compute-state; do grep -cE "python3\|BASH_VERSINFO\|declare -A\|MINDRIAN_LEGACY_COMPUTE" scripts/$s; wc -l < scripts/$s; done; node tests/test-381-parity.cjs > "${TMPDIR:-/tmp}/381-09-t2.txt" 2>&1; echo "parity=$?"; tail -1 "${TMPDIR:-/tmp}/381-09-t2.txt"; node tests/test-369-hook-require-graph.cjs > /dev/null && echo graph-ok; MINDRIAN_TEST_MODE=1 MINDRIAN_TEST_NODE_VERSION=20.19.5 bash scripts/compute-state "${TMPDIR:-/tmp}"; echo "floor=$?"` | W0; test-369 yes | pending |
| 381-09-03 | 381-09 | 8 | PERF381-09 | T-381-03, T-381-14 | nothing written into the rethinking room; no home-repository commit | unit (re-pinned leg D) plus suite and static | `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-363.1-compute-state.cjs > /dev/null && echo 3631-ok; node tests/test-381-parity.cjs --legacy-switch \| tail -1; node tests/test-381-known-divergence.cjs > /dev/null && echo div-ok; bash tests/run-all-381.sh > /dev/null 2>&1 && echo runall-ok; test -f /home/jsagi/MindrianOS/research/2026-10-29-js-perf-audit-hook-latency/05-phase-381-outcome.md && echo mirror-ok` | test-363.1 yes; parity and run-all-381 W0; divergence test no (381-04 creates); mirror file no (task creates) | pending |

Pipe characters inside the Automated Command cells are escaped as `\|` for the markdown table; remove the backslash before each pipe to run the command. Each command is copied from the `<automated>` block of its task. File Exists: W0 = created by plan 381-01; "no (...)" names the plan or task that creates the file; yes = in the tree today.

Requirement to test map (from the research):

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF381-01 | OLD vs NEW parity on fixtures and the edge room | integration | `node tests/test-381-parity.cjs` | no, Wave 0 |
| PERF381-01 | parity on a real-room copy | manual-gated integration | `node tests/test-381-parity.cjs --room <copy-of-real-room>`, result filed as `381-PARITY.md` | no, Wave 0 |
| PERF381-02 | no per-file spawn on the common path | unit (spawn counter around `child_process`, asserted on the edge room) | `node tests/test-381-spawn-budget.cjs` | no |
| PERF381-03 | bounded fan-out and byte order | unit | `node tests/test-381-room-scan.cjs` | no |
| PERF381-04 | bash hash order emulation vs live bash | unit | `node tests/test-381-bash-assoc.cjs` | no |
| PERF381-05 | named divergences pinned | unit/integration | `node tests/test-381-known-divergence.cjs` | no |
| PERF381-06 | analyze cache invalidates when renderer modules change | integration | new case in `tests/test-261029-lx3-sessionstart-skip.cjs` | yes (extend) |
| PERF381-07 | before/after timings recorded | manual measurement | phase bench copy, see CONTEXT.md ruling 10 | n/a |
| PERF381-08 | no `.ts` from a hook; zero network in renderers | static + unit | `node tests/test-369-hook-require-graph.cjs`; net guard inside `test-381-parity.cjs` | yes / no |
| PERF381-09 | legacy bodies removed only after the recorded zero-diff run | static | re-pinned `node tests/test-363.1-compute-state.cjs` (leg D) | yes (re-pin) |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-381.sh` - runner on the run-all-363.1.sh pattern
- [ ] `tests/fixtures/room-381/build-fixture.cjs` - edge room and known-divergence room (run-time generated, writes only under its target, refuses `~/MindrianRooms`, as `large-room/build-fixture.cjs` does)
- [ ] `tests/helpers/oracle-381.cjs` - `git archive <BASE_SHA>` OLD tree builder (BASE_SHA recorded in the plan), clean env (`LC_ALL=C.UTF-8`, pinned `TZ`), copy twice, mtime pinning, `computed:` normalization, tree hash diff
- [ ] `tests/test-381-parity.cjs` - first run compares OLD vs OLD (determinism) and OLD vs HEAD scripts (zero diff before any renderer exists), so the harness is proven before the first renderer plan
- [ ] `tests/test-381-bash-assoc.cjs`, `tests/test-381-bash-dialect.cjs` - unit tests for the two helpers
- [ ] `.planning/phases/381-.../bench/hook-bench-381.cjs` - phase copy of the harness with a SessionStart payload, `SKIP`, per-hook max lines
- [ ] Before numbers at the phase base: per-script on a /mnt/c copy; SessionStart CHANGED on the real room; `on-stop-state-bg done elapsed_s=` from `.mindrian/session-close.log`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parity on the navigator's real room | PERF381-01 | the room is not in CI and must not be mutated | copy the room to the scratchpad twice, run OLD and NEW, diff, file `381-PARITY.md` |
| Before/after hook timings | PERF381-07 | needs the real room on /mnt/c and a quiet host | run the phase bench copy, median of 3, record in CHANGELOG Unreleased with the method line |
| x86_64 hash order (assumption A1) | PERF381-04 | the research host is aarch64 | run `node tests/test-381-bash-assoc.cjs` on the x86_64 release machine before the cut |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
