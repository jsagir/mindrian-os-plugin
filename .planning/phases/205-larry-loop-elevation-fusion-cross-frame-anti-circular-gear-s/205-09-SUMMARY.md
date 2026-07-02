---
phase: 205-larry-loop-elevation
plan: 09
subsystem: lab-eval-harness
tags: [plurai, intellagent, eval-suite, llm-as-judge, golden-data, cross-frame, horizontal-elevation, part8, lab-side, no-fabrication]

# Dependency graph
requires:
  - phase: 196-02
    provides: "Plurai baseline pattern + the network-optional DEGRADE idiom (baseline_deferred) the suite reuses"
  - phase: 205-07
    provides: "FUSION 'offer, never assert' invariant that the corrected Presumptuous label enforces"
provides:
  - "lab/plurai-suite/judges.cjs: three judge specs (one per reach/behavior) with the seeded thread ids + CORRECTED label ladders"
  - "lab/plurai-suite/suite-manifest.cjs: buildSuite() with the independent-judge (no-circularity) guard + Part-8 synthetic personas"
  - "lab/plurai-suite/golden-loader.cjs: loadGolden() ground-truth anchor from the real Test-6 analysis; refuses to fabricate; synthetic-coverage seam OFF"
affects: [202, 205-live-reseed-followup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LLM-as-a-judge SUITE (one judge per reach/behavior), not one evaluator (navigator insight 'larryreacts needs a plurai')"
    - "Independent-judge guard: judge_id !== driving_brain_id asserted at build; fails closed on circularity"
    - "Ground-truth anchor vs synthetic coverage: real observed records are source:'real' + anchor:true; the Bruce-harness generation seam is separate, marked synthetic, defaulted OFF"
    - "No-fabrication degrade: absent golden source -> marked-pending, zero uploads, zero synthesized records"

key-files:
  created:
    - lab/plurai-suite/judges.cjs
    - lab/plurai-suite/suite-manifest.cjs
    - lab/plurai-suite/golden-loader.cjs
    - tests/test-205-plurai-suite.cjs
  modified: []

key-decisions:
  - "DEVIATION 1: raw Test-6 transcript is confirmed gone; loadGolden parses Lawrence's ANALYSIS (the 5 real misses + 2 should-have-said + the punchline quip) as the ground-truth anchor; a separate synthetic-coverage seam (Bruce harness) is defaulted OFF and never fired"
  - "DEVIATION 2: corrected the horizontal ladder from [No Connection / Hedged / Confident] to [No Connection / Hedged / Presumptuous]; Confident is a second failure mode, not the ideal (Test 6 doctrine: hedged is the target, presumptuous is not fine)"
  - "No live evals-MCP mutation fired; the live re-seed of the three seeded judge threads to the corrected labels is surfaced as a navigator follow-up via reSeedRequirements()"
  - "Did NOT git-track the golden source file: it carries real identifiers (aronhime@jhu.edu, jsagir@gmail.com) and would violate the no-real-names rule for this public-leaning repo; the loader degrades to pending when it is absent"

requirements-completed: [SCOPE-9]

# Metrics
duration: 20min
completed: 2026-07-02
---

# Phase 205 Plan 09: Behavior Harness as a Plurai Eval Suite Summary

**Built the lab-side Plurai eval SUITE (one LLM-as-a-judge per reach/behavior, seeded with the three existing thread ids), an independent-judge no-circularity guard, and a golden-data loader that anchors on the five REAL Test-6 misses and refuses to fabricate ground truth - with the horizontal ladder corrected from Confident to Presumptuous to match FUSION's offer-never-assert invariant.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-02
- **Tasks:** 2 (both auto)
- **Files created:** 4 (3 lab modules + 1 test)

## Accomplishments

- **`lab/plurai-suite/judges.cjs`** - three judge specs, one per reach/behavior: horizontal-elevation (PRIMARY, thread `392ec50f`), anti-circular (thread `127f8f53`), reach-gate (thread `f989b4cf`, over the six frozen reach_ids + `none` + the Shape-F 188 gate). Each carries its label ladder, the correction record, and its re-seed requirement.
- **`lab/plurai-suite/suite-manifest.cjs`** - `buildSuite()` declares the suite and asserts the independent-judge rule (`judge_id !== driving_brain_id`) for every judge, failing closed on circularity. Carries three synthetic personas + generic doctrine only (Part 8). Declares the evals-MCP tool surface but fires no live mutation. `reSeedRequirements()` surfaces the deliberate navigator follow-up.
- **`lab/plurai-suite/golden-loader.cjs`** - `loadGolden(sourcePath)` deterministically parses Lawrence's Test-6 analysis into 8 ground-truth records (5 misses -> No Connection, 2 should-have-said -> Hedged, 1 punchline quip -> Presumptuous), each `source:'real'`, `anchor:true`. Absent source -> marked-pending, zero uploads, zero fabricated. Exposes the `generateSyntheticCoverage()` Bruce-harness seam (OFF by default, never fired) and the `OPTIMIZE_MODE='pending'` LLM/SLM seam.
- **`tests/test-205-plurai-suite.cjs`** - 21 assertions across the six required checks (a-f). All green.

## How the real-anchor-vs-synthetic line is enforced in code

The two are structurally separated so a synthetic record can never masquerade as observed:

- **Real anchor (the tether):** `loadGolden()` is the ONLY producer of golden records. Every record it emits is hard-set to `source:'real'`, `anchor:true`, and is derived byte-for-byte from `parseAnchor()` over `test-6-source.md` (the numbered misses, the quoted should-have-said lines, the punchline quip). There is no code path in `loadGolden` that invents a record.
- **No-fabrication guard:** if the source file is absent, `loadGolden` returns `{status:'pending', records:[], uploads:0, fabricated:0}` and synthesizes nothing. Live-proven: `loadGolden('/tmp/nope.md')` -> `{status:'pending',records:0,uploads:0,fabricated:0}`.
- **Synthetic coverage (separate, marked):** `generateSyntheticCoverage()` is a DIFFERENT function, defaulted OFF (`enabled !== true` -> pending, `generated:0`), with no live client bound so it never fires. Its contract is that any record it ever produces is tagged `source:'synthetic'`, `generated:true` - the test asserts no `loadGolden` record is ever flagged generated.
- **Part-8 negative guard in the test:** the manifest is scanned for real tester identifiers (`aronhime`, `jsagir@gmail.com`, `jhu.edu`, `mordi`, `eli`, `gaurav`) and must carry none.

## Corrected labels + flagged live-re-seed follow-up

- **DEVIATION 2 applied:** horizontal-elevation labels are now `[No Connection / Hedged / Presumptuous]`, not `[.../Confident]`. Rationale (Test 6 verbatim): "Always careful, cautious, hedged... NEVER confident... Being presumptuous is not [fine]." Confident is a second failure mode; Presumptuous (overclaimed / asserted as fact) is the correct negative, matching FUSION 205-07 "offer, never assert". The miss-#2 punchline quip is its exemplar.
- **Live re-seed is a navigator follow-up, NOT this build.** The three seeded Plurai threads still carry their original samples; no `start_evaluator` / `upload_data` / re-seed was fired. `reSeedRequirements()` returns the one required action: re-seed thread `392ec50f` (horizontal-elevation) to `[No Connection / Hedged / Presumptuous]`. The other two judges' labels are unchanged and need no re-seed.

## Part-8 lab-side confirmation

- All three source modules live under `lab/plurai-suite/` (never `lib/`, never a shipped path). Grep-confirmed: `git status` shows only `lab/` + `tests/` changed; `.claude-plugin/plugin.json` and `package.json` untouched.
- No Python added to any shipped path; the suite targets the already-installed `evals` MCP plugin (lab-side), no new install on the user machine.
- Manifest carries synthetic personas + generic doctrine only; `part8.user_data === false`.

## Deviations from Plan

### Navigator-approved deviations (documented, honored)

**1. [Navigator-approved] DEVIATION 1 - synthetic reconciliation, no raw transcript**
- **Issue:** The plan assumed `loadGolden` ingests a raw Test-6 conversation transcript. That transcript is confirmed gone (not recoverable).
- **Resolution:** `loadGolden` parses Lawrence's ANALYSIS (`test-6-source.md`) for the five real misses + two should-have-said lines + the punchline quip as the ground-truth anchor. A separate, clearly-marked synthetic-coverage seam (the Bruce harness) is defaulted OFF for breadth generation later. The no-fabrication rule holds: the 5 real misses are the only observed tether.
- **Files:** lab/plurai-suite/golden-loader.cjs

**2. [Navigator-approved] DEVIATION 2 - corrected label schema**
- **Issue:** The plan's horizontal ladder was `[No Connection / Hedged / Confident]`. Test 6 doctrine states hedged is the target and confident is wrong.
- **Resolution:** Relabeled to `[No Connection / Hedged / Presumptuous]`; documented in `judges.cjs.corrected` and flagged for live re-seed.
- **Files:** lab/plurai-suite/judges.cjs, lab/plurai-suite/golden-loader.cjs

### Auto-fixed issues

**3. [Rule 2 - Part 8 / no-real-names] Did NOT git-track the golden source file**
- **Found during:** Task 2 (self-check of the golden anchor).
- **Issue:** `lab/plurai-suite/golden/test-6-source.md` is present on disk (navigator-staged) but untracked and NOT gitignored. It contains 10 real-identifier hits (`aronhime@jhu.edu`, `jsagir@gmail.com`). Committing it to this commercial/public-leaning repo would violate the no-real-names hard rule and Part 8.
- **Fix:** Left it untracked (did not `git add` it). The loader degrades to `pending` when the file is absent, so a fresh checkout is correct-by-design (no fabrication). See Threat Flags for the navigator follow-up.
- **Files modified:** none (deliberate non-commit).

**Total deviations:** 2 navigator-approved + 1 auto-fixed (Part 8).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: pii-in-untracked-source | lab/plurai-suite/golden/test-6-source.md | Real identifiers (aronhime@jhu.edu, jsagir@gmail.com) in a non-gitignored, currently-untracked file. Navigator follow-up: either add `lab/plurai-suite/golden/` to `.gitignore` (like docs/testers) OR scrub PII to pseudonyms before any tracking. Do NOT `git add` as-is. |

## Navigator follow-ups (deliberate, out of this build)

1. **Live re-seed** the horizontal-elevation Plurai thread `392ec50f` to `[No Connection / Hedged / Presumptuous]` (via the evals MCP: start_evaluator / upload_data). `reSeedRequirements()` enumerates it.
2. **Gitignore or scrub** `lab/plurai-suite/golden/test-6-source.md` (see Threat Flags).
3. **Optimize decision** (LLM diagnostic-accuracy-first vs SLM deployable-guardrail) - resolve `OPTIMIZE_MODE` after the Bruce harness runs.
4. **Golden upload** - once the source is PII-safe, wire `loadGolden` output through the evals-MCP `upload_data` path for the seeded threads.

## Verification (actual output)

```
node tests/test-205-plurai-suite.cjs
...
PASS - 21 assertions green (205-09 Plurai suite).

em-dash check: CLEAN: no em-dashes in our code
lab-only check: CLEAN: only lab/ + tests/ changed
plugin.json / package.json: untouched
loadGolden('/tmp/nope.md') -> {"status":"pending","records":0,"uploads":0,"fabricated":0}
```

## Task Commits

1. **Task 1 (suite + judges)** - `de6efe60` (feat)
2. **Task 2 (golden loader)** - `5472fa73` (feat)
3. **Test** - `aa505c74` (test)

All on branch `workspace/phase-205-09`.

## Self-Check: PASSED
- FOUND: lab/plurai-suite/judges.cjs
- FOUND: lab/plurai-suite/suite-manifest.cjs
- FOUND: lab/plurai-suite/golden-loader.cjs
- FOUND: tests/test-205-plurai-suite.cjs
- FOUND commit de6efe60 (Task 1)
- FOUND commit 5472fa73 (Task 2)
- FOUND commit aa505c74 (test)

---
*Phase: 205-larry-loop-elevation-fusion-cross-frame-anti-circular-gear-s*
*Completed: 2026-07-02*
