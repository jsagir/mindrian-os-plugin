# Phase 272: Deferred Scope

**Filed:** 2026-08-31, plan 272-11 (phase close)

Phase 272 exists because Phase 134 was tracked complete while the actual port code did not
exist anywhere in the repo (`.planning/debug/phase-134-python-elimination-false-complete.md`,
`severity: blocker`). That RCA's own lesson is the reason this document exists: tracking must
never again say more than the evidence supports. Every item below is something this phase
genuinely did NOT do, named explicitly with its Python-dependency status, where it is tracked,
and whether a user-facing command is still affected. Nothing here is implied by silence in
`272-11-SUMMARY.md` -- if it is not shipped, it is named here.

For what DID ship, see `.planning/REQUIREMENTS.md`'s `PYPORT-01..07` section and the ten
plan SUMMARYs (`272-01-SUMMARY.md` through `272-10-SUMMARY.md`).

---

## 1. `lib/core/rs-differential-scorer.cjs`'s `computeLsaCosine` and `computeBertCosine`

**What it is:** two embedded Python bridges inside the differential-scoring module --
`computeLsaCosine` spawns `python3` with an inline LSA-cosine script (local pairwise bridge);
`computeBertCosine` spawns `rs-pinecone-bridge.cjs` (see item 2 below) for a BERT-cosine
comparison against the external Pinecone corpus.

**still requires Python:** yes, both.

**Why deferred:** neither is dispatch-wired to `rs-backend-dispatch.cjs`. The `computeBertCosine`
half is Mode-B/C-adjacent (external corpus retrieval, descoped by D-10, see item 4). The
`computeLsaCosine` half is a separate, smaller Canon Part 7 carve-out -- `272-CONTEXT.md`'s own
Phase Boundary never named `rs-differential-scorer.cjs` as a porting target; its `PYTHON_BIN`
spawn and embedded `lsaBridgeScript` remain exactly as they were before this phase started.

**Tracked where:** this document (newly named here; no prior debug file or seed covers it
specifically). Needs a new seed/phase entry if a future phase decides to port it.

**User-facing command still affected:** yes -- any caller of `rs-differential-scorer.cjs`'s
`scoreMeasured` path still requires a working `python3` with `sklearn`/`sentence-transformers`
on the machine for both cosine computations. Not one of the three original F-8 dispatch-gated
callers; a separate scoring utility.

---

## 2. `lib/core/rs-pinecone-bridge.cjs`

**What it is:** wraps `rs_cache.py::fetch_all_from_namespace`, spawning `python3 -c
<bridgeScript>` to retrieve records from the Pinecone-hosted external corpus.

**still requires Python:** yes.

**Why deferred:** this is Mode B/C's own external-corpus retrieval surface, explicitly descoped
by D-10 (see item 4) -- this phase's scope was Mode A internal only.

**Tracked where:** `272-CONTEXT.md` D-10, `272-RESEARCH.md` Open Question 1 / Finding C-4,
restated in `272-10-SUMMARY.md`'s "Deferred Scope" section, and here.

**User-facing command still affected:** yes -- any Mode B/C external-corpus retrieval path
(consumed by `rs-differential-scorer.cjs`'s `computeBertCosine` and by any future external-mode
caller) still requires `python3` plus a real `PINECONE_API_KEY`, which most end users do not
have. Not one of the three F-8 dispatch-gated callers.

---

## 3. `scripts/detect-reverse-salients.py`

**What it is:** the post-processing script `intelligence-cascade.cjs` spawns immediately after
the (now dispatch-gated) `compute-hsi.py`/`hsi-engine.cjs` step, reading `.hsi-results.json` and
performing arithmetic post-processing.

**still requires Python:** yes, but a lighter dependency than the rest of this phase's scope --
pure stdlib (`json`, arithmetic), zero PyTorch/sklearn/sentence-transformers import. It does not
carry the ~2GB heavy-ML-runtime burden this phase exists to remove.

**Why deferred:** out of PYPORT-04's own acceptance scope. `272-10-PLAN.md`'s action explicitly
instructed leaving this spawn site completely unchanged, unconditional, and un-gated; `272-10`
verified via a negative acceptance grep (zero occurrences of `rs-backend-dispatch` anywhere near
the `detect-reverse-salients.py` reference) that it was, in fact, left untouched.

**Tracked where:** `272-10-SUMMARY.md`'s "Deferred Scope" section, this document. Needs a
follow-up phase to either port it (small, stdlib-only, likely low-cost) or dispatch-gate it for
consistency even though it carries no heavy-runtime motivation on its own.

**User-facing command still affected:** yes -- `/mos:find-bottlenecks` (via
`intelligence-cascade.cjs`'s cascade pipeline) still requires a bare `python3` binary on PATH for
this one post-processing step, even when `MINDRIAN_RS_BACKEND=cjs` is active for every other step
in the same pipeline. This is a real, smaller, explicitly-flagged residual Python dependency, not
hidden inside a larger claim of "Python eliminated."

---

## 4. Mode B/C external Pinecone corpus

**What it is:** the full external-corpus control-plane and data-plane SDK surface in
`lib/core/rs_cache.py` (`create_index_for_model`, `has_index`, `describe_index`,
`upsert_records`, paged `list()`, `query`) -- an order of magnitude larger than D-01's original
"~40 lines" port estimate, which covered only the `/embed` inference call
(`rs-engine.py:1098-1130`, now ported as `lib/core/pinecone-inference.cjs`).

**still requires Python:** yes, the full surface.

**Why deferred:** D-10 (navigator ruling, 2026-08-31, post-research) descoped this to a follow-up
phase. Mode B/C also requires a `PINECONE_API_KEY` most end users do not have, so porting it
would not unblock the users this phase exists for even if built. This phase's scope was locked to
Mode A internal (local, `embedding-spine.cjs` ONNX pattern) plus `compute-hsi.py` Tier 1 only.

**Tracked where:** `272-CONTEXT.md` D-10, `272-RESEARCH.md` Open Question 1 / Finding C-4,
`272-10-SUMMARY.md`. Registered as real follow-up scope, not lost -- a future phase should port
`create_index_for_model`/`has_index`/`describe_index`/`upsert_records`/`list()`/`query` as its own
dedicated objective, not treat the `/embed`-only estimate as if it already covered this surface.

**User-facing command still affected:** yes -- any external/cross-room reverse-salient mode
(`/mos:find-bottlenecks` with an external corpus configured, or `rs-engine.py --mode
external`/`--mode hybrid`) still requires Python and a real `PINECONE_API_KEY`.

---

## 5. Change 3 (doctor `--drift --fix`'s I001 auto-stub visibility fix)

**What it is:** `.planning/debug/phase-134-python-elimination-false-complete.md` named this as
the process-level fix that prevents recurrence of Phase 134's own false-complete pattern:
`doctor --drift --fix`'s I001 auto-stub currently satisfies "a SUMMARY file exists" by writing a
stub that reads identically to a real completion in any status rollup that only checks file
presence, instead of propagating a visible UNVERIFIED/NEEDS-REVIEW flag.

**still requires Python:** n/a (not a Python-elimination concern; a GSD tracking-process fix).

**Why deferred:** named as secondary scope in `ROADMAP.md`'s Phase 272 entry
("Change 3 ... nominally in this phase's scope per ROADMAP.md but was not part of tonight's
discussion"), and `272-CONTEXT.md`'s own domain-boundary note confirms it was not discussed in
the session that produced this phase's decisions. **Confirmed here, explicitly: this was
genuinely NOT built by any of this phase's 11 plans.** Not silently dropped through omission --
named as out-of-scope from the start (`272-CONTEXT.md`'s Phase Boundary section) and never
revisited during execution. This is a real gap, stated plainly, not left ambiguous.

**Tracked where:** `.planning/debug/phase-134-python-elimination-false-complete.md` (Change 3,
kept open at `status: resolved-partial`), `272-CONTEXT.md`'s Phase Boundary and Deferred Ideas
sections, this document. Needs its own follow-up phase or quick task -- likely fix site per the
RCA is `lib/core/drift-baseline.cjs`'s `stubMissingSummary()`.

**User-facing command still affected:** no direct end-user command; this is an internal GSD
process-integrity gap (affects how accurately this repo's own phase-completion tracking reflects
reality for future contributors and navigators).

---

## 6. SEED-013's second frontmatter correction pass

**What it is:** `SEED-013` (`.planning/seeds/SEED-013-eliminate-python-from-user-machine-cjs-port.md`,
the source seed for both Phase 134 and this phase) had its own 2026-07-14 self-correction fix its
status field, but not Phase 134's plan/summary tracking one layer down -- the same root pattern
(a tracking artifact claiming more than the evidence supports), one level deeper, unaddressed.

**still requires Python:** n/a (a GSD tracking-artifact fix, not a Python-elimination concern).

**Why deferred:** `272-CONTEXT.md`'s Deferred Ideas section names this explicitly, carried
forward from the RCA, not discussed in the session that produced this phase's decisions.
**Confirmed here: not touched by any of this phase's 11 plans.**

**Tracked where:** `272-CONTEXT.md`'s Deferred Ideas section, this document. Needs a direct
frontmatter edit to `SEED-013`'s own file -- a small, mechanical follow-up, not roadmap-scale
work.

**User-facing command still affected:** no.

---

## 7. Full Python deletion

**What it is:** removing `scripts/rs-engine.py`, `scripts/compute-hsi.py`, `lib/core/rs_math.py`,
`rs_corpus.py`, `rs_hybrid.py`, `rs_cache.py`, and the sibling whitespace `.py` scripts from the
repo entirely, and dropping the `MINDRIAN_RS_BACKEND=python` fallback branch at all three
dispatch-gated callers.

**still requires Python:** yes -- by design, this is explicitly NOT attempted. Python stays as
the fallback behind `MINDRIAN_RS_BACKEND=python` indefinitely until a future phase makes the hard-
cutover call.

**Why deferred:** D-04 (locked decision). An env flag is the only real rollback mechanism for a
marketplace-distributed plugin -- a fix is not live until released and picked up, and a running
session never hot-reloads, so reverting a hard cutover would otherwise mean cutting an entirely
new release. This phase's job was to make CJS the default with Python as a safety net, not to
remove the safety net.

**Tracked where:** `272-CONTEXT.md` D-04, `272-RESEARCH.md`, this document (with the
encoder-divergence finding below as the specific, concrete reason a future hard-cutover decision
needs to be made deliberately, not by default drift).

**User-facing command still affected:** no immediate effect (Python fallback remains fully
functional and unmodified for anyone who sets `MINDRIAN_RS_BACKEND=python`) -- but see the
prominent callout immediately below before treating "full deletion" as a routine follow-up.

### PROMINENT CALLOUT: CJS-mode and Python-mode surface visibly different rankings for the same room (D-11 finding)

**This is not a bug. It is a real, now-quantified, expected consequence of D-01's architecture
decision (separate embedding spaces, no unification) that anyone considering full Python
deletion needs to see clearly, not discover after the fact.**

272-08's rank-agreement investigation (root-caused with a rigorous controlled experiment, full
trail in `272-08-SUMMARY.md`) measured, on matched pairs between the Python baseline and the CJS
candidate fixture:

- **LSA leg (the actual ported algorithmic work -- TF-IDF, SVD, topic-keyword extraction, L1
  similarity): Spearman rho = 0.9965, avg delta = 0.0050, max delta = 0.0210.** This is
  numerically sound -- the port itself is correct, matching a fresh independent Python
  recomputation to within noise-floor-equivalent precision.
- **`abs_diff` (the actual score PYPORT-05 was originally gating on, before D-11's redesign):
  Spearman rho = 0.1491, avg delta = 0.0528.**
- **`semantic_score`: Spearman rho = 0.7460, avg delta = 0.0555.**

The `abs_diff`/`semantic_score` weak agreement is dominated by the D-01-mandated encoder swap
(Python's `all-MiniLM-L6-v2`, 384-dim, vs the CJS port's `MongoDB/mdbr-leaf-ir`, also 384-dim but
a structurally different model) -- an already-locked architecture decision, not LSA-port noise.
D-01 deliberately chose not to unify embedding spaces (D-02 also rejected loading a local
`e5-large` for this reason). This means: **a room scanned with CJS mode active will show
different reverse-salient rankings and magnitudes than the same room scanned with Python mode
active, for the same underlying content.** Not different noise-floor jitter -- a real, systematic
divergence, because the two modes score semantic similarity with two different encoders by
design.

**What this means in practice, stated plainly:**

- A user who runs `/mos:find-bottlenecks` today with the CJS default, then later re-runs it with
  `MINDRIAN_RS_BACKEND=python` set (or vice versa), should expect to see different specific pairs
  surfaced as reverse salients, not just minor score jitter on the same pairs.
- This is fully consistent with and does not change this phase's own gate or scope -- `direction`
  (the sign classification that actually drives `/mos:find-bottlenecks`'s user-facing verdict) had
  **zero mismatches across 692 shared pairs at any confidence level**, so the qualitative
  structural-transfer-vs-semantic-implementation classification is stable. It is the specific
  ranking and magnitude of `abs_diff` that diverges.
- **Whoever eventually promotes the CJS path from "available behind a flag" to "the only path"
  (item 7, full Python deletion) should read this section first.** Deleting the Python fallback
  is not just a code-removal exercise -- it is implicitly also deciding that the CJS encoder's
  rankings are the new ground truth, a decision this phase deliberately did not make (D-01/D-02
  preserved the separate-space architecture specifically to avoid re-litigating an encoder
  accuracy tradeoff mid-phase). That decision, when it comes, should be made deliberately with
  this finding in hand, not discovered as a surprise regression report after a real user compares
  two scans run under two different flag settings.

---

## 8. The pre-existing `KeyError: 'embedding_model'` bug in `scripts/rs-engine.py`'s `main()`

**What it is:** `272-RESEARCH.md` Open Question 3 names a pre-existing crash: `meta['embedding_model']`
is read at `scripts/rs-engine.py:2019` via bracket access, but is only written on some code paths
(confirmed live this session: `git log -- scripts/rs-engine.py` shows no commit inside this
phase's history touched this file at all; the bracket-access read at line 2019 is unchanged).

**still requires Python:** yes -- this bug lives entirely inside the Python fallback path, not
the CJS port. The CJS port (`rs-engine.cjs`) does not reproduce this bug -- its own metadata
object always carries an `embedding_model` field, confirmed by direct read of `272-08`'s
implementation.

**Why deferred:** `272-RESEARCH.md` explicitly left this as a planner decision ("the planner
should decide explicitly whether fixing it in the Python fallback is in scope"). **Confirmed
here: no prior plan in this phase's 10 execution plans touched `scripts/rs-engine.py` to fix it.**
It remains a known, open, unfixed bug in the Python fallback path -- it would only fire if a
caller reaches the specific unwritten-field code path while running under
`MINDRIAN_RS_BACKEND=python`.

**Tracked where:** `.planning/debug/phase-134-python-elimination-false-complete.md` (named as
"the pre-existing unrelated `KeyError: 'embedding_model'` still present as documented,
untouched"), `272-RESEARCH.md` Open Question 3, this document. Needs a new seed/phase entry --
not yet filed as its own tracked item beyond these three cross-references.

**User-facing command still affected:** conditionally -- only a caller running under the
`MINDRIAN_RS_BACKEND=python` fallback and hitting the specific code path where `meta` lacks the
`embedding_model` key. The CJS default path (unaffected) is what the vast majority of installs
will exercise.

---

## Summary table

| # | Item | Still requires Python | Tracked where | User command affected |
|---|------|:---:|---|---|
| 1 | `rs-differential-scorer.cjs` (`computeLsaCosine`/`computeBertCosine`) | yes | this doc (new) | yes, indirect scoring path |
| 2 | `rs-pinecone-bridge.cjs` | yes | 272-CONTEXT.md D-10, this doc | yes, external/hybrid modes |
| 3 | `scripts/detect-reverse-salients.py` | yes (stdlib-only) | 272-10-SUMMARY.md, this doc | yes, `/mos:find-bottlenecks` cascade |
| 4 | Mode B/C external Pinecone corpus | yes | 272-CONTEXT.md D-10, this doc | yes, external corpus modes |
| 5 | Change 3 (doctor auto-stub visibility) | n/a | phase-134 RCA, this doc | no (internal process) |
| 6 | SEED-013 second frontmatter pass | n/a | 272-CONTEXT.md, this doc | no |
| 7 | Full Python deletion | yes (by design) | 272-CONTEXT.md D-04, this doc | no (fallback unaffected) -- see encoder-divergence callout |
| 8 | `rs-engine.py`'s `KeyError: 'embedding_model'` | yes (Python-fallback only) | phase-134 RCA, RESEARCH.md OQ3, this doc | conditionally, python-mode only |

---

*Phase: 272-phase-134-real-remediation-cjs-python-elimination-port*
*Filed: 2026-08-31 (plan 272-11, phase close)*
