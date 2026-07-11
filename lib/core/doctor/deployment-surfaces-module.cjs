'use strict';
/*
 * lib/core/doctor/deployment-surfaces-module.cjs -- Phase 217 Plan 06 (D-01).
 *
 * The class-J "deployment-surfaces" doctor check + fix, migrated out of the
 * doctor CLI inline main() block into a registry-driven cadence:always runner.
 *
 * WHAT check() DOES (moved checkDeploymentSurfaces verbatim): reads
 * data/deployment-surfaces.json and reconciles each owned surface (marker /
 * exact-value / observed-only / self-excluded) against disk, honoring
 * topology_scope (dev-clone surfaces skip on a user box) and token expansion
 * ($HOME, <active_root>, <active_version>, <dev_clone_root>). DESKTOP/COWORK ->
 * skip (no owned surfaces; D-04 fallback).
 *
 * SAME-INVOCATION DEPENDENCY ON CLASS I (ctx.checks): class J needs topology +
 * active_root + active_version, which class I already computed THIS invocation.
 * check(ctx) derives its inputs in priority order:
 *   (a) ctx.checks['install-state'] -- the same-invocation class-I result the
 *       engine accumulates in registry array order (install-state precedes
 *       deployment-surfaces in data/doctor-modules.json, so this key is present
 *       on a normal run);
 *   (b) self-derivation fallback via ./shared.cjs -- resolveActivePluginRoot()
 *       for topology + activeRoot, readInstalledPluginsVersion(home) for
 *       activeVersion -- so class J still works standalone (an empty ctx.checks,
 *       exercised by the Task 1 smoke).
 *
 * WHAT fix() DOES (moved performClassJFix): re-stamps each ok:false
 * owner='session-start' surface (dispatch shim marker, settings.json
 * statusLine.command JSON-merge, ~/.mindrian-last-version, dev-clone pre-commit
 * hook) and runs the unconditional marketplace-cache prune. Returns
 * { status, detail, recoveries } with J's recovery-array semantics preserved;
 * the Plan 01 engine glue pushes each recoveries[] element onto report.recovered.
 *
 * STATUS VOCABULARY: the raw checkDeploymentSurfaces returns
 * 'healthy'|'warn'|'skipped'. The engine check(ctx) maps 'healthy' -> 'ok' and
 * 'skipped' -> 'skip' so report.checks['deployment-surfaces'] carries the
 * standard ok|warn|error|skip vocabulary. The raw checkDeploymentSurfaces is
 * re-exported for doctor.cjs --acceptance (which keys on the historical status).
 *
 * REGISTRY ORDER: deployment-surfaces MUST come AFTER install-state in
 * data/doctor-modules.json (see the ctx.checks dependency above). Both share the
 * --install-state flag (installState), exactly as the pre-migration main() block.
 *
 * Canon Part 8: pure LOCAL reads + LOCAL writes + a LOCAL cache prune; zero
 * network, zero Brain. Never back-requires the doctor CLI (Pitfall 4): requires
 * only node built-ins + ./shared.cjs (plus lib/core/cache-prune.cjs, a plain
 * sibling helper, for the fix() prune -- never a doctor module).
 *
 * Threat register (Phase 217 Plan 06): T-217-01 (self-DoS) -- the engine wraps
 * check + fix in try/catch; the dev-clone hook install spawn carries a bounded
 * timeout.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  HOME,
  PLUGIN_ROOT,
  resolveActivePluginRoot,
  readInstalledPluginsVersion,
} = require('./shared.cjs');

// -- Class J helpers (moved verbatim from scripts/doctor.cjs) --------------

function expandSurfacePath(p, ctx) {
  if (!p || typeof p !== 'string') return null;
  const home = ctx.home || HOME;
  const activeRoot = ctx.activeRoot || null;
  const topology = ctx.topology || 'not-found';
  let out = p.replace(/\$HOME/g, home);
  if (out.includes('<active_root>')) {
    if (!activeRoot) return null;
    out = out.replace(/<active_root>/g, activeRoot);
  }
  if (out.includes('<dev_clone_root>')) {
    if (topology !== 'dev-clone' || !activeRoot) return null;
    out = out.replace(/<dev_clone_root>/g, activeRoot);
  }
  return out;
}

function readJsonPath(obj, dotPath) {
  // Walk a dot-path like "statusLine.command" through `obj` and return the
  // value, or `undefined` on missing leg.
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = String(dotPath).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function substituteExpected(expected, activeVersion, home) {
  if (typeof expected !== 'string') return expected;
  if (expected === '<active_version>') return activeVersion || '';
  // Also expand the $HOME token inside the expected value -- the manifest
  // stores `bash "$HOME/.claude/statusline-mos"` and `session-start` writes
  // the expanded form (`bash "/home/user/.claude/statusline-mos"`); class J
  // must compare like-for-like.
  if (home && expected.includes('$HOME')) {
    return expected.replace(/\$HOME/g, home);
  }
  return expected;
}

// -- Class J check function (moved verbatim from scripts/doctor.cjs) --------

function checkDeploymentSurfaces(opts) {
  const o = opts || {};
  const home = o.home || HOME;
  const topology = o.topology || 'not-found';
  const activeRoot = o.activeRoot || null;
  const activeVersion = o.activeVersion || null;
  // Desktop / Cowork carve-out (mirrors class G).
  let surface = 'CLI';
  try {
    const mod = require(path.join(PLUGIN_ROOT, 'lib', 'statusline', 'surface-detect.cjs'));
    surface = mod.detectStatuslineSurface();
  } catch (_e) {
    if (process.env.CLAUDE_DESKTOP === '1') surface = 'DESKTOP';
    if (process.env.COWORK_SESSION_ID) surface = 'COWORK';
  }
  if (surface !== 'CLI') {
    return { status: 'skipped', reason: surface + ' install -- no owned surfaces (D-04 fallback applies)', surfaces: [] };
  }
  // Read the manifest.
  const manifestPath = path.join(PLUGIN_ROOT, 'data', 'deployment-surfaces.json');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (err) {
    return { status: 'warn', finding: 'deployment-surfaces.json unreadable: ' + err.message, surfaces: [], recoverable: false };
  }
  const out = [];
  for (const s of (manifest.surfaces || [])) {
    // topology_scope: dev-clone -> skip on user box.
    if (s.topology_scope === 'dev-clone' && topology !== 'dev-clone') {
      out.push({ id: s.id, status: 'skipped', reason: 'topology_scope=dev-clone, this is a ' + topology + ' box', ok: null, check_kind: s.check_kind, owner: s.owner });
      continue;
    }
    const fp = expandSurfacePath(s.path, { home, activeRoot, topology });
    if (!fp) {
      out.push({ id: s.id, status: 'skipped', reason: 'path tokens unresolvable (active_root or dev_clone_root not available)', ok: null, check_kind: s.check_kind, owner: s.owner });
      continue;
    }
    // reconcile: never -> observed-only by definition (the install-state record
    // self-entry). We mark it observed (excluded from its own check) per D-08.
    if (s.reconcile === 'never') {
      let observed = null;
      try {
        const stat = fs.statSync(fp);
        observed = stat.isFile() ? 'self-excluded' : (stat.isDirectory() ? 'self-excluded-dir' : 'present');
      } catch (_) { observed = 'absent'; }
      out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: s.expected, observed, ok: null, owner: s.owner, remediation: s.remediation });
      continue;
    }
    let observed = null, ok = null, finding = null;
    if (s.check_kind === 'marker') {
      let content;
      try { content = fs.readFileSync(fp, 'utf8'); }
      catch (_) {
        out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: s.expected, observed: 'absent', ok: false, finding: 'surface ' + s.id + ': ' + fp + ' unreadable / missing', owner: s.owner, remediation: s.remediation });
        continue;
      }
      ok = String(content).includes(String(s.expected));
      observed = ok ? s.expected : null;
      if (!ok) finding = 'surface ' + s.id + ": marker '" + s.expected + "' missing from " + fp;
    } else if (s.check_kind === 'exact-value') {
      const expSubstituted = substituteExpected(s.expected, activeVersion, home);
      let content;
      try { content = fs.readFileSync(fp, 'utf8'); }
      catch (_) {
        out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: expSubstituted, observed: 'absent', ok: false, finding: 'surface ' + s.id + ': ' + fp + ' unreadable / missing', owner: s.owner, remediation: s.remediation });
        continue;
      }
      // Schema extension (Plan-03): path_within_file = a dot-path into a JSON
      // file (e.g. "statusLine.command"). If present, parse + extract.
      if (s.path_within_file) {
        let parsed = null;
        try { parsed = JSON.parse(content); }
        catch (err) {
          out.push({ id: s.id, path: fp, check_kind: s.check_kind, expected: expSubstituted, observed: 'parse-error', ok: false, finding: 'surface ' + s.id + ': ' + fp + ' JSON parse failed: ' + err.message, owner: s.owner, remediation: s.remediation, path_within_file: s.path_within_file });
          continue;
        }
        const val = readJsonPath(parsed, s.path_within_file);
        observed = val == null ? null : String(val);
        ok = observed != null && observed === expSubstituted;
        if (!ok) finding = 'surface ' + s.id + ': value at ' + s.path_within_file + ' = ' + JSON.stringify(observed) + ', expected ' + JSON.stringify(expSubstituted);
      } else {
        // Default: substring match against the whole file content.
        const trimmed = String(content).trim();
        observed = trimmed.length > 200 ? trimmed.slice(0, 200) + '...' : trimmed;
        ok = String(content).includes(expSubstituted);
        if (!ok) finding = 'surface ' + s.id + ': expected ' + JSON.stringify(expSubstituted) + ' not present in ' + fp;
      }
    } else {
      // observed-only -> record presence/value, never ok=false.
      try {
        const stat = fs.statSync(fp);
        observed = stat.isDirectory() ? 'present' : 'present';
      } catch (_) { observed = 'absent'; }
      ok = null;
    }
    out.push(Object.assign({
      id: s.id, path: fp, check_kind: s.check_kind, expected: s.expected,
      observed, ok, owner: s.owner, remediation: s.remediation,
    }, s.path_within_file ? { path_within_file: s.path_within_file } : {}, finding ? { finding } : {}));
  }
  const drift = out.some(x => x.ok === false);
  const status = drift ? 'warn' : 'healthy';
  // Recoverable iff some owner='session-start' surface is ok:false.
  const recoverable = out.some(x => x.ok === false && x.owner === 'session-start');
  return { status, surfaces: out, recoverable };
}

// -- Class J --fix (moved verbatim from scripts/doctor.cjs) ----------------

function performClassJFix(check, opts) {
  const o = opts || {};
  const home = o.home || HOME;
  const activeVersion = o.activeVersion || null;
  const recoveries = [];
  if (!check || !check.surfaces) return recoveries;
  // The session-start path re-stamps everything owned. But in the hermetic
  // test envelope we cannot rely on session-start hitting every surface
  // exactly. Walk each ok:false owner='session-start' surface and re-stamp
  // it directly. Idempotent.
  for (const s of check.surfaces) {
    if (s.ok !== false) continue;
    if (s.owner !== 'session-start') continue;
    try {
      if (s.id === 'statusline-dispatch-shim') {
        // Re-stamp the dispatcher shim with the marker. Mirror Plan-02
        // session-start Step A's shim content (minimal -- the dispatcher
        // logic is in scripts/statusline-mos-dispatch).
        const dispatcherSrc = path.join(PLUGIN_ROOT, 'scripts', 'statusline-mos-dispatch');
        let content;
        if (fs.existsSync(dispatcherSrc)) {
          content = fs.readFileSync(dispatcherSrc, 'utf8');
          if (!content.includes('MINDRIAN-STATUSLINE-DISPATCH')) {
            // Belt-and-suspenders: prepend the marker if the dispatcher src
            // somehow lost it.
            content = '#!/usr/bin/env bash\n# MINDRIAN-STATUSLINE-DISPATCH\n' + content;
          }
        } else {
          content = '#!/usr/bin/env bash\n# MINDRIAN-STATUSLINE-DISPATCH\n# (auto-stamped by /mos:doctor --fix)\n';
        }
        fs.mkdirSync(path.dirname(s.path), { recursive: true });
        fs.writeFileSync(s.path, content);
        try { fs.chmodSync(s.path, 0o755); } catch (_) { /* ignore on Windows */ }
        recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 're-stamp', ok: true, target: s.path });
        continue;
      }
      if (s.id === 'settings-statusline-command') {
        // The path is the JSON settings.json file; we must JSON-merge so we
        // don't clobber unrelated keys.
        let obj = {};
        if (fs.existsSync(s.path)) {
          try { obj = JSON.parse(fs.readFileSync(s.path, 'utf8')); } catch (_) { obj = {}; }
        }
        if (!obj || typeof obj !== 'object') obj = {};
        const want = 'bash "' + path.join(home, '.claude', 'statusline-mos') + '"';
        obj.statusLine = obj.statusLine || {};
        obj.statusLine.type = 'command';
        obj.statusLine.command = want;
        fs.mkdirSync(path.dirname(s.path), { recursive: true });
        fs.writeFileSync(s.path, JSON.stringify(obj, null, 2));
        recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'rewrite', ok: true, target: s.path, target_value: want });
        continue;
      }
      if (s.id === 'mindrian-last-version') {
        if (!activeVersion) {
          recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'skipped', detail: 'no active_version available' });
          continue;
        }
        fs.writeFileSync(s.path, String(activeVersion) + '\n');
        recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'rewrite', ok: true, target: s.path, target_value: activeVersion });
        continue;
      }
      if (s.id === 'dev-clone-pre-commit-hook') {
        // Idempotently install the dev-clone pre-commit hook.
        const cp = require('child_process');
        const installer = path.join(PLUGIN_ROOT, 'scripts', 'install-pre-commit.sh');
        if (fs.existsSync(installer)) {
          // The installer uses `git rev-parse --show-toplevel`; we run it
          // from the dev-clone root (s.path is .git/hooks/pre-commit, so
          // the repo root is two levels up from that file).
          const repoRoot = path.resolve(path.dirname(s.path), '..', '..');
          const r = cp.spawnSync('bash', [installer], { cwd: repoRoot, encoding: 'utf8', timeout: 5000 });
          recoveries.push({
            class: 'deployment-surfaces', surface: s.id, action: 'install',
            ok: r.status === 0, exit_code: typeof r.status === 'number' ? r.status : -1,
          });
        } else {
          recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'skipped', detail: 'install-pre-commit.sh not found' });
        }
        continue;
      }
      // Default: skip unknown owned surfaces (forward-compat).
      recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'skipped', detail: 'unknown surface id' });
    } catch (err) {
      recoveries.push({ class: 'deployment-surfaces', surface: s.id, action: 'error', detail: err.message });
    }
  }
  // Plan-5 (HARNESS-123-13): unconditional cache prune. Doctor --fix runs the
  // prune every time, regardless of version change -- this is recovery (the
  // operator asked for it), not an automatic post-update tidy.
  try {
    const { pruneMarketplaceCache } = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'cache-prune.cjs'));
    const r = pruneMarketplaceCache({ home });
    if (r.skipped) {
      recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'skipped', reason: r.reason, ok: null });
    } else if (r.removed.length > 0) {
      for (const dir of r.removed) {
        recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'removed', dir, ok: true });
      }
    } else {
      recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'no-op', kept: r.kept, ok: true });
    }
  } catch (e) {
    recoveries.push({ class: 'deployment-surfaces', surface: 'cache-prune', action: 'errored', error: e.message, ok: false });
  }
  return recoveries;
}

// -- Same-invocation input derivation (ctx.checks -> self-derive fallback) --

function deriveInputs(ctx) {
  const c = ctx || {};
  const home = c.home || HOME;
  let topology = 'not-found';
  let activeRoot = null;
  let activeVersion = null;
  // (a) same-invocation class-I result.
  const iState = c.checks && c.checks['install-state'];
  if (iState) {
    if (iState.topology) topology = iState.topology;
    activeRoot = (iState.record && iState.record.active_root)
      || (iState.resolver && iState.resolver.root)
      || null;
    activeVersion = (iState.record && iState.record.active_version) || null;
  }
  // (b) self-derivation fallback (empty ctx.checks or missing legs).
  if (!activeRoot || topology === 'not-found') {
    try {
      const r = resolveActivePluginRoot();
      if (topology === 'not-found' && r && r.topology) topology = r.topology;
      if (!activeRoot && r && r.root) activeRoot = r.root;
    } catch (_) { /* degrade to not-found / null */ }
  }
  if (!activeVersion) {
    try { activeVersion = readInstalledPluginsVersion(home); } catch (_) { activeVersion = null; }
  }
  return { home, topology, activeRoot, activeVersion };
}

// -- Engine entry points (Phase 217 Plan 06) -------------------------------

// check(ctx): the accumulative-engine cadence:always entry. Reads class I's
// same-invocation result from ctx.checks (self-derives when absent), then runs
// the raw checkDeploymentSurfaces and maps its historical status
// ('healthy'|'warn'|'skipped') into the ok|warn|error|skip vocabulary.
function check(ctx) {
  const { home, topology, activeRoot, activeVersion } = deriveInputs(ctx);
  const raw = checkDeploymentSurfaces({ home, topology, activeRoot, activeVersion });
  let status = raw.status;
  if (status === 'healthy') status = 'ok';
  else if (status === 'skipped') status = 'skip';
  const failed = Array.isArray(raw.surfaces)
    ? raw.surfaces.filter((s) => s.ok === false).length
    : 0;
  const detail = raw.reason || raw.finding
    || (Array.isArray(raw.surfaces)
      ? (failed > 0
        ? failed + ' deployment surface(s) drifted of ' + raw.surfaces.length + ' checked'
        : 'all ' + raw.surfaces.length + ' deployment surface(s) reconciled')
      : 'deployment-surfaces evaluated');
  return Object.assign({}, raw, { status, detail });
}

// fix(ctx): the accumulative-engine fix-then-recheck entry. Invoked with
// ctx.check_result (the check() result carrying surfaces[]). Returns
// { status, detail, recoveries } with J's recovery-array semantics preserved.
function fix(ctx) {
  const c = ctx || {};
  const checkResult = c.check_result || check(c);
  const { home, activeVersion } = deriveInputs(c);
  const recoveries = performClassJFix(checkResult, { home, activeVersion });
  const anyFailed = recoveries.some((rec) => rec && rec.ok === false);
  return {
    status: anyFailed ? 'warn' : 'ok',
    detail: 'deployment-surfaces fix: ' + recoveries.length + ' recovery record(s)'
      + (anyFailed ? ' (one or more failed)' : ''),
    recoveries,
  };
}

module.exports = {
  check,
  fix,
  // raw entry re-exported for scripts/doctor.cjs --acceptance
  // (buildAcceptanceChecklist keys on the historical 'healthy'/'skipped'
  // status) and for hermetic unit reuse. Never a duplicate body in doctor.cjs.
  checkDeploymentSurfaces,
  performClassJFix,
};
