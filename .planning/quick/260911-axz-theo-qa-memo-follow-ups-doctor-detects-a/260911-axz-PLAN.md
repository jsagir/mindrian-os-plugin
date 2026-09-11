---
phase: quick/260911-axz
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [AXZ-01, AXZ-02, AXZ-03]
files_modified:
  - lib/core/integration-registry.cjs
  - lib/core/doctor/class-m-brain-smoke.cjs
  - lib/core/doctor/class-m-brain-smoke.test.cjs
  - scripts/doctor.cjs
  - tests/test-127-02-doctor-class-m.sh
  - commands/doctor.md
  - docs/339-NOTE-theo-desktop-connector-key.md
  - .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-12-SUMMARY.md
  - .planning/seeds/SEED-082-bidirectional-command-framework-sync-drift-detection.md
  - CHANGELOG.md
  - scripts/build-brain-census.cjs
  - data/brain-census.generated.json
  - docs/BRAIN-GRAPH-CENSUS.generated.md

must_haves:
  truths:
    - "A developer running `node scripts/doctor.cjs --brain-smoke` on a machine carrying a user-scope or local-scope `mindrian-brain` entry in ~/.claude.json sees a not-ok row naming the scope, the URL host, and the exact `claude mcp remove` line that fixes it."
    - "The same developer sees, in one row, which Brain origin the wire resolved to, whether it is a Theo origin, whether MINDRIAN_BRAIN_URL overrode it, and Theo's live mode plus build_stamp.sha when Theo answers."
    - "No Authorization value, and no header value of any kind, appears anywhere in doctor's output for the shadow check."
    - "The shadow check never flags a Claude Desktop or Cowork connector, and never flags the plugin's own .mcp.json shim: it reads ~/.claude.json only."
    - "Layers 1 through 6 still run and still report exactly as before when a shadow entry is present: the new layer is information-bearing, never a short circuit."
    - "A Theo store carrying fewer than 27,000 nodes is reported thin by doctor, instead of passing a 96 percent content loss."
    - "A reader of docs/339-NOTE-theo-desktop-connector-key.md learns that the keep-the-name advice is Claude Desktop and Cowork only, and that a user-level `mindrian-brain` entry in Claude Code shadows the plugin's shim."
    - "A reader of 339-12-SUMMARY.md learns the documented rollback lever is dead, without any of that file's original text being rewritten."
    - "SEED-082 reads as triggered, dated 2026-09-11, carrying all four drift facts with correct measurements: registry version skew, the never-synced Sensor layer (0 in Theo against a 14-id sensor_index and 72 of 209 entries carrying sensor_triggers), and the framework gap of 9 methodology commands plus 28-name alias resolution (49 of 113 commands declare frameworks, Theo links 40)."
    - "data/brain-census.generated.json and docs/BRAIN-GRAPH-CENSUS.generated.md describe Theo as of 2026-09-11, naming the origin and the run date, and carrying 27,951 nodes / 39,732 relationships / 452 Framework."
    - "The incumbent census lane still renders byte-identically from the pre-existing incumbent data."
  artifacts:
    - path: "lib/core/doctor/class-m-brain-smoke.cjs"
      provides: "L0 origin-and-shadow layer, THEO_NODE_FLOOR=27000, exported for assertion"
      contains: "origin_shadow"
    - path: "lib/core/integration-registry.cjs"
      provides: "the one ~/.claude.json scoped mcpServers reader, header-stripping projection"
      exports: ["readScopedMcpServers", "parseMcpConfig"]
    - path: "lib/core/doctor/class-m-brain-smoke.test.cjs"
      provides: "RED-first arms for the shadow layer, the origin row, and the floor constant"
      contains: "readScopedMcpServers"
    - path: "docs/339-NOTE-theo-desktop-connector-key.md"
      provides: "the Claude Code paragraph (do not add a user-level mindrian-brain server)"
      contains: "Claude Code"
    - path: ".planning/seeds/SEED-082-bidirectional-command-framework-sync-drift-detection.md"
      provides: "triggered status + triggered_at + trigger_evidence carrying all four facts with correct measurements, plus the claim-side-versus-existence-side design question"
      contains: "triggered_at: 2026-09-11"
    - path: "docs/BRAIN-GRAPH-CENSUS.generated.md"
      provides: "the Theo-lane census, origin and date named"
      contains: "theo-mcp.onrender.com"
  key_links:
    - from: "lib/core/doctor/class-m-brain-smoke.cjs"
      to: "lib/core/integration-registry.cjs"
      via: "require of readScopedMcpServers (no third reader minted)"
      pattern: "readScopedMcpServers"
    - from: "lib/core/doctor/class-m-brain-smoke.cjs"
      to: "lib/core/brain-client.cjs"
      via: "getBrainUrl + THEO_ORIGINS + callTool('theo_health')"
      pattern: "THEO_ORIGINS"
    - from: "scripts/doctor.cjs"
      to: "class-m-brain-smoke layer payloads"
      via: "per-layer-id payload renderer (origin_shadow vs store_identity)"
      pattern: "origin_shadow"
    - from: "scripts/build-brain-census.cjs"
      to: "Theo brain_stats.labels + brain_schema"
      via: "Theo-shape lane B selection, whole-graph Cypher skipped"
      pattern: "theo_shape"
---

<objective>
Close the three Theo QA memo follow-ups in one plan: make doctor able to see the failure that put a beta.33 install at Tier 0 all session, correct the two documents that still tell a reader the wrong thing, and re-census the Brain against the backend that actually answers.

Purpose: on 2026-09-11 a live install ran Larry at Tier 0 for a whole session because a USER-scope `~/.claude.json` `mcpServers` entry named `mindrian-brain` (type http, url `https://mindrian-brain.onrender.com/mcp`, stale Authorization header) loaded in Claude Code and shadowed the plugin's own `.mcp.json` stdio shim of the same name. That origin returns HTTP 503 (Render "Service Suspended"). Doctor did not detect any of it: class M probes IN PROCESS through `brain-client.cjs`, which resolves to Theo, so layers 1 through 6 all pass while the user's actual session talks to the shadow. The probe was not wrong, it was blind to the one thing that mattered. Alongside that, `THEO_NODE_FLOOR = 1000` against a 27,951-node live store would pass a 96 percent content loss, the documented rollback lever points at a suspended host, and the census artifacts still describe the retired incumbent.

Output: a 7-layer class M probe whose first layer answers "which origin am I on, is it alive, and is anything shadowing my shim"; a Claude Code paragraph in the Desktop connector note; an appended (never rewritten) dead-lever note on 339-12-SUMMARY.md; SEED-082 moved to triggered with four-fact evidence and a recorded open design question; and regenerated census artifacts describing Theo.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md

Measured ground, 2026-09-11, live and from source. Do NOT re-derive any of this:

- The shadow: user-scope `~/.claude.json` `mcpServers.mindrian-brain`, type http, url `https://mindrian-brain.onrender.com/mcp`, stale Authorization header. That URL returns HTTP 503 (Render "Service Suspended"). `https://pws-brain-mcp.onrender.com/mcp` returns 401 without a key (alive, keyed, and NOT a rollback target).
- This dev machine has no such entry: user scope holds `theo` (stdio) among 22 servers; `projects["/home/jsagi"].mcpServers` holds `pws-brain-mcp` (http). So the happy path is what you will observe locally; the not-ok path only exists under a fixture.
- Even pointed at Theo, a raw HTTP connector bypasses `brain-client.cjs` and loses the beta.33 `brain_ask` composition. The Claude Code fix is REMOVAL, never a URL swap. The URL-swap advice is Claude Desktop only (via mcp-remote).
- Theo live: `brain_stats` returns `{nodes: 27951, relationships: 39732, labels: [15 x {label,count}], diagnostics}`; `brain_schema` returns `{labels: [18], relationship_types: [39], property_keys: [...]}`; `theo_health` returns `{mode, quarantineCode, instanceUri, serverAgent, build_stamp: {sha, builtAt, dirty}}`. 33 tools on `tools/list`.
- Theo's command registry snapshot is `command-registry@2.0.0-beta.12`; the plugin ships `2.0.0-beta.33`. Theo's Sensor layer has NEVER been populated: 0 Sensor nodes graph-wide, 0 MindrianCommand->Sensor edges, while the Reach projection DID land (84 `WIRED_TO` -> Reach). Full MindrianCommand outgoing census: `PART_OF`->Root 113, `WIRED_TO`->Reach 84, `USES_FRAMEWORK`->Framework 38 (+4 to dual-labelled Framework|Technique), `NEXT_IN_RECIPE` 9, `FEEDS_INTO` 2, Sensor 0. Theo's `command_neighborhood` correctly references the declared property `declaration_side` (`resolver-config.yaml:254`, SENSE-03); the `UnknownPropertyKeyWarning` fires only because no writer has ever set it. Registry-sync territory, not a Theo query bug.
- Canon Part 8: doctor output may print an MCP server's URL host and scope. It may NEVER print an Authorization value or any other header value.
- Repo version is already `2.0.0-beta.34`; `CHANGELOG.md`'s `[Unreleased]` heading already reads `v2.0.0-beta.34 (in progress)` with an empty `### Added` bullet.

Scope vocabulary, verified against `claude mcp remove --help` on 2026-09-11 (this matters, the memo's wording is looser than the CLI's): Claude Code has three scopes, `local`, `user`, `project`. `~/.claude.json` top-level `mcpServers` is **user** scope. `~/.claude.json` `projects["<dir>"].mcpServers` is **local** scope, NOT `project`. `project` scope is a repo's own `.mcp.json`, which is exactly where the plugin ships its shim and is the one place this check must never look.

@lib/core/doctor/class-m-brain-smoke.cjs
@lib/core/doctor/class-m-brain-smoke.test.cjs
@lib/core/integration-registry.cjs
@scripts/build-brain-census.cjs
@docs/339-NOTE-theo-desktop-connector-key.md

Interfaces you will consume (read these, do not go hunting):

- `lib/core/brain-client.cjs` exports `getBrainUrl()` (`:1451`, returns module-scope `BRAIN_URL` from `:40`), `THEO_ORIGINS` (`:2066`, a frozen array, currently `['https://theo-mcp.onrender.com']`), `callTool(toolName, args)` (`:560`, returns the parsed tool result or `null` when no key resolves), `stats()`, `schema()`, `query()`.
- `lib/core/integration-registry.cjs` has `parseMcpConfig(mcpConfigPath)` at `:68`: the repo's ONE reusable arbitrary-path mcpServers read. It is currently NOT exported and it discards entry bodies (returns lowercased key names only). `lib/core/mcp-profiles.cjs`'s `checkServerAvailability` hardcodes `pluginRoot/.mcp.json` and is therefore not reusable here.
- `lib/core/doctor/class-m-brain-smoke.cjs`: `LAYERS` frozen array (`:52`), per-layer `opts.mock*` seam idiom (see `_layer3` and `_layer6`), `_runLayer` which forwards an optional `r.payload` onto the row, and `checkBrainSmoke`'s `prevOk` fail-fast cascade loop.
- `scripts/doctor.cjs:4195` `classMBrainSmoke(flags)` renders the human report and has a `if (layer.payload)` block hardcoded to the L6 shape (`endpoint= node_count= canon=`).
- `scripts/doctor.cjs:1587-1600` (the `--acceptance` activation-reached-the-wire gate) finds layers BY ID (`store_identity`) and by name (`L4 MCP stdio handshake`), never by index, so prepending a layer is safe there. Confirm this rather than assuming it.
- `scripts/build-brain-census.cjs`: `brainCall(tool, args, key)` (`:309`) JSON-parses `result.content[0].text`, so Theo's `brain_stats` lands flat as `{nodes, relationships, labels, diagnostics}`. `_runLaneB(key)` (`:776`) THROWS on a C1 failure. `renderMarkdown(census)` (`:451`) prints `meta.brain_stats.{backend,totalRecordCount,relationshipCount,vectorIndexes}` and a Lane B block keyed on `laneB.results.C1..C9`. `main()`'s `--lane-a` / `--lane-b` / `--render-only` modes are at `:827`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Doctor grows an origin-and-shadow layer, and the Theo node floor stops being a rubber stamp</name>
  <files>lib/core/integration-registry.cjs, lib/core/doctor/class-m-brain-smoke.cjs, lib/core/doctor/class-m-brain-smoke.test.cjs, scripts/doctor.cjs, tests/test-127-02-doctor-class-m.sh</files>

  <behavior>
Write these arms in `lib/core/doctor/class-m-brain-smoke.test.cjs` FIRST and watch them go red before touching the implementation. Every arm is hermetic: point the reader at a temp fixture path, never at the real `~/.claude.json`.

  - Test A (shadow present, user scope): fixture `{"mcpServers":{"mindrian-brain":{"type":"http","url":"https://mindrian-brain.onrender.com/mcp","headers":{"Authorization":"Bearer sk-SHOULD-NEVER-APPEAR"}}}}` -> L0 row `ok === false`; reason names scope `user`; reason contains host `mindrian-brain.onrender.com`; reason contains the literal `claude mcp remove mindrian-brain -s user`; reason contains a sentence saying the plugin provides this server; `JSON.stringify(result)` does NOT contain `sk-SHOULD-NEVER-APPEAR`, does NOT contain `Bearer`, does NOT contain `Authorization`, and does NOT contain the full `/mcp` URL path.
  - Test B (shadow present, local scope): the same entry under `projects["/some/dir"].mcpServers` with `projectDir: "/some/dir"` -> `ok === false`, scope reported as `local`, fix line `claude mcp remove mindrian-brain -s local`.
  - Test C (no shadow): fixture holding only unrelated servers (`theo` stdio, `pinecone` http) -> L0 row `ok === true`, reason says no shadowing entry found.
  - Test D (the plugin's own shim is never a shadow): a fixture `.mcp.json`-shaped file (bare `{"mcpServers":{"mindrian-brain":{"command":"node"}}}` with NO `projects` key and read via the `.mcp.json` path, not the `~/.claude.json` path) must not be consulted at all by this layer. Assert the reader is called exactly once and with the Claude Code config path.
  - Test E (resolved-origin row): with `mockBrainUrl` returning a Theo origin and `mockTheoHealth` returning `{mode:'ok', build_stamp:{sha:'abc1234'}}` -> L0 payload carries `resolved_origin`, `is_theo === true`, `override === false`, `theo_health.mode === 'ok'`, `theo_health.build_sha === 'abc1234'`; and the human reason string names the origin.
  - Test F (origin row degrades honestly): `mockTheoHealth` rejecting -> L0 still returns, `payload.theo_health` absent, no throw, and the presence or absence of theo_health NEVER changes `ok`.
  - Test G (non-Theo origin): `mockBrainUrl` returning `https://pws-brain-mcp.onrender.com` with `MINDRIAN_BRAIN_URL` set -> `is_theo === false`, `override === true`, reported not-ok-or-ok per the shadow verdict only (the origin half is information, the shadow half is the verdict).
  - Test H (no short circuit): shadow present AND every L1-L6 mock passing -> `result.layers.length === 7`, `layers[0].id === 'origin_shadow'`, `layers[0].ok === false`, and layers 1 through 6 all `ok === true` with NO `skipped-prior-layer-failed` anywhere. This is the arm that proves L0 is information-bearing.
  - Test I (floor): `THEO_NODE_FLOOR` exported and `=== 27000`; a Theo-origin `mockStats` returning `{nodes: 26999}` fails L6 with a reason naming both the count and the floor; `{nodes: 27951}` passes. `CANON_NODE_FLOOR` still `29000` for a non-Theo origin (the rollback property from 339-12 must not regress).
  </behavior>

  <action>
Implement in three moves.

**Move 1, `lib/core/integration-registry.cjs` (Canon Part 7, extend the existing reader, do NOT mint a third one).** Extract the single `fs.readFileSync` + `JSON.parse` site out of `parseMcpConfig` into a private `_readJsonConfig(configPath)` returning the parsed object or `null` on any failure. Rewrite `parseMcpConfig` to delegate to it so its behavior and return shape are byte-unchanged. Add a new exported `readScopedMcpServers(opts)` built on the SAME `_readJsonConfig`, where `opts` is `{ configPath, projectDir }` and `configPath` defaults to `path.join(os.homedir(), '.claude.json')`, `projectDir` to `process.cwd()`. It returns a flat array of `{ name, scope, url_host, type }`, walking top-level `mcpServers` as `scope: 'user'` and `projects[projectDir].mcpServers` as `scope: 'local'`. `url_host` is derived with `new URL(entry.url).host` inside a try/catch (null when there is no url or it does not parse). The projection is the security control: it NEVER copies `headers`, NEVER copies the full `url`, and NEVER copies `env`, so no caller can leak a secret even by accident. Say that in the docblock, and name Canon Part 8. Export `parseMcpConfig` alongside `readScopedMcpServers` so the class M layer requires a named function rather than reaching into the module.

**Move 2, `lib/core/doctor/class-m-brain-smoke.cjs`.** Prepend `{ id: 'origin_shadow', name: 'L0 origin and shadow connector' }` to `LAYERS` and `_layer0` to the `layerFns` array in `checkBrainSmoke`. In the cascade loop, L0 is the one layer whose `ok === false` sets `out.ok = false` but does NOT set `prevOk = false`: gate the `prevOk` assignment on `i > 0` and write a comment saying why (the in-process probe through brain-client is still valid and still worth running, so the report must carry BOTH the shadow finding and the six layers' verdicts; a short circuit here would trade one blind spot for another).

`_layer0(opts)` does three things in one row.

(a) Shadow scan. Resolve the reader as `opts.mockScopedServers || require('../integration-registry.cjs').readScopedMcpServers`, call it with `{ configPath: opts.claudeConfigPath, projectDir: opts.projectDir }` (both undefined in production, which lets the defaults take over, and both injected in tests). Filter for `name === 'mindrian-brain'`. For each hit, build a not-ok reason line of the form: `` shadowing Claude Code MCP entry `mindrian-brain` at <scope> scope (host=<url_host>) shadows the plugin's own stdio shim; the plugin provides this server, so remove the duplicate: `claude mcp remove mindrian-brain -s <scope>` ``. Add one sentence of Tri-Polar scoping to the report text: this check reads Claude Code's `~/.claude.json` only, and Claude Desktop and Cowork keep the `mindrian-brain` connector by design (`docs/339-NOTE-theo-desktop-connector-key.md`), so a Desktop config is never read and never flagged.

(b) Resolved-origin row, always reported whether or not a shadow was found. Read `opts.mockBrainUrl || (() => require('../brain-client.cjs').getBrainUrl())`; compute `is_theo` via the already-imported `THEO_ORIGINS`; compute `override` from `process.env.MINDRIAN_BRAIN_URL` exactly as `_layer6` already does.

(c) theo_health, best effort, mirroring the GraphRagMeta stamp discipline in `_layer6`: `opts.mockTheoHealth || (async () => require('../brain-client.cjs').callTool('theo_health', {}))`, wrapped in try/catch, degrading silently to no health data. It NEVER changes the verdict. When it answers, project only `{ mode, build_sha: health.build_stamp && health.build_stamp.sha }`. Do NOT copy `instanceUri` or the whole health object.

Verdict rule: `ok` is false if and only if at least one `mindrian-brain` shadow entry was found. The origin and health halves are information. Payload: `{ resolved_origin, is_theo, override, shadows: [{ name, scope, url_host }], theo_health? }`.

Then move `THEO_NODE_FLOOR` from `1000` to `27000` and rewrite its docblock paragraph. The old prose argued a tight number would be stale within days because Theo's canon was growing from 712 to 1,253 nodes. That argument expired: measured live on 2026-09-11 Theo holds 27,951 nodes, so 27,000 is a 3.4 percent margin below the measured floor, and the incumbent ran 29,000 against roughly 29,200, about 1 percent. State that a floor which passes a 96 percent content loss is not a floor. Do not touch `CANON_NODE_FLOOR`, `CANON_BRAIN_URL`, or `STALE_REPLICA_NODE_COUNT`. Add `THEO_NODE_FLOOR` and `CANON_NODE_FLOOR` to `module.exports` so the floor is assertable without re-typing the number in a test.

Do NOT add any origin URL literal to this file beyond the existing `CANON_BRAIN_URL`: `tests/test-339-origin-single-source.cjs` allowlists exactly two files and this check keys on the server NAME `mindrian-brain`, never on a host string. The suspended `mindrian-brain.onrender.com` host is data read from the user's config, never a constant in source.

**Move 3, `scripts/doctor.cjs`.** In `classMBrainSmoke`'s human renderer, the `if (layer.payload)` block currently assumes the L6 shape and would print `endpoint=undefined node_count=undefined canon=undefined` for the new layer. Branch on `layer.id`: keep the existing `store_identity` rendering byte-identical, and add an `origin_shadow` branch printing `origin=<resolved_origin> theo=<is_theo>` plus `override=true` when set, `theo_health mode=<mode> sha=<build_sha>` when present, and one indented line per shadow entry carrying scope, host, and the fix command. First confirm (do not assume) that `scripts/doctor.cjs:1587-1600`'s acceptance gate finds layers by id and name rather than by index, so the prepend cannot move a release gate underneath itself.

Then update `tests/test-127-02-doctor-class-m.sh`: T2 asserts `j.layers.length !== 6`, which the prepend breaks. Change it to 7 AND add an assertion that `j.layers[0].id === 'origin_shadow'` so the count is pinned to a named layer rather than to a bare number. T4's index-based cascade assertions all shift by one: `j.layers[1]` is now L1, `j.layers[2]` is L2, and layers 3 through 6 are the skipped ones; also assert `j.layers[0].ok === true` in that hermetic-HOME run, since a temp HOME carries no `~/.claude.json` and therefore no shadow.

Finally, verify rather than edit `data/doctor-modules.json`: class M is special-cased in `scripts/doctor.cjs`, it is NOT a registry module (grep confirms no `brain-smoke` and no `class-m` entry). If that holds, this file needs no change and `introduced_version: 2.0.0-beta.34` has nothing to attach to. Record that finding in the SUMMARY rather than inventing an entry, because `release.sh` Step 6.6a verifies every registered runner exists.
  </action>

  <verify>
    <automated>node lib/core/doctor/class-m-brain-smoke.test.cjs</automated>
    <automated>bash tests/test-127-02-doctor-class-m.sh</automated>
    <automated>node -e "const m=require('./lib/core/doctor/class-m-brain-smoke.cjs'); if(m.THEO_NODE_FLOOR!==27000) throw new Error('floor='+m.THEO_NODE_FLOOR); if(m.CANON_NODE_FLOOR!==29000) throw new Error('canon floor regressed'); if(m.LAYERS.length!==7||m.LAYERS[0].id!=='origin_shadow') throw new Error('layer 0 wrong'); console.log('OK')"</automated>
    <automated>node -e "const r=require('./lib/core/integration-registry.cjs'); if(typeof r.readScopedMcpServers!=='function') throw new Error('not exported'); const out=r.readScopedMcpServers({}); const bad=out.filter(e=>'headers' in e||'url' in e||'env' in e); if(bad.length) throw new Error('projection leaks: '+JSON.stringify(Object.keys(bad[0]))); console.log('OK '+out.length+' entries')"</automated>
    <automated>node scripts/doctor.cjs --brain-smoke --json > /tmp/claude-1000/-home-jsagi/383b3887-faba-443b-be72-b84ea781d872/scratchpad/axz-smoke.json; node -e "const j=require('/tmp/claude-1000/-home-jsagi/383b3887-faba-443b-be72-b84ea781d872/scratchpad/axz-smoke.json'); if(j.layers.length!==7) throw new Error('layers='+j.layers.length); const s=JSON.stringify(j); if(/Authorization|Bearer /.test(s)) throw new Error('HEADER LEAK IN DOCTOR OUTPUT'); console.log('OK', j.layers[0].id, j.layers[0].ok)"</automated>
    <automated>grep -vE '^\s*(//|\*|/\*)' lib/core/doctor/class-m-brain-smoke.cjs | grep -c 'Authorization\|headers\[' | grep -qx 0 &amp;&amp; echo "OK no header access in code"</automated>
    <automated>node tests/test-339-origin-single-source.cjs</automated>
    <automated>node -e "const ids=require('./data/doctor-modules.json').modules.map(m=>m.id); console.log('class M registered:', ids.includes('brain-smoke')||ids.includes('class-m'))"</automated>
    <automated>grep -c $'\xe2\x80\x94' lib/core/doctor/class-m-brain-smoke.cjs lib/core/integration-registry.cjs lib/core/doctor/class-m-brain-smoke.test.cjs scripts/doctor.cjs tests/test-127-02-doctor-class-m.sh | grep -v ':0$' &amp;&amp; exit 1 || echo "OK no em-dashes"</automated>
  </verify>

  <done>
`node scripts/doctor.cjs --brain-smoke` prints 7 layers with `L0 origin and shadow connector` first, reporting the resolved origin, whether it is Theo, whether MINDRIAN_BRAIN_URL overrode it, and Theo's mode plus build sha. Against a fixture carrying a user-scope or local-scope `mindrian-brain` entry it reports not-ok with the scope, the host only, the sentence that the plugin provides this server, and the exact `claude mcp remove mindrian-brain -s <scope>` line, while layers 1 through 6 still run and still report their own verdicts. No Authorization or other header value appears anywhere in the output or in the code path. `THEO_NODE_FLOOR` is 27000 with a docblock that explains the 3.4 percent margin against the 27,951 measured 2026-09-11; `CANON_NODE_FLOOR` is still 29000 for a rolled-back origin. All three test entry points are green and `tests/test-339-origin-single-source.cjs` still reports its two-entry allowlist. Zero em-dashes in every touched file.
  </done>
</task>

<task type="auto">
  <name>Task 2: The three documents that still tell a reader the wrong thing, plus SEED-082</name>
  <files>docs/339-NOTE-theo-desktop-connector-key.md, .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-12-SUMMARY.md, .planning/seeds/SEED-082-bidirectional-command-framework-sync-drift-detection.md, CHANGELOG.md, commands/doctor.md</files>

  <action>
No code in this task. Four documents and one command-doc line.

**`docs/339-NOTE-theo-desktop-connector-key.md`.** Add a new numbered section, `## 9. Claude Code: do NOT add a user-level mindrian-brain server (2026-09-11)`, placed after Section 8 so the file stays a dated append log rather than a rewritten record. Section 1's advice stays exactly as written, and the new section says plainly that it SCOPES Section 1 rather than reversing it: the keep-the-name, point-at-`/mcp`, send-no-Authorization prescription is for Claude Desktop and Cowork only, because those surfaces have no plugin shim to collide with. In Claude Code the plugin already provides `mindrian-brain` through its own `.mcp.json` stdio shim, so a user-level twin of the same name shadows it. State the observation: on 2026-09-11 a beta.33 install ran Larry at Tier 0 for an entire session because a user-scope `~/.claude.json` entry named `mindrian-brain` (type http, stale Authorization header) pointed at `https://mindrian-brain.onrender.com/mcp`, which returns HTTP 503 from Render's "Service Suspended" page. Give the fix line: `claude mcp remove mindrian-brain -s user` (and `-s local` for the `projects[]` variant). State why the fix is removal and not a URL swap, in one sentence a reader can act on: a raw HTTP connector reaches Theo directly and therefore bypasses `lib/core/brain-client.cjs`, losing the beta.33 `brain_ask` composition (framework directive, ranked chain with `/mos:` commands, grounding rows), so repointing the twin at Theo would fix the 503 and still leave the user with a thinner Larry. Close by naming the new backstop: class M layer 0 now detects this case and prints the fix line.

**`339-12-SUMMARY.md`.** APPEND ONLY. Do not edit line 92 or line 74 or any other existing sentence: this file is a historical record of what was true on 2026-09-03. Add a final section, `## Dated note, 2026-09-11: the documented rollback lever is dead`, stating that the entry recorded at line 92 (one-line rollback via `MINDRIAN_BRAIN_URL` or reverting line 24, "both valid only while the incumbent runs") has expired exactly as its own qualifier anticipated. Give both halves of the evidence: `https://mindrian-brain.onrender.com/mcp` returns HTTP 503 (Render "Service Suspended"), and `https://pws-brain-mcp.onrender.com/mcp` is still alive but answers 401 without a key and is no longer a valid rollback target regardless, because the beta.33 `brain_ask` composition (quick task 260910-hni) is written against Theo's response shape. Note that the per-origin `CANON_NODE_FLOOR = 29000` fallback in `class-m-brain-smoke.cjs` stays in place as a mechanism even though no origin can exercise it today, since removing it would be a second edit for no gain.

**`.planning/seeds/SEED-082-...md`.** Frontmatter: `status: dormant` -> `status: triggered`; add `triggered_at: 2026-09-11`; add a `trigger_evidence:` key carrying all FOUR facts of the same gap, because any one alone understates it. Fact one, version skew: Theo answers from `command-registry@2.0.0-beta.12` while the plugin ships `2.0.0-beta.33`, 21 betas of drift, and this repo's existing `scripts/build-command-registry.cjs --check` pre-commit tripwire covers the LOCAL registry against local `commands/*.md` only, so it is structurally incapable of seeing this. Fact two, the never-projected layer: Theo's Sensor layer has never been populated at all, 0 Sensor nodes graph-wide and 0 MindrianCommand->Sensor edges, while the Reach half of the same projection DID land (84 `WIRED_TO` -> Reach edges) - proof the sync ran and silently carried only part of the payload rather than never running. Fact three, the framework layer is a sync gap with a ready source, not an authoring gap, and the gap is SMALL rather than total: `data/command-registry.json` in THIS repo holds 113 commands, of which 49 carry a non-empty `frameworks` array and 64 carry `frameworks: []`. Those 49 are 49 of the 50 `kind: methodology` commands (for example `/mos:leadership` -> `["Adaptive Leadership"]`); every `utility` (57), `meta` (4) and `mechanical` (2) command declares none, correctly, since they front no framework. The 49 name 28 distinct frameworks. Theo carries 42 `USES_FRAMEWORK` edges across 40 commands. So the sync gap is 9 methodology commands plus alias resolution across those 28 names, NOT 71 missing links: state it that way, because "all 113 commands declare frameworks" is false and would send a future reader looking for a projection bug that does not exist. Fact four, the Sensor layer has never been SYNCED, not never been DECLARED: Theo's graph holds 0 Sensor nodes, while `data/connector-registry.json` at v2.0.0-beta.33 already carries a top-level `sensor_index` of 14 `SENS-*` ids (SENS-01 through SENS-09, SENS-13, SENS-14, SENS-15, SENS-17, SENS-SHOW) and `sensor_triggers` arrays on 72 of its 209 connector entries. The source for a Sensor projection therefore already exists and is already generated, by `scripts/build-connector-registry.cjs` from `commands/*.md` frontmatter. Record the one distinction that script's own comment (`~:1084-1097`) insists on, because whoever writes the sync payload has to decide it: `sensor_index` is the CLAIM side (which commands claim a sensor, derived from frontmatter, and it deliberately omits SENS-10, SENS-11, SENS-12 and SENS-16 and can name ids with no implementation behind them), while `lib/core/insight-sensors.cjs`'s `SENSOR_REGISTRY` is the EXISTENCE side (the runtime reach functions). That script states the two sides are ALLOWED to differ. So the open question for a sync payload is which side Theo's Sensor nodes should represent, and that is a design question to be recorded, not a prerequisite task to be filed. Include the full MindrianCommand outgoing census as the supporting numbers (`PART_OF`->Root 113, `WIRED_TO`->Reach 84, `USES_FRAMEWORK`->Framework 38 plus 4 to dual-labelled Framework|Technique, `NEXT_IN_RECIPE` 9, `FEEDS_INTO` 2, Sensor 0), and record the disposition that Theo's `command_neighborhood` correctly references the declared `declaration_side` property (`resolver-config.yaml:254`, SENSE-03) and its `UnknownPropertyKeyWarning` fires only because no writer has ever set it - registry-sync territory, not a Theo query bug. Do not rewrite the seed body's 2026-08-25 analysis; if you add prose, add it as a dated `## Trigger fired, 2026-09-11` section at the end, and in that section record the claim-side-versus-existence-side question from Fact four as the open design question any sync payload must answer first. Do NOT write that a plugin-side projection is a missing prerequisite: the registry already carries the sensor data. Record one adjacent follow-up in the same section, explicitly marked OUT OF SCOPE for this quick task so nobody acts on it here: `lib/mcp/brain-router.cjs` Tier 3 runs a 2000 ms hard `Promise.race` at `:460`, and a cold Theo on Render loses that race silently, so a session-start pre-warm plus a raised bound is a separate item.

**`CHANGELOG.md`.** Fill the empty `### Added` bullet under `## [Unreleased] -- v2.0.0-beta.34 (in progress)` and add a `### Changed` and `### Fixed` group as the content requires. Cover, in reader-facing terms: class M gains layer 0 (origin and shadow connector) reporting the resolved origin, Theo-origin status, MINDRIAN_BRAIN_URL override, Theo mode and build sha, and any shadowing user-scope or local-scope `mindrian-brain` entry with its removal command; `THEO_NODE_FLOOR` 1000 -> 27000 with the measured-27,951 rationale; the census artifacts regenerated against Theo; the Desktop-connector note scoped to Desktop and Cowork with an explicit Claude Code paragraph. Name the user-visible symptom the layer 0 work closes, since that is what a reader recognizes: an install silently running at Tier 0 because a user-level connector of the same name shadowed the plugin's shim.

**`commands/doctor.md`.** Two stale lines say class M is a "5-layer Brain probe" (it has been 6 since quick task 260819-c9b). Correct both to 7 and name the new first layer in the class M bullet at line 81.
  </action>

  <verify>
    <automated>grep -F "claude mcp remove mindrian-brain -s user" docs/339-NOTE-theo-desktop-connector-key.md</automated>
    <automated>grep -qF "## 9. Claude Code" docs/339-NOTE-theo-desktop-connector-key.md &amp;&amp; grep -qF "Desktop and Cowork" docs/339-NOTE-theo-desktop-connector-key.md &amp;&amp; grep -qF "503" docs/339-NOTE-theo-desktop-connector-key.md &amp;&amp; echo OK</automated>
    <automated>git diff -U0 -- .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-12-SUMMARY.md | grep -c '^-[^-]' | grep -qx 0 &amp;&amp; echo "OK append-only, zero lines removed"</automated>
    <automated>node -e "const fs=require('fs');const p='.planning/seeds/SEED-082-bidirectional-command-framework-sync-drift-detection.md';const t=fs.readFileSync(p,'utf8');const fm=t.split('---')[1];for(const k of ['status: triggered','triggered_at: 2026-09-11','trigger_evidence:']) if(!fm.includes(k)) throw new Error('missing '+k);for(const f of ['2.0.0-beta.12','2.0.0-beta.33','Sensor','84','command-registry.json','connector-registry.json','sensor_index','sensor_triggers','49','113','50','28','42','14','72','209']) if(!t.includes(f)) throw new Error('evidence missing '+f);if(!/0 Sensor|Sensor 0|Sensor nodes/.test(t)) throw new Error('Sensor-zero fact not stated');if(/all 113 commands|frameworks for all 113|declares ZERO sensors|zero sensors/i.test(t)) throw new Error('WITHDRAWN false claim reintroduced');if(/prerequisite/i.test(t)) throw new Error('withdrawn SENSOR_REGISTRY-prerequisite framing reintroduced');if(!/brain-router/.test(t)) throw new Error('out-of-scope Tier 3 follow-up not recorded');console.log('OK')"</automated>
    <automated>node -e "const t=require('fs').readFileSync('CHANGELOG.md','utf8').split('## [2.0.0-beta.33]')[0];for(const s of ['27000','origin','shadow','Tier 0','census']) if(!t.toLowerCase().includes(s.toLowerCase())) throw new Error('Unreleased missing: '+s);if(/### Added\n\n?- \n/.test(t)) throw new Error('empty Added bullet still present');console.log('OK')"</automated>
    <automated>grep -c "5-layer" commands/doctor.md | grep -qx 0 &amp;&amp; grep -qF "7-layer" commands/doctor.md &amp;&amp; echo OK</automated>
    <automated>for f in docs/339-NOTE-theo-desktop-connector-key.md .planning/seeds/SEED-082-bidirectional-command-framework-sync-drift-detection.md commands/doctor.md; do c=$(grep -c $'\xe2\x80\x94' "$f" || true); echo "$f em-dashes=$c"; test "$c" -eq 0; done</automated>
  </verify>

  <done>
`docs/339-NOTE-theo-desktop-connector-key.md` carries a Section 9 that scopes the keep-the-name advice to Claude Desktop and Cowork, records the 2026-09-11 Tier 0 observation and the 503, gives both removal commands, and explains why removal and not a URL swap. `339-12-SUMMARY.md` gained a dated dead-lever note with zero lines removed (`git diff` proves append-only). SEED-082 reads `status: triggered`, `triggered_at: 2026-09-11`, and a `trigger_evidence:` that carries all four facts of the same gap: the 21-beta registry skew, the zero-Sensor / 84-Reach projection gap with its supporting census, the framework sync gap stated correctly (49 of 113 commands declare frameworks, which is 49 of the 50 methodology commands, naming 28 distinct frameworks, against Theo's 42 edges across 40 commands, so the gap is 9 methodology commands plus alias resolution), and the Sensor finding stated correctly (Theo holds 0 Sensor nodes while `data/connector-registry.json` already declares a 14-id `sensor_index` and `sensor_triggers` on 72 of 209 entries, so the layer has never been synced rather than never been declared). No sentence claims all 113 commands declare frameworks, and no sentence claims the connector registry declares zero sensors or that a `SENSOR_REGISTRY` projection is a prerequisite. The seed body records the claim-side-versus-existence-side design question and the `brain-router.cjs:460` Tier 3 2000 ms race as an explicitly out-of-scope follow-up. `CHANGELOG.md`'s `[Unreleased]` block has no empty bullet and names the Tier 0 symptom, the new layer, the 27000 floor, and the re-census. `commands/doctor.md` says 7-layer. Zero em-dashes in every touched file.
  </done>
</task>

<task type="auto">
  <name>Task 3: The census learns Theo's shape, and the artifacts stop describing a retired graph</name>
  <files>scripts/build-brain-census.cjs, data/brain-census.generated.json, docs/BRAIN-GRAPH-CENSUS.generated.md</files>

  <action>
**Before you change anything**, capture the incumbent-lane baseline so byte-compatibility is provable rather than argued: run `node scripts/build-brain-census.cjs --render-only` on the CURRENT incumbent JSON and confirm `git status --porcelain docs/BRAIN-GRAPH-CENSUS.generated.md data/brain-census.generated.json` is empty. That is your control. You will repeat it after the code change, before the live run.

**The refusal this works around.** `CENSUS_QUERIES` C5 is `MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS c ...` (`scripts/build-brain-census.cjs:156`). Theo's read allow-list rejects it because the plan is an AllNodesScan. `_runLaneB` also THROWS outright when C1 fails, so a single Theo refusal today aborts the whole lane instead of degrading. Both get fixed by ADDING a Theo lane, never by editing the incumbent lane's queries: `tests/test-246-census-guard.cjs` pins all 13 query ids and asserts each cypher string classifies `allow` under the Part 8 egress guard, so removing or rewording a query reddens that test for the wrong reason.

**Shape detection.** Add a small predicate, `_isTheoStatsShape(stats)`, true when `stats` is an object with a finite `nodes` number and an array `labels`, and no `totalRecordCount`. This is the same dual-shape discipline `_layer6` in `class-m-brain-smoke.cjs` already uses: recognize the incumbent's key first, so the incumbent path cannot change.

**`_runLaneBTheo(key, brainStats)`.** Selected by `main()`'s `--lane-b` branch when a `brain_stats` call returns the Theo shape; otherwise `_runLaneB` runs exactly as today. It:
  - derives the C5-equivalent label census from `brainStats.labels` (`[{label, count}]` -> the renderer's `{label, c}` rows), and records that this is a per-label count from `brain_stats`, not an UNWIND over all nodes;
  - calls `brain_schema` and stores its Theo shape (`labels`, `relationship_types`, `property_keys`) as the C6-equivalent, recording honestly that Theo reports relationship TYPE NAMES without per-type counts, so the C6 count column is `n/a` rather than fabricated or silently zero;
  - takes the C1 Framework total from the `Framework` entry in `brainStats.labels` (expected 452), not from a Cypher count;
  - still ATTEMPTS C2, C2a-d, C3, C4, C7, C8, C9 through `brainCall('brain_query', ...)`, and on any failure records `{ refused: true, error: <bodyText> }` for that id instead of throwing, so a refusal is visible in the artifact as a refusal;
  - returns `{ results, usedFallback: false, theo_shape: true }`.

Set `census.lane_b.theo_shape = true`, `lane_b_source: 'theo-live brain_stats + brain_schema (whole-graph Cypher refused by Theo read allow-list)'`, and `drift_caveat: false`.

**`renderMarkdown` gets two additive branches, both gated so the incumbent path is untouched.** In Census Meta, when `meta.brain_stats` carries the Theo shape, print `brain_stats nodes`, `brain_stats relationships`, and `brain_stats labels` (the array length) instead of the incumbent's backend / totalRecordCount / relationshipCount / vectorIndexes rows; leave the incumbent rows exactly as they are for incumbent data. In Lane B, when `laneB.theo_shape` is true, render the label census with a heading that names `brain_stats` as its source (the incumbent's "nodes carry up to 6 labels, so counts sum to MORE than the node count" caveat does not apply and must not be copied), render relationship types from `brain_schema.relationship_types` as a names list, add a short `property_keys` count line, and render each refused query id with its refusal rather than as a blank section. The generated document must NAME the origin and the run date in prose near the top, not only in the meta table, so a reader who lands mid-file cannot mistake it for the incumbent census.

**Regenerate against live Theo** (a Brain origin is reachable on this machine): `node scripts/build-brain-census.cjs --lane-a` then `node scripts/build-brain-census.cjs --lane-b`. Both write `data/brain-census.generated.json` and `docs/BRAIN-GRAPH-CENSUS.generated.md`. Expect `census_date` 2026-09-11, `brain_url` `https://theo-mcp.onrender.com`, 27,951 nodes, 39,732 relationships, 452 Framework.

**Cold start, one retry.** Theo runs on Render and sleeps. If the first `--lane-a` invocation fails to reach the origin at all (fetch failure, timeout, or a 502/503 from the edge), wait 30 seconds and retry ONCE. Only after that second failure conclude Theo is unreachable, and then stop and report rather than writing a partial artifact. Do not loop beyond one retry: a second failure after a warm-up window is a real outage, not a cold start.

**If the live counts differ from 27,951 / 39,732 / 452**, that is a FINDING, not a value to reconcile. Record the live numbers and the delta against the 2026-09-11 measurement in the SUMMARY, and surface it to the user. Never edit the expected values in this plan or in the verify arms to match what came back, and never hand-edit the generated artifacts: the generated files record whatever Theo actually said, and the plan records what it said earlier, and the difference between the two is the information. A number that moved may mean the graph grew, or it may mean the wire is pointed somewhere unexpected, and only a human looking at the delta can tell which.

Lane A's framework probe loop will run 3 tools per framework against Theo and some will answer thinner than the incumbent did. That is the honest re-census, not a failure; `computeGapTable` is expected to produce a different gap list and that is the point.
  </action>

  <verify>
    <automated>node scripts/build-brain-census.cjs --render-only &amp;&amp; git status --porcelain docs/BRAIN-GRAPH-CENSUS.generated.md data/brain-census.generated.json | grep -qx '' || echo "INCUMBENT RENDER DRIFT - investigate before the live run"</automated>
    <automated>node tests/test-246-census-render.cjs</automated>
    <automated>node tests/test-246-census-guard.cjs</automated>
    <automated>node tests/test-262-floor-denominator.cjs</automated>
    <automated>node tests/test-262-unrecognized-shape-voids.cjs</automated>
    <automated>node -e "const j=require('./data/brain-census.generated.json'); const s=j.meta.brain_stats||{}; const fw=(s.labels||[]).find(l=>l.label==='Framework'); console.log('LIVE: url='+j.meta.brain_url+' date='+j.meta.census_date+' nodes='+s.nodes+' relationships='+s.relationships+' Framework='+(fw&&fw.count)+' theo_shape='+(j.lane_b&&j.lane_b.theo_shape)); if(j.meta.brain_url!=='https://theo-mcp.onrender.com') throw new Error('brain_url='+j.meta.brain_url); if(String(j.meta.census_date).slice(0,10)!=='2026-09-11') throw new Error('census_date='+j.meta.census_date); if(!j.lane_b||!j.lane_b.theo_shape) throw new Error('lane_b not theo_shape'); const d=[]; if(s.nodes!==27951) d.push('nodes '+s.nodes+' vs 27951'); if(s.relationships!==39732) d.push('relationships '+s.relationships+' vs 39732'); if(!fw||fw.count!==452) d.push('Framework '+(fw&&fw.count)+' vs 452'); if(d.length) throw new Error('DELTA against the 2026-09-11 measurement, record in SUMMARY and report, do NOT edit expected values: '+d.join('; ')); console.log('OK')"</automated>
    <automated>for t in theo-mcp.onrender.com 2026-09-11 27,951 39,732 452; do grep -qF "$t" docs/BRAIN-GRAPH-CENSUS.generated.md || grep -qF "$(echo $t | tr -d ,)" docs/BRAIN-GRAPH-CENSUS.generated.md || { echo "MISSING: $t"; exit 1; }; done; echo OK</automated>
    <automated>grep -c $'\xe2\x80\x94' docs/BRAIN-GRAPH-CENSUS.generated.md scripts/build-brain-census.cjs | grep -v ':0$' &amp;&amp; exit 1 || echo "OK no em-dashes"</automated>
    <automated>node tests/test-339-origin-single-source.cjs</automated>
  </verify>

  <done>
`scripts/build-brain-census.cjs` carries a Theo lane selected by `brain_stats` shape, sourcing the label census from `brain_stats.labels` and the relationship-type and property-key census from `brain_schema`, attempting the remaining Cypher queries and recording each refusal honestly instead of throwing. The incumbent lane is byte-compatible, proven by a `--render-only` run against the pre-existing incumbent JSON producing zero diff, and by `tests/test-246-census-render.cjs` and `tests/test-246-census-guard.cjs` staying green with all 13 query ids intact. `data/brain-census.generated.json` and `docs/BRAIN-GRAPH-CENSUS.generated.md` describe Theo at `https://theo-mcp.onrender.com` as of 2026-09-11, the origin and run date named in the document's own prose. The live counts are 27,951 nodes, 39,732 relationships, and 452 Framework nodes, OR the verify arm has printed the live numbers and the SUMMARY records the delta and reports it, with the expected values and the generated artifacts both left unedited. A first-attempt cold-start failure was retried once after 30 seconds before any unreachable conclusion. Zero em-dashes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `~/.claude.json` -> doctor output | A user config file holding live Bearer tokens for every MCP server the user has ever registered is read by a diagnostic whose output gets pasted into bug reports, issues, and chat |
| plugin -> Theo (`theo_health`) | A live Brain call whose response carries `instanceUri` and other operator metadata |
| generated census artifacts -> git | Whole-graph metadata is committed to a repo |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-axz-01 | Information Disclosure | `readScopedMcpServers` -> `_layer0` reason and payload | mitigate | The projection in `lib/core/integration-registry.cjs` never copies `headers`, `url`, or `env`; it returns `url_host` derived via `new URL().host`. Structural, not disciplinary: the caller cannot leak what it is never handed. Asserted by a test arm that plants `Bearer sk-SHOULD-NEVER-APPEAR` in the fixture and greps the whole serialized result, plus a live `--brain-smoke --json` grep for `Authorization|Bearer `. Canon Part 8. |
| T-axz-02 | Information Disclosure | `theo_health` response projection | mitigate | Project only `{ mode, build_sha }`; `instanceUri`, `quarantineCode`, and `serverAgent` are never copied into the payload. |
| T-axz-03 | Tampering | Prepending a layer under a release gate | mitigate | `scripts/doctor.cjs:1587-1600` finds layers by id (`store_identity`) and name (`L4 MCP stdio handshake`), never by index; Task 1 requires confirming this before the prepend and the shell harness pins `layers[0].id === 'origin_shadow'` so the count assertion is tied to a name. |
| T-axz-04 | Denial of Service | L0 short-circuiting the cascade | mitigate | L0 sets `out.ok=false` but never `prevOk=false` (gated on `i > 0`); Test H asserts all six downstream layers still run and report with no `skipped-prior-layer-failed`. A shadow must never blind the probe it is warning about. |
| T-axz-05 | Spoofing | False positive against a Desktop or Cowork connector, or against the plugin's own shim | mitigate | The reader consults `~/.claude.json` only (Claude Code's config), never `claude_desktop_config.json` and never any `.mcp.json`. The `project` scope, which is where the plugin's shim lives, is structurally out of scope. Test D asserts the reader is called exactly once with the Claude Code path. |
| T-axz-06 | Information Disclosure | Census artifacts committed to git | accept | Brain graph metadata (label names and counts, relationship type names) is already committed in the incumbent artifacts and is generic methodology structure, not user content. Canon Part 8 is about LOCAL -> BRAIN egress, which this is not. |
| T-axz-SC | Tampering | npm/pip/cargo installs | n/a | This plan installs no packages. No `## Package Legitimacy Audit` is required and none is consumed. |
</threat_model>

<verification>
Run in this order after all three tasks land.

1. `node lib/core/doctor/class-m-brain-smoke.test.cjs` and `bash tests/test-127-02-doctor-class-m.sh` both green.
2. `node scripts/doctor.cjs --brain-smoke --json` prints 7 layers, `origin_shadow` first, and contains no `Authorization` or `Bearer ` token.
3. `node tests/test-246-census-render.cjs`, `node tests/test-246-census-guard.cjs`, `node tests/test-262-floor-denominator.cjs`, `node tests/test-262-unrecognized-shape-voids.cjs`, `node tests/test-339-origin-single-source.cjs` all green.
4. `node scripts/doctor.cjs --acceptance` does not regress: the activation-reached-the-wire gate still finds `store_identity` and the L4 handshake. Compare against the pre-change result and report any delta rather than absorbing it.
5. Repo-wide em-dash scan of the touched set only (CHANGELOG.md carries 107 pre-existing em-dashes in historical entries, documented by plan 339-10; scan the NEW content, not the whole file).
6. `git status --porcelain` at commit time lists exactly the files in `files_modified` and nothing else. `lib/core/brain-client.cjs`, `hooks/hooks.json`, the alias tables, and the 260910-hni composition are explicitly out of scope and must show zero diff.
</verification>

<success_criteria>
- Doctor can see the failure mode that put a beta.33 install at Tier 0: a shadowing user-scope or local-scope `mindrian-brain` entry produces a not-ok row with the scope, the host, and a working removal command, and layers 1 through 6 still report independently.
- Doctor answers "which origin am I on and is it alive" in one row: resolved origin, Theo-origin status, override flag, Theo mode and build sha.
- `THEO_NODE_FLOOR` is 27000, a 3.4 percent margin under the 27,951 measured 2026-09-11, and the docblock says so.
- No header value of any kind can reach doctor output, enforced structurally by the reader's projection and asserted by a planted-secret test arm.
- The Desktop connector note scopes its own advice to Desktop and Cowork and gives Claude Code the opposite instruction with the reason.
- 339-12-SUMMARY.md records the dead rollback lever without one line of its history being rewritten.
- SEED-082 is triggered and dated, carrying both the 21-beta registry skew and the zero-Sensor projection gap.
- The census artifacts describe Theo as of 2026-09-11 with the three measured numbers, and the incumbent lane still renders byte-identically.
- Nothing outside `files_modified` moved.
</success_criteria>

<output>
Create `.planning/quick/260911-axz-theo-qa-memo-follow-ups-doctor-detects-a/260911-axz-SUMMARY.md` when done.

Commit per task, message body ending with exactly:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HBgMttGjUp3zcYdCJkn3Zv
```
</output>
