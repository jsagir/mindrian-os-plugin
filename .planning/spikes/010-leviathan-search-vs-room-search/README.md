---
spike: 010
name: leviathan-search-vs-room-search
type: comparison
validates: "Given one real room (424 markdown files), when 10 questions are asked in natural language and as 1-2 keywords, then Leviathan returns the right artifact in the top 5 more often and with fewer tokens than room_search and the wiki flexsearch index; plus memory import, delivery shape"
verdict: PARTIAL
related: []
tags: [leviathan, search, memory, delivery, room_search, flexsearch]
---

# Spike 010: Leviathan vs room_search vs flexsearch

## What This Validates
Given the `rethinking-mindrianos` room (424 .md, 44 MB on disk, 4.8 MB of text), when ten
questions are asked, then which engine puts the right file in the top 5, at what token cost.
Read-only on the room and the plugin. Binary: Leviathan v0.2.0 aarch64-linux-gnu, sha256
verified against the release file. Everything else ran in this folder.

## Research
Read the Leviathan README, CHANGELOG, MEMORY.md, BENCHMARKS.md limitations and Cargo.toml.
Read `lib/mcp/tools/room.cjs` (room_search) and `lib/wiki/wiki-search.cjs` + `page-renderer.cjs`.
Correction to my first brief: room_search is NOT plain substring. It is a literal-phrase match
(the whole query, lower-cased) that is then ranked by term frequency and recency. That is why
a natural-language question finds nothing.

| Approach | What it does | Status |
|---|---|---|
| room_search | whole-query literal phrase, tf + recency rank, 500-file walk cap | shipped MCP tool |
| flexsearch (wiki) | forward-token index over `scanRoom` pages | shipped, wiki only |
| Leviathan | SQLite FTS5, BM25, OR across words | candidate |

## How to Run
```
node prep.cjs        # builds records.jsonl from the room (room content, not committed)
bin/.../leviathan index records.jsonl --index idx.db --id id --title title --text text --group section
node run.cjs         # writes results.json (all queries as events)
```

## What to Expect
`results.json`: summary table plus every query as an event. A re-run gave 0 rank differences.

## Observability
`results.json` is the forensic log: one event per engine per query (rank, tokens, ms, error).
Token figure is chars/4 for every engine, a proxy, not a tokenizer.

## Investigation Trail
1. First binary was x86_64; this machine is aarch64 -> "Exec format error". Re-fetched the arm64
   asset. Delivery lesson: the installer must pick the build by `uname -m`.
2. `scanRoom` returned `{pages, sections}` not a Map. Fixed in the runner. Side finding: the wiki
   scan is ONE level deep, so flexsearch indexed 61 of 424 files (nested research folders are
   invisible to it). That makes the flexsearch numbers a coverage result, not a ranking result.
3. Ran 10 questions x 2 forms x 3 engines. Repeated once: identical ranks.
4. Negative control (3 questions the room cannot answer). 5. Scoped search, upsert, delete.

## Results

| Form | Engine | top1 | top5 | zero-hit | median tokens | median ms |
|---|---|--:|--:|--:|--:|--:|
| natural question | room_search | 0 | 0 | 10 | 1 | 41-46 |
| natural question | flexsearch | 1 | 1 | 8 | 1 | 0.1 |
| natural question | **Leviathan** | **10** | **10** | 0 | 689 | 13-18 |
| 1-2 keywords | room_search | 4 | 7 | 2 | 458 | 44-58 |
| 1-2 keywords | flexsearch | 1 | 2 | 3 | 189 | 0.1 |
| 1-2 keywords | Leviathan | 6 | 8 | 0 | 599 | 11 |

- Natural-language questions are the decisive gap: room_search needs the exact phrase, so 0 of 10.
- On keywords the engines are close (top 5: 7 vs 8). Not a win worth a dependency by itself.
- Token cost is NOT lower here: Leviathan returns 5 cards at about 600-690 tokens; room_search
  keyword hits are about 460. The 245x figure in their README compares against grep over raw
  history, not against an already-capped tool.
- Negative control: Leviathan returns weak matches for unanswerable questions (11 to 19 hits,
  relevance 4 to 8) versus 14 to 17 for real hits. No "no answer" signal; a relevance floor would
  be needed or Larry would ground on junk.
- Index build: 0.1 s for 424 files (4.8 MB -> 9.4 MB). Upsert and delete worked and updated
  the count. Scoped search by section worked. Search about 10 ms.

### Memory (import of MEMORY.md)
- 127 entries read: 125 stored, 2 refused by the secret guard (entries that point to a key file).
- All 125 became kind `note` under one subject `Memory Index`, no keys, so 0 superseded. The
  supersession benefit needs keys authored on write; import alone does not deliver it.
- Recall: 8 of 8 questions put the expected entry first, at 650 to 2,200 characters per answer.
  The whole file is 22,070 characters (about 5,500 tokens by chars/4). Saving real, but the file
  is 128 lines today, under the 200-line truncation they target.
- Briefing: 5 of 125 memories, about 500 tokens, and it picked the first entries in file order,
  not the most relevant.

### Delivery facts
- Release has 5 builds (macOS arm64/x64, Linux arm64/x64, Windows x64), each about 3 MB packed,
  8 MB unpacked, with sha256 files. Dynamic: libc, libm, libgcc_s; needs GLIBC 2.34 (no Alpine/musl).
- No network, no writes outside the paths given. `~/.leviathan` never created; room unchanged.

## Caveats
- I wrote the questions after reading the target files, so word overlap favours any lexical engine.
- One room, one author, 10 cases. The README calls its own accuracy an upper bound; so is this.
- tokens are chars/4 for all engines.
