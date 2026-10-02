---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 11
subsystem: research-planner
tags: [part8, guard, theo, canon-release, translation, audit, egress-policy, d-13, d-14, d-15]
requires:
  - 366-02 (filing wire), 366-05 (canon-translations, resolveEndpoint translation check), 366-08 (PERSPECTIVE_IDS), 366-12 (CLI doors), 366-17 (egress policy, appendAudit line check)
provides:
  - part8-egress-guard.cjs _proveNavigatorRelease (class and reason navigator_released), exported with _releaseIntentVocabulary and _releasePerspectiveIds
  - lib/core/research-planner/canon-release.cjs (offerItemsFor, releaseCard, mintReleaseGate, releaseTerm, answerRelease, releaseCounts, confirmItemsFor, confirmTranslation, basketItemsFor)
  - filing.basketWithCanon, fileRun ignoring canon item kinds, planner.basketFor(roomDir, runId, opts)
  - CLI canon-release and canon-confirm
affects:
  - 366-24 (Theo-side intent-led resolver request: envelope shape below)
tech-stack:
  added: []
  patterns:
    - receipt-bound guard arm placed after the content scan, only narrows ambiguous
    - gate id registry inside the release module so a release can run only for a gate it minted
    - transport chosen by environment (MOS_366_LIVE / MOS_366_THEO_REPLAY), never by argv
key-files:
  created:
    - lib/core/research-planner/canon-release.cjs
    - tests/test-366-guard-navigator-release.cjs
    - tests/test-366-gated-term-release.cjs
  modified:
    - lib/core/part8-egress-guard.cjs
    - lib/core/research-planner/filing.cjs
    - lib/core/research-planner/planner.cjs
    - scripts/research-planner.cjs
    - .planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/deferred-items.md
decisions:
  - "The wire is { raw: term } only. Theo's normalize_framework_name is a z.strictObject with the single key raw (/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts:118-147); unknown keys are refused before the handler. The envelope { raw, intent, section, perspective } is built, classified by the guard and recorded in the audit row's filters and origin_ref, not sent."
  - "part8_verdict is 'pass' on a released call; navigator_released lives in the guard verdict (audit key set stays closed at 23)."
  - "Only carried framework: and methodology: values are offered, never titles; a term already in the translation table, or a thing that already resolves (framework, methodology or title), is never offered."
  - "The guard arm does not use the free-form branch, so the known generic brain_ask false block (SEED-019) is neither relied on nor repaired; recorded in deferred-items.md with both reason codes (freeform_unmatched, unknown)."
  - "Live Theo only with MOS_366_LIVE=1; MOS_366_THEO_REPLAY=<file> serves recorded answers offline (audit filters.transport = replay); otherwise the CLI refuses live_not_enabled and sends nothing."
metrics:
  tasks_done: 3
  tasks_total: 3
  completed: 2026-10-02
---

# Phase 366 Plan 11: Gated term release to Theo

A room word that does not resolve to a canon framework is now offered on the F.8 basket; a yes sends exactly that one term to Theo's `normalize_framework_name` through a single-use gate, writes one closed audit row, and a snapshot hit lands as a PROPOSED translation the navigator confirms on the next card. The navigator approved the release shape on 2026-10-02 and one live round trip ran: Theo answered a MISS for "Bottleneck Hunt".

## Commits

| Step | Commit | Subject |
|------|--------|---------|
| Task 1 RED | 990e88893 | test(366-11): add failing navigator_released guard legs G1-G11 |
| Task 1 GREEN | 9e7c4b416 | feat(366-11): Part 8 guard navigator_released arm (receipt-bound, after the content scan) |
| Task 2 RED | ba065ea26 | test(366-11): add failing gated term release legs R0-R12 |
| Task 2 GREEN | dd8c0f1c5 | feat(366-11): gated per-term Theo release, F.8 canon items and the confirm |
| Task 3 | see git log | test(366-11): record the approved live round trip as a replay fixture and finalize the summary |

## What was built

- **Guard arm.** `_proveNavigatorRelease(payload, opts)` in `lib/core/part8-egress-guard.cjs` (docblock at line 624, helper at 656, call at 926 inside `classify`, after the content scan). Allows only when: tool name contains `normalize_framework_name`; `opts.release` is `{ gate_id (gate-<16 hex>), term }`; keys are exactly `raw` plus optional `intent`, `section`, `perspective`; `raw` equals the receipt term and is a safe short label; `intent` is in the closed JTBD taxonomy; `section` is a lowercase slug; `perspective` is in `PERSPECTIVE_IDS`. Returns `{ verdict: 'allow', class: 'navigator_released', reason: 'navigator_released' }`. The receipt rides in `opts`, never the payload.
- **canon-release.cjs.** Offer (distinct unresolved carried framework/methodology terms over the run's pairs, never titles, default off, theo-off note and no gate when the line is off), release card, single-use session-scoped gate (gate-ledger, material_step), `releaseTerm` (guard classify of the envelope and the wire payload before the call, egress policy check, one call `normalize_framework_name {raw: term}`, one 23-key audit row, proposed row only when the canonical name is in the snapshot), `releaseCounts` (derived from the audit ledger), confirm items and `confirmTranslation`.
- **Basket and filing.** `filing.basketWithCanon` appends the canon items (sync, local; mints gates when a session id is passed); `fileRun` drops canon item ids and names them in `ignored_items`.
- **CLI.** `canon-release <runid> --room R --item canon_term:<12hex> --approved-via cli` and `canon-confirm <runid> --room R --item canon_translation:<12hex> --approved-via cli`; closed `--item` shape, free text refused with exit 2.

## Envelope shape for the 366-24 Theo-side request

`{ raw: <term>, intent: <JTBD handle from lib/hmi/jtbd-taxonomy.json>, section: <lowercase slug>, perspective: <one of eureka, rs, hsi, whitespace, analogies, connections> }`. The guard arm already accepts this shape under a receipt, so once Theo's resolver takes the extra keys the change is transport-only (swap the wire payload from `{ raw }` to the envelope in `releaseTerm`). Today Theo refuses any key but `raw`.

## Verification

- `node tests/test-366-guard-navigator-release.cjs`: PASS 48, FAIL 0 (G1-G11; G9 runs 12 existing Part 8 suites, all exit 0)
- `node tests/test-366-gated-term-release.cjs`: PASS 28, FAIL 0 (R0-R13; zero network attempts)
- Regression green: test-366-eureka-filing 20/0, test-363-filing 51/0, test-363-cli 22/0, test-366-cli-perspective 7/0, test-363-mcp-tool 15/0, test-366-mcp-perspective-ops 9/0, test-366-egress-policy 24/0, test-366-canon-handles 53/0, test-366-theo-lateral-lane 23/0, test-seed103-eureka-perspective 39/0, test-363-part8-sweep 20/0, test-seed104-grant-family-loop 19/0
- `bash tests/run-all-366.sh` (temp HOME): PASSED=64 FAILED=0 SKIPPED=4 KNOWN=1
- `bash tests/run-all-363.sh` (temp HOME): FAILED=2, both outside this plan and identical in kind to 366-17's note: `run-all-3551` (recorded signature drift, now PASS=63 FAIL=5) and "no new dependency" (a peer's package.json/shrinkwrap additions)
- `node scripts/check-tool-honesty.cjs --check` exit 0; `node scripts/build-connector-registry.cjs --check` exit 0. No MCP tool description or inputSchema changed, so tests/fixtures/267/* untouched.
- Acceptance greps: `navigator_released` in the guard at least 2; the `_proveNavigatorRelease(` call line (926) is after the `scanForContent(payload)` line in classify; `normalize_framework_name` in canon-release at least 1; `brain_search|framework_search` 0; no em-dash or en-dash in any touched file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] planner.cjs edited (not in files_modified)**
- **Found during:** Task 2. The plan names `filing.cjs basketFor`, but `basketFor` lives in `planner.cjs` and calls `filing.buildBasket`.
- **Fix:** `filing.cjs` gained `basketWithCanon`; `planner.basketFor(roomDir, runId, opts)` calls it (6-line change). `fileFromState` needed no change because `fileRun` strips canon ids.
- **Commit:** dd8c0f1c5

**2. [Rule 2 - Missing critical] Replay transport env for the CLI (MOS_366_THEO_REPLAY)**
- **Found during:** Task 2 (R8 needs a hermetic CLI success path; a spawned CLI cannot take an injected callTool, and Task 3 needs a replay anyway).
- **Fix:** the CLI picks its transport from the environment only: a replay file, or `MOS_366_LIVE=1`, else `live_not_enabled` (exit 2, nothing sent). The audit row records `filters.transport = 'replay'` for a replayed answer.
- **Commit:** dd8c0f1c5

**3. [Rule 3 - Blocking] Two guard helper exports added in the Task 2 commit**
- `_releaseIntentVocabulary` and `_releasePerspectiveIds` are exported so canon-release reuses the guard's closed vocabularies instead of duplicating them.

**4. Design note, CLI gate timing.** The CLI mints and consumes the release gate in one process at answer time (the gate ledger is in memory, so a basket-time gate cannot survive to a separate CLI process). `--approved-via cli` states that the host asked the navigator and heard yes, the same authority model as `file-run`. The release still runs through `mintReleaseGate`, the ledger and `releaseTerm`'s minted-gate check.

## Deferred / owed (also in deferred-items.md under "From plan 366-11")

- The generic-Theo false block (SEED-019, SEED-106 item 1: `freeform_unmatched` on generic `brain_ask` words, `unknown` on `framework_chain_slice` with framework names only) is NOT fixed here; the new arm does not depend on it (leg G11).
- The MCP door (`lib/mcp/tools/research.cjs`, peer-owned) calls `basketFor` without a session id, so over MCP the item has no gate id yet; the CLI door is complete. Pass-through owed once lib/mcp settles.
- Pre-existing reds seen: test-257-brain-tool-egress-invariant Arm 2, test-257-strict-input-shapes, test-212-part8-boundary CHECK 1, test-358-b2-part8 P4 (all red before the guard edit).

## Task 3: navigator verify and live round trip (DONE)

- **Navigator approval:** "APPROVED", 2026-10-02, for the release shape (guard docblock and the F.8 release card as printed) and for one live Theo call from the scratch room.
- **Live call:** `MOS_366_LIVE=1`, real HOME, `MINDRIAN_ROOMS_HOME` at the scratch rooms home, `canon-release rp-2026-10-02-f863ec28 --item canon_term:4ab1e97f161e --approved-via cli`. One call, exit 0. Wire payload `{ raw: "Bottleneck Hunt" }`; guard verdict `allow / navigator_released`; gate id `gate-279684576db21bb1`; latency 1991 ms.
- **Outcome: MISS.** Theo returned an object with no canonical key and no error, so no canon_name. Nothing was written to `references/canon-translations.md` (the file was never created); `release_miss: 1` was reported and `releaseCounts` derives it from the audit ledger. Step 4 (basket then canon-confirm) did not apply because there was no proposed row; the hit path (propose then ratify, resolver via translation) is covered offline by R5, R7 and R8d/e.
- **Audit row verified:** one row in the scratch room's `.mindrian/research-audit.jsonl` with exactly the 23 keys, provider theo, grant_id = the gate id, q "Bottleneck Hunt", part8_verdict pass, outcome empty_valid, count 0, origin_ref `jtbd:find-bottleneck|section:problem-definition|perspective:eureka`.
- **Replay fixture:** `tests/fixtures/366-theo-replay/bottleneck-hunt.json` (replay shape, term and answer only, no room text). Honest limit: the raw Theo payload was not captured at call time (the release records the classified outcome, not the body), so the fixture holds the minimal object that classifies identically (no canonical, no error) and says so in its `transport_note`. A byte-exact capture would need a second live call or a record hook; flagged for the orchestrator.
- **Offline re-run:** test-366-gated-term-release 28/0 (new leg R13 replays the fixture through the gate and checks the miss, the 23-key row and that no row is written), test-366-guard-navigator-release 48/0.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: the one new egress is the navigator-gated term release (T-366-43..48 mitigated: receipt-bound arm after the content scan, minted-gate check, closed audit row, snapshot-only proposed rows, theo line off means no gate and no call, no key in files).

## Self-Check: PASSED

- FOUND: lib/core/research-planner/canon-release.cjs, tests/test-366-guard-navigator-release.cjs, tests/test-366-gated-term-release.cjs
- FOUND commits: 990e88893, 9e7c4b416, ba065ea26, dd8c0f1c5
