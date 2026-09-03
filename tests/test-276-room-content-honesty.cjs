#!/usr/bin/env node
'use strict';

/*
 * Phase 276-03, Task 2 -- the F-11 through F-14 pin: `room_content`'s
 * WRITE-surface enumeration must name only commands that reach a write
 * primitive, and the new-project/setup/update reference-echo group must
 * carry the shipped NOT-EXECUTED banner instead of a silent omission.
 *
 * WHAT THIS DEFENDS. `room_content`'s description (lib/mcp/tool-router.cjs:
 * 738) calls itself "the WRITE surface (new-project, setup, file-
 * opportunity, create-funding, invoke-persona)" while the new-project /
 * setup / update / help fall-through group (:756-773) is a reference echo
 * (loadReference + loadRoomState + a fireCascade call + textResponse), and
 * personaOps.invokePersona (lib/core/persona-ops.cjs:550-577) is read-only.
 * The honest counterpoint this file pins: four commands genuinely write --
 * file-opportunity, create-funding, update-funding-stage, generate-personas
 * -- so the fix is to make the enumeration match the four that actually
 * write, and to carry the shipped NOT-EXECUTED banner on the echo group
 * instead of silently claiming a write happened.
 *
 * WRITTEN FIRST (TDD RED): lib/mcp/tool-router.cjs has not been touched by
 * this plan. This file is authored, run, and observed FAILING against the
 * pre-fix router, matching the 209b604f (RED) / 75278850 (GREEN) precedent.
 * The fix lands in plan 276-08.
 *
 * METHOD. Group A and Group B measure ground truth over the wire (real MCP
 * server, genuine JSON-RPC), same discipline as
 * tests/test-234-tool-description-floor.cjs's listToolsOverStdio. Group C is
 * a source-text pin (a Set literal's own membership is not observable over
 * the wire). Group D and Group E call the checker's own exported
 * resolveWritePrimitives() / resolveReachability() APIs directly against the
 * real production functions (via Function.prototype.toString(), never a
 * hand-rolled grep), so the assertion agrees with the detector by
 * construction. Group F traces lib/core/intelligence-cascade.cjs's
 * runCascade() directly, with the exact arguments tool-router.cjs's own
 * call site passes, to resolve RESEARCH assumption A6 as a measured fact.
 *
 * HARNESS HONESTY GUARD (mandatory, load-bearing). Before grading anything,
 * this file asserts the server answered tools/list AND that the
 * `room_content` tool registration was actually found.
 *
 * Canon Part 8: spawns a LOCAL process under a hermetic mkdtemp HOME with
 * MINDRIAN_BRAIN_KEY unset, plus in-process require()s of local repo
 * modules. Zero network reach, zero writes outside scratch dirs.
 *
 * Run: node tests/test-276-room-content-honesty.cjs
 * Exit: 1 at the end of Wave 0 (RED BY DESIGN). No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const TIMEOUT_MS = 30000;

const MIN_DESCRIPTION_CHARS = 120;
const HOST_DESCRIPTION_CAP_BYTES = 2048;

// The two shipped disclosure primitives (lib/mcp/tool-router.cjs:384-394,
// :1635-1638). Canon Part 7: reuse, never mint a third.
const NO_WRITE_MARKER = '**filed: false**';
const NOT_EXECUTED_TEXT = 'NOT EXECUTED.';

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

function info(label, detail) {
  process.stdout.write('  INFO - ' + label + ' :: ' + detail + '\n');
}

// ---------------------------------------------------------------------------
// spawnMcpSession(roomDir) -- same shape as
// tests/test-276-orchestration-scout-honesty.cjs's own helper (test-234's
// spawn/env, test-257's persistent request/notify session). Duplicated
// rather than shared, because this plan's files_modified declares only the
// two test files -- no new shared helper file.
// ---------------------------------------------------------------------------
function spawnMcpSession(roomDir) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-276-03b-'));
  const env = Object.assign({}, process.env, {
    HOME: tmpHome,
    MINDRIAN_TRANSPORT: 'stdio',
    MINDRIAN_ROOM: roomDir,
  });
  delete env.MINDRIAN_BRAIN_KEY;

  const proc = cp.spawn('node', [SERVER], { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'], env });

  let stdoutBuf = '';
  let stderrBuf = '';
  const pending = new Map();
  let nextId = 1;

  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch (_e) { continue; }
      if (obj && typeof obj.id !== 'undefined' && pending.has(obj.id)) {
        const p = pending.get(obj.id);
        pending.delete(obj.id);
        clearTimeout(p.timer);
        p.resolve(obj);
      }
    }
  });
  proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });
  proc.on('exit', (code) => {
    pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('server exited (code=' + code + ') before responding; stderr tail: ' + stderrBuf.slice(-500)));
    });
    pending.clear();
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('timeout waiting for ' + method + ' (id=' + id + '); stderr tail: ' + stderrBuf.slice(-500)));
      }, TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      proc.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', id, method }, params !== undefined ? { params } : {})) + '\n');
    });
  }

  function notify(method, params) {
    proc.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', method }, params !== undefined ? { params } : {})) + '\n');
  }

  function cleanup() {
    try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  async function init() {
    await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-276-room-content-honesty', version: '1.0.0' },
    });
    notify('notifications/initialized');
  }

  async function listTools() {
    const resp = await request('tools/list', {});
    if (resp.error) throw new Error('tools/list error: ' + JSON.stringify(resp.error));
    return (resp.result && resp.result.tools) || [];
  }

  async function callTool(name, args) {
    const resp = await request('tools/call', { name, arguments: args });
    if (resp.error) throw new Error('tools/call(' + name + ') error: ' + JSON.stringify(resp.error));
    const content = resp.result && resp.result.content && resp.result.content[0];
    return (content && content.type === 'text') ? content.text : '';
  }

  return { init, listTools, callTool, cleanup, stderrTail: () => stderrBuf.slice(-800) };
}

// ---------------------------------------------------------------------------
// findBannerDrivingSetsContainingAll(source, tokens) -- Group C's
// source-text membership pin. A NAIVE scan of every `new Set([...])`
// literal in the router is not enough: WRITE_TOOLS already quotes
// 'new-project'/'setup'/'update' (it drives the unrelated fireCascade
// dispatch, not the banner), so a naive "does any Set contain these three
// tokens" check passes vacuously today and would never be RED. This locates
// only the Set(s) that actually GATE the "NOT EXECUTED" banner text -- i.e.
// a declared `const IDENT = new Set([...])` whose `IDENT.has(` call site
// sits within a following window of the literal "NOT EXECUTED" -- then
// checks whether ANY of those banner-driving sets names all three tokens.
// Deliberately does not assume a specific identifier name, per the plan's
// own "do not assert a frozen member COUNT; assert membership by name"
// instruction -- a future fix might extend UNIMPLEMENTED_MUTATING_ORCHESTRATION
// or mint a differently-named set for room_content's own echo group; either
// satisfies this check.
// ---------------------------------------------------------------------------
function findBannerDrivingSetsContainingAll(source, tokens) {
  const setDeclRe = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+Set\s*\(\s*\[([^\]]*)\]\s*\)/g;
  const sets = {};
  let dm;
  while ((dm = setDeclRe.exec(source)) !== null) sets[dm[1]] = dm[2];

  const hasCallRe = /\b([A-Za-z_$][\w$]*)\.has\(/g;
  const bannerDriving = [];
  const WINDOW = 800;
  let hm;
  while ((hm = hasCallRe.exec(source)) !== null) {
    const ident = hm[1];
    if (!Object.prototype.hasOwnProperty.call(sets, ident)) continue;
    const window = source.slice(hm.index, hm.index + WINDOW);
    if (window.indexOf('NOT EXECUTED') !== -1) {
      bannerDriving.push({ ident, body: sets[ident] });
    }
  }

  const matches = bannerDriving.map((s) => ({
    ident: s.ident,
    body: s.body,
    hasAll: tokens.every((t) => s.body.indexOf("'" + t + "'") !== -1 || s.body.indexOf('"' + t + '"') !== -1),
  }));
  return matches;
}

(async function run() {
  process.stdout.write('Phase 276-03 Task 2: room_content honesty pin (F-11..F-14)\n');

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-276-03b-room-'));
  const session = spawnMcpSession(roomDir);

  let tools = [];
  let harnessOk = true;
  try {
    await session.init();
    tools = await session.listTools();
  } catch (e) {
    harnessOk = false;
    check('server answered the initialize/tools-list handshake (harness reached ground truth)', false,
      String(e && e.message || e) + ' stderr: ' + session.stderrTail());
  }
  if (harnessOk) {
    check('server answered the initialize/tools-list handshake (harness reached ground truth)', true);
  }

  const roomContentTool = tools.find((t) => t.name === 'room_content');
  check('the `room_content` tool registration was actually found', !!roomContentTool,
    'registered tools: ' + tools.map((t) => t.name).join(', '));

  if (!harnessOk || !roomContentTool) {
    session.cleanup();
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed (aborted: harness did not reach real registrations)\n');
    process.exit(1);
    return;
  }

  const description = typeof roomContentTool.description === 'string' ? roomContentTool.description : '';

  // ---------------------------------------------------------------------------
  // Group A: the WRITE-surface enumeration, measured over the wire.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP A: WRITE_SURFACE_ENUMERATION --\n');
  const writeSentenceMatch = /[^.]*WRITE surface[^.]*\./.exec(description);
  const writeSentence = writeSentenceMatch ? writeSentenceMatch[0] : '(no "WRITE surface" sentence found)';
  info('the WRITE-surface sentence measured over the wire', JSON.stringify(writeSentence));

  const FALSE_WRITE_TOKENS = [
    { label: 'new-project', re: /\bnew-project\b/ },
    { label: 'setup', re: /\bsetup\b/ },
    // Non-word-boundary guard: a bare \bupdate\b would ALSO match the
    // 'update' substring inside 'update-funding-stage' (a hyphen is a
    // non-word char, so \b fires right after "update"). The negative
    // lookahead excludes that legitimate compound command.
    { label: 'update', re: /\bupdate\b(?!-)/ },
    { label: 'invoke-persona', re: /\binvoke-persona\b/ },
  ];
  for (const tok of FALSE_WRITE_TOKENS) {
    check('A1: WRITE-surface sentence does NOT enumerate "' + tok.label + '" (it does not reach a write primitive, or is echo-only)',
      !tok.re.test(writeSentence),
      'sentence: ' + JSON.stringify(writeSentence));
  }

  const TRUE_WRITE_TOKENS = ['file-opportunity', 'create-funding', 'update-funding-stage', 'generate-personas'];
  for (const tok of TRUE_WRITE_TOKENS) {
    check('A2: description enumerates the genuine writer "' + tok + '"',
      description.indexOf(tok) !== -1,
      'description: ' + JSON.stringify(description));
  }

  check('A3: description retains the honest contrast clause distinguishing room_content from room_state',
    /room_state/.test(description) && /never mutates|READ|read-only/i.test(description),
    'description: ' + JSON.stringify(description));
  check('A3: description clears the ' + MIN_DESCRIPTION_CHARS + '-char instruction floor (test-234)',
    description.length >= MIN_DESCRIPTION_CHARS,
    'length=' + description.length);
  check('A3: description stays under the ' + HOST_DESCRIPTION_CAP_BYTES + '-byte host cap (test-234)',
    Buffer.byteLength(description, 'utf8') <= HOST_DESCRIPTION_CAP_BYTES,
    'bytes=' + Buffer.byteLength(description, 'utf8'));

  // ---------------------------------------------------------------------------
  // Group B: the NOT-EXECUTED banner on the echo group.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP B: NOT_EXECUTED_BANNER --\n');
  for (const command of ['new-project', 'setup', 'update']) {
    let text = '';
    try {
      text = await session.callTool('room_content', { command });
    } catch (e) {
      check('B0: room_content({command: "' + command + '"}) call succeeded', false, String(e && e.message || e));
      continue;
    }
    check('B1: room_content({command: "' + command + '"}) response carries the shipped NOT-EXECUTED banner',
      text.indexOf(NOT_EXECUTED_TEXT) !== -1,
      'response head: ' + JSON.stringify(text.slice(0, 300)));

    const MARKER_CANDIDATE_RE = /\*\*filed:\s*(?:true|false)\*\*|>\s*\*\*[A-Z][A-Z ]*\.\*\*/g;
    const candidates = text.match(MARKER_CANDIDATE_RE) || [];
    const unknownMarkers = candidates.filter((c) => c.indexOf(NO_WRITE_MARKER) === -1 && c.indexOf(NOT_EXECUTED_TEXT) === -1);
    check('B2: "' + command + '" response carries no third disclosure marker (subset of the two shipped ones)',
      unknownMarkers.length === 0,
      'all candidates: ' + JSON.stringify(candidates) + ', unknown: ' + JSON.stringify(unknownMarkers));
  }

  // ---------------------------------------------------------------------------
  // Group C: membership. A Set literal in the router source resolves to a
  // membership including new-project, setup and update, by NAME (not count).
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP C: MEMBERSHIP --\n');
  const routerSrc = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
  const bannerSets = findBannerDrivingSetsContainingAll(routerSrc, ['new-project', 'setup', 'update']);
  const anyMatch = bannerSets.some((s) => s.hasAll);
  check('C1: the Set that actually GATES the "NOT EXECUTED" banner text includes new-project, setup AND update, by name',
    anyMatch,
    'banner-driving sets found: ' + JSON.stringify(bannerSets.map((s) => s.ident)) +
    ' -- none of them name all three of new-project/setup/update today');

  // ---------------------------------------------------------------------------
  // Group D: invoke-persona is read-only and stays so (move-1-only fix).
  // Uses the checker's own exported resolveWritePrimitives()/
  // resolveReachability() against the REAL function body (via
  // Function.prototype.toString()), never a hand-rolled grep.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP D: INVOKE_PERSONA_READ_ONLY (detector-agreeing) --\n');
  const checker = require(path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs'));
  const personaOps = require(path.join(REPO_ROOT, 'lib', 'core', 'persona-ops.cjs'));
  const opportunityOps = require(path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs'));
  const primitives = checker.resolveWritePrimitives();

  function reachabilityOf(fn, absPath) {
    const src = fn.toString();
    return checker.resolveReachability(src, {
      primitives,
      fileText: src,
      filePath: absPath,
      repoRoot: REPO_ROOT,
      fileRequireMap: {},
      moduleCache: new Map(),
      bodyCache: new Map(),
    });
  }

  const personaOpsPath = path.join(REPO_ROOT, 'lib', 'core', 'persona-ops.cjs');
  const opportunityOpsPath = path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs');

  const invokePersonaVerdict = reachabilityOf(personaOps.invokePersona, personaOpsPath);
  check('D1: lib/core/persona-ops.cjs::invokePersona resolves NO_WRITE via the checker\'s own resolveReachability ' +
    '(it genuinely reads a persona file and returns it; only the description is wrong)',
    invokePersonaVerdict === 'NO_WRITE',
    'verdict=' + invokePersonaVerdict);

  // ---------------------------------------------------------------------------
  // Group E: the honest counterpoint. The four genuine writers still resolve
  // WRITES through the same checker API -- if any regresses to NO_WRITE or
  // UNKNOWN, that is a NEW finding and must fail loudly, not be silently
  // dropped from the WRITE-surface enumeration.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP E: GENUINE_WRITERS_STILL_WRITE (detector-agreeing) --\n');
  const GENUINE_WRITERS = [
    { name: 'file-opportunity', fn: opportunityOps.fileOpportunity, absPath: opportunityOpsPath },
    { name: 'create-funding', fn: opportunityOps.createFunding, absPath: opportunityOpsPath },
    { name: 'update-funding-stage', fn: opportunityOps.updateFundingStage, absPath: opportunityOpsPath },
    { name: 'generate-personas', fn: personaOps.generatePersonas, absPath: personaOpsPath },
  ];
  for (const w of GENUINE_WRITERS) {
    const verdict = reachabilityOf(w.fn, w.absPath);
    check('E1: "' + w.name + '" resolves WRITES via the checker\'s own resolveReachability (still a genuine writer)',
      verdict === 'WRITES',
      'verdict=' + verdict);
  }

  // ---------------------------------------------------------------------------
  // Group F: the A6 trace. Does fireCascade (called with the EXACT arguments
  // tool-router.cjs:770 passes for the new-project/setup/update echo group)
  // reach a leaf write? Traced against the real
  // lib/core/intelligence-cascade.cjs::runCascade, not assumed.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP F: A6_FIRECASCADE_TRACE (RESEARCH assumption, resolved) --\n');
  const intelligenceCascade = require(path.join(REPO_ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
  // Mirrors lib/mcp/tool-router.cjs:770's own call site exactly:
  //   await fireCascade(roomDir, command, section);
  // fireCascade (tool-router.cjs:580-588) then calls:
  //   runCascade(roomDir, { trigger: 'mcp-tool', filePath: '', section: section || '' });
  // because its 4th arg (`result`) is never passed at this call site, so
  // `(result && result.filePath) || ''` collapses to the empty string.
  const cascadeResult = await intelligenceCascade.runCascade(roomDir, {
    trigger: 'mcp-tool',
    filePath: '',
    section: '',
  });
  const reachesLeafWrite = cascadeResult.skipped !== true;
  info('A6 trace result', 'cascadeResult=' + JSON.stringify(cascadeResult));
  check('F1: A6 is measured, not assumed -- for the new-project/setup/update echo group\'s own call ' +
    'shape (tool-router.cjs:770, empty filePath), runCascade short-circuits at its own filePath guard ' +
    '(intelligence-cascade.cjs:648-652) BEFORE reaching any leaf write step, regardless of what those ' +
    'downstream steps (graph-index, hsi, git commit) would otherwise do',
    cascadeResult.skipped === true && cascadeResult.skipReason === 'no filePath provided',
    'skipped=' + cascadeResult.skipped + ' skipReason=' + cascadeResult.skipReason + ' reachesLeafWrite=' + reachesLeafWrite);

  session.cleanup();
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

  process.stdout.write(
    '\n  ' + passed + ' passed, ' + failed + ' failed' +
    ' (groups: A_WRITE_SURFACE_ENUMERATION, B_NOT_EXECUTED_BANNER, C_MEMBERSHIP,' +
    ' D_INVOKE_PERSONA_READ_ONLY, E_GENUINE_WRITERS_STILL_WRITE, F_A6_FIRECASCADE_TRACE)\n'
  );
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  process.stdout.write('\n  FATAL: ' + (err && err.stack || err) + '\n');
  process.exit(1);
});
