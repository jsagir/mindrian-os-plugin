# Session Handoff: Plan Phase 141

Created 2026-06-05. Read this first in the new session. House rule: hyphens only.

## Start here

1. Read the master context index (one read = full context):
   `~/MindrianRooms/mindrianOS/product-evolution/v1.13.0-memory-system-review/LARRY-REACHES-CONTEXT-INDEX.md`
2. Confirm active room is mindrianOS: `/mos:rooms where` (it was set 2026-06-05).
3. First command: `/gsd:discuss-phase 141` (Phase 141 has RESEARCH but NO CONTEXT yet), then `/gsd:plan-phase 141`.
   - Or go straight to `/gsd:plan-phase 141` (it will prompt about the missing context).

## Phase 141 scope (Local Retrieval Spine + Capability Dial), milestone v1.13.1 "Larry Reaches" (beta.7)

Requirements: RETR-01..04, LARRY-01, LARRY-02, LARRY-03, DRSCH-01..04, BUG-01, FILEVAL-02.
Goal: getRoomContext() 3-leg local fusion seeds the per-turn loop; commit + version-bump the 5-reach capability dial; ship the framework-led deep-research reach; fix the line-53 crash.

## MUST NOT FORGET (these will bite if missed)

1. COMMIT THE DIAL EARLY (LARRY-01). The "When to Reach -- The Capability Dial" section (now 5 reaches incl. framework-led deep research + reach rule 6) is an UNCOMMITTED working-tree edit in `skills/larry-personality/SKILL.md`. It is one `git stash`/`checkout` from gone. Commit it to HEAD with `canon_parts: [2, 3, 8, 9]` frontmatter + CHANGELOG entry as the FIRST execution step, before any stash-risky work.
2. FOLD THE ONLINE STUDY INTO 141 RESEARCH (DRSCH). `141-RESEARCH.md` PREDATES DRSCH -- it only covers getRoomContext + the dial doctrine. At plan time, fold `DEEP-RESEARCH-PARADIGM-online.md` (plan-and-execute + framework-shaped Brain planner + hat-scoped Tavily) into the phase research so DRSCH-01..04 is GSD-researched, not assumed.
3. LARRY-03: when committing the dial, encode 5 STABLE machine-readable reach ids (context_block, contradiction, cross_room, brain_consult, deep_research) so the downstream Phase-143 dial-TUI keys off them; add a drift test asserting exactly 5 canonical reaches.
4. RETR-03: getRoomContext keeps raw prose LOCAL -- do NOT reuse `packet.cjs` projectText/hashText (that egress path HASHES; reusing it would hash away Larry's own context). Canon Part 8.
5. RETR-04: benchmark per-turn assembly under the 1200ms NAV timeout (graph-ranking first; FTS5 only if it underperforms).
6. FILEVAL: validate every decision + research conclusion writes to room.db; remind what filed. Do not assume filing.

## Pending, INDEPENDENT of 141 (operator's call)

Publish Phase 140 (v1.13.1-beta.6, already cut locally, 27 commits unpushed):
```
git push origin main --tags
# then sync ~/mindrian-marketplace marketplace.json -> version 1.13.1-beta.6 + source.ref v1.13.1-beta.6
# release-gate: validate the "up to 57x" claim with: node scripts/scout-telemetry-aggregator.cjs --mos-only
```

## State truth (FILEVAL)

All milestone work is durable committed MD (`.planning/` + the room folder). The LOCAL GRAPH (room.db) is still untouched (frozen May 31). Decisions + research conclusions are not yet typed edges -- that is the gap Phase 141 (FILEVAL-02), 142, and 143 (DIALTUI/MEMDIAL/FILEVAL) close. MD is the source of truth until then.
