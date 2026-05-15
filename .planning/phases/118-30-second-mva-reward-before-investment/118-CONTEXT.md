---
phase: 118
slug: 30-second-mva-reward-before-investment
status: stub
created: 2026-05-05
milestone: v1.13.0
beta_target: final
canon_parts: [Part 2, Part 4, Part 5, Part 10]
depends_on: [Phase 114, 115, 116, 117]
dependents: [Phase 119]
estimated_days: 5
hooked_audit_axis: Action (B=MAP) 3/10 -> 8/10 (largest single Action move)
---

# Phase 118 -- 30-Second MVA + Reward-Before-Investment Rule

**STATUS:** STUB. Scaffolded 2026-05-05 for resumability. Plans not yet written.

## Goal

Build a 45-second-budget pipeline: UserPromptSubmit prompt-hook +
6-parallel-agent dispatch + Feynman deck auto-generation + Vercel
ephemeral deploy. The MVA output IS the room scaffold. This is
Hooked Fix 2 from the dormant 2026-04-12 audit.

Source spec: `~/MindrianRooms/mindrian/mindrian-ecosystem/sub-rooms/
website/mindrianos-conversion-fix/solution-design/the-30-second-mva.md`
+ `reward-before-investment-rule.md`.

## Why this exists

Hooked audit identified a "Dror death spiral" where first-session
sequencing is INVERTED -- users are asked to invest (room setup,
artifact filing) BEFORE they get a reward. The fix is reward-before-
investment: a 30-second MVA delivers tangible value BEFORE the user
has invested any setup ceremony. The room emerges as a SIDE EFFECT
of receiving the MVA, not as a precondition.

Hooked audit Action axis: 3/10 (brain cycles + non-routine crush new
users). Target: 8/10 via 30-second budget enforcement.

## Scope

### IN SCOPE
- UserPromptSubmit prompt-hook captures first-session intent
- 6-agent parallel dispatch (research, persona, market, evidence,
  contradiction, synthesis)
- Feynman deck auto-generation as MVA output
- Vercel ephemeral deploy as receipt + sharable URL
- 45-second total budget enforcement (degrade gracefully on overrun)
- Reward-before-investment sequencing rule

### OUT OF SCOPE
- Subscription/recurring MVA (one-shot first-session only)
- Custom deck themes (one canonical De Stijl theme)
- Multi-language MVAs (English only in v1.13.0)

## Sub-plans (anticipated)

- 118-00 UserPromptSubmit hook + intent capture
- 118-01 6-agent parallel dispatch architecture
- 118-02 Feynman deck auto-generation
- 118-03 Vercel ephemeral deploy integration
- 118-04 45-second budget enforcement + graceful degradation
- 118-05 Reward-before-investment sequencing rule

## Acceptance Criteria

1. Fresh user types intent in turn 1; MVA delivered in <= 45 seconds
2. MVA includes: deck (5-7 slides), persona inference, market scan,
   contradiction flags, synthesis
3. Vercel URL is shareable and renders correctly
4. Room scaffold materializes from MVA findings (not as a separate step)
5. Hooked audit Action axis 3/10 -> 8/10 measured at final gate

## Cross-References

- `~/MindrianRooms/mindrian/mindrian-ecosystem/sub-rooms/website/mindrianos-conversion-fix/solution-design/the-30-second-mva.md`
- `~/MindrianRooms/mindrian/mindrian-ecosystem/sub-rooms/website/mindrianos-conversion-fix/solution-design/reward-before-investment-rule.md`
- `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md`
- `docs/CANON-PART-10-PROPOSAL-conversation-as-product.md` (sub-claim 3)

## Locked Decisions

These decisions were locked during plan-checker iteration 2 (2026-05-15) by Jonathan. They are NON-NEGOTIABLE for any plan executor or future revision. Plans 118-00 through 118-06 reference these by ID.

### LD1 -- English-only for v1.13.0 (resolves OQ1)

**Decision:** English-only classifier path for v1.13.0. Hebrew + bilingual support deferred to v1.14.0.

**Behavior:** Phase 118 still emits a graceful Hebrew refusal (one-character check on the Unicode range U+0590-U+05FF) per the OQ7 lean -- the pipeline MUST NOT silently run on Hebrew input. Instead, when Hebrew characters are detected, the classifier returns `{ venture: false, reason: 'hebrew_unsupported_v1.13.0' }` and the orchestrator (Plan 118-03) renders the bilingual refusal block once, with the pipeline short-circuited (no agents invoked, no deck built, no Vercel deploy).

**Implementation surface:**
- Plan 118-00 mva-classifier.cjs Hebrew detection branch (kept)
- Plan 118-03 orchestrator Hebrew short-circuit (kept)
- Plan 118-06 Dror 2.0 harness Test 3: asserts the Hebrew refusal envelope; the harness DOES NOT fail loudly on "OQ1 unresolved" -- it reads LD1 from this section and asserts the English-only behavior.

**Source:** Jonathan's lean recorded 2026-05-15 during plan-checker iteration 2. Supersedes the OQ1 "open" status in Plan 118-00 and Plan 118-06.

### LD2 -- Vercel REST API direct (resolves OQ2)

**Decision:** Vercel ephemeral deploy uses the Vercel REST API directly. NOT the `vercel` CLI. NOT the `@vercel/client` SDK.

**Auth:** VERCEL_TOKEN resolved via the standard env precedence:
1. `process.env.VERCEL_TOKEN`
2. `~/.mindrian.env` (parse `VERCEL_TOKEN=...` line; strip surrounding double-quotes if present)
3. `.env` in current working directory
4. `null` (triggers local-file fallback path)

This mirrors the Brain key resolution pattern from `lib/core/resolve-brain-key.cjs` shipped in Phase 95.6.

**Project name:** `mindrianos-briefs` (exported as `VERCEL_PROJECT_NAME` from `lib/core/resolve-vercel-key.cjs`).

**Subdomain shape:** `mos-brief-<sha8>-<random>.vercel.app` where `<sha8>` is the first 8 chars of `sentence_sha256` (a hash of a hash; not the sentence).

**Garbage collection:** Vercel's free-tier default 7-day preview cleanup is acceptable for v1.13.0. A dedicated GC cron is OUT OF SCOPE for this phase (carry-forward to v1.14.0 if needed).

**Implementation surface:**
- Plan 118-04 `lib/core/mva-vercel-deploy.cjs` (REST API call via native `fetch`)
- Plan 118-04 `lib/core/resolve-vercel-key.cjs` (env precedence helper)
- Plan 118-04 `data/mva-deck-template.html` (the HTML payload sent base64-encoded to Vercel)

**Source:** Jonathan's lean recorded 2026-05-15 during plan-checker iteration 2. Supersedes the OQ2 "open" status in Plan 118-04.
