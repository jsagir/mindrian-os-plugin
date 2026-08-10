# Brain ↔ MindrianOS harness — context handoff

**Cut:** 2026-08-10 · **For:** a fresh session on the dev machine (which already shipped beta.13)
**Scope:** the Memgraph Brain on Render and how the MindrianOS plugin reaches it.

Everything below is measured or cited to `file:line`. Where something is inferred or
unverified it says so. Do not upgrade an inference to a fact by repeating it.

---

## 0. TL;DR

The Brain database was never the problem. Three things stack in front of it:

1. Two **client-side plugin defects** blocked every Brain call. **Both are now fixed and on
   plugin `main`.** They were NOT on main at the time of the audit.
2. **`brain_query` is not registered on the public HTTPS surface at all** — admin-gated by
   an env var Render never sets. This is unfixed and is the single highest-leverage item.
3. **80% of the public MCP description budget** is spent on 19 tools that should be a skill.

Plus one dead service costing money, and four tool descriptions that name a backend the
system stopped calling on 2026-07-23.

---

## 1. Topology and spend

| Service | Render ID | Plan | What it is | Called by |
|---|---|---|---|---|
| `pws-brain-db` | `srv-d9geq2urnols73cimkfg` | Standard 2 GB / 1 CPU | Memgraph MAGE, disk 10 GB at `/var/lib/memgraph` | only `pws-brain-mcp`, over the Render private network |
| `pws-brain-mcp` | `srv-d9gfa03tqb8s73csfmtg` | **Pro 4 GB** | public MCP + e5 sidecar (`/hf-cache`, 5 GB disk) | the MindrianOS plugin, by API key |
| `mindrian-brain` | `srv-d71t3vm3jp1c739i9fig` | Standard | Node, **Neo4j Aura + Pinecone** | **nobody — legacy, uncalled** |

Both brain services build from `jsagir/ProblemsWorthSolving-Brain`, branch `main`,
autodeploy on commit. `mindrian-brain` builds from `jsagir/mindrian-os-plugin`
(`mcp-server-brain/server.cjs`).

**`mindrian-brain` is dead spend.** Nothing in the plugin calls it — see §3.

---

## 2. Deploy state as of this handoff

**Brain repo — fully current.**
- `origin/main` = `0e79704` ("pin the last two brain-side fixes that shipped as code but not as coverage")
- Local checkout at `C:\Users\PC\Projects\ProblemsWorthSolving-Brain` = `0e79704`, 0 behind.
- Render `pws-brain-mcp` **live on `0e79704`**, deploy `dep-d9s4hojl550s73e0iqag`, finished 2026-08-09 09:32 UTC.
- `vectorIndexSpaces` **is present** on main at `src/server.mjs:784`. So a `brain_stats` call
  against the live service should return it.

**Plugin repo — fixes landed.**
- All three fix commits are now ancestors of `origin/main`: `ec233d80`, `1571c657`, `cb1f5726`.
- The branch `fix/brain-envelope-and-egress-guard` has served its purpose.

**⚠ This machine is stale.** Install cache is `mos/1.16.0-beta.11`
(`C:\Users\PC\.claude\plugins\cache\mindrian-marketplace\mos\1.16.0-beta.11`), which predates
both fixes. Hooks resolve `${CLAUDE_PLUGIN_ROOT}` to the **cache**, not to
`C:\Users\PC\dev\MindrianOS-Plugin`. `git checkout main` in the dev tree changes nothing.
Run `claude plugin update mos@mindrian-marketplace` and **restart the session** — MCP servers
load once at startup.

---

## 3. The backend question, settled

`lib/core/brain-client.cjs:24`

```js
const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://pws-brain-mcp.onrender.com';
```

Identical in the dev tree and in the installed cache. `MINDRIAN_BRAIN_URL` is not set on this
machine (`~/.mindrian.env` carries only `MINDRIAN_BRAIN_KEY`). Both `fetch` sites (`:215`, `:284`)
derive from that constant. The endpoint flip landed 2026-07-23 (`CHANGELOG.md:521`).

**So the plugin talks to Memgraph, and only to Memgraph.**

**But four of six tool descriptions still say otherwise** — in
`bin/mindrian-brain-mcp-client.cjs`:

| Tool | Line | The lie |
|---|---|---|
| `brain_ask` | `:72-87` | "Auto-routes **Pinecone/Neo4j** server-side" |
| `brain_schema` | `:105-114` | "Brain **Neo4j** schema" |
| `brain_search` | `:117-130` | "**Pinecone** with **Neo4j** fulltext fallback" |
| `brain_stats` | `:133-142` | "**Pinecone** index size" |

These strings are **always resident in every session**. During this audit they misled a
reader who was simultaneously holding a live probe of the real backend. They will mislead a
model choosing which tool to call. Fixing them is free and high-value.

Also stale and describing the retired Aura stack as if current: `mcp-server-brain/render.yaml`,
`mcp-server-brain/.env.example`, `mcp-server-brain/CLAUDE.md`, `.env.brain.template:10`.

---

## 4. The two client-side defects (fixed — recorded so the class is recognisable)

Both lived in **hooks**, not in the MCP server or client.

**A. PostToolUse envelope corruption** — `scripts/brain-response-sanitize-hook.cjs`,
registered on `hooks/hooks.json:338-346` with matcher
`mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*` — i.e. **all six tools**.

- Cache line 124: `updatedToolOutput: { text: ... }` — a **bare object** where the client
  expects an array of content blocks. This is the `e.reduce is not a function` crash.
- Cache line 84: reads `input.tool_response.text`. MCP results carry `.content[]`, never a bare
  `.text`, so the value was `''` on every live call and the hook **blanked the response** even
  where the shape survived.
- Fixed: dev `:135-146` (array) and `:92` (reads through `lib/core/brain-response-sanitize.cjs:232
  extractResponseText`). Commit `ec233d80`. `tests/test-245-brain-envelope-shape.cjs` — 55 assertions.

**B. PreToolUse egress false positive** — `scripts/part8-egress-guard-hook.cjs`, matcher at
`hooks/hooks.json:236-243`. Classifier `lib/core/part8-egress-guard.cjs`; the free-form path
(`:371-381`) requires a positive match against `METHODOLOGY_VOCAB` (`:75-91`), else
`{verdict:'ambiguous', class:'freeform_unmatched'}` → hook `exit 2`.

The cache vocabulary is 37 business-methodology tokens with **zero graph words** — no `count`,
`labels`, `schema`, `node`, `MATCH`. So `MATCH (n) RETURN count(n)` was gated.

Fixed by `1571c657` at `:86-88` (adds `labels, relationshipTypes, propertyKeys,
nodeTypeProperties, count, keys, schema`). The same commit widens `_isFreeFormTool` (`:315-320`)
to recognise `brain_search`, reversing the Phase 245 D-28 flag.

Verified live, both versions:
```
DEV  : {"verdict":"allow","class":"move_set"}
CACHE: {"verdict":"ambiguous","class":"freeform_unmatched"}
```

`brain_stats` / `brain_schema` passed the guard even in cache — the empty-payload branch
(`:358-360`) allows `{}`. That is why those two reached the broken PostToolUse hook and produced
the visible crash while `brain_query` died earlier and silently.

**The class to remember:** both are hooks corrupting a working call. Neither is visible from
reading the MCP server or the client. When a tool "breaks", check the hook chain first.

---

## 5. THE OPEN BLOCKER — `brain_query` is not on the public surface

`src/http/app.mjs:36`

```js
return loopback || process.env.BRAIN_HTTP_ADMIN === 'allow';
```

`render.yaml:79` sets `BRAIN_HTTP_HOST=0.0.0.0` (non-loopback) and **never declares
`BRAIN_HTTP_ADMIN`**. So `computeAdminAllowed()` → false, and `registerAdminTools()` returns `[]`
without registering anything (`src/http/admin-tools.mjs:303-306`).

`brain_query` and `brain_write` are both admin-tier (`admin-tools.mjs:345`, `:362`).
**Neither exists over HTTPS.** Over stdio they are present (`server.mjs:829-833` grants `brain:admin`).

**Empirical corroboration.** On `pws-brain-mcp`, 2026-08-07/08:
- HTTP 200: **119**
- HTTP 403: **481**
- HTTP 401: 7 (unauthenticated probes return 401, so the 403s are *authenticated-and-forbidden*)

Confirmed by direct probe: no-auth and bad-key both return **401**, not 403.

**Downstream, already documented and still open:**
`.planning/debug/brain-raw-cypher-admin-gate-starves-baseline.md` (status: investigating,
`files_changed: none yet`). Non-admin `brain_query` returns a **refusal string**, not an error.
`scripts/fetch-brain-baseline.cjs:115-143` recognises only three shapes (null / `{error}` / array),
so it writes `framework_count: 0` and prints "Fetched 0 frameworks". **`/mos:whitespace` reports
0 zones by construction.**

Blast radius named in that doc (`:110-121`): `brain-router.cjs`, `brain-derivation.cjs`,
`rs-chain-feeder.cjs`, `rs-experts-command.cjs`, `rs-explain-command.cjs`,
`rs-thesis-command.cjs`, `fetch-brain-baseline.cjs`.

⚠ **That RCA was written against the Aura backend and has never been re-verified against
Memgraph.** Re-verify before acting on it.

**The decision this forces:** setting `BRAIN_HTTP_ADMIN=allow` exposes raw Cypher on a public
key. The alternative is a **bounded read tier** — moat-capped Cypher without admin. That is a
security design call, not a toggle. It is the thing blocking the whole atomic-query
architecture the design doc rests on.

---

## 6. Tool surface — it is 26, not 19

The `19` in `docs/2026-08-07-brain-for-harness-design.md` (lines 44, 273) comes from three stale
comments at `src/server.mjs:92`, `:192`, `:790`. Measured: **26 registered tools — 23 public HTTP,
3 admin.**

**Context cost** (description literals only; `inputSchema` JSON also serialises, so these are floors):

- All 26: **6,848 chars**
- Public HTTP surface: **5,940 chars**
- The four "keeper" tools that live there (`brain_ask`, `brain_search`, `brain_schema`, `brain_stats`): 1,167
- **The other 19 public tools: 4,773 chars — 80% of the public budget**
- For contrast, the six descriptions the plugin ships: ~650 chars

**Migration difficulty:**
- **17 tools are pure Cypher** → move verbatim into `references/cypher-patterns.md`. No server code.
  Sources: `src/brain-tools.mjs`, `src/arm1-orchestrator.mjs:52-269`.
- **The MAGE trio** (`find_bottlenecks`, `rank_influence`, `find_whitespace`) — the algorithm call is
  trivial; **the projection is the load-bearing knowledge**. `brain-tools.mjs:74-108` documents that
  un-projected pagerank returns document chunks: *"valid call, real number, no error, useless answer."*
  The 8-label `METHODOLOGY_LABELS` allowlist (`:109-112`) plus the both-endpoints predicate **must
  move with the query** or the agent silently reproduces the drowning bug.
  ⚠ Untested: whether `boundReadStatement()` (`admin-tools.mjs:128-146`) can legally wrap a
  `CALL betweenness_centrality.get(g) YIELD …` body. Check live before relying on it.
- **`search` vs `brain_search`**: `brain_search` drops the bounded FEEDS_INTO expansion
  (`server.mjs:332-341`). Reconstructible as a second `brain_query` keyed on returned `_id`s.
  Note `server.mjs:326-330`: a literal `chunk-[:FEEDS_INTO]` returns 0 rows for every query —
  the `MENTIONS` hop is mandatory. Put that in the reference verbatim.
- **Three curated ops ride inside `brain_ask`** — `list_frameworks`, `framework_edges`,
  `framework_chain_slice` (`src/brain-router.mjs:78`, `:108-140`), consumed by
  `interpret-whitespace.cjs` with exact field-name coupling. They survive only while `brain_ask` does.
- **`brain_ask_anything` needs server code** (LLM synthesis, `src/llm-provider.mjs`) — or is
  redundant, since the caller is itself an LLM holding `brain_query` output.
- `find_commands_for_problem_type` (#3) and `commands_for_problem_type` (#18) are **duplicates**.

---

## 7. Moat caps — what is actually enforced

`readMoatCaps()`, `src/contracts/moat-guard.mjs:73-79`.

| Cap | Default | Render | Enforced where |
|---|---|---|---|
| `BRAIN_CYPHER_MAX_ROWS` | 1000 | 1000 | pre-exec reject + outer-LIMIT injection + post-read truncation |
| `BRAIN_CYPHER_MAX_BYTES` | 1e6 | 1e6 | **post-read only** |
| `BRAIN_CYPHER_TIMEOUT_MS` | 5000 | **45000** | passed to executor |
| query memory | 256 MB | unset | passed to executor |
| rate limit | 120/key/min | unset | `app.mjs:272` |
| body size | 256 kb | unset | `app.mjs:271` |

**Three problems.**

1. **`BRAIN_CYPHER_MAX_ESTIMATED_ROWS` is dead config.** Set in `render.yaml:128-129`,
   structurally asserted by `tests/render-yaml.test.mjs:57`, **read by no source file**. The design
   doc (line 65) cites it as an active cap. Related: `enforceMoat`'s `estimatedBytes` param
   (`moat-guard.mjs:104-106`) is passed by no caller in `src/` — so **the byte cap has no
   pre-execution arm at all**.
2. **`BRAIN_CYPHER_TIMEOUT_MS=45000` cuts both ways.** One variable feeds
   `readMoatCaps().timeoutMs` (client-requestable cap, default 5 s) **and** `readCallTimeoutMs()`
   (internal wall clock, default 60 s — `moat-guard.mjs:38-40`). Setting 45000 **widens the client
   cap 9×** while **tightening the internal MAGE/e5 bound from 60 s to 45 s**. `render.yaml:130-135`
   documents only the second effect.
3. **`text2cypher` is a loaded gun.** `src/text2cypher.mjs:199` executes **model-authored arbitrary
   Cypher on a public read key** — no `enforceMoat`, no `boundReadStatement`, no row cap, no byte cap.
   The only guards are `rejectsWriteQuery` (`:34-37`) and the read-only executor; row bounding is a
   *prompt instruction* (`:110`), not a guard. It is inert **only** because `render.yaml` declares no
   `OLLAMA_BASE_URL` (`:177-181` throws). **One env var from live.** Delete it or hard-gate it.

Also note: all 23 public read tools run with **no `enforceMoat` at all** (`server.mjs:655-657`,
stated outright). Their bounds are hardcoded per-tool literals. Defensible — no raw Cypher crosses —
but "the caps" govern roughly 3 of 26 tools.

---

## 8. Vector indexes — the design doc's claim is *partly refuted*

**A dimension guard does exist**: `assertIndexReady()` reads the live index dimension and throws on
mismatch (`src/server.mjs:125-128`). Vector length is validated without truncating or padding
(`query-embedder.mjs:189-193`, `:230-234`). `assertE5Identity` gates model/dim/prefix
(`:199`, `:241`, `ingest/embed-or-quarantine.mjs:57`).

**Three real holes remain:**

1. `INDEX_DIMS` (`server.mjs:104`) covers **2 of 9** indexes. The guard is `if (expected && …)` —
   for the other 7, `expected` is `undefined` and the check is **skipped silently**. Latent, not live:
   `publicSearchIndexSchema` is a one-value enum (`server.mjs:111`).
   *(Note: `0e79704` extracted `assertSearchIndexRegistered` into `src/contracts/e5-identity.mjs` to
   fail closed on an unregistered index — verify whether this hole is now closed.)*
2. **Two callers bypass `assertIndexReady` entirely**: `src/arm2-expansion.mjs:137-141` and
   `src/community-summary.mjs:53-54`. **arm-2 is where `brain_ask` routes thematic questions**
   (`brain-router.mjs:19-24`) — so the most-used NL entry point does ANN search with no index
   precheck, and a wrong-space index returns 0 rows indistinguishable from "no data".
3. **The write path never reads the index dimension.** `ingest/embed-or-quarantine.mjs:60-70` relies
   on Memgraph embed-on-insert. The vector is validated at 1024; the index is never consulted at
   write time. This is the one place with genuinely no guard.

**Right fix:** hoist a precheck into `scopedVectorSearch` (`graph-client.mjs:208`) — the single seam
all four callers share — plus a write-time index-config read. Not a new check where one exists.

---

## 9. Live measurements (2026-08-07 → 08, hourly)

These answer the design doc's §9 "measure before upgrading".

| | `pws-brain-db` | `pws-brain-mcp` |
|---|---|---|
| Memory | **270 MB / 2 GB (13%)** | **2.08 GB / 4 GB (52%)** |
| CPU | 0.00045 / 1.0 core (**0.045%**), flat 24 h | ~0.0001, spikes to 0.022 |

**Conclusion: the Memgraph 3.8 single-store vector upgrade would optimise 80% of something that
is already 13% full. Do not do it.** The 12,401 × 1024-dim vectors are a non-issue at this scale.
The 2.08 GB on the MCP service is the resident e5 sidecar — that, not the graph, is the only
reason the Pro plan exists.

---

## 10. Graph content

From the deployed commit `3e057e20`: **28,325 nodes · 23,014 relationships · 181 frameworks ·
9 vector indexes.** Curated retrieval index is `mindrian_methodology_vec`, 1024-dim, 12,401 vectors.
Embedder: `multilingual-e5-large` via local sidecar `scripts/e5_embed.py`, asymmetric prefixes
`query: ` / `passage: ` (`src/query-embedder.mjs:47-49`).

A second index `mindrian_methodology_vec_openai` (1536) is named in code (`server.mjs:103-104`) and
**retired** from the caller-selectable surface (`:111`). `0e79704` added
`tests/tool-description-honesty.test.mjs` specifically because the description promised that index
while the schema `z.enum([E5_INDEX])` rejects it.

---

## 11. Memory-architecture finding (from the langtalks corpus)

Source: SDS 985, Richmond Alake, *The Four Types of Memory Every AI Agent Needs* — the only episode
in the 44-source corpus discussing MCP and agent memory together. Full transcript at
`langtalks-graph-expert/sources/research/markdown/url-https-www-superdatascience-com-podcast-s.md`.

**The category error.** MindrianOS names three "memory layers" — within-session / across-session /
cross-room. That is a **scope** axis. Alake's four types — episodic, procedural, semantic, working —
are a **content-kind** axis. They are orthogonal and cannot be stacked. Naming yours a "layer trio"
invites reading them as peers of his four.

Re-cut on the right axis:

| Alake type | Discriminator (sourced) | Home in MindrianOS |
|---|---|---|
| Working | "the context window of the LLM" | within-session ✔ clean |
| Episodic | carries a timestamp you retrieve it by | room.db (meetings, decisions) ✔ clean |
| Semantic | a fact or association, no episode, no procedure | **the Brain** ✔ strongest fit — he explicitly endorses graph-store-for-semantic-knowledge |
| **Procedural** | an instruction for HOW to run a task — "the SOPs for agents" | **NOTHING. This is the gap.** |

**Procedural memory has no home.** The 181 Frameworks are *taught* content in the Brain; the
runbooks live as code and prose. Nothing holds "how this navigator, in this room, actually runs a
play." Alake names the exact failure: *"rather than giving the agent a hundred skills or MD file
within a context, we can just retrieve the actual skills that we need at the time, which allows you
to start to scale."* With 181 Frameworks and no procedural retrieval layer, the only options are
load-everything or hand-pick. **This is the same wall the design doc's §8 skill-contract work is
approaching from the other side.**

Secondary: **room.db is doing double duty** — claims are semantic, contradictions are
conflict-resolution *output*, transcripts are episodic, all in one store with one edge vocabulary
and no way to tell a timestamped episode from a timeless claim at retrieval.

Secondary: **the chokepoint is append-only** — an admission path with no eviction path. Alake lists
forgetting as first-class alongside store and retrieve, but never says *what* to forget. Treat as a
named obligation, not an instruction.

**Two disciplines.** He calls multi-database an **anti-pattern** — but on cognitive-load grounds,
about gluing data *types*, not about a trust boundary. **Do not cite that against Part 8.** And on
Part 8 itself he says nothing: privacy-partitioned memory is NOT COVERED. Do not cite him either way.

---

## 12. Test prompt — corrected

Run in a **fresh session** after `claude plugin update mos@mindrian-marketplace` and a restart.
MCP servers load once at startup.

> Check whether the Brain is actually reachable, and report exactly what you observe.
>
> 1. Call `brain_stats`. Report the raw result verbatim.
>    **PASS:** backend `"memgraph"`, `totalRecordCount` ≈ 28,325, `relationshipCount` ≈ 23,014,
>    a `vectorIndexes` array.
>    **FAIL** `e.reduce is not a function` → the sanitize-hook fix did not reach this machine.
>    Confirm the plugin update ran and that the session was restarted.
>
> 2. In that payload look for `vectorIndexSpaces`.
>    **Expected present** — the field exists on brain `main` at `src/server.mjs:784`, and Render
>    `pws-brain-mcp` is live on that commit (`0e79704`, deployed 2026-08-09 09:32 UTC).
>    Report `e5Queryable` (expect exactly `["mindrian_methodology_vec"]`) and the number of
>    `foreignSpace` entries (expect 8).
>    **If absent:** do NOT go check Render — the deploy is already confirmed. The cause is elsewhere.
>
> 3. Call `brain_schema`. **PASS:** node labels and relationship types.
>    **FAIL** with the reduce error → only `brain_stats` was fixed, which should be impossible.
>
> 4. Call `brain_search` with `"jobs to be done framework"`. **PASS:** semantic hits.
>    **FAIL** "may leak / blocked" → the Part 8 egress fix did not land. That query is a generic
>    framework name and must be allowed.
>
> 5. Call `brain_query` with `MATCH (f:Framework) RETURN count(f) AS frameworks`.
>    **PASS:** a number, expect ≈ 181.
>    **FAIL:** an error.
>    **BLOCKED:** any refusal text mentioning admin, or the tool not being found. **This is the
>    expected outcome and it is NOT a plugin defect** — `brain_query` is admin-tier and
>    `computeAdminAllowed()` (`src/http/app.mjs:36`) returns false on Render's non-loopback bind
>    because `BRAIN_HTTP_ADMIN` is never declared. Quote the refusal verbatim and stop. Do not go
>    looking in the plugin repo.
>
> Do not fix anything. Do not retry more than once per tool. Report each of the five as
> PASS / FAIL / BLOCKED with actual output, then state plainly whether the Brain is usable from
> this harness.

**Why step 5 needed a third outcome:** the gate returns a *refusal string*, not an error. Framed as
"PASS: a number", a tester seeing prose logs something ambiguous and — worse — attributes it to the
plugin, which is the wrong repo. Same misdiagnosis risk step 2 was written to prevent.

---

## 13. Open decisions

1. **`brain_query` on the public surface.** `BRAIN_HTTP_ADMIN=allow` (exposes raw Cypher on a public
   key) vs. a bounded moat-capped read tier vs. leaving it stdio-only and reworking the seven
   downstream callers. **Blocks the atomic-query architecture. Nothing else is worth doing first.**
2. **Suspend `mindrian-brain`?** Nothing calls it. Cheapest reversible win. Confirm no external
   consumer holds a key against it before suspending.
3. **The 19 → skill migration.** Depends on (1). 4,773 chars of always-resident context recovered.
4. **`text2cypher`** — delete, or hard-gate behind an explicit admin check.
5. **Procedural memory** — does it get a home, and where? Largest architectural question here.
6. **Eval set.** The design doc's own last open question. Note the finding recorded in `0ffbdce`:
   `nlAnswerAccuracy` measures free-text `brainAsk`, a path production barely uses; the
   alphabetical-slice bug lived on the *real* path and was found by inspection because no metric
   covered it.

---

## 14. Reading order

1. `docs/2026-08-07-brain-for-harness-design.md` — the langtalks-grounded design. Carries a
   PARTIALLY SUPERSEDED banner as of `0ffbdce`; its research holds, its framing treats the Brain as a
   Q&A surface and predates the "Brain is an armory, sensors are the tripwire" finding.
   **Correct its `19` to `26` and drop `BRAIN_CYPHER_MAX_ESTIMATED_ROWS` from §2.**
2. `.planning/debug/brain-raw-cypher-admin-gate-starves-baseline.md` — open, unfixed, and the
   RCA behind §5. Re-verify against Memgraph.
3. `.planning/debug/brain-post-fix-qa.md` — resolved, but its meta-finding
   (`:162-166`) names this exact recurring trap: *"source-of-truth mismatch between the deployed
   wire and the local source the auditor reads."* Filed as `stale-install-cache-audit-anti-pattern.md`.
   **It happened again here** — and worse, because the fix also had not been merged.

---

## 15. Traps that already caught someone in this session

- **Tool descriptions are read by models.** Four descriptions naming a retired backend fooled a
  reader holding a live probe of the real one.
- **Hooks corrupt working calls invisibly.** Neither defect in §4 is visible from the MCP server or
  the client. Check the hook chain first.
- **The install cache is the running code.** Not the dev tree, not `main`.
- **Stale in-code comments become quoted facts.** `19` propagated from three comments into a design
  doc and then into an audit brief.
- **A local checkout can be behind the deploy.** During this audit the working tree still showed the
  alphabetical-slice bug that production had already fixed.
