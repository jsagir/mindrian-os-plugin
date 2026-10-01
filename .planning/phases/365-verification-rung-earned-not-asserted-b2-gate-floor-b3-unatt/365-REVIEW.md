---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
reviewed: 2026-10-01T00:00:00Z
depth: deep
files_reviewed: 27
files_reviewed_list:
  - lib/mcp/tools/gate.cjs
  - lib/mcp/gate-render.cjs
  - lib/mcp/never-do-gate.cjs
  - lib/mcp/tool-router.cjs
  - lib/mcp/tools/chain.cjs
  - lib/mcp/tools/claim-verify.cjs
  - lib/mcp/tools/research.cjs
  - lib/core/chain-executor.cjs
  - lib/core/room-constraints.cjs
  - lib/core/research-planner/ambient.cjs
  - lib/core/eureka/explore-chain.cjs
  - lib/core/frontmatter-schemas.cjs
  - lib/core/navigation.cjs
  - lib/core/navigation/confirm-node.cjs
  - lib/core/navigation/transitions.cjs
  - lib/core/navigation/verification.cjs
  - lib/core/navigation/verification-floor.cjs
  - lib/core/navigation/verification-signals.cjs
  - lib/core/navigation/memory-events.cjs
  - lib/core/navigation/insights.cjs
  - lib/core/navigation/room-home.cjs
  - lib/core/navigation/graph-export.cjs
  - lib/core/proactive-intelligence.cjs
  - lib/graph/graph-detail-panel.js
  - scripts/research-planner.cjs
  - scripts/mos-status.cjs
  - commands/research.md
findings:
  critical: 1
  warning: 9
  info: 5
  total: 15
status: issues_found
---

# Phase 365: Code Review Report

**Reviewed:** 2026-10-01
**Depth:** deep
**Files Reviewed:** 27 (source of the feat/fix/test(365-*) commits since 748532076; docs, tests and peer commits excluded)
**Status:** issues_found

## Summary

The floor promotion in `gate.cjs` is structurally sound: it reads the claim's own outbound edges (never the card's evidence ids), fails to NOT-confirming on a throw, runs outside any transaction, and writes an audit event. `room-constraints.cjs` fails shut on a malformed file, re-reads on every call, and the writer refuses without an approval trail. The `never-do-gate.cjs` proposal flow only lands an entry after gate_answer wrote the decision node. Ambient halts before `coverFor` / `recordRun` / `runQuick`, so zero egress holds. No Canon Part 8 leak was found (snapshot, event and card payloads carry ids, enums, counts and local text only) and Part 9 holds for the new writes (all through navigation, plus the room-local `.mindrian/*.json` ledgers which are the established pattern).

The serious problems are on the B3 side: two of the five never-do kinds (`section`, `path`) are effectively unreachable on the production `chain_run` path, so a navigator can name a section the list will never stop. On the B2 side the "earned" standing is weaker than the card wording implies, the why-line can be truncated away by untrusted text, and the D-20 transition opens a held-to-confirmed door for every other `confirmNode` caller.

## Critical Issues

### CR-01: never-do `section` kind (and in practice `path`) never fires on the production chain_run path

**Status:** FIXED (section kind) in commit 6e29812de, failing test first in 7ff300986 (`tests/test-365-cr01-section-live.cjs`, drives the registered chain_run handler at start and on the resumed tail).
**Resolution:** `declaredFieldsOfChainStep` now derives the section from the step's own registry-declared `produces` (`room/<section>/...`) when no `ctx.targetSection` is given; a glob in the section position (`room/**`, `room/*`) names no single section and yields none. The step is read per step, so the resumed tail is covered; the saved `targetSection` is also forwarded in `_executeResumedEntry`. The chain_run schema and description are unchanged (K5 green). Not changed here: the `path` kind still comes only from `executable.produces` (one command today), and `FLOOR_SENTENCE` still does not say which kinds are enforced on which surface (D-15).

**File:** `lib/mcp/tools/chain.cjs:804-826` (resume tail), `lib/mcp/tools/chain.cjs:918-928` (MCP handler), `lib/core/room-constraints.cjs:209-225`
**Issue:** `declaredFieldsOfChainStep` takes `section` only from `ctx.targetSection`, which `makeGateFn` receives from `runChain` opts. Verified by grep: no production caller supplies `targetSection` to `chainRun`. The `chain_run` MCP handler calls `chainRun(workflow, { roomDir, sessionId, gateRenderCtx, subjectNodeId, evidenceNodeIds })` with no `targetSection` (the tool schema has no such field, and 365-09 left the schema untouched). The resume tail `chainRun(entry.restSteps, {...})` at line 804 also drops it even though `resumeEntry.targetSection` was saved at line 559 (365-09-SUMMARY admits the tail gap, but not that the START call has no source either). `path` comes only from the registry `executable.produces`, and `data/command-registry.json` has exactly one such command (`/mos:snapshot`, `exports/hub.html`); the many `room/**/x/*` values are not `executable.produces`.
Failure scenario: the navigator approves "never file into section `legal` unattended" (kind `section`, value `legal`). A chain run via the `chain_run` tool targets `legal`; `checkStep` sees `section: null`, finds no match, returns `halt:false`, and the step runs. The list shows "1 named" in `/mos:status --checks`, so the navigator believes the protection exists. The proposal pre-fill also picks `section` over `command` when it can, so the offered entry can be one that cannot bite.
**Fix:** Either source the section from the step itself (read `step.section` / `step.target_section` / `step.args.section` in `declaredFieldsOfChainStep` when `ctx.targetSection` is absent) or forward it end to end, and forward it in the resume tail:
```js
// chain.cjs _executeResumedEntry, continuation call
targetSection: entry.targetSection || undefined,
```
and until a real source exists, make `proposalFromFields` skip `section`/`path` kinds for chain halts and say in `FLOOR_SENTENCE` which kinds are enforced on which surface (D-15). Add a test that drives `chain_run` through the MCP handler with a `section` entry and asserts a halt.

## Warnings

### WR-01: why-line can be truncated by untrusted locator text, dropping the sentence that says what approve does

**File:** `lib/core/navigation/verification-floor.cjs:101-123, 150-170`
**Issue:** `describeSource` appends the source host, an unbounded `locator` string (from the target node or edge properties, i.e. external web bytes) and the retrieval date into the first sentence. The whole notice is then cut at `NOTICE_CAP` (400) with `slice(0, 397) + '...'`, and `gate-render.cjs` `_normalizeText` cuts again. The landing sentence ("so approving confirms it" / "files it as needs evidence") is the LAST part, so it is what gets cut. Locator text also lands verbatim in a card shown to the human and returned to the model, so it can imitate the floor sentence ("This meets the floor, so approving confirms it.").
Failure scenario: a located source with a 380-character locator (or an adversarial one) produces a notice ending "...(retrieved 2026-09-01)..." with no landing sentence; the human clicks "Approve" with no statement of what it does, contrary to D-05.
**Fix:** cap the source description (`locator.slice(0, 60)`, host as is) and build the notice so the landing sentence is protected, as `chain.cjs` `_constraintNotice` and `never-do-gate.cjs` `proposalNotice` already do (trim the variable part, keep the fixed part whole). Strip control characters from the locator.

### WR-02: the structural standing accepts any node with two non-empty strings, wider than the accepted "gameable" pitfall

**File:** `lib/core/navigation/verification.cjs:408-431` (also `lib/core/navigation/verification-floor.cjs:101-123`)
**Issue:** 365-RESEARCH Pitfall 10 accepts that "a caller able to write a claim -> EvidenceClaim edge with a url passes". The code is looser: the target can be ANY node type (including another claim or an unrelated EvidenceClaim), `url` and `retrieved_at` only need `trim().length > 0` (no http(s) scheme, no date parse), and edge direction/relevance is not checked. `claim_write`/`artifact_file` let the filer choose `evidence_node_ids`, and `graph_write` can add a `SOURCED_FROM` edge between existing nodes.
Failure scenario: an agent files a claim and attaches `evidence_node_ids` pointing at any previously retrieved, unrelated web finding. `claimStanding` returns `source_edge`; the card says "Checked against: example.org (retrieved ...)" and approving confirms. The standing was asserted by the filer, the thing the phase exists to prevent.
**Fix:** require target `type === 'EvidenceClaim'` (or an explicit allow-list), require `retrieved_at` to parse as a date and `url` to start with `http://` or `https://`, and exclude targets that are themselves claims or that carry a `CONTRADICTS` edge from this claim. Keep naming the accepted source on the card (already done).

### WR-03: needs_evidence -> confirmed is now open to every confirmNode caller with no floor check

**File:** `lib/core/navigation/transitions.cjs:69,82`; callers `lib/workflow/selector-decisions.cjs:166`, `lib/core/lens-engine.cjs:264`, `lib/core/eureka/qualify-opportunity.cjs:204`
**Issue:** D-20 added the transition to the global closed taxonomy so any caller of `confirmNode` can now move a HELD claim to confirmed. The floor is enforced only inside `gate.cjs` `_floorPromoteClaim`. `selector-decisions.recordSelectorDecision({decision:'approve', nodeId})` accepts an arbitrary node id and calls `confirmNode`.
Failure scenario: a claim held at needs_evidence because the room requires a source is passed to the selector accept path; before this phase that returned `invalid_transition`, now it confirms with no floor check, no why-line and no `approval_floor_checked` event. D-04 says the only routes out are add evidence and approve again, or lower the floor.
**Fix:** keep the transition out of the global table and let only the floor path use it (add an `opts.viaFloor` flag to `promoteNodeStatus` that the table check honours for `needs_evidence->confirmed`), or add the same floor read to `confirmNode` callers that can target claims. At minimum document that held claims are not protected on the other doors.

### WR-04: floor consent mismatch when standing changes between render and click (TOCTOU is reported after the write)

**File:** `lib/mcp/tools/gate.cjs:55-122, 606-617`
**Issue:** The card predicts a landing at render time (`floor_prediction`). `_floorPromoteClaim` recomputes at click time and acts on the NEW result; the mismatch is only reported afterwards as `floor_changed_since_render`. If the card said "Approve, mark as needs evidence" and a source was attached before the click, the claim is CONFIRMED although the human consented to a hold. The reverse (floor raised, card promised confirm) lands held, which is the safe direction.
**Fix:** when `live.floor_prediction === 'needs_evidence'` and the click-time verdict is `met`, hold at the predicted landing (return `subject_skip_reason: 'floor_changed_since_render'`, write nothing but the audit event) and require a fresh gate. Only escalate on an exact prediction match.

### WR-05: weekly stall signal says "last 4 weeks" for any four snapshots, however far apart

**File:** `lib/core/navigation/verification-signals.cjs:228-240`
**Issue:** `stallSignal` takes the last `STALL_WEEKS` snapshots, not four consecutive ISO weeks. Snapshots are written only when `persistIntelligence` runs (a post-filing cascade), so gaps are normal. Reproduced: snapshots for 2026-W01, W10, W20, W39 with flat counts and growing `records_total` yield "Checks in the last 4 weeks moved no claim past asking a model."
Failure scenario: a room worked on four times across nine months is told it stalled "in the last 4 weeks", a false statement on a Zone 3 strip the navigator trusts (and Canon Part 12 wants copy to describe what was done).
**Fix:** require the window's first and last week keys to span at most `STALL_WEEKS` ISO weeks (compare week indexes), or word the message from the real span ("Over the last N snapshots (from W01 to W39) ...").

### WR-06: halted_constraint card is marked surfaced before its gate is minted; the gate lives only in process memory

**File:** `lib/mcp/tools/research.cjs:614-619, 697-702`; `lib/core/research-planner/planner.cjs:686`
**Issue:** `opPending` calls `markSurfaced` for every card and only then `attachNeverDoGates`. The gate ledger is in-process (30-minute TTL, lost on restart). If minting fails (caught and swallowed), or the server restarts, or the user does not answer, the card is `surfaced: true` and `pendingCards` never returns it again. The CLI `pending` command (`scripts/research-planner.cjs`) marks surfaced without minting at all. The halt that stopped a research run is then visible only in `.mindrian/constraint-trips.jsonl`.
**Fix:** mark surfaced only after a successful mint (or after the navigator answers), and have the CLI path leave `halted_constraint` unsurfaced until the offer was made.

### WR-07: never-do CLI door manufactures its own approval trail

**File:** `scripts/research-planner.cjs:232-261, 436-442`
**Issue:** `never-do add ... --approved-via cli` is a self-asserted flag. `approveNeverDoEntry` itself mints the decision node and then passes its id as the "approval trail", so the trail proves nothing about a human yes (the MCP path is stronger: gate_answer wrote the node). Also, the node is written BEFORE the entry is validated, with text "Approved never-do entry ... via cli", so a refused entry (`invalid_why`, `invalid_path`, `existing_file_malformed`) still leaves a node saying it was approved (the code comment calls this deliberate). The `kind` is interpolated unvalidated into node text.
**Fix:** validate the entry (kind in `KINDS`, value, why, path rules) before minting the node, word the node text from the validated entry, and mint the node only on success. Document in the command text that this door is trust-the-caller, as `grant approve` is.

### WR-08: makeGateFn silently skips the never-do check when roomDir is missing; other runChain callers never pass it

**File:** `lib/core/chain-executor.cjs:850`; `lib/core/bono/debate-composition.cjs:350`; `scripts/act-command.cjs:247`
**Issue:** `(1b)` runs only `if (typeof o.roomDir === 'string' && o.roomDir !== '')`. D-13 says fail shut, and D-12 says read before every unattended step. A caller that omits `roomDir` (the bono debate composer builds `makeGateFn({ postureFn })`; `act-command` supplies its own `gateFn`) gets no check and no signal. Likewise `explore-chain` passes `roomDir` but no `targetSection`.
**Fix:** make the missing roomDir loud: when `makeGateFn` is built without `roomDir`, record the fact (`constraint_check: 'skipped_no_room'` on the halt/trace) or require callers to pass `neverDo: false` explicitly; add `roomDir` to the debate-composition call.

### WR-09: module-level WeakMap keyed by step object can leak a constraint verdict into an unrelated halt

**File:** `lib/core/chain-executor.cjs:808-823, 1160-1170, 1619-1630`
**Issue:** The verdict is stored in a process-wide `WeakMap` keyed by the (possibly shared) step object, and deleted only when a later `makeGateFn` call with a non-empty `roomDir` passes the check. `_haltReasonFor` runs after `gateFn` returns. If the same step object is reused across runs (a cached or static chain definition) and a later run has no `roomDir` or a custom `gateFn`, a stale verdict makes an ordinary halt report `constraint_named` and attach another room's `constraint {kind, value, why}` to `haltedAt`, which `chain.cjs` then shows on the card and suppresses the never-do offer for.
**Fix:** return the verdict from the gate instead of side-channel state (e.g. the gate function returns `'halt'` and sets `gateFn.lastVerdict` on a closure created per `makeGateFn` call), or key the map by `(runId, stepIndex)` and clear it at the end of each `runChain`.

## Info

### IN-01: held_claims is produced but nothing renders it

**File:** `lib/core/navigation/room-home.cjs:88-113, 185`
**Issue:** `getHeldClaims` feeds `held_claims` on the room-home view, but grep finds no consumer outside `room-home.cjs` (the wiki room-home and briefing renderers do not read it). Commit 5a01aeba8 says "held claims shown". Only `findUnsupportedClaims` and the `/mos:status --checks` held row surface held claims.
**Fix:** render it in `lib/wiki/room-home.cjs` / the room-context leg, or correct the commit/summary claim.

### IN-02: proposalProblem checks less than the writer, so a bad proposal can be approved and then refused

**File:** `lib/mcp/never-do-gate.cjs:54-61`
**Issue:** The comment says a bad proposal never reaches a person, but only kind, value and why presence are checked. Value over 200 chars, why over 300, or a `path` value that is absolute or contains `..` pass here and fail in `writeNeverDoEntry` after the click. Cards read from `card.json` on disk (ambient) are not produced by `proposalFromFields`, so they are not pre-filtered.
**Fix:** export and reuse `validateEntry`-style checks (`MAX_VALUE`, `MAX_WHY`, `pathEntryProblem`) from `room-constraints.cjs` in `proposalProblem`.

### IN-03: stale comment on holdForEvidence export

**File:** `lib/core/navigation.cjs:654-658`
**Issue:** "Until then this value is undefined" is no longer true since 365-05; the same file's export now exists. Misleading to the next reader.
**Fix:** delete the sentence.

### IN-04: redundant isIrreversibleStep calls and no never-do removal path

**File:** `lib/core/chain-executor.cjs:1163,1622` / `lib/core/room-constraints.cjs`
**Issue:** `reason: isIrreversibleStep(step) ? 'forced_material' : _haltReasonFor(step)` re-tests what `_haltReasonFor` already tests (the repair commit needed the literals visible, so this is deliberate, but the double check is noise). Separately there is no `never-do remove`; a wrongly approved entry can only be removed by hand-editing JSON, and a hand edit that omits `approved_via` makes the whole file malformed, which halts every unattended step (by design, D-13).
**Fix:** add a `never-do remove <index>` door that goes through the same approval trail, and say in the `neverDoLine` fix text that hand-added entries need `approved_via`.

### IN-05: path, section, command and provider matching is byte-exact and case-sensitive

**File:** `lib/core/room-constraints.cjs:166-181`
**Issue:** only `term` is trimmed and lowercased. On case-insensitive filesystems a `path` entry `Exports/hub.html` will not match `exports/hub.html`; a declared `command` with trailing whitespace will not match its trimmed entry. This follows D-11 literally, but D-15's floor sentence does not mention it.
**Fix:** trim declared values, and compare `path` case-insensitively on win32/darwin, or document the exactness in `FLOOR_SENTENCE`.

---

_Reviewed: 2026-10-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
