---
phase: "81"
name: "Feynman-MINTO Hybrid"
milestone: "v1.10.2"
created: 2026-04-13
status: complete
author: gsd-researcher
consumes: 81-CONTEXT.md
produces: inputs for 81-01 through 81-05 plan files
---

# Phase 81: Feynman-MINTO Hybrid - Research

**Researched:** 2026-04-13
**Domain:** LLM-driven content generation inside a Claude Code plugin, cost-aware tier fallback, recorded-fixture test infrastructure
**Overall confidence:** HIGH on five primary questions. MEDIUM on cost figures (Anthropic pricing moves faster than the docs).

## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 81-CONTEXT.md)

- **D-1: MINTO structure is hybrid of deterministic + Feynman-generated.** Structural sections (frontmatter, MECE tree, evidence gaps, cross-refs, source artifacts, navigation) stay deterministic and free. Only essence, mental model, governing thought, argument structure, and key claims pass through Feynman stages. Total ~4 LLM calls per `/mos:reason` run.
- **D-2: Feynman stages 3 and 6 are skipped.** Stage 3 (Expose Confusion) and Stage 6 (Teach It Back) require human review gates and do not run in automated generation. Users can invoke `/mos:feynman` manually on a MINTO for full treatment.
- **D-3: Tier fallback chain.** Tier-1 (default) = Feynman-MINTO via ~4 LLM calls. Tier-0 (fallback) = pre-81 deterministic MINTO + AAAK footer from `lib/memory/aaak-compress.cjs`. Triggered by LLM unreachable, budget exceeded, or `--tier-0` flag.
- **D-4: AAAK stays committed as the tier-0 fallback primitive.** `lib/memory/aaak-compress.cjs` (21/21 tests green) is not deleted, not default, and not extended. It is what the fallback path calls.
- **D-5: Cost budget gate.** Default $0.15/run, $10/month. Exceeding the monthly cap activates tier-0 for the rest of the month. Budget state in `~/.mindrian/budget.json`.
- **D-6: Migration strategy.** Existing MINTOs stay as-is until `/mos:reason --regenerate-all` is run. Backups written to `.migration-backup/YYYY-MM-DD/` first. No auto-migration on upgrade.
- **D-7: LLM path abstraction.** All stage calls go through `lib/memory/llm-call.cjs`. That wrapper selects the right invocation mechanism for the current surface (CLI/Desktop/Cowork) and throws a recoverable error when none is available.
- **D-8: Feynman stage functions become library code.** `feynmanStage1_essence`, `feynmanStage2_plainLanguage`, `feynmanStage4_mentalModel`, `feynmanStage5_sweetSpot` live in `lib/memory/feynman-stages.cjs`. Each wraps a prompt, calls `llm-call.cjs`, parses the response, returns a structured object.

### Claude's Discretion (from 81-CONTEXT.md "Open Questions")

- Q(a) Prompt extraction: verbatim or rewritten for automation.
- Q(b) LLM call mechanism: shell-out vs MCP vs HTTP sidecar vs something else.
- Q(c) Testing strategy: fixtures vs mocks vs live-tagged tests.
- Q(d) Feynman skill changes: modify or leave alone.
- Q(e) `/mos:budget` scope: minimum viable vs full breakdown.

Resolutions are the body of this research.

### Deferred Ideas (OUT OF SCOPE for Phase 81)

- Cross-tool memory (MemPalace concept) - parked.
- MCP server refactor - belongs to v3.0.
- Brain dependency for tier-1 Feynman - possible future enhancement, not in 81.
- Vector search, embeddings, ChromaDB - v1.12.0+.
- `/mos:recall` retrieval layer - v1.11.0+.
- Naming cleanup across skill files - v1.10.3 or v1.11.0.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEYNMINTO-01 | `/mos:reason` produces MINTO files under 1500 tokens when LLM available | Sections 2, 3, 7 (generator rewrite + stage prompts tightened for parseable output) |
| FEYNMINTO-02 | Structural parts of MINTO remain deterministic and free | Section 7 (81-04 only touches narrative rendering, structural helpers preserved) |
| FEYNMINTO-03 | Tier-1 path uses Feynman stages 1, 2, 4, 5 via library functions | Sections 2, 4 (stage signatures + library layout) |
| FEYNMINTO-04 | Tier-0 fallback uses deterministic MINTO + AAAK footer when LLM unavailable | Section 2 (fallback chain), Section 7 (81-04 fallback wiring) |
| FEYNMINTO-05 | Per-run cost budget enforced ($0.15 default, configurable) | Section 6 (`/mos:budget` scope and schema), Section 2 (budget gate in llm-call.cjs) |
| FEYNMINTO-06 | Per-user monthly cap enforced ($10 default, configurable) | Section 6 |
| FEYNMINTO-07 | `/mos:reason --regenerate-all` migrates pre-81 MINTOs to post-81 format with backup | Section 7 (81-05) |
| FEYNMINTO-08 | Existing deterministic MINTO generator path preserved as tier-0 fallback | Section 7 (81-04 preserves pre-81 code paths as named exports) |
| FEYNMINTO-09 | Feynman stage functions are pure library calls in `lib/memory/feynman-stages.cjs`, not shell-outs to the skill | Section 4 |
| FEYNMINTO-10 | LLM invocation is abstracted via `lib/memory/llm-call.cjs` to support CLI, Desktop, and Cowork surfaces | Section 2 (tri-polar table) |

## Project Constraints (from CLAUDE.md)

- **CJS only.** No ESM, no TypeScript. Every file in `lib/memory/` and `scripts/` is `.cjs`.
- **Tri-polar design.** Every feature must work on CLI, Desktop, and Cowork. `lib/memory/llm-call.cjs` exists specifically to honor this rule (Decision #4).
- **Tier 0 fully functional.** Decision #8. Zero-dep path must still work. The Feynman-MINTO path is tier-1, the deterministic + AAAK path is tier-0. The upgrade does not violate Decision #8 because tier-0 is still present.
- **One-command install (Decision #1).** Tier-1 requires user to supply `ANTHROPIC_API_KEY`. Tier-0 still works zero-config. See Section 2 for the tradeoff framing.
- **No em-dashes anywhere.** Hard user rule. All generated content, fixture strings, and prompts must use hyphens. The em-dash scrub is already wired into `aaak-compress.cjs::cleanField` (line 367) - the Feynman stage parsers must do the same.
- **ROOM.md in every directory (Decision 15).** Any new folder created by this phase (e.g. `test-fixtures/feynman/`) gets a ROOM.md.
- **Nested artifact folders (Decision 16).** Any per-artifact folder is self-named. This matters only if the phase creates room artifacts, which it does not - Phase 81 is plugin code, not room content.
- **5-gate version consistency** from release-process.md. The 81-05 plan must update CHANGELOG, plugin.json, package.json, git tag v1.10.2, and marketplace.json in one commit.
- **Workspace guard.** All work in `/home/jsagi/MindrianOS-Plugin/`, never `~/.claude/plugins/mindrian-os/`. (Not Phase 81's job to enforce, but every commit Phase 81 makes must respect it.)
- **GSD workflow enforcement.** All file edits go through `/gsd:execute-phase`, not direct edits. Phase 81 plans must not tell a future executor to "just edit the file" - they must say "use Edit tool via gsd-phase-executor".

## 1. Summary

Five bullets, one per open question.

- **Q(b) LLM invocation.** Use **direct Anthropic Messages API via native `fetch` from `lib/memory/llm-call.cjs`, reading `ANTHROPIC_API_KEY` from `process.env`**. This is the only mechanism that works across all three surfaces today without waiting for the v3.0 MCP server. Four existing files in the repo (`lib/chat/fabric-chat.cjs`, `lib/chat/chat-panel.js`, `lib/wiki/wiki-server.cjs`, `scripts/generate-snapshot.cjs`) already do this - but all four are **browser-side BYOAPI**, never Node-side-from-env. Phase 81 is the first Node-side, env-sourced LLM caller in the plugin. The tradeoff is that tier-1 requires a one-time setup step ("export your key"), which partially bends Decision #1. Tier-0 fallback preserves the zero-config promise, so the one-command install still works - the Feynman tier is a paid upgrade. **HIGH confidence.**
- **Q(c) Testing without hitting production LLM.** Use **recorded fixtures committed to `test-fixtures/feynman/<stage>/<case>.json`**, keyed by a hash of the input. Default test run reads fixtures and never hits the network. `RECORD_FIXTURES=1` re-runs against live API and overwrites the files. `FEYNMAN_LIVE_LLM=1` runs live without overwriting fixtures (pre-release sanity check). Assertions are structural (shape + field presence + length bounds), not exact-string. **HIGH confidence.**
- **Q(a) Prompt extraction.** Leave the Feynman engine skill markdown untouched (it remains the human reference). Extract **tightened, JSON-returning versions** of the Stage 1/2/4/5 prompts as constants in a new file `lib/memory/feynman-prompts.cjs`. `feynman-stages.cjs` imports them. Each prompt is rewritten to (a) strip interactive gates, (b) return a single JSON object with named fields, (c) refuse em-dashes in its output. **HIGH confidence.**
- **Q(d) Feynman skill changes.** **No changes.** The skill file stays exactly as it is. Phase 81 only adds new code that takes inspiration from the skill. The skill's 6-stage interactive pipeline is a user-facing product; the library's 4-stage batch pipeline is an internal primitive. Different audiences, different files. **HIGH confidence.**
- **Q(e) `/mos:budget` scope.** Ship **the minimum viable version** in 81-05: current spend, monthly cap, remaining budget, and a list of the last 10 LLM calls with timestamp + cost + result. Per-room breakdown and alerting defer to v1.11.0. Justification: scope economy, and the monthly cap is the only gate that blocks tier-1 - everything else is observability, which can ship later without breaking the budget safety guarantee. **HIGH confidence.**

**Primary recommendation:** Phase 81 is **viable as v1.10.2** with the direct-fetch LLM path. The tradeoff is a one-time `ANTHROPIC_API_KEY` setup step for users who want tier-1. This is documented honestly in CHANGELOG, is surfaced by `/mos:doctor` (when that ships), and is bypassable via tier-0. Do not park Phase 81 waiting for v3.0 MCP - the direct-fetch path is simpler, closer to the metal, and already has precedent in the repo.

## 2. Q(b) LLM Invocation Mechanism (CRITICAL)

### The constraint

The current MINTO generator is invoked headless:

```
node bin/mindrian-tools.cjs vault {room-arg} [--path <dir>]
    -> scripts/vault-export-orchestrator.cjs
        -> scripts/vault-section-minto-generator.cjs  <-- this script
```

Every one of those processes is a child process of the user's shell, not of the Claude Code session. They have no file descriptor that reaches the host Claude conversation. There is no "write to Claude's stdin" available from a spawned `node` - the spawning process (`bash`, `zsh`, or the `Bash` tool that Claude used) owns stdin. Claude Code does not expose a callback hook that lets a hook or script re-enter the host session.

**Verified by searching the repo** (Grep on `execSync.*claude`, `spawn.*claude`, `CLAUDE_PROJECT_DIR`): no existing pattern re-enters the session. The only `CLAUDECODE`/`CLAUDE_CODE` mentions are in research reference docs, not in runtime code.

So the options from 81-CONTEXT.md break down as:

### Option (b1): Shell out to a Claude agent via stdin

**Verdict: not viable.** There is no persistent agent process to write to. The `claude` CLI binary, when invoked without a session, would spawn a brand new session, which means a brand new context, a brand new system prompt, and a brand new per-message billing cycle. It would also block waiting for stdin-based streaming. This is neither cheaper nor simpler than a direct API call, and it has worse failure modes (session startup latency, unknown model selection, context cost for system prompts).

### Option (b2): MCP protocol invocation of a Brain-adjacent service

**Verdict: not viable for v1.10.2.** This requires the MindrianOS MCP server (v3.0 stack, per CLAUDE.md Technology Stack section). That server is planned but not built. Building it to unblock Phase 81 inverts the dependency order: v3.0 MCP server should ship as its own phase, not get bundled as a dependency of a v1.10.x release.

Even if the MCP server existed, the MCP protocol is request-response over stdio between a host (Claude Desktop) and a server (MindrianOS). A spawned CJS script is neither host nor server - it cannot initiate an MCP call. MCP would solve "Desktop calls MindrianOS tools", not "MindrianOS tool calls Claude".

Brain MCP (the remote service at `brain.mindrian.ai`) is a client-facing service, and even if we added a Feynman tool there, the plugin would still need a way to invoke it from a spawned CJS script, which is exactly the same problem.

### Option (b3): Local sidecar HTTP endpoint

**Verdict: overengineered for v1.10.2.** A sidecar is a persistent process (a Node server listening on `localhost:NNNN`) that the CJS script talks to over HTTP. The sidecar is what actually makes the LLM call. This adds lifecycle management (when does the sidecar start, when does it die, how does it survive reboots, how does it survive a plugin update), a port management problem (which port, how to avoid collisions), and a security surface (any process on the machine can now hit the endpoint). It adds nothing over option (b4) except latency and complexity.

The sidecar would itself need to call the Anthropic API with an API key - so the credential surface does not shrink, it just moves one hop away.

### Option (b4): Direct Anthropic Messages API via native `fetch`

**Verdict: viable, and recommended.**

Why it is viable:
1. Node 18+ has global `fetch` (verified in `package.json` engines: `>=18`).
2. Four files in the repo already build requests to `https://api.anthropic.com/v1/messages`. Phase 81 is not breaking new architectural ground - it is applying an existing pattern to a new context (Node-side instead of browser-side).
3. The API is stable and widely documented (HIGH confidence from the Anthropic docs used by those four files).
4. It is the only mechanism that works across all three surfaces today.

Why it was not the default already:
- All four existing callers run in a **browser context**, where the user has pasted their API key into localStorage (BYOAPI pattern). None of them read `ANTHROPIC_API_KEY` from `process.env`.
- Phase 81 is the first place in the plugin that needs to call the API from Node at runtime, outside a user's clicking a "send" button in a chat panel.

**The key tradeoff, stated honestly:** Decision #1 says "one-command install, zero config required". A tier-1 Feynman-MINTO path that reads `process.env.ANTHROPIC_API_KEY` requires users to set that variable. That is a second command beyond `claude plugin install`. **This is a partial bend of Decision #1.** The mitigations are:

- Tier-0 fallback preserves the Decision #1 promise: users who do not set a key fall through to the pre-81 deterministic MINTO + AAAK footer, which is fully free and offline. The plugin still installs and runs with one command.
- The tier-1 path is advertised as a paid upgrade, not as the default startup experience. The CHANGELOG [1.10.2] entry must say this explicitly.
- When tier-1 is unavailable, the fallback is transparent - no error dialog, no "install an API key" nagging. The generator logs `tier-0 fallback: no ANTHROPIC_API_KEY in env` to stderr and proceeds.
- `/mos:doctor` (future) can detect a missing key and surface it as an optional setup step.
- The plugin does not ever read the key from a config file or a `.env`. It only reads `process.env`. This keeps the credential surface minimal: the user controls when the key is in the environment, and it is never persisted by the plugin.

This matches how tools like `gh` CLI handle optional features that require auth - zero-config for the basic path, prompt-to-auth only when the user asks for the advanced feature.

### The `llm-call.cjs` wrapper

Per D-7, all stage calls go through a single wrapper. Signature:

```javascript
// lib/memory/llm-call.cjs
'use strict';

/**
 * Invoke the host LLM for a single-turn completion.
 *
 * Surface detection order:
 *   1. process.env.ANTHROPIC_API_KEY present -> direct fetch to api.anthropic.com
 *   2. (future) MCP host available -> mcp invocation (stub for now, throws)
 *   3. nothing available -> throw LLMUnavailableError
 *
 * The caller (tier-1 Feynman path) catches LLMUnavailableError and routes to tier-0.
 *
 * @param {object} params
 * @param {string} params.system         - System prompt
 * @param {string} params.user           - User message
 * @param {string} [params.model]        - Anthropic model ID
 * @param {number} [params.maxTokens]    - Max tokens for response
 * @param {number} [params.temperature]  - Sampling temperature
 * @param {string} [params.stageName]    - For budget accounting + fixture keying
 * @returns {Promise<{text: string, costUsd: number, inputTokens: number, outputTokens: number, model: string}>}
 * @throws {LLMUnavailableError} when no surface can serve the call
 * @throws {LLMBudgetError} when the budget gate trips
 * @throws {LLMError} for API errors (network, 4xx, 5xx)
 */
async function llmCall({ system, user, model, maxTokens, temperature, stageName }) { /* ... */ }

class LLMUnavailableError extends Error {}  // triggers tier-0 fallback
class LLMBudgetError extends Error {}       // triggers tier-0 fallback
class LLMError extends Error {}             // triggers tier-0 fallback with warning

module.exports = { llmCall, LLMUnavailableError, LLMBudgetError, LLMError };
```

Pseudocode for the direct-fetch branch:

```javascript
async function llmCallViaFetch({ system, user, model, maxTokens, temperature, stageName }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMUnavailableError('ANTHROPIC_API_KEY not set');

  const chosenModel = model || 'claude-sonnet-4-20250514';
  const chosenMaxTokens = maxTokens || 1024;

  // Budget gate: check before calling
  const budgetOk = checkBudgetGate(stageName, chosenModel, chosenMaxTokens);
  if (!budgetOk.ok) throw new LLMBudgetError(budgetOk.reason);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: chosenModel,
      max_tokens: chosenMaxTokens,
      temperature: temperature != null ? temperature : 0.2,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new LLMError(`Anthropic API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const text = (data.content && data.content[0] && data.content[0].text) || '';
  const inputTokens = data.usage ? data.usage.input_tokens : 0;
  const outputTokens = data.usage ? data.usage.output_tokens : 0;
  const costUsd = computeCost(chosenModel, inputTokens, outputTokens);

  recordBudgetSpend(stageName, chosenModel, costUsd, inputTokens, outputTokens);
  return { text, costUsd, inputTokens, outputTokens, model: chosenModel };
}
```

Note: no `anthropic-dangerous-direct-browser-access` header here. That header exists because of CORS enforcement in browser contexts. Node-side `fetch` does not enforce CORS. Dropping the header is correct and slightly safer (does not advertise that we are abusing a browser-only escape hatch).

Model choice: `claude-sonnet-4-20250514` is what the repo already uses for snapshot chat. For Feynman stages, Sonnet is appropriate for stages 4 and 5 (which need judgment). Stages 1 and 2 are simpler and could use Haiku for cost savings. The plan file for 81-02 should evaluate this empirically against fixtures.

### Cost model (for D-5 budget gate)

As of 2026-Q2 Anthropic pricing (MEDIUM confidence - pricing changes frequently, verify before shipping):
- Claude Sonnet 4: roughly $3/Mtok input, $15/Mtok output
- Claude Haiku 4: roughly $0.25/Mtok input, $1.25/Mtok output (indicative)

For a 4-stage Feynman run on a section with ~2000-token input and ~500-token output per stage:
- All Sonnet 4: 4 * (2000 * 3 + 500 * 15) / 1_000_000 = 4 * ($0.006 + $0.0075) = 4 * $0.0135 = $0.054
- Mixed (stages 1, 2 Haiku; 4, 5 Sonnet): roughly $0.03

$0.15/run budget has comfortable headroom for both. $10/month allows ~185 all-Sonnet runs or ~330 mixed runs. Verify exact pricing with a live call during 81-02 and document actual numbers in CHANGELOG.

**Action for planner: before 81-02, a one-line script should verify current pricing by pinging Anthropic's models endpoint or by making a tiny test call and reading the `usage` field.** Build `computeCost(model, inputTokens, outputTokens)` with a pricing table that is easy to update.

### Tri-polar analysis

| Surface | How tier-1 works | How tier-0 works |
|---------|------------------|------------------|
| **CLI** | `node bin/mindrian-tools.cjs vault ...` spawns the generator. Generator calls `llm-call.cjs`. Wrapper reads `ANTHROPIC_API_KEY` from env (user has exported it or set it in their shell profile). Direct fetch. Falls back to tier-0 if key missing or API errors. | Pre-81 deterministic generator + AAAK footer. No key needed. |
| **Desktop** | Desktop does not execute scripts directly. When the v3.0 MCP server ships, the generator will be exposed as an MCP tool. The MCP server process runs inside the user's Claude Desktop machine and inherits `process.env` - so the same `llm-call.cjs` works unmodified. Until v3.0 ships, Desktop users can only reach tier-1 by asking Claude to run `node bin/mindrian-tools.cjs vault ...` via the `Bash` tool - which works because Claude Desktop does have `Bash` access to the user's machine via the plugin. | Same path as CLI: deterministic + AAAK. |
| **Cowork** | Same story as Desktop. When a shared room lives on a Cowork server, the server process reads `ANTHROPIC_API_KEY` from its own env (set by the Cowork admin). Budget tracking is per-user in the Cowork namespace, not global. This is identical to how the existing BYOAPI chat endpoint in `lib/wiki/wiki-server.cjs` handles keys. | Same fallback. |

The abstraction wrapper `llm-call.cjs` has a surface-detection function that logs its decision once per run, so the user can see "tier-1 via direct fetch" vs "tier-0 via aaak-compress" vs "tier-0 via deterministic-only" in the generator output.

### Cost budget integration

The budget gate (D-5) lives inside `llm-call.cjs`, not inside `feynman-stages.cjs`. This keeps it a single chokepoint. The gate:
1. Reads `~/.mindrian/budget.json` (creates it if missing).
2. Estimates the max cost of the pending call from `maxTokens` and the model's output rate (worst case).
3. Compares `(current_month_spend + estimated_max)` to `monthly_cap`.
4. Throws `LLMBudgetError` if over.
5. After a successful call, records actual cost (from `usage` field) and appends to a capped ring buffer of recent calls (for `/mos:budget`).

Schema:

```json
{
  "version": 1,
  "monthly_cap_usd": 10.0,
  "per_run_cap_usd": 0.15,
  "current_month": "2026-04",
  "spend_current_month_usd": 0.087,
  "spend_all_time_usd": 0.087,
  "recent_calls": [
    {
      "timestamp": "2026-04-13T19:22:11Z",
      "stage": "feynmanStage1_essence",
      "model": "claude-sonnet-4-20250514",
      "input_tokens": 1843,
      "output_tokens": 412,
      "cost_usd": 0.0117,
      "result": "ok"
    }
  ]
}
```

`recent_calls` is capped at 100 entries (ring buffer, oldest dropped first). This is enough for `/mos:budget` to show recent activity without growing unbounded.

Month rollover: when `current_month` no longer matches today's UTC year-month, reset `spend_current_month_usd` to 0 and update `current_month`. No cron needed - rollover happens lazily on the next call.

## 3. Q(c) Cost-Free Testing Strategy

### The requirement

Every dev-machine test run and every CI run must be reproducible, deterministic, and free. Live LLM calls are non-deterministic (temperature, model drift, rate limits) and cost money. Any test that hits the network is a test that cannot run in CI and that will flake.

### The pattern: recorded fixtures

Pattern (proven in the wider JS ecosystem by `jest-snapshot`, `nock`, `vcr`, `msw` - all MIT-ecosystem standards, no dependency needed for Phase 81 since we roll the pattern in plain CJS):

1. Tests run in one of three modes, selected by env var:
   - **Default (fixture-replay).** Tests read from `test-fixtures/feynman/...` and assert on the parsed output. Never hits the network. Fast.
   - **`RECORD_FIXTURES=1`.** Tests make real API calls, save the raw response JSON to the fixture file, then run the assertions. Developer runs this once when a prompt changes. Requires `ANTHROPIC_API_KEY` in env.
   - **`FEYNMAN_LIVE_LLM=1`.** Tests make real API calls but do NOT overwrite fixtures. Used as a pre-release sanity check to confirm nothing has drifted silently.

2. Fixture files are committed to the repo. They document the canonical LLM behavior the tests depend on. A reviewer can `cat` the fixture and see exactly what the LLM said. When a prompt changes, the fixture diff tells you how the output changed.

3. Assertions are structural, not exact-string. Tests check: field presence, field shape, field length bounds, no-em-dash rule, non-empty, parseable JSON. Tests do NOT check: exact wording, exact order of bullet points, exact analogy content.

### File layout

```
test-fixtures/
├── ROOM.md
└── feynman/
    ├── ROOM.md
    ├── README.md                       (how to regenerate)
    ├── stage1-essence/
    │   ├── problem-definition-short.input.md
    │   ├── problem-definition-short.response.json
    │   ├── problem-definition-long.input.md
    │   ├── problem-definition-long.response.json
    │   ├── market-analysis-typical.input.md
    │   └── market-analysis-typical.response.json
    ├── stage2-plain/
    │   ├── (same pattern)
    │   └── ...
    ├── stage4-model/
    │   └── ...
    └── stage5-sweet/
        └── ...
```

Two ROOM.md files so every directory has identity (Decision 15).

The `.input.md` file is the raw input text. The `.response.json` file is the full parsed API response (content, usage, model, stop_reason). Pairing them makes the fixture self-documenting.

### Fixture key

Each test case has a stable name (`problem-definition-short`). The fixture loader resolves:
```
test-fixtures/feynman/{stage}/{case}.response.json
```

No hashing is needed because the case name is the key. The input file is a sibling for humans to read. If a dev wants a hash check (to detect accidental input drift), store the sha256 of the input as a field inside the response JSON and warn on mismatch during replay.

### Example fixture JSON

`test-fixtures/feynman/stage1-essence/problem-definition-short.response.json`:

```json
{
  "fixture_version": 1,
  "recorded_at": "2026-04-13T19:22:11Z",
  "recorded_by": "stage1-essence.test.cjs",
  "input_sha256": "2a7f9c...",
  "input_file": "problem-definition-short.input.md",
  "request": {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 512,
    "temperature": 0.2
  },
  "response": {
    "id": "msg_01ABC123",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "{\n  \"essence\": \"MindrianOS does not activate for new users without live coaching because the installation flow assumes a Jonathan is nearby.\",\n  \"fundamentals\": [\n    \"Activation is a structural invariant, not a documentation problem.\",\n    \"Patches fix symptoms but leave the invariant intact.\",\n    \"Evidence: the Dror session succeeded only because Jonathan was physically present.\"\n  ]\n}"
      }
    ],
    "model": "claude-sonnet-4-20250514",
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 487,
      "output_tokens": 156
    }
  }
}
```

The inner `text` is a JSON string (Stage 1's prompt demands JSON output). The parser in `feynman-stages.cjs::feynmanStage1_essence` does `JSON.parse(response.content[0].text)` and returns the structured object.

### Example test

`lib/memory/feynman-stages.test.cjs`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {
  feynmanStage1_essence,
  feynmanStage2_plainLanguage,
  feynmanStage4_mentalModel,
  feynmanStage5_sweetSpot,
} = require('./feynman-stages.cjs');

const FIXTURE_ROOT = path.join(__dirname, '..', '..', 'test-fixtures', 'feynman');
const MODE = process.env.RECORD_FIXTURES
  ? 'record'
  : process.env.FEYNMAN_LIVE_LLM
    ? 'live-nocommit'
    : 'replay';

// Install the fixture-aware fetch shim before importing llm-call
require('./__test_fetch_shim.cjs').install({ mode: MODE, fixtureRoot: FIXTURE_ROOT });

let passed = 0, failed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { console.log('  ok  ' + name); passed++; },
    (err) => { console.log('  FAIL  ' + name); console.log('        ' + (err.message || err)); failed++; }
  );
}

async function main() {
  // ---- Stage 1 ----
  await test('stage1 essence: problem-definition-short', async () => {
    const input = fs.readFileSync(
      path.join(FIXTURE_ROOT, 'stage1-essence', 'problem-definition-short.input.md'), 'utf-8'
    );
    const out = await feynmanStage1_essence(input, { stageName: 'stage1-essence/problem-definition-short' });
    // Structural assertions:
    assert.ok(out && typeof out === 'object', 'returns an object');
    assert.ok(typeof out.essence === 'string', 'essence is a string');
    assert.ok(out.essence.length > 20 && out.essence.length < 400, 'essence length bounded');
    assert.ok(Array.isArray(out.fundamentals), 'fundamentals is an array');
    assert.ok(out.fundamentals.length >= 2 && out.fundamentals.length <= 7, 'fundamentals count bounded');
    assert.ok(!/\u2014/.test(out.essence), 'no em-dash in essence');
    out.fundamentals.forEach((f, i) => {
      assert.ok(typeof f === 'string' && f.length > 10, `fundamental[${i}] non-empty string`);
      assert.ok(!/\u2014/.test(f), `fundamental[${i}] no em-dash`);
    });
  });

  // ... analogous tests for stages 2, 4, 5 ...

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

### The fetch shim

The shim is the magic. `lib/memory/__test_fetch_shim.cjs` monkey-patches the `llmCall` export of `llm-call.cjs` during tests so it reads or writes fixtures instead of hitting the network.

Pseudocode:

```javascript
// lib/memory/__test_fetch_shim.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const llmCallModule = require('./llm-call.cjs');
const originalLlmCall = llmCallModule.llmCall;

function install({ mode, fixtureRoot }) {
  if (mode === 'live-nocommit') {
    // do not patch - run real calls, but the test runner won't write fixtures
    return;
  }

  llmCallModule.llmCall = async function testingLlmCall(params) {
    const key = params.stageName;  // e.g. "stage1-essence/problem-definition-short"
    if (!key) throw new Error('testingLlmCall: stageName required in tests');
    const fixturePath = path.join(fixtureRoot, key + '.response.json');

    if (mode === 'record') {
      // Run the real call
      const real = await originalLlmCall(params);
      // Build a fixture envelope
      const envelope = {
        fixture_version: 1,
        recorded_at: new Date().toISOString(),
        input_sha256: sha256(params.user),
        request: { model: real.model, max_tokens: params.maxTokens, temperature: params.temperature },
        response: {
          content: [{ type: 'text', text: real.text }],
          model: real.model,
          usage: { input_tokens: real.inputTokens, output_tokens: real.outputTokens },
        },
      };
      fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
      fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2) + '\n');
      return real;
    }

    // replay mode
    if (!fs.existsSync(fixturePath)) {
      throw new Error(
        `Missing fixture: ${fixturePath}\n` +
        `Run RECORD_FIXTURES=1 ANTHROPIC_API_KEY=... node lib/memory/feynman-stages.test.cjs to create it`
      );
    }
    const envelope = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const text = envelope.response.content[0].text;
    const usage = envelope.response.usage || {};
    return {
      text,
      model: envelope.response.model,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      costUsd: 0,  // replay is free
    };
  };
}

function sha256(s) {
  return require('crypto').createHash('sha256').update(s).digest('hex');
}

module.exports = { install };
```

Notes:
- The shim monkey-patches `llmCallModule.llmCall` by reassignment. This works because `feynman-stages.cjs` imports the module object and calls `llmCallModule.llmCall(...)` or equivalently `const { llmCall } = require('./llm-call.cjs')` - either way, the replacement is live before any stage function runs, because the shim installs itself before the stage module is required at the top of the test file.
- The shim lives in `lib/memory/` prefixed with `__test_` so it is not loaded by production code and is obviously test-only.
- Live-nocommit mode does not patch at all. It runs the real `llmCall`, costs real money, produces real results, and does not write fixtures. Use sparingly.

### Recording workflow (developer-facing)

```bash
# First time (new fixture)
export ANTHROPIC_API_KEY=sk-ant-...
RECORD_FIXTURES=1 node lib/memory/feynman-stages.test.cjs

# Normal test run (offline, deterministic, free)
node lib/memory/feynman-stages.test.cjs

# Pre-release sanity (optional)
FEYNMAN_LIVE_LLM=1 ANTHROPIC_API_KEY=sk-ant-... node lib/memory/feynman-stages.test.cjs
```

### Fixture maintenance

- When a prompt changes, RECORD_FIXTURES once, commit the new fixtures in the same commit as the prompt change. The diff tells reviewers what drifted.
- Fixtures are idempotent: running RECORD_FIXTURES twice in a row (with the same prompt) should produce byte-identical output only if temperature=0 and the model is deterministic. At temperature=0.2, fixtures will drift slightly. Tests assert on shape, not content, so small drift is fine. If a run drifts enough that assertions fail, the test failure is actionable: either the prompt is unstable, or the assertions are too strict.
- Never commit a fixture taken while the `.input.md` had the old content. The `input_sha256` field in the envelope lets a CI check verify: `sha256(current-input-file) == envelope.input_sha256`. If it drifts, the test emits a warning.

### What the fixtures do NOT cover

- `llm-call.cjs` itself has unit tests that do not use the shim. Those tests cover the budget gate logic, the month-rollover logic, and the error mapping. They pass a fake `fetch` via an injected function parameter, not via env var.
- Integration tests that run the whole MINTO generator against a fixture room use the same fixture pattern at the top level (the whole generator call is recorded).

## 4. Q(a) Prompt Extraction Approach

### Recommendation

**Leave the Feynman engine skill file untouched as human-facing reference.** The skill is a markdown document that explains the 6-stage method for a user who wants to run it interactively. It has challenge prompts ("That's not a fundamental truth - that's an implementation detail"), human review gates, and discussion language. It is not callable code.

**Extract new, tighter, JSON-returning versions of the Stage 1/2/4/5 prompts** as string constants in a new file:

```
lib/memory/feynman-prompts.cjs
```

This file has no dependencies. It exports four string constants and four `buildPrompt(input)` functions that do templating. The stage functions in `feynman-stages.cjs` import from here.

### Why not inline the prompts inside `feynman-stages.cjs`?

Separation of concerns. Prompts are content; the stage functions are logic. Reviewing a prompt change should not require reading through the fetch-parse-assert scaffolding. A separate prompts file also makes the file easy to diff when prompts change, and it makes fixture regeneration cleaner (fixture file names can reference the prompt version).

### Why not load the prompts from the skill markdown at runtime?

Three reasons:
1. The skill lives at `~/.claude/skills/feynman-engine/SKILL.md` - a user-level path, not a plugin path. It is not guaranteed to be present on every install. Phase 81 must not create a runtime dependency on a path outside the plugin repo.
2. The skill prompts contain interactive gates, challenge language, and 6-stage flow narrative. Parsing them out of the markdown would be brittle.
3. Prompts for automation need different wording than prompts for interactive use. Automation needs "return JSON with fields X, Y, Z", not "wait for the user's response".

### Tightening per stage

**Stage 1: Essence.** Skill prompt asks for "irreducible truths + connection map + one-paragraph summary + wait for user response". Automation needs: a JSON object with `essence` (string, max 400 chars) and `fundamentals` (array of 2-7 strings). No gate. Temperature 0.1-0.2.

Automation prompt (draft, to be refined in 81-02):

```
You are running Feynman Stage 1 (Reduce to Essence) on a section of a venture room.

INPUT:
{{input}}

TASK:
Return a single JSON object with exactly two fields:
- "essence": one sentence (under 400 characters) stating the irreducible core truth of the section. No jargon.
- "fundamentals": an array of 2 to 7 strings. Each string is one fundamental truth underlying the essence. Plain language.

RULES:
- Return ONLY the JSON object, no prose before or after, no markdown code fences.
- Use hyphens, never em-dashes or en-dashes.
- If the input is empty or unparseable, return {"essence": "", "fundamentals": []}.

OUTPUT:
```

Output format rule: the response must be raw JSON so `JSON.parse(text)` works. The parser in `feynman-stages.cjs` tolerates a leading/trailing ``` fence just in case.

**Stage 2: Plain Language.** Skill prompt asks for elevator + glossary + 12-year-old version + gate. Automation needs: `plain` (one 2-sentence version, ~180 chars) and `elevator` (30-second version, ~360 chars).

**Stage 4: Mental Model.** Skill prompt asks for 2-3 analogies + mappings + limitations + gate. Automation needs: `models` (array of 1-2 objects with `analogy`, `mapping`, `limits`). One is fine for MINTO output; a second is optional.

**Stage 5: Sweet Spot.** Skill prompt asks for simplification ladder + breaking point + sweet spot + gate. Automation needs: `sweetSpot` (one 2-sentence version that is the simplest still-true phrasing) and `keyClaims` (array of 3-5 one-sentence claims).

Note that Stage 5 is the one that produces `keyClaims`. Per D-1 row "Argument Structure" and "Key Claims" both ride on a single Stage 5 call - the prompt returns both fields in one response. That is the "bundled above" note in the cost table.

### Parser rules

Each stage function has a small parser:

```javascript
function parseStage1Response(text) {
  // Strip optional code fence
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  let obj;
  try {
    obj = JSON.parse(cleaned);
  } catch (err) {
    throw new LLMParseError('stage1: response not JSON: ' + err.message);
  }
  if (typeof obj.essence !== 'string') throw new LLMParseError('stage1: essence missing');
  if (!Array.isArray(obj.fundamentals)) throw new LLMParseError('stage1: fundamentals missing');
  return {
    essence: scrubEmDash(obj.essence.trim()),
    fundamentals: obj.fundamentals.map(f => scrubEmDash(String(f).trim())).filter(f => f.length > 0),
  };
}

function scrubEmDash(s) {
  return s.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
}
```

`LLMParseError` is NOT recoverable via tier-0 fallback on its own. A parse error means the prompt or model is broken. The generator catches `LLMParseError`, logs it loudly, and falls back to tier-0 for that run with a warning in the generator output. It does not silently hide the bug.

### What stays in the skill (untouched)

- The 6-stage narrative with interactive gates
- The deck generation section (stages 1-6 produce HTML deck, not MINTO)
- The "Common Patterns" examples
- The "Quality Standards" checklist

None of those are called by Phase 81 code. The skill and the library coexist.

## 5. Q(d) Feynman Skill Changes Required

**None.**

After reading `~/.claude/skills/feynman-engine/SKILL.md` (326 lines, confirmed present and stable per Dependencies section of 81-CONTEXT.md), the skill is entirely human-facing documentation of an interactive 6-stage pipeline. It has prompt templates inside blockquotes, challenge language, gates, and a deck-generation section that is unrelated to MINTO output.

Phase 81 does not:
- Modify the skill file
- Parse the skill file at runtime
- Depend on the skill file's path existing
- Require the skill to be installed for Phase 81 to work

Phase 81 does:
- Reference the skill in comments in `lib/memory/feynman-prompts.cjs` as the conceptual source of the stages
- Reference the skill in CHANGELOG [1.10.2] as the authority
- Reference the skill in the CLAUDE.md Decision #17 entry that 81-05 adds

The skill remains the user-facing `/mos:feynman` pipeline. The library is the internal primitive called by `/mos:reason`. Two separate surfaces, two separate files, zero coupling.

**One minor followup (v1.10.3 or later, not in 81):** add a cross-reference note at the top of the skill markdown that says "for automated MINTO generation, see `lib/memory/feynman-stages.cjs`". This is a documentation convenience, not a code change. Defer.

## 6. Q(e) `/mos:budget` Command Scope

### What ships in 81-05 (minimum viable)

```
/mos:budget
```

Output (Body Shape E mini report, matching existing command patterns):

```
Action: budget status
Config: ~/.mindrian/budget.json
Month:  2026-04
Cap:    $10.00/month  ($0.15/run)

Spent:  $ 0.087   (0.9% of monthly cap)
Remain: $ 9.913

Recent calls:
  2026-04-13T19:22  stage1-essence         sonnet-4   $0.0117  ok
  2026-04-13T19:22  stage2-plain           sonnet-4   $0.0089  ok
  2026-04-13T19:23  stage4-mental-model    sonnet-4   $0.0134  ok
  2026-04-13T19:23  stage5-sweet-spot      sonnet-4   $0.0216  ok
  ...

  > /mos:budget reset         Reset current month spend to 0
  > /mos:budget cap 20        Raise monthly cap to $20
```

Subcommands in 81-05:
- (default) `status` - show the table above
- `reset` - zero out `spend_current_month_usd`, write back
- `cap <n>` - update `monthly_cap_usd`, write back
- `per-run <n>` - update `per_run_cap_usd`, write back

### What defers to v1.11.0 or later

- Per-room breakdown. Requires threading a `roomName` field through `llmCall` and into each budget entry, plus a grouping pass in the display.
- Budget alerts (email, webhook, notification). Requires an integration surface the plugin does not have today.
- Spend graphs. Requires a chart library the plugin does not have.
- Per-model breakdown. Easy to add later; just a grouping variation on the same data.
- Per-project / per-user breakdown for Cowork. Requires the Cowork multi-tenant budget model, which is itself a design question, not code.

### Justification for the minimum

The monthly cap is the only feature that prevents users from burning money. Everything else is observability. Ship the cap with a readable table, defer the rest. The `recent_calls` ring buffer already exists as a data source, so wiring it into the display is zero new schema work.

### File layout

- Command: `commands/budget.md` (Claude Code plugin command, matches existing patterns like `commands/vault.md`)
- Logic: `lib/core/budget-ops.cjs` (new, thin wrapper around `~/.mindrian/budget.json` read/write)
- Used by: `lib/memory/llm-call.cjs` (calls `budget-ops.cjs::checkBudgetGate` and `::recordSpend`)

No CLI router changes needed - `/mos:budget` is a Claude Code slash command that reads the file directly via the Bash tool (`node -e "require('./lib/core/budget-ops.cjs').printStatus()"`) or via a dedicated subcommand in `bin/mindrian-tools.cjs budget status`. The latter is cleaner. Add `budget` as a subcommand in `mindrian-tools.cjs` in 81-05.

## 7. Implications for the 5-Plan Decomposition

### 81-01 Foundation

Scope adjustments:
- Add `lib/memory/llm-call.cjs` with full direct-fetch branch, budget gate, error classes, and a tri-surface detection stub (today only the fetch branch is implemented; MCP branch is a TODO that throws `LLMUnavailableError`).
- Add `lib/memory/feynman-prompts.cjs` with the four tightened prompt constants (Stage 1, 2, 4, 5) and `buildPromptN(input)` functions. This file is content-only, zero logic.
- Add `lib/memory/feynman-stages.cjs` with the four stage functions. In 81-01 they are **stubs that throw `NotImplementedError`** - no real LLM calls yet. Signatures are final so 81-02 and 81-03 just fill them in.
- Add `lib/core/budget-ops.cjs` with `readBudget`, `writeBudget`, `checkBudgetGate`, `recordSpend`, `resetMonth`, `monthRollover`. This is called by `llm-call.cjs` and by `/mos:budget` in 81-05.
- Add `test-fixtures/feynman/` directory structure with ROOM.md files and the fetch shim at `lib/memory/__test_fetch_shim.cjs`.
- Add a first pass of `lib/memory/feynman-stages.test.cjs` that calls the stub stage functions and asserts the NotImplementedError path - this is a placeholder test that proves the wiring is correct before 81-02 replaces the stubs with real implementations.
- Add unit tests for `budget-ops.cjs`: month rollover, cap enforcement, ring-buffer capping at 100, write-then-read round trip.
- Add unit tests for `llm-call.cjs` error mapping: missing key -> `LLMUnavailableError`, budget over -> `LLMBudgetError`, API 500 -> `LLMError`. These use a fake `fetch` injected via a module-level variable that `__test_fetch_shim.cjs` can stomp.

Deliverables end of 81-01: all files exist, all stubs wired, `node lib/memory/feynman-stages.test.cjs` and `node lib/memory/llm-call.test.cjs` and `node lib/core/budget-ops.test.cjs` green. No live LLM calls yet. No fixture content yet.

### 81-02 Stages 1 and 2

Scope adjustments:
- Fill in `feynmanStage1_essence` and `feynmanStage2_plainLanguage` with real `llmCall` invocations using the prompts from `feynman-prompts.cjs`.
- Record initial fixtures: three input cases per stage (short, typical, long). Commit fixtures. Developer must run with `RECORD_FIXTURES=1` once.
- Assertion suite per stage: structural checks, bounds, no-em-dash, JSON parse round-trip.
- Integration test: given a fixture input MD file with 3 artifacts, call `feynmanStage1_essence` then `feynmanStage2_plainLanguage` in sequence, assert both return well-formed objects and chain correctly (Stage 2 input includes Stage 1 output in its prompt).
- Cost verification: record the actual `usage` field in each fixture, compute the total, compare to the $0.15 per-run cap estimate. If significantly higher or lower than the 2-Q estimate, update the cost model and document in CHANGELOG.

### 81-03 Stages 4 and 5

Same shape as 81-02, for `feynmanStage4_mentalModel` and `feynmanStage5_sweetSpot`. Plus:
- A full 4-stage pipeline integration test: input MD -> Stage 1 -> Stage 2 -> Stage 4 -> Stage 5, assert the final structured object has all the fields needed by the MINTO renderer (essence, plain, elevator, models, sweetSpot, keyClaims, fundamentals). This is the target contract for 81-04.
- The full-pipeline test is the single end-to-end fixture that 81-04 treats as its input contract.

### 81-04 Generator Rewrite + Tier Fallback

Scope adjustments:
- **Do NOT modify the existing `scripts/vault-section-minto-generator.cjs`** beyond adding the fallback wiring. Preserve all structural helpers (`deriveMeceTree`, `deriveGaps`, `findRelatedSections`, `renderSectionMinto` etc) as named exports.
- Add a sibling file `lib/memory/feynman-minto-renderer.cjs` that imports the structural helpers and replaces the narrative functions (`deriveGoverningThought`, `deriveClaims`, the claim section rendering) with calls into the 4-stage pipeline. The new renderer is what produces the MINTO body when tier-1 is active.
- Modify the generator's main `renderSectionMinto` entry to:
  1. Try tier-1: call `feynmanMintoRender(section, artifacts, room)`. If success, return result.
  2. Catch `LLMUnavailableError`, `LLMBudgetError`, `LLMError`, or `LLMParseError`. Log the reason to stderr with `[minto] tier-0 fallback: <reason>`. Fall through.
  3. Tier-0: run the existing deterministic path, then append an AAAK footer via `lib/memory/aaak-compress.cjs::attachAaakFooter`. This is where AAAK actually wires in for the first time.
- Integration tests with three scenarios:
  1. Tier-1 happy path: `ANTHROPIC_API_KEY` set, fixtures present (via fetch shim), full pipeline produces a Feynman-MINTO under 1500 tokens.
  2. Tier-0 forced-unavailable: no `ANTHROPIC_API_KEY`, generator produces deterministic MINTO + AAAK footer. The AAAK footer round-trips through `parseAaakFooter`.
  3. Tier-0 forced-budget-exceeded: `ANTHROPIC_API_KEY` set, budget file shows monthly cap already reached, generator falls back to the same tier-0 output. Same assertion as (2).
- A fourth scenario, optional: tier-0 forced-api-error. Set `ANTHROPIC_API_KEY` to a bogus value, run against a fake fetch that returns 401. Assert tier-0 fallback with a logged warning.
- **Token count assertion.** For tier-1 output on the fixture room, assert the final rendered MINTO is < 1500 tokens (rough char count / 4). This is FEYNMINTO-01's verification point.

### 81-05 Commands, Migration, Release

Scope adjustments:
- `/mos:reason --regenerate-all` command. Walks every MINTO.md under `~/MindrianRooms/<active-room>/`, backs each up to `.migration-backup/YYYY-MM-DD-HHMM/<relative-path>.md`, regenerates via the new generator. Dry-run flag. Progress output.
- `/mos:budget` command with `status`, `reset`, `cap`, `per-run` subcommands per Section 6.
- CHANGELOG [1.10.2] entry with all five mandatory points from 81-CONTEXT.md Execution Notes: (a) why v1.10.1 was skipped, (b) tier-1/tier-0 architecture, (c) cost model, (d) migration path, (e) semver deviation.
- Version bumps across all five gates from release-process.md: CHANGELOG.md, `.claude-plugin/plugin.json`, `package.json`, git tag `v1.10.2`, `~/mindrian-marketplace/.claude-plugin/marketplace.json` with `ref: v1.10.2` pinned.
- New CLAUDE.md Decision entry (Decision #17 or next free number - check the current CLAUDE.md count at release time) documenting "Feynman-MINTO as the default /mos:reason architecture". Include the tier fallback, the env var requirement for tier-1, and a link to `lib/memory/feynman-stages.cjs`.
- Integration test: full fixture room, pre-81 format, run `regenerate-all`, assert backup directory exists with all original files, assert new files are valid MINTO, assert git diff shows both old (in backup) and new (in place).
- Release infrastructure beta gate: v1.10.2 is a **feature release** not a release-infrastructure release, so it ships as stable, not as `1.10.2-beta.1`. The beta gate in release-process.md applies to release infrastructure changes, not feature phases.

## 8. Validation Architecture (nyquist_validation enabled)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Plain Node `node:assert/strict` + hand-rolled test harness (pattern from `lib/memory/aaak-compress.test.cjs`) |
| Config file | None - tests are standalone `.test.cjs` files run directly via `node <file>` |
| Quick run command | `node lib/memory/feynman-stages.test.cjs` |
| Full suite command | `node scripts/run-memory-tests.cjs` (added in 81-01 - walks `lib/memory/*.test.cjs`, `lib/core/*.test.cjs`, exits non-zero on any failure) |

### Phase Requirements to Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| FEYNMINTO-01 | MINTO output < 1500 tokens tier-1 | integration | `node lib/memory/feynman-minto-renderer.test.cjs` (81-04) | Wave 0 |
| FEYNMINTO-02 | Structural parts deterministic | unit | `node lib/memory/feynman-minto-renderer.test.cjs --structural` (81-04) | Wave 0 |
| FEYNMINTO-03 | Tier-1 uses stages 1, 2, 4, 5 | unit | `node lib/memory/feynman-stages.test.cjs` (81-02 + 81-03) | Wave 0 |
| FEYNMINTO-04 | Tier-0 fallback uses deterministic + AAAK | integration | `node lib/memory/feynman-minto-renderer.test.cjs --tier-0` (81-04) | Wave 0 |
| FEYNMINTO-05 | Per-run cost budget enforced | unit | `node lib/memory/llm-call.test.cjs` (81-01) | Wave 0 |
| FEYNMINTO-06 | Per-user monthly cap enforced | unit | `node lib/core/budget-ops.test.cjs` (81-01) | Wave 0 |
| FEYNMINTO-07 | --regenerate-all migrates with backup | integration | `node scripts/regenerate-all.test.cjs` (81-05) | Wave 0 |
| FEYNMINTO-08 | Pre-81 path preserved | unit | Covered by FEYNMINTO-04 and a direct unit test on the preserved named exports | Wave 0 |
| FEYNMINTO-09 | Stage functions are library calls | static | `grep` assertion in `lib/memory/feynman-stages.cjs`: no `execSync`, no shell-out | Wave 0 |
| FEYNMINTO-10 | llm-call.cjs abstracts surfaces | unit | Covered by `llm-call.test.cjs` surface-detect branch | Wave 0 |

### Sampling Rate

- **Per task commit:** `node lib/memory/feynman-stages.test.cjs && node lib/memory/llm-call.test.cjs && node lib/core/budget-ops.test.cjs` (stage-specific tests for whichever file the task touched)
- **Per wave merge:** `node scripts/run-memory-tests.cjs` (all memory + core tests)
- **Phase gate:** full-suite green plus an aaak-compress regression check (`node lib/memory/aaak-compress.test.cjs` still 21/21 after 81-04 wires it into the fallback path) before `/gsd:verify-work` runs

### Wave 0 Gaps

- [ ] `lib/memory/feynman-stages.test.cjs` - covers FEYNMINTO-01, 02, 03, 09
- [ ] `lib/memory/llm-call.test.cjs` - covers FEYNMINTO-05, 10
- [ ] `lib/memory/feynman-minto-renderer.test.cjs` - covers FEYNMINTO-02, 04 (added in 81-04)
- [ ] `lib/memory/__test_fetch_shim.cjs` - shared test utility, no own test file
- [ ] `lib/core/budget-ops.test.cjs` - covers FEYNMINTO-06
- [ ] `scripts/regenerate-all.test.cjs` - covers FEYNMINTO-07 (added in 81-05)
- [ ] `scripts/run-memory-tests.cjs` - test runner that exits non-zero on any failure (81-01)
- [ ] `test-fixtures/feynman/ROOM.md` + per-stage ROOM.md files (81-01 creates empty, 81-02 and 81-03 fill)
- [ ] Framework install: none - plain Node, no dependencies

All six gaps are created in 81-01 except the two explicitly tagged for later plans.

## 9. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js >=18 (built-in `fetch`) | `llm-call.cjs` direct-fetch branch | Yes (engines field in package.json) | >=18 | None needed |
| `node:assert/strict` | all test files | Yes (built-in) | N/A | None needed |
| `node:crypto` (for fixture sha256) | `__test_fetch_shim.cjs` | Yes (built-in) | N/A | None needed |
| `ANTHROPIC_API_KEY` env var | tier-1 LLM path only | User-supplied | N/A | Tier-0 deterministic + AAAK |
| `lib/memory/aaak-compress.cjs` | tier-0 fallback footer | Yes (committed, 21/21 tests) | 1.0 | None (the library IS the fallback) |
| `scripts/vault-section-minto-generator.cjs` | tier-0 deterministic path | Yes (committed) | pre-81 | None (the script IS the fallback) |
| Claude Code session context | None (explicitly not a dependency) | N/A | N/A | N/A - generator runs as spawned subprocess, not inside the session |
| MindrianOS v3.0 MCP server | Future MCP branch in `llm-call.cjs` | No (not built) | N/A | Direct fetch is the active path; MCP branch is a throw-stub |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `ANTHROPIC_API_KEY` falls back to tier-0. This is the core safety guarantee of the phase.

## 10. Go/No-Go Verdict

**GO. Ship as v1.10.2 now.**

### Justification

1. **The LLM invocation question is resolved.** Direct fetch from Node with `process.env.ANTHROPIC_API_KEY` is simple, proven in the repo (four browser-side precedents), and the only mechanism that works on all three surfaces today. It requires no new infrastructure, no v3.0 dependency, no shell-out tricks.

2. **The testing question is resolved.** Recorded fixtures with a fetch shim and structural assertions are a standard pattern. Zero live network calls in default test runs. Fixtures committed, diffable, self-documenting via paired `.input.md` files.

3. **The skill-changes question is resolved.** The Feynman engine skill stays exactly as it is. Phase 81 is additive. The skill file is never read at runtime.

4. **The Decision #1 bend is acceptable and documented.** Users who do not set `ANTHROPIC_API_KEY` still get a working plugin via tier-0 fallback. The zero-config install still works. Tier-1 is a paid upgrade that users opt into by setting a single env var. This is analogous to how `gh` CLI, `git`, and countless other tools handle optional authenticated features. The CHANGELOG must state this honestly.

5. **Cost is bounded.** The budget gate (D-5) hard-caps spend at $0.15/run and $10/month. Tier-0 fallback catches any budget-exceeded case. Ring-buffer logging gives observability via `/mos:budget`.

6. **Failure modes are all accounted for.** Missing key, API error, budget over, parse error - each has a defined fallback to tier-0. The pre-81 deterministic generator is still green and will stay that way because 81-04 only wires fallback around it, never touches its internals.

7. **AAAK is protected.** 21/21 tests stay green. The library is called from exactly one new site (tier-0 fallback in 81-04). No modifications, no deletions.

### Conditions on the Go

- **Verify Anthropic pricing** (model costs) at the start of 81-02 via a real API call and update `computeCost()` in `lib/core/budget-ops.cjs`. The current 2026-Q2 numbers are MEDIUM confidence.
- **Evaluate Haiku for stages 1 and 2** during 81-02 fixture recording. If Haiku produces acceptable output, use it - the monthly cap stretches further. If not, keep Sonnet across all four stages and document.
- **Record fixtures early and commit them.** Do not let fixtures drift uncommitted on any developer's machine. The fixture files are part of the plan, not a dev-side artifact.
- **81-05 must respect the 5-gate release process.** CHANGELOG, plugin.json, package.json, git tag, marketplace.json - all five in one commit, with the marketplace pinned at `ref: v1.10.2`.
- **Workspace guard must stay active.** Every commit in Phase 81 must be made from `/home/jsagi/MindrianOS-Plugin/`, never from `~/.claude/plugins/mindrian-os/`. The session-start hook enforces this.
- **Document the env-var setup step** in the CHANGELOG and in a new short reference file `docs/setup/anthropic-api-key.md`. Users should not have to guess.

### Blockers

None found.

### Things that are NOT blockers but are worth watching

- **Model drift.** Anthropic may rename or deprecate `claude-sonnet-4-20250514` during the phase. Fixtures will still pass (they store the old model name in the response envelope), but live runs will start failing. Mitigation: the prompt file has a `DEFAULT_MODEL` constant, changeable in one place. Add a note to 81-05 release checklist: "verify DEFAULT_MODEL is still current before tagging".
- **Fixture drift from temperature.** At temperature 0.2, the same prompt can yield slightly different fixtures on re-recording. The tests assert on shape, not content, so small drift is fine. Larger drift (prompt is actually ambiguous) means the prompt needs tightening. Developers should watch for this in 81-02 and 81-03.
- **Budget file corruption.** If a user edits `~/.mindrian/budget.json` by hand and breaks the JSON, `budget-ops.cjs::readBudget` should detect parse failure and restore from a backup or fresh template. Add this as an edge case in `budget-ops.test.cjs`. Not a shipping blocker.

## 11. Sources

### Primary (HIGH confidence)

- `.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md` - the 231-line authoritative source for Phase 81, read in full.
- `/home/jsagi/.claude/skills/feynman-engine/SKILL.md` - 326 lines, read in full. Confirms skill is human-facing interactive pipeline. No changes needed.
- `CLAUDE.md` - read in full via system reminder. Tri-polar design rule, Decision #1, tier-0 mandate, technology stack.
- `.claude/includes/release-process.md` - 5-gate version consistency, beta gating rules, marketplace pinning.
- `lib/memory/aaak-compress.cjs` - 404 lines, read in full. Confirms em-dash scrub pattern, `attachAaakFooter` signature that 81-04 calls.
- `lib/memory/aaak-compress.test.cjs` - first 60 lines read. Confirms test harness pattern (plain `node:assert/strict`, hand-rolled `test()` wrapper, pass/fail counters, exit code). Phase 81 uses the same pattern.
- `scripts/vault-section-minto-generator.cjs` - first 220 lines read. Confirms structural helpers (`deriveGaps`, `deriveMeceTree`, `renderSectionMinto`) are good named-export candidates. The tier-0 path in 81-04 keeps calling these.
- `scripts/vault-export-orchestrator.cjs` (context via grep) - confirms the generator is invoked headless from a subprocess, confirming that Q(b) options requiring access to the host Claude session are not viable.
- `lib/chat/fabric-chat.cjs` lines 120-195 - direct-fetch precedent (browser-side BYOAPI), used as the template for Node-side fetch in `llm-call.cjs`.
- `lib/wiki/wiki-server.cjs` lines 540-600 - server-side Node fetch precedent, also BYOAPI. Confirms the pattern works from Node, but sourced the key from the request body, not from `process.env`.
- `scripts/generate-snapshot.cjs` lines 1140-1180 - another direct-fetch precedent, confirming pattern ubiquity. Note: this one is embedded in an HTML string and executes in browser, not Node.
- `package.json` - confirmed Node >=18 engine field, which guarantees native `fetch` is available without polyfills.
- `.claude-plugin/plugin.json` - current version `1.10.0`, confirming 81-05 bumps to `1.10.2`.
- `lib/core/` listing - confirmed `budget-ops.cjs` does not yet exist, 81-01 creates it cleanly.
- `commands/reason.md` - read in full. Confirms `/mos:reason` already exists with `Bash` tool access, which is how the planner command can invoke the new generator subprocess.
- `commands/vault.md` lines 1-80 - confirms the invocation pattern commands use (`node bin/mindrian-tools.cjs <subcommand>`).

### Secondary (MEDIUM confidence)

- Anthropic Messages API pricing (Sonnet 4, Haiku 4) - ballpark figures from general ecosystem knowledge, must be verified at the start of 81-02 via a real API call. Pricing changes quarterly.
- `claude-sonnet-4-20250514` model ID currency - this ID is used in four places in the repo today, so it is at least as current as the repo. Phase 81 should verify at release time.

### Tertiary (LOW confidence / flagged)

- Future MCP server branch in `llm-call.cjs` - speculative stub. The MCP branch is implemented as a throw, not as real code. When v3.0 lands, a real implementation will land with it. Phase 81 does not block on it.

## 12. Metadata

**Confidence breakdown:**
- Q(b) LLM invocation mechanism: HIGH - four existing precedents in repo, one unambiguous recommendation, tradeoffs explicit.
- Q(c) Testing strategy: HIGH - standard pattern, plain-Node implementation, no new dependencies.
- Q(a) Prompt extraction: HIGH - separation of concerns rationale is clean.
- Q(d) Skill changes: HIGH - skill is unambiguously human-facing, zero coupling to library.
- Q(e) Budget scope: HIGH - minimum viable is clearly defined, deferrals are clearly deferrable.
- Cost model: MEDIUM - pricing is indicative, must be re-verified in 81-02.
- Tri-polar surface behavior for Desktop/Cowork: MEDIUM - the direct-fetch path works, but the full Desktop/Cowork UX story depends on v3.0 MCP landing. Tier-0 keeps both surfaces functional in the meantime.

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days for stable findings, shorter for pricing)

**Research complete. Ready for planning.**
