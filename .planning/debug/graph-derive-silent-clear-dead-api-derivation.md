---
slug: graph-derive-silent-clear-dead-api-derivation
kind: rca
status: partially-fixed
created: 2026-06-22
reverified: 2026-07-23
fixed_parts: [4a]
open_parts: [4b, 4c, 4d, 4e, "9 (defects #4, #5)"]
canon_parts: [4, 6, 8, 9]
related_seed: SEED-037
related_shipped: [169 (graph-derivation-harness: the sweep/drain hooks + runDerivation composer)]
severity: high
surface: graph-derivation (semantic edge layer); ALL rooms affected
---

# RCA: graph-derive drain clears the queue on failure; no room ever gets semantic edges

## 0. One-line

The semantic-edge derivation (INFORMS / CONTRADICTS / CONVERGES / typed cascade edges) has NEVER succeeded in any room: the LLM derivation call fails (dead API account + headless-no-key + no artifact-pairs), and the SessionStart drain catches the failure SILENTLY, clears the queue anyway, and logs nothing. The graph is a structural filing cabinet (BELONGS_TO only), not the semantic moat the canon promises.

## 1. Trigger / how it surfaced

- Navigator asked, in `motj-ecosystem`, to verify the graph system was "properly wired" across the ecosystem.
- `room_graph graph-stats` on motj returned: Artifact 35, Section 16, `BELONGS_TO` 41, and EVERY semantic/cascade edge type at 0 (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES, REASONING_INFORMS, HSI_CONNECTION, REVERSE_SALIENT, ANALOGOUS_TO, CAUSES, ROOT_CAUSE_OF, CASCADES_TO, etc).
- The room's markdown ALREADY carries cross-references (dashboard showed `competitive-analysis/pdac-investor-red-team.md` references problem-definition + solution-design) that never became edges.

## 2. Scope and Impact

- **Affected:** every room in `~/MindrianRooms/` (16 live rooms scanned). All have `.mindrian/room.db` with a healthy `BELONGS_TO` skeleton; NONE have semantic cascade edges.
- **Pending-but-doomed derive queues at scan time:** `graph-derive-queue.json` carried 1 stuck entry each in `motj-ecosystem`, `align-ecosystem`, `mindrianOS`, `gix-intelligence` (enqueued 2026-06-19, never drained-with-effect).
- **Damage already done:** the silent-clear means every prior SessionStart that DID fire the drain wiped the queue without producing edges. The "todo" signal was being destroyed on each run.
- **Moat impact:** Canon Part 4 (Every Choice Is Graph Data) + the MWP "graph is the moat" mandate are not being met. The proactive cross-relationship loop (CLAUDE.md) cannot fire because the edges it reads do not exist.
- **Quantified:** motj `room.db` edges before/after a real keyed drain: `BELONGS_TO: 33` -> `BELONGS_TO: 33` (zero semantic edges produced). Drain exit code: 0. Queue after: cleared.

## 3. Root cause (the full causal chain)

Three independent failures stack; each alone would suffice to zero the semantic layer.

1. **Dead API account (primary, environmental).** The typed-edge derivation calls `api.anthropic.com` (`lib/core/graph-candidate-producer.cjs` `_resolveDefaultLlm`, model `claude-haiku-4-5`). A live probe with the key from `~/.env` returned:
   `400 invalid_request_error: "Your credit balance is too low to access the Anthropic API."`
   The standalone API key is out of credits, so every derive call 400s.

2. **Headless hooks never see the key + never pass artifact pairs (architectural).**
   - The SessionStart drain (`scripts/gsd-graph-derive-drain.cjs`) calls `runDerivation({ roomDir })` with NO `runChain` and NO `artifactPairs`. With no key in the hook environment, `_resolveDefaultLlm` throws `anthropic_api_key_missing` even before billing.
   - `runDerivation` (`lib/core/graph-derivation.cjs:~190`) does `const stepInputs = artifactPairs.length > 0 ? artifactPairs : [null]` -- so the headless path runs a SINGLE null-pair derive. It was never going to produce real cross-relationship edges even with a funded key. The real builder is the in-session path (a caller that computes artifact pairs and supplies `runChain` / the in-session LLM, e.g. `/mos:graph --derive`).

3. **The drain clears the queue on failure (the silent-rot bug, the load-bearing defect).** `scripts/gsd-graph-derive-drain.cjs` `drainDerive()`:
   ```js
   } catch (_e) {
     // a faulting room is still dropped from the queue (the backfill is the net).
     result.drained.push(target);
   }
   ```
   `kept` is ALWAYS empty, so the queue is rewritten empty regardless of outcome. The return value of `runDerivation` (which carries the error trace) is discarded. Exit is always 0 (SessionStart hooks must never block). Net effect: the failure is invisible and the retry signal is destroyed.

## 4. Required Code Changes (the full register the fix must be aware of)

> This is the COMPLETE requirement set. The fix is NOT one line; it spans drain hardening + a real derivation path + a heal/retrofit for already-damaged rooms + doctor awareness + tests + release lockstep.

### 4a. Defect #1 - drain: keep-on-failure + visible failure log
- File: `scripts/gsd-graph-derive-drain.cjs`, `drainDerive()`.
- On `runDerivation` throw: push the entry to `kept` (NOT `drained`), populate `result.failed[]`, and append a failure record to a room-local log (`<room>/.mindrian/graph-derive-failures.json` or `.log`). Never silent.
- Also treat a returned trace with a producer error as failure (the producer can throw OR return an error-shaped trace).
- Preserve the EXISTING contract: success -> entry cleared (the `tests/test-graph-derive-sweep.cjs` round-trip stays green).
- Guard against infinite retry of a permanently-broken room: cap with a `failures` counter on the entry (e.g. drop + log after N attempts) OR rely on the failure log being surfaced by doctor (decide at scoping). Do NOT reintroduce silent drop.

### 4b. Defect #2 - real derivation path (in-session runChain, not the metered standalone key)
- The headless drain must STOP pretending to derive. Either:
  - (a) make the drain a no-op enqueue-preserver that defers actual derivation to the in-session `/mos:graph --derive` backfill (which supplies `runChain` + computes artifact pairs), OR
  - (b) wire the in-session LLM (`runChain`) into the path that actually runs, and compute real `artifactPairs` (the headless `[null]` single-call stub must be replaced by a real pair enumerator).
- Decision needed at scoping: is the standalone `ANTHROPIC_API_KEY` (funded) a supported headless path at all, or is in-session `runChain` the ONLY blessed transport? Lean toward runChain-only for headless (uses the session, no separate billing, no key-in-hook-env problem).
- If a funded standalone key remains a path: the key must be LOADED into the hook environment (today `~/.env` is never sourced by `graph-candidate-producer.cjs`; it reads `process.env.ANTHROPIC_API_KEY` directly).

### 4c. Heal / retrofit for already-damaged rooms (the "intrude the fix on update" requirement)
- ~16 existing rooms have had their derive queues silently cleared and carry ZERO semantic edges. A forward-only fix does NOT repair them.
- On plugin update, the fix must DETECT affected rooms and RE-ENQUEUE a derive so the next in-session derive rebuilds the semantic layer.
- Detection signal (all LOCAL, read-only): `room.db` present + has `BELONGS_TO` edges + has ZERO cascade edges (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES) + (queue empty OR a failure-log present).
- Action: call the sweep enqueue (`scripts/gsd-graph-derive-sweep.cjs --room <d>`) for each affected room so the signal is restored; the real edges land when the in-session derive next runs (4b).
- Must be idempotent (re-running does not duplicate queue entries; sweep enqueue is already dedup-by-roomDir).

### 4d. Doctor awareness (new check + heal class)
- Register a new doctor check class for graph-derive health (see SEED-037 for the class contract).
- CHECK: per active room (and `--cascade-rooms` for all), report PASS/WARN/FAIL on: queue stuck (entry older than N days), derivation never succeeded (BELONGS_TO present but zero cascade edges), failure-log present.
- HEAL: `--heal-room` (and the SessionStart preflight / update flow) re-enqueues affected rooms per 4c.
- Wire into the update path so it fires when a user updates the plugin (mirror the Phase 95.2 SessionStart preflight + the install-state retrofit precedent).
- Tri-Polar: CLI (full), Desktop (conversational "your graph needs a re-derive"), Cowork (shared room heal). The check is LOCAL-only.

### 4e. Reconcile the headless-vs-in-session contract in the drain comments
- The drain's own header comment claims it "runs runDerivation once per queued room" as the expensive pass. That is misleading given 4b. Update the doctrine comment to state the real division of labor (headless = enqueue/preserve; in-session = derive).

## 5. Tests

- `tests/test-graph-derive-sweep.cjs`: ADD a case - injected `deriveRunner` that throws -> entry KEPT, `result.failed` populated, queue NOT cleared. Keep the existing success-clears case green.
- New: doctor graph-derive-health class test (detect zero-cascade-edge room; heal re-enqueues; idempotent).
- New: heal/retrofit round-trip (damaged-room fixture -> detect -> re-enqueue -> queue restored).
- Regression: confirm the real in-session derive path actually writes cascade edges given a stub/funded LLM (the path 4b builds), so "drain succeeds" cannot again mean "zero edges."

## 6. Non-Code Follow-ups

- Fund (or rotate to a funded) Anthropic API account if a standalone headless derive path is kept, OR formally bless runChain-only headless derivation. ENV / billing item.
- Sweep the leftover `recompile-stamps.json.tmp.*` cruft (mindrianOS 145, motj 61, align 42, mof 26, pws 10) and checkpoint stale 220K WALs (ador, dhi, doe, iia, pws) - hygiene, tracked separately from this defect.
- Reconcile the registry active-room drift (MCP `rooms-open` showed motj active while `.rooms/registry.json` said align-ecosystem) - separate finding, not part of this RCA's fix.

## 7. MindrianOS gates (RCA template Section 5)

- **Part 8 (Brain boundary):** the derivation LLM call goes to `api.anthropic.com` (LOCAL transport, Part-8-legal per `graph-candidate-producer.cjs` comment), NOT the Brain. The heal/detect path is LOCAL room.db reads + a local enqueue; ZERO Brain wire. PASS by construction; the fix must preserve this.
- **Tri-Polar:** CLI / Desktop / Cowork all covered by the doctor heal (4d).
- **Cross-platform:** drain + sweep + doctor are pure CJS / node built-ins; no shell assumptions to add.
- **Release lockstep:** ships in a v1.14.0-beta; CHANGELOG + plugin.json + package.json + tag + marketplace ref per release-process.
- **No em-dashes:** this file uses hyphens only.
- **Reuse before build:** reuse the existing sweep enqueue (`gsd-graph-derive-sweep.cjs`), the doctor class-registration pattern (classes A-N), and the Phase 95.2 SessionStart-preflight retrofit precedent. Net-new = the drain failure branch + one doctor class + the heal action.

## 8. Evidence (append-only)

- 2026-06-22: motj `graph-stats` -> all cascade edges 0; `BELONGS_TO` 41 (MCP) / 33 (sqlite) [count source differs; noted].
- 2026-06-22: direct `runDerivation({roomDir})` (no key) threw `anthropic_api_key_missing` at `graph-candidate-producer.cjs:64`.
- 2026-06-22: with key loaded, `runDerivation` threw `anthropic_http_400`; trace `[{step:0, material:true, candidates:0}]`.
- 2026-06-22: curl probe of `claude-haiku-4-5` with the `~/.env` key -> `400 "credit balance is too low"`.
- 2026-06-22: keyed drain on motj -> exit 0, queue cleared, edges still `BELONGS_TO` only (silent-clear confirmed live).
- 2026-06-22: ecosystem scan - 16 rooms, all have `.mindrian/room.db`, none have cascade edges; 4 had stuck queue entries.
- 2026-06-22: motj queue re-enqueued by hand after diagnostic drains (signal restored; 1 entry as of this writing).

## 9. Local-embedding path - second investigation (2026-06-22)

The navigator directed trying the LOCAL embedding path (sentence-transformers 5.3.0 is installed; zero API, zero egress; Part-8-clean) instead of the dead LLM transport. It WORKS but surfaced two MORE defects independent of the LLM-derivation defect above. Net live result: motj went from 0 semantic edges to 6 `HSI_CONNECTION` edges via local embeddings (proof the moat is buildable on-device).

### Defect #4 - HSI corpus vs graph node-set disagree on what an artifact is
- `scripts/compute-hsi.py` `discover_artifacts()` `SKIP_DIRS` = `{.lazygraph, .git, node_modules, .hsi-cache.json, .heal-backup}`. It does NOT skip `.snapshots/` (historical STATE dumps) or `sub-rooms/` (which have their OWN room.db per Phase 169 NESTED_WITHIN).
- Consequence: motj's `.hsi-results.json` (2026-06-19) scored 207 artifacts and its top-20 pairs were ALL between `.snapshots/*` and `sub-rooms/*` files (near-duplicate state dumps -> LSA ~0.99). `scripts/hsi-to-graph.cjs` then wrote 0 edges because those IDs are not `Artifact` nodes in the main room.db (lines 86-88 `findArtifact` guard, correct behavior).
- Fix: `compute-hsi.py` must score the SAME artifact set that exists as graph nodes - add `.snapshots` + `sub-rooms` (+ the dot-dirs `.mindrian/.context/.intelligence/.heal-backup`) to `SKIP_DIRS`, OR accept a `--scope-to-nodes` mode that intersects with room.db `Artifact` ids. Sub-room content belongs to the sub-room's own graph, never the parent HSI.
- Workaround proven 2026-06-22: ran `compute-hsi.py` against a temp view that copied only the real section dirs (excluding `sub-rooms` + `.snapshots`) -> 20 pairs between real section artifacts (scores to 0.51).

### Defect #5 - structural node coverage is incomplete (caps edge-writing)
- motj room.db has 33 `Artifact` nodes, but the filesystem has ~70 real section artifacts. The structural BELONGS_TO index never nodeified all of them (missing e.g. `opportunity-bank/ab-script-testing-september`, `opportunity-bank/journal-return-ritual-crm`, `team-execution/content-governance-and-comms-risks`, `team-execution/guide-training-pipeline-school-of-disagreement`, `market-analysis/museums-by-emotion-positioning`).
- Consequence: even with a correctly-scoped HSI, only 6 of 20 pairs were writable (both endpoints must be nodes). 5 referenced artifacts were missing as nodes; the rest sat in not-indexed sections.
- Fix: the structural index pass must cover ALL real section artifacts (a `graph-index` / `graph-rebuild` over the full node set), and the heal-on-update path (4c) must run the structural index BEFORE the semantic derive so edges have nodes to attach to. Order: structural nodes -> semantic edges.

### Required-change addendum (folds into the register)
- The fix must run as a PIPELINE in the right order: (1) structural index covers all real artifacts as nodes; (2) HSI scoped to that node set (SKIP `.snapshots` + `sub-rooms` + dot-dirs); (3) `hsi-to-graph` writes `HSI_CONNECTION` / `REVERSE_SALIENT`; (4) the LLM-judgment tier (CONTRADICTS / INVALIDATES / ENABLES) via local model or in-session runChain. Tiers 1-3 need NO LLM at all.
- Three-tier edge doctrine (recommended, navigator-aligned 2026-06-22): INFORMS = structural cross-refs parsed from markdown (no model); CONVERGES / HSI_CONNECTION = local embeddings (no API, no egress); CONTRADICTS / INVALIDATES / ENABLES = the only tier needing a generative model (prefer LOCAL on-device per Part 8, not a hosted API).

### Evidence (append-only)
- 2026-06-22: `sentence-transformers 5.3.0` present locally.
- 2026-06-22: scoped `compute-hsi.py` (real sections only) -> 36 artifacts, 20 pairs, top 0.51.
- 2026-06-22: `hsi-to-graph.cjs` on scoped results -> wrote 6 `HSI_CONNECTION` edges; motj 0 -> 6 semantic edges (first ever). 14 pairs blocked: 6 writable, 5 missing-node, rest in un-indexed sections.
- 2026-06-22: the 6 edges centre on `solution-design/institutional-metaphor-system-aqueduct` informing financial-model / business-model / legal-ip / competitive-analysis / market-analysis section seeds.

## 10. Re-verification against current code + 4a fix (2026-07-23)

The repo moved from the 2026-06-22 diagnosis. Phase 224-02 (commits ae5030a3, e0114ba8,
a21ef563, 4d76dd35, c327fc70) rebuilt the drain. Re-ran the root-cause chain against HEAD.

### Root cause re-verification (which of the 3 still hold)
1. **Dead API account (root cause #1) - RESOLVED by Phase 224-02.** The drain's DEFAULT
   path no longer calls `graph-candidate-producer` / `api.anthropic.com`. It injects
   `classifier.scoreBasedDeriveFn` (LOCAL embeddings via `lib/core/rs-differential-scorer.cjs`)
   -- see `scripts/gsd-graph-derive-drain.cjs` header lines 43-48 and `drainScoreBased`. No
   metered key, no 400. The hosted-API transport is still the DEFAULT of `runDerivation` when
   no `deriveFn` is injected, but the headless drain always injects the score-based sync
   wrapper, so the dead-key path is dead code on the drain.
2. **Headless no-key + `[null]` single-pair (root cause #2) - RESOLVED by Phase 224-02.** The
   drain now computes REAL artifact pairs (`classifier.buildNewArtifactPairs` /
   `buildAllPairs`) and feeds them to `runDerivation({artifactPairs})`; the `[null]` single
   stub is gone from this path. Local encoder, no key needed.
3. **Silent-clear-on-failure (root cause #3 / Defect 4a) - CONFIRMED STILL LIVE, now FIXED.**
   Both the DEFAULT loop catch (was lines ~290) and the LEGACY seam catch (was lines ~353)
   pushed the thrown room to `drained` and then `clearQueue(resolved, entries)` wiped ALL
   snapshot entries including the failed one, with NO log. The Phase 224-02 snapshot-scoped
   `clearQueue` fixed a DIFFERENT bug (entries enqueued during the drain window survive) but
   NOT this one. The header comment still documented drop-on-failure as intended.

### 4a implemented this session (scripts/gsd-graph-derive-drain.cjs + test)
- New `reconcileQueue(resolved, succeeded, failed)` replaces the blanket `clearQueue` in BOTH
  derive loops (DEFAULT score-based + LEGACY deriveRunner). SUCCEEDED entries clear (preserves
  the round-trip contract); a THROWN entry is KEPT for the next drain with a bumped `failures`
  counter; after `MAX_DERIVE_ATTEMPTS` (5) it is dropped with a `permanent:true` record.
- New `appendFailureLog` writes each failure to `<room>/.mindrian/graph-derive-failures.json`
  ({ failures: [...] }, bounded to 200 rows, atomic tmp+rename, scalar-only, LOCAL disk). Never
  silent. `result.failed[]` is now populated. Exit stays 0 (never blocks session start).
- The encoder-unavailable path is DELIBERATELY untouched: it is a DISCLOSED skip (writes a
  `derivation_skipped` memory_event, then clears) and `tests/test-224-encoder-skip.cjs` asserts
  it clears. 4a targets only the genuine-throw catch (the silent one).
- Header failure-discipline comment rewritten (partial 4e) to state keep-on-failure doctrine.
- Exports add `MAX_DERIVE_ATTEMPTS` + `failureLogPath` (for the 4d doctor check to reuse).
- Tests: `tests/test-graph-derive-sweep.cjs` +4 checks (keep-on-throw, failure-log-written,
  succeeding-retry-clears, retry-cap-drops-permanent). Full: test-graph-derive-sweep 8/8;
  run-all-224.sh 17/17 (incl. encoder-skip regression); run-all-169.sh unchanged (its 4
  failures are PRE-EXISTING on clean HEAD and do NOT reference the drain).

### Still OPEN (not attempted this session; scoped for a follow-up plan)
- **4b - real derivation path decision.** Phase 224-02 already picked the LOCAL score-based
  producer for the drain (answers most of 4b's "runChain-only vs funded key" question in favor
  of local, no hosted key). Remaining: formally retire the dead hosted-API default of
  `runDerivation` (or gate it), and confirm the in-session `/mos:graph --derive` backfill wires
  the same local producer. NOT done.
- **4c - heal/retrofit for ~16 already-damaged rooms.** No detect-and-re-enqueue on update yet.
  The keep-on-failure fix stops NEW rot but does not repair rooms whose queues were silently
  cleared before this fix. NOT done. NOTE: the new failure log + kept entries give 4c/4d a
  cleaner detection signal than before.
- **4d - doctor graph-derive-health check + heal class.** NOT done. It should reuse the new
  `failureLogPath` export + the zero-cascade-edge-with-BELONGS_TO detection.
- **4e - reconcile drain doctrine comments.** PARTIALLY done (the failure-discipline block is
  rewritten); the "runs runDerivation once per queued room as the expensive pass" framing lower
  in the header still overstates the headless role and should be reconciled with the
  local-producer reality. NOT fully done.
- **Section 9 (Defects #4 + #5) - HSI scope + structural node coverage + pipeline order.** NOT
  attempted. `scripts/compute-hsi.py` still does not skip `.snapshots` / `sub-rooms`; the
  structural index still under-covers section artifacts; the 4-tier pipeline ordering
  (structural index -> scoped HSI -> hsi-to-graph -> LLM tier) is not wired. These are the
  larger, less self-contained changes the orchestrator flagged as deferrable.
