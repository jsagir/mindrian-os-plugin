# Phase 388 decision card: ship less (tests and dead weight out of the install)

## 1. Summary

- 222 files and 2,861,559 unpacked bytes leave the npm package. That is 6.18 percent of the unpacked size.
- Entries go from 2,416 to 2,194. Unpacked size goes from 46,286,265 to 43,425,555 bytes. Packed size goes from 14,039,639 to 13,327,216 bytes (about 0.7 MB less to download).
- The list is 208 test files (`*.test.cjs`), 2 test runners, 8 Python `.pyc` files, 3 data files and 1 HTML template. The repo keeps all of them. Only the package list changes.
- Users lose the ability to run shipped tests from the install. They keep every product behavior that plan 388-02 exercised (hooks, MCP tools, doctor points).
- Recommendation: APPROVE, and keep the eureka_critic baseline where it is.

## 2. Proposed exclusion list

Each pattern is a `files` negation for package.json, appended after the existing entries. The probe in section 3 shows that the patterns remove exactly the 222 paths below and nothing else. Evidence for every member: 388-safe-set.tsv verdict SAFE, except the two rows marked OWNER (see the note under the table).

| Pattern | Class | Files | Bytes | Plan 388-02 evidence | Owner-visible effect |
|---|---|---|---|---|---|
| `!data/arbitration-rule-catalogue.json` | T7 | 1 | 19650 | SAFE, only repo tests and build scripts name it | none seen in any probe |
| `!data/capability-map-registry.json` | T7 | 1 | 1005 | SAFE | none seen |
| `!data/connector-out-of-spine-allowlist.json` | T7 | 1 | 7262 | SAFE | none seen |
| `!lib/__pycache__/*.pyc` | T4 | 1 | 154 | SAFE, Python rebuilds it | none |
| `!lib/conversation/*.test.cjs` | T1 | 2 | 12475 | SAFE | cannot run these tests from the install |
| `!lib/core/*.test.cjs` | T1 | 39 | 396573 | SAFE | same |
| `!lib/core/__pycache__/*.pyc` | T4 | 7 | 91512 | SAFE | none |
| `!lib/core/breakthrough/*.test.cjs` | T1 | 11 | 123619 | SAFE | same |
| `!lib/core/migrations/*.test.cjs` | T1 | 1 | 6706 | SAFE | same |
| `!lib/core/navigation/*.test.cjs` | T1 | 2 | 9878 | SAFE | same |
| `!lib/core/security/*.test.cjs` | T1 | 2 | 17769 | SAFE | same |
| `!lib/core/telemetry/*.test.cjs` | T1 | 3 | 26844 | SAFE | same |
| `!lib/core/temporal/*.test.cjs` | T1 | 7 | 52110 | SAFE | same |
| `!lib/hmi/*.test.cjs` | T1 | 7 | 34336 | SAFE | same |
| `!lib/import/*.test.cjs` | T1 | 12 | 93219 | SAFE | same |
| `!lib/import/run-all-tests.cjs` | T2 | 1 | 1081 | OWNER (see note) | its tests leave, so it leaves |
| `!lib/mcp/app-html/mindrian-platform.html` | T7 | 1 | 57150 | SAFE, no loader names it (app-views.cjs loads decision, rooms, dashboard, graph and wiki by literal name) | none |
| `!lib/memory/!(feynman-prompts-drift\|post-compact-reinjection).test.cjs` | T1 | 117 | 1716452 | SAFE (the two excluded names are NEEDED: skills/mos-reason/SKILL.md:197 and scripts/post-compact:300) | same |
| `!lib/memory/run-feynman-tests.cjs` | T2 | 1 | 157044 | OWNER (see note) | its tests leave, so it leaves |
| `!lib/render/*.test.cjs` | T1 | 1 | 10492 | SAFE | same |
| `!lib/vault/*.test.cjs` | T1 | 1 | 6483 | SAFE | same |
| `!lib/workflow/*.test.cjs` | T1 | 3 | 19745 | SAFE | same |

Note on the two OWNER rows. The runners lib/memory/run-feynman-tests.cjs and lib/import/run-all-tests.cjs are UNCERTAIN in 388-safe-set.tsv, only because two doctor source lints (the python-floor walk in scripts/doctor.cjs and scripts/check-render-coverage.cjs) read their text. The owner ruled on 2026-11-06 that the runner leaves with the tests (Fork 1) and that the lints stay as they are (Fork 2). The lints stay, and they simply read fewer files. A new differential run removed all 222 paths (the 220 SAFE rows plus these two) from a scratch install: 0 unstable probes and no difference in 40 hook commands, 75 MCP tools for both client identities, 8 read-only tool calls and 50 doctor points. The probe accepts these two paths only through the explicit `--approve` option.

## 3. Before and after

Measured by `388-measure.cjs probe-patterns`: it packs the repo, extracts the tarball in a scratch folder, appends the patterns to the extracted package.json files list, and runs `npm pack --dry-run --json --ignore-scripts` before and after. The repo package.json is not touched. Per path results are in 388-pattern-probe.tsv.

BEFORE: entryCount=2416 size=14039639 unpackedSize=46286265
AFTER: entryCount=2194 size=13327216 unpackedSize=43425555

Taken at HEAD 4ec4efdfc5659771fb9f6c40910f4b23f3c78a7d. A peer session changes shipped files: a drift check at the start of this plan showed 6 shipped files with changed bytes since the plan 388-01 baseline (same path set, none a candidate). Plan 388-04 re-measures before it edits anything.

## 4. Owner-visible effects

- No shipped test can be run from the install (208 test files and both runners). Today it works: 3 of 4 sampled tests ran from the extracted package. This is a developer or support use. The repo keeps every test.
- No hook, MCP tool list, read-only tool answer or doctor point changes (plan 388-02, section 4 of 388-RUNTIME-NEED.md, repeated here with the 222-path run).
- Doctor reads of `tests/` already meet an absent path in every install ("driver missing", "claim harness missing", "skip"). Nothing new.
- The two doctor source lints read 222 fewer files. Their statuses did not change.
- One data citation stops being true and no reader notices: data/first-reward-surfaces.json names lib/core/mva-rule-linter.test.cjs (the reader only parses the text).
- The Desktop copy shrinks by the same 222 files (arithmetic; the Desktop build was not run).
- The 8 `.pyc` files are rebuilt by Python when needed (ASSUMED; Python was not traced).
- Added by the probe: the glob `!lib/memory/!(a|b).test.cjs` (an extended glob) works in npm: it removed exactly 117 files and kept the two named ones.

## 5. Not recommended (left in the package)

- Class T8 (14 test-only modules, 41,849 bytes): RULED-KEEP by the Phase 385 owner ruling R9 and R10. This card respects it.
- UNCERTAIN, 166 files after the two runners above (2,545,395 bytes): 130 files that the two doctor lints read (by class: T1 39, T7 71, T6 14, T5 3, T4 3, the rest T2 runners already moved to the list), and 36 files kept by a dynamic read or by a kept reader (scripts/run-harness.cjs lists data/harness-policies, scripts/check-hitl-stages.cjs and lib/core/eureka/grade-grant.cjs list their fixture folders, scripts/check-flagship-floor.cjs reads a data file, two python package markers). Owner Fork 2: the lints stay and these files stay.
- NEEDED, 60 files (325,209 bytes): 51 doc files whose names code uses, the two harness runner scripts, two tests that a skill and a hook name, the two fonts with their licence and provenance text, one query file.
- PAYLOAD-PINNED without an owner approved test edit: none of the 222 members is pinned. The five UNCERTAIN rows with that flag stay.
- The 29 `test-*.cjs` files: all kept (none is SAFE).
- Built runtime assets (lib/ui-shell/dist, lib/wiki/editor-dist, assets/fonts, 16,279,464 bytes) are runtime and are not part of this proposal.
- Protected paths (commands, skills, agents, pipelines, hooks, bin, .claude-plugin, output-styles, hook scripts, MCP server entries, evals/eureka/212-critic-baseline.json): never candidates; the probe exits 1 if one is removed.

## 6. The eureka_critic baseline question

- Option KEEP: the baseline stays at evals/eureka/212-critic-baseline.json. The package files list keeps `evals/eureka/212-critic-baseline.json` and `!evals/eureka/README.md`. No code change.
- Option MOVE: the baseline moves under data/. Files touched (fresh grep): package.json (the two evals entries), lib/core/eureka-critic.cjs line 533 (BASELINE_PATH), scripts/eureka-critic-run.cjs line 67 (BASELINE_PATH), evals/eureka/212-calibration-report.md line 144 (text), tests/test-quick-261106-critic-baseline-ships.cjs, tests/test-387-eureka-installed-layout.cjs, and the copy of the baseline file itself.
- A move saves no bytes. The file is 1,853 bytes in either place.
- Recommendation: KEEP. The owner ruling stands that the baseline stays shipped in the package list.

## 7. Recommendation and answers

Recommendation: APPROVE.

Allowed answer tokens:
- APPROVE: apply the list in section 2 to package.json, baseline KEEP.
- APPROVE-BASELINE-UNDER-DATA: apply the list and the MOVE in section 6.
- NO: apply nothing.

Plan 388-04 applies the list only if the token and LIST-SHA256 below match this card.

## 8. Answer block

LIST-SHA256: dce0040835ddffe8a31a4a1fc43b59a74991daa88170f3322e0b772a672416c1
HEAD-AT-DECISION: 4ec4efdfc5659771fb9f6c40910f4b23f3c78a7d
OWNER-ANSWER: APPROVE
OWNER-WORDS-FORK-1: Yes, take them out (Recommended)
OWNER-WORDS-FORK-2: Keep as is for now (Recommended)
OWNER-ANSWER-DATE: 2026-11-06 (relayed by the main session; baseline stays shipped, token APPROVE not APPROVE-BASELINE-UNDER-DATA)
