'use strict';
// Phase 400.4 plan 11: a synthetic room of the shape of the room in the 2026-11-26 cold-start QA run.
//
// Shape (the numbers of the QA run, all generated here, no copy of any real room):
//   431 notes on disk (section/name/name.md) and 431 Artifact nodes with one BELONGS_TO edge each;
//   one section with exactly 27 inbound BELONGS_TO edges and none outbound (ids.hubSection);
//   3,830 claim nodes, all proposed, with a statement property and created_at spread over 90 days;
//   INFORMS edges that link 359 notes to a claim; no SUPPORTS or EVIDENCES edge;
//   72 notes with no INFORMS, CONVERGES, SUPPORTS or EVIDENCES edge (ids.unlinked).
// The room is born through the real birth path under an isolated temporary home (never the real rooms home).
// The born fixture claim (confirmed) is set to proposed so the room holds no ratified claim, as in the QA room.
// Node built-ins only. Hyphens only in this file.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const H = require(path.join(ROOT, 'tests', 'helpers', 'isolated-home-36925.cjs'));

const WORDS = ['harbor', 'lantern', 'meadow', 'copper', 'orbit', 'pebble', 'ribbon', 'summit', 'thistle', 'velvet',
  'walnut', 'anchor', 'beacon', 'cobalt', 'ember', 'fennel', 'granite', 'heron', 'indigo', 'juniper', 'kettle',
  'lagoon', 'marble', 'nectar', 'opal', 'prairie', 'quartz', 'rowan', 'saffron', 'tundra', 'umber', 'violet'];

// A small seeded generator, so every run builds the same room.
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function words(rand, minChars, maxChars) {
  const target = minChars + Math.floor(rand() * (maxChars - minChars));
  let out = '';
  let n = 0;
  while (out.length < target) {
    out += (n > 0 ? (n % 11 === 0 ? '.\n\n' : ' ') : '') + WORDS[Math.floor(rand() * WORDS.length)];
    n += 1;
  }
  return out + '.\n';
}

const pad = (n, w) => String(n).padStart(w, '0');

// buildColdStartRoom(opts) -> {iso, roomDir, slug, ids: {hubSection, unlinked, notes, claims}, cleanup}
// opts: {iso, slug, notes, claims, hubNotes, unlinked, linkedNotes, hubSection}
function buildColdStartRoom(opts) {
  const o = opts || {};
  const t0 = Date.now();
  const iso = o.iso || H.mkIsolatedHome('400.4-cold');
  const slug = o.slug || 'cold-start-qa';
  const noteCount = o.notes || 431;
  const claimCount = o.claims || 3830;
  const hubNotes = o.hubNotes || 27;
  const unlinkedCount = o.unlinked || 72;
  const linkedCount = noteCount - unlinkedCount; // 359 in the QA shape
  const born = H.birthFixtureRoom({ iso, slug, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('buildColdStartRoom: birth failed ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  const rand = rng(40041126);

  const db = openRoomDb(roomDir);
  const ids = { hubSection: null, unlinked: [], notes: [], claims: [] };
  try {
    const sections = db.prepare("SELECT id FROM nodes WHERE type = 'Section' ORDER BY id").all().map((r) => r.id);
    if (sections.length < 3) throw new Error('buildColdStartRoom: the born room has too few sections');
    ids.hubSection = o.hubSection && sections.includes(o.hubSection) ? o.hubSection : (sections.includes('legal-ip') ? 'legal-ip' : sections[sections.length - 1]);
    const others = sections.filter((s) => s !== ids.hubSection);

    // Note placement: exactly hubNotes in the hub; the rest spread over the other sections (never 27 in any of them).
    const placement = [];
    for (let i = 0; i < hubNotes; i++) placement.push(ids.hubSection);
    const restCount = noteCount - hubNotes;
    const per = Math.floor(restCount / others.length);
    for (let i = 0; i < restCount; i++) {
      // Sections take turns, then the remainder lands on the first section, so no other section holds the hub count.
      placement.push(others[Math.min(Math.floor(i / per), others.length - 1)]);
    }

    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    const insNode = db.prepare('INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insEdge = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");

    // The born fixture claim is confirmed with no SUPPORTS edge: it would show as a ratified unsupported claim. The QA
    // room had none, so it is set to proposed (a session_focus row points at it, so it cannot be deleted) and counts as
    // one of the claims of the room.
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE nodes SET review_status = 'proposed', confirmed_by = NULL, confirmed_at = NULL WHERE type = 'claim'").run();
      const bornClaims = db.prepare("SELECT id FROM nodes WHERE type = 'claim' ORDER BY id").all().map((r) => r.id);
      bornClaims.forEach((id) => ids.claims.push(id));
      for (let i = 0; i < noteCount; i++) {
        const section = placement[i];
        const name = 'note-' + pad(i + 1, 4);
        const rel = section + '/' + name + '/' + name + '.md';
        const abs = path.join(roomDir, section, name);
        fs.mkdirSync(abs, { recursive: true });
        const body = words(rand, 800, 6000);
        fs.writeFileSync(path.join(abs, name + '.md'), '---\ntitle: Note ' + (i + 1) + '\nsection: ' + section + '\n---\n\n# Note ' + (i + 1) + '\n\n' + body, 'utf8');
        const id = section + '/' + name + '/' + name;
        ids.notes.push(id);
        const ts = now - Math.floor(rand() * 90 * DAY);
        insNode.run(id, 'Artifact', JSON.stringify({ title: 'Note ' + (i + 1), section, content_hash: 'fixture' + pad(i, 4) }),
          rel, 'system', null, 'proposed', ts, ts, section);
        insEdge.run(id, section, 'BELONGS_TO');
      }
      for (let c = 0; ids.claims.length < claimCount; c++) {
        const id = 'claim:qa-' + pad(c + 1, 5);
        ids.claims.push(id);
        const ts = now - Math.floor(rand() * 90 * DAY);
        insNode.run(id, 'claim', JSON.stringify({ statement: 'Claim ' + (c + 1) + ': ' + WORDS[c % WORDS.length] + ' ' + WORDS[(c * 7) % WORDS.length] + ' ' + WORDS[(c * 13) % WORDS.length] }),
          'qa-fixture/claims', 'system', null, 'proposed', ts, ts, 'qa-fixture');
      }
      // The last unlinkedCount notes in id order get no link edge; the first linkedCount notes inform one claim each.
      for (let i = 0; i < noteCount; i++) {
        if (i < linkedCount) insEdge.run(ids.notes[i], ids.claims[i % claimCount], 'INFORMS');
        else ids.unlinked.push(ids.notes[i]);
      }
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_r) { /* already rolled back */ }
      throw e;
    }
  } finally {
    closeRoomDb(db);
  }
  const buildMs = Date.now() - t0;
  if (buildMs > 20000) throw new Error('buildColdStartRoom: build took ' + buildMs + ' ms (limit 20000)');
  return { iso, roomDir, slug, ids, buildMs, cleanup: iso.cleanup };
}

module.exports = { buildColdStartRoom };
