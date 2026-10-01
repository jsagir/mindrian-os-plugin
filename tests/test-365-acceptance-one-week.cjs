#!/usr/bin/env node
'use strict';

/*
 * Phase 365-02 -- the ONE-WEEK acceptance test, red at base.
 *
 * Process 1 (this file): a claim is filed through the meeting tool, a model is
 * asked about it (claim_verify, method ask, declared rung 2), and a person
 * approves the confirmation card through gate_answer, in a scratch room with
 * no ROOM.md (so the default floor applies once it exists).
 *
 * Process 2 (tests/helpers/one-week-365-child.cjs, spawned fresh): stands in
 * for "a week later". It asks the room about the claim through claim_read and
 * reads the stored status through a fresh room.db handle. The verdict below is
 * computed from the CHILD's output, never from this process's module state.
 *
 * Signatures on failure:
 *   RED-365-ONEWEEK-STATUS    model-checked claim reached confirmed
 *                             (healed by 365-08, the floor)
 *   RED-365-ONEWEEK-STANDING  claim_read does not name what the claim was
 *                             checked against in standing words
 *                             (healed by 365-15, the shared words map)
 *
 * Exit: 0 PASS, 1 FAIL, 77 ENV GAP. No em-dashes.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const { registerRouterTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const gateTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
const claimVerify = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'claim-verify.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

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

async function main() {
  let room;
  try {
    room = fx.makeRoom365('oneweek');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  const reds = [];
  try {
    const { server, handlers } = fx.captureToolServer();
    registerRouterTools(server, room.room, REPO_ROOT, { full: '' }, 'cli');
    gateTool.register(server, { fallbackRoomDir: room.room, pluginRoot: REPO_ROOT, surface: 'cli' });
    claimVerify.register(server, { fallbackRoomDir: room.room, pluginRoot: REPO_ROOT, surface: 'cli' });
    const extra = { sessionId: 'test-365-oneweek' };

    // Process 1: file, ask a model, approve.
    const filedRaw = await handlers.get('meeting')({
      command: 'file-meeting', knowledge_type: 'fact',
      claim_text: 'Synthetic one-week claim: the unit price fell by a third.',
    }, extra);
    const filedText = textOf(filedRaw);
    const gm = /gate_id[:*"\s]+\**\s*([A-Za-z0-9._-]+)/.exec(filedText);
    const cm = /Claim node (\S+) was written/.exec(filedText);
    const gateId = gm ? gm[1] : null;
    const claimId = cm ? cm[1] : null;
    check('file-meeting returned a gate_id and a claim id', !!gateId && !!claimId, filedText.slice(0, 200));
    if (!gateId || !claimId) return 1;

    const verifyRaw = await handlers.get('claim_verify')({
      claim_id: claimId, against_id: 'model:counter-argument', against_kind: 'artifact',
      method: 'ask', result: 'supports', rung: 2, checked_by: 'system',
    }, extra);
    const verifyJson = jsonOf(verifyRaw);
    check('claim_verify recorded an ask check at declared rung 2',
      !!verifyJson && verifyJson.ok === true, textOf(verifyRaw).slice(0, 200));

    const answerRaw = await handlers.get('gate_answer')(
      { gate_id: gateId, chosen: ['approve'], verdict: 'approve' }, extra);
    const answerJson = jsonOf(answerRaw);
    check('gate_answer approve returned a verdict response', !!answerJson, textOf(answerRaw).slice(0, 200));

    // Process 2: a fresh node process, one week later.
    const child = spawnSync(process.execPath,
      [path.join(REPO_ROOT, 'tests', 'helpers', 'one-week-365-child.cjs'), room.room, claimId],
      { env: Object.assign({}, process.env), encoding: 'utf8', timeout: 60000 });
    if (child.error || child.status !== 0) {
      check('the second process ran to completion', false,
        'status=' + child.status + ' ' + String((child.error && child.error.message) || child.stderr).slice(0, 300));
      return 1;
    }
    const lines = String(child.stdout).trim().split('\n').filter((l) => l.length > 0);
    let out = null;
    try { out = JSON.parse(lines[lines.length - 1]); } catch (_e) { out = null; }
    check('the second process printed one JSON verdict line', !!out, String(child.stdout).slice(0, 300));
    if (!out) return 1;

    // The second reader's own fresh-handle read, never the tool response.
    const parentStatus = fx.readStatus(room.room, claimId);
    check('the parent fresh-handle status agrees with the child', parentStatus === out.review_status,
      parentStatus + ' vs ' + out.review_status);

    process.stdout.write('  observed: review_status=' + out.review_status
      + ' confirmed_events=' + out.confirmed_events + '\n');
    process.stdout.write('  observed rendered_claim:\n' + String(out.rendered_claim).split('\n').map((l) => '    | ' + l).join('\n') + '\n');

    if (out.review_status === 'confirmed' || out.confirmed_events > 0) {
      reds.push('RED-365-ONEWEEK-STATUS: model-checked claim reached confirmed');
    }

    const words = navigation.STANDING_WORDS;
    const label = words && words.model_only && typeof words.model_only.label === 'string'
      ? words.model_only.label : null;
    process.stdout.write('  observed: STANDING_WORDS.model_only.label=' + JSON.stringify(label) + '\n');
    const rendered = String(out.rendered_claim || '');
    const namesAsk = /\bask(ed)?\b/i.test(rendered);
    if (!(label && label.length > 0 && rendered.indexOf(label) !== -1 && namesAsk)) {
      reds.push('RED-365-ONEWEEK-STANDING: claim_read does not name what C was checked against in standing words');
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
  process.stdout.write('PASS: a model-checked claim is below the floor and the room says so in standing words\n');
  return 0;
}

main().then((code) => { process.exitCode = code; }, (e) => {
  process.stdout.write('UNCAUGHT: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
});
