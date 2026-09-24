#!/usr/bin/env node
'use strict';
// scripts/score-moonshots-359.cjs -- Phase 359 Plan 04 Task 2 (N-3, FORK359-09).
//
// DEV TIME ONLY. Navigator-invoked from a developer shell. Never a hook,
// never CI, never required from lib/ or hooks/ (the tripwire in
// tests/test-353-tripwires.cjs HOOKS_BANNED_LEDGER_SCRIPTS bans this
// file's own name from hooks/).
//
// Part 8 (Graph Boundary): sends only the 359 synthetic-359 fixture text
// and authored forward-scenario text to Jev, through the shared
// scripts/jev-devtime-client.cjs fork359_moonshot egress profile.
// selectRows refuses any other input BEFORE any request body is built --
// no non-authored file is ever opened by this script, and context always
// comes from authored text, never from Larry's full reply.
//
// Two independent Score questions -- relevant_to_context, radical_departure
// -- score each declared moonshot label, each with the full written policy
// stated in the question (state the policy, never let it be inferred).
// Scores are dev-time evidence only and are NEVER auto-applied to any
// fixture (N-3).
//
// Keyless: every row degrades to "unlabeled" and the process exits 0.
// This script never blocks a build.
//
// House rule: hyphens only, no em-dashes.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const client = require('./jev-devtime-client.cjs');
const forkDeclaration = require('../lib/core/fork-declaration.cjs');

const { EGRESS_PROFILES } = client;

const REPO_ROOT = path.join(__dirname, '..');
const PROFILE = EGRESS_PROFILES.fork359_moonshot;
const POLICY_REL_PATH = PROFILE.must_equal_file.policy;
const POLICY_ABS_PATH = path.join(REPO_ROOT, POLICY_REL_PATH);
const POLICY_RAW = fs.readFileSync(POLICY_ABS_PATH, 'utf8');
const POLICY_JSON = JSON.parse(POLICY_RAW);
const POLICY_SHA256 = crypto.createHash('sha256').update(POLICY_RAW).digest('hex');

const POLICIES_BY_ID = {};
(Array.isArray(POLICY_JSON.policies) ? POLICY_JSON.policies : []).forEach((p) => {
  if (p && typeof p.policy_id === 'string') POLICIES_BY_ID[p.policy_id] = p;
});

// synthetic-359 fixture: the ONLY --fixtures source ever accepted (relative
// path fixed; `root` is an injectable-for-tests default of REPO_ROOT, never
// exposed as a production flag).
const SYNTHETIC_FIXTURE_REL = path.join('tests', 'fixtures', 'card-fire-replay', 'prose-forks-359.json');

// authored forward-scenario fixture: the default source of truth for
// scenario_id -> authored turns when reading --from-results rows.
const DEFAULT_SCENARIOS_REL = path.join('tests', 'fixtures', 'forward-fork-scenarios-359.json');

const CONC = 4;

const DEFAULT_REPORT_PATH = path.join(
  REPO_ROOT, '.planning', 'phases',
  '359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros',
  '359-MOONSHOT-SCORES.md'
);

// ---------------------------------------------------------------------------
// QUESTION_TEXT: one fixed sentence per Score question, each naming the
// state keys it reads, each at most 400 chars (the guard's question_max_len).
// ---------------------------------------------------------------------------
const QUESTION_TEXT = Object.freeze({
  relevant_to_context: 'Read the policy at `policy`. Using its relevant_to_context rule, does the moonshot at `moonshot` still address the decision described in `context`, given the practical options at `practical_labels`?',
  radical_departure: 'Read the policy at `policy`. Using its radical_departure rule, how far does the moonshot at `moonshot` depart from every option in `practical_labels`?',
});

for (const qid of Object.keys(QUESTION_TEXT)) {
  if (QUESTION_TEXT[qid].length > 400) {
    throw new Error('score-moonshots-359: QUESTION_TEXT.' + qid + ' exceeds 400 chars');
  }
}

// ---------------------------------------------------------------------------
// selectRows({fixtures, fromResults, scenariosPath, root}): the FIRST and
// only place any candidate row is read. Refuses before any request body is
// built.
//
//  - fixtures: ONLY the synthetic-359 fixture (SYNTHETIC_FIXTURE_REL under
//    `root`, default REPO_ROOT). Any other path throws. Any entry whose
//    source is not "synthetic-359" throws (defense in depth: the committed
//    fixture never carries one, this catches a future corruption). Each
//    prose_fork:true entry with a moonshot-shaped last label gives a row
//    {id, context: envelope.output_text, labels: fork_labels}. A missing
//    fixture file yields zero rows, never a crash.
//  - fromResults <jsonl path>: rows where declared === true and
//    declared_labels is an array. Each row's scenario_id MUST exist in the
//    authored scenario fixture (scenariosPath, default
//    DEFAULT_SCENARIOS_REL under REPO_ROOT) or this throws
//    "refused: unknown scenario <id>". context = that scenario's authored
//    turns joined by a blank line (never Larry's reply). labels =
//    declared_labels. id = "<scenario_id>:<arm>:<run>". A missing results
//    file yields zero rows, never a crash.
//
// A row whose last label does not start with MOONSHOT_PREFIX is silently
// skipped (no-moonshot): it is simply not included in the returned array.
// ---------------------------------------------------------------------------
function selectRows(opts) {
  const o = opts || {};
  const root = o.root || REPO_ROOT;
  const rows = [];

  if (o.fixtures) {
    const canonicalAbs = path.join(root, SYNTHETIC_FIXTURE_REL);
    const givenAbs = (typeof o.fixtures === 'string') ? path.resolve(root, o.fixtures) : canonicalAbs;
    if (givenAbs !== canonicalAbs) {
      throw new Error('refused: ' + o.fixtures + ' is not the synthetic-359 fixture');
    }
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(canonicalAbs, 'utf8'));
    } catch (_e) {
      return rows; // missing/unreadable fixture -> zero rows, never a crash
    }
    const entries = Array.isArray(parsed && parsed.entries) ? parsed.entries : [];
    for (const entry of entries) {
      if (!entry || entry.source !== 'synthetic-359') {
        throw new Error('refused: entry ' + (entry && entry.id) + ' source is not synthetic-359');
      }
      if (entry.prose_fork !== true) continue;
      const labels = Array.isArray(entry.fork_labels) ? entry.fork_labels : [];
      if (labels.length === 0 || !String(labels[labels.length - 1]).startsWith(forkDeclaration.MOONSHOT_PREFIX)) {
        continue; // no-moonshot, skipped
      }
      const envelope = entry.envelope || {};
      rows.push({
        id: entry.id,
        context: typeof envelope.output_text === 'string' ? envelope.output_text : '',
        labels: labels,
      });
    }
    return rows;
  }

  if (o.fromResults) {
    const scenariosAbs = o.scenariosPath ? path.resolve(root, o.scenariosPath) : path.join(root, DEFAULT_SCENARIOS_REL);
    let scenariosById = {};
    try {
      const scenariosJson = JSON.parse(fs.readFileSync(scenariosAbs, 'utf8'));
      const list = Array.isArray(scenariosJson && scenariosJson.scenarios) ? scenariosJson.scenarios : [];
      for (const s of list) {
        if (s && typeof s.id === 'string') scenariosById[s.id] = s;
      }
    } catch (_e) {
      scenariosById = {}; // no known scenarios -> every scenario_id is unknown, refused below
    }

    let lines = [];
    try {
      lines = fs.readFileSync(o.fromResults, 'utf8').split('\n').filter(Boolean);
    } catch (_e) {
      return rows; // missing results file -> zero rows, never a crash
    }

    for (const line of lines) {
      let rec;
      try { rec = JSON.parse(line); } catch (_e) { continue; }
      if (!rec || rec.declared !== true || !Array.isArray(rec.declared_labels)) continue;
      const scenario = scenariosById[rec.scenario_id];
      if (!scenario) {
        throw new Error('refused: unknown scenario ' + rec.scenario_id);
      }
      const labels = rec.declared_labels;
      if (labels.length === 0 || !String(labels[labels.length - 1]).startsWith(forkDeclaration.MOONSHOT_PREFIX)) {
        continue; // no-moonshot, skipped
      }
      const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
      rows.push({
        id: rec.scenario_id + ':' + (rec.arm || '') + ':' + (rec.run || ''),
        context: turns.join('\n\n'), // authored turns only, never Larry's reply
        labels: labels,
      });
    }
    return rows;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// buildScoreBody(row, policyText): every rule, level and boundary string is
// copied verbatim from the parsed policy file (POLICIES_BY_ID), never
// reworded. Values over the profile caps are NOT truncated here -- the
// guard refuses them (refuse, never strip) and the caller reports
// "refused: <guard message>".
// ---------------------------------------------------------------------------
function buildScoreBody(row, policyText) {
  const labels = Array.isArray(row && row.labels) ? row.labels : [];
  const practicalLabels = labels.slice(0, -1).join(' | ');
  const moonshot = labels[labels.length - 1];
  const state = {
    context: (row && typeof row.context === 'string') ? row.context : '',
    practical_labels: practicalLabels,
    moonshot: moonshot,
    policy: policyText,
  };
  const questions = {};
  for (const qid of ['relevant_to_context', 'radical_departure']) {
    const p = POLICIES_BY_ID[qid];
    if (!p) throw new Error('score-moonshots-359: no policy entry for ' + qid);
    questions[qid] = {
      type: 'score',
      instructions: {
        question: QUESTION_TEXT[qid],
        rule: p.instructions,
        boundary_cases: Array.isArray(p.boundary_cases) ? p.boundary_cases.slice() : [],
      },
      criteria: Array.isArray(p.levels) ? p.levels.slice() : [],
    };
  }
  return { model: 'jev-latest', state: state, questions: questions };
}

// ---------------------------------------------------------------------------
// mapScore(answer): {type: 'score', score: finite number, confidence} ->
// {score, confidence}, else the string 'error'.
// ---------------------------------------------------------------------------
function mapScore(answer) {
  const a = answer || {};
  if (a.type === 'score' && typeof a.score === 'number' && Number.isFinite(a.score)) {
    return { score: a.score, confidence: a.confidence };
  }
  return 'error';
}

// ---------------------------------------------------------------------------
// renderReport(rows, meta, {append, section}): markdown. rows carry only
// ids, moonshot labels, scores/confidences and a status -- never context
// text. `append` renders just the new "## <section>" block for the caller
// to append to an existing report file.
// ---------------------------------------------------------------------------
function scoreDistribution(rows, field) {
  const vals = [];
  for (const r of rows) {
    const v = r && r[field] && typeof r[field].score === 'number' && Number.isFinite(r[field].score) ? r[field].score : null;
    if (v !== null) vals.push(v);
  }
  const histogram = [0, 0, 0, 0, 0];
  if (vals.length === 0) return { mean: null, histogram: histogram };
  let sum = 0;
  for (const v of vals) {
    sum += v;
    const bucket = Math.min(4, Math.max(0, Math.round(v)));
    histogram[bucket] += 1;
  }
  return { mean: sum / vals.length, histogram: histogram };
}

function renderReport(rows, meta, opts) {
  const m = meta || {};
  const o = opts || {};
  const list = Array.isArray(rows) ? rows : [];

  const counts = {};
  for (const row of list) {
    const key = (row && row.status) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  const countsLine = Object.keys(counts).sort().map((k) => k + '=' + counts[k]).join(', ') || '(no rows)';

  const relevantDist = scoreDistribution(list, 'relevant');
  const radicalDist = scoreDistribution(list, 'radical');

  const lines = [];
  if (o.append) {
    lines.push('## ' + (o.section || 'Run'));
  } else {
    lines.push('# Phase 359 Moonshot Scores');
  }
  lines.push('');
  lines.push('Run timestamp: ' + (m.timestamp || ''));
  lines.push('Model: ' + (m.model || 'jev-latest'));
  lines.push('Policy sha256: ' + (m.policySha256 || ''));
  lines.push('Counts by status: ' + countsLine);
  lines.push('');
  lines.push('Scores are dev-time evidence only and are never auto-applied to any fixture (N-3).');
  lines.push('');
  lines.push('| id | moonshot | relevant score | relevant confidence | radical score | radical confidence | status |');
  lines.push('|----|----------|-----------------|----------------------|----------------|----------------------|--------|');
  for (const row of list) {
    const relScore = row.relevant && typeof row.relevant.score === 'number' ? row.relevant.score.toFixed(2) : '';
    const relConf = row.relevant && row.relevant.confidence !== undefined && row.relevant.confidence !== null ? row.relevant.confidence : '';
    const radScore = row.radical && typeof row.radical.score === 'number' ? row.radical.score.toFixed(2) : '';
    const radConf = row.radical && row.radical.confidence !== undefined && row.radical.confidence !== null ? row.radical.confidence : '';
    lines.push('| ' + row.id + ' | ' + (row.moonshot || '') + ' | ' + relScore + ' | ' + relConf + ' | ' + radScore + ' | ' + radConf + ' | ' + row.status + ' |');
  }
  lines.push('');
  lines.push('### Distribution');
  lines.push('');
  lines.push('relevant_to_context: mean=' + (relevantDist.mean === null ? 'n/a' : relevantDist.mean.toFixed(2)) + ', histogram(0-4)=' + relevantDist.histogram.join(','));
  lines.push('radical_departure: mean=' + (radicalDist.mean === null ? 'n/a' : radicalDist.mean.toFixed(2)) + ', histogram(0-4)=' + radicalDist.histogram.join(','));
  lines.push('');

  return lines.join('\n');
}

function writeReport(reportPath, rows, meta, opts) {
  const o = opts || {};
  const rendered = renderReport(rows, meta, o);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  if (o.append && fs.existsSync(reportPath)) {
    const existing = fs.readFileSync(reportPath, 'utf8');
    fs.writeFileSync(reportPath, existing.replace(/\s*$/, '\n') + '\n' + rendered, 'utf8');
  } else {
    fs.writeFileSync(reportPath, rendered, 'utf8');
  }
  return rendered;
}

function parseArgs(argv) {
  const args = {
    fixtures: false,
    fromResults: null,
    scenariosPath: null,
    report: DEFAULT_REPORT_PATH,
    section: null,
    append: false,
    dryRun: false,
  };
  const list = Array.isArray(argv) ? argv.slice() : [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    switch (a) {
      case '--fixtures':
        args.fixtures = true;
        break;
      case '--from-results':
        args.fromResults = list[++i];
        break;
      case '--scenarios':
        args.scenariosPath = list[++i];
        break;
      case '--report':
        args.report = list[++i];
        break;
      case '--section':
        args.section = list[++i];
        break;
      case '--append':
        args.append = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        break;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// main(argv): never throws out of its own control flow, never blocks a
// build. Keyless and dry-run runs never send a request; exit 0 always.
// ---------------------------------------------------------------------------
async function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));

  let rows;
  try {
    rows = selectRows({
      fixtures: args.fixtures,
      fromResults: args.fromResults,
      scenariosPath: args.scenariosPath || undefined,
    });
  } catch (e) {
    process.stderr.write('[score-moonshots-359] ' + (e && e.message) + '\n');
    return 1;
  }

  const resultRows = rows.map((r) => ({
    id: r.id,
    moonshot: r.labels[r.labels.length - 1],
    relevant: null,
    radical: null,
    status: 'unlabeled',
  }));

  const runMeta = {
    timestamp: new Date().toISOString(),
    model: 'jev-latest',
    policySha256: POLICY_SHA256,
  };

  const key = client.loadKey({
    env: process.env,
    secretsPath: path.join(os.homedir(), '.secrets', 'typesafe.env'),
  });

  if (args.dryRun) {
    const guard = client.makeEgressGuard(PROFILE, { root: REPO_ROOT });
    for (let i = 0; i < rows.length; i++) {
      try {
        const body = buildScoreBody(rows[i], POLICY_RAW);
        guard(body);
        resultRows[i].status = 'unlabeled';
      } catch (e) {
        const label = (e && e.code === 'EGRESS_REFUSED') ? e.key : (e && e.message);
        resultRows[i].status = 'refused: ' + label;
      }
    }
    writeReport(args.report, resultRows, runMeta, { append: args.append, section: args.section });
    console.log('dry-run: no request sent, ' + resultRows.length + ' rows written');
    return 0;
  }

  if (key === null) {
    writeReport(args.report, resultRows, runMeta, { append: args.append, section: args.section });
    console.log('unlabeled: no TYPESAFE key (keyless run)');
    return 0;
  }

  const guard = client.makeEgressGuard(PROFILE, { root: REPO_ROOT });
  await client.pool(rows.map((_r, i) => i), CONC, async (i) => {
    try {
      const body = buildScoreBody(rows[i], POLICY_RAW);
      const res = await client.jev(body, { key: key, guard: guard });
      if (!res || res.status !== 200 || !res.json || typeof res.json !== 'object' || !res.json.answers) {
        resultRows[i].status = 'error: bad response (status ' + (res && res.status) + ')';
        return;
      }
      const answers = res.json.answers;
      const relevant = mapScore(answers.relevant_to_context);
      const radical = mapScore(answers.radical_departure);
      if (relevant === 'error' || radical === 'error') {
        resultRows[i].status = 'error: malformed score answer';
        return;
      }
      resultRows[i].relevant = relevant;
      resultRows[i].radical = radical;
      resultRows[i].status = 'labeled';
    } catch (e) {
      const label = (e && e.code === 'EGRESS_REFUSED') ? ('refused: ' + e.key) : ('error: ' + (e && e.message));
      resultRows[i].status = label;
    }
  });

  writeReport(args.report, resultRows, runMeta, { append: args.append, section: args.section });
  console.log('labeled: ' + resultRows.length + ' rows written to ' + args.report);
  return 0;
}

module.exports = {
  selectRows,
  buildScoreBody,
  mapScore,
  renderReport,
  writeReport,
  main,
  QUESTION_TEXT,
  POLICIES_BY_ID,
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(typeof code === 'number' ? code : 0))
    .catch((e) => {
      process.stderr.write('[score-moonshots-359] uncaught: ' + (e && e.message) + '\n');
      process.exit(0);
    });
}
