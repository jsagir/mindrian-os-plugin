# Audit 2 delta (older commit 72b0eed8) against the current repo

Source: second auditor report and claim verdicts, read from the audit folder (read-only). Auditor text is hypotheses, not authority.
Date: 2026-11-06. Method: code reading plus a pure local probe (`classify()` of lib/core/part8-egress-guard.cjs, synthetic strings, throwaway HOME, plain-text fake room.db, no network, no real room). Probe on current HEAD: job plus any sibling key allow/move_set (name question, Cypher text, fake sk- key, nested object); brain_write ambiguous/unknown; normalize_framework_name ambiguous/unknown; lower-case sk- key and spelled money allow; extended corpus (535 built as test-3692 builds it) 37 blocked with no room (36 name, 1 content_set); with an unreadable room.db 535 blocked (534 room_check_unavailable); cold guard load 172 repo modules, 95.9 ms (n=1, slower than the auditor 56.63 ms; one run, not a benchmark).
Labels: CONFIRMED, REFUTED, NOT VERIFIED. "prior" means EGRESS-CLAIMS-CHECK.md already checked it.
Plans 386-04, 25 to 36 are written but not executed at this HEAD, so the defects below still exist.

## Findings and claims

| id | what it says | covered by | status now | new work |
|----|--------------|-----------|-----------|----------|
| A2-1 | /api/briefing sends room text to Anthropic with no Part 8 check | 386-01 records it only as accepted (T-386-01-02, Phase 232 design, user key) | CONFIRMED (briefing.cjs sends when a key resolves; no guard call) | owner ruling |
| A2-2 | Entity classifier sends names and excerpt to Anthropic | none | CONFIRMED; header documents it as deliberate (Part 8 read as LOCAL to Brain only) | owner ruling |
| A2-3 | Chat (fabric-chat nlToSQL, chat-panel) sends conversation or question to Anthropic | none | CONFIRMED by read (fetch to api.anthropic.com, user key) | owner ruling |
| A2-4 | Other unchecked senders: llm-name-suggester, graph-candidate-producer, generate-snapshot, tavily-funding-scan, rs_corpus.py, transcribe-audio, mva-vercel-deploy | none (generate-snapshot only in 385-02 and 385-06 for flexsearch) | files present; sends NOT VERIFIED by run | owner ruling, then yes if ruled in scope |
| A2-5 | Pinecone inference audits each text with auditQueryString only | 385-12 only mentions the file | NOT VERIFIED; CLAUDE.md says Pinecone is retired but file is present | yes (dead or live?) |
| A2-6 | Semantic Scholar, grants.gov, research-speaker have no check | 386-05, 22, 23, 24 (E-i) | CONFIRMED (prior) | no |
| A2-7 | Packet bypass: job key lets sibling fields pass (P2, P4, E-d) | 386-28 (free-form string decided before packet arm; _proveMoveSet requires the exact packet key set; test J5) | CONFIRMED on HEAD for name text, Cypher text, fake key, nested object | no, but add a nested-object sibling and fake-key sibling case to J5 |
| A2-8 | brain_write ambiguous passes shim hook and callTool belt (P1, E-a, E-b) | 386-02, 04 (write_blocked on every scope), 26, 27 | CONFIRMED (ambiguous/unknown) | no |
| A2-9 | Malformed room.db: 534 of 535 room_check_unavailable (E-m) | 386-33 (failed read not cached, test OBU1), 386-32 | CONFIRMED (535 blocked, 534 room_check_unavailable) | no. Check the fix also returns allow, not only "not cached", when the db stays unreadable and no name hit exists. OBU1 skips when run as root |
| A2-10 | 37 of 535 extended questions over-blocked (E-m) | 386-32 (RCA, owner choice A or B), 386-33 | CONFIRMED exactly 37 (36 name, 1 standup content_set) | no |
| A2-11 | Hook-vs-callTool policy split is itself a safety issue | 386-26, 27, 30 | CONFIRMED by read (prior E-a) | no |
| A2-12 | Statusline opens room.db on each refresh (A1-6) | 384-10 (T03 measures statusline modules and time) | CONFIRMED by read (statusline-mos runs node openRoomDb plus getActiveFocus per refresh) | no, measure first (384-10); note room open cost is 384-07 |
| A2-13 | MCP server cold start broad, unmeasured (A1-8) | 384-06, 384-15 | NOT VERIFIED | no |
| A2-14 | flexsearch dead dependency (R-a, A1-9) | 385-02 | CONFIRMED (package.json:54) | no |
| A2-15 | folder-memory eagerly loads timeline-runner (A1-9, T03) | 384-10, 386-35 | CONFIRMED (folder-memory.cjs:268) | no |

## The 46 claims

| id | what it says | covered by | status now | new work |
|----|--------------|-----------|-----------|----------|
| T01 | 8 write hooks, 3 jq, early resolve | 384-04, 384-20 | NOT VERIFIED (static, 384 measures) | no |
| T02 | operator-update registry shape mismatch | 386-06, 07, 08 (B3) | NOT VERIFIED | no |
| T03 | folder-memory import chain; navigation 52 requires | 384-10, 386-35 | CONFIRMED (52 require( on lines 20-80; line 268) | no |
| T04 | isRoomFile misses MindrianRooms paths, cascade still reported | 384-20, 386-15 | CONFIRMED (isRoomFile checks /room/ or /rooms/ only) | no |
| T05 | Stop poll spawns doctor; tier 0 unreachable | 384-19, 386-18 | NOT VERIFIED | no |
| T06 | per-section recompile in on-stop | 384-04, 384-10 | NOT VERIFIED | no |
| T07 | SubagentStop fanout | 384-16 | NOT VERIFIED | no |
| T08 | drain loads modules before empty check | 384-05 | NOT VERIFIED | no |
| T09 | room.db open schema and BEGIN IMMEDIATE | 384-07 | NOT VERIFIED | no |
| T10 | dial-memory always writes; 63 node lines in session-start | 384-14 | CONFIRMED count (63 lines with `node `) | no |
| R-a | flexsearch unused | 385-02 | CONFIRMED | no |
| R-b | orphan cluster; room-type-detector has a caller | 385-03 to 07 (06 removes both detector and its caller together) | CONFIRMED (both files present; narrower than first audit) | no |
| R-c | supersedeOnGateAnswer test-only | 386-20 | NOT VERIFIED | no |
| R-d | env assignment passed as node argument, session-start:1518 | 386-09 (B4) | NOT VERIFIED | no |
| R-e | restore-post-compact contribute throws on missing roomDir | 386-10 (restore-post-compact RCA and test) | NOT VERIFIED | no |
| R-f | pycache not tracked | 385-01 | REFUTED as written (path scripts/pycache). Current repo tracks scripts/__pycache__ (2 .pyc). Auditor SHA lacked them; 385-01 stands | no |
| R-g | 16 Eureka tool modules | 387-01 to 08 | CONFIRMED count 16 (lib/mcp/tools/eureka*) | no |
| R-h | wiki chat route shadowed, pdf route behind wildcard | 386-01 (done, 89fac7b2b) | REFUTED now (proxy removed, pdf route reachable) | no |
| P1 | brain_write ambiguous | see A2-8 | CONFIRMED | no |
| P2, P4 | job plus text allow | see A2-7 | CONFIRMED | no |
| P3, P8, P11, P12 | block, class wording differs | 386-32 | NOT VERIFIED (wording only) | no |
| P5, E-f | newline form evades scan | 386-31 (E-KEY) and 386-22 | NOT VERIFIED here; prior E-f read CONFIRMED | no, confirm 386-31 tests a newline split |
| P6, P10, P13 | burn rate, runway, standup block content_set | 386-32 | CONFIRMED standup (1 block) | no |
| P7 | lower-case key allowed | 386-31 | CONFIRMED | no |
| P9 | spelled money allowed | 386-31 | CONFIRMED | no |
| P14, E-l | normalize_framework_name ambiguous | 386-25 | CONFIRMED | no |
| P15 | empty payload allow | none needed | NOT VERIFIED (prior a: theo_health {} allow) | no |
| E-a | shim ambiguous allow, callTool proceeds | 386-26, 27 | CONFIRMED (prior) | no |
| E-b | brain_write outside free-form | 386-04 | CONFIRMED | no |
| E-c | whitespace MERGE gated only by availability | 386-02, 04 | CONFIRMED by 386-02 RCA | no |
| E-d | packet proof ignores siblings | 386-28 | CONFIRMED | no |
| E-e | no credential class; money patterns partly there | 386-31 | CONFIRMED (prior d) | no |
| E-g | web check is credential only | 386-22, 36 | CONFIRMED (prior h) | no |
| E-h | fail-open; 172 modules, 56.63 ms | 386-29, 30 (fail-open), 386-35 (lazy load) | CONFIRMED fail-open; 172 modules confirmed; time 95.9 ms (n=1) | no. First audit "127 modules" is contradicted (172) |
| E-i | no shared check at 3 send sites | 386-05, 23, 24 | CONFIRMED | no |
| E-j | hook matcher is Brain-shaped names only | 386-36 | CONFIRMED (prior c) | no |
| E-k | 8 weak files; canary test | 386-34 (5 files) | PARTLY: 5 files match `verdict !== 'allow'`; our plan already uses 5 | no |
| E-m | 0/26, 37/535, 534/535 | A2-9, A2-10 | CONFIRMED | no |

## Contradictions with first-audit claims we used

- E-k: first audit said 8 files assert only "not allow". Count now is 5 (prior check found 4 with a narrower grep). Plan 386-34 already says 5. Use 5.
- E-h: first audit said about 127 modules. Measured 172 on both SHAs. Fix any plan text that uses 127 (only the findings source quotes it).
- R-f: first audit said pycache is tracked. At 72b0eed8 it was not; at HEAD scripts/__pycache__ is tracked. Keep 385-01.
- R-b and R-c: first audit said "no caller". Narrower: room-type-detector has a caller (385-06 handles it); release-beta-preflight.sh is named in CHANGELOG.md (385-07 should update the reference).
- T10 and R-g: counts agree (63 lines, 16 modules). "Nothing in the repo sets MINDRIAN_EUREKA_ROOT" is true only for production wiring (tests set it); 387 plans already address wiring.

## Result

Needs new plans:
- N1: Pinecone inference status (A2-5): remove if dead, or guard if live.
- N2: A2-9 hardening: with an unreadable room.db and no name hit, the verdict must be allow or a typed retry, not a block of every question.
- N3: add J5 cases for a nested-object sibling and a fake-key sibling in 386-28 (edit of an existing plan).

Needs an owner ruling (one bundle, same question for all):
- O1: Does Part 8 cover room text sent to Anthropic on the user's own key? Covers /api/briefing (A2-1), entity classifier (A2-2), chat (A2-3), name suggester, candidate producer, snapshot generator, Tavily funding scan, rs_corpus.py, transcription, Vercel deploy (A2-4). Recommended: Part 8 stays Brain-only; add a disclosure line and an opt-in per feature. Needs the owner's word because Phase 232 and the entity-classifier header chose the opposite.

Already covered: A2-6 to A2-8, A2-10 to A2-15, and every claim marked "no" above (plans 384-04 to 20, 385-01 to 12, 386-01 to 36, 387-01 to 08).
