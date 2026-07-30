---
phase: quick-260730-mps
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mcp/prompts.cjs
  - tests/mcp-prompts-argsschema.test.cjs
autonomous: true
requirements: [QUICK-MCP-PROMPTS-01]
must_haves:
  truths:
    - "All 6 MCP prompts parse their arguments without throwing 'keyValidator._parse is not a function'"
    - "prompts/list advertises the real argument names, not the bogus pair 'description'/'arguments'"
    - "Each prompt's description is present in prompts/list (currently undefined on all 6)"
    - "Optional arguments can be omitted and still parse; required arguments are still enforced"
    - "A real prompts/get round-trip returns messages instead of MCP error -32603"
    - "No old-shape .prompt( call site survives anywhere in tracked source"
  artifacts:
    - path: "lib/mcp/prompts.cjs"
      provides: "All 6 prompts registered via server.registerPrompt with zod raw shapes"
      contains: "registerPrompt"
    - path: "tests/mcp-prompts-argsschema.test.cjs"
      provides: "Acceptance + regression test proving the exact failure mode is gone"
      min_lines: 120
  key_links:
    - from: "lib/mcp/prompts.cjs"
      to: "zod"
      via: "top-level require"
      pattern: "require\\('zod'\\)"
    - from: "lib/mcp/prompts.cjs"
      to: "McpServer.registerPrompt"
      via: "6 registration call sites"
      pattern: "server\\.registerPrompt\\("
    - from: "tests/mcp-prompts-argsschema.test.cjs"
      to: "server._registeredPrompts"
      via: "real McpServer instance, never a hand-rolled stub"
      pattern: "_registeredPrompts"
---

<objective>
Fix the live MCP crash: all 6 `server.prompt()` registrations in `lib/mcp/prompts.cjs` pass an
old-style `{description, arguments:[...]}` object where SDK 1.29.0 expects a zod raw shape, so the
first `prompts/get` dies with `keyValidator._parse is not a function` and surfaces as MCP -32603.

Purpose: Desktop and Cowork Larry currently cannot use ANY of the 6 methodology prompts. Total
outage of the prompts surface, not a degradation.

Output: all 6 converted to `server.registerPrompt(name, {title, description, argsSchema}, cb)` with
callback bodies byte-for-byte unchanged, plus a committed regression test that fails RED with the
exact production error before the fix and turns green after.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/mcp/prompts.cjs

Reference only, do NOT edit (vendored SDK):
- `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js` lines 709-739 (`prompt()` vs
  `registerPrompt()`), 566-590 (`_createRegisteredPrompt`), 411-448 (`prompts/list` + `prompts/get`)
- `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/zod-compat.js` lines 49-60 (`objectFromShape`)

In-repo idioms to mirror (style, not API):
- `lib/mcp/tool-router.cjs:31` is the canonical `const { z } = require('zod');` line.
- `bin/mindrian-brain-mcp-client.cjs:72`, `bin/mindrian-mcp-server.cjs:146` use the CORRECT legacy
  shape `s.tool(name, descriptionString, {zodRawShape}, cb)`. Already checked: NOT affected.
</context>

<root_cause>
Already diagnosed and confirmed live against the installed SDK. Do NOT re-investigate.

`McpServer.prompt(name, ...rest)` (mcp.js:709) shifts `rest[0]` off as `description` ONLY if it is
`typeof === 'string'`. Every call site here passes an OBJECT, so `description` stays `undefined` and
the whole `{description, arguments:[...]}` object falls through into `argsSchema`.
`_createRegisteredPrompt` runs it through `objectFromShape` (zod-compat.js:49); its values
(a string, an array) are not zod schemas, so it builds `z3rt.object({description, arguments})`. That
ZodObject only explodes at parse time inside `ZodObject._parse`, which is why registration succeeds
and the FIRST `prompts/get` is what fails.

Reproduced live on this checkout, all 6, before this plan was written:

```
-- file-meeting    | declared arg keys -> [ 'description', 'arguments' ] | description: undefined
   parse({}) THREW: keyValidator._parse is not a function
-- analyze-room / grade-venture / run-methodology / suggest-next / reason-section: identical
```

Two secondary symptoms share the root cause and the fix must close both:
1. `prompt.description` is `undefined` on all 6, so `prompts/list` shows no description.
2. `prompts/list` advertises two fabricated REQUIRED args literally named `description` and
   `arguments` on every prompt.

Sweep already run: `git grep -n "\.prompt(" -- '*.cjs' '*.js' '*.mjs'` returns exactly these 6, all
in `lib/mcp/prompts.cjs`, zero elsewhere. Task 1 Scenario E still proves it with a durable gate
rather than trusting this note.
</root_cause>

<conversion_contract>
Exact, non-negotiable mapping. Descriptions copied VERBATIM from the old objects.

| # | name | title | argsSchema |
|---|------|-------|------------|
| 1 | `file-meeting` | `'File Meeting'` | `transcript: z.string().describe('The full meeting transcript text')`, `meetingDate: z.string().optional().describe('Meeting date (YYYY-MM-DD format)')` |
| 2 | `analyze-room` | `'Analyze Room'` | `focus: z.string().optional().describe('Specific section or concern to focus on')` |
| 3 | `grade-venture` | `'Grade Venture'` | `depth: z.string().optional().describe('Assessment depth: "quick" (overview) or "deep" (detailed component analysis)')` |
| 4 | `run-methodology` | `'Run Methodology'` | `` methodology: z.string().describe(`Methodology to run. One of: ${METHODOLOGY_NAMES.join(', ')}`) ``, `focus: z.string().optional().describe('Specific venture aspect or question to focus the methodology on')` |
| 5 | `suggest-next` | `'Suggest Next'` | OMIT the `argsSchema` key entirely (Rule S) |
| 6 | `reason-section` | `'Reason Section'` | `section: z.string().describe('Room section to reason about')` |

**Rule S (suggest-next omits argsSchema, does NOT pass `{}`).** Probe-verified here:
`GetPromptRequestSchema` does not default `params.arguments`, so a client omitting it yields
`undefined`; `objectFromShape({})` returns `z4mini.object({})`, and parsing `undefined` against it
FAILS. Passing `{}` would turn every argument-less `suggest-next` call into InvalidParams. Omitting
`argsSchema` routes to the SDK's else branch (mcp.js:443-447), `cb(extra)`, no parse at all. The
existing `async () => {...}` body ignores its parameters either way, so it still does not change.

**Rule B (behavior-preserving, no schema tightening).** Do NOT convert `depth` to
`z.enum(['quick','deep'])` or `methodology` to `z.enum(METHODOLOGY_NAMES)`. Today any string is
accepted: `depth` falls back to `'quick'`, an unknown `methodology` degrades to a missing reference
file. Tightening turns those graceful paths into hard rejections, a behavior change this fix is not
authorized to make.

**Rule O (`.optional()` before `.describe()`).** Write `z.string().optional().describe('...')`. Both
orders happen to preserve the description on zod 3.25.76 (probe-verified), so this is a consistency
rule matching the SDK idiom, not a live bug.

**Rule C (callbacks untouched).** Every `async (args) => {...}` / `async () => {...}` body stays
byte-for-byte identical; they already destructure `args.<name>`, which is exactly what the SDK passes
as `parseResult.data`. `git diff` must show changes ONLY in registration argument lists plus the
added require.

**Rule Z (zod require).** The file has NO zod import today. Add `const { z } = require('zod');` after
`const path = require('path');` (line 19). `zod@3.25.76` is already installed; run ZERO
package-manager operations.

**Rule E (no em-dashes).** Repo hard rule. No em-dashes on any added or edited line. Do NOT
mass-rewrite the pre-existing em-dashes in untouched comment blocks; that expands the diff past the
fix and makes review harder.
</conversion_contract>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write the acceptance test RED-first and prove it reproduces the production crash</name>
  <files>tests/mcp-prompts-argsschema.test.cjs</files>
  <behavior>
    Against the CURRENT unfixed `lib/mcp/prompts.cjs` this test MUST FAIL, for the real reason
    (`keyValidator._parse is not a function`), not a typo or a missing module. After Task 2 it passes
    with zero edits to the test file.

    - Scenario A (all 6, exact crash site): for each prompt run the SDK's own
      `safeParseAsync(normalizeObjectSchema(rp.argsSchema), fullValidArgs)` from zod-compat. This is
      byte-for-byte what the `prompts/get` handler calls at mcp.js:432-433. Expect success for the 5
      argsSchema-bearing prompts and `rp.argsSchema === undefined` for `suggest-next`.
    - Scenario B (optionals really optional): re-parse with ONLY required args present
      (`file-meeting` -> `{transcript}`; `analyze-room` -> `{}`; `grade-venture` -> `{}`;
      `run-methodology` -> `{methodology}`; `reason-section` -> `{section}`). All succeed.
    - Scenario C (prompts/list metadata): `rp.description` is a non-empty string on all 6;
      `getObjectShape(rp.argsSchema)` keys equal the expected arg names per prompt and are explicitly
      NOT `['description','arguments']`; `isSchemaOptional` matches the original required flags; and
      `getSchemaDescription` returns the verbatim original description for each arg.
    - Scenario D (real round-trip, proves -32603 gone): connect a real `Client` to the real
      `McpServer` over `InMemoryTransport.createLinkedPair()`. `prompts/list` returns 6 prompts with
      correct argument names. Then `getPrompt` for `grade-venture` (argsSchema branch,
      `arguments: {}`), `reason-section` (argsSchema branch, required arg), and `suggest-next`
      (no-argsSchema `cb(extra)` branch, `arguments` omitted entirely). Each returns a non-empty
      `messages` array and does not throw.
    - Scenario E (durable sweep gate, permanently satisfies the sweep requirement): shell out to
      `git grep -n "\.prompt(" -- '*.cjs' '*.js' '*.mjs'`, drop comment-only hits via
      `grep -v ':[0-9]*: *//'`, assert the count is 0, and print every surviving hit on failure.
    - Non-vacuity self-test: assert all 6 expected names exist in `server._registeredPrompts` before
      any other scenario runs, so a rename or a silently-empty registration cannot pass by testing
      nothing.
  </behavior>
  <action>
    Create `tests/mcp-prompts-argsschema.test.cjs` as a standalone CJS script, no test framework,
    matching the repo's plain-node style (see `tests/test-eureka-mcp-tools.cjs`). Print per-scenario
    PASS/FAIL lines; `process.exit(1)` on any failure.

    Build with the REAL SDK class, never a hand-rolled stub: a stub never calls `objectFromShape`,
    which IS the crash site, so a stub-based test is vacuous. Require `McpServer` from
    `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js`, `Client` from
    `.../dist/cjs/client/index.js`, `InMemoryTransport` from `.../dist/cjs/inMemory.js`, and the
    zod-compat helpers from `.../dist/cjs/server/zod-compat.js`. The package `exports` map blocks
    deep subpath requires from a relative base, so resolve each via an absolute path built from
    `path.resolve(__dirname, '..')`, not a bare specifier.

    Instantiate `new McpServer({ name: 'prompts-argsschema-test', version: '0.0.0' })`, create a temp
    room dir with `fs.mkdtempSync`, then call
    `registerPrompts(server, tmpRoomDir, path.resolve(__dirname, '..'))`.

    Wrap each Scenario A/B parse in try/catch and report the caught message, so the RED run prints
    the literal `keyValidator._parse is not a function` instead of dying on the first prompt.

    Give Scenario D a watchdog: `suggest-next` reaches `computeState`, which `execSync`s
    `bash scripts/compute-state` with an internal 10s timeout and writes STATE.md into the room dir
    (harmless in a temp dir). Fail with a clear diagnostic if a single `getPrompt` exceeds 20s rather
    than hanging the suite. Remove the temp dir in a `finally`.

    Do not modify `lib/mcp/prompts.cjs` in this task.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/mcp-prompts-argsschema.test.cjs > /tmp/mps-red.log 2>&1; test $? -ne 0 && grep -q "keyValidator._parse is not a function" /tmp/mps-red.log && echo "RED CONFIRMED"</automated>
  </verify>
  <done>Test exits non-zero against unfixed code, output contains the literal `keyValidator._parse is not a function`, and it reports the bogus `['description','arguments']` arg keys. The failure is the real defect, not a harness error.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Convert all 6 registrations to registerPrompt with zod raw shapes</name>
  <files>lib/mcp/prompts.cjs</files>
  <behavior>
    `node tests/mcp-prompts-argsschema.test.cjs` exits 0 with every scenario PASS, with zero edits to
    the Task 1 test file.
  </behavior>
  <action>
    Apply `<conversion_contract>` exactly. Add `const { z } = require('zod');` after
    `const path = require('path');` (Rule Z), then rewrite each of the 6 `server.prompt(` sites as
    `server.registerPrompt(name, { title, description, argsSchema }, callback)` per the mapping
    table, with `suggest-next` omitting `argsSchema` entirely (Rule S).

    Honor Rule B (no enum tightening on `depth` or `methodology`), Rule O, Rule C (callback bodies
    byte-for-byte unchanged), Rule E (no new em-dashes).

    `run-methodology`'s `methodology` description is a template literal interpolating
    `METHODOLOGY_NAMES.join(', ')`. Keep it a template literal so the 25 framework names stay live
    rather than frozen into a literal string.

    Confirm the diff is scoped: `git diff --stat` shows only `lib/mcp/prompts.cjs`, and
    `git diff lib/mcp/prompts.cjs` shows no change inside any callback body.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node --check lib/mcp/prompts.cjs && node tests/mcp-prompts-argsschema.test.cjs && test $(grep -c "server.registerPrompt(" lib/mcp/prompts.cjs) -eq 6 && test $(grep -v '^[[:space:]]*//' lib/mcp/prompts.cjs | grep -c "server\.prompt(") -eq 0 && grep -q "require('zod')" lib/mcp/prompts.cjs && echo "GREEN"</automated>
  </verify>
  <done>All 6 use `server.registerPrompt`, zero `server.prompt(` remain, the zod require exists, the full test suite passes, and no callback body changed.</done>
</task>

<task type="auto">
  <name>Task 3: Mutation-prove the gate, sweep the repo, and commit</name>
  <files>lib/mcp/prompts.cjs, tests/mcp-prompts-argsschema.test.cjs</files>
  <action>
    1. Mutation proof (the test must be capable of failing). Temporarily revert ONE registration
       (`analyze-room`) back to the old `server.prompt(name, {description, arguments:[...]}, cb)`
       shape, run the test, and confirm it goes RED with `keyValidator._parse is not a function`.
       Restore immediately and confirm GREEN again. Record both outcomes in the SUMMARY. A gate that
       has never been observed failing is not a gate.

    2. Repo-wide sweep, proven not asserted. Run
       `git grep -n "\.prompt(" -- '*.cjs' '*.js' '*.mjs'` and
       `git grep -n "arguments: \[" -- 'lib/**/*.cjs' 'bin/**/*.cjs'`, both filtered of comment-only
       hits. Expected result is zero old-shape call sites outside the 6 just fixed. If ANY additional
       site is found, fix it with the identical `registerPrompt` pattern and extend the test to
       cover it before committing. Also spot-confirm the `s.tool(` / `server.tool(` callers in
       `bin/mindrian-mcp-server.cjs` and `bin/mindrian-brain-mcp-client.cjs` still pass a description
       STRING in position 2 (they do today, so they are correct and must be left untouched); this is
       a read-only check, not an edit.

    3. Commit both files with the pre-commit chain intact. Do NOT set `COMMIT_NO_VERIFY`. Message:
       `fix(mcp): register all 6 prompts via registerPrompt with zod raw shapes`
       with a body naming the root cause (`objectFromShape` over a non-schema object producing a
       ZodObject that throws `keyValidator._parse is not a function` on the first `prompts/get`).

    Scope guard: do NOT run `scripts/release.sh`, do NOT bump any version, do NOT touch
    `CHANGELOG.md` or `.claude-plugin/plugin.json`. A release is the user's separate explicit step.
    Note in the SUMMARY that this fix is NOT live for any user until a release ships and is picked
    up: a running session never hot-reloads the plugin cache.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/mcp-prompts-argsschema.test.cjs && test $(git grep -c "\.prompt(" -- '*.cjs' '*.js' '*.mjs' | wc -l) -eq 0 && git diff --quiet HEAD -- lib/mcp/prompts.cjs tests/mcp-prompts-argsschema.test.cjs && git log -1 --name-only --format=%s | head -5 && git diff HEAD~1 --name-only | grep -qv -e CHANGELOG.md -e plugin.json -e package.json && echo "COMMITTED CLEAN"</automated>
  </verify>
  <done>Mutation proof observed in both directions, sweep returns zero remaining old-shape sites, both files committed on a clean pre-commit run, and no version/CHANGELOG/plugin.json file appears in the commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| MCP client -> `prompts/get` arguments | Untrusted client-supplied strings cross into prompt callbacks |
| Prompt callback -> filesystem | `reason-section` joins a client-supplied `section` onto `roomDir` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-MPS-01 | Denial of Service | `prompts/get` handler, all 6 prompts | mitigate | This IS the fix: a valid zod raw shape means arguments now parse instead of throwing an unhandled `TypeError` out of `ZodObject._parse` on every call |
| T-MPS-02 | Tampering | client-supplied prompt args | mitigate | Post-fix, every declared arg is validated as `z.string()` before reaching a callback; pre-fix, validation was structurally dead because the schema always threw |
| T-MPS-03 | Information Disclosure | `reason-section` -> `path.join(roomDir, args.section)` | accept (pre-existing, unchanged, logged) | A traversal-shaped `section` (`../..`) would read `.md` files outside the room. This predates the fix and Rule C forbids touching callback bodies here, so scope is unchanged rather than widened. Flagged for a follow-up `/gsd-debug`; do NOT silently fix it inside this plan |
| T-MPS-SC | Tampering | npm/pip/cargo installs | mitigate | ZERO package-manager operations. `zod@3.25.76` and `@modelcontextprotocol/sdk@1.29.0` are already installed and vendored; no package legitimacy audit is required because no install task exists |
</threat_model>

<verification>
```bash
cd /home/jsagi/dev/MindrianOS-Plugin
node --check lib/mcp/prompts.cjs
node tests/mcp-prompts-argsschema.test.cjs          # all scenarios PASS, exit 0
git grep -n "\.prompt(" -- '*.cjs' '*.js' '*.mjs'   # zero hits
grep -c "server.registerPrompt(" lib/mcp/prompts.cjs # 6
node -e "require('./lib/mcp/prompts.cjs')"           # module still loads
```

Canon gates for this change: no em-dashes on edited lines; no Brain egress touched (Part 8 not in
scope, prompts are local-only); tri-polar impact is Desktop plus Cowork (the two surfaces that
consume MCP prompts), CLI unaffected.
</verification>

<success_criteria>
- All 6 prompts registered via `server.registerPrompt` with a zod raw shape; zero `server.prompt(` remain.
- `const { z } = require('zod');` present at the top of `lib/mcp/prompts.cjs`.
- `node tests/mcp-prompts-argsschema.test.cjs` exits 0; the SAME test exited non-zero with
  `keyValidator._parse is not a function` before the fix (RED observed, recorded).
- Mutation proof observed: reverting one registration turns the test red, restoring turns it green.
- Every callback body byte-for-byte unchanged.
- Optional args (`meetingDate`, `focus`, `depth`) parse when omitted; required args (`transcript`,
  `methodology`, `section`) are still enforced.
- `suggest-next` has NO `argsSchema` and answers a `prompts/get` sent without an `arguments` field.
- Both files committed with the pre-commit chain intact; no version, CHANGELOG, or plugin.json change;
  no release attempted.
</success_criteria>

<output>
Create `.planning/quick/260730-mps-fix-lib-mcp-prompts-cjs-all-6-server-pro/260730-mps-SUMMARY.md` when done.
Record: the RED output verbatim, the mutation-proof result in both directions, the sweep result, and
the reminder that this is not live for users until a release ships and is picked up.
</output>
