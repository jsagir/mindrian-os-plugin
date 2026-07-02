---
quick: admin-gate-hardening
slug: 20260702-admin-gate-hardening
date: 2026-07-02
commits: [1c502f1a, 9e41bd73, 98ead343]
---

# Quick: Admin-Gate Hardening Summary

Turned the soft, prose-only `visibility: admin` protection into a HARD,
code-enforced identity gate that blocks a non-admin invocation of `/mos:admin` and
`/mos:dogfood-flush` BEFORE Larry ever sees the command body, while keeping the
prose as defense-in-depth.

## What shipped

| File | Change | Lines |
|------|--------|-------|
| `scripts/check-admin-identity.cjs` | NEW: pure LOCAL deterministic checker | 212 |
| `scripts/admin-command-gate.cjs` | NEW: UserPromptSubmit hard-gate hook | 178 |
| `tests/test-admin-gate-hardening.cjs` | NEW: 5-case proof (15 assertions) | 149 |
| `hooks/hooks.json` | wire gate as FIRST UserPromptSubmit hook (line 343) | +10 |
| `commands/admin.md` | Step 1 prose references the hard gate (kept as defense-in-depth) | +14/-8 |
| `commands/dogfood-flush.md` | new "Admin Identity Check" prose referencing the hard gate | +14 |

## Mechanism chosen: UserPromptSubmit (not PreToolUse:SlashCommand)

When a customer TYPES `/mos:admin`, Claude Code expands the slash command
client-side into the prompt. It does NOT route through the `SlashCommand` tool
(which only fires when Larry programmatically invokes a command). A
`PreToolUse:SlashCommand` matcher would therefore MISS the primary threat: a human
typing the admin command. `UserPromptSubmit` fires on the raw prompt text before
the body is expanded; exit 2 hard-blocks the submission and shows stderr to the
user. Wired at `hooks/hooks.json:343` as the FIRST UserPromptSubmit entry (runs
before intent-classifier and every other UserPromptSubmit hook).

## How the gate stays scoped (never over-reaches)

The admin-command set is derived at run time by scanning `commands/*.md`
FRONTMATTER ONLY (the first `---`...`---` block) for `visibility: admin`.
`commands/help.md` mentions `visibility: admin` in its BODY (it is the command
that hides admin commands) but NOT in its frontmatter, so `/mos:help` is never
gated. An ordinary command can never be blocked by this gate.

## Checker design (extensible, no code change for future admins)

Admin if ANY: `MOS_ADMIN=true`; `$USER`/`$USERNAME` contains `jsagi`/`jonathan`;
`$HOME === /home/jsagi`. PLUS an optional allowlist at
`~/.mindrian/admin-identity.json` (override via `MINDRIAN_ADMIN_IDENTITY_PATH`)
with `usernames` / `homes` / `env_flags`, which EXTENDS (never replaces) the
hardcoded conditions. Falls back to the three hardcoded conditions when absent.
Pure LOCAL, no network, no Brain (Canon Part 8).

## Fail posture

Fail-CLOSED (exit 2) ONLY on a real admin-command + non-admin hit. Fail-OPEN
(exit 0) on any parse/internal error, since the command-body prose remains as the
defense-in-depth backstop. Matches the shipped `write-scope-check.cjs` /
`part8-egress-guard` safety-hook posture.

## Verification

- Test suite: 15/15 assertions pass (`node tests/test-admin-gate-hardening.cjs`).
- Non-admin proof: `env -i USER=randomcustomer HOME=/home/randomcustomer ... node
  scripts/admin-command-gate.cjs <<< '{"prompt":"/mos:admin keys"}'` prints the
  3-line "Command not found: admin" and exits 2.
- Admin proof: same with `HOME=/home/jsagi` exits 0 (no block).
- Allowlist tested: YES (case d + inverse: same identity blocked when config absent).
- Scope containment: `/mos:help`, `/mos:diagnose`, and a mid-sentence mention of
  `/mos:admin` all exit 0 for a non-admin.
- Shape gate: committed (HEAD) `check-shape-declaration.cjs` = OK (128 declared)
  exit 0; my two command files are NOT in any violation set.
- `node -c` clean on all 3 new `.cjs`; hooks.json valid JSON; no em-dashes.

## Deviations / out of scope

`scripts/check-shape-declaration.cjs` appeared modified in the working tree
(mtime 17:02) from a parallel-agent Phase 209-03 (B2) stricter-gate WIP I did NOT
author. Its stricter logic flags 5 UNRELATED command files. Per the SCOPE
BOUNDARY rule I did NOT stage that foreign change and did NOT edit the 5 files.
Details + proof in `deferred-items.md`. ROADMAP.md untouched.

## Self-Check: PASSED
