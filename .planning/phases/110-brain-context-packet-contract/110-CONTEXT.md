---
phase: 110
name: brain-context-packet-contract
status: Ready for planning
priority: P1 -- Canon Part 8 hardening; high-leverage, LOAD-BEARING for Part 8 wire-level enforcement (NOT load-bearing for other phases' code)
gathered: 2026-05-12
mode: discuss-phase (interactive; expanded from the 2026-05-03 Codex stub after Phase 109 navigation API shipped + Canon Part 9 ratified)
parent_release: v1.13.0-beta.3 (Path C re-route 2026-05-05 promoted Phase 110 from v1.14.0 to v1.13.0-beta.3 -- structural Part 8 enforcement before Phase 121 telemetry accumulates; supersedes the stub's "parent_release: v1.14.0")
target_release: v1.13.0-beta.3 (the typed-packet contract); legacy free-form Brain job calls deleted in v1.14.0
canon_parts: [Part 8 (Graph Boundary -- hardened from procedural-audit to architectural-wire-format), Part 9 (Memory Locality -- Brain reasons over typed packets, never raw memory; ratified at the Phase 109 release gate, MINDRIAN-CANON.md v1.4)]
depends_on: [Phase 109 (uses buildBrainPacket and storeBrainSuggestions; the navigation.cjs chokepoint is the SINGLE producer of sendable packets)]
unblocks: []
research_inputs:
  - .planning/research/2026-05-03-codex-graph-memory-proposal.md (Section A: 108-07 Brain Context Packets -- the example packet shape)
  - .planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md (ratified as MINDRIAN-CANON.md Part 9)
  - lib/core/navigation/packet.cjs (Phase 109 D-06 -- the buildBrainPacket already on main; emits packet_version '1.0' + local_graph_summary.banked_opportunities; NO origin field yet -- Phase 110 adds it)
  - lib/core/navigation/ingestion.cjs (Phase 109 D-07 -- storeBrainSuggestions; Brain writes always land review_status: proposed)
  - lib/core/brain-client.cjs (current Brain MCP wire path: query() / callTool() / write() raw-Cypher; NO sendPacket() and NO real JSON Schema validation yet)
  - lib/core/brain-derivation.cjs (the Phase 90 buildBrainQueryContext 5-tripwire pattern -- the established hand-rolled-guard precedent in this repo)
---

# Phase 110: Brain Context Packet Contract - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn Canon Part 8 from "we audit for leaks" into "the wire format makes leaks structurally hard." Ship the **contract** layer on top of Phase 109's `buildBrainPacket`/`storeBrainSuggestions`:

- a typed JSON Schema for Brain Context Packets (`packet_version: '1.0'` + a forward-compat handshake) with per-job allowed **input** shapes for the closed Brain-job vocabulary and per-job allowed **output** shapes (Brain's response is schema-constrained too);
- privacy modes (`local_summary_only` | `allow_filenames` | `allow_excerpts`) with explicit user opt-in for the elevated two;
- a schema validator middleware in `lib/core/brain-client.cjs` -- invalid packets refuse to send, invalid responses refuse to ingest;
- a test suite proving the Canon Part 8 invariants hold for every shipped job type;
- a dual-path rollout (legacy free-form + typed packet) for one release, then deprecate to typed-only.

**Out of scope (deferred -- DO NOT plan):**
- Brain-side schema enforcement (separate Brain repo; coordinated, not plugin work).
- New Brain jobs beyond the shipped vocabulary below.
- Streaming / incremental packets (defer until a use case appears).
- Migrating `brain-client.query()` / `write()` raw-Cypher methodology lookups -- those carry only generic handles (framework names, phase ids, problem-type enums) and are Part-8-clean by construction. They are PERMANENT, not "legacy." Only **job-style** Brain calls migrate to packets.

</domain>

<decisions>
## Implementation Decisions

### Locked from the 2026-05-03 stub (carried forward verbatim -- not re-litigated)

- **D-00 (thesis, LOCKED):** "Turn Canon Part 8 from 'we audit for leaks' into 'the wire format makes leaks structurally harder.'"
- **D-01 (the hard invariant, LOCKED -- release-gate enforced):** No Brain packet may be assembled directly from raw files, shell output, or conversation transcript. Packets are built **only** through `lib/core/navigation.cjs::buildBrainPacket` (the Phase 109 chokepoint). The navigation API is the SINGLE producer of sendable packets -- Part 8 enforcement at the wire level, not just the audit level.
- **D-02 (closed job vocabulary, LOCKED):** The shipped jobs are exactly these 12 -- no more in this phase:
  `select_methodology`, `suggest_next_move`, `detect_contradiction`, `summarize_neighborhood`, `classify_room_budding`, `rank_assumptions`, `generate_feynman_explanation`, `strengthen_minto`, `prepare_investor_brief`, `opportunity_react`, `opportunity_reflect`, `opportunity_rank`.
  Every packet (regardless of job) also carries scalar opportunity context in `local_graph_summary.banked_opportunities` (count + top-3 by HSI; never raw bodies) -- opportunities are ambient per Canon Part 2's "always ambient" rule. (`opportunity_react` / `_reflect` / `_rank` are the explicit Bank REACT / REFLECT / re-rank interactions; HSI scores stay authoritative -- the Brain's re-rank is advisory only.)
- **D-03 (privacy-mode names, LOCKED):** the three modes are `local_summary_only` (default) / `allow_filenames` / `allow_excerpts`. (How opt-up works -> D-09.)
- **D-04 (packet_version, LOCKED):** `packet_version: '1.0'`. The forward-compat handshake mechanism is a planning detail (Claude's discretion -> see below), but the simplest acceptable shape: the plugin sends `packet_version`; if the Brain does not recognize it, the Brain rejects and the plugin degrades gracefully (no Brain advice this turn). Version negotiation beyond that is YAGNI for 1.0.

### Validator implementation (discussed 2026-05-12)

- **D-05:** The packet/response validator uses **`ajv@8.18.0`** -- already resolvable transitively via the MCP SDK; **do NOT add it as a direct dependency** (same rule as Hono/Express/ajv in CLAUDE.md "What NOT to Use"). Plain JSON Schema, not hand-rolled tripwires. (Hand-rolled per-job validators were the considered alternative; rejected -- a machine-readable contract is the point of "the wire format makes leaks structurally hard.")
- **D-06:** The schema lives at **`data/brain-packet-schema.json`** -- the single source of truth -- hand-maintained, with `$defs` per job carrying the `in` shape and the `out` shape, plus the privacy-mode enum, the `packet_version` const, and the `origin` enum (-> D-08). It is **generated-checked, not generated-from**: `scripts/build-brain-packet-schema.cjs --check` (mirroring the Phase 122 `command-registry` `--check` tripwire) fails the build / pre-commit if the schema is malformed, if any of the 12 shipped jobs lacks an `in` or `out` `$def`, or if a `$def` references a job not in D-02's closed vocabulary. (`data/` already has `ROOM.md`; the schema file sits alongside `command-registry.json`.)
- **D-07:** `lib/core/brain-client.cjs` gains a schema validator middleware:
  - `sendPacket(packet)` -> `ajv.validate(schema.$defs[packet.job].in, packet)`; on failure -> **refuse to send** (throw a clear error naming the job + the validation failure). A `memory_event` of type `brain_packet_rejected` is logged.
  - on a Brain **response** -> `ajv.validate(schema.$defs[job].out, response)`; on failure -> **do NOT ingest**, log a `memory_event` of type `brain_response_rejected`, and **degrade gracefully** -- the turn proceeds with no Brain advice. Never throw on a bad response; never partial-ingest (no strip-extra-and-keep-the-rest). Reject-hard-but-degrade-soft. (The Brain is a remote endpoint we do not fully control; this is the only safe stance -- a half-trusted response is no response.)

### `origin` provenance (discussed 2026-05-12)

- **D-08:** The "this packet really came from `buildBrainPacket`" guarantee is **three independent layers, no in-process nonce** (defense-in-depth, Canon-Part-8-philosophy -- not cryptography; the nonce was the considered belt-and-suspenders alternative; rejected as overkill given the hook):
  1. `buildBrainPacket` stamps `packet.origin = 'navigation_api'`. The schema (`$defs.*.in`) requires `origin` and constrains it to a closed enum: `'navigation_api'` in production; `'test_fixture'` is *also* accepted **only** when `process.env.MINDRIAN_TEST_MODE === '1'` (never honored in production -- the validator checks the env at validate-time).
  2. Pre-commit hook (extend `scripts/check-schema-aliases.cjs`, the Phase 109 chokepoint guard, OR a sibling check): fail any commit that introduces a `brain-client...sendPacket(` call site not lexically preceded by a `buildBrainPacket(` (same shape as the Phase 109 navigation-chokepoint pre-commit check; the planner picks "extend the existing mega-script" vs "new sibling check").
  3. `brain-client.sendPacket` itself rejects any `packet.origin` not in the closed allowlist (belt to the schema's suspenders -- so a caller who bypasses ajv still gets caught).

### Privacy modes -- opt-up UX (discussed 2026-05-12)

- **D-09:** Default + the only mode any of the 12 shipped jobs ever requests = `local_summary_only`. Opt-up:
  - to **`allow_filenames`**: set `config.json > preferences.brain_privacy_mode` (project-level) or pass `opts.privacyMode` per-call -- **no further prompt**. The packet then may carry filenames (still never bodies).
  - to **`allow_excerpts`**: requires the config flag / per-call override **AND** a one-time tri-context Decision Gate (Canon Part 3) per room -- a `Run Methodology`-style F-shape selector that states plainly "excerpts of your room content will reach the Brain," captured as an `APPROVE` (with reason) / `REJECT` / `DEFER` edge per Canon Part 4. `allow_excerpts` has **no shipped consumer** -- it is a documented escape hatch, never auto-triggered by any job.
  - The validator enforces per-job: even if the config says `allow_excerpts`, a packet for a job whose `$def` declares `local_summary_only` is validated against the *narrower* shape (config can only *cap* the mode, never *raise* what a job actually sends).

### Dual-path rollout + legacy sunset (discussed 2026-05-12)

- **D-10:** Through **v1.13.0-beta.3 .. v1.13.0-final**: both paths live. `sendPacket()` (typed) is the preferred path; legacy job-style free-form Brain calls still work, but the first one per session emits a `console.warn` deprecation notice + a `memory_event` / telemetry line (`brain_legacy_path_used`). In **v1.14.0** the legacy job path is **DELETED** (code removed -- not just hard-erroring). `brain-client.query()` / `write()` raw-Cypher methodology lookups are explicitly **NOT** "legacy" and are untouched forever (Part-8-clean by construction).

### Test suite (locked by D-00 + D-01; mechanics = Claude's discretion)

- **D-11:** The test suite must prove, per shipped job (all 12): (a) a well-formed `in` packet validates and a malformed one is refused with the expected `brain_packet_rejected` event; (b) an off-spec Brain `out` response is refused-and-degraded with the expected `brain_response_rejected` event, no partial ingest; (c) a packet with `origin` other than the allowed enum (in the relevant env) is refused; (d) the Canon Part 8 invariant -- no body/transcript/shell text -- holds for the packet `buildBrainPacket` actually produces for that job. Plus: the `--check` schema tripwire test (malformed schema / missing job `$def` / unknown job -> non-zero), and the pre-commit-hook test (a fixture diff introducing a bare `sendPacket(` -> hook fails). Framework = node `assert` / `node:assert/strict` + `child_process` (the repo standard -- no jest/mocha/vitest/zod), registered in `lib/memory/run-feynman-tests.cjs` + a scoped `tests/run-all-110.sh` (mirror `tests/run-all-122.sh` / `run-all-956.sh`).

### Claude's Discretion (planner/researcher decide)

- The exact JSON Schema authoring style inside `data/brain-packet-schema.json` (one big `$defs` block vs `$ref`-composed sub-schemas; how the shared `local_graph_summary` / `banked_opportunities` shape is factored as a reusable `$def`).
- Whether the pre-commit `sendPacket`-without-`buildBrainPacket` check extends `scripts/check-schema-aliases.cjs` or is a new sibling script (D-08 layer 2).
- The forward-compat handshake mechanics beyond D-04's minimum (only if research surfaces a real need).
- Whether `brain-client.sendPacket()` is a brand-new function or `callTool()` gains a packet-aware path.
- How the deprecation `console.warn` is rate-limited to once-per-session (module-level flag vs a session-state key).
- Naming/placement of the new `memory_event` types (`brain_packet_rejected` / `brain_response_rejected` / `brain_legacy_path_used`) within the Phase 109 closed-15 EVENT_TYPES enum -- note: this likely EXTENDS that enum (like Phase 116-00 added 5 tension event strings); flag it for the planner as an enum-extension touchpoint.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Canon (the constitution this phase enforces)
- `docs/MINDRIAN-CANON.md` Part 8 "The Graph Boundary (Security Constitution)" -- the LOCAL-to-BRAIN: NO rule this phase hardens from audit to wire format. Also Part 8's "Violations are bugs" + the PR gate paragraph.
- `docs/MINDRIAN-CANON.md` Part 9 "Memory Locality and Interpretation" (ratified 2026-05-12, canon v1.4) -- "Brain reasons over structured packets, never raw memory"; the five-role separation; the truth-states closed set; "### Implementing phase" points at Phase 109 and names Phase 110 as the wire-hardening.
- `docs/MINDRIAN-CANON.md` Part 3 "The Tri-Context Decision Gate" + the 5 Shape-F sub-shapes -- the `allow_excerpts` opt-up gate (D-09) is a Part-3 instance.
- `docs/CANON-PHASE-MAP.md` -- Part 8 row + Part 9 row + the v1.13.0 milestone table row for Phase 110 (currently `planned, beta.3`); also the Phase 90 5-tripwire row (the precedent).

### Upstream phase artifacts (the APIs this phase wraps)
- `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md` D-06 (Brain Packet Builder) + D-07 (Brain Result Ingestion) -- the packet shape and the `review_status: proposed` ingestion rule.
- `lib/core/navigation/packet.cjs` -- the live `buildBrainPacket(db, job, focusNodeId, opts)`; emits `packet_version: '1.0'`, `local_graph_summary.banked_opportunities` (hashed ids, HSI bands, no bodies). Phase 110 adds the `origin` field here and tightens it against the schema.
- `lib/core/navigation/ingestion.cjs` -- `storeBrainSuggestions(db, packetResult, sessionId)`; `created_by: 'brain'`, `review_status: 'proposed'`, `source_path` starting `brain:job:`.
- `lib/core/navigation.cjs` -- the 13-(15-)function chokepoint surface; `buildBrainPacket` / `storeBrainSuggestions` are re-exported here.
- `lib/core/navigation/memory-events.cjs` -- the closed EVENT_TYPES enum (Phase 109 D-03; Phase 116-00 already extended it) -- the new `brain_*` event types extend this.

### The validator + the tripwire pattern to mirror
- `lib/core/brain-client.cjs` -- the current Brain MCP wire path (`query` / `callTool` / `write` / `_ensureSession` / `getApiKey` / `isAvailable`); ~865 lines; no JSON Schema validation today; `sendPacket()` is net-new.
- `lib/core/brain-derivation.cjs` (+ `lib/memory/brain-derivation.test.cjs`) -- the Phase 90 `buildBrainQueryContext` 5-tripwire pattern (the rejected hand-rolled alternative -- but its grep-sweep / forbidden-substring test idiom is reusable for D-11's Part-8-invariant tests).
- `scripts/build-command-registry.cjs` + `data/command-registry.json` + `.git/hooks/pre-commit` + `scripts/hooks/pre-commit` (Phase 122) -- the generated-checked-with-`--check`-tripwire pattern that `scripts/build-brain-packet-schema.cjs` mirrors; and the pre-commit-hook wiring shape for D-08 layer 2.
- `scripts/check-schema-aliases.cjs` (Phase 109 D-05) -- the navigation-chokepoint pre-commit guard; D-08 layer 2 extends this or sits beside it.
- `tests/run-all-122.sh` / `tests/run-all-956.sh` -- the scoped-bash-runner pattern for `tests/run-all-110.sh`.
- `lib/memory/run-feynman-tests.cjs` -- the `TEST_FILES[]` registry the new 110 suites get registered in.
- `CLAUDE.md` "What NOT to Use" -- node `assert` + `child_process` is the test framework; CJS not ESM; ajv/Hono/Express are bundled-with-the-MCP-SDK, NEVER direct deps; the Release Process; the workspace guard; ICM Layer 0 (`ROOM.md` per dir).

### The example packet shape (advisory, not normative)
- `.planning/research/2026-05-03-codex-graph-memory-proposal.md` Section A -- Codex's worked example of a Brain Context Packet (the shape Phase 109's `packet.cjs` already largely follows).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/navigation/packet.cjs::buildBrainPacket` -- already produces the packet; Phase 110 adds `origin` + validates it. `surface_banked_opportunities` already does the hashed-id / HSI-band / no-body projection -- the schema just formalizes its output shape.
- `ajv@8.18.0` -- on disk via the MCP SDK; `require('ajv')` resolves. No new dependency.
- `scripts/build-command-registry.cjs` + the pre-commit `--check` wiring (Phase 122) -- copy the structure for `scripts/build-brain-packet-schema.cjs`.
- The Phase 90 brain-derivation test idiom (forbidden-substring grep sweeps over fixtures) -- reuse for D-11's Part-8-invariant assertions.

### Established Patterns
- "Generated artifact in `data/`, validated by a `--check` tripwire wired into the pre-commit hook + the Feynman runner" (Phase 122 command-registry) -- the model for `data/brain-packet-schema.json`.
- "Single chokepoint module + a pre-commit hook that fails any direct access outside it" (Phase 109 `navigation.cjs` + `scripts/check-schema-aliases.cjs`) -- the model for `sendPacket` being the only door and D-08 layer 2.
- "Closed enum, JS-validated before insert, extended additively when a phase needs a new value" (Phase 109 EVENT_TYPES; Phase 116-00 extension) -- the model for adding `brain_packet_rejected` / `brain_response_rejected` / `brain_legacy_path_used`.
- "Brain queries carry only generic handles + enums + sha256 hashes; never user bytes" (Phase 90 5-tripwire; Phase 109 D-06) -- the invariant D-11 must prove per job.

### Integration Points
- `lib/core/brain-client.cjs` -- new `sendPacket()` + the validator middleware sit here; `callTool()` / `query()` / `write()` unchanged.
- `lib/core/navigation/packet.cjs` -- the `origin` field added here.
- `lib/core/navigation/ingestion.cjs` -- the response-validation gate sits in front of (or inside) `storeBrainSuggestions`.
- `lib/core/navigation/memory-events.cjs` -- EVENT_TYPES enum extended.
- `data/brain-packet-schema.json` (new) + `scripts/build-brain-packet-schema.cjs` (new) + `data/ROOM.md` (exists -- update if new artifact added).
- `.git/hooks/pre-commit` + `scripts/hooks/pre-commit` (or `scripts/check-schema-aliases.cjs`) -- D-08 layer 2.
- `lib/memory/run-feynman-tests.cjs` + `tests/run-all-110.sh` (new) -- test registration.
- `config.json > preferences.brain_privacy_mode` (new preference key) -- D-09 opt-up.

</code_context>

<specifics>
## Specific Ideas

- The validator stance phrase to keep: **"reject hard, degrade soft."** Invalid packet -> throw + refuse to send. Invalid response -> swallow, log a `memory_event`, proceed with no Brain advice. Never partial-ingest.
- The `origin` enforcement phrase: **"three layers, no crypto"** -- schema enum + pre-commit hook + brain-client allowlist. The hook is the real teeth; the string is in-process-forgeable but the hook + review catch it. (Canon Part 8 is defense-in-depth, not a cipher.)
- `allow_excerpts` is a **defined-but-unconsumed escape hatch** -- it exists in the enum and the schema so a *future* job can use it, but no shipped job ever requests it and it always requires a Part-3 Decision Gate. Don't let the planner wire any current job to it.
- The migration boundary phrase: **"only job-style calls migrate; raw-Cypher methodology lookups are permanent."** `query()` / `write()` are not "legacy."
- Mirror Phase 122 wherever possible -- this phase is deliberately the same shape (generated-checked artifact in `data/`, a `--check` tripwire in the pre-commit hook + Feynman runner, a scoped `run-all-NNN.sh`). Reuse, don't reinvent.

</specifics>

<deferred>
## Deferred Ideas

- Brain-side schema enforcement (the Brain repo validating the same schema on its end) -- coordinated separately; out of plugin scope.
- New Brain jobs beyond the shipped 12 -- new phases.
- Streaming / incremental / chunked packets -- defer until a real use case appears.
- Version negotiation beyond the D-04 minimum (Brain advertising a supported-versions list, highest-mutual selection) -- YAGNI for `packet_version: '1.0'`; revisit at `2.0`.
- An in-process nonce on top of D-08's three layers -- considered, rejected as overkill; revisit only if a concrete bypass is found.
- Migrating `brain-client.query()` / `write()` to a typed shape -- NOT deferred so much as out-of-scope-by-design (they carry only generic handles; nothing to harden).

</deferred>

---

*Phase: 110-brain-context-packet-contract*
*Context gathered: 2026-05-12 via /gsd:discuss-phase (interactive). Expanded from the 2026-05-03 Codex stub now that Phase 109 (navigation API) has shipped and Canon Part 9 is ratified (canon v1.4). Four gray areas discussed and locked: validator (ajv + data/ schema + --check tripwire), origin provenance (3 layers, no nonce), privacy-mode opt-up (config flag for allow_filenames; Part-3 Decision Gate for allow_excerpts), dual-path sunset (dual through v1.13.0-final, one-time/session warning + telemetry, legacy job path deleted in v1.14.0).*
