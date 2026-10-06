#!/usr/bin/env node
// 369.26-17: the part of the spike-008 check that needs NO login: what the repo's own local MCP
// servers say, measured in a hermetic temp room, with no Claude Code session at all.
//
//   node ui/mindrian-workspace-mod/scripts/gate-probe.cjs [--out <file.json>]
//
// It measures, and prints as JSON (and writes to --out when given):
//   binding        how a session becomes bound (a session binding file works; CLAUDE_ACTIVE_ROOM alone does not)
//   gate_list      the exact shape of a listed card, including where the "recommended" fact lives
//   direct_press   what a session that did NOT raise a card is told when it answers it (the code the mod maps to E01 or E04)
//   session_mismatch  the other refusal, from two sessions inside ONE server process (the ledger rule)
//   mirror         gate_render mirror_of: a new id, and the room's records unchanged after it
//   answer         gate_answer on the mirror: answered_via, replay on a second press, two presses at once, the owner afterwards
//   decide_later   no call at all: records identical across reads
//   card_pending   whether Claude Code can ever be sent the elicitation card (the E07 path)
//   servers        the tools each local server registers, and what the guarded Brain shim does with framework_techniques
//
// Everything runs under an OS temp folder, with a dead Brain address; it touches no real room and
// no real Brain, and it removes every folder and child process it made. Exit 0 measured, 77 ENV GAP
// (the MCP client package cannot be loaded). Build tooling; CJS; no em-dashes.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const { hashRecords } = require('./lib/live-pure.cjs');
const LR = require('./lib/live-room.cjs');

const OPTS_FLAGGED = [
  { id: 'yes', label: 'Yes, go with it', rank: 1, recommended: true, description: 'Because the evidence shows commitment (sample).' },
  { id: 'later', label: 'Not yet, show me more', rank: 2 },
  { id: 'no', label: 'No', rank: 3 },
];
const OPTS_UNFLAGGED = OPTS_FLAGGED.map((o) => ({ id: o.id, label: o.label, rank: o.rank }));

const short = (x, n) => JSON.stringify(x).slice(0, n || 400);

async function main(argv) {
  let outFile = null;
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--out') outFile = argv[i + 1];
  try { require('@modelcontextprotocol/client'); } catch (e) {
    process.stdout.write('ENV GAP (exit 77): the MCP client package cannot be loaded (' + e.message + '). Run npm ci in the repo root and run this again. Nothing was faked.\n');
    return 77;
  }
  const { buildRoom369, writeRegistry } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-369.cjs'));
  const { cliClient } = require(path.join(REPO, 'tests', 'helpers', 'cli-gate-369.cjs'));
  const { writeSessionBinding } = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ws-gateprobe-'));
  const roomsHome = path.join(root, 'rooms');
  const home = path.join(root, 'home');
  fs.mkdirSync(roomsHome);
  fs.mkdirSync(home);
  const slug = 'probe-room';
  const built = buildRoom369({ tmpDir: path.join(root, 'stage'), slug, variant: 'wide', migrate: true });
  const roomDir = path.join(roomsHome, slug);
  fs.renameSync(built.roomDir, roomDir);
  writeRegistry(roomsHome, [{ slug, abs_path: roomDir }], slug);

  const clients = [];
  const R = { measured_at: new Date().toISOString(), node: process.version, repo_version: null };
  try { R.repo_version = require(path.join(REPO, '.claude-plugin', 'plugin.json')).version; } catch (e) { /* optional */ }
  const inspect = (gateId) => LR.inspectLiveRoom({ roomsHome, slug, gateId });
  const make = async (sessionId, extraEnv) => { const c = await cliClient({ roomsHome, home, sessionId, extraEnv }); clients.push(c); return c; };

  try {
    // ---- binding ----
    const unboundEnv = await make('probe-env-only', { CLAUDE_ACTIVE_ROOM: slug });
    const s1 = await unboundEnv.call('status_read', {});
    const l1 = await unboundEnv.call('gate_list', {});
    const sid = crypto.randomUUID();
    writeSessionBinding(sid, { bound: [slug], primary: slug }, { home: roomsHome });
    const byFile = await make(sid);
    const s2 = await byFile.call('status_read', {});
    R.binding = {
      env_only: { room_binding: s1.segments && s1.segments.room_binding, gate_list: { ok: l1.ok, reason: l1.reason } },
      binding_file: { room_binding: s2.segments && s2.segments.room_binding },
      reading: 'CLAUDE_ACTIVE_ROOM alone does not bind a session (status_read bound false, registry fallback only; gate_list refuses room_unbound). A binding file for the session id does (bound true, source session.primary). The live harness therefore gives the nested Claude Code a fresh session id (--session-id plus CLAUDE_CODE_SESSION_ID) and writes that binding file; whether the plugin server inherits the id is the live check.',
    };

    // ---- a card raised by another process, unflagged and flagged ----
    const raiser = await make('probe-raiser');
    await raiser.bind(slug);
    const unflagged = await raiser.call('gate_render', { header: 'Unflagged card (sample)', kind: 'general', select_mode: 'single', options: OPTS_UNFLAGGED, approving: ['yes'] });
    const flagged = await raiser.call('gate_render', { header: 'Flagged card (sample)', kind: 'general', select_mode: 'single', options: OPTS_FLAGGED, approving: ['yes'] });
    const mod = await make('probe-mod');
    await mod.bind(slug);
    const listed = await mod.call('gate_list', {});
    const byHeader = (h) => (listed.gates || []).find((g) => g.header === h);
    const u = byHeader('Unflagged card (sample)');
    const f = byHeader('Flagged card (sample)');
    R.gate_list = {
      count: listed.count,
      card_keys: f ? Object.keys(f) : null,
      option_keys: f ? Object.keys(f.options[0]) : null,
      flagged: f ? { top_level_recommended: f.recommended, per_option_recommended: f.options.map((o) => [o.id, o.recommended]) } : null,
      unflagged: u ? { top_level_recommended: u.recommended, per_option_recommended: u.options.map((o) => [o.id, o.recommended]) } : null,
      reading: 'The mod reads only the per-option recommended flag (src/model/mappers.ts recommendedOption). A card raised WITHOUT a per-option flag lists top_level_recommended (the runtime derives it from rank) but every per-option flag false, so the mod would draw no "Mindrian suggests" line for it.',
    };

    // ---- direct press from a session that did not raise the card ----
    const before = inspect(flagged.gate_id);
    const direct = await mod.call('gate_answer', { gate_id: flagged.gate_id, chosen: ['yes'], verdict: 'approve' });
    const afterDirect = inspect(flagged.gate_id);
    R.direct_press = { reply: { ok: direct.ok, reason: direct.reason }, room_records_unchanged: before.recordsHash === afterDirect.recordsHash, reading: 'A different server process does not know the gate id, so the refusal is unknown_gate (the mod maps it to E01). session_mismatch needs two sessions inside one server process (below). The card stays open in the room.' };

    // ---- session_mismatch: two sessions, one process (the ledger rule) ----
    R.session_mismatch = await sessionMismatchInProcess(root);

    // ---- mirror ----
    const optionIds = f.options.map((o) => ({ id: o.id, label: o.id }));
    const hashBeforeMirror = inspect(flagged.gate_id).recordsHash;
    const mirror = await mod.call('gate_render', { mirror_of: flagged.gate_id, options: optionIds });
    const hashAfterMirror = inspect(flagged.gate_id).recordsHash;
    const stillListed = await mod.call('gate_list', {});
    R.mirror = {
      ok: mirror.ok,
      new_id_differs: typeof mirror.gate_id === 'string' && mirror.gate_id !== flagged.gate_id,
      renderer: mirror.renderer,
      records_unchanged: hashBeforeMirror === hashAfterMirror,
      source_still_listed_once: (stillListed.gates || []).filter((g) => g.gate_id === flagged.gate_id).length === 1,
      reading: 'The mirror gets its own id; the mod must answer the mirror id, not the source id. It leaves no record of its own.',
    };

    // ---- decide later: no call; records identical across reads ----
    const h0 = inspect(flagged.gate_id).recordsHash;
    await mod.call('gate_list', {});
    await mod.call('status_read', {});
    const h1 = inspect(flagged.gate_id).recordsHash;
    R.decide_later = { records_identical_across_reads: h0 === h1, reading: 'The mod writes nothing on Decide later because it makes no call; reads (gate_list, status_read) leave the records unchanged.' };

    // ---- answer: two presses at once, replay, the owner afterwards ----
    const [a1, a2] = await Promise.all([
      mod.call('gate_answer', { gate_id: mirror.gate_id, chosen: ['yes'], verdict: 'approve' }),
      mod.call('gate_answer', { gate_id: mirror.gate_id, chosen: ['yes'], verdict: 'approve' }),
    ]);
    const third = await mod.call('gate_answer', { gate_id: mirror.gate_id, chosen: ['yes'], verdict: 'approve' });
    const owner = await raiser.call('gate_answer', { gate_id: flagged.gate_id, chosen: ['yes'], verdict: 'approve' });
    const after = inspect(flagged.gate_id);
    const listedAfter = await mod.call('gate_list', {});
    const pick = (x) => ({ ok: x.ok, replayed: x.replayed === true, already_answered: x.already_answered === true, answered_elsewhere: x.answered_elsewhere === true, answered_via: x.answered_via, ratified: x.ratified, decision_node_id: x.decision_node_id || (x.reasoning_node && x.reasoning_node.node_id) || null });
    R.answer = {
      first_of_two_at_once: pick(a1),
      second_of_two_at_once: pick(a2),
      later_press: pick(third),
      owner_afterwards: Object.assign(pick(owner), { via_gate_id: owner.via_gate_id }),
      room_after: { decision_nodes: after.decisionNodes, gate_answer_anchor: after.gateAnswer },
      gates_still_listed_after: listedAfter.count,
      reading: 'Exactly one decision node however many presses; the route the room records is answered_via. The mod\'s call is recorded mcp_relayed; only a browser click through the shell is browser_nonce.',
    };
    R.answer.exactly_one_decision = after.decisionNodes.length === 1;
    R.answer.recorded_route = after.gateAnswer.answeredVia;

    // ---- card_pending reachability ----
    const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
    const fakeServer = (name) => ({ server: { getClientCapabilities: () => ({ elicitation: {} }), getClientVersion: () => ({ name, version: '2.1.289' }) } });
    R.card_pending = {
      claude_code_cli_declaring_elicitation: gateRender.detectGateCapabilities(fakeServer('claude-code'), { surface: 'cli' }),
      non_claude_host_declaring_elicitation: gateRender.detectGateCapabilities(fakeServer('some-other-host'), { surface: null }),
      reading: 'On Claude Code (CLI, Desktop, Cowork) a card is the AskUserQuestion card even when the host declares elicitation, so a mirrored card there is never an elicitation card and the E07 card_pending refusal is reachable only on a non-Claude host.',
    };

    // ---- servers ----
    R.servers = await serverFacts(roomsHome, home);
  } finally {
    for (const c of clients) { try { await c.close(); } catch (e) { /* best effort */ } }
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }

  const text = JSON.stringify(R, null, 2) + '\n';
  if (outFile) {
    fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
    fs.writeFileSync(outFile, text);
  }
  process.stdout.write(text);
  return 0;
}

// Two sessions inside one server process: the ledger refuses the second with session_mismatch.
async function sessionMismatchInProcess(root) {
  const home = path.join(root, 'inproc-home');
  const roomsHome = path.join(root, 'inproc-rooms');
  fs.mkdirSync(home, { recursive: true });
  const { buildRoom369, writeRegistry } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-369.cjs'));
  const slug = 'inproc-room';
  const built = buildRoom369({ tmpDir: path.join(root, 'inproc-stage'), slug, variant: 'wide', migrate: true });
  fs.mkdirSync(roomsHome, { recursive: true });
  const roomDir = path.join(roomsHome, slug);
  fs.renameSync(built.roomDir, roomDir);
  writeRegistry(roomsHome, [{ slug, abs_path: roomDir }], slug);
  const saved = {};
  for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_BRAIN_URL', 'MINDRIAN_TEST_MODE']) saved[k] = process.env[k];
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;
  process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  process.env.MINDRIAN_TEST_MODE = '1';
  delete process.env.CLAUDE_CODE_SESSION_ID;
  try {
    const gateTools = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
    const { writeSessionBinding } = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
    for (const s of ['ip-owner', 'ip-other']) writeSessionBinding(s, { bound: [slug], primary: slug }, { home: roomsHome });
    const handlers = {};
    gateTools.register({ registerTool(name, _c, h) { handlers[name] = h; }, server: { getClientCapabilities: () => ({}), getClientVersion: () => ({ name: 'gate-probe', version: '1.0.0' }) } }, {});
    const call = async (tool, args, session) => {
      const r = await handlers[tool](args, { sessionId: session });
      const t = (r.content || []).map((c) => c.text || '').join('').split('\n\n## ')[0];
      try { return JSON.parse(t); } catch (e) { return { __error: t.slice(0, 200) }; }
    };
    const g = await call('gate_render', { header: 'In-process card (sample)', kind: 'general', select_mode: 'single', options: OPTS_FLAGGED, approving: ['yes'] }, 'ip-owner');
    const refused = await call('gate_answer', { gate_id: g.gate_id, chosen: ['yes'], verdict: 'approve' }, 'ip-other');
    return { reply: { ok: refused.ok, reason: refused.reason }, reading: 'Two sessions in one server process: the second is refused session_mismatch (the mod maps it to E04) and the gate stays open for its owner. Whether the plugin\'s own tool connection and the mod\'s $.mcp.call share one session is a live check.' };
  } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

// What the two local servers register, and what the guarded Brain shim does with framework_techniques.
async function serverFacts(roomsHome, home) {
  const { Client } = require('@modelcontextprotocol/client');
  const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
  const env = Object.assign({}, process.env);
  for (const k of Object.keys(env)) if (k.indexOf('MINDRIAN_') === 0 || k === 'CLAUDE_ACTIVE_ROOM' || k === 'CLAUDE_CODE_SESSION_ID') delete env[k];
  Object.assign(env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: roomsHome, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', MINDRIAN_TEST_MODE: '1', CLAUDE_SURFACE: 'cli' });
  const spawn = async (file) => {
    const transport = new StdioClientTransport({ command: 'node', args: [path.join(REPO, file)], env, cwd: REPO, stderr: 'pipe' });
    const client = new Client({ name: 'gate-probe', version: '1.0.0' }, { capabilities: {}, versionNegotiation: { mode: 'legacy' } });
    await client.connect(transport);
    return { client, transport };
  };
  const out = {};
  const mcpJson = JSON.parse(fs.readFileSync(path.join(REPO, '.mcp.json'), 'utf8'));
  const pluginName = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')).name;
  out.manifest = {
    plugin_name: pluginName,
    mcp_json_servers: Object.keys(mcpJson.mcpServers),
    names_claude_code_gives_them: Object.keys(mcpJson.mcpServers).map((k) => 'plugin:' + pluginName + ':' + k),
    reading: 'A plugin server is listed as plugin:<plugin name>:<server key>. The plugin is named "mos" and .mcp.json keys are mindrian-os and mindrian-brain, so the names are plugin:mos:mindrian-os and plugin:mos:mindrian-brain, the two the mod calls. The live /mcp screen is the confirming check.',
  };
  for (const [key, file, wanted] of [['mindrian_os', 'scripts/mindrian-mcp-server.cjs', ['gate_list', 'gate_render', 'gate_answer', 'status_read', 'room_artifact', 'whitespace_scan', 'room_bind']], ['mindrian_brain', 'scripts/mindrian-brain-mcp-client.cjs', ['brain_ask', 'brain_query', 'brain_schema', 'brain_search', 'brain_stats', 'brain_write', 'framework_techniques']]]) {
    let session = null;
    try {
      session = await spawn(file);
      const tools = (await session.client.listTools()).tools.map((t) => t.name).sort();
      out[key] = { tool_count: tools.length, wanted_present: Object.fromEntries(wanted.map((w) => [w, tools.includes(w)])) };
      if (key === 'mindrian_brain') {
        out[key].tools = tools;
        let reply;
        try {
          const r = await session.client.callTool({ name: 'framework_techniques', arguments: { framework: 'Jobs to be Done' } });
          reply = { isError: r.isError === true, text: ((r.content || [])[0] || {}).text ? String(r.content[0].text).slice(0, 200) : null };
        } catch (e) {
          reply = { rejected: String(e && e.message || e).slice(0, 200) };
        }
        out[key].framework_techniques_call = reply;
        out[key].reading = 'The guarded Brain shim registers only the six tools above. A framework_techniques call through it comes back as an unknown tool, so the mod\'s Think-tab lookup cannot work through this shim until the shim proxies that one tool.';
      }
    } catch (e) {
      out[key] = { error: String(e && e.message || e).slice(0, 300) };
    } finally {
      if (session) { try { await session.client.close(); } catch (e) { /* best effort */ } try { if (typeof session.transport.pid === 'number') process.kill(session.transport.pid, 'SIGKILL'); } catch (e) { /* already gone */ } }
    }
  }
  return out;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write('gate-probe: ' + (e.stack || e.message) + '\n'); process.exit(1); });
}

module.exports = { main, hashRecords };
