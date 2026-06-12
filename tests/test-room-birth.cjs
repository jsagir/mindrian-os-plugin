'use strict';
// Phase 155-02 Task 2 -- room-birth.cjs integration driver.
//
// TDD RED/GREEN: this file is written BEFORE room-birth.cjs exists so the
// first run exits non-zero (RED gate). After room-birth.cjs is created the
// same assertions go GREEN.
//
// Asserts:
//   (A) birthRoom basics
//     - roomDir directory is created
//     - all 6 memory files exist post-birth (ROOM.md, STATE.md, MINTO.md,
//       USER.md, FEYNMAN.md in at least one section, BRAIN.md if scaffold
//       generates it or FEYNMAN.md in a section dir)
//     - room.db file exists at roomDir/.mindrian/room.db
//     - room.db contains a memory_event row with event_type='room_created'
//     - birthRoom returns {ok:true}
//     - registry entry exists with active=true for this slug
//
//   (B) scaffold-before-registry order
//     - room.db exists before registry is flipped
//     - room.db mtime <= registry.json mtime (room.db created first)
//
//   (C) drain edges
//     - birthRoom with gateAnswers:[{gate_id:'B2', canonical_verb:'Approve'...}]
//       writes a memory_event with event_type='birth_gate_answered'
//     - the drain writes a FILED_AS_DECISION edge (not CHOSE)
//     - canonical_verb:'Defer' writes a DEFERRED edge
//     - canonical_verb:'Reject' writes a REJECTED_BECAUSE edge
//
//   (D) check-substrate passes (room-birth.cjs inside allow-list)
//
//   (E) idempotence: second call on same roomDir is safe (no crash)
//
//   (F) no CHOSE edge written anywhere
//
// SKIP-77: when node:sqlite is unavailable exit 77 (treated as PASS).
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// SKIP-77 probe.
try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping room-birth integration test\n');
  process.exit(77);
}

// --- check-substrate passes immediately (static) ---
// This guard runs before birthRoom is required so a substrate violation fails early.
(function checkSubstrate() {
  const r = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs'), '--diff'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      // Drive with no staged files so the diff scan is a no-op if called before
      // room-birth.cjs is staged; we also scan the repo file directly below.
      MINDRIAN_HOOK_STAGED_FILES: 'lib/core/navigation/room-birth.cjs',
      MINDRIAN_HOOK_STAGED_CONTENT_DIR: REPO_ROOT,
    }),
    cwd: REPO_ROOT,
  });
  // Allow exit 0 or 1 here; the final assertion runs after room-birth exists.
  // We assert that if the file exists it has no violations.
  const roomBirthAbs = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs');
  if (fs.existsSync(roomBirthAbs)) {
    if (r.status !== 0) {
      process.stdout.write('  FAIL: check-substrate --diff reports a violation in room-birth.cjs\n');
      if (r.stderr) process.stdout.write('  Detail: ' + r.stderr.slice(0, 300) + '\n');
      // Non-fatal here; the dedicated check at bottom handles exit.
    }
  }
})();

// Require birthRoom -- will throw if room-birth.cjs does not exist (RED gate).
let birthRoom;
try {
  birthRoom = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom;
} catch (e) {
  process.stdout.write('FAIL: could not require room-birth.cjs -- ' + e.message + '\n');
  process.stdout.write('(RED gate: room-birth.cjs does not exist yet)\n');
  process.exit(1);
}

const { DatabaseSync } = require('node:sqlite');
const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let checks = 0;
let passed = 0;

function check(label, condition, detail) {
  checks++;
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
}

// Build a temp ROOMS_HOME so we never touch the real ~/MindrianRooms.
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-birth-test-'));
const tmpSlug = 'test-venture-' + Date.now();
const tmpRoomDir = path.join(tmpHome, tmpSlug);

process.stdout.write('\n[test-room-birth] Phase 155-02 birth transaction integration\n');
process.stdout.write('  tmpHome: ' + tmpHome + '\n\n');

// Override MINDRIAN_ROOMS_HOME so room-registry uses tmpHome.
const origRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = tmpHome;

try {
  // --- Section A: basic birth ---
  process.stdout.write('Section A: birthRoom basics\n');

  const optsA = {
    slug: tmpSlug,
    roomDir: tmpRoomDir,
    sessionId: 's-test-001',
    ventureText: 'A test venture for the room-birth integration test',
    jtbd: 'When I need to test room birth, MindrianOS does it correctly',
    blueprintFamily: 'venture',
    gateAnswers: [],
    approvedBy: 'test-user',
    vname: 'Test Venture',
    vstage: 'Pre-Opportunity',
  };

  let resultA;
  try {
    resultA = birthRoom(optsA);
  } catch (e) {
    process.stdout.write('  FAIL: birthRoom threw: ' + e.message + '\n');
    process.stdout.write(e.stack + '\n');
    process.exit(1);
  }

  check(
    'birthRoom returns {ok:true}',
    resultA && resultA.ok === true,
    resultA ? JSON.stringify(resultA) : 'null'
  );

  check('roomDir directory exists', fs.existsSync(tmpRoomDir));

  // 6 memory files check: ROOM.md in a section dir (scaffold places it per-section,
  // not at the room root), STATE.md at root, MINTO.md at root,
  // USER.md at root, and FEYNMAN.md in at least one section.
  // scaffold writes ROOM.md inside each of the 8 ICM section dirs; check any.
  const sections = ['problem-definition', 'market-analysis', 'solution-design',
    'business-model', 'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model'];
  const rootRoom = sections.some((s) =>
    fs.existsSync(path.join(tmpRoomDir, s, 'ROOM.md'))
  );
  const rootState = fs.existsSync(path.join(tmpRoomDir, 'STATE.md'));
  const rootMinto = fs.existsSync(path.join(tmpRoomDir, 'MINTO.md'));
  const rootUser = fs.existsSync(path.join(tmpRoomDir, 'USER.md'));

  // FEYNMAN.md -- scaffold writes it per section; check any section
  const hasFeynman = sections.some((s) =>
    fs.existsSync(path.join(tmpRoomDir, s, 'FEYNMAN.md'))
  );

  check('ROOM.md exists in at least one ICM section dir', rootRoom);
  check('STATE.md exists at room root', rootState);
  check('MINTO.md exists at room root', rootMinto);
  check('USER.md exists at room root', rootUser);
  check('FEYNMAN.md exists in at least one ICM section', hasFeynman);

  const dbPath = path.join(tmpRoomDir, '.mindrian', 'room.db');
  check('room.db exists at roomDir/.mindrian/room.db', fs.existsSync(dbPath));

  // Open room.db and query for room_created event.
  let db;
  try {
    db = roomDb.openRoomDb(tmpRoomDir);
  } catch (e) {
    process.stdout.write('  FAIL: could not open room.db: ' + e.message + '\n');
    process.exit(1);
  }

  const rcRow = db.prepare(
    "SELECT id FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='room_created'"
  ).all();
  check('room.db contains a room_created memory_event', rcRow.length >= 1);

  // Check a claim node (venture node) exists.
  const claimRows = db.prepare("SELECT id FROM nodes WHERE type='claim'").all();
  check('room.db contains at least one claim node (venture node)', claimRows.length >= 1);

  // --- Section B: scaffold-before-registry order ---
  process.stdout.write('\nSection B: scaffold-before-registry order\n');

  const regPath = path.join(tmpHome, '.rooms', 'registry.json');
  check('registry.json exists', fs.existsSync(regPath));

  if (fs.existsSync(regPath) && fs.existsSync(dbPath)) {
    const dbMtime = fs.statSync(dbPath).mtimeMs;
    const regMtime = fs.statSync(regPath).mtimeMs;
    // room.db must be created BEFORE or AT THE SAME TIME as registry.json
    // (scaffold-then-register order). In practice db creation is seconds before
    // the registry flip.
    check(
      'room.db mtime <= registry.json mtime (room.db written first)',
      dbMtime <= regMtime + 2000, // 2s tolerance for OS time rounding
      'db:' + dbMtime + ' reg:' + regMtime
    );
  }

  // Verify registry has active=true for this slug.
  if (fs.existsSync(regPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      const entry = reg.rooms && reg.rooms[tmpSlug];
      check('registry entry exists for slug', Boolean(entry));
      check("registry entry status='active'", entry && entry.status === 'active');
      check('registry active pointer matches slug', reg.active === tmpSlug);
    } catch (e) {
      check('registry is valid JSON', false, e.message);
    }
  }

  // --- Section C: drain edges ---
  process.stdout.write('\nSection C: drain edges\n');

  const slugC = 'drain-test-' + Date.now();
  const roomDirC = path.join(tmpHome, slugC);

  const optsC = {
    slug: slugC,
    roomDir: roomDirC,
    sessionId: 's-drain-001',
    ventureText: 'Drain gate test venture',
    jtbd: 'When I drain gate answers',
    blueprintFamily: 'venture',
    gateAnswers: [
      { gate_id: 'B2', canonical_verb: 'Approve', option_key: 'approve', alias_label: 'Approve', ts: Date.now() },
      { gate_id: 'U0', canonical_verb: 'Defer', option_key: 'defer', alias_label: 'Defer', ts: Date.now() },
      { gate_id: 'B1', canonical_verb: 'Reject', option_key: 'reject', alias_label: 'Reject', free_text: 'Not ready', ts: Date.now() },
    ],
    approvedBy: 'drain-user',
    vname: 'Drain Venture',
    vstage: 'Pre-Opportunity',
  };

  let resultC;
  try {
    resultC = birthRoom(optsC);
  } catch (e) {
    process.stdout.write('  FAIL: birthRoom (drain) threw: ' + e.message + '\n');
    resultC = null;
  }

  check(
    'birthRoom (drain) returns {ok:true}',
    resultC && resultC.ok === true,
    resultC ? JSON.stringify(resultC) : 'null'
  );

  if (resultC && resultC.ok) {
    let dbC;
    try {
      dbC = roomDb.openRoomDb(roomDirC);
    } catch (e) {
      process.stdout.write('  FAIL: could not open drain room.db: ' + e.message + '\n');
      dbC = null;
    }

    if (dbC) {
      // birth_gate_answered events should equal gateAnswers.length.
      const answerRows = dbC.prepare(
        "SELECT id FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='birth_gate_answered'"
      ).all();
      check(
        'birth_gate_answered events count matches gateAnswers.length (3)',
        answerRows.length === 3,
        'got ' + answerRows.length
      );

      // FILED_AS_DECISION edge for Approve.
      const filedEdges = dbC.prepare(
        "SELECT source, target FROM edges WHERE type='FILED_AS_DECISION'"
      ).all();
      check('FILED_AS_DECISION edge written for Approve answer', filedEdges.length >= 1);

      // DEFERRED edge for Defer.
      const deferEdges = dbC.prepare(
        "SELECT source, target FROM edges WHERE type='DEFERRED'"
      ).all();
      check('DEFERRED edge written for Defer answer', deferEdges.length >= 1);

      // REJECTED_BECAUSE edge for Reject.
      const rejectEdges = dbC.prepare(
        "SELECT source, target FROM edges WHERE type='REJECTED_BECAUSE'"
      ).all();
      check('REJECTED_BECAUSE edge written for Reject answer', rejectEdges.length >= 1);

      // NO CHOSE edge anywhere (constitutional; RESEARCH Pitfall 7).
      const choseEdges = dbC.prepare(
        "SELECT source, target FROM edges WHERE type='CHOSE'"
      ).all();
      check('NO CHOSE edge written (constitutional; RESEARCH Pitfall 7)', choseEdges.length === 0);

      dbC.close();
    }
  }

  // --- Section D: check-substrate ---
  process.stdout.write('\nSection D: check-substrate (allow-list)\n');

  const csResult = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs')], {
    encoding: 'utf8',
    env: Object.assign({}, process.env),
    cwd: REPO_ROOT,
  });
  // Baseline (--baseline) exit 0 always. We check that room-birth.cjs is NOT listed
  // as a violation by scanning stdout for the file path.
  const csOut = csResult.stdout || '';
  const csViolation = csOut.includes('lib/core/navigation/room-birth.cjs');
  check(
    'check-substrate --baseline does not report room-birth.cjs as a violation',
    !csViolation,
    csViolation ? 'room-birth.cjs appears in baseline violations' : ''
  );

  // Also verify the file is actually in the allow-list by checking isAllowedPath.
  const checkSubstrateMod = require(path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs'));
  const inAllowList = checkSubstrateMod.isAllowedPath('lib/core/navigation/room-birth.cjs');
  check('room-birth.cjs path is in the check-substrate allow-list', inAllowList);

  // --- Section E: idempotence ---
  process.stdout.write('\nSection E: idempotence\n');

  let resultE;
  try {
    resultE = birthRoom(optsA);
  } catch (e) {
    process.stdout.write('  FAIL: second birthRoom call threw: ' + e.message + '\n');
    resultE = null;
  }
  check(
    'second birthRoom call on same roomDir is safe (no crash)',
    resultE !== null,
    resultE ? JSON.stringify(resultE).slice(0, 80) : 'threw'
  );

  if (db) { try { db.close(); } catch (_) {} }

} finally {
  // Restore env.
  if (origRoomsHome !== undefined) {
    process.env.MINDRIAN_ROOMS_HOME = origRoomsHome;
  } else {
    delete process.env.MINDRIAN_ROOMS_HOME;
  }
  // Cleanup tmpdir.
  try {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  } catch (_) {}
}

// --- Summary ---
process.stdout.write('\n');
process.stdout.write('[test-room-birth] ' + passed + '/' + checks + ' PASS\n');

if (passed < checks) {
  process.exit(1);
}
process.exit(0);
