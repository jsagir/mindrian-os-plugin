#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 Plan 04 -- pins the /mos:eureka enable engine command text.
 *
 * WHAT: arms W1 to W11 read commands/eureka.md and its generated mirror skills/eureka/SKILL.md as text.
 * They check the new subcommand, the 3 engine states, the setup parts, the route-level answers, the
 * grant-gated sync step, the rewritten advanced section and the mirror. No network, no engine, no room.
 *
 * Idiom: tests/test-341-eureka-no-brain-reach.cjs (bare node:assert, counters, exit 1 on any FAIL).
 * House rule: hyphens only. The dash characters are written as code point escapes here.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const CMD = path.join(REPO, 'commands', 'eureka.md');
const MIRROR = path.join(REPO, 'skills', 'eureka', 'SKILL.md');
const { parseFrontmatter } = require(path.join(REPO, 'scripts', 'build-command-registry.cjs'));

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

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

const ENGINE = section(cmd, '## Subcommand: enable engine');
const WRITES = section(cmd, '## What this run writes and what leaves the machine');
const ROUTING = section(cmd, '## Subcommand Routing');
const ADV_CLI = section(cmd, '## Direct catalogued engine CLI (advanced)');
const ADV_MCP = section(cmd, '## Direct catalogued engine MCP (advanced)');
const CROSS = section(cmd, '## Cross-Surface Adaptation');
const fm = parseFrontmatter(cmd);
const fmText = frontmatterText(cmd);

arm('W1 argument-hint is [run|enable|enable engine]', function () {
  assert.strictEqual(fm['argument-hint'], '[run|enable|enable engine]');
});

arm('W2 routing table holds a row for enable engine', function () {
  assert.ok(/^\|\s*`enable engine`\s*\|\s*E \(Action Report\)\s*\|/m.test(ROUTING), 'no enable engine row in the routing table');
});

arm('W3 section calls the enable core with CLAUDE_PLUGIN_ROOT and names every flag', function () {
  assert.ok(ENGINE.length > 0, 'section "## Subcommand: enable engine" is missing');
  assert.ok(/```bash[\s\S]*CLAUDE_PLUGIN_ROOT[\s\S]*lib\/core\/eureka\/eureka-engine-enable\.cjs/.test(ENGINE), 'no bash line with CLAUDE_PLUGIN_ROOT and the enable core');
  ['--check', '--path', '--forget', '--data', '--sync', '--extras', '--approved-via cli', '--deep'].forEach(function (flag) {
    assert.ok(ENGINE.includes(flag), 'flag not named: ' + flag);
  });
});

arm('W4 section names the 3 states, the 3-line error pattern and room independence', function () {
  assert.ok(ENGINE.length > 0, 'section is missing');
  ['absent', 'present', 'broken'].forEach(function (w) {
    assert.ok(new RegExp('\\b' + w + '\\b').test(ENGINE), 'state word missing: ' + w);
  });
  assert.ok(/^\s*x /m.test(ENGINE), 'no error line starting with x');
  assert.ok(/^\s*Why:/m.test(ENGINE), 'no Why: line');
  assert.ok(/^\s*Fix:/m.test(ENGINE), 'no Fix: line');
  assert.ok(/room-independent/.test(ENGINE), 'does not say the step is room-independent');
});

arm('W5 frontmatter holds the engine setup grant stage (F.0, gate) and still parses', function () {
  assert.ok(/-?\s*stage:\s*"engine setup grant"\s*\n\s*shapes:\s*\["F\.0"\]\s*\n\s*mode:\s*"gate"/.test(fmText), 'stage "engine setup grant" with shapes ["F.0"] and mode "gate" is missing');
  assert.strictEqual(fm.name, 'eureka');
  assert.ok(Array.isArray(fm.hitl_stages) && fm.hitl_stages.length >= 4, 'hitl_stages did not parse with the registry parser');
  assert.ok(/optional setup step that reaches package hosts runs only after the person approves a grant card/.test(fmText), 'hitl_why lacks the new sentence');
});

arm('W6 advanced CLI step 1 uses the check first and names the variable only as an override', function () {
  assert.ok(!cmd.includes('Confirm `MINDRIAN_EUREKA_ROOT` points to the local `mindrian-eureka` checkout'), 'old sentence still present');
  assert.ok(ADV_CLI.includes('/mos:eureka enable engine --check'), 'advanced CLI section does not name the check');
  assert.ok(/MINDRIAN_EUREKA_ROOT[^\n]*override/.test(ADV_CLI), 'variable is not named as an override');
  assert.ok(cmd.includes('~/.mindrian/eureka-engine.json'), 'saved setting file is not named');
});

arm('W7 Cross-Surface Adaptation gives one sentence each for CLI, Desktop and Cowork', function () {
  assert.ok(/Engine states/.test(CROSS), 'no Engine states paragraph');
  const para = CROSS.split(/\n\s*\n/).find(function (p) { return /Engine states/.test(p); }) || '';
  assert.ok(/CLI:/.test(para), 'no CLI sentence');
  assert.ok(/Desktop:/.test(para), 'no Desktop sentence');
  assert.ok(/Cowork:/.test(para), 'no Cowork sentence');
  assert.ok(/where the saved setting is not found/.test(para), 'Cowork sentence overclaims');
  assert.ok(/needs? no engine/.test(CROSS) && /research_run/.test(CROSS), 'does not say /mos:eureka and research_run need no engine');
});

arm('W8 the plugin does not download or include the engine (once)', function () {
  const sentence = 'The plugin does not download or include the engine.';
  assert.strictEqual(cmd.split(sentence).length - 1, 1, 'sentence must appear exactly once');
});

arm('W9 mirror matches the generator and no dash characters', function () {
  const r = spawnSync('node', [path.join(REPO, 'scripts', 'build-skill-mirrors.cjs'), '--check'], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(r.status, 0, 'build-skill-mirrors --check failed: ' + String(r.stdout || r.stderr).slice(-300));
  const mirror = fs.readFileSync(MIRROR, 'utf8');
  [['command', cmd], ['mirror', mirror]].forEach(function (pair) {
    assert.ok(!pair[1].includes(EM), pair[0] + ' holds an em dash');
    assert.ok(!pair[1].includes(EN), pair[0] + ' holds an en dash');
  });
});

arm('W10 writes section names the saved file, the grant-gated sync, the .venv and the engine data folders', function () {
  assert.ok(WRITES.includes('~/.mindrian/eureka-engine.json'), 'saved setting file missing');
  assert.ok(/--sync/.test(WRITES) && /grant/.test(WRITES), 'grant-gated sync missing');
  assert.ok(WRITES.includes('.venv'), '.venv missing');
  assert.ok(WRITES.includes('~/.local/share/mindrian-eureka'), 'data folder missing');
  assert.ok(WRITES.includes('~/.cache/mindrian-eureka'), 'cache folder missing');
});

arm('W11 setup parts, model sentence, route-level reasons and the github.com statement', function () {
  assert.ok(ENGINE.length > 0, 'section is missing');
  assert.ok(/three parts/i.test(ENGINE), 'no setup-parts statement');
  assert.ok(/Python packages/.test(ENGINE) && /model folder/.test(ENGINE) && /Node\.js 22 or newer/.test(ENGINE), 'three setup parts not all named');
  assert.ok(ENGINE.includes('The plugin never downloads a model.'), 'model sentence missing');
  assert.ok(/never installs uv, Python or Node\.js/.test(ENGINE), 'no-install sentence missing');
  const states = (ENGINE + '\n' + ADV_MCP + '\n' + CROSS);
  ['engine_extra_missing', 'engine_model_missing', 'engine_node_missing'].forEach(function (r) {
    assert.ok(ENGINE.includes(r), 'enable engine section lacks ' + r);
    assert.ok(states.includes(r), r + ' missing');
  });
  assert.ok(/github\.com is not contacted/.test(ENGINE) && /Python downloads are off/.test(ENGINE), 'github.com statement missing');
});

console.log('\nPhase 387-04 command wiring: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
