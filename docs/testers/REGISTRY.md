---
type: tester-registry
status: canonical
created: 2026-05-02
updated: 2026-05-02
source: ~/MindrianRooms/mindrian/mindrianOS/team-execution/2026-04-27-tester-cohort-justin-aryeh.md
---

# Tester Registry

**Single source of truth.** Every tester-facing release email pulls from this list. Update this file whenever a tester joins, leaves, or changes contact.

## Active testers

| Tester | Email | Cohort | Onboarding | Brain key | Expiry | Notes |
|--------|-------|--------|------------|-----------|--------|-------|
| Lawrence Aronhime | aronhime@jhu.edu | Founding | (informal, ongoing) | (Lawrence's own) | n/a | Heavy daily user. First reporter for many bugs (94, 95.1 cohort). |
| Justin Stitzlein | justin.stitzlein@colorado.edu | Wave 1 (2026-04-27) | Path A — full install, Claude Code first | 60-day issued 2026-04-27 | 2026-06-26 | First Wave-1 cohort. |
| Aryeh Holtzberg | aryeholtzberg@gmail.com | Wave 1 (2026-04-27) | Path B — paste-prompt for existing Claude Code users | 60-day issued 2026-04-27 | 2026-06-26 | First Wave-1 cohort. |

## Pending invites

(none yet)

## Released / extended

(none yet)

## Protocol

### Adding a tester

1. Add row to **Active testers** with all columns filled
2. Issue Brain API key via `node mcp-server-brain/brain-admin.cjs issue-key <email> --days 60` (or follow current admin protocol)
3. File outbox welcome email at `docs/testers/outbox/YYYY-MM-DD-{slug}-welcome.md` with the active key included (gitignored under `docs/testers/outbox/*-{key,welcome}.md`)
4. Commit only this REGISTRY.md update — never commit files containing live keys

### Sending a release update

1. Read this REGISTRY's **Active testers** column for current list
2. Draft via Gmail MCP `create_draft` with TO=jsagir@gmail.com and BCC=all active tester emails
3. File the sent record at `docs/testers/outbox/YYYY-MM-DD-vX.Y.Z-update.md` with the email body (no keys; safe to commit)

### Expiry handling

- 7 days before expiry: send extension reminder
- On expiry: decide extend / promote to `pro` / close out

### Cross-references

- Brain admin: `node mcp-server-brain/brain-admin.cjs usage` (per-tester request counts)
- Cohort discussion thread: `~/MindrianRooms/mindrian/mindrianOS/team-execution/2026-04-27-tester-cohort-justin-aryeh.md`
- Style guide for tester emails: see outbox precedents (mirror what works)
