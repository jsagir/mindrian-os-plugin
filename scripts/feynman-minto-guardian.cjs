#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-13 -- Feynman-MINTO guardian
 * ======================================
 * The enforcer for the per-section triple lifecycle. Three checkpoints + a
 * cleanup mode:
 *
 *   session-start <roomPath>    walk sections, run all registered validators,
 *                               enqueue regens via minto-debouncer for any
 *                               critical violation, exit 0. Advisory.
 *
 *   on-stop <roomPath>          walk sections + run room-scoped validators
 *                               after the debouncer drain (88-06), aggregate
 *                               violations into .mindrian/invariant-report.json
 *                               atomically, consume stale_ghost warnings to
 *                               prune .mindrian/minto-stale.json. Exit 0.
 *                               Advisory. Phase 241-01: the section walk is
 *                               bounded by a soft wall-clock deadline
 *                               (MINDRIAN_GUARDIAN_ONSTOP_WALK_BUDGET_MS,
 *                               default 1200ms). A slow walk stops early
 *                               instead of taking down the report write and
 *                               the ghost prune with it - those two steps
 *                               always get their turn, and the report
 *                               records exactly how far the walk got
 *                               (sections_walked, sections_total, truncated).
 *
 *   pre-commit <roomPath>       run validators for every section whose
 *                               staged files live under it. Any critical or
 *                               error severity -> exit 2 (block commit);
 *                               otherwise exit 0. BLOCKING only here.
 *
 *   clean-tmp <roomPath>        sweep orphan MINTO.md.tmp.*.minto files
 *                               older than 60s (crashes from 88-04-B). Exit 0.
 *
 * Validator registry: validators are .cjs files in
 * lib/memory/validators/*.cjs. Each exports {id, severity_map, validate,
 * scope?}. See that directory's README.md for the contract. Malformed
 * modules are logged and skipped (fail-open). Missing required exports
 * -> skipped. id collisions -> first wins, warn + skip duplicate.
 *
 * Budget: 50-section fixtures run session-start under 2000ms with all 4
 * seed validators active (see lib/memory/feynman-minto-guardian.test.cjs
 * Test 9). The guardian is called in the 10s session-start budget with
 * plenty of slack.
 *
 * Three-surface: CJS + node built-ins + existing debouncer. Works on
 * Claude Code CLI, Claude Desktop MCP lifecycle, and Cowork shared state.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const VALIDATORS_DIR_DEFAULT = path.join(PLUGIN_ROOT, 'lib', 'memory', 'validators');
const DEBOUNCER_PATH = path.join(PLUGIN_ROOT, 'scripts', 'minto-debouncer.cjs');

const SEVERITY_ORDER = ['info', 'warning', 'error', 'critical'];
const CLEAN_TMP_MAX_AGE_MS = 60 * 1000;

// Phase 241-01 (F-1, MINTO-01): soft wall-clock deadline for runOnStop's
// section walk ONLY. The report write, the ghost prune, and the
// systemMessage emission run AFTER the walk in program order and must
// always be reached, even when the walk itself runs long (a slow
// validator, a large room). 1200ms leaves headroom under the 3000ms
// Stop-hook budget for the prune, the write, and process teardown.
// Env-var-override-with-NaN-floor-fallback idiom, mirrors
// ZERO_SCORE_GATE_MIN_TOKENS in scripts/intent-classifier.cjs:41-45.
const ONSTOP_WALK_BUDGET_MS = (function () {
  const n = parseInt(process.env.MINDRIAN_GUARDIAN_ONSTOP_WALK_BUDGET_MS, 10);
  if (Number.isNaN(n) || n < 1) return 1200;
  return n;
})();

// ---------------------------------------------------------------------------
// Logging helpers. All guardian non-fatal output goes to stderr so stdout
// can stay machine-parsable (future: JSON status line).
// ---------------------------------------------------------------------------

function logWarn(msg) {
  try { process.stderr.write('[guardian] warn: ' + msg + '\n'); } catch (_) {}
}

function logErr(msg) {
  try { process.stderr.write('[guardian] error: ' + msg + '\n'); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Validator registry
// ---------------------------------------------------------------------------

/**
 * Load every .cjs file in the validators directory in filename-sorted order.
 * Returns array of validator objects, each shape-checked and id-deduped.
 * Malformed modules (require throws, missing exports) are skipped with
 * stderr warnings -- fail-open.
 */
function loadValidators(validatorsDir) {
  const dir = validatorsDir || VALIDATORS_DIR_DEFAULT;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(function (d) { return d.isFile() && /\.cjs$/.test(d.name); })
      .map(function (d) { return d.name; })
      .sort();
  } catch (_) {
    return []; // No validators dir -> registry is empty. Guardian is fail-open.
  }
  const loaded = [];
  const seenIds = new Set();
  for (const fname of entries) {
    const fpath = path.join(dir, fname);
    let mod;
    try {
      // Delete require cache so repeated invocations inside one process
      // (tests especially) reload fresh.
      delete require.cache[require.resolve(fpath)];
      mod = require(fpath);
    } catch (e) {
      logWarn('skipping validator ' + fname + ': require-time error: ' +
        (e && e.message ? e.message : String(e)));
      continue;
    }
    if (!mod || typeof mod !== 'object') {
      logWarn('skipping validator ' + fname + ': module export is not an object');
      continue;
    }
    const missing = [];
    if (typeof mod.id !== 'string' || mod.id.length === 0) missing.push('id');
    if (typeof mod.validate !== 'function') missing.push('validate');
    if (!mod.severity_map || typeof mod.severity_map !== 'object') missing.push('severity_map');
    if (missing.length > 0) {
      logWarn('skipping validator ' + fname + ': missing required export(s): ' +
        missing.join(', '));
      continue;
    }
    if (seenIds.has(mod.id)) {
      logWarn('skipping validator ' + fname + ': id collision, "' + mod.id +
        '" already registered (alphabetically earlier file wins)');
      continue;
    }
    seenIds.add(mod.id);
    loaded.push({
      id: mod.id,
      severity_map: mod.severity_map,
      scope: mod.scope === 'room' ? 'room' : 'section',
      validate: mod.validate,
      _filename: fname,
    });
  }
  return loaded;
}

// ---------------------------------------------------------------------------
// Section discovery + per-section aggregation
// ---------------------------------------------------------------------------

function walkSections(roomDir) {
  try {
    return fs.readdirSync(roomDir, { withFileTypes: true })
      .filter(function (d) { return d.isDirectory() && d.name[0] !== '.'; })
      .filter(function (d) {
        try {
          return fs.existsSync(path.join(roomDir, d.name, 'ROOM.md'));
        } catch (_) { return false; }
      })
      .map(function (d) { return d.name; });
  } catch (_) {
    return [];
  }
}

function aggregateSeverity(violations) {
  let max = -1;
  for (const v of violations) {
    const i = SEVERITY_ORDER.indexOf(v.severity);
    if (i > max) max = i;
  }
  return max === -1 ? null : SEVERITY_ORDER[max];
}

/**
 * Run all SECTION-scoped validators on a single section.
 * Returns { severity, violations } where violations are tagged with
 * each validator's id (belt + suspenders alongside the validator's own
 * self-tagging).
 */
function validateSection(roomDir, section, validators, ctx) {
  const sectionDir = path.join(roomDir, section);
  const all = [];
  // Existence check. If MINTO.md missing, emit one synthetic existence
  // violation so the report captures the contract breach without depending
  // on any one validator. The minto-invariants validator otherwise returns
  // null for missing MINTO (by design -- it's a content validator).
  // Phase 241 F-2: critical is the level that reaches runSessionStart's
  // enqueue gate (result.severity === 'critical'); a missing MINTO.md was
  // previously stuck at 'error', one rung below that gate, so this breach
  // never enqueued a repair. See .planning/phases/241-feynman-minto/241-RESEARCH.md.
  if (!fs.existsSync(path.join(sectionDir, 'MINTO.md'))) {
    all.push({
      validator: 'existence-check',
      category: 'existence',
      severity: 'critical',
      message: 'MINTO.md missing in section "' + section + '"',
      section: section,
    });
  }
  for (const v of validators) {
    if (v.scope !== 'section') continue;
    let result;
    try {
      result = v.validate(sectionDir, ctx);
    } catch (e) {
      logWarn('validator "' + v.id + '" threw on section ' + section + ': ' +
        (e && e.message ? e.message : String(e)));
      continue;
    }
    if (!result || typeof result !== 'object') continue;
    const viols = Array.isArray(result.violations) ? result.violations : [];
    for (const viol of viols) {
      if (!viol || typeof viol !== 'object') continue;
      all.push(Object.assign({}, viol, { validator: viol.validator || v.id }));
    }
  }
  return { severity: aggregateSeverity(all), violations: all };
}

/**
 * Run every ROOM-scoped validator once. Returns array of violations, each
 * tagged with validator id and `scope` sentinel so the aggregator can route
 * them into the report's sections map under a synthetic `__room__` key.
 */
function validateRoomScope(roomDir, validators, ctx) {
  const all = [];
  for (const v of validators) {
    if (v.scope !== 'room') continue;
    let result;
    try {
      result = v.validate(roomDir, ctx);
    } catch (e) {
      logWarn('validator "' + v.id + '" threw on room: ' +
        (e && e.message ? e.message : String(e)));
      continue;
    }
    if (!result || typeof result !== 'object') continue;
    const viols = Array.isArray(result.violations) ? result.violations : [];
    for (const viol of viols) {
      if (!viol || typeof viol !== 'object') continue;
      all.push(Object.assign({}, viol, { validator: viol.validator || v.id }));
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

function writeJsonAtomic(targetPath, data) {
  const dir = path.dirname(targetPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  const tmp = targetPath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    try { const fd = fs.openSync(tmp, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd); } catch (_) {}
    fs.renameSync(tmp, targetPath);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function enqueueRegenSafe(roomDir, section, reason) {
  let dbnc;
  try { dbnc = require(DEBOUNCER_PATH); }
  catch (e) {
    logWarn('debouncer require failed; regen not enqueued: ' +
      (e && e.message ? e.message : String(e)));
    return;
  }
  try { dbnc.enqueue(roomDir, section, reason); }
  catch (e) {
    logWarn('debouncer.enqueue threw for "' + section + '": ' +
      (e && e.message ? e.message : String(e)));
  }
}

function runSessionStart(roomDir, validators) {
  const ctx = { roomDir: roomDir, kind: 'session-start', now: Date.now() };
  const sections = walkSections(roomDir);
  const report = { version: 1, kind: 'session-start', at: new Date().toISOString(), sections: {} };
  for (const s of sections) {
    const result = validateSection(roomDir, s, validators, ctx);
    let action = 'none';
    if (result.severity === 'critical') {
      enqueueRegenSafe(roomDir, s, 'guardian:critical-repair');
      action = 'enqueued_regen';
    }
    if (result.violations.length > 0) {
      report.sections[s] = {
        minto_path: path.join(roomDir, s, 'MINTO.md'),
        violations: result.violations,
        severity: result.severity,
        action_taken: action,
      };
    }
  }
  // Room-scoped validators (snapshot-integrity, queue-health, stale-lifecycle)
  const roomViols = validateRoomScope(roomDir, validators, ctx);
  if (roomViols.length > 0) {
    report.sections['__room__'] = {
      minto_path: null,
      violations: roomViols,
      severity: aggregateSeverity(roomViols),
      action_taken: 'none',
    };
  }
  // session-start does NOT write invariant-report by default (keep the
  // session start quick + quiet). Advisory never exits non-zero.
  return 0;
}

function pruneStaleGhosts(roomDir, ghostSections) {
  if (!Array.isArray(ghostSections) || ghostSections.length === 0) return 0;
  const stalePath = path.join(roomDir, '.mindrian', 'minto-stale.json');
  if (!fs.existsSync(stalePath)) return 0;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(stalePath, 'utf8'));
  } catch (_) {
    return 0;
  }
  const list = Array.isArray(parsed.sections) ? parsed.sections : [];
  const toRemove = new Set(ghostSections);
  const kept = list.filter(function (e) {
    return e && typeof e.section === 'string' && !toRemove.has(e.section);
  });
  if (kept.length === list.length) return 0;
  const pruned = list.length - kept.length;
  try {
    writeJsonAtomic(stalePath, {
      version: 1,
      at: new Date().toISOString(),
      sections: kept,
    });
    process.stderr.write('[guardian] pruned ' + pruned +
      ' ghost stale.json entr' + (pruned === 1 ? 'y' : 'ies') + '\n');
  } catch (e) {
    logWarn('failed to prune stale.json: ' + (e && e.message ? e.message : String(e)));
  }
  return pruned;
}

function runOnStop(roomDir, validators) {
  const ctx = { roomDir: roomDir, kind: 'on-stop', now: Date.now() };
  const sections = walkSections(roomDir);
  const report = { version: 1, kind: 'on-stop', at: new Date().toISOString(), sections: {} };
  // Phase 241-01: soft deadline bounds ONLY this walk. The prune, the
  // write, and the systemMessage emission below are NOT wrapped in their
  // own deadline check - they already run after this loop in program
  // order, and the soft deadline is what guarantees they are reached even
  // when the walk itself runs long.
  const walkDeadline = Date.now() + ONSTOP_WALK_BUDGET_MS;
  let walked = 0;
  for (const s of sections) {
    if (Date.now() > walkDeadline) break;
    const result = validateSection(roomDir, s, validators, ctx);
    walked += 1;
    if (result.violations.length > 0) {
      report.sections[s] = {
        minto_path: path.join(roomDir, s, 'MINTO.md'),
        violations: result.violations,
        severity: result.severity,
        action_taken: 'none',
      };
    }
  }
  // Unconditional so a full walk records truncated:false rather than
  // omitting the field - an absent field reads as "unknown", which is
  // the ambiguity this phase exists to remove.
  report.sections_walked = walked;
  report.sections_total = sections.length;
  report.truncated = walked < sections.length;
  // Room-scoped validators
  const roomViols = validateRoomScope(roomDir, validators, ctx);
  if (roomViols.length > 0) {
    report.sections['__room__'] = {
      minto_path: null,
      violations: roomViols,
      severity: aggregateSeverity(roomViols),
      action_taken: 'none',
    };
  }
  // Consume stale_ghost signals: gather sections flagged as ghosts and
  // atomically prune them from stale.json. Only on-stop mode does this;
  // session-start only SURFACES.
  const ghosts = [];
  for (const s of Object.keys(report.sections)) {
    const viols = report.sections[s].violations || [];
    for (const v of viols) {
      if (v && v.category === 'stale_ghost' && typeof v.section === 'string') {
        ghosts.push(v.section);
      }
    }
  }
  if (ghosts.length > 0) {
    const pruned = pruneStaleGhosts(roomDir, ghosts);
    // Attach prune action to the __room__ entry if we have one, else add.
    if (report.sections['__room__']) {
      report.sections['__room__'].action_taken = 'pruned_stale_ghosts';
      report.sections['__room__'].ghosts_pruned = pruned;
    }
  }
  // Write invariant-report.json atomically when there is anything to report,
  // OR when the walk was truncated (Phase 241-01: a truncated run must
  // leave evidence on disk instead of vanishing, even if it found zero
  // violations in the sections it managed to walk).
  if (Object.keys(report.sections).length > 0 || report.truncated) {
    const reportPath = path.join(roomDir, '.mindrian', 'invariant-report.json');
    try { writeJsonAtomic(reportPath, report); }
    catch (e) { logWarn('writing invariant-report failed: ' + (e && e.message || e)); }
  }
  // 88.1-03: systemMessage retrofit. Emit a one-line status to stdout
  // (wrapped in a JSON envelope) ONLY when the worst severity across any
  // section or room-scoped validator is >= error. Info- and warning-level
  // violations stay silent per reviewer R5 (avoid verification fatigue).
  // Canon Part 2 glyph: always 'low' when reporting violations (by
  // definition at error/critical). LOCAL-only (Canon Part 8): section names
  // only, no MINTO payload echoed.
  try {
    let worstIdx = -1;
    let worstSection = null;
    let worstCategory = null;
    let worstSeverity = null;
    // Phase 241-01 (T-241-01): accumulate honest counts alongside the
    // worst-case label, so a run that checked nothing (truncated) cannot
    // read like a run that found nothing.
    let violationCount = 0;
    const sectionCount = Object.keys(report.sections).length;
    for (const s of Object.keys(report.sections)) {
      const entry = report.sections[s];
      for (const v of (entry.violations || [])) {
        violationCount += 1;
        const idx = SEVERITY_ORDER.indexOf(v.severity);
        if (idx > worstIdx) {
          worstIdx = idx;
          worstSection = s;
          worstCategory = (v && v.category) || 'unknown';
          worstSeverity = v.severity;
        }
      }
    }
    if (worstIdx >= SEVERITY_ORDER.indexOf('error')) {
      const loc = worstSection === '__room__' ? 'room' : 'section ' + worstSection;
      let msg = 'guardian: ' + worstSeverity + ' in ' + loc + ' (' + worstCategory + ', glyph low)' +
        '; ' + violationCount + ' violation' + (violationCount === 1 ? '' : 's') +
        ' across ' + sectionCount + ' section' + (sectionCount === 1 ? '' : 's');
      if (report.truncated) {
        msg += '; walked ' + report.sections_walked + ' of ' + report.sections_total + ' sections';
      }
      // CORRECTED 2026-07-23 (stop-hook-invalid-hookspecificoutput-schema,
      // 2nd occurrence of this defect class): the prior comment here (removed)
      // claimed "wrap in hookSpecificOutput per Claude Code 2.x schema
      // (additionalProperties: false rejects top-level systemMessage)". That
      // claim was BACKWARDS and disproven by a live user-reported validation
      // error (2026-07-23): Claude Code's Stop-hook schema lists top-level
      // `systemMessage` as a valid optional field, and does NOT define a Stop
      // variant of hookSpecificOutput at all (the union covers only
      // PreToolUse, UserPromptSubmit, PostToolUse). Wrapping in
      // hookSpecificOutput is what made the validator reject the WHOLE
      // envelope ("Hook JSON output validation failed: - : Invalid input"),
      // exactly reproducing the failure this comment's own 2026-04-26
      // "fix" claimed to prevent. Emit systemMessage at the top level instead
      // -- this is the schema-correct shape, matching the original
      // v1.10.9->v1.10.10 fix in scripts/on-stop (2026-04-15). See
      // .planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md.
      const payload = { systemMessage: msg };
      process.stdout.write(JSON.stringify(payload) + '\n');
    }
  } catch (_e) { /* advisory: never break on-stop on sysmsg failure */ }
  return 0;
}

function getStagedFiles() {
  // Test hook: GUARDIAN_PRECOMMIT_STAGED is a newline- or comma-separated
  // list of staged paths relative to the repo root. Used by fixture tests
  // that do not want to initialize a git repo.
  const envStaged = process.env.GUARDIAN_PRECOMMIT_STAGED;
  if (envStaged) {
    return envStaged.split(/[\n,]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  try {
    const cp = require('node:child_process');
    const out = cp.execSync('git diff --cached --name-only', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    return out.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function runPreCommit(roomDir, validators) {
  const ctx = { roomDir: roomDir, kind: 'pre-commit', now: Date.now() };
  const staged = getStagedFiles();
  if (staged.length === 0) return 0;
  const sections = new Set();
  for (const rel of staged) {
    // Section = first path segment of the relative path under roomDir.
    // If the staged path is absolute and outside roomDir, skip.
    let normalized = rel;
    if (path.isAbsolute(rel)) {
      const rrel = path.relative(roomDir, rel);
      if (rrel.startsWith('..')) continue;
      normalized = rrel;
    }
    const parts = normalized.split(/[\/\\]/).filter(Boolean);
    if (parts.length === 0) continue;
    const section = parts[0];
    // Guard: only enforce inside a real section (must have ROOM.md).
    if (!fs.existsSync(path.join(roomDir, section, 'ROOM.md'))) continue;
    sections.add(section);
  }
  let worstSeverityIdx = -1;
  const messages = [];
  for (const s of sections) {
    const result = validateSection(roomDir, s, validators, ctx);
    for (const v of (result.violations || [])) {
      const idx = SEVERITY_ORDER.indexOf(v.severity);
      if (idx > worstSeverityIdx) worstSeverityIdx = idx;
      if (v.severity === 'critical' || v.severity === 'error') {
        messages.push('  [' + s + '] ' + v.severity + ': ' + (v.message || 'violation'));
      }
    }
  }
  if (worstSeverityIdx >= SEVERITY_ORDER.indexOf('error')) {
    process.stderr.write('[guardian] pre-commit blocked by Feynman-MINTO violations:\n');
    for (const m of messages) process.stderr.write(m + '\n');
    process.stderr.write('[guardian] Fix violations or use --no-verify (at your own risk).\n');
    return 2;
  }
  return 0;
}

function runCleanTmp(roomDir) {
  const sections = walkSections(roomDir);
  const now = Date.now();
  for (const s of sections) {
    const secDir = path.join(roomDir, s);
    let files;
    try { files = fs.readdirSync(secDir); } catch (_) { continue; }
    for (const f of files) {
      // Match MINTO.md.tmp.<pid>.minto (from 88-04-B crashes)
      if (!/^MINTO\.md\.tmp\.[^.]+\.minto$/.test(f)) continue;
      const full = path.join(secDir, f);
      let st;
      try { st = fs.statSync(full); } catch (_) { continue; }
      if (now - st.mtimeMs > CLEAN_TMP_MAX_AGE_MS) {
        try {
          fs.unlinkSync(full);
          process.stderr.write('[guardian] cleaned orphan tmp: ' + full + '\n');
        } catch (_) {}
      }
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const mode = process.argv[2] || 'session-start';
  const roomDir = process.argv[3];
  if (!roomDir) {
    process.stderr.write('usage: feynman-minto-guardian.cjs <mode> <roomPath>\n' +
      '  modes: session-start | on-stop | pre-commit | clean-tmp\n');
    return 0; // Advisory: never hard-fail even on bad invocation.
  }
  if (!fs.existsSync(roomDir)) {
    logWarn('roomPath does not exist: ' + roomDir);
    return 0;
  }
  const validatorsDir = process.env.GUARDIAN_VALIDATORS_DIR || VALIDATORS_DIR_DEFAULT;
  const validators = loadValidators(validatorsDir);

  try {
    switch (mode) {
      case 'session-start': return runSessionStart(roomDir, validators);
      case 'on-stop':       return runOnStop(roomDir, validators);
      case 'pre-commit':    return runPreCommit(roomDir, validators);
      case 'clean-tmp':     return runCleanTmp(roomDir);
      default:
        logWarn('unknown mode: ' + mode);
        return 0;
    }
  } catch (e) {
    // Advisory modes swallow errors; only pre-commit can propagate.
    if (mode === 'pre-commit') {
      logErr('pre-commit mode unexpected error: ' + (e && e.message || e));
      return 0; // Do NOT block a commit on a guardian bug; advisory bias.
    }
    logErr('mode "' + mode + '" threw: ' + (e && e.message || e));
    return 0;
  }
}

if (require.main === module) {
  const code = main();
  process.exit(typeof code === 'number' ? code : 0);
}

module.exports = {
  loadValidators: loadValidators,
  walkSections: walkSections,
  validateSection: validateSection,
  validateRoomScope: validateRoomScope,
  runSessionStart: runSessionStart,
  runOnStop: runOnStop,
  runPreCommit: runPreCommit,
  runCleanTmp: runCleanTmp,
};
