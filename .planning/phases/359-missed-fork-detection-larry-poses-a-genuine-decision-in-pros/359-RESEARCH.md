# Phase 359: Missed-fork detection (Larry declares the fork, the Stop hook checks it) - Research

**Researched:** 2026-09-23
**Domain:** Deterministic card-gate classifier extension (CJS, Stop hook + MCP), Larry prose budget, dev-time headless Claude Code measurement
**Confidence:** HIGH for the code seams, budgets and pins (read from source this session); MEDIUM for the headless forward run (docs are clear on the rules, but no paid run was made, so the stream shape is unverified)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Declaration line: grammar, prefix, visibility (gray area 1) [navigator-review]**
- **D-01 (VISIBLE, not hidden):** the declaration is a visible, plain-language line. It is not hidden.
  - Why not hidden: the Claude Code terminal renders the assistant text as raw-ish markdown, and an HTML comment (`<!-- ... -->`) is NOT hidden there. A "hidden" marker would show up as visible machine noise, which is worse UX than an honest line. No other hiding channel exists that survives the CLI, Desktop and Cowork alike.
  - Why visible is a UX gain, not a cost: the line doubles as a one-line recap of the choice. When the card does not fire (Desktop chat-only turn, bounded escape released, any residual), the navigator still sees the options named plainly and can answer by typing one. When the hook re-prompts and the card fires, the recap is a small, readable redundancy.
- **D-02 (exact grammar):** the declaration line is `Your call: <label 1> | <label 2>[ | <label 3>[ | <label 4>[ | <label 5>]]]`
  - Prefix: the exact ASCII string `Your call: ` (capital Y, colon, one space), case-sensitive, at column 0. No leading whitespace, no markdown emphasis (`**Your call:**` is NOT a declaration), no leading glyph.
  - Separator: exactly ` | ` (space, pipe, space). Labels are trimmed; empty labels reject the whole line.
  - 2 to 5 labels; each at most 80 characters (counted in code points, so Hebrew labels work); duplicate labels (case-insensitive) reject the whole line.
  - Rejected characters anywhere on the line: `[` and `]` (so no accepted line can ever match `ASCII_BOX_UNCONDITIONAL_RE`'s bracket arms), and any of the 5 `MARK_GLYPHS` voice squares (so `detectVoiceMark`'s exactly-one contract holds). A line that matches the `type 1, 2, or 3` literal is also rejected (covered by a test that runs the backstop regex over every accepted fixture line).
  - It is the last non-empty line of the output (trailing whitespace and blank lines ignored). The parser never looks at any other line (SPEC R3).
- **D-03 (why this wording):** "Your call:" is Larry's own voice (plain English, warm but demanding, hands the decision to the navigator), it is not a command name and not jargon like "Fork:". The ui-system `arrow` glyph ("Inline suggestion") was considered as a lead-in, but SPEC R3 locks a fixed ASCII prefix, and the `→` glyph already leads the hook-minted "Choose next reach:" dial prompt, which Larry must never hand-draw (SKILL item 5). "Choose:" and "Options:" were rejected for the same collision and for being common natural last lines. The pipe grammar makes an accidental match in ordinary prose very unlikely; R5's replay proves it on the historic corpus.
  - `[auto][navigator-review]`: the prefix string and the visible call are the two choices the navigator has not ruled on. Both are one-constant changes in the parser module (D-04) plus the prose surfaces, and a drift test (D-05) keeps them in sync.

**Parser module location (gray area 2)**
- **D-04:** the grammar lives in a new pure module `lib/core/fork-declaration.cjs`, exporting `parseForkDeclaration(outputText)` -> `{declared: true, labels: [...]}` or `{declared: false}`, plus the frozen constants `DECLARATION_PREFIX`, `DECLARATION_SEPARATOR`, `MIN_LABELS`, `MAX_LABELS`, `MAX_LABEL_CHARS`.
  - `lib/core` (not `lib/hmi`) because it is a gate-domain grammar consumed by the card gate, sitting next to its sibling `lib/core/gate-relevance.cjs`. `lib/hmi` is presentation.
  - Pure CJS: no fs, no network, no clock, never throws (non-string input -> `{declared: false}`).
  - `labels` are returned in their original display form (trimmed). Normalization for the yes/no check is done by the caller with the same normalizer `extractOptionLabels` uses (researcher: confirm which normalizer `isYesNoShapedGate` expects).
  - Voice glyph set: import `MARK_GLYPHS` from `lib/hmi/voice-color-mark.cjs` only if `lib/core` -> `lib/hmi` imports are already accepted in the tree; otherwise hold a frozen local copy plus a drift test against `MARK_GLYPHS`. Researcher decides from the layering evidence.
- **D-05:** both consumers (`scripts/check-card-fire.cjs::deriveTurnSignals` and, through it, `lib/mcp/stop-gate-handler.cjs`) call this one parser. A drift test asserts every prose surface from D-14 contains the literal `DECLARATION_PREFIX` and the ` | ` separator exactly as exported.

**Arm ordering in classifyCardFire (gray area 3)**
- **D-06 (order):**
  1. `card-fired` -> pass (unchanged, still first).
  2. Compute `primaryHit`, `backstopHit` (both unchanged) and `forkDeclared` (from the turn signals).
  3. If none of the three -> `no-gate-signal` (unchanged).
  4. If `forkDeclared` -> the declared arm owns the verdict:
     - session ceiling reached -> degrade (same reason string as today)
     - retry ceiling reached -> degrade (same reason string as today)
     - declared labels yes/no-shaped (`isYesNoShapedGate` over normalized labels) -> pass, `gate-is-simple-binary`
     - otherwise -> intercept, reason `declared-fork-no-card`

     It skips `backstop-uncorroborated-by-side-channel`, `primary-gate-existence-unconfirmed`, the synthetic preceding-source guard, `gate-irrelevant-to-turn` and `gate-already-answered` (SPEC R4: the declaration is Larry's own assertion, this turn, that the fork is live).
  5. Otherwise -> the existing PRIMARY/BACKSTOP path, byte-for-byte unchanged.
- **D-07 (why declared wins over PRIMARY when both hit):** the alternative, a declared arm that only runs when PRIMARY and BACKSTOP both miss, loses exactly the case 359 exists for: a stale, irrelevant F.1 reach (PRIMARY hit, then passed as `gate-irrelevant-to-turn`) on the same turn Larry poses a real prose fork. Declared-first also means the card payload carries the labels of the live fork, not the stale reach. Inertness is untouched: a turn with no declaration takes step 5, the same code as today (R5 holds by construction).
- **D-08 (retry key):** for a declared turn, the gate identity fed to `turnContextHash` becomes `<existing ran/gate_signature identity>|decl:<sorted normalized labels>`, so the key includes the declared labels (SPEC R4) and stays invariant across re-worded prose (WR-01) and transcript growth (CR-02/03). Turns without a declaration keep today's key byte-identical.
- **D-09 (CR-06):** `buildEnforcementEnvelope` is not changed. The `declared-fork-no-card` slug appears only in the local intercept log; the user sees today's calm reason text.

**Tri-Polar passthrough (supports SPEC R7)**
- **D-10:** `deriveTurnSignals` threads `fork_declared` and `declared_labels`, so the MCP handler gets them for free through its existing `deriveTurnSignals(ctx)` call. `buildStopGateCard(turn)` uses `declared_labels` as the option labels when `fork_declared` is true, else today's `rawExtractOptionLabels` path. Header text is unchanged.

**Forward-run harness (gray area 4)**
- **D-11:** `scripts/forward-fork-scenarios-359.cjs` (dev-only, not in CI, never imported from `lib/` or `hooks/`; a tripwire leg asserts this). Scenarios live in `tests/fixtures/forward-fork-scenarios-359.json`: at least 10 fork-eliciting and 10 control scenarios, authored text only, each with an authored `poses_fork: true|false` label and, for forks, the expected `fork_labels`. Scenario labels are authored, never Jev (SPEC R9 "judged by the scenario's own authored label").
- **D-12 (invocation shape):** follow the repo's proven headless pattern (`scripts/skillopt-funnel.cjs`, `scripts/huji-run-one.cjs`): `claude -p <scenario> --plugin-dir <tree> --output-format stream-json`, keychain auth (never `--bare`), `--no-session-persistence`, a pinned model id identical for pre and post (never the Fable model), `--max-turns` small, `--max-budget-usd` per run.
  - Hermetic: a fresh temp `MINDRIAN_HOME` and temp `MINDRIAN_ROOMS_HOME` per run, so counters, intercept log and room binding cannot leak between runs.
  - Measurement: a run counts as a card when the stream carries an `AskUserQuestion` tool_use block (fired or denied), and as a declaration when `parseForkDeclaration` accepts the FIRST final assistant text, read before any Stop-hook re-prompt. Forward missed fork = `poses_fork: true` and neither.
  - Pre vs post: "pre" is the tree with R3 to R7 code landed but R8 prose not yet applied; "post" is the same tree after the R8 commit. Only the prose differs, so the delta is attributable to R8.
  - Bound: 20 or more scenarios x 3 runs x 2 arms = 120 or more runs. Default cap: at most USD 0.40 per run, the script refuses to start if the projected ceiling exceeds USD 60, runs are sequential with a resumable results file under the gitignored scratch path, and only counts plus scenario ids are committed.
  - Assumptions the researcher must verify are listed under "Open assumptions" below.

**Prose placement and byte budget (gray area 5)**
- **D-13 (rule text):** one rule, same meaning on every surface: "At a navigator fork, fire the card. If the turn still ends in prose, make the last line `Your call: A | B` (2 to 5 options)." Phrasing per surface is Claude's discretion within D-14's allocation.
- **D-14 (placement and allocation, 400 B total cap, measured against the post-357 files):**
  - `agents/larry-extended.md` "## Decision Gates" section (post-357-10 shrunk text): about 110 B
  - `skills/larry-personality/SKILL.md` item 5 (post-357-10 shrunk line, about :216): about 90 B
  - `scripts/session-start` `NAV_CARD_FIRE_DOCTRINE`: about 110 B
  - `lib/mcp/runtime-instructions.cjs` item 3 (DECISION GATES): net at most 16 B added. The string is 1984 B today against the 2000 B budget and 2048 B hard cap enforced by `lib/mcp/no-instructions.test.cjs`, so the rule must be folded into item 3 with a compensating trim elsewhere in the same string. The frozen BOUNDARIES paragraph is never trimmed.
  - Net bytes are measured per surface with the same measurement commands 357-10 uses (awk span for larry-extended, the item-5 line for SKILL), plus `Buffer.byteLength` for the MCP string and the doctrine string.
- **D-15 (preserved invariants):** the 357 R-B pinned phrases survive (`## Decision Gates`, `no card, no picture (SEED-021)`, `AskUserQuestion`); `## Post-Gate Handoff` and SKILL :244 (Voice Signature residual) are not touched; `tests/test-larry-voice-mark-182.cjs`, `tests/test-205-voice-mark-hybrid.cjs`, `tests/test-larry-handoff-seam.cjs`, `tests/test-gate-native-fire-w1.cjs` stay green; `data/harness-manifest.json` is regenerated.
- **D-16 (R8 is the last change, and revertible alone):** R8 lands as its own commit after R3 to R7 are green, so the R9 falsification branch can revert exactly that commit.
- **D-17 (sequencing):** 359 execution starts only after 357 is complete on disk (corpus, replay harness, labeler, `card_fire_replay` profile, D-06 labels, 357-10 shrink or its recorded skip). If 357-10 skipped the shrink, the 400 B cap is measured against the unshrunk post-357 files.

**Fixtures and dev-time labeling (gray area 6)**
- **D-18 (file and shape):** `tests/fixtures/card-fire-replay/prose-forks-359.json`, with a `meta` block carrying `sanitization_statement` (the 238 and 357 precedent), `source: 'synthetic-359'` on every entry, and the 357 D-02 entry shape plus `prose_fork` and `fork_labels`. Envelopes use direct fields only (357 R-I: synthetic entries are direct-field).
- **D-19 (composition):**
  - At least 15 prose forks: the sanitized intern-w1 two-way phrasings ("research first vs build the plan", "build the plan now vs file evidence first", and the third), 2-way and 3-to-5-way forks, forks phrased as a question and as a recommendation-plus-alternative, and at least 2 yes/no-shaped forks (they exercise the `gate-is-simple-binary` exclusion in R6).
  - At least 15 controls: the six backstop-benign shapes (clarifying-question pair, informational step list, the "NOT options to pick between" disclaimer, a footnote reference list, an Action Footer, a caveat list), rhetorical "X or Y?" questions the same turn answers, and closing yes/no offers. At least 3 controls end with a near-miss declaration (a `Your call:` line with 1 label, with a bracket, or not on the last line), so the replay exercises parser negatives end to end.
- **D-20 (labeling):** hand labels first (`label_origin: 'hand'`), then 357's labeler (`scripts/label-card-fire-replay.cjs`) runs its `is-fork` Noul over the synthetic entries through 357's existing `card_fire_replay` egress profile in `scripts/jev-devtime-client.cjs`. No new EGRESS_PROFILES entry is added (SPEC R1 locks "no new egress profile"). Disagreements go to `359-JEV-LABEL-REPORT.md` for a ruling and are never auto-applied; the 357 D-12 thresholds (>= 0.80 yes, <= 0.20 no, else uncertain) apply. With no key, the labeler degrades to `unlabeled` and exit 0.
  - Note: the orchestrator's brief suggested a 359-owned EGRESS_PROFILES entry. The locked SPEC R1 says reuse 357's profile, and the profile's allowed keys (`output_text` and friends) already cover a prose output, so the SPEC wins. `[navigator-review]` only if a key outside that profile turns out to be needed.
- **D-21 (dogfood):** 357 dogfood entries get `prose_fork` proposed locally (`label_origin: local`) in one review sheet, `359-DOGFOOD-FORK-LABELS.md`, flipped to `human` at a single navigator checkpoint. Dogfood text never goes to Jev (the 357 labeler refusal stays green).
- **D-22 (baselines):** the pre-359 `missed_forks` value goes into a 359-owned sibling, `tests/fixtures/card-fire-replay/baseline-359.json`, written with `replay-card-fire.cjs --code-root` against the pre-359 commit. 357's `baseline.json` is not edited (single owner). The R5 inertness compare still runs against 357's `baseline.json`.

**Standing gate (supports SPEC R10)**
- **D-23:** `tests/run-all-359.sh` runs the parser tests, the R4 legs, the loader test, the R5 inertness replay, the R6 declared-variant replay, the regex byte-identity tripwire and the dev-script-not-imported tripwire. The 359 replay leg is also appended to the card-fire suite runner 357 R-J wired (`run-all-238.sh`). The two mutation legs (declared arm removed; a free-text fork regex added that flips a control) run as a `--mutation` mode of the 359 test, following 357-09's mutation-leg pattern.

### Claude's Discretion
- Exact per-surface wording of the rule within D-14's byte allocation.
- Fixture ids and the internal layout of the forward-run script and its results file.
- Whether the replay reports per-entry parser diagnostics.
- Test file split, as long as D-23's standing gate exists.

### Deferred Ideas (OUT OF SCOPE)
- **Desktop/Cowork chat-only-turn residual:** hookless Larry skips `stop_gate_check` on chat-only turns, so a prose fork there stays uncaught even with a declaration. A future phase could make hookless Larry call `stop_gate_check` whenever his last line is a declaration.
- **Any free-text fork detector** (regex, token overlap, classifier): permanently out, tripwired by R5/R10.
- **Hidden declaration:** revisit only if Claude Code ever hides HTML comments or offers a hidden-metadata channel on all three surfaces.
- **Voice-glyph-as-declaration:** out (Part 12).
- **Room-bind picker on harness turns:** Phase 360.
- **intent-classifier unrelated F.1 mints:** upstream cause, its own phase.
- **If R9 falsifies the declaration approach:** the follow-on phase is opened by the R9 falsification branch.
- Reviewed todos (8 keyword-only matches) are unrelated and out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQUIREMENTS.md rows exist for 359 yet. Proposed family `FORK359` (same shape as `GATE357`, registered at plan time):

| ID | Description (SPEC) | Research Support |
|----|--------------------|------------------|
| FORK359-01 | R1: `prose_fork` / `fork_labels` label dimension; `prose-forks-359.json` with >= 15 forks + >= 15 controls; labeled through 357's labeler | Finding 6 (357 loader and labeler source lists are frozen and must be extended additively); Pitfall 3 |
| FORK359-02 | R2: replay reports `missed_forks`; pre-359 value recorded in `baseline-359.json` | Finding 6 (357 already emits a DIFFERENT `counts.missed_forks`; use a `fork359` sub-object); Pattern 4 (`--code-root git:<sha>`) |
| FORK359-03 | R3: `lib/core/fork-declaration.cjs::parseForkDeclaration`, strict last-line grammar | Finding 3 (A8 layering), Finding 4 (A5 collision count = 0), Code Example 1 |
| FORK359-04 | R4: declared arm in `classifyCardFire`, `deriveTurnSignals` threading, retry key with labels | Finding 1 (exact insertion points), Finding 2 (A7 normalizer), Pitfall 1 (stale declaration), Code Example 2 |
| FORK359-05 | R5: 0 verdict-class diffs on the 357 corpus; regex byte-identity and classifier-reads-text tripwires | Finding 1 (structural inertness), Pattern 3 (tripwire recipe) |
| FORK359-06 | R6: declared variants, `declared_catch_rate` = 100% (yes/no excluded), `control_false_blocks` = 0 | Pattern 2 (variant derivation), Pitfall 5 (yes/no prefix quirk) |
| FORK359-07 | R7: CLI/MCP parity; MCP payload options equal `declared_labels` | Finding 5 (MCP dedup subject bug for declared turns) |
| FORK359-08 | R8: <= 400 B prose across 4 surfaces; pins survive; manifest regenerated | Finding 7 (A6: `test-251` 900 B doctrine pin, MCP 16 B headroom, measured feasibility) |
| FORK359-09 | R9: forward pre/post run, >= 50% cut in missed forks, 0 control blocks, or recorded falsification | Findings 8-11 (A1-A4, A9), Pattern 5, Pitfalls 6-9 |
| FORK359-10 | R10: standing gate in `run-all-359.sh` + `run-all-238.sh`; 2 mutation legs fail the suite | Pattern 3 (357-09 mutation recipe applied to 359) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Canon Part 8:** declared labels are read locally by the hook and never cross to Brain or Jev. Only authored synthetic fixtures (R1) and authored scenarios (R9) may go to the dev-time labeler, through 357's `card_fire_replay` profile. Dogfood text never goes to Jev.
- **Tri-Polar:** every change is evaluated on CLI, Desktop and Cowork. Here the MCP `stop_gate_check` must reach verdict parity (R7); the hookless chat-only residual is recorded, not fixed.
- **Canon Part 11 R15/R16:** a genuine fork still gets a card; PRIMARY and BACKSTOP behavior is unchanged.
- **Canon Part 12:** each Larry turn keeps exactly one voice mark; the declaration line carries no De Stijl glyph.
- **Part 7 Reuse Before Build:** reuse `deriveTurnSignals`, `isYesNoShapedGate`, `turnContextHash`, 357's replay/labeler/corpus, the 357-09 mutation recipe, and the existing `@modelcontextprotocol/sdk` (for any probe server). No new package.
- **No em-dashes** in any file the phase writes (hyphens only). Also no en-dashes (the `check-voice-style` observer logs both).
- **GSD owns dev work;** `.planning/` phase files are force-tracked (`git add -f`); explicit-path commits only (`git commit --only -- <paths>`); never revert unowned diffs (parallel sessions active).
- **Dev-Research Compositing:** this phase changes MindrianOS's own gate architecture, so the reasoning trail is filed in both `.planning/` and `~/MindrianRooms/rethinking-mindrianos/research/<dated>/` (mirrored to `~/MindrianOS/research/`), cross-linked. 357-10 Task 2 is the precedent; plan a close-out task for it.
- **Verification:** Claude runs `bash tests/run-all-<phase>.sh` and the relevant gates (`node scripts/build-harness-manifest.cjs --check`) before declaring done.
- **Model rule (user memory):** never the Fable model; pin Sonnet 5 (`claude-sonnet-5`) or a navigator-named model for R9.

## Summary

The code side of this phase is small and well-seamed. `classifyCardFire` (`scripts/check-card-fire.cjs:523`) has one early-return (`no-gate-signal`, :545-548) that every non-gate turn takes; adding `&& !forkDeclared` there and a self-contained declared block right after it (before the `backstop-uncorroborated-by-side-channel` branch at :583-590) leaves every non-declared turn on byte-identical code. That makes R5's "0 verdict changes on the 357 corpus" structural, not tuned: a local count-only scan found 0 of 6930 assistant messages in 30 days of transcripts (and 0 of 117 in the 357 snapshot) whose last line is `Your call: ...` with ` | `. `deriveTurnSignals` (:1482) is the single seam both surfaces share, `turnContextHash` (:444) can take a `decl:` suffix only for declared turns, and `isYesNoShapedGate` (`lib/core/gate-relevance.cjs:238`) expects labels normalized by the inline `toLowerCase().replace(/[^a-z0-9]+/g, '')` used in `extractOptionLabels` (:209) and the unexported `normalizeAnswer` (:137). `lib/core` already imports `lib/hmi` in 9 files, including `lib/core/voice-transition-detector.cjs:22-25`, which imports `voice-color-mark.cjs` itself. So `MARK_GLYPHS` should be imported, not copied.

Four problems in the locked plan would break tests or produce wrong numbers if they are not planned for. (1) **Byte pins:** `tests/test-251-skeleton-split.cjs:92` caps `NAV_CARD_FIRE_DOCTRINE` below 900 B (raw source, measured 874 B), so D-14's ~110 B doctrine allocation fails that test unless a matching trim ships with it (a trim of the historic "only the imperative below moved here" sentence was measured to fit: 880 B). The MCP string has 16 B of headroom, and a 5-trim candidate still measured 2004 B, so R8's MCP edit needs real wordsmithing. (2) **357 collisions:** 357-02 already defines `counts.missed_forks` with a different meaning; 357-01 freezes `SOURCES`/`SOURCE_FILES` and 357-04 freezes `LABELABLE_SOURCES`, so `source: 'synthetic-359'` is rejected until those are extended, and adding the file to the default load would break 357's own L7 bar. (3) **MCP dedup:** `stop-gate-handler.cjs:521-526` keys gate-dedup on `turn.gate_signature`, which is `''` for a pure-prose declared turn, so after the first declared fork in a daemon session every later declared fork is suppressed as `dedup-already-fired-this-session`. (4) **Stale declaration:** `turn-text.cjs` never resets `lastAssistantText` at a user boundary, and the official hooks doc says the transcript may lag the final message. An `output_text`-sourced parse can therefore re-read the previous turn's declaration and block a turn that posed no fork.

The forward run (R9) is the risky part. The official hooks reference (`hooks.md`, "allow-with-updatedinput" and "defer" sections) says a `claude -p` run **offers `AskUserQuestion` only when the run has a permission host**, such as an MCP tool passed with `--permission-prompt-tool`. D-12's plain `claude -p` invocation therefore gives Larry no card tool at all, and "card fired" becomes unmeasurable. `--permission-prompts none` removes the tool explicitly. On top of that, a fresh session with no room gets the session-start MODE_ROUTING block ("Fire the AskUserQuestion card with the three modes", `scripts/session-start` ~:750-760). That confounds turn-1 card counts, and single-turn scenarios measure turn 1, where card discipline is best (intern-w1 decayed on turns 2+). Without a pre-count floor, the <= 50% bar can pass vacuously.

**Primary recommendation:** Build R3-R7 exactly as D-04..D-10 lock them, with four additions. Source the declaration from `last_assistant_message`, or from the current-turn window, instead of the stale `output_text`. Key MCP dedup on the declared identity. Put all 359 metrics under a `fork359` sub-object behind an opt-in `synthetic-359` source. Ship a compensating doctrine trim with the R8 rule. Run R9 as a multi-turn `--input-format stream-json` session per scenario, with a dev-only MCP permission-probe tool (so `AskUserQuestion` is offered and every attempt is recorded), `--include-hook-events` (to split the first attempt from the Stop re-prompt), a scratch room (to suppress MODE_ROUTING), and a non-vacuity floor on the pre count. Gate the batch behind one navigator-approved smoke run per arm.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Declaration grammar (`parseForkDeclaration`) | Shared core (`lib/core`, pure CJS) | - | One grammar, called by both enforcement paths; no fs/network/clock |
| Declared-arm verdict | Stop-hook predicate (`scripts/check-card-fire.cjs`) | MCP handler (wraps it) | `classifyCardFire` is the single deterministic authority; MCP wraps, never re-derives (Part 7) |
| Declaration source text (which message is parsed) | Stop-hook signal derivation (`deriveTurnSignals`) | Transcript reader (`lib/hmi/turn-text.cjs`, read-only use) | The Stop stdin `last_assistant_message` and current-turn window live here |
| Retry/session counters with decl identity | Stop-hook side file (`~/.mindrian/card-fire-retries.json`) | MCP handler (same accessors) | One shared budget across surfaces (existing export contract) |
| Card payload from declared labels | MCP handler (`buildStopGateCard`) | `gate-render.cjs` ladder | Desktop/Cowork render path |
| Declaration rule (prose) | Larry agent + SKILL + session-start doctrine + MCP instructions | - | Model-side behavior; four surfaces, byte-budgeted |
| Replay metrics (`fork359.*`) | Dev-time script (`scripts/replay-card-fire.cjs` extension) | 357 corpus loader | Deterministic, zero network, never a hook |
| Forward adoption measurement | Dev-time script (`scripts/forward-fork-scenarios-359.cjs`) + dev-only probe MCP server | Headless Claude Code | Paid, nondeterministic, navigator-gated, never CI, never `lib/`/`hooks/` |

## Standard Stack

### Core (all in-repo, no installs)
| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| Node.js built-ins | v22.23.1 (verified `node --version`) | Parser, classifier, tests | CJS-only house rule |
| `scripts/check-card-fire.cjs` | HEAD 30d562a3 | Classifier + signals + retry key | The one predicate (Part 7) |
| `lib/core/gate-relevance.cjs` | HEAD | `isYesNoShapedGate`, normalizer | Reused per SPEC R4 |
| `lib/hmi/voice-color-mark.cjs` | HEAD | `MARK_GLYPHS` (frozen, 5 members) | Single glyph source; import precedent exists |
| `lib/hmi/turn-text.cjs` | HEAD | `extractAssistantText`, `assistant_contents` window | THE one transcript reader |
| `lib/mcp/stop-gate-handler.cjs` | HEAD | MCP surface | Wraps the predicate |
| 357 artifacts (`scripts/replay-card-fire.cjs`, `scripts/card-fire-replay-corpus.cjs`, `scripts/label-card-fire-replay.cjs`, `data/jev-policies/card-fire-replay.json`) | not on disk yet (357 unexecuted, verified `ls`) | Replay, loader, labeler | Locked by D-17/D-20/D-22 |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Claude Code CLI | 2.1.280 (verified `claude --version`) | R9 forward run only | Needs >= 2.1.259 for `--permission-prompts`; >= 2.1.221 for `--mcp-config` wait; `--include-hook-events` present |
| `@modelcontextprotocol/sdk` | 1.29.0 (in `package.json` dependencies, `node_modules` present) | Dev-only permission-probe stdio MCP server for R9 | Only if the probe-host approach is chosen (recommended) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom R9 harness (D-11, locked) | `claude plugin eval` (Claude Code >= 2.1.269; regex + `tool_used` graders, `--runs`, `--max-cost-usd`, throwaway HOME) | Not recommended. It isolates HOME, which ARMS the first-install router (`scripts/first-install-router.cjs:133-143` reads `$HOME/.mindrian/first-install`, and `~/.mindrian-onboarded` is absent there), so turn 1 routes to onboarding. It has no "first attempt before Stop re-prompt" grader. It still has no permission host. `evals/` already exists in the repo. Its isolation model is worth copying. |
| MCP probe via `--permission-prompt-tool` | Agent SDK `canUseTool` (`@anthropic-ai/claude-agent-sdk`) | That is a new package, which violates reuse-first and needs a legitimacy gate. The CLI flag is documented. |
| MCP probe | Harness answers the SDK stdio control protocol (`--permission-prompt-tool stdio`) | [ASSUMED] undocumented protocol; fragile |

**Installation:** none. The phase installs no external package.

## Package Legitimacy Audit

No new external packages are recommended. The only external module touched is `@modelcontextprotocol/sdk` 1.29.0, already a declared runtime dependency (`package.json`) and already installed. Its legitimacy was established when it was adopted, so slopcheck was not run.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none new) | - | - | - | - | not run (nothing to install) | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Key Findings (verified in code and docs this session)

### Finding 1 - Exact classifier seams; inertness is structural (HIGH)
- `classifyCardFire` (`scripts/check-card-fire.cjs:523`): `card-fired` at :531-533; `primaryHit` :536-537; `backstopHit` :543; the single `no-gate-signal` return :545-548; the `backstop-uncorroborated-by-side-channel` branch :583-590; session/retry ceilings :594-611 (reason strings `'session-intercept-ceiling-reached-after-' + MAX_SESSION_INTERCEPTS + '-intercepts'` and `'bounded-escape-released-after-' + MAX_FORCE_RETRIES + '-retries'`); relevance and answered checks :640-717; `gate-is-simple-binary` :740-742; final intercept :744-747.
- Inserting `forkDeclared` into the :545 condition, plus one block between :548 and :583, changes nothing for a turn where `fork_declared !== true`. That turn reaches the same statements in the same order. This is the D-06 step 5 guarantee.
- `main()` (:1669-1750) computes `ctxHash = turnContextHash(turn)` BEFORE classification. The decl suffix therefore has to be in `turnContextHash` itself (D-08), and it covers the MCP path too via `_safeCtxHash`.
- `appendInterceptLog` (:1279) records `reason`, so the `declared-fork-no-card` slug reaches the local log with no change. `buildEnforcementEnvelope` (:788) stays untouched (D-09).
- `MAX_FORCE_RETRIES = 3;` and `MAX_SESSION_INTERCEPTS = 12;` are source-pinned by `tests/test-198-stop-gate-retry-ceiling.test.cjs:384-397` and `tests/test-209-primary-sidechannel.cjs:1266-1274`. The declared arm must reuse the constants and never re-declare them (the MCP handler is also barred from re-declaring them).

### Finding 2 - A7: the normalizer `isYesNoShapedGate` expects (HIGH)
- `isYesNoShapedGate(gateLabels)` (`gate-relevance.cjs:238-250`) filters to non-empty strings, requires exactly 2, and tests `indexOf('yes') === 0` and `indexOf('no') === 0`. Its input is `extractOptionLabels` output, normalized at `gate-relevance.cjs:209` as `mm[1].toLowerCase().replace(/[^a-z0-9]+/g, '')`. The identical function `normalizeAnswer` (:137-140) exists but is NOT exported.
- Recommendation: export `normalizeAnswer` additively (for example as `normalizeOptionLabel`) and do not refactor `extractOptionLabels`. `gateSignature` depends on its byte-equivalence (the comment at :420-426). The caller maps `declared_labels` through it before `isYesNoShapedGate`.
- Consequences to document and fixture:
  - Non-ASCII labels (for example Hebrew) normalize to `''`, get filtered out, and return `false`, so a Hebrew yes/no pair is NOT exempt. This fails toward the card, the safe direction.
  - The prefix test is loose. `Yesterday's draft | Now` normalizes to `yesterdaysdraft` / `now` and IS treated as simple-binary (a miss). Record it as a known limitation with a fixture, not a fix, because SPEC R4 locks reuse of `isYesNoShapedGate`.
  - The D-08 retry key must NOT use this ASCII-stripping normalizer. Hebrew labels would collapse to `''` and distinct forks would share a counter. Use `label.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()` for the key.

### Finding 3 - A8: `lib/core` -> `lib/hmi` imports are established (HIGH)
- 9 `lib/core` files already require `lib/hmi`: `research-filing-selector.cjs:39`, `lens-engine.cjs:50`, `room-chooser.cjs:60,200`, `intel-pipeline.cjs:64`, `nav-dial.cjs:287`, `navigation-engine.cjs:1920`, `navigation-engine-offer.cjs:651`, `room-naming-selector.cjs:100`, and `voice-transition-detector.cjs:22-25`. The last one guard-requires `../hmi/voice-color-mark.cjs` directly. No test or tripwire forbids the direction (a grep for layering rules found none).
- `voice-color-mark.cjs` requires `node:fs`/`node:path` but does no I/O at load (`PALETTE_PATH` is a constant; `paletteAnchorOk` is only a function), so the "pure, no fs" parser contract holds at call time.
- Recommendation: import `MARK_GLYPHS` with the `voice-transition-detector.cjs` guarded-require pattern. If the require fails, `parseForkDeclaration` returns `{declared: false}` for every input (fail INERT, which is today's behavior). No local copy is kept, so no drift test is needed.
- The `[`/`]` rejection also protects `detectVoiceMark`'s SECONDARY path (`TAG_RE`, `[red]`-style color tags, `voice-color-mark.cjs:217`).

### Finding 4 - A5: prefix collision count is 0 (HIGH, count-only, no text printed)
A local scan (scratchpad script, prints numbers only) found:
- `~/.cache/mindrian-dev/357-raw/` (4 sessions + intercept log): 117 assistant text messages. 0 last lines start with `Your call: `, 0 with ` | `. 14 intercept records, 0 matches.
- All 124 local transcripts (30-day window): 6930 assistant text messages. 1 last line starts with `Your call: ` but has NO ` | ` (the grammar rejects it, because it has 1 label). 8 last lines contain ` | ` (tables), none with the prefix. 0 accepted declarations.
- The repo contains no `Your call` string today (grep over agents, skills, commands, lib, scripts, references, data, hooks), so the D-05 drift test cannot pass vacuously.
- Implication: Larry naturally ends with "Your call: X" occasionally. A single-label or `or`-joined line is a parser negative, so it causes a miss, never a false block.

### Finding 5 - MCP dedup suppresses every declared fork after the first (HIGH)
- `handleStopEvent` builds `gateContext = {gate: 'stop', sid, subject: turn.gate_signature || '', material}` (`lib/mcp/stop-gate-handler.cjs:521-526`). `gate-dedup.cjs:67-83` hashes `sid|gate|subject`.
- A pure-prose declared turn has no glyph and no `[n]` labels, so `gateSignature` returns `''` (`check-card-fire.cjs:437`). Every declared fork in one daemon session then shares a dedup key: the first fires, and all later ones return `dedup-already-fired-this-session`.
- 357 R5 parity excludes dedup, and the replay resets per entry (`_resetForTest`), so neither the R5 nor the R6 replay would ever see this.
- Fix: export a helper from `check-card-fire.cjs` (for example `declaredIdentity(turn)`, returning `'decl:' + sorted NFKC-normalized labels`, or `''`). Use it in `turnContextHash` (D-08) and as the dedup subject fallback (`turn.gate_signature || declaredIdentity(turn)`). Add a leg: two distinct declared forks in one MCP session both return `fire: true`.
- D-10's `buildStopGateCard` change is straightforward. The `gate_render` `normalizeCard` (`lib/mcp/gate-render.cjs:150-190`) has no option-count cap.
- Caveat: Claude Code's `AskUserQuestion` supports 2-4 options per question (Agent SDK user-input doc, "Limitations"), while the grammar allows 5 labels. On the CLI re-prompt, a 5-label fork cannot map 1:1 to a card. Record this as a residual. The MCP `gate_render` path has no such cap.

### Finding 6 - 357 contracts 359 must extend, not break (HIGH, from 357 PLAN files)
- `counts.missed_forks` already exists in 357-02 (Task 1 step 10: `missed_forks` = MISSED_FORK outcomes, meaning expected block, class pass, not in baseline, no `known_miss`). SPEC R2's `missed_forks` means something else (prose_fork:true, no card, pass). Report all 359 metrics under `counts.fork359 = {missed_forks, declared_variants, declared_catch_rate, simple_binary_excluded, controls, control_false_blocks}` so 357's tests keep their meaning.
- 357-01 freezes `SOURCES = ['238','debug','live','dogfood']` and `SOURCE_FILES`, and `validateEntry` rejects any other `source`. 359 must add `'synthetic-359'` -> `prose-forks-359.json` as an OPT-IN source that `loadCorpus({})` does NOT load by default. If it were default-loaded, 357 L7 would fail ("the baseline covers every corpus id", `unmarked_misses === 0`, 357-02 Task 2).
- `validateEntry` direct mode requires `sidechannel_health` (string) and `reach_corroborated` (boolean) and forbids `gate_is_fresh`. Every 359 entry needs both. Use `sidechannel_health: 'healthy', reach_corroborated: false, ran_entries: []` so PRIMARY and BACKSTOP cannot interfere (a footnote control is suppressed by the 238-08 branch), and set an explicit `ran_entries: []` so the real side channel is never read.
- 357-04 freezes `LABELABLE_SOURCES = ['238','debug','live']`, so it must be extended with `'synthetic-359'`. `assertLabelable` still refuses dogfood first, which keeps SPEC R1's "labeler refuses dogfood" green.
- Raw prose-fork entries (no declaration) should be labeled `expected_verdict_class: 'block'` with `known_miss: {reason: 'undeclared prose fork (359 R2)'}`, so 357's taxonomy reports KNOWN_MISS and never MISSED_FORK. Controls are `pass`.
- `--code-root` accepts `pre-phase` (357's sha) or a directory. R2 needs the pre-359 sha, so add a generic `git:<sha>` form (git archive plus node_modules symlink, as 357-02 step 2 does).

### Finding 7 - A6: byte pins on the four prose surfaces (HIGH, measured)
| Surface | Pin | Today | Headroom | Consequence |
|---------|-----|-------|----------|-------------|
| `scripts/session-start` `NAV_CARD_FIRE_DOCTRINE` (:1794) | `tests/test-251-skeleton-split.cjs:77-95`: raw source capture (escaped `\n` = 2 bytes) `< 900`; must contain `[FIRE-IF-FORK`, `AskUserQuestion`, `SEED-021`, `NAV DECISION unchanged`, `verb_count`; `${NAV_CARD_FIRE_DOCTRINE}` appended | 874 B raw (864 expanded) | 25 B | D-14's ~110 B fails the test unless the same edit trims. Measured: removing ` That marker is the per-turn gate flag; only the imperative below moved here.` (77 B, historic narration) and adding an 83 B rule sentence gives 880 B < 900. |
| `lib/mcp/runtime-instructions.cjs` `RUNTIME_INSTRUCTIONS` | `lib/mcp/no-instructions.test.cjs` (served <= 2000 budget, <= 2048 host cap, byte identity, BOUNDARIES frozen and last); `tests/test-298-contract-parity.cjs` asserts `byte_budget.limit === 2000`; contract-parity phrases pin the BOUNDARIES and THEO paragraphs | 1984 B | 16 B | A 44 B item-3 rule plus 4 micro-trims (items 1, 2, 5, 6) measured 2004 B, still 4 B over. One more trim, or a shorter rule, is required. Raising the budget is a 3-file coordinated change (test constant, policy limit, test-298 assertion). Do not raise it. Items 1-6 are unpinned. |
| `agents/larry-extended.md` "## Decision Gates" | `test-gate-native-fire-w1.cjs:112-121` (`## Decision Gates`, `AskUserQuestion`, `no card, no picture (SEED-021)`; `End with a question or next step[\s\S]{0,120}AskUserQuestion card`); contract-parity phrases; harness-manifest digest | 1751 B pre-357 (357-10 target: combined <= 1115 with SKILL) | D-14 ~110 B | Do not insert the rule between "End with a question or next step" and "AskUserQuestion card" (120-char window). Regenerate the manifest. |
| `skills/larry-personality/SKILL.md` item 5 (:216) | 357-10 measures `grep '^5\. Never hand-draw the dial glyphs'`; the line must stay one line with that prefix; `:244` untouched (`test-larry-voice-mark-182.cjs:286-289`) | 479 B pre-357 | D-14 ~90 B | Keep a single line. |
- `data/harness-manifest.json` digests both Larry files AND `lib/mcp/runtime-instructions.cjs` (entry at :66), so any R8 edit requires `node scripts/build-harness-manifest.cjs` then `--check`.
- The 400 B cap in SPEC R8 is ambiguous (gross added vs net). Recommend NET `Buffer.byteLength` delta per surface, summed, with each surface's before/after recorded. Trims count against additions.
- `tests/test-298-contract-parity.cjs` tampers tracked files and requires a clean `git status`. Run it only when no peer diff exists on Larry surfaces (357 Pitfall 9).
- `scripts/check-voice-style.cjs` (a Stop hook, log-only) flags em/en dashes and a missing lead glyph. The declaration adds neither, so there is no conflict.

### Finding 8 - A1: `AskUserQuestion` under `claude -p` needs a permission host (HIGH, official docs)
- `code.claude.com/docs/en/hooks.md` (allow-with-updatedInput section): "In non-interactive mode with the `-p` flag, Claude Code offers `AskUserQuestion` and `ExitPlanMode` only when the run has a permission host to receive the prompt, such as an Agent SDK `canUseTool` callback." The "defer" section repeats it: "A `-p` run offers `AskUserQuestion` only when it has a permission host, such as an MCP tool you pass with `--permission-prompt-tool`."
- `headless.md`: with `--permission-prompts none`, "Claude Code removes the tools that need an answer from a person, such as `AskUserQuestion`". In `dontAsk` mode, `AskUserQuestion` "is denied even when an allow rule matches" (so it is offered when a host exists, then denied at call time).
- Consequence: D-12's plain invocation (no host) gives Larry no card tool, so "card fired" can never be observed and Larry's behavior is not the production CLI behavior. With a host, an attempted call appears as an assistant `tool_use` block named `AskUserQuestion` in `stream-json`, followed by a tool_result (denied or answered). Denials also appear as `permission_denied` system messages and in the result's `permission_denials` (headless.md).
- Recommendation: a dev-only stdio MCP server (for example `scripts/fork359-permission-probe.cjs`, built on the installed `@modelcontextprotocol/sdk`) with one tool, passed as `--mcp-config <json> --permission-prompt-tool mcp__fork359probe__permission`.
  - It returns deny for every request. For `AskUserQuestion` the deny message is neutral ("No one can answer in this run; continue.").
  - It appends each `AskUserQuestion` input to the per-run temp dir, which gives a second measurement channel independent of stream parsing.
  - The prompt-tool I/O contract (input `{tool_name, input, tool_use_id}`; output text JSON `{"behavior":"allow","updatedInput":...}` or `{"behavior":"deny","message":...}`) is only community-documented (GitHub issue #1175). Verify it in the smoke run.
- Also confirm in the smoke run that the `system/init` event's `tools` array contains `AskUserQuestion`.

### Finding 9 - A2: plugin Stop hooks do run under `-p`; how to read the first attempt (MEDIUM-HIGH)
- headless.md: "Without `--bare`, `claude -p` loads the same context an interactive session would, including anything configured in the working directory or `~/.claude`". `--plugin-dir` loads the plugin "for this session only", and plugin hooks merge with user and project hooks when the plugin is enabled (plugins docs). The repo's `tests/test-114-turn-1-voice.sh:45-47` relies on the same path.
- The Stop input carries `last_assistant_message` ("the text content of Claude's final response"). hooks.md warns that `transcript_path` "may not yet include the current turn's most recent messages when a hook fires. Hooks that need the final assistant text of the current turn should use `last_assistant_message`". Claude Code ends the turn after 8 consecutive Stop blocks.
- `--include-hook-events` (cli-reference) adds hook lifecycle events to `stream-json`. SessionStart events are always included. With this flag, the first Stop `hook_started`/`hook_response` event splits attempt 1 from any re-prompt. Define attempt 1 as the assistant events before the first Stop hook event. Card = any `AskUserQuestion` tool_use in that span. Declaration = `parseForkDeclaration` over the last text in that span. `stream-json` in `-p` also needs `--verbose` (the docs example uses it).
- With `--no-session-persistence` (D-12), the transcript may not exist on disk. `check-card-fire` then derives `output_text = ''` from the transcript, but the PRIMARY arm can still intercept from the side channel. The measurement must therefore split attempts and must not assume "no re-prompt". Pairing that with sourcing the declaration from `last_assistant_message` (Pitfall 1) makes the declared arm work even when no transcript exists.

### Finding 10 - A3: loading Larry headless (MEDIUM-HIGH)
- Plugin `settings.json` supports only the `agent` and `subagentStatusLine` keys (plugins-reference). The plugin sets `"agent": "larry-extended"`. The user's `~/.claude/settings.json` ALSO sets `agent: larry-extended`, has SessionStart/PreToolUse/PostToolUse hooks, and 16 enabled plugins (including `mos@mindrian-marketplace`).
- A `--plugin-dir` plugin with the same name as an installed marketplace plugin takes precedence for that session (plugins.md).
- Subagent name priority puts `~/.claude/agents/` (4) ABOVE plugin agents (5) (sub-agents.md). `~/.claude/agents/larry-extended.md` is a symlink to `~/.claude/plugins/mindrian-os/agents/larry-extended.md`, which is currently DANGLING (verified `test -e`), so it does not shadow today. If it is ever repaired, it would silently replace the R8-edited agent.
- Recommendation: pass `--agent mos:larry-extended` (scoped name, overrides the setting) in both arms. Add a harness preflight that refuses to run if `~/.claude/agents/larry-extended.md` resolves to a file.
- Pass `--setting-sources project,local` to drop user hooks, the user `agent` key and the 15 unrelated user plugins. The effect on `--plugin-dir` is [ASSUMED] to be none; verify with `system/init.plugins` in the smoke run (it must list exactly one `mos`, whose path is the snapshot).
- The frontmatter preloads 4 skills (`larry-personality`, `context-engine`, `room-passive`, `room-proactive`). `initialPrompt` is "Ignored for plugin subagents" (sub-agents.md). If it is applied to the main session, it is prepended identically in both arms.
- The plugin's SessionStart matchers are `startup|clear|compact` (`hooks/hooks.json`), so a fresh `-p` session injects the doctrine. A `--resume`d history does NOT, which is one reason not to build scenarios from `--resume`.

### Finding 11 - A4: turn-1 card confound is session-start MODE_ROUTING, not the F.8 picker (HIGH)
- F.8 room-picker: `scripts/intent-classifier.cjs:547` returns 0 when the room corpus is empty (and :485 when no rooms root exists). The binding gate at :691 needs a scored `best` room, so an empty temp `MINDRIAN_ROOMS_HOME` never mints F.8. The zero-score `emitNoMatchGate` path fires only for a session with a real bound primary (:612-623).
- BUT with no room resolved, `scripts/session-start` takes the cold-start branch (:622 onward) and injects `[MindrianOS Mode Routing] No room detected. Fire the AskUserQuestion card with the three modes below as options; default to Just Talk if the navigator starts talking...` (~:750-760). That is a legitimate turn-1 card that would count as "card fired" on a fork scenario.
- Mitigation:
  - Give each run a scratch room. `scripts/resolve-room` Strategy 0b resolves `$MINDRIAN_ROOMS_HOME/<basename of WORK_DIR>`, so run with cwd `<tmp>/scratch-359` and `<tmp>/rooms/scratch-359/ROOM.md` present.
  - Make the fork the LAST turn of a short multi-turn session.
  - Record every `AskUserQuestion` option set, and report cards whose options equal the MODE_MENU labels separately (a deterministic string match at dev time).
  - Preflight: assert that the SessionStart `hook_response` output does not contain `No room detected`.

### Finding 12 - A9: cost and time estimate (ESTIMATE; basis stated, no paid run made)
Basis:
- Sonnet 5 list price is $2/MTok input, $2.50/MTok 5-min cache write, $0.20/MTok cache hit, $10/MTok output. Opus 5.5 is $4 / $5 / $0.20 / $20 (platform.claude.com pricing). Models from Claude 4.7 on use a tokenizer that produces about 30% more tokens for the same text.
- Larry static text is 20,168 B (agent) + 64,532 B (`larry-personality`) = 84.7 KB, which matches the brief's "~85 KB". It rises to 127,241 B if all 4 preloaded skills (context-engine 9,630 + room-passive 9,461 + room-proactive 23,450) load into the main session. At about 3.1 chars per token, that is roughly 27-41k tokens.
- Claude Code's own system prompt and tool schemas, the 26+ plugin MCP tool schemas (2 `alwaysLoad` servers in `.mcp.json`) and the session-start context are NOT measured. [ASSUMED] they add 15-35k tokens. Estimated input per model call is about 50-85k tokens.
- Per run: 1 call per warm-up turn plus 1-2 calls on the fork turn (card denial round trip), with 1-3 more if the Stop hook re-prompts.

| Case | Estimate |
|------|----------|
| Single-turn run, Sonnet 5, no cross-run cache | first call cache write ~70k x $2.50/MTok = $0.175, + ~1 cached follow-up ~$0.03 => ~$0.20/run |
| 3-turn run (recommended), Sonnet 5 | $0.175 + ~4 cached calls x ~$0.03 => ~$0.30/run; 120 runs => ~$36 |
| Same, if sequential runs hit the prompt cache (identical prefix within 5 min) | ~$0.12/run => ~$15 total |
| 3-turn run, Opus 5.5 | ~$0.45-0.55/run => ~$55-66 total, which breaches D-12's $0.40/run and $60 caps |
| Wall time | [ASSUMED] 30-90 s per run (SessionStart hooks have 5-120 s timeouts, but they are no-ops on a healthy box; 5-20 s per model call) => 1-3 h for 120 sequential runs |

- D-12's caps fit Sonnet 5 but not Opus 5.5 with multi-turn runs. The smoke run must read `total_cost_usd` and `duration_ms` from the `result` event, and the script should extrapolate and refuse to start if projected spend exceeds the $60 cap.
- A run that hits `--max-budget-usd` stops mid-turn. Count it as an ERROR and re-run it once; never count it as a miss.

## Architecture Patterns

### System Architecture Diagram

```
 RUNTIME (per Stop event)                                   DEV-TIME ONLY
 ------------------------                                   -------------
 CLI Stop stdin {transcript_path, last_assistant_message}   prose-forks-359.json (authored)
   |                                                           | loader (opt-in source synthetic-359)
 MCP stop_gate_check {output_text,...}                         v
   |                                                        replay-card-fire.cjs --fork359
   v                                                           | raw entries    -> fork359.missed_forks
 deriveTurnSignals(env)                                        | + decl variant -> declared_catch_rate
   |-- existing: ran_entries, output_text, gate_signature...   | controls       -> control_false_blocks
   |-- NEW: declSource = last_assistant_message                | --code-root git:<pre-359> -> baseline-359.json
   |        | direct output_text | current-window last text   | 357 corpus --baseline compare -> R5 inertness
   |   parseForkDeclaration(declSource)  [lib/core, pure]      v
   |   -> fork_declared, declared_labels                    label-card-fire-replay.cjs (is-fork Noul, egress
   v                                                          profile card_fire_replay; dogfood refused)
 turnContextHash(turn) (+ '|decl:<labels>' only if declared)
   v                                                        forward-fork-scenarios-359.cjs
 classifyCardFire(turn)                                       git archive pre|post -> tmp plugin tree
   card fired? -> pass                                        per run: tmp HOME dirs, scratch room, probe MCP
   no primary, no backstop, no decl? -> no-gate-signal        claude -p (stream-json in/out, hook events)
   declared? -> ceilings -> yes/no? -> INTERCEPT               split attempt 1 at first Stop hook event
               'declared-fork-no-card'                         card? decl? -> missed / ok ; controls -> blocks
   else -> existing PRIMARY/BACKSTOP path (unchanged)          counts + scenario ids only -> SUMMARY
   v
 CLI: main() bump/clear counters, intercept log, calm envelope
 MCP: dedup(subject = gate_signature || declaredIdentity) -> buildStopGateCard(declared_labels) -> gate_render
```

### Recommended Project Structure
```
lib/core/fork-declaration.cjs            # grammar + parseForkDeclaration (pure)
scripts/check-card-fire.cjs              # + decl threading, declared arm, declaredIdentity, key suffix
lib/core/gate-relevance.cjs              # + export normalizeOptionLabel (alias of normalizeAnswer), additive
lib/mcp/stop-gate-handler.cjs            # + declared labels in buildStopGateCard, dedup subject fallback
scripts/card-fire-replay-corpus.cjs      # (357) + opt-in 'synthetic-359' source
scripts/label-card-fire-replay.cjs       # (357) + 'synthetic-359' in LABELABLE_SOURCES
scripts/replay-card-fire.cjs             # (357) + --fork359 metrics sub-object, --code-root git:<sha>
scripts/forward-fork-scenarios-359.cjs   # dev-only R9 harness
scripts/fork359-permission-probe.cjs     # dev-only stdio MCP permission host (R9)
tests/fixtures/card-fire-replay/prose-forks-359.json
tests/fixtures/card-fire-replay/baseline-359.json
tests/fixtures/forward-fork-scenarios-359.json
tests/test-359-fork-declaration.cjs  test-359-declared-arm.cjs  test-359-corpus.cjs
tests/test-359-replay.cjs (--mutation)  test-359-prose-budget.cjs  test-359-devonly-tripwire.cjs
tests/run-all-359.sh                     # + one run_if leg appended to tests/run-all-238.sh
```

### Pattern 1: Declaration source text (fixes the stale-declaration class)
**What:** the declaration parse reads the FINAL assistant text of THIS turn, never a stale one.
**Precedence:** (1) `e.output_text` / `e.last_assistant_text` when given directly (MCP, unit tests, replay direct mode); (2) `e.last_assistant_message` from the live Stop stdin (the docs-recommended field); (3) the last text among `readTurnText().assistant_contents` (the current window, via the exported `turnText.extractAssistantText`); else `''`.
**Why:** `readTurnText` never resets `lastAssistantText` at a user boundary (`lib/hmi/turn-text.cjs:176, 226`, no reset at :209-221), and the transcript can lag. `output_text` can therefore be the PREVIOUS turn's text. That is harmless for BACKSTOP today, but would re-fire a stale declaration. This source is used ONLY for the declaration parse; `output_text` and every other signal stay as they are (R5).

### Pattern 2: Declared-variant derivation in the replay (R6)
`variant.output_text = entry.envelope.output_text.replace(/\s+$/, '') + '\n' + DECLARATION_PREFIX + entry.fork_labels.join(DECLARATION_SEPARATOR)`. Import the constants from HEAD's `lib/core/fork-declaration.cjs`, even under a pre-359 code root. Expected result: `block` with reason `declared-fork-no-card`, unless `isYesNoShapedGate(labels.map(normalizeOptionLabel))`, in which case `pass` with reason `gate-is-simple-binary` (counted in `simple_binary_excluded`). Controls replay unchanged and expect `pass`. MCP parity: `fire === true` iff the CLI class is block, and `rendered` options equal `fork_labels`.

### Pattern 3: Tripwires and mutation legs (R5, R10), reusing 357-09
- Regex byte identity: read `scripts/check-card-fire.cjs` source and assert that the two exact literal lines (`ASCII_BOX_GLYPH_RE =\n  /.../i;` and `ASCII_BOX_UNCONDITIONAL_RE =\n  /.../i;`, :277-278 and :302-303) are present byte-for-byte, as frozen strings in the test. `ASCII_BOX_UNCONDITIONAL_RE` is not exported; read the source rather than adding an export.
- Classifier-reads-text: `checkCardFire.classifyCardFire.toString()` must contain no regex literal applied with `.test(`/`.match(`/`.exec(`, and no `new RegExp`. `outputText` may appear only as an argument to `computeBackstopHit(`, `gateRelevance.extractOptionLabels(` or the existing `gateSubjectText` fallback. The same kind of scan over `deriveTurnSignals.toString()` allows only `parseForkDeclaration(`.
- Mutations (a `--mutation` mode in `tests/test-359-replay.cjs`): `git archive HEAD` into mkdtemp and symlink node_modules. (M1) Replace the anchor line `const forkDeclared = t.fork_declared === true` with `const forkDeclared = false`; the fork359 replay must exit non-zero (catch rate below 100%). (M2) Inject an anchor-marked free-text rule into the copied `classifyCardFire` (for example, intercept when `/\bor\b[^\n]*\?/.test(outputText)`); the replay must exit non-zero (`control_false_blocks > 0`). Keep the anchor line stable, and name it in a code comment so the mutation cannot silently miss.

### Pattern 4: Pre-359 baseline (R2)
Run `replay-card-fire.cjs --code-root git:<pre-359 sha> --source synthetic-359 --fork359 --baseline write-359`, which writes `baseline-359.json` as `{meta: {pre_phase_sha, written_at, entry_count}, fork359: {missed_forks}, verdicts}`. On pre-359 code, every raw `prose_fork: true` entry passes (no signal), so `missed_forks` must equal the prose-fork count. The harness and loader come from HEAD; only the classifier modules come from the code root (357-02 step 3).

### Pattern 5: R9 forward run (recommended shape)
```
per arm (pre = commit after R7, post = R8 commit):
  tree = git archive <sha> | tar -x (tmp) ; ln -s <repo>/node_modules tree/node_modules
per run (scenario x 3):
  tmp/{home, rooms/scratch-359/ROOM.md, sidechannel.json, probe-log/}; cwd = tmp/scratch-359
  env: MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, CARD_FIRE_SIDECHANNEL_PATH -> tmp; no TYPESAFE_API_KEY
  claude -p --input-format stream-json --output-format stream-json --verbose --include-hook-events
     --plugin-dir <tree> --agent mos:larry-extended --model claude-sonnet-5
     --setting-sources project,local --mcp-config <probe json> --permission-prompt-tool mcp__fork359probe__permission
     --max-turns 4 --max-budget-usd 0.40 --no-session-persistence
  stdin: 2 authored warm-up user turns, then the authored fork (or control) turn
  parse: system/init (assert plugins/tools/agent), last user turn's attempt 1 (split at first Stop hook event)
  record: {scenario_id, arm, run, card: bool, card_is_mode_menu: bool, declared: bool, cost, ms}
```
Counts only plus scenario ids go to the SUMMARY. Raw streams stay in the gitignored scratch path; they hold only authored text, but keep them out of git anyway.

### Anti-Patterns to Avoid
- **Parsing the declaration from `turn.output_text` on the live path:** it can be the previous turn's text (Pattern 1).
- **Adding `synthetic-359` to the default corpus load:** it breaks 357's L7 bar (Finding 6).
- **Reusing `counts.missed_forks`:** it collides with 357's meaning (Finding 6).
- **Accepting a direct `fork_declared` field on the envelope:** it would create a seam where an MCP caller asserts a declaration without text. Always derive it from text (the zod schema of `stop_gate_check` does not carry it anyway).
- **Refactoring the ceiling checks into a shared helper:** D-06 step 5 requires the existing path to be byte-for-byte unchanged. Duplicate the two ceiling checks inside the declared block and add a test asserting identical reason strings across both arms.
- **Adding `hookSpecificOutput` to the Stop envelope:** `scripts/check-hook-schema-compatibility.cjs` greps for it, and D-09 locks the envelope.
- **A 1-turn forward scenario set:** it measures turn 1, where discipline is highest and MODE_ROUTING interferes (Finding 11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Yes/no exemption | A new yes/no detector | `gateRelevance.isYesNoShapedGate` + the exported normalizer | SPEC R4 locks it; one semantic test |
| Voice glyph set | A local copy of 5 code points | `require('../hmi/voice-color-mark.cjs').MARK_GLYPHS` (guarded) | Precedent `voice-transition-detector.cjs:22-25` |
| Transcript final text | A second jsonl walker | Stop stdin `last_assistant_message`, else `turnText.readTurnText().assistant_contents` + `extractAssistantText` | turn-text is THE one reader |
| Counters | New counters for declared turns | Existing `read/bump/clearRetryCount`, `turnContextHash` + suffix | One shared budget across surfaces |
| Replay, loader, labeler, hermetic env, code root | 359 copies | 357's scripts extended additively | D-20/D-22, single owner |
| Mutation harness | A new mutation runner | 357-09's `git archive` + anchor-edit + `--code-root <dir>` | Proven pattern |
| Headless permission host | The Agent SDK package | `--permission-prompt-tool` + a stdio MCP tool on the installed `@modelcontextprotocol/sdk` | Documented flag; no new package |
| Cost accounting | Token math in the script | `result.total_cost_usd` from stream-json | Docs: client-side estimate per run |

**Key insight:** every seam already exists. The risk in this phase lives in the interactions (357 contracts, byte pins, dedup keys, headless tool availability), not in new logic.

## Runtime State Inventory

Not a rename/migration phase, but it touches runtime state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `~/.mindrian/card-fire-retries.json`: declared turns mint new keys (the `decl:` suffix); non-declared keys are byte-identical; TTL 24 h | None (no migration; TTL prunes) |
| Stored data | `~/.mindrian/card-fire-intercepts.log`: a new reason slug `declared-fork-no-card`; no consumer enumerates slugs (grep of `lib/`, `scripts/`; `run-harness.cjs` and `card-fire-health-module.cjs` read the log generically) | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | `~/.secrets/typesafe.env` (present, not read here) for the R1 labeler; the R9 harness must strip `TYPESAFE_API_KEY` from the child env | Code only |
| Build artifacts | `data/harness-manifest.json` digests of `agents/larry-extended.md`, `skills/larry-personality/SKILL.md`, `lib/mcp/runtime-instructions.cjs` | Regenerate after R8 (`node scripts/build-harness-manifest.cjs`, then `--check`) |
| User-level config (R9 only) | `~/.claude/agents/larry-extended.md` is a dangling symlink; `~/.claude/settings.json` has `agent: larry-extended`, user hooks and 16 plugins | Harness preflight and `--setting-sources`; never edit user config (out of scope) |

## Common Pitfalls

### Pitfall 1: Stale declaration re-fires on a later turn
**What goes wrong:** turn N ends with `Your call: A | B` and the card fires on the re-prompt. On turn N+1 the transcript has not flushed the new final message (or turn N+1 has no text), so `output_text` is still turn N's text, and the declared arm blocks a turn that posed no fork.
**Why:** `turn-text.cjs` keeps `lastAssistantText` across user boundaries, and hooks.md says the transcript may lag.
**How to avoid:** Pattern 1 (parse `last_assistant_message`, else the current-window text). Add an R4 leg: a transcript whose ONLY declaration sits before the last user record must give `fork_declared: false`.
**Warning signs:** `declared-fork-no-card` log entries whose `output_text` starts with a previous-turn glyph and text.

### Pitfall 2: The doctrine byte pin fails silently in someone else's suite
**What goes wrong:** R8 adds about 110 B to `NAV_CARD_FIRE_DOCTRINE`, and `test-251-skeleton-split.cjs` goes red in `run-all-251.sh`, not in `run-all-359.sh`.
**How to avoid:** add the same assertion (`< 900` raw) to `test-359-prose-budget.cjs` and ship the compensating trim in the same commit (Finding 7). Also run `node tests/test-251-skeleton-split.cjs` in the R8 task's verify block.

### Pitfall 3: 359 fixtures break 357's standing gate
**What goes wrong:** `prose-forks-359.json` is loaded by `loadCorpus({})`, so the entries are missing from 357's `baseline.json` and 357 L7 fails. Or `source: 'synthetic-359'` fails `validateEntry`.
**How to avoid:** make the source opt-in (`sources` include only when asked, or when `--fork359`/`--source synthetic-359` is passed), and add a 357-regression leg: `node tests/test-357-replay.cjs` stays green after 359.

### Pitfall 4: MCP dedup swallows the second declared fork
See Finding 5. The leg to add: two distinct declared forks in one MCP session, with no `_resetForTest` between them, both return `fire: true`.

### Pitfall 5: Yes/no prefix quirk and non-ASCII labels
`isYesNoShapedGate` uses `indexOf('yes'/'no') === 0` on ASCII-stripped labels. `Yesterday | Now` is exempt, and a Hebrew yes/no pair is NOT exempt. Fixture both, and document them as known. Never change `isYesNoShapedGate` in this phase (the 2026-07-05 ruling and the intern-w1 fix depend on it).

### Pitfall 6: The forward run cannot see cards (A1)
**What goes wrong:** plain `claude -p` offers no `AskUserQuestion`, so pre and post both show 0 cards. Missed forks then become declaration adoption only, and the pre count is inflated by forks that Larry would have carded in production.
**How to avoid:** use the permission-probe host (Finding 8). The smoke run must show `AskUserQuestion` in `system/init.tools` and at least one recorded attempt. If the probe route fails, fall back to "declaration adoption when no card tool exists" and record that the metric definition changed (a navigator ruling).

### Pitfall 7: Vacuous pass of the 50% bar
**What goes wrong:** pre-arm missed forks are 0-2 of 30 fork runs (turn-1 discipline, confounding cards), so "post <= 50% of pre" passes trivially or on noise.
**How to avoid:** use multi-turn scenarios with the fork last; exclude mode-menu cards; add a non-vacuity floor (recommend: pre missed forks >= 6 of 30, otherwise report INCONCLUSIVE and ask the navigator. This is a SPEC-adjacent addition, see Open Questions). With 30 runs per arm, even 12 -> 6 is not statistically significant (a two-sided Fisher test gives roughly p = 0.16), so present R9 as directional evidence, with the counts.

### Pitfall 8: Control blocks measured vacuously
If `--no-session-persistence` leaves the Stop hook no transcript, and the declaration is not sourced from `last_assistant_message`, then "0 control blocks" holds because the hook saw nothing. Compute control blocks OFFLINE from the attempt-1 text (feed it to `deriveTurnSignals` + `classifyCardFire` from the arm's tree, the way the replay does), and treat the per-run temp intercept log as corroboration. Require at least one post-arm fork run whose attempt 1 carries a declaration and no card to show a `declared-fork-no-card` intercept, which proves the hook path is live.

### Pitfall 9: The wrong Larry is measured
The live dev tree changes under parallel sessions, and the user-level agent could shadow the plugin agent. Use `git archive` snapshots per arm (never the live tree), `--agent mos:larry-extended`, the preflight on `~/.claude/agents/larry-extended.md`, and a `system/init.plugins` assertion (exactly one `mos`, whose path is the snapshot).

### Pitfall 10: `End with a question` versus a last-line declaration
larry-extended and the ui-system skill both say "End with a question or next step", and the pins require a card at a gate. A declaration after the closing question makes the question second-to-last. The R8 wording should frame the declaration as the closing form of the question ("hand the call over: `Your call: A | B`"). Keep it outside the 120-char regex window in `test-gate-native-fire-w1.cjs:118-121`.

### Pitfall 11: 5 labels versus the card's 4-option limit
Claude Code's `AskUserQuestion` supports 2-4 options per question. A 5-label declaration re-prompts a card that cannot carry all 5. SPEC R3 locks 2-5, so record this as a residual. Do not silently change `MAX_LABELS` without a navigator ruling (Open Question 3).

### Pitfall 12: Shared-tree tests during parallel sessions
`tests/test-298-contract-parity.cjs` edits tracked files and requires a clean tree. The mutation legs must write only to mkdtemp code roots. Record test-298 as not run, with the reason, when peers have diffs (357 Pitfall 9).

## Code Examples

### Example 1: the parser (shape to implement; `lib/core/fork-declaration.cjs`)
```js
'use strict';
// Pure: no fs, no network, no clock; never throws. House rule: hyphens only.
let GLYPHS = null;
try { GLYPHS = new Set(Object.keys(require('../hmi/voice-color-mark.cjs').MARK_GLYPHS)); }
catch (_e) { GLYPHS = null; } // fail INERT: no glyph set -> nothing is a declaration

const DECLARATION_PREFIX = 'Your call: ';
const DECLARATION_SEPARATOR = ' | ';
const MIN_LABELS = 2;
const MAX_LABELS = 5;
const MAX_LABEL_CHARS = 80;               // code points
const MAX_LINE_CHARS = 512;               // ReDoS / size guard (no regex needed below)
const NOT_DECLARED = Object.freeze({ declared: false });

function parseForkDeclaration(outputText) {
  try {
    if (typeof outputText !== 'string' || outputText.length === 0 || GLYPHS === null) return NOT_DECLARED;
    const lines = outputText.split('\n');
    let i = lines.length - 1;
    while (i >= 0 && lines[i].trim() === '') i -= 1;
    if (i < 0) return NOT_DECLARED;
    const line = lines[i].replace(/[ \t\r]+$/, '');           // trailing whitespace only
    if (!line.startsWith(DECLARATION_PREFIX)) return NOT_DECLARED; // column 0, case-sensitive
    if (Array.from(line).length > MAX_LINE_CHARS) return NOT_DECLARED;
    if (line.indexOf('[') !== -1 || line.indexOf(']') !== -1) return NOT_DECLARED;
    for (const ch of line) if (GLYPHS.has(ch)) return NOT_DECLARED;
    if (/type\s+1\s*,\s*2\s*,\s*or\s+3/i.test(line)) return NOT_DECLARED; // backstop arm 2, last line only
    const labels = line.slice(DECLARATION_PREFIX.length).split(DECLARATION_SEPARATOR).map((s) => s.trim());
    if (labels.length < MIN_LABELS || labels.length > MAX_LABELS) return NOT_DECLARED;
    const seen = new Set();
    for (const l of labels) {
      if (!l || l.indexOf('|') !== -1 || Array.from(l).length > MAX_LABEL_CHARS) return NOT_DECLARED;
      const k = l.normalize('NFKC').toLowerCase();
      if (seen.has(k)) return NOT_DECLARED;
      seen.add(k);
    }
    return { declared: true, labels: labels };
  } catch (_e) { return NOT_DECLARED; }
}
module.exports = { parseForkDeclaration, DECLARATION_PREFIX, DECLARATION_SEPARATOR,
  MIN_LABELS, MAX_LABELS, MAX_LABEL_CHARS };
```
(Rejecting a bare `|` inside a label is a recommended tightening of D-02. A drift test runs the real `ASCII_BOX_UNCONDITIONAL_RE` from source over every accepted fixture line.)

### Example 2: the declared arm (insertion shape in `classifyCardFire`)
```js
// after backstopHit (:543)
// ANCHOR fork359-declared-arm (the mutation leg M1 edits the next line)
const forkDeclared = t.fork_declared === true
  && Array.isArray(t.declared_labels) && t.declared_labels.length >= 2;
if (!primaryHit && !backstopHit && !forkDeclared) {
  return { intercept: false, reason: 'no-gate-signal', degrade: false };
}
if (forkDeclared) {
  const sc = Number.isFinite(t.session_count) ? t.session_count : 0;
  if (sc >= MAX_SESSION_INTERCEPTS) return { intercept: false, degrade: true,
    reason: 'session-intercept-ceiling-reached-after-' + MAX_SESSION_INTERCEPTS + '-intercepts' };
  const rc = Number.isFinite(t.retry_count) ? t.retry_count : 0;
  if (rc >= MAX_FORCE_RETRIES) return { intercept: false, degrade: true,
    reason: 'bounded-escape-released-after-' + MAX_FORCE_RETRIES + '-retries' };
  if (gateRelevance.isYesNoShapedGate(t.declared_labels.map(gateRelevance.normalizeOptionLabel))) {
    return { intercept: false, reason: 'gate-is-simple-binary', degrade: false };
  }
  return { intercept: true, reason: 'declared-fork-no-card', degrade: false };
}
// existing :583 onward, byte-for-byte unchanged
```

### Example 3: key and dedup identity (shared helper)
```js
function declaredIdentity(turn) {
  const t = turn && typeof turn === 'object' ? turn : {};
  if (t.fork_declared !== true || !Array.isArray(t.declared_labels) || t.declared_labels.length === 0) return '';
  return 'decl:' + t.declared_labels.map((l) => String(l).normalize('NFKC').toLowerCase()
    .replace(/\s+/g, ' ').trim()).sort().join(',');
}
// turnContextHash: .update('s:' + session + '|g:' + gateIdentity + (decl ? '|' + decl : ''))
//   -> non-declared input string is byte-identical to today
// stop-gate-handler: subject: turn.gate_signature || checkCardFire.declaredIdentity(turn) || ''
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hook guesses forks from prose shape (numbered-prose arm) | Retired (~86% false positive); model judgment only | 2026-07-17 | 359 adds a model-DECLARED signal, not a guess |
| Stop hooks read `transcript_path` for the final text | Docs recommend `last_assistant_message` (the transcript may lag) | Current hooks doc | Use it for the declaration source (Pattern 1) |
| Stop has no `hookSpecificOutput` variant (repo finding, 2026-07-23) | Current hooks doc lists `hookSpecificOutput.additionalContext` for Stop ("Stop hook feedback", non-error) | Current hooks doc | Out of scope (D-09 locks the envelope), but a future phase could carry a model-facing "fire the card with these labels" message without breaching CR-06. Needs its own verification because of the 4-time schema-break history. |
| `-p` exposes AskUserQuestion | Only with a permission host; `--permission-prompts none` removes it | CLI >= 2.1.259 docs | R9 must supply a host |
| Plugin testing by hand | `claude plugin eval` (>= 2.1.269) | 2026 | Considered and not used (Standard Stack, Alternatives) |

**Deprecated/outdated:**
- `tests/test-114-turn-1-voice.sh`'s comment that `initialPrompt` is auto-submitted for the plugin agent. The current sub-agents doc says `initialPrompt` is "Ignored for plugin subagents". Treat it as unverified for the main-session case.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `--permission-prompt-tool` MCP I/O contract is `{tool_name, input, tool_use_id}` in and text JSON `{behavior, updatedInput|message}` out | Finding 8 | The probe host fails; the smoke run catches it; fall back per Pitfall 6 |
| A2 | `--setting-sources project,local` drops user hooks/plugins/agent but keeps the `--plugin-dir` plugin | Finding 10 | Unrelated plugins load, or `mos` does not; `system/init.plugins` assertion catches it |
| A3 | `--include-hook-events` emits a Stop hook event that cleanly separates attempt 1 from a re-prompt in `stream-json` | Finding 9 | Attempt split fails; fall back to the probe log plus the offline classification of the first final text |
| A4 | Claude Code system prompt + tool schemas + plugin MCP schemas + session-start context add about 15-35k tokens per call | Finding 12 | Cost estimate off; the smoke run measures the real cost |
| A5 | Main-session Larry receives all 4 preloaded skills | Finding 12 | Estimate range already spans 85-127 KB |
| A6 | Wall time 30-90 s per run | Finding 12 | Scheduling only |
| A7 | Stop stdin `last_assistant_message` is present on Claude Code 2.1.280 | Pattern 1 | The fallback to the current-window text still avoids the stale re-read |
| A8 | Multi-turn `--input-format stream-json` user messages are processed sequentially in one session, with Stop per turn | Pattern 5 | Use separate runs per turn depth instead; the smoke run verifies |
| A9 | The scratch-room layout (`$MINDRIAN_ROOMS_HOME/<cwd basename>` with `ROOM.md`) makes session-start take the room branch | Finding 11 | MODE_ROUTING stays; the preflight on the SessionStart `hook_response` catches it |

## Open Questions

1. **R9 metric definition if the probe host is not viable**
   - What we know: the docs say `-p` offers `AskUserQuestion` only with a permission host.
   - What's unclear: whether the MCP prompt-tool contract works as the community describes.
   - Recommendation: Wave-0 smoke (1 paid run per arm, about $0.50 total, navigator-approved). If it fails, the navigator rules whether R9 measures "declaration adoption with no card tool" (a metric change) or the phase uses the undocumented stdio control protocol.

2. **Non-vacuity floor for the 50% bar**
   - What we know: SPEC R9 says post <= 50% of pre. With a small pre count this passes on noise.
   - Recommendation: add "pre missed forks >= 6 of 30 fork runs, else INCONCLUSIVE, then a navigator ruling" as a plan-level guard. This needs navigator confirmation because it narrows a locked bar.

3. **`MAX_LABELS = 5` versus `AskUserQuestion`'s 4-option cap**
   - Recommendation: keep 5 (SPEC-locked) and record the CLI residual; or the navigator lowers it to 4. It is a one-constant change plus fixtures.

4. **Net versus gross for the 400 B cap**
   - Recommendation: net per-surface `Buffer.byteLength` delta, summed, with the trims counted. Confirm at plan review.

5. **Model for R9**
   - Recommendation: `claude-sonnet-5` (cost fits the D-12 caps). If the navigator wants the model Larry actually runs on day to day (for example Opus 5.5), raise the caps first (Finding 12). Never Fable.

6. **What 357 actually ships**
   - The contracts cited in Finding 6 come from 357 PLAN files, not code. The planner must re-read the 357-0N-SUMMARY files (exports, flags, JSON shape) before locking 359 tasks that edit 357 scripts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all code/tests | yes | v22.23.1 | - |
| Claude Code CLI | R9 only | yes | 2.1.280 | none (R9 is its only consumer) |
| Claude credentials (keychain file) | R9 | yes (`~/.claude/.credentials.json` present, not read) | - | - |
| `@modelcontextprotocol/sdk` | R9 probe server | yes | 1.29.0 | stdio control protocol [ASSUMED] |
| TypeSafe key | R1 labeler (optional) | yes (`~/.secrets/typesafe.env` present, not read) | - | keyless run -> `unlabeled`, exit 0 |
| Phase 357 artifacts | R1, R2, R5, R6, R10 | NO (357 not executed; `tests/fixtures/card-fire-replay/`, `scripts/replay-card-fire.cjs`, `scripts/label-card-fire-replay.cjs` absent) | - | none: blocks execution (D-17) |
| `bwrap` | only if `claude plugin eval` were used | yes | - | not needed |

**Missing dependencies with no fallback:** Phase 357 on disk (hard sequencing dependency, D-17).
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with `node:assert/strict` plus bash `run_if` runners (repo convention; no jest/vitest) |
| Config file | none; runners are `tests/run-all-<phase>.sh` |
| Quick run command | `node tests/test-359-fork-declaration.cjs && node tests/test-359-declared-arm.cjs` |
| Full suite command | `bash tests/run-all-359.sh && bash tests/run-all-238.sh && bash tests/run-all-357.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORK359-01 | fixture exists; >= 15/15 floors; every `prose_fork:true` has >= 2 `fork_labels`; the source is opt-in; labeler refuses dogfood (357 L1 still green) | unit | `node tests/test-359-corpus.cjs && node tests/test-357-labeler-refusal.cjs` | no, Wave 0 (357 file lands in 357-04) |
| FORK359-02 | pre-359 `fork359.missed_forks` == count of `prose_fork:true` entries; `baseline-359.json` written | integration (replay) | `node scripts/replay-card-fire.cjs --code-root git:$(node -p "require('./tests/fixtures/card-fire-replay/baseline-359.json').meta.pre_phase_sha") --source synthetic-359 --fork359 --json` then assert in `tests/test-359-replay.cjs` L1 | no, Wave 0 |
| FORK359-03 | parser valid 2/5 labels; not-last; 1 label; 6 labels; over-cap; glyph; bracket; type-1-2-3; empty and non-string; no throw; zero network (fetch stubbed to throw) | unit | `node tests/test-359-fork-declaration.cjs` | no, Wave 0 |
| FORK359-04 | legs: declared+no card -> `declared-fork-no-card`; +card -> `card-fired`; yes/no -> `gate-is-simple-binary`; retry ceiling / session ceiling -> degrade with exact strings; D-07 stale-PRIMARY + declaration -> declared; key suffix only when declared; stale declaration before the last user record -> not declared | unit | `node tests/test-359-declared-arm.cjs` | no, Wave 0 |
| FORK359-05 | 357 corpus `--surface both --baseline compare`: 0 class diffs, false_blocks 0, new_misses 0; regex literal byte identity; `classifyCardFire` source tripwire | integration + static | `node scripts/replay-card-fire.cjs --surface both --baseline compare --json` (exit 0) + `node tests/test-359-declared-arm.cjs --tripwires` | no, Wave 0 |
| FORK359-06 | declared_catch_rate 100% (yes/no reported separately); control_false_blocks 0; declared-variant missed_forks 0 | integration | `node scripts/replay-card-fire.cjs --source synthetic-359 --fork359 --surface both --json` asserted by `tests/test-359-replay.cjs` L2 | no, Wave 0 |
| FORK359-07 | CLI/MCP class parity on R5+R6 entries; MCP `rendered` options == `declared_labels`; two declared forks in one MCP session both fire | integration | `node tests/test-359-replay.cjs` (L3, L4) | no, Wave 0 |
| FORK359-08 | net bytes <= 400 across 4 surfaces; doctrine < 900 raw; MCP <= 2000; pinned phrases present; D-05 drift (prefix + separator literal on all 4 surfaces); manifest check | static | `node tests/test-359-prose-budget.cjs && node tests/test-251-skeleton-split.cjs && node lib/mcp/no-instructions.test.cjs && node tests/test-gate-native-fire-w1.cjs && node tests/test-larry-voice-mark-182.cjs && node tests/test-205-voice-mark-hybrid.cjs && node tests/test-larry-handoff-seam.cjs && node scripts/build-harness-manifest.cjs --check` | no, Wave 0 (others exist) |
| FORK359-09 | forward run: post misses <= 50% of pre (with the floor), 0 control blocks, or recorded falsification | manual-only (paid, nondeterministic, navigator-gated) | `node scripts/forward-fork-scenarios-359.cjs --arm pre --smoke` then the full batch; not in CI | no, Wave 0 |
| FORK359-10 | standing gate wired; M1 (arm removed) and M2 (free-text regex) each fail; R9 script and probe not imported from `lib/`/`hooks/`; `grep -r api.typesafe.ai lib/ hooks/` empty | integration + static | `node tests/test-359-replay.cjs --mutation && node tests/test-359-devonly-tripwire.cjs && bash tests/run-all-359.sh` | no, Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run command plus the specific leg for the requirement touched.
- **Per wave merge:** `bash tests/run-all-359.sh` plus `node scripts/replay-card-fire.cjs --surface both --baseline compare`.
- **Phase gate:** `bash tests/run-all-359.sh && bash tests/run-all-238.sh && bash tests/run-all-357.sh && bash tests/run-all-251.sh && node scripts/build-harness-manifest.cjs --check`. Known pre-existing reds in 179/209/238/relevance-gate are recorded per 357 R-J, not fixed. R9 results go in the SUMMARY.

### Wave 0 Gaps
- [ ] `tests/test-359-fork-declaration.cjs`: covers FORK359-03 (and the D-05 drift leg once R8 lands)
- [ ] `tests/test-359-declared-arm.cjs`: FORK359-04, FORK359-05 tripwires
- [ ] `tests/test-359-corpus.cjs`: FORK359-01
- [ ] `tests/test-359-replay.cjs` (with `--mutation`): FORK359-02, -06, -07, -10
- [ ] `tests/test-359-prose-budget.cjs`: FORK359-08
- [ ] `tests/test-359-devonly-tripwire.cjs`: FORK359-10 (R9 script and probe not required from `lib/`/`hooks/`; no `api.typesafe.ai` under `lib/`/`hooks/`)
- [ ] `tests/run-all-359.sh` plus one `run_if` leg appended to `tests/run-all-238.sh`
- [ ] Framework install: none

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (R9 uses the existing keychain login; never `--bare`, never print creds) | - |
| V3 Session Management | no | - |
| V4 Access Control | partial (R9 probe denies all tool permissions, so the headless Larry cannot write or call Brain) | deny-all permission host |
| V5 Input Validation | yes (the parser consumes untrusted model output) | strict last-line grammar, length caps, no regex over the label body (no ReDoS), never throws |
| V6 Cryptography | no (sha256 keys already exist and are not security controls) | - |
| V7 Logging | yes | slug-only reason in the local log; the existing 4000-char output cap; no new egress |
| V14 Configuration / egress | yes | Part 8: no network in the parser or classifier; `api.typesafe.ai` banned under `lib/`/`hooks/`; the labeler uses only the `card_fire_replay` profile |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection makes Larry end every turn with a declaration (forced re-prompts) | DoS | existing per-gate (3) and session (12) ceilings; the host caps at 8 consecutive Stop blocks |
| Larry quotes a pasted document whose last line is a declaration | Tampering / false block | bounded by the ceilings; relevance deliberately skipped (SPEC R4); recorded residual |
| Stale declaration re-read on a later turn | False block | Pattern 1 source precedence |
| MCP caller passes crafted `output_text` | Spoofing | same as today: the caller already controls the text; no direct `fork_declared` field is accepted |
| Declared labels egress | Information disclosure | labels stay in-process and in the local log; never Brain, never Jev |
| R9 transcripts leaking into git | Information disclosure | only authored text; raw streams stay under the gitignored scratch path; only counts and ids are committed |

## Sources

### Primary (HIGH confidence)
- Repo source read this session:
  - `scripts/check-card-fire.cjs` (:152-548, :583-747, :788-850, :1279-1300, :1420-1750)
  - `lib/core/gate-relevance.cjs` (:137, :200-250)
  - `lib/hmi/voice-color-mark.cjs` (:55-120, :205-298)
  - `lib/hmi/turn-text.cjs` (:166-268)
  - `lib/mcp/stop-gate-handler.cjs` (:300-589), `lib/mcp/gate-dedup.cjs` (:67-120), `lib/mcp/gate-render.cjs` (:150-190), `lib/mcp/runtime-instructions.cjs`, `lib/mcp/no-instructions.test.cjs`, `lib/mcp/tools/stop-gate.cjs`
  - `lib/core/voice-transition-detector.cjs` (:22-25)
  - `scripts/session-start` (:103, :375, :622-760, :1794), `scripts/intent-classifier.cjs` (:470-700, :2844-2905), `scripts/resolve-room`, `scripts/first-install-router.cjs` (:128-146), `scripts/sessionstart-npm-reconcile.cjs`, `scripts/check-voice-style.cjs`, `hooks/hooks.json`, `settings.json`, `.mcp.json`, `agents/larry-extended.md` (frontmatter, :84-91), `skills/larry-personality/SKILL.md` (:216)
  - Tests: `tests/test-251-skeleton-split.cjs`, `tests/test-gate-native-fire-w1.cjs`, `tests/test-298-contract-parity.cjs`, `data/harness-policies/contract-parity-larry.json`, `tests/test-198-stop-gate-retry-ceiling.test.cjs`, `tests/test-209-primary-sidechannel.cjs`, `tests/test-353-tripwires.cjs`, `tests/run-all-238.sh`
- 357 plans: 357-CONTEXT (with post-research rulings R-A..R-J), 357-RESEARCH (Patterns 1-3, Pitfalls 1-9), 357-01, 357-02, 357-04, 357-09 and 357-10 PLAN files.
- Official Claude Code docs, fetched this session:
  - `code.claude.com/docs/en/hooks.md`: Stop input and decision control, `last_assistant_message`, transcript lag, the 8-block cap, AskUserQuestion needing a permission host in `-p`
  - `.../headless.md`: bare mode, dontAsk, `--permission-prompts none`, stream-json, `system/init` plugins, cost fields
  - `.../cli-reference.md`: `--include-hook-events`, `--permission-prompt-tool`, `--setting-sources`, `--plugin-dir`, `--agent`, `--max-budget-usd`
  - `.../agent-sdk/user-input.md`: AskUserQuestion via canUseTool; 2-4 options
  - `.../agent-sdk/permissions.md`
  - `.../plugins.md`: a local `--plugin-dir` copy takes precedence
  - `.../plugins-reference.md`: plugin `settings.json` supports only `agent` and `subagentStatusLine`
  - `.../sub-agents.md`: scope priority; `initialPrompt`; `skills` preload
  - `.../plugin-evals.md`
- `platform.claude.com/docs/en/about-claude/pricing`: Sonnet 5, Opus 5.5 and cache multipliers.
- Local count-only probes (prefix collision; A5) and byte measurements (Finding 7), run this session.

### Secondary (MEDIUM confidence)
- `github.com/anthropics/claude-code/issues/1175`: community description of the `--permission-prompt-tool` I/O contract.

### Tertiary (LOW confidence)
- Token overhead of the Claude Code system prompt, tool schemas and MCP tool schemas (not measured).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, because everything is in-repo and the versions were verified.
- Architecture and code seams: HIGH, from line-level reads.
- Byte budgets and pins: HIGH, from measurements this session.
- 357 contracts: MEDIUM, from plans rather than code (357 is not executed).
- R9 headless mechanics: MEDIUM. The docs are explicit, but the stream shape and prompt-tool contract are unverified without a paid run.
- Cost: LOW-MEDIUM. The estimate has a stated basis; the smoke run replaces it.

**Research date:** 2026-09-23
**Valid until:** about 2026-10-07 for the headless and CLI facts (Claude Code ships weekly); 30 days for the repo findings, or until 357 executes (re-verify Finding 6 against the 357 SUMMARY files).
