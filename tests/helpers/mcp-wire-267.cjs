'use strict';

/**
 * Phase 267 Plan 01 (MCPV2-01, MCPV2-08, MCPV2-19) -- SDK-independent MCP wire
 * helper.
 * ==========================================================================
 * Hand-rolled newline-delimited JSON-RPC over stdio, mirroring the in-repo
 * precedent at lib/core/doctor/mcp-surface-module.cjs (buildInitializeTransaction,
 * listToolsOverStdio, Canon Part 7). This module intentionally requires ZERO
 * `@modelcontextprotocol/*` package, so the SAME snapshot/compare code works
 * before the v1 -> v2 SDK migration, during it, and after 267-17 removes the
 * v1 dependency entirely (locked_stage W0 truth: "one SDK-independent wire
 * helper exists").
 *
 * Every spawned child process is force-killed with SIGKILL by the caller
 * (rpcOverStdio always resolves via a path that calls killTree). Never kill a
 * PID this module did not spawn.
 *
 * No em-dashes anywhere (hyphens only). CJS, Node built-ins only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const LOCAL_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const BRAIN_SHIM = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');

const DEFAULT_PROTOCOL_VERSION = '2025-11-25';
const DEFAULT_TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// killTree(pid) -- SIGKILL, swallow ESRCH (process already gone). Never kills
// a PID this helper did not spawn itself.
// ---------------------------------------------------------------------------
function killTree(pid) {
  if (typeof pid !== 'number') return;
  try {
    process.kill(pid, 'SIGKILL');
  } catch (e) {
    if (e && e.code !== 'ESRCH') {
      // Best-effort only: swallow every kill error, matching the documented
      // "SIGKILL, swallow ESRCH" contract. A process we cannot see/kill is
      // not this helper's problem to escalate.
    }
  }
}

// ---------------------------------------------------------------------------
// hermeticEnv(overrides) -- a fresh, network-isolated, room-isolated env for
// spawning either stdio server under test. Deletes real-Brain-reaching vars,
// points MINDRIAN_BRAIN_URL at an unreachable loopback port so no test can
// ever reach a real Brain (Canon Part 8), and gives the process its own
// throwaway HOME + rooms home with one fixture room.
// ---------------------------------------------------------------------------
function hermeticEnv(overrides) {
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_BRAIN_KEY;
  delete env.MINDRIAN_MCP_FIRST;
  delete env.MINDRIAN_MCP_DAEMON;
  delete env.CLAUDE_CODE_SESSION_ID;

  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-wire-267-home-'));
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-wire-267-rooms-'));
  const roomDir = path.join(roomsHome, 'room-267');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '# room-267\n\nFixture room for tests/helpers/mcp-wire-267.cjs. Synthetic, no real content.\n'
  );

  env.HOME = homeDir;
  env.MINDRIAN_ROOMS_HOME = roomsHome;
  env.MINDRIAN_ROOM = roomDir;
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9'; // unreachable loopback, never a real Brain

  Object.assign(env, overrides || {});

  const dirs = { home: homeDir, roomsHome, roomDir };
  const cleanup = () => {
    for (const d of [homeDir, roomsHome]) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch (_e) {
        /* best effort */
      }
    }
  };

  return { env, dirs, cleanup };
}

// ---------------------------------------------------------------------------
// rpcOverStdio(entryPath, requests, opts) -- spawns `node entryPath`, drives
// initialize -> notifications/initialized -> each request (ids 2..n+1) over
// stdin, keeps stdin open until every id has a response or opts.timeoutMs
// elapses, then ends stdin and SIGKILLs the child. NEVER throws on a JSON-RPC
// error; an error response comes back as the response object itself.
//
// requests: [{ method, params }]  (ids are assigned by this function)
// opts: { env, protocolVersion, capabilities, timeoutMs }
// resolves: { initialize, responses: Map(id -> response), stderr }
// ---------------------------------------------------------------------------
function rpcOverStdio(entryPath, requests, opts) {
  const o = opts || {};
  const protocolVersion = o.protocolVersion || DEFAULT_PROTOCOL_VERSION;
  const capabilities = o.capabilities || {};
  const timeoutMs = typeof o.timeoutMs === 'number' ? o.timeoutMs : DEFAULT_TIMEOUT_MS;
  const env = o.env || process.env;
  const reqList = Array.isArray(requests) ? requests : [];
  const expectedNonInitIds = reqList.map((_, i) => i + 2);

  return new Promise((resolve) => {
    let child;
    try {
      child = cp.spawn('node', [entryPath], { cwd: REPO_ROOT, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (_e) {
      resolve({ initialize: null, responses: new Map(), stderr: '' });
      return;
    }

    let settled = false;
    let stdoutBuf = '';
    let stderrBuf = '';
    const responses = new Map();
    let initializeResponse = null;
    let timer = null;

    // The one exit path. Always ends stdin (best effort) and always
    // SIGKILLs the child -- the "finally" contract, expressed as a single
    // funnel every code path below routes through.
    function finish() {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        child.stdin.end();
      } catch (_e) {
        /* already closed */
      }
      killTree(child.pid);
      resolve({ initialize: initializeResponse, responses, stderr: stderrBuf });
    }

    timer = setTimeout(finish, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch (_e) {
          continue; // non-JSON stdout noise
        }
        if (!obj || typeof obj.id === 'undefined' || obj.id === null) continue;
        if (obj.id === 1) {
          initializeResponse = obj;
        } else {
          responses.set(obj.id, obj);
        }
        const allSeen = initializeResponse && expectedNonInitIds.every((id) => responses.has(id));
        if (allSeen) finish();
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
    });

    child.on('error', finish);
    child.on('exit', finish);

    try {
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion,
            capabilities,
            clientInfo: { name: 'mcp-wire-267', version: '1' },
          },
        }) + '\n'
      );
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      reqList.forEach((r, i) => {
        child.stdin.write(
          JSON.stringify({ jsonrpc: '2.0', id: i + 2, method: r.method, params: r.params || {} }) + '\n'
        );
      });
    } catch (_e) {
      finish();
    }
  });
}

function sortByKey(list, key) {
  return list.slice().sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')));
}

// ---------------------------------------------------------------------------
// wireSnapshot(entryPath, opts) -- tools/list, prompts/list, resources/list,
// resources/templates/list in one round trip, reduced to the stable fields a
// contract comparison cares about, sorted by name/uri for a deterministic
// diff.
// ---------------------------------------------------------------------------
async function wireSnapshot(entryPath, opts) {
  const requests = [
    { method: 'tools/list' },
    { method: 'prompts/list' },
    { method: 'resources/list' },
    { method: 'resources/templates/list' },
  ];
  const { initialize, responses } = await rpcOverStdio(entryPath, requests, opts);

  const initResult = (initialize && initialize.result) || {};
  const toolsResult = (responses.get(2) && responses.get(2).result) || {};
  const promptsResult = (responses.get(3) && responses.get(3).result) || {};
  const resourcesResult = (responses.get(4) && responses.get(4).result) || {};
  const templatesResult = (responses.get(5) && responses.get(5).result) || {};

  const tools = (Array.isArray(toolsResult.tools) ? toolsResult.tools : []).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  const prompts = (Array.isArray(promptsResult.prompts) ? promptsResult.prompts : []).map((p) => ({
    name: p.name,
    title: p.title,
    description: p.description,
    arguments: p.arguments,
  }));
  const resources = (Array.isArray(resourcesResult.resources) ? resourcesResult.resources : []).map((r) => ({
    uri: r.uri,
    name: r.name,
  }));
  const templates = (Array.isArray(templatesResult.resourceTemplates) ? templatesResult.resourceTemplates : []).map(
    (t) => ({ uriTemplate: t.uriTemplate, name: t.name })
  );

  return {
    protocolVersion: initResult.protocolVersion,
    instructions: initResult.instructions,
    tools: sortByKey(tools, 'name'),
    prompts: sortByKey(prompts, 'name'),
    resources: sortByKey(resources, 'uri'),
    templates: sortByKey(templates, 'uriTemplate'),
  };
}

// ---------------------------------------------------------------------------
// normalizeSchema(schema) -- deep clone with the top-level $schema key
// removed and object keys sorted recursively, so a draft-07 (v1) versus
// draft 2020-12 (v2) $schema difference, or pure key reordering, never
// registers as a contract change.
// ---------------------------------------------------------------------------
function normalizeSchema(schema) {
  function sortDeep(value) {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) {
        out[key] = sortDeep(value[key]);
      }
      return out;
    }
    return value;
  }
  const clone = JSON.parse(JSON.stringify(schema === undefined ? null : schema));
  if (clone && typeof clone === 'object' && !Array.isArray(clone)) {
    delete clone.$schema;
  }
  return sortDeep(clone);
}

function schemaEqual(a, b) {
  return JSON.stringify(normalizeSchema(a)) === JSON.stringify(normalizeSchema(b));
}

function deltaAccepted(acceptedDeltas, diff) {
  if (!Array.isArray(acceptedDeltas)) return false;
  return acceptedDeltas.some(
    (d) => d && d.kind === diff.kind && d.name === diff.name && d.field === diff.field
  );
}

// ---------------------------------------------------------------------------
// compareToSnapshot(live, snapshot, acceptedDeltas) -- returns an array of
// diff records { kind, name, field, expected, actual }. Titles are NOT
// compared here (a later plan adds them on purpose). A diff matched by
// { kind, name, field } in acceptedDeltas is excluded.
// ---------------------------------------------------------------------------
function compareToSnapshot(live, snapshot, acceptedDeltas) {
  const diffs = [];
  const liveTools = new Map((live.tools || []).map((t) => [t.name, t]));
  const snapTools = new Map((snapshot.tools || []).map((t) => [t.name, t]));

  for (const name of snapTools.keys()) {
    if (!liveTools.has(name)) {
      diffs.push({ kind: 'tool', name, field: 'membership', expected: 'present', actual: 'missing' });
    }
  }
  for (const name of liveTools.keys()) {
    if (!snapTools.has(name)) {
      diffs.push({ kind: 'tool', name, field: 'membership', expected: 'absent', actual: 'present' });
    }
  }
  for (const [name, snapTool] of snapTools) {
    const liveTool = liveTools.get(name);
    if (!liveTool) continue;
    if (snapTool.description !== liveTool.description) {
      diffs.push({
        kind: 'tool',
        name,
        field: 'description',
        expected: snapTool.description,
        actual: liveTool.description,
      });
    }
    if (!schemaEqual(snapTool.inputSchema, liveTool.inputSchema)) {
      diffs.push({
        kind: 'tool',
        name,
        field: 'inputSchema',
        expected: normalizeSchema(snapTool.inputSchema),
        actual: normalizeSchema(liveTool.inputSchema),
      });
    }
  }

  const livePrompts = new Map((live.prompts || []).map((p) => [p.name, p]));
  const snapPrompts = new Map((snapshot.prompts || []).map((p) => [p.name, p]));
  for (const [name, snapPrompt] of snapPrompts) {
    const livePrompt = livePrompts.get(name);
    if (!livePrompt) {
      diffs.push({ kind: 'prompt', name, field: 'membership', expected: 'present', actual: 'missing' });
      continue;
    }
    if (snapPrompt.description !== livePrompt.description) {
      diffs.push({
        kind: 'prompt',
        name,
        field: 'description',
        expected: snapPrompt.description,
        actual: livePrompt.description,
      });
    }
    if (JSON.stringify(snapPrompt.arguments || []) !== JSON.stringify(livePrompt.arguments || [])) {
      diffs.push({
        kind: 'prompt',
        name,
        field: 'arguments',
        expected: snapPrompt.arguments,
        actual: livePrompt.arguments,
      });
    }
  }

  return diffs.filter((d) => !deltaAccepted(acceptedDeltas, d));
}

module.exports = {
  hermeticEnv,
  rpcOverStdio,
  wireSnapshot,
  normalizeSchema,
  compareToSnapshot,
  killTree,
  LOCAL_SERVER,
  BRAIN_SHIM,
};
