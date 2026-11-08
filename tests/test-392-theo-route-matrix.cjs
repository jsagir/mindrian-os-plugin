#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 02 Task 2 -- the Theo route matrix (392-SC2, F6 bypass 5).
 *
 * THE SEAM THIS PINS: three matchers decide which tool calls the Part 8
 * guard and the response sanitizer see:
 *   hook_sees   the PreToolUse matcher of the part8-egress-guard-hook entry
 *               in hooks/hooks.json
 *   post_sees   the PostToolUse matcher of the brain-response-sanitize-hook
 *               entry in hooks/hooks.json
 *   shaped_sees lib/core/brain-response-sanitize.cjs BRAIN_SHAPED_TOOL_MATCHER
 * On beta.81 every non-brain_* Theo tool name and every claude.ai connector
 * name falls outside all three (F6 bypass 5). This test records the three
 * booleans for a fixed list of tool names into a committed fixture, then
 * fails when any live matcher disagrees with the fixture. Wave 0 commits the
 * gap (state beta81_gap); plan 392-06 rewrites the fixture to the closed
 * state and this same test turns RED until the matchers are widened.
 *
 * Anchored regular expressions (^ and $) so a name that merely contains
 * mindrian-brain does not match (T-392-06).
 *
 * Run:    node tests/test-392-theo-route-matrix.cjs
 * Record: node tests/test-392-theo-route-matrix.cjs --record --state <text>
 * Plain Node harness, exit 1 on any failure. Hyphens only, no em dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HOOKS_PATH = path.join(REPO, 'hooks', 'hooks.json');
const SANITIZE_PATH = path.join(REPO, 'lib', 'core', 'brain-response-sanitize.cjs');
const FIXTURE_DIR = path.join(REPO, 'tests', 'fixtures', '392-part8-replay');
const FIXTURE_PATH = path.join(FIXTURE_DIR, 'route-matrix.json');

const GUARD_HOOK_FILE = 'part8-egress-guard-hook.cjs';
const SANITIZE_HOOK_FILE = 'brain-response-sanitize-hook.cjs';

/** The fixed tool-name list (MAPS.md map 2). mcp__notion__search is the non-Theo control. */
const TOOL_NAMES = Object.freeze([
  'mcp__plugin_mos_mindrian-brain__brain_ask',
  'mcp__mindrian-brain__brain_search',
  'mcp__theo__brain_ask',
  'mcp__theo__search',
  'mcp__theo__search_theo_chunks_fulltext',
  'mcp__theo__text2cypher',
  'mcp__theo__recommend_chain',
  'mcp__theo__classify_problem_type',
  'mcp__theo__case_story',
  'mcp__theo__room_bind',
  'mcp__theo-context__canon_search',
  'mcp__theo-context__normalize_framework_name',
  'mcp__claude_ai_Theo-Claude__canon_search',
  'mcp__claude_ai_Theo-Claude__framework_route',
  'mcp__claude_ai_theo-claude__canon_search',
  'mcp__claude_ai_PWS_Brain__brain_ask',
  'mcp__claude_ai_PWS_brain__brain_ask',
  'mcp__pws-brain-mcp__brain_ask',
  'mcp__pws-brain-mcp__search',
  'mcp__notion__search',
]);

function readHooks() {
  const raw = JSON.parse(fs.readFileSync(HOOKS_PATH, 'utf8'));
  return raw && raw.hooks && typeof raw.hooks === 'object' ? raw.hooks : raw;
}

/** The matcher string of the one entry under `event` whose command names `file`. */
function matcherFor(hooks, event, file) {
  const entries = Array.isArray(hooks[event]) ? hooks[event] : [];
  const hits = entries.filter((e) => Array.isArray(e.hooks) && e.hooks.some((h) => typeof h.command === 'string' && h.command.includes(file)));
  if (hits.length !== 1) {
    throw new Error('hooks.json ' + event + ': expected exactly 1 entry naming ' + file + ', found ' + hits.length);
  }
  if (typeof hits[0].matcher !== 'string' || hits[0].matcher.length === 0) {
    throw new Error('hooks.json ' + event + ' entry for ' + file + ' has no matcher string');
  }
  return hits[0].matcher;
}

function liveMatchers() {
  const hooks = readHooks();
  const sanitize = require(SANITIZE_PATH);
  if (typeof sanitize.BRAIN_SHAPED_TOOL_MATCHER !== 'string') {
    throw new Error('brain-response-sanitize.cjs does not export BRAIN_SHAPED_TOOL_MATCHER as a string');
  }
  return {
    hook: matcherFor(hooks, 'PreToolUse', GUARD_HOOK_FILE),
    post: matcherFor(hooks, 'PostToolUse', SANITIZE_HOOK_FILE),
    shaped: sanitize.BRAIN_SHAPED_TOOL_MATCHER,
  };
}

function anchored(src) {
  return new RegExp('^' + src + '$');
}

function computeRows(matchers) {
  const hookRe = anchored(matchers.hook);
  const postRe = anchored(matchers.post);
  const shapedRe = anchored(matchers.shaped);
  return TOOL_NAMES.map((name) => ({
    name: name,
    hook_sees: hookRe.test(name),
    post_sees: postRe.test(name),
    shaped_sees: shapedRe.test(name),
  }));
}

function gitShortHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  } catch (_e) {
    return 'unknown';
  }
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function record() {
  const state = argValue('--state');
  if (!state) {
    console.error('FAIL: --record needs --state <text>');
    process.exit(1);
  }
  const matchers = liveMatchers();
  const fixture = {
    _note: 'Phase 392 route matrix: which Theo tool names the Part 8 guard hook (hook_sees), the response sanitizer hook (post_sees) and BRAIN_SHAPED_TOOL_MATCHER (shaped_sees) match, anchored. Recorded from the live matchers by tests/test-392-theo-route-matrix.cjs --record. state beta81_gap = the F6 bypass 5 gap, committed before plan 392-06 closes it. No room content; tool names only.',
    guard_head: gitShortHead(),
    state: state,
    recorded_at: new Date().toISOString(),
    matchers: {
      hook: matchers.hook,
      post: matchers.post,
      shaped: matchers.shaped,
    },
    rows: computeRows(matchers),
  };
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n');
  console.log('recorded ' + fixture.rows.length + ' rows to ' + path.relative(REPO, FIXTURE_PATH) + ' (state ' + state + ', guard_head ' + fixture.guard_head + ')');
}

function printGap(rows) {
  const gap = rows.filter((r) => r.name.startsWith('mcp__theo') && r.hook_sees === false);
  console.log('hook_sees=false for ' + gap.length + ' mcp__theo* name(s):');
  for (const r of gap) console.log('  gap  ' + r.name);
}

function verify() {
  console.log('test-392-theo-route-matrix');
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.log('  FAIL [R0] fixture missing at ' + path.relative(REPO, FIXTURE_PATH) + ' (run with --record --state <text> to create it)');
    console.log('FAIL: test-392-theo-route-matrix (fixture missing)');
    process.exit(1);
  }
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  let checks = 0;
  let failed = 0;
  const ok = (label, cond) => {
    checks += 1;
    if (cond) console.log('  ok   ' + label);
    else {
      failed += 1;
      console.log('  FAIL ' + label);
    }
  };

  ok('[R0] fixture has guard_head', typeof fixture.guard_head === 'string' && fixture.guard_head.length > 0);
  ok('[R0] fixture has state', typeof fixture.state === 'string' && fixture.state.length > 0);
  ok('[R0] fixture rows is a non-empty array', Array.isArray(fixture.rows) && fixture.rows.length > 0);

  const matchers = liveMatchers();
  const live = computeRows(matchers);
  const fixtureByName = new Map((fixture.rows || []).map((r) => [r.name, r]));

  ok('[R1] fixture names equal the fixed tool-name list', fixture.rows.length === TOOL_NAMES.length && TOOL_NAMES.every((n) => fixtureByName.has(n)));

  for (const row of live) {
    const fx = fixtureByName.get(row.name);
    if (!fx) {
      ok('[R2] ' + row.name + ' present in fixture', false);
      continue;
    }
    const same = fx.hook_sees === row.hook_sees && fx.post_sees === row.post_sees && fx.shaped_sees === row.shaped_sees;
    ok('[R2] ' + row.name + ' hook=' + row.hook_sees + ' post=' + row.post_sees + ' shaped=' + row.shaped_sees + (same ? '' : ' (fixture: hook=' + fx.hook_sees + ' post=' + fx.post_sees + ' shaped=' + fx.shaped_sees + ')'), same);
  }

  const control = live.find((r) => r.name === 'mcp__notion__search');
  ok('[R3] the non-Theo control never matches', !!control && !control.hook_sees && !control.post_sees && !control.shaped_sees);

  console.log('');
  console.log('state: ' + fixture.state + '  guard_head: ' + fixture.guard_head);
  printGap(live);
  console.log('');
  console.log('======================================');
  console.log('Checks: ' + checks + '  Failed: ' + failed);
  console.log('======================================');
  if (failed > 0) process.exit(1);
}

try {
  if (process.argv.includes('--record')) record();
  else verify();
} catch (e) {
  console.error('FAIL: test-392-theo-route-matrix');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
