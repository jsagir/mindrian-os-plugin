---
phase: 405
round: 3 (narrow: 3.2/2a, 3.3, 3.5/4b, 3.7a/slice 9, 3.10/slice 10, section 9)
reviewer: egm-implementation-readiness
target: 405-DESIGN.md r3
counts: {blocker: 4, major: 11, nit: 7}
verdict: NOT READY
note: "Saved by the main session; the reviewer is read-only."
---

# 405 GOLDFISH R3: implementation readiness

Round-2 FIXED items not fully fixed: R2M11 adopt (B1); R2M6 idempotency (B2, M2); R2B6 release (B3, M3, M4); R2B2 payload (B4); R2B1 material set (M1); R2M9 app nonce (M10); R2M14 sqlite-vec still GUESS (M11); R2M15 fixture migration (M8). Really fixed: R2B4, R2B5, R2M16, R2M19.

## Blockers
- IR3-B1 (3.2a, AC2.6): scripts/resolve-room:50-78 returns the active room from the central registry and exits 0, so `--adopt` does nothing when a registry exists; `--adopt` acts only in Strategy 2 (:122-178), needs a legacy room/ or rooms/ subfolder, writes a workspace registry `<path>/.rooms/registry.json` (entry default, path room) and overwrites an existing one; it never writes `<rooms home>/.rooms/registry.json`, which isRegisteredLocalRoom reads. Fix: register through `scripts/room-registry create <slug> <absolute path>` (:466-478 keeps an absolute path), after checking it does not scaffold over an existing room, or add a `register` subcommand; state the slug rule and the four typed refusal reasons literally.
- IR3-B2 (3.3, AC3.3): `pending` with the same hash returns `write_in_progress`, but a crash leaves `pending` and "the same call later resumes from step 2"; no rule tells crashed from live. Fix: store owner_pid and created_at; stale when the pid is dead (ownerProcessAlive pattern, resolve-active-room.cjs:220) or older than N seconds; stale resumes, live returns write_in_progress.
- IR3-B3 (slice 9 AC9.6): verify-release runs at Step 2, 6.5, 6.6 (doctor --acceptance --pre-tag) and 9.8 (release.sh:82-90); the .mcpb is built at 6.8b, so "file exists, else exit 1" aborts at Step 2 and turns doctor --acceptance red in every dev slice. Fix: a separate `verify-release --mcpb <file>` after 6.8b and at 9.8, or skip when no dist/*.mcpb exists pre-build; state which.
- IR3-B4 (3.7a, AC5a.2): limits are "the claude.ai plugin limits until SP7"; the payload is the full mos-desktop copy plus `npm ci --omit=dev` from the root shrinkwrap, incl. next 16.2.10, react, react-dom (package.json:80-82); RULE 8 says the installed tree alone is far above 5,000 files and 200 MB; SP7 size leg has no If B. Fix: name the extension dependency set (for example omit next, react, react-dom if the AC5a.3 scan shows only the dropped lib/ui-shell uses them); numeric limits; SP7 size-leg If B (owner or a bundling route).

## Majors
- IR3-M1 (3.5 isMaterialApproval): material_step is minted by lib/mcp/approval-gate.cjs:102, never-do-gate.cjs:186, room-readiness-gate.cjs:103 and :143, chain.cjs:589, research.cjs:14 (grant, deep_plan, basket), eureka-capability-jobs.cjs:288, startup-operations.cjs:55; research and Eureka named by purpose only; AC4.1 has no never-do or room-readiness rows. Fix: literal predicate (`live.kind === 'material_step' || truth-claim subject promotion || goal-gate ratification`), one AC4.1 row per minter.
- IR3-M2 (3.3): payload_sha256 has no canonical form. Fix: sha256 of sorted-key JSON of the tool arguments minus client_write_id, room and _meta.
- IR3-M3 (slice 9 AC9.4, setup link): no script creates a GitHub release (no `gh release` in scripts/); `gh release upload` fails without a release; Step 9.x failure after npm publish (RULE 7) unspecified; the setup link has no URL, the versioned asset name and "latest" skipping prereleases (betas, RULE 6). Fix: `gh release view v<v> || gh release create v<v> [--prerelease]` then upload; Step 9.x warns and never aborts (Step 9.6c precedent); a stable asset name `mindrian-os.mcpb` beside the versioned one.
- IR3-M4 (slice 9 AC9.5): place 5 is marketplace.json committed before the push; the .mcpb is a post-push release asset carrying a version, so by RULE 5's UI-shell reasoning it is a place; AC9.5 keeps "all FIVE" in release-process.md while RULE 5 lists nine and says other files carry no number. Fix: a new place or a paragraph saying why not; remove the count from release-process.md; navigator if needed.
- IR3-M5 (3.10 item 4, slice 10): the matcher is mirrored as BRAIN_SHAPED_TOOL_MATCHER (lib/core/brain-response-sanitize.cjs:151) and pinned by tests/test-260906-gr1-brain-shaped-tool-gate.cjs, test-396-theo-route-matrix.cjs, test-396-bypass-5-theo-tool-arms.cjs, part8-egress-guard-hook.test.cjs, test-brain-response-sanitize.cjs and tests/fixtures/392-part8-replay/route-matrix.json; the plugin prefix `(?:plugin_[A-Za-z0-9_-]+_)?` covers only mindrian-brain and pws-brain-mcp (hooks.json:208, :332). Fix: the new regex literal; add these files to slice 10.
- IR3-M6 (slice 10): modifies lib/core/doctor/desktop-bridge-module.cjs, created by 5a; depends only on "7, SP8"; if SP7 = B the file does not exist. Fix: depend on 5a or 5b, or use an existing doctor module.
- IR3-M7 (section 7, OR-9): slice 10 has no position; slice 9 depends on 1-8 only, so theo-context (OR-8) is not in the 405 release. Fix: slice 10 before 9 and 9 depends on 10, or state it ships later.
- IR3-M8 (section 9, 3.2): no tests/run-all-367*.sh in either worktree; no run-all mentions 400.3; run-all-369.1.sh exists but is not run; no suites step for AC2a.1; run() prints SKIP for a missing pinned neighbour, so test-367-governed-census.cjs (not on this base) passes PA-1 condition 4 by SKIP. Fix: real file names, add run-all-369.1.sh, add the suites step, missing pinned neighbour = FAIL.
- IR3-M9 (section 9 map): no test for AC7.1 (room_bind context with one spawn), AC7.2-AC7.4, AC9.3, AC9.4, AC9.8, or AC2a.1 helper use; slice 7 creates no test; AC7.0 harness policy not in run-all-405.sh. Fix: tests/test-405-instructions-bind.cjs, a release-step test, a helper-usage scan, the harness line.
- IR3-M10 (3.5, slice 4b): no AC that gate_render on a hookless place draws the app card for material approvals; nonce store, binding key and app view file name unnamed. Fix: AC4b.4 and name the three.
- IR3-M11 (3.7a native module): install method still GUESS. Fix: package names from vector-store.cjs:122-127, versions from the shrinkwrap, the fetch and extract method.

## Nits
- IR3-N1: readRegistry (resolve-active-room.cjs:83) is not exported (exports :603-613); export it and use registryRoomPath.
- IR3-N2: name the migration module and add it to _schemaStamp specs (room-db.cjs:285-294).
- IR3-N3: copy the 173-byte connect text from 405-DESIGN-r2.md:172 into r3; add test-270 AFTER to slice 10 gates.
- IR3-N4: add dist/ to .gitignore.
- IR3-N5: slice 9 "depends on 1-8" includes conditional 4b, 5b, 6; say "built or dropped by the spike verdict" and what slice 9 does when SP7 = B.
- IR3-N6: name both npm ci runs (payload from the root shrinkwrap; the tools/mcpb CLI) with their directories.
- IR3-N7: "material" uses the gate.cjs:238-255 eligibility (claim or opportunity in proposed or needs_evidence).
