# Phase 121: Trajectory Telemetry -- Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `121-CONTEXT.md` -- this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 121-trajectory-telemetry
**Areas discussed:** Consolidation strategy, Capture surface scope, Schema versioning + freeze contract, Part 8 enforcement + observability

**Context refresh trigger:** the original 2026-05-05 stub framed Phase 121 as greenfield "build the writer module". Codebase scout discovered 4 telemetry writers already shipped piecemeal across Phases 88.1 / 109 / 117 / 118 -- reframing this phase as consolidation per Canon Part 7 (Reuse Before Build).

---

## Pre-discussion gate

| Option | Description | Selected |
|--------|-------------|----------|
| Update through discussion | Refresh stub against shipped reality | ✓ |
| View the current stub | Show me the 2026-05-05 stub before deciding | |
| Skip discussion -- plan directly | Use existing stub as-is | |

**User's choice:** Update through discussion.

---

## Area 1: Consolidation Strategy

### Q1: How should the 4 existing telemetry files relate to new capture points?

| Option | Description | Selected |
|--------|-------------|----------|
| Unified events.jsonl (single stream) | One file with `type` discriminator. One writer. Migration of existing files. Simplest SEED-002 ingestion. | ✓ |
| Hybrid: freeze historicals, unified going forward | Existing 4 files stay frozen; new events go to unified. SEED-002 reads both via shim. Lower risk. | |
| Parallel typed files + INDEX.json | Each event type owns its own file. Registry lists files + schemas. Cleanest typing, most files. | |

**User's choice:** Unified events.jsonl (D-01).
**Notes:** The "rip the bandaid" choice. Implies migration in Plan 121-00.

### Q2: When does migration of the 4 existing files happen?

| Option | Description | Selected |
|--------|-------------|----------|
| One-time merge script in Plan 121-00 | Idempotent script reads originals, normalizes, appends, renames to `*.pre-v121.bak`. Hooked re-score repointed same plan. | ✓ |
| Cold migration -- freeze historicals | No migration; events.jsonl starts empty. Consumers extended to read both streams. | |
| Migrate lazily -- on first read | Consumers merge on read. No write-side migration. Read-time complexity. | |

**User's choice:** One-time merge script (D-02).
**Notes:** Plan 121-00 must be atomic -- writer + migration + hooked-rescore-117 repoint ship together.

### Q3: Rotation policy for events.jsonl?

| Option | Description | Selected |
|--------|-------------|----------|
| By date -- one file per ISO week | `events-2026-WNN.jsonl`. Predictable, aligns with beta cadence, easy gitignore. | ✓ |
| By size -- rotate at N MB | Standard log-rotation pattern. Less aligned with beta-window analysis. | |
| No rotation -- single file forever | Simplest. Unbounded growth risk. | |

**User's choice:** ISO-week rotation (D-03).

---

## Area 2: Capture Surface Scope

### Q4: High-signal capture points (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| F-shape selector picks (88.2 + 125) | Every verb pick + ranker confidence + RECOMMENDED-rendered flag. THE highest-signal trajectory. | ✓ |
| Tension hook engagement (116) | User response to cross-session contradictions (resolve/defer/ignore/TTR). | ✓ |
| Auto-explore acceptance (117) | User decision on auto-discovered domains (kept/redid/ignored). | ✓ |
| Breakthrough dismissal + F.7 picks (120) | Surfaced breakthrough + verb + ethics tier + voice-audit pass/fail. D-19 canary normalizes here. | ✓ |

**User's choice:** ALL FOUR (D-04, D-05, D-06, D-07).

### Q5: Secondary capture points (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| MVA + Hooked re-score (inherit) | Already shipped writers; just normalize schemas. Zero new wiring. | ✓ |
| Empathy audit observations | Tester engagement signals (engaged-15m / returned-48h / handed-back). Already corpus driver. | ✓ |
| Room-as-receipt writes (119) | Each Larry-conversation room generation. Sub-claim 3 validation signal. | ✓ |
| PostToolUse broad sweep | Every `/mos:*` invocation. Volume risk; recommended OFF. | ✓ |

**User's choice:** ALL FOUR (D-08 inherits MVA+Hooked; D-09 covers empathy + 119 + PostToolUse).
**Notes:** User reversed Claude's "Recommended OFF" on PostToolUse -- triggered follow-up Q6 below.

### Q6: PostToolUse broad sweep -- constraint (since user picked ON)

| Option | Description | Selected |
|--------|-------------|----------|
| Sample at 100% but separate type bucket | `type: command_invocation` (separate from high-signal). Consumers filter by type. No drown risk. | ✓ |
| Sample at 10% randomly | Lower volume, lossy. Hooked re-score stats degrade. | |
| Opt-in per-command via frontmatter flag | Each `/mos:*.md` declares `telemetry: true`. More targeted, more setup. | |
| Keep ON, no constraint (firehose) | Full volume, no filtering. Consumer responsibility. | |

**User's choice:** Separate type bucket at 100% sampling (D-09 PostToolUse clause).
**Notes:** Resolves the volume-vs-completeness tradeoff cleanly. SEED-002 ingestion path filters by `type` before consuming -- `command_invocation` events are ignorable when training on high-signal navigation data.

---

## Area 3 + 4: Schema + Part 8 + Observability (batched)

### Q7: Schema versioning -- how does v1.13.0 telemetry survive SEED-002 onboarding?

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen v1 + `schema_version` per row | Every event tagged. v1 + v2 + future coexist in same file. Per-version consumer dispatch. | ✓ |
| Versioned filenames (events-v1-WNN.jsonl) | Schema baked into filename. More files, cleaner separation. | |
| Single rolling schema with additive-only changes | No version field. Locks design to additive-only. Most disciplined, least escape hatch. | |

**User's choice:** Frozen v1 + per-row schema_version (D-10).

### Q8: Part 8 enforcement -- canonical pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Emit-time validator inside writer module | Match `mva-telemetry.cjs`. Single chokepoint per Canon Part 9. Pre-commit guard becomes redundant. Already proven. | ✓ |
| Pre-commit guard scans file post-write | Reactive. Catches after landing. Higher leak risk between write and commit. | |
| Both layers (defense in depth) | Belt + suspenders. Extra surface to maintain. | |

**User's choice:** Emit-time validator (D-11).

### Q9: Corpus observability -- how does user see progress toward SEED-002's >=100 trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent -- no user-facing surface | Telemetry is lab-side concern. SEED-002 reads + decides. Lower cognitive load. | ✓ |
| Single status row in /mos:status | `Trajectory corpus: 47 / 100 events`. Visible but unobtrusive. | |
| Dashboard widget | /mos:dashboard with event-type breakdown + chart. High visibility. Builds UI that may not survive SEED-002. | |

**User's choice:** Silent (D-12).

---

## Close-out gate

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Write 121-CONTEXT.md and proceed. | ✓ |
| Explore more gray areas | Surface 2-4 more (writer module location / backfill of pre-Phase-121 telemetry / test strategy / mva-telemetry deprecation timeline). | |

**User's choice:** Ready for context.

---

## Claude's Discretion (12 decisions captured; remaining is planner's call)

- Exact module location for unified writer (`lib/core/telemetry/writer.cjs` vs `lib/core/trajectory-telemetry.cjs` vs extension of `lib/core/mva-telemetry.cjs`). Suggested in `<specifics>`: `lib/core/telemetry/writer.cjs` + sibling `lib/core/telemetry/validator.cjs`.
- Exact filename pattern for per-week files (zero-padded week? `2026-W05` vs `2026-W5`?).
- Backup naming convention for migrated originals (`*.pre-v121.bak` is fine; planner may prefer `*.archived-by-phase-121.jsonl`).
- Test strategy for the emit-time validator (suggested: Canon Part 8 adversarial fixture suite mirroring Phase 110-05's seed-pattern approach).
- Whether `lib/core/mva-telemetry.cjs` ships a deprecation warning in v1.13.0 or stays silent until v1.14.0.

## Deferred Ideas

- `lib/core/mva-telemetry.cjs` actual deletion (v1.14.0 housekeeping todo, not this phase).
- agent-lightning consumption pipeline (SEED-002 domain).
- Cross-user telemetry aggregation (constitutional NEVER per Canon Part 8; filed here so future planners know it was rejected).
- Per-command frontmatter telemetry opt-in (considered, rejected for D-09 single-bucket approach; revisitable in v1.14.0 if volume issues surface).
- User-facing corpus surface (e.g. `Trajectory corpus: N / 100 events` row) -- explicitly rejected (D-12).
- Dashboard widget for telemetry (same rejection as above).
- Pre-commit guard scanning files post-write (redundant under D-11 emit-time validation).

---

*Audit trail closed: 2026-05-19*
