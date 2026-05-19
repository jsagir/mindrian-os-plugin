# MindrianOS Trajectory Telemetry -- Frozen v1 Schema

| Field         | Value                                                    |
|---------------|----------------------------------------------------------|
| Version       | 1                                                        |
| Status        | Active, frozen v1, additive-only changes                 |
| Structural    | Structural changes bump to schema_version 2 (coexists)   |
| Phase         | 121 (trajectory-telemetry)                               |
| Milestone     | v1.13.0 "The Closed Loop"                                |
| Last reviewed | 2026-05-19                                               |
| Canon parts   | Part 7 (Reuse Before Build), Part 8 (Graph Boundary), Part 9 (Memory Locality), Part 10 (Conversation as Product) |

---

## 1. Purpose

This document is the source-of-truth specification for the unified trajectory-telemetry stream produced by Phase 121. The stream captures structured per-event records of every high-signal navigator decision and shipping-surface state transition that has been wired up across v1.13.0 "The Closed Loop". Its sole downstream consumer is SEED-002 (the agent-lightning lab loop, deferred to v1.14.0+), which will ingest the stream post-hoc once the corpus crosses the >=100-event activation threshold. The agent-lightning paper this surface is designed to feed is at arXiv 2508.03680.

Per Canon Part 7 (Reuse Before Build), this is a consolidation surface, not greenfield. Prior to Phase 121, four piecemeal writers shipped across Phases 88.1, 109, 117, and 118 (mva.jsonl, selector.jsonl, navigation-bypass.jsonl, query-efficiency.jsonl). Plans 121-00 and 121-01 collapsed them into one unified writer (`lib/core/telemetry/writer.cjs`) with one emit-time validator (`lib/core/telemetry/validator.cjs`) and one frozen schema (`lib/core/telemetry/schema.cjs`).

## 2. Canon Part 8 Locality (CONSTITUTIONAL)

```
Capture point                                 (lib/hmi/, lib/memory/, lib/agents/, lib/core/, scripts/)
        |
        | emit(event, payload)
        v
lib/core/telemetry/writer.cjs                 (THE chokepoint -- single emit entry)
        |
        | validateEventPayload(event, payload)
        v
lib/core/telemetry/validator.cjs              (Canon Part 8 constitutional gate)
        |                                        7 forbidden-pattern detectors
        |                                        rejects with Error.code = 'TELEMETRY_VALIDATION'
        v
fs.appendFileSync(events-YYYY-WNN.jsonl)      (atomic JSONL append -- POSIX <PIPE_BUF)
        |
        v
~/.mindrian/telemetry/v1.13/                  (LOCAL only -- never leaves disk)
```

This is the single-chokepoint pattern from Canon Part 9 (`lib/core/navigation.cjs` precedent). There are exactly zero `fs.appendFileSync` calls anywhere else under `lib/core/telemetry/`. The four legacy writers are either shimmed (`lib/core/mva-telemetry.cjs`) or migrated and renamed to `*.pre-v121.bak` after Plan 121-01.

Zero network surface. Zero LOCAL-to-BRAIN egress. No `fetch(`, no `http.`, no `https.`, no Brain host references in any telemetry source. The Canon Part 8 audit harness at `tests/test-121-04-canon-part-8-audit.sh` grep-verifies this invariant across every telemetry-touching file.

The BRAIN never reads this stream. The user never sees this stream. Only the post-hoc SEED-002 lab loop reads it, and only after v1.13.0 final ships and at least 100 events accumulate.

## 3. File Layout

All files live under `~/.mindrian/telemetry/v1.13/`. The version-suffixed subdirectory is intentional; v1.14.0 starts a fresh subtree at `~/.mindrian/telemetry/v1.14/` when the next milestone cuts.

| Path                                          | Purpose                                                                                       |
|-----------------------------------------------|-----------------------------------------------------------------------------------------------|
| `events-YYYY-WNN.jsonl`                       | The unified stream. One JSON object per line, ISO-week rotated.                              |
| `.migration-fingerprints.json`                | Plan 121-01 idempotence marker. Per-source sha256 of the first-5-timestamps prefix.          |
| `.quarantine-<source>.jsonl`                  | Rows rejected by `validateEventPayload` during one-time migration. Audit-grade; not replayed. |
| `*.jsonl.pre-v121.bak`                        | Renamed legacy sources (mva.jsonl, selector.jsonl, navigation-bypass.jsonl, query-efficiency.jsonl) after successful migration. Read-only. |
| `mva.jsonl`                                   | Legacy dual-write target preserved by the `mva-telemetry.cjs` shim for Phase 118 byte-functional compatibility. Retires in v1.14.0. |

## 4. Row Envelope

Every line in `events-YYYY-WNN.jsonl` is a JSON object with these four envelope fields plus the per-event ALLOWED_FIELDS payload keys (Section 6).

| Field            | Type                  | Description                                                                                        |
|------------------|-----------------------|----------------------------------------------------------------------------------------------------|
| `event`          | String                | The 15-way discriminator. Exactly one of the EVENT_TYPES enumerated in Section 6.                  |
| `schema_version` | Number (frozen at 1)  | Per-row literal Number. Consumers dispatch with strict-equal. Future v2 events coexist in same file. |
| `timestamp`      | String (ISO-8601 UTC) | Wall-clock at emit. Writer overwrites caller-provided timestamps (exception: migration; Section 12). |
| `session_id`     | String (<= 64 chars)  | Sourced from `process.env.CLAUDE_SESSION_ID`, sliced to `MAX_STRING_LEN`. Defaults to `'default'`.  |

## 5. Reading the EVENT_TYPES list (15 in v1)

The frozen v1 taxonomy is 15 strings:

```
6 mva.* inherited (Phase 118)         9 net-new (Phase 121, D-04..D-09)
--------------------------------      -----------------------------------------
mva_pipeline_started                  selector_pick                  (D-04)
mva_agent_returned                    tension_engagement             (D-05)
mva_brief_rendered                    auto_explore_decision          (D-06)
mva_option_selected                   breakthrough_dismissed         (D-07)
mva_brief_deployed                    hooked_axis_score              (D-08)
mva_pipeline_failed                   empathy_observation            (D-09 surface 1)
                                      room_receipt_written           (D-09 surface 2)
                                      command_invocation             (D-09 surface 3, high volume)
                                      nav_bypass                     (D-09, inherited migration source)
```

`EVENT_TYPES` is `Object.freeze`'d as a top-level constant in `lib/core/telemetry/schema.cjs`. `ALLOWED_FIELDS` is also `Object.freeze`'d, with every per-event array also `Object.freeze`'d (17 freeze calls total). Adding a 16th event type is a v1 amendment requiring (a) ALLOWED_FIELDS extension, (b) Canon Part 8 review of new fields, (c) consuming plan CONTEXT.md update.

## 6. EVENT_TYPES (15 total) -- Per-Event Specification

Each subsection documents when the event fires, the closed ALLOWED_FIELDS whitelist, a sample payload, and the source file that owns the emit.

### 6.1 `mva_pipeline_started` (inherited; Phase 118)

- When: at the start of an MVA option router pipeline run.
- ALLOWED_FIELDS: `sentence_sha256`
- Source: `lib/core/mva-option-router.cjs` via `lib/core/mva-telemetry.cjs` shim -> `writer.cjs`.
- Sample:
  ```json
  {"event":"mva_pipeline_started","schema_version":1,"timestamp":"2026-05-19T09:00:00.000Z","session_id":"abc","sentence_sha256":"<64-hex>"}
  ```

### 6.2 `mva_agent_returned` (inherited; Phase 118)

- When: when one sub-agent in the MVA pipeline returns a brief.
- ALLOWED_FIELDS: `sentence_sha256, agent_id, duration_ms, status, error_short`
- Note: `error_short` capped at 60 chars (`MAX_ERROR_SHORT_LEN`).

### 6.3 `mva_brief_rendered` (inherited; Phase 118)

- When: when the unified MVA brief is rendered to the user.
- ALLOWED_FIELDS: `sentence_sha256, total_duration_ms, agent_count_ok, agent_count_failed`
- Note: This event uses `total_duration_ms` (not `duration_ms`) per Phase 118 Plan 03 WARN-2 ratification.

### 6.4 `mva_option_selected` (inherited; Phase 118)

- When: when the user clicks one of the MVA brief options.
- ALLOWED_FIELDS: `sentence_sha256, option_id, time_to_click_ms`

### 6.5 `mva_brief_deployed` (inherited; Phase 118)

- When: when an MVA-derived mini-site reaches Vercel.
- ALLOWED_FIELDS: `sentence_sha256, vercel_subdomain_hash, deploy_duration_ms, status, error_short`
- Note: `vercel_subdomain_hash` is a `_hash`-suffixed field; raw-hex detector exempts it.

### 6.6 `mva_pipeline_failed` (inherited; Phase 118)

- When: when the pipeline aborts before producing a brief.
- ALLOWED_FIELDS: `sentence_sha256, total_duration_ms, error_short`

### 6.7 `selector_pick` (D-04; Phase 88.2 + 125)

- When: at the end of every F-shape Decision Gate pick resolution where `payload.emitTelemetry === true` (the same gate as the existing `emitPresentationTelemetry` call).
- ALLOWED_FIELDS: `sub_shape, mode, ranker_confidence, recommended_rendered, options_count, room_slug_sha256, verb_chosen`
- Source: `lib/hmi/selector-dispatcher.cjs::emitSelectorPickUnified()` after `appendAskUserQuestionTrailer` + `emitPresentationTelemetry`.
- Sample:
  ```json
  {"event":"selector_pick","schema_version":1,"timestamp":"2026-05-19T09:10:42.123Z","session_id":"abc","sub_shape":"F.1","mode":"A","ranker_confidence":0.73,"recommended_rendered":true,"options_count":4,"room_slug_sha256":"<64-hex>","verb_chosen":"Run Methodology"}
  ```
- Exclusion: render-v2 Zone 4 enrichment caller does NOT set `emitTelemetry`, so it produces zero FS side-effects (Canon Part 8 fs_scope invariant).

### 6.8 `tension_engagement` (D-05; Phase 116)

- When: when `lib/memory/pending-tension-store.cjs::markResolved` succeeds with `last_response` in `{RESOLVE, LATER, SKIP}`.
- ALLOWED_FIELDS: `tension_type, user_response, ttr_seconds, room_slug_sha256, context_hash`
- Source: `pending-tension-store.cjs::emitTensionEngagementUnified()`.
- Native -> unified vocabulary (frozen `USER_RESPONSE_MAP` + `TENSION_TYPE_MAP`):
  - RESOLVE -> `resolve`, LATER -> `defer`, SKIP -> `ignore`, DROPPED is excluded (decay path bypasses markResolved structurally).
  - contradiction -> `contradicts`, convergence -> `converges`, stale_decision -> `invalidates`, open_question -> `invalidates`.
- Structural exclusion: the 3-strikes decay path (`evaluateAndDecay` -> `markDropped`) bypasses `markResolved` and therefore cannot emit. (Not procedural; structural.)
- Sample:
  ```json
  {"event":"tension_engagement","schema_version":1,"timestamp":"2026-05-19T09:11:08.456Z","session_id":"abc","tension_type":"contradicts","user_response":"resolve","ttr_seconds":42,"room_slug_sha256":"<64-hex>","context_hash":"<16-hex>"}
  ```

### 6.9 `auto_explore_decision` (D-06; Phase 117)

- When: at `lib/agents/auto-explore-agent.cjs::handleUserResponse` for `userResponse` in `{EXPLORE, LATER, SKIP}`.
- ALLOWED_FIELDS: `finding_type, user_response, domain_match_score, room_slug_sha256`
- Native -> unified vocabulary (frozen maps):
  - EXPLORE -> `kept`, LATER -> `redid`, SKIP -> `ignored`. FREE_TEXT is structurally excluded (frozen map has no key for it).
  - domain -> `whitespace`, reverse-salients -> `reverse_salient`, cross-domain -> `cross_domain_match`.
- Structural exclusion: `emitSkipped` (Tier 0, just_talk, dispatcher_load_failed, brain_baseline_unavailable, all_pipelines_empty) is a separate function from `handleUserResponse` and cannot emit.
- Sample:
  ```json
  {"event":"auto_explore_decision","schema_version":1,"timestamp":"2026-05-19T09:12:14.789Z","session_id":"abc","finding_type":"whitespace","user_response":"kept","domain_match_score":0.85,"room_slug_sha256":"<64-hex>"}
  ```

### 6.10 `breakthrough_dismissed` (D-07; Phase 120)

- When: at `lib/core/breakthrough/scanner.cjs::surfaceBreakthrough` after the `breakthrough_surfaced` memory_event lands and BEFORE the F.7 dispatch.
- ALLOWED_FIELDS: `detector_type, verb_chosen, ethics_tier, voice_audit_pass, room_slug_sha256`
- `ethics_tier` is the closed enum from Phase 120 D-18: `HARD_FLOOR | SOFT_BAND | NEUTRAL | GREEN`.
- `voice_audit_pass` is Boolean. Voice audit failure STILL emits because the dismissal signal is valuable regardless of audit pass/fail.
- Structural exclusions:
  - Provenance-blocked surfaces (D-20 third structural enforcement) early-return from `surfaceBreakthrough` before the emit code.
  - Throttled-by-canary candidates are filtered upstream in `scanForBreakthroughs::applyThrottleFilter` and never reach `surfaceBreakthrough`.
- Caller-provided `verb_chosen`: the surfacing event does not await F.7 user pick (that lands in `selector_pick`). The two events are joinable post-hoc by `detector_type + timestamp + room_slug_sha256`.
- Sample:
  ```json
  {"event":"breakthrough_dismissed","schema_version":1,"timestamp":"2026-05-19T09:13:55.012Z","session_id":"abc","detector_type":"convergence","verb_chosen":"Confirm","ethics_tier":"SOFT_BAND","voice_audit_pass":true,"room_slug_sha256":"<64-hex>"}
  ```

### 6.11 `hooked_axis_score` (D-08; Phase 117 scripts)

- When: emitted by `scripts/hooked-rescore-117.cjs` at re-score time. Existing emit path, normalized post-Plan 121-01 (read path repointed to unified stream).
- ALLOWED_FIELDS: `axis_name, score_value, room_slug_sha256, window_iso_week`
- `axis_name` enum: `investment | reward | trigger | action` (Hooked axis taxonomy).
- `window_iso_week` is a string of shape `YYYY-WNN` (the ISO week the score window covers).
- Note: schema is documented here; emit path is unchanged by Phase 121.

### 6.12 `empathy_observation` (D-09 surface 1; manual harness)

- When: manually triggered from the empathy audit ritual via `scripts/empathy-observation-emit.cjs`.
- ALLOWED_FIELDS: `engaged_past_15m, handed_back_material, returned_within_48h, ttr_seconds, tester_id_hash`
- `tester_id_hash` MUST match `^[0-9a-f]{64}$`. Never the raw tester ID (Canon Part 8; no real names).
- All three Boolean flags: `true | false`. Parser accepts `true|yes|1` and `false|no|0` case-insensitively. Rejects ambiguous input.
- Sample:
  ```json
  {"event":"empathy_observation","schema_version":1,"timestamp":"2026-05-19T09:14:00Z","session_id":"abc","engaged_past_15m":true,"handed_back_material":false,"returned_within_48h":true,"ttr_seconds":600,"tester_id_hash":"<64-hex>"}
  ```

### 6.13 `room_receipt_written` (D-09 surface 2; Phase 119)

- When: at `lib/core/room-auto-create.cjs::autoCreatePlaceholderRoom`, AFTER the existing `room_auto_created` memory_event try/catch and BEFORE the return statement.
- ALLOWED_FIELDS: `room_slug_sha256, conversation_id_hash, generated_at_ts`
- Helper: `lib/core/room-receipt-emit.cjs::emitReceiptWritten(roomSlug, conversationId)` is non-throwing by contract. Falsy args fall back to `sha256('')`.
- Per Canon Part 10 sub-claim 3 (rooms are receipts), every room creation IS a receipt of conversation work. This telemetry surface mirrors the existing `room_auto_created` memory_event into the trajectory stream so SEED-002 can correlate receipt cadence with engagement quality.
- Sample:
  ```json
  {"event":"room_receipt_written","schema_version":1,"timestamp":"2026-05-19T09:15:00Z","session_id":"abc","room_slug_sha256":"<64-hex>","conversation_id_hash":"<16-hex>","generated_at_ts":"2026-05-19T09:14:59.999Z"}
  ```

### 6.14 `command_invocation` (D-09 surface 3; PostToolUse broad sweep -- HIGH VOLUME)

- When: at `scripts/telemetry-command-invocation.cjs` (PostToolUse hook registered with `matcher: "SlashCommand"`) for every `/mos:*` invocation.
- ALLOWED_FIELDS: `command, outcome, duration_ms, context_hash`
- `outcome` enum: `success | error | aborted`. Hook coerces `cancelled` to `aborted`. Anything outside the closed set falls back to `success` (defensive).
- HIGH VOLUME warning: this bucket samples 100% of `/mos:*` invocations. Consumers MUST filter by `event === 'command_invocation'` to either include or exclude it. **The type discriminator IS the drowning protection** -- a SEED-002 high-signal analysis filters this bucket OUT to keep the selector_pick / tension_engagement / breakthrough_dismissed stream intact. A tool-usage correlation study filters this bucket IN.
- Two-layer filter: the hooks.json matcher gets the script in the door (broad, may match more than intended); the script-level `/^\/mos:/.test(CLAUDE_TOOL_COMMAND)` regex is the constitutional inner gate.
- Drowning-protection fixture: `tests/test-121-03-drowning-protection.cjs` proves 100 `command_invocation` + 10 `selector_pick` rows can be filter-isolated both directions without loss.

### 6.15 `nav_bypass` (D-09; inherited migration source)

- When: at `lib/core/room-db.cjs` when the `navigation.cjs` chokepoint is bypassed (legacy paths, startup bootstrap, tooling-only callers). Schema absorbed via the Plan 121-01 migration; new emits are runtime-routed through the unified writer.
- ALLOWED_FIELDS: `op, reason, caller_hash, room_slug_sha256`
- `op` enum: `read | write | query`.
- `reason` enum: `legacy_path | startup_bootstrap | tooling_only`.
- `caller_hash` is a stack-frame-derived identifier; NOT a file path.

## 7. Forbidden Pattern Enforcement (Canon Part 8)

`lib/core/telemetry/validator.cjs::validateEventPayload(event, payload)` is the single Canon Part 8 emit-time gate. It rejects with `Error.code = 'TELEMETRY_VALIDATION'` on the first matching pattern. Order matters for error-message specificity.

| # | Pattern label    | Regex / heuristic                                                        | Rationale                                              |
|---|------------------|---------------------------------------------------------------------------|--------------------------------------------------------|
| 1 | Cypher           | `/\b(MATCH\|RETURN\|CREATE\|MERGE)\s*\(/i`                                | Brain query body fragments must never reach telemetry. |
| 2 | Brain URL        | Concatenated tokens `['brain','mindrian','ai'].join('\\.')` (case-insensitive) | The production Brain MCP host. (Concatenated so this validator source does not itself contain the literal forbidden substring, preserving the zero-network grep gate.) |
| 3 | Email            | `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/`                        | Personal identifier; no PII in telemetry.              |
| 4 | Phone            | `/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/`                                     | Personal identifier (US-style 10-digit).               |
| 5 | Absolute path    | `/^[\/~][^"]*\/[^"]*\//`                                                  | Filesystem reference (>= 2 separators).                |
| 6 | Raw hex          | `/^[0-9a-f]{33,}$/i` in fields NOT matching `/(_sha256\|_hash)$/`         | Suspected raw hash leak / wallet / key material.       |
| 7 | Free-text prose  | length > 120 chars AND >= 3 spaces AND >40% lowercase                     | Raw artifact body smuggled through a string field.     |

Breach causes `emit()` to throw `Error{ code: 'TELEMETRY_VALIDATION', message: 'telemetry validation failed: <reason>' }`. Callers across the 7 capture-point modules wrap `emit()` in try/catch and swallow silently so a single bad payload never blocks the shipping behavior whose trajectory it is observing.

Hash-class field exemption: fields whose name ends with `_sha256` or `_hash` are exempt from the raw-hex detector. The validator still length-checks `*_sha256` fields against exactly 64 hex chars (`SHA256_LEN`).

Plus three structural rejections (not in the 7 forbidden-pattern list, but in the same validator):

- `unknown_event:<event>`        -- event not in EVENT_TYPES.
- `payload_not_object`           -- payload is null or non-object.
- `unknown_field:<key>`          -- key not in ALLOWED_FIELDS[event].
- `sha256_length_invalid:<key>`  -- sha256 field is not exactly 64 chars.
- `error_short_too_long`         -- error_short exceeds `MAX_ERROR_SHORT_LEN` (60).
- `string_too_long:<key>`        -- string exceeds `MAX_STRING_LEN` (64).

## 8. ISO-Week Rotation

File naming convention: `events-YYYY-WNN.jsonl` with zero-padded `WNN`. Computed via the ISO-8601 algorithm (Monday-start; Week 1 is the week containing the first Thursday of the year). Implemented in `lib/core/telemetry/writer.cjs::isoWeekFilename(date)`.

| Date         | Day of week               | ISO week | Filename                     |
|--------------|---------------------------|----------|------------------------------|
| 2026-01-01   | Thursday (W01 anchor)     | W01      | `events-2026-W01.jsonl`      |
| 2026-05-19   | Tuesday                   | W21      | `events-2026-W21.jsonl`      |
| 2026-12-31   | Thursday                  | W53      | `events-2026-W53.jsonl`      |
| 2025-12-30   | Tuesday (Thu shifts 2026) | W01      | `events-2026-W01.jsonl`      |

Year-boundary correctness: 2025-12-29..2025-12-31 (Mon-Wed) belong to 2026-W01 because the first Thursday of 2026 is 2026-01-01. The algorithm shifts the input to the Thursday of its week and reads the year from that shifted date.

## 9. SEED-002 Ingestion Guidance

Per arXiv 2508.03680 (agent-lightning lab loop, the APO consumption pattern), SEED-002 consumers MUST:

1. **Read in lexicographic order.** `readdirSync(~/.mindrian/telemetry/v1.13/).filter(n => /^events-\d{4}-W\d{2}\.jsonl$/.test(n)).sort()` yields ISO-week-ordered shards. The regex anchor prevents pickup of legacy files (`mva.jsonl`, `selector.jsonl`, etc.) and quarantine shards.
2. **Dispatch by `event` field.** A 15-way switch covers v1. The fixed enum is the integration contract.
3. **Dispatch by `schema_version` field.** v1 today; future v2 events coexist in the same file. A consumer that reads a v2 row it does not understand SHOULD skip the row, not abort -- additive evolution.
4. **Filter command_invocation OUT for high-signal analyses (drowning protection).** Include it only for tool-usage correlation studies. The type discriminator IS the protection -- the bucket lives separately on disk by virtue of its `event` field, not via per-row sampling.
5. **Group spans by session_id for within-session trajectory.** `session_id` is sourced from `CLAUDE_SESSION_ID` and is stable across a single Claude Code session.
6. **Group spans by room_slug_sha256 for cross-session per-room trajectory.** All net-new event types carry `room_slug_sha256` (a 64-hex sha256 of the room basename) so cross-session aggregation is keyable without revealing the room name.
7. **Trust ISO-8601 timestamps for total ordering.** `timestamp` is UTC ISO-8601 set by the writer at emit (exception: the one-time migration script preserved historical timestamps from source files; Section 12).
8. **Never write back.** The stream is append-only by contract. The shim `mva-telemetry.cjs` legacy dual-write is the only multi-target writer, and that retires in v1.14.0.

The lab loop activation gate is corpus size >= 100 events. The `/gsd:new-milestone` trigger scan reads the corpus and decides when to activate. There is no user-facing surface that exposes this count (D-12; Section 11).

## 10. Schema Evolution Policy

- **Additive changes (no version bump).** Adding a new `event` to EVENT_TYPES with its own ALLOWED_FIELDS entry is additive. Adding a new field to an existing event's ALLOWED_FIELDS is additive iff the field is optional (consumers SHOULD treat missing fields as undefined). Adding a 16th event in v1 is allowed; this document, schema.cjs, and the consuming plan's CONTEXT.md update together.
- **Structural changes (version bump to schema_version 2).** Renaming a field, removing a field, re-typing a field, changing an enum's closed set are all structural. They require a new schema_version 2 event class that coexists with v1 rows in the same JSONL file. A migration is NOT required because consumers dispatch per-row.
- **Coexistence in same file.** Row N may be `schema_version: 1`, row N+1 may be `schema_version: 2`. The 8-byte cost of carrying the version per row pays for an unlimited evolutionary runway.

## 11. D-12 Silent Observability (CONSTITUTIONAL)

Telemetry is lab-side. The user sees nothing about it.

- No `/mos:status` row referencing telemetry corpus.
- No SessionStart banner referencing telemetry corpus.
- No dashboard widget referencing telemetry corpus.
- No skill prose referencing telemetry corpus.
- No CHANGELOG-visible counter exposing corpus size.

Per Canon Part 10's "telemetry is lab-side" stance, the entire surface is silent observability. The SEED-002 `/gsd:new-milestone` trigger reads the corpus and decides when the >=100-event threshold hits; the user is never asked to think about it.

This invariant is structurally enforced by `tests/test-121-04-silent-observability.sh`, which grep-verifies that no `commands/*.md`, no `lib/hmi/**/*`, and no `skills/**/*` file references the telemetry corpus. The gate runs in CI on every commit.

Why silent? If the user sees `Trajectory corpus: 47 / 100 events` they will start optimizing for corpus rather than for their venture. The corpus is a side-effect of doing the work, not a goal. Premature commitment to a user-facing surface would also lock the system to a corpus-as-product framing that may not survive when SEED-002 takes over.

## 12. Migration Exception (Historical Timestamps)

The one-time Plan 121-01 migration script `scripts/migrate-telemetry-v1.cjs` does NOT route through `writer.emit()`. The exception is scoped, documented, and Canon Part 8 still enforced.

Why: `writer.emit()` overwrites the `timestamp` field with `new Date().toISOString()` so runtime emits are wall-clock-anchored. The migration must preserve the historical timestamp from the source row (the user's actual decision moment) rather than the migration moment.

How: the migration calls `validateEventPayload(eventType, payload)` BEFORE every `fs.appendFileSync` directly. Forbidden patterns from historical data quarantine to `.quarantine-<source>.jsonl` with a short reason string. The constitutional gate runs on every historical row.

Scope: this exception is scoped to the one-shot migration script. Runtime emit paths (Plans 121-02 + 121-03 capture-point wire-ins) route through `writer.emit()` unchanged. If a future plan needs the same historical-timestamp affordance, the cleaner fix is to extend `writer.emit()` with an `opts.historicalTimestamp` parameter at that time -- the migration script's `appendUnified` function then collapses to a single `writer.emit()` call.

Migration idempotence: the script persists per-source sha256 fingerprints (`source.name + '|' + first-5-timestamps`) to `.migration-fingerprints.json`. A re-run no-ops on previously-merged sources. Verified by Plan 121-01 Test 5 (3 rows migrated on first run; 0 migrated on second run with identical content).

## 13. References

### Canon

- `docs/MINDRIAN-CANON.md` Part 7 (Reuse Before Build) -- the framing reversal that makes Phase 121 a consolidation, not greenfield.
- `docs/MINDRIAN-CANON.md` Part 8 (Graph Boundary) -- the constitutional reason emit-time validation is non-negotiable.
- `docs/MINDRIAN-CANON.md` Part 9 (Memory Locality) -- the single-chokepoint pattern this writer mirrors (`navigation.cjs` precedent).
- `docs/MINDRIAN-CANON.md` Part 10 sub-claim 3 (Rooms are receipts) -- the rationale for the `room_receipt_written` event.

### Phase 121 source materials

- `.planning/phases/121-trajectory-telemetry/121-CONTEXT.md`
- `.planning/phases/121-trajectory-telemetry/121-00-SUMMARY.md`
- `.planning/phases/121-trajectory-telemetry/121-01-SUMMARY.md`
- `.planning/phases/121-trajectory-telemetry/121-02-SUMMARY.md`
- `.planning/phases/121-trajectory-telemetry/121-03-SUMMARY.md`
- `.planning/seeds/SEED-002-agent-lightning-lab-loop.md`

### Implementing modules

- `lib/core/telemetry/schema.cjs` -- THE frozen v1 schema source-of-truth (15 EVENT_TYPES + 9 net-new ALLOWED_FIELDS + 6 inherited mva.* ALLOWED_FIELDS + SCHEMA_VERSION = 1 Number + 4 length-cap constants).
- `lib/core/telemetry/validator.cjs` -- Canon Part 8 emit-time validator (7 forbidden-pattern detectors).
- `lib/core/telemetry/writer.cjs` -- THE chokepoint (emit + ISO-week rotation + atomic JSONL append + silent-fs-error swallow).
- `scripts/migrate-telemetry-v1.cjs` -- Plan 121-01 one-shot idempotent migration script (4 piecemeal source files -> unified stream).
- `lib/core/mva-telemetry.cjs` -- Plan 121-01 shim (delegating to writer.emit() + legacy dual-write for Phase 118 byte-compat; deprecates in v1.14.0).

### Downstream consumer (deferred)

- arXiv 2508.03680 (agent-lightning paper, the APO loop pattern SEED-002 implements). Activates when corpus >= 100 events.
- `.planning/seeds/SEED-002-agent-lightning-lab-loop.md` (the lab loop seed; refinement entry 2026-05-05 explicitly names Phase 121 as the activation gate).

### Precedents

- Phase 118 (`lib/core/mva-telemetry.cjs`) -- THE architectural ancestor of the unified writer; emit-time validator pattern; ALLOWED_FIELDS shape inherited verbatim for the 6 mva.* event types.
- Phase 88.1 Plan 16 (`lib/memory/query-efficiency-telemetry.test.cjs`) -- proven test pattern for emit-time validator coverage.
- Phase 109 (`lib/core/navigation.cjs`) -- the single-chokepoint pattern this writer mirrors (Canon Part 9 ratification).
- Phase 110 (Brain Context Packet Contract) -- Canon Part 8 structural enforcement precedent; this plan applies the same structural enforcement to telemetry payloads.

---

*Phase: 121-trajectory-telemetry*
*Plan: 04 (Closing Audit + Documentation)*
*Schema: frozen v1; additive-only; structural changes bump to schema_version 2*
