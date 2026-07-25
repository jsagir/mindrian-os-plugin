---
slug: graph-query-results-unranked
kind: rca
status: fixed
trigger: "graph-query-results-unranked"
issue_id: ""
severity: medium
surfaces: [cli, mcp]
brain_mode: tier-0
canon_parts: [4, 8, 9]
created: 2026-07-23
updated: 2026-07-23
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: PARTIALLY CONFIRMED, PARTIALLY REFUTED after code read. The three tools do NOT share one behavior - they split into all three of the possible cases: graph_query is RANKED-then-capped (the good pattern, hypothesis refuted for it); whitespace_scan is UNRANKED-and-UNCAPPED (raw, but nothing truncated); room_search is UNRANKED-BUT-CAPPED (the "arguably worse" case - a blind 50-result cap applied by filesystem arrival order, zero relevance signal). room_search is the real defect and is graph-independent, so it is live in every room today.
test: static code read of the three implementations behind the tools (no runtime fixture needed - the ordering behavior is legible from the SQL / walk code itself).
expecting: MET - outcome (b), refined: some ranking already exists (graph_query has a full composite score), the gap is narrower than assumed for two tools and sharper than assumed for one (room_search is the textbook capped-but-unranked failure).
next_action: FIX APPLIED for the room_search leg (rank-then-cap, see Resolution). Awaiting review/commit (changes left unstaged per user directive). graph_query stays untouched (not a defect); whitespace_scan stays DEFERRED and cross-linked to graph-derive-silent-clear-dead-api-derivation.md (edge signal must be restored before a ranker there is worth building).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: v1.15.3-beta.45 (in progress)
- Reported by: Larry (session working in dev repo, navigator asked to debug findings from TDS context-rot research cross-referenced against the live debug queue)
- Date first observed: 2026-07-23 (research session, not a live incident report)
- Related debug sessions: `.planning/research/2026-07-23-governed-context-context-rot-tds-research.md` (the research trail that surfaced this - section 3, gap #5), `.planning/debug/graph-derive-silent-clear-dead-api-derivation.md` (related - confirms the graph currently has near-zero semantic edge signal to rank against, which may make this lower priority than it first appears; the two sessions should be read together before deciding fix scope here)

## Problem Statement

Two papers cited in a TDS article on context rot (Shi et al. 2023 "Large Language Models Can Be Easily Distracted by Irrelevant Context"; Mirzadeh et al. 2024 "GSM-Symbolic") show that a same-topic/same-entity distractor measurably degrades model reasoning far more than an off-topic/random one (10.2% vs 33.0% chain-of-thought accuracy in Shi et al.'s setup), and that this is not something self-consistency/majority-vote reliably fixes (caps around 45% recovery). If MindrianOS's graph/search tools return raw hits without deprioritizing exactly this kind of near-duplicate, same-named, same-section noise, every call to graph_query/whitespace_scan/room_search is a potential distractor-injection point into a long-running room session.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: search/graph tools either rank results by relevance signal (edge weight, recency, section match) or explicitly note when returning unranked results so the caller/model can treat them with appropriate skepticism.
actual: unconfirmed - believed unranked based on a read of `mcp__plugin_mos_mindrian-os__graph_query`'s tool description ("Read-only graph neighborhood query... top_k") and `whitespace_scan` ("gap scan... two shipped Phase 109-05 insight primitives"), neither of which documents a relevance-ranking step; not yet verified against implementation.
errors: none (not a crash - a quality/design gap, if confirmed).
reproduction: not yet attempted - first step is reading the implementation, second step (if warranted) is constructing a room fixture with a genuinely relevant match plus a same-named/same-section decoy and checking result ordering.

## Evidence (append-only)

- 2026-07-23: initial hypothesis filed from research cross-reference, not yet backed by a code read in this session.
- 2026-07-23 (code read): **graph_query is RANKED-then-capped (NOT a defect).** MCP tool `lib/mcp/tools/graph.cjs:66-85` (graphQuery) wraps `navigation.getNeighborhood`, which is `lib/core/navigation/neighborhood.cjs:48-77`. The query `NEIGHBORHOOD_SQL` (:14-46) computes a composite relevance `score` per candidate = edge-type weight (CONTRADICTS/INVALIDATES 1.0 ... down to default 0.3) x 0.4 + recency decay over a 90-day window x 0.2 + confidence x 0.2 + same-section-match x 0.2, then `ORDER BY score DESC LIMIT :top_k` (:46). So it ranks by relevance FIRST and caps second (topK default 20). Refutes the "unranked" hypothesis for this tool. Nuance: the same-section term is a POSITIVE +0.2 boost, so a same-section near-duplicate (the exact Shi et al. distractor shape) is elevated, not deprioritized - but that is a defensible relevance signal, not the "raw/unordered" defect claimed.
- 2026-07-23 (code read): **whitespace_scan is UNRANKED and UNCAPPED (raw, but nothing dropped).** MCP tool `lib/mcp/tools/sensors.cjs:225-254` calls `navigation.findOpenQuestions` + `navigation.findUnsupportedClaims`, both in `lib/core/navigation/insights.cjs`. `findOpenQuestions` (:186-199) and `findUnsupportedClaims` (:68-83) are plain `SELECT ... WHERE <type/status> AND NOT EXISTS (<edge>)` with NO `ORDER BY` and NO `LIMIT` - every matching row is returned in SQLite natural (rowid/insertion) order, and the tool hands the whole list back with a `gap_count`. Confirms "unranked," but it is the SAFER unranked variant (nothing is blind-truncated). Caveat: these are binary gap predicates (a claim either has a SUPPORTS edge or it doesn't) - there is no intrinsic relevance gradient to rank, only a secondary recency signal (`created_at`/`last_seen_at`). Natural remedy is `ORDER BY created_at DESC` for stable output, not a relevance re-rank.
- 2026-07-23 (code read): **room_search is UNRANKED-BUT-CAPPED (the "arguably worse" case, and the real defect).** `lib/mcp/tools/room.cjs:85-131` (searchRoom): a plain case-insensitive `String.includes` substring scan over `.md` lines during a recursive `fs.readdirSync` walk. Matches are pushed in filesystem directory-entry order (OS/inode-dependent, not even alphabetized), with hard caps `SEARCH_MAX_RESULTS = 50` (:83) and `SEARCH_MAX_FILES = 500` (:82); the walk `return`s the instant either cap is hit (:92, :100, :123). There is ZERO relevance signal - no scoring, no term frequency, no section weighting, no recency, no dedupe. The 50-cap is applied to whatever the walk reaches FIRST, so a genuinely relevant hit in a late-traversed folder is silently truncated while 50 incidental substring hits from early folders fill the payload. This is the textbook capped-but-unordered failure and the clearest distractor-injection point of the three: an entity-name query returns up to 50 raw same-entity line hits in arbitrary order. Unlike the graph tools, it does NOT depend on graph edge density, so it mis-ranks in EVERY room TODAY.
- 2026-07-23 (FIX APPLIED, room_search leg): rewrote `searchRoom` in `lib/mcp/tools/room.cjs` to RANK-then-CAP. The walk now scans every file up to the unchanged `SEARCH_MAX_FILES = 500` cost bound WITHOUT truncating on arrival order, split into two helpers: `collectMatches` (deterministic name-sorted traversal, per-file match tally + `mtimeMs` recency, verbatim-duplicate-line dedupe, per-file retained-match bound `SEARCH_MAX_MATCHES_PER_FILE = 200`) and `rankMatches` (composite score = log-damped term frequency x 0.7 + normalized recency x 0.3, stable tiebreak on matchCount then path, then fills the `SEARCH_MAX_RESULTS = 50` budget in ranked order with a per-file slice cap `SEARCH_MAX_PER_FILE = 5`). Each result now carries a `match_count` relevance signal. Regression test `tests/test-room-search-rank-before-cap.cjs` builds a fixture with 60 incidental single-hit files in an early-walked `01_intake/` folder (>50, would have blown the old cap alone) plus one genuinely relevant many-hit file in a late-walked `99_synthesis/` folder, and asserts the late relevant match now survives, ranks first, and that no single file monopolizes the payload. Wired into `tests/run-all-198.sh` as a SPEC-2 leg. Full 198 suite green (12/0/0); Part 8 local-only floor + contract-schema + connector-registry `--check` all green; zero em-dashes. graph_query and whitespace_scan untouched this pass.

## Root Cause (diagnose-only, find_root_cause_only)

The single-behavior premise was wrong: the three tools occupy all three of the possible ranking states, so there is no one root cause - there are three distinct verdicts.

1. **graph_query - NOT A DEFECT (ranked-then-capped).** `neighborhood.cjs` NEIGHBORHOOD_SQL scores every candidate on edge-type x recency x confidence x section-match, `ORDER BY score DESC LIMIT top_k`. It already does exactly what the "expected" line asked for. The only residual nuance is that same-section is a positive boost, which mildly elevates same-section near-duplicates - a defensible relevance choice, not a defect.

2. **whitespace_scan - MINOR (unranked but uncapped).** `findOpenQuestions` / `findUnsupportedClaims` return raw, unordered gap rows with no LIMIT. These are binary gap predicates with no intrinsic relevance gradient, so the honest fix is a deterministic `ORDER BY created_at DESC` for stable output, not a relevance ranker. Nothing is silently dropped, so the distractor risk is low.

3. **room_search - THE DEFECT (capped-but-unranked).** A raw substring grep over the filesystem, pushed in arbitrary directory-walk order, hard-truncated at 50 results / 500 files. No relevance signal of any kind. A relevant hit in a late folder is dropped while incidental early-folder hits fill the cap. This is the capped-but-unordered failure the navigator flagged as worse than ranked-but-capped, and it is the genuine same-entity distractor-injection point against the Shi et al. / Mirzadeh context-rot concern. It is graph-independent, so it degrades every room today regardless of edge density.

**Priority recommendation.** Split the session. room_search warrants a NEW small fix now (rank before the 50-cap: at minimum order by match count per file + recency, and dedupe same-file/same-entity hits so one entity name cannot monopolize the payload). graph_query needs nothing. whitespace_scan is a nice-to-have `ORDER BY` and should be DEFERRED and cross-linked to `graph-derive-silent-clear-dead-api-derivation.md`: while the graph carries near-zero semantic edges, `findUnsupportedClaims` / `findOpenQuestions` have almost nothing to classify and getNeighborhood has almost nothing to rank, so investing in graph-side ranking before the edge-signal is restored is premature. Fix edge derivation first; the graph-path ranking concern is legitimately lower priority than the original filing assumed.

## Resolution (room_search leg only)

root_cause: `room_search`/`searchRoom` (`lib/mcp/tools/room.cjs`) applied its 50-result cap in raw filesystem directory-walk order, BEFORE any relevance ordering, so a genuinely relevant match in a late-traversed folder was silently dropped once incidental early-folder hits filled the budget, and one entity-heavy file could monopolize all 50 slots with near-duplicate same-entity lines.

fix: rewrote `searchRoom` to rank-then-cap. `collectMatches` walks every file up to the unchanged `SEARCH_MAX_FILES = 500` cost bound (deterministic name-sorted traversal, no arrival-order truncation), recording per-file match tally + `mtimeMs` recency, deduping verbatim-identical lines, retaining at most `SEARCH_MAX_MATCHES_PER_FILE = 200` lines/file. `rankMatches` scores each file (log-damped term frequency x 0.7 + normalized recency x 0.3, tiebreak matchCount then path) and fills the `SEARCH_MAX_RESULTS = 50` budget in ranked order with a per-file slice cap `SEARCH_MAX_PER_FILE = 5`. Results now expose a `match_count` relevance signal.

files_touched:
- `lib/mcp/tools/room.cjs` (fix + new `collectMatches`/`rankMatches` helpers, exported under `_internal` for testing)
- `tests/test-room-search-rank-before-cap.cjs` (new regression test)
- `tests/run-all-198.sh` (wired the regression as a SPEC-2 leg)

verification: `node tests/test-room-search-rank-before-cap.cjs` PASS (7 checks); full `bash tests/run-all-198.sh` green (12 pass / 0 fail / 0 skip); Part 8 local-only floor, contract-schema, and `node scripts/build-connector-registry.cjs --check` all green; zero em-dashes.

gates_cleared: Canon Part 8 (local filesystem reads only, no Brain egress) - confirmed by the local-only floor; Tri-Polar (change is in the shared `searchRoom` core, identical across CLI/Desktop/Cowork, no surface-specific code); cross-platform (deterministic sort + `path.relative`/`path.join`, no hardcoded separators); reuse-before-build (reused the existing walk + `safeResolveSection` guard, no net-new surface); no em-dashes.

out_of_scope_this_pass: graph_query (verified NOT a defect, untouched); whitespace_scan (DEFERRED, cross-linked to graph-derive-silent-clear-dead-api-derivation.md, untouched).

status_note: fix applied but left unstaged/uncommitted per user directive (review before commit). Not yet moved to `.planning/debug/resolved/` and no knowledge-base.md summary added - that ceremony runs after review/commit.
