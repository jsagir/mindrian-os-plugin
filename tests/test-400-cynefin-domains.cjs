#!/usr/bin/env node
'use strict';
// Phase 400-05 (S2, CY-02, O-05, O-13): data/cynefin-domains.json, the closed domain vocabulary.
// Legs K1 to K5. K4 is the book drift check: it reads the PwS-Book checkout ONLY (no write, no git call),
// and skips when the checkout is absent. K5 is the mutation control on a scratch book fixture.
// The file stores headings and sha256 hashes of book lines, never book text (T-400-10).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data/cynefin-domains.json');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const ax = require(path.join(ROOT, 'lib/core/problem-axes.cjs'));
const { hasRawNumber } = require(path.join(ROOT, 'lib/core/decision-advisor/present.cjs'));

const MAX_LABEL = 80; // lib/mcp/gate-render.cjs MAX_APPROVE_LABEL_CHARS
const MAX_HEADER = 120; // lib/mcp/gate-render.cjs MAX_ELICIT_TITLE_CHARS

let raw = null;
let doc = null;
try {
  raw = fs.readFileSync(DATA, 'utf8');
  doc = JSON.parse(raw);
} catch (_e) {
  doc = null;
}

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// The trimmed non-empty lines under a '## <heading>' line, up to the next '## ' line.
function sectionLines(chapterText, heading) {
  const lines = chapterText.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## ' + heading);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) break;
    const t = lines[i].trim();
    if (t.length > 0) out.push(t);
  }
  return out;
}

// Every hashed source of the file: [label, book_heading, quote_sha256].
function hashedSources(d) {
  const out = [];
  for (const dom of d.domains || []) out.push(['domain ' + dom.id, dom.book_heading, dom.quote_sha256]);
  const dn = d.host_notes && d.host_notes.disorder;
  if (dn) out.push(['host_notes.disorder', dn.book_heading, dn.quote_sha256]);
  const qs = d.card && d.card.question_source;
  if (qs) out.push(['card.question_source', qs.book_heading, qs.quote_sha256]);
  return out;
}

// The drift check. Read only. Returns a list of drift strings; an empty list means no drift.
function bookDrift(d, bookDir) {
  const drift = [];
  const chapterPath = path.join(bookDir, d.label_source.path);
  let chapter = null;
  try {
    chapter = fs.readFileSync(chapterPath, 'utf8');
  } catch (_e) {
    return ['chapter missing: ' + d.label_source.path];
  }
  for (const dom of d.domains || []) {
    const g = path.join(bookDir, 'bundle/glossary/canonical', dom.glossary_id + '.md');
    if (!fs.existsSync(g)) drift.push('glossary missing: ' + dom.glossary_id);
  }
  for (const [label, heading, hash] of hashedSources(d)) {
    const lines = sectionLines(chapter, heading);
    if (lines === null) {
      drift.push(label + ': heading not found: ' + heading);
      continue;
    }
    if (!lines.some((l) => sha256(l) === hash)) drift.push(label + ': no line under the heading matches the stored hash');
  }
  return drift;
}

check('K1 schema, label source, 5 domains in CAUSE_EFFECT_DOMAINS order with the move of DOMAIN_MOVE', () => {
  assert.ok(doc, 'data/cynefin-domains.json is missing or is not JSON');
  assert.equal(doc.schema, 'mos.cynefin-domains/1');
  assert.equal(doc.status, 'provisional');
  assert.deepEqual(doc.label_source, { book: 'PwS-Book', path: 'chapters/navigating-complexity.md', ruling: 'O-05' });
  assert.ok(Array.isArray(doc.domains) && doc.domains.length === 5, 'domains must have 5 entries');
  assert.deepEqual(doc.domains.map((d) => d.id), ax.CAUSE_EFFECT_DOMAINS.slice());
  for (const d of doc.domains) {
    assert.equal(d.move_type, ax.DOMAIN_MOVE[d.id], 'move_type of ' + d.id);
    assert.ok(ax.MOVE_TYPES.indexOf(d.move_type) !== -1);
    for (const k of ['name', 'posture', 'glossary_id', 'book_heading']) {
      assert.ok(typeof d[k] === 'string' && d[k].trim().length > 0, d.id + '.' + k);
    }
    assert.ok(Array.isArray(d.verb_order) && d.verb_order.length > 0 && d.verb_order.every((v) => typeof v === 'string' && v.length > 0), d.id + '.verb_order');
    assert.match(d.quote_sha256, /^[0-9a-f]{64}$/, d.id + '.quote_sha256');
  }
});

check('K2 the two-stage card: 4 then 2 options, unique ids, each domain once, caps hold', () => {
  assert.ok(doc && doc.card, 'card is missing');
  const card = doc.card;
  assert.equal(card.kind, 'cause_effect_domain');
  assert.ok(Array.isArray(card.stages) && card.stages.length === 2);
  assert.equal(card.stages[0].options.length, 4);
  assert.equal(card.stages[1].options.length, 2);
  const ids = [];
  const reached = {};
  for (const st of card.stages) {
    assert.ok(typeof st.header === 'string' && st.header.length > 0 && st.header.length <= MAX_HEADER, 'header ' + st.header);
    for (const o of st.options) {
      ids.push(o.id);
      assert.ok(typeof o.label === 'string' && o.label.length > 0 && o.label.length <= MAX_LABEL, 'label ' + o.label);
      if (o.domain !== null) {
        assert.ok(ax.isCauseEffectDomain(o.domain), 'domain ' + o.domain);
        reached[o.domain] = (reached[o.domain] || 0) + 1;
      }
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'option ids are not unique');
  for (const d of ax.CAUSE_EFFECT_DOMAINS) assert.equal(reached[d], 1, 'domain ' + d + ' reached ' + (reached[d] || 0) + ' times');
  const nobody = card.stages[0].options.find((o) => o.id === 'ce-nobody');
  assert.ok(nobody, 'ce-nobody is missing');
  assert.equal(nobody.domain, null);
  assert.equal(nobody.next_stage, 2);
  assert.equal(card.stages[1].stage, 2);
});

check('K3 host notes for disorder and chaotic, no raw number, no em dash or en dash', () => {
  assert.ok(doc && doc.host_notes, 'host_notes is missing');
  for (const k of ['disorder', 'chaotic']) {
    const n = doc.host_notes[k];
    assert.ok(n && typeof n.text === 'string' && n.text.length > 0, 'host_notes.' + k + '.text');
    assert.equal(hasRawNumber(n.text), false, 'host_notes.' + k + ' has a raw number');
  }
  assert.ok(!/[\u2013\u2014]/.test(raw), 'the file has an em dash or an en dash');
});

check('K4 book drift (read only): glossary ids exist and every quote hash matches a line under its heading', () => {
  assert.ok(doc, 'data/cynefin-domains.json is missing');
  const bookDir = process.env.MINDRIAN_BOOK_DIR || path.join(os.homedir(), 'PWS-Book');
  if (!fs.existsSync(bookDir) || !fs.statSync(bookDir).isDirectory()) {
    console.log('SKIP: PwS-Book not found (' + bookDir + ')');
    return;
  }
  assert.deepEqual(bookDrift(doc, bookDir), []);
});

check('K5 mutation control: the drift check reports a changed hash and a missing glossary id', () => {
  assert.ok(doc, 'data/cynefin-domains.json is missing');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cynefin-400-book-'));
  try {
    // A scratch book: one fixture line under each stored heading, one glossary file per id.
    const fixture = {};
    for (const [label, heading] of hashedSources(doc)) {
      if (!fixture[heading]) fixture[heading] = [];
      fixture[heading].push('fixture line for ' + label);
    }
    const body = Object.keys(fixture).map((h) => '## ' + h + '\n\n' + fixture[h].join('\n\n') + '\n').join('\n');
    fs.mkdirSync(path.join(scratch, path.dirname(doc.label_source.path)), { recursive: true });
    fs.writeFileSync(path.join(scratch, doc.label_source.path), body);
    fs.mkdirSync(path.join(scratch, 'bundle/glossary/canonical'), { recursive: true });
    for (const d of doc.domains) fs.writeFileSync(path.join(scratch, 'bundle/glossary/canonical', d.glossary_id + '.md'), 'x\n');
    const copy = JSON.parse(JSON.stringify(doc));
    for (const d of copy.domains) d.quote_sha256 = sha256('fixture line for domain ' + d.id);
    copy.host_notes.disorder.quote_sha256 = sha256('fixture line for host_notes.disorder');
    copy.card.question_source.quote_sha256 = sha256('fixture line for card.question_source');
    assert.deepEqual(bookDrift(copy, scratch), [], 'the fixture copy must be clean');
    const bad = JSON.parse(JSON.stringify(copy));
    bad.domains[2].quote_sha256 = '0'.repeat(64);
    const drift = bookDrift(bad, scratch);
    assert.equal(drift.length, 1, 'drift: ' + JSON.stringify(drift));
    assert.match(drift[0], /domain complex/);
    const badCard = JSON.parse(JSON.stringify(copy));
    badCard.card.question_source.quote_sha256 = sha256('changed');
    assert.equal(bookDrift(badCard, scratch).length, 1);
    const badGloss = JSON.parse(JSON.stringify(copy));
    badGloss.domains[4].glossary_id = 'disorder-domain-questions';
    assert.match(bookDrift(badGloss, scratch).join('\n'), /glossary missing: disorder-domain-questions/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
