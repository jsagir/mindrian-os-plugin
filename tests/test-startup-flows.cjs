#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { hermeticEnv, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');
const { URI } = require('../lib/mcp/room-app.cjs');
const fixtures = {};
const unpack = result => { if (result.structuredContent) return result.structuredContent; const text = result.content.find(item => item.type === 'text').text; try { return JSON.parse(text); } catch (_) { return { ok: false, reason: 'invalid_tool_input', detail: text }; } };

// Quick 261019-ksf (2026-10-19, 371 release review): shared helpers for the one-connection legs below.
// One stdio server process, one client; the same shape as realFlows connect/call.
async function openSession(fixture) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [LOCAL_SERVER], env: fixture.env, stderr: 'pipe' });
  const client = new Client({ name: 'ChatGPT', version: 'startup-test' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': {} } } });
  await client.connect(transport);
  return {
    async call(name, args = {}) {
      const result = await client.callTool({ name, arguments: args });
      assert(!result.isError, JSON.stringify(result));
      return unpack(result);
    },
    async close() { await client.close(); await transport.close(); },
  };
}
async function createRoom(session, fixture, name, purpose, slug) {
  const preview = await session.call('room_create', { name, purpose, slug });
  const created = await session.call('gate_answer', { gate_id: preview.gate.gate_id, chosen: ['approve'], verdict: 'approve' });
  assert.equal(created.room_creation.created, true, JSON.stringify(created));
  return path.join(fixture.dirs.roomsHome, slug);
}
// Every table of a room.db, every row, as JSON text: the rows that carry any marker.
function roomLeaks(dir, markers) {
  const db = require('../lib/core/room-db.cjs').openRoomDb(dir);
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
    const leaks = [];
    for (const table of tables) {
      for (const row of db.prepare('SELECT * FROM "' + table.replace(/"/g, '""') + '"').all()) {
        const text = JSON.stringify(row);
        if (markers.some(marker => text.includes(marker))) leaks.push({ table, row: text.slice(0, 300) });
      }
    }
    return leaks;
  } finally { db.close(); }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function logWork(fixture, dir, sourcePath) {
  const nav = require('../lib/core/navigation.cjs');
  let db = nav.openRoomDbForCaller(dir);
  if (!db) { process.env.MINDRIAN_ROOMS_HOME = fixture.env.MINDRIAN_ROOMS_HOME; db = nav.openRoomDbForCaller(dir); }
  assert(db, 'room db opens for the test writer');
  try { assert(nav.logMemoryEvent(db, 'framework_invoked', { framework: 'Lean Canvas', source_path: sourcePath }).ok); }
  finally { nav.closeRoomDbForCaller(db); }
}

// CR-01 (Canon Part 9 locality): a navigator bound to room A who creates room B leaves no trace of B in A.
async function secondRoomStaysLocal() {
  const fixture = hermeticEnv();
  let session;
  try {
    session = await openSession(fixture);
    const dirA = await createRoom(session, fixture, 'Room A', 'Alpha purpose', 'room-a');
    assert.equal((await session.call('room_bind', { room: 'room-a' })).bound, true);
    const previewB = await session.call('room_create', { name: 'Secret Beta', purpose: 'BETA-CONFIDENTIAL purpose text', slug: 'room-b' });
    const gateB = previewB.gate.gate_id;
    const markers = [gateB, 'Secret Beta', 'BETA-CONFIDENTIAL'];
    const briefing = (await session.call('room_startup')).briefing;
    assert(!briefing.pending_decisions.some(gate => gate.gate_id === gateB || String(gate.header).includes('Secret Beta')),
      'A briefing for room A does not list the creation card of room B: ' + JSON.stringify(briefing.pending_decisions));
    let leaks = roomLeaks(dirA, markers);
    assert.deepEqual(leaks, [], 'room A carries no row about room B while the gate is open: ' + JSON.stringify(leaks));
    const made = await session.call('gate_answer', { gate_id: gateB, chosen: ['approve'], verdict: 'approve' });
    assert.equal(made.room_creation.created, true);
    leaks = roomLeaks(dirA, markers);
    assert.deepEqual(leaks, [], 'room A carries no row about room B after the approval: ' + JSON.stringify(leaks));
    console.log('PASS CR-01 Canon Part 9: a second room created while bound to room A leaves no row in room A');
  } finally { if (session) await session.close(); fixture.cleanup(); }
}

async function realFlows() {
  const fixture = hermeticEnv();
  assert(path.dirname(fixture.dirs.roomDir) === fixture.dirs.roomsHome);
  fs.unlinkSync(path.join(fixture.dirs.roomDir, 'STATE.md')); fs.rmdirSync(fixture.dirs.roomDir);
  fs.rmdirSync(fixture.dirs.roomsHome);
  const target = path.join(fixture.dirs.roomsHome, 'first-room');
  const marker = path.join(fixture.dirs.home, 'must-not-be-executed');
  const name = "Navigator's $(touch " + marker + ') room';
  let client, transport;
  async function connect() {
    transport = new StdioClientTransport({ command: process.execPath, args: [LOCAL_SERVER], env: fixture.env, stderr: 'pipe' });
    client = new Client({ name: 'ChatGPT', version: 'startup-test' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': {} } } });
    await client.connect(transport);
  }
  async function call(name_, args = {}, allowError = false) {
    const result = await client.callTool({ name: name_, arguments: args });
    if (!allowError) assert(!result.isError, JSON.stringify(result));
    return { result, data: unpack(result) };
  }
  try {
    await connect();
    const list = await call('room_list'); assert.deepEqual(list.data.rooms, []); fixtures.list = list.result;
    fixtures.resource = (await client.readResource({ uri: URI })).contents[0];
    fixtures.html = fixtures.resource.text;
    const input = { name, purpose: 'Investigate the pilot evidence', slug: 'first-room' };
    let preview = await call('room_create', input);
    assert.equal(preview.data.preview.folder, target); assert(!fs.existsSync(target));
    let rejected = await call('gate_answer', { gate_id: preview.data.gate.gate_id, chosen: ['reject'], verdict: 'reject' });
    assert.equal(rejected.data.room_creation.created, false); assert(!fs.existsSync(target));
    preview = await call('room_create', input);
    const deferred = await call('gate_answer', { gate_id: preview.data.gate.gate_id, chosen: ['defer'], verdict: 'defer' });
    assert.equal(deferred.data.room_creation.created, false); assert(!fs.existsSync(target));
    const bad = await call('room_create', { ...input, slug: '../outside' }, true);
    assert.equal(bad.result.isError, true);
    assert(!fs.existsSync(fixture.dirs.roomsHome), 'preview, reject and defer leave a clean user home untouched');
    const outside = path.join(fixture.dirs.home, 'outside'); fs.mkdirSync(outside);
    fs.mkdirSync(fixture.dirs.roomsHome);
    fs.symlinkSync(outside, path.join(fixture.dirs.roomsHome, 'escape'));
    const escaped = await call('room_create', { ...input, slug: 'escape' }, true);
    assert.equal(escaped.data.ok, false); assert.equal(fs.readdirSync(outside).length, 0);
    fs.unlinkSync(path.join(fixture.dirs.roomsHome, 'escape'));
    fs.rmdirSync(fixture.dirs.roomsHome);
    preview = await call('room_create', input); fixtures.preview = preview.result;
    const raced = await call('room_create', input);
    assert(!fs.existsSync(target), 'multiple previews do not create folders');
    const answerInput = { gate_id: preview.data.gate.gate_id, chosen: ['approve'], verdict: 'approve' };
    const created = await call('gate_answer', answerInput); fixtures.created = created.result;
    assert.equal(created.data.room_creation.created, true, JSON.stringify(created.data));
    assert.equal(created.data.room_creation.session_bound, true);
    for (const file of ['ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md', '.room-root', '.mindrian/room.db']) assert(fs.existsSync(path.join(target, file)), file);
    assert(!fs.existsSync(marker), 'a user display name is passed literally, never executed');
    const registry = fs.readFileSync(path.join(fixture.dirs.roomsHome, '.rooms/registry.json'), 'utf8');
    assert(registry.includes('$(touch '), 'registry preserves the literal user display name');
    const replay = await call('gate_answer', answerInput); assert.equal(replay.data.replayed, true);
    const collision = await call('gate_answer', { gate_id: raced.data.gate.gate_id, chosen: ['approve'], verdict: 'approve' }, true);
    assert.equal(collision.data.reason, 'room_exists');
    const duplicate = await call('room_create', input, true); assert.equal(duplicate.data.reason, 'room_exists');
    const db = require('../lib/core/room-db.cjs').openRoomDb(target);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='room_created'").get().n, 1);
    db.close();
    console.log('PASS first-room preview, reject/defer, path safety, approved core birth, literal name, collision and durable replay');
    fixtures.binding = (await call('room_bind', { room: 'first-room' })).result;
    fixtures.memory = (await call('context_assemble')).result;
    const startup = await call('room_startup'); fixtures.startupFirst = startup.result;
    assert.equal(startup.data.briefing.changes.status, 'no_previous_checkpoint');
    const repeat = await call('room_startup');
    assert.equal(repeat.data.briefing.opened_at, startup.data.briefing.opened_at);
    assert.equal(repeat.data.briefing.visit_id, startup.data.briefing.visit_id);
    assert.equal(repeat.data.briefing.next_move.gate_id, startup.data.briefing.next_move.gate_id);
    const move = startup.data.briefing.next_move;
    await call('gate_answer', { gate_id: move.gate_id, chosen: ['review_changes'], verdict: 'approve' });
    assert.equal((await call('room_startup')).data.briefing.next_move.status, 'answered');
    fixtures.dashboard = (await call('room-dashboard')).result;
    await call('gate_render', { header: 'Review the retained pilot proposal', options: [{ id: 'approve', label: 'Approve' }, { id: 'defer', label: 'Defer' }] });
    const session = require('../lib/core/session-state.cjs').writeSessionState(target, {
      active_methodology: 'Lean Canvas', open_questions: ['Which pilot evidence is missing?'], next_suggested_action: 'Review the pilot evidence',
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    const nav = require('../lib/core/navigation.cjs');
    const workDb = nav.openRoomDbForCaller(target);
    assert(nav.logMemoryEvent(workDb, 'framework_invoked', { framework: 'Lean Canvas', source_path: 'test:recorded-new-work' }).ok);
    nav.closeRoomDbForCaller(workDb);
    await client.close(); await transport.close(); client = null;
    await connect();
    await call('room_bind', { room: 'first-room' });
    const memory = await call('context_assemble'); assert.equal(memory.data.room_dir, target);
    const returning = await call('room_startup'); fixtures.startupReturning = returning.result;
    const brief = returning.data.briefing;
    assert.equal(brief.baseline_basis, 'last_session_end'); assert.equal(brief.previous_at, session.timestamp);
    assert.equal(brief.last_session.next_action, 'Review the pilot evidence');
    assert(brief.open_questions.includes('Which pilot evidence is missing?'));
    assert(brief.changes.items.some(item => item.kind === 'framework_invoked'));
    assert(brief.pending_decisions.some(gate => gate.header === 'Review the retained pilot proposal'));
    const again = await call('room_startup'); assert.equal(again.data.briefing.previous_at, brief.previous_at);
    assert.equal(again.data.briefing.opened_at, brief.opened_at);
    console.log('PASS fresh-session workday memory, saved next action, changes since session end, pending decisions and stable retry checkpoint');
  } finally { if (client) await client.close(); if (transport) await transport.close(); fixture.cleanup(); }
}

async function browserFlows() {
  // Readable synthetic display labels; security assertions above keep the literal injection name.
  fixtures.preview.structuredContent.preview.name = 'My first room';
  fixtures.preview.structuredContent.gate.card.header = 'Create My first room?';
  fixtures.dashboard.structuredContent.name = 'Pilot evidence';
  const { chromium } = require('playwright');
  const sdk = fs.readFileSync(require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'), 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('@modelcontextprotocol/ext-apps@2.0.3/')) return route.fulfill({ contentType: 'text/javascript', body: sdk });
      if (url === 'http://mos-startup.test/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
      return route.abort();
    });
    async function open(returning = false, direct = false) {
      await page.goto('http://mos-startup.test/');
      await page.evaluate(({ fixtures, returning, direct }) => {
        window.calls = []; window.messages = [];
        const iframe = document.createElement('iframe'); iframe.style = 'width:100%;height:950px;border:0'; iframe.sandbox = 'allow-scripts';
        const send = value => iframe.contentWindow.postMessage({ jsonrpc: '2.0', ...value }, '*');
        window.addEventListener('message', event => {
          if (event.source !== iframe.contentWindow) return; const message = event.data;
          if (message.method === 'ui/initialize') {
            send({ method: 'ui/notifications/tool-input', params: { arguments: {} } });
            send({ method: 'ui/notifications/tool-result', params: direct ? fixtures.preview : returning ? { structuredContent: { home: '/synthetic/rooms', rooms: ['first-room'] } } : fixtures.list });
            send({ id: message.id, result: { protocolVersion: message.params.protocolVersion, hostInfo: { name: 'ChatGPT-test', version: '1' }, hostCapabilities: { serverTools: {}, serverMessages: {}, updateModelContext: { text: {} } }, hostContext: { theme: 'light', displayMode: 'inline' } } });
          } else if (message.method === 'tools/call') {
            window.calls.push(message); const name = message.params.name, args = message.params.arguments; let result;
            if (name === 'room_create') result = fixtures.preview;
            else if (name === 'gate_answer') result = args.gate_id === fixtures.startupReturning.structuredContent.briefing.next_move.gate_id ? { structuredContent: { ok: true, gate_id: args.gate_id, verdict: args.verdict } } : args.verdict === 'approve' ? fixtures.created : { structuredContent: { ok: true, verdict: args.verdict, room_creation: { ok: true, created: false } } };
            else if (name === 'room_bind') result = fixtures.binding;
            else if (name === 'context_assemble') result = fixtures.memory;
            else if (name === 'room_startup') result = returning ? fixtures.startupReturning : fixtures.startupFirst;
            else if (name === 'room-dashboard') result = fixtures.dashboard;
            else if (name === 'room_list') result = fixtures.list;
            else throw Error('Unexpected tool ' + name);
            send({ id: message.id, result });
          } else if (message.id !== undefined && message.method) { window.messages.push(message); send({ id: message.id, result: {} }); }
        }); iframe.srcdoc = fixtures.html; document.body.append(iframe);
      }, { fixtures, returning, direct });
      const frame = page.frames().find(frame => frame !== page.mainFrame());
      await frame.locator('#mindrian-status').filter({ hasText: /connected/ }).waitFor(); return frame;
    }
    let frame = await open();
    assert(await frame.locator('#new-room').isVisible()); assert.equal(await page.evaluate(() => window.calls.length), 0);
    await frame.locator('#new-name').fill('My first room'); await frame.locator('#new-purpose').fill('Investigate the pilot evidence');
    await frame.locator('#prepare').click(); await frame.locator('#creation-preview').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => window.calls.map(call => call.params.name)), ['room_create']);
    if (process.env.MINDRIAN_FIRST_STARTUP_SCREENSHOT) await frame.locator('body').screenshot({ path: process.env.MINDRIAN_FIRST_STARTUP_SCREENSHOT });
    await frame.locator('#birth-reject').click();
    await frame.locator('#status').filter({ hasText: 'Room not created' }).waitFor();
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.params.name === 'room_bind').length), 0);
    await frame.locator('#prepare').click(); await frame.locator('#birth-approve').waitFor({ state: 'visible' });
    await frame.locator('#birth-approve').click(); await frame.locator('#opened').waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.messages.some(message => message.method === 'ui/message'));
    assert.deepEqual(await page.evaluate(() => window.calls.slice(-5).map(call => call.params.name)), ['gate_answer', 'room_bind', 'context_assemble', 'room_startup', 'room-dashboard']);
    assert.match(await frame.locator('#changes').innerText(), /No previous checkpoint/);
    console.log('PASS first-user browser flow: empty list, preview without writes, reject, approve, bind, memory and startup');
    frame = await open(true);
    await frame.locator('input[value="first-room"]').check(); await frame.locator('#open').click();
    await frame.locator('#workday').waitFor({ state: 'visible' });
    assert.match(await frame.locator('#left-off').innerText(), /Review the pilot evidence/);
    assert.match(await frame.locator('#changes').innerText(), /Method used/);
    assert.match(await frame.locator('#unfinished').innerText(), /Which pilot evidence is missing/);
    assert.match(await frame.locator('#pending-decisions').innerText(), /Review the retained pilot proposal/);
    if (process.env.MINDRIAN_RETURNING_STARTUP_SCREENSHOT) {
      const height = await frame.evaluate(() => document.documentElement.scrollHeight);
      await page.locator('iframe').evaluate((element, height) => { element.style.height = height + 'px'; }, height);
      await page.setViewportSize({ width: 1000, height: height + 40 });
      await frame.locator('body').screenshot({ path: process.env.MINDRIAN_RETURNING_STARTUP_SCREENSHOT });
    }
    await frame.locator('button[data-choice="review_changes"]').click();
    await frame.locator('#status').filter({ hasText: 'startup choice is recorded' }).waitFor();
    assert(await frame.locator('button[data-choice="review_changes"]').isDisabled());
    assert.equal(await page.evaluate(() => window.calls.filter(call => call.params.name === 'gate_answer').length), 1);
    frame = await open(false, true);
    await frame.locator('#creation-preview').waitFor({ state: 'visible' });
    assert.equal(await frame.locator('#creation-name').innerText(), 'My first room');
    assert.equal(await page.evaluate(() => window.calls.length), 0);
    assert(await frame.locator('#birth-approve').isVisible());
    console.log('PASS direct room_create tool opens its room preview and approval controls');
    assert.deepEqual(errors, []);
    console.log('PASS returning-browser briefing, recorded changes, pending decisions and single-use next-move choice');
  } finally { await browser.close(); }
}
module.exports = { realFlows, fixtures, secondRoomStaysLocal };
if (require.main === module) (async () => {
  await realFlows();
  await secondRoomStaysLocal();
  if (process.argv.includes('--browser')) await browserFlows();
})().catch(error => { console.error(error); process.exitCode = 1; });
