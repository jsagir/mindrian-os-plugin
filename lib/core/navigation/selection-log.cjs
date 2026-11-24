'use strict';
// Phase 399-09 (I-09) -- the local decision-row writer.
//
// recordSelectionOutcome(db, args) turns one navigator decision (accept, defer or reject) into local rows:
//   - selection_observations: one row per shown option (or one decision-only row), holding the calibrated
//     probability of that option, the decision-time features, the decision, the overrule state and a label;
//   - calibration_observations: one labelled 'advisor_option' row per shown option that has a probability.
//
// Where it is called: lib/workflow/offer-closer.cjs closeOffer (CLI selector path) and lib/mcp/tools/gate.cjs
// gate_answer (MCP path, after the answer commits). Both call it through lib/core/navigation.cjs (the single
// SQL chokepoint, Canon Part 9), best effort, inside try/catch. This writer never throws.
//
// Design note: suggest_next is write-free (fence 5), so the shown shortlist is recomputed here, at the decision
// seam, from the static table with the same key. table_version ties each row to the table that made it.
// This module is one of the four allowed readers of shortlist.cjs (tests/test-399-one-selector-fence.cjs O1).
//
// Advisor off (MINDRIAN_DECISION_ADVISOR not "on"): rows are still written; calibrated_p, band, advisor_top
// and advisor_rank are null and overrule_by is 'none'. Probabilities live only in room.db and are never shown.
// MINDRIAN_SELECTION_LOG=off turns this writer off.
//
// Owner ruling (review WR-06, 2026-11-24): the log STAYS ON when the advisor is off. A navigator decision
// (accept, defer, reject, and whether the host overruled) is ground truth with or without the advisor, so
// the log does not wait for the advisor to be switched on. This is a persistent room-state change for every
// user: a room.db gains selection_observations and the ground_truth_label column the first time a decision is
// recorded. The release notes must say so, and MINDRIAN_SELECTION_LOG=off is the opt-out. To keep that cost
// small the schema is set up once per db handle (see ensureSchema), not once per call.
//
// Known gap (review WR-08): advisor_top is read from the shortlist without the commands already done in the
// nest (the MCP gate path does not know them), so overrule_by can report a host overrule against a command
// that was no longer eligible. The label columns are not affected.
//
// Canon Part 8: columns hold enums, registry command names, job ids and numbers only. A shown command that is
// not a registry command is skipped, a job id outside data/job-vocabulary.json is stored as null, a gate id is
// stored as a short hash. Nothing here reads user text, and nothing is written to the Brain.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const memoryOps = require('../memory-ops.cjs');
const calibrationLog = require('./calibration-log.cjs');
const shortlist = require('../decision-advisor/shortlist.cjs');

const DECISIONS = Object.freeze(['accept', 'defer', 'reject']);
const OVERRULE_BY = Object.freeze(['none', 'host', 'navigator', 'host_and_navigator']);
const SURFACES = Object.freeze(['cli', 'mcp']);
const MAX_TEXT = 80;
// Review WR-02: a call with no gate id and no dedupe key (the CLI closer) is a replay when an identical
// decision (surface, decision, offered and chosen command) was written this recently. A consumer retry or a
// re-rendered envelope answered twice lands inside the window; a navigator deciding the same thing twice
// does not. A caller that has a stable offer id passes dedupe_key instead and gets exact dedupe.
const REPLAY_WINDOW_MS = 5000;

const VOCAB_FILE = path.join(__dirname, '..', '..', '..', 'data', 'job-vocabulary.json');
let vocabCache = null;
function jobIds() {
  if (vocabCache) return vocabCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(VOCAB_FILE, 'utf8'));
    vocabCache = new Set(Array.isArray(parsed && parsed.ids) ? parsed.ids : []);
  } catch (_e) {
    vocabCache = new Set();
  }
  return vocabCache;
}
function cleanJob(id) {
  return typeof id === 'string' && jobIds().has(id) ? id : null;
}

function isRegistryCommand(cmd) {
  if (typeof cmd !== 'string' || cmd.length === 0 || cmd.length > MAX_TEXT) return false;
  try {
    return require('../../workflow/command-resolver.cjs').commandRow(cmd) !== null;
  } catch (_e) {
    return false;
  }
}

function shortText(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_TEXT ? v : null;
}

// Review WR-06: the two schema inits run DDL and PRAGMA work that takes the writer lock. They are idempotent,
// so one run per db handle is enough; a handle that is closed and reopened is a new object and runs them again.
// A failed init is not cached, so the next call tries again.
const schemaReady = new WeakSet();
function ensureSchema(db) {
  if (schemaReady.has(db)) return;
  memoryOps.initCalibrationSchema(db);
  memoryOps.initSelectionSchema(db);
  schemaReady.add(db);
}

function newId(prefix, nowMs) {
  return prefix + ':' + nowMs + ':' + crypto.randomBytes(4).toString('hex');
}

function gateKey(gateId) {
  if (typeof gateId !== 'string' || gateId.length === 0) return null;
  return 'g:' + crypto.createHash('sha256').update(gateId).digest('hex').slice(0, 24);
}

// Phase 400 CY-07: the room's cause and effect domain at decision time. An explicit args.causeEffect wins
// when it is a closed domain id (any other value gives null); without the arg, the stored problem.cause_effect
// of the same db is read through ./cause-effect.cjs (the one reader); else null. A closed label only (Part 8).
function readDomain(db, args) {
  if (Object.prototype.hasOwnProperty.call(args, 'causeEffect') && args.causeEffect !== undefined) {
    return shortlist.CAUSE_EFFECT_DOMAINS.indexOf(args.causeEffect) !== -1 ? args.causeEffect : null;
  }
  try {
    const stored = require('./cause-effect.cjs').readCauseEffect(db);
    return stored && shortlist.CAUSE_EFFECT_DOMAINS.indexOf(stored.domain) !== -1 ? stored.domain : null;
  } catch (_e) {
    return null;
  }
}

// The features known at decision time. Explicit args win; else the room job and axes are read (try/catch).
function readFeatures(db, args) {
  let job = null;
  if (Object.prototype.hasOwnProperty.call(args, 'jobId') && args.jobId !== undefined) {
    job = cleanJob(args.jobId);
  } else if (typeof args.roomDir === 'string' && args.roomDir.length > 0) {
    try {
      job = cleanJob(require('../../hmi/jtbd-state.cjs').resolveSelectionJob(args.roomDir, null).id);
    } catch (_e) { job = null; }
  }
  let level = typeof args.definitionLevel === 'string' ? args.definitionLevel : null;
  let wicked = args.wicked === true ? 1 : null;
  let cynefin = Number.isInteger(args.cynefinRating) ? args.cynefinRating : null;
  if (level === null && !Object.prototype.hasOwnProperty.call(args, 'definitionLevel') && typeof args.roomDir === 'string' && args.roomDir.length > 0) {
    try {
      const axes = require('../problem-axes.cjs').readRoomAxes(args.roomDir);
      level = axes.definition_level;
      wicked = axes.wickedness && axes.wickedness.wicked === true ? 1 : wicked;
      cynefin = axes.wickedness && Number.isInteger(axes.wickedness.cynefin_rating) ? axes.wickedness.cynefin_rating : cynefin;
    } catch (_e) { /* features stay null */ }
  }
  if (level !== null && shortlist.DEFINITION_LEVELS.indexOf(level) === -1) level = null;
  if (cynefin !== null && (cynefin < 0 || cynefin > 3)) cynefin = null;
  const last = isRegistryCommand(args.lastCommand) ? args.lastCommand : null;
  const domain = readDomain(db, args);
  return { job, level, wicked, cynefin, last, domain };
}

// 'host' when the first shown command is not the advisor top; 'navigator' when the navigator declined or
// chose past the first shown command; both when both hold. 'none' when the advisor made no top pick.
function overruleState(decision, shown, chosen, advisorTop) {
  if (!advisorTop || shown.length === 0) return 'none';
  const host = shown[0] !== advisorTop;
  const picked = chosen === null ? shown[0] : chosen;
  const navigator = decision === 'reject' || decision === 'defer' || (decision === 'accept' && picked !== shown[0]);
  if (host && navigator) return 'host_and_navigator';
  if (host) return 'host';
  if (navigator) return 'navigator';
  return 'none';
}

function labelFor(decision, shownCommand, index, chosen) {
  // Review WR-08: an accept whose chosen option is unknown labels nothing (null), never a guess.
  if (decision === 'accept') return chosen === null ? null : (shownCommand === chosen ? 1 : 0);
  if (decision === 'reject') return index === 0 ? 0 : null;
  return null;
}

/**
 * recordSelectionOutcome(db, args) -> { ok, decision_id, rows, overrule_by } | { ok: false, reason }
 *
 * @param {import('node:sqlite').DatabaseSync} db - caller-owned handle.
 * @param {object} args
 * @param {string} args.decision - 'accept' | 'defer' | 'reject' (else { ok: false, reason: 'invalid_decision' }).
 * @param {string} [args.surface] - 'cli' (default) | 'mcp'.
 * @param {string[]} [args.shown_commands] - the commands shown, in order; non-registry values are skipped.
 * @param {string|null} [args.chosen_command] - the command taken (accept). When absent or not a registry
 *   command, the single shown command stands in; with several shown, chosen stays null and no row is labelled.
 * @param {string} [args.jobId] - the job; else read from args.roomDir.
 * @param {string} [args.definitionLevel], [args.wicked], [args.cynefinRating], [args.lastCommand]
 * @param {string} [args.causeEffect] - the cause and effect domain (Phase 400); else the stored domain of db.
 *   cynefinRating stays written to cynefin_rating for one release (deprecated alias, Pitfall 5).
 * @param {string} [args.roomDir] - read the job and axes from the room when not given.
 * @param {string} [args.gate_id] - MCP gate id (stored as a hash); a second call with the same
 *   (surface, gate_id) writes nothing.
 * @param {string} [args.dedupe_key] - a stable offer id for a caller with no gate id (the CLI closer). Hashed
 *   into the same gate_id column, so the same (surface, key) dedupe and unique index apply. Without a gate id
 *   or a key, an identical decision written inside REPLAY_WINDOW_MS counts as a replay and writes nothing.
 */
function recordSelectionOutcome(db, args) {
  try {
    if (process.env.MINDRIAN_SELECTION_LOG === 'off') return { ok: false, reason: 'disabled' };
    if (!db || typeof db.prepare !== 'function') return { ok: false, reason: 'invalid_db' };
    const a = args && typeof args === 'object' ? args : {};
    if (DECISIONS.indexOf(a.decision) === -1) return { ok: false, reason: 'invalid_decision' };
    const decision = a.decision;
    const surface = SURFACES.indexOf(a.surface) !== -1 ? a.surface : 'cli';

    ensureSchema(db);

    const gate = gateKey(a.gate_id) || gateKey(a.dedupe_key);
    if (gate !== null) {
      const seen = db.prepare('SELECT 1 AS x FROM selection_observations WHERE surface = ? AND gate_id = ? LIMIT 1').get(surface, gate);
      if (seen) return { ok: true, deduped: true, rows: 0 };
    }

    const shown = [];
    for (const c of Array.isArray(a.shown_commands) ? a.shown_commands : []) {
      if (isRegistryCommand(c) && shown.indexOf(c) === -1) shown.push(c);
    }
    const chosen = isRegistryCommand(a.chosen_command) ? a.chosen_command : null;
    // Review WR-08 (owner ruling 2026-11-24): with no resolvable chosen option, shown[0] stands in only when
    // exactly one option was shown (then the accept can only be that option). With several options shown, the
    // chosen command is null and no row is labelled; a guess would put an invented label in a labelled column.
    const chosenForLabel = decision === 'accept' ? (chosen !== null ? chosen : (shown.length === 1 ? shown[0] : null)) : null;
    if (gate === null) {
      const recent = db.prepare(
        "SELECT 1 AS x FROM selection_observations WHERE gate_id IS NULL AND surface = ? AND decision = ? " +
        "AND COALESCE(offered_command, '') = ? AND COALESCE(chosen_command, '') = ? AND created_at >= ? LIMIT 1"
      ).get(surface, decision, shown.length ? shown[0] : '', decision === 'accept' && chosenForLabel !== null ? chosenForLabel : '', Date.now() - REPLAY_WINDOW_MS);
      if (recent) return { ok: true, deduped: true, rows: 0 };
    }

    const f = readFeatures(db, a);
    // Phase 400-10: the recomputed shortlist uses the same key as the consumers (job, level, domain, last), so
    // advisor_top and advisor_rank match what the domain-aware advisor showed. No domain gives the 399 shortlist.
    const q = { jobId: f.job, definitionLevel: f.level, causeEffect: f.domain, lastCommand: f.last };
    const sl = shortlist.lookupShortlist(q);
    // Null when no table produced an answer (advisor off, no job, no table): the row cites no table then.
    const tableVersion = shortText(sl.table_version);
    const usable = sl.state === shortlist.STATES.ok && sl.top_tie <= 1 && sl.options.length > 0;
    const advisorTop = usable ? sl.options[0].command : null;
    const stateKnown = sl.state === shortlist.STATES.ok || sl.state === shortlist.STATES.no_strong_pick;
    const noStrong = stateKnown ? (sl.no_strong_pick ? 1 : 0) : null;
    const overrule = overruleState(decision, shown, chosenForLabel === null ? null : chosenForLabel, advisorTop);

    const nowMs = Date.now();
    const decisionId = newId('selection_decision', nowMs);
    const offered = shown.length ? shown[0] : null;
    const items = shown.length ? shown : [null];

    const insert = db.prepare(
      'INSERT INTO selection_observations ' +
      '(id, decision_id, created_at, surface, table_version, key_used, job_id, definition_level, wicked, cynefin_rating, ' +
      'last_command, shown_command, shown_rank, advisor_rank, calibrated_p, band, no_strong_pick, decision, chosen_command, ' +
      'offered_command, advisor_top, overrule_by, ground_truth_label, calibration_observation_id, gate_id, cause_effect_domain) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    let written = 0;
    db.exec('SAVEPOINT selection_log');
    try {
      items.forEach((cmd, index) => {
        let p = null;
        let band = null;
        let advisorRank = null;
        let label = null;
        let calId = null;
        if (cmd !== null) {
          const score = shortlist.scoreFor(q, cmd);
          p = typeof score === 'number' ? score : null;
          band = p === null ? null : shortlist.bandFor(p);
          const at = sl.options.findIndex((o) => o.command === cmd);
          advisorRank = at === -1 ? null : sl.options[at].rank;
          label = labelFor(decision, cmd, index, chosenForLabel);
          if (p !== null) {
            const cal = calibrationLog.logCalibrationObservation(db, {
              cue_kind: 'advisor_option',
              confidence: p,
              cue_disposition: 'shown',
              band: band,
              created_by: 'selection-log',
              emit_audit_marker: false,
              ground_truth_label: label,
            });
            if (cal && cal.ok) calId = cal.id;
          }
        }
        insert.run(
          newId('selection_observation', nowMs) + ':' + index, decisionId, nowMs, surface, tableVersion, shortText(sl.key_used),
          f.job, f.level, f.wicked, f.cynefin, f.last, cmd, cmd === null ? null : index + 1, advisorRank, p, band, noStrong,
          decision, decision === 'accept' ? chosenForLabel : null, offered, advisorTop, overrule, label, calId, gate, f.domain
        );
        written += 1;
      });
      db.exec('RELEASE selection_log');
    } catch (err) {
      try { db.exec('ROLLBACK TO selection_log'); db.exec('RELEASE selection_log'); } catch (_e) { /* best effort */ }
      return { ok: false, reason: String((err && err.message) || err).slice(0, 120) };
    }
    return { ok: true, decision_id: decisionId, rows: written, overrule_by: overrule };
  } catch (err) {
    return { ok: false, reason: String((err && err.message) || err).slice(0, 120) };
  }
}

module.exports = { recordSelectionOutcome, DECISIONS, OVERRULE_BY };
