#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 08: the README Eureka section and the engine guide say what the code does, no more.
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   K1  README section "### Eureka": the setup command, doctor, uv, Python 3.11, Node.js 22, model; /mos:eureka needs no
 *       engine; the plugin does not download or include the engine; 24 tools listed, 22 need the engine
 *   K2  README section no longer says the engine "is set up separately from the plugin" (the old fragment)
 *   K3  README section: offline after setup, never installs anything by itself, room text stays on the machine,
 *       and the check of the engine itself is still open (no claim of a verified engine)
 *   K4  engine guide: the enable command, saved setting, the 3 states, the fields, the opt-in variable and flags
 *   K5  engine guide: the old install-on-first-call and set-the-variable wording is gone; the override stays named
 *   K6  no em dash or en dash in either file; the README section holds none of the words ICM, MCP, projection, snapshot
 *   K7  the Known limits section still holds every needle of tests/test-eureka-373-02-readiness.cjs (run as a child)
 *   K8  engine guide: three parts, model folder, Node.js 22, the 3 route-level reasons, the 4 safety flags, the 2 files, github.com
 *   K9  Known limits holds the fixed-text rule with its one exception; the guide says owner-run and claims no verified engine
 *
 * Node built-ins only. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function arm(label, fn) {
  try { fn(); passed += 1; process.stdout.write('ok - ' + label + '\n'); }
  catch (e) { failed += 1; process.stdout.write('FAIL - ' + label + '\n    ' + String(e && e.message || e).split('\n').join('\n    ') + '\n'); }
}

const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
const guide = fs.readFileSync(path.join(REPO, 'docs', 'integrations', 'mindrian-eureka-engine.md'), 'utf8');

// the README section that starts at the heading "### Eureka" and ends at the next heading or horizontal rule
function readmeSection() {
  const lines = readme.split('\n');
  const start = lines.findIndex((l) => /^### Eureka\b/.test(l));
  assert.ok(start !== -1, 'README has no "### Eureka" heading');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^#{1,6}\s/.test(lines[i]) || /^---+\s*$/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

function guideSection(heading) {
  const at = guide.indexOf(heading);
  assert.ok(at >= 0, 'engine guide has no "' + heading + '" section');
  const rest = guide.slice(at + 3);
  const next = rest.indexOf('\n## ');
  return next === -1 ? rest : rest.slice(0, next);
}

arm('K1 README: setup command, doctor, uv, Python 3.11, Node.js 22, model; no engine for /mos:eureka; engine not downloaded or included; 24 listed, 22 need the engine', () => {
  const s = readmeSection();
  for (const needle of ['/mos:eureka enable engine', '/mos:eureka enable', '/mos:doctor', 'uv', 'Python 3.11', 'Node.js 22', 'model']) {
    assert.ok(s.includes(needle), 'README section lacks: ' + needle);
  }
  assert.ok(/(no engine|without an engine|needs no extra)/i.test(s), 'README section does not say /mos:eureka needs no engine');
  assert.ok(/does not download or include/i.test(s), 'README section does not say the plugin does not download or include the engine');
  assert.ok(/24 (Eureka )?tools/.test(s) && /22 of them need the engine/.test(s), 'README section lacks "24 tools" and "22 of them need the engine"');
});

arm('K2 README: the old fragment is gone', () => {
  assert.ok(!readmeSection().includes('optional engine that is set up separately from the plugin'), 'the old fragment is still in the README section');
});

arm('K3 README: offline after setup, never installs by itself, room text stays on the machine, the engine check is still open', () => {
  const s = readmeSection();
  assert.ok(/offline/i.test(s), 'no word offline');
  assert.ok(/(by itself|on its own)/i.test(s), 'no "by itself" or "on its own"');
  assert.ok(/(stays on your machine|does not leave)/i.test(s), 'no statement that room text stays on the machine');
  assert.ok(/still open/i.test(s), 'no statement that the check of the engine itself is still open');
  assert.ok(!/(verified|proven|guaranteed)[^.]*(engine|offline)|(engine|offline)[^.]*(is|was) (verified|proven|guaranteed)/i.test(s), 'the README section claims a verified engine');
});

arm('K4 engine guide: enable command, saved setting, 3 states, fields, opt-in variable, flags', () => {
  for (const needle of ['/mos:eureka enable engine', 'saved setting', 'absent', 'present', 'broken', 'engine_state', 'cause', 'fix',
    'MINDRIAN_EUREKA_ALLOW_NETWORK', '--extras', '--deep', '--data']) {
    assert.ok(guide.includes(needle), 'engine guide lacks: ' + needle);
  }
});

arm('K5 engine guide: the old wording is gone, the override stays named', () => {
  assert.ok(!guide.includes('The first call may install that package extra'), 'the install-on-first-call sentence is still there');
  assert.ok(!guide.includes('If the variable is unset or invalid, the tool returns a clear configuration refusal.'), 'the old refusal sentence is still there');
  assert.ok(!guide.includes('To enable the composed tools, set'), 'the set-the-variable way to enable is still there');
  assert.ok(guide.includes('MINDRIAN_EUREKA_ROOT'), 'the override variable is no longer named');
});

arm('K6 no em dash or en dash in either file; the README section holds none of ICM, MCP, projection, snapshot', () => {
  for (const [name, text] of [['README.md', readme], ['engine guide', guide]]) {
    assert.ok(!text.includes(EM) && !text.includes(EN), name + ' holds an em dash or an en dash');
  }
  const s = readmeSection();
  assert.ok(!/\bICM\b/.test(s) && !/\bMCP\b/.test(s) && !/projection/i.test(s) && !/snapshot/i.test(s), 'README section holds a banned word');
});

arm('K7 the Known limits needles of the 373-02 readiness test still hold', () => {
  const res = childProcess.spawnSync(process.execPath, [path.join(REPO, 'tests', 'test-eureka-373-02-readiness.cjs')], { encoding: 'utf8', shell: false, timeout: 120000 });
  assert.equal(res.status, 0, 'readiness test exit ' + res.status + ' ' + String(res.stderr).slice(0, 300));
});

arm('K8 engine guide: three parts, model folder, Node.js 22, route-level reasons, safety flags, files, hosts', () => {
  for (const needle of ['three parts', 'model folder', 'Node.js 22', 'engine_extra_missing', 'engine_model_missing', 'engine_node_missing',
    '--no-sync', '--offline', '--locked', '--no-python-downloads', 'jobs.sqlite3', 'embeddings.sqlite3', 'github.com is not contacted']) {
    assert.ok(guide.includes(needle), 'engine guide lacks: ' + needle);
  }
});

arm('K9 Known limits: fixed text with its one exception; the leak test is owner-run; no verified-engine claim', () => {
  const known = guideSection('## Known limits');
  assert.ok(known.includes('engine_start_line') && known.includes('before it receives any request'), 'Known limits lacks the engine_start_line exception');
  assert.ok(/owner-run/.test(guide), 'the guide does not say owner-run');
  assert.ok(!/real engine (was|has been|is) (verified|proven)|verified (that )?the real engine/i.test(guide), 'the guide claims the real engine was verified');
});

process.stdout.write('\ntest-387-eureka-docs-wording: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
