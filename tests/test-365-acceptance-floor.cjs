#!/usr/bin/env node
'use strict';

/*
 * Phase 365-02 -- the FLOOR acceptance test, red at base.
 *
 * ROOM.md declares `verification_floor: secondary_document`. Claim C1 has only
 * an ask record (a model was asked), so it is BELOW that floor. The card for C1
 * is driven on every renderer rung the product has:
 *   rung a  MCP elicitation (stub elicitInput that cancels, so nothing is
 *           answered inline; the captured message and schema are read)
 *   rung b  the Claude host surface (AskUserQuestion thin adapter)
 *   rung c  headless structured text
 * plus the meeting tool's file-meeting card (claim C2, same room).
 *
 * Each card must carry the why-line: `Checked against:` and `needs evidence`,
 * and the approve option must read exactly `Approve, mark as needs evidence`.
 * No option label may read like "confirm anyway" (a hard failure, not a red).
 * A below-floor approve (rung c gate) must land C1 at needs_evidence, read back
 * through a FRESH room.db handle, never from the tool response.
 *
 * Met-floor control: claim C3 has a source edge (example.org, retrieved
 * 2026-09-30). Its rung c card must name the accepted source, and approve lands
 * confirmed (a hard check that passes at base).
 *
 * Signatures on failure (both healed by 365-08):
 *   RED-365-FLOOR         below-floor approve landed something other than
 *                         needs_evidence
 *   RED-365-FLOOR-NOTICE  the why-line is absent on a rung (a, b, c, meeting)
 *                         or the met-floor card does not name the source
 *
 * Exit: 0 PASS, 1 FAIL, 77 ENV GAP (never used for a rung that can be driven
 * offline). No em-dashes.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const path = require('node:path');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const { registerRouterTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const gateTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));

const APPROVE_LABEL = 'Approve, mark as needs evidence';

let hardFail = 0;
function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    process.stdout.write('  ok - ' + label + '\n');
  } catch (_e) {
    hardFail += 1;
    process.stdout.write('  FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n');
  }
}

function textOf(raw) {
  return (raw && raw.content && raw.content[0] && raw.content[0].text) || '';
}
function jsonOf(raw) {
  try { return JSON.parse(textOf(raw)); } catch (_e) { return null; }
}

const CARD_OPTIONS = [
  { id: 'approve', label: 'Approve' },
  { id: 'reject', label: 'Reject' },
];

// A capture server whose `server.server` stands in for the MCP low-level server.
// capabilities === null leaves getClientCapabilities returning undefined (the
// pre-handshake shape), so the renderer falls to the surface or text rung.
function makeServer(caps, elicitLog, clientInfo) {
  const handlers = new Map();
  const server = {
    tool: (name, _d, _s, h) => handlers.set(name, h),
    registerTool: (name, _c, h) => handlers.set(name, h),
    server: {
      getClientCapabilities: () => caps,
      getClientVersion: () => clientInfo,
      elicitInput: async (params) => {
        elicitLog.push(params);
        return { action: 'cancel' };
      },
    },
  };
  return { server, handlers };
}

async function renderOnRung(room, rung, subjectId, sessionId) {
  const elicitLog = [];
  const caps = rung === 'a' ? { elicitation: {} } : undefined;
  const surface = rung === 'b' ? 'cli' : (rung === 'a' ? 'cli' : 'headless-365');
  // Under D-02 a recognized non-Claude host that declares elicitation keeps rung (a),
  // which is what this rung exists to exercise; a Claude host surface would now get the card.
  const clientInfo = rung === 'a' ? { name: 'Visual Studio Code', version: '1' } : undefined;
  const { server, handlers } = makeServer(caps, elicitLog, clientInfo);
  gateTool.register(server, { fallbackRoomDir: room.room, pluginRoot: REPO_ROOT, surface: surface });
  const raw = await handlers.get('gate_render')({
    header: 'Confirm claim for the floor test',
    kind: 'general',
    select_mode: 'single',
    options: CARD_OPTIONS,
    subject_node_id: subjectId,
  }, { sessionId: sessionId });
  const json = jsonOf(raw);
  const all = textOf(raw) + '\n' + elicitLog.map((p) => JSON.stringify(p)).join('\n');
  return { handlers, json, all, elicitLog };
}

function noticeHolds(all) {
  return all.indexOf('Checked against:') !== -1
    && all.indexOf('needs evidence') !== -1
    && all.indexOf(APPROVE_LABEL) !== -1;
}

async function main() {
  let room;
  try {
    room = fx.makeRoom365('floor');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  const reds = [];
  try {
    fx.writeRoomFloor(room.room, 'secondary_document');

    const wdb = fx.openFresh(room.room);
    let c1;
    let c3;
    try {
      c1 = fx.seedClaim(wdb, { text: 'Floor test claim C1: only a model was asked.', variant: 'C1' });
      fx.recordAsk(wdb, c1, { rung: 2 });
      c3 = fx.seedClaim(wdb, { text: 'Floor test claim C3: a source was read.', variant: 'C3' });
      const src = fx.addSourceEdge(wdb, c3, {
        url: 'https://example.org/a', retrieved_at: '2026-09-30', variant: 'C3',
      });
      fx.recordRead(wdb, c3, { againstId: src, rung: 3 });
    } finally {
      fx.closeFresh(wdb);
    }

    const allTexts = [];

    // Rungs a, b, c on the below-floor claim.
    const rungs = {};
    for (const rung of ['a', 'b', 'c']) {
      const r = await renderOnRung(room, rung, c1, 'test-365-floor-' + rung);
      rungs[rung] = r;
      check('rung ' + rung + ' rendered a card with a gate_id',
        !!r.json && r.json.ok === true && !!r.json.gate_id, r.all.slice(0, 200));
      allTexts.push(r.all);
      const wantRenderer = { a: 'elicitation', b: 'askuserquestion', c: 'text' }[rung];
      check('rung ' + rung + ' used the ' + wantRenderer + ' renderer',
        !!r.json && r.json.renderer === wantRenderer, r.json && r.json.renderer);
      if (rung === 'a') {
        check('rung a produced an elicitation message and schema', r.elicitLog.length === 1,
          'elicitations=' + r.elicitLog.length);
      }
      if (!noticeHolds(r.all)) {
        reds.push('RED-365-FLOOR-NOTICE: why-line absent on rung ' + rung);
      }
    }

    // The meeting card (claim C2), same room.
    {
      const { server, handlers } = fx.captureToolServer();
      registerRouterTools(server, room.room, REPO_ROOT, { full: '' }, 'cli');
      const raw = await handlers.get('meeting')({
        command: 'file-meeting', knowledge_type: 'fact',
        claim_text: 'Floor test claim C2: filed through the meeting tool.',
      }, { sessionId: 'test-365-floor-meeting' });
      const t = textOf(raw);
      check('the meeting tool rendered a card with a gate_id', /gate_id/.test(t), t.slice(0, 200));
      allTexts.push(t);
      if (!noticeHolds(t)) {
        reds.push('RED-365-FLOOR-NOTICE: why-line absent on rung meeting');
      }
    }

    check('no option label reads like "confirm anyway" on any card',
      !allTexts.some((t) => /confirm anyway/i.test(t)),
      'a bypass label is a hard failure');

    // Below-floor approve on the rung c gate, read back through a fresh handle.
    {
      const r = rungs.c;
      const gateId = r.json && r.json.gate_id;
      const raw = await r.handlers.get('gate_answer')(
        { gate_id: gateId, chosen: ['approve'], verdict: 'approve' }, { sessionId: 'test-365-floor-c' });
      const answered = jsonOf(raw);
      check('gate_answer on the rung c gate returned a verdict response', !!answered, textOf(raw).slice(0, 200));
      const status = fx.readStatus(room.room, c1);
      process.stdout.write('  observed: below-floor approve left C1 at review_status=' + status + '\n');
      if (status !== 'needs_evidence') {
        reds.push('RED-365-FLOOR: below-floor approve landed ' + status);
      }
    }

    // Met-floor control: C3 names its source and approve lands confirmed.
    {
      const r = await renderOnRung(room, 'c', c3, 'test-365-floor-c3');
      check('met-floor card rendered with a gate_id', !!r.json && !!r.json.gate_id, r.all.slice(0, 200));
      if (r.all.indexOf('example.org') === -1) {
        reds.push('RED-365-FLOOR-NOTICE: met-floor card does not name the accepted source');
      }
      const raw = await r.handlers.get('gate_answer')(
        { gate_id: r.json && r.json.gate_id, chosen: ['approve'], verdict: 'approve' },
        { sessionId: 'test-365-floor-c3' });
      check('gate_answer on the met-floor gate returned a verdict response', !!jsonOf(raw), textOf(raw).slice(0, 200));
      const status = fx.readStatus(room.room, c3);
      check('a met-floor approve lands confirmed (fresh handle)', status === 'confirmed', 'status=' + status);
    }
  } finally {
    fx.cleanup(room);
  }

  check('no network attempted', net.attempts() === 0, String(net.attempts()));
  net.restore();
  if (hardFail > 0) return 1;
  if (reds.length > 0) {
    for (const r of reds) process.stdout.write(r + '\n');
    return 1;
  }
  process.stdout.write('PASS: below-floor claims explain themselves on every rung and land needs_evidence\n');
  return 0;
}

main().then((code) => { process.exitCode = code; }, (e) => {
  process.stdout.write('UNCAUGHT: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
});
