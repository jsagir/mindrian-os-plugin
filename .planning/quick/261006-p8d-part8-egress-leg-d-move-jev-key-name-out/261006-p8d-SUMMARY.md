---
phase: quick
plan: 261006-p8d
subsystem: doctor
tags: [egress, part8, leg-d, research-providers]
key-files:
  modified: [lib/core/doctor/research-providers-module.cjs]
decisions:
  - "The Jev key variable name is read from data/eureka-judge-lines.json (key_env), the same file plan 369.2-27 created; no new data file"
metrics:
  tasks: 1
  commits: 1
completed: 2026-10-06
---

# Quick 261006-p8d: Part 8 egress leg D Summary

The doctor module `research-providers-module.cjs` no longer names the Jev key variable. It reads the name from `data/eureka-judge-lines.json` through a small `judgeKeyEnv()` function.

## Behavior

- The judge row is unchanged: `ready` when the line is on and the key is set, `no key` with `needs: env:<name>` when the key is not set, `line off` when the line is off.
- If the data file cannot be read, the row reports `no key` (fail closed). The key value is never read into a row.

## Verification

- `node tests/test-355-part8-egress.cjs`: PASS 34 FAIL 0 (PROVEN).
- `node tests/test-3692-providers.cjs`: PASS 46 FAIL 0 (PROVEN).
- `node tests/test-353-doctor-section-ruling.cjs`: PASS 24 FAIL 0 (PROVEN).
