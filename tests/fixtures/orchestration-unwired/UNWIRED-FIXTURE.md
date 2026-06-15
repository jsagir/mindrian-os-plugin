---
name: unwired-fixture
description: A deliberately un-wired surface (test fixture, NOT a real command)
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Deliberately Unwired Fixture Framework"]
produces: "nowhere/*"
inputs: []
autonomous_safe: true
# --- NO connector: block ON PURPOSE ---
# This surface declares a frameworks: block (so the framework gets minted as a
# projection node) but DELIBERATELY ships NO connector: block, so the framework
# never reaches one of the 6 frozen reaches via an OPERATES->reach chain. This is
# the exact shape that let /mos:futures ship un-wired (BOG-06): a framework
# present in the projection but wired to no reach. Phase 157-04 Task 2 uses this
# fixture to prove validateProjection flags UN-WIRED (fails RED). The framework
# name "Deliberately Unwired Fixture Framework" is NOT in
# data/orchestration-unwired-allowlist.json, so it is not exempt.
#
# This file lives under tests/fixtures/orchestration-unwired/ and is NEVER walked
# by the live generator's listSourceFiles() (which walks commands/ + skills/ +
# agents/ only), so the real-repo --check stays exit 0. The test injects this
# fixture's framework into a SYNTHESIZED projection object and calls
# validateProjection directly -- it never touches the live source walk.
---

# Unwired Fixture (test only)

This is a deliberately un-wired surface used by
`lib/memory/orchestration-projection.test.cjs` to prove the UN-WIRED leg of
`scripts/build-orchestration-projection.cjs --check` fires RED. It is NOT a real
command, skill, or agent. It is never installed, never dispatched, and never
walked by the live generator.

The framework it declares ("Deliberately Unwired Fixture Framework") reaches no
frozen reach and is not allowlisted, so a projection that contains it as a
framework node with no OPERATES->reach chain MUST be flagged UN-WIRED.
