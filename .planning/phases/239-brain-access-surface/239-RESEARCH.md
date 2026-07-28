# Phase 239: Brain-Access Surface - Research

**Researched:** 2026-07-28
**Domain:** Claude Code hook matchers + MCP tool naming, Canon Part 8 runtime egress enforcement, guardrail placement
**Confidence:** HIGH (every load-bearing claim was reproduced live in this worktree or quoted verbatim from official Claude Code docs)

## Summary

All three requirements are real, and two of them are worse than the ROADMAP's phrasing assumes.

**BRAIN-01 is confirmed by official documentation, verbatim, not by inference.** The repo's two Part-8 hook matchers both read `"matcher": "mcp__brain_.*"`. The Brain MCP server is registered as `mindrian-brain` (`.mcp.json`) inside a plugin named `mos` (`.claude-plugin/plugin.json`), so the live registered tool names are `mcp__plugin_mos_mindrian-brain__brain_*`. Claude Code's own plugins reference says: "A matcher written against the bare server key never fires." I reproduced that empirically with `RegExp.test` in this worktree. But the dead seam is **three layers deep, not one**: beyond the two `hooks.json` matchers there is an in-hook re-check, `brain-response-sanitize.cjs::isBrainTool()`, which is a hard `indexOf('mcp__brain_') === 0` prefix test that BOTH hook scripts call. Fixing `hooks.json` alone leaves the guard shut. Worse, the entire existing test corpus feeds the fixture tool name `mcp__brain_query`, so every one of those tests passes green against a name that never occurs in production. That is exactly the vacuous-coverage shape this milestone's rigor standard exists to catch.

**BRAIN-02 is a live Canon Part 8 breach, and the obvious fix does not work.** `query()` makes zero guard calls; `sendPacket()` carries an in-code classifier belt (PB8-10). The guard genuinely covers only the unused door. Two real production paths push user-typed content through `query()`: `hatAwareRecommend()` interpolates Blue Hat `methodology_notes` into Cypher, and `suggestValidationSteps()` interpolates an opportunity's `domain` field, reached from `opportunity-ops.cjs:1359`. I then measured what would happen if you simply called `classify()` inside `query()`, and it **fails in two independent ways**: (a) the Cypher template's own word `Framework` satisfies the classifier's positive methodology recognizer, so an embedded canary is laundered from `ambiguous` to `allow`; (b) `sanitizeCypherInput` strips the `@` from an email before any scan runs, so `jane@startup.com` becomes `janestartup.com` and the PII regex stops matching, flipping a `block` into an `allow`. The guard must therefore run on **raw fields, before sanitization and before interpolation**, not on the assembled query string.

**BRAIN-03's honest answer is "park it."** A full census found zero production `sendPacket(` call sites; the only definition is its own in `brain-client.cjs`. The codebase already says so in a code comment (`navigation/packet.cjs:105`), while a test header (`test-150-brain-egress.cjs:12`) asserts the opposite. That contradiction should be resolved in the same change.

**Primary recommendation:** Fix the tool-name seam at all three layers with one shared authority, prove it live with a real MCP `tools/list` handshake through the already-shipped `checkHookMatcherLiveness` (Phase 239 is its first production consumer, exactly as Phase 235 designed); wire the Part-8 classifier into `query()` at the **raw-field, pre-sanitize** level following the shipped `bono/persona-research.cjs` classify-first precedent; and park `sendPacket` with a dated note, correcting the two contradictory in-repo claims about it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool-name matching for Brain hooks | Claude Code host (hooks.json matcher) | Node hook script (`isBrainTool` re-check) | The host decides whether a hook process even spawns; the script's re-check is defense-in-depth and must agree with the host, not diverge from it |
| Live Brain tool-name enumeration | Local MCP stdio server (`bin/mindrian-brain-mcp-client.cjs`) | - | The shim IS the registration authority; a real `tools/list` handshake is ground truth, a source-grep is a proxy |
| Part-8 content classification | `lib/core/part8-egress-guard.cjs` (pure LOCAL) | - | Already the constitutional chokepoint; do not add a second judge |
| Egress enforcement on the MCP tool door | PreToolUse hook (host-mediated) | - | Only the host can cancel a model-initiated tool call |
| Egress enforcement on the in-process door | `brain-client.cjs` call sites (`query`, `ask`, `search`) | - | Hooks never fire on an in-process Node function call; only in-code belts can cover this |
| Raw-field inspection for user content | Callers that hold the raw field (`hatAwareRecommend`, `suggestValidationSteps`) | `query()` backstop | Root-cause placement: only the caller still has the unsanitized, un-interpolated value |
| PII redaction of Brain responses | PostToolUse hook (`brain-response-sanitize-hook.cjs`) | - | Inbound direction; distinct from the outbound guard |

**Why the raw-field row matters:** the measured template-laundering and sanitizer-destroys-signal failures (see Common Pitfalls 1 and 2) both come from classifying at the wrong tier. A `query()`-level belt is a necessary backstop but is provably insufficient on its own.

## Standard Stack

This phase adds **no new external packages**. It is a wiring and placement fix over already-shipped modules.

### Core (all already in-repo)

| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `lib/core/seam-liveness.cjs` | `checkHookMatcherLiveness(matcherToolNames, liveToolNames)` | Phase 235-02 shipped it as the repo-wide helper explicitly naming Phase 239 as a consumer. It currently has **zero production consumers** for this wrapper [VERIFIED: grep] |
| `lib/core/part8-egress-guard.cjs` | `classify(payload, { toolName })` | The constitutional Part-8 judge. Pure LOCAL, zero network |
| `lib/core/brain-response-sanitize.cjs` | `isBrainTool()`, `sanitize()`, `PII_PATTERNS` | The PII sanitizer half of BRAIN-01 |
| `bin/mindrian-brain-mcp-client.cjs` | Registers the 6 Brain tools via `server.tool(...)` | The registration authority and therefore the live-name source of truth |
| `lib/core/brain-client.cjs` | `query`, `ask`, `search`, `sendPacket`, `callTool` | The wire layer holding both uncovered doors |

### Supporting

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/core/bono/persona-research.cjs` (lines 208-233) | Shipped classify-first-then-Brain precedent | Copy this control-flow shape for the `query()` fix |
| `lib/core/security/agentshield-run.cjs::gatherHookCommands` | Existing `hooks/hooks.json` walker | Reuse the JSON-walk shape when extracting matchers (it currently reads command strings only, never matchers) |
| `tests/run-all-196.sh` | The Part-8 SKIP-safe aggregator pattern | Model `tests/run-all-239.sh` on it |
| `MINDRIAN_BRAIN_URL` env override (`brain-client.cjs:24`) | Redirects the wire to a local capture server | SC2's "captured mock transport" (see Pitfall 4) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Live `tools/list` handshake | Regex-grep `server.tool('<name>'` out of the shim source | Faster and dependency-free, but it is a proxy for registration, not registration itself. Phase 235's own census-versus-probe doctrine says the probe is the one that cannot lie. Handshake measured at roughly 2-4s; acceptable for a gate, not for a per-commit hook. **Recommendation: handshake in the phase gate, with the source-grep as a cheap pre-commit tier if speed forces it.** |
| Widening `isBrainTool` to a regex | Deleting the in-hook re-check entirely | Deleting removes defense-in-depth the hook's own comment calls the "OQ-1 backstop". Keep it, but derive it from the same authority as the matcher |
| A `__transport` seam on `query()` | `MINDRIAN_BRAIN_URL` pointed at a local HTTP server | The env override already exists and exercises the REAL `callTool` code path including SSE parsing. Adding a seam would let the test bypass the very code it claims to prove |

**Installation:** none. No package changes.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages; every module it touches is already in-repo. No `npm install`, no `pip install`, no new dependency in `package.json`. The Package Legitimacy Gate is therefore vacuous here and slopcheck was not run.

## Architecture Patterns

### System Architecture Diagram

```
                       TWO INDEPENDENT DOORS INTO THE BRAIN

  DOOR A: model-initiated MCP tool call        DOOR B: in-process Node call
  ------------------------------------        ----------------------------
  Larry / Claude                               lib/core/opportunity-ops.cjs:1359
      |                                        lib/core/*  (any caller)
      v                                            |
  Claude Code host                                 v
      |                                        brain-client.hatAwareRecommend()   <- Blue Hat notes
      |  matcher test: "mcp__brain_.*"         brain-client.suggestValidationSteps() <- opportunity.domain
      |  vs mcp__plugin_mos_mindrian-brain__       |
      |  => NO MATCH  ==> hook NEVER spawns        |  sanitizeCypherInput()  <-- strips '@', kills PII signal
      X (dead seam, B-1)                           |
      |                                            v
      |                                        string-interpolate into Cypher template
      v                                            |   (template word "Framework" launders payload)
  scripts/part8-egress-guard-hook.cjs               v
      |                                        brain-client.query(cypher)
      |  isBrainTool(toolName) re-check             |
      |  indexOf('mcp__brain_')===0                 |   *** ZERO guard call ***  (B-3)
      |  => false ==> allow()                       v
      X (second dead seam, same root cause)     callTool('brain_query')
                                                    |
                                                    v
  lib/core/part8-egress-guard.classify()   <---- THE WIRE (BRAIN_URL) ---->  remote Brain
      ^                                            ^
      |                                            |
      +--- called ONLY from:                       |
           sendPacket() PB8-10 belt  ---------------+
           (ZERO production callers, B-2)

  INBOUND: Brain response --> PostToolUse "mcp__brain_.*" --> also NO MATCH
           --> brain-response-sanitize-hook.cjs never runs (PII sanitizer, B-1)
```

Read the diagram as: the classifier is healthy and correct; every path that is supposed to reach it is severed. Door A is severed twice (host matcher, then in-hook re-check). Door B was never wired at all. The one path that does reach the classifier (`sendPacket`) has no callers.

### Component Responsibilities

| File | Line(s) | Responsibility | State |
|------|---------|----------------|-------|
| `hooks/hooks.json` | 236 | PreToolUse matcher -> `part8-egress-guard-hook.cjs` | DEAD (never fires) |
| `hooks/hooks.json` | 338 | PostToolUse matcher -> `brain-response-sanitize-hook.cjs` | DEAD (never fires) |
| `lib/core/brain-response-sanitize.cjs` | 83-85 | `isBrainTool()` prefix re-check | DEAD (rejects all live names) |
| `scripts/part8-egress-guard-hook.cjs` | 144 | Calls `isBrainTool`, `allow()`s on false | Correct code, unreachable gate |
| `scripts/brain-response-sanitize-hook.cjs` | 72 | Same re-check | Correct code, unreachable gate |
| `lib/core/brain-client.cjs` | 654-742 | `hatAwareRecommend` (Blue Hat door) | UNGUARDED |
| `lib/core/brain-client.cjs` | 758-844 | `suggestValidationSteps` (opportunity door) | UNGUARDED |
| `lib/core/brain-client.cjs` | 375-386 | `query()` | UNGUARDED |
| `lib/core/brain-client.cjs` | 1273-1298 | `sendPacket` PB8-10 classifier belt | GUARDED but unreachable (no callers) |
| `bin/mindrian-brain-mcp-client.cjs` | 72-154 | Registers the 6 live tool names | Healthy |
| `lib/core/seam-liveness.cjs` | 112-119 | `checkHookMatcherLiveness` | Shipped, ZERO production consumers |

### Pattern 1: Classify raw fields BEFORE sanitize and BEFORE interpolation

**What:** the guard call happens where the raw, user-typed value still exists as its own string.
**When to use:** every `brain-client` function that interpolates a caller-supplied value into Cypher.
**Why:** measured. See Pitfalls 1 and 2 for the two failure modes this avoids.

```javascript
// Source: shape adapted from the SHIPPED precedent at
// lib/core/bono/persona-research.cjs:208-233 (classify-first, skip on non-allow)
async function suggestValidationSteps(opportunity, options = {}) {
  if (!isAvailable()) return null;
  if (!opportunity || !opportunity.problem) return null;

  // BEFORE sanitizeCypherInput, BEFORE any template interpolation.
  // The raw field is the only place the content signal is still intact.
  const guard = require('./part8-egress-guard.cjs');
  const fieldVerdict = guard.classify(
    { question: String(opportunity.domain || '') },
    { toolName: 'brain_ask' }   // free-form string path
  );
  if (!fieldVerdict || fieldVerdict.verdict !== 'allow') {
    // fail-closed: skip the Brain leg, degrade to LOCAL, disclose the reason.
    return null;
  }

  const safeDomain = sanitizeCypherInput(opportunity.domain || '').substring(0, 100);
  // ... existing template interpolation unchanged ...
}
```

### Pattern 2: One tool-name authority consumed by all three layers

**What:** a single exported matcher source that `hooks.json`, `isBrainTool`, and the liveness gate all derive from.
**Why:** the current bug is one wrong string copied into three places that then drifted independently. Fixing three literals reproduces the same failure mode on the next rename.

`hooks.json` cannot `require()` anything, so the authority cannot literally generate the matcher at runtime. The workable shape is: export the canonical pattern from a CJS module, have `isBrainTool` use it directly, and have a **test assert that `hooks.json`'s two matcher strings equal the exported pattern**. That converts a silent drift into a red test.

```javascript
// lib/core/brain-response-sanitize.cjs (proposed)
// Covers BOTH scopes: plugin-installed (mcp__plugin_mos_mindrian-brain__*)
// and project-scoped dev checkout (mcp__mindrian-brain__*).
const BRAIN_TOOL_MATCHER = 'mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*';

function isBrainTool(toolName) {
  return typeof toolName === 'string' &&
    new RegExp('^' + BRAIN_TOOL_MATCHER + '$').test(toolName);
}
```

Note the deliberate asymmetry: `hooks.json` gets the unanchored pattern (that is how Claude Code evaluates it), while `isBrainTool` anchors it. Anchoring in-code is the tighter posture and closes the impersonation threat in the threat model below.

### Pattern 3: Live enumeration by real handshake

```javascript
// VERIFIED: this exact handshake was run in this worktree on 2026-07-28 and
// returned ["brain_ask","brain_query","brain_schema","brain_search",
//           "brain_stats","brain_write"] with NO Brain API key present.
// Registration happens at module load, before any network call, so this is
// fully offline and hermetic.
//
// 1. spawn: node bin/mindrian-brain-mcp-client.cjs   (stdio)
// 2. write: {"jsonrpc":"2.0","id":1,"method":"initialize",
//            "params":{"protocolVersion":"2024-11-05","capabilities":{},
//                      "clientInfo":{"name":"probe","version":"1"}}}
// 3. write: {"jsonrpc":"2.0","method":"notifications/initialized"}
// 4. write: {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
// 5. read result.tools[].name -> the 6 BARE names
// 6. compose full names: 'mcp__plugin_' + pluginName + '_' + serverName + '__' + bare
//    pluginName from .claude-plugin/plugin.json ("mos")
//    serverName from .mcp.json mcpServers key ("mindrian-brain")
```

Then feed those composed names to the shipped helper:

```javascript
const { checkHookMatcherLiveness } = require('../lib/core/seam-liveness.cjs');
// claims = the tool names the matchers actually match (computed by testing each
//          live name against the matcher regex, NOT hand-listed)
// live   = the composed names from the handshake
const verdict = checkHookMatcherLiveness(claimedToolNames, liveToolNames);
// verdict.ok === false today; must be true after the fix.
```

### Anti-Patterns to Avoid

- **Hand-listing the 6 tool names in the test.** Phase 235 Decision (e) explicitly rejected hardcoded counts because "a hardcoded expect-10 rots the day someone adds a tool file and the natural fix is to bump the literal, which trains people to edit the gate instead of trusting it." Enumerate from the handshake at run time.
- **Fixing `hooks.json` only.** `isBrainTool` still returns false and both hooks still `allow()`. The gate stays shut and every test still passes.
- **Calling `classify()` inside `query()` and stopping there.** Measured to produce `allow` on a canary because of template laundering. Necessary as a backstop, not sufficient as the fix.
- **Updating the existing test fixtures from `mcp__brain_query` to the new name without asserting the name is live.** That just moves the fiction. The fixture name must come from the same enumeration the production gate uses.
- **A matcher of `mcp__.*brain.*`.** Over-broad; see threat model T3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this hook matcher alive?" | A new per-phase liveness checker | `seam-liveness.cjs::checkHookMatcherLiveness` | Phase 235-02 shipped it naming Phase 239 as a consumer; its red/green semantics are already frozen by `seam-liveness.test.cjs` (10/10). Building a second one is the exact duplication Canon Part 7 forbids |
| Part-8 content classification | A second pattern list or a private judge | `part8-egress-guard.cjs::classify` | PB8-02 already forbids a private `FORBIDDEN_PATTERNS` copy; `run-all-196.sh` has a grep-guard leg that fails on one |
| Classify-then-call control flow | A fresh design | `lib/core/bono/persona-research.cjs:208-233` | Shipped, tested, fail-closed with a disclosed `brain_skipped` marker |
| Capturing the outbound wire | A `__transport` seam on `query()` | `MINDRIAN_BRAIN_URL` + a local HTTP server | The env override exists and exercises the real `callTool` path; a seam would let the test skip the code under test |
| Walking `hooks.json` | A bespoke JSON traversal | The `gatherHookCommands` shape in `agentshield-run.cjs:127-145` | Already handles the nested `hooks[type][].hooks[]` structure |
| A Part-8 test aggregator | A new runner idiom | `tests/run-all-196.sh` | The SKIP-safe `run_if` pattern guarded on the RUNTIME module (not the test file) is this repo's convention |

**Key insight:** every primitive this phase needs is already on disk. The entire phase is re-pointing dead wires at live ends and moving one guard call to the correct tier. Any net-new module in a plan for this phase deserves a hard justification.

## Common Pitfalls

### Pitfall 1: Template laundering (MEASURED, will silently defeat the obvious fix)

**What goes wrong:** you wire `classify()` into `query()`, the test with a canary passes as `allow`, and you ship a guard that inspects nothing.
**Why it happens:** `part8-egress-guard.cjs`'s `METHODOLOGY_VOCAB` (line 64-77) includes `framework`. Every production Cypher template in `hatAwareRecommend` and `suggestValidationSteps` contains `(f:Framework)`. The positive recognizer is satisfied by the **template's own vocabulary**, and the user payload rides along.
**Measured in this worktree:**

```
classify({cypher:"CANARY7F3A2B"})                                  -> ambiguous / freeform_unmatched
classify({cypher:'MATCH (f:Framework) WHERE x="CANARY7F3A2B"'})    -> allow / move_set
```

**How to avoid:** classify the raw field on its own, before interpolation (Pattern 1).
**Warning sign:** a canary test that passes on the first try without the classifier ever returning `block` or `ambiguous`.

### Pitfall 2: `sanitizeCypherInput` destroys the PII signal (MEASURED)

**What goes wrong:** an email in an opportunity field classifies as `allow` even though the guard would have blocked it.
**Why it happens:** `sanitizeCypherInput` (`brain-client.cjs:83-93`) is a **Cypher-injection** sanitizer, `value.replace(/[^a-zA-Z0-9 ._-]/g, '')`. It strips `@`. The Part-8 email pattern `\b[\w.+-]+@[\w-]+\.[\w.-]+\b` then no longer matches. A security control silently disarms a different security control.
**Measured in this worktree:**

```
classify raw       'jane@startup.com'  inside template -> block
classify sanitized 'janestartup.com'   inside template -> allow
```

**How to avoid:** the guard call must be strictly upstream of `sanitizeCypherInput`.
**Warning sign:** a PII canary that blocks in a unit test on the classifier but allows in the end-to-end run.

### Pitfall 3: Fixing one of the three layers

**What goes wrong:** the matcher is corrected, the phase is declared done, the gate is still shut.
**Why it happens:** three independent copies of the wrong string: `hooks.json:236`, `hooks.json:338`, `brain-response-sanitize.cjs:84`. Both hook scripts call `isBrainTool` and `allow()` on false.
**How to avoid:** the liveness gate must assert all three, and the plan must carry a census criterion covering every `mcp__brain_` literal in tracked source.
**Additional live instances found (decide in-scope or logged):** `agents/persona-analyst.md:12-13` declares `mcp__brain_search` / `mcp__brain_query` in `allowed-tools` (that agent cannot actually reach the Brain today); `lib/core/grill-engine.cjs:172,286` synthesize `toolName: 'mcp__brain_ask'`; `lib/core/eureka/online-pattern-query.cjs:22` documents the dead matcher as current fact.

### Pitfall 4: SC2's "captured mock transport" has no seam on `query()`

**What goes wrong:** the plan assumes `query()` accepts an injectable transport the way `sendPacket` does.
**Why it happens:** `sendPacket` has `opts.__transport` (`brain-client.cjs:1303`). `query()` does not; it calls `callTool` directly with no options parameter at all.
**How to avoid:** use `MINDRIAN_BRAIN_URL` (`brain-client.cjs:24`) pointed at a local `node:http` server that records the request body. The test must also set a Brain key so `isAvailable()` returns true. Note `callTool` parses an **SSE** response (`text.split('\n').find(l => l.startsWith('data: '))`), so the capture server must reply in that shape or `callTool` returns null.

### Pitfall 5: The existing test corpus locks in the dead name

**What goes wrong:** you fix production and a dozen tests go red, or worse, they stay green and prove nothing.
**Why it happens:** `tests/part8-egress-guard-hook.test.cjs`, `lib/core/part8-egress-guard.test.cjs`, `tests/test-brain-response-sanitize.cjs:187-194` all use `mcp__brain_query` / `mcp__brain_ask` fixtures. `test-brain-response-sanitize.cjs:189` even asserts `isBrainTool('mcp__brain_') === true` "per spec".
**How to avoid:** treat these as **assertions to invert**, following the Phase 243 precedent where superseded assertions were inverted rather than deleted, and the inversion itself became the mutation gate.

### Pitfall 6: Two scopes, not one

**What goes wrong:** a matcher pinned to `mcp__plugin_mos_mindrian-brain__.*` works for installed users and silently dies in the dev checkout (and vice versa).
**Why it happens:** this repo's root `.mcp.json` is both the plugin's bundled server declaration AND a project-scoped `.mcp.json` when the repo itself is opened in Claude Code. Plugin scope yields `mcp__plugin_mos_mindrian-brain__*`; project scope yields `mcp__mindrian-brain__*`.
**How to avoid:** one pattern covering both, e.g. `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*`. This is also a Tri-Polar concern: Desktop and Cowork resolve the plugin scope, CLI-in-dev-repo may resolve the project scope.

## Code Examples

### Reproducing B-1 (the exact probe used for this research)

```javascript
// VERIFIED in this worktree, 2026-07-28.
const m = 'mcp__brain_.*';
new RegExp(m).test('mcp__plugin_mos_mindrian-brain__brain_ask'); // false
new RegExp(m).test('mcp__mindrian-brain__brain_ask');            // false
new RegExp(m).test('mcp__brain_ask');                            // true  (fiction)

const s = require('./lib/core/brain-response-sanitize.cjs');
s.isBrainTool('mcp__plugin_mos_mindrian-brain__brain_query');     // false
s.isBrainTool('mcp__mindrian-brain__brain_query');                // false
s.isBrainTool('mcp__brain_query');                                // true  (fiction)
```

### The two unguarded user-content doors (verbatim shape)

```javascript
// lib/core/brain-client.cjs:680-694  -- Blue Hat notes -> Cypher -> query()
const blueNotes = hatStates.blue.methodology_notes || [];
const avoidPatterns = blueNotes
  .filter(n => /ineffective|didn't work|not useful|skip|avoid/i.test(n))
  .map(n => { const match = n.match(/^(\w[\w\s]+?)\s+(?:was|is|were|proved)\s/i);
              return match ? match[1].trim() : null; })
  .filter(Boolean);
const avoidClause = avoidPatterns.length > 0
  ? `AND NOT ANY(avoid IN [${avoidPatterns.map(a => `"${sanitizeCypherInput(a)}"`).join(', ')}] WHERE f.name CONTAINS avoid)`
  : '';
// ... interpolated into `cypher`, then:  const result = await query(cypher);   <-- no guard

// lib/core/brain-client.cjs:765-775  -- opportunity.domain -> Cypher -> query()
const safeDomain = sanitizeCypherInput(opportunity.domain || '').substring(0, 100);
const matchCypher = `
  MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
  WHERE pt.name CONTAINS "${safeDomain}" ...`;
// ... await Promise.all([query(matchCypher), query(chainCypher)]);            <-- no guard
```

Reached in production from `lib/core/opportunity-ops.cjs:1359` (`brain.suggestValidationSteps(opportunity)`).

### The shipped classify-first precedent to clone

```javascript
// Source: lib/core/bono/persona-research.cjs:208-233 (SEED-059, fail-closed)
if (brainFn) {
  const brainPayload = { ask: handle, question: handle };
  let verdict = null;
  try { verdict = classifyFn(brainPayload, { toolName: 'brain_ask' }); }
  catch (_e) { verdict = null; }
  if (verdict && verdict.verdict === 'allow') {
    try { brain_hints = await brainFn(brainPayload); }
    catch (_e) { brain_hints = null; brain_skipped = true;
                 degraded_reasons.push('brain_call_threw'); }
  } else {
    brain_skipped = true;
    degraded_reasons.push('brain_egress_' + (verdict && verdict.verdict ? verdict.verdict : 'unverified'));
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mcp__brain_*` bare-server matcher | `mcp__plugin_<plugin>_<server>__<tool>` for plugin-bundled servers | Documented in current Claude Code plugins reference | The repo's matchers have almost certainly been dead since the plugin was distributed via the marketplace rather than as a local project |
| Single-underscore `mcp__brain_` | Spec requires **double** underscore: `mcp__<server>__<tool>` | Current hooks docs | Even a corrected server name with a single underscore would still fail |
| Assume a matcher error is visible | Claude Code never validates matchers against a live registry; a dead matcher silently no-ops forever | Recorded in `seam-liveness.cjs:89-110` (Phase 235) | External liveness assertion is the only available signal. This is precisely why SC1 exists |

**Deprecated / outdated in-repo:**
- `lib/core/brain-response-sanitize.cjs:78` comment "scope is `mcp__brain_*` tool calls" - false today.
- `scripts/part8-egress-guard-hook.cjs:140` comment "the matcher scopes this hook to `mcp__brain_.*`" - true of the config, false of reality.
- `lib/core/seam-liveness.cjs:96-100` cites this repo's own `"mcp__brain_.*"` as **corroborating evidence for the correct shape**. It is the opposite: the citation launders the bug into the helper's own grounding comment. Correct it in the same change.
- `tests/test-150-brain-egress.cjs:12` "Phase 150 is the FIRST real sendPacket consumer" - contradicted by the census and by `navigation/packet.cjs:105`.

## Runtime State Inventory

Included because BRAIN-01 is effectively a rename/re-point of a matched identifier across surfaces.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** The tool name is never persisted. `part8-egress-ontology.record()` writes only scalars (`verdict`, `class`, `matched_pattern`, `count`) into room.db, never `tool_name`. Verified by reading the `bestEffortRecord` call in `part8-egress-guard-hook.cjs:94-118`. | none |
| Live service config | **None external.** The Brain MCP server is local stdio (`bin/mindrian-brain-mcp-client.cjs`); there is no remote dashboard, tag, or hosted workflow holding this string. The remote Brain is addressed by URL, not by tool name. | none |
| OS-registered state | **None.** No Task Scheduler / pm2 / systemd registration embeds a Brain tool name. | none |
| Secrets / env vars | `MINDRIAN_BRAIN_KEY`, `MINDRIAN_BRAIN_URL`, `PART8_FORCE_BRAIN_AVAILABLE`. **None contain the tool name**; all are unaffected by this rename. | none |
| Build artifacts / installed packages | **`~/.claude/plugins/mos/` install cache and `dist/` carry the old matcher.** Users do not pick up a `hooks.json` change until a release ships AND they run the two-command update. Per the standing hard rule, this fix is NOT live for any user until a release ships and is picked up. | Ship in a release; state the non-liveness plainly in the phase summary |

**The canonical question answered:** after every tracked file is fixed, the only stale copy of the old matcher is in already-installed plugin caches, which is a release-distribution concern, not a data-migration one.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (engines `>=22.5.0`) | - |
| `bin/mindrian-brain-mcp-client.cjs` stdio handshake | SC1 live enumeration | yes, offline, no key needed | verified 2026-07-28 | source-grep of `server.tool('<name>'` |
| `@modelcontextprotocol/sdk`, `zod` | the shim | yes (vendored `node_modules`) | per `package.json` | `mcp-dep-heal` self-heals |
| `node:sqlite` | Part-8 telemetry legs | yes (experimental warning emitted) | bundled | tests SKIP with exit 77, existing convention |
| `node:http` local capture server | SC2 wire capture | yes (built-in) | - | - |
| Live remote Brain / `MINDRIAN_BRAIN_KEY` | nothing in this phase | not required | - | `PART8_FORCE_BRAIN_AVAILABLE` + `MINDRIAN_BRAIN_URL` cover every leg offline |
| `langtalks-graph-expert` MCP | mandatory grounding | reachable via direct stdio JSON-RPC only (MCP tools absent from this agent's surface) | - | drove the stdio server directly, Phase 237 precedent |
| `claude-api` skill / `claude-code-guide` agent | mandatory grounding | **NOT installed** (`~/.claude/agents/` has no `claude-code-guide`; no `claude-api` skill) | - | used official `code.claude.com` docs directly, same as Phase 237 |

**Missing dependencies with no fallback:** none. Every phase leg is runnable offline in this worktree.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Plain Node.js scripts, `node:assert` / `assert`, `child_process.spawnSync`. No Jest/Mocha/Vitest anywhere |
| Config file | none (by design; CJS-only convention per CLAUDE.md) |
| Quick run command | `node tests/<file>.cjs` |
| Full suite command | `bash tests/run-all-239.sh` (**does not exist yet - Wave 0 gap**) |
| Aggregator convention | `tests/run-all-196.sh`: `run_if` guarded on the RUNTIME module, not the test file, so Wave 0 exits clean with SKIPs |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAIN-01 | Live `tools/list` handshake returns the 6 bare names offline | integration | `node tests/test-239-brain-tool-liveness.cjs` | NO - Wave 0 |
| BRAIN-01 | `checkHookMatcherLiveness(claimed, live).ok === true` after fix | unit | same file | NO - Wave 0 |
| BRAIN-01 | Mutation: rename a live tool in the shim -> verdict red | mutation | same file | NO - Wave 0 |
| BRAIN-01 | Mutation: stale one `hooks.json` matcher -> verdict red | mutation | same file | NO - Wave 0 |
| BRAIN-01 | `isBrainTool()` true for both plugin- and project-scoped names, false for a foreign server | unit | `node tests/test-brain-response-sanitize.cjs` (INVERT lines 186-194) | YES - assertions to invert |
| BRAIN-01 | PostToolUse PII sanitizer hook fires on a live tool name | integration | `node tests/test-239-pii-sanitizer-liveness.cjs` | NO - Wave 0 |
| BRAIN-02 | Canary in `opportunity.domain` caught before the wire | e2e | `node tests/test-239-query-egress-canary.cjs` | NO - Wave 0 |
| BRAIN-02 | Canary in a Blue Hat `methodology_notes` entry caught before the wire | e2e | same file | NO - Wave 0 |
| BRAIN-02 | Capture server records ZERO canary bytes | e2e | same file | NO - Wave 0 |
| BRAIN-02 | Mutation: remove the `query()` coverage -> canary reaches the capture -> red | mutation | same file | NO - Wave 0 |
| BRAIN-02 | Regression: template laundering cannot return (Pitfall 1) | unit | same file | NO - Wave 0 |
| BRAIN-02 | Regression: sanitize-before-classify ordering cannot return (Pitfall 2) | unit | same file | NO - Wave 0 |
| BRAIN-03 | Census asserts zero production `sendPacket(` call sites outside the allowlist | unit | `node tests/test-239-sendpacket-parked.cjs` | NO - Wave 0 |
| BRAIN-03 | The dated park note exists at the call surface AND in docs | unit | same file | NO - Wave 0 |

### Sampling Rate

- **Per task commit:** the single test file the task touches (`node tests/test-239-*.cjs`), plus `node lib/core/seam-liveness.test.cjs`.
- **Per wave merge:** `bash tests/run-all-239.sh`.
- **Phase gate:** `bash tests/run-all-239.sh` green, plus the no-regression sweep this repo already uses - `bash tests/run-all-196.sh`, `node scripts/build-connector-registry.cjs --check`, `bash tests/run-all-235.sh`.

### Wave 0 Gaps

- [ ] `tests/run-all-239.sh` - SKIP-safe aggregator on the `run-all-196.sh` pattern, authored before any code lands
- [ ] `tests/test-239-brain-tool-liveness.cjs` - covers BRAIN-01 (handshake, matcher liveness, both mutations)
- [ ] `tests/test-239-query-egress-canary.cjs` - covers BRAIN-02 (both canary doors, capture, mutation, both regression legs)
- [ ] `tests/test-239-pii-sanitizer-liveness.cjs` - covers the PostToolUse half of BRAIN-01
- [ ] `tests/test-239-sendpacket-parked.cjs` - covers BRAIN-03
- [ ] Shared helper: local SSE-shaped capture server (`MINDRIAN_BRAIN_URL` target). No such helper exists in `tests/` today
- [ ] No framework install needed

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is required. This phase IS a security phase: Canon Part 8 is titled "The Graph Boundary (Security Constitution)".

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Brain key handling is out of scope (already covered by SEC-02 file-permission checks) |
| V3 Session Management | no | - |
| V4 Access Control | **yes** | The hook matcher IS the access-control boundary on the Brain door. Currently open |
| V5 Input Validation | **yes** | `part8-egress-guard.classify()` on raw fields; `sanitizeCypherInput` for injection (keep both, order matters) |
| V6 Cryptography | no | `sha256:` projection hashing already shipped in `packet.cjs`; unchanged here |
| V7 Error Handling / Logging | **yes** | Fail-OPEN posture (A3) is a deliberate accepted risk on the hook; the in-code belt must be fail-CLOSED. Telemetry must carry no offending bytes (already honored: `part8-egress-ontology` writes scalars only) |
| V8 Data Protection | **yes** | This is the core: user-typed content must not egress |

### Known Threat Patterns

| # | Pattern | STRIDE | Severity | Standard Mitigation |
|---|---------|--------|----------|---------------------|
| T1 | **Silent matcher death after a future rename.** Server or plugin renamed; matcher stops firing; nothing warns; the boundary reopens with every surface green. This is the recurrence of B-1 | Information Disclosure | **HIGH** | The SC1 liveness gate must run in a gate that actually blocks, not only in a phase test. Wire it into `build-connector-registry.cjs --check` (already pre-commit-live per Phase 235-01) or `verify-release`, mirroring how Phase 238-06 wired `checkMintRatifierLiveness` into `verify-release` section 18 |
| T2 | **User content egress via `query()`.** Live today. Blue Hat notes and opportunity fields cross the wire uninspected | Information Disclosure | **HIGH** | Pattern 1: classify raw fields pre-sanitize, pre-interpolation, fail-closed |
| T3 | **Matcher over-broadening during the fix.** A loose pattern like `mcp__.*brain.*` would let a third-party MCP server named e.g. `evil-brain` be treated as the trusted Brain, routing its payloads through a guard tuned for a different contract and its responses through a PII sanitizer that would rewrite them | Spoofing / Tampering | MEDIUM | Anchor `isBrainTool` (`^...$`) and bound the plugin-prefix group to `[a-z0-9_-]+`. Add a negative test for a foreign server name |
| T4 | **Template laundering as a bypass.** Any attacker-influenced or user-typed value inside a Cypher template inherits the template's `allow` verdict | Information Disclosure | **HIGH** | Pitfall 1 remedy; add the regression leg so it cannot silently return |
| T5 | **Sanitizer-disarms-detector ordering.** `sanitizeCypherInput` removes the `@` the PII pattern keys on | Information Disclosure | MEDIUM | Pitfall 2 remedy; assert ordering with a dedicated test |
| T6 | **Fail-OPEN hook posture.** `part8-egress-guard-hook.cjs` exits 0 on any internal error, including a failed `require` of the sanitizer | Information Disclosure | LOW (accepted, A3) | Documented accepted risk. Do NOT flip it in this phase, but the in-code `query()` belt should be fail-CLOSED so the two postures complement rather than duplicate |
| T7 | **Vacuous test coverage.** Tests asserting a fictional tool name will keep passing after a real regression | Repudiation | MEDIUM | Fixtures must be derived from the live enumeration, not literals |

**Three `high` severity items (T1, T2, T4).** Per the security threat-model gate, the plan must carry an explicit mitigation task and an acceptance criterion for each; none may be deferred without a navigator ruling.

## Project Constraints (from CLAUDE.md)

| Constraint | Applies How |
|------------|-------------|
| **Canon Part 8** (LOCAL -> BRAIN: NO) | The subject of the phase. Part 8's own text (`MINDRIAN-CANON.md:282`) defines a breach as "any code path that ... queries the Brain with a payload containing user-specific strings" - which is exactly what `hatAwareRecommend` / `suggestValidationSteps` do today |
| **Canon Part 7** (Reuse Before Build) | Enforced above: reuse `checkHookMatcherLiveness`, `classify`, `persona-research`'s control flow, `run-all-196.sh`'s aggregator shape, `agentshield-run`'s hooks.json walker |
| **Canon Part 11** (CIRS born-wired) | A new `tests/` file is not an invocable surface, but any new `commands/` or `agents/` surface would need a `connector:` block. This phase should need none |
| **Canon Part 6** (Dog-fooding) | A Part-8 breach in the plugin's own code is precisely the CONTRADICTS-edge case Part 6 anticipates |
| **No em-dashes anywhere** | Hyphens only, in code, comments, plans, and docs |
| **CJS only, no TypeScript** | `lib/core/*.cjs`; no build step |
| **Tri-Polar (CLI / Desktop / Cowork)** | Directly load-bearing: the plugin-scope vs project-scope tool-name difference (Pitfall 6) is a three-surface concern, not a cosmetic one. A skip on any surface must be a stated call |
| **Grounding: `claude-api` skill + `claude-code-guide` agent** for Claude Code hooks/MCP questions | Neither is installed in this environment; official `code.claude.com` docs used directly and the substitution is recorded here (Phase 237 precedent) |
| **Grounding: langtalks-graph-expert** for agent/LLM concepts | Consulted; see Sources. Honest result: not in the corpus |
| **Grounding: Context7** for named-library behavior | Not applicable; this phase adds no library. The authoritative source for hook/MCP semantics is Claude Code's own docs |
| **Dev-Research Compositing** | This research should be mirrored to `~/MindrianRooms/rethinking-mindrianos/research/`. Note the standing worktree-isolation limitation logged in Phase 243 may block the write; state it plainly rather than claiming it done |
| **GSD workflow enforcement** | No direct repo edits outside a GSD plan |
| **Release liveness hard rule** | A `hooks.json` fix on `main` is NOT live for any user until a release ships and is picked up. Say so in the summary |
| **RCA standard** | Findings route to `.planning/debug/<slug>.md` per `docs/RCA-TEMPLATE.md`; `.planning/` is gitignored, so `git add -f` |

**Project skills discovered:** `.claude/skills/agentshield/` (plugin self-scan over five config surfaces including `hooks/hooks.json`). Its runner reads hook **command strings only, never matchers** - a genuine coverage gap adjacent to this phase, and a candidate reuse point for the matcher extraction. Note: CLAUDE.md's Project Skills table lists `docu-optimizer`, which is not present on disk; minor doc drift, out of scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The live registered name in an installed session is `mcp__plugin_mos_mindrian-brain__brain_*` | BRAIN-01 | LOW. Composed from `plugin.json:name="mos"` + `.mcp.json` key `mindrian-brain` + the official `mcp__plugin_<plugin-name>_<server-name>__<tool>` spec, and independently corroborated by the orchestrator's own live tool list. If wrong, the matcher is still dead, only the correct replacement changes |
| A2 | Both scopes (plugin-installed and project-scoped dev checkout) can occur and both need covering | Pitfall 6 | MEDIUM. Inferred from the repo's `.mcp.json` sitting at a path that serves both roles. If only one scope ever occurs, a broader matcher is harmless; if both occur and only one is covered, the gate dies on the other surface. **Worth a navigator confirmation or a one-session empirical check** |
| A3 | `sendPacket` should be PARKED rather than wired | BRAIN-03 | LOW-MEDIUM. The census fact (zero callers) is verified; the *decision* is a judgment call. Wiring it to a real job is net-new feature work inside a remediation-only milestone, which the milestone's own scope forbids. BRAIN-03 is explicitly "a decision, not a bug fix", so this is a navigator-equivalent ruling the plan should record openly, in the Phase 238 precedent style |
| A4 | The `tools/list` handshake stays reliable in CI-like conditions | SC1 | LOW. Measured offline with no key; the shim's `ensureDepsPresent` self-heal could add first-run latency. Give the probe a generous timeout and a source-grep fallback tier |
| A5 | Correcting `seam-liveness.cjs`'s grounding comment is in scope | State of the Art | LOW. It is a comment, but it currently cites the bug as evidence of correctness, which would mislead the next maintainer. Cheap to fix in the same commit |

## Open Questions

1. **Which scope does the gate assert against?**
   - What we know: plugin scope and project scope produce different names; the official spec covers plugin scope explicitly.
   - What's unclear: whether this repo ever actually loads the Brain server project-scoped in practice.
   - Recommendation: cover both with one pattern (cost is a single optional regex group) and add a test for each. Do not spend a phase leg resolving the ambiguity.

2. **Where does the SC1 liveness gate get wired so it is load-bearing?**
   - What we know: Phase 235 SC3 and Phase 238-06 both established that a liveness check must have a production consumer or it is decorative. `build-connector-registry.cjs --check` is pre-commit-live; `verify-release` is release-time.
   - What's unclear: whether a 2-4s MCP handshake is acceptable inside a pre-commit hook.
   - Recommendation: **`verify-release` for the handshake-backed gate; a cheap source-grep parity assertion at pre-commit.** Two tiers, one authority.

3. **Is `agents/persona-analyst.md`'s dead `allowed-tools` list in scope for BRAIN-01?**
   - What we know: it names `mcp__brain_search` / `mcp__brain_query`, which cannot resolve. That agent silently cannot reach the Brain.
   - What's unclear: whether the ROADMAP's "hooks" phrasing was meant to cover agent tool allowlists.
   - Recommendation: fix it (one-line, same root cause, same rename) but scope it explicitly in the plan text so the verifier is not surprised. If deferred, log it as a deferred item rather than leaving it silent.

4. **How much of `hatAwareRecommend` / `suggestValidationSteps` should change?**
   - What we know: both interpolate user content into Cypher. A pure guard-insert is the minimal fix.
   - What's unclear: whether the deeper design (sending user domain text to a methodology graph at all) should survive Part 8 review at all. Part 8 says an ambiguous boundary case "goes through separate legal review".
   - Recommendation: this phase does the guard-insert (fail-closed) and **files the deeper design question as an RCA/deferred item** rather than silently blessing or silently deleting the feature.

5. **Does the fix change user-visible behavior?**
   - What we know: today these two Brain features effectively work (uninspected). After a fail-closed guard, calls carrying user content will be skipped, so `suggestValidationSteps` and `hatAwareRecommend` will return `null` more often.
   - Recommendation: state this plainly in the phase summary as an intended consequence, in the honest-residual style Phase 243 used for the dark voice glyph. Do not let it surface as a surprise regression.

## Sources

### Primary (HIGH confidence)

- **This worktree, live execution** (2026-07-28, commit `431b2760`, identical to `main`, zero commits ahead or behind):
  - MCP `initialize` + `tools/list` handshake against `bin/mindrian-brain-mcp-client.cjs` -> `["brain_ask","brain_query","brain_schema","brain_search","brain_stats","brain_write"]`, offline, no Brain key.
  - `RegExp('mcp__brain_.*').test(...)` against all four candidate name forms.
  - `brain-response-sanitize.isBrainTool()` against all three name forms.
  - `part8-egress-guard.classify()` template-laundering probe and sanitize-ordering probe.
  - Full `sendPacket(` census across `lib/`, `scripts/`, `bin/`, `pipelines/`.
- **code.claude.com/docs/en/plugins-reference** - verbatim: "Tool matchers and `if` fields take the scoped tool name `mcp__plugin_<plugin-name>_<server-name>__<tool>` ... **A matcher written against the bare server key never fires.**"
- **code.claude.com/docs/en/hooks** - verbatim: matcher "Contains any other character" -> "JavaScript regular expression, unanchored"; "tested with JavaScript's `RegExp.prototype.test`, which succeeds on a match anywhere in the value"; "MCP tools follow the naming pattern `mcp__<server>__<tool>`".
- **Repo source read in full:** `hooks/hooks.json` (225-355), `lib/core/part8-egress-guard.cjs`, `lib/core/seam-liveness.cjs`, `scripts/part8-egress-guard-hook.cjs`, `bin/mindrian-brain-mcp-client.cjs`, `lib/core/brain-client.cjs` (262-400, 630-862, 1216-1340, exports), `lib/core/brain-response-sanitize.cjs` (matcher + PII), `docs/MINDRIAN-CANON.md` Part 8, `.mcp.json`, `.claude-plugin/plugin.json`.

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` Phase 235 close-out (line 131) - independently corroborates the matcher locations (lines 236, 338) and the "Claude Code never validates matchers against a live registry" behavior. Note its citation of `mcp__brain_.*` as *correct shape evidence* is itself the bug and needs correcting.
- `.planning/ROADMAP.md` Phase 239 section; `.planning/REQUIREMENTS.md` BRAIN-01/02/03.

### Tertiary (LOW confidence / honest misses)

- **langtalks-graph-expert** - MCP tools were absent from this agent's surface, so the stdio server was driven directly over JSON-RPC (Phase 237 precedent). Two probes run: `query_relationship` on guardrail placement (raw-field vs assembled-string classification, template-vocabulary false-allow) returned 11 generic label nodes scattered across unrelated sources with no typed edge answering the question; `relationship_path("guardrail","tool call")` returned a 3-hop path consisting entirely of `mentioned_in_episode` co-occurrence through one podcast episode. **Verdict: not in the corpus yet**, independently reproducing the orchestrator's own thin result. Nothing is cited from it. Per the standing rule this is a valid outcome for this source, not a research failure.
- **`claude-api` skill / `claude-code-guide` agent** - NOT installed in this environment (verified: no `~/.claude/agents/claude-code-guide`, no `claude-api` skill). Official `code.claude.com` docs used instead, and the substitution is recorded here rather than papered over. The orchestrator's separate `claude-code-guide` consultation is **fully corroborated** by both the official docs and my own `RegExp.test` reproduction.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** - no new packages; every reused module read in full from disk.
- BRAIN-01 diagnosis: **HIGH** - official documentation states the failure verbatim, and it was reproduced empirically three ways.
- BRAIN-02 diagnosis: **HIGH** - both doors traced to their production callers; both naive-fix failure modes measured, not theorized.
- BRAIN-03 diagnosis: **HIGH** (census) / **MEDIUM** (the park-vs-wire recommendation is a judgment call, logged as A3).
- Architecture and patterns: **HIGH** - all patterns are shipped, in-repo precedents.
- Pitfalls: **HIGH** for 1, 2, 3, 4, 5 (each reproduced or read from source); **MEDIUM** for 6 (scope ambiguity, logged as A2).
- Threat model: **MEDIUM-HIGH** - T1/T2/T4 follow directly from measured facts; T3 is a design-review inference.

**Research date:** 2026-07-28
**Valid until:** 2026-08-27 for the repo-internal findings; **7 days** for the Claude Code hook-matcher and plugin-MCP-naming claims, which track a fast-moving product surface and should be re-verified against `code.claude.com` if planning slips.
