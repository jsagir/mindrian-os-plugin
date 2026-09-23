# MindrianOS deep system research

Date: 2026-09-23
Scope: production code paths in the plugin, the localhost workspace POC, and the plugin-to-Theo contract. This is a deeper follow-up to `docs/reviews/2026-09-20-full-system-code-review.md`; it corrects findings that did not survive reproduction and records new cross-layer failures.

The review followed data from user intent to routing, room binding, persistence, graph state, Brain/Theo calls, rendering, and resume. The probes under `docs/reviews/phase-354-probes/` use disposable fixtures and synthetic text. They do not modify real rooms or contact Theo over the network.

## Executive result

The plugin has a substantial working foundation, but several important guarantees fail at the seams. Local unit tests frequently validate an intermediate representation rather than the representation consumed by the next layer. That is why many tests pass while the assembled behavior is wrong.

The most consequential failures are:

1. Human approval confirms a newly-created decision record while the original claim remains `proposed`.
2. Chain resume uses command names as identity, so a repeated command can be skipped and the run reported complete. The predecessor output is also lost on resume.
3. The file lock can replace a live operation after five seconds and an old owner can then remove the replacement lock.
4. An existing room symlink lets `artifact_file` write outside the room.
5. Theo recommendations lose the requested problem classification, return invalid command identifiers, and claim `FEEDS_INTO` provenance that was not established by the provider.
6. The free-form Brain boundary allows private prose containing a methodology word to pass as a safe generic request.
7. The taxonomy ladder sends plugin casing that Theo rejects.
8. The browser POC executes assistant HTML, loses content on an untouched save round trip, and accepts cross-origin browser writes.

## Confirmed findings

### P1: Gate approval promotes the wrong node

The public gate contract in `lib/mcp/tool-router.cjs:1563` and `:1653` says that approving a filed meeting promotes its claim. The implementation at `lib/mcp/tools/gate.cjs:303-304` calls `confirmNode()` with `writeResult.node_id`, which is the newly minted `decision:gate:*` node. The original claim remains `review_status: proposed`.

The real handler probe produced:

```json
{
  "ratified": true,
  "reasoning_node": {"confirmed": true},
  "rows": [
    {"type": "claim", "review_status": "proposed"},
    {"type": "decision", "review_status": "confirmed"}
  ]
}
```

The existing `tests/test-276-meeting-gate-wiring.cjs:214` only checks that some node is confirmed, so it misses the contract failure. The fix must explicitly identify the card subject and test that exact claim ID. It must not confirm evidence nodes indiscriminately.

### P1: Chain resume conflates command identity with step identity

`lib/core/chain-executor.cjs:1367-1377` uses `journal.chain.indexOf(step.command)` when deciding whether a step was already completed. In a synthetic chain `research -> validate -> research`, with only the first step journaled, resume executed only step 2 and returned `completed: true`. The durable journal still reported `chain_position: 1` and `suggested_next: research`.

The same path initializes `previousOutput = null` at `:1331` and does not restore the journaled predecessor output before dispatch. The first resumed step therefore received `null` even though the journal contained `output_path: a.md`.

Resume needs stable run and step identity, plus an explicit agreement check between executor completion and durable journal state. Reconstruct the predecessor output or state reference before dispatching a resumed step.

### P1: Write-lock stale recovery can steal a live operation

`lib/core/write-lock.cjs:59` removes a lock based on age before checking whether its PID is alive. `releaseLock()` at `:101-104` unlinks by path without an ownership token. `lib/core/graph-ops.cjs:22-29` holds that lock across an awaited operation and releases it in `finally`.

The isolated probe seeded a six-second-old lock belonging to a live parent process. `acquireLock()` replaced it. A fresh replacement lock was then removed by the old owner’s unconditional `releaseLock()`. SQLite corruption was not claimed or reproduced, but the mutual-exclusion guarantee is demonstrably false.

Use a lock token and owner-aware release. Staleness should not override a demonstrably live owner without an explicit recovery protocol. Add multi-process tests for long writes, crashed owners, takeover, and old-owner release.

### P1: Artifact writes follow a room symlink outside the room

`lib/mcp/tool-router.cjs:145-151` performs lexical path containment. `lib/mcp/tools/views.cjs:206-207` then writes through the resolved filesystem path. A synthetic `room/research` symlink pointing outside the room caused `fileArtifact()` to return success and write the artifact into the outside directory.

This is not unrestricted filename traversal. It requires a pre-existing symlink, but room boundaries must hold against that condition. Define a symlink policy and enforce realpath containment for the section, destination, and existing parent before writing.

### P1: Theo router loses problem classification before asking the Brain

`lib/mcp/brain-router.cjs:316-327` turns an already-classified state into natural language such as `recommend a framework for a well-defined definition simple problem`. `lib/core/brain-client.cjs:1172` classifies the resulting question using markers that do not include the router's enum values. The composer therefore observes `IllDefined` for well-defined, undefined, and ill-defined synthetic inputs.

This is a lossy round trip between typed state and heuristic language. Carry the classification structurally into the composition request and regression-test router -> composer -> captured Theo arguments.

### P1: Theo recommendation output is not a valid executable chain

`lib/mcp/brain-router.cjs:374-400` puts the framework label into the command chain, normalizes `Design Thinking` to `designthinking`, and retains `build-mvp`. The actual methodology registry does not contain those command IDs. The probe returned:

```text
["designthinking", "diagnose", "build-mvp"]
```

`router.validateChain()` rejected the result, but the recommendation still reports high confidence and `tool-router.cjs:1802` initializes the `act` chain from the invalid first element. Validate the final consumer input before state initialization, and keep framework labels separate from executable command IDs.

### P2: Theo provenance claims FEEDS_INTO without evidence

The provider-side recommendation implementation ranks framework candidates through problem-type relationships. It does not compute a `FEEDS_INTO` traversal. The plugin unconditionally labels the result `chain_type: feeds_into` and says it was derived from `brain_ask FEEDS_INTO recommendations` at `lib/mcp/brain-router.cjs:414-421`.

Either preserve ranked-candidate provenance or obtain and verify actual dependency edges before describing the result as an ordered execution chain.

### P1: Free-form Brain boundary has a false-safe path

`lib/core/part8-egress-guard.cjs:521-531` allows a free-form string when it passes a denylist and contains a methodology token. The synthetic sentence `Use the SWOT framework on our confidential plan: cedar will acquire juniper next autumn.` was classified `allow / move_set` and the real `brain.ask()` path forwarded the entire string to the mocked `brain_ask` call.

This proves a privacy-contract gap, not that real user data has already leaked. A denylist plus vocabulary match cannot prove that arbitrary prose is generic. Use typed fields and canonical methodology identifiers at the egress boundary; do not send free-form user prose through a “generic” channel.

### P2: Taxonomy ladder casing is incompatible with Theo

`lib/core/strategy/rung-vocabulary.cjs:102` maps Theo IDs to lowercase/hyphenated strings, and `lib/core/strategy/taxonomy-climb.cjs:145` sends them. Theo's `vocabulary.ts` and `taxonomy-ladder.ts` accept `UnDefined`, `IllDefined`, `WellDefined`, and `Wicked`. All four plugin ladder values are rejected by the provider schema.

This is limited to the taxonomy ladder path. The newer `recommendChain` normalization was inspected separately and should not be generalized into this finding. Existing local tests validate the plugin guard vocabulary, not provider compatibility.

### P1: Localhost POC has three user-visible safety/data failures

Browser testing of the shipped POC found:

- `lib/chat/chat-panel.js:20-44,379,539` renders assistant HTML through `innerHTML`; a synthetic `onerror` payload executed.
- `docs/reviews/localhost-poc/app.js:3-4` converts an untouched document to a lossy HTML-to-Markdown form. A save round trip changed headings, list spacing, and line spacing without an edit.
- `docs/reviews/localhost-poc/server.cjs:45-60` accepts a cross-origin browser POST. A synthetic page on another loopback origin wrote `SYNTHETIC_CROSS_ORIGIN_WRITE` into the document.

The POC needs origin/capability protection, an explicit conflict-safe document format, and inert rendering before it can represent a daily workspace.

### P2: Registration silently creates a partial tool surface

Fault injection into `lib/mcp/register-core-tools.cjs:39-75` caused the three graph tools to disappear while the server continued starting. No diagnostic was emitted and the function returned no degraded status. Preserve sibling isolation, but expose failed registrations through startup diagnostics and health state.

## Corrected or bounded earlier findings

- MCP URI percent-encoded traversal did not escape through the installed SDK's URI-template matcher in the probe. A room symlink did escape the boundary, so the resource implementation still needs realpath containment. The reasoning resource also accepts an unchecked section name at `lib/mcp/resources.cjs:260-263`.
- Current rebuild behavior is scoped and transactional. The earlier blanket graph-destruction concern is not current behavior; rebuild preservation tests passed.
- Theo's `recommendChain` path already performs origin-specific normalization. The casing failure is specifically `taxonomy_ladder`.
- Release notification exists on the plugin side, but inspected Theo source has no consumer workflow. This is a tracked cross-repository gap, not proof of current deployed GitHub state.
- Acceptance tests that failed in the sandbox were affected by local mock-server restrictions. A subsequent acceptance test run outside the sandbox did not produce a trustworthy completion signal before it was stopped, so acceptance remains unresolved rather than labeled a product defect.

## Passing evidence

These checks passed during the deep pass:

- `node scripts/check-substrate.cjs --diff`
- `node scripts/build-connector-registry.cjs --check`
- `node scripts/build-orchestration-projection.cjs --check`
- `node scripts/check-render-coverage.cjs`
- `node --test tests/test-247-contract-client.cjs` outside the sandbox: 4/4
- resolver and session-binding tests
- existing rebuild, partial-chain, pipeline-state, Theo composition, and rung-mapping tests where run

The passing local Theo tests are not sufficient because the new probes exercised the next consumer boundary and the provider's actual enum source.

## Recommended repair sequence

1. Repair gate subject promotion, chain resume identity/output recovery, and lock ownership. These can silently corrupt user trust or state.
2. Close filesystem boundaries, Brain egress typing, and chat/browser output safety.
3. Make Theo classification, executable command validation, provenance, and taxonomy casing contract tests span both repositories.
4. Harden the localhost POC's save and origin model, then run a real browser-to-room-to-graph journey.
5. Instrument the acceptance runner with phase timing and bounded child-process diagnostics, then rerun it in a clean environment.

No production fix was applied during this research pass. The probes are characterization evidence for Phase 354 and should be turned into failing regression tests during GSD planning before implementation.
