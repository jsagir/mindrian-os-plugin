---
type: tester-registry
status: canonical
created: 2026-05-02
updated: 2026-05-04
source: ~/MindrianRooms/mindrian/mindrianOS/team-execution/2026-04-27-tester-cohort-justin-aryeh.md
---

# Tester Registry

**Single source of truth.** Every tester-facing release email pulls from this list. Update this file whenever a tester joins, leaves, or changes contact.

## Active testers

| Tester | Folder | Email | Cohort | Onboarding | Brain key | Expiry | Notes |
|--------|--------|-------|--------|------------|-----------|--------|-------|
| Lawrence Aronhime | [lawrence-aronhime/](./lawrence-aronhime/) | aronhime@jhu.edu | Founding | (informal, ongoing) | (Lawrence's own) | n/a | Heavy daily user. First reporter for many bugs (94, 95.1 cohort). |
| Justin Stitzlein | [justin-stitzlein/](./justin-stitzlein/) | justin.stitzlein@colorado.edu | Wave 1 (2026-04-27) | Path A -- full install, Claude Code first | 60-day issued 2026-04-27 | 2026-06-26 | First Wave-1 cohort. |
| Aryeh Holtzberg | [aryeh-holtzberg/](./aryeh-holtzberg/) | aryeholtzberg@gmail.com | Wave 1 (2026-04-27) | Path B -- paste-prompt for existing Claude Code users | 60-day issued 2026-04-27 | 2026-06-26 | First Wave-1 cohort. |
| Adam Peters | [adam-peters/](./adam-peters/) | apeters912@gmail.com | Pre-Wave-1 (founding-adjacent) | (informal, ongoing) | free plan, non-expiring | n/a | "Banana ripener" -- coined the framing. Always on release BCC. v1.12.4 reply (2026-05-03) filed in folder. |
| Shmuel Schuman | [shmuel-schuman/](./shmuel-schuman/) | Shmuelschuman@gmail.com | Wave 2 (2026-05-04) | Welcome email with both Paths A and B + install site link | 60-day issued 2026-05-04 | 2026-07-03 | Welcome draft filed via Gmail MCP (corrected after QP =c8 corruption in first attempt). |
| Gary Laben | [gary-laben/](./gary-laben/) | garyslaben@gmail.com | Wave 2 (2026-05-07) | Welcome email + Windows-specific install reassurance (Claude Code refused install citing third-party plugin warning -- needs explicit "proceed anyway" + project-scoping note) | 60-day reissued 2026-05-09 (old revoked) | 2026-07-08 | Critical tester. Head of advisory board at Hopkins, intro via Lawrence. Hit the Claude Code install-warning friction surface on PowerShell + Claude application. Asked whether MindrianOS runs in every Claude project or only Mindrian-associated ones. |

## Pending invites

(none yet)

## Released / extended

(none yet)

## Protocol

### Test subject criteria (Dror 2.0 -- D-05 per Phase 115)

Per `.planning/phases/115-owned-emotion-dual-path-first-touch/115-CONTEXT.md` D-05 (verbatim from `lib/copy/115-spec-strings.cjs` DROR_TEST_CRITERIA):

> A valid Dror 2.0 test subject is **a founder who is stuck on a decision right now and cannot name it.**

Subjects who do NOT feel the target emotion are invalid test subjects by construction (per the-owned-emotion.md `## Design implications` D-05 quote). When recruiting new testers:

1. Screen for the owned emotion BEFORE issuing a Brain key. The 5-tester Phase 115 validation cohort (Lawrence + Justin + Aryeh + Adam + Shmuel) is the priming reference; future testers are screened against the same vivid-memory probe (per `tests/fixtures/115-validation-email-template.md`).
2. If candidate reports < 4-of-5 vivid-memory criteria from the Phase 115 rubric (`tests/fixtures/115-tester-rubric.md`), defer onboarding until they hit a stuck-decision moment OR redirect them to a different feedback channel (community / public release).
3. Do NOT recruit testers who already have a satisfying existing solution (advisor / co-founder / journal). Per the-owned-emotion.md, those subjects are not in the product's market.

This screen IS Pitfall-1-mitigation at the recruitment layer: bad test subjects produce noisy validation. The Phase 115 owned emotion is the contract for who counts as a tester.

If D-20 rollback fires (validation lands < 4/5; per `tests/manual/115-rollback-procedure.md`), this criteria string updates to the fallback emotion #1 ("a founder with a pile of unstructured insights right now and no shape for them.") -- mutate via `lib/copy/115-spec-strings.cjs` DROR_TEST_CRITERIA value, then re-run this paragraph through the source-of-truth import.

### Adding a tester

1. Add row to **Active testers** with all columns filled, including a `Folder` link
2. Create per-tester folder at `docs/testers/{slug}/` with the four required files (see "Per-tester folder structure" below)
3. Issue Brain API key via `node mcp-server-brain/brain-admin.cjs issue-key <email> --days 60` (or follow current admin protocol)
4. File outbox welcome email at `docs/testers/outbox/YYYY-MM-DD-{slug}-welcome.md` with the active key included (gitignored under `docs/testers/outbox/*-{key,welcome}.md`)
5. Commit only the REGISTRY.md update + the per-tester folder scaffolding -- never commit files containing live keys

### Per-tester folder structure

Every active tester has a folder at `docs/testers/{slug}/` with:

```
{slug}/
├── ROOM.md          # ICM Layer 0 identity (per CLAUDE.md decision 15)
├── PERSONA.md       # who they are, expertise, communication style, what they care about
├── FEEDBACK.md      # running log of every signal they have given
└── replies/         # one file per email reply, named YYYY-MM-DD-{release}-reply.md
```

When a tester replies to a release announcement, file the reply at `{slug}/replies/YYYY-MM-DD-vX.Y.Z-reply.md` and add an entry to their `FEEDBACK.md`.

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
