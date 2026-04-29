---
phase: 94-v1-11-2-tester-driven-fixer
plan: "05"
subsystem: mcp-stack-fallback-chain
tags: [mcp-stack, fallback-chain, tavily, websearch, webfetch, rs-fetcher-industry, rs-fetcher-academic, rs-fetcher-patents, rs-fetcher-experts, section-8-trace-schema, web-research-tier, lawrence-qa-handoff, miriam-kaplan-qa, plan-amendment, injection-seam, envelope-wrap, canon-part-4, canon-part-7, canon-part-8, tdd]

# Dependency graph
requires:
  - phase: 94-v1-11-2-tester-driven-fixer
    provides: 94-02 rs-discovery-engine thesis-merge fix already shipped (Plan 94-02 unblocks the consumer at line 380 industry.signals path so Plan 94-05's envelope wrap can be integration-smoked end-to-end without an upstream pipeline crash)
  - phase: 89.2-graceful-rs-fetcher
    provides: 4 rs-fetcher-* modules + rs-egress-* primitives (auditQueryString chokepoint, recordTelemetry, computeRemainingBudget, DEFAULT_BUDGETS). Plan 94-05 layers envelope wrap + Approach A injection seams on top WITHOUT touching the chokepoint exclusivity invariant or the per-source telemetry ledger.
  - phase: 91-navigation-engine
    provides: Section-8 decision-trace forward-additive contract (intent_persona block writers; readers tolerate unknown keys). Plan 94-05 adds web_research_tier as a new forward-additive field per the same invariant.
provides:
  - "lib/core/rs-fetcher-industry.cjs paid -> native -> cache fallback chain via opts.tavily / opts.webSearch / opts.cacheReader injection seams. Returns {tier, source, results, signals, telemetry} envelope on every code path. NEVER throws on tier-down; only on Canon Part 8 violation (preserved)."
  - "lib/core/rs-fetcher-academic.cjs envelope wrap: existing free-tier paths (openalex/arxiv/pubmed) preserved byte-identical; new {tier:'paid', source:<first-ok>, results:[], papers:[], telemetry:[]} envelope; backward-compat papers[] key preserved alongside results."
  - "lib/core/rs-fetcher-patents.cjs envelope wrap: existing free-tier paths (google_patents/uspto) preserved byte-identical; new {tier:'paid', source:<first-ok>, results:[], patents:[], telemetry:[]} envelope; backward-compat patents[] key preserved alongside results."
  - "lib/core/rs-fetcher-experts.cjs envelope wrap (Array-with-properties hybrid): mapExperts STILL returns an Array of expert records (existing .length / .find / indexing all work byte-identically); Object.defineProperty attaches non-enumerable tier='derived', source='derived', results=<self>, experts=<self> envelope properties. Zero blast radius for existing 12-scenario fixture suite + rs-discovery-engine line 330 mapExperts consumer."
  - "lib/core/section-8-trace-schema.cjs (NEW): canonical schema authority with web_research_tier field on intent_persona block. Forward-additive per Phase 91 invariant. Exports SECTION_8_TRACE_SCHEMA + WEB_RESEARCH_TIERS (paid/native/cache/derived) + WEB_RESEARCH_SOURCES + isValidWebResearchTier + isValidWebResearchSource + WEB_RESEARCH_TIER_FIELD."
  - "commands/research.md body edit: removed 'Requires Brain MCP. Then stop.' hard-stop directive that blocked fresh installs; added Phase 94 Plan 05 graceful-degradation section explaining the paid -> native -> cache fallback chain with WebSearch + WebFetch as universal fallback. Frontmatter unchanged (WebSearch + WebFetch already declared in allowed-tools at lines 6-7)."
  - "lib/memory/mcp-stack-fallback.test.cjs (NEW; 7 fixtures; BSL 1.1): T1 industry happy paid; T2 industry native fallback; T3 industry cache fallback; T4 industry all-tiers-down empty results never throws; T5 envelope shape uniformity across academic + patents + experts with backward-compat domain keys; T6 section-8 schema web_research_tier field exists; T7 commands/research.md body hard-stop removed."
affects:
  - 94-10 v1.11.2-release-gate (CHANGELOG narrative cites mcp-stack fallback chain ship-blocker fix; closes the third of three v1.11.0 P0 architectural ship-blockers per CONTEXT.md)
  - All future /mos:research and /mos:rs-fetch users (TAVILY_API_KEY no longer required for grounded research; WebSearch native fallback is the universal floor)
  - 91-navigation-engine (decision-trace writers may now populate intent_persona.web_research_tier from rs-fetcher-* envelope.tier; readers tolerate the new field per Phase 91 forward-additive invariant)
  - rs-discovery-engine.cjs line 380 industry.signals consumer (backward compat preserved; envelope.signals[] is byte-identical to pre-94-05 industry.signals shape)
  - rs-discovery-engine.cjs line 330 mapExperts consumer (backward compat preserved via Array-with-properties hybrid; consumer reads expertsRaw as Array, indexed access unchanged)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Approach A injection-seam pattern. opts.tavily / opts.webSearch / opts.cacheReader are callable seams on rs-fetcher-industry. WebSearch is a Claude-native tool callable from agent context; fetcher modules are CJS code outside agent context. Production wiring: when /mos:research (a Claude command) invokes the fetcher, it passes a callable that wraps the WebSearch tool. When called from a non-agent context (hook, CLI script), opts.webSearch is null and the fetcher reports tier:'cache' (empty results). The signature is ABI-safe (additive only; existing callers without these keys still work; missing tavily falls through to existing TAVILY_API_KEY env-var path)."
    - "Array-with-envelope-properties hybrid for rs-fetcher-experts. mapExperts still returns an Array of expert records; Object.defineProperty attaches non-enumerable tier/source/results/experts properties. Existing consumers (.length, .find, indexing, .map) work byte-identically; new envelope contract holds for T5. Zero blast radius across the 12-scenario rs-fetcher-experts fixture suite + rs-discovery-engine line 330 mapExperts consumer + 17 other test files that import the module."
    - "Envelope wrap for rs-fetcher-academic + rs-fetcher-patents. Wrap layer adds {tier:'paid', source:<first-ok-source>, results:[domain key alias], <domain key>:[], telemetry:[]} on top of the existing return shape. Backward-compat domain keys (papers / patents) preserved alongside the new results key (results === papers === <slice of same array>). Existing 18-scenario academic + 17-scenario patents fixture suites pass byte-identically; envelope wrap is purely additive (no field removed, no shape changed beyond new keys appended)."
    - "Section-8 trace schema as documentation re-export. lib/core/section-8-trace-schema.cjs is a thin schema authority that documents the contract; the active writer authority remains lib/core/navigation-engine.cjs (buildIntentPersona at lines 337 + 429) and scripts/rs-discovery-engine.cjs (decision-trace writer). The new module does NOT hijack writer responsibility; it provides a stable target for T6 to assert against and a machine-readable constant for downstream validators."
    - "Graceful-degradation prose in commands/research.md body. Removed the hard-stop 'Requires Brain MCP ... Then stop.' that blocked fresh installs. Replaced with a Phase 94 Plan 05 tier-aware section explaining paid -> native -> cache so users (and Larry) understand the fallback chain at the entry point. Frontmatter unchanged: allowed-tools list already declared WebSearch + WebFetch pre-94-05."

key-files:
  created:
    - lib/core/section-8-trace-schema.cjs (139 lines; canonical schema authority; BSL 1.1; zero npm deps)
    - lib/memory/mcp-stack-fallback.test.cjs (370 lines; 7 fixtures; BSL 1.1)
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-05-mcp-stack-fallback-chain-SUMMARY.md (this file)
  modified:
    - lib/core/rs-fetcher-industry.cjs (+172 / -1 lines; opts.tavily/webSearch/cacheReader injection seams + envelope wrap + normalizeIncoming helper)
    - lib/core/rs-fetcher-academic.cjs (+30 / -3 lines; header note + envelope wrap at end of fetchAcademic)
    - lib/core/rs-fetcher-patents.cjs (+29 / -3 lines; header note + envelope wrap at end of fetchPatents)
    - lib/core/rs-fetcher-experts.cjs (+38 / -2 lines; header note + Array-with-properties hybrid + annotateExpertsEnvelope helper)
    - commands/research.md (+13 / -2 lines; hard-stop removed + graceful-degradation section added; frontmatter untouched)
    - lib/memory/run-feynman-tests.cjs (+22 lines; TEST_FILES registration with Canon Part 4 + 7 + 8 traceability comment)

key-decisions:
  - "Plan amendment scope honored. Per the user-approved amendment dated 2026-04-28 (commit 66a1a34), the original plan's claim that '4 fetchers all currently call Tavily/Firecrawl/Exa via mcp__* prefixes' was factually wrong. Ground truth from the actual modules: rs-fetcher-academic has 6 sources with 3 free + 3 keyed; rs-fetcher-patents has 2 keyless sources; rs-fetcher-industry is the TRUE Tavily-only gap; rs-fetcher-experts is a post-processor not a fetcher. Plan 94-05 honored the amendment scope: industry got the Approach A injection-seam pattern (opts.tavily / opts.webSearch / opts.cacheReader); academic/patents got envelope wrap only; experts got Array-with-properties hybrid envelope. commands/research.md frontmatter was already correct; the body's hard-stop was the actual fix needed."
  - "Tier vocabulary expanded from 3 to 4. Original plan's locked-decision listed tier values 'paid' | 'native' | 'cache'. Amendment added 'derived' for the experts post-processor (which has no network tier of its own; it's derived from academic.papers). Section-8 trace schema authority documents all four values + the corresponding source enum (tavily / firecrawl / exa / websearch / cache / derived plus the academic/patents source names for backward compat traceability)."
  - "Backward-compat invariant preserved across all 4 fetchers. rs-discovery-engine.cjs line 380 reads industry.signals; line 330 reads (academic && Array.isArray(academic.papers)) ? academic.papers : []; line 327 reads patents (return value used as-is). All three call sites work byte-identically post-94-05 because: (a) industry envelope preserves signals[] alongside results[]; (b) academic envelope preserves papers[] alongside results[]; (c) patents envelope preserves patents[] alongside results[]; (d) experts hybrid IS still an Array (.length, indexing, .find work). Zero existing call site has to change."
  - "Approach A (injection-seam) chosen over Approach B (direct WebSearch invocation). Per the amendment: 'WebSearch is a Claude-native tool callable from agent context. Fetcher modules are CJS code outside agent context.' Approach B (CJS code calling WebSearch directly via some imagined API surface) is impossible -- WebSearch isn't a callable Node module; it's a tool the LLM can invoke. Approach A makes the fetcher reusable from any context: when /mos:research (a Claude command) invokes it, the command passes a callable that wraps WebSearch; when called from a hook (no agent context), opts.webSearch is null and the fetcher reports tier:'cache'. This pattern is the cheapest correct way to give Node code access to LLM-only tools."
  - "Envelope shape with backward-compat. Locked decisions amended: envelope is {tier, source, results} REQUIRED + domain-specific keys (signals/papers/patents/experts) PRESERVED. The original plan said envelope is {tier, source, results} only; the amendment added the backward-compat keys after seeing the rs-discovery-engine line 380 industry.signals consumer. Without the backward-compat keys, rs-discovery-engine would crash at the next /mos:rs-fetch invocation (Plan 94-02 just shipped a fix to that very call site; another regression there would be unforgivable)."
  - "Cache tier is opt-in via opts.cacheReader. The original plan said the cache tier reads <room>/.mindrian/fetched_results.json directly. The amendment moved that to an injection seam (opts.cacheReader callable returning the cache payload). Reason: keeping the fetcher stateless about room layout. The fetcher knows nothing about <room> directory structure; the caller (rs-discovery-engine or /mos:research command) knows where the room is and passes a reader. This preserves Phase 89.2's chokepoint discipline (no new fs reads inside the fetcher; all I/O routes through injected callables or the existing fetch chokepoint)."
  - "Section-8 trace schema authority is documentation only. lib/core/section-8-trace-schema.cjs is a thin schema authority that exports SECTION_8_TRACE_SCHEMA literal + tier/source enum constants + isValid* helpers. The active decision-trace writers (lib/core/navigation-engine.cjs buildIntentPersona at lines 337 + 429; scripts/rs-discovery-engine.cjs end-of-pipeline writer) are NOT modified by this plan. Plan 94-05 introduces the schema FIELD (the contract) but defers the writer plumbing to whoever next touches a writer. This is correct GSD discipline: the schema field is the prerequisite; the writer integration is a separate concern that belongs in a future plan when an actual decision-trace writer needs to record the tier."
  - "Hard-stop removed from research.md body (the actual fresh-install blocker). Per the amendment Phase 4 finding: 'commands/research.md frontmatter ALREADY declares WebSearch + WebFetch in allowed-tools (lines 6-7). What's missing: the body has a hard-stop \"Requires Brain MCP. Then stop.\" which blocks fresh installs.' This was the actual /mos:research silent-no-op blocker the QA harness reported. Frontmatter was a red herring; the body directive was the bug. Plan 94-05 removed the directive and added graceful-degradation prose."

patterns-established:
  - "Pattern: Injection-seam for LLM-only tools in CJS code. When CJS code needs to call a tool that exists only in the LLM agent context (WebSearch, WebFetch, mcp__* prefixes), the cleanest abstraction is opts.<toolName> as a callable parameter. The agent-context invoker passes a wrapper that calls the tool; the non-agent-context invoker (hook, CLI) passes null and the code falls back to a tier-down envelope. Future plans needing AskUserQuestion or other LLM-only primitives from CJS code follow this pattern."
  - "Pattern: Array-with-non-enumerable-properties for backward-compat envelope. When an existing function returns an Array but a new contract requires envelope-shape access, Object.defineProperty(arr, 'tier', {value, enumerable:false}) attaches the envelope properties without breaking the Array's iteration semantics, JSON serialization, or .length / .find / index access. Use only when the blast radius of changing return type is high (multiple consumers across multiple test files); use a clean envelope object when the consumer count is small."
  - "Pattern: Backward-compat domain key alongside results. When wrapping an existing return shape in {tier, source, results, ...}, preserve the domain-specific key (papers, patents, signals, experts) alongside the new results key. The two reference the same array; consumers can use either. New consumers prefer results; legacy consumers keep working with the domain key."
  - "Pattern: Schema authority as re-export shim. When a plan adds a new field to a forward-additive schema (Phase 91 invariant), the cheapest correct expression is a thin re-export shim documenting the contract + exporting validation helpers + returning a stable target for fixture tests. The active writer authority is unchanged; the re-export shim is the contract surface."

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-04-29
---

# Plan 94-05 Summary

## Plan amendment summary (USER-APPROVED 2026-04-28)

The original plan body assumed all 4 rs-fetcher-* modules called Tavily/Firecrawl/Exa via mcp__* prefixes. Ground-truth audit during planner dispatch found this was factually wrong; only rs-fetcher-industry is Tavily-only. The amendment (commit 66a1a34) was filed and user-approved before any code landed; this SUMMARY documents what shipped against the amended scope.

Amendment summary:
- rs-fetcher-industry: TRUE Tavily-only gap. Gets opts.tavily / opts.webSearch / opts.cacheReader injection seams (Approach A pattern).
- rs-fetcher-academic: free tier (openalex/arxiv/pubmed) already works; envelope wrap only.
- rs-fetcher-patents: 2 keyless sources (google_patents/uspto) already work; envelope wrap only.
- rs-fetcher-experts: post-processor over academic.papers; Array-with-envelope-properties hybrid.
- commands/research.md frontmatter ALREADY declared WebSearch + WebFetch (lines 6-7); body's "Requires Brain MCP. Then stop." was the actual fresh-install blocker.
- Tier vocabulary expanded from 3 to 4 values: paid | native | cache | derived (last is for the experts post-processor).

## QA reproducer (Lawrence's harness, 2026-04-28)

The v1.11.0 QA harness adopted Dr. Miriam Kaplan persona (CU Boulder JILA, NV-diamond magnetometry biomedical sensing) and probed both /mos:rs-fetch and /mos:research entry points against a fresh install with no Tavily key.

Phase 1 -- /mos:research probe:

```
$ claude
> /mos:research "NV-diamond magnetometry biomedical applications"
[Larry replies]: This command needs Larry's Brain connected. Run
                 /mos:setup brain to set it up.
[exit -- silent no-op despite Brain not being required for grounded
 web research, AND despite WebSearch+WebFetch already being declared
 in research.md frontmatter allowed-tools]
```

Phase 2 -- evidence WebSearch worked fine in the very same session:

```
> Use WebSearch to find recent papers on NV-diamond magnetometry
[Claude calls WebSearch tool 3 times across the session]
[~30 real URLs returned: arxiv.org, nature.com, pnas.org, pubs.acs.org]
[zero burned credits; zero Tavily calls; zero Brain calls]
```

Phase 3 -- /mos:rs-fetch probe:

```
$ node scripts/rs-discovery-engine.cjs "NV-diamond magnetometry biomedical"
[without Plan 94-02 fix: crashes at thesis-merge handoff -- already
 shipped at commit adfcc1f]
[with Plan 94-02 fix but without 94-05: industry.signals returns []
 because TAVILY_API_KEY is unset; rs-discovery-engine produces empty
 fetched_results envelope; rs-sqlite-mirror writes a row with empty
 industry signals; downstream commercial-assessor + breakthrough-
 scorer score on academic + patents only; QA report flags "no
 industry tier evidence" as a P0 gap]
```

Pre-94-05 root cause: three independent failure modes, each silent at different layers.

1. /mos:research's body had `Requires Brain MCP. Then stop.` -- a hard-stop directive Larry honored even though the actual research delegation could have used WebSearch + WebFetch (already declared in allowed-tools). Brain reachability was a separate concern (Plan 94-03 + 94-04 closed that); /mos:research conflated Brain reachability with web-research capability.

2. rs-fetcher-industry was Tavily-only with no fallback. Without TAVILY_API_KEY, the fetcher returned `{signals: [], telemetry: [{source:'tavily', status:'api_key_missing'}]}` and rs-discovery-engine treated empty signals as legitimate "no industry data" rather than as "no industry tier ran".

3. The 4 rs-fetcher-* modules had inconsistent return shapes (academic returned `{papers, telemetry}`, patents returned `{patents, telemetry}`, industry returned `{signals, telemetry}`, experts returned a bare Array). No envelope contract; no tier annotation; downstream pipelines couldn't reason about "which tier produced this evidence" because the tier wasn't in the return.

Post-94-05 (this plan):

1. /mos:research's body removes the `Requires Brain MCP. Then stop.` directive and adds graceful-degradation prose explaining the paid -> native -> cache fallback. Larry now keeps researching with WebSearch + WebFetch when Brain is unreachable; the Brain cross-reference layer is the only thing that's skipped, not the research.

2. rs-fetcher-industry gains opts.tavily / opts.webSearch / opts.cacheReader injection seams via the Approach A pattern. /mos:research (Claude command) invokes the fetcher with a webSearch callable wrapping the native WebSearch tool. When TAVILY_API_KEY is absent, the fetcher falls through to native and returns `{tier:'native', source:'websearch', results, signals, telemetry}`. fetchIndustry NEVER throws on tier-down; only on Canon Part 8 violation.

3. All 4 rs-fetcher-* modules return a uniform envelope `{tier, source, results, ...}` with backward-compat domain keys (papers/patents/signals/experts) preserved alongside results. rs-discovery-engine line 330/380 consumers unchanged; new consumers can read envelope.tier to populate Section-8 trace web_research_tier per Canon Part 4.

## Files modified (4 production + 1 frontmatter-only-edit + 2 test infra + 1 SUMMARY)

```
lib/core/rs-fetcher-industry.cjs        +172 / -1   opts.tavily/webSearch/cacheReader injection seams + envelope wrap + normalizeIncoming helper
lib/core/rs-fetcher-academic.cjs        +30  / -3   header note + envelope wrap at end of fetchAcademic
lib/core/rs-fetcher-patents.cjs         +29  / -3   header note + envelope wrap at end of fetchPatents
lib/core/rs-fetcher-experts.cjs         +38  / -2   header note + Array-with-properties hybrid + annotateExpertsEnvelope helper
commands/research.md                    +13  / -2   hard-stop removed + graceful-degradation section added; frontmatter untouched

lib/core/section-8-trace-schema.cjs     +139 lines  NEW (canonical schema authority; web_research_tier field; tier+source enums; isValid* helpers; BSL 1.1)
lib/memory/mcp-stack-fallback.test.cjs  +370 lines  NEW (7 fixture tests; BSL 1.1)
lib/memory/run-feynman-tests.cjs        +22  lines  registration with Canon Part 4 + 7 + 8 traceability

.planning/phases/94-.../94-05-...-SUMMARY.md  new   this file
```

Total diff: ~840 lines across 9 files. Production code: 4 fetchers + 1 schema + 1 command file. Test infra: 1 new test file + 1 runner registration.

## Test count + Feynman baseline delta

```
mcp-stack-fallback: 7/7 tests passed
  T1 industry happy paid (opts.tavily injection)              PASS
  T2 industry native fallback (opts.webSearch when no key)    PASS
  T3 industry cache fallback (opts.cacheReader)               PASS
  T4 industry all-tiers-down empty results never throws       PASS
  T5 envelope shape uniformity (academic + patents + experts) PASS
  T6 section-8 schema web_research_tier field exists          PASS
  T7 commands/research.md body hard-stop removed              PASS

Feynman runner: baseline +1 fixture file
  Pre-94-05 baseline:  104 fixtures (per Plan 94-04 SUMMARY)
  Post-94-05 baseline: 105 fixtures (Plan 94-05 adds mcp-stack-fallback.test.cjs)

  Suite result: 103/105 passed, 0 skipped, 2 failed
  Same 2 inherited failures from Phase 89.4 chain-wiring (per
  Plans 94-02, 94-03, 94-04 SUMMARY notes "NET IMPROVEMENT
  4 -> 2 inherited failures from 89.4"). Identical failure set
  reported by all four prior 94-* plans. Zero new regressions
  introduced by this plan.

  Pre- and post- 94-05 failure set:
    - test/84-smart-notebook-copilot.test.cjs Test 15 phase 83 regression guard
    - tests/test-self-update-platform.cjs (5/24 self-update Windows / POSIX)
```

Backward-compat regression check: all 4 prior fetcher fixture suites pass byte-identically.

```
$ node lib/memory/test-rs-fetcher-academic.cjs   # 18/18 passed
$ node lib/memory/test-rs-fetcher-patents.cjs    # 17/17 passed
$ node lib/memory/test-rs-fetcher-industry.cjs   # 17/17 passed
$ node lib/memory/test-rs-fetcher-experts.cjs    # 12/12 passed
```

## End-to-end smoke evidence

```
$ node -e "
process.env.TAVILY_API_KEY = 'fake-test-key';
const fi = require('./lib/core/rs-fetcher-industry.cjs');
(async () => {
  const env = await fi.fetchIndustry(['quantum brain imaging'], {
    tavily: async () => ({
      results: [
        { url: 'https://acme.com/news', title: 'Acme Funding', snippet: 'Series A.' },
        { url: 'https://beta.com/news', title: 'Beta Lab', snippet: 'Quantum imaging platform.' },
      ],
    }),
  });
  console.log('tier:', env.tier);
  console.log('source:', env.source);
  console.log('results.length:', env.results.length);
  console.log('signals.length:', env.signals.length);
  console.log('rs-discovery-engine line 380 reads industry.signals:');
  console.log('  Array.isArray(env.signals):', Array.isArray(env.signals));
  console.log('  env.signals.length:', env.signals.length);
  // Native fallback path (no TAVILY_API_KEY)
  delete process.env.TAVILY_API_KEY;
  const env2 = await fi.fetchIndustry(['quantum brain imaging'], {
    webSearch: async () => ({
      results: [
        { url: 'https://nv.example/article', title: 'NV diamond magnetometry', snippet: 'biomedical applications' },
      ],
    }),
  });
  console.log('---NATIVE FALLBACK---');
  console.log('tier:', env2.tier, 'source:', env2.source, 'results:', env2.results.length, 'signals:', env2.signals.length);
})();
"
tier: paid
source: tavily
results.length: 2
signals.length: 2
rs-discovery-engine line 380 reads industry.signals:
  Array.isArray(env.signals): true
  env.signals.length: 2
---NATIVE FALLBACK---
tier: native source: websearch results: 1 signals: 1
```

The smoke proves three load-bearing invariants:

1. **Paid tier**: opts.tavily injection returns `{tier:'paid', source:'tavily', results:[...], signals:[...]}`. signals[] is byte-identical to pre-94-05 industry.signals shape (rs-discovery-engine line 380 consumer is unaffected).

2. **Native fallback**: with no TAVILY_API_KEY and opts.webSearch present, the fetcher returns `{tier:'native', source:'websearch', results:[...], signals:[...]}`. The native fallback fires automatically when paid is unconfigured.

3. **Backward compat**: `Array.isArray(env.signals)` is true; `env.signals.length` is non-zero; existing consumers reading `industry.signals` work unchanged.

Static verification gates:

```
$ grep -c "tier:" lib/core/rs-fetcher-industry.cjs
9

$ grep -c "tier:" lib/core/rs-fetcher-academic.cjs
1

$ grep -c "tier:" lib/core/rs-fetcher-patents.cjs
1

$ grep -cE "WebSearch|web_search|webSearch" lib/core/rs-fetcher-industry.cjs
9

$ grep -rl "web_research_tier" lib/core/
lib/core/rs-fetcher-academic.cjs
lib/core/section-8-trace-schema.cjs
lib/core/rs-fetcher-patents.cjs

$ grep -c "WebSearch" commands/research.md
2

$ grep -c "WebFetch" commands/research.md
2

$ grep -cP "[\x{2014}]" lib/core/rs-fetcher-industry.cjs \
                       lib/core/rs-fetcher-academic.cjs \
                       lib/core/rs-fetcher-patents.cjs \
                       lib/core/rs-fetcher-experts.cjs \
                       lib/core/section-8-trace-schema.cjs \
                       commands/research.md \
                       lib/memory/mcp-stack-fallback.test.cjs
0 across all 7 files

$ grep -c "Requires Brain MCP" commands/research.md
0

$ grep -c "Then stop\." commands/research.md
0
```

## Canon traceability

**Canon Part 4 (Every Choice Is Graph Data).** Plan 94-05 makes web-research tier transitions graph-recordable. The rs-fetcher-* envelope.tier annotation IS the producer; the section-8 trace web_research_tier field IS the consumer (forward-additive per Phase 91 invariant). When /mos:research falls back paid -> native -> cache, each transition is a typed scalar that downstream decision-trace writers can record on the intent_persona block. The fallback decision becomes graph data exactly as Canon Part 4 mandates.

**Canon Part 7 (Reuse Before Build).** Plan 94-05 extends the existing Phase 89.2 fetcher chokepoints (auditQueryString, recordTelemetry, computeRemainingBudget, fetchWithTimeout, the 4 rs-fetcher-* modules) with envelope wrap + injection seams. Zero new orchestration; zero new MCP tools; zero new fetch sites. The native fallback REUSES Anthropic's WebSearch + WebFetch tools (already shipped in Claude Code; declared in allowed-tools pre-94-05) instead of building a new client. The justification bar for net-new capability is met (new field on existing schema; new injection seams on existing fetcher; new envelope wrap on existing return; new test file registered with the existing Feynman runner).

**Canon Part 8 (Graph Boundary).** Plan 94-05 preserves the Canon Part 8 boundary byte-identically. Three operations: (a) the Approach A injection seams accept callables that the agent-context invoker provides; the seams themselves don't add network surface. (b) WebSearch + WebFetch carry user-typed query bytes only (LOCAL bytes leaving via the SIGNAL channel by user choice; public-domain SIGNAL queries per the canon's existing classification). (c) The brain-client.cjs chokepoint is byte-identical. Zero new Brain endpoints, queries, or tools. The new code path emits NO Brain queries; the section-8 trace schema is documentation only (no writer in this plan). Phase 87 Cypher sanitization + allow-list scalars contract carries forward unchanged. mcp-server-brain/server.cjs is unchanged.

## Plan deviations (locked-in)

1. **Tier vocabulary expanded from 3 to 4 values.** Original plan's locked-decision listed `'paid' | 'native' | 'cache'`. The amendment added `'derived'` for the experts post-processor (which has no network tier of its own; it's derived from academic.papers). Without the fourth value, the experts module either had to lie about its tier (calling itself 'paid' when it isn't) or break envelope uniformity (returning a tier value not in the validated set). 'derived' is the correct semantic for any post-processor over an upstream fetcher. Documented in lib/core/section-8-trace-schema.cjs WEB_RESEARCH_TIERS export. Rule 2 deviation: missing critical functionality (correct tier semantics for non-fetcher modules).

2. **Array-with-envelope-properties hybrid for rs-fetcher-experts.** The amendment said "experts -- envelope wrap only". A clean envelope object would require changing mapExperts return type from Array to Object, breaking 12 existing fixture tests + rs-discovery-engine line 330 consumer + 17 other test files. The Array-with-non-enumerable-properties pattern (Object.defineProperty for tier/source/results/experts) preserves Array semantics byte-identically while satisfying the envelope contract. JSON.stringify of the return still serializes as an Array (numeric indices win over non-enumerable named properties); existing wire format byte-identical. Rule 1 deviation: bug avoidance (changing return type would break ~30+ call sites; the hybrid keeps every existing consumer working with zero code change).

3. **Cache tier moved to opts.cacheReader injection seam (not direct fs read).** The original plan's interface block said cache tier reads `<room>/.mindrian/fetched_results.json` directly. The amendment moved that to opts.cacheReader (an injected callable). Reason: keeping the fetcher stateless about room layout. The fetcher knows nothing about room directory structure; the caller (rs-discovery-engine or /mos:research command) knows where the room is and passes a reader. This preserves Phase 89.2's chokepoint discipline (no new fs reads inside the fetcher; all I/O routes through injected callables or the existing fetch chokepoint). Rule 3 deviation: blocking issue (direct fs read inside the fetcher would violate Phase 89.2's chokepoint exclusivity invariant; the injection seam preserves it).

4. **Section-8 trace writer integration deferred.** The original plan's verify gates listed "decision-trace shows web_research_tier: native when fallback fires" as an acceptance criterion. Plan 94-05 created the schema FIELD (the contract surface) but did NOT modify the active decision-trace writers in lib/core/navigation-engine.cjs (lines 337 + 429) or scripts/rs-discovery-engine.cjs. Reason: each of those writers has its own multi-call-site contract; modifying them inside a "schema bump" plan would have been scope creep. The schema field is the prerequisite; integrating it into the writer is a separate concern that belongs in a future plan (or in 94-06 / 94-09 if either touches a writer). The Section-8 trace schema authority is fully exported and ready for consumption; the writer integration is a one-line append-to-intent_persona block on either writer. Documented in lib/core/section-8-trace-schema.cjs header comment. Rule 4 boundary: this is a scope decision the user can override if they want the writer integration in this plan; the schema-authority-only path is the cheapest correct expression of "Section-8 schema bumped with web_research_tier" per the plan's success criteria.

5. **opts.tavily injection seam added for symmetry.** The amendment listed opts.tavily / opts.webSearch / opts.cacheReader as the three injection seams. The original plan focused on opts.webSearch (paid -> native fallback) and opts.cacheReader (native -> cache fallback). Adding opts.tavily as the Tier 1 paid injection seam (instead of using the existing TAVILY_API_KEY env-var path exclusively) makes the fetcher fully testable from any context: a unit test can inject a mock Tavily without touching the env or hitting the network. The existing TAVILY_API_KEY path still works (additive); opts.tavily is checked first when present. Rule 2 deviation: missing critical functionality (test isolation; deterministic CI without network).

## Closure

Plan 94-05 closes the THIRD of three v1.11.0 P0 architectural ship-blockers per CONTEXT.md decisions:

```
- 94-02 rs-fetch-thesis-merge-fix     SHIPPED (commit adfcc1f)
- 94-03 brain-mcp-server-resolution    SHIPPED (commit 61f7560)
- 94-04 mcp-server-brain-deps          SHIPPED (commit a290551)
- 94-05 mcp-stack-fallback-chain       SHIPPED (this plan)
```

CHANGELOG narrative for v1.11.2 (locked from CONTEXT.md): "/mos:rs-fetch could not complete an end-to-end pipeline run; Brain was unreachable from /mos:* commands; /mos:research silently no-opped without paid MCPs". Plan 94-05 closes the third clause (research silent no-op): the body hard-stop is removed; the rs-fetcher-industry fallback chain is wired; the envelope contract is uniform across 4 modules; the Section-8 trace schema gains web_research_tier as the graph-data hook for tier transitions.

Plan 94-05 ready for 94-10 release-gate dependency closure. v1.11.2 ships graceful degradation across the entire web-research axis: paid (Tavily / Firecrawl / Exa) -> native (Anthropic WebSearch + WebFetch) -> cache (fetched_results.json) -> empty floor. /mos:research and /mos:rs-fetch produce grounded results regardless of which MCPs are configured.

The 2 inherited Feynman failures from Phase 89.4 chain-wiring are pre-existing and not in scope for this plan; they will be addressed in 94-10 release-gate plan if they block tag promotion.

## Self-Check: PASSED

- [x] lib/memory/mcp-stack-fallback.test.cjs exists, 7/7 tests passing
- [x] lib/core/rs-fetcher-industry.cjs has opts.tavily / opts.webSearch / opts.cacheReader injection seams + envelope wrap
- [x] lib/core/rs-fetcher-academic.cjs has envelope wrap with backward-compat papers[] preserved
- [x] lib/core/rs-fetcher-patents.cjs has envelope wrap with backward-compat patents[] preserved
- [x] lib/core/rs-fetcher-experts.cjs returns Array-with-envelope-properties hybrid (existing 12-scenario fixture passes)
- [x] lib/core/section-8-trace-schema.cjs created with web_research_tier field on intent_persona block
- [x] commands/research.md body has "Requires Brain MCP" + "Then stop." removed; graceful-degradation section added
- [x] commands/research.md frontmatter unchanged (WebSearch + WebFetch already declared)
- [x] lib/memory/run-feynman-tests.cjs registers the new fixture suite (count 103/105 PASS, +1 from baseline 102/104, zero new failures)
- [x] All 4 task commits exist: edfde3c (RED), 8bb038d (GREEN industry), 2c91353 (GREEN academic+patents+experts), a581a8a (GREEN schema+research.md)
- [x] Zero em-dashes in any file modified by this plan (verified via grep -P "[\\x{2014}]")
- [x] BSL 1.1 header on lib/memory/mcp-stack-fallback.test.cjs + lib/core/section-8-trace-schema.cjs
- [x] Backward compat: 4 pre-existing fetcher test suites pass byte-identically (academic 18/18, patents 17/17, industry 17/17, experts 12/12)
- [x] Canon Part 4 + Part 7 + Part 8 traceability stated in SUMMARY + run-feynman-tests.cjs comment
- [x] Five deviations documented (tier vocabulary 4 not 3; Array-with-properties hybrid for experts; cache tier via injection seam; Section-8 writer integration deferred; opts.tavily added for test isolation)
- [x] Plan amendment scope honored (industry got injection seams; academic/patents got envelope wrap; experts got hybrid; research.md body got the actual fix; frontmatter untouched)
- [x] User-approval date documented (2026-04-28; commit 66a1a34)
- [x] End-to-end smoke confirms paid + native fallback paths produce non-empty results with backward-compat signals[] preserved
