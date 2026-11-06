#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 37 (E-SHAPE): the sprout, edge and body shape test.
 * Debug session: part8-no-shape-test-for-sprouts-and-bodies.
 *
 * Owner principle for Part 8 (2026-11-06): a short specific keyword query may
 * leave the room, a full body of text may not, and a word list on ordinary
 * keywords is the wrong tool. Shape (size, sentences, lines, quoted text) is
 * the measure.
 *
 * Arms:
 *   SH1 sprouts are kind sprout
 *   SH2 bodies are kind body
 *   SH3 edges are kind edge
 *   SH4 a non-string is a body and never throws
 *   SH5 corpus: no question is a body; each negative has the recorded class;
 *       the boundaries of the thresholds hold
 *   SH6 the module is pure, deterministic and fast
 *
 * Every string is synthetic. No network. No room. No em dash or en dash.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'lib', 'core', 'part8-sprout-shape.cjs');
const RCA_PATH = (require('node:fs').existsSync(path.join(ROOT, '.planning', 'debug', 'part8-no-shape-test-for-sprouts-and-bodies.md')) ? path.join(ROOT, '.planning', 'debug', 'part8-no-shape-test-for-sprouts-and-bodies.md') : path.join(ROOT, '.planning', 'debug', 'resolved', 'part8-no-shape-test-for-sprouts-and-bodies.md'));
const CORPUS_PATH = path.join(__dirname, 'fixtures', '3692', 'guard-survey-corpus.json');

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }

let classifyShape = null;
let loadError = null;
try {
  classifyShape = require(MODULE_PATH).classifyShape;
  if (typeof classifyShape !== 'function') throw new Error('classifyShape is not a function');
} catch (e) {
  loadError = e && e.message ? e.message : String(e);
}

function arm(label, fn) {
  if (loadError) { fail(label, 'module did not load: ' + loadError); return; }
  try { fn(); } catch (e) { fail(label, 'threw ' + (e && e.message ? e.message : String(e))); }
}

function kindOf(s) { return classifyShape(s).kind; }

function expectKinds(label, kind, strings) {
  arm(label, function () {
    const wrong = strings.filter(function (s) { return kindOf(s) !== kind; });
    if (wrong.length) fail(label, wrong.length + ' of ' + strings.length + ' not ' + kind + ': ' + JSON.stringify(wrong[0]).slice(0, 80));
    else ok(label, strings.length + ' strings are ' + kind);
  });
}

// ---- anchored lines of the RCA --------------------------------------------
function readRca() {
  const t = fs.readFileSync(RCA_PATH, 'utf8');
  function num(name) {
    const m = t.match(new RegExp('^' + name + ': (\\d+)$', 'm'));
    if (!m) throw new Error('RCA line missing: ' + name);
    return parseInt(m[1], 10);
  }
  const ids = t.match(/^negatives_sprout_ids: (.+)$/m);
  if (!ids) throw new Error('RCA line missing: negatives_sprout_ids');
  const classes = {};
  const re = /^- (X\d+) (sprout|edge|body)\b/gm;
  let m;
  while ((m = re.exec(t)) !== null) classes[m[1]] = m[2];
  return {
    sproutMaxWords: num('sprout_max_words'),
    bodyMinWords: num('body_min_words'),
    bodyMinSentences: num('body_min_sentences'),
    corpusBodyCount: num('corpus_body_count'),
    negativesSproutCount: num('negatives_sprout_count'),
    negativesSproutIds: ids[1].trim() === 'none' ? [] : ids[1].split(',').map(function (x) { return x.trim(); }),
    negativeClasses: classes,
  };
}

// ---- the extended set, built as tests/test-3692-guard-survey-gate.cjs builds it
function buildExtended(corpus) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8'));
  const ext = corpus.extended;
  const all = [];
  [].concat(doc.framework_names, doc.curated_extras || []).forEach(function (n) { all.push(ext.frameworks.prefix + n); });
  const rejectRe = new RegExp(ext.commands.reject_regex);
  const cmdDir = path.join(ROOT, 'commands');
  fs.readdirSync(cmdDir).filter(function (f) { return f.endsWith('.md'); }).sort().forEach(function (f) {
    const t = fs.readFileSync(path.join(cmdDir, f), 'utf8');
    const m = t.match(/^description:\s*(.+)$/m);
    if (!m) return;
    let d = m[1].trim().replace(/^["']|["']$/g, '');
    if (d.length < ext.commands.min || d.length > ext.commands.max) return;
    if (rejectRe.test(d)) return;
    d = d.charAt(0).toLowerCase() + d.slice(1);
    all.push(ext.commands.prefix + d.replace(/\.$/, ''));
  });
  const sections = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS;
  Object.keys(sections).forEach(function (slug) {
    const label = String(sections[slug].label).toLowerCase().replace(/&/g, 'and');
    all.push(ext.sections.template.replace('{label}', label));
  });
  return all;
}

function wordsOf(n) {
  const w = [];
  for (let i = 0; i < n; i += 1) w.push('term' + String.fromCharCode(97 + (i % 26)));
  return w.join(' ');
}

// ---- SH1 ------------------------------------------------------------------
expectKinds('SH1', 'sprout', [
  'Ilvane Trosk disruption theory',
  'lean startup pivot examples',
  'runway benchmarks seed saas',
  'swot analysis Acme Robotics Boston March',
  'what is the porter five forces framework',
]);

// ---- SH2 ------------------------------------------------------------------
const longSentence = 'the market for small warehouse grippers has grown quickly because ' + wordsOf(50) + ' and then it slowed';
expectKinds('SH2', 'body', [
  'The pilot started in spring. The buyers asked for a lower price. We agreed to review it in June.',
  longSentence,
  'first line of a note\nsecond line of a note\nthird line of a note',
  'the memo said "the pilot ended early after the buyers left" and nothing else',
  '> a quoted line from a private memo',
  '```\nconst x = 1;\n```',
]);

// ---- SH3 ------------------------------------------------------------------
expectKinds('SH3', 'edge', [
  'my startup lost its first customers last quarter',
  'we are building a gripper for small warehouses and our pilot starts in spring',
]);

// ---- SH4 ------------------------------------------------------------------
arm('SH4', function () {
  const inputs = [null, undefined, 42, {}, [], true, function () {}];
  const bad = [];
  inputs.forEach(function (v, i) {
    try {
      const r = classifyShape(v);
      if (!r || r.kind !== 'body') bad.push('input ' + i + ' is not body');
    } catch (e) { bad.push('input ' + i + ' threw'); }
  });
  if (bad.length) fail('SH4', bad.join('; '));
  else ok('SH4', inputs.length + ' non-string inputs are body and none throws');
});

// ---- SH5 ------------------------------------------------------------------
arm('SH5', function () {
  const rca = readRca();
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  const problems = [];

  const questions = corpus.positives_26.map(function (p) { return p.q; }).concat(buildExtended(corpus));
  const bodies = questions.filter(function (q) { return kindOf(q) === 'body'; });
  if (bodies.length !== rca.corpusBodyCount) problems.push('corpus_body_count ' + bodies.length + ' != ' + rca.corpusBodyCount);
  if (rca.corpusBodyCount !== 0) problems.push('RCA corpus_body_count is not 0');

  const sproutIds = [];
  corpus.negatives.forEach(function (n) {
    const k = kindOf(n.q);
    if (rca.negativeClasses[n.id] !== k) problems.push(n.id + ' class ' + k + ' != RCA ' + rca.negativeClasses[n.id]);
    if (k === 'sprout') sproutIds.push(n.id);
  });
  if (sproutIds.length !== rca.negativesSproutCount) problems.push('negatives_sprout_count ' + sproutIds.length + ' != ' + rca.negativesSproutCount);
  if (sproutIds.join(',') !== rca.negativesSproutIds.join(',')) problems.push('negatives_sprout_ids ' + sproutIds.join(',') + ' != ' + rca.negativesSproutIds.join(','));

  // boundaries of the thresholds, read from the RCA
  if (kindOf(wordsOf(rca.sproutMaxWords)) !== 'sprout') problems.push('words at sprout_max_words is not sprout');
  if (kindOf(wordsOf(rca.sproutMaxWords + 1)) !== 'edge') problems.push('words above sprout_max_words is not edge');
  if (kindOf(wordsOf(rca.bodyMinWords - 1)) !== 'edge') problems.push('words below body_min_words is not edge');
  if (kindOf(wordsOf(rca.bodyMinWords)) !== 'body') problems.push('words at body_min_words is not body');
  const sent = function (n) { const a = []; for (let i = 0; i < n; i += 1) a.push('Pilot notes number ' + 'abc'.charAt(i % 3) + ' stand here.'); return a.join(' '); };
  if (kindOf(sent(rca.bodyMinSentences - 1)) !== 'edge') problems.push('sentences below body_min_sentences is not edge');
  if (kindOf(sent(rca.bodyMinSentences)) !== 'body') problems.push('sentences at body_min_sentences is not body');

  if (problems.length) fail('SH5', problems.join('; '));
  else ok('SH5', 'corpus_body_count 0 of ' + questions.length + '; negatives_sprout_ids ' + (sproutIds.join(',') || 'none') + '; thresholds hold');
});

// ---- SH6 ------------------------------------------------------------------
arm('SH6', function () {
  const problems = [];
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const reqs = src.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || [];
  reqs.forEach(function (r) {
    const name = r.match(/['"]([^'"]+)['"]/)[1];
    if (!name.startsWith('node:')) problems.push('non built-in require ' + name);
  });
  if (/\bfetch\s*\(|require\(\s*['"](?:node:)?https?['"]\s*\)|XMLHttpRequest|WebSocket/.test(src)) problems.push('network call in source');
  if (new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(src)) problems.push('dash in source');

  const sample = 'which framework fits my pricing';
  const first = JSON.stringify(classifyShape(sample));
  for (let i = 0; i < 100; i += 1) {
    if (JSON.stringify(classifyShape(sample)) !== first) { problems.push('not deterministic'); break; }
  }
  const big = 'lorem ipsum dolor sit amet. '.repeat(Math.ceil((1024 * 1024) / 28)).slice(0, 1024 * 1024);
  const t0 = process.hrtime.bigint();
  const r = classifyShape(big);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (r.kind !== 'body') problems.push('1 MB string is not body');
  if (ms >= 200) problems.push('1 MB string took ' + ms.toFixed(0) + ' ms');

  if (problems.length) fail('SH6', problems.join('; '));
  else ok('SH6', 'pure, deterministic, 1 MB in ' + ms.toFixed(0) + ' ms');
});

if (failures > 0) {
  console.log('\n' + failures + ' arm(s) failed');
  process.exit(1);
}
console.log('\nAll sprout and body shape arms passed');
