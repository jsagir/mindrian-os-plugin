# Phase 22: Admin Panel - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `/mos:admin` — a hidden, self-teaching admin command that wraps the Brain API key management (from Phase 20's brain-admin.cjs) in a MindrianOS-native experience. The command is invisible to non-admin users, re-explains itself on every invocation, and follows the UI ruling system (Phase 21).

</domain>

<decisions>
## Implementation Decisions

### Visibility
- **D-01:** `/mos:admin` does not appear in `/mos:help` for non-admin users. Not locked, not greyed out — it doesn't exist. The command file exists in `commands/` but the help command's rendering logic skips it.
- **D-02:** Admin identity is checked by environment — `MOS_ADMIN=true` in the user's `.env` or a hardcoded check against Jonathan's identity markers (username, email). No password, no login screen.
- [auto] Selected recommended: environment-based identity, not password.

### Self-Teaching UX
- **D-03:** Every invocation starts with a context panel explaining what the admin panel does and current state (active keys, pending requests, expired keys, total requests this month).
- **D-04:** Every action (approve, revoke, extend) shows a pre-action explanation: what this does, what the consequences are, and asks for confirmation before executing.
- **D-05:** The self-teaching text is NOT a separate help system — it's integrated into the flow. You read, you act, you see results. No separate "help" mode.
- [auto] Selected recommended: integrated self-teaching, not separate help.

### Command Structure
- **D-06:** `/mos:admin` with no subcommand shows the full self-teaching overview with numbered actions.
- **D-07:** Subcommands: `keys` (list), `approve <email>` (create with guided walkthrough), `revoke <email>`, `extend <email> <days>`, `usage`, `requests` (pending access requests).
- **D-08:** All subcommands call `brain-admin.cjs` under the hood — the admin command is a UX wrapper, not a reimplementation.
- [auto] Selected recommended: wrapper over brain-admin.cjs, not duplicate logic.

### UI Ruling System Compliance
- **D-09:** Admin panel output follows the 4-zone anatomy from Phase 21's ui-system SKILL.md. Uses Status Card (Zone 1 context), Body Shape E variant (Zone 2 action report), and Action Footer (Zone 4).
- **D-10:** Admin-specific formatting: use the standard `╭─ ADMIN PANEL ─╮` card style. No special admin colors — uses the standard 5-color contract.
- [auto] Selected recommended: standard UI system, no admin-specific styling.

### Destructive Action Protection
- **D-11:** Revoke shows: "This will immediately block [email] from accessing Brain. They will get a 401 error on next request. This cannot be undone without creating a new key."
- **D-12:** Confirmation uses inline yes/no, not AskUserQuestion — admin should be fast for the person who uses it.
- [auto] Selected recommended: inline confirmation for speed.

### Claude Thinks Alignment
- **D-13:** Per Research 07 Finding 5, the admin panel provides verified context (current key count, pending requests) BEFORE asking Claude to render, reducing hallucination risk. The brain-admin.cjs CLI provides the real data; the command renders it.
- **D-14:** Per Research 07 Finding 3, the admin panel SHOWS data structurally (tables, cards) rather than asking Claude to narrate what's happening.
- [auto] Selected recommended: structure over narration.

### Claude's Discretion
- Exact wording of self-teaching explanations
- Card layout details within the UI system constraints
- How to detect admin identity (specific env var name, file check, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Dependencies
- `mcp-server-brain/brain-admin.cjs` — The CLI tool this command wraps. Read to understand available operations.
- `skills/ui-system/SKILL.md` — UI ruling system. All admin output must comply.
- `.planning/phases/20-brain-api-control/20-CONTEXT.md` — Brain API decisions (key schema, plan tiers, Lawrence's permanent key)

### Design Specs
- `~/.claude/projects/-home-jsagi/memory/feedback_terminal_ux_patterns.md` — Terminal UX patterns including admin panel rule (#13)
- `docs/research/RESEARCH_07_HOW_CLAUDE_THINKS.md` — Claude internals research, principles 1-2 apply to admin UX

### Existing Commands (pattern to follow)
- `commands/help.md` — Shows how commands are structured + hidden from help listing
- `commands/status.md` — Shows Body Shape A pattern (recently retrofitted)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mcp-server-brain/brain-admin.cjs` — Full CLI with create/revoke/extend/list/usage/requests. Admin command wraps this via Bash tool calls.
- `skills/ui-system/SKILL.md` — Rendering rules already defined. Admin command follows them.
- `commands/help.md` — Already has command listing logic that can be extended with admin visibility filtering.

### Established Patterns
- Commands are markdown files in `commands/` with YAML frontmatter (name, description, allowed-tools).
- Commands call scripts via Bash tool for data operations.
- UI rendering is prompt-driven via SKILL.md rules.

### Integration Points
- `commands/help.md` — Needs modification to filter out admin commands for non-admin users.
- `commands/admin.md` — New file, wraps brain-admin.cjs.
- Environment detection — check for admin identity marker.

</code_context>

<specifics>
## Specific Ideas

- The overview panel on entry should feel like a cockpit: "3 active keys, 1 pending request, 847 requests this month." Immediate orientation.
- When approving, show the person's name and reason for requesting (from brain_access_requests table).
- After every action, show the updated state so the admin sees the effect immediately.

</specifics>

<deferred>
## Deferred Ideas

- Web-based admin dashboard — CLI-first, web later
- Batch operations (approve/revoke multiple at once) — single operations first
- Admin audit log — future enhancement
- Delegated admin (multiple admins) — Jonathan-only for now

</deferred>

---

*Phase: 22-admin-panel*
*Context gathered: 2026-03-26*
