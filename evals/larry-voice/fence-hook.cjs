#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 plan 05 Task 2 (D-31, NS369.6-16; Codex C1, rounds 2 and 3): the PreToolUse fence of the scratch session
 * of the operational probe. It is the isolation boundary of the probe. It is registered by the scratch settings file that
 * writeScratchSettings of scripts/eval-larry-voice.cjs writes inside the scratch root. It is NOT registered in
 * hooks/hooks.json and it is never shipped as a plugin hook.
 *
 * Environment (set in the hook command by writeScratchSettings):
 *   FENCE_ROOT  the scratch root. Every path argument of every tool call must lie inside it.
 *   FENCE_LOG   a file inside the scratch root. Every deny appends one JSON line {seq, tool, reason}.
 *               The outside value is never written, only its reason.
 *
 * Decision, made BEFORE the tool runs, for every string value of the tool input that looks like a path:
 *   0  split the raw value on "/" and "\" before any normalisation, any "~" expansion, any string resolution and any
 *      lstat. A component equal to ".." denies at once with reason parent_component and no stat. Lexical
 *      normalisation erases a ".." whose meaning depends on a symlink: with FENCE_ROOT/link pointing at FENCE_ROOT,
 *      the value link/../victim normalises to a path inside the root while the filesystem reaches the parent of the
 *      root (Codex round 3 HIGH).
 *   a  resolve the value as a string ("~" is taken as the session HOME). A result outside the realpath of FENCE_ROOT
 *      denies at once with no stat (reason outside_root).
 *   b  otherwise walk the result component by component from FENCE_ROOT with lstat. A symlink is read with readlink
 *      (the link itself lies inside FENCE_ROOT) and its target is resolved as a string first: a target outside
 *      FENCE_ROOT, or holding a ".." component, denies with reason symlink_escape and is never stat-ed. A target inside
 *      continues the walk. A hop limit denies a loop (symlink_loop).
 *   c  the canonical path of the deepest existing ancestor must lie under the realpath of FENCE_ROOT; the part that does
 *      not exist yet is joined as a string.
 * This is realpath semantics computed without a stat outside FENCE_ROOT. fs.realpathSync would stat an outside link
 * target, which the domain rule forbids (the fence never reads, lists or stats a path outside FENCE_ROOT; nothing here
 * touches the owner's rooms).
 *
 * Any internal fault denies (fail closed) and logs fence_fault.
 *
 * Residual, stated plainly: a link created inside the scratch root between this check and the tool call is caught only by
 * the second line, the post-run parser of scripts/oplog-larry-voice.cjs, which repeats the same check on the logged
 * arguments after the call.
 *
 * The deny shape: the exit code 2 with the reason on stderr, which blocks the call, and the same decision as JSON on
 * stdout in the hookSpecificOutput form the repo already uses (scripts/card-before-answer-hook.cjs).
 *
 * Node built-ins only. Exports canonicalContain, pathCandidatesOf and stringValuesOf for the parser. The hook body runs
 * only under require.main === module. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const MAX_HOPS = 40;
const WHOLE_VALUE_MAX = 4096; // PATH_MAX: a longer single line cannot name a path the operating system can resolve
const MAX_LINES = 20000; // more lines than this cannot be inspected one by one and the call is denied
const MAX_DEPTH = 64; // a deeper input cannot be inspected and the call is denied
const HARD_CAP_CHARS = 4000000; // beyond this a value cannot be inspected and the call is denied

function deny(reason) { return { ok: false, reason: reason }; }

function within(root, p) {
  const rel = path.relative(root, p);
  return rel === '' || (rel !== '..' && rel.indexOf('..' + path.sep) !== 0 && !path.isAbsolute(rel));
}

// Rewrite a string path that lies under rootStr (the root as given) so that it lies under realRoot. Text only.
function rebase(p, rootStr, realRoot) {
  if (rootStr !== realRoot && within(rootStr, p)) return path.join(realRoot, path.relative(rootStr, p));
  return p;
}

function hasParentComponent(value) {
  return String(value).split(/[\/\\]/).some(function (c) { return c === '..'; });
}

/*
 * canonicalContain(root, candidate, cwd, opts) -> { ok: true, canonical } | { ok: false, reason }
 * root: the scratch root. candidate: the raw string value. cwd: the session directory a relative value resolves against.
 * opts.home: the session HOME that a leading "~" stands for (default process.env.HOME).
 */
function canonicalContain(root, candidate, cwd, opts) {
  const o = opts || {};
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.indexOf('\0') !== -1) return deny('bad_value');
  // step 0: before any normalisation, expansion, resolution or stat
  if (hasParentComponent(candidate)) return deny('parent_component');
  let realRoot;
  try { realRoot = fs.realpathSync(root); } catch (_e) { return deny('root_unavailable'); }
  const rootStr = path.resolve(root);
  let cand = candidate;
  if (cand === '~' || cand.indexOf('~/') === 0) {
    const home = o.home || process.env.HOME;
    if (!home || !path.isAbsolute(home)) return deny('home_unavailable');
    cand = path.join(home, cand.slice(1));
  }
  const base = typeof cwd === 'string' && path.isAbsolute(cwd) ? path.resolve(cwd) : realRoot;
  let abs = path.isAbsolute(cand) ? path.normalize(cand) : path.resolve(base, cand);
  abs = rebase(abs, rootStr, realRoot);
  // step a: a string result outside the root is denied with no stat
  if (!within(realRoot, abs)) return deny('outside_root');
  // step b: the lstat and readlink walk, inside the root only
  let pending = path.relative(realRoot, abs).split(path.sep).filter(Boolean);
  let cur = realRoot;
  let hops = 0;
  while (pending.length) {
    const comp = pending.shift();
    const next = path.join(cur, comp);
    let st;
    try { st = fs.lstatSync(next); } catch (e) {
      if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { ok: true, canonical: path.join.apply(path, [cur, comp].concat(pending)) };
      return deny('stat_fault');
    }
    if (st.isSymbolicLink()) {
      hops += 1;
      if (hops > MAX_HOPS) return deny('symlink_loop');
      let target;
      try { target = fs.readlinkSync(next); } catch (_e) { return deny('stat_fault'); }
      if (hasParentComponent(target)) return deny('symlink_escape');
      const tAbs = path.isAbsolute(target) ? path.normalize(target) : path.join(cur, target);
      const tReb = rebase(tAbs, rootStr, realRoot);
      if (!within(realRoot, tReb)) return deny('symlink_escape');
      pending = path.relative(realRoot, tReb).split(path.sep).filter(Boolean).concat(pending);
      cur = realRoot;
      continue;
    }
    cur = next;
  }
  // step c: the canonical path of the deepest existing ancestor lies under the root
  return within(realRoot, cur) ? { ok: true, canonical: cur } : deny('outside_root');
}

// The path candidates inside one string value (Codex round 1 of plan 369.6-05, findings 1 and 2).
// isPathToken: a token is a path when it holds a ".." component, is "~" or starts with "~/", is an absolute path (the first
// segment holds no colon, so /mos:validate is a command and not a path), a drive path, or holds a slash.
function isPathToken(t) {
  if (!t) return false;
  if (hasParentComponent(t)) return true;
  if (t === '~' || t.indexOf('~/') === 0) return true;
  if (t === '/') return true;
  if (t.charAt(0) === '/') return !isSlashCommand(t);
  if (/^[A-Za-z]:[\\/]/.test(t)) return true;
  if (t.indexOf('/') !== -1 || t.indexOf('\\') !== -1) return true;
  return false;
}
// Only the command namespace of this plugin is exempt: /mos:validate, with trailing punctuation. Every other absolute value,
// a colon in its first segment included, is an absolute path and is checked (Codex round 3, finding 2).
const COMMAND_RE = /^\/mos:[A-Za-z0-9][A-Za-z0-9-]*[.,!?:;)]*$/;
function isSlashCommand(t) { return COMMAND_RE.test(t); }

// Every candidate the fence and the parser must check for one string value. Nothing is skipped because of its size or its
// shape: the whole value is a candidate when it is short enough to be a file name or a path (a path may hold spaces, so
// tokenising prose cannot establish containment); the tokens of a value with whitespace are candidates when they look like
// paths. A value beyond HARD_CAP_CHARS cannot be inspected and is denied (fail closed).
function pathCandidatesOf(value) {
  if (typeof value !== 'string' || !value) return [];
  if (value.length > HARD_CAP_CHARS) return ['\0oversize'];
  const out = [];
  const add = function (c) { if (c && out.indexOf(c) === -1) out.push(c); };
  // The original text is checked as written: whitespace may be part of a file name (Codex round 3, finding 1).
  const asWhole = function (c) {
    if (c.length > WHOLE_VALUE_MAX) { if (isPathToken(c)) add(c); return; }
    // Single-line text that starts with a /mos: command is prose, and its tokens are still checked. A value with a newline
    // is never exempt: it is checked whole (Codex round 5, finding 1). Residual: a file named "/mos:cmd name" at the root
    // of the file system would pass; it is outside every room and every scratch root and a tool call cannot name more than that.
    if (c.charAt(0) === '/' && !/[\n\r]/.test(c) && isSlashCommand(c.split(/\s/)[0])) return;
    add(c);
  };
  if (!/\s/.test(value)) { asWhole(value); return out; }
  const lines = value.split(/\r?\n/);
  if (lines.length > MAX_LINES) return ['\0oversize'];
  asWhole(value); // the original value as written, a newline inside a file name included (Codex round 4, finding 1)
  lines.forEach(function (ln) { if (ln.trim()) { asWhole(ln); const t = ln.replace(/^\s+|\s+$/g, ''); if (t !== ln) asWhole(t); } });
  value.split(/[\s'"`(),;]+/).filter(Boolean).forEach(function (t) { if (isPathToken(t)) add(t); });
  return out;
}

// A value that the parser rewrites to <scratch>/<relative>: one token, no whitespace, that looks like a path.
function looksLikePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= WHOLE_VALUE_MAX && !/\s/.test(value) && isPathToken(value);
}

function stringValuesOf(input) {
  const out = [];
  (function walk(v, depth) {
    if (depth > MAX_DEPTH) { out.push('\0oversize'); return; }
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(function (x) { walk(x, depth + 1); });
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k], depth + 1); });
  })(input, 0);
  return out;
}

function logDeny(logFile, tool, reason) {
  try {
    let seq = 1;
    try { seq = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length + 1; } catch (_e) { seq = 1; }
    fs.appendFileSync(logFile, JSON.stringify({ seq: seq, tool: String(tool || ''), reason: reason }) + '\n');
  } catch (_e) { /* the exit code still blocks the call */ }
}

function emitDeny(reason) {
  const msg = 'scratch fence: the tool call is refused (' + reason + ').';
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: msg } }) + '\n');
  process.stderr.write(msg + '\n');
  process.exit(2);
}

function main() {
  const root = process.env.FENCE_ROOT;
  const logFile = process.env.FENCE_LOG;
  let payload = null;
  let tool = '';
  try {
    if (!root || !logFile || !path.isAbsolute(root) || !path.isAbsolute(logFile)) throw new Error('fence_env');
    const raw = fs.readFileSync(0, 'utf8');
    payload = JSON.parse(raw);
    tool = payload && payload.tool_name;
    const cwd = payload && typeof payload.cwd === 'string' ? payload.cwd : root;
    const input = payload && payload.tool_input;
    const values = stringValuesOf(input);
    for (let i = 0; i < values.length; i += 1) {
      const cands = pathCandidatesOf(values[i]);
      for (let j = 0; j < cands.length; j += 1) {
        const res = canonicalContain(root, cands[j], cwd);
        if (!res.ok) { logDeny(logFile, tool, res.reason); emitDeny(res.reason); return; }
      }
    }
    process.exit(0);
  } catch (_e) {
    if (logFile && path.isAbsolute(logFile)) logDeny(logFile, tool, 'fence_fault');
    emitDeny('fence_fault');
  }
}

if (require.main === module) main();

module.exports = { MAX_DEPTH, canonicalContain, pathCandidatesOf, stringValuesOf, hasParentComponent, isPathToken, looksLikePath };
