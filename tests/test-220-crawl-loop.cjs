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
// Crawl sections (Task 3, REQ-3 acceptance):
//   C1: SPEC ACCEPTANCE VERBATIM - a fixture registry with one changed + one
//       unchanged source ingests EXACTLY one artifact under cap 2
//   C2: PROVENANCE - the cadence-ingested artifact carries ingest_origin
//       'cadence' in frontmatter AND ledger; engine_mode reads 'engine'
//   C3: STATE - changed source gains last_content_sha + last_run; unchanged
//       gains last_run only; sibling fields byte-preserved
//   C4: CAP - three due+changed sources, default cap 2 -> exactly 2 ingests,
//       the third's last_run NOT advanced; registry override cap 1 honored
//   C5: DEGRADE - a stub that throws mid-batch degrades the step (advisory),
//       prior ingests intact, failed source state untouched; the step NEVER
//       throws (null room) and its call site sits inside main's steps
//       assembly (exit path structural assertion)
//   C6: NEVER-AUTO-QUALIFIED - zero opportunity-lifecycle writes after the
//       crawl (the crawl files knowledge; 219's gates own qualification)
//   C7: NAME-COLLISION + D-10 GATES - comment-filtered greps: zero bare 219
//       token across the 220 modules + the new runner block; zero 'llm_manual'
//       in the new runner block; SEED-031 probe present and require-guarded
//   C8: the run-all-220 crawl leg flips SKIP -> PASS (asserted by the harness
//       run in the Task 3 verify command, not in-process here)
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

// ---------------------------------------------------------------------------
// Crawl sections (Task 3)
// ---------------------------------------------------------------------------

const RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'scout-cadence-runner.cjs');
const URL_INGEST_PATH = path.join(REPO_ROOT, 'lib', 'core', 'url-ingest.cjs');
const SENSOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-url-ingest.cjs');
const SESSION = 'fixture-220-crawl';
const CRAWL_NOW = new Date('2026-07-13T09:00:00Z');

// Entity-bearing fixture markdown (the 219-05 / 220-02 fixture precedent):
// TitleCase proper-noun runs under a competitor-leaning heading so the tier-1
// extractor lands proposed entities deterministically. Distinct body per
// source so every content sha differs.
function pageMarkdown(name) {
  return [
    '## Competitors',
    '',
    name + ' Dynamics announced a partnership with Meridian Robotics to',
    'deploy photonic interconnects across evacuated freight corridors.',
    '',
  ].join('\n');
}

// Multi-URL extract stub speaking the exact Plan 01 legacy envelope; a page
// with { explode: true } throws (the C5 mid-batch failure).
function pageStub(map) {
  return function stub(args) {
    assert.equal(args.source, 'tavily-extract', 'stub only speaks tavily-extract');
    const page = map[args.query];
    if (!page) throw new Error('unexpected crawl url: ' + args.query);
    if (page.explode) throw new Error('stub exploded mid-batch');
    return {
      ok: true,
      provider: {
        id: 'tavily-extract',
        status: 'ok',
        reason: null,
        counts: { urls_requested: 1, urls_succeeded: 1 },
      },
      results: [{ url: args.query, markdown: page.markdown, title: page.title }],
    };
  };
}

function sha256(text) {
  return require('node:crypto').createHash('sha256').update(text).digest('hex');
}

function countArtifacts(roomDir) {
  const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const db = openRoomDb(roomDir);
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_artifact'").get().n;
  } finally {
    closeRoomDb(db);
  }
}

// Opportunity-lifecycle marker snapshot (C6): counts rows whose properties
// carry qualification-lifecycle vocabulary. The crawl must add ZERO.
function lifecycleMarkers(roomDir) {
  const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const db = openRoomDb(roomDir);
  try {
    const n = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE properties LIKE '%qualif%' OR properties LIKE '%explored%'").get().n;
    const e = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE properties LIKE '%qualif%' OR properties LIKE '%explored%'").get().n;
    return n + e;
  } finally {
    closeRoomDb(db);
  }
}

function fixtureRoom(tag) {
  const { buildFixtureRoom } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-219.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-220-crawl-' + tag + '-'));
  return buildFixtureRoom(tmp).roomDir;
}

async function crawlSections() {
  const { urlIngestCrawlStep } = require(RUNNER_PATH);
  const { ingestUrl } = require(URL_INGEST_PATH);
  const { parseFrontmatter } = require(path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs'));

  const URL_A = 'https://alpha.example.com/feed';
  const URL_B = 'https://beta.example.com/feed';
  const MD_A = pageMarkdown('Quantalink');
  const MD_B = pageMarkdown('Halcyon');

  // ---------- C1: SPEC acceptance verbatim ----------
  const room1 = fixtureRoom('spec');
  // Pre-ingest source B so its stub bytes hash-match the room's ground truth:
  // the crawl must read it as UNCHANGED (no_op).
  const pre = await ingestUrl(room1, URL_B, {
    _fetchCorpus: pageStub({ [URL_B]: { markdown: MD_B, title: 'Beta Feed' } }),
    sessionId: SESSION,
  });
  assert.equal(pre.outcome, 'filed', 'fixture pre-seed must file: ' + JSON.stringify(pre));
  writeRegistry(room1, {
    schema_version: 1,
    generated_note: 'Phase 220 crawl fixture. No em-dashes.',
    max_ingests_per_run: 2,
    sources: [
      makeSource({ id: 'alpha', url: URL_A, cadence: 'daily', last_run: null }),
      makeSource({ id: 'beta', url: URL_B, cadence: 'daily', last_run: null }),
    ],
  });
  const artifactsBefore1 = countArtifacts(room1);
  const markersBefore1 = lifecycleMarkers(room1);
  const oppSidechannel = path.join(room1, '.mindrian', 'last-opportunity-' + 'har' + 'vest.json');
  const oppSidechannelBefore = fs.existsSync(oppSidechannel);
  const run1 = await urlIngestCrawlStep(room1, {
    sessionId: SESSION,
    now: CRAWL_NOW,
    _fetchCorpus: pageStub({
      [URL_A]: { markdown: MD_A, title: 'Alpha Feed' },
      [URL_B]: { markdown: MD_B, title: 'Beta Feed' },
    }),
  });

  await check('C1a: one changed + one unchanged source -> EXACTLY one new artifact (SPEC REQ-3 verbatim)', () => {
    assert.equal(countArtifacts(room1), artifactsBefore1 + 1,
      'room.db artifact count delta must be exactly 1');
  });

  await check('C1b: step reports 1 ingested, 1 unchanged, 0 failed under cap 2, status ok', () => {
    assert.equal(run1.step.name, 'url-ingest-crawl');
    assert.equal(run1.step.status, 'ok', JSON.stringify(run1.step));
    assert.equal(run1.step.exit, 0);
    assert.equal(run1.step.stdout, '1 ingested, 1 unchanged, 0 failed, cap 2');
  });

  // ---------- C2: cadence provenance ----------
  await check('C2: the crawled artifact carries ingest_origin cadence (frontmatter + ledger), engine_mode engine', () => {
    const ledger = JSON.parse(fs.readFileSync(path.join(room1, '.mindrian', 'url-ingest-ledger.json'), 'utf8'));
    const entry = ledger.entries[URL_A];
    assert.ok(entry, 'ledger entry for the crawled source');
    assert.equal(entry.ingest_origin, 'cadence', 'ledger provenance names the origin');
    const fm = parseFrontmatter(fs.readFileSync(path.join(room1, entry.artifact_path), 'utf8'));
    assert.equal(fm.ingest_origin, 'cadence', 'frontmatter provenance names the origin');
    assert.equal(fm.engine_mode, 'engine', 'never the manual rung from cadence (D-10)');
    assert.equal(fm.original_url, URL_A);
  });

  // ---------- C3: registry state advance ----------
  await check('C3: changed source gains sha+last_run; unchanged gains last_run only; siblings preserved', () => {
    const reg = readRegistryRaw(room1);
    const a = reg.sources.find((s) => s.id === 'alpha');
    const b = reg.sources.find((s) => s.id === 'beta');
    assert.equal(a.last_content_sha, sha256(MD_A), 'changed source records the new content sha');
    assert.equal(a.last_run, CRAWL_NOW.toISOString(), 'changed source last_run advanced');
    assert.equal(b.last_run, CRAWL_NOW.toISOString(), 'unchanged source last_run advanced');
    assert.equal(b.last_content_sha, null, 'no_op updates last_run ONLY (plan interfaces rule)');
    // Identity fields byte-preserved on both.
    assert.equal(a.url, URL_A);
    assert.equal(b.url, URL_B);
    assert.equal(a.kind, 'page');
    assert.equal(b.note, 'fixture source');
  });

  // ---------- C6: never auto-qualified (asserted on the C1 room) ----------
  await check('C6: zero opportunity-lifecycle writes after the crawl (Part 3; 219 owns qualification)', () => {
    assert.equal(lifecycleMarkers(room1), markersBefore1,
      'no qualified/explored lifecycle state minted anywhere in room.db');
    assert.equal(fs.existsSync(oppSidechannel), oppSidechannelBefore,
      'the 219 producer side-channel untouched by the crawl');
  });

  // ---------- C4: the D-06 regulator cap ----------
  const room2 = fixtureRoom('cap');
  const URLS = ['https://one.example.com/x', 'https://two.example.com/x', 'https://three.example.com/x'];
  const MDS = [pageMarkdown('Firstline'), pageMarkdown('Secondline'), pageMarkdown('Thirdline')];
  writeRegistry(room2, {
    schema_version: 1,
    sources: URLS.map((u, i) => makeSource({ id: 'cap-src-' + i, url: u, cadence: 'daily', last_run: null })),
    // max_ingests_per_run omitted -> the D-06 default (2) governs.
  });
  const artifactsBefore2 = countArtifacts(room2);
  const run2 = await urlIngestCrawlStep(room2, {
    sessionId: SESSION,
    now: CRAWL_NOW,
    _fetchCorpus: pageStub({
      [URLS[0]]: { markdown: MDS[0], title: 'One' },
      [URLS[1]]: { markdown: MDS[1], title: 'Two' },
      [URLS[2]]: { markdown: MDS[2], title: 'Three' },
    }),
  });

  await check('C4a: three due+changed sources under the default cap 2 -> exactly 2 ingests', () => {
    assert.equal(run2.step.stdout, '2 ingested, 0 unchanged, 0 failed, cap 2');
    assert.equal(countArtifacts(room2), artifactsBefore2 + 2, 'exactly two new artifacts');
  });

  await check('C4b: the third source waits for the next run (last_run NOT advanced, no ledger entry)', () => {
    const reg = readRegistryRaw(room2);
    const third = reg.sources.find((s) => s.id === 'cap-src-2');
    assert.equal(third.last_run, null, 'skipped source state untouched');
    assert.equal(third.last_content_sha, null);
    const ledger = JSON.parse(fs.readFileSync(path.join(room2, '.mindrian', 'url-ingest-ledger.json'), 'utf8'));
    assert.equal(Object.prototype.hasOwnProperty.call(ledger.entries, URLS[2]), false,
      'the capped-out source never fetched');
  });

  await check('C4c: the cap is registry-overridable (max_ingests_per_run 1 -> exactly 1 attempt)', async () => {
    const room3 = fixtureRoom('cap1');
    writeRegistry(room3, {
      schema_version: 1,
      max_ingests_per_run: 1,
      sources: [
        makeSource({ id: 'ov-a', url: URLS[0], cadence: 'daily', last_run: null }),
        makeSource({ id: 'ov-b', url: URLS[1], cadence: 'daily', last_run: null }),
      ],
    });
    const run3 = await urlIngestCrawlStep(room3, {
      sessionId: SESSION,
      now: CRAWL_NOW,
      _fetchCorpus: pageStub({
        [URLS[0]]: { markdown: MDS[0], title: 'One' },
        [URLS[1]]: { markdown: MDS[1], title: 'Two' },
      }),
    });
    assert.equal(run3.step.stdout, '1 ingested, 0 unchanged, 0 failed, cap 1');
    const reg = readRegistryRaw(room3);
    assert.equal(reg.sources.find((s) => s.id === 'ov-b').last_run, null, 'second source waits');
  });

  // ---------- C5: advisory degrade ----------
  const room4 = fixtureRoom('degrade');
  writeRegistry(room4, {
    schema_version: 1,
    sources: [
      makeSource({ id: 'good', url: URL_A, cadence: 'daily', last_run: null }),
      makeSource({ id: 'bad', url: URL_B, cadence: 'daily', last_run: null }),
    ],
  });
  const artifactsBefore4 = countArtifacts(room4);
  const run4 = await urlIngestCrawlStep(room4, {
    sessionId: SESSION,
    now: CRAWL_NOW,
    _fetchCorpus: pageStub({
      [URL_A]: { markdown: MD_A, title: 'Alpha Feed' },
      [URL_B]: { explode: true },
    }),
  });

  await check('C5a: a mid-batch failure degrades the step (advisory), prior ingest intact', () => {
    assert.equal(run4.step.status, 'degraded', JSON.stringify(run4.step));
    assert.equal(run4.step.stdout, '1 ingested, 0 unchanged, 1 failed, cap 2');
    assert.ok(typeof run4.step.advisory === 'string' && run4.step.advisory.length > 0,
      'a VISIBLE advisory line, never a silent kill');
    assert.equal(countArtifacts(room4), artifactsBefore4 + 1, 'the successful ingest stands');
  });

  await check('C5b: the failed source state is untouched (retries next run, T-220-22)', () => {
    const reg = readRegistryRaw(room4);
    const bad = reg.sources.find((s) => s.id === 'bad');
    assert.equal(bad.last_run, null);
    assert.equal(bad.last_content_sha, null);
  });

  await check('C5c: the step NEVER throws (null room -> a step object, not an exception)', async () => {
    const r = await urlIngestCrawlStep(null);
    assert.equal(r.step.name, 'url-ingest-crawl');
    assert.ok(r.step.status === 'ok' || r.step.status === 'degraded');
  });

  await check('C5d: exit path - the crawl call site sits inside main steps assembly, awaited, before telemetry', () => {
    const src = fs.readFileSync(RUNNER_PATH, 'utf8');
    const idxOpp = src.indexOf("compute-opportunity-state'");
    const idxCrawl = src.indexOf('await urlIngestCrawlStep(');
    const idxTelem = src.indexOf("'efficiency-telemetry'");
    assert.ok(idxOpp !== -1 && idxCrawl !== -1 && idxTelem !== -1, 'all three markers present');
    assert.ok(idxOpp < idxCrawl && idxCrawl < idxTelem,
      'the crawl step runs after opportunity-bank and before efficiency-telemetry');
    // The helper is exported (the sanctioned test seam) and main is async so
    // the await is real, not floating.
    assert.match(src, /module\.exports\s*=\s*\{[^}]*urlIngestCrawlStep/, 'step exported');
    assert.match(src, /async function main\(/, 'main awaits the step');
  });

  // ---------- C7: name-collision + D-10 + SEED-031 source gates ----------
  const naming = 'har' + 'vest';
  const commentFiltered = (src) => src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  await check('C7a: zero bare 219 token across the 220 modules (comment-filtered)', () => {
    const files = [URL_INGEST_PATH, WATCHED_PATH];
    if (fs.existsSync(SENSOR_PATH)) files.push(SENSOR_PATH); // 220-03 lands in parallel; gate it when present
    for (const f of files) {
      assert.equal(new RegExp('\\b' + naming, 'i').test(commentFiltered(fs.readFileSync(f, 'utf8'))), false,
        path.basename(f) + ' speaks url-ingest / watched-source only');
    }
  });

  await check('C7b: zero bare 219 token + zero llm_manual in the new runner block (comment-filtered)', () => {
    const src = fs.readFileSync(RUNNER_PATH, 'utf8');
    // The new block: the step helper plus its main call site.
    const helperStart = src.indexOf('// url-ingest-crawl step (Phase 220-04');
    const helperEnd = src.indexOf('// main cadence flow');
    const callStart = src.indexOf('// 8b. url-ingest-crawl');
    const callEnd = src.indexOf("// 9. efficiency telemetry");
    assert.ok(helperStart !== -1 && helperEnd > helperStart, 'helper block located');
    assert.ok(callStart !== -1 && callEnd > callStart, 'call-site block located');
    const block = commentFiltered(src.slice(helperStart, helperEnd) + '\n' + src.slice(callStart, callEnd));
    assert.equal(new RegExp('\\b' + naming, 'i').test(block), false, 'the new block speaks url-ingest-crawl');
    assert.equal(/llm_manual/.test(block), false, 'the manual rung is not even nameable from the crawl block (D-10)');
    assert.equal(/contentSource|\.content\b/.test(block), false, 'no content pass-through exists at the call site');
  });

  await check('C7c: SEED-031 probe present, require-guarded, dated (Task 2 acceptance)', () => {
    const src = fs.readFileSync(RUNNER_PATH, 'utf8');
    assert.ok((src.match(/SEED-031/g) || []).length >= 1, 'the probe cites SEED-031');
    assert.ok(src.indexOf('computeCostLevel') !== -1, 'the probe reads computeCostLevel');
    assert.ok(src.indexOf('absent as of 2026-07-13') !== -1, 'the dated absence comment');
    // The require sits inside a try block (require-guarded): anchor on the
    // CODE usage (typeof check), not the comment mention.
    const probeIdx = src.indexOf('typeof mod.computeCostLevel');
    assert.ok(probeIdx !== -1, 'the probe code usage present');
    const windowSrc = src.slice(Math.max(0, probeIdx - 400), probeIdx);
    assert.ok(windowSrc.indexOf('try {') !== -1, 'probe require is try-guarded');
  });
}

async function main() {
  console.log('registry sections (Task 1):');
  await registrySections();

  console.log('');
  console.log('crawl sections (Task 3):');
  await crawlSections();

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
