# Meeting Filing Protocol (surface-neutral extract)

## Provenance (read this before anything else)

This file is an EXTRACT, not the canonical source. `commands/file-meeting.md`
Step 3 is the canonical CLI implementation of this protocol - it was built and
verified by Phase 150.8 ("Meeting Micro-Knowledge DIKW Filing v1", 2026-06-12,
`.planning/phases/150.8-meeting-micro-knowledge-dikw-filing-v1-any-transcript-files-/150.8-VERIFICATION.md`,
11/11 must-have truths PASSED), and it was later restructured by Phase 265 into
the current Step 3a (Dispatch) / Step 3b (Consolidation) split.

`tests/test-kwl-meeting-mcp-honesty.cjs` is the drift guard. It machine-checks
that the shared taxonomies (the four Claimify pass names, the six
`knowledge_type` enum members, the six segment types) appear in BOTH this file
and `commands/file-meeting.md`. An edit to the taxonomy in one file that does
not land in the other turns that test red - drift is a red test here, not a
memory problem for a future author to catch by hand.

This file exists because of a real defect, recorded at
`.planning/debug/meeting-file-meeting-false-success.md`: the MCP `meeting`
tool's `file-meeting` branch has always tried to read this path via
`safeReadFile`, and it did not exist on disk. The branch silently dropped the
section when the read missed, so a calling model got a completion-shaped
response with no usable protocol behind it. This file closes that half of the
defect. It does NOT close the other half the RCA names: the MCP surface still
does not call `navigation.writeClaimNode` itself. See "The honest surface gap"
below.

## What this protocol is for, and who reads it

The CLI slash command `/mos:file-meeting` reads its own inline copy of this
protocol directly out of `commands/file-meeting.md` - that copy is the
canonical, twice-verified implementation and it is not touched by this file.

This file is what the MCP `meeting` tool hands back to a calling model on
Claude Desktop and Cowork, the two surfaces that reach meeting filing only
through the MCP `meeting` tool and never through the CLI slash command.

## The honest surface gap, stated up front

An MCP caller cannot execute the full CLI pipeline. Naming why, plainly,
rather than leaving a model to discover it by trial and error:

- **The five-perspective subagent fan-out (Step 3a Dispatch) is unreachable.**
  The CLI dispatches five subagents in one message via the Agent tool with
  `subagent_type: meeting-perspective-extractor`. An MCP tool call has no
  Agent tool and no subagent registry to dispatch into.
- **The F.8 filing gate is unreachable.** Step 4's confirm-then-file gate
  renders through `renderShapeF8` and resolves through `consumeF8Fanout`, both
  driven by `AskUserQuestion` - a CLI render surface an MCP tool call does not
  have access to.
- **A direct `navigation.writeClaimNode` call is unreachable.** No MCP tool
  registered today exposes `writeClaimNode` directly. The write path an MCP
  caller CAN reach is `artifact_file`.

What an MCP caller CAN do: walk the Four Claimify Passes below itself, in one
context, over the transcript it already holds, and persist each claim it
confirms through `artifact_file` - the real, MCP-reachable write path. This is
an honest, reduced form of the CLI protocol, not an equivalent one. When the
user is on the CLI, point them at `/mos:file-meeting` for the fuller path:
five-perspective dispatch, F.8 gate, and the direct `writeClaimNode` call, all
in one governed flow.

## Inputs this protocol assumes

- **The confirmed speaker roster**, with roles drawn from the twelve-member
  role taxonomy: mentor, researcher, team-member, investor, advisor, customer,
  founder, partner, domain-expert, government, competitor, unknown.
- **The transcript itself.** See
  `references/meeting/transcript-patterns.md` for speaker-label detection
  heuristics when the roster is not already confirmed.

## The Four Claimify Passes

Faithful to `commands/file-meeting.md` Step 3 (the Four Claimify Passes
section, lines 439-527 at the time this extract was written).

### Pass 1: Selection

Classify each segment using the six-member SEGMENT taxonomy from
`references/meeting/segment-classification.md`:

- `decision` (HIGHEST priority) - explicit choices made, direction set.
- `action-item` (HIGH priority) - tasks assigned, deadlines mentioned.
- `insight` (MEDIUM priority) - new information, discoveries, data points.
- `advice` (MEDIUM priority) - recommendations, suggestions, should/could.
- `question` (LOW priority) - open questions, uncertainties raised.
- `noise` (SKIP) - greetings, small talk, logistics, off-topic.

Apply role-aware priority heuristics (an investor question about financials is
HIGH priority; a mentor's advice on problem framing is HIGH priority; a
team-member status update is MEDIUM priority), then sort by priority:
decisions highest, then action-items, then insights and advice, then
questions lowest. Flag potential noise that carries proper nouns, competitor
names, or numbers rather than discarding it outright - it still returns as a
row for the orchestrator's basket, never silently dropped. Filler and pure
social talk is tagged `no_claim` and discarded; it mints no claim row. The
selection pass IS the priority sort - it decides which segments carry
candidate knowledge.

### Pass 2: Disambiguation

For each selected segment, resolve pronouns and referents before decomposing:

1. Use the speaker identity from the confirmed roster and the prior two to
   three turns of context to bind every pronoun ("it", "they", "this") and
   every bare referent ("the deal", "that number") to a concrete antecedent.
2. An unresolvable referent is NEVER dropped. When a referent cannot be
   resolved from the speaker plus the prior two to three turns, the resulting
   atomic claim is still returned, marked `disambiguation: 'ambiguous'`, and
   queued for human review.

### Pass 3: Decomposition

Split each compound segment into ATOMIC claims:

1. A segment that asserts two things becomes two atomic claims (for example,
   "revenue was $1.2M and churn dropped" becomes a `fact` claim about revenue
   and a separate claim about churn).
2. A decision-plus-action segment becomes the decision claim plus the action
   sub-element.
3. Each atomic claim must carry exactly ONE dominant `knowledge_type` after
   typing. If a claim still reads as two types, it was not fully decomposed -
   split it again.

### Pass 4: Typing

Classify each atomic claim against the six-member `knowledge_type` enum from
`references/meeting/knowledge-typing.md`:

- `fact` - a stated state of the world that is true or false.
- `anomaly_cue` - a noticed surprise, an outlier, a "that is weird" signal.
- `causal` - an X-causes-Y mechanism claim.
- `heuristic` - a rule of thumb, an if-then operating rule.
- `mental_model` - a belief about how a system or market works.
- `assumption` - a claim taken as true without evidence yet.

Run the `conditions` / `counter_conditions` contrastive probe ("when does this
hold?" / "when does this break?"), extract `valid_from` / `valid_until` when
the claim is time-bound, then return the row in the uniform schema: segment
id, speaker id, segment type, priority, claim text, knowledge type,
conditions, counter conditions, valid from, valid until, disambiguation,
confidence, and a reasoning line naming the classification.

## Consolidation rules that survive the surface change

From the CLI's Step 3b Consolidation, only the rules an MCP caller can
actually apply inside a single context, since Step 3b's own five-perspective
merge machinery is a CLI-only shape:

- **Merge and deduplicate on `segment_id`.** The same segment surfacing twice
  (once through one lens, once through another) is expected on the CLI's
  multi-perspective fan-out; an MCP caller walking one pass over the
  transcript will naturally avoid re-emitting the same segment, but if it
  does, merge on `segment_id` rather than filing duplicates.
- **Never silently pick a winner on `knowledge_type` disagreement.** If a
  claim could plausibly carry two different types, do not average and do not
  guess - either split the claim (Pass 3's own remedy) or record the losing
  type in `disambiguation` and surface the disagreement in the reasoning line.
- **Detect intra-meeting contradictions** across the full claim set the pass
  produced, rendered claim-A-versus-claim-B with speakers attributed, per
  `references/meeting/summary-template.md`'s "Contradictions Detected" shape.
- **Render a reasoning line for every classified claim.** Transparency is
  mandatory even when it makes the flow longer - the user needs to trust the
  classification, not just receive it.
- **The cross-claim edge minting the CLI performs (`REFINES`, `ROOT_CAUSES`,
  `INSTANTIATES` via `navigation.writeEdge`) and the five-perspective merge
  step are CLI-only machinery an MCP caller does not have a write path for
  today.** Say so rather than silently dropping the capability: an MCP caller
  files the claim through `artifact_file` without minting these edges.

## The rules that never bend, on any surface

- **Nothing files without the navigator confirming.** Every claim is born
  `review_status: 'proposed'` at the writer - never auto-confirmed. Only a
  human confirms a truth-claim node (Canon Part 9, role 5).
- **Agent attribution is forbidden.** A literal `larry`, `brain`, `system`, or
  `assistant` identity as the claim's source is rejected with
  `agent_attribution_forbidden`.
- **Canon Part 8: claim prose stays LOCAL.** Claim text lives only in room.db
  and the filed artifact. Only the `knowledge_type` enum handle may ride to
  the Brain downstream - never the transcript text, never the claim body. This
  rule is load-bearing precisely because a model walking this protocol on the
  MCP surface is one careless `brain_*` call away from a constitutional
  breach; there is no F.8 gate here to catch it first the way the CLI's
  Step 4 does.

## Where to go next

- `references/meeting/section-mapping.md` - routing a classified claim to a
  target room section.
- `references/meeting/artifact-template.md` - the artifact frontmatter shape
  `artifact_file` expects.
- `references/meeting/summary-template.md` - the summary and
  contradictions-detected shape referenced above.
