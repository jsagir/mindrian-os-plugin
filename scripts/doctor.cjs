#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 93 D2 -- /mos:doctor diagnostic + recovery for install-cache drift.
 *
 * Detects whether the live install at ~/.claude/plugins/mindrian-os/ is
 * out of sync with the marketplace cache at
 * ~/.claude/plugins/cache/mindrian-marketplace/mos/<latest>/, and offers
 * a one-shot recovery via --fix that backs up the stale install and
 * replaces it with the latest cached version.
 *
 * MODES:
 *   doctor             read-only diagnostic — exits with status code only
 *   doctor --fix       runs backup-then-replace recovery if drift detected
 *   doctor --json      machine-readable output (for hooks / regression tests)
 *
 * Exit codes:
 *   0  -> healthy, no drift
 *   1  -> drift detected (read-only mode)
 *   2  -> drift detected and recovered (--fix mode)
 *   3  -> internal error (cannot read directories, no marketplace cache, etc.)
 *
 * Phase 93 scope. See docs/autopsies/2026-04-28-install-cache-drift-incident.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Paths ────────────────────────────────────────────────────────────

const HOME = os.homedir();
const INSTALL_DIR = path.join(HOME, '.claude/plugins/mindrian-os');
const INSTALL_PLUGIN_JSON = path.join(INSTALL_DIR, '.claude-plugin/plugin.json');
const MARKETPLACE_CACHE_DIR = path.join(HOME, '.claude/plugins/cache/mindrian-marketplace/mos');

// ── ANSI colors ──────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// ── Argument parsing ─────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = { fix: false, json: false, verbose: false };
  for (const arg of argv) {
    if (arg === '--fix') flags.fix = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(usageText());
      process.exit(0);
    }
  }
  return flags;
}

function usageText() {
  return `Usage: doctor.cjs [--fix] [--json] [--verbose]

  doctor                 read-only diagnostic
  doctor --fix           run backup-then-replace recovery if drift detected
  doctor --json          machine-readable output

Exit codes:
  0  healthy, no drift
  1  drift detected (read-only)
  2  drift detected and recovered (--fix)
  3  internal error
`;
}

// ── Comparable semver helpers ───────────────────────────────────────

function parseVersion(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] || null,
    raw: v,
  };
}

function cmpVersion(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  // Prerelease versions sort BEFORE the corresponding stable version.
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);
  }
  return 0;
}

// ── Diagnostic checks ────────────────────────────────────────────────

function checkInstallVersion() {
  if (!fs.existsSync(INSTALL_DIR)) {
    return { status: 'missing', detail: `install dir does not exist: ${INSTALL_DIR}` };
  }
  if (!fs.existsSync(INSTALL_PLUGIN_JSON)) {
    return { status: 'missing', detail: `plugin.json missing inside install: ${INSTALL_PLUGIN_JSON}` };
  }
  try {
    const json = JSON.parse(fs.readFileSync(INSTALL_PLUGIN_JSON, 'utf8'));
    return { status: 'ok', version: json.version, parsed: parseVersion(json.version) };
  } catch (err) {
    return { status: 'error', detail: `failed to parse plugin.json: ${err.message}` };
  }
}

function checkMarketplaceCache() {
  if (!fs.existsSync(MARKETPLACE_CACHE_DIR)) {
    return { status: 'missing', detail: `marketplace cache dir does not exist: ${MARKETPLACE_CACHE_DIR}` };
  }
  let entries;
  try {
    entries = fs.readdirSync(MARKETPLACE_CACHE_DIR, { withFileTypes: true });
  } catch (err) {
    return { status: 'error', detail: `failed to read marketplace cache: ${err.message}` };
  }
  const versions = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const parsed = parseVersion(entry.name);
    if (parsed) {
      versions.push({ raw: entry.name, parsed });
    }
  }
  if (versions.length === 0) {
    return { status: 'empty', detail: 'no version directories found in marketplace cache' };
  }
  // Sort ascending, take last as latest
  versions.sort((a, b) => cmpVersion(a.parsed, b.parsed));
  return {
    status: 'ok',
    versions: versions.map(v => v.raw),
    latest: versions[versions.length - 1].raw,
    latestParsed: versions[versions.length - 1].parsed,
  };
}

function checkDevSourceConsistency() {
  // Best-effort: look for the canonical dev source. If absent, skip silently.
  const devSource = path.join(HOME, 'MindrianOS-Plugin');
  if (!fs.existsSync(path.join(devSource, '.claude-plugin/plugin.json'))) {
    return { status: 'skip', detail: 'dev source not found at ~/MindrianOS-Plugin (acceptable for end users)' };
  }
  try {
    const pluginJson = JSON.parse(fs.readFileSync(path.join(devSource, '.claude-plugin/plugin.json'), 'utf8'));
    const pkgJsonPath = path.join(devSource, 'package.json');
    let pkgVersion = null;
    if (fs.existsSync(pkgJsonPath)) {
      pkgVersion = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version;
    }
    const consistent = !pkgVersion || pkgVersion === pluginJson.version;
    return {
      status: consistent ? 'ok' : 'mismatch',
      pluginJson: pluginJson.version,
      packageJson: pkgVersion,
    };
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

// ── Recovery ─────────────────────────────────────────────────────────

function performRecovery(installVersion, latestCacheVersion) {
  const sourceDir = path.join(MARKETPLACE_CACHE_DIR, latestCacheVersion);
  if (!fs.existsSync(sourceDir)) {
    return { status: 'error', detail: `marketplace cache for ${latestCacheVersion} not found at ${sourceDir}` };
  }
  // Generate timestamp for backup
  const ts = new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-').slice(0, 15);
  const backupDir = path.join(HOME, `.claude/plugins/mindrian-os.stale-${installVersion}-${ts}`);
  // Step 1: rename current install to backup
  try {
    fs.renameSync(INSTALL_DIR, backupDir);
  } catch (err) {
    return { status: 'error', detail: `failed to back up stale install: ${err.message}` };
  }
  // Step 2: copy marketplace cache to install location
  try {
    copyRecursive(sourceDir, INSTALL_DIR);
  } catch (err) {
    // Try to restore the backup
    try { fs.renameSync(backupDir, INSTALL_DIR); } catch (_) {}
    return { status: 'error', detail: `failed to copy marketplace cache: ${err.message} (rollback attempted)` };
  }
  // Step 3: verify
  const after = checkInstallVersion();
  if (after.status !== 'ok' || after.version !== latestCacheVersion) {
    return { status: 'error', detail: `post-recovery verification failed: install version is ${after.version || 'unknown'}, expected ${latestCacheVersion}`, backup: backupDir };
  }
  return { status: 'ok', backup: backupDir, recoveredVersion: latestCacheVersion };
}

function copyRecursive(src, dst) {
  // Use cp -aT — preserves attributes, treats dst as the new target (no nesting)
  const { execSync } = require('child_process');
  execSync(`cp -aT ${shellQuote(src)} ${shellQuote(dst)}`);
}

function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// ── Renderers ────────────────────────────────────────────────────────

function renderHumanReport(report) {
  const lines = [];
  lines.push('');
  lines.push(`${C.cyan}╭─ MindrianOS Doctor ──────────────────────────────────╮${C.reset}`);
  lines.push('');

  // Install cache check
  if (report.install.status === 'ok' && report.cache.status === 'ok') {
    const drift = report.drift;
    if (drift.detected) {
      lines.push(`  ${C.yellow}⚠  Install cache drift detected${C.reset}`);
      lines.push(`     Live install:        ${C.yellow}${report.install.version}${C.reset}`);
      lines.push(`     Marketplace latest:  ${C.green}${report.cache.latest}${C.reset}`);
      lines.push(`     Available cached:    ${report.cache.versions.join(', ')}`);
      if (report.recovered) {
        lines.push('');
        lines.push(`     ${C.green}✓  Recovered to ${report.recovered.recoveredVersion}${C.reset}`);
        lines.push(`     ${C.dim}backup: ${report.recovered.backup}${C.reset}`);
      } else if (report.fixRequested) {
        lines.push('');
        lines.push(`     ${C.red}✗  Recovery failed: ${report.recoveryError || 'unknown'}${C.reset}`);
      } else {
        lines.push('');
        lines.push(`     ${C.dim}Run: /mos:doctor --fix${C.reset}`);
        lines.push(`     ${C.dim}This will back up the stale install and replace with ${report.cache.latest}.${C.reset}`);
      }
    } else {
      lines.push(`  ${C.green}✓  Install cache up to date${C.reset}`);
      lines.push(`     ${C.dim}Live install: ${report.install.version} (matches marketplace latest)${C.reset}`);
    }
  } else {
    lines.push(`  ${C.red}✗  Cannot check install cache${C.reset}`);
    if (report.install.status !== 'ok') lines.push(`     install: ${report.install.detail || report.install.status}`);
    if (report.cache.status !== 'ok') lines.push(`     cache:   ${report.cache.detail || report.cache.status}`);
  }

  // Dev source consistency (best-effort)
  if (report.dev.status === 'ok') {
    lines.push('');
    lines.push(`  ${C.green}✓  Dev source consistent${C.reset} ${C.dim}(plugin.json + package.json both at ${report.dev.pluginJson})${C.reset}`);
  } else if (report.dev.status === 'mismatch') {
    lines.push('');
    lines.push(`  ${C.yellow}⚠  Dev source version mismatch${C.reset}`);
    lines.push(`     plugin.json:  ${report.dev.pluginJson}`);
    lines.push(`     package.json: ${report.dev.packageJson}`);
    lines.push(`     ${C.dim}Run scripts/release.sh to lock all five gates.${C.reset}`);
  }
  // status=skip is silently omitted (acceptable for end users without dev clone)

  lines.push('');
  lines.push(`${C.cyan}╰──────────────────────────────────────────────────────╯${C.reset}`);
  lines.push('');
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const flags = parseArgs(process.argv.slice(2));

  const installResult = checkInstallVersion();
  const cacheResult = checkMarketplaceCache();
  const devResult = checkDevSourceConsistency();

  const report = {
    install: installResult,
    cache: cacheResult,
    dev: devResult,
    drift: { detected: false },
    fixRequested: flags.fix,
    recovered: null,
    recoveryError: null,
  };

  // Drift detection
  if (installResult.status === 'ok' && cacheResult.status === 'ok') {
    if (installResult.parsed && cacheResult.latestParsed) {
      const cmp = cmpVersion(installResult.parsed, cacheResult.latestParsed);
      report.drift = {
        detected: cmp < 0,
        compare: cmp,
      };
    }
  }

  // Recovery if requested + drift detected
  if (flags.fix && report.drift.detected) {
    const result = performRecovery(installResult.version, cacheResult.latest);
    if (result.status === 'ok') {
      report.recovered = result;
    } else {
      report.recoveryError = result.detail;
    }
  }

  // Output
  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHumanReport(report));
  }

  // Exit code
  if (installResult.status !== 'ok' || cacheResult.status !== 'ok') process.exit(3);
  if (!report.drift.detected) process.exit(0);
  if (report.recovered) process.exit(2);
  process.exit(1);
}

main();
