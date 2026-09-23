#!/usr/bin/env node
'use strict';

/*
 * Phase 358-04 (Rome B1, wave 3) -- RED-first proof for the Desktop/Cowork
 * MCP surface: claim_verify (rung, checked_by_id, resolves_dispute, an
 * honest host block on refusal) and the new claim_read tool (claim view by
 * id or words, claim list, room portrait, plain-text render), plus the real
 * stdio wire as the actual Claude Desktop client identity (claude-ai).
 *
 * AUTHORED BEFORE claim_read EXISTS and BEFORE claim_verify carries rung /
 * checked_by_id / the host block. A red run right now (missing claim_read,
 * schema accepting no rung, short descriptions, no host block) is the
 * correct state, not a defect -- same TDD discipline as
 * tests/test-276-claim-write-primitive.cjs.
 *
 * HARNESS STYLE: two legs.
 *   Stub legs (A1-A11): tests/test-276-claim-write-primitive.cjs's own
 *   registerAndCapture pattern (a stub server capturing every real
 *   registration, the ACTUAL captured handler invoked directly), extended
 *   with `server: { getClientVersion: () => currentClient }` so one
 *   registration can answer as claude-ai, an unrecognized host, or an
 *   undefined pre-initialize client across different calls.
 *   Wire leg (B1): a real `bin/mindrian-mcp-server.cjs` child process, a
 *   small promise-based JSON-RPC client (ported in shape from
 *   tests/test-234-tool-description-floor.cjs / test-270-tool-schema-
 *   budget.cjs's stdio drives), speaking as clientInfo.name 'claude-ai' --
 *   the actual Claude Desktop identity, per the 358-02 host-tier fix.
 *
 * NEVER TRUST THE TOOL'S OWN SUCCESS CLAIM. A9's review_status/confidence
 * assertions independently re-open room.db with node:sqlite and read the raw
 * row back after every claim_verify call in A4 and A8, rather than trusting
 * a response's own `ok:true`.
 *
 * Canon Part 8: this file opens no external network surface; the wire leg
 * spawns a LOCAL child process only, under a hermetic mkdtemp HOME with
 * MINDRIAN_BRAIN_KEY unset.
 *
 * NEGATION_PATTERNS below is TRANSCRIBED independently from
 * scripts/check-tool-honesty.cjs (which does not export it), so this file
 * can never pass a negation check by trusting a table the scanner exports
 * about itself.
 *
 * Run: node tests/test-358-b1-surfaces.cjs
 * Exit: non-zero while claim_read is absent and claim_verify lacks rung
 * (RED, Task 1). 0 once every assertion group passes (GREEN, Task 2). No
 * em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { z } = require('zod');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const CLAIM_VERIFY_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'claim-verify.cjs');

// Hermetic env, set BEFORE any lib module is required (fresh mkdtemp HOME so
// a real ~/MindrianRooms registry on a dev machine never redirects this
// test's writes into someone's actual room).
const HERMETIC_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-surfaces-home-'));
process.env.HOME = HERMETIC_HOME;
process.env.MINDRIAN_HOME = HERMETIC_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-surfaces-roomshome-'));
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.CLAUDE_ACTIVE_ROOM;

const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

// test-234-tool-description-floor.cjs's own constants, reused verbatim.
const MIN_DESCRIPTION_CHARS = 120;
const HOST_DESCRIPTION_CAP_BYTES = 2048;

// scripts/check-tool-honesty.cjs:1049-1080 -- transcribed, not required, so
// a description rewrite can never pass this check by trusting the scanner's
// own table about itself.
const NEGATION_PATTERNS = [
  /\bwrites?\s+nothing\b/i,
  /\bdoes\s+not\s+write\b/i,
  /\bnever\s+writes?\b/i,
  /\bnothing\s+is\s+written\b/i,
  /\bno\s+writes?\s+occurs?\b/i,
  /\breference\s+only\b/i,
  /\bnothing\s+is\s+persisted\b/i,
];

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
// Stub-server helpers (ported in shape from test-276-claim-write-primitive.cjs)
// ---------------------------------------------------------------------------

function makeTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-surfaces-room-'));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function roomDbPath(dir) {
  return path.join(dir, '.mindrian', 'room.db');
}

function readNodeRaw(dbPath, id) {
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare('SELECT review_status, confidence FROM nodes WHERE id = ?').get(id);
    return row ? { reviewStatus: row.review_status, confidence: row.confidence } : null;
  } finally {
    db.close();
  }
}

// registerAndCapture(roomDir) -- one registration; a mutable currentClient
// lets every subsequent stub leg answer as a different clientInfo without
// re-registering (the handlers read server.server.getClientVersion() live,
// at call time, the same way the real MCP SDK does).
function registerAndCapture(roomDir) {
  const captured = new Map();
  let currentClient;
  const stubServer = {
    tool: (name, description, schema, handler) => {
      captured.set(name, { description, schema, handler });
    },
    server: { getClientVersion: () => currentClient },
  };
  registerCoreTools(stubServer, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
  return { captured, setClient: (c) => { currentClient = c; } };
}

async function callTool(reg, params) {
  const raw = await reg.handler(params, { sessionId: 'test-358-surfaces' });
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  return { raw, result: text ? JSON.parse(text) : null };
}

function deepKeys(value, acc) {
  acc = acc || [];
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((v) => deepKeys(v, acc));
    } else {
      Object.keys(value).forEach((k) => {
        acc.push(k);
        deepKeys(value[k], acc);
      });
    }
  }
  return acc;
}

function deepStrings(value, acc) {
  acc = acc || [];
  if (typeof value === 'string') {
    acc.push(value);
  } else if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((v) => deepStrings(v, acc));
    } else {
      Object.keys(value).forEach((k) => deepStrings(value[k], acc));
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Wire-leg helpers (ported in shape from test-234-tool-description-floor.cjs
// and test-270-tool-schema-budget.cjs's stdio drives)
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
        // the exit handler below reports; pending stays unresolved and the
        // overall 30-second timeout in runWireLeg catches it.
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
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-surfaces-wire-'));
  const room = path.join(tmpHome, 'room');
  fs.mkdirSync(room, { recursive: true });
  try {
    const boot = openRoomDb(room);
    closeRoomDb(boot);
  } catch (_e) {
    // the drive still runs; a missing room.db surfaces as no_room_db below,
    // a distinct outcome from write_path_disabled or a missing tool.
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
    check('B1 wire: tools/list includes claim_write', names.indexOf('claim_write') !== -1);
    check('B1 wire: tools/list includes claim_verify', names.indexOf('claim_verify') !== -1);
    check('B1 wire: tools/list includes claim_read', names.indexOf('claim_read') !== -1);

    const writeResp = await client.request('tools/call', {
      name: 'claim_write',
      arguments: {
        knowledge_type: 'fact',
        text: 'The bridge at grid 42 is passable.',
        source_segment: 'b1-358-wire-bridge',
      },
    });
    const writePayload = toolPayload(writeResp);
    check('B1 wire: claim_write ok true as claude-ai', writePayload && writePayload.ok === true,
      JSON.stringify(writePayload));
    const nodeId = writePayload && writePayload.node_id;

    const verifyResp = nodeId ? await client.request('tools/call', {
      name: 'claim_verify',
      arguments: {
        claim_id: nodeId,
        against_id: 'field note, exercise 02',
        against_kind: 'observation',
        rung: 3,
        method: 'compare',
        result: 'contradicts',
      },
    }) : null;
    const verifyPayload = toolPayload(verifyResp);
    check('B1 wire: claim_verify ok true as claude-ai (no MINDRIAN_MCP_FIRST set)',
      verifyPayload && verifyPayload.ok === true, JSON.stringify(verifyPayload));

    const readResp = await client.request('tools/call', {
      name: 'claim_read',
      arguments: { query: 'bridge' },
    });
    const readPayload = toolPayload(readResp);
    const records = readPayload && readPayload.claim && readPayload.claim.checking_record &&
      readPayload.claim.checking_record.records;
    check('B1 wire: claim_read shows the record with rung 3',
      Array.isArray(records) && records.some((r) => r.rung === 3), JSON.stringify(readPayload));

    const statusResp = await client.request('tools/call', { name: 'status_read', arguments: {} });
    const statusPayload = toolPayload(statusResp);
    const capFloor = statusPayload && statusPayload.segments && statusPayload.segments.capability_floor;
    check('B1 wire: status_read capability_floor.host_tier.host is claude-desktop',
      capFloor && capFloor.host_tier && capFloor.host_tier.host === 'claude-desktop');
    check('B1 wire: status_read capability_floor.write_path_enabled is true',
      capFloor && capFloor.write_path_enabled === true);
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
  process.stdout.write('Phase 358-04: RED-first proof for claim_verify (rung) and claim_read\n\n');

  const room1 = makeTempRoom();
  const room1DbPath = roomDbPath(room1);
  const { captured: cap1, setClient: setClient1 } = registerAndCapture(room1);

  // -- A1: registration captures both tools --------------------------------
  check('A1: claim_verify captured on registration', cap1.has('claim_verify'));
  check('A1: claim_read captured on registration', cap1.has('claim_read'));

  const verifyReg = cap1.get('claim_verify');
  const readReg = cap1.get('claim_read');

  // -- A2: claim_verify schema (rung required, resolves_dispute optional) --
  if (verifyReg) {
    const VerifySchema = z.object(verifyReg.schema);
    const baseArgs = {
      claim_id: 'claim:x:1', against_id: 'a', against_kind: 'observation',
      method: 'compare', result: 'contradicts',
    };
    check('A2: schema rejects claim_verify args without rung',
      !VerifySchema.safeParse(baseArgs).success);
    check('A2: schema rejects rung 0',
      !VerifySchema.safeParse(Object.assign({}, baseArgs, { rung: 0 })).success);
    check('A2: schema rejects rung VERIFICATION_RUNGS.length + 1',
      !VerifySchema.safeParse(Object.assign({}, baseArgs, {
        rung: navigation.VERIFICATION_RUNGS.length + 1,
      })).success);
    check('A2: schema rejects rung 2.5',
      !VerifySchema.safeParse(Object.assign({}, baseArgs, { rung: 2.5 })).success);
    check('A2: schema accepts rung 3',
      VerifySchema.safeParse(Object.assign({}, baseArgs, { rung: 3 })).success);
    check('A2: resolves_dispute is an optional boolean (present true)',
      VerifySchema.safeParse(Object.assign({}, baseArgs, { rung: 3, resolves_dispute: true })).success);
    check('A2: resolves_dispute is an optional boolean (absent)',
      VerifySchema.safeParse(Object.assign({}, baseArgs, { rung: 3 })).success);
    check('A2: resolves_dispute rejects a non-boolean',
      !VerifySchema.safeParse(Object.assign({}, baseArgs, { rung: 3, resolves_dispute: 'yes' })).success);

    const rungField = verifyReg.schema.rung;
    const rungDesc = rungField && typeof rungField.description === 'string' ? rungField.description : '';
    const missingLabels = navigation.VERIFICATION_RUNGS.filter((r) => rungDesc.indexOf(r.label) === -1);
    check('A2: rung field description contains every VERIFICATION_RUNGS label',
      !!rungField && missingLabels.length === 0,
      missingLabels.length ? 'missing: ' + missingLabels.map((r) => r.label).join(' | ') : 'no rung field');
  } else {
    check('A2: claim_verify captured (schema checks skipped)', false);
  }

  // -- A3: description floor + tool-honesty prose shape ---------------------
  const verifyDesc = verifyReg ? verifyReg.description : '';
  const readDesc = readReg ? readReg.description : '';

  function proseChecks(label, d) {
    check(label + ': length >= ' + MIN_DESCRIPTION_CHARS, (d || '').length >= MIN_DESCRIPTION_CHARS,
      'len=' + (d || '').length);
    check(label + ': byte length <= ' + HOST_DESCRIPTION_CAP_BYTES,
      Buffer.byteLength(d || '', 'utf8') <= HOST_DESCRIPTION_CAP_BYTES);
    check(label + ': starts with a capital', /^[A-Z]/.test(d || ''));
    check(label + ': ends with a sentence terminator', /[.!?]['"”)\]]*$/.test((d || '').trim()));
    check(label + ': carries no em-dash', (d || '').indexOf(String.fromCharCode(8212)) === -1);
    check(label + ': never claims the word verified', !/\bverified\b/i.test(d || ''));
  }
  proseChecks('A3 claim_verify description', verifyDesc);
  proseChecks('A3 claim_read description', readDesc);

  check('A3: claim_verify description mentions review_status', /review_status/.test(verifyDesc));
  check('A3: claim_verify description mentions gate_answer', /gate_answer/.test(verifyDesc));
  check('A3: claim_verify description matches no NEGATION_PATTERNS (it DOES write)',
    !NEGATION_PATTERNS.some((re) => re.test(verifyDesc)));
  check('A3: claim_read description mentions checked, disputed, inconclusive, unchecked',
    /checked/.test(readDesc) && /disputed/.test(readDesc) &&
    /inconclusive/.test(readDesc) && /unchecked/.test(readDesc));
  check('A3: claim_read description ends with the recognized disclaimer sentence',
    readDesc.indexOf('This tool writes nothing.') !== -1);

  // -- A4: Desktop write path (claude-ai) -----------------------------------
  const writeReg = cap1.get('claim_write');
  let bridgeNodeId = null;
  let baselineRaw = null;

  if (writeReg && verifyReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });

    const writeResult = await callTool(writeReg, {
      knowledge_type: 'fact',
      text: 'The bridge at grid 42 is passable.',
      source_segment: 'b1-358-bridge',
    });
    check('A4: claim_write succeeds on Claude Desktop (claude-ai)',
      writeResult.result && writeResult.result.ok === true, JSON.stringify(writeResult.result));
    bridgeNodeId = writeResult.result && writeResult.result.node_id;
    if (bridgeNodeId) baselineRaw = readNodeRaw(room1DbPath, bridgeNodeId);

    const verifyResult = bridgeNodeId ? await callTool(verifyReg, {
      claim_id: bridgeNodeId,
      against_id: 'field note, exercise 02',
      against_kind: 'observation',
      rung: 3,
      method: 'compare',
      result: 'contradicts',
    }) : { result: null };
    check('A4: claim_verify ok true on Claude Desktop',
      verifyResult.result && verifyResult.result.ok === true, JSON.stringify(verifyResult.result));
    check('A4: review_status stays proposed',
      verifyResult.result && verifyResult.result.review_status === 'proposed');
    check('A4: claim.checking_record.status disputed',
      verifyResult.result && verifyResult.result.claim &&
      verifyResult.result.claim.checking_record.status === 'disputed');
    check('A4: rendered text contains "Confirmation status: proposed"',
      verifyResult.result && typeof verifyResult.result.rendered === 'string' &&
      verifyResult.result.rendered.indexOf('Confirmation status: proposed') !== -1);

    const storedRecords = verifyResult.result && verifyResult.result.verification &&
      Array.isArray(verifyResult.result.verification.records) ? verifyResult.result.verification.records : [];
    const storedRecord = storedRecords[0];
    check('A4: stored record checked_by is user', storedRecord && storedRecord.checked_by === 'user');
    check('A4: stored record checked_by_id equals navigation.resolveByUser(room)',
      storedRecord && storedRecord.checked_by_id === navigation.resolveByUser(room1));

    if (bridgeNodeId && baselineRaw) {
      const afterA4Raw = readNodeRaw(room1DbPath, bridgeNodeId);
      check('A9: review_status/confidence byte-identical after the A4 claim_verify call',
        afterA4Raw && baselineRaw.reviewStatus === afterA4Raw.reviewStatus &&
        baselineRaw.confidence === afterA4Raw.confidence);
      baselineRaw = afterA4Raw;
    }
  } else {
    check('A4: claim_write and claim_verify both captured (Desktop leg skipped)', false);
  }

  // -- A5: unknown host refusal + honest host block -------------------------
  if (verifyReg && readReg) {
    setClient1({ name: 'SomeCoworkClient', version: '1' });

    const refusedResult = await callTool(verifyReg, {
      claim_id: bridgeNodeId || 'claim:none:0',
      against_id: 'x', against_kind: 'observation', rung: 1, method: 'read', result: 'supports',
    });
    check('A5: claim_verify refused write_path_disabled for an unrecognized host',
      refusedResult.result && refusedResult.result.ok === false &&
      refusedResult.result.reason === 'write_path_disabled');
    check('A5: refusal response carries isError true', refusedResult.raw && refusedResult.raw.isError === true);
    const refHost = refusedResult.result && refusedResult.result.host;
    check('A5: refusal host.client_name is SomeCoworkClient', refHost && refHost.client_name === 'SomeCoworkClient');
    check('A5: refusal host.host is unknown', refHost && refHost.host === 'unknown');
    check('A5: refusal host.write_path_enabled is false', refHost && refHost.write_path_enabled === false);
    check('A5: refusal hint names MINDRIAN_MCP_FIRST',
      refusedResult.result && typeof refusedResult.result.hint === 'string' &&
      refusedResult.result.hint.indexOf('MINDRIAN_MCP_FIRST') !== -1);

    const readUnderUnknown = await callTool(readReg, { query: 'bridge' });
    check('A5: claim_read still ok true on the same unrecognized host',
      readUnderUnknown.result && readUnderUnknown.result.ok === true);
    check('A5: claim_read still returns the portrait on the same unrecognized host',
      readUnderUnknown.result && !!readUnderUnknown.result.portrait);
    const readHost = readUnderUnknown.result && readUnderUnknown.result.host;
    check('A5: claim_read carries the same host block',
      readHost && readHost.client_name === 'SomeCoworkClient' && readHost.host === 'unknown');

    setClient1(undefined);
    const readUnderUndefined = await callTool(readReg, { query: 'bridge' });
    check('A5: host.client_name is null when getClientVersion is undefined',
      readUnderUndefined.result && readUnderUndefined.result.host &&
      readUnderUndefined.result.host.client_name === null);
  } else {
    check('A5: claim_verify and claim_read both captured (unknown-host leg skipped)', false);
  }

  // -- A6: claim_read shapes -------------------------------------------------
  if (readReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });
    const a6 = await callTool(readReg, { query: 'bridge' });
    const payload = a6.result;
    check('A6: claim_read ok true', payload && payload.ok === true);
    check('A6: exactly 1 claim matched for query bridge',
      payload && Array.isArray(payload.claims) && payload.claims.length === 1,
      JSON.stringify(payload && payload.claims));
    check('A6: claim object has confirmation and checking_record',
      payload && payload.claim && payload.claim.confirmation && payload.claim.checking_record);

    const portrait = payload && payload.portrait;
    check('A6: portrait has all four states',
      portrait && ['claims_checked', 'claims_disputed', 'claims_inconclusive', 'claims_unchecked']
        .every((k) => Object.prototype.hasOwnProperty.call(portrait, k)));
    check('A6: rendered.portrait contains the unchecked line',
      payload && payload.rendered && typeof payload.rendered.portrait === 'string' &&
      payload.rendered.portrait.indexOf('unchecked (no checking record yet): ') !== -1);

    const rungLabels = Array.isArray(payload && payload.rungs) ? payload.rungs.map((r) => r.label) : [];
    const missingRungLabels = navigation.VERIFICATION_RUNGS.filter((r) => rungLabels.indexOf(r.label) === -1);
    check('A6: rungs lists every VERIFICATION_RUNGS label', missingRungLabels.length === 0,
      'missing: ' + missingRungLabels.map((r) => r.label).join(' | '));

    const host6 = payload && payload.host;
    check('A6: host block matches Claude Desktop identity',
      host6 && host6.client_name === 'claude-ai' && host6.host === 'claude-desktop' &&
      host6.host_tier === 'tier0' && host6.write_path_enabled === true);

    const forbidden = /score|percent|pct|ratio|grade|coverage|%/i;
    const badKeys = deepKeys(payload).filter((k) => forbidden.test(k));
    check('A6: no key in the payload matches a score-like pattern (deep walk)', badKeys.length === 0,
      badKeys.join(', '));
    const renderedStrings = deepStrings(payload && payload.rendered);
    const badRendered = renderedStrings.filter((s) => forbidden.test(s));
    check('A6: no rendered string matches a score-like pattern', badRendered.length === 0,
      badRendered.join(' | '));
    const verifiedRendered = renderedStrings.filter((s) => /\bverified\b/i.test(s));
    check('A6: no rendered string matches the word verified', verifiedRendered.length === 0,
      verifiedRendered.join(' | '));
  } else {
    check('A6: claim_read captured (leg skipped)', false);
  }

  // -- A7: list, not-found, limit bounds -------------------------------------
  let secondNodeId = null;
  if (writeReg && readReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });
    const secondWrite = await callTool(writeReg, {
      knowledge_type: 'fact',
      text: 'The river crossing north of grid 12 is flooded.',
      source_segment: 'b1-358-river',
    });
    check('A7 setup: a second claim_write succeeds',
      secondWrite.result && secondWrite.result.ok === true, JSON.stringify(secondWrite.result));
    secondNodeId = secondWrite.result && secondWrite.result.node_id;

    const listAll = await callTool(readReg, {});
    check('A7: claim_read {} ok true', listAll.result && listAll.result.ok === true);
    check('A7: claim_read {} lists newest first',
      listAll.result && Array.isArray(listAll.result.claims) && listAll.result.claims.length >= 2 &&
      listAll.result.claims[0].claim_id === secondNodeId,
      JSON.stringify(listAll.result && listAll.result.claims));
    check('A7: claim_read {} returns at most 20 claims',
      listAll.result && listAll.result.claims.length <= 20);

    const notFound = await callTool(readReg, { claim_id: 'claim:none:0' });
    check('A7: unknown claim_id returns ok false claim_not_found',
      notFound.result && notFound.result.ok === false && notFound.result.reason === 'claim_not_found');
    check('A7: unknown claim_id response carries isError true', notFound.raw && notFound.raw.isError === true);
    check('A7: unknown claim_id response still carries the portrait', notFound.result && !!notFound.result.portrait);

    const ReadSchema = z.object(readReg.schema);
    check('A7: schema rejects limit 0', !ReadSchema.safeParse({ limit: 0 }).success);
    check('A7: schema rejects limit 101', !ReadSchema.safeParse({ limit: 101 }).success);
  } else {
    check('A7: claim_write and claim_read both captured (leg skipped)', false);
  }

  // -- A8: disputed sticks ----------------------------------------------------
  if (bridgeNodeId && verifyReg) {
    setClient1({ name: 'claude-ai', version: '0.1.0' });

    const plainSupports = await callTool(verifyReg, {
      claim_id: bridgeNodeId, against_id: 'field note, exercise 03', against_kind: 'observation',
      method: 'observe', result: 'supports',
    });
    check('A8: a plain supports after a contradicts keeps status disputed',
      plainSupports.result && plainSupports.result.ok === true &&
      plainSupports.result.claim && plainSupports.result.claim.checking_record.status === 'disputed',
      JSON.stringify(plainSupports.result));

    if (baselineRaw) {
      const afterPlainRaw = readNodeRaw(room1DbPath, bridgeNodeId);
      check('A9: review_status/confidence byte-identical after the A8 plain-supports call',
        afterPlainRaw && baselineRaw.reviewStatus === afterPlainRaw.reviewStatus &&
        baselineRaw.confidence === afterPlainRaw.confidence);
      baselineRaw = afterPlainRaw;
    }

    const systemResolveAttempt = await callTool(verifyReg, {
      claim_id: bridgeNodeId, against_id: 'x', against_kind: 'observation',
      method: 'ask', result: 'supports', checked_by: 'system', resolves_dispute: true,
    });
    check('A8: resolves_dispute true with checked_by system is refused resolution_requires_person',
      systemResolveAttempt.result && systemResolveAttempt.result.ok === false &&
      systemResolveAttempt.result.reason === 'resolution_requires_person',
      JSON.stringify(systemResolveAttempt.result));

    if (baselineRaw) {
      const afterRefusedRaw = readNodeRaw(room1DbPath, bridgeNodeId);
      check('A9: review_status/confidence byte-identical after the A8 refused resolution attempt',
        afterRefusedRaw && baselineRaw.reviewStatus === afterRefusedRaw.reviewStatus &&
        baselineRaw.confidence === afterRefusedRaw.confidence);
      baselineRaw = afterRefusedRaw;
    }

    const personResolve = await callTool(verifyReg, {
      claim_id: bridgeNodeId, against_id: 'field note, exercise 04', against_kind: 'observation',
      method: 'compare', result: 'supports', resolves_dispute: true,
    });
    check('A8: resolves_dispute true with checked_by default user gives status checked',
      personResolve.result && personResolve.result.ok === true &&
      personResolve.result.claim && personResolve.result.claim.checking_record.status === 'checked',
      JSON.stringify(personResolve.result));
    check('A8: 3 records total after the resolving supports',
      personResolve.result && personResolve.result.claim &&
      personResolve.result.claim.checking_record.records_total === 3);

    if (baselineRaw) {
      const afterResolveRaw = readNodeRaw(room1DbPath, bridgeNodeId);
      check('A9: review_status/confidence byte-identical after the A8 resolving supports',
        afterResolveRaw && baselineRaw.reviewStatus === afterResolveRaw.reviewStatus &&
        baselineRaw.confidence === afterResolveRaw.confidence);
    }
  } else {
    check('A8: the bridge claim and claim_verify are both available (leg skipped)', false);
  }

  // -- A10: static substrate + connectors guard -------------------------------
  const claimVerifySource = fs.readFileSync(CLAIM_VERIFY_PATH, 'utf8');
  const stripped = claimVerifySource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/mg, '');
  check('A10: no confirmNode/promoteNodeStatus/brain/node:sqlite/DatabaseSync in claim-verify.cjs',
    !/confirmNode|promoteNodeStatus|brain|node:sqlite|DatabaseSync/.test(stripped));
  check('A10: no hard-coded enum fallback list remains',
    !/'compare'|'observe'|'supports'|'contradicts'/.test(stripped));

  const claimVerifyModule = require(CLAIM_VERIFY_PATH);
  const connectorsList = Array.isArray(claimVerifyModule.connectors) ? claimVerifyModule.connectors : [];
  const readConnector = connectorsList.find((c) => c.tool === 'claim_read');
  check('A10: claim_read connector entry present with the declared shape',
    !!readConnector && readConnector.surface === 'claim_read' &&
    readConnector.connector === 'mcp-tool' && readConnector.hitl_shape === 'none' &&
    readConnector.layer === 'harness' &&
    typeof readConnector.hitl_why === 'string' && readConnector.hitl_why.length > 0 &&
    typeof readConnector.layer_why === 'string' && readConnector.layer_why.length > 0);
  const verifyConnector = connectorsList.find((c) => c.tool === 'claim_verify');
  check('A10: claim_verify connector entry unchanged (F.1, harness, exact hitl_why)',
    !!verifyConnector && verifyConnector.hitl_shape === 'F.1' && verifyConnector.layer === 'harness' &&
    verifyConnector.hitl_why === 'Records local verification metadata on a claim; it never promotes truth state.');

  // -- A11: tool-honesty scanAll ------------------------------------------------
  const toolHonesty = require(path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs'));
  const scanResult = toolHonesty.scanAll();
  const b1Rows = scanResult.rows.filter((r) => r.tool === 'claim_verify' || r.tool === 'claim_read');
  check('A11: claim_verify row present in scanAll', b1Rows.some((r) => r.tool === 'claim_verify'));
  check('A11: claim_read row present in scanAll', b1Rows.some((r) => r.tool === 'claim_read'));
  check('A11: every claim_verify/claim_read row has verdict OK',
    b1Rows.length > 0 && b1Rows.every((r) => r.verdict === 'OK'), JSON.stringify(b1Rows));

  // -- B1: the real stdio wire, as the actual Claude Desktop client ------------
  await runWireLeg();

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  process.stdout.write('FATAL: ' + ((e && e.stack) || e) + '\n');
  process.exit(1);
});
