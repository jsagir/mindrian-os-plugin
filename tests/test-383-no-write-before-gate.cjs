#!/usr/bin/env node
'use strict';
/*
 * Phase 383 plan 01 (QA383-10, QA383-04): the gated MCP path writes nothing before approval, writes
 * one clean tree after it, and refuses cleanly when the machine cannot finish the job.
 *
 * The legs drive the real stdio server the way tests/test-startup-flows.cjs does.
 *
 *   W1  a room_create preview leaves the rooms home unchanged (guard leg)
 *   W2  a reject and a defer leave the rooms home unchanged (guard leg)
 *   W3  an approval makes the room folder and no nested copy of the rooms home path (research E9)
 *   W4  with no working runtime, room_create returns environment_not_ready and writes nothing
 *
 * Hermetic: hermeticEnv of tests/helpers/mcp-wire-267.cjs (own HOME, own rooms home, unreachable
 * Brain URL). No network. House rule: hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { hermeticEnv, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');
const H = require('./helpers/harness-383.cjs');

const rep = H.reporter('test-383-no-write-before-gate');

function unpack(result) {
  if (result.structuredContent) return result.structuredContent;
  const text = (result.content.find(function (item) { return item.type === 'text'; }) || {}).text || '';
  try { return JSON.parse(text); } catch (_e) { return { ok: false, reason: 'invalid_tool_input', detail: text }; }
}
async function openSession(fixture) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [LOCAL_SERVER], env: fixture.env, stderr: 'pipe' });
  const client = new Client({ name: 'ChatGPT', version: 'no-write-383' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': {} } } });
  await client.connect(transport);
  return {
    async call(name, args) {
      const result = await client.callTool({ name: name, arguments: args || {} });
      return { isError: result.isError === true, data: unpack(result) };
    },
    async close() {
      try { await client.close(); } catch (_e) { /* best effort */ }
      try { await transport.close(); } catch (_e) { /* best effort */ }
    },
  };
}
function ok(cond, what) { if (!cond) throw new Error(what); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function added(before, after) { return after.filter(function (p) { return before.indexOf(p) === -1; }); }

const INPUT = { name: 'W383 Room', purpose: 'probe the gate', slug: 'w383' };

async function gatedLegs() {
  const fixture = hermeticEnv();
  let session;
  try {
    session = await openSession(fixture);
    const rh = fixture.dirs.roomsHome;

    try {
      const before = H.snapshotTree(rh);
      const preview = await session.call('room_create', INPUT);
      ok(!preview.isError && preview.data.gate && preview.data.gate.gate_id, 'preview failed: ' + JSON.stringify(preview.data).slice(0, 200));
      const after = H.snapshotTree(rh);
      ok(same(before, after), 'a preview wrote: ' + JSON.stringify(added(before, after).slice(0, 5)));
      rep.pass('W1 a room_create preview leaves the rooms home unchanged');
    } catch (e) { rep.fail('W1 a room_create preview leaves the rooms home unchanged', e.message); }

    try {
      const before = H.snapshotTree(rh);
      const p1 = await session.call('room_create', INPUT);
      await session.call('gate_answer', { gate_id: p1.data.gate.gate_id, chosen: ['reject'], verdict: 'reject' });
      ok(same(before, H.snapshotTree(rh)), 'a reject wrote: ' + JSON.stringify(added(before, H.snapshotTree(rh)).slice(0, 5)));
      const p2 = await session.call('room_create', INPUT);
      await session.call('gate_answer', { gate_id: p2.data.gate.gate_id, chosen: ['defer'], verdict: 'defer' });
      ok(same(before, H.snapshotTree(rh)), 'a defer wrote: ' + JSON.stringify(added(before, H.snapshotTree(rh)).slice(0, 5)));
      rep.pass('W2 a reject and a defer leave the rooms home unchanged');
    } catch (e) { rep.fail('W2 a reject and a defer leave the rooms home unchanged', e.message); }

    try {
      const p3 = await session.call('room_create', INPUT);
      const made = await session.call('gate_answer', { gate_id: p3.data.gate.gate_id, chosen: ['approve'], verdict: 'approve' });
      ok(made.data.room_creation && made.data.room_creation.created === true, 'the approval did not create the room: ' + JSON.stringify(made.data).slice(0, 300));
      const snap = H.snapshotTree(rh);
      ok(fs.existsSync(path.join(rh, 'w383')), 'the room folder w383 does not exist');
      const seg = rh.split(path.sep).filter(Boolean)[0];
      const nested = snap.filter(function (p) { return p === seg || p.indexOf(seg + '/') === 0; });
      ok(nested.length === 0, 'paths under the rooms home that start with ' + seg + ': ' + JSON.stringify(nested.slice(0, 3)));
      const stray = snap.filter(function (p) { return /(^|\/)ROOM\.md$/.test(p) && p.indexOf('w383/') !== 0 && p.indexOf('room-267/') !== 0; });
      ok(stray.length === 0, 'ROOM.md files outside w383/ and room-267/: ' + JSON.stringify(stray.slice(0, 3)));
      rep.pass('W3 an approval makes the room folder and no nested copy of the rooms home path');
    } catch (e) { rep.fail('W3 an approval makes the room folder and no nested copy of the rooms home path', e.message); }
  } finally {
    if (session) await session.close();
    fixture.cleanup();
  }
}

async function failedCreateLeg() {
  const label = 'W4 with no working runtime, room_create returns environment_not_ready and writes nothing';
  const noRuntimeBin = H.mkTmp('onlynode');
  fs.symlinkSync(process.execPath, path.join(noRuntimeBin, 'node'));
  const fixture = hermeticEnv({ PATH: noRuntimeBin });
  for (const k of ['MINDRIAN_BASH', 'MINDRIAN_PYTHON', 'CLAUDE_CODE_GIT_BASH_PATH']) delete fixture.env[k];
  let session;
  try {
    session = await openSession(fixture);
    const before = H.snapshotTree(fixture.dirs.roomsHome);
    const r = await session.call('room_create', INPUT);
    ok(r.data && r.data.reason === 'environment_not_ready', 'room_create returned ' + JSON.stringify(r.data).slice(0, 300));
    ok(r.isError === true, 'room_create did not return an error result');
    const after = H.snapshotTree(fixture.dirs.roomsHome);
    ok(same(before, after), 'the refused create wrote: ' + JSON.stringify(added(before, after).slice(0, 5)));
    rep.pass(label);
  } catch (e) { rep.fail(label, e.message); }
  finally {
    if (session) await session.close();
    fixture.cleanup();
  }
}

(async function main() {
  try { await gatedLegs(); } catch (e) { rep.fail('W1-W3 the stdio session did not start', e && e.message || e); }
  try { await failedCreateLeg(); } catch (e) { rep.fail('W4 the stdio session did not start', e && e.message || e); }
  rep.done();
})();
