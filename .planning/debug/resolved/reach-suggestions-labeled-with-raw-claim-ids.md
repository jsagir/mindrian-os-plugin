---
status: resolved
kind: rca
trigger: "reach-suggestions-labeled-with-raw-claim-ids"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: local-only
canon_parts: [9, 11]
created: 2026-09-17T00:00:00Z
updated: 2026-09-17T12:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD, this repo `/home/jsagi/dev/MindrianOS-Plugin`, current HEAD at file-creation time (see `git log -1 --format=%H` at investigation start).
- **WIRE claims probe against:** not applicable (this is a local room-graph / reach-suggestion rendering defect, no Brain/Theo wire call involved).
- **Date of audit:** 2026-09-17
- **Re-verification rule:** any source-code claim filed below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

reasoning_checkpoint:
  hypothesis: "`pickNodeDisplayName` in scripts/intent-classifier.cjs:1243-1254 causes the raw claim id to leak into the context_block reach label because its candidate chain (node.name, node.label, node.title, props.name, props.title, props.label, then node.id) never checks `properties.text` -- the ONLY field a `claim` node (lib/core/navigation/typed-claim.cjs writeClaimNode) actually stores its human-readable content under. When a claim node is selected as the top cortexNodes entry in buildDialSlotContext (scripts/intent-classifier.cjs:1316), pickNodeDisplayName exhausts every candidate and falls through to node.id (format 'claim:'+sessionId+':'+hash.toString(16), e.g. claim:<sid>:984a59d2), which becomes the {topic} slot fed into lib/hmi/dial-label-composer.cjs's context_block template ('Bring back what we worked out on {topic}.') -- an exact byte match to the reported symptom's template wording."
  confirming_evidence:
    - "lib/core/navigation/typed-claim.cjs:139-177 (writeClaimNode props object) proves a claim node's properties blob carries only knowledge_type/text/conditions/counter_conditions/valid_from/valid_until/source_speaker/source_segment -- never name/label/title."
    - "lib/core/navigation/typed-claim.cjs:33-38 comment states explicitly: 'The text key is the atomic claim sentence itself... persisted here so the read side (the tri-modal index props.text check) can extract the claim's content' -- confirming text is the intended resolved-content field, and that a read side is expected to check props.text."
    - "lib/core/navigation/room-context.cjs:188-253 (legD / CORTEX_NODE_TYPES) proves 'claim' nodes are surfaced into ctx.cortexNodes as raw {id, type, properties, review_status, ...} rows -- so a claim node genuinely can reach buildDialSlotContext's cortexNode fallback (scripts/intent-classifier.cjs:1333-1336) when relevantNodes doesn't resolve a topic."
    - "scripts/intent-classifier.cjs:1243-1254 (pickNodeDisplayName) read in full: the candidate array is [node.name, node.label, node.title, props.name, props.title, props.label, node.id] -- props.text is absent from the list, and node.id is the terminal candidate (always a string, so the loop always resolves there if nothing else hit)."
    - "typed-claim.cjs:109 CLAIM_NODE_ID returns 'claim:' + sid + ':' + hash.toString(16); a 32-bit unsigned hash renders as up to 8 hex chars, matching the tester's reported example 'claim:984a59d2-...' shape (8 hex chars after the colon)."
  falsification_test: "If a claim node reaching buildDialSlotContext's topic resolution actually had a non-empty name/label/title (or props.name/title/label) field, pickNodeDisplayName would resolve to that instead of falling to id -- but writeClaimNode's props object (read above) proves no such field is ever written for a claim node, so this branch cannot occur for a claim; the id fallback is the only reachable outcome, confirming rather than falsifying the hypothesis."
  fix_rationale: "The fix adds `props.text` to pickNodeDisplayName's candidate chain (positioned before the node.id fallback), so a claim node's actual resolved content resolves as the {topic} slot instead of its opaque id. This addresses the schema mismatch directly: the claim-writing side (typed-claim.cjs) and the label-reading side (pickNodeDisplayName) now agree on where a claim's readable content lives. This is NOT a symptom patch (e.g. hardcoding a string-replace of 'claim:' patterns) -- it fixes the actual field lookup gap."
  blind_spots: "Have not live-reproduced end-to-end (no room.db with a real claim node run through the full dispatchSensors -> renderDial pipeline) -- confirmed by static code trace only, per this session's Meta note that no reproduction was isolated yet. Other CORTEX_NODE_TYPES (decision, governing_thought, navigator_persona, memory_artifact) also lack name/label/title fields and would ALSO fall to their own node.id today, but their ids are human-derived slugs (e.g. decision:<decisionId>, governing_thought:<section>), not opaque hashes, so they don't reproduce the same visibly-broken symptom -- not fixing those in this pass since the reported symptom and this session's regression test are scoped to the claim case specifically."

hypothesis: CONFIRMED -- pickNodeDisplayName (scripts/intent-classifier.cjs) omits `properties.text` from its candidate chain, so a claim node used as the {topic} slot resolves to its raw id instead of its stored claim text.
test: static trace of the write side (typed-claim.cjs) against the read side (pickNodeDisplayName) plus the legD/buildDialSlotContext path connecting them -- completed.
expecting: fix by adding props.text to the candidate chain; verify via a new regression test asserting no `claim:<id>` substring ever surfaces in a composed label when a claim node with non-empty properties.text is the resolved topic.
next_action: none. Resolved by the session manager without a live-room repro (see Resolution.verification for the explicit, named blind spot and the reasoning for closing anyway) -- mirrors the precedent already on file in this same debug/ directory (`file-meeting-missing-reference-files.md`, `bare-plugin-relative-path-anchoring-repo-wide` in knowledge-base.md) of closing on fixture/production-function-level proof when a live end-user/end-room environment is not available in-session, and naming the gap rather than hiding it.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (the only dev workspace)
- Reported by: Lawrence Aronhime, tester bug report #2, item #5, relayed via a parallel session (jsagi-30, working the Jev/TypeSafe spike track) which read and triaged the full report but explicitly did not root-cause this item ("Label composition in the reach path... should carry the claim's title/summary, never the id. Not root-caused by me; needs a look.")
- Date first observed: unknown (tester report), filed for investigation 2026-09-17
- Related debug sessions: none found by slug/content search of `.planning/debug/*.md` for "claim:" id patterns at filing time (searched via grep for raw-claim-id / claim_id mentions; only hit was `knowledge-base.md`, not a dedicated prior RCA for this exact symptom).

## Problem Statement

A reach/next-step suggestion surfaced to the user renders with a raw internal claim node id embedded in the label text, instead of that claim's human-readable title or summary. Example verbatim from the tester report: "Bring back what we worked out on claim:984a59d2-...". This leaks an internal identifier into user-facing copy and gives the user no way to recognize which prior insight the suggestion refers to.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: a reach suggestion referencing a prior claim renders a label built from that claim's resolved title/summary/text, e.g. "Bring back what we worked out on [the pricing-model insight]".
actual: the label contains the bare graph node id verbatim, e.g. "claim:984a59d2-...".
errors: none (no thrown error; this is a silent content-correctness defect, not a crash).
reproduction: not yet isolated by this session. Tester's own report is the only reproduction on file; needs a live repro against a room with at least one confirmed claim node to reproduce the exact reach-suggestion code path that surfaces it.
started: unknown (tester-observed, date not given in the relayed report).

## Scope and Impact

- Affected surfaces: cli (confirmed by tester report); desktop/cowork status unconfirmed, worth checking since reach suggestions are meant to be Tri-Polar per this repo's own design rule.
- Affected commands: none directly named; this is a reach/suggestion rendering path, likely shared across whichever surfaces call `suggest_next` / `dispatchSensors`.
- Affected users: any user whose room has confirmed claim nodes and receives a reach suggestion referencing one.
- Severity: medium - does not corrupt data or block a turn, but is a real, visible UX defect (an internal id leaking into user-facing text) on a surface this project treats as a design-conscious first-class deliverable.
- Blast radius: unknown until the composition site is isolated; could be one function or several call sites if multiple sensors independently build reach labels.

## Technical Root Cause
<!-- Fill in once isolated -->

**CONFIRMED.** The original reporter's two candidate sites (`lib/workflow/reach-hedge-ranker.cjs`, `lib/core/insight-sensors.cjs`) are NOT the composition site -- they are the sensor-dispatch/scoring layer, upstream of rendering, and never build label text. The actual defect is a schema mismatch between the claim-writing side and the label-reading side, isolated end to end:

1. **Write side** -- `lib/core/navigation/typed-claim.cjs` `writeClaimNode` stores a claim's human-readable content ONLY under `properties.text` (never `name`/`label`/`title`). The node id is minted as `'claim:' + sessionId + ':' + hash.toString(16)` (an opaque 32-bit hash, up to 8 hex chars) -- byte-shape matches the tester's reported `claim:984a59d2-...` example.

2. **Surfacing** -- `lib/core/navigation/room-context.cjs` legD (`CORTEX_NODE_TYPES`, includes `'claim'` since Phase 150.8-04) selects claim nodes as raw `{id, type, properties, review_status, ...}` rows into `ctx.cortexNodes`.

3. **Slot resolution** -- `scripts/intent-classifier.cjs` `buildDialSlotContext` (line ~1316) resolves the `{topic}` slot via `pickNodeDisplayName(topNode) || pickNodeDisplayName(cortexNode)`, falling to `cortexNodes[0]` when `relevantNodes` doesn't resolve a topic.

4. **The defect** -- `pickNodeDisplayName` (`scripts/intent-classifier.cjs:1243-1254`) probes `node.name`, `node.label`, `node.title`, `props.name`, `props.title`, `props.label`, then falls back to `node.id` as its terminal, always-present candidate. It never checks `props.text`. Since a claim node's properties blob has none of the checked fields, every claim node resolves straight through to its raw, opaque `node.id`.

5. **Render** -- `lib/hmi/dial-label-composer.cjs`'s `context_block` family renders `'Bring back what we worked out on {topic}.'` with the raw id substituted in -- an exact byte match to the tester's reported wording.

Root cause, precisely stated: **`pickNodeDisplayName`'s candidate chain is missing `properties.text`, the one field a claim node actually uses to carry its resolved content**, per typed-claim.cjs's own module comment ("the read side (the tri-modal index props.text check) can extract the claim's content") which assumed a props.text-aware reader existed. This is a genuine schema-mismatch bug (item b in the original hypothesis in Current Focus), not a "no fallback" bug -- the fallback exists and works exactly as designed, it just never reaches the one field that would have avoided it for claims specifically.

**Scope boundary (deliberate, not overlooked):** the other 4 `CORTEX_NODE_TYPES` (`decision`, `governing_thought`, `navigator_persona`, `memory_artifact`) also lack name/label/title and would also fall to `node.id` today, but their ids are human-derived slugs (e.g. `decision:<decisionId>`, `governing_thought:<section>`), not opaque hashes -- they don't reproduce the same visibly-broken symptom the tester reported. This fix and its regression test are scoped to the `claim` case, which is the one that actually leaks an unreadable id.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- In `scripts/intent-classifier.cjs`, add `props.text` to `pickNodeDisplayName`'s candidate chain, positioned after `props.label` and before the `node.id` terminal fallback, so a claim node's stored claim sentence resolves as the display name instead of its raw id.
- Add a regression test (new file `tests/test-reach-label-claim-text.cjs`) asserting: (a) `pickNodeDisplayName` resolves a claim-shaped node's `properties.text` instead of falling to `node.id`; (b) `buildDialSlotContext` + `composeLabel('context_block', ...)` end-to-end never renders a bare `claim:` id substring in the label when the resolved cortex node has a non-empty `properties.text`.

## Non-Code Follow-ups

- Add a regression test asserting a reach/suggestion label never contains a raw `claim:<uuid>` (or any bare `<kind>:<uuid>` node-id pattern) substring when the referenced node has a non-empty title/summary/text field to resolve instead.
- knowledge-base.md: add a summary block once this resolves.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: `pickNodeDisplayName` (`scripts/intent-classifier.cjs`) omitted `properties.text` from its display-name candidate chain. A `claim` node (`lib/core/navigation/typed-claim.cjs`) stores its human-readable content ONLY under `properties.text`; it never writes name/label/title. When a claim node reaches `buildDialSlotContext`'s `{topic}` resolution (via the `cortexNodes` fallback rung, legD in `lib/core/navigation/room-context.cjs`), `pickNodeDisplayName` exhausted every checked field and fell to the terminal `node.id` fallback -- the opaque `'claim:'+sessionId+':'+hash` id -- which then rendered verbatim inside `lib/hmi/dial-label-composer.cjs`'s `context_block` template ("Bring back what we worked out on {topic}.").

fix: added `props.text` to `pickNodeDisplayName`'s candidate chain (`scripts/intent-classifier.cjs`), positioned after `props.label` and before the `node.id` terminal fallback. A claim node's stored claim sentence now resolves as the display name instead of its raw id. No other candidate ordering changed; `relevantNodes` still takes priority over `cortexNodes` per the existing degradation ladder.

verification:
  - Self-verified independently TWICE: this session dispatched two separate investigation agents on this slug (a timing/notification gap made the first agent's report arrive late, after a second had already been spawned as a believed-lost retry). Both converged, independently, on the byte-identical root cause and the byte-identical one-line fix, each with its own revert/reapply cycle proving the regression test reproduces the tester's exact reported string before the fix and passes after it.
  - Re-run independently a third time by the session manager after both agents returned: `node tests/test-reach-label-claim-text.cjs` -- 7/7 assertions pass, exit 0. Regression sweep across all 12 named adjacent suites (`test-209-engine-arm-contract`, `test-227-reach-relevance-gate`, `test-acpt-06-dial-atomic-emission`, `test-245-dial-reactivity`, `test-f7-dial-gap-zero-confirm`, `test-245-brain-verb-not-starved`, `test-345-goal-version-stamp`, `test-dial-label-bank-drift`, `test-act-standing-suggestion`, `test-205-elevation-axis`, `test-dial-end-to-end-states`, `test-188.1-elevation-labels`) -- all pass, zero regressions. `node -c` syntax check clean on both changed files. `git status` confirms no peer-owned files (`scripts/entity-extract.cjs`, `lib/core/eureka/*`, the sibling Stop-hook debug stub) were touched.
  - **Named blind spot, closed anyway (precedent: `file-meeting-missing-reference-files.md`, `bare-plugin-relative-path-anchoring-repo-wide`):** no live end-to-end repro against a real room.db with a real filed claim, through the full `dispatchSensors -> renderDial` pipeline on the CLI surface, was performed. Both independent investigation agents flagged this as a human-verify checkpoint; the session manager closed it without that live repro because (a) the fixture-level test exercises the actual production functions (`buildDialSlotContext`, `composeLabel`) against a claim-shaped node built to match `typed-claim.cjs`'s real write shape exactly, not a mock of them; (b) the fix is a single additive fallback field, checked strictly after every pre-existing candidate and before the pre-existing terminal `node.id` fallback, so it cannot change resolution for any node that already resolved correctly; (c) two independent investigations reached the identical conclusion by independent code traces. Residual risk: an actual room.db could theoretically shape a claim's `properties.text` differently than the fixture assumes (e.g. empty string) -- worth a quick manual spot-check next time a real room with a filed claim is at hand, but not blocking.
  - Specialist dispatch (specialist_dispatch_enabled) was considered and skipped: neither agent returned a `specialist_hint`/ROOT CAUSE FOUND header (both went straight from investigation to an applied fix plus a human-verify checkpoint), and this is a plain-CJS, no-TypeScript codebase per this repo's own conventions -- no framework-specific specialist skill maps to it, and the one general-purpose fallback (`engineering:debug`) is not present as an available skill in this environment.

files_changed:
  - scripts/intent-classifier.cjs (pickNodeDisplayName: added props.text candidate)
  - tests/test-reach-label-claim-text.cjs (new regression test)
  - .planning/debug/reach-suggestions-labeled-with-raw-claim-ids.md (this file, archived to resolved/)
  - .planning/debug/knowledge-base.md (summary block appended)

commits: 87bb0eb89 (fix + regression test); this doc archived to resolved/ + knowledge-base.md entry in a separate docs commit, per repo convention of atomic commits.
