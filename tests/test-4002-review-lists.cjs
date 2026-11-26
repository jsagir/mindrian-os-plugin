#!/usr/bin/env node
'use strict';
// Phase 400.2 plan 17 (PG-02): the owner review file 400.2-OWNER-REVIEW.md stays true to the code and the data.
// Legs V1 to V5.
//   V1: every "- ids (<name>): a, b", "- names (<name>): a; b" and "- order (<name>): a, b" line equals the value
//       computed from the command, the registry, the data files, the door and the phase files.
//   V2: every "- count (<name>): N" line equals the computed count (section 8 holds the budget counts, see V3).
//   V3: section 8 holds the counts of DEEP_RUN_BUDGET, and DEEP_RUN_BUDGET equals the value derived again from the
//       code (the stage list from hitl_stages, the subcommand count from SUBCOMMANDS, the rebuild limit from the door,
//       the lens sets, the recovery budget).
//   V4: every fixed text that section 2 quotes is byte-equal to its source; the registry labels of section 1 are true.
//   V5: sections 1 to 10, the decimal rule, no dash character, the pending lines of plan 18, and a mutation control.
// The review file holds ids, fixed texts, state names and counts. It holds no calibrated value and no room text.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const PHASES = path.join(ROOT, '.planning/phases');
const PHASE_DIR = path.join(
  PHASES,
  fs.readdirSync(PHASES).find((d) => d.startsWith('400.2-persona-hats')) || '400.2-missing',
);
const REVIEW = path.join(PHASE_DIR, '400.2-OWNER-REVIEW.md');

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

const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(readText(rel));
const phaseText = (name) => fs.readFileSync(path.join(PHASE_DIR, name), 'utf8');
const sorted = (a) => [...a].sort();

const ops = require(path.join(ROOT, 'lib/core/persona-ops.cjs'));
const door = require(path.join(ROOT, 'scripts/persona-hats.cjs'));
const driver = require(path.join(ROOT, 'lib/lens-engine/source-lens-driver.cjs'));
const dispatcher = require(path.join(ROOT, 'lib/core/recovery/dispatcher.cjs'));

const DASHES = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
const SECTIONS = [
  '## 1. Job labels and statements',
  '## 2. Provisional tables and fixed texts',
  '## 3. Owner rulings applied',
  '## 4. Defaults taken',
  '## 5. Planner decisions for the owner',
  '## 6. Owner-gated steps still open',
  '## 7. Risks stated',
  '## 8. Input for Phase 400.1',
  '## 9. Advisor reach',
  '## 10. Cut list and reported items',
];
// The only decimal numbers the file may hold: the spike rule and the two phase names.
const ALLOWED_DECIMALS = ['0.5', '400.1', '400.2'];
const ORDERED_LISTS = ['lenses-white', 'lenses-black', 'lenses-yellow', 'lenses-green', 'stops.stages'];
const COMMAND_REL = 'commands/persona.md';
const FS3 = 'Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. No code checks it.';

// Planner decisions: id, the plan file that holds it, a needle that the plan file must contain.
const PLANNER_DECISIONS = [
  ['FS-2', '400.2-01-PLAN.md', 'FS-2. Web tools by step'],
  ['FS-9', '400.2-01-PLAN.md', 'FS-9. After-the-fact screen'],
  ['FS-10', '400.2-01-PLAN.md', 'FS-10. Yellow'],
  ['FS-4', '400.2-01-PLAN.md', 'FS-4. Reading keys'],
  ['decision_captured', '400.2-09-PLAN.md', 'decision_captured'],
  ['P-1-to-P-10', '400.2-05-PLAN.md', 'P-1. Every subcommand takes --room'],
  ['spike-formula', '400.2-15-PLAN.md', 'share(A, B) = size of the intersection'],
  ['spike-handle', '400.2-15-PLAN.md', 'The handle is "battery recycling"'],
  ['slice1-section-job-note', '400.2-14-PLAN.md', 'Hat-scoped research inside /mos:persona is wired by Phase 400.2'],
];
// Choices that DESIGN or RESEARCH mark DEFAULT CHOSEN and that no owner card ruled: id, phase file, needle.
const DESIGN_DEFAULTS = [
  ['hat-reads-prompt-contract', '400.2-RESEARCH.md', 'Q1 (what a hat may read)'],
  ['hat-governance-as-data', '400.2-DESIGN.md', 'Use of `HAT_GOVERNANCE` outside the debate'],
  ['persona-path-personas', '400.2-RESEARCH.md', 'Q3 (persona path)'],
  ['filing-target-section-personas', '400.2-DESIGN.md', 'Where a finding is filed (DEFAULT CHOSEN, R-3 Q4)'],
  ['digits-rule-no-year-exception', '400.2-DESIGN.md', 'DEFAULT CHOSEN: no year exception'],
  ['web-scope-green', '400.2-DESIGN.md', 'DEFAULT CHOSEN: `green`'],
  ['owner-direct-list', '400.2-DESIGN.md', 'They go into a new list `owner_direct`'],
  ['dist-rebuild-release-train', '400.2-DESIGN.md', 'DEFAULT CHOSEN: leave the dist rebuild to the release train'],
];
const REPORTED_PART8_COMMENTS = [
  'agents/persona-analyst.md:58',
  'lib/core/bono/cell-fanout.cjs:20-21,116-118,129-130',
  'lib/core/bono/persona-research.cjs:15-16',
  'commands/bono.md:103',
];

function frontmatterOf(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return m ? m[1] : '';
}
function hitlStageIds(text) {
  const fm = frontmatterOf(text);
  const re = /^ {2}- stage: "([^"]+)"/gm;
  const ids = [];
  let m;
  while ((m = re.exec(fm)) !== null) ids.push(m[1]);
  return ids;
}
function numberedItems(text, headingStart) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(headingStart));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    const m = lines[i].match(/^(\d+)\. /);
    if (m) out.push(Number(m[1]));
  }
  return out;
}
function withEnv(env, fn) {
  const keys = ['TAVILY_API_KEY', 'PATENTSVIEW_API_KEY', 'OPENALEX_API_KEY'];
  const saved = {};
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  try { return fn(); } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
// The lens plan of every researching hat under one environment: lenses that run, lenses that fall back to the host.
function lensPlans(env) {
  return withEnv(env, () => {
    const out = {};
    for (const hat of Object.keys(ops.HAT_RESEARCH_LENSES)) {
      const pre = driver.preflightLenses(ops.HAT_RESEARCH_LENSES[hat].slice(), { roomDir: ROOT });
      const hostKeys = Object.keys(door.HOST_LABELS);
      out[hat] = {
        available: pre.available.slice(),
        host: pre.unavailable.filter((u) => hostKeys.includes(u.lens) && u.provider === 'tavily' && u.reason === 'no_key').map((u) => u.lens),
      };
    }
    return out;
  });
}

// The budget derived again from the code. Each line names the fact of the code that it comes from.
function deriveBudget() {
  const hats = door.HATS.length; // six hats
  const researching = Object.keys(ops.HAT_RESEARCH_LENSES).length; // four hats search
  const readers = door.READ_HATS.length; // five readers (blue is read apart)
  const stages = hitlStageIds(readText(COMMAND_REL));
  const strings = door.MAX_STRINGS_PER_HAT;
  const retries = dispatcher.RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE;
  const keyless = lensPlans({});
  const allKeys = lensPlans({ TAVILY_API_KEY: 'x', PATENTSVIEW_API_KEY: 'x' });
  const sum = (plans, pick) => Object.values(plans).reduce((n, p) => n + pick(p), 0);
  const domain = driver._internal.DOMAIN_LENSES || {};
  const firstMax = readers + 1 + researching + hats;
  const doorMax = door.SUBCOMMANDS.length - 1; // every subcommand except compare
  const allKeyCalls = strings * sum(allKeys, (p) => p.available.length);
  const retryable = strings * sum(allKeys, (p) => p.available.filter((l) => !domain[l]).length);
  return {
    agent_runs: {
      produce_min: 0,
      produce_max: hats,
      handles_min: 0,
      handles_max: researching,
      readings: readers,
      blue: 1,
      steady_min: readers + 1,
      steady_max: readers + 1 + researching,
      first_run: firstMax,
      max_without_rebuild: firstMax,
      rebuilds_per_hat_max: door.REBUILD_LIMIT,
      max_with_rebuilds: firstMax + hats * door.REBUILD_LIMIT,
    },
    stops: { steady: stages.length - 1, first_run: stages.length, max: stages.length, stages },
    cards: { search_cards: researching },
    // write-persona and accept-persona are skipped by start when no persona is built or waits for acceptance.
    door_calls: { steady: doorMax - 2, max: doorMax, per_card_edit_round: 1, per_rebuild_round: 2 },
    research: {
      strings_per_hat_max: strings,
      provider_calls_keyless_max: strings * sum(keyless, (p) => p.available.length),
      provider_calls_all_keys_max: allKeyCalls,
      retries_per_call_max: retries,
      provider_calls_with_retries_max: allKeyCalls + retryable * retries,
      host_web_searches_max: strings * sum(keyless, (p) => p.host.length),
      host_web_searches_with_tavily_key: strings * sum(allKeys, (p) => p.host.length),
    },
    web_tool_calls_of_reading_hats: 'not bounded by code',
    quick: { agent_runs: 0, stops: 1, door_calls: 3, fetches: 0 },
  };
}
function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const name = prefix ? prefix + '.' + k : k;
    if (Array.isArray(v)) out.lists[name] = v.slice();
    else if (v && typeof v === 'object') flatten(v, name, out);
    else if (typeof v === 'number') out.counts[name] = v;
    else out.texts[name] = v;
  }
  return out;
}

function fixedTexts() {
  const cmd = readText(COMMAND_REL);
  const lineStarting = (prefix) => {
    const l = cmd.split('\n').find((x) => x.startsWith(prefix));
    assert.ok(l, 'command line not found: ' + prefix);
    return l;
  };
  const out = {
    DEEP_NOTICE: ops.DEEP_NOTICE,
    QUICK_NOTICE: ops.QUICK_NOTICE,
    DEEP_SURFACE_NOTE: ops.DEEP_SURFACE_NOTE,
    BLUE_FIXED_TEXT: lineStarting('Blue fixed text: ').slice('Blue fixed text: '.length),
    FS_3_RULE: FS3,
    TRIAGE_RULE: lineStarting('Decide which mode to recommend.'),
    STOP_3_OWN_SEARCH_NOTE: lineStarting('These cards cover the searches that the door sends.'),
    CARD_RESEND_SENTENCE: 'A failed provider may be asked again with the same string.',
    CARD_HOST_LIMIT_SENTENCE: 'Code cannot prove that the assistant searched exactly that string.',
  };
  for (const [lens, label] of Object.entries(door.HOST_LABELS)) out['HOST_LABEL_' + lens.toUpperCase()] = label;
  return out;
}

function compute() {
  const lists = {};
  const counts = {};
  const registry = readJson('data/command-registry.json').commands;
  const byName = new Map(registry.map((c) => [c.command, c]));
  const persona = byName.get('/mos:persona');
  const store = readJson('data/capability-job-statements.json');
  const rulings = readJson('data/job-label-rulings.json');
  const cmdText = readText(COMMAND_REL);
  const answers = phaseText('400.2-OWNER-ANSWERS.md');
  const design = phaseText('400.2-DESIGN.md');

  // 1. Jobs.
  lists['persona-jobs'] = sorted(persona.serves_jtbd);
  lists['owner-direct-jobs'] = sorted(rulings.owner_direct.map((p) => p.job + '|' + p.command));
  lists['store-status'] = sorted([...new Set(store.capabilities[0].jobs.map((j) => j.status))]);
  lists['open-taxonomy-disagreements'] = sorted(
    rulings.taxonomy_disagreements.filter((t) => t.status === 'open_owner_review').map((t) => t.job + '|' + t.command),
  );
  counts['statements-in-store'] = store.capabilities[0].jobs.length;
  counts['accepted-d07'] = rulings.accepted.length;

  // 2. Tables and states.
  lists['label-states'] = sorted([
    'job_sentence_status=' + persona.job_sentence.status,
    'cynefin_label_status=' + persona.cynefin_label_status,
    'hat_research_tables_status=' + ops.HAT_RESEARCH_TABLES_STATUS,
  ]);
  lists['researching-hats'] = sorted(Object.keys(ops.HAT_RESEARCH_LENSES));
  lists['hat-qualifiers'] = sorted(Object.entries(ops.HAT_RESEARCH_QUALIFIER).map(([h, q]) => h + '=' + q));
  for (const hat of Object.keys(ops.HAT_RESEARCH_LENSES)) lists['lenses-' + hat] = ops.HAT_RESEARCH_LENSES[hat].slice();
  counts['identity-stop-list'] = door.IDENTITY_STOP_LIST.length;
  counts['artifact-labels'] = Object.keys(door.ARTIFACT_LABELS).length;

  // The door and the command.
  lists['hitl-stages'] = sorted(hitlStageIds(cmdText));
  lists['door-subcommands'] = sorted(door.SUBCOMMANDS);

  // 3 and 4. Owner answers and defaults.
  const second = numberedItems(answers, '## Second card');
  const third = numberedItems(answers, '## Third card');
  lists['owner-answers-applied'] = sorted(second.map((n) => 'second-' + n));
  lists['owner-answers-later'] = sorted(third.map((n) => 'third-' + n).concat(/^## Fourth card/m.test(answers) ? ['fourth-1'] : []));
  const dm = /Items ([0-9, and]+) of the resolution take their recommended defaults/.exec(answers);
  lists['defaults-taken'] = dm ? sorted((dm[1].match(/\d+/g) || []).map((n) => 'resolution-' + n)) : [];

  // 5. Planner decisions: each must be in its plan file.
  lists['planner-decisions'] = sorted(
    PLANNER_DECISIONS.filter(([, file, needle]) => phaseText(file).includes(needle)).map(([id]) => id),
  );

  lists['design-defaults'] = sorted(
    DESIGN_DEFAULTS.filter(([id, file, needle]) => phaseText(file).includes(needle) && (id !== 'web-scope-green' || /web_scope: green/.test(frontmatterOf(cmdText))) && (id !== 'owner-direct-list' || rulings.owner_direct.length === 8)).map(([id]) => id),
  );

  // 7. Risks: K-1 to K-12 of DESIGN 16, K-10 removed (no sentinel), K-13 added.
  const kIds = [...design.matchAll(/^- (K-\d+)\./gm)].map((m) => m[1]).filter((k) => k !== 'K-10');
  lists['risks-stated'] = sorted(kIds.concat(['K-13']));

  // 10. Cut list of DESIGN 12 and the reported Part 8 comments.
  const cutLine = design.split('\n').find((l) => l.startsWith('Cut to keep it small, said plainly: '));
  assert.ok(cutLine, 'cut list sentence of DESIGN 12');
  lists['cut-list'] = cutLine.slice('Cut to keep it small, said plainly: '.length).replace(/\.$/, '').split('; ').map((s) => s.trim());
  lists['reported-part8-comments'] = REPORTED_PART8_COMMENTS.filter((r) => fs.existsSync(path.join(ROOT, r.split(':')[0])));

  // 9. Advisor reach: rank and band word of /mos:persona in each of the nine rows.
  const table = readJson('data/decision-advisor-table.json');
  lists['advisor-reach'] = sorted(
    persona.serves_jtbd.map((job) => {
      const row = table.rows[job + '|*|*'];
      if (!row) return job + ':none';
      const i = row.findIndex((e) => e.command === '/mos:persona');
      if (i < 0) return job + ':not-in-row';
      const v = row[i].calibrated;
      const band = v >= table.thresholds.strong ? 'strong' : v >= table.thresholds.possible ? 'possible' : 'weak';
      return job + ':' + (i + 1) + ':' + band;
    }),
  );

  // 6. The phase tests.
  lists['phase-tests'] = sorted(
    fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => /^test-4002-.*\.cjs$/.test(f)).map((f) => f.replace(/\.cjs$/, '')),
  );

  for (const [name, ids] of Object.entries(lists)) counts[name] = ids.length;
  return { lists, counts };
}

// recheck lines: the registry labels of the three Phase 400 commands, as the registry stores them.
function recheckComputed() {
  const registry = readJson('data/command-registry.json').commands;
  const out = {};
  for (const name of ['/mos:persona', '/mos:bono', '/mos:think-hats']) {
    const c = registry.find((x) => x.command === name);
    out[name] =
      'job_sentence_status ' + (c.job_sentence ? c.job_sentence.status : 'none') +
      '; fits_domains ' + ((c.fits_domains || []).join(', ') || 'none') +
      '; move_type ' + (c.move_type || 'none') +
      '; move_type_weak ' + String(c.move_type_weak === true);
  }
  return out;
}

function sectionOf(lines) {
  let cur = 0;
  return lines.map((l) => {
    const m = /^## (\d+)\./.exec(l);
    if (m) cur = Number(m[1]);
    return cur;
  });
}

function parseReview(text) {
  const lines = text.split(/\r?\n/);
  const secs = sectionOf(lines);
  const lists = {};
  const counts = {};
  const sectionCounts = {};
  const fixed = {};
  const recheck = {};
  const dup = [];
  lines.forEach((line, i) => {
    let m = line.match(/^- (ids|names|order) \(([a-z0-9._-]+)\): (.*)$/);
    if (m) {
      if (Object.prototype.hasOwnProperty.call(lists, m[2])) dup.push('list ' + m[2]);
      const body = m[3].trim();
      lists[m[2]] = body === 'none' ? [] : body.split(m[1] === 'names' ? '; ' : ', ').map((x) => x.trim());
      return;
    }
    m = line.match(/^- count \(([a-z0-9._-]+)\): (\d+)\s*$/);
    if (m) {
      if (Object.prototype.hasOwnProperty.call(counts, m[1])) dup.push('count ' + m[1]);
      counts[m[1]] = Number(m[2]);
      sectionCounts[m[1]] = secs[i];
      return;
    }
    m = line.match(/^- fixed \(([A-Z0-9_]+)\): (.*)$/);
    if (m) {
      if (Object.prototype.hasOwnProperty.call(fixed, m[1])) dup.push('fixed ' + m[1]);
      fixed[m[1]] = m[2];
      return;
    }
    m = line.match(/^- recheck \((\/mos:[a-z-]+)\): (.*)$/);
    if (m) {
      if (Object.prototype.hasOwnProperty.call(recheck, m[1])) dup.push('recheck ' + m[1]);
      recheck[m[1]] = m[2];
    }
  });
  // The JSON block of the artifact labels, after the heading "### ARTIFACT_LABELS".
  let labels = null;
  const h = lines.findIndex((l) => l === '### ARTIFACT_LABELS');
  if (h >= 0) {
    const open = lines.findIndex((l, i) => i > h && l.startsWith('```'));
    const close = lines.findIndex((l, i) => i > open && l.startsWith('```'));
    if (open > h && close > open) {
      try { labels = JSON.parse(lines.slice(open + 1, close).join('\n')); } catch (e) { labels = null; }
    }
  }
  return { lists, counts, sectionCounts, fixed, recheck, labels, dup };
}

const sameList = (name, a, b) => (ORDERED_LISTS.includes(name) ? JSON.stringify(a) === JSON.stringify(b) : JSON.stringify(sorted(a)) === JSON.stringify(sorted(b)));

// The compare functions of V1, V2, V4 and V5 (the mutation control). Each returns a list of mismatch strings.
function compareLists(parsed, computed, budgetLists) {
  const errs = parsed.dup.filter((d) => d.startsWith('list')).map((d) => 'duplicate ' + d);
  const want = Object.assign({}, computed.lists, budgetLists);
  for (const [name, expect] of Object.entries(want)) {
    const got = parsed.lists[name];
    if (!got) { errs.push('missing list ' + name); continue; }
    if (new Set(got).size !== got.length) errs.push('list ' + name + ' repeats an id');
    if (!sameList(name, got, expect)) {
      const extra = got.filter((x) => !expect.includes(x));
      const miss = expect.filter((x) => !got.includes(x));
      errs.push('list ' + name + ' differs (missing: ' + miss.join(', ') + '; extra: ' + extra.join(', ') + ')');
    }
  }
  for (const name of Object.keys(parsed.lists)) if (!want[name]) errs.push('unknown list ' + name);
  return errs;
}
function compareCounts(parsed, computed) {
  const errs = parsed.dup.filter((d) => d.startsWith('count')).map((d) => 'duplicate ' + d);
  const own = Object.keys(parsed.counts).filter((n) => !n.includes('.'));
  for (const [name, want] of Object.entries(computed.counts)) {
    if (!Object.prototype.hasOwnProperty.call(parsed.counts, name)) errs.push('missing count ' + name);
    else if (parsed.counts[name] !== want) errs.push('count ' + name + ' is ' + parsed.counts[name] + ', computed ' + want);
  }
  for (const name of own) if (!Object.prototype.hasOwnProperty.call(computed.counts, name)) errs.push('unknown count ' + name);
  return errs;
}
function compareBudgetCounts(parsed, flat) {
  const errs = [];
  for (const [name, want] of Object.entries(flat.counts)) {
    if (!Object.prototype.hasOwnProperty.call(parsed.counts, name)) errs.push('missing budget count ' + name);
    else if (parsed.counts[name] !== want) errs.push('budget count ' + name + ' is ' + parsed.counts[name] + ', table ' + want);
    else if (parsed.sectionCounts[name] !== 8) errs.push('budget count ' + name + ' is not in section 8');
  }
  for (const name of Object.keys(parsed.counts)) if (name.includes('.') && !Object.prototype.hasOwnProperty.call(flat.counts, name)) errs.push('unknown budget count ' + name);
  return errs;
}
function compareFixed(parsed, fixed) {
  const errs = parsed.dup.filter((d) => d.startsWith('fixed')).map((d) => 'duplicate ' + d);
  for (const [name, text] of Object.entries(fixed)) {
    if (!Object.prototype.hasOwnProperty.call(parsed.fixed, name)) errs.push('missing fixed text ' + name);
    else if (parsed.fixed[name] !== text) errs.push('fixed text ' + name + ' differs from its source');
  }
  for (const name of Object.keys(parsed.fixed)) if (!Object.prototype.hasOwnProperty.call(fixed, name)) errs.push('unknown fixed text ' + name);
  if (!parsed.labels) errs.push('ARTIFACT_LABELS block missing or not JSON');
  else if (JSON.stringify(parsed.labels) !== JSON.stringify(door.ARTIFACT_LABELS)) errs.push('ARTIFACT_LABELS block differs from the door');
  return errs;
}
function compareRecheck(parsed, expect) {
  const errs = parsed.dup.filter((d) => d.startsWith('recheck')).map((d) => 'duplicate ' + d);
  for (const [name, text] of Object.entries(expect)) {
    if (!Object.prototype.hasOwnProperty.call(parsed.recheck, name)) errs.push('missing recheck ' + name);
    else if (parsed.recheck[name] !== text) errs.push('recheck ' + name + ' is "' + parsed.recheck[name] + '", registry "' + text + '"');
  }
  for (const name of Object.keys(parsed.recheck)) if (!Object.prototype.hasOwnProperty.call(expect, name)) errs.push('unknown recheck ' + name);
  return errs;
}

const exists = fs.existsSync(REVIEW);
const reviewText = exists ? fs.readFileSync(REVIEW, 'utf8') : '';
const computed = compute();
const parsed = parseReview(reviewText);
const budget = door.DEEP_RUN_BUDGET;
const budgetFlat = budget ? flatten(budget, '', { lists: {}, counts: {}, texts: {} }) : { lists: {}, counts: {}, texts: {} };

check('V1 every id list of the review file equals the computed set', () => {
  assert.ok(exists, 'missing ' + path.relative(ROOT, REVIEW));
  const errs = compareLists(parsed, computed, budgetFlat.lists);
  assert.deepEqual(errs, [], errs.join(' | '));
  assert.equal(computed.lists['planner-decisions'].length, PLANNER_DECISIONS.length, 'every planner decision is in its plan file');
  assert.equal(computed.lists['reported-part8-comments'].length, REPORTED_PART8_COMMENTS.length, 'every reported file exists');
  assert.equal(computed.lists['design-defaults'].length, DESIGN_DEFAULTS.length, 'every design default is in its phase file');
});

check('V2 every count line equals the computed count, and the pinned phase counts hold', () => {
  assert.ok(exists, 'missing review file');
  const pinned = { 'persona-jobs': 9, 'owner-direct-jobs': 8, 'open-taxonomy-disagreements': 4, 'door-subcommands': 10, 'researching-hats': 4, 'hat-qualifiers': 4, 'statements-in-store': 9, 'accepted-d07': 26, 'defaults-taken': 5, 'owner-answers-applied': 4, 'planner-decisions': 9, 'hitl-stages': 4 };
  for (const [k, v] of Object.entries(pinned)) assert.equal(computed.counts[k], v, 'computed ' + k);
  const errs = compareCounts(parsed, computed);
  assert.deepEqual(errs, [], errs.join(' | '));
});

check('V3 section 8 equals DEEP_RUN_BUDGET, and DEEP_RUN_BUDGET equals the value derived from the code', () => {
  assert.ok(exists, 'missing review file');
  assert.ok(budget, 'the door exports DEEP_RUN_BUDGET');
  assert.ok(Object.isFrozen(budget) && Object.isFrozen(budget.agent_runs) && Object.isFrozen(budget.stops.stages), 'the table is frozen');
  assert.deepEqual(JSON.parse(JSON.stringify(budget)), deriveBudget());
  assert.deepEqual(budget.stops.stages, hitlStageIds(readText(COMMAND_REL)), 'stages equal hitl_stages in order');
  assert.equal(parsed.counts['door-subcommands'], door.SUBCOMMANDS.length);
  assert.equal(door.SUBCOMMANDS.length, 10);
  const errs = compareBudgetCounts(parsed, budgetFlat);
  assert.deepEqual(errs, [], errs.join(' | '));
  const s8 = reviewText.split('\n## 8.')[1].split('\n## 9.')[0];
  assert.ok(s8.includes(budget.web_tool_calls_of_reading_hats), 'section 8 says that web tool calls of reading hats are ' + budget.web_tool_calls_of_reading_hats);
});

check('V4 fixed texts are byte-equal to their sources, and the registry labels of section 1 are true', () => {
  assert.ok(exists, 'missing review file');
  const cmd = readText(COMMAND_REL);
  assert.ok(cmd.split(FS3).length - 1 >= 4, 'FS-3 is in the four dispatch contracts');
  assert.equal(ops.HAT_DISCIPLINE.blue, fixedTexts().BLUE_FIXED_TEXT, 'the Blue fixed text of the command equals the Blue discipline');
  const errs = compareFixed(parsed, fixedTexts()).concat(compareRecheck(parsed, recheckComputed()));
  assert.deepEqual(errs, [], errs.join(' | '));
});

check('V5 sections 1 to 10, decimals, dashes, the plan 18 pending lines, and a mutation control', () => {
  assert.ok(exists, 'missing review file');
  const lines = reviewText.split(/\r?\n/);
  assert.deepEqual(lines.filter((l) => l.startsWith('## ')), SECTIONS);
  assert.ok(lines[0].startsWith('# '), 'title line');
  assert.ok(reviewText.includes('tests/test-4002-review-lists.cjs'), 'the header names the drift test');
  assert.ok(/Nothing in this file is a ruling/.test(reviewText), 'the header says it holds no ruling');
  const bad = [];
  lines.forEach((l, i) => {
    for (const d of l.match(/\d+\.\d+/g) || []) if (!ALLOWED_DECIMALS.includes(d)) bad.push(i + 1 + ': ' + d);
    if (DASHES.test(l)) bad.push(i + 1 + ': dash');
  });
  assert.deepEqual(bad, []);
  // Plan 18 lines stay pending until plan 18 updates them.
  assert.ok(/^- plan 18 recorded advisor run: (pending|done|deferred)/m.test(reviewText), 'plan 18 advisor run line');
  assert.ok(/^- plan 18 irreversibility re-score: (pending|done|deferred)/m.test(reviewText), 'plan 18 re-score line');
  // Mutation control: one id removed, one count changed, one fixed text changed, one label changed.
  const victim = 'owner-direct-jobs';
  const mutated = lines
    .map((l) => (l.startsWith('- ids (' + victim + '): ') ? l.replace(/, [^,]+$/, '') : l))
    .map((l) => (l.startsWith('- count (door-subcommands): ') ? '- count (door-subcommands): 99' : l))
    .map((l) => (l.startsWith('- fixed (QUICK_NOTICE): ') ? l + ' x' : l))
    .join('\n');
  assert.notEqual(mutated, reviewText, 'the mutation changed nothing');
  const p2 = parseReview(mutated);
  const le = compareLists(p2, computed, budgetFlat.lists);
  const ce = compareCounts(p2, computed);
  const fe = compareFixed(p2, fixedTexts());
  assert.ok(le.some((e) => e.startsWith('list ' + victim + ' differs (missing: ')), le.join(' | '));
  assert.ok(ce.some((e) => e.startsWith('count door-subcommands is 99')), ce.join(' | '));
  assert.ok(fe.some((e) => e.startsWith('fixed text QUICK_NOTICE differs')), fe.join(' | '));
  const p3 = parseReview(reviewText.replace('"none": "none"', '"none": "nothing"'));
  assert.ok(compareFixed(p3, fixedTexts()).some((e) => e.startsWith('ARTIFACT_LABELS block differs')), 'a changed label is reported');
});

check('V6 IN-12: the first loop of tests/run-all-4002.sh runs every phase test and does not stop at the first failure', () => {
  const runner = fs.readFileSync(path.join(__dirname, 'run-all-4002.sh'), 'utf8');
  const loop1 = runner.slice(runner.indexOf('# Loop 1'), runner.indexOf('# Loop 2'));
  assert.ok(loop1.includes('FAIL=1'), 'loop 1 records a failure');
  assert.equal(/\bbreak\b/.test(loop1), false, 'loop 1 holds no break');
  assert.ok(/exit \$FAIL\s*$/.test(runner), 'the runner exits with the failure flag');
});

console.log('test-4002-review-lists: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
