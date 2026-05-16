// statusline-two-row.test.cjs -- Phase 121.5-03 Task 2
//
// 12 behavioral tests covering the two-row renderer + version resolver +
// visual-ops palette derivation + migrate-stale-user-settings bare-path
// detection.
//
// Bash only. No emoji. No em-dashes.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RENDERER = path.join(REPO_ROOT, 'lib', 'statusline', 'two-row-renderer.cjs');
const VERSION_RESOLVER = path.join(REPO_ROOT, 'lib', 'statusline', 'version-resolver.cjs');
const TRUNCATOR = path.join(REPO_ROOT, 'lib', 'statusline', 'governing-thought-truncator.cjs');
const VISUAL_OPS = path.join(REPO_ROOT, 'lib', 'core', 'visual-ops.cjs');
const MIGRATOR = path.join(REPO_ROOT, 'scripts', 'migrate-stale-user-settings.cjs');

const renderer = require(RENDERER);
const versionResolver = require(VERSION_RESOLVER);

let passed = 0;
let failed = 0;

function ok(name) {
  console.log('  ok   ' + name);
  passed++;
}
function fail(name, msg) {
  console.error('  FAIL ' + name + (msg ? ' -- ' + msg : ''));
  failed++;
}
function assert(cond, name, msg) {
  if (cond) ok(name);
  else fail(name, msg);
}

console.log('test statusline-two-row');

// Test 1: renderRow1 shape with default state.
try {
  const out = renderer.renderRow1({
    current_version: '1.13.0-beta.18',
    brain_tier: 'BRAIN',
    ctx_pct: 47,
  });
  const hasBrand = out.indexOf('⬡ MindrianOS v1.13.0-beta.18') === 0;
  const hasBrain = out.indexOf('🧠 BRAIN') >= 0;
  const hasBar = out.indexOf('📊') >= 0 && out.indexOf('47%') >= 0;
  const hasSeparators = (out.match(/ │ /g) || []).length === 2;
  assert(hasBrand && hasBrain && hasBar && hasSeparators,
    'test1 renderRow1 shape',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test1 renderRow1 shape', e.message);
}

// Test 2: renderRow1 OMITS the update glyph when update_available is false.
try {
  const out = renderer.renderRow1({
    current_version: '1.13.0-beta.18',
    brain_tier: 'BRAIN',
    ctx_pct: 30,
    update_available: false,
  });
  const noGlyph = out.indexOf('🔄') === -1;
  assert(noGlyph, 'test2 renderRow1 omits update glyph when not available',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test2 renderRow1 omits update glyph', e.message);
}

// Test 3: renderRow1 INCLUDES `🔄 v<new>` when update_available is true.
try {
  const out = renderer.renderRow1({
    current_version: '1.13.0-beta.18',
    brain_tier: 'LOCAL',
    ctx_pct: 12,
    update_available: true,
    update_available_version: '1.13.0',
  });
  const hasGlyph = out.indexOf('🔄 v1.13.0') >= 0;
  const hasLocal = out.indexOf('🧠 LOCAL') >= 0;
  assert(hasGlyph && hasLocal,
    'test3 renderRow1 includes update glyph + LOCAL tier',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test3 renderRow1 includes update glyph', e.message);
}

// Test 4: renderBar at >=80% renders ANSI blink-red + ⚠ compaction-imminent
// warning text; at <80% does not. Byte-identical to Phase 106-02 D-02
// contract (the legacy compaction-imminent text was preserved in the
// renderer extraction; see test-context-monitor-d02-broadcast.cjs Test 3).
try {
  const lowBar = renderer.renderBar(45);
  const highBar = renderer.renderBar(85);
  const lowHasBlinkRed = lowBar.indexOf('\x1b[5;31m') >= 0;
  const highHasBlinkRed = highBar.indexOf('\x1b[5;31m') >= 0;
  const highHasWarn = highBar.indexOf('⚠ compaction-imminent') >= 0;
  const lowHasWarn = lowBar.indexOf('⚠') >= 0;
  // Bar geometry: 10 chars, 8 filled at 85, 4 filled at 45
  const lowFilledCount = (lowBar.match(/█/g) || []).length;
  const highFilledCount = (highBar.match(/█/g) || []).length;
  assert(!lowHasBlinkRed && highHasBlinkRed && highHasWarn && !lowHasWarn &&
         lowFilledCount === 4 && highFilledCount === 8,
    'test4 renderBar -- low=no blink-red/warn, high=blink-red+compaction-imminent, geometry correct',
    'low=' + JSON.stringify(lowBar) + ' high=' + JSON.stringify(highBar));
} catch (e) {
  fail('test4 renderBar', e.message);
}

// Test 5: renderRow2 full shape at COLUMNS=120.
try {
  const out = renderer.renderRow2({
    room: 'MindrianOS-Plugin',
    section: 'product-evolution',
    jtbd: 'find-problem',
    stage: 'ILL_DEFINED',
    governing_thought: 'JTBD-invariant single shape wins',
    operator: 'METHODOLOGY',
  }, 120);
  const hasRoom = out.indexOf('🏠 MindrianOS-Plugin') >= 0;
  const hasSection = out.indexOf('📂 product-evolution') >= 0;
  const hasJTBD = out.indexOf('🎯 find-problem') >= 0;
  const hasStage = out.indexOf('🔍 ILL_DEFINED') >= 0;
  const hasThought = out.indexOf('JTBD-invariant single shape wins') >= 0;
  const hasOperator = out.indexOf('METHODOLOGY') >= 0;
  assert(hasRoom && hasSection && hasJTBD && hasStage && hasThought && hasOperator,
    'test5 renderRow2 full shape at COLUMNS=120',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test5 renderRow2 full shape', e.message);
}

// Test 6: renderRow2 governing-thought truncation at exactly 40 chars boundary.
try {
  const longThought = 'a'.repeat(50); // 50 chars
  const out = renderer.renderRow2({
    room: 'r',
    section: 's',
    governing_thought: longThought,
  }, 120);
  // 37 'a's + '...'
  const expected = 'a'.repeat(37) + '...';
  const hasExpected = out.indexOf(expected) >= 0;
  // And the un-truncated tail must NOT appear (the 50-char string)
  const hasFull = out.indexOf(longThought) >= 0;
  assert(hasExpected && !hasFull,
    'test6 governing-thought truncation > 40 chars yields 37 + ...',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test6 governing-thought truncation', e.message);
}

// Test 7: renderRow2 at COLUMNS=60 drops the operator segment (60 < 80).
try {
  const out = renderer.renderRow2({
    room: 'r',
    section: 's',
    jtbd: 'j',
    stage: 'st',
    governing_thought: 'gt',
    operator: 'METHODOLOGY',
  }, 60);
  const noOperator = out.indexOf('METHODOLOGY') === -1;
  const hasStage = out.indexOf('🔍 st') >= 0;
  const hasJTBD = out.indexOf('🎯 j') >= 0;
  assert(noOperator && hasStage && hasJTBD,
    'test7 renderRow2 COLUMNS=60 drops operator, keeps stage + jtbd',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test7 renderRow2 COLUMNS=60', e.message);
}

// Test 8: renderRow2 at COLUMNS=50 drops operator AND stage.
try {
  const out = renderer.renderRow2({
    room: 'r',
    section: 's',
    jtbd: 'j',
    stage: 'st',
    governing_thought: 'gt',
    operator: 'METHODOLOGY',
  }, 50);
  const noOperator = out.indexOf('METHODOLOGY') === -1;
  const noStage = out.indexOf('🔍') === -1;
  const hasJTBD = out.indexOf('🎯 j') >= 0;
  assert(noOperator && noStage && hasJTBD,
    'test8 renderRow2 COLUMNS=50 drops operator + stage, keeps jtbd',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test8 renderRow2 COLUMNS=50', e.message);
}

// Test 9: renderRow2 at COLUMNS=40 drops operator, stage, AND jtbd.
try {
  const out = renderer.renderRow2({
    room: 'r',
    section: 's',
    jtbd: 'j',
    stage: 'st',
    governing_thought: 'gt',
    operator: 'METHODOLOGY',
  }, 40);
  const noOperator = out.indexOf('METHODOLOGY') === -1;
  const noStage = out.indexOf('🔍') === -1;
  const noJTBD = out.indexOf('🎯') === -1;
  const hasRoom = out.indexOf('🏠 r') >= 0;
  const hasThought = out.indexOf('gt') >= 0;
  assert(noOperator && noStage && noJTBD && hasRoom && hasThought,
    'test9 renderRow2 COLUMNS=40 drops operator + stage + jtbd, keeps room + thought',
    'got: ' + JSON.stringify(out));
} catch (e) {
  fail('test9 renderRow2 COLUMNS=40', e.message);
}

// Test 10: renderStatusline emits EXACTLY two newline-separated rows.
try {
  const out = renderer.renderStatusline({
    current_version: '1.13.0-beta.18',
    brain_tier: 'BRAIN',
    ctx_pct: 50,
    room: 'r',
    section: 's',
    jtbd: 'j',
    stage: 'st',
    governing_thought: 'gt',
    operator: 'METHODOLOGY',
  }, 120);
  const lines = out.split('\n');
  assert(lines.length === 2 && lines[0].length > 0 && lines[1].length > 0,
    'test10 renderStatusline emits exactly 2 newline-separated rows',
    'lines.length=' + lines.length);
} catch (e) {
  fail('test10 renderStatusline two-row split', e.message);
}

// Test 11: visual-ops.cjs DS_HEX now sourced from palette.json. Sentinel test:
// override MINDRIAN_PALETTE_PATH to point at a synthetic palette with a
// sentinel hex; spawn a child node that requires visual-ops + reports DS_HEX.
try {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-ops-test-'));
  const sentinelHex = '#abcdef';
  const fakePalette = {
    version: 1,
    base: {
      mondrian_red: sentinelHex,
      mondrian_blue: '#1e3a6e',
      mondrian_yellow: '#c8a43c',
      mondrian_black: '#0d0d0d',
      mondrian_white: '#f5f0e8',
      cream: '#f5f0e8',
      gray_meta: '#a09a90',
      amethyst: '#6b4e8b',
      success_green: '#2d6b4a',
    },
    palette_a_discovery: { muted_red: '#a63d2f', muted_green: '#2d6b4a', teal_accent: '#2a6b5e' },
    palette_b_build: { saturated_red: '#a63d2f', saturated_blue: '#1e3a6e', saturated_yellow: '#c8a43c' },
    extended: { sienna: '#b5602a', bg: '#0d0d0d', surface: '#1a1a1a', elevated: '#2a2a2a', gray: '#5c5a56' },
  };
  const fakePalettePath = path.join(tmpDir, 'fake-palette.json');
  fs.writeFileSync(fakePalettePath, JSON.stringify(fakePalette, null, 2));

  const child = spawnSync(process.execPath, [
    '-e',
    "const vo = require('" + VISUAL_OPS.replace(/\\/g, '\\\\') + "'); " +
    "process.stdout.write(JSON.stringify(vo.DS_HEX));"
  ], {
    env: Object.assign({}, process.env, { MINDRIAN_PALETTE_PATH: fakePalettePath }),
    encoding: 'utf8',
  });
  if (child.status !== 0) {
    fail('test11 DS_HEX from palette.json -- child failed: ' + child.stderr);
  } else {
    const dshex = JSON.parse(child.stdout);
    // The legacy DS_HEX key is `red` (not `mondrian_red`); the wiring should
    // alias so DS_HEX.red maps to palette.base.mondrian_red. Test the
    // sentinel hex propagation.
    const hasSentinel = dshex.red === sentinelHex || dshex.mondrian_red === sentinelHex;
    assert(hasSentinel,
      'test11 visual-ops DS_HEX sourced from palette.json sentinel',
      'got DS_HEX.red=' + dshex.red + ' / DS_HEX.mondrian_red=' + dshex.mondrian_red);
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
} catch (e) {
  fail('test11 DS_HEX from palette.json', e.message);
}

// Test 12: migrate-stale-user-settings.cjs --auto detects bare-path context-monitor
// and proposes migration via SessionStart envelope.
try {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-home-'));
  const claudeDir = path.join(tmpHome, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const fakeSettings = {
    statusLine: {
      type: 'command',
      command: 'node /home/x/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.5/scripts/context-monitor',
    },
  };
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(fakeSettings, null, 2));

  // Use --auto --quiet so stdout is JSON-only (no header lines). The QUIET
  // flag was added in Phase 106-01 D-01 specifically for hook-friendly
  // invocation; --auto without --quiet emits header lines + envelope.
  const child = spawnSync(process.execPath, [MIGRATOR, '--auto', '--quiet'], {
    env: Object.assign({}, process.env, { HOME: tmpHome, USERPROFILE: tmpHome }),
    encoding: 'utf8',
  });
  if (child.status !== 0) {
    fail('test12 migrate --auto detects bare-path', 'exit=' + child.status + ' stderr=' + child.stderr);
  } else {
    let envelope = null;
    try { envelope = JSON.parse(child.stdout); } catch (_) {}
    const hasAdditional =
      envelope &&
      envelope.hookSpecificOutput &&
      typeof envelope.hookSpecificOutput.additionalContext === 'string' &&
      envelope.hookSpecificOutput.additionalContext.indexOf('drift') >= 0;
    assert(hasAdditional,
      'test12 migrate --auto --quiet emits SessionStart envelope with drift warning',
      'stdout=' + child.stdout);
  }
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
} catch (e) {
  fail('test12 migrate --auto', e.message);
}

// Summary
console.log('');
console.log('statusline-two-row.test: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
process.exit(0);
