---
id: SEED-007
status: dormant
planted: 2026-05-07
planted_during: v1.13.0-beta.8 (active milestone -- "The Closed Loop")
trigger_when: |
  Surface during /gsd:plan-phase when Phase 115 (owned-emotion-dual-path-first-touch)
  is the target phase. Also surface at the v1.13.0 release-gate audit (after Phase 119
  room-as-receipt-invariant ships) before the milestone is archived.
scope: Medium
canon_parts: [Part 6, Part 10]
binds_to_phase: 115
binds_to_milestone: v1.13.0
---

# SEED-007: Version-dynamic stamp on every first-touch greeting

## Why This Matters

On 2026-05-07 a stale "Three ways to do this" greeting from MindrianOS v1.12.0
was still rendering on a user's Windows install -- complete with em-dashes
(violating the no-em-dash hard rule) -- even though the canonical plugin had
advanced to v1.13.0-beta.8. The user had no visible signal that they were
talking to a stale version. Two failures stacked:

1. **Static version copy goes stale silently.** Greeting strings hardcoded a
   marketing tone tied to a specific version. When the version moved, the copy
   didn't, and there was no scanner to catch it.
2. **No version-of-record in the first-touch surface.** The user could not
   tell, from the greeting alone, which MindrianOS version was answering them.
   This makes drift undiagnosable from the user side and makes Larry's
   first-impression promise un-falsifiable.

This is a Canon Part 6 violation (dog-fooding mandate -- the plugin must honor
its own canon) and a Canon Part 10 violation (Conversation IS the surface --
if the surface lies about which version it is, the conversation is unreliable
from word one).

## When to Surface

**Trigger:** /gsd:plan-phase against Phase 115, OR v1.13.0 release-gate audit.

This seed should be presented during `/gsd:new-milestone` or `/gsd:plan-phase`
when the milestone scope matches any of these conditions:

- Phase 115 (owned-emotion-dual-path-first-touch) re-enters planning
- Phase 119 (room-as-receipt-invariant) is being verified at v1.13.0 release gate
- A canon-conformance audit runs against scripts/session-start
- A no-emdash scanner is being added to the release pipeline (overlap surface)

## Scope Estimate

**Medium** -- one phase. Roughly:

- Touches scripts/session-start (no-room branch + update branch), commands/splash.md,
  commands/onboard.md, agents/larry-extended.md frontmatter, and lib/copy/115-spec-strings.cjs
- Adds scripts/check-no-version-literal.cjs scanner to release pipeline (mirrors
  Canon Part 8 brain-boundary-scan pattern)
- Adds scripts/check-no-emdash.cjs as a sibling scanner (catches the second half
  of the original failure mode)
- Adds a release-gate dogfood test: stamp a synthesized v1.99.0 plugin.json
  and confirm session-start renders "v1.99.0" without any code change

Estimated 2-3 days. Could fold into Phase 115 plans 02 and 04 if 115 has not
yet executed; otherwise becomes a standalone follow-up phase (Phase 115.1).

## Acceptance Criteria

1. Zero version literals (`1.13`, `1.12`, `v1.13.0`, etc.) appear in any of:
   - scripts/session-start (greeting strings)
   - commands/splash.md (body copy)
   - commands/onboard.md (opening framing)
   - agents/larry-extended.md (initialPrompt + persona variants)
   - lib/copy/115-spec-strings.cjs (canonical first-touch copy)

2. Each first-touch surface resolves the version at session-start hook time
   from `.claude-plugin/plugin.json` and stamps it into the greeting header
   line. Format suggestion: `[MindrianOS v{version}]` as the leading token of
   the rendered greeting body.

3. A release-gate scanner (`scripts/check-no-version-literal.cjs`) runs as a
   PR check on the same trigger surface as the brain-boundary-scan. Pattern:
   any string match for `v?\d+\.\d+\.\d+` inside the greeting-copy files
   listed in (1) is a hard fail. Allowlist explicit exceptions (e.g. CHANGELOG
   blocks, version-comparison helpers).

4. A sibling scanner (`scripts/check-no-emdash.cjs`) blocks em-dashes
   (`--` / `—` / `–`) from any greeting-copy file. Catches the
   second half of the original 2026-05-07 finding.

5. Dogfood verification: a test stamps `1.99.0-test` into plugin.json,
   triggers session-start in a sandboxed cold-start scenario, and asserts
   that the rendered greeting contains "v1.99.0-test". Then the test reverts
   plugin.json. Test lives at `tests/test-115-version-dynamic-first-touch.sh`.

## Breadcrumbs

Related code and decisions found in the current codebase:

- `scripts/session-start` lines 440-484 -- the no-room mode-routing branch
  that currently inlines the v1.12.0 "Three ways" copy with em-dashes.
- `lib/copy/115-spec-strings.cjs` -- existing canonical-copy module from
  Phase 115 (`INITIAL_PROMPT_DEFAULT`, `NEW_PROJECT_OPENER`). The
  version-stamp helper should land here as `firstTouchHeader(version)`.
- `agents/larry-extended.md` lines 11-22 -- 9 persona-variant initialPrompt
  strings, currently version-agnostic (good) but not version-stamped (gap).
- `.claude-plugin/plugin.json` -- single source of truth for version.
  Read at session-start, never elsewhere.
- `commands/splash.md`, `commands/onboard.md` -- two more first-touch
  surfaces that need the same treatment.
- `.planning/phases/115-owned-emotion-dual-path-first-touch/115-CONTEXT.md`
  D-02..D-08 -- the 8 surfaces Phase 115 already touches. Add a D-19 to
  CONTEXT.md when the seed fires, capturing the version-dynamic requirement
  inline so the Phase 115 plans regenerate with this scope folded in.
- `mcp-server-brain/check-brain-boundary.cjs` (proposed PR gate per Canon
  Part 8, status pending) -- the architectural template for the new
  `check-no-version-literal.cjs` and `check-no-emdash.cjs` scanners.
- Memory: `feedback_no_emdashes.md` (user memory, hard rule). The scanner
  in (4) operationalizes that rule for the first-touch surface family.

## Notes

The user explicitly asked NOT to execute this now (2026-05-07 conversation).
Plant only. The seed exists so that the next time Phase 115 re-enters
planning -- or the v1.13.0 release gate audits canon conformance -- the
context is preserved with full WHY, ACCEPTANCE, and BREADCRUMBS. No one has
to re-discover the 2026-05-07 finding.

Defer-driver: the 2026-05-07 conversation was triggered by the user pasting
a stale v1.12.0 greeting with em-dashes from a Windows install. The
immediate diagnosis (stale install + drifted hook copy + missing version
stamp) was correct. The fix architecture (single-source greeting copy +
no-emdash scanner + version-dynamic stamp) was agreed. Execution was
deferred pending Phase 115 plan refresh. This seed carries the agreement
forward.
