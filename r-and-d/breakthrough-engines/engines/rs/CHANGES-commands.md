# CHANGES-commands.md (slice a8: rs-experts, rs-explain, rs-fetch, rs-thesis)

Scope: the 19 files in `_baseline/assignments/a8-rs-commands.txt`. Originals are in `_baseline/orig/`; line references below are to those. `rs/shared/*` was not touched.

Run all tests (62 tests, Node 22, no network, nothing written outside the OS temp dir):

    node --test rs/_tests/commands/test-*.cjs      # run from package-2026/

Result of the last run: tests 62, pass 62, fail 0. Per file: academic 11, patents 5, industry 8, experts 8, mapper 6, projection 7, thesis generator 5, command scripts 12.

Test method. The modules depend on files that are not in this slice (egress primitives, lazygraph, Brain client, refusal rail, engine). Tests stage the shipped files into a temp tree with HAND-MADE stubs (`rs/_tests/commands/stubs/`, each labelled as a stub). All provider payloads in the tests (OpenAlex, arXiv Atom, PubMed, Scopus, IEEE, Springer, Google Patents JSON-LD, USPTO, Tavily) are hand-written to match the documented shapes; none were recorded from the live services. `global.fetch` is replaced per test; time and sleep are injected.

Summary: 19 files changed: 15 improved, 4 minor fixes, 0 unchanged.

## Bugs found in the ORIGINALS (user should know)

1. `rs-fetcher-experts.cjs` returned an empty expert list for real fetcher output. `dedupExperts` only accepted author OBJECTS (L140) and `paper.citationCount` (L174), but `rs-fetcher-academic.cjs` emits authors as plain strings and `cited_by_count`. Every string author was dropped. (Regression test: `test-fetcher-experts.cjs`, first test.) Unless the engine adapts papers before calling it (rs/shared, not visible here), the whole expert pipeline ran on nothing.
2. `rs-expert-mapper.cjs` `MERGE_AUTHOR_CYPHER` (L118-128) ends `WITH a WHERE $institution IS NOT NULL MERGE ... RETURN`. For an expert with no institution the WHERE removes the row, so the merge returns zero records and the author is counted as `missed` although the node was just created. Verified only statically and with a fake driver; the Cypher was not run against Neo4j.
3. All four command scripts called `process.exit(0)` immediately after writing `--json` output. On Linux with a pipe the output was cut at 65536 bytes (reproduced: a 6 MB bundle through `| wc -c` gave 65536 with the original and 6291558 with the new code). `--json > file` was unaffected.
4. `rs-thesis-generator.cjs` used `x in OBJECT` (L147, L159). `classification: 'toString'` (or `constructor`, `hasOwnProperty`, `__proto__`) passed validation and the thesis text contained the source of a native function. Reproduced against the original in `test-thesis-generator.cjs`.
5. `rs-explain-command.cjs` Cypher leg (L123-125) calls `brainClient.query()` with `cypher_params` that can carry text from the user's question. `rs-experts-command.cjs` L8-21 and `rs-thesis-command.cjs` L8-20 document that this call routes to the REMOTE Brain and removed it for exactly that reason. NOT fixed (changing the default could alter behaviour that existing tests may pin; the script itself cites `lib/memory/test-rs-explain-command.cjs`); mitigated with `--tier tier0` and `--no-cypher` and flagged in the command text. Needs a decision from the owner.
6. `rs-fetcher-academic.cjs` audited queries lazily (L591): an adversarial query in position N was only rejected after queries 0..N-1 had already been sent to OpenAlex. (Patents and industry already had the pre-flight loop.)
7. Unquoted multi-word topics: the CLI kept only the first word and silently dropped the rest (`rs-fetch quantum brain imaging` ran on "quantum"). Flags missing a value (`--stage` last) or unknown `--flags` became the topic.
8. `--limit` in `rs-experts-command.cjs` was parsed but never used (L249 calls `resolveExpertTier(args.topic, {})`).
9. `rs-fetch-command.cjs` printed `Phase 1.5 Fetchers  OK` unconditionally (L99) even when every source failed.
10. `rs-thesis-command.cjs`: `--tier tier1` was silently treated as tier0 although the header promised a note; help text advertised an Aura Tier 1 path that the file removed; "not found" said "in either backend".
11. `commands/rs-thesis.md` and the skill described an Aura Tier 1 Cypher path that the script no longer has. `commands/rs-experts.md` said both that every run returns `AURA_TRANSPORT_ABSENT` and that Tier 0 "resolves the whole expert network from room.db"; the second is not true of the command.

## Could not verify

- Any live network behaviour: OpenAlex `select`/`mailto`, arXiv Atom edge cases, NCBI `tool`/`email` params, Elsevier accepting `X-ELS-APIKey`, IEEE and Springer key params, Tavily accepting `Authorization: Bearer` (the body still carries `api_key`), Google Patents page structure.
- The USPTO endpoint (`api.uspto.gov/ds-api/oa_actions/v1/records`). The path says Office Actions, not patent search, and the ds-api host is believed retired. Unchanged; a failure appears as `api_error` telemetry. Treat the `uspto` source as unproven.
- The Google Patents HTML path scrapes a search page that is normally rendered client-side; it may return no JSON-LD at all. Unchanged behaviour, now switchable off (`opts.disableScraping` or `RS_PATENTS_NO_SCRAPE=1`). Whether it is acceptable under Google's terms is the operator's call.
- The new Cypher (FOREACH, `LIMIT $limit`) against a real Neo4j/Aura.
- The real `FORBIDDEN_PATTERNS`, real telemetry ledger (`~/.mindrian`), real `lazygraph-ops`, `brain-client`, `refusal-messaging`, `rs-discovery-engine`, `rs-nl-to-query`, `rs-query-to-text`: all stubbed. The existing suites for these modules (`lib/memory/test-rs-*.cjs`, "17-scenario" fixtures) are not in this slice and were not run.
- Windows behaviour. No path logic changed; scripts still use `path.join`.

## Cross-cutting changes in the three fetchers

Same helper block in each file (kept per file so each stays drop-in): bounded retry (default 2) on timeout, network error and 429/502/503/504 with `Retry-After`, deterministic backoff (no jitter), cap 15 s; per-source minimum request interval; timeout now covers the response body (`requestWithRetry` passes one AbortController to the single `fetchWithTimeout` call site); only the final outcome is written to the telemetry ledger, so retries do not burn the 24 h budget; `redactUrl`. Options: `maxRetries` (0 restores one attempt), `minIntervalMs` (0 disables pacing), `sleep`, `now`, `timeoutMs`. Risk for all three: any caller or suite that mocks `fetch` to return 429/503 and expects exactly one call must pass `maxRetries: 0, minIntervalMs: 0`; arXiv now waits 3 s between consecutive requests in one process.

## Per-file

### rs/rs-fetch/lib/core/rs-fetcher-academic.cjs
- Status: improved.
- Wrong: scopus key in the URL (L166-170), ieee and nature keys in the URL (L172-183); queries audited lazily (L591); budget checked once per source (L575-585) so a long query list could exceed it; body read outside the timeout (L200-214, L660); no retry or pacing (L628-654); dedupe only by DOI or title+author, DOI only stripped of two prefixes (L282-299), arXiv records never carried a DOI so a preprint and its journal version both survived; arXiv parser did not decode entities, left newlines in titles, treated the API error entry as a paper (L358-395); PubMed records had a fake title and empty abstract with nothing marking them (L397-413); no provenance beyond `fetched_at`.
- Changed: provenance on every record (`source_id`, `source_url`, `retrieved_at`, `retrieval_query`, `provenance{}`) and an envelope `provenance` block (tool, time, queries, sources attempted, parameters, dedupe counts); `normalizeDoi`, `normalizeArxivId`, multi-key dedupe (DOI, arXiv id, normalised title of 20+ chars) with merge into `also_found_in` and back-fill; arXiv parser fixes plus `arxiv_id`, `doi` from `arxiv:doi`, `published`; PubMed `metadata_only: true`; scopus key moved to the `X-ELS-APIKey` header; `built.safe_url` with credentials redacted (ieee/nature keys still ride in the URL because their APIs take them there); NCBI `tool` and optional `NCBI_EMAIL`; pre-flight audit of all queries; per-request budget; duplicate queries collapsed; blank-only queries rejected; the shared retry/pacing block. arXiv pacing is 3 s per its API terms.
- Risk: low to needs-check (see cross-cutting; extra keys on records; scopus header change; more records merge).
- Verified: `test-fetcher-academic.cjs`, 11 tests pass (URL building, key placement, parsers on hand-made payloads, dedupe, retry/Retry-After, timeout on body read, budget, pacing, provenance, secret absent from output).

### rs/rs-fetch/lib/core/rs-fetcher-patents.cjs
- Status: improved.
- Wrong: patent ids compared as raw uppercase strings (L196-216) so "US 7,654,321 B2" and "US7654321" were two patents; JSON-LD regex matched only the bare `<script type="application/ld+json">` tag and a single object (L244); no retry/pacing, per-source budget, body outside timeout (L395-491); no provenance; unverified USPTO endpoint and scraping path undisclosed in the code.
- Changed: `normalizePatentId`, `patentIdentity` (kind code ignored for identity), dedupe with `also_found_in` and back-fill; tolerant JSON-LD (attributes, arrays, `@graph`); provenance fields and envelope block; `opts.disableScraping` / `RS_PATENTS_NO_SCRAPE=1`; shared retry/pacing; per-request budget; header comment documents the unverified USPTO endpoint.
- Risk: low.
- Verified: `test-fetcher-patents.cjs`, 5 tests pass.

### rs/rs-fetch/lib/core/rs-fetcher-industry.cjs
- Status: improved.
- Wrong: `extractCompany` took the second-level domain, so github.com, medium.com, techcrunch.com gave "Github", "Medium", "Techcrunch" and acme.co.uk gave "Co" (L256-300); the `opts.tavily` seam wrapped the egress audit and the adapter call in one try/catch so adapter failures and violations were swallowed (L458-470), and `webSearch`/`cacheReader` errors were swallowed too (L646-654, L676-682); cache results looked fresh; dedupe ignored URLs (L357-375); no retry, pacing; per-source budget; no provenance; signals did not say they are unverified.
- Changed: `extractCompanyDetailed` (aggregator list, compound suffixes, title stop-words, `company_basis`), `normalizeUrl` and URL-aware dedupe, signal fields `source_id`, `retrieved_at`, `retrieval_query`, `company_basis`, `verification_status: 'unverified'`, `relevance_score`, `published_date`, `provenance{}`; seams: audit outside the adapter try, adapter errors reported as `adapter_error` telemetry; cache records `stale: true` with original `fetched_at`; envelope `provenance`; Bearer header added (body `api_key` kept); shared retry/pacing; per-request budget.
- Risk: low to needs-check (a company name changes for aggregator URLs, which was wrong before).
- Verified: `test-fetcher-industry.cjs`, 8 tests pass.

### rs/rs-experts/lib/core/rs-fetcher-experts.cjs
- Status: improved.
- Wrong: bug 1 above; `opts` ignored (L228-231); name-only identity merged homonyms and split "Jose Garcia" / "JOSE GARCIA." (L180); one paper repeated in the input counted twice; `h_index_estimate` over the retrieved papers presented as if it were the author's h-index; NaN citations could poison the sort (L124); `localeCompare` without a locale (L259); no evidence trail or confidence.
- Changed: string authors and `cited_by_count` accepted; per expert `confidence` (documented formula: ORCID 0.80 or name-only 0.45, plus repeat appearances up to 0.15, 0.05 for two sources, 0.03 for a known institution; caps 0.95 with ORCID and 0.70 without), `confidence_basis`, `identity_resolution`, `sources`, `evidence` (up to 5 papers: id, source, source id, URL, title, retrieval date, citations), `evidence_total`, `h_index_basis`; folded-name grouping and merge of a no-ORCID record into the single ORCID record; retracted papers excluded unless `includeRetracted`; `inferFirstAuthorInstitution` opt-in; non-enumerable `provenance` on the returned array (JSON shape unchanged); pinned locale. Evidence titles and URLs are scrubbed with the same forbidden-pattern check as other fields.
- Risk: low to needs-check (extra keys on each expert; counts differ when retracted papers or repeated papers were present; experts now appear where there were none).
- Verified: `test-fetcher-experts.cjs`, 8 tests pass, including the regression using real `parseOpenAlex` output.

### rs/rs-experts/lib/core/rs-expert-mapper.cjs
- Status: improved.
- Wrong: bug 2 above; `CO_AUTHORED_CYPHER` (L130-134) and the SQLite edge query (L283-288) unbounded; duplicate experts resolved twice; per-expert merge errors swallowed with no reason (L171-180); no confidence or evidence on resolved authors.
- Changed: FOREACH institution branch; each resolved author gets `resolution`, `resolution_confidence` (matched 0.95 with ORCID or 0.60 name-only; sqlite 0.90/0.55; newly created 0.40), overall `confidence` (min with the upstream value), `evidence` (match record plus upstream paper evidence passed through); `missed_details[]` with reasons; duplicate collapse (`duplicates_collapsed`) after the Layer 1 audit has seen every input; bounded edges (`opts.edgeLimit`, default 5000) and `citation_edges_truncated`; `provenance`.
- Risk: needs-check: the Cypher change and the new `limit` parameter on the co-author query must be run once against a real Aura; mock drivers that assert the params object `{}` will see `{limit: n}`.
- Verified: `test-expert-mapper.cjs`, 6 tests pass (fake driver and fake SQLite handle; Cypher not executed).

### rs/rs-experts/lib/core/rs-expert-brain-projection.cjs
- Status: improved (contract untouched).
- Wrong: person-token scan split on `[^a-z0-9]` (L92) so a name in Hebrew, Cyrillic or with accents produced no tokens beyond the whole string; inbound handles were not shape-checked (L194-200); a degraded projection was silent (returns `[]` for 8 different reasons); `opts.limit` unclamped.
- Changed: Unicode-aware tokenisation (2-char minimum for non-ASCII tokens), `display_name` objects, inbound rejection of `@`, URLs, control characters and markup, limit clamped 1..200, new `projectExpertHandlesDetailed` returning `degraded_reason`, counts and guard verdict (never person bytes); `projectExpertHandles` is a wrapper with the same return type.
- Risk: low. A handle containing `@` or `http` that used to pass is now dropped.
- Verified: `test-expert-brain-projection.cjs`, 7 tests pass.

### rs/rs-thesis/lib/core/rs-thesis-generator.cjs
- Status: improved.
- Wrong: bug 4 above; the output was a bare template sentence with no way to carry evidence or confidence.
- Changed: own-property lookups; `generateThesisRecord` (evidence trail with source id/URL/retrieval date/sentence, fallbacks used, second-signal and novelty-check status, confidence 0 to 1 with basis and label, provenance with an inputs hash, deterministic given `opts.now`). Template output of `generateThesis` is byte-identical to the original for 84 valid combinations plus the error envelopes (test).
- Risk: none for `generateThesis` callers.
- Verified: `test-thesis-generator.cjs`, 5 tests pass, compared against the pristine original.

### rs/rs-fetch/scripts/rs-fetch-command.cjs
- Status: improved.
- Wrong: items 3, 7, 9 above.
- Changed: strict `parseArgs` (adds `errors[]`, joins multi-word topics), `summarizeFetcherHealth` and a DEGRADED row with the list of silent sources, flushed `--json`.
- Risk: low: `parseArgs` result has one extra key; unknown options now exit 1 where they used to be absorbed.
- Verified: `test-command-scripts.cjs` (rs-fetch tests), including a 3 MB piped JSON.

### rs/rs-experts/scripts/rs-experts-command.cjs
- Status: improved.
- Wrong: items 3, 7, 8 above.
- Changed: `--limit` validated, passed to the transport as `{limit}` and enforced on returned rows; `Conf` column and a one-line meaning when rows carry confidence; JSON adds `topic`, `limit`, `generated_at`; flushed JSON. Still no live transport: the command never claims to have found experts.
- Risk: low.
- Verified: `test-command-scripts.cjs` (rs-experts tests).

### rs/rs-explain/scripts/rs-explain-command.cjs
- Status: improved.
- Wrong: items 3, 5, 7 above; translator SQL executed without checking it is read-only (L105-109); unbounded rows; `top_score` of 0 became null (L208); `--tier` accepted anything.
- Changed: `isReadOnlySql` gate (single SELECT/WITH, no write keywords; a false refusal is the safe failure), 500-row cap with `_truncated`, `query_results.sources[]` per graph (status, rows, time), a Graphs line in the transcript, `--no-cypher`, validated `--tier`, joined multi-word question, flushed JSON.
- Risk: low to needs-check: a legitimate query that contains a write keyword inside a string literal would now be refused; translator-generated SQL should use bound params.
- Verified: `test-command-scripts.cjs` (rs-explain tests).

### rs/rs-thesis/scripts/rs-thesis-command.cjs
- Status: improved.
- Wrong: items 3, 10 above; `SELECT` of fixed columns would hide any evidence or confidence columns; a missing `room.db` surfaced as "unhandled" exit 1.
- Changed: `SELECT *`, optional `confidence`, `confidence_basis`, `evidence`, `novelty_check_status` surfaced (null, never invented, when absent or unparseable), "no recorded evidence trail" note, tier1 note, validated args, `Local read failed` exit 2, provenance in JSON, accurate help text, flushed JSON.
- Risk: low. A read failure is now exit 2 instead of 1.
- Verified: `test-command-scripts.cjs` (rs-thesis tests).

### rs/rs-fetch/commands/rs-fetch.md and rs/rs-fetch/skills/rs-fetch/SKILL.md
- Status: minor fixes (body identical in both files; frontmatter untouched).
- Wrong: no stated inputs/outputs/failure/stop; pause shown as an error pattern although it exits 0; nothing about provenance, unverified signals, DEGRADED or source behaviour.
- Changed: sections Inputs, Outputs, Evidence and provenance, Source behaviour, Failure behaviour (table), When to stop; error patterns reduced to the real ones. Length is slightly larger than before because required sections were added.
- Risk: none.
- Verified: frontmatter byte-identical to the original; no em-dashes.

### rs/rs-experts/commands/rs-experts.md and rs/rs-experts/skills/rs-experts/SKILL.md
- Status: improved (body identical in both; frontmatter untouched).
- Wrong: item 11; long history notes (BUG 2, Phase numbers, a sentence correcting an earlier sentence) mixed into the instructions; Theo label-count aside.
- Changed: leads with what works today (AURA_TRANSPORT_ABSENT), four named outcomes, inputs/outputs, where expert records and their confidence come from, Brain projection summary, failure table, stop rule. About 17% shorter.
- Risk: none.

### rs/rs-explain/commands/rs-explain.md and rs/rs-explain/skills/rs-explain/SKILL.md
- Status: minor fixes (body identical in both; frontmatter untouched).
- Changed: inputs/outputs, `sources[]`, "reading the answer honestly", the open Cypher/remote-Brain risk, `--no-cypher`, read-only SQL and row cap, failure table, stop rule. Seam table kept.
- Risk: none.

### rs/rs-thesis/commands/rs-thesis.md and rs/rs-thesis/skills/rs-thesis/SKILL.md
- Status: improved (body identical in both). `help_jtbd` in the frontmatter changed from "Compose the thesis statement..." to "Read back the thesis from a prior reverse salient discovery." (the command only reads); no other frontmatter change.
- Wrong: item 11 (Tier 1 Aura path described but removed), "Aura first" flow, `DEGRADED_NOTE` on a fallback that cannot happen.
- Changed: describes the real local-only read, the optional evidence columns, how a thesis and its confidence are produced, failure table, stop rule.
- Risk: none.
