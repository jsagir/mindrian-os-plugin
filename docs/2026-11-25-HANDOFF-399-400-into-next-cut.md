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

## Update 2026-11-25 (later the same day): label rulings closed, Phase 400.2 inserted

- All 20 vocabulary sentences are ruled (307a951ea, f8adbdecc). funding keeps plan-execution. personas is ruled validate-idea with explore, with its One job sentence in `data/section-job-canon.json` (5f72e954b). The capability labels are approved and keep the status provisional until a later pass.
- The owner approved the rest of the open human items to proceed, which closes the order rule (WR-04, WR-09) as accepted. Still to apply: the relay provider id (IN-04).
- `bash tests/run-all-400.sh` passed on 5f72e954b.
- NEW, owner ruling: **Phase 400.2, the persona, hats and research bundle, must be part of the next cut too.** Scope: `.planning/phases/400.2-*/400.2-CONTEXT.md`, seed SEED-149. It is not planned or built yet. Its design runs with the EGM method (elephant draft, goldfish reviews), inside GSD with owner sign-off. Phases 399, 400 and 400.1 carry a pointer to it in their CONTEXT files.
- Effect on the steps above: the cut waits for 400.2, or the owner rules that 400.2 moves to the cut after. `.planning/` is ignored, so the 400.2 files travel only when force-added.

## Update 2026-11-25 (reconcile): beta.89 is out, the branch is ready to merge

- v2.0.0-beta.89 is tagged; `origin/main` is at 53a73f95f (bump to beta.90). No other session is running on this machine.
- The relay provider id (IN-04) is applied: `decision_relay` in the providers list of the `decision_advisor` line, path `/v1/decide`, pins updated. The line default stays false.
- All five human items of `400-VERIFICATION.md` now have an owner answer recorded (Owner sign-off section).
- Trial merge of this branch into `origin/main` at 53a73f95f is clean (`git merge-tree --write-tree`, exit 0). `bash tests/run-all-400.sh` exit 0 on the branch tip.
- Note for the relay: the job vocabulary sentences changed today, so `catalogFingerprint()` moves. The relay is not deployed yet; when it is, deploy from the release commit (owner-gated step 7).
- Still open before the cut: Phase 400.2 is scoped but not planned or built; steps 4 and 5 above (gates on merged main, real-room run) are not run.
