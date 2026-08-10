# Brain Surface Contract (v1)

This is the prose half of the cross-repo Brain surface contract. The machine half is
`data/brain-surface-contract.json`, vendored byte-identical in both repos (this plugin
and `jsagir/ProblemsWorthSolving-Brain`). Read this doc for the "why"; read the JSON for
the exact tool names, tiers, and argument shapes a caller can rely on.

## What the contract promises

The deployed Brain registers 23+ public read tools. This contract promises exactly 6 of
them - the **loop tools** - as the surface Phase 249's enrichment loop and any future
harness-facing consumer should reach through:

- `normalize_framework_name`
- `search`
- `discover_structure`
- `orchestration_readiness`
- `feeds_into_chains`
- `brain_stats`

Every other read tool on the deployed Brain is **non-contract**: not promised here, not
scheduled for removal, simply out of this document's jurisdiction. See "The other 15
tools" below.

## Why the surface is deliberately small

A big, loose tool surface is not a feature. Two arguments, both grounded (see
`247-RESEARCH.md`'s Grounding section):

1. **Judgement visibility.** A caller (Larry, the harness, a future integration) that
   reaches for a contracted tool is making a legible choice. A caller free to reach any
   of 23+ tools, half of which are legacy shapes or analysis-only, makes an illegible
   one - and the illegibility is exactly what a conformance test cannot catch, because
   nothing is technically wrong with calling an uncontracted tool.
2. **Drift surface.** Every tool the contract promises is a tool this document, the
   client fixture test, and the live probe all watch. A tool outside the contract can
   change shape, break, or vanish with nothing catching it. Keeping the promised set
   small keeps the watched set small and the watch itself trustworthy.

## The three conformance legs

One drift class, one leg, each catching a failure the others cannot:

1. **Server self-test (brain repo, hermetic).** Builds the Brain's tool registry
   in-process and asserts every contract tool is registered with a matching shape, and
   every `retired_remote` tool is unreachable on the read tier. Catches **code drift**:
   the server code no longer matches the contract, before anything ships.
2. **Client fixture test (this repo, hermetic - `tests/test-247-contract-client.cjs`).**
   Loads the vendored JSON and asserts every loop tool has a brain-client wrapper that
   emits exactly the contracted tool name and argument keys, against an injected fake
   transport. Catches **client drift**: the plugin's wrappers no longer match the
   contract, before anything ships.
3. **Live drift probe (this repo - `scripts/probe-brain-contract.cjs`, a release gate,
   not a commit gate).** Calls the deployed Render service directly and diffs its
   actual behavior against the contract: every loop tool reachable, every retired tool
   403-refused, the tier_denied error shape live, no leaked local paths in served
   search results, every disposed vector index in the state the contract declares.
   Catches **deploy drift**: the thing users actually reach no longer matches the
   contract, even when the code in git is fine. This is the leg that has caught every
   "fixed in git, stale on Render" incident this project has had.

## The two retired server-side-LLM tools

`text2cypher` and `brain_ask_anything` both route through a local Ollama provider that
does not exist on Render; calling either against the deployed Brain fails with
`ECONNREFUSED`, not a useful answer. Both are listed under `retired_remote` in the
vendored JSON: retired from the **remote, read-tier surface**, not deregistered from the
server (local-stdio development and the brain repo's own eval tooling keep using them).
The decision record and its full reasoning live in the brain repo (`jsagir/ProblemsWorthSolving-Brain`, CONTRACT-02); this document only records the outcome as it
affects the plugin-side contract.

As of this plan (247-02), `text2cypher` is withheld from the deployed read-tier
allowlist. `brain_ask_anything`'s removal from that allowlist is still pending a
decision executed in 247-03 - see that plan's summary for the final state. Listing both
under `retired_remote` here declares the target contract; the live probe (leg 3) is what
proves the deployed reality has caught up.

## The other 15 tools

`load_framework`, `intra_framework_flow`, `framework_techniques`,
`commands_for_problem_type`, `classify_problem_type`, `find_frameworks_for_problem_type`,
`find_commands_for_problem_type`, `find_connections`, `find_bottlenecks`,
`rank_influence`, `find_whitespace`, `structural_neighbours`, `brain_ask`, `brain_search`,
`brain_schema` are all real, registered, reachable tools today. This contract makes no
claim about any of them - not promised, not removed. Adjudicating them is explicitly out
of this phase's scope. A future contract revision may promote or retire any of them; this
document is not that revision.

## Part 8 note

This contract is transport-level only. It changes nothing about WHAT crosses the wire -
no new data leaves the plugin, no new data is exposed by the Brain that was not already
exposed. It changes only which tools a caller is told to reach, and how a caller
distinguishes a tier denial (403, `MoatViolation`) from an outage (transport failure,
`null`). Canon Part 8 (the Graph Boundary) is untouched by this document.
