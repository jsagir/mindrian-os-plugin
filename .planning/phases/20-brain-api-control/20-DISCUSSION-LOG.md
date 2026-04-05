# Phase 20: Brain API Control - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 20-brain-api-control
**Areas discussed:** Key Storage, Admin CLI, Write Protection, Email Notification, Render Wiring
**Mode:** Auto (--auto flag)

---

## Key Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase table + RPC | Primary store with validate_brain_key function | ✓ |
| Env var only | Simple comma-separated keys, no expiry/tracking | |
| SQLite local | Local database file, no cloud dependency | |

**User's choice:** [auto] Supabase table (recommended — auth.cjs already references it)
**Notes:** Table already designed in auth.cjs assumptions. Lawrence gets permanent key.

---

## Admin CLI Tool

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone CJS script | brain-admin.cjs in mcp-server-brain/ | ✓ |
| Plugin command | /mos:admin in commands/ | |
| Web admin panel | Browser-based dashboard | |

**User's choice:** [auto] Standalone CJS (recommended — faster, terminal-native)
**Notes:** /mos:admin command comes in Phase 22 as the self-teaching wrapper.

---

## Write Protection

| Option | Description | Selected |
|--------|-------------|----------|
| Plan-based in tool handler | Check req.brainPlan in brain_write | ✓ |
| Separate middleware | New middleware layer before tools | |
| Remove brain_write entirely | No external write access | |

**User's choice:** [auto] Plan-based gating (recommended — minimal code change, uses existing plan field)

---

## Email Notification

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase webhook + email service | DB trigger sends email on new request | ✓ |
| Manual check via CLI | Admin runs list-requests command | |
| Slack/Telegram bot | Instant notification to messaging | |

**User's choice:** [auto] Supabase webhook (recommended — no polling needed)

---

## Render Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Render MCP tool | Programmatic env var update | ✓ |
| Manual dashboard | Set in Render web UI | |

**User's choice:** [auto] Render MCP tool (recommended — already available)

---

## Claude's Discretion

- Exact Supabase table column constraints (NOT NULL, defaults)
- RPC function implementation details
- brain-admin.cjs internal architecture
- Error message exact wording (beyond D-08)

## Deferred Ideas

- Web admin dashboard → Phase 22
- Stripe billing integration → out of scope
- Rate limiting → future
- Key rotation → future
