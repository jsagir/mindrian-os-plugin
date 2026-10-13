---
status: resolved
kind: qa-sweep
trigger: "search-surface-qa-sweep-20261012"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [7, 8]
created: 2026-10-12T12:00:00Z
updated: 2026-10-13T00:40:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 63b25583d (local dev workspace /home/jsagi/dev/MindrianOS-Plugin, 12 commits ahead of origin/main; the room_search word tier landed in 32fcb604b on this branch and is NOT on origin yet)
- **WIRE claims probe against:** none. Every item is local-only (room files, tests, git history). No Brain call, no network.
- **Date of audit:** 2026-10-12
- **Re-verification rule:** a source claim below is re-verified against `main` @ 63b25583d or later before it lands as a finding; otherwise it is tagged `needs-source-reverify`.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: The seven search-surface findings from spike 010 and quick 261012-kfn split into two real defects (the 500-file walk cap drops files silently; the SPEC-5 adapter-budget test fails for a cause nobody has named), two measured costs (the double walk; the one-room floor), two design questions (the one-level wiki scan; three search doors) and one description drift. Item 8 (Desktop marketplace add) is blocked on host evidence only the navigator can supply.
test: Four parallel read-only investigators, one per cluster, each writing evidence under .planning/debug/search-surface-qa-sweep-20261012/<cluster>/ and returning a classification per item.
expecting: Every item classified WORKING / known tracked bug / ENV GAP / NEW FAILURE / DESIGN DECISION, with measured numbers, before any fix is opened.
next_action: RESOLVED 2026-10-13. Items 1, 2 (with 3), 5, 6, 7a, 7b fixed and verified; item 4 recorded as a measured limit (do not move 0.55 without a third room); item 8 stays open in desktop-marketplace-add-fails-20261011 (blocked on a Desktop Code-tab reproduction). The egress blocker found mid-sweep is resolved in its own session. Follow-ups are listed under Non-Code Follow-ups. Push and the beta.66 cut are the navigator's.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (the only dev workspace)
- Plugin version: 2.0.0-beta.66 (package.json on main; last cut beta.65)
- Reported by: navigator (Jonathan Sagir), from spike 010 and quick 261012-kfn, 2026-10-12
- Date first observed: 2026-10-12
- Related debug sessions: graph-query-results-unranked (the room_search rank-then-cap fix), html-artifacts-invisible-to-graph-derivation (the .html allowlist), desktop-marketplace-add-fails-20261011 (item 8, carried not re-opened)
- Related spike and quick: .planning/spikes/010-leviathan-search-vs-room-search/, .planning/quick/261012-kfn-natural-language-room-search-word-split-/

## Problem Statement

Spike 010 and quick 261012-kfn exposed that the room search surface has an untested file cap, an unmeasured cost on large rooms, a one-room-fitted relevance floor, a stale tool description, a wiki index that sees a fraction of a room, a failing test leg nobody owns, and three overlapping search doors. None of them has been classified.

## Items

| # | Item | Cluster | Classification | Status |
|---|------|---------|----------------|--------|
| 1 | room_search description says "substring"; the word tier is invisible to Larry | D | NEW FAILURE (low; wire-contract drift, code correct): the tools/list description is the only guidance a host model gets, and its clause "for a conceptual question reach for room_graph instead of guessing at keywords" now points away from the working sentence path; fix touches 4 files, no regeneration | FIXED e54d85ec2 (quick 261012-rew): description 801 bytes and query describe 128 bytes rewritten, both 267 pins updated, test-234 204/204, run-all-267 33/33 |
| 2 | SEARCH_MAX_FILES=500 walk cap vs rooms of 1,121 and 833 walkable files; silent drop? truncation signal? | A | NEW FAILURE (high): the cap hides 621 of 1,121 mindrianOS files (55.4 percent) and 333 of 833 motj-ecosystem files (40.0 percent); whole late-sorting directories vanish (mindrianOS sub-rooms 543 of 543, team 8 of 8, team-execution 20 of 20, solution-design 50 of 58; motj sub-rooms 311 of 736); 10 of 10 probes for a term that exists in exactly one hidden file return a false reason "No file contains this exact text or any of its search words"; the envelope has no scanned count, no truncated flag; a section scope is capped at 500 too, so 43 and 236 files are unreachable by any query; no debug session tracks it (graph-query-results-unranked called the cap an "unchanged cost bound") | FIXED ca9b5722d + 287c76a76 (quick 261012-rxc, shape a): bound 500 -> 5,000 with scanned/walkable/truncated and honest reasons; mindrianOS 1,121 of 1,121 and motj 833 of 833 walked; 10 of 10 hidden-file probes found; one read per file; mindrianOS sentence median 251.9 ms; run-all-198 18/0 |
| 3 | sentence query walks the room twice; 56 ms -> 170 ms at 424 files; growth on big rooms | A | WORKING (measured cost): every walked file is read twice on a phrase miss (1,000 reads for 500 files); medians phrase-hit / word tier / below floor: mindrianOS 54.5 / 197.7 / 197.0 ms, motj 51.3 / 167.6 / 159.0, rethinking 30.8 / 126.0 / 115.5; worst call 209.9 ms against the 2,000 ms hook line; room_search is in no hook; growth 0.45 ms + 0.312 ms per file (R2 0.908); lifting the cap extrapolates to about 350 ms on mindrianOS | CLOSED with item 2: the single-walk refactor landed in 287c76a76 (reads per file 2 -> 1); keyword median on mindrianOS 54.5 -> 98.9 ms because 1,121 files are read instead of 500, far under the 2,000 ms line |
| 4 | word-tier floor (min(2, words) distinct words, idf_share >= 0.55) fitted on 1 room, 13 queries | A | WORKING (measured limit): on motj-ecosystem, 16 new NL questions + 16 keyword + 3 negatives: NL top-5 13 of 16, keyword 15 of 16, 3 of 3 negatives rejected; negatives idf_share max 0.360, positives min 0.399 (no overlap, gap 0.039); but 3 of 16 positive targets sit below the 0.55 floor (0.399, 0.473, 0.480) and one correct rank-1 target (B7) was rejected by the floor; the distinct-words test does not separate (best negative 4 words, weakest positive 4); repeat run 0 of 35 differ | no action now; do not move 0.55 without a third room |
| 5 | lib/wiki/page-renderer.cjs scanRoom is one level deep; flexsearch indexed 61 of 424 files | C | known tracked bug, owner orphaned: SEED-006 pack finding F3 (room research/2026-07-07-fable-max-pack/seed-visible-room-wiki, section 3.2) and the deferral in quick 260923-lu5 PLAN line 176 ("the recursive walker is Wave 1"); Wave 1 has no phase, plan or test; no record ever chose the shallow scan; the wiki shows and searches 61 of 424 files (14.4 percent); all 90 decision-16 nested artifacts have no page | FIXED 97285972f + cb1c5bf47 (quick 261012-ri7): scanRoom walks nested folders through discoverSections (no second walker; test-270 unchanged), pages 61 -> 418 on rethinking-mindrianos, all 61 flat ids preserved, nested ids are room-relative paths, 3 bad-frontmatter files keep their body with a warning; test-232 5/5, visible-room 2/2, new test 14/14 |
| 6 | tests/run-all-198.sh SPEC-5 adapter-budget leg fails; treated as pre-existing | B | NEW FAILURE (unowned 76 days): scripts/on-stop is 658 lines (test count; 657 by wc -l) against LINE_BUDGETS 570 in lib/mcp/hook-adapter-audit.cjs:62; first breached by 8462f41ad (phase 241-01, 2026-07-28), grew to 658 in 26629ecff (369.25-19, 2026-10-06); named in quick 260911-juq deferred-items but never opened; invisible to doctor and the release gate | FIXED 2c0eae9f5 + 3aead34aa + 8a73d929c (quick 261012-rey, option b1): budget 570 -> 680 (measured 658, rule smallest multiple of 10 at least M+20), hard leg in tests/run-all-366.sh (2c) so the release suite runs it, test prints its verdict from the exit code, SEED-125 holds the thin-hook refactor; run-all-198 17/0, run-all-366 71/0, doctor --acceptance 24/24 before and after |
| 7 | three search doors (room_search, wiki flexsearch, room_graph graph-query); Canon Part 7 overlap | C | DESIGN DECISION pending navigator: seven doors confirmed at HEAD (room_search, wiki flexsearch, graph_query, room_graph graph-query, context_assemble, /mos:graph, /mos:query deprecated alias); two are lexical (room_search, wiki flexsearch) with different coverage; the graph doors are a different job; no door breaks a recorded rule (Part 7 gates commands, skills, agents, hooks, not lib code); /mos:query's removal date (v1.14.0) has passed | 7a FIXED 70b2d3331 + d3b84e108 + 8b10decb2 (quick 261012-u58): the engine moved byte-faithfully to lib/core/room-search.cjs (requires only node:fs, node:path, room-path-containment), room.cjs re-exports it (same function object), the wiki /api/search answers from it with a page filter inside the walk, the body carries tier/scanned/walkable/truncated and the reason, wiki-search.cjs deleted, 0 flexsearch requires left in code (package.json removal at the release cut via npm uninstall); nested marker found with its nested id first, 3 negatives below_relevance_floor, walkable 418 = pages 418, about 100-140 ms per query against the 414-551 ms index rebuild it replaces; new test 25/25, nested-scan 14/14, leak 14/14, 232 5/5, room_search tests 50/50/7/22, test-270 green; screenshots inspected by the orchestrator. 7b FIXED 29f8b57b1 (quick 261012-v17): commands/query.md and skills/query deleted, 7 registries regenerated, 14 hand edits, gates OK, shape surfaces 53 -> 51 with 0 new, commands 113, acceptance 24/24 identical point set, help shows no query line; prerequisite quick 261012-vtx (62ea8f584, a9b838170, 0d5117d7e) reconciled the harness contract and made the blocking policy run |
| 8 | Desktop "Add marketplace" fails after metadata resolves (desktop-marketplace-add-fails-20261011) | navigator | blocked on host evidence; surface confirmed Desktop Code tab, no current error available (navigator 2026-10-12) | carried |

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: room_search finds the right artifact for a natural-language or keyword question in any room regardless of size, says so honestly when the room cannot answer, and tells the agent what it can do; the wiki index covers the room; every test leg in run-all-198 passes or names its owner; search surfaces do not duplicate each other.
actual:
  - item 1: lib/mcp/tools/room.cjs room_search description still reads "case-insensitive substring" after 32fcb604b added the word tier; the description bytes are pinned by tests/fixtures/267/wire-snapshot-zod3.json (and zod4) and tests/test-234-tool-description-floor.cjs
  - item 2: SEARCH_MAX_FILES=500 (room.cjs); walkable counts (md + html, dotfiles excluded) are mindrianOS 1,081 + 40, motj-ecosystem 798 + 35; whether files past the cap are dropped without a signal is unverified
  - item 3: harness median on rethinking-mindrianos (424 md): phrase tier 56.1 ms, sentence (word tier) 170.5 ms; keyword 58.1 -> 95.3 ms (quick 261012-kfn SUMMARY)
  - item 4: floor thresholds chosen from 10 positive + 3 negative queries on one room; negatives scored idf_share 0.15, 0.28, 0.35; positives >= 0.72
  - item 5: scanRoom comment "one level deep ... NOT recursive"; spike 010 flex-build event: pages 61 of 424 md
  - item 6: run-all-198.sh: Passed 16, Failed 1; the failing leg is "SPEC-5 hooks/ adapter-only budget (import audit + line-count)" -> node tests/test-198-adapter-budget.test.cjs; cause not recorded anywhere found
  - item 7: room_search (literal + word tier over files), wiki flexsearch (forward-token index over scanRoom pages), room_graph graph-query (SQL over room.db) all answer "find X in this room" with different coverage and ranking
  - item 8: see desktop-marketplace-add-fails-20261011.md; "Failed to add marketplace." after GitHub metadata resolves; host surface and current error unknown
errors: run-all-198 one FAIL line on the SPEC-5 adapter-budget leg (text to be captured by cluster B); no other error output; items 1-5 and 7 are silent behaviours, not errors
reproduction:
  1. cd /home/jsagi/dev/MindrianOS-Plugin && bash tests/run-all-198.sh  (item 6)
  2. node .planning/quick/261012-kfn-natural-language-room-search-word-split-/261012-kfn-measure.cjs  (items 3, 4 baseline numbers)
  3. node -e "const r=require('./lib/mcp/tools/room.cjs')._internal; console.log(r.searchRoom(process.env.HOME+'/MindrianRooms/mindrianOS','<term unique to a file beyond the 500th walked>').length)"  (item 2)
  4. grep -n substring lib/mcp/tools/room.cjs tests/fixtures/267/*.json tests/test-234-tool-description-floor.cjs  (item 1)
  5. node -e "const {scanRoom}=require('./lib/wiki/page-renderer.cjs'); console.log(scanRoom(process.env.HOME+'/MindrianRooms/rethinking-mindrianos').pages.size)"  (item 5)
started: items 1, 3, 4 began with 32fcb604b (2026-10-12); items 2, 5, 7 predate it and were first measured on 2026-10-12; item 6 first-bad commit unknown; item 8 reported 2026-10-11

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (room_search is one MCP tool on all three; wiki is CLI-served; run-all-198 is dev-only)
- Affected commands: MCP room_search; /mos:wiki search; /mos:query; dev: tests/run-all-198.sh
- Affected users: every install for items 1-5 and 7 (items 2 and 3 only on rooms above 500 walkable files); dev only for item 6; one reported Desktop user for item 8
- Version range: items 1, 3, 4 unreleased (main after beta.65); items 2, 5, 7 present in beta.65 and earlier; item 6 unknown
- Severity: medium overall; item 2 is high if a silent drop is proven on a real room
- Blast radius: CORRECTED 2026-10-12 (cluster C): no code outside lib/mcp/tools/room.cjs calls searchRoom, and context_assemble does not call it; items 2 and 3 reach users only through the room_search MCP tool call. No system-prompt text carries the room_search description (cluster D); item 1 lives in tools/list only.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Leviathan as a bundled or auto-downloaded dependency is the fix for the search gap.
  evidence: spike 010: the natural-language win reproduced in about 250 lines of plain JS (quick 261012-kfn, 10 of 10); the token saving did not hold against a capped tool (600-690 vs 460); a native binary breaks the npm ci --ignore-scripts install; its memory store would be a second truth source beside room.db (Canon Part 9).
  timestamp: 2026-10-12T12:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-12T12:00:00Z
  checked: .planning/spikes/010-leviathan-search-vs-room-search/results.json and 261012-kfn-measure.cjs on rethinking-mindrianos (424 md), read-only, re-run by the orchestrator
  found: after 32fcb604b: nl top-5 10/10 (was 0), kw top-5 9/10 (was 7), 3 negative controls empty with below_relevance_floor, median 394 / 458 tokens; sentence median 170.5 ms vs 56.1 ms
  implication: items 3 and 4 are measured costs on one room only; the cap (item 2) never bit because 424 < 500

- timestamp: 2026-10-12T12:40:00Z
  checked: cluster B: node tests/test-198-adapter-budget.test.cjs (exit 1), lib/mcp/hook-adapter-audit.cjs:59-63, git show <sha>:scripts/on-stop | wc -l at 7226232a7 / 8462f41ad / 26629ecff, grep of doctor.cjs and RELEASE_GATE_SUITES; re-run by the orchestrator
  found: on-stop 658 (test count) / 657 (wc -l) against budget 570; counts 546 -> 579 -> 657 at those commits; the budget constant unchanged since 2d9af5863 (2026-07-10); doctor and the release gate never run the leg; the cause was written down in .planning/quick/260911-juq deferred-items.md on 2026-09-11 and in at least 8 later phase documents as "pre-existing, unowned"
  implication: item 6 is a real, deterministic, unowned breach, not flakiness; three fix options with different costs (see Required Code Changes)

- timestamp: 2026-10-12T12:40:00Z
  checked: cluster D: room.cjs:616 and :619, grep substring across tests/fixtures/267, data/, docs/, commands/, skills/, agents/, lib/mcp/runtime-instructions.cjs; test-234, test-267 zod4-contract and dual-era, build-connector-registry --check (all green at HEAD); spot-checked by the orchestrator
  found: 3 copies of the description bytes (source, zod3 snapshot, zod4 snapshot); no regeneration script; the pin tests compare the whole description string; test-234 is a shape floor only (>= 120 chars, capital, terminal punctuation, <= 2048 bytes, no em or en dash); the runtime instructions carry no room_search text
  implication: item 1 is a 4-file hand edit plus one CHANGELOG line; the risk is a one-byte mismatch between source and either snapshot

- timestamp: 2026-10-12T13:20:00Z
  checked: cluster A: walk-order reproduction equal to _internal.walkSearchFiles on 3 rooms; 10 beyond-cap probes + 9 in-cap controls through searchRoom and the real handler; fs read counter; 5-run latency medians on 3 rooms; 16 + 16 + 3 queries on motj-ecosystem inside the first 500 files, repeated once; orchestrator re-ran the walk count (500 of 1,121 and 500 of 833 handed to onFile)
  found: see Items 2, 3, 4 rows; rooms unchanged (find -newer: 0 files in the two big rooms; in rethinking-mindrianos only .mindrian/room.db-shm moved, room.db itself unchanged since 2026-10-05, cause ASSUMED another process holding the db open)
  implication: item 2 is a silent-drop defect with a false reason text; items 3 and 4 are measured limits
  privacy: cluster-a/private/ holds room file paths, probe terms and question text drawn from venture rooms (MOTJ material, real names). It is never committed; EVIDENCE.md quotes no room line. Directory depth: the sweep's 14 and 12 counted absolute path components; cluster A measured 8 and 6 relative to the room root with dot directories excluded (UNVERIFIED by the orchestrator; immaterial to the findings).

- timestamp: 2026-10-12T13:00:00Z
  checked: cluster C: scanRoom on rethinking-mindrianos, depth census by find, page-renderer.cjs:138, git log -S on page-renderer.cjs, Phase 19-01 PLAN, quick 260923-lu5 PLAN, the fable-max-pack seed-visible-room-wiki finding F3, grep of searchRoom callers, commands/query.md; depth census and the skip line re-run by the orchestrator
  found: 61 pages of 424 files; 4 root, 63 flat, 260 depth-3 (90 nested name/name.md), 97 deeper; the shallow scan was never a recorded choice and two records call it a defect; no caller of searchRoom outside room.cjs; /mos:query carries deprecated_removal v1.14.0
  implication: item 5 is a known, orphaned bug, not a design decision; item 7 is a design choice with no record either way

- timestamp: 2026-10-12T12:00:00Z
  checked: find on ~/MindrianRooms/mindrianOS and motj-ecosystem, dotfiles excluded, .md and .html/.htm
  found: mindrianOS 1,081 md + 40 html, max depth 14; motj-ecosystem 798 md + 35 html, max depth 12. Earlier counts of 1,790 and 1,050 included dot-directories that room_search skips.
  implication: both rooms exceed SEARCH_MAX_FILES=500 by more than 300 files; item 2 is testable on real data

## Technical Root Cause

### Item 6 (cluster B; detail in search-surface-qa-sweep-20261012/cluster-b/EVIDENCE.md)
- Site: scripts/on-stop (whole file, 658 lines by `split('\n').length`, 657 by wc -l); limit at lib/mcp/hook-adapter-audit.cjs:59-63 `LINE_BUDGETS['scripts/on-stop'] = 570`; asserted by tests/test-198-adapter-budget.test.cjs:98-100 (subtest 2, "passes against the real committed tree today")
- Cause: the budget was set by phase 198-09 on 2026-07-10 as 547 measured plus 23 margin. The legacy flag-OFF body (on-stop lines 137-657) grew in phases 241, 240.1 and 369.25 without the leg being run. The flag-ON adapter span (lines 47-136) passes its own audit; the import audit is green on all 3 surfaces. The overage is 88 lines.
- Why it surfaces now: nothing runs the leg. doctor.cjs has no reference to 198 or adapter-budget; RELEASE_GATE_SUITES is tests/run-all-366.sh only, which does not call this test; package.json has no test script. The red has been visible only to a human who runs run-all-198 by hand, and each of them wrote "pre-existing".
- Side defect: the test prints `PASS: test-198-adapter-budget (17 assertions ...)` as its first line even when it exits 1, and says 17 while TAP reports 15. Misleading, not causal.

### Item 1 (cluster D; detail in cluster-d/EVIDENCE.md)
- Site: lib/mcp/tools/room.cjs:616 (description, 455 bytes) and :619 (query `.describe('Search text (case-insensitive substring match).')`)
- Cause: 32fcb604b added the word tier and left the description. The description is byte-pinned by tests/fixtures/267/wire-snapshot-zod3.json:1378 and :1386 and wire-snapshot-zod4.json:1618 and :1627, compared by tests/test-267-mcpv2-zod4-contract.cjs (strict string equality) and tests/test-267-mcpv2-dual-era.cjs. No regeneration script exists; both pins are hand-edited (precedent e87ce10ba). The runtime instructions (lib/mcp/runtime-instructions.cjs) carry no room_search text, so tools/list is the only carrier on all three surfaces.
- Why it surfaces now: the description is the only guidance a foreign host model gets; it now understates the tool and one clause steers away from it.

### Item 5 (cluster C; detail in cluster-c/EVIDENCE.md)
- Site: lib/wiki/page-renderer.cjs:80-84 (comment "one level deep ... NOT recursive") and :138 `if (!se.isFile() || !se.name.endsWith('.md')) continue;` which drops every sub-directory of a section
- Cause: 51c0c13bc (2026-03-26, Phase 19-01) created scanRoom flat although its PLAN line 125 asked for a recursive walk; decision 16 (nested `section/name/name.md`, 9d5b9b054, 2026-04-12) came later and the scan never followed; cbd6241fb (quick 260923-lu5, 2026-09-23) changed only the comment and deferred the walker to a "Wave 1" that was never scheduled
- Why it surfaces now: spike 010 measured it (61 of 424 pages); the depth census is root 4, flat 63 (61 seen, 2 STATE.md skipped), depth-3 260 (90 nested name/name.md, 170 name/other.md), deeper 97
- Constraint on any fix: a new recursive walker must pass tests/test-270-no-second-walker.cjs; reuse lib/core/section-registry.cjs discoverSections or the reconcile-memory-runner walker; page ids `section/basename` collide for repeated names such as MINTO.md (pack F3)

### Item 7 (cluster C; detail in cluster-c/EVIDENCE.md)
- Not a defect. Seven doors; two lexical ones overlap: room_search (walk per call, .md .html .htm, 500-file cap, phrase then BM25 word tier, reason_code on empty) and wiki flexsearch (in-memory forward-token index over scanRoom pages, .md only, one level deep, empty list with no reason). The graph doors (graph_query, room_graph graph-query, context_assemble, /mos:graph) answer "how things connect", a different job. room.db held 28 Artifact nodes against 424 files in the measured room. Canon Part 8: none of the seven references a Brain client.
- The reason a second lexical door was built (room_search, 2026-07-09) is not recorded.

### Item 2 (cluster A; detail in cluster-a/EVIDENCE.md; walk count re-run by the orchestrator: walkSearchFiles hands exactly 500 files to onFile on both big rooms)
- Site: lib/mcp/tools/room.cjs:84 `SEARCH_MAX_FILES = 500`; walkSearchFiles :277 and :289 `if (scanned >= SEARCH_MAX_FILES) return;` (the walk stops mid-tree, in sorted order, so late-sorting directories such as sub-rooms, team, team-execution vanish whole); the handler envelope :633-638 carries room_dir, query, tier, results, words, reason_code, reason and nothing about the walk
- Cause: the cap was a cost bound from Phase 198-04 and was kept as "unchanged" by the rank-then-cap fix (graph-query-results-unranked). It was never measured against a real room above 500 files. The section scope (SECTION_RE one segment) applies the same cap, so a 736-file sub-rooms section is also truncated.
- Why it surfaces now: spike 010 ran on a 424-file room, under the cap; the two largest rooms on this machine were never used as a search fixture. The reason text "No file contains this exact text or any of its search words" is false for a capped walk and breaks the honest-refusal rule (decision 8).

### Item 3 (cluster A)
- Not a defect. room.cjs:523 collectMatches then :528 scoreWordTier -> :437 collectWordStats each call the walk; readFileSync at :307 runs once per file per pass. A single walk that feeds both tiers would halve the reads; it matters only if the cap is lifted (extrapolated 350 ms on 1,121 files, 2,000 ms near 6,400 files).

### Item 4 (cluster A)
- Not a defect; a calibration limit. On the second room the floor of 0.55 rejected 3 of 16 true targets, one of them a correct rank-1 (B7). The negatives top out at 0.360. A threshold near 0.38 would have kept all 16 and still rejected all 3 negatives on both rooms, but that is 2 rooms and 29 labelled queries, written after reading the targets. Record, do not move.

## Required Code Changes

### Item 6: DECIDED by the navigator 2026-10-12: option (b1) re-base the budget to the measured size plus margin AND wire the leg into doctor --acceptance (or RELEASE_GATE_SUITES) so the next breach is seen; seed option (a), the thin-hook refactor, for a later phase. Options kept below for the record.
- (a) Bring on-stop back under 570. Move the inline `node -e` close-out blocks (the block at on-stop line 408 including the 40-line BRIEF render) into scripts/*.cjs. Honors the 198-09 number. Cost: a phase-sized refactor of a bash Stop hook with a byte-identical flag-OFF duty (SPEC-7), at least 88 lines cut, Windows Git Bash untested.
- (b1) Re-base the budget to a freshly measured value (658 plus margin) in hook-adapter-audit.cjs:62. One line. Blesses the growth; the next feature breaches again. Do NOT copy the stale 618 quoted in the 369 documents.
- (b2) Measure only the flag-ON adapter span (on-stop lines 47-136) for on-stop. Matches what D-06 means by thin. Changes the gate's meaning and loosens the guard on the hook as a whole.
- (c) Mark the leg a known failure with a named owner and phase, using the `run_known_if` pattern from tests/run-all-366.sh. Cheap and honest; the breach stays, and it repeats the drift if the owner is not real.
- In every option: stop the test printing PASS on a non-zero exit, and wire run-all-198 (or this test) into doctor --acceptance or RELEASE_GATE_SUITES so the next breach is seen.

### Item 1: one /gsd-quick, 4 files, no regeneration
- Change 1: lib/mcp/tools/room.cjs:616 description -> the draft in cluster-d/EVIDENCE.md (799 bytes; says exact phrase first, word-ranked when the phrase has no hit, a sentence works, an empty result with a reason means the room has no answer, literal not semantic, local-only; keeps room_graph for "how things connect"). Passes the test-234 floor (>= 120 chars, capital start, terminal punctuation, <= 2048 bytes, no em or en dash) in a scratch run.
- Change 2: lib/mcp/tools/room.cjs:619 query describe -> "Search text: an exact phrase, or a question in plain words."
- Change 3: tests/fixtures/267/wire-snapshot-zod3.json:1378 and :1386 -> the same two strings, byte-exact, no JSON reformat.
- Change 4: tests/fixtures/267/wire-snapshot-zod4.json:1618 and :1627 -> the same two strings.
- Change 5: CHANGELOG.md Fixed entry under the next version.
- Do not touch the connectors text (room.cjs:673, :675 "bounded substring search"); it feeds 2-3 generated data files and is still true for the phrase tier.
- Verify: node tests/test-234-tool-description-floor.cjs; node tests/test-267-mcpv2-zod4-contract.cjs; node tests/test-267-mcpv2-dual-era.cjs; node scripts/build-connector-registry.cjs --check; node tests/test-room-search-natural-language.cjs; bash tests/run-all-267.sh.

### Item 2: DECIDED by the navigator 2026-10-12: shape (a). Lift the cap and walk every file; add scanned, walkable and truncated to the envelope; make the no_match and below_relevance_floor reasons say when the walk stopped; keep a high safety bound (about 5,000 files) that still sets truncated; fold in the single-walk refactor so both tiers read each file once (item 3). Executes after 261012-rew and 261012-rey, before 261012-ri7.
The shapes as filed before the decision:
- In every shape: the envelope gains `scanned` (files read), `walkable` (files the walk would reach without a cap) and `truncated` (boolean); the no_match and below_relevance_floor reasons say "the walk stopped at N of M files" when truncated. The tool description bytes are pinned (item 1); keep the envelope change separate from the description change.
- (a) Lift the cap: walk every file. Cost from the measurement: about 1.4 to 1.8 times today's time on the two big rooms (about 350 ms on 1,121 files); room_search is in no hook. Add a high safety bound (for example 5,000 files) that still sets `truncated`.
- (b) Signal only: keep 500, add the three fields and the honest reason. Cheapest; the files stay hidden.
- (c) Raise the cap to a measured value (for example 2,000) plus the signal.
- With (a) or (c): item 3's single-walk refactor becomes worth doing in the same quick (one walk feeds both tiers; halves the reads).
- Test: a fixture room with more files than the bound; a term in the last file; assert `truncated: true`, the honest reason, and that a lifted or raised bound finds the file.

### Item 5: needs an owner before a /gsd-quick
- Change: lib/wiki/page-renderer.cjs scanRoom walks sections recursively through the shared walker (section-registry discoverSections or the reconcile-memory-runner walker), gives nested pages collision-free ids, and keeps STATE.md and identity files out. Verify with tests/test-270-no-second-walker.cjs and a page count of 418 or more on rethinking-mindrianos (424 minus root identity files and STATE.md).
- Ordering: if item 7's wiki repoint ships first, search finds nested files the wiki has no page for. Ship the walker first or together.

### Item 7: DECIDED by the navigator 2026-10-12: one lexical door. Repoint the wiki search to room_search's engine, retire wiki-search.cjs and the flexsearch dependency, retire /mos:query. Graph doors stay. Sequence: item 5 walker first (quick, after 261012-rew and 261012-rey), then the wiki repoint (7a, quick), then the /mos:query retirement (7b, separate: a command removal touches the CIRS born-wired registry, the connector registry, the HITL shape check and the Theo re-emit on the next cut). The flexsearch removal edits package.json and npm-shrinkwrap.json and so belongs to a release cut, not a quick commit alone.
### Item 5: DECIDED by the navigator 2026-10-12: owned as a /gsd-quick after the two in flight; must pass tests/test-270-no-second-walker.cjs and reuse the shared walker; ships before or with 7a.
The recommendation text as filed before the decision:
1. Keep room_search as the one lexical door.
2. Keep the graph doors as a different job.
3. Repoint the wiki /api/search (lib/wiki/wiki-server.cjs:43) to room.cjs searchRoomDetailed; retire lib/wiki/wiki-search.cjs and the flexsearch dependency. Needs searchRoomDetailed exported publicly or moved into lib/core.
4. Retire /mos:query; its scheduled removal (v1.14.0) is past.
Alternative: keep two lexical doors on purpose and record why. Either way the decision gets a record; today there is none.

## Tests to Add or Update

- Item 5: tests/test-270-no-second-walker.cjs must pass; add a fixture test: given a room with section/name/name.md, when scanRoom runs, then the nested page exists and its id does not collide with section/name.md.
- Item 7: if the repoint ships, the wiki search test (if any) runs against searchRoomDetailed; the flexsearch dependency leaves package.json and npm-shrinkwrap.json in the same change (release lockstep).
- Item 6: tests/test-198-adapter-budget.test.cjs: do not print PASS before the exit code is known; make the aggregator (run-all-198.sh) or doctor --acceptance run this leg. Given the committed tree, when on-stop exceeds LINE_BUDGETS, then the release gate is red, not a hand-run script.
- Item 1: no new test; the 267 snapshot tests are the test. After the edit, run-all-267.sh must be green.
- Items 2, 3, 4, 5, 7: PENDING.

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entries for whichever items ship, under the next version.
- Release lockstep: applies to any shipped fix (docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5).
- Canon: item 7 is a Part 7 (reuse before build) question; item 2 and 3 fixes must stay Part 8 local-only.
- STRUCK 2026-10-12 (cluster D): no Desktop or Cowork system-prompt text carries room_search; lib/mcp/runtime-instructions.cjs has none. The tools/list description is the only carrier on all three surfaces.
- Item 6: the 369 close-gate documents quote "618 against 570" and say nothing touched on-stop since July; both are stale (26629ecff added 40 lines on 2026-10-06). Correct them when the item is resolved.
- knowledge-base.md: one block per resolved item on resolve.
- Item 8 needs two facts from the navigator: the exact Desktop surface (answered 2026-10-12: Claude Desktop, Code tab), and the current import error or log (not yet available).
- Follow-ups carried out of this sweep (2026-10-13), none opened yet:
  1. Release cut: `npm uninstall flexsearch` on the operator machine (0 requires left in code; the CDN FlexSearch in the static Library page and generate-snapshot is a separate decision), drop the cve-db.json VETTED row, let release.sh Step 6.7 regenerate the shrinkwrap; Theo re-emit and `refresh-framework-names --live` after the /mos:query retirement; marketplace catalog and mos-desktop copy.
  2. tests/test-harness-167-verdict.cjs exits 1 at HEAD (a Part 9 check, last touched 298-14); unowned red, same shape as item 6; open a session.
  3. lib/memory/doctor-deprecation-surface.test.cjs T4 reads `doctor --all --json` through a pipe that truncates at about 143 KB of 215 KB; pre-existing; make the test read a file.
  4. Fixture hygiene: 25 occurrences of two real-sounding venture names in Phase 369.2 fixtures (see the egress session's follow-up).
  5. The 4 runtime surfaces the harness manifest digests (chain-executor, navigation-engine, cockpit-renderer, directive-envelope) are outside the pre-commit trigger; acceptance catches their drift only at release time.
  6. check-registry-drift --check exits 1 against the v2.0.0-beta.65 tag until the next tag (true positive: /mos:query removed); irreversibility warnings 14 -> 16 until the next live Jev build.
  7. mindrian-website lifecycle emails (templates.ts:125, provision-trial-key/index.ts:212) still tell users to run /mos:query; a GSD quick in that repo.
  8. docs/BACKEND-MAP.md line 286 still lists wiki-search.cjs; NEW_198_MODULES does not list lib/core/room-search.cjs (the new test carries the Part 8 floor).
  9. Item 4: re-check the 0.55 floor on a third room before any change; the Segment residual stays pinned in the guard gate baseline.
  10. The wiki /api/save route still calls gray-matter with its cache (the same hazard ri7 fixed in parsePage); the research section page lists 358 cards flat (UX).
  11. GAP1 and GAP2 (part8-egress-guard-under-blocks-key-shape-and-spelled-money) are open; the gate flips them to fixed only through `--stamp --reason` after that fix.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: per item, see Technical Root Cause; items 1, 2, 6 confirmed and fixed; 3 and 4 measured limits; 5 known bug in execution (quick 261012-ri7); 7 decided (one lexical door), 7a and 7b not started; 8 carried, blocked on host evidence
fix: item 1 quick 261012-rew; item 2 (with 3) quick 261012-rxc; item 6 quick 261012-rey; item 5 quick 261012-ri7 executing; 7a and 7b queued after the egress blocker (quicks 261012-sbz, 261012-sc0)
verification: item 1 test-234 204/204, test-267 zod4-contract 4/4, dual-era 5/5, run-all-267 33/33, connector-registry OK; item 2 walk 1,121/1,121 and 833/833, probes 10/10, run-all-198 18/0, kfn measure unchanged; item 6 test-198-adapter-budget 15/15, run-all-198 17/0 at that point, run-all-366 71/0, suite-gate PASS, doctor --acceptance 24/24; each re-run by the orchestrator
files_changed:
  - lib/mcp/tools/room.cjs (description and query describe; 5,000 bound; one scan for both tiers; scanned/walkable/truncated; truncated reason prefix)
  - tests/fixtures/267/wire-snapshot-zod3.json, wire-snapshot-zod4.json (two pinned strings each)
  - tests/test-room-search-walk-bound.cjs (new), tests/test-room-search-natural-language.cjs (2 checks that pinned the cap), tests/run-all-198.sh (1 leg)
  - lib/mcp/hook-adapter-audit.cjs (budget 680 with the measurement note), tests/test-198-adapter-budget.test.cjs (verdict line from the exit code), tests/run-all-366.sh (hard leg 2c)
  - .planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md (new)
  - CHANGELOG.md (three Fixed bullets)
commits: e54d85ec2, 656d986bd (item 1); 2c0eae9f5, 3aead34aa, 8a73d929c, ba27c0e9a (item 6); ca9b5722d, 287c76a76, e1ec2e788 (item 2); 97285972f, cb1c5bf47, 0defa8336 (item 5); 70b2d3331, d3b84e108, 8b10decb2, 92b1b525a (7a); 62ea8f584, a9b838170, 0d5117d7e, f1a732be7 (vtx prerequisite); 29f8b57b1, efcdbbd21 (7b); spike 04c6f8f7d and the word tier 19db43789, 32fcb604b, 63b25583d before the sweep; none pushed at the time of closing
