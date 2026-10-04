---
id: SEED-119
title: "The Brain and Theo are still two things in the product: a decommissioned Brain is still configured, still asked for a key, still named in errors; finish the cutover on every user-facing surface"
status: seeded
priority: critical
filed: 2026-10-04
source: navigator 2026-10-04, verbatim: "the brain and theo are stil seprates. mindrian wants a brain key where it was decomissioned and repaced by theo a while back"
depends_on: Phase 339 (Theo cutover, 2026-09-03), decision 1 and 5 in .claude/includes/decisions.md (the entitlement check lives at install and update time, never per query)
---

# SEED-119: one teaching graph, one name, no ghost key

## What a user sees today (measured on the navigator's machine and in two session transcripts, 2026-10-04)

- Every Claude Code session on this machine starts with a failed connector: `pws-brain-mcp`
  (`https://pws-brain-mcp.onrender.com/mcp`, a user-level entry in `~/.claude.json` under
  `/home/jsagi`) answers 403 "Trial expired. Upgrade at mindrian-os.com/brain-access". That is the
  decommissioned Brain, replaced by Theo at the Phase 339 cutover, still configured and still
  selling an upgrade. The auto-migrate that was meant to retire it (Brain MCP three tracks, v1.13.1)
  did not retire this entry, and `doctor --fix` does not remove it.
- The plugin still carries a full code path for it: `scripts/part8-egress-guard-hook.cjs` lines
  ~32-79 and ~227 reason about `mcp__pws-brain-mcp__*` as a live connector beside `mcp__theo__*`.
- Dev and census scripts still say "Brain key unavailable" (`scripts/build-brain-census.cjs:1142`,
  `scripts/check-flagship-floor.cjs:318`, `scripts/probe-brain-contract.cjs:260`) and
  `scripts/first-install-router.cjs:71` still speaks of a Brain key env var.
- The shim that actually serves Theo is still named `mindrian-brain` (server) and its verbs
  `brain_ask` / `brain_query` / `brain_search`; the refusal reads `BRAIN_EGRESS_BLOCKED`,
  class `freeform_unproven`, and the three verbs disagree on the same input (SEED-118 defect 11).
  Larry then tells the user "Theo refused". Two names for one thing in one sentence.
- Decisions 1 and 5 still describe "the Brain" as what installs and what the key gates. The
  navigator's reading: the product asks for a Brain key for a service that no longer exists.

## What the phase decides

1. One name on every user-facing surface. The navigator rules which: Theo (the backend's own name,
   already honest in `agents/larry.md`) or "the methodology graph". Tool verbs may keep `brain_*`
   for compatibility, but no error, prompt, doctor line or install step says "Brain key" or links
   to `brain-access` unless that page is the live entitlement page for Theo access.
2. The entitlement key (decisions 1 and 5) is named for what it is: the MindrianOS install and
   update entitlement. If it is the same key that unlocks Theo, say so once; if there is no key at
   all today for Theo, remove every prompt that asks for one.
3. `doctor --fix` retires the legacy entry: a user-level or project-level `pws-brain-mcp` server
   is removed (or disabled with a one-line notice) and the failed-connector banner stops appearing
   at session start. `mindrian-brain` shadowing (the HARD RULE in memory) folds into the same fix.
4. The guard hook drops the `mcp__pws-brain-mcp__*` branch once the entry is gone, and the refusal
   vocabulary becomes one word for one thing (ties to SEED-115's content-not-shape classifier and
   SEED-118 defect 11).
5. A test: a fresh install on a machine that carries the legacy entry ends with no failed
   connector, no Brain-key prompt, and one Theo health line.

## Why critical

A tester's first screen is a failed connector selling an upgrade to a decommissioned service. It
is the first thing they read, before Larry says a word.
