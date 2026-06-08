# Phase 110: Brain Context Packet Contract - Research

**Researched:** 2026-05-12
**Domain:** JSON-Schema wire contracts (ajv 8.x), Brain MCP wire path, generated-checked-artifact tooling (Phase 122 mirror), Canon Part 8 / Part 9 structural enforcement
**Confidence:** HIGH (codebase + ajv behavior verified locally; the one MEDIUM area is the Brain-side wire envelope, which is out of plugin scope and flagged in Open Questions)

> **Scope note for the planner:** the `110-CONTEXT.md` decisions D-00..D-11 are LOCKED and not re-litigated here. This document fills the implementation-detail GAPS the CONTEXT defers to research/planning. Everything below honors D-00..D-11 verbatim. Where research surfaces a tension with a locked decision (it does, once -- D-10's "legacy free-form Brain job calls" turns out to have **no existing surface** today), it is flagged in `## Risks / Open Questions`, NOT silently changed.

---

<user_constraints>
## User Constraints (from 110-CONTEXT.md)

### Locked Decisions (D-00..D-11 -- verbatim authority; the planner MUST honor these)

- **D-00 (thesis, LOCKED):** "Turn Canon Part 8 from 'we audit for leaks' into 'the wire format makes leaks structurally harder.'"
- **D-01 (the hard invariant, LOCKED -- release-gate enforced):** No Brain packet may be assembled directly from raw files, shell output, or conversation transcript. Packets are built **only** through `lib/core/navigation.cjs::buildBrainPacket` (the Phase 109 chokepoint). The navigation API is the SINGLE producer of sendable packets.
- **D-02 (closed job vocabulary, LOCKED):** The shipped jobs are exactly these 12 -- no more in this phase: `select_methodology`, `suggest_next_move`, `detect_contradiction`, `summarize_neighborhood`, `classify_room_budding`, `rank_assumptions`, `generate_feynman_explanation`, `strengthen_minto`, `prepare_investor_brief`, `opportunity_react`, `opportunity_reflect`, `opportunity_rank`. Every packet (regardless of job) also carries scalar opportunity context in `local_graph_summary.banked_opportunities` (count + top-3 by HSI; never raw bodies).
- **D-03 (privacy-mode names, LOCKED):** the three modes are `local_summary_only` (default) / `allow_filenames` / `allow_excerpts`.
- **D-04 (packet_version, LOCKED):** `packet_version: '1.0'`. Forward-compat handshake minimum: the plugin sends `packet_version`; if the Brain does not recognize it, the Brain rejects and the plugin degrades gracefully (no Brain advice this turn). No version negotiation beyond that for 1.0.
- **D-05:** The packet/response validator uses **`ajv@8.18.0`** -- already resolvable transitively via the MCP SDK; **do NOT add it as a direct dependency**. Plain JSON Schema, not hand-rolled tripwires.
- **D-06:** The schema lives at **`data/brain-packet-schema.json`** -- the single source of truth -- hand-maintained, with `$defs` per job carrying the `in` shape and the `out` shape, plus the privacy-mode enum, the `packet_version` const, and the `origin` enum. It is **generated-checked, not generated-from**: `scripts/build-brain-packet-schema.cjs --check` fails the build / pre-commit if the schema is malformed, if any of the 12 shipped jobs lacks an `in` or `out` `$def`, or if a `$def` references a job not in D-02's closed vocabulary.
- **D-07:** `lib/core/brain-client.cjs` gains a schema validator middleware: `sendPacket(packet)` -> validate against `schema.$defs[packet.job].in`; on failure -> **refuse to send** (throw a clear error naming the job + the validation failure), log a `memory_event` of type `brain_packet_rejected`. On a Brain **response** -> validate against `schema.$defs[job].out`; on failure -> **do NOT ingest**, log a `memory_event` of type `brain_response_rejected`, **degrade gracefully** (the turn proceeds with no Brain advice). Never throw on a bad response; never partial-ingest. **Reject hard, degrade soft.**
- **D-08:** The "this packet came from `buildBrainPacket`" guarantee is **three independent layers, no in-process nonce**: (1) `buildBrainPacket` stamps `packet.origin = 'navigation_api'`; the schema requires `origin` and constrains it to a closed enum: `'navigation_api'` in production; `'test_fixture'` accepted **only** when `process.env.MINDRIAN_TEST_MODE === '1'` (checked at validate-time). (2) Pre-commit hook (extend `scripts/check-schema-aliases.cjs` OR a sibling check) fails any commit that introduces a `brain-client...sendPacket(` call site not lexically preceded by a `buildBrainPacket(` call. (3) `brain-client.sendPacket` itself rejects any `packet.origin` not in the closed allowlist.
- **D-09:** Default + the only mode any of the 12 shipped jobs ever requests = `local_summary_only`. Opt-up to `allow_filenames`: set `config.json > preferences.brain_privacy_mode` (project-level) or pass `opts.privacyMode` per-call -- no further prompt. Opt-up to `allow_excerpts`: requires the config flag / per-call override **AND** a one-time tri-context Decision Gate (Canon Part 3) per room -- a `Run Methodology`-style F-shape selector, captured as an `APPROVE` (with reason) / `REJECT` / `DEFER` edge. `allow_excerpts` has **no shipped consumer** -- a documented escape hatch, never auto-triggered. The validator enforces per-job: config can only *cap* the mode, never *raise* what a job actually sends.
- **D-10:** Through **v1.13.0-beta.3 .. v1.13.0-final**: both paths live. `sendPacket()` (typed) is the preferred path; legacy job-style free-form Brain calls still work, but the first one per session emits a `console.warn` deprecation notice + a `memory_event` / telemetry line (`brain_legacy_path_used`). In **v1.14.0** the legacy job path is **DELETED** (code removed). `brain-client.query()` / `write()` raw-Cypher methodology lookups are explicitly **NOT** "legacy" and are untouched forever.
- **D-11:** The test suite must prove, per shipped job (all 12): (a) well-formed `in` validates, malformed is refused with the expected `brain_packet_rejected` event; (b) off-spec Brain `out` is refused-and-degraded with the expected `brain_response_rejected` event, no partial ingest; (c) a packet with `origin` other than the allowed enum (in the relevant env) is refused; (d) the Canon Part 8 invariant -- no body/transcript/shell text -- holds for the packet `buildBrainPacket` actually produces. Plus: the `--check` schema tripwire test, and the pre-commit-hook test. Framework = node `assert` / `node:assert/strict` + `child_process` (no jest/mocha/vitest/zod), registered in `lib/memory/run-feynman-tests.cjs` + a scoped `tests/run-all-110.sh`.

### Claude's Discretion (planner/researcher decide -- this RESEARCH recommends a disposition for each)

- JSON Schema authoring style inside `data/brain-packet-schema.json` (one big `$defs` vs `$ref`-composed sub-schemas; how `local_graph_summary` / `banked_opportunities` is factored). **-> RESEARCH recommendation in §"Implementation Approach" item 2.**
- Whether the pre-commit `sendPacket`-without-`buildBrainPacket` check extends `scripts/check-schema-aliases.cjs` or is a new sibling script. **-> RESEARCH recommendation: extend `check-schema-aliases.cjs` with a `--check-sendpacket` subcommand, mirroring the Phase 109 `--check-chokepoint` pattern (see §"Implementation Approach" item 5). BUT: see Open Question 4 -- neither hook subcommand is currently wired into the installed `.git/hooks/pre-commit`, so the planner must ALSO wire it.**
- Forward-compat handshake mechanics beyond D-04's minimum -- **RESEARCH: leave at D-04 minimum; no real need surfaced.**
- Whether `brain-client.sendPacket()` is a brand-new function or `callTool()` gains a packet-aware path. **-> RESEARCH recommendation: brand-new `sendPacket()` function (see §"Implementation Approach" item 4 + Open Question 1).**
- How the deprecation `console.warn` is rate-limited to once-per-session. **-> RESEARCH recommendation: module-level boolean flag in `brain-client.cjs` (matches the `checkFilePermissions._warned` pattern already in the file at line 114). See §"Implementation Approach" item 7.**
- Naming/placement of the new `memory_event` types within the Phase 109 closed EVENT_TYPES enum -- this EXTENDS the enum (like Phase 116-00 added 5 tension strings). **-> RESEARCH: extend `lib/core/navigation/memory-events.cjs` `EVENT_TYPES` Set with `brain_packet_rejected`, `brain_response_rejected`, `brain_legacy_path_used` (3 new -> set size 31 -> 34). See §"Implementation Approach" item 6.**

### Deferred Ideas (OUT OF SCOPE -- DO NOT plan)

- Brain-side schema enforcement (the Brain repo validating the same schema on its end) -- coordinated separately; out of plugin scope.
- New Brain jobs beyond the shipped 12 -- new phases.
- Streaming / incremental / chunked packets -- defer until a real use case appears.
- Version negotiation beyond the D-04 minimum -- YAGNI for `packet_version: '1.0'`.
- An in-process nonce on top of D-08's three layers -- considered, rejected as overkill.
- Migrating `brain-client.query()` / `write()` to a typed shape -- out-of-scope-by-design (only generic handles; nothing to harden).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

Phase 110 has **NO requirement IDs registered yet** (`.planning/REQUIREMENTS.md` line 254 ends the NAV-109 block; there is no `## Brain Context Packet Contract (PACKET-110)` block). The Phase 109 convention -- confirmed by reading `109-00-PLAN.md`'s Wave-0 substrate plan (`Plans: 13/13` row in ROADMAP line 1026) -- is that a **Wave-0 substrate plan registers the requirement IDs** + creates test stubs + writes the scoped runner. The planner MUST do the same for Phase 110.

**Proposed PACKET-110-01..09 breakdown (the planner registers these; this is the proposed decomposition derived from D-05..D-11 + the locked scope):**

| ID | Description | Derived from | Research Support |
|----|-------------|--------------|------------------|
| **PACKET-110-01** | `data/brain-packet-schema.json` ships: root schema with `$defs` per all 12 D-02 jobs, each `$def` carrying `in` + `out` sub-schemas; shared `$defs` for `local_graph_summary` / `banked_opportunities` / `privacy_mode` enum / `packet_version` const / `origin` enum (`navigation_api`, `test_fixture`); `additionalProperties: false` on every object node; draft 2020-12. Update `data/ROOM.md` "Files in this section" table. | D-04, D-05, D-06, D-08 | §"Implementation Approach" 1-3; ajv 8.18 `$defs`/`$ref` verified working locally |
| **PACKET-110-02** | `scripts/build-brain-packet-schema.cjs --check` mirrors `scripts/build-command-registry.cjs`: (a) default run = validate the schema is well-formed (compiles under ajv `strict:false`), every D-02 job has an `in` AND an `out` `$def`, no `$def` references a job outside D-02, then exit 0 (or rewrite a derived index file if the planner chooses one); (b) `--check` = re-derive in memory, exit 1 on stale/malformed/missing-job/unknown-job, print a one-line recovery command on stderr. | D-06, D-11 | §"Implementation Approach" 3; Phase 122 `build-command-registry.cjs` is the verbatim template |
| **PACKET-110-03** | `lib/core/brain-client.cjs` gains `sendPacket(packet, opts)` + an ajv validator middleware: lazy-compile `data/brain-packet-schema.json` once at module scope; `ajv.getSchema('#/$defs/' + job + '/properties/in')` (or compile a per-job validator once and memoize); validate `packet` against the `in` sub-schema; on failure throw a clear error naming `packet.job` + the ajv error list AND log `brain_packet_rejected` via `navigation.cjs`; on success build the wire envelope and POST it. Also: layer-3 origin allowlist check (`packet.origin` must be `navigation_api`, or `test_fixture` only when `MINDRIAN_TEST_MODE==='1'`) that fires *before* ajv (belt to the schema's suspenders). | D-07 (`in` half), D-08 layer 3 | §"Implementation Approach" 4; existing `callTool`/`_ensureSession`/`getApiKey` wire path read in full |
| **PACKET-110-04** | The response-validation-then-degrade-gracefully gate: in `lib/core/navigation/ingestion.cjs` (in front of, or inside, `storeBrainSuggestions`) -- OR a thin gate in `brain-client.sendPacket` that runs before returning -- validate the Brain `out` against `schema.$defs[job].out`; on failure: do NOT ingest, log `brain_response_rejected` via `navigation.cjs`, return a "no Brain advice this turn" sentinel; **never throw, never partial-ingest** ("reject hard, degrade soft"). Existing `storeBrainSuggestions` shape (`{ suggestions: [...] }`, each landing `review_status: 'proposed'`) is unchanged; the gate is purely additive. | D-07 (`out` half), Canon Part 9 | §"Implementation Approach" 5; `ingestion.cjs` already wraps its writes in `BEGIN/COMMIT/ROLLBACK` |
| **PACKET-110-05** | `buildBrainPacket` (in `lib/core/navigation/packet.cjs`) adds `origin: 'navigation_api'` to its returned object (one new top-level field next to `packet_version`). The packet shape stays exactly as Phase 109 ships it; this is a one-line addition. The schema (`$defs.*.properties.in`) requires `origin`. Phase 109's 2 packet tests (`test-navigation-packet-builder.cjs`, `test-navigation-packet-part8-leak.cjs`) get a regression touch to assert `packet.origin === 'navigation_api'`. | D-08 layer 1 | §"Implementation Approach" 6 |
| **PACKET-110-06** | Extend the closed `EVENT_TYPES` Set in `lib/core/navigation/memory-events.cjs` with `brain_packet_rejected`, `brain_response_rejected`, `brain_legacy_path_used` (3 new strings; additive, same pattern as Phase 116-00's 5 tension strings; set size 31 -> 34). `test-navigation-memory-events.cjs` regression touch (the closed-enum size assertion). | D-07, D-10, "Claude's Discretion" enum-extension note | §"Implementation Approach" 7 |
| **PACKET-110-07** | Privacy-mode opt-up wiring: read `roomDir/.config.json > preferences.brain_privacy_mode` (note: the room config is `.config.json` with a leading dot -- see `lib/core/model-profiles.cjs:69`); accept `opts.privacyMode` per-call (per-call beats config); resolve to one of D-03's 3 enum values, default `local_summary_only`. `allow_excerpts` additionally requires a Part-3 Decision Gate edge per room (an `APPROVE`-with-reason edge on the room node, written via `navigation.cjs` -- the F.0/F.1 selector primitive already exists: `lib/hmi/shape-f0-renderer.cjs`). The schema validates the *narrower* of {config-resolved mode, the job's declared mode}: the validator picks `$defs[job].in` whose `privacy_mode` const/enum reflects the job's cap, and the resolved mode is rejected if it exceeds it. **No shipped job ever requests above `local_summary_only`** -- so in practice the privacy fields in every shipped `$def.in` are `const: "local_summary_only"`. | D-03, D-09, Canon Part 3 | §"Implementation Approach" 8 |
| **PACKET-110-08** | Dual-path + once-per-session deprecation: a module-level `let _legacyPathWarned = false;` flag in `brain-client.cjs`; the first legacy job-style Brain call per session emits `console.warn('[mindrian-os] legacy free-form Brain job call -- migrate to brain-client.sendPacket(); the legacy job path is removed in v1.14.0')` + logs `brain_legacy_path_used` via `navigation.cjs`. **SEE Open Question 5: there is NO existing legacy job-style call surface today** -- the planner must decide whether (a) this is a forward-looking guard with no current call site (a no-op until something uses it), or (b) the "legacy path" being deprecated is conceptually the act of calling `callTool()` / `query()` to do job-like work, in which case D-10's "legacy job path DELETED in v1.14.0" touches `callTool` only if a job-shaped helper is ever added before then. RESEARCH recommendation: (a) -- ship the flag + warn + event as the contract, with no current call site, documented as "the door for any future free-form Brain job helper; new code uses `sendPacket()`." | D-10 | §"Implementation Approach" 7; verified zero existing "job-style" Brain callers |
| **PACKET-110-09** | The D-11 test suite: per-job in/out validation suite (12 jobs x {valid in, malformed in -> `brain_packet_rejected`, off-spec out -> `brain_response_rejected` no partial-ingest, bad `origin` -> refused}); per-job Canon-Part-8-invariant grep-sweep over `JSON.stringify(buildBrainPacket(...))` (mirror `test-navigation-packet-part8-leak.cjs`); the `--check` schema tripwire test (malformed schema / missing job `$def` / unknown job -> non-zero, via `child_process`); the pre-commit-hook test (a fixture diff introducing a bare `sendPacket(` -> hook exit non-zero, mirror `test-navigation-chokepoint-hook.cjs`). All registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` + a new `tests/run-all-110.sh` (mirror `tests/run-all-122.sh`). | D-11 | §"Validation Architecture" + §"Phase Requirements -> Test Map" below |

The planner should also add a traceability block in `.planning/REQUIREMENTS.md` (`## Brain Context Packet Contract (PACKET-110)` + the `PACKET-110-XX | Phase 110 | <status>` rows), mirroring the NAV-109 block (lines 254-272 + 443-451).
</phase_requirements>

---

## Summary

Phase 110 is a **contract layer** -- thin, additive, and almost entirely a clone of two patterns already in the repo: (1) Phase 122's "generated-checked artifact in `data/` + `--check` tripwire wired into the pre-commit hook + the Feynman runner" (the model for `data/brain-packet-schema.json` + `scripts/build-brain-packet-schema.cjs`), and (2) Phase 109's "single chokepoint module + a pre-commit hook that fails any direct access outside it" (the model for `sendPacket()` being the only door + D-08 layer 2). The validator is `ajv@8.18.0`, which is **already on disk** (`node_modules/ajv/dist/ajv.js`, pulled in transitively by `@modelcontextprotocol/sdk@1.29.0` which declares `ajv: "^8.17.1"` + `ajv-formats: "^3.0.1"`) -- `require('ajv')` resolves, and per CLAUDE.md "What NOT to Use" it must **not** become a direct dependency. I verified locally that ajv 8.18.0 compiles a schema with `$defs` + `$ref: '#/$defs/X'` in a single `compile()` call, that `additionalProperties: false` produces `keyword: 'additionalProperties'` errors with `params.additionalProperty`, and that `strict: false` is the right constructor option to avoid strict-mode compile-time throws on a hand-maintained schema.

The single biggest **gap** the CONTEXT defers -- and the one the planner most needs to know about -- is the Brain wire-envelope question: **the Brain MCP server (`mcp-server-brain/`) has no "job"-style tool today.** Its tools are `brain_query` (read-only Cypher), `brain_write`, `brain_schema`, `brain_search`, `brain_stats`, and `brain_ask` (NL -> Cypher). There is no `brain_packet` / `brain_job` tool that accepts a typed Brain Context Packet. So Phase 110's `sendPacket()` has nowhere on the live Brain to send a packet *as a packet* -- it would either (a) need a new Brain tool added in the Brain repo (which D-10's deferred-ideas block puts out of plugin scope), or (b) `sendPacket()` becomes the validated *envelope-and-store* path that wraps an existing call (e.g. it validates the packet, then -- for the jobs that map to a methodology lookup -- translates the validated generic handles into a `brain_query` Cypher; for the jobs that have no Brain analog yet, it returns "no Brain advice"). **The CONTEXT does not resolve this; the planner must.** RESEARCH's recommendation: ship `sendPacket()` as the validate-then-route function; for v1.13.0-beta.3, route to a new optional Brain tool name (`brain_packet`) that the plugin probes for and degrades gracefully when absent (consistent with D-04's "Brain doesn't recognize it -> reject -> degrade soft"), and coordinate the Brain-side `brain_packet` tool as a separate (deferred, out-of-plugin-scope) task. The wire change is **NOT breaking** in the plugin sense -- a missing `brain_packet` tool just means no Brain advice that turn, which the existing graceful-degradation contract already covers everywhere.

The other gaps -- ajv usage patterns, the `--check` mechanics, where `sendPacket` slots in, where `origin` gets added, the dual-path warning mechanics, the privacy-mode opt-up wiring, the EVENT_TYPES extension -- all have clean, verified answers below.

**Primary recommendation:** Mirror Phase 122 for the schema + `--check` tooling and Phase 109 for the chokepoint + hook; ship `sendPacket()` as a brand-new validate-then-route function in `brain-client.cjs`; add `origin` as a one-line field in `packet.cjs`; extend the EVENT_TYPES Set by 3; treat D-10's "legacy job path" as a forward-looking guard with no current call site (verified -- there is none today); and flag the Brain-side `brain_packet` tool as the one cross-repo coordination item (out of plugin scope per D-10's deferred block).

---

## Project Constraints (from CLAUDE.md)

These are treated with the same authority as locked CONTEXT decisions. The planner must not produce tasks that contradict them.

- **Workspace guard:** all work in `/home/jsagi/MindrianOS-Plugin/`. NEVER `~/.claude/plugins/*`. (Confirmed `pwd` = `/home/jsagi/MindrianOS-Plugin` at research start.)
- **"What NOT to Use" (the load-bearing one for this phase):** `ajv` / `Hono` / `Express` come **bundled with the MCP SDK -- do NOT add them as direct dependencies.** No `zod` for this (zod is the MCP-tool-input validator, not the packet-wire validator -- D-05 explicitly picks ajv). No `jest` / `mocha` / `vitest`. Test framework = node `assert` / `node:assert/strict` + `child_process`. CJS, not ESM. No TypeScript build step. No `commander` / `yargs` -- `process.argv` switch-case.
- **Test conventions:** new `*.test.cjs` / `tests/test-*.cjs` files; register in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]`; exit-code convention: 0 = PASS, 77 = SKIPPED (env degraded), other = FAIL; a scoped `tests/run-all-110.sh` mirrors `tests/run-all-122.sh` / `run-all-956.sh`.
- **ICM Layer 0 (decision #15):** every directory has `ROOM.md`. `data/` already has one (`data/ROOM.md`, founding phase 122) -- adding `data/brain-packet-schema.json` means **updating that file's "Files in this section" table** (no new MINTO.md needed -- `data/` is outside the `.room-root` cascade). New `scripts/` and `lib/core/navigation/` additions live under existing dirs that already have ROOM.md.
- **Canon Parts 8 + 9 (the constitution this phase hardens):** Part 8 LOCAL->BRAIN: NO; Part 8 PR gate ("every PR touching `mcp-server-brain/`, `lib/core/brain-*`, or any MCP tool that queries the Brain must pass the brain-boundary-scan and receive Canon-Custodian review"); Part 9 "Brain reasons over structured packets, never raw memory" + "no agent may write a `confirmed`-status node directly" (Brain writes land `proposed`, per Phase 109's `ingestion.cjs` -- unchanged).
- **Release process (the 5-gate rule + lockstep npm):** Phase 110's parent release is `v1.13.0-beta.3` per the Path-C re-route (see `CANON-PHASE-MAP.md` line ~155 and the v1.13.0 milestone table). Per the user-memory HARD RULE: every plugin release publishes `@mindrian/os` to npm in lockstep (CHANGELOG / plugin.json / root package.json / packages/npm-installer/package.json / git tag / marketplace.json `source.ref` all sync; `scripts/release.sh` Step 9.5 enforces). **The release commit is OUT OF SCOPE for the phase plans** (per the Phase 109 ledger-note precedent) -- but the planner should note the target band in the ROADMAP update.
- **MCP-stack-awareness:** before web research, check the MCP stack and ask which tool. For this phase, library docs (ajv 8.x) are the no-ask Context7 exception -- BUT the Context7 MCP tools were **not available in this researcher's tool namespace** (no `mcp__context7__*` resolved), so ajv docs were sourced from the official `ajv.js.org` site via WebFetch + verified by running ajv 8.18.0 locally. Flagged here for honesty.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ajv` | **8.18.0** (on disk; do NOT add as a direct dep) | Compile `data/brain-packet-schema.json` once; validate Brain packets (`in`) and Brain responses (`out`) per job | D-05 picks it explicitly. It is **already resolvable** -- `@modelcontextprotocol/sdk@1.29.0` declares `ajv: "^8.17.1"` which resolved to `8.18.0` (`node_modules/ajv/dist/ajv.js`; verified `require('ajv')` works). Adding it as a direct dep is forbidden by CLAUDE.md "What NOT to Use" ("ajv... come bundled... do NOT add these as direct dependencies"). Note: the npm registry latest is `8.20.0` (verified via `npm view ajv version`) -- the on-disk `8.18.0` is what ships; do not pin to a newer one. |
| `ajv-formats` | 3.0.1 (on disk; also bundled via the SDK) | Only if the schema uses `format` keywords (`date-time`, etc.) | Resolvable (`node_modules/ajv-formats/dist/index.js`). RESEARCH recommendation: **avoid `format` keywords in the packet schema** -- the packet carries hashes, enums, and integers, not formatted strings; skipping `format` means you don't need to wire `addFormats(ajv)` and there's one less moving part. If a `date-time` is genuinely needed (e.g. `last_seen_at` ISO timestamps -- but Phase 109's packet uses epoch-ms integers, not ISO strings), then `require('ajv-formats')` and `addFormats(ajv)`. |
| Node built-ins (`node:assert/strict`, `node:child_process`, `node:fs`, `node:path`, `node:crypto`) | Node >= 18 | Test framework + the `--check` script + the pre-commit guard | CLAUDE.md hard rule. No `jest`/`mocha`/`vitest`. |

### Supporting (the tooling pattern, not a library)

| Asset | Where it already exists | How Phase 110 reuses it |
|-------|------------------------|--------------------------|
| Generated-checked-artifact pattern | `scripts/build-command-registry.cjs` + `data/command-registry.json` + the `git diff --cached ... grep -qE '^(commands/.*\.md\|data/command-registry\.json...)$'` block in `scripts/hooks/pre-commit-room-minto-guard.sh` lines 143-147 | Copy verbatim for `scripts/build-brain-packet-schema.cjs` + `data/brain-packet-schema.json` + a new pre-commit block keyed on `^(data/brain-packet-schema\.json\|scripts/build-brain-packet-schema\.cjs)$`. |
| Chokepoint + pre-commit-guard pattern | `lib/core/navigation.cjs` (the door) + `scripts/check-schema-aliases.cjs` `--check-chokepoint` subcommand (the guard, scans staged JS for banned `require()`s outside an allow-list) | Mirror for `sendPacket()` (the door) + a `--check-sendpacket` subcommand in the same `check-schema-aliases.cjs` mega-script (scans staged JS for `sendPacket(` calls not lexically preceded by `buildBrainPacket(`). |
| Forbidden-substring grep-sweep test idiom | `tests/test-navigation-packet-part8-leak.cjs` (8 tripwires over `JSON.stringify(packet)`) + `lib/memory/brain-derivation.test.cjs` Tests 13 + 14 (capture every Brain payload, assert it matches an allow-list regex set and no forbidden regex) | Mirror for the D-11(d) per-job Canon-Part-8-invariant tests. |
| `require.cache` override for `brain-client.cjs` in tests | `lib/memory/brain-derivation.test.cjs` lines 61-125 (installs a fake `brain-client.cjs` with `isAvailable()`/`schema()`/`query()`/`search()` that records every invocation; reset between tests) | The pattern for testing `sendPacket()` without hitting the live Brain. |
| Scoped bash runner | `tests/run-all-122.sh` / `tests/run-all-956.sh` (header explains RED-by-design-until-owning-plan-lands; `SHELL_SUITES` + `CJS_SUITES` arrays; per-suite PASS/FAIL; non-zero exit if any failed) | Copy verbatim for `tests/run-all-110.sh`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ajv` JSON Schema | Hand-rolled per-job `validateIn<Job>()` / `validateOut<Job>()` (the Phase 90 5-tripwire style) | D-05 explicitly rejected this: "a machine-readable contract is the point of 'the wire format makes leaks structurally hard.'" The Phase 90 tripwire idiom is reused only for the *tests* (D-11(d)), not for the runtime validator. |
| New `sendPacket()` function | `callTool()` gains a packet-aware code path | RESEARCH recommends new function (cleaner; `callTool` stays the dumb JSON-RPC transport; the D-08 layer-2 hook can grep for `sendPacket(` unambiguously; the D-10 v1.14.0 deletion has a clean boundary). |
| Extend `check-schema-aliases.cjs` for D-08 layer 2 | New sibling `scripts/check-sendpacket-origin.cjs` | RESEARCH recommends extending (Canon Part 7 reuse; single mega-script with sub-commands per check is the established Phase 108/109 pattern). Either is acceptable per the CONTEXT. **Caveat:** see Open Question 4 -- the *installed* pre-commit hook doesn't currently invoke `check-schema-aliases.cjs` at all (it invokes `build-command-registry.cjs --check` only), so the planner must wire it regardless of which script holds the new subcommand. |
| draft 2020-12 schema | draft-07 schema | ajv 8.x supports both. RESEARCH recommends **2020-12** (`"$schema": "https://json-schema.org/draft/2020-12/schema"`) -- it's the current default, `$defs` is the 2020-12 spelling (draft-07 used `definitions`), and `new Ajv(...)` from `require('ajv')` handles both. (If 2020-12-specific keywords like `prefixItems` are needed, use `ajv/dist/2020`; for plain `$defs`/`$ref`/`additionalProperties` the default `require('ajv')` export is sufficient -- verified.) |

**Installation:** none. `ajv` and `ajv-formats` are already in `node_modules/` via the MCP SDK. Do NOT run `npm install ajv`.

**Version verification (done 2026-05-12):**
- `node -e "require('ajv/package.json').version"` -> `8.18.0` (on disk)
- `node -e "require('ajv-formats/package.json').version"` -> `3.0.1` (on disk)
- `node_modules/@modelcontextprotocol/sdk/package.json` -> `"version": "1.29.0"`, `"dependencies": { ..., "ajv": "^8.17.1", "ajv-formats": "^3.0.1", ... }`
- `npm view ajv version` -> `8.20.0` (registry latest -- do NOT pin to this; the bundled 8.18.0 is what ships and what tests run against)
- `package.json` `dependencies` -> `ajv` is **NOT** listed (correct -- it must stay transitive). `package-lock.json` line 82-83 shows `ajv: "^8.17.1"` under the SDK's deps. The MEDIUM risk here: a future MCP SDK bump could in principle drop or change the `ajv` version; the planner should note this in the schema script's header ("ajv is transitive via @modelcontextprotocol/sdk; if a future SDK bump removes it, this is the canary").

---

## Architecture Patterns

### Recommended File Layout (additions only)

```
data/
├── brain-packet-schema.json     # NEW -- the single source of truth (D-06). draft 2020-12.
│                                #   { "$schema": "...", "$id": "https://mindrian-os.com/schemas/brain-packet/1.0",
│                                #     "$defs": {
│                                #       "PrivacyMode":      { "enum": ["local_summary_only","allow_filenames","allow_excerpts"] },
│                                #       "Origin":           { "enum": ["navigation_api","test_fixture"] },
│                                #       "BankedOpportunities": { "type":"object", "additionalProperties":false,
│                                #                                "required":["count","items"],
│                                #                                "properties":{ "count":{"type":"integer","minimum":0},
│                                #                                  "items":{"type":"array","maxItems":3,"items":{ ... id_hash/tags/hsi_band/composite_score ... }} } },
│                                #       "LocalGraphSummary": { "type":"object", "additionalProperties":false, ... nearest_claims/nearest_assumptions/contradictions/unsupported_claims/recent_changes + "banked_opportunities":{"$ref":"#/$defs/BankedOpportunities"} },
│                                #       "select_methodology":         { "in":{...,"required":["packet_version","job","origin","privacy_mode","local_graph_summary",...], "properties":{"packet_version":{"const":"1.0"},"job":{"const":"select_methodology"},"origin":{"$ref":"#/$defs/Origin"},"privacy_mode":{"const":"local_summary_only"},"local_graph_summary":{"$ref":"#/$defs/LocalGraphSummary"},...}, "out":{...} },
│                                #       ... 11 more job $defs, same shape, "job":{"const":"<jobname>"} ...
│                                #     } }
├── ROOM.md                      # UPDATE -- add the brain-packet-schema.json row to the "Files in this section" table
├── command-registry.json        # (unchanged)
└── framework-names.json         # (unchanged)

scripts/
├── build-brain-packet-schema.cjs   # NEW -- mirrors build-command-registry.cjs. Default run: validate well-formedness
│                                   #   + every D-02 job has in+out $defs + no unknown-job $def -> exit 0.
│                                   #   --check: re-validate in memory, exit 1 on malformed/missing/unknown, print recovery cmd.
│                                   #   (No --refresh-names equivalent -- the schema is hand-maintained, not Brain-derived.)
├── check-schema-aliases.cjs        # EXTEND -- add a `--check-sendpacket` subcommand (D-08 layer 2):
│                                   #   scan staged *.cjs/*.js for `\bsendPacket\s*\(` not lexically preceded (same file,
│                                   #   within N lines, or same function body) by a `buildBrainPacket\s*\(`; exit 1 with a
│                                   #   structured message pointing at D-08. Allow-list: lib/core/brain-client.cjs (the def),
│                                   #   lib/core/navigation*.cjs, tests/, scripts/.
└── hooks/pre-commit-room-minto-guard.sh  # EXTEND -- add a block, after the command-registry block (lines 143-147):
                                          #   if staged files touch ^(data/brain-packet-schema\.json|scripts/build-brain-packet-schema\.cjs)$
                                          #     -> node scripts/build-brain-packet-schema.cjs --check || exit 2
                                          #   AND (per Open Question 4) wire `node scripts/check-schema-aliases.cjs --check-sendpacket || exit 2`
                                          #   on every commit (or at least when a *.cjs/*.js is staged). Note: scripts/hooks/pre-commit
                                          #   and scripts/hooks/pre-commit-room-minto-guard.sh are byte-identical (8588 bytes) and
                                          #   .git/hooks/pre-commit matches both -- so edit ALL THREE (or edit the source and re-run
                                          #   scripts/setup-hooks.sh, which byte-copies the source over the installed hook).

lib/core/brain-client.cjs            # EXTEND -- add: module-scope lazy ajv compile of data/brain-packet-schema.json;
                                     #   `let _legacyPathWarned = false;`; `function sendPacket(packet, opts) { ...origin allowlist
                                     #   check -> ajv validate in -> log brain_packet_rejected on fail/throw -> build wire envelope
                                     #   -> POST (to a `brain_packet` tool name, probed; degrade soft if absent) -> ajv validate out
                                     #   -> log brain_response_rejected + return no-advice sentinel on fail -> return validated result }`;
                                     #   export sendPacket; add to the `_test` block (the compiled validators, _legacyPathWarned reset).

lib/core/navigation/packet.cjs       # EXTEND -- add `origin: 'navigation_api',` next to `packet_version: '1.0',` in the
                                     #   buildBrainPacket return object (one line).

lib/core/navigation/ingestion.cjs    # EXTEND (or leave; the gate can live in brain-client.sendPacket) -- if the response-validation
                                     #   gate lives here: add an `out` ajv check at the top of storeBrainSuggestions; on fail return
                                     #   { ok:false, reason:'response_schema_invalid' } AFTER logging brain_response_rejected; do NOT
                                     #   open the BEGIN/COMMIT transaction. (Recommended: keep the gate in brain-client.sendPacket so
                                     #   ingestion.cjs stays a pure DB-write module.)

lib/core/navigation/memory-events.cjs # EXTEND -- 3 new strings in the frozen EVENT_TYPES Set:
                                      #   'brain_packet_rejected', 'brain_response_rejected', 'brain_legacy_path_used'.

lib/memory/run-feynman-tests.cjs     # EXTEND -- append the new test paths to TEST_FILES[].

tests/
├── run-all-110.sh                  # NEW -- mirror tests/run-all-122.sh
├── test-brain-packet-schema-check.cjs           # NEW -- the --check tripwire test (child_process)
├── test-brain-packet-precommit-hook.cjs         # NEW -- the D-08 layer-2 hook test (child_process; mirror test-navigation-chokepoint-hook.cjs)
├── test-brain-packet-validation-per-job.cjs     # NEW -- D-11(a)(b)(c): 12 jobs x {valid in, malformed in, off-spec out, bad origin}
└── test-brain-packet-part8-invariant-per-job.cjs # NEW -- D-11(d): 12 jobs x forbidden-substring sweep over JSON.stringify(buildBrainPacket(...))
```

### Pattern 1: Compile the schema once, validate per job (ajv 8.x)

**What:** ajv compiles a schema to a JS function and caches it (keyed by the schema object). Compile the root `data/brain-packet-schema.json` once at module scope in `brain-client.cjs`; the root schema's `$defs` are reachable via `$ref` *within* the compiled root, and individual `$def` sub-schemas can be retrieved by `$id` if you give each a `$id` -- but the simplest pattern (verified working on ajv 8.18.0) is:

```javascript
// Source: ajv 8.x API (ajv.js.org/api.html) + verified locally against ajv@8.18.0 on disk.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const Ajv = require('ajv').default || require('ajv'); // ajv@8.18 exports a function that also has .default
// (avoid `format` keywords in the schema -> no need for require('ajv-formats') + addFormats)

let _ajv = null;
let _rootValidator = null;
const _jobValidators = new Map(); // job -> { in: fn, out: fn }

function _schema() {
  if (_rootValidator) return;
  const schemaPath = path.join(__dirname, '..', '..', 'data', 'brain-packet-schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  _ajv = new Ajv({
    allErrors: true,      // collect every error, not just the first (better error messages)
    strict: false,        // a hand-maintained schema may have benign constructs ajv strict-mode would throw on at compile time
    // strictSchema: false / strictTypes: false are implied by strict:false; don't set removeAdditional (we want to REJECT extras, not strip them)
  });
  _ajv.addSchema(schema); // registers it under its $id; sub-schemas reachable via getSchema('<$id>#/$defs/<job>/properties/in')
  _rootValidator = _ajv.compile(schema);
}

function _validatorFor(job, half /* 'in' | 'out' */) {
  _schema();
  let pair = _jobValidators.get(job);
  if (!pair) { pair = {}; _jobValidators.set(job, pair); }
  if (!pair[half]) {
    // Two equivalent options; (b) is the one I verified:
    //   (a) pair[half] = _ajv.getSchema(SCHEMA_ID + '#/$defs/' + job + '/properties/' + half);
    //   (b) compile a tiny wrapper that $refs into the registered root:
    pair[half] = _ajv.compile({ $ref: SCHEMA_ID + '#/$defs/' + job + '/properties/' + half });
  }
  return pair[half];
}
```

**Verified locally** (`ajv@8.18.0`):
- `new Ajv({ allErrors: true, strict: false })` constructs fine.
- A root schema with `"$defs": { "X": { "type":"string" } }` and a property `{ "$ref": "#/$defs/X" }` compiled in one `compile()` call; `validate({a:'hi'})` -> `true`; `validate({a:1, b:2})` -> `false` with `errors` = `[{ keyword:'additionalProperties', instancePath:'', schemaPath:'#/additionalProperties', params:{ additionalProperty:'b' }, message:'must NOT have additional properties' }, { keyword:'type', instancePath:'/a', schemaPath:'#/$defs/X/type', params:{ type:'string' }, message:'must be string' }]`.

**Error object shape** (ajv 8.x `ErrorObject`, on `validate.errors` / `ajv.errors` after a failing `validate()`):
```typescript
interface ErrorObject {
  keyword: string;       // e.g. 'additionalProperties', 'type', 'const', 'enum', 'required'
  instancePath: string;  // JSON Pointer into the DATA, e.g. '/local_graph_summary/banked_opportunities/count'
  schemaPath: string;    // JSON Pointer into the SCHEMA, e.g. '#/$defs/select_methodology/properties/in/required'
  params: object;        // keyword-specific: { additionalProperty } for additionalProperties; { type } for type;
                         //   { allowedValue } for const; { allowedValues } for enum; { missingProperty } for required
  message?: string;      // human-readable, e.g. 'must NOT have additional properties'
  schema?: any;          // the failing keyword's value
  parentSchema?: object; // the containing schema
  data?: any;            // the data that failed
}
```
**Important ajv gotcha:** `validate.errors` (and `ajv.errors`) is **overwritten on every `validate()` call** -- if you validate two packets, snapshot `validate.errors` immediately after the first before calling `validate()` again. (Documented at ajv.js.org/guide/getting-started.html: "Every time a validation function (or `ajv.validate`) is called the `errors` property is overwritten.")

For the `sendPacket()` error message, format the errors compactly:
```javascript
const fn = _validatorFor(packet.job, 'in');
if (!fn(packet)) {
  const errs = (fn.errors || []).map(e => e.instancePath + ' ' + e.message).join('; ');
  // log brain_packet_rejected via navigation.cjs, then:
  throw new Error('brain packet rejected for job "' + packet.job + '": ' + errs);
}
```

**`additionalProperties: false` semantics:** rejects any data property not named in `properties` (or matched by `patternProperties`). This is the core "structurally hard to leak" mechanism -- a packet that carries an extra `transcript` or `body` field is *refused at the wire*, not stripped-and-sent. Put `additionalProperties: false` on **every** object node in the schema (root, `local_graph_summary`, `banked_opportunities`, each `active_context`, each job's `in` and `out`). Do NOT use `removeAdditional` in the Ajv constructor -- that would silently strip extras, which is exactly the wrong behavior (D-07: "never partial-ingest, no strip-extra-and-keep-the-rest").

**`strict` mode:** `strict: false` (or per-flag `strictSchema: false`, `strictTypes: false`, `strictTuples: false`) turns strict-mode *throws-at-compile* into no-ops. A hand-maintained JSON Schema (D-06) can easily contain something ajv strict-mode objects to (an unknown keyword left as a comment, a `type` omitted on a schema that has `properties`, etc.) -- with `strict: false` the schema compiles and validates anyway. RESEARCH recommendation: ship with `strict: false` for runtime robustness, but have `scripts/build-brain-packet-schema.cjs --check` compile the schema with `strict: true` (or `strict: 'log'`) so the *build* surfaces strict-mode warnings (a cleanliness gate that doesn't break runtime).

### Pattern 2: The `--check` tripwire script (mirror Phase 122)

`scripts/build-command-registry.cjs` is the verbatim template. The Phase 110 script is *simpler* because the schema is hand-maintained (not generated from frontmatter), so there's no "regenerate and byte-compare" -- instead `--check` runs **structural assertions** on the hand-written file:

```javascript
// scripts/build-brain-packet-schema.cjs (sketch -- mirror build-command-registry.cjs structure)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'brain-packet-schema.json');

// The closed D-02 vocabulary -- the single source of truth for "which jobs exist".
const SHIPPED_JOBS = Object.freeze([
  'select_methodology','suggest_next_move','detect_contradiction','summarize_neighborhood',
  'classify_room_budding','rank_assumptions','generate_feynman_explanation','strengthen_minto',
  'prepare_investor_brief','opportunity_react','opportunity_reflect','opportunity_rank',
]);

function checkSchema(strictBuild /* boolean */) {
  const errs = [];
  let schema;
  try { schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')); }
  catch (e) { return ['data/brain-packet-schema.json is missing or not valid JSON: ' + e.message]; }
  // 1. ajv must compile it.
  try {
    const Ajv = require('ajv').default || require('ajv');
    new Ajv({ allErrors: true, strict: strictBuild ? true : false }).compile(schema);
  } catch (e) { errs.push('schema does not compile under ajv: ' + e.message); }
  const defs = (schema && schema.$defs) || {};
  // 2. every shipped job has an `in` and an `out` $def.
  for (const job of SHIPPED_JOBS) {
    if (!defs[job]) { errs.push('missing $def for shipped job: ' + job); continue; }
    if (!defs[job].in)  errs.push('$def "' + job + '" has no "in" sub-schema');
    if (!defs[job].out) errs.push('$def "' + job + '" has no "out" sub-schema');
    // 3a. each job's in.properties.job must be `const: <jobname>` (defensive).
    const jc = defs[job].in && defs[job].in.properties && defs[job].in.properties.job;
    if (!jc || jc.const !== job) errs.push('$def "' + job + '" in.properties.job must be { const: "' + job + '" }');
  }
  // 3b. no $def names a job outside the closed vocabulary (ignore the shared non-job $defs by name allow-list).
  const SHARED_DEFS = new Set(['PrivacyMode','Origin','BankedOpportunities','LocalGraphSummary','ActiveContext','FocusNode' /* etc */]);
  for (const name of Object.keys(defs)) {
    if (SHIPPED_JOBS.includes(name)) continue;
    if (SHARED_DEFS.has(name)) continue;
    errs.push('$def "' + name + '" is neither a D-02 job nor a known shared def -- closed vocabulary violation');
  }
  return errs;
}

function main() {
  const argv = process.argv.slice(2);
  const isCheck = argv.includes('--check');
  const errs = checkSchema(/* strictBuild */ true); // build always uses strict to surface schema-cleanliness warnings
  if (errs.length) {
    console.error(errs.join('\n'));
    console.error('Recovery: fix data/brain-packet-schema.json (the hand-maintained source of truth), then re-run: node scripts/build-brain-packet-schema.cjs --check');
    process.exit(1);
  }
  console.log(isCheck ? 'brain-packet-schema: OK' : 'brain-packet-schema: OK (validated; nothing to regenerate -- the schema is hand-maintained)');
}
if (require.main === module) main(); else module.exports = { checkSchema, SHIPPED_JOBS };
```

Wire it into `scripts/hooks/pre-commit-room-minto-guard.sh` (and the byte-identical `scripts/hooks/pre-commit` + `.git/hooks/pre-commit`) right after the command-registry block:

```bash
# ---------------------------------------------------------------------------
# Phase 110 guardian: brain-packet-schema drift / malformed-schema tripwire.
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(data/brain-packet-schema\.json|scripts/build-brain-packet-schema\.cjs)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-brain-packet-schema.cjs" ]; then
    node "$REPO_ROOT/scripts/build-brain-packet-schema.cjs" --check || { echo "brain-packet-schema drift -- run: node scripts/build-brain-packet-schema.cjs --check" >&2; exit 2; }
  fi
fi
# D-08 layer 2: refuse a new bare sendPacket( not preceded by buildBrainPacket(.
if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-schema-aliases.cjs" ]; then
  node "$REPO_ROOT/scripts/check-schema-aliases.cjs" --check-sendpacket || { echo "bare sendPacket( introduced -- per D-08 it must be lexically preceded by buildBrainPacket(" >&2; exit 2; }
fi
```

### Anti-Patterns to Avoid

- **Adding `ajv` to `package.json` dependencies.** Forbidden by CLAUDE.md. It's transitive via the MCP SDK. The `require('ajv')` call resolves; that's the contract.
- **Using `removeAdditional` in the Ajv constructor.** That strips unknown properties silently. D-07 requires reject-hard-no-partial. Use `additionalProperties: false` in the schema and let validation *fail*.
- **Wiring any of the 12 shipped jobs to `allow_excerpts`.** D-09: it's a defined-but-unconsumed escape hatch. Every shipped `$def.in` should carry `"privacy_mode": { "const": "local_summary_only" }`.
- **Building the packet anywhere except `buildBrainPacket`.** D-01. The D-08 hook (layer 2) is the structural enforcement; the planner must not create a second packet-builder.
- **Throwing on a bad Brain response.** D-07: "never throw on a bad response." Bad `out` -> log `brain_response_rejected`, return a no-advice sentinel, the turn continues. Only a bad `in` (a packet we're about to send) throws -- because that's a programmer error in OUR code.
- **Partial-ingesting a response.** D-07: no strip-extra-and-keep-the-rest. A half-trusted response is no response.
- **Migrating `query()` / `write()` / `search()` / `schema()`.** They're not "legacy." Touching them is out-of-scope-by-design (CONTEXT deferred block).
- **Editing only `scripts/hooks/pre-commit-room-minto-guard.sh` and forgetting `.git/hooks/pre-commit`.** They're byte-identical today (and `scripts/hooks/pre-commit` too). Either edit all three, or edit the source and re-run `scripts/setup-hooks.sh` (which `cmp -s` + byte-copies). The Phase-110 test for the hook (`tests/test-brain-packet-precommit-hook.cjs`) should invoke `scripts/hooks/pre-commit-room-minto-guard.sh` (or the relevant subcommand directly) so it tests the *source*, not the installed copy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-job packet/response shape validation | A pile of `if (typeof packet.foo !== 'string') throw` per job (the Phase 90 5-tripwire style) | `ajv@8.18.0` + `data/brain-packet-schema.json` (D-05) | The machine-readable contract IS the deliverable. Hand-rolled validators rot, drift from the schema, and don't give you `additionalProperties: false` for free (the key "can't leak an extra field" property). |
| "Did this packet really come from `buildBrainPacket`?" | An in-process nonce / call-stack inspection / module-identity check | The D-08 three-layer scheme: schema enum + pre-commit hook + brain-client allowlist | D-08 locked it. The hook is the real teeth; the string is in-process-forgeable but the hook + review catch it. Canon Part 8 is defense-in-depth, not a cipher. |
| Generated-artifact drift detection | A bespoke CI check | The Phase 122 `--check` + pre-commit-block pattern | It's already in the repo, already wired, already understood. Mirror it. |
| Forbidden-substring leak tests | Eyeballing the packet | The Phase 109 `test-navigation-packet-part8-leak.cjs` grep-sweep idiom + the Phase 90 `brain-derivation.test.cjs` Test-13/14 capture-and-assert idiom | Adversarial: seed `SECRET RAW BODY` / `leak@example.com` / `/home/jsagi/secret/` / a 800-char transcript into node properties, build the packet, assert `JSON.stringify(packet)` matches none of them. |
| Once-per-session warning rate-limiting | A timestamp file / session-state key lookup | A module-level `let _legacyPathWarned = false;` boolean in `brain-client.cjs` | The file already does this exact thing for the Windows perm-check warning (`checkFilePermissions._warned` at line 114). "Session" = "process lifetime" for the CLI; a module-level flag is correct and zero-IO. |

**Key insight:** Phase 110 builds almost no new mechanism -- it *composes* three existing mechanisms (Phase 122 generated-checked tooling, Phase 109 chokepoint+hook, Phase 90 + Phase 109 leak-test idioms) onto one new file (`data/brain-packet-schema.json`) and one new function (`sendPacket()`). The only genuinely-undecided piece is the Brain *wire envelope* (Open Question 1), and even that has a graceful-degradation-safe default.

---

## Implementation Approach

Numbered, concrete. The planner turns these into tasks.

1. **`data/brain-packet-schema.json` -- the schema itself.** draft 2020-12. Top-level: `$schema`, `$id` (`https://mindrian-os.com/schemas/brain-packet/1.0`), `$defs`. Shared `$defs`: `PrivacyMode` (enum of D-03's 3), `Origin` (enum `["navigation_api","test_fixture"]`), `FocusNode`, `ActiveContext`, `BankedOpportunities` (object: `count` integer >= 0, `items` array `maxItems: 3` of `{ id_hash: string (12-hex), tags: array of strings maxLength 30, hsi_band: enum ["high","medium","low"], composite_score: number }`), `LocalGraphSummary` (object with `nearest_claims`, `nearest_assumptions`, `contradictions`, `unsupported_claims`, `recent_changes`, and `banked_opportunities: { "$ref": "#/$defs/BankedOpportunities" }`), and per-projection sub-shapes matching `packet.cjs`'s `safeNodeProjection` / `safeContradictionProjection` / `safeUnsupportedProjection` / `safeRecentChangeProjection` outputs. Per-job `$defs` (12 of them, names = D-02 vocabulary), each `{ "in": {...}, "out": {...} }`. `in` requires `["packet_version","job","room_stage","origin","privacy_mode","active_context","local_graph_summary","constraints"]` (matching `buildBrainPacket`'s return shape + the new `origin`), with `packet_version: { "const": "1.0" }`, `job: { "const": "<jobname>" }`, `origin: { "$ref": "#/$defs/Origin" }`, `privacy_mode: { "const": "local_summary_only" }`, `local_graph_summary: { "$ref": "#/$defs/LocalGraphSummary" }`, `additionalProperties: false`. `out` shape per job: at minimum `{ job_id?: string, suggestions: array of { suggestion_index?, summary?, methodology?, body?, confidence?, graph_updates_proposed?: array of { source, target, type, confidence? } } }` (matching `ingestion.cjs`'s `storeBrainSuggestions` reader) -- with `additionalProperties: false` at every level. Per-job `out` may tighten (e.g. `classify_room_budding`'s `out` might require a `bud_decision` enum), but the planner can ship a uniform `out` shape for v1.0 and tighten later. **`additionalProperties: false` everywhere** -- this is the leak-prevention teeth. Also: **update `data/ROOM.md`** -- add a row to the "Files in this section" table for `brain-packet-schema.json` (generated-checked, not generated-from; the `--check` script + Feynman runner reject a malformed schema; bound to Phase 110; canon parts 8 + 9).

2. **Authoring style (Claude's-discretion resolution): one root schema with `$defs` + `$ref`, NOT separate files.** ajv 8.18 resolves `$ref: "#/$defs/X"` within a single compiled schema (verified). One file = one source of truth = the `--check` script has one thing to validate = the pre-commit block has one path to watch. Factor `LocalGraphSummary` and `BankedOpportunities` as shared `$defs` and `$ref` them from every job's `in` (they're identical across all 12 jobs -- `buildBrainPacket` builds the same `local_graph_summary` regardless of job; only `job` and the `out` shape differ). Give each job `$def` its own `$id` only if you want to `getSchema('<$id>')` it directly -- otherwise the `{ $ref: SCHEMA_ID + '#/$defs/' + job + '/properties/in' }` wrapper-compile pattern (Pattern 1) works without per-def `$id`s.

3. **`scripts/build-brain-packet-schema.cjs --check`** -- per Pattern 2 above. Default run = validate well-formedness + every D-02 job has `in`+`out` + `job` const matches + no unknown-job `$def`; `--check` = same, exit 1 on any failure with a one-line recovery command. Build always uses ajv `strict: true` (surfaces schema-cleanliness warnings); runtime uses `strict: false` (robustness). No `--refresh-names` analog (the schema is hand-maintained). Register the script's `--check` invocation in: (a) `scripts/hooks/pre-commit-room-minto-guard.sh` (+ the byte-identical siblings) keyed on the schema/script paths; (b) `lib/memory/run-feynman-tests.cjs` is for *tests* not scripts -- the `--check` gets tested by `tests/test-brain-packet-schema-check.cjs` which is what goes in `TEST_FILES[]`.

4. **`brain-client.sendPacket(packet, opts)` + the ajv validator middleware** -- a **brand-new function** (not a `callTool()` branch). Sketch:
   - Module scope: lazy `_schema()` + `_validatorFor(job, half)` per Pattern 1; `let _legacyPathWarned = false;`.
   - `sendPacket(packet, opts)`:
     1. **D-08 layer 3 (runs first):** if `!packet || typeof packet.origin !== 'string'` -> throw. If `packet.origin === 'test_fixture'` and `process.env.MINDRIAN_TEST_MODE !== '1'` -> throw `'origin "test_fixture" only valid when MINDRIAN_TEST_MODE=1'`. If `packet.origin !== 'navigation_api' && packet.origin !== 'test_fixture'` -> throw. (This catches a caller who bypassed ajv.)
     2. **`in` validation:** `const fn = _validatorFor(packet.job, 'in'); if (!fn) throw 'unknown job: ' + packet.job; if (!fn(packet)) { logEvent('brain_packet_rejected', { job: packet.job, errors: <count>, source_path:'system:brain-packet' }); throw new Error('brain packet rejected for job "'+packet.job+'": '+formatErrs(fn.errors)); }`. (Log via `navigation.cjs`'s re-exported `logEvent`-equivalent -- note `logEvent` itself is internal to `navigation/memory-events.cjs` and not in the closed 13-function surface; `brain-client.cjs` may need to `require('./navigation/memory-events.cjs')` directly OR `navigation.cjs` adds a thin `logMemoryEvent` export. RESEARCH recommendation: `navigation.cjs` re-exports a `logMemoryEvent(db, eventType, payload)` -- a 14th export is fine; Phase 109's own header says the closed surface is the *documented* 13-function API and the implementation module re-exports internal helpers as needed. Flag this for the planner.)
     3. **Build the wire envelope + POST:** see Open Question 1. The CONTEXT doesn't specify the envelope. RESEARCH recommendation for v1.13.0-beta.3: POST a `tools/call` with `name: 'brain_packet'`, `arguments: { packet }` to `${BRAIN_URL}/mcp` (the same JSON-RPC-over-Streamable-HTTP path `callTool()` already uses; reuse `_ensureSession()`/`getApiKey()`/the SSE-parse). If the Brain returns an "unknown tool" / -32602 / a 404-ish error -> treat as "Brain doesn't recognize the packet contract this turn" -> log nothing (it's not a leak), return the no-advice sentinel. This is the D-04 "Brain doesn't recognize `packet_version` -> reject -> degrade gracefully" behavior generalized to "Brain doesn't have the `brain_packet` tool yet."
     4. **`out` validation:** parse the Brain result; `const ofn = _validatorFor(packet.job, 'out'); if (!ofn(parsed)) { logEvent('brain_response_rejected', { job: packet.job, errors:<count>, source_path:'system:brain-packet' }); return { advice: null, reason: 'response_schema_invalid' }; }` -- **never throw**, **never partial-ingest**.
     5. Return the validated `out` (the caller -- typically code that then calls `storeBrainSuggestions` -- gets a known-good shape).
   - Export `sendPacket`; add `{ _legacyPathWarned setter, _schema, _validatorFor }` to the `_test` block for tests.

5. **The response-validation-then-degrade gate (D-07 `out` half) -- where it lives.** Two options; RESEARCH recommends **inside `brain-client.sendPacket`** (step 4d above), so `ingestion.cjs` stays a pure DB-write module. If the planner prefers the gate in `ingestion.cjs` instead: add an ajv `out` check at the very top of `storeBrainSuggestions(db, packetResult, sessionId)`, before the `BEGIN` -- on fail, log `brain_response_rejected` and `return { ok:false, reason:'response_schema_invalid' }`. Either way: `storeBrainSuggestions`'s existing behavior (each suggestion -> `brain_insight` node, `created_by:'brain'`, `review_status:'proposed'`, `confirmed_by NULL`, `source_path` starting `brain:job:`; one `brain_suggestion_received` event per call; BEGIN/COMMIT/ROLLBACK; Phase 108 invariant SQL = 0 rows) is **unchanged** -- Phase 110 only adds a gate in front of it.

6. **`origin` in `packet.cjs` + the EVENT_TYPES extension.**
   - `lib/core/navigation/packet.cjs` `buildBrainPacket` return object: add `origin: 'navigation_api',` next to `packet_version: '1.0',` (one line). The schema's `$defs.*.properties.in.required` includes `"origin"`. Regression-touch `tests/test-navigation-packet-builder.cjs` (assert `packet.origin === 'navigation_api'`) and `tests/test-navigation-packet-part8-leak.cjs` (the new field doesn't change the leak assertions but the test's shape-checks may enumerate top-level keys).
   - `lib/core/navigation/memory-events.cjs`: add `'brain_packet_rejected'`, `'brain_response_rejected'`, `'brain_legacy_path_used'` to the frozen `EVENT_TYPES` Set (3 new -> the Set grows from 31 to 34). This is purely additive, exactly like Phase 116-00's 5 tension strings and Phase 117-00's 6 auto-explore strings (the file already has a "set size invariant" comment pattern -- add `// Phase 110 Wave 0 extension (Brain Context Packet Contract; D-07 + D-10 telemetry mirror; set size 31 -> 34)`). Regression-touch `tests/test-navigation-memory-events.cjs` (the closed-enum size assertion).
   - **Decide the `logEvent`-from-`brain-client.cjs` access path** (see step 4d): RESEARCH recommends `navigation.cjs` re-exports `logMemoryEvent` (a 14th export -- acceptable per the Phase 109 header) so `brain-client.cjs` can `require('./navigation.cjs').logMemoryEvent(db, ...)`. The DB handle: `brain-client.cjs` currently has none -- `sendPacket` will need a `db` (or `roomDir`) passed in `opts`, OR the memory_event gets logged by the *caller* (the navigation-layer code that called `sendPacket`) on a thrown/rejected result. RESEARCH recommendation: pass `opts.db` (or `opts.roomDir`) into `sendPacket`; if absent, skip the event log gracefully (Brain calls are best-effort; a missing room handle shouldn't crash). Flag this for the planner -- it's the one slightly-awkward seam.

7. **Dual-path + once-per-session deprecation warning.** A module-level `let _legacyPathWarned = false;` in `brain-client.cjs`. A helper `function _warnLegacyOnce(db) { if (_legacyPathWarned) return; _legacyPathWarned = true; console.warn('[mindrian-os] legacy free-form Brain job call detected. Migrate to brain-client.sendPacket() -- the legacy job path is removed in v1.14.0.'); try { require('./navigation.cjs').logMemoryEvent(db, 'brain_legacy_path_used', { source_path:'system:brain-legacy' }); } catch (_) {} }`. **Where it's called:** see Open Question 5 -- there is **no existing legacy job-style Brain call site today** (every caller uses `query()`/`search()`/`schema()`/`write()`/`callTool()` for raw Cypher / NL / writes, which D-10 explicitly says are NOT "legacy"). RESEARCH recommendation: ship the helper + the `brain_legacy_path_used` event type + a documented comment in `brain-client.cjs` ("`_warnLegacyOnce` is the deprecation guard for any free-form Brain *job* call. As of v1.13.0-beta.3 there is no such call site -- new job-style work goes through `sendPacket()`. If a free-form job helper is ever added before v1.14.0, it must call `_warnLegacyOnce()` first; in v1.14.0 both the helper and this guard are deleted.") The D-11 dual-path-warning test then asserts: calling `_warnLegacyOnce` twice -> `console.warn` fires once, `brain_legacy_path_used` logged once.

8. **Privacy-mode opt-up wiring (D-09).** A helper -- RESEARCH suggests it lives in `packet.cjs` (near `buildBrainPacket`) since the privacy mode is a property of the *packet*, not the wire: `function resolvePrivacyMode(roomDir, opts) { const perCall = opts && opts.privacyMode; const fromConfig = readRoomConfigPrivacyMode(roomDir); const requested = perCall || fromConfig || 'local_summary_only'; if (!['local_summary_only','allow_filenames','allow_excerpts'].includes(requested)) return 'local_summary_only'; if (requested === 'allow_excerpts' && !roomHasExcerptApproval(roomDir)) { /* the Part-3 Decision Gate hasn't been APPROVEd for this room -> cap to allow_filenames (or local_summary_only) */ return readRoomConfigPrivacyMode(roomDir) === 'allow_filenames' ? 'allow_filenames' : 'local_summary_only'; } return requested; }`. `readRoomConfigPrivacyMode` reads `path.join(roomDir, '.config.json')` (note the leading dot -- this is the established room-config path; see `lib/core/model-profiles.cjs:69` `path.join(roomDir, '.config.json')` and `lib/core/scheduled-scanner.cjs:129`) and returns `preferences.brain_privacy_mode` if present. `roomHasExcerptApproval` checks the local graph (via `navigation.cjs`) for an `APPROVE`/`APPROVED_BECAUSE`-style edge on the room node with a `brain_excerpts` decision tag -- written by the Part-3 Decision Gate flow when the user picks APPROVE on the "excerpts of your room content will reach the Brain" selector (rendered via the existing `lib/hmi/shape-f0-renderer.cjs` F.0 primitive). **Critically (D-09 last bullet):** the schema validates the *narrower* of {resolved mode, the job's declared mode}. Since **no shipped job declares above `local_summary_only`**, every shipped `$def.in.properties.privacy_mode` is `{ "const": "local_summary_only" }` -- so a packet whose resolved mode is `allow_filenames` for a job that only allows `local_summary_only` *fails ajv validation* (the `const` doesn't match). That's the "config can only cap, never raise" enforcement, for free, via the schema. The planner should make sure `buildBrainPacket` sets `packet.privacy_mode = resolvePrivacyMode(...)` (currently `packet.cjs` sets `constraints.privacy = 'no_raw_artifact_text'` -- the planner decides whether `privacy_mode` is a new top-level field or replaces `constraints.privacy`; RESEARCH recommends a new top-level `privacy_mode` field carrying one of D-03's 3 enum values, and keeping `constraints.privacy` as-is for backward compat or renaming it -- flag for the planner).

9. **Tests + runner + registration** -- see `## Validation Architecture` and `## Phase Requirements -> Test Map` below.

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` -- this section is required, and `gsd-planner` copies it into `110-VALIDATION.md`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in: `node:assert` / `node:assert/strict` + `node:child_process` (`spawnSync`). NO jest/mocha/vitest/zod. CJS. (Per CLAUDE.md "What NOT to Use".) |
| Config file | none (no test-runner config -- the convention is plain `*.test.cjs` / `tests/test-*.cjs` files run by `node <file>`, aggregated by `lib/memory/run-feynman-tests.cjs`) |
| Quick run command | `node tests/test-brain-packet-validation-per-job.cjs` (the fastest single suite -- pure ajv, no child processes) |
| Full suite command | `bash tests/run-all-110.sh` (scoped) and/or `node lib/memory/run-feynman-tests.cjs` (the whole repo's Feynman suite, which the new 110 files are registered into) |
| Wave-0 substrate plan | YES -- mirror `109-00-PLAN.md`: register PACKET-110-01..09 in REQUIREMENTS.md, create the 4 new test stubs (RED until their owning plan lands), write `tests/run-all-110.sh`, add the 4 paths to `TEST_FILES[]` in `run-feynman-tests.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACKET-110-01 | `data/brain-packet-schema.json` ships, compiles under ajv, has all 12 job `$defs` with `in`+`out`, `additionalProperties:false` everywhere, `origin` enum, `privacy_mode` enum | structural / unit | `node tests/test-brain-packet-schema-check.cjs` (also covers PACKET-110-02) | NO -- Wave 0 |
| PACKET-110-02 | `scripts/build-brain-packet-schema.cjs --check` exits 0 on the good schema; exits non-zero on (a) malformed JSON (b) a job with no `in`/`out` (c) a `$def` naming a non-D-02 job; prints a recovery line on stderr | unit (child_process) | `node tests/test-brain-packet-schema-check.cjs` | NO -- Wave 0 |
| PACKET-110-03 | `brain-client.sendPacket(packet)`: valid `in` packet -> sends (mocked); malformed `in` -> throws naming the job + logs `brain_packet_rejected`; `origin` not in allowlist (in prod env) -> throws; `origin:'test_fixture'` without `MINDRIAN_TEST_MODE=1` -> throws | unit (require.cache mock of the wire POST) | `node tests/test-brain-packet-validation-per-job.cjs` (the `in` + `origin` cases, 12 jobs) | NO -- Wave 0 |
| PACKET-110-04 | off-spec Brain `out` -> NOT ingested, `brain_response_rejected` logged, no partial ingest, `storeBrainSuggestions` not entered (or entered and returns `{ok:false}`); a bad response NEVER throws; valid `out` -> ingests normally (review_status proposed) | unit (require.cache mock returning a bad/good `out`) | `node tests/test-brain-packet-validation-per-job.cjs` (the `out` cases, 12 jobs) | NO -- Wave 0 |
| PACKET-110-05 | `buildBrainPacket(...)` returns `origin === 'navigation_api'`; the produced packet validates against `$defs[job].in` for every job (round-trip: build -> validate -> pass) | unit | `node tests/test-brain-packet-part8-invariant-per-job.cjs` (also asserts the round-trip) + regression touch in `tests/test-navigation-packet-builder.cjs` | partial -- `test-navigation-packet-builder.cjs` exists; the 110 file is Wave 0 |
| PACKET-110-06 | `EVENT_TYPES` Set contains the 3 new strings; `logEvent` accepts them; the closed-enum size assertion in `test-navigation-memory-events.cjs` updated to 34 | unit | `node tests/test-navigation-memory-events.cjs` (regression touch) | YES -- exists; touch only |
| PACKET-110-07 | privacy-mode resolution: per-call beats `.config.json` `preferences.brain_privacy_mode` beats default `local_summary_only`; `allow_excerpts` without a room APPROVE edge caps down; a packet whose resolved mode exceeds the job's declared `const` fails ajv (the "config caps, never raises" property) | unit | `node tests/test-brain-packet-validation-per-job.cjs` (a privacy-mode sub-block) | NO -- Wave 0 |
| PACKET-110-08 | `_warnLegacyOnce()` called twice -> `console.warn` fires exactly once; `brain_legacy_path_used` logged exactly once (per session/process) | unit (capture `console.warn`) | `node tests/test-brain-packet-validation-per-job.cjs` (a dual-path sub-block) | NO -- Wave 0 |
| PACKET-110-09 (D-11(d)) | per shipped job: `JSON.stringify(buildBrainPacket(db, job, focusNodeId, ...))` contains no seeded forbidden substring (`SECRET RAW BODY`, `leak@example.com`, `/home/jsagi/secret/`, an 800-char transcript, a `${...}` injection); mirrors `test-navigation-packet-part8-leak.cjs` but loops all 12 jobs | unit (adversarial fixture) | `node tests/test-brain-packet-part8-invariant-per-job.cjs` | NO -- Wave 0 |
| PACKET-110-09 (D-08 layer 2) | `scripts/check-schema-aliases.cjs --check-sendpacket` (or the sibling script) on a staged fixture diff that introduces a bare `sendPacket(` not preceded by `buildBrainPacket(` -> exit non-zero with a D-08 message; on a diff where `sendPacket(` IS preceded by `buildBrainPacket(` -> exit 0 | unit (child_process; mirror `test-navigation-chokepoint-hook.cjs`'s `MINDRIAN_HOOK_STAGED_FILES` / `MINDRIAN_HOOK_STAGED_CONTENT_DIR` env seams) | `node tests/test-brain-packet-precommit-hook.cjs` | NO -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/test-brain-packet-validation-per-job.cjs` (the cheap, broad one) -- and the relevant single suite for the task at hand.
- **Per wave merge:** `bash tests/run-all-110.sh` (all 4 new suites + the regression-touched existing ones).
- **Phase gate:** `node lib/memory/run-feynman-tests.cjs` green (the whole repo Feynman suite, with the 4 new 110 files registered) + `bash tests/run-all-110.sh` green, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/test-brain-packet-schema-check.cjs` — covers PACKET-110-01, PACKET-110-02 (child_process around `scripts/build-brain-packet-schema.cjs --check`)
- [ ] `tests/test-brain-packet-validation-per-job.cjs` — covers PACKET-110-03, -04, -07, -08 (12-job loop over `sendPacket` in/out + privacy + dual-path; `require.cache` mock of the wire POST)
- [ ] `tests/test-brain-packet-part8-invariant-per-job.cjs` — covers PACKET-110-05 (round-trip), PACKET-110-09 D-11(d) (adversarial forbidden-substring sweep; mirror `test-navigation-packet-part8-leak.cjs`)
- [ ] `tests/test-brain-packet-precommit-hook.cjs` — covers PACKET-110-09 D-08 layer 2 (child_process around the `--check-sendpacket` subcommand; mirror `test-navigation-chokepoint-hook.cjs`)
- [ ] `tests/run-all-110.sh` — scoped runner (mirror `tests/run-all-122.sh`); `CJS_SUITES` = the 4 above; header documents RED-by-design-until-owning-plan-lands
- [ ] Register the 4 new suites in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` (Phase 110 block)
- [ ] Register PACKET-110-01..09 in `.planning/REQUIREMENTS.md` (`## Brain Context Packet Contract (PACKET-110)` block + the traceability rows)
- [ ] Regression-touch (not new) `tests/test-navigation-packet-builder.cjs`, `tests/test-navigation-packet-part8-leak.cjs`, `tests/test-navigation-memory-events.cjs` for the `origin` field + the EVENT_TYPES size change
- Framework install: NONE -- ajv is already on disk; `node:assert` + `node:child_process` are built in.

---

## Common Pitfalls

### Pitfall 1: Treating `ajv.errors` / `validate.errors` as stable
**What goes wrong:** validate packet A, hold a reference to `validate.errors`, validate packet B, then read what you think are A's errors -- but it's B's (the property was overwritten).
**Why it happens:** ajv documents this explicitly ("Every time a validation function ... is called the `errors` property is overwritten") but it's easy to forget when looping all 12 jobs.
**How to avoid:** snapshot `(fn.errors || []).slice()` immediately after a failing `fn(data)` call, before the next `fn(...)`.
**Warning signs:** flaky test messages; the wrong job name in a `brain packet rejected for job "..."` error.

### Pitfall 2: ajv strict-mode throws at compile time on a hand-maintained schema
**What goes wrong:** `new Ajv()` (strict mode is on by default in ajv 8.x) `.compile(schema)` throws because the hand-written schema has a `type`-less object with `properties`, or an unknown keyword, or `additionalItems` without `items`.
**Why it happens:** D-06 says the schema is hand-maintained; humans write schemas ajv strict-mode dislikes.
**How to avoid:** `new Ajv({ strict: false, allErrors: true })` for the *runtime* validator in `brain-client.cjs`; use `strict: true` (or `'log'`) only in `build-brain-packet-schema.cjs --check` so the build surfaces cleanliness warnings without breaking runtime.
**Warning signs:** `sendPacket` throws on the *first call ever* with a message about strict-mode, not about the packet.

### Pitfall 3: `additionalProperties: false` only on the root, not on nested objects
**What goes wrong:** the packet root rejects extra top-level fields, but `local_graph_summary.banked_opportunities.items[0]` could carry an extra `mirror_solution` field with a raw body and it slips through.
**Why it happens:** `additionalProperties: false` is per-object; forgetting it on a nested `$def` leaves a hole.
**How to avoid:** `additionalProperties: false` on **every** object node in the schema. The `--check` script could even assert this structurally (recurse the schema, fail if any `{ type:'object', properties:{...} }` lacks `additionalProperties: false`). RESEARCH recommendation: add that assertion to `--check`.
**Warning signs:** the adversarial leak test (`test-brain-packet-part8-invariant-per-job.cjs`) fails -- a seeded `SECRET MIRROR` reaches `JSON.stringify(packet)`.

### Pitfall 4: Editing `scripts/hooks/pre-commit-room-minto-guard.sh` but not `.git/hooks/pre-commit`
**What goes wrong:** the source hook gets the new Phase-110 block; the *installed* hook (which is what actually runs on commit) doesn't, because nobody re-ran `scripts/setup-hooks.sh`.
**Why it happens:** `scripts/hooks/pre-commit`, `scripts/hooks/pre-commit-room-minto-guard.sh`, and `.git/hooks/pre-commit` are three byte-identical 8588-byte copies right now; the installer (`setup-hooks.sh`) `cmp -s`-copies the *source* over the installed one.
**How to avoid:** edit the source (`scripts/hooks/pre-commit-room-minto-guard.sh` -- and keep `scripts/hooks/pre-commit` in sync, since they're identical today), then re-run `scripts/setup-hooks.sh`. The Phase-110 hook test should invoke the *source* file (or the `--check-sendpacket` subcommand directly), not `.git/hooks/pre-commit`, so it tests what's tracked.
**Warning signs:** the hook test passes but a real commit doesn't trip the guard (or vice versa).

### Pitfall 5: Assuming the Brain has a "job" tool
**What goes wrong:** `sendPacket` POSTs a `tools/call` with `name:'brain_packet'` and the live Brain returns "unknown tool" -- and the code treats that as a hard error / a leak / throws.
**Why it happens:** `mcp-server-brain/` today only has `brain_query` / `brain_write` / `brain_schema` / `brain_search` / `brain_stats` / `brain_ask`. There is no `brain_packet`.
**How to avoid:** treat "Brain doesn't recognize the packet contract" exactly like D-04's "Brain doesn't recognize `packet_version`" -- reject, degrade soft, no Brain advice this turn, no event log (it's not a leak). The Brain-side `brain_packet` tool is a separate, out-of-plugin-scope coordination item (D-10 deferred block).
**Warning signs:** every `sendPacket` call throws against the live Brain; or the plugin logs `brain_response_rejected` for every job (a missing tool isn't a bad response).

### Pitfall 6: Logging a `memory_event` from `brain-client.cjs` without a DB handle
**What goes wrong:** `brain-client.cjs` has no `db` today; `sendPacket` wants to log `brain_packet_rejected` via `navigation.cjs`'s `logEvent`, but `logEvent(db, ...)` needs a `db`.
**Why it happens:** the Phase 109 navigation API takes `db` everywhere; `brain-client.cjs` was written before it.
**How to avoid:** pass `opts.db` (or `opts.roomDir`, and open the db lazily) into `sendPacket`; if absent, skip the event log (Brain calls are best-effort -- a missing room handle must not crash a Brain call). Document this in `sendPacket`'s JSDoc.
**Warning signs:** `sendPacket` throws "db is undefined" in a context that doesn't have a room (a script, a test that forgot the handle).

---

## Code Examples

### Validating a packet against its job's `in` sub-schema (the core middleware move)
```javascript
// Source: ajv 8.x (ajv.js.org/api.html) + verified against ajv@8.18.0 on disk (node_modules/ajv/dist/ajv.js).
const Ajv = require('ajv').default || require('ajv');
const schema = require('../../data/brain-packet-schema.json'); // the hand-maintained source of truth
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(schema); // registers under schema.$id
const validateIn = ajv.compile({ $ref: schema.$id + '#/$defs/select_methodology/properties/in' });

const ok = validateIn(packet);
if (!ok) {
  const errs = (validateIn.errors || []).map(e => (e.instancePath || '(root)') + ' ' + e.message).join('; ');
  // -> "(root) must NOT have additional properties; /local_graph_summary/banked_opportunities/count must be >= 0"
  throw new Error('brain packet rejected for job "' + packet.job + '": ' + errs);
}
```

### The Phase 122 `--check` pre-commit block (the template to copy for Phase 110)
```bash
# Source: scripts/hooks/pre-commit-room-minto-guard.sh lines 143-147 (verbatim, in the repo today).
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|data/command-registry\.json|data/framework-names\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-command-registry.cjs" ]; then
    node "$REPO_ROOT/scripts/build-command-registry.cjs" --check || { echo "command-registry drift -- run: node scripts/build-command-registry.cjs" >&2; exit 2; }
  fi
fi
```

### The adversarial leak-test idiom (the template to copy for D-11(d))
```javascript
// Source: tests/test-navigation-packet-part8-leak.cjs (verbatim pattern, in the repo today).
const transcript = 'B'.repeat(800);
insN.run('decision:focus', 'decision', JSON.stringify({ summary: 'short', body: 'SECRET RAW DECISION BODY', transcript }), '/home/jsagi/secret/path/decision.md', ...);
// ... seed more forbidden content into node properties ...
const packet = navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
const serialized = JSON.stringify(packet);
ok(!/SECRET RAW DECISION BODY/.test(serialized), 'no decision body leak');
ok(!/\/home\/jsagi\//.test(serialized), 'no absolute path leak');
ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(serialized), 'no email leak');
ok(!serialized.split('"').some(s => s.length > 500), 'no transcript-length string leak');
// For Phase 110: loop this over all 12 D-02 jobs.
```

### Module-level once-per-process warning flag (the deprecation-warning idiom)
```javascript
// Source: lib/core/brain-client.cjs line 114 already does exactly this for the Windows perm-check warning.
let _legacyPathWarned = false;
function _warnLegacyOnce(db) {
  if (_legacyPathWarned) return;
  _legacyPathWarned = true;
  console.warn('[mindrian-os] legacy free-form Brain job call detected. Migrate to brain-client.sendPacket() -- the legacy job path is removed in v1.14.0.');
  try { require('./navigation.cjs').logMemoryEvent(db, 'brain_legacy_path_used', { source_path: 'system:brain-legacy' }); } catch (_) { /* best-effort */ }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canon Part 8 enforced by *procedural audit* (the Phase 90 5-tripwire grep sweeps, the brain-boundary-scan PR check, "violations are bugs") | Canon Part 8 enforced by a *machine-readable wire contract* (`data/brain-packet-schema.json` + ajv `additionalProperties:false` -- a packet that carries a forbidden field is refused at the wire, not after the fact) | Phase 110 (this phase) -- it's the explicit thesis (D-00) | Leaks become structurally hard, not just policy-forbidden. The audit layer stays (defense in depth); the wire layer is new. |
| Brain receives free-form Cypher (`brain_query`) / NL (`brain_ask`) for everything | Brain *job* calls receive typed packets (`sendPacket` -> `brain_packet` tool); raw-Cypher methodology lookups stay free-form forever (Part-8-clean by construction) | Phase 110 introduces the typed-packet path; the legacy/free-form path is deprecated for *jobs only* in v1.13.0, deleted in v1.14.0 -- BUT there are no job-style free-form callers today, so the "legacy path" is forward-looking (see Open Question 5) | The migration is mostly conceptual: new job-style work goes through `sendPacket`; nothing existing needs to move. |
| `ajv@8.17.x` | `ajv@8.18.0` on disk; `8.20.0` is the registry latest | the MCP SDK bump to `1.29.0` (`ajv: "^8.17.1"` -> resolved 8.18.0) | Negligible -- 8.17/8.18/8.20 are API-compatible for the keywords this phase uses (`$defs`, `$ref`, `const`, `enum`, `additionalProperties`, `required`, `type`, `minimum`, `maxItems`). Do NOT pin to the registry latest; ship against what's bundled. |

**Deprecated/outdated:**
- The 2026-05-03 Codex stub's `parent_release: v1.14.0` -- superseded by the Path-C re-route 2026-05-05 (Phase 110 promoted to v1.13.0-beta.3). The `110-CONTEXT.md` frontmatter already corrects this.
- The 2026-05-03 stub's 9-job vocabulary (`select_methodology`...`prepare_investor_brief`) -- superseded by D-02's 12 jobs (adds `opportunity_react` / `opportunity_reflect` / `opportunity_rank`). Use D-02's 12. (ROADMAP line 1047 still lists the stale 9 -- the planner should not use that list.)
- `data/command-registry.json` having `kind:'utility'` defaults etc. is irrelevant here -- the *only* thing Phase 110 mirrors from Phase 122 is the `--check` + pre-commit-block + Feynman-runner pattern, not the registry's content.

---

## Open Questions

1. **What does the Brain endpoint actually expect for a "job" call -- and is the wire change BREAKING?**
   - What we know: the Brain MCP server (`mcp-server-brain/server.cjs` + `lib/neo4j-tools.cjs` + `lib/pinecone-tools.cjs` + `lib/brain-ask.cjs`) exposes exactly these tools today: `brain_query` (read-only Cypher; expects `{ cypher, params? }`), `brain_write` (`{ cypher }`), `brain_schema` (`{}`), `brain_search` (`{ query, namespace?, topK? }`), `brain_stats` (`{}`), `brain_ask` (`{ question, topK? }`). There is **no `brain_packet` / `brain_job` tool** that accepts a typed Brain Context Packet. The plugin's `callTool(name, args)` POSTs `{ jsonrpc:'2.0', method:'tools/call', params:{ name, arguments } }` to `${BRAIN_URL}/mcp` over Streamable HTTP and parses the SSE `data:` line.
   - What's unclear: the CONTEXT (D-04, D-07) describes what the plugin sends/validates, not the wire envelope or the tool name; and Brain-side enforcement is explicitly out of plugin scope (deferred block). So `sendPacket` has nowhere to send a packet *as a packet* until the Brain repo adds a tool.
   - **Recommendation (disposition): NOT breaking in the plugin sense.** Ship `sendPacket` to POST `tools/call` with `name:'brain_packet'`, `arguments:{ packet }` (reusing `_ensureSession`/`getApiKey`/the SSE-parse). If the Brain returns "unknown tool" / -32602 / a 404-ish error, treat it exactly like D-04's "Brain doesn't recognize `packet_version`" -> reject, **degrade soft** (no Brain advice this turn, no event log -- it's not a leak). Confirm D-10's target band (v1.13.0-beta.3 for the typed-packet *contract*; the Brain-side `brain_packet` tool is a separate, deferred, out-of-plugin-scope item that can land later). The CONTEXT's D-10 assumption holds: the *plugin* side is non-breaking; the Brain side changes on its own timeline. **The planner should add an explicit task note: "the Brain-side `brain_packet` tool is NOT in this phase; `sendPacket` degrades gracefully when it's absent."**

2. **Where does `brain-client.sendPacket` get a `db` handle for logging `brain_packet_rejected` / `brain_response_rejected`?**
   - What we know: `logEvent(db, eventType, payload)` (in `navigation/memory-events.cjs`) needs a `db`; `brain-client.cjs` has none today.
   - **Recommendation:** pass `opts.db` (or `opts.roomDir`, opened lazily) into `sendPacket`; if absent, skip the event log gracefully. Add a `navigation.cjs` re-export `logMemoryEvent(db, type, payload)` (a 14th export -- acceptable; the Phase 109 navigation.cjs header explicitly says the closed surface is the *documented* 13-function API and the implementation re-exports internal helpers as needed). Flag this seam for the planner; it's the one slightly-awkward integration point.

3. **Any ajv 8.x gotcha?** (strict mode, `$ref` resolution, error format -- all verified)
   - **Disposition: resolved.** `new Ajv({ allErrors:true, strict:false })` for runtime; `strict:true` for the `--check` build. `$ref:'#/$defs/X'` resolves within one compiled root (verified on 8.18.0). `additionalProperties:false` -> `{ keyword:'additionalProperties', params:{ additionalProperty } }`. `const` mismatch -> `{ keyword:'const', params:{ allowedValue } }`. `enum` mismatch -> `{ keyword:'enum', params:{ allowedValues } }`. `required` -> `{ keyword:'required', params:{ missingProperty } }`. `validate.errors` is overwritten on every call (snapshot it). Use `require('ajv').default || require('ajv')` (8.18 exports a function that also has `.default`). Avoid `format` keywords -> no need for `ajv-formats`. Don't use `removeAdditional` (it strips, we want to reject).

4. **The installed pre-commit hook doesn't currently invoke `check-schema-aliases.cjs` at all -- so wiring the D-08 layer-2 check is a real task, not "just add a subcommand."**
   - What we know: `.git/hooks/pre-commit` (== `scripts/hooks/pre-commit` == `scripts/hooks/pre-commit-room-minto-guard.sh`, all 8588 bytes) invokes the ROOM.md/MINTO.md guard + `build-command-registry.cjs --check` + `feynman-minto-guardian.cjs` -- it does **NOT** call `check-schema-aliases.cjs` (Phase 108's `scripts/install-pre-commit.sh` was a *separate* installer that, per Phase 109's own RESEARCH, "does NOT change" -- but `setup-hooks.sh` overwrites the installed hook with the room-minto-guard source, so in practice the alias/chokepoint checks aren't running in this repo's installed hook). The Phase 109 `--check-chokepoint` subcommand exists in `check-schema-aliases.cjs` but isn't invoked by the installed hook.
   - **Recommendation:** the Phase 110 plan must (a) add the D-08 layer-2 subcommand (to `check-schema-aliases.cjs` per Canon Part 7 reuse, OR a sibling script), AND (b) **wire it into `scripts/hooks/pre-commit-room-minto-guard.sh`** (+ the byte-identical siblings) -- a new block, e.g. `node "$REPO_ROOT/scripts/check-schema-aliases.cjs" --check-sendpacket || exit 2` -- AND consider also wiring the existing `--check-chokepoint` + `--sql` checks while you're there (a Phase-110-adjacent cleanup; the planner decides whether that's in scope). The hook test (`tests/test-brain-packet-precommit-hook.cjs`) should test the subcommand directly via the `MINDRIAN_HOOK_STAGED_FILES`/`MINDRIAN_HOOK_STAGED_CONTENT_DIR` env seams that `check-schema-aliases.cjs` already supports (lines 341, 357).

5. **D-10's "legacy free-form Brain job calls" -- there is no such call site today. Confirm or challenge the dual-path framing.**
   - What we know: every current Brain caller (`brain-derivation.cjs`, `chain-recommender.cjs`, `rs-chain-feeder.cjs`, `rs-brain-substrate.cjs`, `brain-router.cjs`, `cross-room-memory.cjs`, `rs-*-command.cjs`, `build-command-registry.cjs`, `opportunity-ops.cjs`, etc.) uses `query()` (raw Cypher), `search()`, `schema()`, `write()`, or `callTool('brain_query'/'brain_search'/...)` -- all of which D-10 explicitly says are NOT "legacy" (they're Part-8-clean by construction and permanent). There is **no** free-form "job"-style Brain call (a call where the plugin says "Brain, do job X with this free-form context") anywhere in the repo.
   - **Recommendation (disposition): confirm D-10's contract, but document that the "legacy path" is forward-looking with no current call site.** Ship the `_warnLegacyOnce()` helper + the `brain_legacy_path_used` event type as the *contract*; document in `brain-client.cjs` that "as of v1.13.0-beta.3 there is no legacy free-form Brain job call site -- new job-style work goes through `sendPacket()`; if a free-form job helper is ever added before v1.14.0, it must call `_warnLegacyOnce()` first; in v1.14.0 both the helper and this guard are deleted." The D-11 dual-path-warning test exercises `_warnLegacyOnce()` directly (twice -> warns once). This is NOT a challenge to D-10 -- it just means "delete the legacy job path in v1.14.0" touches almost nothing (the helper + the event type), because there's almost nothing there. The planner should make this explicit in the plan so a future v1.14.0 phase isn't hunting for a phantom "legacy job path" in `brain-client.cjs`.

6. **`packet.privacy_mode`: new top-level field, or repurpose `constraints.privacy`?**
   - What we know: `packet.cjs` today sets `constraints: { privacy: 'no_raw_artifact_text', max_tokens: 1200 }`. D-03/D-09 want one of three enum values (`local_summary_only`/`allow_filenames`/`allow_excerpts`).
   - **Recommendation:** add a new top-level `privacy_mode` field (`{ "const": "local_summary_only" }` in every shipped `$def.in`, since no shipped job declares above the default), and either keep `constraints.privacy` as a separate human-readable note or fold it. Flag for the planner -- it's a small shape decision, but it changes `packet.cjs` and the schema's `required` list.

---

## Environment Availability

> The phase is code/config/test changes only -- no new external runtimes/services/CLIs. Step 2.6 mostly SKIPPED. The one near-dependency:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ajv` (Node module) | D-05 packet/response validator | ✓ (on disk, transitive via `@modelcontextprotocol/sdk@1.29.0`) | 8.18.0 | none needed -- `require('ajv')` resolves |
| `ajv-formats` (Node module) | only if the schema uses `format` keywords | ✓ (on disk, transitive via the SDK) | 3.0.1 | RESEARCH recommends avoiding `format` keywords -> not needed |
| Node.js | everything | ✓ | >= 18 (CLAUDE.md baseline) | none |
| `git` (for the pre-commit hook + the hook test) | D-08 layer 2 | ✓ (repo is a git repo) | -- | -- |
| live Brain endpoint (`mindrian-brain.onrender.com`) | `sendPacket` actually reaching the Brain | N/A -- cannot call it from research; and it has **no `brain_packet` tool** today | -- | "no Brain advice this turn" (the existing graceful-degradation contract; see Open Question 1) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the Brain-side `brain_packet` tool (out-of-plugin-scope; `sendPacket` degrades soft when it's absent).

---

## Runtime State Inventory

> Phase 110 is not a rename/refactor/migration phase. No stored data keyed on a renamed string; no live-service config; no OS-registered state; no secret-key renames; no build artifacts go stale. The one *additive* state change: 3 new strings in the `EVENT_TYPES` closed Set in `lib/core/navigation/memory-events.cjs` (a code edit, not a data migration -- existing `memory_event` rows are untouched; new rows can carry the 3 new `event_type` values). Section otherwise N/A.

---

## Sources

### Primary (HIGH confidence)
- **Codebase (read in full or in relevant part, 2026-05-12, `/home/jsagi/MindrianOS-Plugin/`):** `.planning/phases/110-brain-context-packet-contract/110-CONTEXT.md` + `110-DISCUSSION-LOG.md` (the authority); `lib/core/brain-client.cjs` (865 lines -- the wire path: `query`/`callTool`/`write`/`search`/`schema`/`_ensureSession`/`getApiKey`/`isAvailable`/`sanitizeCypherInput`/`checkFilePermissions`); `lib/core/navigation/packet.cjs` (`buildBrainPacket` + the safe-projection mappers); `lib/core/navigation/ingestion.cjs` (`storeBrainSuggestions` + the BEGIN/COMMIT/ROLLBACK + `review_status:'proposed'`); `lib/core/navigation/memory-events.cjs` (the closed `EVENT_TYPES` Set, current size 31); `lib/core/navigation.cjs` (the closed 13-function surface); `lib/core/brain-derivation.cjs` (the Phase 90 `buildBrainQueryContext` chokepoint -- the rejected hand-rolled alternative whose test idiom is reused); `lib/memory/brain-derivation.test.cjs` (the `require.cache`-mock + capture-and-assert test idiom); `scripts/build-command-registry.cjs` + `data/command-registry.json` + `data/ROOM.md` (the Phase 122 generated-checked pattern to mirror); `scripts/hooks/pre-commit-room-minto-guard.sh` (== `scripts/hooks/pre-commit` == `.git/hooks/pre-commit`, 8588 bytes -- the command-registry `--check` block at lines 143-147); `scripts/check-schema-aliases.cjs` (the Phase 108 schema-drift guard + the Phase 109 `--check-chokepoint` subcommand + the `MINDRIAN_HOOK_STAGED_*` env seams); `scripts/install-pre-commit.sh` + `scripts/setup-hooks.sh` (the two hook installers); `tests/run-all-122.sh` + `tests/run-all-956.sh` (the scoped-runner pattern); `tests/test-navigation-packet-part8-leak.cjs` (the 8-tripwire leak-sweep idiom); `lib/memory/run-feynman-tests.cjs` (the `TEST_FILES[]` registry + the 0/77/other exit-code convention); `mcp-server-brain/server.cjs` + `mcp-server-brain/lib/neo4j-tools.cjs` + `lib/pinecone-tools.cjs` + `lib/brain-ask.cjs` (the Brain MCP server tool inventory -- no `brain_packet` tool); `docs/THE-BRAIN.md` (the Brain MCP overview); `docs/MINDRIAN-CANON.md` Parts 3, 8, 9, Appendix D (the constitution); `docs/CANON-PHASE-MAP.md` (the Phase 110 row + the v1.13.0 milestone table + the Path-C re-route note); `.planning/REQUIREMENTS.md` (the NAV-109 block + traceability rows -- Phase 110 has none yet); `.planning/ROADMAP.md` (the Phase 110 stub block, lines 1045-1058); `.planning/research/2026-05-03-codex-graph-memory-proposal.md` Section A (Codex's worked Brain Context Packet shape, advisory); `CLAUDE.md` + `.claude/includes/*.md` (the project constitution: "What NOT to Use", the Release Process, ICM Layer 0, MCP-stack-awareness); `package.json` + `package-lock.json` + `node_modules/@modelcontextprotocol/sdk/package.json` (ajv provenance: transitive via the SDK's `ajv:"^8.17.1"`, resolved to 8.18.0).
- **Local verification (run 2026-05-12 against the on-disk `ajv@8.18.0`):** `new Ajv({ allErrors:true, strict:false }).compile(<schema with $defs + $ref:'#/$defs/X' + additionalProperties:false>)` -> compiles; `validate({a:'hi'})` -> `true`; `validate({a:1,b:2})` -> `false` with `errors` = `[{ keyword:'additionalProperties', params:{ additionalProperty:'b' }, message:'must NOT have additional properties' }, { keyword:'type', instancePath:'/a', schemaPath:'#/$defs/X/type', params:{ type:'string' }, message:'must be string' }]`. `require('ajv')` returns a function with `.default`. `require('ajv/package.json').version` -> `8.18.0`; `require('ajv-formats/package.json').version` -> `3.0.1`. `npm view ajv version` -> `8.20.0` (registry latest).

### Secondary (MEDIUM confidence -- official docs, not verified against the exact 8.18.0 build but consistent with what I ran locally)
- **ajv 8.x official docs** (`https://ajv.js.org/`): `api.html` (constructor options `allErrors`/`strict`/`strictSchema`/`strictTypes`/`removeAdditional`/`useDefaults`/`validateFormats`; `.compile(schema)`; `.addSchema(schema, key)`; `.getSchema(key)`; `.validate(schemaOrRef, data)`; the `ErrorObject` shape -- `keyword`/`instancePath`/`schemaPath`/`params`/`message`/`schema`/`parentSchema`/`data`); `guide/getting-started.html` ("the `errors` property is overwritten" on every `validate()` call; "best performance ... using compiled functions returned by `compile` or `getSchema`"); `guide/managing-schemas.html` (the `getSchema(id) || compile(schema)` pattern; compile-once-validate-many; `compile` both compiles and registers a schema with a `$id`); `strict-mode.html` (the strict-mode sub-options `strictSchema`/`strictNumbers`/`strictTypes`/`strictTuples`/`strictRequired`/`allowMatchingProperties`/`allowUnionTypes`; `strict:false` to disable, `strict:'log'` to warn-not-throw).

### Tertiary (LOW confidence -- flagged for validation)
- None. (The Brain-wire-envelope question in Open Question 1 is *unresolved*, not *low-confidence* -- the answer depends on a Brain-side decision that's out of plugin scope; the plugin-side disposition -- "POST `tools/call name:'brain_packet'`; degrade soft when absent" -- is HIGH confidence as a *safe* default, but the *actual* eventual envelope is a planner/Brain-team decision.)

---

## Metadata

**Confidence breakdown:**
- Standard stack (ajv bundled, no new dep; node assert + child_process; Phase-122-mirror tooling; CJS): **HIGH** -- ajv resolvability + version verified on disk; ran ajv 8.18.0 locally; the tooling pattern is read verbatim from `build-command-registry.cjs` + the pre-commit hook.
- Implementation approach (schema authoring style, `--check` mechanics, `sendPacket` placement, `origin` in `packet.cjs`, EVENT_TYPES extension, dual-path warning, privacy-mode wiring): **HIGH** -- every integration point read in the actual files; the one MEDIUM seam (the `db` handle for `sendPacket`'s event log) is flagged in Open Question 2 with a recommendation.
- The Brain wire envelope / "is it breaking": **MEDIUM** -- the *plugin* side is HIGH (graceful-degradation-safe default); the *eventual* envelope + the Brain-side `brain_packet` tool is a deferred, out-of-plugin-scope decision (Open Question 1).
- The dual-path "legacy job path": **HIGH** that there's no current call site (grepped every Brain caller); the *disposition* (forward-looking guard, document it) is a recommendation, not a fact -- the planner confirms.
- Pitfalls: **HIGH** -- each is grounded in a specific file/behavior I read or ran.

**Research date:** 2026-05-12
**Valid until:** ~2026-06-11 (30 days -- stable; the only fast-moving piece is the MCP SDK's transitive `ajv` pin, which a future `@modelcontextprotocol/sdk` bump could change -- the planner should note that in `scripts/build-brain-packet-schema.cjs`'s header as the canary). Re-check Open Question 1 if the Brain repo ships a `brain_packet` tool before this phase plans.
