# Phase 238: Decision Gates - Research

**Researched:** 2026-07-28
**Domain:** In-process gate ledgers (mint/ratify), multi-process file-counter concurrency, and structured-output-vs-prose classification in a Stop hook
**Confidence:** HIGH on the three defect diagnoses (all three reproduced live in this session against real repo code); MEDIUM on the recommended GATE-04 remedy shape (the corpus is provable, the discriminator design has a genuine open question).

---

## Summary

All three of this phase's requirements name real, currently-live defects, and this research reproduced each one against the shipped code rather than inferring it from source reading. GATE-01 is two ledgers that were never joined: `chain_run` mints a halt gate into `lib/mcp/tools/chain.cjs`'s `_resumeLedger`, and the `gate_answer` MCP tool consumes from a completely separate `Map` in `lib/mcp/tools/gate.cjs`, so the documented resume flow (`chain_run` -> `gate_answer` -> `chain_run`) fails at step two with `unknown_or_expired_gate`. Alongside it, `gate_answer` never checks the submitted `chosen` against the card it minted, so an arbitrary string ratifies and writes a `memory_event`. GATE-03's torn-write is worse than "torn": 20 parallel processes each doing 10 increments against `~/.mindrian/card-fire-retries.json` produced a final count of **3 instead of 200** (197 lost updates), because `writeRetryStore` is a non-atomic read-modify-write with no fence, and TWO production processes (the Stop hook and the MCP daemon) drive that same file.

GATE-04 is the one where the ROADMAP's own framing does not survive contact with the evidence, and the planner needs to know this before writing plans. This session's logged over-enforcement instances are NOT backstop fires. All 38 records in the live `~/.mindrian/card-fire-intercepts.log` (9 distinct sessions) carry `reached-registry-gate-no-card`, the PRIMARY arm; running the shipped `computeBackstopHit` over every one of their `output_text` values returns `false` 38 times out of 38. The repo's own knowledge-base already reached this conclusion ("the BACKSTOP arm is fully exonerated for every one of them"). However, the backstop DOES carry a genuine latent citation/footnote false positive that nobody has logged yet because Larry's prose rarely uses that shape: the shipped pattern fires on inline academic citations, footnote reference lists, markdown reference-link definitions, and array indexing in code prose (5 of 6 synthetic false-positive fixtures fire today). GATE-04 is therefore a real defect worth fixing, but its corpus has to be built from two sources, and the plan must say honestly which fixtures come from live telemetry and which are authored.

**Primary recommendation:** Sequence Phase 238 AFTER Phase 237 executes (they share `lib/mcp/tools/chain.cjs` and `tests/test-198-chain-run-halt.test.cjs`), collapse the two gate ledgers into ONE session-keyed ledger module fenced by `lib/core/write-lock.cjs`'s proven `openSync('wx')` primitive with a bounded wait, and build the GATE-04 fixture corpus as two clearly-labeled halves (real logged prose that must stay silent + authored citation prose that provably fires today) with a genuine bracket-box control that must still fire red.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gate minting / ratification ledger | MCP server process (`lib/mcp/`) | - | The ledger's whole purpose is anti-spoofing within one server process; moving it to disk would widen the trust boundary. Session key belongs here. |
| `chosen`-against-options validation | MCP tool layer (`lib/mcp/tools/gate.cjs`, `chain.cjs`) | `lib/mcp/gate-render.cjs` (shared normalizer) | The minted card lives in the ledger entry; the tool layer is the only place that holds both the card and the answer at once. |
| Retry / session counters | Local filesystem (`~/.mindrian/card-fire-retries.json`) | Two writer processes: Stop hook + MCP daemon | Must survive process death, so it cannot be in-memory. Cross-process is why it needs an OS-level fence, not a JS lock. |
| Card-fire classification (backstop) | Stop hook script (`scripts/check-card-fire.cjs`) | `lib/mcp/stop-gate-handler.cjs` wraps the SAME predicate | Part 7: one predicate, two call sites. Any GATE-04 fix lands in the predicate and both paths inherit it. |
| Fixture corpus | Committed test data (`tests/fixtures/`) | - | Must be in git so tuning cannot silently regress; must be sanitized because the raw source is live user conversation. |

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | Answering a chain's halt gate resolves through the same ledger that minted it (G-1); `gate_answer` validates `chosen` against the card's actual options before ratifying (G-2). | Both halves reproduced live (Findings 1 and 2 below). Exact edit sites named: `lib/mcp/tools/chain.cjs:215-228` (`_resumeLedger`), `lib/mcp/tools/gate.cjs:76-89` (`_liveGates`), `lib/mcp/tools/gate.cjs:192` (missing validation), `lib/mcp/tools/chain.cjs:379` (chain path ignores `chosen` entirely). Seam-liveness helper wrapper `checkMintRatifierLiveness` already exists and was written FOR this phase. |
| GATE-03 | Gate minting and consumption are session-scoped; the retry-counter file write is atomic (no torn writes) (G-3). | Session-scoping gap confirmed by source (neither ledger checks a session id on consume). Lost-update measured live: 197/200 increments lost across 20 processes. Phase 87-02 fence located at `lib/core/write-lock.cjs`; its 20-fork test harness at `lib/memory/write-lock-atomic.test.cjs` + `.worker.cjs`. Critical caveat on the fence's throw-not-wait semantics documented under Pitfall 2. |
| GATE-04 | `check-card-fire.cjs`'s backstop pattern stops matching ordinary citation/footnote markers in prose (G-4), informed by this session's own logged over-fire instances. | The premise correction (logged instances are PRIMARY-arm, not backstop) is measured, not asserted: 38/38 log records return `computeBackstopHit === false`. The genuine latent false-positive class is measured too: 5 of 6 authored FP fixtures fire on the shipped pattern today. Corpus sources, sanitization constraint, and two candidate patterns with measured FP/FN counts are all below. |

---

## User Constraints (no CONTEXT.md exists for this phase)

This phase has no `238-CONTEXT.md`. Per the orchestrator's brief, `ROADMAP.md`'s Phase 238 block IS the locked context. Copied verbatim:

### Locked Decisions (ROADMAP.md, Phase 238)

> **Goal**: Decision Gates keep their word end to end: a gate resolves through the same ledger that minted it, ratification validates the answer against the card, concurrent sessions cannot cross-consume, and the card-fire backstop stops punishing ordinary prose.
> **Depends on**: Phase 235 (shared seam-liveness helper proves the mint-to-ratifier seam live)
> **Requirements**: GATE-01, GATE-03, GATE-04
> **Success Criteria** (what must be TRUE):
>
>   1. Answering a chain's halt gate end-to-end resolves through the SAME ledger entry that minted it (mint id equals ratified id, asserted on a real chain run), and a `gate_answer` whose `chosen` is not among the card's actual options is rejected before ratification; bypassing the options validation turns the gate red.
>   2. Two concurrent sessions minting and answering gates never consume each other's cards (two-process fence), and the retry-counter file survives N parallel writers with no torn write (atomic-write fence on the proven Phase 87-02 concurrency-fence pattern).
>   3. `check-card-fire.cjs` run over a committed fixture corpus built from this session's eight logged over-enforcement instances (citation/footnote markers in prose) produces ZERO false fires, while a genuine unrendered-card fixture still fires red -- the corpus pins the tuning so it cannot silently regress in either direction.

### Cross-Cutting Research Rules (ROADMAP.md, binds every phase)

> - **langtalks-graph-expert (MANDATORY, per CLAUDE.md standing rule):** every phase touching agent/LLM engineering concepts (dispatch, memory, RAG, reasoning, guardrails, MCP protocol) consults `mcp__langtalks-graph-expert__*` during planning and research. Applies directly to Phases 235, 237, 238, 241.
> - **Claude Code / Claude API expertise:** phases touching hooks (`hooks/hooks.json`, `PreToolUse`/`PostToolUse`/`Stop` matchers), MCP tool registration, or subagent/agent-registry behavior consult the `claude-api` skill and the `claude-code-guide` agent before changing matcher patterns or registry logic. Applies directly to Phases 235, 237, 238, 239.

### Claude's Discretion

Everything not named in the three Success Criteria: module layout for a unified ledger, the exact fence idiom, the fixture corpus file format, test file naming.

### Deferred Ideas (OUT OF SCOPE)

- GATE-02 does not exist as a REQ-ID (audit finding G-2 folds into GATE-01 by design, per REQUIREMENTS.md line 71).
- Phase 236's territory: `lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`, `tests/test-236-*`, `.planning/phases/236-room-db-data-loss-fixes/`. Zero reads, zero writes. Honored by this research: no file under any of those paths was opened.
- The v1.17.0 "MCP-First" structural resolver collapse (`isMcpFirst` / `resolveWriteRoom` / the eight-copy room-resolution ladder). Both `gate.cjs` and `chain.cjs` carry a copy of `resolveSessionRoomDir`; Phase 238 must NOT consolidate them.

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that bind every plan in this phase:

| Directive | Source | Impact on Phase 238 |
|-----------|--------|---------------------|
| **CJS only, no TypeScript**; `lib/core/*.cjs` ships as source | Conventions | Any new ledger module is `.cjs`, no build step. |
| **No em-dashes anywhere; hyphens only** | Conventions | Applies to every file, every comment, every fixture. |
| **Canon Part 7 (Reuse Before Build)** | Canon Core | Do NOT mint a third ledger or a second counter store. `write-lock.cjs`, `seam-liveness.cjs`, `gate-dedup.cjs`, `card-fire-sidechannel.cjs::writeStoreAtomic` all already exist and are the reuse targets. |
| **Canon Part 8 (Graph Boundary, LOCAL->BRAIN: NO)** | Canon Core | The fixture corpus is derived from a live conversation log containing real venture content. It MUST be sanitized before commit. Zero Brain requires, zero network in any new module. |
| **Canon Part 11 (born-wired + declared HITL shape)** | Canon Core | Any new MCP surface needs a `connectors` export with `hitl_shape`/`hitl_why`. `gate_render`/`gate_answer`/`chain_run` already declare `F.1`. A new internal `lib/` module is not an invocable surface and needs no declaration. |
| **Tri-Polar Design Rule** | Design rule | The two-process fence must work on CLI (hook process + daemon), Desktop, and Cowork (multi-user, genuinely concurrent). A skip on any surface is a stated call, not an oversight. |
| **No real names/emails of testers/advisors in tracked repos** | Personal memory HARD RULE (`feedback_no_real_names_in_repo.md`) | Directly binds the GATE-04 fixture corpus. The live log contains real conversation content. |
| **Consult ALL relevant grounding sources** | CLAUDE.md standing rule | See Grounding Consultations section below. |
| **GSD workflow enforcement** | CLAUDE.md | Edits go through `/gsd-execute-phase`, not direct. |
| **Phase tests:** `bash tests/run-all-<phase>.sh` | Verification | Phase 238 needs `tests/run-all-238.sh` on the `run_if` pattern of `tests/run-all-209.sh`. |
| **RCA discipline:** `.planning/debug/<slug>.md`, resolve to `resolved/`, summary block into `knowledge-base.md` | QA and RCA Reporting | The open `card-fire-stale-f1-reach-suggestion-*.md` RCA should be resolved or explicitly re-scoped by this phase, not left dangling. |
| **Dev-Research Compositing** | CLAUDE.md | Findings mirror to `~/MindrianRooms/rethinking-mindrianos/research/`. NOTE: Phase 243's executor found this write REFUSED under worktree isolation. Expect the same; state it plainly rather than claiming it done. |

**Project skills present:** `.claude/skills/agentshield/SKILL.md` (plugin self-scan over MCP tool descriptions, hooks, skills, CLAUDE.md permissions, package.json deps). Relevant only as a reminder that MCP tool DESCRIPTIONS are a scanned surface: `chain_run`'s description currently documents a flow that does not work (see Finding 1), so fixing the code without fixing the description leaves a lying description in a scanned surface.

---

## Blocking Environment Finding: this worktree is STALE

**Read this before planning.** This research ran in worktree `agent-ae951ff4e78dd72b2`, whose `HEAD` is `464b9c15` and whose object database does NOT contain the parent checkout's newest commits. `git log -1 dde3f89f9` returns `unknown revision`. The missing commits include exactly the ones that log this phase's own raw material:

- `2d4aa8ce9` (Monday class check-in filing)
- `245621d59` (room_bind/rooms-open root cause)
- `dde3f89f9` "docs: log sixth, seventh, and eighth check-card-fire.cjs instances"
- `5eea35170` "docs: log fourth and fifth check-card-fire.cjs over-enforcement instances"
- `995d459aa` (BlockNote research trail)

`.planning/config.json` sets `workflow.use_worktrees: false`, so this isolation is unexpected. Phase 237's research hit the identical problem and fixed it with `git merge --ff-only main` before starting.

**Recommended first action for the planner or executor:** fast-forward this worktree (or plan from the primary checkout) BEFORE writing plans, then re-run the instance census. This research's own instance count is therefore reported as a floor, not a total. [VERIFIED: `git log -1 dde3f89f9` in this worktree]

**What is NOT affected:** `.planning/debug/` is gitignored and present on disk with current mtimes (2026-07-28 20:43-20:46), so the RCA prose and `knowledge-base.md` ARE current here. The live telemetry at `~/.mindrian/card-fire-intercepts.log` is outside git entirely and is fully current. The three defect reproductions below all ran against code that is byte-identical in this worktree and in the parent (the last commit touching `check-card-fire.cjs` is `5431b7e9`, well before the divergence).

---

## Blocking Sequencing Finding: Phase 238 collides with Phase 237

ROADMAP declares Phase 238's only dependency as Phase 235. That is incomplete. Phase 237 is **PLANNED but NOT EXECUTED**, and its 8 plans' `files_modified` include:

- `lib/mcp/tools/chain.cjs` (plans 237-02 and 237-08) - Phase 238's GATE-01 primary edit site
- `tests/test-198-chain-run-halt.test.cjs` (237-02) - the existing halt regression Phase 238 must extend
- `lib/core/chain-executor.cjs` (237-07/08)

237-02 deletes `chain.cjs`'s local `postureForCommand` block (lines 128-180) and its `postureFn` default (line 294); 237-08 deletes `makeDefaultOnStep` and wires a new dispatcher as `chain_run`'s `onStep`. Both land in the same 500-line file Phase 238 needs to restructure the resume ledger inside.

**Recommendation:** execute Phase 237 first, then plan/execute 238 against the post-237 `chain.cjs`. If the navigator wants them parallel, Phase 238's chain-side work must be fenced to the ledger block (lines 207-228 and 365-418) with an explicit `git diff` criterion proving zero touches to `postureForCommand`, `_loadPostureIndex`, `makeDefaultOnStep`, or the `postureFn` default. Parallel is possible but strictly worse. [VERIFIED: grep of `files_modified` across `.planning/phases/237-reach-mechanism/237-0*-PLAN.md`]

---

## Finding 1 (GATE-01, G-1): two ledgers, never joined. REPRODUCED.

**The claim, proven live.** Driving the real `chainRun` with a halting material step and then asking `gate.cjs` to consume the minted id:

```
chain_run halted: true   gate_id: gate-61809f43825e211d
chain resume ledger has it:  true
gate.cjs _liveGates has it:  false
gate_answer would consume it: null
```

[VERIFIED: live execution of `lib/mcp/tools/chain.cjs::chainRun` + `lib/mcp/tools/gate.cjs::_internal._consumeLiveGate` in this session]

**Why it happens.** Two independent `Map`s were minted by the same phase (198) under the same anti-spoofing doctrine (T-198-10 / T-198-12), each with its own 30-minute TTL and its own single-use consume, and the disjoint-file tool-module contract ("tool modules never require each other", `lib/mcp/register-core-tools.cjs`) is the stated reason they were kept separate:

- `lib/mcp/tools/gate.cjs:76-89` - `_liveGates`, minted by `gate_render`, consumed by `gate_answer`.
- `lib/mcp/tools/chain.cjs:215-228` - `_resumeLedger`, minted by `chainRun`'s halt branch, consumed by `_resumeFromGateAnswer`.

Both call the SAME `gateRender.renderGate`, which mints the `gate_id` inside `normalizeCard` (`'gate-' + crypto.randomBytes(8).toString('hex')`). So the id is common; only the ledgers are not.

**The user-visible break.** `chain_run`'s own tool description reads: *"To resume, call chain_run AGAIN with the gate_answer payload a prior gate_answer tool call returned."* A navigator following that literally calls `gate_answer` with `chain_run`'s `gate_id`, gets `{ ok:false, reason:'unknown_or_expired_gate' }`, and has no documented recovery. The only working path is to hand-construct the `{gate_id, chosen, verdict}` object and thread it straight back into `chain_run`, which no description tells you to do. The seam is dead exactly as `seam-liveness.cjs`'s dead-seam shape #3 describes it: *"a gate type gets minted but no ratifier can consume it, so the gate is raised and nothing on the other side can ever clear it."*

**Note on the existing test.** `tests/test-198-chain-run-halt.test.cjs` exists and presumably passes, because it exercises `chainRun(null, {gateAnswer})` directly and never crosses to `gate_answer`. This is the classic "a test honoring a contract satisfies a production-wiring gate vacuously" shape the milestone's Overview warns about. The Phase 238 test must drive `gate_answer`'s registered tool handler, not `chainRun`'s internal resume.

**Where the fix goes.** Two viable shapes, both Part-7 clean:

1. **One shared ledger module** (`lib/core/gate-ledger.cjs` or `lib/mcp/gate-ledger.cjs`), required by both tool modules. This does NOT violate the disjoint-file contract, which forbids tool modules requiring EACH OTHER; both already require `../gate-render.cjs`, one directory up, and the header comment explicitly blesses that ("gate-render.cjs is NOT a lib/mcp/tools/*.cjs module, so requiring it here mirrors gate.cjs's own require -- not a tools/tools collision"). This is the recommended shape.
2. Keep two Maps and have `gate_answer` fall through to the chain ledger. Rejected: it re-creates the two-authority problem Phase 237 is deleting elsewhere in the same milestone, and it doubles the surface a session key must be applied to.

**The seam-liveness wire (SC-mandated).** `lib/core/seam-liveness.cjs::checkMintRatifierLiveness(mintedGateTypes, ratifierGateTypes)` was written for this phase by name ("Phases 237/238/239 consume the other three wrappers"). Wiring it here means enumerating the gate kinds minted (`general`, `binding`, plus `chain_run`'s material-step card) against the kinds a ratifier can consume, and proving a mutation (renaming one mint kind) turns it red. Note the helper's vacuous-truth property: **zero claims is `ok:true`**. A wiring that passes an empty array reads green forever. The plan must carry an anti-vacuity assertion (`claimedCount > 0`).

---

## Finding 2 (GATE-01, G-2): `chosen` is never validated against the card. REPRODUCED.

```
normalizeGateAnswer output: {"gate_id":"gate-fa26a66d09f4309b","chosen":["totally-made-up-option"],"verdict":"approve"}
card option ids: approve,reject
=> chosen NOT validated against options: true
```

[VERIFIED: live execution of `lib/mcp/gate-render.cjs::normalizeGateAnswer`]

**Source trace.** `gate_answer`'s zod schema is `chosen: z.array(z.string().min(1)).min(1)` - shape only. `normalizeGateAnswer` (`gate-render.cjs:139-145`) does `chosen: Array.isArray(chosenIds) ? chosenIds.slice() : []`, a verbatim copy. `gate.cjs:188-207` then writes a `memory_event` with `chosen: answer.chosen` and returns `ratified: true`. The card IS available at that exact moment: `_consumeLiveGate` returns `{ card, mintedAt }` and `live.card.options` holds the legitimate id set. The validation data is in hand and unused.

**Second, worse instance on the chain path.** `_resumeFromGateAnswer` (`chain.cjs:370-418`) reads only `ga.gate_id` and `ga.verdict`. It never reads `ga.chosen` at all. So on the chain path, `chosen` is not merely unvalidated, it is entirely ignored: `{verdict:'approve', chosen:['anything']}` executes the halted material step. Both call sites need the same check, and per Part 7 the check itself should live once, next to the ledger.

**Contrast that proves the fix is cheap.** `gate-render.cjs::_resolveChosenIds` (lines 243-254) ALREADY does exactly this validation for the AskUserQuestion rung: it builds `byId`/`byLabel` sets from `card.options` and drops anything not in them, returning `null` when nothing survives. The ratification path just never got the same treatment. Lifting that logic into a shared `validateChosenAgainstCard(card, chosen)` is the smallest correct change.

**Mutation gate for SC1.** "Bypassing the options validation turns the gate red" is satisfiable by commenting out the validation call and re-running the phase suite, per the Phase 241/242/243 demonstrated-RED-then-revert precedent. The reject must happen BEFORE any `navigation.logMemoryEvent` write, and the test should assert the absence of the row, not just the error shape.

---

## Finding 3 (GATE-03, half A): neither ledger is session-scoped. CONFIRMED FROM SOURCE.

- `gate.cjs::_mintLiveGate(gateId, card)` stores `{card, mintedAt}`. No session id is recorded at all, even though `register`'s handler computed one via `resolveEffectiveSessionId(undefined, extra)` two lines earlier.
- `gate.cjs::_consumeLiveGate(gateId)` takes only the id. Any caller with the id consumes it.
- `chain.cjs::_mintResumeLedger` DOES store `sessionId: o.sessionId` in the entry, and `_consumeResumeLedger(gateId)` never reads it back. The field exists and is inert.

**The concrete cross-consume.** The resume ledger entry carries `roomDir` and `onStepFn` bound to the MINTING session. If session B answers session A's `gate_id`, `_resumeFromGateAnswer` executes A's halted material step, in A's room, with A's callbacks. That is the "consume each other's cards" failure exactly.

**Honest scoping of the risk.** `gate_id` is `crypto.randomBytes(8)`, so blind guessing is not the threat. The realistic vectors are (a) Cowork, where one server process genuinely serves multiple users, (b) a Streamable-HTTP server instance shared across sessions, and (c) a replay of a `gate_id` that leaked into a transcript, a log, or a shared `.planning/` artifact. Under stdio, one process is one session and the practical exposure is low. The plan should state this rather than overselling the severity: the fix is cheap and correct regardless, and SC2 requires the two-process fence proof either way.

**Where the session id comes from.** `lib/core/session-binding.cjs::resolveEffectiveSessionId(explicit, extra)` returns `explicitSessionId || extra.sessionId || process.env.CLAUDE_CODE_SESSION_ID || null`. Note it can return `null`. A `null`-session mint must NOT become a wildcard that anyone can consume; the safe degrade is a per-process sentinel that only that process's own `null`-session calls match. `card-fire-sidechannel.cjs`'s `NO_SESSION_KEY` bucket is the in-repo precedent for naming this case explicitly, and its own documented cross-session bleed (fix A, `scopedRecords`) is the precedent for why the sentinel must be time-scoped or process-scoped rather than global.

---

## Finding 4 (GATE-03, half B): the retry counter loses 197 of 200 increments. MEASURED.

**The measurement.** 20 forked processes, each calling `bumpRetryCount('k1')` 10 times, against an isolated `MINDRIAN_HOME`:

```
expected count: 200
actual count:   {"k1":{"count":3,"ts":1785261355543}}
lost updates:   197
```

[VERIFIED: live 20-process fork test in this session against `scripts/check-card-fire.cjs`'s real exported accessors]

**Root cause, stated before the patch.** `writeRetryStore` (`check-card-fire.cjs:798-807`) is a plain `fs.writeFileSync` of a store that `bumpRetryCount` (lines 815-823) read a moment earlier. Read-modify-write with no fence, no compare-and-swap, no lock. Every concurrent writer reads the same pre-state and the last writer wins. The file also gets fully rewritten (with a TTL prune) on every single bump, so a writer does not just lose its own increment, it discards every increment that landed between its read and its write.

**Why this matters more than "torn write" suggests, and the causal link to GATE-04.** These counters ARE the bounded escape. `MAX_FORCE_RETRIES = 3` and `MAX_SESSION_INTERCEPTS = 12` are compared against exactly these values. If concurrent Stop evaluations shred the count, the ceilings become effectively unreachable and the force-loop never releases. That is precisely the live symptom the open RCA reports: *"The Stop hook force-blocked at least four consecutive turns"*, and the audit's *"ten false fires in four sessions"*. This session's own machine has been running many concurrent Claude Code sessions (the SESSION OWNERSHIP LOCK exists because two were driving the same milestone at once), and the live intercept log shows 9 distinct `session_id`s.

**This should be stated in the plan as a hypothesis with a named test, not as a settled cause.** The honest form: GATE-03's lost-update defect is a plausible amplifier of GATE-04's observed over-enforcement, and a plan can prove or disprove it by measuring the force-loop's convergence under N concurrent Stop evaluations before and after the fence.

**The concurrency is production-real, not synthetic.** Two separate processes drive that same file today:
- `scripts/check-card-fire.cjs::main()` lines 1438-1439 (read) and 1467-1468 / 1454-1455 / 1476-1477 (bump and clear), running in the per-turn Stop hook process.
- `lib/mcp/stop-gate-handler.cjs::handleStopEvent` lines ~484-485 and the `!material` branch, running in the MCP daemon, deliberately wired to the SAME accessors by `mcp-first-path-retry-ceiling-hardcoded-zero` so "the two enforcement paths spend ONE shared budget rather than two divergent ones".

The RCA that wired them shared a budget did not notice the budget cannot survive being shared.

**The Phase 87-02 pattern, and the trap in reusing it naively.** `lib/core/write-lock.cjs::acquireLock(roomDir)` is the proven fence: `fs.openSync(lockPath, 'wx')` as the create-if-not-exists primitive, with stale-lock cleanup (5s), dead-PID reaping, and a same-PID refresh carve-out. Its header states the TOCTOU race it closed. Its test harness is `lib/memory/write-lock-atomic.test.cjs` (20 forked children via `child_process.fork`, "true OS-level concurrency, not mocked parallel promises inside one event loop") plus `write-lock-atomic.worker.cjs`. That is the exact SC2 harness shape.

**The trap:** `acquireLock` THROWS when a live PID holds the lock. It does not wait. Dropping it around `bumpRetryCount` unchanged would make 19 of 20 writers throw and, under the existing swallow-everything try/catch, silently drop their increment. The count would go from 3 to maybe 1. The fix needs one of:

- a bounded spin/retry around acquire (short sleep, capped attempts) so contenders wait rather than die,
- or a lock-free append-only counter (each bump appends a line; readers sum) which sidesteps the read-modify-write entirely,
- or `openSync(tmp,'wx')` + `renameSync` per-key with a re-read-and-merge on conflict.

Whichever is chosen, the atomic-write half (tmp + `renameSync`) is ALSO needed for the reader side, and the in-repo precedent is right next door: `lib/core/card-fire-sidechannel.cjs::writeStoreAtomic` (lines 214-227) already does prune + size-cap + `tmp-<pid>-<now>` + `renameSync`, with the explicit comment "so a crash mid-write cannot leave a concurrent reader with a torn/partial file". `check-card-fire.cjs`'s sibling store never got the same treatment. Copying that idiom is the smallest Part-7-clean atomic-write change; the lock is the separate, additional change that fixes lost updates.

**Do not conflate the two.** Atomic write (tmp+rename) fixes torn READS. It does NOT fix lost updates. SC2 names "no torn write" but the measured defect is lost updates, and a plan that ships only tmp+rename will pass a torn-read test and leave 197/200 losses intact. State both, test both.

---

## Finding 5 (GATE-04): the ROADMAP's premise needs correcting. MEASURED.

### 5a. The logged instances are NOT backstop fires

The live diagnostic sink `~/.mindrian/card-fire-intercepts.log` (47KB, 38 records, 9 distinct sessions, written by `appendInterceptLog`) breaks down as:

| Reason slug | Count |
|-------------|-------|
| `reached-registry-gate-no-card` (PRIMARY arm) | 37 |
| `bounded-escape-released-after-3-retries` (degrade) | 1 |
| `ascii-box-backstop-no-card` (BACKSTOP arm) | **0** |

Running the shipped `computeBackstopHit` over all 38 `output_text` values returns `false` **38 times out of 38**. [VERIFIED: live replay against `scripts/check-card-fire.cjs`'s exported `computeBackstopHit`]

Six records DO have a non-empty `matched_glyph_span`, but only via `ASCII_BOX_GLYPH_RE`'s alternative 4 (bare numbered prose), which feeds the retry-key signature and the diagnostic log but was RETIRED from the intercept decision by commit `5431b7e9`. Their content is exactly the benign shape: *"1. Click New Conversation... 2. Look for the skills folder"*, *"1. Right-click the Windows taskbar -> Task Manager. 2. ..."*. The repo's own knowledge-base already reached this conclusion independently: *"since `computeBackstopHit` tests `ASCII_BOX_UNCONDITIONAL_RE` (which EXCLUDES the numbered-prose arm retired by 5431b7e9), the BACKSTOP arm is fully exonerated for every one of them."*

**Implication for SC3 as written.** A corpus built ONLY from the logged instances would produce zero backstop false fires TODAY, before any fix, making the criterion vacuously satisfiable. The plan must not write that test and call it done.

### 5b. The backstop DOES carry a real latent citation/footnote false positive

The shipped pattern is:

```js
const ASCII_BOX_UNCONDITIONAL_RE =
  /\[\s*1\s*\]\s*.*\[\s*2\s*\]|type\s+1\s*,\s*2\s*,\s*or\s+3|\[\s*1\s*\][^\n]*\n[\s\S]*?\[\s*2\s*\]/i;
```

Measured against authored fixtures (`computeBackstopHit`, current HEAD):

| Fixture | Should fire | Fires today |
|---------|-------------|-------------|
| Inline academic citation: `...this pattern [1] and confirmed it again later [2] in a second review.` | no | **YES** |
| Footnote reference list: `[1] Simon 1962...\n[2] Rittel and Webber 1973.` | no | **YES** |
| Markdown reference-link defs: `[1]: https://...\n[2]: https://...` | no | **YES** |
| Array indexing in prose: `read entries[1] and compare against entries[2]` | no | **YES** |
| Benign numbered instruction list | no | no (correctly retired) |
| Code enum: `keys[1]; ... keys[2];` | no | **YES** |
| `type 1, 2, or 3` literal | yes | yes |
| Multiline bracket box gate | yes | yes |
| Same-line bracket box gate | yes | yes |
| Bulleted bracket box gate | yes | yes |

**5 of 6 false-positive fixtures fire today. 4 of 4 true positives fire.** [VERIFIED: live regex evaluation this session]

This is a genuine defect, and note the fourth row: in a DEV repo, `entries[1] ... entries[2]` in ordinary technical prose is not exotic. The reason it has not shown up in the log is that the PRIMARY arm has been firing first and the backstop arm has had almost no live exercise.

### 5c. The hard part: a footnote list and a bracket-box gate are structurally identical

Two candidate replacements, measured on the same 10-fixture set:

| Pattern | Description | Mismatches vs expected |
|---------|-------------|------------------------|
| Current | shipped `ASCII_BOX_UNCONDITIONAL_RE` | 5 |
| Candidate A | require both `[1]` and `[2]` to be line-anchored (`(?:^\|\n)[ \t>*-]{0,4}`) with a required label | 2 (still fires on the footnote list; loses the same-line `Choose: [1] a [2] b` shape) |
| Candidate B | negative lookbehind `(?<![A-Za-z0-9_\]])` plus a required whitespace-then-label after each marker | 2 (still fires on inline citation and the footnote list) |

[VERIFIED: live evaluation of all three patterns in this session]

Both candidates halve the false positives, and both still fire on the footnote reference list, because `[1] Simon 1962.\n[2] Rittel and Webber 1973.` and `[1] Build the plan\n[2] File the evidence` are the SAME string shape. **Pure regex cannot separate them.** This is the classic structured-output-vs-prose classifier problem, and this repo has already learned the expensive lesson about trying to close it with a nearby-cue proxy: the `GATE_FRAMING_RE` co-requirement was retired at an ~86% false-positive rate, documented at length above `ASCII_BOX_UNCONDITIONAL_RE`.

**Recommended direction (Claude's discretion area, planner to confirm).** Do not try to win this with a better regex alone. Add a second, structural signal that a citation cannot have. In descending order of confidence:

1. **Demote the backstop from independent detector to CONFIRMER.** Require the backstop hit AND a corroborating side-channel reached-gate record for this session. A citation list in prose has no gate mint behind it. This is the strongest discriminator and reuses `card-fire-sidechannel.cjs` unchanged. Cost: it weakens the backstop's stated purpose as "the only detector that still works when the side-channel writer itself fails". That tradeoff needs a navigator call, and given the side channel is now live (Phase 209-06 H3) and the PRIMARY arm is doing all the actual work, it is defensible.
2. **Add an explicit negative allowlist for the four proven citation shapes** (bracket followed by `:` = markdown link def; bracket preceded by a word char = array index; bracket-label matching an `Author Year` shape = bibliography). Narrow, testable, and honest about being a heuristic. Weaker than 1, but does not touch the backstop's independence.
3. Line-anchoring (Candidate A) as a floor under either of the above. It is a strict improvement on its own and costs only the inline `Choose: [1] a [2] b` shape, which the model does not actually emit (its natural rendering is multiline).

Whatever is chosen, `ASCII_BOX_GLYPH_RE` must stay byte-identical unless the plan deliberately re-keys the retry store: `gateSignature` derives the retry key from its matched span, and `tests/test-209-backstop-tuning.cjs` asserts its behavior verbatim. This constraint is already written into the source ("ASCII_BOX_GLYPH_RE above stays BYTE-IDENTICAL").

### 5d. The corpus: what goes in it, and the sanitization constraint

**Sources available:**

| Source | Records | What it proves |
|--------|---------|----------------|
| `~/.mindrian/card-fire-intercepts.log` | 38 (9 sessions, incl. 6 with a numbered-prose glyph span) | Real over-enforcement prose that must produce zero fires. Contains `reason`, `ran_entries`, `matched_glyph_span`, `session_id`, `output_text` (capped at 4000 chars). |
| `.planning/debug/card-fire-stale-f1-reach-suggestion-*.md` | 1 open RCA, 4+ reproductions, F.1 mint site | The tenth distinct reproduction; PRIMARY-arm, stale reach suggestion. |
| `.planning/debug/resolved/card-fire-over-enforcement.md` | fix A (NO_SESSION_KEY scoping) + fix B (staleness) | Cross-session bleed: one reach re-firing across 4 session_ids. |
| `.planning/debug/resolved/card-fire-relevance-check-gap.md` | 10 consecutive false fires, ~21 min, 4 session_ids | The PRIMARY gate-existence guard. |
| `.planning/debug/resolved/backstop-benign-list-defeats-relevance-gate.md` | the 7 real backstop fires, ~86% FP | The ONLY historical set of genuine backstop fires. Highest-value corpus material; predates the arm-4 retirement. |
| `.planning/debug/resolved/card-fire-block-surface.md` | reason-slug leakage | Envelope shape, not classification. |
| `.planning/debug/resolved/card-fire-answered-gate-refires-within-ttl-window.md` | ninth defect, record lifecycle | Explicitly exonerates the backstop for all 6 records it examined. |
| `.planning/debug/knowledge-base.md` | summary blocks with root cause + pattern lesson for each | The narrative index. |

**The instance count, stated honestly.** The knowledge-base's own numbering reaches "FIFTH-THROUGH-NINTH defect against this same script" (the answered-gate RCA), the open F.1 RCA calls itself "at minimum the tenth distinct reproduction", and `mcp-first-path-retry-ceiling-hardcoded-zero` is a further one. ROADMAP's "eight logged over-enforcement instances" is a snapshot taken mid-count. **Do not fabricate a number.** The plan should say "at least ten distinct logged defects/reproductions against `scripts/check-card-fire.cjs`, of which the commits `dde3f89f9` (sixth/seventh/eighth) and `5eea35170` (fourth/fifth) are not present in this worktree" and re-census after the fast-forward.

**Sanitization is mandatory and non-trivial.** The corpus is committed to git. The raw `output_text` values in the live log contain: real venture content (a Sanhedrin/MOTJ RFP paragraph about goring-ox liability, Hebrew text), internal dev-repo debugging detail, and plausibly tester-identifying material. Two HARD RULES bind here: Canon Part 8 (LOCAL data never leaves local) and `feedback_no_real_names_in_repo.md` (no real names/emails of testers/advisors in tracked repos). The corpus fixtures must be paraphrased or synthesized to preserve the STRUCTURAL shape (the glyph span, the option-label set, the surrounding prose density) while carrying no real venture or person content. State this as a task, not an afterthought.

**Corpus shape recommendation.** Two clearly-labeled halves in one committed JSON fixture file, each entry carrying `{id, source: 'live-log'|'authored'|'rca', expect_fire: bool, why, text}`:

- **Half A, must NOT fire:** the 6 real numbered-prose spans from the live log (sanitized) + the 4 authored citation/footnote/link-def/array-index fixtures + a benign Action Footer + a step-by-step instruction list.
- **Half B, must STILL fire red:** a genuine multiline bracket box, a genuine bulleted bracket box, the `type 1, 2, or 3` literal, and at least one reconstructed shape from the 7 historical backstop fires' ONE genuine fork (the RCA names it: `cfec3113`, *"Two honest paths -- pick one: build vs file"*).

The `expect_fire: true` half is what stops the fix from degenerating into "delete the backstop". SC3 names it explicitly and it is the load-bearing anti-vacuity control.

---

## Architecture Patterns

### Current mint-to-ratify flow (the seam this phase repairs)

```
                       lib/mcp/gate-render.cjs
                       normalizeCard() mints gate_id
                       (crypto.randomBytes(8))
                                 |
             +-------------------+-------------------+
             |                                       |
   gate_render tool                          chain_run tool (START)
   lib/mcp/tools/gate.cjs                    lib/mcp/tools/chain.cjs
             |                                       |
     _mintLiveGate(id, card)                _mintResumeLedger(id, {step,rest,...})
     -> _liveGates Map                      -> _resumeLedger Map
     (no session key)                       (sessionId stored, never read)
             |                                       |
             |                                       |
   gate_answer tool                          chain_run tool (RESUME)
   _consumeLiveGate(id) ---- X NO PATH ----> _consumeResumeLedger(id)
             |                                       |
   normalizeGateAnswer                       verdict !== 'approve'? return
   (chosen NOT validated)                    else run entry.onStepFn
             |                                (chosen never read at all)
   navigation.logMemoryEvent
   ratified: true
```

The `X NO PATH` edge is GATE-01/G-1. The two "(no session key)" / "(never read)" annotations are GATE-03/half A. The two parenthesized `chosen` notes are GATE-01/G-2.

### Current card-fire enforcement flow (the seam GATE-04 tunes)

```
  Stop event
      |
      +-- hooks/hooks.json Stop entry -> scripts/check-card-fire.cjs main()
      |     (no-ops entirely when isMcpFirst('cli'))
      |
      +-- hooks/hooks.json Stop entry -> scripts/on-stop
            (flag ON) -> lib/mcp/tools/stop-gate.cjs -> lib/mcp/stop-gate-handler.cjs

  BOTH paths converge on:
      deriveTurnSignals(env)  <- transcript tail (2 MiB cap), side-channel reach records
      readRetryCount(ctxHash) / readSessionCount(sessionId)
              |
              v   ~/.mindrian/card-fire-retries.json   <-- ONE FILE, TWO PROCESSES,
              |                                            NON-ATOMIC read-modify-write
      classifyCardFire(turn, registry)
              |
        +-----+-----------------------------+
        |                                   |
   PRIMARY arm                          BACKSTOP arm
   ran_entries INTERSECT                computeBackstopHit(output_text)
   render-coverage registry             ASCII_BOX_UNCONDITIONAL_RE
   (37/38 live fires)                   (0/38 live fires, 5/6 latent FPs)
        |                                   |
        +-----+-----------------------------+
              |
   relevance chain: session ceiling -> per-gate ceiling ->
   primary-gate-existence -> synthetic-preceding-turn -> topical relevance ->
   already-answered -> yes/no-binary exemption -> INTERCEPT
              |
   buildEnforcementEnvelope -> ALLOWED_ENVELOPE_KEYS filter
   (hookSpecificOutput deliberately EXCLUDED - Stop has no such schema variant)
```

### Pattern: the demonstrated-RED mutation gate

Every Phase 241/242/243 success criterion was proven by physically disabling the fix, running the suite, observing the specific test go red, then restoring byte-identically and re-running. Phase 238 has three named mutation legs in its SCs (bypass options validation, remove session scoping, remove the fence). Follow the same precedent; do not assert the mutation in prose.

### Pattern: hermetic side-file isolation (mandatory for every test here)

`tests/test-209-incident-replay.cjs` documents the trap it discovered while being written: the `NO_SESSION_KEY` union means stale real-machine records leak into an unrelated session's lookup for up to `TTL_MS`. Every Phase 238 test that touches a side file must set BOTH:

```js
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(tmp, 'card-fire-reached.json');
process.env.MINDRIAN_HOME = tmp;   // covers card-fire-retries.json AND card-fire-intercepts.log
```

`MINDRIAN_HOME` is honored by `retryFilePath()`, `interceptLogPath()`, and `sideFilePath()`'s default branch. Without it, a concurrency test will shred the navigator's live retry store.

### Anti-patterns to avoid

- **A source-presence grep as a reachability proof.** `mcp-first-path-retry-ceiling-hardcoded-zero`'s pattern lesson is explicit: an anti-drift assertion grepped for `consumeReachedGatesForVerdict` in the file text, found it in a branch that could never execute, and passed while the behavior was absent. Assert the OBSERVABLE effect (the ledger entry is gone, the counter climbed, the row was not written), never the presence of a call.
- **A vacuously-green seam-liveness wire.** `assertSeamLive` returns `ok:true` for zero claims by design. Assert `claimedCount > 0`.
- **Fixing the code and leaving the tool description lying.** `chain_run`'s description currently instructs a flow that cannot work. AgentShield scans MCP tool descriptions as a surface.
- **Shipping tmp+rename and calling the concurrency requirement done.** Fixes torn reads, not lost updates. See Finding 4.
- **A nearby-cue proxy for GATE-04.** Retired once already at ~86% FP. Do not re-introduce `GATE_FRAMING_RE`-shaped reasoning under a new name.
- **Editing `ASCII_BOX_GLYPH_RE`.** It is the retry-key anchor and `tests/test-209-backstop-tuning.cjs` pins it verbatim. Only `ASCII_BOX_UNCONDITIONAL_RE` (the intercept decision) is in scope.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Cross-process file fence | A new lock module, a `flock` shell-out, an advisory `.lock` convention | `lib/core/write-lock.cjs::acquireLock/releaseLock` (Phase 87-02) | Already handles stale locks (5s), dead PIDs, corrupt lock files, same-PID re-acquire, and the TOCTOU race the naive version had. Add a bounded wait around it; do not re-derive it. |
| Atomic file write | A new writer | `lib/core/card-fire-sidechannel.cjs::writeStoreAtomic`'s tmp+rename idiom | Same directory, same repo, already handles prune + size cap + `tmp-<pid>-<now>` naming. |
| N-parallel-writer test harness | Promise.all inside one event loop | `lib/memory/write-lock-atomic.test.cjs` + `write-lock-atomic.worker.cjs` (fork 20 children) | Its own header states why: "true OS-level concurrency, not mocked parallel promises inside one event loop". Same-loop promises cannot reproduce this defect. |
| Mint/ratifier liveness assertion | A bespoke check | `lib/core/seam-liveness.cjs::checkMintRatifierLiveness` | Written for this phase by name. Verdict cannot be overridden by design. |
| `chosen`-against-options matching | New id/label resolution | `lib/mcp/gate-render.cjs::_resolveChosenIds` (lines 243-254) | Already builds `byId`/`byLabel` from `card.options` and drops non-members. Lift, do not rewrite. |
| Gate dedup / session-scoped identity key | A new hash | `lib/mcp/gate-dedup.cjs::dedupKey` | Already `sha256('sid:'+sid+'|gate:'+gate+'|subject:'+subject)`, session-scoped, never throws. |
| Option-label extraction | A second regex | `lib/core/gate-relevance.cjs::extractOptionLabels` | Phase 210-05 already consolidated the signature path and the relevance path onto this one implementation specifically so they cannot drift. |
| Test aggregator | A new runner shape | `tests/run-all-209.sh`'s `run_if` pattern | Every leg guarded on a file that must exist, so a partially-landed phase exits with SKIPs rather than FAILs. |
| Session id resolution | Reading `extra` directly | `lib/core/session-binding.cjs::resolveEffectiveSessionId` | Already handles the explicit / `extra.sessionId` / env-var precedence, and returns `null` honestly rather than fabricating. |

**Key insight:** every primitive this phase needs already exists in the repo. The defects are all missing WIRES between existing parts, which is the milestone's stated recurring failure shape ("a mechanism wired at one end and inert at the other"). Any plan that introduces a new module beyond a single shared gate-ledger should be challenged against Canon Part 7.

---

## Common Pitfalls

### Pitfall 1: reusing `acquireLock` unchanged makes the counter WORSE

**What goes wrong:** `acquireLock` throws when a live PID holds the lock. Wrapped inside `bumpRetryCount`'s existing swallow-everything `try/catch`, 19 of 20 contenders throw and silently drop their increment.
**Why it happens:** the lock was built for SQLite writes where the caller wants to fail fast and delegate, not for a counter where every increment must land.
**How to avoid:** bounded spin (short sleep, capped attempts), or an append-only counter, or read-merge-on-conflict. Whichever is chosen, the N-writer test must assert the EXACT expected total, not just "greater than before".
**Warning sign:** the 20-writer test passes with a count of 1.

### Pitfall 2: the seam-liveness helper is vacuously green on an empty claim set

**What goes wrong:** `assertSeamLive` returns `ok:true, claimedCount:0` for a seam that claims nothing. A wiring bug that produces an empty claims array reads green forever.
**Why it happens:** deliberate design ("a seam that claims nothing cannot be dead") mirroring `statusline-liveness-gate.cjs`'s malformed-sample degrade.
**How to avoid:** assert `claimedCount > 0` alongside `ok === true`, and prove the mutation (rename one minted gate kind) turns it red.

### Pitfall 3: testing `chainRun`'s internal resume instead of the real `gate_answer` tool

**What goes wrong:** `tests/test-198-chain-run-halt.test.cjs` already exercises `chainRun(null, {gateAnswer})` and presumably passes. A Phase 238 test written the same way would pass without the ledgers ever being joined.
**Why it happens:** the internal function is easy to call; the registered MCP tool handler needs a server harness.
**How to avoid:** SC1 says "asserted on a real chain run" and "mint id equals ratified id". Drive `gate_answer`'s registered handler (or at minimum `gate.cjs`'s exported consume against `chain.cjs`'s minted id) and assert the id equality directly. `tests/test-198-concurrency-mcp.test.cjs` exists as a harness precedent.

### Pitfall 4: a `null` session id becoming a consume wildcard

**What goes wrong:** `resolveEffectiveSessionId` can return `null`. If the session check is `entry.sessionId === callerSessionId`, two different `null`-session callers match each other, and the "session-scoped" claim is false exactly where it matters least visibly.
**Why it happens:** the same shape `card-fire-sidechannel.cjs` hit with `NO_SESSION_KEY`, whose union leaked one mint into every session for 10 minutes until fix A scoped it to `TURN_FRESH_MS`.
**How to avoid:** a process-scoped sentinel (e.g. `'no-session:' + process.pid`) rather than a shared literal, and a named test for the two-null-sessions case.

### Pitfall 5: a Stop-hook envelope key that invalidates the whole response

**What goes wrong:** adding `hookSpecificOutput` to a Stop envelope makes Claude Code's validator reject the ENTIRE envelope and dump `Hook JSON output validation failed: Invalid input` to the user.
**Why it happens:** Claude Code's schema defines `hookSpecificOutput` variants for `PreToolUse`, `UserPromptSubmit`, and `PostToolUse` only. Not Stop.
**How to avoid:** `ALLOWED_ENVELOPE_KEYS` already excludes it deliberately (`stop-hook-invalid-hookspecificoutput-schema`, the 4th occurrence of this defect class). Do not re-add it, and do not smuggle model-directive text into `reason`/`systemMessage`, which are human-facing and rendered as "Stop hook error: <reason>" regardless of `systemMessage` (CR-06, observed live at v1.15.3-beta.12).

### Pitfall 6: a fixture corpus that leaks real venture content into git

**What goes wrong:** the live intercept log's `output_text` values contain real client work and Hebrew source material. Committing them verbatim breaches Canon Part 8 and the no-real-names rule.
**How to avoid:** paraphrase or synthesize each fixture to preserve structure and lose content; carry a `source` field so a reader can tell an authored fixture from a sanitized live one; state the sanitization as its own task with its own verification.

### Pitfall 7: the fix landing on `main` is not the fix being live

**What goes wrong:** a session running the marketplace-cached plugin does not pick up a dev-repo commit, and does not hot-reload even after a release ships.
**Why it happens:** documented four times in three weeks (`.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md`, still open); the open F.1 RCA explicitly ruled this out as its own explanation by grepping the running beta.50 cache.
**How to avoid:** never say "fixed" for a card-fire behavior without checking that a release actually shipped AND was picked up. Applies to this phase's own verification claims.

---

## Code Examples

### The two-ledger break, reproduced (paste-ready probe)

```js
// Source: live execution this session against lib/mcp/tools/{chain,gate}.cjs
const chain = require('./lib/mcp/tools/chain.cjs');
const gate  = require('./lib/mcp/tools/gate.cjs');

const steps = [{ step: 1, framework: 'f1', command: '/mos:ignite' }];
const r = await chain.chainRun(steps, {
  roomDir: '/tmp', sessionId: 'sessA',
  onStep: async () => ({ chain_output: 'x', quality: 'high' }),
  postureFn: () => ({ command: '/mos:ignite', autonomous_safe: false, posture: 'halt' }),
  gateRenderCtx: { capabilities: {} },
});
const gid = r.gate.gate_id;
chain._internal._resumeLedger.has(gid);   // true
gate._internal._liveGates.has(gid);       // false   <-- the dead seam
gate._internal._consumeLiveGate(gid);     // null    <-- gate_answer rejects it
```

### The lost-update measurement (paste-ready probe)

```js
// Source: live execution this session. 20 processes x 10 increments = 200 expected.
// Observed: {"k1":{"count":3,...}}  -> 197 lost updates.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cfretry-'));
const code = 'const m=require("<repo>/scripts/check-card-fire.cjs");' +
             'for(let i=0;i<10;i++)m.bumpRetryCount("k1");';
await Promise.all(Array.from({length: 20}, () => new Promise(r => {
  spawn(process.execPath, ['-e', code],
        { env: { ...process.env, MINDRIAN_HOME: home }, stdio: 'ignore' })
    .on('exit', r);
})));
JSON.parse(fs.readFileSync(path.join(home, 'card-fire-retries.json'), 'utf8'));
```

### The atomic-write idiom already in the repo (the copy target)

```js
// Source: lib/core/card-fire-sidechannel.cjs:214-227 (shipped)
function writeStoreAtomic(filePath, store) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const now = Date.now();
    const capped = enforceSizeCap(pruneStore(store, now));
    const tmp = filePath + '.tmp-' + process.pid + '-' + now;
    fs.writeFileSync(tmp, JSON.stringify(capped), 'utf8');
    fs.renameSync(tmp, filePath);          // atomic on the same filesystem
  } catch (_e) { /* best-effort */ }
}
```

### The Phase 87-02 fence primitive (the lock target)

```js
// Source: lib/core/write-lock.cjs:40-46 (shipped)
// 'wx' fails with EEXIST when the file exists -- that is how exactly ONE of
// N racing processes wins. NOTE: this THROWS on a live holder, it does not wait.
fd = fs.openSync(lockPath, 'wx');
fs.writeSync(fd, payload);
fs.closeSync(fd);
```

### The validation that already exists, one rung over (the lift target)

```js
// Source: lib/mcp/gate-render.cjs:243-254 (shipped, used by the AskUserQuestion rung only)
function _resolveChosenIds(picked, card) {
  if (!picked || !Array.isArray(picked.chosen)) return null;
  const byId    = new Set(card.options.map((o) => o.id));
  const byLabel = new Map(card.options.map((o) => [o.label, o.id]));
  const out = [];
  for (const c of picked.chosen) {
    if (typeof c !== 'string') continue;
    if (byId.has(c))    { out.push(c); continue; }
    if (byLabel.has(c)) { out.push(byLabel.get(c)); continue; }
  }
  return out.length > 0 ? out : null;
}
```

---

## Runtime State Inventory

This is a wiring/refactor phase touching live local state, so the inventory applies.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | `~/.mindrian/card-fire-retries.json` (1585 bytes live, per-gate `<ctxHash>` entries + `__session__:<id>` entries, `{count, ts}` shaped, 24h TTL). `~/.mindrian/card-fire-reached.json` (676 bytes live, side-channel reach records, 10min TTL, 64KB cap). `~/.mindrian/card-fire-intercepts.log` (47631 bytes, 38 JSONL records, 24h TTL). | Code edit only. The retry store's SCHEMA does not change (still `{count, ts}`); only the write path gains atomicity + a fence. `normalizeRetryEntry` already tolerates the legacy bare-integer shape, so no data migration is needed. If the fix changes the KEY derivation, existing entries orphan and expire within 24h - acceptable, but state it. |
| **Live service config** | None. No n8n workflow, Datadog dashboard, Tailscale ACL, or Cloudflare tunnel references any gate identity. Verified by grep for the gate/card-fire identifiers across `hooks/`, `scripts/`, `data/`. | None. |
| **OS-registered state** | `hooks/hooks.json` Stop block registers `scripts/check-card-fire.cjs` (line 207) and `scripts/on-stop` as two SEPARATE Stop entries. This registration is read by Claude Code at session start. | None, unless the plan changes the hook entry itself (it should not). Note: a running session does not pick up a `hooks.json` change without a restart. |
| **Secrets / env vars** | `MINDRIAN_HOME` (retry store + intercept log root), `CARD_FIRE_SIDECHANNEL_PATH` (side-channel test seam), `MINDRIAN_MCP_FIRST` (decides which of the two Stop enforcement paths runs), `CLAUDE_CODE_SESSION_ID` (session-id fallback in `resolveEffectiveSessionId`), `MINDRIAN_ROOMS_HOME`. None are renamed by this phase. | None. But every new test MUST set `MINDRIAN_HOME` and `CARD_FIRE_SIDECHANNEL_PATH` to a tmp dir or it will corrupt the navigator's live counters. |
| **Build artifacts** | `data/connector-registry.json` and `data/mcp-tool-connectors.json` are GENERATED from the `connectors` exports in `gate.cjs` / `chain.cjs` by `scripts/build-connector-registry.cjs`. Never hand-edit. `data/render-coverage-registry.json` drives the PRIMARY arm's match set. | If any `connectors` export changes (it should not for this phase - no new invocable surface), re-run `node scripts/build-connector-registry.cjs --check`. |
| **In-memory state that dies with the process** | `gate.cjs::_liveGates`, `chain.cjs::_resumeLedger`, `gate-render.cjs::_firedBindingSessions`, `stop-gate-handler.cjs`'s per-session `state.fired` Map. All per-process. | Relevant to the design: a unified ledger that stays in-memory keeps the current "server restart clears all pending gates" behavior. Moving it to disk would change that and is NOT required by any SC. Recommend staying in-memory. |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (floor `>=22.5.0`) | - |
| `node:crypto`, `node:fs`, `node:child_process` | ledger keys, fence, N-writer test | yes | built-in | - |
| RegExp lookbehind (`(?<!...)`) | GATE-04 candidate B | yes | Node 22 | Candidate A needs no lookbehind |
| `zod` | MCP tool schemas | yes | ^3.25.76 (in stack) | - |
| `@modelcontextprotocol/sdk` | tool registration | yes | ^1.29.0 (in stack) | - |
| `~/.mindrian/card-fire-intercepts.log` | GATE-04 corpus raw material | yes | 47631 bytes, 38 records, 9 sessions | RCA prose in `.planning/debug/resolved/` |
| Git objects for `dde3f89f9` / `5eea35170` | full instance census | **NO** | - | RCA prose + knowledge-base are on disk and current; fast-forward the worktree to recover |
| `mcp__langtalks-graph-expert__*` | mandatory grounding leg | not visible to this researcher | - | Orchestrator ran it in parallel (see below) |
| `claude-code-guide` agent / `claude-api` skill | Stop-hook schema semantics | not visible to this researcher | - | Orchestrator ran it in parallel; repo source comments carry the prior findings verbatim |
| Context7 MCP | `node:sqlite` / `fs` API contracts | available in env | - | Not needed: this phase touches no SQLite transaction semantics, and the `fs` primitives in play (`openSync('wx')`, `renameSync`) are already proven in-repo by Phase 87-02 |

**No missing dependency blocks execution.** The one genuine gap (missing git objects) has a one-command remedy and does not block planning, only the exact instance count.

---

## Grounding Consultations (per CLAUDE.md MANDATORY rule)

Recorded honestly, including what this researcher could and could not run.

| Source | Who ran it | Status |
|--------|-----------|--------|
| `langtalks-graph-expert` (ledger/ratification/idempotency concurrency-fencing patterns; guardrail/classifier false-positive patterns for structured-output vs prose detection) | **Orchestrator**, in parallel with this research, 2 queries | Results to be folded into PLAN.md's grounding section by the orchestrator. NOT re-run here. Its MCP tools were not present on this researcher's tool surface (the same upstream restriction Phase 237's researcher hit and worked around by driving the stdio server directly over JSON-RPC). |
| `claude-code-guide` agent (Stop-hook JSON schema semantics; can a Stop hook distinguish "AskUserQuestion fired" from "prose that looks like a card") | **Orchestrator**, in parallel | NOT re-run here. Note the repo already carries hard-won findings on this exact question in source: `ALLOWED_ENVELOPE_KEYS`'s comment block (Stop has no `hookSpecificOutput` variant; the union covers PreToolUse/UserPromptSubmit/PostToolUse only) and Phase 241's verification (Claude Code's real default Stop-hook timeout is 600 seconds per hook command, not the ~3000ms this repo's comments assume). |
| Context7 | Considered, not run | This phase's concurrency work uses `fs.openSync('wx')` and `fs.renameSync`, both already proven in-repo by Phase 87-02 with a 20-fork test. No `node:sqlite` transaction semantics are in scope (that is Phase 236/240/242's cross-cutting rule, not this one). Recorded as a deliberate skip with a reason, not an oversight. |
| Repo source + live telemetry | This researcher | The primary source for every finding above. All three defects reproduced against shipped code. |

**Recommendation for the planner:** the classifier question is where langtalks is most likely to have real corpus coverage (guardrail false-positive tuning, structured-output detection). If the orchestrator's query returned "not in the corpus yet", record that as a valid outcome and do NOT paper over it: the recommended remedy (demote the backstop to a confirmer requiring side-channel corroboration) is an architectural answer, not a classifier-tuning one, and stands on its own.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test framework

| Property | Value |
|----------|-------|
| Framework | Plain Node scripts using `node:assert/strict`, aggregated by a bash runner. No jest/vitest/mocha. |
| Config file | none (by design; the aggregator IS the config) |
| Quick run command | `node tests/test-238-<leg>.cjs` |
| Full suite command | `bash tests/run-all-238.sh` |
| Aggregator pattern | `tests/run-all-209.sh` (`run` / `run_if` with a file guard, PASS/FAIL/SKIP tally, `set -uo pipefail`) |

### Phase requirements to test map

| Req | Behavior | Type | Automated command | File exists? |
|-----|----------|------|-------------------|--------------|
| GATE-01 (G-1) | A real `chain_run` halt's minted `gate_id` is consumable by `gate_answer`; mint id equals ratified id | integration | `node tests/test-238-one-ledger.cjs` | Wave 0 |
| GATE-01 (G-1) | Seam-liveness `checkMintRatifierLiveness` green on live mint/ratify kinds, red on a renamed mint kind, `claimedCount > 0` | unit | `node tests/test-238-mint-ratifier-seam.cjs` | Wave 0 |
| GATE-01 (G-2) | `chosen` not among the card's options is rejected BEFORE any `memory_event` row is written; mutation (bypass) turns it red | integration | `node tests/test-238-chosen-validation.cjs` | Wave 0 |
| GATE-01 (G-2) | Chain resume path also rejects an out-of-card `chosen` (today it ignores `chosen` entirely) | integration | same file | Wave 0 |
| GATE-03 (A) | Session B cannot consume session A's gate; the two-null-session case does not match | integration | `node tests/test-238-session-scoped-ledger.cjs` | Wave 0 |
| GATE-03 (B) | N forked processes x M increments produce EXACTLY N*M; store always parses | concurrency | `node tests/test-238-retry-counter-fence.cjs` (+ `.worker.cjs`) | Wave 0 |
| GATE-03 (B) | A reader concurrent with writers never observes a partial/unparseable file | concurrency | same file | Wave 0 |
| GATE-04 | Every `expect_fire:false` fixture in the committed corpus produces zero intercept | corpus | `node tests/test-238-card-fire-corpus.cjs` | Wave 0 |
| GATE-04 | Every `expect_fire:true` fixture still fires red (anti-vacuity) | corpus | same file | Wave 0 |
| GATE-04 | `ASCII_BOX_GLYPH_RE` is byte-identical (retry-key stability) and `tests/test-209-backstop-tuning.cjs` still passes | regression | `node tests/test-209-backstop-tuning.cjs` | exists |
| All | Existing 198 gate/chain regressions still pass | regression | `bash tests/run-all-198.sh` | exists |

### Sampling rate

- **Per task commit:** the single `node tests/test-238-<leg>.cjs` for the leg just touched.
- **Per wave merge:** `bash tests/run-all-238.sh` plus `bash tests/run-all-198.sh` and `bash tests/run-all-209.sh` (both hold assertions this phase can break).
- **Phase gate:** full `run-all-238.sh` green, plus `node scripts/build-connector-registry.cjs --check`, before `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `tests/run-all-238.sh` - aggregator, all legs pre-declared with `run_if` guards so no later plan edits it (the 209-04 precedent)
- [ ] `tests/fixtures/card-fire-corpus-238.json` - the sanitized two-half corpus
- [ ] `tests/test-238-retry-counter-fence.worker.cjs` - the forked-child worker (mirrors `lib/memory/write-lock-atomic.worker.cjs`)
- [ ] Shared hermetic-isolation helper setting `MINDRIAN_HOME` + `CARD_FIRE_SIDECHANNEL_PATH` for every leg
- [ ] Framework install: none needed

---

## Security Domain

`security_enforcement` is not disabled in config, so the section applies. This phase is squarely a security-relevant one: both ledgers exist as anti-spoofing controls (T-198-10 / T-198-12).

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | No user authentication surface. |
| V3 Session Management | **yes** | Session-scoped ledger keys via `resolveEffectiveSessionId` + `gate-dedup.cjs::dedupKey`'s session-scoped hash. GATE-03 half A is literally a session-management defect: a capability token (`gate_id`) with no session binding. |
| V4 Access Control | **yes** | The gate ledger IS an access-control token store. Single-use consume + TTL are already correct; the missing control is the subject binding (which session may consume). |
| V5 Input Validation | **yes** | GATE-01 G-2 is a canonical input-validation gap: an untrusted `chosen` array reaching a persisted write without being checked against the server-side allow-list (the card's own options). Existing control: `zod` for shape. Missing control: value-domain validation. |
| V6 Cryptography | partial | `crypto.randomBytes(8)` for `gate_id` (64 bits, adequate for a short-TTL in-memory single-use token) and `sha256` for keys. Both correct; do not hand-roll anything new here. |
| V12 Files and Resources | **yes** | The retry store's non-atomic read-modify-write is a TOCTOU-class file defect, the same class Phase 87-02 already closed for the write lock. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Forged / replayed `gate_id` reaching a ratified write | Spoofing | Single-use in-memory ledger with TTL (already present) PLUS session binding on consume (missing - GATE-03) |
| Out-of-domain `chosen` value persisted as a ratified decision | Tampering | Server-side allow-list validation against the minted card's own options (missing - GATE-01 G-2) |
| Cross-session gate consumption executing another session's material step in another session's room | Elevation of Privilege | Session-scoped ledger key; reject on mismatch before any `onStepFn` call |
| TOCTOU lost update on a security-relevant counter (the bounded-escape ceiling) | Denial of Service | OS-level create-exclusive fence (`openSync('wx')`) with bounded wait; atomic tmp+rename for readers |
| Untrusted transcript content driving a Stop-hook block decision | Denial of Service | Already bounded: `TRANSCRIPT_TAIL_BYTES` 2 MiB read cap, `MAX_FORCE_RETRIES`, `MAX_SESSION_INTERCEPTS`, predicate never throws. The GATE-03 lost-update defect UNDERMINES two of these bounds. |
| Fixture corpus leaking real user content into a public repo | Information Disclosure | Sanitize before commit (Canon Part 8 + no-real-names HARD RULE) |

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| BACKSTOP arm 4 (bare numbered prose) counted as an intercept | Retired; numbered-prose forks are the model's own Phase-210/SEED-021 judgment | commit `5431b7e9` | GATE-04 must NOT re-introduce it. It is why 0/38 live records are backstop fires. |
| `GATE_FRAMING_RE` nearby-cue co-requirement | Retired at ~86% FP | commit `5431b7e9` | Do not re-derive a cue-proxy under a new name. |
| PRIMARY arm documented INERT (no producer of `ran_entries`) | PRIMARY is LIVE via `card-fire-sidechannel.cjs`, wired at 3 mint sites | Phase 209-06 (H3) | This is WHY over-enforcement moved from the backstop to the primary arm. |
| Side-channel record's only exit was the 10min TTL | `consumeReachedGates` record lifecycle, consumed on TERMINAL verdicts only | `card-fire-answered-gate-refires-within-ttl-window`, 2026-07-28 | Never consume on `intercept:true` (that would make `MAX_FORCE_RETRIES` unreachable). |
| `stop-gate-handler.cjs` hardcoded `retry_count = 0; session_count = 0` | Reads the REAL shared counters via the exported accessors | `mcp-first-path-retry-ceiling-hardcoded-zero`, 2026-07-28 | This is what made the retry file a genuinely TWO-PROCESS store, and thus what made the lost-update defect production-real. |
| `hookSpecificOutput` in the Stop envelope | Removed from `ALLOWED_ENVELOPE_KEYS` | `stop-hook-invalid-hookspecificoutput-schema`, 2026-07-23 | Do not re-add. |
| Stop-hook budget assumed ~3000ms | Real Claude Code default is 600s per hook command | Phase 241 verification, 2026-07-28 | The "never block the 3000ms budget" comments throughout `card-fire-sidechannel.cjs` and `check-card-fire.cjs` are 200x over-tight. A bounded lock wait of tens of milliseconds is comfortably affordable. This materially de-risks the GATE-03 fence. |

**Deprecated / outdated in the source comments (do not trust verbatim):**
- The "3000ms Stop-hook budget" claim in `card-fire-sidechannel.cjs:34` and `check-card-fire.cjs`. Superseded by Phase 241's verified 600s finding.
- `check-card-fire.cjs`'s WR-04 block ("PRIMARY is DEFERRED, not live"). Retained deliberately as historical record; superseded by the DOCTRINE UPDATE directly above it.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The parent checkout's missing commits (`dde3f89f9`, `5eea35170`) log instances four through eight and contain no code change to `scripts/check-card-fire.cjs`. Inferred from their `docs:` prefix and message text visible in the session's git status, not read. | Blocking Environment Finding | If they DID change the classifier, every regex measurement above was taken against stale code. Cheap to check: fast-forward, then `git log -p --oneline -- scripts/check-card-fire.cjs`. |
| A2 | `tests/test-198-chain-run-halt.test.cjs` currently passes and never crosses to `gate_answer`. Inferred from the two-ledger reproduction plus 237-02's plan text retargeting it; the test file itself was not opened. | Finding 1, Pitfall 3 | If it DOES cross the seam, it would be failing today and someone would have noticed. Low risk. Verify by running it. |
| A3 | The GATE-04 remedy direction (demote the backstop to a side-channel-corroborated confirmer) is architecturally acceptable. This trades away the backstop's stated independence from the side channel. | Finding 5c | Needs a navigator call, not a researcher's. Flagged as an Open Question, not a recommendation to execute blind. |
| A4 | Cowork genuinely runs one MCP server process across multiple concurrent user sessions. Taken from CLAUDE.md's Tri-Polar table ("Multi-user, persistent agents, shared 00_Context/"), not verified against a running Cowork instance. | Finding 3 | If Cowork is process-per-user, GATE-03 half A's severity drops to the replay/leak vector only. The fix is still correct and SC2 still requires the two-process proof. |
| A5 | The 6 numbered-prose `matched_glyph_span` records in the live log are benign instruction lists, not genuine unfired forks. Read from their text; no navigator confirmation. | Finding 5a | If any was a genuine fork, it belongs in corpus half B (`expect_fire: true`), not half A. Worth a navigator eyeball during corpus construction. |
| A6 | `gate_id` never leaks outside the session in practice. Not audited; `gate_id` does appear in `chain_run`'s JSON response, which lands in a transcript. | Finding 3 | Raises rather than lowers the case for session scoping. Direction is safe. |

---

## Open Questions

1. **Does GATE-04's remedy demote the backstop's independence, and is that acceptable?**
   - What we know: pure regex provably cannot separate a footnote reference list from a bracket-box gate (measured: both candidate patterns still fire on the footnote list). The strongest discriminator available is side-channel corroboration. The backstop's own doctrine header says it "stays SECONDARY PERMANENTLY - it is the only detector that still works when the side-channel writer itself fails".
   - What is unclear: whether the navigator accepts trading that independence, given the side channel is now live and the PRIMARY arm handles 37/38 real fires.
   - Recommendation: put this to the navigator as an explicit fork before writing the GATE-04 plans. If independence must be preserved, fall back to Candidate A (line-anchoring) plus the narrow negative allowlist, and accept that the footnote-list shape remains a known, documented residual rather than pretending it is closed.

2. **Should Phase 238 wait for Phase 237, or fence around it?**
   - What we know: `lib/mcp/tools/chain.cjs` and `tests/test-198-chain-run-halt.test.cjs` are in both phases' scope; 237 is planned, verified by the plan-checker, and unexecuted.
   - Recommendation: sequence 237 first. If the navigator wants parallel, fence 238's chain edits to the ledger block with a `git diff` criterion.

3. **What is the actual logged-instance count, and does the ROADMAP's "eight" need correcting?**
   - What we know: the knowledge-base numbering reaches "ninth"; the open F.1 RCA calls itself "at minimum the tenth distinct reproduction"; two instance-logging commits are absent from this worktree.
   - Recommendation: re-census after the fast-forward and state the real number in the plan. Do not carry "eight" forward unexamined.

4. **Is the GATE-03 lost update a CAUSE of the GATE-04 over-enforcement, or just a co-resident defect?**
   - What we know: the counters are the bounded escape; 197/200 increments are lost under 20-way concurrency; the live log spans 9 sessions on one machine; the observed symptom is a force-loop that does not converge.
   - What is unclear: whether the observed non-convergence is attributable to lost updates or to the record-lifecycle/staleness defects already fixed.
   - Recommendation: make this a named, falsifiable test rather than a claim: measure force-loop convergence under N concurrent Stop evaluations before and after the fence. A yes here would be the most valuable finding in the phase.

5. **Should the unified ledger stay in-memory or move to disk?**
   - What we know: no SC requires persistence. In-memory keeps today's "server restart clears pending gates" behavior, which is arguably correct for a 30-minute single-use token.
   - Recommendation: stay in-memory. Note that this means SC2's "two concurrent sessions" proof is about two sessions on ONE server process, not two processes. Read SC2 carefully: it says "two-process fence" for the counter and "two concurrent sessions" for the cards. Those are different proofs and the plan should not conflate them.

---

## Sources

### Primary (HIGH confidence: live execution or direct source read this session)

- `scripts/check-card-fire.cjs` (1542 lines, read in full across the classifier, envelope, and counter surfaces)
- `lib/mcp/tools/gate.cjs`, `lib/mcp/tools/chain.cjs`, `lib/mcp/gate-render.cjs`, `lib/mcp/gate-dedup.cjs` (read in full)
- `lib/core/card-fire-sidechannel.cjs`, `lib/core/write-lock.cjs`, `lib/core/seam-liveness.cjs`, `lib/core/chain-retry.cjs` (read in full)
- `lib/mcp/stop-gate-handler.cjs` (the counter-wiring and verdict-ordering block)
- `lib/memory/write-lock-atomic.test.cjs`, `tests/test-209-backstop-tuning.cjs`, `tests/test-209-incident-replay.cjs`, `tests/run-all-209.sh`
- Live execution: two-ledger break reproduction; `chosen`-validation gap reproduction; 20-process lost-update measurement; 38-record intercept-log replay; 10-fixture regex FP/FN matrix across three patterns
- `~/.mindrian/card-fire-intercepts.log` (38 records, 9 sessions), `~/.mindrian/card-fire-retries.json`, `~/.mindrian/card-fire-reached.json`
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`, `./CLAUDE.md` + its four `@include` files
- `.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` (open RCA, read in full)
- `.planning/debug/knowledge-base.md` (card-fire summary blocks, incl. the ninth-defect and mcp-first-retry-ceiling entries)
- `.planning/phases/237-reach-mechanism/237-0*-PLAN.md` (`files_modified` census + 237-02/237-06 scope; read-only, nothing modified)

### Secondary (MEDIUM confidence: source comments recording prior verified findings)

- Phase 241's 600s Stop-hook-timeout finding (recorded in `.planning/STATE.md`, verified there against `claude-code-guide` and official docs)
- The `stop-hook-invalid-hookspecificoutput-schema` finding (recorded in `ALLOWED_ENVELOPE_KEYS`'s comment block, 4th occurrence of the class)
- The CR-06 finding that Claude Code renders `reason` as "Stop hook error: <reason>" regardless of `systemMessage` (observed live at v1.15.3-beta.12, recorded in `buildEnforcementEnvelope`'s header)

### Tertiary (LOW confidence: flagged for validation)

- The instance-count reconstruction from commit subject lines visible in the session git status but not resolvable in this worktree (see A1)
- Cowork's process model (see A4)

### Not consulted (recorded, with reason)

- `mcp__langtalks-graph-expert__*` and `claude-code-guide` / `claude-api`: run by the orchestrator in parallel; tools not present on this researcher's surface. Not skipped, delegated.
- Context7: deliberately skipped. No `node:sqlite` or unfamiliar-library API contract is in scope for this phase; the `fs` primitives in play are proven in-repo by Phase 87-02's own 20-fork test.
- Anything under `.planning/phases/236-room-db-data-loss-fixes/`, `lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`, `tests/test-236-*`: OFF-LIMITS per the session ownership lock. Zero reads.

---

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. Every primitive it needs is either a Node built-in (`node:fs`, `node:crypto`, `node:child_process`, `node:path`, `node:os`) or already vendored in the repo (`zod`, `@modelcontextprotocol/sdk`). CLAUDE.md's Conventions forbid adding a dependency here anyway ("CJS only", "no Commander or yargs", "Node built-ins only" in the affected files' own headers). If any plan proposes a new package, that alone is a signal it has left the reuse-before-build lane.

---

## Metadata

**Confidence breakdown:**
- Defect diagnoses (Findings 1-5): **HIGH**. All three requirements' defects were reproduced by live execution against shipped code, not inferred. The measurements (38/38, 197/200, 5/6) are reproducible with the probes included above.
- Standard stack: **HIGH**. Zero new dependencies; every reuse target read in full and its exact line range cited.
- GATE-01 and GATE-03 remedy shape: **HIGH**. The primitives exist, the precedents exist, the traps are named.
- GATE-04 remedy shape: **MEDIUM**. The defect is proven and the corpus sources are enumerated, but the discriminator design has a genuine architectural fork that needs a navigator decision (Open Question 1). Two candidate patterns were measured; neither is sufficient alone, and that is stated rather than papered over.
- Instance count: **LOW**. Two logging commits are absent from this worktree. Reported as a floor with a one-command remedy.
- Sequencing: **HIGH**. The 237 file collision is a direct `files_modified` grep, not an inference.

**Research date:** 2026-07-28
**Valid until:** 2026-08-11 (14 days). Shorter than the usual 30: this phase's raw material is a LIVE, TTL-pruned telemetry log (`card-fire-intercepts.log`, 24h TTL per record) and an actively-moving `.planning/debug/` tree. The corpus should be extracted from that log SOON, before its records expire.
