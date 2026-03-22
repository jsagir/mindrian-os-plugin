---
phase: 04-brain-mcp-toolbox
verified: 2026-03-22T14:45:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 4: Brain MCP Toolbox Verification Report

**Phase Goal:** Connect Larry's Brain (Neo4j 21K nodes + Pinecone 1.4K embeddings) via 8 MCP tools, 4 specialized agents (Brain, Grading, Research, Investor), 5 new commands, brain-connector skill with passive enrichment and proactive surfacing — the moat activates

**Verified:** 2026-03-22T14:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can run `/mindrian-os:setup brain` to connect Brain MCP via conversational credential flow | VERIFIED | `commands/setup.md` — conversational flow collects URI/user/password/Pinecone key, writes `.mcp.json` (merge-safe), tests both connections, reports success/failure, reminds about .gitignore |
| 2 | 8 Cypher/Pinecone query pattern templates exist as single source of truth | VERIFIED | `references/brain/query-patterns.md` — all 8 named patterns (brain_framework_chain through brain_search_semantic), all Cypher blocks have LIMIT clauses, How to Use section explains delegation model |
| 3 | Brain schema reference documents all node types, relationships, and properties | VERIFIED | `references/brain/schema.md` — 8 node types (Framework, Phase, Concept, ProblemType, Book, Tool, Course, Example), 8 relationships (FEEDS_INTO, TRANSFORMS_OUTPUT_TO, CO_OCCURS, ADDRESSES_PROBLEM_TYPE, HAS_PHASE, PREREQUISITE, APPLIED_IN, REFERENCES), grading calibration data, .mcp.json template, MCP tool naming convention |
| 4 | brain-connector skill passively enriches Larry responses and proactively surfaces max 2 HIGH-confidence findings | VERIFIED | `skills/brain-connector/SKILL.md` — Passive Enrichment section (framework mention + methodology session detection), Proactive Surfacing section (brain_gap_assess + brain_contradiction_check), Gating Rules (max 2, HIGH-confidence only, silent fallback), Delegation section to agents/brain-query.md |
| 5 | Brain Agent translates natural language to Cypher and returns insights, never raw data | VERIFIED | `agents/brain-query.md` — explicit "NOT Larry" voice, Query Protocol (adapt pattern → execute → synthesize), Multi-Hop Protocol (3-hop max), Pattern Selection Guide, "Never Do" list includes returning raw results |
| 6 | Grading Agent produces calibrated 5-component assessment scored against 100+ real projects | VERIFIED | `agents/grading.md` — Grading Protocol runs brain_grade_calibrate, scores Vision/Problem Definition/Feasibility/Market/Completeness with weights, computes percentile, structured output template with component scores table |
| 7 | Research Agent performs Tavily web search and cross-references with Brain semantic index | VERIFIED | `agents/research.md` — allowed-tools includes mcp__tavily-mcp__tavily-search and mcp__tavily-mcp__tavily-extract, Research Protocol covers search → extract → brain_search_semantic cross-reference → synthesize, provenance metadata on every filing |
| 8 | Investor Agent stress-tests from investor POV in distinct adversarial voice, not Larry's voice | VERIFIED | `agents/investor.md` — explicit "NOT Larry" declaration, signature VC phrases listed, runs brain_find_patterns + brain_contradiction_check + brain_gap_assess, severity-rated output (CRITICAL/SERIOUS/MINOR), Risk Matrix, "Critical Rules" block explicitly forbids Larry's voice |
| 9 | User can run 5 new Brain commands: suggest-next, find-connections, compare-ventures, deep-grade, research | VERIFIED | All 5 files exist in `commands/`. suggest-next uses brain_framework_chain, find-connections uses brain_cross_domain, compare-ventures uses brain_find_patterns, deep-grade delegates to agents/grading.md, research delegates to agents/research.md. All include Brain-not-connected fallback message |
| 10 | Existing diagnose, help, grade, pipeline commands upgraded with Brain Enhancement sections; mode engine gains Brain Calibration | VERIFIED | All 4 commands have "Brain Enhancement (Optional)" section at correct insertion point. mode-engine.md has Brain Calibration section with gap-informed/pattern-informed/stage-informed adjustments, 15% max delta rule, static curve as baseline |

**Score:** 10/10 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|---------------------|----------------|--------|
| `references/brain/schema.md` | 8 node types, 8 relationships, grading calibration data | Yes (72 lines) | Full tables for nodes + relationships, grading calibration section, .mcp.json template | Referenced by agents/brain-query.md, agents/grading.md, commands/setup.md | VERIFIED |
| `references/brain/query-patterns.md` | 8 named Cypher templates with LIMIT clauses | Yes (184 lines) | All 8 patterns present, every Cypher block has LIMIT, How to Use section, usage notes per pattern | Referenced by brain-connector SKILL.md, all 4 agents, diagnose/help/grade/pipeline commands | VERIFIED |
| `commands/setup.md` | Conversational Brain MCP setup with credential collection and connection test | Yes | Conversational flow, .mcp.json template inline, merge logic for existing .mcp.json, test for both Neo4j + Pinecone, success/failure messages, .gitignore reminder | Wired to .mcp.json pattern (setup writes config that brain-connector detects) | VERIFIED |
| `skills/brain-connector/SKILL.md` | Passive enrichment + proactive surfacing skill | Yes (44 lines, thin as required) | Detection, Passive Enrichment, Proactive Surfacing, Gating Rules, Delegation sections all present | Delegates to agents/brain-query.md, references references/brain/query-patterns.md | VERIFIED |

### Plan 02 Artifacts

| Artifact | Expected | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|---------------------|----------------|--------|
| `agents/brain-query.md` | GraphRAG expert — schema-aware Cypher query builder | Yes | Explicit NOT-Larry voice, Query Protocol, Multi-Hop Protocol (3-hop max), Pattern Selection Guide table | References references/brain/query-patterns.md + schema.md in Setup; delegated to by brain-connector, deep-grade | VERIFIED |
| `agents/grading.md` | Calibrated assessment engine with percentile ranking | Yes | 5-component scoring with weights, Grading Protocol uses brain_grade_calibrate, structured output template, percentile computation step | References query-patterns.md + schema.md; delegated to by commands/deep-grade.md and commands/grade.md Brain Enhancement | VERIFIED |
| `agents/research.md` | External intelligence with Tavily + Brain cross-reference | Yes | Tavily search + extract pipeline, brain_search_semantic cross-reference, provenance metadata format, user confirmation before filing | Allowed-tools includes mcp__tavily-mcp__tavily-search; delegated to by commands/research.md | VERIFIED |
| `agents/investor.md` | Adversarial investor persona with Brain pattern data | Yes | Explicit "NOT Larry" voice rules, signature VC phrases, Analysis Protocol runs brain_find_patterns + brain_contradiction_check + brain_gap_assess, severity-rated structured output | Allowed-tools include neo4j-brain + pinecone-brain; delegated to via commands referencing agents/investor | VERIFIED |

### Plan 03 Artifacts

| Artifact | Expected | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|---------------------|----------------|--------|
| `commands/suggest-next.md` | Graph-informed next step recommendation | Yes | Brain-not-connected check, brain_framework_chain + brain_find_patterns queries, Larry-voiced narrative synthesis, empty room fallback | References query-patterns.md; uses mcp__neo4j-brain + mcp__pinecone-brain in allowed-tools | VERIFIED |
| `commands/find-connections.md` | Cross-domain pattern discovery | Yes | brain_concept_connect + brain_cross_domain queries, "aha moment" framing, picks second domain automatically if only one provided | References query-patterns.md; uses mcp__neo4j-brain in allowed-tools | VERIFIED |
| `commands/compare-ventures.md` | Similar venture finder | Yes | brain_find_patterns + brain_search_semantic (Pinecone), aggregate pattern output with privacy rules (no individual student names), Larry framing | References query-patterns.md; uses mcp__neo4j-brain + mcp__pinecone-brain | VERIFIED |
| `commands/deep-grade.md` | Calibrated grading via Grading Agent | Yes | Brain check, delegates to agents/grading.md, Larry wraps results with teaching context, comparison table vs. /grade | Wired to agents/grading.md via explicit delegation instruction | VERIFIED |
| `commands/research.md` | External research via Research Agent | Yes | Delegates to agents/research.md, Larry contextualizes results, explicit user-confirms-before-filing rule | Wired to agents/research.md via explicit delegation instruction | VERIFIED |
| `commands/diagnose.md` (modified) | Brain Enhancement section adds graph-informed enrichment | Yes | "Brain Enhancement (Optional)" section present at line 16, brain_framework_chain + brain_find_patterns queries, additive (original Setup unchanged) | Pattern "brain_framework_chain" confirmed present; original Tier 0 flow intact | VERIFIED |
| `commands/help.md` (modified) | Brain Enhancement adds personalized recommendations | Yes | "Brain Enhancement (Optional)" section at line 15, brain_framework_chain + brain_gap_assess queries, original flow unchanged | Pattern queries confirmed; Brain-Powered commands listed in index | VERIFIED |
| `commands/grade.md` (modified) | Brain Enhancement routes to Grading Agent | Yes | "Brain Enhancement (Optional)" section at line 16, delegates to agents/grading.md when Brain connected, falls back to static rubric without Brain | agents/grading delegation confirmed | VERIFIED |
| `commands/pipeline.md` (modified) | Brain Enhancement adds dynamic chain suggestions | Yes | "Brain Enhancement (Optional)" section at line 16, brain_framework_chain for dynamic chains, static chains remain default | brain_framework_chain pattern confirmed | VERIFIED |
| `skills/larry-personality/mode-engine.md` (modified) | Brain Calibration section | Yes | "Brain Calibration (Optional)" at line 156, 3 adjustment types (gap-informed, pattern-informed, stage-informed), 15% max delta rule, static curve as baseline | Brain queries referenced (brain_gap_assess, brain_find_patterns, brain_framework_chain) | VERIFIED |
| `references/methodology/index.md` (modified) | Lists all 31 commands including 5 Brain-powered | Yes | "Brain-Powered Commands (5)" section with all 5 commands, "Requires Brain" notation on each, "research" command present | All 5 commands confirmed: suggest-next, find-connections, compare-ventures, deep-grade, research | VERIFIED |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `skills/brain-connector/SKILL.md` | `references/brain/query-patterns.md` | on-demand reference loading | WIRED | Line 17: "brain_concept_connect pattern from `references/brain/query-patterns.md`" |
| `commands/setup.md` | `.mcp.json` | writes MCP config to user workspace | WIRED | Lines 39-70: "Write .mcp.json" section with merge logic and template |

### Plan 02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `agents/brain-query.md` | `references/brain/query-patterns.md` | Setup section reference | WIRED | Line 32: "Read `references/brain/query-patterns.md`" |
| `agents/brain-query.md` | `references/brain/schema.md` | Setup section reference | WIRED | Line 31: "Read `references/brain/schema.md`" |
| `agents/grading.md` | `references/brain/query-patterns.md` | brain_grade_calibrate pattern | WIRED | Line 29: "Read `references/brain/query-patterns.md` for the `brain_grade_calibrate` and `brain_gap_assess` patterns" |
| `agents/research.md` | `mcp__tavily-mcp__tavily-search` | allowed-tools in frontmatter | WIRED | Frontmatter line 9: `mcp__tavily-mcp__tavily-search` in allowed-tools |

### Plan 03 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `commands/deep-grade.md` | `agents/grading.md` | agent delegation | WIRED | Line 23: "Delegate the assessment to the Grading Agent by reading and following `agents/grading.md`" |
| `commands/research.md` | `agents/research.md` | agent delegation | WIRED | Line 27: "Delegate the research to the Research Agent by reading and following `agents/research.md`" |
| `commands/grade.md` | `agents/grading.md` | Brain-aware upgrade routes to Grading Agent | WIRED | Line 24: "Read and follow `agents/grading.md` -- the Grading Agent handles the full assessment" |
| `commands/diagnose.md` | `references/brain/query-patterns.md` | Brain-aware upgrade adds graph-informed routing | WIRED | Line 22: "Read `references/brain/query-patterns.md` for `brain_framework_chain` and `brain_find_patterns` patterns" |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| BRAN-01 | Plan 01 | User can connect Brain MCP via `/mindrian-os:setup brain` | SATISFIED | commands/setup.md — full conversational credential flow, writes .mcp.json, tests connections |
| BRAN-02 | Plan 01 | 8 Brain MCP tools defined and callable (all 8 query patterns) | SATISFIED | references/brain/query-patterns.md — 8 named patterns: framework_chain, grade_calibrate, find_patterns, concept_connect, cross_domain, contradiction_check, gap_assess, search_semantic. Called via mcp__neo4j-brain__read_neo4j_cypher and mcp__pinecone-brain__search-records |
| BRAN-03 | Plan 01 | brain-connector skill — passive enrichment + proactive surfacing with confidence gating | SATISFIED | skills/brain-connector/SKILL.md — Passive Enrichment + Proactive Surfacing sections, Gating Rules (max 2, HIGH confidence), silent fallback |
| BRAN-04 | Plan 02 | Brain Agent handles complex multi-hop graph queries, builds GraphRAG context | SATISFIED | agents/brain-query.md — Multi-Hop Protocol (3-hop max), Query Protocol, Pattern Selection Guide |
| BRAN-05 | Plan 02 | Grading Agent provides calibrated 5-component assessment from 100+ real projects | SATISFIED | agents/grading.md — 5 components with weights, brain_grade_calibrate, percentile ranking, structured output template |
| BRAN-06 | Plan 02 | Research Agent performs Tavily web search, cross-references with Brain, files to room | SATISFIED | agents/research.md — Tavily search + extract, brain_search_semantic, provenance metadata, user confirmation before filing |
| BRAN-07 | Plan 02 | Investor Agent stress-tests from investor POV using Brain pattern data | SATISFIED | agents/investor.md — adversarial VC voice, brain_find_patterns + brain_contradiction_check + brain_gap_assess, severity-rated structured concerns |
| BRAN-08 | Plan 03 | 5 new commands: suggest-next, find-connections, compare-ventures, deep-grade, research | SATISFIED | All 5 files exist with correct frontmatter, Brain requirement checks, and specific query pattern or agent delegation |
| BRAN-09 | Plan 03 | Existing commands upgraded — diagnose, help, grade, pipeline, mode engine | SATISFIED | All 4 commands have "Brain Enhancement (Optional)" sections; mode-engine.md has Brain Calibration section; all modifications additive |
| BRAN-10 | Plan 01 | Brain schema reference and query pattern templates in references/brain/ | SATISFIED | references/brain/schema.md (72 lines, 8 node types, 8 relationships) + references/brain/query-patterns.md (184 lines, 8 named patterns) |

**All 10 requirements: SATISFIED. No orphaned requirements.**

---

## Anti-Patterns Found

No anti-patterns detected. Scan of all 13 created/modified core files returned no TODO, FIXME, PLACEHOLDER, "Not implemented", empty return, or stub patterns.

---

## Human Verification Required

### 1. Brain MCP Connection Test

**Test:** Configure `.mcp.json` with real Neo4j Aura and Pinecone credentials, run `/mindrian-os:setup brain`
**Expected:** Conversational flow collects credentials, writes config, reports "Brain connected. Larry just got smarter."
**Why human:** Requires live Neo4j Aura and Pinecone instances — cannot verify MCP connectivity programmatically

### 2. brain-connector Passive Enrichment Feel

**Test:** Mention "Beautiful Question" in a message while Brain is connected
**Expected:** Larry's response naturally weaves related frameworks from the graph without stating "I queried the Brain"
**Why human:** Quality of natural language weaving cannot be verified from file inspection alone

### 3. Proactive Surfacing Gate (Max 2 Per Session)

**Test:** Start a session with a room containing multiple framework gaps, verify at most 2 findings surface
**Expected:** Larry surfaces exactly the 2 highest-confidence findings, not all findings
**Why human:** Requires runtime session state to verify gating behavior

### 4. Investor Agent Voice Authenticity

**Test:** Run the Investor Agent against a real room, verify it maintains adversarial VC voice throughout
**Expected:** No warmth, no reframes, no "Very simply..." — short direct sentences, signature phrases rotate naturally
**Why human:** Voice authenticity under real conditions requires human judgment

### 5. Graceful Degradation Without Brain

**Test:** Run diagnose, help, grade, and pipeline without .mcp.json configured
**Expected:** All 4 commands execute their complete original Tier 0 flow, no Brain Enhancement section side effects
**Why human:** Runtime behavior verification of silent skip logic

---

## Commit History (All 6 Phase Commits Verified in Repository)

| Commit | Task |
|--------|------|
| `71bd0c2` | feat(04-01): add Brain schema reference, query patterns, and setup command |
| `6a81be7` | feat(04-01): add brain-connector skill for passive enrichment and proactive surfacing |
| `6bcc0cb` | feat(04-02): add Brain Agent and Grading Agent |
| `99e10e7` | feat(04-02): add Research Agent and Investor Agent |
| `0facc73` | feat(04-03): add 5 new Brain-powered commands |
| `0d9020e` | feat(04-03): upgrade 5 existing commands + mode engine + index for Brain awareness |

---

## Summary

Phase 4 goal achieved. All 10 requirements (BRAN-01 through BRAN-10) are satisfied by substantive, wired implementations:

- **Foundation layer** (Plan 01): schema.md and query-patterns.md form a consistent reference pair — the 8 node types queried by the 8 patterns. setup.md is a complete credential flow. brain-connector SKILL.md is appropriately thin (44 lines) and delegates correctly.

- **Agent layer** (Plan 02): 4 agents with distinct, explicitly non-Larry voices. Each loads query-patterns.md on demand rather than embedding Cypher inline. Brain Agent has 3-hop max and pattern selection guide. Grading Agent has weighted 5-component scoring with percentile computation. Research Agent requires user confirmation before filing. Investor Agent is adversarially designed with severity-rated concerns.

- **Command layer** (Plan 03): 5 new Brain-powered commands all have Brain-not-connected fallback messages. 4 existing commands have additive "Brain Enhancement (Optional)" sections that silently skip when Brain is unavailable, preserving full Tier 0 functionality. Mode engine Brain Calibration section has a 15% max delta rule protecting the static 40/30/20/10 baseline.

The moat is connected. Larry's teaching graph is accessible through a coherent, credential-isolated, gracefully-degrading toolchain.

---

_Verified: 2026-03-22T14:45:00Z_
_Verifier: Claude (gsd-verifier)_
