#!/usr/bin/env node
'use strict';

/*
 * Phase 365 code review CR-01 -- the never-do `section` kind must bite on the
 * REAL production chain_run path.
 *
 * Root cause under test: declaredFieldsOfChainStep read the section only from
 * ctx.targetSection, and the registered chain_run handler never supplies one
 * (its input schema has no such field, pinned byte-identical by test K5), so a
 * `section` entry never matched on a live chain. The honest source is the step
 * itself: the command registry declares where each methodology command files
 * its output (`produces: room/<section>/...`).
 *
 * Every check here goes through the REGISTERED chain_run handler (the function
 * the MCP server calls), never through an injected ctx.targetSection, with the
 * real default dispatcher and the real posture authority.
 *
 * S1 start: a chain whose step files into a named section halts, reason
 *    constraint_named, kind section.
 * S2 control: the same chain with no entry (and with an entry for another
 *    section) does not halt.
 * S3 resumed tail: a chain that halts at a material step, then resumes through
 *    the gate_answer path, halts again at a LATER step in the named section.
 * S4 the registered input schema and description still carry no section field.
 *
 * Exit: 0 PASS, 1 FAIL. No em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Isolate room resolution: no user registry, no active-room env.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cr01-home-'));
process.env.MINDRIAN_ROOMS_HOME = HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_MCP_FIRST;

const chainTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'chain.cjs'));

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

const rooms = [];
function room() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'cr01-room-'));
  rooms.push(r);
  return r;
}
function putNeverDo(r, entries) {
  fs.mkdirSync(path.join(r, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(r, '.mindrian', 'never-do.json'), JSON.stringify({
    schema: 'mos.room-constraints/1',
    entries: entries.map((e) => ({
      kind: e.kind, value: e.value, why: 'Legal review comes first.',
      approved_via: { surface: 'cli', decision_node_id: 'decision-365-cr01' },
      approved_at: '2026-10-01T00:00:00.000Z',
    })),
  }), 'utf8');
}

// The REGISTERED handler, exactly as the MCP server would call it.
function handlerFor(roomDir) {
  const got = {};
  const server = { registerTool(name, opts, fn) { got[name] = { opts, fn }; }, server: {} };
  chainTool.register(server, { fallbackRoomDir: roomDir });
  return got.chain_run;
}
async function call(h, args, sessionId) {
  const res = await h.fn(args, { sessionId });
  return JSON.parse(res.content[0].text);
}

// Fixtures from the real registry: a safe step that files into market-analysis
// (/mos:analyze-needs) and a material step (/mos:bono) that is not named.
const FW_SECTION = 'Jobs to Be Done (JTBD)';
const FW_MATERIAL = 'Six Thinking Hats';

(async () => {
  const resolved = chainTool.chainResolve([FW_MATERIAL, FW_SECTION]);
  check('FIXTURE: the frameworks resolve to the expected commands',
    resolved.length === 2 && resolved[0].command === '/mos:bono' && resolved[1].command === '/mos:analyze-needs',
    JSON.stringify(resolved.map((s) => s.command)));

  // ---- S1 START: a named section halts the chain through the handler ----------
  {
    const r = room();
    putNeverDo(r, [{ kind: 'section', value: 'market-analysis' }]);
    const h = handlerFor(r);
    const out = await call(h, { chain: [FW_SECTION] }, 'sess-cr01-start');
    check('S1 the chain halts at the step that files into the named section', out.halted === true, JSON.stringify(out).slice(0, 300));
    check('S1 the halt reason is constraint_named',
      out.halted_at && out.halted_at.reason === 'constraint_named', JSON.stringify(out.halted_at));
    check('S1 the matched entry is the section entry',
      out.halted_at && out.halted_at.constraint && out.halted_at.constraint.kind === 'section'
      && out.halted_at.constraint.value === 'market-analysis', JSON.stringify(out.halted_at && out.halted_at.constraint));
  }

  // ---- S2 control: no entry, or an entry for another section, does not halt ----
  {
    const r = room();
    const h = handlerFor(r);
    const out = await call(h, { chain: [FW_SECTION] }, 'sess-cr01-ctl1');
    check('S2 with no never-do entry the safe step runs and the chain completes', out.completed === true && out.halted === false, JSON.stringify(out).slice(0, 300));
    const r2 = room();
    putNeverDo(r2, [{ kind: 'section', value: 'legal' }]);
    const out2 = await call(handlerFor(r2), { chain: [FW_SECTION] }, 'sess-cr01-ctl2');
    check('S2 an entry for a different section does not halt this step', out2.completed === true && out2.halted === false, JSON.stringify(out2).slice(0, 300));
  }

  // ---- S3 RESUMED TAIL: material halt, approve, then the named section halts ---
  {
    const r = room();
    putNeverDo(r, [{ kind: 'section', value: 'market-analysis' }]);
    const h = handlerFor(r);
    const sid = 'sess-cr01-tail';
    const first = await call(h, { chain: [FW_MATERIAL, FW_SECTION] }, sid);
    check('S3 the chain first halts at the material step (not the named section)',
      first.halted === true && first.halted_at && first.halted_at.reason !== 'constraint_named'
      && first.halted_at.step && first.halted_at.step.command === '/mos:bono', JSON.stringify(first.halted_at && first.halted_at.reason));
    const gateId = first.gate && first.gate.gate_id;
    check('S3 a gate id was minted for the material halt', typeof gateId === 'string' && gateId.length > 0);
    const resumed = await call(h, { gate_answer: { gate_id: gateId, chosen: ['approve'], verdict: 'approve' } }, sid);
    check('S3 the approved material step executed and the tail did not complete',
      resumed.executed === true && resumed.completed !== true, JSON.stringify(resumed).slice(0, 400));
    check('S3 the resumed tail halts at the named section with constraint_named',
      resumed.halted === true && resumed.halted_at && resumed.halted_at.reason === 'constraint_named'
      && resumed.halted_at.constraint && resumed.halted_at.constraint.kind === 'section',
      JSON.stringify(resumed.halted_at));
  }

  // ---- S4 the schema and description are untouched: no section input exists ----
  {
    const h = handlerFor(room());
    const keys = Object.keys(h.opts.inputSchema.shape || {}).sort();
    check('S4 chain_run input fields are unchanged',
      JSON.stringify(keys) === JSON.stringify(['chain', 'evidence_node_ids', 'gate_answer', 'subject_node_id']), JSON.stringify(keys));
  }

  check('the run made no network attempt', net.attempts() === 0);
  rooms.concat([HOME]).forEach((r) => { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
  net.restore();

  if (hardFail > 0) {
    process.stdout.write('FAIL: ' + hardFail + ' check(s) failed\n');
    process.exit(1);
  }
  process.stdout.write('PASS: test-365-cr01-section-live\n');
  process.exit(0);
})().catch((e) => {
  process.stdout.write('FAIL: test-365-cr01-section-live -- ' + (e && e.stack || e) + '\n');
  process.exit(1);
});
