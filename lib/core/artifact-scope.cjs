/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 379.1 (graph derive drain and scout runaway CPU) Plan 02 Task 1.
 *
 * The artifact-scope predicate: a declared way to keep generated engine-input
 * directories out of the derive and scout artifact scope. CPU379-10,
 * D-379.1-03, D-379.1-18, T-379.1-01, T-379.1-02.
 *
 * Two mechanisms, both evaluated per directory by the walkers (Plans 04, 05):
 *   1. Marker files. A directory that holds .mos-generated or
 *      engine-input-manifest.json is excluded. The markers are authoritative:
 *      on the incident room they exclude 2,119 of 2,163 artifacts and that
 *      is correct. The overbroad guards never apply to them.
 *   2. Declared globs. <room>/.mindrian/artifact-scope.json, version 1, with
 *      an exclude array of relative POSIX glob patterns. '*' matches inside
 *      one segment, '**' matches zero or more whole segments, nothing else.
 *      A bad file excludes nothing and is reported (parse_error). A bad
 *      pattern is dropped and counted (invalid_patterns). A wildcard-only
 *      pattern (every segment made of star characters only: one star, two
 *      stars, or any slash-joined mix of those) is rejected and also
 *      counted in overbroad_patterns. No RegExp is built from user input.
 *
 * The overbroad guards (checker BLOCKER, revision 1). After validation,
 * loadScope runs one bounded directory pre-walk with the patterns and
 * decides whether the declaration would hide too much:
 *   Guard A (every artifact): the patterns prune at least one .md and no .md
 *     stays in scope.
 *   Guard B (directory share): more than OVERBROAD_DIR_SHARE of the
 *     directories seen are pruned by the patterns. Default 0.5; env
 *     MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE, a decimal in (0, 1].
 * When either guard fires the patterns are emptied (the markers still apply),
 * overbroad is true, the first-pass counts stay in overbroad_stats, and the
 * pre-walk runs again with no patterns so stats describes what the walkers
 * will actually exclude. The share is a directory share, not an artifact
 * share, on purpose: the legitimate incident declaration prunes 1 directory
 * holding 98 percent of the files; an artifact share would reject it, a
 * directory share does not; '*' or '**' would prune every directory and trip
 * guard B at 100 percent (and are rejected before the walk anyway).
 *
 * Node built-ins only. Never throws across its boundary. No network.
 * No em-dashes (CLAUDE.md). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER_FILES = ['.mos-generated', 'engine-input-manifest.json'];
const SCOPE_FILE = '.mindrian/artifact-scope.json';

// The guard B threshold. The disclosed excluded counts come from the bounded
// pre-walk (dot-entries skipped, depth at most PREWALK_MAX_DEPTH) and may
// differ from a walker's own count on rooms with dot-directories or depth
// above 8; they are a disclosure, not a contract. When stats.truncated is
// true the share is advisory (the walk stopped at PREWALK_MAX_ENTRIES).
const OVERBROAD_DIR_SHARE_DEFAULT = 0.5;
const OVERBROAD_DIR_SHARE_ENV = 'MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE';

const PREWALK_MAX_DEPTH = 8;
const PREWALK_MAX_ENTRIES = 20000;

const SCOPE_FILE_MAX_BYTES = 64 * 1024;
const PATTERN_MAX_LENGTH = 256;

// ---------------------------------------------------------------------------
// Pattern validation
// ---------------------------------------------------------------------------

/*
 * patternDefect(p) -> null | string
 * The first defect found, in this order: not_string, empty, too_long,
 * backslash, absolute, drive_letter, dotdot, wildcard_only. Because the
 * wildcard-only check runs last, a 'wildcard_only' result means every other
 * check passed, so it is the only defect.
 */
function patternDefect(p) {
  if (typeof p !== 'string') return 'not_string';
  if (p.trim().length === 0) return 'empty';
  if (p.length > PATTERN_MAX_LENGTH) return 'too_long';
  if (p.indexOf('\\') !== -1) return 'backslash';
  if (p[0] === '/') return 'absolute';
  if (p.length >= 2 && p[1] === ':' && /[A-Za-z]/.test(p[0])) return 'drive_letter';
  const segments = p.split('/');
  for (const seg of segments) {
    if (seg === '..') return 'dotdot';
  }
  let literal = false;
  for (const seg of segments) {
    if (seg.replace(/\*/g, '').length > 0) { literal = true; break; }
  }
  if (!literal) return 'wildcard_only';
  return null;
}

function validatePattern(p) {
  return patternDefect(p) === null;
}

// ---------------------------------------------------------------------------
// Glob matcher (hand-written; no RegExp from user input)
// ---------------------------------------------------------------------------

// One segment: '*' matches any run of characters (never a '/'); every other
// character matches itself. Greedy two-pointer with one backtrack point.
function _segMatch(pat, str) {
  let p = 0;
  let s = 0;
  let starP = -1;
  let starS = -1;
  while (s < str.length) {
    if (p < pat.length && pat[p] === '*') {
      starP = p;
      starS = s;
      p += 1;
      continue;
    }
    if (p < pat.length && pat[p] === str[s]) {
      p += 1;
      s += 1;
      continue;
    }
    if (starP !== -1) {
      p = starP + 1;
      starS += 1;
      s = starS;
      continue;
    }
    return false;
  }
  while (p < pat.length && pat[p] === '*') p += 1;
  return p === pat.length;
}

function _segments(s) {
  return String(s).split('/').filter((x) => x.length > 0);
}

/*
 * matchGlob(pattern, relPosixPath) -> boolean
 * Both sides are split on '/'; empty segments are dropped. A pattern segment
 * that is exactly '**' matches zero or more whole path segments; any other
 * segment is matched by _segMatch. Memoized over (pattern index, path index)
 * so a pattern with several '**' stays linear in the product of the lengths.
 */
function matchGlob(pattern, relPosixPath) {
  if (typeof pattern !== 'string' || typeof relPosixPath !== 'string') return false;
  const pats = _segments(pattern);
  const segs = _segments(relPosixPath);
  if (pats.length === 0) return false;
  const width = segs.length + 1;
  const memo = new Map();
  function walk(pi, si) {
    if (pi === pats.length) return si === segs.length;
    const key = pi * width + si;
    if (memo.has(key)) return memo.get(key);
    let ok = false;
    if (pats[pi] === '**') {
      for (let k = si; k <= segs.length && !ok; k += 1) ok = walk(pi + 1, k);
    } else if (si < segs.length && _segMatch(pats[pi], segs[si])) {
      ok = walk(pi + 1, si + 1);
    }
    memo.set(key, ok);
    return ok;
  }
  return walk(0, 0);
}

function _matchesAny(patterns, rel) {
  if (!Array.isArray(patterns)) return false;
  for (const p of patterns) {
    if (matchGlob(p, rel)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Directory predicate
// ---------------------------------------------------------------------------

function _toPosix(rel) {
  return rel.split(path.sep).join('/');
}

function _hasMarker(absDir) {
  for (const name of MARKER_FILES) {
    try {
      if (fs.existsSync(path.join(absDir, name))) return true;
    } catch (_e) { /* unreadable: no marker */ }
  }
  return false;
}

/*
 * isExcludedDir(absDir, roomDir, scope) -> boolean
 * True when a marker file exists in absDir, or when the room-relative POSIX
 * path of absDir matches a pattern in scope.patterns. The room root itself
 * and any directory outside the room (a relative path that starts with '..'
 * or is absolute) return false and are never matched. Never throws.
 */
function isExcludedDir(absDir, roomDir, scope) {
  if (typeof absDir !== 'string' || typeof roomDir !== 'string') return false;
  let rel;
  try {
    rel = path.relative(path.resolve(roomDir), path.resolve(absDir));
  } catch (_e) {
    return false;
  }
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  if (_hasMarker(absDir)) return true;
  const patterns = scope && typeof scope === 'object' ? scope.patterns : null;
  return _matchesAny(patterns, _toPosix(rel));
}

// ---------------------------------------------------------------------------
// Bounded pre-walk and the overbroad guards
// ---------------------------------------------------------------------------

/*
 * resolveOverbroadDirShare() -> number
 * env MINDRIAN_SCOPE_OVERBROAD_DIR_SHARE parsed as a decimal in (0, 1];
 * anything else gives OVERBROAD_DIR_SHARE_DEFAULT.
 */
function resolveOverbroadDirShare() {
  const raw = process.env[OVERBROAD_DIR_SHARE_ENV];
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n > 0 && n <= 1) return n;
  }
  return OVERBROAD_DIR_SHARE_DEFAULT;
}

function _isMd(name) {
  return name.toLowerCase().endsWith('.md');
}

function _skipDir(parentAbs, name) {
  if (name === 'node_modules') return true;
  try {
    return fs.existsSync(path.join(parentAbs, name, '.room-root'));
  } catch (_e) {
    return true;
  }
}

/*
 * prewalk(roomDir, patterns) -> stats
 * One bounded directory walk: entries that start with '.' are skipped,
 * node_modules is skipped, a subdirectory that carries .room-root is skipped,
 * the walk stops at PREWALK_MAX_DEPTH and stops counting after
 * PREWALK_MAX_ENTRIES entries (stats.truncated true). For every directory
 * below the root: dirs_seen += 1; a marker prunes it (marker_pruned_dirs,
 * its .md files into excluded_md); else a pattern match prunes it
 * (pattern_pruned_dirs, its .md files into excluded_md and
 * pattern_excluded_md); else the walk descends. Every .md file in a
 * non-pruned directory or in the root counts in kept_md.
 * excluded_dirs = marker_pruned_dirs + pattern_pruned_dirs. Integers and
 * booleans only; never a path.
 */
function prewalk(roomDir, patterns) {
  const root = path.resolve(typeof roomDir === 'string' ? roomDir : '');
  const pats = Array.isArray(patterns) ? patterns : [];
  const stats = {
    dirs_seen: 0,
    pattern_pruned_dirs: 0,
    marker_pruned_dirs: 0,
    excluded_dirs: 0,
    kept_md: 0,
    excluded_md: 0,
    pattern_excluded_md: 0,
    truncated: false,
  };
  let entriesSeen = 0;
  function budget() {
    entriesSeen += 1;
    if (entriesSeen > PREWALK_MAX_ENTRIES) {
      stats.truncated = true;
      return false;
    }
    return true;
  }
  function readdir(dir) {
    try {
      return fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return null;
    }
  }
  // Count the .md files under a pruned directory (same skip rules, bounded).
  function countMd(dir, depth) {
    if (depth > PREWALK_MAX_DEPTH) {
      stats.truncated = true;
      return 0;
    }
    const entries = readdir(dir);
    if (!entries) return 0;
    let n = 0;
    for (const e of entries) {
      if (!budget()) return n;
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) {
        if (_skipDir(dir, e.name)) continue;
        n += countMd(path.join(dir, e.name), depth + 1);
      } else if (e.isFile() && _isMd(e.name)) {
        n += 1;
      }
    }
    return n;
  }
  function walk(dir, depth) {
    const entries = readdir(dir);
    if (!entries) return;
    for (const e of entries) {
      if (!budget()) return;
      if (e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (_skipDir(dir, e.name)) continue;
        stats.dirs_seen += 1;
        if (_hasMarker(abs)) {
          stats.marker_pruned_dirs += 1;
          stats.excluded_md += countMd(abs, depth + 1);
          continue;
        }
        const rel = _toPosix(path.relative(root, abs));
        if (_matchesAny(pats, rel)) {
          stats.pattern_pruned_dirs += 1;
          const n = countMd(abs, depth + 1);
          stats.excluded_md += n;
          stats.pattern_excluded_md += n;
          continue;
        }
        if (depth + 1 > PREWALK_MAX_DEPTH) {
          stats.truncated = true;
          continue;
        }
        walk(abs, depth + 1);
      } else if (e.isFile() && _isMd(e.name)) {
        stats.kept_md += 1;
      }
    }
  }
  try {
    walk(root, 0);
  } catch (_e) {
    stats.truncated = true;
  }
  stats.excluded_dirs = stats.marker_pruned_dirs + stats.pattern_pruned_dirs;
  return stats;
}

/*
 * loadScope(roomDir) -> { declared, patterns, invalid_patterns,
 *   overbroad_patterns, parse_error, overbroad, stats, overbroad_stats,
 *   dir_share }
 * Reads <roomDir>/.mindrian/artifact-scope.json (64 KB cap; version 1;
 * exclude: string[]), validates every pattern, runs the bounded pre-walk and
 * the overbroad guards. Never throws. A missing file gives declared false;
 * a bad file gives parse_error true and patterns []. The markers always
 * apply, so stats is computed even with no declaration.
 */
function loadScope(roomDir) {
  const result = {
    declared: false,
    patterns: [],
    invalid_patterns: 0,
    overbroad_patterns: 0,
    parse_error: false,
    overbroad: false,
    stats: null,
    overbroad_stats: null,
    dir_share: OVERBROAD_DIR_SHARE_DEFAULT,
  };
  const root = path.resolve(typeof roomDir === 'string' ? roomDir : '');
  const file = path.join(root, SCOPE_FILE);
  try {
    let st = null;
    try {
      st = fs.statSync(file);
    } catch (_e) {
      st = null;
    }
    if (st && st.isFile()) {
      result.declared = true;
      if (st.size > SCOPE_FILE_MAX_BYTES) {
        result.parse_error = true;
      } else {
        let raw = null;
        try {
          raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (_e) {
          raw = null;
          result.parse_error = true;
        }
        if (!result.parse_error) {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)
            || raw.version !== 1 || !Array.isArray(raw.exclude)) {
            result.parse_error = true;
          } else {
            for (const item of raw.exclude) {
              const defect = patternDefect(item);
              if (defect === null) {
                result.patterns.push(item);
              } else {
                result.invalid_patterns += 1;
                if (defect === 'wildcard_only') result.overbroad_patterns += 1;
              }
            }
          }
        }
      }
    }
    const share = resolveOverbroadDirShare();
    result.dir_share = share;
    let stats = prewalk(root, result.patterns);
    if (result.patterns.length > 0) {
      // Guard A: the patterns prune at least one .md and nothing stays.
      const guardA = stats.pattern_excluded_md > 0 && stats.kept_md === 0;
      // Guard B: more than the share of the directories seen are pruned by
      // the patterns. Advisory when stats.truncated is true (bounded walk).
      const guardB = stats.dirs_seen > 0
        && (stats.pattern_pruned_dirs / stats.dirs_seen) > share;
      if (guardA || guardB) {
        result.overbroad = true;
        result.overbroad_stats = stats;
        result.patterns = [];
        stats = prewalk(root, []);
      }
    }
    result.stats = stats;
  } catch (_e) {
    result.parse_error = true;
    result.patterns = [];
    if (!result.stats) {
      result.stats = {
        dirs_seen: 0, pattern_pruned_dirs: 0, marker_pruned_dirs: 0, excluded_dirs: 0,
        kept_md: 0, excluded_md: 0, pattern_excluded_md: 0, truncated: true,
      };
    }
  }
  return result;
}

module.exports = {
  loadScope,
  isExcludedDir,
  matchGlob,
  MARKER_FILES,
  SCOPE_FILE,
  OVERBROAD_DIR_SHARE_DEFAULT,
  PREWALK_MAX_DEPTH,
  PREWALK_MAX_ENTRIES,
  _test: {
    validatePattern,
    patternDefect,
    resolveOverbroadDirShare,
    prewalk,
  },
};
