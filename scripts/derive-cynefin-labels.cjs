#!/usr/bin/env node
'use strict';
// Phase 400 plan 06 (CY-04, O-11, O-12): the one writer of the Cynefin label frontmatter keys.
//
// Dev-time only. It reads the recorded labels-only runs (a fit file and a moves file, given on
// the command line, never shipped) and writes 4 own frontmatter keys on each run-step command
// (data/run-step-capabilities.json), resolved by its frontmatter name: field:
//   fits_domains: ["complicated","complex"]   domains with p at or above the threshold
//   move_type: "analyze"                       the top move; ties take the first MOVE_TYPES id
//   move_type_weak: true                       the top move probability is under 0.5
//   cynefin_label_status: "provisional"        the owner review (plan 15) can set "ruled"
// The keys go right after job_sentence_status: when the file has it, else immediately before
// the closing ---. A second run replaces the lines in place. description is never touched.
// No probability and no research text enters the repo (T-400-13): frontmatter holds ids and
// booleans; data/cynefin-label-provenance.json holds source names, sha256 hashes, rules and counts.
//
// Modes:
//   --fit <file> --moves <file> [--threshold 0.70] [--dry-run]   derive and write
//   --check                                                       labels and provenance agree
// Exit codes: 0 ok, 1 check miss, 2 bad input or unresolvable file. One bad command refuses the
//   whole batch before any write.
// Root: MINDRIAN_APPLY_ROOT when set (test seam), else the repo root. Zero network.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ax = require('../lib/core/problem-axes.cjs');
const js = require('../lib/core/job-sentence.cjs');
const { parseFrontmatter } = require('./build-command-registry.cjs');

const ROOT = process.env.MINDRIAN_APPLY_ROOT ? path.resolve(process.env.MINDRIAN_APPLY_ROOT) : path.resolve(__dirname, '..');
const PROVENANCE = path.join(ROOT, 'data', 'cynefin-label-provenance.json');
const RUN_STEP = path.join(ROOT, 'data', 'run-step-capabilities.json');
const DOMAINS = ax.CAUSE_EFFECT_DOMAINS;
const MOVES = ax.MOVE_TYPES;
// One status pair for both provisional label families of phase 400 (job sentences and these labels).
const STATUSES = js.SENTENCE_STATUSES;
const KEYS = ['fits_domains', 'move_type', 'move_type_weak', 'cynefin_label_status'];
const KEY_LINE_RE = new RegExp('^(' + KEYS.join('|') + '):');
const DEFAULT_THRESHOLD = 0.7;
const WEAK_BELOW = 0.5;
const SCHEMA = 'mos.cynefin-label-provenance/1';
const RULES = [
  'fits_domains: domains with p at or above the threshold, in CAUSE_EFFECT_DOMAINS order',
  'move_type: the top move; ties take the first id in MOVE_TYPES order',
  'move matching in the advisor reads only commands of kind methodology (plan 09); other kinds keep the 399 behaviour',
];

function bare(name) {
  return String(name).replace(/^\/mos:/, '');
}

function runStepNames() {
  const doc = JSON.parse(fs.readFileSync(RUN_STEP, 'utf8'));
  return (doc.commands || []).map(bare);
}

function commandFiles() {
  const dir = path.join(ROOT, 'commands');
  const out = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const file = path.join(dir, f);
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const name = typeof fm.name === 'string' && fm.name ? fm.name : f.replace(/\.md$/, '');
    if (!out.has(name)) out.set(name, []);
    out.get(name).push(file);
  }
  return out;
}

// {start, end} line indices of the first --- ... --- block.
function frontmatterBounds(lines) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '').trim() === '---') { start = i; break; }
  }
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, '').trim() === '---') return { start, end: i };
  }
  return null;
}

function keyLines(label, eol) {
  return [
    'fits_domains: ' + JSON.stringify(label.fits_domains) + eol,
    'move_type: "' + label.move_type + '"' + eol,
    'move_type_weak: ' + (label.move_type_weak ? 'true' : 'false') + eol,
    'cynefin_label_status: "' + label.cynefin_label_status + '"' + eol,
  ];
}

// Returns {text} or {error}.
function rewrite(text, label) {
  const lines = text.split('\n');
  const b = frontmatterBounds(lines);
  if (!b) return { error: 'no frontmatter block' };
  const eol = lines[b.start].endsWith('\r') ? '\r' : '';
  const fresh = keyLines(label, eol);
  const existing = [];
  for (let i = b.start + 1; i < b.end; i++) if (KEY_LINE_RE.test(lines[i])) existing.push(i);
  if (existing.length) {
    const at = existing[0];
    const kept = lines.filter((_l, i) => !existing.includes(i));
    kept.splice(at, 0, ...fresh);
    return { text: kept.join('\n') };
  }
  let at = b.end;
  const st = [];
  for (let i = b.start + 1; i < b.end; i++) if (/^job_sentence_status:/.test(lines[i])) st.push(i);
  if (st.length === 1) at = st[0] + 1;
  lines.splice(at, 0, ...fresh);
  return { text: lines.join('\n') };
}

function refuse(lines) {
  for (const l of lines) console.error('REFUSE ' + l);
  console.error('derive-cynefin-labels: batch refused, nothing written');
  process.exit(2);
}

function readJson(file, label) {
  try {
    const raw = fs.readFileSync(path.resolve(file));
    return { doc: JSON.parse(raw.toString('utf8')), sha256: crypto.createHash('sha256').update(raw).digest('hex') };
  } catch (err) {
    refuse(['cannot read the ' + label + ' file ' + file + ': ' + err.message]);
  }
  return null;
}

function isProb(x) {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
}

// The derived label of one command, or an error string.
function deriveOne(name, fitByCmd, movesByCmd, threshold) {
  const fit = fitByCmd.get(name);
  const mv = movesByCmd.get(name);
  const errs = [];
  if (!fit) errs.push('missing from the fit file');
  if (!mv) errs.push('missing from the moves file');
  if (errs.length) return errs.join('; ');
  for (const d of DOMAINS) if (!isProb(fit[d])) errs.push('fit domain ' + d + ' has no probability');
  const probs = mv && mv.probs && typeof mv.probs === 'object' ? mv.probs : null;
  if (!probs) errs.push('moves entry has no probs object');
  else for (const m of MOVES) if (!isProb(probs[m])) errs.push('move ' + m + ' has no probability');
  if (errs.length) return errs.join('; ');
  let top = null;
  let topP = -1;
  for (const m of MOVES) {
    if (probs[m] > topP) {
      topP = probs[m];
      top = m;
    }
  }
  return {
    fits_domains: DOMAINS.filter((d) => fit[d] >= threshold),
    move_type: top,
    move_type_weak: topP < WEAK_BELOW,
    cynefin_label_status: 'provisional',
  };
}

function tally(labels, kinds) {
  const fits = {};
  for (const d of DOMAINS) fits[d] = 0;
  const moves = {};
  for (const m of MOVES) moves[m] = 0;
  let noDomain = 0;
  let weak = 0;
  let methodology = 0;
  for (const [name, l] of labels) {
    for (const d of l.fits_domains) fits[d] += 1;
    if (l.fits_domains.length === 0) noDomain += 1;
    moves[l.move_type] += 1;
    if (l.move_type_weak) weak += 1;
    if (kinds.get(name) === 'methodology') methodology += 1;
  }
  return { fits, no_domain: noDomain, moves, weak, methodology };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fileKind(file) {
  const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  // The registry default (scripts/build-command-registry.cjs): an absent kind is utility.
  return typeof fm.kind === 'string' && fm.kind ? fm.kind : 'utility';
}

function runDerive(argv) {
  let fitFile = null;
  let movesFile = null;
  let threshold = DEFAULT_THRESHOLD;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--fit':
        fitFile = argv[++i];
        break;
      case '--moves':
        movesFile = argv[++i];
        break;
      case '--threshold':
        threshold = Number(argv[++i]);
        break;
      case '--dry-run':
        dryRun = true;
        break;
      default:
        refuse(['unknown argument ' + argv[i]]);
    }
  }
  if (!fitFile || !movesFile) refuse(['--fit and --moves are both required']);
  if (!isProb(threshold)) refuse(['--threshold must be a number from 0 to 1']);
  const fit = readJson(fitFile, 'fit');
  const moves = readJson(movesFile, 'moves');
  if (!Array.isArray(fit.doc.pairs)) refuse(['the fit file has no pairs array']);
  if (!moves.doc.commands || typeof moves.doc.commands !== 'object') refuse(['the moves file has no commands object']);

  const fitByCmd = new Map();
  for (const p of fit.doc.pairs) {
    if (!p || typeof p.command !== 'string' || !DOMAINS.includes(p.domain)) continue;
    const n = bare(p.command);
    if (!fitByCmd.has(n)) fitByCmd.set(n, {});
    fitByCmd.get(n)[p.domain] = p.p;
  }
  const movesByCmd = new Map();
  for (const k of Object.keys(moves.doc.commands)) movesByCmd.set(bare(k), moves.doc.commands[k]);

  const names = runStepNames();
  const files = commandFiles();
  const problems = [];
  const labels = new Map();
  const kinds = new Map();
  const plan = [];
  for (const name of names) {
    const hits = files.get(name) || [];
    if (hits.length !== 1) {
      problems.push(name + ': resolves to ' + hits.length + ' command files');
      continue;
    }
    const l = deriveOne(name, fitByCmd, movesByCmd, threshold);
    if (typeof l === 'string') {
      problems.push(name + ': ' + l);
      continue;
    }
    const before = fs.readFileSync(hits[0], 'utf8');
    const w = rewrite(before, l);
    if (w.error) {
      problems.push(name + ': ' + w.error);
      continue;
    }
    labels.set(name, l);
    kinds.set(name, fileKind(hits[0]));
    plan.push({ file: hits[0], before, after: w.text });
  }
  if (problems.length) refuse(problems);

  const counts = tally(labels, kinds);
  console.log('derive-cynefin-labels: ' + labels.size + ' run-step commands');
  console.log('fits: ' + DOMAINS.map((d) => d + ' ' + counts.fits[d]).join(', ') + ', no domain ' + counts.no_domain);
  console.log('moves: ' + MOVES.map((m) => m + ' ' + counts.moves[m]).join(', ') + ', weak ' + counts.weak);
  console.log('kind methodology: ' + counts.methodology);
  if (dryRun) {
    console.log('derive-cynefin-labels --dry-run: nothing written');
    return;
  }
  let changed = 0;
  for (const p of plan) {
    if (p.after === p.before) continue;
    fs.writeFileSync(p.file, p.after);
    changed++;
  }
  const prov = {
    schema: SCHEMA,
    _note:
      'Phase 400 plan 06 (CY-04): provenance of the provisional Cynefin labels in the run-step command frontmatter. Written by scripts/derive-cynefin-labels.cjs from recorded labels-only runs kept outside the repo. Source names, hashes, rules and counts only; no probability and no model text.',
    status: 'provisional',
    sources: [
      { name: path.basename(fitFile), sha256: fit.sha256 },
      { name: path.basename(movesFile), sha256: moves.sha256 },
    ],
    threshold,
    weak_below: WEAK_BELOW,
    rules: RULES,
    counts,
    derived_on: today(),
  };
  // Keep the old date when nothing else moved, so a repeat run is a no-op.
  if (fs.existsSync(PROVENANCE)) {
    try {
      const old = JSON.parse(fs.readFileSync(PROVENANCE, 'utf8'));
      if (JSON.stringify(Object.assign({}, old, { derived_on: null })) === JSON.stringify(Object.assign({}, prov, { derived_on: null }))) {
        prov.derived_on = old.derived_on;
      }
    } catch (_e) {
      /* rewrite below */
    }
  }
  const provText = JSON.stringify(prov, null, 2) + '\n';
  if (!fs.existsSync(PROVENANCE) || fs.readFileSync(PROVENANCE, 'utf8') !== provText) {
    fs.mkdirSync(path.dirname(PROVENANCE), { recursive: true });
    fs.writeFileSync(PROVENANCE, provText);
  }
  console.log('derive-cynefin-labels: ' + changed + ' file(s) changed, ' + (plan.length - changed) + ' unchanged');
}

// The label of one file from its frontmatter, or an error string; null when it has no label key.
function fileLabel(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const b = frontmatterBounds(lines);
  if (!b) return null;
  const counts = {};
  for (let i = b.start + 1; i < b.end; i++) {
    const m = KEY_LINE_RE.exec(lines[i]);
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  if (Object.keys(counts).length === 0) return null;
  const errs = [];
  for (const k of KEYS) {
    if (!counts[k]) errs.push(k + ' missing');
    else if (counts[k] > 1) errs.push(k + ' appears ' + counts[k] + ' times');
  }
  const fm = parseFrontmatter(text);
  const f = fm.fits_domains;
  if (counts.fits_domains) {
    if (!Array.isArray(f)) errs.push('fits_domains is not an array');
    else {
      if (!f.every((d) => DOMAINS.includes(d))) errs.push('fits_domains holds an id outside CAUSE_EFFECT_DOMAINS');
      if (new Set(f).size !== f.length) errs.push('fits_domains holds a duplicate');
      const ordered = DOMAINS.filter((d) => f.includes(d));
      if (JSON.stringify(ordered) !== JSON.stringify(f)) errs.push('fits_domains is not in CAUSE_EFFECT_DOMAINS order');
    }
  }
  if (counts.move_type && !MOVES.includes(fm.move_type)) errs.push('move_type is outside MOVE_TYPES');
  if (counts.move_type_weak && typeof fm.move_type_weak !== 'boolean') errs.push('move_type_weak is not a boolean');
  if (counts.cynefin_label_status && !STATUSES.includes(fm.cynefin_label_status)) {
    errs.push('cynefin_label_status must be one of ' + STATUSES.join(', '));
  }
  if (errs.length) return errs.join('; ');
  return { fits_domains: f, move_type: fm.move_type, move_type_weak: fm.move_type_weak, cynefin_label_status: fm.cynefin_label_status };
}

function runCheck() {
  const names = new Set(runStepNames());
  const files = commandFiles();
  const misses = [];
  const labels = new Map();
  const kinds = new Map();
  for (const [name, hits] of files) {
    for (const file of hits) {
      const rel = path.relative(ROOT, file);
      const l = fileLabel(file);
      if (!names.has(name)) {
        if (l !== null) misses.push(rel + ' (' + name + '): not a run-step command but carries Cynefin label keys');
        continue;
      }
      if (l === null) misses.push(rel + ' (' + name + '): run-step command without Cynefin label keys');
      else if (typeof l === 'string') misses.push(rel + ' (' + name + '): ' + l);
      else {
        labels.set(name, l);
        kinds.set(name, fileKind(file));
      }
    }
  }
  for (const name of names) if (!files.has(name)) misses.push(name + ': no command file has this name');
  let prov = null;
  try {
    prov = JSON.parse(fs.readFileSync(PROVENANCE, 'utf8'));
  } catch (err) {
    misses.push('data/cynefin-label-provenance.json: cannot read (' + err.message + ')');
  }
  if (prov && misses.length === 0) {
    if (prov.schema !== SCHEMA) misses.push('data/cynefin-label-provenance.json: schema must be ' + SCHEMA);
    const live = tally(labels, kinds);
    const pc = prov.counts || {};
    const pairs = [];
    for (const d of DOMAINS) pairs.push(['counts.fits.' + d, (pc.fits || {})[d], live.fits[d]]);
    pairs.push(['counts.no_domain', pc.no_domain, live.no_domain]);
    for (const m of MOVES) pairs.push(['counts.moves.' + m, (pc.moves || {})[m], live.moves[m]]);
    pairs.push(['counts.weak', pc.weak, live.weak]);
    pairs.push(['counts.methodology', pc.methodology, live.methodology]);
    for (const [k, p, f] of pairs) {
      if (p !== f) misses.push('data/cynefin-label-provenance.json: ' + k + ' is ' + p + ', the frontmatter tally is ' + f);
    }
  }
  for (const m of misses) console.error('MISS ' + m);
  console.log('derive-cynefin-labels --check: ' + labels.size + '/' + names.size + ' run-step commands labelled');
  if (misses.length) process.exit(1);
}

const argv = process.argv.slice(2);
switch (argv[0]) {
  case '--check':
    runCheck();
    break;
  case '--fit':
  case '--moves':
    runDerive(argv);
    break;
  default:
    console.error('usage: node scripts/derive-cynefin-labels.cjs --fit <file> --moves <file> [--threshold 0.70] [--dry-run] | --check');
    process.exit(2);
}
