'use strict';
/*
 * lib/core/repo-version.cjs -- the ONE answer to "what version is this repo?"
 *
 * Background (2026-09-06, docs/autopsies/2026-09-06-worktree-version-contamination-incident.md):
 * an unscoped find/grep for the current plugin version walked into one of 46
 * orphaned agent worktree checkouts under .claude/worktrees/ (frozen at whatever
 * version existed the day that agent was spawned -- some as old as May 2026) and
 * returned that fossil's version as if it were current. The repo was actually at
 * 2.0.0-beta.26. The read was plausible-looking and completely wrong, and nothing
 * caught it, because there was no single governed answer to the question -- any
 * tool or agent asking "what version is this" was free to walk the tree and read
 * whichever plugin.json it hit first.
 *
 * This module gives one answer, mirroring lib/core/active-plugin-root.cjs's shape
 * (module export plus a CLI so bash and agents can shell out instead of grepping).
 * Its distinguishing behavior is the REFUSAL: if the resolved root sits under a
 * `.claude/worktrees/` or `worktrees/agent-*` path segment, it throws a named
 * error instead of returning a plausible-looking wrong version. A tool that
 * refuses is safe; a tool that guesses is what caused this.
 *
 * Use as a module:
 *   const { resolveRepoRoot, readRepoVersion } = require('<...>/lib/core/repo-version.cjs');
 *   const { version, root, mismatch } = readRepoVersion();
 *
 * Use as a CLI:
 *   node lib/core/repo-version.cjs          -> prints the bare version; exit 0, or exit 1 with a
 *                                               named error on stderr if contaminated/unresolvable
 *   node lib/core/repo-version.cjs --json   -> prints { version, root, pluginJson, packageJson, mismatch }
 *
 * Canon Part 8: this reads LOCAL files only (this repo's own plugin.json /
 * package.json). Zero network.
 */

const fs = require('node:fs');
const path = require('node:path');

// A directory is a candidate repo root iff it holds both manifest files that
// carry a version field for this project.
function isRepoRoot(dir) {
  try {
    return (
      fs.statSync(dir).isDirectory() &&
      fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json')) &&
      fs.existsSync(path.join(dir, 'package.json'))
    );
  } catch {
    return false;
  }
}

// Reject a resolved root whose path carries a worktree-checkout segment.
// Checked two ways on purpose: a per-segment scan (robust to the platform's
// real path separator) AND a substring scan (so a path assembled with mixed
// separators, e.g. copy-pasted across a Windows/WSL boundary, cannot slip
// through the segment check by accident).
function findContaminationReason(absRoot) {
  const segments = absRoot.split(path.sep).filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === '.claude' && segments[i + 1] === 'worktrees') {
      return 'path contains a .claude/worktrees segment';
    }
    if (segments[i] === 'worktrees' && typeof segments[i + 1] === 'string' && segments[i + 1].startsWith('agent-')) {
      return 'path contains a worktrees/agent-* segment';
    }
  }
  const normalized = absRoot.split(path.sep).join('/');
  if (normalized.includes('/.claude/worktrees/') || normalized.includes('/worktrees/agent-')) {
    return 'path contains a worktree-checkout marker (substring match)';
  }
  return null;
}

// resolveRepoRoot(startDir): walk upward from startDir (default __dirname)
// until a directory holding both manifest files is found. Throws a named,
// distinct error either when no such directory exists, or when the one found
// sits under a worktree-checkout path -- the refusal this module exists for.
function resolveRepoRoot(startDir) {
  let dir = path.resolve(startDir || __dirname);
  const root = path.parse(dir).root;
  while (true) {
    if (isRepoRoot(dir)) {
      const reason = findContaminationReason(dir);
      if (reason) {
        throw new Error(
          'repo-version: refusing to answer from a worktree checkout at ' + dir + ' (' + reason + '); ' +
          'run from the canonical repo root instead of a .claude/worktrees/* checkout'
        );
      }
      return dir;
    }
    if (dir === root) {
      throw new Error('repo-version: no repo root found walking up from ' + (startDir || __dirname) + ' (no directory with both .claude-plugin/plugin.json and package.json)');
    }
    dir = path.dirname(dir);
  }
}

// readRepoVersion(startDir): resolves the root, reads both manifests, and
// returns the two readings without silently reconciling them -- the caller
// decides what a mismatch means.
function readRepoVersion(startDir) {
  const root = resolveRepoRoot(startDir);
  const pluginJson = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const pluginVer = pluginJson.version;
  const packageVer = packageJson.version;
  const mismatch = pluginVer === packageVer ? null : { pluginJson: pluginVer, packageJson: packageVer };
  return {
    version: pluginVer,
    root: root,
    pluginJson: pluginVer,
    packageJson: packageVer,
    mismatch: mismatch,
  };
}

module.exports = { resolveRepoRoot, readRepoVersion };

// CLI entry point.
if (require.main === module) {
  try {
    const result = readRepoVersion();
    if (process.argv.includes('--json')) {
      process.stdout.write(JSON.stringify(result) + '\n');
    } else {
      process.stdout.write(result.version + '\n');
    }
    process.exit(0);
  } catch (e) {
    process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
    process.exit(1);
  }
}
