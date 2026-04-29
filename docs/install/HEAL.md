# /mos:heal -- Room Wiring Heal

> Status: shipped in v1.11.1 (Plan 94.1-01)
> Audience: any user who upgraded their room across a major plugin version
> (v1.10.x to v1.11.x) and needs to repair structural drift without manual
> intervention.

---

## Section 1 -- Why this command exists

When a room ages across plugin versions, structural debt accumulates:

- canonical sections from newer plugin versions are missing on disk
- per-section `ROOM.md` files drift away from the v1.11.x identity contract
- per-section `STATE.md` files were never written (older plugin versions only
  computed root STATE.md)
- `MINTO.md` files go stale as artifacts get filed without regeneration
- `.mindrian/room.db` (the local SQLite knowledge graph) holds an obsolete
  index that does not reflect newer artifacts
- the `brain-derivation-queue.json` accumulates entries that should have
  been processed by a later session-start hook but were not

`/mos:heal` is the one-command path to bring a room back to v1.11.x
conformance. The command was authored AS it was executed on the
dog-fooding mindrianOS room on 2026-04-29; the recipe artifact at
`~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md`
is the spec.

The QA harness on the `mos-qa-quantum-v1.11.0` reference room (Lawrence
Aronhime, 2026-04-28) would have surfaced the missing-section /
missing-ROOM.md / stale-MINTO drift in 30 seconds with `/mos:heal`. v1.11.1
ships the command so the next QA session has the heal path in hand.

---

## Section 2 -- When to run

- After `claude plugin update mos@mindrian-marketplace` upgrades you across
  a major version
- When `/mos:status` shows `EMPTY -- GAP` on canonical sections that should
  have ROOMs
- When the on-stop invariant report (`.mindrian/invariant-report.json`)
  shows `severity: error` violations
- When `minto-stale.json` shows `artifacts_newer_than_minto` for many
  sections
- Before generating a power demo, vault export, or first-contact viewer
  artifact (heal first; export from a clean state)

You can also invoke heal in `--dry-run` mode any time you want to preview
what the orchestrator would touch without mutating the room.

---

## Section 3 -- What it does (10 steps, idempotent)

Each step is wrapped in the orchestrator at `scripts/heal-command.cjs`.
Every step records `{status, duration_ms, details}` into the heal-log
envelope. No step throws on failure; per-step errors are logged and
later steps continue.

| Step | Action | Existing script wrapped | Idempotent |
|------|--------|-------------------------|------------|
| 1 | Backup current state to `.heal-backup/<TS>/` | inline cp orchestration | yes |
| 2 | Create missing canonical sections | inline mkdir | yes |
| 3 | Write `01-section-seed.md` in newly-created sections | inline write | yes |
| 4 | Refresh `.mindrian/room.db` | `scripts/migrate-lazygraph.cjs --force` | yes |
| 5 | Backfill missing `ROOM.md` per section | inline write | yes |
| 6 | Generate per-section `STATE.md` | `scripts/vault-section-state-generator.cjs` | yes |
| 7 | Generate or refresh per-section `MINTO.md` | `scripts/vault-section-minto-generator.cjs --write` | yes |
| 8 | Read `.mindrian/brain-derivation-queue.json` (read-only) | inline read | n/a |
| 9 | Recompute root `STATE.md` | `bash scripts/compute-state` | yes |
| 10 | On-stop invariant scan (passive) | reads `.mindrian/invariant-report.json` | n/a |

The 8 canonical sections in v1.11.x are: `problem-definition`,
`market-analysis`, `solution-design`, `business-model`,
`competitive-analysis`, `team-execution`, `legal-ip`, `financial-model`.

---

## Section 4 -- What it does NOT do (v1.11.1)

These items are explicitly out of scope for v1.11.1. Each has a v1.12
candidate plan and an explicit re-trigger condition (see Section 8).

- **No FEYNMINTO-01 budget override.** Step 7 graceful-degrades on
  mega-sections (40+ artifacts) by writing a tier-0 fallback MINTO and
  logging `status='blocked_feynminto_01'`. Heal does not bypass the
  budget; v1.12 will scale it.
- **No brain-derivation-queue drain.** Step 8 is read-only. It reports
  queue depth and age of the oldest entry but never invokes any drain
  processor. v1.12 will add the drain hook.
- **No auto-section-scaffold on plugin upgrade.** Heal Step 2 creates
  missing canonical sections when invoked, but the plugin does not
  auto-scaffold on upgrade. Users must run `/mos:heal` after a major
  version upgrade. v1.12 will add the post-install hook.
- **No Brain queries.** Heal is LOCAL-only per Canon Part 8. Zero user
  data leaves the room. The brain-derivation-queue entries the heal
  records are local pointers; the actual derivation happens in a
  separate (deferred) hook.
- **No git operations.** Heal does not commit, push, or stash. The
  `.heal-backup/<TS>/` directory is the safety net; if heal made changes
  you want to revert, copy from the backup. The user owns version
  control.

---

## Section 5 -- Output (`heal-log.json`)

Every heal run writes `<room>/.mindrian/heal-log.json`. The envelope is
the canonical record of what heal did and is the input artifact for any
post-heal review. Schema:

```json
{
  "schema_version": "1.0",
  "started_at": "2026-04-29T07:51:49.957Z",
  "ended_at":   "2026-04-29T07:51:51.917Z",
  "room_dir":   "/home/user/MindrianRooms/myroom",
  "backup_dir": "/home/user/MindrianRooms/myroom/.heal-backup/20260429-075149",
  "steps": [
    {
      "step": "step_01_backup",
      "status": "ok",
      "duration_ms": 27,
      "details": {
        "backup_dir": "...",
        "files_copied": 14
      }
    },
    {
      "step": "step_07_section_minto",
      "status": "ok_with_blocked",
      "duration_ms": 528,
      "details": {
        "sections_processed": 8,
        "ok_count": 7,
        "blocked_count": 1,
        "error_count": 0,
        "skipped_count": 0,
        "per_section": [
          {
            "section": "solution-design",
            "status": "blocked_feynminto_01",
            "detail": {
              "reason": "FEYNMINTO-01 budget exceeded; tier-0 fallback attempted",
              "minto_written": false
            }
          },
          ...
        ]
      }
    },
    ...
  ],
  "summary": {
    "ok_count": 8,
    "skipped_count": 1,
    "blocked_count": 0,
    "error_count": 0,
    "exit_code": 0
  }
}
```

`ok_count` includes both `'ok'` and `'ok_with_blocked'` (Step 7's
roll-up status when at least one section succeeded but at least one
section blocked). `blocked_count` counts only steps whose roll-up
status itself is `blocked_*`.

Exit codes:

- **0** any-step-success. One or more steps succeeded; this is the
  default healthy path even when a few sections graceful-degraded.
- **2** no-step-success. Every step errored. Rare; check
  `.mindrian/heal-log.json` for per-step reasons.

---

## Section 6 -- Mega-section limitation (FEYNMINTO-01 budget)

When a section accumulates 40+ artifacts, the rendered source list alone
consumes most of the 1500-token MINTO body budget. The narrative gets
squeezed below useful density and the writer rejects the write
(`narrative-schema.cjs` enforces FEYNMINTO-01).

**v1.11.1 behavior (graceful degradation):**

1. Step 7 invokes the MINTO writer per canonical section
2. If the writer rejects with `Narrative body token budget exceeded` OR
   `FEYNMINTO-01`, heal records `status='blocked_feynminto_01'` for that
   section
3. A tier-0 fallback MINTO (no-narrative path) is the only writer mode
   heal invokes; if even tier-0 is rejected, the budget block is logged
   and heal moves on to the next section
4. Other steps (1, 2, 3, 4, 5, 6, 8, 9, 10) are unaffected

**v1.12 candidates:**

- Relax FEYNMINTO-01 budget for high-N sections (per-section override)
- Introduce sub-section hierarchy so the writer walks sub-folders
  independently
- Archive-folder pattern (`_archive/`) so older artifacts do not consume
  the active section's budget

The recipe artifact (Section 'Open issues for the plugin' item 1) names
all three options. The v1.12 plan will pick one.

**Workaround until v1.12 ships:**

- Move older or completed artifacts to a sub-folder so the writer walks
  them independently
- Or accept that mega-sections stay on tier-0 fallback MINTO until the
  budget is fixed

---

## Section 7 -- Verification

After running heal, verify the result with two reads:

```bash
# Per-step status table
cat <room>/.mindrian/heal-log.json | jq '.summary, [.steps[] | {step, status}]'

# Backup directory populated
ls <room>/.heal-backup/
```

Expected outcome on a healthy heal:

- `.summary.exit_code` is `0`
- At least 5 of 10 steps have `status: "ok"` or `"ok_with_blocked"`
- Steps that are inherently passive (8, 10) may show `"skipped"` if the
  underlying file does not exist yet; that is normal
- The `.heal-backup/<TS>/` directory contains at least the pre-heal
  STATE.md and any per-section MOC files that were present before heal

If you see exit code 2 or every step has an `error_*` status, do NOT
re-run heal blindly. Open the heal-log first; the `details` field on
each errored step records the exit code, stderr tail, and reason from
the underlying script.

---

## Section 8 -- v1.12 candidates (deferred items)

Each item below has been logged to
`.planning/phases/94-v1-11-2-tester-driven-fixer/deferred-items.md`
with a re-trigger condition. v1.11.1 graceful-degrades; v1.12 fixes.

| Item | Code citation | Re-trigger condition |
|------|---------------|----------------------|
| FEYNMINTO-01 budget scaling for mega-sections | `lib/memory/narrative-schema.cjs` 1500-token body budget | When a monitored user room has a section with 40+ artifacts and the user reports inability to regenerate MINTO. OR when v1.12 milestone planning includes the budget-relaxation work. |
| brain-derivation-queue auto-drain hook | No drain processor exists; queue file: `<room>/.mindrian/brain-derivation-queue.json` | When the next session-start hook OR /mos:* command-completion hook is being modified for unrelated reasons; bundle the drain hook in. |
| Section auto-scaffold on plugin upgrade | No post-install hook walks the canonical-section list | When the next plugin version adds a new canonical section. OR when first external user reports their room missing a canonical section after upgrade. |

---

## Section 9 -- Provenance

This command was dog-fooded on the mindrianOS room itself during the
2026-04-29 wiring audit. The recipe artifact at
`~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md`
captures the 10 steps verbatim. The orchestrator
(`scripts/heal-command.cjs`) and the fixture suite
(`lib/memory/heal-command.test.cjs`) ship under BSL 1.1. The slash
command (`commands/heal.md`) follows the 4-zone UI ruling system at
`skills/ui-system/SKILL.md`.

Recipe execution evidence (mindrianOS room, 2026-04-29):

| Step | Action | Result on dog-food room |
|------|--------|-------------------------|
| 1 | Backup | `.heal-backup/20260429-081105/` |
| 2 | Create legal-ip | section directory created |
| 3 | Section seed | `legal-ip/01-section-seed.md` filed |
| 4 | room.db refresh | 166 artifacts, 9 sections, 175 nodes, 166 edges |
| 5 | ROOM.md backfill | 6 sections backfilled |
| 6 | STATE.md per section | 10 sections written |
| 7 | MINTO writes | team-execution OK, legal-ip tier-0, solution-design + meetings BLOCKED on FEYNMINTO-01 budget |
| 8 | Brain queue | 2 enqueued; processed on next hook |
| 9 | Root STATE.md | recomputed, 7644 bytes |
| 10 | Invariant scan | follow-up |

The Step 7 result on the dog-food room is the canonical reference for
what graceful degradation looks like in production: 5 sections OK,
1 tier-0, 2 blocked. The heal exited 0 and the user kept moving.

---

## Canon traceability

This command implements:

- **Canon Part 7 (Reuse Before Build):** wraps existing
  `scripts/migrate-lazygraph.cjs` (Step 4) +
  `scripts/vault-section-state-generator.cjs` (Step 6) +
  `scripts/vault-section-minto-generator.cjs` (Step 7) +
  `scripts/compute-state` (Step 9). Zero net-new methodology.
- **Canon Part 4 (Every Choice Is Graph Data):** writes
  `<room>/.mindrian/heal-log.json` capturing every section touched +
  every transition + every result. The cascade becomes graph-traceable
  data the user can review with `/mos:explain-decision` or any local
  graph traversal.
- **Canon Part 8 (Graph Boundary):** heal operates LOCAL-only. Reads
  STATE.md / ROOM.md / MINTO.md, runs local SQLite graph rebuild, writes
  local heal-log. Zero Brain queries; brain-derivation-queue is read
  but never drained inside heal (drain is a separate v1.12 hook).

---

## Related docs

- `docs/MINDRIAN-CANON.md` -- Part 7 (Reuse Before Build), Part 4 (Every
  Choice Is Graph Data), Part 8 (Graph Boundary)
- `docs/CANON-PHASE-MAP.md` -- canonical phase ledger
- `commands/heal.md` -- slash command frontmatter and 4-zone output
  contract
- `scripts/heal-command.cjs` -- pure CJS orchestrator (BSL 1.1)
- `lib/memory/heal-command.test.cjs` -- 6-fixture test suite (BSL 1.1)
- `~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-wiring-heal-process.md`
  -- recipe (dog-fooded source of truth)
- `.planning/phases/94-v1-11-2-tester-driven-fixer/deferred-items.md` --
  v1.12 candidate items with re-trigger conditions

---

_/mos:heal -- MindrianOS-Plugin v1.11.1_
