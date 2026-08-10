# Phase 250: Honesty Rail + Doctrine Amendment - Research

**Researched:** 2026-08-10
**Domain:** Refusal doctrine, constitutional amendment mechanics, provenance marking (plugin-internal; zero new dependencies)
**Confidence:** HIGH (every claim below grepped or read from this repo's own files this session; external grounding cited from the two filed consultations)

## Summary

Phase 250 kills the silent-fallback doctrine at its three homes (the brain-connector SKILL.md clause, the tier0-messaging chokepoint's graceful-degradation framing, and the dist bundle mirrors), replaces it with a visible refusal surface that renders in-turn in Larry's voice and auto-queues enrichment through the 249-01 queue (`source: 'refusal'` is already reserved and validated in `enrichment-queue.cjs`), drafts the Decisions #1 + #8 rewrite as ONE reviewable amendment document carrying the outage causal record inside it, and gives graph-grounded answers a provenance mark reusing the existing `[■ BRAIN]` chip vocabulary (ui-system, F.7 header chip precedent) so absence of the mark IS the Larry-voice signal - the same absence-is-the-signal design the voice-color marks already ship.

Three load-bearing discoveries change how the planner should cut this phase. First, the R16 gate (`scripts/check-shape-declaration.cjs` predicate 2b) flags Form A `hitl_shape` + `connector.excluded:true` as a contradiction, so brain-connector's refusal fork must declare via Form B `hitl_stages` (the larry-personality precedent), keeping its required CIRS R1 exclusion intact. Second, the shim (`bin/mindrian-brain-mcp-client.cjs`) currently conflates transport failure (`r == null`) with the no-key sentinel, so an unreachable Brain with a VALID key reports "MINDRIAN_BRAIN_KEY not set" - a live dishonesty bug the chokepoint flip must split into distinct refusal kinds. Third, the amendment-sweep lockstep (ROADMAP Progress, HARD) means the amendment can merge as a ratified document in 250 with an explicit effective clause tied to the SWEEP release, while the `decisions.md` row application rides Phase 252's release - that is the only sequencing that never leaves a cut claiming Brain-required while guards silently degrade.

**Primary recommendation:** Three plans - (1) HONEST-01 refusal rail: extend tier0-messaging with typed refusal kinds mapped to the data4sci four-class error taxonomy, rewrite the SKILL.md doctrine sections, fix the shim conflation, wire refusal auto-queue, rebuild dist, ship a doctrine grep fence; (2) HONEST-02 amendment: one dated amendment doc with causal record + verbatim replacement rows + effective clause, plus the Form B hitl_stages declaration; (3) HONEST-03 provenance + SEED-011: the `■ BRAIN` source-line contract on all three surfaces plus a navigator-gated key-ceremony decision (recommend option A, per-install silent registration).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HONEST-01 | The silent-fallback clause is dead everywhere: a Brain failure or a readiness miss surfaces to the user in-turn, plainly, and never as a quieter Larry. (Extends brain-connector; no fourth brain skill, Part 7.) | "Doctrine site enumeration" (complete grep census), "The refusal surface" (message shapes per kind, Larry copy), "The chokepoint flip" (tier0-messaging + shim conflation fix), "Refusal auto-queues enrichment" (enqueue with source refusal; CLI `--source refusal` already validated) |
| HONEST-02 | Doctrine amendment rewrites Decisions #1 and #8 TOGETHER as one reviewable unit, with the causal record (the weeks-long invisible outage) inside the amendment text. hitl_shape declared for the refusal fork (Part 11 / CIRS). | "The amendment structure" (single-doc unit + effective clause + row application timing), "hitl declaration mechanics" (Form B hitl_stages, F.1, gate predicate 2b evidence) |
| HONEST-03 | Larry-served methodology carries provenance: graph-grounded answers are distinguishable from Larry-voice conversation, and SEED-011 resolves the key ceremony so honesty does not become nagging. | "Provenance marking" (the ■ BRAIN chip reuse, Tri-Polar rendering, anti-nagging rules), "SEED-011 key ceremony" (ceremony today, options A/B/C dispositions, minimal resolution) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Refusal message shapes (typed, byte-stable) | `lib/core/tier0-messaging.cjs` (CJS chokepoint) | - | Canon Part 9: ONE file decides what a failing/keyless session gets; the behavior flips in one place (tier0 handoff section 4) |
| Refusal rendering in-turn (Larry voice, F.1 card) | `skills/brain-connector/SKILL.md` (instruction layer) | commands that consult methodology | On Desktop/Cowork Larry reaches `pws-brain-mcp` MCP tools directly, bypassing brain-client entirely; SKILL.md is the ONLY lever on that path (249-01 finding, SKILL.md line 113) |
| Transport truth (null / tier_denied / invalid_key) | `lib/core/brain-client.cjs` (already done, 247-02) | shim `bin/mindrian-brain-mcp-client.cjs` | Sentinels landed in 247-02; the shim must stop mapping transport null to the no-key sentinel |
| Refusal auto-queue | `lib/core/enrichment-queue.cjs` `enqueue()` + `scripts/enrichment-queue-append.cjs` | - | 249-01 built the queue with `'refusal'` pre-validated in `ALLOWED_SOURCES` precisely so 250 wires without touching the module (enrichment-queue.cjs line 69) |
| Doctrine text (constitution) | `docs/` amendment doc + `.claude/includes/decisions.md` | `CLAUDE.md` lines 19/84 (252's sweep) | Amendment is a document; row application is lockstep-bound to the SWEEP release |
| Provenance mark | SKILL.md instruction + ui-system vocabulary | `lib/hmi/voice-color-mark.cjs` (must NOT collide) | The mark is an instruction-layer contract; the 5-color voice-mark set is frozen and must stay exactly-one-per-turn |
| hitl declaration + gate | `skills/brain-connector/SKILL.md` frontmatter | `scripts/check-shape-declaration.cjs`, `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` | R16: the declaration travels with the surface file itself |

## Standard Stack

### Core (all existing - this phase installs NOTHING)

| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `lib/core/tier0-messaging.cjs` | shipped (127-02) | The single keyless-session chokepoint; sentinel shape byte-locked | Canon Part 9 one-place flip; consumers: shim, tests, Larry prose [VERIFIED: read this session] |
| `lib/core/brain-client.cjs` | shipped (247-02 + 249-01) | `tier_denied` / `invalid_key` sentinels; transport null; capture opts on `orchestrationReadiness`/`discoverStructure` | The transport truth HONEST-01 surfaces already exists; 250 renders it, does not re-derive it [VERIFIED: read] |
| `lib/core/enrichment-queue.cjs` | shipped (249-01) | `enqueue()` with `source: 'refusal'` pre-validated; idempotent by framework | "validated now so 250 wires without touching this module" - its own header [VERIFIED: read] |
| `scripts/enrichment-queue-append.cjs` | shipped (249-01) | One-line Bash append; `--source` flag | "Phase 250's refusal rail both need" - its own header names 250 as a consumer [VERIFIED: read] |
| `scripts/check-shape-declaration.cjs` | shipped (190/209/210) | R16 gate; ADVISORY by default, `--strict` hard-fails | The hitl_shape gate HONEST-02 must pass [VERIFIED: read lines 180-320] |
| `scripts/build-dist-bundles.cjs` | shipped | Regenerates `dist/generic-claude-dir` + `dist/zed` mirrors | The doctrine clause lives in COMMITTED dist copies; source edit alone does not kill it [VERIFIED: dist tracked, grep hit] |
| `lib/hmi/voice-color-mark.cjs` | shipped (182.1) | Frozen 5-glyph voice marks; `countDeStijlGlyphs` exactly-one contract | Provenance mark must not collide with this [VERIFIED: read] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending tier0-messaging.cjs in place | Renaming it (name is now wrong: "tier0" is dying) | Renaming breaks `require` paths in shim + test + any future consumer mid-milestone; SWEEP-01/02 re-points the 82 tests anyway. Rename belongs in 252's sweep, not here. Keep the filename, flip the values and add refusal kinds |
| Form B `hitl_stages` on brain-connector | Form A `hitl_shape: F.1` | Form A + `connector.excluded:true` trips gate predicate 2b (an accepted-WARN state conversation-mode sits in due to a documented field-reuse collision); Form B + excluded is CLEAN (larry-personality precedent, zero warns). Use Form B |
| Amendment doc in 250, decisions.md rows applied in 252 | Inline row rewrite in 250 with an effective-gate caveat in the row text | Inline is transiently honest but puts "Brain required" words on main before guards flip; any beta cut between 250 and 252 then carries the exact contradiction the lockstep rule names. Doc-now/rows-at-sweep is mechanically safe under any cut cadence |

**Installation:** none. Zero npm deps is a hard repo convention (`enrichment-queue.cjs` header: "Pure CJS, node built-ins only, zero npm deps").

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (repo convention: pure CJS, node built-ins only). No slopcheck run needed. Any plan task that proposes an npm install violates the stack convention and should be rejected at plan-check.

## Doctrine Site Enumeration (HONEST-01's kill list)

Grep census run 2026-08-10 across `skills/ commands/ agents/ hooks/ lib/ scripts/ bin/ docs/ dist/` for `silent fallback | never mention fail | silently fall` (worktrees under `.claude/worktrees/` excluded - agent scratch, not shipped). [VERIFIED: grep this session]

| # | Site | Text | Disposition in 250 |
|---|------|------|--------------------|
| 1 | `skills/brain-connector/SKILL.md:31` | "Any success = Brain active. All fail = silent fallback. Never mention failures to user." | DELETE - replaced by the Refusal section (below) |
| 2 | `skills/brain-connector/SKILL.md:100` | Gating rule "- Silent fallback on all failures" | DELETE - replaced by "Visible refusal on all failures; render once, never repeat ambient" |
| 3 | `skills/brain-connector/SKILL.md:37-38` | Offer-to-Setup: "answer with local references first, then offer once" | REWRITE - the answer-first-then-offer posture is the counterfeit path for methodology asks; becomes the F.1 refusal fork. Chat/context asks stay unaffected |
| 4 | `skills/brain-connector/SKILL.md:107` | "Fallback when the Brain is unreachable: local Room heuristics from the navigation engine + the larry-personality skill" | REWRITE - the improvise-locally instruction. New text: local heuristics may drive CONVERSATION and command resolution, never presented as methodology; methodology asks refuse visibly |
| 5 | `skills/brain-connector/SKILL.md:126` | "Never mention this bookkeeping to the user; it is silent backlog maintenance" (249-01 leg) | AMEND - reconcile with the visible refusal: capture stays silent when it accompanies a SUCCESSFUL serve (score 0-2 but material still served with provenance); when it accompanies a REFUSAL the queueing is SAID ("I've queued it for enrichment") - that sentence is part of the refusal copy |
| 6 | `dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md:27,96` | mirror of #1/#2 | REGENERATE via `node scripts/build-dist-bundles.cjs` after source edit; dist is committed, so the clause survives a source-only edit |
| 7 | `dist/zed/.agents/skills/brain-connector/SKILL.md:27,96` | mirror | same regeneration |
| 8 | `lib/core/tier0-messaging.cjs:51` | `FALLBACK_ADVICE = 'Larry can still talk with you and reflect on your room context. Methodology orchestration requires Brain.'` | REWRITE VALUE - graceful-degradation framing becomes refusal framing. Keys and `DIRECTOR_NOT_AVAILABLE` stay (byte-locked wire contract; shim + test assert keys) |
| 9 | `bin/mindrian-brain-mcp-client.cjs:98-126` | `r == null` (transport failure) mapped to `tier0Response(...)` whose `reason` is "MINDRIAN_BRAIN_KEY not set" | FIX - a valid-key unreachable Brain currently reports a FALSE reason. Split: null -> `refusalResponse('unreachable', tool)`; keyless -> existing no-key sentinel. This is a live dishonesty bug, not just doctrine text |
| 10 | `docs/install/BRAIN-SETUP.md:18` | "silently falls through to the Tier 0 graceful path" (describes silence as intended) | FIX THIS SENTENCE in 250 (it is doctrine, not just description); the doc's broader Tier-0 prose rides 252's 121-file sweep |
| 11 | `lib/core/brain-client.cjs` `getTier0Chain()` / `getFrameworkChain()` (lines ~1137-1220) | Hardcoded persona methodology chains served with `source: 'tier0'` when Brain unavailable - methodology not from the Brain | MARK in 250, FLIP in 252 - the guard-site behavior flip is SWEEP-01 territory, but HONEST-03's provenance contract must already require that any output derived from a `source:'tier0'` chain is disclosed as not-graph-grounded. Enumerate in the amendment's consequential list |

Also verified NOT doctrine (leave alone): env-parsing comments in `lib/workflow/reach-hedge-ranker.cjs`, `lib/core/verb-reach-affinity.cjs`, `docs/ENV-TUNING.md` ("silently falls back to default" for numeric env vars - a parsing convention, not failure concealment), and `lib/core/eureka/ahp-weights.cjs` (which argues AGAINST silent fallback). The doctrine grep fence (below) must be scoped to instruction surfaces (`skills/`, `commands/`, `agents/`, `dist/`) and the two doctrine phrases, or it will red-flood on legitimate code comments.

## Architecture Patterns

### System Architecture Diagram

```
                        methodology consult (in-turn)
                                   |
              +--------------------+---------------------+
              | CLI (HTTP path)                          | Desktop/Cowork (MCP-direct)
              v                                          v
   lib/core/brain-client.cjs                    pws-brain-mcp MCP tools
   wrappers (247-02 sentinels)                  (bypasses brain-client)
              |                                          |
     resolves to ONE of:                        host tool result / error
      - payload (readiness>=3, grounded)                 |
      - payload (readiness 0-2 / grounded:false)         |
      - {error: tier_denied|invalid_key}                 |
      - null (transport failure)                         |
      - no key (isAvailable false)                       |
              |                                          |
              v                                          v
   lib/core/tier0-messaging.cjs  <----- SKILL.md refusal instruction ----->
   refusalResponse(kind, ctx)          (the ONE lever on the MCP path;
   kind: no_key | unreachable |         Tri-Polar: same copy, all surfaces)
         tier_denied | not_ready                |
              |                                 |
              +---------------+-----------------+
                              v
                 THE REFUSAL RENDER (Larry voice, in-turn)
                 1. one honest sentence naming the kind
                 2. not_ready ONLY: auto-queue -> enqueue(source:'refusal')
                    (CJS) or enrichment-queue-append.cjs --source refusal (Bash)
                 3. F.1 Next Move card (AskUserQuestion; SEED-021:
                    fire the card, never draw the box)
                              |
                              v
                 SERVED ANSWERS (success path) carry provenance:
                 one "■ BRAIN: ..." source line; absence = Larry-voice
```

### Pattern 1: Refusal kinds mapped to the filed error taxonomy

**What:** Four refusal kinds, one per failure class, mirroring the data4sci four-class error taxonomy from the filed consultation (tier0 handoff section 7): transient -> retry, validation -> fix input, missing-information -> re-plan (never retry), policy -> halt.

| Refusal kind | Trigger (transport truth) | Taxonomy class | Next move offered | Auto-queue? |
|---|---|---|---|---|
| `no_key` | `isAvailable() === false` | validation | set up key (SEED-011 ceremony), or continue without methodology | no |
| `unreachable` | `callTool` returns `null` (network/timeout/5xx) | transient | retry, or continue without methodology | no |
| `tier_denied` | `{error:'tier_denied'}` (403, 247-02) / `{error:'invalid_key'}` (401) | validation | check key/tier (server message shown, already capped at 300 chars), or continue | no |
| `not_ready` | resolved payload with `readiness_score <= 2` or `grounded: false` | missing-information | use what the graph DOES hold (marked partial), or continue without | YES - `source: 'refusal'` |

**Why the queue attaches only to `not_ready`:** the queue is typed per-framework readiness data (enrichment-queue allowlist); transport and auth failures carry nothing to enrich. This matches 249-01's own sentinel discipline: "a result carrying .error or a null is NEVER a capture trigger - failure visibility is Phase 250's refusal territory, not an enrichment miss" (brain-client.cjs lines 1049-1052). [VERIFIED: read]

**When to use:** every methodology consult, on every surface. NEVER ambient (not in sensors/, not in decide() - the Pitfall 6 hot-path fence from 249 applies to the refusal render too).

### Pattern 2: The chokepoint flip (tier0-messaging.cjs)

**What changes, concretely:**

1. KEEP: `DIRECTOR_NOT_AVAILABLE` constant, the five sentinel keys, `tier0Response()`, `isAvailable()` passthrough. The wire shape is byte-locked; the shim and `tier0-messaging.test.cjs` assert keys (test asserts values only by loose regex - `fallback_advice` must match `/Larry/`, satisfiable by refusal framing). [VERIFIED: test line 79]
2. REWRITE VALUES (the sanctioned path - the module's own header: "values are human-facing and may evolve, but only via explicit phase amendment"; this IS that amendment): `FALLBACK_ADVICE` becomes refusal framing, e.g. "Larry does not improvise methodology. Methodology comes from the Brain or it is refused, visibly. Conversation and room context remain available."
3. ADD: `REFUSAL_KINDS` (frozen four-member set), `refusalResponse(kind, ctx)` returning `{status, kind, reason, command_context, next_moves, upgrade_hint?}` where `status` stays `DIRECTOR_NOT_AVAILABLE` for `no_key` (downstream compat) and adds sibling statuses `BRAIN_UNREACHABLE`, `BRAIN_TIER_DENIED`, `GRAPH_NOT_READY`; plus `larryRefusalLine(kind, detail)` one-liners (under 120 chars each, statusline-safe like `larryTier0Hint`).
4. `larryTier0Hint()` stays as the once-per-session key hint (anti-nagging leg).

**Consumer update in the same plan:** the shim's `r == null ? tier0Response(name) : r` becomes `r == null ? refusalResponse('unreachable', name) : r` (6 tool handlers; site #9 above). Grep note: the "doctor's Class-M smoke L5 check" named in tier0-messaging's header comment did NOT grep-match in `scripts/doctor.cjs` this session - re-grep for `DIRECTOR_NOT_AVAILABLE` across `scripts/` during planning before assuming only two consumers.

### Pattern 3: The refusal copy (Larry's voice, honest not nagging)

Draft copy for the SKILL.md Refusal section (planner may polish; the SHAPE is the contract - one honest sentence, the queue disclosure when applicable, then the card):

- `no_key`: "Methodology needs the Brain, and no key is set. I won't improvise it from memory. Drop a key in `~/.mindrian.env` (chmod 600) or set `MINDRIAN_BRAIN_KEY`, then restart - or we keep working with your room context." (full form once per session; later same-session methodology asks compress to one line)
- `unreachable`: "I can't reach the methodology graph right now, so I won't fake what it would say. We can retry in a moment, or keep going with your room context."
- `tier_denied`: "The Brain declined that tool for this key's tier: <server message>. I won't substitute a guess. Check the key tier, or we continue without that tool."
- `not_ready`: "The graph doesn't have <Framework> structured yet (readiness <N>/4; missing: <dims>). I've queued it for enrichment. I can share what the graph does hold on this, marked as partial - or we work without it."

Then fire the F.1 card (AskUserQuestion) with the kind's next moves. SEED-021 binding: on card-capable surfaces, drawing the gate without firing the card is itself the silent-degrade R15 exists to kill.

**Anti-nagging rules (the HONEST-03 "honesty not nagging" half, enforced as SKILL.md instruction):**
1. Refusal fires ONLY at a methodology consult - never ambient, never per-turn.
2. First refusal of a kind per session renders in full; repeats compress to the one-liner (`larryRefusalLine`).
3. The key-setup pitch appears at most once per session (existing `_reasonLoggedThisProcess` + session-start status line precedent in brain-client.cjs lines 163-169).
4. Refusal never interrupts a non-methodology conversation (the existing "never interrupt methodology sessions" gating rule survives, inverted for honesty).

### Pattern 4: Refusal auto-queues enrichment

- CJS path (CLI): at the refusal render seam, call `enrichmentQueue.enqueue(roomDir, { framework, normalized, readiness_score, missing_dimensions, context_class, source: 'refusal', probe_provenance })` directly. Do NOT use `captureReadinessMiss` - it pins `source: 'live_reach'` (enrichment-queue.cjs line 495). [VERIFIED: read]
- Larry-direct path (Desktop/Cowork): the SKILL.md instruction extends the existing 249-01 append block - same CLI, `--source refusal` instead of `--source live_reach`. `'refusal'` is already in `ALLOWED_SOURCES` and the CLI takes `--source`. [VERIFIED: read both files]
- Dedup is free: the queue is idempotent by framework; a 249 `live_reach` capture and a 250 `refusal` render for the same miss merge into one entry with `hit_count` incremented (both sources are "live" per `_SOURCE_IS_LIVE`, so neither downgrades the other). [VERIFIED: enrichment-queue.cjs lines 85, 358-381]

### Pattern 5: hitl declaration mechanics (HONEST-02's Part 11 leg)

**The fork is F.1 (Next Move).** Per the closed-vocabulary decision rule (HITL-SHAPE-DECLARATION-CONTRACT.md): "a single move or yes-or-no -> F.1 or F.0". The refusal moment is picking one next move from a small numbered set (connect key / retry / use partial with provenance / continue without) - not an APPROVE/REJECT/DEFER on a surfaced item, so F.1, not F.0. [CITED: docs/HITL-SHAPE-DECLARATION-CONTRACT.md, decision rule + shape table]

**The declaration MUST be Form B (`hitl_stages`), not Form A.** Evidence chain:
- brain-connector must keep `connector.excluded: true` - removing it makes the surface a "gap" in the R1 connector-coverage ledger, which HARD-FAILS `build-connector-registry.cjs --check` (the conversation-mode frontmatter documents this empirically). [VERIFIED: skills/conversation-mode/SKILL.md frontmatter comment]
- Gate predicate 2b flags scalar `hitl_shape != 'none'` + `connector_excluded === true` as a contradiction WARN (check-shape-declaration.cjs line 216). The predicate checks `hasShape` only - `hitl_stages` + excluded passes clean, which is exactly how larry-personality ships today (excluded:true + 4-stage hitl_stages, zero warns). [VERIFIED: read gate lines 184-262 + larry-personality frontmatter]
- Therefore:

```yaml
# skills/brain-connector/SKILL.md frontmatter addition
hitl_stages:
  - stage: "brain-refusal-fork"
    shapes: ["F.1"]
    mode: "gate"
hitl_why: "A Brain failure or readiness miss is a genuine Decision-Gate fork: the navigator picks the next move (connect the key, retry, use partial graph material with provenance, or continue without methodology) - never a silent fallback."
```

**Consequential doc edit in the same plan:** `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` line 123 lists brain-connector among "the five exempt skills"; that list goes stale the moment the declaration lands. Update it (four exempt skills remain), or the contract doc contradicts the gate's reality.

**Note the accepted field-reuse collision:** conversation-mode's frontmatter documents that `connector.excluded` serves two meanings (R1 "not spine-triggered" vs R16 "no fork") and that the WARN it triggers is accepted until a future phase separates the fields. brain-connector taking Form B sidesteps the collision entirely; do not attempt to fix the collision in this phase (out of scope, named follow-up already filed in the intern-w1-mode-gate-skip debug record).

### Pattern 6: The amendment structure (HONEST-02)

**One reviewable unit = one dated document**, recommended `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`, containing IN ORDER:

1. **Preamble:** what is amended (`.claude/includes/decisions.md` rows 1 and 8; row 5 wording touched), on whose authority (navigator escalation gates 2026-08-09, Build-the-Loop ratification 2026-08-10), and the STATUS + EFFECTIVE clause: "Ratified on merge; IN FORCE with the release that completes SWEEP-01..03. No release cut carries the rewritten rows while any guard silently degrades (ROADMAP amendment-sweep lockstep, HARD)."
2. **The causal record (inside the amendment text itself, per the navigator's explicit direction - "on the record, not in a chat log"):** (a) the silent-fallback clause quoted verbatim with its file:line; (b) the weeks-long outage - `scripts/brain-response-sanitize-hook.cjs` blanked 100 percent of Brain responses, `e.reduce is not a function` on every call, invisible precisely because the doctrine instructed silence [CITED: docs/2026-08-09-HANDOFF-brain-envelope-and-egress-guard.md]; (c) the inert `activation:` frontmatter no-op - two clauses in one file, both pretending, neither doing [CITED: tier0 handoff section 2]; (d) the counterfeit framing - "can a user ever be served methodology that did not come from the Brain, without being told? The answer must be no"; (e) the live 2026-08-10 reproduction on a stale plugin cache [CITED: build-the-loop handoff section 4].
3. **New Decision #1 row, verbatim** (drafting direction, planner refines): one-command install SURVIVES; what changes is what the command delivers - "One-command install; the Brain is part of what installs. Larry's methodology comes from the Brain and says so; a keyless session gets an honest refusal and a visible path to a key, never an imitation." (Note: this row stays TRUE only if SEED-011's ceremony resolution keeps install one-command - the two requirements are coupled; see SEED-011 below.)
4. **New Decision #8 row, verbatim:** replaces "Tier 0 fully functional - graceful degradation everywhere" with refusal doctrine - "Honest refusal everywhere. A Brain failure or readiness miss surfaces in-turn and auto-queues enrichment; no surface conceals a failure or serves methodology the graph did not give."
5. **Decision #5 wording touch:** Brain stays remote MCP; drop the implied optionality (tier0 handoff section 3 flags this).
6. **Consequential-edits ledger for the SWEEP release:** decisions.md rows themselves, CLAUDE.md:19 and :84, BRAIN-SETUP.md, the tier-0-no-key fixture inversion, the 121-doc list (252 re-measures).
7. **Ratification block:** navigator sign-off line (`checkpoint:human-verify` in the plan).

**Why doc-in-250 / rows-in-252:** the lockstep rule says the amendment TEXT may merge earlier as a commit, but a CUT carrying rewritten rows while guards degrade is "the contradiction worse than either state." Betas may be cut between waves 4 and 6 (Phase 251 sits between). A ratified document whose own text says "in force with the SWEEP release" is honest in every possible cut; rewritten decisions.md rows on main are not. HONEST-02's "rewrites Decisions #1 and #8 TOGETHER as one reviewable unit" is satisfied by the amendment doc containing both replacement rows verbatim - the unit is reviewed and ratified in 250; application is mechanical in 252's release. Flag this interpretation to the navigator at the ratification checkpoint (it is the one judgment call in this phase's sequencing).

### Pattern 7: Provenance marking (HONEST-03)

**Reuse the `■ BRAIN` chip - do not invent a glyph.** The ui-system F.7 dial already ships a `[■ BRAIN]` header chip (literal, 9 chars) "distinct from [GATE] / [CONTEXT] / [NEXT MOVE] chips by the leading filled-square glyph" [VERIFIED: skills/ui-system/SKILL.md line 147]. The provenance contract:

- **The mark:** ONE source line per graph-grounded answer, recommended form `■ BRAIN: <framework> · <tool> · readiness <N>/4` (terminal/Cowork) rendered at the end of the methodology content it grounds; Desktop degrades to a bold markdown line (`**■ Brain:** ...`) per the existing degrade table (no box chars, no ANSI - but `■` U+25A0 is a plain glyph that survives everywhere).
- **Absence is the signal:** no source line = Larry-voice conversation. This mirrors the voice-mark design verbatim ("a turn with NO mark IS the native host speaking, and that absence is itself the signal" - larry-personality line 209). One mechanism family, two planes: color square = WHO is speaking (move), ■ BRAIN line = WHERE the methodology came from.
- **Partial material:** a `not_ready` refusal that the navigator answers with "use what the graph does hold" serves prose search results marked `■ BRAIN (partial): <framework> · readiness <N>/4` - the disclosed-degraded state, which passes the honesty invariant because it is TOLD.
- **No collision with the voice mark, verified:** `countDeStijlGlyphs` matches only the 5 emoji squares (U+1F7E5/E6/E8, U+2B1B, U+2B1C); `■` is U+25A0, unmatched, and `detectVoiceMark` anchors at turn start while the source line sits at the end of the grounded block. The exactly-one-color-mark contract is untouched. Caveat to note in the plan: some fonts render U+25A0 visually close to U+2B1B - position (never turn-anchored) disambiguates. [VERIFIED: lib/hmi/voice-color-mark.cjs MARK_GLYPHS + detector]
- **HTML exports:** obey M:OS Design System v1.1 (ui-system rule: "if it renders as a page, it obeys M:OS") - a source line component, not the terminal chip.
- **`source:'tier0'` chains (site #11):** until 252 flips them, any surface serving a hardcoded chain must mark it as NOT graph-grounded (no ■ BRAIN line, and on a methodology ask that path now refuses instead).
- **Anti-nagging:** one line per answer, never per fact, never repeated within a turn.

**Enforcement:** the instruction is behavioral (skill-layer), so verification is (a) a fence test asserting the SKILL.md provenance section exists with the contract strings, and (b) a `checkpoint:human-verify` live check on all three surfaces (Tri-Polar), reusing the `tests/test-245-brain-envelope-shape.cjs` claim (b) pattern for plugin-scoped vs project-scoped tool names.

### Anti-Patterns to Avoid

- **Refusal as a quieter Larry:** answering the methodology ask from local heuristics and appending a footnote. The refusal REPLACES the methodology answer; it does not caveat it.
- **Ambient refusal:** printing Brain status every turn. That is the nagging HONEST-03 exists to prevent; refusal is consult-scoped.
- **Widening the transport-null branch:** brain-client's 247-02 comment is explicit - every non-403 non-OK status returns null and "82 degradation tests key on it; do not widen this branch." 250 renders null as `unreachable`; it does not change what returns null. The tests flip in 252.
- **A fourth brain skill:** Part 7. Everything lands in brain-connector + lib/core.
- **Killing `connector.excluded` on brain-connector:** hard-fails the R1 ledger gate. Form B declaration coexists with it.
- **Doctrine fence over all of `lib/` and `docs/`:** red-floods on legitimate env-parse comments. Scope the fence to `skills/`, `commands/`, `agents/`, `dist/` and the doctrine phrases ("silent fallback", "Never mention failures", "never mention this bookkeeping" reconciled variant).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queueing a refusal for enrichment | A second queue or a new capture path | `enqueue(..., source:'refusal')` / append CLI `--source refusal` | 249-01 pre-validated the source token for exactly this; one queue, one write surface (Part 7) |
| Refusal fork rendering | ASCII box + "type 1, 2 or 3" | AskUserQuestion card (F.1) | SEED-021 / R15: no card, no picture; drawing without firing is silent-degrade |
| Provenance glyph | A new symbol or sixth color | The `■ BRAIN` chip vocabulary | 12-glyph set is frozen; new glyph = canon amendment; chip already means "Brain-sourced" on the dial |
| Failure classification | Re-probing or re-deriving failure state in the skill | brain-client's existing sentinels (null / tier_denied / invalid_key) + `resolveBrainKey` reasons | 247-02 landed the transport truth; 250 only renders it |
| Session-scoped "say it once" | New state file | `_reasonLoggedThisProcess` pattern (process-scoped) + SKILL.md once-per-session instruction | Precedent exists in brain-client; the skill layer handles the conversational plane |
| Amendment governance shape | A novel doc format | The canon Appendix-D amendment pattern (preamble, record, verbatim change, ratification) | Repo has 30+ navigator-gated amendment precedents in MINDRIAN-CANON.md |

**Key insight:** 249 built every mechanism this phase needs; 250 is almost entirely a RENDERING and DOCTRINE phase. The only new executable code is the tier0-messaging refusal kinds, the shim conflation fix, and the fence tests. If a plan task is writing substantial new library code, it has drifted.

## Common Pitfalls

### Pitfall 1: Editing the SKILL.md and forgetting the dist mirrors
**What goes wrong:** the doctrine clause survives in `dist/generic-claude-dir` and `dist/zed` (committed copies) and HONEST-01's "cannot be found in any shipped surface" fails its own gate.
**How to avoid:** `node scripts/build-dist-bundles.cjs` in the same task; the doctrine fence test greps `dist/` too.
**Warning signs:** grep fence green on `skills/` but never run on `dist/`.

### Pitfall 2: The false-reason sentinel (shim conflation)
**What goes wrong:** fixing SKILL.md text while the shim still reports "MINDRIAN_BRAIN_KEY not set" for a transport failure - the refusal is now visible AND wrong, which is arguably worse than silence.
**How to avoid:** site #9 is in the HONEST-01 plan, not deferred to 252; a unit test asserts unreachable-with-key produces `unreachable`, not the no-key reason.

### Pitfall 3: Breaking the byte-locked wire shape
**What goes wrong:** renaming `DIRECTOR_NOT_AVAILABLE` or dropping sentinel keys breaks the shim and `tier0-messaging.test.cjs` (8 guard sites, the highest concentration in the blast radius table).
**How to avoid:** values flip, keys and the constant stay; new kinds get NEW sibling statuses. Re-grep `DIRECTOR_NOT_AVAILABLE` across `scripts/` for the Class-M smoke consumer the header names (not found in doctor.cjs this session - locate or confirm gone before assuming).

### Pitfall 4: The amendment rides a beta cut before the sweep
**What goes wrong:** rewritten decisions.md rows on main + a v2.0.0-beta cut during Phase 251 = docs claim Brain-required while 101 guards silently degrade - the named worst state.
**How to avoid:** Pattern 6's doc-now/rows-at-sweep split; the amendment doc's effective clause makes any intermediate cut self-describing.

### Pitfall 5: Refusal render in the hot path
**What goes wrong:** wiring refusal or queue-append into `lib/core/sensors/` or `decide()` - the 249 grep fence (`tests/test-249-capture-seam.cjs`) goes red and per-turn latency grows.
**How to avoid:** refusal renders at consult surfaces only; the fence test already exists - keep it green.

### Pitfall 6: Fence test over-reach
**What goes wrong:** a repo-wide grep fence for "silent" flags dozens of legitimate env-parse comments and the fence gets watered down or ignored.
**How to avoid:** scope to instruction surfaces + exact doctrine phrases (enumeration table above defines the closed list).

### Pitfall 7: Treating readiness 0-2 as always-refuse
**What goes wrong:** blanket refusal on any 0-2/4 framework makes Larry useless today (JTBD scores 0/4 right now; ENRICH-04's floor is in progress but gates 252, not 250).
**How to avoid:** the `not_ready` refusal refuses the ORCHESTRATION claim, then OFFERS the disclosed-partial path (prose search results with `■ BRAIN (partial)` marking). Refusing to fake structure is not refusing to serve what exists.

### Pitfall 8: Fixed in git, stale in the session
**What goes wrong:** declaring HONEST-01 verified from the session that edited the files. The standing memory rule: a commit is not live until a release ships AND is picked up; skills load from the plugin cache.
**How to avoid:** live verification checkpoints run on a restarted session on a released beta (the 246 restart-to-apply lesson; four independent occurrences filed).

## Code Examples

### tier0-messaging extension sketch (keys stay, kinds added)

```js
// Source: extension of lib/core/tier0-messaging.cjs (shipped shape verified this session)
const REFUSAL_KINDS = Object.freeze(['no_key', 'unreachable', 'tier_denied', 'not_ready']);
const KIND_STATUS = Object.freeze({
  no_key: DIRECTOR_NOT_AVAILABLE,        // locked wire string, unchanged
  unreachable: 'BRAIN_UNREACHABLE',
  tier_denied: 'BRAIN_TIER_DENIED',
  not_ready: 'GRAPH_NOT_READY',
});
function refusalResponse(kind, ctx) {
  const k = REFUSAL_KINDS.indexOf(kind) !== -1 ? kind : 'unreachable';
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  return {
    status: KIND_STATUS[k],
    kind: k,
    reason: REASONS[k](c),                 // honest per-kind reason, never the no-key string for a transport failure
    command_context: (typeof c.tool === 'string' && c.tool) || 'unknown',
    next_moves: NEXT_MOVES[k],             // the F.1 option handles
    ...(k === 'no_key' ? { upgrade_hint: UPGRADE_HINT } : {}),
  };
}
```

### Refusal auto-queue (CJS seam)

```js
// Source: enrichment-queue.cjs enqueue contract, verified this session
const q = require('./enrichment-queue.cjs');
q.enqueue(roomDir, {
  framework: canonicalName,
  readiness_score: score,                  // integer 0-2, or null for grounded:false
  missing_dimensions: dims,                // subset of ['pattern_type','structure','techniques','flow']
  context_class: contextClass,             // closed-enum members only (Part 8)
  source: 'refusal',                       // pre-validated in ALLOWED_SOURCES
  probe_provenance: 'orchestration_readiness@' + new Date().toISOString(),
});
// NOT captureReadinessMiss() - that helper pins source:'live_reach'.
```

### Larry-direct append (SKILL.md instruction, Desktop/Cowork)

```bash
# Source: scripts/enrichment-queue-append.cjs header, verified this session
node <plugin-root>/scripts/enrichment-queue-append.cjs \
  --room <current room directory> \
  --framework "<canonical framework name>" \
  --score <readiness_score integer, omit for a discover_structure miss> \
  --missing <comma-separated dims> \
  --source refusal
```

### Doctrine fence test shape

```js
// New: tests/test-250-doctrine-fence.cjs - scoped grep fence
const FORBIDDEN = [
  /silent fallback/i,
  /never mention (failures|this bookkeeping)/i,
];
const SCOPE = ['skills', 'commands', 'agents', 'dist'];  // NOT lib/, NOT docs/ (252's sweep)
// walk SCOPE, assert zero matches; print file:line for every hit.
```

## State of the Art

| Old Approach | Current Approach (post-250) | When Changed | Impact |
|--------------|------------------------------|--------------|--------|
| "All fail = silent fallback. Never mention failures to user." | Typed visible refusal, four kinds, in-turn, F.1 fork | this phase | The counterfeit path is dead at the instruction layer |
| Tier-0 sentinel framing ("Larry can still talk... requires Brain") | Refusal framing; same wire keys, honest per-kind reasons | this phase | Shim + statusline consumers keep working; false no-key reason on transport failure fixed |
| Offer-to-Setup: answer locally first, offer once | Methodology asks refuse first; chat/context unaffected | this phase | Honesty invariant holds at the moment of the ask |
| Decision #8 "Tier 0 fully functional; graceful degradation everywhere" | Amendment ratified in 250; rows applied in 252's release | 250 (ratify) / 252 (in force) | Constitution and guards flip in the same cut |
| Graph answers indistinguishable from Larry-voice | `■ BRAIN` source line; absence = Larry-voice | this phase | Provenance without nagging; disclosed-partial state exists |
| Key ceremony: request key at mindrian-os.com/brain-access, `~/.mindrian.env`, restart | Decision recorded (recommend option A silent registration); ceremony unchanged until brain-repo endpoint ships | 250 decides; build is cross-repo follow-up | Decision #1's rewrite stays true ("one command") |

**Deprecated/outdated by this phase:** the phrase "graceful degradation" as doctrine anywhere in instruction surfaces; the "tier0" naming becomes historical (rename deferred to 252's sweep).

## SEED-011: the key ceremony (HONEST-03's second half)

**Ceremony today, verified:** request a key at `https://mindrian-os.com/brain-access` (Supabase-minted per the tier0 handoff), drop it in `~/.mindrian.env` (SEC-02: mode 0600 enforced) or `MINDRIAN_BRAIN_KEY` env; resolver order env -> `~/.mindrian.env` -> CWD `.env` (D-31); restart to apply. The stdio shim auto-loads; no `claude mcp add` since beta.20. So the ceremony is: ONE key request + ONE file drop + restart. [VERIFIED: resolve-brain-key delegation in brain-client.cjs + docs/install/BRAIN-SETUP.md]

**Option dispositions under the v2.0.0 doctrine:**

| Option | Disposition | Why |
|--------|-------------|-----|
| A - per-install silent registration (UUID -> `/register` -> cached install token) | **RECOMMEND** | The only option that keeps Decision #1's rewritten "one-command install" TRUE under Brain-required: install mints identity, Larry works, no ceremony. Per-install identity also serves rate-limit/revocation/telemetry. Cost: brain-repo server endpoint + WAF hardening (cross-repo, NOT built in 250) |
| B - embedded HMAC key | reject | Extractable from shipped CJS by design (`cat ... \| grep KEY`); rotation binds to release cycle; no per-install identity |
| C - anonymous degraded tier | **dead by navigator ruling** | A keyless tier serving reduced methodology is the Tier-0 gradient the navigator killed; SWEEP-02 inverts the keyless fixture to assert REFUSAL, which directly contradicts C's keyless-serves-degraded. (A DISCLOSED degraded tier passes the honesty invariant in the abstract, but it cannot pass the repurposed fixture.) |

**Minimal resolution inside 250** (the seed's own recommended path, adapted): a navigator Decision Gate (one recommendation, approvable in a word: option A), captured as `docs/BRAIN-IDENTITY-DESIGN.md` with the threat model + telemetry note the seed asks for; refusal copy written to stay true in both worlds (it points at the ceremony as it exists; when the registration endpoint ships, the `no_key` refusal becomes rare rather than reworded); the server-side `/register` endpoint filed as brain-repo work (cross-repo rule: the requirement is not done until the user-reached surface is fixed - so HONEST-03's DONE line is the decision + design doc + refusal/provenance behavior, with the endpoint explicitly a recorded follow-up, not a silent gap).

## Sequencing (what lands before 252 without the contradiction)

| Item | Merge in 250? | Releasable in a beta before 252? | Reasoning |
|------|---------------|----------------------------------|-----------|
| HONEST-01 rail (SKILL.md rewrite, tier0-messaging kinds, shim fix, dist rebuild, fence test) | yes | **yes** | Only ADDS honesty; no doc claims Brain-required. Strictly better than baseline at every intermediate state |
| HONEST-03 provenance + partial marking | yes | **yes** | Additive disclosure; no dependency on the sweep |
| SEED-011 decision doc | yes | yes | A decision record, not a behavior change |
| HONEST-02 amendment DOC (ratified, effective clause) | yes | yes - the text itself says it is not in force until the SWEEP release | The lockstep rule explicitly permits the text merging earlier as a commit |
| decisions.md rows #1/#8 applied + CLAUDE.md:19/:84 | **no - 252's release** | no | The exact contradiction the HARD rule names |
| Guard flips, test re-pointing, fixture inversion, tier0 chain refusal | no (252) | no | SWEEP-01/02/03 scope; SWEEP-02 additionally gated by ENRICH-04's floor |

Dependency into this phase: 249's queue is live (ENRICH-01/02 checked in REQUIREMENTS.md); the ENRICH-04 floor is explicitly NOT a 250 dependency (ROADMAP: "it gates Phase 252, not this phase").

## Grounding: langtalks consultation (MANDATORY per navigator scoping)

**Tool availability, recorded honestly:** the `mcp__langtalks-graph-expert__*` MCP tools are NOT available in this research agent's tool set this session (no MCP tools were exposed to the agent; the server is registered at user scope on the Windows checkout per the tier0 handoff, and MCP tools require a session with the server attached). No `relationship_path` query could be run live. This is recorded per the standing rule that "not in the corpus yet" and "tools unavailable" are valid, stated answers - never papered over.

**The corpus material is nonetheless IN HAND, from the two FILED consultations the handoffs designate as "already gathered - do not re-research":**

- **Silent failure is a named law, three independent sources** [CITED: tier0 handoff section 7]: ep35 (Almog Baku) "AI fails silently; we don't get bugs that pop out like in classic software engineering" - log CONTENT, not just events; ep55 - an agent NEEDS transient-vs-terminal distinction and "people throw tool errors away instead of putting them in context"; Fragmented #307 - "agent legibility" as a harness pillar. Phase mapping: the four refusal kinds ARE the transient-vs-terminal distinction made user-visible, and the refusal render puts the tool error INTO the conversation instead of throwing it away.
- **The four-class error taxonomy** (data4sci harness blueprint, filed): transient -> retry with backoff; validation -> feed the error back; missing-information -> "retrying is actively harmful... the right move is to re-plan"; policy -> halt. Phase mapping is one-to-one: unreachable=transient (offer retry), tier_denied/no_key=validation (fix the key), not_ready=missing-information (re-plan = queue enrichment + offer partial; never auto-retry the readiness probe), Part-8 egress block=policy (already halts visibly). "Truncation is explicit rather than silent" is the exact rule the outage needed - quote it in the amendment's causal record.
- **Refuse-rather-than-guess is FIRST-PARTY** [CITED: build-the-loop handoff section 3, honesty note]: the MotherDuck panel note ("an agent facing an undefined term should say 'I don't know,' never infer or guess") traces to the navigator's OWN panel appearance. The amendment must cite it as a first-party position, not external validation - the handoff is explicit about this.
- **Corpus whitespace, both directions** [CITED: both handoffs]: no coverage of making a remote knowledge service a hard requirement, and no coverage of per-turn hook injection. The refusal doctrine has no external precedent in the 44-source corpus; the amendment should own it as the navigator's call.
- **Anthropic instruction-bloat finding** (filed): 80 percent of a system prompt removed with no measurable loss - keep the SKILL.md refusal section SHORT (rules-to-judgment: four kinds, one copy block, the anti-nagging rules; not a page of scenarios).

**If MCP tools appear at plan time,** the two point-to-point `relationship_path` queries worth running are refusal->trust/legibility and silent-failure->observability - as confirmation, not as blockers (the navigator's scoping names the filed eps 35/55 + MotherDuck material as the covering corpus).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "doctor's Class-M smoke L5 check" consumer of DIRECTOR_NOT_AVAILABLE either no longer exists or lives outside doctor.cjs (grep found nothing this session) | Pattern 2 / Pitfall 3 | Low - keys and constant are kept regardless; re-grep at plan time |
| A2 | Betas may be cut between Phases 250 and 252 (motivates doc-now/rows-at-sweep) | Pattern 6, Sequencing | If the navigator instead freezes cuts until 252, inline row rewrite becomes acceptable; the recommendation is safe either way |
| A3 | HONEST-02's "rewrites Decisions #1 and #8 together" is satisfiable by the amendment doc carrying both replacement rows verbatim, with mechanical application in 252's release | Pattern 6 | Navigator may insist rows change in 250 itself; then use the transiently-honest inline variant (row text carries the effective gate) - surface at the ratification checkpoint |
| A4 | Option A is the navigator's preferred SEED-011 resolution | SEED-011 | Decision Gate in the plan; B/C dispositions argued from the record, but the pick is the navigator's |
| A5 | `■` U+25A0 renders distinctly from `⬛` U+2B1B on user terminals/fonts | Pattern 7 | Cosmetic; position-anchoring disambiguates; fallback is the literal word chip `[BRAIN]` if a live check shows confusion |

## Open Questions

1. **Where exactly does the CLI-path refusal render fire?** The MCP/Larry-direct path is SKILL.md-instructed, clean. On the CLI path, wrappers return sentinels to many `/mos:` commands - does 250 add a shared render helper (e.g. in tier0-messaging, consumed by command markdown via a documented contract) or instruct per-command? What we know: 252 sweeps the 101 guard sites through the rail, so 250 only needs the rail + the brain-connector/consult surfaces honest. Recommendation: ship the helper + SKILL.md instruction in 250; per-command adoption is 252's sweep.
2. **Does `not_ready` refusal apply to ALL methodology consults or only orchestration-shaped ones?** A pure semantic search that returns prose is served with provenance (readiness irrelevant); the refusal binds to orchestration/structure claims (readiness probe or discover_structure paths). Recommendation: bind refusal to the two readiness-shaped wrappers + their MCP twins, exactly where 249's capture seams sit.
3. **Amendment application mechanics** - A3 above; a one-word navigator call at the ratification checkpoint.
4. **SEED-011 endpoint timing** - does the brain-repo `/register` endpoint get a scheduled slot (252-adjacent or post-milestone)? 250 records the decision; the roadmap has no slot for the build. Flag in the amendment's consequential ledger.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22.16 | all CJS work + tests | yes | v22.23.1 | - |
| Live Brain (pws-brain-mcp.onrender.com) | live-verify checkpoints only | assumed (beta.13 verified path; 246 owns the fresh proof) | - | unit tests run offline against sentinels; live checks are human-verify checkpoints |
| langtalks-graph-expert MCP | grounding | **no (this agent session)** | - | filed consultations cited (see Grounding section) - sanctioned by the handoffs' "do not re-research" |
| `scripts/build-dist-bundles.cjs` | dist mirror regeneration | yes (present) | - | - |
| R16 / R1 / doctor gates | verification | yes (all present in scripts/) | - | - |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | repo-native CJS test scripts (node built-in assert) + bash phase runner |
| Config file | none - convention is `tests/test-<phase>-*.cjs` + `tests/run-all-<phase>.sh` (Wave 0 creates the runner) |
| Quick run command | `node tests/test-250-<name>.cjs` |
| Full suite command | `bash tests/run-all-250.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HONEST-01 | refusalResponse kinds: honest per-kind reason; unreachable-with-key never says "key not set"; no_key keeps DIRECTOR_NOT_AVAILABLE + keys | unit | `node tests/test-250-refusal-shapes.cjs` | Wave 0 |
| HONEST-01 | doctrine phrases absent from skills/, commands/, agents/, dist/ | fence | `node tests/test-250-doctrine-fence.cjs` | Wave 0 |
| HONEST-01 | refusal enqueue lands source:'refusal', idempotent-merges with live_reach | unit | `node tests/test-250-refusal-queue.cjs` | Wave 0 |
| HONEST-01 | hot-path fence stays green (no refusal require from sensors/decide) | fence (existing) | `node tests/test-249-capture-seam.cjs` | exists |
| HONEST-02 | amendment doc: both rows verbatim, causal-record citations, effective clause present | unit | `node tests/test-250-amendment-unit.cjs` | Wave 0 |
| HONEST-02 | brain-connector Form B declaration conformant; no NEW warns vs baseline | gate | `node scripts/check-shape-declaration.cjs --check` (baseline-diff in runner) | exists |
| HONEST-02 | R1 ledger unbroken (excluded stays) | gate | `node scripts/build-connector-registry.cjs --check` | exists |
| HONEST-03 | SKILL.md provenance contract strings present (■ BRAIN form, absence-is-signal rule, partial marking) | fence | `node tests/test-250-provenance-fence.cjs` | Wave 0 |
| HONEST-03 | live refusal + provenance on CLI/Desktop/Cowork, on a RELEASED build after restart | manual-only | checkpoint:human-verify (justification: skill-layer behavior on three hosts is not automatable; pattern precedent tests/test-245-brain-envelope-shape.cjs claim (b)) | - |
| all | no em-dashes | fence (existing) | repo em-dash fence in the phase runner | exists |

### Sampling Rate
- **Per task commit:** the task's `node tests/test-250-*.cjs` + touched gates
- **Per wave merge:** `bash tests/run-all-250.sh` + `node scripts/check-shape-declaration.cjs --check` + `node scripts/build-connector-registry.cjs --check` + `node scripts/doctor.cjs --acceptance`
- **Phase gate:** full runner green + human-verify checkpoints complete before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-250.sh` - phase runner
- [ ] `tests/test-250-refusal-shapes.cjs` - HONEST-01
- [ ] `tests/test-250-doctrine-fence.cjs` - HONEST-01
- [ ] `tests/test-250-refusal-queue.cjs` - HONEST-01
- [ ] `tests/test-250-amendment-unit.cjs` - HONEST-02
- [ ] `tests/test-250-provenance-fence.cjs` - HONEST-03

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (key ceremony) | existing `resolve-brain-key.cjs` (SEC-02 0600 perms, explicit reasons) - unchanged by this phase; SEED-011 option A adds server-side identity LATER, cross-repo |
| V4 Access Control | yes (tier_denied) | server-side tier gate (247-02); client renders, never bypasses |
| V5 Input Validation | yes | refusal messages interpolate ONLY: closed-enum kind, tool name (already coerced), framework canonical name (queue validator caps 120 chars), server 403 message (already sliced to 300 chars in brain-client). Never render unbounded server bodies; never echo user turn text into refusal copy (Part 8 posture) |
| V6 Cryptography | no new surface | key hashing stays sha256-16 in brain-client (untouched) |
| V8 Data Protection | yes | refusal copy must never print the key value or the resolved key path CONTENTS; path NAMES (`~/.mindrian.env`) are fine and already shipped in the hint |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server-controlled 403 body rendered to user (injection into Larry's turn) | Tampering | keep the 300-char slice; render as quoted plain text, never as instructions |
| Refusal copy leaking user context into the queue | Information disclosure (Part 8) | queue validator's closed allowlist already rejects prose; refusal path passes only handles (existing Test-12-pattern audit) |
| Spoofed provenance (a turn faking `■ BRAIN:` on ungrounded content) | Repudiation | instruction-layer risk inherent to skill contracts; mitigations: the mark's closed form (fence-testable), Part 6 dog-fooding (a violation surfaces as a CONTRADICTS edge), and 252's sweep making ungrounded methodology structurally unavailable |

## Sources

### Primary (HIGH confidence - read/grepped in-repo this session)
- `skills/brain-connector/SKILL.md` - doctrine clause lines 31/100, Offer-to-Setup, 249-01 append leg, unreachable-fallback instruction
- `lib/core/tier0-messaging.cjs` + `lib/core/tier0-messaging.test.cjs` - locked shape, value-regex looseness
- `lib/core/brain-client.cjs` - 247-02 sentinels (403 tier_denied, 401 invalid_key, null discipline + do-not-widen note), 249-01 capture opts, `_reasonLoggedThisProcess`, `getTier0Chain`
- `bin/mindrian-brain-mcp-client.cjs` - chokepoint delegation + null conflation (lines 98-126)
- `lib/core/enrichment-queue.cjs` + `scripts/enrichment-queue-append.cjs` - `'refusal'` source pre-validation, idempotency, source-priority
- `scripts/check-shape-declaration.cjs` (lines 180-320) + `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` - predicate 2b, Form B path, exempt-five list, advisory-by-default
- `skills/larry-personality/SKILL.md` + `skills/conversation-mode/SKILL.md` frontmatter - Form B vs Form A precedents; voice-mark contract
- `skills/ui-system/SKILL.md` - `[■ BRAIN]` chip, 12-glyph vocabulary, degrade table, SEED-021 card rule
- `lib/hmi/voice-color-mark.cjs` - frozen 5-glyph set, exactly-one contract, detector anchoring
- `.planning/ROADMAP.md` + `.planning/REQUIREMENTS.md` - lockstep rule, wave order, requirement text
- `docs/2026-08-09-HANDOFF-tier0-removal-milestone.md` + `docs/2026-08-10-HANDOFF-build-the-loop-milestone.md` - causal record, blast radius, Canon obligations, filed consultations
- `.planning/seeds/SEED-011-brain-silent-identity.md` - options A/B/C, 2026-07-01 reframe (C depends on 127.1 substrate)
- `docs/install/BRAIN-SETUP.md`, `.claude/includes/decisions.md`, `docs/MINDRIAN-CANON.md` amendment precedents, `.planning/phases/249-context-driven-enrichment/249-RESEARCH.md`

### Secondary (MEDIUM confidence)
- Filed langtalks/consultant material quoted inside the two handoffs (eps 35/55, Fragmented #307, data4sci blueprint, MotherDuck note, Anthropic prompt finding) - filed 2026-08-09/10, designated do-not-re-research; not re-queried live (tools unavailable, recorded above)

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Doctrine enumeration + chokepoint mechanics: HIGH - every site read or grepped this session, including the two dist mirrors and the shim conflation
- hitl declaration mechanics: HIGH - gate predicate read at source; both precedent skills' frontmatter read
- Amendment structure + sequencing: HIGH on the constraint (lockstep rule is verbatim in ROADMAP), MEDIUM on the recommended application timing (A2/A3 - navigator call)
- Provenance design: HIGH on constraints (frozen contracts read), MEDIUM on the exact mark form (design choice, planner/navigator polish)
- SEED-011 resolution: HIGH on ceremony-today and option C's death, MEDIUM on option A as the pick (A4 - navigator gate)

**Research date:** 2026-08-10
**Valid until:** ~2026-09-10 for in-repo facts (stable, but 252's re-measure rule applies to all counts); the doctrine enumeration should be re-grepped at plan time if any phase lands in between
