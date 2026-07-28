---
name: room-proactive
description: >
  Proactive Data Room intelligence. Surfaces gaps, contradictions, and convergence
  signals. Active when room/ exists with entries.
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
activation: "resolve_room:active"
paths:
  - "**/STATE.md"
  - "**/ROOM.md"
  - "**/MindrianRooms/**"
  - "**/.rooms/**"
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on infra. The proactive cross-relationship scan runs after every filing as part of the ambient loop; a continuous substrate, not a single problem-state reach."
hitl_stages:
  - stage: "proactive-finding-response"
    shapes: ["F.0"]
    mode: "gate"
  - stage: "filing-offer-close"
    shapes: ["F.1"]
    mode: "gate"
hitl_why: "Two independent decision-close moments: an APPROVE/REJECT/DEFER mini-gate on a surfaced finding, and an F.1 Next Move gate when offering to file a conversation artifact."
---

# Room Proactive -- Gap, Contradiction, and Convergence Detection

The Room is an active thinking partner. This skill surfaces what is missing, conflicting, and strengthening.

## Skill Activation

This skill activates when `scripts/resolve-room` finds any active room with entries. The resolver checks (in order): central registry at `~/MindrianRooms/.rooms/registry.json`, directory scan under `~/MindrianRooms/`, workspace registry, and legacy `room/` fallback. All analysis below operates on the resolved room path.

## Activation Triggers

| Trigger | Behavior |
|---------|----------|
| SessionStart | Max 2 HIGH findings. Prioritize 1 gap + 1 convergence (or contradiction). |
| /mos:status | All HIGH + MEDIUM findings grouped by type. |
| /mos:room --insights | Full analysis including LOW with interpretation. |
| Methodology session | NEVER interrupt. Save for next SessionStart. |
| PostToolUse (cascade complete) | When additionalContext matches `^post-write: cascade complete` OR `^queued MINTO regen`, read `<roomDir>/.mindrian/last-cascade.json`. If `proactive_intelligence.newFindings` is non-empty, present max 2 for APPROVE/REJECT/DEFER using Decision Capture flow. |

## Gap Detection

- **Single-lens:** All entries from same methodology. Suggest complementary.
- **Evidence gap:** Entries without validation/evidence markers.
- **Adjacent section:** Connected sections filled, bridging section empty.
- **Depth gap:** All entries at `depth: quick`.

Phrase as opportunities, not criticisms. Suggest specific commands.

### Team-Execution Leadership Signals

Detect these conditions in `room/team-execution/` and `room/team/`:

| Signal | Condition | Confidence | Message |
|--------|-----------|------------|---------|
| `GAP:TEAM:no_profiles` | team-execution/ has 0 member profiles AND team/members/ empty or missing | HIGH | "No team mapped yet. Leadership starts with knowing who you're leading. Try: /mos:leadership" |
| `GAP:TEAM:no_mentors` | team/mentors/ empty or missing AND 3+ team members exist | MEDIUM | "Team of [N] with no advisors mapped. Most ventures this size benefit from external perspective." |
| `GAP:TEAM:solo_founder` | Only 1 person in team/ AND venture_stage past Pre-Opportunity | MEDIUM | "Solo at [stage] stage. The question isn't if you need a team -- it's what kind." |
| `GAP:TEAM:no_assessment` | team-execution/ has member profiles but no leadership assessment artifact | MEDIUM | "Team profiles exist but no leadership assessment. Run /mos:leadership to diagnose team dynamics." |
| `GAP:TEAM:stale_assessment` | Leadership assessment artifact older than 30 days AND room has new entries | LOW | "Leadership assessment is [N] days old. Team dynamics shift -- worth revisiting." |

## Contradiction Detection

Scan for incompatible claims: customer type, market size, problem definition, timing assumptions.

Frame as tensions worth reconciling. Check `created:` dates -- natural evolution (old X -> recent Y) is progress, not contradiction.

### Team-Execution Contradictions

| Signal | Condition | Confidence | Message |
|--------|-----------|------------|---------|
| `CONTRADICT:TEAM:capacity_mismatch` | solution-design requires capabilities not present in any team profile | HIGH | "Solution design needs [capability] but no team member covers it. Hire, partner, or simplify?" |
| `CONTRADICT:TEAM:stage_mismatch` | Team structure suggests Ready to Build but venture_stage is Pre-Opportunity | MEDIUM | "Full team assembled but problem isn't validated yet. Building before validating is the #1 startup killer." |

## Convergence Detection

Same domain/customer/risk/theme in 3+ artifacts from different methodologies. Phrase as signal strength.

## Confidence Scoring

| Level | Criteria | Display |
|-------|----------|---------|
| HIGH | Direct structural evidence, 3+ entries, clear conflict | SessionStart |
| MEDIUM | 2 entries, keyword overlap, single-lens | /mos:status |
| LOW | Single entry inference, weak match | Explicit request only |

## Noise Gate

1. SessionStart: max 2 findings
2. Never interrupt methodology
3. Stage filtering: Pre-Opportunity suppresses financial/legal gaps. Investment elevates all gaps.
4. Never repeat unchanged findings consecutive sessions

## Mid-Session Intelligence

When the post-write cascade completes, the bash hook emits a tight one-line `additionalContext` advisory and writes the full cascade payload to a side-channel file at `<roomDir>/.mindrian/last-cascade.json`. This skill reads the side-channel file when it sees the trigger pattern, then renders findings using the cool-UI style canon (banner with rules + status grid + Shape A summary - NEVER raw prose).

### Detection

The post-write hook's `additionalContext` matches one of two patterns:
- `^post-write: cascade complete for ` (writes outside a recognized room section; payload is minimal)
- `^queued MINTO regen for ` (writes inside a section; payload is full)

When EITHER pattern fires, read `<roomDir>/.mindrian/last-cascade.json` (where `<roomDir>` is the path returned by `scripts/resolve-room` - the active room). Use the Read tool. The file is LOCAL only per Canon Part 8; never query the Brain or any network surface during this read.

### Behavior

1. If the side-channel file does not exist or fails to parse: the cascade did not produce intelligence. Do nothing. Soft-fail.
2. If `proactive_intelligence.newFindings` is empty or missing: the cascade ran but found nothing new. Do nothing.
3. If `proactive_intelligence.suppressed > 0`: silently note the suppression count. Do NOT mention it to the user.
4. If `newFindings` has 1+ items with `confidence >= 0.60`: present using the "After Filing: Decision Capture" flow below. Max 2 findings (highest confidence first).
5. If a finding has `isNew: false`: it is a previously-seen finding with new evidence. Present with the "I've seen this signal before" framing.
6. NEVER interrupt during a methodology session. Save for next non-methodology turn.

### Render Contract (cool-UI style canon)

The cascade-finding render uses the cool-UI style from `.planning/research/cool-ui-style-reference.md`. Specifically:

- **Banner** with thin horizontal rules (`━`) and a `►` separator. Title format: ` ROOM ► CASCADE FINDINGS` (one leading space; ALL CAPS; no em-dash).
- **Status grid** with two-space indent, glyph at column 0, label-then-value with alignment whitespace (no colons; alignment IS the punctuation). Glyph vocabulary is fixed:
  - `◆` active / in-flight / configured (use for section + artifact rows)
  - `⚠` warning / contradiction (use for contradiction findings)
  - `⚡` urgent / convergence (use for convergence findings)
  - `⬜` gap / pending (use for gap findings)
  - `▶` next-action callout (single row at bottom of grid pointing to the decision verbs)
- **Soft prose paragraph** below the grid: 2-3 sentences explaining WHY this finding matters in this venture's context. Plain prose, not bullets.
- **Decision prompt** routes through the existing prose APPROVE/REJECT/DEFER flow (see "After Filing: Decision Capture" below). The F.0 AskUserQuestion selector is INTENTIONALLY deferred to Phase 88.2 / Phase 97 per `room/decisions/decision-phase-95-sequencing.md`. Phase 95 only changes WHERE the finding payload comes from, not the renderer itself.

Example render (one contradiction finding, confidence 0.78):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ROOM ► CASCADE FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ◆ section          problem-definition
  ◆ artifact         customer-discovery-2026-04-29.md
  ⚠ contradiction    customer-type vs market-size (confidence 0.78)
  ▶ next             APPROVE / REJECT / DEFER

The customer-type claim in this artifact (mid-market enterprise) sits in
tension with the market-size assumption you filed in business-model
last week (SMB segment). Worth reconciling before the next funding round.
```

NO emoji. NO em-dashes. Glyphs only. Aligned columns. The alignment IS the punctuation.

### New Evidence Indicator

If a finding has `isNew: false`, it means this is a PREVIOUSLY SEEN finding that has NEW EVIDENCE (confidence or message changed). Present with the "I've seen this signal before" framing in the soft prose paragraph below the grid:

"I have seen this signal before, but new evidence just shifted it. [finding message]. Confidence is now [0.xx] (was different before)."

This distinguishes updated findings from brand-new discoveries and helps the user understand why they are seeing something again.

### Why a side-channel file (not in-band JSON)

The PostToolUse envelope's `additionalContext` is a one-line string. The cascade payload contains structured data (classification, gitCommit, graphIndex, proactiveIntelligence with arrays of findings). Embedding it in the `additionalContext` string would (a) blow past the practical line-length budget, (b) require the skill to parse JSON-in-a-string, (c) couple the skill's contract to envelope-schema churn. The side-channel keeps the envelope clean and the data structured. This pattern is canonical in the plugin (see Phase 88-08 `pre-compact-snapshot.json`, Phase 88-06 `session-snapshot.json`). LOCAL only per Canon Part 8.

NOTE: This contract REPLACES the previous load-bearing-broken-since-88.1-03 detection that read the cascade payload from the PostToolUse `additionalContext` envelope. The bash hook never wrote the cascade payload at the location the skill expected. Phase 95 corrects the data flow by relocating the payload to the side-channel file. The prose APPROVE/REJECT/DEFER renderer below (existing APPROVE/REJECT/DEFER flow at "After Filing: Decision Capture") is BYTE-IDENTICAL to current - only the input source has changed.

## Proactive Filing Offer (Conversation Artifact Capture)

The cascade flow above fires when an artifact is WRITTEN. This section covers the case BEFORE that: when a CONVERSATION (not a /mos: command run) yields a keepable artifact, Larry proactively offers to file it before moving on. The conversation IS the work product; the offer is what turns it into a receipt (Canon Part 10, "the room as receipt"). The silent failure mode this guards against: good thinking that is never filed is gone, and a new navigator does not know to ask.

This is doctrine, not a deterministic hook. The "a keepable artifact just appeared" judgment is Larry's, made by reading the conversation, not by a bash detector. The OFFER routes through machinery that already exists - the Decision Gate, the canonical verbs, the AskUserQuestion selector. No new verb, no new selector format, no new engine (Canon Part 7 reuse).

### What it is

When a discuss chunk settles into something the navigator would want again - a sharpened problem definition, a grounded competitive landscape, a chosen direction, a pilot or Phase 0 design, a synthesis - Larry closes the turn with a one-line offer to file it. He does not silently let it evaporate, and he does not wait to be asked.

### Triggers (offer)

Offer at a natural artifact boundary, when EITHER the navigator has agreed to a framing OR a self-contained work product has formed:

| Trigger | What just settled |
|---------|-------------------|
| Problem definition articulated or reframed AND the navigator agrees | A sharpened or re-expressed problem statement |
| Competitive landscape / market scan produced | A grounded set of competitors, alternatives, or market structure |
| A decision or direction is chosen | The navigator picks a path among options |
| A plan / pilot / Phase 0 design is produced | A concrete next-step protocol the navigator could run |
| A synthesis the navigator would want again next session | A wrap that collapses branches back to insight |

### Anti-triggers (do NOT offer)

One offer per artifact. Honor the escape hatch. Do NOT offer when:

- Mid-exploration with no settled artifact - the thought is still forming.
- Small talk, greetings, or a clarifying side-question.
- The navigator is mid-thought (a trailing "...", an unfinished list, an explicit "hold on").
- An offer was already made and declined this turn-cluster - no repeat nagging on the same artifact.
- A methodology session is live - NEVER interrupt; the filing already routes through that command.

The cadence rule mirrors the Noise Gate above: when in doubt, stay quiet. A wrong offer is worse than no offer.

### How to offer (existing selector, existing verbs)

Close the turn with a Decision Gate F.1 Next Move selector (the AskUserQuestion primitive, the default after a discuss chunk per Canon Part 3). The options map onto the EXISTING canonical verbs - do NOT invent a "File this" verb:

| Option (what the navigator gets) | Canonical verb (Part 3) | Where it routes |
|----------------------------------|-------------------------|-----------------|
| File it | Run Methodology | Route to the matching /mos: command that files this artifact type, resolved at surface-time (problem definition -> /mos:diagnose or /mos:structure-argument output; landscape -> /mos:research or /mos:compare-ventures; pilot/plan -> file as a decision/artifact). Larry never types the slug from memory; the resolver late-binds it. |
| Bank it | Bank Opportunity (ADD) | When the artifact is an opportunity, ADD to the local Opportunity Bank with HSI score + domain tags. |
| Not yet | Defer | DEFER edge; the gate remembers and re-surfaces at a milestone audit. |
| Free-Text | Free-Text | Always available; Larry interprets and routes to one of the above. |

The selector is F.1; the verbs are the canonical ten. A "Synthesize" option is offered instead of "File it" when the artifact is a wrap that collapses branches (Part 3 verb 7). The vocabulary is closed - this offer adds no verb to it.

### Reason capture (decline is data)

A decline is the most valuable signal in the system (Canon Part 4; Decision #13). When the navigator picks "Not yet" or declines, capture the reason with ONE low-friction line - never block, never re-prompt: "Got it - parking it. One line on why, so I do not re-offer the same thing?" The reason becomes graph data; silent rejection is the failure mode the gate must make trivially easy to avoid.

### Surface-agnostic

The F.1 / AskUserQuestion path works identically on CLI, Desktop, and Cowork. The offer is conversational on every surface - no surface-specific code (Tri-Polar rule).

### Part 8 (local-only)

Filing writes LOCAL room artifacts / room.db only. The offer never queries the Brain. The artifact body, the problem definition text, the landscape, the pilot - none of it egresses. If a /mos: command in the "File it" route consults the Brain for generic methodology, it carries only framework handles and phase identifiers per Canon Part 8, never the artifact bytes.

## After Filing: Decision Capture

When the post-write cascade completes and the side-channel reader (above) finds `newFindings` in `<roomDir>/.mindrian/last-cascade.json`, present findings to the user for decision.

### When to Present

- ONLY when the side-channel file exists AND `proactive_intelligence.newFindings` has 1+ items
- ONLY present findings with confidence >= 0.60
- Max 2 findings per filing (pick highest confidence)
- NEVER present during a methodology session (save for next filing)
- NEVER re-present findings already marked `decided: true`

### How to Present

Format each finding as a natural observation, not a system alert:

"I noticed something while filing that [artifact title]. [Finding message]. Confidence: [0.xx]

This [CONTRADICTS/creates a GAP in/CONVERGES WITH] your [section name].

What would you like to do?
- **APPROVE** -- accept this impact (I'll note the cross-subsystem connection)
- **REJECT** -- disagree with this finding (tell me why -- your reasoning becomes data)
- **DEFER** -- park this for later review"

### How to Record

When the user responds, run this command via Bash:

For APPROVE:
```bash
node bin/mindrian-tools.cjs record-decision --room ROOM_PATH --key "INSIGHT_KEY" --decision approve
```

For REJECT (reason is REQUIRED -- ask for it if not provided):
```bash
node bin/mindrian-tools.cjs record-decision --room ROOM_PATH --key "INSIGHT_KEY" --decision reject --reason "USER_REASON_HERE"
```

For DEFER:
```bash
node bin/mindrian-tools.cjs record-decision --room ROOM_PATH --key "INSIGHT_KEY" --decision defer
```

Where:
- ROOM_PATH is the resolved room directory path
- INSIGHT_KEY is the finding's dedup key (format: `type:subtype:section` for gaps, `convergence:term` for convergence, `contradiction:section1:section2` for contradictions)

If the finding references specific artifacts with IDs, add `--source-artifact` and `--target-artifact` flags to create a graph edge.

### Rejection is Data (Decision #13)

When a user rejects a finding, their reason is the most valuable signal in the system. ALWAYS capture the reason. If the user says just "no" or "reject", ask: "Got it -- can you tell me briefly why? Your reasoning helps me learn what matters for this venture."

### After Recording

Confirm briefly: "Noted -- [decision]. [If reject: Your reasoning is now part of the room's intelligence.]"

Do NOT follow up with more findings. One decision interaction per filing. If there were 2 findings presented, capture both decisions before moving on.

## analyze-room Signal Format

- `GAP:STRUCTURAL:{section}:{confidence}:{message}`
- `GAP:SEMANTIC:{section}:{confidence}:{message}`
- `GAP:ADJACENT:{section}:{confidence}:{message}`
- `CONVERGE:{term}:{count}:{confidence}:{message}`
- `CONTRADICT:{section1}:{section2}:{confidence}:{message}`

Script catches structural patterns; add semantic interpretation from actual Room entries.

## Capability Suggestions

`CAPABILITY:{feature}:{confidence}:{message}` signals when room has enough data for features:

| Feature | Threshold | Command |
|---------|-----------|---------|
| DASHBOARD | 3+ artifacts | `/mos:room view` |
| EXPORT_DASHBOARD | 7+ artifacts | `/mos:room export` |
| WIKI | 5+ artifacts + 1+ meeting | `/mos:wiki` |
| MEETING_REPORT | 3+ artifacts + 2+ meetings | `/mos:export meeting-report` |
| THESIS | 10+ artifacts | `/mos:export thesis` |
| TEAM_VIEW | 2+ team profiles | `/mos:room view` |
| LEADERSHIP_COACHING | 2+ team members + no leadership artifact | `/mos:leadership` |

Max 1 capability suggestion per SessionStart. Natural voice. Never repeat used commands.

## Causal Discovery Surfacing (v1.7.0)

Surface causal discoveries when graph has 5+ CausalClaim nodes AND 3+ CASCADES_TO edges:
- CausalClaim + HSI_CONNECTION: explain the cause-effect behind similarity
- CausalClaim through REVERSE_SALIENT: show chain to bottleneck root
- CausalClaim + ANALOGOUS_TO: structural match prediction
- Overdue predictions: prompt review
- Cascade depth >3: warn about blast radius

## Dashboard Export Integrity

ALWAYS use `scripts/generate-standalone` or `scripts/serve-dashboard`. NEVER generate HTML by hand.
