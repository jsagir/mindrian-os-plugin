---
quick: 261001-tta
status: complete
completed: 2026-10-01
commits: [df84da280, b7a446691, 714ed60df, b32ad0a1a, 688381306, af23fd487]
---

# Quick 261001-tta: trending-to-absurd framework mapping and domain pre-step Summary

One-liner: /mos:trending-to-absurd now declares `["Trending to the Absurd", "S-Curve Analysis"]` (primary first), and explore-domains (Domain Selection) is encoded as the governed pre-step of trending-to-absurd and scenario analysis through curated_chains.

## Decision on S-Curve

My own reading of the body: it runs trend extrapolation to an absurd extreme and has no S-curve step. S-Curve Analysis appeared only as the Brain generic handle string in two gate descriptors. On that evidence I first declared the primary only (RED commit df84da280). The navigator then ruled "Both TTA and S-Curve" via the coordinator relay, which overrides the judgment. Final declaration: `frameworks: ["Trending to the Absurd", "S-Curve Analysis"]`, connector `framework: "Trending to the Absurd"`.

How multiple frameworks are stored: the command registry keeps the declared array in order (`frameworks[0]` is the primary), `framework_index` is the inverse, and the connector registry carries one `framework` per surface (the primary). The Brain generic handle in orchestrator.cjs and variance.cjs gate descriptors moved to the primary too.

## Part 1 (mapping)

- RED b7a446691 (supersedes the first leg df84da280): Test 6 plus Test 5 in tests/test-trending-to-absurd-orchestrator.cjs. Verified red against HEAD in a scratch worktree.
- Fix 714ed60df: commands/trending-to-absurd.md, skills/trending-to-absurd/SKILL.md (hand-authored, on the mirror skip-list), lib/core/trending-to-absurd/{orchestrator,variance}.cjs, data/command-registry.json, data/connector-registry.json, data/brain-orchestration-projection.json, data/harness-manifest.json.
- af23fd487: tests/run-all-163.sh connector-block leg pinned the old S-Curve string; updated to the new declaration.

## Part 2 (pre-step)

Encoded in data/command-registry.json `curated_chains` (the one governed recipe source: build-command-registry preserves it, the orchestration projection materializes it as PREREQUISITE and FEEDS_INTO edges, command-resolver and local-chain-recommender read it). Three entries:

- prerequisite Domain Selection -> Trending to the Absurd (0.66, domains-prereq-trends)
- prerequisite Domain Selection -> Scenario Planning (0.66, domains-prereq-scenario). /mos:scenario-plan and /mos:explore-futures both sit under the Scenario Planning framework, so one framework-level edge pre-steps both.
- feeds_into Domain Selection -> Trending to the Absurd (0.64, domain-to-trends): the F.1 next-step after explore-domains. The existing feeds_into Domain Selection -> Scenario Planning (0.68) already covered that next-step for scenario analysis.

Confidences are curated v1 values set below 0.68 so the pinned top suggestion after Domain Selection (tests/test-254, test-176) is unchanged. No second resolver, no hand-merge, no new code path.

- RED b32ad0a1a: tests/test-176-scenario-chain.cjs, 7 failing legs (curated edges, recommender candidates, multi-hop path); composeWorkflow and resolver ordering legs are guards that already held.
- Fix 688381306.

## Registry hashes (Theo Phase 24 registry sync)

data/command-registry.json sha256:

- PRE  fda868e5a4e316421891428e1716033c76eebabe0f2a04c60e86799228de9064
- after part 1 a208c7bc47c541877e6a82e904239b8a4875019122afa4aa75bc1c8f3b8f235a
- POST 6df925df83d3952db403fdcc9ca0c2ef5714bfe1e203ac4f161af300f8b56934

connector-registry PRE abc0cc6f..., brain-orchestration-projection PRE 3f0a3b8a... (both changed). The change rides the next release's theo-resync; nothing is live until released and picked up.

## Verification

- Every `--check` rc=0: build-skill-mirrors, build-command-registry, build-connector-registry, build-orchestration-projection, build-harness-manifest; check-render-coverage rc=0.
- bash tests/run-all-363.sh: PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10.
- tests/run-all-163.sh 13/13, tests/run-all-176.sh 5/5, test-trending-to-absurd-orchestrator 6/6, test-355-framework-names 64/0, test-254-projection-chain-source and lib/memory/orchestration-projection.test.cjs green.

## Deferred (pre-existing, not caused by this task)

- tests/test-harness-167-verdict.cjs: 1 fail, D-167-06 "build-new-surface.cjs writes review_status: confirmed" (the other 2 fails were the stale harness manifest, fixed by regeneration).
- tests/test-344-layer-backfill.cjs and `backfill-layer.cjs --check`: commands/file-meeting.md and skills/file-meeting/SKILL.md would change.
- lib/memory/command-registry.test.cjs: `/mos:deck` kind is `mechanical`.

## Deviations

- [Rule 3] Regenerated data/harness-manifest.json (its digest covers the connector registry) and updated tests/run-all-163.sh (pinned the old declaration).
- Navigator ruling overrode my S-Curve judgment; documented above.
- Phase 365 files and Theo untouched. No state writers run.
