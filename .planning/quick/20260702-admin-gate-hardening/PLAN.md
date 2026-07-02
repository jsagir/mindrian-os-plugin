---
quick: admin-gate-hardening
date: 2026-07-02
slug: 20260702-admin-gate-hardening
type: quick
autonomous: true
---

# Quick: Admin-Gate Hardening (code-enforced admin identity gate)

## Problem

Two commands carry `visibility: admin` in frontmatter (`commands/admin.md` = Brain
API key management, `commands/dogfood-flush.md`). Their ONLY protection today is
PROSE inside the command body telling Larry (the LLM) to re-derive identity every
manual invocation. That is soft enforcement: it depends on the model faithfully
re-running the check, with zero code-level backstop. Claude Code's native `/`
autocomplete does not understand `visibility: admin` (a MindrianOS convention, not
a platform concept), so both commands appear as ordinary selectable commands to
EVERY user. A random customer who types `/mos:admin` has "hope Larry remembers to
check" as their only barrier to the Brain key panel.

## Goal

Turn the soft prose gate into a HARD, code-enforced gate that blocks a
non-admin invocation BEFORE Larry ever sees the command body, while keeping the
prose as defense-in-depth (never weaken or remove it).

## Mechanism decision (documented)

Hook = `UserPromptSubmit`, NOT `PreToolUse:SlashCommand`.

Rationale: when a customer TYPES `/mos:admin`, Claude Code expands the slash
command client-side into the prompt. It does NOT route through the `SlashCommand`
tool (which only fires when Larry programmatically invokes a command via the
tool). So a `PreToolUse:SlashCommand` matcher would MISS the primary threat -- a
human typing the admin command directly. `UserPromptSubmit` fires on the raw
prompt text before the command body is expanded and handed to Larry; exit 2
hard-blocks the submission and shows stderr to the user. This is precisely the
"detect an admin-gated command name in the user's raw input and hard-block before
Larry ever sees the full command body" path the brief names as the robust option.

## Tasks

1. `scripts/check-admin-identity.cjs` -- pure-node deterministic checker.
   Admin if ANY: `MOS_ADMIN=true`; `$USER`/`$USERNAME` contains `jsagi`/`jonathan`;
   `$HOME === /home/jsagi`. PLUS an optional, extensible allowlist read from
   `~/.mindrian/admin-identity.json` (override path via
   `MINDRIAN_ADMIN_IDENTITY_PATH`) that EXTENDS (never replaces) the hardcoded
   conditions, so future admins/deployments need no code change. Falls back to the
   three hardcoded conditions when the file is absent. Exit 0 = admin, exit 1 = not;
   `--json` prints a machine-readable verdict. Pure LOCAL, no network, no Brain
   (Canon Part 8). Exports `checkAdminIdentity()` for in-process reuse.

2. `scripts/admin-command-gate.cjs` -- the `UserPromptSubmit` hard gate. Reads the
   prompt from the hook payload on stdin, dynamically builds the admin-command set
   by scanning `commands/*.md` FRONTMATTER (only the first `---`...`---` block) for
   `visibility: admin` (so it can NEVER over-reach to ordinary commands), detects a
   leading `/mos:<name>` (or `/<name>`) invocation of an admin command, and if the
   identity check fails, exits 2 with the 3-line "Command not found" stderr, hard-
   blocking the prompt. Fail-OPEN (exit 0) on any parse/internal error (defense-in-
   depth prose remains); fail-CLOSED (exit 2) ONLY on a real admin-command +
   non-admin hit. Matches the shipped `write-scope-check.cjs` / `part8-egress-guard`
   safety-hook posture.

3. Wire task 2 into `hooks/hooks.json` `UserPromptSubmit` (FIRST entry, so it runs
   before intent-classifier and the other UserPromptSubmit hooks).

4. Update `commands/admin.md` + `commands/dogfood-flush.md` identity-check prose to
   REFERENCE the hard gate (the code check already ran and passed by the time Larry
   executes the body) and remain as a defense-in-depth restatement -- do NOT remove
   the prose. Body-only edits; frontmatter (incl. hitl_shape) byte-preserved.

5. `tests/test-admin-gate-hardening.cjs` -- five cases:
   (a) non-admin identity -> hard block (exit 2), command never runs;
   (b) admin via `MOS_ADMIN=true` -> passes;
   (c) admin via hardcoded username/home -> passes;
   (d) allowlist config present grants a listed identity even without matching the
       hardcoded conditions;
   (e) an ordinary (non-admin-gated) command is NEVER blocked by this gate.

## Verification

- End-to-end: simulate a non-admin env (unset `MOS_ADMIN`, fake `$USER`/`$HOME`)
  and confirm the gate fires (exit 2); simulate the real admin env and confirm it
  passes (exit 0).
- `node scripts/check-shape-declaration.cjs --check` exit 0 before committing the
  two command files.
- `node -c` every touched `.cjs`. No em-dashes. No `--no-verify`.

## Out of scope

- The gate-native-fire work, Phase 209, and hitl_shape declarations on any command
  other than the reference-to-hard-gate prose. ROADMAP.md is NOT touched.
