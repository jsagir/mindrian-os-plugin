---
quick: 261001-tta
type: quick
autonomous: true
requirements: []
---

# Quick 261001-tta: trending-to-absurd declares the wrong framework

## Defect

commands/trending-to-absurd.md declared `frameworks: ["S-Curve Analysis"]` and connector `framework: "S-Curve Analysis"`. The navigator's supreme-authority sources (PPT lecture notes lines 508-512 and framework-catalog-343) map the tool to "Trending to the Absurd", an Un-Defined tool. Theo's registry sync copies the plugin declaration, so Theo mapped the command to S-Curve Analysis and left the "Trending to the Absurd" framework with no command.

## Tasks

1. Part 1 (mapping). RED leg first in tests/test-trending-to-absurd-orchestrator.cjs. Fix commands/trending-to-absurd.md and skills/trending-to-absurd/SKILL.md, plus the Brain generic handle in lib/core/trending-to-absurd/orchestrator.cjs and variance.cjs. Regenerate the registries and the harness manifest.
   - Original judgment: S-Curve is not run by the body, so declare the primary only.
   - Navigator ruling (relayed 2026-10-01, "Both TTA and S-Curve"): declare `["Trending to the Absurd", "S-Curve Analysis"]`, primary first. The ruling overrides the judgment; the RED leg pins the set in order.
2. Part 2 (pre-step). Navigator ruling: domain extraction (/mos:explore-domains, framework "Domain Selection") is the pre-step to /mos:trending-to-absurd and to scenario analysis (/mos:scenario-plan, /mos:explore-futures). Encode it only through the governed recipe source (data/command-registry.json curated_chains, read by the command-resolver, local-chain-recommender, and the orchestration projection). RED leg first in tests/test-176-scenario-chain.cjs.
3. Verify: every generator `--check`, check-render-coverage, affected suites, and `bash tests/run-all-363.sh` ending FAILED=0.

## Constraints

Phase 365 planning files are untouched. Commits use `git commit --only -- <paths>`. No state writers. No network. Theo is not touched.
