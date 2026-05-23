---
status: resolved
kind: qa-sweep
trigger: "brain-post-fix-qa"
created: 2026-05-23T04:21:06Z
updated: 2026-05-23T04:35:00Z
---

## Purpose
<!-- OVERWRITE on each update - reflects NOW -->

Post-fix verification sweep of the live production Brain (mindrian-brain.onrender.com) after the 5-commit brain_ask + curated-op fix chain landed (c40afc71 .. d957a515). Confirms the chain is closed, the Windows beta-tester surface is healthy, and surfaces two doc-only findings that did NOT block the close-out.

This is a `kind: qa-sweep` file (post-fix verification matrix), not a single-bug debug session. Sibling to `.planning/debug/windows-build-brain-python-qa.md` (the 2026-05-22 sweep that surfaced NF-1, the brain_ask empty-envelope failure that this chain resolved).

next_action: chain closed. Two follow-up RCAs filed (one new, one pre-existing); see Findings section below.

## QA Protocol (executed 2026-05-23 from a Windows machine)
<!-- IMMUTABLE once the sweep started -->

```
ROLE: End-to-end Brain test from a Windows machine. Verify the brain_ask
+ curated-op fix chain (c40afc71 .. d957a515) is closed on the live
production Brain. Confirm no regression in the 5 MCP tool surfaces,
the 3 curated ops, the D-MOAT caps, the Part 8 boundary, and the
doctor brain-smoke 5-layer harness.

Disclosure: protocol prompt detailed in chat session 2026-05-23 ~04:18Z;
gates summarized in the matrix below.
```

## Results (Windows beta-tester pass, 2026-05-23)
<!-- APPEND raw evidence; OVERWRITE the matrix as the sweep completes -->

Environment: OS = Windows (native); plugin = 1.13.0-beta.25; Brain server = mindrian-brain.onrender.com (Render auto-deploy on); MINDRIAN_BRAIN_KEY = set (non-admin).

### Component Health Matrix

| Gate | Track | Result | Class |
|------|-------|--------|-------|
| D1   | doctor brain-smoke L1 plugin-root-resolver | PASS 1ms | WORKING |
| D1   | doctor brain-smoke L2 brain-key-resolver   | PASS 1ms | WORKING |
| D1   | doctor brain-smoke L3 HTTPS schema probe   | PASS 2884ms | WORKING |
| D1   | doctor brain-smoke L4 MCP stdio handshake  | PASS 232ms | WORKING |
| D1   | doctor brain-smoke L5 e2e brain_schema     | PASS 2100ms via shim | WORKING |
| D1   | doctor brain-smoke overall                 | PASS 5218ms | WORKING |
| T1   | brain_stats                                | 12,401 records across 6 namespaces (Pinecone surface) | WORKING |
| T2   | brain_schema                               | 91 node labels / 47 rel types / hundreds of props | WORKING |
| T3   | brain_search                               | 5 hits returned, scored and ranked | WORKING |
| T4   | brain_query (raw Cypher)                   | admin-gate refusal "raw Cypher requires admin key" | BUG 2 (expected; moat guard works) |
| T5   | brain_ask                                  | returned a DirectiveEnvelope (pedagogical routing); GUIDED mode | WORKING (chain closed) + Finding 1 (contract description mismatch) |
| -    | brain_write                                | SKIPPED by design (read-only e2e) | SKIP |
| -    | CH1 (linux-side prior probe)               | brain_ask envelope populated, Pinecone hit score 0.85 | WORKING |
| -    | CH2-CH3 (linux-side prior probe)           | 3 distinct methodology questions, all populated envelopes; NF-1 regression NOT detected | WORKING |
| -    | CH4 (linux-side prior probe)               | framework_chain_slice 41 rows, $-bound params honored | WORKING |
| -    | CH5 (linux-side prior probe)               | hop_distance typeof number (not neo4j Integer); BUG 2-followup d957a515 closed | WORKING |

### Verdict

- **brain_ask chain (c40afc71 .. d957a515)**: CLOSED. All 5 gates green. The Windows beta-tester pass matches the Linux-side `_qa-chain-probe.cjs` result on 2026-05-22.
- **Part 8 boundary**: INTACT. No user content in any outbound payload; all curated ops bind params; `brain_query` refusal proves the moat guard.
- **Plumbing**: 5/5 green on the doctor harness. Every transport hop works, end-to-end through the shim ran in 5.2s. The layer the autopsies kept catching is healthy now.
- **Recommendation**: ship as-is. Both findings are doc-only and do not block the chain.

### Findings (two doc-only, neither blocks ship)

#### Finding 1: brain_ask tool description contract mismatch (NEW)

- The MCP tool description at `mcp-server-brain/lib/brain-ask.cjs:506` opens with "Ask the Brain anything in natural language. Returns a DirectiveEnvelope ..." which reads to a fresh consumer as synthesized-answer semantics. The tool actually returns a routing envelope (framework + chain + mode signal), NOT a synthesized answer.
- Silent-degradation in benign form. No exit code, no log, no failure to fix. Same shape as Finding 2 (schema sprawl, the future-debugging tax) at minimum severity.
- Filed: `.planning/debug/brain-ask-contract-mismatch-rename.md` (kind: rca, severity: low, canon_parts: [3, 8, 10]).
- Fix: two-line description rewrite naming the actual return contract; ships in v1.13.0-beta.26 or later.

#### Finding 2: Brain schema sprawl (pre-existing, comprehensive RCA already filed)

- 91 node labels, 47 rel types, hundreds of properties with overlapping semantics (description vs definition vs summary; category vs mece_category vs category_name).
- A comprehensive root-cause RCA already exists: `.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md` (2026-05-10, status: diagnosed). Root cause traced upstream of MindrianOS-Plugin to LLM extractors in `~/Mindrian/mindrian-deploy/` (`langextract` + gemini filesearch + `lazy_graphrag_index.py`). The plugin's own writers are vocabulary-frozen and Part 8-compliant.
- No new RCA needed; cross-referencing only. Remediation plan and Memgraph migration assessment are in the diagnosed RCA.

#### Number-check (not a finding, just clarity)

The Windows reading "brain_stats: 12,401 records across 6 namespaces" is the Pinecone surface, not Neo4j. Per Canon Appendix D entry 13 (corrected 2026-05-20), the corpus is Neo4j 15,298 nodes / 19,713 relationships AND Pinecone 12,401 vectors at 1024-dim multilingual-e5-large. `brain_stats` exposes the Pinecone side. If a future change makes brain_stats compose both surfaces, the description should name them explicitly to avoid the same contract-mismatch shape as Finding 1.

### Raw evidence

```
[doctor --brain-smoke]                                 PASS (5218ms)
  L1 plugin-root-resolver       1ms     PASS
  L2 brain-key-resolver         1ms     PASS
  L3 HTTPS schema probe         2884ms  PASS
  L4 MCP stdio handshake        232ms   PASS
  L5 e2e brain_schema via shim  2100ms  PASS

[direct MCP surfaces - independent probes]
  brain_stats     12,401 records across 6 namespaces
  brain_search    5 hits returned, scored and ranked
  brain_schema    91 node labels / 47 rel types / hundreds of props
  brain_ask       DirectiveEnvelope (pedagogical routing), GUIDED mode
  brain_query     gated - "raw Cypher requires admin key"
  brain_write     skipped by design (read-only e2e)

[linux-side chain probe, mcp-server-brain/_qa-chain-probe.cjs, 2026-05-22]
  G1 brain_ask DirectiveEnvelope         PASS (Pinecone hit, score 0.85, 5 results)
  G2 curated-op surface                  PASS (41 rows on framework_chain_slice)
  G3 Integer->number coercion            PASS (hop_distance typeof number, value 1)
```

## Second Windows pass (deep audit, 2026-05-23 ~04:30Z)
<!-- APPEND - a second beta-tester ran a 14-gate matrix and surfaced three additional claims; classified below -->

A second Windows beta-tester ran a deeper 14-gate matrix against the live production Brain (`mindrian-brain.onrender.com`) from a fresh install of the marketplace cache (plugin v1.13.0-beta.24 at `~/.claude/plugins/mindrian-os/`). The full report is in chat transcript 2026-05-23. Three new technical findings were raised. Verified against the deployed source (`origin/main` HEAD `0280d8fb`) and classified.

### Three findings, classified

**1. NF-2026-05-23-01 (brain_ask Neo4j fallback bypasses parameter-binding moat) - INVALID for the deployed surface.**

The reporter quoted a string-interpolation pattern at `mcp-server-brain/lib/brain-ask.cjs:164-172`:

```js
const cypher = pattern.cypher
  .replace(/\$keyword/g, `'${keyword.replace(/'/g, "\\'")}'`)
  .replace(/\$limit/g, String(limit));
```

That exact code does NOT exist in the deployed server. It was removed by commit `4a7cbfbe` ("brain_ask directive retrieval -- match live graph, not mocks") in the c40afc71..d957a515 fix chain. The CURRENT brain-ask.cjs at line 582 uses proper Neo4j-driver parameter binding:

```js
const result = await session.run(pattern.cypher, {
  keyword: String(keyword),
  limit: neo4j.int(limit),
});
```

The pre-fix string-interpolation code is preserved in stale install caches:
- `~/.claude/plugins/mindrian-os.legacy-2026-05-13.bak/mcp-server-brain/lib/brain-ask.cjs:164`
- `~/.claude/plugins/mindrian-os.backup-pre-beta.14-*/mcp-server-brain/lib/brain-ask.cjs:164`

The reporter's MCP probe hit the deployed (post-fix) server, but their source-read landed in a pre-fix cache. The moat is intact on the deployed surface.

**2. NF-2026-05-23-01b (topK uncapped at Brain layer) - VALID, low severity advisory.**

Confirmed at `mcp-server-brain/lib/brain-ask.cjs:545` (`const limit = topK || 5`) and `mcp-server-brain/lib/pinecone-tools.cjs:42` (`topK: topK || 5, inputs: { text: query }`). Brain forwards caller `topK` directly to Pinecone with no Brain-side cap. Pinecone enforces its own server-side cap, so the moat is INHERITED, not Brain-owned. If Pinecone ever raises or removes that cap, Brain has no fallback.

Filed as a separate low-severity RCA: `.planning/debug/brain-topk-uncapped-advisory.md` (`/gsd:debug brain-topk-uncapped-advisory`).

**3. Curated-op surface "not on live MCP" (O-track SKIPs) - INVALID.**

The reporter claimed the `op` parameter does not exist on the live brain_ask tool, marking O1-O3 + M1 as unrunnable SKIPs. The Zod schema in the deployed source explicitly registers it:

```js
// mcp-server-brain/lib/brain-ask.cjs:508-512
question: z.string().optional().describe(...),
topK: z.number().optional().describe(...),
op: z.enum(['list_frameworks', 'framework_edges', 'framework_chain_slice']).optional()
  .describe(...),
params: z.object({}).passthrough().optional()
  .describe(...),
```

The handler dispatches on `op` at line 537. The Linux-side `_qa-chain-probe.cjs` from the 2026-05-22 pass successfully ran `askOp("framework_chain_slice", { seeds: ["Six Thinking Hats"], max_hops: 2 })` and got 41 rows back (G2 + G3 PASS, evidence above). The curated-op surface IS live. The reporter's MCP client either cached an old tool schema or checked a stale source.

### Meta-finding (the actually-interesting one)

The pattern across both invalid findings is the same: source-of-truth mismatch between the **deployed wire** (live Render auto-deploy from origin/main HEAD) and the **local source** the auditor reads (marketplace cache at the version they installed, plus older stale caches). The fix chain landed AFTER the install cache was cut; the auditor's wire probes saw post-fix behavior, but their code reads saw pre-fix code. Two technical claims hinged on that gap.

This is itself a debugging anti-pattern worth naming so the next QA harness does not re-litigate the same ground. Filed as a separate process RCA: `.planning/debug/stale-install-cache-audit-anti-pattern.md` (`/gsd:debug stale-install-cache-audit-anti-pattern`).

### Verdict (updated)

- brain_ask chain (NF-1 closure): **CLOSED**. Both Windows passes (2026-05-23 plumbing + 2026-05-23 deep audit) confirm populated DirectiveEnvelopes on the natural-language path. The curated-op surface IS live and bound by D-MOAT-2 caps (timeout + row cap + byte cap).
- Part 8 boundary: **INTACT**. The deep audit's 12-payload review confirms zero LOCAL bytes.
- Recommendation: **ship as-is**. The one valid technical finding (topK uncapped) is advisory and tracked. The two invalid findings are stale-cache artifacts.

## Triage with GSD (review step)

1. Chain is closed. `status: resolved` set on this file.
2. Finding 1 from first pass (brain_ask description contract): `/gsd:debug brain-ask-contract-mismatch-rename` - new RCA filed, ships in v1.13.0-beta.26+.
3. Finding 2 from first pass (schema sprawl): `/gsd:debug brain-schema-entropy-and-cooccurs-bloat` - pre-existing RCA, remediation roadmap, not on the v1.13.0 critical path.
4. Finding from second pass (topK uncapped): `/gsd:debug brain-topk-uncapped-advisory` - new low-severity RCA filed, fix scoped to ~5 lines across two files.
5. Meta-finding from second pass (stale-cache audit anti-pattern): `/gsd:debug stale-install-cache-audit-anti-pattern` - new process RCA filed; the next QA harness gets a source-of-truth preamble before any source-read claim is accepted.
6. NF-1 (brain_ask empty envelope, sibling sweep .planning/debug/windows-build-brain-python-qa.md) is already RESOLVED and lives at `.planning/debug/resolved/brain-ask-empty-envelope.md`. Knowledge-base.md carries the summary block.
7. When Finding 1 or the topK advisory ship in a release, move the corresponding `.planning/debug/<slug>.md` to `.planning/debug/resolved/` and append the knowledge-base block.
