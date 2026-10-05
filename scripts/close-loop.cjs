#!/usr/bin/env node
'use strict';
/*
 * scripts/close-loop.cjs -- the ONE CLI door for the close-the-loop spine (quick 261006-0hl).
 *
 * WHY. /mos:bono and /mos:intel-pipeline both end by writing a run's claims, conclusion, knowns, unknowns,
 * killed claims, relations and opportunities into the room graph (lib/core/close-loop-writer.cjs, Phase 223-02),
 * and BONO offers the run's hats as reusable SyntheticExperts (lib/core/expert-library.cjs). Neither had a shell
 * entry point, so a governed run from a command surface could not close the loop. This script composes the
 * shipped modules and adds no new write path.
 *
 * Subcommands (switch-case router on argv[0]; exit 0 ok, 1 refusal or failure, 2 usage):
 *   close         --room <dir> --surface bono|intel-pipeline --payload <file.json> [--run-id <id>] [--session-id <id>]
 *   version-log   --room <dir> --topic <text>
 *   offer-experts --hats <file.json>
 *   file-expert   --room <dir> --spec <file.json> --session-id <id>
 *
 * Canon:
 *   Part 7  reuse before build: composes writeCloseLoop, supersession, expert-library, the navigation chokepoint.
 *   Part 8  local only: no network, no Brain call; writes only <room>/.mindrian/room.db (plus WAL and SHM) and
 *           <room>/opportunity-bank/ (the shipped writer's bank .md).
 *   Part 9  every node is born proposed; this file never confirms or promotes a node; a supersede runs only over
 *           a prior a human already confirmed, attributed to the room navigator from USER.md.
 *   Part 11 the door is named by the command docs (commands/bono.md, commands/intel-pipeline.md).
 *
 * Contract findings (measured while planning):
 *   1. The writer never looks up the prior; the door runs findPriorConclusion and sets priorConclusionId.
 *   2. A supersede needs a confirmed prior and a human byUser; the door binds the writer's supersedeFn seam to
 *      navigation.resolveByUser(room), never a flag.
 *   3. The writer writes claims before it validates the conclusion, so the ONE call runs inside
 *      navigation.withRoomTx and any failure rolls the whole close back (the bank .md cannot roll back and is listed).
 *   4. The door never requires the room-db module or a sqlite driver; it opens through the navigation
 *      chokepoint doors, which never create a room.db and avoid the bypass telemetry write outside the room.
 *   5. offerExpertsForFiling ranks by one sum (evidence tier rank / 4 + survival rate), not tier-then-survival.
 *   6. The run-all-223 DESENSITIZE leg is red today for an unrelated reason; this door does not touch it.
 */
const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../lib/core/navigation.cjs');
const closeLoop = require('../lib/core/close-loop-writer.cjs');
const supersession = require('../lib/core/temporal/supersession.cjs');
const expertLibrary = require('../lib/core/expert-library.cjs');
const { SYNTHETIC_EXPERT_FIELDS } = require('../lib/core/navigation/synthetic-expert.cjs');

const MAX_INPUT_BYTES = 1048576;
const SURFACES = Object.freeze(['bono', 'intel-pipeline']);
const REFUSAL_REASONS = Object.freeze([
  'room_not_found', 'room_db_missing', 'room_db_outside_room', 'room_db_open_failed', 'invalid_surface',
  'payload_too_large', 'payload_unreadable', 'payload_not_json', 'payload_not_object',
  'prior_conclusion_id_not_allowed', 'conclusion_topic_missing', 'prior_lookup_failed', 'run_id_reused',
  'close_failed', 'hats_too_large', 'hats_unreadable', 'hats_not_json', 'hats_not_array',
  'spec_too_large', 'spec_unreadable', 'spec_not_json', 'spec_not_object', 'forbidden_field',
  'session_id_conflict', 'invalid_hat', 'invalid_name', 'invalid_surname', 'expert_write_failed', 'internal_error',
]);

const USAGE = [
  'usage: node scripts/close-loop.cjs <subcommand> [flags]',
  '  close         --room <dir> --surface bono|intel-pipeline --payload <file.json> [--run-id <id>] [--session-id <id>]',
  '  version-log   --room <dir> --topic <text>',
  '  offer-experts --hats <file.json>',
  '  file-expert   --room <dir> --spec <file.json> --session-id <id>',
  '  --help, -h    print this text',
  'exit codes: 0 ok, 1 refusal or failure, 2 usage error',
].join('\n');

const FLAGS = {
  close: { allowed: ['room', 'surface', 'payload', 'run-id', 'session-id'], required: ['room', 'surface', 'payload'] },
  'version-log': { allowed: ['room', 'topic'], required: ['room', 'topic'] },
  'offer-experts': { allowed: ['hats'], required: ['hats'] },
  'file-expert': { allowed: ['room', 'spec', 'session-id'], required: ['room', 'spec', 'session-id'] },
};

// Sentinels. Refusal: a typed refusal (everything inside the transaction was rolled back, nothing was written).
// Rollback: the writer ran and reported a failure; it carries the writer summary.
class Refusal extends Error {
  constructor(reason, extra) {
    super(reason);
    this.reason = reason;
    this.extra = extra || {};
  }
}
class Rollback extends Error {
  constructor(summary) {
    super('close_failed');
    this.summary = summary;
  }
}
class UsageError extends Error {}

function isPlainObject(v) { return typeof v === 'object' && v !== null && !Array.isArray(v); }
function scalar(s, n) { return String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').slice(0, n || 120); }
function printJson(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }

function parseFlags(sub, argv) {
  const spec = FLAGS[sub];
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (typeof arg !== 'string' || !arg.startsWith('--')) throw new UsageError('unexpected argument: ' + scalar(arg, 60));
    const eqIdx = arg.indexOf('=');
    const name = eqIdx === -1 ? arg.slice(2) : arg.slice(2, eqIdx);
    if (!spec.allowed.includes(name)) throw new UsageError('unknown flag: --' + scalar(name, 40));
    let value;
    if (eqIdx !== -1) {
      value = arg.slice(eqIdx + 1);
    } else {
      value = argv[i + 1];
      if (typeof value !== 'string' || value.startsWith('--')) throw new UsageError('flag --' + name + ' needs a value');
      i += 1;
    }
    out[name] = value;
  }
  for (const req of spec.required) {
    if (typeof out[req] !== 'string' || out[req].length === 0) throw new UsageError('missing required flag --' + req);
  }
  return out;
}

// Room resolution: creates nothing on any refusal. Every later use passes the realpath.
function resolveRoom(value) {
  let real;
  try { real = fs.realpathSync(path.resolve(value)); } catch (_e) { throw new Refusal('room_not_found'); }
  let st;
  try { st = fs.statSync(real); } catch (_e) { throw new Refusal('room_not_found'); }
  if (!st.isDirectory()) throw new Refusal('room_not_found');
  const dbPath = path.join(real, '.mindrian', 'room.db');
  let dst;
  try { dst = fs.statSync(dbPath); } catch (_e) { throw new Refusal('room_db_missing'); }
  if (!dst.isFile()) throw new Refusal('room_db_missing');
  let dbReal;
  try { dbReal = fs.realpathSync(dbPath); } catch (_e) { throw new Refusal('room_db_missing'); }
  const rel = path.relative(real, dbReal);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Refusal('room_db_outside_room');
  return real;
}

// Input files (payload, hats, spec): size cap, one BOM stripped, JSON.parse in a try.
function readInput(file, kind) {
  let st;
  try { st = fs.statSync(path.resolve(file)); } catch (_e) { throw new Refusal(kind + '_unreadable'); }
  if (!st.isFile()) throw new Refusal(kind + '_unreadable');
  if (st.size > MAX_INPUT_BYTES) throw new Refusal(kind + '_too_large');
  let text;
  try { text = fs.readFileSync(path.resolve(file), 'utf8'); } catch (_e) { throw new Refusal(kind + '_unreadable'); }
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  try { return JSON.parse(text); } catch (e) { throw new Refusal(kind + '_not_json', { detail: scalar(e && e.message, 120) }); }
}

function nodeStatus(db, id) {
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  return row ? row.review_status : null;
}

// ---------------------------------------------------------------------------------------------------------------
// close
function cmdClose(f) {
  const real = resolveRoom(f.room);
  if (!SURFACES.includes(f.surface)) throw new Refusal('invalid_surface', { detail: scalar(f.surface, 40) });
  const payload = readInput(f.payload, 'payload');
  if (!isPlainObject(payload)) throw new Refusal('payload_not_object');
  if (Object.prototype.hasOwnProperty.call(payload, 'priorConclusionId')) throw new Refusal('prior_conclusion_id_not_allowed');
  const hasConclusion = isPlainObject(payload.conclusion);
  if (hasConclusion && !(typeof payload.conclusion.topic === 'string' && payload.conclusion.topic.length > 0)) {
    throw new Refusal('conclusion_topic_missing');
  }
  const surface = f.surface;
  const runId = f['run-id'] || ('close-' + surface + '-' + new Date().toISOString().replace(/[:.]/g, ''));
  const sessionId = f['session-id'] || null;

  const db = navigation.openRoomDbForCaller(real);
  if (!db) throw new Refusal('room_db_open_failed');
  let topicHash = null;
  let prior = null;
  let chain = { written: false, reason: 'no_conclusion' };
  let summary = null;
  try {
    navigation.withRoomTx(db, () => {
      let priorConclusionId = null;
      if (hasConclusion) {
        topicHash = closeLoop.topicHashOf(payload.conclusion.topic);
        const found = closeLoop.findPriorConclusion(db, topicHash);
        if (!found.ok && found.reason !== 'no_prior') throw new Refusal('prior_lookup_failed', { detail: scalar(found.reason, 40) });
        if (found.ok) {
          if (found.run_id === runId) throw new Refusal('run_id_reused', { detail: scalar(runId, 80) });
          const status = nodeStatus(db, found.node_id);
          prior = { node_id: found.node_id, run_id: found.run_id, review_status: status };
          if (status === 'confirmed') {
            priorConclusionId = found.node_id;
          } else {
            chain = { written: false, reason: 'prior_unconfirmed', prior_node_id: found.node_id, prior_review_status: status };
          }
        } else {
          chain = { written: false, reason: 'no_prior' };
        }
      }
      const writeOpts = {
        surface: surface,
        run_id: runId,
        // The seam the writer ships for this: attribute the supersede to the room navigator (USER.md), never 'system'.
        supersedeFn: (d, oldId, newId) => supersession.supersede(d, oldId, newId, { byUser: navigation.resolveByUser(real) }),
      };
      if (sessionId) writeOpts.sessionId = sessionId;
      summary = closeLoop.writeCloseLoop(
        db, real, Object.assign({}, payload, priorConclusionId ? { priorConclusionId: priorConclusionId } : {}), writeOpts
      );
      if (!summary.ok || (Array.isArray(summary.failures) && summary.failures.length > 0)) throw new Rollback(summary);
      if (priorConclusionId && summary.superseded && summary.superseded.ok) {
        chain = { written: true, superseded_node_id: priorConclusionId };
      }
    });
  } catch (e) {
    if (e instanceof Rollback) {
      const bank = (Array.isArray(e.summary.opportunity) ? e.summary.opportunity : []).map((o) => o && o.md_path).filter((p) => typeof p === 'string' && p.length > 0);
      printJson({
        ok: false, subcommand: 'close', reason: 'close_failed', rolled_back: true,
        failures: e.summary.failures, bank_md_written: bank, summary: e.summary,
        note: 'room.db unchanged; every id in summary was rolled back',
      });
      process.stderr.write('close-loop close: refused (close_failed): ' + e.summary.failures.length + ' failure(s)\n');
      return 1;
    }
    throw e;
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
  printJson({
    ok: true, subcommand: 'close', room: real, surface: surface, run_id: runId, session_id: sessionId,
    topic_hash: topicHash, prior: prior, chain: chain, summary: summary,
  });
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// version-log
function snippetOf(text) {
  const one = String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
  return one.length > 80 ? one.slice(0, 77) + '...' : one;
}
function isoOf(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return 'unknown';
  try { return new Date(ms).toISOString(); } catch (_e) { return 'unknown'; }
}
function cmdVersionLog(f) {
  const real = resolveRoom(f.room);
  const topic = f.topic;
  const db = navigation.openRoomDbReadOnlyForCaller(real);
  if (!db) throw new Refusal('room_db_open_failed');
  const lines = [];
  let code = 0;
  try {
    const topicHash = closeLoop.topicHashOf(topic);
    const newest = closeLoop.findPriorConclusion(db, topicHash);
    if (!newest.ok) {
      if (newest.reason !== 'no_prior') throw new Refusal('prior_lookup_failed', { detail: scalar(newest.reason, 40) });
      process.stdout.write('version-log: 0 conclusions on topic "' + topic + '"\n');
      return 0;
    }
    const walk = supersession.walkSupersedesChain(db, newest.node_id);
    const chain = Array.isArray(walk.chain) ? walk.chain : [];
    const onChain = new Set(chain.map((c) => c.node_id));
    const body = chain.map((c, i) => {
      const row = db.prepare('SELECT created_at, review_status, properties FROM nodes WHERE id = ?').get(c.node_id) || {};
      let props = {};
      try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
      return (i + 1) + '. ' + isoOf(row.created_at) + '  ' + (row.review_status || 'none') + '  ' + c.node_id + '  ' + snippetOf(props && props.text);
    });
    lines.push('version-log: ' + chain.length + ' conclusion(s) on topic "' + topic + '", newest first');
    for (const l of body) lines.push(l);
    if (!walk.ok) {
      lines.push('chain walk stopped: ' + scalar(walk.reason, 40));
      code = 1;
    }
    let offChain = 0;
    for (const r of db.prepare("SELECT id, properties FROM nodes WHERE type = 'claim'").all()) {
      let p = {};
      try { p = JSON.parse(r.properties || '{}'); } catch (_e) { continue; }
      if (isPlainObject(p) && p.kind === 'conclusion' && p.topic_hash === topicHash && !onChain.has(r.id)) offChain += 1;
    }
    if (offChain > 0) lines.push('off-chain: ' + offChain + ' conclusion(s) on this topic are not on the chain');
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
  process.stdout.write(lines.join('\n') + '\n');
  return code;
}

// ---------------------------------------------------------------------------------------------------------------
// offer-experts
function cmdOfferExperts(f) {
  const hats = readInput(f.hats, 'hats');
  if (!Array.isArray(hats)) throw new Refusal('hats_not_array');
  const candidates = expertLibrary.offerExpertsForFiling(hats);
  printJson({ ok: true, subcommand: 'offer-experts', count: candidates.length, candidates: candidates });
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// file-expert
function cmdFileExpert(f) {
  const real = resolveRoom(f.room);
  const spec = readInput(f.spec, 'spec');
  if (!isPlainObject(spec)) throw new Refusal('spec_not_object');
  const offending = Object.keys(spec).filter((k) => !SYNTHETIC_EXPERT_FIELDS.has(k));
  if (offending.length > 0) throw new Refusal('forbidden_field', { key: scalar(offending[0], 40), keys: offending.map((k) => scalar(k, 40)) });
  const sessionId = f['session-id'];
  if (spec.sessionId !== undefined && spec.sessionId !== sessionId) throw new Refusal('session_id_conflict');
  const db = navigation.openRoomDbForCaller(real);
  if (!db) throw new Refusal('room_db_open_failed');
  let res;
  let status = null;
  try {
    res = navigation.writeSyntheticExpertNode(db, Object.assign({}, spec, { sessionId: sessionId }));
    if (res && res.ok) status = nodeStatus(db, res.node_id);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
  if (!res || !res.ok) {
    const reason = res && res.reason;
    if (reason === 'forbidden_field') throw new Refusal('forbidden_field', { key: scalar(res.detail, 40) });
    if (reason === 'invalid_hat' || reason === 'invalid_name' || reason === 'invalid_surname') {
      throw new Refusal(reason, { detail: scalar(res.detail, 40) });
    }
    throw new Refusal('expert_write_failed', { detail: scalar(reason, 60) });
  }
  printJson({ ok: true, subcommand: 'file-expert', node_id: res.node_id, hat: res.hat, review_status: status, session_id: sessionId });
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
function refuse(sub, e) {
  const body = Object.assign({ ok: false, subcommand: sub, reason: e.reason }, e.extra);
  printJson(body);
  const tail = e.extra && (e.extra.key || e.extra.detail) ? ': ' + scalar(e.extra.key || e.extra.detail, 120) : '';
  process.stderr.write('close-loop ' + sub + ': refused (' + e.reason + ')' + tail + '\n');
  return 1;
}

function main(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const sub = args[0];
  if (sub === '--help' || sub === '-h') {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  if (!sub || !Object.prototype.hasOwnProperty.call(FLAGS, sub)) {
    process.stderr.write((sub ? 'close-loop: unknown subcommand: ' + scalar(sub, 40) + '\n' : 'close-loop: missing subcommand\n') + USAGE + '\n');
    return 2;
  }
  let flags;
  try {
    flags = parseFlags(sub, args.slice(1));
  } catch (e) {
    if (e instanceof UsageError) {
      process.stderr.write('close-loop ' + sub + ': ' + e.message + '\n' + USAGE + '\n');
      return 2;
    }
    throw e;
  }
  try {
    switch (sub) {
      case 'close': return cmdClose(flags);
      case 'version-log': return cmdVersionLog(flags);
      case 'offer-experts': return cmdOfferExperts(flags);
      case 'file-expert': return cmdFileExpert(flags);
      default: return 2;
    }
  } catch (e) {
    if (e instanceof Refusal) return refuse(sub, e);
    return refuse(sub, new Refusal('internal_error', { detail: scalar(e && e.message, 120) }));
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, REFUSAL_REASONS, MAX_INPUT_BYTES };
