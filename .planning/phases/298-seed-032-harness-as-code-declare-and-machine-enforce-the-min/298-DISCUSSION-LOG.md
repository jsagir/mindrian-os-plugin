# Phase 298: SEED-032: Harness-as-Code - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-07
**Phase:** 298-SEED-032: Harness-as-Code - Declare and Machine-Enforce the MindrianOS Agent Harness (absorbing 297)
**Mode:** advisor (USER-PROFILE present), calibration `minimal_decisive`, outcome-language framing
**Areas discussed:** basket card contents, promotion review surface, converged-room fixture realism, voice-log visibility

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| What you see when Larry asks to remember | basket fields, pre-check default, post-confirm clause or silence | ✓ |
| How you decide to tighten a rule | promotion review surface | ✓ |
| What a converged room looks like in the fixture | bare scaffold vs seeded room | ✓ |
| Where the voice-style log shows up | file, doctor line, cockpit chip | ✓ |

**User's choice:** all four.

## Todo fold

| Option | Description | Selected |
|--------|-------------|----------|
| Never git stash mid-merge (tooling, 0.2) | locked constraint for every 298 plan | ✓ |
| Mirror gate_render description fix into Theo (0.6) | T-side task; note only | ✓ |
| F7 rescope 212/213 against registerCapability (0.4) | reminder only; weak match | ✓ |
| Ingest skill-description insight into Brain (0.6) | T-side note only; weak match | ✓ |

**User's choice:** fold all four (three recorded as notes, not work).

---

## What you see when Larry asks to remember

| Option | Description | Selected |
|--------|-------------|----------|
| Readable rows, 0.70 pre-check, silent close | claim text as label; kind, section, confidence, source in the description; pre-check already shipped; Larry silent after confirm; the stale Part 8 comment in the raiser corrected | ✓ |
| Handle-only rows, as shipped in 189-02 | candidate ids only; zero code; the basket becomes a rubber stamp | |

**User's choice:** Readable rows, 0.70 pre-check, silent close (the recommended option).
**Notes:** Research source `298-ADVISOR-basket-card.md`.

---

## How you decide to tighten a rule

| Option | Description | Selected |
|--------|-------------|----------|
| Runner report + doctor one-liner, one shared evaluator | `run-harness.cjs --policy <id>` report with MET/NOT MET and the one-line edit; doctor echoes the verdict; both call `evaluatePromotion()`; raw log as fallback | ✓ |
| Raw log file only | open the JSONL and count by hand; the card-fire precedent calls this a multi-hour reconstruction | |

**User's choice:** Runner report + doctor one-liner (the recommended option).
**Notes:** Statusline chip ruled out by the cockpit's own rule (static fields earn no space).

---

## What a converged room looks like in the fixture

| Option | Description | Selected |
|--------|-------------|----------|
| Scaffold-born, text only, no database | 11-section scaffold, STATE.md via compute-state, ~33 text files, no room.db, no .mindrian/; runner never uses the writer opener | ✓ |
| Copy a real seeded room with its database | no 11-section candidate exists; room.db needs a forced add; migrations rewrite the binary; SEED-037 residue and INV-1 noise inherited | |

**User's choice:** Scaffold-born, text only (the recommended option).

---

## Where the voice-style log shows up

| Option | Description | Selected |
|--------|-------------|----------|
| Log file + one never-failing doctor line | JSONL under MINDRIAN_HOME plus a status:'ok' doctor module mirroring card-fire-health-module | ✓ |
| Also a cockpit statusline chip (co-design proposal) | cheap via the orphan voice-mark.json side-channel; barred from 298 by the statusline HARD RULE | |

**User's choice:** Log file + one never-failing doctor line (the recommended option).
**Notes:** The chip is recorded as a co-design proposal in CONTEXT.md's deferred ideas.

---

## Claude's Discretion

Runner internals (spawn model, timeouts, report layout beyond the decided fields, JSONL rotation, `_schema.json` wording, which test file each new test mirrors).

## Deferred Ideas

INV-1 validator defect (a `/gsd-debug` slug); the cockpit voice chip (co-design); SEED-037 4c room healing; Phase 297 roadmap entry to mark absorbed; CHANGELOG em-dash sweep; the slice-3 `doctor.cjs --point <id>` mechanism.
