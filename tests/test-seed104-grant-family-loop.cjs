'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 261002-0n4 -- SEED-104 regression: the research grant family loop,
 * egress-safe terms, and the grant_scope_cannot_cover_plan loop guard.
 *
 *   S0      whitespace golden (byte-identical proposal, card, grant, queries)
 *   S1-S6   unit legs (families term gate, grants scope, scopeGain)
 *   S7-S9   core legs (loop guard, stale prose plan, re-approval widening)
 *   E1-E5   end-to-end through the research_run and gate_answer MCP tools
 *
 * No live network: the hygiene net guard is installed before any repo module is
 * required, and the final leg asserts it counted zero attempts. Temp HOME and
 * MINDRIAN_ROOMS_HOME; never touches a real room.
 *
 * `node tests/test-seed104-grant-family-loop.cjs --capture` writes the golden
 * fixture (tests/fixtures/seed104/whitespace-golden.json) and exits 0.
 *
 * No em-dash or en-dash literals: spelled with String.fromCharCode where needed.
 * Exit 0 pass, 1 fail.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos104-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos104-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('SEED-104 grant family loop');

const assert = require('node:assert/strict');
const { buildRoom363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
const { makeReplayFetch } = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));

const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planner = require(path.join(RP, 'planner.cjs'));
const quick = require(path.join(RP, 'quick.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const families = require(path.join(RP, 'families.cjs'));
const planMod = require(path.join(RP, 'plan.cjs'));
const Q = require(path.join(RP, 'question-templates.cjs'));

const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
function qsFile(name) { return JSON.parse(fs.readFileSync(path.join(QS_DIR, name + '.json'), 'utf8')); }
const GOLDEN_FILE = path.join(ROOT, 'tests', 'fixtures', 'seed104', 'whitespace-golden.json');

const NOW = Date.parse('2026-10-02T00:00:00.000Z');
const VIA = { surface: 'cli', decision_node_id: 'dn-104-test' };
const PROSE = '**Claim.** A stable emulsion';

const rooms = [];
function newRoom(role) {
  const r = buildRoom363({ role: role || 'founder' });
  rooms.push(r);
  return r;
}

// ---------------------------------------------------------------------------
// S0 -- the whitespace snapshot (captured on the unedited tree)
// ---------------------------------------------------------------------------
function whitespaceSnapshot() {
  const room = newRoom('founder');
  const roomDir = room.roomDir;
  const built = planner.buildPlan(roomDir, qsFile('whitespace-quick'), { mode: 'quick', now: new Date(NOW) });
  assert.equal(built.ok, true, JSON.stringify(built).slice(0, 300));
  const loaded = planner.loadPlan(roomDir, built.run_id);
  assert.equal(loaded.ok, true);
  const plan = loaded.plan;

  const queries = [];
  plan.leaves.forEach(function (leaf) {
    (leaf.queries || []).forEach(function (q) {
      queries.push({ leaf: leaf.id, template_id: q.template_id, family: q.family, q: q.q, q_hash: q.q_hash, slot_terms: q.slot_terms });
    });
  });

  const cover = quick.coverFor(roomDir, plan, { now: NOW });
  const card = planner.cardFor(roomDir, plan, { now: NOW });
  const approved = planner.approveStandingGrant(roomDir, cover.proposal, { approvedVia: 'cli', terms: cover.new_terms });
  assert.equal(approved.ok, true, JSON.stringify(approved).slice(0, 300));
  const grant = JSON.parse(JSON.stringify(approved.grant));
  grant.grant_id = '<volatile>';
  grant.approved_at = '<volatile>';
  grant.expires_at = '<volatile>';
  grant.approved_via.decision_node_id = '<volatile>';
  grant.approved_terms.forEach(function (t) {
    t.approved_at = '<volatile>';
    t.approved_via.decision_node_id = '<volatile>';
  });
  const g11 = grants.grantCard(
    grants.buildStandingProposal(roomDir, { terms: [{ term: 'thin-film sensors', synonyms: ['dielectric probes'] }] }),
    { newTerms: ['thin-film sensors'], now: NOW }
  );

  const snap = {
    queries: queries,
    cover: { covered: cover.covered, reason: cover.reason, new_terms: cover.new_terms, proposal: cover.proposal, card: cover.card },
    card_for: { next: card.next, reason: card.reason },
    grant: grant,
    g11_card: g11,
  };
  const text = JSON.stringify(snap, null, 2).split(grants.roomIdFor(roomDir)).join('<room_id>');
  return JSON.parse(text);
}

if (process.argv.indexOf('--capture') !== -1) {
  fs.mkdirSync(path.dirname(GOLDEN_FILE), { recursive: true });
  fs.writeFileSync(GOLDEN_FILE, JSON.stringify(whitespaceSnapshot(), null, 2) + '\n', 'utf8');
  console.log('captured ' + path.relative(ROOT, GOLDEN_FILE));
  process.exit(0);
}

async function leg(name, fn) {
  try {
    await fn();
    check(name, true);
  } catch (e) {
    check(name, false, String((e && e.message) || e).slice(0, 260));
  }
}

async function main() {
  await leg('S0 whitespace proposal, card, grant and queries are byte-identical to the golden', function () {
    const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
    assert.deepEqual(whitespaceSnapshot(), golden);
  });

  // LEGS_HERE

  await leg('Z net guard counted zero fetch attempts', function () {
    assert.equal(guard.attempts(), 0);
  });
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(summary());
}

main();
