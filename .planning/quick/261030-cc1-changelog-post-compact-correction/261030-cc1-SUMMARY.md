---
quick_id: 261030-cc1
status: COMPLETE
date: 2026-10-30
---
# 261030-cc1: correct the post-compact sentence in the changelog

One sentence in CHANGELOG.md [Unreleased] / Changed (bullet of quick 261029-qef) was wrong. The 24 to 39 s for the post-compact hook came from a missing pre-compact state file: the script then runs the whole session-start (PROVEN in scripts/post-compact). The hook path itself took 284, 216 and 209 ms (PROVEN, 3 runs, nice 19, load 1.3, on a copy of the room in scratch with a fresh HOME). The sentence now says so. Approved by jsagi-f2.

STATUS: DONE
CHANGED: CHANGELOG.md (1 sentence)
VERIFIED: diff is 1 line; no em-dash or en-dash added
UNVERIFIED: the real-room cost of the stale-state fallback (that is session-start, Phase 381)
RISKS: NONE
NEXT: none
