'use strict';
// Phase 150.8-04 Task 1 (DIKW-08) -- Confirm-proposed-claims via confirmNode.
//
// The post-filing "Confirm proposed claims" F.1 verb routes a per-claim APPROVE
// through the SHIPPED confirmNode chokepoint (lib/core/navigation/confirm-node.cjs,
// re-exported at navigation.cjs). This driver proves the thin dispatch:
//   1. A claim minted at review_status='proposed' (writeClaimNode) flips to
//      'confirmed' via navigation.confirmNode(db, id, navigation.resolveByUser(roomDir)).
//   2. byUser is resolved from USER.md (Canon Part 9 D-02); a literal agent
//      identity ('larry' / 'brain' / 'system' / 'assistant') is REJECTED with
//      agent_attribution_forbidden (Canon Part 9 role 5, threat T-150.8-13).
//   3. resolveByUser coerces an agent-literal USER.md identity to the
//      NAVIGATOR_DEFAULT (defense in depth -- a poisoned USER.md cannot smuggle an
//      agent attribution into a confirm).
//   4. 'claim' is in the Part 9 truth-claim set, so confirmNode works on it
//      unchanged (no new machinery).
//
// node:sqlite unavailable -> SKIP 77. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-confirm-claim-flow.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { applySchema } = require(path.join(REPO_ROOT, 'tests', 'claim-harness', 'build-fixture-room-db.cjs'));
const { DatabaseSync } = require('node:sqlite');

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('  ok - ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('  FAIL - ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

console.log('test-confirm-claim-flow');

// Build a bare in-memory room.db + an isolated room dir with a USER.md.
function makeRoomDir(userMdBody) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'confirm-claim-'));
  if (typeof userMdBody === 'string') {
    fs.writeFileSync(path.join(roomDir, 'USER.md'), userMdBody, 'utf8');
  }
  return roomDir;
}

function mintProposedClaim(db) {
  const r = navigation.writeClaimNode(db, {
    knowledge_type: 'fact',
    text: 'A proposed claim awaiting human confirmation',
    sessionId: 'sess-confirm',
    sourceSegment: 'seg-1',
  });
  assert.equal(r.ok, true, 'writeClaimNode must succeed: ' + JSON.stringify(r));
  return r.node_id;
}

// (1) proposed -> confirmed via confirmNode with a USER.md-resolved byUser.
check('a proposed claim flips to confirmed via confirmNode + resolveByUser(USER.md)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const id = mintProposedClaim(db);

  const before = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  assert.equal(before.review_status, 'proposed', 'must mint at proposed');

  const roomDir = makeRoomDir('---\nuser_id: jonathan\ncanonical_role: founder\n---\n# Navigator\n');
  const byUser = navigation.resolveByUser(roomDir);
  assert.equal(byUser, 'jonathan', 'resolveByUser must read USER.md user_id');

  const res = navigation.confirmNode(db, id, byUser, 'human-approved post-filing');
  assert.equal(res.ok, true, 'confirmNode must succeed: ' + JSON.stringify(res));

  const after = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  assert.equal(after.review_status, 'confirmed', 'the claim must be confirmed');

  db.close();
  fs.rmSync(roomDir, { recursive: true, force: true });
});

// (2) A literal agent byUser is REJECTED (agent_attribution_forbidden).
check('a literal agent byUser is rejected (agent_attribution_forbidden, Part 9 role 5)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const id = mintProposedClaim(db);

  for (const agent of ['larry', 'brain', 'system', 'assistant']) {
    const res = navigation.confirmNode(db, id, agent, 'agent tried to self-confirm');
    assert.equal(res.ok, false, 'agent ' + agent + ' must be rejected');
    assert.equal(res.reason, 'agent_attribution_forbidden',
      'rejection reason must name the agent-attribution guard for ' + agent);
  }

  // The claim stayed proposed -- no agent shortcut to confirmed.
  const after = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  assert.equal(after.review_status, 'proposed', 'the claim must remain proposed after agent attempts');
  db.close();
});

// (3) resolveByUser coerces a poisoned (agent-literal) USER.md to NAVIGATOR_DEFAULT.
check('resolveByUser coerces an agent-literal USER.md identity to NAVIGATOR_DEFAULT', () => {
  const roomDir = makeRoomDir('---\nuser_id: larry\n---\n# Poisoned\n');
  const byUser = navigation.resolveByUser(roomDir);
  assert.equal(byUser, navigation.NAVIGATOR_DEFAULT,
    'an agent-literal USER.md must coerce to the navigator default');
  assert.notEqual(byUser.toLowerCase(), 'larry', 'must never surface the agent literal');

  // And a confirm with that coerced byUser is canon-legal (NAVIGATOR_DEFAULT is
  // NOT an agent identity).
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const id = mintProposedClaim(db);
  const res = navigation.confirmNode(db, id, byUser, 'coerced navigator confirm');
  assert.equal(res.ok, true, 'a NAVIGATOR_DEFAULT confirm must be legal: ' + JSON.stringify(res));
  db.close();
  fs.rmSync(roomDir, { recursive: true, force: true });
});

// (4) An absent USER.md resolves to NAVIGATOR_DEFAULT (the stable non-agent default).
check('an absent USER.md resolves to NAVIGATOR_DEFAULT', () => {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'confirm-claim-nouser-'));
  const byUser = navigation.resolveByUser(roomDir);
  assert.equal(byUser, navigation.NAVIGATOR_DEFAULT, 'no USER.md -> NAVIGATOR_DEFAULT');
  fs.rmSync(roomDir, { recursive: true, force: true });
});

if (failures > 0) {
  process.stdout.write('\ntest-confirm-claim-flow.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\ntest-confirm-claim-flow.cjs: PASSED (confirm routes through confirmNode; agent attribution rejected)\n');
process.exit(0);
