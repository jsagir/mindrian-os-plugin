'use strict';
/*
 * Quick-260717-2vf Task 2 -- the hermetic proof for the three eureka compute
 * subcommands (eureka-run / eureka-status / eureka-report) on the intelligence
 * router tool.
 *
 * Follows the tests/test-212-part8-boundary.cjs idiom: node:assert/strict,
 * ok/fail counters, named check functions (the async ones awaited in a serial
 * async main), a summary line, process.exit(failed === 0 ? 0 : 1). No em-dashes,
 * no emoji.
 *
 * WHAT IT PROVES:
 *   CHECK 1 -- enum + parity: EUREKA_COMPUTE_COMMANDS is the three names, spread
 *              into the intelligence z.enum, and NONE of them leak into
 *              ALL_TOOL_COMMANDS (unique membership pinned at 65).
 *   CHECK 2 -- fire-and-return + in-process pid: on http transport eureka-run
 *              returns state:'started' mode:'in-process' immediately, the scan
 *              reaches a terminal state (observability), and status.json's pid ===
 *              process.pid (the decisive warm-cache residency proof -- the scan ran
 *              inside THIS process, exactly what keeps _pipelineCache warm).
 *   CHECK 3 -- status/report output contract: eureka-status deep-equals the
 *              status.json on disk; eureka-report returns the report json verbatim
 *              (or the What/Why/Fix no-report error); a room with no .mindrian
 *              returns {"state":"none"}.
 *   CHECK 4 -- already_running guard: the branch carries the _eurekaScanInFlight
 *              set/has/delete tokens and the module declares the Map at top level.
 *   CHECK 5 -- stdio detach shape: the non-http path spawns detached with
 *              stdio 'ignore' via pluginRoot; the http path calls .main( without
 *              await (fire-and-return).
 *   CHECK 6 -- unknown-room guard: a boot roomDir that does not exist, with every
 *              resolver leg missing, returns the 'room directory not found' error.
 *
 * Hermetic: a tmp fixture room, the offline stub encoder (zero network, zero model
 * load), CLAUDE_ACTIVE_ROOM + MINDRIAN_ROOMS_HOME env-pinned with MINDRIAN_MCP_FIRST
 * cleared, cleanup in a finally block.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// ---------------------------------------------------------------------------
// Fixture helpers -- the REAL makeFixtureRoom / makeFixtureGraph from
// tests/test-226-mode-disclosure.cjs (lines 56 and 78), copied verbatim so this
// test owns its fixtures. makeFixtureGraph is called with the DEFAULT substrate
// path (<ROOM_DIR>/.mindrian/idea-graph.json, eureka-command.cjs roomGraphPath)
// so resolveSubstrate picks graph mode and the offline run is deterministic.
// ---------------------------------------------------------------------------

const POOL_A = ['photon', 'lattice', 'entropy', 'plasma', 'quantum', 'resonance'];
const POOL_B = ['enzyme', 'protein', 'membrane', 'genome', 'mitosis', 'receptor'];

function bodyFor(idx, pool) {
  const a = pool[idx % pool.length];
  const b = pool[(idx + 2) % pool.length];
  return 'The ' + a + ' governs the ' + b + ' behavior under load, exploring how ' + a
    + ' and ' + b + ' couple across the boundary of this domain in several sentences.';
}

function makeFixtureRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-mcp-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const now = new Date().toISOString();
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (let i = 1; i <= 6; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 3;
    const section = inA ? 'physics' : 'biology';
    const body = bodyFor(i, inA ? POOL_A : POOL_B);
    ins.run(id, 'Claim', JSON.stringify({ text: body, section: section, parentId: inA ? 'DOM_A' : 'DOM_B' }),
      'fixture://' + id, 'import', now, now);
    const secDir = path.join(dir, section);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, id + '.md'), '# ' + section + ' tech ' + i + '\n\n' + body + '\n', 'utf8');
  }
  closeRoomDb(db);
  return dir;
}

function makeFixtureGraph(graphPath) {
  const nodes = [];
  for (let i = 1; i <= 6; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 3;
    nodes.push({
      data: {
        id: id, cnumber: id, title: (inA ? 'physics tech ' : 'biology tech ') + i,
        primary_tier: 1, pair_count: 5 + i, degree: 10 + i,
        section: inA ? 'physics' : 'biology',
        primary_problem: (inA ? 'energy transport gap ' : 'cell signaling gap ') + i,
        problems: [(inA ? 'energy transport gap ' : 'cell signaling gap ') + i],
      },
    });
  }
  const edges = [
    { data: { type: 'CONVERGES', source: 'C00001', target: 'C00004', shared_problems: ['cross-domain bridge'] } },
    { data: { type: 'CONVERGES', source: 'C00002', target: 'C00005', shared_problems: ['boundary coupling'] } },
  ];
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  fs.writeFileSync(graphPath,
    JSON.stringify({ meta: { honest_nouns: 'hermetic eureka mcp fixture' }, elements: { nodes: nodes, edges: edges } }),
    'utf8');
}

// ---------------------------------------------------------------------------
// Source-region helpers (the test-212 line-window + comment-strip idiom).
// ---------------------------------------------------------------------------

function stripComments(src) {
  return src
    .split(/\r?\n/)
    .map(function (raw) {
      const t = raw.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
      return raw.replace(/\/\/.*$/, '');
    })
    .join('\n');
}

// The eureka compute branch region: from the `EUREKA_COMPUTE_COMMANDS.includes(command)`
// line to (but not including) the `if (command === 'research')` line. Both lines are
// unique in the file.
function extractEurekaBranchRegion(src) {
  const lines = src.split(/\r?\n/);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/EUREKA_COMPUTE_COMMANDS\.includes\(command\)/.test(lines[i])) { startIdx = i; break; }
  }
  assert.ok(startIdx !== -1, 'could not locate the eureka branch start line');
  let endIdx = -1;
  for (let i = startIdx; i < lines.length; i += 1) {
    if (/command === 'research'/.test(lines[i])) { endIdx = i; break; }
  }
  assert.ok(endIdx !== -1, 'could not locate the research branch (branch region end)');
  return lines.slice(startIdx, endIdx).join('\n');
}

// Split a tool response body on the Suggested Next chaining section, returning
// the primary payload the CLI contract preserves byte-for-byte.
function bodyBeforeSuggestedNext(resp) {
  const text = resp && resp.content && resp.content[0] && resp.content[0].text;
  assert.equal(typeof text, 'string', 'response carries a text body');
  return text.split('\n\n## Suggested Next')[0];
}

// ---------------------------------------------------------------------------
// Env isolation seam (the load-bearing hermeticity). CLAUDE_ACTIVE_ROOM routes
// every handler call to the fixture (resolveActiveRoom precedence leg 1, the
// documented test/operator seam); MINDRIAN_ROOMS_HOME points every registry leg
// at a fresh empty home so a leg-1 miss can never reach the developer's real
// active room; MINDRIAN_MCP_FIRST is cleared so resolveWriteTargetDir takes the
// flag-OFF resolveActiveRoom branch under test. All four saved and restored.
// ---------------------------------------------------------------------------

const SAVED = {
  CLAUDE_ACTIVE_ROOM: process.env.CLAUDE_ACTIVE_ROOM,
  MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME,
  MINDRIAN_MCP_FIRST: process.env.MINDRIAN_MCP_FIRST,
  MINDRIAN_TRANSPORT: process.env.MINDRIAN_TRANSPORT,
};
function restoreEnv(key) {
  if (SAVED[key] === undefined) delete process.env[key];
  else process.env[key] = SAVED[key];
}

// ---------------------------------------------------------------------------
// CHECK 1 -- enum + parity (source + module).
// ---------------------------------------------------------------------------
function check1_enumAndParity() {
  const label = 'CHECK 1 - enum + parity (EUREKA_COMPUTE_COMMANDS on the intelligence enum, not in ALL_TOOL_COMMANDS)';
  try {
    const src = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
    // (a) the const is declared with exactly the three subcommand names.
    assert.ok(
      /const\s+EUREKA_COMPUTE_COMMANDS\s*=\s*\[\s*'eureka-run'\s*,\s*'eureka-status'\s*,\s*'eureka-report'\s*\]/.test(src),
      label + ': EUREKA_COMPUTE_COMMANDS is not declared with exactly the three subcommand names');
    // (b) it is spread into the intelligence command z.enum.
    assert.ok(
      /z\.enum\(\[\s*\.\.\.INTELLIGENCE_COMMANDS\s*,\s*\.\.\.EUREKA_COMPUTE_COMMANDS\s*\]\)/.test(src),
      label + ': EUREKA_COMPUTE_COMMANDS is not spread into the intelligence z.enum');
    // (c) via the required module: none of the three leak into ALL_TOOL_COMMANDS,
    //     and its unique membership is pinned at 65.
    const toolRouter = require(TOOL_ROUTER_PATH);
    const cmds = toolRouter.ALL_TOOL_COMMANDS;
    for (const c of ['eureka-run', 'eureka-status', 'eureka-report']) {
      assert.ok(cmds.indexOf(c) === -1, label + ': ' + c + ' leaked into ALL_TOOL_COMMANDS');
    }
    const uniq = new Set(cmds.map(function (c) { return String(c).toLowerCase(); }));
    assert.equal(uniq.size, 65, label + ': ALL_TOOL_COMMANDS unique membership is ' + uniq.size + ', expected 65');
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 2 -- fire-and-return + in-process pid (the warm-cache residency proof).
// ---------------------------------------------------------------------------
async function check2_fireAndReturnPid(ctx) {
  const label = 'CHECK 2 - fire-and-return + in-process pid (state started, terminal reached, status.pid === process.pid)';
  try {
    process.env.MINDRIAN_TRANSPORT = 'http'; // flip the transport gate (per-call env read)
    const resp = await ctx.handlers.intelligence(
      { command: 'eureka-run', context: JSON.stringify({ offline: true, noExtract: true, top: 5 }) },
      {}
    );
    const first = bodyBeforeSuggestedNext(resp);
    const started = JSON.parse(first);
    assert.equal(started.state, 'started', label + ': state is ' + started.state + ', expected started');
    assert.equal(started.mode, 'in-process', label + ': mode is ' + started.mode + ', expected in-process');
    const eurekaBase = path.join(ctx.tmpRoom, '.mindrian', 'eureka');
    assert.ok(started.status.indexOf(eurekaBase) === 0,
      label + ': status path ' + started.status + ' is not inside ' + eurekaBase);

    // Poll for a terminal state (fire-and-return + observability).
    const statusFile = path.join(eurekaBase, 'status.json');
    const terminalStates = ['done', 'failed', 'reasoning_await_mappings'];
    let status = null;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (fs.existsSync(statusFile)) {
        try {
          const s = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
          if (terminalStates.indexOf(s.state) !== -1) { status = s; break; }
        } catch (_e) { /* status.json mid-write, keep polling */ }
      }
      await sleep(250);
    }
    assert.ok(status, label + ': the scan never reached a terminal state within 60s');
    ctx.terminalStatus = status;
    // The decisive in-process proof.
    assert.equal(status.pid, process.pid,
      label + ': status.json pid ' + status.pid + ' !== process.pid ' + process.pid + ' (scan did not run in-process)');
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 3 -- status / report output contract.
// ---------------------------------------------------------------------------
async function check3_statusReportContract(ctx) {
  const label = 'CHECK 3 - status/report output contract (verbatim status + report, none-fallback)';
  try {
    const eurekaBase = path.join(ctx.tmpRoom, '.mindrian', 'eureka');
    const statusFile = path.join(eurekaBase, 'status.json');
    const jsonFile = path.join(eurekaBase, 'portfolio-report.json');

    // (a) eureka-status deep-equals the status.json on disk.
    const statusResp = await ctx.handlers.intelligence({ command: 'eureka-status', context: '' }, {});
    const statusBody = bodyBeforeSuggestedNext(statusResp);
    assert.deepEqual(JSON.parse(statusBody), JSON.parse(fs.readFileSync(statusFile, 'utf8')),
      label + ': eureka-status payload does not deep-equal status.json on disk');

    // (b) eureka-report. On a terminal 'done' run the report json exists and is
    //     returned verbatim with a provenance field. If the run degraded so no
    //     report was written, the What/Why/Fix no-report error is returned.
    const reportResp = await ctx.handlers.intelligence({ command: 'eureka-report', context: '' }, {});
    if (fs.existsSync(jsonFile)) {
      const reportBody = bodyBeforeSuggestedNext(reportResp);
      assert.equal(reportBody, fs.readFileSync(jsonFile, 'utf8'),
        label + ': eureka-report body is not byte-equal to portfolio-report.json');
      assert.ok(JSON.parse(reportBody).provenance, label + ': report json has no provenance field');
    } else {
      assert.equal(reportResp.isError, true, label + ': eureka-report should be isError when no report exists');
      const reportText = reportResp.content[0].text;
      assert.ok(reportText.indexOf('no eureka report yet') !== -1,
        label + ': no-report error missing the What/Why/Fix triple');
    }

    // (c) a room that exists but has NO .mindrian returns {"state":"none"} (leg 1
    //     has an fs.existsSync gate, so the pinned dir must actually exist on disk).
    const emptyRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-empty-'));
    process.env.CLAUDE_ACTIVE_ROOM = emptyRoom;
    try {
      const noneResp = await ctx.handlers.intelligence({ command: 'eureka-status', context: '' }, {});
      assert.equal(bodyBeforeSuggestedNext(noneResp), JSON.stringify({ state: 'none' }),
        label + ': a room with no .mindrian did not return {"state":"none"}');
    } finally {
      process.env.CLAUDE_ACTIVE_ROOM = ctx.tmpRoom;
      try { fs.rmSync(emptyRoom, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 4 -- already_running guard tokens (no live race, timing-flaky).
// ---------------------------------------------------------------------------
function check4_alreadyRunningGuard() {
  const label = 'CHECK 4 - already_running guard (_eurekaScanInFlight set/has/delete + module-level Map)';
  try {
    const src = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
    // module-level declaration.
    assert.ok(/const\s+_eurekaScanInFlight\s*=\s*new Map\(\)/.test(src),
      label + ': _eurekaScanInFlight is not declared as a module-level Map');
    // the branch uses set / has / delete.
    const region = stripComments(extractEurekaBranchRegion(src));
    for (const token of ['_eurekaScanInFlight.set(', '_eurekaScanInFlight.has(', '_eurekaScanInFlight.delete(']) {
      assert.ok(region.indexOf(token) !== -1, label + ': the eureka branch is missing "' + token + '"');
    }
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 5 -- stdio detach shape + http fire-and-return (source scan).
// ---------------------------------------------------------------------------
function check5_detachShape() {
  const label = 'CHECK 5 - stdio detach (spawn detached stdio ignore via pluginRoot) + http .main( without await';
  try {
    const src = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
    const region = stripComments(extractEurekaBranchRegion(src));
    // stdio detach shape (today's CLI start shape).
    assert.ok(/\bspawn\(/.test(region), label + ': the branch does not spawn a child on the stdio path');
    assert.ok(/detached:\s*true/.test(region), label + ': the spawn is not detached');
    assert.ok(/stdio:\s*'ignore'/.test(region), label + ": the spawn does not use stdio 'ignore'");
    assert.ok(/pluginRoot/.test(region) && /eureka-command\.cjs/.test(region),
      label + ': the detached child does not reference scripts/eureka-command.cjs via pluginRoot');
    // http fire-and-return: a `.main(` call statement with no await keyword.
    const mainLine = region.split('\n').filter(function (l) { return l.indexOf('.main(') !== -1; });
    assert.ok(mainLine.length >= 1, label + ': the branch never calls .main(');
    assert.ok(mainLine.some(function (l) { return l.indexOf('await') === -1; }),
      label + ': every .main( call is awaited (must be fire-and-return on the http path)');
    ok(label);
  } catch (e) { fail(label, e); }
}

// ---------------------------------------------------------------------------
// CHECK 6 -- unknown-room guard via the total-miss fallback leg.
// ---------------------------------------------------------------------------
async function check6_unknownRoomGuard(ctx) {
  const label = "CHECK 6 - unknown-room guard (nonexistent boot roomDir returns 'room directory not found')";
  try {
    // Drive the guard through the fallback leg: with CLAUDE_ACTIVE_ROOM deleted and
    // MINDRIAN_ROOMS_HOME pinned at the empty home, every resolver leg misses, so
    // resolveWriteTargetDir returns the boot roomDir -- which for this second stub
    // does not exist, tripping the guard.
    delete process.env.CLAUDE_ACTIVE_ROOM;
    const missingDir = path.join(os.tmpdir(), 'mos-eureka-missing-' + Date.now());
    const handlers2 = {};
    const server2 = { tool: function (name) { const rest = Array.prototype.slice.call(arguments, 1); handlers2[name] = rest[rest.length - 1]; } };
    require(TOOL_ROUTER_PATH).registerRouterTools(server2, missingDir, REPO_ROOT, { compact: '' }, 'cli');
    const resp = await handlers2.intelligence({ command: 'eureka-run', context: '' }, {});
    assert.equal(resp.isError, true, label + ': a nonexistent room should be an isError response');
    assert.ok(resp.content[0].text.indexOf('room directory not found') !== -1,
      label + ': the error text is missing "room directory not found"');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    process.env.CLAUDE_ACTIVE_ROOM = ctx.tmpRoom;
  }
}

// ---------------------------------------------------------------------------
// Serial async main.
// ---------------------------------------------------------------------------
async function main() {
  const tmpRoom = makeFixtureRoom();
  makeFixtureGraph(path.join(tmpRoom, '.mindrian', 'idea-graph.json'));
  const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-home-'));

  // Env pins (isolation).
  process.env.CLAUDE_ACTIVE_ROOM = tmpRoom;
  process.env.MINDRIAN_ROOMS_HOME = emptyHome;
  delete process.env.MINDRIAN_MCP_FIRST;

  // Stub server harness.
  const handlers = {};
  const server = { tool: function (name) { const rest = Array.prototype.slice.call(arguments, 1); handlers[name] = rest[rest.length - 1]; } };
  require(TOOL_ROUTER_PATH).registerRouterTools(server, tmpRoom, REPO_ROOT, { compact: '' }, 'cli');

  const ctx = { tmpRoom: tmpRoom, handlers: handlers };

  try {
    check1_enumAndParity();
    await check2_fireAndReturnPid(ctx);
    await check3_statusReportContract(ctx);
    check4_alreadyRunningGuard();
    check5_detachShape();
    await check6_unknownRoomGuard(ctx);
  } finally {
    restoreEnv('CLAUDE_ACTIVE_ROOM');
    restoreEnv('MINDRIAN_ROOMS_HOME');
    restoreEnv('MINDRIAN_MCP_FIRST');
    restoreEnv('MINDRIAN_TRANSPORT');
    try { fs.rmSync(tmpRoom, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    try { fs.rmSync(emptyHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  process.stdout.write('\n');
  process.stdout.write('eureka mcp tools: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().then(null, function (err) {
  process.stderr.write('test-eureka-mcp-tools: FATAL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
