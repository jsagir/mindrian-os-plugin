---
phase: 149-gsd-planning-artifacts-as-local-graph-members
plan: 03
subsystem: planning
tags: [planning-artifacts, posttooluse-hook, d-01-cli-immediacy, brain-packet, canon-part-8, canon-part-9, gam-06, gam-04, idempotent, zero-egress]
requires:
  - lib/core/planning/reconcile-runner.cjs (reconcilePlanningArtifacts -- the SAME idempotent spine the session-start slot calls; Plan 02)
  - lib/core/navigation.cjs (getNeighborhood + ARTIFACT_NODE_ID + ARTIFACT_TYPES -- Plan 01 + Phase 109 chokepoint)
  - lib/core/navigation/packet.cjs (hashText sha256-by-default projection helper -- Phase 109/110)
  - scripts/memory-completion-detector.cjs + scripts/auto-explore-fingerprint.cjs (the PostToolUse hook shape clone template)
  - hooks/hooks.json (the PostToolUse Write|Edit|MultiEdit matcher blocks -- the registration idiom)
provides:
  - buildArtifactBrainPacket(db, {phase, artifactType}) -- the GAM-06 typed-packet projection; generic handles only (phase id, artifact_type enum set, requirement id handles, status enum, node_count, sha256 of the phase handle)
  - scripts/gsd-artifact-graph-hook.cjs -- the D-01 CLI-immediacy PostToolUse hook on .planning/*.md that calls the SAME idempotent reconcile
  - hooks/hooks.json registration of the hook under PostToolUse Write|Edit|MultiEdit (timeout 3000)
  - tests/test-149-brain-egress.cjs -- the adversarial GAM-06 egress seal (8th suite; flips run-all-149.sh to 8 passed / 0 missing)
affects:
  - Phase 148 execution (its .planning writes now land in the graph IMMEDIATELY on CLI, not only at the next session-start)
  - any future Brain query about a planning artifact (it must carry buildArtifactBrainPacket output only)
tech-stack:
  added: []
  patterns:
    - PostToolUse best-effort hook (stdin JSON -> file_path; strict path gate; resolve room; try/catch; exit 0 always) cloned from memory-completion-detector.cjs + auto-explore-fingerprint.cjs
    - hook reuses the idempotent reconcile (D-01 belt-and-suspenders) rather than reimplementing reconcile logic
    - generic-handles-only Brain packet built from node IDS + TYPE + REVIEW_STATUS, never node properties prose (structural Part 8 seal)
    - multi-anchor outbound getNeighborhood union to cover mixed-orientation lineage without a net-new inbound reader (Canon Part 7)
    - adversarial poisoned-seed forbidden-substring sweep (clone of the Phase 124 + Phase 110-05 adversarial pattern)
key-files:
  created:
    - tests/test-149-brain-egress.cjs
    - lib/core/planning/artifact-brain-packet.cjs
    - scripts/gsd-artifact-graph-hook.cjs
  modified:
    - hooks/hooks.json
decisions:
  - "The hook calls the FULL idempotent reconcile (no onlyPath): reconcile-runner.cjs does not accept onlyPath as of Plan 02, and the plan instructs correctness-over-speed. The full pass is cheap and cannot duplicate (idempotent upserts on stable ids), so onlyPath would be an optimization, not a new code path."
  - "buildArtifactBrainPacket builds handles from stable node IDS + TYPE + REVIEW_STATUS only; it NEVER reads a node's properties JSON. This is the structural Part 8 seal: even a writer regression that let prose onto a node could not leak it through the packet, because the packet code path never touches properties."
  - "To cover the mixed-orientation lineage (SPEC/CONTEXT FEEDS_INTO downstream artifact-as-source; requirement INFORMS SPEC/PLAN requirement-as-source; VERIFICATION VALIDATES requirement) with the OUTBOUND-only getNeighborhood, the packet unions outbound traversals from every artifact-type anchor for the phase. From VERIFICATION the requirement nodes are reachable outbound (VALIDATES); no inbound-neighborhood reader was added (Canon Part 7, no net-new navigation surface)."
metrics:
  duration: ~1 session
  completed: 2026-06-08
  tasks: 3
  files: 4
---

# Phase 149 Plan 03: D-01 CLI Immediacy Hook + GAM-06 Brain Boundary Seal Summary

One-liner: A PostToolUse hook on `.planning/*.md` writes lands the artifact graph IMMEDIATELY on CLI by calling the SAME idempotent `reconcilePlanningArtifacts` the session-start slot calls (D-01 hybrid trigger, no double-write by construction), and `buildArtifactBrainPacket` seals the GAM-06 / Canon Part 8 boundary by projecting a typed packet of generic handles only (phase id, artifact_type enum, requirement id handles, status enum, sha256 of the phase handle) built from node ids + type + review_status, NEVER from any node prose, proven by an adversarial poisoned-seed egress test.

## What Was Built

**Task 1 (commit 29c73bfe)** -- the adversarial Brain-egress test (GAM-06 RED):
- `tests/test-149-brain-egress.cjs`: seeds POISONED `planning_artifact` + `requirement` nodes by hand (raw absolute `/home/jsagi/secret/` path, body prose `SECRET ARTIFACT PROSE`, `leak@example.com`, `${INJECT}` token in every field a writer would normally keep clean -- `properties`, `source_path`, `source_section`), wires the full Plan 02 lineage shape (FEEDS_INTO + requirement-as-source INFORMS + VERIFICATION VALIDATES), calls `buildArtifactBrainPacket(db, {phase, artifactType:'SPEC'})`, and asserts `JSON.stringify(packet)` contains NONE of the four FORBIDDEN_SUBSTRINGS. It also (a) greps `artifact-brain-packet.cjs` AND `reconcile-runner.cjs` for forbidden requires (brain-client / node:http / node:https / http / https) + forbidden calls (fetch / http.request / https.request / .get) -- the structural floor, (b) asserts the packet carries the generic handles positively (phase, requirement_ids GAM-04/GAM-06, artifact_types SPEC), (c) asserts no em-dash / en-dash via `String.fromCharCode`, and (d) asserts the packet module requires `../navigation.cjs` and does NOT require `node:sqlite`. RED-by-design: the test FAILED (no longer MISSING) in run-all-149.sh until Task 2 landed the module.

**Task 2 (commit 33b03962)** -- the generic-handles-only packet projection (GAM-06):
- `lib/core/planning/artifact-brain-packet.cjs`: `buildArtifactBrainPacket(db, {phase, artifactType})` returns a flat object of generic scalars + arrays of handles: `phase` (the input handle echoed), `artifact_types` (the artifact_type enum subset present, ordered by the frozen ARTIFACT_TYPES), `requirement_ids` (the requirement id handles parsed from the stable `requirement:<reqId>` node id, validated against a strict `^[A-Z]{2,}-\d{1,3}(.\d+)?$` shape so a malformed id carrying prose after the colon is dropped), `status` (a review_status enum), `node_count` (a scalar), and `phase_hash` (sha256 of the GENERIC phase id handle, reusing `packet.cjs::hashText`, for dedup keying -- a hash of a handle, never prose). It reads room DATA ONLY via `navigation.getNeighborhood` (the Phase 109 chokepoint); it NEVER opens room.db and NEVER requires `node:sqlite`. It requires ONLY `../navigation.cjs` + the packet.cjs sha256 helper + `node:path` -- no brain-client / node:http / node:https / fetch (it BUILDS a packet, it does not SEND it). Because the packet is assembled from node IDS + TYPE + REVIEW_STATUS and never touches the `properties` JSON, no prose field can reach the wire even under a writer regression.

**Task 3 (commit 4063c719)** -- the D-01 CLI-immediacy PostToolUse hook (GAM-04):
- `scripts/gsd-artifact-graph-hook.cjs`: reads the PostToolUse stdin JSON payload (`tool_name` + `tool_input.file_path`, the same contract as `auto-explore-fingerprint.cjs`), strict-gates on a `.planning/*.md` regex (cross-platform, backslash-normalized; T-149-11 -- the attacker-influenceable file_path is gated before any room work), resolves the active room via the SAME registry resolver the Phase 149 session-start slot uses (prefer env room, else MindrianRooms `.rooms/registry.json` active room), opens `roomDir/.mindrian/room.db` (lazy node:sqlite require -> Tier 0 no-op if absent), and calls the SAME `reconcilePlanningArtifacts(roomDir, {db})` the session-start slot calls -- it does NOT reimplement reconcile logic. It dog-foods the plugin's own `.planning` (resolved-path compare sets `opts.planningDir` when the active room IS the plugin workspace). The whole body is wrapped in try/catch, the db handle is closed in a finally, and the process exits 0 ALWAYS (T-149-09 -- a hook failure never blocks the user's write). Registered in `hooks/hooks.json` under `PostToolUse` matcher `Write|Edit|MultiEdit` with `timeout: 3000`, cloning the `memory-completion-detector` block verbatim.

## Verification Results

- `node tests/test-149-brain-egress.cjs` -- PASS (GAM-06: zero artifact prose in the Brain packet; zero forbidden requires/calls; generic handles present; no em/en-dash; reads via navigation.cjs, no node:sqlite)
- `node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))"` -- valid JSON
- `grep -q gsd-artifact-graph-hook.cjs hooks/hooks.json` -- registers the hook
- `node -c scripts/gsd-artifact-graph-hook.cjs` -- hook parses
- `node scripts/check-schema-aliases.cjs --check-sendpacket` -- exit 0 (no bare sendPacket introduced; the packet module builds, does not send)
- brain-egress grep over the hook -- the only match is the Part-8-compliance COMMENT line, zero actual egress sites
- Functional idempotency smoke test (temp room + fixture .planning tree): hook fire #1 -> {nodes:6, edges:7}; session-start reconcile on the same room -> {6, 7} (no change); hook fire #2 -> {6, 7} (no change). PROVEN: a write the hook caught AND a later session-start reconcile produce EXACTLY one node and one edge set (no double-write). Non-planning path -> no-op exit 0.
- Gate unit test: 7/7 cases pass (`.planning/*.md` accepted including STATE.md; `planning/foo.md`, `.txt`, `src/index.js`, empty rejected).
- `bash tests/run-all-149.sh` -- 8 passed, 0 failed, 0 missing (the FULL Phase 149 suite is now GREEN; test-149-brain-egress flipped from FAILED/MISSING to PASSED).
- Zero em-dashes / en-dashes across all three created files (codepoint sweep clean).

## Deviations from Plan

None of the deviation rules (1-4) fired. Two within-discretion design decisions the plan explicitly delegated:

1. **Full reconcile, no onlyPath (plan-sanctioned).** The Task 3 action says "if reconcile-runner does not accept onlyPath, call the full reconcile -- correctness over speed." reconcile-runner.cjs (Plan 02) does not accept onlyPath, so the hook calls the full idempotent reconcile. This is the documented fallback, not a deviation. The full pass is cheap and cannot duplicate.

2. **Multi-anchor outbound union for mixed-orientation lineage (plan-discretion within the taxonomy).** `getNeighborhood` is outbound-only (`e.source = focus`). The Plan 02 lineage mixes orientations: SPEC/CONTEXT FEEDS_INTO downstream artifacts (artifact-as-source), requirement INFORMS SPEC/PLAN (requirement-as-source), VERIFICATION VALIDATES requirement (verification-as-source). A single outbound anchor cannot reach every handle. To cover the whole phase surface WITHOUT adding an inbound-neighborhood reader (which would be net-new navigation surface, against Canon Part 7), the packet unions outbound traversals from every artifact-type anchor for the phase. From the VERIFICATION anchor the requirement nodes are reachable outbound (VALIDATES). This stays purely on `navigation.getNeighborhood`; no new navigation surface was added.

## Canon / Project-Rule Compliance

- Canon Part 8 (zero Brain egress) -- GAM-06 SEAL: `buildArtifactBrainPacket` emits generic handles only, built from node IDS + TYPE + REVIEW_STATUS, never from node properties prose; the adversarial poisoned-seed test asserts zero FORBIDDEN_SUBSTRINGS survive `JSON.stringify(packet)`. The packet module + the hook have zero network surface (no brain-client / node:http / node:https / fetch -- asserted by the in-test grep sweep over BOTH the packet module and reconcile-runner). The packet BUILDS but does not SEND; the check-sendpacket guard passes.
- Canon Part 9 (navigation chokepoint): the packet reads room DATA only via `navigation.getNeighborhood`; the hook touches room.db only through the idempotent reconcile, which writes only through navigation.cjs. Neither requires node:sqlite for graph DATA reads (the hook opens room.db only to hand a caller-owned handle to the reconcile, mirroring the session-start slot).
- Canon Part 9 v1.5 (audit-node carve-out): planning_artifact + requirement are system-bookkeeping nodes; their ids are not truth-claims, and the packet treats them as generic handles.
- Canon Part 7 (reuse before build): the hook reuses the idempotent reconcile (no reimplementation), the memory-completion-detector / auto-explore-fingerprint hook shape, the session-start registry resolver, and the hooks.json registration idiom; the packet reuses getNeighborhood + the packet.cjs sha256 helper. The multi-anchor union avoids a net-new inbound reader. The only net-new is the packet projection + the hook + the adversarial test.
- Canon Part 6 (dog-fooding): the hook points opts.planningDir at the plugin's OWN .planning when the active room is the plugin workspace (resolved-path compare), so the plugin's planning writes land in its own room graph immediately on CLI.
- Tri-Polar: the hook is the CLI immediacy half (CLI has PostToolUse hooks); the session-start reconcile (Plan 02) remains the universal net for Desktop / Cowork (which have no PostToolUse hook). Both call the same idempotent reconcile, so they never duplicate.
- No em-dashes / en-dashes: confirmed across all three created files (codepoint sweep clean).
- check-sendpacket pre-commit guard: passed cleanly on all three commits. The documented `lib/core/mindrian-brain-shim.test.cjs` false-positive was NOT triggered (that file was not touched). Zero flags on any of the new files -- the packet module, the precise egress-sensitive surface of this plan, is clean.

## Known Stubs

None. The packet projection is fully wired and tested; the hook is registered and functionally verified (immediacy + idempotency + exit-0 + gate). The full Phase 149 suite is GREEN (8/8). The packet's `phase_hash` field is an OPTIONAL dedup handle (sha256 of the phase id, a generic handle), not a stub.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary surface beyond the three boundaries already in the plan's threat register (CLAUDE tool payload -> hook, gated by the strict .planning/*.md regex; buildArtifactBrainPacket -> Brain wire, generic handles only; hook -> reconcile -> room.db via navigation.cjs). All STRIDE entries (T-149-08 info disclosure, T-149-09 DoS, T-149-10 tampering/double-write, T-149-11 EoP) are mitigated as specified and verified.

## Self-Check: PASSED

Created files verified present:
- tests/test-149-brain-egress.cjs FOUND
- lib/core/planning/artifact-brain-packet.cjs FOUND
- scripts/gsd-artifact-graph-hook.cjs FOUND

Modified file verified:
- hooks/hooks.json registers gsd-artifact-graph-hook.cjs (grep matches)

Commits verified in git log:
- 29c73bfe FOUND (Task 1 -- adversarial egress test, RED)
- 33b03962 FOUND (Task 2 -- buildArtifactBrainPacket, GREEN)
- 4063c719 FOUND (Task 3 -- PostToolUse hook + hooks.json registration)
