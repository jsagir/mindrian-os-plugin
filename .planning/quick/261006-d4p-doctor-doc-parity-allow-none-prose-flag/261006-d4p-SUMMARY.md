---
phase: quick
plan: 261006-d4p
subsystem: tests
tags: [doctor, doc-parity, allowlist]
key-files:
  modified: [tests/test-doctor-doc-parity.cjs]
decisions:
  - "Allowlist --none in DOC_PROSE_ALLOWLIST (same mechanism as --recursive) instead of rewording commands/doctor.md, so no generated mirror or registry changes"
metrics:
  tasks: 1
  commits: 1
completed: 2026-10-06
---

# Quick 261006-d4p: doctor doc-parity --none Summary

`--none` in the `interactive_first_reward` front matter line of `commands/doctor.md` is prose, not a flag. `DOC_PROSE_ALLOWLIST` in `tests/test-doctor-doc-parity.cjs` now lists it with a reason, beside `--recursive`.

## Verification

- `node tests/test-doctor-doc-parity.cjs`: ALL PASS (3 assertions) (PROVEN).
- `commands/doctor.md` is unchanged, so the mirror, registry and projection checks were not run (not needed). `git diff --stat` for `commands/doctor.md` and `data/command-registry.json` is empty.
