#!/usr/bin/env node
'use strict';
/*
 * scripts/label-card-fire-replay.cjs -- Phase 357 Plan 04 Task 1 (SPEC R3,
 * D-10, D-11, D-12).
 *
 * DEV-TIME ONLY. Navigator-invoked from a developer shell. Never a hook,
 * never scripts/release.sh, never required from lib/ or hooks/ (the
 * tripwire in tests/test-353-tripwires.cjs leg 2 bans this file's own name
 * from hooks/).
 *
 * Part 8 (Graph Boundary): sends only the sanitized and synthetic sources
 * (a) 238, (b) debug, (c) live to Jev, and only through the shared
 * scripts/jev-devtime-client.cjs egress guard (card_fire_replay profile,
 * data/jev-policies/card-fire-replay.json). Source (d) dogfood NEVER
 * leaves the machine: assertLabelable refuses it before any request is
 * built, as the very first statement of buildRequestBody.
 *
 * Three independent Nouls per eligible entry -- is_fork, already_answered,
 * relevant -- each with the full written policy stated in the question
 * (spike 004's lesson: state the policy, never let it be inferred). The
 * three answers are never compared to each other and no Choice or Noul
 * confidence is mixed with them (D-12). Disagreements with the hand label
 * are listed in the report for a navigator ruling and are never
 * auto-applied.
 *
 * Keyless: every askable row degrades to "unlabeled" and the process exits
 * 0 (D-11). This script never blocks a build.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const client = require('./jev-devtime-client.cjs');
const corpusLoader = require('./card-fire-replay-corpus.cjs');

const { EGRESS_PROFILES } = client;

const REPO_ROOT = path.join(__dirname, '..');
const PROFILE = EGRESS_PROFILES.card_fire_replay;
const POLICY_REL_PATH = PROFILE.must_equal_file.policy;
const POLICY_ABS_PATH = path.join(REPO_ROOT, POLICY_REL_PATH);
const POLICY_RAW = fs.readFileSync(POLICY_ABS_PATH, 'utf8');
const POLICY_JSON = JSON.parse(POLICY_RAW);
const POLICY_SHA256 = crypto.createHash('sha256').update(POLICY_RAW).digest('hex');

const NOUL_MAPPING = (POLICY_JSON && POLICY_JSON.noul_mapping) || {
  yes_at_or_above: 0.8,
  no_at_or_below: 0.2,
  otherwise: 'uncertain',
};

const POLICIES_BY_ID = {};
(Array.isArray(POLICY_JSON.policies) ? POLICY_JSON.policies : []).forEach((p) => {
  if (p && typeof p.policy_id === 'string') POLICIES_BY_ID[p.policy_id] = p;
});

const CONC = 4;

const DEFAULT_REPORT_PATH = path.join(
  REPO_ROOT, '.planning', 'phases',
  '357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re',
  '357-JEV-LABEL-REPORT.md'
);

// ---------------------------------------------------------------------------
// LABELABLE_SOURCES (D-11): only sources (a)(b)(c) may ever be projected
// into a request. dogfood is never a member of this list.
// ---------------------------------------------------------------------------
const LABELABLE_SOURCES = Object.freeze(['238', 'debug', 'live']);

// ---------------------------------------------------------------------------
// STRUCTURAL_REASONS: verdict reasons no Noul can inform, since they are
// counter-driven (a bounded escape or the card already having fired), not
// content-driven. Derived by reading scripts/check-card-fire.cjs directly
// (MAX_FORCE_RETRIES = 3, MAX_SESSION_INTERCEPTS = 12 as of this commit) and
// citing that source here, rather than requiring the module at runtime --
// this script's own require list stays Node built-ins plus
// jev-devtime-client.cjs and card-fire-replay-corpus.cjs only.
// ---------------------------------------------------------------------------
const STRUCTURAL_REASONS = Object.freeze(new Set([
  'card-fired',
  'session-intercept-ceiling-reached-after-12-intercepts',
  'bounded-escape-released-after-3-retries',
]));

function isStructural(entry) {
  return !!(entry && typeof entry.expected_reason === 'string' && STRUCTURAL_REASONS.has(entry.expected_reason));
}

// ---------------------------------------------------------------------------
// QUESTION_TEXT: one fixed sentence per Noul, each naming the state keys it
// reads, each at most 400 chars.
// ---------------------------------------------------------------------------
const QUESTION_TEXT = Object.freeze({
  is_fork: 'Read the policy at `policy`. Using its is_fork rule, does the assistant turn at `output_text` (context: `gate_subject_text`, `gate_shape`, `turns_since_gate`) leave the navigator a genuine structural fork between two or more distinct next moves?',
  already_answered: 'Read the policy at `policy`. Using its already_answered rule, does the human turn at `preceding_user_text` (context: `gate_shape`, `turns_since_gate`) already pick one of the reached gate\'s options?',
  relevant: 'Read the policy at `policy`. Using its relevant rule, is the reached gate at `gate_subject_text` about the same thing the human is doing in `preceding_user_text` (context: `gate_shape`, `turns_since_gate`)?',
});

for (const qid of Object.keys(QUESTION_TEXT)) {
  if (QUESTION_TEXT[qid].length > 400) {
    throw new Error('label-card-fire-replay: QUESTION_TEXT.' + qid + ' exceeds 400 chars');
  }
}

// ---------------------------------------------------------------------------
// assertLabelable(entry, fileMeta): the FIRST statement of buildRequestBody.
// Throws before anything else runs when the entry is dogfood, or when the
// owning file's meta carries no non-empty sanitization_statement.
// ---------------------------------------------------------------------------
function assertLabelable(entry, fileMeta) {
  const id = (entry && typeof entry.id === 'string' && entry.id) ? entry.id : '(unknown)';
  if (entry && entry.source === 'dogfood') {
    throw new Error('refused ' + id + ': dogfood never leaves the machine (Part 8, D-11)');
  }
  const statement = fileMeta && fileMeta.sanitization_statement;
  if (typeof statement !== 'string' || !statement) {
    throw new Error('refused ' + id + ': file has no meta.sanitization_statement (D-11)');
  }
}

// ---------------------------------------------------------------------------
// selectLabelable(corpus): only entries whose source is in LABELABLE_SOURCES
// are returned, each paired with its owning file's meta. dogfood entries are
// never passed on, ever.
// ---------------------------------------------------------------------------
function selectLabelable(corpus) {
  const files = (corpus && corpus.files) || {};
  const entries = (corpus && Array.isArray(corpus.entries)) ? corpus.entries : [];
  const out = [];
  for (const entry of entries) {
    if (!entry || LABELABLE_SOURCES.indexOf(entry.source) === -1) continue;
    const fileEntry = files[entry.source];
    const fileMeta = (fileEntry && fileEntry.meta) || null;
    out.push({ entry, fileMeta });
  }
  return out;
}

// ---------------------------------------------------------------------------
// extractTextFromContent / lastRecordText: a tiny local reader over the D-02
// entry.envelope.transcript array shape ({type: 'user'|'assistant', message:
// {role, content}}), mirroring lib/hmi/turn-text.cjs::extractAssistantText's
// string-or-block-array flattening. This is a projection helper over an
// in-memory fixture entry, not a second transcript FILE reader -- it never
// touches disk and never duplicates turn-text.cjs's own contract, so it does
// not require that module (this script's require list stays Node built-ins
// plus the two named scripts/*.cjs siblings).
// ---------------------------------------------------------------------------
function extractTextFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (typeof block === 'string') { parts.push(block); continue; }
    if (block && typeof block === 'object' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.join('\n');
}

function lastRecordText(transcript, type) {
  if (!Array.isArray(transcript)) return '';
  for (let i = transcript.length - 1; i >= 0; i--) {
    const rec = transcript[i];
    if (rec && rec.type === type) {
      const content = rec.message && rec.message.content;
      return extractTextFromContent(content);
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// projectState(entry): derives the six state keys from the entry and
// nothing else. All six values are strings (string_keys). Values longer than
// the profile caps are NOT truncated here -- the guard refuses them and the
// caller reports "refused: <guard message>" (refuse, never strip).
// ---------------------------------------------------------------------------
function projectState(entry) {
  const envelope = (entry && entry.envelope) || {};
  const mode = typeof envelope.mode === 'string' ? envelope.mode : 'direct';
  const isTranscript = mode.indexOf('transcript') !== -1;
  const isSidechannel = mode.indexOf('sidechannel') !== -1;

  const outputText = isTranscript
    ? lastRecordText(envelope.transcript, 'assistant')
    : (typeof envelope.output_text === 'string' ? envelope.output_text : '');

  const precedingUserText = isTranscript
    ? lastRecordText(envelope.transcript, 'user')
    : (typeof envelope.preceding_user_text === 'string' ? envelope.preceding_user_text : '');

  let gateSubjectText;
  let gateShape;
  let turnsSinceGate;

  if (isSidechannel) {
    const records = Array.isArray(envelope.sidechannel_records) ? envelope.sidechannel_records : [];
    let newest = null;
    for (const rec of records) {
      if (!rec || typeof rec.age_ms !== 'number') continue;
      if (newest === null || rec.age_ms < newest.age_ms) newest = rec;
    }
    const subjects = records
      .map((rec) => (rec && typeof rec.subject === 'string') ? rec.subject : '')
      .filter(Boolean);
    gateSubjectText = subjects.length ? subjects.join(' ') : '';
    gateShape = (newest && typeof newest.shape === 'string' && newest.shape) ? newest.shape : 'backstop';
    turnsSinceGate = (newest && newest.age_ms <= 120000) ? '0' : '1+';
  } else {
    gateSubjectText = typeof envelope.gate_subject_text === 'string' ? envelope.gate_subject_text : '';
    gateShape = 'backstop';
    turnsSinceGate = '0';
  }

  return {
    output_text: outputText,
    preceding_user_text: precedingUserText,
    gate_subject_text: gateSubjectText,
    gate_shape: gateShape,
    turns_since_gate: turnsSinceGate,
    policy: POLICY_RAW,
  };
}

// ---------------------------------------------------------------------------
// buildRequestBody(entry, fileMeta): assertLabelable is the FIRST statement.
// Every rule, boundary case and criteria string is copied verbatim from the
// parsed policy file, so the guard's question_strings_from_file_key check
// always passes for a body this function builds.
// ---------------------------------------------------------------------------
function buildRequestBody(entry, fileMeta) {
  assertLabelable(entry, fileMeta);

  const state = projectState(entry);
  const questions = {};
  for (const qid of ['is_fork', 'already_answered', 'relevant']) {
    const p = POLICIES_BY_ID[qid];
    if (!p) throw new Error('label-card-fire-replay: no policy entry for ' + qid);
    questions[qid] = {
      type: 'noul',
      instructions: {
        question: QUESTION_TEXT[qid],
        rule: p.instructions,
        boundary_cases: Array.isArray(p.boundary_cases) ? p.boundary_cases.slice() : [],
      },
      criteria: {
        true: p.criteria && p.criteria.true,
        false: p.criteria && p.criteria.false,
      },
    };
  }

  return { model: 'jev-latest', state: state, questions: questions };
}

// ---------------------------------------------------------------------------
// mapNoul(v): thresholds read from the policy file's noul_mapping, never
// hardcoded a second time.
// ---------------------------------------------------------------------------
function mapNoul(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'error';
  if (v >= NOUL_MAPPING.yes_at_or_above) return 'yes';
  if (v <= NOUL_MAPPING.no_at_or_below) return 'no';
  return 'uncertain';
}

// ---------------------------------------------------------------------------
// deriveVerdict({is_fork, already_answered, relevant}): the three mapped
// answers are combined ONLY through the gate's own AND structure -- never
// ranked, never compared to each other (D-12).
// ---------------------------------------------------------------------------
function deriveVerdict(mapped) {
  const m = mapped || {};
  if (m.is_fork === 'yes' && m.already_answered === 'no' && m.relevant === 'yes') return 'block';
  if (m.is_fork === 'no' || m.already_answered === 'yes' || m.relevant === 'no') return 'pass';
  return 'uncertain';
}

function baseRow(entry) {
  return {
    id: entry.id,
    source: entry.source,
    hand_label: entry.expected_verdict_class,
    raw: { is_fork: null, already_answered: null, relevant: null },
    mapped: { is_fork: 'unlabeled', already_answered: 'unlabeled', relevant: 'unlabeled' },
    verdict: 'unlabeled',
    status: 'unlabeled',
  };
}

function applyAnswers(row, res) {
  if (!res || res.status !== 200 || !res.json || typeof res.json !== 'object' || !res.json.answers) {
    row.status = 'error: bad response (status ' + (res && res.status) + ')';
    return;
  }
  const answers = res.json.answers;
  for (const qid of ['is_fork', 'already_answered', 'relevant']) {
    const ans = answers[qid];
    const okNoul = ans && ans.type === 'noul' && typeof ans.noul === 'number'
      && Number.isFinite(ans.noul) && ans.noul >= 0 && ans.noul <= 1;
    row.raw[qid] = okNoul ? ans.noul : null;
    row.mapped[qid] = okNoul ? mapNoul(ans.noul) : 'error';
  }
  row.verdict = deriveVerdict(row.mapped);
  row.status = 'labeled';
}

// ---------------------------------------------------------------------------
// agreementLabel(row): yes / no / structural / unlabeled / refused. Never
// compares raw Noul values against each other -- only the already-derived
// verdict against the hand label.
// ---------------------------------------------------------------------------
function agreementLabel(row) {
  if (row.status === 'structural (not asked)') return 'structural';
  if (row.status === 'unlabeled') return 'unlabeled';
  if (typeof row.status === 'string' && row.status.indexOf('refused') === 0) return 'refused';
  if (row.verdict === 'block' || row.verdict === 'pass') {
    return row.verdict === row.hand_label ? 'yes' : 'no';
  }
  return 'unlabeled';
}

// ---------------------------------------------------------------------------
// renderReport(rows, meta): markdown. No entry text (output_text,
// gate_subject_text, preceding_user_text) is ever written into the report --
// only ids, sources, labels and numbers.
// ---------------------------------------------------------------------------
function renderReport(rows, meta) {
  const m = meta || {};
  const list = Array.isArray(rows) ? rows : [];
  const counts = {};
  for (const row of list) {
    const key = agreementLabel(row);
    counts[key] = (counts[key] || 0) + 1;
  }
  const countsLine = Object.keys(counts).sort().map((k) => k + '=' + counts[k]).join(', ') || '(no rows)';

  const lines = [];
  lines.push('# Phase 357 Jev Label Report');
  lines.push('');
  lines.push('Run timestamp: ' + (m.timestamp || ''));
  lines.push('Model: ' + (m.model || 'jev-latest'));
  lines.push('Policy sha256: ' + (m.policySha256 || ''));
  lines.push('Thresholds: yes >= ' + NOUL_MAPPING.yes_at_or_above + ', no <= ' + NOUL_MAPPING.no_at_or_below + ', otherwise ' + NOUL_MAPPING.otherwise);
  lines.push('Counts by agreement: ' + countsLine);
  lines.push('');
  lines.push('Jev labels are never auto-applied; every disagreement below needs a navigator ruling (D-12).');
  lines.push('');
  lines.push('| id | source | hand | is_fork | already_answered | relevant | verdict | agree |');
  lines.push('|----|--------|------|---------|-------------------|----------|---------|-------|');

  const disagreements = [];
  for (const row of list) {
    const agree = agreementLabel(row);
    if (agree === 'no') disagreements.push(row.id);
    lines.push('| ' + row.id + ' | ' + row.source + ' | ' + row.hand_label + ' | '
      + row.mapped.is_fork + ' | ' + row.mapped.already_answered + ' | ' + row.mapped.relevant + ' | '
      + row.verdict + ' | ' + agree + ' |');
  }

  lines.push('');
  lines.push('## Disagreements for navigator ruling');
  lines.push('');
  if (disagreements.length === 0) {
    lines.push('(none)');
  } else {
    for (const id of disagreements) lines.push('- ' + id);
  }
  lines.push('');

  return lines.join('\n');
}

function writeReport(reportPath, rows, meta) {
  const content = renderReport(rows, meta);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, content, 'utf8');
  return content;
}

function parseArgs(argv) {
  const args = {
    report: DEFAULT_REPORT_PATH,
    corpusDir: undefined,
    only: null,
    dryRun: false,
  };
  const list = Array.isArray(argv) ? argv.slice() : [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    switch (a) {
      case '--report':
        args.report = list[++i];
        break;
      case '--corpus-dir':
        args.corpusDir = list[++i];
        break;
      case '--only':
        args.only = String(list[++i] || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
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

  const loadOpts = {};
  if (args.corpusDir) loadOpts.corpusDir = args.corpusDir;
  const corpus = corpusLoader.loadCorpus(loadOpts);

  let pairs = selectLabelable(corpus);
  if (args.only) {
    const wanted = new Set(args.only);
    pairs = pairs.filter((p) => wanted.has(p.entry.id));
  }

  const rows = pairs.map((p) => baseRow(p.entry));

  const runMeta = {
    timestamp: new Date().toISOString(),
    model: 'jev-latest',
    policySha256: POLICY_SHA256,
    thresholds: NOUL_MAPPING,
  };

  const structuralIdx = [];
  const askableIdx = [];
  pairs.forEach((pair, i) => {
    if (isStructural(pair.entry)) structuralIdx.push(i);
    else askableIdx.push(i);
  });
  for (const i of structuralIdx) {
    rows[i].status = 'structural (not asked)';
    rows[i].verdict = 'structural';
  }

  const key = client.loadKey({
    env: process.env,
    secretsPath: path.join(os.homedir(), '.secrets', 'typesafe.env'),
  });

  if (args.dryRun) {
    const guard = client.makeEgressGuard(PROFILE, { root: REPO_ROOT });
    for (const i of askableIdx) {
      const pair = pairs[i];
      try {
        const body = buildRequestBody(pair.entry, pair.fileMeta);
        guard(body);
        rows[i].status = 'unlabeled';
      } catch (e) {
        const label = (e && e.code === 'EGRESS_REFUSED') ? e.key : (e && e.message);
        rows[i].status = 'refused: ' + label;
      }
    }
    writeReport(args.report, rows, runMeta);
    console.log('dry-run: no request sent, ' + rows.length + ' rows written');
    return 0;
  }

  if (key === null) {
    for (const i of askableIdx) {
      rows[i].status = 'unlabeled';
    }
    writeReport(args.report, rows, runMeta);
    console.log('unlabeled: no TYPESAFE key (keyless run)');
    return 0;
  }

  const guard = client.makeEgressGuard(PROFILE, { root: REPO_ROOT });
  await client.pool(askableIdx, CONC, async (i) => {
    const pair = pairs[i];
    try {
      const body = buildRequestBody(pair.entry, pair.fileMeta);
      const res = await client.jev(body, { key: key, guard: guard });
      applyAnswers(rows[i], res);
    } catch (e) {
      const label = (e && e.code === 'EGRESS_REFUSED') ? ('refused: ' + e.key) : ('error: ' + (e && e.message));
      rows[i].status = label;
    }
  });

  writeReport(args.report, rows, runMeta);
  console.log('labeled: ' + rows.length + ' rows written to ' + args.report);
  return 0;
}

module.exports = {
  LABELABLE_SOURCES,
  STRUCTURAL_REASONS,
  QUESTION_TEXT,
  isStructural,
  projectState,
  selectLabelable,
  assertLabelable,
  buildRequestBody,
  mapNoul,
  deriveVerdict,
  renderReport,
  main,
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(typeof code === 'number' ? code : 0))
    .catch((e) => {
      process.stderr.write('[label-card-fire-replay] uncaught: ' + (e && e.message) + '\n');
      process.exit(0);
    });
}
