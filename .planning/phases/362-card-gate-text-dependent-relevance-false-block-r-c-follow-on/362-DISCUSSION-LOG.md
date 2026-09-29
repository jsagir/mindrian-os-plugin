# Phase 362: Card gate text-dependent relevance false block - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-09-29
**Areas discussed:** Order vs Phase 359, Allowed fix method

## Order vs Phase 359

| Option | Description | Selected |
|--------|-------------|----------|
| 362 waits for 359 | Plan now, execute after 359 plans 07-10; first replay 0f86dd63 on post-359 code | ✓ |
| 362 now, coordinate files | Execute now, coordinate with the 359 owner on the same files | |

## Allowed fix method

| Option | Description | Selected |
|--------|-------------|----------|
| Structured signals only | Turn metadata, token provenance, 359 declared options; residue stays known_false_block | ✓ |
| Allow a local text check | Deterministic local text check in the hook, relaxing 359's no-guessing ruling | |
