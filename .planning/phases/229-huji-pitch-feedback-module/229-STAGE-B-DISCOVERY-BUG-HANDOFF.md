# Phase 229 - Stage B Discovery Bug: Handoff for a Fresh Session (2026-07-16)

**Status:** Root cause CONFIRMED. Fix shape A chosen by the navigator (2026-07-16
rd2 session) and IMPLEMENTED - `Glob` added to Stage B's `--allowedTools` in
`scripts/huji-run-one.cjs::buildStageBArgs` as a deliberate, reviewed exception to
the 229-10 byte-for-byte lock on that file. The D14 parity gate and
`bash tests/run-all-229.sh` (PASS=10 FAIL=0 SKIP=0) were re-run green after the
change. This file is the complete handoff - do not re-derive any of this by
re-running live (costly) demos; the evidence below is already gathered.

**Read this file in full before proposing anything.** Also read
`DR-FRAMEWORK-ARCHITECTURE-DECISION.md` in this same directory (the prior
handoff from earlier the same day) - the report-shape ruling there (Minto
pyramid, not the 11-section Dr. Framework report) still stands and is
unaffected by this bug.

---

## 1. What's DONE and shipped (do not redo)

`229-10-PLAN.md` executed clean, on `main`, commits `ee9246b1`..`d0465a6a`:

- `scripts/huji-run-one-async.cjs` - CASCADE-06 non-blocking twin of the shipped
  `scripts/huji-run-one.cjs::runOne`. `scripts/huji-run-one.cjs` and
  `scripts/huji-batch.cjs` are **byte-for-byte unmodified** - verified, and this
  is a locked must-have. Do not touch them without a deliberate, reviewed
  decision.
- `lib/memory/huji-run-one-async-parity.test.cjs` (D14 gate) - proves
  `runOneAsync` and `runOne` return structurally identical failure envelopes.
  Passes.
- A code review (`229-REVIEW.md`) found and fixed one real Critical: `subId`
  (the file's own JSDoc calls it "untrusted external input") was only checked
  for non-empty before `path.join(outDir, subId)` - a path-traversal hole.
  Fixed in `955e8954` with an anchored allowlist regex
  (`^[A-Za-z0-9_-]{1,128}$`), reusing the existing `invalid_subId` reason code
  per the file's own stability contract. Verified live with an actual
  `../../../../tmp/pwn` payload - rejected.
- `bash tests/run-all-229.sh` -> `PASS=10 FAIL=0 SKIP=0`.
- Phase verification: `human_needed` (correct - Amnon's verdict, Jonathan's
  sign-off, and the HUJI calibration workshop are still pending, tracked in
  `229-UAT.md`, unaffected by anything below).

**Separate repo:** `github.com/jsagir/mindrian-pitch-feedback-mcp` (private).
Thin MCP wrapper, scaffold only (`bin/server.cjs` is a stub that throws on
purpose). Pins a git-tag checkout of `jsagir/mindrian-os-plugin` via
`MINDRIAN_OS_ROOT`, currently `v1.15.3-beta.26` (an interim beta - confirmed
`v1.15.2` has ZERO `PWS_grading` references; no stable tag has it yet). Do not
build the actual MCP server there until this bug (or the new approach) is
resolved - there is nothing working yet to wrap.

---

## 2. The bug: Stage B cannot discover its own populated input

**Confirmed across 4 independent live runs, ~$5.21 real spend, zero successful
grades.** Not a 229-10 regression - this is pre-existing, shared code
(`buildStageBArgs` in `scripts/huji-run-one.cjs`), so `runOne()` (sync) would
hit this identically.

### The mechanism

`buildStageBArgs(config)` (huji-run-one.cjs:280) spawns Stage B with:

```
--allowedTools 'Read,Write,Edit,Bash(node lib/core/*)'
```

No `Glob`. `Bash` restricted to only `node lib/core/*` invocations. Stage B's
prompt is just `-p '/mos:pipeline PWS_grading'` with `cwd: roomDir` - it relies
ENTIRELY on the live session discovering its own input by exploring the room
directory. But it structurally cannot:

- No `Glob` -> cannot list the room directory to find
  `pitch-intake-<subId>.md` (the file `populateRoom()` genuinely writes, with
  the correct byte-verbatim transcript content - verified on disk directly,
  twice).
- `.mindrian/room.db` is a binary SQLite file -> unreadable via plain `Read`,
  and no `Glob`/general `Bash` to query it (it DOES contain real typed claim
  nodes with the correct content - verified directly via
  `node:sqlite` `DatabaseSync`, 12 nodes, real transcript quotes).

Stage B's own session said it plainly (`studyapp-demo` run 2, feedback.md):

> "Bash and Glob were denied this session, so directories could not be listed
> and `.mindrian/room.db` is binary and unreadable... If Stage A wrote claim
> nodes into room.db only, they could exist unseen. This branch is not fully
> closed."

The model does the RIGHT thing given what it can see: it refuses to fabricate
a grade and halts honestly ("NO-SUBMISSION-FOUND" / "no-submission-bound").
That discipline is working. The room-population and the tool-permission
contract around Stage B are not talking to each other.

### What was ruled out (do not re-investigate)

**Brain/Neo4j connectivity was NOT the cause.** First 2 live attempts (before
any Brain key existed) failed this way. A Brain key was then live-verified
working end-to-end (`node scripts/doctor.cjs --brain-smoke` -> PASS all 5
layers: plugin-root, key-resolver, HTTPS schema probe, MCP stdio handshake,
e2e `brain_schema` query). Re-ran both samples again with Brain fully
connected - **same class of failure recurred** (one `stageB_nonzero`, one G1
ungrounded-quotes gate catching the session quoting its own STATE.md
scaffold text instead of real transcript content). Four live attempts total,
two before Brain, two after, same root shape both times.

Brain key now lives at `~/.mindrian.env` (`MINDRIAN_BRAIN_KEY=...`, chmod 600,
outside any git repo - never printed to a transcript, never committed). If a
fresh session needs to re-verify it's live: `node scripts/doctor.cjs
--brain-smoke` (5-layer probe, reports the exact failing layer if any).

### Evidence trail (for the fresh session to re-check without re-spending money)

- Run 1 (pre-Brain-key): `/home/jsagi/MindrianRooms/huji-demo-run-2026-07-16T14-34-18-468Z/`
- Run 2 (post-Brain-key): `/home/jsagi/MindrianRooms/huji-demo-run-2026-07-16T16-06-09-171Z/`
- Both contain `RUN-SUMMARY.json`, per-sample `evidence.json` (real, correct),
  `feedback.md` (the halt reports, worth reading verbatim), and
  `result.json` where Stage B ran far enough to produce one.
- Populated rooms (still on disk, for direct inspection):
  `/home/jsagi/MindrianRooms/rooms/safescan-demo/` and `.../studyapp-demo/` -
  both have `pitch-intake-<subId>.md` (correct content) and a `.mindrian/room.db`
  with real typed claim nodes (query via `node:sqlite`, not `sqlite3` - not
  installed in this environment).
- The one-off harness script used for all 4 runs: `/tmp/huji-demo-run.cjs`
  (calls `runOneAsync` directly against the two real HUJI samples at
  `.planning/phases/229-huji-pitch-feedback-module/samples/`). Reusable as-is
  for a 5th attempt once a fix is chosen - do not rebuild it.

---

## 3. Two fix shapes considered - shape A CHOSEN and implemented (navigator ruling, 2026-07-16 rd2 session)

**A. Widen the allowlist. CHOSEN (navigator ruling, 2026-07-16 rd2 session).**
Add `Glob` (or a specific `node lib/core/*` discovery script) to Stage B's
`--allowedTools` so it can find `pitch-intake-<subId>.md` and/or query `room.db`
itself. Smallest diff, but still relies on the live session doing its own
discovery correctly under time/turn budget - fragile, and exactly the kind of
implicit-discovery pattern this whole phase has otherwise moved away from
(229-10's own stability-contract discipline, the AI-SPEC's G8 "required, not
defaulted" philosophy).

Implementation note: `Glob` was added to the allowlist, NOT a net-new discovery
script - a smaller one-token diff, no net-new Canon Part 11 invocable surface to
be born-wired with a HITL shape, and read-only capability only (the Bash
allowlist stays `node lib/core/*`). Delivered via the `/gsd-quick` 260716-rd2 plan
as a deliberate, reviewed exception to the 229-10 lock; D14 parity and
run-all-229 re-run green.

**B. Stop relying on discovery at all (more consistent with how this phase
already thinks). CONSIDERED, NOT adopted.** Pass Stage B the evidence content or
exact file paths explicitly in its prompt/args - the same "explicit, not
implicit" instinct already applied to `rubricContext` in the AI-SPEC's G8
guardrail design. Requires changing `buildStageBArgs(config)`'s signature
(currently takes only `config`, not `subId`/`roomDir`/evidence) - a real,
deliberate change to shared code, needs the same care 229-10 gave `runOneAsync`
(parity-tested, not silently touching the frozen sync file without a plan). Kept
here for the record as the fallback if shape A proves fragile in the single
post-fix live confirmation run.

**Both shapes were reviewed with a plan** - this repo's own CLAUDE.md GSD
workflow enforcement rule applied (the `/gsd-quick` 260716-rd2 plan carried the
decision, not a direct edit).

---

## 4. RESOLVED - navigator-approved risk acceptance (2026-07-16 rd2 session), separate from the bug above

**An IP/security exposure was surfaced this session; the navigator reviewed it
and explicitly chose to ACCEPT the risk rather than block on it. This is a
closed, navigator-approved risk acceptance, not an open item.** The navigator
pasted a Neo4j-hosted "MCP agent" config
(`mcp.neo4j.io/agent?project_id=...&agent_id=...`) as a candidate alternative
Brain backend. That config's `system_prompt` field contains a
**verbatim, complete copy of the full Larry system prompt** (voice DNA,
lexicon, assessment philosophy - everything), plus a `Text2Cypher` tool and
raw Cypher query templates against what is presumably a copy of the teaching
graph, with `"is_mcp_enabled": true` and, most importantly,
**`"is_private": false`**. This was flagged as a real Moat Mandate / Canon
Part 8 concern (the CLAUDE.md's own language: "prompts can be copied, the
graph is the moat" - this config has both, unrestricted, and the privacy flag
reads as off). The factual findings above are preserved verbatim for the record.
The navigator's ruling: ACCEPT the risk; nothing was wired in and no code change
is planned. Any future decision to actually wire that agent in would be a new,
separate decision - not covered by this acceptance.

---

## 5. What the new session should do first

1. Read this file in full, plus `DR-FRAMEWORK-ARCHITECTURE-DECISION.md`.
2. Read the two halt reports verbatim (`feedback.md` in both `RUN-SUMMARY.json`
   output dirs above) - they are better evidence than any summary of them.
3. RESOLVED - fix shape decided: A (navigator ruling, 2026-07-16 rd2 session),
   `Glob` added to Stage B's allowlist and both gates re-run green. No further
   decision needed here.
4. Re-run the existing `/tmp/huji-demo-run.cjs` harness only ONCE a fix is
   actually in place - each attempt costs real money (~$0.1-$2.5 depending on
   how far Stage B gets before halting) and this file already has the
   evidence from 4 prior attempts. This single post-fix live confirmation run
   remains future, optional, and navigator-triggered only.
5. RESOLVED - the Neo4j MCP agent privacy question was resolved as a
   navigator-approved risk acceptance (see section 4), independently of the
   discovery-bug fix.

---

*Filed 2026-07-16. Everything in this file is drawn from live, verified
evidence gathered this session - not assumed or extrapolated.*
