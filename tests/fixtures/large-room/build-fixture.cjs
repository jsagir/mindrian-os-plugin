#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 Wave 0 (plan 01, Task 1): the run-time LARGE-ROOM fixture builder.
 * Requirements: CPU379-08 (a fixture with more than 2,000 artifacts for the release leg),
 * decision D-379.1-02 (the release gate reads this fixture through large_room_leg).
 *
 * buildLargeRoom(targetDir, { slug, withManifest }) builds a room under <targetDir>/rooms/<slug>:
 *   - a .room-root sentinel (the same JSON shape the never-ready builder writes), no room.db
 *     (the release leg births room.db itself; Plan 06)
 *   - ROOM.md plus five real section artifacts (problem-definition, assumptions, decisions,
 *     research, solution-design), one invented note each, 400 to 800 characters
 *   - GENERATED_COUNT deterministic markdown files under GENERATED_DIR/engine-input-room/
 *     named gen-NNNN.md, each 400 to 800 characters built from a fixed word list and the file
 *     index (no random source, no room text, no real names), every body above rs-engine's
 *     MIN_BODY_CHARS = 50
 *   - with { withManifest: true } also GENERATED_DIR/engine-input-manifest.json
 *     { source, engine_input_room, n_records, records: [] } (the marker Plan 02's scope
 *     predicate reads)
 * and returns { roomDir, artifacts, generatedDir }. artifacts counts the section notes plus
 * the generated files (2,105); ROOM.md is the identity file and is not an artifact.
 *
 * The same inputs produce byte-identical files on every call (the test pins gen-0001.md and
 * gen-2100.md). The build is on the shape of tests/fixtures/never-ready-room/build-fixture.cjs.
 *
 * Safety (threat T-379.1-08): writes only under targetDir; refuses a targetDir under
 * ~/MindrianRooms or ~/.mindrian (the real home and the HOME env value are both checked).
 * Run as a script:
 *   node tests/fixtures/large-room/build-fixture.cjs <targetDir> [slug] [--with-manifest]
 * prints the result JSON on stdout. Hyphens only; no network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GENERATED_DIR = 'solution-design/generated-run-379';
const GENERATED_COUNT = 2100;
const ENGINE_INPUT_SUBDIR = 'engine-input-room';
const MANIFEST_BASENAME = 'engine-input-manifest.json';
const BODY_MIN_CHARS = 400;
const BODY_MAX_CHARS = 800;
const SECTIONS = ['problem-definition', 'assumptions', 'decisions', 'research', 'solution-design'];

// A fixed vocabulary of generic method words. Twelve topic slices of ten words each give every
// generated file a leaning (index modulo 12) so TF-IDF over the corpus has real structure.
const WORDS = [
  'signal', 'cadence', 'budget', 'throttle', 'queue', 'worker', 'cursor', 'heartbeat', 'ledger', 'bound',
  'vector', 'cosine', 'encoder', 'batch', 'dimension', 'cache', 'digest', 'neighbour', 'candidate', 'recall',
  'market', 'segment', 'buyer', 'channel', 'margin', 'pricing', 'demand', 'supply', 'contract', 'renewal',
  'sensor', 'reading', 'drift', 'baseline', 'threshold', 'alarm', 'calibration', 'interval', 'sample', 'variance',
  'lattice', 'matrix', 'gram', 'rotation', 'sweep', 'rank', 'subspace', 'projection', 'residual', 'spectrum',
  'harbour', 'vessel', 'cargo', 'tide', 'berth', 'manifest', 'route', 'voyage', 'anchor', 'pilot',
  'orchard', 'harvest', 'season', 'yield', 'soil', 'irrigation', 'pruning', 'rootstock', 'canopy', 'frost',
  'ledgerline', 'invoice', 'receipt', 'audit', 'balance', 'credit', 'debit', 'reserve', 'quarter', 'forecast',
  'kiln', 'glaze', 'clay', 'firing', 'wheel', 'slip', 'bisque', 'cooling', 'shelf', 'crack',
  'loom', 'warp', 'weft', 'shuttle', 'thread', 'dye', 'pattern', 'bolt', 'selvedge', 'tension',
  'reservoir', 'inflow', 'outflow', 'valve', 'pressure', 'gauge', 'overflow', 'sediment', 'turbine', 'spillway',
  'archive', 'folio', 'index', 'catalogue', 'shelfmark', 'binding', 'vellum', 'marginalia', 'colophon', 'quire',
];
const TOPIC_SLICE = 10;
const TOPICS = WORDS.length / TOPIC_SLICE;
const CONNECTORS = ['the', 'a', 'and', 'with', 'under', 'before', 'after', 'into', 'over', 'through'];

function forbiddenRoots() {
  const homes = new Set();
  [process.env.HOME, process.env.USERPROFILE, os.homedir()].forEach((h) => { if (h) homes.add(path.resolve(h)); });
  try { homes.add(path.resolve(os.userInfo().homedir)); } catch (_e) { /* no passwd entry */ }
  const out = [];
  homes.forEach((h) => { out.push(path.join(h, 'MindrianRooms')); out.push(path.join(h, '.mindrian')); });
  return out;
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// A linear congruential generator seeded from the file index: deterministic, no random source.
function makeLcg(seed) {
  let s = seed >>> 0;
  return function next(bound) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % bound;
  };
}

function pad4(n) {
  return String(n).padStart(4, '0');
}

/*
 * bodyFor(index): the deterministic body of gen-<index>.md. Target length moves with the
 * index across [412, 800]; words are added while they fit, so the final length sits in
 * [400, 800] and above MIN_BODY_CHARS. Seven words in ten come from the file's topic slice.
 */
function bodyFor(index) {
  const target = 412 + ((index * 37) % 389);
  const next = makeLcg(index * 7919 + 17);
  const topic = index % TOPICS;
  let text = '# Generated record ' + pad4(index) + '\n\nTopic ' + topic + ' sample ' + index + '. ';
  let wordsInSentence = 0;
  let sentenceLen = 6 + next(7);
  let first = true;
  for (;;) {
    let w;
    const roll = next(10);
    if (roll < 7) w = WORDS[topic * TOPIC_SLICE + next(TOPIC_SLICE)];
    else if (roll < 9) w = WORDS[next(WORDS.length)];
    else w = CONNECTORS[next(CONNECTORS.length)];
    if (first) { w = w.charAt(0).toUpperCase() + w.slice(1); first = false; }
    wordsInSentence += 1;
    let piece = w;
    if (wordsInSentence >= sentenceLen) {
      piece += '.';
      wordsInSentence = 0;
      sentenceLen = 6 + next(7);
      first = true;
    }
    const sep = text.endsWith('. ') || text.endsWith('\n') ? '' : ' ';
    if (text.length + sep.length + piece.length + 1 > target) break;
    text += sep + piece;
    if (piece.endsWith('.')) text += ' ';
  }
  text = text.trimEnd();
  if (!text.endsWith('.')) text += '.';
  return text + '\n';
}

function sectionNote(section, idx) {
  const next = makeLcg(90001 + idx * 101);
  let text = '# ' + section.replace(/-/g, ' ') + ' note\n\nA fixture note for the ' + section + ' section of the large room. ';
  const target = 420 + idx * 60;
  let first = true;
  let n = 0;
  for (;;) {
    let w = WORDS[next(WORDS.length)];
    if (first) { w = w.charAt(0).toUpperCase() + w.slice(1); first = false; }
    n += 1;
    let piece = w;
    if (n >= 9) { piece += '.'; n = 0; first = true; }
    const sep = text.endsWith('. ') ? '' : ' ';
    if (text.length + sep.length + piece.length + 1 > target) break;
    text += sep + piece;
    if (piece.endsWith('.')) text += ' ';
  }
  text = text.trimEnd();
  if (!text.endsWith('.')) text += '.';
  return text + '\n';
}

function buildLargeRoom(targetDir, opts) {
  const options = opts || {};
  const slug = options.slug || 'large-room-fixture';
  if (!targetDir || typeof targetDir !== 'string') throw new Error('buildLargeRoom: targetDir must be a string');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('buildLargeRoom: slug must be lowercase letters, digits and hyphens');
  const target = path.resolve(targetDir);
  forbiddenRoots().forEach((f) => {
    if (isInside(target, f)) throw new Error('buildLargeRoom: refusing a target under ' + f);
  });
  const roomDir = path.join(target, 'rooms', slug);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), JSON.stringify({ room: slug, active: true, born: new Date().toISOString() }), 'utf8');
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# ' + slug + '\n\nLarge-room fixture for the Phase 379.1 release leg. Synthetic text only.\n', 'utf8');

  let artifacts = 0;
  SECTIONS.forEach((section, idx) => {
    const dir = path.join(roomDir, section);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, section + '-note.md'), sectionNote(section, idx), 'utf8');
    artifacts += 1;
  });

  const generatedDir = path.join(roomDir, GENERATED_DIR);
  const inputDir = path.join(generatedDir, ENGINE_INPUT_SUBDIR);
  fs.mkdirSync(inputDir, { recursive: true });
  for (let i = 1; i <= GENERATED_COUNT; i += 1) {
    fs.writeFileSync(path.join(inputDir, 'gen-' + pad4(i) + '.md'), bodyFor(i), 'utf8');
    artifacts += 1;
  }
  if (options.withManifest === true) {
    const manifest = { source: 'fixture-379-build', engine_input_room: ENGINE_INPUT_SUBDIR, n_records: GENERATED_COUNT, records: [] };
    fs.writeFileSync(path.join(generatedDir, MANIFEST_BASENAME), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
  return { roomDir: roomDir, artifacts: artifacts, generatedDir: generatedDir };
}

module.exports = { buildLargeRoom, GENERATED_DIR, GENERATED_COUNT, forbiddenRoots, isInside };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const withManifest = args.includes('--with-manifest');
    const positional = args.filter((a) => a !== '--with-manifest');
    const result = buildLargeRoom(positional[0], { slug: positional[1], withManifest: withManifest });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (e) {
    process.stderr.write(String((e && e.message) || e) + '\n');
    process.exit(1);
  }
}
