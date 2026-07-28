---
status: investigating
kind: rca
slug: voice-signature-dark-runtime
trigger: "voice-signature-dark-runtime"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: [12]
created: 2026-07-28T00:00:00Z
updated: 2026-07-28T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` lineage, dev workspace `/home/jsagi/dev/MindrianOS-Plugin` (worktree `agent-a1f72a6ff4a313578` at `/home/jsagi/dev/MindrianOS-Plugin/.claude/worktrees/agent-a1f72a6ff4a313578`), HEAD `879db83f` at the moment this file was authored (Phase 243 plan 02, Task 1's own commit, immediately preceding this filing). Every fact below was either re-verified live at authoring time or transcribed verbatim from `243-RESEARCH.md`'s own live-verified findings (Findings F1, F2, F4, F5, F7 and the State of the Art table), per this plan's no-fabrication constraint.
- **WIRE claims probe against:** none. This is a pure LOCAL rendering finding. No Brain call, no network probe, no deployed server is involved anywhere in this file.
- **Date of audit:** 2026-07-28
- **Re-verification rule:** every source claim below either carries its own re-run command with its live output (see Evidence), or is cited directly to `243-RESEARCH.md` as the record of a command that was run live in that research session. No claim in this file traces to anything other than those two sources.

## Current Focus

hypothesis: the write side of the voice-mark side-channel (`~/.mindrian/voice-mark.json`) has never been built, so `resolveVoiceGlyph` returns null on every production turn; Phase 243 removed the fabrication that used to paint over that null, and the honest result is a permanently dark Tier-1 voice glyph until a session-keyed writer lands.
test: grep for every writer of `~/.mindrian/voice-mark.json` repo-wide and cross-check against the concurrency hazard in the checkpoint schema (`current_who`, `session_has_switched`, `last_fire_turn`, `turn_index`) and `stance-state.cjs`, both HOME-global with no session key.
expecting: zero writers found, and both schemas confirmed HOME-global (`mindrianDir()` resolves to `~/.mindrian`, not a per-session or per-room path).
next_action: this file is filed for a navigator ruling on the `who: 'larry'` default (Part 10 vs Part 12) and for a future phase to design the session-keyed writer. No further action is required of Phase 243 itself.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51
- Reported by: Phase 243 (voice-glyph), authored during plan 02
- Date first observed: this file did not exist before 2026-07-28. It is authored on 2026-07-28 during Phase 243 to back six citations that predate it by roughly a month. The underlying defect it documents is older (Phase 182, 2026-06-xx) but this FILE is not. Do not read `created: 2026-07-28` as backdating; it is the true authoring date.
- How the phantom happened: Phase 182.1 (2026-06-28) ran in `execution_mode: inline` (per its own SUMMARY frontmatter: "no separate PLAN.md files") and wrote the citation `.planning/debug/voice-signature-dark-runtime.md` into four artifacts as a forward reference, then never authored the file. A later audit read those citations, concluded the RCA was "still open," and propagated the phantom into `REQUIREMENTS.md` and `ROADMAP.md`. Verified three ways at this filing's authoring time (all re-run live, not copied from the earlier research session):
  - `git log --all --oneline -- .planning/debug/voice-signature-dark-runtime.md` -> no output.
  - `find . -name "voice-signature*" -not -path "./node_modules/*"` -> no output.
  - `ls .planning/debug/ .planning/debug/resolved/ | grep -i voice-signature` -> no match (grep exit 1).
- Related debug sessions: none pre-existing (the file did not exist). Sibling context: `.planning/phases/243-voice-glyph/243-RESEARCH.md` Finding F1 (the six-citation phantom), Finding F5 (the post-fix residual), and `.planning/phases/243-voice-glyph/243-01-SUMMARY.md` (V-1's resolution).

## Problem Statement

The Voice Signature (Canon Part 12, Tier 1) has been dark at runtime since Phase 182: nothing in shipped production code ever writes `~/.mindrian/voice-mark.json`, so natural voice-mark detection returns null on every real turn. Prior phases papered over that silence with a fabricated default glyph (V-1, resolved by this phase) rather than showing the darkness honestly, and this file is the first place that reads-in-one-document what five separate phases each recorded piecemeal.

## Symptoms

expected: a navigator's statusline shows the De Stijl glyph (blue/red/yellow/black/white) that the actual turn opened with, or shows nothing when no natural signal exists.
actual (pre-243): with no natural voice signal and an active stance, the statusline rendered the stance's default color as if it were a real Voice Signature mark (`⬡ 🟥 · [redteam] · Demo ✅ · Next: x` with zero natural voice signal in the input state).
actual (post-243, the honest state, this file's own residual finding): the statusline renders NO glyph at all, on every turn, on every install, permanently, because natural detection never receives real data (no writer exists).
errors: none, in either state. There is no error to observe. That is the whole difficulty of this class of defect (see the hedge-fold RCA's same framing): a fabricated glyph looks exactly like a working feature, and a permanently dark glyph looks exactly like a clean pass on synthetic fixture data. Neither state throws or logs anything.
reproduction (RESEARCH.md Finding F2, verbatim, re-usable and re-run live in this session):
  1. `node -e "const r=require('./lib/statusline/cockpit-renderer.cjs'); console.log(JSON.stringify(r.renderCockpit({room:'Demo',next_move:'x'})));"` -> `"⬡ · 📂 Demo ✅ · Next: x"` (no stance, no glyph, unaffected either way).
  2. `node -e "const r=require('./lib/statusline/cockpit-renderer.cjs'); console.log(JSON.stringify(r.renderCockpit({room:'Demo',next_move:'x',stance:'redteam',stance_forced_color:'red'})));"` -> BEFORE Phase 243: `"⬡ 🟥 · [redteam] · 📂 Demo ✅ · Next: x"` (the fabrication, V-1). AFTER Phase 243 (243-01-SUMMARY.md, re-run in that plan's own session): `"⬡ · [redteam] · 📂 Demo ✅ · Next: x"` (the fabricated red square is gone; the `[redteam]` chip stays; this is the correct honest state, and it is also permanent until a writer exists).
started: the defect chain starts at Phase 182 (bracketed-word delivery, dark at runtime). The specific fabrication V-1 fixed by this phase was introduced at Phase 210 item B (2026-07-02). The specific phantom-RCA problem this file resolves was introduced at Phase 182.1 (2026-06-28).

## Scope and Impact

- Affected surfaces: cli. The statusline is CLI-only; Desktop and Cowork have no statusline, and Part 12's Voice Signature rides the turn-text glyph there instead (`agents/larry-extended.md`), untouched by this finding.
- Affected commands: the statusline pipeline (`scripts/statusline-mos` -> `scripts/context-monitor` -> `cockpit-signals` -> `cockpit-renderer`) and `/mos:stance`.
- Affected users: all installs.
- Version range: since the Phase 182 landing through `1.15.3-beta.51` (last checked at authoring time) and continuing forward until a session-keyed writer lands.
- Severity: medium. Nothing crashes and no ranking or navigation decision is affected; the cost is an inert-by-design Tier 1 signal that, if left unrecorded, is indistinguishable from a genuinely working feature to anyone reading only test output.
- Blast radius: confined to the Tier-1 voice glyph segment of the statusline render. The `[stance]` chip segment, the room/health segment, and the Brain chip are all separate segments and are not implicated.

## Eliminated

- hypothesis: "the read path (`readVoiceGlyph` / `resolveVoiceGlyph`) is broken and that is why the glyph is dark."
  evidence: RESEARCH.md Finding F2 confirms both are correct: they accept `voice_glyph` / `voice_color` / `voice_move` / `voice_turn` in precedence order and return null on nothing; leg 2 of `tests/test-voice-glyph-advisory.cjs` (green both before and after this phase) proves natural detection works end to end when fed real data. The bug was never in the read path.
  timestamp: 2026-07-28T00:00:00Z

## Evidence

- timestamp: 2026-07-28T00:00:00Z
  checked: `git log --all --oneline -- .planning/debug/voice-signature-dark-runtime.md` (re-run live at this file's own authoring time, immediately before creating it)
  found: no output.
  implication: this file genuinely did not exist in this repo's history before this commit. Confirms F1's phantom-citation finding one more time, at the moment of resolving it.

- timestamp: 2026-07-28T00:00:00Z
  checked: `find . -name "voice-signature*" -not -path "./node_modules/*"` (re-run live)
  found: no output.
  implication: no file of this name existed anywhere in the tree before this filing.

- timestamp: 2026-07-28T00:00:00Z
  checked: `ls .planning/debug/ .planning/debug/resolved/ | grep -i voice-signature` (re-run live)
  found: no match (grep exit code 1).
  implication: absent from both the open and resolved debug directories, matching F1's third independent verification.

- timestamp: 2026-07-28T00:00:00Z
  checked: `node -e "const r=require('./lib/statusline/cockpit-renderer.cjs'); console.log(r.renderCockpit({room:'Demo',next_move:'x',stance:'redteam',stance_forced_color:'red'}));"` (RESEARCH.md Finding F2's exact reproduction command)
  found: BEFORE Phase 243 (RESEARCH.md, same session): `⬡ 🟥 · [redteam] · 📂 Demo ✅ · Next: x`. AFTER Phase 243 (243-01-SUMMARY.md, re-run in that plan's own session): `⬡ · [redteam] · 📂 Demo ✅ · Next: x`.
  implication: the fabricated red square is gone post-243; the `[redteam]` chip (a different segment) still renders. This is V-1, resolved.

- timestamp: 2026-07-28T00:00:00Z
  checked: `grep -rn "voice-mark.json" lib/ scripts/` (re-run live at this file's authoring time)
  found: six lines total. Two are the only FUNCTIONAL reader call sites, unchanged by this phase: `lib/statusline/cockpit-signals.cjs:129` and `:224`, both `path.join(mindrianDir(), 'voice-mark.json')` reads inside `readVoiceGlyph`. The remaining four are comment-only mentions naming the same gap: `cockpit-signals.cjs:28` (header doc), `cockpit-signals.cjs:216` (the false-provenance comment, see V-3 below), `voice-transition-detector.cjs:15` (predates this phase), and `cockpit-renderer.cjs:341` (added by this phase's own Task 2 fix, documenting the same absence in its new comment block). Zero writers among any of these six references, functional or comment.
  implication: confirms RESEARCH.md F2's "exactly two references repo-wide, both readers" claim for the functional call sites, and shows this phase's own fix added a third comment mentioning the same gap without becoming a writer itself.

- timestamp: 2026-07-28T00:00:00Z
  checked: the Phase 243 plan 01 mutation-probe run (`243-01-SUMMARY.md`), executed for real in that plan's own session, not reasoned about.
  found: with the deleted fabrication branch re-inserted, `node tests/test-243-voice-glyph-honest.cjs` printed `test-243-voice-glyph-honest: 16 passed, 2 failed`, exit code 1. The two failing rows, by name: `RED (2b: redteam stance, no natural voice mark -> NO glyph fabricated; [redteam] chip stays)` and `RED (2c: tell-act stance, no natural voice mark -> NO glyph fabricated; [tell-act] chip stays)`. All 15 vocabulary rows and row 2a (no stance at all) stayed green under the mutation. After restoring the fix, the same suite returned to `18 passed, 0 failed`, exit code 0, confirmed byte-identical to the pre-mutation file by md5sum.
  implication: the fixture suite provably targets the exact branch that fabricated the glyph, not a coincidentally-adjacent one. V-1's fix is mutation-proven, not merely passing.

## Technical Root Cause

- Site: `lib/statusline/cockpit-signals.cjs` function `readVoiceGlyph` (the read side, correct) reads `~/.mindrian/voice-mark.json`; `lib/statusline/cockpit-renderer.cjs` function `_render` (the consumer, was the fabrication site for V-1, now fixed) calls `resolveVoiceGlyph`.
- Cause: no code anywhere in this repo writes `~/.mindrian/voice-mark.json`. The write side of the voice-mark side-channel was never built, at any phase. `resolveVoiceGlyph(s)` therefore returns null on 100% of production turns, permanently, not occasionally.
- Why it surfaces now: Phase 210 item B (2026-07-02) added a fallback that filled the glyph from the active stance's default color whenever natural detection returned null, on the assumption that "detection yields nothing" was an occasional state. Because it is the PERMANENT state, that fallback became the ONLY thing that ever painted a glyph on a live statusline (V-1). Phase 243 removes the fallback, which makes the permanent absence of a writer visible rather than papered over (this file's F5 residual, below).

### V-1, RESOLVED by Phase 243.

The fabricated glyph. Site: `lib/statusline/cockpit-renderer.cjs` `_render`, the branch that defined `stanceDefaultGlyph`. It substituted the active stance's default De Stijl color when natural detection returned null, and because null is the permanent state, it was the only thing that ever painted a glyph on a live statusline.

Fix (243-01-SUMMARY.md): the branch was deleted; `voiceGlyph` is now `const`, resolved solely by `resolveVoiceGlyph(s)`. The three assertions that used to certify the fabrication as a deliberate preserve floor were INVERTED, not deleted: `tests/test-voice-glyph-advisory.cjs` leg 3 (now "SUPERSEDED BY PHASE 243: with no natural signal the stance color must NOT render a glyph") and `tests/test-192-statusline-stance-chip.cjs` cases (b) and (c) (the glyph-presence assertion flipped from `!== -1` to `=== -1`; the `[stance]` chip assertion and the natural-detection-wins assertion were left unchanged, both correctly still-valid contracts). `tests/test-243-voice-glyph-honest.cjs` was added as an 18-row fixture gate (15 vocabulary rows + 3 honest-empty rows) and a real mutation probe (not a reasoned claim) confirmed it targets exactly the deleted branch.

Governance note, recorded rather than silently absorbed: Phase 243 SUPERSEDES the second half of Phase 210 item B. What survives: natural detection wins (unchanged, and now the only rule). What dies: the stance color filling the default when detection is silent. Why: Phase 210 made that call assuming "natural detection yields nothing" was occasional; it is permanent, because zero writers exist for `~/.mindrian/voice-mark.json`. A reasonable default over an occasional gap becomes a permanent lie over a permanent gap. This is framed as a further softening, the same direction Phase 210 was travelling, because it removes a signal the system was asserting without evidence -- it does not reintroduce a hard override.

### V-2, OPEN.

No writer exists for `~/.mindrian/voice-mark.json`. Exactly two functional references repo-wide, both readers: `lib/statusline/cockpit-signals.cjs:129` and `:224` (see Evidence above for the full six-line grep including comment-only mentions). Blocked not on effort but on concurrency: the checkpoint schema in `lib/core/voice-transition-detector.cjs` (`current_who`, `session_has_switched`, `last_fire_turn`, `turn_index`) and `lib/core/stance-state.cjs` are both HOME-global with no session key, because `mindrianDir()` resolves to `~/.mindrian` rather than a per-session or per-room path, so N concurrent worktree agents would share one file. Any writer built without a session key would let one worktree agent's turn state be read as another's identity.

Cited rather than re-derived, per this file's instructions: `docs/STATUSLINE-CONTRACT.md`'s Open items list, item 1: "The voice-mark WRITE-side hook (records Larry's last-turn move to `voice-mark.json`) -- the shared prerequisite with Phase 182.1; without it the tripwire cannot see a transition." And `.planning/STATE.md`'s Phase 187 entry, which names the same debt: "voice-glyph write-side hook unwired" (recorded alongside "doctor room-health status cache" and "next-move uses jtbd proxy" as one of that phase's own named debts). This gap is therefore not new; it has been on the record since Phase 187 and restated at the STATUSLINE-CONTRACT.md spec lock, and this is the first place it is filed as part of a routed RCA rather than a scattered comment.

### V-3, OPEN.

The pure transition detector `lib/core/voice-transition-detector.cjs` has zero production callers, and the F.7 recalibration dial (`docs/STATUSLINE-CONTRACT.md` Open item 4) that would consume it is unwired. Recorded here as a finding: `lib/statusline/cockpit-signals.cjs:216` currently claims "The extended voice-mark.json schema (written by the 187.1-02 checkpoint hook)" -- a false provenance claim, since no such writer exists (confirmed by the same grep in Evidence above; this is V-2's gap, restated at a different call site).

Phase 243 chose to LEAVE that comment unedited. Reasoning: it is V-4 territory (RESEARCH.md Finding F7 names it explicitly as a "note in passing, do not fix" item), `REQUIREMENTS.md`'s GLYPH-01 text names only V-1/V-2/V-3, and adding a second unrequired file diff contradicts this phase's own "smallest blast radius" justification (`ROADMAP.md`'s Phase 243 "Depends on" line: "Nothing hard (scheduled last; smallest blast radius)"). Recording the false claim here, rather than silently editing it, preserves it for the phase that eventually owns the write side, so that phase inherits an accurate map of every site that assumes a writer exists.

### The `who: 'larry'` default, OPEN, FILED FOR A NAVIGATOR RULING, NOT FIXED.

A SEPARATE defect from the glyph fabrication (RESEARCH.md Finding F4). Site: `scripts/context-monitor` (locate by the `data.agent` name ternary that sets `who`), independently re-asserted at `lib/statusline/cockpit-signals.cjs` and again at `lib/statusline/cockpit-renderer.cjs` (three independent sites computing the same default). Claude Code's own statusline documentation [CITED in RESEARCH.md: code.claude.com/docs/en/statusline, read 2026-07-28] states that `agent.name` "appears only when running with the `--agent` flag or agent settings configured," so in an ordinary session `data.agent` is undefined and `who` evaluates to `'larry'` unconditionally.

The doctrinal conflict, quoted from `243-RESEARCH.md` Finding F4, which quotes all four primary sources directly:

| Source | Says |
|--------|------|
| `docs/MINDRIAN-CANON.md` (Part 12, HARD requirement, navigator-LOCKED 2026-06-25) | "Every Larry turn wears a De Stijl color mark; a turn with no Larry mark IS the native host speaking, and that absence is itself legible." |
| `agents/larry-extended.md` (always-loaded agent body) | "A turn with no glyph reads as the raw host, not Larry." |
| `lib/core/voice-transition-detector.cjs` (`deriveWho`) | Implements exactly that: no valid mark -> returns `'claude'`. |
| **vs** `scripts/context-monitor` + `cockpit-signals.cjs` (inline comments at the `who` computation) | "Default larry -- the conversational surface IS Larry (Part 10)." |

So the codebase contains two incompatible readings of the same question, and the statusline runs the one that contradicts Part 12's constitutional text.

Why Phase 243 did not fix it, stated so the reasoning is auditable, not just the conclusion: flipping the default to `claude` with no writer present would make every statusline on every install permanently render the host marker and permanently suppress the Brain chip (which is gated on `isLarry`) -- honest, and also a severe, universally-visible UX regression on a phase justified as smallest blast radius. Reconciling Part 10 and Part 12 is a navigator call, not an executor call.

**The ask, stated plainly:** which reading governs the statusline's `who` signal -- Canon Part 10 ("the conversational surface IS Larry") or Canon Part 12 ("a turn with no Larry mark IS the native host speaking")? This RCA is the findable, single home for that decision until a navigator rules on it.

### The F5 RESIDUAL, OPEN, its own heading so it cannot be skimmed past.

After Phase 243, the Tier-1 voice glyph is DARK in production -- on every turn, on every install, permanently -- until a session-keyed writer lands. This is the correct honest state and it satisfies GLYPH-01 SC1. It is ALSO, on its own, indistinguishable from the failure that created Phase 182.1: a green suite certifying a feature that does nothing.

The difference between honest and quietly dead is entirely whether it is written down, which is what this section is for. A navigator with a stance set today (via `/mos:stance`) will see their glyph disappear after this ships -- they still see the `[stance]` chip, only the glyph is gone, because it was never evidence of anything (243-01-SUMMARY.md, "Navigator-visible behavior change"). A placeholder glyph must NEVER be invented to fill the gap, because that recreates the exact defect this phase exists to remove.

## Named non-goals

**V-4** (spoof-fence gaps in `lib/hmi/voice-color-mark.cjs`'s `NON_DESTIJL_GLYPHS`, the mixed-mark gap, the checkbox `⬜` special case, the false provenance comment at `cockpit-signals.cjs:216` addressed above under V-3, and the stale `agents/larry-extended.md:56` line) is knowingly out of GLYPH-01's scope. `REQUIREMENTS.md`'s GLYPH-01 text names only V-1/V-2/V-3, and the audit's own rethink verdict for V-4 was "no RCA, just the batch fix" (RESEARCH.md Finding F7 and User Constraints "Deferred Ideas"). Recorded here so a future reader does not read the omission as an oversight.

**Building the voice-mark.json writer** and **wiring the F.7 recalibration dial** are V-2's and V-3's subjects respectively, and both route to this RCA as documented findings, not as build work performed by this phase (RESEARCH.md User Constraints "Deferred Ideas").

## Citation repair

Six documents cited this file as an existing open RCA before it existed. All six now resolve to a real file:

| Document | Citing location | What it claimed |
|----------|------------------|------------------|
| `.planning/REQUIREMENTS.md` | GLYPH-01 requirement text (currently line 61; RESEARCH.md's research-time read found it at line 52 -- line numbers drift, the content is what resolves) | "the existing open `voice-signature-dark-runtime.md` RCA" |
| `.planning/ROADMAP.md` | Phase 243's own Success Criterion 2 | "routed into the existing open ... RCA ... (no new RCA file created)" |
| `.planning/phases/182.1-signal-voice-glyph-repair/182.1-CONTEXT.md` | the audit narrative describing the green-but-blind Phase 182 test | "RCA: `.planning/debug/voice-signature-dark-runtime.md`" |
| `.planning/phases/182.1-signal-voice-glyph-repair/182.1-SUMMARY.md` | the matching resolution narrative | same |
| `.planning/milestones/v1.15.0-ROADMAP.md` (around line 3945) | the dogfooding finding entry | same |
| `docs/CANON-PHASE-MAP.md` (around line 373) | the Phase 182.1 ledger row | same |

**The F1 fork resolution, stated so nobody has to guess later:** GLYPH-01's Success Criterion 2 says "no new RCA file created." Read literally against a file that did not exist, that criterion was unsatisfiable -- three options were assessed in `243-RESEARCH.md` Finding F1 (create this file per Option A, re-point the six citations at a different existing RCA per Option B, or drop the RCA requirement from `REQUIREMENTS.md`/`ROADMAP.md` per Option C). Option A was chosen. The reading this file's authorship adopts: SC2's "no new RCA file created" means "no SECOND RCA beside the one the repo already names." That is what the audit's own rethink verdict said -- "Findings 2 and 3 belong as additions to the still-open file." Creating the file the repo has been citing for a month is not spawning a competitor; it is giving six existing citations their referent.

## Required Code Changes

- Change 1 (V-1, DONE):
  - Location: `lib/statusline/cockpit-renderer.cjs`, the `_render` function's voice-glyph branch.
  - Current behavior (pre-243): substituted the stance's default color as the glyph when natural detection returned null.
  - Required behavior: `voiceGlyph` resolved solely by `resolveVoiceGlyph(s)`, `const`, no fallback.
  - Short-term patch: same as the full fix.
  - Long-term fix: this IS the long-term fix; no further code change needed for V-1.
  - Status: DONE. Commits `8cde7f0b`, `46eea09d` (Phase 243 plan 01).

- Change 2 (V-2, BLOCKED on a design decision, not build effort):
  - Location: a new module (not yet named) that writes `~/.mindrian/voice-mark.json` on each Larry turn.
  - Current behavior: no writer exists.
  - Required behavior: a writer that records the current turn's voice mark, keyed so that concurrent worktree agents cannot read each other's identity.
  - Blocker: the session-keying design (how `mindrianDir()` or an equivalent resolves to a per-session path) must be decided before any writer is safe to build. This is a structural decision, not a patch.

- Change 3 (the `who` default, BLOCKED on a navigator ruling):
  - Location: `scripts/context-monitor`, `lib/statusline/cockpit-signals.cjs`, `lib/statusline/cockpit-renderer.cjs` (three independent `who` computation sites).
  - Current behavior: defaults to `'larry'` when `data.agent` is absent (Part 10 reading).
  - Required behavior: pending the navigator ruling above (Part 10 vs Part 12).
  - Blocker: the doctrinal conflict must be resolved by a navigator before any of the three sites can change.

## Tests to Add or Update

- Test 1 (already shipped, Phase 243 plan 01):
  - Type: unit / fixture + mutation
  - Location: `tests/test-243-voice-glyph-honest.cjs`
  - Given: `renderCockpit(state)` fed synthetic state objects.
  - When: all 5 De Stijl glyphs via 3 input shapes, plus the honest-empty state with an active stance.
  - Then: the vocabulary renders correctly and the honest-empty state renders no glyph. Mutation-proven: restoring the deleted fallback branch turns exactly the 2 stance rows red.
  - Runner registration: `tests/run-all-243.sh` (glob-discovered).

- Test 2 (this filing):
  - Type: doc-presence
  - Location: `tests/test-243-rca-routing.cjs`
  - Given: this RCA file.
  - When: read as text.
  - Then: frontmatter keys, required headings, V-1/V-2/V-3/GLYPH-01 cross-references, and the no-em-dash gate all assert true; `status` never asserts `resolved`.
  - Runner registration: `tests/run-all-243.sh` (glob-discovered).

- Test 3 (future, not built here, owned by whichever phase builds the writer):
  - Type: integration
  - Location: not yet created.
  - Given: a session-keyed writer for `~/.mindrian/voice-mark.json`.
  - When: two concurrent sessions each write a turn.
  - Then: neither session's read reflects the other's write. This is the concurrency proof V-2's blocker requires before any writer ships.

## Non-Code Follow-ups

- CHANGELOG.md: suggested Fixed entry for the version this phase ships in -- "The voice glyph now appears only when a real voice mark is detected; the stance color no longer fills in a default glyph." (per 243-01-SUMMARY.md's own suggested line).
- Release lockstep: per the standing rule (`feedback_dev_repo_fix_not_live_until_released` in personal memory), this fix is NOT live for any running session after commit, and not after a release either until that session picks it up. v1.16.0 work ships as `v1.16.0-beta.N`, and no v1.16.0 cut happens before `ROADMAP.md` Gate 0 (the stable v1.15.0 close-out).
- On resolve (future, not now): when V-2, V-3, the who-default ruling, and the F5 residual all eventually clear, this file moves to `.planning/debug/resolved/` and a summary block is added to `.planning/debug/knowledge-base.md`. This phase must NOT perform that move -- four items remain OPEN.
- Dev-Research Compositing (CLAUDE.md mandatory obligation): the F1 phantom-RCA finding -- a forward-referenced artifact written into four downstream documents and never authored -- is a durable process lesson and belongs in `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked back to this phase. See this plan's own SUMMARY.md for whether that mirroring could be performed directly from this execution session.

## Resolution

Partial. V-1 only.

root_cause: `lib/statusline/cockpit-renderer.cjs`'s `_render` function substituted the active stance's default De Stijl color for the voice glyph whenever natural voice-mark detection returned null, and because zero writers exist for `~/.mindrian/voice-mark.json`, natural detection returns null on 100% of production turns -- so the fallback was not a rare edge case, it was the only thing that ever painted a glyph on a live statusline.
fix: the fallback branch was deleted; `voiceGlyph` is now resolved solely by `resolveVoiceGlyph(s)`. The three Phase 210/192 assertions that certified the fallback as a deliberate preserve floor were inverted, not deleted, so the change record shows a governed supersession rather than a silent deletion.
verification: `node tests/test-243-voice-glyph-honest.cjs` -> 18 passed, 0 failed, mutation-proven (restoring the branch turns exactly 2 rows red, confirmed live in that plan's own session). `node tests/test-voice-glyph-advisory.cjs` -> 4 passed, 0 failed. `node tests/test-192-statusline-stance-chip.cjs` -> 27 passed, 0 failed. `grep -c stanceDefaultGlyph lib/statusline/cockpit-renderer.cjs` -> 0. `node scripts/build-connector-registry.cjs --check` -> OK, exit 0 (no invocable surface added).
files_changed:
  - `lib/statusline/cockpit-renderer.cjs` (the fabrication branch deleted, comment block updated)
  - `tests/test-voice-glyph-advisory.cjs` (leg 3 inverted)
  - `tests/test-192-statusline-stance-chip.cjs` (cases b/c glyph assertions inverted)
  - `tests/test-243-voice-glyph-honest.cjs` (new, 18-row fixture + mutation gate)
  - `tests/run-all-243.sh` (new, glob-discovering phase aggregator)
commits: `8cde7f0b`, `46eea09d`, `889b8cec` (Phase 243 plan 01).

V-2, V-3, the `who: 'larry'` default, and the F5 residual all stay OPEN. This file does NOT move to `.planning/debug/resolved/` and does not receive a `knowledge-base.md` block while any of the four remain unresolved.
