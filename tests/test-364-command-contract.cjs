#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 07 Tasks 1-3 -- the /mos:scientific-roadmap command contract
 * (SHAPE, NV-2, DISC, ENTRY, THEO-C). Legs C1-C13 pin the frontmatter, the
 * connector block, the eight declared hitl_stages, the Larry-led body anchors,
 * the CLI subcommands the body calls, dash hygiene, the generated skill mirror,
 * and every born-wired validator that must stay quiet for this command.
 *
 * Text and JSON assertions plus spawned repo validators. Hermetic: HOME,
 * USERPROFILE and MINDRIAN_ROOMS_HOME point at mkdtemp dirs before anything
 * loads; the network guard is installed first and the last check proves zero
 * attempts. layer: loop
 *
 * House rule: hyphens only. The dash characters below are unicode escapes.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-cmd-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-cmd-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-command-contract');

const CMD_REL = 'commands/scientific-roadmap.md';
const SKILL_REL = 'skills/scientific-roadmap/SKILL.md';
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_e) { return null; }
}
function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script)].concat(args || []), {
    cwd: ROOT, env: process.env, encoding: 'utf8', timeout: 120000,
  });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

const cmd = read(CMD_REL);
const skill = read(SKILL_REL);

let flat = {};
let shape = {};
let conn = {};
if (cmd) {
  flat = require(path.join(ROOT, 'scripts/build-command-registry.cjs')).parseFrontmatter(cmd);
  const sh = require(path.join(ROOT, 'scripts/check-shape-declaration.cjs'));
  shape = sh.parseFrontmatter(cmd) || {};
  conn = shape.connector || {};
}

const STAGES = [
  ['entry-step', ['F.1'], 'gate'],
  ['qualify-quantify-place-forum', ['F.9', 'F.0'], 'ordered'],
  ['systems-pass', ['F.1'], 'gate'],
  ['path-enumeration', ['F.4'], 'ordered'],
  ['constraint-interrogation', ['F.8'], 'parallel'],
  ['catalytic-ranking', ['F.0'], 'gate'],
  ['hypothesis-handoff', ['F.6'], 'gate'],
  ['filing', ['F.8'], 'parallel'],
];

// C1 frontmatter
{
  const fw = flat.frameworks;
  const tools = Array.isArray(flat['allowed-tools']) ? flat['allowed-tools'] : [];
  const parts = Array.isArray(flat.canon_parts) ? flat.canon_parts.map(Number) : [];
  C.check('C1 frontmatter: name, kind, safety, frameworks, produces, tools, canon_parts, argument-hint',
    !!cmd && flat.name === 'scientific-roadmap' && flat.kind === 'methodology' && flat.autonomous_safe === false &&
    Array.isArray(fw) && fw.length === 2 && fw[0] === 'Scientific Roadmapping' && fw[1] === 'Hypothesis-Driven Problem Solving' &&
    flat.produces === 'room/research-plan/*' && tools.indexOf('AskUserQuestion') !== -1 &&
    parts.indexOf(11) !== -1 && /--from-hypothesis/.test(String(flat['argument-hint'] || '')),
    cmd ? JSON.stringify({ name: flat.name, kind: flat.kind, safe: flat.autonomous_safe, fw: fw, produces: flat.produces }) : 'command file absent');
}

// C2 connector block
{
  const want = {
    connects_to_spine: true, reach_id: 'context_block', sub_mode: 'scientific-roadmap',
    framework: 'Scientific Roadmapping', posture: 'hold', hierarchy_rank: 6,
    filing: 'fileEvidenceWithReadback', plan_gated: false, web_scope: null, surface: 'F.1',
  };
  const keys = Object.keys(want);
  const ok = !!cmd && keys.every((k) => conn[k] === want[k]) &&
    Array.isArray(conn.sensor_triggers) && conn.sensor_triggers.length === 0;
  C.check('C2 connector: the 11 keys carry the spec values, sensor_triggers empty', ok,
    cmd ? JSON.stringify(conn) : 'command file absent');
}

// C3 hitl_stages
{
  const st = Array.isArray(shape.hitl_stages) ? shape.hitl_stages : [];
  const modes = ['gate', 'ordered', 'parallel'];
  const ok = !!cmd && st.length === STAGES.length && STAGES.every((s, i) =>
    st[i] && st[i].stage === s[0] && JSON.stringify(st[i].shapes) === JSON.stringify(s[1]) && st[i].mode === s[2] &&
    modes.indexOf(st[i].mode) !== -1) &&
    typeof shape.hitl_why === 'string' && shape.hitl_why.length > 0;
  C.check('C3 hitl_stages: eight stages in order with the declared shapes and modes, hitl_why present', ok,
    cmd ? JSON.stringify(st) : 'command file absent');
}

// C4 body anchors
{
  const anchors = [
    'Theo has not authored this step yet', '--from-hypothesis', 'scripts/scientific-roadmap.cjs', '/mos:research',
    '/mos:systems-thinking', '/mos:analyze-systems', '/mos:find-bottlenecks', '/mos:dominant-designs',
    '/mos:explore-futures', '/mos:explore-opportunity', '/mos:find-analogies', '/mos:analyze-needs',
    'plugin-side rubric, not Theo content', 'uncovered', 'gate_render', 'gate_answer', 'research_run',
    'AskUserQuestion', 'before Path Enumeration',
  ];
  const missing = anchors.filter((a) => !cmd || cmd.indexOf(a) === -1);
  C.check('C4 body names every anchor (refusal, entry flag, CLI, bound commands, rubric label, MCP surface)',
    !!cmd && missing.length === 0, missing.join(' | ') || 'command file absent');
}

// C5 CLI subcommands
{
  const subs = ['start', 'stage', 'question-set', 'plan', 'basket', 'file'];
  const missing = subs.filter((s) => !cmd || cmd.indexOf('scientific-roadmap.cjs" ' + s) === -1 && cmd.indexOf('scientific-roadmap.cjs ' + s) === -1);
  C.check('C5 body calls each CLI subcommand (start, stage, question-set, plan, basket, file)',
    !!cmd && missing.length === 0, missing.join(' | ') || 'command file absent');
}

// C6 dash hygiene
C.check('C6 no em or en dash in the command or its skill mirror',
  !!cmd && !!skill && cmd.indexOf(EM) === -1 && cmd.indexOf(EN) === -1 && skill.indexOf(EM) === -1 && skill.indexOf(EN) === -1,
  !cmd || !skill ? 'file absent' : '');

// C7 skill mirror trigger
C.check('C7 the skill mirror exists and carries "what must be delivered but not how"',
  !!skill && skill.indexOf('what must be delivered but not how') !== -1, skill ? '' : 'mirror absent');

// C8 generator --check
{
  const r = run('scripts/build-new-surface.cjs', ['--check', '--kind', 'command', '--name', 'scientific-roadmap']);
  C.check('C8 build-new-surface --check --kind command --name scientific-roadmap exits 0', r.status === 0, r.out.slice(0, 200));
}

// C9 shape declaration advisory stays quiet
{
  const r = run('scripts/check-shape-declaration.cjs', ['--check']);
  const lines = r.out.split(/\r?\n/).filter((l) => /scientific-roadmap/.test(l));
  C.check('C9 check-shape-declaration --check names no line about scientific-roadmap', lines.length === 0, lines[0] || '');
}

// C10 layer, reward-before-investment, body-shape, hitl-stages validators
{
  const layer = run('scripts/check-layer-declaration.cjs', []);
  const reward = run('scripts/check-reward-before-investment.cjs', []);
  const body = run('scripts/audit-body-shape-coverage.cjs', []);
  const stages = run('scripts/check-hitl-stages.cjs', []);
  const bodyBad = body.out.split(/\r?\n/).filter((l) => /INVALID/.test(l) && /scientific-roadmap\.md/.test(l));
  C.check('C10 layer exits 0, reward invalid 0, no INVALID body-shape line for scientific-roadmap.md, hitl-stages exits 0',
    layer.status === 0 && /invalid:\s+0\b/.test(reward.out) && bodyBad.length === 0 && stages.status === 0,
    'layer=' + layer.status + ' reward=' + (reward.out.match(/invalid:\s+\d+/) || ['?'])[0] + ' body=' + bodyBad.length + ' stages=' + stages.status);
}

// C11 render coverage: a hitl_stages surface is not a keyspace row, so the leg
// pins the gate exit, that any entry that exists is wired, and that the body
// itself fires AskUserQuestion under an allowed-tools grant (the wired test).
{
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/render-coverage-registry.json'), 'utf8'));
  const mine = (reg.entries || []).filter((e) => e && e.surface === CMD_REL);
  const r = run('scripts/check-render-coverage.cjs', []);
  const tools = Array.isArray(flat['allowed-tools']) ? flat['allowed-tools'] : [];
  C.check('C11 check-render-coverage exits 0, no unwired entry, body fires AskUserQuestion under its grant',
    r.status === 0 && mine.every((e) => e.wired === true) && !!cmd && /AskUserQuestion/.test(cmd) && tools.indexOf('AskUserQuestion') !== -1,
    'status=' + r.status + ' entries=' + mine.length);
}

// C12 help group
{
  const hg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/help-groups.json'), 'utf8'));
  const grp = (hg.groups || []).find((g) => g.id === 'intelligence-research');
  const r = run('scripts/check-help-coverage.cjs', []);
  C.check('C12 help-groups intelligence-research lists scientific-roadmap and check-help-coverage exits 0',
    !!grp && grp.commands.indexOf('scientific-roadmap') !== -1 && r.status === 0,
    'status=' + r.status);
}

// C13 Part 8 boundary stated
C.check('C13 the body states only the framework name crosses to Theo',
  !!cmd && cmd.indexOf('only the framework name') !== -1, cmd ? '' : 'command file absent');

// zero network attempts
C.check('zero network attempts (last check)', net.attempts() === 0, String(net.attempts()));

process.exit(C.summary());
