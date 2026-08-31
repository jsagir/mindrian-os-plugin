#!/usr/bin/env bash
# Copyright (c) 2026 Mindrian. BSL 1.1.
#
# tests/272-rule6-amended.sh
#
# Phase 272, PYPORT-04, D-09. Acceptance grep proving BOTH live copies of
# reverse-salient-agent.cjs's rule 6 carry the D-09 amended wording. RED BY
# DESIGN TODAY: neither copy has been amended yet (the amendment lands in a
# later wave, in the same commit as the dispatch wiring per D-09).
#
# D-09 (272-CONTEXT.md, locked): rule 6 is AMENDED, not overridden. The OLD
# wording hard-shells to scripts/rs-engine.py regardless of any backend flag;
# the NEW wording accommodates D-04's env-flag dispatch while preserving the
# rule's actual spirit (the agent stays a thin orchestrator, it never inlines
# rs-math logic).
#
# BOTH live copies must be amended IN THE SAME COMMIT as the dispatch wiring
# (D-09's own requirement) -- otherwise the code comment and the command doc
# contradict each other:
#   lib/agents/reverse-salient-agent.cjs   (code comment, rule-6 block, :19)
#   commands/find-bottlenecks.md           (prose form, :86 -- Correction C-5's
#                                            finding that RESEARCH located a
#                                            second live copy CONTEXT.md's
#                                            original D-09 text did not name)
#
# The amendment must REPLACE the old text, not sit alongside it -- this
# script also asserts neither file still carries the OLD sentence verbatim.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CODE_FILE="lib/agents/reverse-salient-agent.cjs"
DOC_FILE="commands/find-bottlenecks.md"

# The distinguishing substring shared by both the code-comment form and the
# adapted prose form (272-PATTERNS.md file #11's exact wording).
NEW_MARKER="whichever backend the active flag selects"

# Old wording, verbatim, per each file's current (unamended) text.
OLD_CODE_SENTENCE="NEVER reimplement rs-math in Node -- shell out to scripts/rs-engine.py."
OLD_DOC_SENTENCE="Never reimplement rs-math in Node; the agent shells out to scripts/rs-engine.py."

OK=1

echo "--- 272 rule-6 D-09 amendment acceptance grep (PYPORT-04) ---"
echo ""

check_new() {
  local file="$1"
  if [ ! -f "$ROOT/$file" ]; then
    echo "    FAIL: $file does not exist"
    OK=0
    return
  fi
  if grep -Fq "$NEW_MARKER" "$ROOT/$file"; then
    echo "    PASS: $file carries the D-09 amended wording"
  else
    echo "    FAIL: $file does not yet carry the D-09 amended wording (\"$NEW_MARKER\")"
    OK=0
  fi
}

check_old_gone() {
  local file="$1"
  local sentence="$2"
  if [ ! -f "$ROOT/$file" ]; then
    return
  fi
  if grep -Fq "$sentence" "$ROOT/$file"; then
    echo "    FAIL: $file still carries the OLD unamended rule-6 sentence verbatim -- the amendment must REPLACE it, not sit alongside it"
    OK=0
  else
    echo "    PASS: $file no longer carries the OLD rule-6 sentence"
  fi
}

check_new "$CODE_FILE"
check_new "$DOC_FILE"
echo ""
check_old_gone "$CODE_FILE" "$OLD_CODE_SENTENCE"
check_old_gone "$DOC_FILE" "$OLD_DOC_SENTENCE"

echo ""
if [ "$OK" -eq 1 ]; then
  echo ">>> 272 rule-6 amendment: PASSED"
  exit 0
else
  echo ">>> 272 rule-6 amendment: FAILED (expected today -- D-09's amendment lands in a later wave)"
  exit 1
fi
