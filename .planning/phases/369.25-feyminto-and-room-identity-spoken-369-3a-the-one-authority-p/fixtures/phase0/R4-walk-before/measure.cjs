'use strict';
// R4: doctor --icm-walk --json BEFORE numbers on the two fixture rooms, under an isolated HOME.
// Run from the repo root: node <this file> <outDir>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = process.cwd();
const OUT = path.resolve(process.argv[2]);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-r4-'));
const HOME = path.join(TMP, 'home'); fs.mkdirSync(HOME);
const ENV = Object.assign({}, process.env, { HOME, USERPROFILE: HOME, NODE_NO_WARNINGS: '1', MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' });
delete ENV.CLAUDE_CODE_SESSION_ID; delete ENV.MINDRIAN_ACTIVE_SESSION_ID; delete ENV.TAVILY_API_KEY; delete ENV.MINDRIAN_ROOMS_HOME;
const head = cp.spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
// room a: the release fixture room, born offline
const A = path.join(TMP, 'a');
const aRooms = path.join(A, 'rooms');
const ra = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts/real-room-run.cjs'), '--offline', '--rooms-home', aRooms, '--receipt-dir', path.join(A, 'receipts')], { env: ENV, encoding: 'utf8', timeout: 240000, cwd: ROOT });
const aDir = path.join(aRooms, 'release-fixture-' + head.slice(0, 8));
if (ra.status !== 0 || !fs.existsSync(path.join(aDir, '.mindrian', 'room.db'))) { console.error('room a failed', ra.status, String(ra.stderr).slice(-400)); process.exit(1); }
// room b: birthRoom with no authored nests
const bRooms = path.join(TMP, 'b', 'rooms'); fs.mkdirSync(bRooms, { recursive: true });
const bDir = path.join(bRooms, 'phase0-b');
const rb = cp.spawnSync(process.execPath, ['-e', `
process.env.MINDRIAN_ROOMS_HOME=${JSON.stringify(bRooms)};
const r=require(${JSON.stringify(path.join(ROOT, 'lib/core/navigation/room-birth.cjs'))}).birthRoom({slug:'phase0-b',roomDir:${JSON.stringify(bDir)},sessionId:'phase0',ventureText:'A scaffold venture for the Phase 0 walk',jtbd:'',approvedBy:'phase0',canonicalRole:'founder',vname:'Phase0 B',vstage:'Pre-Opportunity'});
console.log(JSON.stringify({ok:r&&r.ok,keys:Object.keys(r||{})}));`], { env: ENV, encoding: 'utf8', timeout: 120000, cwd: ROOT });
if (!/"ok":true/.test(rb.stdout)) { console.error('room b failed', rb.stdout, String(rb.stderr).slice(-400)); process.exit(1); }
function walk(dir, file) {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts/doctor.cjs'), '--icm-walk', '--room', dir, '--json'], { env: ENV, encoding: 'utf8', timeout: 120000, cwd: ROOT });
  const scrub = (t) => t.split(TMP).join('<tmp>');
  fs.writeFileSync(path.join(OUT, file), scrub(r.stdout));
  if (r.status !== 0) console.error(file, 'exit', r.status, String(r.stderr).slice(-300));
  const t = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts/doctor.cjs'), '--icm-walk', '--room', dir], { env: ENV, encoding: 'utf8', timeout: 120000, cwd: ROOT });
  fs.writeFileSync(path.join(OUT, file.replace('.json', '.txt')), scrub(t.stdout));
  return JSON.parse(r.stdout);
}
const a = walk(aDir, 'icm-walk-before-a.json');
const b = walk(bDir, 'icm-walk-before-b.json');
fs.writeFileSync(path.join(OUT, 'head.txt'), 'HEAD ' + head + '\nroom a slug release-fixture-' + head.slice(0, 8) + '\nroom b slug phase0-b\n');
function rows(j) {
  const n = j.nests;
  const sum = (f) => n.reduce((x, y) => x + (f(y) || 0), 0);
  return {
    I0_core_present: j.room.I0.core_present + ' of ' + j.room.I0.core_total, I0_non_core: j.room.I0.non_core_directories,
    I1_nests_with_room_md: sum((x) => (x.I1.room_md ? 1 : 0)) + ' of ' + n.length,
    I5_md_files_total: sum((x) => x.I5.md_files), I5_generated_marked_total: sum((x) => x.I5.generated_marked), I5_authored_total: sum((x) => x.I5.authored),
    I6_faces_present: ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md'].map((f) => f + ' ' + sum((x) => (x.I6.faces[f].present ? 1 : 0))).join(', '),
    I6_edit_surface_marker_absent: sum((x) => Object.values(x.I6.faces).filter((f) => f.present && f.edit_surface_marker === false).length) + ' of ' + sum((x) => Object.values(x.I6.faces).filter((f) => f.present).length),
    I7_over_8000_tokens: sum((x) => (x.I7.over_8000_tokens ? 1 : 0)), I7_max_approx_tokens: Math.max(...n.map((x) => x.I7.approx_tokens || 0)),
    I7_solution_design_bytes: (n.find((x) => x.nest === 'solution-design') || { I7: {} }).I7.bytes,
    I8a_minto_sources_total: sum((x) => x.I8a.minto_sources), I8a_in_room_md_total: sum((x) => x.I8a.in_room_md),
    I8b_minto_room_matches_slug: sum((x) => (x.I8b.matches_slug === true ? 1 : 0)) + ' of ' + sum((x) => (x.I8b.minto_room !== null ? 1 : 0)),
    I8c_brain_md_present: sum((x) => (x.I8c.brain_md ? 1 : 0)), I8c_restated: sum((x) => (x.I8c.restated ? 1 : 0)),
    M3_room_summary: j.summary, M3_room_block: { room_node: j.room.room_node, identity_rows_total: j.room.identity_rows_total, identity_rows_naming_room: j.room.identity_rows_naming_room, slug_db_agreement: j.room.slug_db_agreement },
  };
}
fs.writeFileSync(path.join(OUT, 'before-rows.json'), JSON.stringify({ head, room_a: rows(a), room_b: rows(b) }, null, 2) + '\n');
console.log(JSON.stringify({ room_a: rows(a), room_b: rows(b) }, null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
