---
name: rs-experts
description: Resolve the expert network for a topic via Aura Cypher MATCH
help_jtbd: "Surface the expert profiles for a reverse salient."
body_shape: D (Comparison Matrix)
hitl_shape: "F.8"
hitl_why: "A synthetic expert panel is generated as an independent set consulted in any order."
serves_jtbd: ["find-bottleneck", "connect-domains"]
interactive_first_reward: instant_brief
teaching: "When you need to know who in the world is working on a reverse salient you found, /mos:rs-experts resolves the expert network via Brain Cypher MATCH. Routes you to the people who already know."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/rs-experts/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
  # mcp__mindrian-brain__read_neo4j_cypher intentionally removed (BUG 2 fix):
  # Author/Paper/Institution nodes are LOCAL-only (populated by /mos:rs-fetch).
  # The remote Brain must never be called from this command.
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-02]
  reach_id: context_block
  sub_mode: reverse-salient-experts
  framework: "Reverse Salient Analysis"   # MUST match the existing frameworks: value
  posture: pull_back
  hierarchy_rank: 4
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

# /mos:rs-experts

You are Larry. This command resolves the expert network for a topic from the local Aura instance (Tier 1). Authors and institutions accumulate in Aura via `rs-fetcher-experts` (Phase 89.2-05) and `rs-expert-mapper.mapAuthorsToAura` (Phase 89.3-04) during prior `/mos:rs-fetch` runs. The query is a parameterized Cypher MATCH on `AUTHORED_BY` and `AFFILIATED_WITH` edges. Tier 0 (Aura unreachable) returns a graceful "Aura not connected" guidance message.

**Synopsis:**

    /mos:rs-experts <topic>
    /mos:rs-experts <topic> --json
    /mos:rs-experts <topic> --limit 20

## What it does

1. Validates `<topic>` against Canon Part 8 (`auditQueryString` on the bound parameter; throws `ExternalEgressViolation` if forbidden bytes appear).
2. `scripts/rs-experts-command.cjs`'s own BUG 2 fix note (2026-05-22, still current): the former Tier 1 path called `brainClient.query(cypher)`, which routes to the REMOTE Brain -- but Author/Paper/Institution nodes live in the user's LOCAL Aura mirror, not the Brain. That routing bug is fixed by REMOVAL: `brainClient` is never loaded by this command, and `brainClient.isAvailable()` does NOT gate an Aura-availability check here -- it checks the Brain key, a fully separate probe (Phase 252-01, SWEEP-01: this line previously named `brainClient.isAvailable()` as an Aura-availability detector, which was the wrong probe -- the Brain key and the Aura connection are unrelated).
3. No live Tier 1 Aura query path ships in the current command. Every invocation surfaces the Tier 0 guidance message below, pointing to `/mos:rs-fetch`. A local-only Aura transport (not `brain-client.cjs`) restoring an Aura-specific Tier 1 query is a filed follow-up, not yet built.
4. Emits Phase Gate-style transcript (CLI) or JSON (`--json`) carrying the Tier 0 guidance.

## UI Format

- **Body Shape:** D (Comparison Matrix) -- ranked authors with institutions
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- topic + author count
- **Zone 2:** Content Body -- ranked table: Rank / Author / Institution / Papers / Score
- **Zone 3:** Intelligence Strip -- top institution cluster signals
- **Zone 4:** Action Footer -- next-step verbs (`/mos:persona` may be warranted; `/mos:rs-fetch` for fresh papers)

## Three-surface notes

- **CLI:** Phase Gate-style transcript with the ranked table.
- **Desktop MCP:** structured JSON via `--json`; the MCP wrapper renders Larry's narration with top 3 authors as conversational mentions.
- **Cowork:** honors `MINDRIAN_ROOM`; multi-user rooms see the same shared expert list filed in `00_Context/`.

## Tier-0 LOCAL-only base (Canon Part 8, D-200-2 (b) unchanged half)

Expert resolution (Author / Paper / Institution) is **LOCAL-only from `room.db`**. It needs NO Brain call and NO Brain key. Author names, ORCIDs, and institution affiliations are user artifacts (Canon Part 8: people/paper data is LOCAL and NEVER egresses to the Brain). The frontmatter deliberately carries no `mcp__mindrian-brain__*` tool, so this command cannot reach the remote Brain even if a key is present.

Degradation is clean by construction:

- Brain key ABSENT -> no effect; Tier-0 resolves the whole expert network from `room.db`. No throw.
- No live Tier 1 Aura query path ships today (see "What it does" above) -> Tier 0 guidance message pointing at `/mos:rs-fetch`, every invocation.

The people-graph base is the local mind; the Brain is never the source of an expert's identity. This is the unchanged half of navigator decision D-200-2 (b): local-only Tier-0 stays the base.

## Optional Mode-A Brain projection (Canon Part 8, D-200-2 (b) additive half)

On top of the LOCAL-only base, `lib/core/rs-expert-brain-projection.cjs` exposes an ADDITIVE, optional reader: `projectExpertHandles(localExpertNode, opts)`. It reads the Brain expert-network as **GENERIC framework/enum handles ONLY** (framework names, methodology enums, domain slugs) - never a person's name, affiliation, ORCID, or any Author/Institution byte. It is the substrate the Phase 203 synthetic-expert reader consumes.

Its Part-8 contract is load-bearing and enforced in code + proven by `tests/test-200-brain-projection.cjs`:

- **Outbound:** only a tight whitelist of methodology-enum keys (`framework` / `domain` / `methodology` / `problem_type` / `enum` / `tier`) is ever read off the local expert node. Person keys are never read, so a person byte cannot enter the outbound payload by construction. A belt-and-suspenders token-level leak scan then fails the whole projection closed if any person byte still appears.
- **Guard:** EVERY Brain call routes through the Phase 196 boundary guard (`part8-egress-guard.classify()`). A verdict that is not `allow` - or a guard throw - degrades to Tier-0 (returns `[]`), never an error.
- **Inbound:** the read keeps only generic framework/enum handles; any returned handle that echoes a specific person's identity is dropped. If that leaves nothing, it returns `[]`.
- **Degrade:** Brain absent (no key / no MCP) => `[]` (pure Tier-0 degrade), no throw.

The projection reuses the shipped Phase 196 guard and `rs-brain-substrate` read surface (Canon Part 7); it adds no second Brain client.

## Canon References

- **Canon Part 7 (Reuse Before Build):** consumes existing `brain-client.cjs` Aura session. Zero forks.
- **Canon Part 8 (Graph Boundary):** topic is parameterized as `$topic` (NO string concatenation). Audited via `auditQueryString` BEFORE binding. The Aura is a LOCAL Brain mirror per Canon Part 8; this command does NOT query the remote Brain methodology graph.

## Examples

    /mos:rs-experts "quantum brain imaging"
    /mos:rs-experts "fintech KYC" --json
    /mos:rs-experts "carbon capture" --limit 50

## Error patterns

3-line error format:

    x Aura not connected
      Why: rs-experts requires a local Aura mirror; no live Tier 1 Aura query path
           ships yet (remote Brain is never used for Author/Paper data)
      Fix: /mos:rs-fetch <topic> first to populate the local SQLite mirror, then retry

    x No experts found for topic
      Why: zero rows matched topic <topic> in Aura
      Fix: /mos:rs-fetch <topic>

    x Canon Part 8 audit failed
      Why: forbidden bytes in topic argument (ExternalEgressViolation)
      Fix: rephrase the topic without user-content placeholders

## Voice

Larry direct:

> "Mapped <N> experts across <M> institutions. Leading: <top institution>. /mos:persona may be warranted to build the engagement strategy."

> "Aura not connected. Run /mos:rs-fetch first to populate the mirror, then I can resolve the expert network."
