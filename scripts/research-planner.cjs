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
 *   perspective-recall --room <dir> --perspective <id> [--max <n>] [--tag <ts>] [--mode quick|deep] [--offline]
 *   perspective-judge --room <dir> --perspective <id> --tag <ts> [--judge none] [--offline]
 *        (ids: eureka, rs, hsi, whitespace, analogies, connections; the list is the
 *        perspective registry's, never free text)
 *   eureka-recall / eureka-judge: the same two with --perspective eureka fixed
 *   grant propose --room <dir> [--terms <terms.json>]
 *   grant approve <grant.json> --room <dir> --approved-via cli [--terms <terms.json>]
 *   grant status --room <dir>
 *   grant revoke <grant_id> --room <dir>
 *   review approve <run_id> --room <dir> --approved-via cli
 *   revise <run_id> <edit.json> --room <dir>
 *   run-quick <run_id> --room <dir> [--rows <rows.json>] [--offline]
 *   (--offline, Phase 366 plan 17: every egress line of the declared policy is off; recall and
 *    judge are offline already, run-quick answers plan only, not sent, and still exits 0)
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
 *   canon-release <run_id> --room <dir> --item canon_term:<12 hex> --approved-via cli
 *   canon-confirm <run_id> --room <dir> --item canon_translation:<12 hex> --approved-via cli
 *   (Phase 366 plan 11, D-13: the gated release of ONE room term to Theo, and the confirm of the
 *    proposed translation it may produce. The host asks the navigator first; --approved-via cli says
 *    the yes was heard. Only {raw: term} reaches Theo. Without MOS_366_LIVE=1 or a replay file
 *    (MOS_366_THEO_REPLAY) the release refuses live_not_enabled and sends nothing.)
 *   never-do add <entry.json> --room <dir> --approved-via cli
 *   never-do list --room <dir>
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
const roomConstraints = require(path.join(ROOT, 'lib', 'core', 'room-constraints.cjs'));
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
const perspectiveRegistry = require(path.join(RP, 'perspectives', 'index.cjs'));
const PERSPECTIVE_IDS = perspectiveRegistry.PERSPECTIVE_IDS;
const crypto = require('node:crypto');

const RUN_ID_RE = planner.RUN_ID_RE;
const GRANT_ID_RE = planner.GRANT_ID_RE;
const LANE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const CANON_ITEM_RE = /^canon_(term|translation):[0-9a-f]{12}$/;

// flag name -> value type ('bool' takes no value)
const FLAGS = Object.freeze({
  // SEED-103 eureka perspective flags: an integer cap, a timestamp tag, a judge enum.
  '--max': 'int',
  '--tag': 'tag',
  '--judge': 'judge',
  // Phase 366 plan 12 (D-07): one id from the perspective registry's frozen list.
  '--perspective': 'perspective',
  '--room': 'dir',
  '--mode': 'mode',
  '--scientific': 'bool',
  '--diffusion': 'bool',
  '--live-structure': 'bool',
  // Phase 366 plan 17 (ADR-E16): every egress line off. Valueless.
  '--offline': 'bool',
  '--terms': 'json',
  '--rows': 'json',
  '--approved-via': 'via',
  // Phase 366 plan 11: one canon release or confirm item id, a closed shape (never a term).
  '--item': 'canonitem',
  '--section': 'slug',
});

// command -> positional types, allowed flags, required flags. A two-word
// command ('grant approve') is keyed by both words.
const COMMANDS = Object.freeze({
  'plan': { pos: ['json'], flags: ['--room', '--mode', '--scientific', '--diffusion', '--live-structure', '--section'], need: ['--room'] },
  'planners': { pos: [], flags: ['--room'], need: ['--room'] },
  'eureka-recall': { pos: [], flags: ['--room', '--max', '--tag', '--mode'], need: ['--room'] },
  'eureka-judge': { pos: [], flags: ['--room', '--tag', '--judge'], need: ['--room', '--tag'] },
  'perspective-recall': { pos: [], flags: ['--room', '--perspective', '--max', '--tag', '--mode', '--offline'], need: ['--room', '--perspective'] },
  'perspective-judge': { pos: [], flags: ['--room', '--perspective', '--tag', '--judge', '--offline'], need: ['--room', '--perspective', '--tag'] },
  'grant propose': { pos: [], flags: ['--room', '--terms'], need: ['--room'] },
  'grant approve': { pos: ['json'], flags: ['--room', '--approved-via', '--terms'], need: ['--room', '--approved-via'] },
  'grant status': { pos: [], flags: ['--room'], need: ['--room'] },
  'grant revoke': { pos: ['grantid'], flags: ['--room'], need: ['--room'] },
  'review approve': { pos: ['runid'], flags: ['--room', '--approved-via'], need: ['--room', '--approved-via'] },
  'revise': { pos: ['runid', 'json'], flags: ['--room'], need: ['--room'] },
  'run-quick': { pos: ['runid'], flags: ['--room', '--rows', '--offline'], need: ['--room'] },
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
  'canon-release': { pos: ['runid'], flags: ['--room', '--item', '--approved-via'], need: ['--room', '--item', '--approved-via'] },
  'canon-confirm': { pos: ['runid'], flags: ['--room', '--item', '--approved-via'], need: ['--room', '--item', '--approved-via'] },
  // 365-14: --approved-via is NOT in `need` for never-do add: a missing one is
  // answered by the handler as approval_required (the writer's own reason).
  'never-do add': { pos: ['json'], flags: ['--room', '--approved-via'], need: ['--room'] },
  'never-do list': { pos: [], flags: ['--room'], need: ['--room'] },
  'pending': { pos: [], flags: ['--room'], need: ['--room'] },
  'status': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
  'next-framework': { pos: ['runid'], flags: ['--room'], need: ['--room'] },
});
const TWO_WORD = Object.freeze({ grant: ['propose', 'approve', 'status', 'revoke'], review: ['approve'], 'never-do': ['add', 'list'] });

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
    case 'canonitem': return typeof v === 'string' && CANON_ITEM_RE.test(v);
    case 'slug': return typeof v === 'string' && SLUG_RE.test(v);
    case 'int': return typeof v === 'string' && INT_RE.test(v);
    case 'tag': return typeof v === 'string' && TAG_RE.test(v);
    case 'judge': return v === 'none';
    case 'perspective': return typeof v === 'string' && PERSPECTIVE_IDS.indexOf(v) !== -1;
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
      if (spec.need[k] === '--approved-via') return refuse('approved_via_required');
      if (spec.need[k] === '--perspective') return refuse('perspective_required');
      if (spec.need[k] === '--item') return refuse('item_required');
      return refuse('room_required');
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

// approveNeverDoEntry(room, entry): mint the decision node the way planner.cjs
// mintDecision does, then write the entry with approved_via {surface:'cli',
// decision_node_id}. The node records the navigator's yes, so it stays when the
// writer then refuses (decision_recorded_but_not_written).
function approveNeverDoEntry(room, entry) {
  let db = null;
  try { db = navigation.openRoomDbForCaller(room); } catch (_e) { db = null; }
  if (!db) return { ok: false, reason: 'room_db_unavailable' };
  let nodeId;
  try {
    nodeId = navigation.REASONING_NODE_ID('decision', 'never-do-' + crypto.randomBytes(5).toString('hex'));
    const kind = typeof entry.kind === 'string' ? entry.kind : 'unknown';
    const value = typeof entry.value === 'string' ? entry.value.trim().slice(0, 200) : 'unnamed';
    const node = navigation.writeReasoningNode(db, {
      nodeId: nodeId,
      nodeType: 'decision',
      epistemicType: 'decision',
      text: 'Approved never-do entry ' + kind + ' ' + value + ' via cli.',
      sourcePath: 'never-do:' + nodeId,
      origin: 'research-planner',
    });
    if (!node || node.ok !== true) return { ok: false, reason: 'decision_node_failed' };
  } finally {
    try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* ignore */ }
  }
  const written = roomConstraints.writeNeverDoEntry(
    room,
    { kind: entry.kind, value: entry.value, why: entry.why },
    { approved_via: { surface: 'cli', decision_node_id: nodeId } }
  );
  if (!written.ok) return { ok: false, reason: written.reason, decision_node_id: nodeId, decision_recorded_but_not_written: true };
  if (written.duplicate) return { ok: true, duplicate: true, decision_node_id: nodeId };
  return { ok: true, decision_node_id: nodeId, entry: written.entry };
}

// -- handlers -----------------------------------------------------------------
// Phase 366 plan 12 (D-07): one handler pair over the perspective registry. The id
// reached here already passed valueOk('perspective'); getPerspective still answers
// null for a module that is not on disk, and that is a typed refusal.
function perspectiveRecall(room, id, flags) {
  const mod = perspectiveRegistry.getPerspective(id);
  if (!mod) return { ok: false, reason: 'perspective_unavailable' };
  const budgets = {};
  if (flags['--max']) budgets.max_candidates = parseInt(flags['--max'], 10);
  const rec = mod.runRecall(room, { budgets: budgets, tag: flags['--tag'] || undefined });
  const built = rec.candidates.length ? planner.buildPlan(room, rec.question_set, flags['--mode'] ? { mode: flags['--mode'] } : {}) : null;
  const out = {
    ok: true, perspective: id, run_tag: rec.tag, run_dir: rec.run_dir, counts: rec.counts, pairs_truncated: rec.pairs_truncated, couplings: rec.couplings,
    top: rec.candidates.slice(0, 10),
    plan: built ? { ok: built.ok !== false, run_id: built.run_id || null, status: built.status, errors: built.errors || [] } : null,
  };
  if (rec.statement_template !== undefined && rec.statement_template !== null) out.statement_template = rec.statement_template;
  // 366-17: recall reads the room only, so --offline changes nothing here; the flag is accepted and
  // recorded in the output header for one-flag-everywhere ergonomics
  if (flags['--offline'] === true) out.offline = true;
  return out;
}

async function perspectiveJudge(room, id, flags) {
  const mod = perspectiveRegistry.getPerspective(id);
  if (!mod) return { ok: false, reason: 'perspective_unavailable' };
  const eurekaJudge = require('../lib/core/research-planner/perspectives/eureka-judge.cjs');
  const res = await eurekaJudge.runJudge(room, flags['--tag'], { judge: 'none', module: mod });
  if (!res.ok) return { ok: false, reason: res.reason };
  const out = { ok: true, perspective: id, run_tag: res.tag, file: res.file, summary: res.summary };
  if (flags['--offline'] === true) out.offline = true;
  return out;
}

// -- Phase 366 plan 11: the canon release and confirm doors ---------------------
// canonTransport() -> { ok, deps } | { ok:false, reason }. The environment chooses the transport, never argv;
// canon-release.transportFromEnv is the one copy, shared with the MCP research_run basket (quick 261002-cud).
function canonTransport() {
  return require(path.join(RP, 'canon-release.cjs')).transportFromEnv(process.env);
}

async function canonDoor(cmd, room, runId, itemId) {
  const canonRelease = require(path.join(RP, 'canon-release.cjs'));
  const wantTerm = cmd === 'canon-release';
  if (wantTerm ? itemId.indexOf('canon_term:') !== 0 : itemId.indexOf('canon_translation:') !== 0) return { ok: false, reason: 'wrong_item_kind' };
  const loaded = planner.loadPlan(room, runId);
  if (!loaded.ok) return loaded;
  if (!wantTerm) return canonRelease.confirmTranslation(room, itemId, { approved_via: 'cli' });
  const ran = planner.loadRun(room, runId);
  if (!ran.ok) return ran;
  const item = canonRelease.offerItemsFor(room, ran.run, loaded.plan, {}).filter(function (i) { return i.id === itemId; })[0];
  if (!item) return { ok: false, reason: 'unknown_item' };
  const transport = canonTransport();
  if (!transport.ok) return transport;
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;
  return canonRelease.answerRelease(room, item, { sessionId: sessionId, deps: transport.deps });
}

async function handle(cmd, pos, flags) {
  const room = flags['--room'] ? path.resolve(flags['--room']) : null;
  const via = flags['--approved-via'] || null;

  switch (cmd) {
    // SEED-103: the Eureka perspective, stages 01-03. No free text on argv:
    // the room is a path, the tag is a timestamp, the judge is an enum.
    case 'perspective-recall': return perspectiveRecall(room, flags['--perspective'], flags);
    case 'perspective-judge': return perspectiveJudge(room, flags['--perspective'], flags);
    case 'eureka-recall': return perspectiveRecall(room, 'eureka', flags);
    case 'eureka-judge': return perspectiveJudge(room, 'eureka', flags);
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
      // 369.2 R02 (A5): a run-lifetime proposal is the approval of one planned run (the card the plan
      // step printed); only an explicit standing proposal (the grant propose door) takes the standing path.
      if (proposal.lifetime === 'run' && typeof proposal.run_id === 'string' && planner.RUN_ID_RE.test(proposal.run_id)) {
        return planner.approvePlanReview(room, proposal.run_id, { approvedVia: via });
      }
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
      if (flags['--offline'] === true) opts.offline = true;
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
          approval_line: res.approval_line,
          escalation_offer: res.run.escalation_offer,
          card: res.card,
          state_dir: res.state_dir,
        };
      }
      if (res.status === 'plan_only') {
        // 366-17: an off egress line is an honest answer, not a refusal: exit 0, nothing sent
        return { ok: true, status: 'plan_only', reason: res.reason, line: res.line, offline: res.offline, sent: false, run_id: res.run_id, answer_line: res.answer_line, card: res.card };
      }
      if (res.status === 'reask') {
        return { ok: true, status: 'reask', reason: res.reason, card: res.card, proposal: res.proposal, new_terms: res.new_terms };
      }
      const refusedOut = { ok: false, status: 'refused', reason: res.reason, errors: res.errors || [] };
      // SEED-104: the CLI door gives the same typed answer as the MCP door.
      ['reask_reason', 'plan_families', 'grant_families'].forEach(function (k) { if (res[k] !== undefined) refusedOut[k] = res[k]; });
      return refusedOut;
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
    case 'canon-release':
    case 'canon-confirm':
      return canonDoor(cmd, room, pos[0], flags['--item']);
    case 'never-do add': {
      // D-10: an entry lands only after the navigator's yes. Larry runs this door
      // after the AskUserQuestion yes and says so with --approved-via cli.
      if (via !== 'cli') return { ok: false, reason: 'approval_required' };
      const entry = readInput(pos[0]);
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { ok: false, reason: 'bad_json' };
      return approveNeverDoEntry(room, entry);
    }
    case 'never-do list': {
      const cur = roomConstraints.readNeverDo(room);
      if (!cur.ok) {
        return {
          ok: false,
          reason: 'malformed',
          fix: '.mindrian/never-do.json could not be read; fix or remove it. Until then every unattended step in this room stops.',
        };
      }
      return {
        ok: true,
        count: cur.entries.length,
        entries: cur.entries.map(function (e) { return { kind: e.kind, value: e.value, why: e.why }; }),
        note: roomConstraints.FLOOR_SENTENCE,
      };
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
