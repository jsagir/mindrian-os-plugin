#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 07 Tasks 1 and 3 -- the registry and gate footprint of
 * /mos:scientific-roadmap (SHAPE, DISC, Pitfall 4). Legs G1-G10: every
 * generated registry is rebuilt by its builder and green under --check, the
 * command-registry row and both framework_index entries exist, the primary
 * framework resolution for Hypothesis-Driven Problem Solving is unchanged,
 * posture and reach wiring answer, the curated chains and projection edges
 * exist, the recipe count stays 5, the command count matches disk, and no dash
 * enters the hand edits. layer: loop
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at mkdtemp dirs
 * before anything loads; the network guard is installed first and the last
 * check proves zero attempts.
 *
 * House rule: hyphens only. The dash characters below are unicode escapes.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-reg-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-reg-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-registry-gates');

const CMD = '/mos:scientific-roadmap';
const SR = 'Scientific Roadmapping';
const HDPS = 'Hypothesis-Driven Problem Solving';
const NO_DASH = /[—–]/;

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script)].concat(args || []), {
    cwd: ROOT, env: process.env, encoding: 'utf8', timeout: 120000,
  });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

const reg = readJson('data/command-registry.json');
const conn = readJson('data/connector-registry.json');
const proj = readJson('data/brain-orchestration-projection.json');
const row = (reg.commands || []).find((c) => c && c.command === CMD);

// G1 every builder green under --check
{
  const builders = ['build-command-registry', 'build-connector-registry', 'build-harness-manifest',
    'build-orchestration-projection', 'build-render-coverage', 'build-skill-mirrors'];
  const bad = [];
  for (const b of builders) {
    const r = run('scripts/' + b + '.cjs', ['--check']);
    if (r.status !== 0) bad.push(b + '=' + r.status);
  }
  C.check('G1 every registry builder exits 0 under --check', bad.length === 0, bad.join(' | '));
}

// G2 registry row
C.check('G2 command-registry row: kind methodology, autonomous_safe false, both frameworks',
  !!row && row.kind === 'methodology' && row.autonomous_safe === false &&
  Array.isArray(row.frameworks) && row.frameworks.indexOf(SR) !== -1 && row.frameworks.indexOf(HDPS) !== -1,
  row ? JSON.stringify({ k: row.kind, s: row.autonomous_safe, f: row.frameworks }) : 'row absent');

// G3 framework_index storage under both frameworks
{
  const idx = reg.framework_index || {};
  const hd = idx[HDPS] || [];
  C.check('G3 framework_index lists the command under both frameworks, /mos:research stays first for HDPS',
    (idx[SR] || []).indexOf(CMD) !== -1 && hd.indexOf('/mos:research') === 0 && hd.indexOf(CMD) > 0,
    JSON.stringify({ sr: idx[SR], hd: hd }));
}

// G4 resolver order
{
  const resolver = require(path.join(ROOT, 'lib/workflow/command-resolver.cjs'));
  const first = resolver.commandsForFramework(HDPS)[0];
  C.check('G4 commandsForFramework(Hypothesis-Driven Problem Solving)[0] is /mos:research', first === '/mos:research', String(first));
}

// G5 posture
{
  const rm = require(path.join(ROOT, 'lib/core/recipe-maps.cjs'));
  const p = rm.postureForCommand(CMD);
  const posture = p && (p.posture !== undefined ? p.posture : p);
  const safe = p && Object.prototype.hasOwnProperty.call(p, 'autonomous_safe') ? p.autonomous_safe : false;
  C.check('G5 postureForCommand answers halt and autonomous_safe false',
    posture === 'halt' && safe === false && !!row && row.autonomous_safe === false, JSON.stringify(p));
}

// G6 reach wiring and connector entry
{
  const rm = require(path.join(ROOT, 'lib/core/recipe-maps.cjs'));
  const wired = rm.wiringForReach('context_block');
  const wiredList = Array.isArray(wired) ? wired : Object.values(wired || {});
  const inWiring = wiredList.some((w) => String(w && w.surface !== undefined ? w.surface : w).indexOf(CMD) !== -1);
  const entry = (conn.connectors || []).find((c) => c && c.surface === CMD);
  C.check('G6 wiringForReach(context_block) includes the command; connector entry carries sub_mode, framework, rank 6, no sensors',
    inWiring && !!entry && entry.sub_mode === 'scientific-roadmap' && entry.framework === SR &&
    entry.hierarchy_rank === 6 && Array.isArray(entry.sensor_triggers) && entry.sensor_triggers.length === 0,
    entry ? JSON.stringify(entry) : 'entry absent; inWiring=' + inWiring);
}

// G7 curated chains and projection edges
{
  const chains = (reg.curated_chains || []).filter((c) => c && c.from === 'command:' + CMD);
  const toResearch = chains.find((c) => c.to === 'command:/mos:research');
  const toAnalogies = chains.find((c) => c.to === 'command:/mos:find-analogies');
  const edge = (proj.edges || []).find((e) => e && e.type === 'FEEDS_INTO' && e.from === 'command:' + CMD && e.to === 'command:/mos:research');
  C.check('G7 curated chains to /mos:research (0.7) and /mos:find-analogies (0.5) exist and the projection carries FEEDS_INTO',
    !!toResearch && toResearch.kind === 'feeds_into' && toResearch.confidence === 0.7 && toResearch.transform === 'limiter-to-hypothesis' &&
    !!toAnalogies && toAnalogies.kind === 'feeds_into' && toAnalogies.confidence === 0.5 && toAnalogies.transform === 'limiter-to-analogy' &&
    !!edge && chains.length === 2,
    JSON.stringify(chains));
}

// G8 recipe count stays 5
{
  const rm = require(path.join(ROOT, 'lib/core/recipe-maps.cjs'));
  const keys = Object.keys(rm.NAMED_RECIPES || {}).concat(Object.keys(rm.SENS10_CAUSE_RECIPES || {}));
  C.check('G8 NAMED_RECIPES plus SENS10_CAUSE_RECIPES still count 5 and no key names scientific',
    keys.length === 5 && !keys.some((k) => /scientific/i.test(k)), keys.join(','));
}

// G9 command count equals disk
{
  const onDisk = fs.readdirSync(path.join(ROOT, 'commands')).filter((f) => f.endsWith('.md')).length;
  C.check('G9 the registry command count equals the commands/*.md files on disk', (reg.commands || []).length === onDisk,
    (reg.commands || []).length + ' vs ' + onDisk);
}

// G10 dash hygiene in the hand edits
{
  const chains = (reg.curated_chains || []).filter((c) => c && c.from === 'command:' + CMD);
  const hg = fs.readFileSync(path.join(ROOT, 'data/help-groups.json'), 'utf8');
  const line = hg.split(/\r?\n/).filter((l) => l.indexOf('"scientific-roadmap"') !== -1);
  C.check('G10 no em or en dash in the curated chain entries or the help-group line',
    chains.length > 0 && line.length > 0 && !NO_DASH.test(JSON.stringify(chains)) && !NO_DASH.test(line.join('\n')),
    'chains=' + chains.length + ' lines=' + line.length);
}

C.check('zero network attempts (last check)', net.attempts() === 0, String(net.attempts()));
process.exit(C.summary());
