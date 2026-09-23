#!/usr/bin/env node
'use strict';

/*
 * Phase 358-09 (Rome B2, wave 3) -- RED-first proof for the Desktop/Cowork
 * MCP half of the room's governing question: question_read (unconditional
 * read) and question_set (write-gated exactly like claim_verify), a new
 * lib/mcp/tools/question.cjs.
 *
 * AUTHORED BEFORE lib/mcp/tools/question.cjs EXISTS. A red run right now
 * (no question_read/question_set registered) is the correct state, not a
 * defect -- same TDD discipline as tests/test-358-b1-surfaces.cjs, which this
 * file ports its harness pieces from (copied, never required -- a test file
 * never requires another test file).
 *
 * HARNESS STYLE: two legs.
 *   Stub legs (A1-A13): the registerAndCapture pattern (a stub server
 *   capturing every real registration, the ACTUAL captured handler invoked
 *   directly), extended with `server: { getClientVersion: () => currentClient
 *   }` so one registration can answer as claude-ai or an unrecognized host
 *   across different calls.
 *   Wire leg (B1): a real bin/mindrian-mcp-server.cjs child process, the same
 *   promise-based JSON-RPC client shape test-358-b1-surfaces.cjs uses,
 *   speaking as clientInfo.name 'claude-ai'.
 *
 * NEVER TRUST THE TOOL'S OWN SUCCESS CLAIM: every expected value (origin ids,
 * labels, card options, routing examples) is read from navigation.cjs or
 * lib/core/frame-provenance.cjs at test time, not hardcoded here twice.
 *
 * Canon Part 8: this file opens no external network surface; the wire leg
 * spawns a LOCAL child process only, under a hermetic mkdtemp HOME with
 * MINDRIAN_BRAIN_KEY unset.
 *
 * Run: node tests/test-358-b2-surfaces.cjs
 * Exit: non-zero while lib/mcp/tools/question.cjs is absent (RED, Task 1). 0
 * once every assertion group passes (GREEN, Task 3). No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { z } = require('zod');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const QUESTION_TOOL_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'question.cjs');
const CLAIM_VERIFY_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'claim-verify.cjs');

// Hermetic env, set BEFORE any lib module is required.
const HERMETIC_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-surfaces-home-'));
process.env.HOME = HERMETIC_HOME;
process.env.MINDRIAN_HOME = HERMETIC_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-surfaces-roomshome-'));
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_BRAIN_KEY;

const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let frameProvenance = null;
let frameProvenanceLoadError = null;
try {
  frameProvenance = require(path.join(REPO_ROOT, 'lib', 'core', 'frame-provenance.cjs'));
} catch (e) {
  frameProvenanceLoadError = e;
}
function requireDoor() {
  if (!frameProvenance) {
    throw new Error('lib/core/frame-provenance.cjs not landed: ' + (frameProvenanceLoadError && frameProvenanceLoadError.message));
  }
  return frameProvenance;
}

// test-234-tool-description-floor.cjs's own constants, reused verbatim.
const MIN_DESCRIPTION_CHARS = 120;
const HOST_DESCRIPTION_CAP_BYTES = 2048;

const Q1 = 'Which camera solves the delay?';
const Q2 = 'Which camera works with sunglasses?';
const Q3 = 'Should the checkpoint move north?';
const A2 = 'It assumed the delay was the camera, but the officers wear sunglasses.';

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

// ---------------------------------------------------------------------------
// Stub-server helpers (ported in shape from tests/test-358-b1-surfaces.cjs)
// ---------------------------------------------------------------------------

function makeTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-surfaces-room-'));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function registerAndCapture(roomDir) {
  const captured = new Map();
  let currentClient;
  const stubServer = {
    tool: (name, description, schema, handler) => {
      captured.set(name, { description, schema, handler });
    },
    server: { getClientVersion: () => currentClient },
  };
  const report = registerCoreTools(stubServer, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
  return { captured, setClient: (c) => { currentClient = c; }, report };
}

async function callTool(reg, params) {
  const raw = await reg.handler(params || {}, { sessionId: 'test-358-b2-surfaces' });
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  return { raw, result: text ? JSON.parse(text) : null };
}

// ---------------------------------------------------------------------------
// Raw room.db helpers -- never trust the tool's own success claim.
// ---------------------------------------------------------------------------

function openRaw(roomDir) {
  return navigation.openRoomDbForCaller(roomDir);
}
function closeRaw(db) {
  navigation.closeRoomDbForCaller(db);
}
function frameRoleRows(roomDir) {
  const db = openRaw(roomDir);
  try {
    return db.prepare(
      "SELECT id, properties, review_status FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).all();
  } finally {
    closeRaw(db);
  }
}
function allNodeProps(roomDir) {
  const db = openRaw(roomDir);
  try {
    return db.prepare('SELECT properties FROM nodes').all().map((r) => r.properties);
  } finally {
    closeRaw(db);
  }
}
function allEdgeProps(roomDir) {
  const db = openRaw(roomDir);
  try {
    return db.prepare('SELECT properties FROM edges').all().map((r) => r.properties);
  } finally {
    closeRaw(db);
  }
}
function edgeRows(roomDir, type) {
  const db = openRaw(roomDir);
  try {
    return db.prepare('SELECT source, target, properties FROM edges WHERE type = ?').all(type);
  } finally {
    closeRaw(db);
  }
}

// ---------------------------------------------------------------------------
// Wire-leg helpers (ported verbatim in shape from tests/test-358-b1-surfaces.cjs)
// ---------------------------------------------------------------------------

function spawnWireClient(env) {
  const proc = cp.spawn('node', [SERVER], { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'], env });
  const pending = new Map();
  let nextId = 1;
  let stdoutBuf = '';
  let stderrBuf = '';

  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch (_e) { continue; }
      if (!obj || obj.id === undefined || obj.id === null) continue;
      const resolver = pending.get(obj.id);
      if (resolver) {
        pending.delete(obj.id);
        resolver(obj);
      }
    }
  });
  proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });

  function request(method, params) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      try {
        proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      } catch (_e) {
        // the timeout in runWireLeg catches an unresolved pending entry.
      }
    });
  }

  function notify(method, params) {
    try {
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    } catch (_e) {
      // best effort
    }
  }

  function kill() {
    try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
  }

  return { request, notify, kill, getStderr: () => stderrBuf };
}

function toolPayload(response) {
  try {
    const content = response && response.result && response.result.content;
    if (!Array.isArray(content) || !content.length) return null;
    return JSON.parse(content[0].text);
  } catch (_e) {
    return null;
  }
}

function toolNames(response) {
  const tools = response && response.result && response.result.tools;
  return Array.isArray(tools) ? tools.map((t) => t.name) : [];
}

async function runWireLeg() {
  process.stdout.write('\n-- B1: live JSON-RPC drive against the real stdio server, as claude-ai --\n');
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-surfaces-wire-'));
  const room = path.join(tmpHome, 'room');
  fs.mkdirSync(room, { recursive: true });
  try {
    const boot = openRoomDb(room);
    closeRoomDb(boot);
  } catch (_e) {
    // the drive still runs; a missing room.db surfaces as no_room_db below.
  }

  const env = Object.assign({}, process.env, {
    HOME: tmpHome,
    MINDRIAN_HOME: tmpHome,
    MINDRIAN_TRANSPORT: 'stdio',
    MINDRIAN_ROOM: room,
    MINDRIAN_ROOMS_HOME: path.join(tmpHome, 'MindrianRooms'),
  });
  delete env.MINDRIAN_MCP_FIRST;
  delete env.CLAUDE_ACTIVE_ROOM;

  const client = spawnWireClient(env);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    client.kill();
  }, 30000);

  try {
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'claude-ai', version: '0.1.0' },
    });
    client.notify('notifications/initialized', {});

    const listResp = await client.request('tools/list', {});
    const names = toolNames(listResp);
    check('B1 wire: tools/list includes question_read', names.indexOf('question_read') !== -1);
    check('B1 wire: tools/list includes question_set', names.indexOf('question_set') !== -1);

    const setQ1 = await client.request('tools/call', {
      name: 'question_set',
      arguments: { text: Q1, origin: 'tasking' },
    });
    const setQ1Payload = toolPayload(setQ1);
    check('B1 wire: question_set Q1 tasking ok true as claude-ai',
      setQ1Payload && setQ1Payload.ok === true, JSON.stringify(setQ1Payload));

    const setQ2 = await client.request('tools/call', {
      name: 'question_set',
      arguments: { text: Q2, origin: 'chosen' },
    });
    const setQ2Payload = toolPayload(setQ2);
    check('B1 wire: question_set Q2 chosen without account returns change_needs_account with a card',
      setQ2Payload && setQ2Payload.ok === false && setQ2Payload.reason === 'change_needs_account' &&
      !!setQ2Payload.card, JSON.stringify(setQ2Payload));

    const readResp = await client.request('tools/call', { name: 'question_read', arguments: {} });
    const readPayload = toolPayload(readResp);
    const renderedQuestion = readPayload && readPayload.rendered && readPayload.rendered.question;
    check('B1 wire: question_read rendered.question first line is "A question change is waiting."',
      typeof renderedQuestion === 'string' && renderedQuestion.split('\n')[0] === 'A question change is waiting.',
      JSON.stringify(readPayload));
  } catch (e) {
    check('B1 wire: leg completed without throwing', false,
      String((e && e.stack) || e) + ' stderr: ' + client.getStderr().slice(-800));
  } finally {
    clearTimeout(timer);
    client.kill();
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (timedOut) check('B1 wire: leg did not time out (30s)', false, client.getStderr().slice(-800));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async function main() {
  process.stdout.write('Phase 358-09: RED-first proof for question_read and question_set\n\n');

  const room1 = makeTempRoom();
  const { captured: cap1, setClient: setClient1, report: report1 } = registerAndCapture(room1);

  // -- A1: registration captures both tools ----------------------------------
  check('A1: question_read captured on registration', cap1.has('question_read'));
  check('A1: question_set captured on registration', cap1.has('question_set'));
  check('A1: the registration report lists question.cjs with no failure',
    report1.registered.indexOf('question.cjs') !== -1 &&
    !report1.failed.some((f) => f.module === 'question.cjs'),
    JSON.stringify(report1));

  const readReg = cap1.get('question_read');
  const setReg = cap1.get('question_set');

  // -- A2: schemas -------------------------------------------------------------
  if (setReg && readReg) {
    const door = requireDoor();
    const SetSchema = z.object(setReg.schema);
    const originIds = navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id);

    const originField = setReg.schema.origin;
    const originOptions = originField && typeof originField.unwrap === 'function'
      ? originField.unwrap().options : (originField && originField.options);
    check('A2: origin enum values equal FRAME_ORIGINS_ORDERED ids in order',
      Array.isArray(originOptions) && JSON.stringify(originOptions) === JSON.stringify(originIds),
      JSON.stringify(originOptions));

    const baseSet = { text: Q1, origin: originIds[0] };
    check('A2: schema rejects text of 1001 characters',
      !SetSchema.safeParse(Object.assign({}, baseSet, { text: 'x'.repeat(1001) })).success);
    check('A2: schema accepts text of 1000 characters',
      SetSchema.safeParse(Object.assign({}, baseSet, { text: 'x'.repeat(1000) })).success);
    check('A2: schema rejects account of 4001 characters',
      !SetSchema.safeParse(Object.assign({}, baseSet, { account: 'x'.repeat(4001) })).success);
    check('A2: schema accepts account of 4000 characters',
      SetSchema.safeParse(Object.assign({}, baseSet, { account: 'x'.repeat(4000) })).success);
    check('A2: schema rejects relocate as a non-boolean',
      !SetSchema.safeParse(Object.assign({}, baseSet, { relocate: 'yes' })).success);
    check('A2: schema accepts relocate true',
      SetSchema.safeParse(Object.assign({}, baseSet, { relocate: true })).success);
    check('A2: schema rejects cancel as a non-boolean',
      !SetSchema.safeParse(Object.assign({}, baseSet, { cancel: 'yes' })).success);
    check('A2: schema accepts cancel true',
      SetSchema.safeParse(Object.assign({}, baseSet, { cancel: true })).success);
    check('A2: schema rejects based_on_version 0',
      !SetSchema.safeParse(Object.assign({}, baseSet, { based_on_version: 0 })).success);
    check('A2: schema rejects based_on_version -1',
      !SetSchema.safeParse(Object.assign({}, baseSet, { based_on_version: -1 })).success);
    check('A2: schema rejects based_on_version 1.5',
      !SetSchema.safeParse(Object.assign({}, baseSet, { based_on_version: 1.5 })).success);
    check('A2: schema accepts based_on_version 1',
      SetSchema.safeParse(Object.assign({}, baseSet, { based_on_version: 1 })).success);

    const ReadSchema = z.object(readReg.schema);
    check('A2: question_read schema accepts {}', ReadSchema.safeParse({}).success);
    check('A2: question_read schema accepts {history:false}', ReadSchema.safeParse({ history: false }).success);
  } else {
    check('A2: question_set and question_read both captured (schema checks skipped)', false);
  }

  // -- A3: descriptions ----------------------------------------------------------
  const setDesc = setReg ? setReg.description : '';
  const readDesc = readReg ? readReg.description : '';

  function proseChecks(label, d) {
    check(label + ': length >= ' + MIN_DESCRIPTION_CHARS, (d || '').length >= MIN_DESCRIPTION_CHARS,
      'len=' + (d || '').length);
    check(label + ': byte length <= ' + HOST_DESCRIPTION_CAP_BYTES,
      Buffer.byteLength(d || '', 'utf8') <= HOST_DESCRIPTION_CAP_BYTES);
    check(label + ': starts with a capital', /^[A-Z]/.test(d || ''));
    check(label + ': ends with a sentence terminator', /[.!?]['"”\]]*$/.test((d || '').trim()));
    check(label + ': carries no em-dash', (d || '').indexOf(String.fromCharCode(8212)) === -1);
    check(label + ': never uses a ranking word',
      !/\b(better|improv\w*|upgrad\w*|abandon\w*|correct(ed|ion)|superseded)\b/i.test(d || ''));
  }
  proseChecks('A3 question_set description', setDesc);
  proseChecks('A3 question_read description', readDesc);

  if (frameProvenance) {
    const originIds = navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id);
    const missingOrigins = originIds.filter((id) => setDesc.indexOf(id) === -1);
    check('A3: question_set description names every origin id', missingOrigins.length === 0,
      'missing: ' + missingOrigins.join(', '));
    const missingChange = frameProvenance.QUESTION_TURN_EXAMPLES.change.filter((p) => setDesc.indexOf(p) === -1);
    check('A3: question_set description quotes every QUESTION_TURN_EXAMPLES.change phrase',
      missingChange.length === 0, 'missing: ' + missingChange.join(' | '));
    check('A3: question_set description says not for an ordinary question',
      setDesc.indexOf('not for an ordinary question') !== -1);

    const missingAsk = frameProvenance.QUESTION_TURN_EXAMPLES.ask.filter((p) => readDesc.indexOf(p) === -1);
    check('A3: question_read description quotes every QUESTION_TURN_EXAMPLES.ask phrase',
      missingAsk.length === 0, 'missing: ' + missingAsk.join(' | '));
    check('A3: question_read description ends with "This tool writes nothing."',
      readDesc.trim().endsWith('This tool writes nothing.'));
  } else {
    check('A3: lib/core/frame-provenance.cjs landed (origin/example checks skipped)', false);
  }

  // -- A4: Desktop write (claude-ai) --------------------------------------------
  if (setReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });
    const a4 = await callTool(setReg, { text: Q1, origin: 'tasking' });
    check('A4: question_set Q1 tasking ok true', a4.result && a4.result.ok === true, JSON.stringify(a4.result));
    check('A4: result is first', a4.result && a4.result.result === 'first');
    check('A4: version is 1', a4.result && a4.result.version === 1);
    const host4 = a4.result && a4.result.host;
    check('A4: host.client_name is claude-ai', host4 && host4.client_name === 'claude-ai');
    check('A4: host.host is claude-desktop', host4 && host4.host === 'claude-desktop');
    check('A4: host.write_path_enabled is true', host4 && host4.write_path_enabled === true);
  } else {
    check('A4: question_set captured (Desktop write leg skipped)', false);
  }

  // -- A5: the pause -------------------------------------------------------------
  if (setReg) {
    const door = requireDoor();
    setClient1({ name: 'claude-ai', version: '0.1.0' });
    const a5 = await callTool(setReg, { text: Q2, origin: 'chosen', based_on_version: 1 });
    const r5 = a5.result;
    check('A5: ok false', r5 && r5.ok === false);
    check('A5: reason change_needs_account', r5 && r5.reason === 'change_needs_account');
    check('A5: the pause is not a failure (no isError flag)', a5.raw && a5.raw.isError === undefined);
    check('A5: ask is exactly QUESTION_ASK', r5 && r5.ask === door.QUESTION_ASK);
    check('A5: previous.version is 1', r5 && r5.previous && r5.previous.version === 1);
    check('A5: previous.text is Q1', r5 && r5.previous && r5.previous.text === Q1);
    check('A5: proposed.text is Q2', r5 && r5.proposed && r5.proposed.text === Q2);
    check('A5: pending is true', r5 && r5.pending === true);
    check('A5: card.shape is F.1', r5 && r5.card && r5.card.shape === 'F.1');
    check('A5: card.options first three equal QUESTION_CARD_OPTIONS',
      r5 && r5.card && Array.isArray(r5.card.options) &&
      JSON.stringify(r5.card.options.slice(0, 3)) === JSON.stringify(Array.from(door.QUESTION_CARD_OPTIONS)),
      JSON.stringify(r5 && r5.card && r5.card.options));
    check('A5: card.askuserquestion_marker is the frozen F.1 verbs=4 marker',
      r5 && r5.card && r5.card.askuserquestion_marker === '[AskUserQuestion contract: shape=F.1 verbs=4]',
      JSON.stringify(r5 && r5.card));
    check('A5: rendered.card contains the ask',
      r5 && typeof r5.rendered === 'object' && typeof r5.rendered.card === 'string' &&
      r5.rendered.card.indexOf(door.QUESTION_ASK) !== -1);
    check('A5: next mentions account, relocate and Never write the account yourself',
      r5 && typeof r5.next === 'string' && /account/.test(r5.next) && /relocate/.test(r5.next) &&
      r5.next.indexOf('Never write the account yourself') !== -1, r5 && r5.next);
    check('A5: raw role row count is still 1', frameRoleRows(room1).length === 1);
  } else {
    check('A5: question_set captured (the pause leg skipped)', false);
  }

  // -- A6: waiting ask first, on ANY host ----------------------------------------
  if (readReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });
    const a6a = await callTool(readReg, {});
    const r6a = a6a.result;
    check('A6: question_read (claude-ai) ok true', r6a && r6a.ok === true);
    const rendered6a = r6a && r6a.rendered && r6a.rendered.question;
    check('A6: rendered.question first line (claude-ai) is "A question change is waiting."',
      typeof rendered6a === 'string' && rendered6a.split('\n')[0] === 'A question change is waiting.');
    check('A6: pending.text (claude-ai) is Q2', r6a && r6a.pending && r6a.pending.text === Q2);
    check('A6: pending.card.shape (claude-ai) is F.1', r6a && r6a.pending && r6a.pending.card && r6a.pending.card.shape === 'F.1');
    check('A6: current.version (claude-ai) is 1', r6a && r6a.current && r6a.current.version === 1);
    check('A6: current.origin (claude-ai) is tasking', r6a && r6a.current && r6a.current.origin === 'tasking');
    check('A6: origins length is 4 (claude-ai)', r6a && Array.isArray(r6a.origins) && r6a.origins.length === 4);
    const missingLabels6a = navigation.FRAME_ORIGINS_ORDERED.filter(
      (o) => !(r6a.origins || []).some((x) => x.id === o.id && x.label === o.label)
    );
    check('A6: every origin renders with its frameOriginInfo label (claude-ai)', missingLabels6a.length === 0,
      JSON.stringify(missingLabels6a));

    setClient1({ name: 'some-other-client', version: '1' });
    const a6b = await callTool(readReg, {});
    const r6b = a6b.result;
    check('A6: question_read (some-other-client) ok true', r6b && r6b.ok === true);
    const rendered6b = r6b && r6b.rendered && r6b.rendered.question;
    check('A6: rendered.question first line (some-other-client) is "A question change is waiting."',
      typeof rendered6b === 'string' && rendered6b.split('\n')[0] === 'A question change is waiting.');
    check('A6: pending.card.shape (some-other-client) is F.1', r6b && r6b.pending && r6b.pending.card && r6b.pending.card.shape === 'F.1');
    check('A6: current.version (some-other-client) is 1', r6b && r6b.current && r6b.current.version === 1);
  } else {
    check('A6: question_read captured (waiting-ask leg skipped)', false);
  }

  // -- A7: refines -----------------------------------------------------------------
  if (setReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });
    const a7 = await callTool(setReg, { text: Q2, origin: 'chosen', based_on_version: 1, account: A2 });
    const r7 = a7.result;
    check('A7: ok true', r7 && r7.ok === true, JSON.stringify(r7));
    check('A7: result refines', r7 && r7.result === 'refines');
    check('A7: version 2', r7 && r7.version === 2);
    check('A7: account_text echoed equal to A2', r7 && r7.account_text === A2);
    check('A7: rendered.question contains the refines change line',
      r7 && typeof r7.rendered === 'object' && typeof r7.rendered.question === 'string' &&
      r7.rendered.question.indexOf('Change: refines version 1 (account on file)') !== -1);

    const rows7 = frameRoleRows(room1);
    const v2Row = rows7.find((row) => {
      try { return JSON.parse(row.properties).version === 2; } catch (_e) { return false; }
    });
    check('A7: raw v2 frame row exists with change_kind refines',
      !!v2Row && JSON.parse(v2Row.properties).change_kind === 'refines', JSON.stringify(v2Row));
    const refinesEdges = edgeRows(room1, 'REFINES');
    check('A7: exactly one REFINES edge v2 -> v1', refinesEdges.length === 1, JSON.stringify(refinesEdges));
  } else {
    check('A7: question_set captured (refines leg skipped)', false);
  }

  // -- A8: relocates -----------------------------------------------------------------
  if (setReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });
    const a8 = await callTool(setReg, { text: Q3, origin: 'prompt', relocate: true });
    const r8 = a8.result;
    check('A8: ok true', r8 && r8.ok === true, JSON.stringify(r8));
    check('A8: result relocates', r8 && r8.result === 'relocates');
    check('A8: version 3', r8 && r8.version === 3);

    const followsEdges = edgeRows(room1, 'FOLLOWS_FROM');
    check('A8: exactly one FOLLOWS_FROM edge v3 -> v2', followsEdges.length === 1, JSON.stringify(followsEdges));
  } else {
    check('A8: question_set captured (relocates leg skipped)', false);
  }

  // -- A9: unknown host refused ---------------------------------------------------
  if (setReg) {
    const beforeCount = frameRoleRows(room1).length;
    setClient1({ name: 'some-other-client', version: '1' });
    const a9 = await callTool(setReg, { text: 'Another question?', origin: 'chosen', relocate: true });
    const r9 = a9.result;
    check('A9: ok false', r9 && r9.ok === false);
    check('A9: reason write_path_disabled', r9 && r9.reason === 'write_path_disabled');
    check('A9: raw carries isError true', a9.raw && a9.raw.isError === true);
    check('A9: host.client_name is some-other-client', r9 && r9.host && r9.host.client_name === 'some-other-client');
    check('A9: hint names MINDRIAN_MCP_FIRST',
      r9 && typeof r9.hint === 'string' && r9.hint.indexOf('MINDRIAN_MCP_FIRST') !== -1);
    check('A9: raw role row count unchanged', frameRoleRows(room1).length === beforeCount);
  } else {
    check('A9: question_set captured (unknown-host leg skipped)', false);
  }

  // -- A10: explicit choice only ----------------------------------------------------
  if (setReg && readReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });

    const a10a = await callTool(setReg, {
      text: 'A brand new question, is it not?', origin: 'chosen', account: 'some account', relocate: true,
    });
    check('A10: account plus relocate returns ambiguous_change', a10a.result && a10a.result.ok === false &&
      a10a.result.reason === 'ambiguous_change', JSON.stringify(a10a.result));
    check('A10: ambiguous_change carries isError true', a10a.raw && a10a.raw.isError === true);

    const a10b = await callTool(setReg, {
      text: 'A checkpoint relocation question?', origin: 'chosen', based_on_version: 3,
    });
    check('A10: setup - a real pending change is refused change_needs_account',
      a10b.result && a10b.result.ok === false && a10b.result.reason === 'change_needs_account',
      JSON.stringify(a10b.result));

    const a10c = await callTool(setReg, { cancel: true });
    check('A10: cancel returns result cancelled', a10c.result && a10c.result.ok === true &&
      a10c.result.result === 'cancelled', JSON.stringify(a10c.result));

    const a10d = await callTool(readReg, {});
    check('A10: question_read shows no pending after cancel',
      a10d.result && a10d.result.ok === true && a10d.result.pending === null, JSON.stringify(a10d.result));
  } else {
    check('A10: question_set and question_read both captured (explicit-choice leg skipped)', false);
  }

  // -- A11: Part 8 at the surface -----------------------------------------------
  const rowsA11 = frameRoleRows(room1);
  check('A11: every frame role row review_status is proposed',
    rowsA11.length > 0 && rowsA11.every((r) => r.review_status === 'proposed'), JSON.stringify(rowsA11));
  const proseNeedles = [Q1, Q2, Q3, A2];
  const nodeProps = allNodeProps(room1);
  const edgeProps = allEdgeProps(room1);
  const leaked = [];
  for (const needle of proseNeedles) {
    for (const p of nodeProps) {
      if (typeof p === 'string' && p.indexOf(needle) !== -1) leaked.push('node:' + needle);
    }
    for (const p of edgeProps) {
      if (typeof p === 'string' && p.indexOf(needle) !== -1) leaked.push('edge:' + needle);
    }
  }
  check('A11: no node or edge property leaks Q1/Q2/Q3/A2 prose', leaked.length === 0, leaked.join(', '));

  // -- A12: static -----------------------------------------------------------------
  if (fs.existsSync(QUESTION_TOOL_PATH)) {
    const source = fs.readFileSync(QUESTION_TOOL_PATH, 'utf8');
    const lines = source.split('\n');
    function isCommentLine(line) {
      const t = line.trim();
      return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
    }
    const nonCommentLines = lines.filter((l) => !isCommentLine(l));
    const stripped = nonCommentLines.join('\n');

    const ALLOWED_REQUIRES = new Set([
      'zod', '../../core/navigation.cjs', '../../core/frame-provenance.cjs',
      '../../core/session-binding.cjs', '../session-room.cjs', './claim-verify.cjs',
    ]);
    const requireMatches = [...stripped.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    const disallowedRequires = requireMatches.filter((m) => !ALLOWED_REQUIRES.has(m));
    check('A12: question.cjs requires only the six allowed modules', disallowedRequires.length === 0,
      disallowedRequires.join(', '));
    check('A12: no node:sqlite/room-db/brain/network module in question.cjs',
      !/node:sqlite|room-db|brain|DatabaseSync|node:http|node:https|node:net|\bfetch\(/i.test(stripped));
    check('A12: no non-comment pickShape call in question.cjs', !/pickShape/.test(stripped));
    check('A12: no quoted origin-id literal "tasking" in question.cjs', !/['"]tasking['"]/.test(stripped));
    check('A12: no quoted origin-id literal "inherited" in question.cjs', !/['"]inherited['"]/.test(stripped));
    check('A12: no em-dash in question.cjs', source.indexOf(String.fromCharCode(8212)) === -1);

    const questionModule = require(QUESTION_TOOL_PATH);
    const connectors = Array.isArray(questionModule.connectors) ? questionModule.connectors : [];
    const readConnector = connectors.find((c) => c.tool === 'question_read');
    const setConnector = connectors.find((c) => c.tool === 'question_set');
    check('A12: question_read connector hitl_shape none, layer harness, hitl_why/layer_why non-empty',
      !!readConnector && readConnector.hitl_shape === 'none' && readConnector.layer === 'harness' &&
      typeof readConnector.hitl_why === 'string' && readConnector.hitl_why.length > 0 &&
      typeof readConnector.layer_why === 'string' && readConnector.layer_why.length > 0);
    check('A12: question_set connector hitl_shape F.1, layer harness, hitl_why/layer_why non-empty',
      !!setConnector && setConnector.hitl_shape === 'F.1' && setConnector.layer === 'harness' &&
      typeof setConnector.hitl_why === 'string' && setConnector.hitl_why.length > 0 &&
      typeof setConnector.layer_why === 'string' && setConnector.layer_why.length > 0);

    const claimVerifyModule = require(CLAIM_VERIFY_PATH);
    check('A12: claim-verify.cjs exports a hostBlock function', typeof claimVerifyModule.hostBlock === 'function');
  } else {
    check('A12: lib/mcp/tools/question.cjs exists (static checks skipped)', false);
  }

  // -- A13: tool-honesty scanAll ------------------------------------------------
  const toolHonesty = require(path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs'));
  const scanResult = toolHonesty.scanAll();
  const b2Rows = scanResult.rows.filter((r) => r.tool === 'question_read' || r.tool === 'question_set');
  check('A13: question_read row present in scanAll', b2Rows.some((r) => r.tool === 'question_read'));
  check('A13: question_set row present in scanAll', b2Rows.some((r) => r.tool === 'question_set'));
  check('A13: every question_read/question_set row has verdict OK',
    b2Rows.length > 0 && b2Rows.every((r) => r.verdict === 'OK'), JSON.stringify(b2Rows));

  // -- B1: the real stdio wire, as the actual Claude Desktop client ------------
  await runWireLeg();

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  process.stdout.write('FATAL: ' + ((e && e.stack) || e) + '\n');
  process.exit(1);
});
