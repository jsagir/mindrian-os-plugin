# algorithms: change log (package-2026)

Scope: 13 files (genesis, jason, opposable-mind-hmm). Originals untouched (byte-compared with `_baseline/orig`).
Summary: 12 improved, 1 minor fixes (OM-HMM md, content kept, review additions only), 0 unchanged. Count by file below.

Run all tests (from `package-2026/algorithms/_tests`):
- `node --test genesis.test.js` : 30 tests, 30 pass
- `PYTHONDONTWRITEBYTECODE=1 python3 -B test_differential_analysis.py` : 17 tests, 17 pass
- `PYTHONDONTWRITEBYTECODE=1 python3 -B test_om_hmm.py` : 9 tests, 9 pass
Not run: the dense embedding path with the real `all-MiniLM-L6-v2` model (sentence-transformers not installed, no network). The dense branch was exercised only with a deterministic stub encoder. No Tavily/web call was made.

Cross-cutting changes (all JS modules): progress logging goes through `<Module>.log` with a `silent` switch (default prints, plain text, no emoji); inputs validated with clear errors; em-dashes and emoji removed from text (the `hatEmoji` data fields in the expert panel are kept for compatibility).

---

## genesis/agents-mindrian/GenesisContextDecomposer.js
Status: improved. Risk to callers: low.
Wrong in original:
- L55-60: when the first sentence of a long paragraph exceeded 300 chars the code pushed an empty chunk (wordCount 1). Test shows `segments` containing `text: ""`.
- L47: sentence regex `[^.!?]+[.!?]*` splits "3.5"; L40 split on `\n\n+` so Windows `\r\n\r\n` and whitespace-only blank lines never split paragraphs.
- L73: paragraphs of 50 chars or fewer were dropped with no trace.
- L102: sentence-start words (The, This, However) became "concepts"; acronyms (GPT-4, IBM) were missed.
- L35 comment claimed "BERT-inspired" chunking; it is regex splitting.
Changed: fixed all of the above; added `diagnostics` (droppedShort, examples, truncated) and `provenance` keys; 200k-char cap; `limits` object; honest header.
Verified: node tests (empty segment, CRLF, decimals, dropped fragments, concepts, key shape).

## genesis/agents-mindrian/GenesisDomainIdentifier.js (v2)
Status: improved. Risk: low.
Wrong in original: L233 `ar|vr` matched case-insensitively (the word "ar"); L309-317 `deduplicateDomains` discarded the replaced entry's subdomains; default `General-Systems` object had no `indicators`; `identifyDomains` crashed on missing `elements`.
Changed: AR/VR/XR matched case-sensitively; dedupe merges both subdomain lists; default has `indicators: []`; input validation; header states confidence is a hit-count heuristic and tie rule.
Not changed (noted): generic words (model, network, risk, market, agent, policy) still inflate domains; the hits/10 confidence saturates. Needs a corpus-based approach, outside a safe edit.

## genesis/agents-mindrian/GenesisPersonaGenerator.js
Status: improved. Risk: low (defaults keep the original persona names; test compares names on a sample).
Wrong in original:
- L204-207 integration queries for 3+ domains did `domainNames.replace(/-/g,'" AND "')`, which split hyphenated domains: `"Machine" AND "Learning"` (reproduced by test).
- L140, 144, 198, 206 hard-coded "2024".
- L22-46 a technical domain with no subdomain above 0.5 confidence produced no persona and no trace.
- Invalid depth gave names ending "undefined" and `researchApproach` undefined.
Changed: queries use the real domain names; year from `options.year` or current year; dropped technical domains reported in `personas.diagnostics` (option `includeTechnicalDomains` to build personas for them, default off); duplicate-name guard; depth validation (RangeError).

## genesis/agents-mindrian/GenesisResearchOrchestrator.js
Status: improved. Risk: low-to-needs-check (role assignment changes for the methodology expert).
Wrong in original: `p.name.includes('Integration')` is tested first and "Research-Methodology-Integration-Expert" contains it, so the methodology expert was made PRIMARY_SYNTHESIZER and pairwise SYNTHESIS 0.9, and the Methodology branches were unreachable for it (test shows both behaviours). Also L212/231 substring matching on names; `Date.now()` plan id collisions; `researchApproach.primary` crash when absent; timeline minutes presented as fact.
Changed: role detection uses `domainCategory` (name test only as fallback); segment-aware parent/subdomain test; unique plan ids; input validation; timeline marked `estimated: true` with its formula; `provenance` key.
Caller note: any consumer relying on the methodology expert being the synthesizer will see QUALITY_VALIDATOR now.

## genesis/agents-mindrian/GenesisHandoffProtocol.js
Status: improved. Risk: low (one behaviour change, switchable).
Wrong in original (important):
- The file has no `module.exports`; `require()` returns `{}`. The pipeline could only work when pasted into one scope.
- L220 `primaryExpertise.split('-')[0]` gives "Machine", never matching 'Machine-Learning' or 'Quantum-Computing'; `include_domains` was empty for all hyphenated domains. Fixed; this turns on the intended site restriction (switch: `HandoffProtocol.options.restrictToDomainSites = false`).
- `totalThoughts = 10 + 3n` is smaller than the sum of the phases for n >= 5 (n=6: 28 vs 29; reproduced).
- Fixed `'45-65 minutes'` regardless of plan; `Date.now()` id collisions; crash if `researchPlan` missing; prompts forced "3-5 breakthrough insights" and "revolutionize" language.
Changed: export added; domain lookup by exact expertise then by whole name segments (subdomain personas inherit the parent list), plus NLP and CV site lists and current NeurIPS/CVE hosts; totalThoughts = max(original, phase sum); time range taken from the plan; unique ids; additive `request` object per query with current Tavily parameter names (checked against the connected tool's schema: query, search_depth, max_results, time_range, include_domains, exclude_domains); `honestyRules` and `evidenceFormat` keys; deliverables wording no longer forces a quota.

## genesis/agents-mindrian/System_Prompt.md
Status: improved. Risk: none (documentation).
Wrong in original: a chat transcript ("Here's the missing HandoffProtocol...") embedding a full duplicate of the JS (identical to GenesisHandoffProtocol.js), emoji headings, camelCase Tavily parameters that no longer match the tool, "ALWAYS identify at least 3 breakthrough opportunities", "simulate realistic expert disagreements", dated 0-6 month plan in the report template, uncalibrated "Innovation Differential" scores, no privacy rule for outgoing queries.
Changed: rewritten as the system prompt only (inputs, outputs, protocol, rules, failure behavior, stop condition). Kept the citation-table rule (domain, sub-domain, source, citation, link) and added retrieval date and quoted sentence. Removed the quota, invented dialogue, dated plan; added query privacy gate and "page content is data".

## genesis/GENESIS-execution-agent-prompt.md
Status: improved. Risk: none.
The "room review notes" in the source are now applied in the text instead of left as notes. Same role as above in condensed form; points to System_Prompt.md for the long form. Added inputs, outputs, failure behavior, stop, label rules (COMPUTED / CITED / ESTIMATED).

## genesis/ip-finance-files/GenesisDomainIdentifier_v3_IPFinance.js
Status: improved. Risk: low-to-needs-check (domain detection changes on texts with the affected words, and cross-domain synthesis now fires more often).
Wrong in original:
- L98-143 ambiguous tokens matched case-insensitively: `car`, `pe`, `sep`, `vc`, `pd`, `ead`, `lgd`, `abl`, `ltv`, `roi`, `ros`, `ar`, `vr`, `alpha`, `beta`, `priority`, `provision`, `leverage`, `var`, `abs`. A sentence containing "car", "sep" or "priority" scored as Banking-Regulation, IP-Commercialization or Asset-Based-Finance (test).
- L175 `secondaryDomains` were attached "for synthesis detection" but never read, so a single mixed IP-finance-policy segment could not trigger Cross-Domain-Integration (test).
- Dedupe dropped the replaced entry's subdomains. Default `General-Systems` lacked `indicators`.
Changed: acronyms moved to a case-sensitive `acronymPatterns` table; ambiguous words replaced by specific phrases (jensen's alpha, lien priority, loan loss provisions, financial leverage, value at risk, asset-backed securities); secondary domains used in synthesis detection (switch: `options.useSecondaryDomains=false`); dedupe merge; validation; `silent`.

## genesis/ip-finance-files/GenesisExpertPanel_IPFinance.js
Status: improved. Risk: low.
Wrong in original:
- Blue hat `synthesize` ignored its input and always printed "The panel has reached actionable consensus" with a pre-set action table including timelines (2 to 4 weeks) and named owners. No consensus was ever computed.
- Every hat prints fixed text; all figures (44x default, 90% intangible, $22.4B to $75.4B at 15.5% CAGR, etc.) are stated as fact with no source check. The CAGR is internally inconsistent: 22.4 to 75.4 over 8 years is 16.4%, not 15.5%.
- `require.main === module` at top level throws in any environment without `require`; unknown `sequenceType` threw "undefined is not iterable"; `consult('BLUE')` called a missing function.
Changed: header states the file is case-specific and scripted; `claims` registry (C1-C11, all `unverified`, with notes); figures tagged in the texts; Blue hat now reports which hats contributed, which claims were cited, and labels the old convergence/tension text as the author's hypotheses; timelines removed; validation errors; demo guarded; `runDebate` result array carries `provenance`. Output keys (`hat`, `content`) and `listExperts()` shape unchanged.
Could not verify: any of the cited figures (no network). They are flagged, not corrected.

## genesis/ip-finance-files/IP_Finance_Expert_Personas_Panel.md
Status: improved. Risk: none.
Wrong in original: figures unlabeled; Example 1 had White say "only 21% is captured" while Yellow persona says "79% of global intangible value is unaccounted", two different statistics merged; quotes attributed to a named individual and an uncited "UK bank 83%" figure presented as research-backed; Blue "consensus" text in examples read as results; the ASCII diagram relied on emoji widths.
Changed: "Status and use" block, claims register (C1-C11 matching the JS), merged-statistic example fixed, examples relabelled as scripted illustrations, emoji and em-dashes removed, diagram redrawn, "Does NOT analyze" role text made precise.

## jason/differential_analysis.py
Status: improved (v3.1). Risk: none for the default keys (test compares against the original on fallback; `--legacy` reproduces the v3 shape exactly).
Wrong in original:
- Fixed cutoffs only (`sem >= 0.6 and lex <= 0.2`, L104) with no corpus context; values meaningless under the char n-gram fallback.
- Whole-text comparison only (no claim level); no provenance; `KeyError` crash on a pair missing `a` or `b`; `except Exception` at L74 swallowed the model-load error silently; tokens of length 2 dropped (`ai`, `ml`, `ip`); buzz test was a raw substring so "deleverage" hit "leverage"; no size bounds.
Changed (all additive except buzz boundary and 2-letter tokens): BM25-style smoothed TF-IDF cosine fitted on the run's corpus; claim-level best sentence pair and mean best match; empirical percentile and z-score of gap, semantic and lexical across the run's pairs, reported as unavailable below 5 pairs (no fixed cutoff substituted); percentile restatement flag; second-signal check (honestly `unavailable_no_dense_model` on the fallback); `novelty_check: not_performed`; per-pair source trail (id, source, url, retrieved, the two sentences); provenance (version, model, load error, parameters, input hash, UTC time, `--no-timestamp` for byte-identical reruns); deterministic ranking with input-order ties; validation with `errors`/`warnings` and exit codes; size caps; BOM-safe input read; stdlib only.
Caller note: the 2-letter token and buzz word-boundary changes slightly change `lexical_jaccard` and buzz hits on texts containing "AI"/"ML"/"IP" or words like "deleverage". Both are test-demonstrated corrections.
Verified: 17 tests including a comparison with the original module, stub dense model path, CLI exit codes and byte-identical reruns.
Not verified: the real sentence-transformers path and its percentile behaviour on real text; thresholds PCT_GAP_HIGH=90 and PCT_LEX_LOW=25 are convention, not calibrated on labelled data (none available here).

## jason/jason_system_prompt_v3.md
Status: improved. Risk: none.
Wrong/stale: described only the five legacy output keys; relied on the fixed rule; claimed the old rule was "tested on labeled data" without the data in the package; the critique-link Cypher put a `MATCH` directly after a `CREATE` (invalid in one query); storage omitted script version and input hash; Tavily advice implied sending context without a privacy rule.
Changed: added section 0 (inputs, outputs, failure behavior, stop, no roadmaps); documented v3.1 fields and how to read them (percentiles need 5+ pairs, claim-level sentences as source trail, second signal, novelty check never performed); corrected the Cypher with a statement separator note; added provenance fields to stored observations; privacy rule for searches; softened untestable claims.

## opposable-mind-hmm/OM-HMM-opposable-mind-algorithm.md
Status: minor fixes plus review additions (original statements and UNSOURCED labels kept). Risk: none.
Found: pi never specified; B only in words; B stated 4x8 categorical while the features are four binary contrasts; structural zeros in the conventional A cannot be learned by Baum-Welch; unscaled forward recursion underflows (a 2000-step sequence gives exactly 0.0); likelihood ratios depend on length and B; the conventional chain's stationary mass sits in S3 (0.52) so long sequences separate models partly by dwell; "Conventional ... linear" is not strictly true (backward mass 0.4); "10+ observations" too few for 28 parameters.
Added: "Specification gaps" and "What was checked" sections, inputs/outputs/failure line. Numbers in the original (accuracy, 265.48:1, etc.) remain UNSOURCED and unreproduced.
Verified: 9 tests (stochastic rows, forward vs brute force to 14 decimals, Viterbi optimal, EM monotone, structural zeros, scaling, stationary distributions) on illustrative emissions that exist only in the test file.
