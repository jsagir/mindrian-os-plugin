---
status: resolved
kind: rca
trigger: "stop-hook-invalid-hookspecificoutput-schema"
issue_id: ""
severity: high
surfaces: [cli, desktop]
brain_mode: local-only
canon_parts: []
created: 2026-07-23
updated: 2026-07-23
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: RESOLVED. Confirmed by direct code read (not just the user's paste) at all
  3 sites, fixed, and verified with both real and synthetic-fixture runs plus the full
  existing card-fire test suite (2 pre-existing test files updated after they were found
  to assert the buggy shape as "expected"). See Resolution below.
test: n/a - resolved
expecting: n/a - resolved
next_action: none. Left uncommitted for the navigator to commit, per the "GSD workflow
  does the fix, the user commits" convention already used by sibling resolved sessions
  in this directory (e.g. card-fire-over-enforcement.md).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.43 (in progress, unreleased)
- Reported by: Jonathan (live pasted Stop-hook error transcript, verbatim, this session)
- Date first observed: 2026-07-23 (live, this session); root-cause CLASS first observed
  2026-04-15 (see Technical Root Cause history below)
- Related debug sessions: `.planning/debug/resolved/card-fire-over-enforcement.md`
  (same Stop hook, `check-card-fire.cjs` -- a DIFFERENT axis: that RCA is about the
  interceptor firing TOO OFTEN on stale/irrelevant gates; THIS RCA is about the JSON
  envelope shape being schema-INVALID whenever it fires at all, regardless of whether
  firing was the right call. Read in full to confirm non-overlap: confirmed -- that RCA's
  fix (A: side-channel freshness scoping, B: staleness-aware relevance floor) never
  touched `buildEnforcementEnvelope` or the `hookSpecificOutput` key; this RCA's fix never
  touches `classifyCardFire`'s firing decision.)
- `.planning/debug/resolved/card-fire-block-surface.md` -- prior art for the CR-06 finding
  (Claude Code shows "Stop hook error: <reason>" regardless of systemMessage) referenced
  in `check-card-fire.cjs`'s own comments; not a duplicate of this finding either (that
  one is about which field Claude Code SURFACES to the user, not which fields the
  validator ACCEPTS).

## Source-of-Truth Preamble

- **CODE claims read against:** `/home/jsagi/dev/MindrianOS-Plugin` working tree (main,
  HEAD `592a0de1`, v1.15.3-beta.43 in progress) -- the dev workspace, never the plugin
  install cache.
- **WIRE claims probe against:** n/a. This is a local JSON-shape schema-conformance bug;
  no Brain/network wire is involved. Claude Code's own hook-output JSON validator (the
  thing that rejected the envelope) is the runtime under test; its "Expected schema" text
  is quoted verbatim from the user's live pasted error, not re-derived.
- **Date of audit:** 2026-07-23
- **Re-verification rule:** all 3 sites were re-read directly from the working tree
  before editing (not trusted from the paste alone); see Evidence.

## Problem Statement

Three of this repo's Stop hooks emit a `hookSpecificOutput` block in their JSON output,
but Claude Code's Stop-hook schema does not define a `hookSpecificOutput` variant for
the Stop event at all -- so every time one of those branches fires, Claude Code's
validator rejects the WHOLE envelope and shows the user a raw
`Hook JSON output validation failed: - : Invalid input` dump instead of the calm,
human-facing text the code carefully set.

## Symptoms

expected: when `scripts/check-card-fire.cjs` (or the other two sites) blocks a Stop
  event to enforce a re-prompt, Claude Code should show the human-facing
  `systemMessage`/`reason` text the code sets ("Re-rendering your choices as a
  selectable card...").
actual: Claude Code instead prints a raw schema-validation failure dump, showing the
  full (unhelpful, developer-facing) JSON the hook emitted and Claude Code's own
  "Expected schema" reference block, on every turn where the buggy branch fires.
errors: (verbatim, pasted by the user this session)
  ```
  Ran 6 stop hooks
    Stop hook error: JSON validation failed: Hook JSON output validation failed:
      - : Invalid input

    The hook's output was: {
      "decision": "block",
      "reason": "rendering your choices as a selectable card",
      "systemMessage": "Re-rendering your choices as a selectable card...",
      "continue": false,
      "hookSpecificOutput": {
        "hookEventName": "Stop",
        "additionalContext": "This turn REACHED a Decision Gate but did NOT fire the
          interactive card. ..."
      }
    }

    Expected schema:
    {
      "continue": "boolean (optional)",
      "suppressOutput": "boolean (optional)",
      "stopReason": "string (optional)",
      "decision": "\"approve\" | \"block\" (optional)",
      "reason": "string (optional)",
      "systemMessage": "string (optional)",
      "permissionDecision": "\"allow\" | \"deny\" | \"ask\" (optional)",
      "hookSpecificOutput": {
        "for PreToolUse": { ... },
        "for UserPromptSubmit": { ... },
        "for PostToolUse": { ... }
      }
    }
  ```
  The `hookSpecificOutput` union in the "Expected schema" has exactly THREE variants
  (PreToolUse, UserPromptSubmit, PostToolUse) -- there is no Stop variant. Including the
  key at all on a Stop envelope is what the validator rejects.
reproduction:
  1. Trigger `scripts/check-card-fire.cjs`'s intercept branch: reach a registry
     gate-reaching surface (or render the ASCII-box anti-pattern) without firing the
     `AskUserQuestion` card.
  2. Observe the Stop hook chain run; `check-card-fire.cjs`'s envelope carries
     `hookSpecificOutput: { hookEventName: 'Stop', additionalContext: ... }`.
  3. Claude Code's validator rejects the whole envelope; the user sees the raw
     validation-error dump instead of "Re-rendering your choices as a selectable
     card...".
started: the DEFECT CLASS started 2026-04-15 (v1.10.9, `scripts/on-stop`, first
  occurrence). This specific occurrence (`check-card-fire.cjs`) is newer -- the
  `hookSpecificOutput` block in `buildEnforcementEnvelope`'s intercept branch has been
  present since the Finding-1 fix referenced in the file's own CR-06 comment; exact
  introduction commit not bisected (out of scope for a same-day fix-and-document
  session), but the `ALLOWED_ENVELOPE_KEYS` allowlist already listed
  `hookSpecificOutput` before this session's fix, meaning the key was long-standing,
  not a recent add.

## Scope and Impact

- Affected surfaces: `cli` confirmed (this is where the user hit it). `desktop`
  probable-affected -- `docs/ARCHITECTURE-DEEP-DIVE.md` states "CLI + Desktop: share
  CLAUDE.md, .mcp.json, hooks, skills", i.e. Desktop runs the same `hooks/hooks.json`
  Stop hooks, so the same validator rejection would surface there too. `cowork` -- not
  confirmed either way in the docs read this session (Cowork's row in the same doc only
  names `00_Context/` auto-gen and scheduled tasks, not hook execution); flagged as
  UNCONFIRMED rather than asserted clean. The underlying defect is a JSON-shape bug in
  Claude Code's own hook-output validator, which is surface-agnostic wherever hooks.json
  is honored -- so the safest posture is "fixed everywhere the code runs" rather than
  scoping the fix to `cli` only, which is what this session did.
- Affected commands: none directly (`/mos:*` commands are unaffected); this is Stop-hook
  chain output only, which fires after every assistant turn regardless of which command
  was used.
- Affected users: all users whose session reaches any of the 3 buggy branches (Site 1:
  every reached-but-uncarded Decision Gate turn; Site 2: only `MINDRIAN_MCP_FIRST`-flag
  sessions; Site 3: currently NONE at runtime -- see the Site 3 dormancy note in
  Technical Root Cause).
- Version range: long-standing (Site 1's `hookSpecificOutput` predates this session);
  first reported live 2026-07-23 (v1.15.3-beta.43, unreleased).
- Blast radius: any FUTURE Stop hook script that copies this shape (which is exactly
  why the new `scripts/verify-release` gate exists -- see Required Code Changes).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: this is a duplicate of `card-fire-over-enforcement.md` (the Stop hook
  fires when it shouldn't).
  evidence: that RCA's root cause is a stale side-channel gate-reach record bleeding
  into unrelated turns and a relevance-floor default that over-forces on short text --
  entirely about WHETHER to intercept. This RCA is about the JSON SHAPE of the envelope
  once an intercept decision (correct or not) has already been made. The two root
  causes live in disjoint code (`classifyCardFire`'s relevance logic vs.
  `buildEnforcementEnvelope`'s key set) and neither fix touches the other's code path.
  timestamp: 2026-07-23T00:00:00Z
- hypothesis: `scripts/feynman-minto-guardian.cjs`'s "v1.10.19" comment (wrap in
  hookSpecificOutput because top-level systemMessage is rejected) might be correct for
  SOME other hook event even if wrong for Stop, so the fix should special-case rather
  than remove the wrapper outright.
  evidence: the user's live pasted "Expected schema" block explicitly lists
  `systemMessage` as a valid TOP-LEVEL optional field with no event-type qualifier, and
  lists `hookSpecificOutput` with exactly three named event-specific shapes (PreToolUse,
  UserPromptSubmit, PostToolUse) and no Stop shape at all. There is no schema-legal way
  to attach `hookSpecificOutput` to a Stop envelope, for any reason. The comment's
  premise was flatly wrong for the Stop event, not merely incomplete.
  timestamp: 2026-07-23T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-23T00:00:00Z
  checked: `scripts/check-card-fire.cjs` lines 668-709 (`buildEnforcementEnvelope`) and
  lines 283-291 (`ALLOWED_ENVELOPE_KEYS`), read directly (not trusted from the paste).
  found: the intercept branch's `raw` object carried
  `hookSpecificOutput: { hookEventName: 'Stop', additionalContext: <re-prompt text> }`
  alongside `decision`/`reason`/`systemMessage`/`continue`; `ALLOWED_ENVELOPE_KEYS`
  included `'hookSpecificOutput'` in its allowlist, so the key-filter at the bottom of
  the function did not strip it.
  implication: confirmed Site 1, the actively-reproducing site (the user's pasted
  `additionalContext` text is an exact match to this branch's literal string).
- timestamp: 2026-07-23T00:00:00Z
  checked: `scripts/on-stop` lines 42-119 (the `MINDRIAN_MCP_FIRST` thin-adapter branch,
  Phase 198-09) and lines 513-522 (the file's own LEGACY success-output branch, already
  fixed 2026-04-15).
  found: lines 91-100 (inside an inline `node -e` heredoc) constructed
  `{ decision, reason, continue, systemMessage, hookSpecificOutput: { hookEventName:
  'Stop', additionalContext: body || <fallback text> } }` -- the SAME defect,
  reintroduced inside the SAME FILE that had already fixed it once (the comment at
  lines 513-522 explicitly documents the 2026-04-15 v1.10.9 -> v1.10.10 fix and states
  "Stop hooks DO NOT support hookSpecificOutput at all").
  implication: confirmed Site 2 -- a straight regression within one file, gated behind
  `MINDRIAN_MCP_FIRST` (unset by default, so this specific site is not what the
  reporting user hit, but is live for anyone running with that flag on).
- timestamp: 2026-07-23T00:00:00Z
  checked: `scripts/feynman-minto-guardian.cjs` lines 393-424 (`runOnStop`'s
  systemMessage-retrofit block) directly.
  found: the `worstIdx >= SEVERITY_ORDER.indexOf('error')` branch built
  `{ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: msg } }`, preceded
  by a comment dated "v1.10.19 (hotfixes shipped 2026-04-26)" claiming the OPPOSITE of
  the correct rule ("wrap in hookSpecificOutput per Claude Code 2.x schema
  (additionalProperties: false rejects top-level systemMessage)").
  implication: confirmed Site 3 and confirmed the comment's premise is backwards, per
  the user's live "Expected schema" evidence (systemMessage IS a valid top-level field;
  hookSpecificOutput has no Stop variant at all).
- timestamp: 2026-07-23T00:00:00Z
  checked: how `scripts/feynman-minto-guardian.cjs`'s `runOnStop` is actually invoked --
  grepped the full repo for callers.
  found: the ONLY caller is `scripts/on-stop:454`:
  `timeout 1 node ".../scripts/feynman-minto-guardian.cjs" on-stop "${ROOM_DIR}"
  >/dev/null 2>&1 || true` -- BOTH stdout and stderr are redirected to `/dev/null`. It is
  NOT one of the 6 scripts `hooks/hooks.json`'s `Stop` array registers directly.
  implication: **Site 3's invalid JSON currently does NOT reach Claude Code's hook
  validator at runtime** -- this specific call path discards it. Fixed anyway (dormant
  code that constructs an invalid envelope is still a landmine: any future edit that
  captures/forwards this subprocess's stdout, or any other caller that does not discard
  it, would resurface the exact live symptom silently). This nuance did not stop the
  fix; it changes only the severity framing for Site 3 specifically (dormant vs. live).
- timestamp: 2026-07-23T00:00:00Z
  checked: `hooks/hooks.json`'s `Stop` array (6 entries) and `hooks/run-hook.cmd`
  (confirms `run-hook.cmd <name>` execs `scripts/<name>` verbatim, so the `on-stop`
  entry resolves to `scripts/on-stop`).
  found: the 6 registered Stop hooks are `scripts/on-stop` (via `run-hook.cmd`),
  `scripts/operator-update.cjs`, `scripts/jtbd-update.cjs`, `scripts/hmi-compliance-poll.cjs`,
  `scripts/gsd-graph-derive-sweep.cjs`, `scripts/check-card-fire.cjs` -- matching the
  user's pasted "Ran 6 stop hooks" line exactly.
  implication: used this exact enumeration (not hand-guessed) to build the new
  `scripts/verify-release` gate's file list.
- timestamp: 2026-07-23T00:00:00Z
  checked: whether an existing release gate already covers this. Found
  `scripts/check-hook-schema-compatibility.cjs` -- a previously-authored scanner whose
  own docstring says it was meant to be "wire[d] into scripts/release.sh and the
  pre-push hook" but never was (confirmed: grepped `verify-release`, `release.sh`, and
  git hooks for its name -- zero references).
  found (critical): running it (`node scripts/check-hook-schema-compatibility.cjs`)
  passed with 0 findings on the CURRENT (pre-fix) tree -- because its `FORBIDDEN_PATTERNS`
  encoded the SAME backwards premise as the feynman-minto-guardian.cjs comment (ban
  top-level `systemMessage`, require `hookSpecificOutput`), which is the OPPOSITE of the
  correct rule and would never catch this defect class; worse, if it had ever been wired
  in, it would have BLOCKED this exact fix (which emits top-level `systemMessage`) and
  encouraged reintroducing `hookSpecificOutput`.
  implication: this file is itself a THIRD piece of evidence of the same wrong belief
  (in addition to the on-stop MCP-first regression and the feynman-minto-guardian.cjs
  comment) -- an actual repo artifact, named like an authority, sitting unwired and
  backwards. Corrected in place (see Required Code Changes) rather than left as a
  landmine, per Canon Part 7 (reuse before build) and to avoid a 5th occurrence of this
  defect class if someone later wires the ORIGINAL version in trusting its name.
- timestamp: 2026-07-23T00:00:00Z
  checked: ran the full pre-fix `check-card-fire.cjs`-adjacent test suite (9 files) to
  establish a baseline before editing.
  found: `tests/test-ga4-card-fire-e2e-179.cjs` and `tests/test-ga4-card-fire-interceptor.cjs`
  each hard-asserted the envelope CARRIES `hookSpecificOutput.additionalContext` -- i.e.
  they encoded the bug as the expected, correct behavior. All other 7 files were
  unaffected by the fix.
  implication: these 2 test files needed their assertions corrected (not reverted) to
  match the schema-valid shape; done as part of this session's fix (see Required Code
  Changes / files_changed).

## Technical Root Cause

Claude Code's Stop-hook output schema union for `hookSpecificOutput` defines exactly
three event-specific shapes -- PreToolUse, UserPromptSubmit, PostToolUse -- and no Stop
shape. A Stop-hook JSON envelope that includes a `hookSpecificOutput` key at all (any
shape, any content) fails schema validation as a whole
(`additionalProperties: false`-class rejection: "Hook JSON output validation failed:
- : Invalid input"), discarding every other field in the same envelope, including a
calm, correctly-set `decision`/`reason`/`systemMessage`. The user sees Claude Code's raw
validator error instead of the intended calm text, on every turn the offending branch
fires.

This is the FOURTH live occurrence of the exact same defect class in this repo:

1. **1st occurrence (root-caused and fixed):** `scripts/on-stop`'s legacy success-output
   branch, lines 513-522. Introduced pre-v1.10.9, witnessed live on Windows 2026-04-15,
   fixed for v1.10.10. The fix's own comment (still in the file, unmodified by this
   session) states the correct rule plainly: "Stop hooks DO NOT support
   hookSpecificOutput at all... systemMessage is the correct field per the schema and
   produces no validation noise."
2. **2nd occurrence (this session's Site 3):** `scripts/feynman-minto-guardian.cjs`'s
   `runOnStop` systemMessage-retrofit block, introduced under a "v1.10.19 (hotfixes
   shipped 2026-04-26)" comment that got the rule BACKWARDS -- it claimed
   `hookSpecificOutput` wrapping was REQUIRED because top-level `systemMessage` would be
   rejected. This directly contradicts the 1st occurrence's own (correct) fix comment,
   which was already in the same repo at the time. Currently dormant at runtime (see
   Evidence: the only caller discards its stdout), but fixed as a landmine regardless.
3. **3rd occurrence (this session's Site 2):** `scripts/on-stop`'s own Phase 198-09
   `MINDRIAN_MCP_FIRST` thin-adapter branch (lines 91-100) reintroduced the identical
   defect INSIDE THE SAME FILE that had already fixed it once at lines 513-522 -- a
   straight regression, not a new author repeating an old mistake elsewhere. Live for
   any session running with `MINDRIAN_MCP_FIRST` set.
4. **4th occurrence (this session's Site 1, the one the user actually hit):**
   `scripts/check-card-fire.cjs`'s `buildEnforcementEnvelope` intercept branch, plus its
   `ALLOWED_ENVELOPE_KEYS` allowlist explicitly legitimizing the key. Live and firing on
   every reached-but-uncarded Decision Gate turn -- the exact symptom in the user's
   pasted transcript.

A related, non-code finding surfaced investigating this: `scripts/check-hook-schema-compatibility.cjs`
existed in the repo, unwired into any release gate, and encoded the SAME wrong belief as
occurrence #2's comment (ban top-level `systemMessage`, require `hookSpecificOutput`).
Had it ever been wired in as its own docstring intended, it would have actively blocked
the correct fix and encouraged reintroducing the bug. Corrected in place rather than left
to cause a 5th occurrence.

- Site: `scripts/check-card-fire.cjs:668-709` function `buildEnforcementEnvelope`
  (intercept branch), plus `:283-291` (`ALLOWED_ENVELOPE_KEYS`)
- Site: `scripts/on-stop:91-100` (inline `node -e` inside the `MINDRIAN_MCP_FIRST`
  thin-adapter branch)
- Site: `scripts/feynman-minto-guardian.cjs:410-423` (inside `runOnStop`)
- Cause (all 3): a JSON object literal builds a top-level `hookSpecificOutput` key with
  `hookEventName: 'Stop'`, which has no schema-legal shape.
- Why it surfaces now: occurrence #4 (`check-card-fire.cjs`) is a Stop-hook branch that
  fires whenever a Decision Gate is reached without an `AskUserQuestion` card -- a
  common, everyday path (not an edge case), which is why the user hit it "on every
  message."

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `scripts/check-card-fire.cjs:668-709`, function `buildEnforcementEnvelope`
  - Current behavior: intercept branch built `hookSpecificOutput: { hookEventName:
    'Stop', additionalContext: <re-prompt text> }` alongside the calm fields.
  - Required behavior: remove the `hookSpecificOutput` block outright; keep
    `decision`/`reason`/`systemMessage`/`continue` exactly as-is (already calm,
    human-safe text per CR-06). The `additionalContext` re-prompt text has no valid
    Stop-hook delivery channel in the current schema and is dropped, not relocated into
    `reason`/`systemMessage` (which must stay calm per CR-06, never carry model-directive
    text).
  - Location: `scripts/check-card-fire.cjs:283-291`, `ALLOWED_ENVELOPE_KEYS`
  - Current behavior: allowlist included `'hookSpecificOutput'`.
  - Required behavior: remove it, so a future call site that tries to reintroduce the key
    is silently key-filtered rather than shipping broken JSON.
  - Short-term patch: same as the fix (this is a one-shot removal, no interim step).
  - Long-term fix: the new `scripts/verify-release` gate (Change 4) is the structural
    backstop preventing recurrence.
- Change 2:
  - Location: `scripts/on-stop:91-100` (inside the `MINDRIAN_MCP_FIRST` thin-adapter
    branch's inline `node -e`)
  - Current behavior: `out` object carried `hookSpecificOutput: { hookEventName: 'Stop',
    additionalContext: body || <fallback> }` alongside `decision`/`reason`/`continue`/
    `systemMessage`.
  - Required behavior: remove the `hookSpecificOutput` block; keep
    `decision`/`reason`/`continue`/`systemMessage` unchanged (`systemMessage` stays the
    fixed calm string 'A pending decision needs your input.' -- the rendered-zones
    `body` text it used to carry is dropped, not relocated, matching Change 1's
    reasoning). Added an inline comment pointing back at the precedent fix at this same
    file's lines 513-522.
  - Long-term fix: same structural gate (Change 4) covers this file too.
- Change 3:
  - Location: `scripts/feynman-minto-guardian.cjs:410-423`, inside `runOnStop`
  - Current behavior: `payload = { hookSpecificOutput: { hookEventName: 'Stop',
    additionalContext: msg } }`, preceded by a comment claiming this wrapping is
    REQUIRED.
  - Required behavior: `payload = { systemMessage: msg }` (top-level, schema-valid). The
    stale comment is REPLACED (not left in place) with a corrected one citing this RCA
    and the live evidence that disproved the old claim.
- Change 4 (regression prevention):
  - Location: `scripts/check-hook-schema-compatibility.cjs` (full rewrite of its
    detection logic; the file, its exit-code contract, and its ALLOWLIST scaffold are
    reused, not replaced with a new file, per Canon Part 7)
  - Current behavior: scanned `scripts/`, `hooks/`, `lib/core/`, `lib/memory/`,
    `lib/mcp/` for top-level `systemMessage`/`additionalContext` patterns and FORBADE
    them -- the backwards rule (see Evidence).
  - Required behavior: enumerate every script `hooks/hooks.json`'s `Stop` array
    registers (resolving `run-hook.cmd <name>` to `scripts/<name>`), follow one level of
    subprocess invocation (catches `scripts/on-stop` -> `scripts/feynman-minto-guardian.cjs`
    even though the latter is not directly hooks.json-registered), and FAIL if any
    resolved file contains the literal `hookEventName: 'Stop'` inside a
    `hookSpecificOutput`-shaped construct.
  - Location: `scripts/verify-release`
  - Required behavior: new numbered section 16 ("Stop Hook hookSpecificOutput Schema
    Gate"), same style/placement convention as section 15's `os.rename` gate, calling
    `node scripts/check-hook-schema-compatibility.cjs` and failing the release on
    non-zero exit.

## Tests to Add or Update

- Test 1 (updated, not net-new):
  - Type: integration (spawns the real script)
  - Location: `tests/test-ga4-card-fire-e2e-179.cjs`
  - Given: a realistic Stop stdin + ascii-box transcript that triggers the intercept
    branch
  - When: the (E2E-1) assertion runs
  - Then: the envelope has NO `hookSpecificOutput` key and carries a non-empty
    `systemMessage` (previously asserted the OPPOSITE -- that `hookSpecificOutput.additionalContext`
    was present and mentioned AskUserQuestion; that assertion was itself the bug and is
    corrected here)
  - Runner registration: already registered; no new registration needed.
- Test 2 (updated, not net-new):
  - Type: unit
  - Location: `tests/test-ga4-card-fire-interceptor.cjs`
  - Given: a verdict fed into `buildEnforcementEnvelope`
  - When: the ENVELOPE assertions run
  - Then: the intercept envelope has `hookSpecificOutput === undefined`, carries
    `decision: 'block'` + `continue: false`, and a non-empty `systemMessage` (previously
    asserted the envelope MUST carry `hookSpecificOutput`; corrected)
  - Runner registration: already registered; no new registration needed.
- Test 3 (manual verification this session, no persistent fixture file added -- ad hoc
  synthetic checks, documented here for reproducibility):
  - Type: unit (direct module require + monkey-patched stdout capture)
  - Location: none persisted (`scripts/feynman-minto-guardian.cjs` has no dedicated test
    file in this repo; a minimal fixture room with one section directory containing
    `ROOM.md` but no `MINTO.md` triggers the built-in `existence-check` synthetic
    'error'-severity violation, which drives the exact branch under fix without needing
    custom validators)
  - Given: a fixture room dir with a section missing `MINTO.md`
  - When: `runOnStop(roomDir, [])` is called directly
  - Then: captured stdout parses to `{ "systemMessage": "guardian: error in section ...
    (existence, glyph low)" }` with NO `hookSpecificOutput` key and no keys outside
    `{continue, suppressOutput, stopReason, decision, reason, systemMessage,
    permissionDecision}`
  - Runner registration: none (ad hoc verification; consider promoting to a persisted
    fixture test in a follow-up if `feynman-minto-guardian.cjs` gains a dedicated suite).
- Test 4 (new, the regression gate itself):
  - Type: unit/integration (release-gate script)
  - Location: `scripts/check-hook-schema-compatibility.cjs`
  - Given: the corrected repo tree (post-fix)
  - When: the scanner runs
  - Then: exits 0, "PASS", enumerating 14 resolved Stop-hook-reachable files
  - Given (control case): a synthetic fixture repo with the forbidden pattern injected
  - When: the scanner runs against it
  - Then: exits 1, "FAIL", names the exact file/line
  - Runner registration: wired into `scripts/verify-release` section 16 (runs on every
    pre-release verification, not a standalone `tests/` file).

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: Fixed entry added under `[Unreleased] -- v1.15.3-beta.43` (this session).
- Release lockstep: this fix has not been released yet (still `v1.15.3-beta.43 (in
  progress)`); when it ships, the standard version-bump lockstep in
  `.claude/includes/release-process.md` applies as normal -- no special handling beyond
  that (this RCA does not itself bump the version).
- Canon: no Canon Part touched (no Brain wire, no invocation-registration change) --
  `canon_parts: []` is correct as filed; not updating `docs/CANON-PHASE-MAP.md`.
- knowledge-base.md: summary block appended (this session, see below).
- Follow-up worth flagging, not blocking: confirm whether Cowork's runtime executes
  `hooks/hooks.json` Stop hooks identically to CLI/Desktop (this session found
  CLI+Desktop confirmed via `docs/ARCHITECTURE-DEEP-DIVE.md`; Cowork unconfirmed either
  way). Low urgency since the fix removes the invalid key everywhere regardless of which
  surfaces execute it.
- Follow-up worth flagging, not blocking: `scripts/feynman-minto-guardian.cjs`'s
  `runOnStop` output is currently discarded by its only caller
  (`scripts/on-stop:454`, `>/dev/null 2>&1`). If a future change starts forwarding that
  subprocess's stdout (e.g. to surface guardian warnings to the user), the fix in this
  RCA is what keeps that future change schema-valid -- no further action needed now, but
  worth knowing this file's Stop-hook code path is presently dormant, not deleted.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Claude Code's Stop-hook output schema defines `hookSpecificOutput` only for
  three events (PreToolUse, UserPromptSubmit, PostToolUse) -- never Stop. Three sites in
  this repo (`check-card-fire.cjs`, `on-stop`'s MCP-first branch, and
  `feynman-minto-guardian.cjs`) built a `hookSpecificOutput: { hookEventName: 'Stop', ...
  }` block on a Stop-hook envelope anyway, which Claude Code's validator rejects in full
  (`additionalProperties: false`-class failure), discarding the calm
  `decision`/`reason`/`systemMessage` fields those same branches correctly set and
  showing the user a raw "Hook JSON output validation failed" dump instead. This is the
  4th live occurrence of the exact defect class in this repo: fixed once
  (`scripts/on-stop`, 2026-04-15, v1.10.9->v1.10.10), then reintroduced twice more under
  a backwards-premise comment ("v1.10.19") and once as a straight regression inside the
  very file that had already fixed it, plus an unwired, backwards release-gate script
  (`check-hook-schema-compatibility.cjs`) that would have actively encouraged
  reintroducing the bug had it ever been wired in.
fix: |
  Removed `hookSpecificOutput` outright from all 3 sites, keeping each branch's existing
  calm `decision`/`reason`/`systemMessage`/`continue` fields unchanged:
    - `scripts/check-card-fire.cjs`: removed the block from `buildEnforcementEnvelope`'s
      intercept branch; removed `'hookSpecificOutput'` from `ALLOWED_ENVELOPE_KEYS`.
    - `scripts/on-stop`: removed the block from the `MINDRIAN_MCP_FIRST` thin-adapter
      branch's `out` object; added a comment cross-referencing this file's own
      already-fixed legacy branch (lines 513-522) as precedent.
    - `scripts/feynman-minto-guardian.cjs`: replaced `{ hookSpecificOutput: {...} }` with
      `{ systemMessage: msg }`; replaced the stale "v1.10.19" comment (which had the rule
      backwards) with a corrected one citing this RCA and the live evidence.
  In all 3 cases, the `additionalContext`/rendered-zones text those blocks used to carry
  has no valid Stop-hook delivery channel in the current schema (additionalContext is
  UserPromptSubmit/PostToolUse-only) and per CR-06 must not be smuggled into
  `reason`/`systemMessage` (which must stay calm, human-facing text). That text is
  dropped, not relocated.

  Regression prevention: corrected `scripts/check-hook-schema-compatibility.cjs` (was
  unwired and encoded the opposite/wrong rule) to enumerate every script
  `hooks/hooks.json`'s `Stop` array registers (resolving `run-hook.cmd` targets),
  transitively follow one level of subprocess invocation (catches
  `feynman-minto-guardian.cjs` via `on-stop` even though it is not directly registered),
  and fail on the literal `hookEventName: 'Stop'` pattern. Wired into
  `scripts/verify-release` as new section 16, same style as the existing `os.rename`
  gate (section 15).

  Updated 2 pre-existing tests (`tests/test-ga4-card-fire-e2e-179.cjs`,
  `tests/test-ga4-card-fire-interceptor.cjs`) that had hard-asserted the BUGGY shape
  (`hookSpecificOutput.additionalContext` present) as the expected, correct behavior --
  corrected to assert the schema-valid shape instead.
verification: |
  - `node scripts/check-hook-schema-compatibility.cjs`: PASS, 14 Stop-hook-reachable
    files scanned (transitively resolved from hooks.json's 6 direct entries), 0 findings.
  - Synthetic positive-control test (isolated scratch fixture repo, forbidden pattern
    injected): scanner correctly FAILS, names the exact file/line -- proves detection
    actually works, not just "nothing found."
  - `buildEnforcementEnvelope` exercised directly for all 3 verdict shapes (intercept,
    degrade, no-op): each envelope's keys are a strict subset of
    `{continue, suppressOutput, stopReason, decision, reason, systemMessage,
    permissionDecision}`; intercept carries `decision:'block'`, `continue:false`, and a
    non-empty `systemMessage`.
  - `scripts/on-stop`'s corrected inline `node -e` snippet exercised directly with a
    `fire:true` fixture input: output is exactly
    `{"decision":"block","reason":"stop-gate-relevant-unanswered","continue":false,
    "systemMessage":"A pending decision needs your input."}` -- no `hookSpecificOutput`.
  - `scripts/feynman-minto-guardian.cjs`'s `runOnStop` exercised directly against a
    synthetic fixture room (one section dir with `ROOM.md`, no `MINTO.md`, triggering the
    built-in `existence-check` error-severity violation): captured stdout parses to
    `{"systemMessage":"guardian: error in section some-section (existence, glyph
    low)"}` -- no `hookSpecificOutput`, no keys outside the schema-allowed set.
  - Full existing test suite for the touched surfaces, all green after the 2 assertion
    corrections: `test-209-primary-sidechannel` 14/14, `test-209-backstop-tuning` 13/13,
    `test-209-incident-replay` 4/4, `test-209-card-fire-gate` 7/7,
    `test-card-fire-relevance-gate` 11/11, `test-doctor-card-fire-health` 6/6,
    `test-ga4-card-fire-e2e-179` 48/48 (47 orig + 1 corrected), `test-ga4-card-fire-interceptor`
    27/27, `test-b1-reconcile-canonical` 36/36, `test-198-adapter-budget.test.cjs` 15/15.
  - `bash -n scripts/verify-release`, `node -c` on all 4 touched `.cjs`/script files: all
    clean.
files_changed:
  - scripts/check-card-fire.cjs (removed hookSpecificOutput from buildEnforcementEnvelope's
    intercept branch + ALLOWED_ENVELOPE_KEYS; corrected/reworded surrounding comments)
  - scripts/on-stop (removed hookSpecificOutput from the MINDRIAN_MCP_FIRST thin-adapter
    branch; added precedent-pointing comment)
  - scripts/feynman-minto-guardian.cjs (replaced hookSpecificOutput wrapper with a
    top-level systemMessage; replaced the stale/wrong "v1.10.19" comment)
  - scripts/check-hook-schema-compatibility.cjs (full rewrite: correct rule, hooks.json-driven
    enumeration, transitive subprocess resolution)
  - scripts/verify-release (new section 16 wiring the corrected scanner in)
  - tests/test-ga4-card-fire-e2e-179.cjs (corrected the (E2E-1) hookSpecificOutput
    assertion to assert the schema-valid shape instead)
  - tests/test-ga4-card-fire-interceptor.cjs (corrected the ENVELOPE hookSpecificOutput
    assertions to assert the schema-valid shape instead)
  - CHANGELOG.md (Fixed entry under [Unreleased])
commits: uncommitted (left for the navigator to commit, per this repo's established
  GSD convention)
canon: Part 8 clean (no Brain/network symbol anywhere in the touched surfaces; pure
  local JSON-shape logic). Tri-Polar: CLI confirmed affected and fixed (live
  reproduction); Desktop confirmed same hook mechanism per
  docs/ARCHITECTURE-DEEP-DIVE.md, fix applies identically; Cowork's hook-execution
  model not explicitly confirmed in docs this session -- flagged, not blocking (the fix
  removes the invalid key unconditionally, so it is correct-by-construction wherever the
  code runs). Cross-platform: n/a, pure JSON-shape logic, not platform-specific.
  Release lockstep: not shipped yet (v1.15.3-beta.43 in progress); standard lockstep
  applies at release time, no special handling. No em-dashes: this file and all touched
  code/comments use hyphens only. Reuse before build: the new regression gate reuses
  and corrects the existing (unwired, backwards) check-hook-schema-compatibility.cjs
  rather than adding a parallel scanner.
