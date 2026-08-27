---
phase: 270
created: 2026-08-27
status: ratified
---

## OQ-1 ANSWER

**oq1-a** - Keep the cap, expose structure beyond it.

Navigator's reasoning, verbatim: "Keep the cap, expose structure beyond it. Zero change to the
frozen `DEPTH_CAP=3` constant in `lib/core/coverage-rollup.cjs:41`. Folder STRUCTURE stays visible
to arbitrary depth via Walker B; memory-file CONTENTS stay capped at 3 via Walker A, same as today."

`lib/core/coverage-rollup.cjs` is the home of the `DEPTH_CAP = 3` constant this rules on.

ZOOM re-rooting beyond DEPTH_CAP stays deferred, exactly as
`lib/core/memory/reconcile-memory-runner.cjs:171-173` already recorded; Phase 270 does not overturn
that deferral.

## OQ-2 ANSWER

**oq2-ship-caller** - Ship the caller in Phase 270, leave the trigger to Phase 267.2.

Navigator's reasoning, verbatim: "Ship the caller now. Wire a real caller to `writeUserMdAtomic` for
`~/.mindrian-user.md` in this phase (plan 270-11 stays in scope). The trigger/determinism half stays
explicitly deferred to Phase 267.2 - do not try to solve that here."

Phase 270 does NOT decide the identity-write TRIGGER. Phase 267.2 W2 owns it, jointly with Phase
267.3 for hook-surface declaration jurisdiction.

## Dispositions of record (not re-decided by any later plan)

| OQ | Disposition | Where it is handled |
|---|---|---|
| OQ-3 | UNRESOLVED and deliberately so. `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` names four R16 surface classes and MCP tools are not among them, so per-operation hitl_shape on MCP tools may be a parallel MCP-specific convention rather than a constitutional mandate. Phase 270 behaves as if it IS mandated - every new tool declares `connector` plus `hitl_shape` plus `hitl_why` - which is correct under either answer. | Flag only; carried to the navigator. |
| OQ-4 | No external grounding exists (the langtalks corpus returned nothing on multi-surface memory consistency). Phase 270 treats CLI/Desktop/Cowork room-resolution parity as a DESIGNED INVARIANT with a test, never as a researched pattern, and cites no external source for it. | Pinned by the parity leg of `tests/test-270-resource-session-room.cjs` (plan 270-02), fixed by plan 270-05. |
| OQ-5 | CLOSED IN THIS PHASE. `detect_dual_path` and `extract_shallow` are registered inline at `bin/mindrian-mcp-server.cjs:187` and `:199` with no `connectors` export, so they appear in neither `data/mcp-tool-connectors.json` nor any hitl_shape declaration - a Part 11 R1 born-wired gap. Fixed by extracting them into a `lib/mcp/tools/*.cjs` module, which is the only shape `scripts/build-connector-registry.cjs` discovers. **Amended by navigator ruling (2026-08-27), see the note below**: the live wire probe at plan 270-02 Task 3 found 13 additional undeclared tools beyond the two OQ-5 originally named - `analysis`, `export`, `intelligence`, `meeting`, `methodology`, `orchestration`, `room_content`, `room_graph`, `room_state`, plus the three `room-*` view tools (`room-dashboard`, `room-graph`, `room-wiki`). The navigator ruled these 13 are EXEMPT, extending the same precedent `lib/mcp/tool-router.cjs` already records for `eureka_critic` ("its governance dial is 'none', so it mints no connector descriptor ... registration on this one governed MCP path via registerRouterTools IS the Canon Part 11 wiring") to the whole `registerRouterTools`-registered grouped-multi-command-tool family, rather than widening plan 270-06 to force individual connector declarations onto them. Plan 270-06's `missing` check must therefore assert emptiness only after excluding this named 13-tool set (plus `eureka_critic`, already exempt) - not assert zero missing tools unconditionally. | RED-pinned at plan 270-02 Task 3, closed at plan 270-06 for `detect_dual_path`/`extract_shallow` only; the 13-tool exemption is recorded here as ratified navigator disposition, not a gap plan 270-06 must close. |
| OQ-7 | SURFACED ONLY, explicitly out of Phase 270's scope to build. Two distinct sub-points, kept separate because they are different failure modes: (i) five candidate MISSING sections (Meetings, Value Proposition, Marketing and Sales, Funding Options, Research Documents), navigator-cited against the pre-MindrianOS Notion Data Room template; (ii) a WITHIN-SECTION structure gap - `team-execution` is correctly canonical and hyper-critical, but its `SECTION_METADATA` entry is thin prose with no role / domain-expertise / availability / cross-linking fields against real Mentor Profiles usage. Phase 270 decides neither. The 4.1a schema-driven constraint is exactly what makes a future 9th section, or a richer `team-execution` schema, cost zero operator rewrite. | Carried to the navigator as a flag; enforced indirectly by `tests/test-270-baseline-schema-driven.cjs` (plan 270-03). |

## Corrections this phase carries forward (do not re-litigate)

- Part 8 is ALREADY triple-enforced (import-graph isolation in `lib/core/navigation.cjs`; the
  per-job `privacy_mode` const in `data/brain-packet-schema.json` via
  `lib/core/navigation/packet.cjs:29-36`; the runtime PreToolUse block in
  `scripts/part8-egress-guard-hook.cjs`). The ROADMAP's premise that it is "a documented convention,
  not a schema-level guarantee" is factually wrong. NO task in this phase may claim to newly enforce
  Part 8.
- "Mirror Theo" is EXPLICITLY REJECTED as an architecture for the room side. Theo consolidates over
  one already-remote, read-mostly store; the room side is N room.db files across a nested forest with
  a hard cross-room-aggregation fence (`lib/core/navigation/edges.cjs:45`), human-gated promotion
  moments, and a never-leaves constraint. Different architecture, not the same one wearing a
  different hat.
- `alwaysLoad` is a SERVER-level flag in `.mcp.json`, not a per-tool one. Phase 268's "make an
  explicit alwaysLoad true/false call per surviving tool" rubric is not expressible against this
  codebase and must not be carried forward. Reducing the number and size of registered tool
  descriptions is the only token lever this repo has.

## Requirement IDs minted by this phase

| Requirement | One-line behaviour |
|---|---|
| MEMOP-01 | A single command, `bash tests/run-all-270.sh`, discovers and runs every Phase 270 test by glob, and fails loudly rather than printing green when it discovers zero files. |
| MEMOP-02 | MCP Resources resolve the room per session, the same way MCP Tools already do, instead of binding `roomDir` once at boot. |
| MEMOP-03 | The exposed ICM tree reflects a folder created after the server booted, not a snapshot frozen at startup. |
| MEMOP-04 | The forest walk delegates to the two already-shipped walkers and mints no second, hand-rolled directory walker. |
| MEMOP-05 | The section baseline is schema-driven off `SECTION_METADATA`, never a hardcoded count of 8. |
| MEMOP-06 | The forest classifies directories into four classes, and a blueprint-subset room (missing some canonical sections) is not an error. |
| MEMOP-07 | A cross-room read never writes a cross-room edge (the Phase 8 aggregation fence holds for the new graph-native reads). |
| MEMOP-08 | The identity write to `~/.mindrian-user.md` is reachable with no room bound (a cross-room, user-level concern, not a room-scoped one). |
| MEMOP-09 | Every wire tool carries a connector descriptor with a hitl_shape, closing the `detect_dual_path` / `extract_shallow` born-wired gap (the 13-tool grouped-router family is exempt per the OQ-5 disposition above). |
| MEMOP-10 | The tool-schema token budget added by this phase's new tools is measured with a real harness, never assumed. |
| MEMOP-11 | `context_assemble` exposes `getRoomContext`'s four legs, with its four existing budget knobs (`fragmentWindow`, `fragmentCharCap`, `topK`, `maxDepth`) surfaced as bounded caller parameters. |
| MEMOP-12 | `context_assemble` carries an `estimate_only` mode: the cheap structural legs run and return projected per-leg cost without returning bodies - the "see the cost before you pay it" affordance. |
| MEMOP-13 | The graph-native additions: `findTransitiveSupport` (recursive-CTE transitive support/contradiction closure) and `findNearestSubRoomDecisions` (structural distance across a room.db boundary, read-only, no new ATTACH). |
| MEMOP-14 | `room_state_bound` retirement is gated behind the OQ-6 navigator verdict (a manual foreign-host Resource parity check), and the phase's real AFTER/DELTA tool-schema token number is measured and recorded, replacing the earlier CLAIM. |
| MEMOP-15 | The navigator has answered OQ-1 and OQ-2 with named options, and OQ-3/OQ-4/OQ-5/OQ-7 each carry a one-line disposition of record, before any later plan depends on them. |

These are phase-local working IDs minted at plan time and are not yet formally registered in
`.planning/REQUIREMENTS.md`, matching the Phase 266 and Phase 269 precedent.
