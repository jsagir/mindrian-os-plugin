#!/usr/bin/env node
'use strict';
/*
 * scripts/build-command-irreversibility-ledger.cjs -- Phase 356 Plan 07
 * (R356-01, R356-03, R356-07, R356-08).
 *
 * Dev-time builder: scores every registry command once with one Jev Noul
 * carrying the written irreversibility policy, and ships the result as
 * data (data/command-irreversibility-ledger.json). This file is the ONLY
 * scoring core for that ledger; it has no local fetch wrapper and no local
 * egress guard, it imports both from scripts/jev-devtime-client.cjs (R8).
 *
 * The dev-time key is read only here, from the environment or
 * ~/.secrets/typesafe.env, never printed, never logged, never written into
 * the ledger. No file under lib/ or hooks/ may require this script or
 * scripts/jev-devtime-client.cjs (the Phase 356 tripwire in
 * tests/test-353-tripwires.cjs leg 2 enforces this).
 *
 * Exit codes (this plan lands only the scoring core; a later 356 plan adds
 * a require.main CLI): 0 ok, 1 threshold or scoring failure, 2 refused
 * input, 3 no key, 4 appeal gate. Modes (--jev-fixture, --check, live) are
 * added by 356-09 and 356-10.
 *
 * This plan (356-07) lands the scoring core only: readPolicy, makeGuard,
 * buildPayload, parseNoulAnswer, makeFixtureFetch, scoreAll. Threshold
 * math, ledger assembly and the CLI land in 356-09; --check in 356-10.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const client = require('./jev-devtime-client.cjs');
const { commandTextHash, TEXT_HASH_BASIS } = require('../lib/core/irreversibility-ledger.cjs');
const { readRegistryRows, sha256Hex, LABEL_SOURCES } = require('./irreversibility-answer-key.cjs');

// D-20/D-21 (356-CONTEXT.md): the second blind labeler plus navigator
// arbitration adds two label_source values the D-05 LABEL_SOURCES list
// (frozen in irreversibility-answer-key.cjs) does not yet carry. The
// builder accepts both alongside the D-05 set rather than widening that
// module's own frozen list (this file only reads/validates label_source,
// it never writes an answer key).
const ALLOWED_LABEL_SOURCES = new Set(LABEL_SOURCES.concat(['two-model-blind-agreement', 'navigator-arbitrated']));

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// Single source of truth for the policy path: the material_step_ledger
// profile's own must_equal_file entry (never a second literal).
const POLICY_REL = client.EGRESS_PROFILES.material_step_ledger.must_equal_file.policy;

const DEFAULT_LABELS_PATH = path.join(DATA_DIR, 'jev-labels', 'command-irreversibility.json');
const DEFAULT_LEDGER_PATH = path.join(DATA_DIR, 'command-irreversibility-ledger.json');

const MODEL = 'jev-latest';
const QUESTION_ID = 'irreversible';
const QUESTION_TEXT = 'Under the policy in `policy`, does running the command named in `slug`, as described by `teaching` and `jtbd_summary`, take an effect the policy calls irreversible?';
const CONC = 4;
const VENDOR_USD_PER_INPUT_TOKEN = 42 / 1e9; // vendor-claimed, unverified (Spike 002, 355-BRIEF)

// ---------------------------------------------------------------------------
// readPolicy(root) -> { text, obj, hash, path }
// Reads data/jev-policies/command-irreversibility.json (relative to root) as
// UTF-8 text, hashes the raw bytes, and refuses (INPUT_REFUSED) unless the
// parsed object has the D-01-shaped policy fields.
// ---------------------------------------------------------------------------
function readPolicy(root) {
  const abs = path.join(root, POLICY_REL);
  const raw = fs.readFileSync(abs);
  const text = raw.toString('utf8');
  const hash = sha256Hex(raw);

  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    const err = new Error('readPolicy: ' + POLICY_REL + ' is not valid JSON: ' + e.message);
    err.code = 'INPUT_REFUSED';
    throw err;
  }

  const problems = [];
  if (typeof obj.policy_id !== 'string' || obj.policy_id.length === 0) {
    problems.push('policy_id must be a non-empty string');
  }
  if (typeof obj.version !== 'string' || obj.version.length === 0) {
    problems.push('version must be a non-empty string');
  }
  if (typeof obj.instructions !== 'string' || obj.instructions.length === 0) {
    problems.push('instructions must be a non-empty string');
  }
  const criteria = obj.criteria;
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)
    || typeof criteria.true !== 'string' || typeof criteria.false !== 'string') {
    problems.push('criteria must be a plain object with string true/false');
  }
  if (!Array.isArray(obj.boundary_cases) || obj.boundary_cases.length === 0
    || !obj.boundary_cases.every((s) => typeof s === 'string')) {
    problems.push('boundary_cases must be a non-empty array of strings');
  }
  if (problems.length > 0) {
    const err = new Error('readPolicy: ' + POLICY_REL + ' refused: ' + problems.join('; '));
    err.code = 'INPUT_REFUSED';
    throw err;
  }

  return { text: text, obj: obj, hash: hash, path: abs };
}

// ---------------------------------------------------------------------------
// makeGuard(root) -> guard(payload). Thin wrapper so every call site shares
// one profile reference (client.EGRESS_PROFILES.material_step_ledger).
// ---------------------------------------------------------------------------
function makeGuard(root) {
  return client.makeEgressGuard(client.EGRESS_PROFILES.material_step_ledger, { root: root });
}

// ---------------------------------------------------------------------------
// buildPayload(row, policy) -> the material_step_ledger request body for one
// registry row. row.teaching / row.jtbd_summary are expected already
// normalized to '' for a non-string source value (readRegistryRows does
// this); this function normalizes again defensively so a raw registry row
// (teaching: null) is still safe to pass in directly.
// ---------------------------------------------------------------------------
function buildPayload(row, policy) {
  const teaching = typeof row.teaching === 'string' ? row.teaching : '';
  const jtbdSummary = typeof row.jtbd_summary === 'string' ? row.jtbd_summary : '';
  const questions = {};
  questions[QUESTION_ID] = {
    type: 'noul',
    instructions: {
      question: QUESTION_TEXT,
      rule: policy.obj.instructions,
      boundary_cases: policy.obj.boundary_cases,
    },
    criteria: { true: policy.obj.criteria.true, false: policy.obj.criteria.false },
  };
  return {
    model: MODEL,
    state: {
      slug: row.command,
      teaching: teaching,
      jtbd_summary: jtbdSummary,
      policy: policy.text,
    },
    questions: questions,
  };
}

// ---------------------------------------------------------------------------
// parseNoulAnswer(json, command) -> the raw Noul number, stored exactly as
// returned (never rounded). Throws SCORE_FAILED naming the command on any
// shape other than { type: 'noul', noul: <finite number in [0,1]> }.
// ---------------------------------------------------------------------------
function parseNoulAnswer(json, command) {
  const answer = json && json.answers && json.answers[QUESTION_ID];
  const noul = answer && answer.noul;
  const ok = !!answer && answer.type === 'noul' && typeof noul === 'number'
    && Number.isFinite(noul) && noul >= 0 && noul <= 1;
  if (!ok) {
    const err = new Error('score: ' + command + ' returned a malformed noul answer');
    err.code = 'SCORE_FAILED';
    throw err;
  }
  return noul;
}

// ---------------------------------------------------------------------------
// makeFixtureFetch(fixture, sink) -> a fake fetchImpl that drives the REAL
// payload, guard and response-parsing path (unlike 353's fixture shortcut,
// RESEARCH Pitfall 9). Captures every outgoing { url, headers, body } into
// `sink` (an array) when provided, and answers from the SYNTHETIC per-
// command p values in `fixture` ({ model, default_p, p: { slug: p, ... } }).
// ---------------------------------------------------------------------------
function makeFixtureFetch(fixture, sink) {
  return async function fixtureFetch(url, init) {
    const body = JSON.parse(init.body);
    if (Array.isArray(sink)) {
      sink.push({ url: url, headers: init.headers, body: body });
    }
    const slug = body && body.state && body.state.slug;
    const hasSlug = fixture.p && Object.prototype.hasOwnProperty.call(fixture.p, slug);
    const p = hasSlug ? fixture.p[slug] : fixture.default_p;
    const answers = {};
    answers[QUESTION_ID] = { type: 'noul', noul: p };
    return {
      status: 200,
      text: async () => JSON.stringify({
        model: fixture.model,
        answers: answers,
        usage: { input_tokens: 1500, output_tokens: 5 },
      }),
    };
  };
}

// ---------------------------------------------------------------------------
// scoreAll(rows, policy, opts) -> { entries, usage }
// opts: { key, root, fetchImpl, sleepImpl, concurrency, buildPayloadImpl }
// Constructs the guard ONCE (makeGuard(opts.root || ROOT)), then sends one
// Noul per row through client.pool + client.jev (no local fetch, no local
// guard: every call is guarded and goes through the shared client, R8). A
// non-200 status, or a bad answer shape, ABORTS the build (SCORE_FAILED),
// never shipping a null entry.
// ---------------------------------------------------------------------------
async function scoreAll(rows, policy, opts) {
  const o = opts || {};
  const guard = makeGuard(o.root || ROOT);
  const buildPayloadImpl = o.buildPayloadImpl || buildPayload;
  const concurrency = o.concurrency || CONC;

  const models = new Set();
  let inputTokens = 0;
  let outputTokens = 0;

  const scored = await client.pool(rows, concurrency, async (row) => {
    const body = buildPayloadImpl(row, policy);
    const result = await client.jev(body, {
      key: o.key,
      guard: guard,
      fetchImpl: o.fetchImpl,
      sleepImpl: o.sleepImpl,
    });
    if (result.status !== 200 || !result.json) {
      const err = new Error('score: ' + row.command + ' HTTP ' + result.status);
      err.code = 'SCORE_FAILED';
      throw err;
    }
    const p = parseNoulAnswer(result.json, row.command);
    if (typeof result.json.model === 'string') models.add(result.json.model);
    const usage = result.json.usage;
    if (usage && typeof usage.input_tokens === 'number') inputTokens += usage.input_tokens;
    if (usage && typeof usage.output_tokens === 'number') outputTokens += usage.output_tokens;
    return {
      command: row.command,
      p_irreversible: p,
      text_hash: commandTextHash(row.command, row.teaching, row.jtbd_summary),
    };
  });

  const entries = scored.slice().sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0));
  const modelList = Array.from(models).sort();

  return {
    entries: entries,
    usage: {
      jev_calls: rows.length,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      jev_model: modelList.length <= 1 ? (modelList[0] || null) : modelList,
    },
  };
}

// ---------------------------------------------------------------------------
// 356-09 (R356-03, R356-04, D-14, D-15): the zero-miss threshold, the D-14
// appeal gate, input loading, ledger assembly and the CLI modes.
// ---------------------------------------------------------------------------

function _thresholdFail(message) {
  const err = new Error('computeThreshold: ' + message);
  err.code = 'THRESHOLD_FAIL';
  return err;
}

// ---------------------------------------------------------------------------
// computeThreshold(rows) -> { threshold, threshold_set_by, false_alarms,
// false_alarm_count, margin, labeled_irreversible }
// rows: [{ command, p, irreversible }]. D-15: T is the highest value at
// which every labeled-true row has p >= T (T = min over labeled-true p).
// Throws THRESHOLD_FAIL (never returns a partial result) naming the
// offending command(s) on any of: a non-boolean label, a non-finite p
// outside [0,1], zero labeled-true rows, T <= 0 (a labeled-true row scored
// 0), or a degenerate T that flags every row. Uses >= on stored values;
// never subtracts an epsilon, never re-rounds p or T.
// ---------------------------------------------------------------------------
function computeThreshold(rows) {
  for (const r of rows) {
    if (typeof r.irreversible !== 'boolean') {
      throw _thresholdFail(r.command + ' has a non-boolean label');
    }
    if (typeof r.p !== 'number' || !Number.isFinite(r.p) || r.p < 0 || r.p > 1) {
      throw _thresholdFail(r.command + ' has no finite p in [0,1]');
    }
  }

  const trueRows = rows.filter((r) => r.irreversible === true);
  if (trueRows.length === 0) {
    throw _thresholdFail('no row is labeled irreversible; nothing to calibrate against');
  }

  const T = Math.min.apply(null, trueRows.map((r) => r.p));
  const setBy = trueRows.filter((r) => r.p === T).map((r) => r.command).sort();

  if (!(T > 0)) {
    throw _thresholdFail('labeled-irreversible commands scored ' + T + ' (' + setBy.join(', ')
      + '); no non-degenerate threshold reaches zero misses');
  }
  if (rows.every((r) => r.p >= T)) {
    throw _thresholdFail('degenerate, T=' + T + ' flags every command');
  }

  const falseAlarms = rows.filter((r) => r.irreversible === false && r.p >= T)
    .map((r) => r.command).sort();
  const belowT = rows.filter((r) => r.irreversible === false && r.p < T).map((r) => r.p);
  const margin = belowT.length > 0 ? T - Math.max.apply(null, belowT) : null;

  return {
    threshold: T,
    threshold_set_by: setBy,
    false_alarms: falseAlarms,
    false_alarm_count: falseAlarms.length,
    margin: margin,
    labeled_irreversible: trueRows.length,
  };
}

// ---------------------------------------------------------------------------
// CHAIN_SUITE_FILES (names only, never read at build time -- D-14: the
// builder computes the chain-run set from the registry plus this declared
// list, not by parsing tests at build time). tests/test-356-ledger-build.cjs
// parses these at TEST time as a drift guard against CHAIN_SUITE_COMMANDS.
// ---------------------------------------------------------------------------
const CHAIN_SUITE_FILES = Object.freeze([
  'tests/test-larry-handoff-seam.cjs',
  'tests/test-chain-executor-fable-mode.cjs',
  'tests/test-chain-executor-gate.cjs',
  'tests/test-chain-executor-loop.cjs',
  'tests/test-chain-executor-part8-leak.cjs',
  'tests/test-chain-executor-verdict.cjs',
  'tests/test-bch-09-forced-material.cjs',
  'tests/test-act-on-runchain.cjs',
  'tests/test-pipeline-on-runchain.cjs',
  'tests/test-264-flagship-ralph.cjs',
  'tests/test-ignite-on-runchain.cjs',
  'tests/test-201-bounded-retry.cjs',
  'tests/test-354-chain-resume-identity.cjs',
]);

// ---------------------------------------------------------------------------
// CHAIN_SUITE_COMMANDS: every registry command one of the CHAIN_SUITE_FILES
// suites expects to auto-run as autonomous_safe (re-derived by reading each
// suite, not copied from the 356-CONTEXT.md seed unchecked). Commands the
// same suites use only to demonstrate a HALT (for example /mos:jtbd and
// /mos:business-model in tests/test-act-on-runchain.cjs, both
// autonomous_safe: false in the registry) are deliberately excluded: they
// are not chain-run commands, they are the suites' own gate fixtures.
// ---------------------------------------------------------------------------
const CHAIN_SUITE_COMMANDS = Object.freeze([
  '/mos:find-analogies', // tests/test-larry-handoff-seam.cjs
  '/mos:find-connections', // tests/test-larry-handoff-seam.cjs
  '/mos:lean-canvas', // tests/test-chain-executor-gate.cjs
  '/mos:explore-domains', // tests/test-bch-09-forced-material.cjs, tests/test-pipeline-on-runchain.cjs
  '/mos:grade', // tests/test-bch-09-forced-material.cjs
  '/mos:think-hats', // tests/test-act-on-runchain.cjs
  '/mos:scenario-plan', // tests/test-act-on-runchain.cjs
  '/mos:find-bottlenecks', // tests/test-264-flagship-ralph.cjs
]);

// ---------------------------------------------------------------------------
// _resolveChainNode(nodeStr, registry) -> string[] of registry command
// slugs. `command:<slug>` gives the slug directly; `framework:<name>` is
// stripped and looked up in framework_index; a bare name is looked up in
// framework_index directly. An unresolvable node resolves to [].
// ---------------------------------------------------------------------------
function _resolveChainNode(nodeStr, registry) {
  if (typeof nodeStr !== 'string' || nodeStr.length === 0) return [];
  const frameworkIndex = (registry && registry.framework_index) || {};
  if (nodeStr.indexOf('command:') === 0) {
    return [nodeStr.slice('command:'.length)];
  }
  if (nodeStr.indexOf('framework:') === 0) {
    const name = nodeStr.slice('framework:'.length);
    return Array.isArray(frameworkIndex[name]) ? frameworkIndex[name] : [];
  }
  return Array.isArray(frameworkIndex[nodeStr]) ? frameworkIndex[nodeStr] : [];
}

// ---------------------------------------------------------------------------
// chainRunCommands(registry) -> sorted unique slugs. For every
// curated_chains entry, resolves `from` and `to`, keeps only slugs present
// in registry.commands, and unions the result with CHAIN_SUITE_COMMANDS (a
// suite-declared command need not appear in curated_chains to count).
// ---------------------------------------------------------------------------
function chainRunCommands(registry) {
  const commandRows = (registry && Array.isArray(registry.commands)) ? registry.commands : [];
  const registryCommandSet = new Set(commandRows.map((c) => c.command));
  const chains = (registry && Array.isArray(registry.curated_chains)) ? registry.curated_chains : [];

  const out = new Set();
  for (const entry of chains) {
    const slugs = _resolveChainNode(entry.from, registry).concat(_resolveChainNode(entry.to, registry));
    for (const slug of slugs) {
      if (registryCommandSet.has(slug)) out.add(slug);
    }
  }
  for (const slug of CHAIN_SUITE_COMMANDS) out.add(slug);

  return Array.from(out).sort();
}

// ---------------------------------------------------------------------------
// appealGate({ falseAlarms, chainRun, appealRulings, pByCommand, threshold,
// labelsByCommand }) -> array of { command, p_irreversible, threshold,
// label: false, label_source, reason } for every false alarm that lands on
// a chain-run command and has no 'accept' ruling in appeal_rulings.
// ---------------------------------------------------------------------------
function appealGate(opts) {
  const o = opts || {};
  const falseAlarms = Array.isArray(o.falseAlarms) ? o.falseAlarms : [];
  const chainRunSet = (o.chainRun instanceof Set) ? o.chainRun : new Set(o.chainRun || []);
  const appealRulings = Array.isArray(o.appealRulings) ? o.appealRulings : [];
  const pByCommand = o.pByCommand || new Map();
  const labelsByCommand = o.labelsByCommand || new Map();
  const threshold = o.threshold;

  const acceptedSet = new Set(
    appealRulings.filter((r) => r && r.ruling === 'accept').map((r) => r.command)
  );

  const out = [];
  for (const command of falseAlarms) {
    if (!chainRunSet.has(command)) continue;
    if (acceptedSet.has(command)) continue;
    const label = labelsByCommand.get ? labelsByCommand.get(command) : labelsByCommand[command];
    const p = pByCommand.get ? pByCommand.get(command) : pByCommand[command];
    out.push({
      command: command,
      p_irreversible: p,
      threshold: threshold,
      label: false,
      label_source: label && label.label_source,
      reason: label && label.reason,
    });
  }
  return out;
}

function _inputRefused(message) {
  const err = new Error('loadInputs: refused: ' + message);
  err.code = 'INPUT_REFUSED';
  return err;
}

// ---------------------------------------------------------------------------
// loadInputs({ registryPath, labelsPath, root }) -> { registry, rows,
// registryHash, policy, labels, labelsHash, labelsByCommand }
// Refuses (INPUT_REFUSED, exit 2) naming everything wrong. A registry_hash
// mismatch recorded in the label file is a WARN (text edits do not change
// what a command does; set equality is the gate), never a refusal.
// ---------------------------------------------------------------------------
function loadInputs(opts) {
  const o = opts || {};
  const registryPath = o.registryPath;
  const labelsPath = o.labelsPath;
  const root = o.root;

  let registryRaw;
  try {
    registryRaw = fs.readFileSync(registryPath);
  } catch (e) {
    throw _inputRefused('registry not found or unreadable: ' + registryPath);
  }
  let registry;
  try {
    registry = JSON.parse(registryRaw.toString('utf8'));
  } catch (e) {
    throw _inputRefused('registry is not valid JSON: ' + registryPath + ' (' + e.message + ')');
  }
  const registryHash = sha256Hex(registryRaw);
  const rows = readRegistryRows(registryPath);

  const policy = readPolicy(root); // may itself throw INPUT_REFUSED

  let labelsRaw;
  try {
    labelsRaw = fs.readFileSync(labelsPath);
  } catch (e) {
    throw _inputRefused('answer key not found: ' + labelsPath
      + ' (the navigator has not landed the label file yet)');
  }
  let labels;
  try {
    labels = JSON.parse(labelsRaw.toString('utf8'));
  } catch (e) {
    throw _inputRefused('answer key is not valid JSON: ' + labelsPath + ' (' + e.message + ')');
  }
  const labelsHash = sha256Hex(labelsRaw);

  const problems = [];

  const registrySet = new Set(rows.map((r) => r.command));
  const labelRows = Array.isArray(labels.rows) ? labels.rows : [];
  const labelSet = new Set(labelRows.map((r) => r.command));
  const missing = Array.from(registrySet).filter((c) => !labelSet.has(c)).sort();
  const extra = Array.from(labelSet).filter((c) => !registrySet.has(c)).sort();
  if (missing.length > 0 || extra.length > 0) {
    problems.push('label command set differs from the registry (missing: ' + (missing.join(', ') || 'none')
      + '; extra: ' + (extra.join(', ') || 'none')
      + '); a new command needs a label before the next rebuild');
  }

  if (!labels.reviewed_by) problems.push('answer key is missing reviewed_by');
  if (!labels.reviewed_at) problems.push('answer key is missing reviewed_at');

  const labelsByCommand = new Map();
  for (const row of labelRows) {
    labelsByCommand.set(row.command, row);
    if (typeof row.irreversible !== 'boolean') {
      problems.push(row.command + ': irreversible must be boolean');
    }
    if (typeof row.reason !== 'string' || row.reason.trim().length === 0) {
      problems.push(row.command + ': reason must be a non-empty string');
    }
    if (typeof row.label_source !== 'string' || !ALLOWED_LABEL_SOURCES.has(row.label_source)) {
      problems.push(row.command + ': label_source "' + row.label_source + '" is not one of '
        + Array.from(ALLOWED_LABEL_SOURCES).sort().join(', '));
    }
  }

  const appealRulings = Array.isArray(labels.appeal_rulings) ? labels.appeal_rulings : [];
  for (const ruling of appealRulings) {
    const command = ruling && ruling.command;
    if (!command || !registrySet.has(command)) {
      problems.push('appeal_rulings entry names an unknown command: ' + command);
    }
    if (!ruling || (ruling.ruling !== 'relabel' && ruling.ruling !== 'accept')) {
      problems.push('appeal_rulings entry for ' + command + ' has an invalid ruling: ' + (ruling && ruling.ruling));
    }
  }

  if (problems.length > 0) {
    throw _inputRefused(problems.join('; '));
  }

  if (typeof labels.registry_hash === 'string' && labels.registry_hash.length > 0
    && labels.registry_hash !== registryHash) {
    console.warn('build-command-irreversibility-ledger: WARN: answer key registry_hash does not match '
      + 'the current registry (text edits do not change what a command does; set equality is the gate)');
  }

  return {
    registry: registry,
    rows: rows,
    registryHash: registryHash,
    policy: policy,
    labels: labels,
    labelsHash: labelsHash,
    labelsByCommand: labelsByCommand,
  };
}

// ---------------------------------------------------------------------------
// assembleLedger({ scored, thresholdResult, inputs, mode, usage, builtAt,
// rawMeta, acceptedChainRun }) -> the ledger object (context field order).
// entries[i].flag = entries[i].p_irreversible >= threshold.
// ---------------------------------------------------------------------------
function assembleLedger(opts) {
  const o = opts || {};
  const scored = o.scored || [];
  const t = o.thresholdResult;
  const inputs = o.inputs;
  const usage = o.usage || {};
  const rawMeta = o.rawMeta || {};
  const acceptedChainRun = o.acceptedChainRun || [];
  const inputTokens = usage.input_tokens || 0;

  const entries = scored.slice()
    .sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0))
    .map((e) => ({
      command: e.command,
      p_irreversible: e.p_irreversible,
      flag: e.p_irreversible >= t.threshold,
      text_hash: e.text_hash,
    }));

  return {
    schema: 'command-irreversibility-ledger/v1',
    built_at: o.builtAt,
    build_mode: o.mode,
    built_from_raw: !!rawMeta.built_from_raw,
    raw_scored_at: rawMeta.raw_scored_at || null,
    jev_model: (usage.jev_model === undefined) ? null : usage.jev_model,
    policy_hash: inputs.policy.hash,
    answer_key_hash: inputs.labelsHash,
    registry_hash: inputs.registryHash,
    text_hash_basis: TEXT_HASH_BASIS,
    threshold: t.threshold,
    threshold_set_by: t.threshold_set_by,
    margin: t.margin,
    labeled_irreversible: t.labeled_irreversible,
    false_alarm_count: t.false_alarm_count,
    false_alarms: t.false_alarms,
    chain_run_false_alarms_accepted: acceptedChainRun,
    jev_calls: usage.jev_calls || 0,
    input_tokens: inputTokens,
    output_tokens: usage.output_tokens || 0,
    estimated_cost_usd: inputTokens * VENDOR_USD_PER_INPUT_TOKEN,
    cost_basis: 'vendor-claimed rate, unverified',
    entries: entries,
  };
}

function serializeLedger(ledger) {
  return JSON.stringify(ledger, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// writeFileAtomic(target, text): writes a temp file in the same directory,
// then renames -- a failed or interrupted write never leaves a partial
// ledger at `target`.
// ---------------------------------------------------------------------------
function writeFileAtomic(target, text) {
  const dir = path.dirname(target);
  const tmp = path.join(dir, '.' + path.basename(target) + '.tmp-' + process.pid + '-' + Date.now());
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, target);
}

// ---------------------------------------------------------------------------
// runBuild(opts) -> { exitCode, ledger?, appeal?, error? }. Never calls
// process.exit itself. opts: { mode: 'live'|'fixture'|'from-raw', root,
// registryPath, labelsPath, out, rawOut, rawIn, fixturePath, env }.
// ---------------------------------------------------------------------------
async function runBuild(opts) {
  const o = opts || {};
  const mode = o.mode || 'live';
  const root = o.root || ROOT;
  const registryPath = o.registryPath || path.join(DATA_DIR, 'command-registry.json');
  const labelsPath = o.labelsPath || DEFAULT_LABELS_PATH;
  const out = o.out || DEFAULT_LEDGER_PATH;

  let inputs;
  try {
    inputs = loadInputs({ registryPath: registryPath, labelsPath: labelsPath, root: root });
  } catch (e) {
    if (e && e.code === 'INPUT_REFUSED') {
      const msg = 'build-command-irreversibility-ledger: refused: ' + e.message;
      console.error(msg);
      return { exitCode: 2, error: msg };
    }
    throw e;
  }

  const builtAt = new Date().toISOString();
  let scoredEntries;
  let usage;
  let buildMode;
  let rawMeta = { built_from_raw: false, raw_scored_at: null };

  if (mode === 'from-raw') {
    if (!o.rawIn) {
      const msg = 'build-command-irreversibility-ledger: refused: --from-raw requires a path';
      console.error(msg);
      return { exitCode: 2, error: msg };
    }
    let rawRaw;
    try {
      rawRaw = fs.readFileSync(o.rawIn, 'utf8');
    } catch (e) {
      const msg = 'build-command-irreversibility-ledger: refused: raw file not found: ' + o.rawIn;
      console.error(msg);
      return { exitCode: 2, error: msg };
    }
    let raw;
    try {
      raw = JSON.parse(rawRaw);
    } catch (e) {
      const msg = 'build-command-irreversibility-ledger: refused: raw file is not valid JSON: ' + o.rawIn;
      console.error(msg);
      return { exitCode: 2, error: msg };
    }

    if (raw.policy_hash !== inputs.policy.hash) {
      const msg = 'build-command-irreversibility-ledger: refused: --from-raw policy_hash mismatch '
        + '(the policy changed since scoring)';
      console.error(msg);
      return { exitCode: 2, error: msg };
    }

    const rawEntries = Array.isArray(raw.entries) ? raw.entries : [];
    const rawCommandSet = new Set(rawEntries.map((e) => e.command));
    const registryCommandSet = new Set(inputs.rows.map((r) => r.command));
    const rawMissing = Array.from(registryCommandSet).filter((c) => !rawCommandSet.has(c)).sort();
    const rawExtra = Array.from(rawCommandSet).filter((c) => !registryCommandSet.has(c)).sort();
    if (rawMissing.length > 0 || rawExtra.length > 0) {
      const msg = 'build-command-irreversibility-ledger: refused: --from-raw command set differs from '
        + 'the registry (missing: ' + (rawMissing.join(', ') || 'none') + '; extra: ' + (rawExtra.join(', ') || 'none') + ')';
      console.error(msg);
      return { exitCode: 2, error: msg };
    }

    const rowsByCommand = new Map(inputs.rows.map((r) => [r.command, r]));
    const staleCommands = [];
    for (const e of rawEntries) {
      const row = rowsByCommand.get(e.command);
      const currentHash = commandTextHash(e.command, row.teaching, row.jtbd_summary);
      if (currentHash !== e.text_hash) staleCommands.push(e.command);
    }
    if (staleCommands.length > 0) {
      const msg = 'build-command-irreversibility-ledger: refused: --from-raw text changed since scoring for: '
        + staleCommands.sort().join(', ');
      console.error(msg);
      return { exitCode: 2, error: msg };
    }

    scoredEntries = rawEntries.slice();
    usage = {
      jev_calls: (raw.usage && raw.usage.jev_calls) || 0,
      input_tokens: (raw.usage && raw.usage.input_tokens) || 0,
      output_tokens: (raw.usage && raw.usage.output_tokens) || 0,
      jev_model: raw.jev_model,
    };
    buildMode = raw.build_mode;
    rawMeta = { built_from_raw: true, raw_scored_at: raw.scored_at || null };
  } else {
    let key;
    let fetchImpl;
    if (mode === 'fixture') {
      if (!o.fixturePath) {
        const msg = 'build-command-irreversibility-ledger: refused: --jev-fixture requires a path';
        console.error(msg);
        return { exitCode: 2, error: msg };
      }
      key = 'fixture-no-key';
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const fixture = require(o.fixturePath);
      fetchImpl = makeFixtureFetch(fixture, []);
      buildMode = 'jev-fixture';
    } else {
      key = client.loadKey({ env: o.env, secretsPath: path.join(os.homedir(), '.secrets', 'typesafe.env') });
      if (!key) {
        const msg = 'build-command-irreversibility-ledger: no TYPESAFE_API_KEY '
          + '(checked the environment and ~/.secrets/typesafe.env). Writing nothing.';
        console.error(msg);
        return { exitCode: 3, error: msg };
      }
      buildMode = 'jev-live';
    }

    let scoreResult;
    try {
      scoreResult = await scoreAll(inputs.rows, inputs.policy, { key: key, root: root, fetchImpl: fetchImpl });
    } catch (e) {
      const msg = 'build-command-irreversibility-ledger: ' + (e && e.message ? e.message : String(e));
      console.error(msg);
      return { exitCode: 1, error: msg };
    }
    scoredEntries = scoreResult.entries;
    usage = scoreResult.usage;

    if (o.rawOut) {
      const rawObj = {
        schema: 'command-irreversibility-raw/v1',
        build_mode: buildMode,
        scored_at: builtAt,
        jev_model: (usage.jev_model === undefined) ? null : usage.jev_model,
        policy_hash: inputs.policy.hash,
        registry_hash: inputs.registryHash,
        entries: scoredEntries.slice(),
        usage: { jev_calls: usage.jev_calls, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
      };
      writeFileAtomic(o.rawOut, JSON.stringify(rawObj, null, 2) + '\n');
    }
  }

  const pByCommand = new Map(scoredEntries.map((e) => [e.command, e.p_irreversible]));
  const thresholdRows = inputs.rows.map((r) => {
    const label = inputs.labelsByCommand.get(r.command);
    return { command: r.command, p: pByCommand.get(r.command), irreversible: label ? label.irreversible : undefined };
  });

  let thresholdResult;
  try {
    thresholdResult = computeThreshold(thresholdRows);
  } catch (e) {
    if (e && e.code === 'THRESHOLD_FAIL') {
      const msg = 'build-command-irreversibility-ledger: threshold failure: ' + e.message;
      console.error(msg);
      return { exitCode: 1, error: msg };
    }
    throw e;
  }

  const chainRun = new Set(chainRunCommands(inputs.registry));
  const appealRulings = Array.isArray(inputs.labels.appeal_rulings) ? inputs.labels.appeal_rulings : [];
  const appeal = appealGate({
    falseAlarms: thresholdResult.false_alarms,
    chainRun: chainRun,
    appealRulings: appealRulings,
    pByCommand: pByCommand,
    threshold: thresholdResult.threshold,
    labelsByCommand: inputs.labelsByCommand,
  });

  if (appeal.length > 0) {
    const lines = appeal.map((a) => 'APPEAL: ' + a.command + ' p=' + a.p_irreversible + ' T=' + a.threshold
      + ' label=false (' + a.label_source + '): ' + a.reason);
    lines.push('APPEAL: rule on each: relabel (irreversible: true) or accept '
      + '(ship flagged; affected chain-test expectations updated in a follow-up)');
    const msg = lines.join('\n');
    console.error(msg);
    return { exitCode: 4, appeal: appeal, error: msg };
  }

  const acceptedSet = new Set(appealRulings.filter((r) => r && r.ruling === 'accept').map((r) => r.command));
  const acceptedChainRun = thresholdResult.false_alarms
    .filter((c) => chainRun.has(c) && acceptedSet.has(c))
    .sort();

  const ledger = assembleLedger({
    scored: scoredEntries,
    thresholdResult: thresholdResult,
    inputs: inputs,
    mode: buildMode,
    usage: usage,
    builtAt: builtAt,
    rawMeta: rawMeta,
    acceptedChainRun: acceptedChainRun,
  });

  const text = serializeLedger(ledger);
  writeFileAtomic(out, text);
  console.log('command-irreversibility-ledger: wrote ' + ledger.entries.length + ' entries, T=' + ledger.threshold
    + ', false alarms=' + ledger.false_alarm_count + ', mode=' + ledger.build_mode + ', model=' + ledger.jev_model);

  return { exitCode: 0, ledger: ledger };
}

// ---------------------------------------------------------------------------
// 356-10 (R356-06): runCheck({ ledgerPath, registryPath, root, labelsPath })
// -> { warnings: [{ code, detail }], summary }. Key-free and zero-network:
// every read is wrapped, this function never throws, and it never calls
// client.loadKey or client.jev. `summary` is only populated once the ledger
// and the registry both parse; every warning still surfaces regardless.
//
// LEDGER_MISSING / LEDGER_UNPARSEABLE skip the ledger-dependent checks
// (STALE, UNSCORED, REMOVED, POLICY_MISSING/POLICY_DRIFT,
// ANSWER_KEY_DRIFT, FLAG_INCONSISTENT, FALSE_ALARM_COUNT_MISMATCH,
// BUILD_MODE_FIXTURE) but LABELS_MISSING / LABEL_SET_MISMATCH (the label
// checks) still run, since neither needs the ledger.
// ---------------------------------------------------------------------------
function runCheck(opts) {
  const o = opts || {};
  const ledgerPath = o.ledgerPath || DEFAULT_LEDGER_PATH;
  const registryPath = o.registryPath || path.join(DATA_DIR, 'command-registry.json');
  const root = o.root || ROOT;
  const labelsPath = o.labelsPath || DEFAULT_LABELS_PATH;

  const warnings = [];

  // --- registry -----------------------------------------------------------
  let registryRows = [];
  let registryOk = false;
  try {
    registryRows = readRegistryRows(registryPath);
    registryOk = true;
  } catch (e) {
    warnings.push({ code: 'REGISTRY_MISSING', detail: registryPath + ': ' + ((e && e.message) || String(e)) });
  }
  const registrySet = new Set(registryRows.map((r) => r.command));

  // --- labels: raw bytes plus a permissive parse only, never loadInputs's
  // shape validation (that path is for the live build, not this report) ----
  let labelsRaw = null;
  let labelsObj = null;
  try {
    labelsRaw = fs.readFileSync(labelsPath);
    labelsObj = JSON.parse(labelsRaw.toString('utf8'));
  } catch (e) {
    warnings.push({ code: 'LABELS_MISSING', detail: labelsPath });
  }
  const labelRows = (labelsObj && Array.isArray(labelsObj.rows)) ? labelsObj.rows : [];
  const labelsByCommand = new Map(labelRows.map((r) => [r.command, r]));

  if (registryOk && labelsObj) {
    const labelSet = new Set(labelRows.map((r) => r.command));
    const missing = Array.from(registrySet).filter((c) => !labelSet.has(c)).sort();
    const extra = Array.from(labelSet).filter((c) => !registrySet.has(c)).sort();
    if (missing.length > 0 || extra.length > 0) {
      warnings.push({
        code: 'LABEL_SET_MISMATCH',
        detail: 'missing: ' + (missing.join(', ') || 'none') + '; extra: ' + (extra.join(', ') || 'none'),
      });
    }
  }

  // --- ledger ---------------------------------------------------------------
  let ledgerRaw = null;
  let ledger = null;
  try {
    ledgerRaw = fs.readFileSync(ledgerPath);
  } catch (e) {
    warnings.push({ code: 'LEDGER_MISSING', detail: ledgerPath });
  }
  if (ledgerRaw) {
    try {
      ledger = JSON.parse(ledgerRaw.toString('utf8'));
    } catch (e) {
      warnings.push({ code: 'LEDGER_UNPARSEABLE', detail: ledgerPath + ': ' + e.message });
    }
  }

  let summary = null;

  if (ledger && registryOk) {
    if (ledger.build_mode === 'jev-fixture') {
      warnings.push({ code: 'BUILD_MODE_FIXTURE', detail: 'built with --jev-fixture, not a real Jev score' });
    }

    const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
    const entryByCommand = new Map(entries.map((e) => [e.command, e]));

    for (const row of registryRows) {
      const entry = entryByCommand.get(row.command);
      if (!entry) {
        warnings.push({ code: 'UNSCORED', detail: row.command });
        continue;
      }
      const currentHash = commandTextHash(row.command, row.teaching, row.jtbd_summary);
      if (currentHash !== entry.text_hash) {
        warnings.push({ code: 'STALE', detail: row.command });
      }
    }

    for (const entry of entries) {
      if (!registrySet.has(entry.command)) {
        warnings.push({ code: 'REMOVED', detail: entry.command });
      }
    }

    // Policy drift: the same bytes readPolicy would hash, read directly
    // (never through readPolicy's shape validation -- a shape problem is
    // a live-build refusal, not this report's job).
    let policyRaw = null;
    try {
      policyRaw = fs.readFileSync(path.join(root, POLICY_REL));
    } catch (e) {
      warnings.push({ code: 'POLICY_MISSING', detail: POLICY_REL });
    }
    if (policyRaw) {
      const policyHash = sha256Hex(policyRaw);
      if (policyHash !== ledger.policy_hash) {
        warnings.push({ code: 'POLICY_DRIFT', detail: 'ledger policy_hash does not match the current policy bytes' });
      }
    }

    if (labelsRaw) {
      const labelsHash = sha256Hex(labelsRaw);
      if (labelsHash !== ledger.answer_key_hash) {
        warnings.push({
          code: 'ANSWER_KEY_DRIFT',
          detail: 'ledger answer_key_hash does not match the current answer-key bytes',
        });
      }

      let recount = 0;
      for (const entry of entries) {
        const expectedFlag = entry.p_irreversible >= ledger.threshold;
        if (entry.flag !== expectedFlag) {
          warnings.push({ code: 'FLAG_INCONSISTENT', detail: entry.command });
        }
        const label = labelsByCommand.get(entry.command);
        if (label && label.irreversible === false && entry.flag === true) recount += 1;
      }
      if (recount !== ledger.false_alarm_count) {
        warnings.push({
          code: 'FALSE_ALARM_COUNT_MISMATCH',
          detail: 'recount=' + recount + ' ledger=' + ledger.false_alarm_count,
        });
      }
    }

    summary = {
      entryCount: entries.length,
      threshold: ledger.threshold,
      buildMode: ledger.build_mode,
    };
  }

  return { warnings: warnings, summary: summary };
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function _getFlagValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  const val = argv[idx + 1];
  if (val === undefined || val.indexOf('--') === 0) return null;
  return val;
}

// ---------------------------------------------------------------------------
// 356-10: --check is the FIRST branch of main(). Key-free and zero-network
// (it never touches client.loadKey / client.jev); always prints its WARN
// lines then exits 0 (SPEC R6: never a release blocker).
// ---------------------------------------------------------------------------
function runCheckCli(argv) {
  const rootFlag = _getFlagValue(argv, '--root');
  const root = rootFlag ? path.resolve(rootFlag) : ROOT;

  const ledgerFlag = _getFlagValue(argv, '--ledger');
  const envLedger = process.env.MINDRIAN_IRREVERSIBILITY_LEDGER && process.env.MINDRIAN_IRREVERSIBILITY_LEDGER.trim();
  const ledgerPath = ledgerFlag ? path.resolve(ledgerFlag) : (envLedger || DEFAULT_LEDGER_PATH);

  const registryFlag = _getFlagValue(argv, '--registry');
  const envRegistry = process.env.MINDRIAN_COMMAND_REGISTRY && process.env.MINDRIAN_COMMAND_REGISTRY.trim();
  const registryPath = registryFlag
    ? path.resolve(registryFlag)
    : (envRegistry || path.join(DATA_DIR, 'command-registry.json'));

  const labelsFlag = _getFlagValue(argv, '--labels');
  const labelsPath = labelsFlag ? path.resolve(labelsFlag) : DEFAULT_LABELS_PATH;

  const result = runCheck({ ledgerPath: ledgerPath, registryPath: registryPath, root: root, labelsPath: labelsPath });

  for (const w of result.warnings) {
    console.log('WARN: ' + w.code + (w.detail ? ' ' + w.detail : ''));
  }

  if (result.warnings.length === 0 && result.summary) {
    console.log('command-irreversibility-ledger --check: OK (' + result.summary.entryCount + ' entries, T='
      + result.summary.threshold + ', mode=' + result.summary.buildMode + ')');
  } else if (result.warnings.length === 0) {
    console.log('command-irreversibility-ledger --check: OK (0 warnings)');
  } else {
    console.log('command-irreversibility-ledger --check: WARN ' + result.warnings.length);
  }

  process.exit(0);
}

function main(argv) {
  const args = argv || [];

  if (args.indexOf('--check') !== -1) {
    runCheckCli(args);
    return;
  }

  const jevFixture = _getFlagValue(args, '--jev-fixture');
  const fromRaw = _getFlagValue(args, '--from-raw');
  const rawOutFlag = _getFlagValue(args, '--raw-out');
  const outFlag = _getFlagValue(args, '--out');
  const rootFlag = _getFlagValue(args, '--root');
  const registryFlag = _getFlagValue(args, '--registry');
  const labelsFlag = _getFlagValue(args, '--labels');

  const root = rootFlag ? path.resolve(rootFlag) : ROOT;
  const out = outFlag ? path.resolve(outFlag) : DEFAULT_LEDGER_PATH;
  const envRegistry = process.env.MINDRIAN_COMMAND_REGISTRY && process.env.MINDRIAN_COMMAND_REGISTRY.trim();
  const registryPath = registryFlag
    ? path.resolve(registryFlag)
    : (envRegistry || path.join(DATA_DIR, 'command-registry.json'));
  const labelsPath = labelsFlag ? path.resolve(labelsFlag) : DEFAULT_LABELS_PATH;

  let mode = 'live';
  if (jevFixture) mode = 'fixture';
  if (fromRaw) mode = 'from-raw';

  runBuild({
    mode: mode,
    root: root,
    registryPath: registryPath,
    labelsPath: labelsPath,
    out: out,
    rawOut: rawOutFlag ? path.resolve(rawOutFlag) : null,
    rawIn: fromRaw ? path.resolve(fromRaw) : null,
    fixturePath: jevFixture ? path.resolve(jevFixture) : null,
    env: process.env,
  }).then((result) => {
    process.exit(result.exitCode);
  }).catch((e) => {
    console.error('build-command-irreversibility-ledger: unexpected error: ' + ((e && e.stack) || e));
    process.exit(1);
  });
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  ROOT,
  DATA_DIR,
  POLICY_REL,
  DEFAULT_LABELS_PATH,
  DEFAULT_LEDGER_PATH,
  MODEL,
  QUESTION_ID,
  QUESTION_TEXT,
  CONC,
  VENDOR_USD_PER_INPUT_TOKEN,
  TEXT_HASH_BASIS,
  readPolicy,
  makeGuard,
  buildPayload,
  parseNoulAnswer,
  makeFixtureFetch,
  scoreAll,
  computeThreshold,
  CHAIN_SUITE_FILES,
  CHAIN_SUITE_COMMANDS,
  chainRunCommands,
  appealGate,
  loadInputs,
  assembleLedger,
  serializeLedger,
  writeFileAtomic,
  runBuild,
  runCheck,
  main,
};
