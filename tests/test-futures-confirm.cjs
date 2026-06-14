#!/usr/bin/env node
/**
 * Phase 156 Plan 03 -- unit test for the per-ring Decision Gate (FW-10, Part 9).
 *
 * Asserts (node built-in assert, no framework):
 *   - a freshly generated consequence node is review_status='proposed'
 *   - after confirmRingDecisions APPROVE it is 'confirmed' with a byUser
 *     attribution that is NOT an agent identity (not larry/brain/system)
 *   - an APPROVE attempted with an agent USER.md identity is COERCED to the
 *     navigator default (resolveByUser never returns larry/brain/system)
 *   - a REJECT writes a REJECTED_BECAUSE edge (frozen-legal) with a scalar
 *     reason property; a DEFER writes a DEFERRED edge
 *   - surfaceBridgesAtGate surfaces at least one cross-domain bridge that is NOT
 *     a direct ROOT_CAUSES ring link (the do-what-a-human-cannot ripple)
 *   - promotion routes through navigation.confirmNode (source grep), never a
 *     direct promoteNodeStatus or raw UPDATE on review_status in orchestrator.cjs
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUITE = 'test-futures-confirm';
const REPO = path.join(__dirname, '..');
const orch = require(path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const { surfaceBridgesAtGate, confirmRingDecisions } = orch;

function reviewStatusOf(db, id) {
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  return row ? row.review_status : null;
}
function confirmedByOf(db, id) {
  const row = db.prepare('SELECT confirmed_by FROM nodes WHERE id = ?').get(id);
  return row ? row.confirmed_by : null;
}

(async () => {
  let tmp;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-confirm-'));
    // A human navigator identity in USER.md (NOT an agent).
    fs.writeFileSync(path.join(tmp, 'USER.md'), '---\nuser_id: jonathan\ncanonical_role: founder\n---\n# notes\n', 'utf8');

    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    const db = openRoomDb(tmp);

    // The Decision Gate REJECT/DEFER edges target a stable gate node; seed it +
    // the consequence truth-claim nodes (CausalClaim is a truth-claim type, so
    // the Part 9 agent-attribution guard applies on confirm).
    insertNode(db, 'futures:gate', 'decision', JSON.stringify({ title: 'futures gate' }));
    for (const id of ['cons-approve', 'cons-reject', 'cons-defer', 'cons-agent']) {
      insertNode(db, id, 'CausalClaim', JSON.stringify({ title: id }));
    }

    // Fresh consequence nodes land at review_status='proposed' (the DEFAULT).
    assert.strictEqual(reviewStatusOf(db, 'cons-approve'), 'proposed', 'fresh consequence is proposed');

    // --- confirmRingDecisions: APPROVE / REJECT / DEFER ---
    const result = confirmRingDecisions(db, tmp, [
      { id: 'cons-approve', verb: 'APPROVE' },
      { id: 'cons-reject', verb: 'REJECT', reason: 'low_evidence' },
      { id: 'cons-defer', verb: 'DEFER' },
    ]);

    // APPROVE -> confirmed with a human byUser (NOT an agent identity).
    assert.strictEqual(reviewStatusOf(db, 'cons-approve'), 'confirmed', 'APPROVE promotes proposed->confirmed');
    assert.strictEqual(confirmedByOf(db, 'cons-approve'), 'jonathan', 'confirmed_by is the human navigator');
    assert.strictEqual(result.byUser, 'jonathan', 'resolved byUser is the human navigator');
    for (const agent of ['larry', 'brain', 'system', 'assistant']) {
      assert.notStrictEqual(result.byUser, agent, 'byUser is NOT the agent identity ' + agent);
    }
    assert.deepStrictEqual(result.confirmed.map((c) => c.id), ['cons-approve'], 'one confirmed');

    // REJECT -> REJECTED_BECAUSE edge with a scalar reason property.
    const rej = db.prepare("SELECT source, target, properties FROM edges WHERE type = 'REJECTED_BECAUSE'").all();
    assert.strictEqual(rej.length, 1, 'one REJECTED_BECAUSE edge');
    assert.strictEqual(rej[0].source, 'cons-reject', 'reject edge source is the rejected consequence');
    const rejProps = JSON.parse(rej[0].properties || '{}');
    assert.strictEqual(rejProps.reason, 'low_evidence', 'reason rides as a scalar reason-code');
    assert.ok(!/title|body/.test(JSON.stringify(rejProps)), 'no body text on the reject edge (Part 8)');

    // DEFER -> DEFERRED edge.
    const def = db.prepare("SELECT source, target FROM edges WHERE type = 'DEFERRED'").all();
    assert.strictEqual(def.length, 1, 'one DEFERRED edge');
    assert.strictEqual(def[0].source, 'cons-defer', 'defer edge source is the deferred consequence');

    // --- Agent-identity coercion: a poisoned USER.md cannot smuggle an agent. ---
    fs.writeFileSync(path.join(tmp, 'USER.md'), '---\nuser_id: larry\n---\n', 'utf8');
    const agentResult = confirmRingDecisions(db, tmp, [{ id: 'cons-agent', verb: 'APPROVE' }]);
    assert.strictEqual(agentResult.byUser, 'navigator', 'agent USER.md identity coerced to navigator default');
    assert.strictEqual(reviewStatusOf(db, 'cons-agent'), 'confirmed', 'still confirmed but under the navigator default, never larry');
    assert.strictEqual(confirmedByOf(db, 'cons-agent'), 'navigator', 'confirmed_by is the coerced navigator, NOT larry');

    // --- surfaceBridgesAtGate: a cross-domain bridge NOT a direct ring link. ---
    const bridges = [
      // cross-domain ripple the navigator did NOT draw (automobile -> middle-manager)
      { source: 'automobile-r1', target: 'middle-manager-r3', hsi_score: 0.81, crossDomain: true },
      // a direct ROOT_CAUSES ring parent->child link (excluded from surfaced)
      { source: 'automobile-r1', target: 'gas-stations-r1', hsi_score: 0.6, crossDomain: true },
      // a same-domain bridge (not surfaced)
      { source: 'a', target: 'b', hsi_score: 0.4, crossDomain: false },
    ];
    const ringParentLinks = new Set(['automobile-r1->gas-stations-r1']);
    const ringConsequences = [
      { id: 'middle-manager-r3', label: 'Middle manager invented', domain: 'Social', ring: 3 },
    ];
    const gate = surfaceBridgesAtGate(tmp, bridges, ringConsequences, { ringParentLinks });
    assert.deepStrictEqual(gate.verbs, ['APPROVE', 'REJECT', 'DEFER'], 'tri-context F.1 verbs');
    assert.strictEqual(gate.surface, 'F.1', 'gate uses the Shape F.1 selector');
    assert.ok(gate.bridges.length >= 1, 'at least one cross-domain bridge surfaced');
    const surfacedPair = gate.bridges.map((b) => b.source + '->' + b.target);
    assert.ok(surfacedPair.indexOf('automobile-r1->middle-manager-r3') >= 0, 'the do-what-a-human-cannot ripple is surfaced');
    assert.ok(surfacedPair.indexOf('automobile-r1->gas-stations-r1') < 0, 'the direct ring ROOT_CAUSES link is NOT surfaced');
    assert.strictEqual(gate.ring, 3, 'gate ring is taken from the batch');
    // Part 8: the BRAIN panel carries only a generic methodology handle.
    assert.strictEqual(gate.contexts.brain.methodology, 'Futures Wheel', 'BRAIN panel is a generic framework handle only');

    closeRoomDb(db);

    // --- SOURCE gate: promotion routes through confirmNode, never a raw UPDATE. ---
    const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs'), 'utf8');
    assert.ok(/confirmNode\(/.test(src), 'orchestrator promotes via navigation.confirmNode');
    const codeLines = src.split(/\r?\n/).filter((ln) => {
      const t = ln.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    });
    const codeBlob = codeLines.join('\n');
    assert.ok(!/promoteNodeStatus\(/.test(codeBlob), 'no direct promoteNodeStatus call');
    assert.ok(!/UPDATE\s+nodes\s+SET\s+review_status/i.test(codeBlob), 'no raw UPDATE on review_status');

    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    console.log('PASS ' + SUITE);
    process.exit(0);
  } catch (e) {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
    console.error('FAIL ' + SUITE + ': ' + (e && e.message));
    console.error(e && e.stack);
    process.exit(1);
  }
})();
