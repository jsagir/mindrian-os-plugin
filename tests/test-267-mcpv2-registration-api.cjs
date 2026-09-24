#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 06 (MCPV2-02, MCPV2-08) -- the wire-and-source registration-
 * API assertion.
 * ==========================================================================
 * This is the RED-before-migration / GREEN-after-migration gate every
 * registration-rewrite commit in 267-06..267-09 (and 267-11's final swap)
 * runs before it lands.
 *
 * Two modes:
 *
 *   --file <relpath>   Drives ONLY the named registrar module's own
 *                       registration function against a recording fake
 *                       server, then checks every call ATTRIBUTED to that
 *                       file (via stack-frame inspection, so a cascade
 *                       through another registrar -- e.g. tool-router.cjs
 *                       calling registerCoreTools() which registers
 *                       contract_version and every tools/*.cjs module on the
 *                       SAME fake server -- never pollutes this file's own
 *                       verdict). This is the per-commit gate.
 *
 *   (no --file)         Full mode: runs every known registrar module through
 *                       its own dedicated recorder pass (same per-file
 *                       checks as --file, run once per registrar), THEN
 *                       spawns the real local server and diffs a live
 *                       wireSnapshot() against tests/fixtures/267/
 *                       wire-snapshot-zod4.json's tool count, asserting
 *                       every live tool carries a non-empty title. Full mode
 *                       stays RED until 267-09 migrates the last local-
 *                       server registrar (documented, expected).
 *
 * Recorder contract (drives every registrar through a fake `server` object,
 * never a real @modelcontextprotocol/* instance -- this file requires no
 * @modelcontextprotocol/* package directly):
 *   - server.tool(name, desc, shape, cb)         -> recorded 'v1-variadic'
 *   - server.prompt(name, ...)                   -> recorded 'v1-variadic'
 *   - server.resource(name, ...)                 -> recorded 'v1-variadic'
 *   - server.registerTool(name, config, cb)       -> recorded 'v2-config'
 *   - server.registerPrompt(name, config, cb)     -> recorded 'v2-config'
 *   - server.registerResource(name, uri, cfg, cb) -> recorded 'v2-config'
 *
 * A v1-variadic call always FAILS (removed in v2). A v2-config call is
 * checked per its registrar kind:
 *   - registerTool: non-empty title, non-empty description, an inputSchema
 *     that exposes a callable safeParse (proves it is a zod object, e.g.
 *     z.object({...}), not a raw ZodRawShape -- the whole point of the
 *     267-06..267-08 rewrite rule).
 *   - registerPrompt: non-empty description.
 *   - registerResource: a config object as the third argument.
 *
 * Attribution: every recorded call captures new Error().stack and is
 * attributed to the FIRST stack frame whose path sits under lib/mcp/,
 * skipping node_modules frames -- so ext-apps' registerAppTool (a thin
 * duck-typed wrapper that calls server.registerTool(...) from inside
 * node_modules/@modelcontextprotocol/ext-apps/...) attributes to its
 * CALLER, lib/mcp/app-views.cjs, not to the ext-apps package.
 *
 * No em-dashes anywhere (hyphens only). CJS, Node built-ins + in-repo
 * modules only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LIB_MCP = path.join(REPO_ROOT, 'lib', 'mcp');
const TOOLS_DIR = path.join(LIB_MCP, 'tools');

let passCount = 0;
let failCount = 0;

function pass(line) {
  passCount += 1;
  console.log('PASS: ' + line);
}

function fail(line) {
  failCount += 1;
  console.log('FAIL: ' + line);
}

// ---------------------------------------------------------------------------
// makeFixtureRoom() -- a throwaway room dir on disk, synthetic, no real
// content. Registrar functions read roomDir at registration time in a few
// places (e.g. tool-router.cjs's own module-scope helpers); none of them
// need a fully-populated room to register their tools.
// ---------------------------------------------------------------------------
function makeFixtureRoom() {
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpv2-reg-api-rooms-'));
  const roomDir = path.join(roomsHome, 'room-267-06');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '# room-267-06\n\nFixture room for tests/test-267-mcpv2-registration-api.cjs. Synthetic, no real content.\n'
  );
  return {
    roomsHome,
    roomDir,
    cleanup() {
      try {
        fs.rmSync(roomsHome, { recursive: true, force: true });
      } catch (_e) {
        /* best effort */
      }
    },
  };
}

// ---------------------------------------------------------------------------
// attributedFile(stack) -- first stack frame under lib/mcp/, skipping
// node_modules frames and this test file's own recorder frame (which is not
// under lib/mcp/ so it is skipped naturally).
// ---------------------------------------------------------------------------
function attributedFile(stack) {
  if (!stack) return null;
  const lines = String(stack).split('\n');
  const needle = path.sep + 'lib' + path.sep + 'mcp' + path.sep;
  for (const line of lines) {
    const m = line.match(/\(([^()]+):\d+:\d+\)\s*$/) || line.match(/at\s+([^\s()]+):\d+:\d+\s*$/);
    if (!m) continue;
    const filePath = m[1];
    if (!filePath || filePath.startsWith('node:')) continue;
    if (filePath.includes('node_modules' + path.sep)) continue;
    if (!filePath.includes(needle)) continue;
    return path.resolve(filePath);
  }
  return null;
}

// ---------------------------------------------------------------------------
// createRecorder() -- the fake McpServer. Exposes both the v1 variadic
// methods (tool/prompt/resource) and the v2 config methods
// (registerTool/registerPrompt/registerResource), plus the no-op surface
// area production registrars defensively probe for
// (server.server.{getClientCapabilities,getClientVersion,elicitInput} and
// server.{sendResourceListChanged,sendToolListChanged,sendPromptListChanged,
// isConnected}), mirroring the real McpServer/Server split.
// ---------------------------------------------------------------------------
function createRecorder() {
  const calls = [];

  function recordV1(kind, name, rawArgs) {
    calls.push({ file: attributedFile(new Error().stack), wire: 'v1-variadic', kind, name, rawArgs });
  }
  function recordV2(kind, name, config, rawArgs) {
    calls.push({ file: attributedFile(new Error().stack), wire: 'v2-config', kind, name, config, rawArgs });
  }

  const fake = {
    tool(name, ...rest) {
      recordV1('tool', name, rest);
      return fake;
    },
    prompt(name, ...rest) {
      recordV1('prompt', name, rest);
      return fake;
    },
    resource(name, ...rest) {
      recordV1('resource', name, rest);
      return fake;
    },
    registerTool(name, config, cb) {
      recordV2('registerTool', name, config, [name, config, cb]);
      return fake;
    },
    registerPrompt(name, config, cb) {
      recordV2('registerPrompt', name, config, [name, config, cb]);
      return fake;
    },
    registerResource(name, uriOrTemplate, config, cb) {
      recordV2('registerResource', name, config, [name, uriOrTemplate, config, cb]);
      return fake;
    },
    sendResourceListChanged() {},
    sendToolListChanged() {},
    sendPromptListChanged() {},
    isConnected() {
      return false;
    },
    server: {
      getClientCapabilities() {
        return {};
      },
      getClientVersion() {
        return undefined;
      },
      elicitInput() {
        return Promise.resolve({ action: 'decline' });
      },
    },
  };

  return { fake, calls };
}

// ---------------------------------------------------------------------------
// evaluateCall(call) -- the behavior rules. Returns { ok, detail }.
// ---------------------------------------------------------------------------
function evaluateCall(call) {
  if (call.wire === 'v1-variadic') {
    return { ok: false, detail: 'removed in v2 (server.' + call.kind + ' form)' };
  }
  if (call.kind === 'registerTool') {
    const cfg = call.config || {};
    const titleOk = typeof cfg.title === 'string' && cfg.title.length > 0;
    const descOk = typeof cfg.description === 'string' && cfg.description.length > 0;
    const schemaOk = !!(cfg.inputSchema && typeof cfg.inputSchema.safeParse === 'function');
    return {
      ok: titleOk && descOk && schemaOk,
      detail:
        'title=' + (titleOk ? 'PASS' : 'FAIL') +
        ' description=' + (descOk ? 'PASS' : 'FAIL') +
        ' inputSchema=' + (schemaOk ? 'PASS' : 'FAIL (not a zod object / no callable safeParse)'),
    };
  }
  if (call.kind === 'registerPrompt') {
    const cfg = call.config || {};
    const descOk = typeof cfg.description === 'string' && cfg.description.length > 0;
    return { ok: descOk, detail: 'description=' + (descOk ? 'PASS' : 'FAIL') };
  }
  if (call.kind === 'registerResource') {
    const cfg = call.config;
    const cfgOk = !!(cfg && typeof cfg === 'object');
    return { ok: cfgOk, detail: 'config=' + (cfgOk ? 'PASS' : 'FAIL (no config object as 3rd argument)') };
  }
  return { ok: false, detail: 'unknown registrar kind: ' + call.kind };
}

// ---------------------------------------------------------------------------
// buildHelpers() / buildRegistrarEntries(helpers) -- the registrar map. Each
// entry drives ONLY its own file's registration function (never the whole
// server boot), per 267-06-PLAN.md Task 1's action text.
// ---------------------------------------------------------------------------
function buildHelpers() {
  const room = makeFixtureRoom();
  const pluginRoot = REPO_ROOT;
  const { loadLarryContext } = require(path.join(LIB_MCP, 'larry-context.cjs'));
  const larryContext = loadLarryContext(pluginRoot);
  const ctx = { fallbackRoomDir: room.roomDir, pluginRoot, surface: 'cli' };
  return {
    roomDir: room.roomDir,
    pluginRoot,
    larryContext,
    ctx,
    cleanup: room.cleanup,
  };
}

function buildRegistrarEntries(helpers) {
  const entries = [];

  entries.push({
    relpath: 'lib/mcp/tool-router.cjs',
    abspath: path.join(LIB_MCP, 'tool-router.cjs'),
    run(fake) {
      const { registerRouterTools } = require(path.join(LIB_MCP, 'tool-router.cjs'));
      registerRouterTools(fake, helpers.roomDir, helpers.pluginRoot, helpers.larryContext, 'cli');
    },
  });

  entries.push({
    relpath: 'lib/mcp/contract-version.cjs',
    abspath: path.join(LIB_MCP, 'contract-version.cjs'),
    run(fake) {
      const { registerContractVersion } = require(path.join(LIB_MCP, 'contract-version.cjs'));
      registerContractVersion(fake);
    },
  });

  entries.push({
    relpath: 'lib/mcp/prompts.cjs',
    abspath: path.join(LIB_MCP, 'prompts.cjs'),
    run(fake) {
      const { registerPrompts } = require(path.join(LIB_MCP, 'prompts.cjs'));
      registerPrompts(fake, helpers.roomDir, helpers.pluginRoot);
    },
  });

  entries.push({
    relpath: 'lib/mcp/resources.cjs',
    abspath: path.join(LIB_MCP, 'resources.cjs'),
    run(fake) {
      const { registerResources } = require(path.join(LIB_MCP, 'resources.cjs'));
      registerResources(fake, { fallbackRoomDir: helpers.roomDir, pluginRoot: helpers.pluginRoot, surface: 'cli' });
    },
  });

  entries.push({
    relpath: 'lib/mcp/app-views.cjs',
    abspath: path.join(LIB_MCP, 'app-views.cjs'),
    run(fake) {
      const { registerAppViews } = require(path.join(LIB_MCP, 'app-views.cjs'));
      registerAppViews(fake, helpers.roomDir);
    },
  });

  let toolFiles = [];
  try {
    toolFiles = fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.cjs')).sort();
  } catch (_e) {
    toolFiles = [];
  }
  for (const f of toolFiles) {
    entries.push({
      relpath: 'lib/mcp/tools/' + f,
      abspath: path.join(TOOLS_DIR, f),
      run(fake) {
        const mod = require(path.join(TOOLS_DIR, f));
        if (mod && typeof mod.register === 'function') {
          mod.register(fake, helpers.ctx);
        }
      },
    });
  }

  return entries;
}

function findEntryByRelpath(entries, relpath) {
  const wanted = path.resolve(REPO_ROOT, relpath);
  return entries.find((e) => e.abspath === wanted);
}

// ---------------------------------------------------------------------------
// runEntryChecks(entry) -- fresh recorder, run the entry's own registrar
// function, filter to calls attributed to that entry's own file.
// ---------------------------------------------------------------------------
function runEntryChecks(entry) {
  const { fake, calls } = createRecorder();
  try {
    entry.run(fake);
  } catch (e) {
    return { entry, error: e, attributed: [] };
  }
  const attributed = calls.filter((c) => c.file === entry.abspath);
  return { entry, error: null, attributed };
}

function reportEntry(result) {
  const { entry, error, attributed } = result;
  if (error) {
    fail(entry.relpath + ': registrar threw: ' + (error && error.message ? error.message : String(error)));
    return false;
  }
  if (attributed.length === 0) {
    fail(entry.relpath + ': zero calls attributed to this file (registrar may not have run, or a broken module dropped silently)');
    return false;
  }
  let allOk = true;
  for (const call of attributed) {
    const verdict = evaluateCall(call);
    const line = entry.relpath + ': ' + call.wire + ' ' + call.name + (verdict.detail ? ' -- ' + verdict.detail : '');
    if (verdict.ok) pass(line);
    else fail(line);
    if (!verdict.ok) allOk = false;
  }
  return allOk;
}

// ---------------------------------------------------------------------------
// --file <relpath> mode
// ---------------------------------------------------------------------------
function fileMode(relpath) {
  const helpers = buildHelpers();
  try {
    const entries = buildRegistrarEntries(helpers);
    const entry = findEntryByRelpath(entries, relpath);
    if (!entry) {
      console.error('Unknown --file target: ' + relpath);
      process.exit(2);
    }
    const result = runEntryChecks(entry);
    reportEntry(result);
  } finally {
    helpers.cleanup();
  }
  finish();
}

// ---------------------------------------------------------------------------
// full mode -- every registrar entry, then a live wireSnapshot() check.
// ---------------------------------------------------------------------------
async function fullMode() {
  const helpers = buildHelpers();
  try {
    const entries = buildRegistrarEntries(helpers);
    for (const entry of entries) {
      const result = runEntryChecks(entry);
      reportEntry(result);
    }
  } finally {
    helpers.cleanup();
  }

  console.log('');
  console.log('-- live wireSnapshot(LOCAL_SERVER) --');
  const { hermeticEnv, wireSnapshot, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');
  const { env, cleanup: liveCleanup } = hermeticEnv({});
  try {
    const snapshot = await wireSnapshot(LOCAL_SERVER, { env, capabilities: { elicitation: {} } });
    const fixturePath = path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'wire-snapshot-zod4.json');
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const expectedCount = fixture.local && Array.isArray(fixture.local.tools) ? fixture.local.tools.length : -1;
    const actualCount = Array.isArray(snapshot.tools) ? snapshot.tools.length : -1;

    if (actualCount === expectedCount) {
      pass('live tools/list count (' + actualCount + ') equals wire-snapshot-zod4.json local.tools count');
    } else {
      fail('live tools/list count (' + actualCount + ') != wire-snapshot-zod4.json local.tools count (' + expectedCount + ')');
    }

    const untitled = (snapshot.tools || []).filter((t) => !t || typeof t.title !== 'string' || t.title.length === 0);
    if (untitled.length === 0) {
      pass('every live tool has a non-empty title (' + actualCount + ' tools checked)');
    } else {
      fail(
        untitled.length + ' of ' + actualCount + ' live tool(s) missing a non-empty title: ' +
        untitled.map((t) => (t && t.name) || '<unknown>').join(', ')
      );
    }
  } catch (e) {
    fail('live wireSnapshot(LOCAL_SERVER) failed: ' + (e && e.message ? e.message : String(e)));
  } finally {
    liveCleanup();
  }

  finish();
}

function finish() {
  console.log('');
  console.log('PASS=' + passCount + ' FAIL=' + failCount);
  process.exit(failCount > 0 ? 1 : 0);
}

function main() {
  const argv = process.argv.slice(2);
  const fileIdx = argv.indexOf('--file');
  if (fileIdx !== -1 && argv[fileIdx + 1]) {
    fileMode(argv[fileIdx + 1]);
    return;
  }
  fullMode().catch((e) => {
    console.error('FATAL: ' + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  });
}

main();
