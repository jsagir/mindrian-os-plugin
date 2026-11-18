#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/part8-shape-acceptance.cjs - Phase 392 Plan 13 (PLAN.md section 6,
 * success criterion 392-SC7). Dev-time only; never required from lib/ or hooks/.
 *
 * The acceptance of the Part 8 problem-shape packet as a Jev leg (the pattern
 * of tests/test-355-jev-ceilings.cjs and scripts/jev-devtime-client.cjs): the
 * same generic methodology question goes twice through the plugin route
 * (lib/core/brain-client.cjs ask), once BARE (MINDRIAN_BRAIN_SHAPE=0, the
 * wire is {question}) and once SHAPED (the room's closed-vocabulary packet
 * built by the one builder, the wire is {question, shape}). A local recording
 * proxy around fetch captures the outbound bytes of both runs, and the shaped
 * run must win on four criteria:
 *
 *   1. problem_type_source: bare heuristic, shaped signal.
 *   2. grounding order: bare lexical, shaped shape_boosted (rows with
 *      shape_match counted on the raw reply).
 *   3. coverage: the shaped run's chain_coverage is full (full true, or
 *      rank1_leads_returned equal to rank1_leads_total with the total above
 *      0). A shaped run with rank1_leads_total 0 is "canon records no lead
 *      for this type": neither a win nor a loss, named in the output.
 *   4. ordering: the option order is consistent with Theo's rank in both runs
 *      (option_order theo_rank, theo_rank non-decreasing along the options).
 *
 * The relevance leg asks Jev (TypeSafe, scripts/jev-devtime-client.cjs, never
 * plurai: owner rule 2026-09-29) one fixed closed question over the two row-id
 * lists and the two enum values (problem type, Phase): which list better
 * addresses the type at the Phase, options a, b, same. Jev sees chapter ids,
 * section labels and enum members only; it never sees a snippet, a room word
 * or the question. Its answer is recorded beside the human verdict passed
 * with --human-verdict (the owner reads both lists once; the script records,
 * never claims, that reading).
 *
 * Part 8 (absolute): the room's lexicon is asserted absent from both outbound
 * bodies; --out must lie outside this repository (exit 2 otherwise); the
 * output holds row ids and enum values, never a snippet. The lexicon check of
 * brain-client runs against --room through the documented operator pin
 * CLAUDE_ACTIVE_ROOM (lexicon_scope machine_global), so no other room of this
 * machine is read.
 *
 * Usage:
 *   node scripts/part8-shape-acceptance.cjs --question "<generic question>"
 *        --room <roomDir> [--out <path outside the repo>]
 *        [--human-verdict a|b|same]
 *   --out defaults to $HOME/.mindrian/part8-acceptance/<ISO date>.json.
 *
 * Exit codes:
 *   0   the shaped run lost no criterion (a no-lead coverage counts as not lost)
 *   1   a criterion lost (named), the question was refused, or a lexicon word
 *       reached a body
 *   2   --out is inside the repository
 *   77  SKIP: the Brain is unreachable, or its tools/list does not advertise
 *       shape on brain_ask and recommend_chain (Theo Phase 48 not deployed),
 *       or TYPESAFE_API_KEY is absent (the plain comparison still runs and is
 *       written before the SKIP line)
 *
 * Runnable live only after Theo Phase 48 T6 deploys (the probe gates it).
 * Baseline from this machine on 2026-11-08, before Phase 392 (392-CONTEXT.md,
 * PLAN.md section 6): problem_type_source heuristic, rung_source inferred,
 * coverage 1 of 4 partial, confidence 0.6 (rank 1) below 0.9 (rank 2).
 *
 * Environment (dev time): MINDRIAN_BRAIN_URL (the Brain), MINDRIAN_BRAIN_SHAPE
 * is set by this script per run, MINDRIAN_JEV_ENDPOINT (an offline test seam;
 * default scripts/jev-devtime-client.cjs DEFAULT_ENDPOINT).
 *
 * No em dash or en dash anywhere (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_NAME = 'part8-shape-acceptance';
const QUESTION_MAX = 240;
const ROW_LIST_MAX = 600;
const JEV_TIMEOUT_MS = 30000;

const EXIT_OK = 0;
const EXIT_LOST = 1;
const EXIT_OUT_INSIDE_REPO = 2;
const EXIT_SKIP = 77;

// ---------------------------------------------------------------------------
// argv: a switch-case router (the gsd-tools.cjs pattern; no Commander).
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { question: null, room: null, out: null, humanVerdict: null, help: false, errors: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--question':
        out.question = argv[i + 1]; i += 1; break;
      case '--room':
        out.room = argv[i + 1]; i += 1; break;
      case '--out':
        out.out = argv[i + 1]; i += 1; break;
      case '--human-verdict':
        out.humanVerdict = argv[i + 1]; i += 1; break;
      case '--help':
      case '-h':
        out.help = true; break;
      default:
        out.errors.push('unknown argument: ' + a);
    }
  }
  return out;
}

function usage() {
  return 'usage: node scripts/part8-shape-acceptance.cjs --question "<generic question>" --room <roomDir> [--out <path outside the repo>] [--human-verdict a|b|same]';
}

function defaultOutPath(now) {
  const d = now || new Date();
  return path.join(os.homedir(), '.mindrian', 'part8-acceptance', d.toISOString().replace(/[:.]/g, '-') + '.json');
}

// True when outPath resolves inside the repository root (Part 8: live
// captures stay on the machine, never in the tree).
function isInsideRepo(outPath, repoRoot) {
  const root = realOrResolve(repoRoot || REPO_ROOT);
  const target = realOrResolve(outPath);
  return target === root || target.startsWith(root + path.sep);
}
function realOrResolve(p) {
  const abs = path.resolve(p);
  // Resolve the deepest existing ancestor so a not-yet-created file compares
  // by its real directory (symlinked homes, temp folders).
  let probe = abs;
  const tail = [];
  while (!fs.existsSync(probe)) {
    tail.unshift(path.basename(probe));
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  let real = probe;
  try { real = fs.realpathSync(probe); } catch (_e) { real = probe; }
  return tail.length ? path.join(real, ...tail) : real;
}

// ---------------------------------------------------------------------------
// Recording proxy around fetch: request bodies (JSON-RPC) and response texts
// of every Brain call, tagged with the current run label. In process, never
// a second transport; brain-client resolves fetch at call time.
// ---------------------------------------------------------------------------
function installRecorder() {
  const original = globalThis.fetch;
  const records = [];
  let label = 'probe';
  globalThis.fetch = async function recordingFetch(url, init) {
    const rec = { run: label, url: String(url), request: null, status: null, response: null, error: null };
    try { rec.request = init && typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (_e) { rec.request = null; }
    records.push(rec);
    let res;
    try {
      res = await original(url, init);
    } catch (e) {
      rec.error = (e && e.name) || 'fetch_error';
      throw e;
    }
    rec.status = res.status;
    // Tee the body: brain-client reads it once through text(); keep a copy.
    const text = await res.text();
    rec.response = text;
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      text: async function () { return text; },
      arrayBuffer: async function () { return Buffer.from(text, 'utf8'); },
      json: async function () { return JSON.parse(text); },
    };
  };
  return {
    records: records,
    mark: function (l) { label = l; },
    restore: function () { globalThis.fetch = original; },
  };
}

// tools/call bodies of one run: [{name, arguments}].
function toolCallsOf(records, run) {
  return records
    .filter(function (r) { return r.run === run && r.request && r.request.method === 'tools/call' && r.request.params; })
    .map(function (r) { return { name: r.request.params.name, arguments: r.request.params.arguments || {} }; });
}

// The raw brain_ask reply payload of one run (the SSE data line's content text).
function rawAskReplyOf(records, run) {
  const rec = records.find(function (r) {
    return r.run === run && r.request && r.request.method === 'tools/call' && r.request.params && r.request.params.name === 'brain_ask';
  });
  if (!rec || typeof rec.response !== 'string') return null;
  try {
    const dataLine = rec.response.split('\n').find(function (l) { return l.startsWith('data: '); });
    const parsed = JSON.parse(dataLine ? dataLine.slice(6) : rec.response);
    const content = parsed && parsed.result && parsed.result.content && parsed.result.content[0];
    return content && typeof content.text === 'string' ? JSON.parse(content.text) : null;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Envelope summary: ids and enum values only (never a snippet).
// ---------------------------------------------------------------------------
function rowId(r) {
  return String(r && r.chapterId !== undefined ? r.chapterId : '?') + ':' + String(r && r.section !== undefined ? r.section : '?');
}

function summarizeEnvelope(env, rawReply) {
  const g = (env && env.grounding) || {};
  const options = (env && env.next_gate && Array.isArray(env.next_gate.options)) ? env.next_gate.options : [];
  const rawRows = rawReply && Array.isArray(rawReply.rows) ? rawReply.rows : [];
  const rows = (Array.isArray(g.rows) ? g.rows : rawRows).map(function (r, i) {
    const raw = rawRows[i];
    return {
      id: rowId(r),
      shape_match: raw && typeof raw.shape_match === 'boolean' ? raw.shape_match : null,
    };
  });
  return {
    problem_type: g.problem_type === undefined ? null : g.problem_type,
    problem_type_source: g.problem_type_source === undefined ? null : g.problem_type_source,
    rung_source: g.rung_source === undefined ? null : g.rung_source,
    shape_source: g.shape_source === undefined ? null : g.shape_source,
    lexicon_scope: g.lexicon_scope === undefined ? null : g.lexicon_scope,
    grounding_order: g.grounding_order === undefined ? null : g.grounding_order,
    rows: rows,
    rows_shape_match_count: rows.filter(function (r) { return r.shape_match === true; }).length,
    chain_coverage: g.chain_coverage && typeof g.chain_coverage === 'object' ? g.chain_coverage : null,
    coverage_label: g.coverage_label === undefined ? null : g.coverage_label,
    evidence: g.evidence && typeof g.evidence === 'object' ? g.evidence : null,
    chain_status: g.chain_status === undefined ? null : g.chain_status,
    option_order: g.option_order === undefined ? null : g.option_order,
    confidence_source: g.confidence_source === undefined ? null : g.confidence_source,
    options: options.map(function (o) {
      return { framework: o.framework, theo_rank: o.theo_rank, confidence: o.confidence };
    }),
  };
}

// ---------------------------------------------------------------------------
// The four comparisons. Pure. Each result is win | loss | same | no_lead |
// pass; the verdict loses when any criterion is loss.
// ---------------------------------------------------------------------------
function coverageIsFull(cc) {
  if (!cc || typeof cc !== 'object') return false;
  if (cc.full === true) return true;
  const total = cc.rank1_leads_total;
  const returned = cc.rank1_leads_returned;
  return Number.isFinite(total) && total > 0 && Number.isFinite(returned) && returned === total;
}

function orderConsistent(summary) {
  if (!summary || summary.option_order !== 'theo_rank') return false;
  const ranks = (summary.options || []).map(function (o) { return o.theo_rank; });
  if (ranks.length === 0) return false;
  for (let i = 1; i < ranks.length; i += 1) {
    if (!Number.isFinite(ranks[i]) || !Number.isFinite(ranks[i - 1])) return false;
    if (ranks[i] < ranks[i - 1]) return false;
  }
  return true;
}

function compare(bare, shaped) {
  const b = bare || {};
  const s = shaped || {};
  const out = {};

  out.problem_type_source = {
    bare: b.problem_type_source, shaped: s.problem_type_source,
    result: (b.problem_type_source === 'heuristic' && s.problem_type_source === 'signal') ? 'win' : 'loss',
  };

  out.grounding_order = {
    bare: b.grounding_order, shaped: s.grounding_order,
    bare_rows_shape_match: b.rows_shape_match_count || 0,
    shaped_rows_shape_match: s.rows_shape_match_count || 0,
    result: (b.grounding_order === 'lexical' && s.grounding_order === 'shape_boosted') ? 'win' : 'loss',
  };

  const sc = s.chain_coverage;
  let coverageResult;
  let coverageNote;
  if (sc && typeof sc === 'object' && sc.rank1_leads_total === 0) {
    coverageResult = 'no_lead';
    coverageNote = 'canon records no lead for this type';
  } else if (coverageIsFull(sc)) {
    coverageResult = coverageIsFull(b.chain_coverage) ? 'same' : 'win';
    coverageNote = coverageResult === 'same' ? 'both runs full' : 'the shaped run is full, the bare run is not';
  } else {
    coverageResult = 'loss';
    coverageNote = 'the shaped run is not full';
  }
  out.coverage = {
    bare: b.chain_coverage || null, shaped: sc || null,
    bare_label: b.coverage_label, shaped_label: s.coverage_label,
    result: coverageResult, note: coverageNote,
  };

  const bareOk = orderConsistent(b);
  const shapedOk = orderConsistent(s);
  out.ordering = {
    bare_consistent: bareOk, shaped_consistent: shapedOk,
    bare_ranks: (b.options || []).map(function (o) { return o.theo_rank; }),
    shaped_ranks: (s.options || []).map(function (o) { return o.theo_rank; }),
    result: (bareOk && shapedOk) ? 'pass' : 'loss',
  };

  const lost = Object.keys(out).filter(function (k) { return out[k].result === 'loss'; });
  return { criteria: out, lost: lost, exit_code: lost.length === 0 ? EXIT_OK : EXIT_LOST };
}

// ---------------------------------------------------------------------------
// The room lexicon against the captured bodies: every entry text absent,
// case-insensitive. Returns { ok, entries, hits } with counts only.
// ---------------------------------------------------------------------------
function lexiconCheck(entries, calls) {
  const bytes = JSON.stringify(calls).toLowerCase();
  let hits = 0;
  entries.forEach(function (t) { if (t && bytes.indexOf(t) !== -1) hits += 1; });
  return { ok: hits === 0, entries: entries.length, hits: hits };
}

// ---------------------------------------------------------------------------
// The Jev leg: one closed choice question over two row-id lists and two enum
// values. The profile is local to this script (one profile per builder, D-08
// of Phase 356); the guard refuses any other key.
// ---------------------------------------------------------------------------
const JEV_QUESTION_ID = 'better';
const JEV_CRITERIA = Object.freeze(['a', 'b', 'same']);
const JEV_PROFILE = Object.freeze({
  id: 'part8_shape_acceptance',
  kind: 'exact_state_v1',
  top_keys: Object.freeze(['model', 'state', 'questions']),
  model: 'jev-1.13.0',
  state_keys: Object.freeze(['problem_type', 'stage', 'a_rows', 'b_rows']),
  string_keys: Object.freeze(['problem_type', 'stage', 'a_rows', 'b_rows']),
  max_len_by_key: Object.freeze({ problem_type: 16, stage: 8, a_rows: ROW_LIST_MAX, b_rows: ROW_LIST_MAX }),
  question_ids: Object.freeze([JEV_QUESTION_ID]),
  question_keys: Object.freeze(['type', 'instructions', 'criteria']),
  question_type: 'choice',
  instructions_keys: Object.freeze(['question', 'rule']),
  criteria_keys: JEV_CRITERIA,
  question_max_len: 240,
});
const JEV_QUESTIONS = Object.freeze({
  better: Object.freeze({
    type: 'choice',
    instructions: Object.freeze({
      question: 'Which list of methodology row ids (`a_rows` or `b_rows`) better addresses `problem_type` at `stage`?',
      rule: 'Judge by the chapter and section labels only. Pick same when neither list is better.',
    }),
    criteria: Object.freeze({
      a: Object.freeze({ what: 'List a_rows addresses the problem type at the stage better' }),
      b: Object.freeze({ what: 'List b_rows addresses the problem type at the stage better' }),
      same: Object.freeze({ what: 'Neither list is better than the other' }),
    }),
  }),
});

function buildJevBody(shape, bareSummary, shapedSummary) {
  return {
    model: JEV_PROFILE.model,
    state: {
      problem_type: String(shape.problem_type),
      stage: String(shape.stage),
      a_rows: (bareSummary.rows || []).map(function (r) { return r.id; }).join(', ').slice(0, ROW_LIST_MAX),
      b_rows: (shapedSummary.rows || []).map(function (r) { return r.id; }).join(', ').slice(0, ROW_LIST_MAX),
    },
    questions: JSON.parse(JSON.stringify(JEV_QUESTIONS)),
  };
}

async function runJevLeg(client, schema, key, body, endpoint) {
  const guard = client.makeEgressGuard(JEV_PROFILE);
  const res = await client.jev(body, { key: key, guard: guard, endpoint: endpoint, timeoutMs: JEV_TIMEOUT_MS });
  const expected = {};
  expected[JEV_QUESTION_ID] = JEV_CRITERIA.slice();
  const parsed = schema.parseJevResponse(res, expected);
  if (!parsed.ok) return { ok: false, reason: parsed.reason, status: res.status, ms: res.ms };
  const answer = parsed.answers[JEV_QUESTION_ID];
  return {
    ok: true, model: parsed.model, ms: res.ms,
    choice: answer.choice, probabilities: answer.probabilities, confidence: answer.confidence,
    usage: parsed.usage,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function skipAndExit(reason, written) {
  console.log('SKIP ' + SCRIPT_NAME + ': ' + reason + (written ? ' (comparison written to ' + written + ')' : ''));
  process.exit(EXIT_SKIP);
}

function writeOut(outPath, report) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) { console.log(usage()); return EXIT_OK; }
  if (args.errors.length) { console.error(args.errors.join('\n') + '\n' + usage()); return EXIT_LOST; }
  if (typeof args.question !== 'string' || !args.question.trim() || args.question.length > QUESTION_MAX) {
    console.error('--question must be a non-empty generic question of at most ' + QUESTION_MAX + ' characters\n' + usage());
    return EXIT_LOST;
  }
  if (typeof args.room !== 'string' || !fs.existsSync(args.room) || !fs.statSync(args.room).isDirectory()) {
    console.error('--room must name an existing room directory\n' + usage());
    return EXIT_LOST;
  }
  if (args.humanVerdict !== null && JEV_CRITERIA.indexOf(args.humanVerdict) === -1) {
    console.error('--human-verdict must be one of ' + JEV_CRITERIA.join(', '));
    return EXIT_LOST;
  }
  const outPath = path.resolve(args.out || defaultOutPath());
  if (isInsideRepo(outPath, REPO_ROOT)) {
    console.error('refused: --out ' + outPath + ' is inside the repository; Part 8: live captures stay on the machine');
    return EXIT_OUT_INSIDE_REPO;
  }
  const roomDir = path.resolve(args.room);
  const question = args.question.trim();

  // The Jev key (environment or the secrets file under HOME); never printed.
  const jevClient = require(path.join(REPO_ROOT, 'scripts', 'jev-devtime-client.cjs'));
  const jevSchema = require(path.join(REPO_ROOT, 'scripts', 'jev-response-schema.cjs'));
  const key = jevClient.loadKey();
  const jevEndpoint = process.env.MINDRIAN_JEV_ENDPOINT || jevClient.DEFAULT_ENDPOINT;

  // The shape from the room through the one builder.
  const shapePacket = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-shape-packet.cjs'));
  const built = shapePacket.buildShapePacket({ roomDir: roomDir });
  if (!built || !built.shape) {
    console.error('the room gave no shape: ' + JSON.stringify(built && { ok: built.ok, reason: built.reason }));
    return EXIT_LOST;
  }
  const shape = built.shape;
  const valid = shapePacket.validateShapePacket(shape);
  if (!valid || valid.ok !== true) {
    console.error('the room shape does not validate: ' + JSON.stringify(valid));
    return EXIT_LOST;
  }

  // The room lexicon (texts lower-cased; counts only are reported).
  const lexiconMod = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'));
  const lex = lexiconMod.loadRoomLexicon(roomDir);
  const lexiconTexts = (lex && lex.ok && Array.isArray(lex.entries) ? lex.entries : [])
    .map(function (e) { return String(e.text || '').toLowerCase(); })
    .filter(function (t) { return t.length >= 3; });

  // Pin brain-client's lexicon check to --room; no session; then load it.
  process.env.CLAUDE_ACTIVE_ROOM = roomDir;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_BRAIN_SHAPE;
  const recorder = installRecorder();
  const brainClient = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs'));

  const report = {
    schema_version: 1,
    script: SCRIPT_NAME,
    generated: new Date().toISOString(),
    brain_url_host: safeHost(process.env.MINDRIAN_BRAIN_URL),
    question: question,
    room: path.basename(roomDir),
    shape: shape,
    probe: null,
    runs: {},
    captured: {},
    lexicon_check: null,
    comparisons: null,
    jev: { ran: false, reason: key ? null : 'TYPESAFE_API_KEY absent' },
    human_verdict: args.humanVerdict ? { verdict: args.humanVerdict, a_is: 'bare', b_is: 'shaped' } : { verdict: 'pending', note: 'the owner reads both row-id lists once and passes --human-verdict a|b|same' },
    verdict: null,
  };

  // Gate: the Brain must advertise the shape on both tools.
  recorder.mark('probe');
  if (brainClient._test && typeof brainClient._test._resetShapeProbe === 'function') brainClient._test._resetShapeProbe();
  const acceptsAsk = await brainClient.brainAcceptsShape('brain_ask');
  const acceptsChain = await brainClient.brainAcceptsShape('recommend_chain');
  const probeRecords = recorder.records.filter(function (r) { return r.run === 'probe'; });
  const reachable = probeRecords.some(function (r) { return typeof r.status === 'number' && r.status >= 200 && r.status < 300; });
  report.probe = { brain_ask_shape: acceptsAsk, recommend_chain_shape: acceptsChain, reachable: reachable, requests: probeRecords.length };
  if (!reachable) {
    writeOut(outPath, report);
    skipAndExit('the Brain is unreachable (no 2xx on the capability probe)', outPath);
  }
  if (!acceptsAsk || !acceptsChain) {
    writeOut(outPath, report);
    skipAndExit('the Brain does not advertise shape on brain_ask and recommend_chain (Theo Phase 48 not deployed)', outPath);
  }

  // Run 1: bare.
  recorder.mark('bare');
  process.env.MINDRIAN_BRAIN_SHAPE = '0';
  const bareEnv = await brainClient.ask(question);
  delete process.env.MINDRIAN_BRAIN_SHAPE;
  // Run 2: shaped (the caller-built packet is the room's; the probe is cached true).
  recorder.mark('shaped');
  const shapedEnv = await brainClient.ask(question, { shape: shape });
  recorder.restore();

  const bareCalls = toolCallsOf(recorder.records, 'bare');
  const shapedCalls = toolCallsOf(recorder.records, 'shaped');
  report.captured = { bare: bareCalls, shaped: shapedCalls };

  const refused = [bareEnv, shapedEnv].find(function (e) { return !e || e.error; });
  if (refused !== undefined) {
    report.verdict = { exit_code: EXIT_LOST, reason: !refused ? 'transport_null' : ('refused: ' + refused.error) };
    writeOut(outPath, report);
    console.log(SCRIPT_NAME + ': the question did not reach a composed envelope on both runs (' + report.verdict.reason + '); written to ' + outPath);
    return EXIT_LOST;
  }

  const bareSummary = summarizeEnvelope(bareEnv, rawAskReplyOf(recorder.records, 'bare'));
  const shapedSummary = summarizeEnvelope(shapedEnv, rawAskReplyOf(recorder.records, 'shaped'));
  report.runs = { bare: bareSummary, shaped: shapedSummary };

  // Part 8 belt: the body keys and the lexicon.
  const bareAsk = bareCalls.find(function (c) { return c.name === 'brain_ask'; });
  const shapedAsk = shapedCalls.find(function (c) { return c.name === 'brain_ask'; });
  report.wire = {
    bare_brain_ask_keys: bareAsk ? Object.keys(bareAsk.arguments).sort() : null,
    shaped_brain_ask_keys: shapedAsk ? Object.keys(shapedAsk.arguments).sort() : null,
  };
  report.lexicon_check = { bare: lexiconCheck(lexiconTexts, bareCalls), shaped: lexiconCheck(lexiconTexts, shapedCalls) };

  const cmp = compare(bareSummary, shapedSummary);
  report.comparisons = cmp.criteria;
  const lexiconLeak = !report.lexicon_check.bare.ok || !report.lexicon_check.shaped.ok;
  report.verdict = {
    exit_code: lexiconLeak ? EXIT_LOST : cmp.exit_code,
    lost: cmp.lost.slice(),
    lexicon_leak: lexiconLeak,
  };

  // The Jev leg (recorded; never changes the four-criteria verdict).
  if (key) {
    const body = buildJevBody(shape, bareSummary, shapedSummary);
    report.jev.body_state_keys = Object.keys(body.state).sort();
    try {
      const jr = await runJevLeg(jevClient, jevSchema, key, body, jevEndpoint);
      report.jev = Object.assign(report.jev, { ran: true, a_is: 'bare', b_is: 'shaped' }, jr);
    } catch (e) {
      report.jev = Object.assign(report.jev, { ran: false, reason: 'jev_error: ' + ((e && e.code) || (e && e.name) || 'error') });
    }
  }

  writeOut(outPath, report);

  // Compact report: keys and enum values only.
  console.log(SCRIPT_NAME + ': question through the plugin route twice; written to ' + outPath);
  console.log('  wire bare ' + JSON.stringify(report.wire.bare_brain_ask_keys) + '  shaped ' + JSON.stringify(report.wire.shaped_brain_ask_keys));
  console.log('  problem_type_source  bare ' + bareSummary.problem_type_source + '  shaped ' + shapedSummary.problem_type_source + '  -> ' + cmp.criteria.problem_type_source.result);
  console.log('  grounding_order      bare ' + bareSummary.grounding_order + '  shaped ' + shapedSummary.grounding_order + ' (shape_match rows ' + shapedSummary.rows_shape_match_count + ')  -> ' + cmp.criteria.grounding_order.result);
  console.log('  coverage             bare ' + bareSummary.coverage_label + '  shaped ' + shapedSummary.coverage_label + '  -> ' + cmp.criteria.coverage.result + ' (' + cmp.criteria.coverage.note + ')');
  console.log('  ordering             bare ' + JSON.stringify(cmp.criteria.ordering.bare_ranks) + '  shaped ' + JSON.stringify(cmp.criteria.ordering.shaped_ranks) + '  -> ' + cmp.criteria.ordering.result);
  console.log('  lexicon entries ' + lexiconTexts.length + '  hits bare ' + report.lexicon_check.bare.hits + '  shaped ' + report.lexicon_check.shaped.hits);
  console.log('  jev ' + (report.jev.ran ? ('choice ' + report.jev.choice + ' (a=bare, b=shaped) model ' + report.jev.model) : ('not run: ' + report.jev.reason)));
  console.log('  human verdict ' + report.human_verdict.verdict);
  console.log('  verdict exit ' + report.verdict.exit_code + (cmp.lost.length ? ' lost: ' + cmp.lost.join(', ') : ' (no criterion lost)') + (lexiconLeak ? ' LEXICON LEAK' : ''));

  if (!key) skipAndExit('TYPESAFE_API_KEY absent; the Jev leg did not run', outPath);
  return report.verdict.exit_code;
}

// The host of MINDRIAN_BRAIN_URL when set; otherwise the plugin default, whose
// single source is lib/core/brain-client.cjs (no origin literal here: the
// 339 origin single-source scan guards that).
function safeHost(url) {
  if (!url) return 'default_origin';
  try { return new URL(url).host; } catch (_e) { return null; }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) {
    process.exit(typeof code === 'number' ? code : EXIT_LOST);
  }).catch(function (e) {
    console.error(SCRIPT_NAME + ': ' + (e && e.message ? e.message : String(e)));
    process.exit(EXIT_LOST);
  });
}

module.exports = {
  EXIT_OK, EXIT_LOST, EXIT_OUT_INSIDE_REPO, EXIT_SKIP,
  JEV_PROFILE, JEV_QUESTIONS, JEV_CRITERIA, JEV_QUESTION_ID,
  parseArgs, isInsideRepo, defaultOutPath,
  summarizeEnvelope, compare, coverageIsFull, orderConsistent, lexiconCheck,
  buildJevBody, toolCallsOf, rawAskReplyOf, rowId,
};
