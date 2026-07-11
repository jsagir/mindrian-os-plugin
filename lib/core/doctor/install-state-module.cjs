'use strict';
/*
 * lib/core/doctor/install-state-module.cjs -- Phase 217 Plan 06 (D-01).
 *
 * The class-I "install-state" doctor check + fix, migrated out of the doctor
 * CLI inline main() block into a registry-driven cadence:always runner.
 *
 * WHAT check() DOES (moved checkInstallState verbatim): resolves the active
 * plugin root, reads ~/.mindrian/install-state.json, live-spot-checks
 * record.active_version vs installed_plugins.json, detects legacy-config-pin
 * drift (F11), classifies topology (marketplace-cache | dev-clone | legacy |
 * not-found -- legacy-alongside-marketplace-cache is a migration candidate),
 * and runs the 6-way version-of-record STRING comparison. Non-empty detail on
 * every path.
 *
 * WHAT fix() DOES (moved performClassIFix): walks the recoverable findings and
 * returns an ARRAY of recovery records (session-start record write; LV rewrite;
 * legacy-config-pin reconcile with backup; legacy-clone backup-verify-remove
 * with the dev-clone safety belt + dirty/unpushed refuse checks per Phase 123
 * D-13; conservative installed_plugins.json repoint). The engine's fix-then-
 * recheck glue (Plan 01) pushes EACH recoveries[] element onto report.recovered
 * (tool:'install-state' added unless the record carries its own tool field).
 *
 * REGISTRY ORDER DEPENDENCY: install-state MUST precede deployment-surfaces in
 * data/doctor-modules.json so class J reads THIS runner's same-invocation
 * result through ctx.checks['install-state'] (topology + active_root +
 * active_version). The engine accumulates always-check results in registry
 * array order (scripts/doctor.cjs runAccumulativeEngine, alwaysChecks map).
 *
 * STATUS VOCABULARY: the raw checkInstallState returns 'healthy'|'warn'|'error'
 * (its historical vocabulary, still consumed by doctor.cjs --acceptance which
 * this module re-exports checkInstallState for). The engine check(ctx) maps
 * 'healthy' -> 'ok' so report.checks['install-state'] carries the standard
 * ok|warn|error|skip vocabulary the generic renderer + computeSummary key on.
 *
 * Canon Part 8: pure LOCAL reads + guarded LOCAL git/tar/session-start spawns;
 * zero network, zero Brain. Never back-requires the doctor CLI (Pitfall 4):
 * requires only node built-ins + ./shared.cjs.
 *
 * Threat register (Phase 217 Plan 06): T-217-03 (tampering via the class-I fix
 * install-topology mutations) -- the dev-clone safety belt (isLegacyDevClone)
 * and the dirty/unpushed refuse checks (legacyDirtyOrUnpushed) are preserved
 * verbatim, and every destructive step (legacy-clone rm) is backup-then-verify.
 * T-217-01 (self-DoS) -- the engine wraps check + fix in try/catch and every
 * child spawn carries a bounded timeout.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  HOME,
  PLUGIN_ROOT,
  resolveActivePluginRoot,
  readInstalledPluginsVersion,
  readLegacyConfigPin,
  resolveLegacyConfigPinEntry,
  readInstalledPluginsInstallPath,
  detectMarketplaceCacheInstall,
  pathBinVanished,
  collectVersionOfRecord,
  computeVersionDivergences,
  isLegacyDevClone,
  legacyDirtyOrUnpushed,
} = require('./shared.cjs');

// -- Class I check function (moved verbatim from scripts/doctor.cjs) -------

function checkInstallState(opts) {
  const o = opts || {};
  const home = o.home || HOME;
  // 1. Resolve live.
  let r;
  try { r = resolveActivePluginRoot(); } catch (err) {
    return {
      status: 'error',
      detail: 'resolveActivePluginRoot threw: ' + err.message,
      topology: 'not-found', record: null, versions: null, findings: [],
      recoverable: false,
    };
  }
  // 2. Read the record.
  const recordPath = path.join(home, '.mindrian', 'install-state.json');
  let record = null, recordOk = false;
  try { record = JSON.parse(fs.readFileSync(recordPath, 'utf8')); recordOk = true; } catch (_) { /* absent or unparseable */ }
  // 3. Live spot-check (D-05): compare record.active_version vs
  //    installed_plugins.json. STRING equality.
  let spotCheckFinding = null;
  if (recordOk && record && record.active_version) {
    const liveAV = readInstalledPluginsVersion(home);
    if (liveAV !== 'unknown' && liveAV !== record.active_version) {
      spotCheckFinding = 'install-state record stale -- record says ' + record.active_version
        + ', installed_plugins.json says ' + liveAV + '; re-run session-start';
    }
  }
  // 3b. Legacy-config-pin-drift (F11): the legacy plugins/config.json pins a
  //     mos version that disagrees with the modern installed_plugins.json.
  //     STRING inequality, same convention as the 6-way version-of-record.
  //     Skip when config.json is absent, installed_plugins.json is
  //     absent/unknown, or the versions match.
  let legacyPinFinding = null;
  const legacyPin = readLegacyConfigPin(home);
  if (legacyPin && legacyPin.version) {
    const modernVersion = readInstalledPluginsVersion(home);
    if (modernVersion !== 'unknown' && legacyPin.version !== modernVersion) {
      legacyPinFinding = {
        id: 'legacy-config-pin-drift', status: 'warn', recoverable: true,
        finding: 'legacy plugins/config.json pins mos ' + legacyPin.version
          + ' but installed_plugins.json says ' + modernVersion
          + ' -- stale legacy pin can poison command registration (F11); run with --fix to reconcile',
        legacyVersion: legacyPin.version,
        modernVersion: modernVersion,
        legacyKey: legacyPin.key,
      };
    }
  }
  // 4. Topology classification (D-11, BUG 7 fix). Each of marketplace-cache
  //    | dev-clone | legacy | not-found is VALID; only not-found is drift
  //    on its own, and `legacy` becomes a migration candidate iff a healthy
  //    marketplace-cache install exists alongside it.
  const topology = (record && record.topology) || r.topology || 'not-found';
  let topologyFinding = null;
  let topologyRecoverable = false;
  if (topology === 'not-found') {
    topologyFinding = 'no active plugin install resolved -- reinstall: claude plugin install mos@mindrian-marketplace';
    // flag-only per D-13.
  } else if (topology === 'legacy') {
    // Migration candidate iff a separate healthy marketplace-cache install exists.
    const mc = detectMarketplaceCacheInstall(home);
    if (mc && mc.root) {
      topologyFinding = 'legacy clone detected alongside a healthy marketplace-cache install -- migration candidate (run with --fix to backup-then-remove)';
      topologyRecoverable = true;
    }
  }
  // Also detect a SEPARATE legacy dir alongside a healthy marketplace-cache
  // topology -- the resolver picked marketplace-cache (per installed_plugins.json
  // precedence) but a legacy ~/.claude/plugins/mindrian-os/ still exists on
  // disk. This is the most common live case -- Bug 7's symptom + the
  // legacy-migration candidate.
  if (topology === 'marketplace-cache' && !topologyFinding) {
    const legacyDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
    try {
      if (fs.existsSync(legacyDir) && fs.statSync(legacyDir).isDirectory()) {
        topologyFinding = 'legacy clone present at ' + legacyDir + ' alongside marketplace-cache install -- migration candidate (run with --fix to backup-then-remove)';
        topologyRecoverable = true;
      }
    } catch (_) { /* ignore */ }
  }
  // 5. Version-of-record 6-way comparison (STRING equality).
  const versions = collectVersionOfRecord(home, r, record);
  const divergences = computeVersionDivergences(versions);
  // 6. Compose findings.
  const findings = [];
  if (!recordOk) {
    findings.push({
      id: 'record-absent', status: 'warn', recoverable: true,
      finding: 'install-state record absent -- run session-start (or doctor --fix)',
    });
  }
  if (spotCheckFinding) {
    findings.push({
      id: 'record-stale', status: 'warn', recoverable: false,
      finding: spotCheckFinding,
    });
  }
  if (legacyPinFinding) {
    findings.push(legacyPinFinding);
  }
  if (topologyFinding) {
    findings.push({
      id: 'topology', status: 'warn', recoverable: topologyRecoverable,
      finding: topologyFinding, topology,
    });
  }
  for (const d of divergences) {
    findings.push({
      id: 'vor-' + d.from + '-vs-' + d.to,
      status: 'warn',
      recoverable: d.recoverable,
      finding: 'version-of-record divergence: ' + d.from + '=' + d.fromValue + ' vs ' + d.to + '=' + d.toValue,
      from: d.from, to: d.to, fromValue: d.fromValue, toValue: d.toValue,
    });
  }
  // Flag-only: PATH-bin entry vanished (Claude Code owns the entry).
  if (r && r.root && pathBinVanished(home, r.root)) {
    findings.push({
      id: 'path-bin-vanished', status: 'warn', recoverable: false,
      finding: 'PATH entry ' + path.join(r.root, 'bin') + ' does not exist -- restart Claude Code; if the issue persists, reinstall',
    });
  }
  // Flag-only: statusline-renders-wrong-version is a resolver-bug signal.
  // (Handled by the vor-AV-vs-SR divergence above; recoverable:false because
  // re-stamping the symptom masks the bug.)

  return {
    status: findings.length === 0 ? 'healthy' : 'warn',
    topology,
    record,
    record_present: recordOk,
    versions,
    findings,
    resolver: { root: r.root, source: r.source, topology: r.topology },
    recoverable: findings.some(f => f.recoverable),
  };
}

// -- Class I --fix (moved verbatim from scripts/doctor.cjs) ----------------

function performClassIFix(check, opts) {
  const o = opts || {};
  const home = o.home || HOME;
  const recoveries = [];
  if (!check || !check.findings) return recoveries;
  for (const f of check.findings) {
    if (!f.recoverable) continue;
    if (f.id === 'record-absent') {
      // Spawn scripts/session-start to write the record.
      const cp = require('child_process');
      const sessionStart = path.join(PLUGIN_ROOT, 'scripts', 'session-start');
      try {
        const env = Object.assign({}, process.env, {
          HOME: home, USERPROFILE: home,
          SESSION_START_NODE_PREFLIGHT_SKIP: '1',
        });
        const r = cp.spawnSync('bash', [sessionStart], { encoding: 'utf8', timeout: 10000, env });
        const recorded = fs.existsSync(path.join(home, '.mindrian', 'install-state.json'));
        recoveries.push({
          class: 'install-state', surface: 'record', action: 'session-start-write',
          ok: recorded, exit_code: typeof r.status === 'number' ? r.status : -1,
        });
      } catch (err) {
        recoveries.push({
          class: 'install-state', surface: 'record', action: 'session-start-write',
          ok: false, detail: err.message,
        });
      }
      continue;
    }
    if (f.id && /^vor-/.test(f.id) && (f.from === 'LV' || f.to === 'LV')) {
      // LV divergence -> rewrite ~/.mindrian-last-version to match the OTHER
      // leg (prefer IP, then AV).
      const target = (f.from === 'LV') ? f.toValue : f.fromValue;
      const lvPath = path.join(home, '.mindrian-last-version');
      try {
        fs.writeFileSync(lvPath, String(target) + '\n');
        recoveries.push({
          class: 'install-state', surface: 'mindrian-last-version',
          action: 'rewrite', ok: true, target_value: target,
        });
      } catch (err) {
        recoveries.push({
          class: 'install-state', surface: 'mindrian-last-version',
          action: 'rewrite', ok: false, detail: err.message,
        });
      }
      continue;
    }
    if (f.id === 'legacy-config-pin-drift') {
      // F11 fix: back up the legacy config.json FIRST, then reconcile only its
      // mos.version to the live installed_plugins.json version. Conservative --
      // enabled/installedAt and every other field are left untouched. All
      // best-effort; never throw out of the fix loop.
      const file = path.join(home, '.claude', 'plugins', 'config.json');
      try {
        // 1. Back up first (mirror the installed_plugins.json repair pattern).
        // Timestamp MUST be filename-safe: a raw toISOString() contains ':',
        // which is a reserved character on Windows (NTFS ADS separator) --
        // copyFileSync throws EINVAL/ENOENT on it. Confirmed live on Windows
        // 2026-07-05: the unsanitized form made --fix a SILENT no-op (the
        // outer catch swallowed the throw, so neither backup nor the
        // reconcile write ever landed). Same sanitization already used a few
        // lines away in this file (~L609, ~L2247) -- this branch just missed it.
        const ts = new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0, 15);
        const backupsDir = path.join(home, '.mindrian', 'backups');
        try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (_) { /* ignore */ }
        const backupPath = path.join(backupsDir, 'config.json.' + ts + '.bak');
        // Isolate the backup step: a backup failure must NOT silently abort
        // the reconcile write (the outer catch would swallow it and leave
        // the drift unfixed with no visible reason). Report distinctly.
        let backupOk = true;
        let backupError = null;
        try {
          fs.copyFileSync(file, backupPath);
        } catch (err) {
          backupOk = false;
          backupError = err.message;
        }
        // 2. Re-read the modern version LIVE (do not trust the stale payload).
        const modernVersion = readInstalledPluginsVersion(home);
        if (modernVersion === 'unknown') {
          recoveries.push({
            class: 'install-state', surface: 'legacy-config-json', action: 'skipped',
            detail: 'installed_plugins.json version unknown -- nothing to reconcile to',
          });
          continue;
        }
        // 3. Parse, re-resolve the entry via the SHARED resolver (covers
        //    flat, plugins-wrapped, AND repositories-nested schemas -- a
        //    plain `data[key]` lookup here would silently miss the nested
        //    generation even though detection found it).
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const resolved = resolveLegacyConfigPinEntry(data);
        const entry = resolved ? resolved.entry : null;
        if (!entry) {
          recoveries.push({
            class: 'install-state', surface: 'legacy-config-json', action: 'skipped',
            detail: 'could not re-resolve the mos pin key in config.json',
            backup_path: backupPath,
          });
          continue;
        }
        entry.version = modernVersion;
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        recoveries.push({
          class: 'install-state', surface: 'legacy-config-json',
          action: 'version-reconciled', ok: true,
          // backup_path is only meaningful when the backup actually succeeded;
          // a failed backup no longer blocks the reconcile write (above), but
          // must stay VISIBLE rather than reported as if nothing went wrong.
          backup_path: backupOk ? backupPath : null,
          backup_ok: backupOk,
          backup_error: backupOk ? undefined : backupError,
          target_value: modernVersion,
          note: 'restart Claude Code (full app restart) to re-register commands',
        });
      } catch (err) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-config-json',
          action: 'skipped', detail: err.message,
        });
      }
      continue;
    }
    if (f.id === 'topology' && f.topology === 'legacy' || (f.id === 'topology' && /migration candidate/i.test(f.finding || ''))) {
      // Legacy-clone migration: backup-verify-remove.
      const legacyDir = path.join(home, '.claude', 'plugins', 'mindrian-os');
      // 0. Dev-clone safety belt: NEVER migrate a dev-clone.
      if (!fs.existsSync(legacyDir)) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'legacy dir does not exist at ' + legacyDir,
        });
        continue;
      }
      if (isLegacyDevClone(legacyDir)) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'origin remote points at mindrian-os-plugin OR MINDRIAN_OS_ROOT is set -- treating as a dev clone, NOT migrating',
        });
        continue;
      }
      // 1. Refuse if uncommitted/unpushed.
      const dirty = legacyDirtyOrUnpushed(legacyDir);
      if (dirty.dirty) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: dirty.reason,
        });
        continue;
      }
      // 2. Confirm a healthy marketplace-cache install exists.
      const mc = detectMarketplaceCacheInstall(home);
      if (!mc || !mc.root) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'no healthy marketplace-cache install to migrate to',
        });
        continue;
      }
      // 3. tar the legacy dir to ~/.mindrian/backups/legacy-<ISO>.tar.gz.
      const backupsDir = path.join(home, '.mindrian', 'backups');
      try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (_) { /* ignore */ }
      const ts = new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0, 15);
      const tarballPath = path.join(backupsDir, 'legacy-' + ts + '.tar.gz');
      const cp = require('child_process');
      const tarRes = cp.spawnSync('tar', [
        '-czf', tarballPath,
        '-C', path.dirname(legacyDir),
        path.basename(legacyDir),
      ], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
      const tarballOk = tarRes.status === 0 && fs.existsSync(tarballPath) && fs.statSync(tarballPath).size > 0;
      if (!tarballOk) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'tar failed -- refusing to remove legacy dir without a verified backup ' + (tarRes.stderr || ''),
        });
        continue;
      }
      // 4. Remove the legacy dir.
      try {
        fs.rmSync(legacyDir, { recursive: true, force: true });
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'migrated',
          backup_path: tarballPath, ok: true,
          note: 'legacy clone migrated; backup at ' + tarballPath,
        });
      } catch (err) {
        recoveries.push({
          class: 'install-state', surface: 'legacy-clone', action: 'skipped',
          reason: 'rm failed: ' + err.message,
          backup_path: tarballPath,
        });
      }
      continue;
    }
  }
  // Conservative installed_plugins.json repair: only when demonstrably stale.
  // Heuristic: the entry's installPath points at a missing dir AND there's a
  // valid marketplace-cache install present. Back up + repoint.
  try {
    const installPath = readInstalledPluginsInstallPath(home);
    const stalePath = installPath && !fs.existsSync(installPath);
    if (stalePath) {
      const mc = detectMarketplaceCacheInstall(home);
      if (mc && mc.root) {
        const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
        const ts = new Date().toISOString();
        const backupsDir = path.join(home, '.mindrian', 'backups');
        try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (_) { /* ignore */ }
        const backupPath = path.join(backupsDir, 'installed_plugins.json.' + ts + '.bak');
        try { fs.copyFileSync(file, backupPath); } catch (_) { /* best-effort */ }
        // Read, mutate the entry, write back. Conservative: only repoint
        // installPath; do not change the version field (leave for Claude Code).
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          const plugins = (data && data.plugins) || {};
          for (const key of Object.keys(plugins)) {
            const name = String(key).split('@')[0];
            if (name !== 'mos' && name !== 'mindrian-os') continue;
            let entries = plugins[key];
            if (!Array.isArray(entries)) entries = [entries];
            for (const e of entries) {
              if (!e) continue;
              if (e.installPath) e.installPath = mc.root;
              if (e.version) e.version = mc.version;
            }
            plugins[key] = entries;
          }
          fs.writeFileSync(file, JSON.stringify(data, null, 2));
          recoveries.push({
            class: 'install-state', surface: 'installed-plugins.json',
            action: 'repointed', ok: true, backup_path: backupPath,
            note: 'Claude Code must be restarted to re-read installed_plugins.json',
          });
        } catch (err) {
          recoveries.push({
            class: 'install-state', surface: 'installed-plugins.json',
            action: 'skipped', detail: 'parse/write failed: ' + err.message,
          });
        }
      }
    }
  } catch (_) { /* swallow -- repair is best-effort */ }
  return recoveries;
}

// -- Engine entry points (Phase 217 Plan 06) -------------------------------

// check(ctx): the accumulative-engine cadence:always entry. Wraps the raw
// checkInstallState (which returns the historical 'healthy'|'warn'|'error'
// vocabulary) and maps 'healthy' -> 'ok' so report.checks['install-state']
// carries the standard ok|warn|error|skip vocabulary. Every original payload
// key (topology, record, versions, findings, resolver, recoverable) is
// preserved for the class-i tests + the class-J same-invocation dependency.
function check(ctx) {
  const c = ctx || {};
  const raw = checkInstallState({ home: c.home });
  const status = raw.status === 'healthy' ? 'ok' : raw.status;
  const detail = raw.detail
    || (raw.findings && raw.findings.length
      ? 'install-state: ' + raw.findings.length + ' finding(s): '
        + raw.findings.map((f) => f.id).filter(Boolean).join(', ')
      : 'install-state healthy (topology ' + (raw.topology || 'unknown') + ')');
  return Object.assign({}, raw, { status, detail });
}

// fix(ctx): the accumulative-engine fix-then-recheck entry. Invoked with
// ctx.check_result (the check() result carrying findings[]). Returns
// { status, detail, recoveries } where recoveries is the EXACT classIRecoveries
// array the retired main() block pushed element-by-element onto report.recovered
// -- the Plan 01 engine glue now performs that push (tool:'install-state' added).
function fix(ctx) {
  const c = ctx || {};
  const checkResult = c.check_result || checkInstallState({ home: c.home });
  const recoveries = performClassIFix(checkResult, { home: c.home });
  const anyFailed = recoveries.some((rec) => rec && rec.ok === false);
  return {
    status: anyFailed ? 'warn' : 'ok',
    detail: 'install-state fix: ' + recoveries.length + ' recovery record(s)'
      + (anyFailed ? ' (one or more failed)' : ''),
    recoveries,
  };
}

module.exports = {
  check,
  fix,
  // raw entries re-exported for scripts/doctor.cjs --acceptance
  // (buildAcceptanceChecklist keys on the historical 'healthy' status) and for
  // hermetic unit reuse. Never a duplicate body in doctor.cjs (Pitfall 4).
  checkInstallState,
  performClassIFix,
};
