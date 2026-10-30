'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 03 Task 1 (PERF381-03, PERF381-04, ruling 1) -- the bash-semantics helpers of
 * lib/core/room-scan.cjs agree with the LIVE tools on this host under LC_ALL=C.UTF-8.
 *
 * Legs:
 *   FM    bashFmLines and bashField vs sed -n '/^---$/,/^---$/p' | head -50 | grep '^key:' | head -1
 *         | sed (strip the key and following spaces) on 20 generated files x 12 keys (CRLF, body rule, frontmatter after
 *         line 1, nested keys, head -50 cut, lookalike fences)
 *   FP    firstLineWithPrefix vs grep -m1 '^prefix' over the whole file
 *   READ  readSplit (1 to 4 vars) and readArray vs bash read -r / read -ra for IFS | : and ,
 *         (the Pitfall 11 table plus a seeded fuzz)
 *   SORT  sortLines vs GNU sort (plain, -t: -k1, -t: -k1 -rn, -t'|' -k1 -r, -n, -rn, -u)
 *   XARGS xargsEcho vs $(printf '%s\n' "$v" | xargs), fast path versus spawn
 *   DATE  dateDToEpoch vs the BASE_SHA portable_date_to_epoch run in bash (quick set: TZ=UTC and
 *         the three DST-gap pairs; the full TZ matrix lives in test-381-date-tz-matrix.cjs), the
 *         spawn recording, memoization and TZ keying, DATE_PY_PROGRAM vs the BASE_SHA text, and
 *         the u8x payloads with no marker file on either side
 *   LOCAL dateYmdLocal and computedStamp vs date -d @S
 *   TEST  bashTestInt vs [ "$v" -gt 0 ] and [ "$v" -lt 0 ]
 *   WORD  isGrepWordChar vs grep -E '\bB2B\b' (listed characters, then every code point)
 *   MISC  byteSort vs sort on astral names; consoleLogText; stripTrailingNewlines
 *
 * The u8x payloads (TEAM_PAYLOAD, FUND_PAYLOAD_RAW, payloadName(MARK_INFORMS)) are copied in
 * tests/helpers/live-381.cjs from tests/test-compute-team-date-guard.cjs and
 * tests/test-analyze-room-edge-argv.cjs (corrected payloads; the RCA Symptoms payload does not fire).
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail. Hyphens only.
 */
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

process.env.LC_ALL = 'C.UTF-8';
process.env.LANG = 'C.UTF-8';

const live = require('./helpers/live-381.cjs');
const scan = require('../lib/core/room-scan.cjs');

const realSpawn = cp.spawnSync;

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const memo = new Map();
function batch(name, producer) {
  if (!memo.has(name)) memo.set(name, producer());
  return memo.get(name);
}

const tmp = live.mkTmp('dialect');
let seq = 0;
function tmpFile(name, data) {
  const f = path.join(tmp, String(seq += 1) + '-' + name);
  fs.writeFileSync(f, data);
  return f;
}
function stripNl(s) {
  return s.replace(/\n+$/, '');
}

// ---------------------------------------------------------------------------
// FM: frontmatter dialect
// ---------------------------------------------------------------------------
const FM_KEYS = ['name', 'roles', 'role', 'primary_role', 'status', 'last_active', 'speaker', '  speaker',
  '  meeting_date', 'date', 'segment_type', 'type'];

function longRange() {
  const out = ['---'];
  for (let i = 2; i <= 49; i += 1) out.push(i === 10 ? 'name: Early' : 'f' + i + ': v');
  out.push('status: Line50', 'type: Line51');
  for (let i = 52; i <= 58; i += 1) out.push('g' + i + ': v');
  out.push('role: Late', '---', '# body');
  return out.join('\n') + '\n';
}

const FM_CASES = [
  ['plain LF', '---\nname: Alice Ade\nroles: [founder, partner]\nrole: founder\nprimary_role: founder\nstatus: active\nlast_active: 2026-01-10\nspeaker: Alice\ndate: 2026-01-09\nsegment_type: decision\ntype: insight\n---\n# Body\nname: Body Name\n'],
  ['CRLF file has no frontmatter', ['---', 'name: Frank Fox', 'role: partner', 'last_active: 2026-01-10', '---', '# Frank', ''].join('\r\n')],
  ['frontmatter after line 1', '\n\n---\nname: Gina\nstatus: active\n---\n# after\n'],
  ['body rule opens a second range', '# Title\ntext\n---\nname: Smith, Dan\ntype: insight\n---\nbody\n---\nname: Third\nrole: x\n'],
  ['trailing spaces, tab and quotes kept', '---\nname:   Spaced  Value   \nrole:\tTabbed\nstatus: "quoted" # comment\ntype:\nlast_active: 2026-02-30\r\n---\n'],
  ['nested speaker and meeting_date', '---\nattribution:\n  speaker: Alice Ade\n  meeting_date: 2026-02-01\nspeaker: Top\n---\n'],
  ['no frontmatter', '# Just a heading\nname: not frontmatter\n'],
  ['open fence never closed', '---\nname: Open\nrole: r\nand more\n'],
  ['range longer than 50 lines', longRange()],
  ['duplicate keys, first wins', '---\nname: First\nname: Second\n---\n'],
  ['key prefix near misses', '---\nnames: no\nrole: yes\nroles: list\nprimary_role_x: no\n  role: indented\n---\n'],
  ['fence lookalikes', ' ---\nname: no\n--- \nname: no\n----\nname: no\n---\nname: yes\n---\n'],
  ['no trailing newline', '---\nname: Last\n---'],
  ['empty file', ''],
  ['only a fence', '---\n'],
  ['two fences back to back', '---\n---\nname: after\n'],
  ['Hebrew values', '---\nname: שלום עולם\nrole: מייסד\n---\n'],
  ['colon inside the value', '---\nname: A: B: C\nstatus: x:y\n---\n'],
  ['blank lines inside', '---\n\nname: After blank\n\nrole: r\n---\n\n'],
  ['two spaces and a tab in nested keys', '---\n  speaker:\tTabbed\n   speaker: three\n  meeting_date:  2026-03-04  \n---\n'],
];

const FM_PROGRAM = 'tmpf=$1; n=$2; shift 2; keys=("${@:1:n}"); files=("${@:n+1}"); ' +
  'for f in "${files[@]}"; do ' +
  'sed -n "/^---\\$/,/^---\\$/p" "$f" | head -50 > "$tmpf"; ' +
  'printf "%s\\0" "$(cat "$tmpf")"; ' +
  'for k in "${keys[@]}"; do ' +
  'printf "%s\\0" "$(grep -e "^$k:" "$tmpf" | head -1 | sed "s/^$k: *//")"; ' +
  'done; done';

function fmLive() {
  return batch('fm', () => {
    const files = FM_CASES.map((c, i) => tmpFile('fm' + i + '.md', c[1]));
    const r = live.runBash(FM_PROGRAM, [path.join(tmp, 'fm.out'), String(FM_KEYS.length)].concat(FM_KEYS, files));
    assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
    const rec = live.nulSplit(r.stdout);
    const per = FM_KEYS.length + 1;
    assert.equal(rec.length, per * FM_CASES.length, 'record count');
    return FM_CASES.map((_c, i) => ({ fm: rec[i * per], fields: rec.slice(i * per + 1, (i + 1) * per) }));
  });
}
FM_CASES.forEach((c, i) => {
  leg('FM. ' + c[0], () => {
    const want = fmLive()[i];
    const lines = scan.bashFmLines(c[1]);
    assert.equal(stripNl(lines.join('\n')), want.fm, 'sed | head -50 output');
    FM_KEYS.forEach((k, j) => {
      assert.equal(scan.bashField(lines, k), want.fields[j], 'key ' + JSON.stringify(k));
    });
  });
});

// ---------------------------------------------------------------------------
// FP: firstLineWithPrefix
// ---------------------------------------------------------------------------
const FP_PREFIXES = ['methodology:', 'status:', 'source: transcript', 'funder:', 'deadline:', 'stage:'];
const FP_CASES = [
  '---\nmethodology: first\n---\nbody\nmethodology: second\n',
  '# no field here\nstatus : spaced\n',
  'text\n\n\nsource: transcript-v2\nsource: transcript\n',
  'funder: Fund: Alpha\r\nfunder: two\r\n',
  'x\n'.repeat(120) + 'deadline: 2099-12-31\nstage: late\n',
  '',
  'stage: first line no newline',
  'שלום\nstatus: שלום\n',
];
const FP_PROGRAM = 'n=$1; shift; prefixes=("${@:1:n}"); files=("${@:n+1}"); ' +
  'for f in "${files[@]}"; do for p in "${prefixes[@]}"; do ' +
  'v=$(grep -m1 -e "^$p" "$f"); rc=$?; printf "%s\\0%s\\0" "$rc" "$v"; done; done';
function fpLive() {
  return batch('fp', () => {
    const files = FP_CASES.map((c, i) => tmpFile('fp' + i + '.md', c));
    const r = live.runBash(FP_PROGRAM, [String(FP_PREFIXES.length)].concat(FP_PREFIXES, files));
    assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
    return live.nulSplit(r.stdout);
  });
}
FP_CASES.forEach((text, i) => {
  leg('FP. firstLineWithPrefix case ' + i, () => {
    const rec = fpLive();
    FP_PREFIXES.forEach((p, j) => {
      const at = (i * FP_PREFIXES.length + j) * 2;
      const rc = rec[at];
      const want = rc === '0' ? rec[at + 1] : null;
      assert.equal(scan.firstLineWithPrefix(text, p), want, 'prefix ' + JSON.stringify(p));
    });
  });
});

// ---------------------------------------------------------------------------
// READ: readSplit and readArray
// ---------------------------------------------------------------------------
function readCases(ifs) {
  const base = ['x|y', 'x|y|', 'x|y|z', 'x||', '|y', '', '|', '||', '|||', 'x', 'x|', 'x|y||', 'a|b|c|d', 'a|b|c|d|',
    'd|s|t|f|g|', 'd|s|t|f|g', '  x | y ', 'x\ty|z', 'Smith, John|insight|2026-01-01', 'a|b\nc|d', '|a|', 'a||b', 'a||b||',
    '|x|y|z|', 'x| |', 'x|y| '];
  const next = live.makeLcg(381);
  const alpha = ['a', 'b', 'c', '|', '|', '|', ' ', '\t'];
  for (let i = 0; i < 260; i += 1) {
    let s = '';
    const len = next() % 9;
    for (let j = 0; j < len; j += 1) s += alpha[next() % alpha.length];
    base.push(s);
  }
  return base.map((s) => s.split('|').join(ifs));
}
const SPLIT_PROGRAM = 'file=$1; ifs=$2; nv=$3; while IFS= read -r -d "" line; do case "$nv" in ' +
  '1) IFS="$ifs" read -r a <<< "$line"; printf "%s\\0" "$a";; ' +
  '2) IFS="$ifs" read -r a b <<< "$line"; printf "%s\\0%s\\0" "$a" "$b";; ' +
  '3) IFS="$ifs" read -r a b c <<< "$line"; printf "%s\\0%s\\0%s\\0" "$a" "$b" "$c";; ' +
  '4) IFS="$ifs" read -r a b c d <<< "$line"; printf "%s\\0%s\\0%s\\0%s\\0" "$a" "$b" "$c" "$d";; esac; done < "$file"';
const ARRAY_PROGRAM = 'file=$1; ifs=$2; while IFS= read -r -d "" line; do IFS="$ifs" read -ra arr <<< "$line"; ' +
  'printf "%s\\0" "${#arr[@]}" "${arr[@]}"; done < "$file"';
['|', ':', ','].forEach((ifs) => {
  const cases = readCases(ifs);
  const file = tmpFile('read-' + (ifs === '|' ? 'pipe' : ifs === ':' ? 'colon' : 'comma') + '.bin', cases.map((c) => c + '\0').join(''));
  [1, 2, 3, 4].forEach((nv) => {
    leg('READ. readSplit IFS=' + ifs + ' with ' + nv + ' var(s)', () => {
      const r = live.runBash(SPLIT_PROGRAM, [file, ifs, String(nv)]);
      assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
      const rec = live.nulSplit(r.stdout);
      assert.equal(rec.length, cases.length * nv, 'record count');
      cases.forEach((line, i) => {
        assert.deepEqual(scan.readSplit(line, ifs, nv), rec.slice(i * nv, (i + 1) * nv), 'line ' + JSON.stringify(line));
      });
    });
  });
  leg('READ. readArray IFS=' + ifs, () => {
    const r = live.runBash(ARRAY_PROGRAM, [file, ifs]);
    assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
    const rec = live.nulSplit(r.stdout);
    let at = 0;
    cases.forEach((line) => {
      const n = Number(rec[at]);
      const want = rec.slice(at + 1, at + 1 + n);
      at += 1 + n;
      assert.deepEqual(scan.readArray(line, ifs), want, 'line ' + JSON.stringify(line));
    });
    assert.equal(at, rec.length, 'all records consumed');
  });
});
leg('READ. the Pitfall 11 table, spelled out', () => {
  assert.deepEqual(scan.readSplit('x|y', '|', 2), ['x', 'y']);
  assert.deepEqual(scan.readSplit('x|y|', '|', 2), ['x', 'y']);
  assert.deepEqual(scan.readSplit('x|y|z', '|', 2), ['x', 'y|z']);
  assert.deepEqual(scan.readSplit('x||', '|', 2), ['x', '']);
  assert.deepEqual(scan.readSplit('|y', '|', 2), ['', 'y']);
  assert.deepEqual(scan.readSplit('d|s|t|f|g|', '|', 4), ['d', 's', 't', 'f|g|']);
  assert.deepEqual(scan.readSplit('x', '|', 3), ['x', '', '']);
});

// ---------------------------------------------------------------------------
// SORT
// ---------------------------------------------------------------------------
const SORT_SETS = {
  words: ['b', 'a', 'b', 'B', 'a ', '', 'a', 'ab', 'A', ' a', 'a\t', 'a b', 'a-b', 'a_b'],
  numbers: ['10', '9', '100', '-3', '2.5', '2.50', '-0', '0', 'abc', '', '007', ' 12', '.5', '1e3', '+4', '10:z', '10:a',
    '3.', '-.5', '9223372036854775808', '9223372036854775807', '12345678901234567890.5', '12345678901234567890.4',
    '1,000', '-', '--5', ' -7', '\t8', '0.0001', '0.00010', '5', '5', '-5', '-05', '00', '0.0'],
  keyed: ['12:abc', '3:zzz', '12:abb', '-1:x', 'x:5', ':7', '7:', '7:7', 'b:2', 'a:2', 'a:10', 'a:1', '10', '9'],
  utf8: ['שלום', 'עולם', 'é', 'e', 'z', '😀', '～', '\u{10000}', 'ﬃ', 'ñ', 'ü', 'Z', '漢字', '𐍈', 'a\u{1F600}b', 'a～b'],
  pipes: ['a|2', 'a|1', 'b|1', 'a|10', 'a|', '|a', 'a', 'a||', 'A|1', '|', ''],
};
const SORT_VARIANTS = [
  [{}, []],
  [{ sep: ':' }, ['-t:', '-k1']],
  [{ sep: ':', numeric: true, reverse: true }, ['-t:', '-k1', '-rn']],
  [{ sep: '|', reverse: true }, ['-t|', '-k1', '-r']],
  [{ numeric: true }, ['-n']],
  [{ numeric: true, reverse: true }, ['-rn']],
  [{ sep: ':', numeric: true }, ['-t:', '-k1', '-n']],
  [{ unique: true }, ['-u']],
  [{ reverse: true }, ['-r']],
];
Object.keys(SORT_SETS).forEach((setName) => {
  SORT_VARIANTS.forEach(([opts, args]) => {
    leg('SORT. ' + setName + ' with sort ' + (args.join(' ') || '(plain)'), () => {
      const lines = SORT_SETS[setName];
      const r = realSpawn('/usr/bin/sort', args, { input: lines.join('\n') + '\n', env: live.liveEnv('UTC'), maxBuffer: 1 << 24 });
      assert.equal(r.status, 0, 'sort failed: ' + String(r.stderr));
      const want = r.stdout.toString('utf8').split('\n');
      want.pop();
      assert.deepEqual(scan.sortLines(lines, opts), want);
    });
  });
});

// ---------------------------------------------------------------------------
// XARGS
// ---------------------------------------------------------------------------
const XARGS_CASES = [
  ['plain', 'hello', false],
  ['two words', 'two  words here', false],
  ['tabs', 'a\tb\t\tc', false],
  ['trailing CR (not a separator)', 'a b\r', false],
  ['newline inside', 'a\nb  c', false],
  ['UTF-8 words', 'שלום עולם', false],
  ['-n option', '-n', true],
  ['-e option', '-e', true],
  ['-n with a word', '-n x', true],
  ['single quote', "it's", true],
  ['backslash', 'back\\slash', true],
  ['double quote', 'dq"x', true],
  ['empty', '', false],
  ['only blanks', '   \t ', false],
  ['long value (over the fast limit)', 'w '.repeat(20000), true],
];
const XARGS_PROGRAM = 'for v in "$@"; do out=$(printf "%s\\n" "$v" | xargs 2>/dev/null); rc=$?; printf "%s\\0%s\\0" "$out" "$rc"; done';
function xargsLive() {
  return batch('xargs', () => {
    const r = live.runBash(XARGS_PROGRAM, XARGS_CASES.map((c) => c[1]));
    assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
    return live.nulSplit(r.stdout);
  });
}
XARGS_CASES.forEach((c, i) => {
  leg('XARGS. ' + c[0] + (c[2] ? ' (spawns)' : ' (fast path)'), () => {
    const rec = xargsLive();
    const got = scan.xargsEcho(c[1]);
    assert.equal(got.out, rec[i * 2], 'stdout');
    assert.equal(String(got.code), rec[i * 2 + 1], 'exit code');
    assert.equal(got.spawned, c[2], 'spawned flag');
  });
});

// ---------------------------------------------------------------------------
// DATE
// ---------------------------------------------------------------------------
const spawnLog = [];
function recording(fn) {
  spawnLog.length = 0;
  cp.spawnSync = function recordedSpawn(file, args) {
    spawnLog.push({ file, args: Array.isArray(args) ? args.slice() : [], tz: process.env.TZ === undefined ? 'unset' : process.env.TZ });
    return realSpawn.apply(this, arguments);
  };
  try {
    return fn();
  } finally {
    cp.spawnSync = realSpawn;
  }
}

const VALUES = live.dateValues();
const SHAPE = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$/;
let corpusLog = [];
const corpus = batch('date-corpus', () => {
  const want = live.oracleEpochs(VALUES, 'UTC');
  const got = recording(() => live.withTz('UTC', () => VALUES.map((v) => scan.dateDToEpoch(v))));
  corpusLog = spawnLog.slice();
  return { want, got };
});

VALUES.forEach((v, i) => {
  leg('DATE. TZ=UTC ' + JSON.stringify(v.length > 40 ? v.slice(0, 37) + '...' : v) + ' equals the BASE_SHA bash function', () => {
    assert.equal(String(corpus.got.value[i]), corpus.want.epochs[i]);
    assert.ok(Number.isInteger(corpus.got.value[i]), 'result is an integer');
  });
});
leg('DATE. no marker file on either side (u8x payloads are inert)', () => {
  assert.deepEqual(corpus.want.markers, [], 'BASE_SHA side created ' + corpus.want.markers.join(','));
  assert.deepEqual(corpus.got.markers, [], 'NEW side created ' + corpus.got.markers.join(','));
  [live.TEAM_PAYLOAD, live.payloadName(live.MARK_INFORMS)].forEach((p) => {
    assert.equal(corpus.got.value[VALUES.indexOf(p)], 0);
  });
});
leg('DATE. spawn recording: only date -d, date -j -f and python3 with the constant program', () => {
  assert.ok(corpusLog.length > 0, 'the corpus spawned nothing');
  const byValue = new Map();
  corpusLog.forEach((e) => {
    assert.ok(e.file === 'date' || e.file === 'python3', 'unexpected spawn of ' + e.file);
    assert.ok(e.file !== 'node');
    let kind;
    let value;
    if (e.file === 'date' && e.args[0] === '-d' && e.args.length === 3 && e.args[2] === '+%s') { kind = 'd'; value = e.args[1]; }
    else if (e.file === 'date' && e.args[0] === '-j' && e.args[1] === '-f' && e.args[2] === '%Y-%m-%d' && e.args.length === 5 && e.args[4] === '+%s') { kind = 'j'; value = e.args[3]; }
    else if (e.file === 'python3' && e.args.length === 3 && e.args[0] === '-c' && e.args[1] === scan.DATE_PY_PROGRAM) { kind = 'py'; value = e.args[2]; }
    else assert.fail('unexpected argv: ' + JSON.stringify(e));
    const k = e.tz + '\0' + value;
    if (!byValue.has(k)) byValue.set(k, []);
    byValue.get(k).push(kind);
    if (kind === 'py') assert.ok(SHAPE.test(value), 'python3 ran for a value that is not shape-valid: ' + JSON.stringify(value));
  });
  byValue.forEach((kinds, k) => {
    const full = ['d', 'j', 'py'];
    assert.deepEqual(kinds, full.slice(0, kinds.length), 'chain order for ' + JSON.stringify(k));
  });
  assert.equal(byValue.size, new Set(VALUES.filter((v) => byValue.has('UTC\0' + v))).size, 'one chain per distinct (value, TZ)');
});
leg('DATE. DATE_PY_PROGRAM equals the single-quoted program of the BASE_SHA C-2 link', () => {
  assert.equal(scan.DATE_PY_PROGRAM, live.oraclePyProgram());
});
live.GAP_PAIRS.forEach(([tz, value]) => {
  leg('DATE. DST gap ' + tz + ' ' + value + ' equals the BASE_SHA bash function', () => {
    const want = live.oracleEpochs([value], tz);
    const got = live.withTz(tz, () => scan.dateDToEpoch(value));
    assert.equal(String(got.value), want.epochs[0]);
    assert.deepEqual(want.markers.concat(got.markers), []);
  });
});
leg('DATE. years 0001 to 0099 are not mapped to 19xx (no JS date arithmetic)', () => {
  ['0001-01-01', '0050-06-01', '0099-12-31'].forEach((v) => {
    const want = live.oracleEpochs([v], 'UTC').epochs[0];
    assert.equal(String(live.withTz('UTC', () => scan.dateDToEpoch(v)).value), want);
    assert.ok(Number(want) < -50000000000, 'epoch of year 00xx is far negative: ' + want);
  });
});
leg('DATE. memoization: the same value twice under the same TZ runs one chain', () => {
  const v = '2031-02-29';
  const log = recording(() => live.withTz('UTC', () => {
    const a = scan.dateDToEpoch(v);
    const b = scan.dateDToEpoch(v);
    assert.equal(a, b);
    return a;
  }));
  assert.equal(log.value, 0);
  assert.deepEqual(spawnLog.map((e) => e.file), ['date', 'date', 'python3']);
  const before = spawnLog.length;
  recording(() => live.withTz('UTC', () => scan.dateDToEpoch(v)));
  assert.equal(spawnLog.length, 0, 'a third call spawned again (' + before + ' before)');
});
leg('DATE. TZ keying: the same value under two TZ values gives two chains and two expected results', () => {
  const v = '2027-03-14';
  const a = recording(() => live.withTz('UTC', () => scan.dateDToEpoch(v)));
  const spawnsUtc = spawnLog.length;
  const b = recording(() => live.withTz('America/Havana', () => scan.dateDToEpoch(v)));
  const spawnsHavana = spawnLog.length;
  assert.ok(spawnsUtc >= 1 && spawnsHavana >= 1, 'each TZ ran its own chain');
  assert.equal(String(a.value), live.oracleEpochs([v], 'UTC').epochs[0]);
  assert.equal(String(b.value), live.oracleEpochs([v], 'America/Havana').epochs[0]);
  assert.notEqual(a.value, b.value, 'the two zones give different epochs for the same text');
  const c = recording(() => live.withTz('America/Havana', () => scan.dateDToEpoch(v)));
  assert.equal(spawnLog.length, 0);
  assert.equal(c.value, b.value);
});
leg('DATE. source holds no JS date arithmetic for dateDToEpoch', () => {
  const src = fs.readFileSync(path.join(live.REPO, 'lib', 'core', 'room-scan.cjs'), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal(/Date\.UTC|new Date\([^)]*,[^)]*\)|Date\.parse|mktime|\.setFullYear/.test(src), false);
});

// ---------------------------------------------------------------------------
// LOCAL: dateYmdLocal and computedStamp
// ---------------------------------------------------------------------------
const LOCAL_SECONDS = [0, 1700000000, 1767225599, 1772323200, 1500000000, 951782400];
const LOCAL_PROGRAM = 'for s in "$@"; do printf "%s\\0%s\\0" "$(date -d "@$s" +%Y-%m-%d)" "$(date -u -d "@$s" +%Y-%m-%dT%H:%M:%SZ)"; done';
['UTC', 'Asia/Jerusalem', 'America/New_York', 'Pacific/Auckland'].forEach((tz) => {
  leg('LOCAL. dateYmdLocal and computedStamp under TZ=' + tz, () => {
    const r = live.runBash(LOCAL_PROGRAM, LOCAL_SECONDS.map(String), { tz });
    assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
    const rec = live.nulSplit(r.stdout);
    live.withTz(tz, () => {
      LOCAL_SECONDS.forEach((s, i) => {
        assert.equal(scan.dateYmdLocal(s * 1000), rec[i * 2], 'dateYmdLocal ' + s);
        assert.equal(scan.computedStamp(new Date(s * 1000)), rec[i * 2 + 1], 'computedStamp ' + s);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// TEST: bashTestInt
// ---------------------------------------------------------------------------
const INT_CASES = ['3', ' 3', '3 ', ' 3 ', '\t3', '3\t', '+3', '-1', '03', '3\n4', '', 'x', '99999999999999999999', '9223372036854775807',
  '9223372036854775808', '-9223372036854775808', '-9223372036854775809', '\n3', '3\n', '\r3', '3\r', '\v3', '- 3', '+ 3', '0x10',
  '1_0', '٣', '3.0', '1e3', '--3', '+-3', ' ', '0', '-0', '+0', '000000000000000000000000000000000000003'];
const INT_PROGRAM = 'for v in "$@"; do [ "$v" -gt 0 ] 2>/dev/null; a=$?; [ "$v" -lt 0 ] 2>/dev/null; b=$?; printf "%s %s\\0" "$a" "$b"; done';
leg('TEST. bashTestInt agrees with [ "$v" -gt 0 ] and [ "$v" -lt 0 ]', () => {
  const r = live.runBash(INT_PROGRAM, INT_CASES);
  assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
  const rec = live.nulSplit(r.stdout);
  assert.equal(rec.length, INT_CASES.length);
  INT_CASES.forEach((v, i) => {
    const n = scan.bashTestInt(v);
    const got = n === null ? '2 2' : (n > 0n ? '0' : '1') + ' ' + (n < 0n ? '0' : '1');
    assert.equal(got, rec[i], 'operand ' + JSON.stringify(v));
  });
});
leg('TEST. bashTestInt returns bigint or null', () => {
  assert.equal(scan.bashTestInt('3'), 3n);
  assert.equal(scan.bashTestInt('x'), null);
  assert.equal(typeof scan.bashTestInt('-4'), 'bigint');
});

// ---------------------------------------------------------------------------
// WORD: isGrepWordChar
// ---------------------------------------------------------------------------
const WORD_CHARS = [['Hebrew letter', 'א'], ['Hebrew point', 'ְ'], ['Arabic-Indic digit', '٣'], ['accented Latin', 'é'],
  ['combining acute', '́'], ['emoji', '\u{1F600}'], ['CJK', '漢'], ['underscore', '_'], ['digit', '5'], ['hyphen', '-'], ['space', ' ']];
function grepMatches(lines) {
  const f = tmpFile('word.txt', lines.join('\n') + '\n');
  const r = realSpawn('/usr/bin/grep', ['-n', '-E', '\\bB2B\\b', f], { env: live.liveEnv('UTC'), maxBuffer: 1 << 29 });
  assert.ok(r.status === 0 || r.status === 1, 'grep failed: ' + String(r.stderr));
  const set = new Set();
  r.stdout.toString('utf8').split('\n').filter(Boolean).forEach((l) => set.add(Number(l.slice(0, l.indexOf(':'))) - 1));
  return set;
}
WORD_CHARS.forEach(([label, ch]) => {
  leg('WORD. isGrepWordChar ' + label, () => {
    const before = grepMatches([ch + 'B2B']);
    const after = grepMatches(['B2B' + ch]);
    assert.equal(before.size, after.size, 'grep disagrees with itself on both sides of B2B');
    const isWord = before.size === 0;
    assert.equal(scan.isGrepWordChar(ch), isWord);
  });
});
leg('WORD. every code point: no gap in the live word set (only newer-Unicode additions may differ)', () => {
  const cps = [];
  const lines = [];
  for (let c = 1; c < 0x110000; c += 1) {
    if (c === 10 || (c >= 0xD800 && c <= 0xDFFF)) continue;
    cps.push(c);
    lines.push(String.fromCodePoint(c) + 'B2B');
  }
  const matched = grepMatches(lines);
  let extra = 0;
  cps.forEach((c, i) => {
    const liveWord = !matched.has(i);
    const mine = scan.isGrepWordChar(String.fromCodePoint(c));
    if (liveWord && !mine) assert.fail('live grep treats U+' + c.toString(16) + ' as a word character, isGrepWordChar does not');
    if (!liveWord && mine) extra += 1;
  });
  console.log('    code points the module calls word characters that this grep does not (newer Unicode, node ' + process.versions.unicode + '): ' + extra);
  assert.ok(extra < 12000, 'too many differences: ' + extra);
});

// ---------------------------------------------------------------------------
// MISC
// ---------------------------------------------------------------------------
leg('MISC. byteSort equals LC_ALL=C.UTF-8 sort on names with astral characters', () => {
  const names = SORT_SETS.utf8.concat(['mid～dle', 'mid\u{1F600}dle', 'plain', 'Plain']);
  const r = realSpawn('/usr/bin/sort', [], { input: names.join('\n') + '\n', env: live.liveEnv('UTC') });
  const want = r.stdout.toString('utf8').split('\n');
  want.pop();
  assert.deepEqual(scan.byteSort(names), want);
  assert.notDeepEqual(names.slice().sort(), want, 'JS default order must differ (astral versus U+FF5E), or the leg proves nothing');
  assert.equal(scan.byteCompare('～', '\u{1F600}') < 0, true);
});
leg('MISC. byteSort returns a new array and keeps duplicates', () => {
  const input = ['b', 'a', 'b'];
  const out = scan.byteSort(input);
  assert.deepEqual(out, ['a', 'b', 'b']);
  assert.deepEqual(input, ['b', 'a', 'b']);
});
leg('MISC. consoleLogText and stripTrailingNewlines', () => {
  assert.equal(scan.consoleLogText(undefined), 'undefined');
  assert.equal(scan.consoleLogText('a\n\n'), 'a');
  assert.equal(scan.consoleLogText('x y'), 'x y');
  assert.equal(scan.stripTrailingNewlines('a\n\n\n'), 'a');
  assert.equal(scan.stripTrailingNewlines('a\r\n'), 'a\r');
  assert.equal(scan.stripTrailingNewlines('\n\n'), '');
  assert.equal(scan.stripTrailingNewlines('a\nb'), 'a\nb');
});
leg('MISC. consoleLogText matches console.log through $(...)', () => {
  const r = realSpawn(process.execPath, ['-e', 'console.log(process.argv[1])', 'v\n\n'], { env: live.liveEnv('UTC') });
  assert.equal(stripNlTrailing(r.stdout.toString('utf8')), scan.consoleLogText('v\n\n'));
});
function stripNlTrailing(s) {
  return s.replace(/\n+$/, '');
}

live.cleanup();
if (failures > 0) {
  console.log('FAILED legs: ' + failures);
  process.exit(1);
}
console.log('all legs ok');
