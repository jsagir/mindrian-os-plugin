/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-05 Plan 05 -- mva-option-router tests.
 *
 * 17 tests covering:
 *   - 3 option paths (1 = stay_in_just_talk, 2 = phase_119_stub, 3 = invoke_challenge_assumptions)
 *   - Telemetry emission (mva_option_selected with sentence_sha256 + option_id + time_to_click_ms)
 *   - Operator transitions (option 1 -> JUST_TALK; option 2 -> no transition; option 3 -> METHODOLOGY)
 *   - Edge cases: invalid option (no telemetry), missing side-file, brief still rendering
 *   - resolveCurrentSha8 (CRITICAL-3 part 2 wire): present / absent / staleness pass-through
 *   - File-inspection tests for commands/mva-option.md + skills/mva-pipeline/SKILL.md (Tests 13-16)
 *   - End-to-end integration: /mos:mva-option 2 with no sha argument resolves from state.json (Test 17)
 *
 * Hermetic temp-HOME isolation: every test uses fs.mkdtempSync for HOME and
 * cleans up after. process.env.HOME is restored on cleanup.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const ROUTER_PATH = path.join(PLUGIN_ROOT, 'lib', 'core', 'mva-option-router.cjs');
const SKILL_PATH = path.join(PLUGIN_ROOT, 'skills', 'mva-pipeline', 'SKILL.md');
const COMMAND_PATH = path.join(PLUGIN_ROOT, 'commands', 'mva-option.md');

// ---------- Test fixtures ----------

const FIXTURE_SHA8 = 'ab3c1234';
const FIXTURE_SHA256 = FIXTURE_SHA8 + 'a'.repeat(56); // 64 chars total

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mva-router-home-'));
}

function cleanupHome(homeDir, savedHome) {
  if (savedHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = savedHome;
  }
  try { fs.rmSync(homeDir, { recursive: true, force: true }); } catch (_) {}
}

function writeSideFile(homeDir, sha8, sha256, extra) {
  const dir = path.join(homeDir, '.mindrian', 'mva', 'briefs');
  fs.mkdirSync(dir, { recursive: true });
  const body = Object.assign({
    sha256: sha256,
    sha8: sha8,
    timestamp: new Date().toISOString(),
    results: [
      { agent_id: 'brain_similar', status: 'ok', payload: { summary: 'three precedents found' } },
    ],
  }, extra || {});
  fs.writeFileSync(path.join(dir, sha8 + '.json'), JSON.stringify(body), 'utf8');
}

function writeStateJson(homeDir, sha8, sha256, renderedAtMs, vercelUrl) {
  const dir = path.join(homeDir, '.mindrian', 'mva');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    current_sha8: sha8,
    current_sha256: sha256,
    rendered_at_ms: renderedAtMs,
    vercel_url: vercelUrl === undefined ? null : vercelUrl,
  }), 'utf8');
}

function writeBriefRenderedEvent(homeDir, sha256, renderedAtIso) {
  const dir = path.join(homeDir, '.mindrian', 'telemetry', 'v1.13');
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    event: 'mva_brief_rendered',
    timestamp: renderedAtIso || new Date().toISOString(),
    session_id: 'default',
    sentence_sha256: sha256,
    total_duration_ms: 12000,
    agent_count_ok: 5,
    agent_count_failed: 1,
  }) + '\n';
  fs.appendFileSync(path.join(dir, 'mva.jsonl'), line, 'utf8');
}

function readTelemetryLines(homeDir) {
  const p = path.join(homeDir, '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  // Also reset the telemetry module (it caches paths via env at call time but
  // the module itself is stateless; still flush for hygiene).
  try { delete require.cache[require.resolve(path.join(PLUGIN_ROOT, 'lib', 'core', 'mva-telemetry.cjs'))]; } catch (_) {}
  return require(modulePath);
}

// ---------- Test 1: routeOption(1) -> stay_in_just_talk ----------

test('Test 1: routeOption(1, sha8) returns stay_in_just_talk + emits telemetry', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    const renderedAt = new Date(Date.now() - 1500).toISOString();
    writeBriefRenderedEvent(home, FIXTURE_SHA256, renderedAt);

    const router = freshRequire(ROUTER_PATH);
    const result = await router.routeOption(1, FIXTURE_SHA8, { roomDir: home });

    assert.equal(result.ok, true);
    assert.equal(result.action, 'stay_in_just_talk');
    assert.equal(result.next_state, 'JUST_TALK');
    assert.ok(typeof result.message === 'string' && result.message.length > 0);
    assert.ok(result.time_to_click_ms >= 1000 && result.time_to_click_ms < 60000);

    const events = readTelemetryLines(home);
    const opt = events.find(e => e.event === 'mva_option_selected');
    assert.ok(opt, 'mva_option_selected event must be emitted');
    assert.equal(opt.sentence_sha256, FIXTURE_SHA256);
    assert.equal(opt.option_id, 1);
    assert.ok(typeof opt.time_to_click_ms === 'number');
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 2: routeOption(2) -> phase_119_stub ----------

test('Test 2: routeOption(2, sha8) returns phase_119_stub + STUB_MESSAGE_119 + telemetry', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    writeBriefRenderedEvent(home, FIXTURE_SHA256, new Date(Date.now() - 500).toISOString());

    const router = freshRequire(ROUTER_PATH);
    const result = await router.routeOption(2, FIXTURE_SHA8, { roomDir: home });

    assert.equal(result.ok, true);
    assert.equal(result.action, 'phase_119_stub');
    assert.equal(result.message, router.STUB_MESSAGE_119, 'message must be the verbatim stub');
    assert.ok(router.STUB_MESSAGE_119.includes('Phase 119'), 'stub must mention Phase 119');
    assert.ok(router.STUB_MESSAGE_119.includes('beta.18'), 'stub must mention beta.18');

    const events = readTelemetryLines(home);
    const opt = events.find(e => e.event === 'mva_option_selected');
    assert.ok(opt, 'option-2 stub still emits telemetry (OQ18)');
    assert.equal(opt.option_id, 2);
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 3: routeOption(3) -> invoke_challenge_assumptions ----------

test('Test 3: routeOption(3, sha8) returns invoke_challenge_assumptions + METHODOLOGY transition', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    writeBriefRenderedEvent(home, FIXTURE_SHA256, new Date(Date.now() - 800).toISOString());

    const router = freshRequire(ROUTER_PATH);
    const result = await router.routeOption(3, FIXTURE_SHA8, { roomDir: home });

    assert.equal(result.ok, true);
    assert.equal(result.action, 'invoke_challenge_assumptions');
    assert.equal(result.next_state, 'METHODOLOGY');
    assert.equal(result.invoke_command, '/mos:challenge-assumptions --from-brief ' + FIXTURE_SHA8);

    const events = readTelemetryLines(home);
    const opt = events.find(e => e.event === 'mva_option_selected');
    assert.ok(opt);
    assert.equal(opt.option_id, 3);
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 4: missing side-file -> brief_not_found, no telemetry ----------

test('Test 4: missing side-file -> brief_not_found error, no telemetry emitted', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    // Side-file is intentionally NOT created. Brief-rendered event also absent.
    const router = freshRequire(ROUTER_PATH);
    const result = await router.routeOption(1, 'deadbeef', { roomDir: home });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'brief_not_found');
    assert.ok(typeof result.message === 'string' && result.message.length > 0);

    const events = readTelemetryLines(home);
    const optEvents = events.filter(e => e.event === 'mva_option_selected');
    assert.equal(optEvents.length, 0, 'no telemetry on error path');
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 5: brief still rendering -> friendly message ----------

test('Test 5: side-file present but no mva_brief_rendered event -> brief_still_rendering', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    // Do NOT write the mva_brief_rendered event (the pipeline is still streaming).

    const router = freshRequire(ROUTER_PATH);
    const result = await router.routeOption(1, FIXTURE_SHA8, { roomDir: home });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'brief_still_rendering');
    assert.match(result.message, /still rendering/);

    const events = readTelemetryLines(home);
    const optEvents = events.filter(e => e.event === 'mva_option_selected');
    assert.equal(optEvents.length, 0, 'no telemetry while rendering');
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 6: time_to_click_ms computed from mva_brief_rendered ts ----------

test('Test 6: time_to_click_ms is approximately (now - mva_brief_rendered.timestamp)', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    // Brief rendered 5 seconds ago.
    const renderedAt = new Date(Date.now() - 5000).toISOString();
    writeBriefRenderedEvent(home, FIXTURE_SHA256, renderedAt);

    const router = freshRequire(ROUTER_PATH);
    const result = await router.routeOption(1, FIXTURE_SHA8, { roomDir: home });

    assert.equal(result.ok, true);
    // Allow generous slack: 4500..7000ms
    assert.ok(result.time_to_click_ms >= 4500 && result.time_to_click_ms <= 7000,
      'time_to_click_ms should be ~5000, got: ' + result.time_to_click_ms);

    const events = readTelemetryLines(home);
    const opt = events.find(e => e.event === 'mva_option_selected');
    assert.ok(opt.time_to_click_ms >= 4500 && opt.time_to_click_ms <= 7000);
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 7: em-dash sweep on rendered messages ----------

test('Test 7: STUB_MESSAGE_119 + OPTION_BEHAVIOR narratives are em-dash-free', () => {
  const router = require(ROUTER_PATH);
  const emDash = '—';

  assert.ok(!router.STUB_MESSAGE_119.includes(emDash), 'STUB_MESSAGE_119 must not contain em-dash');
  for (const key of [1, 2, 3]) {
    const b = router.OPTION_BEHAVIOR[key];
    assert.ok(!b.narrative.includes(emDash),
      'OPTION_BEHAVIOR[' + key + '].narrative must not contain em-dash');
  }
});

// ---------- Test 8: invalid option (99) -> no state transition, no telemetry ----------

test('Test 8: routeOption(99) returns invalid_option, no telemetry, no state change', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    writeBriefRenderedEvent(home, FIXTURE_SHA256, new Date(Date.now() - 100).toISOString());

    const router = freshRequire(ROUTER_PATH);
    const result = await router.routeOption(99, FIXTURE_SHA8, { roomDir: home });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'invalid_option');

    const events = readTelemetryLines(home);
    const optEvents = events.filter(e => e.event === 'mva_option_selected');
    assert.equal(optEvents.length, 0);
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 9: OPTION_BEHAVIOR is a frozen object documenting each contract ----------

test('Test 9: OPTION_BEHAVIOR is Object.frozen with the 3 option contracts', () => {
  const router = require(ROUTER_PATH);
  assert.ok(Object.isFrozen(router.OPTION_BEHAVIOR));
  for (const id of [1, 2, 3]) {
    assert.ok(router.OPTION_BEHAVIOR[id], 'OPTION_BEHAVIOR[' + id + '] missing');
    assert.ok(typeof router.OPTION_BEHAVIOR[id].action === 'string');
    assert.ok(typeof router.OPTION_BEHAVIOR[id].narrative === 'string');
  }
  assert.equal(router.OPTION_BEHAVIOR[1].action, 'stay_in_just_talk');
  assert.equal(router.OPTION_BEHAVIOR[2].action, 'phase_119_stub');
  assert.equal(router.OPTION_BEHAVIOR[3].action, 'invoke_challenge_assumptions');
});

// ---------- Test 10: resolveCurrentSha8 reads ~/.mindrian/mva/state.json (CRITICAL-3 part 2) ----------

test('Test 10: resolveCurrentSha8 reads state.json + integration with routeOption(2) no-arg flow', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    writeStateJson(home, FIXTURE_SHA8, FIXTURE_SHA256, Date.now() - 2000, 'https://mos-brief-ab3c1234.vercel.app');
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    writeBriefRenderedEvent(home, FIXTURE_SHA256, new Date(Date.now() - 2000).toISOString());

    const router = freshRequire(ROUTER_PATH);
    const sha8 = router.resolveCurrentSha8();
    assert.equal(sha8, FIXTURE_SHA8);

    // Integration: simulate /mos:mva-option 2 with no explicit sha.
    const result = await router.routeOption(2, sha8, { roomDir: home });
    assert.equal(result.ok, true);
    assert.equal(result.action, 'phase_119_stub');

    const events = readTelemetryLines(home);
    const opt = events.find(e => e.event === 'mva_option_selected');
    assert.ok(opt);
    assert.equal(opt.sentence_sha256, FIXTURE_SHA256, 'telemetry carries resolved sha256 from state.json');
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 11: resolveCurrentSha8 returns null when state.json absent ----------

test('Test 11: resolveCurrentSha8 returns null on missing state.json (fresh-install / Hebrew refusal)', () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    // No state.json written.
    const router = freshRequire(ROUTER_PATH);
    const sha8 = router.resolveCurrentSha8();
    assert.equal(sha8, null);
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 12: resolveCurrentSha8 staleness pass-through (returns sha8 regardless of age) ----------

test('Test 12: resolveCurrentSha8 returns sha8 even when rendered_at_ms is old (staleness is router-level concern)', () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    // rendered_at_ms = 1 hour ago (stale by any reasonable threshold)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    writeStateJson(home, FIXTURE_SHA8, FIXTURE_SHA256, oneHourAgo, null);

    const router = freshRequire(ROUTER_PATH);
    const sha8 = router.resolveCurrentSha8();
    assert.equal(sha8, FIXTURE_SHA8, 'resolveCurrentSha8 returns sha8 regardless of age; staleness checked downstream');
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Test 13: commands/mva-option.md frontmatter ----------

test('Test 13: commands/mva-option.md exists with required frontmatter', () => {
  assert.ok(fs.existsSync(COMMAND_PATH), 'commands/mva-option.md must exist');
  const body = fs.readFileSync(COMMAND_PATH, 'utf8');
  assert.match(body, /^---[\s\S]*?name:\s*mva-option/m);
  assert.match(body, /argument-hint:\s*<1\|2\|3>\s*\[<sha8>\]/);
  assert.match(body, /allowed-tools:\s*Bash/);
  assert.match(body, /interactive_first_reward:\s*--none/);
});

// ---------- Test 14: command body documents resolveCurrentSha8 auto-discovery ----------

test('Test 14: commands/mva-option.md body documents the resolveCurrentSha8 auto-discovery path', () => {
  const body = fs.readFileSync(COMMAND_PATH, 'utf8');
  assert.match(body, /resolveCurrentSha8/);
  assert.match(body, /state\.json/);
  // Auto-resolution explanation must appear.
  assert.match(body, /auto-discover|auto-resolve|omitted/i);
  // Must reference the router module.
  assert.match(body, /mva-option-router/);
});

// ---------- Test 15: SKILL.md has the routing section ----------

test('Test 15: skills/mva-pipeline/SKILL.md has "Routing the 3-option footer" section', () => {
  assert.ok(fs.existsSync(SKILL_PATH));
  const body = fs.readFileSync(SKILL_PATH, 'utf8');
  assert.match(body, /## Routing the 3-option footer/);
  // Must list the 3 options + the recognition rule
  assert.match(body, /Option 1.*[Jj]ust tell me/);
  assert.match(body, /Option 2.*Build a room|invest/);
  assert.match(body, /Option 3.*Challenge me|Devil['']s Advocate/);
  // Must reference mva-option command
  assert.match(body, /mva-option/);
  // Must document brief-still-rendering edge case
  assert.match(body, /still rendering/);
});

// ---------- Test 16: em-dash sweep on both files ----------

test('Test 16: commands/mva-option.md + skills/mva-pipeline/SKILL.md are em-dash-free', () => {
  const emDash = '—';
  const cmd = fs.readFileSync(COMMAND_PATH, 'utf8');
  const skill = fs.readFileSync(SKILL_PATH, 'utf8');
  assert.ok(!cmd.includes(emDash), 'commands/mva-option.md must not contain em-dash');
  assert.ok(!skill.includes(emDash), 'skills/mva-pipeline/SKILL.md must not contain em-dash');
});

// ---------- Test 17: E2E -- /mos:mva-option 2 with no sha arg via documented Bash invocation ----------

test('Test 17: end-to-end -- routeOption(2) without explicit sha auto-resolves from state.json', async () => {
  const home = makeTempHome();
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    // Setup as if Plan 118-03 + 118-04 had just run:
    //   - state.json written by 118-03 orchestrator
    //   - side-file written by 118-04 deck builder
    //   - mva_brief_rendered event emitted by 118-03 telemetry
    writeStateJson(home, FIXTURE_SHA8, FIXTURE_SHA256, Date.now() - 3000, 'https://mos-brief-ab3c1234.vercel.app');
    writeSideFile(home, FIXTURE_SHA8, FIXTURE_SHA256);
    writeBriefRenderedEvent(home, FIXTURE_SHA256, new Date(Date.now() - 3000).toISOString());

    const router = freshRequire(ROUTER_PATH);

    // The wrapper pattern documented in commands/mva-option.md when sha8 omitted:
    //   const sha = r.resolveCurrentSha8();
    //   if (!sha) { surface no_current_brief }
    //   else r.routeOption(N, sha)
    const sha = router.resolveCurrentSha8();
    assert.ok(sha, 'resolveCurrentSha8 must succeed in E2E setup');

    const result = await router.routeOption(2, sha, { roomDir: home });
    assert.equal(result.ok, true);
    assert.equal(result.action, 'phase_119_stub');

    const events = readTelemetryLines(home);
    const opt = events.find(e => e.event === 'mva_option_selected');
    assert.ok(opt, 'E2E flow must emit mva_option_selected telemetry');
    assert.equal(opt.option_id, 2);
    assert.equal(opt.sentence_sha256, FIXTURE_SHA256);
    assert.ok(typeof opt.time_to_click_ms === 'number');
    assert.ok(opt.time_to_click_ms >= 2500 && opt.time_to_click_ms <= 5000,
      'E2E time_to_click_ms should be ~3000, got: ' + opt.time_to_click_ms);
  } finally {
    cleanupHome(home, savedHome);
  }
});

// ---------- Canon Part 8 source-sweep ----------

test('Canon Part 8: forbidden-token sweep on router source (no raw_sentence / MVA_SENTENCE)', () => {
  const src = fs.readFileSync(ROUTER_PATH, 'utf8');
  // Strip comments first so we can document forbidden patterns in JSDoc.
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/raw_sentence/.test(stripped), 'router source must not reference raw_sentence');
  assert.ok(!/MVA_SENTENCE/.test(stripped), 'router source must not reference MVA_SENTENCE');
});
