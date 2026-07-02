# Phase 209: Shape-F Native Fire - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning
**Source:** Research Express Path (.planning/research/2026-07-02-gate-native-fire-fix.md - SYNTHESIS, phase-ready; 5-lens fan-out, 25 critic verdicts: 24 CONFIRMED, 1 PLAUSIBLE, 0 REFUTED)

<domain>
## Phase Boundary

Close the declared-vs-rendered gap for Shape-F Decision Gates: every surface that DECLARES a gate must FIRE the AskUserQuestion card natively, so the check-card-fire.cjs backstop stops being the mechanism users experience and becomes telemetry.

**In scope = Waves 2-4 of the research plan.** Wave 1 (E1 imperative trailer, E2 contract serialization, P1-P4 doctrine placement) already SHIPPED as quick(gate-native-fire-w1) (commits 37820c61, f20db95c, a4ac4fdc) and is NOT re-planned here.

- **Wave 2 - render rollout:** E3 (slotContext threading), E4 (F.8 binding-gate fix), B1 (canonical firing block stamped into ~86 declared-but-unwired command bodies + AskUserQuestion tool grants), B2 (declared-implies-wired build gate), B3 (extend render coverage to the .md keyspace, fails closed).
- **Wave 3 - conversational-gate bridge:** E5 (mid-dialogue room-pick fork detector + renderRoomChooserCard injection - the incident's actual fork), H3 (PRIMARY side-channel producers for registry-keyed backstop detection), H4 (session-start "Type 1, 2, or 3" anti-exemplar fix). E6 (trailer gate-likelihood enrichment) rides here only if capacity allows.
- **Wave 4 - backstop as telemetry:** H1 (regex FP/FN tuning: drop bare U+25A0, add labeled-box + numbered-prose forms), H2 (WR-06 window widened to the current turn's assistant messages). Deliberately LAST - tune the floor only after native fire lands, using Wave 2-3 intercept telemetry.
- **Eval (GATE):** a Plurai eval per the milestone ground rule (card-fired-vs-prose fidelity) + local parity gate, following the Phase 196/201 pattern (frozen invariants, synthetic CSV, baseline_deferred degrade path, parity test).

</domain>

<decisions>
## Implementation Decisions

### Root-cause chain (all fixes trace to a confirmed RC)
- RC-3 (engine drops rendered.contract at intent-classifier.cjs:1008): fixed by Wave 3 E5 + residual E3/E4. E2 (contract serialization) already shipped in Wave 1.
- RC-4 (command plane declared shapes it never wired): fixed by B1 + B2 + B3.
- RC-5 (backstop post-hoc, narrow, over/under-triggering): tuned by H1 + H2; made registry-aware by H3. Role unchanged (constitutional floor).
- Verdict 24 (session-start MODE_MENU anti-exemplar at scripts/session-start:675-677 and prose "Other rooms:" list at :585): fixed by H4.

### Reuse targets are BINDING (Canon Part 7 - no new renderers, no new dispatcher branches)
- B1 stamps via the shipped backfill machinery: scripts/backfill-hitl-shape.cjs patchSurface pattern (non-destructive insertion), canonical text extracted from the thrice-repeated commands/rooms.md paragraph (lines 26-27, 119-126, 466-468). Same pass adds AskUserQuestion to allowed-tools (two-part delta per verdict 20).
- B2 extends scripts/check-shape-declaration.cjs (validator skeleton at :144-166): declaring command must (a) carry the firing block or an AskUserQuestion mention, (b) grant the tool, (c) not contradict its own body shape. commands/futures.md F.2/F.1 drift (declares F.2 at line 6, body says F.1 at 69/77) is the first caught case.
- B3 extends build-render-coverage.cjs (+ check-render-coverage.cjs): second keyspace for commands/*.md with hitl_shape frontmatter; entry = { surface, declared_shape, wired: bool }; "wired" predicate for .md = canonical firing block (B1 stamp marker) OR explicit AskUserQuestion dispatch instruction, AND allowed-tools grant. Fails closed with the same exclusion-with-reason escape hatch larry-extended.md models (excluded: true + reason).
- E3 threads ctx.roomContext relevantNodes/cortexNodes into renderDial(reachList, opts) at scripts/intent-classifier.cjs:993 so composeLabel resolves {topic}/{room_name}/{framework} instead of the elevation fallback (dial-label-composer.cjs:208-213). Data already exists one call above (lib/core/navigation/room-context.cjs:280-300).
- E4 routes emitBindingGate (scripts/intent-classifier.cjs:1925-1990) through pickShape (or appendAskUserQuestionTrailer + zones.footer) and names AskUserQuestion in its guidance text. SEED-020 single construction door.
- E5 detects the mid-dialogue room resume/switch fork pre-emission (intent-classifier arm or a room-pick sensor in the SENS spine, chokepoint lib/core/insight-sensors.cjs dispatchSensors :572-654, signal pattern sensor-gate-approach.cjs:78) and injects the renderRoomChooserCard envelope (lib/core/room-chooser.cjs:198-216) + the Wave-1 imperative trailer.
- H3 emits ran_entries / reached_gate_entries side-channel records from the three gate-envelope mints: selector-dispatcher pickShape :1024, intent-classifier engine arm :1007, emitBindingGate (post-E4). Registry-keyed PRIMARY detection goes live; regex becomes secondary.
- H4 replaces the session-start MODE_MENU injection with a card-fire instruction (render via pickShape('F.1') + trailer, or instruct the fire explicitly); same for the prose "Other rooms:" list.
- H1 tightens ASCII_BOX_GLYPH_RE (scripts/check-card-fire.cjs:203): drop the bare U+25A0 alternative (sanctioned UI glyph per selector-dispatcher.cjs:256, ui-system SKILL.md:131, dial-presenter.cjs:134 - false-positive full block); add multiline labeled-box form and numbered-prose-gate form.
- H2 fixes WR-06 (check-card-fire.cjs:681-716): askFired = OR across the CURRENT turn's assistant messages (since last user message), not last-message-only.

### Wave-internal sequencing (locked)
- Wave 2: B1 stamp FIRST (flips ~86 entries to wired), THEN B3 gate turns on - so the gate lands green instead of red-flooding CI.
- Wave 4 runs only after Waves 2-3 land (telemetry validates which regex branches still fire).

### What stays with the backstop (constitutional floor - DO NOT touch)
- Stop-event intercept + decision:'block' re-prompt stays (check-card-fire.cjs:477-482). Native fire is instruction-plane; only the hook is deterministic (R15 doctrine, header lines 9-16).
- MAX_FORCE_RETRIES=3 (:159) and MAX_SESSION_INTERCEPTS=12 (:180) stay as-is - CR-04 session-wide un-flappable ceiling is the load-bearing livelock guarantee.
- Degrade envelope stays { continue:true, suppressOutput:true } (:464-469) - fail-open toward the navigator.
- SECONDARY (regex) detection is never removed even after H3 wires PRIMARY - only detector that works when the side-channel writer fails.
- Success metric flips: intercept counters become TELEMETRY that native fire works (target zero); sustained nonzero intercepts on a wired surface = regression signal for Waves 2-3.

### Canon constraints
- Parts 3 (Shape F), 6 (dogfooding), 7 (reuse before build - every fix extends a shipped module or copies a shipped pattern), 11, 12. No em-dashes anywhere in output or code comments.
- Part 8: zero Brain wire anywhere in this phase; all writes LOCAL.
- DIAL-ATOM-01 is locked: never gate the trailer OFF; E6 (if attempted) only enriches it.

### Claude's Discretion
- Exact sensor vs intent-classifier-arm placement for the E5 room-pick detector (research names both; pick the one that reuses the most shipped machinery).
- Side-channel record schema for H3 (must satisfy check-card-fire.cjs's already-shipped PRIMARY consumer doctrine, lines 48-58).
- Whether E6 ships (optional hardening; only if Wave 3 lands with capacity).
- Plurai eval CSV row design, judge prompt wording, and frozen-invariant selection (follow Phase 196/201 gate pattern).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The fix plan (source of truth for this phase)
- `.planning/research/2026-07-02-gate-native-fire-fix.md` - the full RC chain, fix tables (IDs P1-P4/E1-E6/H1-H4/B1-B3), wave order, backstop floor doctrine. Every task in this phase traces to an ID in this doc.

### Wave 1 shipped surface (do not re-do; build on it)
- `lib/hmi/selector-dispatcher.cjs` - appendAskUserQuestionTrailer (now emits the BINDING line, E1); pickShape trailer door at :1024 (SEED-020)
- `scripts/intent-classifier.cjs` - engine arm :993-1011 (E2 contract serialization shipped; E3/E5 seams), emitBindingGate :1925-1990 (E4), f1_closer_payload :1753-1760
- `agents/larry-extended.md`, `skills/ui-system/SKILL.md`, `skills/larry-personality/SKILL.md` - P1-P4 doctrine now present

### Render/declaration machinery (Wave 2 reuse targets)
- `scripts/backfill-hitl-shape.cjs` - patchSurface non-destructive insertion machinery (:21-27 contract)
- `scripts/check-shape-declaration.cjs` - validator skeleton :144-166
- `scripts/build-render-coverage.cjs` (:19-23, :111 .cjs filter) + `scripts/check-render-coverage.cjs` (:29, :189 call-site predicates) + `data/render-coverage-registry.json` (16 entries, all .cjs)
- `commands/rooms.md` - canonical firing paragraph x3 (lines 26-27, 119-126, 466-468)
- `commands/futures.md` - F.2/F.1 drift exemplar (line 6 vs 69/77)
- `commands/think-hats.md:21`, `scenario-plan.md:16`, `persona.md:41`, `deep-grade.md:16` - missing tool grants

### Conversational bridge (Wave 3 reuse targets)
- `lib/core/room-chooser.cjs` - renderRoomChooserCard :198-216
- `lib/core/insight-sensors.cjs` - dispatchSensors chokepoint :572-654
- `lib/core/sensors/sensor-gate-approach.cjs:78` - gate-likelihood signal pattern
- `scripts/room-naming-selector.cjs:156-160` - "INSTRUCTION FOR LARRY" imperative pattern (shipped, proven)
- `scripts/session-start` - MODE_MENU :675-677, "Other rooms:" :585
- `lib/hmi/dial-presenter.cjs` (:58 renderDial return, :353-356 slotContext default), `lib/hmi/dial-label-composer.cjs` (:208-213 fallback), `lib/core/navigation/room-context.cjs` (:280-300)

### Backstop (Wave 4 target + floor doctrine)
- `scripts/check-card-fire.cjs` - regex :203 (H1), WR-06 :681-716 (H2), PRIMARY consumer :48-58 (H3), floor constants :159/:180, degrade :464-469

### Eval gate pattern (Part 7 reuse)
- `lib/core/ralph-loop-gate.cjs` + `evals/plurai/201-baseline.json` + `tests/run-all-201.sh` - the Phase 201 frozen-invariant gate pattern
- Phase 196 gate pattern (first instance of baseline_deferred + local parity)

</canonical_refs>

<specifics>
## Specific Ideas

- Adversarial phase verification (from the research doc): replay the incident transcript shape (mid-dialogue room resume) and assert (a) card fires natively turn-1, (b) zero check-card-fire intercepts, (c) render-coverage gate green with 0 unwired declared commands, (d) a legit U+25A0-bearing non-gate turn passes without block.
- ~86 of 105 backfilled commands are declared-but-unwired; ~21 bodies already mention AskUserQuestion (do not double-stamp those - the stamp must be idempotent).
- The B1 stamp marker doubles as the B3 "wired" predicate - design them together.

</specifics>

<deferred>
## Deferred Ideas

- E6 (trailer gate-likelihood parameterization) - optional, rides Wave 3 only if capacity allows.
- Navigator-visible one-line note on backstop degrade (QoL, explicitly out of scope per research doc section 4).
- Low-confidence incident telemetry figures ("~20s per intercept") - not repo-verifiable, not planned against.

</deferred>

---

*Phase: 209-shape-f-native-fire*
*Context gathered: 2026-07-02 via Research Express Path (research doc is discussion-equivalent; navigator directed "go on with phase 209")*
