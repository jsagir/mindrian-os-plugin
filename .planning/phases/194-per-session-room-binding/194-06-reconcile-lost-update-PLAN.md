---
phase: 194-per-session-room-binding
plan: 06
type: execute
wave: 4
depends_on: ["194-02"]
files_modified:
  - lib/core/navigation/abstraction-claim.cjs
  - lib/core/breakthrough/verb-dispatch.cjs
  - lib/core/breakthrough/scanner.cjs
  - scripts/check-pending-ambiguous.cjs
  - lib/core/navigation/reconcile-guard.cjs
  - lib/core/navigation/transitions.cjs
  - lib/core/temporal/supersession.cjs
  - lib/core/navigation.cjs
  - lib/workflow/reconcile-f9-adapter.cjs
autonomous: true
requirements: [PSB-08, PSB-09, PSB-10, PSB-12]

must_haves:
  truths:
    - "Every read-merge-write UPDATE (abstraction-claim, both breakthrough sites, check-pending) now ALSO bumps last_modified_at - the CAS token moves on every content mutation"
    - "The two node-birth UPDATE sites (typed-domain, room-birth) are EXCLUDED from the bump, documented with rationale, and allowlisted in the discipline floor"
    - "checkLostUpdate returns conflict iff current last_modified_at > the caller readVersion; NULL-vs-NULL or absent readVersion -> no conflict (append/legacy safe)"
    - "The reconcile-guard is gated behind the presence fast-path: no live co-session -> the guard never arms (single-session case pays zero cost)"
    - "A detected lost-update raises a RECONCILE event -> F.9 gate; APPROVE re-applies the held UPDATE, REJECT records NOT_APPLIED, DEFER leaves a CONTRADICTS pair"
    - "A non-interactive/async write context defaults to DEFER (CONTRADICTS pair, no data lost) and surfaces the pending reconcile next interactive turn"
  artifacts:
    - path: "lib/core/navigation/reconcile-guard.cjs"
      provides: "checkLostUpdate(db, nodeId, readVersion) -> {conflict, currentVersion}; the ONE CAS helper"
      exports: ["checkLostUpdate"]
    - path: "lib/workflow/reconcile-f9-adapter.cjs"
      provides: "RECONCILE -> renderShapeF9 -> consumeF9Ordered with a reconcile-specific graph adapter (APPROVE re-apply)"
      exports: ["reconcileViaF9"]
    - path: "lib/core/navigation/abstraction-claim.cjs"
      provides: "persistAbstractionLevel UPDATE repaired to bump last_modified_at + checkLostUpdate guard"
      contains: "last_modified_at"
  key_links:
    - from: "lib/core/navigation/transitions.cjs"
      to: "lib/core/navigation/reconcile-guard.cjs checkLostUpdate"
      via: "call after the state_mismatch check, before BEGIN, gated behind the presence fast-path"
      pattern: "checkLostUpdate"
    - from: "lib/workflow/reconcile-f9-adapter.cjs"
      to: "lib/workflow/f9-ordered-consumer.cjs consumeF9Ordered"
      via: "inject a reconcile graph adapter whose APPROVE re-runs the held UPDATE"
      pattern: "consumeF9Ordered"
---

<rules>
## RULES

- **A1/A4 CORRECTION (LOAD-BEARING - the reason this plan exists in this order):** the CAS token `last_modified_at` is bumped by ONLY `promoteNodeStatus` today. FIVE other same-node UPDATE sites do NOT bump it. `supersede` is NOT a separate site (it delegates to promoteNodeStatus - thread the token, do not add a guard). Task 1 MUST land the token bumps on the read-merge-write sites BEFORE Task 2 builds the guard on the token. Do NOT build the guard on a token that does not yet move at the sites it must catch.
  - BUMP (read-merge-write, lost-update-invisible today): abstraction-claim.cjs:126, breakthrough/verb-dispatch.cjs:200, breakthrough/scanner.cjs:418, check-pending-ambiguous.cjs:151.
  - EXCLUDE with explicit in-code rationale (node-birth / pure-maintenance; a co-session cannot hold a readVersion of a node being born): typed-domain.cjs:149, room-birth.cjs:278.
  - FLOOR: flip test-194-lastmod-discipline to a hard run - every properties/review_status UPDATE under lib/core/navigation/ + abstraction-claim + the breakthrough merge sites bumps last_modified_at, EXCEPT the two allowlisted node-birth sites.
- **Part 9 (chokepoint):** the guard rides the EXISTING navigation UPDATE paths; reconciled edges land `proposed`; the APPROVE re-apply still mints proposed (a human confirms).
- **Part 11 (born WIRED):** COMPOSE renderShapeF9 + consumeF9Ordered per D-00 (F.9 is canonical; 194 composes, never builds a new selector); DEFER->CONTRADICTS and REJECT->NOT_APPLIED are ALREADY shipped - the ONLY reconcile-specific wiring is the APPROVE re-apply adapter. Build NO new shape.
- **Zero-friction (PSB-12):** the guard arms ONLY when listLiveCoSessions is non-empty. No live co-session -> FAST PATH (skip version-check + gate). This is the load-bearing perf property.
- **Pitfall 1 (NULL token):** treat readVersion==null OR current==null as no-conflict -> fall through to the normal write (which sets a non-null stamp and repairs the row). NEVER reconcile NULL-vs-NULL.
- **Append-safe:** callers passing no readVersion skip the check (byte-identical to today).
- **Fail OPEN:** a guard/adapter error degrades to the normal (old) write, never a lockout.
- Frozen scalars (PAGE_CEILING=4) untouched. CJS only. NO em-dashes.
- Resumable: Task 1 (SQL bumps + floor) is independently commitable before Task 2/3.
</rules>

<objective>
Land the optimistic lost-update reconcile at the navigation chokepoint (D-05/D-07). FIRST repair the CAS-token discipline the research assumed but PATTERNS.md falsified (add last_modified_at to the four read-merge-write UPDATE sites; exclude the two node-birth sites with rationale; make the discipline floor a hard gate). THEN build `reconcile-guard.cjs::checkLostUpdate` and wire it into promoteNodeStatus + persistAbstractionLevel (and thread readVersion through the delegating supersede), gated behind the presence fast-path. FINALLY map a detected conflict onto the shipped F.9 gate via a thin adapter whose only reconcile-specific branch is the APPROVE re-apply.

Purpose: two sessions in one room can no longer silently clobber each other; a real conflict surfaces an explicit per-item APPROVE/REJECT/DEFER decision, and DEFER keeps both as CONTRADICTS-linked competing claims.
Output: 4 SQL repairs + 2 net-new modules + 3 chokepoint wirings + the discipline-floor flip + green reconcile + concurrency integration tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/194-per-session-room-binding/194-RESEARCH.md
@.planning/phases/194-per-session-room-binding/194-PATTERNS.md
@lib/core/navigation/transitions.cjs
@lib/core/navigation/abstraction-claim.cjs
@lib/workflow/f9-ordered-consumer.cjs
@lib/hmi/shape-f9-renderer.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Repair the CAS-token discipline at the read-merge-write UPDATE sites + flip the floor (PSB-08 pre-req)</name>
  <read_first>
    - 194-PATTERNS.md "CRITICAL FINDING" table (the 7-site inventory: which bump, which do not, the two to allowlist) - READ THIS FIRST.
    - lib/core/navigation/abstraction-claim.cjs:126 `UPDATE nodes SET properties = ?, last_seen_at = ? WHERE id = ?` (sets last_seen_at only - the classic lost-update shape; add last_modified_at).
    - lib/core/breakthrough/verb-dispatch.cjs:200 and lib/core/breakthrough/scanner.cjs:418 (both `UPDATE nodes SET properties = ?, last_seen_at = ? WHERE id = ?`, best-effort merges; add last_modified_at).
    - scripts/check-pending-ambiguous.cjs:151 `UPDATE nodes SET properties = ? WHERE id = ?` (add last_modified_at).
    - lib/core/navigation/typed-domain.cjs:149 and lib/core/navigation/room-birth.cjs:278 (blind review_status='confirmed' node-birth confirms - EXCLUDE; document rationale).
    - lib/core/navigation/transitions.cjs:150-165 (the write-discipline comment the repairs must match: every content write bumps last_modified_at; a read never does).
    - tests/test-194-lastmod-discipline.test.cjs (Wave 0; the floor to flip to a hard run).
  </read_first>
  <behavior>
    - after repair: abstraction-claim, verb-dispatch, scanner, check-pending each SET last_modified_at in their UPDATE
    - two concurrent persistAbstractionLevel calls now move the token (the guard in Task 2 can see drift)
    - typed-domain + room-birth remain unchanged and are named in the floor allowlist with a rationale comment
    - test-194-lastmod-discipline runs as a hard gate and passes
  </behavior>
  <action>Add `last_modified_at = ?` (bound to the same now value already used, e.g. Date.now()) to the four read-merge-write UPDATE statements: abstraction-claim.cjs:126, verb-dispatch.cjs:200, scanner.cjs:418, check-pending-ambiguous.cjs:151. Keep last_seen_at where present (do not remove it - the two stamps mean different things). Do NOT touch typed-domain.cjs:149 or room-birth.cjs:278; instead add a one-line rationale comment at each ("node-birth bookkeeping: a co-session cannot hold a readVersion of a node being born, so the CAS token bump is intentionally omitted; allowlisted in test-194-lastmod-discipline"). Fill in test-194-lastmod-discipline.test.cjs to assert every properties/review_status UPDATE under lib/core/navigation/ + abstraction-claim.cjs + the two breakthrough sites bumps last_modified_at, with an explicit allowlist naming typed-domain.cjs and room-birth.cjs. Flip that leg in run-all-194.sh from run_if to a hard run (its Wave-4 sentinel is now satisfied). NO em-dashes.</action>
  <verify>
    <automated>node tests/test-194-lastmod-discipline.test.cjs</automated>
  </verify>
  <done>The four read-merge-write sites bump last_modified_at; the two node-birth sites carry the rationale + allowlist; test-194-lastmod-discipline passes as a hard gate.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: reconcile-guard.cjs + wire the CAS check behind the presence fast-path (PSB-08, PSB-09, PSB-12)</name>
  <read_first>
    - lib/core/navigation/transitions.cjs:131-133 the state_mismatch coarse optimistic check (the SAME seam; insert the finer last_modified_at check right after, before `db.exec('BEGIN')` at :148) and :156/160/163 (the three write branches that already bump last_modified_at - do NOT touch them).
    - lib/core/navigation/abstraction-claim.cjs:100-127 (the read-merge-write to guard; now repaired in Task 1).
    - lib/core/temporal/supersession.cjs:93-101 (`supersede` delegates to promoteNodeStatus - thread a readVersion through the options bag it passes at :100; it runs NO own UPDATE, so no separate guard).
    - lib/core/session-presence.cjs listLiveCoSessions (Wave 1; the fast-path gate).
    - lib/core/navigation.cjs (the re-export barrel; additive-re-export precedent logMemoryEvent/writeEdge/getRoomContext - optionally re-export checkLostUpdate for the adapter).
    - 194-PATTERNS.md "reconcile-guard.cjs" (Pitfall 1 NULL handling; append-safe by construction) + 194-RESEARCH.md Target 1 "Where the check inserts".
  </read_first>
  <behavior>
    - checkLostUpdate: current > readVersion -> {conflict:true, currentVersion}
    - current == readVersion -> {conflict:false}
    - readVersion == null OR current == null -> {conflict:false} (legacy/append safe; NEVER reconcile NULL-vs-NULL)
    - caller passes no readVersion -> guard is a no-op (byte-identical to today)
    - fast-path: listLiveCoSessions empty -> guard never runs (single-session zero-cost)
    - fast-path: a live co-session present -> guard arms and can detect drift
    - a live co-session's presence `updated` is heartbeated on each chokepoint write
  </behavior>
  <action>Create lib/core/navigation/reconcile-guard.cjs exporting checkLostUpdate(db, nodeId, readVersion): SELECT last_modified_at FROM nodes WHERE id=?; apply the NULL/no-readVersion no-conflict rules; return {conflict, currentVersion}. In transitions.cjs promoteNodeStatus, right after the :131-133 state_mismatch check and BEFORE `db.exec('BEGIN')`, insert: if options.readVersion is supplied AND session-presence.listLiveCoSessions(roomDir, mySid) is non-empty, call checkLostUpdate; on conflict return {ok:false, reason:'lost_update', reconcile:{nodeId, held:toStatus, currentVersion}} without overwriting. In abstraction-claim.persistAbstractionLevel, insert the same guarded check before its (now-repaired) UPDATE. In supersession.supersede, thread options.readVersion through the promoteNodeStatus call at :100 (no own guard). Heartbeat session-presence on each successful chokepoint write. Optionally additively re-export checkLostUpdate from navigation.cjs (following the documented precedent) for the Task-3 adapter. Everything additive: no readVersion -> no behavior change. Wrap guard failures to degrade to the normal write (fail-open). NO em-dashes.</action>
  <verify>
    <automated>node tests/test-reconcile-guard.test.cjs && node tests/test-presence-fast-path.test.cjs</automated>
  </verify>
  <done>test-reconcile-guard.test.cjs passes (drift->conflict, equal->pass, NULL->no-claim, append->no-op); the guard arms only behind a live co-session; supersede threads readVersion; no untouched write branch changed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: reconcile-f9-adapter.cjs - RECONCILE -> F.9 (APPROVE re-apply / REJECT / DEFER) + async default + integration (PSB-10)</name>
  <read_first>
    - lib/workflow/f9-ordered-consumer.cjs:103-118 `makeDefaultGraphAdapter` (writeEdge=APPROVE 108-110, recordRejection=NOT_APPLIED 112-113, leaveContradictsPair=CONTRADICTS 116-117) and :132-147 `consumeF9Ordered` (walks items IN ORDER); :55 verbs frozen `['APPROVE','REJECT','DEFER']`, :59 DEFER->CONTRADICTS constant.
    - lib/hmi/shape-f9-renderer.cjs:107 renderShapeF9 (items = [{item_id, claim}]; PAGE_CEILING=4 at :66; array order IS meaning).
    - lib/core/navigation/reconcile-guard.cjs checkLostUpdate (Task 2; the conflict payload the adapter consumes).
    - 194-RESEARCH.md Target 4 (the outcome->write table; APPROVE is the ONLY reconcile-specific branch) + Pitfall 4 / Open Question 1 (async/no-turn context -> default DEFER + surface next interactive turn; NOT a D-07 violation - D-07 governs the interactive case).
  </read_first>
  <behavior>
    - a conflict payload renders an F.9 item {item_id:nodeId, claim:"<summary> - Session X changed this while you held it"}
    - APPROVE -> re-runs the held node UPDATE ("yours wins"), stamping a fresh last_modified_at, node stays proposed
    - REJECT -> records NOT_APPLIED + reason (theirs wins)
    - DEFER -> leaves a CONTRADICTS pair (both claims survive)
    - non-interactive/async context (no live turn) -> auto-DEFER (CONTRADICTS) and queue the pending reconcile for the next interactive turn
    - end-to-end: two sessions, a real lost-update on the same node -> exactly one RECONCILE, resolvable each of the three ways
  </behavior>
  <action>Create lib/workflow/reconcile-f9-adapter.cjs exporting reconcileViaF9({conflict, held, db, roomDir, interactive}). Build the F.9 items from the conflict payload; render via renderShapeF9; drive consumeF9Ordered with a reconcile-specific roomState.graph adapter that MIRRORS makeDefaultGraphAdapter for REJECT (NOT_APPLIED) and DEFER (CONTRADICTS - already the shipped mapping) but OVERRIDES the APPROVE branch to RE-RUN the held node UPDATE via the chokepoint (re-apply "yours wins", fresh last_modified_at, proposed status). When `interactive` is false (async/background writer with no navigator turn), skip the render and default to DEFER (leave the CONTRADICTS pair, never lose data) and record the pending reconcile so the next interactive turn surfaces it - document this is the Open-Q1 resolution, not a D-07 violation. Fill in test-reconcile-f9-adapter.test.cjs (the three outcomes + async default) and test-194-concurrency-integration.test.cjs (two-session lost-update -> reconcile end-to-end). Reconciled edges land proposed (Part 9). Fail-open on adapter error. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-reconcile-f9-adapter.test.cjs && node tests/test-194-concurrency-integration.test.cjs</automated>
  </verify>
  <done>Both tests pass: APPROVE re-applies, REJECT NOT_APPLIED, DEFER CONTRADICTS, async defaults to DEFER; the two-session integration produces exactly one resolvable RECONCILE.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| concurrent session B's node write -> session A's held write | two sessions mutating the same node row cross here |
| async/background writer -> F.9 gate | a writer with no live navigator turn crosses into the reconcile path |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-194-14 | Tampering | a future unguarded content UPDATE loses an update invisibly | mitigate | Task 1 repairs the four read-merge-write sites + the discipline floor blocks any new un-allowlisted UPDATE missing last_modified_at |
| T-194-15 | Repudiation | a silent clobber loses which claim won | mitigate | DEFER keeps both as a CONTRADICTS pair (rejection-is-data, Decision 13); REJECT records NOT_APPLIED + reason |
| T-194-16 | Denial of service | the guard arms on every write and thrashes | mitigate | presence fast-path: guard arms only behind a live co-session; single-session pays zero cost |
| T-194-17 | Denial of service | an async writer blocks waiting for an F.9 answer that never comes | mitigate | non-interactive context auto-DEFERs (never lose data) and queues for the next interactive turn (Open Q1) |
| T-194-18 | Tampering | direct room.db write bypasses the guard | accept | the Part 9 substrate fence already forbids direct room.db opens outside the chokepoint; the guard rides that existing fence |
| T-194-SC | Tampering | npm installs | accept | zero external packages this phase |
</threat_model>

<verification>
- `node tests/test-194-lastmod-discipline.test.cjs && node tests/test-reconcile-guard.test.cjs && node tests/test-reconcile-f9-adapter.test.cjs && node tests/test-194-concurrency-integration.test.cjs` all pass.
- `node tests/test-194-local-only.test.cjs` green (reconcile-guard + adapter carry zero Brain/network token).
- `node scripts/check-render-coverage.cjs --check` green (F.9 stays covered; no new shape).
- `bash tests/run-all-194.sh` shows the lastmod-discipline floor now a hard RUN and green, plus all reconcile legs PASSED.
</verification>

<success_criteria>
- The CAS token moves on every content mutation; the guard arms only behind a live co-session; a real lost-update surfaces an F.9 reconcile with the three frozen outcomes; async writers never lose data.
</success_criteria>

## Artifacts this phase produces (this plan)
- `lib/core/navigation/reconcile-guard.cjs` (checkLostUpdate CAS helper)
- `lib/workflow/reconcile-f9-adapter.cjs` (RECONCILE -> F.9; APPROVE re-apply, REJECT, DEFER->CONTRADICTS; async DEFER default)
- SQL repairs bumping last_modified_at at abstraction-claim.cjs:126, verb-dispatch.cjs:200, scanner.cjs:418, check-pending-ambiguous.cjs:151
- documented exclusions at typed-domain.cjs:149, room-birth.cjs:278 (node-birth rationale)
- guard wiring in transitions.cjs (promoteNodeStatus) + abstraction-claim.cjs (persistAbstractionLevel) + readVersion threaded through supersession.cjs
- optional additive re-export of checkLostUpdate from navigation.cjs
- the flipped `tests/test-194-lastmod-discipline.test.cjs` hard-gate

<output>
Create `.planning/phases/194-per-session-room-binding/194-06-SUMMARY.md` when done
</output>
