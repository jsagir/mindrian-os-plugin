---
status: investigating
kind: rca
trigger: "meeting-file-meeting-false-success"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-09-03T13:55:00Z
updated: 2026-09-03T13:55:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: `meeting`'s `file-meeting` command never wrote anything (no `insertNode`, no `artifact_file`, no room.db mutation) despite its own tool description claiming it does ("parses a transcript and files it as a room entry"), and its response text ("## File Meeting" header, echoed transcript, no error) reads as a filing confirmation to any caller, human or model, that does not independently verify the write.
test: read the handler in full, confirmed it. Independently verified against a live call this session: `room.db` mtime unchanged before/after a real `file-meeting` call with a full real transcript as `context`.
expecting: confirmed, no further test needed to establish the root cause. Remaining open question is scope of fix (see Required Code Changes).
next_action: navigator decision on which fix track to take (see Required Code Changes, two tracks named).

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

The `file-meeting` branch of the `meeting` MCP tool never calls a write function. It builds and returns a formatted string (room state + a static reference document + the caller's own input, echoed back) and fires a no-op cascade call (`filePath: ''`). This is deliberate scaffolding architecture - matching how other methodology tools in this codebase (`think-hats` confirmed directly this session) hand doctrine and context to the calling model rather than performing the work themselves, on the stated principle that "reasoning stays with the frontier model." That architecture is legitimate. The defect is narrower and more specific: the tool's own description (`lib/mcp/tool-router.cjs:1362`) makes a first-person claim about what the code does ("file-meeting parses a transcript and files it as a room entry") that the code does not fulfill, and the response format (a "## File Meeting" heading with the transcript echoed back, no filing-status field, no explicit "nothing was written" signal) is indistinguishable, to a reasonable reader, from a genuine filing confirmation.

- Site: `lib/mcp/tool-router.cjs:1360-1382`, the `meeting` tool registration and its `file-meeting` branch
- Cause: description overclaims (states the tool files content; it does not), and the response format provides no signal that no write occurred, unlike the honest `artifact_file` tool which returns a structured `{ok, file_path, artifact_id, memory_event}` object that is trivially checkable.
- Why it surfaces now: not a regression - surfaced because this session independently write-verified a tool response against `room.db` for the first time (rather than trusting response text), which this whole session's own work (T2's write-back path, the reasoning constitution's own discipline against silent promotion) made a live habit rather than an assumption.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (short-term patch, recommended for immediate fix):
  - Location: `lib/mcp/tool-router.cjs:1362` (tool description) and `:1372-1381` (`file-meeting` branch response construction)
  - Current behavior: description states "file-meeting parses a transcript and files it as a room entry"; response returns transcript + reference doc with no filing-status signal.
  - Required behavior: correct the description to state what the tool actually does ("file-meeting surfaces the filing protocol and room context so the calling model can file the transcript via `artifact_file`; it does not write anything itself"). Add an explicit, structured field to the response - e.g. a leading line `**No write occurred. Use artifact_file to actually file this content.**` or a machine-checkable `filed: false` marker - so neither a human nor a model reading the response can mistake it for a completion.
  - Short-term patch: the description and response-text correction above. No behavior change, no risk to existing callers, ships same-day.
  - Long-term fix: a real design decision, NOT to be resolved as part of this patch - should `file-meeting` actually perform the parse-and-file itself (matching its current description's promise), turning it into a real write path like `artifact_file`? That is a feature-scope question for the navigator, separate from the honesty fix above.
- Change 2 (scope check, same severity class, not yet confirmed):
  - Location: `lib/mcp/tool-router.cjs:1384-1402`, the `pipeline` and `speakers` branches of the same tool
  - Current behavior: read-only, reference-doc-plus-context pattern, same shape as `file-meeting` - not independently write-verified this pass.
  - Required behavior: confirm whether either branch's description overclaims a write the way `file-meeting`'s did; if so, apply the identical description/response correction.
  - Short-term patch: n/a until confirmed.
  - Long-term fix: n/a until confirmed.

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
fix: PENDING navigator decision on Change 1's exact wording/shape and whether Change 2's scope check is wanted now or deferred.
verification: PENDING
files_changed: []
commits: []
