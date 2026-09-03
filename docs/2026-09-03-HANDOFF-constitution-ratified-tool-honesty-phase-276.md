MOST RECENT. Supersedes every earlier 2026-09-03 handoff row in CLAUDE.md (the
constitution doc and the assessment doc both stay useful as evidence trails, not as
the current position). Read this file in full before touching anything named below.

## Where things actually stand

The MindrianOS Reasoning Constitution is RATIFIED at v3.1.2:
docs/2026-09-03-CONSTITUTION-v3.1.0-mos-reasoning-constitution.md (filename kept for
continuity, version is 3.1.2 inside). Every ruling in it (R15-R21) is resolved:
shipped as code, marked design-final and handed off, or satisfied with real evidence.
Nothing about the constitution itself is still open. Do not re-litigate it; if you
think something in it is wrong, that is itself worth a fresh finding, not a reason to
assume the doc is stale.

R21 in particular is CLOSED FOR REAL, not just rhetorically: a real transcript (an
IRIS investor-intro call, Roy Munin / Ido Gur / Jonathan Sagir, filed in the iris2026
room at sessions/2026-09-03-roy-munin-ido-gur-investor-intro.md) was run through Six
Thinking Hats (BONO) and the result, including a traced insight verified against the
actual quote, is filed at
sessions/2026-09-03-think-hats-ido-gur-iris-fit-t9-certification.md in that same room.
Every write in that whole exercise was independently verified against room.db's own
mtime before/after -- not trusted from any tool's response text. That discipline is
why the next section exists.

## Shipped this session, all verified, all on main

Two-repo work (MindrianOS-Plugin + Theo, coordinated, not duplicated):

- brain_query silent-empty-return bug fixed (f264c843, 8aca8af7)
- R16: SOURCED_FROM minted, RELATED_TO soft-deprecated (27109d3a and 2 more)
- R17: node-write consolidation, fail-closed epistemic_type validation
  (30b31b05 and 3 more) -- lib/core/node-insert.cjs is now the single node-write
  chokepoint, 34 sites across the repo
- R18 (revised): epistemic cap lives on lib/conversation/operator.cjs, not
  conversation-mode's 3-lane system -- the original ruling was reversed after live
  evidence showed conversation-mode can't carry a per-turn cap (2a08122f and 2 more)
- R19: /mos:operator set migrated onto the real gate ledger (e29a7480 and 2 more)
- T2 (the write-back path) fully built in three pieces: gate-card schema
  (0446bbab, 78ae0e53), the skill-prompt convention telling Larry to populate
  evidence_node_ids (9c2250d4, b7dd0450), and the actual node-writing wire-up
  (492c6b1c, 2c8dfddf, afcdd8cb) -- a gate approval now leaves a real claim node
  with SOURCED_FROM provenance, not just a bookkeeping row
- A real production bug found and fixed: meeting's file-meeting MCP command
  claimed in its own description that it files transcripts; the code never wrote
  anything. Fixed the honesty half (3a35f4f6, 2f1f4cf3, 86c2e1e1). Full record:
  .planning/debug/meeting-file-meeting-false-success.md, status partial-close
  (the real underlying gap is Phase 276's job, see below)
- scripts/check-tool-honesty.cjs built: a permanent advisory gate scanning every
  MCP tool description against its actual code (209b604f and 3 more). First live
  sweep: 36 tools / 130 branches, 1 HIGH RISK, 8 MEDIUM, 1 UNKNOWN, 120 OK.
  Untriaged by design -- that's Phase 276's job.

On the Theo side (different repo, /home/jsagi/Theo): the navigator's own
"Theo behaves like a book, not a calibrator" observation was independently confirmed
(recommend_chain lost its pagerank-seeded FEEDS_INTO walk) and Theo's own team
ratified the resulting analytics-boundary split directly into their CLAUDE.md, citing
this session's cross-reference notes. SEED-011 / SEED-012 and Phase 11 ("The
Calibrator") on Theo's roadmap are the deeper, still-open piece of that finding --
not this repo's work to do.

## What's open, in priority order

**Phase 276 (MCP Tool Honesty - Triage and Close), just registered, CRITICAL,
depends on Phase 275, not yet planned.** Run `/gsd-plan-phase 276` to break it down.
Three real pieces:
1. Triage and close the 9 findings from the check-tool-honesty.cjs sweep -- start
   with orchestration.scout (the HIGH RISK one: claims "ordinary reads and writes",
   falls through to a read-only reference echo).
2. Decide the meeting-file-meeting RCA's still-open real defect: Desktop and Cowork
   users have never reached the real, verified DIKW meeting-filing pipeline Phase
   150.8 built (Claimify 4-pass extraction, typed claim writes, human-confirmation
   gate) -- it only ever shipped into the CLI slash command
   (commands/file-meeting.md). The RCA's own Consult section (icm-architect +
   langtalks-graph-expert, both honestly recorded) has a proposed shape: don't
   duplicate the extraction logic, route the MCP surface through small
   single-job tool calls with real gate_render/gate_answer confirmation. Design
   only, not approved or built.
3. Decide whether to extend check-tool-honesty.cjs for the extract_shallow-class
   limitation (a write call that's textually present but argument-gated behind a
   value its caller never supplies -- real dataflow analysis, past what the current
   static heuristic reaches) or accept it as a documented boundary.

Also flagged, not registered as a phase: Theo's own ~27 tools deserve the identical
check-tool-honesty.cjs-style audit before Theo goes into production as a standalone
MindrianOS service -- that is Theo's own repo's work, not this one's.

## Things worth knowing before you touch this repo tonight

**This is an actively shared working tree.** Another parallel Claude Code session
(Phase 267.2, "First Install Hooked Loop Repair") has been committing here all
session, with zero worktree isolation (workflow.use_worktrees=false for this
project). Before every commit: `git diff --cached --name-only` and confirm every
staged file is one you actually meant to touch. At least four real collisions
happened tonight (both directions), all caught before landing, none destructive.
If a commit hangs past ~90 seconds, it is very likely a slow pre-commit hook, not a
real failure -- check `git log --oneline -1` before assuming otherwise.

**Trust nothing an MCP tool's response claims about its own side effects.**
Two real instances tonight where a tool's response read as a success and was not:
`meeting`'s file-meeting command (fixed), and an executor's own cleanup claim after
accidentally writing test debris into the real motj-ecosystem room (caught by
independently querying room.db directly, not trusting the summary). Use
`node -e "require('node:sqlite')..."` against the actual room.db, or check file
mtimes directly, before believing any write happened.

**`gsd-tools.cjs query phase.add` has a live heading bug** -- a long description
passed as the phase argument lands as the literal ROADMAP.md heading instead of
being split into a short title plus a Goal field. Caught and hand-corrected for
Phase 276 this session; check any future phase.add call's actual ROADMAP.md output
before trusting it.

**STATE.md's Quick Tasks Completed table keeps shifting line numbers** (the
documented resync-clobber pattern, 20+ prior occurrences) -- always re-locate it by
`grep -n "^### Quick Tasks Completed"` before editing, never trust a remembered line
number from earlier in the same session.

## Where to actually start

Read this file, then `/gsd-plan-phase 276`. Everything else from tonight is closed,
committed, and does not need re-verification unless something about it looks wrong
in which case say so rather than assuming it is fine.
