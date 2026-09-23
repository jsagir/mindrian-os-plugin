# Phase 358: Rome - B1 checking record, user-visible - Research

**Researched:** 2026-09-23
**Domain:** Local claim verification records (room.db claim properties), MCP tool surface (CLI + Desktop + Cowork), CIRS born-wired gates
**Confidence:** HIGH for code facts (read and probed live in this session); MEDIUM for the Claude Desktop client name; LOW for the Cowork client name
**Scope:** B1 ONLY (slide A2). B2 is out of scope for this pass.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### B1 acceptance tests (LOCKED - these are the go/no-go tests, worded to match the slide)
1. An officer can record, on a claim, what it was checked against, the rung, the method and the result, in the normal flow and without a developer. Normal flow = on the Claude Code CLI (a /mos: command or Larry-driven turn) AND via MCP tools on Claude Desktop / Cowork (officers drive hands-on).
2. Close everything. In a new session, reopen the claim: the record is there and readable.
3. The room shows counts for checked, disputed, inconclusive and unchecked claims across all its work. Unchecked is always shown.
4. A checked claim is still only proposed until a person confirms it. Recording a check never promotes, never demotes, never changes review_status.

#### Rung
- Add a `rung` field to the verification record. Its allowed values live in ONE exported constant (single source of truth), provisional, marked `TODO(358): replace with the paper author's verification hierarchy from The Orientation Problem`. Swapping the list must be a one-constant edit plus a test update.
- Provisional ordering must be an ordered list (rung 1 lowest) so "rung three or above" is expressible.
- Existing records without a rung stay valid (reported as rung unknown), additive only, no migration.

#### Counts are never a score
- The portrait reports counts by state and result, plus the number of claims with no record. It never computes a percentage-as-quality, grade, or single number. Unchecked is always rendered, even when zero.

#### Separation from approval
- Verification and review_status are independent. The claim view must show both side by side, labeled so "checked" is never read as "confirmed".

#### Canon constraints
- Part 8: rung, method, result, against_kind are local enums; free-form notes are artifacts referenced by note_handle. Nothing in B1 crosses to Theo / the Brain.
- Part 9: all writes go through the existing chokepoints (lib/core/node-insert.cjs via verification.cjs); reads through lib/core/navigation.cjs.
- Part 11: any new command / MCP tool is born wired (connector registry, shape declaration) per CIRS.
- Tri-Polar: CLI + Desktop + Cowork.

#### Collision rules (LOCKED)
- Peer sessions execute Phases 354-357 in the same working tree. Commit only owned files with `git commit --only`; `git add -f` for .planning paths.
- Never touch: docs/reviews/*, evals/plurai/*, scripts/eval-icm-writers.cjs, scripts/jev-devtime-client.cjs, tests/test-353-*, .planning/phases/356-*, data/jev-policies/, .planning/STATE.md.
- lib/mcp/tools/gate.cjs is Phase 354 territory: if B1 needs it, coordinate with the 354 session (jsagi-25) first; prefer not touching it.
- No em-dashes in any written text.

### Claude's Discretion
- Exact CLI surface (extend an existing /mos: command such as the room/query view, or a small new command) chosen by reuse-before-build (Canon Part 7): search commands/*.md first.
- Exact MCP surface: extend claim_verify and add or extend a read tool for the claim view and the room portrait; prefer extending existing tools over new ones.
- Rendering format of counts, as long as the four states plus "no record" are always visible.

### Deferred Ideas (OUT OF SCOPE)
- B2 frame provenance (origin chosen/tasking/prompt/inherited shown; history viewable; pre-answer pause asking what the old question got wrong; refines vs relocates) - second plan set in this phase after B1 lands.
- Final rung list from the paper author (swap the provisional constant).
- Any UI in the Visible Room wiki beyond what the acceptance tests need.
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed IDs - ROADMAP lists "Requirements: TBD")

The ROADMAP entry for 358 has no requirement IDs yet. These IDs are proposed so the planner can map plans to the four locked acceptance tests; adopt or rename.

| ID | Description | Research Support |
|----|-------------|------------------|
| B1-01 | `rung` on the record, ONE ordered constant, provisional, legacy records read as "rung unknown" | Pattern 1; verification.cjs:11-19, :85-93 |
| B1-02 | Record is written in the normal flow on CLI and on Desktop/Cowork without a developer (AT1) | Pitfall 1 (Desktop write path is OFF today), Pattern 3, Pattern 4 |
| B1-03 | Record survives process restart AND a re-file of the same claim (AT2) | Pitfall 2 (re-file wipes the record today, probed), Pattern 2 |
| B1-04 | Claim view: review_status and checking record side by side, labeled (AT2, AT4) | Pattern 3 (`claim_read`) |
| B1-05 | Room portrait: checked / disputed / inconclusive / unchecked always shown, never a score (AT3) | verification.cjs:109-143 already has the counts; Pattern 3/4 render them |
| B1-06 | Recording never changes review_status (AT4) | node-insert.cjs:244-248 (DO UPDATE excludes review_status), gate.cjs:101-102 (the only confirm door on MCP) |
| B1-07 | Born wired (Part 11) and the MCP surface tests that the substrate commit already broke are green again | Section "Part 11 / CIRS", Pitfall 4 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Work from `/home/jsagi/dev/MindrianOS-Plugin/` only; all dev work through GSD workflows.
- Canon Part 8: no room content to the Brain. B1 has zero Brain calls; keep it that way (no `brain_*`, no `brainClient` import in any B1 file).
- Canon Part 9: `lib/core/navigation.cjs` is the single SQL navigation chokepoint; `insertNode` is the single node-write chokepoint; only a human confirms a truth-claim node.
- Canon Part 7: reuse before build; search commands/*.md, agents/*.md, pipelines/*/CHAIN.md, skills/*/SKILL.md before minting a surface.
- Canon Part 11: every invocable surface born WIRED or EXCLUDED, with a declared HITL shape; gates: `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs --check`, `node scripts/check-shape-declaration.cjs --check` (advisory), roll-up `node scripts/doctor.cjs --acceptance`.
- Canon Part 12: withhold grades and scores (aligns with "counts are never a score").
- Tri-Polar: CLI, Desktop, Cowork; a skip is a stated call.
- CJS only, no TypeScript; CLI entry points use a `process.argv` switch-case router; no Commander/yargs.
- No em-dashes anywhere; Feynman-simplified prose.
- Phase tests: `bash tests/run-all-<phase>.sh`.
- User memory rule "Not live until released": a `main` commit is not live until released AND picked up by the demo machines. The 6 October go/no-go must include a release cut and an install check on the Rome machines.

## Summary

The B1 substrate landed this morning in commit `42191a6ae` and it is closer than it looks, but it has three problems that would each fail a Rome acceptance test on their own. First, **the Desktop write path is off**: Claude Desktop identifies itself to MCP servers as `claude-ai`, which `detectHostTier` does not recognize, so `isWritePathEnabled` returns false and both `claim_write` and `claim_verify` refuse with `write_path_disabled`. I proved this with a live stdio probe of `bin/mindrian-mcp-server.cjs` (the same call succeeds when the client says `claude-code`). Officers on Desktop cannot record a check today, and they cannot file a claim either. Second, **re-filing a claim erases its checking record**: `writeClaimNode` rebuilds the properties JSON from scratch and `insertNode`'s upsert overwrites `properties`. I proved this too: record a check, re-file the same claim text in the same session, and the portrait goes from "1 disputed" back to "1 unchecked". `graph-derivation`, `domain-insight-sweep` and `unknowns/edge-writer` all re-project claims through the same writer, so a record can also vanish silently on a later index run. Third, **nothing reads the record back**: there is no MCP tool and no /mos: surface that shows a claim's record or the room counts. `readVerificationPortrait` has no consumer.

The good news is that the hard guarantees already hold. Records live in `room.db` claim properties and survive a process restart (probed across separate node processes). `insertNode`'s DO UPDATE clause never touches `review_status` (node-insert.cjs:244-248), so recording a check cannot promote or demote a claim, and the existing gate path (`gate_answer` approve -> `navigation.confirmNode`, gate.cjs:101-102) remains the only confirm door. The portrait already reports the four states and never a score. The substrate commit also left three MCP surface tests red (description floor, tool-schema budget, tool-honesty frozen sweep); B1 must turn them green.

**Primary recommendation:** Build B1 in four small waves inside files no peer owns: (1) core: `VERIFICATION_RUNGS` constant + rung field + a claim-view reader + a claims list reader in `verification.cjs`, and carry the `verification` key forward in `typed-claim.cjs`; (2) MCP: add a `claim_read` read tool beside `claim_verify` in `lib/mcp/tools/claim-verify.cjs` and recognize Claude Desktop as a Tier-0 host in `lib/mcp/surface-detect.cjs` (navigator checkpoint); (3) CLI: a `checks` subcommand family on `/mos:room` backed by one new script `scripts/claim-checks.cjs`; (4) gates, re-baselines, the phase runner `tests/run-all-358.sh`, a release, and a human live smoke on real Claude Desktop and Cowork before 6 October.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rung vocabulary (ONE constant) | Local core lib (`lib/core/navigation/verification.cjs`) | - | Single source of truth; the MCP zod enum and the CLI both derive from it |
| Write a checking record | Local core lib (`recordClaimVerification` -> `insertNode`) | MCP tool `claim_verify`; CLI script | Part 9: one write door, two thin callers |
| Record persistence | Database / Storage (room.db `nodes.properties` JSON) | - | Additive JSON, no migration; survives restart |
| Preserve record on claim re-file | Local core lib (`typed-claim.cjs` writeClaimNode) | - | All claim re-projections pass through this one writer |
| Claim view + claims list + portrait | Local core lib readers re-exported by `navigation.cjs` | MCP `claim_read`; CLI `claim-checks.cjs` | Part 9 read chokepoint |
| Desktop/Cowork write permission | MCP server (`surface-detect.cjs` host tier -> `mcp-first-flag.cjs`) | Desktop config env (`MINDRIAN_MCP_FIRST`) as fallback | Server-side governance (D-04), no client hook on Desktop |
| Confirmation (promotion) | Existing gate path (`gate_answer` -> `confirmNode`) | - | Unchanged by B1; gate.cjs is Phase 354 territory |
| Born-wired registration | Build scripts (connector registry generator) | Generated `data/*.json` | Part 11 R1/R16 |

## Current State (question 1, with file:line evidence)

### The record schema as shipped

`lib/core/navigation/verification.cjs` [VERIFIED: codebase read]:
- Enums at :11-19: `CHECK_STATUSES` {unchecked, checked, disputed, inconclusive}; `AGAINST_KINDS` {artifact, source, observation, person, experiment}; `METHODS` {read, compare, observe, test, ask}; `RESULTS` {supports, contradicts, inconclusive}; `ACTORS` {user, system}. All are frozen Sets (unordered).
- `recordClaimVerification(db, params)` at :67-103. Validates handles (:75) and enums (:76-79), requires `type === 'claim'` (:81), appends one record `{against_id, against_kind, method, result, checked_by, checked_at, note_handle?}` (:86-95) to `props.verification.records`, then sets `props.verification.status` from the LATEST result only (:97-99: contradicts -> disputed, inconclusive -> inconclusive, else checked).
- Writes via `writeClaimProperties` (:47-60) -> `insertNode(db, id, type, json, {source_path: 'verification:'+id, created_by: 'system', epistemic_type})`. The epistemic_type is read back from the existing props (:53-54), so the node-insert R17-02 gate passes.
- `readVerificationPortrait(db)` at :109-143 returns `{claims_total, claims_unchecked, claims_checked, claims_disputed, claims_inconclusive, records_total, records_by_result:{supports, contradicts, inconclusive}}`. A claim with no `verification` key counts as unchecked (:129), so `claims_unchecked` already equals "claims with no record". No percentage, no score.
- Re-exported through the read chokepoint at `lib/core/navigation.cjs:57` (require) and :485-492 (`recordClaimVerification`, `readVerificationPortrait`, `VERIFICATION_CHECK_STATUSES`, `VERIFICATION_AGAINST_KINDS`, `VERIFICATION_METHODS`, `VERIFICATION_RESULTS`).

**Where `rung` slots in:** a new frozen ordered array `VERIFICATION_RUNGS` beside the enums at :11-19, validated in `recordClaimVerification` next to :76-79, stored in the record object at :86-93, and counted in the portrait loop at :134-140 (`records_by_rung`). Re-export as `VERIFICATION_RUNGS` in `navigation.cjs` next to :489-492.

**Does the portrait already have the shape AT3 needs?** Yes for the counts. It is missing only a consumer (nothing renders it) and, optionally, `records_by_rung`. Keep `claims_unchecked` as the "no record" count and render it always.

### The MCP tool as shipped

`lib/mcp/tools/claim-verify.cjs` [VERIFIED: codebase read]:
- One tool, `claim_verify` (:17). Schema :18-26 derives enums from the navigation re-exports with hard-coded fallbacks. `checked_by` is `user|system`.
- Per-call write gate :28-32 (`isWritePathEnabled({surface, clientVersion})`), room resolution :33-34 (`resolveEffectiveSessionId` -> `resolveSessionRoomDir`), db handle via `navigation.openRoomDbForCaller` / `closeRoomDbForCaller` (:35-41). Same sanctioned pattern as `claim_write` (lib/mcp/tools/claim.cjs:124-131).
- Born-wired export :45-49: `hitl_shape: 'F.1'`, `layer: 'harness'`. Already present in the generated `data/mcp-tool-connectors.json:62`, `data/connector-registry.json:2954`, and `data/connector-coverage-ledger.json:796`.
- Registration: automatic. `lib/mcp/register-core-tools.cjs:53-75` requires every `lib/mcp/tools/*.cjs` (sorted) and calls `register(server, ctx)`. No edit to register-core-tools.cjs or tool-router.cjs is needed for a new tool in an existing or new tools file.
- The description is 111 characters (below the 120-character floor; see Pitfall 4).

### Tests that exist

- `tests/test-b1-verification.cjs` (42 lines): in-memory migrated-schema db, one claim, one record, asserts `review_status` stays proposed, status checked, note_handle kept, exact portrait object, and `invalid_method`. PASSES. It asserts the portrait with `deepEqual`, so adding `records_by_rung` to the portrait requires updating this test (it is a B1 file, not a peer file).
- No test for `claim_verify` itself, no cross-process test, no re-file test.

## Standard Stack

No new dependencies. Everything B1 needs is already in the tree.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` (DatabaseSync) | Node v22.23.1 installed (floor v22.16.0 per CLAUDE.md) | room.db | Already the room substrate [VERIFIED: `node --version`] |
| `zod` | 3.25.76 installed | MCP tool input schemas | Already used by every tools/*.cjs [VERIFIED: node require of zod/package.json] |
| `@modelcontextprotocol/sdk` | ^1.29.0 per CLAUDE.md | MCP server | Existing server; tools auto-discovered |

### Supporting (in-repo modules to reuse, never re-implement)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/core/navigation.cjs` | read chokepoint + re-exports | every read and write call from MCP and CLI |
| `lib/core/node-insert.cjs` `insertNode` | node write chokepoint | via `verification.cjs` only |
| `lib/core/navigation/confirm-node.cjs` `resolveByUser` (re-exported navigation.cjs:597) | navigator identity from USER.md | optional `checked_by_id` stamp (Open Question 3) |
| `lib/core/room-db.cjs` `openRoomDb` | create a room.db in test fixtures | tests only (openRoomDbForCaller never creates) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New read tool `claim_read` | A `mode` on `claim_verify` | Rejected: the write gate would then block READS on any host where writes are off, and tool-honesty scans would see a read branch inside a write tool |
| New read tool `claim_read` | Extend `graph_query` (graph.cjs) | Rejected: graph_query returns a neighborhood, not the focus node's properties or review_status; mixing a claim list into it muddles its contract |
| `/mos:room checks` subcommands | A new `/mos:check` command | Rejected by Part 7: a new command adds a new surface to every gate (connector, projection, render coverage, help coverage, skill mirror, dist); `/mos:room` already owns "view the room" and has subcommands |
| Latest-result-wins status | Sticky "disputed" while any contradiction is unanswered | Open Question 2; keep shipped semantics unless the navigator rules otherwise |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck was not run because there is nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 Officer (CLI)                     Officer (Desktop / Cowork)
     |                                   |
     | /mos:room check|claim|checks      | Larry turn -> MCP tools
     v                                   v
 commands/room.md                  bin/mindrian-mcp-server.cjs
     |                                   |  initialize: clientInfo.name
     v                                   v
 scripts/claim-checks.cjs          register-core-tools.cjs (auto-discovery)
 (argv switch router)                    |
     |                         +---------+-----------+
     |                         |                     |
     |                   claim_verify (write)   claim_read (read)
     |                         |                     |
     |                 isWritePathEnabled?           |
     |                 (surface-detect host tier     |
     |                  or MINDRIAN_MCP_FIRST)       |
     |                    no -> write_path_disabled  |
     |                    yes                        |
     v                         v                     v
            lib/core/navigation.cjs (read chokepoint, re-exports)
                 |                                  |
     recordClaimVerification                readClaimVerification
     (validate enums + rung)                listClaimsForChecking
                 |                          readVerificationPortrait
                 v                                  |
     lib/core/node-insert.cjs insertNode            |
     (DO UPDATE: type, properties, last_seen_at;    |
      NEVER review_status)                          |
                 |                                  |
                 +------------> room.db <-----------+
                              nodes.properties.verification
                                      ^
                                      |  must be carried forward
     claim_write / meeting / graph-derivation / domain-insight-sweep /
     unknowns edge-writer -> typed-claim.cjs writeClaimNode (re-file)

 Confirmation (unchanged): gate_render -> gate_answer approve -> navigation.confirmNode
 (the only thing that changes review_status to confirmed)
```

### Recommended file ownership for B1 (all verified free of peer plans, see Collision Map)

```
lib/core/navigation/verification.cjs     # VERIFICATION_RUNGS, rung field, claim view + list readers, portrait by rung
lib/core/navigation/typed-claim.cjs      # carry the existing `verification` key forward on re-file
lib/core/navigation.cjs                  # additive re-exports only (next to :485-492)
lib/mcp/tools/claim-verify.cjs           # rung in claim_verify schema, description >= 120 chars, NEW claim_read tool + connectors
lib/mcp/surface-detect.cjs               # recognize Claude Desktop (claude-ai) as a tier0 host (navigator checkpoint)
scripts/claim-checks.cjs                 # NEW CLI: record | show | list | portrait
commands/room.md                         # NEW subcommands: checks, claim <id|text>, check <id|text>
skills/room/SKILL.md                     # REGENERATED mirror (node scripts/build-skill-mirrors.cjs), never hand-edited
data/mcp-tool-connectors.json            # REGENERATED
data/connector-registry.json             # REGENERATED
tests/test-b1-verification.cjs           # update the portrait deepEqual
tests/test-234-host-tier.cjs             # add the claude-ai recognition assertion (if the host fix is approved)
tests/test-270-tool-schema-budget.cjs    # re-baseline AFTER (measured, named in the commit)
tests/fixtures/tool-honesty/276-dispositions.json  # re-freeze frozen_sweep (refrozen_at entry)
tests/test-358-b1-*.cjs                  # NEW phase tests
tests/helpers/b1-358-child.cjs           # NEW child-process helper for the cross-session test
tests/run-all-358.sh                     # NEW phase runner
```

### Pattern 1: ONE ordered rung constant (B1-01)

**What:** An ordered, frozen array; rung number = index + 1 (rung 1 lowest). The MCP schema, CLI help, validation and labels all derive from it, so swapping the paper author's final list is a one-constant edit plus a test update.

**Provisional content:** the paper author has already published a five-rung verification hierarchy on his own site, Part V practice 3 [CITED: https://what-ai-cannot-know.vercel.app/]:

| Rung | What you check against | Where it leaves you |
|------|------------------------|---------------------|
| 1 | Your own intuition | Inside the loop |
| 2 | A counter-argument generated by the model | Still inside |
| 3 | A database or a document | Outside, the first real exit |
| 4 | A primary source | Outside, stronger |
| 5 | A person who disagrees with you | The strongest exit |

The NATO page asks him for "The rung definitions from The Orientation Problem, so the field in the tool matches your hierarchy word for word" [CITED: https://mindrian-explainer-gate.vercel.app/nato.html], so the list above is still provisional and keeps the TODO marker.

```javascript
// lib/core/navigation/verification.cjs (sketch)
// TODO(358): replace with the paper author's verification hierarchy from The Orientation Problem.
// Provisional source: what-ai-cannot-know.vercel.app Part V practice 3. Rung 1 is lowest.
// NOT the problem-type rung vocabulary (lib/core/strategy/rung-vocabulary.cjs); never mix the two.
const VERIFICATION_RUNGS = Object.freeze([
  Object.freeze({ id: 'own_intuition', label: 'Your own intuition' }),
  Object.freeze({ id: 'model_counter_argument', label: 'A counter-argument generated by the model' }),
  Object.freeze({ id: 'database_or_document', label: 'A database or a document' }),
  Object.freeze({ id: 'primary_source', label: 'A primary source' }),
  Object.freeze({ id: 'dissenting_person', label: 'A person who disagrees with you' }),
]);
function rungInfo(n) { // 1-based; null when out of range
  return Number.isInteger(n) && n >= 1 && n <= VERIFICATION_RUNGS.length ? VERIFICATION_RUNGS[n - 1] : null;
}
```

**Storage recommendation:** store `rung` (integer, 1-based) AND `rung_label` (the label snapshot at write time). The snapshot keeps an old record readable with its original meaning after the constant is swapped. Reader rule: no `rung` -> "rung unknown"; `rung` present -> "rung N (rung_label)". "Rung three or above" = `record.rung >= 3`.

**MCP schema:** `rung: z.number().int().min(1).max(VERIFICATION_RUNGS.length).describe(<generated from the constant>)`, REQUIRED at the MCP and CLI surfaces (so the officer flow always captures it) but optional inside `recordClaimVerification` only if the planner wants library back-compat; either way legacy stored records without a rung stay valid.

### Pattern 2: Carry the record forward on re-file (B1-03)

**What:** `writeClaimNode` rebuilds `props` from its parameters (typed-claim.cjs:139-177) and upserts (:215-227); `insertNode`'s DO UPDATE sets `properties = excluded.properties` (node-insert.cjs:246-247). So any re-file of the same claim id wipes `verification`. Fix inside the one claim writer: before the upsert, read the existing row's properties and, if it has a plain-object `verification`, copy it into the new props. Keep the carry-forward list explicit and named (e.g. `CARRY_FORWARD_CLAIM_KEYS = ['verification']`); do not switch to "preserve every old key" (that would silently change other writers' semantics). Add `verification` to `PROTECTED_CLAIM_KEYS` (:89-92) so an `extraProps` bag can never overwrite or forge a record.

Callers that re-project and are fixed by this one change [VERIFIED: grep]: `lib/mcp/tools/claim.cjs:165` (claim_write), the `meeting` tool file-meeting branch, `lib/core/graph-derivation.cjs:330`, `lib/core/domain-insight-sweep.cjs:176`, `lib/core/unknowns/edge-writer.cjs:128`, `lib/core/close-loop-writer.cjs:197`.

### Pattern 3: MCP read tool `claim_read` beside `claim_verify` (B1-04, B1-05)

**What:** One read-only tool in `lib/mcp/tools/claim-verify.cjs` (same module, disjoint from every peer file, auto-discovered). No write gate (reads are unconditional, like `graph_query` graph.cjs:186-209 and `room_search`).

Inputs: `claim_id?` (exact id), `query?` (case-insensitive substring over claim text, so an officer in a new session can say "the bridge claim" and Larry resolves the id), `limit?` (default 20, max 100).

Output (always includes the portrait, so the room counts are one call away):
```json
{
  "ok": true,
  "room_dir": "...",
  "portrait": { "claims_total": 3, "claims_checked": 1, "claims_disputed": 1,
                "claims_inconclusive": 0, "claims_unchecked": 1, "records_total": 2,
                "records_by_result": {"supports": 1, "contradicts": 1, "inconclusive": 0},
                "records_by_rung": {"1": 0, "2": 0, "3": 1, "4": 1, "5": 0, "unknown": 0} },
  "claim": {
    "claim_id": "claim:<sid>:<hash>",
    "text": "The bridge at grid 42 is passable.",
    "confirmation": { "review_status": "proposed",
                      "note": "Proposed. Only a person can confirm this claim. A checking record does not confirm it." },
    "checking_record": { "status": "disputed",
      "records": [{ "against_id": "field note, exercise 02", "against_kind": "observation",
                    "rung": 3, "rung_label": "A database or a document", "method": "compare",
                    "result": "contradicts", "checked_by": "user", "checked_at": "2026-10-13T09:12:00Z" }] }
  },
  "claims": [ { "claim_id": "...", "text_preview": "...", "review_status": "proposed", "checking_status": "unchecked" } ]
}
```
Labels matter for AT4: use "confirmation" / "checking_record" (or "Checking record" / "Confirmation status" in rendered text), never "verified". Connector: `hitl_shape: 'none'`, `layer: 'harness'` (same as graph_query). Description >= 120 characters, <= 2048 bytes, no em-dash, ends with a sentence terminator, and makes no persistence claim (tool-honesty).

New core readers (in verification.cjs, re-exported by navigation.cjs): `readClaimVerification(db, claimId)` and `listClaimsForChecking(db, {query, limit})`. Both are pure SELECTs over `nodes` (`type = 'claim'`), mirroring `readNode` at :30-36.

### Pattern 4: CLI via `/mos:room` subcommands backed by one script (B1-02, B1-05)

Reuse-before-build search result (Part 7) [VERIFIED: commands/*.md read]: no command shows claims from room.db. `/mos:room` ("View, launch, or navigate the Data Room", commands/room.md:1-30, subcommands view/overview/[section]/add/linkify/export) is the natural home. `/mos:validate` is importance-satisfaction SCORING (wrong semantics, and a score). `/mos:graph` walks graph paths via lazygraph-ops. `/mos:status` (scripts/mos-status.cjs, already routes room.db through navigation at :69-84) is per-section MINTO health.

Add to `commands/room.md`:
- `/mos:room checks` - render the portrait (four states plus "no record" line, all always shown) and the claim list.
- `/mos:room claim <id or words>` - render the claim view (confirmation and checking record side by side).
- `/mos:room check <id or words>` - Larry gathers against / rung / method / result (AskUserQuestion cards for the enums, labels generated by `node scripts/claim-checks.cjs rungs`), then runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/claim-checks.cjs" record ...`.

`scripts/claim-checks.cjs` is a `process.argv` switch-case router (`record | show | list | portrait | rungs`), resolves the room the way `mos-status.cjs` does (`navigation.detectActiveRoom` / `scripts/resolve-room`), opens room.db via `navigation.openRoomDbForCaller`, and calls the same core functions the MCP tools call. One write door, two thin callers. It must never require `node:sqlite` directly (check-substrate).

Also update `argument-hint` in room.md and regenerate `skills/room/SKILL.md` with `node scripts/build-skill-mirrors.cjs` (then `--check`). `dist/` bundles are regenerated at release (`node scripts/build-dist-bundles.cjs --check-stale`).

Recording on the CLI through a Larry-driven turn also works with no extra code: the plugin registers the same MCP server on the CLI (`.mcp.json` `mindrian-os`, alwaysLoad) and the Claude Code host is write-enabled (mcp-first-flag.cjs:139).

### Anti-Patterns to Avoid
- **A second write path:** never write `verification` with raw SQL or a second writer; always `recordClaimVerification` -> `insertNode`.
- **Touching review_status in B1 code:** no `review_status` override, no `confirmNode`, no `promoteNodeStatus` call anywhere in B1 files.
- **A percentage or single number:** no `coverage`, `score`, `pct`, `ratio`, `grade` key or rendered "% checked".
- **Hiding zero:** rendering "unchecked" only when non-zero fails AT3.
- **Naming collision:** Phase 355 is building a different thing called a "verification stamp" (`lib/core/verification-stamp.cjs`, a Theo-derived tier). Never name B1 files, keys or tools "stamp"; keep B1 vocabulary "checking record" / `verification`.
- **Rung vocabulary collision:** `lib/core/strategy/rung-vocabulary.cjs` declares itself the only home for the PROBLEM-TYPE rung vocabulary (Theo's Wicked / UnDefined / IllDefined / WellDefined). The verification rung is a separate vocabulary; name it `VERIFICATION_RUNGS`, keep it in verification.cjs, never import or edit rung-vocabulary.cjs (it is Phase 354-10 territory), and never pass a verification rung into any egress payload (part8-egress-guard `TAXONOMY_RUNGS` would refuse it anyway).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node upsert | raw `INSERT ... ON CONFLICT` | `insertNode` via `recordClaimVerification` | both-schema safety, epistemic_type gate, no-downgrade of review_status |
| room.db handle in MCP/CLI | `new DatabaseSync(...)` | `navigation.openRoomDbForCaller` / `closeRoomDbForCaller` | allow-listed chokepoint, check-substrate gate |
| Room resolution in MCP | cwd guessing | `resolveEffectiveSessionId` + `resolveSessionRoomDir` | session binding (room_bind) honored |
| Tool registration | editing register-core-tools.cjs or tool-router.cjs | drop-in `register` + `connectors` export in a tools/*.cjs file | auto-discovery seam; both files are peer territory |
| Registry JSON | hand-editing data/*.json | `node scripts/build-connector-registry.cjs` | generated files; `--check` fails on drift |
| Skill mirror | hand-editing skills/room/SKILL.md | `node scripts/build-skill-mirrors.cjs` | byte-mirror gate |
| Transaction ownership | nested BEGIN | `db.isTransaction` ownership pattern (lib/core/navigation/ranker-weights.cjs:114-125) | node:sqlite has no nested transactions |
| Confirmation | anything new | existing `gate_render` / `gate_answer` approve | the one human promotion door |

**Key insight:** every hard guarantee B1 needs (one write door, no review_status change, local-only, auto-registration) already exists in the tree. The work is wiring and three narrow fixes, not new machinery.

## Common Pitfalls

### Pitfall 1: Desktop and Cowork cannot write at all today (BLOCKS AT1)
**What goes wrong:** `claim_verify` (and `claim_write`) return `{ok:false, reason:'write_path_disabled'}` on Claude Desktop.
**Why it happens:** `isWritePathEnabled` (mcp-first-flag.cjs:131-143) returns true only for an explicit `MINDRIAN_MCP_FIRST`, the `claude-code` host, or a recognized tier0 host. `HOST_TIER_MAP` (surface-detect.cjs:125-141) does not list Claude Desktop, so `detectHostTier({name:'claude-ai'})` floors to `unknown` (:163-185). The Desktop setup snippet sets only `MINDRIAN_ROOM` (skills/setup/SKILL.md:69), never `MINDRIAN_MCP_FIRST`.
**Evidence:** live stdio probe in this session against `bin/mindrian-mcp-server.cjs`: client `claude-ai` -> `write_path_disabled`, `status_read.capability_floor = {host:'unknown', write_path_enabled:false}`; client `claude-code` -> claim written [VERIFIED: probe]. Claude Desktop sends `clientInfo: {name: "claude-ai", version: "0.1.0"}` [CITED: github.com/orgs/modelcontextprotocol/discussions/325, via WebSearch; MEDIUM]. The Cowork client name is not known [ASSUMED].
**How to avoid:** add `{ host: 'claude-desktop', re: /^claude-ai$/i }` to `HOST_TIER_MAP.tier0` (precedent: quick 260819-bql flipped the Claude Code host for the same reason, commit 5f0a55993), plus the Cowork name once probed. This is a security-relevant product ruling (T-234-08: the name is unauthenticated), so gate it behind a navigator checkpoint. Fallback if refused: the demo machines' Desktop config sets `"MINDRIAN_MCP_FIRST": "desktop,cowork"` in the server `env` block.
**Warning signs:** `status_read` shows `write_path_enabled: false`; the Desktop MCP log shows the initialize `clientInfo.name`.

### Pitfall 2: Re-filing a claim erases its record (BREAKS AT2 "visible months later")
**What goes wrong:** record a check, re-file the same claim (same session and text or segment), the record is gone and the portrait counts it unchecked.
**Why it happens:** typed-claim.cjs:139-177 rebuilds props; node-insert.cjs:246-247 overwrites properties on conflict.
**Evidence:** cross-process probe in this session: portrait `claims_disputed: 1` -> after re-file `claims_unchecked: 1`, `records_total: 0` [VERIFIED: probe].
**How to avoid:** Pattern 2. Test it for claim_write re-file AND a `graph-derivation`-style re-projection.

### Pitfall 3: A new session re-files instead of reopening
**What goes wrong:** claim ids are `claim:<sessionId>:<hash>` (typed-claim.cjs:102-110). An officer who re-files the same sentence in session 2 mints a NEW node (different session id) with no record, and sees "unchecked".
**How to avoid:** `claim_read` with `query` finds the existing claim by text; the demo script says "reopen", and the claim list shows the checking status next to each claim so a duplicate is visible. Do not attempt cross-session dedupe in B1.

### Pitfall 4: The substrate commit already broke three MCP surface tests
**What goes wrong:** after `42191a6ae` [VERIFIED: ran each test]:
- `tests/test-234-tool-description-floor.cjs`: FAIL, `claim_verify (111)` below the 120-char floor.
- `tests/test-270-tool-schema-budget.cjs`: FAIL, measured 41 tools / 43115 bytes vs recorded AFTER 40 / 38970 (delta 10.64 percent, over the 10 percent tolerance).
- `tests/test-276-tool-honesty-findings-closed.cjs`: FAIL, `frozen_sweep` 37 tools / 131 branches vs live 38 / 132.
**How to avoid:** lengthen the `claim_verify` description (say what it records and that review_status is never changed, only gate_answer approve by a person confirms); after `claim_read` lands, re-measure and re-baseline `AFTER` at tests/test-270-tool-schema-budget.cjs:264 with the measured numbers named in the commit message (the file's own protocol, :243-262); re-freeze `tests/fixtures/tool-honesty/276-dispositions.json` `frozen_sweep` with a `refrozen_at` entry. Re-measure LAST, because peer 354-14 edits `status.cjs` / `register-core-tools.cjs` and 354-15 edits `dual-path.cjs`, which move the same byte totals.

### Pitfall 5: Lost update under concurrent checks (Cowork)
**What goes wrong:** two officers record on the same claim at once; both read, both append, the second write drops the first record.
**Why it happens:** `recordClaimVerification` is read-modify-write with no transaction (:80-100).
**How to avoid:** wrap the read-append-write in a transaction using the ownership idiom from ranker-weights.cjs:114-125 (`const owns = db.isTransaction !== true; if (owns) db.exec('BEGIN IMMEDIATE'); ... COMMIT / ROLLBACK`). room-db already folds a busy timeout in. Do not touch `lib/core/write-lock.cjs` (Phase 354-04).

### Pitfall 6: "Disputed" can disappear
**What goes wrong:** status is set from the latest record only (:97-99). A later `supports` flips a disputed claim to checked, hiding that a contradiction was ever filed.
**How to avoid:** keep the records list and `records_by_result` visible in both the claim view and the portrait so contradictions stay countable; ask the navigator whether disputed should be sticky (Open Question 2).

### Pitfall 7: Not live until released
**What goes wrong:** B1 is green on `main` but the Rome laptops run the previous release.
**How to avoid:** the go/no-go checklist includes a release cut (release.sh lockstep) and a human install check on the actual Desktop and Cowork demo setups, plus the host-tier probe.

### Pitfall 8: Shared generated files
**What goes wrong:** `data/mcp-tool-connectors.json` and `data/connector-registry.json` are regenerated by any phase that touches a tools/*.cjs connector (354-15 lists both; 355 research names them).
**How to avoid:** regenerate immediately before the B1 commit, run `--check`, commit with `git commit --only`; if a peer has uncommitted edits to either file, coordinate rather than regenerate over them.

## Part 11 / CIRS: what a plan must include (question 3)

Current baseline, all run in this session [VERIFIED]: `build-connector-registry --check` OK; `build-orchestration-projection --check` OK; `check-render-coverage --check` OK; `build-render-coverage --check` OK; `check-shape-declaration --check` advisory WARNs only (pre-existing, e.g. skills/visualize); `check-help-coverage` valid; `build-command-registry --check` OK; `build-skill-mirrors --check` OK; `check-framework-vocabulary-drift --check` OK; `check-tool-honesty --check` OK (38 tools, 0 high-risk); `tests/test-270-connector-coverage.cjs` 6/6.

For each surface B1 adds or changes:

| Surface | Required declaration | Regenerate | Gate |
|---------|---------------------|------------|------|
| `claim_verify` (modified) | existing `connectors` entry (F.1, harness) stays; description >= 120 chars | `node scripts/build-connector-registry.cjs` if hitl_why changes | registry --check, test-234 floor, tool-honesty |
| `claim_read` (new MCP tool) | `connectors` entry `{tool, surface, connector:'mcp-tool', hitl_shape:'none', hitl_why, layer:'harness', layer_why}` in claim-verify.cjs | `node scripts/build-connector-registry.cjs` (updates mcp-tool-connectors.json + connector-registry.json; the coverage ledger is per-file and should not change) | registry --check, orchestration-projection --check, test-270-connector-coverage, test-270 budget (re-baseline), test-276 ledger (re-freeze) |
| `/mos:room` (modified command) | frontmatter unchanged (hitl_shape F.1, connector block unchanged); body adds subcommands; allowed-tools already include Bash + AskUserQuestion | `node scripts/build-skill-mirrors.cjs` | build-skill-mirrors --check, check-shape-declaration --check (tool-grant / wired-body predicates), check-render-coverage --check, check-help-coverage |
| `scripts/claim-checks.cjs` (new script) | not an invocable surface (not under commands/skills/agents) | - | check-substrate (no direct sqlite) |

**Plan frontmatter:** because `commands/room.md` is in files_modified, every such PLAN.md needs a conformant `cirs_relationship:` block (surfaces_added, surfaces_modified, surfaces_removed, spine_consumed, gate_impact, explanation) and `11` in `canon_parts`; verify with `node scripts/check-cirs-declaration.cjs --check <plan>`. The MCP-tool plan should declare it too (surfaces_added: [mcp:claim_read], surfaces_modified: [mcp:claim_verify]). Suggested canon_parts for B1 plans: [7, 8, 9, 11, 12].

**Orchestration projection:** no command connector block changes, so `data/brain-orchestration-projection.json` should not move; still run `--check` after regenerating the registry.

## Session Persistence (question 4)

- **Where the record lives:** `room.db` (`<roomDir>/.mindrian/room.db`), table `nodes`, column `properties`, key `verification` [VERIFIED: probe read it back from a fresh process].
- **Survives restart:** yes. Probe sequence in separate node processes: init room -> write claim + record -> read (record present, `review_status: proposed`) [VERIFIED].
- **Test harness patterns to copy (do not edit peer helpers):**
  - Stub-server capture: tests/test-276-claim-write-primitive.cjs:114-172 (`MINDRIAN_ROOMS_HOME` = fresh mkdtemp so a real registry never redirects writes; `openRoomDb` then `closeRoomDb` to create the db; stub `server.tool` captures handlers; call `reg.handler(params, {sessionId})`). For write tests of `claim_verify` under a Desktop identity, the stub must also expose `server.server.getClientVersion = () => ({name:'claude-ai', version:'0.1.0'})`.
  - Real stdio: tests/test-270-tool-schema-budget.cjs:80-135 (spawn `bin/mindrian-mcp-server.cjs`, JSON-RPC initialize with a chosen `clientInfo.name`, then `tools/call`). Use `MINDRIAN_ROOM=<tmp room>` and delete `MINDRIAN_MCP_FIRST` / `CLAUDE_ACTIVE_ROOM` from the child env.
  - Cross-process: a new helper `tests/helpers/b1-358-child.cjs <mode> <roomDir> <sessionId>` run with `child_process.spawnSync(process.execPath, ...)`: child A (`write`) registers tools and calls `claim_write` + `claim_verify` with session S1; child B (`read`) registers fresh and calls `claim_read {query}` with session S2. Assert the record, rung label and `review_status: proposed`. This is the literal "close everything, new session" test.

## Collision Map (question 5)

Sources: `git log -25 --name-only`, the files_modified of every 354 and 357 PLAN.md, Phase 355 RESEARCH/PATTERNS (355 has no PLAN.md yet), and `git status --porcelain` (only scripts/eval-icm-writers.cjs and tests/test-353-* are dirty, both forbidden to B1 anyway). 356 was not opened, per instruction.

| File | Owner / overlap | B1 action |
|------|-----------------|-----------|
| `lib/mcp/tools/gate.cjs` | 354-02 (shipped); 355 mentions it | DO NOT TOUCH. B1 needs no change: confirmation already works through gate_answer approve (gate.cjs:101-102) |
| `lib/mcp/tools/views.cjs` | 354-05 | do not touch |
| `lib/mcp/tool-router.cjs` | 354-05, 354-09; 355 | do not touch (auto-discovery makes it unnecessary) |
| `lib/mcp/register-core-tools.cjs` | 354-14 | do not touch (auto-discovery) |
| `lib/mcp/tools/status.cjs` | 354-14 | do not touch (so the portrait does NOT go into status_read) |
| `lib/mcp/tools/dual-path.cjs` | 354-15 | do not touch |
| `lib/mcp/tools/sensors.cjs` | 355 (whitespace_scan description) | do not touch |
| `data/mcp-tool-connectors.json`, `data/connector-registry.json` | 354-15, 355 (regenerated) | regenerate last, commit --only, coordinate if dirty |
| `lib/core/strategy/rung-vocabulary.cjs`, `lib/core/part8-egress-guard.cjs` | 354-06, 354-10 | do not touch |
| `lib/core/write-lock.cjs` | 354-04 | do not touch |
| `lib/core/navigation.cjs` | 355 cites it (writeOpportunityNode), no 354/357 plan edits it | additive re-export lines only; small, low risk; commit --only |
| `lib/core/navigation/verification.cjs`, `typed-claim.cjs`, `lib/mcp/tools/claim-verify.cjs`, `lib/mcp/surface-detect.cjs`, `lib/mcp/mcp-first-flag.cjs`, `commands/room.md`, `skills/room/SKILL.md`, `scripts/mos-status.cjs` | none found in any peer plan | B1-owned |
| `tests/test-270-tool-schema-budget.cjs`, `tests/fixtures/tool-honesty/276-dispositions.json`, `tests/test-234-*` | none in peer plans, but shared measurement | re-baseline last |
| `CLAUDE.md` | 354-18 | B1 does not edit it |

## Code Examples

### Rung validation inside recordClaimVerification (sketch)
```javascript
// Source: pattern from lib/core/navigation/verification.cjs:67-103 (this repo)
const rungRaw = params.rung;
let rungRec = null;
if (rungRaw !== undefined && rungRaw !== null) {
  rungRec = rungInfo(rungRaw);
  if (!rungRec) return { ok: false, reason: 'invalid_rung' };
}
// ... after building `record`:
if (rungRec) { record.rung = rungRaw; record.rung_label = rungRec.label; }
```

### Carry-forward in writeClaimNode (sketch)
```javascript
// Source: typed-claim.cjs:198-227 upsert site; read-merge precedent abstraction-claim.cjs:172
const CARRY_FORWARD_CLAIM_KEYS = Object.freeze(['verification']);
try {
  const prior = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
  const priorProps = prior && prior.properties ? JSON.parse(prior.properties) : null;
  if (isPlainObject(priorProps)) {
    for (const k of CARRY_FORWARD_CLAIM_KEYS) {
      if (isPlainObject(priorProps[k])) props[k] = priorProps[k];
    }
  }
} catch (_e) { /* never block the claim write on a carry-forward read */ }
```
(Compute `nodeId` before building `propsJson`, which means moving the id computation at :206-208 above the serialize at :198-203.)

### Desktop host recognition (sketch, navigator checkpoint)
```javascript
// Source: lib/mcp/surface-detect.cjs:131-140 tier0 list
{ host: 'claude-desktop', re: /^claude-ai$/i },
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Write path gated at registration | Always registered, gated per call (`write_path_disabled` hint) | Phase 234-05 | Desktop sees the tools but is refused; B1 must fix the host tier, not the registration |
| Claude Code host refused writes | Claude Code write-enabled | quick 260819-bql (5f0a55993) | Precedent for recognizing Claude Desktop |
| `claim_write` absent on MCP | `claim_write` files a proposed claim | Plan 276-12 | Officers can file on MCP, once writes are enabled |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Desktop's `clientInfo.name` is `claude-ai` (MEDIUM: single community source via WebSearch, not official docs) | Pitfall 1 | Host regex misses Desktop; writes stay off. Mitigation: live probe of the Desktop MCP log before 6 Oct, and the `MINDRIAN_MCP_FIRST` fallback |
| A2 | Cowork's client name is unknown; it may be `claude-code`, `claude-ai`, or something else | Pitfall 1 | Cowork writes stay off. Same probe and fallback |
| A3 | The five rungs on what-ai-cannot-know.vercel.app are an acceptable provisional list until The Orientation Problem list arrives | Pattern 1 | Wording mismatch on the slide; one-constant swap fixes it |
| A4 | Officers will reopen claims by text search rather than by id | Pattern 3, Pitfall 3 | If they re-file, they see a fresh unchecked duplicate |
| A5 | Latest-result-wins status is acceptable for "disputed" | Pitfall 6 | A contradiction could look resolved on the slide demo |

## Open Questions

1. **Recognize Claude Desktop (and Cowork) as write-enabled hosts?**
   - What we know: the gate refuses Desktop today (probed); precedent exists for flipping a host.
   - What's unclear: the exact Cowork client name; whether the navigator accepts widening the unauthenticated-name convenience gate.
   - Recommendation: approve `claude-ai` as tier0 now (checkpoint task), probe Cowork on a real session, keep the env-var fallback documented for the demo machines.
2. **Should "disputed" be sticky?**
   - What we know: status = latest result (:97-99).
   - Recommendation: keep shipped behavior for 6 Oct; show `records_by_result` everywhere; revisit with the paper author.
3. **Should "by" show a person, not just `user`?**
   - What we know: CONTEXT specifics show "by / when"; `checked_by` is `user|system`; `navigation.resolveByUser(roomDir)` (confirm-node.cjs:54-71) already resolves a non-agent navigator id from USER.md for confirmations.
   - Recommendation: add an optional `checked_by_id` stamped from `resolveByUser` at the MCP/CLI layer (local only, Part 8 safe). Low effort; planner may defer.
4. **Should Larry's runtime instructions mention the two tools?**
   - What we know: tool descriptions are how Desktop Larry discovers tools; the runtime loop text lives in `lib/mcp/runtime-instructions.cjs`.
   - Recommendation: rely on descriptions for 6 Oct; do not edit the instructions (budget and parity tests guard them).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 | - |
| node:sqlite | room.db | yes (experimental warning only) | built-in | - |
| zod | MCP schemas | yes | 3.25.76 | - |
| Real Claude Desktop | AT1 live smoke | not in this environment (WSL) | - | human checkpoint on the demo machine |
| Real Cowork | AT1 live smoke | not in this environment | - | human checkpoint |

**Missing dependencies with no fallback:** none for automated work. The live Desktop/Cowork smoke is manual-only by nature.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain node scripts with `node:assert/strict` and a pass/fail counter (repo convention), aggregated by bash |
| Config file | none |
| Quick run command | `node tests/test-358-b1-core.cjs` |
| Full suite command | `bash tests/run-all-358.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| B1-01 | rung ordered constant, invalid_rung refused, legacy record reads "rung unknown", `rung >= 3` expressible, schema enum derived from constant | unit | `node tests/test-358-b1-core.cjs` | no, Wave 0 |
| B1-02 | `claim_verify` writes under client `claude-ai` (after host fix) and under `claude-code`; CLI `claim-checks.cjs record` writes; both through `recordClaimVerification` | integration (stub server + spawned CLI) | `node tests/test-358-b1-surfaces.cjs` | no, Wave 0 |
| B1-03 | child process A writes, child process B (new session id) reads the record by text; re-file via `claim_write` keeps the record; re-projection via `writeClaimNode` keeps it | integration (spawnSync) | `node tests/test-358-b1-persistence.cjs` | no, Wave 0 |
| B1-04 | claim view returns confirmation and checking_record side by side with the "only a person can confirm" note; never the word "verified" as a status label | unit + integration | `node tests/test-358-b1-core.cjs` and `node tests/test-358-b1-surfaces.cjs` | no, Wave 0 |
| B1-05 | portrait: empty room renders all four states and 0 unchecked; no key or text matching /score|percent|pct|ratio|grade|coverage/; CLI `portrait` output contains the word unchecked when zero | unit + CLI | `node tests/test-358-b1-portrait.cjs` | no, Wave 0 |
| B1-06 | for proposed AND confirmed claims, each of supports/contradicts/inconclusive leaves review_status byte-identical; `confirmNode` after a check keeps the record | unit | `node tests/test-358-b1-separation.cjs` | no, Wave 0 |
| B1-07 | born-wired and MCP surface guards green | gates | see Sampling below | existing scripts |
| AT1 live | real Claude Desktop and Cowork: record a check hands-on | manual-only (host UI) | human checkpoint with a scripted demo | - |

Existing tests to keep green: `node tests/test-b1-verification.cjs` (update its deepEqual), `node tests/test-276-claim-write-primitive.cjs`, `node tests/test-234-host-tier.cjs`, `node tests/test-234-tool-description-floor.cjs`, `node tests/test-270-tool-schema-budget.cjs`, `node tests/test-270-connector-coverage.cjs`, `node tests/test-276-tool-honesty-findings-closed.cjs`, `node tests/test-353-filing-gate.cjs` (run, never edit), `node tests/test-276-meeting-gate-wiring.cjs`.

### Sampling Rate
- **Per task commit:** the task's own `tests/test-358-b1-*.cjs` plus `node tests/test-b1-verification.cjs` (each runs in a few seconds, offline).
- **Per wave merge:** `bash tests/run-all-358.sh`, which also runs `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs --check`, `node scripts/check-shape-declaration.cjs --check`, `node scripts/build-skill-mirrors.cjs --check`, `node scripts/check-tool-honesty.cjs --check`, and a targeted em-dash guard over B1-owned files.
- **Phase gate:** runner green, then `node scripts/doctor.cjs --acceptance`, then the human Desktop/Cowork smoke, then release.

### Wave 0 Gaps
- [ ] `tests/run-all-358.sh` - modeled on tests/run-all-354.sh (run/run_if legs, exit 77 = SKIPPED ENV GAP never reported as PASSED); written once, lists every planned B1 test file up front so later plans do not edit it; B2 legs can be added deliberately in the B2 plan set.
- [ ] `tests/helpers/b1-358-child.cjs` - cross-process child for B1-03.
- [ ] `tests/test-358-b1-core.cjs`, `test-358-b1-surfaces.cjs`, `test-358-b1-persistence.cjs`, `test-358-b1-portrait.cjs`, `test-358-b1-separation.cjs` - RED first.
- No framework install needed.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local plugin; MCP host identity is a UX signal, not auth (T-234-08) |
| V3 Session Management | partial | session-to-room binding via existing `resolveSessionRoomDir` |
| V4 Access Control | yes | server-side write gate `isWritePathEnabled` (widening it is a navigator ruling); only `confirmNode` promotes |
| V5 Input Validation | yes | zod at the MCP boundary + closed-enum and length checks in `recordClaimVerification` (fail closed) |
| V6 Cryptography | no | - |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged record via `extraProps` on claim write | Tampering | add `verification` to `PROTECTED_CLAIM_KEYS` |
| Agent self-confirms after checking | Elevation of privilege | B1 code never calls confirm/promote; only gate_answer approve by a person |
| Host spoofing its clientInfo name to gain writes | Spoofing | accepted risk per T-234-08; writes still go through navigation validation |
| Room content leaking to the Brain | Information disclosure | zero Brain calls in B1 files; test asserts no `brain` require in them |
| Lost update under concurrency | Tampering / integrity | transaction ownership idiom (Pitfall 5) |
| SQL injection | Tampering | prepared statements with `?` binds only (existing pattern) |

## Sources

### Primary (HIGH confidence)
- Codebase reads in this session: lib/core/navigation/verification.cjs, lib/mcp/tools/claim-verify.cjs, lib/mcp/tools/claim.cjs, lib/core/node-insert.cjs, lib/core/navigation/typed-claim.cjs, lib/core/navigation.cjs, lib/mcp/register-core-tools.cjs, lib/mcp/mcp-first-flag.cjs, lib/mcp/surface-detect.cjs, lib/mcp/tools/graph.cjs, lib/mcp/tools/status.cjs, lib/mcp/tools/room.cjs, lib/core/navigation/confirm-node.cjs, commands/room.md, commands/status.md, commands/graph.md, scripts/build-connector-registry.cjs, scripts/check-shape-declaration.cjs, scripts/check-render-coverage.cjs, scripts/check-cirs-declaration.cjs, scripts/build-skill-mirrors.cjs, skills/setup/SKILL.md, tests/test-b1-verification.cjs, tests/test-276-claim-write-primitive.cjs, tests/test-270-tool-schema-budget.cjs, tests/run-all-354.sh
- Live probes in this session: stdio MCP server as `claude-ai` vs `claude-code`; cross-process write/read/re-file of a claim record; all CIRS gate `--check` runs; baseline runs of the MCP surface tests
- Paper author's site: https://what-ai-cannot-know.vercel.app/ (verification hierarchy, rungs 1-5)
- Acceptance page: https://mindrian-explainer-gate.vercel.app/nato.html (acceptance tests, fallback wording, rung request)

### Secondary (MEDIUM confidence)
- https://github.com/orgs/modelcontextprotocol/discussions/325 (Claude Desktop initialize `clientInfo.name: "claude-ai"`), via WebSearch

### Tertiary (LOW confidence)
- Cowork MCP client name: not found; needs a live probe

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; versions checked locally
- Architecture: HIGH - every seam read and the two blocking defects reproduced by probe
- Pitfalls: HIGH for 2, 4, 5, 6 (code-proven); MEDIUM for 1 (Desktop name from one community source, gate logic code-proven); LOW for the Cowork half of 1

**Research date:** 2026-09-23
**Valid until:** 2026-10-06 (go/no-go); re-check the Collision Map before each wave because peers 354-357 are active in the same tree
