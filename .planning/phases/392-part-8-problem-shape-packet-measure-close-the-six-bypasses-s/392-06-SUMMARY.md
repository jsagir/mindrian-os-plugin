---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 06
subsystem: part8-egress-guard
tags: [part8, bypass-5, matcher, theo-routes, tool-classes, d-08, wave4]
requires: ["392-02", "392-05"]
provides:
  - "hooks/hooks.json PreToolUse and PostToolUse matchers and BRAIN_SHAPED_TOOL_MATCHER: one byte-identical string that sees every Theo route Claude Code can call, both cases of the known connector literals"
  - "BRAIN_TOOL_MATCHER (trust) without the pws-brain-mcp literal (D-08)"
  - "data/theo-tool-classes.json: the closed class table of every Theo tool name (content, operational, auth), schema_version 1"
  - "part8-egress-guard.cjs _theoToolClass, _genericContentVerdict, TOOL_CLASSES, CONTENT_STRING_CAP: operational tools allowed by class without a scan, content tools without a typed arm decided on every string leaf with a 256 character cap"
  - "tests/fixtures/392-part8-replay/route-matrix.json in state theo_routes_closed"
  - "tests/test-392-bypass-5-theo-tool-arms.cjs (B0 to B11)"
affects: [392-09, 392-11, 392-14, 392-15]
tech-stack:
  added: []
  patterns: ["class table read once with fs.readFileSync, never require, so the hook's fresh-process module count stays flat (LZ5)", "a rule, not a roster: the brain_* suffix rule inspects any server's brain_* call; the class table decides scan or allow by bare tool name", "fixture rewritten by hand to the target state, RED on the live matchers, GREEN after the change"]
key-files:
  created:
    - data/theo-tool-classes.json
    - tests/test-392-bypass-5-theo-tool-arms.cjs
  modified:
    - hooks/hooks.json
    - lib/core/brain-response-sanitize.cjs
    - lib/core/part8-egress-guard.cjs
    - tests/fixtures/392-part8-replay/route-matrix.json
    - tests/test-260906-gr1-brain-shaped-tool-gate.cjs
    - tests/test-brain-response-sanitize.cjs
    - tests/test-btm-theo-is-the-brain.cjs
    - tests/test-260917-dgf-part8-hook-disposition.cjs
    - docs/GROUNDING-SOURCES.md
    - CLAUDE.md
    - references/capability-radar/changelog-cache.md
    - data/capability-ledger.json
    - lib/mcp/brain-composition-census.cjs
    - scripts/part8-egress-guard-hook.cjs
    - scripts/brain-response-sanitize-hook.cjs
decisions:
  - "The matcher string is the plan's string, unchanged. mcp__pws-brain-mcp__brain_ask therefore stays SEEN through the connector-agnostic brain_* suffix rule (gr1: a rule, not a roster; inspected, never trusted); only the server literal is retired, so mcp__pws-brain-mcp__search is unseen. The fixture records that state; the plan's sentence 'all three false' for every pws-brain-mcp name is not satisfiable with the plan's own string, and inspecting more is the fail-closed side."
  - "BRAIN_TOOL_MATCHER (trust) only drops the pws-brain-mcp literal; it does not take the widened string (that would trust mcp__evil-brain__brain_ask and break the gr1 T3 split). The widened string is the inspection scope only."
  - "The class table is read with fs.readFileSync, not require, and only for a name that is not brain_*: the hook's fresh-process module count stays at 174 (LZ5 before line 175)."
  - "The generic content arm never reaches a tool that already has an exact-key typed arm (TYPED_READ_TOOLS, the 9 known shapes of _proveKnownToolShape, brain_*): those keep the fail-closed ambiguous on schema drift (386-25 TB2). It sits after the navigator release arm (3c)."
  - "auth class: declared in the schema and handled by the guard (allow, class auth_tool, no scan) with ZERO members. The theo-context /mcp-auth endpoint serves the same tool catalog behind OAuth; no tool-level auth name exists at theo-context-fit HEAD 3cea468 or theo-claude HEAD 36d87d9. A name that is not in the table is content and scanned."
  - "operational names beyond Theo's five (suggest_next, context_assemble, claim_write) are declared ahead of Theo's absorption as the plan's behavior text names them; Theo HEAD 82419eb6 registers room_bind, graph_write, gate_render, gate_answer, chain_run."
metrics:
  duration: "about 35 min (2026-11-09 19:45Z first read to 20:20Z; commit clock 20:03Z to 20:18Z)"
  tasks: 3
  files: 17
  completed: 2026-11-09
---

# Phase 392 Plan 06: Bypass 5 (every Theo route seen, tool classes, D-08) Summary

The three Part 8 matchers are one byte-identical string that sees every Theo route Claude Code can call (plugin and project mindrian-brain, mcp__[Tt]heo__*, mcp__[Tt]heo-context__*, mcp__claude_ai_[Tt]heo*__*, mcp__claude_ai_PWS_[Bb]rain__*, plus any server's brain_* call); every Theo tool name has a declared class in data/theo-tool-classes.json (content 56, operational 8, auth 0; unknown = content), operational tools are allowed by class without a scan, content tools without a typed arm are decided on every string leaf with a 256 character cap, and pws-brain-mcp is retired from the trust matcher, the hook matchers and the living docs (D-08). Replay after the change: extended_blocked 8 of 535 (baseline 8), must_refuse_blocked 10 of 10; the fixture-only matrix is byte-identical to the tree before this plan.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | route matrix fixture rewritten to the closed state | 6c03a3db6 | tests/fixtures/392-part8-replay/route-matrix.json |
| 1 GREEN | the three matchers widened, pws-brain-mcp retired from the matchers | 25ee7a38a | hooks/hooks.json, lib/core/brain-response-sanitize.cjs, tests/test-260906-gr1-brain-shaped-tool-gate.cjs, tests/test-brain-response-sanitize.cjs, tests/test-btm-theo-is-the-brain.cjs, tests/test-260917-dgf-part8-hook-disposition.cjs |
| 2 RED | failing test for the class table and the typed arms | 6c9196cca | tests/test-392-bypass-5-theo-tool-arms.cjs |
| 2 GREEN | class table, operational allow by class, generic content arm | 9a4ddd1af | data/theo-tool-classes.json, lib/core/part8-egress-guard.cjs, tests/test-392-bypass-5-theo-tool-arms.cjs |
| 3 | pws-brain-mcp retired from the living docs and route comments | 0ef49e79c | docs/GROUNDING-SOURCES.md, CLAUDE.md, references/capability-radar/changelog-cache.md, data/capability-ledger.json, lib/mcp/brain-composition-census.cjs, scripts/part8-egress-guard-hook.cjs, scripts/brain-response-sanitize-hook.cjs, lib/core/brain-response-sanitize.cjs, lib/core/part8-egress-guard.cjs |

Plans 392-10 (commits 40ab3e5c1, 91f7e44ca, 91d428b18) ran in parallel on the same branch; its files (lib/core/brain-client.cjs, lib/mcp/brain-router.cjs, tests/test-339-theo-ask-compose.cjs, tests/test-392-compose-envelope.cjs) were not touched by this plan.

## RED failure lines

Task 1, `node tests/test-392-theo-route-matrix.cjs` against the closed-state fixture on the beta.81 matchers (exit 1, Checks 25, Failed 15):

```
FAIL [R2] mcp__theo__search hook=false post=false shaped=false (fixture: hook=true post=true shaped=true)
FAIL [R2] mcp__theo__search_theo_chunks_fulltext ...   FAIL [R2] mcp__theo__text2cypher ...
FAIL [R2] mcp__theo__recommend_chain ...               FAIL [R2] mcp__theo__classify_problem_type ...
FAIL [R2] mcp__theo__case_story ...                    FAIL [R2] mcp__theo__room_bind ...
FAIL [R2] mcp__theo-context__canon_search ...          FAIL [R2] mcp__theo-context__normalize_framework_name ...
FAIL [R2] mcp__claude_ai_Theo-Claude__canon_search ... FAIL [R2] mcp__claude_ai_Theo-Claude__framework_route ...
FAIL [R2] mcp__claude_ai_theo-claude__canon_search ... FAIL [R2] mcp__claude_ai_PWS_Brain__brain_ask ...
FAIL [R2] mcp__claude_ai_PWS_brain__brain_ask hook=false post=false shaped=false (fixture: hook=true post=true shaped=true)
FAIL [R2] mcp__pws-brain-mcp__search hook=true post=true shaped=true (fixture: hook=false post=false shaped=false)
```

The 15 RED names: the 7 mcp__theo__ non-brain_* names, the 2 mcp__theo-context__ names, the 5 claude_ai names (both cases), and mcp__pws-brain-mcp__search (seen on beta.81, retired now).

Task 2, `node tests/test-392-bypass-5-theo-tool-arms.cjs` after Task 1 and before the table and the guard change (exit 1, 4 passed, 8 failed):

```
FAIL - B0 data/theo-tool-classes.json ...            table missing at data/theo-tool-classes.json
FAIL - B1 every registered Theo tool name has a class ...   table not loaded
FAIL - B2 the connector tool names ... are in the table as content   table not loaded
FAIL - B3 _theoToolClass ...                          _theoToolClass is not exported
FAIL - B6 hook: mcp__theo__text2cypher ... params exits 2
  classify did not block: {"verdict":"ambiguous","class":"unknown","reason":"neither proven move-set nor content hit"}
FAIL - B7 hook: mcp__theo__room_bind {room} exits 0 ...
  exit 2, stderr: {"zones":{"header":"-- part 8 -- this may leak unknown -- pick --", ... "shape":"F.1" ...
FAIL - B8 hook: mcp__theo-context__canon_search with a generic query exits 0 ...
  generic query exit 2, stderr: {"zones":{"header":"-- part 8 -- this may leak unknown -- pick --", ...
FAIL - B10 the generic content arm ...
  unknown content tool with a generic string is ambiguous: {"verdict":"ambiguous","class":"unknown", ...}
```

B4 and B5 passed at that point because Task 1 had widened the matcher (mcp__theo__search is a typed freeform tool since 386-25, so once seen it blocked a paragraph). B9 (brain_write) and B11 (timing) passed before and after.

## The final matcher string

Three places, byte-identical (hooks/hooks.json PreToolUse part8-egress-guard-hook entry, PostToolUse brain-response-sanitize-hook entry, lib/core/brain-response-sanitize.cjs BRAIN_SHAPED_TOOL_MATCHER):

```
mcp__(?:(?:plugin_[A-Za-z0-9_-]+_)?mindrian-brain__.*|[Tt]heo__.*|[Tt]heo-context__.*|claude_ai_[Tt]heo[A-Za-z0-9_-]*__.*|claude_ai_PWS_[Bb]rain__.*|[A-Za-z0-9_-]+__brain_[a-z0-9_]+)
```

BRAIN_TOOL_MATCHER (trust): `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*` (the pws-brain-mcp alternation removed, nothing else changed). SHIM_BACKED_BRAIN_TOOL_MATCHER unchanged.

Route matrix (state theo_routes_closed, 20 names): every mcp__theo__*, mcp__theo-context__*, claude_ai Theo and PWS_Brain name in both cases is seen by all three; mcp__pws-brain-mcp__brain_ask is seen through the brain_* suffix rule (inspected, never trusted: isBrainTool false, isShimBackedBrainTool false); mcp__pws-brain-mcp__search and the control mcp__notion__search are unseen. `printGap`: hook_sees=false for 0 mcp__theo* names. The local mindrian-os server (mcp__mindrian-os__room_bind, mcp__plugin_mos_mindrian-os__graph_write) stays outside the scope (gr1 GROUP 3 disjointness: 13 of 13 pass).

## The class table (data/theo-tool-classes.json)

schema_version 1; source Theo HEAD 82419eb6 (content 42, operational 5, health 1, read 2026-11-09), theo-context-fit HEAD 3cea468, theo-claude HEAD 36d87d9; default_class content; retired_servers [pws-brain-mcp].

| Class | Count | Members |
|-------|-------|---------|
| content | 56 | the 42 Theo content tools (brain_ask, brain_query, brain_schema, brain_search, brain_stats, brain_write, case_story, chapter_sequence, classify_problem_type, command_neighborhood, commands_for_problem_type, concept_relations, discover_structure, feeds_into_chains, find_bottlenecks, find_chapter_for_need, find_connections, find_frameworks_for_problem_type, find_whitespace, framework_concepts, framework_neighborhood, framework_run_plan, framework_step, framework_techniques, method_claims, nest_contract, normalize_framework_name, normalize_taxonomy_term, orchestration_readiness, persona_card, rank_influence, recommend_chain, schema_mapping_fit, search, search_theo_chunks_fulltext, step_sources, structural_neighbours, taxonomy_ladder, text2cypher, theo_neighborhood, visualize_chain, visualize_framework_map), theo_health, and the 13 connector names not in Theo's catalog (canon_search, framework_connection, framework_route, framework_steps, problem_lenses, glossary_taxonomy, framework_walkthrough, larry_move, framework_cards, prepare_feedback, review_guide, show_theo_face, practitioner_workspace) |
| operational | 8 | room_bind, graph_write, gate_render, gate_answer, chain_run (Theo's five) plus suggest_next, context_assemble, claim_write (named by the plan and the Theo CLAUDE.md as the absorbed surface) |
| auth | 0 | none verified (see Decisions) |
| retired | server key | pws-brain-mcp (the server, not a tool name; its brain_* calls are inspected by the suffix rule) |

Connector counts read from the repos: theo-context-fit server.js registers 15 tools (the plan's MAPS.md says 14), theo-claude theo-core.js registers 15; the union with Theo's catalog is what the table carries.

## What changed in the guard (lib/core/part8-egress-guard.cjs)

- After `_typedToolBase`: `TOOL_CLASS_TABLE_PATH`, `TOOL_CLASSES`, `CONTENT_STRING_CAP = 256`, `KNOWN_SHAPE_TOOLS` (the 9 names `_proveKnownToolShape` decides), `_hasTypedArm(base)`, `_loadToolClassTable()` (fs.readFileSync once; unreadable or malformed = null = every name is content), `_theoToolClass(toolName)` (brain_* and empty = content without a read; unknown = content), `_genericContentVerdict(payload, opts)`.
- `classify` step 0a (after the non-object check, before normalisation and the default-deny scan): class operational -> `{verdict: 'allow', class: 'operational_tool'}`, class auth -> `auth_tool`; no scan. The hook's `bestEffortRecord` writes `verdictObj.class`, so telemetry records the class (T-392-17).
- `classify` step 3d (after the navigator release arm 3c, before the terminal ambiguous): a name with no typed arm goes to `_genericContentVerdict`: every string leaf collected by the 392-05 walker (over budget blocks unread); a leaf longer than 256 characters blocks `content_set` with reason `string_over_cap`, `leaf_path` and `cap`; a payload with a FREEFORM_KEYS key goes to `theoVerdict` (primary first, every other leaf, strictest wins); otherwise each leaf is decided by `_theoStringVerdict` with the room resolved once, the first block returns with `leaf_path`, an allow is `typed_question` when every leaf proved and `generic_question` otherwise; a payload with no string leaf returns null and the terminal ambiguous stands (the gate decides).
- brain_write: unchanged, `write_blocked` at step 1c on every route (B9).
- Exports added: `_theoToolClass`, `_genericContentVerdict`, `TOOL_CLASSES`, `CONTENT_STRING_CAP`.

Timing (B11): the class lookup costs 0.04 ms per classify call (mean of 20 names, warm); the hook wall time on the 20-name sample (spawnSync, PART8_FORCE_BRAIN_AVAILABLE=1, synthetic room bound through CLAUDE_ACTIVE_ROOM): mean 168 ms, max 190 ms (a second run: mean 182 ms, max 382 ms), budget 2,000 ms. LZ5: guard 172 to 11; hook 175 to 174; statusline 182 to 18 (unchanged).

## Replay matrix (scratch, not committed)

`node tests/helpers/part8-overblock-replay.cjs --record <scratch>/392-after-06-full.json --real-calls $HOME/.mindrian/part8-replay/real-calls.jsonl --guard-head 0ef49e79c`, 820 rows (694 fixture, 126 real-call), network_calls 0.

| Number | beta.81 baseline | after 392-06 |
|--------|------------------|--------------|
| extended_blocked | 8 of 535 | 8 of 535 |
| must_refuse_blocked | 10 of 10 | 10 of 10 |
| set P / ADV / C / R (allow, ambiguous, block) | 5,0,10 / 4,0,19 / 606,0,50 / 115,2,9 | 5,0,10 / 4,0,19 / 606,0,50 / 115,2,9 |
| total 820 | 730, 2, 88 | 730, 2, 88 |
| by_group | | equal |
| by_tool | | equal |
| by_class | generic_question 670, typed_question 49 | generic_question 671, typed_question 48 (every other class equal) |

The one row that moved from typed_question to generic_question (both allow) is in the real-call set R, not in the fixtures: a fixture-only replay on a `git archive 5f6bb8e26` export (the tree before this plan, node_modules linked) and on this tree are byte-identical in by_verdict (615, 0, 79), by_class (generic 566, typed 47), by_token_class and by_tool. The move therefore predates this plan (the 392-03 tokenizer, which fails the typed proof on a non-vocabulary character, is the likely cause) and this plan changes no replay row.

## Living-doc changes (Task 3, D-08)

`grep -rl "pws-brain-mcp" agents skills commands references README.md CLAUDE.md docs/GROUNDING-SOURCES.md .mcp.json lib scripts hooks` classified:

| File | Class | Action |
|------|-------|--------|
| docs/GROUNDING-SOURCES.md:46 (Theo entry: "the pre-scoped successor that pws-brain-mcp cuts over to ... not deployable yet") | living, stale | rewritten: Theo is the Brain since Phase 339; the Memgraph-era direct connector is retired (Phase 392, D-08, 2026-11-08); every Brain route is mindrian-brain or a Theo server |
| CLAUDE.md:114 (tech-stack row) | living (in the plan's verify grep list, not in files_modified) | the connector host name removed; the retirement sentence added |
| references/capability-radar/changelog-cache.md:58 | living view (regenerated from data/capability-ledger.json) | the truncation note names the retired connector without the key |
| data/capability-ledger.json:456 (the source of that view) | living source | the same sentence; line 267 (a quoted matcher string as audit evidence) left byte-identical |
| hooks/hooks.json:208, :321 | matcher | Task 1 |
| lib/core/brain-response-sanitize.cjs (:61, :125 and the docblocks) | matcher and route docblocks | Task 1 and Task 3 (no literal left) |
| lib/core/part8-egress-guard.cjs:443, :751 (comments) | route comments | reworded (no literal left) |
| scripts/part8-egress-guard-hook.cjs (docblock :33, :47, :64, :97, comment :298) | route docblock | reworded; a Phase 392 paragraph added |
| scripts/brain-response-sanitize-hook.cjs:12 | route docblock | reworded |
| lib/mcp/brain-composition-census.cjs:63-66 | living note ("the hooks keep the pws-brain-mcp key") | the sentence now records the removal from the matchers (the literal stays, as the name of the retired key) |
| lib/core/enrichment-queue.cjs:492 (dated RUN 3, 2026-08-11 note on the refusal shape) | historical | unchanged |
| scripts/part8-real-calls-extract.cjs (:14, :51, :52, :199) | historical extraction (reads past transcripts that went through that connector) | unchanged |
| agents/*.md | no hit | no change; `node scripts/build-connector-registry.cjs --check` OK and `node scripts/check-shape-declaration.cjs --check` exit 0 run anyway |
| docs/autopsies, dated HANDOFF files, docs/257-NOTE, CHANGELOG, tests that pin history | historical | unchanged (the four test pins that assert the CURRENT matcher are listed under Deviations) |

Task 3 verify: living hits 0 (the plan's grep list); connector registry OK.

## Verification

- `node tests/test-392-theo-route-matrix.cjs`: Checks 25, Failed 0, state theo_routes_closed, 0 mcp__theo* gap names (PROVEN).
- `node tests/test-392-bypass-5-theo-tool-arms.cjs`: 12 passed, 0 failed, 0 skipped; live Theo catalog content 42, operational 5, health 1 (PROVEN).
- `node tests/test-260906-gr1-brain-shaped-tool-gate.cjs`: pass 13, fail 0 (12 before; the RETIRED group added) (PROVEN).
- `node tests/test-386-typed-theo-allow-arms.cjs`: ALL PASS (PROVEN).
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0 (PROVEN). LZ5 line: guard 172 to 11; hook 175 to 174; statusline 182 to 18.
- `bash tests/run-all-392.sh`: PASS=14 FAIL=0 SKIP=0 (14 files, this plan's test and the 392-10 compose test included) (PROVEN).
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed (PROVEN).
- `node tests/test-brain-response-sanitize.cjs`: pass 20, fail 0; `node tests/test-btm-theo-is-the-brain.cjs`: 6 passed; `node tests/test-260917-dgf-part8-hook-disposition.cjs`: all legs green; `node tests/test-386-web-credential-hook.cjs`: all arms passed; `node tests/test-239-brain-tool-liveness.cjs` and `tests/test-239-verify-release-section-18.cjs`: exit 0 (PROVEN).
- `node scripts/check-brain-tool-liveness.cjs` (verify-release section 19 gate): RESULT OK, every hook matcher matches at least one live name, exact claims 10 of 10 live (PROVEN).
- `python3 -c "import json; json.load(open('hooks/hooks.json'))"` and the plan's one-liner (hooks.json carries BRAIN_SHAPED_TOOL_MATCHER, no pws-brain-mcp): ok (PROVEN).
- Scratch matrix: extended_blocked 8 of 535, must_refuse_blocked 10 of 10 (PROVEN; table above).
- tests/test-389-seed-egress.cjs is absent on this branch (rebase onto the release session's commits pending, D-07); not run.
- Dash check (em dash, en dash) on the 9 files written or edited by this plan's code and fixtures: 0.
- `bash scripts/verify-release`: 36 passed, 0 failed, 2 warnings (38 checks), exit 0; section 19 Brain Tool Liveness Gate PASS ("Every Brain hook matcher and agent allowed-tools entry names a live MCP tool") (PROVEN, 2026-11-09 20:19Z).
- `node scripts/doctor.cjs --acceptance`: 24 of 25 points passed; the one FAIL is `verify-release-clean-tree` (tracked-file drift: 2 files), which is the pre-existing uncommitted state of .planning/ROADMAP.md and .planning/STATE.md on this branch (owned by the orchestrator and the wave ledger, present before this plan started and not touched by it). Every other point PASS; WARNs: 3 ambiguous AgentShield findings (no flagged), the real-room receipt is behind HEAD (expected on a work branch). Note: the doctor point `version-of-record-published` runs `npm view`, so the acceptance roll-up itself made one registry read; this plan's own tests and scripts made none (network_calls 0 in the replay) (PROVEN).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Four pinned tests asserted the pre-D-08 matchers**
- **Found during:** Task 1 GREEN
- **Issue:** tests/test-brain-response-sanitize.cjs:334 pins the BRAIN_TOOL_MATCHER literal with pws-brain-mcp; tests/test-btm-theo-is-the-brain.cjs C6 requires every hooks.json matcher naming mindrian-brain to name pws-brain-mcp; tests/test-260917-dgf-part8-hook-disposition.cjs LEG2-4 requires isBrainTool(mcp__pws-brain-mcp__brain_search) true. The plan lists only gr1 as the pinned test to change.
- **Fix:** each pin reversed for the one reason D-08 gives, with the comment naming the plan: the literal without pws-brain-mcp; C6 asserts no matcher names it and the suffix rule still inspects a legacy brain_* call; LEG2-4 false plus LEG2-4b (still inspected).
- **Files modified:** tests/test-brain-response-sanitize.cjs, tests/test-btm-theo-is-the-brain.cjs, tests/test-260917-dgf-part8-hook-disposition.cjs
- **Commit:** 25ee7a38a

**2. [Rule 1 - Bug in the first GREEN] The generic content arm reached tools with a typed arm**
- **Found during:** Task 2 GREEN (test-386-typed-theo-allow-arms TB2: an extra key on a typed tool must stay ambiguous)
- **Issue:** the first generic arm decided every non-brain_* content tool, so search {query, extra} became allow/generic_question instead of the fail-closed ambiguous of plan 386-25.
- **Fix:** `_hasTypedArm` (TYPED_READ_TOOLS, the 9 known shapes, brain_*) excludes those names from the generic arm; B10 pins the same fact.
- **Files modified:** lib/core/part8-egress-guard.cjs, tests/test-392-bypass-5-theo-tool-arms.cjs
- **Commit:** 9a4ddd1af (fixed before the GREEN commit)

**3. [Rule 1 - Table incomplete] discover_structure missing from the first table**
- **Found during:** Task 2 GREEN (B1 live read)
- **Fix:** added as content (the live read is the authority; 42 content names).
- **Commit:** 9a4ddd1af

**4. [Plan contradiction, decided] The plan's matcher string and its fixture sentence disagree on mcp__pws-brain-mcp__brain_ask**
- The plan's string keeps the brain_* suffix rule, which matches mcp__pws-brain-mcp__brain_ask. The plan's fixture sentence says every pws-brain-mcp name is false. The string was kept (the orchestrator named it as the one string; a rule, not a roster; inspection is the safe side) and the fixture records brain_ask seen, search unseen. gr1's new RETIRED group pins not trusted, not shim-backed, still inspected.

**5. [Scope] Living files outside files_modified changed for the D-08 grep**
- CLAUDE.md:114 and references/capability-radar/changelog-cache.md:58 are in the plan's verify grep list but not in files_modified; data/capability-ledger.json:456 is the source the view regenerates from; lib/mcp/brain-composition-census.cjs, scripts/part8-egress-guard-hook.cjs and scripts/brain-response-sanitize-hook.cjs are living route comments the classify grep found. Each line is listed in the table above. Commit 0ef49e79c.

### Not done, by evidence

- **auth class members:** none. The plan names "the theo-context /mcp-auth tools". At theo-context-fit HEAD 3cea468 the /mcp-auth route serves the same tool catalog behind OAuth and registers no auth-only tool; theo-claude HEAD 36d87d9 has none either. The class exists in the schema and the guard (allow, auth_tool, no scan) with zero members, so nothing is allowed by it until a name is declared.

## TDD Gate Compliance

Task 1: RED 6c03a3db6 (test), GREEN 25ee7a38a (feat). Task 2: RED 6c9196cca (test), GREEN 9a4ddd1af (feat). Task 3 is not a TDD task (docs). No refactor commit.

## Known Stubs

None. The auth class with zero members is a declared state (nothing is allowed by it), not a stub.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new unscanned allow | lib/core/part8-egress-guard.cjs step 0a | an operational-class Theo tool is allowed without a scan BY DESIGN (room content is its job). The class comes only from the committed table (T-392-16); a name absent from the table is scanned; brain_write is content and blocked. The table is read from the plugin's own data directory with no user input in the path. |
| threat_flag: wider PostToolUse scope | hooks/hooks.json :321 | the response sanitizer now runs on every Theo route, including operational tool responses (room_bind, graph_write); it redacts PII-shaped text in those responses too. The PostToolUse hook does not read the class table. Intended by the plan (every Theo route seen by the sanitizer); recorded here because a legitimate room value in an operational response can now be redacted on the way back. |

T-392-15 mitigated (both cases tested in the route matrix and B4; three matchers byte-identical; local server names excluded). T-392-17 mitigated (the hook records the verdict class, operational_tool included; class only).

## Self-Check: PASSED

Files: hooks/hooks.json, lib/core/brain-response-sanitize.cjs, lib/core/part8-egress-guard.cjs, data/theo-tool-classes.json, tests/test-392-bypass-5-theo-tool-arms.cjs, tests/fixtures/392-part8-replay/route-matrix.json, tests/test-260906-gr1-brain-shaped-tool-gate.cjs, docs/GROUNDING-SOURCES.md exist. Commits 6c03a3db6, 25ee7a38a, 6c9196cca, 9a4ddd1af, 0ef49e79c exist in `git log` on work/part8-shape-packet. STATE.md and 392-WAVES.md were not edited (the orchestrator owns them). The SUMMARY is under `.planning/*` (force-tracked), added with `git add -f`.
