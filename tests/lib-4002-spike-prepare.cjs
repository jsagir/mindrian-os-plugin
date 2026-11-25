#!/usr/bin/env node
'use strict';
// Phase 400.2-15: the offline preparation of the overlap spike (PS-06). It runs the real door path of the deep run up
// to the plan step: start, write-persona, accept-persona, the handles file, plan-research. It then writes an approved
// file in which every decision is "defer", and it prints the 4 strings with their providers and the next commands.
// It makes no fetch and sends no request. The one live call, run-research, is the hand of the owner (400.2-SPIKE-RUN.md).
// It lives under tests/ and does not ship: package.json ships scripts/ only.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOM = path.join(__dirname, 'fixtures', '4002', 'spike-room');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');
const RECORD_REL = 'tests/fixtures/4002/spike-overlap-record.json';
const DEFAULT_HANDLE = 'battery recycling';
const RESEARCH = Object.freeze(['white', 'black', 'yellow', 'green']);
const ALL_HATS = Object.freeze(['white', 'red', 'black', 'yellow', 'green', 'blue']);

function shq(s) {
  const t = String(s);
  return /^[A-Za-z0-9_\/.:=@%+,-]+$/.test(t) ? t : "'" + t.replace(/'/g, "'\\''") + "'";
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function briefOf() {
  return {
    schema: 'mos.persona-brief/1',
    target: 'room',
    governing_question: 'Should the workshop move to a fixed monthly plan for new clients?',
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?'],
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode: 'deep',
    triage: { recommended: 'deep', reason: 'A fixed test brief for the overlap spike.' },
  };
}

function specOf(hat) {
  return {
    schema: 'mos.persona-spec/1',
    hat,
    focus: 'Look at the ' + hat + ' side of the plan question.',
    hat_questions: ['What does the room show?', 'What is missing?', 'What would change the view?'],
    must_not_judge: ['The price level.'],
    room_sources: ['problem-definition/core-problem.md'],
  };
}

function fail(reason, extra) {
  return Object.assign({ ok: false, reason }, extra || {});
}

/**
 * Prepare one spike run in a new directory. Offline: the door steps up to plan-research only.
 * @param {{dir: string, handle?: string}} opts
 * @param {Object} [deps] door seams: now, randomHex (and others the door accepts; none is a fetch)
 */
function prepare(opts, deps) {
  const o = opts || {};
  if (typeof o.dir !== 'string' || o.dir.length === 0) return fail('dir_missing');
  const dir = path.resolve(o.dir);
  if (fs.existsSync(dir)) {
    let st;
    try { st = fs.statSync(dir); } catch (e) { return fail('dir_unreadable'); }
    if (!st.isDirectory()) return fail('dir_not_a_directory');
    if (fs.readdirSync(dir).length > 0) return fail('dir_not_empty');
  }
  const handle = typeof o.handle === 'string' && o.handle.trim().length > 0 ? o.handle.trim() : DEFAULT_HANDLE;

  const door = require(DOOR_PATH);
  const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));

  fs.mkdirSync(dir, { recursive: true });
  const home = path.join(dir, 'home');
  const tmp = path.join(dir, 'tmp');
  const work = path.join(dir, 'work');
  const packs = path.join(dir, 'packs');
  for (const d of [home, tmp, work, packs]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  const roomDir = path.join(dir, 'room');
  fs.cpSync(FIXTURE_ROOM, roomDir, { recursive: true });
  // A room with no room.db would fetch with no pack items (fetched_not_wired:no_db): the spike needs the database.
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(roomDir));

  const d = Object.assign({}, deps || {}, { homeDir: home, tmpDir: tmp });
  const briefPath = path.join(work, 'brief.json');
  writeJson(briefPath, briefOf());
  const res = door.cmdStart({ roomDir, briefPath, mode: 'deep' }, d);
  if (!res.ok) return fail('start_failed:' + res.reason);

  const todo = res.to_build.concat(res.to_accept);
  for (const hat of res.to_build) writeJson(path.join(res.hats[hat].dir, 'persona.json'), specOf(hat));
  if (res.to_build.length > 0) {
    const w = door.cmdWritePersona({ roomDir, runId: res.run_id }, d);
    if (!w.ok) return fail('write_persona_failed:' + w.reason);
  }
  if (todo.length > 0) {
    const answer = {};
    for (const hat of todo) answer[hat] = { decision: 'accept' };
    const answerPath = path.join(work, 'accept.json');
    writeJson(answerPath, { schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer });
    const a = door.cmdAcceptPersona({ roomDir, runId: res.run_id, answerPath }, d);
    if (!a.ok || a.accept_done !== true) return fail('accept_persona_failed:' + (a.reason || 'not_done'));
  }
  for (const hat of RESEARCH) {
    writeJson(path.join(res.hats[hat].dir, 'handles.json'), {
      schema: 'mos.persona-handles/1',
      hat,
      handles: [{ handle, why: 'One generic field term for the overlap spike.' }],
    });
  }
  const plan = door.cmdPlanResearch({ roomDir, runId: res.run_id }, d);
  if (!plan.ok) return fail('plan_research_failed:' + plan.reason);
  if (plan.planned.length === 0) return fail('no_string_planned', { hats: plan.hats, refused_shown: plan.refused_shown });

  const map = door.readRunMap(home, res.run_id, fs.realpathSync(roomDir));
  if (!map) return fail('run_map_missing');
  const hatDirs = {};
  for (const hat of ALL_HATS) hatDirs[hat] = map.hats[hat];

  const strings = [];
  const unavailable = {};
  const approved = { schema: 'mos.persona-approved/1', run_id: res.run_id, plan_seq: plan.plan.plan_seq, hats: {} };
  for (const hat of RESEARCH) {
    const rec = plan.plan.hats[hat];
    if (rec.state !== 'planned') continue;
    unavailable[hat] = rec.unavailable_line || '';
    for (const s of rec.strings) strings.push({ hat, text: s.text, q_hash: s.q_hash, providers: rec.providers.slice(), lenses: rec.lens_set.map(e => e.lens) });
    approved.hats[hat] = { decision: 'defer', q_hashes: rec.strings.map(s => s.q_hash), providers: rec.providers.slice() };
  }
  const approvedPath = path.join(work, 'approved.json');
  writeJson(approvedPath, approved);

  const commands = {
    run_research: 'MINDRIAN_HOME=' + shq(home) + ' node ' + shq(DOOR_PATH) + ' run-research --room ' + shq(roomDir) + ' --run ' + res.run_id + ' --approved ' + shq(approvedPath),
    collect: RESEARCH.map(hat => 'cp ' + shq(path.join(hatDirs[hat], 'evidence.json')) + ' ' + shq(path.join(packs, hat + '.json'))),
    overlap: 'node tests/lib-4002-hat-overlap.cjs --packs ' + shq(packs) + ' --out ' + RECORD_REL,
  };

  const lines = [];
  lines.push('SPIKE PREPARED. Nothing was sent. Nothing leaves this machine until you run the run-research line in step 4.');
  lines.push('Directory: ' + dir);
  lines.push('Handle: ' + handle + ' (generic; no room detail)');
  lines.push('');
  lines.push('The strings that run-research sends, and the providers that receive each one:');
  for (const s of strings) lines.push('  ' + s.hat.padEnd(7) + '| ' + s.text + ' | ' + s.providers.join(', '));
  for (const hat of Object.keys(unavailable)) if (unavailable[hat]) lines.push('  ' + hat + ': ' + unavailable[hat]);
  lines.push('');
  lines.push('Approved file (every decision is "defer"): ' + approvedPath);
  lines.push('Change "defer" to "approve" for each hat you accept. A hat left on "defer" is not searched.');
  lines.push('');
  lines.push('Step 4, the live call (run it from the repository root):');
  lines.push('  ' + commands.run_research);
  lines.push('Step 5, copy the four evidence packs, then compute the record:');
  for (const c of commands.collect) lines.push('  ' + c);
  lines.push('  ' + commands.overlap);
  lines.push('When you are done, delete the directory: ' + dir);

  return {
    ok: true,
    dir,
    room: roomDir,
    run_id: res.run_id,
    home,
    tmp,
    review_dir: res.review_dir,
    scratch_root: map.scratch_root,
    hat_dirs: hatDirs,
    approved_path: approvedPath,
    packs_dir: packs,
    strings,
    unavailable,
    commands,
    text: lines.join('\n') + '\n',
  };
}

function main(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (typeof argv[i] === 'string' && argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[i + 1];
  }
  if (typeof flags.dir !== 'string' || flags.dir.length === 0) {
    process.stderr.write('usage: lib-4002-spike-prepare.cjs --dir <new empty directory> [--handle <generic term>]\n');
    process.exitCode = 2;
    return undefined;
  }
  const out = prepare({ dir: flags.dir, handle: flags.handle });
  if (!out.ok) {
    process.stderr.write('spike preparation failed: ' + out.reason + '\n');
    process.exitCode = 1;
    return out;
  }
  process.stdout.write(out.text);
  process.exitCode = 0;
  return out;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { prepare, main, DEFAULT_HANDLE };
