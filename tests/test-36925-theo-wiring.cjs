#!/usr/bin/env node
'use strict';
/*
 * Phase 369.25 plan 17 -- the Theo face wired into the one BRAIN.md writer and into birth.
 *
 * RED first: this file is committed before lib/core/brain-derivation.cjs composes the FeyMinto face, before the
 * schema knows the six face headings, before birth writes the faces and before the walk counts untagged restatements.
 *
 * Arms:
 *   T1   deriveSection on a born nest with a MINTO.md and an injected Theo writes BRAIN.md whose body starts with the
 *        six face headings (Shared premise only because the canned neighborhoods share a chapter), then the nine
 *        legacy headings; frontmatter carries asked, queries_sent, the four rows_*, handles_*, handles_on_wire,
 *        room_id equal to readRoomIdentity's, edit_surface; validateSchema gives no unknown-heading violation; the
 *        real "M of T chapters" line is printed (coverage carried through theo-ask)
 *   T1b  list scalars: a comma and an apostrophe in a canonical framework name survive the frontmatter
 *        (percent-encoded on disk, decodeFaceList recovers the names)
 *   T2   Canon Part 8 canary: the payloads Theo and the legacy reads received hold only problem_type, max_steps and
 *        framework (no limit), only enum or canonical values; a planted governing thought, artifact title, venture
 *        name and a non-canonical framework name appear in no payload and in no frontmatter
 *   T3   the six response classes read, in the legacy sections: the no-handle line, "Theo did not answer", the egress
 *        line, "Theo refused this read (tier_denied)", "(no signal)" (empty records only), the rendered rows
 *   T4   options.offline: zero Theo and legacy calls; the suggestions and every legacy section read the offline line
 *   T5   a nest with no MINTO.md gets its face: with a room rung the handles are asked, without one the face says
 *        "not asked: no problem type or framework handle to send"; ensureSectionDerived no longer returns
 *        triple_incomplete
 *   T6   a born room: every core section has BRAIN.md (asked false, not_asked_reason at_birth, room_id), every
 *        FEYNMAN.md carries room_id, the birth stdout no longer says "BRAIN derivation enqueued"; the face does not
 *        lift the tier above tier_0
 *   T7   doctor --icm-walk I8c counts only names restated on a line without a source tag, and reports tagged, asked
 *        and not_asked_reason; I8b reads room_id from FEYNMAN.md and BRAIN.md and room_slug from MINTO.md
 *   T8   dash guard; the empty-answer sentinel appears only in T3's empty-records room
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs). Every Theo
 * read is an injected stub: zero network. Nothing is written under ~/MindrianRooms or ~/.mindrian.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SEC = 'problem-definition';
const NO_SIGNAL = '(no ' + 'signal)';
const FACE_HEADINGS = [
  '## Provenance',
  '## FeyMinto: what Theo suggests for this nest',
  '## Command sources for this nest',
  '## Why it fits the unresolved question',
  '## Limitations',
  '## Shared premise',
];
const LEGACY_HEADINGS = [
  '## Pattern Matches', '## Cross-Domain Analogies', '## Wicked Indicators', '## Unfilled Opportunity Matches',
  '## Framework Chain Predictions', '## Assessment Thinking Chain Position', '## ProblemType Classification',
  '## Flagged Contradictions (cross-room)', '## HSI Signals',
];
const GEN = path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs');

const arms = [];
function arm(name, fn) { arms.push({ name, fn }); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}

// ---- stubs -------------------------------------------------------------------------------------------------

const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
const NAV_CMDS = REG.filter((c) => c.surface === 'navigator').map((c) => c.command.replace(/^\/mos:/, ''));
const CANON = (() => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8'));
  return new Set([].concat(d.framework_names || [], d.curated_extras || []).map((n) => n.toLowerCase()));
})();

function clone(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v)); }

// Canned Theo answers. The envelope is the one theo-ask.cjs reads defensively (rows arrays, a chain, a bare row);
// the repo does not pin the real envelope, so these shapes are what this test proves and nothing more.
function theoGood(tool, args) {
  if (tool === 'find_frameworks_for_problem_type') {
    return {
      rows: [{
        problemType: args.problem_type,
        chapters: [
          { chapterId: 'ch-01', phaseLabel: 'Frame the problem', toolTypes: ['Matrix'] },
          { chapterId: 'ch-02', phaseLabel: 'Test the frame', toolTypes: ['Experiment'] },
        ],
        matched: 2,
        total: 9,
      }],
      coverage: { matched: 2, total: 9, status: 'partial' },
    };
  }
  if (tool === 'commands_for_problem_type') {
    return { rows: [{ command: NAV_CMDS[0], jtbd: 'Name the problem', framework: '5 Whys Technique' }] };
  }
  if (tool === 'recommend_chain') {
    return { grounded: true, chain: [{ step: 1, framework: '5 Whys Technique' }, { step: 2, framework: '80/20 Rule' }] };
  }
  if (tool === 'framework_neighborhood') {
    return { name: args.framework, chapters: [{ id: 'ch-07', label: 'Chapter 7' }], brainRecords: [], commands: [] };
  }
  return null;
}

function uninstall() {
  const bc = require.resolve('../lib/core/brain-client.cjs');
  delete require.cache[bc];
  delete require.cache[require.resolve('../lib/core/brain-derivation.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation-prompts.cjs')];
}

// Install a fake brain-client (the seam lib/memory/brain-derivation.test.cjs uses) and a fresh brain-derivation.
function install(o) {
  const opts = o || {};
  const calls = { callTool: [], query: [], search: [], schema: 0 };
  const bc = require.resolve('../lib/core/brain-client.cjs');
  const real = require(bc);
  const fake = {
    isAvailable: () => opts.isAvailable !== false,
    schema: async () => { calls.schema += 1; return { brain_graph_version: 21432 }; },
    query: async (q) => {
      calls.query.push(clone(q));
      return opts.query ? opts.query(q, calls.query.length) : { records: [{ name: 'SWOT', description: 'x' }] };
    },
    search: async (q, op) => {
      calls.search.push(clone({ q, op }));
      return opts.search ? opts.search(q, calls.search.length) : { matches: [{ title: 'Analogy 1', score: 0.8 }] };
    },
    smartSearch: async () => null,
    callTool: async (tool, args) => {
      calls.callTool.push({ tool, args: clone(args) });
      return opts.callTool ? opts.callTool(tool, args) : theoGood(tool, args);
    },
    getBrainUrl: () => 'https://theo-stub.invalid',
    _test: real._test,
  };
  require.cache[bc] = { id: bc, filename: bc, loaded: true, exports: fake };
  delete require.cache[require.resolve('../lib/core/brain-derivation.cjs')];
  delete require.cache[require.resolve('../lib/core/brain-derivation-prompts.cjs')];
  const derive = require('../lib/core/brain-derivation.cjs');
  return { calls, derive };
}

// ---- fixtures ----------------------------------------------------------------------------------------------

const ROOMS = []; // { dir, allowNoSignal }

function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }
function identity(roomDir) {
  return require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')).readRoomIdentity(roomDir, { door: 'in_place' });
}

function born(tag, o) {
  const opts = o || {};
  const iso = H.mkIsolatedHome(tag);
  const slug = 'tw-' + tag;
  const b = H.birthFixtureRoom({ iso, slug, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  const room = { iso, roomDir, slug, room_id: b.room_id, birth: b };
  ROOMS.push({ dir: roomDir, allowNoSignal: opts.allowNoSignal === true });
  return room;
}

function writeArtifacts(room, frameworksA, frameworksB) {
  fs.writeFileSync(path.join(room.roomDir, SEC, 'interview-notes.md'),
    '---\ntitle: Zanzibar onboarding interview\nframework: ' + frameworksA + '\n---\n# Zanzibar onboarding interview\n\nFounders say onboarding takes three weeks.\n', 'utf8');
  fs.writeFileSync(path.join(room.roomDir, SEC, 'problem-statement.md'),
    '---\ntitle: Problem statement\nframeworks: ' + frameworksB + '\n---\n# Problem statement\n\nNew hires wait too long to be useful.\n', 'utf8');
}

// A born nest with two artifacts and a generated MINTO.md; the governing thought is replaced by a planted canary.
function bornWithMinto(tag, o) {
  const opts = o || {};
  const room = born(tag, opts);
  writeArtifacts(room, opts.frameworkA || '5 Whys Technique',
    opts.frameworksB || '[80/20 Rule, Quokka Method]');
  const r = spawnSync(process.execPath, [GEN, '--write', room.roomDir, '--section', SEC], { env: room.iso.env, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error('generator exit ' + r.status + '\n' + r.stderr + r.stdout);
  const mp = path.join(room.roomDir, SEC, 'MINTO.md');
  const t = fs.readFileSync(mp, 'utf8').replace(/^governing_thought: ".*"$/m, 'governing_thought: "llama unicorn thesis for the quokka market"');
  fs.writeFileSync(mp, t, 'utf8');
  return room;
}

function readBrain(room, section) { return fs.readFileSync(path.join(room.roomDir, section || SEC, 'BRAIN.md'), 'utf8'); }

// A narrow frontmatter reader: `key: value` lines between the first two --- lines; quotes stripped.
function fm(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  m[1].split(/\r?\n/).forEach((ln) => {
    const k = ln.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (k) out[k[1]] = k[2].replace(/^"(.*)"$/, '$1');
  });
  return out;
}
function bodyOf(text) { const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/); return m ? m[1] : ''; }
function headings(text) { return (bodyOf(text).match(/^## .+$/gm) || []); }
function sectionMap(text) {
  const out = {};
  bodyOf(text).split(/^## /m).slice(1).forEach((p) => {
    const nl = p.indexOf('\n');
    out['## ' + (nl < 0 ? p : p.slice(0, nl))] = (nl < 0 ? '' : p.slice(nl + 1)).trim();
  });
  return out;
}

function nestHasFace(room, section) { return fs.existsSync(path.join(room.roomDir, section, 'BRAIN.md')); }

const NOT_ASKED = {
  no_handle: 'not asked: no problem type or framework handle to send',
  unavailable: 'not asked: Theo did not answer',
  egress: 'not asked: the question named something from this room',
  offline: 'not asked: this run was offline',
  birth: 'not asked: the room was just created',
  tier_denied: 'not asked: Theo refused this read (tier_denied)',
};

// ---- T1 ----------------------------------------------------------------------------------------------------

arm('T1 the wired face leads BRAIN.md; frontmatter carries the provenance keys; schema accepts it', async () => {
  const room = bornWithMinto('t1', { frameworkA: '5 Whys Technique', frameworksB: "[80/20 Rule, Brooks's Law, Quokka Method]" });
  const { calls, derive } = install();
  try {
    const res = await derive.deriveSection(room.roomDir, SEC, {});
    check(res.success === true, 'deriveSection success, got ' + JSON.stringify(res));
    const text = readBrain(room);
    eq(headings(text), FACE_HEADINGS.concat(LEGACY_HEADINGS), 'heading order (face first, nine legacy sections after)');
    const f = fm(text);
    eq(f.face, 'feyminto-theo', 'face key');
    eq(f.asked, 'true', 'asked');
    eq(f.queries_sent, '6', 'queries_sent (3 problem-type reads + 3 neighborhoods)');
    eq([f.rows_find_frameworks, f.rows_commands, f.rows_route, f.rows_neighborhood], ['2', '1', '2', '3'], 'the four rows_* counts');
    eq(f.handles_problem_type, 'IllDefined', 'handles_problem_type');
    eq(f.handles_on_wire, 'problem_type%2Cframeworks'.replace('%2C', ','), 'handles_on_wire');
    check(f.edit_surface && f.edit_surface.length > 0, 'edit_surface present');
    eq(f.room_id, identity(room.roomDir).room_id, 'room_id equals readRoomIdentity');
    eq(f.section, SEC, 'required key section kept');
    check(/^sha256:[0-9a-f]{64}$/.test(f.governing_thought_hash || ''), 'required governing_thought_hash kept');
    const body = bodyOf(text);
    check(body.indexOf('Chapter coverage for this lens: 2 of 9.') !== -1, 'the real "M of T" chapter line is printed');
    check(body.indexOf('total chapter count was not returned') === -1, 'the "not returned" line is gone when Theo returned coverage');
    check(body.indexOf('Shared premise:') !== -1, 'a shared premise is named because the neighborhoods share ch-07');
    const schema = require(path.join(ROOT, 'lib', 'core', 'brain-md-schema.cjs'));
    const v = schema.validateSchema(path.join(room.roomDir, SEC, 'BRAIN.md'));
    const unknown = v.violations.filter((x) => /Unknown section heading/.test(x.message));
    eq(unknown, [], 'no unknown-heading violation');
    eq(v.violations.filter((x) => x.severity === 'error' || x.severity === 'critical'), [], 'no hard schema error');
    eq(schema.OPTIONAL_SECTION_HEADINGS.filter((h) => FACE_HEADINGS.indexOf(h) !== -1), FACE_HEADINGS, 'schema OPTIONAL_SECTION_HEADINGS holds the six face headings');
    const faceMod = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'theo-face.cjs'));
    eq(Array.from(faceMod.THEO_FACE_HEADINGS), FACE_HEADINGS, 'schema literals equal theo-face THEO_FACE_HEADINGS');
    eq(calls.callTool.map((c) => c.tool).slice(0, 3), ['find_frameworks_for_problem_type', 'commands_for_problem_type', 'recommend_chain'], 'the three problem-type reads go first');
  } finally { uninstall(); }
});

arm('T1b list scalars: a comma and an apostrophe in a canonical name survive the frontmatter and decode', async () => {
  const room = bornWithMinto('t1b', {
    frameworkA: 'MECE (Mutually Exclusive, Collectively Exhaustive)',
    frameworksB: "[Brooks's Law]",
  });
  const { derive } = install();
  try {
    const res = await derive.deriveSection(room.roomDir, SEC, {});
    check(res.success === true, 'deriveSection success, got ' + JSON.stringify(res));
    const text = readBrain(room);
    const line = (text.match(/^handles_frameworks:.*$/m) || [''])[0];
    check(line.indexOf('%2C') !== -1, 'the comma is percent-encoded on disk: ' + line);
    check(line.indexOf('%27') !== -1, 'the apostrophe is percent-encoded on disk, not stripped: ' + line);
    const schema = require(path.join(ROOT, 'lib', 'core', 'brain-md-schema.cjs'));
    check(typeof schema.decodeFaceList === 'function', 'schema exports decodeFaceList');
    const names = schema.decodeFaceList(fm(text).handles_frameworks);
    eq(names, ['MECE (Mutually Exclusive, Collectively Exhaustive)', "Brooks's Law"], 'handles_frameworks decodes to the canonical names');
    names.forEach((n) => check(CANON.has(n.toLowerCase()), 'decoded name is canonical: ' + n));
    eq(schema.decodeFaceList('a%2Cb,c'), ['a,b', 'c'], 'decodeFaceList splits on the bare comma only');
    eq(schema.decodeFaceList(''), [], 'empty list');
    eq(schema.decodeFaceList('none'), [], 'none is the empty list');
    const sugg = fm(text).suggested_frameworks;
    check(typeof sugg === 'string', 'suggested_frameworks is a scalar');
    schema.decodeFaceList(sugg).forEach((n) => check(n.indexOf('%2C') === -1, 'no encoded comma left after decode: ' + n));
  } finally { uninstall(); }
});

// ---- T2 ----------------------------------------------------------------------------------------------------

arm('T2 Canon Part 8 canary: only handles cross the wire', async () => {
  const room = bornWithMinto('t2', { frameworkA: '5 Whys Technique', frameworksB: '[80/20 Rule, Quokka Method]' });
  const { calls, derive } = install();
  try {
    const res = await derive.deriveSection(room.roomDir, SEC, {});
    check(res.success === true, 'deriveSection success, got ' + JSON.stringify(res));
    check(calls.callTool.length >= 3, 'Theo was asked: ' + calls.callTool.length);
    const ALLOWED_KEYS = ['problem_type', 'max_steps', 'framework'];
    const ENUM = ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked'];
    calls.callTool.forEach((c) => {
      Object.keys(c.args).forEach((k) => check(ALLOWED_KEYS.indexOf(k) !== -1, c.tool + ' payload key ' + k));
      check(!('limit' in c.args), c.tool + ' sends no limit');
      if ('problem_type' in c.args) check(ENUM.indexOf(c.args.problem_type) !== -1, 'problem_type is an enum id: ' + c.args.problem_type);
      if ('max_steps' in c.args) check(typeof c.args.max_steps === 'number', 'max_steps is a number');
      if ('framework' in c.args) check(CANON.has(String(c.args.framework).toLowerCase()), 'framework is canonical: ' + c.args.framework);
    });
    const everything = JSON.stringify([calls.callTool, calls.query, calls.search]);
    ['Quokka', 'Zanzibar', 'llama unicorn', 'quokka market', 'Quokka Method'].forEach((canary) => {
      check(everything.indexOf(canary) === -1, 'canary "' + canary + '" reached a payload');
    });
    const written = fs.readFileSync(path.join(room.roomDir, SEC, 'BRAIN.md'), 'utf8');
    check(written.indexOf('llama unicorn') === -1 && written.indexOf('Zanzibar') === -1 && written.indexOf('Quokka') === -1, 'no canary in BRAIN.md');
  } finally { uninstall(); }
});

// ---- T3 ----------------------------------------------------------------------------------------------------

arm('T3 the six response classes read honestly in the legacy sections', async () => {
  // Class 6 first (rows) to learn which legacy sections have no builder (the no-handle class).
  const classes = [
    { name: 'rows', query: () => ({ records: [{ name: 'SWOT' }] }), search: () => ({ matches: [{ title: 'Analogy 1' }] }) },
    { name: 'transport null', query: () => null, search: () => null, line: NOT_ASKED.unavailable },
    { name: 'egress sentinel', query: () => ({ error: 'egress_blocked' }), search: () => ({ error: 'egress_blocked' }), line: NOT_ASKED.egress },
    { name: 'tier_denied', query: () => ({ error: 'tier_denied', message: 'denied' }), search: () => ({ error: 'tier_denied' }), line: NOT_ASKED.tier_denied },
    { name: 'empty records', query: () => ({ records: [] }), search: () => ({ matches: [] }), line: NO_SIGNAL, allowNoSignal: true },
  ];
  let noBuilder = null;
  for (const cls of classes) {
    const room = bornWithMinto('t3' + cls.name.replace(/\W/g, ''), { allowNoSignal: cls.allowNoSignal });
    const { derive } = install({ query: cls.query, search: cls.search });
    try {
      const res = await derive.deriveSection(room.roomDir, SEC, {});
      check(res.success === true, cls.name + ': deriveSection success, got ' + JSON.stringify(res));
      const map = sectionMap(readBrain(room));
      if (cls.name === 'rows') {
        noBuilder = LEGACY_HEADINGS.filter((h) => map[h] === NOT_ASKED.no_handle);
        check(noBuilder.length >= 1 && noBuilder.length < 9, 'rows: the builder-null sections read the no-handle line, got ' + JSON.stringify(noBuilder));
        LEGACY_HEADINGS.filter((h) => noBuilder.indexOf(h) === -1).forEach((h) => {
          check(/^- /.test(map[h]), 'rows: ' + h + ' renders rows, got ' + JSON.stringify(map[h]));
        });
      } else {
        LEGACY_HEADINGS.forEach((h) => {
          const want = noBuilder.indexOf(h) !== -1 ? NOT_ASKED.no_handle : cls.line;
          eq(map[h], want, cls.name + ': ' + h);
        });
      }
    } finally { uninstall(); }
  }
});

// ---- T4 ----------------------------------------------------------------------------------------------------

arm('T4 offline: zero calls, every line says the run was offline', async () => {
  const room = bornWithMinto('t4');
  const { calls, derive } = install();
  try {
    const res = await derive.deriveSection(room.roomDir, SEC, { offline: true });
    check(res.success === true, 'deriveSection success, got ' + JSON.stringify(res));
    eq([calls.callTool.length, calls.query.length, calls.search.length], [0, 0, 0], 'no Theo, query or search call');
    const text = readBrain(room);
    const map = sectionMap(text);
    eq(map['## FeyMinto: what Theo suggests for this nest'], NOT_ASKED.offline, 'suggestions section');
    LEGACY_HEADINGS.forEach((h) => eq(map[h], NOT_ASKED.offline, h));
    const f = fm(text);
    eq([f.asked, f.not_asked_reason, f.queries_sent], ['false', 'offline', '0'], 'frontmatter');
  } finally { uninstall(); }
});

// ---- T5 ----------------------------------------------------------------------------------------------------

arm('T5 a nest with no MINTO.md still gets its face', async () => {
  const room = born('t5');
  fs.mkdirSync(path.join(room.roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'jtbd-state.json'), JSON.stringify({ goal: { rung: 'IllDefined' } }), 'utf8');
  check(!fs.existsSync(path.join(room.roomDir, 'market-analysis', 'MINTO.md')), 'fixture: market-analysis has no MINTO.md');
  const { calls, derive } = install();
  try {
    const res = await derive.deriveSection(room.roomDir, 'market-analysis', {});
    check(res.success === true && res.reason !== 'triple_incomplete', 'no triple_incomplete, got ' + JSON.stringify(res));
    const text = readBrain(room, 'market-analysis');
    const f = fm(text);
    eq([f.asked, f.handles_problem_type], ['true', 'IllDefined'], 'asked with the room rung as the lens');
    check(calls.callTool.length >= 3, 'Theo was asked');
    check(/^sha256:e3b0c442/.test(f.governing_thought_hash || ''), 'no MINTO: governing_thought_hash is the empty-string sentinel');
    const map = sectionMap(text);
    LEGACY_HEADINGS.forEach((h) => eq(map[h], NOT_ASKED.no_handle, h + ' (no triple, no handle to send)'));

    // ensureSectionDerived no longer reports triple_incomplete for a nest without MINTO.md
    const ens = await derive.ensureSectionDerived(room.roomDir, 'strategy', {});
    check(ens.reason !== 'triple_incomplete', 'ensureSectionDerived: no triple_incomplete, got ' + JSON.stringify(ens));
    check(ens.success === true, 'ensureSectionDerived success, got ' + JSON.stringify(ens));

    // no rung and no framework: not asked, zero calls
    fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'jtbd-state.json'), JSON.stringify({ goal: {} }), 'utf8');
    const before = calls.callTool.length;
    const res2 = await derive.deriveSection(room.roomDir, 'solution-design', {});
    check(res2.success === true, 'deriveSection (no handle) success, got ' + JSON.stringify(res2));
    eq(calls.callTool.length, before, 'no handle: no Theo call');
    const text2 = readBrain(room, 'solution-design');
    eq(sectionMap(text2)['## FeyMinto: what Theo suggests for this nest'], NOT_ASKED.no_handle, 'suggestions line');
    eq([fm(text2).asked, fm(text2).not_asked_reason], ['false', 'no_handle_to_send'], 'frontmatter');
  } finally { uninstall(); }
});

// ---- T6 ----------------------------------------------------------------------------------------------------

arm('T6 birth writes every core nest face as not asked at birth and keys FEYNMAN to the room id', () => {
  const iso = H.mkIsolatedHome('t6');
  const chunks = [];
  const realWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (c) => { chunks.push(String(c)); return true; };
  let b;
  try { b = H.birthFixtureRoom({ iso, slug: 'tw-t6' }); } finally { process.stdout.write = realWrite; }
  check(b && b.ok === true, 'birth ok');
  const roomDir = fs.realpathSync(b.roomDir);
  ROOMS.push({ dir: roomDir, allowNoSignal: false });
  const out = chunks.join('');
  check(out.indexOf('BRAIN derivation enqueued') === -1, 'the false enqueue line is gone');
  const sections = Object.keys(require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS)
    .filter((s) => fs.existsSync(path.join(roomDir, s)));
  check(sections.length === 11, 'eleven core sections present, got ' + sections.length);
  const schema = require(path.join(ROOT, 'lib', 'core', 'brain-md-schema.cjs'));
  const folderMemory = require(path.join(ROOT, 'lib', 'core', 'folder-memory.cjs'));
  const shared = require(path.join(ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));
  sections.forEach((s) => {
    const bp = path.join(roomDir, s, 'BRAIN.md');
    check(fs.existsSync(bp), s + ': BRAIN.md present');
    const text = fs.readFileSync(bp, 'utf8');
    const f = fm(text);
    eq([f.asked, f.not_asked_reason, f.room_id], ['false', 'at_birth', b.room_id], s + ' frontmatter');
    eq(sectionMap(text)['## FeyMinto: what Theo suggests for this nest'], NOT_ASKED.birth, s + ' suggestions line');
    LEGACY_HEADINGS.forEach((h) => eq(sectionMap(text)[h], NOT_ASKED.birth, s + ' ' + h));
    const v = schema.validateSchema(bp);
    eq(v.violations.filter((x) => x.severity === 'error' || x.severity === 'critical'), [], s + ' schema');
    const fe = fs.readFileSync(path.join(roomDir, s, 'FEYNMAN.md'), 'utf8');
    eq(fm(fe).room_id, b.room_id, s + ' FEYNMAN room_id');
    // a face that asked nothing must not lift the tier above tier_0
    const quad = folderMemory.readQuadruple(path.join(roomDir, s));
    eq(shared.resolveTierMode(quad, true), 'tier_0', s + ' tier mode with the not-asked face');
  });
  check(out.indexOf('[room-birth] FeyMinto faces written for 11 sections') !== -1, 'the birth line says what happened: ' + out.slice(0, 300));
  eq(b.feyminto, { faces_written: 11, theo: 'not asked: at birth' }, 'birth result feyminto');
});

// ---- T7 ----------------------------------------------------------------------------------------------------

function sectionTwoNames(contextText) {
  const start = /^##[ \t]+2\.[ \t]/m.exec(contextText);
  if (!start) return [];
  const rest = contextText.slice(start.index + start[0].length);
  const next = /^##[ \t]+\d+\.[ \t]/m.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;
  return Array.from(new Set(section.match(/\/mos:[a-z0-9-]+/g) || []));
}

function brainDoc(room, extraFm, bodyLines) {
  return '---\nsection: ' + SEC + '\nbrain_generated_at: "2026-10-06T00:00:00.000Z"\nbrain_graph_version: 0\n' +
    'governing_thought_hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"\nstaleness: fresh\nauthor: brain\n' +
    extraFm + '---\n\n## Provenance\n\nx\n\n## Command sources for this nest\n\n' + bodyLines + '\n';
}

arm('T7 the walk counts only untagged restatements, reports tagged, asked and the per-face room key', () => {
  const room = born('t7');
  const walk = require(path.join(ROOT, 'lib', 'core', 'doctor', 'icm-walk-module.cjs'));
  const names = sectionTwoNames(fs.readFileSync(path.join(room.roomDir, SEC, 'CONTEXT.md'), 'utf8'));
  check(names.length >= 1, 'fixture: CONTEXT section 2 names at least one command');
  const name = names[0];
  const bp = path.join(room.roomDir, SEC, 'BRAIN.md');
  const nestOf = () => walk.walkRoom(room.roomDir).nests.find((n) => n.nest === SEC);

  fs.writeFileSync(bp, brainDoc(room, 'asked: false\nnot_asked_reason: at_birth\n', '- ' + name + ' - runnable (source: ledger, see CONTEXT.md section 2)'), 'utf8');
  let n = nestOf();
  eq([n.I8c.restated, n.I8c.tagged], [0, 1], 'tagged line: restated 0, tagged 1');
  eq([n.I8c.asked, n.I8c.not_asked_reason], [false, 'at_birth'], 'asked and not_asked_reason');

  fs.writeFileSync(bp, brainDoc(room, 'asked: true\n', 'Run ' + name + ' next, it is the best one.'), 'utf8');
  n = nestOf();
  eq([n.I8c.restated, n.I8c.tagged], [1, 0], 'untagged line: restated 1, tagged 0');
  eq([n.I8c.asked, n.I8c.not_asked_reason], [true, null], 'asked true');

  // I8b: per-face room key (MINTO room, FEYNMAN room_id, BRAIN room_id) and the MINTO room_slug projection
  const rid = room.room_id;
  fs.writeFileSync(bp, brainDoc(room, 'asked: false\nnot_asked_reason: at_birth\nroom_id: ' + rid + '\n', '- x'), 'utf8');
  fs.writeFileSync(path.join(room.roomDir, SEC, 'MINTO.md'), '---\ntype: section-minto\nsection: ' + SEC + '\nroom: ' + rid + '\nroom_slug: ' + room.slug + '\n---\n# m\n', 'utf8');
  n = nestOf();
  eq(n.I8b.faces['MINTO.md'], { value: rid, matches_room_id: true }, 'MINTO face (room)');
  eq(n.I8b.faces['FEYNMAN.md'], { value: rid, matches_room_id: true }, 'FEYNMAN face (room_id stamped by birth)');
  eq(n.I8b.faces['BRAIN.md'], { value: rid, matches_room_id: true }, 'BRAIN face (room_id)');
  eq([n.I8b.minto_room_slug, n.I8b.matches_room_slug], [room.slug, true], 'MINTO room_slug projection');
  fs.writeFileSync(bp, brainDoc(room, 'room_id: some-other-id\n', '- x'), 'utf8');
  n = nestOf();
  eq(n.I8b.faces['BRAIN.md'], { value: 'some-other-id', matches_room_id: false }, 'a BRAIN room_id that is not the room id');
  fs.writeFileSync(bp, brainDoc(room, '', '- x'), 'utf8');
  n = nestOf();
  eq(n.I8b.faces['BRAIN.md'], { value: null, matches_room_id: null }, 'a BRAIN without room_id reads null, not false');
});

// ---- T8 ----------------------------------------------------------------------------------------------------

function listBrainFiles(dir) {
  const out = [];
  (function walk(d, depth) {
    if (depth > 2) return;
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    ents.forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '.mindrian' && e.name !== '.snapshots') walk(p, depth + 1); }
      else if (e.name === 'BRAIN.md') out.push(p);
    });
  })(dir, 0);
  return out;
}

arm('T8 dash guard; the empty-answer sentinel appears only in the empty-records room', () => {
  eq(H.dashGuard([__filename]), [], 'this test file has no em dash or en dash');
  const files = [
    path.join(ROOT, 'lib', 'core', 'brain-derivation.cjs'),
    path.join(ROOT, 'lib', 'core', 'brain-md-schema.cjs'),
  ];
  eq(H.dashGuard(files), [], 'the wiring files have no em dash or en dash');
  let seenAllowed = 0;
  ROOMS.forEach((r) => {
    listBrainFiles(r.dir).forEach((f) => {
      const has = fs.readFileSync(f, 'utf8').indexOf(NO_SIGNAL) !== -1;
      if (has && !r.allowNoSignal) throw new Error('"' + NO_SIGNAL + '" in ' + f);
      if (has && r.allowNoSignal) seenAllowed += 1;
    });
  });
  check(seenAllowed >= 1, 'the empty-records room does carry the sentinel (it is the one honest use)');
});

// ---- T9 ----------------------------------------------------------------------------------------------------

arm('T9 the engine does not count a "not asked" or shape line as a consumed section', () => {
  const engine = require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs'));
  const sections = {
    pattern_matches: { body: '- Run Methodology (confidence: 0.8)', tokens_estimate: 4 },
    framework_chain_predictions: { body: NOT_ASKED.no_handle, tokens_estimate: 4 },
    cross_domain_analogies: { body: NOT_ASKED.unavailable, tokens_estimate: 4 },
    wicked_indicators: { body: NOT_ASKED.tier_denied, tokens_estimate: 4 },
    unfilled_opportunity_matches: { body: 'the answer came in a shape this section does not read', tokens_estimate: 4 },
    assessment_thinking_chain_position: { body: NO_SIGNAL, tokens_estimate: 4 },
    problemtype_classification: null,
    flagged_contradictions_xroom: { body: NOT_ASKED.offline, tokens_estimate: 4 },
    hsi_signals: { body: NOT_ASKED.birth, tokens_estimate: 4 },
  };
  const brain = {
    exists: true, section: 'market-analysis', brain_generated_at: '2026-04-20T12:00:00Z', brain_graph_version: 1,
    governing_thought_hash: 'sha256:abc123', staleness: 'fresh', stale_reason: null, author: 'brain', confidence_baseline: 0.5,
    parse_failed: false, sections, flagged_weaknesses: [],
  };
  const quadruple = {
    room: { exists: true, identity_text: 'market analysis section', references: [] },
    state: { exists: true, artifact_count: 3, completeness_score: 0.6 },
    reasoning: { exists: true, governing_thought: 'Customers will pay a premium for X', reasoning_health_score: 0.7, is_stale: false, arguments: [] },
    brain,
  };
  const d = engine.decide(
    { userText: 'help me think about market sizing', sectionPath: '/tmp/fixture-room/market-analysis', sessionId: 'test-session-1' },
    { quadruple, brainAvailable: true, userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' }, intentSignal: { intent: 'analyze', confidence: 0.6 } });
  eq(d.decision_trace.brain_md_sections_consumed, ['pattern_matches'], 'only the section with content is consumed');
});

// ---- runner ------------------------------------------------------------------------------------------------

(async () => {
  let passed = 0;
  let failed = 0;
  const failedNames = [];
  for (const a of arms) {
    try {
      await a.fn();
      passed += 1;
      console.log('PASS: ' + a.name);
    } catch (e) {
      failed += 1;
      failedNames.push(a.name);
      console.log('FAIL: ' + a.name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
    }
  }
  console.log('\ntest-36925-theo-wiring: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) { console.log('failed: ' + failedNames.join(' | ')); process.exit(1); }
})();
