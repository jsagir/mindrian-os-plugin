#!/usr/bin/env node
'use strict';
/*
 * evals/selection/score.cjs -- the deterministic scorer of the selection measure (Phase 395-09).
 *
 * WHAT IT MEASURES. For each labelled case in cases.json it builds a synthetic fixture room, runs the real selector
 * (lib/core/feyminto/next-move.cjs nextMoveForSection) and compares the primary with the labels of the case.
 * The labels say which commands are a right first move, which are acceptable and which are wrong. The unit tests of
 * the phase check that the selector follows its own rules; this file checks the answer against labels that were
 * written outside the selector.
 *
 * WHAT IS BUILT OUTSIDE THE SELECTOR.
 *   options  every command of data/command-registry.json that capability.cjs marks runnable on the case surface, plus
 *            the option "none of these". The selector shortlist (1 primary, at most 2 alternatives) is never the
 *            option list.
 *   pool     the commands that the selector can order for the case: the section contract names, the navigator table
 *            names, the ledger candidates for the job the selector used, and the Theo face commands when Theo was
 *            asked. The scorer reads these from the same public functions that the selector calls, because the
 *            selector does not return its pool. Check: the primary and the alternatives must be in this pool; a case
 *            where they are not is marked pool_rebuild_mismatch and the limit split of that case is not reliable.
 *
 * NO MODEL, NO NETWORK, NO WRITE INTO A REAL ROOM. The fixture room is born with tests/helpers/isolated-home-36925.cjs
 * under a temporary home. Output goes to stdout; with --out-dir it also writes selection-score.json and
 * selection-score.md into that directory. The output holds no time and no temporary path, so two runs on one tree are
 * byte-identical.
 *
 * Usage:
 *   node evals/selection/score.cjs [--out-dir <dir>] [--head <commit id>] [--cases <file>] [--json]
 * Exit code: 0 when the run finished (also when the pass bar is not reached; this file measures, it is not a gate),
 * 1 when a case could not be scored.
 *
 * Hyphens only in this file.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CASES_PATH = path.join(__dirname, 'cases.json');
const NONE = 'none of these';
const SURFACES = ['mcp', 'cli'];

// The pass bar. It was written before the first run of this scorer (see README.md, "Pass bar").
const BAR = Object.freeze({
  right_min: 0.70, // B1: primary in the right set, share of the cases that have a right command
  wrong_max: 0, // B2: primary in the wrong set, count over all cases
  right_or_acceptable_min: 0.85, // B3: primary in the right or acceptable set, share of the cases that have a right command
  none_named_max: 0, // B4: "none of these" cases where the selector names a primary outside the acceptable set
});

const strip = (n) => String(n).replace(/^\/mos:/, '');
const arr = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const names = (list) => arr(list).map((x) => strip(x && x.command)).filter(Boolean);

function loadCases(file) {
  return JSON.parse(fs.readFileSync(file || CASES_PATH, 'utf8'));
}

function registryCommands() {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8'));
  return arr(doc.commands).filter((c) => c && typeof c.command === 'string').map((c) => Object.assign({}, c, { name: strip(c.command) }));
}

function capability() {
  return require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs')).capabilityFor;
}

/** optionsFor(surface) -> the option list a judge or this scorer sees: every runnable command, sorted, plus NONE. */
function optionsFor(surface) {
  const cap = capability();
  const out = registryCommands().filter((c) => {
    const k = cap(c.name, { kind: 'command' });
    return !!k && k.known !== false && k[surface] === 'runnable';
  }).map((c) => c.name).sort();
  out.push(NONE);
  return out;
}

function mintoText(holds) {
  const ce = Number(holds && holds.open_counterevidence) || 0;
  const as = Number(holds && holds.open_assumptions) || 0;
  const L = ['---', 'governing_thought: "Synthetic fixture text for the selection measure"', 'governing_thought_placeholder: false', '---', '', '## Counterevidence'];
  if (ce === 0) L.push('None recorded.');
  for (let i = 1; i <= ce; i++) L.push('- Synthetic counterevidence line ' + i);
  L.push('', '## Assumptions');
  if (as === 0) L.push('None recorded.');
  for (let i = 1; i <= as; i++) L.push('- Synthetic assumption ' + i + ' (validity: unknown)');
  L.push('');
  return L.join('\n');
}

/** buildFixture(template, roomsHome, c) -> the room directory of one case: a copy of the born room plus the case state. */
function buildFixture(template, roomsHome, c) {
  const roomDir = path.join(roomsHome, 'case-' + c.id);
  fs.cpSync(template, roomDir, { recursive: true });
  const s = c.state;
  const sectionDir = path.join(roomDir, s.section);
  if (s.section_kind === 'custom') {
    fs.mkdirSync(sectionDir, { recursive: true });
    // A nest made by hand: the selector reads the job id from the CONTEXT.md frontmatter (next-move.cjs readJob).
    fs.writeFileSync(path.join(sectionDir, 'CONTEXT.md'), '---\nicm_layer: 2\njob_id: "' + s.section_job + '"\n---\nSynthetic nest for the selection measure.\n');
  }
  if (!fs.existsSync(sectionDir)) throw new Error(c.id + ': the born room has no section ' + s.section);
  const h = isObj(s.holds) ? s.holds : {};
  if ((Number(h.open_counterevidence) || 0) > 0 || (Number(h.open_assumptions) || 0) > 0) {
    fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), mintoText(h));
  }
  if (s.goal_job) {
    const jt = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
    if (!jt.setGoal(roomDir, { jtbd: s.goal_job })) throw new Error(c.id + ': the goal job ' + s.goal_job + ' was not stored');
  }
  return { roomDir, sectionDir };
}

/** rebuildPool(nest, jobUsed) -> the names the selector can order, from the public functions it calls itself. */
function rebuildPool(nest, jobUsed) {
  const pool = new Set();
  let sources = null;
  try { sources = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'command-sources.cjs')).sourcesForSection(nest.section); } catch (_e) { sources = null; }
  if (sources && isObj(sources.contract)) arr(sources.contract.names).forEach((n) => pool.add(strip(n)));
  if (sources && isObj(sources.navigator_table)) arr(sources.navigator_table.names).forEach((n) => pool.add(strip(n)));
  if (jobUsed) {
    let led = null;
    try { led = require(path.join(ROOT, 'lib', 'core', 'section-ruling-candidates.cjs')).buildLedgerCandidates({ jobId: jobUsed }); } catch (_e) { led = null; }
    arr(led).forEach((entry) => arr(entry && entry.items).forEach((i) => { if (i && typeof i.id === 'string') pool.add(strip(i.id)); }));
  }
  if (nest.face && nest.face.keyed === true && nest.face.asked === true) arr(nest.face.commands).forEach((x) => { if (x && x.name) pool.add(strip(x.name)); });
  const cap = capability();
  return Array.from(pool).filter((n) => { const k = cap(n, { kind: 'command' }); return !!k && k.known !== false; }).sort();
}

function scoreCase(c, fx, options) {
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const cap = capability();
  const nest = NM.gatherNest({ roomDir: fx.roomDir, sectionDir: fx.sectionDir });
  const h = isObj(c.state.holds) ? c.state.holds : {};
  const fixtureOk = (nest.job.id || null) === (c.state.section_job || null)
    && nest.need.counterevidence === (Number(h.open_counterevidence) || 0)
    && nest.need.assumptions === (Number(h.open_assumptions) || 0);
  const move = NM.nextMoveForSection({ roomDir: fx.roomDir, sectionDir: fx.sectionDir, surface: c.surface });
  // The job the selector ranked by. The base before Phase 395 returns no `job` key and uses the section job.
  const jobUsed = Object.prototype.hasOwnProperty.call(move, 'job') ? (move.job && move.job.id ? move.job.id : null) : (nest.job.id || null);
  const primary = move.primary && move.primary.command ? strip(move.primary.command) : null;
  const alternatives = arr(move.alternatives).map((a) => ({ command: strip(a.command), instruction_only: a.instruction_only === true }));
  const pool = rebuildPool(nest, jobUsed);
  const runnable = (n) => { const k = cap(n, { kind: 'command' }); return !!k && k.known !== false && k[c.surface] === 'runnable'; };
  const poolRunnable = pool.filter(runnable);
  const shortlist = (primary ? [primary] : []).concat(alternatives.map((a) => a.command));
  const mismatch = shortlist.filter((n) => pool.indexOf(n) === -1);

  const right = names(c.expected.right);
  const acceptable = names(c.expected.acceptable);
  const wrong = names(c.expected.wrong);
  const nrr = names(c.expected.not_runnable_right);
  const isNone = c.expected.none_of_these === true;

  let outcome;
  if (primary === null) outcome = isNone ? 'none_correct' : 'no_primary';
  else if (right.indexOf(primary) !== -1) outcome = 'right';
  else if (acceptable.indexOf(primary) !== -1) outcome = isNone ? 'none_named_acceptable' : 'acceptable';
  else if (wrong.indexOf(primary) !== -1) outcome = isNone ? 'none_named_wrong' : 'wrong';
  else outcome = isNone ? 'none_named_other' : 'other';

  const rightInPool = right.filter((n) => poolRunnable.indexOf(n) !== -1);
  let limit = null;
  if (!isNone && outcome !== 'right') limit = rightInPool.length === 0 ? 'pool' : 'order';
  const top3 = shortlist.filter(runnable);

  return {
    id: c.id,
    job_id: c.job_id,
    surface: c.surface,
    label_confidence: c.label_confidence || 'medium',
    section: c.state.section,
    goal_job: c.state.goal_job || null,
    none_of_these: isNone,
    job_used: jobUsed,
    job_used_is_case_job: jobUsed === c.job_id,
    primary,
    alternatives,
    outcome,
    limit,
    right,
    right_in_pool: rightInPool,
    right_in_shortlist: right.filter((n) => top3.indexOf(n) !== -1),
    not_runnable_right_named: nrr.filter((n) => shortlist.indexOf(n) !== -1),
    primary_is_option: primary === null ? null : options.indexOf(primary) !== -1,
    pool_size: pool.length,
    pool_runnable: poolRunnable.length,
    pool_rebuild_mismatch: mismatch,
    fixture_ok: fixtureOk,
  };
}

function summarize(rows) {
  const count = (fn) => rows.filter(fn).length;
  const withRight = rows.filter((r) => !r.none_of_these);
  const none = rows.filter((r) => r.none_of_these);
  const n = withRight.length;
  const share = (k) => (n === 0 ? null : Math.round((k / n) * 1000) / 1000);
  const right = withRight.filter((r) => r.outcome === 'right').length;
  const acceptable = withRight.filter((r) => r.outcome === 'acceptable').length;
  const wrongAll = count((r) => r.outcome === 'wrong' || r.outcome === 'none_named_wrong');
  const noneNamedBad = none.filter((r) => r.outcome === 'none_named_wrong' || r.outcome === 'none_named_other').length;
  const s = {
    cases: rows.length,
    cases_with_a_right_command: n,
    cases_none_of_these: none.length,
    primary_right: right,
    primary_acceptable: acceptable,
    primary_right_or_acceptable: right + acceptable,
    primary_wrong: withRight.filter((r) => r.outcome === 'wrong').length,
    primary_other: withRight.filter((r) => r.outcome === 'other').length,
    no_primary: withRight.filter((r) => r.outcome === 'no_primary').length,
    right_share: share(right),
    right_or_acceptable_share: share(right + acceptable),
    limit_pool: withRight.filter((r) => r.limit === 'pool').length,
    limit_order: withRight.filter((r) => r.limit === 'order').length,
    right_in_shortlist_not_first: withRight.filter((r) => r.outcome !== 'right' && r.right_in_shortlist.length > 0).length,
    none_correct: none.filter((r) => r.outcome === 'none_correct').length,
    none_named_acceptable: none.filter((r) => r.outcome === 'none_named_acceptable').length,
    none_named_wrong: none.filter((r) => r.outcome === 'none_named_wrong').length,
    none_named_other: none.filter((r) => r.outcome === 'none_named_other').length,
    wrong_all_cases: wrongAll,
    job_used_is_not_case_job: count((r) => !r.job_used_is_case_job),
    pool_rebuild_mismatch_cases: count((r) => r.pool_rebuild_mismatch.length > 0),
    fixture_mismatch_cases: count((r) => !r.fixture_ok),
  };
  const bar = {
    B1_right_share: { min: BAR.right_min, value: s.right_share, pass: s.right_share !== null && s.right_share >= BAR.right_min },
    B2_wrong_count: { max: BAR.wrong_max, value: wrongAll, pass: wrongAll <= BAR.wrong_max },
    B3_right_or_acceptable_share: { min: BAR.right_or_acceptable_min, value: s.right_or_acceptable_share, pass: s.right_or_acceptable_share !== null && s.right_or_acceptable_share >= BAR.right_or_acceptable_min },
    B4_none_named: { max: BAR.none_named_max, value: noneNamedBad, pass: noneNamedBad <= BAR.none_named_max },
  };
  bar.pass = bar.B1_right_share.pass && bar.B2_wrong_count.pass && bar.B3_right_or_acceptable_share.pass && bar.B4_none_named.pass;
  return { summary: s, bar };
}

function byJob(rows) {
  const out = {};
  rows.forEach((r) => {
    if (!out[r.job_id]) out[r.job_id] = { cases: 0, right: 0, acceptable: 0, wrong: 0, other: 0, no_primary: 0, none_correct: 0, none_named: 0 };
    const b = out[r.job_id];
    b.cases += 1;
    if (r.outcome === 'right') b.right += 1;
    else if (r.outcome === 'acceptable') b.acceptable += 1;
    else if (r.outcome === 'wrong') b.wrong += 1;
    else if (r.outcome === 'other') b.other += 1;
    else if (r.outcome === 'no_primary') b.no_primary += 1;
    else if (r.outcome === 'none_correct') b.none_correct += 1;
    else b.none_named += 1;
  });
  const sorted = {};
  Object.keys(out).sort().forEach((k) => { sorted[k] = out[k]; });
  return sorted;
}

/**
 * runScore({ casesFile?, head? }) -> the result object. Births one fixture room under an isolated temporary home and
 * copies it once for each case, so the cases do not share state.
 */
function runScore(opts) {
  const o = isObj(opts) ? opts : {};
  const doc = loadCases(o.casesFile);
  const H = require(path.join(ROOT, 'tests', 'helpers', 'isolated-home-36925.cjs'));
  const iso = H.mkIsolatedHome('395measure');
  // The birth prints progress lines; keep stdout for the result only.
  const realWrite = process.stdout.write.bind(process.stdout);
  let born;
  process.stdout.write = (chunk, enc, cb) => process.stderr.write(chunk, enc, cb);
  try {
    born = H.birthFixtureRoom({ iso, slug: 'selection-measure-template', vname: 'Synthetic Venture', ventureText: 'A synthetic venture for the selection measure' });
  } finally {
    process.stdout.write = realWrite;
  }
  if (!born || born.ok !== true) throw new Error('fixture birth failed');
  const template = fs.realpathSync(born.roomDir);
  const roomsHome = path.dirname(template);
  const options = {};
  SURFACES.forEach((s) => { options[s] = optionsFor(s); });
  const rows = arr(doc.cases).map((c) => scoreCase(c, buildFixture(template, roomsHome, c), options[c.surface]));
  iso.cleanup();
  const sm = summarize(rows);
  const confident = summarize(rows.filter((r) => r.label_confidence !== 'low'));
  return {
    schema: 'mos.selection-score/1',
    head: typeof o.head === 'string' && o.head ? o.head : null,
    cases_schema: doc.schema || null,
    label_origin: doc.label_origin || null,
    owner_reviewed: doc.owner_reviewed === true,
    options: { mcp: options.mcp.length, cli: options.cli.length, includes_none_of_these: true },
    bar: sm.bar,
    summary: sm.summary,
    summary_without_low_confidence_labels: { cases: confident.summary.cases, right_share: confident.summary.right_share, right_or_acceptable_share: confident.summary.right_or_acceptable_share, wrong_all_cases: confident.summary.wrong_all_cases, bar_pass: confident.bar.pass },
    by_job: byJob(rows),
    cases: rows,
  };
}

function pct(v) { return v === null ? 'n/a' : (Math.round(v * 1000) / 10) + ' percent'; }

function toMarkdown(res) {
  const s = res.summary;
  const b = res.bar;
  const L = [];
  L.push('# Selection measure: scorer output');
  L.push('');
  L.push('Tree measured: ' + (res.head || 'not given (pass --head)') + '. Labels: written by a model, owner review: ' + (res.owner_reviewed ? 'yes' : 'no') + '.');
  L.push('Options built outside the selector: ' + (res.options.mcp - 1) + ' runnable commands on mcp, ' + (res.options.cli - 1) + ' on cli, plus "none of these".');
  L.push('');
  L.push('## Pass bar: ' + (b.pass ? 'REACHED' : 'NOT REACHED'));
  L.push('');
  L.push('| Bar | Limit | Measured | Result |');
  L.push('|---|---|---|---|');
  L.push('| B1 primary in the right set | at least ' + pct(b.B1_right_share.min) + ' | ' + s.primary_right + ' of ' + s.cases_with_a_right_command + ' (' + pct(b.B1_right_share.value) + ') | ' + (b.B1_right_share.pass ? 'pass' : 'fail') + ' |');
  L.push('| B2 primary in the wrong set | at most ' + b.B2_wrong_count.max + ' | ' + b.B2_wrong_count.value + ' of ' + s.cases + ' | ' + (b.B2_wrong_count.pass ? 'pass' : 'fail') + ' |');
  L.push('| B3 primary right or acceptable | at least ' + pct(b.B3_right_or_acceptable_share.min) + ' | ' + s.primary_right_or_acceptable + ' of ' + s.cases_with_a_right_command + ' (' + pct(b.B3_right_or_acceptable_share.value) + ') | ' + (b.B3_right_or_acceptable_share.pass ? 'pass' : 'fail') + ' |');
  L.push('| B4 "none of these" cases with a named primary outside the acceptable set | at most ' + b.B4_none_named.max + ' | ' + b.B4_none_named.value + ' of ' + s.cases_none_of_these + ' | ' + (b.B4_none_named.pass ? 'pass' : 'fail') + ' |');
  L.push('');
  L.push('## Counts');
  L.push('');
  L.push('| Measure | Count |');
  L.push('|---|---|');
  [
    ['Cases', s.cases],
    ['Cases with a right command', s.cases_with_a_right_command],
    ['Primary in the right set', s.primary_right],
    ['Primary in the acceptable set', s.primary_acceptable],
    ['Primary in the wrong set', s.primary_wrong],
    ['Primary in no list (other)', s.primary_other],
    ['No primary where a right command exists', s.no_primary],
    ['Not right, no right command in the pool (pool limit)', s.limit_pool],
    ['Not right, a right command in the pool (order limit)', s.limit_order],
    ['Not right, a right command among the alternatives', s.right_in_shortlist_not_first],
    ['"None of these" cases', s.cases_none_of_these],
    ['"None of these": the selector names no primary', s.none_correct],
    ['"None of these": the selector names an acceptable primary', s.none_named_acceptable],
    ['"None of these": the selector names a wrong primary', s.none_named_wrong],
    ['"None of these": the selector names another primary', s.none_named_other],
    ['Cases where the selector ranked by another job than the case job', s.job_used_is_not_case_job],
    ['Cases where the pool check failed', s.pool_rebuild_mismatch_cases],
    ['Cases where the fixture did not match the case', s.fixture_mismatch_cases],
  ].forEach((r) => L.push('| ' + r[0] + ' | ' + r[1] + ' |'));
  L.push('');
  const c = res.summary_without_low_confidence_labels;
  L.push('Without the cases whose label confidence is low (' + c.cases + ' cases): right ' + pct(c.right_share) + ', right or acceptable ' + pct(c.right_or_acceptable_share) + ', wrong ' + c.wrong_all_cases + ', bar ' + (c.bar_pass ? 'reached' : 'not reached') + '.');
  L.push('');
  L.push('## By job');
  L.push('');
  L.push('| Job | Cases | Right | Acceptable | Wrong | Other | No primary | None, correct | None, named |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  Object.keys(res.by_job).forEach((k) => { const j = res.by_job[k]; L.push('| ' + [k, j.cases, j.right, j.acceptable, j.wrong, j.other, j.no_primary, j.none_correct, j.none_named].join(' | ') + ' |'); });
  L.push('');
  L.push('## By case');
  L.push('');
  L.push('| Case | Job | Surface | Section | Goal | Job used | Primary | Outcome | Limit | Right commands | Right in pool |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  res.cases.forEach((r) => {
    L.push('| ' + [r.id, r.job_id, r.surface, r.section, r.goal_job || 'none', r.job_used || 'none', r.primary || 'none', r.outcome, r.limit || '', r.none_of_these ? '(none of these)' : r.right.join(', '), r.right_in_pool.join(', ')].join(' | ') + ' |');
  });
  L.push('');
  return L.join('\n');
}

function main(argv) {
  const args = argv.slice(2);
  const val = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
  let res;
  try {
    res = runScore({ casesFile: val('--cases'), head: val('--head') });
  } catch (e) {
    process.stderr.write('score: ' + (e && e.stack ? e.stack : String(e)) + '\n');
    return 1;
  }
  const json = JSON.stringify(res, null, 2) + '\n';
  const md = toMarkdown(res);
  const outDir = val('--out-dir');
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'selection-score.json'), json);
    fs.writeFileSync(path.join(outDir, 'selection-score.md'), md);
  }
  process.stdout.write(args.indexOf('--json') !== -1 ? json : md);
  const bad = res.summary.fixture_mismatch_cases;
  if (bad > 0) { process.stderr.write('score: ' + bad + ' case(s) with a fixture that did not match the case\n'); return 1; }
  return 0;
}

module.exports = { runScore, toMarkdown, optionsFor, loadCases, BAR, NONE, CASES_PATH };

// The exit code is set and the process ends by itself. A call of process.exit here can cut a long output on a pipe.
if (require.main === module) process.exitCode = main(process.argv);
