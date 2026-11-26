---
id: SEED-151
status: planted
planted: 2026-11-25
planted_during: work/400.2-persona-hats-research (plan 18, irreversibility re-score)
trigger_when: before the next live run of scripts/build-command-irreversibility-ledger.cjs, or the next phase that touches /mos:eureka-portfolio, /mos:scientific-roadmap or /mos:session-report
scope: small
---

# SEED-151: irreversibility labels for three commands

The irreversibility ledger builder refused a live re-score on 2026-11-25 before any call (exit 2): "label command set differs from the registry (missing: /mos:eureka-portfolio, /mos:scientific-roadmap, /mos:session-report; extra: none); a new command needs a label before the next rebuild".

## Why it matters

- No re-score of any command can run until the label set matches the registry. Phase 400.2 had to defer the re-score of /mos:persona (deep mode now sends approved web searches), so `STALE /mos:persona` stays as a warning.
- The shipped ledger already carries other warnings (STALE setup, think-hats, whitespace; 3 REMOVED; ANSWER_KEY_DRIFT).

## What it needs

- An irreversibility label for each of the three commands, in the label file the builder reads (find it from loadInputs in scripts/build-command-irreversibility-ledger.cjs).
- Then one owner-approved live re-score (113 calls to the scoring service with the dev-time key), output to a scratch file first, `--check`, then replace the shipped ledger.
