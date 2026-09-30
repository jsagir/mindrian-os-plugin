#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 15 -- research-planner: the CLI door over the research
 * planner engine. /mos:research and the command doors call this script;
 * it holds no engine logic of its own. Every subcommand routes through
 * lib/core/research-planner/planner.cjs or a run module (quick, deep,
 * filing, evidence-rows, grants, structure).
 *
 * CANON PART 8 (Graph Boundary): the room's words never ride argv (argv shows
 * in process listings and shell history). Every input is a JSON FILE PATH.
 * The argv validator runs before any dispatch and accepts only known flags,
 * an existing .json file, a run id, a grant id, a lane id, an existing room
 * directory, an enum value or a short slug; anything else is refused with
 * exit 2 and {ok:false, reason:'free_text_argv_refused'} and the token is never
 * echoed. stdout is JSON the host reads locally. stderr carries a typed error
 * code only (never room prose, never a stack).
 *
 * Usage (every path below is a file or directory, never text):
 *   plan <question-set.json> --room <dir> [--mode quick|deep] [--scientific]
 *        [--diffusion] [--live-structure] [--section <slug>]
 *   planners --room <dir>
 *   grant propose --room <dir> [--terms <terms.json>]
 *   grant approve <grant.json> --room <dir> --approved-via cli [--terms <terms.json>]
 *   grant status --room <dir>
 *   grant revoke <grant_id> --room <dir>
 *   review approve <run_id> --room <dir> --approved-via cli
 *   revise <run_id> <edit.json> --room <dir>
 *   run-quick <run_id> --room <dir> [--rows <rows.json>]
 *   validate-rows <run_id> <rows.json> --room <dir>
 *   escalate <run_id> --room <dir>
 *   deep-next <run_id> --room <dir>
 *   deep-fetch <run_id> --room <dir>
 *   deep-record <run_id> <lane> <rows.json> --room <dir>
 *   deep-followups <run_id> <followups.json> --room <dir>
 *   deep-extend <run_id> <decision.json> --room <dir> [--approved-via cli]
 *   deep-counterevidence <run_id> --room <dir>
 *   deep-synthesize <run_id> --room <dir>
 *   basket <run_id> --room <dir>
 *   file-run <run_id> <selection.json> --room <dir> --approved-via cli
 *   pending --room <dir>
 *   status <run_id> --room <dir>
 *   next-framework <run_id> --room <dir>
 *
 * Exit codes: 0 ok, 2 refused (typed reason in the JSON), 1 internal error.
 * No em-dash or en-dash anywhere in this file.
 */

// Node prints an ExperimentalWarning to stderr when node:sqlite loads. stderr
// here is reserved for typed codes, so the default warning printer is removed
// before any module loads.
process.removeAllListeners('warning');

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');

const planner = require(path.join(RP, 'planner.cjs'));
const quick = require(path.join(RP, 'quick.cjs'));
const deep = require(path.join(RP, 'deep.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const structure = require(path.join(RP, 'structure.cjs'));

const RUN_ID_RE = planner.RUN_ID_RE;
const GRANT_ID_RE = planner.GRANT_ID_RE;
const LANE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// flag name -> value type ('bool' takes no value)
const FLAGS = Object.freeze({
  // SEED-103 eureka perspective flags: an integer cap, a timestamp tag, a judge enum.
  '--max': 'int',
  '--tag': 'tag',
  '--judge': 'judge',
  '--room': 'dir',
  '--mode': 'mode',
  '--scientific': 'bool',
  '--diffusion': 'bool',
  '--live-structure': 'bool',
  '--terms': 'json',
  '--rows': 'json',
  '--approved-via': 'via',
  '--section': 'slug',
});

// command -> positional types, allowed flags, required flags. A two-word
// command ('grant approve') is keyed by both words.
const COMMANDS = Object.freeze({
  'plan': { pos: ['json'], flags: ['--room', '--mode', '--scientific', '--diffusion', '--live-structure', '--section'], need: ['--room'] },
  'planners': { pos: [], flags: ['--room'], need: ['--room'] },
  'eureka-recall': { pos: [], flags: ['--room', '--max', '--tag', '--mode'], need: ['--room'] },
  'eureka-judge': { pos: [], flags: ['--room', '--tag', '--judge'], need: ['--room', '--tag'] },
  'grant propose': { pos: [], flags: ['--room', '--terms'], need: ['--room'] },
  'grant approve': { pos: ['json'], flags: ['--room', '--approved-via', '--terms'], need: ['--room', '--approved-via'] },
  'grant status': { pos: [], flags: ['--room'], need: ['--room'] },
  'grant revoke': { pos: ['grantid'], flags: ['--room'], need: ['--room'] },
  'review approve': { pos: ['runid'], flags: ['--room', '--approved-via'], need: ['--room', '--approved-via'] },
  'revise': { pos: ['runid', 'json'], flags: ['--room'], need: ['--room'] },
  'run-quick': { pos: ['runid'], flags: ['--room', '--rows'], need: ['--room'] },
  'validate-rows': { pos: ['runid', 'json'], flags: ['--room'], need: ['--room'] },
  'escalate': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'deep-next': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'deep-fetch': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'deep-record': { pos: ['runid', 'lane', 'json'], flags: ['--room'], need: ['--room'] },
  'deep-followups': { pos: ['runid', 'json'], flags: ['--room'], need: ['--room'] },
  'deep-extend': { pos: ['runid', 'json'], flags: ['--room', '--approved-via'], need: ['--room'] },
  'deep-counterevidence': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'deep-synthesize': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'basket': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'file-run': { pos: ['runid', 'json'], flags: ['--room', '--approved-via'], need: ['--room', '--approved-via'] },
  'pending': { pos: [], flags: ['--room'], need: ['--room'] },
  'status': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'next-framework': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
});
const TWO_WORD = Object.freeze({ grant: ['propose', 'approve', 'status', 'revoke'], review: ['approve'] });

function refuse(reason) { return { refuse: reason }; }
const FREE_TEXT = 'free_text_argv_refused';
// SEED-103: value shapes for the eureka perspective flags.
const INT_RE = /^[1-9][0-9]{0,3}$/;
const TAG_RE = /^[0-9TZ]{1,20}$/;

function isJsonFile(p) {
  if (typeof p !== 'string' || !/\.json$/i.test(p)) return false;
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}
function isDir(p) {
  if (typeof p !== 'string' || p.length === 0) return false;
  try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

function valueOk(type, v) {
  switch (type) {
    case 'dir': return isDir(v);
    case 'json': return isJsonFile(v);
    case 'mode': return v === 'quick' || v === 'deep';
    case 'via': return v === 'cli';
    case 'slug': return typeof v === 'string' && SLUG_RE.test(v);
    case 'int': return typeof v === 'string' && INT_RE.test(v);
    case 'tag': return typeof v === 'string' && TAG_RE.test(v);
    case 'judge': return v === 'none';
    default: return false;
  }
}

function positionalOk(type, v) {
  switch (type) {
    case 'json': return isJsonFile(v);
    case 'runid': return typeof v === 'string' && RUN_ID_RE.test(v);
    case 'grantid': return typeof v === 'string' && GRANT_ID_RE.test(v);
    case 'lane': return typeof v === 'string' && LANE_RE.test(v);
    default: return false;
  }
}

// parseArgv(argv) -> {cmd, pos[], flags{}} | {refuse}. Never echoes a token.
function parseArgv(argv) {
  if (argv.length === 0) return refuse('usage');
  let key = argv[0];
  let rest = argv.slice(1);
  if (Object.prototype.hasOwnProperty.call(TWO_WORD, key)) {
    if (rest.length === 0 || TWO_WORD[key].indexOf(rest[0]) === -1) return refuse(FREE_TEXT);
    key = key + ' ' + rest[0];
    rest = rest.slice(1);
  }
  if (!Object.prototype.hasOwnProperty.call(COMMANDS, key)) return refuse(FREE_TEXT);
  const spec = COMMANDS[key];
  const pos = [];
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (typeof tok === 'string' && tok.indexOf('--') === 0) {
      if (!Object.prototype.hasOwnProperty.call(FLAGS, tok) || spec.flags.indexOf(tok) === -1) return refuse(FREE_TEXT);
      if (Object.prototype.hasOwnProperty.call(flags, tok)) return refuse(FREE_TEXT);
      const type = FLAGS[tok];
      if (type === 'bool') { flags[tok] = true; continue; }
      i += 1;
      if (i >= rest.length || !valueOk(type, rest[i])) return refuse(FREE_TEXT);
      flags[tok] = rest[i];
      continue;
    }
    pos.push(tok);
  }
  if (pos.length > spec.pos.length) return refuse(FREE_TEXT);
  for (let j = 0; j < pos.length; j += 1) {
    if (!positionalOk(spec.pos[j], pos[j])) return refuse(FREE_TEXT);
  }
  if (pos.length < spec.pos.length) return refuse('missing_argument');
  for (let k = 0; k < spec.need.length; k += 1) {
    if (!Object.prototype.hasOwnProperty.call(flags, spec.need[k])) {
      return refuse(spec.need[k] === '--approved-via' ? 'approved_via_required' : 'room_required');
    }
  }
  return { cmd: key, pos: pos, flags: flags };
}

// -- output -------------------------------------------------------------------
function emit(obj, code) {
  process.stdout.write(JSON.stringify(obj) + '\n', function () { process.exit(code); });
}

function readInput(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return undefined; }
}

function listOf(v, key) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object' && Array.isArray(v[key])) return v[key];
  return null;
}

function refusedResult(r) {
  return r && (r.ok === false || r.status === 'refused');
}

// -- handlers -----------------------------------------------------------------
async function handle(cmd, pos, flags) {
  const room = flags['--room'] ? path.resolve(flags['--room']) : null;
  const via = flags['--approved-via'] || null;

  switch (cmd) {
    // SEED-103: the Eureka perspective, stages 01-03. No free text on argv:
    // the room is a path, the tag is a timestamp, the judge is an enum.
    case 'eureka-recall': {
      const eurekaRecall = require('../lib/core/research-planner/perspectives/eureka-recall.cjs');
      const budgets = {};
      if (flags['--max']) budgets.max_candidates = parseInt(flags['--max'], 10);
      const rec = eurekaRecall.runRecall(room, { budgets: budgets, tag: flags['--tag'] || undefined });
      const built = rec.candidates.length ? planner.buildPlan(room, rec.question_set, flags['--mode'] ? { mode: flags['--mode'] } : {}) : null;
      return {
        ok: true, run_tag: rec.tag, run_dir: rec.run_dir, counts: rec.counts, pairs_truncated: rec.pairs_truncated, couplings: rec.couplings,
        top: rec.candidates.slice(0, 10),
        plan: built ? { ok: built.ok !== false, run_id: built.run_id || null, status: built.status, errors: built.errors || [] } : null,
      };
    }
    case 'eureka-judge': {
      const eurekaJudge = require('../lib/core/research-planner/perspectives/eureka-judge.cjs');
      const res = await eurekaJudge.runJudge(room, flags['--tag'], { judge: 'none' });
      if (!res.ok) return { ok: false, reason: res.reason };
      return { ok: true, run_tag: res.tag, file: res.file, summary: res.summary };
    }
    case 'plan': {
      const qs = readInput(pos[0]);
      if (!qs || typeof qs !== 'object') return { ok: false, reason: 'bad_json' };
      const opts = {
        mode: flags['--mode'],
        navigatorToggle: flags['--scientific'] === true,
        diffusionToggle: flags['--diffusion'] === true,
        liveStructure: flags['--live-structure'] === true,
        section: flags['--section'],
      };
      const built = opts.liveStructure ? await planner.buildPlanLive(room, qs, opts) : planner.buildPlan(room, qs, opts);
      if (!built.ok) return { ok: false, reason: built.reason || 'plan_invalid', status: built.status || 'invalid', errors: built.errors || [] };
      const c = planner.cardFor(room, built.plan, {});
      return {
        ok: true,
        run_id: built.run_id,
        status: built.status,
        mode: built.mode,
        next: c.next,
        reason: c.reason || null,
        card: c.card,
        proposal: c.proposal || null,
        new_terms: c.new_terms || [],
        errors: built.errors,
        warnings: built.warnings,
        lenses_selected: built.lenses_selected,
        local_only_leaves: built.local_only_leaves,
        structure_source: built.structure_source,
        saved: built.saved,
      };
    }
    case 'planners': {
      const res = structure.plannersForRoom({ roomDir: room });
      return Object.assign({ ok: true }, res);
    }
    case 'grant propose': {
      const terms = flags['--terms'] ? listOf(readInput(flags['--terms']), 'terms') : [];
      if (terms === null) return { ok: false, reason: 'bad_json' };
      return planner.proposeGrant(room, { terms: terms });
    }
    case 'grant approve': {
      const proposal = readInput(pos[0]);
      if (!proposal || typeof proposal !== 'object') return { ok: false, reason: 'bad_json' };
      const terms = flags['--terms'] ? listOf(readInput(flags['--terms']), 'terms') : [];
      if (terms === null) return { ok: false, reason: 'bad_json' };
      return planner.approveStandingGrant(room, proposal, { approvedVia: via, terms: terms });
    }
    case 'grant status':
      return planner.grantStatus(room);
    case 'grant revoke': {
      const res = grants.revokeGrant(room, pos[0], {});
      return res.ok ? { ok: true, grant_id: pos[0], revoked_at: res.grant.revoked_at } : res;
    }
    case 'review approve':
      return planner.approvePlanReview(room, pos[0], { approvedVia: via });
    case 'revise': {
      const edit = readInput(pos[1]);
      if (!edit || typeof edit !== 'object') return { ok: false, reason: 'bad_json' };
      return planner.revisePlan(room, pos[0], edit, {});
    }
    case 'run-quick': {
      const loaded = planner.loadPlan(room, pos[0]);
      if (!loaded.ok) return loaded;
      const opts = {};
      if (flags['--rows']) {
        const rows = listOf(readInput(flags['--rows']), 'rows');
        if (rows === null) return { ok: false, reason: 'bad_json' };
        opts.rowsProvider = async function () { return rows; };
      }
      const res = await quick.runQuick(room, loaded.plan, opts);
      if (res.status === 'done') {
        return {
          ok: true,
          status: 'done',
          run_id: res.run.run_id,
          verdict: res.run.verdict,
          answer_line: res.run.answer_line,
          escalation_offer: res.run.escalation_offer,
          card: res.card,
          state_dir: res.state_dir,
        };
      }
      if (res.status === 'reask') {
        return { ok: true, status: 'reask', reason: res.reason, card: res.card, proposal: res.proposal, new_terms: res.new_terms };
      }
      return { ok: false, status: 'refused', reason: res.reason, errors: res.errors || [] };
    }
    case 'validate-rows': {
      const rows = readInput(pos[1]);
      if (rows === undefined) return { ok: false, reason: 'bad_json' };
      return planner.validateRowsFor(room, pos[0], rows);
    }
    case 'escalate':
      return planner.escalate(room, pos[0], {});
    case 'deep-next':
      return planner.deepNext(room, pos[0]);
    case 'deep-fetch': {
      const ready = planner.ensureDeepState(room, pos[0]);
      if (!ready.ok) return ready;
      return deep.fetchRound(room, pos[0], {});
    }
    case 'deep-record': {
      const rows = listOf(readInput(pos[2]), 'rows');
      if (rows === null) return { ok: false, reason: 'bad_json' };
      const st = deep.loadState(room, pos[0]);
      if (!st.ok) return st;
      const lane = pos[1];
      if (lane !== 'CE' && !Object.prototype.hasOwnProperty.call(st.state.lane_specs || {}, lane)) return { ok: false, reason: 'unknown_lane' };
      return deep.recordLaneRows(room, pos[0], lane, rows);
    }
    case 'deep-followups': {
      const followups = listOf(readInput(pos[1]), 'followups');
      if (followups === null) return { ok: false, reason: 'bad_json' };
      return deep.proposeFollowups(room, pos[0], followups);
    }
    case 'deep-extend': {
      const d = readInput(pos[1]);
      if (!d || typeof d !== 'object') return { ok: false, reason: 'bad_json' };
      if (d.decision === 'extend' && !via) return { ok: false, reason: 'approved_via_required' };
      return planner.applyExtend(room, pos[0], d.decision, { approvedVia: via });
    }
    case 'deep-counterevidence':
      return deep.runCounterevidence(room, pos[0], {});
    case 'deep-synthesize': {
      const res = deep.synthesize(room, pos[0]);
      if (!res.ok) return res;
      const run = res.run;
      return {
        ok: true,
        run_id: run.run_id,
        already: res.already === true,
        stop_reason: run.stop_reason,
        governing_status: run.governing_status,
        answer_line: run.answer_line,
        unresolved_branches: run.unresolved_branches,
        weakest_branch: run.weakest_branch || null,
        next_binding_constraint: run.next_binding_constraint || null,
        state_dir: res.state_dir,
      };
    }
    case 'basket':
      return planner.basketFor(room, pos[0]);
    case 'file-run': {
      const selection = readInput(pos[1]);
      if (!selection || typeof selection !== 'object') return { ok: false, reason: 'bad_json' };
      return planner.fileFromState(room, pos[0], selection, { approvedVia: via });
    }
    case 'pending': {
      const cards = planner.pendingCards(room);
      cards.forEach(function (c) { planner.markSurfaced(room, c.run_id); });
      return { ok: true, cards: cards };
    }
    case 'status':
      return planner.status(room, pos[0]);
    case 'next-framework': {
      const loaded = planner.loadPlan(room, pos[0]);
      if (!loaded.ok) return loaded;
      const ran = planner.loadRun(room, pos[0]);
      if (!ran.ok) return ran;
      return Object.assign({ ok: true }, planner.nextMove(room, ran.run, loaded.plan));
    }
    default:
      return { ok: false, reason: FREE_TEXT };
  }
}

async function main(argv) {
  const parsed = parseArgv(argv);
  if (parsed.refuse) return emit({ ok: false, reason: parsed.refuse }, 2);
  let result;
  try {
    result = await handle(parsed.cmd, parsed.pos, parsed.flags);
  } catch (_e) {
    process.stderr.write('internal_error\n');
    return emit({ ok: false, reason: 'internal_error' }, 1);
  }
  return emit(result, refusedResult(result) ? 2 : 0);
}

main(process.argv.slice(2));
