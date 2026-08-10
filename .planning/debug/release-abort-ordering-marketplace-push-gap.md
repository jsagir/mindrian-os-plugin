---
kind: rca
status: diagnosed
severity: medium
found: 2026-08-11, both beta.5 cuts (this session + peer verification)
---

# release.sh abort-ordering leaves the marketplace pin unpushed

## Symptom
The beta.5 cut's ahead-of-origin guard refused the plugin push (6 > 2 expected commits);
the operator completed the plugin push manually - but the MARKETPLACE repo sat [ahead 1]
with the beta.5 sync commit local-only, so the public catalog kept serving beta.3 pins
while npm already served beta.5. The peer session caught and fixed it (3511f12..7a75da9).
Both cuts tonight had push-ordering surprises; the morning beta.13 cut had the same class
(npm-fail left marketplace unpushed).

## Root cause
release.sh's push steps are sequential with shared abort paths: a refusal/failure in the
plugin-push step aborts before (or swallows) the marketplace push, and no post-cut gate
re-verifies the MARKETPLACE remote explicitly - Step 9.8's acceptance checks the pin
content locally and npm, but a local-only marketplace commit still satisfies it.

## Fix direction
- Add an explicit marketplace-origin verification to Step 11 post-release verification:
  `git -C ~/mindrian-marketplace status -sb` must show NOT-ahead, hard-fail otherwise.
- Consider pushing marketplace BEFORE the plugin's guarded push, or making the guard's
  refusal message enumerate every repo still holding local release commits.
- Lore rule until fixed: ALWAYS verify marketplace origin explicitly after any cut.
