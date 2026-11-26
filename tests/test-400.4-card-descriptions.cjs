#!/usr/bin/env node
'use strict';
// Phase 400.4 plan 07 (QA-F10): every option of both cause_effect_domain card stages carries a one-line plain-English
// description from data/cynefin-domains.json, and no option is recommended.
//
// Legs D1 to D5:
//   D1 each of the 6 data options has a description of 1 to 120 characters, no digit, no em dash, no en dash;
//      card.description_status is approved (owner ruling 2026-11-26).
//   D2 normalizeOptions returns {id, label, description} in data order for stage 1 and for stage 2.
//   D3 gate_render for kind cause_effect_domain replaces the caller's descriptions with the data strings;
//      card.recommended is null on both stages.
//   D4 the text rung prints one line per option that ends with " - " plus its description.
//   D5 no option has recommended true; answerFor and ratifyCauseEffect keep the same domain per id as at base.
// Runs the real gate tools on a fake server against a scratch room (precedent: tests/test-400-domain-gate.cjs).
// Node built-ins only. No network. Never reads a real room. Hyphens only in this file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cynefin-domains.json'), 'utf8'));
const STAGES = DATA.card.stages;
const S1 = STAGES[0].options;
const S2 = STAGES[1].options;
const S1_IDS = S1.map((o) => o.id);
const S2_IDS = S2.map((o) => o.id);

const WANT = {
  'ce-anyone': 'Cause and effect are plain to see, so a known practice tells you what to do.',
  'ce-trained': 'Cause and effect can be found, but it takes expert analysis to see them.',
  'ce-nobody': 'Cause and effect show only after you act; the next question asks if there is time to test.',
  'ce-cannot-tell': 'People disagree about what kind of situation this is, so it first needs slicing into parts.',
  'ce-probe': 'There is time to run small, safe-to-fail tests and learn from what happens.',
  'ce-act': 'There is no time to test: act first to make things stable, then look again.',
};

let roomDbMod;
let gateRender;
let gateModule;
try {
  roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  gateRender = require(path.join(ROOT, 'lib', 'mcp', 'gate-render.cjs'));
  gateModule = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
} catch (e) {
  console.log('SKIP: test-400.4-card-descriptions: node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}
const card = require(path.join(ROOT, 'lib', 'core', 'cause-effect-card.cjs'));

let failed = 0;
let passed = 0;
async function leg(label, fn) {
  try { await fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 5).join(' | ')); }
}

function opts(ids) {
  return ids.map((id) => ({ id: id, label: 'caller label ' + id, description: 'caller text' }));
}

async function main() {
  await leg('D1 the data file holds 6 plain descriptions and a provisional status', async () => {
    const all = S1.concat(S2);
    assert.equal(all.length, 6);
    for (const o of all) {
      assert.equal(typeof o.description, 'string', o.id + ' has no description');
      assert.ok(o.description.length >= 1 && o.description.length <= 120, o.id + ' length ' + o.description.length);
      assert.ok(!/[0-9–—]/.test(o.description), o.id + ' holds a digit or a dash');
      assert.equal(o.description, WANT[o.id], o.id + ' wording');
    }
    assert.equal(DATA.card.description_status, 'approved');
  });

  await leg('D2 normalizeOptions returns id, label and description in data order on both stages', async () => {
    const r1 = card.normalizeOptions(opts(S1_IDS.slice().reverse()));
    assert.equal(r1.ok, true);
    assert.deepEqual(r1.options, S1.map((o) => ({ id: o.id, label: o.label, description: WANT[o.id] })));
    const r2 = card.normalizeOptions(opts(S2_IDS.slice().reverse()));
    assert.equal(r2.ok, true);
    assert.deepEqual(r2.options, S2.map((o) => ({ id: o.id, label: o.label, description: WANT[o.id] })));
  });

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4004-07-'));
  const roomDir = path.join(home, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(roomDir));
  const prevRoom = process.env.CLAUDE_ACTIVE_ROOM;
  const prevSession = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CLAUDE_ACTIVE_ROOM = roomDir;
  delete process.env.CLAUDE_CODE_SESSION_ID;

  const registered = [];
  const fake = {
    registerTool(name, config, handler) { registered.push({ name, handler }); },
    server: { getClientCapabilities() { return {}; } },
  };
  gateModule.register(fake, { fallbackRoomDir: roomDir, surface: 'cli' });
  const renderEntry = registered.find((r) => r.name === 'gate_render');
  async function render(args) {
    const res = await renderEntry.handler(args, {});
    return JSON.parse(res.content[0].text);
  }

  try {
    await leg('D3 gate_render replaces caller descriptions with the data strings and recommends nothing', async () => {
      for (const [ids, data] of [[S1_IDS, S1], [S2_IDS, S2]]) {
        const body = await render({ kind: 'cause_effect_domain', header: 'caller header', options: opts(ids) });
        assert.equal(body.ok, true, JSON.stringify(body));
        assert.deepEqual(body.card.options.map((o) => [o.id, o.description]), data.map((o) => [o.id, WANT[o.id]]));
        assert.equal(body.card.recommended, null);
      }
    });

    await leg('D4 the text rung prints each option line ending with its description', async () => {
      const n = card.normalizeOptions(opts(S1_IDS));
      const c = gateRender.normalizeCard({ gate_id: 'g-d4', header: n.header, kind: card.CARD_KIND, options: n.options, selectMode: 'single' });
      const tx = await gateRender._internal.renderViaText(c, { simulateTextReply: async () => S1_IDS[0] });
      const lines = tx.rendered.zones.body.split('\n').filter((l) => l.trim().length > 0);
      assert.equal(lines.length, S1_IDS.length);
      lines.forEach((l, i) => {
        assert.ok(l.endsWith(' - ' + WANT[S1_IDS[i]]), 'line ' + (i + 1) + ': ' + l);
      });
    });
  } finally {
    if (prevRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = prevRoom;
    if (prevSession !== undefined) process.env.CLAUDE_CODE_SESSION_ID = prevSession;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) { /* scratch only */ }
  }

  await leg('D5 no option is recommended and the id to domain map is unchanged', async () => {
    for (const o of S1.concat(S2)) {
      assert.notEqual(o.recommended, true, o.id);
      assert.equal('rank' in o, false, o.id);
    }
    const expect = {
      'ce-anyone': { domain: 'clear', next_stage: null },
      'ce-trained': { domain: 'complicated', next_stage: null },
      'ce-cannot-tell': { domain: 'disorder', next_stage: null },
      'ce-probe': { domain: 'complex', next_stage: null },
      'ce-act': { domain: 'chaotic', next_stage: null },
      'ce-nobody': { domain: null, next_stage: 2 },
    };
    for (const id of Object.keys(expect)) assert.deepEqual(card.answerFor([id]), expect[id], id);
    const r = card.ratifyCauseEffect(null, { verdict: 'approve', chosen: ['ce-nobody'] });
    assert.deepEqual(r, { ok: true, written: false, follow_up: { stage: 2, option_ids: S2_IDS } });
  });

  console.log('PASSED=' + passed + ' FAILED=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.log('FAIL: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
