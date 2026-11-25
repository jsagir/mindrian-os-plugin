'use strict';
// Quick 261125: the forced output style carries a runtime core, so MindrianOS still
// operates in a session where the Larry agent is not the main agent. Claude Code 2.1.323
// deprecated the plugin default agent (settings.json `agent`), so the agent can no longer
// be the only carrier of the operating rules.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const style = fs.readFileSync(path.join(ROOT, 'output-styles', 'destijl.md'), 'utf8');
const agent = fs.readFileSync(path.join(ROOT, 'agents', 'larry-extended.md'), 'utf8');
let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log('PASS: ' + name); }
const m = style.match(/^---\n([\s\S]*?)\n---\n/);
check('the style is forced for the plugin', () => {
  assert.ok(m, 'no frontmatter');
  assert.ok(/^force-for-plugin:\s*true\s*$/m.test(m[1]), 'force-for-plugin: true is missing');
});
const start = style.indexOf('## Runtime core');
const end = style.indexOf('## The 4 Zones (Fixed Order)');
check('the runtime core section sits before the zones', () => {
  assert.ok(start > 0 && end > start, 'section missing or out of order');
});
const core = style.slice(start, end);
check('the core names each floor rule', () => {
  for (const needle of ['context_assemble', 'memory_event', 'AskUserQuestion', 'gate_answer', 'brain_ask', 'brain_query', 'suggest_next', 'goal_job', 'Canon Part 8', 'powered by Claude']) {
    assert.ok(core.includes(needle), 'core lacks ' + needle);
  }
});
check('the core carries both marker tokens', () => {
  assert.ok(core.includes('MOS-STYLE-CORE-1'));
  assert.ok(core.includes('MOS-AGENT-PRESENT'));
});
check('the agent section the marker keys on exists in the agent, and the tokens do not', () => {
  assert.ok(/^## Operating invisibly$/m.test(agent), 'agent lacks ## Operating invisibly');
  assert.ok(!agent.includes('MOS-STYLE-CORE-1') && !agent.includes('MOS-AGENT-PRESENT'));
});
check('no em dash, en dash or spaced double hyphen in the core', () => {
  assert.ok(!/[\u2014\u2013]/.test(core), 'dash found');
  assert.ok(!/ -- /.test(core), 'spaced double hyphen found');
});
console.log('RESULT: PASS=' + passed + ' FAIL=0');
