#!/usr/bin/env node
/**
 * Phase 369 plan 09 (CANON369-01, CANON369-02): the scoped Design Canon v3
 * exception, the parked orphan page, the retired "Tier 1 is the product" plan,
 * and the filed C10/C11 debt seed. Pure text pins; no network, no HOME writes.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function scenario(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  - ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL - ' + name + '\n         ' + (err && err.message));
  }
}

const SKILL = 'skills/ui-system/SKILL.md';
const PLATFORM = 'lib/mcp/app-html/mindrian-platform.html';
const RESEARCH = 'docs/research/MCP-APPS-STRATEGIC-RESEARCH.md';

scenario('1: SKILL.md carries the shell exception once, in section 0, naming the fonts, no outside host and the UI-SPEC', () => {
  const s = read(SKILL);
  const tag = 'Exception (2026-10-02, Phase 369)';
  assert.strictEqual(s.split(tag).length - 1, 1, 'exception appears exactly once');
  const iApplies = s.indexOf('Any future HTML surface inherits it.');
  const iExc = s.indexOf(tag);
  const iNext = s.indexOf('## 1. Four-Zone Output Anatomy');
  assert.ok(iApplies > -1 && iNext > -1, 'anchors present');
  assert.ok(iApplies < iExc && iExc < iNext, 'exception sits between the Applies-to line and section 1');
  const para = s.slice(iExc, iNext);
  for (const needle of ['Fraunces', 'DM Sans', 'Bodoni Moda', 'JetBrains Mono', 'no outside host', '369-UI-SPEC.md']) {
    assert.ok(para.includes(needle), 'exception names ' + needle);
  }
  assert.ok(para.includes('Every other HTML surface keeps v1.1'), 'scope stays on the shell only');
});

scenario('2: mindrian-platform.html is parked in its first 3 lines and app-views.cjs still never loads it', () => {
  const head = read(PLATFORM).split('\n').slice(0, 3).join('\n');
  assert.ok(head.startsWith('<!DOCTYPE html>'), 'doctype stays on line 1');
  assert.ok(head.includes('PARKED 2026-10-02 (Phase 369, D-02)'), 'dated parked header');
  assert.ok(!/mindrian-platform/.test(read('lib/mcp/app-views.cjs')), 'app-views.cjs references no mindrian-platform file');
});

scenario('3: the C10/C11 debt seed exists in house format and lists app-html files with lines', () => {
  const dir = path.join(ROOT, '.planning', 'seeds');
  const hits = fs.readdirSync(dir).filter((f) => /^SEED-\d+-mcp-app-html-dark-theme-and-cdn-debt\.md$/.test(f));
  assert.strictEqual(hits.length, 1, 'exactly one seed by slug');
  const s = fs.readFileSync(path.join(dir, hits[0]), 'utf8');
  const fm = s.split('---')[1] || '';
  for (const key of ['id', 'status', 'priority', 'planted', 'planted_during', 'trigger_when', 'scope', 'related']) {
    assert.ok(new RegExp('^' + key + ':', 'm').test(fm), 'frontmatter key ' + key);
  }
  assert.ok(/lib\/mcp\/app-html\/[a-z-]+\.html:\d+/.test(s), 'lists at least one lib/mcp/app-html file:line');
  assert.ok(/cdn|googleapis/.test(s) && /#1a1a1a/.test(s), 'covers both the CDN and the dark-default debt');
});

scenario('4: the strategic research doc carries the dated C12 retirement note', () => {
  const s = read(RESEARCH);
  assert.ok(s.includes('Status note 2026-10-02 (Phase 369, D-02, conflict C12)'), 'status note present');
  assert.ok(s.indexOf('Status note 2026-10-02') < s.indexOf('## Table of Contents'), 'note sits above the table of contents');
});

scenario('5: no em-dash or en-dash in the new text of the four edited files and the seed', () => {
  const s = read(SKILL);
  const iExc = s.indexOf('Exception (2026-10-02, Phase 369)');
  const para = s.slice(iExc, s.indexOf('\n', iExc));
  const plat = read(PLATFORM).split('\n')[1];
  const res = read(RESEARCH);
  const note = res.slice(res.indexOf('Status note 2026-10-02'), res.indexOf('\n', res.indexOf('Status note 2026-10-02')));
  const seedName = fs.readdirSync(path.join(ROOT, '.planning', 'seeds')).find((f) => /mcp-app-html-dark-theme-and-cdn-debt/.test(f));
  const seed = fs.readFileSync(path.join(ROOT, '.planning', 'seeds', seedName), 'utf8');
  for (const [label, text] of [['SKILL exception', para], ['platform header', plat], ['research note', note], ['seed', seed]]) {
    assert.ok(text.length > 20, label + ' text found');
    assert.ok(!text.includes(EM) && !text.includes(EN), label + ' has no em-dash or en-dash');
  }
});

console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ' test-369-canon-scope-docs.cjs (' + passed + '/' + (passed + failed) + ' scenarios)');
process.exit(failed === 0 ? 0 : 1);
