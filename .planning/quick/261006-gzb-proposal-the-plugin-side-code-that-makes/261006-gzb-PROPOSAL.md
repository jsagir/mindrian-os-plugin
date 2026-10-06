# 261006-gzb PROPOSAL: the plugin-side code that makes the ICM to Theo relationship work end to end

Written 2026-10-06. This is a plan, not an edit: no code, data, registry, Theo or room was changed. Plugin dev HEAD 5b1d6c3949dfc840f22f5f3fb98b6a6feaa311f6, repo version 2.0.0-beta.64 (the placeholder, so the next cut is beta.65), 17 commits ahead of tag v2.0.0-beta.63 (563c242623f051f254c1e7168c8fe2a82a94221a). Theo repo read as files only at d30d86c. `git status --porcelain` on the plugin read 0 lines before and after every probe.

How the numbers were made. Every number below is either a file:line I read on HEAD or the output of a command I ran this session. The probes live in this session's scratchpad (`stub-server.cjs`, `run-matrix.cjs`, `matrix-out.json`, `run-floor.cjs`, `floor-out.json`). They ran under `tests/helpers/isolated-home-36925.cjs` with `MINDRIAN_BRAIN_URL` pointed at a local stub server or at a closed port (`127.0.0.1:9`). No Theo MCP tool was called. Nothing ran under ~/MindrianRooms or ~/.mindrian, and no release command or `--read-by` ran.

This builds on 261006-g9w (the nest-scoped ask design, the missing command-name door, the ungated room_bind and the JTBD carry). I re-measured only what this proposal leans on.

---

## Executive summary (plain words)

**The picture in one breath.** Each folder in a room (a "nest": problem-definition, strategy and so on) has a generated "Theo face": a page saying what Theo, the teaching graph, suggests for that folder. To fill it, the plugin sends Theo a few generic labels, such as a problem type ("Wicked") or a framework name ("Root Cause Analysis"), and never anything from the room. Theo answers, Larry picks one next move, the person confirms, and the plugin runs the command. Below Theo there is a floor that always works: three local lists of commands per folder (the section contract, the ledger and the navigator's relevance table). I call that the local three-source filter.

**What exists and works (measured).**
- The floor really is a floor. With Theo unreachable, all 11 core folders still got a primary next move on both the CLI and MCP. The Theo face rendered "not asked: Theo did not answer" in 11 of 11 (scratchpad `floor-out.json`).
- The boundary guard (`lib/core/part8-egress-guard.cjs`) already proves the four plain reads exactly: `allow / known_tool_shape`. It also proves Theo's health read (`theo_health {}`) as `allow / empty_payload`. A number-only id is blocked, so the nonce must never be numeric.
- An offline run sends nothing (369.25 CLOSE).
- The registry is still byte-identical to the frozen beta.63 snapshot: sha256 prefix 39a771cc6375c7f1 at HEAD and at the tag.

**What is missing, and the one thing that must be fixed before any live ask.** Today, when Theo refuses, the plugin reports that Theo found nothing. I stood up a local stub that answers the way Theo's own server code answers (MCP SDK 1.30.0, `mcp.js:103-185`; Theo `src/mcp/to-tool-result.ts:157-176`): a schema refusal, a missing tool and a quarantine error. In all three cases the ask came back `asked: true`, 0 rows and `refusals: []`, and the face printed "Theo returned none ... refusals: none." Two lines of code cause it:
- `brain-client.cjs:618-627` never reads the MCP `isError` flag.
- `theo-ask.cjs:172-174` treats something as a refusal only when it carries an `error` string.

A renamed field (for example `chapters` arriving as `frameworkChapters`) also reads as a silent 0. So if we turned on a live ask today, a Theo change would make the face lie. Four other things are missing:
- the nest-scoped ask (a scoped question about one folder, which Theo has not published a contract for yet);
- a test that pins what we expect of Theo;
- a real-room leg that actually asks Theo (today every nest reads "not asked: no problem type or framework handle to send");
- a door from a command name to a run.

**What I recommend building first: a runtime enforcer.** This is one function, `theoRead(read, args, ctx)` in a new `lib/core/theo-gate.cjs`. Every contracted Theo read goes through it, and it does five jobs:
1. It proves the exact shape before sending, and refuses, rather than just warns, when the proof fails.
2. It learns Theo's contract version without an unguarded call.
3. It checks that the request id and scope Theo echoes back match what was sent.
4. It reads Theo's answers tolerantly: extra fields are ignored, but a renamed or missing field, a removed tool or a refusal becomes a typed reason, never a silent 0.
5. It returns an answer record, never raw Theo output.

A doctor check fails the build if a contracted read is called anywhere else. This is item 8, with item 9 (drift-readiness) and item 7 (failure modes) folded in.

**The recommended first live ask.** Make it as small as possible: framework names only, no problem type, no nest block. Change one committed fixture file per nest so two folders of the release fixture room carry a navigator-chosen framework handle in their artifact frontmatter (`frameworks: [Root Cause Analysis]` on problem-definition, `frameworks: [Systems Thinking]` on strategy). The existing live real-room run (`room-read.cjs feymintoLeg` -> `deriveSection` -> `askForNest`) would then send exactly two `framework_neighborhood` reads, one per folder, through the new enforcer. The navigator reads the report, which shows those two folders as asked, with rows or a typed reason, and the other nine as "no handle to send".

This needs:
- no Theo-side contract, and no nest block;
- no problem-type ruling;
- no edit to the frozen 369.2 files (`scripts/real-room-run.cjs` is untouched; only fixture frontmatter and the enforcer change);
- no registry change.

The scoped ask and problem-type reads come in the next wave, after Theo publishes its nest contract version and after 369.2-32 finishes reshaping `real-room-run.cjs`.

**Navigator rulings this needs before any build** (full table below):
- R1, the enforcer's scope: contracted reads only, with a ratchet.
- R2: refuse an unproven shape on contracted reads.
- R3: an additive `isError` marker in brain-client.
- R4: the problem-type source must be navigator-confirmed.
- R5: the reason sets.
- R7: how RULE 10 treats a live Theo leg (advisory on Theo being down, blocking on silence).
- R8 and R9: the command door and the Switch-or-Stay card. These are Part 11 changes.

---

## Words used here

- **Theo**: the remote teaching graph behind every brain read (theo-mcp.onrender.com).
- **Nest**: one core section folder in a room (11 core sections; `lib/core/section-registry.cjs`).
- **Face**: the generated BRAIN.md page per nest that shows what Theo suggests and how it was asked.
- **Floor**: the local three-source filter. `composeNextMove` (`lib/core/feyminto/next-move.cjs:100-205`) runs over `sourcesForSection` (`command-sources.cjs:72`: contract, ledger and navigator table) when the face was not asked. It needs no network.
- **Contracted read**: a Theo read whose shape the plugin pins in `data/brain-surface-contract.json` `feyminto_reads`. Today there are four: find_frameworks_for_problem_type, commands_for_problem_type, recommend_chain and framework_neighborhood. Proposed additions: theo_health and command_neighborhood.
- **Nest block**: the scoped form of a read, `{problem_type, section_kind, job_id, request_id}` (Theo's commitment).
- **Typed reason**: a short code from a closed list, always shown with one plain sentence; never blank, never "(no signal)".
- **Canon Part 8**: no room content leaves for Theo, only generic handles. **Canon Part 9**: room.db is the local mind; only a human confirms a truth claim.

---

## Measurements this proposal rests on

| # | What | Result | How |
|---|---|---|---|
| M1 | Theo schema refusal (`isError: true`, "MCP error -32602: Input validation error ... Unrecognized key(s)") through the real `callTool` and `askTheoForNest` | `callTool` returns `{text: "MCP error -32602 ..."}`; the ask returns `asked: true`, 3 queries, 0 rows, `refusals: []` | `run-matrix.cjs` mode strict_refusal |
| M2 | Tool removed ("Tool find_frameworks_for_problem_type not found", `isError: true`) | same silent 0 | mode tool_missing |
| M3 | Theo error envelope (`QUARANTINED: ...`, `isError: true`, Theo's `toToolError` shape) | same silent 0 | mode theo_error |
| M4 | JSON-RPC level error | `callTool` returns null; the ask returns `not_asked: theo_unavailable` (typed, correct) | mode jsonrpc_error |
| M5 | Theo offline (closed port) | `theo_unavailable` (typed, correct) | offline |
| M6 | Renamed fields (`chapters`->`frameworkChapters`, `rows`->`items`, `chain`->`steps`) | `asked: true`, 0 rows on all three reads, no reason; coverage still read (1/33) | mode renamed |
| M7 | Extra unknown fields (`new_field`, a `contract` block, `serves_jtbd` on rows) | tolerated: rows 1/1/1 counted | mode extra_fields |
| M8 | Thin Wicked coverage (1 chapter of 33) | `asked: true`, find_frameworks 1 row, coverage 1/33; face prints "Chapter coverage for this lens: 1 of 33." and "Nothing to fit yet"; no typed qualifier | mode thin_wicked plus a face render |
| M9 | The floor with Theo unreachable | 11 of 11 core sections give a primary on CLI and on MCP (for example problem-definition -> root-cause, from contract, ledger, navigator table and job); face reason shown 11 of 11; 33 fetch attempts, all to the closed port (3 per nest) | `run-floor.cjs` |
| M10 | Guard verdicts | four legacy shapes `allow/known_tool_shape`; `theo_health {}` `allow/empty_payload`; nest shapes (find_frameworks, recommend_chain) `ambiguous/unknown`; nest shape with request_id `4155550123` `block/content_set`; `command_neighborhood {command}` `ambiguous/unknown` | `node -e` on `classify` |
| M11 | Where an ambiguous verdict proceeds | `brain-client.cjs:465-472` (`disposition: 'proceeded'`) | read |
| M12 | Where `isError` is lost | `brain-client.cjs:618-627` reads only `content[].text`; `grep isError` in brain-client, feyminto and the shim: 0 hits | read plus grep |
| M13 | Theo's recorded tool list | 42 tools, 82,760 bytes, recorded 2026-10-05 (`.planning/phases/369.2-.../fixtures/phase0/J2/nokey.body`). Every contracted read and `command_neighborhood` carries `additionalProperties: false`; `theo_health` has `{properties: {}}` plus an outputSchema | read the fixture |
| M14 | theo_health fields today | mode, quarantine fields, `build_stamp{sha,builtAt,dirty}`, `sync_drift{baseline_stamp,canon_stamps,...,materiality,finding}`, `watcher_coverage`, `served_as`, `endpoint`, `plugin_only_tools`. **No contract version field** | Theo `src/mcp/health.ts:260-316` |
| M15 | Theo call sites | see item 8(g) census | grep |
| M16 | Registry and tests | `build-command-registry.cjs --check` exit 0; jtbd-declarations exit 1 (5 violations); jtbd-coverage exit 0; jtbd-taxonomy 13/13; per-command-jtbd-derivation exit 0; help-coverage-gate 1 failed of 11 (Test 7, pre-commit wiring); test-369.26-registry-sync 7 passed, 1 failed (`assets/framework-names.json differs from data/framework-names.json`, after commit 503d0cb86); registry rows 114, `help_jtbd` in 0 rows, in 114 of 114 command files; `serves_jtbd` lengths 1:75, 2:37, 3:2; `curated_chains` 23 | ran |
| M17 | Problem type sources | `nestHandles` takes the MINTO lens (UDP/IDP/WDP only, `theo-ask.cjs:116-123`) or else `goal.rung` (`:124-127`). `goal` carries `set_by`, default `'gate_answer'`, and an optional `decision_node_id` (`lib/hmi/jtbd-state.cjs:313-380`) | read |
| M18 | Why the release fixture asks nothing | `real-room-run.cjs:238` copies only `sections/`; the fixture artifacts carry no `framework:`/`frameworks:` frontmatter (read `strategy/passive-cooling-encoding.md`) and the room gets no `goal.rung`, so `nestHandles` returns `no_handle_to_send` | read |

---

## The ranked plan

The order follows one question: what must be true before the first live ask is both correct (the face never lies) and safe (Part 8 holds, the floor holds)?

### Rank 1. Item 8 + item 9 + item 7: the runtime enforcer, built for Theo drift

**Goal.** One function every contracted Theo read passes through. It refuses or degrades loudly, never silently, and returns an answer record the face can trust. It is designed for the Theo of next month, not today's.

#### 8(f) The one enforcement point

`lib/core/theo-gate.cjs` (new, CommonJS, no hook reaches it):

```
theoRead(read, args, ctx) -> Promise<TheoAnswer>      // never throws
  read : one of CONTRACTED_READS (frozen list read from data/brain-surface-contract.json feyminto_reads)
  args : the plain (unscoped) args, e.g. { problem_type: 'Wicked' }
  ctx  : { scope?: { section_kind, job_id }, room_id?, question_basis?,   // room_id and basis never leave the process
           callTool?, now?, offline?, atBirth?, capabilities? }

TheoAnswer = {
  read, outcome: 'answered' | 'degraded' | 'not_asked',
  rows: [...],                 // projected through the per-read tolerant reader, named fields only
  coverage: { matched, total } | null,
  qualifiers: [ 'thin_coverage' ] | [],
  scope:    { requested, sent, state: 'scoped'|'not_scoped'|'mismatch'|'stale'|null, reason, echo_ok: true|false|null },
  contract: { pinned: { min, max }, theo: <int>|null, accepts: [ints]|null, source: 'stamp'|'theo_health'|'none', in_range: bool|null },
  degradation: { set: 'not_asked'|'scope'|'drift'|null, reason: <code>|null, line: <plain sentence>|null, refusal_code: <TOKEN>|null },
  wire: { keys_sent: [...], proof: 'known_tool_shape'|'empty_payload', origin },
  asked_at
}
```

Also exported:
- `theoCapabilities(ctx)`: the cached contract and tool knowledge, see 8(b).
- The frozen reason sets.
- `CONTRACTED_READS`.

`askTheoForNest` (`theo-ask.cjs:236`) becomes a composer over `theoRead`: it keeps its exported shape, and `results` and `rows_returned` are filled from TheoAnswer records. The raw Theo object never reaches the face.

#### 8(a) Shape proven before send, refused not warned

- Before every send, `theoRead` runs `guard.classify(wireArgs, {toolName: read})` itself. It sends only on `allow` with class `known_tool_shape` (or `empty_payload` for theo_health).
- If the nest form fails proof, it sends the plain form and records scope `not_scoped`. If the plain form fails proof, it sends nothing and returns not asked: `egress_blocked`.
- So an ambiguous verdict never leaves the process on a contracted read. Elsewhere `callTool` keeps the Phase 254 Option A behavior (proceed with a disclosure); the enforcer does not change that for the other ~16 wrappers.
- `request_id` comes only from `crypto.randomUUID()` and must match `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` before send. One fresh id per read. It is never derived from the room and never put into `handles_fingerprint`.
- The guard arms for the nest form are item 1's work. Until they land, every nest form proves `ambiguous` (M10), so the enforcer always sends the plain form. That is the safe default.

#### 8(b) Learning Theo's contract version and capabilities (item 9 parts 1 and 2)

- **Which call.** Two ways, in order of preference:
  1. **A per-response stamp** (preferred; asked of Theo in 369.25-THEO-PREP item 3). If Theo stamps every response with its nest contract version, the first plain read of each process tells the plugin the version at zero extra calls. Scoped reads start from the second read on.
  2. **`theo_health {}`** (fallback). It goes through the guarded wire today: `callTool('theo_health', {})` classifies `allow/empty_payload` (M10), the exact call `brain-prewarm.cjs:115` and `class-m-brain-smoke.cjs:245` already make. One call per process.
  - Today theo_health has no contract field (M14). Theo must add one. Recommendation for Theo: `nest_contract: { version: N, accepts: [..] }`, an additive field.
- **Why not tools/list at runtime.** It is a whole-catalog read: 42 tools, 82,760 bytes in the 2026-10-05 recording (M13), on every process. brain-client has no guarded tools/list today (only `tools/call`, `brain-client.cjs:503-515`). Runtime does not need it. Detect tool presence lazily instead: a "Tool X not found" refusal becomes `theo_tool_missing` on first use, and that tool is marked missing for the rest of the process. tools/list belongs in the doctor and drift check (item 2), opt-in.
- **Cache policy.**
  - Kept in process memory only, keyed by origin, with the same 5-minute life as the session cache (`SESSION_TTL_MS`, `brain-client.cjs:180`). A tool marked missing stays missing for the process.
  - No disk cache by default. The prewarm marker stays exactly `{at, ok, origin_host}` (`brain-prewarm.cjs:22-27`, D-02).
  - If an on-disk cache is wanted later, it holds only `{at, origin_host, nest_contract, tools_missing[]}`. That is machine state, not room memory, so Part 9 is not touched.
- **Version window.**
  - `feyminto_reads` gains `"nest_contract": { "min": 1, "max": 1 }`.
  - The plugin sends the nest form only when the highest version in both its `[min..max]` and Theo's `accepts` exists.
  - Theo publishes no version: plain reads, scope `not_scoped`, no drift reason (the contract is not live yet).
  - Theo's version is outside the window, or the two ranges do not overlap: plain reads, scope `not_scoped`, drift `theo_version_unsupported`.
  - Never a failed ask.
- **When it cannot learn the version** (theo_health refused or offline): plain reads go ahead with scope `not_scoped`. If the plain reads also fail, the result is not asked: `theo_unavailable`, and the floor carries the face.
- **Cost.**
  - Stamp path: 0 extra calls.
  - theo_health path: 1 extra round trip per process. I could not measure its size or latency (no recorded response, no live call).
  - One scoped nest ask is up to 3 problem-type reads plus up to 3 neighborhoods, so a live real-room run over 11 nests is up to 66 reads (M9 measured 3 per nest with a problem type only).

#### 8(c) Echo checked on return

- For a scoped read, `theoRead` checks Theo's echoed `request_id`, `section_kind` and `job_id` against the in-process nonce map: `Map<request_id, {room_id, question_basis, read, minted_at}>`, with each entry deleted on return or timeout (g9w 1.4).
- An echoed request_id that differs gives `stale`. A different section or job gives `mismatch`. A missing echo gives `not_scoped`.
- In each case the scoped rows are dropped, the answer is marked degraded, and the face carries the floor.
- At write time `brain-derivation.cjs` compares the minted `question_basis` with the nest's current one. If it moved, the result is `stale`.

#### 8(d) The Part 8 guard stays the single egress door

- `theoRead` does not open a socket. It calls `callTool` (`brain-client.cjs:394`), whose belt runs `classify` again, the first thing it does.
- `theoRead`'s own pre-proof is stricter, never looser.
- `request_id` is random bytes per read. `room_id`, `question_basis` and the brief fingerprint never go on the wire (test arm E8).
- `theo_health` and tools/list carry no arguments.

#### 8(e) and item 9(3): the tolerant reader and the three sets of typed reasons

How today's readers in `theo-ask.cjs` behave (measured, M6 and M7):

| Reader | Tolerates | Does not tolerate |
|---|---|---|
| `firstRow` `:176-179` | a bare row or a `rows` array | a renamed container |
| `listFromFindFrameworks` `:181-184` | missing `chapters` (reads []) | renamed `chapters` reads as a silent 0 |
| `coverageOf` `:188-191` | a top-level `coverage` block or the anchor row | none measured |
| `listFromCommands` `:193-198` | `rows` or `rows[0].rows` (one level of nesting) | `rows` renamed (`items`) reads as a silent 0 |
| `listFromRoute` `:200-202` | none beyond `chain` | `chain` renamed (`steps`) reads as a silent 0 |
| `neighborhoodOf` `:204-214` | missing optional lists | missing `name` reads as no neighborhood, silently |
| `isRefusal` `:172-174` | `{error: string}` sentinels | MCP `isError` results (M1-M3) are counted as answered |

The new reader rule:
- Unknown fields are ignored.
- Missing optional fields (`coverage`, `diagnostics`) are tolerated, and the face says "not returned".
- A success that lacks the read's required container is not 0 rows. It is `theo_shape_changed`, recording the top-level key names only. The required containers are `rows` for find_frameworks and commands, `chain` for recommend_chain, and a row with `name` for neighborhood. This reuses the precedent of `brain_query_unrecognized_shape` (brain-client quick 260903-eit), which records `shape_keys` and warns once.
- An `isError` result is read by its prefix:
  - `Tool <name> not found` -> `theo_tool_missing`
  - `Input validation error` -> `theo_shape_changed`
  - Theo's own `CODE: detail` -> the CODE token (`/^[A-Z_]{3,40}(?=:)/`) recorded as `refusal_code`. The detail text is never kept.

Reason sets. All are frozen objects in `theo-gate.cjs`, each with a `*_LINES` table:

| Set | Members | Meaning |
|---|---|---|
| `NOT_ASKED` (unchanged, `theo-ask.cjs:48-55`, the closed six) | at_birth, offline, theo_unavailable, egress_blocked, no_handle_to_send, room_not_ready | nothing useful came back from Theo; the face holds no Theo content |
| `SCOPE_FALLBACK` (new) | not_scoped, mismatch, stale | Theo was asked, but not about this nest (or the scope did not hold); rows are lens-level or dropped |
| `THEO_DRIFT` (new, item 9) | theo_tool_missing, theo_shape_changed, theo_version_unsupported | Theo changed under us; the read degraded |
| `QUALIFIERS` (new) | thin_coverage | the answer is real but thin (coverage.matched <= 1, or the read's own rows <= 1); shown, recorded, not a degradation |

Why sibling sets instead of growing NOT_ASKED (R5):
- `tests/test-36925-theo-ask.cjs:169` pins the closed six.
- `brain-derivation.cjs:577-578` refuses unknown reasons.
- `brain-derivation.cjs:723` treats a not-asked face as holding no Brain content.

In the scope and drift cases Theo *was* asked, so folding those reasons into NOT_ASKED would mis-tier the face. When every read of a nest ends in a drift reason, the nest-level result is `not_asked: theo_unavailable`, with the drift reasons listed beside it.

#### Item 7: failure-mode table (each degrades to the floor with a typed reason)

| Condition | Detection point (file) | Reason code | What the face prints | Test arm |
|---|---|---|---|---|
| Theo offline or timeout | `brain-client.cjs` callTool returns null -> `theo-gate.cjs` | not_asked: theo_unavailable | "not asked: Theo did not answer" plus the floor's pick | D1 |
| JSON-RPC error | same (null) | not_asked: theo_unavailable | same | D2 |
| Strict-object refusal of the nest form | `theo-gate.cjs` isError prefix `Input validation error` (needs the R3 marker) | drift: theo_shape_changed and scope: not_scoped; one plain retry | "Theo refused the scoped question; asked for the lens instead (Theo's contract changed)" | D3 |
| Strict-object refusal of the plain form | same | drift: theo_shape_changed; no retry | "Theo refused this read: its input contract changed; using this room's own sources" | D4 |
| Tool removed or renamed | isError prefix `Tool <name> not found` | drift: theo_tool_missing; marked missing for the process | "Theo no longer offers <read>; using this room's own sources" | D5 |
| Field renamed (required container missing) | `theo-gate.cjs` per-read reader | drift: theo_shape_changed (top-level key names recorded) | "Theo's answer shape changed; nothing from it is shown" | D6 |
| Newer or older contract version | `theoCapabilities` window check | drift: theo_version_unsupported and scope: not_scoped | "Theo speaks contract N; this plugin speaks 1; asked for the lens only" | D7 |
| No contract published | `theoCapabilities` | scope: not_scoped | "Theo answered for the lens, not for this nest" (today's sentence, `theo-face` line seen in M8) | D8 |
| Echo mismatch (section or job) | `theo-gate.cjs` echo check | scope: mismatch; scoped rows dropped | "Theo's answer named a different section; set aside" | D9 |
| Stale echo (request_id) or moved basis | `theo-gate.cjs`; `brain-derivation.cjs` at write | scope: stale; rows dropped | "Theo's answer was for an earlier question; set aside" | D10 |
| Thin Wicked coverage (1 chapter) | reader: coverage.matched <= 1 | qualifier: thin_coverage | "Theo's graph covers this lens thinly (1 of 33 chapters); this room's own sources lead" | D11 |
| Quarantined Theo | isError with CODE token | refusal_code QUARANTINED; all reads refused -> not_asked: theo_unavailable | "Theo is up but not serving (QUARANTINED)" | D12 |
| Proof failure on the plain form | `theo-gate.cjs` pre-classify | not_asked: egress_blocked | "not asked: the question named something from this room" | D13 |

The floor guarantee is a test: in every arm D1-D13, `composeNextMove` still yields a primary for the nest and the face carries one typed line. Never blank, never "(no signal)". This extends the M9 run into a test.

#### 8(g) The doctor check that fails on a bypass, and today's call sites

Measured census (non-test files under lib, scripts, hooks, commands, bin; `.next/dist` bundles excluded):

| Kind | Sites | Must move? |
|---|---|---|
| Raw HTTP to Theo | `lib/core/brain-client.cjs` (`fetch` at :289 initialize and :503 tools/call); `scripts/probe-brain-contract.cjs:101` (its own local `callTool` at :175); `scripts/build-brain-census.cjs:274`, `:314` | brain-client is the transport (allowed). The two dev scripts are release-time probes that send fixed strings and empty payloads: allowlist with a reason (WARN), never on a user path |
| Direct `callTool(` callers outside brain-client | lib: `ambient-run.cjs:87`, `brain-prewarm.cjs:115`, `doctor/class-m-brain-smoke.cjs:245`, `dominant-design/theo-structure.cjs:258`, `feyminto/theo-ask.cjs:274`, `research-planner/canon-release.cjs:404`, `research-planner/sr-steps.cjs:87`, `strategy/taxonomy-climb.cjs:157`, `verification-stamp.cjs:438`; scripts: `capture-355-theo-responses.cjs:206`, `refresh-framework-names.cjs:236` | only the contracted reads must move (below); the rest stay on callTool's belt (R1) |
| Files that require brain-client | 52 (including brain-client itself and `commands/hat-briefing.md`) | none; they use non-contracted wrappers |
| Contracted read names at a call | `theo-ask.cjs` plan array `:258-262` (all four); `brain-client.cjs` `recommendChain` (`'recommend_chain'` literal, 2 lines) called from `lib/brain/chain-recommender.cjs`, `lib/core/research-planner/sr-steps.cjs`, `lib/mcp/brain-composition-census.cjs`; `refresh-framework-names.cjs:236` (`command_neighborhood`) | **theo-ask: move** (it becomes a composer over theoRead). **brain-client recommendChain: allowlist** as "legacy unscoped, never carries a nest key" until a later plan, because one caller is the frozen 369.2 file sr-steps.cjs. **refresh-framework-names: move** in item 5's plan, or allowlist as dev-time |
| Name mentions that are not calls | `theo-face.cjs` (labels), `part8-egress-guard.cjs` (proof arms), `commands/pws-brain.md` (prose) | none; the check matches call shapes, not bare strings |

The check: `lib/core/doctor/theo-call-sites-module.cjs` (new), registered in `data/doctor-modules.json` (cadence always, check-only), plus the same scan as `tests/test-theo-call-sites.cjs` in the phase aggregator so it fails at commit, not only in doctor. It FAILS when:
1. A file outside `brain-client.cjs` and the allowlist posts to the Theo origin. Pattern: `fetch(` within a file that names `BRAIN_URL`, `/mcp`, `getBrainUrl()` or the theo-mcp origin.
2. A contracted read name appears at a call shape outside `theo-gate.cjs` and the allowlist. Call shapes: `callTool\(\s*['"]<read>`, `read:\s*['"]<read>`, `recommendChain\(`.
3. A nest key (`section_kind`, `job_id`, `request_id`) appears in an object literal sent to `callTool` outside `theo-gate.cjs`.

Each allowlist entry carries `{file, reason, until_plan}`. An entry whose file no longer matches is itself a failure, so the list cannot rot.

#### 8(h) What it enforces and what it only warns

| Rule | Enforce or warn | Where | Test arm |
|---|---|---|---|
| Exact key set and closed vocabulary proven before send | ENFORCE (refuse the send) | theo-gate pre-classify | E1, E2 |
| request_id is a fresh lowercase UUID v4 per read, never numeric, never derived | ENFORCE | theo-gate | E3, E4 |
| Nest form only inside the negotiated contract window | ENFORCE (send plain + reason) | theoCapabilities | E5, D7, D8 |
| Echo matches the nonce | ENFORCE (drop rows + reason) | theo-gate | E6, D9, D10 |
| Required response container present | ENFORCE (theo_shape_changed, not 0) | per-read reader | D6 |
| isError detected and typed | ENFORCE | theo-gate (needs the R3 marker) | D3, D4, D5, D12 |
| Unknown response fields | TOLERATE (ignored; doctor counts them) | reader | D14 |
| Missing optional fields | TOLERATE (face says "not returned") | reader | D15 |
| Thin coverage | QUALIFY (shown, recorded) | reader | D11 |
| Ambiguous verdict on non-contracted tools | WARN (unchanged Option A) | brain-client `:465-472` | existing PB arms |
| Theo build sha or sync_drift beyond threshold | WARN | doctor (item 5) | S3 |
| Contracted read outside theo-gate | FAIL (doctor and commit test) | theo-call-sites module | C1-C4 |
| Raw Theo HTTP outside brain-client | FAIL, or WARN for allowlisted dev scripts | theo-call-sites module | C5, C6 |
| The floor always yields a primary | ENFORCE by test | next-move | F1 (over D1-D13) |

**Part 8 status.** Compliant, and stricter than today: it closes the "ambiguous proceeds" path for contracted reads. Request ids are random. Discovery calls carry no arguments.
**Part 9 status.** Compliant. No room.db table. The nonce map is in memory. The face's new frontmatter keys (`theo_request_ids`, `question_basis`, `scope_state`, `drift_reasons`, `qualifiers`) are generated face fields (`theo-face.cjs:432` "every field on this face is generated"). The capability cache is in-process machine state.

**Files.**
- New: `lib/core/theo-gate.cjs`, `lib/core/doctor/theo-call-sites-module.cjs`, `tests/test-theo-gate.cjs` (arms E1-E8, D1-D15, F1), `tests/test-theo-call-sites.cjs` (C1-C6).
- Edit:
  - `lib/core/feyminto/theo-ask.cjs` (composer over theoRead; NOT_ASKED unchanged);
  - `lib/core/brain-client.cjs` (R3: an additive `theo_tool_error: true` field on the `{text}` object returned at `:622-624` when `parsed.result.isError === true`, the same additive idiom as `_attachEgressDisclosure` at `:371`; no change to null, sentinels or shapes);
  - `lib/core/feyminto/theo-face.cjs` (one typed line per reason set; the "refusals: none" sentence uses refusal codes);
  - `lib/core/feyminto/room-read.cjs` (report prints drift, scope and qualifier lines);
  - `lib/core/brain-derivation.cjs` (`askForNest` `:532-553` passes ctx; write-time basis check; frontmatter keys);
  - `data/brain-surface-contract.json` (`feyminto_reads` gains `theo_health`, `nest_contract {min,max}`);
  - `data/doctor-modules.json`;
  - `tests/test-36925-theo-ask.cjs` (H1-H4, Q1-Q7, S1 stay green; Q5 extended so no result carries a silent 0);
  - `lib/core/brain-client.test` or the existing 254 arms (a new arm for the additive marker);
  - `CHANGELOG.md`.

**Depends on.** Nothing upstream. The `data/doctor-modules.json` edit must come after 369.2-26, which also edits that file (wave 11).
**Risk.**
- Medium. The brain-client marker (R3) touches the file plan 05 kept untouched; it is additive and needs one regression run of the ~82 degradation tests.
- Text-prefix detection of `Input validation error` and `Tool ... not found` depends on MCP SDK wording. Mitigation: pin both strings from Theo's SDK version in `tests/test-361-theo-parity.cjs`, so an SDK upgrade on Theo's side reddens a test instead of silently passing.

**Effort.** 3 plans:
- 8a: the reader, the isError marker, the reason sets and the theoRead core with askTheoForNest migrated, plain reads only.
- 8b: the capabilities, version window and echo machinery, built dark until item 1.
- 8c: the call-site doctor check and the commit test.

**Ruling.** Needed: R1, R2, R3, R5.

### Rank 2. Item 3: a real-room leg that actually asks Theo

**Goal.** A live leg where nests have handles in play, read by a human, with a recorded receipt. The offline leg stays offline and sends nothing.

**Wave 1 (the first live ask; no frozen file touched).**
- Fixture: add frontmatter to two committed artifacts, the navigator choosing the handles (both are exact members of `data/framework-names.json`, measured):
  - `tests/fixtures/release-room/sections/problem-definition/spoilage-before-the-stall/spoilage-before-the-stall.md`: `frameworks: [Root Cause Analysis]` (framework_index -> `/mos:causal`, `/mos:root-cause`).
  - `tests/fixtures/release-room/sections/strategy/passive-cooling-encoding/passive-cooling-encoding.md`: `frameworks: [Systems Thinking]` (-> `/mos:analyze-systems`, `/mos:systems-thinking`).
  - `frameworksInPlay` (`brain-derivation.cjs:478-498`) scans a nest and its first-level subfolders, so these two nests get handles and nothing else changes.
- The live run: `node scripts/real-room-run.cjs --read-by "<name>"`, run by the navigator only, calls `feymintoLeg(room, {offline:false})` (`real-room-run.cjs:669`, `room-read.cjs:81-103`), which derives each nest.
  - With rank 1 in place, the two nests send one `framework_neighborhood` each, through `theoRead`.
  - The receipt already records `feyminto.nests[{nest, asked, not_asked_reason, frameworks_named, commands_runnable_here}]` (`real-room-run.cjs:625`).
- Offline: `--offline` takes the `feymintoLeg` offline branch (`room-read.cjs:83-87`), which asks nothing and writes nothing (measured in 369.25 CLOSE).
- Risk to check in the plan: 369.2 closure tests (369.2-33) run on this fixture. I found no planner code reading artifact frontmatter for search terms (grep of `lib/core/research-planner/*.cjs`: frontmatter appears only in the filing modules). The plan still runs `tests/test-muy-real-room-rule.cjs` and `tests/run-all-3692.sh` before and after. If they move, the frontmatter goes into a separate seed in wave 2 instead.

**Wave 2 (problem type and the Theo receipt key; after 369.2-32).**
- Fixture: a third seed directory, `tests/fixtures/release-room-theo/` in the release-room layout. 369.2-32 adds multi-`--seed` and one receipt per sha with a `rooms` array. Its `seed.json` gains `"goal": { "rung": "Wicked", "set_by": "release-fixture" }`, applied in `buildRoom` through `lib/hmi/jtbd-state.cjs setGoal` (the one goal writer). The navigator approves the committed rung at the plan's checkpoint. Wicked is chosen deliberately so the thin-coverage path (D11) is exercised live.
- Problem-type rule (R4): `nestHandles` sends a problem type only when `goal.rung` is a Theo id and `goal.set_by` is `gate_answer` (a person answered a card) or `release-fixture` (only in a room whose slug starts `release-fixture-`). The MINTO-computed lens is no longer sent; it stays a local label.
- Receipt gains a `theo` key (counts and codes only, no Theo rows or text):
  `theo: { contract: {min, max, theo_version|null, source}, theo_build_sha|null, nests: [{nest, outcome, not_asked|null, scope_state|null, drift: [codes], qualifiers: [codes], reads: {<read>: {rows: n, refusal_code|null}}, echo_ok|null}], silent: <count> }`.
- RULE 10 treatment (R7):
  - **Advisory on Theo availability.** Theo down prints a loud WARN, because the floor is the product and a Theo outage must not block a plugin fix.
  - **Blocking on silence.** `scripts/release-lib/real-room-gate.sh` gains `THEO_SILENT`: it refuses a receipt in which any nest reads asked with 0 rows on every read and no reason from any set. That is exactly the M1-M3 lie.
  - The negative leg is unchanged.

**Files.**
- Wave 1: the 2 fixture artifacts, `tests/test-36925-room-read.cjs` (a new arm RR-L1 that a stubbed live leg asks exactly 2 nests with 1 read each and 9 nests read `no_handle_to_send`).
- Wave 2:
  - new `tests/fixtures/release-room-theo/`;
  - edit `scripts/real-room-run.cjs` (seed goal, `theo` receipt key);
  - edit `lib/core/feyminto/theo-ask.cjs` (R4 rule);
  - edit `scripts/release-lib/real-room-gate.sh`;
  - edit `tests/test-muy-real-room-rule.cjs` (new arms G15 THEO_SILENT refuses, G16 Theo-down WARN passes, G17 offline sends nothing);
  - edit `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 10 (one bullet).

**Depends on.** Rank 1 (8a) for both waves. Wave 2 also depends on 369.2-16 and 369.2-32, the plans that edit `scripts/real-room-run.cjs`, and on R4.
**Risk.** Low for wave 1, medium for wave 2 (it touches the release gate).
**Effort.** 2 plans (one per wave).
**Ruling.** R4 and R7 for wave 2. Wave 1 needs only the navigator to pick the two handles.

### Rank 3. Item 2 + item 9(5): the contract test and the drift check

**Goal.** Pin the Theo-facing surface in one test, and catch Theo drift before a cut, with CI never calling Theo.

- **Recorded fixture (CI).** `tests/fixtures/theo-surface/` (new) holds:
  - `tools-list.trimmed.json`: for each contracted read plus `command_neighborhood` and `theo_health`, only `name`, `required`, property keys, `additionalProperties`, enums and patterns. Descriptions are dropped (Brain IP: the descriptions are teaching prose).
  - `theo-health.trimmed.json`: the key names, plus the contract field once Theo ships it.
  - `envelopes/*.json`: stub envelopes per read in Theo's real `toToolResult` shape (`{content:[{type:'text',text}], structuredContent}`) and `toToolError` shape (`{content, isError:true}`), from Theo `src/mcp/to-tool-result.ts:118-176`.
  - The first copy is cut from the 2026-10-05 recording (M13).
- **Contract test** `tests/test-theo-contract.cjs` (new), arms:
  - K1: the four reads sent, with exact key sets equal to `feyminto_reads`.
  - K2: the nest block, with exact keys equal to Theo's published contract (written once Theo publishes; refuses partial blocks and extras).
  - K3: echo handling against the stub envelope.
  - K4: the stub envelopes parse through theoRead to answered, or to the expected typed reason.
  - K5, the drift check: the fixture's `nest_contract` version and each contracted read's input schema equal what `feyminto_reads` pins. A difference fails with the field named.
  - K6: no description text is in the fixture.
  - The degraded-mode matrix arms D1-D15 (rank 1) run against these envelopes.
- **Live drift check (opt-in, never CI).** Extend `scripts/probe-brain-contract.cjs`, the existing live release probe that already does tools/list (`:256-269`) and diffs against `brain-surface-contract.json`. Add a leg e that diffs the live contracted-read schemas and `theo_health`'s contract field against `feyminto_reads` and the fixture, and prints the diff. Also expose it as `node scripts/doctor.cjs --theo-drift --live`, which refuses without `--live`. Canon Part 7: reuse the probe, do not build a second one.
- **What Canon Part 8 allows for this read.** `tools/list` and `theo_health` carry no arguments: no room byte can be in them, and `classify` proves `theo_health {}` as `empty_payload` (M10). The live probe uses its own raw fetch today (`probe-brain-contract.cjs:101`), and that is acceptable only because it sends fixed probe strings from a dev-time script. It is allowlisted in 8(g) with that reason. If it moves into doctor (a product surface), it must go through a guarded `listTools()` in brain-client that runs `classify({}, {toolName:'tools/list'})` first.

**Files.** New: the fixture directory, `tests/test-theo-contract.cjs`. Edit: `scripts/probe-brain-contract.cjs`, `scripts/doctor.cjs` (flag), `data/brain-surface-contract.json` (pins), `tests/test-247-contract-client.cjs` (still pins 7 `loop_tools`; a new arm says `feyminto_reads` is documentary plus nest pins), `tests/test-361-theo-parity.cjs` (pin the SDK refusal prefixes and Theo's request_id pattern).
**Depends on.** Rank 1 (theoRead) for K3, K4 and D-arms. K2 needs Theo's published nest contract.
**Risk.** Low. **Effort.** 1 plan. **Ruling.** None beyond R12 and R13 (Theo-side choices).

### Rank 4. Item 1: the nest-scoped ask

**Goal.** Ask Theo about this nest, not just this lens, safely.

What it adds (the design is g9w 1.2-1.7, unchanged except where noted):
- **Guard arms**: `_proveNestBlock(payload)` beside `_isKnownFrameworkHandle` in `lib/core/part8-egress-guard.cjs`. The nest form is added inside the three existing arms (`:576-597`) before each `return null`.
  - problem_type is in `TAXONOMY_RUNGS` (`:363`) only.
  - section_kind is an own key of `data/section-job-canon.json` sections, read at call time, matching `RELEASE_SECTION_RE` (`:642`).
  - job_id must equal the section's primary job.
  - request_id is UUID v4 via `_isSafeShortLabel`.
  - No nest form on framework_neighborhood.
  - **Wire layout:** flat keys or a nested object. Theo said "optional strict object". Pin whichever Theo publishes (R13).
- **theo-ask/theo-gate**: the nest form only through `theoRead` with an in-window contract (8b). One fresh UUID per read. The nonce map is keyed to `question_basis`, the `recordBasis` hash over `MINTO.md, FEYNMAN.md, CONTEXT.md, ROOM.md` (brief INPUT_FILES minus BRAIN.md; `brief.cjs:54`, `:234-254`). That avoids the circularity g9w found (R6).
- **Exported symbols.** brief.cjs: `questionBasis(sectionPath, identity)`. theo-gate.cjs: `SCOPE_FALLBACK`, `SCOPE_FALLBACK_LINES`. part8-egress-guard: `_proveNestBlock` (internal; exported for the test).
- **Tests.**
  - `tests/test-36925-theo-ask.cjs` (or the new phase test): N1-N11 from g9w 1.7.
  - `lib/core/part8-egress-guard.test.cjs`: G5a-G5m, with G1-G3, G4a-G4d and PB8 kept green.
  - `tests/test-36925-theo-face.cjs`: F12 becomes conditional; a new F17 for the scope line.
  - `tests/test-36925-theo-wiring.cjs`: T2 canaries for room_id, brief_fingerprint and question_basis.

**Files.** Edit `lib/core/part8-egress-guard.cjs`, `lib/core/theo-gate.cjs`, `lib/core/feyminto/theo-ask.cjs`, `lib/core/feyminto/brief.cjs`, `lib/core/brain-derivation.cjs`, `lib/core/feyminto/theo-face.cjs`, `data/brain-surface-contract.json`, plus the tests above.
**Depends on.**
- Rank 1 (8b, 8c), rank 3 K2.
- Theo publishing the nest contract version (Theo's commitment).
- R6 and R13.
- `data/section-job-canon.json` is unratified (`ratified_by`/`ratified_at` null, g9w), so a navigator ratification should precede sending job_id on the wire. Otherwise the plugin sends an unratified mapping as fact.

**Risk.** Medium: the guard is the constitutional boundary. Every new arm must be exact-key-set and fail closed.
**Effort.** 2 plans (guard arms; theo-ask, theo-gate and face wiring).
**Ruling.** R5, R6, R13, and canon ratification.

### Rank 5. Item 5: sync health in the other direction, and the release order written down

**Goal.** Before a cut, compare what the plugin registry says with what Theo's graph reports, and write the agreed release order into the ceremony.

- **Doctor module** `lib/core/doctor/theo-sync-health-module.cjs` (new). It is read-only and goes through `theoRead` only (8g). Offline by default against the recorded fixture; `--theo-sync --live` is opt-in.
- **Reads, with their Part 8 status:**

  | Read | Calls | Part 8 status today | Needs |
  |---|---|---|---|
  | `theo_health {}` (`sync_drift.canon_stamps`, `materiality`, `finding`, `build_stamp`) | 1 | allow / empty_payload (M10) | nothing |
  | `commands_for_problem_type {problem_type}` x 4 problem types | 4 | allow / known_tool_shape (M10) | nothing |
  | `command_neighborhood {command}` per framework-bearing command (50 per g9w; 114 if all) | 50 to 114 | ambiguous (M10) | a new guard arm: exact key `command`, Theo's pattern `^/mos:[a-z0-9-]{2,64}$` (M13 fixture) and exact registry membership. A command slug is plugin vocabulary, not room content. |

- **Compared:**
  - the set of commands Theo can name (via commands_for_problem_type) against the registry's framework-bearing commands;
  - `jtbdLabel` against the registry `jtbd_label`;
  - recipe membership (`command_neighborhood` `recipe/stepIndex`) against the registry `curated_chains` (23 entries measured; Theo's own source comment says 18 at `command-neighborhood.ts:132`, which may be a stale comment, so this is exactly the drift the module should settle live);
  - `help_jtbd` and the full `serves_jtbd`, skipped until item 6 ships and Theo syncs them.
- **Output:** each drift is a WARN line. FAIL only when Theo names a command the registry no longer has (a ghost), because the face would then offer a non-command.
- **Release order, written into RULE 10** as a new bullet "The Theo sync order" in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`. RULE 10 is the real-room rule, and RULE 5 is the single home of the lockstep count, which this order does not change. The exact steps for a registry-changing cut:
  1. `node scripts/release-cut-listener.cjs theo` run standalone, before anything else. If it says STOP-WITH-ACTION, run Theo's printed apply line once, then the printed verify line, then the follow-on `node scripts/refresh-framework-names.cjs --live`, then `node ui/mindrian-workspace-mod/scripts/sync-assets.cjs` so the workspace copy follows. Measured today: after 503d0cb86 the copy differs and `tests/test-369.26-registry-sync.cjs` reads 7 passed, 1 failed. Commit `data/framework-names.json` and the asset copy together.
  2. Re-run `node scripts/release-cut-listener.cjs theo`; it must say CONTINUE (already verified).
  3. Optional: `node scripts/doctor.cjs --theo-sync --live` reads no FAIL.
  4. On the resulting final sha, `node scripts/real-room-run.cjs --read-by "<name>"`. Any later commit invalidates the receipt, which is keyed by the full HEAD sha.
  5. `bash scripts/release.sh --prerelease --allow-ahead`. Its Step 0.55 listener answers already-verified, and Step 2.6 finds the receipt for HEAD.
- Test: `tests/test-muy-real-room-rule.cjs` gains G10e, which pins the five steps in order in RULE 10 and in `.claude/includes/release-process.md`.

**Files.**
- New: the module, `tests/test-theo-sync-health.cjs` (arms S1 offline against the fixture with no network; S2 ghost command FAIL; S3 sync_drift beyond-threshold WARN; S4 command_neighborhood arm allow and refuse; S5 the module passes the call-site check).
- Edit: `lib/core/part8-egress-guard.cjs` (the command_neighborhood arm, with G6a-G6d), `data/doctor-modules.json`, `scripts/doctor.cjs` (flag), `scripts/refresh-framework-names.cjs` (moves to theoRead), `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`, `.claude/includes/release-process.md`, `tests/test-muy-real-room-rule.cjs`.

**Depends on.** Rank 1 and rank 3. The doctor-modules.json edit comes after 369.2-26.
**Risk.** Low. Live mode costs 55 to 119 calls, so opt-in only.
**Effort.** 2 plans (module and arm; the ceremony text and test).
**Ruling.** R10, and R14 for where the order lives.

### Rank 6. Item 4: suggest, gate, run

**Goal.** A Theo pick runs as the named command, a cross-room move gets a card, and a command that cannot run here says so.

- **Interim behavior, until ruled, so this is safe today.**
  - The face and BRIEF present a Theo command pick as a CLI slash command with its capability label (`capability.cjs:121-151`).
  - On MCP, an instruction-only pick says "run this on the CLI".
  - No Theo pick is ever routed through `chain_resolve` or `chain_run`. Those take framework names (`chain.cjs:932`, `:948`), and g9w measured that 21 of 50 framework-bearing commands come back as a sibling.
  - No Theo pick ever triggers `room_bind`.
- **The command door (R8, a Part 11 surface change).**
  - `resolveCommand(name)` in `lib/workflow/command-resolver.cjs` (exports at `:263-270` today have no such function). It returns the registry row or a typed refusal: `unknown_command`, `internal_surface`, `not_routed_here`, `not_executed_here`.
  - A `commands: string[]` alternative to `chain_run`'s input, with the hitl shape unchanged.
  - chain_run's halt card refuses a step whose command is null as `unknown_command`, instead of offering to approve it (g9w 2b).
- **Switch-or-Stay (R9).**
  - `room_bind` gains an optional `switch_gate_id` (`lib/mcp/tool-router.cjs:2219-2224`). It refuses `needs_switch_card` only when suggest_next holds a pending cross-room recommendation for that room and no approved switch card is presented.
  - The person's own "bind X" and the session-start bind stay one step.
  - It is enforced server-side because Desktop runs no hooks.
  - A new switch card kind lives in `lib/mcp/gate-render.cjs` (options `switch` and `stay`, header naming the command and both rooms).
- **Honest marking.**
  - `composeNextMove` counts dropped ghost names (`next-move.cjs:148`, which drops them silently today) into `provenance.dropped_unknown`.
  - The face prints "Theo named N commands this install does not have".
  - Capability labels are reused from `capability.cjs`; nothing new is built.
- **Tests.** New `tests/test-<P>-resolve-command.cjs` (RC1-RC6: each refusal, an exact-name run, no sibling laundering), `tests/test-<P>-switch-card.cjs` (SW1-SW6: a cross-room pick needs the card, an own bind does not, the session-start bind does not, an open card in the old room must be named first, Desktop server-side refusal, the return switch needs the card), `tests/test-<P>-ghost-names.cjs` (GH1-GH3).

**Files.** Edit `lib/workflow/command-resolver.cjs`, `lib/mcp/tools/chain.cjs`, `lib/core/chain-step-dispatcher.cjs`, `lib/mcp/tool-router.cjs`, `lib/mcp/gate-render.cjs`, `lib/mcp/tools/sensors.cjs` (pending cross-room recommendation), `lib/core/feyminto/next-move.cjs`, `lib/core/feyminto/theo-face.cjs`, the connector and orchestration projections (`build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`).
**Depends on.** R8 and R9. Independent of Theo.
**Risk.** Medium-high: Part 11 surface changes and the born-wired gate.
**Effort.** 3 plans (door; switch card; honest marking).
**Ruling.** R8, R9.

### Rank 7. Item 6: registry carry of help_jtbd and the full serves_jtbd

**Goal.** Give Theo's later sync the fields it promised to store.

- **Measured premise.** The registry already carries the full `serves_jtbd` in 114 of 114 rows (lengths 1:75, 2:37, 3:2). It lacks `help_jtbd`: 0 rows, though all 114 command files declare it.
- **Generator** `scripts/build-command-registry.cjs`: the row push (g9w: `:378-396`) gains `help_jtbd` (string, from frontmatter) and the derived arrays `jtbd_labels` and `jtbd_summaries`, null where an id has no taxonomy entry. The scalar `jtbd_label` and `jtbd_summary` stay unchanged, because Theo, the ranker and the irreversibility ledger read them.
- **Taxonomy** `lib/hmi/jtbd-taxonomy.json`: add `build`, `navigate` and `temporal-correction`, inserted before `explore` (which stays last), each with the 8 required fields.
  - `tests/test-command-jtbd-declarations.cjs` goes from exit 1 (5 violations, re-measured) to green, with its "13-id" wording re-worded.
  - `tests/test-jtbd-taxonomy.cjs` is re-pinned 13 -> 16.
  - `tests/test-command-jtbd-coverage.cjs` stays green, provided the four canon extension jobs are NOT added.
- **Irreversibility ledger.** The staleness hash covers `[command, teaching, jtbd_summary]`, so the 4 commands whose `jtbd_summary` goes from null to text (correct-reference-now, ingest-methodology, memory-cortex-reach, stance) go stale until re-scored. The builder WARNs on a moved `registry_hash` (g9w). Re-score in the same plan.
- **Also moves.**
  - `_releaseIntentVocabulary` (`part8-egress-guard.cjs:646-655`) widens by 3 ids.
  - The jtbd-classifier and f-selector ranker need a regression run.
  - `tests/test-369.26-registry-sync.cjs` needs the workspace asset re-sync (jsagi-1c's directory, so coordinate).
- **What must wait.** All of this regenerates `data/command-registry.json` and moves its sha off the beta.63 snapshot Theo applied. So it lands in a cut at beta.65 or later, through the rank 5 release order: Theo's listener step first, then the real-room run, then the cut. Theo then adds `help_jtbd` and the full `serves_jtbd` to MindrianCommand at its next sync.

**Files.** Edit `scripts/build-command-registry.cjs`, `lib/hmi/jtbd-taxonomy.json`, `data/command-registry.json` (generated), `data/command-irreversibility-ledger.json` (re-score), `tests/test-jtbd-taxonomy.cjs`, `tests/test-command-jtbd-declarations.cjs`, `CHANGELOG.md`. Coordinated: `ui/mindrian-workspace-mod/assets/command-registry.json`.
**Depends on.** The beta.65 cut window and rank 5's order. Independent of ranks 1-4.
**Risk.** Medium: the registry sha is load-bearing for Theo, the UI copy and the ledger.
**Effort.** 1 plan.
**Ruling.** None new; the cut timing is the navigator's.

---

## Theo's commitments: what the plugin assumes, and what it still defends against

| Theo commitment | The plugin assumes | The plugin still defends against (if broken) | Defense |
|---|---|---|---|
| Additive-only changes inside a contract version | new response fields within version N are safe to ignore | a field renamed or removed inside N | tolerant reader: required container missing -> theo_shape_changed (D6) |
| A published contract version number | the version arrives by stamp or theo_health | no version published, or a wrong one | absent -> not_scoped (D8); out of window -> theo_version_unsupported (D7) |
| Unscoped calls kept compatible | the plain form always works | a plain-form strict refusal | theo_shape_changed on the plain read, floor carries (D4) |
| A deprecation notice window before removal | a tool is not removed without notice | a tool removed with no notice | theo_tool_missing on first use, marked for the process (D5); the live drift check shows it before a cut |
| Echo request_id unchanged, UUID v4 | the echo equals the sent id | an echo dropped or altered | not_scoped or stale, rows dropped (D9, D10) |
| No room_id or brief_fingerprint on the wire | Theo never asks for them | the plugin itself drifting | arm E8 canaries; the guard refuses extra keys |
| problem_type only as an explicit value | Theo never infers one | the plugin sending a computed lens | R4 rule plus arm N7 |

---

## Rulings needed

| # | Question | My recommendation | If deferred |
|---|---|---|---|
| R1 | Does the enforcer cover every Theo call, or only the contracted reads? | Contracted reads only, with a ratchet: the doctor check lists the allowlist, and every other read stays on callTool's belt. Moving all ~16 wrappers is a separate phase with its own canary suite (the Phase 254 Option B argument). | Rank 1 cannot start; no live ask is safe (M1-M3) |
| R2 | On a contracted read, refuse an unproven (ambiguous) shape instead of proceeding? | Yes: refuse at theoRead; leave callTool Option A for everything else | the nest form could leave on a drifted shape once item 1 lands |
| R3 | Add an additive `theo_tool_error` marker to brain-client's `{text}` return when Theo sets `isError`? | Yes: additive field, the `_attachEgressDisclosure` idiom; null and sentinels unchanged | refusals are only guessable by text, and the plain `{text}` path stays a silent 0 |
| R4 | Where may a problem type come from? | Only a navigator-confirmed `goal.rung` (`set_by: gate_answer`), or `release-fixture` in a release fixture room; never the MINTO-computed lens | only framework_neighborhood reads go live (wave 1 still works) |
| R5 | One closed reason set, or siblings? | Keep NOT_ASKED as the closed six; add SCOPE_FALLBACK (3), THEO_DRIFT (3) and QUALIFIERS (1) as siblings | an asked face could mis-tier as tier 0 (`brain-derivation.cjs:577`, `:723`) |
| R6 | Does "brief_fingerprint" mean the question basis (brief inputs minus BRAIN.md)? | Yes; name it `question_basis` | the scoped answer would read stale forever (circular hash) |
| R7 | How does RULE 10 treat a live Theo leg? | A new receipt key `theo`; Theo down is a WARN; a silent asked nest is a refusal (`THEO_SILENT`) | live asks ship with no human-read proof that the face is honest |
| R8 | Add `resolveCommand(name)` and a `commands` input on chain_run (Part 11)? | Yes, with typed refusals; the interim rule (CLI slash command, never chain_run) holds until then | Theo picks stay host-dispatched only; no MCP run |
| R9 | Gate a cross-room switch with a Switch-or-Stay card on room_bind? | Yes, `switch_gate_id`, enforced server-side, only for recommendation-driven switches | a Theo-guided switch moves every later write with no card |
| R10 | Allow an opt-in live sync-health doctor and a `command_neighborhood` guard arm? | Yes, opt-in `--live`, offline against the fixture by default | drift is found only when Theo's listener step refuses |
| R11 | Capability discovery: tools/list at runtime? | No. Learn the version from a response stamp, or theo_health once per process; detect tools lazily; tools/list only in the opt-in drift check | each process pays about 82.7 KB for nothing |
| R12 | Version negotiation shape (Theo-side ask) | Theo publishes `nest_contract {version, accepts[]}` in theo_health and stamps responses; the plugin pins `{min, max}` in `feyminto_reads` | the window check can only compare one number |
| R13 | Nest block wire layout: flat keys or a nested strict object (Theo-side) | Whatever Theo publishes; the guard arm and K2 pin it exactly | item 1 cannot write its guard arm |
| R14 | Where does the release order live? | A RULE 10 bullet (RULE 5 is the lockstep-count home and this carries no version) | the order lives only in peer-session notes |
| R15 | Ratify `data/section-job-canon.json` before job_id goes on the wire? | Yes (12 sections, 9 jobs; `ratified_by` null) | the plugin sends an unratified mapping as fact |

---

## What must stay frozen

- **The beta.63 registry snapshot.** `data/command-registry.json` must keep sha256 39a771cc6375c7f1... (equal to tag 563c242623f0 today, measured) until a beta.65-or-later cut through the rank 5 order. That keeps item 6 out of everything before it. Nothing in ranks 1-6 regenerates the registry.
- **The 369.2 chain.** These files may be edited only by the plans named, and any proposal touching them is sequenced after those plans:
  - `lib/core/research-planner/*`: open plans 369.2-15 through 24, 27, 28 and 30 (waves 8-17). **No plan here edits them.** The rank 1 allowlist leaves `sr-steps.cjs` (`recommendChain`) on callTool for exactly this reason.
  - `scripts/research-planner.cjs`: 369.2-27. Not touched here.
  - `scripts/real-room-run.cjs`: 369.2-16 (wave 9) and 369.2-32 (wave 15). **Rank 2 wave 2 is sequenced after 369.2-32.** Rank 2 wave 1 does not touch it.
  - `data/doctor-modules.json`: 369.2-26 (wave 11). Ranks 1, 3 and 5 add rows only after it lands.
  - `tests/fixtures/release-room-seed118/`: 369.2-31. Not touched. Rank 2 wave 2 adds a separate seed.
  - `tests/fixtures/release-room/` is in no open 369.2 plan's file list, but 369.2-33 drives it. **Flagged:** rank 2 wave 1's frontmatter edit runs the 369.2 closure and muy suites before and after.
- **The jsagi-1c session's files.** `ROADMAP.md`, the 369.26 directory and `ui/mindrian-workspace-mod/*` are read-only here. The rank 5 and rank 7 asset re-sync is named, not done. Note: that copy is already one file behind `data/framework-names.json` (M16).
- **`brain-client.cjs` behavior for non-contracted tools.** Option A is unchanged. The R3 marker is additive only.

---

## Proposed phase shape

Plan count: 14 total, in 5 waves. Each wave's exit is something a person can read.

| Wave | Plans | Exit |
|---|---|---|
| **W1: the first live ask** | 8a (the reader, isError marker, reason sets, theoRead core with askTheoForNest migrated, plain reads only); rank 2 wave 1 (two fixture frontmatter lines, room-read arm RR-L1) | **The navigator runs `node scripts/real-room-run.cjs --read-by "<name>"`.** problem-definition and strategy read "asked" with one framework_neighborhood each (rows, or a typed drift or qualifier line); nine nests read "no handle to send"; with Theo down, the two read "not asked: Theo did not answer" and the floor still names a move. No nest block, no problem type, no frozen file. |
| W2: drift-proof and checked | 8b (capabilities, window, echo, built dark), 8c (call-site doctor check and commit test, after 369.2-26), rank 3 (contract fixture, K and D matrix, probe leg e) | `tests/test-theo-gate.cjs`, `tests/test-theo-contract.cjs` and `tests/test-theo-call-sites.cjs` green; `doctor --theo-drift --live` prints a clean diff |
| W3: problem type and the Theo receipt | rank 2 wave 2 (after 369.2-32, R4, R7) | a live run on the Theo seed shows Wicked reads with `thin_coverage`; the gate refuses a silent receipt |
| W4: the nest-scoped ask | rank 4 (2 plans; needs Theo's published contract, R6, R13, R15) | one nest reads "scoped", with the echo verified on the face |
| W5: sync, run, carry | rank 5 (2), rank 6 (3, after R8 and R9), rank 7 (1, at the beta.65-or-later cut) | the sync-health doctor is clean before a cut; a Theo pick runs as itself on MCP; the registry carries help_jtbd |

Count: W1 2, W2 3, W3 1, W4 2, W5 6. Total 14.

---

## What I could not measure

- **Live Theo.** No Theo call was allowed. The real envelope casing, whether Theo echoes anything, the size and latency of `theo_health`, and live Wicked coverage are not measured. The refusal shapes come from Theo's own source and its SDK 1.30.0 code, reproduced by a stub.
- **Where Theo will publish the contract version, and the nest block layout.** Neither exists in Theo at d30d86c (`health.ts` has no contract field).
- **The size and latency of a live tools/list today.** The 82,760 bytes figure is the 2026-10-05 recording, not today's catalog.
- **Whether the two fixture frontmatter lines move any 369.2 closure leg.** I found no planner code reading artifact frontmatter for search terms, but I did not run `tests/run-all-3692.sh` (369.2 is mid-execution in another session).
- **Whether `goal.rung` writers other than `setGoal` exist with other `set_by` values in shipped rooms.** I read the writer and its default only.
- **The ~82 brain-client degradation tests against the R3 marker.** Not run; the marker is a proposal.
- **The help-coverage-gate Test 7 red (pre-commit wiring).** Seen, not root-caused (outside this scope).
- **Desktop and Cowork rendering of the new face lines and the switch card.** Not checked. The Tri-Polar check belongs in each plan's verification.
