#!/usr/bin/env bash
# Phase 89-07 Wave 3 -- pattern-doc structural integrity test.
# Asserts 5 canonical section headers + 4 phase owner cross-references + skeleton steps + invariants.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DOC=docs/AGENTIC-SURFACING-PATTERN.md

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$DOC" ] || fail "pattern doc missing: $DOC"

# Gate 1: 5 canonical section headers
grep -q "^## The Skeleton" "$DOC" || fail "missing section: ## The Skeleton"
grep -q "^## Trigger Modes" "$DOC" || fail "missing section: ## Trigger Modes"
grep -q "^## Phase Owners" "$DOC" || fail "missing section: ## Phase Owners"
grep -q "^## Anti-Patterns" "$DOC" || fail "missing section: ## Anti-Patterns"
grep -q "^## Cross-References" "$DOC" || fail "missing section: ## Cross-References"

# Gate 2: 4 phase owners cross-referenced
grep -q "Phase 116" "$DOC" || fail "missing cross-ref: Phase 116"
grep -q "Phase 117" "$DOC" || fail "missing cross-ref: Phase 117"
grep -q "Phase 118" "$DOC" || fail "missing cross-ref: Phase 118"
grep -q "Phase 120" "$DOC" || fail "missing cross-ref: Phase 120"

# Gate 3: skeleton sequence present
grep -q "gatherFocusContext" "$DOC" || fail "missing skeleton step: gatherFocusContext"
grep -q "gatherBrainContext" "$DOC" || fail "missing skeleton step: gatherBrainContext"
grep -q "composeFinding" "$DOC" || fail "missing skeleton step: composeFinding"
grep -q "surfaceFinding" "$DOC" || fail "missing skeleton step: surfaceFinding"
grep -q "recordSelectorMirror" "$DOC" || fail "missing skeleton step: recordSelectorMirror"
grep -q "emitFindingEdge" "$DOC" || fail "missing skeleton step: emitFindingEdge"

# Gate 4: 4 graph-native invariants enumerated
grep -q "navigation.cjs" "$DOC" || fail "missing invariant ref: navigation.cjs"
grep -q "Canon Part 8" "$DOC" || fail "missing invariant ref: Canon Part 8"
grep -q "F.0" "$DOC" || fail "missing invariant ref: F.0"

# Gate 5: no em-dashes in pattern doc (memory rule feedback_no_emdashes)
EMDASH=$(printf '\xe2\x80\x94')
if grep -F "$EMDASH" "$DOC" >/dev/null 2>&1; then fail "em-dash present in $DOC"; fi

echo "OK: pattern doc passes 5 gates"
