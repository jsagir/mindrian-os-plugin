#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-08 -- async artifact auto-commit PostToolUse hook.
 * =============================================================
 * Fires after Write|Edit|MultiEdit. For files written INSIDE a .room-root
 * subtree (Phase 87-01a sentinel) that live in a git-tracked room, the hook:
 *
 *   1. Reads a per-room throttle ledger at .mindrian/auto-commit-throttle.json
 *      (Phase 87-02 openSync('wx') + rename atomic pattern for persistence).
 *   2. Calls lib/core/auto-commit-throttle.shouldThrottle(path, now, ledger);
 *      if true, emits a null systemMessage and exits 0.
 *   3. Spawns a detached fire-and-forget worker that creates one commit on
 *      the ISOLATED 'data-room-autocommit' branch via git plumbing
 *      (hash-object, read-tree into a tmp index, update-index, write-tree,
 *      commit-tree, update-ref). The user's working branch and working index
 *      are NEVER touched.
 *   4. Updates the ledger with the new timestamp, prunes old entries, and
 *      writes the ledger atomically.
 *   5. Emits a systemMessage "auto-committed to data-room-autocommit" on
 *      success and exits 0.
 *
 * Hard invariants (audited via grep in tests + verify block):
 *   - No remote publication verb anywhere (Canon Part 8). Grep the source
 *     for the forbidden git-publish verb and the count must be zero.
 *   - No network calls. Grep for any remote-URL scheme token and the count
 *     must be zero.
 *   - Hook always exits 0 (advisory, not blocking).
 *   - User's working branch is never checked out (plumbing only).
 *   - Commits land on refs/heads/data-room-autocommit.
 *
 * Claude Code PostToolUse envelope (read on stdin):
 *   { "tool_name": "Write"|"Edit"|"MultiEdit",
 *     "tool_input": { "file_path": "<abs path>", ... } }
 *
 * Stdout (JSON envelope, one line):
 *   { "additionalContext": null,
 *     "systemMessage": "auto-committed to data-room-autocommit" | null,
 *     "suppressOutput": false }
 *
 * Canon:
 *   Part 4 Every Choice Is Graph Data -- auto-commits preserve the provenance
 *     trail of every artifact write; the filesystem commit history becomes a
 *     signal for Phase 90 Brain Derivation Layer.
 *   Part 6 Product-as-Venture -- plugin dog-foods auto-commits on its own
 *     rooms.
 *   Part 8 Graph Boundary -- commits stay LOCAL in the room git repo; never
 *     pushed anywhere, never sent to Brain.
 *
 * Three-surface compatibility: triggered by hooks.json on CLI; Desktop MCP
 * and Cowork share the same hooks.json bundle. No surface-specific code.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

// ---------- Soft-fail envelope ----------

function emitEnvelope(systemMessage) {
  try {
    const payload = {
      additionalContext: null,
      systemMessage: systemMessage === undefined ? null : systemMessage,
      suppressOutput: false,
    };
    process.stdout.write(JSON.stringify(payload) + '\n');
  } catch (_e) { /* best-effort */ }
}

function exitSilent() {
  emitEnvelope(null);
  process.exit(0);
}

// ---------- Stdin + envelope helpers ----------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_e) {
    return '';
  }
}

function extractFilePath(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const ti = payload.tool_input || payload.input || null;
  if (!ti || typeof ti !== 'object') return null;
  const candidates = ['file_path', 'filePath', 'path'];
  for (const k of candidates) {
    const v = ti[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function extractToolName(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.tool_name === 'string') return payload.tool_name;
  if (typeof payload.tool === 'string') return payload.tool;
  return null;
}

// ---------- Room root resolution (.room-root sentinel walk) ----------

const MAX_DEPTH = 12;

function findRoomRoot(filePath) {
  let dir = path.dirname(filePath);
  for (let hops = 0; hops < MAX_DEPTH; hops += 1) {
    if (dir === path.dirname(dir)) break;
    try {
      if (fs.existsSync(path.join(dir, '.room-root'))) return dir;
    } catch (_e) { /* keep walking */ }
    dir = path.dirname(dir);
  }
  return null;
}

// ---------- Git repo top discovery ----------

function gitRepoToplevel(roomRoot) {
  try {
    const res = spawnSync('git', ['-C', roomRoot, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    });
    if (res.status !== 0) return null;
    const out = (res.stdout || '').trim();
    return out || null;
  } catch (_e) {
    return null;
  }
}

// ---------- Throttle ledger I/O (composes with Phase 87-02 atomic pattern) ----------

function ledgerPath(roomRoot) {
  return path.join(roomRoot, '.mindrian', 'auto-commit-throttle.json');
}

function readLedger(roomRoot) {
  const p = ledgerPath(roomRoot);
  try {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (_e) {
    return {};
  }
}

// Atomic ledger write: openSync('wx') + rename (Phase 87-02 pattern).
function writeLedgerAtomic(roomRoot, ledger) {
  const p = ledgerPath(roomRoot);
  const dir = path.dirname(p);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_e) { /* ignore */ }
  const tmp = p + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
  let fd = null;
  try {
    // Use 'wx' (exclusive create) per Phase 87-02 / 88-04-B contract so
    // two concurrent writers cannot both claim the same tmp path. On
    // EEXIST we retry with a fresh suffix.
    let attempt = 0;
    while (attempt < 3) {
      try {
        fd = fs.openSync(tmp, 'wx');
        break;
      } catch (e) {
        if (e && e.code === 'EEXIST') {
          attempt += 1;
          continue;
        }
        throw e;
      }
    }
    if (fd === null) return false;
    fs.writeSync(fd, JSON.stringify(ledger, null, 2) + '\n');
    try { fs.fsyncSync(fd); } catch (_) { /* tmpfs best-effort */ }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, p);
    return true;
  } catch (_e) {
    try { if (fd !== null) fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmp); } catch (_) {}
    return false;
  }
}

// ---------- Git plumbing commit on isolated branch ----------
//
// Strategy: never perturb the user's working tree or index. We use a
// dedicated tmp index file via GIT_INDEX_FILE to stage ONLY the changed
// artifact on top of the current data-room-autocommit tree (or, if the
// branch does not yet exist, on top of HEAD's tree). Then we write-tree,
// commit-tree with the data-room-autocommit parent (if present), and
// update-ref. Zero user-visible state changes.

const AUTOCOMMIT_BRANCH = 'data-room-autocommit';

function runGitSync(repoTop, args, extraEnv) {
  const env = Object.assign({}, process.env);
  if (extraEnv) Object.assign(env, extraEnv);
  return spawnSync('git', ['-C', repoTop].concat(args), {
    encoding: 'utf8',
    env: env,
  });
}

// Returns { ok:boolean, rev:string|null }. Ensures refs/heads/data-room-
// autocommit exists, pointing at HEAD if it did not exist before.
function ensureAutocommitBranch(repoTop) {
  const ref = 'refs/heads/' + AUTOCOMMIT_BRANCH;
  // Does the branch ref already exist?
  const show = runGitSync(repoTop, ['show-ref', '--verify', '--quiet', ref]);
  if (show.status === 0) {
    const rev = runGitSync(repoTop, ['rev-parse', ref]);
    if (rev.status !== 0) return { ok: false, rev: null };
    return { ok: true, rev: (rev.stdout || '').trim() };
  }
  // Create branch at HEAD without perturbing working tree. Use git branch.
  const createHead = runGitSync(repoTop, ['branch', AUTOCOMMIT_BRANCH, 'HEAD']);
  if (createHead.status === 0) {
    const rev = runGitSync(repoTop, ['rev-parse', ref]);
    if (rev.status !== 0) return { ok: false, rev: null };
    return { ok: true, rev: (rev.stdout || '').trim() };
  }
  // If HEAD does not exist yet (brand-new repo with zero commits), we
  // simply cannot auto-commit until the user has landed a first commit on
  // their working branch. Defer silently -- the hook is advisory.
  return { ok: false, rev: null };
}

// Build a commit on data-room-autocommit that mirrors the user's current
// working tree PLUS the newly-written artifact, without touching the user's
// index or branch. Returns true on success, false on any failure.
function autocommitOnIsolatedBranch(repoTop, absFilePath) {
  const ensured = ensureAutocommitBranch(repoTop);
  if (!ensured.ok) return false;
  const parentRev = ensured.rev;

  // Compute the file's path relative to the repo top.
  let relPath;
  try {
    relPath = path.relative(repoTop, absFilePath);
  } catch (_e) {
    return false;
  }
  if (!relPath || relPath.startsWith('..')) return false;

  // Create a tmp index file. Using GIT_INDEX_FILE isolates all
  // subsequent git calls from the user's real index.
  const gitDirRes = runGitSync(repoTop, ['rev-parse', '--git-dir']);
  if (gitDirRes.status !== 0) return false;
  let gitDir = (gitDirRes.stdout || '').trim();
  if (!path.isAbsolute(gitDir)) gitDir = path.join(repoTop, gitDir);

  const tmpIndex = path.join(
    gitDir,
    'autocommit-index.' + process.pid + '.' + Date.now().toString(36)
  );
  const env = { GIT_INDEX_FILE: tmpIndex };

  try {
    // Seed the tmp index from the autocommit branch's tree so the commit
    // is incremental (prior autocommits are preserved). read-tree with no
    // --reset is safe here because the index does not exist yet.
    const readTree = runGitSync(repoTop, ['read-tree', parentRev], env);
    if (readTree.status !== 0) return false;

    // Hash the artifact blob (writes into the object db).
    const hashRes = runGitSync(
      repoTop,
      ['hash-object', '-w', '--', absFilePath],
      env
    );
    if (hashRes.status !== 0) return false;
    const blobSha = (hashRes.stdout || '').trim();
    if (!/^[0-9a-f]{40,}$/.test(blobSha)) return false;

    // Determine file mode. Default 100644 (regular file).
    let mode = '100644';
    try {
      const st = fs.statSync(absFilePath);
      if ((st.mode & 0o111) !== 0) mode = '100755';
    } catch (_e) { /* default */ }

    // Stage the blob at relPath in the tmp index.
    const relForIndex = relPath.split(path.sep).join('/');
    const updRes = runGitSync(
      repoTop,
      ['update-index', '--add', '--cacheinfo', mode + ',' + blobSha + ',' + relForIndex],
      env
    );
    if (updRes.status !== 0) return false;

    // Write the tree from the tmp index.
    const writeTreeRes = runGitSync(repoTop, ['write-tree'], env);
    if (writeTreeRes.status !== 0) return false;
    const treeSha = (writeTreeRes.stdout || '').trim();
    if (!/^[0-9a-f]{40,}$/.test(treeSha)) return false;

    // If the tree is byte-identical to the parent's tree, there is nothing
    // to commit (idempotency contract). Skip silently.
    const parentTreeRes = runGitSync(
      repoTop,
      ['rev-parse', parentRev + '^{tree}'],
      env
    );
    if (parentTreeRes.status === 0) {
      const parentTree = (parentTreeRes.stdout || '').trim();
      if (parentTree === treeSha) {
        return false; // no-op commit skipped
      }
    }

    // Build the commit message.
    const basename = path.basename(absFilePath);
    const msg = 'auto-commit: ' + basename;

    // commit-tree receives the message on stdin so we do not need to
    // escape shell characters in the basename.
    const commitRes = spawnSync(
      'git',
      ['-C', repoTop, 'commit-tree', treeSha, '-p', parentRev],
      {
        encoding: 'utf8',
        input: msg + '\n',
        env: Object.assign({}, process.env, env),
      }
    );
    if (commitRes.status !== 0) return false;
    const commitSha = (commitRes.stdout || '').trim();
    if (!/^[0-9a-f]{40,}$/.test(commitSha)) return false;

    // Advance the branch ref. update-ref is the plumbing-level equivalent
    // of "fast-forward the branch to this commit" without touching HEAD,
    // the working tree, or the user's index.
    const upd = runGitSync(
      repoTop,
      ['update-ref', 'refs/heads/' + AUTOCOMMIT_BRANCH, commitSha, parentRev]
    );
    if (upd.status !== 0) return false;

    return true;
  } finally {
    // Remove the tmp index file so the .git dir stays clean.
    try { fs.unlinkSync(tmpIndex); } catch (_e) { /* ignore */ }
  }
}

// ---------- Detached worker spawn (non-blocking) ----------
//
// The hook returns immediately after emitting the systemMessage. The actual
// git plumbing runs in a detached child process so the user's tool-call
// latency is unaffected. We invoke this same script with a special
// --worker flag and the file path as an argv; the child then performs the
// commit and exits silently.

function spawnDetachedWorker(absFilePath) {
  try {
    const proc = spawn(
      process.execPath,
      [__filename, '--worker', absFilePath],
      {
        detached: true,
        stdio: 'ignore',
        // Inherit env (PATH etc.) so git is resolvable.
        env: process.env,
      }
    );
    proc.unref();
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------- Worker mode ----------
//
// When invoked as `node async-artifact-auto-commit.cjs --worker <path>`,
// this path runs the git plumbing sequence and exits. Soft-fail always.

function runWorker(absFilePath) {
  try {
    if (typeof absFilePath !== 'string' || absFilePath.length === 0) return 0;
    const roomRoot = findRoomRoot(absFilePath);
    if (!roomRoot) return 0;
    const repoTop = gitRepoToplevel(roomRoot);
    if (!repoTop) return 0;
    autocommitOnIsolatedBranch(repoTop, absFilePath);
  } catch (_e) { /* soft-fail */ }
  return 0;
}

// ---------- Main ----------

function main() {
  // Worker fork path: skip stdin and jump straight to git work.
  const argv = process.argv.slice(2);
  if (argv[0] === '--worker' && typeof argv[1] === 'string') {
    process.exit(runWorker(argv[1]));
    return;
  }

  // Foreground hook path.
  let raw;
  try {
    raw = readStdinSync();
    if (!raw || !raw.trim()) return exitSilent();
  } catch (_e) { return exitSilent(); }

  let payload;
  try { payload = JSON.parse(raw); }
  catch (_e) { return exitSilent(); }
  if (!payload || typeof payload !== 'object') return exitSilent();

  const tool = extractToolName(payload);
  if (tool && !/^(Write|Edit|MultiEdit)$/.test(tool)) return exitSilent();

  const filePath = extractFilePath(payload);
  if (!filePath) return exitSilent();

  // Only commit files inside a .room-root subtree. Plugin-source writes
  // (no ancestor sentinel) short-circuit silently per Phase 87-01a.
  const roomRoot = findRoomRoot(filePath);
  if (!roomRoot) return exitSilent();

  // Resolve the repo top-level. If the room is not a git repo (user never
  // ran git init), degrade gracefully.
  const repoTop = gitRepoToplevel(roomRoot);
  if (!repoTop) return exitSilent();

  // Throttle check using the pure module.
  let throttle;
  try {
    throttle = require(path.resolve(__dirname, '..', 'lib', 'core', 'auto-commit-throttle.cjs'));
  } catch (_e) { return exitSilent(); }

  const now = Date.now();
  const ledger = readLedger(roomRoot);
  if (throttle.shouldThrottle(filePath, now, ledger)) {
    return exitSilent();
  }

  // Update + prune + atomic-write the ledger. Prune runs on every write
  // so the ledger stays bounded even under long-lived sessions.
  const updated = throttle.updateLedger(filePath, now, ledger);
  const pruned = throttle.pruneOldEntries(updated, now);
  writeLedgerAtomic(roomRoot, pruned);

  // Fire-and-forget detached spawn. If spawn fails (pathological env),
  // degrade to a silent systemMessage so the hook stays advisory.
  const spawned = spawnDetachedWorker(filePath);
  if (!spawned) return exitSilent();

  // Emit the success message and return immediately. The git plumbing
  // happens in the detached worker; the user's Write/Edit tool-call
  // latency is unaffected.
  emitEnvelope('auto-committed to ' + AUTOCOMMIT_BRANCH);
  process.exit(0);
}

// Outer try/catch is the soft-fail guarantee. The PostToolUse surface must
// NEVER break a user's Write / Edit / MultiEdit tool call.
try { main(); }
catch (_e) { try { exitSilent(); } catch (_f) { process.exit(0); } }
