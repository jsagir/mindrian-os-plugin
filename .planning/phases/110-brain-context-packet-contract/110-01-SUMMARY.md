---
phase: 110-brain-context-packet-contract
plan: "01"
subsystem: wire-contract
tags: [wave-1, brain-context-packet, json-schema, ajv, draft-2020-12, canon-part-8, canon-part-9, additionalProperties-false, generated-checked-tripwire]

# Dependency graph
requires:
  - phase: 110-00
    provides: "PACKET-110-01 + PACKET-110-02 registered in REQUIREMENTS.md; the RED stub at tests/test-brain-packet-schema-check.cjs (Plan 110-01 fills the body); the scoped tests/run-all-110.sh runner that flips the schema-check row from RED to GREEN after this plan"
  - phase: 122
    provides: "scripts/build-command-registry.cjs - the verbatim structural template for scripts/build-brain-packet-schema.cjs (generated-checked-with-tripwire pattern, recovery-line-on-stderr, MINDRIAN_*_OVERRIDE env seam idiom mirrors check-schema-aliases.cjs)"
  - phase: 109
    provides: "lib/core/navigation/packet.cjs buildBrainPacket - the live packet shape the schema's $defs mirror; the safe-projection mappers (safeNodeProjection / safeContradictionProjection / safeUnsupportedProjection / safeRecentChangeProjection / surface_banked_opportunities / hsiBand) that the 4 ClaimProjection/ContradictionProjection/UnsupportedProjection/RecentChangeProjection $defs match field-for-field"
provides:
  - "data/brain-packet-schema.json - draft 2020-12 JSON Schema, $id https://mindrian-os.com/schemas/brain-packet/1.0, 12 D-02 job $defs each with in+out shapes, 12 shared $defs (PrivacyMode + Origin enums, FocusNode, ActiveContext, BankedOpportunities, Constraints, 4 safe-projection $defs, LocalGraphSummary, BrainResponse), additionalProperties:false on every object node"
  - "scripts/build-brain-packet-schema.cjs - validator + --check tripwire (mirrors scripts/build-command-registry.cjs); ajv@8.18.0 strict-compile via the Ajv2020 dialect class (still transitive - no new dep); 12-job coverage check; closed-vocabulary check; recursive additionalProperties:false sweep; MINDRIAN_BRAIN_PACKET_SCHEMA env seam"
  - "tests/test-brain-packet-schema-check.cjs - real child_process suite (168 lines, 19 assertions across 6 tests) replacing the Plan 110-00 RED stub"
  - "data/ROOM.md - new row for brain-packet-schema.json + cross-ref to scripts/build-brain-packet-schema.cjs + canon parts updated to 7, 8, 9"
affects: [110-02, 110-03, 110-04, 110-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generated-checked-with-tripwire pattern from Phase 122: artifact in data/ + scripts/build-*.cjs validator with default + --check modes + Recovery: line on stderr + exit 1 on any failure"
    - "ajv@8.18.0 transitive via @modelcontextprotocol/sdk - draft 2020-12 access through Ajv2020 = require('ajv/dist/2020') (no new dep; ajv stays out of package.json per CLAUDE.md)"
    - "MINDRIAN_*_SCHEMA env seam for test fixtures - mirrors check-schema-aliases.cjs MINDRIAN_HOOK_STAGED_CONTENT_DIR / MINDRIAN_HOOK_STAGED_FILES idiom"
    - "Recursive additionalProperties:false walker - assertAdditionalPropsFalse(node, pathStr, errs) traverses $defs, properties, items, allOf/anyOf/oneOf AND the non-standard in/out keys per-job; precise JSON-pointer-style error messages"
    - "Closed-vocabulary $defs validation: every $def name must be either a SHIPPED_JOB or in the SHARED_DEFS allow-list; unknown $def names fail the build"

key-files:
  created:
    - "data/brain-packet-schema.json"
    - "scripts/build-brain-packet-schema.cjs"
  modified:
    - "tests/test-brain-packet-schema-check.cjs (replaced RED stub body, same path)"
    - "data/ROOM.md (added row + cross-ref)"

key-decisions:
  - "Use ajv/dist/2020 (Ajv2020 class) for draft 2020-12 dialect: the default Ajv class from ajv@8.x defaults to draft-07 and refuses to compile the schema with its draft 2020-12 $schema meta-ref. Ajv2020 ships inside the same transitive ajv package as ajv/dist/2020 - no new dep, no second install. The script uses require('ajv/dist/2020').default || require('ajv/dist/2020') to handle both CJS and ESM-default-interop loaders. Verified ajv@8.18.0 resolvable via @modelcontextprotocol/sdk; not in package.json."
  - "Schema names every job $def by its D-02 jobname AS-IS (snake_case, no prefix). The closed-vocabulary check in build-brain-packet-schema.cjs treats SHIPPED_JOBS (12) + SHARED_DEFS (12) as the closed allow-list. Any other $def name fails with 'closed vocabulary violation' - the leak-prevention surface, not just a build-cleanliness check."
  - "Per-job in.required includes ALL 8 fields the live buildBrainPacket emits (packet_version, job, room_stage, origin, privacy_mode, active_context, local_graph_summary, constraints) AND constrains the 3 invariants tightly: packet_version: const '1.0', job: const '<jobname>', privacy_mode: const 'local_summary_only'. The origin field uses $ref to the shared Origin enum (navigation_api or test_fixture) - Phase 110-02 wires buildBrainPacket to stamp it; Phase 110-04 adds the pre-commit hook layer 2; Phase 110-03 adds the brain-client allowlist layer 3 (D-08 three-layer enforcement)."
  - "out shape uniform across all 12 jobs in v1.0: every job's $defs.<job>.out is { $ref: '#/$defs/BrainResponse' }. BrainResponse matches what ingestion.cjs::storeBrainSuggestions reads (job_id, suggestions[], suggestions[].graph_updates_proposed). Future v1.x can tighten per-job out shapes without touching the 12 in-shape contracts."
  - "RecentChangeProjection.id is type:'string' (not the original draft's ['string','integer']) - looked at the live memory-events.cjs logEvent: the eventId is always 'memory_event:' + eventType + ':' + ms + ':' + 8-hex-chars, always a string. Removing the union also cleared an ajv strict-mode complaint (strictTypes: union types need explicit allowUnionTypes opt-in; we keep strict tight so the schema fails LOUD if anything drifts)."
  - "Schema root NOT marked additionalProperties:false: the root carries only $schema/$id/title/description/$defs (none of which are user data) and the root is not itself a 'validation' object with properties. The recursive walker only enforces additionalProperties:false on { type:'object', properties:{...} } nodes - exactly where leaks could happen. Matches the Phase 122 command-registry.json convention."

# Metrics
duration: 11min
completed: 2026-05-13
---

# Phase 110 Plan 01: Brain Context Packet Schema + --check Tripwire Summary

**Wave 1 wire-format contract: `data/brain-packet-schema.json` (draft 2020-12 JSON Schema, 12 D-02 job `$defs` each with `in`+`out` shapes, `additionalProperties:false` everywhere, ajv@8.18.0-strict-compilable), `scripts/build-brain-packet-schema.cjs` (verbatim mirror of `scripts/build-command-registry.cjs` - default run + `--check` tripwire with recovery-line-on-stderr exit-1 on any malformed JSON / missing job `in`/`out` / unknown-job `$def` / missing `additionalProperties:false`), and the real test body filling Plan 110-00's RED stub at `tests/test-brain-packet-schema-check.cjs` (168 lines, 19 assertions across 6 child_process tests via the `MINDRIAN_BRAIN_PACKET_SCHEMA` env seam). The Canon Part 8 leak-prevention surface is now structurally enforced at the wire format (not just procedurally audited) - a packet carrying a stray `transcript` or `body` field is refused at the validator, not stripped-and-sent.**

## Performance

- **Duration:** ~12 min (start 2026-05-13T06:32:34Z; end 2026-05-13T06:44:24Z; 710s wall)
- **Started:** 2026-05-13T06:32:34Z
- **Completed:** 2026-05-13T06:44:24Z
- **Tasks:** 2 (Task 1: ship schema + script + ROOM.md row; Task 2: fill the RED test stub)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

### Task 1 - Schema + script + ROOM.md row (commit `972c000`)

- **`data/brain-packet-schema.json`** (526 lines) - draft 2020-12 JSON Schema:
  - Root: `$schema` https://json-schema.org/draft/2020-12/schema; `$id` https://mindrian-os.com/schemas/brain-packet/1.0; `title`; `description`; `$defs`
  - 12 shared `$defs`: `PrivacyMode` (3-value enum), `Origin` (2-value enum), `FocusNode`, `ActiveContext`, `BankedOpportunities`, `Constraints`, `ClaimProjection`, `ContradictionProjection`, `UnsupportedProjection`, `RecentChangeProjection`, `LocalGraphSummary`, `BrainResponse`
  - 12 per-job `$defs` (D-02 closed vocabulary exact): `select_methodology`, `suggest_next_move`, `detect_contradiction`, `summarize_neighborhood`, `classify_room_budding`, `rank_assumptions`, `generate_feynman_explanation`, `strengthen_minto`, `prepare_investor_brief`, `opportunity_react`, `opportunity_reflect`, `opportunity_rank` - each `{ in: {...}, out: { $ref: '#/$defs/BrainResponse' } }`
  - `additionalProperties: false` on every object node: every shared object `$def`, every job `in` and every nested object inside it (the leak-prevention teeth)
  - Every job `in.required` lists all 8 fields the live `buildBrainPacket` emits + the 2 fields 110-02 will add: `packet_version`, `job`, `room_stage`, `origin`, `privacy_mode`, `active_context`, `local_graph_summary`, `constraints`
  - Constants: `packet_version: { const: '1.0' }`, `job: { const: '<jobname>' }`, `privacy_mode: { const: 'local_summary_only' }`; `origin: { $ref: '#/$defs/Origin' }` (enum: `['navigation_api', 'test_fixture']`)

- **`scripts/build-brain-packet-schema.cjs`** (216 lines, executable mode 0755):
  - Structural mirror of `scripts/build-command-registry.cjs`: `'use strict'` + `require('node:fs')` + `require('node:path')` + `REPO_ROOT`; `SHIPPED_JOBS = Object.freeze([...12...])` + `SHARED_DEFS = new Set([...12...])`; `assertAdditionalPropsFalse(node, pathStr, errs)` recursive walker; `checkSchema(strictBuild)` -> errors[]; `main()` switches on `--check`; `if (require.main === module) main(); else module.exports = { checkSchema, assertAdditionalPropsFalse, SHIPPED_JOBS, SHARED_DEFS }`
  - Validator stack: `JSON.parse` -> ajv@8.18.0 `Ajv2020` strict compile (draft 2020-12 dialect) -> 12-job coverage (each `$def[job]` has `.in` + `.out` + `.in.properties.job.const === job`) -> closed-vocabulary check (every `$def` name is in SHIPPED_JOBS or SHARED_DEFS) -> recursive `additionalProperties:false` walk
  - Recovery line on stderr on any failure: `Recovery: fix data/brain-packet-schema.json (the hand-maintained source of truth), then re-run: node scripts/build-brain-packet-schema.cjs --check`
  - Test seam: `process.env.MINDRIAN_BRAIN_PACKET_SCHEMA` overrides the path (used by Task 2's test suite)
  - Exit codes: 0 on OK, 1 on any failure (matches Phase 122 convention)

- **`data/ROOM.md`** - new row in "Files in this section" table for `brain-packet-schema.json` (validated, not generated - hand-maintained source of truth); new cross-ref for `scripts/build-brain-packet-schema.cjs`; canon parts updated from `[7, 8]` to include Part 9 via the brain-packet-schema mention.

### Task 2 - Real test body (commit `ee6b0d1`)

- **`tests/test-brain-packet-schema-check.cjs`** - replaced the Plan 110-00 RED stub (8 lines, `process.exit(1)` + MISSING line) with a real 168-line `node:assert/strict` + `node:child_process` suite. 19 assertions across 6 tests:
  1. shipped schema passes `--check` (exit 0; stdout matches `/brain-packet-schema: OK/`)
  2. malformed JSON (`{`) -> rejected; stderr matches `/not valid JSON/i` + `/Recovery:/`
  3. empty `{}` -> rejected; stderr matches `/missing \$def for shipped job/` + `/Recovery:/`
  4. `$defs.select_methodology.in` deleted -> rejected; stderr matches `/has no "in"/` or `/select_methodology/` + `/Recovery:/`
  5. unknown-job `$def` (`not_a_real_job`) added -> rejected; stderr matches `/closed vocabulary/` + `/not_a_real_job/` + `/Recovery:/`
  6. `$defs.LocalGraphSummary.additionalProperties` deleted -> rejected; stderr matches `/additionalProperties/` + `/LocalGraphSummary/` + `/Recovery:/`
  - Test seam: `runWithSchema()` helper writes mangled fixture to `fs.mkdtempSync(...)` tmp dir, sets `MINDRIAN_BRAIN_PACKET_SCHEMA` env var, spawns `node SCRIPT --check`, cleans up in `finally`
  - Exit 0 only if every assertion passes; final line `console.log('test-brain-packet-schema-check: PASS (19 assertions across 6 tests)')` is reached only if every `assert/ok/equal/notEqual` above succeeded (they throw on failure -> non-zero exit naturally)

## Task Commits

Each task was committed atomically with `--no-verify` per the parallel_execution rule (concurrent session committing to `main` for Phase 123/124):

1. **Task 1: Ship `data/brain-packet-schema.json` + `scripts/build-brain-packet-schema.cjs` + `data/ROOM.md` row** -- `972c000` (feat)
2. **Task 2: Fill `tests/test-brain-packet-schema-check.cjs` - the --check tripwire suite** -- `ee6b0d1` (test)

## Files Created/Modified

- `data/brain-packet-schema.json` -- CREATED. 526 lines. Draft 2020-12 JSON Schema, the Brain Context Packet wire-format contract.
- `scripts/build-brain-packet-schema.cjs` -- CREATED, mode 0755. 216 lines. Validator + `--check` tripwire mirroring Phase 122's `scripts/build-command-registry.cjs`.
- `data/ROOM.md` -- MODIFIED. Added row for `brain-packet-schema.json` + cross-ref to `scripts/build-brain-packet-schema.cjs` + updated canon parts mention.
- `tests/test-brain-packet-schema-check.cjs` -- MODIFIED in place (RED stub body replaced; path preserved). 168 lines, 19 assertions across 6 tests.

## Verification Receipts

| Check | Command | Expected | Actual |
|---|---|---|---|
| Schema valid JSON + draft 2020-12 ajv strict compile | `node -e "const s=require('./data/brain-packet-schema.json'); const Ajv2020=require('ajv/dist/2020').default||require('ajv/dist/2020'); new Ajv2020({allErrors:true,strict:true}).compile(s);"` | no throw | no throw |
| 12-job coverage + per-job consts + required | (plan verify block - per-job `job.const`, `packet_version.const`, `privacy_mode.const`, `required` includes `origin` + `privacy_mode`) | every job matches | `schema OK` |
| Recursive `additionalProperties:false` | walker in plan verify block | every object node | `schema OK` |
| Origin enum exact | `JSON.stringify(s.$defs.Origin.enum) === '["navigation_api","test_fixture"]'` | match | match |
| Default-run script exit | `node scripts/build-brain-packet-schema.cjs` | rc=0 + 'OK' | rc=0 + 'OK (validated; nothing to regenerate ...)' |
| --check script exit | `node scripts/build-brain-packet-schema.cjs --check` | rc=0 + 'OK' | rc=0 + 'brain-packet-schema: OK' |
| Malformed-JSON tripwire | `MINDRIAN_BRAIN_PACKET_SCHEMA=<bad.json with '{'> node script --check` | rc=1 + 'not valid JSON' + Recovery: | rc=1 + 'not valid JSON: Expected property name ...' + Recovery: |
| Empty-{} tripwire | `MINDRIAN_BRAIN_PACKET_SCHEMA=<empty.json with '{}'> node script --check` | rc=1 + 'missing $def for shipped job' + Recovery: | rc=1 + 12 'missing $def for shipped job' lines + Recovery: |
| Missing-in tripwire | `MINDRIAN_BRAIN_PACKET_SCHEMA=<delete $defs.select_methodology.in> node script --check` | rc=1 + 'no "in"' + Recovery: | rc=1 + '$def "select_methodology" has no "in" sub-schema' + Recovery: |
| Unknown-job tripwire | `MINDRIAN_BRAIN_PACKET_SCHEMA=<add not_a_real_job $def> node script --check` | rc=1 + 'closed vocabulary' + not_a_real_job + Recovery: | rc=1 + '$def "not_a_real_job" is neither a D-02 job nor a known shared def - closed vocabulary violation' + Recovery: |
| Missing-additionalProperties tripwire | `MINDRIAN_BRAIN_PACKET_SCHEMA=<delete $defs.LocalGraphSummary.additionalProperties> node script --check` | rc=1 + 'additionalProperties' + 'LocalGraphSummary' + Recovery: | rc=1 + 'object schema at #/$defs/LocalGraphSummary is missing "additionalProperties": false (Canon Part 8 leak-prevention requirement)' + Recovery: |
| ROOM.md mentions schema | `grep -q "brain-packet-schema.json" data/ROOM.md` | match | match |
| ROOM.md mentions script | `grep -q "build-brain-packet-schema.cjs" data/ROOM.md` | match | match |
| ajv NOT in package.json | `grep '"ajv"' package.json` | no match | no match (grep rc=1) |
| Test exits 0 + PASS line | `node tests/test-brain-packet-schema-check.cjs` | rc=0 + PASS line | rc=0 + 'test-brain-packet-schema-check: PASS (19 assertions across 6 tests)' |
| MISSING line gone | `node tests/test-brain-packet-schema-check.cjs 2>&1 \| grep -q "MISSING - Wave"` | no match | no match (grep rc=1) |
| spawnSync usage | `grep -c "spawnSync" tests/test-brain-packet-schema-check.cjs` | >= 1 | 4 |
| Env seam used | `grep -q "MINDRIAN_BRAIN_PACKET_SCHEMA" tests/test-brain-packet-schema-check.cjs` | match | match |
| Em/en-dash sweep on 4 files | `grep -lP '[\\x{2014}\\x{2013}]' data/brain-packet-schema.json scripts/build-brain-packet-schema.cjs data/ROOM.md tests/test-brain-packet-schema-check.cjs` | no match | no match (grep rc=1) |
| Phase 109 navigation test unaffected | `node tests/test-navigation-packet-builder.cjs` | rc=0 + 10/10 PASS | rc=0 + 'test-navigation-packet-builder: 10/10 passed' |
| Phase 122 command-registry --check unaffected | `node scripts/build-command-registry.cjs --check` | rc=0 + 'command-registry: OK' | rc=0 + 'command-registry: OK' |
| Scoped runner reports our test GREEN | `bash tests/run-all-110.sh` | 1 of 4 PASSED (this plan's stub filled) | 1 of 4 PASSED (test-brain-packet-schema-check.cjs PASSED; the other 3 RED-by-design until Plans 110-04 + 110-05 land) |
| Feynman runner syntax | `node --check lib/memory/run-feynman-tests.cjs` | OK | OK |

All success criteria met.

## Decisions Made

1. **ajv draft 2020-12 dialect access:** the schema uses `$schema: https://json-schema.org/draft/2020-12/schema`, but the default `Ajv` class from `ajv@8.x` defaults to draft-07 and refuses to compile (`Error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"`). Used `ajv/dist/2020` (the `Ajv2020` class) inside the same transitive ajv package. Loader handles both CJS-default and the bare default: `require('ajv/dist/2020').default || require('ajv/dist/2020')`. No new dependency; ajv stays out of `package.json` per CLAUDE.md "What NOT to Use" + verified `grep '"ajv"' package.json` = no match.

2. **Root not additionalProperties:false-tagged:** the root carries `$schema`, `$id`, `title`, `description`, `$defs` - it's a JSON Schema document root, not a "validation node" with `properties`. The recursive walker enforces `additionalProperties:false` only on `{ type:'object', properties:{...} }` nodes (exactly where leak surfaces exist). This matches `data/command-registry.json` and the schema-design convention. Verified the walker still flags the leak case (Test 6 deletes `LocalGraphSummary.additionalProperties` and the test catches it precisely).

3. **`RecentChangeProjection.id` type narrowed from union `['string','integer']` to `string`:** read the live `lib/core/navigation/memory-events.cjs::logEvent` - the `eventId` always concatenates `'memory_event:' + eventType + ':' + ms + ':' + 8-hex-chars`, always a string. The original draft used a union; ajv strict mode rejected this (`strictTypes`: union types need `allowUnionTypes:true`). Tightening the schema to match the live emitter avoided opting out of strict mode and avoided a class of schemas-too-loose drift.

4. **Per-job `out` uniform in v1.0:** every job's `$defs.<job>.out` is `{ $ref: '#/$defs/BrainResponse' }`. `BrainResponse` matches `ingestion.cjs::storeBrainSuggestions` (reads `job_id`, `suggestions[]`, each with `summary?`, `methodology?`, `body?`, `confidence?`, `graph_updates_proposed?`). Future v1.x can tighten per-job `out` shapes without touching the 12 `in`-shape contracts.

5. **Test-fixture env seam matches the existing pattern:** `MINDRIAN_BRAIN_PACKET_SCHEMA` is documented in the script's header comment + plumbed through `SCHEMA_PATH = process.env.MINDRIAN_BRAIN_PACKET_SCHEMA || path.join(REPO_ROOT, ...)`. Mirrors `MINDRIAN_HOOK_STAGED_FILES` / `MINDRIAN_HOOK_STAGED_CONTENT_DIR` from `scripts/check-schema-aliases.cjs` (Phase 109). The test uses `fs.mkdtempSync(path.join(os.tmpdir(), 'phase-110-01-schema-'))` for tmp dirs + cleanup in `finally`.

## Cross-Phase Hooks (what downstream plans wire to)

- **Plan 110-02** (parallel-Wave-1, file-disjoint - separate executor) will modify `lib/core/navigation/packet.cjs::buildBrainPacket` to emit `origin: 'navigation_api'` + `privacy_mode: 'local_summary_only'` as top-level fields. The schema's `in.required` already lists both fields - **the 110-05 round-trip test will catch any shape mismatch** between this schema and what `buildBrainPacket` actually returns.
- **Plan 110-03** (Wave 2) will add `lib/core/brain-client.cjs::sendPacket(packet)` that compiles `data/brain-packet-schema.json` at module load (once) via `Ajv2020` + caches `validate.in[job]` / `validate.out[job]` per job. The script-level `Ajv2020` use here is the precedent.
- **Plan 110-04** (Wave 3) will add `scripts/check-schema-aliases.cjs` extension (or sibling check) for D-08 layer 2: fail commits introducing a `brain-client.*sendPacket(` call site not lexically preceded by a `buildBrainPacket(` call. Will register this script (`build-brain-packet-schema.cjs --check`) in `.git/hooks/pre-commit` + `scripts/hooks/pre-commit` next to the existing Phase 122 hook.
- **Plan 110-05** (Wave 3) will fill `tests/test-brain-packet-validation-per-job.cjs` + `tests/test-brain-packet-part8-invariant-per-job.cjs` (both RED stubs from Plan 110-00). The 12-job validation suite will use this schema as the in/out contract; the Part 8 invariant suite will round-trip `buildBrainPacket(...) -> ajv.validate(...) -> JSON.stringify(...) -> forbidden-substring sweep` to prove no body/transcript/shell text leaks.

## Known Stubs

None. This plan completes its tasks. The other 3 RED stubs from Plan 110-00 (`test-brain-packet-validation-per-job.cjs`, `test-brain-packet-part8-invariant-per-job.cjs`, `test-brain-packet-precommit-hook.cjs`) remain RED-by-design until Plans 110-04 + 110-05 land (per the Wave-0-substrate convention; documented in Plan 110-00 SUMMARY).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ajv draft 2020-12 dialect not accessible from default Ajv class**

- **Found during:** Task 1 mid-task verification (initial schema strict-compile attempt)
- **Issue:** The plan's verify block in the PLAN's `<automated>` section used `new Ajv({allErrors:true,strict:true}).compile(s)` - the default `Ajv` class from `ajv@8.x` defaults to draft-07 and threw `Error: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"` when compiling a draft 2020-12 schema. The plan declared draft 2020-12 explicitly as the schema dialect in 4 places (frontmatter `must_haves.truths`, interfaces block schema sketch, action STEP 1, success_criteria); the bug was in the verify command's choice of Ajv class.
- **Fix:** Use the dialect-specific `Ajv2020` class via `require('ajv/dist/2020').default || require('ajv/dist/2020')`. `ajv/dist/2020` ships inside the same transitive ajv package (still resolvable via `@modelcontextprotocol/sdk`; no new dep; ajv stays out of `package.json`). The script's `checkSchema()` uses `Ajv2020`; the test suite's test1 runs the script (not ajv directly) so it inherits the fix; the SUMMARY's verification table verify column also uses `Ajv2020` for the standalone strict-compile check.
- **Files modified:** `scripts/build-brain-packet-schema.cjs` (uses `Ajv2020` from the start - not a "modification", but the dialect choice diverged from the PLAN's verify literal).
- **Commit:** `972c000` (Task 1).
- **Verification:** `node scripts/build-brain-packet-schema.cjs --check` exits 0; the per-task tripwire tests all fire correctly; verified ajv@8.18.0 is resolvable + not in `package.json`.

**2. [Rule 1 - Bug] RecentChangeProjection.id union-type rejected by ajv strict mode**

- **Found during:** Task 1 mid-task verification (second strict-compile attempt)
- **Issue:** The first draft of the schema declared `RecentChangeProjection.id: { type: ["string", "integer"] }` (the projection's source was unclear in the PLAN's interfaces sketch). ajv strict mode rejects this with `strictTypes: use allowUnionTypes to allow union type keyword at "...#/$defs/RecentChangeProjection/properties/id"`. The schema's "strict at build time" invariant is explicitly load-bearing (CONTEXT D-06 + the script's `checkSchema(strictBuild)` default = `true`).
- **Fix:** Read the live emitter `lib/core/navigation/memory-events.cjs::logEvent` - the `eventId` is always `'memory_event:' + eventType + ':' + nowMs + ':' + crypto.randomBytes(4).toString('hex')`, always a string. Narrowed `RecentChangeProjection.id` from union to `{ type: 'string' }`. The `createdAt` field is similarly always an integer (from `nowMs = Date.now()` insertion); narrowed it from `["integer", "null"]` to `integer` for the same reason. Both narrowings TIGHTEN the schema vs. the live emitter (zero false-reject risk on real packets) and avoid disabling strict mode (the strictness is the leak-prevention point).
- **Files modified:** `data/brain-packet-schema.json` (1 hunk: `RecentChangeProjection.id` + `.createdAt`).
- **Commit:** `972c000` (Task 1; folded into the initial commit).
- **Verification:** strict-compile now passes; the change is a TIGHTENING (more restrictive), not a loosening; verified the live `safeRecentChangeProjection` mapper in `lib/core/navigation/packet.cjs:78-85` returns exactly `{ id, eventType, targetNodeId, createdAt }` with no other types.

**3. [Rule 2 - Auto-add critical functionality] `assertAdditionalPropsFalse` walker had to recurse into per-job `in`/`out` keys**

- **Found during:** Task 1 (writing the walker)
- **Issue:** The PLAN's walker sketch recursed into `node.$defs`, `node.properties`, `node.items`, and `allOf/anyOf/oneOf`. But the schema's per-job `$defs` have **`in`** and **`out`** sub-keys (e.g. `$defs.select_methodology.in`, `$defs.select_methodology.out`) - these are NOT standard JSON Schema keywords; they are this contract's per-job sub-schema layout. Without recursing into them, the walker would never visit (and therefore never enforce `additionalProperties:false` on) the per-job `in` objects - the exact place the leak-prevention teeth must bite.
- **Fix:** Added two extra recursion branches at the bottom of `assertAdditionalPropsFalse`: `if (node.in) assertAdditionalPropsFalse(node.in, pathStr + '/in', errs); if (node.out) assertAdditionalPropsFalse(node.out, pathStr + '/out', errs);`. This is essential, not optional - without it, a bad-actor could delete `additionalProperties:false` from a job's `in` object and the walker would miss it.
- **Files modified:** `scripts/build-brain-packet-schema.cjs` (recursion clause added before allOf/anyOf/oneOf).
- **Commit:** `972c000` (Task 1; included from the start).
- **Verification:** Test 6 (delete `LocalGraphSummary.additionalProperties`) catches it; also manually verified by deleting `$defs.select_methodology.in.additionalProperties` - the walker fires `object schema at #/$defs/select_methodology/in is missing "additionalProperties": false` correctly.

### Out-of-Scope Discoveries (not fixed; documented for follow-up)

None - the changes were entirely additive within the plan's scope.

---

**Total deviations:** 3 auto-fixed (Rule 1 x 2, Rule 2 x 1; all caught during mid-task verification before commit; zero re-work). **Impact on plan:** Zero - all 3 fixes folded into the initial Task 1 commit (`972c000`); the on-disk artifacts match the plan's intent; the verify block from PLAN passes after fix 1 (the only change to the verify-literal text needed for downstream reference is `Ajv` -> `Ajv2020`).

## Issues Encountered

None blocking. The 3 deviations above were caught and fixed inline.

## User Setup Required

None.

## Next Plan Readiness

**Plan 110-02 (Wave 1, parallel-safe with this plan; separate executor) is unblocked** and ready to run on `main`. It modifies `lib/core/navigation/packet.cjs::buildBrainPacket` to stamp `packet.origin = 'navigation_api'` + `packet.privacy_mode = 'local_summary_only'` as top-level fields. The schema this plan ships already requires both fields under every job `in.required`, so 110-02's regression-touched Phase 109 navigation tests will keep passing AND the new packet shape will validate cleanly against this schema (verified manually by patching `origin` + `privacy_mode` onto a `buildBrainPacket(...)` result and running `Ajv2020.compile(schema).getSchema('brain-packet#/$defs/select_methodology/in')(...)` -> `true`).

**Plan 110-03 (Wave 2) is blocked on both 110-01 AND 110-02.** It will add `lib/core/brain-client.cjs::sendPacket(packet)` that compiles `data/brain-packet-schema.json` at module scope via `Ajv2020` (the precedent set here) and validates every outbound packet against `schema.$defs[packet.job].in` + every Brain response against `schema.$defs[packet.job].out`.

**Plans 110-04 + 110-05 (Wave 3) are blocked on 110-03.** They will fill the remaining 3 RED stubs from Plan 110-00. The Phase 110 scoped runner (`bash tests/run-all-110.sh`) now reports 1 of 4 PASSED; will reach 4 of 4 PASSED after Wave 3.

No new blockers. The concurrent session committing to `main` (Phase 123/124 work) is unaffected; the 2 commits this plan added (`972c000` + `ee6b0d1`) use `--no-verify` per the orchestrator's parallel_execution rule.

## Self-Check: PASSED

- `data/brain-packet-schema.json` -- FOUND.
- `scripts/build-brain-packet-schema.cjs` -- FOUND (mode 0755, executable).
- `data/ROOM.md` -- FOUND (modified, new row + cross-ref).
- `tests/test-brain-packet-schema-check.cjs` -- FOUND (modified, 168 lines, 19 assertions).
- Commit `972c000` (Task 1) -- FOUND in `git log` (`feat(110-01): ship Brain Context Packet schema + --check tripwire`).
- Commit `ee6b0d1` (Task 2) -- FOUND in `git log` (`test(110-01): fill schema --check tripwire test stub`).
- `node scripts/build-brain-packet-schema.cjs --check` -- exit 0, prints `brain-packet-schema: OK`.
- `node tests/test-brain-packet-schema-check.cjs` -- exit 0, prints `test-brain-packet-schema-check: PASS (19 assertions across 6 tests)`.
- Phase 109 regression (`node tests/test-navigation-packet-builder.cjs`) -- 10/10 PASS.
- Phase 122 regression (`node scripts/build-command-registry.cjs --check`) -- OK.
- ajv NOT in `package.json` -- verified (grep rc=1, no match).
- Zero em/en-dashes in the 4 files this plan ships -- verified (grep -lP rc=1, no match).

---
*Phase: 110-brain-context-packet-contract*
*Plan: 01 (Wave 1 wire-format contract)*
*Completed: 2026-05-13*
