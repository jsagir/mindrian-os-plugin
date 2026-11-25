---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 03
subsystem: decision-advisor-capability-labels
tags: [job-labels, agents, mcp-tools, recorded-fixture, owner-review, labels-only]
requires: [399-02]
provides:
  - data/capability-job-labels.json (schema mos.capability-job-labels/1; rule, ruled_by, mcp_tools)
  - serves_jtbd frontmatter on agents/research.md and agents/reverse-salient-agent.md
  - scripts/derive-decision-fixture.cjs (--source, --out; keeps job, command, p only)
  - tests/fixtures/399/recorded-job-command-yes-no.json (schema mos.decision-recorded/1; 1469 pairs, 13 jobs)
  - 399-LABEL-REVIEW.md (7 sections, owner review list)
affects: [399-06]
tech-stack:
  added: []
  patterns: [written apply rule with no executor judgment, labels-only derived fixture, review file with a fixed hash sample]
key-files:
  created:
    - data/capability-job-labels.json
    - scripts/derive-decision-fixture.cjs
    - tests/fixtures/399/recorded-job-command-yes-no.json
    - tests/test-399-capability-labels.cjs
    - .planning/phases/399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v/399-LABEL-REVIEW.md
  modified:
    - agents/research.md
    - agents/reverse-salient-agent.md
    - tests/run-all-399.sh
decisions:
  - "The apply rule was recomputed from the private proposals file by script and matched the expected result exactly: 2 agents, 4 MCP tools. No NEEDS_HUMAN needed."
  - "mcp_tools jobs are stored sorted. whitespace_scan is [audit-room, validate-idea]; the plan text lists the same set in another order."
  - "Not-applied reason codes follow one fixed check order (no_job_reached_0_70, below_owner_band, three_or_more_strong_jobs, not_a_registered_tool). intelligence and room_graph show three_or_more_strong_jobs and also fail the registration condition."
  - "Review section 6 lists only skills that already carry labels; 7 pairs of the 13 unlabelled skills are covered by section 5."
metrics:
  tasks: 3
  completed: 2026-11-24
---

# Phase 399 Plan 03: Capability job labels, recorded fixture and owner review Summary

Applied 6 capability job labels (2 agents, 4 MCP tools) under one written 4-condition rule, derived the labels-only recorded yes/no fixture (1469 pairs) for the offline v0 table build, and wrote the 7-section owner review file; every other proposal is listed, not applied.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Agent and MCP tool job labels under the written rule (I-03) | ccead9d71 |
| 2 | Labels-only recorded fixture for the offline table build (I-05, F6, D-03) | 2d64db4a4 |
| 3 | Owner review file (D-07, I-02, I-03, deferred band review) | 6d761a768 |

## What was built

- `data/capability-job-labels.json`: the 4 MCP tool labels, the rule as one string, `ruled_by` "phase-399-rule-I-03 (owner review pending)". No p, probability or score key.
- 2 agent files each got one `serves_jtbd` line after `description:`. research = understand-market. reverse-salient-agent = find-bottleneck, validate-idea.
- `scripts/derive-decision-fixture.cjs`: no default path, no home path, no network. Exits 2 without both flags.
- Fixture: header keys fixed by test; every pair has exactly job, command, p (3 decimals max); sorted; no string over 40 characters.
- `tests/test-399-capability-labels.cjs`: legs C1-C4, F1-F6, G1 (11 checks). F5 and F6 are additions: script has no home path or network use; tests/ is not in the npm files list.
- Review file: 8 headings (title plus 7 sections). Section 7 holds 132 band pairs and a 30-row sample ordered by sha256 of "job|command"; the script that computes sections 6 and 7 is at the end of the file.

## Deviations from Plan

### Plan statement not matched by the tree

- Plan says `build-connector-registry.cjs --check` GAP count must stay 20. In this worktree the check exits 0 and prints "connector-registry: OK" with 0 GAP lines (the check hard-fails on any gap since the R9 flip). Same observation as 399-02. The intent (no new gap) holds: 0 gaps after the change.
- Plan lists the acceptance on test-361 and test-363.1: both exit 0 (11 legs and 6 checks passed).

No auto-fixes were needed.

## Verification

- `node tests/test-399-capability-labels.cjs`: 11 passed, 0 failed.
- `bash tests/run-all-399.sh`: 4 PASSED lines.
- `grep -l '^serves_jtbd:' agents/*.md`: exactly research.md and reverse-salient-agent.md.
- `node tests/test-361-agent-contract.cjs`: PASSED (11 legs). `node tests/test-363.1-agent-isolation.cjs`: 6 passed, 0 failed.
- `node scripts/build-connector-registry.cjs --check`: exit 0, OK.
- Fixture: 1469 pairs; `grep -c 'MindrianOS/research\|/home/' scripts/derive-decision-fixture.cjs` prints 0.
- Review file: 8 `## ` headings, 0 em or en dashes, 30 sample rows that match the recomputed sample, not under data/ or docs/.
- Pre-commit hooks ran on all 3 commits and passed (only pre-existing advisory WARN lines).

## Risks and open items

- The fixture holds raw model probabilities. They are build input only and must not reach navigator-visible text (I-06). tests/ does not ship.
- The 6 capability labels are rule-applied, not owner-ruled (`ruled_by` says so). The owner reviews them in section 4 of the review file.
- Section 6 of the review file reads a private file; recompute it after the registry or mirrors change.
- Held pairs, doubtful labels, 5 open taxonomy items, 13 skill proposals, 9 skill pairs and the 0.70-0.89 band stay with the owner.

## Known Stubs

None.

## Threat Flags

None. The new frontmatter key is read by no host loader pass beyond the existing agent contract tests, which pass.

## Self-Check: PASSED

- Files found: data/capability-job-labels.json, scripts/derive-decision-fixture.cjs, tests/fixtures/399/recorded-job-command-yes-no.json, tests/test-399-capability-labels.cjs, 399-LABEL-REVIEW.md.
- Commits found: ccead9d71, 2d64db4a4, 6d761a768.
