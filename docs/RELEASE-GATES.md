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

## Future Gates (planned)

- **Gate 2 -- Slash command frontmatter compatibility** (when Claude Code adds new required fields)
- **Gate 3 -- Skill SKILL.md frontmatter** (per recent skill-system changes)
- **Gate 4 -- MCP server protocol version** (when MCP SDK bumps major)
- **Gate 5 -- Marketplace manifest** (per CLAUDE.md release-process invariants 1-5)

## History

| Date | Version | Trigger | Gate added |
|---|---|---|---|
| 2026-04-26 | v1.10.18 hotfix | Aryeh Holtzberg hit hook schema rejection on every Read/Grep/Glob in v1.10.18; in-version patch (no version bump) | Gate 1 (this gate) |
