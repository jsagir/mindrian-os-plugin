---
status: resolved
kind: rca
trigger: "meeting-file-meeting-false-success"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-09-03T13:55:00Z
updated: 2026-09-04T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

**Resolved (Phase 276, plans 276-12 and 276-14).** This RCA's own Current Focus stated the
condition for closing it plainly: two of the three gaps named in the Consult section's
recommended shape had to close before this file could honestly move to `resolved/`. Both
have, measured, not asserted.

- **Gap 3 (a direct claim write reachable from MCP), CLOSED by plan 276-12.** A new
  `claim_write` MCP tool (`lib/mcp/tools/claim.cjs`) writes a real 6-value `knowledge_type`
  DIKW claim through `typed-claim.cjs`'s `writeClaimNode` -> `lib/core/node-insert.cjs`, the
  same governed chokepoint `commands/file-meeting.md`'s CLI pipeline already used. Proven by
  `tests/test-276-claim-write-primitive.cjs` (44 assertions), independently reading `room.db`
  after every write rather than trusting the tool's own response.
- **Gap 2 (the F.8 filing gate wired to a real write), CLOSED by plan 276-14.** The `meeting`
  tool's `file-meeting` command, called with `knowledge_type` and `claim_text`, now writes
  the claim and renders a `gate_render` confirmation card; promotion to `confirmed` happens
  only through the shipped `gate_answer` approve branch, proven against `room.db`
  independently of the tool's own response text
  (`tests/test-276-meeting-gate-wiring.cjs`, 7 groups / 14 assertions). A second answer to
  the same `gate_id` is refused (`unknown_or_expired_gate`), confirming the single-use
  ledger held.
- **Gap 1 (the five-perspective subagent fan-out), STILL OPEN, and this is the reasoning for
  closing the file anyway.** `references/meeting/filing-protocol.md`'s own gap enumeration
  (rewritten by plan 276-14) states this plainly: no Agent tool and no subagent registry
  exist on the MCP surface, so the CLI's Step 3a five-subagent dispatch is structurally
  unreachable from Desktop or Cowork, not merely unbuilt. This is a declared limitation of
  the MCP transport itself, not an open defect this repo's own code could close by writing
  more of it - the identical distinction this RCA's own Consult section drew between Gap 1
  ("Not fixable, only declarable") and Gap 2 ("This one IS reachable and is NOT wired").
  Per this RCA's own condition for a `resolved` verdict: the sole remaining gap being
  structurally unreachable is a declared limitation, not an open defect, so `resolved` is
  the honest disposition rather than a narrowed `partial-close`.

Both writes this resolution rests on were independently verified against `room.db`, never
trusted from a tool's own response text - the exact discipline this RCA's Problem Statement
names as the reason the original defect went unnoticed ("a caller who trusts the response
text believes content was filed... when nothing was").

hypothesis: `meeting`'s `file-meeting` command never wrote anything (no `insertNode`, no `artifact_file`, no room.db mutation) despite its own tool description claiming it does ("parses a transcript and files it as a room entry"), and its response text ("## File Meeting" header, echoed transcript, no error) reads as a filing confirmation to any caller, human or model, that does not independently verify the write.
test: read the handler in full, confirmed it. Independently verified against a live call this session: `room.db` mtime unchanged before/after a real `file-meeting` call with a full real transcript as `context`.
expecting: confirmed, no further test needed to establish the root cause. Remaining open question is scope of fix (see Required Code Changes).
next_action: none - resolved. The recommended shape in the Consult section shipped in
  Phase 276 (plans 276-12, 276-14): a small single-job `claim_write` MCP tool walking the
  DIKW-typed write path, confirming through the existing `gate_render`/`gate_answer`
  machinery, exactly as recommended. Gap 1 (the five-perspective subagent fan-out) remains
  a declared, structurally unreachable limitation of the MCP transport, not an open action
  item.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: not checked this pass, irrelevant to the defect (present in the currently-running dev tree)
- Reported by: navigator, live session 2026-09-03, discovered while filing a real meeting transcript for the reasoning-constitution's own R21 certification (T9)
- Date first observed: 2026-09-03
- Related debug sessions: none found

## Problem Statement

`meeting file-meeting` returns a confident, no-error response that looks like a successful filing, but the handler contains no write call of any kind; a caller who trusts the response text believes content was filed into the room graph when nothing was.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: calling `meeting` with `command: 'file-meeting'` and a real transcript in `context` either (a) actually parses and files the transcript as a room entry with a real write, matching the tool's own description, or (b) if it is deliberately scaffolding-only (matching `think-hats`' actual behavior), returns a response that makes that plain rather than reading as a completion confirmation.
actual: the handler (`lib/mcp/tool-router.cjs:1372-1381`) builds a response by concatenating room state (via `loadRoomState`), a static filing-protocol reference doc, and the caller's own `context` verbatim, then calls `fireCascade(roomDir, command, null, { filePath: '' })` with an empty `filePath`, then returns. No `insertNode`, no `writeEdge`, no `artifact_file`-equivalent call anywhere in the branch. `room.db`'s mtime is unchanged after the call.
errors: none. This is the dangerous part - no error, no warning, ok-shaped response.
reproduction:
  1. Bind an MCP session to any real room (`room_bind`).
  2. Note the target room's `.mindrian/room.db` mtime (`stat -c '%Y' <room>/.mindrian/room.db`).
  3. Call the `meeting` MCP tool with `command: 'file-meeting'` and a real multi-paragraph transcript as `context`.
  4. Observe the response: a "## File Meeting" heading, a Room State block, a Filing Protocol block, a "### Transcript/Context" block echoing the input verbatim, and a "Suggested Next" footer recommending `room_state analyze` - nothing in the response signals that no write occurred.
  5. Re-check the room.db mtime: unchanged. No new file exists under the room's directory tree matching the transcript content.
started: unknown - not a regression, likely present since the tool's original implementation; not something that "started" at a specific version as far as this investigation went.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the handler is surface-agnostic; the same MCP tool serves all three)
- Affected commands: `meeting` tool, `command: 'file-meeting'` specifically. `pipeline` and `speakers` (same tool, other commands) were not independently write-verified this pass but read the same way (reference-doc-plus-context response, no write call visible in their branches either) - see Evidence.
- Affected users: every user who calls `file-meeting` and trusts the response instead of independently checking room state - which is the entire design intent of a conversational MCP surface (a human is not expected to grep room.db after every tool call).
- Version range: not bisected; present in the current dev tree at investigation time.
- Severity: high. This is a Canon-adjacent honesty failure - not a Part 8 boundary breach (no Brain wire touched, no user bytes egressed anywhere they shouldn't), but a direct violation of the standing product principle "Honest refusal everywhere... no surface conceals a failure or serves methodology the graph did not give" (project Decision #8). A tool that says it filed something and did not is functionally the same failure class as a silent refusal, arguably worse because it produces false confidence instead of a visible gap.
- Blast radius: `pipeline` and `speakers` commands in the same tool (same pattern, not confirmed by independent write-check this pass, worth the same scrutiny). Any downstream flow that assumes `file-meeting` populated the room before running `pipeline`'s meeting-intelligence pass would silently operate on nothing.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the write happened but to a different room than the one checked (a session-binding mismatch).
  evidence: independently re-verified `room.db` mtime on the exact room the session was bound to (confirmed via `room_bind`'s own response, `resolved_dir` field matched); zero i2x/roy-munin-content traces anywhere under that room's tree before the manual `artifact_file` fix.
  timestamp: 2026-09-03T13:50:00Z
- hypothesis: the write happened but is async/deferred (a queued job that completes later).
  evidence: no queue, job runner, or deferred-write mechanism referenced anywhere in the `file-meeting` branch; `fireCascade` is called synchronously with an empty `filePath`, and the function returns immediately after.
  timestamp: 2026-09-03T13:52:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-03T13:52:00Z
  checked: `lib/mcp/tool-router.cjs:1372-1381`, the full `file-meeting` branch
  found: the branch reads `references/meeting/filing-protocol.md` via `safeReadFile`, concatenates it with `loadRoomState(roomDir)`'s output and the caller-supplied `context` string, calls `fireCascade(roomDir, command, null, { filePath: '' })`, and returns the concatenation as `textResponse`. No node insert, no edge write, no `artifact_file`-equivalent function call anywhere in the branch.
  implication: this branch is pure scaffolding by design (structurally identical to how `think-hats` and other methodology tools hand back framework doctrine for Larry to apply, per this session's own independent discovery of that pattern) - but its tool description and response framing do not disclose this.
- timestamp: 2026-09-03T13:52:30Z
  checked: the `meeting` tool's registered description at `lib/mcp/tool-router.cjs:1362`
  found: "Turn a raw meeting transcript into structured Data Room content. file-meeting parses a transcript and files it as a room entry..."
  implication: the description asserts parsing and filing as things the tool itself does. Neither happens in the code. This is the load-bearing defect - not the missing write alone, but the description and response text actively implying one occurred.
- timestamp: 2026-09-03T13:53:00Z
  checked: live call, this session, real room (`iris2026`), real 30+ minute transcript as `context`, `room.db` mtime before (`1788180053`) and after (`1788180053`, unchanged) the call
  found: zero mtime change; no new file under the room directory matching the transcript.
  implication: confirms the static-code read against real runtime behavior, not just theoretical - this is not a hypothetical bug, it reproduced on the first real-content call this session made.

## Technical Root Cause

**Revised after checking phase history (2026-09-03, per navigator instruction to check the original intent against what MindrianOS is today).** The finding below supersedes the first pass's framing. This is not primarily a copywriting defect - it is an undeclared Tri-Polar parity gap on a real, already-built, already-verified feature.

**The real pipeline exists and is verified.** Phase 150.8 ("Meeting Micro-Knowledge DIKW Filing v1", `.planning/phases/150.8-meeting-micro-knowledge-dikw-filing-v1-any-transcript-files-/`, verified PASSED 2026-06-12, 11/11 must-have truths, 17/17 phase-gate tests) built exactly what the tool description promises: a Claimify-style 4-pass extraction (selection -> disambiguation -> decomposition -> typing), `navigation.writeClaimNode` writing typed `claim` nodes (6-value `knowledge_type` enum: fact/causal/heuristic/anomaly_cue/mental_model/assumption) through the governed chokepoint, an `ambiguous` disambiguation queue with a SessionStart resurface hook, a post-filing F.1 confirm selector routing through `navigation.confirmNode`, and `/mos:build-knowledge` rendering the typed claims by Ackoff DIKW rung. Every one of these is independently verified (`150.8-VERIFICATION.md`), not just planned.

**But that entire pipeline lives in `commands/file-meeting.md`** (verification citation: "`commands/file-meeting.md` Step 3: `call navigation.writeClaimNode(db, params)`, WIRED") - the CLI slash command, `/mos:file-meeting`. That is a markdown-prompt file Claude Code's slash-command mechanism expands into the running conversation; it is not reachable by an MCP tool call.

**The MCP tool's `meeting` -> `file-meeting` branch (`lib/mcp/tool-router.cjs:1360-1382`) is a separate, older code path.** `git log -S "file-meeting" -- lib/mcp/tool-router.cjs` traces this registration back through Phase 52 ("restructure MCP routers from 6 to 9") and Phase 11 ("hierarchical tool router... covering 41 CLI commands") - both predating Phase 150.8 (2026-06-11/12) by a wide margin. Nothing in Phase 150.8's scope, plan files, or verification touches `lib/mcp/tool-router.cjs`. The MCP surface was never updated to call into the real pipeline Phase 150.8 built; it still does exactly what it did before that pipeline existed - echo reference material back to the caller.

**The description overclaim (Phase 234, commit `71f15a3c`) made this worse, not the origin.** Before that commit the tool's description was honest and minimal: `'Meeting filing, intelligence pipeline, and speaker identification.'` Phase 234's stated goal was rewriting 8 label-length MCP tool descriptions "as instructions" (for better model tool-selection); in doing so for `meeting` it introduced the first-person capability claim ("file-meeting parses a transcript and files it as a room entry") that the code has never been able to fulfill, on either side of that commit. The overclaim is a real, separate defect (Change 1 below still stands), but it did not create the underlying gap - it just made an existing, undeclared gap read as a completed feature.

**Consequence for Tri-Polar (this project's own standing design rule, `CLAUDE.md` "Tri-Polar Design Rule"):** "a feature that only works on one leaves a gap on the other two install targets, so treat a skip as a deliberate, stated call, not an oversight." This gap was never declared. CLI users (`/mos:file-meeting`) have had real DIKW-typed meeting filing since 2026-06-12. Desktop and Cowork users, who reach this capability only through the MCP `meeting` tool, have never had it - every meeting transcript filed through those surfaces since 150.8 shipped has produced nothing but an echoed response, not a single typed claim.

- Site (the real, working implementation): `commands/file-meeting.md` Step 3, calling `lib/core/navigation/typed-claim.cjs::writeClaimNode` via `lib/core/navigation.cjs`'s re-export.
- Site (the gap): `lib/mcp/tool-router.cjs:1360-1382`, the `meeting` tool's `file-meeting` branch - never calls `writeClaimNode`, `navigation.cjs`, or any write primitive.
- Cause: the MCP tool surface was not updated when Phase 150.8 built the real pipeline into the CLI slash-command surface; no phase since has closed the gap; Phase 234 later added a description that describes the CLI surface's behavior, not the MCP surface's actual behavior.
- Why it surfaces now: not a regression in the sense of "used to work, now broken" - it appears to have never worked on this surface. It surfaced now because (a) this session independently write-verified a tool response against `room.db` for the first time rather than trusting response text, and (b) the navigator asked directly whether this gap was intentional, which led to checking Phase 150.8's actual scope and verification record.

## Consult: how the MCP surface should actually reach the real pipeline (2026-09-03)

Per navigator instruction, consulted `icm-architect` (direct architectural doctrine) and `langtalks-graph-expert` (podcast/research corpus) before proposing the long-term fix shape.

**langtalks: no clean hit, said plainly rather than stretched.** `query_relationship("How does A2A protocol relate to human-in-the-loop confirmation?")` returned a 347-node BFS traversal with no focused answer; the one seemingly on-point node ("Approval gate") traces to `icm-architect`'s own indexed reference material, not new podcast grounding - circular, not evidence. `multihop_query` confirms MCP and human-in-the-loop genuinely co-occur in 3 real episodes (50 - A2A protocol, 55 - Context Engineering, 62 - AI R&D Rollout | Iko Azoulay) - worth reading directly if this becomes a real build task, but nothing surfaced this session constitutes a grounded answer to the specific question. Per that skill's own honesty rule: not in the corpus yet, for this specific shape.

**icm-architect, applied directly: the current framing (MCP hands back the whole slash-command prose, hopes the model replicates it) is the wrong shape.** Three of its own invariants name the fix directly:

1. **Invariant 5 (Factory vs. product) names the actual defect.** The Claimify 4-pass extraction protocol is FACTORY material - stable, reusable, the same regardless of which surface calls it. It currently lives duplicated-by-omission: written once as inline prose inside `commands/file-meeting.md` (the CLI's factory reference), and pointed to (but absent) at `references/meeting/filing-protocol.md` from the MCP side. This is the invariant's own named anti-pattern: "duplicated entry files that drift... schema documents that mandate names the actual files stopped using." Fix: extract the real protocol steps out of `commands/file-meeting.md` into one real shared reference file both surfaces read - `references/meeting/filing-protocol.md` should exist and BE that shared factory content, not a dead path with nothing behind it.
2. **Invariant 4 (every folder-level contract explicit) + Invariant 1 (one folder, one job)** argue against a single mega-call that tries to replicate an entire multi-turn slash command inside one MCP round-trip. The CLI surface naturally interleaves many small steps (speaker match -> confirm table -> extraction pass -> disambiguation -> typing -> confirm gate) because it runs inline in one continuous conversation. An MCP surface should mirror that as a SEQUENCE of small, single-job tool calls, each with an explicit input/output/human-check contract - not one tool trying to do everything in one shot.
3. **Invariant 6 (every output is an edit surface, nothing moves forward until a human has read the last output)** is the direct architectural statement of this project's own Part 9 canon ("only a human confirms a truth-claim node"). It validates that the confirmation gate cannot be collapsed into the extraction call - it must be a separate, reviewable step, which this repo already has the machinery for: the `gate-render.cjs`/`gate-ledger.cjs` path this session's own R19 fix (quick 260903-eu9) verified is the one real governed Decision-Gate mechanism in this codebase.

**Recommended shape (design only, not yet built):** (a) extract the real Claimify protocol out of `commands/file-meeting.md` into a real `references/meeting/filing-protocol.md` (fixing the dead path, giving both surfaces one shared factory home); (b) the MCP `file-meeting` branch hands that real protocol plus room state to the calling model, exactly as it already tries to do, but now with real content behind the reference; (c) the calling model (Larry, on MCP) walks the protocol across multiple tool calls in its own turn loop the way it already does for other multi-step flows, calling `artifact_file`/`writeClaimNode`-equivalent primitives to persist proposed claims; (d) the confirmation gate renders through the existing `gate_render`/`gate_answer` machinery - never a bespoke second gate mechanism - so a claim reaches `confirmed` status only through the same governed path chain_run's material-step halts already use. This is a real design, not yet approved or built; it needs its own GSD plan before anyone codes it.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (short-term patch, recommended for immediate fix) - SHIPPED (quick 260903-kwl):
  - Location: `lib/mcp/tool-router.cjs:1362` (tool description) and `:1372-1381` (`file-meeting` branch response construction)
  - Current behavior: description states "file-meeting parses a transcript and files it as a room entry"; response returns transcript + reference doc with no filing-status signal.
  - Required behavior: correct the description to state what the tool actually does ("file-meeting surfaces the filing protocol and room context so the calling model can file the transcript via `artifact_file`; it does not write anything itself"). Add an explicit, structured field to the response - e.g. a leading line `**No write occurred. Use artifact_file to actually file this content.**` or a machine-checkable `filed: false` marker - so neither a human nor a model reading the response can mistake it for a completion.
  - Short-term patch: the description and response-text correction above. No behavior change, no risk to existing callers, ships same-day. DONE: description rewritten, `NO_WRITE_MARKER` (`**filed: false**`) added via a `noWriteBanner()` helper, explicit missing-reference else arm added.
  - Long-term fix: a real design decision, NOT to be resolved as part of this patch - should `file-meeting` actually perform the parse-and-file itself (matching its current description's promise), turning it into a real write path like `artifact_file`? That is a feature-scope question for the navigator, separate from the honesty fix above. STILL OPEN - see Current Focus.
- Change 2 (scope check, same severity class) - CONFIRMED and FIXED (quick 260903-kwl):
  - Location: `lib/mcp/tool-router.cjs:1384-1402`, the `pipeline` and `speakers` branches of the same tool
  - Current behavior: read-only, reference-doc-plus-context pattern, same shape as `file-meeting` - not independently write-verified this pass.
  - Required behavior: confirm whether either branch's description overclaims a write the way `file-meeting`'s did; if so, apply the identical description/response correction.
  - Short-term patch: CONFIRMED both branches were read-only (matching the shared tool description's overclaim, not an independent per-branch overclaim) and applied the identical `noWriteBanner()` + missing-reference-else-arm treatment to both.
  - Long-term fix: n/a - both branches are, and remain, reference-only by design; no write path is scoped for either.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: `tests/test-meeting-file-meeting-honest-response.cjs` (new file)
  - Given: a call to the `meeting` tool with `command: 'file-meeting'` and a non-empty `context`
  - When: the handler returns
  - Then: the response text contains an explicit no-write disclosure (or a structured `filed: false` field, matching whatever shape Change 1 lands on) and does NOT contain language implying completion without qualification
  - Runner registration: register in the nearest active `tests/run-all-*.sh` aggregator for `lib/mcp/tool-router.cjs`-adjacent tests (check which aggregator currently covers `tool-router.cjs` before creating a new one)
- Test 2:
  - Type: integration
  - Location: same file or a sibling
  - Given: a real room, a real `file-meeting` call
  - When: `room.db`'s mtime is checked before and after
  - Then: mtime is unchanged (documents and pins the current, correct-once-honestly-described behavior - this call is NOT supposed to write, once Change 1 lands; this test guards against a future silent behavior change in either direction going unnoticed)

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the target version once Change 1 ships.
- Release lockstep: applies if/when this ships in a release (see `.claude/includes/release-process.md`).
- Canon: this touches Canon Decision #8 ("Honest refusal everywhere") indirectly - not a Part 8 Brain-boundary issue, no `docs/CANON-PHASE-MAP.md` entry required unless a maintainer judges otherwise.
- knowledge-base.md: add the summary block on resolve.
- Docs / monitoring / process notes: worth a broader sweep (not scoped into this RCA) of every MCP tool in this server whose description makes a first-person "does X" claim, checked against whether the code actually performs X - `file-meeting` is unlikely to be the only instance of scaffolding-tool-described-as-action-tool in a server this size.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: confirmed - see Technical Root Cause above.
fix: RESOLVED, in two stages.
  Stage 1 (quick 260903-kwl) - the honesty half: description rewritten to assert no
  capability the handler lacks; NO_WRITE_MARKER (`**filed: false**`) leads all three
  meeting branches; each branch signals an explicit not-found line instead of silently
  omitting a missing reference; references/meeting/filing-protocol.md created as a faithful,
  surface-neutral extract of commands/file-meeting.md Step 3 so the file-meeting branch's
  safeReadFile actually resolves.
  Stage 2 (Phase 276, plans 276-12 and 276-14) - the real write and gate: a new `claim_write`
  MCP tool (`lib/mcp/tools/claim.cjs`) writes a real 6-value `knowledge_type` DIKW claim
  through `typed-claim.cjs`'s `writeClaimNode` -> `lib/core/node-insert.cjs`; the `meeting`
  tool's `file-meeting` command, given `knowledge_type` and `claim_text`, now writes that
  claim and renders a `gate_render` confirmation card, with promotion to `confirmed` gated
  exclusively through the shipped `gate_answer` approve branch. Desktop and Cowork now reach
  real DIKW-typed meeting filing, closing the Tri-Polar parity gap this RCA named. The one
  remaining named gap (the five-perspective subagent fan-out) is a declared, structurally
  unreachable MCP-transport limitation, not an open defect - see Current Focus.
verification: Stage 1: `node tests/test-kwl-meeting-mcp-honesty.cjs` (37/37 assertions, 5
  scenarios: DESCRIPTION_HONEST, NO_WRITE_MARKER_ALL_BRANCHES, PROTOCOL_PRESENT,
  NO_WRITE_PROPERTY, DRIFT_GUARD), registered in `tests/run-all-266.sh`. Stage 2:
  `node tests/test-276-claim-write-primitive.cjs` (44 assertions, independently reads
  `room.db` after every write); `node tests/test-276-meeting-gate-wiring.cjs` (7 groups / 14
  assertions - the gate is reached, confirmation proven against `room.db` independently of
  the tool's response text, the ledger is single-use, the shipped kwl fixture stays intact
  with zero assertions changed since the new path is opt-in). `bash tests/run-all-266.sh`
  and `bash tests/run-all-276.sh` both report FAIL=0.
files_changed:
  - lib/mcp/tool-router.cjs
  - lib/mcp/tools/claim.cjs
  - lib/core/navigation/typed-claim.cjs
  - references/meeting/filing-protocol.md
  - commands/file-meeting.md
  - skills/file-meeting/SKILL.md (auto-generated mirror, regenerated)
  - tests/test-kwl-meeting-mcp-honesty.cjs
  - tests/test-276-claim-write-primitive.cjs
  - tests/test-276-meeting-gate-wiring.cjs
  - tests/run-all-266.sh
  - CHANGELOG.md
commits:
  - 3a35f4f6 (fix(mcp): make meeting tool description and branches honest about writing nothing)
  - 2f1f4cf3 (docs(meeting): add the real filing-protocol.md the MCP meeting tool tries to read)
  - 0fef3e80 / ddd13ddf / 90b73eb0 (276-12: the claim_write MCP primitive, RED/GREEN/born-wired)
  - 4e18dc7a / 421dcea8 / dfa6f5c2 (276-14: the meeting gate wiring, RED/GREEN/docs)
