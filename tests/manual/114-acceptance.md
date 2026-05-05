# Phase 114 -- Manual Acceptance Checklist

Use this when:

- `claude --print` non-interactive mode is unavailable in your env
- Validating Desktop or Cowork surfaces (which lack `claude --print`)
- Empathy audit per v1.13.0-beta.2 promotion gate (3 fresh testers)

Source: VALIDATION.md `## Manual-Only Verifications` table.

---

## Setup

Per surface:

**CLI:**

- [ ] `claude plugin update mos@mindrian-marketplace --version 1.13.0-beta.2`
- [ ] Open a fresh terminal in a fresh directory (no prior MindrianOS state)
- [ ] Type `claude` to launch fresh session

**Desktop:**

- [ ] Plugin installed via marketplace at v1.13.0-beta.2
- [ ] Open fresh Claude Desktop session

**Cowork:**

- [ ] Cowork project with mos plugin enabled at v1.13.0-beta.2
- [ ] Fresh per-user-per-session activation

---

## AC-114-01: 4-skill substrate loaded turn 1

Confirm via behavior (skills inject as agent context at session start; not
directly visible but provable by Larry's first response):

- [ ] Larry's first response references room awareness OR USER.md OR
      Larry's voice characteristics (which require larry-personality +
      context-engine + room-passive substrate to be present)
- [ ] First response is NOT a generic Claude Code greeting (which would
      mean substrate did not preload)

Optional structural confirmation (CLI only):

- [ ] Run `claude plugin validate --plugin-dir .` -- assert no warnings
      about agents/larry-extended.md (skip if subcommand unsupported)

---

## AC-114-02: Larry voice present in turn 1 without /mos:* invocation

Reference rubric: `tests/fixtures/114-larry-voice-rubric.md`.

- [ ] Open fresh session. Do NOT type `/mos:*` anything.
- [ ] Wait for Larry's first response.

Score the response against the 6 BASH criteria + 4 HUMAN criteria from the
rubric:

**Structural [BASH-equivalent]:**

- [ ] Rubric 1: First-person framing within first 30 words (uses "I" or
      "Larry")
- [ ] Rubric 2: <= 8 sentences total
- [ ] Rubric 3: Begins with a signature opener ("Very simply...",
      "Think about it like this...", "Here's the thing...",
      "Let me challenge you with this...") OR the literal initialPrompt
      response ("I'm Larry. What are you working on?")
- [ ] Rubric 4: No emoji anywhere
- [ ] Rubric 5: No /mos: substring (turn 1 must not invoke commands)
- [ ] Rubric 6: No em-dashes (no "--" or "---" or unicode em-dash) --
      hyphens only per CLAUDE.md hard rule

**Tonal [HUMAN]:**

- [ ] Rubric 7: Warm but demanding (no "great question!",
      "I'd be happy to help", "absolutely")
- [ ] Rubric 8: Conversational, not framework-dumping (no SWOT/Porter/JTBD
      by name unless invited)
- [ ] Rubric 9: Ends with a question or next step
- [ ] Rubric 10: Investigative dial-position appropriate to turn 1
      (asks/reframes; does not deliver conclusion)

Tie-breaker: if uncertain on tonal items, escalate to a second reviewer.
If still uncertain, log as "investigate at empathy audit" and continue.

---

## AC-114-03: mindrian-os MCP tools available from turn 1

- [ ] Open fresh session
- [ ] Type `/mcp` (or check menu item if available on Desktop)
- [ ] Confirm mindrian-os server is listed
- [ ] Confirm tool count is >= 1 (at least one MindrianOS tool surfaces)
- [ ] Confirm no "loading..." or "deferred" placeholder for mindrian-os

Negative test:

- [ ] First /mos: command (e.g., `/mos:status`) responds within 5 seconds
      (no 10% threshold wait)

---

## AC-114-04: existing /mos:* command paths still work

Run each of these in a fresh session (no prior context). Each should
respond without error:

- [ ] `/mos:status` -- returns Header Panel + Content Body + Action Footer
      per skills/ui-system 4-zone anatomy
- [ ] `/mos:rooms` -- lists active rooms (or empty-state message if none)
- [ ] `/mos:room` -- prompts for room context or surfaces current room
- [ ] `/mos:think-hats` -- launches BONO orchestration prompt or surfaces
      hat sequence

For each:

- [ ] No error message
- [ ] No emoji in output
- [ ] At least one canonical glyph from the De Stijl vocabulary present
- [ ] Action Footer present (2-3 next-step suggestions)

Compare to `tests/fixtures/114-baseline-commands.txt` if available --
structural shape should match.

---

## Empathy Audit (per v1.13.0-beta.2 promotion gate)

Per `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md`
`## Empathy Audit Protocol`:

- [ ] Recruit 3 fresh testers (never used MindrianOS)
- [ ] Each tester installs via
      `claude plugin update mos@mindrian-marketplace --version 1.13.0-beta.2`
- [ ] 15-minute silent observation. Record:
  - [ ] Did Larry speak first (turn 1, no `/mos:*` typed)?
  - [ ] Did the tester engage past 15 minutes?
  - [ ] Surface tested (CLI / Desktop / Cowork) -- aim for 1 per surface
        if possible
- [ ] Re-score Hooked audit (7-axis, 70-point rubric); target: >= 38

Promotion gate: 2/3 testers report substrate-active turn-1 experience. If
<2/3, scope back and re-ship beta.2.

---

## Sign-off

Tester: ___________________________

Surface: CLI / Desktop / Cowork (circle)

Date: ___________________________

Result: PASS / FAIL / FLAGGED-FOR-EMPATHY-AUDIT (circle)

Notes:

---

Per RESEARCH `## Validation Architecture / Validation strategy notes` --
empathy audit is ground truth.
