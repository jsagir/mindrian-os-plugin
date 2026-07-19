---
kind: rca
slug: handoff-eureka-entity-noise-2026-07-19
status: resolved_offline
created: 2026-07-19
updated: 2026-07-19
origin_machine: Windows (C:\Users\PC) - NOT the dev workspace
target_machine: dev workspace (/home/jsagi/dev/MindrianOS-Plugin/)
resume_with: /gsd-debug handoff-eureka-entity-noise-2026-07-19
canon_parts: [7, 9, 11]
related: SEED-070, docs/RCA-TEMPLATE.md
---

## Current Focus (2026-07-19, gsd-debugger -- cwd theory VERIFIED, fix in progress)

reasoning_checkpoint:
  hypothesis: "tier2_model is structurally 0 because resolveAnthropicKey()'s only dev-reachable leg
    (process.cwd()/.env) does not resolve in real invocation. VERIFIED by tracing the actual
    invocation sites: .mcp.json launches bin/mindrian-mcp-server.cjs with NO cwd field and the
    server never process.chdir()s, so process.cwd() = the host launch dir (never the plugin repo
    root, never the room). entity-extract runs in-process off that cwd (tool-router http path,
    eureka-command maybeExtractFirst, research-filing.runPostFilingExtraction). Legs 1/2 fail too
    (Claude Code uses OAuth not ANTHROPIC_API_KEY; ~/.mindrian.env has no key). All three legs fail
    -> keyPresent=false -> tier-2b never escalates -> tier2_model:0 in every real run. CONFIRMED."
  confirming_evidence:
    - "No process.chdir anywhere in lib/ or scripts/ (grep clean)."
    - ".mcp.json: mindrian-os server = node bin/mindrian-mcp-server.cjs, NO cwd field -> inherits host cwd."
    - "bin/mindrian-mcp-server.cjs never chdir()s; roomDir = path.resolve(MINDRIAN_ROOM||'./room') is relative to cwd, cwd is never normalized to repo root."
    - ".env is gitignored (line 48) AND absent from package.json files[] -> NEVER shipped to users; the dev key is only reachable via the cwd leg, which real invocation never satisfies."
    - "Matches the two real status.json (aion-eureka-synergy, jonathan-sagir): classifier_source embedding, tier2_model 0."
  falsification_test: "If entity-extract were invoked with cwd=repo root in real MCP use, tier2_model would be >0. It is 0 in every real status.json -> cwd is NOT the repo root -> hypothesis holds."
  fix_rationale: "Root cause is the key gate. FIX B (module-relative .env leg via __dirname) makes
    tier-2b's NOISE filter reachable regardless of cwd -> addresses the origin so 'Windows'/'CSFs'
    get contextually dropped. FIX A (stamp evidenceTier + exclude LOW-CONFIDENCE/fallback entities
    from pairing) is the keyless-safe load-bearing fix: the observed junk rides in as low-confidence
    embedding best-guess WHAT (source:'embedding'), so excluding the low-confidence tier is what
    actually removes it. FIX C (_coerceLabels drop) hardens the tier-2b garbage path that FIX B makes live."
  blind_spots: "REQ-5 (test-218-noise-reduction) asserts post-extraction entity pairs rank NON-EMPTY.
    Must MEASURE the evidenceTier distribution of REQ-5's minted entities before finalizing the
    exclusion predicate -- if they are EmbeddingConfident/ModelConfirmed the exclusion is safe; if any
    are low-confidence/fallback the predicate or the test contract needs reconciling. Also: prior
    session was blocked by a misfiring check-card-fire.cjs Stop-hook -- watch for continuation interrupts."

reconciliation_with_session_manager: "Independently reached the SAME correction the session-manager
recorded below (lines 62-101): the handoff's 'exclude source:fallback' + '_coerceLabels' moves do NOT
touch the real noise vector (embedding-sourced low-confidence WHAT). The load-bearing lever is
excluding the LOW-CONFIDENCE tier. NOTE the file target: the scaffold/container exclusion machinery
that drops the 55 pairs lives in scripts/eureka-portfolio-report.cjs (the 4b pass, ~lines 1039-1064),
NOT room-native-substrate.cjs -- pairing enumerates `indexed` (SELECT nodes + embeddings), not techMap.
The new unverified-entity exclusion is added there as a third additive class, reusing that pattern."

next_action: "Apply FIX B (mva-classifier.cjs module-relative .env leg), then stamp evidenceTier in
entity-extract.cjs, then MEASURE REQ-5 evidenceTier distribution, then add the report 4b exclusion,
then FIX C (_coerceLabels drop). Run tests/run-all-218.sh + test-218-what-why-classifier.cjs + mva tests."

## Evidence (2026-07-19, dev-workspace verification against `seeds/host-runtime-research-2026-07-18` @ 0703ebe4)

- **BLOCKER 2 refuted on dev tree:** `lib/core/eureka/entity-extractor.cjs`, `entity-classifier.cjs`,
  `scripts/entity-extract.cjs` all present and intact. Confirmed on both `main` and this branch.
  Was purely a stale Windows plugin-install-cache artifact, not a dev-workspace defect.
- **Lead A confirmed exact:** `entity-extractor.cjs:143` `PROPER_RUN` regex matches the quoted
  snippet verbatim, same line number.
- **Lead B confirmed exact:** `entity-classifier.cjs` `DEGRADE-TO-PASSTHROUGH` contract, `_fallback()`
  (line 112), `_coerceLabels()` (line 120), `T-T2-01` comments (lines 69, 119) all present as quoted.
- **Open question 1 answered:** no threat-model doc for `T-T2-01` exists anywhere in the repo
  (`docs/`, phase 218/219 plans, or elsewhere). It is an inline-only label, never registered. Not a
  missing-doc research gap -- there is nothing to find.
- **Open question 2 answered:** `tests/test-218-what-why-classifier.cjs` asserts the passthrough
  contract -- every fail-open leg (no key, throw, non-JSON, non-2xx -> `source:'fallback'`) and the
  embedding-degrade leg (`classifier_source` must be `'embedding'`, never silently `'fallback'`).
  Read this file before touching `_coerceLabels()`.
- **Open question 3 answered, with a third outcome the doc didn't anticipate:** real
  `.mindrian/entity-extract/status.json` files exist for two populated rooms on this machine:
  - `aion-eureka-synergy` (2026-07-14 run, the same room Phase 218's own research trail used):
    `classifier_source: "embedding"`, `tier2_escalated: 206`, `tier2_model: 0`.
  - `jonathan-sagir` (2026-07-15 run): `classifier_source: "embedding"`, `tier2_escalated: 48`,
    `tier2_model: 0`.
  - (`iia-deeptech-centers` came back `classifier_source: "fallback"` but the room itself was empty,
    0 artifacts -- not a signal about the classifier, just an empty room.)
  Neither pure `fallback` (per this doc's framing, "gate never ran") nor `model` ("noise survived a
  real pass") -- `tier2_model: 0` in every real run checked means the LLM escalation tier has never
  once fired on this machine. See hypothesis above for why.
- **Note:** `~/.mindrian.env` exists but has no `ANTHROPIC_API_KEY` line. The plugin repo's own
  `.env` does have one (presence only checked, value not read/printed).

## Verified Root Cause + Corrected Fix Direction (2026-07-19, session-manager)

**Root cause CONFIRMED against the real tree.** Extraction is gated at `scripts/entity-extract.cjs:737`
(`keyPresent = resolveAnthropicKey() !== null`). `resolveAnthropicKey()` has one cwd-independent key
source (`~/.mindrian.env`), which has no key here; its third leg reads `process.cwd()/.env`, but real
runs execute with cwd = the room, not the repo. So tier-2b (the LLM) never resolves a key and never
fires. That is exactly why `tier2_model: 0` in every status.json. The cwd theory holds.

**The handoff doc's proposed fix aims at the wrong target** (it predates the two-tier refactor). The
NOISE label lives ONLY in tier-2b. Tier-2a (embedding) sorts WHAT vs WHY and has no NOISE class, so
"Windows"/"CSFs" are neither a bad model pass nor `source:'fallback'` -- they ride in as
`source:'embedding'` low-confidence WHAT best-guesses. This kills two of the doc's three moves:
excluding `source:'fallback'` from pairing never touches embedding-sourced noise, and tightening
`_coerceLabels()` hardens a path the term never traveled. Do NOT do those as the primary fix.

**Correct fix (verified, smaller than the doc feared):**
1. LOAD-BEARING (works with or without a key): the low-confidence signal already exists at
   `routeLabel()` (`entity-extract.cjs:~403`) but is stamped only on WHY terms (`~line 564`) and
   dropped on the WHAT side (`~line 411`). Thread it onto WHAT entities and persist it as a node prop.
   Then have `lib/core/eureka/room-native-substrate.cjs` exclude low-confidence + `source:'fallback'`
   entities from pairing, REUSING the existing scaffold/container exclusion machinery (the same path
   that already drops 55 scaffold pairs).
2. DEV-ENABLEMENT (optional): add a cwd-independent module-relative `.env` leg to
   `resolveAnthropicKey()` (walk up from `__dirname` via `path.join`, cross-platform) so tier-2b's
   NOISE filter can actually run and be tested. Keyless-safe (installed caches have no `.env` -> stays
   null -> graceful degrade preserved). LOCAL to Anthropic, not Brain, so Canon Part 8 holds.
3. Before touching the WHAT/WHY routing or `entity-classifier.cjs`, read
   `tests/test-218-what-why-classifier.cjs` -- preserve `no-key -> source:'fallback'` and
   `embedding-degrade -> classifier_source must be 'embedding'`. Do NOT change `_fallback()`
   (documented T-T2-01 fail-open contract).

**CORRECTION (session-manager, later same day): the fix WAS subsequently applied.** The two
paragraphs above were written from a mid-flight snapshot and are superseded. The `check-card-fire.cjs`
Stop-hook interruptions were real (still logged in `.planning/debug/resolved/card-fire-block-surface.md`,
and the over-enforcement WATCH stands), but they did NOT prevent completion. The gsd-debugger + a
concurrent worker reconciled edits on disk. What actually landed: FIX A `evidenceTier` stamping in
`scripts/entity-extract.cjs`; the low-trust pairing exclusion + Decision-8 `hasVerifiedEntity` guard in
`scripts/eureka-portfolio-report.cjs` (the 4b pass -- NOT `room-native-substrate.cjs` as my step-1 above
guessed; pairing enumerates SELECT nodes there); FIX B module-relative `.env` leg in
`lib/core/mva-classifier.cjs`; FIX C `_coerceLabels` drop-to-`noise` in `lib/core/eureka/entity-classifier.cjs`;
new regression test `tests/test-218-low-trust-exclusion.cjs`. Frontmatter is now `awaiting_human_verify`.

next_action: HUMAN verification (this is a human-verify checkpoint, not an autonomous continuation). Two
open items: (1) live keyed acceptance -- run `entity-extract` against a real keyed room and confirm
`tier2_model > 0` and no "Windows"/"CSFs" in top-N; BLOCKED here because the repo `.env` key now resolves
but the live Anthropic call returns non-2xx (key looks invalid/expired -- a VALID key is required to
observe the live number). (2) multi-session collision -- 5 active sessions touched this tree; confirm no
other session has since modified these files and re-run `bash tests/run-all-218.sh` before committing.
Do NOT commit until human confirms. The offline mechanism is proven (see test results below).

# Handoff: eureka entity-extraction noise + two infra blockers

## READ THIS FIRST: provenance warning

This report was produced on a **Windows machine that is not the dev workspace**.
CLAUDE.md names `/home/jsagi/dev/MindrianOS-Plugin/` as THE ONLY DEV WORKSPACE.
The machine that produced these findings has two MindrianOS trees, neither of
which is authoritative:

| Tree | Path | Status |
|------|------|--------|
| Install cache | `~/.claude/plugins/mindrian-os` | v1.15.3-beta.28, **missing `lib/core/eureka/` entirely** |
| Clone | `C:\Users\PC\Projects\mindrian-os-plugin-clone` | branch `seeds/host-runtime-research-2026-07-18`, 6 commits AHEAD of origin/main, UNPUSHED |

**Every code-level claim below is therefore PROVISIONAL and must be re-verified
against the dev workspace before any fix is planned.** The file paths, line
numbers, and quoted snippets came from the clone, which may itself be a stale
mirror. Treat this document as a set of leads, not a set of confirmed defects.

## BLOCKER 0: unpushed work on the origin machine

The clone is ahead of `origin/main` by 6 commits, all on a non-main branch:

```
0e0234b4 seeds: SEED-070 live eureka run 2026-07-19 + the stale-bytes lesson
2b813ec7 seeds: SEED-069 open core, where the boundary is a NETWORK boundary
25a93124 seeds: SEED-068 host matrix -- Tier 0 passes universally; tier model inverted
0a3651f3 seeds: SEED-068 be infrastructure, not an application
6921ab14 seeds: SEED-067 scope correction -- BYO-sub is forbidden by Anthropic
2a21125d seeds: SEED-062..067 host-runtime research
```

Uncommitted on top: `room/STATE.md`, `room/decisions/ROOM.md`,
`room/product-evolution/ROOM.md`.

**The dev machine cannot see any of this.** Push the branch (or cherry-pick
SEED-070, which is directly relevant) before working the items below, or the
dev machine will re-derive lessons already recorded.

Note SEED-070 already captured a related conclusion from an earlier run the
same day: *"Not too few entries - too few worlds. Never evaluate eureka on a
single-project room."* That lesson stands and is not superseded by this report.

## What was attempted

Requested: test the eureka engine on a relevant room. Selected
`nv-diamond-meg` (NV-center magnetometry, ~20 artifacts across
problem-definition, competitive-analysis, market-analysis, solution-design)
over `mindrian-os-self` (4 entries).

## BLOCKER 1: room_bind does not propagate

`room_bind` reports success, every downstream read resolves elsewhere.

```
room_bind({room:'nv-diamond-meg', sessionId:'69627f0d-...'})
  -> {ok:true, bound:true, primary:'nv-diamond-meg', source:'explicit'}

room_state_bound()
  -> room_dir: C:\Users\PC\MindrianRooms\mindrian-os-self        WRONG

intelligence eureka-run (context:'nv-diamond-meg')
  -> wrote C:\Users\PC\MindrianRooms\mindrian-os-self\.mindrian\eureka\   WRONG
```

Two sub-findings:
- The bind never reaches the eureka room resolver; it falls back to the active room.
- `context` on the `intelligence` tool is not a room selector. If callers are
  expected to steer rooms with it, that is undocumented; if not, it silently
  accepts and ignores a room name, which reads as success.

**Consequence: the requested test never ran.** Everything below describes a
run against the wrong, near-empty room.

## BLOCKER 2: installed plugin has no eureka code

```
~/.claude/plugins/mindrian-os/lib/core/eureka/           MISSING
~/.claude/plugins/mindrian-os/scripts/entity-extract.cjs MISSING

Projects/mindrian-os-plugin-clone/lib/core/eureka/       EXISTS
Projects/mindrian-os-plugin-clone/scripts/entity-extract.cjs EXISTS
```

The `mos:*` MCP tools on this machine are running bytes that do not contain the
engine being debugged. This is the same stale-bytes class SEED-070 already
flagged. **Whether this reproduces on the dev machine is UNKNOWN and is the
first thing to check.**

## Run result (wrong room, 4 entries)

| Signal | Value |
|--------|-------|
| Runtime | 0.9s, live local embedding spine, sqlite-vec |
| Graph nodes loaded | 751 |
| Typed edges (CONVERGES) | 3 |
| Cohort techs | 15 |
| Pairs scored | 50 |
| Scaffold pairs excluded | 55 |
| Top composite | 0.453 |
| Banked | **0 of 25** (critic resolved all as `general_shallow`) |
| Tail quadrant | INSUFFICIENT STRUCTURE (15 techs vs MIN_COHORT 30) |

**What worked, and should not be regressed:** the engine refused to bank
anything, printed the honest degenerate tail verdict instead of dressing up
noise, stamped `strategic_fit 0.25` weak-dim on all 25, and the provenance
table told the truth about its own substrate. The honest-degrade contract
(SEED-058/059) held.

**What failed:** rank 1 through 5 are scaffolding paired with junk entities.

```
rank 1 | memory_artifact:_root:ROOM x entity:entity-extract:1fb55d: CSFs    | 0.453
rank 2 | memory_artifact:_root:ROOM x entity:entity-extract:b3a83a63: Windows | 0.453
```

## Lead A: tier-1 extractor is a greedy Title-Case regex

`lib/core/eureka/entity-extractor.cjs:143` (clone):

```js
const PROPER_RUN = /\b([A-Z][A-Za-z0-9&.\-]*(?:[ \t]+[A-Z][A-Za-z0-9&.\-]*){0,2})\b/g;
```

Every match on a body-prose line becomes a candidate. Type defaults to
`'company'` when no heading lean applies. Defenses are three hand-curated Sets
(`STOPWORDS` function words only, `FRAMEWORK_TERMS`, `NOISE_TERMS`) plus
`FILENAME_RX` and `METADATA_FIELD_RX`. Cap `DEFAULT_MAX_PER_ARTIFACT = 25`.

- "Windows" passes every filter as a one-token Title-Case run.
- "CSFs" passes because `[A-Z][A-Za-z0-9]*` cannot distinguish an acronym from
  a company name. The stoplist knows `tam/sam/som/kpi/roi/mvp/poc`, not `CSF`.

Input is body prose of `.md` files (NOT file paths, NOT frontmatter).
`collectArtifacts()` in `scripts/entity-extract.cjs:236-303` sweeps every `.md`
in every non-dot section directory. "Windows" most plausibly came from prose
like "on Windows" in an ops note.

## Lead B: the fail-open path, and why the obvious fix is WRONG

`lib/core/eureka/entity-classifier.cjs` has two distinct failure paths. An
earlier draft of this analysis proposed flipping both to fail-closed. **That
was wrong and is retracted here.**

Fail-open at `_fallback()` is a **documented, threat-modeled contract**, not an
oversight. File header line 38-41:

> DEGRADE-TO-PASSTHROUGH CONTRACT: with no resolvable key, no available
> transport, a non-2xx response, a timeout, an unparseable body, or any other
> failure, this module returns the fallback [...] so the caller writes exactly
> today's behavior. It NEVER throws.

Line 69 carries a threat id: `fail-open to today's behavior (threat T-T2-01)`.

Reversing it would break **Decision 8 (Tier 0 fully functional; graceful
degradation everywhere)**: no API key would mean zero entities, which means no
eureka substrate at all.

The corrected reading:

| Path | Line | Meaning | Correct behavior |
|------|------|---------|------------------|
| `_fallback()` | 112 | No key / no transport. **Model never ran.** | Fail OPEN. Correct as written. Do not touch. |
| `_coerceLabels()` | 127 | Model ran, returned an unusable value for this term. | Fail open here is the actual defect. |

Line 127: `labels[n] = (v && VALID_LABELS.has(v)) ? v : 'what';`

The model was asked, answered, and its answer was garbage - and that is
promoted to a confirmed entity. That is not graceful degradation.

## Proposed direction (NOT a plan, needs verification first)

A provenance split rather than a contract reversal:

1. Leave `_fallback()` fail-open. Tier 0 guarantee preserved.
2. Tighten `_coerceLabels()` so an unrecognized model response drops the term
   instead of defaulting it to `what`.
3. Stamp entities born from `source:'fallback'` with a distinct `evidenceTier`,
   and have `lib/core/eureka/room-native-substrate.cjs` exclude them from
   pairing. The exclusion machinery already exists: the run above dropped 55
   scaffold pairs and 0 container pairs.

Net effect: Tier 0 keeps writing nodes; eureka stops treating unverified regex
hits as opportunity candidates.

## OPEN QUESTIONS (blocking - do not skip)

1. **What is threat T-T2-01?** Referenced at `entity-classifier.cjs:69` and
   :119. The threat doc was never located. If fail-open was chosen to prevent
   an adversarial document from suppressing extraction by inducing classifier
   failure, then any tightening is a DoS surface and needs a different design.
2. **Which tests assert the passthrough contract?** Almost certainly some leg
   of `tests/run-all-*.sh` asserts "no key -> all `what`, source `fallback`".
   Find it before editing.
3. **What was `classifier_source` on the observed run?** Check `status.json`.
   This decides the whole question:
   - `fallback` -> the gate never ran; the provenance split is sufficient.
   - `model` -> tier-1 regex noise survived a REAL model pass, and the
     extractor itself needs replacing.
4. Does BLOCKER 2 (missing `lib/core/eureka/` in the install cache) reproduce
   on the dev machine, or is it an artifact of this Windows install?

## Tool evaluation (licensing cleared, adoption NOT recommended yet)

Raised during the session. Both are license-clean for commercial use; neither
addresses the defect above, and both are Python boundaries in a Node engine.

| Tool | Layer | License | Verdict |
|------|-------|---------|---------|
| [LangExtract](https://github.com/google/langextract) | extraction (would replace PROPER_RUN) | Apache 2.0, express patent grant. Obligations: ship LICENSE + NOTICE, state changes. Caveat: Google states it is "not an officially supported Google product" | Defer until open question 3 is answered |
| [MarkItDown](https://github.com/microsoft/markitdown) | ingestion (PDF/DOCX/PPTX -> md) | MIT. Preserve copyright notice | Genuinely wanted for `nv-diamond-meg` (arXiv papers, spec sheets, decks), but amplifies noise until the gate is fixed. Sequence matters |

On nested ICM specifically: LangExtract handles attribute-nested extraction via
few-shot `extraction_classes`. But ICM Layers 0-4 are the on-disk corpus
organization, not a structure inside the prose. You would not extract the ICM
hierarchy; you would extract differently per layer, using the layer as a schema
selector. That is dispatch design, buildable around any extractor including the
current one. It is not a reason to adopt a library.

## Suggested first moves on the dev machine

1. Push or cherry-pick the 6 unpushed seed commits (BLOCKER 0).
2. Confirm or refute BLOCKER 2 on the dev tree.
3. Answer open question 3 (`classifier_source` in `status.json`) - this is the
   cheapest measurement and it decides the fix.
4. Read T-T2-01 and the passthrough tests (open questions 1 and 2).
5. Only then open a GSD session for the provenance split.

Separately and independently: BLOCKER 1 (room_bind) is its own defect and
should get its own slug. It is not caused by, and does not depend on, anything
in the extraction pipeline.

## Verification gates this work must clear

Per CLAUDE.md before any fix is called done: Canon Part 8 Brain-boundary,
Tri-Polar three-surface (CLI + Desktop + Cowork), cross-platform, release
lockstep, no em-dashes, reuse-before-build.

## RESOLUTION (2026-07-19, gsd-debugger -- fix applied + self-verified)

root_cause: |
  tier2_model is structurally 0 in every real run because resolveAnthropicKey()
  (lib/core/mva-classifier.cjs) had NO cwd-independent path to the dev/plugin key.
  Its only key legs were process.env.ANTHROPIC_API_KEY (Claude Code uses OAuth, not
  a key), ~/.mindrian.env (no key here), and process.cwd()/.env (only resolves when
  cwd == the plugin repo root). VERIFIED by tracing every invocation site: .mcp.json
  launches bin/mindrian-mcp-server.cjs with NO `cwd` field, the server never chdir()s,
  and entity-extract runs in-process off that inherited host cwd (tool-router http
  path, eureka-command maybeExtractFirst, research-filing.runPostFilingExtraction) --
  so process.cwd() is never the repo root in real use. All three legs fail ->
  keyPresent=false -> tier-2b (the LLM NOISE classifier) never escalates -> tier2_model
  stays 0. The observed junk ("Windows"/"CSFs") therefore rides in as source:'embedding'
  LOW-CONFIDENCE WHAT best-guesses (the aion room: 399 confident + 206 low-confidence,
  tier2_model 0), NOT source:'fallback' -- so the handoff's original "exclude
  source:fallback" + "_coerceLabels" moves never touched the real noise vector.

fix: |
  Three coordinated changes (root cause + provenance split + hardening), plus a
  Decision-8 reconciliation the prior attempt missed:
  1. FIX B (root cause) lib/core/mva-classifier.cjs resolveAnthropicKey(): added a
     FOURTH, cwd-INDEPENDENT key leg -- a module-relative .env resolved from __dirname
     (path.resolve(__dirname,'..','..','.env')). Lets tier-2b's NOISE filter fire
     regardless of invocation directory. Keyless-safe (.env is gitignored + absent
     from package.json files[] -> installed caches have no .env -> returns null ->
     graceful degrade preserved). Cross-platform (path.resolve segments only). LOCAL
     -> Anthropic, never Brain (Part 8 holds).
  2. FIX A (provenance split) scripts/entity-extract.cjs: each surviving WHAT entity
     is stamped props.evidenceTier via the EXISTING writeEntityNode param --
     'low_confidence' for a no-LLM embedding best-guess, 'fallback' for the keyless +
     encoder-absent degrade, left unstamped ('None', trusted) for a confident
     embedding/model verdict. scripts/eureka-portfolio-report.cjs 4b pass: a candidate
     pair with EITHER endpoint stamped low_confidence/fallback is excluded from ranking
     (reusing the scaffold/container exclusion pattern, counted as
     low_trust_pairs_excluded), so unverified regex hits stop surfacing as
     opportunities.
  3. DECISION-8 GUARD (the missing piece that blocked the prior attempt): the low-trust
     exclusion fires ONLY when the room has at least one VERIFIED entity to surface
     instead (hasVerifiedEntity). A pure Tier-0 room (every entity unverified, e.g. no
     key + no encoder) keeps ranking non-empty rather than emptying -- preserving
     Decision 8 ("Tier 0 fully functional") and the REQ-5 contract. Without this guard
     the exclusion emptied REQ-5's ranked list (proven: post 0/0). With it, mixed rooms
     denoise (aion: drop the 206 low-confidence, keep the 399 confident) and Tier-0
     rooms stay productive.
  4. FIX C (hardening, now-live path) lib/core/eureka/entity-classifier.cjs
     _coerceLabels(): an unknown/missing model label now coerces to 'noise' (DROPS the
     term) instead of 'what'. Once FIX B makes tier-2b live, a garbage per-term model
     response would otherwise mint a trusted entity. The DEGRADE-TO-PASSTHROUGH
     contract (_fallback, whole-response fail-open) is UNTOUCHED, so the T-T2-01 DoS
     protection stands.

verification: |
  Self-verified offline/hermetic on the dev workspace:
  - tests/run-all-218.sh: PASS=14 FAIL=3. The 3 failures are PRE-EXISTING and unrelated
    (edge_write_failed: "table edges has no column named review_status" in the writer
    tests, and T-218-VD-5 leg 5 encoder_unavailable) -- all confirmed IDENTICAL on HEAD,
    none reference the changed logic.
  - tests/test-218-what-why-classifier.cjs: 22/22 (FIX C preserves the passthrough
    contract).
  - tests/test-218-noise-reduction.cjs (REQ-5): PASS (post 0/25) -- the guard keeps the
    Tier-0 room non-empty.
  - tests/test-218-low-trust-exclusion.cjs (NEW, wired into run-all-218.sh): 3/3 --
    stamping + mixed-room exclusion (drops the noise endpoint, verified pair survives) +
    Tier-0 guard (pure-unverified room still ranks, nothing excluded).
  - MVA (test-mva-from-brief 21/21, test-mva-dror-harness 5/5), test-216-room-substrate
    (47), test-215-portfolio-report (18), test-218-cohort-stratification (2/2),
    test-218-scaffold-pair-filter (2/2): all green.
  Gates cleared: Part 8 (no new egress; entity-classifier.cjs still the sole Anthropic
  carrier; zero-network suite gate PASS), Tri-Polar (all changes in shared lib/core +
  scripts, no surface-specific code, key leg is now MORE surface-robust), cross-platform
  (path.resolve segments), release lockstep (no version files touched), no em-dashes,
  reuse-before-build (reused resolveAnthropicKey, writeEntityNode evidenceTier param, the
  4b exclusion pattern), render-coverage + orchestration-projection + born-wired: PASS.

files_changed:
  - lib/core/mva-classifier.cjs (FIX B: module-relative .env key leg)
  - lib/core/eureka/entity-classifier.cjs (FIX C: _coerceLabels drop-on-garbage)
  - scripts/entity-extract.cjs (FIX A: evidenceTier provenance stamping)
  - scripts/eureka-portfolio-report.cjs (FIX A: low-trust pairing exclusion + Decision-8 guard)
  - tests/test-218-low-trust-exclusion.cjs (NEW regression test, 3 legs)
  - tests/run-all-218.sh (wire the new test)

HUMAN-VERIFY LEG (live, needs a VALID key): the offline suite proves the MECHANISM.
The live acceptance -- run entity-extract against a real keyed room (e.g.
aion-eureka-synergy) and confirm status.json now shows tier2_model > 0 and the eureka
top-N no longer surfaces "Windows"/"CSFs" -- is the human step. NOTE: on this machine
resolveAnthropicKey() now RETURNS a key (repo .env, length 108) but the extraction still
degraded to classifier_source:'fallback' with tier2_model 0, which means the live
Anthropic call returned non-2xx -- the repo .env key looks INVALID/EXPIRED. A valid key
is required to observe tier2_model > 0.

## DISPOSITION (2026-07-19, gsd-execute -- resolved_offline, human checkpoint cleared)

status -> `resolved_offline` (deliberately NOT `resolved`).

The fix was verified and committed under a two-plan GSD phase (Phase 231):

- **231-01** (commit `3000d06e`, feat): FIX A evidenceTier provenance stamping
  (scripts/entity-extract.cjs) + low-trust pairing exclusion with the Decision-8
  hasVerifiedEntity guard (scripts/eureka-portfolio-report.cjs) + FIX B module-relative
  .env key leg (lib/core/mva-classifier.cjs) + FIX C _coerceLabels drop-on-garbage
  (lib/core/eureka/entity-classifier.cjs) + tests/test-218-low-trust-exclusion.cjs.
- **231-02** (commit `58c1f773`, fix): the CR-01 duplicate-name evidenceTier
  reconciliation regression test (tests/test-218-duplicate-entity-reconciliation.cjs)
  + suite wiring (tests/run-all-218.sh). The CR-01 reconcileEvidenceTierAcrossDuplicateNames()
  IIFE itself physically landed in 3000d06e since it shares scripts/entity-extract.cjs
  with FIX A.

**Accepted on OFFLINE PROOF (checkpoint Path B).** The full hermetic suite is accepted
as sufficient: 22/22 what-why-classifier contract, 3/3 low-trust-exclusion,
1/1 CR-01 duplicate-entity-reconciliation, Phase 218 PASS=15/FAIL=3 (the 3 failures
pre-existing + unrelated: the `edges` table `review_status` schema gap in
test-218-edge-vocab + test-218-entity-writer, and the `encoder_unavailable` leg 5 in
test-218-eureka-auto-extract), Phase 211 PASS=10/FAIL=0. The offline suite proves the
MECHANISM (stamping, exclusion, Decision-8 guard, reconciliation, key-leg resolution).

**DEFERRED (fast-follow, NOT done):** the LIVE keyed acceptance -- `tier2_model > 0` on a
real room (e.g. aion-eureka-synergy) with a VALID Anthropic key, plus visual confirmation
that the eureka top-N no longer surfaces "Windows"/"CSFs". This is BLOCKED because the repo
.env key currently RESOLVES but returns non-2xx (looks expired/invalid) -- an ENVIRONMENT
fact, not a code fact. `tier2_model > 0` proves the key is valid; it does not additionally
prove the code, which the offline suite already covers. When a valid key is available, run
the Path A steps in 231-02-PLAN.md's checkpoint to promote this RCA to `resolved` and move
it to `.planning/debug/resolved/`.

Committed on branch `seeds/host-runtime-research-2026-07-18` (NOT main), per navigator
decision -- this branch already carries the phase plan/execute commits; the navigator will
merge to main themselves. Because the live leg is deferred, this file stays in
`.planning/debug/` (not moved to `resolved/`) per the plan's approved-offline path.
