---
status: gathering
kind: qa-sweep
trigger: "python-requirements-orphan-deps-audit"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 7]
created: 2026-05-23T00:00:00Z
updated: 2026-05-23T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** local workspace `/home/jsagi/MindrianOS-Plugin` HEAD @ `81bd4f96` (feat 127.2 Plan 03) plus its parent `c49dcf39` (Aryeh transcript QA sweep). Both unpushed at the moment of this audit; will land on `origin/main` as part of the 127.2-03 hotfix beta cut.
- **WIRE claims probe against:** none. This audit is purely a static-analysis sweep across local Python source vs local `requirements*.txt` files. No live Brain, no live Pinecone, no live Tavily call is made or claimed against.
- **Date of audit:** 2026-05-23
- **Re-verification rule:** every finding below is a source-text grep over the local checkout; re-verification against `origin/main` is automatic once the parent 127.2-03 commits land on the remote. No finding here is tagged `needs-source-reverify`.

## Purpose

A Windows-session matrix (delivered by the user while gsd-executor was running on 127.2 Plan 03) surfaced a sharp finding: `lib/core/rs_corpus.py` imports `requests` AND its in-source error message explicitly tells users to run `pip install -r requirements-hsi.txt` AND that file does not declare `requests`. A user who follows the documented setup correctly STILL hits F1 (silent failure). This is the same failure-mode as the Linux silent-failure findings closed by 127.2-02 (compute-hsi.py + ml_deps), but for a different script and a different dep, and it slipped past the prior sweep.

This file IS the audit: a static-analysis pass over every Python file in `scripts/`, `lib/core/`, `scripts/lib/`, and `mcp-server-brain/` (25 files total), cross-referenced against every `requirements*.txt` file in the repo. Its scope is intentionally narrow: classify orphan deps + ship the one HIGH-severity fix that bundles into the 127.2-03 hotfix beta. Broader audit findings (LOW severity, MEDIUM severity) become candidate follow-up plans for 127.2-04 or v1.14.0 - they do NOT land in this beta.

Sibling references:
- `.planning/debug/windows-build-brain-python-qa.md` - the Windows QA sweep that produced this finding stream
- `.planning/debug/resolved/127.2-02-*` (the prior sweep, which fixed the SAME failure-mode for compute-hsi.py + ml_deps but missed rs_corpus.py + requests)

## Audit Protocol

```
ROLE: Static auditor. For every Python file in scripts/, lib/core/, scripts/lib/,
mcp-server-brain/ (excluding __pycache__ and worktrees/), enumerate every top-level
third-party import. Cross-reference against every requirements*.txt file in the repo.
Classify every (script, dep) pair into one of four buckets:

  HIGH    The script's own error message tells the user to install a specific
          requirements file, AND that file does not declare the dep. A user who
          follows the documented setup correctly STILL hits a silent failure.
          THIS IS THE PATTERN THAT MUST BE FIXED.

  MEDIUM  The dep is present in some requirements file but not the one the
          script's error message points at. User has to know which file to use.
          Documentation gap, not a setup gap.

  LOW     The dep is missing from every requirements file but the import is
          guarded by a try/except with a clear error message AND the feature
          using it is optional (e.g. only used in --extended mode).

  OK      The dep is in the requirements file the script points users at.

OUTPUT: A matrix. Then a classification block. Then a fix block for HIGH-severity
items only (everything else is a deferred follow-up).

DO NOT fix anything beyond the HIGH-severity items in this sweep.
```

## Matrix - All 25 Python files, all 7 unique third-party imports

Scanned 25 Python files. 7 unique third-party imports.

| Import | Package | Coverage | Status post-fix |
|---|---|---|---|
| `numpy` | numpy | requirements-whitespace.txt, requirements-hsi.txt | OK |
| `pinecone` | pinecone | requirements-hsi.txt | OK |
| `requests` | requests | requirements-hsi.txt (ADDED 2026-05-23) | OK (post-fix) |
| `scipy` | scipy | requirements-whitespace.txt | OK |
| `sentence_transformers` | sentence-transformers | requirements-whitespace.txt, requirements-hsi.txt | OK |
| `sklearn` | scikit-learn | requirements-whitespace.txt, requirements-hsi.txt | OK |
| `umap` | umap-learn | requirements-whitespace.txt | OK |

Per-script requirements pointer map (which file each script tells the user to install):

| Script | Tells user to install |
|---|---|
| `lib/core/rs_cache.py` | requirements-hsi.txt |
| `lib/core/rs_corpus.py` | requirements-hsi.txt |
| `lib/core/rs_hybrid.py` | requirements-hsi.txt |
| `scripts/compute-external-whitespace.py` | requirements-whitespace.txt |
| `scripts/compute-hsi.py` | requirements-hsi.txt |
| `scripts/compute-whitespace-embeddings.py` | requirements-whitespace.txt |
| `scripts/compute-whitespace-gaps.py` | requirements-whitespace.txt |
| `scripts/compute_topic_forest.py` | requirements-whitespace.txt |
| `scripts/discover-analogy-whitespace.py` | requirements-whitespace.txt |
| `scripts/discover-hsi-whitespace.py` | requirements-whitespace.txt |
| `scripts/discover-rs-whitespace.py` | requirements-whitespace.txt |
| `scripts/fetch-brain-baseline.py` | requirements-whitespace.txt |
| `scripts/rs-engine.py` | requirements-hsi.txt |

Requirements files scanned (post-fix state):
- `requirements-whitespace.txt`: hdbscan, numpy, scikit-learn, scipy, sentence-transformers, umap-learn
- `requirements-hsi.txt`: numpy, pinecone, requests, scikit-learn, sentence-transformers

## Findings (classified)

### F-AUDIT-01 - rs_corpus.py imports `requests`; requirements-hsi.txt missing it

- **Severity:** HIGH
- **Status:** FIXED in this beta (commit included with this audit RCA file).
- **Site:** `lib/core/rs_corpus.py:60` (`import requests` inside `_ensure_requests()`); error string at `lib/core/rs_corpus.py:63` ("rs-corpus requires requests. Run: pip install -r requirements-hsi.txt").
- **Pre-fix:** `requirements-hsi.txt` declared `scikit-learn`, `numpy`, `sentence-transformers`, `pinecone` - and did NOT declare `requests`. A user who ran the EXACT command the error message recommends got a partially-completed install and the SAME `ModuleNotFoundError: requests` on the next invocation.
- **Why it surfaces:** rs_corpus.py is the OpenAlex/arXiv/Tavily fetch path - it is the network-bearing layer of the rs-engine pipeline. Three call sites: line 139 (`requests.get(OPENALEX_URL ...)`), line 218 (`requests.get(url ...)`), line 310 (`requests.post(TAVILY_URL ...)`). The lazy `_ensure_requests()` wrapper means the failure surfaces at first-network-call time, not at import time, so the file's own smoke tests pass.
- **Fix:** added `requests>=2.31` to `requirements-hsi.txt`. Same minimum-version style as the other entries in the file. `2.31` is the stable lineage from late-2023 onward and matches what the v1.13 Python ecosystem expects.
- **Same-pattern history:** this is the THIRD instance of the "script tells user to install file X, file X is missing dep Y" pattern in 127.2. Prior: compute-hsi.py + sentence_transformers fix in 127.2-02, ml_deps + pinecone gap in 127.2-02. Now: rs_corpus.py + requests. The recurrence is itself evidence that the orphan-deps audit should run as a CI check, not only as a post-hoc sweep.

### F-AUDIT-02 - Cross-file install-flow asymmetry: `requirements-whitespace.txt` missing `pinecone`

- **Severity:** MEDIUM
- **Status:** DEFERRED to a follow-up plan (not in scope for 127.2-03).
- **Symptom:** several scripts in the whitespace pipeline (`compute-external-whitespace.py`, `fetch-brain-baseline.py`) import `sentence_transformers` plus, in `--extended` paths, call into code that touches Pinecone. The user is told to install `requirements-whitespace.txt`, which does not declare `pinecone`. The pinecone import is guarded by try/except in the consuming module - so the failure is silent: the feature returns a degraded result.
- **Why DEFERRED, not HIGH:** the try/except guard prevents the hard crash; the user only sees a degraded result, not a stack trace. Promoting this to HIGH requires evidence from a real user session that the degraded result was mistaken for the full result. Without that evidence, the fix bar is "improve error message to say 'pinecone unavailable, install requirements-hsi.txt for full mode'", not "add pinecone to requirements-whitespace.txt" (which would conflate two pipeline tiers).
- **Recommended fix when promoted:** add a guarded warning print in each consuming module when `pinecone` is unavailable, directing the user to the correct file. Do NOT cross-pollinate the requirements files - that would make the whitespace-only pipeline transitively require Pinecone's heavy install footprint.

### F-AUDIT-03 - `mcp-server-brain/` has zero Python files and no `requirements*.txt`

- **Severity:** LOW (informational only).
- **Status:** No action. Documented for completeness.
- **Symptom:** the original audit prompt asked the executor to find `mcp-server-brain/requirements-hsi.txt`. That directory exists but contains zero Python files and no requirements file. The Brain MCP server is the Node.js stdio shim, not a Python service. The audit-prompt assumption that the requirements file lives there was incorrect.
- **Implication:** the canonical Python-deps surface for the plugin is the two `requirements*.txt` files at the repo root. There is no per-subsystem Python deps surface to keep in lockstep. If a future phase introduces a Python service inside `mcp-server-brain/`, this audit's matrix MUST be re-run.

### F-AUDIT-04 - No orphan deps in `scripts/lib/ensure_ml_deps.py` (proxy module)

- **Severity:** N/A (already correctly wired).
- **Status:** No action. Confirmed correctly wired.
- **Symptom check:** `ensure_ml_deps.py` is the dynamic-install fallback proxy. It tries `import sentence_transformers` and `import numpy` and `import sklearn` and falls through to `pip install` on failure. All three deps are declared in both requirements files. Proxy works correctly; no orphan.

## Scope and Impact (HIGH-severity finding only)

- **Affected surfaces:** all three (CLI, Desktop, Cowork). Any surface that invokes the rs-engine pipeline through the network-fetch path.
- **Affected commands:** `/mos:find-bottlenecks`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation` (the rs-engine.py CLI surface), plus any future command that wraps `lib/core/rs_corpus.py`.
- **Affected users:** all installs that followed the documented Python setup correctly. A user who happens to have `requests` system-installed (very common because of dozens of unrelated Python packages depending on it) would have masked the failure - which explains why this slipped past internal QA and only surfaced on a clean Windows tester install.
- **Version range:** introduced when `lib/core/rs_corpus.py` first imported `requests` (Phase 89, v1.10.16). Last-checked version: v1.13.0-beta.28 (broken). Fix lands in v1.13.0-beta.29 (this beta).
- **Severity:** HIGH.
- **Blast radius:** all OpenAlex / arXiv / Tavily fetch surfaces in the rs-engine pipeline. Same failure family as the 127.2-02 fixes; this completes the family for the rs-engine subsystem.

## Technical Root Cause (HIGH-severity finding only)

- **Site:** `requirements-hsi.txt` lines 1-4 (pre-fix); `lib/core/rs_corpus.py:60-63` for the import + error message.
- **Cause:** missing line `requests>=2.31` in `requirements-hsi.txt`. The error message in `rs_corpus.py:63` referenced a requirements file that did not declare the dep the error said it needed. The script-to-requirements pointer was correct; the requirements file content was incomplete.
- **Why it surfaces now:** the Windows tester ran the documented setup path verbatim, on a clean install with no system `requests`, and hit the SAME silent failure (F1) that 127.2-02 was supposed to close for the rs-engine pipeline. The fix in 127.2-02 covered `compute-hsi.py` + `ml_deps.py` but did not sweep `lib/core/rs_*.py` for orphan deps. This audit closes that gap.

## Required Code Changes

- **Change 1 (FIXED in this beta):**
  - Location: `requirements-hsi.txt` line 5 (new line, added)
  - Current behavior: file declared 4 packages; rs_corpus.py's network surface failed silently for users following the documented setup
  - Required behavior: file declares `requests>=2.31` so `pip install -r requirements-hsi.txt` is sufficient for every code path inside the rs-engine pipeline
  - Short-term patch: same as long-term fix - a single-line addition
  - Long-term fix: add a CI check (`scripts/check-python-requirements-coverage.cjs`, future) that runs the matrix-build logic from this audit on every PR touching `*.py` or `requirements*.txt`. Defer to a follow-up plan; not in scope here.

## Tests to Add or Update

- **Test 1 (DEFERRED to follow-up):**
  - Type: integration
  - Location: `tests/test-python-requirements-coverage.cjs` (does not exist yet)
  - Given: every Python file in `scripts/`, `lib/core/`, `scripts/lib/`, `mcp-server-brain/`
  - When: the file's error messages reference a `requirements-*.txt` file
  - Then: every third-party import in that file must be declared in the referenced requirements file
  - Runner registration: register in `tests/run-all-127.2.sh` and in the Feynman runner pre-commit gate
  - Why DEFERRED: this needs its own plan with discuss-phase to decide the exact failure-mode policy (warn vs hard-fail on PR), the false-positive guard for try/except-wrapped imports, and the per-subsystem scope policy. Out of scope for this hotfix.

## Non-Code Follow-ups

- **CHANGELOG.md:** entry added under v1.13.0-beta.29 - "Fixed: rs-engine silent failure (missing requests dep in requirements-hsi.txt) discovered via Aryeh Windows-session matrix evidence; orphan-deps audit filed for follow-up CI check."
- **Release lockstep:** 7-place lockstep applies (this is a beta cut). Handled by `scripts/release.sh`. Install minisite Step 9.6 fires.
- **Canon:** no Canon part touched by the requirements addition itself. The audit pattern (HIGH/MEDIUM/LOW classification of orphan deps) is a Part 6 (Product-as-Venture) artifact - dog-fooding the QA discipline.
- **knowledge-base.md:** on resolve, add a summary block with the matrix pattern + the audit verb (`grep imports in scripts/lib/core/scripts.lib/mcp-server-brain vs requirements*.txt`) so `gsd-debugger` can surface it as a known-pattern hypothesis next time a similar Windows-tester finding lands.
- **Follow-up plan candidates:** 127.2-04 should consider adding the orphan-deps CI check (F-AUDIT-01's long-term fix). 127.2-05 should consider F-AUDIT-02 (whitespace/pinecone degraded-result warning).

## Resolution

root_cause: `requirements-hsi.txt` did not declare `requests` despite `lib/core/rs_corpus.py:63` explicitly directing users to install via that file.
fix: added `requests>=2.31` to `requirements-hsi.txt`. Audit RCA filed at `.planning/debug/python-requirements-orphan-deps-audit.md` with full HIGH/MEDIUM/LOW classification of orphan deps across all 25 Python files in the plugin tree.
verification: post-fix matrix shows OK for all 7 unique third-party imports across all 25 Python files. `pip install -r requirements-hsi.txt` is now sufficient for the full rs-engine pipeline including the network-fetch surface.
files_changed:
  - `requirements-hsi.txt` (added `requests>=2.31`)
  - `.planning/debug/python-requirements-orphan-deps-audit.md` (this file, new)
commits: filed with the 127.2-03 hotfix beta cut. See SUMMARY.md for the final commit hash.

## Cross-Reference (added 2026-08-27)

`.planning/debug/phase-134-python-elimination-false-complete.md` supersedes part of this
file's premise: this audit assumed the Phase 134 CJS-port-of-Python-analyzers work was in
progress (hygiene audit on a moving target). It was never started -- Phase 134's tracking
showed all 8 plans executed via auto-generated `kind: summary-stub` SUMMARYs that never
verified the underlying work, not real completion records. The orphan-deps hygiene findings
in THIS file remain valid and unaffected (they're about `requirements-hsi.txt` coverage, not
about whether the CJS port happened), but the "port is in progress" framing in the Purpose
section above is stale.

The 134 RCA's Change 1 (2026-08-27) closes a related, narrower gap this audit's F-AUDIT-04
called "already correctly wired": `ensure_ml_deps.py`'s auto-install proxy was correctly
built and correctly wired into 6 of the whitespace-family scripts, but was NEVER wired into
`scripts/compute-hsi.py` or `scripts/rs-engine.py` -- the two entry points that actually gate
`/mos:find-bottlenecks`, `/mos:act`, and `/mos:mos-reason`. Those two scripts only printed a
manual `pip install -r requirements-hsi.txt` instruction and exited 1 on missing deps; they
never called the auto-installer at all. Fixed by wiring `ensure_ml_deps.ensure([...])` into
both, matching the pattern this audit's F-AUDIT-04 already validated as correct elsewhere.
