---
quick_id: 261028-gmg
verified: 2026-10-28
verified_head: efa35c5f906b382c75b4046bd89cac4793f3e7dc
base: 30ff3e8d0
status: passed
score: 8/8 must-haves verified
---

# Quick 261028-gmg Verification

Goal: a room can declare a job id for its own custom sections without editing the shared canon.
Result: the goal is achieved in the code. Evidence below is from code and commands run in this tree, not from the SUMMARY.

## 1. Must-haves truths

| # | Truth | Result | Evidence |
|---|-------|--------|----------|
| 1 | Room declares a job in `.mindrian/section-jobs.json`; `getSectionJob(slug, roomDir)` returns it with source `room-declaration` | PASS | `lib/core/section-registry.cjs` readRoomSectionJobs and getSectionJob. Probe a2 returned `{job_id:'understand-market',source:'room-declaration',ratified_by:'navigator',ratified_at:'2026-10-28'}`. |
| 2 | `getSectionJob(slug)` with no room equals base | PASS | The canon lookup line is unchanged in the diff. The room branch sits inside `if (!row)` and needs a non-empty string `roomDir`. Probe a1 returned the undeclared shape. test-353-room-section-jobs A1 parity (copy of the base function) passes. |
| 3 | A declared canon slug is rejected as `canon_section`; the canon row is returned | PASS | Probe b: `problem-definition` with `find-bottleneck` gives rejected `canon_section`, and the getSectionJob result is deep-equal to the no-room result. |
| 4 | Unknown job id, bad secondary job id, or no ratification is rejected, never a job | PASS | Probe c: `nope` gives `unknown_job_id`; no `ratified_by` gives `unratified`; 65-character `ratified_by` gives `unratified`; bad secondary gives `invalid_secondary_job_id`. The accepted keys are only `ok`. getSectionJob returns null job_id for all four. Doctor reports rejected entries in `drift.room_declarations_rejected` (test D3). |
| 5 | Symlinked file or `.mindrian` is `file_symlink`; prototype slugs are `invalid_slug`; values cut to 64 | PASS | Probes d, e, f below. The code uses `fs.lstatSync` on the directory and the file (section-registry.cjs, readRoomSectionJobs). |
| 6 | Doctor lists room-declared sections apart; only undeclared sections go to `sections_without_job_id`; room-declared never in `ruling_fingerprint_drift` | PASS | Probe g. Also test-353-doctor-section-ruling D3 and D4 pass. |
| 7 | Registry row has 7 keys, no `auto_heal`; canon file byte-identical; no canon fingerprint change | PASS | See checks 4 and 5. test-353-ruling-doc 19/19 and test-353-section-canon 11/11 pass. |
| 8 | FeyMinto next move (gatherNest, BRIEF.md, suggest_next) and decide() read the room-declared job when the room is known | PASS | `next-move.cjs`: `readJob(sectionDir, section, roomDir)` calls `getSectionJob(section, roomDir)`, and gatherNest passes `roomDir`. `navigation-engine.cjs`: `getSectionJob(ctx.section, ctx.roomDir-if-string)`. `room-skeleton-scaffold.cjs`: `getSectionJob(slug, roomDir)`. Tests C1 to C4 pass. Note: decide() reads the room only if the caller threads `ctx.roomDir` (ASSUMED to be threaded by real callers; see check 7). |

## 2. Test runs

| Test | PASS | FAIL |
|------|------|------|
| tests/test-353-room-section-jobs.cjs | 77 | 0 |
| tests/test-353-doctor-section-ruling.cjs | 49 | 0 |
| tests/test-doctor-module-contract-parity.cjs | ALL PASS (2 assertions) | 0 |
| tests/test-doctor-doc-parity.cjs | ALL PASS (3 assertions) | 0 |
| tests/test-353-section-canon.cjs | 11 | 0 |
| tests/test-353-ruling-doc.cjs | 19 | 0 |
| tests/test-353-filing-gate.cjs | 24 | 0 |
| tests/test-353-decide-budget.cjs | 5 | 0 |

All 8 exit 0. I did not run tests/run-all-353.sh (it rewrites a tracked file; the plan says restore it). `ledger shape` is a known worktree ENV GAP.

## 3. Adversarial probes (node against temp dirs under os.tmpdir(); deleted after)

Probe script: /tmp/claude-1000/-home-jsagi/1d319b01-f4ff-475c-b783-43c810fbaa0d/scratchpad/probe.cjs

- a. PASS. No room: `{job_id:null, ..., reason:'undeclared'}`. With room: the room row, with `source:'room-declaration'`.
- b. PASS. Canon row for `problem-definition` unchanged; rejected `canon_section` with `find-bottleneck`.
- c. PASS. Four bad entries rejected (`unknown_job_id`, `unratified` x2, `invalid_secondary_job_id`); only the good entry accepted.
- d. PASS. `__proto__`, `constructor`, `toString`, `hasOwnProperty`, `../x` all `invalid_slug`. The valid sibling `valid-one` is still accepted. `({}).job_id` stays undefined (no prototype pollution).
- e. PASS. File symlink to a valid file outside the room gives one entry `{slug:null, job_id:null, reason:'file_symlink'}` and getSectionJob returns null. A symlinked `.mindrian` directory gives the same.
- f. PASS. A 300 KB file gives `file_too_large`. A 70 KB `job_id` gives a rejected entry with job_id length 64. A 70 KB slug gives slug length 64. The two rejected entries serialize to 245 characters.
- g. PASS. `check({roomPath: tmp})` with one declared custom section `homepage`: `job_sources.room = ['homepage']`, `sections_without_job_id = []`, `ruling_fingerprint_drift = ['problem-definition']`. Homepage is not in drift. The one drift item is my own fixture: I created a canon section `problem-definition` with no CONTEXT.md, so it is a canon finding and unrelated to the declaration. The action line reads `room-declared: homepage -> understand-market (ratified by navigator on 2026-10-28)`. The detail string contains `job sources: canon:1, room-declared:1`.

## 4. No-diff files against 30ff3e8d0

`git diff --exit-code 30ff3e8d0 -- data/section-job-canon.json lib/core/navigation/section-gate.cjs lib/core/feyminto/theo-ask.cjs scripts/eval-icm-writers.cjs lib/core/room-map.cjs` exited 0. PASS.

## 5. doctor-modules.json section-ruling row

Keys: id, introduced_version, cadence, flag, fix_supported, runner, description. Count 7. `'auto_heal' in row` is false. The description contains `section-jobs.json`. PASS.

## 6. Diff scan

- Em dashes and en dashes in the diff: 0 hits (checked with a control string that matched).
- Network calls, Brain client require, `brain_` or `mindrian-brain` in added lines: 0 hits.
- Write calls (writeFile, appendFile, mkdir, unlink, rename) in lib/core/section-registry.cjs: 0 hits in the whole file and in the diff.
- New `require` in lib: one, the existing `require('../section-registry.cjs')` pattern in next-move.cjs (was already there). section-registry.cjs uses only `fs` and `path`, which it already required.
- Result: local reads only. PASS.

## 7. Ways the change can fail to reach the user

1. Installed plugin copy. The cached installs (`~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.69, .73, .75`) have 0 matches for `readRoomSectionJobs`. PROVEN. The change reaches no user until the branch merges and a release is cut and picked up.
2. Not released. The branch `quick/section-job-room-declarations` has 3 commits on base 30ff3e8d0. No merge, no release. PROVEN.
3. No room has the file. `/home/jsagi/MindrianRooms/pws-website/.mindrian/section-jobs.json` does not exist. PROVEN. The 13 undeclared sections stay in `sections_without_job_id` until the navigator writes and ratifies the file. This is the stated design, not a defect. The plugin ships no writer.
4. decide() needs `ctx.roomDir`. The new read happens only when a caller sets `ctx.roomDir`. I confirmed the engine reads `ctx.roomDir` in other places (navigation-engine.cjs lines 976, 1151, 1159). Whether every real hook caller threads it was not traced. ASSUMED.
5. The doctor path (the user-visible report) passes `roomPath` directly. PROVEN by probe g.

## Gaps

None. No blocker found.

## Unverified

- tests/run-all-353.sh not run (writes a tracked file; `ledger shape` ENV GAP).
- Real hook callers of decide() were not traced for `ctx.roomDir`.
- Windows symlink skip path not exercised (this host is Linux).
