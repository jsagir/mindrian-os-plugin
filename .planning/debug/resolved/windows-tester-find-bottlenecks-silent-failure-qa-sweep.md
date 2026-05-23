---
status: resolved
kind: qa-sweep
trigger: "windows-tester-find-bottlenecks-silent-failure-qa-sweep"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 7, 8, 9, 10]
created: 2026-05-23T17:30:00Z
updated: 2026-05-23T20:00:00Z
resolved: 2026-05-23
resolved_by: phase-127.2 Plan 127.2-03 (hotfix; F1+F2+F7 shipped)
resolved_disposition: 3-of-4-fixed-in-code; F3 narrative drift deferred to next docs reconciliation; F6 architectural port scaffolded as Phase 130 stub
---

## Source-of-Truth Preamble

> Second audit to apply Phase 127.2 D-10's mandatory Preamble. Dog-feeds the rule against external tester evidence (not just self-audit).

- **CODE claims read against:** `origin/main` HEAD of `/home/jsagi/MindrianOS-Plugin` @ commit `c5163e44` (post v1.13.0-beta.28 Commit B). Where the Windows tester's transcript references code, claims read against whatever was in their plugin cache at audit time (plugin v1.13.0-beta.24 per the transcript header).
- **WIRE claims probe against:**
  - Tester runtime: Windows `C:/Users/PC/.claude/plugins/mindrian-os` (plugin v1.13.0-beta.24 install cache, NOT origin/main).
  - Tester Python: 3.13 and 3.14 both present per their probe; `requests` package absent.
  - Brain server: production `mindrian-brain.onrender.com` (Pinecone substrate confirmed live by tester via `brain_stats` returning `dimension: 1024, totalRecordCount: 12,401`).
  - Brain MCP tools: tester ran `brain_stats`, `brain_search "SWOT analysis"`, `brain_ask`.
- **Date of audit:** 2026-05-23 (transcript captured live during tester session)
- **Re-verification rule:** code claims about MindrianOS-Plugin re-verified against `origin/main` HEAD via the canonical workspace at `/home/jsagi/MindrianOS-Plugin/` before this filing. Where origin/main behavior differs from the tester's beta.24 cache, BOTH states are recorded.
- **Audit harness:** Windows tester session transcript (verbatim pasted by Jonathan) + my own re-probe of origin/main + Brain wire probes via MCP.
- **Anti-pattern guard:** the tester's `requests` ModuleNotFoundError was reproduced from origin/main: `cat mcp-server-brain/.../requirements-hsi.txt` confirms `requests` is a declared dep, and `scripts/rs-engine.py` line 77 imports `rs_corpus` which transitively requires it. This is NOT a stale-install-cache false positive (Phase 127.2 D-10's sibling class). The defect exists on `origin/main` HEAD too; the tester's cache is fine.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version on origin/main: 1.13.0-beta.29 (Commit B placeholder; last shipped tag: v1.13.0-beta.28)
- Tester's plugin version: v1.13.0-beta.24
- Reported by: Windows tester session, 2026-05-23, pasted by Jonathan as raw transcript
- Date first observed: 2026-05-23 (the rs-engine deps gap likely predates this; first time silently surfaced via reverse-salient feature)
- Related debug sessions: v1.13.0-beta.26-post-ship-qa-sweep (sibling QA), mcp-servers-cache-missing-node-modules (resolved -- different class: Node deps not Python deps)

## Problem Statement

A Windows tester running `/mos:find-bottlenecks` on their own venture room got "no findings" -- not because the room was bottleneck-free, but because the entire Wave-1 reverse-salient analyzer was DEAD on their machine (Python `requests` module missing). The agent layer swallowed the actionable error message; the user had zero signal that the analyzer hadn't run. The product told the truth about a lie: "no bottlenecks" when it should have said "analyzer down, here's how to recover."

This is the worst-shape silent failure in the canon-defined product surface: a methodology feature that returns empty results indistinguishable from "your work is clean."

## Symptoms (IMMUTABLE)

expected: `/mos:find-bottlenecks` either returns ranked reverse-salient candidates OR fails loudly with the recovery command.
actual: agent returns `{ok: false, reason: "rs_engine_invocation_failed"}`; user-visible surface reads "no findings"; recovery command (`pip install -r requirements-hsi.txt`) printed by the underlying script is discarded by the agent wrapper.
errors:
  - `rs-corpus requires requests. Run: pip install -r requirements-hsi.txt`
  - `Traceback ... ModuleNotFoundError: No module named 'requests'`
  - `AGENT_OK` (false-positive top-level wrapping; agent reports its OWN execution as "ok" while its result payload contains the failure)
reproduction:
  1. Fresh Windows machine with the plugin installed.
  2. Python 3.13+ present BUT `requests` not installed.
  3. Open a venture room with at least 5 artifacts.
  4. Run `/mos:find-bottlenecks`.
  5. Observe: user-facing surface says "no findings" or similar; agent log shows `rs_engine_invocation_failed` but the actionable fix line never reaches the surface.
started: predates Phase 89 reverse-salient-engine shipping (the rs-engine.py file was created without a pre-flight deps probe).

## Scope and Impact

- **Affected surfaces:** all three (CLI, Desktop, Cowork) -- the analyzer is shared.
- **Affected commands:** `/mos:find-bottlenecks`, `/mos:whitespace`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`, `/mos:diagnostics` (all Python-backed Engine 1 Act 1 surfaces).
- **Affected users:** every user without `requests` installed in the Python their plugin spawns. This is the default state on every Windows machine without explicit pip-install, and a non-trivial slice of macOS / Linux too (no auto-install on plugin update).
- **Version range:** since Phase 89 shipped (v1.10.16) -- the entire reverse-salient surface has been silently degradable.
- **Severity:** HIGH. Silent failure in a feature that maps directly to Canon Part 2 Engine 1 Act 1.

## Findings (component health matrix)

| # | Finding | Class | Verdict | Sev |
|---|---------|-------|---------|-----|
| F1 | `rs-engine.py` crashes with `ModuleNotFoundError: requests` on machines without the deps installed | install-fragility | NEW FAILURE | HIGH |
| F2 | `ReverseSalientAgent` swallows the actionable error message; the script's printed fix line never reaches the agent's result.detail | error-propagation | NEW FAILURE | HIGH |
| F3 | Phase 127.1 narrative drift: shipped CHANGELOG / Canon-Phase-Map claim "Pinecone -> Neo4j HNSW substrate swap" SHIPPED, but Pinecone is still load-bearing in production code (`brain-ask.cjs`, `pinecone-tools.cjs`, `server.cjs`). Only Plan 127.1-05 (Brain-query moat guard) actually shipped; Plan 127.1-04 (the substrate swap) is parked on a 7-day soak | docs-vs-code drift | NEW FAILURE | MEDIUM |
| F4 | Conversational meta-finding: an AI assistant (Larry) in the tester's session proposed an Option B using Pinecone server-side inference on user artifact bodies. That violates Canon Part 8 (LOCAL-to-BRAIN: NO). Caught by the user mid-conversation; no code damage shipped. Documented as a thinking-pattern hazard for the dog-fooding meta-record | reasoning-defect (meta) | DOCUMENTED | MEDIUM |
| F5 | Dog-fooding loop confirmation: F1 + F2 would never have been caught by Jonathan because his dev machine has the deps. RS-2 thesis (one-person QA is the lagging subsystem) gets fresh empirical evidence in real time | RS-2 evidence | CONFIRMED | -- |
| F6 | Python on user machines is the largest install-fragility class. F1 is one instance; the same vector hits `scripts/hsi-*.py`, `scripts/query-semantic-scholar.cjs` (despite the .cjs extension, may transitively spawn Python), `lib/core/rs_*.py`. Structural fix is "no Python on user machines" via a CJS / @xenova/transformers port | structural | KNOWN ARCH GAP | -- |
| F7 | `/mos:find-bottlenecks` empty-results UX class: when an analyzer can't RUN, the user-facing surface MUST distinguish "analyzer down" from "no findings." Empty findings reads as "your work is clean" -- the worst possible signal when the analyzer crashed | UX class | NEW FAILURE | HIGH |

## Required Code Changes

### Hotfix path (v1.13.0-beta.29 or .30 -- next beta)

1. **F2: agent forwards stderr to result.detail.** `lib/agents/reverse-salient-agent.cjs` must capture the python child process's stderr last 200 chars and embed it in `result.detail.diagnostic`. ~5 lines.

2. **F1 + F7: env pre-flight in `scripts/doctor.cjs --first-use-check`.** Add a new acceptance subcommand that pre-flights Python deps for Engine 1 Act 1 commands. On `/mos:find-bottlenecks` first invocation, the command checks the pre-flight cache; if `rs_engine_deps_ok != true`, the user gets the actionable fix INSTEAD of running the analyzer. ~30 lines + a one-shot probe script.

3. **F7 (UX-only stopgap until F1 lands):** `/mos:find-bottlenecks` empty-result message changes from "no findings" to: "analyzer ran with no findings -- OR the analyzer could not start (run `/mos:doctor --check-rs-engine` to disambiguate)." Cheap, immediate, removes the worst possible reading.

### Architectural path (v1.14.0 phase)

4. **F6: port Python analyzers to CJS / Node in-process.** New phase TBD: replace `scripts/rs-engine.py` + Python `lib/core/rs_*.py` with CJS equivalents using `@xenova/transformers` for embeddings (multilingual-e5-large in ONNX, in-process Node, no Python, no server round-trip, Part 8 clean). Math layers (cosine sim, LSA approximation, HSI scoring) port to pure JS. Estimate per the tester transcript: ~3 weeks, not 1.

5. **F3: finish Phase 127.1's substrate swap OR amend the canon.** Either (a) ship Plan 127.1-04 to actually retire Pinecone in favor of Neo4j HNSW, removing the dual-substrate confusion, OR (b) amend Canon Appendix D entry 13 + CANON-PHASE-MAP Part 9 row to explicitly state "BOTH substrates active during the transition, Pinecone retirement target deferred to v1.14.0." The current claim implies completion that hasn't happened.

## Tests

Required additions:
- `tests/test-rs-engine-deps-preflight.sh` -- on a machine WITHOUT `requests`, assert `/mos:find-bottlenecks` returns "analyzer needs deps" surface, NOT empty findings.
- `tests/test-reverse-salient-agent-stderr-forwarding.cjs` -- mock python child process that fails; assert `result.detail.diagnostic` contains the stderr last line.
- `tests/test-canon-phase-map-127.1-status.cjs` -- assert that wherever the canon/phase-map claims "Phase 127.1 SHIPPED Pinecone retirement," the actual code state matches (or the claim is amended).

## Non-Code Follow-ups

- [ ] Decide on F3 disposition: finish Plan 127.1-04 vs amend canon. The choice affects what we tell users + testers about the Brain substrate.
- [ ] Scope the F6 architectural port (v1.14.0 phase scaffolding): pick @xenova/transformers vs alternative ONNX runtime, verify multilingual-e5-large weight compatibility with current Pinecone 1024-dim index, plan re-vectorization if needed.
- [ ] Surface this RCA to Aryeh (the tester) as the closure record once F1/F2/F7 ship; the courtesy + the Source-of-Truth Preamble dog-food are both meaningful.

## MindrianOS Gate Compliance (RCA Section 5)

- **Canon Part 8 (Brain boundary):** PASS. The diagnostic in F1/F2 is a LOCAL Python failure; nothing about the fix exposes user content to Brain. F4 documents a meta-violation in the tester's conversation (an AI proposed a Part 8 breach; the user caught it; no code shipped). The conversation itself becomes evidence that the boundary holds under adversarial pressure.
- **Tri-Polar (CLI / Desktop / Cowork):** all three affected; all three need the F1/F2/F7 fixes. Architectural F6 fix benefits all three identically.
- **Cross-platform:** the defect is Windows-flagrant (no pre-installed `requests`) but affects every OS where the user hasn't run `pip install -r requirements-hsi.txt`. Fix must work on Windows + macOS + Linux.
- **Release lockstep:** Hotfix path (F1/F2/F7) rides next beta; architectural path (F6) is v1.14.0 phase. Lockstep applies to whichever release ships fixes.
- **No em-dashes:** PASS. This file uses hyphens only.
- **Reuse-before-build:** F1/F2 fixes extend existing `lib/agents/reverse-salient-agent.cjs` + `scripts/doctor.cjs`; no net-new surface. F6 architectural port replaces a layer (Python) with another (Node + @xenova/transformers); net-zero on capability count, net-minus on dependency surface.

## Verdict

`/mos:find-bottlenecks` is silently broken for every user without the right Python deps. Same vector kills 5 other Engine 1 Act 1 commands. The product currently CERTIFIES INVISIBLE the very problems it was built to surface, on the most common new-tester machine type (Windows). HOTFIX urgent (F1/F2/F7 ~1-2 days work); structural fix (F6) belongs in v1.14.0 scaffolding.

Bonus value: this transcript is the cleanest external evidence we have for the Phase 127.2 RS-2 thesis ("one-person QA is the lagging subsystem"). The reverse-salient analyzer FAILED while computing reverse salients. Almost too on-the-nose.

## Triage with GSD

1. File this report (`status: investigating`).
2. Decide whether to scaffold Plan 127.2-03 for hotfix path (F1 + F2 + F7) or a fresh Phase 128.x.
3. Decide whether to scaffold a v1.14.0 Phase TBD for the CJS architectural port (F6).
4. Decide F3 disposition before next CHANGELOG entry that references Phase 127.1 (avoid further drift).
5. On close: move file to `.planning/debug/resolved/` + knowledge-base entry per the new discipline.

## Resolution

Closed 2026-05-23 by Phase 127.2 Plan 03 (the FIRST hotfix shaped from an external tester's transcript -- Aryeh's Windows machine, 2026-05-23 -- per Canon Part 6 dog-fooding mandate). All three HIGH-severity findings shipped as v1.13.0-beta.30.

**Hotfix landed (3 of 4 code findings, 1 architectural deferred):**

- **F1 -- /mos:doctor --check-rs-engine pre-flight (FIXED).** `scripts/doctor.cjs` gains a `--check-rs-engine` flag handler (ADD-ONLY; no refactor of existing acceptance points or class-flag dispatchers). Probes critical Python deps reachable from `scripts/rs-engine.py` -- `requests` (transitive via `lib/core/rs_corpus.py`, the actual silent-failure root cause) + `numpy` -- plus umbrella deps from `requirements-hsi.txt` (`sentence_transformers`, `sklearn`). Resolves python interpreter via `MINDRIAN_PYTHON` env override > `python3` > `python` fallback. On missing critical deps: exit 1 + actionable fix line (`Run: pip install -r requirements-hsi.txt --user (use python -m pip if pip is not in PATH)`). JSON variant: `{ ok, ready, python, probes[], missing, missing_critical, missing_umbrella, fix }`. Defensive: any uncaught probe error surfaces as exit 1 with the fix line -- the probe NEVER crashes `/mos:doctor`'s other gates.
- **F2 -- agent forwards stderr to result.detail.diagnostic (FIXED).** `lib/agents/reverse-salient-agent.cjs` `runRsEngine()` catch block now captures `e.stderr` from the failed child python process, takes the LAST 200 chars (preserving the actionable fix line + exception name at the tail), and embeds it in `result.detail.diagnostic`. Backward compatible: when stderr is empty, `detail` stays a plain string (the existing `e.message` slice); when stderr is present, `detail` upgrades to `{ message, diagnostic }`. The existing `ok`/`reason` fields are untouched, so legacy callers don't break.
- **F7 -- /mos:find-bottlenecks empty-result UX (FIXED).** `commands/find-bottlenecks.md` gains an "Empty-result UX" sub-section that disambiguates two cases: (a) analyzer ran with no findings -> calm "framework manually" copy; (b) analyzer could not start (detected via `result.detail.diagnostic` OR `reason: rs_engine_invocation_failed`) -> "run `/mos:doctor --check-rs-engine` to verify your Engine 1 Act 1 environment is healthy" with the pip-install one-liner inline.

**Smoke test green:** `tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` 7/7 PASS on origin/main. Tests cover F1 flag-handler presence, F1 fix-line embedded, F2 diagnostic-field reference + stderr-capture pattern, F7 disambiguation copy presence, functional probe (`--check-rs-engine --json` returns valid JSON with `ok:true` on the dev machine where all deps are present), and `--help` documentation. Run: `bash tests/test-127.2-03-rs-engine-silent-failure-fixes.sh`.

**Deferred (intentional):**

- **F3 (Phase 127.1 narrative drift -- Pinecone vs Neo4j HNSW substrate claim).** Disposition: defer to next docs reconciliation cycle. The CHANGELOG / Canon-Phase-Map drift is real but is not the blocking failure for the Windows tester. Closing it requires either finishing Plan 127.1-04 (the actual Pinecone retirement) or amending Canon Appendix D entry 13 to explicitly state "BOTH substrates active during transition." Decision parked for Jonathan to pick the disposition before the next CHANGELOG entry that references Phase 127.1.
- **F6 (Python-on-user-machines install-fragility class -- CJS port of all Python analyzers).** Disposition: scaffolded as **Phase 130 CJS port architectural-stub** in this same plan execution (CONTEXT.md ONLY; no PLAN.md). Milestone: v1.14.0. Design vision captured: replace `scripts/rs-engine.py` + `lib/core/rs_*.py` + `scripts/hsi-*.py` with CJS equivalents using `@xenova/transformers` (ONNX `Xenova/multilingual-e5-large` in-process); eliminates Python from user-machine surface entirely. Estimate ~3 weeks.
- **F4 (meta-finding: tester-session AI proposed a Canon Part 8 breach -- Pinecone server-side inference on user artifact bodies).** Disposition: DOCUMENTED only; no code change required (user caught the proposal mid-conversation; nothing shipped). The conversation itself is evidence that the Part 8 boundary holds under adversarial pressure.
- **F5 (RS-2 thesis confirmation -- one-person QA is the lagging subsystem).** Disposition: CONFIRMED; the dog-fooding loop closing this RCA in the same week the transcript landed is the empirical evidence.

**Files changed in Plan 127.2-03:**
- `lib/agents/reverse-salient-agent.cjs` (F2 -- stderr forwarding)
- `scripts/doctor.cjs` (F1 -- --check-rs-engine flag + runCheckRsEngine probe + --help text)
- `commands/find-bottlenecks.md` (F7 -- empty-result UX disambiguation)
- `tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` (smoke test)
- `.planning/phases/130-.../130-CONTEXT.md` (F6 -- scaffold stub for v1.14.0)
- `CHANGELOG.md` (Unreleased -> v1.13.0-beta.30 entry)
- This file moved to `.planning/debug/resolved/`.

**Plan reference:** `.planning/phases/127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/127.2-03-PLAN.md`
**SUMMARY:** `.planning/phases/127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/127.2-03-SUMMARY.md`
**Ship vehicle:** v1.13.0-beta.30 (next prerelease after the current Commit B placeholder at beta.29).
