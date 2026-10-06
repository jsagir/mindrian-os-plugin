# Deferred items (369.25)

## From plan 19

- `lib/memory/decision-capture.test.cjs` Test 12 fails (13/14 passed): `archive partition should exist` under `.mindrian/decision-archive/2026-04`. Date-driven archive test; it loads none of the files plan 19 changed. Not investigated further.
- `lib/vault/room-scanner.cjs` KNOWN_SECTIONS lacks funding and strategy (a born room carries both), so `vault-section-minto-generator.cjs --write --section funding` exits 2 and those nests never get a generator-triggered MINTO or BRIEF. Reconcile the list in a later plan or a quick task.
- `scripts/on-stop` recompiles ROOM.md under `timeout 0.4` for 14 sections in parallel; on a fresh room some finish at the next stop. Predates 369.25; ROOM.md is a brief input.
