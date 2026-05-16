#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SessionStart preflight: warn when release work is shipped locally but not pushed.
 *
 * Origin: 2026-05-06 release-pipeline-gap incident. Five betas (v1.13.0-beta.2 through
 *   v1.13.0-beta.6) were committed + tagged on local main but never pushed to origin
 *   or marketplace. Testers were stuck on v1.13.0-beta.1 for weeks. Root cause: gsd-executor
 *   agents bumped plugin.json + tagged + committed during phase execution, but never ran
 *   scripts/release.sh (which would have pushed). Bypass route shipped to local only.
 *
 * Detection (LOCAL-only, no network at hook time):
 *   1. Check local main is ahead of cached origin/main ref.
 *   2. If any unpushed commit matches release pattern (`release:`, `release(NN-MM):`), warn.
 *   3. Compare local plugin.json version vs cached origin/main plugin.json version.
 *      If local > origin: warn (plugin.json bumped but not pushed).
 *
 * Canon Part 8 compliance: zero network surface. Reads only LOCAL files + cached
 *   origin/main ref. The cached ref reflects whenever the user last ran git fetch.
 *   Trade-off: stale cache means the hook sometimes warns about drift that's already
 *   been pushed but not yet re-fetched. Conservative direction (false positive >
 *   silent miss) is correct for this defect class.
 *
 * Defensive rules (NEVER blocks hook chain):
 *   - 1500ms total budget.
 *   - Any internal error -> emit empty envelope (graceful no-op).
 *   - If origin/main ref doesn't exist (fresh clone, never fetched): silent no-op.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

function emitEnvelope(obj) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  try { process.stdout.write(JSON.stringify(filtered)); } catch (_) {}
  process.exit(0);
}
function emitEmpty() { emitEnvelope({ continue: true }); }
process.on('uncaughtException', () => emitEmpty());

function git(args, opts) {
  const res = spawnSync('git', args, Object.assign({
    encoding: 'utf8',
    timeout: 800,
    env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }),
  }, opts || {}));
  if (!res || typeof res.stdout !== 'string') return null;
  if (res.status !== 0) return null;
  return res.stdout.trim();
}

function readPluginVersion(repoPath, ref) {
  // ref === null reads the working-tree file; ref === 'origin/main' reads the cached blob.
  if (!ref) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(repoPath, '.claude-plugin/plugin.json'), 'utf8'));
      return json.version || null;
    } catch (_) { return null; }
  }
  const blob = git(['show', `${ref}:.claude-plugin/plugin.json`]);
  if (!blob) return null;
  try { return JSON.parse(blob).version || null; } catch (_) { return null; }
}

function findUnpushedReleases(repoPath) {
  // Use git log with --grep to find release commits on local main not on origin/main.
  // Returns array of { hash, subject } (max 5 entries).
  const log = git(['log', 'origin/main..main', '--grep=^release', '--oneline', '--max-count=5']);
  if (!log) return [];
  return log.split('\n').filter(Boolean).map(line => {
    const idx = line.indexOf(' ');
    return { hash: line.slice(0, idx), subject: line.slice(idx + 1) };
  });
}

function aheadCount() {
  const n = git(['rev-list', '--count', 'origin/main..main']);
  if (n === null) return 0;
  const parsed = parseInt(n, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildWarning({ ahead, releases, localVer, originVer }) {
  const lines = [];
  // Single-line systemMessage (Claude renders it tight).
  if (releases.length > 0) {
    const verb = releases.length === 1 ? 'release commit is' : 'release commits are';
    lines.push(`[${releases.length} ${verb} unpushed: ${releases.map(r => r.subject.split(' -- ')[0]).join(', ')}]`);
  }
  if (localVer && originVer && localVer !== originVer) {
    lines.push(`plugin.json local=${localVer} origin=${originVer}`);
  } else if (ahead > 0 && releases.length === 0) {
    lines.push(`local main is ${ahead} commits ahead of origin/main`);
  }
  if (lines.length === 0) return null;
  return `MindrianOS release drift -- ${lines.join('; ')}. Push: cd ~/MindrianOS-Plugin && git push origin main --tags`;
}

function additionalContextNote(_) {
  return [
    'MindrianOS release-drift preflight: local main has commits or a plugin.json version ',
    "that isn't on origin/main. The user has been shown a one-line warning. ",
    'Recovery: cd ~/MindrianOS-Plugin && git push origin main --tags. ',
    "Then update marketplace ref-pin if a release tag was pushed (~/mindrian-marketplace/.claude-plugin/marketplace.json).",
  ].join('');
}

function computeWarning() {
  // Resolve repo path from script location: scripts/ lives at $REPO_ROOT/scripts/.
  const repoPath = path.resolve(__dirname, '..');
  // Verify origin/main ref exists (fresh clones may not have fetched).
  const originRef = git(['rev-parse', '--verify', '--quiet', 'origin/main']);
  if (!originRef) return null;
  const ahead = aheadCount();
  if (ahead === 0) return null;
  const releases = findUnpushedReleases(repoPath);
  const localVer = readPluginVersion(repoPath, null);
  const originVer = readPluginVersion(repoPath, 'origin/main');
  const versionDrift = localVer && originVer && localVer !== originVer;
  if (releases.length === 0 && !versionDrift) return null;
  return buildWarning({ ahead, releases, localVer, originVer });
}

function main() {
  const warning = computeWarning();
  if (!warning) return emitEmpty();
  emitEnvelope({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      systemMessage: warning,
      additionalContext: additionalContextNote(),
    },
  });
}

// ----- Phase 121.5-00 contributor surface -----
// Plan 121.5-00 Task 2: this script is REMOVED from hooks.json entirely.
// Its computation FOLDS into preflight-doctor.cjs's contribute() (install-drift).
// We expose contributeReleaseDrift() returning a small {message} object that
// preflight-doctor concatenates into its full_payload.

function contributeReleaseDrift() {
  try {
    const warning = computeWarning();
    if (!warning) return { message: '' };
    return { message: warning };
  } catch (_) {
    return { message: '' };
  }
}

module.exports = { contributeReleaseDrift };

if (require.main === module) main();
