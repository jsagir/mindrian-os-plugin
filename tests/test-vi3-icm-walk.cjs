#!/usr/bin/env node
'use strict';
/*
 * Quick 261005-vi3 -- the ICM walk as a doctor tool, measurement first.
 *
 * WHY THIS TEST EXISTS. FEYMINTO-ICM-AUDIT.md audited a live nest against the ten ICM invariants and the walk
 * test by hand. `node scripts/doctor.cjs --icm-walk [--room <dir>] [--json]` mechanizes that audit: it walks
 * the room root and every nest and reports MEASURED values only (counts, bytes, approximate tokens, presence
 * booleans). It writes nothing and fixes nothing. This test pins every row against two rooms.
 *
 * The two rooms (everything below runs under an isolated HOME; nothing touches ~/.mindrian or ~/MindrianRooms):
 *   (a) the release fixture room, born offline by `node scripts/real-room-run.cjs --offline --rooms-home <tmp>
 *       --receipt-dir <tmp>` (the quick 261005-muy ceremony). Slug release-fixture-<HEAD sha8>.
 *   (b) a scaffolded room born by birthRoom, then three nests authored by this test so the duplications, the
 *       edit-surface marker, the over-budget cases and the identity-in-room.db case all exist.
 *
 * LITERALS. Every number below was produced by a shell command on those two rooms BEFORE the tool existed
 * (wc -c, wc -l, grep -c, grep -o | wc -l, find -printf, sqlite3 -readonly). The command is in a comment beside
 * the table. Values that cannot be literals (they depend on the clock or on HEAD) are cross-checked against an
 * independent command run at test time and say so.
 *
 * Arms: one per row (I1 I2 I4 I5 I6 I7 I8a I8b I8c I9 I10 W), then
 *   M1 the tool writes nothing (tree hash of the room, the rooms home and HOME before and after, equal)
 *   M2 --json parses and carries every row for every nest
 *   M3 the room summary names the duplicates and the identity result
 *   M4 a room with no room.db reports `room.db: missing` and still walks the files
 *   M5 dash guard over the new files
 *   M6 `node scripts/doctor.cjs --icm-walk --room <a>` exits 0 and the text has one block per nest
 *   M7 room.db is opened only through the navigation read door (source check)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'lib', 'core', 'doctor', 'icm-walk-module.cjs');
const DOCTOR = path.join(ROOT, 'scripts', 'doctor.cjs');
const RUN_SCRIPT = path.join(ROOT, 'scripts', 'real-room-run.cjs');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function arm(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': expected ' + b + ' got ' + a);
}

const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vi3-' + prefix + '-'));
  TMP.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});

// -- isolation: HOME and the rooms home are temp dirs for every in-process and spawned use ---------------------
const HOME = mk('home');
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
delete process.env.TAVILY_API_KEY;
function envFor(extra) {
  return Object.assign({}, process.env, { HOME: HOME, USERPROFILE: HOME }, extra || {});
}

function git(args) {
  return cp.spawnSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8' }).stdout.trim();
}
const HEAD = git(['rev-parse', 'HEAD']);

// -- room (a): the release fixture room, born offline ----------------------------------------------------------
const A_HOMES = mk('a');
const A_ROOMS = path.join(A_HOMES, 'rooms');
const A_SLUG = 'release-fixture-' + HEAD.slice(0, 8);
const A_DIR = path.join(A_ROOMS, A_SLUG);
(function birthA() {
  const r = cp.spawnSync(process.execPath, [RUN_SCRIPT, '--offline', '--rooms-home', A_ROOMS, '--receipt-dir', path.join(A_HOMES, 'receipts')], {
    env: envFor(), encoding: 'utf8', timeout: 180000, cwd: ROOT,
  });
  if (r.status !== 0 || !fs.existsSync(path.join(A_DIR, '.mindrian', 'room.db'))) {
    console.log('SETUP FAIL: real-room-run --offline exit ' + r.status + ': ' + String(r.stderr || '').slice(-400));
  }
})();

// -- room (b): a scaffolded room with three authored nests ------------------------------------------------------
const B_HOMES = mk('b');
const B_ROOMS = path.join(B_HOMES, 'rooms');
const B_SLUG = 'vi3-scaffold-b';
const B_DIR = path.join(B_ROOMS, B_SLUG);
function w(rel, text) {
  const f = path.join(B_DIR, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text, 'utf8');
}
function append(rel, text) { fs.appendFileSync(path.join(B_DIR, rel), text, 'utf8'); }
(function birthB() {
  process.env.MINDRIAN_ROOMS_HOME = B_ROOMS;
  fs.mkdirSync(B_ROOMS, { recursive: true });
  const birth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
    slug: B_SLUG, roomDir: B_DIR, sessionId: 'vi3-test', ventureText: 'A scaffold venture for the ICM walk test',
    jtbd: '', approvedBy: 'vi3-test', canonicalRole: 'founder', vname: 'Scaffold B', vstage: 'Pre-Opportunity',
  });
  if (!birth || birth.ok !== true) { console.log('SETUP FAIL: birthRoom ' + JSON.stringify(birth)); return; }

  // root routing: three wikilinks
  append('ROOM.md', '\n## Nests\n\n- [[problem-definition/ROOM|Problem definition]]\n- [[market-analysis/ROOM|Market analysis]]\n- [[solution-design/ROOM|Solution design]]\n');

  // nest A, problem-definition: every face, a MINTO that relists ROOM.md links, an over-budget FEYNMAN, a BRIEF, a STALE state
  w('problem-definition/core-hypothesis.md', '# Core hypothesis\n\nThe emulsion stays conductive.\n');
  w('problem-definition/scientific-roadmap.md', '# Scientific roadmap\n\nSeven operations.\n');
  w('problem-definition/orphan-note.md', '# Orphan note\n\nNobody links here.\n');
  append('problem-definition/ROOM.md', '\n<!-- BEGIN REFERENCES -->\n## Cross-References\n\n### Artifacts in this section\n- [[BRAIN]]\n- [[CONTEXT|problem-definition - the problem, not a solution]]\n- [[core-hypothesis|Core hypothesis]]\n- [[scientific-roadmap#roadmap|Scientific roadmap]]\n<!-- END REFERENCES -->\n');
  w('problem-definition/MINTO.md', '---\nschema_version: "1.0"\ntype: section-minto\nsection: problem-definition\nroom: vi3-scaffold-b\nsources: [core-hypothesis.md, scientific-roadmap.md, orphan-note.md]\neditable_fields: [governing_thought]\ngoverning_thought_placeholder: true\nlast_generated_at: "2026-10-05T10:00:00Z"\n---\n\n# Problem Definition -- Minto Reasoning\n');
  w('problem-definition/BRAIN.md', '---\nsection: "problem-definition"\nauthor: "brain"\nbrain_query_count: 3\n---\n\n## Framework Chain Predictions\nRun /mos:beautiful-question then /mos:user-needs, then /mos:custom-extra.\n');
  w('problem-definition/BRIEF.md', '---\ngenerated: true\n---\n# Brief\n');
  w('problem-definition/FEYNMAN.md', '---\neditable_fields: [body]\n---\n' + 'x'.repeat(6399) + '\n');
  w('problem-definition/STATE.md', '---\ncomputed: 2020-01-01T00:00:00Z\n---\n# State\n');

  // nest B, market-analysis: a ROOM.md over 60 lines, a MINTO with another room value and no sources key, a 32000 byte BRIEF, a fresh state
  append('market-analysis/ROOM.md', '\n' + 'filler line\n'.repeat(20));
  w('market-analysis/BRIEF.md', 'b'.repeat(31999) + '\n');
  w('market-analysis/MINTO.md', '---\nsection: market-analysis\nroom: some-other-room\n---\n# Market -- Minto Reasoning\n');
  w('market-analysis/STATE.md', '---\ncomputed: 2099-01-01T00:00:00Z\n---\n# State\n');

  // nest C, solution-design: a BRAIN face with brain_query_count 0 and no MINTO
  w('solution-design/BRAIN.md', '---\nsection: "solution-design"\nbrain_query_count: 0\n---\n\n## Framework Chain Predictions\n(no signal)\n');

  // room.db: a Room node and an identity row naming the room, written through the navigation write door
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  const db = navigation.openRoomDbForCaller(B_DIR);
  try {
    insertNode(db, 'room:' + B_SLUG, 'Room', JSON.stringify({ room: B_SLUG, created_by: 'system' }), { source_path: 'system:room-node', created_by: 'system', epistemic_type: 'observation' });
    db.prepare('INSERT INTO identity (key, value, updated_at) VALUES (?, ?, ?)').run('room_slug', B_SLUG, '2026-10-05T10:00:00Z');
  } finally { navigation.closeRoomDbForCaller(db); }
})();

// -- the tool under test ------------------------------------------------------------------------------------------
function mod() { return require(MODULE_PATH); }
const reports = {};
function report(which) {
  if (!reports[which]) reports[which] = mod().walkRoom(which === 'a' ? A_DIR : B_DIR);
  return reports[which];
}
function nest(rep, name) {
  const n = rep.nests.find((x) => x.nest === name);
  if (!n) throw new Error('nest ' + name + ' not in report: ' + rep.nests.map((x) => x.nest).join(','));
  return n;
}
function cli(args) {
  const r = cp.spawnSync(process.execPath, [DOCTOR].concat(args), { env: envFor(), encoding: 'utf8', timeout: 120000, cwd: ROOT });
  return { code: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}
function treeHash(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1)).forEach((e) => {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p);
      if (e.isDirectory()) { h.update('D ' + rel + '\n'); walk(p); }
      else if (e.isFile()) {
        const st = fs.statSync(p);
        h.update('F ' + rel + ' ' + st.size + ' ' + st.mtimeMs + ' ' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') + '\n');
      }
    });
  })(dir);
  return h.digest('hex');
}

const A_NESTS = ['assets', 'business-model', 'competitive-analysis', 'financial-model', 'funding', 'legal-ip', 'market-analysis',
  'opportunity-bank', 'problem-definition', 'references', 'solution-design', 'strategy', 'team', 'team-execution'];
// shell: for d in */; do [ -f $d/ROOM.md ] || [ -f $d/CONTEXT.md ] && echo $d; done | wc -l  -> 14 (both rooms)
const WITH_CONTEXT = ['business-model', 'competitive-analysis', 'financial-model', 'funding', 'legal-ip', 'market-analysis',
  'opportunity-bank', 'problem-definition', 'solution-design', 'strategy', 'team-execution'];
const NO_CONTEXT = ['assets', 'references', 'team'];

// ---------------------------------------------------------------------------------------------------------------
// the walk itself: root + nests
// ---------------------------------------------------------------------------------------------------------------
arm('W0 the walk finds the root and 14 nests on both rooms, the root first, nests sorted, dot directories skipped', () => {
  [['a', A_SLUG], ['b', B_SLUG]].forEach(([which, slug]) => {
    const rep = report(which);
    eq(rep.room.slug, slug, which + ' slug');
    eq(rep.nests.map((n) => n.nest), ['.'].concat(A_NESTS), which + ' nest list');
    eq(rep.nests[0].kind, 'root', which + ' root kind');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// I1 one folder, one job, stated inside
// shell: for each nest: [ -f ROOM.md ]; grep -c '^purpose:' ROOM.md; grep -c '^# ' ROOM.md; grep -m1 '^job_id:' CONTEXT.md
// ---------------------------------------------------------------------------------------------------------------
const JOB = {
  'business-model': 'model-business', 'competitive-analysis': 'understand-market', 'financial-model': 'model-finances',
  funding: 'plan-execution', 'legal-ip': 'protect-assets', 'market-analysis': 'understand-market', 'opportunity-bank': 'explore',
  'problem-definition': 'find-problem', 'solution-design': 'design-solution', strategy: 'find-bottleneck', 'team-execution': 'plan-execution',
};
arm('I1 ROOM.md present, purpose or first heading present, CONTEXT.md job_id (room a, every nest)', () => {
  const rep = report('a');
  rep.nests.forEach((n) => {
    eq(n.I1.room_md, true, n.nest + ' room_md');
    eq(n.I1.purpose_or_heading, true, n.nest + ' purpose_or_heading');
    eq(n.I1.job_id, JOB[n.nest] || null, n.nest + ' job_id');
  });
  eq(nest(report('b'), 'problem-definition').I1.job_id, 'find-problem', 'b problem-definition job_id');
  eq(nest(report('b'), 'assets').I1.job_id, null, 'b assets job_id');
});

// ---------------------------------------------------------------------------------------------------------------
// I2 small stable entry file
// shell: wc -l < ROOM.md ; wc -c < ROOM.md ; grep -o '\[\[[^]]*\]\]' ROOM.md | wc -l
// ---------------------------------------------------------------------------------------------------------------
const A_I2 = { // [lines, bytes] ; wikilinks are 0 in every nest of room a
  '.': [35, 1042], assets: [21, 709], 'business-model': [44, 1467], 'competitive-analysis': [44, 1492], 'financial-model': [44, 1420],
  funding: [44, 1526], 'legal-ip': [44, 1429], 'market-analysis': [44, 1477], 'opportunity-bank': [44, 1523], 'problem-definition': [44, 1507],
  references: [21, 1031], 'solution-design': [44, 1474], strategy: [44, 1574], 'team-execution': [44, 1415], team: [21, 681],
};
arm('I2 ROOM.md lines, bytes, wikilinks, over-60 flag (room a table, room b root and three nests)', () => {
  const rep = report('a');
  Object.keys(A_I2).forEach((k) => {
    const n = nest(rep, k);
    eq([n.I2.lines, n.I2.bytes, n.I2.wikilinks, n.I2.over_60_lines], [A_I2[k][0], A_I2[k][1], 0, false], 'a ' + k + ' I2');
  });
  const b = report('b');
  eq(nest(b, '.').I2, { lines: 41, bytes: 1158, wikilinks: 3, over_60_lines: false }, 'b root I2');
  eq(nest(b, 'problem-definition').I2, { lines: 54, bytes: 1764, wikilinks: 4, over_60_lines: false }, 'b A I2');
  eq(nest(b, 'market-analysis').I2, { lines: 65, bytes: 1708, wikilinks: 0, over_60_lines: true }, 'b B I2 (over 60 lines)');
  eq(nest(b, 'solution-design').I2, { lines: 44, bytes: 1464, wikilinks: 0, over_60_lines: false }, 'b C I2');
});

// ---------------------------------------------------------------------------------------------------------------
// I4 explicit contract
// shell: grep -cE '^#{1,6} +([0-9]+\. +)?(Inputs?|Process|Outputs?|Human check)\b' CONTEXT.md ; the ruling block: Job | Methodology sequence | Writing rules ; grep -c '^generated_at:'
// ---------------------------------------------------------------------------------------------------------------
arm('I4 CONTEXT.md present, the four ICM parts, the three ruling sections, generated_at (room a)', () => {
  const rep = report('a');
  WITH_CONTEXT.forEach((k) => {
    eq(nest(rep, k).I4, {
      context_md: true, inputs: true, process: true, outputs: true, human_check: true,
      ruling_job: true, ruling_methodology_sequence: true, ruling_writing_rules: true, generated_at: true,
    }, 'a ' + k + ' I4');
  });
  NO_CONTEXT.concat(['.']).forEach((k) => {
    eq(nest(rep, k).I4, {
      context_md: false, inputs: null, process: null, outputs: null, human_check: null,
      ruling_job: null, ruling_methodology_sequence: null, ruling_writing_rules: null, generated_at: null,
    }, 'a ' + k + ' I4 (CONTEXT.md missing: reported missing, not scored)');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// I5 factory vs product
// shell: find <nest> -type f -name '*.md' -not -path '*/.*' | count ; grep -lE 'DO NOT EDIT|generated_at|last_generated_at|auto_scaffolded'
// ---------------------------------------------------------------------------------------------------------------
const A_I5 = { // [md files, generated-marked]
  '.': [4, 1], assets: [1, 1], 'business-model': [3, 2], 'competitive-analysis': [4, 2], 'financial-model': [3, 2], funding: [3, 2],
  'legal-ip': [3, 2], 'market-analysis': [4, 2], 'opportunity-bank': [3, 2], 'problem-definition': [4, 2], references: [3, 1],
  'solution-design': [4, 2], strategy: [4, 2], 'team-execution': [3, 2], team: [1, 1],
};
arm('I5 generated-marked files vs authored files per nest (room a table, room b three nests)', () => {
  const rep = report('a');
  Object.keys(A_I5).forEach((k) => {
    const t = A_I5[k];
    eq(nest(rep, k).I5, { md_files: t[0], generated_marked: t[1], authored: t[0] - t[1] }, 'a ' + k + ' I5');
  });
  const b = report('b');
  eq(nest(b, '.').I5, { md_files: 4, generated_marked: 1, authored: 3 }, 'b root I5');
  eq(nest(b, 'problem-definition').I5, { md_files: 10, generated_marked: 3, authored: 7 }, 'b A I5');
  eq(nest(b, 'market-analysis').I5, { md_files: 6, generated_marked: 2, authored: 4 }, 'b B I5');
  eq(nest(b, 'solution-design').I5, { md_files: 4, generated_marked: 2, authored: 2 }, 'b C I5');
});

// ---------------------------------------------------------------------------------------------------------------
// I6 edit surface declared
// shell: grep -cE '^(editable_fields|edit_surface|human_edited):' <face> ; grep -m1 '^governing_thought_placeholder:' MINTO.md
// ---------------------------------------------------------------------------------------------------------------
arm('I6 per face: present, edit-surface marker, governing_thought_placeholder (room a: no marker anywhere; room b: marker on A MINTO and A FEYNMAN)', () => {
  const a = report('a');
  const missing = { present: false, edit_surface_marker: null, governing_thought_placeholder: null };
  const bare = { present: true, edit_surface_marker: false, governing_thought_placeholder: null };
  eq(nest(a, '.').I6.faces, { 'MINTO.md': bare, 'FEYNMAN.md': missing, 'BRAIN.md': missing }, 'a root faces');
  WITH_CONTEXT.forEach((k) => {
    eq(nest(a, k).I6.faces, { 'MINTO.md': missing, 'FEYNMAN.md': bare, 'BRAIN.md': missing }, 'a ' + k + ' faces');
  });
  NO_CONTEXT.forEach((k) => eq(nest(a, k).I6.faces, { 'MINTO.md': missing, 'FEYNMAN.md': missing, 'BRAIN.md': missing }, 'a ' + k + ' faces'));
  const b = report('b');
  eq(nest(b, 'problem-definition').I6.faces, {
    'MINTO.md': { present: true, edit_surface_marker: true, governing_thought_placeholder: true },
    'FEYNMAN.md': { present: true, edit_surface_marker: true, governing_thought_placeholder: null },
    'BRAIN.md': { present: true, edit_surface_marker: false, governing_thought_placeholder: null },
  }, 'b A faces');
  eq(nest(b, 'market-analysis').I6.faces, { 'MINTO.md': bare, 'FEYNMAN.md': bare, 'BRAIN.md': missing }, 'b B faces');
  eq(nest(b, 'solution-design').I6.faces, { 'MINTO.md': missing, 'FEYNMAN.md': bare, 'BRAIN.md': bare }, 'b C faces');
});

// ---------------------------------------------------------------------------------------------------------------
// I7 load only what the step needs
// shell: wc -c of ROOM.md CONTEXT.md MINTO.md FEYNMAN.md BRIEF.md, summed; tokens = (bytes + 3) / 4 (integer ceil)
// ---------------------------------------------------------------------------------------------------------------
const A_I7 = { // [bytes, tokens]
  '.': [1775, 444], assets: [709, 178], 'business-model': [5914, 1479], 'competitive-analysis': [5927, 1482], 'financial-model': [5080, 1270],
  funding: [7255, 1814], 'legal-ip': [5024, 1256], 'market-analysis': [5869, 1468], 'opportunity-bank': [7607, 1902],
  'problem-definition': [6301, 1576], references: [1031, 258], 'solution-design': [6423, 1606], strategy: [7075, 1769],
  'team-execution': [6055, 1514], team: [681, 171],
};
const A_FEYNMAN_TOKENS = { // FEYNMAN.md bytes (wc -c): 111 123 113 97 99 113 115 119 113 99 111, no frontmatter, body = whole file
  'business-model': 28, 'competitive-analysis': 31, 'financial-model': 29, funding: 25, 'legal-ip': 25, 'market-analysis': 29,
  'opportunity-bank': 29, 'problem-definition': 30, 'solution-design': 29, strategy: 25, 'team-execution': 28,
};
arm('I7 bytes and approximate tokens of the loaded files, the 8000 flag, the FEYNMAN 1500 body budget', () => {
  const a = report('a');
  Object.keys(A_I7).forEach((k) => {
    const n = nest(a, k);
    eq([n.I7.bytes, n.I7.approx_tokens, n.I7.over_8000_tokens], [A_I7[k][0], A_I7[k][1], false], 'a ' + k + ' I7');
    eq(n.I7.feynman_body_tokens, A_FEYNMAN_TOKENS[k] === undefined ? null : A_FEYNMAN_TOKENS[k], 'a ' + k + ' feynman_body_tokens');
    eq(n.I7.feynman_over_1500, A_FEYNMAN_TOKENS[k] === undefined ? null : false, 'a ' + k + ' feynman_over_1500');
  });
  eq(nest(a, 'problem-definition').I7.files, { 'ROOM.md': 1507, 'CONTEXT.md': 4675, 'MINTO.md': null, 'FEYNMAN.md': 119, 'BRIEF.md': null }, 'a problem-definition I7 files');
  const b = report('b');
  const A = nest(b, 'problem-definition').I7;
  eq([A.bytes, A.approx_tokens, A.over_8000_tokens], [13227, 3307, false], 'b A I7');
  eq([A.feynman_body_tokens, A.feynman_over_1500], [1600, true], 'b A FEYNMAN body: 6400 bytes after the frontmatter -> 1600 tokens, over 1500');
  eq(A.files['BRIEF.md'], 32, 'b A BRIEF bytes');
  const B = nest(b, 'market-analysis').I7;
  eq([B.bytes, B.approx_tokens, B.over_8000_tokens], [38183, 9546, true], 'b B I7 (BRIEF 32000 bytes)');
  eq([nest(b, '.').I7.bytes, nest(b, '.').I7.approx_tokens], [1891, 473], 'b root I7');
});

// ---------------------------------------------------------------------------------------------------------------
// I8a one home: sources vs references
// shell: for s in core-hypothesis scientific-roadmap orphan-note: grep -qE "\[\[$s(\||#|\]\])" ROOM.md -> dup dup absent
// ---------------------------------------------------------------------------------------------------------------
arm('I8a MINTO sources that are also ROOM.md wikilinks, and the ones that appear nowhere in ROOM.md', () => {
  const b = report('b');
  eq(nest(b, 'problem-definition').I8a, { minto_sources: 3, in_room_md: 2, absent_from_room_md: 1 }, 'b A I8a');
  eq(nest(b, 'market-analysis').I8a, { minto_sources: 0, in_room_md: 0, absent_from_room_md: 0 }, 'b B I8a (MINTO present, no sources key)');
  eq(nest(b, 'solution-design').I8a, { minto_sources: null, in_room_md: null, absent_from_room_md: null }, 'b C I8a (MINTO missing)');
  const a = report('a');
  eq(nest(a, '.').I8a, { minto_sources: 0, in_room_md: 0, absent_from_room_md: 0 }, 'a root I8a (MINTO present, no sources key)');
  eq(nest(a, 'problem-definition').I8a, { minto_sources: null, in_room_md: null, absent_from_room_md: null }, 'a A I8a (MINTO missing)');
});

// ---------------------------------------------------------------------------------------------------------------
// I8b one home: identity
// shell: grep -H '^room:' */MINTO.md ; sqlite3 -readonly room.db "select count(*) from identity; ... instr(key,slug)>0 or instr(value,slug)>0 ;
//        select count(*) from nodes where id='room:<slug>'"  -> room a: 7 / 0 / 0 ; room b: 8 / 1 / 1
// ---------------------------------------------------------------------------------------------------------------
arm('I8b MINTO room value, room.db present, Room node, identity rows naming the room, slug-vs-db agreement', () => {
  const a = report('a');
  eq(a.room, Object.assign({}, a.room, {
    slug: A_SLUG, room_db: 'present', room_node: false, identity_rows_total: 7, identity_rows_naming_room: 0, slug_db_agreement: false,
  }), 'a room identity (no Room node and no identity row on HEAD: expected)');
  const b = report('b');
  eq([b.room.room_db, b.room.room_node, b.room.identity_rows_total, b.room.identity_rows_naming_room, b.room.slug_db_agreement],
    ['present', true, 8, 1, true], 'b room identity');
  eq(nest(b, 'problem-definition').I8b, { minto_room: 'vi3-scaffold-b', matches_slug: true }, 'b A I8b');
  eq(nest(b, 'market-analysis').I8b, { minto_room: 'some-other-room', matches_slug: false }, 'b B I8b');
  eq(nest(b, 'solution-design').I8b, { minto_room: null, matches_slug: null }, 'b C I8b (MINTO missing)');
  eq(nest(a, '.').I8b, { minto_room: null, matches_slug: null }, 'a root I8b (MINTO has no room key)');
});

// ---------------------------------------------------------------------------------------------------------------
// I8c one home: the Theo face vs the contract
// shell: grep -H '^brain_query_count:' */BRAIN.md ; sed -n '/^## 2\./,/^## 3\./p' CONTEXT.md | grep -o '/mos:[a-z0-9-]*' | sort -u | wc -l ;
//        for each name: grep -qF -- name BRAIN.md   -> A: 3 names, 2 restated ; C: 3 names, 0 restated
// room a CONTEXT section-2 name counts: business-model 3, competitive-analysis 6, financial-model 3, funding 3, legal-ip 1,
//        market-analysis 3, opportunity-bank 3, problem-definition 3, solution-design 3, strategy 6, team-execution 3
// ---------------------------------------------------------------------------------------------------------------
const A_NAMES = { 'business-model': 3, 'competitive-analysis': 6, 'financial-model': 3, funding: 3, 'legal-ip': 1, 'market-analysis': 3,
  'opportunity-bank': 3, 'problem-definition': 3, 'solution-design': 3, strategy: 6, 'team-execution': 3 };
arm('I8c BRAIN.md present, brain_query_count, CONTEXT section-2 command names, the ones BRAIN.md restates', () => {
  const b = report('b');
  eq(nest(b, 'problem-definition').I8c, { brain_md: true, brain_query_count: 3, context_command_names: 3, restated: 2 }, 'b A I8c');
  eq(nest(b, 'solution-design').I8c, { brain_md: true, brain_query_count: 0, context_command_names: 3, restated: 0 }, 'b C I8c');
  eq(nest(b, 'market-analysis').I8c, { brain_md: false, brain_query_count: null, context_command_names: 3, restated: null }, 'b B I8c (BRAIN missing)');
  const a = report('a');
  Object.keys(A_NAMES).forEach((k) => {
    eq(nest(a, k).I8c, { brain_md: false, brain_query_count: null, context_command_names: A_NAMES[k], restated: null }, 'a ' + k + ' I8c');
  });
  eq(nest(a, 'assets').I8c, { brain_md: false, brain_query_count: null, context_command_names: null, restated: null }, 'a assets I8c (no CONTEXT.md)');
});

// ---------------------------------------------------------------------------------------------------------------
// I9 state derivable by scanning
// shell: STATE.md frontmatter (computed | auto_created_at); find <nest> -type f -not -name STATE.md -printf '%T@\n' | sort -n | tail -1 ;
//        ls .mindrian/research-runs | wc -l ; find ... -name plan.json | wc -l   -> room a: 4 runs, 4 plan.json, 0 run.json, 0 operations.json
// ---------------------------------------------------------------------------------------------------------------
function newestMtimeMs(dirRel, roomDir, maxdepth) {
  const args = [path.join(roomDir, dirRel)];
  if (maxdepth) args.push('-maxdepth', String(maxdepth));
  args.push('-type', 'f', '-not', '-name', 'STATE.md', '-not', '-path', '*/.*', '-printf', '%T@\\n');
  const r = cp.spawnSync('find', args, { encoding: 'utf8' });
  const xs = String(r.stdout || '').split('\n').filter(Boolean).map(Number).sort((x, y) => x - y);
  return Math.round(xs[xs.length - 1] * 1000);
}
arm('I9 STATE.md present, last activity vs the newest artifact mtime (stale flag), research-run counts', () => {
  const a = report('a');
  eq(a.room.research_runs, { runs: 4, plan_json: 4, run_json: 0, operations_json: 0 }, 'a research_runs');
  const stateText = fs.readFileSync(path.join(A_DIR, 'STATE.md'), 'utf8');
  const created = /^auto_created_at: '?([^'\n]+)'?$/m.exec(stateText)[1];
  const root = nest(a, '.').I9;
  eq([root.state_md, root.last_activity], [true, new Date(created).toISOString()], 'a root state_md and last_activity (read from STATE.md at test time)');
  check(Math.abs(Date.parse(root.newest_file_mtime) - newestMtimeMs('.', A_DIR, 1)) <= 2, 'a root newest_file_mtime differs from find -printf');
  eq(root.stale, Date.parse(root.last_activity) < Date.parse(root.newest_file_mtime), 'a root stale follows the two timestamps');
  eq(nest(a, 'problem-definition').I9.state_md, false, 'a A state_md');
  eq([nest(a, 'problem-definition').I9.last_activity, nest(a, 'problem-definition').I9.stale], [null, null], 'a A last_activity and stale are null, not scored');
  const b = report('b');
  eq(b.room.research_runs, { runs: 0, plan_json: 0, run_json: 0, operations_json: 0 }, 'b research_runs (no .mindrian/research-runs directory)');
  const A = nest(b, 'problem-definition').I9;
  eq([A.state_md, A.last_activity, A.stale], [true, '2020-01-01T00:00:00.000Z', true], 'b A: computed 2020-01-01, artifacts newer');
  check(Math.abs(Date.parse(A.newest_file_mtime) - newestMtimeMs('problem-definition', B_DIR)) <= 2, 'b A newest_file_mtime differs from find -printf');
  const B = nest(b, 'market-analysis').I9;
  eq([B.state_md, B.last_activity, B.stale], [true, '2099-01-01T00:00:00.000Z', false], 'b B: computed 2099-01-01, nothing newer');
  eq(nest(b, 'solution-design').I9.state_md, false, 'b C state_md');
});

// ---------------------------------------------------------------------------------------------------------------
// I10 instantiate by copying
// shell: grep -l auto_scaffolded ; grep -l 'Seeded at birth'  (per nest, md files in the same scope as I5)
// ---------------------------------------------------------------------------------------------------------------
arm('I10 scaffold files carrying auto_scaffolded or the seeded-at-birth template line', () => {
  const a = report('a');
  A_NESTS.forEach((k) => {
    eq(nest(a, k).I10, { auto_scaffolded_files: 1, seeded_at_birth_files: NO_CONTEXT.indexOf(k) === -1 ? 1 : 0 }, 'a ' + k + ' I10');
  });
  eq(nest(a, '.').I10, { auto_scaffolded_files: 1, seeded_at_birth_files: 0 }, 'a root I10');
  const b = report('b');
  eq(nest(b, 'problem-definition').I10, { auto_scaffolded_files: 1, seeded_at_birth_files: 0 }, 'b A I10 (FEYNMAN overwritten)');
  eq(nest(b, 'market-analysis').I10, { auto_scaffolded_files: 1, seeded_at_birth_files: 1 }, 'b B I10');
});

// ---------------------------------------------------------------------------------------------------------------
// W walk test
// shell: count of ROOM.md CONTEXT.md BRIEF.md present ; STATE.md present ; grep -rIl --exclude-dir=node_modules -F BRAIN.md lib scripts hooks | wc -l
//        measured at HEAD before this quick: BRAIN.md 63, MINTO.md 127, FEYNMAN.md 22 (the tool and this test add files, so the live count
//        is cross-checked against the same grep at test time and floored at the pre-work numbers)
// ---------------------------------------------------------------------------------------------------------------
arm('W reads needed to orient, ROOM.md routes, status scannable, referrers of the three face names', () => {
  const a = report('a');
  eq(nest(a, '.').W.reads_needed, 1, 'a root reads_needed');
  eq(nest(a, '.').W.room_md_routes, false, 'a root routes (0 wikilinks)');
  eq(nest(a, '.').W.status_scannable, true, 'a root status_scannable (STATE.md present)');
  WITH_CONTEXT.forEach((k) => eq([nest(a, k).W.reads_needed, nest(a, k).W.status_scannable], [2, false], 'a ' + k + ' W'));
  NO_CONTEXT.forEach((k) => eq(nest(a, k).W.reads_needed, 1, 'a ' + k + ' reads_needed'));
  const b = report('b');
  eq(nest(b, 'problem-definition').W.reads_needed, 3, 'b A reads_needed (ROOM, CONTEXT, BRIEF)');
  eq(nest(b, 'problem-definition').W.room_md_routes, true, 'b A routes (4 wikilinks)');
  eq(nest(b, 'market-analysis').W.reads_needed, 3, 'b B reads_needed');
  eq(nest(b, 'market-analysis').W.room_md_routes, false, 'b B routes');
  eq(nest(b, 'solution-design').W.reads_needed, 2, 'b C reads_needed');
  const floor = { 'BRAIN.md': 63, 'MINTO.md': 127, 'FEYNMAN.md': 22 };
  Object.keys(floor).forEach((name) => {
    const r = cp.spawnSync('grep', ['-rIl', '--exclude-dir=node_modules', '--exclude-dir=.git', '-F', name, 'lib', 'scripts', 'hooks'], { cwd: ROOT, encoding: 'utf8' });
    const live = String(r.stdout || '').split('\n').filter(Boolean).length;
    eq(a.referrers[name], live, 'a referrers[' + name + '] equals the grep count at test time');
    check(live >= floor[name], 'referrers[' + name + '] ' + live + ' fell under the pre-work measurement ' + floor[name]);
    eq(nest(a, 'problem-definition').W.referrers[name], live, 'every nest carries the cached referrers[' + name + ']');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// M1 the tool writes nothing
// ---------------------------------------------------------------------------------------------------------------
arm('M1 the tool writes nothing: tree hash of both rooms, the rooms homes and HOME equal before and after (module and CLI, room.db present)', () => {
  const dirs = [A_DIR, B_DIR, A_ROOMS, B_ROOMS, HOME];
  const before = dirs.map(treeHash);
  mod().walkRoom(A_DIR);
  mod().walkRoom(B_DIR);
  const j = cli(['--icm-walk', '--room', B_DIR, '--json']);
  const t = cli(['--icm-walk', '--room', A_DIR]);
  eq([j.code, t.code], [0, 0], 'cli exit codes: ' + j.err.slice(-200) + t.err.slice(-200));
  const after = dirs.map(treeHash);
  eq(after, before, 'tree hashes (room a, room b, rooms home a, rooms home b, HOME)');
  ['-shm', '-wal'].forEach((s) => {
    const had = fs.existsSync(path.join(B_DIR, '.mindrian', 'room.db' + s));
    check(!had, 'a read-only open left a room.db' + s + ' behind in room b (a WAL database opened in place creates it)');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// M2 json
// ---------------------------------------------------------------------------------------------------------------
arm('M2 --json parses and carries every row for every nest', () => {
  const r = cli(['--icm-walk', '--room', A_DIR, '--json']);
  eq(r.code, 0, 'exit code: ' + r.err.slice(-200));
  const j = JSON.parse(r.out);
  eq(j.nests.length, 15, 'root plus 14 nests');
  const rows = ['I1', 'I2', 'I4', 'I5', 'I6', 'I7', 'I8a', 'I8b', 'I8c', 'I9', 'I10', 'W'];
  j.nests.forEach((n) => rows.forEach((row) => check(n[row] && typeof n[row] === 'object', n.nest + ' is missing row ' + row)));
  check(j.room && j.summary && j.referrers, 'room, summary and referrers blocks present');
  eq(j.room.slug, A_SLUG, 'json room slug');
});

// ---------------------------------------------------------------------------------------------------------------
// M3 summary
// shell: grep totals on the same rooms: faces present a 12, b 16 ; nests with all three faces a 0, b 1 ; marker true on b: A MINTO, A FEYNMAN
// ---------------------------------------------------------------------------------------------------------------
arm('M3 the room summary names the duplicates and the identity result (room a and room b)', () => {
  const ta = mod().renderText(report('a'));
  [
    /== room summary ==/, /nests walked: 14/, /nests with every face: 0/,
    /MINTO sources also listed in ROOM\.md links: 0/, /Theo face restating CONTEXT\.md sequence: 0 command name\(s\)/,
    /room identity in room\.db: no \(room\.db: present, Room node: no, identity rows naming the room: 0\)/,
    /edit-surface marker absent: 12 of 12 face file\(s\)/, /duplications found: 1 of 3/,
  ].forEach((re) => check(re.test(ta), 'room a summary lacks ' + re + '\n' + ta.slice(ta.indexOf('== room summary ==')) ));
  const tb = mod().renderText(report('b'));
  [
    /nests walked: 14/, /nests with every face: 1/, /MINTO sources also listed in ROOM\.md links: 2/,
    /Theo face restating CONTEXT\.md sequence: 2 command name\(s\)/,
    /room identity in room\.db: yes \(room\.db: present, Room node: yes, identity rows naming the room: 1\)/,
    /edit-surface marker absent: 14 of 16 face file\(s\)/, /duplications found: 2 of 3/,
  ].forEach((re) => check(re.test(tb), 'room b summary lacks ' + re + '\n' + tb.slice(tb.indexOf('== room summary =='))));
  const s = report('b').summary;
  eq([s.nests_walked, s.nests_with_every_face, s.minto_sources_in_room_md, s.theo_face_restated_commands, s.identity_in_room_db,
    s.edit_surface_marker_absent, s.face_files_present, s.duplications_found], [14, 1, 2, 2, true, 14, 16, 2], 'b summary object');
});

// ---------------------------------------------------------------------------------------------------------------
// M4 no room.db
// ---------------------------------------------------------------------------------------------------------------
arm('M4 a room with no room.db reports `room.db: missing` and still walks the files', () => {
  const copy = path.join(mk('nodb'), B_SLUG);
  fs.cpSync(B_DIR, copy, { recursive: true, filter: (src) => path.basename(src) !== '.mindrian' });
  check(!fs.existsSync(path.join(copy, '.mindrian', 'room.db')), 'fixture copy still has a room.db');
  const rep = mod().walkRoom(copy);
  eq([rep.room.room_db, rep.room.room_node, rep.room.identity_rows_total, rep.room.identity_rows_naming_room, rep.room.slug_db_agreement],
    ['missing', null, null, null, null], 'room block without a db');
  eq(nest(rep, 'problem-definition').I2, { lines: 54, bytes: 1764, wikilinks: 4, over_60_lines: false }, 'the files are still walked');
  eq(nest(rep, 'problem-definition').I8a, { minto_sources: 3, in_room_md: 2, absent_from_room_md: 1 }, 'I8a still measured');
  const text = mod().renderText(rep);
  check(/room\.db: missing/.test(text), 'the text does not say room.db: missing');
  const r = cli(['--icm-walk', '--room', copy]);
  eq(r.code, 0, 'cli exit on a room with no room.db');
  check(/room\.db: missing/.test(r.out), 'the CLI text does not say room.db: missing');
});

// ---------------------------------------------------------------------------------------------------------------
// M5 dash guard
// ---------------------------------------------------------------------------------------------------------------
arm('M5 dash guard: no em or en dash in the new files or in the lines the wiring added', () => {
  const files = [path.join(ROOT, 'tests', 'test-vi3-icm-walk.cjs'), MODULE_PATH].filter((f) => fs.existsSync(f));
  files.forEach((f) => {
    const text = fs.readFileSync(f, 'utf8');
    check(text.indexOf(EM) === -1 && text.indexOf(EN) === -1, f + ' carries an em or en dash');
  });
  [path.join(ROOT, 'scripts', 'doctor.cjs'), path.join(ROOT, 'commands', 'doctor.md')].forEach((f) => {
    const hit = fs.readFileSync(f, 'utf8').split('\n').filter((l) => /icm-walk|ICM walk/.test(l) && (l.indexOf(EM) !== -1 || l.indexOf(EN) !== -1));
    check(hit.length === 0, f + ' has a dash on an icm-walk line: ' + hit[0]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// M6 CLI text
// ---------------------------------------------------------------------------------------------------------------
arm('M6 `node scripts/doctor.cjs --icm-walk --room <a>` exits 0 and the text has one block per nest', () => {
  const r = cli(['--icm-walk', '--room', A_DIR]);
  eq(r.code, 0, 'exit code: ' + r.err.slice(-300));
  const heads = r.out.split('\n').filter((l) => /^== /.test(l));
  eq(heads.filter((l) => /^== room root: /.test(l)).length, 1, 'one root block');
  eq(heads.filter((l) => /^== nest: /.test(l)).map((l) => l.replace(/^== nest: /, '').replace(/ ==$/, '')), A_NESTS, 'one block per nest, sorted');
  check(heads.indexOf('== room summary ==') === heads.length - 1, 'the summary block comes last');
  ['I1', 'I2', 'I4', 'I5', 'I6', 'I7', 'I8a', 'I8b', 'I8c', 'I9', 'I10', 'W'].forEach((row) => {
    const n = r.out.split('\n').filter((l) => l.indexOf('  ' + row + '  ') === 0).length;
    eq(n, 15, 'rows labelled ' + row + ' (one per block)');
  });
  const bad = r.out.match(/\b(passed|healthy|good|bad|fail(ed)?|score)\b/gi);
  check(!bad, 'the text carries a verdict word: ' + (bad && bad[0]));
});

// ---------------------------------------------------------------------------------------------------------------
// M7 the read door
// ---------------------------------------------------------------------------------------------------------------
arm('M7 room.db is reached only through the navigation read-only door (no node:sqlite, no room-db.cjs, no write door)', () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  check(/openRoomDbReadOnlyForCaller/.test(src), 'module does not use openRoomDbReadOnlyForCaller');
  check(!/require\(['"]node:sqlite['"]\)/.test(src), 'module requires node:sqlite directly');
  check(!/room-db\.cjs/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'module requires room-db.cjs');
  check(!/openRoomDbForCaller\s*\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'module calls the write door');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
