#!/usr/bin/env node
'use strict';
// Phase 400-15 (LR-01, S5): the owner review file 400-LABEL-REVIEW.md stays true to the data.
// Legs V1 to V4. V1: every "- ids (<name>): a, b, c" line (and every "- names (<name>): a; b"
// line) equals the set computed from the frontmatter, the registry and the data files.
// V2: every "count (<name>): N" line equals the computed count. V3: the 10 sections, the
// decimal rule (only the stated thresholds and a fitted wicked cut-off), no dash characters,
// the card wording copied exactly from data/cynefin-domains.json, the wicked cut-off state.
// V4: mutation control on a scratch copy (one id removed, one count changed).
// The review file holds ids, labels and counts only; it never holds research text (T-400-49).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const PHASES = path.join(ROOT, '.planning/phases');
const PHASE_DIR = path.join(
  PHASES,
  fs.readdirSync(PHASES).find((d) => d.startsWith('400-job-sentences')) || '400-missing',
);
const REVIEW = path.join(PHASE_DIR, '400-LABEL-REVIEW.md');
const REVIEW_399 = path.join(
  PHASES,
  fs.readdirSync(PHASES).find((d) => d.startsWith('399-decision-model')) || '399-missing',
  '399-LABEL-REVIEW.md',
);

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

const js = require(path.join(ROOT, 'lib/core/job-sentence.cjs'));
const { parseFrontmatter } = require(path.join(ROOT, 'scripts/build-command-registry.cjs'));
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const DASHES = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
// The uppercase-W spelling of PwS, built from parts so this file holds no such literal.
const UPPER_W = new RegExp('P' + 'W' + 'S(?!-Book)');
const DOMAINS = ['clear', 'complicated', 'complex', 'chaotic', 'disorder'];
const MOVES = ['categorize', 'analyze', 'probe', 'act', 'slice'];
// RESEARCH Q5: 5 utility run-step commands that read as methodology. The computed list keeps
// only the names that are still run-step commands of kind utility.
const READS_AS_METHODOLOGY = ['/mos:eureka', '/mos:explore-opportunity', '/mos:qualify-opportunity', '/mos:scout', '/mos:radar'];
// O-12: the old commands that stay on the run-step list and are labelled in this phase.
const O12 = ['/mos:organize', '/mos:mva-brief', '/mos:mva-report'];
const WANT_RULE = 'want does not begin with "to "';
const SECTIONS = [
  '## 1. Job vocabulary sentences',
  '## 2. Carried from 399',
  '## 3. Capability sentences',
  '## 4. fits_domains',
  '## 5. move_type',
  '## 6. Move matching exclusions',
  '## 7. O-12 commands',
  '## 8. Card wording and host notes (O-03)',
  '## 9. Problem axes (S3)',
  '## 10. Owner-gated relay steps',
];
const ALLOWED_DECIMALS = ['0.70', '0.89', '0.90', '0.5'];

const slotsValid = (s) => !!s && js.slotErrors({ when: s.when, want: s.want, so: s.so }).length === 0;

// Rows of a markdown table "| Job | Command | ... |" under a "## <n>." heading of 399-LABEL-REVIEW.md.
function pairsOf399Section(text, n) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('## ' + n + '.'));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    const m = lines[i].match(/^\| ([a-z-]+) \| (\/mos:[a-z0-9-]+) \|/);
    if (m) out.push(m[1] + '|' + m[2]);
  }
  return out;
}

function frontmatterLines(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return [];
  const end = lines.indexOf('---', 1);
  return end < 0 ? [] : lines.slice(1, end);
}

function compute() {
  const lists = {};
  const counts = {};
  const registry = readJson('data/command-registry.json').commands;
  const byName = new Map(registry.map((c) => [c.command, c]));
  const runStepNames = readJson('data/run-step-capabilities.json').commands;
  const runStep = runStepNames.map((n) => byName.get(n)).filter(Boolean);
  const sorted = (a) => [...a].sort();

  // 1. Vocabulary.
  const voc = readJson('data/job-vocabulary.json');
  lists['vocabulary-provisional'] = sorted(voc.ids.filter((id) => voc.jobs[id].sentence_status === 'provisional'));
  lists['section-only-jobs'] = sorted(
    voc.ids.filter((id) => JSON.stringify(voc.jobs[id].origins) === JSON.stringify(['section_canon'])),
  );
  // The 3 ids Phase 399 added from the registry (summary_source phase-399); the research drafts hold no sentence for them.
  lists['jobs-without-research-draft'] = sorted(voc.ids.filter((id) => voc.jobs[id].summary_source === 'phase-399'));
  counts['sentences-vocabulary'] = voc.ids.filter((id) => slotsValid(voc.jobs[id].slots)).length;

  // 2. Carried from 399.
  const canon = readJson('data/section-job-canon.json').sections;
  lists['carry-section-jobs'] = sorted(
    ['funding', 'personas'].filter((s) => canon[s]).map((s) => s + '|' + canon[s].job_id),
  );
  const text399 = fs.readFileSync(REVIEW_399, 'utf8');
  const serves = (pair) => {
    const [job, cmd] = pair.split('|');
    const c = byName.get(cmd);
    return !!c && (c.serves_jtbd || []).includes(job);
  };
  lists['held-pairs'] = sorted(pairsOf399Section(text399, 1).filter((p) => byName.has(p.split('|')[1]) && !serves(p)));
  lists['doubtful-labels'] = sorted(pairsOf399Section(text399, 2).filter((p) => serves(p)));
  const rec = readJson('tests/fixtures/399/recorded-job-command-yes-no.json').pairs;
  counts['band-0.70-0.89'] = rec.filter((p) => p.p >= 0.7 && p.p < 0.9 && byName.has(p.command) && !serves(p.job + '|' + p.command)).length;

  // 3. Capability sentences.
  counts['sentences-commands'] = registry.filter((c) => slotsValid(c.job_sentence)).length;
  const cmdFiles = fs.readdirSync(path.join(ROOT, 'commands')).filter((f) => f.endsWith('.md'));
  const fmNames = new Set();
  let stalePointers = 0;
  for (const f of cmdFiles) {
    const t = fs.readFileSync(path.join(ROOT, 'commands', f), 'utf8');
    const fm = parseFrontmatter(t) || {};
    if (fm.name) fmNames.add(String(fm.name));
    if (t.includes('first delivery at commands/')) stalePointers += 1;
  }
  counts['stale-delivery-pointers'] = stalePointers;
  const standalone = fs
    .readdirSync(path.join(ROOT, 'skills'))
    .filter((d) => fs.existsSync(path.join(ROOT, 'skills', d, 'SKILL.md')))
    .filter((d) => !fs.existsSync(path.join(ROOT, 'commands', d + '.md')) && !fmNames.has(d))
    .map((d) => 'skills/' + d + '/SKILL.md');
  const agents = fs
    .readdirSync(path.join(ROOT, 'agents'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => 'agents/' + f);
  const fmValid = (rel) => slotsValid(js.slotsFromFrontmatter(parseFrontmatter(fs.readFileSync(path.join(ROOT, rel), 'utf8')) || {}));
  counts['sentences-standalone-skills'] = standalone.filter(fmValid).length;
  counts['sentences-agents'] = agents.filter(fmValid).length;
  const mcp = readJson('data/mcp-tool-job-sentences.json').tools;
  counts['sentences-mcp-tools'] = Object.keys(mcp).filter((k) => slotsValid(mcp[k])).length;
  const fw = js.frameworkSentences();
  counts['framework-statements'] = fw.filter((f) => f.slots).length;
  lists['framework-want-exempt'] = sorted(
    fw.filter((f) => f.slots && js.slotErrors(f.slots).includes(WANT_RULE)).map((f) => f.name),
  );
  // F1 (Phase 401): job lines after the first "# ---" comment line inside frontmatter.
  const after = [];
  const before = [];
  for (const rel of [...agents, ...standalone]) {
    const fm = frontmatterLines(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const c = fm.findIndex((l) => /^# ---/.test(l));
    const j = fm.findIndex((l) => /^job_when:/.test(l));
    if (c >= 0 && j >= 0 && c < j) after.push(rel);
    else before.push(rel);
  }
  counts['job-lines-after-comment'] = after.length;
  lists['job-lines-not-after-comment'] = sorted(before);

  // 4 and 5. fits_domains and move_type on the run-step commands.
  counts['run-step-commands'] = runStep.length;
  for (const d of DOMAINS) lists['fits-' + d] = sorted(runStep.filter((c) => (c.fits_domains || []).includes(d)).map((c) => c.command));
  lists['no-domain'] = sorted(runStep.filter((c) => !(c.fits_domains || []).length).map((c) => c.command));
  for (const m of MOVES) lists['move-' + m] = sorted(runStep.filter((c) => c.move_type === m).map((c) => c.command));
  lists['move-weak'] = sorted(runStep.filter((c) => c.move_type_weak === true).map((c) => c.command));

  // 6. Move matching exclusions (rule: only kind methodology enters move matching).
  counts['methodology-run-step'] = runStep.filter((c) => c.kind === 'methodology').length;
  const excluded = runStep.filter((c) => c.kind !== 'methodology');
  lists['move-matching-excluded'] = sorted(excluded.map((c) => c.command));
  for (const k of [...new Set(excluded.map((c) => c.kind))].sort()) {
    lists['excluded-' + k] = sorted(excluded.filter((c) => c.kind === k).map((c) => c.command));
  }
  lists['excluded-categorize'] = sorted(excluded.filter((c) => c.move_type === 'categorize').map((c) => c.command));
  lists['utility-reads-as-methodology'] = sorted(
    READS_AS_METHODOLOGY.filter((n) => runStepNames.includes(n) && byName.get(n) && byName.get(n).kind === 'utility'),
  );

  // 7. O-12.
  lists['o12-labelled'] = sorted(
    O12.filter((n) => {
      const c = byName.get(n);
      return runStepNames.includes(n) && c && slotsValid(c.job_sentence) && c.move_type && c.cynefin_label_status === 'provisional';
    }),
  );

  // 8. Card.
  const cyn = readJson('data/cynefin-domains.json');
  lists['card-options'] = sorted(cyn.card.stages.flatMap((s) => s.options.map((o) => o.id)));

  // 10. Owner-gated relay steps (services/decision-relay/README.md, the K4 list).
  const readme = fs.readFileSync(path.join(ROOT, 'services/decision-relay/README.md'), 'utf8').split(/\r?\n/);
  const g = readme.findIndex((l) => l === '## OWNER-GATED steps');
  let steps = 0;
  for (let i = g + 1; g >= 0 && i < readme.length && !readme[i].startsWith('## '); i += 1) if (/^\d+\. /.test(readme[i])) steps += 1;
  counts['owner-gated-steps'] = steps;

  for (const [name, ids] of Object.entries(lists)) counts[name] = ids.length;
  return { lists, counts };
}

function parseReview(text) {
  const lists = {};
  const counts = {};
  const dup = [];
  for (const line of text.split(/\r?\n/)) {
    let m = line.match(/^- (ids|names) \(([a-z0-9.-]+)\): (.*)$/);
    if (m) {
      if (Object.prototype.hasOwnProperty.call(lists, m[2])) dup.push('list ' + m[2]);
      const body = m[3].trim();
      lists[m[2]] = body === 'none' ? [] : body.split(m[1] === 'ids' ? ', ' : '; ').map((x) => x.trim());
      continue;
    }
    m = line.match(/^(?:- )?count \(([a-z0-9.-]+)\): (\d+)\s*$/);
    if (m) {
      if (Object.prototype.hasOwnProperty.call(counts, m[1])) dup.push('count ' + m[1]);
      counts[m[1]] = Number(m[2]);
    }
  }
  return { lists, counts, dup };
}

// The compare function of V1, V2 and V4. Returns a list of mismatch strings.
function compareLists(parsed, computed) {
  const errs = parsed.dup.filter((d) => d.startsWith('list')).map((d) => 'duplicate ' + d);
  for (const [name, want] of Object.entries(computed.lists)) {
    const got = parsed.lists[name];
    if (!got) { errs.push('missing list ' + name); continue; }
    if (new Set(got).size !== got.length) errs.push('list ' + name + ' repeats an id');
    const a = [...new Set(got)].sort();
    if (JSON.stringify(a) !== JSON.stringify(want)) {
      const extra = a.filter((x) => !want.includes(x));
      const miss = want.filter((x) => !a.includes(x));
      errs.push('list ' + name + ' differs (missing: ' + miss.join(', ') + '; extra: ' + extra.join(', ') + ')');
    }
  }
  for (const name of Object.keys(parsed.lists)) if (!computed.lists[name]) errs.push('unknown list ' + name);
  return errs;
}
function compareCounts(parsed, computed) {
  const errs = parsed.dup.filter((d) => d.startsWith('count')).map((d) => 'duplicate ' + d);
  for (const [name, want] of Object.entries(computed.counts)) {
    if (!Object.prototype.hasOwnProperty.call(parsed.counts, name)) errs.push('missing count ' + name);
    else if (parsed.counts[name] !== want) errs.push('count ' + name + ' is ' + parsed.counts[name] + ', computed ' + want);
  }
  for (const name of Object.keys(parsed.counts)) if (!Object.prototype.hasOwnProperty.call(computed.counts, name)) errs.push('unknown count ' + name);
  return errs;
}

const PINNED_COUNTS = {
  'sentences-vocabulary': 20,
  'sentences-commands': 113,
  'sentences-standalone-skills': 12,
  'sentences-agents': 17,
  'sentences-mcp-tools': 63,
  'framework-statements': 184,
  'band-0.70-0.89': 134,
};

const exists = fs.existsSync(REVIEW);
const reviewText = exists ? fs.readFileSync(REVIEW, 'utf8') : '';
const computed = compute();
const parsed = parseReview(reviewText);

check('V1 every id list of the review file equals the computed set', () => {
  assert.ok(exists, 'missing ' + path.relative(ROOT, REVIEW));
  const errs = compareLists(parsed, computed);
  assert.deepEqual(errs, [], errs.join(' | '));
});

check('V2 every count line equals the computed count, and the pinned phase counts hold', () => {
  assert.ok(exists, 'missing review file');
  for (const [k, v] of Object.entries(PINNED_COUNTS)) assert.equal(computed.counts[k], v, 'computed ' + k);
  const errs = compareCounts(parsed, computed);
  assert.deepEqual(errs, [], errs.join(' | '));
});

check('V3 sections 1 to 10, decimals, dashes, PwS spelling, card wording, wicked cut-off state', () => {
  assert.ok(exists, 'missing review file');
  const lines = reviewText.split(/\r?\n/);
  assert.deepEqual(lines.filter((l) => l.startsWith('## ')), SECTIONS);
  assert.ok(lines[0].startsWith('# '), 'title line');
  const axes = readJson('data/problem-axes-wording.json').wicked_cutoff;
  const allowed = [...ALLOWED_DECIMALS];
  if ((axes.state === 'fitted' || axes.state === 'ruled') && typeof axes.value === 'number') allowed.push(String(axes.value));
  const bad = [];
  lines.forEach((l, i) => {
    for (const d of l.match(/\d+\.\d+/g) || []) if (!allowed.includes(d)) bad.push(i + 1 + ': ' + d);
    if (DASHES.test(l)) bad.push(i + 1 + ': dash');
    if (UPPER_W.test(l)) bad.push(i + 1 + ': uppercase W');
  });
  assert.deepEqual(bad, []);
  const cyn = readJson('data/cynefin-domains.json');
  const texts = [cyn.host_notes.disorder.text, cyn.host_notes.chaotic.text];
  for (const s of cyn.card.stages) {
    texts.push(s.header);
    for (const o of s.options) texts.push(o.label);
  }
  for (const t of texts) assert.ok(reviewText.includes(t), 'card text not copied exactly: ' + t);
  assert.ok(/O-13/.test(reviewText) && /ACCEPTED/.test(reviewText), 'O-13 accepted state');
  if (axes.state === 'fitted') assert.ok(reviewText.includes('value ' + axes.value), 'fitted value');
  else if (axes.state === 'ruled') {
    assert.ok(reviewText.includes('state ruled') && reviewText.includes('value ' + axes.value), 'ruled state and value');
    assert.ok(/not a fit/.test(reviewText), 'the review says a ruled value is not a fit');
    assert.ok(/NEEDS_HUMAN: /.test(reviewText), 'NEEDS_HUMAN line of plan 11');
  } else {
    assert.equal(axes.state, 'not_fitted');
    assert.ok(reviewText.includes('state not_fitted'), 'not_fitted state');
    assert.ok(/NEEDS_HUMAN: /.test(reviewText), 'NEEDS_HUMAN line of plan 11');
  }
});

check('V4 mutation control: one id removed and one count changed are reported', () => {
  assert.ok(exists, 'missing review file');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-15-'));
  try {
    const victim = '/mos:organize';
    const mutated = reviewText
      .split(/\r?\n/)
      .map((l) => (l.startsWith('- ids (move-categorize): ') ? l.replace(', ' + victim, '').replace(victim + ', ', '') : l))
      .map((l) => (l.startsWith('- count (fits-clear): ') ? '- count (fits-clear): 99' : l))
      .join('\n');
    assert.notEqual(mutated, reviewText, 'the mutation changed nothing');
    const file = path.join(dir, '400-LABEL-REVIEW.md');
    fs.writeFileSync(file, mutated);
    const p2 = parseReview(fs.readFileSync(file, 'utf8'));
    const le = compareLists(p2, computed);
    const ce = compareCounts(p2, computed);
    assert.ok(le.some((e) => e.startsWith('list move-categorize differs (missing: ' + victim)), le.join(' | '));
    assert.ok(ce.some((e) => e.startsWith('count fits-clear is 99')), ce.join(' | '));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(!fs.readdirSync(os.tmpdir()).some((d) => d === path.basename(dir)), 'scratch dir removed');
});

console.log('test-400-review-lists: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
