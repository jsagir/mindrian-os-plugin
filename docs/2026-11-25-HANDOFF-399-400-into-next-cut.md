# Handoff 2026-11-25: phases 399 and 400 must be in the next cut after v2.0.0-beta.89

**Status:** open. Owner instruction of 2026-11-25: "let's make sure they'll be part of any next cut".
**Why this file exists:** v2.0.0-beta.89 is cut from `main` at 3baf146b3. This branch, `work/400-job-sentences-cynefin-layer`, is not merged, so beta.89 ships without Phase 399 (the job-keyed decision advisor) and Phase 400 (job sentences, the cause-and-effect layer, the relay).

## State of the branch

- Tip ef5ef3421, 170 commits that main lacks; main has 10 commits this branch lacks.
- A trial merge into main at 3baf146b3 is clean (`git merge-tree --write-tree`, exit 0). The one file both sides changed, `.planning/STATE.md`, merges without a conflict.
- `tests/run-all-400.sh` passed on 365fce03b (the wicked cut-off commit). It was not rerun on the two later commits by this session.

## Phase 400 sign-off (owner answers on the sign-off page, 2026-11-25)

| Item | Owner answer | State |
|---|---|---|
| Wicked cut-off (AX-02) | Fit it; Codex and Fable decide the value | Done: ruled at 0.9, provisional, not a fit (365fce03b) |
| Order rule (WR-04, WR-09) | no answer yet | OPEN, owner |
| Relay gate (IN-04) | Add a relay provider id | NOT applied: `data/egress-policy.json` and the pin in `tests/test-399-egress-line.cjs` |
| Domain card on three surfaces | Pass on Claude Code, Desktop and Cowork | Recorded |
| Provisional labels | Approved after the edited file | 7 vocabulary sentences ruled (307a951ea, ef5ef3421). Open: the funding and personas section jobs |

## Steps to get into the next cut

1. Owner answers the order-rule card. Apply the relay provider id. Decide the funding and personas section jobs.
2. Update `400-VERIFICATION.md`: the override or closure for each human item, then status passed.
3. Merge this branch into `main` after beta.89 is out. Rerun the trial merge first; main moves during a release.
4. On the merged main: `bash tests/run-all-400.sh`, `bash tests/run-all-366.sh` (run with ~/.local/bin first on PATH so `claude` is 2.1.329 or newer), the Theo release sync for the new version, the framework-names refresh, the section-command ledger rebuild and the ICM eval refresh. Phase 400 changes 254 capability files, so expect the ledger and the registry gates to move.
5. A signed real-room run on the final commit, then `bash scripts/release.sh --prerelease`.

## Also waiting for the same cut

- The session-start hook says "You are Larry." with no scope, while the runtime core in the output style is scoped (quick 261125-rtc). Codex as PM and the engineer both recommend scoping the hook line. Owner decision pending.
- The 401 frontmatter fix (253 of 256 files) and the rename of the agent to `/m:os-Theo_Local` touch the same files as Phase 400's job keys. Order: merge 399 and 400 first, then 401, then the rename.
- npm: publishing with a stored bypass token ends around January 2027 (GitHub changelog of 2026-07-08). `scripts/release.sh` step 9.5 must move to staged publishing or trusted publishing before then.
