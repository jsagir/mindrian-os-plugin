# Deferred items - Phase 236

## Pre-existing, out of scope for 236-03

- `tests/test-graph-derivation-verdict.cjs` fails 2 assertions at HEAD (commit 1de288e1), BEFORE any 236-03 change:
  `GDH-09 born-like: a FEYNMAN body carries the ## Timeline (auto) section` and the same assertion at
  `D-169-11 depth>=2`. Verified by restoring both 236-03 source files to HEAD and re-running: byte-identical
  failure output. Unrelated to room.db open classification (it is a markdown FEYNMAN/Timeline section concern).
  NOT fixed here per the executor scope boundary. Needs its own investigation.

## Raised by the 236-04 floor census, deliberately NOT fixed here

### 1. Two runtime surfaces state the node:sqlite AVAILABILITY floor, and both say 22.5.0 when the real number is 22.13.0

This is a DIFFERENT number from the `engines.node` floor that 236-04 corrected. Keep them apart:

- **Engines floor (what 236-04 moved): v22.16.0.** The version where the `timeout` constructor
  option starts working. Below it the room.db write-safety fix is a silent no-op.
- **Availability floor (what these two surfaces are actually talking about): v22.13.0.** The
  version where `require('node:sqlite')` stopped needing `--experimental-sqlite`. Below it the
  require throws outright.

Both surfaces state `22.5.0`, which is below BOTH floors, so each one lets a genuinely broken
Node through:

- `scripts/session-start:48,55-66`. The preflight computes `major > 22 || (major === 22 && minor >= 5)`
  and prints "MindrianOS v1.10.9+ requires Node >= 22.5.0..." on failure. On Node 22.5 through
  22.12 this returns `ok`, and then `require('node:sqlite')` throws anyway. That is the exact
  "lets a genuinely broken Node through" case 236-04 Task 1 told the executor to raise.
- `scripts/sync-rooms-graph:230,235`. A comment plus the stderr message inside the try/catch
  around the `node:sqlite` require, both stating `>=22.5.0`. The message a user sees when the
  require fails names the wrong version.

**Why NOT fixed in 236-04:**

1. The correct new value for these two is **22.13.0, not 22.16.0**. Bumping them to the engines
   floor would be wrong: on 22.13 through 22.15 `node:sqlite` loads and the plugin works, it just
   loses the busy-timeout under write contention. Making `session-start` soft-fail (exit 0,
   reduced functionality, no banner, no scope injection) for that whole range would be a much
   bigger regression than the problem it fixes.
2. `session-start` has a coupled test that must move with it in the same commit:
   `tests/test-session-start-node-preflight.cjs:25` pins `EXPECTED_PREFIX` to the exact message
   string including `22.5.0`. Changing the assertion without changing the preflight would be
   backwards, and changing both is a behavior change to a hook that fires on every session start.
3. Neither file is in 236-04's declared `files_modified`, and this is a behavior change to a
   user-facing hook, not a docs lockstep.

**Follow-up shape:** one small plan that moves both messages to `>=22.13.0`, moves the
`minor >= 5` comparison to `minor >= 13`, and updates `tests/test-session-start-node-preflight.cjs`
in the same commit. Optionally add the startup readback 236-RESEARCH.md Pitfall 5 suggests:
open room.db, read `PRAGMA busy_timeout` back, and warn if it is `0` while `timeout` was
requested. That turns the 22.13-22.15 silent no-op into a visible signal at runtime, which is
this milestone's whole theme, and it degrades nothing.

### 2. `gsd-tools query generate-claude-md` destroys two CLAUDE.md sections on this repo

Observed live during 236-04 Task 1 while trying to regenerate CLAUDE.md from its sentinel source
after editing `.planning/research/STACK.md`. The run reported `Generated 4/6 sections. Fallback:
conventions, architecture.` and the resulting diff was 8 insertions / 22 deletions:

- `<!-- GSD:conventions-start source:CONVENTIONS.md -->` was replaced with the placeholder
  "Conventions not yet established", wiping the Code and Writing-and-Structure convention blocks
  (including the no-em-dashes rule).
- `<!-- GSD:architecture-start source:ARCHITECTURE.md -->` was replaced with "Architecture not yet
  mapped", wiping the Connector Spine block.
- The skills table row was swapped from `docu-optimizer` to `agentshield`.
- Blank lines were injected into hand-written prose OUTSIDE any sentinel.

Root cause: `.planning/CONVENTIONS.md` and `.planning/ARCHITECTURE.md` do not exist, so the
generator falls back to placeholder text and writes the placeholder over real content instead of
leaving the existing section alone. The generated content is a strict information LOSS.

Handled in 236-04 by `git checkout -- CLAUDE.md` and hand-editing the single stack row, with
`.planning/research/STACK.md` edited in lockstep so the sentinel source and the rendered file
agree and a future correct regeneration reproduces the same row.

**Follow-up shape:** either author the two missing source docs from the current CLAUDE.md content
so the generator round-trips losslessly, or make the generator leave a section untouched when its
source file is absent rather than overwriting it with a placeholder. Until then, CLAUDE.md must be
hand-edited in lockstep with its source, never regenerated on this repo.
