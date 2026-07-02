---
kind: quick
slug: 20260702-update-restart-cue
opened: 2026-07-02
source: .planning/debug/windows-install-update-ux.md (F8)
status: in-progress
---

# Quick: update restart cue (F8)

## Problem (F8)

After `claude plugin update` swaps installPath under a RUNNING session, the
in-memory slash-command registry (built once at session start) goes stale.
`/mos:help` returns "Unknown command" and commands appear to vanish. Disk state
is healthy; a restart fully restores them. Users read the vanish as breakage.
This is the single strongest driver of the "update does not go smooth"
perception.

## Two changes

1. **LOUD RESTART BANNER** at the END of the `/mos:update` flow
   (`commands/update.md` Step 8) and at the end of the post-update user-facing
   report (`scripts/post-update-activation.cjs` renderActionReport). Bordered,
   unmissable, the LAST thing the user sees. Approved UI glyphs only, no emoji.

2. **STALE-REGISTRY SELF-DETECTOR** (Part 7 of
   `scripts/sessionstart-post-update-preflight.cjs`): at session start compare
   the version this session loaded from (CLAUDE_PLUGIN_ROOT plugin.json, or the
   installPath basename) against `installed_plugins.json`'s registered version
   for `mos@mindrian-marketplace`. If they DIFFER, emit a restart-cue
   additionalContext + systemMessage banner. Defensive: never blocks the chain
   ({continue:true}, exit 0 on ANY error), pure CJS built-ins, cheap (two JSON
   reads, no Brain probe).

## Tests

`tests/test-update-restart-cue.cjs`:
- (a) version mismatch -> restart cue emitted
- (b) versions match -> silent no-op (no additionalContext)
- (c) malformed / missing installed_plugins.json -> graceful {continue:true}, no throw
- (d) grep-test: commands/update.md ends with the banner block

## Rules honored

- No em-dashes (hyphens only). No --no-verify. `node -c` every touched .cjs.
- Extend the existing preflight in-style (Part 7); do not fork a new hook.
- commands/update.md is a DECLARING surface: preserve frontmatter, run
  `node scripts/check-shape-declaration.cjs --check` before commit.
- Hot-path cheap; SessionStart hook stays non-blocking.

## Commits

`quick(update-restart-cue): ...` atomic per change, on main.
