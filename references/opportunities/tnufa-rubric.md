# Tnufa Grant Rubric -- Reference

Read by `/mos:grade-grant` at Setup time. This is the human-readable companion to the
machine-readable fixture at `data/grant-rubric-fixtures/tnufa.json` (schema:
`data/grant-rubric-schema.json`). If the two ever disagree, the JSON fixture is the
source of truth for scoring; this file exists to explain WHY the rubric says what it says.

## What Tnufa is

Tnufa (Ideation) is the Israel Innovation Authority's earliest-stage grant: pre-seed,
fledgling entrepreneurs, up to 85% of approved project expenses covered, capped at
roughly NIS 200,000, over a 12-month program. Non-dilutive -- no equity changes hands.
It funds technical R&D (prototypes, feasibility studies, tech-tied market validation, IP
protection costs), not general business expenses.

## Sources, in order of authority

1. **Chapter 9, "A Complete Guide to the Tnufa Grant"** -- from the full Notion page
   export (a ZIP the navigator supplied mid-session, bridged from Windows via the WSL
   mount at `/mnt/c/Users/.../Downloads/`). This is the deepest, most structured source
   and is what most of the `tnufa.json` criteria wording is drawn from (sections 9.1-9.3:
   what Tnufa is, eligibility and suitability, how to apply).
2. **The "IIA Grants" inline Notion database** -- 8 real IIA grant program rows with
   actual eligibility/funding/stage figures. Confirms Tnufa's real numbers (85% / NIS
   200K / 12 months) and supplied the stub fixtures for the other 7 programs.
3. **The 40-Q&A FAQ** on the same Notion page -- broader but less precise, and
   internally inconsistent in one place (see below). Used to cross-check and fill small
   gaps (reporting cadence, appeal process, team-change notification) that Chapter 9
   covers more briefly.

## The contradiction this rubric resolves

The FAQ disagrees with itself on the matching-funds requirement:

- Q5 says the applicant provides 15-25% of the project budget as matching funds.
- Q30 says the mechanism is a 50/50 match (grant amount = matching amount).

The IIA Grants database and Chapter 9 both independently state the grant covers **up to
85% of approved expenses**. If the grant covers 85%, the applicant's match is
mathematically ~15%, agreeing with Q5's low end and directly contradicting Q30's 50/50
claim. Given the FAQ shows visible signs of having been generated through an iterative
ChatGPT session (stray `### You said:` / `### ChatGPT said:` markers survive in the raw
export), Q30's figure reads as generation drift rather than a second real data point.

**This rubric uses ~15% matching (the 85%-of-costs framing) as the correct figure.** A
grading run that flags an application for stating a "50/50" match is working as intended,
not double-counting an ambiguous rule.

## Why this lives outside the Brain

`/mos:grade-grant`'s `connector.reach_id` is `context_block`, not `brain_consult`. Tnufa
specifics are real domain/product reference data, not generic PWS methodology -- Canon
Part 8 (LOCAL -> BRAIN: NO). This was not an assumption: a `brain_search` for "Tnufa grant
Israel Innovation Authority" was attempted this session and blocked by MindrianOS's own
Part 8 egress guard hook as out of scope for the generic-methodology graph. The rubric
ships as this bundled reference pack instead. Brain is still consulted, but only for
GENERIC PWS coaching on a flagged gap category (e.g. "market validation") -- mirroring
`lib/core/eureka/qualify-opportunity.cjs`'s `askBrain()` idiom: a generic framework-handle
query only, never the applicant's own prose, and it degrades gracefully when Brain is
absent.

## What is still out of scope (v1)

- The 17-chapter "Tnufa logic" applicant companion guide (every chapter `Status: Not
  started` as of this session) -- not usable content yet, a separate future writing
  project.
- The "Sector-Specific Programs" database (8 more sector-focused IIA tracks: AI/ML,
  Agri-Tech, Bio-Convergence, Climate-Tech, Cybersecurity, Inclusive Innovation, Industry
  4.0, Peripheral Innovation) found in the full page export -- real content exists for
  these but was not pulled into a fixture this pass. Follow-up work, not a blocker.
- The two official IIA PDFs attached to the Notion page (Hebrew filenames, garbled in the
  export) -- not yet read into any fixture.
- Full criteria for the other 7 IIA grant programs beyond Tnufa (only eligibility/funding
  stub data is captured today -- see `data/grant-rubric-fixtures/*.json`).

## Extending this rubric

To add real criteria for another IIA program: copy `tnufa.json`'s shape, fill in
`criteria[]` following `data/grant-rubric-schema.json`'s contract, and flip `status` from
`stub` to `drafted` or `reviewed`. No code changes required -- `lib/core/eureka/
grade-grant.cjs` loads whichever fixture id the navigator selects.
