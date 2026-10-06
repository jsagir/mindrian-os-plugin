#!/usr/bin/env node
'use strict';
/*
 * Phase 369.25 plan 19 -- BRIEF.md materialized on the two triggers (the on-stop section walk and the MINTO regeneration).
 *
 * RED first: this file is committed before scripts/on-stop or scripts/vault-section-minto-generator.cjs render BRIEF.md.
 *
 * Arms:
 *   BW1  a born room, every generator-addressable nest (9 of the 11 face-carrying; funding and strategy are outside the scanner's
 *        KNOWN_SECTIONS) regenerated with the generator --write: each has BRIEF.md with the ten headings,
 *        a generated_at line (so the walk's generated-marker pattern counts it) and a record_basis_fingerprint
 *   BW2  scripts/on-stop (child process, isolated HOME, the room as its working room) on a room whose nests have no BRIEF writes one
 *        per face-carrying nest (and none for a directory with no face); a second and third run with no input change leave every
 *        BRIEF.md byte-identical (ROOM.md references recompiled by the same stop do not move the brief)
 *   BW3  one nest regenerated after a new artifact: only that nest's BRIEF.md changes (its fingerprint differs); the others are
 *        byte-identical, also after a further stop
 *   BW4  on-stop wall time over the nests measured three times, each exit 0; with MINDRIAN_BRIEF_ONSTOP_BUDGET_MS=1 the run writes
 *        at most one BRIEF.md and still exits 0; a person's YOUR DECISION text between the sentinels survives a re-render
 *   BW5  doctor --icm-walk --json: no nest's load is flagged over 8000 tokens, the count of nests with every face equals the
 *        regenerated nests (9; the plan expected 11, see the SUMMARY), and
 *        BRIEF.md is never counted as an artifact (no [[BRIEF]] in any ROOM.md, no BRIEF in any MINTO sources)
 *   BW6  PROPOSED NEXT MOVE shows both surface lines exactly where the CLI and MCP primaries differ; dash guard on every brief
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs). No Theo call is made
 * (rooms are born with the Theo face not asked). Nothing is written under ~/MindrianRooms or ~/.mindrian.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const GEN = path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const ON_STOP = path.join(ROOT, 'scripts', 'on-stop');
const DOCTOR = path.join(ROOT, 'scripts', 'doctor.cjs');
const SEC = 'problem-definition';
const TEN = [
  '## THIS NEST SERVES',
  '## WE CURRENTLY THINK',
  '## BECAUSE',
  '## BUT',
  '## WHAT CHANGED',
  '## THE QUESTION THAT MATTERS NOW',
  '## PROPOSED NEXT MOVE',
  "## THEO'S CONTRIBUTION",
  '## YOUR DECISION',
  '## RECORD BASIS',
];
const DS = '<!-- feyminto:your-decision:start -->';
const DE = '<!-- feyminto:your-decision:end -->';
const WALL_BUDGET_MS = 3000; // the Stop hook's timeout in hooks/hooks.json

const arms = [];
function arm(name, fn) { arms.push({ name, fn }); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}

function born(tag) {
  const iso = H.mkIsolatedHome(tag);
  const slug = 'bw-' + tag;
  const b = H.birthFixtureRoom({ iso, slug, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  return { iso, roomDir, slug };
}

// The nests that carry a face (the ones a brief reads): FEYNMAN.md, MINTO.md or BRAIN.md present.
function faceNests(roomDir) {
  return fs.readdirSync(roomDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name[0] !== '.')
    .map((d) => d.name)
    .filter((n) => ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md'].some((f) => fs.existsSync(path.join(roomDir, n, f))))
    .sort();
}

function gen(room, section) {
  const r = spawnSync(process.execPath, [GEN, '--write', room.roomDir, '--section', section], { env: room.iso.env, encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw new Error('generator exit ' + r.status + ' for ' + section + '\n' + r.stderr + r.stdout);
}

function stop(room, extraEnv) {
  const env = Object.assign({}, room.iso.env, extraEnv || {});
  const t0 = Date.now();
  const r = spawnSync('bash', [ON_STOP], { cwd: room.roomDir, env, input: '', encoding: 'utf8', timeout: 60000 });
  return { code: r.status, ms: Date.now() - t0, out: r.stdout, err: r.stderr };
}

function briefPath(room, section) { return path.join(room.roomDir, section, 'BRIEF.md'); }
function readBrief(room, section) { try { return fs.readFileSync(briefPath(room, section), 'utf8'); } catch (_e) { return null; } }
function sha(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function snapshotBriefs(room, sections) {
  const o = {};
  sections.forEach((s) => { const t = readBrief(room, s); o[s] = t === null ? null : sha(t); });
  return o;
}
function fmOf(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  m[1].split(/\r?\n/).forEach((ln) => {
    const k = ln.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (k) out[k[1]] = k[2].replace(/^"(.*)"$/, '$1');
  });
  return out;
}
function h2s(text) {
  const body = String(text).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  return body.match(/^## .+$/gm) || [];
}

// The generator regenerates only the sections lib/vault/room-scanner.cjs KNOWN_SECTIONS names; a born room also carries funding
// and strategy, which that older list does not (a finding recorded in the SUMMARY, not fixed here). They get their brief from
// the on-stop trigger only.
const KNOWN = require(path.join(ROOT, 'lib', 'vault', 'room-scanner.cjs')).KNOWN_SECTIONS;

// One born room with every generator-addressable nest regenerated (shared by BW1, BW5 and BW6).
let REGEN_ROOM = null;
function regenRoom() {
  if (REGEN_ROOM) return REGEN_ROOM;
  const room = born('regen');
  const nests = faceNests(room.roomDir);
  fs.writeFileSync(path.join(room.roomDir, SEC, 'interview-notes.md'),
    '---\ntitle: Onboarding interview\nframework: 5 Whys Technique\n---\n# Onboarding interview\n\nFounders say onboarding takes three weeks.\n', 'utf8');
  const regenerated = nests.filter((s) => KNOWN.has(s));
  regenerated.forEach((s) => gen(room, s));
  REGEN_ROOM = Object.assign(room, { nests, regenerated });
  return REGEN_ROOM;
}

// ---- BW1 ---------------------------------------------------------------------------------------------------------

arm('BW1 each regenerated nest has BRIEF.md: ten headings, generated_at, record_basis_fingerprint', () => {
  const room = regenRoom();
  eq(room.nests.length, 11, 'face-carrying nests of a born room');
  eq(room.regenerated.length, 9, 'nests the generator can regenerate (KNOWN_SECTIONS)');
  room.regenerated.forEach((s) => {
    const text = readBrief(room, s);
    check(text !== null, s + ': BRIEF.md was not written by the generator --write');
    eq(h2s(text), TEN, s + ': the ten H2 headings in order');
    const f = fmOf(text);
    check(/^\d{4}-\d\d-\d\dT/.test(f.generated_at || ''), s + ': generated_at in frontmatter: ' + f.generated_at);
    check(/^sha256:[0-9a-f]{64}$/.test(f.record_basis_fingerprint || ''), s + ': record_basis_fingerprint: ' + f.record_basis_fingerprint);
    eq(f.generated, 'true', s + ': generated: true');
  });
});

// ---- BW2 ---------------------------------------------------------------------------------------------------------

arm('BW2 on-stop writes a BRIEF per face-carrying nest, none elsewhere; two more stops leave every byte identical', () => {
  const room = born('stop');
  const nests = faceNests(room.roomDir);
  nests.forEach((s) => check(readBrief(room, s) === null, s + ': fixture must start with no BRIEF.md'));
  const r1 = stop(room);
  eq(r1.code, 0, 'first stop exit code: ' + r1.err.slice(-300));
  nests.forEach((s) => {
    const text = readBrief(room, s);
    check(text !== null, s + ': BRIEF.md not written by on-stop');
    eq(h2s(text), TEN, s + ': ten headings');
  });
  const none = fs.readdirSync(room.roomDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name[0] !== '.' && nests.indexOf(d.name) === -1);
  check(none.length > 0, 'fixture has a directory with no face');
  none.forEach((d) => check(readBrief(room, d.name) === null, d.name + ': a directory with no face must not get a BRIEF.md'));
  const after1 = snapshotBriefs(room, nests);
  const r2 = stop(room);
  const r3 = stop(room);
  eq([r2.code, r3.code], [0, 0], 'second and third stop exit codes');
  eq(snapshotBriefs(room, nests), after1, 'BRIEF.md bytes after the second and third stop equal the first');
});

// ---- BW3 ---------------------------------------------------------------------------------------------------------

arm('BW3 one nest regenerated after a new artifact: only its BRIEF.md changes', () => {
  const room = born('one');
  const nests = faceNests(room.roomDir);
  eq(stop(room).code, 0, 'priming stop');
  const before = snapshotBriefs(room, nests);
  nests.forEach((s) => check(before[s] !== null, s + ': primed brief missing'));
  fs.writeFileSync(path.join(room.roomDir, SEC, 'customer-calls.md'),
    '---\ntitle: Customer calls\nframework: 80/20 Rule\n---\n# Customer calls\n\nThree of five buyers named setup time.\n', 'utf8');
  gen(room, SEC);
  const mid = snapshotBriefs(room, nests);
  const changed = nests.filter((s) => mid[s] !== before[s]);
  eq(changed, [SEC], 'nests whose BRIEF.md changed after one regeneration');
  const f0 = fmOf(readBrief(room, SEC));
  check(/^sha256:/.test(f0.record_basis_fingerprint || ''), 'fingerprint present on the changed brief');
  eq(stop(room).code, 0, 'stop after the regeneration');
  const end = snapshotBriefs(room, nests);
  nests.filter((s) => s !== SEC).forEach((s) => eq(end[s], before[s], s + ': an untouched nest stays byte-identical after a stop'));
});

// ---- BW4 ---------------------------------------------------------------------------------------------------------

arm('BW4 on-stop wall time over the nests (3 runs); budget 1 ms writes at most one; YOUR DECISION text survives', () => {
  const room = born('wall');
  const nests = faceNests(room.roomDir);
  const runs = [stop(room), stop(room), stop(room)];
  console.log('  BW4 wall ms (fresh, then two unchanged): ' + runs.map((r) => r.ms).join(', '));
  runs.forEach((r, i) => {
    eq(r.code, 0, 'run ' + i + ' exit code');
    check(r.ms < WALL_BUDGET_MS, 'run ' + i + ' took ' + r.ms + ' ms, over the ' + WALL_BUDGET_MS + ' ms hook timeout');
  });
  nests.forEach((s) => check(readBrief(room, s) !== null, s + ': BRIEF.md not written by the first of three stops'));

  const tiny = born('tiny');
  const rt = stop(tiny, { MINDRIAN_BRIEF_ONSTOP_BUDGET_MS: '1' });
  eq(rt.code, 0, 'budget 1 ms exit code: ' + rt.err.slice(-300));
  const written = faceNests(tiny.roomDir).filter((s) => readBrief(tiny, s) !== null);
  check(written.length >= 1 && written.length <= 1, 'budget 1 ms wrote ' + written.length + ' BRIEF.md files, expected exactly one (render, then the deadline check)');
  const rt2 = stop(tiny, { MINDRIAN_BRIEF_ONSTOP_BUDGET_MS: '1' });
  eq(rt2.code, 0, 'second budget 1 ms exit code');
  const written2 = faceNests(tiny.roomDir).filter((s) => readBrief(tiny, s) !== null);
  check(written2.length > written.length, 'a later stop reaches a nest the first one left (' + written.length + ' then ' + written2.length + ')');

  // A person's text between the sentinels is kept when the brief re-renders for a changed input.
  const p = briefPath(room, SEC);
  const text = fs.readFileSync(p, 'utf8');
  const a = text.indexOf(DS);
  const b = text.indexOf(DE);
  check(a !== -1 && b > a, 'sentinels present in the brief');
  const mine = 'Run the 5 whys first; defer the rest until the interviews are in.';
  fs.writeFileSync(p, text.slice(0, a + DS.length) + '\n' + mine + '\n' + text.slice(b));
  fs.writeFileSync(path.join(room.roomDir, SEC, 'extra-note.md'), '# Extra note\n\nA new input.\n', 'utf8');
  gen(room, SEC);
  const text2 = fs.readFileSync(p, 'utf8');
  check(text2 !== text, 'the brief re-rendered for the new input');
  const a2 = text2.indexOf(DS);
  const b2 = text2.indexOf(DE);
  eq(text2.slice(a2 + DS.length, b2).trim(), mine, 'YOUR DECISION text kept verbatim between the sentinels');
});

// ---- BW5 ---------------------------------------------------------------------------------------------------------

arm('BW5 the walk: no nest over 8000 tokens, 11 nests with every face, BRIEF.md never an artifact', () => {
  const room = regenRoom();
  eq(stop(room).code, 0, 'stop on the regenerated room');
  const r = spawnSync(process.execPath, [DOCTOR, '--icm-walk', '--room', room.roomDir, '--json'], { env: room.iso.env, encoding: 'utf8', timeout: 120000 });
  eq(r.status, 0, 'doctor --icm-walk exit code: ' + String(r.stderr).slice(-300));
  const j = JSON.parse(r.stdout);
  const over = j.nests.filter((n) => n.I7 && n.I7.over_8000_tokens === true).map((n) => n.nest);
  eq(over, [], 'nests over the 8000-token load flag');
  const withBrief = j.nests.filter((n) => n.I7 && n.I7.files && typeof n.I7.files['BRIEF.md'] === 'number').length;
  eq(withBrief, 11, 'nests whose load includes BRIEF.md');
  console.log('  BW5 nests with every face: ' + j.summary.nests_with_every_face + ' (generator-regenerated: ' + room.regenerated.length + ' of 11; funding and strategy are outside KNOWN_SECTIONS)');
  eq(j.summary.nests_with_every_face, room.regenerated.length, 'nests with every face (MINTO, FEYNMAN, BRAIN) equal the regenerated nests');
  room.nests.forEach((s) => {
    const roomMd = fs.readFileSync(path.join(room.roomDir, s, 'ROOM.md'), 'utf8');
    check(!/\[\[BRIEF[\]|#]/.test(roomMd), s + ': ROOM.md lists BRIEF.md as an artifact');
    const minto = fs.readFileSync(path.join(room.roomDir, s, 'MINTO.md'), 'utf8');
    check(!/\[\[BRIEF[\]|#]/.test(minto), s + ': MINTO.md lists BRIEF.md as a source');
  });
});

// ---- BW6 ---------------------------------------------------------------------------------------------------------

arm('BW6 both surface lines exactly where the primaries differ; no dash in any brief', () => {
  const room = regenRoom();
  eq(stop(room).code, 0, 'stop on the regenerated room (renders the two nests the generator cannot reach)');
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  let differing = 0;
  room.nests.forEach((s) => {
    const text = readBrief(room, s);
    check(text !== null, s + ': BRIEF.md missing');
    const dir = path.join(room.roomDir, s);
    const cli = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: dir, surface: 'cli' });
    const mcp = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: dir, surface: 'mcp' });
    const a = cli && cli.primary ? cli.primary.command : null;
    const b = mcp && mcp.primary ? mcp.primary.command : null;
    const hasBoth = text.indexOf('On the command line: ') !== -1 && text.indexOf('In Desktop and Cowork: ') !== -1;
    if (a !== b) {
      differing += 1;
      check(hasBoth, s + ': primaries differ (' + a + ' vs ' + b + ') but the brief lacks both surface lines');
    } else {
      check(!hasBoth, s + ': primaries agree (' + a + ') but the brief prints two surface lines');
    }
  });
  check(differing >= 1, 'at least one nest has differing primaries on a born room (plan 18 measured 4 of 11), got ' + differing);
  const files = room.nests.map((s) => briefPath(room, s));
  eq(H.dashGuard(files), [], 'briefs carrying an em or en dash');
});

(async () => {
  let pass = 0;
  let fail = 0;
  for (const a of arms) {
    try { await a.fn(); pass += 1; console.log('PASS ' + a.name); }
    catch (e) { fail += 1; console.log('FAIL ' + a.name + '\n     ' + String((e && e.message) || e).split('\n').join('\n     ').slice(0, 900)); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
