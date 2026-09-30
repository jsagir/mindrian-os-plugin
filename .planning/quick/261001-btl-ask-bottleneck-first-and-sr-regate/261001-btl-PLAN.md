---
type: quick
id: 261001-btl
slug: ask-bottleneck-first-and-sr-regate
date: 2026-10-01
source: navigator rulings 2026-10-01 on the flags of quick 261001-wgd
requirement: DRP363-19
---

# Quick: ask for the bottleneck first, and re-gate scientific-roadmapping on revise

## Goal

1. Whitespace, "Ask for the bottleneck first". Before the whitespace flow offers a deep run, Larry asks the
   navigator to name what blocks the gap, in their own words. A named limiter becomes a limiter in the question
   set. No answer means the offer reads "name what blocks this and I'll plan a deep run", never a dead end. The
   text is the navigator's own words (Canon Part 8, D-10).
2. Scientific roadmapping, "Close it, every deep plan". A scientific-roadmapping deep plan that loses its last
   limiter through revise (drop_path) becomes a wish. The byte-identical guarantee is lifted for this case only.

## Tasks

1. RED: C16 (SR drop_path to zero limiters is a wish), C17 (escalate from a limiterless quick run answers
   `needs_limiter`; `add_limiter` takes the navigator's words), Q3 and Q3b (the quick offer text). Commit
   `test(quick-bottleneck): ...`.
2. GREEN: `add_limiter` edit op in plan.cjs; `needs_limiter` next-move in `cardFor`; the quick offer text; the
   `assess` gate extended to SR and its sticky wish made conditional on the plan still having no limiter; MCP
   `deep_plan` next_step; `commands/whitespace.md` and `commands/research.md` ask the question; skill mirrors
   regenerated and `--check`ed; born-wired checks run.
3. Regression: every tests/test-363-*.cjs except live-smoke, then `bash tests/run-all-363.sh`.
4. Docs: 363-FOLLOW-ONS.md replaces the whitespace dead end with the resolution, as a separate commit.

## Constraints

`git commit --only -- <paths>`, `git add -f` for .planning paths, no gsd-tools state writers, no network in tests,
no em-dashes or en-dashes.
