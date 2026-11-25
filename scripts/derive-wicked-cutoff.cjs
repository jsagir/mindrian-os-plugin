#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 11 (AX-02, F-06): fit the wicked cut-off at dev time.
 *
 * F-06 found that the raw wicked answer of the research model says yes too readily at 0.5. This script
 * fits a cut-off from a recorded answers file and one-labeller label files, and stores only the cut-off
 * value, the counts and the file hashes in the wicked_cutoff block of data/problem-axes-wording.json.
 * lib/core/problem-axes.cjs wickedFromProbability reads that block; with no fit it answers null.
 *
 * Inputs (private research files, read only):
 *   --answers <file>  JSON {answers: {Q01: {wicked_p, ...}, ...}}. Only the case id and wicked_p are read.
 *   --labels <file>   repeatable; one case per line: ^(Q\d+)\s+(Un|Ill|Well)\s+(yes|no) (the last field is wicked).
 * A path that holds DO-NOT-OPEN is refused by name (exit 2) before any file is read.
 *
 * Fit rule: the candidates are the midpoints between consecutive distinct sorted probabilities; yes means
 * p at or above the candidate. Pick the fewest errors (false yes plus missed); a tie takes the widest gap,
 * then the lower candidate. The value is rounded to 3 decimals.
 *
 * Usage:
 *   node scripts/derive-wicked-cutoff.cjs --answers <file> --labels <file> [--labels <file>] [--dry-run | --write]
 *   node scripts/derive-wicked-cutoff.cjs --check
 * Exit: 0 ok, 1 error or a bad stored block, 2 a refused DO-NOT-OPEN path.
 *
 * Root: MINDRIAN_APPLY_ROOT when set (test seam), else the repo root. Zero network. Writes no case id,
 * no text and no probability.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.env.MINDRIAN_APPLY_ROOT ? path.resolve(process.env.MINDRIAN_APPLY_ROOT) : path.resolve(__dirname, '..');
const DATA_REL = path.join('data', 'problem-axes-wording.json');
const LABEL_LINE = /^(Q\d+)\s+(Un|Ill|Well)\s+(yes|no)\b/;
const FORBIDDEN = 'DO-NOT-OPEN';
const RULE = 'a wicked probability becomes yes only at or above a stored cut-off: fitted from labels, or ruled by the owner and provisional until a fit replaces it; with no stored cut-off the answer is unknown (null); never a raw 0.5 cut (F-06)';
const BLOCK_KEYS = ['state', 'value', 'fitted_on', 'sources', 'status', 'rule'];

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

// Gaps are compared at 9 decimals so that float noise (0.6 - 0.4 against 0.4 - 0.2) is not a real difference.
function round9(x) {
  return Math.round(x * 1e9) / 1e9;
}

/*
 * fitCutoff(points): points [{p, yes}]. Returns {value, false_yes, missed} or null when fewer than 2
 * distinct probabilities give no candidate. Pure.
 */
function fitCutoff(points) {
  const distinct = Array.from(new Set(points.map((x) => x.p))).sort((a, b) => a - b);
  if (distinct.length < 2) return null;
  let best = null;
  for (let i = 0; i + 1 < distinct.length; i++) {
    const cut = (distinct[i] + distinct[i + 1]) / 2;
    const gap = round9(distinct[i + 1] - distinct[i]);
    let falseYes = 0;
    let missed = 0;
    for (const x of points) {
      const predicted = x.p >= cut;
      if (predicted && !x.yes) falseYes += 1;
      if (!predicted && x.yes) missed += 1;
    }
    const errors = falseYes + missed;
    // Candidates are visited in rising order, so a strict comparison keeps the lower candidate on a full tie.
    if (best === null || errors < best.errors || (errors === best.errors && gap > best.gap)) {
      best = { cut, gap, errors, false_yes: falseYes, missed };
    }
  }
  return { value: round3(best.cut), false_yes: best.false_yes, missed: best.missed };
}

function readWithHash(file) {
  const raw = fs.readFileSync(file);
  return { raw, name: path.basename(file), sha256: crypto.createHash('sha256').update(raw).digest('hex') };
}

// Only the case id and wicked_p of each answer are read.
function readAnswers(file) {
  const f = readWithHash(file);
  const doc = JSON.parse(f.raw.toString('utf8'));
  const answers = doc && typeof doc === 'object' && doc.answers && typeof doc.answers === 'object' ? doc.answers : {};
  const probs = new Map();
  for (const id of Object.keys(answers)) {
    if (!/^Q\d+$/.test(id)) continue;
    const p = answers[id] && answers[id].wicked_p;
    if (typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1) probs.set(id, p);
  }
  return { probs, source: { name: f.name, sha256: f.sha256 } };
}

// Only the case id and the wicked field of each label line are kept.
function readLabels(file) {
  const f = readWithHash(file);
  const labels = new Map();
  for (const line of f.raw.toString('utf8').split(/\r?\n/)) {
    const m = LABEL_LINE.exec(line.trim());
    if (m) labels.set(m[1], m[3] === 'yes');
  }
  return { labels, source: { name: f.name, sha256: f.sha256 } };
}

function fail(msg, code) {
  process.stderr.write('derive-wicked-cutoff: ' + msg + '\n');
  process.exit(code === undefined ? 1 : code);
}

function dataPath() {
  return path.join(ROOT, DATA_REL);
}

function checkBlock(block) {
  if (!block || typeof block !== 'object') return 'no wicked_cutoff block';
  const keys = Object.keys(block);
  // A ruled block (owner sign-off 2026-11-25) carries one more key, ruled_on, which says how and by whom the value was chosen.
  const wanted = block.state === 'ruled' ? BLOCK_KEYS.concat(['ruled_on']) : BLOCK_KEYS;
  if (JSON.stringify(keys) !== JSON.stringify(wanted)) return 'wicked_cutoff keys are ' + JSON.stringify(keys);
  if (block.status !== 'provisional') return 'status is not provisional';
  if (typeof block.rule !== 'string' || !block.rule) return 'no rule';
  if (block.state === 'not_fitted') {
    if (block.value !== null || block.fitted_on !== null || block.sources !== null) return 'a not_fitted block carries a value, counts or sources';
    return null;
  }
  if (block.state === 'fitted') {
    if (typeof block.value !== 'number' || !Number.isFinite(block.value) || block.value < 0 || block.value > 1) return 'fitted value is not a number in 0..1';
    const f = block.fitted_on;
    if (!f || typeof f !== 'object') return 'fitted block has no fitted_on';
    for (const k of ['cases', 'wicked_yes', 'false_yes', 'missed']) {
      if (!Number.isInteger(f[k]) || f[k] < 0) return 'fitted_on.' + k + ' is not a count';
    }
    if (!Array.isArray(block.sources)) return 'fitted block has no sources list';
    for (const s of block.sources) {
      if (!s || typeof s.name !== 'string' || !/^[0-9a-f]{64}$/.test(String(s.sha256))) return 'a source has no name or sha256';
    }
    return null;
  }
  if (block.state === 'ruled') {
    if (typeof block.value !== 'number' || !Number.isFinite(block.value) || block.value < 0 || block.value > 1) return 'ruled value is not a number in 0..1';
    if (block.fitted_on !== null || block.sources !== null) return 'a ruled block carries fit counts or sources; it is not a fit';
    const r = block.ruled_on;
    if (!r || typeof r !== 'object') return 'ruled block has no ruled_on';
    for (const k of ['method', 'decided_by', 'decided_at']) {
      if (typeof r[k] !== 'string' || !r[k]) return 'ruled_on.' + k + ' is missing';
    }
    return null;
  }
  return 'unknown state ' + JSON.stringify(block.state);
}

function runCheck() {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(dataPath(), 'utf8'));
  } catch (e) {
    fail('cannot read ' + DATA_REL + ': ' + e.message);
  }
  const problem = checkBlock(doc.wicked_cutoff);
  if (problem) fail('--check: ' + problem);
  console.log('derive-wicked-cutoff --check: ok (state ' + doc.wicked_cutoff.state + ')');
}

function runFit(opts) {
  if (!opts.answers) fail('--answers <file> is required');
  if (opts.labels.length === 0) fail('--labels <file> is required');
  const answers = readAnswers(opts.answers);
  const labels = new Map();
  const sources = [answers.source];
  for (const file of opts.labels) {
    const l = readLabels(file);
    for (const [id, yes] of l.labels) labels.set(id, yes);
    sources.push(l.source);
  }
  const points = [];
  for (const [id, yes] of labels) {
    if (answers.probs.has(id)) points.push({ p: answers.probs.get(id), yes });
  }
  const fit = fitCutoff(points);
  if (!fit) fail('no candidate cut-off: ' + points.length + ' labelled cases with fewer than 2 distinct probabilities');
  const fittedOn = { cases: points.length, wicked_yes: points.filter((x) => x.yes).length, false_yes: fit.false_yes, missed: fit.missed };
  console.log('wicked cut-off: value ' + fit.value + ' cases ' + fittedOn.cases + ' wicked_yes ' + fittedOn.wicked_yes + ' false_yes ' + fittedOn.false_yes + ' missed ' + fittedOn.missed);
  if (!opts.write) {
    console.log('dry run: nothing written');
    return;
  }
  const doc = JSON.parse(fs.readFileSync(dataPath(), 'utf8'));
  doc.wicked_cutoff = { state: 'fitted', value: fit.value, fitted_on: fittedOn, sources, status: 'provisional', rule: RULE };
  const problem = checkBlock(doc.wicked_cutoff);
  if (problem) fail('refusing to write: ' + problem);
  fs.writeFileSync(dataPath(), JSON.stringify(doc, null, 2) + '\n');
  console.log('wrote ' + DATA_REL);
}

function main(argv) {
  const opts = { answers: null, labels: [], write: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--answers':
        opts.answers = argv[++i];
        break;
      case '--labels':
        opts.labels.push(argv[++i]);
        break;
      case '--dry-run':
        opts.write = false;
        break;
      case '--write':
        opts.write = true;
        break;
      case '--check':
        opts.check = true;
        break;
      default:
        fail('unknown argument ' + JSON.stringify(a));
    }
  }
  // Refuse a forbidden path by name before any file is read.
  for (const p of [opts.answers].concat(opts.labels)) {
    if (p === undefined) fail('a path flag has no value');
    if (typeof p === 'string' && p.indexOf(FORBIDDEN) !== -1) fail('refused a ' + FORBIDDEN + ' path by name; nothing was read', 2);
  }
  if (opts.check) return runCheck();
  return runFit(opts);
}

module.exports = { fitCutoff, checkBlock, RULE };

if (require.main === module) main(process.argv.slice(2));
