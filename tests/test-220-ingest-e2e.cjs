'use strict';
// Phase 220-02 Task 1 -- ingestUrl e2e contract (RED-first).
//
// Five behavior groups (220-02-PLAN.md Task 1), fully hermetic (extract leg
// stubbed via opts._fetchCorpus, the source-lens-driver injectable-seam
// precedent; zero network -- the run-all-220 zero-network preload applies when
// run through the aggregator):
//   (1) e2e happy path: stubbed fetch -> research/<dated-slug>/<dated-slug>.md
//       with ALL D-03 sidecar frontmatter keys present and parseable through
//       the room's frontmatter parser, the raw capture beside it (byte-equal),
//       a memory_artifact node in room.db, >=1 proposed entity DERIVED_FROM
//       the artifact node, envelope outcome 'filed' + research_mode 'normal',
//       and SCOPED extraction (pre-existing artifacts untouched -- the
//       opts.paths seam consumed, never a full-room re-extract)
//   (2) typed failure: provider_unavailable stub -> outcome
//       'provider_unavailable', research_mode 'insufficient_evidence',
//       NOTHING filed, ledger untouched (D-07/D-19: never ok:true+empty)
//   (3) supplied-content rungs: opts.content + contentSource 'webfetch' files
//       engine_mode 'engine' + research_mode 'web_degraded_local_fallback';
//       contentSource 'llm_manual' files engine_mode 'llm_manual_baseline' +
//       providers.llm_manual 'used' (D-10 labeling)
//   (4) cadence manual fence: origin 'cadence' + contentSource 'llm_manual'
//       -> outcome 'blocked', nothing filed (D-10 hard fence)
//   (5) FTS5 degrade: the happy path re-runs under MINDRIAN_FORCE_FTS_ABSENT=1
//       (the landed 219-02 seam) and still lands artifact + entities
//       (degrade-never-throw)
// plus the comment-filtered source grep gates (zero research-cache require,
// zero raw INSERT INTO, zero 'harvest' token) from the acceptance criteria.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { buildFixtureRoom } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-219.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { parseFrontmatter } = require(path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs'));

const URL_INGEST_PATH = path.join(REPO_ROOT, 'lib', 'core', 'url-ingest.cjs');
const { ingestUrl, MAX_INGEST_BYTES } = require(URL_INGEST_PATH);

const SESSION = 'fixture-220-ingest';

// Entity-bearing fixture markdown: TitleCase proper-noun runs under a
// competitor-leaning heading so the tier-1 extractor (zero-LLM) lands
// proposed entities deterministically (the 219-05 fixture precedent).
const FIXTURE_MARKDOWN = [
  '## Competitors',
  '',
  'Quantalink Photonics announced a partnership with Meridian Robotics to',
  'deploy photonic interconnects across evacuated freight corridors.',
  'Halcyon Fabrication remains the incumbent vendor in the segment.',
  '',
].join('\n');
const FIXTURE_TITLE = 'Quantalink Photonics partnership analysis';
const FIXTURE_URL = 'https://example.com/articles/quantalink-partnership';

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// The exact Plan 01 legacy extract envelope shape (220-01-SUMMARY provides).
function okStub(markdown, title) {
  return function stub(args) {
    assert.equal(args.source, 'tavily-extract', 'stub only speaks tavily-extract');
    return {
      ok: true,
      provider: {
        id: 'tavily-extract',
        status: 'ok',
        reason: null,
        counts: { urls_requested: 1, urls_succeeded: 1 },
      },
      results: [{ url: args.query, markdown: markdown, title: title }],
    };
  };
}

function failStub(status, reason) {
  return function stub() {
    return {
      ok: false,
      provider: {
        id: 'tavily-extract',
        status: status,
        reason: reason,
        counts: { urls_requested: 1, urls_succeeded: 0 },
      },
      results: [],
    };
  };
}

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

function freshRoom(tag) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-220-ingest-' + tag + '-'));
  return buildFixtureRoom(tmp);
}

function dbCounts(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return {
      artifacts: db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_artifact'").get().n,
      nodes: db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n,
      edges: db.prepare('SELECT COUNT(*) AS n FROM edges').get().n,
      describes: db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'DESCRIBES'").get().n,
    };
  } finally {
    closeRoomDb(db);
  }
}

function artifactNodeByPath(roomDir, relPath) {
  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'memory_artifact'").all();
    for (const row of rows) {
      const props = JSON.parse(row.properties || '{}');
      if (props.path === relPath) return { id: row.id, props: props };
    }
    return null;
  } finally {
    closeRoomDb(db);
  }
}

function derivedFromEntities(roomDir, artifactNodeId) {
  const db = openRoomDb(roomDir);
  try {
    const sources = db.prepare("SELECT source FROM edges WHERE target = ? AND type = 'DERIVED_FROM'").all(artifactNodeId);
    const out = [];
    for (const s of sources) {
      const row = db.prepare('SELECT id, type, review_status FROM nodes WHERE id = ?').get(s.source);
      if (row) out.push(row);
    }
    return out;
  } finally {
    closeRoomDb(db);
  }
}

function listResearchDirs(roomDir) {
  const root = path.join(roomDir, 'research');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter((n) => n !== 'ROOM.md');
}

async function main() {
  // ---------- Group 1: e2e happy path ----------
  const fx1 = freshRoom('happy');
  const before1 = dbCounts(fx1.roomDir);
  const env1 = await ingestUrl(fx1.roomDir, FIXTURE_URL, {
    _fetchCorpus: okStub(FIXTURE_MARKDOWN, FIXTURE_TITLE),
    sessionId: SESSION,
  });

  await check('G1a: envelope reads ok:true, outcome filed, research_mode normal (D-19)', () => {
    assert.equal(env1.ok, true, 'ok true: ' + JSON.stringify(env1));
    assert.equal(env1.outcome, 'filed');
    assert.equal(env1.research_mode, 'normal');
    assert.equal(env1.providers.tavily_extract.status, 'ok');
    assert.equal(env1.providers.webfetch.status, 'not_attempted');
    assert.equal(env1.providers.llm_manual.status, 'not_used');
  });

  await check('G1b: D-11 nesting -- research/<dated-slug>/<dated-slug>.md, path-safe slug', () => {
    assert.match(env1.artifact.path,
      /^research\/(\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,64})\/\1\.md$/,
      'nested dated-slug path: ' + env1.artifact.path);
    assert.ok(fs.existsSync(path.join(fx1.roomDir, env1.artifact.path)), 'normalized artifact on disk');
  });

  await check('G1c: ALL D-03 sidecar frontmatter keys present + parseable (room parser)', () => {
    const raw = fs.readFileSync(path.join(fx1.roomDir, env1.artifact.path), 'utf8');
    const fm = parseFrontmatter(raw);
    const slug = env1.artifact.path.split('/')[1];
    assert.equal(fm.artifact_id, slug, 'artifact_id');
    assert.equal(fm.kind, 'research-source', 'kind');
    assert.equal(fm.title, FIXTURE_TITLE, 'title');
    assert.equal(fm.source_type, 'unknown', 'source_type (v1 URL-metadata derivation)');
    assert.equal(fm.original_url, FIXTURE_URL, 'original_url');
    assert.ok(typeof fm.captured_at === 'string' && fm.captured_at.length >= 10, 'captured_at ISO');
    assert.equal(fm.content_sha256, sha256(FIXTURE_MARKDOWN), 'content_sha256');
    assert.equal(fm.content_format, 'markdown', 'content_format');
    assert.equal(fm.normalization_version, 1, 'normalization_version');
    assert.equal(fm.access_basis, 'public_web', 'access_basis');
    assert.equal(fm.review_status, 'proposed', 'review_status');
    assert.equal(fm.engine_mode, 'engine', 'engine_mode');
    assert.equal(fm.ingest_origin, 'on_demand', 'ingest_origin');
    assert.equal(fm.derived_from, slug + '.raw.md', 'derived_from pointer (D-11)');
    // source_published_at only when the extract surfaces it: omitted here.
    assert.equal(Object.prototype.hasOwnProperty.call(fm, 'source_published_at'), false);
  });

  await check('G1d: raw capture immutable beside the normalized artifact, byte-verbatim', () => {
    const slug = env1.artifact.path.split('/')[1];
    const rawPath = path.join(fx1.roomDir, 'research', slug, slug + '.raw.md');
    assert.ok(fs.existsSync(rawPath), 'raw capture exists inside the artifact folder');
    const bytes = fs.readFileSync(rawPath, 'utf8');
    assert.equal(sha256(bytes), sha256(FIXTURE_MARKDOWN), 'raw bytes identical to the stub markdown');
  });

  await check('G1e: memory_artifact node registered + envelope carries its id + sha', () => {
    const node = artifactNodeByPath(fx1.roomDir, env1.artifact.path);
    assert.ok(node, 'memory_artifact node exists for the filed path');
    assert.equal(env1.artifact.node_id, node.id, 'envelope node_id matches room.db');
    assert.equal(env1.artifact.content_sha256, sha256(FIXTURE_MARKDOWN));
    assert.equal(env1.artifact.superseded_node_id, null, 'first ingest supersedes nothing');
  });

  await check('G1f: >=1 proposed entity DERIVED_FROM the artifact node (219 seam consumed)', () => {
    const ents = derivedFromEntities(fx1.roomDir, env1.artifact.node_id);
    assert.ok(ents.length >= 1, '>=1 DERIVED_FROM source (got ' + ents.length + ')');
    assert.ok(ents.some((e) => e.review_status === 'proposed'), 'includes proposed entities');
  });

  await check('G1g: extraction SCOPED to the new artifact (pre-existing artifacts untouched)', () => {
    const after = dbCounts(fx1.roomDir);
    // Exactly ONE new memory_artifact (the ingest); the fixture hub/satellite
    // artifact population is untouched.
    assert.equal(after.artifacts, before1.artifacts + 1, 'exactly one new memory_artifact');
    // Every new DESCRIBES edge targets the NEW artifact node only: a full-room
    // re-extract would mint DESCRIBES edges onto the fixture section anchors.
    const db = openRoomDb(fx1.roomDir);
    try {
      const rows = db.prepare("SELECT target FROM edges WHERE type = 'DESCRIBES'").all();
      const offTarget = rows.filter((r) => r.target !== env1.artifact.node_id);
      assert.equal(offTarget.length, 0,
        'zero DESCRIBES edges to pre-existing artifacts (got ' + offTarget.length + ')');
    } finally {
      closeRoomDb(db);
    }
  });

  await check('G1h: ledger written with the interfaces schema', () => {
    const ledgerPath = path.join(fx1.roomDir, '.mindrian', 'url-ingest-ledger.json');
    assert.ok(fs.existsSync(ledgerPath), 'ledger exists');
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    assert.equal(ledger.schema_version, 1);
    const entry = ledger.entries[FIXTURE_URL];
    assert.ok(entry, 'entry keyed by url');
    assert.equal(entry.content_sha256, sha256(FIXTURE_MARKDOWN));
    assert.equal(entry.artifact_node_id, env1.artifact.node_id);
    assert.equal(entry.artifact_path, env1.artifact.path);
    assert.ok(typeof entry.last_ingested_at === 'string' && entry.last_ingested_at.length >= 10);
    assert.equal(entry.ingest_origin, 'on_demand');
  });

  // ---------- Group 2: typed failure ----------
  const fx2 = freshRoom('fail');
  const before2 = dbCounts(fx2.roomDir);
  const env2 = await ingestUrl(fx2.roomDir, 'https://example.com/unreachable', {
    _fetchCorpus: failStub('provider_unavailable', 'missing_key'),
    sessionId: SESSION,
  });

  await check('G2a: typed provider_unavailable outcome, insufficient_evidence mode, ok:false', () => {
    assert.equal(env2.ok, false, 'never ok:true on a failed fetch');
    assert.equal(env2.outcome, 'provider_unavailable');
    assert.equal(env2.research_mode, 'insufficient_evidence');
    assert.equal(env2.providers.tavily_extract.status, 'provider_unavailable');
    assert.equal(env2.providers.tavily_extract.reason, 'missing_key');
    assert.equal(env2.artifact.node_id, null);
  });

  await check('G2b: NOTHING filed, ledger untouched', () => {
    assert.equal(listResearchDirs(fx2.roomDir).length, 0, 'no research entries');
    const after = dbCounts(fx2.roomDir);
    assert.equal(after.artifacts, before2.artifacts, 'zero new artifact nodes');
    assert.equal(after.edges, before2.edges, 'zero new edges');
    assert.equal(fs.existsSync(path.join(fx2.roomDir, '.mindrian', 'url-ingest-ledger.json')), false,
      'ledger never created on a failed fetch');
  });

  // ---------- Group 3: supplied-content rungs ----------
  const fx3 = freshRoom('rungs');
  const env3a = await ingestUrl(fx3.roomDir, 'https://example.com/webfetch-page', {
    content: FIXTURE_MARKDOWN,
    contentSource: 'webfetch',
    title: 'Webfetch rung page',
    sessionId: SESSION,
  });

  await check('G3a: webfetch rung files engine_mode engine + web_degraded_local_fallback', () => {
    assert.equal(env3a.ok, true, JSON.stringify(env3a));
    assert.equal(env3a.outcome, 'filed');
    assert.equal(env3a.research_mode, 'web_degraded_local_fallback');
    assert.equal(env3a.providers.tavily_extract.status, 'not_attempted');
    assert.equal(env3a.providers.webfetch.status, 'used');
    assert.equal(env3a.providers.llm_manual.status, 'not_used');
    const fm = parseFrontmatter(fs.readFileSync(path.join(fx3.roomDir, env3a.artifact.path), 'utf8'));
    assert.equal(fm.engine_mode, 'engine');
  });

  const env3b = await ingestUrl(fx3.roomDir, 'https://example.com/manual-page', {
    content: FIXTURE_MARKDOWN,
    contentSource: 'llm_manual',
    title: 'Manual rung page',
    sessionId: SESSION,
  });

  await check('G3b: llm_manual rung files engine_mode llm_manual_baseline + providers.llm_manual used (D-10)', () => {
    assert.equal(env3b.ok, true, JSON.stringify(env3b));
    assert.equal(env3b.outcome, 'filed');
    assert.equal(env3b.research_mode, 'web_degraded_local_fallback');
    assert.equal(env3b.providers.llm_manual.status, 'used');
    const fm = parseFrontmatter(fs.readFileSync(path.join(fx3.roomDir, env3b.artifact.path), 'utf8'));
    assert.equal(fm.engine_mode, 'llm_manual_baseline');
  });

  // ---------- Group 4: cadence manual fence (D-10) ----------
  const fx4 = freshRoom('fence');
  const before4 = dbCounts(fx4.roomDir);
  const env4 = await ingestUrl(fx4.roomDir, 'https://example.com/cadence-manual', {
    content: FIXTURE_MARKDOWN,
    contentSource: 'llm_manual',
    origin: 'cadence',
    sessionId: SESSION,
  });

  await check('G4: origin cadence + llm_manual -> typed blocked, nothing filed (D-10 hard fence)', () => {
    assert.equal(env4.ok, false);
    assert.equal(env4.outcome, 'blocked');
    assert.equal(listResearchDirs(fx4.roomDir).length, 0, 'no research entries');
    const after = dbCounts(fx4.roomDir);
    assert.equal(after.artifacts, before4.artifacts, 'zero new artifact nodes');
  });

  // ---------- Group 5: FTS5 forced-absent degrade (the landed 219-02 seam) ----------
  const envHadForce = typeof process.env.MINDRIAN_FORCE_FTS_ABSENT === 'string'
    && process.env.MINDRIAN_FORCE_FTS_ABSENT !== '';
  process.env.MINDRIAN_FORCE_FTS_ABSENT = '1';
  let env5;
  let fx5;
  try {
    fx5 = freshRoom('fts-absent');
    env5 = await ingestUrl(fx5.roomDir, FIXTURE_URL, {
      _fetchCorpus: okStub(FIXTURE_MARKDOWN, FIXTURE_TITLE),
      sessionId: SESSION,
    });
  } finally {
    if (!envHadForce) delete process.env.MINDRIAN_FORCE_FTS_ABSENT;
  }

  await check('G5: FTS5 forced-absent leg still files + extracts (degrade-never-throw)', () => {
    assert.equal(env5.ok, true, JSON.stringify(env5));
    assert.equal(env5.outcome, 'filed');
    assert.ok(fs.existsSync(path.join(fx5.roomDir, env5.artifact.path)), 'artifact filed under forced-absent FTS5');
    const ents = derivedFromEntities(fx5.roomDir, env5.artifact.node_id);
    assert.ok(ents.length >= 1, 'entities still land under the bi-modal degrade (got ' + ents.length + ')');
  });

  // ---------- Source grep gates (comment-filtered; acceptance criteria) ----------
  await check('GATE: zero research-cache require in url-ingest.cjs (D-08 structural)', () => {
    const src = fs.readFileSync(URL_INGEST_PATH, 'utf8');
    const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    assert.equal(/research-cache/.test(code), false, 'url-ingest never touches the public cache');
  });

  await check('GATE: zero raw INSERT INTO in url-ingest.cjs (writes only via navigation/research-filing)', () => {
    const src = fs.readFileSync(URL_INGEST_PATH, 'utf8');
    const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    assert.equal(/INSERT\s+INTO/i.test(code), false, 'zero raw SQL writes');
  });

  await check('GATE: zero bare harvest token in url-ingest.cjs (219 owns the vocabulary)', () => {
    const src = fs.readFileSync(URL_INGEST_PATH, 'utf8');
    const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    const naming = 'har' + 'vest';
    assert.equal(new RegExp('\\b' + naming, 'i').test(code), false, 'this plan speaks url-ingest');
  });

  await check('GATE: MAX_INGEST_BYTES exported and documented at 1_500_000 (D-02)', () => {
    assert.equal(MAX_INGEST_BYTES, 1500000);
  });

  console.log('');
  console.log('test-220-ingest-e2e: ' + pass + '/' + total + ' passed');
  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('test-220-ingest-e2e crashed:', e && e.stack);
  process.exit(1);
});
