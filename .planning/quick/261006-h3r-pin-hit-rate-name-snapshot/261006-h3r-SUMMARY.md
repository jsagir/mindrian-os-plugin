---
phase: quick
plan: 261006-h3r
subsystem: hit-rate-measurement
tags: [355, d-51, hit-rate-record, snapshot-pin]
key-files:
  created: [tests/fixtures/355-rooms/name-snapshot-pin.json]
  modified: [scripts/measure-355-hit-rate.cjs, tests/fixtures/355-rooms/README.md]
decisions:
  - "The hit-rate record reads a frozen pin of snapshot_date and source_sha256, not the live data/framework-names.json (D-51: the record is a historical fact)"
metrics:
  tasks: 1
  commits: 1
completed: 2026-10-06
---

# Quick 261006-h3r: pin the hit-rate name snapshot Summary

The measurement script now reads `tests/fixtures/355-rooms/name-snapshot-pin.json` for the name snapshot. The pin holds `snapshot_date` 2026-10-02 and the unchanged `source_sha256`. A release refresh of `data/framework-names.json` no longer changes the record inputs.

## Code reading

- The only reader of `NAME_SNAPSHOT_PATH` is `loadInputs`. It needs `snapshot_date` and `source_sha256` only (via `buildRecord`, lines for `name_snapshot_date` and `name_snapshot_source_sha256`).
- The raw file hash (`sha.name_snapshot`) is computed but no record field uses it (PROVEN by grep).
- The VERIFICATION prose still names `data/framework-names.json` as text. It is unchanged, so 355-VERIFICATION.md is unchanged.

## Verification

- `node tests/test-355-hit-rate-record.cjs`: PASS 93 FAIL 0.
- `node scripts/measure-355-hit-rate.cjs --check`: exit 0.
- `node tests/test-355-fixture-rooms.cjs`: PASS 34 FAIL 0.
- `node tests/test-355-part8-egress.cjs`: PASS 34 FAIL 0.
- `git diff --stat` on `hit-rate-record.json`: empty (unchanged).

## Deviations

None.
