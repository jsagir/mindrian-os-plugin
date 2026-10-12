---
status: investigating
kind: rca
trigger: "desktop-marketplace-add-fails-20261011"
issue_id: ""
severity: high
surfaces: [desktop]
brain_mode: not_ready
canon_parts: []
created: 2026-10-11T14:18:09Z
updated: 2026-10-12T12:30:00Z
---

## Current Focus

hypothesis: The Desktop marketplace importer may reject an entry, manifest, or payload contract that the Claude Code CLI validator accepts. The failing host surface and current importer error have not been confirmed.
test: Validate the public marketplace and unchanged Desktop payload, inspect only relevant installation evidence, and produce a direct-upload ZIP without changing source or user configuration.
expecting: A current host error or controlled reproduction identifies the exact rejected contract; passing CLI validation alone does not prove Desktop compatibility.
next_action: Surface confirmed (Claude Desktop, Code tab; navigator 2026-10-12). Obtain the current import error or a controlled reproduction on that surface, or test the validated direct-upload fallback there. Blocked until the navigator can reproduce; carried as item 8 of search-surface-qa-sweep-20261012.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin, the canonical dev workspace per CLAUDE.md; the older /home/jsagi/MindrianOS-Plugin path in this template is not the dev workspace.
- Plugin version: 2.0.0-beta.65 in the shipped Desktop payload.
- Reported by: Jonathan Sagir, via the current conversation.
- Date first observed: 2026-10-11.
- Related debug sessions: none confirmed.
- Workflow: /gsd-debug --diagnose; symptoms supplied; diagnosis and local fallback only; no source changes, release, remote writes, user configuration edits, or room access.
- CODE claims read against: source checkout HEAD 7306bc3f1e3fa92127f03185535f3ec1199811fe; local origin/main reference 4ebabe5e411d9de2569703807148bf2d82fd77cd; public marketplace master/HEAD 4b5c92a4806fe1de06dfb31bec61ba014d9f53c8.
- WIRE claims probe against: no current Desktop import wire probe and no Brain probe; GitHub repository metadata resolution is user-observed; local validation is not a host wire test.
- Date of audit: 2026-10-11.
- Re-verification rule: source-code claims must be re-verified against origin/main HEAD before landing as confirmed findings; otherwise mark needs-source-reverify. Shipped marketplace payload claims use the exact marketplace HEAD above.

## Problem Statement

Adding jsagir/mindrian-marketplace in Claude Desktop resolves the public GitHub repository metadata, then reports Failed to add marketplace. The current host rejection reason is unavailable, so the marketplace failure is not yet diagnosed.

## Symptoms

expected: Add marketplace accepts the public repository and exposes installable MindrianOS entries in the selected host surface.
actual: Repository metadata is displayed, including public visibility, then the operation fails.
errors: "Failed to add marketplace."
reproduction:
  1. Open Claude Desktop's Add marketplace interface.
  2. Enter jsagir/mindrian-marketplace in URL.
  3. Observe resolved GitHub repository metadata and Failed to add marketplace.
started: Reported 2026-10-11; first bad version and prior successful use on this exact surface are unknown.

## Scope and Impact

- Classification: NEW FAILURE for the user-observed Desktop add operation; precise surface remains unconfirmed.
- Affected surfaces: Claude Desktop, Code tab, Add marketplace (confirmed by the navigator 2026-10-12); Cowork, Chat and organization settings not tested.
- Affected commands: marketplace addition through the Desktop UI; no /mos command execution was tested.
- Affected users: one reported user; wider population unknown.
- Version range: marketplace 2.0.0-beta.65 at 4b5c92a4806fe1de06dfb31bec61ba014d9f53c8 checked; first bad version unknown.
- Severity: high for onboarding; existing installations and room data are outside scope.
- Blast radius: marketplace onboarding only on current evidence; no room, graph, Brain, or runtime failure proven.

## Eliminated

- hypothesis: The public repository cannot be found or is private.
  evidence: The user's Add marketplace interface resolves metadata for public jsagir/mindrian-marketplace. This rules out absence and privacy as the explanation for the observed metadata step, not every downstream network failure.
  timestamp: 2026-10-11T14:18:09Z

- hypothesis: The shipped Desktop tree violates the existing payload builder limits or path rules.
  evidence: The parent investigation reports checkPayload returned [] for plugins/mos-desktop at marketplace HEAD. This is the project's local gate, not proof that this host accepts every manifest field.
  timestamp: 2026-10-11T14:18:09Z

## Evidence

- timestamp: 2026-10-11T14:18:09Z
  checked: User-supplied Desktop Add marketplace output.
  found: Repository metadata resolves and the final visible error is Failed to add marketplace.
  implication: Failure occurs after repository lookup; exact failing phase is unknown.

- timestamp: 2026-10-11T14:18:09Z
  checked: Shipped marketplace .claude-plugin/marketplace.json at 4b5c92a4806fe1de06dfb31bec61ba014d9f53c8.
  found: mos uses npm source @mindrian_os/cli version 2.0.0-beta.65; mos-desktop uses relative source ./plugins/mos-desktop version 2.0.0-beta.65.
  implication: Mixed npm and local sources are a concrete manifest property, but a Desktop rejection of that property is still a hypothesis.

- timestamp: 2026-10-11T14:18:09Z
  checked: Parent investigation's Claude Code CLI marketplace and plugin validators.
  found: Both validators pass.
  implication: CLI schema validation does not reproduce this Desktop failure.

- timestamp: 2026-10-11T14:18:09Z
  checked: Parent investigation's official organization plugin sync documentation.
  found: Organization sync documentation rejects npm sources; the user may instead be in personal Desktop Code marketplace management.
  implication: Do not generalize organization-only restrictions to the unconfirmed failing surface.

- timestamp: 2026-10-11T14:18:09Z
  checked: Parent investigation's Windows AppData/Roaming/Claude logs.
  found: Latest available logs are August 21, with no current October import error; older July logs mention an oversized payload.
  implication: Historical payload failures do not prove the current beta.65 failure or current rejection reason.

- timestamp: 2026-10-11T14:23:00Z
  checked: scripts/release-lib/build-desktop-artifact.cjs in source checkout and origin/main via git show and SHA256.
  found: Both copies have SHA256 564c9dc21dc2c1390ce07b4539ea52a473bece02db04922b67646c591405668e; checkPayload on the unchanged beta.65 shipped tree returns [].
  implication: Builder validation is re-verified against the local origin/main reference; source checkout divergence does not affect this gate's observed result.

- timestamp: 2026-10-11T14:23:00Z
  checked: /mnt/c/Users/jsagi/Downloads/mindrianos-desktop-2.0.0-beta.65.zip, built from unchanged marketplace plugins/mos-desktop.
  found: ZIP CRC passes; 2023 files; 11781489 compressed bytes; 33949816 uncompressed bytes; maximum per-file compression ratio 18.00105532941354; all file hashes and permission modes match source; 138 executable files preserved; no symlinks, unsafe paths, top-level bin, or lib/ui-shell/dist; root manifest version 2.0.0-beta.65; DEFLATE level 6; SHA256 3e57a99c3e92e931d61d689bf0424d6375ab50494ef3d8ae238c1ed643eca973.
  implication: A locally validated direct-upload fallback is ready; no current Desktop acceptance or marketplace fix is proven.

- timestamp: 2026-10-11T14:23:00Z
  checked: Requested /mnt/data artifact directory.
  found: /mnt/data does not exist, creation is denied to the current user, and noninteractive sudo requires a password.
  implication: The Windows Downloads artifact is available; the additional /mnt/data copy could not be created in this environment.

- timestamp: 2026-10-12T12:30:00Z
  checked: Navigator answer on the AskUserQuestion card in the search-surface-qa-sweep-20261012 session.
  found: The failing surface is Claude Desktop, Code tab (personal marketplace management), not Cowork, Chat or organization settings. No current import error or log is available now.
  implication: The organization-sync npm-source restriction does not apply to this surface. The rejection reason is still unknown; the next evidence must come from a reproduction on the Code tab or from the direct-upload fallback on it.

- timestamp: 2026-10-11T14:23:00Z
  checked: Parent investigation's native Windows Node executable.
  found: /mnt/c/Program Files/nodejs/node.exe exists and reports v22.23.1.
  implication: The native Windows Node runtime meets the plugin package floor; this does not prove the Desktop runtime will discover or launch it.

## Technical Root Cause

- Site: unconfirmed; no current host importer stack or rejection field available.
- Cause: not determined. Mixed npm source incompatibility, a host-specific manifest contract, and downstream importer behavior remain hypotheses.
- Why it surfaces now: unknown; the current report supplies no first-bad release, current host version, or successful baseline on the same surface.
- Source classification: scripts/release-lib/build-desktop-artifact.cjs exactly matches the local origin/main reference by SHA256. Its validation result is re-verified; no implementation root cause is attributed.

## Required Code Changes

- No source changes justified by current evidence.
- Do not delete the npm entry, release a new version, or label the failure fixed solely because organization documentation differs from CLI behavior.
- Short-term local fallback: create a ZIP of the unchanged shipped Desktop payload with .claude-plugin/plugin.json at the ZIP root, then validate it for direct upload on a supported surface.
- Long-term fix: determine the exact host contract and reproduce rejection before selecting source or manifest changes.

## Tests to Add or Update

- No source tests added for this diagnosis-only task.
- Verification: rerun checkPayload on the unchanged shipped tree; verify ZIP CRC, file count, uncompressed bytes, path safety, absence of symlinks and forbidden bin/dist entries, per-file compression ratio, root manifest, and preserved executable modes.
- Required host verification: actual marketplace addition or direct upload in the same identified Desktop surface; not yet performed.

## Non-Code Follow-ups

- Confirm the exact Add marketplace surface and current Claude Desktop version with the user.
- Obtain current import logs or a controlled host reproduction before attributing root cause.
- Offer the validated direct-upload artifact only on a host surface that supports plugin ZIP upload.
- CHANGELOG.md and release lockstep: no change while no source fix or release is made.
- Canon: no architectural or Brain-boundary change in this task.
- knowledge-base.md: no resolved incident block while root cause remains unconfirmed.
- Keep this report in .planning/debug/, not resolved/, and do not commit this diagnostic artifact under this task's scope; git status exposes it as untracked in this checkout.

## Resolution

root_cause: not determined.
fix: no source fix applied; validated unchanged Desktop ZIP prepared in Windows Downloads for direct-upload fallback on a supported surface.
verification: checkPayload returns []; ZIP CRC, all file content hashes, executable modes, root manifest, safe paths, symlink absence, forbidden directory absence, 2023-file count, 33949816 uncompressed bytes, and maximum compression ratio 18.00105532941354 pass. ZIP SHA256 is 3e57a99c3e92e931d61d689bf0424d6375ab50494ef3d8ae238c1ed643eca973. Current Desktop installation remains unverified; /mnt/data copy was blocked by filesystem permissions.
files_changed:
  - .planning/debug/desktop-marketplace-add-fails-20261011.md (diagnosis state only, untracked and not committed).
  - /mnt/c/Users/jsagi/Downloads/mindrianos-desktop-2.0.0-beta.65.zip (local fallback artifact, outside the source repo).
commits: none.
