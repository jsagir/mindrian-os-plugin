---
name: dominant-designs
description: Spot dominant designs with Utterback-Abernathy
help_jtbd: "Identify the dominant designs in your market."
body_shape: "methodology"
layer: "loop"
hitl_shape: "F.1"
hitl_why: "The dominant design is identified as a single next-move call."
serves_jtbd: ["understand-market"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: naming the product category previews the competing-
# variant census structure before the navigator invests further).
interactive_first_reward: schema_preview
teaching: "When you are wondering if the market has settled on a winning design, /mos:dominant-designs runs Utterback-Abernathy to spot it. Tells you whether to ride the wave or break it. The deep dive can open with a sourced research pass: four evidence lanes, searched only after you approve the queries, every claim with its source."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Dominant Design"]
produces: "room/**/dominant-designs/*"
inputs: []
autonomous_safe: true
# Phase 361 (D-11) data/subagent-dispatch-grants.json carries a reviewed
# "pending" row for commands/dominant-designs.md (reviewed_date 2026-09-23)
# and ratification to "granted" is plan 361-08's checkpoint; Task is added
# as a pre-approval because the deep dive's research mode fans out one
# dominant-design-researcher per navigator-approved evidence lane, strictly
# after the query gate card; allowed-tools is a pre-approval list, not a
# restriction list, so this removes the per-spawn permission prompt rather
# than granting a capability the command lacked.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
  - Task
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06, SENS-09]
  reach_id: context_block
  sub_mode: dominant-design
  framework: "Dominant Design"
  posture: push_forward
  hierarchy_rank: 28
  filing: fileEvidenceWithReadback
  plan_gated: false
  # Phase 361 (D-11, Canon Part 2: White = Tavily + arxiv for research),
  # research mode's lane agents search the web only with navigator-approved
  # queries.
  web_scope: white
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:dominant-designs

You are Larry. This command guides the user through Dominant Designs Analysis.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/dominant-designs.md` for framework details
2. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

**Unattended runs take the quick pass.** When this command runs without a navigator present (inside `/mos:act`, `chain_run`, or any caller that cannot answer the gate card), take the quick pass. The research path starts only from a navigator's answer to the gate card.

### Quick pass

Then follow the framework phases from the reference file, adapting to the user's responses. You are NOT following a rigid script -- the phases are a guide. If the user provides rich context, skip ahead. If they need more exploration, slow down.

### Deep dive

Run Phase 1 (Domain Selection) from the reference file first. Ask the navigator to name the domain generically -- the domain itself, never the venture: no company names, people, or figures. Once the domain is named, offer research mode: a sourced evidence pass before the six phases, or the six phases straight from what the navigator knows.

#### Research mode, PHASE 0 (sequential: compose, then the gate card)

1. **Compose (never hand-write a query).** Create a scratch dir outside the room with Bash:

   ```bash
   mkdir -p "${TMPDIR:-/tmp}/mos-dd-$(date +%Y%m%d-%H%M%S)"
   ```

   Write `{"domain": "<phrase>"}` to `<scratch>/domain.json`, then run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/dominant-design-research.cjs" compose-queries <scratch>/domain.json
   ```

   The composer is the ONLY source of outbound query strings. Never hand-write a query, and never send one it did not return.

2. **Local-only degrade is honest.** On `{ok:false, degrade:'local-only', ...}`, state plainly why (for example "that phrase names a company, so I will not send it -- name the domain instead") and continue the deep dive from what the navigator knows, skipping the rest of research mode. There is no send-anyway path.

3. **The gate card.** On `{ok:true}`, fire an AskUserQuestion card listing the four lanes (label, the one-line evidence question, the exact composed query), with options "Run these lanes (Recommended)", "Edit or drop a lane", "Deep dive without web research". Do not fetch until they approve.

   - An edit, or an added second query for a lane (at most 2 approved queries per lane), is written to `<scratch>/query.json` as `{"lane": "<id>", "q": "<string>"}` and goes back through `audit-query` before the gate card re-renders. A refused edit is reported and never sent.
   - A dropped lane leaves the fan-out and the evidence pack entirely; it is not searched and files nothing.

4. **Write the approved set.** On approval, write the approved lanes to `<scratch>/gate.json` as `{"domain_slug": "...", "lanes": [{"id": "...", "queries": ["..."]}]}`.

**No agent is dispatched before the navigator approves the research pass.**

#### Research mode, PHASE 1 (parallel: one agent per approved lane, plus the Theo structure read)

Print a status block, then dispatch in the same turn:

```
[DOMINANT-DESIGN] Dispatching N lane agents

  Approved lanes: {n}
  Lanes: {lane labels}
```

Dispatch with the Agent tool, `subagent_type: dominant-design-researcher`, once per approved lane, at most 4, clamped through `lib/core/futures/orchestrator.cjs`'s `resolveFanoutCap`. Do not pass any manual background-execution parameter. If the Agent tool rejects the bare name, retry with the scoped name its error lists (for example `mos:dominant-design-researcher`).

Each dispatch prompt carries ONLY: the lane id, the approved query string(s) labeled LITERAL, the lane's evidence question, and the fixed search parameters `search_depth: "basic"`, `topic: "general"`, `max_results: 10` -- exactly one `tavily-search` call per approved query, with `WebSearch` using the identical string as the fallback only on a Tavily error or absence. Never room content, venture context, or STATE.md text. The agent never uses `tavily-extract`. Worst case 8 searches per run (2 queries per lane times 4 lanes times 2 attempts); normal case 4.

In the same turn, run the Theo structure read via Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/dominant-design-research.cjs" theo-structure
```

It sends only the generic handle "Dominant Design" to Theo (no other argument), and its JSON says whether the structure came from Theo or the reference, and why.

#### Research mode, PHASE 2 (sequential: validate, then Larry)

Write each agent's returned JSON to `<scratch>/<lane>.raw.json`, then run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/dominant-design-research.cjs" validate-lane <scratch>/<lane>.raw.json --approved <scratch>/gate.json --out <scratch>/<lane>.valid.json
```

A `query_mismatch` means the agent changed the approved query, so its rows are discarded and the lane is reported as not run. A lane whose search did not run is reported as such. Show the navigator a compact evidence summary: lane, rows kept, dropped unsourced, searched but not found.

Then run the six phases on top of the kept rows, using the structure named by `structure_source` (Theo's steps when served, the reference's six phases otherwise, with `structure_source_reason` stated). Every factual statement ends with its row id, for example `[E-VC-3]`. A statement with no row is Larry's reasoning, phrased as a question or labeled opinion, never presented as fact. No score, dominance-strength number, or confidence appears unless an evidence row states it (Canon Part 12: sourced or absent). Worked cases Theo serves are teaching examples, never evidence rows.

#### Research mode, filing (only after the navigator says yes)

Ask: "File this to competitive-analysis?" first. On yes, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/dominant-design-research.cjs" file-pack --pack <scratch> --room <room dir> --domain-slug <slug> --date <YYYY-MM-DD> --room-label "<room name>" --stage "<stage>"
```

This writes one evidence artifact per approved lane under `<room>/competitive-analysis/dominant-designs/` (an empty lane still gets its artifact with its `## Searched, not found` list), files each lane's sourced rows through `navigation.fileEvidenceWithReadback`, and prints the 4-zone filing report. Show that report as-is, including any lane marked NOT LANDED and a missing room.db.

Then write the analysis artifact to `<room>/competitive-analysis/dominant-designs/<slug>-<YYYY-MM-DD>.md`, using the reference template with frontmatter additions `depth: deep`, `evidence_pack: [<lane artifact paths>]`, `structure_source: theo | reference`, `structure_source_reason: <reason>`, `lanes_not_run: [<ids>]`, and the Discontinuities table's Evidence column holding row ids.

On no, nothing is written to the room. The scratch dir sits outside the room, so nothing lingers there either.

#### Deep dive without web research

Run the six phases from what the navigator knows, exactly as before research mode existed.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to competitive-analysis?" before writing.

Research mode has its own filing step above (only after the navigator's yes); this step covers the quick pass and the no-web deep dive.

If the conversation reveals a connection to another methodology, suggest it:
"The design lifecycle you've mapped connects to /mos:research. Want to explore that next?"

## Tri-Polar

| Surface | Behavior |
|---------|----------|
| **Claude Code CLI** | Full research mode: the query gate, the four-lane fan-out, the Theo structure read, validation, and filing all run here. |
| **Claude Desktop** | No Agent tool. Larry runs the deep dive from what the navigator knows and says plainly that the sourced research pass runs in Claude Code. |
| **Cowork** | Same as Desktop for searching (no Agent tool); lane artifacts filed by a Claude Code CLI run are shared room state everyone in the room can read. |
