---
status: resolved
kind: rca                    # rca | debug-session | qa-sweep
trigger: "part8-job-key-skips-room-word-rules"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

hypothesis: `_looksLikePacket` is true for any payload with a `job` key, so classify() returns at the packet arm and never reaches theoVerdict. A free-form string with a proper name, a my or our phrase or a room-lexicon hit then comes back allow.
test: classify() on synthetic strings with and without `job`.
expecting: the verdict differs only because of the key.
next_action: close the shortcut (plan 386-28 Task 3).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (this worktree: MindrianOS-Plugin-release)
- Source: auditor claim b in `.planning/audits/EGRESS-CLAIMS-CHECK.md` (PARTIAL: the default-deny scan still blocks deny-list hits)
- Plan: 386-28 (E-JOB)

## Problem Statement

A recognised job key added to a brain_ask or brain_query payload makes classify() skip the room-word rules. The same string without the key is blocked.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: the verdict and class of a free-form string do not depend on an extra `job` key.
actual: with `job: select_methodology` an edge string and a room-lexicon hit come back allow, class move_set. Without the key they are block, room_content.
errors: none (a silent allow).
reproduction: see the table in Evidence.
started: since the packet arm was placed before the free-form arm (Phase 110 packet code).

## Scope and Impact

- Affected surfaces: every route that reaches classify(): the PreToolUse hook and the callTool belt.
- Severity: high. A model-written payload can add a job key to any brain_ask question.
- The model still cannot pass a deny-list hit (step 1 runs first and is unchanged).

## Eliminated
<!-- APPEND only -->

- Step 1 (default-deny scan) is not the cause. It runs first. PROVEN: the email-like string is block, content_set, with and without the job key.

## Evidence
<!-- APPEND only -->

Source-of-Truth Preamble (HEAD 529ebdbbe, checked 2026-11-06):
- `_looksLikePacket(payload)` is true when `packet_version` or `job` is an own key.
- `classify()` step 2 returns allow(move_set) when `_proveMoveSet` passes, else ambiguous(unproven_packet). It returns before the free-form branch (step 3).
- `_proveMoveSet` checks the job name against SHIPPED_JOBS, that summary and explanation leaves are sha256:-prefixed, and the handle fields (framework, slug, handle, reach_id, methodology). It does not check any other key.

Real packet key set (data/brain-packet-schema.json, `$defs.<job>.in.properties`, same for all 12 jobs): packet_version, job, room_stage, origin, privacy_mode, active_context, local_graph_summary, constraints. The schema sets additionalProperties false on every object node. sendPacket validates against it, then calls classify() with toolName brain_packet.

classify() verdict and class, roomDir null, synthetic strings (HEAD before the fix). Plugin and direct prefixes gave identical rows.

| Row | Without job | With job select_methodology |
|-----|-------------|-----------------------------|
| brain_ask sprout (invented name) | allow generic_question | allow move_set |
| brain_ask edge (my startup ...) | block room_content | allow move_set |
| brain_ask body (3 sentences) | block content_set | block content_set |
| brain_ask deny-list hit (email-like) | block content_set | block content_set |
| brain_ask swot analysis | allow typed_question | allow move_set |
| brain_query body in cypher | block content_set | block content_set |
| brain_ask room-lexicon hit (opts.lexicon) | block room_content | allow move_set |
| packet job + free-text sibling key | n/a | block content_set (body trips step 1); a short free-text sibling would allow |
| packet job + nested-object sibling | n/a | allow move_set |
| packet job only | n/a | allow move_set |

Result: 2 of 5 brain_ask rows change verdict because of the key (edge, lexicon hit), plus the nested-object sibling row allows although the packet schema forbids extra keys.

## Technical Root Cause

The packet arm is chosen by the presence of a job key, and it sits before the free-form arm. `_proveMoveSet` proves only the job name, hashed summary leaves and handle fields. It never checks that the payload keys are the packet schema keys. So (1) a free-form string next to a job key is never decided by theoVerdict, and (2) any extra key (a nested object, a free-text field, a key that holds a credential-shaped token) rides along inside an allowed packet. PROVEN by the table above.

## Required Code Changes

1. `lib/core/part8-egress-guard.cjs` classify(): when the tool is a free-form tool and `_extractFreeFormString` finds a string, decide it with theoVerdict before the packet arm, whatever other keys the payload has.
2. `_proveMoveSet`: the payload keys must be within the `in.properties` of the job in `data/brain-packet-schema.json` (read once, lazily; a load failure or an unknown job proves nothing). An extra key gives ambiguous, class unproven_packet.
3. Step 1 stays first and byte-unchanged. The terminal ambiguous return is unchanged.

## Tests to Add

`tests/test-386-job-key-shortcut.cjs`: J1 and J2 parity for brain_ask and brain_query, J3 parity under a bound synthetic room, J4 nested-object sibling not allow, J5 fake-key and free-text sibling not allow, J6 a real packet still allows, J7 email plus job blocks, J8 swot plus job allows.

## Non-Code Follow-ups

- Plan 386-21 owns CHANGELOG.md, knowledge-base.md and STATE.md.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "The packet arm is chosen by a job key before the free-form arm, and _proveMoveSet does not check the payload key set."
fix: "Plan 386-28: classify() decides a free-form string with theoVerdict before the packet arm; _proveMoveSet requires payload keys within data/brain-packet-schema.json in.properties for the job (plus the five handle fields). Step 1 and the terminal ambiguous return unchanged."
verification: "tests/test-386-job-key-shortcut.cjs RED (J1 to J5 fail) then GREEN (9 ok); corpus gate DELTA lines identical before and after, MEASURED_SHA256 unchanged, baseline not stamped; run-all-196, test-239 canary, e2e smoke, test-245, test-223, test-355, test-363.1, test-260906-fda, test-361-egress-shapes, part8-egress-guard.test.cjs, typed-arms test pass; run-all-386 all 20 PASSED on the final run."
files_changed: [lib/core/part8-egress-guard.cjs, tests/test-386-job-key-shortcut.cjs, .planning/debug/part8-job-key-skips-room-word-rules.md]
commits: [RCA commit, c5342b1b9 (RED test), fix commit in git log as fix(386-28)]
