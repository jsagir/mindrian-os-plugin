---
phase: 90-brain-derivation-layer
plan: "06"
subsystem: brain-derivation-layer
tags:
  - cross-room
  - aggregator
  - canon-part-8
  - sealed-room
  - opt-out
  - four-tripwires
  - phase-90
  - bsl-1-1
  - cjs
  - wave-3
dependency_graph:
  requires:
    - lib/core/folder-memory.cjs (Plan 88-01 readTriple + Plan 90-04 readQuadruple)
    - lib/core/brain-derivation.cjs (Plan 90-01 deriveSection; integrated additively)
    - .rooms/registry.json (Phase 83 Cross-Session Scope Injection; walked read-only)
    - GUARDRAIL.md (Phase 83 sealed-room contract; preserved byte-for-byte)
  provides:
    - lib/core/cross-room-aggregator.cjs (aggregateContradictions + discoverRegisteredRooms + isRoomSealed + isRoomOptedOut + isRoomInScope + computeCrossRoomContradictions + sanitizeDetailScalar + renderCrossRoomSection)
    - lib/memory/cross-room-aggregator.test.cjs (18 fixture tests including LOAD-BEARING Canon Part 8 payload audits Tests 16-18)
    - brain-derivation.cjs deriveSection option cross_room_scan (default false; opt-in per call)
  affects:
    - 90-07-mos-brain-derive-command (manual /mos:brain-derive surfaces --cross-room flag that wires options.cross_room_scan:true)
    - 90-08-graceful-degradation-suite (exercises aggregator across sealed/opted-out/registry-less/out-of-scope fixtures)
    - 91-navigation-engine (consumes cross-room contradiction stream for Decision Gate team composition)
tech-stack:
  added: []
  patterns:
    - Four-layer Canon Part 8 enforcement (ALLOWED_ROOT + GUARDRAIL + per-room opt-out + sanitizeDetailScalar / JSON.stringify audit)
    - Frozen FORBIDDEN_PATTERNS regex set mirrored byte-for-byte from Plan 90-05 invariants validator
    - Lazy require of cross-room-aggregator in brain-derivation.cjs so default-off path adds zero require-graph cost
    - Phase 83 registry reuse (zero new registry format; zero Phase 83 code edits)
    - Phase 83 GUARDRAIL.md contract preserved byte-for-byte (any GUARDRAIL.md -> skip)
    - Structural-only contradiction output (frozen type enum, slug-safe strings, enum problem_types, sha256 hash prefixes, scalar confidence)
key-files:
  created:
    - lib/core/cross-room-aggregator.cjs
    - lib/memory/cross-room-aggregator.test.cjs
    - .planning/phases/90-brain-derivation-layer/90-06-SUMMARY.md
  modified:
    - lib/core/brain-derivation.cjs (additive: deriveSection accepts options.cross_room_scan; default false; lazy aggregator require)
    - lib/memory/run-feynman-tests.cjs (one entry appended; 59 -> 60 test files)
decisions:
  - "Phase 83 registry reuse: the aggregator reads .rooms/registry.json verbatim. Zero new registry format. Zero Phase 83 code edits. The registry is the cross-room discovery substrate precisely because Phase 83 already solved rashut-hadshanut-ai-style scope contracts."
  - "GUARDRAIL.md as sealed-room signal: Phase 83's ad-hoc GUARDRAIL.md contract is promoted to a first-class aggregator input. Presence = skip. Byte-for-byte compatible with rashut-hadshanut-ai/GUARDRAIL.md already in the wild."
  - "Per-room opt-out via ROOM.md frontmatter brain_cross_room:false. Opt-in per-call, opt-out per-room: orthogonal controls. Narrow frontmatter sniff reads only the first 2KB of ROOM.md."
  - "ALLOWED_ROOT absolute-path scope check: every peer path path.resolve + startsWith(~/MindrianRooms/). Out-of-scope paths (symlink escapes, relative traversals, absolute paths outside the canonical root) are skipped with reason out_of_scope."
  - "sanitizeDetailScalar + JSON.stringify output audit as LAST LINE OF DEFENSE: the fourth tripwire. Strings >40 chars OR matching any FORBIDDEN_PATTERNS are redacted. The audit runs on the final JSON.stringify(result); any hit triggers aggressive redaction of every contradiction."
  - "Opt-in per call default OFF: options.cross_room_scan defaults to false. Plan 90-07 /mos:brain-derive --cross-room command surface is the canonical opt-in path. No background process ever flips this on silently."
  - "FNV-1a 32-bit framework chain signature (not content): the framework_chain_sig scalar is a hash of the BRAIN.md Framework Chain Predictions section body. Plan 90-05 already scans that body for Canon Part 8 leaks, so hashing a clean body is Canon-safe."
  - "Three frozen contradiction types: hash_divergence (same slug, different governing_thought_hash), framework_contradiction (same slug, different chain signature), problem_type_mismatch (same slug, different UDP/IDP/WDP enum). All three produce primitive-only detail_scalars."
  - "Registry-less graceful fallback: missing OR malformed registry returns {reason:'no_registry'} without throwing. Mirrors Phase 88-13 guardian fail-open philosophy."
  - "Timeout is an environment override (MINDRIAN_XROOM_FORCE_TIMEOUT=1) for test determinism. Production timeouts come from per_room_timeout_ms option. A timeout on any peer scan counts as skip_reasons.timeout; the aggregator does not abort the whole run."
requirements:
  - BRAIN-XROOM-01
  - BRAIN-XROOM-02
  - BRAIN-XROOM-03
  - BRAIN-XROOM-CANON-PART-8-01
canon_parts:
  - "Part 2 Team Around the Navigator -- cross-room contradictions help the team surface patterns the navigator may have missed (biotech room framework chain contradicts education room pattern, etc.)"
  - "Part 7 Reuse Before Build -- aggregator reuses Phase 83 .rooms/registry.json and GUARDRAIL.md scope contracts that already shipped; zero new registry format; zero Phase 83 code edits."
  - "Part 8 Graph Boundary CRITICAL -- cross-room aggregation is the riskiest Canon Part 8 surface in Phase 90. The aggregator NEVER egresses user content cross-room; it operates on hashes + structural metadata only; the final JSON.stringify audit is the last line of defense. This plan ships the FOURTH Canon Part 8 tripwire (alongside Plans 90-00 schema doc + 90-01 prompt allow-list + 90-05 invariants body scan)."
metrics:
  duration_minutes: ~50
  completed: 2026-04-24
  tests_added: 18
  feynman_baseline: "59 -> 60 test files (baseline advanced by exactly 1 per plan contract)"
  feynman_suite_result: "Phase 90 suite 7/7 test files green (116/116 tests passing); baseline Phase 88 tests (folder-memory, guardian, invariants, session-start-brain-staleness) spot-checked green"
  lines_created: "~1200"
  runtime_deps_added: 0
---

# Phase 90 Plan 06: Cross-Room Aggregation Summary

One-liner: Structural-only cross-room contradiction aggregator that walks the Phase 83 .rooms/registry.json under ~/MindrianRooms/, respects the GUARDRAIL.md sealed-room contract + per-room brain_cross_room:false opt-out + ALLOWED_ROOT absolute-path scope check, and guarantees zero user content egress via sanitizeDetailScalar + a final JSON.stringify output audit -- the FOURTH Canon Part 8 tripwire of Phase 90, hardened by 18 fixture tests including adversarial payload audits on an email / currency / quoted-person / SSN / phone / "meeting with" dangerous-content fixture.

## What shipped

Phase 90 Wave 3 Plan 7 of 11. The riskiest Canon Part 8 surface of the phase.

Three artifacts:

1. `lib/core/cross-room-aggregator.cjs` (~600 lines, BSL 1.1, CJS only, zero new deps)
2. `lib/memory/cross-room-aggregator.test.cjs` (~930 lines, 18 tests, registered in Feynman suite)
3. `lib/core/brain-derivation.cjs` (modified additively: +25 lines for options.cross_room_scan integration; default false preserves Plan 90-01 behavior byte-for-byte)

## API surface

### `lib/core/cross-room-aggregator.cjs`

| Export | Shape | Purpose |
| --- | --- | --- |
| `aggregateContradictions(currentRoom, options)` | `async (string, {opt_in?,max_rooms?,per_room_timeout_ms?}) -> Promise<result>` | Main entry point. NEVER throws. |
| `discoverRegisteredRooms()` | `() -> {rooms:[{slug,path,entry}], reason?}` | Reads `~/MindrianRooms/.rooms/registry.json` with graceful fallback. |
| `isRoomSealed(roomPath)` | `string -> boolean` | GUARDRAIL.md presence test (Phase 83 contract). |
| `isRoomOptedOut(roomPath)` | `string -> boolean` | ROOM.md frontmatter `brain_cross_room:false` sniff. |
| `isRoomInScope(roomPath)` | `string -> boolean` | ALLOWED_ROOT absolute-path containment test. |
| `computeCrossRoomContradictions(curSlug,curSecs,peerSlug,peerSecs)` | pure fn | Frozen-rule contradiction computer. |
| `sanitizeDetailScalar(obj)` | `object -> object` | Strips strings >40 chars OR matching FORBIDDEN_PATTERNS. |
| `renderCrossRoomSection(result)` | `result -> string` | Renders aggregator output into BRAIN.md 'Flagged Contradictions (cross-room)' section body. |
| `ALLOWED_ROOT` | frozen path | Canonical `~/MindrianRooms/`. Test-overridable via `MINDRIAN_ROOMS_ROOT`. |
| `CONTRADICTION_TYPES` | frozen array | `['hash_divergence','framework_contradiction','problem_type_mismatch']`. |
| `PROBLEM_TYPE_ENUM` | frozen array | `['UDP','IDP','WDP']`. |
| `FORBIDDEN_PATTERNS` | frozen array | Six regex: email, currency, quoted-person, meeting, SSN, phone. |

### `aggregateContradictions` return shape

```js
{
  contradictions: [{
    type: 'hash_divergence' | 'framework_contradiction' | 'problem_type_mismatch',
    room_a_slug: string,      // current room slug
    room_b_slug: string,      // peer room slug
    section: string,          // shared section slug
    detail_scalar: {          // primitive-only, post sanitizeDetailScalar
      // strings <=40 chars, no forbidden regex hits
    },
    confidence: number        // [0,1]
  }],
  scanned_rooms: number,
  skipped_rooms: number,
  skip_reasons: {
    sealed_room: number,
    opt_out: number,
    out_of_scope: number,
    unreadable: number,
    timeout: number,
    max_rooms_exceeded: number,
    self: number,
    empty: number
  },
  reason?: 'no_registry' | 'canon_part_8_audit_failed'
}
```

### Integration: `brain-derivation.cjs` deriveSection

```js
const result = await deriveSection(roomPath, section, {
  cross_room_scan: true,            // opt-in per call; default false
  cross_room_max_rooms: 10,         // optional cap
  cross_room_timeout_ms: 300        // optional per-peer timeout
});
```

When `cross_room_scan:true`, after local Brain queries complete and before the schema gate, the aggregator runs and its `renderCrossRoomSection(result)` output overwrites the 'Flagged Contradictions (cross-room)' section body of BRAIN.md. Default off preserves Plan 90-01 byte-for-byte.

## Four-layer Canon Part 8 enforcement

The aggregator is the riskiest Canon Part 8 surface in Phase 90 because it reads MULTIPLE rooms' bytes. Four independent defense layers enforce that NO user content crosses the boundary:

| Layer | Mechanism | Where | Failure mode |
| --- | --- | --- | --- |
| L1 | `ALLOWED_ROOT` absolute-path scope | `isRoomInScope` | `path.resolve(peer).startsWith(ALLOWED_ROOT + sep)` false -> skipped (out_of_scope) |
| L2 | `GUARDRAIL.md` sealed-room detection | `isRoomSealed` | any top-level GUARDRAIL.md -> skipped (sealed_room); Phase 83 contract byte-for-byte |
| L3 | per-room `brain_cross_room:false` opt-out | `isRoomOptedOut` | narrow frontmatter sniff on ROOM.md -> skipped (opt_out) |
| L4 | `sanitizeDetailScalar` + `JSON.stringify` audit | `aggregateContradictions` tail | any string >40 chars OR matching `FORBIDDEN_PATTERNS` -> redacted; final JSON.stringify scanned; last line of defense |

## Four Canon Part 8 tripwires across Phase 90

This plan ships the FOURTH tripwire. Evidence:

| Tripwire | Plan | Surface | Canon token count |
| --- | --- | --- | --- |
| 1. Schema doc frontmatter scan | 90-00 | `lib/core/brain-md-schema.cjs validateSchema` | 4 hits in source |
| 2. Prompt-builder allow-list | 90-01 | `lib/core/brain-derivation-prompts.cjs validateCtx` | 16 hits |
| 3. Invariants body scan | 90-05 | `lib/memory/validators/brain-md-invariants.cjs` | 11 hits |
| 4. Aggregator sanitize + audit | 90-06 (this plan) | `lib/core/cross-room-aggregator.cjs` | 26 hits |

Each detector runs in a different lifecycle moment AND a different data surface. A bug in any one still produces detection via the other three.

## Test coverage (18 tests)

| # | Name | Category |
| --- | --- | --- |
| 01 | 3-room fixture, 0 sealed, contradictions detected | happy-path |
| 02 | sealed room (GUARDRAIL.md) -> skipped | Phase 83 contract |
| 03 | opt-out room (brain_cross_room:false) -> skipped | per-room opt-out |
| 04 | registry.json missing -> graceful fallback | fail-open |
| 05 | malformed registry.json -> graceful fallback + stderr warn | fail-open |
| 06 | room path outside ALLOWED_ROOT -> skipped as out_of_scope | L1 scope |
| 07 | self-exclusion (currentRoom slug matches registry entry) | self-exclusion |
| 08 | hash_divergence contradiction type | contradiction rule A |
| 09 | framework_contradiction contradiction type | contradiction rule C |
| 10 | problem_type_mismatch contradiction type | contradiction rule B |
| 11 | no contradictions -> empty contradictions, non-zero scanned | happy-path (null case) |
| 12 | max_rooms:2 limit applied | budget |
| 13 | per_room_timeout_ms triggers skip_reasons.timeout | resilience |
| 14 | unreadable room dir -> skip_reasons.unreadable | resilience |
| 15 | wall-clock <500ms for 10-room fixture | performance budget |
| 16 | CANON PART 8 -- JSON.stringify(result) contains ZERO forbidden substrings | LOAD-BEARING Part 8 audit |
| 17 | CANON PART 8 -- detail_scalar shape is primitive-only | LOAD-BEARING Part 8 audit |
| 18 | deriveSection integration w/ cross_room_scan:true | integration |

Result: 18/18 passed.

## Adversarial payload audit evidence

Tests 16-18 build a 3-room fixture where every room carries dangerous content:

- `'Lawrence said we should raise $5M next quarter'` (quoted-person + currency)
- `'meeting with jonathan@mindrian.com scheduled'` (meeting + email)
- `'Dror revealed SSN 123-45-6789 during diligence'` (quoted-person + SSN)
- `'$5M revenue target confirmed by Nimrod'` (currency)
- `'call Oren at +1-555-123-4567'` (phone)
- `'Jonathan said the market is soft'` (quoted-person)

The dangerous strings are planted in:
- ROOM.md identity text
- MINTO.md governing_thought frontmatter scalar
- BRAIN.md section bodies (Pattern Matches, Framework Chain Predictions, ProblemType Classification)

After `aggregateContradictions` runs, Test 16 asserts `JSON.stringify(result).toLowerCase().indexOf(bad.toLowerCase()) === -1` for every dangerous substring, and asserts zero hits against `FORBIDDEN_PATTERNS` regex set applied to the serialized output. Test 17 asserts every `detail_scalar[k]` is a primitive, strings are <=40 chars, and no string matches any forbidden regex. Test 18 asserts the rendered `renderCrossRoomSection(result)` body carries zero dangerous content under the same adversarial fixture AND that `brain-derivation.cjs` references `cross_room_scan` + `aggregateContradictions` in source (integration wire verified).

All three audits passed under the adversarial fixture while still producing at least one structural contradiction (proving the scanner read the dangerous content and STILL produced a clean output).

## Deviations from Plan

None -- plan executed exactly as written. Two micro-scoped fixes caught at verification time:

1. **`withTimeout` helper** originally set `settled=true` synchronously after `fn()` returned a Promise, which beat the timer in every case (timer's `settled` check no-op'd). Fixed by `await fn()` inside an async `.then` so promise-returning workloads actually race the timer (Rule 1 auto-fix; caught by Test 13 RED).

2. **brain-derivation.cjs `cross_room_scan` integration** required additive edits to deriveSection to lazy-require the aggregator and splice the render into `sectionResults['Flagged Contradictions (cross-room)']` before the body assembly. Default off preserves Plan 90-01 byte-for-byte (Rule 2 auto-add -- planned Task 6 completion).

### Authentication gates

None. Plan is pure filesystem + node built-ins.

### Deferred items (out of scope)

None for this plan. A future plan (90-07 `/mos:brain-derive --cross-room` manual command surface) will expose the `cross_room_scan:true` option at the command layer.

## Verification

- `node lib/memory/cross-room-aggregator.test.cjs` -> 18/18 passed, exit 0
- `grep -c "GUARDRAIL.md" lib/core/cross-room-aggregator.cjs` -> 4
- `grep -c "brain_cross_room" lib/core/cross-room-aggregator.cjs` -> 3
- `grep -cE "sanitizeDetailScalar|CONTRADICTION_TYPES" lib/core/cross-room-aggregator.cjs` -> 16
- `grep -cE "ALLOWED_ROOT|MindrianRooms" lib/core/cross-room-aggregator.cjs` -> 14
- `grep -cE "aggregateContradictions|cross_room_scan" lib/core/brain-derivation.cjs` -> 5
- `grep -ciE "canon.*part.*8|canon_part_8|canon_boundary" lib/core/cross-room-aggregator.cjs` -> 16
- `grep -c "BSL 1.1" lib/core/cross-room-aggregator.cjs` -> 2
- em-dash / en-dash scan across aggregator + test file -> 0 / 0
- Phase 90 test suite spot-check: 7/7 Phase 90 test files green (brain-md-schema 18/18, brain-derivation 18/18, brain-derivation-queue 19/19, brain-md-staleness 13/13, folder-memory-quadruple 17/17, brain-md-invariants-validator 16/16, cross-room-aggregator 18/18) -- 116/116 assertions passing.
- Phase 88 compatibility spot-check: folder-memory.test 15/15, feynman-minto-guardian.test 16/16, feynman-minto-invariants.test 21/21, session-start-brain-staleness.test 5/5 -- all green.

## Commits

- `1b3f6a8` test(90-06): add failing tests for cross-room aggregator (RED)
- `5796655` feat(90-06): implement cross-room aggregator (GREEN, 18/18)

## Next plan

Plan 90-07 `/mos:brain-derive` command surface -- manual user command that wires `options.cross_room_scan:true` behind the `--cross-room` flag. This plan's aggregator is the read-side surface that 90-07 calls through deriveSection.

---

_Phase 90 Plan 06 -- MindrianOS Plugin, 2026-04-24._

---

## Self-Check: PASSED

- `lib/core/cross-room-aggregator.cjs` FOUND
- `lib/memory/cross-room-aggregator.test.cjs` FOUND
- `.planning/phases/90-brain-derivation-layer/90-06-SUMMARY.md` FOUND
- Commit `1b3f6a8` (RED test) FOUND in git log
- Commit `5796655` (GREEN impl + integration) FOUND in git log
