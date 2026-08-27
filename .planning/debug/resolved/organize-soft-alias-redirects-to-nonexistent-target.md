---
status: resolved
kind: rca
trigger: "organize-soft-alias-redirects-to-nonexistent-target"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [7, 11]
created: 2026-08-24T00:00:00Z
updated: 2026-08-24T02:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** installed plugin cache `/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.9/` (the actual running surface for this session's `/mos:` commands), cross-checked against `origin/main` HEAD `aeec1d93` in `/home/jsagi/dev/MindrianOS-Plugin`.
- **WIRE claims probe against:** live MCP call to `mcp__plugin_mos_mindrian-os__room_content` with `command: "organize"` in this session, against the same server this session is already connected to.
- **Date of audit:** 2026-08-24
- **Re-verification rule:** both findings below were reproduced directly in this session, not inferred.

## Current Focus

hypothesis: `/mos:organize`'s D-09 soft-alias points at a target ("/mos:rooms organize") that was never actually implemented on either surface this plugin exposes: the CLI markdown command (`commands/rooms.md` has no `organize` subcommand) and the MCP tool (`room_content`'s schema advertises `organize` as a valid enum value, but the server rejects it as unknown).
test: ran the soft-alias runner (confirms redirect target string), read `commands/rooms.md` in full (subcommand list explicitly excludes `organize`), and called the live MCP tool with `command: "organize"`.
expecting: either a working room-portfolio-tree/propose/view/move flow, or at minimum a graceful "not yet implemented" message instead of a bare error.
next_action: RESOLVED. Human verified the fix via direct code review of both changed files (confirmed correct); live end-to-end MCP re-verification is pending a fresh session due to a known, unrelated stale-process pattern (not a fix defect). Session archived; changes remain uncommitted pending human go-ahead.

```yaml
reasoning_checkpoint:
  hypothesis: "/mos:organize's redirect target (/mos:rooms organize) has never been implemented on either surface: commands/rooms.md has no organize subcommand (routing falls through to list), and the room_content MCP tool's command enum advertises 'organize' with no matching dispatcher case in the switch."
  confirming_evidence:
    - "Full read of commands/rooms.md: Routing section's own subcommand list omits organize entirely; no '## Subcommand: organize' section exists in the file."
    - "Direct source read of lib/mcp/tool-router.cjs: ROOM_CONTENT_COMMANDS (the z.enum backing room_content's command param) includes 'organize' at line 204, but the switch statement handling those commands (lines 723-860) has no case 'organize': -- it falls to the default branch, textResponse(`Unknown room_content command: ${command}`, true)."
  falsification_test: "If an 'organize' case existed anywhere in the tool-router.cjs switch, or if commands/rooms.md had an organize subcommand section, the hypothesis would be false. Grep for both confirmed neither exists."
  fix_rationale: "Root cause is a documentation/schema promise with no matching implementation on either surface -- not a broken implementation. Per operator disposition (favor short-term patch over building the full tree/propose/view/move feature): (1) commands/rooms.md gets an honest 'not yet implemented' organize subcommand instead of silently falling through to list, closing the false-success gap; (2) the room_content MCP schema stops advertising a command the dispatcher cannot serve, so callers get a validation-time rejection instead of a misleading runtime 'Unknown command' error. Both changes make the system honest about its actual capability rather than building unrequested scope."
  blind_spots: "Did not build the actual tree/propose/view/move room-portfolio feature (explicitly out of scope per operator guidance -- that is the long-term fix, tracked separately). Did not audit other room_content enum values for the same schema-vs-dispatcher drift class (flagged in Non-Code Follow-ups, not fixed here). The room_content MCP tool's source IS in this repo (lib/mcp/tool-router.cjs) -- the 'possibly a separate repo' caveat in the operator guidance did not apply."
```

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.9 (installed/running), 2.0.0-beta.10 (dev HEAD)
- Reported by: live dogfood test, navigator ran `/mos:organize` as the third step of a diagnosis this session recommended for room `pws-website`
- Date first observed: 2026-08-24
- Related debug sessions: none found for this specific gap; distinct from and unrelated to `.planning/debug/rs-engine-python-insert-not-null-and-detail-drop-regression.md` (filed earlier this same session, different subsystem).

## Problem Statement

`/mos:organize` deprecation-redirects to `/mos:rooms organize`, but no `organize` subcommand exists in `commands/rooms.md`, and the MCP tool's own `organize` enum value is rejected by the server at call time. The soft-alias points nowhere.

## Symptoms

expected: `/mos:organize` (or its redirect target) produces a room portfolio tree, a reorganization proposal, or a move confirmation, per its own doc's description of `tree`/`propose`/`view`/`move` verbs.
actual: `commands/rooms.md`'s own "Routing" section lists subcommands as `list, new, open, close, archive, where, git-setup, git-status` only -- no `organize`. Calling the MCP surface directly returns a hard error.
errors:
  - MCP tool call `mcp__plugin_mos_mindrian-os__room_content({command: "organize"})` -> `Unknown room_content command: organize`
reproduction:
  1. Run `/mos:organize` (any arguments, or bare).
  2. The soft-alias-runner correctly resolves and returns `{"redirect":"/mos:rooms organize","ok":true}`.
  3. Attempt to execute `/mos:rooms organize` per `commands/rooms.md`: no such subcommand is defined; the routing section's own subcommand list omits it.
  4. Attempt the MCP-first equivalent, `room_content` with `command: "organize"` (a value the tool's own advertised schema lists as valid): server returns `Unknown room_content command: organize`.
started: unknown; needs `git log -p` on `commands/rooms.md` and the room_content MCP handler to find when `organize` was added to schemas/docs without a matching implementation, or removed from implementation without updating the schemas/docs.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (both the markdown routing gap and the MCP schema/implementation mismatch are surface-agnostic).
- Affected commands: `/mos:organize` (deprecated alias), `/mos:rooms organize` (undocumented-as-missing target), `room_content` MCP tool with `command: "organize"`.
- Affected users: anyone who runs `/mos:organize` expecting the documented redirect to work, or any MCP client that trusts the tool's own schema enum.
- Version range: at least 2.0.0-beta.9 (installed) through 2.0.0-beta.10 (dev HEAD) -- not bisected further.
- Severity: MEDIUM. `/mos:organize` is CIRS-excluded (Phase 172-06, "utility command... housekeeping action") and low-traffic, but a documented MCP tool enum value that the server rejects is a worse signal for any programmatic caller (it cannot even validate ahead of time; the schema lies).
- Blast radius: none of `room_content`'s other enum values were tested for the same mismatch in this session; worth a quick audit given this exact class of drift (schema advertises more than the dispatcher implements) was found once already.

## Eliminated

- hypothesis: user error / wrong invocation syntax.
  evidence: followed `/mos:organize`'s own documented Step 2 exactly (soft-alias-runner.cjs invocation), and separately used the MCP tool's own advertised enum value verbatim. Both are the documented, correct invocations.
  timestamp: 2026-08-24T00:00:00Z

## Evidence

- timestamp: 2026-08-24T00:00:00Z
  checked: `node .../scripts/soft-alias-runner.cjs --from organize --to "rooms organize" --remaining-args`
  found: `{"redirect":"/mos:rooms organize","deprecation_note":"...","args":[],"ok":true}`
  implication: the alias mechanism itself works correctly; it is honest about where it thinks the target is.
- timestamp: 2026-08-24T00:00:00Z
  checked: full read of `commands/rooms.md` (installed plugin cache, 2.0.0-beta.9)
  found: "Routing" section states "Subcommands: `list`, `new`, `open`, `close`, `archive`, `where`, `git-setup`, `git-status`" -- no `organize` entry anywhere in the file.
  implication: the redirect target does not exist in the CLI markdown surface.
- timestamp: 2026-08-24T00:00:00Z
  checked: live call `mcp__plugin_mos_mindrian-os__room_content({command: "organize"})`
  found: `Unknown room_content command: organize`
  implication: the MCP surface's own declared schema (the tool description lists `organize` among its valid `command` enum values) does not match its actual dispatcher, which has no handler for it.
- timestamp: 2026-08-24T01:00:00Z
  checked: `grep -n "organize" lib/mcp/tool-router.cjs` and full read of the `room_content` switch (lines 705-862)
  found: `room_content`'s server-side dispatcher IS in this repo (not a separate/unreachable package) -- `ROOM_CONTENT_COMMANDS` (the z.enum backing the tool's `command` param) listed `organize` at line 204, but the switch statement's case list (lines 723-857) has no `case 'organize':`, falling to the `default: return textResponse('Unknown room_content command: ' + command, true)` branch.
  implication: both sites are fixable from this repo; no cross-repo blocker. Confirms disposition per operator guidance -- short-term patch on both sites.
- timestamp: 2026-08-24T01:15:00Z
  checked: applied Change 1 (commands/rooms.md: added `organize` subcommand with honest "not yet implemented" stub + explicit "unrecognized subcommand never defaults to list" routing rule) and Change 2 (lib/mcp/tool-router.cjs: removed `organize` from `ROOM_CONTENT_COMMANDS` enum and from the tool's description text; updated the "16 commands" comment to "15 commands" with a drift-prevention note)
  found: `node -e` confirmed `ROOM_CONTENT_COMMANDS` now has 15 entries with no `organize`; `ALL_TOOL_COMMANDS` unique count unchanged at 65 (organize was never a member of that array -- it is a CLI-parity array, not the room_content enum)
  implication: schema now honestly matches dispatcher capability; CLI now fails honestly instead of masking as `list`
- timestamp: 2026-08-24T01:20:00Z
  checked: ran `node tests/test-205-surface-fence.cjs` (20/20 pass, including the pinned "unique membership at 65" guard), `node lib/memory/soft-alias.test.cjs` (45/45 pass), `node lib/memory/doctor-deprecation-surface.test.cjs` (34/34 pass), `node tests/test-room-state-active-room-misroute.cjs` (pass), `node tests/test-tool-router-active-room-misroute.cjs` (pass), `node tests/test-234-tool-description-floor.cjs` (35/35 pass, including no-em-dash + description-floor checks on `room_content`), `node scripts/build-connector-registry.cjs --check` (OK), `node scripts/build-orchestration-projection.cjs --check` (OK), `node scripts/check-render-coverage.cjs` (0 gap)
  found: all pass; no regression introduced by either change
  implication: fix does not break adjacent functionality
- timestamp: 2026-08-24T01:25:00Z
  checked: `node tests/test-209-declared-implies-wired.cjs` -- FAILS (AssertionError on the `KNOWN_CONTRADICTION_SURFACES` allowlist, `commands/brain-derive.md` / `skills/brain-derive/SKILL.md` missing from actual vs expected)
  found: reproduced the SAME failure with `git stash` temporarily reverting both of this session's files (commands/rooms.md, lib/mcp/tool-router.cjs) -- failure is 100% pre-existing, unrelated to this fix. Likely caused by unrelated concurrent work on `brain-derive.md` elsewhere in this shared working tree (per CLAUDE.md's noted two-session coordination). Out of scope for this RCA.
  implication: not a regression from this fix; noted here for the record, not fixed (different bug, different slug if it needs tracking)

## Technical Root Cause

- Site 1: `commands/rooms.md` (installed plugin cache `2.0.0-beta.9`), "Routing" section.
  - Cause: no `organize` subcommand was ever added, despite `commands/organize.md`'s deprecation note (D-09, Phase 121.5-08 Sub-plan J) claiming it as the canonical redirect target since 2026-05-16.
  - Why it surfaces now: first live invocation traced end-to-end in this session; likely never exercised since the D-09 rename because the old `/mos:organize` alias silently "worked" by falling through to `rooms.md`'s documented default-to-`list` behavior when no subcommand matches, masking the gap as a soft no-op instead of a hard error.
- Site 2: the `room_content` MCP tool's server-side command dispatcher (exact file not located in this session -- needs a grep for the dispatcher's command-to-handler map, likely under `lib/mcp/` or similar in the MCP server package this session is connected to).
  - Cause: the tool's declared JSON-schema enum includes `"organize"` as a documented value, but the dispatcher's switch/map has no case for it, so it falls to a default `Unknown room_content command: <cmd>` branch.
  - Why it surfaces now: same as Site 1 -- first live exercise of this specific enum value in this session.

## Required Code Changes

- Change 1:
  - Location: `commands/rooms.md`
  - Current behavior: no `organize` subcommand defined; routing falls through to `list`.
  - Required behavior: either (a) implement an `organize` subcommand with `tree`/`propose`/`view`/`move` verbs as `commands/organize.md`'s own doc describes, or (b) if the intended implementation lives entirely on the MCP side, update `commands/rooms.md`'s routing to explicitly delegate to the `room_content` MCP tool for this verb instead of silently omitting it.
  - Short-term patch: add a stub `organize` subcommand that returns a clear "not yet implemented, tracked as <this RCA slug>" message instead of silently defaulting to `list`.
  - Long-term fix: build the actual tree/propose/view/move flow, or formally retire the soft-alias (amend the D-09 deprecation note) if `/mos:organize` capability is being folded into something else instead.
- Change 2:
  - Location: the `room_content` MCP tool's server-side dispatcher (needs locating; grep the MCP server package for the command-enum-to-handler switch, likely near where `new-project`/`setup`/`organize` etc. are dispatched)
  - Current behavior: schema advertises `organize` as a valid `command` value; dispatcher has no handler, returns `Unknown room_content command: organize`.
  - Required behavior: either implement the handler, or remove `organize` from the advertised schema enum until it exists, so callers cannot be misled by tool metadata that promises a capability the server does not have.
  - Short-term patch: remove `organize` from the schema enum (honest schema over broken promise).
  - Long-term fix: implement the handler and keep schema and dispatcher in lockstep going forward, ideally via a generated-from-single-source pattern (matching this repo's own convention of generated vs hand-authored data files, e.g. `data/command-registry.json`).

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: a schema-vs-dispatcher drift test for `room_content` (new, location depends on where the MCP server package's own test suite lives)
  - Given: the tool's declared JSON-schema `command` enum
  - When: each enum value is dispatched against the handler map
  - Then: every enum value has a matching handler (no `Unknown room_content command` possible for any documented value)
- Test 2:
  - Type: integration
  - Location: `tests/` (this repo), a CLI-routing test for `commands/rooms.md`
  - Given: `/mos:organize` invoked with each of `tree`/`propose`/`view`/`move`
  - When: the soft-alias redirect fires
  - Then: `/mos:rooms organize <verb>` resolves to a real subcommand handler, not a fall-through to `list`

## Non-Code Follow-ups

- CHANGELOG.md: note once disposition is decided (implement vs retire).
- Canon: Canon Part 11 (Invocation Constitution) governs born-wired-or-excluded surfaces; `/mos:organize`'s own frontmatter already declares `connector.excluded: true` with a stated reason, but that exclusion assumed a working redirect target existed, which this RCA shows is false.
- knowledge-base.md: add a summary block on resolve, and flag the "schema enum vs dispatcher" drift class as worth a one-time audit across all `room_content` (and possibly other MCP tools') enum values, since this exact defect shape could recur elsewhere silently.

## MindrianOS Gate Compliance (RCA Section 5)

- **Canon Part 8 (Brain boundary):** PASS. No Brain call involved; this is a LOCAL routing/dispatch gap.
- **Tri-Polar (CLI / Desktop / Cowork):** all three share the same broken redirect and the same MCP dispatcher; not independently verified per-surface beyond the CLI-equivalent MCP call made in this session.
- **Cross-platform:** not applicable; pure routing logic, no OS-specific behavior.
- **Release lockstep:** applies once a fix ships.
- **No em-dashes:** PASS.
- **Reuse-before-build (Canon Part 7):** the fix should reuse whichever of the two surfaces (markdown routing or MCP dispatcher) was actually intended as canonical, rather than building a third parallel implementation.

## Resolution

root_cause: CONFIRMED for both sites. Site 1 (`commands/rooms.md`): `/mos:organize`'s D-09 redirect target (`/mos:rooms organize`) was never implemented -- no `organize` subcommand existed, so an unmatched subcommand silently fell through to `list`'s default behavior, masking the gap as a soft no-op. Site 2 (`lib/mcp/tool-router.cjs`, same repo, no cross-repo blocker): the `room_content` MCP tool's `command` z.enum schema advertised `organize` as valid, but its dispatch switch had no matching `case`, so any caller trusting the schema got a runtime `Unknown room_content command: organize` instead of a validation-time rejection.

fix: DISPOSITION = short-term patch on both sites, per operator guidance (favor honest-gap-reporting over building the unrequested tree/propose/view/move feature). (1) `commands/rooms.md`: added a real `organize` subcommand that renders a 3-line "not yet implemented" message naming this RCA slug, plus a general routing rule that any unrecognized `/mos:rooms` subcommand gets the standard 3-line error instead of silently defaulting to `list` (closes the whole bug class, not just this one instance). (2) `lib/mcp/tool-router.cjs`: removed `organize` from `ROOM_CONTENT_COMMANDS` (now 15 commands, matching the 15 real dispatcher cases) and from the tool's description text, with an inline comment requiring both the enum entry and the switch case to land together if `organize` is ever implemented for real. CHANGELOG.md Unreleased/Fixed entry added.

verification: Self-verified -- all of test-205-surface-fence.cjs (20/20, including the pinned ALL_TOOL_COMMANDS=65 guard, confirmed unaffected since `organize` was never a member of that array), lib/memory/soft-alias.test.cjs (45/45), lib/memory/doctor-deprecation-surface.test.cjs (34/34), test-room-state-active-room-misroute.cjs, test-tool-router-active-room-misroute.cjs, test-234-tool-description-floor.cjs (35/35, no-em-dash + description floor on room_content), build-connector-registry.cjs --check, build-orchestration-projection.cjs --check, check-render-coverage.cjs all pass with zero regressions. `node -e` confirmed the enum now has exactly 15 entries with no `organize`. test-209-declared-implies-wired.cjs fails, but reproduced as pre-existing/unrelated via git-stash isolation (see Evidence).

HUMAN CODE-REVIEW CONFIRMATION (2026-08-24, checkpoint response): human independently read `commands/rooms.md` and `lib/mcp/tool-router.cjs` directly (not relying on this session's own claims) and confirmed both changes are correct as reported -- the `organize` subcommand is present in `commands/rooms.md` with the honest not-yet-implemented message, and `organize` is removed from `ROOM_CONTENT_COMMANDS` in `lib/mcp/tool-router.cjs` with the explanatory comment. Fix is CONFIRMED CORRECT via direct code review.

KNOWN CAVEAT, NOT A FIX DEFECT: a live re-run of the `room_content` MCP tool call with `command: "organize"` in the human's own session still returned the old `Unknown room_content command: organize` error. This is the pre-existing, repo-wide stale-MCP-server-process pattern (see personal memory `feedback_dev_repo_fix_not_live_until_released.md`: a MindrianOS-Plugin commit on disk is not live in a running session until a fresh process picks it up -- a running MCP server never hot-reloads mid-session even after the source file changes). That session's MCP server process was spawned before this fix landed on disk, so it is still serving the old schema from memory. Full end-to-end live-MCP verification is PENDING a fresh process/session and is expected to pass then; this is not evidence against the fix, and is not being treated as an open defect. Both self-verified test-suite results and the human's direct source-level code review stand as sufficient confirmation to resolve this session.

files_changed:
  - commands/rooms.md (added `organize` subcommand + unrecognized-subcommand routing rule)
  - lib/mcp/tool-router.cjs (removed `organize` from ROOM_CONTENT_COMMANDS enum + tool description)
  - CHANGELOG.md (Unreleased/Fixed entry)
commits: [] # not yet committed -- committed on archive_session after human verification, per debug-file protocol
