# Release Gates

Mandatory pre-release checks. **No version bump may ship if any gate fails.**

These gates exist because v1.10.18 shipped with three hooks that broke schema validation in Claude Code 2.x, and the plugin appeared completely broken to every user on a recent Claude Code (Aryeh Holtzberg, PWS IRIS 2025, 2026-04-26). The fix went out as a v1.10.18 in-version hotfix on 2026-04-26 -- the version number was intentionally NOT bumped so future planning artifacts continue to reference the same baseline. The gate prevents the recurrence.

## Gate 1 -- Hook Schema Compatibility

**Script:** `scripts/check-hook-schema-compatibility.cjs`

**What it scans:** every `.cjs` / `.js` / `.mjs` file in `scripts/`, `hooks/`, `lib/core/`, `lib/memory/`, `lib/mcp/`.

**What it rejects:**
- `JSON.stringify({ systemMessage: ... })` -- top-level `systemMessage` not in current Claude Code schema
- `JSON.stringify({ additionalContext: null, ... })` -- naked `null`-field envelopes fail validation
- Any direct stdout write of an envelope with top-level `systemMessage`

**What's required instead:** wrap output in `hookSpecificOutput` envelope with the correct `hookEventName`:

```javascript
const payload = {
  hookSpecificOutput: {
    hookEventName: 'PostToolUse', // or 'PreToolUse', 'SessionStart', 'Stop', etc.
    additionalContext: 'message string',
  },
};
process.stdout.write(JSON.stringify(payload) + '\n');
```

For silent exits, **emit nothing to stdout** -- just `process.exit(0)`.

**Run manually:**
```bash
node scripts/check-hook-schema-compatibility.cjs
```

**Reference:** [Claude Code Hooks Reference](https://docs.anthropic.com/en/docs/claude-code/hooks)

## When to Run

| Trigger | Required? |
|---|---|
| Before every `git tag v*` | YES (mandatory) |
| Before every `npm publish` (future) | YES |
| After installing a new Claude Code version locally | YES |
| Pre-push git hook | RECOMMENDED (when wired) |
| CI pipeline (GitHub Actions) | RECOMMENDED (when wired) |

## Adding New Gates

When a new Claude Code release breaks something else, the pattern is:

1. **Triage** the failure (identify the schema/API change)
2. **Hotfix** the affected scripts
3. **Encode** the breaking pattern as a new check in `scripts/check-hook-schema-compatibility.cjs` (or a sibling gate script if the scope is different)
4. **Document** the gate here
5. **Wire** it into the release process

This is the dog-fooding loop applied to plugin compatibility -- every regression we hit becomes a permanent gate so we never hit it twice.

## Gate 2 -- SHA-Aware Update Detection (advisory, not blocking)

**Script:** `scripts/check-version-and-sha.cjs`

**What it does:** compares both the local plugin version AND the local commit SHA against the remote `v<version>` git tag. Detects three states version-only checkers miss:
- `SHA_DIFFERS_INVERSION_HOTFIX` -- same version, but tag was force-moved
- `LOCAL_SHA=unknown` -- registry is missing gitCommitSha (manual `claude plugin install` recommended)
- `NETWORK_ERROR` -- gracefully degrades

**Why it matters:** `claude plugin update` and `/mos:update` both rely on version comparison. When an in-version hotfix ships under the same tag, version comparison shows "no change available" and users stay broken. SHA comparison catches it.

**Wired into:** `/mos:update` Step 1.

**Run manually:**
```bash
node scripts/check-version-and-sha.cjs
```

## Gate 3 -- Stale User-Settings Migration (advisory, not blocking)

**Script:** `scripts/migrate-stale-user-settings.cjs`

**What it does:** scans `~/.claude/settings.json` for version-pinned absolute paths to MindrianOS scripts (a side-effect of the deprecated self-update writing absolute paths into user settings). Removes plugin-owned keys (`statusLine`, `hooks`) so the plugin's own `${CLAUDE_PLUGIN_ROOT}`-based config takes effect. Backs up settings.json before modification.

**Why it matters:** user-level settings override plugin-level settings. Stale absolute paths in user settings render the plugin's own correct config inert. This is what hid Aryeh's statusline after the v1.10.19 install -- his user settings still pointed at `1.10.13/scripts/context-monitor`.

**Wired into:** `/mos:update` Step 6 (post-install).

**Run manually:**
```bash
# Dry run (default)
node scripts/migrate-stale-user-settings.cjs

# Actually edit (creates backup first)
node scripts/migrate-stale-user-settings.cjs --apply
```

## Future Gates (planned)

- **Gate 4 -- Slash command frontmatter compatibility** (when Claude Code adds new required fields)
- **Gate 5 -- Skill SKILL.md frontmatter** (per recent skill-system changes)
- **Gate 6 -- MCP server protocol version** (when MCP SDK bumps major)
- **Gate 7 -- Marketplace manifest invariants** (per CLAUDE.md release-process gates 1-5)

## History

| Date | Version | Trigger | Gate added |
|---|---|---|---|
| 2026-04-26 | v1.10.19 | Aryeh Holtzberg hit hook schema rejection on every Read/Grep/Glob in v1.10.18 | Gate 1 (hook schema) |
| 2026-04-26 | v1.10.19 | Aryeh on v1.10.18 corrupted-but-flagged-latest after first hotfix's in-version tag move | Gate 2 (SHA-aware detection) |
| 2026-04-26 | v1.10.19 | Aryeh's statusline failed to render after install because user settings.json had stale `1.10.13/scripts/context-monitor` from old self-update | Gate 3 (settings migration) |
