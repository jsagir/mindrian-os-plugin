# Phase 243: Voice-Glyph - Research

**Researched:** 2026-07-28
**Domain:** Local statusline rendering (Canon Part 12 Voice Signature), plus one RCA-filing decision
**Confidence:** HIGH on the code findings (all reproduced live in this session against the working tree), HIGH on the missing-RCA finding (verified by three independent commands), MEDIUM on the two judgment calls flagged for the planner

## Source-of-Truth Preamble

- **CODE claims read against:** worktree of branch `main` @ `d7e8d00d` (2026-07-28), plugin version `1.15.3-beta.51`, in `/home/jsagi/dev/MindrianOS-Plugin/.claude/worktrees/agent-a1329a12073c547d1`. Every line number below was re-read in this session, not copied from the audit.
- **WIRE claims probe against:** none for the fix itself (pure LOCAL rendering). ONE external doc read: `code.claude.com/docs/en/statusline` for the Claude Code statusline stdin payload schema.
- **Date of research:** 2026-07-28
- **Line-number drift note:** the source audit cites `scripts/context-monitor:649` and `cockpit-renderer.cjs:347-349`. The live tree has `context-monitor:636` and `cockpit-renderer.cjs:347-350`. Plans must re-grep by symbol, never by the audit's line numbers.

---

<user_constraints>
## User Constraints

**No CONTEXT.md exists for this phase.** `/gsd-discuss-phase 243` was not run. This is a deliberate orchestrator choice for this run, not an oversight. ROADMAP.md's Phase 243 definition is the substitute for user decisions and is treated with the same authority as locked decisions.

### Locked Decisions (from `.planning/ROADMAP.md` "### Phase 243: Voice-Glyph", verbatim)

> **Goal**: The De Stijl voice-glyph header tells the truth: the statusline's "who is speaking" signal reflects the glyph a turn actually opened with, and the remaining voice-signature findings ride the existing open RCA instead of spawning a new one.
> **Depends on**: Nothing hard (scheduled last; smallest blast radius)
> **Requirements**: GLYPH-01
> **Success Criteria** (what must be TRUE):
>   1. Across a fixture set covering the glyph vocabulary, a turn opened with glyph X renders glyph X in the statusline, and a turn that opened with NO glyph renders the honest empty/unknown state -- the fabricated default painted over by the stance color cannot be reproduced; a mutation restoring the fabricated default turns the gate red.
>   2. V-2 and V-3 are routed into the existing open `voice-signature-dark-runtime.md` RCA as cross-referenced entries (no new RCA file created), verifiable by reading that RCA.

### Claude's Discretion (derived, not user-stated)

- HOW the fabrication is removed at `cockpit-renderer.cjs:347-350` (delete the branch vs gate it behind an explicit opt-in field).
- The shape and file layout of the fixture suite and its mutation gate.
- Whether the RCA is one file with V-1 as historical context plus V-2/V-3 as sub-findings, or another structure (see Finding F1's decision fork).

### Deferred Ideas (OUT OF SCOPE)

- **V-4** (spoof-fence gaps, mixed-mark gap, the checkbox `⬜` special case, the false provenance comment at `cockpit-signals.cjs:216`, the stale `agents/larry-extended.md:56` line). REQUIREMENTS.md's GLYPH-01 text names only V-1/V-2/V-3. The audit's own rethink verdict for V-4 was "no RCA, just the batch fix." See Finding F7 for the recommended explicit exclusion note.
- **Building the voice-mark.json writer** (paying the write-side debt). This is V-2's subject and V-2 routes to the RCA as a documented finding, not as build work. See Finding F5.
- **The F.7 recalibration dial wiring** (V-3's downstream consumer). Same reason.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from `.planning/REQUIREMENTS.md:52`) | Research Support |
|----|-------------|------------------|
| GLYPH-01 | "The statusline's 'who is speaking' signal reflects the actual glyph a turn opened with, not a fabricated default painted over by the stance color (V-1); V-2/V-3 route into the existing open `voice-signature-dark-runtime.md` RCA rather than a new one." | Half 1 (V-1): Findings F2 (exact fabrication site, live-reproduced), F3 (the two green tests that assert the fabrication and MUST be inverted), F4 (the `who` default is a SEPARATE defect - recommendation with reasoning), F6 (fixture testability confirmed). Half 2 (V-2/V-3 routing): Finding F1 (the target RCA file does not exist and never has - decision fork required), F5 (the residual that MUST be recorded or the phase repeats 182.1's failure shape). |

**Coverage note:** GLYPH-01 is a two-half requirement and the halves have different natures. Half 1 is a code fix with a mutation-proven gate. Half 2 is a documentation-filing action whose target does not exist. A plan that treats Half 2 as trivial will fail Success Criterion 2, because the criterion says "verifiable by reading that RCA" and there is currently nothing to read.
</phase_requirements>

## Summary

Phase 243 is two jobs wearing one requirement ID, and they have very different risk profiles.

**Job 1 (V-1, the code fix) is genuinely small and the fix site is exact.** `lib/statusline/cockpit-renderer.cjs:347-350` contains a four-line branch that, when the natural voice-glyph detection returns null, substitutes the active stance's default De Stijl color as the glyph. Because nothing anywhere in the repo writes `~/.mindrian/voice-mark.json`, natural detection is provably null on every production turn, so this branch is not a rare fallback: it is the ONLY thing that ever paints a glyph on a live statusline. I reproduced it in one command in this session. The fix is to remove or gate that branch. The complication is not the code, it is that two currently-green test files assert this exact behavior as a deliberate "PRESERVE FLOOR" from Phase 210 item B. Phase 243 therefore supersedes a prior navigator-directed decision, and the plan must say so out loud rather than quietly deleting a locked contract test.

**Job 2 (V-2/V-3 routing) is blocked on a document that does not exist.** `.planning/debug/voice-signature-dark-runtime.md` is cited by six separate documents in this repo as the "still-open existing RCA," and it is not on disk, not in `.planning/debug/resolved/`, and has never existed in git history. It is a phantom: Phase 182.1 wrote "RCA: .planning/debug/voice-signature-dark-runtime.md" into its CONTEXT, SUMMARY, the v1.15.0 roadmap, and CANON-PHASE-MAP, and the file was never created. Success Criterion 2 as literally written ("no new RCA file created") cannot be satisfied, and the plan must choose and state a resolution rather than discovering this at execution time.

**The trap this phase must not walk into.** Phase 182.1 exists because a green test certified a dark feature. If Phase 243 removes the fabricated glyph and stops there, the production statusline will show NO voice glyph, ever, forever, while a shiny new fixture suite goes green on synthetic data. That is byte-for-byte the same failure shape, one level up. The honest empty state is the correct output, but the fact that it is now permanent until a session-keyed writer lands is a load-bearing residual that must be written into the RCA, not left implied.

**Primary recommendation:** Delete the stance-default-glyph branch at `cockpit-renderer.cjs:347-350`, invert the three assertions in `tests/test-voice-glyph-advisory.cjs` (leg 3) and `tests/test-192-statusline-stance-chip.cjs` (cases b and c) from "preserve floor" to "must not reproduce," add a fixture suite covering all five De Stijl glyphs plus the no-glyph honest-empty case with a mutation gate, and CREATE `.planning/debug/voice-signature-dark-runtime.md` as the RCA the repo has been citing since 2026-06-28, carrying V-1 as resolved-history, V-2 and V-3 as open cross-referenced sub-findings, and the post-243 permanent-dark residual as a named open item. Leave the `who: 'larry'` default alone in this phase and file it in the same RCA as a fourth sub-finding.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classifying a turn's text into one of 5 De Stijl colors | Pure library (`lib/hmi/voice-color-mark.cjs`) | - | Frozen deterministic classifier, no I/O. Explicitly OUT of scope (V-4 territory). Must stay byte-identical. |
| Reading the voice-mark side-channel from disk | Signal collector (`lib/statusline/cockpit-signals.cjs` `readVoiceGlyph`) | - | Verified correct: reads `~/.mindrian/voice-mark.json`, degrades to null when absent. NOT the defect. |
| Deciding WHICH glyph appears on the line | Renderer (`lib/statusline/cockpit-renderer.cjs` `_render`) | - | This is where fabrication happens (lines 347-350). The ONLY tier Phase 243 needs to change for SC1. |
| Deciding WHO is speaking (larry vs claude) | Host adapter (`scripts/context-monitor:636`) | Signal collector (`cockpit-signals.cjs:285` re-asserts the same default) | Two tiers independently default to `larry`. See Finding F4 - a separate defect, recommended OUT of 243's code scope. |
| Writing the voice-mark side-channel | **NO TIER OWNS THIS** | - | Zero writers exist repo-wide. This absence IS V-2/V-3's root cause. Assigning this tier is the deferred design work. |
| Statusline process orchestration | `scripts/statusline-mos` | - | Verified: resolves WHICH `context-monitor` to exec. Contains no `who`/glyph logic. Zero overlap with 243. |

## Critical Findings

### F1 [HIGH, VERIFIED] The target RCA file does not exist and never has

Three independent verifications in this session, all against the working tree at `d7e8d00d`:

```bash
git log --all --oneline -- .planning/debug/voice-signature-dark-runtime.md   # no output
find . -name "voice-signature*" -not -path "./node_modules/*"                # no output
ls .planning/debug/ .planning/debug/resolved/                                # file absent from both
```

Six documents cite it as if it exists [VERIFIED: grep across `.planning/`, `docs/`, `lib/`, `scripts/`]:

| Document | Line | What it claims |
|----------|------|----------------|
| `.planning/REQUIREMENTS.md` | 52 | "the existing open `voice-signature-dark-runtime.md` RCA" |
| `.planning/ROADMAP.md` | 128 | "routed into the existing open ... RCA ... (no new RCA file created)" |
| `.planning/phases/182.1-signal-voice-glyph-repair/182.1-CONTEXT.md` | 26 | "RCA: `.planning/debug/voice-signature-dark-runtime.md`" |
| `.planning/phases/182.1-signal-voice-glyph-repair/182.1-SUMMARY.md` | 21 | same |
| `.planning/milestones/v1.15.0-ROADMAP.md` | 3945 | same |
| `docs/CANON-PHASE-MAP.md` | 373 | same |

**Root cause:** Phase 182.1 ran in `execution_mode: inline` (per its own SUMMARY frontmatter: "no separate PLAN.md files"). The RCA citation was written into four artifacts as a forward reference and the file itself was never authored. The audit that produced V-1/V-2/V-3 then read those citations and concluded the RCA was "still open," which is how the phantom propagated into REQUIREMENTS.md and ROADMAP.md.

**Decision fork the plan MUST state explicitly (do not let the executor improvise):**

| Option | What it means | Assessment |
|--------|---------------|------------|
| **A (recommended)** | Create `.planning/debug/voice-signature-dark-runtime.md` per `docs/RCA-TEMPLATE.md` (`kind: rca`), carrying V-1 as resolved-history (182.1 fixed the delivery half; 243 fixes the fabrication half), V-2 + V-3 as open cross-referenced sub-findings, and the F5 residual as a named open item. | Satisfies SC2's INTENT (one RCA, cross-referenced entries, readable) and repairs six dangling citations at once. Violates SC2's literal words "no new RCA file created" - so the plan must state that it is reading "no new RCA" as "no SECOND RCA beside the one the repo already names," which is what the audit's rethink verdict actually said ("Findings 2 and 3 belong as additions to the still-open file"). |
| B | Re-point all six citations to a different existing RCA file. | No existing RCA covers voice-signature. Would fabricate a relationship. Reject. |
| C | Amend REQUIREMENTS.md/ROADMAP.md to drop the RCA requirement. | Loses V-2/V-3 entirely. The audit explicitly wanted them recorded. Reject. |

**Hard constraint on the RCA content (per this repo's CLAUDE.md QA/RCA section and the standing no-fabrication rule):** the file must contain only claims verifiable at authoring time. Do NOT invent a `created:` date in June to make the "still-open since 182.1" story tidy, do not attribute quotes to the navigator, and do not write reproduction steps that were never run. State plainly in `Meta` that the file was authored in Phase 243 to back citations that predate it. The Source-of-Truth Preamble is MANDATORY per the template.

### F2 [HIGH, VERIFIED] The fabrication site, reproduced live in one command

`lib/statusline/cockpit-renderer.cjs`, current lines (re-read this session):

```javascript
346:  let voiceGlyph = isLarry ? resolveVoiceGlyph(s) : null;
347:  if (isLarry && !voiceGlyph && voiceMark && typeof s.stance_forced_color === 'string' && s.stance_forced_color) {
348:    const stanceDefaultGlyph = voiceMark.glyphForColor(s.stance_forced_color);
349:    if (stanceDefaultGlyph) voiceGlyph = stanceDefaultGlyph;
350:  }
```

Live reproduction (run in this session, output verbatim):

```bash
node -e "const r=require('./lib/statusline/cockpit-renderer.cjs');
         console.log(JSON.stringify(r.renderCockpit({room:'Demo',next_move:'x'})));
         console.log(JSON.stringify(r.renderCockpit({room:'Demo',next_move:'x',stance:'redteam',stance_forced_color:'red'})));"
# "⬡ · 📂 Demo ✅ · Next: x"
# "⬡ 🟥 · [redteam] · 📂 Demo ✅ · Next: x"
```

The second line carries `🟥` with ZERO natural voice signal in the input state. That is the whole defect, in one line of output. This command is the plan's readiest before/after proof and its mutation probe.

**Why this branch is not a harmless fallback:** `readVoiceGlyph()` at `cockpit-signals.cjs:125-153` is the only production feeder of `voice_glyph`, and it reads `~/.mindrian/voice-mark.json`. I re-confirmed by grep that exactly two files repo-wide reference that path and BOTH are readers (`lib/statusline/cockpit-signals.cjs` lines 129 and 224, and `lib/core/voice-transition-detector.cjs:15` in a comment). Zero writers. Therefore `resolveVoiceGlyph(s)` returns null on 100% of production turns, and lines 347-350 are not the exception path - they are the only path that ever produces a glyph on a real statusline. [VERIFIED: grep, this session]

**The read path itself is correct and must NOT be touched.** `readVoiceGlyph` (signals) and `resolveVoiceGlyph` (renderer, lines 254-278) both correctly accept `voice_glyph` / `voice_color` / `voice_move` / `voice_turn` in precedence order and return null on nothing. Feed them real data and they produce the right glyph. Confirmed by the currently-green leg 2 of `test-voice-glyph-advisory.cjs` (natural yellow beats stance red).

### F3 [HIGH, VERIFIED] Two currently-GREEN tests assert the fabrication as a deliberate preserve floor

This is the single most important planning fact in this document. Baseline run in this session:

```
node tests/test-voice-glyph-advisory.cjs      -> 4 passed, 0 failed (exit 0)
node tests/test-192-statusline-stance-chip.cjs -> PASSED: 27  FAILED: 0
```

Three assertions across two files assert exactly what GLYPH-01 wants removed:

| File | Location | Assertion | Fate under Phase 243 |
|------|----------|-----------|----------------------|
| `tests/test-voice-glyph-advisory.cjs` | leg 3, "PRESERVE FLOOR: with no natural signal the stance color stays the default glyph" | `line.indexOf(RED_GLYPH) !== -1` given `{stance:'redteam', stance_forced_color:'red'}` and no voice signal | Must be INVERTED to `=== -1`. This is the mutation gate SC1 asks for. |
| `tests/test-192-statusline-stance-chip.cjs` | case (b), line 100 | "redteam render must carry the default red square when natural detection is silent" | Must be INVERTED. |
| `tests/test-192-statusline-stance-chip.cjs` | case (c), line 111 | "tell-act render must carry the default blue square when natural detection is silent" | Must be INVERTED. |

These are run by `tests/run-all-210.sh` (lines 46-47, 56-57) and `tests/run-all-192.sh` (lines 100-101, 107-108). Both aggregators go RED the moment lines 347-350 are deleted unless the assertions are updated in the same change.

**The governance point the plan must state, not assume.** These are not stale tests. They encode Phase 210 item B, a navigator-directed softening recorded in `.planning/STATE.md:2964`: *"210-03: voice-glyph precedence flipped at the consumer (cockpit-renderer) - natural detection wins, stance color fills the default."* The renderer's own comment at lines 338-345 cites it. `210-03-PLAN.md:82` specifies it. Phase 243 REVERSES the second half of that decision (natural-detection-wins survives; stance-fills-the-default dies). The plan must record this as a supersession with its reason - the Phase 210 decision was made on the assumption that "natural detection yields nothing" was an occasional state, when in fact it is the permanent state, which converts a reasonable default into a permanent lie. Silently deleting a locked contract test is the exact behavior this milestone exists to stop.

**Assertions that must stay green (preserve floors that are still correct):**
- `test-voice-glyph-advisory.cjs` leg 1 (the `stance-state.cjs` mapping itself is untouched capability - do NOT edit `lib/core/stance-state.cjs`).
- `test-voice-glyph-advisory.cjs` leg 2 (natural detection wins over stance - unchanged, and now trivially true).
- `test-voice-glyph-advisory.cjs` leg 4 and `test-192` case (a) (null stance renders byte-identical to no-stance).
- `test-192` case (d): research/ask keep the natural yellow glyph. Still passes because it supplies `voice_color:'yellow'`.
- `test-192` cases (b)/(c) `[redteam]` / `[tell-act]` CHIP assertions. The chip is a separate segment (line 407-409) and is NOT the defect. Only the glyph half of those cases inverts.

### F4 [HIGH, VERIFIED] The `who: 'larry'` default is a SEPARATE defect from the glyph fabrication

The audit's V-1 headline bundles two things: a fabricated `who` constant AND a fabricated glyph. GLYPH-01's Success Criterion 1 talks only about the glyph. They are different code, different blast radius, and the plan must decide explicitly.

**What `who` actually does today:**

```javascript
// scripts/context-monitor:636
who: (data.agent && typeof data.agent.name === 'string' && !/larry/i.test(data.agent.name)) ? 'claude' : 'larry',
// lib/statusline/cockpit-signals.cjs:285 (re-asserts the same default independently)
who: (typeof o.who === 'string' && o.who.toLowerCase() === 'claude') ? 'claude' : 'larry',
// lib/statusline/cockpit-renderer.cjs:336 (re-asserts a third time)
const isLarry = (typeof s.who === 'string' ? s.who.toLowerCase() : 'larry') !== 'claude';
```

**Authoritative confirmation that `data.agent` is normally absent** [CITED: code.claude.com/docs/en/statusline, read 2026-07-28]: the statusline stdin payload table documents `agent.name` as *"Agent name when running with the `--agent` flag or agent settings configured"*, and the schema notes explicitly say `agent` *"appears only when running with the `--agent` flag or agent settings configured."* In an ordinary session `data.agent` is undefined, so `who` evaluates to `'larry'` unconditionally. The audit's "fabricated constant" characterization is correct, and now confirmed from Claude Code's own documentation rather than inference.

**Why it is nonetheless a DIFFERENT defect from the glyph:** even when `agent.name` IS populated, it names the configured agent, which has nothing to do with whether the turn opened with a De Stijl mark. So `who` is not a degraded voice signal; it is a different signal entirely, wired to the wrong question.

**The doctrinal conflict, verified in three primary sources:**

| Source | Says |
|--------|------|
| `docs/MINDRIAN-CANON.md:661` (Part 12, HARD requirement, navigator-LOCKED 2026-06-25) | "Every Larry turn wears a De Stijl color mark; **a turn with no Larry mark IS the native host speaking**, and that absence is itself legible." |
| `agents/larry-extended.md:48` (always-loaded agent body) | "**A turn with no glyph reads as the raw host, not Larry.**" |
| `lib/core/voice-transition-detector.cjs:43-50` (`deriveWho`) | Implements exactly that: no valid mark -> returns `'claude'`. |
| **vs** `context-monitor:635` + `cockpit-signals.cjs:282-284` (inline comments) | "Default larry -- the conversational surface IS Larry (Part 10)." |

So the codebase contains two incompatible readings of the same question, and the statusline runs the one that contradicts Part 12's constitutional text.

**Recommendation: do NOT change `who` in Phase 243. File it in the RCA as a fourth sub-finding.** Reasoning, stated so the planner can overrule it with eyes open:

- *Blast radius.* Flipping the default to `claude` would, with no writer present, make EVERY statusline on EVERY install permanently render `🤖 Claude` and permanently suppress the `🧠on` Brain chip (`brainOn` at line 337 is gated on `isLarry`). That is honest and also a severe, universally-visible UX regression on a phase whose ROADMAP entry is explicitly justified as "smallest blast radius."
- *Scope.* SC1 is written entirely about glyph rendering. Nothing in SC1 or SC2 requires a `who` change.
- *It is genuinely undecided.* Part 10 ("the conversational surface IS Larry") and Part 12 ("no mark means host") are both canon, and reconciling them is a navigator call, not an executor call. The RCA is the right home for a decision that needs a human.
- *The `who` defect is inert for SC1 anyway.* Because `isLarry` defaults true, the glyph branch is reached; removing lines 347-350 makes the glyph honestly empty regardless of what `who` says.

If the planner disagrees and wants `who` in scope, the plan must add a fourth test-inversion target (`tests/test-statusline-context-aware.cjs` and `tests/test-statusline-cockpit-187.cjs` both pin `who` behavior) and a navigator checkpoint, because it changes what every user sees.

### F5 [HIGH, REASONED FROM VERIFIED FACTS] The post-fix residual that must be written down

After Phase 243 removes lines 347-350, the production statusline will render **no voice glyph, on every turn, on every install, permanently**, until a `voice-mark.json` writer exists. That is the correct honest state and it satisfies SC1. It is also, on its own, indistinguishable from the failure that created Phase 182.1: a green suite certifying a feature that does nothing.

The difference between "honest" and "quietly dead" is entirely whether it is written down. Concretely, the RCA must carry as an OPEN item:

1. The Tier-1 voice glyph is DARK in production after Phase 243, by design, pending the write side.
2. The write side is blocked on V-2's concurrency problem, not on effort: the checkpoint schema in `lib/core/voice-transition-detector.cjs:57-63` (`current_who`, `session_has_switched`, `last_fire_turn`, `turn_index`) and `lib/core/stance-state.cjs` are both HOME-global with no session key, so N concurrent worktree agents would share one file [VERIFIED: read both files this session; `mindrianDir()` in `cockpit-signals.cjs` resolves to `~/.mindrian`, not a per-session or per-room path].
3. `docs/STATUSLINE-CONTRACT.md:219` already names this as open item 1 ("The voice-mark WRITE-side hook ... the shared prerequisite with Phase 182.1"), and `.planning/STATE.md:829` already recorded it as a named debt at Phase 187. The RCA should cite both rather than re-deriving the debt.

**This is also the honest answer to "does SC1's first clause require a writer?"** SC1 says "Across a **fixture set** covering the glyph vocabulary." A fixture set feeds `renderCockpit(state)` directly. No writer is needed to satisfy SC1, and V-2's routing-to-RCA disposition confirms the writer is deliberately out of scope. But a plan that leaves this unstated invites an executor to either (a) build the unsafe writer, or (b) claim the feature works because fixtures pass.

### F6 [HIGH, VERIFIED] Fixture testability is already in place, no harness work needed

`renderCockpit(state)` is a pure function of a plain object, exported at `cockpit-renderer.cjs:419`, alongside `resolveVoiceGlyph` (line 429) and the glyph constants. `voice-color-mark.cjs` exports `MARK_GLYPHS`, `COLOR_GLYPHS`, `glyphForColor`, `glyphForMove`. A fixture suite needs no filesystem, no HOME sandbox, no writer.

The full glyph vocabulary for SC1's "fixture set covering the glyph vocabulary" [VERIFIED: read from `lib/hmi/voice-color-mark.cjs`]:

| Move | Color | Glyph | Codepoint |
|------|-------|-------|-----------|
| building | blue | 🟦 | U+1F7E6 |
| challenging | red | 🟥 | U+1F7E5 |
| contradiction | yellow | 🟨 | U+1F7E8 |
| gate | black | ⬛ | U+2B1B |
| invisibility | white | ⬜ | U+2B1C |

Four input shapes reach the same glyph and all four deserve a fixture row per color (`resolveVoiceGlyph` precedence, lines 254-278): `voice_glyph` (pre-resolved), `voice_color`, `voice_move`, `voice_turn` (raw text through `detectVoiceMark`). Plus the honest-empty cases: no voice field at all; no voice field WITH `stance_forced_color:'red'`; no voice field WITH `stance_forced_color:'blue'`. The last two are the ones that turn red under a mutation restoring lines 347-350.

### F7 [MEDIUM, VERIFIED SCOPE] V-4 exclusions, and one file that must stay byte-frozen

`lib/hmi/voice-color-mark.cjs` is the frozen 5-color classifier. It is NOT in GLYPH-01's scope (V-4 is the only finding that touches it, and V-4 is not named in GLYPH-01). Phase 243 should read from it and change nothing in it. Confirmed it needs no change for SC1: `glyphForColor` / `glyphForMove` / `detectVoiceMark` already do the right thing when fed real data.

The plan should carry an explicit one-line note that V-4 is knowingly out of scope with its reason (REQUIREMENTS.md GLYPH-01 names only V-1/V-2/V-3; the audit's rethink verdict for V-4 was "no RCA, just the batch fix"), so a future reader does not read the omission as an oversight. Note in passing, do not fix: `cockpit-signals.cjs:216` currently claims the schema is "written by the 187.1-02 checkpoint hook," which is false since no such writer exists. If the planner wants a zero-risk freebie, correcting that ONE comment line is defensible because it is a false provenance claim inside a file 243 is already touching - but it is V-4 territory and skipping it is equally defensible.

## Overlap Check (verified, not assumed)

| Phase | Its files | Overlap with 243 |
|-------|-----------|------------------|
| Phase 236 (room.db data-loss) | `lib/core/navigation.cjs`, `lib/core/room-db.cjs`, `lib/core/navigation/*` | **ZERO.** No shared file. 243 touches no SQL, opens no db. |
| Phase 242 (The Moat) | `hsi-to-graph.cjs`, `docs/MOAT-MANDATE.md` | **ZERO.** No shared file. |
| Earlier same-day session | `scripts/statusline-mos`, `~/.claude/statusline-mos` | **ZERO on logic.** Verified by grep: `statusline-mos` contains only a Phase 109-02 focus-glyph (`🎯`) and plugin-root resolution. It `exec`s `scripts/context-monitor` but never touches `who` or the voice glyph. If 243 ends up editing `context-monitor` (only if F4's recommendation is overruled), the plan should re-check that tree for uncommitted drift first - `.planning/STATE.md` records 7 tracked-file drifts from a concurrent statusline session including `scripts/context-monitor`. |

**243's own file list (under the recommended scope):**
- `lib/statusline/cockpit-renderer.cjs` (delete lines 347-350, update the comment block at 338-345)
- `tests/test-voice-glyph-advisory.cjs` (invert leg 3)
- `tests/test-192-statusline-stance-chip.cjs` (invert the glyph half of cases b and c)
- `tests/test-243-*.cjs` (new fixture suite)
- `tests/run-all-243.sh` (new aggregator)
- `.planning/debug/voice-signature-dark-runtime.md` (new, per F1 option A)

## Standard Stack

No new dependencies. This phase is Node built-ins plus existing repo modules, per the CJS-only convention in CLAUDE.md.

| Module | Role in this phase | Change |
|--------|-------------------|--------|
| `lib/statusline/cockpit-renderer.cjs` | The fix site | MODIFY (delete 4 lines + comment) |
| `lib/hmi/voice-color-mark.cjs` | Glyph vocabulary source for fixtures | READ ONLY, stays byte-frozen |
| `lib/statusline/cockpit-signals.cjs` | Read path, verified correct | NO CHANGE (unless F4 overruled) |
| `lib/core/stance-state.cjs` | Stance-to-color mapping, still valid capability | NO CHANGE (leg 1 preserve floor) |
| `node:assert/strict`, `node:path`, `node:fs` | Test harness | Existing convention |

**No `## Package Legitimacy Audit` section is emitted:** this phase installs zero external packages. The slopcheck gate is not applicable. [VERIFIED: no new dependency is required by any recommendation above.]

## Architecture Patterns

### System data flow (current, with the defect marked)

```
Claude Code host
  |
  |-- stdin JSON {model, workspace, context_window, agent?}   [agent absent unless --agent]
  v
scripts/statusline-mos          (resolves WHICH context-monitor to exec; no glyph logic)
  v
scripts/context-monitor:636     rowState.who = 'larry'  <-- FABRICATED CONSTANT (F4, out of scope)
  v
buildCockpitLine() :513
  v
cockpit-signals.collectSignals()
  |-- readVoiceGlyph()  --> reads ~/.mindrian/voice-mark.json --> ALWAYS null (no writer exists)
  |-- readStanceState() --> reads ~/.mindrian/stance-state.json --> {stance, forced_voice_color}
  v
cockpit-renderer.renderCockpit(state) -> _render()
  |-- line 346: voiceGlyph = resolveVoiceGlyph(s)          --> null, always, in production
  |-- lines 347-350: if (!voiceGlyph && stance_forced_color)
  |                    voiceGlyph = glyphForColor(stance)  <== ***THE FABRICATION (V-1)***
  |-- line 400: if (voiceGlyph) identity += ' ' + voiceGlyph
  v
"⬡ 🟥 · [redteam] · 📂 Demo ✅ · Next: x"      <-- a red Larry glyph on an unmarked host turn
```

### Pattern 1: honest-empty over plausible-default

**What:** When a signal's source is absent, render nothing rather than the most likely value.
**Why it is already this repo's pattern:** `cockpit-renderer.cjs:328-331` carries navigator Ruling 3c verbatim: *"the honest 'no routed step' placeholder is '--', NEVER the lying word 'continue'. A dim '--' reads as 'nothing is routed yet'; 'continue' pretended a live cue existed when it did not."* Phase 243 is the same ruling applied to the glyph. The plan should cite Ruling 3c as the in-repo precedent rather than arguing the principle from scratch - it is the strongest available justification for superseding Phase 210 item B.
**How the glyph expresses it:** the renderer already omits the glyph entirely when `voiceGlyph` is falsy (line 400 is a bare `if`). No new "unknown" placeholder needs inventing; deleting 347-350 IS the honest-empty state.

### Pattern 2: mutation-proven gate (the milestone's rigor standard)

Every v1.16.0 success criterion demands "a mutation ... turns the gate red." The in-repo model is `tests/run-all-233.sh`, which runs a NEGATIVE SELF-TEST before trusting its own grep. For 243 the mutation is precise and cheap: restore lines 347-350, and the honest-empty fixtures must go red. The plan should specify the mutation as an exact patch so the executor proves it by running, not by reasoning.

### Pattern 3: glob-discovering phase aggregator

`tests/run-all-243.sh` should follow `tests/run-all-233.sh`'s pattern (verified by reading it this session): glob-discover `tests/test-243-*.cjs` and `tests/test-243-*.sh` so later plans add coverage without editing the harness, hard-fail when zero tests are discovered, and end with `[ "$FAIL" -eq 0 ]`. `tests/run-all-210.sh`'s `run_if` guard idiom (skip cleanly on a missing file) is the alternative for legs that reference files landing in a later wave.

A Part 8 egress sweep leg is conventional in recent aggregators. For 243 it is nearly vacuous (the touched files are pure local rendering), but including it costs nothing and matches the house pattern. If included, use the self-testing form from `run-all-233.sh` so the gate proves it still bites.

### Anti-patterns to avoid

- **Deleting the Phase 210 assertions instead of inverting them.** An inverted assertion ("the stance color must NOT appear when natural detection is silent") IS the mutation gate SC1 requires. A deleted assertion proves nothing and erases the record of what changed.
- **Editing `lib/core/stance-state.cjs`.** The stance-to-color mapping is untouched capability and leg 1 preserves it. The defect is in the CONSUMER, not the producer. Phase 210-03 made this same call deliberately.
- **Reaching for the writer.** Building `voice-mark.json` writes without session keying is precisely V-2's documented hazard.
- **Writing the RCA as if it existed since June.** Fabricated dates or attributions in an RCA are a truth-claim violation under CLAUDE.md's QA/RCA rule.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Mapping a color name to its glyph in fixtures | A local `{red:'🟥'}` literal | `voiceMark.glyphForColor(color)` / `COLOR_GLYPHS` | A hard-coded literal in the test cannot detect a re-pointed palette; the existing tests already import the module for exactly this reason. |
| Deciding whether a turn text carries a mark | A regex in the test | `voiceMark.detectVoiceMark(text)` | Frozen classifier with spoof-fence semantics; a test regex would diverge. |
| A phase test runner | A bespoke script | Copy `tests/run-all-233.sh`'s glob-discovery skeleton | 40+ existing aggregators share this shape; divergence costs review time. |
| An RCA document format | Improvised bug report | `docs/RCA-TEMPLATE.md` + read `.planning/debug/resolved/hedge-fold-has-no-production-trigger.md` as the worked example | CLAUDE.md mandates the template; hedge-fold is the audit's own named model for this finding's shape and is the closest analog (a fully-built layer with no production trigger). |

**Key insight:** every primitive this phase needs already exists and is already tested. The only genuinely new artifact is the RCA file, and even that has a template and a named model.

## Common Pitfalls

### Pitfall 1: Deleting lines 347-350 and shipping with two red aggregators
**What goes wrong:** `run-all-210.sh` and `run-all-192.sh` go red, and the failure looks like a regression rather than an intended supersession.
**Why it happens:** the conflicting assertions live in files named for OTHER phases (192, 210), so a 243-scoped grep for "voice glyph" in `tests/test-243-*` finds nothing.
**How to avoid:** the code change and the three assertion inversions land in the SAME task. Run `bash tests/run-all-192.sh` and `bash tests/run-all-210.sh` as explicit verification legs, not just `run-all-243.sh`.
**Warning sign:** a plan whose file list contains `cockpit-renderer.cjs` but not `test-192-statusline-stance-chip.cjs`.

### Pitfall 2: Satisfying SC2 by writing a paragraph into some other document
**What goes wrong:** SC2 says "verifiable by reading that RCA." A note in the phase SUMMARY, or a line in `knowledge-base.md`, does not satisfy it.
**How to avoid:** resolve F1's fork in the plan, in writing, before any task runs.
**Warning sign:** a plan task worded "route V-2/V-3 into the existing RCA" with no task that creates or locates the file.

### Pitfall 3: Certifying a dark feature (the 182.1 repeat)
**What goes wrong:** fixtures go green on synthetic glyph data; production shows no glyph forever; nobody records that.
**How to avoid:** F5's residual is a mandatory OPEN item in the RCA, and the phase SUMMARY says plainly that the Tier-1 glyph is dark in production by design pending the write side.
**Warning sign:** a SUMMARY that says "the voice glyph now reflects the actual turn" without the qualifier "in fixtures; production is dark pending the writer."

### Pitfall 4: Trusting the audit's line numbers
**What goes wrong:** an edit lands at `context-monitor:649` (audit) instead of `:636` (live), or at renderer `:347-349` instead of `:347-350`.
**How to avoid:** every task locates its edit by symbol or by an exact quoted string, never by line number.

### Pitfall 5: Assuming `resolveVoiceGlyph` is broken
**What goes wrong:** effort spent "fixing" the read path, which is correct.
**How to avoid:** leg 2 of `test-voice-glyph-advisory.cjs` is green today and proves natural detection works end to end when fed data. The bug is one branch below it.

### Pitfall 6: Uncommitted drift in `scripts/context-monitor`
**What goes wrong:** `.planning/STATE.md` records 7 tracked-file drifts from a concurrent statusline session, including `scripts/context-monitor`, causing `doctor --acceptance` to report 14/15 with `verify-release-clean-tree` FAILing.
**How to avoid:** check `git status` before starting, and expect that pre-existing failure rather than mis-attributing it to 243. (Under the recommended scope 243 does not touch `context-monitor` at all.)

## Code Examples

### The fix (recommended form)

```javascript
// lib/statusline/cockpit-renderer.cjs, replacing lines 338-350.
// Tier-1 voice glyph. Phase 243 (GLYPH-01) supersedes the second half of Phase 210
// item B: natural voice-mark detection is the ONLY source of the glyph. The stance
// color no longer fills the default when detection is silent, because "silent" is
// not an occasional state - no writer for ~/.mindrian/voice-mark.json exists, so
// detection is silent on every production turn and the stance default was therefore
// painting a Larry glyph over turns that carried no mark at all (audit finding V-1).
// Honest-empty over plausible-default, the same rule as Ruling 3c's "--" for Next:.
// The stance still shows as its own [stance] chip; only the fabricated glyph is gone.
// The stance->color mapping in lib/core/stance-state.cjs is UNCHANGED capability.
const voiceGlyph = isLarry ? resolveVoiceGlyph(s) : null;
```

### The fixture suite shape

```javascript
// tests/test-243-voice-glyph-honest.cjs (sketch)
const assert = require('node:assert/strict');
const renderer = require('../lib/statusline/cockpit-renderer.cjs');
const voiceMark = require('../lib/hmi/voice-color-mark.cjs');

const base = () => ({ who: 'larry', room: 'Demo', ctx_pct: 10, next_move: 'x' });

// (1) Every glyph in the vocabulary, through every input shape.
for (const [move, color] of Object.entries(voiceMark.VOICE_COLOR_MARKS)) {
  const glyph = voiceMark.glyphForColor(color);
  for (const shape of [{ voice_glyph: glyph }, { voice_color: color }, { voice_move: move }]) {
    const line = renderer.renderCockpit(Object.assign(base(), shape));
    assert.ok(line.includes(glyph), move + ' via ' + Object.keys(shape)[0] + ' renders ' + glyph);
  }
}

// (2) The honest empty state, WITH a stance active. These are the mutation-gate rows:
//     restoring cockpit-renderer.cjs lines 347-350 turns exactly these red.
for (const [stance, forced] of [['redteam', 'red'], ['tell-act', 'blue']]) {
  const line = renderer.renderCockpit(Object.assign(base(), { stance, stance_forced_color: forced }));
  for (const g of Object.values(voiceMark.COLOR_GLYPHS)) {
    assert.ok(!line.includes(g), stance + ' with no voice mark renders NO glyph (got: ' + line + ')');
  }
  assert.ok(line.includes('[' + stance + ']'), 'the [' + stance + '] chip still renders (unchanged)');
}
```

### Reproducing V-1 before the fix (the plan's before/after evidence)

```bash
node -e "const r=require('./lib/statusline/cockpit-renderer.cjs');
         console.log(r.renderCockpit({room:'Demo',next_move:'x',stance:'redteam',stance_forced_color:'red'}));"
# BEFORE: ⬡ 🟥 · [redteam] · 📂 Demo ✅ · Next: x
# AFTER:  ⬡ · [redteam] · 📂 Demo ✅ · Next: x
```

## Runtime State Inventory

Phase 243 is a rendering fix, not a rename or migration, but the defect is entangled with HOME-global runtime state, so the categories are answered explicitly.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | `~/.mindrian/voice-mark.json` - the file the whole feature reads. **Never written by anything.** Verified: exactly two references repo-wide (`cockpit-signals.cjs:129,224`; `voice-transition-detector.cjs:15` in a comment), both readers. | None for 243. Its absence is the RCA's subject (V-2/V-3). |
| Live service config | `~/.mindrian/stance-state.json` - written by the `/mos:stance` command via `lib/core/stance-state.cjs`. A navigator with a stance set today is seeing the fabricated glyph right now; after 243 they see the `[stance]` chip only. | None. No migration; the file's schema is unchanged. Worth one line in the phase SUMMARY as a user-visible behavior change. |
| OS-registered state | None. Verified: no scheduled task, pm2 process, or launchd unit references the voice glyph. | None. |
| Secrets / env vars | None. No env var gates the voice glyph. Verified by grep. | None. |
| Build artifacts | The plugin install cache `~/.claude/plugins/mindrian-os/` carries the old renderer until a release ships. Per the standing rule (`feedback_dev_repo_fix_not_live_until_released`), this fix is NOT live for the navigator's own running session after commit, and not after a release either until the session picks it up. | Do not claim the statusline is fixed based on a commit. v1.16.0 work ships as `v1.16.0-beta.N` and only after Gate 0 (the stable v1.15.0 close-out) per ROADMAP.md's release train. |

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. [VERIFIED: read this session]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None. Hand-rolled CJS assertion scripts using `node:assert/strict`, per the CJS-only convention. Each test is a standalone `node tests/test-*.cjs` that exits non-zero on failure. |
| Config file | None. Phase aggregators are `tests/run-all-<phase>.sh`. |
| Quick run command | `node tests/test-243-voice-glyph-honest.cjs` |
| Full suite command | `bash tests/run-all-243.sh` |
| Regression legs (mandatory) | `bash tests/run-all-192.sh` and `bash tests/run-all-210.sh` - these carry the three assertions being inverted and MUST be green at the end. |

### Phase Requirements to Test Map

| Req | Behavior | Test type | Automated command | Exists? |
|-----|----------|-----------|-------------------|---------|
| GLYPH-01 (SC1a) | Each of the 5 De Stijl glyphs renders when supplied via `voice_glyph` / `voice_color` / `voice_move` | unit/fixture | `node tests/test-243-voice-glyph-honest.cjs` | Wave 0 |
| GLYPH-01 (SC1b) | A turn with no mark and an active stance renders NO glyph | unit/fixture | same | Wave 0 |
| GLYPH-01 (SC1c) | Restoring `cockpit-renderer.cjs:347-350` turns SC1b red | mutation | manual patch + rerun, recorded in the plan as an exact diff | Wave 0 |
| GLYPH-01 (SC1d) | The `[stance]` chip and the null-stance byte-stability floor survive | regression | `bash tests/run-all-192.sh` | Exists |
| GLYPH-01 (SC1e) | Natural detection still beats the stance preference (leg 2 floor) | regression | `bash tests/run-all-210.sh` | Exists |
| GLYPH-01 (SC2) | The RCA exists, is `kind: rca`, is not `resolved`, and contains cross-referenced V-2 and V-3 entries | doc-presence | `node tests/test-243-rca-routing.cjs` (grep the RCA for the V-2/V-3 headings + frontmatter fields) | Wave 0 |

**On testing SC2:** a doc-presence test is the honest instrument here and this repo already uses that idiom (`tests/test-stance-voice-glyph-override.cjs` is explicitly "a DOCUMENTATION-presence test"). It should assert structure (frontmatter `kind: rca`, `status` not `resolved`, headings for V-2 and V-3, a citation back to REQUIREMENTS.md GLYPH-01) and NOT assert prose wording, which would ossify the document.

### Sampling rate

- **Per task commit:** `node tests/test-243-*.cjs`
- **Per wave merge:** `bash tests/run-all-243.sh` plus `bash tests/run-all-192.sh` plus `bash tests/run-all-210.sh`
- **Phase gate:** the above all green, plus `node scripts/build-connector-registry.cjs --check` (the phase adds no invocable surface, so the ledger must be unchanged at 177 wired / 69 excluded / 0 gap; a diff there means something unintended was added)

### Wave 0 gaps

- [ ] `tests/test-243-voice-glyph-honest.cjs` - covers SC1a/SC1b/SC1c
- [ ] `tests/test-243-rca-routing.cjs` - covers SC2
- [ ] `tests/run-all-243.sh` - glob-discovering aggregator, modeled on `run-all-233.sh`
- [ ] No framework install needed

## Project Constraints (from CLAUDE.md)

| Directive | How it binds Phase 243 |
|-----------|------------------------|
| **No em-dashes anywhere, hyphens only** | Applies to code comments, tests, the RCA, and the plan. `docs/RCA-TEMPLATE.md` restates it as a hard rule for RCA files specifically. `tests/test-192-statusline-stance-chip.cjs` case (g) already asserts no em-dash in any rendered stance line - it will catch a violation in the renderer. |
| **Canon Part 8 (Brain boundary)** | Trivially satisfied: every file touched is pure local rendering with zero network. Include the Part 8 sweep leg anyway to match house convention. |
| **Canon Part 12 (Pedagogy / Voice Signature)** | This phase IS Part 12 enforcement. The canon text at `MINDRIAN-CANON.md:661` is the authority for F4's doctrinal conflict. No canon amendment is needed - 243 is an APPLICATION of Part 12, same as 182.1 was. |
| **Canon Part 11 (CIRS)** | 243 adds no invocable surface, mints no reach/edge/node, opens no Brain wire. `cirs_relationship` in any phase frontmatter should declare `surfaces_touched: [modified]`, `spine_consumed: none`. |
| **Canon Part 7 (reuse before build)** | Every primitive exists (F6, Don't Hand-Roll). The only net-new artifact is the RCA file, and it has a template. |
| **QA/RCA reporting standard** | The RCA goes to `.planning/debug/voice-signature-dark-runtime.md`, `kind: rca`, with the MANDATORY Source-of-Truth Preamble. `.planning/` is gitignored, so commit with `git add -f`. Do NOT move it to `resolved/` - V-2 and V-3 stay open. |
| **Dev-Research Compositing (Rethinking Room)** | This phase touches MindrianOS's own architecture, so findings file in BOTH the phase artifacts AND `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked. The F1 phantom-RCA finding in particular is a durable process lesson (a forward-referenced artifact that was never authored, propagating into four downstream documents) and belongs in the room's reasoning trail, not only in this phase folder. |
| **GSD workflow enforcement** | No direct edits outside a GSD command. |
| **Release lockstep** | 243's fix is not live until a release ships and is picked up. v1.16.0 work ships as `v1.16.0-beta.N`, and no v1.16.0 cut happens before ROADMAP Gate 0 (the stable v1.15.0 close-out). |
| **Tri-Polar (three surfaces)** | The statusline is CLI-only. Desktop and Cowork have no statusline, so the glyph fix is a deliberate CLI-scoped change - state it as a deliberate call, not an oversight. Part 12's Voice Signature on Desktop/Cowork rides the turn-text glyph (`agents/larry-extended.md`), which 243 does not touch. |
| **Project skills** | `.claude/skills/` contains `agentshield` only (plus `docu-optimizer` listed in CLAUDE.md). Neither is applicable to a statusline rendering fix. |

## Grounding Sources: deliberate consult decisions

Per CLAUDE.md's mandatory rule to "pick the source(s) that actually cover the claim," recorded as explicit decisions rather than silent omissions:

| Source | Consulted | Reason |
|--------|-----------|--------|
| **claude-code-guide / Claude Code docs** | YES | The `who` derivation reads `data.agent.name` from the Claude Code statusline stdin payload. Whether that field is ever populated is a Claude-Code-internal question no other source can answer authoritatively. Fetched `code.claude.com/docs/en/statusline` and confirmed `agent` "appears only when running with the `--agent` flag or agent settings configured" - which converts the audit's "fabricated constant" from an inference into a documented fact. See F4. |
| **langtalks-graph-expert** | NO | Deliberate. The core fix is a four-line conditional in a local statusline renderer. It is not an agent/LLM engineering concept (no dispatch, memory, RAG, reasoning, guardrail, or MCP protocol question). Forcing a consult where no topic overlap exists is itself a rule violation under the same CLAUDE.md paragraph. |
| **Context7** | NO | Deliberate. No named third-party library, runtime API, or version-floor claim is made. The phase adds no dependency and uses only `node:assert`, `node:fs`, `node:path`, whose behavior is not in question. |
| **WebSearch / general web** | NO beyond the one Claude Code doc | Deliberate. Nothing here is time-sensitive or external. Every other claim is verifiable by reading this repo, and was. |
| **Repo primary sources** | YES, extensively | `docs/MINDRIAN-CANON.md` (Part 12), `agents/larry-extended.md`, `docs/STATUSLINE-CONTRACT.md`, `docs/RCA-TEMPLATE.md`, `.planning/STATE.md`, the Phase 182.1 and 210 artifacts, and the implicated source files, all read directly this session. |

## State of the Art (in-repo history of this defect)

| Phase | What it did | What it left |
|-------|-------------|--------------|
| 182 | Voice Signature as a bracketed color-word `[BLUE]` | Dark at runtime; ANSI/word does not render color on the host |
| 182.1 (2026-06-28) | Moved delivery to emoji glyphs; made `detectVoiceMark` glyph-aware; cited an RCA it never wrote | The write side unbuilt (named debt); the phantom RCA (F1) |
| 187 | The four-tier cockpit statusline; `readVoiceGlyph` reader | Named debt recorded in STATE.md:829: "voice-glyph write-side hook unwired" |
| 187.1 | The pure transition detector + `readVoiceSwitchState` reader | Zero production callers (V-3); `cockpit-signals.cjs:216` claims a writer hook that does not exist |
| 192 / SEED-042 | Stance dial; stance color as a hard OVERRIDE of the glyph | Overrode even confident natural detection |
| 210 item B (2026-07-02) | Softened override to preference: natural detection wins, stance fills the DEFAULT | Because detection is ALWAYS silent, "fills the default" became "always fabricates" - the state V-1 found |
| **243 (this phase)** | Removes the fabrication; routes V-2/V-3 to the RCA | The glyph goes honestly dark in production until a session-keyed writer lands (F5) |

The through-line: each phase fixed the layer it could see and left the write side for later, and each one recorded the debt in a different document. Phase 243's most durable contribution may be consolidating that debt into one readable RCA.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | SC1's "fixture set" means synthetic state fed to `renderCockpit`, not live production turns, so no writer is required | Summary, F5, Validation | If the navigator meant live turns, the phase needs the V-2 writer and is far larger than "smallest blast radius." Confirm at planning. Evidence for the reading: SC1 says "fixture set" explicitly, and V-2's disposition routes the writer to the RCA rather than to build work. |
| A2 | SC2's "no new RCA file created" means "no SECOND RCA," and creating the one the repo already names satisfies its intent | F1 | If read strictly literally, SC2 is unsatisfiable. Needs a navigator ruling if the planner is not comfortable making it. |
| A3 | The `who: 'larry'` default should stay in Phase 243 and be filed, not fixed | F4 | If the navigator considers `who` in scope for GLYPH-01, the plan needs a fourth test-inversion target and a UX checkpoint. The recommendation is reasoned, not user-confirmed. |
| A4 | V-4 stays fully out of scope | F7, User Constraints | Low risk. Grounded in REQUIREMENTS.md's own wording and the audit's rethink verdict, but not user-confirmed. |
| A5 | Inverting (not deleting) the three Phase 210/192 assertions is the right treatment | F3 | Low risk. The inverted assertions ARE the mutation gate SC1 asks for. |

## Open Questions

1. **Does the navigator accept superseding Phase 210 item B?**
   - Known: Phase 210 item B was a navigator-directed softening; its rationale (`STATE.md:2270`) was that v1.15 turned judgment calls into hard rules and made Larry "behave less like Larry."
   - Unclear: whether removing the stance-default glyph reads as a further softening (removing a fabricated signal) or as a re-tightening.
   - Recommendation: frame it as a softening in the plan, because 243 removes a signal the system asserts without evidence. That is the same direction 210 was travelling. Surface it at a checkpoint if the planner wants certainty.

2. **Is a permanently glyph-less statusline acceptable as the shipped state?**
   - Known: it is the honest state and satisfies SC1.
   - Unclear: whether the navigator, on seeing the glyph disappear from their own statusline, will read it as a regression.
   - Recommendation: name it in the plan, the SUMMARY, and the RCA. Consider a one-line CHANGELOG entry saying the glyph now appears only when a real mark is detected. Do NOT invent a placeholder glyph to fill the gap - that recreates the defect.

3. **Should Phase 243 also correct the false provenance comment at `cockpit-signals.cjs:216`?**
   - Known: it claims a "187.1-02 checkpoint hook" writer exists; no such writer exists. It is V-4, which is out of GLYPH-01's scope.
   - Recommendation: leave it, and name it in the RCA as part of the write-side finding, so the false claim is recorded even though the comment is not edited. Editing one comment line in a file 243 already touches is also defensible; either is fine as long as the plan states which.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | every test and the renderer | yes | project floor `>=22.5.0` (`package.json`) | none needed |
| bash | `tests/run-all-243.sh` | yes | - | none needed |
| git | `git add -f` for the gitignored `.planning/` RCA | yes | - | none needed |
| Network / Brain | nothing in this phase | not required | - | - |

No missing dependencies, blocking or otherwise.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS categories

| Category | Applies | Control |
|----------|---------|---------|
| V2 Authentication | no | No auth surface. |
| V3 Session management | no | No sessions. (Note: the ABSENCE of session keying in the HOME-global voice-mark/stance-state files is a correctness and multi-tenancy concern, documented as V-2 in the RCA, not an ASVS session-management control.) |
| V4 Access control | no | No access decisions. |
| V5 Input validation | yes (already satisfied) | `resolveVoiceGlyph` validates every input against the frozen `MARK_GLYPHS` map via `hasOwnProperty` before use, and `glyphForColor` returns null for anything not in `COLOR_GLYPHS`. `readVoiceGlyph` wraps `JSON.parse` in try/catch and type-checks every field. Removing lines 347-350 removes an input path; it adds none. |
| V6 Cryptography | no | None involved. |

### Threat patterns for this stack

| Pattern | STRIDE | Mitigation status |
|---------|--------|-------------------|
| Voice-mark spoofing (a non-Larry turn opening with a De Stijl glyph to impersonate Larry) | Spoofing | Partially mitigated by `NON_DESTIJL_GLYPHS` in the frozen classifier. Gaps are V-4, out of scope. Phase 243 does not widen the surface. |
| Fabricated identity signal (the system itself asserting "this is Larry" without evidence) | Spoofing (self-inflicted) | **This IS V-1, and Phase 243 is the mitigation.** The statusline currently makes an unevidenced identity claim to the navigator; removing lines 347-350 stops it. |
| Untrusted JSON from `~/.mindrian/voice-mark.json` | Tampering | Already mitigated: try/catch parse, per-field type checks, allow-list glyph lookup. Unchanged by 243. |

## Sources

### Primary (HIGH confidence, read directly this session)

- `lib/statusline/cockpit-renderer.cjs` (lines 244-278, 292-350, 397-416, 418-445)
- `lib/statusline/cockpit-signals.cjs` (lines 119-153, 199-237, 239-300)
- `lib/hmi/voice-color-mark.cjs` (header doctrine, `VOICE_COLOR_MARKS`, `MARK_GLYPHS`, `COLOR_GLYPHS`, `glyphForColor`, `glyphForMove`, exports)
- `lib/core/voice-transition-detector.cjs` (lines 1-80, esp. `deriveWho`)
- `lib/core/stance-state.cjs` (lines 52-69, 134-138)
- `scripts/context-monitor` (lines 475-476, 513-530, 613-640)
- `scripts/statusline-mos` (grep for who/glyph: none found)
- `docs/MINDRIAN-CANON.md` lines 655-700 (Part 12, The Voice Signature)
- `agents/larry-extended.md` lines 46-56 (Voice Signature doctrine)
- `docs/STATUSLINE-CONTRACT.md` lines 110-160, 210-240
- `docs/RCA-TEMPLATE.md` (sections 1, 2, 2.5, 3)
- `.planning/debug/resolved/hedge-fold-has-no-production-trigger.md` (the named model RCA)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (lines 824-834, 2270, 2964-2965), `.planning/config.json`
- `.planning/phases/182.1-signal-voice-glyph-repair/` (CONTEXT + SUMMARY)
- `.planning/phases/210-.../210-03-PLAN.md`, `210-PATTERNS.md`, `210-RESEARCH.md`
- `tests/test-voice-glyph-advisory.cjs`, `tests/test-192-statusline-stance-chip.cjs`, `tests/test-stance-voice-glyph-override.cjs`, `tests/test-voice-transition-detection-187.cjs`, `tests/run-all-210.sh`, `tests/run-all-192.sh`, `tests/run-all-233.sh`
- Live command output: `node -e "...renderCockpit(...)"` (F2), `node tests/test-voice-glyph-advisory.cjs` (F3 baseline), `node tests/test-192-statusline-stance-chip.cjs` (F3 baseline), `git log --all -- .planning/debug/voice-signature-dark-runtime.md` (F1)

### Primary external (HIGH confidence)

- [CITED: code.claude.com/docs/en/statusline] - the statusline stdin JSON schema and the `agent.name` availability note. Used only for F4.

### Secondary (MEDIUM confidence)

- `/tmp/claude-1000/-home-jsagi/c4225fce-73ca-43dc-90bc-1665bbeb7983/infra-scrutiny-consolidated.md` section 2.9 - the source audit for V-1..V-4. Every code claim it makes was independently re-verified above; its line numbers were found to have drifted.

### Not consulted (with reasons)

- langtalks-graph-expert, Context7, general WebSearch. See the "Grounding Sources: deliberate consult decisions" table.

## Metadata

**Confidence breakdown:**
- Missing RCA (F1): HIGH - three independent verification commands, six citing documents enumerated.
- Fabrication site (F2): HIGH - reproduced live, exact current line numbers.
- Test conflict (F3): HIGH - both suites executed in this session, baseline recorded, exact assertions located.
- `who` default (F4): HIGH on the facts (three primary sources plus Claude Code's own docs); MEDIUM on the recommendation, which is a scope judgment the navigator may overrule.
- Residual (F5): HIGH on the mechanism (zero writers verified by grep); the framing as "must be written down" is a reasoned position.
- Fixture testability (F6): HIGH - exports read, existing tests already do this.
- Standard stack: HIGH - no new dependencies, nothing to verify against a registry.

**Research date:** 2026-07-28
**Valid until:** 2026-08-27 for the code findings (they will drift if any other phase edits the statusline; re-grep by symbol). The F1 missing-RCA finding is valid until Phase 243 itself resolves it.
