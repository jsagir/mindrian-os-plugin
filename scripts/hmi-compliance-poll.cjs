#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 105-01 -- HMI Compliance Polling primitive
 * ================================================
 * Passive polling layer that scans command surfaces for UI Ruling System
 * (skills/ui-system/SKILL.md) drift, layered with operator (Phase 99) and
 * JTBD (Phase 100) context.
 *
 * Reuses Phase 95.1 /mos:doctor --ui-compliance --json detector machinery.
 * Net-new logic: operator-aware shape selector (D-03) + JTBD-aware priority
 * weighting (D-04) + side-channel writer at <roomDir>/.mindrian/last-hmi-poll.json.
 *
 * CLI:  node scripts/hmi-compliance-poll.cjs [--once] [--json] [--scan-commands=<dir>] [--scan-scripts=<dir>]
 *
 * Module export:
 *   { pollOnce, OPERATOR_EXPECTED_SHAPES, _internal: { resolveActiveRoom, ... } }
 *
 * Latency budget: < 250ms warm.
 * Active-room guard: no registry / no active_room / sealed -> exit 0 silent.
 * Tier 0: short-circuit to {status:'tier-0-skip'}; never shells doctor.cjs.
 * Defensive: NEVER throws upward. NEVER blocks. Always exit 0.
 *
 * Canon Part 8: zero Brain queries. Reads only doctor.cjs JSON + Phase 99 +
 * Phase 100 + Phase 101 LOCAL state + LOCAL static taxonomy.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const DOCTOR_CJS = path.join(PLUGIN_ROOT, 'scripts', 'doctor.cjs');
const TAXONOMY_PATH = path.join(PLUGIN_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');

// Safe-require: a missing substrate lib MUST NOT crash; we degrade.
let _operator, _jtbdState, _tierCheck, _taxonomy;
try { _operator = require(path.join(PLUGIN_ROOT, 'lib', 'conversation', 'operator.cjs')); } catch (_) { _operator = null; }
try { _jtbdState = require(path.join(PLUGIN_ROOT, 'lib', 'hmi', 'jtbd-state.cjs')); } catch (_) { _jtbdState = null; }
try { _tierCheck = require(path.join(PLUGIN_ROOT, 'lib', 'hmi', 'tier-check.cjs')); } catch (_) { _tierCheck = null; }
try { _taxonomy = require(TAXONOMY_PATH); } catch (_) { _taxonomy = null; }

// Operator -> expected body_shape family (D-03 mapping).
const OPERATOR_EXPECTED_SHAPES = Object.freeze({
  JUST_TALK:       ['A', 'B'],
  EXPLORE_CAPTURE: ['A', 'B', 'E'],
  BUILD_ROOM:      ['E'],
  METHODOLOGY:     ['E'],
  DECISION_GATE:   ['F', 'E'],
});

// ----- helpers -----

function resolveActiveRoom() {
  const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (_) { return null; }
  if (!reg || !reg.active_room || !Array.isArray(reg.rooms)) return null;
  const room = reg.rooms.find(function (r) { return r && r.slug === reg.active_room; });
  if (!room || !room.abs_path) return null;
  if (!fs.existsSync(room.abs_path)) return null;
  if (room.sealed === true) return null;
  return { slug: room.slug, abs_path: room.abs_path };
}

function expectedShapeFamily(operator) {
  return OPERATOR_EXPECTED_SHAPES[operator] || OPERATOR_EXPECTED_SHAPES.JUST_TALK;
}

function extractBodyShapeLetter(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch (_) { return null; }
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/m);
  if (!m) return null;
  const fm = m[1];
  const fmm = fm.match(/^body_shape:\s*(.+)$/m);
  if (!fmm) return null;
  const v = fmm[1].trim();
  // First non-whitespace, non-quote ALPHA character (uppercase preferred).
  const lm = v.match(/[A-Z]/);
  return lm ? lm[0] : null;
}

function shellDoctor(opts) {
  const args = ['--ui-compliance', '--json'];
  if (opts && opts.scanCommandsDir) args.push('--scan-commands=' + opts.scanCommandsDir);
  if (opts && opts.scanScriptsDir)  args.push('--scan-scripts=' + opts.scanScriptsDir);
  const r = spawnSync('node', [DOCTOR_CJS].concat(args), {
    encoding: 'utf8',
    timeout: (opts && typeof opts.doctorTimeout === 'number') ? opts.doctorTimeout : 5000,
    env: process.env,
  });
  if (r.error || r.status !== 0) {
    const errMsg = (r.stderr && r.stderr.length > 0)
      ? r.stderr
      : ((r.error && r.error.message) ? r.error.message : 'spawn failed');
    return { ok: false, error: String(errMsg).slice(0, 200) };
  }
  let parsed;
  try { parsed = JSON.parse(r.stdout); } catch (e) {
    return { ok: false, error: 'doctor JSON parse failed: ' + (e.message || 'unknown').slice(0, 100) };
  }
  if (!parsed || !parsed.checks || !parsed.checks['ui-compliance']) {
    return { ok: false, error: "doctor JSON missing checks['ui-compliance']" };
  }
  return { ok: true, data: parsed.checks['ui-compliance'] };
}

function commandBasename(filePath) {
  // 'commands/find-bottlenecks.md' -> 'find-bottlenecks'
  if (typeof filePath !== 'string') return '';
  const base = path.basename(filePath, '.md');
  return base.toLowerCase();
}

function weightViolation(violation, currentJtbd, taxonomy) {
  const baseWeight = (currentJtbd === null || currentJtbd === undefined || !taxonomy) ? 0.5 : 0.3;
  const out = Object.assign({}, violation, { weight: baseWeight, matched_jtbd: null, via: null });
  if (!currentJtbd || !taxonomy || !Array.isArray(taxonomy.entries)) return out;
  const entry = taxonomy.entries.find(function (e) { return e && e.id === currentJtbd; });
  if (!entry || !Array.isArray(entry.methodology_hooks)) return out;
  const basename = commandBasename(violation.file);
  if (!basename) return out;
  const matched = entry.methodology_hooks.some(function (hook) {
    return typeof hook === 'string' && hook.toLowerCase().indexOf(basename) >= 0;
  });
  if (matched) {
    out.weight = 1.0;
    out.matched_jtbd = currentJtbd;
    out.via = 'methodology_hooks';
  }
  return out;
}

function computePriorities(violations, currentJtbd, taxonomy) {
  if (!Array.isArray(violations)) return [];
  const weighted = violations.map(function (v) { return weightViolation(v, currentJtbd, taxonomy); });
  weighted.sort(function (a, b) {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return String(a.file || '').localeCompare(String(b.file || ''));
  });
  return weighted.slice(0, 5);
}

function computeOperatorShapeMismatches(violations, operator, repoRoot, scanCommandsDir) {
  const expected = expectedShapeFamily(operator);
  const expectedSet = new Set(expected);
  const out = [];
  const seenFiles = new Set();

  // Strategy 1 (preferred): when scanCommandsDir is provided, walk it directly.
  // This is the hermetic-test path AND the production path when the doctor
  // scan ran against an override directory; doctor's relative-path output may
  // not start with 'commands/' for scratch fixtures, so we go to the source.
  // Strategy 2 (fallback): when no scanCommandsDir is given, derive the file
  // list from doctor.violations[] (de-duped). Either path inspects each
  // command-md file's frontmatter body_shape and records mismatches.
  let fileList = [];
  if (scanCommandsDir && fs.existsSync(scanCommandsDir)) {
    let entries;
    try {
      entries = fs.readdirSync(scanCommandsDir).filter(function (f) {
        return /\.md$/i.test(f);
      });
    } catch (_) { entries = []; }
    for (const f of entries) {
      const abs = path.join(scanCommandsDir, f);
      const rel = path.relative(repoRoot, abs);
      fileList.push({ file: rel, abs: abs });
    }
  } else if (Array.isArray(violations)) {
    for (const v of violations) {
      if (!v || typeof v.file !== 'string') continue;
      if (seenFiles.has(v.file)) continue;
      seenFiles.add(v.file);
      if (!/\.md$/i.test(v.file)) continue;
      const abs = path.isAbsolute(v.file) ? v.file : path.join(repoRoot, v.file);
      fileList.push({ file: v.file, abs: abs });
    }
  }

  for (const item of fileList) {
    const letter = extractBodyShapeLetter(item.abs);
    if (letter && !expectedSet.has(letter)) {
      out.push({
        file: item.file,
        declared: letter,
        expected_family: expected.slice(),
        operator: operator,
      });
    }
  }
  return out;
}

function atomicWriteSideChannel(roomDir, envelope) {
  const dir = path.join(roomDir, '.mindrian');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const finalPath = path.join(dir, 'last-hmi-poll.json');
    const rand = crypto.randomBytes(6).toString('hex');
    const tmpPath = path.join(dir, '.last-hmi-poll.json.' + rand);
    fs.writeFileSync(tmpPath, JSON.stringify(envelope, null, 2), 'utf8');
    fs.renameSync(tmpPath, finalPath);
    return true;
  } catch (e) {
    process.stderr.write('[hmi-poll] side-channel write error: ' + String(e.message || 'unknown').slice(0, 120) + '\n');
    return false;
  }
}

function makeProvenance() {
  return {
    phase: '105-01',
    doctor_version: 'scripts/doctor.cjs --ui-compliance --json',
    skill_ref: 'skills/ui-system/SKILL.md',
  };
}

// ----- main entry point -----

function pollOnce(opts) {
  opts = opts || {};
  const startMs = Date.now();

  const room = resolveActiveRoom();
  if (!room) {
    return {
      status: 'no-active-room',
      reason: 'tier-0-graceful',
      polled_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startMs,
    };
  }

  const tier = (_tierCheck && typeof _tierCheck.getTier === 'function') ? _tierCheck.getTier() : 1;
  const mode = (_tierCheck && typeof _tierCheck.modeForTier === 'function') ? _tierCheck.modeForTier(tier) : 'B';

  if (tier === 0) {
    const env0 = {
      schema_version: 1,
      status: 'tier-0-skip',
      polled_at: new Date().toISOString(),
      tier: 0,
      mode: '0',
      elapsed_ms: Date.now() - startMs,
      _provenance: makeProvenance(),
    };
    atomicWriteSideChannel(room.abs_path, env0);
    return env0;
  }

  const operatorState = (_operator && typeof _operator.getCurrent === 'function')
    ? _operator.getCurrent(room.abs_path)
    : { current: 'JUST_TALK' };
  const operator = (operatorState && operatorState.current) || 'JUST_TALK';

  const jtbdState = (_jtbdState && typeof _jtbdState.getCurrent === 'function')
    ? _jtbdState.getCurrent(room.abs_path)
    : null;
  const currentJtbd = (jtbdState && typeof jtbdState.jtbd === 'string') ? jtbdState.jtbd : null;

  const doctor = shellDoctor({
    scanCommandsDir: opts.scanCommandsDir,
    scanScriptsDir:  opts.scanScriptsDir,
    doctorTimeout:   opts.doctorTimeout,
  });

  if (!doctor.ok) {
    const envErr = {
      schema_version: 1,
      status: 'doctor-error',
      polled_at: new Date().toISOString(),
      operator: operator,
      jtbd: currentJtbd,
      tier: tier,
      mode: mode,
      error: doctor.error,
      elapsed_ms: Date.now() - startMs,
      _provenance: makeProvenance(),
    };
    atomicWriteSideChannel(room.abs_path, envErr);
    return envErr;
  }

  const uiCompliance = doctor.data;
  const violations = Array.isArray(uiCompliance.violations) ? uiCompliance.violations : [];

  const operatorShapeMismatches = computeOperatorShapeMismatches(violations, operator, PLUGIN_ROOT, opts.scanCommandsDir);
  const priorities = computePriorities(violations, currentJtbd, _taxonomy);

  const envelope = {
    schema_version: 1,
    status: 'ok',
    polled_at: new Date().toISOString(),
    operator: operator,
    jtbd: currentJtbd,
    tier: tier,
    mode: mode,
    doctor: {
      status: uiCompliance.status,
      totalViolations: violations.length,
      counts: uiCompliance.counts || {},
    },
    operator_shape_mismatches: operatorShapeMismatches,
    priorities: priorities,
    elapsed_ms: Date.now() - startMs,
    _provenance: makeProvenance(),
  };
  atomicWriteSideChannel(room.abs_path, envelope);
  return envelope;
}

// ----- CLI -----

function parseArgs(argv) {
  const out = { once: true, json: false, hook: false, scanCommandsDir: null, scanScriptsDir: null };
  for (const a of argv) {
    if (a === '--once') out.once = true;
    else if (a === '--json') out.json = true;
    else if (a === '--hook') out.hook = true;
    else if (a.indexOf('--scan-commands=') === 0) out.scanCommandsDir = a.slice('--scan-commands='.length);
    else if (a.indexOf('--scan-scripts=') === 0) out.scanScriptsDir = a.slice('--scan-scripts='.length);
  }
  return out;
}

// ----- Hook wrapper (Phase 105-03) -----
// BASH-95-01 envelope schema: top-level keys subset of
//   { decision, reason, continue, stopReason, suppressOutput,
//     systemMessage, hookSpecificOutput }
// additionalContext lives ONLY inside hookSpecificOutput.
// This hook fires on Stop, runs pollOnce() in a defensive try/catch,
// and ALWAYS exits 0 emitting { continue: true, suppressOutput: true }.
// It NEVER blocks the user's turn (D-01 invariant from 105-CONTEXT).
const HOOK_ALLOWED_KEYS = new Set([
  'decision',
  'reason',
  'continue',
  'stopReason',
  'suppressOutput',
  'systemMessage',
  'hookSpecificOutput',
]);

function emitHookEnvelope(obj) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (HOOK_ALLOWED_KEYS.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}

function silentHookSuccess() {
  emitHookEnvelope({ continue: true, suppressOutput: true });
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
}

function hookMain() {
  // Read BASH-95-01 envelope from stdin.
  const env = readStdinJson();
  const evt = env.hook_event_name || env.hookEventName || process.env.HOOK_EVENT_NAME || null;

  // Only Stop fires the poll. All other events: silent success (no work done).
  // Defensive: if event is missing entirely (malformed stdin), silent success.
  if (evt !== 'Stop') return silentHookSuccess();

  // Fire the poll. Wrapped in try/catch so any failure is swallowed and the
  // hook chain is NEVER blocked (D-01).
  try {
    pollOnce({});
  } catch (e) {
    process.stderr.write('[hmi-poll-hook] pollOnce error: '
      + String((e && e.message) || 'unknown').slice(0, 200) + '\n');
  }

  return silentHookSuccess();
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Hook mode: read stdin, route by event, write BASH-95-01 envelope.
  if (args.hook) {
    return hookMain();
  }

  // CLI mode: legacy --once / --json behavior preserved byte-identically.
  const result = pollOnce({
    scanCommandsDir: args.scanCommandsDir,
    scanScriptsDir:  args.scanScriptsDir,
  });
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
  process.exit(0);
}

if (require.main === module) {
  try { main(); }
  catch (e) {
    process.stderr.write('[hmi-poll] uncaught: ' + String(e.message || 'unknown').slice(0, 200) + '\n');
    // In hook mode the catch above already exited; this is the CLI-mode net.
    process.exit(0);
  }
}

module.exports = {
  pollOnce: pollOnce,
  OPERATOR_EXPECTED_SHAPES: OPERATOR_EXPECTED_SHAPES,
  _internal: {
    resolveActiveRoom: resolveActiveRoom,
    expectedShapeFamily: expectedShapeFamily,
    extractBodyShapeLetter: extractBodyShapeLetter,
    shellDoctor: shellDoctor,
    weightViolation: weightViolation,
    computePriorities: computePriorities,
    computeOperatorShapeMismatches: computeOperatorShapeMismatches,
    atomicWriteSideChannel: atomicWriteSideChannel,
    makeProvenance: makeProvenance,
    parseArgs: parseArgs,
    HOOK_ALLOWED_KEYS: HOOK_ALLOWED_KEYS,
    emitHookEnvelope: emitHookEnvelope,
    silentHookSuccess: silentHookSuccess,
    readStdinJson: readStdinJson,
    hookMain: hookMain,
  },
};
