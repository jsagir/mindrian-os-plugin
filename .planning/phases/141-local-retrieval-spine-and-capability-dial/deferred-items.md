# Phase 141 Deferred Items

## DI-141-04-01 (out of scope for Plan 141-04 / FILEVAL-02)

- **Discovered during:** Plan 141-04 execution (running `bash tests/run-all-141.sh`)
- **Item:** `tests/test-retrieval-seed.cjs` (RETR-02) is RED. It asserts `scripts/intent-classifier.cjs` no longer hard-codes `userText: null` in the per-turn hot-path turn object (D-03 seam).
- **Why deferred:** RETR-02 is owned by a different plan. Plan 141-04's execution contract explicitly forbids touching `scripts/intent-classifier.cjs`. The failing test references none of Plan 141-04's surfaces (no `fileEvidenceWithReadback`, no `file-evidence-readback.cjs`, no `evidence-claim`, no `artifact_path`). It was already RED at HEAD before this plan's changes.
- **Action:** Not fixed here. Belongs to the RETR-02 D-03 plan that un-nulls the seam in `scripts/intent-classifier.cjs`.
