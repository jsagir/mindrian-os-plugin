# Spike Manifest

## Idea

Use TypeSafe's Jev (a System One model: typed choice / score / noul answers with calibrated
probabilities and a confidence value, no text generation) as the ranker for MindrianOS
decisions that are made over STRUCTURE, never over room content. Candidate seats, from the
2026-09-17 Theo-relationship review: the per-section framework ledger (rank Theo's candidate
frameworks for a room section by fit, not graph degree), the eureka_critic verdict (already a
quantized-scalar + closed-enum payload), and next_gate option ordering. Explicitly NOT a seat:
the Part 8 egress guard (a remote model deciding whether bytes may leave the machine is itself
the bytes leaving the machine; classify() stays pure local by Canon Part 8 D-01).

## Requirements
- (SEED-105, navigator 2026-10-02) UI work uses icm-workspace-architect + websocket-engineer + RxDB + agent-native, styled only with mindrian-website Design Canon v3 Workshop Modernism; one-way sync room -> browser, writes only through MCP actions; gates are session-owned (005).

- Canon Part 8 holds for every call: state carries generic methodology handles only
  (framework names, section slugs, problem-type and stage enums, quantized scalars). Zero room
  content, zero user text, zero artifact ids.
- Key lives in `~/.secrets/typesafe.env` (mode 600) as `TYPESAFE_API_KEY=`; never hardcoded,
  never printed, never committed. `MAIN.env` is globally git-ignored on this machine.
- Spike code is CJS, zero npm deps, native `fetch` (Node 22). The SDK is a real-build choice,
  not a spike dependency.
- Any future in-hook use is async and best-effort with backoff; a Jev outage can never block a
  turn (the same rule the Brain route already follows).
- Vendor speed and cost figures are unverified until a spike measures them; the spike numbers
  are the only ones quoted.
- Dependency shape (navigator ruling 2026-09-17): users never carry a Jev dependency or key.
  Finite input spaces (the section ledger: sections x problem types x stages x frameworks) are
  scored once at dev time or in Theo's re-emission and SHIPPED AS DATA. Per-user inputs that
  are already Part-8-clean (the eureka critic payload) route plugin -> Theo -> Jev with Theo
  holding the one key, the same keyless shape users already have with Theo. Jev never runs in a
  hook on a user's machine.
- IP egress ruling (navigator, 2026-09-17, Spike 002): what may cross to TypeSafe about a
  framework is its name, a JTBD statement (rendered from the Brain's closed job vocabulary on
  `jtbd_anchor`) and a glossary line (`definition`, else the first sentence of the description
  capped at 140 chars). Full Theo descriptions never cross unless the navigator runs it himself.
- Theo read contract, as measured: ROW_CAP=100 returns a text-only notice with ZERO rows;
  `Skip`, `Distinct` and `NodeUniqueIndexSeekByRange` are PLAN_REJECTED; a function-wrapped
  predicate (`toLower(left(f.name,1)) = 'a'`) plans as NodeByLabelScan + Filter and passes.
  Any ledger builder pages by bucket, never by SKIP or by name range.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | jev-liveness-cost | standard | Given the key, when one systemOne call with 3 mixed questions over generic handles fires, then HTTP 200, typed answers, measured wall time and token usage; plus auth failure, validation failure, repeatability, no-match mass | VALIDATED (warm 233-305 ms, cold 731-893 ms; 507/105 tokens; drift 0.01; 401 bad key; 400 not 422 on invalid; no-match 0.95 on no-fit) | [typesafe, jev, liveness, cost, part8] |
| 002 | jev-section-framework-ranker | standard | Given a section + problem type + stage and N candidate frameworks (generic one-liners from command-registry), when one Score per candidate is asked, then the ranking tracks a hand-labeled fit set better than graph-degree order and confidence separates clear from unclear cases | PARTIAL (Spearman vs labels: 0.59 / 0.63 / 0.80 / 0.21 against degree 0.06-0.13; confidence separates in 3 of 4; weak where Theo descriptions are stubs: 305 of 410; p50 318 ms, p95 713 ms; ~$0.018 for 4 x 410) | [typesafe, jev, ledger, ranking, part8] |
| 003 | jev-hook-latency-budget | standard | Given the 2000 ms hook budgets in hooks.json, when 20 calls run through an async best-effort wrapper with backoff, then p50/p95 wall time vs budget and 429/529 behavior are known | VALIDATED (cold 741-800 ms per fresh process; warm p50 303, p95 1241; burst x20 all 200, no 429; 0 of 45 over 2000 ms) | [typesafe, jev, latency, hooks] |
| 004 | jev-eureka-critic-parity | standard | Given eureka_critic's quantized-scalar + enum payload, when Jev picks one of the 4 verdicts, then agreement rate vs criticRule on the fixture set and confidence per case are known | VALIDATED (rule stated: 64/64, confidence 0.90; rule withheld: 40/64, all misses are priority-order misses) | [typesafe, jev, eureka, parity, part8] |
| 005 | mcp-http-reach | standard | Given the mindrian-os MCP server on Streamable HTTP over a throwaway room, when a client calls room_state, graph_query and gate_render -> gate_answer, then each answers and a gate is approved over HTTP | VALIDATED (per-connection mode MINDRIAN_MCP_FIRST=cowork: 45 tools, gate ratified over HTTP, cross-connection answer refused session_mismatch, room_state p50 4 ms; default stateless mode fails for the SDK client) | [mcp, http, gate, seed-105, ui] |
| 006 | room-pull-checkpoint | standard | Given a throwaway room.db, when a pull endpoint answers changes since a checkpoint via navigation.cjs and a live stream fires on writes, then a browser RxDB (IndexedDB) copy catches up and updates live without reload; nothing is pushed back | VALIDATED with a changed checkpoint (journal {epoch,seq}: 0 of 2,000 lost under burst, write to screen p50 19-28 ms, cold catch-up 110-168 ms at 232 docs / 530-1,078 ms at 2,420, reconnect 1.0-1.4 s, warm reload 36 ms / 0 docs; SEED shape fails: last_modified_at NULL on inserts, {ts,id} lost 49 and 179 of 2,000 on ms ties, plugin SSE bus emits 0 frames on writes, hard deletes need tombstones; egress only loopback + Google Fonts; RxDB dev-mode calls rxdb.info) | [rxdb, sse, replication, seed-105, ui] |
| 007 | agent-native-wraps-mcp | standard | Given an agent-native app with three actions wrapping room_state, graph_query and gate_render/gate_answer over MCP HTTP and no Postgres holding room data, when the gate's Confirm is clicked once, then the research grant is recorded in the throwaway room and the 006 view updates without reload; license checked | VALIDATED headless, awaiting navigator click (license: MIT on every published package, root package.json ISC is the private monorepo root, no LICENSE text in the npm tarball; one click on the preselected recommendation: answer 60-116 ms, decision in the 006 RxDB view 68-125 ms, standing grant saved, prod gate on screen 0.65-1.4 s vs dev 6.6 s; reproducible via setup.sh; findings: agent-native's MCP SDK v2 client cannot connect to the v1 MindrianOS server (server/discover gets 400, fixed by a JSON-RPC -32601 shim: 45 tools, gate ratified), prod refuses PGlite and needs hosted Postgres, a refused cross-session answer burns the owner's gate (gate-ledger.cjs:100), gate contract carries recommended:null, scaffold CLAUDE.md bleeds into Claude sessions, CLI telemetry on by default, dev binds all interfaces) | [agent-native, ui, gate, seed-105] |
