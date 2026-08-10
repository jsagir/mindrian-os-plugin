# Phase 252: Guard Sweep - Validation

**Written:** 2026-08-10 (plan time, HEAD state re-verified live)
**Plans:** 252-01 (SWEEP-01), 252-02 (SWEEP-02), 252-03 (SWEEP-03) - waves 1 -> 2 -> 3, strictly sequential
**Phase rule:** strictly LAST; never split from Phase 250's amendment across releases (HARD lockstep)

## Goal (outcome-shaped)

The loop's honesty is the codebase's ONLY behavior: every brain-optional guard site either
routes through the 250-01 refusal rail, is conformed to refusal vocabulary, or sits on a
frozen KEEP allowlist with a recorded reason; the tier-0-no-key fixture proves refusal
instead of works-without-key; docs and constitution agree inside one release cut.

## Observable Truths (goal-backward, user perspective)

1. A methodology ask with the Brain unavailable gets a visible refusal in-turn - never a
   hardcoded chain, never a quieter Larry, never an unmarked local substitute.
2. A keyless/no-identity install refuses honestly with a visible path forward (SEED-011
   Option A: keyless = the registration-failed edge, never the default experience).
3. Reintroducing a silent-degradation guard, a counterfeit chain, or the old doctrine
   phrases turns a committed test red (census, fence, amendment-unit, inverted fixture).
4. Reading decisions.md, MINDRIAN-CANON.md, CLAUDE.md, or any living doc yields the same
   doctrine the running code enforces, in the same released build.
5. The user's own optional Aura graph, the resolveTierMode section floors, and the rs-*
   Tier-0/Tier-1 local-mirror vocabulary behave exactly as before (the three collisions).

## Requirement Mapping

| Req | Plan | Delivered by |
|-----|------|--------------|
| SWEEP-01 | 252-01 | Census test (red-first) + counterfeit deletion + chokepoint rename + route/conform/keep sweep + degradation-test re-pointing |
| SWEEP-02 | 252-02 | Floor gate honored live (pause-if-red checkpoint) + fixture rename/inversion, coverage kept, never deleted |
| SWEEP-03 | 252-03 | Atomic constitution flip (rows + test-pair in one commit) + living-docs sweep + fence extension + operator release-cut checkpoint |

## Multi-Source Coverage Audit

Sources: GOAL (ROADMAP Phase 252), REQ (SWEEP-01..03), RESEARCH (252-RESEARCH.md),
CONTEXT (no 252-CONTEXT.md exists; the ratified amendment doc + navigator rulings bind
instead). No D-NN decision file for this phase.

| Item | Source | Covered by |
|------|--------|------------|
| Guard sites route through the honesty rail | GOAL/REQ SWEEP-01 | 252-01 T2/T3 |
| Degradation tests re-pointed at refusal semantics | REQ SWEEP-01 | 252-01 T3 (enumerated operative list replaces the folklore "82") |
| Census excluding tests/ proves no silent guard survives | REQ SWEEP-01 | 252-01 T1 (census.1-5, red-first) |
| getTier0Chain/getFrameworkChain deleted; conversation-mode:146 rewritten | RESEARCH + amendment ledger item 7 | 252-01 T2 |
| tier0-messaging.cjs -> refusal-messaging.cjs, wire byte-locked | RESEARCH rename decision | 252-01 T2 |
| Three vocabulary collisions respected (tier_mode, rs-* Aura, canon:193) | RESEARCH | 252-01 census.5 canaries + T3 per-site; 252-03 T2 step 3 |
| rs-experts :64 Brain/Aura probe conflation fixed (instruction text) | RESEARCH Open Q4 | 252-01 T3 |
| Fixture repurposed: coverage kept, assertion inverted, never deleted | REQ SWEEP-02 + ledger item 5 | 252-02 T2 |
| "Keyless" = registration-failed per SEED-011 Option A | REQUIREMENTS HONEST-03 ruling | 252-02 T2 (README + deterministic no-identity spawn) |
| HARD gate: check-flagship-floor.cjs exit 0 before SWEEP-02 lands | ROADMAP ENRICH-04 gate | 252-02 T1 + blocking checkpoint (floor RED at plan time: exit 1, floor-set ABSENT) |
| Amendment rows 1/5/8 applied verbatim | REQ SWEEP-03 + amendment sections 3/4/5 | 252-03 T1 |
| Negative amendment-unit assertion flipped in the SAME commit | 250-02 lockstep design | 252-03 T1 (one commit, flip-first RED) |
| MINDRIAN-CANON.md:21 amended | Ledger item 3 | 252-03 T1 |
| CLAUDE.md install/zero-infrastructure claims (locate by content) | Ledger item 2 | 252-03 T1 |
| BRAIN-SETUP full rewrite + ~72 living docs + dist regen | Ledger items 4/6 | 252-03 T2 |
| Historical records byte-untouched | RESEARCH living-vs-historical policy | 252-03 T2 frozen exclusion list + diff check |
| One release cut carries amendment + sweep (lockstep) | ROADMAP HARD rule | 252-03 T3 checkpoint:human-action (operator cuts, never the executor) |
| Live three-surface proof on the released, restarted build | Standing rule (fix-not-live-until-released) + doctor self-skip caveat | 252-03 T3 |

Exclusions (not gaps): bulk enrichment (out of scope per REQUIREMENTS); the mindrian-brain
service suspension + updatedToolOutput bug report (hygiene list, schedulable anywhere);
code-level Aura probe for rs-experts (filed follow-up per research recommendation);
canon:193 behavior change (rename only, deliberate).

## Verification Matrix (what proves the phase landed)

| Leg | Command | Proves |
|-----|---------|--------|
| Census | `node tests/test-252-guard-census.cjs` | Allowlist clean, ROUTE seam-live, counterfeit gone, canaries intact (RED pre-sweep filed) |
| Phase suite | `bash tests/run-all-252.sh` | All 252 suites + em-dash fence |
| Chokepoint | `node lib/core/refusal-messaging.test.cjs` + `bash tests/test-127-00-shim-handshake.sh` | Rename invisible on the wire; DIRECTOR_NOT_AVAILABLE + five sentinels byte-locked |
| Inverted fixture | `bash tests/test-127-03-acceptance-gates.sh` | Refusal framing present, graceful absent, no methodology payload keyless, startup clean |
| Floor gate | `node scripts/check-flagship-floor.cjs` exit 0 + `data/flagship-floor-set.json` present | ENRICH-04 floor holds under the hard-require |
| Amendment pair | `node --test tests/test-250-amendment-unit.cjs` | Rows applied + lockstep flip atomic |
| Fences | `node --test tests/test-250-doctrine-fence.cjs` (extended) + `tests/test-250-provenance-fence.cjs` + `node tests/test-249-capture-seam.cjs` | Doctrine dead at wider scope; provenance + hot-path unbroken |
| Gates | shape-declaration --check (no new warns vs 53 baseline), connector registry OK, `doctor.cjs --acceptance`, dist --check-stale | Repo-wide invariants |
| Live | 252-03 T3 checkpoint on the released beta, restarted session, three surfaces | The only verification that counts (doctor's class-m self-skip makes CI green NOT live proof) |

## Known Blocked States (honest by design)

- 252-02 parks at its checkpoint while the flagship floor is red (24/28 misses at last
  recorded run; floor-set absent at plan time). Blocked-not-broken; 249-03 owns the fix.
- 252-03 T3 parks while Gate 0 (v1.15.0 close-out) keeps the release train shut, and
  coordinates with 250-04 Task 3's operator ceremony in the same window.

## 250-Citation Re-Verification Ledger (performed at plan time, 2026-08-10)

| Research assumption | Verdict against FINAL 250 SUMMARYs + live grep |
|---|---|
| A1: 250-01 exports/test names/fence scope as drafted | CONFIRMED verbatim |
| A2: SEED-011 client "may or may not land" | RESOLVED: LANDED in 250-04 - plans use the landed branch; MINDRIAN_DISABLE_AUTO_REGISTER=1 already in both keyless harness spawns |
| Shim gates = 6x isAvailable() | CHANGED by 250-04: now `await ensureAvailable()` (8 hits) - census regex widened to /\b(is\|ensure)Available\s*\(/ |
| tier0-messaging consumers = 3 | CHANGED: 11 referencing files at plan time (brain-client.cjs and five 250 test/runner files joined) - rename re-enumerates by grep at execution |
| Open Q1: canon:21 in the ledger? | CLOSED: 250-02 folded it in (ledger item 3); no addendum needed |
| Open Q2: refusal kind for no-identity | CLOSED: reuse no_key with 250-04's reframed registration-failed copy; no fifth kind |
| CLAUDE.md :29/:94 (amendment-corrected) | DRIFTED AGAIN: :30/:93/:95 at plan time - plans locate by content only |
| conversation-mode:146 counterfeit instruction | STILL LIVE (250-01 rewrote brain-connector, not conversation-mode) - 252-01 T2 owns the rewrite |
| Floor gate state | RE-CONFIRMED RED live: exit 1, floor-set ABSENT |
| A5: renames acceptable under "never deleted" | Held: git mv, coverage identical or larger, README states lineage |
| A6: doctor --acceptance self-skips live Brain | Carried into 252-03 T3's checkpoint justification |

## Execution Notes

- Execution model: sonnet (per phase directive). Zero npm installs (any install task is
  invalid per the research's Package Legitimacy Audit).
- No em-dashes anywhere; hyphens only (test fence enforces).
- Every red-first proof files its verbatim output in the plan SUMMARY (eval honesty: a test
  that cannot fail is not evidence).
- Concurrent-executor rule: this phase writes only its own scope; ROADMAP.md updates and
  git ceremony beyond task commits belong to the orchestrator.
