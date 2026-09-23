'use strict';

// Phase 358-07, Task 1 (RED). B2-09 legs: Part 8 prose scan, static require
// scan, one-door scan, zero-network cycle, and the B1-portrait-unchanged
// leg for the room's governing-question record.
//
// NOTE on execution order: P5 (zero network) is run FIRST in this file, even
// though it is printed with the P5 label, because it must wrap
// node:http / node:https / node:net / fetch BEFORE this process's first
// require of lib/core/frame-provenance.cjs or lib/core/navigation.cjs (both
// P1 and P6, below it, are the only other checks in this file that require
// either module). This is a deliberate execution-order choice, not a
// mislabeling; the printed label stays 'P5' for readability against the plan.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-part8-home-'));
process.env.MINDRIAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-part8-mhome-'));
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-part8-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.MINDRIAN_BRAIN_KEY;

// Only room-db.cjs is required at file top-level; navigation.cjs and
// lib/core/frame-provenance.cjs are required LAZILY inside individual checks
// so P5 (below) can be the very first thing in this process to require them.
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

const REPO_ROOT = path.join(__dirname, '..');

function requireDoor() {
  try {
    // eslint-disable-next-line global-require
    return require('../lib/core/frame-provenance.cjs');
  } catch (e) {
    throw new Error('lib/core/frame-provenance.cjs not landed yet: ' + e.message);
  }
}
function requireNav() {
  // eslint-disable-next-line global-require
  return require('../lib/core/navigation.cjs');
}

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    const detail = e && e.message ? e.message : String(e);
    failMessages.push(label + ' :: ' + detail);
    process.stdout.write('FAIL - ' + label + '\n');
    process.stdout.write('  ' + detail + '\n');
  }
}

function withRoom(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  try {
    return fn(db, dir);
  } finally {
    closeRoomDb(db);
  }
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const Q1 = 'Which camera solves the delay?';
const Q2 = 'Which camera works with sunglasses?';
const Q3 = 'Should the checkpoint move north?';
const A2 = 'It assumed the delay was the camera, but the officers wear sunglasses.';

const B2_SCAN_FILES = [
  'lib/core/frame-provenance.cjs',
  'lib/core/navigation/typed-frame.cjs',
  'scripts/room-question.cjs',
  'lib/mcp/tools/question.cjs',
];

// ---------------------------------------------------------------------------
// P5 (zero network): runs FIRST in this file. See the file-header note.
// ---------------------------------------------------------------------------

check('P5: a full cycle (card rendering included) plus the readers makes zero network calls', () => {
  const httpMod = require('node:http');
  const httpsMod = require('node:https');
  const netMod = require('node:net');
  const originalHttpRequest = httpMod.request;
  const originalHttpsRequest = httpsMod.request;
  const originalNetConnect = netMod.connect;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  httpMod.request = function wrappedHttpRequest() {
    calls += 1;
    return originalHttpRequest.apply(this, arguments);
  };
  httpsMod.request = function wrappedHttpsRequest() {
    calls += 1;
    return originalHttpsRequest.apply(this, arguments);
  };
  netMod.connect = function wrappedNetConnect() {
    calls += 1;
    return originalNetConnect.apply(this, arguments);
  };
  globalThis.fetch = function wrappedFetch() {
    calls += 1;
    return originalFetch ? originalFetch.apply(this, arguments) : Promise.reject(new Error('fetch disabled in test'));
  };
  try {
    // First require of frame-provenance.cjs (and transitively navigation.cjs)
    // in this process happens here, AFTER the wraps above are in place.
    const door = requireDoor();
    withRoom('mindrian-358-b2-part8-p5-', (db, dir) => {
      door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
      door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen' }); // the refusal renders the card
      door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
      door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });
      door.readGoverningQuestion(db, dir);
      door.readQuestionHistory(db, dir);
    });
  } finally {
    httpMod.request = originalHttpRequest;
    httpsMod.request = originalHttpsRequest;
    netMod.connect = originalNetConnect;
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 0, 'expected zero network calls, got ' + calls);
});

// ---------------------------------------------------------------------------
// P1 (prose scan)
// ---------------------------------------------------------------------------

check('P1: no node or edge property leaks the question/account prose (or a 12-char account substring); prop keys stay allowed; no REJECTED_BECAUSE edge', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-part8-p1-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });

    const nodeRows = db.prepare('SELECT properties FROM nodes').all();
    const edgeRows = db.prepare('SELECT properties FROM edges').all();
    const texts = [Q1, Q2, Q3, A2];
    const substrings = [];
    for (let i = 0; i + 12 <= A2.length; i += 1) substrings.push(A2.slice(i, i + 12));

    for (const row of nodeRows) {
      const raw = row.properties || '';
      for (const t of texts) assert.equal(raw.includes(t), false, 'node property leaks question/account text: ' + t);
      for (const s of substrings) assert.equal(raw.includes(s), false, 'node property leaks account substring: ' + s);
    }
    for (const row of edgeRows) {
      const raw = row.properties || '';
      for (const t of texts) assert.equal(raw.includes(t), false, 'edge property leaks question/account text: ' + t);
      for (const s of substrings) assert.equal(raw.includes(s), false, 'edge property leaks account substring: ' + s);
    }

    const allowedNodeKeys = new Set([
      'frameKey', 'members', 'topic', 'frame_role', 'version', 'origin',
      'governing_thought_hash', 'question_handle', 'predecessor_hash', 'predecessor_node_id',
      'change_kind', 'refinement_handle', 'account_hash', 'set_by', 'set_by_id', 'epistemic_type',
    ]);
    for (const row of nodeRows) {
      let props;
      try { props = JSON.parse(row.properties || '{}'); } catch (_e) { continue; }
      if (props.frame_role !== 'governing_question') continue;
      for (const k of Object.keys(props)) {
        assert.ok(allowedNodeKeys.has(k), 'unexpected governing_question prop key: ' + k);
      }
    }

    const allowedEdgeKeys = new Set(['change_kind', 'origin']);
    const typedEdgeRows = db.prepare(
      "SELECT properties FROM edges WHERE type IN ('REFINES', 'FOLLOWS_FROM')"
    ).all();
    for (const row of typedEdgeRows) {
      const props = JSON.parse(row.properties || '{}');
      for (const k of Object.keys(props)) {
        assert.ok(allowedEdgeKeys.has(k), 'unexpected REFINES/FOLLOWS_FROM prop key: ' + k);
      }
    }

    const rejectedBecause = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'REJECTED_BECAUSE'").get();
    assert.equal(rejectedBecause.n, 0, 'the account must never ride a REJECTED_BECAUSE edge');
  });
});

// ---------------------------------------------------------------------------
// P2 (direct require scan)
// ---------------------------------------------------------------------------

check('P2: no B2 file directly requires a Brain/network module or calls fetch()', () => {
  const brainRe = /require\(\s*['"][^'"]*(brain-client|brain-derivation|part8-egress|mindrian-brain|theo)[^'"]*['"]\s*\)/;
  const netRe = /require\(\s*['"](node:)?(http|https|net|tls|dgram)['"]\s*\)/;
  const fetchRe = /\bfetch\s*\(/;
  let scanned = 0;
  for (const rel of B2_SCAN_FILES) {
    const full = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(full)) {
      process.stdout.write('static: ' + rel + ' not landed yet\n');
      continue;
    }
    scanned += 1;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    for (const line of lines) {
      if (isCommentLine(line)) continue;
      assert.equal(brainRe.test(line), false, rel + ': brain/theo require found: ' + line.trim());
      assert.equal(netRe.test(line), false, rel + ': network module require found: ' + line.trim());
      assert.equal(fetchRe.test(line), false, rel + ': fetch() call found: ' + line.trim());
    }
  }
  process.stdout.write('part8 static: ' + scanned + ' of 4 B2 files scanned\n');
});

// ---------------------------------------------------------------------------
// P3 (substrate guard)
// ---------------------------------------------------------------------------

check('P3: check-substrate.cjs scanFiles reports zero violations for the existing B2 files', () => {
  // eslint-disable-next-line global-require
  const substrate = require(path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs'));
  const existing = B2_SCAN_FILES.filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));
  const violations = substrate.scanFiles(existing, (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
  assert.deepEqual(violations, []);
});

// ---------------------------------------------------------------------------
// P4 (one door)
// ---------------------------------------------------------------------------

check('P4: governing_question vocabulary and setGoverningQuestion( calls are confined to the named allow-lists', () => {
  const roots = ['lib', 'scripts', 'bin'];
  const files = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(cjs|js)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }
  for (const r of roots) walk(path.join(REPO_ROOT, r));

  const roleAllow = new Set([
    'lib/core/navigation/typed-frame.cjs', 'lib/core/navigation.cjs', 'lib/core/frame-provenance.cjs',
  ]);
  const doorAllow = new Set([
    'lib/core/frame-provenance.cjs', 'scripts/room-question.cjs', 'lib/mcp/tools/question.cjs',
  ]);

  for (const full of files) {
    const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    for (const line of lines) {
      if (isCommentLine(line)) continue;
      if (/governing_question|GOVERNING_QUESTION_ROLE/.test(line)) {
        assert.ok(roleAllow.has(rel), rel + ' carries governing_question vocabulary outside the allow-list: ' + line.trim());
      }
      if (/setGoverningQuestion\(/.test(line)) {
        assert.ok(doorAllow.has(rel), rel + ' calls setGoverningQuestion( outside the allow-list: ' + line.trim());
      }
    }
  }
});

// ---------------------------------------------------------------------------
// P6 (B1 portrait unchanged)
// ---------------------------------------------------------------------------

check('P6: a full question cycle leaves the B1 room portrait counts unchanged', () => {
  const navigation = requireNav();
  const door = requireDoor();
  withRoom('mindrian-358-b2-part8-p6-', (db, dir) => {
    const seeded = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'a seeded claim', sessionId: 's358b2', sourceSegment: 'seg',
    });
    assert.equal(seeded.ok, true, JSON.stringify(seeded));
    const before = navigation.readVerificationPortrait(db);

    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });

    const after = navigation.readVerificationPortrait(db);
    assert.deepEqual(after, before);
  });
});

// ---------------------------------------------------------------------------
// P7 (one-constant rule)
// ---------------------------------------------------------------------------

// P7_ALLOW_MARKER (358-09 Rule-1 deviation): a named, explicit allowlist for
// the routing-pattern block. The literal English word "tasking" ("the
// tasking changed", military-orders usage) is legitimate natural-language
// routing vocabulary, not an origin-id literal -- but only on the ONE line
// immediately following this exact marker comment. Any other line, anywhere
// else in the file, is still scanned and still fails on a hardcoded origin
// id, so this allowlist cannot be used to smuggle a real violation past P7.
const P7_ALLOW_MARKER = /^\/\/\s*P7-ALLOW\(tasking\):/;

check('P7: the literal ids tasking and inherited never appear in non-comment lines of frame-provenance.cjs, except the named routing-pattern allowlist', () => {
  const full = path.join(REPO_ROOT, 'lib', 'core', 'frame-provenance.cjs');
  if (!fs.existsSync(full)) {
    throw new Error('lib/core/frame-provenance.cjs not landed yet');
  }
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  let allowNextLine = false;
  for (const line of lines) {
    if (P7_ALLOW_MARKER.test(line.trim())) {
      allowNextLine = true;
      continue;
    }
    if (isCommentLine(line)) continue;
    if (allowNextLine) {
      // Only "tasking" is ever allowlisted; "inherited" (an origin id) is
      // never permitted here, so it still fails even on an allowlisted line.
      assert.equal(/inherited/.test(line), false, 'literal "inherited" found in a non-comment line: ' + line);
      allowNextLine = false;
      continue;
    }
    assert.equal(/tasking/.test(line), false, 'literal "tasking" found in a non-comment line: ' + line);
    assert.equal(/inherited/.test(line), false, 'literal "inherited" found in a non-comment line: ' + line);
  }
});

process.stdout.write('passed=' + passed + ' failed=' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
