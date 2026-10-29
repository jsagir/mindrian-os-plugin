#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-04 -- the portfolio command-line door.
 *
 * ONE thin door between the /mos:eureka-portfolio command and the three pieces
 * built before it:
 *   314-02 lib/core/eureka/portfolio-run.cjs       the bounded run
 *   314-01 lib/core/eureka/portfolio-snapshot.cjs  the local run store
 *   314-01 lib/core/eureka/portfolio-movement.cjs  the diff and the movement file
 * Larry passes a room path, a section slug or a movement id. The script runs
 * deterministic code and prints ONE JSON document on stdout. Room text never
 * rides argv. Room text (the labels) appears only in the printed output, which
 * goes to the local terminal.
 *
 * ORDER OF A RUN (D-01 and D-07, on demand only):
 *   runPortfolio -> stop unless status is ok -> readLatest (the previous run)
 *   -> saveRun -> diffRuns -> buildMovementEnvelope -> writeMovement, or
 *   clearMovement for THIS scope only. A degraded or failed run writes nothing.
 *
 * SEEN MARKER
 *   `run` never marks a movement seen. The command calls `seen` after it has
 *   shown the movement, and `show` marks what it shows. A movement made by
 *   another surface, a teammate or an unattended step stays unseen, and that
 *   is the case SENS-13 (evidence shape B) is for.
 *
 * CANON PART 8: no network call and no Brain call. The script reads and writes
 * only the room folder it is given.
 * CANON PART 9: no graph write. The only writes are the stored run and the
 * movement files under <room>/.mindrian/eureka-portfolio/ (temp then rename,
 * made by portfolio-snapshot.cjs).
 * D-02: nothing schedules this script and the sensor never calls it. There is
 * no timer, no watcher and no background process anywhere in this file.
 *
 * Usage:
 *   node scripts/eureka-portfolio.cjs run  --room DIR [--section SLUG] [--top N] [--offline]
 *   node scripts/eureka-portfolio.cjs show --room DIR [--section SLUG]
 *   node scripts/eureka-portfolio.cjs seen --room DIR --id MOVEMENT_ID
 *   node scripts/eureka-portfolio.cjs help
 *
 * Exit codes: 0 done (a degrade is an honest answer, so it is 0), 1 the run or
 * the store failed, 2 a bad argument. Pure CJS, node built-ins only, no
 * Commander or yargs: a process.argv switch-case router (the gsd-tools idiom).
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const store = require(path.join(REPO_ROOT, 'lib/core/eureka/portfolio-snapshot.cjs'));
const movement = require(path.join(REPO_ROOT, 'lib/core/eureka/portfolio-movement.cjs'));

const DEFAULT_TOP = 25;
const SHOW_TOP = 25;
const MAX_TOP = 100;
const MAX_TAIL_PRINTED = 10;
const FALLBACK_LABEL = 'a pair outside the top of the list';
const FALLBACK_TAIL_LABEL = 'a thing with no title';

const COMMANDS = ['run', 'show', 'seen', 'help'];
const VALUE_FLAGS = ['room', 'section', 'top', 'id'];
const BOOL_FLAGS = ['offline', 'help'];

// Fixed sentences. Plain English. No stack words.
const PLAIN_REASONS = Object.freeze({
  encoder_unavailable: 'The local measuring tool is not installed, so there are no fitness numbers. Run /mos:eureka enable once to install it.',
  no_pairs: 'Nothing in this room is linked to anything else yet, so there is nothing to compare.',
  too_few_things: 'This room does not have enough things yet to rank a portfolio.',
  no_room: 'No Data Room found at that path.',
  bad_section: 'That section name is not valid.',
  store_failed: 'The run finished but could not be saved in the room folder.',
  ahp_inconsistent: 'The weighting file is inconsistent, so no ranking was made.',
  none: 'No portfolio run is stored for this room yet. Run /mos:eureka-portfolio first.',
  bad_top: 'The top number must be a whole number from 1 to 100.',
  bad_id: 'That movement id is not valid.',
  bad_argument: 'That command or option is not recognised. Run the help command to see what is allowed.',
  room_unreadable: 'The Data Room could not be read, so nothing was changed.'
});

const NOTE_FIRST_RUN = 'This is the first saved run for this scope, so there is nothing to compare yet. Run it again later to see what moved.';
const NOTE_NO_MOVEMENT = 'Nothing moved since the last run.';
const NOTE_MOVED = 'Something moved since the last run.';
const NOTE_NOT_COMPARABLE = 'The last saved run could not be compared with this one.';
const NOTE_ENCODER_CHANGED = 'The last run used a different measuring tool, so the two runs cannot be compared.';

const USAGE = [
  'eureka-portfolio - rank the linked ideas in a Data Room and keep the last run.',
  '',
  'Usage:',
  '  eureka-portfolio.cjs run  --room DIR [--section SLUG] [--top N] [--offline]',
  '  eureka-portfolio.cjs show --room DIR [--section SLUG]',
  '  eureka-portfolio.cjs seen --room DIR --id MOVEMENT_ID',
  '  eureka-portfolio.cjs help',
  '',
  'run   Make a run, save it, compare it with the previous saved run, and keep',
  '      the movement for the sensor. Nothing is saved if the run does not finish.',
  'show  Print the saved run and its movement without a new run. Marks the movement seen.',
  'seen  Mark one movement id as seen.',
  '',
  'Options:',
  '  --room DIR      absolute path of the Data Room folder (required).',
  '  --section SLUG  limit the run to one section, for example opportunity-bank.',
  '  --top N         rows to print, a whole number from 1 to 100 (default 25).',
  '  --id ID         a movement id such as pm_0123456789ab.',
  '  --offline       use the deterministic stub encoder. A test option only: the run is',
  '                  saved with encoder kind stub and never reaches the sensor.',
  '',
  'Exit codes: 0 done, 1 the run or the save failed, 2 a bad argument.'
].join('\n') + '\n';

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

function argError(reason, code) {
  return { reason: reason, code: code || 2 };
}

/**
 * parseArgv(argv) -> { command, flags, error? }.
 * `--flag value` and `--flag=value`. A value flag with no value reads as an
 * empty string, which the validators then refuse. Unknown flags are refused.
 */
function parseArgv(argv) {
  const list = Array.isArray(argv) ? argv.map(String) : [];
  const flags = {};
  let command = null;
  for (let i = 0; i < list.length; i += 1) {
    const tok = list[i];
    if (tok === '-h') { flags.help = true; continue; }
    if (tok.indexOf('--') === 0) {
      const eq = tok.indexOf('=');
      const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      if (BOOL_FLAGS.indexOf(name) !== -1) {
        flags[name] = true;
        continue;
      }
      if (VALUE_FLAGS.indexOf(name) !== -1) {
        if (eq !== -1) {
          flags[name] = tok.slice(eq + 1);
        } else if (i + 1 < list.length && list[i + 1].indexOf('--') !== 0) {
          flags[name] = list[i + 1];
          i += 1;
        } else {
          flags[name] = '';
        }
        continue;
      }
      return { command: command, flags: flags, error: argError('bad_argument') };
    }
    if (command === null) {
      command = tok;
      continue;
    }
    return { command: command, flags: flags, error: argError('bad_argument') };
  }
  if (flags.help === true || command === null) return { command: 'help', flags: flags };
  if (COMMANDS.indexOf(command) === -1) return { command: command, flags: flags, error: argError('bad_argument') };
  return { command: command, flags: flags };
}

// ---------------------------------------------------------------------------
// output helpers
// ---------------------------------------------------------------------------

function plain(reason) {
  return Object.prototype.hasOwnProperty.call(PLAIN_REASONS, reason) ? PLAIN_REASONS[reason] : PLAIN_REASONS.room_unreadable;
}

function errorDoc(reason) {
  return { status: 'error', reason: reason, plain_reason: plain(reason) };
}

function labelOrFallback(label, fallback) {
  return typeof label === 'string' && label.length > 0 ? label : (fallback || FALLBACK_LABEL);
}

function zeroCounts() {
  return { band_cross: 0, tail_enter: 0, top_n_reshuffle: 0 };
}

/** Events with plain labels in place of handles. labelOf(handle) -> string or ''. */
function printEvents(events, labelOf) {
  return (Array.isArray(events) ? events : []).map(function (e) {
    if (e.kind === 'band_cross') {
      return {
        kind: 'band_cross',
        a_label: labelOrFallback(labelOf(e.a_handle)),
        b_label: labelOrFallback(labelOf(e.b_handle)),
        from_band: e.from_band,
        to_band: e.to_band,
        direction: e.direction
      };
    }
    if (e.kind === 'tail_enter') {
      return { kind: 'tail_enter', label: labelOrFallback(labelOf(e.handle)) };
    }
    return { kind: e.kind, top_n: e.top_n, entered: e.entered, left: e.left, max_shift: e.max_shift };
  });
}

function noteFor(diff, envelope, firstRun) {
  if (firstRun) return NOTE_FIRST_RUN;
  if (!diff.comparable) return diff.reason === 'encoder_changed' ? NOTE_ENCODER_CHANGED : NOTE_NOT_COMPARABLE;
  return envelope ? NOTE_MOVED : NOTE_NO_MOVEMENT;
}

function movementDoc(sid, diff, envelope, firstRun, labelOf) {
  return {
    first_run: firstRun,
    comparable: diff.comparable === true,
    reason: diff.reason,
    reshuffle_active: diff.reshuffle_active === true,
    movement_id: envelope ? envelope.movement_id : null,
    scope_id: sid,
    counts: envelope ? envelope.counts : (diff.counts || zeroCounts()),
    events: envelope ? printEvents(envelope.events, labelOf) : [],
    plain_note: noteFor(diff, envelope, firstRun)
  };
}

function fitness(score) {
  return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(2) : null;
}

function rowsFromDisplay(rows, top) {
  return (Array.isArray(rows) ? rows : []).slice(0, top).map(function (r) {
    return {
      rank: r.rank,
      a_label: labelOrFallback(r.a_label),
      b_label: labelOrFallback(r.b_label),
      score: r.score,
      fitness: fitness(r.score),
      band: r.band,
      dims: r.dims || null,
      weak_a: r.weak_a || [],
      weak_b: r.weak_b || [],
      complementary: r.complementary === true,
      tail_flag: r.tail_flag === true
    };
  });
}

function tailDoc(tail) {
  const t = tail || {};
  const items = Array.isArray(t.items) ? t.items : [];
  return {
    count: Number.isInteger(t.count) ? t.count : items.length,
    items: items.slice(0, MAX_TAIL_PRINTED).map(function (it) { return { label: labelOrFallback(it && it.label, FALLBACK_TAIL_LABEL) }; }),
    insufficient_structure: t.insufficient_structure === true,
    suspect_noise: t.suspect_noise === true,
    composition: typeof t.composition === 'string' ? t.composition : null
  };
}

// ---------------------------------------------------------------------------
// argument validation
// ---------------------------------------------------------------------------

/** -> { error } or { room, section, sid, key }. needDb is true for `run`. */
function checkScope(flags, needDb) {
  const room = flags.room;
  if (typeof room !== 'string' || room.length === 0 || !path.isAbsolute(room)) return { error: argError('no_room', 2) };
  let section = null;
  if (Object.prototype.hasOwnProperty.call(flags, 'section')) {
    if (typeof flags.section !== 'string' || !store.SLUG_RE.test(flags.section)) return { error: argError('bad_section', 2) };
    section = flags.section;
  }
  return { room: room, section: section, key: section === null ? 'room' : section, sid: section === null ? 'room' : store.scopeId(section), needDb: needDb };
}

function checkRoomOnDisk(scope) {
  try {
    if (!fs.statSync(scope.room).isDirectory()) return argError('no_room', 1);
    if (scope.needDb && !fs.statSync(path.join(scope.room, '.mindrian', 'room.db')).isFile()) return argError('no_room', 1);
  } catch (_e) {
    return argError('no_room', 1);
  }
  return null;
}

function parseTop(flags, fallback) {
  if (!Object.prototype.hasOwnProperty.call(flags, 'top')) return { top: fallback };
  const raw = flags.top;
  if (typeof raw !== 'string' || !/^[0-9]{1,3}$/.test(raw)) return { error: argError('bad_top', 2) };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TOP) return { error: argError('bad_top', 2) };
  return { top: n };
}

// ---------------------------------------------------------------------------
// subcommands
// ---------------------------------------------------------------------------

async function cmdRun(flags, deps, emit) {
  const scope = checkScope(flags, true);
  if (scope.error) return emit(errorDoc(scope.error.reason), scope.error.code);
  const topCheck = parseTop(flags, DEFAULT_TOP);
  if (topCheck.error) return emit(errorDoc(topCheck.error.reason), topCheck.error.code);
  const onDisk = checkRoomOnDisk(scope);
  if (onDisk) return emit(errorDoc(onDisk.reason), onDisk.code);

  const runner = typeof deps.runPortfolio === 'function' ? deps.runPortfolio : require(path.join(REPO_ROOT, 'lib/core/eureka/portfolio-run.cjs')).runPortfolio;
  const now = typeof deps.now === 'function' ? deps.now : function () { return new Date(); };
  const runOpts = { roomDir: scope.room, topN: topCheck.top, now: now };
  if (scope.section !== null) runOpts.section = scope.section;
  if (flags.offline === true) runOpts.encodeFn = require(path.join(REPO_ROOT, 'scripts/eureka-room-report.cjs')).stubEncode;

  let result;
  try {
    result = await runner(runOpts);
  } catch (_e) {
    return emit(errorDoc('room_unreadable'), 1);
  }
  if (!result || typeof result.status !== 'string') return emit(errorDoc('room_unreadable'), 1);

  // A degraded or failed run stores nothing and leaves every movement file alone.
  if (result.status === 'degraded') {
    return emit({
      status: 'degraded',
      degrade: result.degrade || 'qualitative-only',
      reason: result.reason,
      plain_reason: plain(result.reason),
      qualitative: result.qualitative || null
    }, 0);
  }
  if (result.status !== 'ok' || !result.snapshot || !result.display) {
    return emit(errorDoc(typeof result.reason === 'string' ? result.reason : 'room_unreadable'), 1);
  }

  const snapshot = result.snapshot;
  const display = result.display;

  // 1. The previous run is read BEFORE the new one is saved.
  const previous = store.readLatest(scope.room, scope.key);
  // 2. Save. A failed save leaves the movement file untouched.
  const saved = store.saveRun(scope.room, scope.key, snapshot);
  if (!saved || saved.ok !== true) return emit(errorDoc('store_failed'), 1);

  // 3. Diff, envelope, then this scope's movement file only.
  const diff = movement.diffRuns(previous, snapshot, movement.loadThresholds());
  const envelope = movement.buildMovementEnvelope(diff, snapshot, now());
  let movementState = 'none';
  if (envelope) {
    movementState = store.writeMovement(scope.room, envelope).ok === true ? 'written' : 'failed';
  } else {
    movementState = store.clearMovement(scope.room, scope.sid).ok === true ? 'cleared' : 'failed';
  }
  const labelOf = typeof display.labelOf === 'function' ? display.labelOf : function () { return ''; };
  const firstRun = previous === null;

  return emit({
    status: 'ok',
    scope: snapshot.scope,
    section: scope.section,
    ran_at: snapshot.ran_at,
    encoder_kind: snapshot.encoder_kind,
    provenance: snapshot.provenance,
    ranked: rowsFromDisplay(display.rows, topCheck.top),
    tail: tailDoc(display.tail),
    counts: display.counts || null,
    movement: movementDoc(scope.sid, diff, envelope, firstRun, labelOf),
    store: { saved: true, rotated: saved.rotated === true, movement: movementState }
  }, 0);
}

function cmdShow(flags, deps, emit) {
  const scope = checkScope(flags, false);
  if (scope.error) return emit(errorDoc(scope.error.reason), scope.error.code);
  const onDisk = checkRoomOnDisk(scope);
  if (onDisk) return emit(errorDoc(onDisk.reason), onDisk.code);

  const latest = store.readLatest(scope.room, scope.key);
  if (latest === null) return emit({ status: 'none', plain_reason: plain('none') }, 0);
  const previous = store.readPrevious(scope.room, scope.key);
  const envelope = store.readMovement(scope.room, scope.sid);
  const thresholds = movement.loadThresholds();
  const labelOf = function (handle) {
    return Object.prototype.hasOwnProperty.call(latest.labels, handle) ? latest.labels[handle] : '';
  };
  const tailItems = latest.tail.items.slice(0, MAX_TAIL_PRINTED).map(function (it) { return { label: labelOf(it.id) }; });
  const rows = latest.pairs.slice(0, SHOW_TOP).map(function (p) {
    return { rank: p.rank, a_label: labelOf(p.a), b_label: labelOf(p.b), score: p.score, band: p.band };
  });
  const diffLike = {
    comparable: previous !== null,
    reason: previous === null ? 'no_previous_run' : (envelope ? 'movement' : 'no_movement'),
    reshuffle_active: thresholds.calibrated === true,
    counts: zeroCounts()
  };
  const doc = {
    status: 'ok',
    scope: latest.scope,
    section: scope.section,
    ran_at: latest.ran_at,
    encoder_kind: latest.encoder_kind,
    provenance: latest.provenance,
    ranked: rowsFromDisplay(rows, SHOW_TOP),
    tail: tailDoc({ count: latest.tail.items.length, items: tailItems, insufficient_structure: latest.tail.insufficient_structure, suspect_noise: latest.tail.suspect_noise, composition: latest.tail.composition }),
    counts: { pairs_scored: latest.pairs.length },
    movement: movementDoc(scope.sid, diffLike, envelope, previous === null, labelOf),
    marked_seen: false
  };
  // show has shown the movement, so it is now seen.
  if (envelope) doc.marked_seen = store.markSeen(scope.room, envelope.movement_id).ok === true;
  return emit(doc, 0);
}

function cmdSeen(flags, deps, emit) {
  const room = flags.room;
  if (typeof room !== 'string' || room.length === 0 || !path.isAbsolute(room)) return emit(errorDoc('no_room'), 2);
  if (typeof flags.id !== 'string' || !store.MOVEMENT_ID_RE.test(flags.id)) return emit(errorDoc('bad_id'), 2);
  const onDisk = checkRoomOnDisk({ room: room, needDb: false });
  if (onDisk) return emit(errorDoc(onDisk.reason), onDisk.code);
  const r = store.markSeen(room, flags.id);
  if (!r || r.ok !== true) return emit(errorDoc('store_failed'), 1);
  return emit({ status: 'ok', movement_id: flags.id, marked: true }, 0);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * main(argv, deps) -> Promise<exit code>. Never calls process.exit.
 * deps (all optional, test seams): runPortfolio, now, out, err.
 */
async function main(argv, deps) {
  const d = deps || {};
  const out = typeof d.out === 'function' ? d.out : function (s) { process.stdout.write(s); };
  let code = 0;
  const emit = function (doc, exit) {
    out(JSON.stringify(doc, null, 2) + '\n');
    code = exit;
    return exit;
  };
  try {
    const parsed = parseArgv(argv);
    if (parsed.error) return emit(errorDoc(parsed.error.reason), parsed.error.code);
    switch (parsed.command) {
      case 'help':
        out(USAGE);
        return 0;
      case 'run':
        return await cmdRun(parsed.flags, d, emit);
      case 'show':
        return cmdShow(parsed.flags, d, emit);
      case 'seen':
        return cmdSeen(parsed.flags, d, emit);
      default:
        return emit(errorDoc('bad_argument'), 2);
    }
  } catch (_e) {
    return emit(errorDoc('room_unreadable'), 1);
  }
}

module.exports = {
  main: main,
  parseArgv: parseArgv,
  PLAIN_REASONS: PLAIN_REASONS,
  FALLBACK_LABEL: FALLBACK_LABEL
};

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) {
    process.exitCode = code;
  });
}
