# Phase 252: Guard Sweep - Research

**Researched:** 2026-08-10 (HEAD `e4093627`)
**Domain:** Repo-wide guard-site sweep, fixture inversion, doc/constitution reconciliation (plugin-internal; zero new dependencies)
**Confidence:** HIGH on all in-repo measurements (every count re-run this session at `e4093627`); MEDIUM on interactions with Phase 250's plans (concurrent planner - 250-01/250-02 read but treated as NOT final)

## Summary

The 2026-08-08 blast radius has drifted and, more importantly, was measured with the wrong instrument. The raw grep (comments included) now reads 67 files / 137 `isAvailable()` sites across all scopes (vs 47/101 at `632e230b`), but a comment-stripped executable census - the 248-01 precedent methodology - shows the REAL work is 29 files / 45 executable guard sites in non-test source, plus 7 instruction-layer markdown files. Roughly half of those sites are legitimate and must SURVIVE the sweep: Part-8 safety guards where unavailable is the safe state, optional enrichment captures, health probes, and admin/build scripts that already fail loud. The counterfeit core is small and identifiable: the conversation-mode SKILL's hardcoded-chains instruction (line 146) plus `brain-client.cjs`'s `getTier0Chain`/`getFrameworkChain`, the shim's six tool handlers, and a handful of consult-surface degrades.

Three vocabulary collisions make a blind mechanical sweep dangerous: "tier 0 / tier_0" means THREE different things in this codebase - (1) the dying Brain-optional keyless mode, (2) `resolveTierMode`'s section-derivation floor state in `navigation-engine-shared.cjs` (an internal state machine, not Brain doctrine), and (3) the rs-* family's "Tier 0/Tier 1" meaning local-SQLite-mirror vs the user's OWN Neo4j Aura graph (which stays optional by design, Decision #6). A regex sweep that conflates these breaks working code and falsifies history. The sweep must therefore be classification-first: a per-site disposition table (route / keep / delete), a frozen-allowlist census test that reds on regression, and a docs policy that rewrites living contracts while leaving dated historical records untouched.

Two gates control sequencing. The ENRICH-04 flagship floor (SWEEP-02's entry gate) is RED today: `scripts/check-flagship-floor.cjs` filed a 24/28-miss baseline in 249-02 and `data/flagship-floor-set.json` (the ratified denominator) does not exist yet - 249-03 owns turning it green, and 252 must not start SWEEP-02 until it is. The amendment-sweep lockstep is mechanically enforceable: 250-02's `test-250-amendment-unit.cjs` carries a NEGATIVE assertion that `decisions.md` rows are unchanged; 252's final plan flips that assertion in the SAME commit that applies the rows, so the test pair itself proves the lockstep.

**Primary recommendation:** Three plans - (1) SWEEP-01 guard sweep: classification-driven mechanical passes over the 29-file executable census plus the 7 instruction files, routing consult surfaces through 250's refusal exports, killing `getTier0Chain` and the conversation-mode hardcoded-chains instruction, renaming `tier0-messaging.cjs` to `refusal-messaging.cjs` (wire string `DIRECTOR_NOT_AVAILABLE` byte-locked, unchanged), shipping `test-252-guard-census.cjs` with a frozen allowlist and seam-liveness legs, and re-pointing the degradation tests; (2) SWEEP-02 fixture inversion: repurpose `tests/fixtures/127-03-acceptance/tier-0-no-key/` into a no-identity refusal fixture (assertion inverted, coverage kept, never deleted), reconciled with SEED-011 Option A (post-registration, "keyless" is the registration-failed edge, not the default), gated on `check-flagship-floor.cjs` exiting 0; (3) SWEEP-03 docs + constitution: apply the amendment's verbatim rows to `decisions.md`, fix CLAUDE.md lines 29/94 (the handoff's :19/:84 line numbers are stale), amend MINDRIAN-CANON.md line 21, sweep the ~50 living tier-0 doc surfaces, regenerate dist, flip the 250 negative test, all inside the single release cut that carries 250's amendment.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SWEEP-01 | The 101 isAvailable() brain-optional guard sites (re-measured) route through the honesty rail (visible refusal), not silent degradation; the 82 degradation tests are re-pointed at refusal semantics; a census excluding tests/ proves no silent-degradation guard survives | "Re-Measured Blast Radius" (current counts, executable vs raw), "The Three Tier-0 Vocabularies" (what NOT to sweep), "SWEEP-01: Guard Classification" (per-file dispositions), "The Census Test Design" (248-01 precedent, allowlist + seam-liveness), "Degradation Test Re-Pointing" |
| SWEEP-02 | The tier-0-no-key acceptance fixture is REPURPOSED to assert the keyless path refuses correctly (coverage kept, assertion inverted; never deleted) | "SWEEP-02: Fixture Inversion" (current harness mechanics, what inverts, what survives), "SEED-011 Reconciliation" (what keyless means post Option A), "The ENRICH-04 Floor Gate" (entry gate, RED today) |
| SWEEP-03 | Docs and constitution agree in the same release: no state where docs claim Brain-required while guards silently degrade | "SWEEP-03: The Docs Sweep" (re-measured list, living-vs-historical policy), "Constitution Application" (decisions.md rows, CLAUDE.md drifted line numbers, canon line 21), "Release Choreography" (lockstep enforcement via the 250/252 test pair) |
</phase_requirements>

## Roadmap Constraints (no CONTEXT.md exists for this phase; these bind from ROADMAP/REQUIREMENTS)

- **Strictly LAST.** Depends HARD on Phase 250 (the rail the guards route into + the amendment this phase ships WITH), HARD on Phase 249's ENRICH-04 floor (gates SWEEP-02), and on Phase 251 ordering (the sweep lands on the redesigned rail).
- **Amendment-sweep lockstep (HARD, ROADMAP Progress):** no release - beta or stable - ships 250's HONEST-02 amendment without 252's sweep complete. Phases 250 and 252 are never split across releases.
- **Re-measure rule (ROADMAP Phase 252 text):** the 101/82/121 counts are stale by declaration; this document IS the re-measure. Counts must be re-run once more at plan time if any phase lands in between.
- **Eval honesty:** a test that cannot fail is not evidence - census tests and the inverted fixture must be demonstrably RED before the sweep (the 250-01 "demonstrably RED before the rewrite" precedent).
- **Fixture never deleted:** SWEEP-02's requirement text is explicit - coverage kept, assertion inverted.
- Canon Part 8 untouchable; no em-dashes anywhere; Tri-Polar behavior correct on CLI/Desktop/Cowork; Part 7 no fourth brain skill.
- **Concurrent-planner caveat:** 250-01-PLAN.md and 250-02-PLAN.md were read this session and are cited below, but a 250 planner runs concurrently - every 250 artifact named here (exports, test names, fence scope) must be re-verified against 250's final SUMMARYs at 252 plan time.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Refusal behavior (kinds, shapes, statuses) | `lib/core/tier0-messaging.cjs` (250-01 extends; 252 renames) | consumers: shim, class-m smoke, tests | One chokepoint flips behavior (Canon Part 9); 252 re-points consumers, never re-derives refusal logic |
| Guard-site sweep (route/keep/delete) | `lib/`, `bin/`, `scripts/` executable sites | `skills/`, `commands/` instruction sites + dist mirrors | Code sites route through the rail; instruction sites rewrite doctrine text; dist regenerates |
| Census enforcement | `tests/test-252-guard-census.cjs` (new) | `lib/core/seam-liveness.cjs` (235-02 helper) | The 248-01 precedent: comment-stripped source grep + seam-liveness verdict aggregation; a reintroduced guard reds |
| Fixture inversion | `tests/fixtures/127-03-acceptance/tier-0-no-key/` + `tests/test-127-03-acceptance-gates.sh` gates 1/4 | `lib/core/doctor/class-m-brain-smoke.cjs` | The artifact that proved works-without-key now proves refuses-honestly-without-identity |
| Constitution application | `.claude/includes/decisions.md` rows 1/5/8 + `docs/MINDRIAN-CANON.md:21` | `CLAUDE.md:29/:94`, `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` (250-02 artifact) | Mechanical application of the amendment's verbatim rows, in the sweep release only |
| Docs sweep | living contracts in `docs/`, `skills/`, `commands/`, `agents/`, README, includes | dist mirrors via `scripts/build-dist-bundles.cjs` | Historical records (CHANGELOG, dated handoffs, archived specs) are NOT rewritten |
| Release proof | `tests/run-all-252.sh` + updated acceptance harness + `doctor.cjs --acceptance` + `check-flagship-floor.cjs` | `scripts/verify-release`, release.sh | See "Release Choreography" for what each leg actually proves |

## Re-Measured Blast Radius (HEAD `e4093627`, 2026-08-10)

All counts re-run this session. [VERIFIED: grep + comment-stripped node census, this session]

### Raw grep vs executable census - the instrument matters

| Measure | 632e230b (2026-08-08 handoff) | e4093627 (now) |
|---|---|---|
| Raw `isAvailable()` grep, all scopes (comments included) | 47 files / 101 sites | **67 files / 137 sites** (source 55/111, tests/ 4/16, dist/ 8/10) |
| Comment-stripped EXECUTABLE sites, non-test `.cjs` source (`lib/ bin/ scripts/ hooks/`) | not measured | **29 files / 45 sites** |
| Instruction-layer markdown references (skills/commands, non-dist) | not measured | **7 files / 9 sites** (skills/rs-experts 2, rs-fetch 1, rs-explain 1, conversation-mode 1; commands/rs-experts 2, rs-fetch 1, rs-explain 1) |
| Test files matching `tier.?0` | - | 117 of ~1300 test files |
| Test files matching the tight degradation regex (`tier.?0\|DIRECTOR_NOT_AVAILABLE\|graceful degradation\|silent(ly)? fall`) | "82" | 133 files |
| Files asserting/consuming `DIRECTOR_NOT_AVAILABLE` | 1 chokepoint, 1 test, 1 consumer | **7 files**: tier0-messaging.cjs + .test.cjs, shim, `lib/core/doctor/class-m-brain-smoke.cjs`, test-127-00-shim-handshake.sh, test-127-03-acceptance-gates.sh, clean-install fixture README |
| Docs/skills mentioning Tier 0 | 121 files | **72 non-dist files** (34 docs/, 21 skills, 15 commands, decisions.md, CHANGELOG.md); **114 including dist mirrors** |
| `graceful degradation` phrase | - | 236 line-hits repo-wide; 17 shipped instruction-surface files non-dist + decisions.md + ~19 dist mirrors |

The drift (+20 files/+36 raw sites) came from 245/247/249 work. But the raw number overstates the sweep: the delta between 111 raw and 45 executable source sites is docblock prose (`navigation-engine.cjs`'s 3 hits are ALL comments; `intent-classifier.cjs` is 5 raw but 1 executable). **The 248-01 lesson applies verbatim: never grep raw source - a header prose mention self-invalidates the gate.** The census test must strip comments (the `stripComments` helper from `tests/test-248-resolver-census.cjs:64`, line-comments-first order).

### Executable guard concentration (comment-stripped, non-test source), highest first

```
6  bin/mindrian-brain-mcp-client.cjs      1  lib/brain/framework-chain-slice.cjs
5  lib/core/brain-client.cjs              1  lib/core/brain-derivation-queue.cjs
3  scripts/backfill-correlation-id.cjs    1  lib/core/brain-md-staleness.cjs
3  scripts/rs-explain-command.cjs         1  lib/core/opportunity-ops.cjs
2  lib/core/brain-derivation.cjs          1  lib/core/research-corpus.cjs
2  lib/core/tier0-messaging.cjs           1  lib/core/rs-brain-substrate.cjs
2  scripts/brain-derive-command.cjs       1  lib/core/rs-chain-feeder.cjs
1  lib/agents/mva/brain-cross-domain.cjs  1  lib/core/rs-expert-brain-projection.cjs
1  lib/agents/mva/brain-similar-ventures  1  lib/mcp/brain-router.cjs
1  lib/agents/mva/test-all-six-agents     1  scripts/admin-brain-write.cjs
1  lib/brain/chain-recommender.cjs        1  scripts/build-command-registry.cjs
1  scripts/build-connector-registry.cjs   1  scripts/check-dual-graph-health.cjs
1  scripts/fetch-brain-baseline.cjs       1  scripts/intent-classifier.cjs
1  scripts/interpret-whitespace.cjs       1  scripts/part8-egress-guard-hook.cjs
1  scripts/whitespace-to-brain.cjs
```

Also relevant but NOT `isAvailable()`-shaped: `lib/core/brain-client.cjs` `getTier0Chain()`/`getFrameworkChain()` (lines ~1137-1234) serve hardcoded persona chains with `source: 'tier0'`. Grep this session found ZERO CJS consumers of `getFrameworkChain` outside brain-client itself - its only consumer is the **conversation-mode SKILL instruction** (`skills/conversation-mode/SKILL.md:146`: "When Brain is NOT connected (Tier 0), use these hardcoded chains") plus its two dist mirrors. [VERIFIED: grep]

### The stale line numbers

`CLAUDE.md:19` and `:84` from the handoff have DRIFTED: the one-command-install claim is now **CLAUDE.md:29** and the zero-infrastructure claim is **CLAUDE.md:94**. Content unchanged. 250's research and any 250 plan citing :19/:84 inherit this drift; SWEEP-03 must locate by content, not line number. [VERIFIED: grep -n this session]

## The Three Tier-0 Vocabularies (do NOT sweep blind)

The single most important finding for a mechanical sweep. "tier 0 / tier_0 / Tier 0" carries three unrelated meanings:

| Vocabulary | Where | Meaning | Sweep disposition |
|---|---|---|---|
| **Brain-optional keyless mode** (the dying one) | tier0-messaging, shim, conversation-mode SKILL, decisions.md row 8, BRAIN-SETUP.md, most docs | Keyless Larry serves methodology from local heuristics | **SWEEP TARGET** - route/rewrite/refuse |
| **Section tier_mode floor** | `lib/core/navigation-engine-shared.cjs` `resolveTierMode` -> `'mode_a' \| 'mode_b' \| 'tier_0'`; `tests/test-acpt-05-brain-derive-tier-rise.cjs` (12 raw isAvailable hits, all in the tier-rise driver) | A section with no/broken BRAIN.md reads as `tier_0`; the derivation state machine | **KEEP** - internal state vocabulary, not Brain doctrine. The acpt-05 test proves the tier NEVER rises on a broken derivation (no false-green) - that is honesty, not degradation. Optional: rename the enum in a later phase, never in this sweep |
| **rs-* "Tier 0/Tier 1"** | `skills/rs-experts`, `rs-fetch`, `rs-explain`, `rs-thesis` + their commands and lib/core/rs-* modules | Local SQLite mirror vs the user's OWN Neo4j Aura graph | **KEEP semantics** - the user's Aura graph stays optional by design (Decision #6 LazyGraph optional; CLAUDE.md "Two OPTIONAL and unrelated extras"). BUT `skills/rs-experts/SKILL.md:64` detects "Aura availability via brainClient.isAvailable()" - a dependency CONFLATION (the Brain key is not the Aura connection). Flag per-site: where isAvailable() actually gates the Brain, route; where it is a proxy for Aura, the guard is mislabeled and needs the right probe, not a refusal |

A fourth near-collision: `docs/MINDRIAN-CANON.md:193` "Tier 0 fallback" describes the cold-start Decision Gate option set (Run Methodology / Reformulate / Free-Text) for an empty room - a UI floor, not Brain methodology. Rename the term (e.g. "cold-start minimal option set"), keep the behavior.

## SWEEP-01: Guard Classification

### The decision tree (apply per executable site)

1. **Does the guarded branch serve or shape METHODOLOGY content to a user surface when the Brain is unavailable?** -> **ROUTE** through the refusal rail (250's `refusalResponse`/`renderRefusal`). This is the counterfeit class.
2. **Does it skip an optional capture, enrichment, or telemetry write?** -> **KEEP** (an honest skip; HONEST-03's absence-of-provenance already signals it). The 249 capture seams are the canonical example - optional enrichment capture must stay optional.
3. **Is unavailable the SAFE state?** -> **KEEP** (`part8-egress-guard-hook.cjs`: no wire, nothing can leak - refusing here would be actively wrong).
4. **Is it a dev/build/admin script that already fails loud or keeps a committed snapshot?** -> **KEEP** (optionally align stderr copy with refusal vocabulary).
5. **Is it a health/staleness probe?** -> **KEEP** (probes REPORT availability; they do not serve methodology).

### Per-file disposition table (the 29 executable files + instruction surfaces)

| File | Sites | Disposition | Evidence |
|---|---|---|---|
| `bin/mindrian-brain-mcp-client.cjs` | 6 | **ROUTE** (250-01 does the null/no-key split; 252 verifies all 6 handlers conform and re-points any residual tier0 framing) | 250-01-PLAN must_haves [ASSUMED: plan not final] |
| `lib/core/brain-client.cjs` | 5 + chains | **ROUTE/DELETE**: `getTier0Chain`/`getFrameworkChain` hardcoded chains are the counterfeit core; zero CJS consumers - delete `getTier0Chain` outright, make `getFrameworkChain` refuse (or delete both if the conversation-mode rewrite removes the contract); internal isAvailable guards conform to sentinels | grep: no consumers outside brain-client + conversation-mode SKILL [VERIFIED] |
| `skills/conversation-mode/SKILL.md:146` + 2 dist mirrors | 1 md | **REWRITE** - "use these hardcoded chains" is the instruction-layer counterfeit; becomes the not_ready/unreachable refusal per 250's SKILL contract | [VERIFIED: read] |
| `lib/mcp/brain-router.cjs` | 1 | **ROUTE** - `return null` on unavailable is a silent skip on a consult path | [VERIFIED: read line 277] |
| `lib/brain/chain-recommender.cjs` | 1 | **ROUTE/DISCLOSE** - degrades to `[seed]` chains ("degrade, do not fabricate" comment); a chain recommendation IS methodology; must carry not-graph-grounded disclosure or refuse | [VERIFIED: read lines 345-369] |
| `lib/brain/framework-chain-slice.cjs` | 1 | **CONFORM** - already returns typed `_degraded` + `rationale:'brain_unreachable'` + `confidence_omitted`; map to refusal kinds/provenance | [VERIFIED: read line 123] |
| `lib/core/research-corpus.cjs` | 1 | **CONFORM** - the 221 conversion already returns a typed availability block (`failure_class:'engine_unavailable'`, never silent-[]); align failure_class with kinds | [VERIFIED: read lines 471-483] |
| `scripts/rs-explain-command.cjs` | 3 | **CONFORM** - sets `_brain_degraded` markers ('brain_unreachable', 'brain_ask_unavailable'); verify these RENDER visibly in the explain output, align copy | [VERIFIED: read lines 118-187] |
| `scripts/brain-derive-command.cjs` | 2 | **ROUTE** - "Brain offline" single-line soft-fail exit 0; visible but not rail copy; align kind + copy | [VERIFIED: read header] |
| `lib/core/brain-derivation.cjs` | 2 | **CONFORM** - typed `reason:'brain_unavailable'` already; no silent serve | [VERIFIED: read line 398] |
| `lib/core/brain-derivation-queue.cjs` | 1 | **KEEP** - re-enqueue on unavailable, never drop; correct queue discipline | [VERIFIED: read] |
| `lib/core/tier0-messaging.cjs` | 2 | **CHOKEPOINT** - 250-01 flips values/adds kinds; 252 renames the file (below) | [VERIFIED: read whole file] |
| `scripts/part8-egress-guard-hook.cjs` | 1 | **KEEP** - Brain-less = no-leak = safe; local-log + allow is CORRECT | [VERIFIED: read] |
| `scripts/intent-classifier.cjs` | 1 | **KEEP** - Part 8 Section 9.3 explicitly-permitted boolean scalar for routing; not a serve | [VERIFIED: read line 1929 context] |
| `lib/core/opportunity-ops.cjs` | 1 | **KEEP** - `{enriched:false}` optional enrichment skip | [VERIFIED: read line 1355] |
| `lib/agents/mva/brain-similar-ventures.cjs`, `brain-cross-domain.cjs` | 2 | **KEEP** - typed `status:'empty', reason:'brain_unavailable'`; enrichment agents; downstream provenance-absence discloses | [VERIFIED: read] |
| `lib/core/brain-md-staleness.cjs` | 1 | **KEEP** - staleness/health probe | [VERIFIED: read] |
| `lib/core/rs-chain-feeder.cjs` | 1 | **FLAG for planner** - "Brain unreachable; assuming upstream ready" is a FAIL-OPEN with only a stderr warn; borderline. Recommend: keep the fail-open (it gates a workflow step, not methodology content) but log visibly, or route if the planner judges the chain state user-facing | [VERIFIED: read line 182] |
| `lib/core/rs-brain-substrate.cjs`, `rs-expert-brain-projection.cjs` | 2 | **KEEP with per-site check** - rs family; verify which dependency (Brain vs Aura) each actually gates (the conflation finding) | [VERIFIED: read] |
| `lib/hmi/tier-check.cjs` | 1 | **CONFORM** - tier display; adopt refusal vocabulary | [VERIFIED: header read] |
| `lib/core/eureka/eureka-offer.cjs` | 1 | **KEEP** - offer designed fully OFFLINE; Brain leg optional enrichment | [VERIFIED: header] |
| `scripts/backfill-correlation-id.cjs` | 3 | **KEEP** - admin script, THROWS loud when unavailable | [VERIFIED: read line 247] |
| `scripts/admin-brain-write.cjs` | 1 | **KEEP** - exits 1 loud + audit trail | [VERIFIED: read line 254] |
| `scripts/fetch-brain-baseline.cjs` | 1 | **KEEP** - writes empty baseline with explicit reason 'no-api-key' | [VERIFIED: read line 89] |
| `scripts/check-dual-graph-health.cjs` | 1 | **KEEP** - inconclusive-fail-closed | [VERIFIED: read line 264] |
| `scripts/build-command-registry.cjs`, `build-connector-registry.cjs` | 2 | **KEEP** - build-time "keeping the committed snapshot", visible log | [VERIFIED: read] |
| `scripts/whitespace-to-brain.cjs`, `interpret-whitespace.cjs` | 2 | **KEEP** - dev pipeline, visible skip | [VERIFIED: read line 241] |
| `lib/agents/mva/test-all-six-agents.cjs` | 1 | test driver - rides the test re-pointing pass, not the source sweep | - |
| skills/commands rs-* md (6 files, 8 sites) | 8 | **PER-SITE** - rewrite where "Tier 0" means keyless-Brain; keep where it means local-mirror-vs-Aura; fix the `:64` Brain/Aura probe conflation | [VERIFIED: read rs-experts 62-66, 123-126] |

Tally: ~8 files ROUTE/REWRITE, ~6 CONFORM (already typed, align vocabulary), ~15 KEEP, 1 chokepoint. **The sweep is smaller and sharper than "101 guards": the counterfeit is concentrated in the shim, brain-client's chains, conversation-mode's instruction, brain-router, and chain-recommender.**

### The rename decision (recommended: do it)

250's research explicitly deferred the `tier0-messaging.cjs` rename to 252 ("the name is now wrong: tier0 is dying"). Consumers are fully enumerated: the shim, `lib/core/tier0-messaging.test.cjs`, and `lib/core/doctor/class-m-brain-smoke.cjs` (this session located the "doctor's Class-M smoke L5 check" that 250's research could not find - it lives in `lib/core/doctor/`, not `scripts/doctor.cjs`, resolving 250's assumption A1). Recommend renaming to `lib/core/refusal-messaging.cjs`, updating the 3 requires + the test filename, keeping a deprecation re-export ONLY if 250 ships additional consumers. The wire string `DIRECTOR_NOT_AVAILABLE` and the five sentinel keys stay byte-locked - the acceptance harness gate 1 asserts them. [VERIFIED: consumer grep this session]

### The Census Test Design (`tests/test-252-guard-census.cjs`, the 248-01 precedent)

Follow `tests/test-248-resolver-census.cjs` exactly: comment-stripped source grep (line-comments-first `stripComments`), explicit rule numbering, seam-liveness verdict aggregation via `lib/core/seam-liveness.cjs` `checkClaimedModuleLiveness` (the plain grep probes; the helper owns the verdict and dead-list - it deliberately has no override parameter: "a gate that cannot fail is not a gate").

```
census.1  ALLOWLIST: every file under lib/ bin/ scripts/ hooks/ with an executable
          isAvailable( occurrence is in the frozen KEEP+chokepoint allowlist
          (the table above). A NEW guard file reds. Excludes tests/ per SWEEP-01.
census.2  SEAM-LIVENESS: every ROUTE-classified consult file requires the refusal
          module (refusal-messaging.cjs) on an executable line - claims = the
          ROUTE set, isLive = comment-stripped source matches the require regex.
census.3  COUNTERFEIT-GONE: zero executable getTier0Chain( occurrences anywhere;
          zero `source: 'tier0'` executable occurrences in lib/ bin/ scripts/.
census.4  DOCTRINE FENCE EXTENSION: 250-01's fence covers skills/ commands/
          agents/ dist/ for the two doctrine phrases; 252 extends scope to the
          living docs set + "graceful degradation" as doctrine (scoped - NOT
          repo-wide; the ENV-TUNING/env-parse "silently falls back" comments are
          legitimate, per 250's enumeration).
census.5  VOCABULARY GUARD: `tier_0` in navigation-engine-shared.cjs and the rs-*
          Tier-0/Tier-1 vocabulary are explicitly EXEMPT (assert the exemption
          list so a future zealot sweep does not break them).
```

Red-before-green proof: run the census BEFORE the sweep commits and file the red output in the SUMMARY (the 249-02 "honest starting line" precedent).

### Degradation Test Re-Pointing

The canonical "82" survives only as a comment (`lib/core/brain-client.cjs:309`: "82 degradation tests key on it; do not widen this branch" - about the transport-null contract). It is not reproducible as a file count; current measures: 117 test files match `tier.?0`, 133 match the tight degradation regex, but MOST are the tier_mode/rs vocabularies or incidental prose. The operational re-pointing set is smaller:

1. **Null-contract tests:** 250-01 keeps the null contract (null = transport failure after retry budget), so tests keying on null do NOT flip wholesale. What flips is tests asserting SILENT degrade semantics (empty-array serves, unmarked local fallbacks) at the ROUTE sites.
2. **Sentinel-asserting tests:** the 3 test files asserting `DIRECTOR_NOT_AVAILABLE` (tier0-messaging.test.cjs, test-127-00-shim-handshake.sh, test-127-03-acceptance-gates.sh) keep the wire assertion and gain refusal-framing assertions; renamed alongside the module where applicable.
3. **tier_mode tests (acpt-05 etc.):** EXEMPT - they assert derivation honesty, not Brain-optional doctrine.
4. Planner pass: enumerate per ROUTE file which test files pin its old behavior (grep the file's name + its degrade markers across tests/), flip each with a red-first proof.

## SWEEP-02: Fixture Inversion

### Current mechanics [VERIFIED: read this session]

- Fixture: `tests/fixtures/127-03-acceptance/` = `clean-install`, `with-key`, `lawrence-state`, `tier-0-no-key`. The `tier-0-no-key` README frames it as proving "the silent-failure cohort... gets unblocked" - works-without-key.
- Harness: `tests/test-127-03-acceptance-gates.sh`. Gate 1 (clean install, no key): spawns the shim with `HOME=$TMPDIR`, no `MINDRIAN_BRAIN_KEY`, calls `brain_schema`, asserts `parsed.status === "DIRECTOR_NOT_AVAILABLE"`. Gate 4 (tier-0 cohort): asserts the canonical shim startup stderr line. Gate 5: Class-M 5-layer cascade parity.

### What inverts, what survives

The mechanical assertions largely SURVIVE - gate 1 already asserts the sentinel. What inverts is the MEANING plus new negative assertions:

1. **Keep:** sentinel status assertion (wire string byte-locked), clean startup line (gate 4), no-crash/no-opaque-error property.
2. **Add (the inversion):** assert `fallback_advice`/refusal copy carries REFUSAL framing, not graceful-degradation framing (regex on 250's rewritten value); assert a keyless METHODOLOGY request yields a refusal payload and NEVER a methodology payload (the structural proof no counterfeit path survives - e.g. any chain/derive-shaped tool returns a refusal kind, and `getTier0Chain` no longer exists to serve);
3. **Rename + re-document:** fixture dir `tier-0-no-key` -> recommend `no-key-refusal` (or `no-identity-refusal`), README rewritten to state the inverted purpose ("the artifact that proved the install works without a key now proves it refuses honestly without one" - ROADMAP text verbatim). Renaming preserves coverage and satisfies never-deleted; keeping the literal `tier-0` path name would permanently trip the docs fence.
4. Update `clean-install/README.md` (it also references the sentinel) in the same pass.

### SEED-011 Reconciliation - what "keyless" even means now

HONEST-03's navigator ruling (REQUIREMENTS.md): SEED-011 = **Option A, per-install silent registration (UUID -> /register -> cached install token), BAKED IN BY DEFAULT** - no key ceremony on any fresh install; "the no_key refusal remains for the failure edge, expected to become rare, never the default experience."

Consequence for the fixture: once silent registration ships, a fresh keyless install is EXPECTED to acquire Brain identity silently. "Keyless" stops being the default state and becomes the **no-identity failure edge**: no `MINDRIAN_BRAIN_KEY` AND no cached install token AND registration unavailable (offline/hermetic/endpoint down). The refusal fixture therefore becomes, in substance, a **registration-failed fixture**: the hermetic environment (fresh `HOME`, no network to the register endpoint) deterministically forces the edge, and the assertion is that THIS state refuses honestly.

Current implementation status, verified: **no `/register` or silent-registration client code exists in the repo at HEAD** (grep bin/ lib/ this session), `docs/BRAIN-IDENTITY-DESIGN.md` is ABSENT, and 250's two written plans (01/02) do not build it - HONEST-03/SEED-011 presumably rides a 250-03 not yet on disk. Two branches for the planner:

- **If the registration client has landed by 252 plan time:** the fixture must (a) run network-isolated or with the register endpoint explicitly stubbed/blocked so the registration-failed edge is deterministic (a fixture that accidentally registers against the live endpoint is a flaky false-green AND a CI-network dependency), and (b) assert the refusal kind for the no-identity state. Whether that is `no_key`, `unreachable`, or a new `registration_failed` kind depends on what 250-03 ships - recommend REUSING the existing kinds (no_key for never-had-identity, unreachable for endpoint-down-during-registration) rather than minting a fifth kind, unless 250 shipped a distinct state.
- **If it has not landed:** the fixture inverts against the plain `no_key` refusal exactly as 250-01 leaves it, and the registration-failed leg is filed as an explicit follow-up bound to SEED-011's cross-repo build. Either way the fixture's assertion text should name the identity model so the meaning survives the transition.

### The ENRICH-04 Floor Gate (SWEEP-02's entry gate) - RED today

- Gate command: `node scripts/check-flagship-floor.cjs` (built in 249-02). Current filed state: **exit 1, 24/28 misses** - only Beautiful Question 4/4, Problem Definition Transformation 4/4, Ackoff Pyramid 3/4, Usher's Model 3/4 pass; PEST Analysis absent; 5 multi-match ambiguities. [CITED: .planning/phases/249-02-SUMMARY.md]
- `data/flagship-floor-set.json` (the ratified denominator, "the only legal producer" per 249-02) is **ABSENT at HEAD**. [VERIFIED: ls this session]
- REQUIREMENTS.md marks ENRICH-04 `[x]`, but that reflects the GATE MECHANISM landing, not the floor holding - 249-03 (no SUMMARY yet) owns the enrichment batches and denominator ratification. **252's plan must treat `check-flagship-floor.cjs` exit 0 + the ratified floor-set file as a hard SWEEP-02 entry criterion, re-run live at plan time and again at execution time.** Do not land the hard-require while the floor is red - that is the ROADMAP's explicit gate ("the hard-require in Phase 252 does not land until this floor holds").

## SWEEP-03: The Docs Sweep

### Living-vs-historical policy (the sweep's scope fence)

Rewriting dated records falsifies history and bloats the diff. Policy:

| Bucket | Files (re-measured) | Disposition |
|---|---|---|
| **Living contracts - REWRITE** | 21 skills + 15 commands with tier-0 mentions; `agents/opportunity-scanner.md` (graceful-degradation phrase); `.claude/includes/decisions.md`; `CLAUDE.md:29/:94`; living docs: `THE-BRAIN.md`, `MINDRIAN-CANON.md` (:21 and :193), `MWP-SPECIFICATION.md`, `ENV-TUNING.md`, `WORKFLOWS.md`, `ARCHITECTURE-DEEP-DIVE.md`, `F-SELECTOR-CONSUMER-GUIDE.md`, `ORCHESTRATION-PROJECTION-CONTRACT.md`, `TELEMETRY-SCHEMA.md`, `CANON-PHASE-MAP.md`, `AGENTIC-SURFACING-PATTERN.md`, `docs/install/BRAIN-SETUP.md`, `docs/install/HEAL.md`, `RCA-TEMPLATE.md`, `IDEA-DOCUMENT.md` (verify each at plan time) | ~50 files: rewrite tier-0/graceful-degradation doctrine to refusal doctrine |
| **Dist mirrors - REGENERATE** | 42 dist files | `node scripts/build-dist-bundles.cjs` after source edits, committed |
| **Historical records - DO NOT REWRITE** | `CHANGELOG.md`, the three dated 2026-08 handoffs, `docs/2026-05-12-*`, `docs/UI-UX-CONVERGENCE-2026-05-10/*`, `docs/superpowers/specs/*`, `docs/reviews/*`, `docs/testers/outbox/*`, `docs/research/*`, `docs/POWERHOUSE-1.6.0-SPEC.md` | Leave verbatim; the docs fence EXCLUDES these paths. Optionally add one line to the tier0-removal handoff pointing at the amendment |
| **Vocabulary exemptions** | rs-* Tier-0/Tier-1 (Aura-vs-mirror), canon :193 cold-start option set (renamed, not deleted), `tier_0` tier_mode enum | Census.5 exemption list |

### Constitution application (the amendment's effective clause lands here)

Per 250-02's design (doc-now / rows-at-sweep) [ASSUMED: 250 plans not final]:

1. Apply the amendment's VERBATIM replacement rows to `.claude/includes/decisions.md` rows 1 and 8, plus the Decision #5 wording touch - copied from `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`, never re-drafted.
2. **Flip 250's negative test in the same commit:** `tests/test-250-amendment-unit.cjs` asserts decisions.md rows are UNCHANGED; 252 updates that assertion to expect the applied rows. This test pair IS the lockstep enforcement - between 250 and 252 the negative assertion blocks premature application; at 252 the flip and the application travel together or the suite is red. No release-side machinery needed beyond the suite being green.
3. **CLAUDE.md**: rewrite the :29 install sentence (per the amendment's new Decision #1 framing - one-command survives, what it delivers changes) and the :94 zero-infrastructure claim.
4. **MINDRIAN-CANON.md:21** - a gap in 250's consequential ledger as researched: "Larry operates with Brain (Full Loop) or without Brain (Local Only)... Tier 0 methodology fallbacks... enriched but never replaced" is the CONSTITUTION carrying the dying doctrine, outside decisions.md. This sentence must be amended in the same release or the canon contradicts the amended decisions. **Coordination item: surface to the concurrent 250 planner so the amendment doc's consequential-edits ledger names canon :21 explicitly; if 250 ships without it, 252 adds it to the amendment's ledger as an addendum at application time.**
5. `docs/BRAIN-SETUP.md` full rewrite rides here (250-01 fixes only its doctrine sentence).

### Release Choreography (the lockstep, mechanically)

- All of 250 + 252 merges to main; the FIRST release cut that carries 250's amendment also carries the complete sweep - per Gate 0/Gate 1, that cut is a `v2.0.0-beta.N` via `release.sh --start-prerelease` (Gate 0, the v1.15.0 close-out, still precedes it).
- Because betas may be cut between waves, every intermediate state must be self-consistent: 250's HONEST-01/03 legs are releasable alone (additive honesty); the rows application + sweep are one atomic unit inside 252.
- Per the standing memory rule (`feedback_dev_repo_fix_not_live_until_released`): the sweep is not DONE at merge - a release must cut, be picked up, and the live checks below run on a restarted session on the released build.

## What Phase 235's Seam-Liveness Helper and 250-01's Fence Contribute

- **`lib/core/seam-liveness.cjs` (235-02):** verdict aggregation + dead-list reporting for census legs, with the no-override discipline built in (no options object, no force flag; a throwing probe counts as dead). 248-01 already proved the pattern for exactly this shape of census: plain grep probes, `checkClaimedModuleLiveness` owns the verdict. Census.2 reuses it verbatim.
- **250-01's doctrine fence (`tests/test-250-doctrine-fence.cjs`)** [ASSUMED: not final]: the scoped phrase fence over skills/commands/agents/dist. 252 EXTENDS scope (living docs + graceful-degradation-as-doctrine) rather than writing a second fence - one fence, wider scope, per Part 7.
- **250-01's refusal exports** (`REFUSAL_KINDS`, `refusalResponse`, `larryRefusalLine`, `renderRefusal`, `refuseNotReady`): the rail every ROUTE site targets. 252 writes NO new refusal logic - if a 252 task drafts refusal copy or new kinds, it has drifted into 250's scope.

## What Release Verification Proves the Sweep Landed

| Leg | Command | What it proves |
|---|---|---|
| Phase suite | `bash tests/run-all-252.sh` | Census 1-5 green (allowlist, seam-liveness, counterfeit-gone, fence, exemptions), re-pointed tests green, red-first proofs filed |
| Inverted fixture | `bash tests/test-127-03-acceptance-gates.sh` (updated) | Keyless/no-identity path refuses with the locked wire shape AND refusal framing; no methodology payload obtainable keyless; startup still clean |
| Floor gate | `node scripts/check-flagship-floor.cjs` (exit 0) + `data/flagship-floor-set.json` present | ENRICH-04 floor holds - the hard-require stands on ready flagships |
| Acceptance roll-up | `node scripts/doctor.cjs --acceptance` | The ~10-check checklist incl. coverage-gate (connector/projection/render/skill-mirrors/shape-declaration) and doctor-all. CAVEAT [VERIFIED: doctor.cjs:224]: Brain LIVE arms self-skip via class-m so this is CI-green WITHOUT a reachable Brain - it does NOT prove live refusal behavior |
| Gates | `check-shape-declaration.cjs --check`, `build-connector-registry.cjs --check`, em-dash fence | No new warns, R1 ledger intact, no em-dashes |
| Amendment pair | `tests/test-250-amendment-unit.cjs` (flipped) | Rows applied + amendment in force in the same tree |
| Release | `scripts/verify-release` + `release.sh` five-gate lockstep | The cut carrying amendment + sweep together |
| Live proof | checkpoint:human-verify on the RELEASED beta, restarted session, all three surfaces | The only verification that counts (the restart-to-apply lesson; doctor's self-skip caveat makes this checkpoint non-optional) |

## Standard Stack

### Core (all existing - this phase installs NOTHING)

| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `lib/core/tier0-messaging.cjs` (-> `refusal-messaging.cjs`) | 250-01 extended | The rail; 252 renames + re-points 3 consumers | One-chokepoint flip, Canon Part 9 [VERIFIED: read + consumer grep] |
| `lib/core/seam-liveness.cjs` | 235-02 | Census verdict aggregation | No-override discipline; 248-01 precedent [VERIFIED: read] |
| `tests/test-248-resolver-census.cjs` | 248-01 | THE census template (stripComments, rule numbering, seam leg) | The named precedent in the phase brief [VERIFIED: read] |
| `scripts/check-flagship-floor.cjs` | 249-02 | SWEEP-02 entry gate | The only legal floor arbiter [VERIFIED: exists; baseline cited] |
| `scripts/build-dist-bundles.cjs` | shipped | Dist mirror regeneration after every instruction-surface edit | Mirrors are committed; source-only edits leave doctrine alive [VERIFIED] |
| `tests/test-127-03-acceptance-gates.sh` + fixtures | 127-03 | The fixture harness SWEEP-02 inverts | Coverage kept, assertion inverted [VERIFIED: read] |
| `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` | 250-02 (pending) | Source of the verbatim rows 252 applies | Never re-draft; copy [ASSUMED: 250 not final] |

**Installation:** none. Zero npm deps is a hard repo convention.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (pure CJS, node built-ins only). Any plan task proposing an npm install violates the stack convention and should be rejected at plan-check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Census verdicts | Custom pass/fail aggregation | `seam-liveness.cjs` wrappers | 235-02 exists for exactly this; no-override discipline built in |
| Comment stripping | New regex | `test-248-resolver-census.cjs` stripComments (line-comments-first) | The block-first order has a documented misfire on this repo's doc comments |
| Refusal copy/kinds | New messages in swept files | 250's exports + SKILL contract | 252 routes; 250 renders. Drift check: no new refusal prose in 252 diffs |
| Doc mirror sync | Hand-editing dist | `build-dist-bundles.cjs` | Committed mirrors; hand edits drift |
| Floor verification | Ad-hoc readiness probes | `check-flagship-floor.cjs` + `data/flagship-floor-set.json` | 249-02 named it the only legal producer/arbiter |
| Lockstep enforcement | Release-script machinery | The 250/252 amendment-unit test-pair flip | Suite-level, atomic, already designed into 250-02 |

**Key insight:** 250 builds the rail; 249 builds the floor gate; 235/248 built the census tooling. 252 writes almost no new mechanism - it is a classification, a re-pointing, and a reconciliation, each provable by a fence that was red first.

## Runtime State Inventory (rename/refactor phase - all five categories answered)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Enrichment queue JSONL entries carry `source` tokens (live_reach/refusal) - no tier-0 strings stored [VERIFIED: 249 queue contract]. room.db stores no tier vocabulary (tier_mode is computed at read time by resolveTierMode, not persisted) [VERIFIED: resolveTierMode is a pure function] | None |
| Live service config | The Render Brain service (`pws-brain-mcp.onrender.com`) is untouched by this phase (client-side sweep only). The retired `mindrian-brain` service suspension is a tracked hygiene item, not 252 scope | None (verify no server-side "tier" strings in served payloads at plan time - `source: 'tier0'` originates client-side only [VERIFIED: grep]) |
| OS-registered state | None - the plugin registers no scheduled tasks/services [VERIFIED: repo structure] | None |
| Secrets/env vars | `MINDRIAN_BRAIN_KEY` name UNCHANGED by this phase; resolver order unchanged. SEED-011's install token (if 250-03 ships it) adds a cached credential whose path the fixture must isolate | Fixture uses fresh `HOME` (already does) |
| Build artifacts / installed state | (a) dist/ mirrors are COMMITTED build artifacts - every instruction edit requires regeneration in the same task; (b) the plugin install cache `~/.claude/plugins/mindrian-os` and every user install serve STALE skills until a release ships and is picked up - the standing 4-occurrence rule; (c) marketplace pin must move with the release | Regenerate dist per task; live verification only on the released, restarted build |

## Common Pitfalls

### Pitfall 1: Sweeping the wrong "tier 0"
**What goes wrong:** a mechanical pass rewrites `tier_0` in resolveTierMode or the rs-* Tier-0/Tier-1 vocabulary; working state machines break and the user's OPTIONAL Aura graph gets a refusal it must never have.
**How to avoid:** the three-vocabulary table + census.5 exemption assertions; per-site dependency check on rs-* files.
**Warning signs:** diffs in `navigation-engine-shared.cjs` or rs-* semantics beyond copy alignment.

### Pitfall 2: Raw-grep census
**What goes wrong:** a census counting comment mentions reds forever on docblocks (111 raw vs 45 executable) and gets watered down or ignored.
**How to avoid:** stripComments first (248-01's line-comments-first order - the block-first order silently swallows real requires).

### Pitfall 3: Killing legitimate keeps
**What goes wrong:** routing `part8-egress-guard-hook.cjs` (unavailable = safe = allow) or the 249 capture seams through refusal - actively wrong behavior, and the hot-path fence (`test-249-capture-seam.cjs`) or Part 8 posture breaks.
**How to avoid:** the decision tree; the KEEP allowlist is a deliberate artifact, reviewed at plan-check.

### Pitfall 4: Fixture deleted or renamed into oblivion
**What goes wrong:** the artifact that proves keyless behavior disappears; SWEEP-02's requirement text ("never deleted") fails its own review.
**How to avoid:** rename + rewrite README + keep every gate; the inversion is assertion-level, the coverage is identical or larger.

### Pitfall 5: Fixture accidentally registers (post SEED-011)
**What goes wrong:** once silent registration ships, the hermetic no-key spawn reaches the live /register endpoint, acquires identity, and the "refusal" fixture false-greens (or flakes on network).
**How to avoid:** network-isolate or stub the registration endpoint in the fixture env; assert the no-identity edge deterministically.

### Pitfall 6: Landing SWEEP-02 on a red floor
**What goes wrong:** the hard-require lands while 24/28 flagships miss the floor - every methodology command refuses and Larry is useless, exactly the state the ENRICH-04 gate exists to prevent.
**How to avoid:** `check-flagship-floor.cjs` exit 0 + ratified floor-set file as a hard entry criterion, re-run at execution time, not just plan time.

### Pitfall 7: Rewriting history
**What goes wrong:** CHANGELOG entries and dated handoffs get "corrected"; the causal record the amendment cites no longer matches the files it cites.
**How to avoid:** the living-vs-historical bucket table; the docs fence excludes historical paths.

### Pitfall 8: Declaring done at merge
**What goes wrong:** the sweep is "complete" but no release cut carries it; a later beta ships the amendment rows without the picked-up sweep, or live sessions still run the counterfeit from the plugin cache.
**How to avoid:** the amendment-unit test-pair flip (atomic), the release choreography table, and the live checkpoint on the released, restarted build. Note doctor --acceptance's class-m self-skip: CI green is NOT live proof.

### Pitfall 9: Trusting this document's 250 citations
**What goes wrong:** the concurrent 250 planner changes export names, fence scope, or plan count; 252 plans against stale names.
**How to avoid:** re-verify every 250 artifact against 250's final SUMMARYs at 252 plan time (the exports list, test names, whether a 250-03 ships SEED-011 client code).

## Code Examples

### Census sketch (follows test-248-resolver-census.cjs verbatim)

```js
// tests/test-252-guard-census.cjs - comment-stripped, allowlist + seam legs
const { checkClaimedModuleLiveness } = require('../lib/core/seam-liveness.cjs');
// stripComments: line comments FIRST, then block comments (248-01's documented order)

const KEEP_ALLOWLIST = [            // frozen; reviewed at plan-check
  'scripts/part8-egress-guard-hook.cjs',   // safe-state guard
  'scripts/intent-classifier.cjs',         // Part 8 permitted scalar
  'lib/core/opportunity-ops.cjs',          // optional enrichment
  // ... the full KEEP set from the disposition table
];
const ROUTE_SET = [                 // must require the refusal module
  'bin/mindrian-brain-mcp-client.cjs',
  'lib/mcp/brain-router.cjs',
  'lib/brain/chain-recommender.cjs',
  // ...
];
// census.1: files with executable isAvailable( minus allowlist minus rail == empty
// census.2: checkClaimedModuleLiveness over ROUTE_SET, isLive = /require\([^)]*refusal-messaging\.cjs/
// census.3: zero executable /getTier0Chain\(/ and /source:\s*'tier0'/ anywhere in scope
// census.5: assert navigation-engine-shared.cjs still contains 'tier_0' (exemption canary)
```

### Fixture inversion assertion sketch (gate 1 addition)

```bash
# after the surviving DIRECTOR_NOT_AVAILABLE assertion:
# 1. refusal framing present, graceful framing absent
echo "$PARSED_FALLBACK" | grep -qiE "refus|will not improvise" || fail
echo "$PARSED_FALLBACK" | grep -qiE "graceful" && fail
# 2. a methodology-shaped call keyless yields a refusal kind, never a chain payload
#    (call the derive/chain-shaped tool; assert status in the refusal-status set,
#     assert NO frameworks array in the payload)
```

## State of the Art

| Old Approach | Current Approach (post-252) | When Changed | Impact |
|--------------|------------------------------|--------------|--------|
| 101 guards, some silent, meaning unknown per-site | 29-file executable census: ~8 routed, ~6 conformed, ~15 kept on a frozen allowlist | this phase | "No silent-degradation guard survives" is a provable census verdict, not a claim |
| tier-0-no-key fixture proves works-without-key | Inverted: proves refuses-honestly-without-identity (registration-failed edge post SEED-011) | this phase | The strongest artifact of the old doctrine becomes the strongest artifact of the new |
| Docs/constitution contradiction risk between phases | Amendment-unit test-pair flip makes application + sweep atomic | this phase | The lockstep is suite-enforced, not process-enforced |
| `tier0-messaging.cjs` name | `refusal-messaging.cjs` (wire string unchanged) | this phase | Vocabulary matches doctrine; consumers enumerated (3) |
| conversation-mode hardcoded chains + getTier0Chain | Deleted / refusing | this phase | The counterfeit is structurally unavailable, not just discouraged |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 250-01/250-02's exports, test names, and fence scope land as written in the plans read this session (concurrent planner) | throughout | Medium - re-verify against 250 SUMMARYs at plan time; the sweep's ROUTE targets depend on the export names |
| A2 | A 250-03 (HONEST-03/SEED-011) exists or will exist; the silent-registration client may or may not land before 252 | SWEEP-02 / SEED-011 | Medium - the fixture branches on it (both branches designed above) |
| A3 | ENRICH-04's floor turns green in 249-03 before 252 executes | Floor gate | High if ignored - hard entry criterion; blocked-not-broken if red |
| A4 | The KEEP/ROUTE classification of the ~6 borderline files (rs-chain-feeder fail-open, rs Brain/Aura conflation sites) survives planner review | Disposition table | Low - flagged explicitly for per-site judgment |
| A5 | Renaming the fixture dir and tier0-messaging module is acceptable under "never deleted" (coverage preserved, history in git) | SWEEP-01/02 | Low - fall back to keep-names + README/header rewrite if the navigator objects |
| A6 | `doctor.cjs --acceptance` remains CI-green-without-Brain by design (class-m self-skip), so live proof is checkpoint-only | Release proof | Low - verified at doctor.cjs:224 this session; re-check if 250/251 touch doctor |

## Open Questions (RESOLVED - plan-time dispositions 2026-08-10, pointers below)

1. **Does 250's amendment consequential ledger name MINDRIAN-CANON.md:21?** The researched 250 ledger names decisions.md, CLAUDE.md, BRAIN-SETUP, the fixture, and the docs list - canon :21 was not in it. Coordination with the concurrent 250 planner preferred; otherwise 252 adds it at application time with a one-line addendum note.
   - RESOLVED: yes - 250-02 folded canon:21 into the amendment's consequential-edits ledger (item 3, verified in 250-02-SUMMARY.md). Applied in 252-03-PLAN.md Task 1; no addendum needed.
2. **Refusal kind for the no-identity edge post-registration:** reuse `no_key`/`unreachable` or a distinct `registration_failed`? Depends on what 250-03 ships. Recommendation: reuse, unless the registration client exposes a distinct state the fixture must discriminate.
   - RESOLVED: reuse - 250-04 reframed the no_key copy itself for the registration-failed edge (_noKeyDetail / getAutoRegisterFailureReason); no fifth kind minted. Asserted in 252-02-PLAN.md Task 2.
3. **The "82 degradation tests" accounting:** the number is a comment-era estimate that cannot be reproduced as a file count (117 tier-0-matching test files, most exempted by vocabulary). Recommendation: the planner's test re-pointing pass produces its own enumerated list per ROUTE file and files it in the SUMMARY as the operative number - honest re-measure over inherited folklore.
   - RESOLVED: 252-01-PLAN.md Task 3a enumerates the operative re-pointing list per ROUTE file and files it in the SUMMARY, with a hard >20-file escape valve into a supplemental plan (252-04) rather than mid-task degradation.
4. **rs-experts' Brain/Aura probe conflation (`SKILL.md:64`):** fix in this sweep (right probe for Aura) or file as follow-up? Recommendation: fix the instruction text in the sweep (it is a doctrine-adjacent honesty issue); a code-level Aura probe, if needed, is a follow-up.
   - RESOLVED: instruction-text fix rides 252-01-PLAN.md Task 3b (the right probe named for Aura); a code-level Aura probe is a filed follow-up, not this sweep.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22.16 | census, tests | yes | repo floor honored | - |
| Live Brain (pws-brain-mcp.onrender.com) | `check-flagship-floor.cjs` re-run; live checkpoints | assumed (beta.13 verified; 246 owns fresh proof) | - | floor gate cannot be evaluated offline - run at plan AND execution time with the key present |
| 250 complete (rail exports, fence, amendment doc) | SWEEP-01/03 | not yet (2 plans on disk, 0 SUMMARYs) | - | none - HARD dependency |
| 249-03 complete (floor green + floor-set.json) | SWEEP-02 | not yet (floor RED, 24/28 misses; floor-set ABSENT) | - | none - HARD gate |
| 251 complete | ordering | not yet | - | ordering only, no artifact dependency found |
| langtalks-graph-expert MCP | grounding | **no (this agent session - no MCP tools exposed)** | - | filed consultations cited (Grounding section) |

**Missing dependencies with no fallback:** the two HARD gates above (250, 249-03/floor). Both are sequencing, not research, blockers.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | repo-native CJS test scripts (node:assert) + bash phase runner |
| Config file | none - convention `tests/test-252-*.cjs` + `tests/run-all-252.sh` (Wave 0) |
| Quick run command | `node tests/test-252-guard-census.cjs` |
| Full suite command | `bash tests/run-all-252.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SWEEP-01 | Census 1-5: allowlist, seam-liveness routing, counterfeit-gone, fence extension, vocabulary exemptions | fence/census | `node tests/test-252-guard-census.cjs` | Wave 0 (red-first proof required) |
| SWEEP-01 | Re-pointed degradation tests green; tier_mode/rs tests untouched and green | unit (existing, flipped) | `bash tests/run-all-252.sh` (aggregates) | flip pass |
| SWEEP-01 | Hot-path fence stays green | fence (existing) | `node tests/test-249-capture-seam.cjs` | exists |
| SWEEP-02 | Inverted fixture: refusal framing, no keyless methodology payload, wire shape + startup intact | acceptance | `bash tests/test-127-03-acceptance-gates.sh` | exists (assertions inverted) |
| SWEEP-02 | Floor gate green | gate | `node scripts/check-flagship-floor.cjs` (exit 0) + floor-set present | exists (RED today) |
| SWEEP-03 | Rows applied verbatim from amendment; amendment-unit test flipped in same commit | unit (flip of 250's) | `node tests/test-250-amendment-unit.cjs` | 250 Wave 0 [ASSUMED] |
| SWEEP-03 | Living-docs fence: doctrine phrases + tier-0-as-doctrine absent from living scope; historical paths excluded | fence | extend `tests/test-250-doctrine-fence.cjs` scope (or sibling `test-252-docs-fence.cjs`) | Wave 0 |
| all | Gates: shape-declaration, connector registry, doctor --acceptance, em-dash | gate (existing) | per CLAUDE.md Verification | exists |
| all | Live refusal on the RELEASED build, restarted session, three surfaces | manual-only | checkpoint:human-verify (justification: doctor --acceptance self-skips live Brain arms; skill-layer behavior on three hosts not automatable) | - |

### Sampling Rate
- **Per task commit:** the task's `test-252-*` + touched gates
- **Per wave merge:** `bash tests/run-all-252.sh` + shape/connector gates + `doctor.cjs --acceptance`
- **Phase gate:** full runner + floor gate + inverted fixture + flipped amendment test green, live checkpoints complete, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-252.sh` - phase runner (glob discovery, found-eq-0 guard, em-dash fence)
- [ ] `tests/test-252-guard-census.cjs` - SWEEP-01 (must be demonstrably RED pre-sweep)
- [ ] docs-fence scope extension - SWEEP-03
- [ ] fixture assertion additions in `test-127-03-acceptance-gates.sh` - SWEEP-02

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (key/identity edge) | `resolve-brain-key.cjs` unchanged; fixture isolates HOME + (post SEED-011) the token cache; never print key values in refusal copy (250's rule inherited) |
| V4 Access Control | yes | tier_denied stays server-side; sweep renders, never bypasses |
| V5 Input Validation | yes | swept sites interpolate only closed-enum kinds + coerced tool names (250's contract); no new interpolation surfaces in 252 |
| V8 Data Protection | yes | Part 8 posture unchanged: the sweep changes WHEN failure surfaces, never WHAT crosses the wire; census.3 removing `source:'tier0'` adds zero egress |

Threats: none new - this phase removes a deceptive code path (repudiation surface shrinks). The one watch item: the fixture's network isolation (Pitfall 5) doubles as a supply-side control - a fixture reaching a live endpoint from CI is both a flake and an egress.

## Grounding: langtalks consultation (recorded honestly)

**Tool availability:** the `mcp__langtalks-graph-expert__*` tools are NOT available in this research agent's session (no MCP tools exposed to the agent). No live `relationship_path` query could be run. Recorded per the standing rule - never papered over.

**The covering corpus material is in hand from the two FILED consultations** (tier0 handoff section 7, designated "already gathered - do not re-research"), applied to THIS phase:

- **"Truncation is explicit rather than silent"** (data4sci harness blueprint) - the exact rule the census enforces structurally: after the sweep, silence is not a reachable state at the routed sites.
- **Silent failure as a named law** (ep35 Almog Baku, ep55, Fragmented #307 "agent legibility") - SWEEP-01 is the codebase-wide application of what 250 applies at the chokepoint; the census is the legibility regression fence.
- **Eval honesty** (repo's own rule + ep65's shadow-run insight): every 252 fence must be red-first; the 249-02 filed 24/28-miss baseline is the working precedent for filing an honest red.
- **Corpus whitespace stands:** no external precedent for hard-requiring a remote knowledge service (both handoffs record this); the sweep implements the navigator's own call and should not cite the corpus as support for the doctrine itself.
- If MCP tools appear at plan time: one point-to-point `relationship_path` worth running - refusal/guard-removal -> regression-fencing patterns - as confirmation, not a blocker.

## Sources

### Primary (HIGH confidence - read/grepped/measured in-repo this session at `e4093627`)
- Comment-stripped executable census (node script, this session) + raw greps across all scopes - the blast-radius tables
- `lib/core/tier0-messaging.cjs` (full read), `bin/mindrian-brain-mcp-client.cjs`, `lib/core/brain-client.cjs` (getTier0Chain lines 1135-1234, the :309 "82 tests" comment), `lib/core/doctor/class-m-brain-smoke.cjs` (the located Class-M consumer)
- `tests/test-248-resolver-census.cjs` (full read - the census template), `lib/core/seam-liveness.cjs` (full read)
- `tests/test-127-03-acceptance-gates.sh` (gates 1-5 mechanics), `tests/fixtures/127-03-acceptance/tier-0-no-key/README.md`, `tests/test-acpt-05-brain-derive-tier-rise.cjs` (tier_mode vocabulary)
- Guard-site context reads: the 29-file disposition evidence (each cited inline in the table)
- `skills/conversation-mode/SKILL.md:146`, `skills/rs-experts/SKILL.md:62-66,123-126`, `lib/core/navigation-engine-shared.cjs` resolveTierMode, `docs/MINDRIAN-CANON.md:21,:193`, `CLAUDE.md:29,:94`, `.claude/includes/decisions.md`
- `scripts/doctor.cjs` (--acceptance checklist ids, :224 class-m self-skip), `scripts/check-flagship-floor.cjs` existence, `data/flagship-floor-set.json` absence
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/config.json`, `.planning/phases/249-context-driven-enrichment/249-02-SUMMARY.md` (the 24/28 baseline)
- `docs/2026-08-09-HANDOFF-tier0-removal-milestone.md` (the 632e230b baseline being re-measured)

### Secondary (MEDIUM confidence)
- `.planning/phases/250-honesty-rail-doctrine-amendment/250-RESEARCH.md` + `250-01-PLAN.md`/`250-02-PLAN.md` - read this session but produced by a CONCURRENT planner; every dependency on them is tagged and listed in Assumptions A1/A2
- Filed langtalks/consultant material quoted in the handoffs (do-not-re-research designation; tools unavailable this session, recorded)

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Blast-radius re-measure: HIGH - every count re-run at HEAD with stated methodology; raw-vs-executable distinction is the load-bearing correction
- Guard classification: HIGH on the pattern evidence per file (all read), MEDIUM on ~4 borderline dispositions (flagged for planner judgment)
- Fixture inversion: HIGH on current harness mechanics, MEDIUM on the SEED-011 branch (depends on 250-03, not yet on disk)
- Docs sweep + constitution: HIGH on the lists and the canon :21 gap, MEDIUM on 250's ledger contents (concurrent)
- Sequencing gates: HIGH - the floor's RED state and the lockstep mechanics are verified artifacts

**Research date:** 2026-08-10
**Valid until:** counts stale the moment 249-03/250/251 land - the ROADMAP's own re-measure rule applies; re-run the census script and the floor gate at 252 plan time
