---
quick_id: 261020-0ys
status: complete
date: 2026-10-20
code_commit: 2ae4802b3
---

# Quick 261020-0ys: Phase 372 audit fixes - Summary

Three audit findings are fixed in one code commit (2ae4802b3).

## F1 (MEDIUM): corrupt room-map.json now reported

Root cause: readRoomMap returns { ok:false, reason:'no_map' } for a missing file and for a file that fails to read or parse. Leg E skipped on both, so the caller saw omitted: [].

Fix: new export roomMapFileExists(roomDir) in lib/core/room-map.cjs (the readRoomMap contract is unchanged; test 353 still passes). In Leg E, a not-ok read with an existing file adds legE leg_failed, count null, detail RoomMapUnreadable. A missing file stays silent. No new require and no new catch in room-context.cjs; the census stays 10 (R7e). Audit row 9a added to 372-TRYCATCH-AUDIT.md.

Test R3j: a truncated room-map.json gives exactly one legE leg_failed RoomMapUnreadable, other legs and fields unchanged, no secret text and no path in the result. Control in the same leg: a missing file adds no legE entry. R3j and R3k were proven red against the pre-fix room-context.cjs.

## F2 (LOW): description wording

The context_assemble description now says "Every successful result also carries _meta.omitted". Both wire snapshots moved by the same text replace (zod4 also got a refreshed_by suffix). Tests 234, 265, 267 (both) and 270 pass.

## F3 (LOW): error label allow-list

errorClassLabel now accepts only Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError, URIError. Any other name becomes Error. Test R3k: a custom error named LeakyRoomName123 and a TypeError renamed Room141Name both give Error; the 7 allowed names pass unchanged. R7a fixed-detail list gained RoomMapUnreadable.

## Verification (isolated export of HEAD plus changed files, node_modules symlinked to the plugin cache, no install)

- tests/test-372-omitted.cjs: 36 legs passed (was 34).
- tests/run-all-372.sh: PASS=18 FAIL=1; the one red leg is git diff --check (no .git in the export). The same check run in the real repository on the changed files: clean.
- Golden compare: OK. Part 8 invariant test: passed.
- 276: 149 passed, 2 failed (room_list.(default), room_search.(default)), unchanged.
- 267 dual-era PASS=5, 267 zod4 PASS=4, 270 5 passed, 234 212 passed, 265 228 passed.

## Deviations

None of the three fixes needed a design change. One addition: lib/core/room-map.cjs gained the roomMapFileExists export, because adding fs to room-context.cjs would break the R7b require pin.

## Known limit

A room-map.json that parses but has no nodes array still gives no entry (outside the audit finding).
