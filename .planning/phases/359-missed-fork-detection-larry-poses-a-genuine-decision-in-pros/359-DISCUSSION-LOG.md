# Phase 359: Missed-fork detection (Larry poses a genuine decision in prose and no card fires) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
**Mode:** `--auto`, single pass, run as a subagent without chain auto-advance (no plan-phase, no
`workflow._auto_chain_active`). STATE.md not written (a peer session owns it). No commit.
**Areas discussed:** Declaration line (grammar, prefix, visibility), Parser module location, Arm ordering in
classifyCardFire, Forward-run harness, Prose placement and byte budget, Fixtures and dev-time labeling

---

## Pre-flight log

- [auto] check_blocking_antipatterns: no `.continue-here.md` in the phase dir. Proceed.
- [auto] check_spec: `359-SPEC.md` found, 10 requirements locked. Discussing HOW only.
- [auto] check_existing: no CONTEXT.md, no checkpoint, no plans. Fresh capture.
- [auto] load_prior_context: 357-CONTEXT.md (with post-research rulings R-A..R-J), 357-SPEC.md, 357-10-PLAN.md.
- [auto] cross_reference_todos: 8 matches, all keyword-only (bono sensor mirror, registry drift, F7 rescope,
  git-stash, skill-description ingest, deck slide count, Theo gate-render mirror, autonomous_safe audit).
  Auto rule would fold every match >= 0.4; overridden by the scope guardrail because none concerns prose-fork
  detection. Recorded as reviewed, not folded.
- [--auto] Selected all gray areas: Declaration line, Parser location, Arm ordering, Forward-run harness, Prose
  placement and budget, Fixtures and labeling.

---

## Declaration line (grammar, prefix, visibility)

| Option | Description | Selected |
|--------|-------------|----------|
| Visible plain line `Your call: A \| B` | ASCII prefix in Larry's voice, pipe-separated 2-5 labels, last line; doubles as a readable recap of the choice | ✓ |
| Hidden HTML comment `<!-- fork: A \| B -->` | Invisible in rendered markdown, but NOT hidden in the Claude Code terminal, so it shows as raw machine noise | |
| Arrow-glyph lead `→ Choose: A \| B` | Reuses the ui-system `arrow` glyph; breaks SPEC R3's fixed ASCII prefix and collides with the hook-minted "→ Choose next reach:" dial prompt Larry must never hand-draw | |
| `Fork: A \| B` / `Options: A \| B` | ASCII, but "Fork" is jargon to a navigator and "Options:" is a common natural last line (collision risk) | |

**Choice:** [auto] Declaration line - Q: "What exact prefix, and visible or hidden?" -> Selected: "Visible plain
line `Your call: A | B`" (recommended default).
**Notes:** Hidden loses on the CLI (comments render). Visible turns the line into a UX feature: when no card
fires, the navigator still sees the choice named plainly and can type an answer. Strictness rules added: exact
case-sensitive prefix at column 0, no markdown emphasis, separator ` | `, 2-5 labels, 80 code points each, no
duplicates, no `[` or `]`, no voice squares, never matches the `type 1, 2, or 3` literal. **[auto][navigator-review]**:
the prefix string and the visible call are the two choices to surface to the navigator.

---

## Parser module location

| Option | Description | Selected |
|--------|-------------|----------|
| `lib/core/fork-declaration.cjs` | Gate-domain grammar next to `gate-relevance.cjs`; pure; one parser for both surfaces | ✓ |
| `lib/hmi/fork-declaration.cjs` | `lib/hmi` is presentation (voice mark, turn text); the parser is gate logic, not rendering | |
| Inline in `check-card-fire.cjs` | Would force the MCP handler and tests to import the whole hook script for a grammar; harder to drift-test | |

**Choice:** [auto] Parser location - Q: "Where does parseForkDeclaration live?" -> Selected: "lib/core" (recommended default).
**Notes:** Exports frozen grammar constants so a drift test can assert every prose surface uses the same literal.
Voice-glyph set is imported from `voice-color-mark.cjs` if `lib/core` -> `lib/hmi` imports are accepted,
otherwise a frozen copy plus drift test (researcher decides from layering evidence).

---

## Arm ordering in classifyCardFire

| Option | Description | Selected |
|--------|-------------|----------|
| Declared arm owns the verdict whenever a declaration is present (after card-fired) | card-fired -> none-of-three -> declared (ceilings, yes/no, intercept) -> else existing path unchanged | ✓ |
| Declared arm only as a fallback when PRIMARY and BACKSTOP both miss | Replaces only the `no-gate-signal` return; misses a real prose fork on a turn that also carries a stale irrelevant F.1 reach | |
| Declared arm after the relevance checks | Contradicts SPEC R4 (relevance and already-answered do NOT apply to a declaration) | |

**Choice:** [auto] Arm ordering - Q: "Where does the declared arm sit relative to card-fired, primary, backstop and
ceilings?" -> Selected: "Declared arm owns the verdict when present" (recommended default).
**Notes:** Inertness (R5) holds by construction because a turn with no declaration runs today's code unchanged.
Retry key gains a `decl:<sorted normalized labels>` suffix only on declared turns. CR-06 envelope text unchanged;
the new slug lives only in the local intercept log. MCP card options come from the declared labels.

---

## Forward-run harness

| Option | Description | Selected |
|--------|-------------|----------|
| Headless `claude -p --plugin-dir --output-format stream-json`, hermetic temp homes, pinned model, per-run and total budget caps, pre = R3-R7 landed without R8, post = after R8 | Follows the repo's proven skillopt/huji headless pattern; only the prose differs between arms | ✓ |
| Agent SDK harness | New dependency and a second invocation path the repo does not use yet | |
| Replay-only (no live model) | Cannot prove adoption; historic text never carries a declaration (SPEC R9 rationale) | |

**Choice:** [auto] Forward-run harness - Q: "How are forward scenarios run, bounded and measured?" -> Selected:
"Headless claude -p with hermetic temp homes and caps" (recommended default).
**Notes:** Scenarios in `tests/fixtures/forward-fork-scenarios-359.json`, authored labels only. Card = an
`AskUserQuestion` tool_use in the stream; declaration = parser accepts the first final assistant text before any
re-prompt. Caps: USD 0.40 per run, refuse to start above USD 60 projected. Open assumptions A1-A4 and A9 (headless
AskUserQuestion availability, Stop hook under `-p`, Larry persona loading, room-picker confound, real cost) go to
the researcher.

---

## Prose placement and byte budget

| Option | Description | Selected |
|--------|-------------|----------|
| One rule on 4 surfaces, allocated ~110/90/110 B plus net <=16 B on MCP instructions, measured after 357; R8 as its own revertible commit | Fits the 400 B cap; respects the MCP 2000 B budget (1984 B today) by folding into item 3 with a compensating trim; BOUNDARIES never trimmed | ✓ |
| Equal 100 B per surface | MCP instructions cannot absorb 100 B without breaking the 2000 B budget test | |
| Raise the MCP budget | Out of scope; the budget test is a standing contract | |

**Choice:** [auto] Prose placement - Q: "Where does the rule go, and how are the 400 B split?" -> Selected: "Four
surfaces with an MCP net-zero-ish fold" (recommended default).
**Notes:** 357 R-B pinned phrases survive; Post-Gate Handoff and SKILL :244 untouched; manifest regenerated.
Sequencing: 359 executes only after 357 completes, including 357-10's shrink or its recorded skip. A6 (doctrine
or item-5 byte pins in tests) goes to the researcher.

---

## Fixtures and dev-time labeling

| Option | Description | Selected |
|--------|-------------|----------|
| `prose-forks-359.json` (>=15 forks incl. intern-w1 and >=2 yes/no; >=15 controls incl. the six benign shapes and >=3 near-miss declarations), hand labels then 357's labeler with its `is-fork` Noul through 357's existing `card_fire_replay` profile; 359-owned `baseline-359.json` | Honors SPEC R1 "no new egress profile"; single owner per baseline file | ✓ |
| A 359-owned EGRESS_PROFILES entry (orchestrator brief) | Conflicts with the locked SPEC R1; 357's profile keys already cover a prose output | |
| Write the missed-fork count into 357's `baseline.json` | Two owners of one file; 357 compare runs would churn | |

**Choice:** [auto] Fixtures and labeling - Q: "Fixture composition, labeling path and baseline home?" -> Selected:
"Reuse 357's labeler and profile; 359-owned sibling baseline" (recommended default).
**Notes:** The orchestrator's brief asked for a 359 EGRESS_PROFILES entry; the locked SPEC R1 says no new
profile, so the SPEC wins. Flag to the navigator only if a key outside `card_fire_replay` is ever needed. Dogfood
`prose_fork` labels are proposed locally and ratified at one navigator checkpoint (`359-DOGFOOD-FORK-LABELS.md`);
dogfood text never reaches Jev.

---

## Claude's Discretion

- Per-surface wording of the declaration rule inside the byte allocation.
- Fixture ids, forward-run script internals and results-file layout.
- Per-entry parser diagnostics in the replay output.
- Test file split, provided the standing gate exists.

## Deferred Ideas

- Desktop/Cowork chat-only-turn residual (hookless Larry skips `stop_gate_check` on chat-only turns).
- Any free-text fork detector (permanently out; tripwired).
- A hidden declaration channel, if all three surfaces ever gain one.
- Voice-glyph-as-declaration (Part 12).
- Room-bind picker on harness turns (Phase 360); intent-classifier unrelated F.1 mints (own phase).
