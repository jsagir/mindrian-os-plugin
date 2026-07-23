---
phase: quick-260723-aj4
plan: 01
subsystem: brain-client
tags: [brain, mcp, memgraph, endpoint-migration, node]

# Dependency graph
requires:
  - phase: quick-260722-wom
    provides: "Auth-header normalization on brain-client.cjs (Bearer-only); live drop-in-compatibility confirmation of pws-brain-mcp.onrender.com against the real production endpoint with a real key"
provides:
  - "Default Brain HTTP client endpoint flipped from mindrian-brain.onrender.com (Neo4j+Pinecone) to pws-brain-mcp.onrender.com (Memgraph-backed)"
  - "Four stale-comment sites synced to describe the new default"
  - "Live module-level proof (not a raw-fetch stand-in) that brain.schema() round-trips real data through the new default"
affects: [brain-client, mcp-profiles, rs-thesis-command, rs-experts-command, sessionstart-preflight]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Fallback-literal-only flip: MINDRIAN_BRAIN_URL override mechanism untouched, only the hardcoded default string moved"]

key-files:
  created: []
  modified:
    - lib/core/brain-client.cjs
    - scripts/rs-thesis-command.cjs
    - scripts/rs-experts-command.cjs
    - scripts/sessionstart-post-update-preflight.cjs
    - lib/core/mcp-profiles.cjs

key-decisions:
  - "Gate 4's brain-server-resolution.test.cjs T4 sub-check waived via explicit user Decision Gate approval -- confirmed pre-existing, unrelated to the hostname flip (docs/install/BRAIN-SETUP.md missing an mcpServers JSON snippet), verified via git-stash comparison against the pre-flip commit 7459706f~1"
  - "Fifth stale-comment hit at lib/core/rs-nl-to-query.cjs:13 left untouched, per the plan's explicit five-file scope (files_modified frontmatter and Task 1's action step both say 'update ONLY' the four flagged files) -- flagged as a follow-up instead of silently expanding scope"

requirements-completed: [MEMGRAPH-MIG-STEP4]

# Metrics
duration: 35min
completed: 2026-07-23
---

# Quick Task 260723-aj4: Flip Brain Default Endpoint to pws-brain-mcp Summary

**Brain HTTP client's default endpoint flipped from mindrian-brain.onrender.com to the Memgraph-backed pws-brain-mcp.onrender.com; live module-level smoke test proves brain.schema() round-trips real schema data through the new default with zero env override.**

## Performance

- **Duration:** 35 min
- **Tasks:** 2
- **Files modified:** 5 (code) + 1 (this SUMMARY.md)

## Accomplishments

- `BRAIN_URL` default literal in `lib/core/brain-client.cjs` moved from `https://mindrian-brain.onrender.com` to `https://pws-brain-mcp.onrender.com`; `MINDRIAN_BRAIN_URL ||` override mechanism itself untouched
- Header doc comment (lines 3-6) corrected: no longer says "moving to brain.mindrian.ai" (stale/wrong), now describes the live Memgraph-backed default
- Four descriptive-prose comment sites synced to the new hostname: `scripts/rs-thesis-command.cjs`, `scripts/rs-experts-command.cjs`, `scripts/sessionstart-post-update-preflight.cjs`, `lib/core/mcp-profiles.cjs`
- Whole-repo re-grep confirmed no new hardcoded `BRAIN_URL`-style constant exists anywhere outside `lib/core/brain-client.cjs`
- Six-gate regression mirror run (5 hold clean, 1 holds with one documented pre-existing exception -- see below)
- Live end-to-end smoke test through the actual shipped module (not a raw fetch stand-in) confirms real schema data returns via the new default

## Task Commits

1. **Task 1: Flip the default Brain endpoint and sync the four stale-comment sites** - `7459706f` (feat)

**Plan metadata:** handled by orchestrator (not committed by this agent)

_Note: Task 2 produced no code changes -- only this SUMMARY.md, which the orchestrator commits separately per this task's constraints._

## Files Created/Modified

- `lib/core/brain-client.cjs` - `BRAIN_URL` default literal + header comment (lines 3-6)
- `scripts/rs-thesis-command.cjs` - comment-only hostname sync (line 10)
- `scripts/rs-experts-command.cjs` - comment-only hostname sync (line 10)
- `scripts/sessionstart-post-update-preflight.cjs` - comment-only hostname sync (line 38)
- `lib/core/mcp-profiles.cjs` - comment-only hostname sync (line 22)
- `.planning/quick/260723-aj4-flip-brain-default-endpoint-to-pws-brain/260723-aj4-SUMMARY.md` - this file

## Decisions Made

- Waived gate 4's `brain-server-resolution.test.cjs` T4 sub-check via explicit user Decision Gate approval rather than treating it as this task's regression (full rationale below)
- Left the fifth stale-comment hit (`lib/core/rs-nl-to-query.cjs:13`) untouched, respecting the plan's explicit "update ONLY the four flagged files" scope, and flagged it as a follow-up instead

## Regression Gates (six-gate mirror)

1. `node tests/test-resolve-brain-key.cjs` -- PASS (14/14)
2. `node lib/memory/security-trifecta.test.cjs` -- PASS (22/22)
3. `node -e "require('./lib/core/brain-client.cjs')"` -- PASS (loads without throwing)
4. Three brain-client-specific test files:
   - `node lib/memory/brain-client-query-shape.test.cjs` -- PASS
   - `node lib/memory/brain-cache-lru.test.cjs` -- PASS
   - `node lib/memory/brain-server-resolution.test.cjs` -- 4/5 sub-checks PASS, T4 fails on a pre-existing unrelated gap (waived, see "Gate 4 exception" below)
5. Em-dash grep across all five touched files -- PASS (nothing found)
6. `grep -n "const BRAIN_URL" lib/core/brain-client.cjs` -- PASS, shows `'https://pws-brain-mcp.onrender.com'`

### Gate 4 exception (waived, not fixed)

`brain-server-resolution.test.cjs` sub-check T4 (`docs/install/BRAIN-SETUP.md exists with canonical name + mcpServers snippet`) fails with:

```
BRAIN-SETUP.md missing user-side .mcp.json snippet (`mcpServers`)
```

Root cause: `docs/install/BRAIN-SETUP.md` describes `.mcp.json` in prose (line 27: "the plugin bundles its own stdio shim via `.mcp.json`") but never includes an actual JSON snippet containing the literal string `mcpServers`. This is a documentation-content gap, unrelated to the `BRAIN_URL` hostname flip.

Confirmed pre-existing and unrelated to this task's change:
- Ran the identical test against commit `7459706f~1` (the commit immediately before Task 1's flip landed) via `git stash` comparison -- same T4 failure, same message.
- `git log` shows `brain-server-resolution.test.cjs` (`9b778dc2`) and `docs/install/BRAIN-SETUP.md` (`2dfa52a4`, `4e423762`) were both last touched in commits that predate and are unrelated to this session.
- T4's assertion (presence of the literal string `mcpServers`) has nothing to do with `BRAIN_URL` or the hostname value at all.

Per the user's explicit Decision Gate approval, this sub-check is waived for this task rather than fixed here: `docs/install/BRAIN-SETUP.md` is not in this plan's `files_modified` list, and fixing it would exceed this quick task's given scope. Recommended as a flagged follow-up (see below).

## Live End-to-End Smoke Test

Command: `env -u MINDRIAN_BRAIN_URL node -e "require('./lib/core/brain-client.cjs').schema()..."` -- fresh process, `MINDRIAN_BRAIN_URL` explicitly unset, real `MINDRIAN_BRAIN_KEY` from the environment, calling `brain.schema()` through the actual shipped module (not a raw `fetch()` stand-in).

Result: non-null, real object. Confirms the new default (`pws-brain-mcp.onrender.com`) is what the module actually talks to when no override is set, and that the full session-init + tool-call round trip works end-to-end.

Response shape (redacted of nothing -- generic methodology schema data, never user content, per Canon Part 8):

```json
{
  "labels": [
    "Analogy", "Archived", "AssessmentComponent", "Book", "CaseStudy", "Chunk",
    "Command", "Concept", "CorePrinciple", "Course", "CreativeWork",
    "DataRoomSection", "DialConfig", "DialPhase", "DictionaryTerm", "Document",
    "Event", "Example", "Framework", "FrameworkStep", "GradeBand",
    "GraphRagMeta", "Heuristic", "InnovationStage", "Insight", "Lecture",
    "Method", "MethodologyChunk", "MindrianCommand", "Mode", "ModeTrigger",
    "Organization", "PedagogicalPattern", "Person", "Persona", "Phase",
    "Phrase", "Principle", "Problem", "ProblemType", "ProcessStep", "Product",
    "PyramidLevel", "Question", "Quote", "Reach", "Room", "RoomGroup",
    "RoomRoot", "Stage", "Technique", "Tool", "ValidationTool",
    "WorthinessCriteria", "__Entity__"
  ],
  "relationshipTypes": [
    "ABOUT", "ADDRESSES_PROBLEM_TYPE", "ALIAS_OF", "APPLIED_FRAMEWORK",
    "APPLIED_IN", "APPLIED_IN_STAGE", "AUTHORED", "AUTHORED_BY", "BLOCKS",
    "COMPLEMENTS", "CONNECTED_TO", "CONTAINS", "CONTRASTS_WITH",
    "CONTRIBUTED", "CROSS_DOMAIN_ANALOGUE", "DEFINES", "DESIGN_PRINCIPLE_FOR",
    "DEVELOPED", "DIRECTS", "ENABLES", "EQUIPS_WITH", "EXTENDS",
    "FEEDS_INTO", "FILED_IN", "FOUNDED", "HAS_EXAMPLE", "HAS_METHOD",
    "HAS_PHASE", "HAS_PROCESS_STEP", "HAS_STAGE", "HAS_STEP", "IDENTIFIED",
    "ILLUSTRATES", "IMPLEMENTED_AS", "INCORPORATES", "INSTANCE_OF",
    "INTRODUCES", "INVOLVES", "LEADS", "LEADS_TO", "LOOPS_TO", "MEASURES",
    "MENTIONED_IN", "MENTIONS", "MOTIVATES", "PART_OF", "PREREQUISITE",
    "RELATED_TO", "RELATES_TO", "REPLACED_BY", "REVEALS", "SHARES_THEME",
    "SNAPS_TO", "STARTS_AT", "TEACHES", "TRANSFORMS_OUTPUT_TO",
    "USES_FRAMEWORK", "USES_TECHNIQUE", "USES_TOOL", "VALIDATES", "VOICES"
  ],
  "propertyKeys": ["abbreviation", "absorbed_node_former_label", "abstraction_level", "... (truncated, generic methodology field names only)"]
}
```

This proves the shipped `brain-client.cjs` module -- session-init handshake, Bearer auth, SSE-parsed JSON tool-call response -- round-trips real Memgraph-backed schema data through the new `pws-brain-mcp.onrender.com` default with zero env override, not just a hand-rolled `fetch()` against a manually-set URL.

## Restated Research Findings (from this session's prior investigation, for the record)

- `brain_search` / `brain_schema` / `brain_stats` / `brain_ask` / `brain_ask_anything` are drop-in compatible: same response shapes `brain-client.cjs` already parses on both old and new servers.
- `brain_query` / `brain_write` (raw Cypher) have ALWAYS been admin-gated for regular users on BOTH the old and new servers -- the flip introduces no regression on this surface.
- `write()`'s sole caller, `scripts/whitespace-to-brain.cjs`, is already tolerant of the admin-gate behavior.

## Deviations from Plan

### Auto-fixed Issues

None -- Task 1 executed exactly as written (one-line default flip + four comment syncs).

### Waived (not fixed, user-approved)

**1. Gate 4 T4 sub-check waived via Decision Gate**
- **Found during:** Task 2 (six-gate regression mirror)
- **Issue:** `brain-server-resolution.test.cjs` T4 fails -- `docs/install/BRAIN-SETUP.md` missing an `mcpServers` JSON snippet
- **Disposition:** Confirmed pre-existing and unrelated to the hostname flip (verified against `7459706f~1`); user explicitly approved waiving this sub-check via Decision Gate rather than fixing it in-scope
- **Files modified:** none (out of scope by design)
- **Follow-up:** flagged below (Flag 3)

---

**Total deviations:** 0 auto-fixed, 1 waived-by-decision
**Impact on plan:** No scope creep. The waived exception is fully documented and traceable to a pre-existing, unrelated gap.

## Issues Encountered

None beyond the Gate 4 T4 exception documented above.

## Flagged Follow-ups (not fixed, out of scope for this quick task)

**Flag 1: `text2cypher` tool server-config issue**
The new server's `text2cypher` tool errors server-side with "No LLM configured" -- a `pws-brain-mcp` Render deploy-config issue on a different repo. Nothing in this repo calls it directly. No action needed here; flagging for whoever owns the `pws-brain-mcp` Render service config.

**Flag 2: Part 8 egress-detection test suites keyed to the old hostname**
The following Canon Part 8 boundary/egress-detection test suites key their detection token/mock-error lists off the OLD hostname string (`mindrian-brain.onrender.com`) as the canonical "Brain host" signature:
- `tests/test-169-brain-boundary.cjs`
- `tests/test-unknowns-part8-boundary.cjs`
- `tests/test-acpt-03-first-material-explore.cjs`
- `tests/test-acpt-04-filing-cascade-surfaces.cjs`
- `tests/test-acpt-05-brain-derive-tier-rise.cjs`
- `tests/test-hmi-poll-primitive.cjs`
- `lib/memory/brain-derivation-graceful-degradation.test.cjs`

Post-flip these do not fail -- they are negative-space checks (assert the old host string never appears where it shouldn't) and still pass. But their detection coverage no longer includes the real new host (`pws-brain-mcp.onrender.com`), which widens the blind spot for future Part 8 leak detection. Recommend a follow-up task to add the new hostname to these token lists alongside the old one.

**Flag 3: `docs/install/BRAIN-SETUP.md` missing `mcpServers` snippet**
`brain-server-resolution.test.cjs` T4 fails because `docs/install/BRAIN-SETUP.md` describes `.mcp.json` in prose but never includes an actual JSON snippet containing the literal `mcpServers` key. Waived for this task per explicit user Decision Gate approval (documented above). Recommend a separate future quick task to add the missing `mcpServers` JSON snippet to `BRAIN-SETUP.md` so this gate goes fully green.

**Flag 4: Fifth stale-comment hit not in this task's file scope**
The whole-repo re-grep for `mindrian-brain.onrender.com` (Task 1) turned up a fifth non-test file with a stale descriptive-prose comment that quick-260722-wom's RESEARCH.md did not catch (its grep excluded `tests/` only, not this file):

- `lib/core/rs-nl-to-query.cjs:13` -- `"The Brain (mindrian-brain.onrender.com) is a generic methodology repository..."`

This task's `files_modified` frontmatter and Task 1's action step both explicitly scope comment updates to exactly four flagged files ("update ONLY..."), so this file was left untouched rather than silently expanding scope. Recommend a follow-up quick task to sync this comment too, for consistency with the rest of the flip.

## Known Stubs

None -- this task touches only default-literal + comment text, no UI or data-rendering surface.

## Threat Flags

None -- no new network endpoints, auth paths, file access patterns, or schema changes introduced. The threat model in the plan (T-aj4-01 through T-aj4-05, T-aj4-SC) fully covers this task's surface; T-aj4-05 (Part 8 egress-detector blind spot) is the same finding as Flag 2 above, now confirmed rather than merely anticipated.

## Next Phase Readiness

- Regular users now get the Memgraph-backed `pws-brain-mcp.onrender.com` endpoint by default with zero code change required for `brain_search`/`brain_schema`/`brain_stats`/`brain_ask`/`brain_ask_anything`
- `MINDRIAN_BRAIN_URL` override mechanism confirmed unchanged
- Four flagged follow-ups above are ready to become their own quick tasks whenever prioritized; none block this task's completion

---
*Phase: quick-260723-aj4*
*Completed: 2026-07-23*
