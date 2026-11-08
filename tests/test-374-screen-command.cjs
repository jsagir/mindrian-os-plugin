#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 374 Plan 09 -- pins the /mos:eureka screen subcommand text.
 *
 * WHAT: arms S1 to S10 read commands/eureka.md and its generated mirror skills/eureka/SKILL.md as text.
 * They check the argument hint, the routing row, the screen section and its steps in order, the new
 * hitl stage, the unchanged run section (sha256), the honesty sentences, the data rules bullet, the
 * mirror, the two hand-off commands and the dash fence. No network, no engine, no room.
 *
 * Idiom: tests/test-387-eureka-command-wiring.cjs (bare node:assert, counters, exit 1 on any FAIL).
 * House rule: hyphens only. The dash characters are written as code point escapes here.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const CMD = path.join(REPO, 'commands', 'eureka.md');
const MIRROR = path.join(REPO, 'skills', 'eureka', 'SKILL.md');
const { parseFrontmatter } = require(path.join(REPO, 'scripts', 'build-command-registry.cjs'));

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

// sha256 of the run section ('## Subcommand: run (default)' up to the line before the next '## ' heading),
// recorded from commands/eureka.md at base b3f253e0e before this plan edited the file.
const RUN_SECTION_SHA256 = '80063cd1e46a655a6886c579d1ff7e1a58fac8f1234262d95163c5e121d53a8c';
// The card shape the gate printed for OD-5A (ACT OD-5A F6 go).
const SCREEN_SHAPE = 'F.6';
// The four hitl_stages entries that existed before this plan, byte for byte.
const OLD_STAGES = [
  '  - stage: "plan review"\n    shapes: ["F.6"]\n    mode: "gate"\n',
  '  - stage: "quick policy grant"\n    shapes: ["F.0"]\n    mode: "gate"\n',
  '  - stage: "engine setup grant"\n    shapes: ["F.0"]\n    mode: "gate"\n',
  '  - stage: "filing"\n    shapes: ["F.8"]\n    mode: "parallel"\n',
];
// The delete-path wording that matches OD-2 (ADD-FORGET-TOOL); the same sentence the approval card carries.
const DELETE_WORDING = 'To forget this run later, ask Larry to forget it.';

const cmd = fs.readFileSync(CMD, 'utf8');

let PASS = 0;
let FAIL = 0;
function arm(label, fn) {
  try {
    fn();
    console.log('ok - ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL - ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
    FAIL += 1;
  }
}

// Slice of the text from a heading line to the next heading of the same or higher level.
function section(text, heading) {
  const level = (/^(#+)\s/.exec(heading) || [])[1].length;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(function (l) { return l.trim() === heading; });
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = /^(#+)\s/.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

function frontmatterText(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : '';
}

const SCREEN = section(cmd, '## Subcommand: screen');
const RUN = section(cmd, '## Subcommand: run (default)');
const WRITES = section(cmd, '## What this run writes and what leaves the machine');
const ROUTING = section(cmd, '## Subcommand Routing');
const CROSS = section(cmd, '## Cross-Surface Adaptation');
const fm = parseFrontmatter(cmd);
const fmText = frontmatterText(cmd);

arm('S1 argument-hint lists screen', function () {
  assert.strictEqual(fm['argument-hint'], '[run|screen|enable|enable engine]');
});

arm('S2 routing table has a screen row and no args still behaves as run', function () {
  assert.ok(/^\|\s*`screen`\s*\|\s*E \(Action Report\)\s*\|/m.test(ROUTING), 'no screen row in the routing table');
  assert.ok(ROUTING.includes('**no args behaves as `run`**'), 'the no-args sentence changed');
});

arm('S3 screen section holds the steps in order, each naming its tool', function () {
  assert.ok(SCREEN.length > 0, 'section "## Subcommand: screen" is missing');
  const order = ['eureka_capability_start', 'gate_answer', 'eureka_capability_job_status', 'eureka_capability_job_result'];
  let last = -1;
  order.forEach(function (name) {
    const at = SCREEN.indexOf(name, last + 1);
    assert.ok(at > last, name + ' is missing or out of order');
    last = at;
  });
  assert.ok(SCREEN.includes('opportunity.run_pair_screen'), 'capability id missing');
  assert.ok(/node_ids/.test(SCREEN) && /objective/.test(SCREEN), 'request fields missing');
  assert.ok(/2 to 2,500/.test(SCREEN), 'note count limit missing');
  assert.ok(SCREEN.includes('awaiting_approval') && SCREEN.includes('gate_id'), 'approval answer fields missing');
  assert.ok(SCREEN.includes('/mos:eureka enable engine --check'), 'engine check pointer missing');
  assert.ok(SCREEN.includes('/mos:find-connections') && SCREEN.includes('/mos:qualify-opportunity'), 'hand-off commands missing');
  const nums = (SCREEN.match(/^\d+\. /gm) || []).length;
  assert.ok(nums >= 8, 'fewer than 8 numbered steps: ' + nums);
});

arm('S4 hitl_stages holds the pair screen approval stage and the four old stages unchanged', function () {
  const a = fmText.indexOf('hitl_stages:\n');
  const b = fmText.indexOf('hitl_why:');
  assert.ok(a !== -1 && b > a, 'hitl_stages block not found');
  const block = fmText.slice(a + 'hitl_stages:\n'.length, b);
  OLD_STAGES.forEach(function (s) { assert.ok(block.includes(s), 'old stage changed: ' + s.split('\n')[0]); });
  const added = '  - stage: "pair screen approval"\n    shapes: ["' + SCREEN_SHAPE + '"]\n    mode: "gate"\n';
  assert.ok(block.includes(added), 'pair screen approval stage missing or wrong shape');
  assert.strictEqual(block.length, OLD_STAGES.join('').length + added.length, 'hitl_stages holds other content');
  assert.ok(/pair screen approval/.test(String(fm.hitl_why)), 'hitl_why does not name the pair screen approval');
});

arm('S5 run section is byte-for-byte unchanged', function () {
  assert.ok(RUN.length > 0, 'run section missing');
  const got = crypto.createHash('sha256').update(RUN).digest('hex');
  assert.strictEqual(got, RUN_SECTION_SHA256, 'run section sha256 changed: ' + got);
});

arm('S6 screen section states the honesty and data rules', function () {
  assert.ok(SCREEN.length > 0, 'section is missing');
  assert.ok(SCREEN.includes('candidate, not verified'), 'label missing');
  assert.ok(SCREEN.includes('caps_hit') && SCREEN.includes('warnings'), 'caps_hit and warnings not shown');
  assert.ok(/empty shortlist/.test(SCREEN) && /not proof of absence/.test(SCREEN), 'empty shortlist rule missing');
  assert.ok(/rank is not proof of novelty, evidence, demand or value/.test(SCREEN), 'rank rule missing');
  assert.ok(/[Tt]itles and source references are untrusted text/.test(SCREEN), 'untrusted text rule missing');
  assert.ok(/never as instructions/.test(SCREEN), 'never-as-instructions rule missing');
  assert.ok(/No call goes to Theo or Brain/.test(SCREEN), 'Theo and Brain sentence missing');
  assert.ok(/[Nn]othing is filed/.test(SCREEN), 'nothing-filed sentence missing');
  assert.ok(SCREEN.includes('30 days'), '30 day record missing');
  assert.ok(SCREEN.includes(DELETE_WORDING), 'delete-path wording missing');
  // Plan 374-13 added the forget tool: step 8 names it with confirm true, only on the person's ask, and holds no condition.
  assert.ok(SCREEN.includes('eureka_capability_job_forget') && /`confirm` true/.test(SCREEN), 'forget tool call missing');
  assert.ok(/Only when the person asks to forget the run/.test(SCREEN), 'forget only-on-ask sentence missing');
  assert.ok(!/If the tool list holds/.test(SCREEN) && !/nothing here deletes it sooner/.test(SCREEN), 'the old forget condition is still in the screen section');
  assert.ok(/24 hours/.test(SCREEN), 'plan expiry missing');
});

arm('S7 writes section gains a screen bullet with the data rules', function () {
  const line = (WRITES.split('\n').filter(function (l) { return /^- \*\*Pair screen/.test(l); })[0]) || '';
  assert.ok(line, 'no "- **Pair screen" bullet in the writes section');
  assert.ok(/writes nothing in the room/.test(line), 'writes-nothing statement missing');
  assert.ok(/stdio/.test(line) && /nowhere else/.test(line), 'stdio and nowhere-else statement missing');
  assert.ok(/30 days/.test(line) && /home folder/.test(line), '30 day record under the home folder missing');
});

arm('S8 mirror matches the generator and carries the screen section', function () {
  const r = spawnSync('node', [path.join(REPO, 'scripts', 'build-skill-mirrors.cjs'), '--check'], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(r.status, 0, 'build-skill-mirrors --check failed: ' + String(r.stdout || r.stderr).slice(-300));
  const mirror = fs.readFileSync(MIRROR, 'utf8');
  assert.ok(mirror.includes('Subcommand: screen'), 'mirror lacks the screen section');
  assert.ok(CROSS.includes('gate_answer'), 'cross-surface line lacks gate_answer');
});

arm('S9 hand-off command files exist', function () {
  assert.ok(fs.existsSync(path.join(REPO, 'commands', 'find-connections.md')), 'find-connections.md missing');
  assert.ok(fs.existsSync(path.join(REPO, 'commands', 'qualify-opportunity.md')), 'qualify-opportunity.md missing');
});

arm('S10 no en dash or em dash in the command or its mirror', function () {
  const mirror = fs.readFileSync(MIRROR, 'utf8');
  [['command', cmd], ['mirror', mirror]].forEach(function (pair) {
    assert.ok(!pair[1].includes(EM), pair[0] + ' holds an em dash');
    assert.ok(!pair[1].includes(EN), pair[0] + ' holds an en dash');
  });
});

console.log('\nPhase 374-09 screen command: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
