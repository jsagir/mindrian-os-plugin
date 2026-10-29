'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 03 (PERF381-03, PERF381-04, PERF381-08) -- the bounded async room snapshot and the
 * bash-semantics helpers that the three node renderers (compute-team, analyze-room, compute-state)
 * need to keep their bash bytes.
 *
 * Purpose
 *   scripts/compute-state, scripts/compute-team and scripts/analyze-room fork a few thousand
 *   sed, grep, head, sort, xargs and date processes per run. The node renderers replace those
 *   forks with ONE room scan (this module) and pure functions. The hard part is byte parity with
 *   accidental bash behaviour: hash order of associative arrays, the sed and grep frontmatter
 *   dialect, read splitting, sort ties, xargs and echo, date -d. Each helper here is a small pure
 *   function proven against the live tool on this host (tests/test-381-bash-assoc.cjs,
 *   tests/test-381-bash-dialect.cjs, tests/test-381-date-tz-matrix.cjs, tests/test-381-room-scan.cjs).
 *
 * Canon
 *   Part 8 (graph boundary): zero network. Node built-ins only (fs, path, util, child_process).
 *   No Brain call, no fetch, no URL. tests/run-all-381.sh sweeps this file for egress tokens.
 *   Part 7 (reuse before build): the reuse search of 381-RESEARCH.md "Frontmatter parser and walker
 *   reuse" enumerated gray-matter, state-version readStateFrontmatter, folder-memory-shared
 *   parseMintoFrontmatter, the vault room-scanner parseFrontmatter, frontmatter-schemas,
 *   part8-room-lexicon and the room-map walkers. None of them reproduces the bash dialect
 *   (gray-matter alone changes 24 of 1,760 real-room reads), so the net-new module is justified.
 *   The bounded pool is copied from lib/core/verification-stamp.cjs (pool) because it is not
 *   exported and D-55 forbids requiring scripts/ from lib/.
 *   Part 11 (invocation constitution): a library, not a command. It adds no invocable surface.
 *
 * Rulings (381-CONTEXT.md)
 *   Ruling 1: a bash-dialect line extractor replaces gray-matter (bashFmLines, bashField).
 *   Ruling 2: the named divergences are accepted: invalid UTF-8 decodes to U+FFFD and NUL is kept.
 *   Ruling 3: parity is defined under LC_ALL=C.UTF-8, so every order here is byte order.
 *   Ruling 7: bash hash order is emulated, never sorted (BashAssoc).
 *
 * Spawns: xargsEcho and dateDToEpoch are the only functions that spawn a process. Both pass the
 * value as stdin or as an argv element, never through a shell and never as program text (T-381-01).
 * Writes: none in this module.
 *
 * Hyphens only. CommonJS (.cjs): a hook can reach this file, so it stays free of TypeScript.
 */
const fs = require('node:fs');
const util = require('node:util');
const cp = require('node:child_process');

const fsp = fs.promises;

const FAN_OUT = 32;

// Assumption A1: bash hashes key bytes as C char. char is signed on x86 and unsigned on aarch64.
// tests/test-381-bash-assoc.cjs derives the truth from live bash and checks this constant.
const BASH_SIGNED_CHAR = process.arch === 'x64' || process.arch === 'ia32';

// ---------------------------------------------------------------------------
// pool(items, n, fn): copied from lib/core/verification-stamp.cjs (itself copied from
// scripts/jev-devtime-client.cjs). n workers pull from a shared index; every item runs exactly
// once; results land at their original index whatever the completion order.
// ---------------------------------------------------------------------------
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

// ---------------------------------------------------------------------------
// Text and order
// ---------------------------------------------------------------------------
// Byte order of the UTF-8 encoding, the order of LC_ALL=C.UTF-8 strcoll. JS < and localeCompare are
// never used: UTF-16 order differs for astral characters.
function byteCompare(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function byteSort(list) {
  const keyed = list.map((s) => ({ s, b: Buffer.from(s, 'utf8') }));
  keyed.sort((x, y) => Buffer.compare(x.b, y.b));
  return keyed.map((k) => k.s);
}

// The $(...) rule: every trailing newline goes. A loop, not a regex, so a long run of newlines
// in the middle of a string never backtracks.
function stripTrailingNewlines(s) {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 10) end -= 1;
  return end === s.length ? s : s.slice(0, end);
}

// $(node -e "console.log(v)"): console.log formats with util.format and adds one newline.
function consoleLogText(value) {
  return stripTrailingNewlines(util.format(value) + '\n');
}

// ---------------------------------------------------------------------------
// Frontmatter dialect (ruling 1)
//   sed -n '/^---$/,/^---$/p' | head -50, then grep '^key:' | head -1 | strip the key and spaces.
// Proven on GNU sed 4.9 and GNU grep 3.11: every range from a line that is exactly three hyphens
// to the next such line, inclusive, repeated through the file. The frontmatter need not start at
// line 1. A body rule opens a second range, so body keys become visible. A CR before the newline
// means the line is not a fence, so a CRLF file has no frontmatter.
// ---------------------------------------------------------------------------
function bashFmLines(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const out = [];
  let inRange = false;
  for (const l of lines) {
    if (!inRange) {
      if (l === '---') {
        inRange = true;
        out.push(l);
      }
    } else {
      out.push(l);
      if (l === '---') inRange = false;
    }
    if (out.length >= 50) break;
  }
  return out;
}

// key may carry the literal two-space prefix ('  speaker'). Tabs, quotes, CR, trailing spaces and
// inline comments stay in the value; only the key, the colon and following spaces go.
function bashField(fmLines, key) {
  const pre = key + ':';
  const hit = fmLines.find((l) => l.startsWith(pre));
  return hit === undefined ? '' : hit.slice(pre.length).replace(/^ */, '');
}

// grep -m1 '^prefix' over the WHOLE file (not only the frontmatter). Returns the line or null.
function firstLineWithPrefix(text, prefix) {
  const lines = text.split('\n');
  for (const l of lines) {
    if (l.startsWith(prefix)) return l;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bash associative arrays (ruling 7)
//   declare -A iteration order is the order of bash hashlib: FNV-1 32-bit (multiply, then xor, per
//   byte), bucket = hash & (nbuckets - 1), new items at the HEAD of a bucket, iteration walks
//   buckets 0 to n-1, 1024 buckets at the start, and the table grows by 4 when the entry count
//   reaches nbuckets * 2 (the old buckets are re-inserted in order, again at the head).
//   Proven identical to live bash 5.2.21 by tests/test-381-bash-assoc.cjs.
// ---------------------------------------------------------------------------
function bashHash(s, signed) {
  const sg = signed === undefined ? BASH_SIGNED_CHAR : signed;
  let h = 2166136261 >>> 0;
  for (const b of Buffer.from(s, 'utf8')) {
    h = Math.imul(h, 16777619) >>> 0;
    h = (h ^ (sg && b > 127 ? b - 256 : b)) >>> 0;
  }
  return h;
}

class BashAssoc {
  constructor(opts) {
    this.signed = opts && opts.signed !== undefined ? opts.signed : BASH_SIGNED_CHAR;
    this.nb = 1024;
    this.buckets = Array.from({ length: this.nb }, () => []);
    this.n = 0;
    this.idx = new Map();
  }

  set(k, v) {
    const hit = this.idx.get(k);
    if (hit) {
      hit.v = v;
      return;
    }
    if (this.n >= this.nb * 2) this.grow();
    const it = { k, v, h: bashHash(k, this.signed) };
    this.buckets[it.h & (this.nb - 1)].unshift(it);
    this.idx.set(k, it);
    this.n += 1;
  }

  get(k) {
    const it = this.idx.get(k);
    return it ? it.v : undefined;
  }

  has(k) {
    return this.idx.has(k);
  }

  grow() {
    const old = this.buckets;
    this.nb *= 4;
    this.buckets = Array.from({ length: this.nb }, () => []);
    for (const b of old) {
      for (const it of b) this.buckets[it.h & (this.nb - 1)].unshift(it);
    }
  }

  keys() {
    const out = [];
    for (const b of this.buckets) {
      for (const it of b) out.push(it.k);
    }
    return out;
  }

  get size() {
    return this.n;
  }
}

// ---------------------------------------------------------------------------
// read splitting: IFS=<one non-whitespace char> read -r v1 ... vN <<< "$line"
//   read stops at the first newline of the here-string. Fields split on each ifs char. The last
//   variable takes the rest, inner delimiters included. A lone trailing delimiter is dropped, and
//   only when the first delimiter of the rest is also its last character (so 'x|y|' gives 'y',
//   'x||' gives '' and 'f|g|' keeps both bars). Missing variables are ''.
// ---------------------------------------------------------------------------
function firstLine(s) {
  const nl = s.indexOf('\n');
  return nl === -1 ? s : s.slice(0, nl);
}

function readSplit(line, ifsChar, nVars) {
  let rest = firstLine(line);
  const out = [];
  for (let i = 0; i < nVars; i += 1) {
    const d = rest.indexOf(ifsChar);
    if (i === nVars - 1) {
      out.push(d !== -1 && d === rest.length - 1 ? rest.slice(0, d) : rest);
    } else if (d === -1) {
      out.push(rest);
      rest = '';
    } else {
      out.push(rest.slice(0, d));
      rest = rest.slice(d + 1);
    }
  }
  return out;
}

// IFS=<c> read -ra arr <<< "$line": empty fields are kept, one trailing empty field is dropped,
// the empty line gives no elements.
function readArray(line, ifsChar) {
  const s = firstLine(line);
  if (s === '') return [];
  const parts = s.split(ifsChar);
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

// ---------------------------------------------------------------------------
// GNU sort under LC_ALL=C.UTF-8
//   Without -n the key is compared as bytes. With -k1 the key runs from field 1 to the end of the
//   line, which is the whole line, so -t SEP changes nothing (sep is accepted for readability).
//   With -n the key is read as: blanks, an optional minus, digits, an optional point and digits;
//   anything else stops the number; no number is 0. Numbers compare by exact value. Ties fall
//   back to the whole-line byte compare (the last resort), and -r reverses the whole comparison
//   including that last resort. -u drops later lines of an equal key run and turns the last
//   resort off.
// ---------------------------------------------------------------------------
function parseSortNumber(s) {
  const m = /^[ \t]*(-?)([0-9]*)(?:\.([0-9]*))?/.exec(s);
  const int = m[2].replace(/^0+/, '');
  const frac = (m[3] || '').replace(/0+$/, '');
  const zero = int === '' && frac === '';
  return { neg: m[1] === '-' && !zero, int, frac, zero };
}

function compareMagnitude(a, b) {
  if (a.int.length !== b.int.length) return a.int.length < b.int.length ? -1 : 1;
  if (a.int !== b.int) return a.int < b.int ? -1 : 1;
  if (a.frac !== b.frac) return a.frac < b.frac ? -1 : 1;
  return 0;
}

function compareSortNumbers(a, b) {
  if (a.neg !== b.neg) return a.neg ? -1 : 1;
  const m = compareMagnitude(a, b);
  return a.neg ? -m : m;
}

function sortLines(lines, opts) {
  const o = opts || {};
  const items = lines.map((s) => ({
    s,
    b: Buffer.from(s, 'utf8'),
    n: o.numeric ? parseSortNumber(s) : null,
  }));
  const keyCompare = (x, y) => (o.numeric ? compareSortNumbers(x.n, y.n) : Buffer.compare(x.b, y.b));
  items.sort((x, y) => {
    let d = keyCompare(x, y);
    if (d === 0 && !o.unique) d = Buffer.compare(x.b, y.b);
    return o.reverse ? -d : d;
  });
  const out = [];
  let prev = null;
  for (const it of items) {
    if (o.unique && prev !== null && keyCompare(prev, it) === 0) continue;
    out.push(it.s);
    prev = it;
  }
  return out;
}

// ---------------------------------------------------------------------------
// $(printf '%s\n' "$value" | xargs)
//   xargs splits on space, tab and newline (CR is not a separator), honours quotes and backslashes,
//   and runs echo, which reads a first word that starts with a hyphen as an option. Only the
//   plain shape is done in JS; everything else spawns xargs with the value on stdin (no shell, no
//   argv from the value). A very long value spawns too, because xargs splits it over several echo
//   runs.
// ---------------------------------------------------------------------------
const XARGS_FAST_LIMIT = 16384;

function xargsEcho(value) {
  const tokens = value.split(/[ \t\n]+/).filter((t) => t !== '');
  const plain = !/['"\\]/.test(value) &&
    !(tokens.length > 0 && tokens[0].startsWith('-')) &&
    Buffer.byteLength(value, 'utf8') <= XARGS_FAST_LIMIT;
  if (plain) return { out: tokens.join(' '), code: 0, spawned: false };
  let r;
  try {
    r = cp.spawnSync('xargs', [], { input: value + '\n', maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (_e) {
    return { out: '', code: 127, spawned: true };
  }
  if (!r || r.error) return { out: '', code: 127, spawned: true };
  const out = stripTrailingNewlines(r.stdout.toString('utf8'));
  return { out, code: r.status === null ? 1 : r.status, spawned: true, err: r.stderr.toString('utf8') };
}

// ---------------------------------------------------------------------------
// portable_date_to_epoch of quick 261029-u8x (scripts/compute-team at BASE_SHA):
//   date -d V +%s || date -j -f %Y-%m-%d V +%s || { shape-valid V && python3 -c PROGRAM V } || 0
// The chain is run for real, because GNU date rejects midnight DST-gap dates (America/Havana
// 2026-03-08, Asia/Beirut 2026-03-29, America/Sao_Paulo 2018-11-04) and python then gives a
// shifted epoch, and a JS Date maps years 0001 to 0099 to 19xx. No date is computed in JS. The
// value travels only as argv. The result is memoized per (value, TZ) inside one process, so the
// spawn count follows the number of distinct date values, never the number of files.
// ---------------------------------------------------------------------------
const DATE_PY_PROGRAM = 'import sys; from datetime import datetime; print(int(datetime.strptime(sys.argv[1], "%Y-%m-%d").timestamp()))';
const DATE_SHAPE = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/;
const dateMemo = new Map();

function epochStep(file, args) {
  let r;
  try {
    r = cp.spawnSync(file, args, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });
  } catch (_e) {
    return null;
  }
  if (!r || r.error || r.status !== 0 || !r.stdout) return null;
  const m = /^(-?[0-9]+)\n?$/.exec(r.stdout.toString('utf8'));
  return m ? parseInt(m[1], 10) : null;
}

function dateDToEpoch(value) {
  const tz = process.env.TZ === undefined ? '\u0000unset' : 'tz:' + process.env.TZ;
  const key = tz + '\u0001' + value;
  if (dateMemo.has(key)) return dateMemo.get(key);
  let res = epochStep('date', ['-d', value, '+%s']);
  if (res === null) res = epochStep('date', ['-j', '-f', '%Y-%m-%d', value, '+%s']);
  if (res === null && DATE_SHAPE.test(value)) res = epochStep('python3', ['-c', DATE_PY_PROGRAM, value]);
  if (res === null) res = 0;
  dateMemo.set(key, res);
  return res;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// date -r FILE +%Y-%m-%d and date +%Y-%m-%d: local time, the year is not padded.
function dateYmdLocal(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// date -u +%Y-%m-%dT%H:%M:%SZ
function computedStamp(date) {
  const d = date instanceof Date ? date : new Date(date === undefined ? Date.now() : date);
  return d.toISOString().slice(0, 19) + 'Z';
}

// ---------------------------------------------------------------------------
// [ "$x" -gt 0 ] operand rule (bash legal_number): blanks, an optional sign, decimal digits,
// trailing blanks. Anything else (empty, a newline between, letters, past int64) is an error and
// the && chain does not print. Returns the value as bigint or null.
// ---------------------------------------------------------------------------
const INT64_MAX = 9223372036854775807n;
const INT64_MIN = -9223372036854775808n;

function bashTestInt(s) {
  const m = /^[ \t\n\v\f\r]*([+-]?)([0-9]+)[ \t]*$/.exec(s);
  if (!m) return null;
  const v = BigInt(m[1] === '-' ? '-' + m[2] : m[2]);
  return v > INT64_MAX || v < INT64_MIN ? null : v;
}

// ---------------------------------------------------------------------------
// GNU grep 3.11 under LC_ALL=C.UTF-8: which characters are word constituents for \b. The glibc
// alnum class is the Unicode Alphabetic property plus decimal digits (combining marks of many
// scripts and circled letters count; superscripts, fractions and symbols do not), plus the
// underscore. Corrected against the live grep by tests/test-381-bash-dialect.cjs, which compares
// every code point. Code points assigned after the Unicode version of the host glibc can differ.
// ---------------------------------------------------------------------------
const GREP_WORD = /[\p{Alphabetic}\p{Nd}_]/u;

function isGrepWordChar(ch) {
  return GREP_WORD.test(ch);
}

module.exports = {
  FAN_OUT,
  BASH_SIGNED_CHAR,
  pool,
  byteCompare,
  byteSort,
  stripTrailingNewlines,
  consoleLogText,
  bashFmLines,
  bashField,
  firstLineWithPrefix,
  bashHash,
  BashAssoc,
  DATE_PY_PROGRAM,
  readSplit,
  readArray,
  sortLines,
  xargsEcho,
  dateDToEpoch,
  dateYmdLocal,
  computedStamp,
  bashTestInt,
  isGrepWordChar,
};
