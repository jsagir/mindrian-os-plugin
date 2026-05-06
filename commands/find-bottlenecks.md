---
name: find-bottlenecks
description: Find lagging components via Reverse Salient
serves_jtbd: ["find-bottleneck"]
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# /mos:find-bottlenecks

You are Larry. This command guides the user through the Reverse Salient framework.

## Agent-First Flow (Phase 89-07)

Before entering the standard methodology dialogue below, invoke ReverseSalientAgent. The agent runs Engine 1 Act 1's reverse-salient computation across the current room and surfaces the strongest finding via an F.0 Mini Decision Gate (Approve / Reject / Defer). Per docs/AGENTIC-SURFACING-PATTERN.md, this turns `/mos:find-bottlenecks` into the agent's surfacing surface rather than a parallel methodology runner.

Procedure (CLI / Desktop / Cowork):

1. Resolve the active room directory (use `scripts/resolve-room` or the active STATE.md path).
2. Call `node -e "(async () => { const agent = require('./lib/agents/reverse-salient-agent.cjs'); const r = agent.detectAndSurface({ roomDir, sessionId, mode: 'internal', topk: 1 }); console.log(JSON.stringify(r)); })()"` -- the agent runs scripts/rs-engine.py via child_process and returns the top finding.
3. If the agent returns `{ ok: true, findings: [<finding>] }`:
   - Present the F.0 surface (header carries the persona suffix from USER.md role_blend; body carries the finding text + Brain framework chain).
   - On APPROVE: cascade edge writes via the existing typed-edge primitive; `reverse_salient_acted_on` memory_event records the response.
   - On REJECT: REJECTED_BECAUSE typed edge captures the reason; `reverse_salient_acted_on` records reason_present=true.
   - On DEFER: DEFERRED memory_event records the deferral for Phase 116 unresolved-tension-hook consumption.
4. If the agent returns `{ ok: false }` OR finds nothing OR is suppressed (tier 0 / JUST_TALK), fall back to the standard Setup + Session Flow below.

Anti-pattern reminder (per docs/AGENTIC-SURFACING-PATTERN.md):
- Never print findings to console; the F.0 dispatcher IS the surfacing surface.
- Never query the Brain directly; the agent reads pre-derived BRAIN.md via folder-memory.readQuadruple (LOCAL only, Canon Part 8).
- Never reimplement rs-math in Node; the agent shells out to scripts/rs-engine.py.

## Setup

1. Read `references/methodology/find-bottlenecks.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file. Start by mapping the system -- get the boundaries, subsystems, and value flow. Then hunt for the lagging component.

Every system has a bottleneck. Your job is to find it before they optimize the wrong subsystem.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to solution-design?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The bottleneck you found connects to [methodology]. Want to explore that next?"
