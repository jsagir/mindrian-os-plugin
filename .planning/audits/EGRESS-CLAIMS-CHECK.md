# Egress claims check

Scope: verify the main claims of the auditor egress message (AUDITOR-FINDINGS-source.md, section F). The auditor text is a set of hypotheses, not authority.
Date: 2026-11-06. Repo state: branch main, read-only check. No code changed.
Method: code reading, plus a probe script that called `classify()` in `lib/core/part8-egress-guard.cjs` and `isBrainShapedTool` and `isShimBackedBrainTool` in `lib/core/brain-response-sanitize.cjs`. Inputs were synthetic strings and fake secrets only. A throwaway HOME and rooms folder were used with no room bound (roomDir null), no network, no Brain call, no hook run. The throwaway folder was deleted.
Line numbers are for the repo at this commit. Probe tool prefixes used: `mcp__plugin_mos_mindrian-brain__` (own shim), `mcp__pws-brain-mcp__` (direct connector), `mcp__theo__` (raw Theo).

Labels: CONFIRMED, REFUTED, NOT VERIFIED. PARTIAL means the core is true and the detail differs.

## Summary table

| Claim | Label |
|-------|-------|
| a. Typed Theo tools classify ambiguous, not allow | CONFIRMED (with a routing nuance) |
| b. A job key flips a block to allow on brain_ask and brain_query | PARTIAL (true for the room-word rules, false for the default-deny scan) |
| c. Hook and callTool fail open when the guard throws or fails to load | CONFIRMED |
| d. Lower-case sk- key, spelled money, 750k, 40% are not blocked | CONFIRMED on brain_write and on a packet; the "21 of 22" and "2 of 22" counts NOT VERIFIED |
| e. Capital-letter name rule blocks a name, lower case passes | CONFIRMED |
| f. onFailure:block never engages | CONFIRMED for internal failures; whether Claude Code honours this field NOT VERIFIED |
| g. 8 test files assert only "not allow"; one test asserts a canary reaches the wire | PARTIAL (count not reproduced, 4 files found by grep; the wire test exists) |
| h. 2026-10-05 ruling: web lines check only credentials | CONFIRMED for the planner web lines; coverage of Semantic Scholar, grants.gov, research-speaker: NOT covered by the text |

## (a) Typed Theo tools: CONFIRMED

Command: `classify({...}, {toolName, roomDir:null})` with the payload named below.

| Tool name tried | Payload | Verdict (class) |
|-----------------|---------|-----------------|
| normalize_framework_name | {raw:'swot'} | ambiguous (unknown) |
| discover_structure | {query:'market structure'} | ambiguous (unknown) |
| search | {query:'swot analysis'} | ambiguous (unknown) |
| framework_concepts | {framework:'swot'} | ambiguous (unknown) |
| classify_problem_type | {statement:'how do teams decide'} | ambiguous (unknown) |
| theo_health | {} | allow (empty_payload) |

The same verdicts came back under all three prefixes. Cause in code: `classify()` ends at `part8-egress-guard.cjs:1243` with `ambiguous/unknown`. Typed allow arms exist only for find_connections, taxonomy_ladder, recommend_chain, framework_step, framework_techniques, case_story, find_frameworks_for_problem_type, commands_for_problem_type, framework_neighborhood (`_proveKnownToolShape`, lines 478-600). `normalize_framework_name` has only the navigator-release arm (line 699-719), which needs a gate receipt.

Routing nuance (changes the severity of the claim):
- `mcp__theo__*` names (search, normalize_framework_name): `isBrainShapedTool` is false. The hook returns allow before classify (hook line 247). The guard does not see them at all. Only the `brain_<verb>` names on that prefix, such as `mcp__theo__brain_ask`, are inspected.
- `mcp__pws-brain-mcp__*`: shaped true, shim-backed false. Ambiguous with class `unknown` is not in the shim allow path (hook line 331), so the hook blocks when `brainAvailable()` is true (hook line 335 onward) and allows when it is false. This matches the auditor: a direct connector blocks typed tools whatever the wording.
- `mcp__plugin_mos_mindrian-brain__*`: shim-backed, class `unknown` is in `SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES` (hook line 130), so the hook allows.

## (b) Job key: PARTIAL

Cause: `_looksLikePacket` is true for any payload with a `job` key (`part8-egress-guard.cjs:158-160`). `classify()` then returns at the packet arm (line 1212) and never reaches the free-form arm (`theoVerdict`, line 1226). `_proveMoveSet` (line 207) checks only that `job` is in the shipped list of 12 jobs, that summary leaves are hashed, and that handle fields look generic. It does not look at other keys such as `question`.

Probe, tool `brain_ask` and `brain_query` (cypher key), prefixes shim and direct, no room bound:

| Synthetic string | Without job key | With job key `select_methodology` |
|------------------|-----------------|------------------------------------|
| "What did Christensen say about disruption" | block (room_content, proper name) | allow (move_set) |
| "Ask Larry about the Data Room" | block (room_content, proper name) | allow (move_set) |
| "my team missed the Boston launch" | block (room_content, private venture context) | allow (move_set) |
| "Christensen said Acme Corp runway is 14 months with ARR" | block (content_set) | block (content_set) |
| "the Lean Startup framework for Acme Robotics in Boston" | block (content_set) | block (content_set) |
| "swot analysis" | allow (typed_question) | allow (move_set) |

Finding: the flip is real for every room-word rule inside `theoVerdict` (name rule, "my/our" rule, room lexicon). The auditor sentence "every content rule is skipped" is too strong: the default-deny scan at step 1 (`scanForContent`, line 1194) runs first and still blocks the deny-list hits. The packet with an extra free-text key also classified allow (`{job, freeform:'hello world'}` gave allow/move_set).
Not verified: whether the remote Brain rejects the extra key (auditor also says unknown).

## (c) Fail-open: CONFIRMED (read only, module not broken)

Hook `scripts/part8-egress-guard-hook.cjs`:
- Lines 244-248: sanitizer `require` or `isBrainShapedTool` throws, then `allow()` (exit 0).
- Lines 252-267: `require(GUARD_PATH)` or `classify` throws, then `return allow()` with the comment "fail-OPEN on any classify resolution error".
- Line 268: a falsy or non-object verdict gives allow.
- Lines 374-378: `uncaughtException` handler and the outer try/catch both `process.exit(0)`.
- Header lines 16 and 50 state this as a deliberate posture.

`callTool` in `lib/core/brain-client.cjs`: the guard call is inside `try { require('./part8-egress-guard.cjs'); ... classify ... } catch (_e) { /* Belt-internal error ... degrade to existing behavior */ }` (lines 446-476; catch at 474-477). After the catch the code goes on to send. The same pattern is in `query()` (lines 732-755, catch at 751-754).
The "127 modules plus an npm package" load count was not checked.

## (d) Key shapes, spelled money, numbers: CONFIRMED (counts NOT VERIFIED)

Probe results, no room bound:

| Synthetic string | brain_write | Packet (job + extra key) | brain_ask plain |
|------------------|-------------|--------------------------|-----------------|
| lower-case `sk-` plus 40 chars | ambiguous (unknown) | allow (move_set) | allow (generic_question) |
| upper-case `sk-` plus 40 chars | ambiguous | allow | block (room_content, identifier) |
| "two million dollars" | ambiguous | allow | allow (generic_question) |
| "750k" | ambiguous | allow | allow (generic_question) |
| "40%" | ambiguous | allow | allow (typed_question) |
| "Christensen" | ambiguous | allow | n/a |
| "Acme Corp" | block (content_set) | block | n/a |

On the own shim, ambiguous with class unknown is sent (hook line 331; `callTool` proceeds with a disclosure). So a key on `brain_write` reaches the wire on the own shim route. Via the direct connector the hook blocks ambiguous when `brainAvailable()` is true. The auditor figures "21 of 22" and "2 of 22" key shapes were not re-run (only 2 shapes tried here).

## (e) Name rule: CONFIRMED

| Question | Verdict |
|----------|---------|
| "What did Christensen say about disruption" | block room_content (proper name) |
| "what did christensen say about disruption" | allow generic_question |
| "Ask Larry about the Data Room" | block room_content (proper name) |
| "ask larry about the data room" | allow generic_question |
| "How does Acme Robotics compare" | block content_set (company suffix pattern, a deny-list hit, not the name rule) |
| "how does acme robotics compare" | allow generic_question |

Note: the company example was blocked by the default-deny pattern list (`[A-Z][a-z]+ (Corp|Inc|...|Robotics...)`), not by the capital-letter name rule. The lower-case form passes in all three pairs.

## (f) onFailure:block: CONFIRMED for internal failures

`hooks/hooks.json:241` sets `"onFailure": "block"` for this hook (matcher at line 235, timeout 5). The script exits 0 on every internal error (see c). It exits 2 only on a deliberate block verdict (hook line 149). So a script error or a guard load failure never blocks. Not verified: whether Claude Code reads an `onFailure` field at all, and what a timeout (5 seconds) or a non-zero exit before the handlers install does. A top-level `node` start failure would give exit 1, not 2, and was not tested.

## (g) Tests: PARTIAL

Grep of `tests/` for `!== 'allow'`, `notStrictEqual(..., 'allow')`, `notEqual(..., 'allow')` found these test files with at least one not-allow assertion in a Part 8 context: test-366-guard-navigator-release.cjs, test-260906-fda-known-tool-shapes.cjs, test-223-part8-egress.cjs, test-part8-name-class-methodology-names.cjs, test-gct-process-step-id-parity.cjs, test-3692-lexicon-generic-entries.cjs, test-3692-guard-survey-gate.cjs, test-361-egress-shapes.cjs, test-355-part8-egress.cjs, test-354-taxonomy-ladder-casing.cjs, test-354-egress-typed-question.cjs.
Of these, the files with a not-allow assertion and no exact `'block'` or `'ambiguous'` assertion (heuristic grep): test-gct-process-step-id-parity.cjs, test-361-egress-shapes.cjs, test-354-taxonomy-ladder-casing.cjs, test-354-egress-typed-question.cjs. That is 4, not 8. The heuristic can miss other assertion forms, so the count of 8 is NOT VERIFIED and not reproduced.
Wire test: `tests/test-254-ambiguous-disclosure.cjs:140-150` classifies a fixture as ambiguous, calls `callTool`, and asserts `captured.length > before` with the message "the call must have proceeded to the wire". CONFIRMED that one test asserts an ambiguous call is sent. It uses a packet fixture, not a canary token. `tests/test-239-query-egress-canary.cjs` asserts the reverse (canary blocked before the wire).
The claim "the release gate requires the two known leaks to stay allowed" was not checked: NOT VERIFIED.

## (h) The 2026-10-05 ruling

Primary sources:
- `.planning/phases/369.2-research-searches-online-for-real/369.2-CONTEXT.md:26`: "The web search lines are FREE: no egress policy, audit fence, term filter, per-term release or room-text check between the planner and the open web. The one gate is the grant card showing the exact strings ... Canon Part 8 stays and means one thing: no room content to Theo. The city fence in `lib/core/cross-room-aggregator.cjs` ... comes OFF the web lines; the audit ledger still records every string (a record, not a gate)."
- `CHANGELOG.md:187` (beta.61): "no fence, policy line or term filter sits on the web search lines; a question naming a city, a person or a product leaves exactly as written after you approve the run (Phase 369.2, ruling 2026-10-05)". `--offline` still sends nothing.
- `lib/core/research-planner/egress-policy.cjs:6-9` and `data/egress-policy.json` note: web lines are OpenAlex, Tavily, patents; the grant card and the audit ledger are the gate.
- `lib/core/rs-egress-prompts.cjs:79-90`: the web lines are OpenAlex, arXiv, PubMed, Tavily, patents, the analogies online composer. They send the room words as written. Only `auditWebCredential` runs (Bearer token, `api_key=`). "Canon Part 8 (the Brain line) keeps auditQueryString."
- `lib/core/rs-fetcher-academic.cjs:29, 118`: credential check only.
- Decision record: plan `369.2-02-PLAN.md:202` (accepted threat, "navigator ruling 2026-10-05").
Exact scope of the ruling: it covers the research planner web search lines. It does not name Semantic Scholar, grants.gov or research-speaker.

Coverage of the three paths the auditor names:
- Semantic Scholar (`scripts/query-semantic-scholar.cjs`): it builds queries from room artifact titles and problem types. It has no guard call and is not in the planner provider lists above. The ruling text does not mention it. Not covered by the ruling, and not covered by any check (grep for egress, audit, part8 found none in the file). I did not check how it is invoked.
- grants.gov (`lib/core/opportunity-ops.cjs:382-403, 436-454`): direct `fetch` to `api.grants.gov` and `api.simpler.grants.gov`. No guard call seen on those lines. Not named by the ruling. NOT VERIFIED which words go out (not traced).
- research-speaker (`scripts/research-speaker:135`, invoked by `commands/file-meeting.md:1193-1197`): `curl` to a Google search URL with a query built from the speaker name. The command text shows a separate `--apply` step after a first run, so the order of the user question versus the send was not checked: NOT VERIFIED that names go "before the user is asked".

Conflict check: the auditor says the ruling "contradicts your Part 8 statement". The ruling text itself narrows Part 8 to "no room content to Theo" (369.2-CONTEXT.md:26) and the `rs-egress-prompts.cjs` comment says "Canon Part 8 (the Brain line)". The repo CLAUDE.md Part 8 line says "User data NEVER egresses to the Brain". So code and ruling agree with each other. The conflict exists only against a reading of Part 8 as covering all outbound traffic. Whether `docs/MINDRIAN-CANON.md` Part 8 was amended to match was not checked.

## Two owner-relevant points

1. Ordering the auditor proposes: add safe-allow rules for the typed Theo tools first, then make ambiguous a block. Evidence supports the order. Today these tools classify ambiguous (a). Own-shim route sends ambiguous with class unknown. The direct connector route blocks it. Raw `mcp__theo__*` names are not inspected at all. If ambiguous becomes a block before the allow arms exist, every typed call on the own shim (framework-name lookup, whitespace baseline, chains) would start to be refused. The order is sound. One addition from (b): closing the packet shortcut (a `job` key skips the name and venture rules) and fixing the fail-open exits would be independent of this ordering.
2. The ruling conflict in (h): the 2026-10-05 ruling frees the planner web lines (OpenAlex, arXiv, PubMed, Tavily, patents) and keeps only a credential check there, with the grant card as the gate. It does not mention Semantic Scholar, grants.gov or research-speaker, and those three have no check in the files read. So the owner decision needed is narrow: either extend the ruling to those three paths (credential check plus a card), or treat them as outside it. Moving Semantic Scholar behind the chokepoint would add a credential check and a grant, not content protection, as the auditor says. Whether Part 8 in the canon should be reworded to "the Brain line" is a second small decision.
