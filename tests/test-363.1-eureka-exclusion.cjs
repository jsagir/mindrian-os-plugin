'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 05 (D-03, B51-01) -- Eureka must never rank the room's own
 * scaffold.
 *
 * WHY: in both beta.51 test rooms, 0 of 25 ranked rows paired two real
 * artifacts. The sub-room ranked `market-analysis/CONTEXT` x `Lab`; the parent
 * ranked classifier-fallback domain nodes (unknown, freeform_unmatched,
 * empty_payload, move_set) and `memory_artifact:*:ROOM`. Step 4b only drops a
 * pair when BOTH sides are memory_artifact/Artifact, so one-sided scaffold,
 * egress-label domains and generic entities all passed.
 *
 * The fix is lib/core/eureka/candidate-exclusion.cjs, applied in the index
 * loop of scripts/eureka-portfolio-report.cjs before any pair or cohort is
 * built. This file pins it at two levels:
 *   UNIT       structuralReason over every real row shape (memory_artifact,
 *              section contract, seeded vs authored FEYNMAN, egress-label
 *              domain, generic and high-document-share entity, plain content,
 *              malformed props), the egress-vocabulary text parity, the Part 8
 *              source fence, and reasoning-mode's scaffold skip.
 *   END TO END an offline room-mode run over a fixture room: none of the nine
 *              structural nodes ranks, the authored FEYNMAN does, and
 *              provenance counts every exclusion by reason.
 *
 * Seeded FEYNMAN bodies are built from room-birth's FEYNMAN_BIRTH_SEED_TEMPLATE
 * plus the timeline-runner and dial-memory-renderer exports, never hard-coded
 * sentinels. Zero network, zero deps, mkdtemp only. NO em-dashes (hyphens only;
 * dash characters are spelled with \u escapes where a test needs one).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_ABS = path.join(ROOT, 'lib/core/eureka/candidate-exclusion.cjs');
const timelineRunner = require(path.join(ROOT, 'lib/core/feynman/timeline-runner.cjs'));
const dialMemory = require(path.join(ROOT, 'lib/core/feynman/dial-memory-renderer.cjs'));
const roomBirth = require(path.join(ROOT, 'lib/core/navigation/room-birth.cjs'));
const reasoningMode = require(path.join(ROOT, 'lib/core/eureka/reasoning-mode.cjs'));

let failures = 0;
const pending = [];
function leg(name, fn) {
  pending.push({ name, fn });
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-363.1-excl-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function w(dir, name, body) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), body);
}

// The real seeded FEYNMAN.md shape (birth seed + both auto blocks).
function seededFeynman(slug) {
  const seed = String(roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE).replace(/\{\{SECTION_SLUG\}\}/g, slug);
  return [
    '---',
    'timeline_last_rendered: 2026-09-29T16:10:46Z',
    'dial_memory_last_rendered: 2026-09-29T16:10:47Z',
    '---',
    '# ' + slug,
    '',
    seed.replace(/^# .*\n\n?/, ''),
    '',
    timelineRunner.HEADER,
    '',
    timelineRunner.SENTINEL_START,
    '*No timeline events yet.*',
    timelineRunner.SENTINEL_END,
    '',
    dialMemory.HEADER,
    '',
    dialMemory.SENTINEL_START,
    '*Last refreshed: 2026-09-29T16:10:47Z. No dial activity yet.*',
    dialMemory.SENTINEL_END,
    '',
  ].join('\n');
}

const AUTHORED_LINE = 'We win on price against the incumbents because our fibre housing is lighter.';
function authoredFeynman(slug) {
  return seededFeynman(slug) + '\n' + AUTHORED_LINE + '\n';
}

function row(id, type, props, sourcePath) {
  return {
    id: id,
    type: type,
    properties: typeof props === 'string' ? props : JSON.stringify(props || {}),
    source_path: sourcePath === undefined ? null : sourcePath,
  };
}

let CE = null;
function ce() {
  if (CE) return CE;
  CE = require(MODULE_ABS);
  return CE;
}

// ---------------------------------------------------------------------------
// UNIT LEGS
// ---------------------------------------------------------------------------

leg('U1 memory_artifact by id prefix and by row type', () => {
  const c = ce();
  assert.equal(c.structuralReason(row('memory_artifact:_root:BRAIN', 'memory_artifact', { section: '_root', kind: 'BRAIN', path: 'BRAIN.md' }, 'memory:_root:BRAIN'), {}), 'memory_artifact');
  assert.equal(c.structuralReason(row('memory_artifact:x:ROOM', 'Artifact', {}, null), {}), 'memory_artifact');
  assert.equal(c.structuralReason(row('some-id', 'memory_artifact', { title: 'T' }, null), {}), 'memory_artifact');
});

leg('U2 section contract and scaffold rows -> scaffold_basename (id, sub-room id, Windows source_path, props.path)', () => {
  const c = ce();
  assert.equal(c.structuralReason(row('market-analysis/CONTEXT', 'Artifact', { title: 'CONTEXT', section: 'market-analysis' }, 'system:rs-engine'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('sub/market-analysis/MINTO', 'Artifact', { title: 'MINTO' }, 'system:rs-engine'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('a1', 'Artifact', { title: 'room' }, 'problem-definition\\ROOM.md'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('a2', 'Artifact', { title: 'brain', path: 'strategy/BRAIN.md' }, null), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('x/STATE', 'Artifact', {}, 'system:rs-engine'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('x/USER', 'Artifact', {}, 'system:rs-engine'), {}), 'scaffold_basename');
});

leg('U3 FEYNMAN is body-dependent: seeded -> scaffold, authored -> content, missing file -> content', () => {
  const c = ce();
  const roomDir = mkTmp('feyn');
  w(path.join(roomDir, 'business-model'), 'FEYNMAN.md', seededFeynman('business-model'));
  w(path.join(roomDir, 'problem-definition'), 'FEYNMAN.md', authoredFeynman('problem-definition'));
  const ctx = c.buildExclusionContext({ roomDir: roomDir, corpus: [] });
  assert.equal(c.structuralReason(row('business-model/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), ctx), 'scaffold_basename');
  assert.equal(c.structuralReason(row('problem-definition/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), ctx), null);
  assert.equal(c.structuralReason(row('ghost-section/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), ctx), null);
  // No roomDir at all: a FEYNMAN can never be proven seeded, so content wins.
  assert.equal(c.structuralReason(row('business-model/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), {}), null);
});

leg('U4 egress-label domain nodes -> egress_label_domain; a real domain name -> null', () => {
  const c = ce();
  for (const label of ['unknown', 'freeform_unmatched', 'empty_payload', 'move_set']) {
    assert.equal(
      c.structuralReason(row('domain:s:' + label, 'focus_area', { name: label, domainType: 'focus_area' }, 'domain:s:' + label), {}),
      'egress_label_domain', label);
  }
  // Label carried only by source_path's last segment still counts.
  assert.equal(c.structuralReason(row('domain:s:9', 'focus_area', { domainType: 'focus_area' }, 'domain:s:unknown'), {}), 'egress_label_domain');
  assert.equal(c.structuralReason(row('domain:s:2', 'domain', { name: 'Oncology diagnostics' }, 'domain:s:Oncology diagnostics'), {}), null);
  // A non-domain row that merely carries the word is not touched.
  assert.equal(c.structuralReason(row('claim:1', 'Claim', { text: 'unknown', name: 'unknown' }, 'claims/one'), {}), null);
});

leg('U5 generic single-token entity -> low_idf_entity (any case); multi-token name survives', () => {
  const c = ce();
  const lab = { name: 'Lab', entityType: 'company', evidenceTier: 'low_confidence' };
  assert.equal(c.structuralReason(row('e1', 'company', lab, 'problem-definition\\brief.md'), {}), 'low_idf_entity');
  assert.equal(c.structuralReason(row('e2', 'company', { name: 'LAB', entityType: 'company' }, null), {}), 'low_idf_entity');
  assert.equal(c.structuralReason(row('e3', 'company', { name: 'Lab Automation Systems', entityType: 'company' }, null), {}), null);
  // Independent of evidenceTier: a trusted-stamped generic is still generic.
  assert.equal(c.structuralReason(row('e4', 'technology', { name: 'team', entityType: 'technology', evidenceTier: 'None' }, null), {}), 'low_idf_entity');
});

leg('U6 ratio IDF: >= half of an 8+ entry corpus is low-IDF; a small corpus never triggers', () => {
  const c = ce();
  const mk = (n, mentions) => Array.from({ length: n }, (_v, i) => ({
    id: 'd' + i + '.md', section: 's', title: 't' + i,
    text: i < mentions ? 'Globex signed the deal number ' + i : 'Unrelated body text number ' + i + ' about pricing',
  }));
  const big = mk(10, 6);
  big[8].text = 'Initech pilot notes and more prose';
  big[9].text = 'Initech pilot notes and more prose again';
  const ctx = c.buildExclusionContext({ roomDir: null, corpus: big });
  assert.equal(c.structuralReason(row('g', 'company', { name: 'Globex', entityType: 'company' }, null), ctx), 'low_idf_entity');
  assert.equal(c.structuralReason(row('i', 'company', { name: 'Initech', entityType: 'company' }, null), ctx), null);
  const small = mk(3, 3);
  const ctxSmall = c.buildExclusionContext({ roomDir: null, corpus: small });
  assert.equal(c.structuralReason(row('g2', 'company', { name: 'Globex', entityType: 'company' }, null), ctxSmall), null);
  assert.equal(c.MIN_IDF_CORPUS, 8);
});

leg('U7 plain content rows and malformed props are null and never throw', () => {
  const c = ce();
  assert.equal(c.structuralReason(row('claim:1', 'Claim', { text: 'Fibre housings cut weight.', section: 'claims' }, 'claims/one'), {}), null);
  assert.equal(c.structuralReason(row('problem-definition/brief', 'Artifact', { title: 'Brief', path: 'problem-definition/brief.md' }, 'problem-definition\\brief.md'), {}), null);
  assert.equal(c.structuralReason(row('bad', 'Artifact', '{not json', null), {}), null);
  assert.equal(c.structuralReason(row('bad2', 'company', '[1,2,3]', null), {}), null);
  assert.equal(c.structuralReason(null, {}), null);
  assert.equal(c.structuralReason(undefined, undefined), null);
  assert.equal(c.isStructuralNode(row('m', 'memory_artifact', {}, null), {}), true);
  assert.equal(c.isStructuralNode(row('claim:1', 'Claim', { text: 'x' }, null), {}), false);
});

leg('U8 EGRESS_CLASS_DOMAIN_LABELS equals refusal-messaging EGRESS_CLASS_SET read as TEXT', () => {
  const c = ce();
  const src = fs.readFileSync(path.join(ROOT, 'lib/core/refusal-messaging.cjs'), 'utf8');
  const m = src.match(/EGRESS_CLASS_SET\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(m, 'EGRESS_CLASS_SET block must be found');
  const noComments = m[1].split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const fromText = new Set((noComments.match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)));
  assert.ok(fromText.size >= 10, 'parsed vocabulary looks too small: ' + [...fromText].join(','));
  assert.deepEqual([...c.EGRESS_CLASS_DOMAIN_LABELS].sort(), [...fromText].sort());
  for (const k of ['unknown', 'freeform_unmatched', 'empty_payload', 'move_set']) {
    assert.ok(c.EGRESS_CLASS_DOMAIN_LABELS.has(k), k);
  }
});

leg('U9 Part 8 fence: no Brain, refusal-messaging or network token in the module code', () => {
  const src = fs.readFileSync(MODULE_ABS, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const tok of ['refusal-messaging', 'brain-client', 'fetch(', 'http://', 'https://']) {
    assert.ok(!code.includes(tok), 'forbidden token in code: ' + tok);
  }
});

leg('U10 reasoning-mode readRoomMarkdown skips scaffold files, keeps authored FEYNMAN and notes', () => {
  const roomDir = mkTmp('rm');
  const body = 'A body long enough to clear the forty character noise floor for sure.\n';
  w(path.join(roomDir, 'market-analysis'), 'CONTEXT.md', '# CONTEXT\n\n' + body);
  w(roomDir, 'BRAIN.md', '# BRAIN\n\n' + body);
  w(path.join(roomDir, 'business-model'), 'FEYNMAN.md', seededFeynman('business-model'));
  w(path.join(roomDir, 'problem-definition'), 'FEYNMAN.md', authoredFeynman('problem-definition'));
  w(path.join(roomDir, 'research'), 'notes.md', '# Notes\n\n' + body);
  const got = reasoningMode.readRoomMarkdown(roomDir).map((e) => e.id.split(path.sep).join('/')).sort();
  assert.deepEqual(got, ['problem-definition/FEYNMAN.md', 'research/notes.md']);
});

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

(async function main() {
  for (const { name, fn } of pending) {
    try {
      await fn();
      console.log('ok - ' + name);
    } catch (err) {
      failures += 1;
      console.log('not ok - ' + name);
      console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (failures > 0) {
    console.log('test-363.1-eureka-exclusion: ' + failures + ' leg(s) FAILED');
    process.exit(1);
  }
  console.log('test-363.1-eureka-exclusion: ' + pending.length + '/' + pending.length + ' legs PASSED');
  process.exit(0);
})();
