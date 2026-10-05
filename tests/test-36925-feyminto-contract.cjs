#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 16 (FEYM-06): FeyMinto's contract is part 7 of every nest's generated CONTEXT.md.
 *
 * WHY THIS TEST EXISTS. The ICM audit asked that FeyMinto's contract (inputs, process = Frame / Question / Compose,
 * outputs = the three faces and BRIEF.md, human check = YOUR DECISION) live INSIDE the nest's generated CONTEXT.md,
 * not in a new file. The generated region is the part of CONTEXT.md that script rebuilds for every nest, so it is a
 * seventh generated part, '## 7. FeyMinto', and the writer version moves to ruling-doc-writer-v2 so every existing
 * CONTEXT.md reads as drift to `doctor section-ruling` (the designed regeneration path). A real room is never
 * regenerated here: recoverable is false outside tests/fixtures/icm-rooms/.
 *
 * Arms
 *   K1  a born room's core section CONTEXT.md files carry part 7 inside the ruling markers, after part 6, with the
 *       four bullet labels, Frame / Question / Compose, the four file names and YOUR DECISION
 *   K2  the fingerprint payload carries writer_contract_version 'ruling-doc-writer-v2'
 *   K3  a v1-written block (six parts, v1 fingerprint) is drift to section-ruling check; fix regenerates it on a
 *       fixture room; on a temp room outside tests/fixtures/icm-rooms check reports recoverable false
 *   K4  the authored tail below the end marker is byte-identical after regeneration (and part 7 appears)
 *   K5  part 7 adds no Inputs / Process / Outputs / Human check heading (counts equal the shipped template's)
 *   dash guard
 *
 * Fixture rooms are born under an isolated mkdtemp HOME (tests/helpers/isolated-home-36925.cjs). The K3 fixture-room
 * copy lives under tests/fixtures/icm-rooms/ (the only place check() is recoverable) and is removed in a finally,
 * the idiom tests/test-353-doctor-section-ruling.cjs already uses.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..');
const helper = require('./helpers/isolated-home-36925.cjs');
const scaffold = require(path.join(ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'));
const sectionRegistry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
const sectionRuling = require(path.join(ROOT, 'lib', 'core', 'doctor', 'section-ruling-module.cjs'));
const LEDGER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-command-ledger.json'), 'utf8'));
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'icm-rooms');
const ALPHA = path.join(FIXTURES, 'alpha-room');
const TEMPLATES = path.join(ROOT, 'templates', 'room-skeleton', 'section-contracts');
const END = '<!-- mos:ruling:end -->';
const BEGIN_PREFIX = '<!-- mos:ruling:begin';

let passed = 0;
let failed = 0;
function arm(name, fn) {
  try { fn(); passed += 1; console.log('PASS: ' + name); }
  catch (e) { failed += 1; console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    ')); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

function fingerprint(canonRow, version) {
  const primary = LEDGER.rows[canonRow.job_id + '|*|*'] || null;
  const secondary = canonRow.secondary_job_id ? (LEDGER.rows[canonRow.secondary_job_id + '|*|*'] || null) : null;
  return crypto.createHash('sha256').update(JSON.stringify({
    job_id: canonRow.job_id,
    secondary_job_id: canonRow.secondary_job_id,
    primary: primary,
    secondary: secondary,
    writer_contract_version: version,
  })).digest('hex');
}

// every <room>/**/CONTEXT.md that carries a ruling block, top two levels only (the nests)
function rulingContexts(roomDir) {
  const out = [];
  for (const e of fs.readdirSync(roomDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const p = path.join(roomDir, e.name, 'CONTEXT.md');
    if (fs.existsSync(p) && fs.readFileSync(p, 'utf8').indexOf(END) !== -1) out.push({ slug: e.name, file: p });
  }
  return out;
}

const iso = helper.mkIsolatedHome('feyminto-contract');
let born = null;
try { born = helper.birthFixtureRoom({ iso: iso, slug: 'feyminto-contract-room', vname: 'FeyMinto contract fixture' }); }
catch (e) { console.log('FAIL: birth of the fixture room threw: ' + e.message); process.exit(1); }
const contexts = rulingContexts(born.roomDir);

arm('K1 fixture room has core section CONTEXT.md files carrying a ruling block', () => {
  ok(contexts.length >= 5, 'expected at least 5 nest CONTEXT.md files with a ruling block, got ' + contexts.length);
});

arm('K1 every nest CONTEXT.md carries part 7 inside the markers, after part 6, with the contract words', () => {
  const bad = [];
  contexts.forEach((c) => {
    const raw = fs.readFileSync(c.file, 'utf8');
    const b = raw.indexOf(BEGIN_PREFIX);
    const e = raw.indexOf(END);
    const region = raw.slice(b, e);
    const i6 = region.indexOf('## 6. Commands that write here');
    const i7 = region.indexOf('## 7. FeyMinto');
    if (i7 === -1 || i6 === -1 || i7 < i6) { bad.push(c.slug + ': part 7 missing or before part 6 inside the markers'); return; }
    const part7 = region.slice(i7);
    ['- Inputs:', '- Process:', '- Outputs:', '- Human check:', 'Frame', 'Question', 'Compose',
      'MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'BRIEF.md', 'YOUR DECISION'].forEach((w) => {
      if (part7.indexOf(w) === -1) bad.push(c.slug + ': part 7 lacks ' + w);
    });
  });
  ok(bad.length === 0, bad.slice(0, 6).join('; ') + (bad.length > 6 ? ' (+' + (bad.length - 6) + ' more)' : ''));
});

arm('K2 the fingerprint payload carries writer_contract_version ruling-doc-writer-v2', () => {
  const bad = [];
  contexts.forEach((c) => {
    const row = sectionRegistry.getSectionJob(c.slug);
    if (!row || !row.job_id) return;
    const fm = matter(fs.readFileSync(c.file, 'utf8')).data;
    if (fm.ruling_fingerprint !== fingerprint(row, 'ruling-doc-writer-v2')) bad.push(c.slug);
    if (fm.ruling_fingerprint === fingerprint(row, 'ruling-doc-writer-v1')) bad.push(c.slug + ' (still v1)');
  });
  ok(bad.length === 0, 'fingerprint is not the v2 payload hash for: ' + bad.join(', '));
});

// Rewrite one nest's CONTEXT.md as the v1 writer would have: six parts, v1 fingerprint.
function downgradeToV1(file, slug) {
  const raw = fs.readFileSync(file, 'utf8');
  const i7 = raw.indexOf('## 7. FeyMinto');
  let next = raw;
  if (i7 !== -1) {
    const e = raw.indexOf(END);
    next = raw.slice(0, i7) + raw.slice(e); // part 7 text removed, the end marker kept
  }
  const row = sectionRegistry.getSectionJob(slug);
  next = next.replace(/ruling_fingerprint: "[0-9a-f]+"/, 'ruling_fingerprint: "' + fingerprint(row, 'ruling-doc-writer-v1') + '"');
  fs.writeFileSync(file, next, 'utf8');
}

arm('K3 a v1-written block is drift to check; fix regenerates it on a fixture room; recoverable false outside the fixtures', () => {
  const tmp = fs.mkdtempSync(path.join(FIXTURES, '.tmp-test-36925-16-'));
  try {
    fs.cpSync(ALPHA, tmp, { recursive: true });
    // bring the copy to a fully-ruled state under the current writer, then make problem-definition look v1-written
    sectionRuling.fix({ check_result: sectionRuling.check({ roomPath: tmp }) });
    const target = path.join(tmp, 'problem-definition', 'CONTEXT.md');
    ok(fs.existsSync(target), 'fixture copy has no problem-definition/CONTEXT.md after fix');
    const before = sectionRuling.check({ roomPath: tmp });
    ok(before.drift.ruling_fingerprint_drift.length === 0, 'precondition: no fingerprint drift after fix, got ' + before.drift.ruling_fingerprint_drift.length);
    downgradeToV1(target, 'problem-definition');
    const v1 = fs.readFileSync(target, 'utf8');
    ok(v1.indexOf('## 7. FeyMinto') === -1, 'the downgrade left part 7 in place');
    const drifted = sectionRuling.check({ roomPath: tmp });
    ok(drifted.status === 'warn', 'a v1 block should read as drift (warn), got ' + drifted.status);
    ok(drifted.drift.ruling_fingerprint_drift.some((p) => path.basename(p) === 'problem-definition'),
      'a v1 block is not reported as ruling_fingerprint_drift: ' + JSON.stringify(drifted.drift.ruling_fingerprint_drift));
    ok(drifted.recoverable === true, 'a fixture room must be recoverable');
    const fixed = sectionRuling.fix({ check_result: drifted });
    ok(fixed.status === 'ok' || fixed.status === 'partial', 'fix returned ' + fixed.status + ': ' + fixed.detail);
    const after = sectionRuling.check({ roomPath: tmp });
    ok(after.drift.ruling_fingerprint_drift.length === 0, 'drift remains after fix: ' + JSON.stringify(after.drift.ruling_fingerprint_drift));
    ok(fs.readFileSync(target, 'utf8').indexOf('## 7. FeyMinto') !== -1, 'fix did not regenerate part 7');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), '36925-16-outside-'));
  try {
    fs.cpSync(ALPHA, outside, { recursive: true });
    const r = sectionRuling.check({ roomPath: outside });
    ok(r.recoverable === false, 'outside tests/fixtures/icm-rooms check must report recoverable false, got ' + r.recoverable);
    const f = sectionRuling.fix({ check_result: r });
    ok(f.status === 'skip', 'fix outside the fixtures must skip, got ' + f.status);
    ok(!fs.existsSync(path.join(outside, 'problem-definition', 'CONTEXT.md')), 'fix wrote into a room outside the fixtures');
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
});

arm('K4 the authored tail is byte-identical after regeneration, and part 7 appears', () => {
  const c = contexts.find((x) => x.slug === 'problem-definition') || contexts[0];
  const sentence = '\n\nA human wrote this sentence after the marker (369.25-16 K4).\n';
  fs.appendFileSync(c.file, sentence, 'utf8');
  downgradeToV1(c.file, c.slug);
  const pre = fs.readFileSync(c.file, 'utf8');
  const preTail = pre.slice(pre.indexOf(END) + END.length);
  ok(preTail.indexOf('A human wrote this sentence') !== -1, 'setup lost the authored sentence');
  const result = { warnings: [], errors: [], contracts_created: [], ruling_regenerated: [] };
  scaffold.writeSectionContracts(born.roomDir, [c.slug], result);
  const post = fs.readFileSync(c.file, 'utf8');
  const postTail = post.slice(post.indexOf(END) + END.length);
  ok(preTail === postTail, 'the authored tail changed during regeneration');
  ok(result.ruling_regenerated.indexOf(c.slug) !== -1, 'the v1 block was not regenerated (ruling_regenerated empty)');
  ok(post.indexOf('## 7. FeyMinto') !== -1, 'regeneration did not write part 7');
});

arm('K5 part 7 adds no Inputs / Process / Outputs / Human check heading', () => {
  const bad = [];
  contexts.forEach((c) => {
    const tpl = path.join(TEMPLATES, c.slug + '.md');
    if (!fs.existsSync(tpl)) return;
    const raw = fs.readFileSync(c.file, 'utf8');
    const t = fs.readFileSync(tpl, 'utf8');
    ['Inputs', 'Process', 'Outputs', 'Human check'].forEach((h) => {
      const re = new RegExp('^## ' + h + '\\b', 'gm');
      const got = (raw.match(re) || []).length;
      const want = (t.match(re) || []).length;
      if (got !== want) bad.push(c.slug + ' "## ' + h + '" ' + got + ' vs template ' + want);
    });
  });
  ok(bad.length === 0, bad.join('; '));
});

arm('dash guard: no em dash or en dash in this test or the scaffold', () => {
  const hit = helper.dashGuard([__filename, path.join(ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'), path.join(ROOT, 'scripts', 'eval-icm-writers.cjs')]);
  ok(hit.length === 0, 'dash character in ' + hit.join(', '));
});

iso.cleanup();
console.log('\n369.25 FeyMinto contract (FEYM-06): ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
