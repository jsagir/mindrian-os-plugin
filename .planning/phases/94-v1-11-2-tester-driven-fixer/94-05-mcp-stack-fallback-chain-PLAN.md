---
phase: 94-v1-11-2-tester-driven-fixer
plan: "05"
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - lib/core/rs-fetcher-academic.cjs
  - lib/core/rs-fetcher-patents.cjs
  - lib/core/rs-fetcher-industry.cjs
  - lib/core/rs-fetcher-experts.cjs
  - commands/research.md
  - lib/core/section-8-trace-schema.cjs
  - lib/memory/mcp-stack-fallback.test.cjs
  - lib/memory/run-feynman-tests.cjs
requirements: []
canon_parts:
  - "Part 4 (Every Choice Is Graph Data -- tier transitions emit Section-8 trace edge web_research_tier; the fallback decision becomes graph data)"
  - "Part 7 (Reuse Before Build -- extends Phase 89.2 fetchers with paid->native fallback; reuses Anthropic native WebSearch + WebFetch instead of building a new client)"
  - "Part 8 (Graph Boundary -- WebSearch and WebFetch are public-domain SIGNAL queries; queries carry user-typed search strings only, never user artifacts; existing brain-client chokepoint untouched)"

must_haves:
  truths:
    - "Each of the 4 rs-fetcher-* modules probes paid tier (Tavily/Firecrawl/Exa) and falls back to Anthropic native WebSearch on failure without throwing"
    - "Each fetcher returns an envelope of shape `{tier: 'paid'|'native'|'cache', source: 'tavily'|'firecrawl'|'exa'|'websearch'|'cache', results: Array<...>}`"
    - "/mos:research <query> produces grounded results when Tavily is not configured (real URLs in output, no silent no-op)"
    - "node scripts/rs-discovery-engine.cjs <topic> produces a non-empty fetched_results envelope when paid MCPs are unavailable (after Plan 94-02 lands)"
    - "Section-8 trace schema gains a new `web_research_tier` field in the intent_persona block (or a new top-level group) per QA handoff Section 2 FIX-4"
    - "commands/research.md allowed-tools declares both WebSearch and WebFetch so the native fallback can fire"
    - "Tier-1 -> Tier-0 transitions are logged to decision-traces; no silent failures"
    - "Cache tier (-1): when WebSearch is also unavailable (offline), fetchers read most recent fetched_results.json from <room>/.mindrian/ when present; otherwise return empty results with tier='cache' source='cache'"
  artifacts:
    - path: "lib/core/rs-fetcher-academic.cjs"
      provides: "Paid-tier probe + Anthropic native WebSearch fallback + cache fallback. Envelope announces tier."
      min_lines: 40
    - path: "lib/core/rs-fetcher-patents.cjs"
      provides: "Same fallback chain, patents-domain query adapter."
      min_lines: 40
    - path: "lib/core/rs-fetcher-industry.cjs"
      provides: "Same fallback chain, industry-domain query adapter."
      min_lines: 40
    - path: "lib/core/rs-fetcher-experts.cjs"
      provides: "Same fallback chain, experts-domain query adapter."
      min_lines: 40
    - path: "commands/research.md"
      provides: "allowed-tools declares WebSearch + WebFetch so native fallback fires from /mos:research entry point."
      min_lines: 1
    - path: "lib/core/section-8-trace-schema.cjs"
      provides: "Section-8 trace schema updated to include web_research_tier field. Forward-additive per Phase 91 invariant."
      min_lines: 8
    - path: "lib/memory/mcp-stack-fallback.test.cjs"
      provides: "T1 rs-fetcher-academic falls to WebSearch when Tavily absent; T2 fetcher envelope announces tier correctly; T3 Section-8 trace web_research_tier field populated; T4 four fetchers all emit consistent envelope shape; T5 cache tier engages when both paid and native unavailable."
      min_lines: 220
  key_links:
    - from: "lib/core/rs-fetcher-academic.cjs probe"
      to: "Anthropic native WebSearch tool"
      via: "fallback adapter invokes WebSearch with academic-domain query string"
      pattern: "WebSearch|web_search"
    - from: "lib/core/rs-fetcher-* envelope"
      to: "Section-8 decision-trace web_research_tier field"
      via: "writer of decision-trace reads envelope.tier and writes to intent_persona.web_research_tier"
      pattern: "web_research_tier"
    - from: "commands/research.md frontmatter"
      to: "Anthropic native WebSearch + WebFetch tools"
      via: "allowed-tools declaration enables Claude to call these from /mos:research"
      pattern: "WebSearch|WebFetch"
    - from: "lib/memory/mcp-stack-fallback.test.cjs"
      to: "lib/memory/run-feynman-tests.cjs TEST_FILES"
      via: "registration"
      pattern: "mcp-stack-fallback"
---

<plan_amendment date="2026-04-28" approved_by="user-jonathan">
**Scope adjusted; user-approved before any code lands.**

Plan's original `<interfaces>` claim ("4 fetchers all currently call Tavily/Firecrawl/Exa via mcp__* prefixes") is factually wrong. Ground truth from the actual modules:

  - rs-fetcher-academic.cjs: 6 sources, 3 free (OpenAlex, arXiv, PubMed)
    + 3 keyed (Scopus, IEEE, Nature). Free tier already works for any user.
  - rs-fetcher-patents.cjs: 2 sources (Google Patents, USPTO), both keyless.
    Free tier already works.
  - rs-fetcher-industry.cjs: 1 source -- TAVILY ONLY (TAVILY_API_KEY required).
    THIS IS THE TRUE GAP for any-user readiness.
  - rs-fetcher-experts.cjs: not a fetcher; post-processor over academic
    papers[]. Already works without keys.

  - commands/research.md frontmatter ALREADY declares WebSearch + WebFetch
    in allowed-tools (lines 6-7). What's missing: the body has a hard-stop
    "Requires Brain MCP. If Brain is not available... Then stop." which
    blocks fresh installs.

Adjusted task scope (preserves plan spirit + must_haves; rewires implementation):

  Task 1 RED: 7 fixture tests, scope-adjusted:
    T1 Industry happy paid (opts.tavily mock returns results)
    T2 Industry native fallback (no TAVILY_API_KEY, opts.webSearch returns)
    T3 Industry cache fallback (opts.cacheReader returns cached)
    T4 Industry all-tiers-down (no source, returns empty, never throws)
    T5 Envelope shape uniformity across 4 modules (tier+source+results)
    T6 Section-8 schema gains web_research_tier
    T7 commands/research.md frontmatter + body (WebSearch + WebFetch +
       hard-stop removed)

  Task 2 GREEN: rs-fetcher-industry.cjs gains opts.tavily / opts.webSearch
    / opts.cacheReader injection seams. Returns
    {tier, source, results, signals, telemetry} (signals + telemetry
    preserved for backward compat with rs-discovery-engine line 380
    industry.signals consumer).

  Task 3 GREEN: rs-fetcher-academic / patents / experts gain envelope wrap
    only -- existing free-tier logic preserved, new keys added. Tier
    annotation: 'paid' when keyed source returned data; 'native' if
    explicit webSearch path used; 'derived' for experts post-processor.
    Backward compat: papers / patents / signals / experts keys preserved
    alongside results.

  Task 4 GREEN: lib/core/section-8-trace-schema.cjs gains web_research_tier
    field (intent_persona block, forward-additive per Phase 91 invariant).
    commands/research.md body removes the "Then stop." Brain hard-stop
    directive AND adds graceful-degradation prose describing the chain.
    Frontmatter is already correct; no changes there.

  Task 5: SUMMARY documents the deviation, the user's approval, and the
    Lawrence QA harness evidence (Tavily-only blocker on /mos:rs-fetch +
    Brain hard-stop on /mos:research).

Architectural decision (user-approved): Approach A injection-seam pattern.
WebSearch is a Claude-native tool callable from agent context. Fetcher
modules are CJS code outside agent context. Production wiring: when
/mos:research (a Claude command) invokes the fetcher, it passes a
callable that wraps the WebSearch tool. When called from a non-agent
context (hook), opts.webSearch is null and the fetcher reports tier:
'cache' (or empty results).

Locked decisions amended:
  - Envelope shape: {tier, source, results} REQUIRED + domain-specific
    keys (signals/papers/patents/experts) PRESERVED for backward compat.
  - Tier values: 'paid' | 'native' | 'cache' | 'derived'
    ('derived' added for experts post-processor; not in original plan).
  - opts.tavily / opts.webSearch / opts.cacheReader: new injection seams
    on rs-fetcher-industry. Signature ABI-safe (additive only; existing
    callers without these keys still work; missing tavily falls through
    to existing TAVILY_API_KEY env-var path).

Other locked decisions in this plan REMAIN unchanged.
</plan_amendment>

<objective>
Fix the v1.11.0 P0 architectural ship-blocker where /mos:research and rs-fetcher-* modules have no graceful degradation when paid web-research MCPs (Tavily, Firecrawl, Exa) are unavailable. The QA harness demonstrated that Anthropic's native WebSearch worked fine for 3 grounded research probes producing ~30 real URLs with zero burned credits, but the plugin doesn't know to use it.

Per QA handoff Section 2 FIX-4: each fetcher gets paid->native->cache fallback chain. Envelope announces tier. Section-8 trace gains `web_research_tier` field. commands/research.md declares WebSearch + WebFetch in allowed-tools.

Mirrors the Brain Mode A/B/Tier 0 pattern but for the web-research axis.

Purpose: /mos:research and downstream rs-discovery-engine produce grounded results regardless of paid-MCP availability. Tier transitions become graph data per Canon Part 4. WebSearch is the universal floor.

Output: 4 fetchers extended with fallback chain. commands/research.md updated. Section-8 schema bumped with `web_research_tier`. Fixture suite proves all 5 tier-transition paths.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/94-v1-11-2-tester-driven-fixer/94-CONTEXT.md
@CLAUDE.md
@lib/core/rs-fetcher-academic.cjs
@lib/core/rs-fetcher-patents.cjs
@lib/core/rs-fetcher-industry.cjs
@lib/core/rs-fetcher-experts.cjs
@commands/research.md

<interfaces>
Existing fetcher contract (Phase 89.2):
- Each rs-fetcher-<domain>.cjs exports `async function fetch<Domain>(query, opts) -> { results: Array<...> }` (or equivalent shape).
- Currently calls Tavily/Firecrawl/Exa via `mcp__tavily__*`, `mcp__firecrawl__*`, `mcp__exa__*` MCP tool prefixes.
- On failure, throws or returns empty array (current behavior; THIS plan changes that).

Target fetcher contract (post-94-05):
```js
async function fetch<Domain>(query, opts) -> {
  tier: 'paid' | 'native' | 'cache',
  source: 'tavily' | 'firecrawl' | 'exa' | 'websearch' | 'cache',
  results: Array<{ url, title, snippet, ... }>
}
```

Fallback chain (uniform across 4 fetchers):
1. Tier 1 PAID: probe Tavily -> Firecrawl -> Exa. On any success, return `{tier: 'paid', source, results}`.
2. Tier 0 NATIVE: invoke Anthropic native WebSearch with a domain-adapted query string. Return `{tier: 'native', source: 'websearch', results}`.
3. Tier -1 CACHE: read `<room>/.mindrian/fetched_results.json` if present. Return `{tier: 'cache', source: 'cache', results}`.
4. If all 3 tiers unavailable (offline + no cache): return `{tier: 'cache', source: 'cache', results: []}`.

Domain query adapters (each fetcher):
- academic: append "site:arxiv.org OR site:nature.com OR site:semanticscholar.org" to query string
- patents: append "site:patents.google.com OR USPTO patent" to query string
- industry: append "industry analysis OR market report" to query string
- experts: append "researchers OR principal investigator OR lab head" to query string

Section-8 trace schema (lib/core/section-8-trace-schema.cjs):
- Existing schema is forward-additive per Phase 91 invariant. Adding `web_research_tier` does not break readers.
- New field path: `intent_persona.web_research_tier: 'paid' | 'native' | 'cache' | null`
- Optional new top-level group `web_research: { tier, source }` if cleaner.

WebSearch and WebFetch tool surface (Claude native):
- WebSearch: `WebSearch(query: string) -> { results: [{url, title, snippet}] }`
- WebFetch: `WebFetch(url: string, prompt: string) -> string` (returns LLM-summarized page content)
- Both are deferred-tools at session start; commands/research.md must declare them in allowed-tools.

Existing test infrastructure (Phase 89.2 + 89.5):
- Mock fetchers via opts.mockTavily / opts.mockWebSearch dependency injection (see existing rs-discovery-engine.cjs test seam pattern).
- Test runner pattern from lib/memory/folder-memory.test.cjs.
</interfaces>

<locked_decisions>
- Envelope shape: `{tier, source, results}` per QA handoff Section 2 FIX-4. Tier values: 'paid' | 'native' | 'cache'. Source values: tavily | firecrawl | exa | websearch | cache.
- Section-8 trace field: `web_research_tier` placed under `intent_persona` block (forward-additive). Section-8 schema in lib/core/section-8-trace-schema.cjs is the canonical schema authority.
- commands/research.md MUST declare both WebSearch AND WebFetch in allowed-tools (the fallback uses both: WebSearch for URL discovery, WebFetch for page-content retrieval).
- Cache file path: `<room>/.mindrian/fetched_results.json`. Format: most-recent envelope persisted per fetch call. Plan 94-05 only READS from this cache; writing is owned by upstream rs-discovery-engine consumers (out of scope for this plan).
- Canon Part 8 audit: WebSearch queries carry user-typed search strings (LOCAL bytes leaving via the SIGNAL channel by user choice). WebSearch is the public-internet SIGNAL channel per Canon decisions. The existing brain-client.cjs chokepoint is untouched. New code path emits NO Brain queries.
- 4 fetchers share identical fallback chain implementation. Extract a helper `lib/core/rs-fetcher-fallback.cjs` only if duplication exceeds 30 lines per fetcher; otherwise keep inline (Canon Part 7 reuse-or-inline judgment).
</locked_decisions>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED -- failing fixture tests for paid->native->cache chain across 4 fetchers</name>
  <files>lib/memory/mcp-stack-fallback.test.cjs, lib/memory/run-feynman-tests.cjs</files>
  <read_first>
    - lib/core/rs-fetcher-academic.cjs full file (understand current export + Tavily call shape)
    - lib/core/rs-fetcher-patents.cjs full file
    - lib/core/rs-fetcher-industry.cjs full file
    - lib/core/rs-fetcher-experts.cjs full file
    - commands/research.md current allowed-tools list
    - lib/memory/folder-memory.test.cjs (test pattern reference)
  </read_first>
  <behavior>
    T1 (academic happy paid): rs-fetcher-academic with mock Tavily success returns `{tier: 'paid', source: 'tavily', results: [...]}` (length > 0).

    T2 (academic native fallback): rs-fetcher-academic with mock Tavily throwing AND mock WebSearch returning results returns `{tier: 'native', source: 'websearch', results: [...]}`.

    T3 (academic cache fallback): rs-fetcher-academic with mock Tavily throwing AND mock WebSearch throwing AND fixture fetched_results.json present returns `{tier: 'cache', source: 'cache', results: <from cache>}`.

    T4 (academic empty cache): same as T3 but no cache file -> `{tier: 'cache', source: 'cache', results: []}`. Never throws.

    T5 (envelope shape uniformity): patents, industry, experts fetchers all return the same envelope shape (tier + source + results keys present, tier in valid set, source in valid set).

    T6 (Section-8 schema): `lib/core/section-8-trace-schema.cjs` exports a schema literal containing `web_research_tier` somewhere reachable (parse the schema export, assert key path).

    T7 (commands/research.md frontmatter): YAML frontmatter allowed-tools list contains 'WebSearch' and 'WebFetch' as separate entries.
  </behavior>
  <action>
    Step 1: Create lib/memory/mcp-stack-fallback.test.cjs with BSL 1.1 license header.

    Step 2: Implement T1-T7. Use dependency injection pattern: each fetcher should accept opts.tavily, opts.firecrawl, opts.exa, opts.webSearch, opts.cacheReader as injectable mocks.

    Step 3: For T6 (schema), use try/catch around require to handle the case where lib/core/section-8-trace-schema.cjs does not yet exist (will be created in Task 4). Test should FAIL with `MODULE_NOT_FOUND` or equivalent.

    Step 4: For T7, use the same YAML frontmatter parser pattern Plan 94-03 uses.

    Step 5: Append registration to lib/memory/run-feynman-tests.cjs.

    Step 6: Run test. T1-T7 MUST FAIL (none of the fetcher refactor or schema work has happened).

    Commit RED: `test(94-05): add failing tests for mcp-stack fallback chain (RED)`
  </action>
  <verify>
    <automated>node lib/memory/mcp-stack-fallback.test.cjs 2>&1 | tail -10 | grep -qE "FAIL|fail"</automated>
    <automated>grep -c "mcp-stack-fallback" lib/memory/run-feynman-tests.cjs</automated>
    <automated>grep -c "BSL" lib/memory/mcp-stack-fallback.test.cjs</automated>
  </verify>
  <done>7 failing tests committed. Feynman runner registered. BSL 1.1 present.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN -- implement fallback chain in rs-fetcher-academic.cjs</name>
  <files>lib/core/rs-fetcher-academic.cjs</files>
  <read_first>
    - lib/core/rs-fetcher-academic.cjs full file
    - QA handoff Section 2 FIX-4 fallback chain pseudocode
  </read_first>
  <action>
    Step 1: Refactor rs-fetcher-academic.cjs to:
    1. Wrap existing Tavily call in try/catch. On success, return `{tier: 'paid', source: 'tavily', results}`. On failure, fall through.
    2. (Optional, if Firecrawl/Exa adapters exist) Probe Firecrawl, then Exa.
    3. Native fallback: invoke WebSearch with academic-domain query adapter (`<query> site:arxiv.org OR site:nature.com OR site:semanticscholar.org`). On success, return `{tier: 'native', source: 'websearch', results}`. On failure, fall through.
    4. Cache fallback: read `<room>/.mindrian/fetched_results.json` if present. Return `{tier: 'cache', source: 'cache', results}`. If absent or unreadable, return `{tier: 'cache', source: 'cache', results: []}`.
    5. NEVER throw. Tier transitions always succeed (the chain ends at empty cache).

    Step 2: Maintain the existing fetcher signature (don't break Phase 89.2 callers). Add opts injection seams (opts.tavily, opts.webSearch, opts.cacheReader, opts.roomDir).

    Step 3: Run T1-T4 from the test. They MUST pass.

    Commit: `feat(94-05): rs-fetcher-academic paid->native->cache fallback chain`
  </action>
  <verify>
    <automated>grep -c "tier:" lib/core/rs-fetcher-academic.cjs</automated>
    <automated>grep -c "source:" lib/core/rs-fetcher-academic.cjs</automated>
    <automated>grep -cE "WebSearch|web_search|webSearch" lib/core/rs-fetcher-academic.cjs</automated>
    <automated>grep -c "fetched_results.json" lib/core/rs-fetcher-academic.cjs</automated>
    <automated>node lib/memory/mcp-stack-fallback.test.cjs 2>&1 | grep -E "T1|T2|T3|T4" | grep -ic "pass"</automated>
    <automated>grep -cP "[\x{2014}]" lib/core/rs-fetcher-academic.cjs</automated>
  </verify>
  <done>rs-fetcher-academic returns tier+source+results envelope. T1-T4 green. Zero em-dashes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: GREEN -- replicate fallback chain across patents, industry, experts</name>
  <files>lib/core/rs-fetcher-patents.cjs, lib/core/rs-fetcher-industry.cjs, lib/core/rs-fetcher-experts.cjs</files>
  <read_first>
    - lib/core/rs-fetcher-academic.cjs after Task 2 (the reference implementation)
    - Each of patents/industry/experts current implementations
  </read_first>
  <action>
    Step 1: Apply the same fallback-chain pattern to rs-fetcher-patents.cjs with patents-domain query adapter (`<query> site:patents.google.com OR USPTO patent`).

    Step 2: Apply to rs-fetcher-industry.cjs with industry-domain query adapter (`<query> industry analysis OR market report`).

    Step 3: Apply to rs-fetcher-experts.cjs with experts-domain query adapter (`<query> researchers OR principal investigator OR lab head`).

    Step 4: Consider extracting a shared helper `lib/core/rs-fetcher-fallback.cjs` if duplication exceeds 30 lines per fetcher. If lifted, ensure all 4 fetchers consume the helper consistently. Otherwise keep inline (Canon Part 7 judgment).

    Step 5: Run T5 (envelope shape uniformity). MUST pass.

    Commit: `feat(94-05): rs-fetcher-{patents,industry,experts} fallback chains uniform with academic`
  </action>
  <verify>
    <automated>for f in patents industry experts; do grep -c "tier:" lib/core/rs-fetcher-$f.cjs; done</automated>
    <automated>for f in patents industry experts; do grep -cE "WebSearch|web_search|webSearch" lib/core/rs-fetcher-$f.cjs; done</automated>
    <automated>for f in patents industry experts; do grep -c "fetched_results.json" lib/core/rs-fetcher-$f.cjs; done</automated>
    <automated>node lib/memory/mcp-stack-fallback.test.cjs 2>&1 | grep -E "T5" | grep -ic "pass"</automated>
    <automated>grep -cP "[\x{2014}]" lib/core/rs-fetcher-patents.cjs lib/core/rs-fetcher-industry.cjs lib/core/rs-fetcher-experts.cjs</automated>
  </verify>
  <done>All 4 fetchers return uniform envelope. T5 green. Zero em-dashes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: GREEN -- Section-8 trace schema bump + commands/research.md tools declaration</name>
  <files>lib/core/section-8-trace-schema.cjs, commands/research.md</files>
  <read_first>
    - lib/core/section-8-trace-schema.cjs IF EXISTS (search for the file under lib/core/; if absent, search Phase 91 for the schema authority -- it may live in lib/core/decision-trace-writer.cjs or similar)
    - commands/research.md current frontmatter
  </read_first>
  <action>
    Step 1: Locate the Section-8 trace schema authority. Likely candidates: lib/core/section-8-trace-schema.cjs, lib/core/decision-trace-writer.cjs, lib/core/intent-persona-trace.cjs. Use `grep -lr "intent_persona" lib/core/`. Confirm the schema authority before editing.

    Step 2: If lib/core/section-8-trace-schema.cjs exists: add a `web_research_tier` field to the intent_persona block of the schema literal. Forward-additive per Phase 91 invariant.

    Step 3: If schema authority lives elsewhere (e.g. inline in decision-trace-writer): update that file's schema definition AND create a minimal lib/core/section-8-trace-schema.cjs re-export shim so T6 has a stable target.

    Step 4: Edit commands/research.md frontmatter. Add WebSearch and WebFetch to allowed-tools. Preserve existing entries. Verify the body prose mentions /mos:research can use WebSearch as a free fallback when paid MCPs absent.

    Step 5: Run T6 + T7. MUST pass.

    Commit: `feat(94-05): Section-8 trace web_research_tier field + commands/research.md WebSearch+WebFetch declaration`
  </action>
  <verify>
    <automated>grep -rl "web_research_tier" lib/core/ | head -3</automated>
    <automated>grep -c "WebSearch" commands/research.md</automated>
    <automated>grep -c "WebFetch" commands/research.md</automated>
    <automated>node lib/memory/mcp-stack-fallback.test.cjs 2>&1 | grep -E "T6|T7" | grep -ic "pass"</automated>
    <automated>grep -cP "[\x{2014}]" commands/research.md</automated>
  </verify>
  <done>Section-8 schema includes web_research_tier. commands/research.md declares WebSearch + WebFetch. T6 + T7 green. Zero em-dashes.</done>
</task>

<task type="auto">
  <name>Task 5: End-to-end smoke + SUMMARY closure</name>
  <files>.planning/phases/94-v1-11-2-tester-driven-fixer/94-05-mcp-stack-fallback-chain-SUMMARY.md</files>
  <read_first>
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-01-statusline-active-room-fix-SUMMARY.md
    - This plan's must_haves block
  </read_first>
  <action>
    Step 1: End-to-end smoke. From a tmp room WITHOUT Tavily configured:
    - Run `node scripts/rs-discovery-engine.cjs "NV-diamond magnetometry biomedical"` (depends on Plan 94-02 thesis-merge fix already shipped).
    - Confirm exit 0.
    - Confirm decision-trace under `<room>/.mindrian/decision-traces/<session>.json` contains `intent_persona.web_research_tier: 'native'`.
    - Confirm fetched_results envelope is non-empty.

    Step 2: Run full Feynman suite. Confirm 7/7 fixture tests pass and overall suite stays green at baseline+1.

    Step 3: Write 94-05-SUMMARY.md. Must include:
    - QA handoff evidence (~30 real URLs from WebSearch in QA session)
    - 4 fetchers refactored + 1 schema bump + 1 command frontmatter update
    - Test count (7/7) + Feynman baseline delta
    - End-to-end smoke evidence (web_research_tier: native in decision-trace)
    - Canon Part 4 (tier transitions are graph data) + Part 7 (extends Phase 89.2 fetchers) + Part 8 (LOCAL-only adapter; brain chokepoint untouched) traceability

    Commit: `docs(94-05): SUMMARY -- mcp-stack fallback chain (paid->native->cache)`
  </action>
  <verify>
    <automated>node lib/memory/mcp-stack-fallback.test.cjs 2>&1 | tail -5 | grep -qE "7/7|PASS|passed"</automated>
    <automated>node lib/memory/run-feynman-tests.cjs 2>&1 | tail -5 | grep -qE "passed"</automated>
    <automated>test -f .planning/phases/94-v1-11-2-tester-driven-fixer/94-05-mcp-stack-fallback-chain-SUMMARY.md</automated>
    <automated>grep -c "web_research_tier" .planning/phases/94-v1-11-2-tester-driven-fixer/94-05-mcp-stack-fallback-chain-SUMMARY.md</automated>
    <automated>grep -cP "[\x{2014}]" .planning/phases/94-v1-11-2-tester-driven-fixer/94-05-mcp-stack-fallback-chain-SUMMARY.md</automated>
  </verify>
  <done>End-to-end smoke confirms web_research_tier: native fires in decision-traces. 7/7 fixture green. SUMMARY filed.</done>
</task>

</tasks>

<verification>
- 4 fetchers all return `{tier, source, results}` envelope; tier transitions occur on paid failure
- Section-8 trace schema includes web_research_tier
- commands/research.md declares WebSearch + WebFetch in allowed-tools
- node lib/memory/mcp-stack-fallback.test.cjs shows 7/7 passed
- node lib/memory/run-feynman-tests.cjs full suite green
- End-to-end smoke: rs-discovery-engine without Tavily produces non-empty fetched_results envelope; decision-trace shows web_research_tier: native
- Zero em-dashes in any modified file
- BSL 1.1 on new test file
</verification>

<success_criteria>
- 4 rs-fetcher-* modules implement uniform paid->native->cache fallback chain
- Envelope shape `{tier, source, results}` consistent across all 4 fetchers
- /mos:research grounded results without Tavily configured
- Section-8 trace gains web_research_tier field; tier transitions logged as graph data per Canon Part 4
- commands/research.md declares WebSearch + WebFetch
- 7/7 fixture tests green; Feynman baseline +1
- Canon Part 8 boundary preserved: WebSearch is public SIGNAL channel; brain-client chokepoint untouched
- Zero em-dashes; BSL 1.1 on new test file
</success_criteria>

<output>
After completion, create `.planning/phases/94-v1-11-2-tester-driven-fixer/94-05-mcp-stack-fallback-chain-SUMMARY.md`. Must include QA evidence (~30 URLs from WebSearch), 4-fetcher refactor evidence, schema bump, end-to-end smoke (web_research_tier: native), Canon Part 4 + Part 7 + Part 8 traceability.
</output>
