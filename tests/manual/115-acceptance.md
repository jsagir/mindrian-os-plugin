# Phase 115 -- Manual Acceptance Checklist (Empathy Audit)

Use this when:

- `claude --print` non-interactive mode is unavailable in your env
- Validating the dual-path first-touch behavior on Desktop or Cowork (no SessionStart hook)
- Empathy audit per v1.13.0-beta.3 promotion gate (3 fresh testers, 2/3 pass condition)

Source: 115-RESEARCH.md `## Validation Architecture / ## Empathy audit`.

---

## Setup

Per surface:

**Tester A -- CLI:**
- [ ] `claude plugin update mos@mindrian-marketplace --version 1.13.0-beta.3`
- [ ] Open a fresh terminal, fresh directory, no prior MindrianOS state, no USER.md
- [ ] Type `claude` to launch fresh session

**Tester B -- Desktop:**
- [ ] Plugin installed via marketplace at v1.13.0-beta.3
- [ ] Open fresh Claude Desktop session
- [ ] No prior USER.md in any room

**Tester C -- Cowork (existing user with role_blend.investor=1.0):**
- [ ] Cowork project with mos plugin enabled at v1.13.0-beta.3
- [ ] USER.md frontmatter has `role_blend: { investor: 1.0, founder: 0.0, researcher: 0.0, ... }` set
- [ ] Fresh per-user-per-session activation

---

## AC-115-02: 8 surfaces all point at the owned emotion

Verbatim spec strings (from `lib/copy/115-spec-strings.cjs`):

- D-02 SPLASH_COPY: "Stuck on a decision you can't name? Let's find the shape of it."
- D-03 NEW_PROJECT_OPENER: "I'm Larry. What decision is stuck?"
- D-04 MARKETING_LINE: "For founders stuck on a decision they can't name."
- D-05 DROR_TEST_CRITERIA: "a founder who is stuck on a decision right now and cannot name it."
- D-06 INITIAL_PROMPT_DEFAULT: "I'm Larry. What decision is stuck? (Tell me, or paste a doc/CV.)"
- D-07 ONBOARD_OPENING_FRAMING: "Very simply -- if you're here, you're probably stuck on a decision you can't quite name. ..."
- D-08 README_HERO_TAGLINE: same as D-04.
- D-09 WEBSITE_HERO_TAGLINE: same as D-04 (out-of-repo, applied to ~/mindrian-website/ post-merge).

Per-surface human verification (Tester A / B / C cycles through subset relevant to their surface):

- [ ] Run `/mos:splash` -- banner + D-02 string visible (Tester A + B confirm; Cowork tester C optional)
- [ ] Run `/mos:new-project` -- D-03 string is the first message (Tester A + B confirm)
- [ ] `cat README.md | head -10` shows D-08 marketing line (Tester A confirms; Tester B reads from marketplace listing)
- [ ] `head -20 agents/larry-extended.md` shows D-06 initialPrompt (Tester A confirms structurally; Tester B + C verify behaviorally -- Larry's first response opens with the persona variant or default)
- [ ] Run `/mos:onboard` -- Step 1 framing leads with D-07 emotion paragraph BEFORE methodology pitch (all 3 testers if reachable on their surface)
- [ ] Visit `mindrianos-jsagirs-projects.vercel.app` -- hero is D-09 marketing line (post-merge manual application; if not yet applied, log as "post-merge action pending")

---

## AC-115-03: Dual-path opener works (live behavior on each surface)

**Tester A (CLI, type-path):** types 60-word stuck-decision answer in turn 1. Larry's response should:
- [ ] NOT classify as upload (no "got it, you're a..." reflection)
- [ ] STAY in conversation mode (asks a follow-up question)
- [ ] Detector returns `path: 'type'` (verifiable structurally on CLI: `node -e "console.log(JSON.stringify(require('./lib/core/dual-path-detector.cjs').classify('I keep coming back to whether to raise now or wait six months. I'm stuck.')))"` -- expect score <= -3)

**Tester B (Desktop, upload-path):** pastes a 300-word CV excerpt. Larry's response should:
- [ ] Classify as upload (Larry says "got it -- I see you're a [role] working on [thing]" or similar reflection)
- [ ] Trigger shallow-doc-parser (3-5 nodes filed to local room.db)
- [ ] Ask "What decision is stuck?" follow-up
- [ ] Detector classification verifiable via MCP tool `detect_dual_path` on Desktop

**Tester C (Cowork, ambiguous-path):** types a 200-word answer with mixed signals (some stuck-language + some domain markers). Larry's response should:
- [ ] Emit explicit fallback prompt: "Looks like you pasted a doc -- want me to read it as your decision context?"
- [ ] Wait for tester clarification before proceeding

---

## AC-115-04: Persona variant rendering on Desktop / Cowork

**Tester A (CLI, cold-start no USER.md):**
- [ ] Larry's first response uses the DEFAULT variant verbatim: "I'm Larry. What decision is stuck? (Tell me, or paste a doc/CV.)"

**Tester B (Desktop, cold-start no USER.md):**
- [ ] Larry's first response uses the DEFAULT variant verbatim (same as Tester A)

**Tester C (Cowork, USER.md role_blend.investor=1.0):**
- [ ] Larry's first response uses the INVESTOR variant: includes "thesis that hasn't decided itself yet" or "paste the deck / memo" phrasing
- [ ] Does NOT use the default variant (verifiable: response contains "deck / memo" substring)

---

## Known limitation: Researcher.IND and Founder.grant alias to default (Pitfall 7)

Per 115-RESEARCH.md Pitfall 7: USER.md `role_blend` schema today has 7 keys (founder, researcher, operator, investor, mentor, domain_expert, student). Researcher.IND and Founder.grant are NOT in the tuple yet.

- v1.13.0 ships `persona_variants` with 9 keys (mechanism scales)
- Researcher.IND + Founder.grant detection-from-role_blend ALONE is impossible today (no key)
- Those 2 variants alias to default until a future phase extends `role_blend` schema (Phase 100 JTBD inference, deferred to v1.14.0, is the natural fold)

If a Researcher.IND tester (translational scientist, HIPAA / IRB context) is recruited later, they receive the generic researcher variant and we file a backlog note. AC-115-04 minimum is 3 (founder + researcher + investor); this limitation does NOT block ship.

---

## Empathy Audit (per v1.13.0-beta.3 promotion gate)

Per `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md` `## Empathy Audit Protocol`:

- [ ] All 3 testers (A + B + C) cycle through their surface
- [ ] 15-minute silent observation per tester. Record:
  - [ ] Did Larry open with the owned emotion (turn 1, no `/mos:*` typed)?
  - [ ] Did the dual-path detection match the tester's input mode?
  - [ ] Did the persona variant render correctly given USER.md `role_blend` (or cold-start default)?
  - [ ] Did the tester engage past 15 minutes?
- [ ] Re-score Hooked audit (7-axis, 70-point rubric); target Trigger Internal: 6/10 (per D-18 ship signal)

Promotion gate: 2/3 testers report "I felt this was for me." If <2/3, scope back per milestone roadmap "stop conditions" and re-ship beta.3.

---

## Sign-off

Tester: ___________________________

Surface: CLI / Desktop / Cowork (circle)

Date: ___________________________

Result: PASS / FAIL / FLAGGED-FOR-EMPATHY-AUDIT (circle)

Notes:

---

Per 115-RESEARCH.md `## Validation Architecture` -- empathy audit is ground truth for AC-115-03 + AC-115-04 live behavior.
