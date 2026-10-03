#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 364 Plan 09 -- scientific-roadmap: the ONE CLI door the
 * /mos:scientific-roadmap command body calls for every deterministic step of the
 * walk. The CLI holds no methodology logic of its own: the entry check and
 * resolver are sr-entry.cjs, the Theo reads are sr-steps.cjs, the stage machine,
 * question set and Stage B are sr-door.cjs, and filing is sr-filing.cjs.
 *
 * NV-2 (honest refusal): `start` runs the entry check and resolver BEFORE any
 * Theo read. An empty room routes to defining the WHAT with zero Theo calls. With
 * a WHAT, Theo's steps are read; when they are not authored the answer is the
 * exact text "Theo has not authored this step yet" with the /mos:research offer.
 * No step text is ever made up.
 * CANON PART 8 (Graph Boundary): navigator text arrives ONLY through JSON files
 * (--input, --selection), never argv text, and the CLI passes nothing from them
 * to Theo. Only sr-steps.cjs talks to Theo, with one generic framework handle and
 * the WellDefined enum.
 * CANON PART 9 (Memory Locality): `start`, `entry` and `steps` write nothing. The
 * run state is local scratch under <room>/.mindrian/scientific-roadmap/ (like
 * .mindrian/research-runs), confined to that folder. The room itself is written
 * only by `plan` (the F.6 review object the planner saves, the /mos:research
 * precedent) and by `file` after the navigator's approved selection.
 *
 * Subcommands:
 *   start --room <dir> [--from-hypothesis]
 *     Entry check, resolver, then Theo's steps and the coverage line. Prints
 *     {ok, next: 'define_what' | 'refused' | 'entry_gate', entry, card, ...}.
 *   entry --room <dir> [--from-hypothesis]
 *     The entry proposal only: {ok, entry, card}. No Theo, no network.
 *   steps
 *     {ok, theo, coverage, status}: Theo's steps as served, and coverage.
 *   stage --room <dir> --input <file> [--state <file>]
 *     An input with `confirm: {what_id, chosen_step}` creates the run state
 *     (--state is not read then; the printed state_path is authoritative).
 *     Any other input is a step outcome and needs --state.
 *   question-set --room <dir> --state <file>
 *   plan --room <dir> --state <file>
 *   basket --room <dir> --state <file>
 *   file --room <dir> --state <file> --selection <file>
 *
 * Path rules: --room must be an existing directory; --state must resolve inside
 * <room>/.mindrian/scientific-roadmap/ with a run-tag file name; --input and
 * --selection must be regular files of at most 262144 bytes holding a plain JSON
 * object. Exit codes: 0 ok and honest refusals, 2 usage, 1 internal.
 *
 * Switch-case router, no Commander or yargs. No em-dashes anywhere in this file.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RP = path.join(REPO_ROOT, 'lib', 'core', 'research-planner');

const SUBCOMMANDS = Object.freeze(['start', 'entry', 'steps', 'stage', 'question-set', 'plan', 'basket', 'file']);
const USAGE = 'usage: scientific-roadmap.cjs <' + SUBCOMMANDS.join('|') + '> ...';

const STATE_DIR_REL = path.join('.mindrian', 'scientific-roadmap');
const STATE_NAME_RE = /^sr-\d{8}-[0-9a-f]{8}\.json$/;
const RUN_TAG_RE = /^sr-\d{8}-[0-9a-f]{8}$/;
const STATE_SCHEMA = 'mos.sr-door-state/1';
const MAX_INPUT_BYTES = 262144;
const MAX_STATE_BYTES = 4 * 1024 * 1024;
const THEO_STAGE_RE = /^sr:[1-7]$/;

// A usage problem: printed, exit 2.
function usageError(reason, detail) {
  const e = new Error(reason + (detail ? ': ' + detail : ''));
  e.usageReason = reason;
  e.usageDetail = detail || null;
  return e;
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// ---------------------------------------------------------------------------
// argv parsing: `--from-hypothesis` and `--json` are booleans; every other
// `--name` takes the next value; everything else is positional.
// ---------------------------------------------------------------------------
function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--from-hypothesis') {
      flags['from-hypothesis'] = true;
    } else if (a === '--json') {
      flags.json = true;
    } else if (typeof a === 'string' && a.indexOf('--') === 0) {
      flags[a.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      positional.push(a);
    }
  }
  return { flags: flags, positional: positional };
}

// ---------------------------------------------------------------------------
// path rules
// ---------------------------------------------------------------------------
function requireRoom(flags) {
  if (typeof flags.room !== 'string' || flags.room.length === 0) throw usageError('room_required', '--room <dir>');
  const abs = path.resolve(flags.room);
  let st = null;
  try { st = fs.statSync(abs); } catch (_e) { st = null; }
  if (!st || !st.isDirectory()) throw usageError('room_invalid', '--room must be an existing directory');
  return abs;
}

function resolveStatePath(room, raw) {
  if (typeof raw !== 'string' || raw.length === 0) throw usageError('state_required', '--state <file>');
  const abs = path.resolve(raw);
  const dir = path.join(room, STATE_DIR_REL);
  if (path.dirname(abs) !== dir || !STATE_NAME_RE.test(path.basename(abs))) throw usageError('state_path_invalid', 'the state file must be <room>/.mindrian/scientific-roadmap/sr-<yyyymmdd>-<8 hex>.json');
  // a symlinked folder or file must not lead out of the room
  try {
    if (fs.existsSync(dir)) {
      if (fs.realpathSync(dir) !== path.join(fs.realpathSync(room), STATE_DIR_REL)) throw usageError('state_path_invalid', 'the run folder resolves outside the room');
    }
    if (fs.existsSync(abs) && fs.lstatSync(abs).isSymbolicLink()) throw usageError('state_path_invalid', 'the state file is a symbolic link');
  } catch (e) {
    if (e && e.usageReason) throw e;
    throw usageError('state_path_invalid', 'the state path could not be verified');
  }
  return abs;
}

function readJsonObject(file, flagName, maxBytes) {
  if (typeof file !== 'string' || file.length === 0) throw usageError(flagName + '_required', '--' + flagName + ' <file>');
  const abs = path.resolve(file);
  let st = null;
  try { st = fs.statSync(abs); } catch (_e) { st = null; }
  if (!st || !st.isFile()) throw usageError(flagName + '_invalid', '--' + flagName + ' must be a regular file');
  if (st.size > maxBytes) throw usageError(flagName + '_too_large', 'at most ' + maxBytes + ' bytes');
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (_e) { throw usageError(flagName + '_invalid', 'not valid JSON'); }
  if (!isObj(parsed)) throw usageError(flagName + '_invalid', 'must be a JSON object');
  return parsed;
}

function loadState(room, flags) {
  const statePath = resolveStatePath(room, flags.state);
  const state = readJsonObject(statePath, 'state', MAX_STATE_BYTES);
  return { statePath: statePath, state: state };
}

// The state is local scratch: write a temp sibling, then rename.
function writeStateAtomic(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tmp = statePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, statePath);
}

function lazy(name) { return require(path.join(RP, name)); }

// ---------------------------------------------------------------------------
// what comes next, printed after every state-changing call
// ---------------------------------------------------------------------------
async function nextShape(room, statePath, state, extra) {
  const door = lazy('sr-door.cjs');
  const next = door.nextStage(state);
  const out = Object.assign({
    ok: true,
    state_path: statePath,
    run_tag: state.run_tag,
    next_stage: next,
    gate: next ? door.STAGE_GATES[next] : null,
  }, extra || {});
  if (next && THEO_STAGE_RE.test(next)) {
    const map = state.theo && isObj(state.theo.map) ? state.theo.map : {};
    const stepId = map[next];
    const row = Array.isArray(state.theo && state.theo.steps) ? state.theo.steps.filter(function (s) { return isObj(s) && s.stepId === stepId; })[0] : null;
    // The run state keeps only ids and labels; the step text is read from Theo as served, never remembered.
    const fresh = await lazy('sr-steps.cjs').readSrSteps({});
    const served = fresh.ok === true ? fresh.steps.filter(function (s) { return s.stepId === stepId; })[0] : null;
    out.step = { stepId: stepId || null, label: row && row.label !== undefined ? row.label : null, runIt: served && typeof served.runIt === 'string' ? served.runIt : null };
    if (!served) out.step.theo_reason = fresh.ok === true ? 'step_not_served' : fresh.reason;
  }
  if (next) {
    const bound = door.boundForStage(state, next);
    if (isObj(bound) && Object.keys(bound).length > 0) out.bound = bound;
  }
  return out;
}

// ---------------------------------------------------------------------------
// subcommands
// ---------------------------------------------------------------------------
function entryFor(room, flags) {
  const sr = lazy('sr-entry.cjs');
  const entry = sr.resolveEntry(room, { fromHypothesis: flags['from-hypothesis'] === true });
  return { entry: entry, card: sr.renderEntry(entry, { surface: 'cli' }) };
}

async function cmdStart(flags) {
  const room = requireRoom(flags);
  const e = entryFor(room, flags);
  const entry = e.entry;
  const present = isObj(entry.what) && entry.what.status === 'present';
  if (entry.route === 'define_what' || !present) {
    return { out: { ok: true, next: 'define_what', entry: entry, card: e.card } };
  }
  const steps = lazy('sr-steps.cjs');
  const stepRead = await steps.readSrSteps({});
  const coverage = await steps.readCoverage({});
  const status = steps.renderStatus({ steps: stepRead, coverage: coverage });
  if (stepRead.ok !== true) {
    const theo = { reason: stepRead.reason };
    if (stepRead.step_id !== undefined) theo.step_id = stepRead.step_id;
    if (stepRead.reason === 'step_unauthored') theo.message = steps.REFUSAL_TEXT;
    else if (typeof stepRead.message === 'string') theo.message = stepRead.message;
    if (stepRead.theo_code !== undefined) theo.theo_code = stepRead.theo_code;
    if (stepRead.kind !== undefined) theo.kind = stepRead.kind;
    return { out: { ok: true, next: 'refused', entry: entry, card: e.card, theo: theo, coverage: coverage, offer: '/mos:research', status: status } };
  }
  return {
    out: {
      ok: true,
      next: 'entry_gate',
      entry: entry,
      card: e.card,
      theo: { framework_status: stepRead.framework_status, steps: stepRead.steps.map(function (s) { return { stepId: s.stepId, label: s.label }; }) },
      coverage: coverage,
      status: status,
    },
  };
}

function cmdEntry(flags) {
  const room = requireRoom(flags);
  const e = entryFor(room, flags);
  return { out: { ok: true, entry: e.entry, card: e.card } };
}

async function cmdSteps() {
  const steps = lazy('sr-steps.cjs');
  const stepRead = await steps.readSrSteps({});
  const coverage = await steps.readCoverage({});
  return { out: { ok: stepRead.ok === true, theo: stepRead, coverage: coverage, status: steps.renderStatus({ steps: stepRead, coverage: coverage }) } };
}

async function cmdStage(flags) {
  const room = requireRoom(flags);
  const input = readJsonObject(flags.input, 'input', MAX_INPUT_BYTES);
  const door = lazy('sr-door.cjs');

  if (isObj(input.confirm)) {
    // The entry answer: nothing is trusted from the file but the choice. The
    // entry, Theo's steps and coverage are read again here.
    const c = input.confirm;
    const e = entryFor(room, flags);
    const entry = e.entry;
    const cands = isObj(entry.what) && Array.isArray(entry.what.candidates) ? entry.what.candidates : [];
    const pick = typeof c.what_id === 'string' ? cands.filter(function (x) { return x && x.id === c.what_id; })[0] : null;
    if (!pick) return { out: { ok: false, reason: 'what_unconfirmed' } };
    const steps = lazy('sr-steps.cjs');
    const stepRead = await steps.readSrSteps({});
    const coverage = await steps.readCoverage({});
    const created = door.createRun({ entry: entry, theo: stepRead, confirmedWhat: pick, chosenStep: c.chosen_step, coverage: coverage });
    if (!created.ok) return { out: Object.assign({}, created) };
    const tag = created.state.run_tag;
    if (!RUN_TAG_RE.test(String(tag))) throw new Error('run tag malformed');
    const statePath = path.join(room, STATE_DIR_REL, tag + '.json');
    writeStateAtomic(statePath, created.state);
    return { out: await nextShape(room, statePath, created.state) };
  }

  const loaded = loadState(room, flags);
  if (loaded.state.schema !== STATE_SCHEMA || !isObj(loaded.state.stages)) return { out: { ok: false, reason: 'state_invalid' } };
  const stage = typeof input.stage === 'string' && input.stage.length > 0 ? input.stage : door.nextStage(loaded.state);
  const outcome = {};
  ['decision', 'output', 'reason', 'status', 'stand_in', 'dismissed'].forEach(function (k) { if (input[k] !== undefined) outcome[k] = input[k]; });
  const res = door.recordStage(loaded.state, stage, outcome);
  if (!res.ok) return { out: { ok: false, reason: res.reason } };
  writeStateAtomic(loaded.statePath, res.state);
  return { out: await nextShape(room, loaded.statePath, res.state, res.paused === true ? { paused: true } : {}) };
}

function cmdQuestionSet(flags) {
  const room = requireRoom(flags);
  const loaded = loadState(room, flags);
  const door = lazy('sr-door.cjs');
  let settled = [];
  try { settled = lazy('perspective.cjs').loadSettled(room); } catch (_e) { settled = []; }
  const built = door.buildQuestionSet(loaded.state, { roomDir: room, settled: settled });
  return { out: built };
}

async function cmdPlan(flags) {
  const room = requireRoom(flags);
  const loaded = loadState(room, flags);
  const door = lazy('sr-door.cjs');
  const res = await door.stageB(room, loaded.state, {});
  if (!res.ok) return { out: { ok: false, reason: res.reason, errors: res.errors || [] } };
  // The ratchet output rides in the state so the filed plan can say what was settled, not re-argued.
  const next = res.state;
  next.settled_excluded = Array.isArray(res.settled_excluded) ? res.settled_excluded : [];
  writeStateAtomic(loaded.statePath, next);
  return {
    out: {
      ok: true,
      state_path: loaded.statePath,
      next_stage: door.nextStage(next),
      plan_ref: res.plan_ref,
      plan_status: res.plan_status,
      card: res.card,
      leaves: res.leaves,
      settled_excluded: res.settled_excluded,
      warnings: res.warnings,
      rubric: door.rubricLines(),
      handoff: '/mos:research',
    },
  };
}

function cmdBasket(flags) {
  const room = requireRoom(flags);
  const loaded = loadState(room, flags);
  const filing = lazy('sr-filing.cjs');
  const items = filing.buildPlanBasket(loaded.state);
  return { out: { ok: true, items: items, card: filing.planBasketCard(items) } };
}

function cmdFile(flags) {
  const room = requireRoom(flags);
  const selection = readJsonObject(flags.selection, 'selection', MAX_INPUT_BYTES);
  const loaded = loadState(room, flags);
  const filing = lazy('sr-filing.cjs');
  const res = filing.filePlan(room, loaded.state, selection, {});
  if (!res || res.ok !== true) return { out: Object.assign({ ok: false }, res || { reason: 'file_plan_failed' }) };
  // mark filing done in the state, once, in order
  const rs = lazy('sr-door.cjs').recordStage(loaded.state, 'filing', { decision: 'approve' });
  if (rs.ok) writeStateAtomic(loaded.statePath, rs.state);
  return {
    out: {
      ok: true,
      state_path: loaded.statePath,
      filing_recorded: rs.ok === true,
      landed: res.report.landed,
      not_landed: res.report.not_landed,
      report: res.report,
    },
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function show(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

async function main(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const sub = args[0];
  if (SUBCOMMANDS.indexOf(sub) === -1) {
    process.stderr.write(USAGE + '\n');
    show({ ok: false, reason: 'unknown_subcommand' });
    process.exitCode = 2;
    return;
  }
  const parsed = parseFlags(args.slice(1));
  const flags = parsed.flags;
  try {
    let result;
    switch (sub) {
      case 'start': result = await cmdStart(flags); break;
      case 'entry': result = cmdEntry(flags); break;
      case 'steps': result = await cmdSteps(); break;
      case 'stage': result = await cmdStage(flags); break;
      case 'question-set': result = cmdQuestionSet(flags); break;
      case 'plan': result = await cmdPlan(flags); break;
      case 'basket': result = cmdBasket(flags); break;
      case 'file': result = cmdFile(flags); break;
      default: result = { out: { ok: false, reason: 'unknown_subcommand' }, code: 2 }; break;
    }
    show(result.out);
    process.exitCode = typeof result.code === 'number' ? result.code : 0;
  } catch (e) {
    if (e && typeof e.usageReason === 'string') {
      process.stderr.write(e.usageReason + (e.usageDetail ? ': ' + e.usageDetail : '') + '\n');
      show({ ok: false, reason: e.usageReason, detail: e.usageDetail });
      process.exitCode = 2;
      return;
    }
    show({ ok: false, reason: 'internal', detail: String((e && e.message) || e).slice(0, 120) });
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { main: main, parseFlags: parseFlags, resolveStatePath: resolveStatePath };
