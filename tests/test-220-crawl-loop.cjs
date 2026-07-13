'use strict';
// Phase 220-04 -- watched-sources registry + url-ingest-crawl cadence step
// (REQ-3: the crawl-and-learn loop, offline fixture acceptance).
//
// SEAM (documented per 220-04-PLAN Task 3): the crawl step is exercised
// in-process through the runner's exported urlIngestCrawlStep(roomDir, opts)
// function - the EXACT function main() awaits - with opts._fetchCorpus flowing
// into ingestUrl's sanctioned injectable seam (the source-lens-driver
// precedent). Fully hermetic: zero network, zero LLM; the run-all-220
// zero-network preload applies when run through the aggregator.
//
// Registry sections (Task 1, RED-first):
//   R1: readWatchedSources on a missing file returns { sources: [] } (no
//       throw); on a malformed file returns { sources: [] } and never crashes
//   R2: selectDueSources returns only enabled sources whose cadence window
//       elapsed (fixture clock injected via the now param - deterministic,
//       zero wall-clock flake); a disabled source is never due
//   R3: updateSourceState patches one source's {last_content_sha, last_run,
//       etag, last_modified} atomically (write-temp-rename; no .tmp residue)
//       and leaves sibling sources byte-identical
//   R4: schema round-trip - a registry written by updateSourceState re-reads
//       validating against the 220-04 interfaces contract (keys + enums)
// plus the Task 1 source gates (zero network require, zero bare 219 token,
// zero em-dashes in the module).
//
// Crawl sections (Task 3) extend this same file - the 219-03 single-test-file
// discipline; the verify command exists from Task 1 onward.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const WATCHED_PATH = path.join(REPO_ROOT, 'lib', 'core', 'watched-sources.cjs');

let pass = 0;
let total = 0;
const failures = [];
async function check(label, fn) {
  total += 1;
  try {
    await fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

function tmpRoom(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-220-crawl-' + tag + '-'));
}

function writeRegistry(roomDir, registry) {
  const dir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'watched-sources.json'),
    JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

function readRegistryRaw(roomDir) {
  return JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'watched-sources.json'), 'utf8'));
}

function makeSource(over) {
  return Object.assign({
    id: 'src',
    url: 'https://example.com/feed',
    kind: 'page',
    cadence: 'weekly',
    enabled: true,
    etag: null,
    last_modified: null,
    last_content_sha: null,
    last_run: null,
    note: 'fixture source',
  }, over || {});
}

const HOURS = 3600 * 1000;
const DAYS = 24 * HOURS;

async function registrySections() {
  const watched = require(WATCHED_PATH);
  const { readWatchedSources, selectDueSources, updateSourceState } = watched;

  // ---------- R1: defensive read ----------
  await check('R1a: missing registry file -> { sources: [] }, no throw', () => {
    const room = tmpRoom('r1a');
    const reg = readWatchedSources(room);
    assert.ok(reg && Array.isArray(reg.sources), 'sources array present');
    assert.equal(reg.sources.length, 0, 'empty sources');
  });

  await check('R1b: malformed registry file -> { sources: [] }, never crashes', () => {
    const room = tmpRoom('r1b');
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(room, '.mindrian', 'watched-sources.json'), 'not json {{{', 'utf8');
    const reg = readWatchedSources(room);
    assert.ok(reg && Array.isArray(reg.sources), 'sources array present on malformed file');
    assert.equal(reg.sources.length, 0, 'empty sources on malformed file');
  });

  await check('R1c: non-object / wrong-shape JSON -> { sources: [] }', () => {
    const room = tmpRoom('r1c');
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(room, '.mindrian', 'watched-sources.json'), '[1,2,3]', 'utf8');
    const reg = readWatchedSources(room);
    assert.ok(reg && Array.isArray(reg.sources) && reg.sources.length === 0);
  });

  // ---------- R2: due selection (deterministic injected clock) ----------
  const NOW = new Date('2026-07-13T12:00:00Z');
  const iso = (msAgo) => new Date(NOW.getTime() - msAgo).toISOString();

  await check('R2a: cadence windows honored (daily 24h, weekly 7d, monthly 30d)', () => {
    const registry = {
      schema_version: 1,
      max_ingests_per_run: 2,
      sources: [
        makeSource({ id: 'daily-due', cadence: 'daily', last_run: iso(25 * HOURS) }),
        makeSource({ id: 'daily-fresh', cadence: 'daily', last_run: iso(2 * HOURS) }),
        makeSource({ id: 'weekly-due', cadence: 'weekly', last_run: iso(8 * DAYS) }),
        makeSource({ id: 'weekly-fresh', cadence: 'weekly', last_run: iso(3 * DAYS) }),
        makeSource({ id: 'monthly-due', cadence: 'monthly', last_run: iso(31 * DAYS) }),
        makeSource({ id: 'monthly-fresh', cadence: 'monthly', last_run: iso(10 * DAYS) }),
      ],
    };
    const due = selectDueSources(registry, NOW).map((s) => s.id);
    assert.deepEqual(due, ['daily-due', 'weekly-due', 'monthly-due']);
  });

  await check('R2b: never-run (last_run null) enabled source is due; disabled never due', () => {
    const registry = {
      schema_version: 1,
      sources: [
        makeSource({ id: 'never-run', last_run: null }),
        makeSource({ id: 'disabled-never-run', enabled: false, last_run: null }),
        makeSource({ id: 'disabled-stale', enabled: false, last_run: iso(365 * DAYS) }),
      ],
    };
    const due = selectDueSources(registry, NOW).map((s) => s.id);
    assert.deepEqual(due, ['never-run'], 'disabled sources never due regardless of staleness');
  });

  await check('R2c: unknown cadence defaults to the weekly window (documented normalization)', () => {
    const room = tmpRoom('r2c');
    writeRegistry(room, {
      schema_version: 1,
      sources: [
        makeSource({ id: 'odd-due', cadence: 'hourly', last_run: iso(8 * DAYS) }),
        makeSource({ id: 'odd-fresh', cadence: 'hourly', last_run: iso(3 * DAYS) }),
      ],
    });
    const due = selectDueSources(readWatchedSources(room), NOW).map((s) => s.id);
    assert.deepEqual(due, ['odd-due'], 'unknown cadence behaves as weekly');
  });

  await check('R2d: selectDueSources is pure (registry object in, no disk IO required)', () => {
    const registry = { schema_version: 1, sources: [makeSource({ id: 'pure', last_run: null })] };
    const before = JSON.stringify(registry);
    const due = selectDueSources(registry, NOW);
    assert.equal(due.length, 1);
    assert.equal(JSON.stringify(registry), before, 'input registry not mutated');
  });

  // ---------- R3: atomic per-source state update ----------
  await check('R3a: updateSourceState patches exactly the allowed state fields on one source', () => {
    const room = tmpRoom('r3a');
    writeRegistry(room, {
      schema_version: 1,
      generated_note: 'fixture',
      max_ingests_per_run: 2,
      sources: [
        makeSource({ id: 'src-a', url: 'https://a.example.com/x' }),
        makeSource({ id: 'src-b', url: 'https://b.example.com/x' }),
        makeSource({ id: 'src-c', url: 'https://c.example.com/x' }),
      ],
    });
    const beforeRaw = readRegistryRaw(room);
    const res = updateSourceState(room, 'src-b', {
      last_content_sha: 'f'.repeat(64),
      last_run: NOW.toISOString(),
      etag: 'W/"abc"',
      last_modified: 'Sun, 12 Jul 2026 00:00:00 GMT',
    });
    assert.ok(res && res.ok === true, 'update reports ok: ' + JSON.stringify(res));
    const after = readRegistryRaw(room);
    const b = after.sources.find((s) => s.id === 'src-b');
    assert.equal(b.last_content_sha, 'f'.repeat(64));
    assert.equal(b.last_run, NOW.toISOString());
    assert.equal(b.etag, 'W/"abc"');
    assert.equal(b.last_modified, 'Sun, 12 Jul 2026 00:00:00 GMT');
    // Identity fields on the patched source untouched.
    assert.equal(b.url, 'https://b.example.com/x');
    assert.equal(b.note, 'fixture source');
    // Siblings byte-identical (serialized form).
    for (const id of ['src-a', 'src-c']) {
      const pre = JSON.stringify(beforeRaw.sources.find((s) => s.id === id));
      const post = JSON.stringify(after.sources.find((s) => s.id === id));
      assert.equal(post, pre, 'sibling ' + id + ' byte-preserved');
    }
    // Header fields preserved.
    assert.equal(after.schema_version, beforeRaw.schema_version);
    assert.equal(after.generated_note, beforeRaw.generated_note);
    assert.equal(after.max_ingests_per_run, beforeRaw.max_ingests_per_run);
  });

  await check('R3b: atomic write-temp-rename, zero .tmp residue', () => {
    const room = tmpRoom('r3b');
    writeRegistry(room, { schema_version: 1, sources: [makeSource({ id: 'solo' })] });
    updateSourceState(room, 'solo', { last_run: NOW.toISOString() });
    const residue = fs.readdirSync(path.join(room, '.mindrian')).filter((n) => n.includes('.tmp'));
    assert.deepEqual(residue, [], 'no temp residue in .mindrian/');
  });

  await check('R3c: unknown id / disallowed patch keys are refused typed (never a throw)', () => {
    const room = tmpRoom('r3c');
    writeRegistry(room, { schema_version: 1, sources: [makeSource({ id: 'solo' })] });
    const miss = updateSourceState(room, 'no-such-source', { last_run: NOW.toISOString() });
    assert.ok(miss && miss.ok === false, 'unknown id -> ok:false');
    // Disallowed keys (url rewrite attempt) never land.
    updateSourceState(room, 'solo', { url: 'https://evil.example.com/', last_run: NOW.toISOString() });
    const after = readRegistryRaw(room);
    assert.equal(after.sources[0].url, 'https://example.com/feed', 'identity fields not patchable');
    assert.equal(after.sources[0].last_run, NOW.toISOString(), 'allowed key still applied');
  });

  // ---------- R4: schema round-trip against the interfaces contract ----------
  await check('R4: written registry re-reads valid against the interfaces contract', () => {
    const room = tmpRoom('r4');
    writeRegistry(room, {
      schema_version: 1,
      generated_note: 'Phase 220 watched-sources registry. Room-level. No em-dashes.',
      max_ingests_per_run: 3,
      sources: [
        makeSource({ id: 'a-rss', kind: 'rss', cadence: 'daily' }),
        makeSource({ id: 'b-repo', kind: 'repo', cadence: 'monthly' }),
        makeSource({ id: 'c-weird', kind: 'mystery', cadence: 'sometimes' }),
      ],
    });
    updateSourceState(room, 'a-rss', { last_content_sha: 'a'.repeat(64), last_run: NOW.toISOString() });
    const reg = readWatchedSources(room);
    assert.equal(reg.schema_version, 1);
    assert.equal(reg.max_ingests_per_run, 3, 'cap override survives the round-trip');
    assert.equal(reg.sources.length, 3);
    const KINDS = new Set(['rss', 'repo', 'paper-feed', 'page']);
    const CADENCES = new Set(['daily', 'weekly', 'monthly']);
    for (const s of reg.sources) {
      assert.equal(typeof s.id, 'string');
      assert.equal(typeof s.url, 'string');
      assert.ok(KINDS.has(s.kind), 'kind in enum: ' + s.kind);
      assert.ok(CADENCES.has(s.cadence), 'cadence in enum: ' + s.cadence);
      assert.equal(typeof s.enabled, 'boolean');
      for (const k of ['etag', 'last_modified', 'last_content_sha', 'last_run']) {
        assert.ok(s[k] === null || typeof s[k] === 'string', k + ' null-or-string');
      }
    }
    // Unknown enums normalized on read (documented in the module header).
    const weird = reg.sources.find((s) => s.id === 'c-weird');
    assert.equal(weird.kind, 'page', 'unknown kind -> page');
    assert.equal(weird.cadence, 'weekly', 'unknown cadence -> weekly');
    // The patched source carries its new state through the read path.
    const a = reg.sources.find((s) => s.id === 'a-rss');
    assert.equal(a.last_content_sha, 'a'.repeat(64));
  });

  // ---------- Task 1 source gates (comment-filtered) ----------
  const moduleSrc = fs.readFileSync(WATCHED_PATH, 'utf8');
  const moduleCode = moduleSrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  await check('GATE: watched-sources.cjs never egresses (zero fetch/http require)', () => {
    assert.equal(/require\(['"]node:https?['"]\)/.test(moduleCode), false, 'no node http/https require');
    assert.equal(/require\([^)]*research-corpus/.test(moduleCode), false, 'no fetch chokepoint require');
    assert.equal(/\bfetchCorpus\b/.test(moduleCode), false, 'no fetchCorpus reference');
    assert.equal(/\bfetch\s*\(/.test(moduleCode), false, 'no global fetch call');
  });

  await check('GATE: zero bare 219 token in watched-sources.cjs (name-collision rule)', () => {
    const naming = 'har' + 'vest';
    assert.equal(new RegExp('\\b' + naming, 'i').test(moduleSrc), false, 'this plan speaks watched-source');
  });

  await check('GATE: zero em-dashes in watched-sources.cjs (CLAUDE.md HARD RULE)', () => {
    assert.equal(/—/.test(moduleSrc), false, 'hyphens only');
  });
}

async function main() {
  console.log('registry sections (Task 1):');
  await registrySections();

  console.log('');
  console.log('test-220-crawl-loop: ' + pass + '/' + total + ' passed');
  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('test-220-crawl-loop crashed:', e && e.stack);
  process.exit(1);
});
