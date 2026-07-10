---
phase: 216-eureka-user-command
plan: 03
subsystem: eureka
tags: [eureka, command-authoring, cirs, hitl-shape, four-zone-ui, born-wired]

# Dependency graph
requires:
  - phase: 216-02
    provides: "scripts/eureka-command.cjs fire-and-return dispatcher (run|start|status|report|help) + status.json lifecycle + report JSON at <ROOM_DIR>/.mindrian/eureka/portfolio-report.json"
  - phase: 216-01
    provides: "buildRoomNativeSubstrate: room-native pairs so a plain room.db produces a full report"
provides:
  - "commands/eureka.md: the born-wired /mos:eureka user surface (F.8 hitl_shape + hitl_why, SENS-13/context_block/eureka-portfolio connector, filing: none report-only)"
  - "D-05 fire-and-return body: start -> bounded 3-poll status -> report render; never holds the conversation hostage on a large room"
  - "4-zone Shape E render spec keyed to the dispatcher's report JSON (ranked table, honest insufficient_structure tail line, NOT YET BANKED pending-critic language)"
  - "Registration surfaces: eureka in the intelligence-research help family, skills/eureka/SKILL.md byte-mirror, connector-registry tuple, all six governance gates green"
affects: [eureka, help-system, connector-spine, 216-04 acceptance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command -> resolve-room -> CJS dispatcher (the whitespace.md pattern, verbatim)"
    - "Born-wired frontmatter: connector block enumerated by build-connector-registry.cjs + F.8 hitl_shape declared for check-shape-declaration.cjs"
    - "Fire-the-card-never-draw-the-box F.8 Decision Gate close over AskUserQuestion (SEED-021)"
    - "Generated skill mirror via build-skill-mirrors.cjs --write (never hand-authored)"

key-files:
  created:
    - commands/eureka.md
    - skills/eureka/SKILL.md
  modified:
    - data/help-groups.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/command-registry.json

key-decisions:
  - "sub_mode: eureka-portfolio kept (re-verified collision-free at author time 2026-07-10, exactly one hit in commands/); no -216 suffix needed"
  - "SENS-13 chosen as the semantically-correct trigger (the Phase 213 eureka detector); the connector gate does not restrict sensor ids, uniqueness is on the (sensor, reach_id, sub_mode) tuple"
  - "No-args behaves as run (the primary JTBD is the scan), unlike whitespace's multi-tool help default"
  - "Report-only v1 (D-03): filing: none in the connector, the body states statements are not banked, pending critic renders as NOT YET BANKED"

requirements-completed: [216-R3, 216-R4]

# Metrics
duration: 18min
completed: 2026-07-10
---

# Phase 216 Plan 03: Eureka User-Facing Command Summary

**`/mos:eureka` is now a born-wired command surface: any navigator on any of the three surfaces types it and gets the ranked + weak-signal-tail + Opportunity-Statement read against their OWN active room, over the Plan 02 fire-and-return dispatcher, rendered through the 4-zone Shape E anatomy and closed on an F.8 Decision Gate, with all six CIRS governance gates green and v1 held report-only.**

## Performance
- **Duration:** ~18 min
- **Started:** 2026-07-10 (this session)
- **Completed:** 2026-07-10
- **Tasks:** 2
- **Files:** 2 created, 4 modified

## Accomplishments
- **Task 1 (`commands/eureka.md`, commit `1d4e0cf8`):** the born-wired surface. Frontmatter carries the exact gate-parsed axes: `name: eureka`, `body_shape: E (Action Report)`, `hitl_shape: "F.8"` + `hitl_why`, `serves_jtbd: ["connect-domains","explore"]`, restrictive `allowed-tools: [Read, Bash, AskUserQuestion]`, and the connector block `connects_to_spine: true / sensor_triggers: [SENS-13] / reach_id: context_block / sub_mode: eureka-portfolio / framework: null / posture: hold / hierarchy_rank: 3 / filing: none / plan_gated: false / web_scope: null / surface: F.1`. The body carries the verbatim `<!-- mos:firing-block v2 -->` stamp, the LOCKED Larry voice rules (12 glyphs, 3-line error, no emoji, no "I" openers), the SEED-034 one-door pre-flight (`scripts/resolve-room` with the `./scripts/resolve-room` fallback + the 3-line no-room error), the D-05 fire-and-return `run` flow (Step 1 `start` + first-run model-fetch honesty note, Step 2 bounded 3-poll `status`, Step 3 `report`), the `status` and `report` subcommands, the 4-zone Shape E render spec keyed to the report JSON, the F.8 Decision Gate close, the report-only note, and the Error Handling + Cross-Surface Adaptation sections.
- **Task 2 (registration, commit `f62f499e`):** `eureka` appended to the `intelligence-research` help family (jtbd `connect-domains` + `explore` intersect); `skills/eureka/SKILL.md` generated as a byte-mirror via `build-skill-mirrors.cjs --write` (born in the same commit as the --write run); `data/connector-registry.json` + `data/connector-coverage-ledger.json` regenerated with the `(SENS-13, context_block, eureka-portfolio)` tuple.
- **All six governance gates green in one chained invocation (216-R4):** `build-connector-registry.cjs --check` OK, `check-shape-declaration.cjs --check --strict` OK (257 declared), `command-registration-check.cjs` PASS, `check-help-coverage.cjs` valid:true, `build-skill-mirrors.cjs --check` OK (107 mirrors), `check-render-coverage.cjs` 0 gap.
- **The Plan 02 dispatcher stayed untouched and green:** `node tests/test-216-eureka-command.cjs` -> 44 assertions passed (no dispatcher drift while authoring).

## Task Commits
1. **Task 1: author commands/eureka.md born-wired /mos:eureka surface** - `1d4e0cf8` (feat) [+ regenerated `data/command-registry.json`, required by the pre-commit registration hook when a new command lands]
2. **Task 2: register /mos:eureka across help-groups, skill mirror, connector registry** - `f62f499e` (feat)

## Files Created/Modified
- `commands/eureka.md` (new, ~230 lines) - the born-wired command surface. No em-dashes, only the 12 approved glyphs, no emoji.
- `skills/eureka/SKILL.md` (new, generated) - the byte-mirror for Windows registration parity. Never hand-authored.
- `data/help-groups.json` (modified) - one line: `"eureka"` appended to the intelligence-research group's commands array. Nothing else touched, no counts hardcoded.
- `data/connector-registry.json` (modified, regenerated) - 192 connectors including the eureka tuple.
- `data/connector-coverage-ledger.json` (modified, regenerated) - coverage ledger sibling.
- `data/command-registry.json` (modified, regenerated) - 108 commands; the pre-commit hook requires it fresh when a command is added.

## Author-Time Verification (per the plan's required step)
- `grep -rn "sub_mode: eureka-portfolio" commands/` -> exactly 1 hit (this file). No collision; `eureka-portfolio` kept, no `-216` suffix needed.
- `grep -rln "^name: eureka" commands/*.md` -> exactly 1 command claims the name.

## Acceptance Greps (all pass)
- Task 1: firing-block v2 = 1; AskUserQuestion = 5 (>=2); filing: none = 1; "Not enough entries for a tail read" = 1 (>=1); em-dash = 0; `(start|status|report)` = 33 (>=6).
- Task 2: eureka in intelligence-research (python3 assert OK); `skills/eureka/SKILL.md` exists (born in the --write commit); `eureka-portfolio` in connector-registry = 2 (>=1).

## Deviations from Plan
None material. One process note: the repo's pre-commit hook additionally enforces `data/command-registry.json` freshness whenever a command is added (a registration surface the plan did not name explicitly). Regenerating it via `node scripts/build-command-registry.cjs` and including it in the Task 1 commit is the correct-at-source fix, not a gate bypass. This is a Rule 3 blocking-issue fix (a stale generated registry blocked the commit), resolved by running the sanctioned generator.

## Issues Encountered
None. First commit attempt was blocked by the command-registry freshness hook; regenerated the registry and re-committed cleanly.

## Known Stubs
None. The command body renders live fields from the dispatcher's report JSON (`json.ranked`, `json.tail`, `json.statements`); pending critic state renders honestly as `NOT YET BANKED (critic pending)` per the D-03 report-only posture, which is the intended contract value, not a stub.

## Threat Flags
None new. The plan's threat register is honored: T-216-09 (single resolver, `scripts/resolve-room` only, no fifth guesser); T-216-10 (restrictive `allowed-tools: [Read, Bash, AskUserQuestion]`, no Write/WebSearch); T-216-11 (render is local prose over local JSON, no MCP/web tools); T-216-12 (`filing: none`, body states report-only, gates pin the single door). No new network endpoint, auth path, or trust-boundary schema change.

## Verification
- Six gates chained -> exit 0 (216-R4).
- `node tests/test-216-eureka-command.cjs` -> 44 assertions passed (dispatcher unregressed).
- `grep -c $'—' commands/eureka.md` -> 0; the only high-codepoint characters are the sanctioned 12-glyph vocabulary (`⚠`, `⚡`, `■`, `▼`, `▶`, `▷`, `✓`, `•`, `⬜`, `→`), not emoji.

## Next Phase Readiness
- 216-R3 satisfied: the command surface exists, born wired, F.8-declared, fire-and-return, 4-zone-rendered, report-only.
- 216-R4 satisfied: all six governance gates exit 0.
- Interface for 216-04 (acceptance): a navigator types `/mos:eureka` against a real room; the surface resolves the active room (SEED-034), shells `eureka-command.cjs <ROOM_DIR> start|status|report`, and renders the report JSON through the 4-zone Shape E spec. No blockers.

## Self-Check: PASSED
- Files verified on disk: `commands/eureka.md`, `skills/eureka/SKILL.md`, `216-03-SUMMARY.md`
- Commits verified in git log: `1d4e0cf8` (feat command surface), `f62f499e` (feat registration surfaces)
