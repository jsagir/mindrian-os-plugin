#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 314 Plan 05 -- the /mos:eureka-portfolio command contract (legs K1-K16).
 * Pins the frontmatter, the connector tuple, the script calls, the Tri-Polar
 * table, the plain-words rule for user-visible templates, the level words, the
 * provenance rule, the honest degrade, the seen call, the registry entry, the
 * skill mirror, the local-only rule, the model-name rule, the boundary line
 * with /mos:eureka, and the reshuffle-off line.
 *
 * Flag --body-only skips the legs that need generated files: the registry half
 * of K2, K11 and K12. Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point
 * at temp dirs before anything loads; the network guard is installed first and
 * the last check proves zero attempts. layer: loop
 *
 * House rule: hyphens only. The dash characters below come from
 * String.fromCharCode, never from typed escape text.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-314-cmd-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-314-cmd-rooms-'));
process.env.UV_OFFLINE = '1';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const BODY_ONLY = process.argv.indexOf('--body-only') !== -1;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-314-command');

const CMD_REL = 'commands/eureka-portfolio.md';
const EUREKA_REL = 'commands/eureka.md';
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const NEXT_COMMAND = '/mos:eureka-portfolio';
const RESHUFFLE_LINE = 'Changes in the order of the top of the list are not tracked yet.';

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
const eureka = read(EUREKA_REL);

let flat = {};
let shape = {};
let conn = {};
if (cmd) {
  flat = require(path.join(ROOT, 'scripts/build-command-registry.cjs')).parseFrontmatter(cmd);
  const sh = require(path.join(ROOT, 'scripts/check-shape-declaration.cjs'));
  shape = sh.parseFrontmatter(cmd) || {};
  conn = shape.connector || {};
}

// The fenced blocks tagged text: every user-visible template.
function textBlocks(md) {
  const out = [];
  const re = /```text\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md || '')) !== null) out.push(m[1]);
  return out;
}

// K1 frontmatter contract
{
  const tools = Array.isArray(flat['allowed-tools']) ? flat['allowed-tools'] : [];
  const parts = Array.isArray(flat.canon_parts) ? flat.canon_parts.map(Number) : [];
  const need = ['name', 'description', 'help_jtbd', 'argument-hint', 'body_shape', 'layer', 'layer_why', 'hitl_shape', 'hitl_why', 'serves_jtbd', 'teaching'];
  const missing = need.filter((k) => !cmd || !flat[k] || String(flat[k]).length === 0);
  const toolsOk = tools.length === 3 && ['Read', 'Bash', 'AskUserQuestion'].every((t) => tools.indexOf(t) !== -1);
  C.check('K1 frontmatter: required keys, shape F.8 with reason, tools Read+Bash+AskUserQuestion only, canon_parts',
    !!cmd && missing.length === 0 && flat.name === 'eureka-portfolio' && String(flat.hitl_shape) === 'F.8' &&
    toolsOk && [7, 8, 11, 12].every((p) => parts.indexOf(p) !== -1) && !!shape.connector,
    cmd ? 'missing=' + missing.join(',') + ' tools=' + tools.join(',') : 'command file absent');
}

// K2 connector block and tuple
{
  const want = {
    connects_to_spine: true, reach_id: 'context_block', sub_mode: 'portfolio-movement',
    framework: null, posture: 'hold', filing: 'none', plan_gated: false, web_scope: null,
  };
  const keys = Object.keys(want);
  let ok = !!cmd && keys.every((k) => conn[k] === want[k]) &&
    (Array.isArray(conn.sensor_triggers) ? conn.sensor_triggers.join(',') : String(conn.sensor_triggers).replace(/[\[\]\s]/g, '')) === 'SENS-13';
  let detail = cmd ? JSON.stringify(conn) : 'command file absent';
  if (!BODY_ONLY) {
    let reg = null;
    try { reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/connector-registry.json'), 'utf8')); } catch (_e) { reg = null; }
    const rows = reg ? JSON.stringify(reg).split('"portfolio-movement"').length - 1 : 0;
    const eurekaTuple = reg ? JSON.stringify(reg).split('"eureka-portfolio"').length - 1 : 0;
    ok = ok && rows >= 1 && eurekaTuple >= 1;
    detail += ' portfolio-movement refs=' + rows + ' eureka-portfolio refs=' + eurekaTuple;
  }
  C.check('K2 connector: SENS-13, context_block, portfolio-movement, hold, no filing; registry holds both tuples', ok, detail);
}

// K3 script calls
{
  const hasRun = !!cmd && /eureka-portfolio\.cjs" run --room/.test(cmd);
  const hasShow = !!cmd && /eureka-portfolio\.cjs" show --room/.test(cmd);
  const hasSeen = !!cmd && /eureka-portfolio\.cjs" seen --room/.test(cmd);
  const resolves = !!cmd && cmd.indexOf('scripts/resolve-room') !== -1;
  const section = !!cmd && /--section/.test(cmd) && /section name/i.test(cmd);
  C.check('K3 body calls run, show and seen on scripts/eureka-portfolio.cjs, resolves the room first, passes --section from a section name',
    hasRun && hasShow && hasSeen && resolves && section,
    cmd ? JSON.stringify({ hasRun, hasShow, hasSeen, resolves, section }) : 'command file absent');
}

// K4 Tri-Polar table
{
  const rows = cmd ? cmd.split(/\r?\n/).filter((l) => /^\|/.test(l)) : [];
  const cli = rows.find((l) => /^\|\s*\*{0,2}CLI/.test(l)) || '';
  const desk = rows.find((l) => /^\|\s*\*{0,2}Desktop/.test(l)) || '';
  const cow = rows.find((l) => /^\|\s*\*{0,2}Cowork/.test(l)) || '';
  const ok = !!cmd && /Tri-Polar/.test(cmd) && !!cli && !!desk && !!cow &&
    /intelligence/.test(desk) && /eureka-portfolio/.test(desk) && /Claude Code/.test(desk) &&
    /last/i.test(cow) && /later|last writer|last-writer/i.test(cow) && /shared/i.test(cow);
  C.check('K4 Tri-Polar table: CLI, Desktop (intelligence tool, new run needs Claude Code), Cowork (shared folder, last writer wins)',
    ok, cmd ? 'rows=' + rows.length : 'command file absent');
}

// K5 plain words in user-visible templates
{
  const blocks = textBlocks(cmd);
  const banned = ['band', 'tail', 'quadrant', 'AHP', 'handle', 'sensor', 'percentile', 'envelope', 'SENS', 'delta'];
  const hits = [];
  blocks.forEach((b, i) => {
    banned.forEach((w) => {
      if (new RegExp('\\b' + w + '\\b', 'i').test(b)) hits.push('block' + i + ':' + w);
    });
  });
  C.check('K5 text templates hold none of the stack words; at least 3 text templates exist',
    !!cmd && blocks.length >= 3 && hits.length === 0, cmd ? 'blocks=' + blocks.length + ' hits=' + hits.join(',') : 'command file absent');
}

// K6 level words
{
  const levels = ['weak', 'some', 'worth a look', 'strong', 'standout', 'not rated'];
  const missing = levels.filter((l) => !cmd || cmd.indexOf('`' + l + '`') === -1 && cmd.indexOf(l) === -1);
  const inOrder = !!cmd && /weak, some, worth a look, strong, standout, not rated/.test(cmd);
  C.check('K6 level words appear in order: weak, some, worth a look, strong, standout, not rated',
    !!cmd && missing.length === 0 && inOrder, missing.join(',') || (cmd ? 'order=' + inOrder : 'command file absent'));
}

// K7 provenance
{
  const ok = !!cmd && /provenance\.encoder_model/.test(cmd) && /Nothing left your room\./.test(cmd) &&
    /never (hand-)?compute/i.test(cmd) && /decimal/i.test(cmd);
  C.check('K7 provenance line is printed from the script output and no decimal is ever hand-computed', ok, cmd ? '' : 'command file absent');
}

// K8 honest degrade
{
  const ok = !!cmd && /plain_reason/.test(cmd) && /Fitness not computed - connection counts only\./.test(cmd) &&
    cmd.indexOf('/mos:eureka enable') !== -1 && /never show a (fake|made-up) number/i.test(cmd);
  C.check('K8 honest degrade in plain words, names /mos:eureka enable, never a fake number', ok, cmd ? '' : 'command file absent');
}

// K9 dashes, emoji, first person
{
  const ALLOWED = ['■', '▼', '▶', '▷', '├─', '└─', '✓', '•', '⚠', '⚡', '⬜', '→'];
  let stripped = cmd || '';
  ALLOWED.forEach((g) => { stripped = stripped.split(g).join(''); });
  const emoji = /\p{Extended_Pictographic}/u.test(stripped);
  const firstPerson = /(^|[.!?]\s+|\n\s*(?:[-*>]\s+)?)I( |')/.test(stripped.replace(/```[\s\S]*?```/g, ''));
  C.check('K9 no em-dash, no en-dash, no emoji, no sentence starting with I',
    !!cmd && cmd.indexOf(EM) === -1 && cmd.indexOf(EN) === -1 && !emoji && !firstPerson,
    cmd ? 'emoji=' + emoji + ' firstPerson=' + firstPerson : 'command file absent');
}

// K10 seen after show
{
  const ok = !!cmd && /seen --room/.test(cmd) && /run (itself )?never marks/i.test(cmd) && /after/i.test(cmd) &&
    /movement\.movement_id/.test(cmd);
  C.check('K10 seen is called after the movement section is shown; run itself never marks seen', ok, cmd ? '' : 'command file absent');
}

// K11 registry knows the command (flips the plan 03 O8 leg from SKIP to PASS)
if (BODY_ONLY) {
  console.log('     SKIP K11 -- --body-only');
} else {
  let reg = null;
  try { reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/command-registry.json'), 'utf8')); } catch (_e) { reg = null; }
  const offer = require(path.join(ROOT, 'lib/core/eureka/portfolio-offer.cjs'));
  const found = !!reg && Array.isArray(reg.commands) && reg.commands.some((c) => c && c.command === offer.NEXT_COMMAND);
  C.check('K11 the offer NEXT_COMMAND is /mos:eureka-portfolio and data/command-registry.json holds it',
    offer.NEXT_COMMAND === NEXT_COMMAND && found, 'found=' + found);
}

// K12 skill mirror
if (BODY_ONLY) {
  console.log('     SKIP K12 -- --body-only');
} else {
  const mirror = read('skills/eureka-portfolio/SKILL.md');
  const r = run('scripts/build-skill-mirrors.cjs', ['--check']);
  C.check('K12 skills/eureka-portfolio/SKILL.md exists and build-skill-mirrors --check exits 0', !!mirror && r.status === 0, 'status=' + r.status);
}

// K13 local only
{
  const urls = !!cmd && /https?:\/\//i.test(cmd);
  const web = !!cmd && /WebSearch|WebFetch|tavily|mcp__|brain_/i.test(cmd);
  C.check('K13 no URL and no web or Brain tool named (local only, Part 8)', !!cmd && !urls && !web, cmd ? 'urls=' + urls + ' web=' + web : 'command file absent');
}

// K14 no encoder model named
{
  const named = !!cmd && /multilingual|\be5\b|MiniLM|sentence-transformers|\bbge-|gte-|nomic|\bonnx\b/i.test(cmd);
  C.check('K14 the command names no encoder model; identity comes from the script output only', !!cmd && !named, cmd ? 'named=' + named : 'command file absent');
}

// K15 boundary line, and /mos:eureka unchanged
{
  const boundary = !!cmd && /Measured fitness numbers belong to this command only/.test(cmd) &&
    /\/mos:eureka keeps its rule never to render a score/.test(cmd);
  const eurekaKeeps = !!eureka && /Never render a score, similarity, differential or percentage\./.test(eureka);
  let unchanged = true;
  const diff = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', EUREKA_REL], { cwd: ROOT, encoding: 'utf8' });
  if (diff.status !== 0) unchanged = false;
  C.check('K15 boundary line present; commands/eureka.md keeps its never-render-a-score rule and has no diff',
    boundary && eurekaKeeps && unchanged, 'boundary=' + boundary + ' eurekaKeeps=' + eurekaKeeps + ' unchanged=' + unchanged);
}

// K16 reshuffle-off line
{
  const ok = !!cmd && cmd.indexOf(RESHUFFLE_LINE) !== -1 && /movement\.reshuffle_active/.test(cmd) &&
    /false/.test(cmd) && /nothing about reordering/i.test(cmd);
  const inTemplate = textBlocks(cmd).some((b) => b.indexOf(RESHUFFLE_LINE) !== -1);
  C.check('K16 prints the exact line when reshuffle_active is false; says nothing about reordering when true and nothing reordered',
    ok && inTemplate, cmd ? 'ok=' + ok + ' inTemplate=' + inTemplate : 'command file absent');
}

// zero network attempts
C.check('zero network attempts (last check)', net.attempts() === 0, String(net.attempts()));

process.exit(C.summary());
