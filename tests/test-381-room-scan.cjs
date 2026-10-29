'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 03 Task 2 (PERF381-03, T-381-02) -- the bounded async walk and read of
 * lib/core/room-scan.cjs, proven against live bash and live find on this host.
 *
 * fs hook (the one chosen way): this file wraps the methods of require('node:fs').promises
 * (readdir, lstat, stat, readFile, readlink) BEFORE it requires the module. The module looks the
 * methods up on that object at every call, so the wrapper counts the operations in flight, records
 * the paths and can inject a random delay. The module exports no test hook.
 *
 * Legs:
 *   pool       results land at the item index whatever the completion order
 *   fan-out    scanRoom on 200 section files: observed in-flight maximum is between 2 and 32
 *   order      random 0-5 ms delays: two runs are deep-equal and every list is byte-ordered
 *   glob       globDirs and globFiles vs the bash globs with [ -d ] and [ -f ]
 *   find       findDepth1 and findByName vs find | sort (start with and without a trailing slash,
 *              symlinked start, directory named PROFILE.md, hidden directory, symlinked directory)
 *   safety     a symlink loop and a symlink to / do not hang or recurse; no path outside the room
 *   scope      scanRoom on the large-room fixture reads nothing under GENERATED_DIR
 *   model      keys, fields, missing path
 *   readTexts  mtimes against stat(1), unreadable paths left out
 *
 * Prints "SKIP symlinks unsupported" for the symlink legs when fs.symlinkSync throws.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail. Hyphens only.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fsp = fs.promises;
const hook = { inflight: 0, max: 0, calls: 0, paths: [], delay: null };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
['readdir', 'lstat', 'stat', 'readFile', 'readlink'].forEach((m) => {
  const orig = fsp[m];
  fsp[m] = async function wrapped(...args) {
    hook.calls += 1;
    hook.paths.push(m + ' ' + String(args[0]));
    hook.inflight += 1;
    if (hook.inflight > hook.max) hook.max = hook.inflight;
    try {
      if (hook.delay) await sleep(hook.delay());
      return await orig.apply(this, args);
    } finally {
      hook.inflight -= 1;
    }
  };
});
function resetHook() {
  hook.inflight = 0;
  hook.max = 0;
  hook.calls = 0;
  hook.paths = [];
  hook.delay = null;
}

const live = require('./helpers/live-381.cjs');
const scan = require('../lib/core/room-scan.cjs');
const { buildEdgeRoom } = require('./fixtures/room-381/build-fixture.cjs');
const { buildLargeRoom, GENERATED_DIR } = require('./fixtures/large-room/build-fixture.cjs');

const legs = [];
function leg(name, fn) {
  legs.push([name, fn]);
}

const tmp = live.mkTmp('room-scan');
let seq = 0;
function sub(label) {
  const d = path.join(tmp, String((seq += 1)) + '-' + label);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function put(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data === undefined ? 'x\n' : data);
}
let symlinksOk = true;
function link(target, file) {
  try {
    fs.symlinkSync(target, file);
    return true;
  } catch (_e) {
    symlinksOk = false;
    return false;
  }
}
function withTimeout(promise, ms, what) {
  let timer;
  const guard = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(what + ' did not finish in ' + ms + ' ms (hang)')), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}
function bashList(program, args) {
  const r = live.runBash(program, args);
  assert.equal(r.status, 0, 'bash failed: ' + String(r.stderr));
  return live.nulSplit(r.stdout);
}
function isByteOrdered(list) {
  for (let i = 1; i < list.length; i += 1) {
    if (scan.byteCompare(list[i - 1], list[i]) > 0) return false;
  }
  return true;
}

const GLOB_DIRS = 'for d in "$1"/*/; do [ -d "$d" ] && printf "%s\\0" "$d"; done';
const GLOB_FILES = 'for f in "$1"/*.md; do [ -f "$f" ] && printf "%s\\0" "$f"; done';
const FIND_D1 = 'find "$1" -maxdepth 1 -name "*.md" ! -name ROOM.md ! -name STATE.md -print0 | sort -z';
const FIND_NAME = 'find "$1" -name PROFILE.md -print0 | sort -z';
const FIND_NAME_F = 'find "$1" -name PROFILE.md -type f -print0 | sort -z';

// ---------------------------------------------------------------------------
// fixtures local to this file
// ---------------------------------------------------------------------------
function buildMixDir(base) {
  const mix = path.join(base, 'mix');
  ['a', 'a-b', 'a b', 'a.b', 'a_b', 'Zed', 'שלום', '\u{1F600}', 'ｚ', '.hid', 'sub.md'].forEach((d) => {
    fs.mkdirSync(path.join(mix, d), { recursive: true });
  });
  put(path.join(mix, 'sub.md', 'inner.md'));
  ['a.md', 'B.md', 'X.MD', '.dot.md', 'notes.txt', 'a.md.bak', 'é.md', '\u{1F600}.md', 'ｚ.md', '.md', 'x y.md', 'Zed.md', 'ROOM.md', 'STATE.md'].forEach((f) => {
    put(path.join(mix, f));
  });
  link('a', path.join(mix, 'dirlink'));
  link('sub.md', path.join(mix, 'dirlink.md'));
  link('nowhere', path.join(mix, 'broken'));
  link('nowhere.md', path.join(mix, 'broken.md'));
  link('a.md', path.join(mix, 'alias.md'));
  link('a.md', path.join(mix, 'filelink'));
  link('mix', path.join(base, 'link-to-mix'));
  return mix;
}

function buildTeamTree(base) {
  const root = path.join(base, 'tree');
  const team = path.join(root, 'team');
  put(path.join(team, 'members', 'alice', 'PROFILE.md'), '---\nname: Alice\n---\n');
  put(path.join(team, '.hidden', 'x', 'PROFILE.md'), '---\nname: Hidden\n---\n');
  put(path.join(team, 'advisors', 'PROFILE.md', 'PROFILE.md'), '---\nname: Nested\n---\n');
  put(path.join(team, 'members', 'PROFILE.md.tmp'), 'tmp\n');
  put(path.join(team, 'members', 'bob', 'profile.md'), 'lower case name\n');
  link('alice', path.join(team, 'members', 'dirlink'));
  link('..', path.join(team, 'loop'));
  link('alice/PROFILE.md', path.join(team, 'members', 'PROFILE.md'));
  link('team', path.join(root, 'team-link'));
  return { root, team };
}

// ---------------------------------------------------------------------------
// pool
// ---------------------------------------------------------------------------
leg('pool: results land at the item index whatever the completion order', async () => {
  const items = Array.from({ length: 40 }, (_v, i) => i);
  const next = live.makeLcg(7);
  const out = await scan.pool(items, 5, async (x) => {
    await sleep(next() % 6);
    return x * 2;
  });
  assert.deepEqual(out, items.map((x) => x * 2));
  assert.deepEqual(await scan.pool([], 32, async () => 1), []);
  assert.deepEqual(await scan.pool([1, 2], 32, async (x) => x + 1), [2, 3]);
});
leg('pool: never more than n workers run at once', async () => {
  let inflight = 0;
  let max = 0;
  await scan.pool(Array.from({ length: 60 }, (_v, i) => i), 7, async () => {
    inflight += 1;
    max = Math.max(max, inflight);
    await sleep(2);
    inflight -= 1;
  });
  assert.ok(max <= 7 && max > 1, 'observed ' + max);
});

// ---------------------------------------------------------------------------
// glob
// ---------------------------------------------------------------------------
leg('glob: globDirs equals the bash glob */ with [ -d ]', async () => {
  const base = sub('mix');
  const mix = buildMixDir(base);
  const got = (await scan.globDirs(mix)).map((e) => e.path);
  assert.deepEqual(got, bashList(GLOB_DIRS, [mix]));
  assert.ok(got.length >= 8, 'the fixture holds directories (' + got.length + ')');
  const withSlash = (await scan.globDirs(mix + '/')).map((e) => e.path);
  assert.deepEqual(withSlash, bashList(GLOB_DIRS, [mix + '/']));
  const names = (await scan.globDirs(mix)).map((e) => e.name);
  assert.ok(isByteOrdered(names));
  assert.ok(names.indexOf('ｚ') < names.indexOf('\u{1F600}'), 'byte order puts U+FF5A before the emoji');
  assert.ok(!names.includes('.hid'), 'dot names are skipped');
  if (symlinksOk) {
    const dl = (await scan.globDirs(mix)).find((e) => e.name === 'dirlink');
    assert.equal(dl.isSymlink, true);
    assert.ok(!names.includes('broken'), 'a broken symlink is not a directory');
  }
});
leg('glob: globFiles equals the bash glob *.md with [ -f ]', async () => {
  const base = sub('mixf');
  const mix = buildMixDir(base);
  const got = (await scan.globFiles(mix)).map((e) => e.path);
  assert.deepEqual(got, bashList(GLOB_FILES, [mix]));
  const names = (await scan.globFiles(mix)).map((e) => e.name);
  assert.ok(!names.includes('X.MD') && !names.includes('.dot.md') && !names.includes('sub.md'));
  assert.ok(names.includes('a.md') && names.includes('B.md'));
  if (symlinksOk) {
    assert.ok(names.includes('alias.md'), 'a symlink to a regular file is listed');
    assert.ok(!names.includes('dirlink.md') && !names.includes('broken.md'));
  }
  assert.deepEqual((await scan.globFiles(mix + '/')).map((e) => e.path), bashList(GLOB_FILES, [mix + '/']));
});
leg('glob: the edge room sections equal the bash glob', async () => {
  const edge = buildEdgeRoom(sub('edge-glob'));
  assert.deepEqual((await scan.globDirs(edge.roomDir)).map((e) => e.path), bashList(GLOB_DIRS, [edge.roomDir]));
  assert.deepEqual((await scan.globFiles(path.join(edge.roomDir, 'problem-definition'))).map((e) => e.path),
    bashList(GLOB_FILES, [path.join(edge.roomDir, 'problem-definition')]));
});

// ---------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------
leg('find: findDepth1 equals find -maxdepth 1 -name *.md ! -name ROOM.md ! -name STATE.md | sort', async () => {
  const base = sub('find1');
  const mix = buildMixDir(base);
  const starts = [mix, mix + '/', path.join(mix, 'sub.md'), path.join(mix, 'sub.md') + '/', path.join(mix, 'a.md'), path.join(mix, 'nope'), mix + '//'];
  if (symlinksOk) {
    starts.push(path.join(base, 'link-to-mix'), path.join(base, 'link-to-mix') + '/', path.join(mix, 'dirlink.md'), path.join(mix, 'dirlink.md') + '/');
  }
  for (const start of starts) {
    const got = (await scan.findDepth1(start, { excludeNames: ['ROOM.md', 'STATE.md'] })).map((e) => e.path);
    assert.deepEqual(got, bashList(FIND_D1, [start]), 'start ' + start);
  }
  const all = await scan.findDepth1(mix, { excludeNames: ['ROOM.md', 'STATE.md'] });
  const byName = new Map(all.map((e) => [e.name, e]));
  assert.equal(byName.get('.dot.md').kind, 'file');
  assert.equal(byName.get('sub.md').kind, 'dir');
  assert.ok(byName.has('.md'), 'a file named .md matches *.md');
  if (symlinksOk) assert.equal(byName.get('alias.md').kind, 'symlink');
});
leg('find: findByName equals find -name PROFILE.md [-type f] | sort', async () => {
  const base = sub('find2');
  const t = buildTeamTree(base);
  const starts = [t.team, t.team + '/', path.join(t.team, 'members', 'alice', 'PROFILE.md'), path.join(t.team, 'nope'), path.join(t.team, 'advisors', 'PROFILE.md')];
  if (symlinksOk) starts.push(path.join(t.root, 'team-link'), path.join(t.root, 'team-link') + '/');
  for (const start of starts) {
    assert.deepEqual(await scan.findByName(start, 'PROFILE.md', { typeF: false }), bashList(FIND_NAME, [start]), 'any type, start ' + start);
    assert.deepEqual(await scan.findByName(start, 'PROFILE.md', { typeF: true }), bashList(FIND_NAME_F, [start]), '-type f, start ' + start);
  }
  const any = await scan.findByName(t.team, 'PROFILE.md', { typeF: false });
  assert.ok(any.some((p) => p.includes('/.hidden/')), 'hidden directories are searched');
  assert.ok(any.some((p) => p.endsWith('/advisors/PROFILE.md')), 'a directory named PROFILE.md is listed without -type f');
  const onlyFiles = await scan.findByName(t.team, 'PROFILE.md', { typeF: true });
  assert.ok(!onlyFiles.some((p) => p.endsWith('/advisors/PROFILE.md')));
  assert.ok(isByteOrdered(any));
});

// ---------------------------------------------------------------------------
// fan-out and order
// ---------------------------------------------------------------------------
function buildFanRoom(base, sectionsN, filesN) {
  const room = path.join(base, 'fan-room');
  for (let s = 0; s < sectionsN; s += 1) {
    for (let f = 0; f < filesN; f += 1) {
      put(path.join(room, 'sec-' + String(s).padStart(2, '0'), 'f' + String(f).padStart(3, '0') + '.md'), '---\nname: n' + f + '\n---\nbody ' + s + '/' + f + '\n');
    }
    put(path.join(room, 'sec-' + String(s).padStart(2, '0'), 'ROOM.md'), '# room\n');
  }
  return room;
}
leg('fan-out: 200 section files never exceed 32 operations in flight', async () => {
  const room = buildFanRoom(sub('fan'), 8, 25);
  resetHook();
  const m = await scan.scanRoom(room);
  const observed = hook.max;
  console.log('    observed maximum in-flight fs.promises operations: ' + observed + ' (' + hook.calls + ' calls)');
  resetHook();
  assert.equal(m.files.filter((e) => e.text !== undefined).length, 8 * 26);
  assert.ok(observed > 1, 'no concurrency observed');
  assert.ok(observed <= scan.FAN_OUT, 'in flight ' + observed + ' exceeds ' + scan.FAN_OUT);
  assert.ok(observed >= 2 && observed <= 32);
});
leg('order: random delays give deep-equal models and byte-ordered lists', async () => {
  const base = sub('order');
  const room = buildFanRoom(base, 6, 15);
  put(path.join(room, 'ｚ-sec', 'a.md'), 'wide z\n');
  put(path.join(room, '\u{1F600}-sec', 'a.md'), 'emoji\n');
  put(path.join(room, 'team', 'members', 'm1', 'PROFILE.md'), '---\nname: M1\n---\n');
  put(path.join(room, 'team', 'members', 'm2', 'PROFILE.md'), '---\nname: M2\n---\n');
  put(path.join(room, 'team', '.arch', 'm0', 'PROFILE.md'), '---\nname: M0\n---\n');
  put(path.join(room, 'meetings', '2026-01-02-b', 'metadata.yaml'));
  put(path.join(room, 'meetings', '2026-01-01-a', 'metadata.yaml'));
  put(path.join(room, 'funding', 'zeta', 'STATUS.md'), '---\nstage: applied\n---\n');
  put(path.join(room, 'funding', 'alpha', 'STATUS.md'), '---\nstage: researched\n---\n');
  put(path.join(room, 'STATE.md'), '---\nventure_stage: "Discovery"\n---\n');
  resetHook();
  const next = live.makeLcg(99);
  hook.delay = () => next() % 6;
  const first = await scan.scanRoom(room);
  const second = await scan.scanRoom(room);
  resetHook();
  assert.deepStrictEqual(first, second);
  assert.ok(isByteOrdered(first.sections.map((s) => s.name)));
  assert.ok(isByteOrdered(first.meetings.map((s) => s.name)));
  assert.ok(isByteOrdered(first.profiles.map((p) => p.path)));
  assert.ok(isByteOrdered(first.funding.map((s) => s.name)));
  const perSection = new Map();
  first.files.forEach((e) => {
    if (!perSection.has(e.section)) perSection.set(e.section, []);
    perSection.get(e.section).push(e.name);
  });
  perSection.forEach((names, section) => assert.ok(isByteOrdered(names), 'files of ' + section));
  assert.deepEqual([...perSection.keys()], first.sections.map((s) => s.name).filter((n) => perSection.has(n)), 'sections in glob order');
  assert.ok(first.sections.map((s) => s.name).indexOf('ｚ-sec') < first.sections.map((s) => s.name).indexOf('\u{1F600}-sec'));
});

// ---------------------------------------------------------------------------
// safety and scope
// ---------------------------------------------------------------------------
leg('safety: a symlink loop and a symlink to / neither hang nor recurse', async () => {
  if (!symlinksOk) {
    console.log('SKIP symlinks unsupported');
    return;
  }
  const base = sub('safety');
  const room = path.join(base, 'room');
  const outside = path.join(base, 'outside');
  put(path.join(outside, 'ext.md'), '# external top-level file\n');
  put(path.join(outside, 'deep', 'secret.md'), 'must not be read\n');
  put(path.join(room, 'sec', 'a.md'), '# a\n');
  link('/', path.join(room, 'sec', 'rootlink'));
  link('/', path.join(room, 'sec', 'rootlink.md'));
  link(outside, path.join(room, 'zlinked'));
  put(path.join(room, 'team', 'members', 'alice', 'PROFILE.md'), '---\nname: Alice\n---\n');
  link('..', path.join(room, 'team', 'loop'));
  link('..', path.join(room, 'team', 'members', 'up'));
  link(room, path.join(room, 'team', 'self'));
  resetHook();
  const m = await withTimeout(scan.scanRoom(room), 20000, 'scanRoom');
  const accessed = hook.paths.slice();
  resetHook();
  accessed.forEach((entry) => {
    const p = entry.slice(entry.indexOf(' ') + 1);
    assert.ok(p === room || p.startsWith(room + '/'), 'path outside the room root: ' + entry);
  });
  assert.ok(!accessed.some((e) => e.includes('secret.md')), 'a file below the symlinked section directory was read');
  const rl = m.files.find((e) => e.name === 'rootlink.md');
  assert.equal(rl.kind, 'symlink');
  assert.equal(rl.targetKind, 'dir');
  assert.equal(rl.text, undefined);
  const ext = m.files.find((e) => e.section === 'zlinked' && e.name === 'ext.md');
  assert.ok(ext && ext.text === '# external top-level file\n', 'the top-level .md of a symlinked section is read like the bash glob does');
  assert.ok(!m.files.some((e) => e.name === 'secret.md'));
  assert.deepEqual(m.profiles.map((p) => p.path), [path.join(room, 'team', 'members', 'alice', 'PROFILE.md')]);
});
leg('scope: scanRoom on the large-room fixture reads nothing under GENERATED_DIR', async () => {
  const built = buildLargeRoom(sub('large'));
  const generated = path.join(built.roomDir, GENERATED_DIR);
  resetHook();
  const t0 = Date.now();
  const m = await scan.scanRoom(built.roomDir);
  const ms = Date.now() - t0;
  const accessed = hook.paths.slice();
  resetHook();
  const hit = accessed.filter((e) => {
    const p = e.slice(e.indexOf(' ') + 1);
    return p === generated || p.startsWith(generated + '/');
  });
  assert.deepEqual(hit, [], 'paths under the generated directory were touched');
  const gen = m.files.find((e) => e.name === path.basename(generated));
  assert.ok(gen && gen.kind === 'dir' && gen.text === undefined, 'the generated directory is one depth-1 entry');
  assert.ok(m.files.length < 20, 'depth-1 entries only (' + m.files.length + ')');
  console.log('    large room scanned in ' + ms + ' ms, ' + accessed.length + ' fs calls');
});

// ---------------------------------------------------------------------------
// model
// ---------------------------------------------------------------------------
leg('model: scanRoom on the edge room', async () => {
  const edge = buildEdgeRoom(sub('edge-model'));
  const m = await scan.scanRoom(edge.roomDir);
  assert.deepEqual(Object.keys(m).sort(), ['exists', 'files', 'funding', 'meetings', 'profiles', 'root', 'rootFiles', 'sections']);
  assert.equal(m.root, edge.roomDir);
  assert.equal(m.exists, true);
  assert.deepEqual(m.sections.map((s) => s.path), bashList(GLOB_DIRS, [edge.roomDir]));
  assert.deepEqual(m.meetings.map((s) => s.name), ['2026-01-10-kickoff', '2026-02-01-review']);
  assert.deepEqual(m.profiles.map((p) => p.path), bashList(FIND_NAME, [path.join(edge.roomDir, 'team')]));

  const entry = (section, name) => m.files.find((e) => e.section === section && e.name === name);
  const pd1 = entry('problem-definition', 'pd-1.md');
  assert.equal(pd1.kind, 'file');
  assert.ok(pd1.text.startsWith('---\nspeaker: Alice Ade\n'));
  assert.equal(pd1.buf.toString('utf8'), pd1.text);
  assert.equal(typeof pd1.lmtimeNs, 'bigint');
  assert.equal(typeof pd1.mtimeMs, 'number');
  assert.equal(pd1.path, edge.roomDir + '/problem-definition/pd-1.md');
  assert.ok(entry('problem-definition', 'pd-2.md').text.includes('\r\n'), 'CRLF bytes are kept');
  assert.equal(entry('problem-definition', '.hidden.md').text, undefined, 'a dotfile is listed but not read');
  assert.equal(entry('problem-definition', '.hidden.md').kind, 'file');
  assert.ok(entry('problem-definition', 'X.MD').text.startsWith('# Upper case'), 'any-case .md is read');
  assert.equal(entry('problem-definition', 'sub.md').kind, 'dir');
  assert.equal(entry('problem-definition', 'sub.md').text, undefined);
  assert.equal(entry('problem-definition', 'ROOM.md').kind, 'file');
  if (edge.symlinks) {
    const alias = entry('problem-definition', 'alias.md');
    assert.equal(alias.kind, 'symlink');
    assert.equal(alias.targetKind, 'file');
    assert.ok(alias.text.startsWith('---\nspeaker: Alice Ade\n'), 'a symlink to a regular file is read');
    assert.ok(m.sections.find((s) => s.name === 'zz-linked').isSymlink);
    assert.ok(entry('zz-linked', 'n-1.md').text.startsWith('---\nmethodology: notes'));
  }
  assert.ok(!m.sections.some((s) => s.name === '.hidden-section'));
  assert.equal(m.files.filter((e) => e.section === '.hidden-section').length, 0);

  const prof = (rel) => m.profiles.find((p) => p.path.endsWith(rel));
  assert.equal(prof('/team/members/PROFILE.md').kind, 'dir');
  assert.equal(prof('/team/members/PROFILE.md').text, undefined);
  assert.ok(prof('/team/members/frank/PROFILE.md').text.includes('\r\n'));
  assert.ok(prof('/team/.archived/eve/PROFILE.md').text.startsWith('---\nname: Eve Ex'));
  assert.ok(prof('/team/members/alice/PROFILE.md').text.startsWith('---\nname: Alice Ade'));

  assert.deepEqual(m.funding.map((f) => f.name), ['alpha', 'beta', 'gamma']);
  assert.ok(m.funding[0].status.text.startsWith('---\nstage: researched'));
  assert.equal(m.funding[2].status, null);
  assert.equal(m.funding[0].path, edge.roomDir + '/funding/alpha/');

  assert.ok(m.rootFiles['STATE.md'].text.startsWith('---\nventure_stage: "Discovery"'));
});
leg('model: a missing path gives exists false and empty lists', async () => {
  const m = await scan.scanRoom(path.join(tmp, 'does-not-exist-381'));
  assert.equal(m.exists, false);
  ['sections', 'files', 'meetings', 'profiles', 'funding'].forEach((k) => assert.deepEqual(m[k], []));
  assert.deepEqual(m.rootFiles, { 'STATE.md': null });
  const f = path.join(tmp, 'plain-file.txt');
  put(f);
  assert.equal((await scan.scanRoom(f)).exists, false, 'a file is not a room');
});
leg('model: a room with no team, meetings, funding or STATE.md', async () => {
  const room = path.join(sub('bare'), 'room');
  put(path.join(room, 'sec', 'a.md'), 'a\n');
  const m = await scan.scanRoom(room);
  assert.equal(m.exists, true);
  assert.deepEqual(m.meetings, []);
  assert.deepEqual(m.profiles, []);
  assert.deepEqual(m.funding, []);
  assert.deepEqual(m.rootFiles, { 'STATE.md': null });
  assert.equal(m.files.length, 1);
});

// ---------------------------------------------------------------------------
// readTexts
// ---------------------------------------------------------------------------
leg('readTexts: mtimes agree with stat(1), unreadable paths are left out', async () => {
  const base = sub('texts');
  const file = path.join(base, 'f.md');
  const dir = path.join(base, 'dir.md');
  put(file, 'hello ש\n');
  fs.mkdirSync(dir);
  fs.utimesSync(file, 1700000000.5, 1700000000.5);
  const paths = [file, dir, path.join(base, 'missing.md')];
  let alias = null;
  if (symlinksOk) {
    alias = path.join(base, 'alias.md');
    link('f.md', alias);
    fs.lutimesSync(alias, 1600000000.25, 1600000000.25);
    paths.push(alias);
  }
  const bad = path.join(base, 'bad.md');
  fs.writeFileSync(bad, Buffer.from([0x61, 0xff, 0x00, 0x62]));
  paths.push(bad);
  const map = await scan.readTexts(paths);
  assert.deepEqual([...map.keys()].sort(), paths.filter((p) => p !== dir && !p.endsWith('missing.md')).sort());
  const r = live.runBash('for f in "$@"; do printf "%s\\0%s\\0" "$(stat -c %.9Y "$f")" "$(stat -L -c %Y "$f")"; done', [file].concat(alias ? [alias] : []));
  assert.equal(r.status, 0, String(r.stderr));
  const rec = live.nulSplit(r.stdout);
  const got = map.get(file);
  assert.equal(got.text, 'hello ש\n');
  assert.equal(got.lmtimeNs, BigInt(rec[0].replace('.', '')));
  assert.equal(Math.floor(got.mtimeMs / 1000), Number(rec[1]));
  if (alias) {
    const a = map.get(alias);
    assert.equal(a.lmtimeNs, BigInt(rec[2].replace('.', '')), 'lmtimeNs is the symlink own time');
    assert.equal(Math.floor(a.mtimeMs / 1000), Number(rec[3]), 'mtimeMs follows the symlink');
    assert.notEqual(a.lmtimeNs, got.lmtimeNs);
  }
  const b = map.get(bad);
  assert.equal(b.text, 'a�\u0000b', 'invalid UTF-8 becomes U+FFFD and NUL is kept');
  assert.ok(Buffer.isBuffer(b.buf) && b.buf.length === 4);
});

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
(async () => {
  let failures = 0;
  for (const [name, fn] of legs) {
    try {
      await fn();
      console.log('ok - ' + name);
    } catch (err) {
      failures += 1;
      console.log('not ok - ' + name);
      console.log('    ' + String(err && err.stack ? err.stack : err).split('\n').slice(0, 14).join('\n    '));
    }
  }
  live.cleanup();
  if (failures > 0) {
    console.log('FAILED legs: ' + failures);
    process.exit(1);
  }
  console.log('all legs ok');
})();
