---
quick: 261107-vhr
type: docs
---

# Quick 261107-vhr: CHANGELOG notes the Windows retest is pending for Phase 383

## Task 1 (docs only)

Add one bullet under a new "### Pending" heading at the end of the top "[Unreleased] -- v2.0.0-beta.80 (in progress)" block of CHANGELOG.md. The top block has no "Known gaps" section.

Text: Phase 383 ships partial: the Windows room-create retest (plan 383-11) is still pending the owner's laptop run and signed receipt. Linux and the Windows side of the dev machine pass; QA383-01 stays open until the receipt is signed.

Limits: change no other line, no version, no heading. No push, tag or release. No em-dashes.

Verify: git diff shows only the added lines; 0 em-dashes in them; `node lib/core/repo-version.cjs` prints 2.0.0-beta.80.
