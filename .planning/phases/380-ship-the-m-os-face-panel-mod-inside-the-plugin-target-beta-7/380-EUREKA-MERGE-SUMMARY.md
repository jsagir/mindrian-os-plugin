---
phase: 380
plan: 380-EUREKA-MERGE
type: merge-record
completed: 2026-10-24
source_branch: feat/eureka-adapter-rebased
source_tip: 7443bab4133ee8d5c0633a45ec80322e07c1901d
release_tree: /home/jsagi/dev/MindrianOS-Plugin-release
result_commit: ca3b29562891496711f19113366cb00a6f0006f1
pre_merge_main: 3bd05e3382d21f96803ecd456d6536b73683d694
safety_branch: backup/pre-eureka-merge-20261024
---

# Eureka squash merge into release-tree main

Navigator ruling 2026-10-24: the beta.74 cut carries the panel and the Eureka adapter. See 380-11-NAVIGATOR-RULINGS.md.

## What ran

1. Release tree status: no tracked file modified. HEAD was 3bd05e338. `git fetch origin` ran. origin/main is 02387bdae.
2. `git merge --squash feat/eureka-adapter-rebased`. Merge base with main: 02387bdae (origin/main). The branch is 150 commits ahead of that base on the source side. Result: no conflict.
3. ROADMAP.md and STATE.md did not conflict. No side was chosen. 542 files staged (80227 insertions, 502 deletions).
4. Redaction: 3 private glossary sentences in 380-BOOK-REVIEW.md replaced with `[glossary sentence withheld]`. The file is in `.gitignore` path `.planning/phases`, so staging needed `git add -f`. Each sentence had 1 hit. The text after each sentence on the same line stays.
5. Commit ca3b29562 on main: "feat(eureka): squash the Eureka adapter and RS commands branch into main for beta.74". One parent: 3bd05e338. The pre-commit hook gates passed.
6. Main is now 84 commits ahead of origin/main (83 panel commits plus this commit). Nothing pushed. No tag. release.sh not run.

## Redaction checks (PROVEN)

- `git grep` over the working tree and `git grep --cached` over the index: 0 hits for the 3 exact sentences, before the commit.
- Whitespace-tolerant regex scan of all 542 staged files for the first words of each sentence: 0 hits.
- `git log origin/main..HEAD -S<sentence>` for each sentence: 0 commits each.
- Short phrases such as "Finding problems worth solving through systematic future scanning" exist in references/personality/pws-lexicon-full.md and scripts/brain-normalize-problemtype.cypher. They are on origin/main already and are not the 3 sentences.
- Commit 1b6a677be is not an ancestor of main. Only the redacted content entered.

## Check results

| Check | Result |
|-------|--------|
| node lib/core/repo-version.cjs | 2.0.0-beta.74 |
| package.json, npm-shrinkwrap.json JSON.parse | both ok |
| dependencies, devDependencies, optionalDependencies agree with shrinkwrap packages[""] | yes |
| shrinkwrap version | 2.0.0-beta.73, package.json 2.0.0-beta.74. Same pair on origin/main. Release lag, not from this merge. The release script fixes it. |
| node scripts/build-mos-face.cjs --check | OK (40 source files, 25 dist files) |
| bash tests/run-all-380.sh | PASSED=18 FAILED=2 (see below) |
| Eureka adapter tests (296-rs-experts-degrade, test-198-contract-schema.test, test-eureka-capability-run, 3 test-eureka-graph-*, test-rs-experts-find-mcp, test-rs-thesis-read-mcp, engine-projection.test) | exit 0 each |
| Live Eureka tests (test-eureka-live-*) | NOT RUN. MINDRIAN_EUREKA_ROOT is not set. UNVERIFIED. |
| build-connector-registry --check, build-orchestration-projection --check, check-render-coverage | exit 0 each |
| node scripts/doctor.cjs --acceptance | 24/24 passed. WARN only for the real-room receipt (behind HEAD) and 3 agentshield ambiguous findings. |

Note: the summary of 379.1.1-06 names `tests/test-198-contract-schema.cjs`. The real file is `tests/test-198-contract-schema.test.cjs`. It exits 0.

## run-all-380.sh failures (2)

1. "380 engine tests": `claude plugin test` on ui/mos-face. First run: 103 failed. Second run: 3 failed. Third run (direct): many failed with 5 to 8 second durations. Machine load average was 31 (other sessions). No file under ui, lib/mos-face or the test wrapper differs between 3bd05e338 and the new commit. The cause is test timeouts under load. A pass on a quiet machine is UNVERIFIED.
2. "380 gate wiring" W6: the recorded pre-plan sha a53902ea1 (380-09-PRE-SHA.txt) is not an ancestor of HEAD. It is also not an ancestor of 3bd05e338 or origin/main. It exists only on backup/pre-glossary-purge-20261024. The glossary purge rewrote the history. This failure exists before this merge. It needs a new sha record. Not fixed here.

## Skipped

- gsd-tools state.* handlers: skipped, as ordered.
- No push, tag, stash, rebase, reset, cherry-pick, force, npm install or branch deletion.
- scripts/__pycache__ in the branch tree was not touched.

## Risks

- CHANGELOG.md top entry (beta.74) describes the panel only. It has no Eureka line. Add one before the cut.
- Text after each redacted sentence stays on the same line in 380-BOOK-REVIEW.md (it continues the glossary entry). The ruling names the first sentences only.
- Push gate: review all 84 commits ahead of origin before any push.
