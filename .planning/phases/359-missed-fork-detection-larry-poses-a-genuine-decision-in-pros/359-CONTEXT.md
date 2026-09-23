# Phase 359: Missed-fork detection (Larry poses a genuine decision in prose and no card fires) - Context

**Gathered:** 2026-09-23 (`/gsd-discuss-phase 359 --auto`, single pass; every choice is the recommended default
and is logged `[auto]` in 359-DISCUSSION-LOG.md. Items marked `[navigator-review]` should be surfaced to the
navigator before planning locks them.)
**Status:** Ready for planning. EXECUTION IS HELD until Phase 357 completes, including 357-10 (see D-17).

<domain>
## Phase Boundary

This phase gives Larry one strict, machine-readable way to say "I just posed a fork" on the last line of a
prose turn, and teaches the card gate to read only that line. A declared fork with no card is intercepted
deterministically on the CLI Stop hook and the MCP `stop_gate_check`. The hook never guesses a fork from free
text. The phase proves the new arm is inert on every historic output (357 corpus), catches 100% of declared
synthetic forks, and cuts forward missed forks by at least half on an authored scenario set, or records the
declaration approach as falsified and reverts only the prose.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `359-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `359-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- The `prose_fork` / `fork_labels` label dimension, and the synthetic prose-fork + control fixture file
- The `missed_forks`, `declared_catch_rate` and `control_false_blocks` replay metrics, and the pre-359 baseline
- The fork declaration grammar module and its pure parser
- The declared-fork arm in `classifyCardFire`, with `deriveTurnSignals` threading
- MCP `stop_gate_check` passthrough, and a gate_render payload built from the declared labels
- The byte-capped declaration rule in the 2 Larry card spans, the session-start card-fire doctrine and the MCP
  server instructions
- The dev-only forward scenario run (pre/post)
- `tests/run-all-359.sh`, plus the card-fire suite wiring

**Out of scope (from SPEC.md):**
- Any runtime or hook Jev call, and any user or dogfood text to Jev (2026-09-17 rulings)
- Detecting forks from free prose with regex, token overlap or a classifier (the retired ~86% false-positive
  class; R5 tripwires it)
- Using the black-square voice glyph as the fork declaration (Part 12 voice doctrine)
- 357's own false-block fixes (D-07, D-08a) and its corpus, harness and labeler (359 consumes them)
- 360's room-bind picker on harness turns (UserPromptSubmit hook)
- When Desktop/Cowork Larry calls `stop_gate_check` (chat-only prose fork on a hookless surface stays a residual)
- intent-classifier minting of stale or unrelated F.1 reaches
- The other 13 Larry per-turn judgments
- The user-level copy `~/.claude/agents/larry-extended.md`

</spec_lock>

<decisions>
## Implementation Decisions

### Declaration line: grammar, prefix, visibility (gray area 1) [navigator-review]
- **D-01 (VISIBLE, not hidden):** the declaration is a visible, plain-language line. It is not hidden.
  - Why not hidden: the Claude Code terminal renders the assistant text as raw-ish markdown, and an HTML
    comment (`<!-- ... -->`) is NOT hidden there. A "hidden" marker would show up as visible machine noise,
    which is worse UX than an honest line. No other hiding channel exists that survives the CLI, Desktop and
    Cowork alike.
  - Why visible is a UX gain, not a cost: the line doubles as a one-line recap of the choice. When the card
    does not fire (Desktop chat-only turn, bounded escape released, any residual), the navigator still sees
    the options named plainly and can answer by typing one. When the hook re-prompts and the card fires, the
    recap is a small, readable redundancy.
- **D-02 (exact grammar):** the declaration line is

  `Your call: <label 1> | <label 2>[ | <label 3>[ | <label 4>[ | <label 5>]]]`

  - Prefix: the exact ASCII string `Your call: ` (capital Y, colon, one space), case-sensitive, at column 0.
    No leading whitespace, no markdown emphasis (`**Your call:**` is NOT a declaration), no leading glyph.
  - Separator: exactly ` | ` (space, pipe, space). Labels are trimmed; empty labels reject the whole line.
  - 2 to 5 labels; each at most 80 characters (counted in code points, so Hebrew labels work); duplicate labels
    (case-insensitive) reject the whole line.
  - Rejected characters anywhere on the line: `[` and `]` (so no accepted line can ever match
    `ASCII_BOX_UNCONDITIONAL_RE`'s bracket arms), and any of the 5 `MARK_GLYPHS` voice squares (so
    `detectVoiceMark`'s exactly-one contract holds). A line that matches the `type 1, 2, or 3` literal is also
    rejected (covered by a test that runs the backstop regex over every accepted fixture line).
  - It is the last non-empty line of the output (trailing whitespace and blank lines ignored). The parser never
    looks at any other line (SPEC R3).
- **D-03 (why this wording):** "Your call:" is Larry's own voice (plain English, warm but demanding, hands the
  decision to the navigator), it is not a command name and not jargon like "Fork:". The ui-system `arrow`
  glyph ("Inline suggestion") was considered as a lead-in, but SPEC R3 locks a fixed ASCII prefix, and the
  `→` glyph already leads the hook-minted "Choose next reach:" dial prompt, which Larry must never hand-draw
  (SKILL item 5). "Choose:" and "Options:" were rejected for the same collision and for being common natural
  last lines. The pipe grammar makes an accidental match in ordinary prose very unlikely; R5's replay proves it
  on the historic corpus.
  - `[auto][navigator-review]`: the prefix string and the visible call are the two choices the navigator has
    not ruled on. Both are one-constant changes in the parser module (D-04) plus the prose surfaces, and a
    drift test (D-05) keeps them in sync.

### Parser module location (gray area 2)
- **D-04:** the grammar lives in a new pure module `lib/core/fork-declaration.cjs`, exporting
  `parseForkDeclaration(outputText)` -> `{declared: true, labels: [...]}` or `{declared: false}`, plus the frozen
  constants `DECLARATION_PREFIX`, `DECLARATION_SEPARATOR`, `MIN_LABELS`, `MAX_LABELS`, `MAX_LABEL_CHARS`.
  - `lib/core` (not `lib/hmi`) because it is a gate-domain grammar consumed by the card gate, sitting next to
    its sibling `lib/core/gate-relevance.cjs`. `lib/hmi` is presentation.
  - Pure CJS: no fs, no network, no clock, never throws (non-string input -> `{declared: false}`).
  - `labels` are returned in their original display form (trimmed). Normalization for the yes/no check is done
    by the caller with the same normalizer `extractOptionLabels` uses (researcher: confirm which normalizer
    `isYesNoShapedGate` expects).
  - Voice glyph set: import `MARK_GLYPHS` from `lib/hmi/voice-color-mark.cjs` only if `lib/core` -> `lib/hmi`
    imports are already accepted in the tree; otherwise hold a frozen local copy plus a drift test against
    `MARK_GLYPHS`. Researcher decides from the layering evidence.
- **D-05:** both consumers (`scripts/check-card-fire.cjs::deriveTurnSignals` and, through it,
  `lib/mcp/stop-gate-handler.cjs`) call this one parser. A drift test asserts every prose surface from D-14
  contains the literal `DECLARATION_PREFIX` and the ` | ` separator exactly as exported.

### Arm ordering in classifyCardFire (gray area 3)
- **D-06 (order):**
  1. `card-fired` -> pass (unchanged, still first).
  2. Compute `primaryHit`, `backstopHit` (both unchanged) and `forkDeclared` (from the turn signals).
  3. If none of the three -> `no-gate-signal` (unchanged).
  4. If `forkDeclared` -> the declared arm owns the verdict:
     - session ceiling reached -> degrade (same reason string as today)
     - retry ceiling reached -> degrade (same reason string as today)
     - declared labels yes/no-shaped (`isYesNoShapedGate` over normalized labels) -> pass, `gate-is-simple-binary`
     - otherwise -> intercept, reason `declared-fork-no-card`

     It skips `backstop-uncorroborated-by-side-channel`, `primary-gate-existence-unconfirmed`, the synthetic
     preceding-source guard, `gate-irrelevant-to-turn` and `gate-already-answered` (SPEC R4: the declaration is
     Larry's own assertion, this turn, that the fork is live).
  5. Otherwise -> the existing PRIMARY/BACKSTOP path, byte-for-byte unchanged.
- **D-07 (why declared wins over PRIMARY when both hit):** the alternative, a declared arm that only runs when
  PRIMARY and BACKSTOP both miss, loses exactly the case 359 exists for: a stale, irrelevant F.1 reach (PRIMARY
  hit, then passed as `gate-irrelevant-to-turn`) on the same turn Larry poses a real prose fork. Declared-first
  also means the card payload carries the labels of the live fork, not the stale reach. Inertness is untouched:
  a turn with no declaration takes step 5, the same code as today (R5 holds by construction).
- **D-08 (retry key):** for a declared turn, the gate identity fed to `turnContextHash` becomes
  `<existing ran/gate_signature identity>|decl:<sorted normalized labels>`, so the key includes the declared
  labels (SPEC R4) and stays invariant across re-worded prose (WR-01) and transcript growth (CR-02/03). Turns
  without a declaration keep today's key byte-identical.
- **D-09 (CR-06):** `buildEnforcementEnvelope` is not changed. The `declared-fork-no-card` slug appears only in
  the local intercept log; the user sees today's calm reason text.

### Tri-Polar passthrough (supports SPEC R7)
- **D-10:** `deriveTurnSignals` threads `fork_declared` and `declared_labels`, so the MCP handler gets them for
  free through its existing `deriveTurnSignals(ctx)` call. `buildStopGateCard(turn)` uses `declared_labels` as
  the option labels when `fork_declared` is true, else today's `rawExtractOptionLabels` path. Header text is
  unchanged.

### Forward-run harness (gray area 4)
- **D-11:** `scripts/forward-fork-scenarios-359.cjs` (dev-only, not in CI, never imported from `lib/` or
  `hooks/`; a tripwire leg asserts this). Scenarios live in `tests/fixtures/forward-fork-scenarios-359.json`:
  at least 10 fork-eliciting and 10 control scenarios, authored text only, each with an authored
  `poses_fork: true|false` label and, for forks, the expected `fork_labels`. Scenario labels are authored, never
  Jev (SPEC R9 "judged by the scenario's own authored label").
- **D-12 (invocation shape):** follow the repo's proven headless pattern (`scripts/skillopt-funnel.cjs`,
  `scripts/huji-run-one.cjs`): `claude -p <scenario> --plugin-dir <tree> --output-format stream-json`,
  keychain auth (never `--bare`), `--no-session-persistence`, a pinned model id identical for pre and post
  (never the Fable model), `--max-turns` small, `--max-budget-usd` per run.
  - Hermetic: a fresh temp `MINDRIAN_HOME` and temp `MINDRIAN_ROOMS_HOME` per run, so counters, intercept log
    and room binding cannot leak between runs.
  - Measurement: a run counts as a card when the stream carries an `AskUserQuestion` tool_use block (fired or
    denied), and as a declaration when `parseForkDeclaration` accepts the FIRST final assistant text, read
    before any Stop-hook re-prompt. Forward missed fork = `poses_fork: true` and neither.
  - Pre vs post: "pre" is the tree with R3 to R7 code landed but R8 prose not yet applied; "post" is the same
    tree after the R8 commit. Only the prose differs, so the delta is attributable to R8.
  - Bound: 20 or more scenarios x 3 runs x 2 arms = 120 or more runs. Default cap: at most USD 0.40 per run,
    the script refuses to start if the projected ceiling exceeds USD 60, runs are sequential with a
    resumable results file under the gitignored scratch path, and only counts plus scenario ids are committed.
  - Assumptions the researcher must verify are listed under "Open assumptions" below.

### Prose placement and byte budget (gray area 5)
- **D-13 (rule text):** one rule, same meaning on every surface: "At a navigator fork, fire the card. If the
  turn still ends in prose, make the last line `Your call: A | B` (2 to 5 options)." Phrasing per surface is
  Claude's discretion within D-14's allocation.
- **D-14 (placement and allocation, 400 B total cap, measured against the post-357 files):**
  - `agents/larry-extended.md` "## Decision Gates" section (post-357-10 shrunk text): about 110 B
  - `skills/larry-personality/SKILL.md` item 5 (post-357-10 shrunk line, about :216): about 90 B
  - `scripts/session-start` `NAV_CARD_FIRE_DOCTRINE`: about 110 B
  - `lib/mcp/runtime-instructions.cjs` item 3 (DECISION GATES): net at most 16 B added. The string is 1984 B
    today against the 2000 B budget and 2048 B hard cap enforced by `lib/mcp/no-instructions.test.cjs`, so the
    rule must be folded into item 3 with a compensating trim elsewhere in the same string. The frozen
    BOUNDARIES paragraph is never trimmed.
  - Net bytes are measured per surface with the same measurement commands 357-10 uses (awk span for
    larry-extended, the item-5 line for SKILL), plus `Buffer.byteLength` for the MCP string and the doctrine
    string.
- **D-15 (preserved invariants):** the 357 R-B pinned phrases survive (`## Decision Gates`,
  `no card, no picture (SEED-021)`, `AskUserQuestion`); `## Post-Gate Handoff` and SKILL :244 (Voice Signature
  residual) are not touched; `tests/test-larry-voice-mark-182.cjs`, `tests/test-205-voice-mark-hybrid.cjs`,
  `tests/test-larry-handoff-seam.cjs`, `tests/test-gate-native-fire-w1.cjs` stay green;
  `data/harness-manifest.json` is regenerated.
- **D-16 (R8 is the last change, and revertible alone):** R8 lands as its own commit after R3 to R7 are green,
  so the R9 falsification branch can revert exactly that commit.
- **D-17 (sequencing):** 359 execution starts only after 357 is complete on disk (corpus, replay harness,
  labeler, `card_fire_replay` profile, D-06 labels, 357-10 shrink or its recorded skip). If 357-10 skipped the
  shrink, the 400 B cap is measured against the unshrunk post-357 files.

### Fixtures and dev-time labeling (gray area 6)
- **D-18 (file and shape):** `tests/fixtures/card-fire-replay/prose-forks-359.json`, with a `meta` block carrying
  `sanitization_statement` (the 238 and 357 precedent), `source: 'synthetic-359'` on every entry, and the 357
  D-02 entry shape plus `prose_fork` and `fork_labels`. Envelopes use direct fields only (357 R-I: synthetic
  entries are direct-field).
- **D-19 (composition):**
  - At least 15 prose forks: the sanitized intern-w1 two-way phrasings ("research first vs build the plan",
    "build the plan now vs file evidence first", and the third), 2-way and 3-to-5-way forks, forks phrased
    as a question and as a recommendation-plus-alternative, and at least 2 yes/no-shaped forks (they exercise
    the `gate-is-simple-binary` exclusion in R6).
  - At least 15 controls: the six backstop-benign shapes (clarifying-question pair, informational step list,
    the "NOT options to pick between" disclaimer, a footnote reference list, an Action Footer, a caveat list),
    rhetorical "X or Y?" questions the same turn answers, and closing yes/no offers. At least 3 controls end
    with a near-miss declaration (a `Your call:` line with 1 label, with a bracket, or not on the last line),
    so the replay exercises parser negatives end to end.
- **D-20 (labeling):** hand labels first (`label_origin: 'hand'`), then 357's labeler
  (`scripts/label-card-fire-replay.cjs`) runs its `is-fork` Noul over the synthetic entries through 357's
  existing `card_fire_replay` egress profile in `scripts/jev-devtime-client.cjs`. No new EGRESS_PROFILES entry
  is added (SPEC R1 locks "no new egress profile"). Disagreements go to `359-JEV-LABEL-REPORT.md` for a ruling
  and are never auto-applied; the 357 D-12 thresholds (>= 0.80 yes, <= 0.20 no, else uncertain) apply. With no
  key, the labeler degrades to `unlabeled` and exit 0.
  - Note: the orchestrator's brief suggested a 359-owned EGRESS_PROFILES entry. The locked SPEC R1 says reuse
    357's profile, and the profile's allowed keys (`output_text` and friends) already cover a prose output, so
    the SPEC wins. `[navigator-review]` only if a key outside that profile turns out to be needed.
- **D-21 (dogfood):** 357 dogfood entries get `prose_fork` proposed locally (`label_origin: local`) in one
  review sheet, `359-DOGFOOD-FORK-LABELS.md`, flipped to `human` at a single navigator checkpoint. Dogfood text
  never goes to Jev (the 357 labeler refusal stays green).
- **D-22 (baselines):** the pre-359 `missed_forks` value goes into a 359-owned sibling,
  `tests/fixtures/card-fire-replay/baseline-359.json`, written with `replay-card-fire.cjs --code-root` against
  the pre-359 commit. 357's `baseline.json` is not edited (single owner). The R5 inertness compare still runs
  against 357's `baseline.json`.

### Standing gate (supports SPEC R10)
- **D-23:** `tests/run-all-359.sh` runs the parser tests, the R4 legs, the loader test, the R5 inertness replay,
  the R6 declared-variant replay, the regex byte-identity tripwire and the dev-script-not-imported tripwire.
  The 359 replay leg is also appended to the card-fire suite runner 357 R-J wired (`run-all-238.sh`). The two
  mutation legs (declared arm removed; a free-text fork regex added that flips a control) run as a
  `--mutation` mode of the 359 test, following 357-09's mutation-leg pattern.

### Claude's Discretion
- Exact per-surface wording of the rule within D-14's byte allocation.
- Fixture ids and the internal layout of the forward-run script and its results file.
- Whether the replay reports per-entry parser diagnostics.
- Test file split, as long as D-23's standing gate exists.

### Todos reviewed, not folded
- `todo.match-phase 359` returned 8 keyword-only matches (bono sensor mirror, registry-drift gate, F7 rescope,
  git-stash rule, skill-description ingest, deck slide count, Theo gate-render mirror, autonomous_safe audit).
  None concerns prose-fork detection. Auto mode's ">= 0.4 folds" rule was overridden by the scope guardrail:
  folding any of them would be scope creep. Logged in the discussion log.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked scope
- `.planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros/359-SPEC.md` - locked
  requirements. MUST read before planning.
- `CLAUDE.md` - Canon Part 8 (egress), Part 11 R15/R16 (HITL shapes), Part 12 (voice glyphs), Tri-Polar rule,
  no em-dashes.

### Phase 357 (hard dependency and instrument)
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-SPEC.md`
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-CONTEXT.md` - D-02 entry
  shape, D-10..D-12 labeler and Noul thresholds, D-13/D-14 replay harness, post-research rulings R-B (shrink set
  and pinned phrases), R-I (direct-field synthetic entries, `--code-root`), R-J (standing gate runners)
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-10-PLAN.md` - the prose
  shrink 359's rule lands on top of, and the span measurement commands reused by D-14

### Gate code under change
- `scripts/check-card-fire.cjs` - `ASCII_BOX_GLYPH_RE` :277 and `ASCII_BOX_UNCONDITIONAL_RE` :302 (byte-identical
  tripwire), `turnContextHash` :444, `computeBackstopHit` :477, `classifyCardFire` :523, `buildEnforcementEnvelope`
  :788, `deriveTurnSignals` :1482
- `lib/core/gate-relevance.cjs` - `extractOptionLabels` :200, `isYesNoShapedGate` :238
- `lib/hmi/voice-color-mark.cjs` - `MARK_GLYPHS` :112, `detectVoiceMark`
- `lib/mcp/stop-gate-handler.cjs` - `buildStopGateCard` :350, `handleStopEvent` :449
- `lib/mcp/runtime-instructions.cjs` - MCP server instructions (1984 B of a 2000 B budget) and
  `lib/mcp/no-instructions.test.cjs` (budget and frozen BOUNDARIES copy)

### Prose targets
- `agents/larry-extended.md` - "## Decision Gates" section (post-357 text); "## Post-Gate Handoff" not touched
- `skills/larry-personality/SKILL.md` - item 5 "Never hand-draw the dial glyphs" (about :216); :244 not touched
- `scripts/session-start` - `NAV_CARD_FIRE_DOCTRINE` (about :1794)
- `skills/ui-system/SKILL.md` §3 Symbol Vocabulary (12 glyphs, no emoji) - why the prefix is plain ASCII
- `data/harness-manifest.json`, `scripts/build-harness-manifest.cjs`, `data/harness-policies/contract-parity-larry.json`

### Evidence and history
- `.planning/debug/resolved/intern-w1-card-discipline-decay.md` - the 3 missed two-way prose forks
- `.planning/debug/resolved/backstop-benign-list-defeats-relevance-gate.md`,
  `.planning/debug/resolved/card-fire-relevance-check-gap.md` - the retired numbered-prose arm (~86% FP)

### Jev (dev-time only)
- `scripts/jev-devtime-client.cjs` - `EGRESS_PROFILES` (359 reuses 357's `card_fire_replay`, adds none)
- `.claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md` - Jev API contract and the 2026-09-17 rulings

### Headless run precedent (R9)
- `scripts/skillopt-funnel.cjs` :165-182 and `scripts/huji-run-one.cjs` :250-275 - `claude -p --plugin-dir`,
  keychain auth, budget caps, no session persistence

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deriveTurnSignals(env)`: the single seam both surfaces already share; adding two fields there reaches the MCP
  handler with no second wiring.
- `gateRelevance.isYesNoShapedGate`: reused for the declared yes/no exemption (no new semantic test).
- `turnContextHash` identity precedence: extended with a `decl:` suffix only when declared (D-08).
- 357's replay harness, labeler and `card_fire_replay` egress profile: 359 adds metrics and a fixture file,
  it does not rebuild them.
- `buildStopGateCard`: already composes options from labels; it gains a declared-labels branch.

### Established Patterns
- Every card-fire change ships a regression leg per RCA, and the two box regexes are byte-frozen.
- Fail toward the card on uncertainty, but never read meaning from free text in the hook (the retired arm).
- Dev-time vendor and headless-model code lives under `scripts/`, with tripwires banning it from `lib/` and
  `hooks/`.
- Prose surfaces carry byte budgets with tests (MCP instructions 2000 B; 357 R-B span measurement).

### Integration Points
- `lib/core/fork-declaration.cjs` -> `scripts/check-card-fire.cjs::deriveTurnSignals` -> `classifyCardFire`
  (CLI Stop hook) and -> `lib/mcp/stop-gate-handler.cjs::handleStopEvent` / `buildStopGateCard` (Desktop/Cowork)
- `scripts/replay-card-fire.cjs` gains `missed_forks`, `declared_catch_rate`, `control_false_blocks`
- `tests/run-all-359.sh` plus `run-all-238.sh` (357 R-J card-fire suite runner)

</code_context>

<specifics>
## Specific Ideas

- The navigator's complaint, verbatim in spirit: "not getting decision point cards in cli". The intern-w1 three
  two-way forks ("research first vs build the plan") are the anchor fixtures.
- Example of the declared form Larry would end a prose fork turn with:
  `Your call: Run the research first | Build the plan now`
- The visible line is meant to read like Larry handing over the decision, not like a machine tag.

## Open assumptions for the researcher

- **A1 (headless AskUserQuestion):** whether `AskUserQuestion` is offered in `claude -p` mode and whether an
  attempted call appears as a `tool_use` block in `stream-json` even when denied. If it is not offered, the
  forward run measures declaration adoption only, and the metric definition in D-12 must say so.
- **A2 (Stop hook in headless):** whether plugin Stop hooks run under `claude -p --plugin-dir`, and how to read
  the FIRST final assistant text before any block re-prompt (stream-json ordering, or the temp intercept log).
- **A3 (Larry persona loading):** whether the plugin's SessionStart hook injects the Larry persona and the
  card-fire doctrine in headless mode, or whether the script must pass `--agent mos:larry-extended` (or
  `--append-system-prompt-file`) to get Larry. Pre and post must load him identically.
- **A4 (room picker confound):** whether an unbound temp rooms home makes Larry fire the F.8 room-picker card
  on turn 1, which would count as a card and mask the fork measure. If so, pre-bind a scratch room.
- **A5 (prefix collision count):** a count-only local check (Part 8: no text printed) of how many historic
  assistant turns have a last line starting `Your call: ` with ` | `. Expected 0; R5 replay proves it on the
  committed corpus either way.
- **A6 (doctrine byte pins):** whether any test pins `NAV_CARD_FIRE_DOCTRINE` bytes or the SKILL item-5 line
  (for example `tests/test-gate-native-fire-w1.cjs`, contract-parity policy), which would need a coordinated
  update.
- **A7 (normalizer):** which normalizer `isYesNoShapedGate` expects (it takes `extractOptionLabels` output), so
  declared display labels are normalized the same way before the yes/no check.
- **A8 (layering):** whether `lib/core` may import from `lib/hmi` (for `MARK_GLYPHS`), or a frozen local copy
  plus drift test is required (D-04).
- **A9 (cost):** actual per-run cost and wall time of one headless Larry turn at the pinned model, to confirm
  the USD 0.40 per-run and USD 60 total caps in D-12.

</specifics>

<deferred>
## Deferred Ideas

- **Desktop/Cowork chat-only-turn residual:** hookless Larry skips `stop_gate_check` on chat-only turns, so a
  prose fork there stays uncaught even with a declaration. A future phase could make hookless Larry call
  `stop_gate_check` whenever his last line is a declaration.
- **Any free-text fork detector** (regex, token overlap, classifier): permanently out, tripwired by R5/R10.
- **Hidden declaration:** revisit only if Claude Code ever hides HTML comments or offers a hidden-metadata
  channel on all three surfaces.
- **Voice-glyph-as-declaration:** out (Part 12).
- **Room-bind picker on harness turns:** Phase 360.
- **intent-classifier unrelated F.1 mints:** upstream cause, its own phase.
- **If R9 falsifies the declaration approach:** the follow-on phase is opened by the R9 falsification branch.

### Reviewed Todos (not folded)
- The 8 keyword-only matches listed under D-level "Todos reviewed, not folded" - unrelated to prose-fork
  detection; out of scope.

</deferred>

---

*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Context gathered: 2026-09-23*
