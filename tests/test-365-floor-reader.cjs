#!/usr/bin/env node
'use strict';

/*
 * Phase 365-04 Task 2 -- the floor reader and the why-line composer.
 *
 * Legs R1..R6, N1..N9, K1..K3. Read-only: row counts and the ROOM.md bytes are
 * compared before and after. No em-dash or en-dash in this file: the checks
 * spell those characters as escapes. Exit 0 pass, 1 fail, 77 env gap.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const floorMod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'verification-floor.cjs'));
const { EVENT_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const schemas = require(path.join(REPO_ROOT, 'lib', 'core', 'frontmatter-schemas.cjs'));

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let failures = 0;
function check(label, fn) {
  try {
    const note = fn();
    process.stdout.write('  ok - ' + label + (note ? ' (' + note + ')' : '') + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('  FAIL - ' + label + ' :: ' + String((e && e.message) || e).split('\n')[0] + '\n');
  }
}

function counts(db) {
  const n = (t) => db.prepare('SELECT COUNT(*) AS c FROM ' + t).get().c;
  return { nodes: n('nodes'), edges: n('edges') };
}

function writeRoomMd(dir, text) {
  fs.writeFileSync(path.join(dir, 'ROOM.md'), text, 'utf8');
}
function rmRoomMd(dir) {
  try { fs.unlinkSync(path.join(dir, 'ROOM.md')); } catch (_e) { /* absent is fine */ }
}
function setStatus(db, id, status) {
  db.prepare('UPDATE nodes SET review_status = ? WHERE id = ?').run(status, id);
}

function main() {
  let room;
  try {
    room = fx.makeRoom365('floor-reader');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  const dir = room.room;
  try {
    // ---- floor reader ----
    rmRoomMd(dir);
    check('R1 no ROOM.md -> default; ROOM.md with no key -> default; never throws', () => {
      const a = floorMod.readVerificationFloor(dir);
      assert.deepEqual(a, { id: 'secondary_document', source: 'default', raw: null });
      writeRoomMd(dir, '---\nname: x\n---\n\n# Body\n');
      assert.deepEqual(floorMod.readVerificationFloor(dir), { id: 'secondary_document', source: 'default', raw: null });
      assert.doesNotThrow(() => floorMod.readVerificationFloor(path.join(dir, 'no', 'such', 'dir')));
    });
    check('R2 declared id -> room_md; quoted values and CRLF work', () => {
      writeRoomMd(dir, '---\nname: x\nverification_floor: primary_source_located\n---\n');
      assert.deepEqual(floorMod.readVerificationFloor(dir), { id: 'primary_source_located', source: 'room_md', raw: 'primary_source_located' });
      writeRoomMd(dir, '---\r\nname: x\r\nverification_floor: "person"\r\n---\r\n\r\nbody\r\n');
      assert.equal(floorMod.readVerificationFloor(dir).id, 'person');
      writeRoomMd(dir, "---\nverification_floor: 'recall'\n---\n");
      assert.equal(floorMod.readVerificationFloor(dir).id, 'recall');
    });
    check('R3 alias maps to the draft id and keeps raw', () => {
      writeRoomMd(dir, '---\nverification_floor: database_or_document\n---\n');
      assert.deepEqual(floorMod.readVerificationFloor(dir), { id: 'secondary_document', source: 'room_md', raw: 'database_or_document' });
      writeRoomMd(dir, '---\nverification_floor: primary_source\n---\n');
      assert.equal(floorMod.readVerificationFloor(dir).id, 'primary_source_located');
    });
    check('R4 an unknown value falls back and says so', () => {
      writeRoomMd(dir, '---\nverification_floor: 3\n---\n');
      assert.deepEqual(floorMod.readVerificationFloor(dir), { id: 'secondary_document', source: 'invalid_fell_back', raw: '3' });
      writeRoomMd(dir, '---\nverification_floor: banana\n---\n');
      const b = floorMod.readVerificationFloor(dir);
      assert.equal(b.source, 'invalid_fell_back');
      assert.equal(b.raw, 'banana');
    });
    check('R5 a body line is ignored; a 3 KB frontmatter is still read', () => {
      writeRoomMd(dir, '---\nname: x\n---\n\nverification_floor: unchecked\n');
      assert.equal(floorMod.readVerificationFloor(dir).source, 'default');
      const filler = [];
      for (let i = 0; i < 80; i += 1) filler.push('note_' + i + ': ' + 'x'.repeat(30));
      const text = '---\n' + filler.join('\n') + '\nverification_floor: unchecked\n---\n\nbody\n';
      assert.ok(Buffer.byteLength(text) > 2048 && Buffer.byteLength(text) < 4096, 'size ' + Buffer.byteLength(text));
      writeRoomMd(dir, text);
      assert.equal(floorMod.readVerificationFloor(dir).id, 'unchecked');
    });
    check('R6 the reader never writes ROOM.md', () => {
      writeRoomMd(dir, '---\nverification_floor: recall\n---\nbody\n');
      const p = path.join(dir, 'ROOM.md');
      const before = { bytes: fs.readFileSync(p), mtime: fs.statSync(p).mtimeMs };
      floorMod.readVerificationFloor(dir);
      floorMod.readVerificationFloor(dir);
      assert.ok(before.bytes.equals(fs.readFileSync(p)));
      assert.equal(fs.statSync(p).mtimeMs, before.mtime);
      rmRoomMd(dir);
      floorMod.readVerificationFloor(dir);
      assert.equal(fs.existsSync(p), false, 'ROOM.md was created by a read');
    });

    // ---- notice composer ----
    const db = fx.openFresh(dir);
    try {
      const c0 = fx.seedClaim(db, { text: 'Notice claim zero has no check.', variant: 'n0' });
      const c1 = fx.seedClaim(db, { text: 'Notice claim one was asked of a model.', variant: 'n1' });
      fx.recordAsk(db, c1, { rung: 2 });
      const c2 = fx.seedClaim(db, { text: 'Notice claim two links a dated source.', variant: 'n2' });
      fx.addSourceEdge(db, c2, { url: 'https://example.org/a', retrieved_at: '2026-09-30T10:00:00Z', variant: 'n2' });
      const c3 = fx.seedClaim(db, { text: 'Notice claim three is already at needs evidence.', variant: 'n3' });
      setStatus(db, c3, 'needs_evidence');
      const c4 = fx.seedClaim(db, { text: 'Notice claim four is needs evidence with a source.', variant: 'n4' });
      fx.addSourceEdge(db, c4, { url: 'https://example.org/b', retrieved_at: '2026-09-29', variant: 'n4' });
      setStatus(db, c4, 'needs_evidence');
      const c5 = fx.seedClaim(db, { text: 'Notice claim five names a deciding part.', variant: 'n5' });
      fx.addSourceEdge(db, c5, { url: 'https://example.org/c', retrieved_at: '2026-09-28', locator: 'section 4.2', variant: 'n5' });
      const c6 = fx.seedClaim(db, { text: 'Notice claim six is already confirmed.', variant: 'n6' });
      setStatus(db, c6, 'confirmed');
      const odd = fx.seedClaim(db, { text: 'Notice claim seven carries odd characters.', variant: 'n7' });
      fx.addSourceEdge(db, odd, { url: 'https://example.org/p' + EM + 'q', retrieved_at: '2026-09-27', locator: 'part ' + EM + ' two ' + EN + ' three', variant: 'n7' });

      rmRoomMd(dir);
      check('N1 a non-claim subject or a missing node -> null', () => {
        const opp = 'opportunity:test-365';
        require(path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs')).insertNode(db, opp, 'opportunity', '{}', {
          source_path: 'test-365:' + opp, created_by: 'system', epistemic_type: 'extracted_fact',
        });
        assert.equal(floorMod.composeFloorNotice(db, dir, opp), null);
        assert.equal(floorMod.composeFloorNotice(db, dir, 'nope:missing'), null);
      });
      check('N2 default floor, standing none, proposed -> relabel and needs_evidence landing', () => {
        const n = floorMod.composeFloorNotice(db, dir, c0);
        assert.ok(n.notice.startsWith('Checked against: nothing outside the conversation yet.'), n.notice);
        assert.ok(n.notice.includes('This room asks for at least a source document, so approving files it as needs evidence.'), n.notice);
        assert.equal(n.approve_label, 'Approve, mark as needs evidence');
        assert.equal(n.landing, 'needs_evidence');
        assert.equal(n.standing, 'none');
        assert.equal(n.floor_id, 'secondary_document');
        assert.equal(n.floor_source, 'default');
        assert.equal(n.floor_met, false);
      });
      check('N3 model_only -> model words plus the floor clause', () => {
        const n = floorMod.composeFloorNotice(db, dir, c1);
        assert.ok(n.notice.startsWith("Checked against: a model's answer only, as recorded."), n.notice);
        assert.ok(n.notice.includes('This room asks for at least a source document, so approving files it as needs evidence.'));
      });
      check('N4 source_edge names the host and the retrieval date; meets the floor', () => {
        const n = floorMod.composeFloorNotice(db, dir, c2);
        assert.ok(n.notice.startsWith('Checked against: example.org (retrieved 2026-09-30).'), n.notice);
        assert.ok(n.notice.includes("That meets this room's floor (a source document), so approving confirms it."), n.notice);
        assert.equal(n.approve_label, null);
        assert.equal(n.landing, 'confirmed');
        assert.equal(n.floor_met, true);
        assert.equal(n.source_node_ids.length, 1);
      });
      check('N4b located_source adds the locator', () => {
        const n = floorMod.composeFloorNotice(db, dir, c5);
        assert.ok(n.notice.startsWith('Checked against: example.org, section 4.2 (retrieved 2026-09-28).'), n.notice);
        assert.equal(n.standing, 'located_source');
      });
      check('N5 needs_evidence below floor stays; above floor lands confirmed', () => {
        const below = floorMod.composeFloorNotice(db, dir, c3);
        assert.ok(below.notice.includes('so it stays at needs evidence.'), below.notice);
        assert.equal(below.landing, 'needs_evidence');
        const above = floorMod.composeFloorNotice(db, dir, c4);
        assert.equal(above.landing, 'confirmed');
        assert.ok(above.notice.includes('so approving confirms it.'));
      });
      check('N5b a claim already confirmed -> landing unchanged, no floor clause', () => {
        const n = floorMod.composeFloorNotice(db, dir, c6);
        assert.equal(n.landing, 'unchanged');
        assert.equal(n.approve_label, null);
        assert.ok(!n.notice.includes('This room asks'), n.notice);
        assert.ok(n.notice.startsWith('Checked against:'));
      });
      check('N6 person floor says the room cannot record that yet', () => {
        fx.writeRoomFloor(dir, 'person');
        const n = floorMod.composeFloorNotice(db, dir, c2);
        assert.ok(n.notice.includes("This room asks for a person's check, which the room cannot record yet, so approving files it as needs evidence."), n.notice);
        assert.equal(n.landing, 'needs_evidence');
        assert.equal(n.floor_met, false);
      });
      check('N7 floor unchecked -> no floor, approving confirms', () => {
        fx.writeRoomFloor(dir, 'unchecked');
        const n = floorMod.composeFloorNotice(db, dir, c0);
        assert.ok(n.notice.includes('This room sets no floor, so approving confirms it.'), n.notice);
        assert.equal(n.landing, 'confirmed');
        assert.equal(n.approve_label, null);
      });
      check('N8 an invalid floor adds the not-recognized line', () => {
        fx.writeRoomFloor(dir, 'banana');
        const n = floorMod.composeFloorNotice(db, dir, c0);
        assert.ok(n.notice.includes("(The room's verification_floor value was not recognized, so the default applies.)"), n.notice);
        assert.equal(n.floor_source, 'invalid_fell_back');
        assert.equal(n.floor_id, 'secondary_document');
      });
      check('N9 one line, at most 400 characters, no em-dash or en-dash, and writes nothing', () => {
        rmRoomMd(dir);
        const before = counts(db);
        const ids = [c0, c1, c2, c3, c4, c5, c6, odd];
        ids.forEach((id) => {
          const n = floorMod.composeFloorNotice(db, dir, id);
          assert.ok(n.notice.length <= 400, id + ' length ' + n.notice.length);
          assert.ok(!/[\r\n]/.test(n.notice), 'multi-line notice');
          assert.ok(n.notice.indexOf(EM) === -1 && n.notice.indexOf(EN) === -1, 'dash in notice');
        });
        const o = floorMod.composeFloorNotice(db, dir, odd);
        assert.ok(o.notice.includes('part - two - three'), o.notice);
        assert.deepEqual(counts(db), before);
      });
    } finally {
      fx.closeFresh(db);
    }
  } finally {
    fx.cleanup(room);
  }

  check('K1 the ROOM.md schema accepts verification_floor as optional', () => {
    const schema = schemas.SCHEMAS ? schemas.SCHEMAS['ROOM.md'] : null;
    const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'frontmatter-schemas.cjs'), 'utf8');
    assert.ok(/'verification_floor'/.test(src));
    if (schema) {
      assert.ok(schema.optional.indexOf('verification_floor') !== -1);
      assert.ok(schema.required.indexOf('verification_floor') === -1);
    }
  });
  check('K2 EVENT_TYPES has approval_floor_checked and verification_distribution_snapshot', () => {
    assert.ok(EVENT_TYPES.has('approval_floor_checked'));
    assert.ok(EVENT_TYPES.has('verification_distribution_snapshot'));
  });
  check('K3 navigation.cjs re-exports the new helpers and has a holdForEvidence key', () => {
    ['claimStanding', 'standingMeetsFloor', 'readVerificationFloor', 'composeFloorNotice'].forEach((k) => {
      assert.equal(typeof navigation[k], 'function', k);
    });
    ['STANDING_IDS', 'STANDING_WORDS', 'FLOOR_IDS', 'DEFAULT_FLOOR_ID', 'FLOOR_WORDS'].forEach((k) => {
      assert.ok(navigation[k] !== undefined && navigation[k] !== null, k);
    });
    assert.ok(Object.prototype.hasOwnProperty.call(navigation, 'holdForEvidence'), 'holdForEvidence key');
    assert.equal(navigation.deriveRung, undefined, 'D-25: no deriveRung export');
  });
  check('no network attempted', () => {
    assert.equal(net.attempts(), 0);
  });
  net.restore();
  if (failures > 0) {
    process.stdout.write('FAIL: ' + failures + ' leg(s)\n');
    return 1;
  }
  process.stdout.write('PASS: floor reader and why-line composer\n');
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stdout.write('UNCAUGHT: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
}
