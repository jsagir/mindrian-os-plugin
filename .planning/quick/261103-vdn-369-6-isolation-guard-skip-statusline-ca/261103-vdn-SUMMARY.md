---
quick_id: 261103-vdn
status: complete
date: 2026-11-03
---

# Summary 261103-vdn

ROOT CAUSE: a live statusline rewrites the gitignored `room/.mindrian/statusline-cache.json` every ~7 s while a Claude session is open in this checkout; `filesNewerThan` counted it. PROVEN by two stat readings 7 s apart.

FIX: `filesNewerThan` adds `! -path <root>/room/.mindrian/statusline-cache.json` (glob characters in the root are escaped). Only that exact path is skipped.

PROOF: new `tests/test-3696-isolation-cache-skip.cjs` PASS 9, FAIL 0. Against the old function (HEAD version swapped in, then restored) it fails S1, S5b and S6 (3 legs), so the test bites.

NOT RUN: `tests/test-3696-isolation.cjs` after the fix and the full suite (load1 was 15, gate is below 6). The suite result on 60a126278 stays PASSED=124 FAILED=1 KNOWN=25 until a clean single run is recorded. No push.
