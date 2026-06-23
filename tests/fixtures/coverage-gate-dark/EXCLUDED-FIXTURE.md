---
name: excluded-fixture
description: A deliberately EXCLUDED surface (test fixture, NOT a real command)
# --- Phase 172-13 coverage-gate fixture: the conformant EXCLUDED terminal state ---
connector:
  excluded: true
  reason: "Test fixture - a deliberately excluded utility surface with a documented reason, the first-class conformant EXCLUDED terminal state (Canon Part 11 R1). NOT dark."
---

# Excluded Fixture (test only)

This is a deliberately EXCLUDED surface used by
`tests/test-coverage-gate-hardfail.cjs` to prove an EXCLUDED-with-reason surface
does NOT trip the coverage gate (it is a first-class conformant terminal state,
Canon Part 11 R1, never dark). It is NOT a real command, skill, or agent and is
never walked by the live generator.
