#!/usr/bin/env bash
# Phase 339 Plan 03, Task 2 (FLIP-09) -- the blocking gate's zero-write
# mechanized twin.
# =============================================================================
# THIS ARM IS GREEN IN WAVE 1, NOT RED. Theo's coverage ruling already
# exists at Theo commit `81dfac8` (2026-09-03); this arm's job is to keep
# PASSING against it. The day it goes red, either Session T amended the
# ruling or the heading moved -- both are findings the flip must act on
# rather than route around, so a red run here is itself the signal, not a
# bug in this test.
#
# What this arm proves:
#   1. The subsection headed exactly
#      `### Coverage re-measurement, 2026-09-03, and the ruling on it` is
#      extractable from Theo's flip record by `awk`, scoped from that exact
#      heading to the next `## ` or `### ` heading.
#   2. All eleven required literals are present INSIDE that extracted
#      subsection, matched fixed-string only (never an extended-regex match
#      -- several literals, e.g. `88.4%`, contain regex metacharacters).
#   3. Running the whole extraction and grep block leaves
#      `git status --porcelain | sha256sum` byte-identical in BOTH
#      `/home/jsagi/dev/MindrianOS-Plugin` and `/home/jsagi/Theo`. This is
#      the mechanized twin of `269-05-PLAN.md` Task 1's own zero-write
#      acceptance criterion, mechanized here for the first time (no prior
#      test file performs this exact assertion).
#   4. A SCOPING SELF-CHECK: the string
#      `Flip instructions for the plugin release` (a heading that lives
#      AFTER this subsection ends, in section 2) is NOT found in the
#      extraction. Without this arm, an extraction bug returning the whole
#      file would still pass every positive assertion above.
#   5. If the subsection is absent or any literal is missing, this script
#      exits non-zero, naming the missing literal -- that is the "coverage
#      held" signal, the correct outcome on a future amended ruling, never a
#      crash.
#
# What this arm deliberately does NOT key on: line numbers (the heading
# contract in Theo's flip record moves whenever Session T edits anything
# above the subsection; scoping is by HEADING text, never by line number).
#
# The observed shape this arm keys on: a heading-scoped markdown subsection
# in ANOTHER repo, read only, never written.
#
# No `git fetch`, no scratch file, no `sed` anywhere in this script.
#
# Phase 339, 2026-09-03. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

THEO_ROOT="/home/jsagi/Theo"
FR="$THEO_ROOT/.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md"

fail() {
  echo "GATE: $1 - coverage held"
  exit 1
}

if [ ! -f "$FR" ]; then
  fail "flip record not found at $FR"
fi
if [ ! -d "$THEO_ROOT" ]; then
  fail "Theo repo not found at $THEO_ROOT"
fi

# BEFORE: porcelain hash of both repos, each in a subshell cd so the change
# of directory does not persist into this script's own working directory.
BEFORE_PLUGIN="$(cd "$ROOT" && git status --porcelain | sha256sum)"
BEFORE_THEO="$(cd "$THEO_ROOT" && git status --porcelain | sha256sum)"

# Extract the subsection: from the exact heading line to the next '## ' or
# '### ' heading (exclusive), by awk, anchored on the exact heading text --
# never by line number, because line numbers move whenever Session T edits
# anything above the subsection.
SEC="$(awk '/^### Coverage re-measurement, 2026-09-03, and the ruling on it$/{f=1;next} f&&/^#{2,3} /{exit} f' "$FR")"

test -n "$SEC" || fail "ruling subsection not found"

for LIT in \
  'Brain@56bf75a' \
  '83a1ce2' \
  '1,253' '1,522' '420' \
  '29,200' '24,375' '258' \
  'Covered: 228 of 258, 88.4%' \
  'Uncovered: 30 of 258' \
  'Coverage does NOT block Task 2, the flip' ; do
  printf '%s' "$SEC" | grep -Fq -- "$LIT" || fail "missing literal [$LIT]"
done

# Report, but do not fail on, a HOLD token inside the subsection.
printf '%s' "$SEC" | grep -Fq 'HOLD' && echo "GATE: subsection carries HOLD - report and stop"

# SCOPING SELF-CHECK: a heading string that lives AFTER this subsection ends
# must NOT appear inside the extraction. Without this arm, a broken
# extraction that swallowed the whole file would still pass every positive
# assertion above.
if printf '%s' "$SEC" | grep -Fq 'Flip instructions for the plugin release'; then
  fail "scoping self-check failed: extraction leaked content past the subsection boundary"
fi

# AFTER: re-hash both repos and assert byte-identical to BEFORE.
AFTER_PLUGIN="$(cd "$ROOT" && git status --porcelain | sha256sum)"
AFTER_THEO="$(cd "$THEO_ROOT" && git status --porcelain | sha256sum)"

if [ "$BEFORE_PLUGIN" != "$AFTER_PLUGIN" ]; then
  echo "GATE VIOLATION: this task wrote to the plugin repository"
  exit 1
fi
if [ "$BEFORE_THEO" != "$AFTER_THEO" ]; then
  echo "GATE VIOLATION: this task wrote to the Theo repository"
  exit 1
fi

echo "GATE: coverage ruled"
echo "PASS: subsection extracted, all eleven literals present, scoping self-check held, zero writes in either repo"
echo "  porcelain sha256 (plugin) before=$BEFORE_PLUGIN"
echo "  porcelain sha256 (plugin) after= $AFTER_PLUGIN"
echo "  porcelain sha256 (theo)   before=$BEFORE_THEO"
echo "  porcelain sha256 (theo)   after= $AFTER_THEO"
exit 0
