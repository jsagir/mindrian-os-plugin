# F-Selector Consumer Guide (Phase 125)

> How to consume the F-selector ranker from Phase 116 (tension hook), Phase 117
> (auto-explore), `/mos:suggest-next`, `/mos:act`, or any other surface that
> shows the user a top-K of next-move commands.

Version: 1.0 (Phase 125-08, 2026-05-14)
Status: Active
Canon parts: Part 3 (F-shape selector contract), Part 4 (every choice is graph
data), Part 7 (reuse before build), Part 8 (graph boundary), Part 9 (SQL
navigates).

---

## The three surfaces

Phase 125 exposes three call surfaces:

1. **`rankForSelector`** -- pure synchronous function. Call any time. Returns
   top-K ranked commands. Zero side effects.
2. **`recordSelectorDecision`** -- writes user's F.0 accept / F.1 defer / F.2
   reject decision to the graph. memory_event + typed cascade edge.
3. **`recordSelectorMiss`** -- writes the "none fit" tuning signal. memory_event
   only (no edge). Consumer routes to `/mos:do` with the user_intent.

Rendering helpers (also exposed):
- `renderInvestmentBadge(investment_level) -> string`
- `renderSliceBadge(slice_scope, slice_rationale) -> string`
- `renderNoneFitAffordance() -> string`  // returns "None fit -- tell me what you need"

Filter helper (Plan 06):
- `shouldExclude(command_id, roomState) -> boolean`

---

## Wiring contract (READ BEFORE TYPICAL WIRING)

Two preconditions consumers MUST satisfy before calling rankForSelector + decisions:

1. **`packetOptional` MUST be an already-resolved packet** -- the result of
   `await buildBrainPacket(...)`, NOT a raw Promise. rankForSelector is
   synchronous; passing a Promise will silently degrade to the no-packet path
   because a Promise has no `local_graph_summary` field. Always await your
   packet build BEFORE invoking the ranker.

2. **Populate `roomState.db` BEFORE calling rankForSelector,
   recordSelectorDecision, or recordSelectorMiss.** The db handle is read from
   `roomState.db` per the CONTEXT.md locked signatures (D7 + D8 honor the
   locked shape; db is not a separate top-level param). If `roomState.db` is
   absent:
   - `applyDecayWeight` silently returns the base_score unchanged (decay is a
     no-op). Acceptable for tests, mocks, and Tier-0 sessions.
   - `recordSelectorDecision` and `recordSelectorMiss` BOTH return
     `{ ok: false, reason: 'invalid_db' }`. These are the user-action writers;
     they MUST have roomState.db.

## Typical wiring (pseudocode)

```javascript
const ranker = require('../workflow/f-selector-ranker.cjs');
const decisions = require('../workflow/selector-decisions.cjs');

// 0. PRECONDITION: roomState.db must carry the SQLite handle.
//    PRECONDITION: maybePacket must already be resolved (await buildBrainPacket).

// 1. Compute the top-K. Pure sync. Pass packetOptional if you already have a
//    built Brain packet for richer scoring.
const items = ranker.rankForSelector({
  jtbd: roomState.activeJtbd,
  problemType: roomState.problemType,
  focusNodeId: roomState.activeFocus,
  roomState,                     // MUST carry roomState.db for decay-weight to apply
  packetOptional: maybePacket,   // optional; null is fine; MUST NOT be a Promise
  k: 3,
  _applyDecayWeight: decisions.applyDecayWeight,  // wires Plan 06 decay
});

// 2. Render the F-shape (F.1 Next Move family). Each item carries `command`,
//    `jtbd_label`, `why`, `score`, `investment_level`. Place the badges:
const investmentBadge = ranker.renderInvestmentBadge(items[0].investment_level);
const sliceBadge = ranker.renderSliceBadge(
  packet?.local_graph_summary?.framework_chain_hint?.slice_scope ?? 3,
  packet?.local_graph_summary?.framework_chain_hint?.slice_rationale ?? ''
);
const noneFit = ranker.renderNoneFitAffordance();
// Show items + investmentBadge + sliceBadge + noneFit affordance to user.

// 3a. User picks F.0 accept -> run the chosen command (consumer responsibility).
// 3b. User picks F.1 defer or F.2 reject:
//     NOTE: db is NOT passed -- it is resolved via roomState.db per locked signature.
decisions.recordSelectorDecision({
  decision: 'defer',    // or 'reject'
  command: items[chosenIndex].command,
  framework: items[chosenIndex].framework,
  reason: userTypedReason,           // optional; null is fine
  score_at_decision: items[chosenIndex].score,
  roomState,                         // MUST carry roomState.db (preconditions section)
});
// Both memory_event + typed cascade edge are written through navigation.cjs.

// 3c. User picks "none fit" and types free-text intent:
//     NOTE: db is NOT passed -- it is resolved via roomState.db per locked signature.
const miss = decisions.recordSelectorMiss({
  top_k_offered: items.map(i => ({ command: i.command, score: i.score })),
  user_intent: userTypedIntent,
  roomState,                         // MUST carry roomState.db (preconditions section)
});
// Consumer now routes to /mos:do with user_intent (Phase 125 does NOT route).
```

---

## Section 4: The Locked Template for Brain-Suggested Selectors

**Status:** LOCKED (Phase 121.5-10 Sub-plan K, audit punch list item 7). Any future Brain-suggestion consumer MUST adopt this shape; divergence triggers the `tests/test-no-bespoke-brain-prompts.sh` CI tripwire.

**Source of truth:** `.planning/121.5-selector-coverage-audit.md` Section 5. Implementing plan: `.planning/phases/121.5-terminal-coherence-capstone/121.5-10-PLAN.md`.

### 4.1 Why this template exists

Today (pre-Sub-plan K) five surfaces consume Brain-ranked next moves and all five render differently: `/mos:suggest-next`, `/mos:act --chain`, `lib/agents/tension-hook-agent.cjs`, `lib/agents/auto-explore-agent.cjs`, `lib/agents/reverse-salient-agent.cjs`. Different headers, different verb sets, different glyphs, different presence/absence of the RECOMMENDED marker, different routing through `pickShape` (3 of 5 routed; 2 did not). The lock collapses all 5 into ONE shape so:

1. The navigator's eye learns the chip + glyph + footer pattern in one session and recognizes Brain output across every surface.
2. Future Brain-touching selectors inherit the lock for free (zero per-surface design overhead).
3. The CI tripwire prevents regression by failing CI when any new `commands/*.md`, `lib/agents/*.cjs`, or `scripts/*.cjs` reintroduces a bespoke prompt pattern (`Ready to`, `Want to`, `Should I`, `Pick one`, `continue / stop`, `[GATE]` prose).

### 4.2 Slot-value table

| Slot | Locked value | Rationale |
|------|----------------|-----------|
| Header chip (<= 12 chars) | `[■ BRAIN]` | Single canonical glyph (filled-square, the "primary content marker" per `skills/ui-system/SKILL.md` Section 3) plus 5-char brand word. 9 chars including brackets. Navigator's eye learns "■ plus BRAIN = Brain is speaking" inside one session. Distinct from `[GATE]` / `[CONTEXT]` / `[NEXT MOVE]` family by the leading glyph; same bracket envelope keeps it inside the canonical chip vocabulary. |
| Question line | `Choose next move:` | Verb-first imperative. Three words, no parenthetical. "Choose" not "Pick" matches the dispatcher's other prompts. The ranked-ness is implied by the right-aligned scores in the option rows, so the parenthetical "(ranked)" is redundant signal. |
| Option label glyph (recommended) | `▶` (right-triangle-filled) | The 0.7+ confidence top pick from Brain. Filled triangle is the canonical "primary action" glyph per SKILL.md Section 3. One glyph carries the same signal as a verbose `(RECOMMENDED)` tag without consuming horizontal space. |
| Option label glyph (alternatives) | `▷` (right-triangle-empty) | Sub-0.7 alternatives, or any non-top-ranked option. Empty triangle is the canonical "secondary action / collapsed content" glyph. Together with `▶` it creates a one-glyph visual hierarchy the navigator scans in milliseconds. |
| Option row format | Two lines per option. Row 1: `<glyph> <N>. <Run Verb>` left-padded, `<conf>%` right-aligned to the 80-col boundary. Row 2: 5-space indent, `<framework category> · <graph relationship>` | Right-aligned percentage on the verb row is the unique scan signal: navigator's eye lands on the numbers first (right column), then the verb (left), then the meta (below). Confidence as `87%` not `0.87` because percent is universally legible across personas; decimal requires "normalized 0-1 score" tech literacy we should not assume. Meta row gives semantic context (category plus graph edge to next or previous framework) so the navigator sees WHY Brain ranks it. The `·` (middle-dot) is borrowed from the existing Zone 4 footer convention. |
| Zone 1 left-rail color | `cyan` default. Yellow-on-cascade for CONTRADICTS edges DEFERRED to v1.13.2 hotfix per LOCKED decision 3. | Cyan is the canonical "commands / paths / links" color per SKILL.md Section 4, and Brain picks ARE recommended commands. Deferral keeps the rank path latency-free (no SQL cascade walk before render) for the v1.13.0 release; the yellow-on-cascade signal lands as a v1.13.2 hotfix if testers report missed warnings. |
| Footer caption | `▶ Brain · top-<K> of <N> ranked · <color> = informing` -- example: `▶ Brain · top-3 of 12 ranked · cyan = informing` | Stat-strip line. Three signals in one line: provenance (▶ Brain), scale (top-3 of 12 telling navigator "12 candidates considered, 3 surfaced"), and color-legend (reminding navigator that the cyan rail means Brain is informing, not commanding -- Canon Part 3 sub-claim made visible). The leading `▶` matches the same triangle vocabulary as the recommended-option marker, visually linking the footer to the top option. |
| F-variant routing | F.1 default; F.6 when a non-null JTBD is set (per `lib/hmi/selector-dispatcher.cjs` lines 313-345 JTBD lookup); F.0 for binary recommendation confirmation gates upstream of F.1 (e.g. reverse-salient-agent's "is this finding worth my time?" pre-gate); F.5 for branch-resolution surfaces (compare-ventures, scenario-plan) | Matches shipped selector-dispatcher.cjs Phase 101-01 contract verbatim. Locking at "F.1 default, F.6 when JTBD, F.0 for pre-gates, F.5 for branches" requires zero dispatcher changes. |
| Verb-label aliases (LOCKED decision 1) | ALLOW registered aliases. Default 4 aliases: Resolve / Explore -> Run Methodology; Later -> Defer; Skip -> Free-Text. Aliases live in `lib/hmi/jtbd-taxonomy.json` `alias_map.verb_aliases`. Dispatcher carries `alias_map`; consumers call `dispatcher.aliasToCanonical(verb_chosen, contract.alias_map)` at selection time to collapse to canonical for graph-edge persistence. | The agents argue for aliases (Resolve / Later / Skip in Phase 116 tension hook; Explore / Skip / Later in Phase 117 auto-explore) because the contextual verbs read more pedagogically in their specific surfaces than the canonical Run Methodology / Defer / Free-Text. The dispatcher argues for canonical because the graph edges should carry one stable vocabulary. Decision: BOTH. alias_map carries the mapping; aliases render to the user; canonical verbs persist to the graph. The render-vs-persist split honors both arguments without forcing one. |

### 4.3 Visual mockup (what the navigator sees)

```
[■ BRAIN]
Choose next move:

▶ 1. Run SWOT                                    87%
     industry analysis · feeds Porter Five Forces

▷ 2. Run Lean Canvas                             74%
     opportunity decomposition · chains to JTBD

▷ 3. Run Five Whys                               61%
     root cause · diverges from current path

  Type something
  Chat about this
──────────────────────────────────────────────────
▶ Brain · top-3 of 12 ranked · cyan = informing
```

No other F-shape carries scores in the option row. No other F-shape uses the filled/empty triangle pair as the recommended/alternative marker. No other F-shape has a stat-strip footer. The navigator recognizes the Brain selector before reading a word.

### 4.4 Anti-patterns explicitly rejected (UX reasoning)

All considered. All rejected:

- **Colored text inside option descriptions.** Anthropic strips most ANSI inside AskUserQuestion rows; would render inconsistently across surfaces.
- **Box-drawing borders around individual options.** Wraps badly below 80 columns; common on Wave-N tester Windows boxes.
- **More than 3 lines per option.** Pushes the auto-injected "Type something" / "Chat about this" rows off-screen. Enforced by `MAX_K = 3` in `lib/workflow/f-selector-ranker.cjs` (Plan 121.5-10 Task 1).
- **Invented glyphs or invented chip patterns.** Breaks the 12-glyph + canonical-bracket-chip vocabulary documented in SKILL.md Section 3.
- **Telemetry meta row** (`12 calls · 8d ago`). "Popular content" energy turns Brain into a trending feed; risks Canon Part 8 if telemetry crosses the LOCAL/BRAIN boundary; semantic meta is the safer canonical pick. Reserve telemetry for a v2 second-row option if ever needed.
- **Highlighted-bar focus indicator** (Lazygit-style). AskUserQuestion's cursor IS the `>` chevron in the left margin; we cannot repaint it as a colored bar without forking Claude Code. The triangle vocabulary inside the option rows is our compensation: it draws the eye to hierarchy independent of the platform cursor.

### 4.5 Implementation wiring

The dispatcher accepts `payload.brain_suggestion_variant: true` along with the locked-template fields:

```javascript
const dispatcher = require('../hmi/selector-dispatcher.cjs');
const ranker = require('../workflow/f-selector-ranker.cjs');

// 1. Rank top-K (MAX_K = 3 clamps automatically).
const items = ranker.rankForSelector({
  jtbd: roomState.activeJtbd,
  problemType: roomState.problemType,
  roomState,
  packetOptional: maybePacket,
  k: 3,
});

// 2. Dispatch with the locked Brain-suggestion variant payload.
const result = dispatcher.pickShape({
  requestedShape: 'F.1',
  payload: {
    brain_suggestion_variant: true,                // toggles the overlay
    header: '[■ BRAIN]',                            // locked chip
    questionLine: 'Choose next move:',              // or per-surface variant
    verbs: items.map(i => i.command),
    alias_map: jtbdTaxonomy.alias_map.verb_aliases, // LOCKED decision 1
    recommendedVerb: items[0].score >= 0.7 ? items[0].command : null,
    optionRows: items.map((i, idx) => ({
      glyph: i.score >= 0.7 ? '▶' : '▷',
      number: idx + 1,
      verb: i.command,
      confPct: Math.round(i.score * 100),
      meta: `${i.category} · ${i.graph_relationship}`,
    })),
    footer: `▶ Brain · top-${items.length} of ${totalRanked} ranked · cyan = informing`,
  },
});

// 3. On selection, collapse alias to canonical for graph edge persistence.
const canonicalVerb = dispatcher.aliasToCanonical(
  result.selection.verb,
  result.rendered.contract.alias_map,
);
```

The overlay runs AFTER the renderer returns and BEFORE the AskUserQuestion structural-marker trailer is appended. Consumers who do NOT pass `brain_suggestion_variant: true` get the legacy renderer output byte-for-byte (the overlay is opt-in).

---

## What each consumer surface owns

| Consumer | Responsibility |
|---|---|
| Phase 116 (tension hook) | Calls rankForSelector for PULL mode when a tension is detected. Renders the top-K in the tension-resolution menu. |
| Phase 117 (auto-explore) | Calls rankForSelector for PUSH mode at decision gates. Owns the trigger policy: which gates, after which commands, with what frequency. |
| /mos:suggest-next | Calls rankForSelector once per invocation. Renders the F.1 Next Move shape. |
| /mos:act | Same as suggest-next but routes the chosen command itself (not Phase 117). |

## Filter helper: shouldExclude

If you want to drop freshly-rejected commands from top-K entirely (rather than
showing them bottom-ranked), call `decisions.shouldExclude(command_id, roomState)`
before adding to the user-facing list. The threshold is 0.1 (configurable in v2).

At invocation 0 (factor=0) the command is excluded by shouldExclude; at
invocation 1 (factor~=0.181) it's included with decayed weight. Freshly-decided
commands disappear from the very next selector but resurface at the
second-to-next, ramping up toward full weight over the 5-invocation window.

## Canon Part 8 invariants

- `rankForSelector` issues ZERO Brain calls. It consumes packetOptional but
  never queries Brain itself.
- `recordSelectorDecision` writes through `navigation.logMemoryEvent` +
  `navigation.writeEdge` ONLY. No direct room-db access.
- `recordSelectorMiss` writes the user's free-text `user_intent` LOCALLY only.
  Never serialize `user_intent` into a Brain packet. If you need to query Brain
  about a missed pattern, send only generic framework handles + phase identifiers,
  never the user's typed text.

## D11 fallback (graceful degradation)

If `jtbd_summary` or `teaching` is missing for a command, `rankForSelector`
EXCLUDES that command from the top-K. This is the documented fail-closed path
per CONTEXT.md D6 + D11. Phase 104.1 ships the content for all commands;
post-104.1, this path should never trigger for shipped commands.

## See also

- `lib/workflow/f-selector-ranker.cjs` -- the ranker source
- `lib/workflow/selector-decisions.cjs` -- the decision + miss writers
- `.planning/phases/125-f-selector-ranker/125-CONTEXT.md` -- the design lock
- Canon Part 3 (F-shape selector contract) + Part 4 (every choice is graph data)
- Canon Part 8 (the graph boundary -- LOCAL never to BRAIN)
- Canon Part 9 (memory locality and interpretation)
