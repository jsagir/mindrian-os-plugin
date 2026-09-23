# Phase 354: System Integrity and Theo Integration - Disposition Ledger

Published by: 354-01 (Task 1), pre-implementation research-gate publication.
Purpose: give every candidate ID and every newly discovered finding a disposition, evidence
command, observed output, source reference, impact, confidence and owning plan, per the
handoff's "Before implementation, publish the research ledger" requirement
(`docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md`, "Research gate and execution
direction"). Every probe output below was re-run at execution time against the HEAD commit
recorded in the Baseline section, not copied from `docs/reviews/2026-09-23-deep-system-research.md`.

## 1. Baseline

```
$ git rev-parse HEAD
42191a6aeab9a1f6c6d3c8cfe4de1a34b61adc56

$ node lib/core/repo-version.cjs
2.0.0-beta.48

$ node --version
v22.23.1

$ uname -a
Linux JonathanSagir 6.6.87.2-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC Thu Jun 5 18:31:42 UTC 2025 aarch64 aarch64 aarch64 GNU/Linux
```

`git status --short` at execution start (dirty files listed verbatim; none of these are owned by
this plan, none were touched, none belong to `files_modified` below):

```
 M docs/OPEN-HANDOFFS.md
 M scripts/eval-icm-writers.cjs
 M tests/test-353-grader-agreement.cjs
 M tests/test-353-ledger-shape.cjs
?? docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md
```

Timestamp of this probe run: 2026-09-23T08:59:41Z.

## 2. Disposition table

| ID | Finding | Disposition | Evidence command | Observed output (excerpt) | Source refs | Impact | Confidence | Owner plan |
|----|---------|-------------|-------------------|----------------------------|--------------|--------|------------|------------|
| SYS-01 | MCP section/reasoning resource containment | CONFIRMED-BOUNDED (percent-encoded traversal REFUTED through the SDK matcher; symlink escape CONFIRMED) | `node docs/reviews/phase-354-probes/resources.cjs` | `{"uri":"room://section/..%2Foutside","inside":false,"outside":false,...}` (traversal did not escape) vs `{"uri":"room://section/linked","inside":false,"outside":true,"outsideReasoning":true}` (symlink escaped both the room resource and the reasoning resource) | `lib/mcp/resources.cjs:252-263` (reasoning template accepts an unchecked `params.name`) | Unauthorized filesystem disclosure through a pre-existing room symlink on both `room://section/{name}` and `reasoning://section/{name}` | HIGH (direct reproduction, re-run clean) | 354-05 |
| SYS-02 | Cross-process write-lock ownership | CONFIRMED | `node docs/reviews/phase-354-probes/persistence.cjs` (locks() leg) | `{"probe":"live-lock-takeover","foreignPid":420995,"currentPid":420997,"replacementPid":420997}` then `{"probe":"nonowner-lock-release","foreignPid":420995,"lockStillExists":false}` | `lib/core/write-lock.cjs:59` (age-only staleness, `STALE_THRESHOLD_MS=5000` at :13), `lib/core/write-lock.cjs:101-104` (`releaseLock()` unlinks by path, no ownership token) | A live, demonstrably-alive foreign-PID lock holder can be displaced by age alone, then have its replacement lock removed unconditionally by the old owner's own release call; mutual exclusion does not hold across the whole write | HIGH (direct reproduction, re-run clean) | 354-04 |
| SYS-03 | Chat/browser output safety (three sub-findings) | CONFIRMED | `node docs/reviews/phase-354-probes/browser.cjs` | `{"probe":"assistant-html","executed":true}` | `lib/chat/chat-panel.js:20-44,379,539` (`_renderMessage` uses `innerHTML`); the Anthropic API key is stored in `localStorage` (`lib/chat/chat-panel.js:242-250`, key `KEY_API`, confirmed by `grep -n localStorage`) | A synthetic `<img onerror>` payload executes inside the rendered assistant message; no Content-Security-Policy meta tag exists anywhere in `templates/` or `lib/chat/` (`grep -rn "Content-Security-Policy" templates/ lib/chat/` returns zero matches) and `scripts/generate-presentation.cjs`'s template injection path (lines 590-790, re-read this run) never sets one | HIGH (direct browser-level reproduction via Playwright, re-run clean) | 354-07 |
| SYS-04 | MCP tool-registration diagnostics | CONFIRMED P2 | `node docs/reviews/phase-354-probes/registration.cjs` | `{"healthyToolCount":27,"degradedToolCount":24,"missingTools":["graph_query","graph_write","memory_event"],"failureDiagnosticPresent":false,"returnedFailure":false}` | `lib/mcp/register-core-tools.cjs:39-75` (per-module `try/catch` silently `continue`s, no diagnostic emitted, no return value signaling degradation) | A failed tool-module registration disappears three tools with zero visible signal; sibling isolation itself is correct and must be preserved, only the invisibility is the defect | HIGH (fault-injection reproduction, re-run clean) | 354-14 |
| SYS-05 | `extract_shallow` persistence contract | DESCRIPTION-HONESTY DEFECT | `grep -n "hitl_why" lib/mcp/tools/dual-path.cjs`; `sed -n '190,200p' agents/larry-extended.md` | `dual-path.cjs:77` hitl_why: "As actually wired, this call performs zero graph writes; it computes and returns an in-memory `{user, venture, claims}` object only." vs `agents/larry-extended.md:193`: "The parser writes 3-5 nodes to local room.db via Phase 109 navigation.cjs setFocus + memory_event" | Tool description (`lib/mcp/tools/dual-path.cjs` `extract_shallow` description string) and `agents/larry-extended.md` both claim governed writes; the connector's own `hitl_why` (born-wired declaration, already shipped) admits zero writes and names the exact reason (`setFocus` requires `opts.db`, never supplied by this call site; `navigation.cjs` does not export `recordMemoryEvent`). Claude's Discretion (354-CONTEXT.md): resolve as honest-parsing-only, since the connector declaration already states the true behavior and `claim_write` already is the governed persistence path | HIGH (source inspection, both artifacts directly quoted) | 354-15 |
| SYS-06 | Localhost POC (three sub-findings: render, save format/origin, journey) | CONFIRMED | `node docs/reviews/phase-354-probes/browser.cjs` | `{"probe":"save-without-edit","before":"# Heading\nThis sentence must survive.\n\n- alpha\n- beta\n\nline one\nline two\n","after":"# Heading\n\n- alpha- beta\n\nline oneline two\n","preserved":false}` and `{"probe":"cross-origin-browser-write","changed":true}` | `docs/reviews/localhost-poc/app.js:3-4` (lossy HTML<->Markdown round trip); `docs/reviews/localhost-poc/server.cjs:45-60` (accepts cross-origin browser POST, no Origin check) | An untouched document loses list/line spacing on a save round trip with zero edits made; a synthetic page on a different loopback origin successfully wrote `SYNTHETIC_CROSS_ORIGIN_WRITE` into the document via a `mode: 'no-cors'` POST | HIGH (direct browser-level reproduction via Playwright, re-run clean) | 354-07 (render), 354-08 (save format, origin), 354-11 (journey) |
| SYS-07 | Acceptance-runner timeout | UNRESOLVED, pending instrumentation | (no probe re-run in this plan; Task 1 does not instrument or rerun acceptance -- see 354-RESEARCH.md Pitfall 3) | N/A -- not reproduced in this plan | `docs/reviews/2026-09-23-deep-system-research.md` "Corrected or bounded earlier findings": sandbox mock-server restrictions affected earlier failing runs; a non-sandbox rerun did not produce a trustworthy completion signal before being stopped | Genuinely undecided whether a real child-process hang exists independent of the sandbox; declaring it fixed OR a defect without instrumentation would be exactly Pitfall 3 | MEDIUM (explicitly flagged undecided by the research, not a research gap) | 354-13 |
| SYS-08 | Gate approval promotes the wrong node (NEW, discovered in this phase's research) | CONFIRMED | `node docs/reviews/phase-354-probes/persistence.cjs` (approval() leg) | `{"probe":"gate-subject-confirmation","response":{"ratified":true,...,"reasoning_node":{"confirmed":true}},"rows":[{"id":"claim:synthetic-persistence-probe:96d906cc","type":"claim","review_status":"proposed"},{"id":"decision:gate:gate-3e007fed14f88b88","type":"decision","review_status":"confirmed"}]}` | `lib/mcp/tools/gate.cjs:303` (`navigation.confirmNode(db, writeResult.node_id, ...)` targets the newly-minted `decision:gate:*` node, not the card's subject claim) | Human approval confirms the wrong node; the original claim the approval was supposed to ratify stays `proposed` forever, silently corrupting the gate's own contract (`lib/mcp/tool-router.cjs:1563`, `:1653`) | HIGH (direct reproduction, re-run clean, exact claim ID traced) | 354-02 |
| SYS-09 | Chain resume conflates command identity with step identity (NEW) | CONFIRMED | `node docs/reviews/phase-354-probes/persistence.cjs` (resume() leg) | `{"probe":"repeated-command-resume","calls":[2],"completed":true,"chainPosition":1,"suggestedNext":"research"}` then `{"probe":"resume-predecessor-input","storedPredecessorPath":"a.md","firstResumedInput":null}` | `lib/core/chain-executor.cjs:1372` (`journal.chain.indexOf(step.command)`), `:1331` (`previousOutput = null`, never restored from the journal's `output_path`) | On a `research -> validate -> research` chain with only step 1 journaled, resume ran only step 2 and reported `completed: true` while the journal still shows `chain_position: 1, suggested_next: research` (step 3 silently skipped); the first resumed step also received `null` instead of the journaled predecessor output `a.md` | HIGH (direct reproduction, re-run clean) | 354-03 |
| THEO-01 | Taxonomy vocabulary and response shape (four parts) | CONFIRMED, four parts | `node docs/reviews/phase-354-probes/theo.cjs` (router-composer-contract legs) | `{"probe":"router-composer-contract","input":{"definition":"well-defined","complexity":"simple"},"expectedRung":"WellDefined","observed":{"rung":"IllDefined"},"recommendation":{"chain":["designthinking","diagnose","build-mvp"],...},"validation":{"valid":false,"reason":"Unknown methodologies: designthinking, build-mvp. ..."}}` (all three synthetic cases -- well-defined/simple, undefined/complex, ill-defined/wicked -- classified `IllDefined`) | classification round trip: `lib/mcp/brain-router.cjs:316-327` vs `lib/core/brain-client.cjs:1172` marker set (P1); executable-chain: `lib/mcp/brain-router.cjs:374-400` (`mappedChain` includes `designthinking`, `build-mvp`, neither a real registry command), `lib/mcp/tool-router.cjs:1802` (`initChain` runs from the unvalidated result) (P1); provenance: `lib/mcp/brain-router.cjs:414-421` (unconditional `chain_type: 'feeds_into'`) (P2); casing: `lib/core/strategy/rung-vocabulary.cjs:102`, `lib/core/strategy/taxonomy-climb.cjs:145-147` (P2) | All three synthetic definition/complexity pairs misclassify to `IllDefined`; the recommended chain fails the router's own `validateChain()` yet still initializes `act` state from its invalid first element; the reasoning text unconditionally asserts `FEEDS_INTO` provenance that was never computed; the taxonomy-ladder path sends casing Theo's schema rejects | HIGH (direct reproduction against the real router/composer/validator, re-run clean) | 354-09, 354-10, live certification 354-12 |
| THEO-02 | Release registry synchronization | BLOCKED, cross-repository | `ls /home/jsagi/Theo/.github/workflows/`; `git -C /home/jsagi/Theo log -1 --format=%h`; `grep -rl "theo-resync" /home/jsagi/Theo/.github/workflows/` | `ci.yml`, `theo-liveness.yml`, `theo-seam-audit.yml` (no `theo-resync` consumer workflow found; grep returned no match); Theo commit at inspection time: `4ae9843` | plugin side sends a `repository_dispatch` event `theo-resync` at `jsagir/theo` (`scripts/release.sh` Step 5.6, `docs/THEO-NOTIFY-CONTRACT.md`); Theo's own workflow directory has no consumer for that event at the inspected commit. Not fixable from this repo (Theo-side change required) | Sending the event is not proof it is consumed; a real release could notify a workflow that does not exist yet. This is a tracked cross-repository gap, coordinated with Phase 351, not duplicated | MEDIUM (read-only inspection of Theo's repo, current at time of read; Phase 351 registered but no plans filed at inspection time -- see Ownership map below) | plugin-side verification 354-12 |
| THEO-03 | Complete teaching-to-action loop / free-form Brain egress boundary | CONFIRMED, false-safe egress path | `node docs/reviews/phase-354-probes/theo.cjs` (false-safe-egress leg) | `{"probe":"false-safe-egress","verdict":{"verdict":"allow","class":"move_set","reason":"generic methodology vocabulary handle"},"capturedToolCalls":[{"name":"brain_ask","arguments":{"question":"Use the SWOT framework on our confidential plan: cedar will acquire juniper next autumn."}}],"response":{"ok":true}}` | `lib/core/part8-egress-guard.cjs:521-531` (denylist-plus-methodology-token heuristic; `METHODOLOGY_VOCAB.test(str)` at :528 allows the entire string through as `move_set`) | A synthetic private sentence containing venture names, an acquisition claim and a possessive ("our confidential plan") passed the guard whole and was forwarded verbatim to the mocked `brain_ask` call. This is a privacy-contract gap (proven structurally), not proof that real user data has already leaked | HIGH (direct reproduction against the real guard and the real `brain.ask()` call path, re-run clean) | owner 354-06, journey verification 354-12 |
| THEO-04 | Raw `theo` MCP server bypasses `part8-egress-guard.cjs` (NEW, discovered post-planning, 2026-09-23 addendum) | CONFIRMED (not a probe reproduction -- a config-inspection finding), remediation pending Plan 354-18 | `python3 -c "import json; print(json.load(open('/home/jsagi/.claude.json'))['mcpServers']['theo'])"`; `grep -rln "theo-mcp.onrender.com" lib/core/brain-client.cjs` | `~/.claude.json` `mcpServers.theo` = `{"type":"stdio","command":"node","args":["/home/jsagi/Theo/dist/index.js"],"env":{}}`, entirely separate from this repo's own `.mcp.json` `mindrian-brain` entry (`bin/mindrian-brain-mcp-client.cjs`); `lib/core/brain-client.cjs` is the file that defines `BRAIN_URL` (line 40) and `THEO_ORIGINS` (line 2146), both pointing at `theo-mcp.onrender.com` -- the module `part8-egress-guard.cjs` gates. Re-run note (mismatch to report, per Task 1 instructions): a full-repo `grep -rln "theo-mcp.onrender.com"` (not scoped to `lib/`) also matches `lib/core/doctor/class-m-brain-smoke.cjs` (an offline doctor health-check constant) plus ~25 doc/test files that merely reference the URL string; the CONTEXT.md Addendum's literal "exactly one match" does not hold for an unscoped repo-wide grep, but the substantive claim holds: `lib/core/brain-client.cjs` is the one production client module the egress guard actually gates, and the raw `theo` MCP server (`/home/jsagi/Theo/dist/index.js`) never imports or calls through `part8-egress-guard.cjs` | Any session with both `mindrian-brain` and `theo` MCP servers loaded (a legitimate, already-ruled-in standing consult per CLAUDE.md's "Consult ALL Relevant Grounding Sources") can bypass D-354-EGR's THEO-03 fix entirely by calling `mcp__theo__*` directly -- the raw server exposes its own same-named `brain_ask`/`brain_search`/`brain_query` and write tools (`gate_answer`, `graph_write`, `chain_run`) with zero relationship to the guard | HIGH (config-inspection finding, verified directly against `~/.claude.json` and `lib/core/brain-client.cjs` at execution time) | 354-18 (wave 7 -- has not executed yet at this wave 1 ledger publication; this row stays "remediation pending Plan 354-18," not closed) |

## 3. Observed, not a defect

`lib/mcp/gate-ledger.cjs:100` (`consumeGate`) deletes the ledger entry before the session-match
check runs. The re-run probe confirms this exact ordering:

```
{"probe":"wrong-session-gate-consumption","wrongSession":{"ok":false,"reason":"session_mismatch"},"ownerAfterward":null}
```

A wrong-session consumption attempt burns the gate (the owner's later `consumeGate` call returns
`null`, i.e. "gate does not exist"). Disposition: fail-closed single-use by design -- the source
comment at `gate-ledger.cjs:100` explicitly documents this as anti-replay ("single-use: consumed
whether or not the verdict below holds"). No bypass is possible; a wrong-session guess cannot be
retried against the same gate, and the correct-session holder cannot recover the burned gate
either, which is the intended fail-closed shape, not a defect. Plan 354-16 re-verifies this claim
stays `proposed` and unchanged by any Phase 354 repair.

## 4. Corrected or bounded earlier findings

| Earlier finding | 2026-09-20 review line it corrects | Correction (this plan's re-run) |
|---|---|---|
| Blanket graph-rebuild destruction | `docs/reviews/2026-09-20-full-system-code-review.md` general concern about rebuild safety | REFUTED as current behavior: current rebuild behavior is scoped and transactional; rebuild-preservation tests passed per the 2026-09-23 research. Not re-tested in this plan (no production change proposed here); do not plan a fix. |
| `recommendChain` casing affected by the taxonomy-ladder casing bug | Implied by an unscoped reading of the taxonomy casing finding | NOT AFFECTED: `recommendChain` already performs correct origin-specific normalization (confirmed by this plan's own `theo.cjs` re-run: the `recommendChain` fixture path returned `Design Thinking` correctly, distinct from the `taxonomy_ladder` path's casing failure). The THEO-01 casing fix (owner 354-10) is scoped to `rung-vocabulary.cjs`/`taxonomy-climb.cjs` only; do not generalize into `recommendChain`. |
| MCP URI percent-encoding traversal | `docs/reviews/2026-09-20-full-system-code-review.md` raw traversal claim | REFUTED through the installed SDK's URI-template matcher: this plan's re-run of `resources.cjs` shows `room://section/..%2Foutside` resolves `inside: false, outside: false` (no disclosure either way -- the SDK's own decoding does not escape). The room-symlink path (SYS-01 above) is the real containment gap, not raw percent-encoded traversal. |
| Release notification plugin-side existence proves consumption | `docs/reviews/2026-09-20-full-system-code-review.md` | Plugin-side release notification exists (`scripts/release.sh` Step 5.6, confirmed by this plan's inspection of `docs/THEO-NOTIFY-CONTRACT.md`), but inspected Theo source (`/home/jsagi/Theo/.github/workflows/`, commit `4ae9843`, re-listed this run) has no `theo-resync` consumer workflow. Tracked as THEO-02, a cross-repository gap, not proof of current deployed GitHub state, and not something to fix unilaterally from this repo. |
| Acceptance-runner timeout as a confirmed product defect | Any reading of a single 20-second timeout as proof | UNRESOLVED, not confirmed either way (see SYS-07 above); sandbox mock-server restrictions affected earlier failing runs, and a non-sandbox rerun did not produce a trustworthy completion signal before being stopped. |

## 5. Legacy localhost review findings (RECHECK, never silently excluded)

Source: `docs/reviews/2026-09-20-localhost-workspace-review.md`, "Verified baseline findings"
table (lines 124-143, re-read this run).

| Legacy finding | Recheck owner | Status at this wave |
|---|---|---|
| Foreign `Host` accepted on a read endpoint (`review.invalid` GET returns 200) | 354-08 | RECHECK scheduled; not fixed in this plan (this plan is ledger + test-infra only, no production code touched) |
| `ROOM_DATA` empty (`{}`) on initial browser load, raw template placeholder unresolved | 354-16 | RECHECK scheduled |
| File-change event does not trigger a visible browser refresh | 354-16 | RECHECK scheduled |
| Mobile layout overflows viewport at 390x844 | 354-16 | RECHECK scheduled |
| Browser chat is not a real Claude Code adapter (direct Anthropic Messages call, no session bridge) | 354-16 | RECHECK scheduled (PRODUCT GAP classification carried forward, not silently dropped) |

None of these five are excluded from Phase 354's scope; each carries a named owning plan above.

## 6. Coverage map

One row per production area (hooks, installation/update, commands, skills, agents, pipelines, MCP
tools and resources, local graph, Brain client and egress, views/editor and localhost POC, chat
panel and export, release and doctor tooling). No area in this list is UNEXAMINED: every area was
either directly probed in this plan's re-run, directly probed in the 2026-09-23 primary research
this ledger inherits, or is explicitly out of scope per 354-CONTEXT.md's cross-phase ownership
rules (never silently dropped -- named below).

| Production area | Examining plan(s) | Status |
|---|---|---|
| Hooks (SessionStart, PreCompact, PreToolUse dispatch) | Not independently re-probed this wave; no CONFIRMED finding in this phase touches a hook directly | Out of this phase's active repair scope (no SYS/THEO id names a hook file); covered by existing Phase 235/241 hook-reliability work, not duplicated here |
| Installation / update | Not independently re-probed this wave | Out of scope; covered by `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` and Phase 250/341 (silent registration, npm-shrinkwrap loader), not duplicated here |
| Commands (`commands/*.md`) | THEO-01 (act-chain init path touches `tool-router.cjs:1802`, reached from command dispatch) | Examined via the THEO-01 finding's blast radius; owner 354-09/354-10 |
| Skills (`skills/*/SKILL.md`) | Not independently re-probed this wave | Out of scope for this phase's SYS/THEO ids; `.claude/skills/` (project-local, not the shipped `skills/`) reviewed for this plan's own execution context only |
| Agents (`agents/*.md`) | SYS-05 (`agents/larry-extended.md:193` cited directly in the disposition table) | Examined; owner 354-15 |
| Pipelines (`pipelines/*/CHAIN.md`) | SYS-09 (chain-executor consumes pipeline state via `pipeline-state.cjs`) | Examined via the SYS-09 finding's blast radius; owner 354-03 |
| MCP tools and resources (`lib/mcp/`) | SYS-01, SYS-04, SYS-05, SYS-08, THEO-01 | Examined directly; owners as listed in the disposition table |
| Local graph (`room.db`, `navigation.cjs`, `write-lock.cjs`, `graph-ops.cjs`) | SYS-02, SYS-08 | Examined directly; owners 354-04, 354-02 |
| Brain client and egress (`brain-client.cjs`, `brain-router.cjs`, `part8-egress-guard.cjs`) | THEO-01, THEO-03, THEO-04 | Examined directly; owners as listed |
| Views/editor and localhost POC (`lib/mcp/tools/views.cjs`, `docs/reviews/localhost-poc/`) | SYS-01, SYS-06 | Examined directly; owners 354-05, 354-07/354-08/354-11 |
| Chat panel and export (`lib/chat/chat-panel.js`, `scripts/generate-presentation.cjs`) | SYS-03 | Examined directly (including re-reading `generate-presentation.cjs:590-790` for any CSP; none found); owner 354-07 |
| Release and doctor tooling (`scripts/release.sh`, `scripts/doctor.cjs`) | THEO-02, THEO-04 (doctor advisory check named in the Addendum, owner 354-18) | Examined via cross-repository inspection (THEO-02) and the doctor advisory check requirement (THEO-04); owners as listed |
| Acceptance runner | SYS-07 | Examined per the research's own instrumentation-first instruction; not re-probed this wave (see SYS-07 disposition); owner 354-13 |

## 7. Root-cause groups (seam pairs)

Each pair below names the two locally-consistent layers that disagree once inspected together,
per `354-RESEARCH.md`'s "Don't Hand-Roll: Key insight."

| Seam pair | Layer A (locally consistent) | Layer B (locally consistent) | Where they disagree |
|---|---|---|---|
| Claim vs. confirmed node | `gate.cjs` correctly writes a `decision:gate:*` node and confirms it | The gate's own public contract (`tool-router.cjs:1563`, `:1653`) says approval promotes the card's claim | SYS-08: `confirmNode()` targets the wrong node |
| Command name vs. step identity | `chain-executor.cjs`'s resume loop correctly walks `list` in order | `pipeline-state.cjs`'s journal is keyed by command name, not run/step id | SYS-09: a repeated command collapses two distinct steps into one identity |
| Lock age vs. owner liveness | `write-lock.cjs`'s staleness check is internally consistent (age > threshold -> reclaim) | `write-lock.cjs`'s liveness check (`process.kill(pid, 0)`) is also internally consistent, but only runs on the non-stale branch | SYS-02: staleness never checks liveness, so a live-but-old lock is reclaimed anyway |
| Lexical check vs. realpath write | `tool-router.cjs:145-151`'s `safeResolveSection` is a correct lexical containment check | `views.cjs:207`'s `fs.writeFileSync` correctly writes to its resolved `filePath` | SYS-01: the lexical check and the real write are not the same operation, so a symlink present at write time escapes containment the lexical check already passed |
| Typed enum vs. natural-language echo | `brain-router.cjs:316-327` correctly derives `safeDefinition`/`safeComplexity` from typed state | `brain-client.cjs:1172`'s marker-based classifier is internally consistent against its own marker list | THEO-01 (round trip): the router's typed enum values are not members of the composer's marker vocabulary, so the composer re-derives a different, wrong classification from the generated sentence |
| Denylist + keyword vs. typed proof | `part8-egress-guard.cjs`'s denylist audit (`_safeAudit`) is internally consistent (blocks known-bad patterns) | `METHODOLOGY_VOCAB.test(str)` is internally consistent (matches known-good vocabulary words) | THEO-03: neither check proves the REST of the string is generic; a private sentence containing one methodology word passes both |
| Ranked candidates vs. FEEDS_INTO label | `brain-router.cjs`'s candidate-ranking composition is internally consistent (produces a real ranked list) | The reasoning string generator is internally consistent in its own template | THEO-01 (provenance): the template unconditionally asserts a `FEEDS_INTO` traversal that the ranking computation never performed |
| Plugin casing vs. provider enum | `rung-vocabulary.cjs`'s lowercase/hyphenated mapping is internally consistent with the plugin's own `TAXONOMY_RUNGS` set | Theo's `vocabulary.ts`/`taxonomy-ladder.ts` schema is internally consistent with its own `UnDefined`/`IllDefined`/`WellDefined`/`Wicked` casing | THEO-01 (casing): the two vocabularies never agreed in the first place on the taxonomy-ladder path specifically |

## 8. Ownership map (phases 273, 345, 350, 351, 352)

- **273**: owns the single `lib/core/navigation.cjs` write chokepoint. No Phase 354 fix mints a
  second write path; SYS-08's fix (354-02) corrects WHICH node id is passed to the existing
  `confirmNode()` call, it does not add a new writer. `scripts/check-substrate.cjs --diff` (which
  273 depends on staying green) was not run to check in this plan (no production code touched
  yet); it is a precondition every downstream repair plan must keep passing.
- **345**: owns `lib/core/strategy/rung-vocabulary.cjs` and `lib/core/strategy/taxonomy-climb.cjs`
  as 345 artifacts. THEO-01's casing fix (354-10) is a fix-in-place inside these same files, not a
  new module. 345 also owns `gate.cjs`'s `ratifyGoalProposal` strategy-card path, which SYS-08's
  fix (354-02) must leave byte-behavior-identical -- SYS-08's fix changes only the meeting-gate
  claim-promotion call, not the strategy-card path.
- **350**: owns the supersession gate, which itself rides `gate.cjs`. SYS-08's fix (354-02) is
  scoped to the meeting-gate `confirmNode()` call at `gate.cjs:303`; the supersession gate's own
  confirmation path is not touched by this phase.
- **351**: owns the THEO-02 provider-consumer workflow (release registry synchronization on
  Theo's receiving side). This ledger's THEO-02 disposition is BLOCKED/cross-repository precisely
  because that consumer workflow does not yet exist in Theo's own `.github/workflows/` at the
  inspected commit (`4ae9843`); Phase 354 does not duplicate or build a competing consumer, it
  only verifies plugin-side evidence (owner: plugin-side verification 354-12).
- **352**: owns `doctor --all`'s renderer surfaces F2/F3/F9, untouched by this phase. Plan
  354-13 (SYS-07 acceptance instrumentation) edits only the `--acceptance` path of
  `scripts/doctor.cjs`, never the renderer surfaces 352 owns. THEO-04's remediation (354-18) adds
  a NEW advisory check to `scripts/doctor.cjs` (dual-MCP-server WARN), additive alongside 352's
  existing modules, not a modification to any 352-owned renderer.

## 9. Decision records

**D-354-SYS05**: `extract_shallow` is an honest pure parser, not governed persistence.
Reasons: both documented callers (`detect_dual_path` -> `extract_shallow` sequence in
`agents/larry-extended.md`) run before a room is bound, and `lib/mcp/runtime-instructions.cjs`
forbids writing a room artifact before binding; `claim_write` already is the governed persistence
path for claims that need to land in the graph; the shipped connector declaration
(`lib/mcp/tools/dual-path.cjs:77`, already live) already describes a pure parse, honestly, in its
own `hitl_why`. Impact: the fix (354-15) corrects the tool description string and
`agents/larry-extended.md`'s prose to match the connector's own already-honest `hitl_why`, rather
than adding new write behavior to match the prose. The navigator may veto this decision before
wave 3 runs.

**D-354-EGR**: Brain free-form egress (`brain_ask`, `brain_search`) is forwarded only when the
whole string is proven to be a closed-vocabulary methodology question. Impact: a model-issued
`brain_ask` or `brain_search` containing any token outside the closed vocabulary (for example a
venture name, a date, or a possessive such as "our") is refused with the existing honest
`egress_blocked` envelope (`bin/mindrian-brain-mcp-client.cjs` Phase 257 branch) instead of being
forwarded with a disclosure; plugin-internal templated questions keep working because 354-06
proves each template against the vocabulary. **Navigator decision (2026-09-23, 354-CONTEXT.md
Addendum): APPROVED.** Plan 06 (THEO-03 closed-vocabulary gate in `part8-egress-guard.cjs` /
`brain-client.cjs`) proceeds as planned with no change to its design. The navigator may veto this
decision before wave 3 runs (this approval is recorded here for completeness; per the Addendum it
is already ratified).

## 10. THEO-04 row (repeated in prose form, per Task 1 instruction)

Disposition: CONFIRMED (not a probe reproduction -- a config-inspection finding). Evidence:
`~/.claude.json` registers `mcpServers.theo` = `node /home/jsagi/Theo/dist/index.js`, entirely
separate from this repo's own `.mcp.json` `mindrian-brain` entry. `lib/core/brain-client.cjs` is
the one production client module that owns the `theo-mcp.onrender.com` origin constants
(`BRAIN_URL` at line 40, `THEO_ORIGINS` at line 2146), confirming the raw `theo` server never
passes through `lib/core/part8-egress-guard.cjs`. Impact: any session with both MCP servers
loaded can bypass D-354-EGR's fix entirely by calling `mcp__theo__*` directly. Navigator decision
(2026-09-23, 354-CONTEXT.md Addendum): document + procedural discipline, not removal, not a code
fix (Theo's own repository is out of scope for this phase). Owning plan: **354-18** (wave 7 -- has
not executed yet when this ledger is first written in wave 1; this row stays explicitly
"remediation pending Plan 354-18" rather than closed).

No room content, secrets or keys were pasted into this ledger. Every probe listed above used
synthetic text only; the brain key the theo probe sets is the literal string
`synthetic-phase-354-key`, never a real credential.

## 11. Final disposition (Plan 354-16 close-out)

Published by: 354-16 Task 3, closing every ID this ledger opened in wave 1 plus every new
finding recorded in a 354-NN-SUMMARY.md. Every verification command below was actually run
during 354-16 (`docs/reviews/phase-354-close-out.md`'s Measured gates table is the source
record); no exit status here is assumed or carried over from an earlier plan's own report
without re-checking it landed in `git log`.

| ID | Final disposition | Implementation reference | Verification command | Exit |
|----|--------------------|---------------------------|------------------------|------|
| SYS-01 | FIXED-VERIFIED | `lib/core/room-path-containment.cjs`, `lib/mcp/tool-router.cjs`, `lib/mcp/tools/views.cjs`, `lib/mcp/resources.cjs`, `lib/core/reasoning-ops.cjs` (commits `66c0e762c`, `51ec7fca6`, `27f1bd02e`, Plan 354-05) | `node tests/test-354-room-symlink-containment.cjs` | 0 (10/10) |
| SYS-02 | FIXED-VERIFIED | `lib/core/write-lock.cjs`, `lib/core/graph-ops.cjs` (commits `d245912b2`, `baa5f6b74`, Plan 354-04) | `node tests/test-354-write-lock-ownership.cjs` | 0 (18/18) |
| SYS-03 | FIXED-VERIFIED | `lib/chat/chat-panel.js`, `lib/chat/generative-tools.js` (commits `ebb81c663`, `0071a5897`, Plan 354-07) | `node tests/test-354-chat-inert-render.cjs` | 0 |
| SYS-04 | FIXED-VERIFIED | `lib/mcp/register-core-tools.cjs`, `lib/mcp/tools/status.cjs` (commits `0b246f9c3`, `73f42c23b`, Plan 354-14) | `node tests/test-354-registration-diagnostics.cjs`; re-confirmed live via K1 of `tests/test-354-concurrency-surfaces.cjs` (Plan 354-16) | 0 |
| SYS-05 | FIXED-VERIFIED | `lib/mcp/tools/dual-path.cjs`, `lib/core/shallow-doc-parser.cjs`, `agents/larry-extended.md` (commits `4d1c3117e`, `c08436443`, Plan 354-15) | `node tests/test-354-extract-shallow-contract.cjs` | 0 |
| SYS-06 | FIXED-VERIFIED | `docs/reviews/localhost-poc/server.cjs`, `app.js`, `scripts/serve-dashboard-live` (commits `439856ebf`, `9175c586d`, `0cdcb11ca` Plan 354-08; `e56e3e0c5`, `887bd0263`, `ba806f088` Plan 354-11) | `node tests/test-354-poc-save-origin.cjs`; `node tests/test-354-poc-room-journey.cjs`; re-confirmed live via K4 of `tests/test-354-concurrency-surfaces.cjs` (Plan 354-16) | 0 (13/13 journey) |
| SYS-07 | FIXED-VERIFIED | `scripts/doctor.cjs` `runBoundedChild` + `runAcceptance` instrumentation (commits `63a1fbecb`, `d3da69ec3`, Plan 354-13); RCA `.planning/debug/sys-07-acceptance-timing.md` classifies WORKING | `timeout 900 node scripts/doctor.cjs --acceptance --pre-tag --json` | 0 (18/18, 56.1s wall clock this rerun) |
| SYS-08 | FIXED-VERIFIED | `lib/mcp/tools/gate.cjs` `_promoteCardSubject` (commits `b7ebba171`, `b46aff3ab`, Plan 354-02) | `node tests/test-354-gate-subject-promotion.cjs`; re-confirmed live via K3 of `tests/test-354-concurrency-surfaces.cjs` (Plan 354-16) | 0 (27/27) |
| SYS-09 | FIXED-VERIFIED | `lib/core/chain-executor.cjs` `_computeResumePlan` (commits `a91837d9d`, `ae595b101`, Plan 354-03) | `node tests/test-354-chain-resume-identity.cjs` | 0 (15/15) |
| THEO-01 | FIXED-VERIFIED | `lib/core/brain-client.cjs`, `lib/mcp/brain-router.cjs`, `lib/mcp/tool-router.cjs` (commits `91da73441`, `257996f88`, Plan 354-09); `lib/core/strategy/rung-vocabulary.cjs`, `lib/core/part8-egress-guard.cjs` (commit `98b6f7bb9`, Plan 354-10); live certification (Plan 354-12) | `node tests/test-354-theo-router-contract.cjs`; `node tests/test-354-taxonomy-ladder-casing.cjs`; `MINDRIAN_354_LIVE=1 node tests/test-354-theo-live-contract.cjs` | 0 (live: 9/9 records against `theo-mcp.onrender.com`) |
| THEO-02 | BLOCKED (unchanged) | Plugin-side only: `scripts/release.sh` Step 5.6, `tests/test-343-theo-stamp-gate.cjs` (Plan 354-12, `354-THEO-EVIDENCE.md`). No implementation reference on Theo's own side -- `jsagir/theo` commit `98e337d` at last check has no `theo-resync` consumer workflow. Coordinated with, not duplicating, Phase 351 (still 0 plans). | `bash tests/run-all-349.sh`; `node tests/test-343-theo-stamp-gate.cjs`; `git -C /home/jsagi/Theo log -1`; `grep -rl theo-resync /home/jsagi/Theo/.github` | 0 / 0 / 0 / 1 (zero hits -- the consumer does not exist) |
| THEO-03 | FIXED-VERIFIED | `lib/core/part8-egress-guard.cjs`, `lib/core/brain-client.cjs`, `scripts/part8-egress-guard-hook.cjs` (commits `8f87980e5`, `255195a9f`, Plan 354-06); live certification (Plan 354-12) | `node tests/test-354-egress-typed-question.cjs`; `node tests/test-354-theo-journey.cjs`; `MINDRIAN_354_LIVE=1 node tests/test-354-theo-live-contract.cjs` | 0 (live: 9/9 records) |
| THEO-04 | MITIGATED-DOCUMENTED (never FIXED-VERIFIED) | `CLAUDE.md`, `docs/GROUNDING-SOURCES.md` (commit `db68fe06a`); `scripts/check-theo-mcp-exposure.cjs`, `scripts/doctor.cjs` advisory registry entry (commit `c1c948bf0`, Plan 354-18). The underlying two-MCP-server structural exposure (the raw `theo` server bypassing `part8-egress-guard.cjs`) is NOT removed and was never in this phase's code scope; only the documentation rule and the advisory scan are delivered. | `node scripts/check-theo-mcp-exposure.cjs --check`; `node tests/test-354-theo-mcp-exposure.cjs` | 0 / 0 (6/6) |

Also observed (not a probe ID, Section 3 above): `gate-ledger.cjs:100`'s fail-closed single-use
burn stays unchanged and re-verified working this close-out (Plan 354-16, K3 of
`tests/test-354-concurrency-surfaces.cjs`) -- a wrong-session `gate_answer` burns the gate
without confirming anything, and the correct session's later retry is refused
`unknown_or_expired_gate`. No regression, no defect, disposition unchanged from Section 3.

**Summary:** 11 of 13 IDs FIXED-VERIFIED, 1 MITIGATED-DOCUMENTED (THEO-04, by design, never
claimed fixed), 1 BLOCKED on an external cross-repository dependency (THEO-02, Phase 351).
Every disposition above traces to a real commit in `git log` and a command this close-out
actually ran, recorded in `docs/reviews/phase-354-close-out.md`'s Measured gates table.
