---
quick_id: 261109-mrg
date: 2026-11-09
status: done
origin: owner approval 2026-11-09 to reconcile this tree with origin/main, even if the next release is beta.85
---

# Quick 261109-mrg: reconcile main with origin/main

## Goal

Join the local main (153 commits ahead, 13 behind) with origin/main dfcf8d39d. Use one real merge commit. Do not rebase. Do not force. Do not rewrite history. Do not push, tag, bump a version or release. A second small merge follows after beta.83 lands on origin.

## Steps

1. Check that the tree is clean. Fetch tags (read only). List the files changed on both sides from the merge base c3c0cf8df.
2. Run `git merge --no-commit --no-ff origin/main`. Resolve each conflict by reading both sides. Keep both intents.
3. Version files: take the origin side exactly. Generated files: take the origin side, then run the generators and the checks.
4. Planning files (STATE.md, ROADMAP.md): merge by hand with the Edit tool. Keep every line of both sides except true duplicates.
5. SEED-145 clash: origin keeps SEED-145 (Theo store floor). Renumber the local agent-keys seed to the next free number. Fix every reference.
6. Check the stub removal date against the release numbering. Report only. Do not change the date.
7. Commit the merge. Run the suites. Compare to the numbers in 389-CLOSEOUT.md. Fix a red only if it is a plain merge artifact.
8. Write this PLAN and the SUMMARY in a follow-up commit (`git commit --only`).

## Limits

- Never use --no-verify.
- No gsd-tools write command on STATE.md or ROADMAP.md.
- No em-dashes in added lines.
- If a conflict cannot be resolved with confidence, run `git merge --abort` and return NEEDS_HUMAN.
