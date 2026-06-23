---
name: dark-fixture
description: A deliberately dark surface (test fixture, NOT a real command)
# --- Phase 172-13 coverage-gate hard-FAIL fixture ---
kind: methodology
frameworks: ["Deliberately Dark Fixture Framework"]
produces: "nowhere/*"
inputs: []
autonomous_safe: true
# --- NO connector: block ON PURPOSE ---
# This surface ships NO connector: block at all, so classifySurface() classifies
# it `gap` (neither WIRED via connects_to_spine:true nor EXCLUDED via
# connector:{excluded:true,reason}). This is the exact accidental-dark shape the
# Phase 172-13 hard-FAIL gate must catch: a born-dark surface that reaches merge
# is the recurring 143.x/144.1 regression. tests/test-coverage-gate-hardfail.cjs
# feeds this fixture's src descriptor to classifySurface() and asserts state ===
# 'gap', proving --check would exit non-zero on it.
#
# This file lives under tests/fixtures/coverage-gate-dark/ and is NEVER walked by
# the live generator's listSourceFiles() (which walks commands/ + skills/ +
# agents/ only), so the real-repo --check stays exit 0.
---

# Dark Fixture (test only)

This is a deliberately dark surface used by
`tests/test-coverage-gate-hardfail.cjs` to prove the hard-FAIL of
`scripts/build-connector-registry.cjs --check`. It is NOT a real command, skill,
or agent. It is never installed, never dispatched, and never walked by the live
generator.

It carries NO `connector:` block, so it is classified `gap` (dark) and would make
the coverage gate exit non-zero.
