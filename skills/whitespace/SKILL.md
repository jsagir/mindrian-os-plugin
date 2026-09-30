---
name: whitespace
description: Detect whitespace gaps in the room's coverage
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Map the whitespace zones in your domain."
body_shape: "methodology"
layer: "loop"
hitl_shape: "F.8"
hitl_why: "Coverage gaps are surfaced as an independent set examined in any order."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 24, navigator-ruled): first delivery at commands/whitespace.md:152, the map subcommand's density grid pairing each gap with a recommended framework.
interactive_first_reward: methodology_reframe
serves_jtbd: ["connect-domains", "find-problem"]
teaching: "When you suspect a gap exists in the room's coverage of a domain, /mos:whitespace runs HSI scoring across the artifact corpus to find under-explored zones. Best after the room has 20+ entries. A gap that spans two sections can become a research plan that checks whether the literature is missing it too."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["HSI Semantic Surprise Analysis Assistant"]
produces: "room/opportunity-bank/whitespace/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
# Phase 363-19: Write is a pre-approval for the research subcommand only; it writes the question-set JSON to a scratch dir outside the room.
allowed-tools: Bash Read Write AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: whitespace
  framework: "HSI Semantic Surprise Analysis Assistant"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 3
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
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

# /mos:whitespace

You are Larry. This command surfaces what's MISSING in a venture's Data Room using embedding-space density estimation, TopicForest hierarchical clustering, and cross-domain literature scanning. Body shape varies by subcommand: **Shape A (Mondrian Board)** for `map`, **Shape B (Semantic Tree)** for `tree`, **Shape E (Action Report)** for `analyze`, `hypothesis`, `score`, `external`, and `discover`.

**Voice rules (LOCKED):**
- Conversational, direct, no filler. Signature openers: "Very simply...", "Here's the thing...", "One thing I've learned..."
- NO emoji anywhere. NO "I'd be happy to help". NO "Great question!". NO sentences starting with "I".
- Symbol vocabulary: only these 12 glyphs: &#9632; &#9660; &#9654; &#9655; |- \- &#10003; &#8226; &#9888; &#9889; &#11036; ->
- Error pattern: 3 lines only -- What / Why: reason / Fix: /mos:command

## Subcommand Routing

Parse the user's input after `/mos:whitespace`. If no subcommand is given, show the **help** listing below.

| Subcommand | Body Shape | Purpose |
|------------|-----------|---------|
| `map` | A (Mondrian Board) | Whitespace zones as density grid |
| `analyze ZONE_ID` | E (Action Report) | Deep-dive classification + hypothesis for one zone |
| `hypothesis ZONE_ID` | E (Action Report) | Lazy on-demand hypothesis for one zone |
| `tree` | B (Semantic Tree) | TopicForest coverage indicators |
| `score` | E (Action Report) | Per-artifact novelty scores ranked |
| `external` | E (Action Report) | Cross-domain literature whitespace |
| `discover` | E (Action Report) | Full Discovery Cycle (HSI/RS/Analogy) |
| `research ZONE_ID` | E (Action Report) | Plan research on one gap: is it missing from the literature or only from this room |

## No Args: Help

When `/mos:whitespace` is called with no subcommand, display:

```
-- [Room Name] -- Whitespace -- Help --

  Whitespace detection -- find what's MISSING in your understanding.

  Subcommands:
  |- map                   Density map of whitespace zones (sparsest first)
  |- analyze ZONE_ID       Deep-dive: classification + framework chain + hypothesis
  |- hypothesis ZONE_ID    Show or generate hypothesis for a zone
  |- tree                  TopicForest with coverage indicators per branch
  |- score                 Per-artifact novelty scores (highest first)
  |- external              Cross-domain literature scan via Semantic Scholar
  |- research ZONE_ID      Plan research on one gap: missing from the literature, or only from this room?
  \- discover              Full Discovery Cycle: HSI + RS + Analogy whitespace

  > /mos:whitespace map               Start here -- see where the gaps are
  > /mos:whitespace tree              See topic coverage at a glance
```

## Pre-flight: Room Check

Before any subcommand, resolve the active room:

```bash
bash "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/resolve-room"
```

If no room found, use the 3-line error format:

```
x No Data Room found
  Why: No room under ~/MindrianRooms/ or legacy room/ in workspace
  Fix: /mos:new-project
```

STOP.

Then check that `.mindrian/` directory exists inside the room. If not:

```
x No whitespace data found
  Why: Whitespace pipeline has not been run on this room yet
  Fix: /mos:whitespace map
```

STOP (unless the subcommand is `map`, which will create the data).

## Subcommand: map

**Body Shape:** A (Mondrian Board)

### Step 1: Run Pipeline

Execute the whitespace-command.cjs dispatcher:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/whitespace-command.cjs" ROOM_DIR map
```

This ensures embeddings exist (runs compute-whitespace-embeddings.py if needed), then runs compute-whitespace-gaps.py.

### Step 2: Render 4-Zone Output

**Zone 1 -- Header Panel:**
```
-- [Room Name] -- Whitespace Map -- [Venture Stage] --
```

**Zone 2 -- Content Body (Shape A: Mondrian Board):**

Display whitespace zones as a grid sorted by density_score ascending (sparsest = most interesting first). Phase 355-16 (D-29): the dispatcher itself never prints the raw density decimal -- the column and the summary line both show a sparsity RANK (1 = sparsest, an integer, no new threshold) instead. Reproduce whatever `whitespace-command.cjs map` prints verbatim; never compute or restate a decimal of your own.

```
  Zone                    Rank    Type           Nearest Frameworks
  ws-gap-001              1       Ill-Defined    JTBD, Beautiful Questions
  ws-gap-002              2       Well-Defined   MECE, Issue Trees
  ws-gap-003              3       Un-Defined     Analogical Reasoning
  ws-gap-004              4       Wicked         Systems Thinking, Causal Loop
```

Each row shows:
- Zone ID (left-aligned)
- Sparsity rank (1 = sparsest = biggest gap, an integer, never a decimal)
- Problem type classification
- Top 1-2 nearest frameworks (truncated to fit 80 cols)

Summary line:
```
  Zones: [N] total  |  [X] validated  |  Sparsest: [zone_id] (rank 1 of [N])
```

Every shown zone also prints a verification stamp block (Phase 355-16, HIPS-04/HIPS-05) directly under the grid -- one block per zone, in the same order, reproduced VERBATIM (never summarized, never a number added):

```
  <checkmark or bullet or warning glyph> <tier word> &middot; <direction phrase> &middot; <backend word>
  path   <node -- EDGE -- node ...>
  tier   <tier word>, <hop word> in the methodology graph
  judge  none, path check only
```

or, when unverified:

```
  <warning glyph> unverified &middot; <direction phrase> &middot; <backend word>
  reason <plain-language reason>
  may be novel or hallucinated - verify with a domain expert
  judge  none, path check only
```

The render ends with the disclosure line naming `data/floor-ledger.json` -- reproduce it exactly, never paraphrase it into a percent or a confidence score.

On Desktop / Cowork, when a zone has no stored stamp at all (the CLI has not been run there yet), say exactly: "Not yet checked; run the CLI to verify." (D-50). Never invent a tier or a path for it.

**Zone 3 -- Intelligence Strip** (conditional):
Show if any zones are ranked in the bottom quartile by density (severe gaps):
```
  &#9888; [N] zones in the sparsest quartile -- significant knowledge gaps detected
  &#11036; [zone_id] has no nearby artifacts -- isolated void
```

**Zone 4 -- Action Footer (NEVER omit):**
```
  > /mos:whitespace analyze [sparsest_zone]   Deep-dive the biggest gap
  > /mos:whitespace tree                      See topic coverage
  > /mos:whitespace score                     Check artifact novelty
```

## Subcommand: analyze ZONE_ID

**Body Shape:** E (Action Report)

### Step 1: Run Analysis

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/whitespace-command.cjs" ROOM_DIR analyze ZONE_ID
```

If the zone ID is not found, show:

```
x Zone not found: [ZONE_ID]
  Why: No zone with that ID in whitespace-results.json
  Fix: /mos:whitespace map (to see available zones)
```

### Step 2: Render 4-Zone Output

**Zone 1 -- Header Panel:**
```
-- [Room Name] -- Whitespace Analyze -- [ZONE_ID] --
```

**Zone 2 -- Content Body (Shape E: Action Report):**

Phase 355-16 (D-29): the Density line is gone -- `analyze` prints the same sparsity rank `map` uses (`sparsity rank n of N`, an integer, never a decimal).

```
  Zone: [ZONE_ID]
  Rank: sparsity rank [n] of [N]
  Problem Type: [classification]
  Validated: [Yes/No] ([gates passed]/[total gates])

  Framework Chain:
  |- [Framework 1] -- [description or transform]
  |- [Framework 2] -- [description or transform]
  \- [Framework 3] -- [description or transform]

  Nearest Artifacts:
  |- [artifact_name] ([section]/)
  \- [artifact_name] ([section]/)

  Hypothesis:
  [Full hypothesis text from interpretation-results.json, or "Not yet generated -- run /mos:whitespace hypothesis ZONE_ID"]
```

Directly under the Hypothesis block, `analyze` prints the zone's own verification stamp block (same shape as `map`'s, one block, D-27) followed by the disclosure line naming `data/floor-ledger.json`. Reproduce both verbatim -- never add a number, never summarize the stamp into a confidence score. On Desktop / Cowork with no stored stamp for this zone, say exactly: "Not yet checked; run the CLI to verify." (D-50).

**Zone 3 -- Intelligence Strip** (conditional):
If zone validation failed gates, show which:
```
  &#9888; Failed anchor gate -- gap may be at cluster periphery, not between clusters
```

**Zone 4 -- Action Footer:**
```
  > /mos:whitespace hypothesis [ZONE_ID]   Generate methodology-aware hypothesis
  > /mos:whitespace map                    Back to zone overview
  > /mos:whitespace discover               Run full Discovery Cycle
```

## Subcommand: hypothesis ZONE_ID

**Body Shape:** E (Action Report)

### Step 1: Check for Existing Hypothesis

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/whitespace-command.cjs" ROOM_DIR hypothesis ZONE_ID
```

The dispatcher checks interpretation-results.json first. If a hypothesis already exists, it returns it without re-running the pipeline (lazy evaluation).

### Step 2: Render 4-Zone Output

**Zone 1 -- Header Panel:**
```
-- [Room Name] -- Whitespace Hypothesis -- [ZONE_ID] --
```

**Zone 2 -- Content Body (Shape E: Action Report):**

```
  Zone: [ZONE_ID]  |  Type: [problem_type]  |  Chain: [fw1] -> [fw2] -> [fw3]

  Hypothesis:
  [Full 3-part hypothesis text]

  1. What's missing and why it matters:
     [text]

  2. Framework-driven question:
     [text]

  3. Suggested next action:
     [text]
```

**Zone 3 -- Intelligence Strip:** Omit unless zone has HIGH contradiction signal.

**Zone 4 -- Action Footer:**
```
  > /mos:whitespace analyze [ZONE_ID]       Full zone details
  > /mos:whitespace map                     Back to zone overview
  > [suggested /mos: command from hypothesis part 3]
```

## Subcommand: tree

**Body Shape:** B (Semantic Tree)

### Step 1: Run Pipeline

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/whitespace-command.cjs" ROOM_DIR tree
```

Ensures topic-forest.json exists (runs compute_topic_forest.py if needed), then runs label-topic-forest.cjs.

### Step 2: Render 4-Zone Output

**Zone 1 -- Header Panel:**
```
-- [Room Name] -- Whitespace Tree -- Topic Coverage --
```

**Zone 2 -- Content Body (Shape B: Semantic Tree):**

Display the TopicForest as an indented tree with coverage indicators per branch.

```
  &#9660; Market Dynamics                          &#10003; covered
  |- &#9654; Customer Segments                     &#10003; 3 artifacts
  |- &#9654; Competitive Landscape                 &#8226; 1 artifact
  \- &#9655; Pricing Strategy                      &#11036; whitespace
  &#9660; Technology Architecture                   &#8226; sparse
  |- &#9654; Core Platform                         &#10003; 2 artifacts
  \- &#9655; Integration Layer                     &#11036; whitespace
  &#9655; Regulatory Environment                    &#11036; whitespace
```

Coverage indicators:
- `&#10003;` = covered (2+ artifacts mapped to this branch)
- `&#8226;` = sparse (1 artifact, needs more)
- `&#11036;` = whitespace (0 artifacts in this topic branch)

Summary line:
```
  Topics: [N] branches  |  &#10003; [X] covered  |  &#8226; [Y] sparse  |  &#11036; [Z] whitespace
```

**Zone 3 -- Intelligence Strip** (conditional):
```
  &#11036; [N] topic branches have zero coverage
  &#9889; [topic] converges with existing room section [section]
```

**Zone 4 -- Action Footer:**
```
  > /mos:whitespace map                     See density scores per zone
  > /mos:whitespace analyze [whitespace_topic]  Investigate biggest gap
  > /mos:explore-domains                    Fill empty branches
```

## Subcommand: score

**Body Shape:** E (Action Report)

### Step 1: Read Scores

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/whitespace-command.cjs" ROOM_DIR score
```

Reads whitespace-results.json and extracts artifact_novelty_scores.

### Step 2: Render 4-Zone Output

**Zone 1 -- Header Panel:**
```
-- [Room Name] -- Whitespace Scores -- Novelty Ranking --
```

**Zone 2 -- Content Body (Shape E: Action Report):**

Phase 355-16 (D-29): the Novelty column and the summary line show the BAND WORD (novel / moderate / covered) from the existing 0.8/0.4 cut-offs, never the raw decimal -- the underlying novelty math is unchanged, only the render is.

```
  Artifact                        Section               Novelty   Nearest Concept
  customer-jobs-analysis.md       market-analysis/      novel     JTBD Framework
  regulatory-landscape.md         legal-ip/             novel     Regulatory Arbitrage
  competitive-map.md              competitive-analysis/ covered   Porter's Five Forces
  problem-statement.md            problem-definition/   covered   Beautiful Questions
```

Sorted by novelty_score descending (most novel first).
- `novel` = highly novel (far from existing knowledge)
- `moderate` = moderately novel
- `covered` = well-covered territory

Summary line:
```
  Artifacts: [N]  |  Novel: [X]  |  Moderate: [Y]  |  Covered: [Z]
```

Every shown row also prints a verification stamp block, same shape as `map`'s, one block per row, reproduced verbatim, ending with the disclosure line naming `data/floor-ledger.json`. An artifact whose carried name resolves to nothing still renders under its own artifact name with the "may be novel or hallucinated" advice line -- never dropped, never silently hidden. On Desktop / Cowork with no stored stamp, say exactly: "Not yet checked; run the CLI to verify." (D-50).

**Zone 3 -- Intelligence Strip** (conditional):
```
  &#9889; [artifact] scores in the novel band -- genuinely unprecedented insight
```

**Zone 4 -- Action Footer:**
```
  > /mos:whitespace map                     See where gaps cluster
  > /mos:whitespace analyze [top_zone]      Investigate the sparsest zone
  > /mos:room [section_of_top_novel]        Review your most novel work
```

## Subcommand: external

**Body Shape:** E (Action Report)

### Step 1: Run External Pipeline

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/whitespace-command.cjs" ROOM_DIR external
```

If the scripts are not yet installed, the dispatcher shows:

```
x External corpus not configured
  Why: Phase 66 Plan 02 scripts not installed yet
  Fix: /mos:whitespace external (available after Plan 02 deployment)
```

When Semantic Scholar is fully unreachable (network failure or every query rate-limited), the dispatcher shows (Phase 88.6-03):

```
x Semantic Scholar unavailable
  Why: All queries rate-limited or network failure
  Fix: /mos:whitespace external (retry in 60 seconds if rate-limited)
```

### Step 2: Render 4-Zone Output (when available)

**Zone 1 -- Header Panel:**
```
-- [Room Name] -- Whitespace External -- Cross-Domain --
```

**Zone 2 -- Content Body (Shape E: Action Report):**

```
  Action: External whitespace scan
  Source: Semantic Scholar API

  Cross-Domain Zones Found: [N]
  |- [zone_id]: [description] (from: [paper_title])
  |- [zone_id]: [description] (from: [paper_title])
  \- [zone_id]: [description] (from: [paper_title])

  Papers Analyzed: [N]
  Top Matches:
  |- [paper_title] ([year]) -- relevance: [score]
  \- [paper_title] ([year]) -- relevance: [score]
```

**Zone 3 -- Intelligence Strip** (conditional, max 3 signals, Phase 88.6-03):
```
  warning N of M Semantic Scholar queries rate-limited (partial results shown)
  warning N of M Semantic Scholar queries errored (partial results shown)
  lightning External literature reveals [N] cross-domain connections
```

All three signals can appear together when partial results still surface cross-domain connections. Glyph names in backticks refer to the 12 approved glyphs from `skills/ui-system/SKILL.md` Section 3.

**Zone 4 -- Action Footer:**
```
  > /mos:whitespace analyze [zone_id]       Investigate external zone
  > /mos:whitespace discover                Run full Discovery Cycle
  > /mos:research [topic]                   Deep-dive into a finding
```

### Rate-Limit Behavior

Semantic Scholar free tier enforces a max of 1 request per second. When burst queries trigger 429 responses, rate-limited queries are logged and skipped; the pipeline continues with whatever papers returned. The Zone 3 warning surfaces `N of M queries rate-limited` so the user knows coverage may be partial and the cause is external throttling, not empty-result. Per-query outcomes (`ok` / `rate_limited` / `api_error` / `network_error` / `timeout` / `not_attempted`) are persisted in `.mindrian/external-papers.json` under the top-level `queries[]` array so the dispatcher shows real telemetry rather than guessing. Retrying after 60 seconds typically recovers the full set because the cache (7-day TTL) preserves successful results from the first pass.

Canon Part 8 Graph Boundary: external papers are SIGNAL (public data) per canon Part 8. They flow LOCAL only (to `{roomDir}/.mindrian/external-papers.json`), never to Brain. No user-specific strings are ever sent to Semantic Scholar or Brain in this pipeline. The query keywords are extracted from local artifact titles and framework names, sent to the public Semantic Scholar API over HTTPS, and the returned abstracts stay on disk in the room.

## Subcommand: discover

**Body Shape:** E (Action Report)

### Step 1: Run Discovery Cycle

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/whitespace-command.cjs" ROOM_DIR discover
```

Runs discovery-cycle.cjs with `--steps all`. This chains HSI, RS, and Analogy whitespace detection.

### Step 2: Render 4-Zone Output

**Zone 1 -- Header Panel:**
```
-- [Room Name] -- Whitespace Discover -- Full Cycle --
```

**Zone 2 -- Content Body (Shape E: Action Report):**

```
  Action: Discovery Cycle
  Steps: HSI -> RS -> Analogy

  Results:
  |- HSI Whitespace:     [N] zones (between connected artifacts)
  |- RS Whitespace:      [N] zones (downstream of bottlenecks)
  \- Analogy Whitespace: [N] zones (unmapped transfer zones)

  Total Zones: [N]
  Validated: [X] / [N]

  Top Discoveries:
  |- [zone_id] [gap_signal] -- [hypothesis preview, 80 chars]
  |- [zone_id] [gap_signal] -- [hypothesis preview, 80 chars]
  \- [zone_id] [gap_signal] -- [hypothesis preview, 80 chars]
```

**Zone 3 -- Intelligence Strip** (conditional):
```
  &#9889; Discovery found [N] strong-signal zones across [X] pipeline sources
  &#9888; [N] zones failed validation -- may be noise
```

**Zone 4 -- Action Footer:**
```
  > /mos:whitespace map                     Visualize all zones
  > /mos:whitespace analyze [top_zone]      Deep-dive the strongest signal
  > /mos:whitespace score                   Check artifact novelty
```

## Subcommand: research ZONE_ID

This is a new way to use the framework: the answers you just worked out become a checked research plan. The command itself fetches nothing and dispatches nothing. It writes a question set, asks the plan step to check it, shows you the card that comes back, and hands the run id to `/mos:research`, the one runner (Phase 363).

1. When to offer it. When the navigator runs `research ZONE_ID`, or after `analyze ZONE_ID` or `hypothesis ZONE_ID`, or when the navigator asks whether a gap is missing from the literature or only from this room, offer one line: "Want to check whether the literature is missing this too?" Offer it as one line and never run it on its own. If no navigator can answer (inside `/mos:act`, `chain_run`, or any unattended caller), skip this section entirely.
2. Pending cards first. A room-started card may already be waiting:
   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/research-planner.cjs" pending --room <room dir>
   ```
   Show each card it returns before planning anything new.
3. Read the zone. Open the same file `analyze ZONE_ID` reads, `.mindrian/whitespace-results.json` in the room, and find the zone by its id. The cohort is the zone's sections (an explicit `sections` list, else the first path segment of each nearest artifact). With fewer than 2 sections, say the gap is not wide enough to research and stop: no plan is written.
   The search term is the navigator's own. If the zone entry carries a `zone_term`, that is the term; show it and ask the navigator to confirm or correct it. If it carries none (a real room usually does not yet), ask the navigator for the term in their own words, as a short noun phrase of 2 to 80 characters with no quotes, parentheses, or AND, OR, NOT. Never derive the term from artifact names, section names, or the hypothesis text, and never send any of those anywhere. The term goes into the leaf slots below and onto the grant card the navigator approves; it is not written back into `whitespace-results.json` by this subcommand.
4. Write the question set to a scratch directory outside the room (`mkdir -p "${TMPDIR:-/tmp}/mos-rp-$(date +%Y%m%d-%H%M%S)"`) with the Write tool, as `question-set.json`. It holds: `"schema": "mos.research-question-set/1"`, `"template_id": "whitespace"`, `"command": "/mos:whitespace"`, the navigator's own words as `stated_question`, `scqa` framed the way `/mos:structure-argument` frames it (`situation` stable and agreed, `complication` in one sentence, `question` the one the audience now has, `answer_hypothesis` or null), a `key_line` of the branch labels, and one leaf per researchable dimension. A leaf has `id`, `parent`, `question`, `origin`, `dimension`, `lens`, `researchable`, a `falsifier` with `text`, and typed `slots`. Slots hold terms, never query strings: a short noun phrase, no quotes, no parentheses, no AND, OR, NOT; the plan step composes and audits every query. The `origin` is `user_stated` when the leaf restates the navigator's question, `framework_dimension` when the framework's structure raised it, and `mece_gap` when it fills a gap the navigator's framing left open. Every not-researchable dimension gets a `coverage_notes` entry with its reason.
   Also write the `perspective` block: the tension in one statement; the goal with its falsifier (a number and unit when it can be one, otherwise say plainly that it is not quantified); the roadmap type and idea kind; for a deep research run the three forum passes written one after another, the frustrated insider (`frustrated_insider`), then the fresh entrant (`fresh_entrant`), then the physics grounder (`physics_grounder`), each with what it contributed; the paths; every limiter in the `physics` or `assumed` column, with each assumed limiter rewritten as a question of the form "what if we attacked ..., which this field treats as fixed?"; and `unlock_chains` counting only dominoes the field would push.
   This command's dimensions (the checklist the checker holds your question set against):
   - `ws:gap_claim` (lens `ws.gap`): is the zone empty in the literature, or only in the room. Slot `term`. Falsifier: any peer-reviewed work that addresses the zone directly.
   - `ws:covered_elsewhere` (lens `ws.covered_elsewhere`): is the same problem studied under another name. Slots `term` and, when the navigator names them, `synonyms` (one to three of the navigator's own terms). Falsifier: work under another term that answers the same question.
   - `ws:irrelevant` (not researchable): the reason is navigator judgment. Ask whether the zone is worth filling at all, and record the answer in `coverage_notes`.
   - `ws:extraction_failure` (checked in the room, nothing sent): a leaf with `"corpus": "room"` and empty slots asking whether the room already holds this under other words. Falsifier: a room artifact that already covers the zone.
   The `external` subcommand is not used for this: it builds its search keywords from artifact titles, and this plan sends only the term the navigator approved. Set `--section` to the first of the zone's sections. A confirmed gap becomes a literature-gap candidate in the report; a covered one says where.
5. Diffusion lens (not part of this command's own dimensions). If the question is about a dual-use or deep-tech technology's adoption, diffusion or timing, add `"lens_selection": [{"lens": "diffusion", "reason": "<one line>"}]` and write the diffusion leaves too: `df:first_adopters`, `df:absorptive_capacity`, `df:civil_defense_crossing`, `df:timing`, each with the slot `technology`. The choice is a local judgment of yours from what the navigator said and what the room shows, with the reason in one line; the question is never sent anywhere to decide it. When the question is not about that, leave `lens_selection` empty.
5a. Ask for the bottleneck first. Before you offer or plan a deep run (the `escalate` after a thin quick run, or `--mode deep` here), ask the navigator one question: "What actually blocks this gap? Say it in your own words." Never suggest an answer and never derive one from the room's files or the zone's artifacts. If they name one, write their exact words as a limiter in the `perspective` block (column `assumed`, `statement` and `question` both their words, `raised_by` `navigator`) on a leaf that is searched outside the room. A deep plan with no nameable limiter is a wish and does not run. If they name none, say "name what blocks this and I'll plan a deep run" and plan only the quick run. The words stay in the room: they are never sent to the Brain or anywhere else (Canon Part 8).
6. Run the plan step. Use `--mode quick` for one question on one lens (a quick research run) and `--mode deep` for anything larger (a deep research run); `--section` names the room section the results return to:
   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/research-planner.cjs" plan <scratch>/question-set.json --room <room dir> --mode quick|deep --section <slug>
   ```
7. Show the card it returns, unchanged. If the status is incomplete, name each uncovered dimension as a question the navigator has not asked yet, fill it in or mark it not researchable with a reason, and plan again. If the status is wish, say there is no nameable limiter yet and ask the bottleneck question from step 5a; a plan that grew from a quick run answers `needs_limiter` with the same ask, and the navigator's words go back in through `revise` with an `add_limiter` edit. If it is needs_lens_leaves, write the leaves it lists.
8. Hand off: "Continue in /mos:research --plan <run_id>." The command itself fetches nothing and dispatches nothing; `/mos:research` asks for the grant or the plan review and runs the plan.
9. On Claude Desktop and Cowork the same question set goes to the `research_run` MCP tool with op `plan`, and the card comes back there; deep research runs execute in Claude Code.

## Error Handling

All errors use the 3-line pattern (per D-24):

```
x [What failed]
  Why: [Specific reason]
  Fix: [One resolving command]
```

Common errors:

- **No Python installed:** `x Python 3 not found / Why: Whitespace pipeline requires Python 3.8+ / Fix: Install Python 3 and retry`
- **No embeddings:** `x No whitespace embeddings / Why: Pipeline needs to embed room artifacts first / Fix: /mos:whitespace map (runs embedder automatically)`
- **Script timeout:** `x Pipeline timed out / Why: Room has too many artifacts for default timeout / Fix: Run with fewer sections or contact support`

## Cross-Surface Adaptation

- **CLI:** Full power. Scripts run via Bash, output formatted for terminal.
- **Desktop:** Larry describes the whitespace findings conversationally. Numbers and zone IDs still shown but in natural language context.
- **Cowork:** Same as CLI. Zone data can be shared via 00_Context/ for team visibility.
