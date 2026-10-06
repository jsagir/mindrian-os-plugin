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

  // room.db: birth already committed the Room node and the seven room.* keys (369.25-07); this adds one legacy row naming
  // the room, written through the navigation write door, so room b keeps one identity row the owner did not write
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const db = navigation.openRoomDbForCaller(B_DIR);
  try {
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
// 369.25-07 RE-MEASURED: the root ROOM.md gained one icm_self line (`  room_id: "<uuid>"`, 50 bytes) because birth now commits the
// identity and the map projects it: root 35 lines 1042 bytes became 36 lines 1092 bytes (wc -l, wc -c on a fresh release
// fixture room born offline); room b's root 41/1158 became 42/1208. No nest changes (nests are not rooms).
const A_I2 = { // [lines, bytes] ; wikilinks are 0 in every nest of room a
  '.': [36, 1092], assets: [21, 709], 'business-model': [44, 1467], 'competitive-analysis': [44, 1492], 'financial-model': [44, 1420],
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
  eq(nest(b, '.').I2, { lines: 42, bytes: 1208, wikilinks: 3, over_60_lines: false }, 'b root I2');
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
// 369.25-17 MOVING: birth now writes every core section's BRAIN.md (the FeyMinto Theo face, "not asked: at birth"), and the face
// carries brain_generated_at, so each of the 11 core nests of room a gained one md file and one generated-marked file. BEFORE:
// business-model 3/2, competitive-analysis 4/2, financial-model 3/2, funding 3/2, legal-ip 3/2, market-analysis 4/2, opportunity-bank
// 3/2, problem-definition 4/2, solution-design 4/2, strategy 4/2, team-execution 3/2. AFTER: one more of each (the table below).
// Measured on a fresh room a: find <nest> -type f -name '*.md' -not -path '*/.*' | wc -l ; grep -lE 'DO NOT EDIT|generated_at|
// last_generated_at|auto_scaffolded' over those files | wc -l. The root, assets, references and team are unchanged.
const A_I5 = { // [md files, generated-marked]
  '.': [4, 1], assets: [1, 1], 'business-model': [4, 3], 'competitive-analysis': [5, 3], 'financial-model': [4, 3], funding: [4, 3],
  'legal-ip': [4, 3], 'market-analysis': [5, 3], 'opportunity-bank': [4, 3], 'problem-definition': [5, 3], references: [3, 1],
  'solution-design': [5, 3], strategy: [5, 3], 'team-execution': [4, 3], team: [1, 1],
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
  eq(nest(b, 'market-analysis').I5, { md_files: 7, generated_marked: 3, authored: 4 }, 'b B I5 (369.25-17: birth wrote its BRAIN.md face; was 6 / 2)');
  eq(nest(b, 'solution-design').I5, { md_files: 4, generated_marked: 2, authored: 2 }, 'b C I5');
});

// ---------------------------------------------------------------------------------------------------------------
// I6 edit surface declared
// shell: grep -cE '^(editable_fields|edit_surface|human_edited):' <face> ; grep -m1 '^governing_thought_placeholder:' MINTO.md
// ---------------------------------------------------------------------------------------------------------------
// 369.25-15 MOVING: the seeded FEYNMAN.md of every nest now declares edit_surface, editable_fields and edit_recorded_in
// (plan 15, feynman-seed-writer). BEFORE: marker absent on 12 of 12 face files of room a (root MINTO + 11 FEYNMAN) and on
// 14 of 16 of room b. AFTER: room a keeps only the root MINTO bare (1 of 12); room b has the marker on A MINTO, A FEYNMAN
// and the ten seeded FEYNMAN of room b (absent 4 of 16: root MINTO, B MINTO, A and C BRAIN). Measured with `grep -qE '^(editable_fields|edit_surface|human_edited):'` per face file.
arm('I6 per face: present, edit-surface marker, governing_thought_placeholder (room a: seeded FEYNMAN marked, root MINTO bare; room b: marker on A MINTO, A FEYNMAN and the seeded FEYNMAN of B and C)', () => {
  const a = report('a');
  const missing = { present: false, edit_surface_marker: null, governing_thought_placeholder: null };
  const bare = { present: true, edit_surface_marker: false, governing_thought_placeholder: null };
  const marked = { present: true, edit_surface_marker: true, governing_thought_placeholder: null };
  eq(nest(a, '.').I6.faces, { 'MINTO.md': bare, 'FEYNMAN.md': missing, 'BRAIN.md': missing }, 'a root faces');
  // 369.25-17 MOVING: BEFORE the BRAIN.md of every core nest of room a was missing (11 of 11 absent); birth now writes the face,
  // and the face declares edit_surface, so it is present and marked (grep -cE '^(editable_fields|edit_surface|human_edited):' = 1).
  WITH_CONTEXT.forEach((k) => {
    eq(nest(a, k).I6.faces, { 'MINTO.md': missing, 'FEYNMAN.md': marked, 'BRAIN.md': marked }, 'a ' + k + ' faces');
  });
  NO_CONTEXT.forEach((k) => eq(nest(a, k).I6.faces, { 'MINTO.md': missing, 'FEYNMAN.md': missing, 'BRAIN.md': missing }, 'a ' + k + ' faces'));
  const b = report('b');
  eq(nest(b, 'problem-definition').I6.faces, {
    'MINTO.md': { present: true, edit_surface_marker: true, governing_thought_placeholder: true },
    'FEYNMAN.md': { present: true, edit_surface_marker: true, governing_thought_placeholder: null },
    'BRAIN.md': { present: true, edit_surface_marker: false, governing_thought_placeholder: null },
  }, 'b A faces');
  eq(nest(b, 'market-analysis').I6.faces, { 'MINTO.md': bare, 'FEYNMAN.md': marked, 'BRAIN.md': marked }, 'b B faces (369.25-17: birth wrote the BRAIN.md face)');
  eq(nest(b, 'solution-design').I6.faces, { 'MINTO.md': missing, 'FEYNMAN.md': marked, 'BRAIN.md': bare }, 'b C faces');
});

// ---------------------------------------------------------------------------------------------------------------
// I7 load only what the step needs
// shell: wc -c of ROOM.md CONTEXT.md MINTO.md FEYNMAN.md BRIEF.md, summed; tokens = (bytes + 3) / 4 (integer ceil)
// ---------------------------------------------------------------------------------------------------------------
// MOVING: CONTEXT.md is generated from data/section-command-ledger.json, which is rebuilt before every cut (a47d99571);
// its share is measured at test time per the header's rule for values that depend on HEAD. The literals below are the
// bytes of the files that are NOT generated (ROOM.md + MINTO.md + FEYNMAN.md + BRIEF.md that exist per nest), measured
// 2026-10-06 on room a at HEAD b3be0e5c6 with `wc -c` per file, summed per nest, CONTEXT.md excluded.
// Cross-check: solution-design = ROOM 1474 + FEYNMAN 113 = 1587 authored; its CONTEXT.md measured 4847, total 6434 tokens 1609,
// the value that reddened the old pin [6423, 1606] when the ledger rebuild moved CONTEXT.md by 11 bytes.
// 369.25-07 RE-MEASURED: the root is ROOM 1092 + MINTO 733 = 1825 (was 1775: the icm_self room_id line adds 50 bytes), wc -c.
// 369.25-15 RE-MEASURED: the seeded FEYNMAN.md now carries three frontmatter lines and the two FeyMinto blocks, +462 bytes
// on every nest that has one (wc -c per file: 111 123 113 97 99 113 115 119 113 99 111 became 573 585 575 559 561 575 577 581
// 575 561 573). Each value below is that nest's ROOM.md + FEYNMAN.md (wc -c), e.g. business-model 1467 + 573 = 2040.
// 369.25-17 RE-MEASURED: birth stamps room_id into every FEYNMAN.md (one frontmatter line, 9 + 36 + 1 = 46 bytes), so each nest
// that has a FEYNMAN.md grows by 46 bytes (wc -c per file, room a: 573 585 575 559 561 575 577 581 575 561 573 became
// 619 631 621 605 607 621 623 627 621 607 619). Each value below is that nest's ROOM.md + FEYNMAN.md (wc -c), e.g.
// business-model 1467 + 619 = 2086. BRAIN.md is not one of the I7 load files, so the face adds nothing here.
const A_I7_AUTHORED = { // authored bytes, CONTEXT.md excluded
  '.': 1825, assets: 709, 'business-model': 2086, 'competitive-analysis': 2123, 'financial-model': 2041,
  funding: 2131, 'legal-ip': 2036, 'market-analysis': 2098, 'opportunity-bank': 2146,
  'problem-definition': 2134, references: 1031, 'solution-design': 2095, strategy: 2181,
  'team-execution': 2034, team: 681,
};
function contextBytes(dir, k) {
  const f = path.join(dir, k === '.' ? '' : k, 'CONTEXT.md');
  return fs.existsSync(f) ? fs.statSync(f).size : 0;
}
// 369.25-15 RE-MEASURED: FEYNMAN.md bytes (wc -c) 573 585 575 559 561 575 577 581 575 561 573, of which the 164 byte
// frontmatter (three keys) is not body; body bytes (awk after the second --- line, wc -c) 409 421 411 395 397 411 413 417 411 397 409.
const A_FEYNMAN_TOKENS = { // ceil(body bytes / 4)
  'business-model': 103, 'competitive-analysis': 106, 'financial-model': 103, funding: 99, 'legal-ip': 100, 'market-analysis': 103,
  'opportunity-bank': 104, 'problem-definition': 105, 'solution-design': 103, strategy: 100, 'team-execution': 103,
};
arm('I7 bytes and approximate tokens of the loaded files, the 8000 flag, the FEYNMAN 1500 body budget', () => {
  const a = report('a');
  Object.keys(A_I7_AUTHORED).forEach((k) => {
    const n = nest(a, k);
    const expBytes = A_I7_AUTHORED[k] + contextBytes(A_DIR, k);
    eq([n.I7.bytes, n.I7.approx_tokens, n.I7.over_8000_tokens], [expBytes, Math.ceil(expBytes / 4), false], 'a ' + k + ' I7');
    eq(n.I7.feynman_body_tokens, A_FEYNMAN_TOKENS[k] === undefined ? null : A_FEYNMAN_TOKENS[k], 'a ' + k + ' feynman_body_tokens');
    eq(n.I7.feynman_over_1500, A_FEYNMAN_TOKENS[k] === undefined ? null : false, 'a ' + k + ' feynman_over_1500');
  });
  eq(nest(a, 'problem-definition').I7.files, { 'ROOM.md': 1507, 'CONTEXT.md': contextBytes(A_DIR, 'problem-definition'), 'MINTO.md': null, 'FEYNMAN.md': 627, 'BRIEF.md': null }, 'a problem-definition I7 files (369.25-17: 581 + the 46 byte room_id line)');
  const b = report('b');
  const A = nest(b, 'problem-definition').I7;
  // 369.25-16 MOVING: room b's CONTEXT.md share is measured at test time too (part 7 moved it by 862 bytes). Authored
  // bytes (CONTEXT.md excluded) = 8552 for nest A (old pin 13227 less its then-CONTEXT 4675) and 33904 for nest B,
  // each measured 2026-10-06 against the v2 writer; the equality of both to the old pins is checked by this arm passing.
  const bExpA = 8552 + contextBytes(B_DIR, 'problem-definition');
  eq([A.bytes, A.approx_tokens, A.over_8000_tokens], [bExpA, Math.ceil(bExpA / 4), false], 'b A I7');
  eq([A.feynman_body_tokens, A.feynman_over_1500], [1600, true], 'b A FEYNMAN body: 6400 bytes after the frontmatter -> 1600 tokens, over 1500');
  eq(A.files['BRIEF.md'], 32, 'b A BRIEF bytes');
  const B = nest(b, 'market-analysis').I7;
  // 369.25-15 RE-MEASURED: nest B's seeded FEYNMAN.md grew 113 -> 575 bytes, so ROOM 1708 + MINTO 83 + FEYNMAN 575 + BRIEF 32000 = 34366 (wc -c; was 33904)
  // 369.25-17 RE-MEASURED: birth stamped room_id into it, 575 -> 621 bytes, so 1708 + 83 + 621 + 32000 = 34412 (wc -c)
  const bExpB = 34412 + contextBytes(B_DIR, 'market-analysis');
  eq([B.bytes, B.approx_tokens, B.over_8000_tokens], [bExpB, Math.ceil(bExpB / 4), true], 'b B I7 (BRIEF 32000 bytes; authored 34412 + CONTEXT at test time)');
  // 369.25-07 RE-MEASURED: b root ROOM 1208 + MINTO 733 = 1941 bytes (wc -c), ceil(1941 / 4) = 486 tokens (was 1891 / 473)
  eq([nest(b, '.').I7.bytes, nest(b, '.').I7.approx_tokens], [1941, 486], 'b root I7');
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
// shell: grep -H '^room:' */MINTO.md ; sqlite3 -readonly room.db "select count(*) from identity;
//        select count(*) from identity where key in ('room.room_id','room.slug','room.canonical_path','room.parent','room.depth','room.created_at','room.birth_version');
//        select value from identity where key='room.room_id'; select count(*) from nodes where id='room:<slug>'"
//        -> room a: 14 / 7 / <uuid> / 1 ; room b: 15 / 7 / <uuid> / 1
// 369.25-07 RE-MEASURED: birth now commits the seven room.* keys and the Room node for every room, so room a went from
// 7 / 0 / 0 to 14 rows and room b from 8 / 1 / 1 to 15 rows (its extra legacy row room_slug still counts; the test no longer
// inserts the Room node itself, birth did).
// 369.25-14 RE-MEASURED: the walk counts the seven keys, not rows containing the slug (RESEARCH Pitfall 17), reads the room id,
// and compares each face's room: value with it. The room id is a fresh uuid per birth, so the arm checks its shape and reads
// the expected value back from the report's own room block instead of pinning a literal.
// ---------------------------------------------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
arm('I8b MINTO room value (slug and room id), room.db present, Room node, the seven identity keys, identity ready', () => {
  const a = report('a');
  check(UUID_RE.test(String(a.room.room_id)), 'a room_id is not a uuid: ' + a.room.room_id);
  eq([a.room.slug, a.room.room_db, a.room.room_node, a.room.identity_rows_total, a.room.identity_keys_present, a.room.identity_ready],
    [A_SLUG, 'present', true, 14, 7, true], 'a room identity (369.25-14: seven keys, ready)');
  eq(Object.keys(a.room).filter((k) => k === 'identity_rows_naming_room' || k === 'slug_db_agreement'), [], 'a room block carries no substring counters');
  const b = report('b');
  check(UUID_RE.test(String(b.room.room_id)), 'b room_id is not a uuid: ' + b.room.room_id);
  eq([b.room.room_db, b.room.room_node, b.room.identity_rows_total, b.room.identity_keys_present, b.room.identity_ready],
    ['present', true, 15, 7, true], 'b room identity');
  const bid = b.room.room_id;
  // 369.25-17 MOVING: I8b also reads FEYNMAN.md `room_id` and BRAIN.md `room_id` (and MINTO.md `room_slug`) and reports
  // matches_room_id per face (`faces`). Birth stamps room_id into every FEYNMAN.md and writes it into every BRAIN.md face, so
  // on room a each of the 11 core nests reads FEYNMAN true and BRAIN true (grep -m1 '^room_id:' <face> equals the room.db
  // value: sqlite3 -readonly room.db "select value from identity where key='room.room_id'"). Hand-written faces carry no
  // room_id and read null, never false.
  const nul = { value: null, matches_room_id: null };
  const keyed = (id) => ({ value: id, matches_room_id: true });
  eq(nest(b, 'problem-definition').I8b, { minto_room: 'vi3-scaffold-b', matches_slug: true, room_id_expected: bid, matches_room_id: false,
    minto_room_slug: null, matches_room_slug: null,
    faces: { 'MINTO.md': { value: 'vi3-scaffold-b', matches_room_id: false }, 'FEYNMAN.md': nul, 'BRAIN.md': nul } }, 'b A I8b (hand-written FEYNMAN and BRAIN carry no room_id)');
  eq(nest(b, 'market-analysis').I8b, { minto_room: 'some-other-room', matches_slug: false, room_id_expected: bid, matches_room_id: false,
    minto_room_slug: null, matches_room_slug: null,
    faces: { 'MINTO.md': { value: 'some-other-room', matches_room_id: false }, 'FEYNMAN.md': keyed(bid), 'BRAIN.md': keyed(bid) } }, 'b B I8b');
  eq(nest(b, 'solution-design').I8b, { minto_room: null, matches_slug: null, room_id_expected: bid, matches_room_id: null,
    minto_room_slug: null, matches_room_slug: null,
    faces: { 'MINTO.md': nul, 'FEYNMAN.md': keyed(bid), 'BRAIN.md': nul } }, 'b C I8b (MINTO missing, BRAIN hand-written)');
  eq(nest(a, '.').I8b, { minto_room: null, matches_slug: null, room_id_expected: a.room.room_id, matches_room_id: null,
    minto_room_slug: null, matches_room_slug: null,
    faces: { 'MINTO.md': nul, 'FEYNMAN.md': nul, 'BRAIN.md': nul } }, 'a root I8b (MINTO has no room key)');
  WITH_CONTEXT.forEach((k) => {
    eq(nest(a, k).I8b.faces, { 'MINTO.md': nul, 'FEYNMAN.md': keyed(a.room.room_id), 'BRAIN.md': keyed(a.room.room_id) }, 'a ' + k + ' I8b faces keyed by birth');
  });
  NO_CONTEXT.forEach((k) => eq(nest(a, k).I8b.faces, { 'MINTO.md': nul, 'FEYNMAN.md': nul, 'BRAIN.md': nul }, 'a ' + k + ' I8b faces (no faces)'));
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
// 369.25-17 REDEFINED AND MOVING: `restated` counts a section-2 name only on a BRAIN.md line with NO "(source: " tag; `tagged` counts the
// names found only on tagged lines; `asked` and `not_asked_reason` come from the face frontmatter. Measured per nest with
//   for n in <section-2 names>: grep -E -- "$n([^a-z0-9-]|$)" BRAIN.md | grep -v '(source: ' | grep -c .   (untagged lines)
// and the same without the -v filter (any line). BEFORE (room a): BRAIN.md missing in all 11 core nests (brain_md false). AFTER: the
// birth face is present (brain_query_count 0, asked false, not_asked_reason at_birth), restated 0 in every nest, and the section-2
// names it points at on tagged lines are in A_TAGGED. Room b A and C are hand-written BRAIN.md files with no source tags: A keeps
// restated 2 of 3, C keeps 0; room b B now has the birth face (tagged 2).
const A_TAGGED = { 'business-model': 3, 'competitive-analysis': 1, 'financial-model': 3, funding: 0, 'legal-ip': 1, 'market-analysis': 2,
  'opportunity-bank': 1, 'problem-definition': 1, 'solution-design': 3, strategy: 3, 'team-execution': 0 };
// MOVING 2026-10-06 (369.25 cut pre-step): the Jev-scored section-command ledger is rebuilt at every cut, and its candidate order is not
// deterministic across builds; opportunity-bank tagged moved 0 to 1 at the beta.63 rebuild, the other ten nests were re-measured equal
// (measured on a freshly born room: walkRoom I8c tagged per nest).
arm('I8c BRAIN.md present, brain_query_count, CONTEXT section-2 command names, the ones BRAIN.md restates without a source tag', () => {
  const b = report('b');
  eq(nest(b, 'problem-definition').I8c, { brain_md: true, brain_query_count: 3, context_command_names: 3, restated: 2, tagged: 0, asked: null, not_asked_reason: null }, 'b A I8c');
  eq(nest(b, 'solution-design').I8c, { brain_md: true, brain_query_count: 0, context_command_names: 3, restated: 0, tagged: 0, asked: null, not_asked_reason: null }, 'b C I8c');
  eq(nest(b, 'market-analysis').I8c, { brain_md: true, brain_query_count: 0, context_command_names: 3, restated: 0, tagged: 2, asked: false, not_asked_reason: 'at_birth' }, 'b B I8c (the birth face)');
  const a = report('a');
  Object.keys(A_NAMES).forEach((k) => {
    eq(nest(a, k).I8c, { brain_md: true, brain_query_count: 0, context_command_names: A_NAMES[k], restated: 0, tagged: A_TAGGED[k], asked: false, not_asked_reason: 'at_birth' }, 'a ' + k + ' I8c');
  });
  eq(nest(a, 'assets').I8c, { brain_md: false, brain_query_count: null, context_command_names: null, restated: null, tagged: null, asked: null, not_asked_reason: null }, 'a assets I8c (no CONTEXT.md)');
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
// I0 the eleven core sections (navigator ruling 2026-10-05: a room carries all 11 of CORE_SECTIONS)
// shell: for c in <the 11 names, section-registry.cjs CORE_SECTIONS order>; do [ -d $room/$c ] ...; done  -> present / missing ;
//        top-level nests (ROOM.md or CONTEXT.md) whose name is not one of the 11
//   room a (fixture): 11 present, none missing, non-core assets references team
//   room b as built (birthRoom scaffolds all 11): 11 present, none missing, non-core assets references team
//   room b with 8 core directories removed (a copy kept: problem-definition market-analysis solution-design): 3 present,
//        missing business-model competitive-analysis team-execution legal-ip financial-model opportunity-bank funding strategy,
//        non-core assets references team
//   live room (read only, measured by the same loop): 5 present, missing market-analysis business-model team-execution legal-ip
//        financial-model strategy, non-core assets assumptions references team
// ---------------------------------------------------------------------------------------------------------------
arm('I0 core sections present N of 11, the missing names, the non-core directories (fixture room: all 11; scaffolded room: all 11 as built, 3 after removing 8)', () => {
  const a = report('a');
  eq(a.room.I0, { core_present: 11, core_total: 11, core_missing: [], non_core_directories: ['assets', 'references', 'team'] }, 'a I0');
  eq(report('b').room.I0, { core_present: 11, core_total: 11, core_missing: [], non_core_directories: ['assets', 'references', 'team'] }, 'b I0 as built');
  const three = path.join(mk('three'), B_SLUG);
  const gone = ['business-model', 'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model', 'opportunity-bank', 'funding', 'strategy'];
  fs.cpSync(B_DIR, three, { recursive: true, filter: (src) => path.basename(src) !== '.mindrian' && gone.indexOf(path.basename(src)) === -1 });
  const t = mod().walkRoom(three);
  eq(t.room.I0, {
    core_present: 3, core_total: 11,
    core_missing: ['business-model', 'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model', 'opportunity-bank', 'funding', 'strategy'],
    non_core_directories: ['assets', 'references', 'team'],
  }, 'b with 8 core directories removed');
  const ta = mod().renderText(a);
  check(/^  I0  core sections present: 11 of 11 \| missing: none \| non-core directories \(3\): assets, references, team$/m.test(ta), 'room a I0 text row:\n' + ta.slice(0, 900));
  check(/^core sections present: 11 of 11$/m.test(ta), 'room a summary lacks the core sections line');
  const tt = mod().renderText(t);
  check(/^  I0  core sections present: 3 of 11 \| missing: business-model, competitive-analysis, team-execution, legal-ip, financial-model, opportunity-bank, funding, strategy \| non-core directories \(3\): assets, references, team$/m.test(tt), 'three-section I0 text row');
  check(/^core sections present: 3 of 11$/m.test(tt), 'three-section summary line');
  eq(report('a').summary.core_sections_present, 11, 'a summary.core_sections_present');
  eq(t.summary.core_sections_present, 3, 'three-section summary.core_sections_present');
  // the I0 row is a room-block row: it appears once in the text, not once per nest
  eq(ta.split('\n').filter((l) => l.indexOf('  I0  ') === 0).length, 1, 'one I0 row per run');
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
// 369.25-17 MOVING: birth writes a BRAIN.md face in every core nest, so faces present a 12 -> 23 and b 16 -> 25, nests with all three faces
// b 1 -> 2 (market-analysis gained the face), marker absent a 1 of 23, b 4 of 25 (root MINTO, B MINTO, and the hand-written BRAIN.md of A and C).
// Measured: ls <room>/MINTO.md <room>/FEYNMAN.md <room>/BRAIN.md <room>/*/MINTO.md <room>/*/FEYNMAN.md <room>/*/BRAIN.md | wc -l, then grep -qE the marker per file.
// (earlier) shell: grep totals on the same rooms: faces present a 12, b 16 ; nests with all three faces a 0, b 1 ; marker true on b: A MINTO, A FEYNMAN, and
// (369.25-15 MOVING, BEFORE: absent 12 of 12 on a and 14 of 16 on b) the seeded FEYNMAN of B and C; on a only the root MINTO stays bare (1 of 12)
// ---------------------------------------------------------------------------------------------------------------
arm('M3 the room summary names the duplicates and the identity result (room a and room b)', () => {
  const ta = mod().renderText(report('a'));
  [
    /== room summary ==/, /nests walked: 14/, /nests with every face: 0/,
    /MINTO sources also listed in ROOM\.md links: 0/, /Theo face restating CONTEXT\.md sequence: 0 command name\(s\)/,
    /room identity in room\.db: yes \(room\.db: present, Room node: yes, identity keys: 7 of 7, room_id: [0-9a-f-]{36}\)/,
    /edit-surface marker absent: 1 of 23 face file\(s\)/, /duplications found: 0 of 3/,
  ].forEach((re) => check(re.test(ta), 'room a summary lacks ' + re + '\n' + ta.slice(ta.indexOf('== room summary ==')) ));
  const tb = mod().renderText(report('b'));
  [
    /nests walked: 14/, /nests with every face: 2/, /MINTO sources also listed in ROOM\.md links: 2/,
    /Theo face restating CONTEXT\.md sequence: 2 command name\(s\)/,
    /room identity in room\.db: yes \(room\.db: present, Room node: yes, identity keys: 7 of 7, room_id: [0-9a-f-]{36}\)/,
    /edit-surface marker absent: 4 of 25 face file\(s\)/, /duplications found: 2 of 3/,
  ].forEach((re) => check(re.test(tb), 'room b summary lacks ' + re + '\n' + tb.slice(tb.indexOf('== room summary =='))));
  const s = report('b').summary;
  eq([s.nests_walked, s.nests_with_every_face, s.minto_sources_in_room_md, s.theo_face_restated_commands, s.identity_in_room_db,
    s.edit_surface_marker_absent, s.face_files_present, s.duplications_found], [14, 2, 2, 2, true, 4, 25, 2], 'b summary object');
});

// ---------------------------------------------------------------------------------------------------------------
// M4 no room.db
// ---------------------------------------------------------------------------------------------------------------
arm('M4 a room with no room.db reports `room.db: missing` and still walks the files', () => {
  const copy = path.join(mk('nodb'), B_SLUG);
  fs.cpSync(B_DIR, copy, { recursive: true, filter: (src) => path.basename(src) !== '.mindrian' });
  check(!fs.existsSync(path.join(copy, '.mindrian', 'room.db')), 'fixture copy still has a room.db');
  const rep = mod().walkRoom(copy);
  eq([rep.room.room_db, rep.room.room_node, rep.room.identity_rows_total, rep.room.identity_keys_present, rep.room.identity_ready],
    ['missing', null, null, null, null], 'room block without a db (369.25-14: the seven-key fields replace the substring counters)');
  eq([rep.room.room_id, rep.room.identity_ready], [null, null], 'room block without a db: no room id, identity not judged');
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
