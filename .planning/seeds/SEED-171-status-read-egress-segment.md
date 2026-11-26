---
id: SEED-171
status: planted
planted: 2026-11-26
planted_during: Phase 400.4 plan 11 (cold-start replay and close-out); finding from the 2026-11-26 cold-start QA run
trigger_when: the next change to status_read, or the next time a user asks "what has left my machine?"
scope: small
canon_parts: [8, 9]
related: 400.4-QA-SOURCE.md (smaller notes), lib/mcp/tools/status.cjs (buildStatusSegments, status_read), lib/core/part8-egress-telemetry-queue.cjs, lib/core/rs-egress-telemetry.cjs, lib/core/part8-egress-guard.cjs
---

# SEED-171: status_read has no egress segment

## What was seen

`status_read` reports the spend and cap segment, the capability floor and the room binding. It has no segment that says what, if anything, has left the machine for the Brain in this session. The 2026-11-26 QA run noted the gap.

## Why it matters

Canon Part 8 says user data never goes to the Brain. The guard and the egress telemetry already exist (`lib/core/part8-egress-guard.cjs`, `lib/core/part8-egress-telemetry-queue.cjs`). A person cannot see their result from the one status surface that every host can call. A "nothing left your machine" line is a cheap, honest proof for a cold-start user.

## What to do

- Add one `egress` segment to `buildStatusSegments` in `lib/mcp/tools/status.cjs`. Read only: counts per session of Brain calls made, calls the guard blocked, and the time of the last call. No query text, no room content.
- Reuse the existing telemetry reader. Do not add a second counter (Canon Part 7).
- Keep the segment shape stable when the count is zero: `{calls: 0, blocked: 0, last_call_at: null}`.
- Add a test beside the other `status_read` segment tests. The reply must hold counts and times only; a leak test must pass.
- Tri-polar: `status_read` is an MCP tool, so Desktop and Cowork get the segment with no extra work. The CLI statusline may show it later.

## Why it is a seed and not a fix in 400.4

The finding is a missing feature, not a defect that blocks a cold start. The segment needs a decision on which telemetry file is the source of record. Phase 400.4 only files the finding.
