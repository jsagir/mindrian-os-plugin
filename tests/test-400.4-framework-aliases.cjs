#!/usr/bin/env node
'use strict';
/*
 * Phase 400.4-01 (QA-F5): framework-name normalization and honest unresolved steps.
 * Legs R1 to R8. Plain node:assert script. Exit 1 on any failure.
 * The resolver reads plugin-local data only; this test makes no network call and never reads a room.
 * House rule: hyphens only.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO = path.join(__dirname, '..');
delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_COMMAND_REGISTRY;
const resolver = require(path.join(REPO, 'lib', 'workflow', 'command-resolver.cjs'));
const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'command-registry.json'), 'utf8'));
const names = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'framework-names.json'), 'utf8'));
const idx = registry.framework_index;

let failed = 0;
function leg(name, fn) {
  try { fn(); console.log('  ok - ' + name); } catch (e) { failed += 1; console.log('  FAIL - ' + name + ': ' + (e && e.message)); }
}
function norm(s) { return resolver.normalizeFrameworkName(s); }

leg('R1 five spellings of Beautiful Question resolve to /mos:beautiful-question', function () {
  const forms = ['Beautiful Question', 'Beautiful Questions', 'beautiful-question', '/mos:beautiful-question', '  BEAUTIFUL_QUESTION framework '];
  for (const f of forms) {
    const s = resolver.composeWorkflow([f])[0];
    assert.equal(s.command, '/mos:beautiful-question', 'command for ' + JSON.stringify(f));
    assert.equal(s.optional, false, 'optional for ' + JSON.stringify(f));
    assert.equal(s.step, 1);
  }
});

leg('R2 resolved_via and matched_framework are set on normalized and command_id steps', function () {
  const s = resolver.composeWorkflow(['Beautiful Question'])[0];
  assert.equal(s.resolved_via, 'normalized');
  assert.equal(s.matched_framework, 'Beautiful Question Framework');
  assert.equal(s.framework, 'Beautiful Question');
  const normKeys = new Set(Object.keys(idx).map(norm));
  const cmd = registry.commands.find(function (c) {
    const bare = String(c.command).replace(/^\/mos:/, '');
    return !normKeys.has(norm(bare)) && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(bare);
  });
  assert.ok(cmd, 'a registry command with a hyphenated id and no framework key must exist');
  const bare = cmd.command.replace(/^\/mos:/, '');
  for (const form of [bare, cmd.command]) {
    const t = resolver.composeWorkflow([form])[0];
    assert.equal(t.command, cmd.command, 'command for ' + form);
    assert.equal(t.resolved_via, 'command_id');
    assert.equal(t.matched_framework, null);
    assert.equal(t.optional, false);
  }
});

leg('R3 every framework_index key keeps the exact base step shape', function () {
  for (const k of Object.keys(idx)) {
    const got = resolver.composeWorkflow([k]);
    assert.deepStrictEqual(got, [{ step: 1, framework: k, command: idx[k][0] || null, optional: !(idx[k].length > 0) }], k);
    if (idx[k].length > 0) {
      assert.deepStrictEqual(Object.keys(got[0]), ['step', 'framework', 'command', 'optional'], k);
    }
  }
});

leg('R4 the framework_index keys normalize to distinct strings', function () {
  const seen = new Map();
  const collisions = [];
  for (const k of Object.keys(idx)) {
    const n = norm(k);
    if (seen.has(n)) collisions.push(seen.get(n) + ' | ' + k);
    else seen.set(n, k);
  }
  assert.deepStrictEqual(collisions, [], 'collisions: ' + collisions.join(' ; '));
  assert.equal(norm(null), '');
  assert.equal(norm(42), '');
});

leg('R5 an unknown name is reported as unresolved with a reason', function () {
  assert.deepStrictEqual(resolver.composeWorkflow(['Not A Real Framework 400']), [
    { step: 1, framework: 'Not A Real Framework 400', command: null, optional: false, unresolved: true, reason: 'unknown_framework_name' },
  ]);
});

leg('R6 a known framework name with no command stays an optional step', function () {
  const normKeys = new Set(Object.keys(idx).map(norm));
  const cmdIds = new Set(registry.commands.map(function (c) { return String(c.command).replace(/^\/mos:/, ''); }));
  const pick = names.framework_names.find(function (n) {
    const asId = String(n).trim().toLowerCase().replace(/[\s_]+/g, '-');
    return !normKeys.has(norm(n)) && !Object.prototype.hasOwnProperty.call(idx, n) && !cmdIds.has(asId);
  });
  assert.ok(pick, 'a known name with no command must exist');
  assert.deepStrictEqual(resolver.composeWorkflow([pick]), [{ step: 1, framework: pick, command: null, optional: true }]);
  const extra = names.curated_extras[0];
  if (extra && !Object.prototype.hasOwnProperty.call(idx, extra)) {
    assert.equal(resolver.composeWorkflow([extra])[0].optional, true);
  }
});

leg('R7 a missing registry degrades to the base shape with no unresolved key', function () {
  const prev = process.env.MINDRIAN_COMMAND_REGISTRY;
  try {
    process.env.MINDRIAN_COMMAND_REGISTRY = path.join(REPO, 'data', '__nonexistent_registry_400_4__.json');
    resolver.__reset();
    assert.deepStrictEqual(resolver.composeWorkflow(['Beautiful Question Framework', 'Red Teaming']), [
      { step: 1, framework: 'Beautiful Question Framework', command: null, optional: true },
      { step: 2, framework: 'Red Teaming', command: null, optional: true },
    ]);
    assert.deepStrictEqual(resolver.composeWorkflow(['Not A Real Framework 400']), [
      { step: 1, framework: 'Not A Real Framework 400', command: null, optional: true },
    ]);
  } finally {
    if (prev === undefined) delete process.env.MINDRIAN_COMMAND_REGISTRY; else process.env.MINDRIAN_COMMAND_REGISTRY = prev;
    resolver.__reset();
  }
});

leg('R8 commandsForFramework keeps the exact lookup', function () {
  assert.deepStrictEqual(resolver.commandsForFramework('Beautiful Question'), []);
  assert.deepStrictEqual(resolver.commandsForFramework('Beautiful Question Framework'), ['/mos:beautiful-question']);
});

if (failed > 0) { console.log('test-400.4-framework-aliases: ' + failed + ' leg(s) FAILED'); process.exit(1); }
console.log('test-400.4-framework-aliases: legs R1-R8 PASSED');
