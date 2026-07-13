# Phase 219: Corepower-Isolation Validation (paste-ready, Desktop / Windows)

**What this is:** the last human gate before Phase 219's release readiness can close. The full
opportunity pipeline is already proven live on ador-ip-test (219-VERIFICATION.md Sections 2R-3.4,
navigator-approved). What only YOU can prove is this same pipeline on the corepower-isolation
room - which exists only on your Desktop (Windows) machine. That machine matters for two
specific reasons:

1. **It is the machine that crashed.** Its Node SQLite build lacks the FTS5 module; eureka used
   to die there with `no such module: fts5`. Plan 219-02 fixed that with a probe + graceful
   bi-modal degrade. This run proves the fix live on the exact machine that exposed the bug.
2. **It closes an open debt.** The previous eureka run on corepower-isolation used a manual
   reconstruction, not the shipped engine - zero of the production 211-216 code ran. This run
   uses the PRODUCTION engine path only. If the engine cannot run, that is a recorded FAIL,
   never a quiet fallback.

**Where to run:** open the corepower-isolation room on the Desktop (Windows) machine, then paste
everything between the START and END markers below into the conversation as one message. The
Larry there does the work; you only tick the checklist at the end and paste it back here.

One honesty rule for what you paste back: counts, version strings, and provenance lines only -
never room prose, never entity names from the room (standing no-real-names rule).

---

## PASTE FROM HERE (START marker)

You are Larry, running the Phase 219 corepower validation. Follow these steps exactly, in
order. Use only the PRODUCTION engine surfaces named below - never reconstruct any step
manually, and never accept an "LLM manual run (high effort)" offer if one appears (that offer
existing means the engine could not run, which is exactly what this validation must catch).
Report each step's outcome with the exact output lines requested. If any step fails, STOP,
print the full error verbatim, and say plainly which step failed.

**Step 0 - build preflight (protects against a false FAIL on stale code).**
Resolve the active room with the plugin's `scripts/resolve-room`, then check the installed
plugin build actually carries the Phase 219 engine:

- Print the plugin version (from the installed plugin's `.claude-plugin/plugin.json`).
- Confirm `lib/core/eureka/tri-modal-index.cjs` exists in the installed plugin AND contains
  the string `bi-modal degrade`.
- Confirm `lib/core/eureka/opportunity-harvest.cjs` and `lib/core/eureka/qualify-opportunity.cjs`
  exist.

If ANY of those are missing, STOP here and report: "STALE BUILD - version <X>, missing <files>".
Do not run the rest; the navigator will update the plugin first. (Navigator note: the
marketplace pin is v1.15.3-beta.14, which predates these fixes - if you get STALE BUILD, this
machine needs the repo's current main. If it has a git checkout of MindrianOS-Plugin, pull
main and start the session from that build; otherwise paste the version line back and we will
sort the update path from the dev machine.)

**Step 1 - extraction + metadata (the production pass).**
Run: `node scripts/entity-extract.cjs <ROOM_DIR> run` (from the plugin root, ROOM_DIR from
Step 0). If it reports 0 artifacts on a room that clearly has content, the room graph likely
predates the current schema: run the production memory-cortex reconcile
(`lib/core/memory/reconcile-memory-runner.cjs` -> `reconcileMemoryArtifacts(roomDir, {db})` -
the same function session-start uses, never a reimplementation), then run extraction again.
Report the final status line: artifacts, entities, edges, metadata_applied.

**Step 2 - eureka, PRODUCTION engine, the FTS5 moment.**
Run the production dispatcher: `node scripts/eureka-command.cjs <ROOM_DIR> run`
(equivalently `/mos:eureka` - same engine underneath). This is the step that used to crash
this machine. Report verbatim:

- The banked line: `eureka-portfolio-report: banked N opportunity node(s), ...`
- The critic resolution line: `critic resolution - X resolved (Y passing), Z still pending`
- The provenance `fts_backend` value. It must be one of exactly two strings:
  `fts5` OR `absent (bi-modal degrade)`. EITHER is a PASS - the second one means the probe
  detected this machine's missing FTS5 module and honestly ran on the two remaining legs
  (vector + graph) instead of crashing. A `no such module: fts5` error is a FAIL.
- The `run_mode` value (expected: live, never a manual baseline).

If the default run banks 0 with honest `critic resolved` rejection lines (the critic refusing
low-quality statements is correct behavior, not a bug), re-run once with the documented live
tuning seam `MINDRIAN_OPPORTUNITY_BANK_PREDICATE=all` so the downstream banking/harvest/card
legs are exercisable, and say plainly that the second run used predicate `all`. Then verify
in the room graph that opportunity nodes now exist (`type='opportunity'` count > 0) and report
the count.

**Step 3 - harvest (SENS-14 production sensor).**
Run the production harvest over the room (`lib/core/eureka/opportunity-harvest.cjs` ->
`harvestCandidates(<ROOM_DIR>, {})`). Report: `ok`, the candidate `count`, the per-lane
breakdown, and for three sample candidates their `lens` label - each must be one of the four:
`leveraging_resources`, `challenging_orthodoxies`, `understanding_needs`, `harnessing_trends`.
Report labels and counts only, never the candidates' text.

**Step 4 - the qualification card.**
Run `/mos:qualify-opportunity` on the top candidate. The card must render as a REAL
interactive card (the native selectable-options widget), never an ASCII-art text box. Show
the navigator the card and let THEM pick the verb - Qualify+file if the candidate looks real,
Skip if it is noise (a Skip is a perfectly valid PASS for this validation; the card rendering
and dispatching is what is being proven, and a Skip writes an honest rejection edge). Report
which verb fired and the one-line result.

**Step 5 - report.** Print a compact summary block: plugin version, extraction counts, eureka
banked count + fts_backend + run_mode, harvest count + sample lens labels, card verb + result.
Counts and enum strings only - no room prose.

## PASTE TO HERE (END marker)

---

## Your pass/fail checklist (tick and paste back to the dev machine)

- [ ] Step 0: build carries the 219 engine (no STALE BUILD stop)
- [ ] Step 1: extraction + metadata completed (artifacts > 0, metadata_applied > 0)
- [ ] Step 2: eureka ran the PRODUCTION engine (run_mode live; no manual baseline, no
      "LLM manual run" offer accepted)
- [ ] Step 2: NO `no such module: fts5` crash; the `fts_backend` line reads `fts5` OR
      `absent (bi-modal degrade)` - either one is a PASS
- [ ] Step 2: opportunity nodes exist in the room graph post-run (count > 0; predicate `all`
      re-run is fine if the strict critic honestly rejected the first pass - say which)
- [ ] Step 3: harvest returned candidates and the sampled candidates carry Four-Lens labels
- [ ] Step 4: the qualification card rendered as a real card, not an ASCII box, and your
      verb (Qualify+file or Skip) dispatched with an honest result line

Paste the ticked checklist plus the Step 5 summary block back and type "confirmed" - it lands
verbatim in 219-VERIFICATION.md Section 4, closes the open post-218 corepower eureka re-run
item, and opens the joint 219+220+221 release gate (the cut itself runs at Phase 221
completion via scripts/release.sh, never by hand).

If ANYTHING fails - an fts5 crash, a STALE BUILD you cannot update past, a card that renders
as text, an engine step that only works via manual fallback - paste the exact error. It routes
to the owning plan as a gap-closure item before release staging proceeds; it never gets
hot-patched past this gate.
