#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-07 Task 1 -- brain-derive-command.cjs fixture tests (12 cases)
 * ======================================================================
 * 12 tests across the /mos:brain-derive dispatcher. Exercises the 4
 * invocation modes (single section, --all, --cross-room, --dry-run)
 * plus graceful-degradation paths (Brain offline from start,
 * rate-limit mid-batch, invalid section, no active room, schema-gate
 * rejection on one section) plus streaming-progress surfacing and
 * the Shape E Action Report rendering contract.
 *
 * Mocking strategy:
 *   - Install a mock brain-client.cjs in require.cache for isAvailable()
 *     control (Canon Part 8 proxy: no real Brain traffic ever fires
 *     during tests).
 *   - Install a mock brain-derivation.cjs in require.cache with a
 *     deriveSection stub that returns programmable results and records
 *     every invocation into an audit array. Forces determinism without
 *     touching real Brain / real filesystem derivations.
 *   - Override MINDRIAN_ROOMS_ROOT + create a tmp registry.json so the
 *     dispatcher's resolveActiveRoom() resolves into a fixture room
 *     under the tmp tree instead of the real ~/MindrianRooms registry.
 *
 * The mock approach mirrors Plan 90-01 (brain-derivation.test.cjs) and
 * Plan 90-02 (brain-derivation-queue.test.cjs): override require.cache
 * entries BEFORE requiring the module under test; reset between tests.
 *
 * Pure node built-ins: fs, os, path, assert, child_process (spawnSync
 * for streaming progress stdout capture). No npm deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DISPATCHER_PATH = path.join(REPO_ROOT, 'scripts', 'brain-derive-command.cjs');

// ---------- Tmp workspace helpers ----------

const TMP_ROOTS = [];
function makeTmpRoot(tag) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-derive-cmd-' + tag + '-'));
  TMP_ROOTS.push(r);
  return r;
}
process.on('exit', function () {
  for (const r of TMP_ROOTS) {
    try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function writeFile(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

// ---------- Fixture builder: registry + room + sections ----------
//
// Build a tmp MindrianRooms dir with a registry.json pointing to one
// active room that has N sections, each with a minimal ROOM.md +
// MINTO.md so the dispatcher's resolveTargetSections() finds them.

function buildFixtureRooms(opts) {
  opts = opts || {};
  const roomsRoot = makeTmpRoot('rooms');
  const sectionsCount = opts.sections == null ? 3 : opts.sections;
  const roomSlug = opts.room_slug || 'fixture-room';
  const roomPath = path.join(roomsRoot, roomSlug);
  fs.mkdirSync(roomPath, { recursive: true });

  // Room-level ROOM.md.
  writeFile(path.join(roomPath, 'ROOM.md'), [
    '---',
    'name: "' + roomSlug + '"',
    'kind: room',
    '---',
    '',
    '# ' + roomSlug,
    '',
  ].join('\n'));

  // Sections. Each has ROOM.md + MINTO.md so readTriple finds them.
  const sectionNames = opts.section_names || (function () {
    const base = ['market-analysis', 'problem-definition', 'competitive-analysis',
                  'team-execution', 'solution-design', 'business-model',
                  'legal-ip', 'financial-model', 'go-to-market'];
    return base.slice(0, sectionsCount);
  })();
  for (const sec of sectionNames) {
    const sp = path.join(roomPath, sec);
    fs.mkdirSync(sp, { recursive: true });
    writeFile(path.join(sp, 'ROOM.md'), [
      '---',
      'name: "' + sec + '"',
      'kind: section',
      '---',
      '',
      '# ' + sec,
      '',
    ].join('\n'));
    writeFile(path.join(sp, 'MINTO.md'), [
      '---',
      'schema_version: 88',
      'version: 1',
      'section: "' + sec + '"',
      'last_generated_at: "2026-04-20T00:00:00Z"',
      'last_artifact_write_seen_at: "2026-04-20T00:00:00Z"',
      'arguments_count: 4',
      'evidence_density: 0.6',
      'mece_status: pass',
      'reasoning_health_score: 0.7',
      'flagged_weaknesses: []',
      'decision_log: []',
      '---',
      '',
      '## Governing Thought',
      '',
      'The venture validates its primary hypothesis within 90 days.',
      '',
    ].join('\n'));
  }

  // Registry.
  if (!opts.no_registry) {
    const rooms = {};
    rooms[roomSlug] = { path: roomSlug, venture_name: roomSlug, status: 'active' };
    const reg = {
      version: 2,
      root: roomsRoot,
      active: opts.active == null ? roomSlug : opts.active,
      rooms: rooms,
    };
    writeFile(path.join(roomsRoot, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2));
  }

  return { roomsRoot: roomsRoot, roomPath: roomPath, roomSlug: roomSlug, sectionNames: sectionNames };
}

// ---------- Dispatcher module loader (mock-enabled) ----------
//
// Returns {dispatcher, audit}. Audit tracks every deriveSection call +
// every brain-client isAvailable() call. Mock is installed in
// require.cache BEFORE the dispatcher module is required so its top-
// level require() picks up the stubs.

function loadDispatcherWithMocks(opts) {
  opts = opts || {};
  const audit = {
    derive_calls: [],
    isAvailable_calls: 0,
  };

  // Mock brain-client.
  const bcPath = require.resolve('../core/brain-client.cjs');
  delete require.cache[bcPath];
  require.cache[bcPath] = {
    id: bcPath,
    filename: bcPath,
    loaded: true,
    exports: {
      isAvailable: function () {
        audit.isAvailable_calls += 1;
        if (typeof opts.isAvailableFn === 'function') {
          return opts.isAvailableFn(audit.isAvailable_calls);
        }
        return opts.isAvailable === undefined ? true : opts.isAvailable;
      },
      schema: async function () { return { brain_graph_version: 1 }; },
      query: async function () { return { records: [] }; },
      search: async function () { return { matches: [] }; },
    },
  };

  // Mock brain-derivation.cjs deriveSection.
  const bdPath = require.resolve('../core/brain-derivation.cjs');
  delete require.cache[bdPath];
  const realExports = opts.useRealBrainDerivation ? require('../core/brain-derivation.cjs') : {};
  require.cache[bdPath] = {
    id: bdPath,
    filename: bdPath,
    loaded: true,
    exports: Object.assign({}, realExports, {
      deriveSection: async function (roomPath, section, options) {
        const rec = { roomPath: roomPath, section: section, options: options || {} };
        audit.derive_calls.push(rec);
        if (typeof opts.deriveFn === 'function') {
          return opts.deriveFn(rec, audit.derive_calls.length);
        }
        return { success: true, brain_md_path: path.join(roomPath, section, 'BRAIN.md'), violations: [], cost_tokens: 540 };
      },
      SECTION_BUILDERS: realExports.SECTION_BUILDERS || [],
    }),
  };

  // Fresh require of dispatcher.
  const dispPath = require.resolve('../../scripts/brain-derive-command.cjs');
  delete require.cache[dispPath];
  const dispatcher = require('../../scripts/brain-derive-command.cjs');
  return { dispatcher: dispatcher, audit: audit };
}

function resetModuleCache() {
  for (const modPath of [
    require.resolve('../core/brain-client.cjs'),
    require.resolve('../core/brain-derivation.cjs'),
  ]) {
    delete require.cache[modPath];
  }
  try {
    const dispPath = require.resolve('../../scripts/brain-derive-command.cjs');
    delete require.cache[dispPath];
  } catch (_e) { /* file may not exist yet during early RED phase */ }
}

// ---------- Test runner ----------

let passed = 0;
let failed = 0;

async function runAsync(name, fn) {
  try {
    resetModuleCache();
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  }
}

// ---------- 12 tests ----------

async function main() {

  // Test 01: single section happy path.
  await runAsync('Test 01: single section happy path -> deriveSection called once; report lists 1 derived', async function () {
    const { roomsRoot, roomSlug } = buildFixtureRooms({ sections: 3 });
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const result = await dispatcher.dispatch({
      section: 'market-analysis',
      all: false,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 1, 'expected 1 deriveSection call');
    assert.equal(audit.derive_calls[0].section, 'market-analysis');
    assert.equal(result.summary.sections_derived, 1);
    assert.equal(result.summary.sections_requested, 1);
    assert.equal(result.exit_code, 0);
    // Shape E rendering contains required labels.
    const rendered = dispatcher.renderShapeE(result.summary);
    assert.ok(/Sections derived/.test(rendered), 'Shape E must contain "Sections derived" label');
    assert.ok(/market-analysis/.test(rendered), 'Shape E must contain section name');
  });

  // Test 02: --all with 3 active sections.
  await runAsync('Test 02: --all with 3 active sections -> deriveSection called 3x; report lists 3 derived', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 3 });
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 3, 'expected 3 deriveSection calls; got ' + audit.derive_calls.length);
    assert.equal(result.summary.sections_derived, 3);
    assert.equal(result.summary.sections_requested, 3);
    assert.equal(result.exit_code, 0);
    // Every derive call should have cross_room_scan !== true.
    for (const c of audit.derive_calls) {
      assert.notEqual(c.options.cross_room_scan, true, 'cross_room_scan must be false/undefined without --cross-room');
    }
  });

  // Test 03: --cross-room flag -> deriveSection called with options.cross_room_scan:true.
  await runAsync('Test 03: --cross-room -> deriveSection called with options.cross_room_scan:true', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 2 });
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const result = await dispatcher.dispatch({
      section: 'market-analysis',
      all: false,
      crossRoom: true,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 1);
    assert.equal(audit.derive_calls[0].options.cross_room_scan, true,
      'cross_room_scan must be true when --cross-room flag is set');
    assert.equal(result.summary.sections_derived, 1);
    assert.equal(result.summary.cross_room_enabled, true);
  });

  // Test 04: --dry-run -> zero deriveSection calls.
  await runAsync('Test 04: --dry-run -> zero deriveSection calls; zero writes; report shows estimated cost', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 3 });
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: true,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 0, 'dry-run must NOT invoke deriveSection');
    assert.equal(result.summary.dry_run, true);
    assert.ok(result.summary.cost_tokens_estimated > 0, 'dry-run must report an estimated cost');
    assert.equal(result.exit_code, 0);
    // Shape E should mark as dry-run.
    const rendered = dispatcher.renderShapeE(result.summary);
    assert.ok(/DRY[-\s]?RUN|dry[-\s]?run|dry run/i.test(rendered), 'Shape E must mark dry-run');
  });

  // Test 05: Brain offline from start -> 0 derived; single-line message.
  await runAsync('Test 05: Brain offline from start -> 0 sections derived; single-line message', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 3 });
    const { dispatcher, audit } = loadDispatcherWithMocks({ isAvailable: false });
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 0, 'Brain-offline must skip all deriveSection calls');
    assert.equal(result.summary.sections_derived, 0);
    assert.equal(result.summary.brain_offline_from_start, true);
    assert.equal(result.exit_code, 0, 'Brain offline is soft-fail exit 0, not error');
  });

  // Test 06: rate-limited mid-batch.
  await runAsync('Test 06: rate-limited mid-batch -> N derived, remainder skipped with reason rate_limited', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 7 });
    const { dispatcher, audit } = loadDispatcherWithMocks({
      deriveFn: function (rec, callIndex) {
        if (callIndex >= 3) {
          // Third call onwards returns rate_limited.
          return { success: false, reason: 'rate_limited', cost_tokens: 0, violations: [] };
        }
        return { success: true, brain_md_path: path.join(rec.roomPath, rec.section, 'BRAIN.md'), violations: [], cost_tokens: 540 };
      },
    });
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    // After rate_limited result on call 3, remaining calls should be skipped without invoking deriveSection.
    // Expected pattern: calls 1 and 2 derived, call 3 hits rate_limited, calls 4-7 skipped.
    assert.ok(audit.derive_calls.length <= 4,
      'after rate_limited, no more deriveSection should fire; got ' + audit.derive_calls.length + ' calls');
    assert.equal(result.summary.sections_derived, 2);
    assert.ok(result.summary.brain_offline_sections >= 4,
      'remaining 4+ sections must be categorized as brain_offline/rate_limited skip; got ' + result.summary.brain_offline_sections);
    assert.equal(result.summary.rate_limited, true);
  });

  // Test 07: invalid section name -> exit 1.
  await runAsync('Test 07: invalid section name -> exit 1 with error message', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 2 });
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const result = await dispatcher.dispatch({
      section: 'nonexistent-section-xyz',
      all: false,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 0);
    assert.equal(result.exit_code, 1);
    assert.ok(result.error_message, 'must produce an error message');
    assert.ok(/invalid|unknown|not found|does not exist/i.test(result.error_message),
      'error message should indicate invalid section: ' + result.error_message);
  });

  // Test 08: no active room -> exit 1.
  await runAsync('Test 08: no active room -> exit 1 with error message', async function () {
    // Build a tmp rooms root without a registry.
    const roomsRoot = makeTmpRoot('no-registry');
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 0);
    assert.equal(result.exit_code, 1);
    assert.ok(result.error_message);
    assert.ok(/no active room|no registry|switch/i.test(result.error_message),
      'error message should indicate missing active room: ' + result.error_message);
  });

  // Test 09: schema gate rejection on one section.
  await runAsync('Test 09: schema gate rejection on one section -> report lists failed; others still derived', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 3 });
    const { dispatcher, audit } = loadDispatcherWithMocks({
      deriveFn: function (rec, callIndex) {
        if (callIndex === 2) {
          return {
            success: false,
            reason: 'schema_rejected',
            violations: [{ category: 'schema', severity: 'error', message: 'author field missing' }],
            cost_tokens: 60,
          };
        }
        return { success: true, brain_md_path: path.join(rec.roomPath, rec.section, 'BRAIN.md'), violations: [], cost_tokens: 540 };
      },
    });
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    assert.equal(audit.derive_calls.length, 3, 'all 3 sections must still be attempted despite 1 schema failure');
    assert.equal(result.summary.sections_derived, 2);
    assert.equal(result.summary.schema_gate_failed, 1);
    assert.equal(result.exit_code, 0);
    // Rendered report should include the failed section.
    const rendered = dispatcher.renderShapeE(result.summary);
    assert.ok(/schema|failed/i.test(rendered), 'Shape E must surface schema gate failure');
  });

  // Test 10: 7-section --all with streaming progress.
  await runAsync('Test 10: 7-section --all with streaming progress -> stderr shows [1/7] through [7/7]', async function () {
    const { roomsRoot, roomPath } = buildFixtureRooms({ sections: 7 });
    // Write a minimal stub that invokes the dispatcher via CLI so we capture real stderr stream.
    // We invoke main() directly via spawnSync to capture stderr in-process style.
    const cliScript = [
      '"use strict";',
      // Mock brain-client.
      'const Module = require("module");',
      'const origResolve = Module._resolve_filename || Module._resolveFilename;',
      'const origLoad = Module._load;',
      'Module._load = function (request, parent, isMain) {',
      '  if (request.endsWith("brain-client.cjs") || request.indexOf("brain-client") !== -1 && request.indexOf("core") !== -1) {',
      '    return { isAvailable: function () { return true; }, schema: async function () { return { brain_graph_version: 1 }; }, query: async function () { return { records: [] }; }, search: async function () { return { matches: [] }; } };',
      '  }',
      '  if (request.endsWith("brain-derivation.cjs") && request.indexOf("prompts") === -1) {',
      '    return { deriveSection: async function (roomPath, section) { return { success: true, brain_md_path: roomPath + "/" + section + "/BRAIN.md", violations: [], cost_tokens: 540 }; }, SECTION_BUILDERS: [] };',
      '  }',
      '  return origLoad.apply(this, arguments);',
      '};',
      'process.env.MINDRIAN_ROOMS_ROOT = ' + JSON.stringify(roomsRoot) + ';',
      'process.argv = [process.argv[0], ' + JSON.stringify(DISPATCHER_PATH) + ', "--all"];',
      'require(' + JSON.stringify(DISPATCHER_PATH) + ').main();',
    ].join('\n');
    const tmpRunner = path.join(makeTmpRoot('runner'), 'run.js');
    writeFile(tmpRunner, cliScript);
    const res = spawnSync(process.execPath, [tmpRunner], { encoding: 'utf8' });
    const combined = (res.stdout || '') + '\n' + (res.stderr || '');
    // Expect per-section progress lines [N/7]. We tolerate [1/7] through [7/7] appearing on stderr.
    let progressHits = 0;
    for (let i = 1; i <= 7; i++) {
      if (combined.indexOf('[' + i + '/7]') !== -1) progressHits += 1;
    }
    assert.ok(progressHits >= 7,
      'expected 7 streaming progress lines [N/7]; found ' + progressHits + '\nOUTPUT:\n' + combined);
    // Shape E final report must also appear.
    assert.ok(/Sections derived/i.test(combined) || /BRAIN DERIVATION/i.test(combined),
      'final Shape E report must render after progress: ' + combined.slice(0, 500));
  });

  // Test 11: performance -- 3-section --all in under 15s with stubbed Brain.
  await runAsync('Test 11: 3-section --all performance budget < 15s stubbed', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 3 });
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const t0 = Date.now();
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    const dt = Date.now() - t0;
    assert.ok(dt < 15000, '3-section --all must complete in < 15s; took ' + dt + 'ms');
    assert.equal(result.summary.sections_derived, 3);
  });

  // Test 12: Shape E format assertion.
  await runAsync('Test 12: Shape E format contract -- counts + section list + action footer', async function () {
    const { roomsRoot } = buildFixtureRooms({ sections: 2 });
    const { dispatcher, audit } = loadDispatcherWithMocks({});
    const result = await dispatcher.dispatch({
      section: null,
      all: true,
      crossRoom: false,
      dryRun: false,
      _rooms_root_override: roomsRoot,
    });
    const rendered = dispatcher.renderShapeE(result.summary);
    // Required labels per plan interface spec.
    assert.ok(/BRAIN DERIVATION RESULTS/i.test(rendered), 'header');
    assert.ok(/Sections derived/i.test(rendered), 'sections count row');
    assert.ok(/Schema gates|schema/i.test(rendered), 'schema gates row');
    assert.ok(/Cross-room|cross[- ]?room/i.test(rendered), 'cross-room row');
    assert.ok(/Brain offline|offline/i.test(rendered), 'brain offline row');
    assert.ok(/Cost tokens|cost/i.test(rendered), 'cost tokens row');
    // PER SECTION block present and lists section names.
    assert.ok(/PER SECTION|per section/i.test(rendered), 'per-section block header');
    assert.ok(/market-analysis|problem-definition/.test(rendered), 'per-section lists known section');
    // NEXT action footer present.
    assert.ok(/NEXT|next/i.test(rendered), 'next/action footer block');
    // ZERO em-dashes anywhere in rendered output (Canon hard rule).
    assert.ok(rendered.indexOf('\u2014') === -1, 'Shape E must contain zero em-dashes');
    assert.equal(result.summary.sections_derived, 2);
  });

  // ---------- Summary ----------
  process.stdout.write('\n' + passed + '/' + (passed + failed) + ' passed\n');
  if (failed > 0) process.exit(1);
}

main().catch(function (err) {
  process.stderr.write('UNCAUGHT: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
