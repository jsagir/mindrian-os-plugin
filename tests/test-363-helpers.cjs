#!/usr/bin/env node
'use strict';

// Phase 363 Plan 02 - self-test of the two 363 test helpers:
//   tests/helpers/fixture-room-363.cjs   (two-section cohort room)
//   tests/helpers/openalex-replay-363.cjs (OpenAlex replay fetch)
//
// Hygiene: scrub the vendor key, drop OPENALEX_API_KEY, install the net guard
// BEFORE any repo module loads. The replay fetch is passed explicitly and is
// never installed globally here. mkdtemp only.
//
// exit 0 -> PASSED, exit 1 -> FAILED, exit 77 -> SKIPPED (ENV GAP)
//
// House rule: hyphens only; dash characters appear only as unicode escapes.

const { scrubVendorKey, installNetGuard, makeChecker, listFilesRecursive } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
const NET = installNetGuard();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { check, summary } = makeChecker('test-363-helpers');

const { buildRoom363, MARKER_PREFIX_363, GAP_TERM_363 } = require('./helpers/fixture-room-363.cjs');
const { auditQueryString } = require('../lib/core/rs-egress-prompts.cjs');
const { readUserMd } = require('../lib/core/user-md-ops.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

function readAll(dir) {
  const out = [];
  for (const f of listFilesRecursive(dir)) {
    if (/room\.db/.test(path.basename(f))) continue;
    try { out.push({ file: f, text: fs.readFileSync(f, 'utf8') }); } catch (_e) { /* skip */ }
  }
  return out;
}

function extractSection(artifactId) {
  const parts = String(artifactId || '').replace(/^\/+/, '').split('/');
  return parts.length > 1 ? parts[0] : 'unclassified';
}

// ---------------------------------------------------------------------------
// Fixture room legs
// ---------------------------------------------------------------------------

function roomLegs() {
  const r = buildRoom363({ role: 'researcher' });
  const f = buildRoom363({ role: 'founder', withTimingArtifact: true });
  try {
    check('room: returns roomDir, marker, gapTerm, zones, cleanup',
      typeof r.roomDir === 'string' && typeof r.marker === 'string' && typeof r.gapTerm === 'string'
        && r.zones && r.zones.twoSection && r.zones.oneSection && typeof r.cleanup === 'function');
    check('room: roomDir is under os.tmpdir()', path.resolve(r.roomDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    check('room: gapTerm equals GAP_TERM_363', r.gapTerm === GAP_TERM_363);
    check('room: marker carries MARKER_PREFIX_363 plus hex', new RegExp('^' + MARKER_PREFIX_363 + '[0-9a-f]{12}$').test(r.marker));

    // Sections and nested artifacts.
    for (const sec of ['problem-definition', 'market-analysis']) {
      const secDir = path.join(r.roomDir, sec);
      check('room: ' + sec + ' has a ROOM.md identity file', fs.existsSync(path.join(secDir, 'ROOM.md')));
      const arts = fs.readdirSync(secDir, { withFileTypes: true })
        .filter(function (d) { return d.isDirectory(); })
        .filter(function (d) { return fs.existsSync(path.join(secDir, d.name, d.name + '.md')); });
      check('room: ' + sec + ' holds at least two nested artifacts', arts.length >= 2, 'found ' + arts.length);
    }

    // room.db exists and holds claim nodes written through navigation.
    check('room: room.db exists at .mindrian/room.db', fs.existsSync(path.join(r.roomDir, '.mindrian', 'room.db')));
    const db = openRoomDb(r.roomDir, { allowExtension: true });
    let claims = -1;
    try {
      claims = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'claim'").get().n;
    } catch (_e) { /* schema name mismatch surfaces below */ } finally { closeRoomDb(db); }
    check('room: room.db holds at least four claim nodes seeded via navigation', claims >= 4, 'claims=' + claims);

    // Frozen whitespace file parses through the reader shape the adapter uses.
    const wsPath = path.join(r.roomDir, '.mindrian', 'whitespace-results.json');
    let data = null;
    try { data = JSON.parse(fs.readFileSync(wsPath, 'utf8')); } catch (_e) { data = null; }
    check('room: whitespace-results.json parses and has a gaps array', data && Array.isArray(data.gaps) && data.gaps.length === 2);
    const two = data.gaps.find(function (g) { return g.zone_id === 'zone-363-two'; });
    const one = data.gaps.find(function (g) { return g.zone_id === 'zone-363-one'; });
    const secsOf = function (g) {
      return Array.from(new Set((g.nearest_room_artifacts || []).map(function (a) { return extractSection(a.artifact_id); })));
    };
    check('room: two-section zone spans problem-definition and market-analysis (write-whitespace-sections rule)',
      two && secsOf(two).sort().join(',') === 'market-analysis,problem-definition');
    check('room: one-section zone spans exactly one section', one && secsOf(one).length === 1);
    check('room: two-section zone carries GAP_TERM_363', two && two.zone_term === GAP_TERM_363);
    check('room: every gap keeps the reader fields (brain_framework, density_score)',
      data.gaps.every(function (g) { return typeof g.brain_framework === 'string' && typeof g.density_score === 'number'; }));

    // The real reader accepts the frozen file: the ambient whitespace adapter
    // and the sections writer both read this exact shape.
    const sectionsWriter = spawnSync(process.execPath,
      [path.join(ROOT, 'scripts', 'write-whitespace-sections.cjs'), r.roomDir],
      { encoding: 'utf8', timeout: 20000 });
    const wsMd = path.join(r.roomDir, 'market-analysis', 'WHITESPACE.md');
    check('room: write-whitespace-sections accepts the frozen file and files the gap in both sections',
      sectionsWriter.status === 0 && fs.existsSync(wsMd)
        && fs.existsSync(path.join(r.roomDir, 'problem-definition', 'WHITESPACE.md')),
      'status=' + sectionsWriter.status + ' ' + String(sectionsWriter.stderr || '').slice(0, 120));

    // Audit and marker rules.
    let audited = true;
    try { auditQueryString(GAP_TERM_363, 'test'); } catch (_e) { audited = false; }
    check('room: GAP_TERM_363 passes auditQueryString', audited);

    const files = readAll(r.roomDir);
    const markerFiles = function (sec) {
      return files.filter(function (x) {
        return x.text.indexOf(r.marker) !== -1 && x.file.indexOf(path.sep + sec + path.sep) !== -1
          && !/WHITESPACE\.md$/.test(x.file);
      });
    };
    check('room: marker planted in artifact prose in problem-definition', markerFiles('problem-definition').length >= 1);
    check('room: marker planted in artifact prose in market-analysis', markerFiles('market-analysis').length >= 1);
    const zoneJson = JSON.stringify(data.gaps);
    check('room: marker never occurs in any zone field', zoneJson.indexOf(r.marker) === -1 && zoneJson.indexOf(MARKER_PREFIX_363) === -1);
    check('room: marker never occurs in the gap term', GAP_TERM_363.indexOf(MARKER_PREFIX_363) === -1);

    // USER.md role variants. ignoreOverride keeps a navigator persona override
    // on this machine from masking the fixture.
    const ur = readUserMd(path.join(r.roomDir, 'USER.md'), { ignoreOverride: true });
    const uf = readUserMd(path.join(f.roomDir, 'USER.md'), { ignoreOverride: true });
    check('room: role researcher writes canonical_role researcher', ur && ur.canonical_role === 'researcher');
    check('room: role founder writes a non-researcher role', uf && uf.canonical_role === 'founder' && uf.canonical_role !== 'researcher');

    // Timing artifact (D-19 room signal).
    check('room: withTimingArtifact adds market-analysis/timing/<name>/<name>.md',
      fs.existsSync(path.join(f.roomDir, 'market-analysis', 'timing', 'adoption-window', 'adoption-window.md')));
    check('room: default room has no timing artifact', !fs.existsSync(path.join(r.roomDir, 'market-analysis', 'timing')));

    // Static scans of the helper: navigation only, no raw SQL, no dash chars.
    const helperSrc = fs.readFileSync(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'), 'utf8');
    check('room: helper routes room.db writes through navigation', /navigation/.test(helperSrc));
    check('room: helper holds no raw INSERT INTO', !/INSERT INTO/i.test(helperSrc));
    check('room: helper holds no em-dash or en-dash', helperSrc.indexOf(EM_DASH) === -1 && helperSrc.indexOf(EN_DASH) === -1);
  } finally {
    r.cleanup();
    f.cleanup();
  }
  check('room: cleanup removes the mkdtemp root', !fs.existsSync(r.roomDir) && !fs.existsSync(f.roomDir));
}

// ---------------------------------------------------------------------------
// OpenAlex replay legs
// ---------------------------------------------------------------------------

const REQUIRED_IDS = ['gap_primary_zero', 'synonym_hits', 'prior_review_two', 'contested_rows', 'derivation_hit',
  'retest_hit', 'scurve_ceiling', 'scurve_headroom', 'diffusion_adoption', 'retracted_one'];
const RESULT_FIELDS = ['id', 'doi', 'title', 'abstract_inverted_index', 'publication_year', 'type', 'is_retracted', 'cited_by_count'];

async function replayLegs() {
  const replay = require('./helpers/openalex-replay-363.cjs');
  const { makeReplayFetch, writeReplayPreload, SENTINELS } = replay;
  const bodies = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '363-openalex', 'bodies.json'), 'utf8'));
  const manifestRaw = fs.readFileSync(path.join(__dirname, 'fixtures', '363-openalex', 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const academic = require('../lib/core/rs-fetcher-academic.cjs')._test;

  // ---- bodies and manifest ----
  check('replay: helper exports makeReplayFetch, writeReplayPreload, SENTINELS',
    typeof makeReplayFetch === 'function' && typeof writeReplayPreload === 'function' && SENTINELS && typeof SENTINELS === 'object');
  check('replay: all ten response ids exist in bodies.json', REQUIRED_IDS.every(function (i) { return bodies[i]; }));
  check('replay: manifest marks provenance synthetic_on_verified_shape_2026-09-29', manifest.provenance === 'synthetic_on_verified_shape_2026-09-29');
  check('replay: manifest lists every success id and the four failure sentinels',
    REQUIRED_IDS.every(function (i) { return manifest.response_ids.success.indexOf(i) !== -1; })
      && Object.keys(SENTINELS).every(function (k) { return manifest.response_ids.failure_sentinels.indexOf(k) !== -1; }));
  check('replay: manifest success ids are exactly the bodies.json keys',
    manifest.response_ids.success.slice().sort().join(',') === Object.keys(bodies).sort().join(','));

  let shapeOk = true;
  let shapeWhy = '';
  for (const id of REQUIRED_IDS) {
    const b = bodies[id];
    if (!b.meta || typeof b.meta.count !== 'number' || typeof b.meta.db_response_time_ms !== 'number' || typeof b.meta.cost_usd !== 'number') {
      shapeOk = false; shapeWhy = id + ' meta'; break;
    }
    if (!Array.isArray(b.results)) { shapeOk = false; shapeWhy = id + ' results'; break; }
    for (const w of b.results) {
      const missing = RESULT_FIELDS.filter(function (k) { return !(k in w); });
      const src = w.primary_location && w.primary_location.source;
      if (missing.length || !src || typeof src.display_name !== 'string' || typeof src.is_in_doaj !== 'boolean') {
        shapeOk = false; shapeWhy = id + ' result ' + missing.join('+'); break;
      }
    }
    if (!shapeOk) break;
  }
  check('replay: every body follows the verified OpenAlex shape (meta, cost, result fields, source)', shapeOk, shapeWhy);
  check('replay: gap_primary_zero is a valid empty (count 0, results [])',
    bodies.gap_primary_zero.meta.count === 0 && bodies.gap_primary_zero.results.length === 0);
  check('replay: prior_review_two has count 2 and two results',
    bodies.prior_review_two.meta.count === 2 && bodies.prior_review_two.results.length === 2);
  check('replay: retracted_one has one result with is_retracted true',
    bodies.retracted_one.results.length === 1 && bodies.retracted_one.results[0].is_retracted === true);
  check('replay: only retracted_one carries a retracted result',
    REQUIRED_IDS.filter(function (i) { return i !== 'retracted_one'; })
      .every(function (i) { return bodies[i].results.every(function (w) { return w.is_retracted === false; }); }));

  const abstractOf = function (w) { return academic.invertAbstract(w.abstract_inverted_index); };
  const syn = bodies.synonym_hits;
  check('replay: synonym_hits has meta.count 240 and five results', syn.meta.count === 240 && syn.results.length === 5);
  check('replay: synonym_hits abstracts use a synonym and none contain the exact gap term',
    syn.results.every(function (w) {
      const a = abstractOf(w).toLowerCase();
      return a.indexOf(GAP_TERM_363) === -1 && /ultrason|sonic|ultrasound|pressure wave|vibration/.test(a);
    }));
  check('replay: no body carries the exact gap term anywhere',
    JSON.stringify(bodies).toLowerCase().indexOf(GAP_TERM_363) === -1);
  check('replay: contested_rows has five results, some supporting and some contradicting',
    bodies.contested_rows.results.length === 5
      && bodies.contested_rows.results.some(function (w) { return /reduces biofilm mass/.test(abstractOf(w)); })
      && bodies.contested_rows.results.some(function (w) { return /no significant reduction|did not reduce/.test(abstractOf(w)); }));
  check('replay: derivation_hit states a fundamental limit',
    bodies.derivation_hit.results.some(function (w) { return /fundamental|hard limit/.test(abstractOf(w)); }));
  check('replay: retest_hit reports a limiter overcome or re-tested',
    bodies.retest_hit.results.some(function (w) { return /overcame|overcome|re-tested/.test(abstractOf(w)); }));
  check('replay: scurve ceiling and headroom bodies read as ceiling and headroom',
    /plateau|ceiling|diminishing/.test(abstractOf(bodies.scurve_ceiling.results[0]))
      && /headroom|far below/.test(abstractOf(bodies.scurve_headroom.results[0])));
  check('replay: diffusion_adoption speaks of adoption', bodies.diffusion_adoption.results.every(function (w) { return /adopt|uptake|diffusion/i.test(abstractOf(w) + ' ' + w.title); }));

  // The inverted index is exact: reconstruct and re-invert must agree.
  const reinvert = function (text) {
    const idx = {};
    text.split(/\s+/).forEach(function (w, i) { (idx[w] = idx[w] || []).push(i); });
    return idx;
  };
  check('replay: abstract_inverted_index round-trips exactly',
    REQUIRED_IDS.every(function (id) {
      return bodies[id].results.every(function (w) {
        return JSON.stringify(reinvert(abstractOf(w))) === JSON.stringify(w.abstract_inverted_index);
      });
    }));

  // Bodies normalize through the same step fetchOpenAlex uses today.
  const normalized = academic.parseOpenAlex(bodies.synonym_hits);
  check('replay: bodies normalize through parseOpenAlex (id, title, abstract, doi, source)',
    normalized.length === 5 && normalized.every(function (p) {
      return p.id && p.title && p.abstract.length > 20 && p.doi && p.source === 'openalex';
    }));

  // Part 8: every recorded string would pass the egress audit if ever echoed.
  let auditOk = true;
  let auditWhy = '';
  for (const id of REQUIRED_IDS) {
    for (const w of bodies[id].results) {
      for (const text of [w.title, abstractOf(w), w.primary_location.source.display_name]) {
        try { auditQueryString(text, 'test'); } catch (_e) { auditOk = false; auditWhy = id + ': ' + text.slice(0, 40); }
      }
    }
  }
  check('replay: every title, abstract and venue passes the Part 8 audit', auditOk, auditWhy);

  // ---- routing, headers and recorder ----
  const asked = [];
  const f = makeReplayFetch({
    route: function (q) {
      asked.push(q);
      if (q === 'zero term') return 'gap_primary_zero';
      if (q === 'budget term') return SENTINELS.SENTINEL_429_BUDGET;
      if (q === 'server term') return SENTINELS.SENTINEL_500;
      if (q === 'slow term') return SENTINELS.SENTINEL_TIMEOUT;
      if (q === 'down term') return SENTINELS.SENTINEL_NETWORK;
      return 'synonym_hits';
    },
  });
  const url = function (q) { return 'https://api.openalex.org/works?search=' + encodeURIComponent(q) + '&per-page=200'; };

  const ok = await f(url('"acoustic biofilm disruption" OR "sonic biofilm"'), { headers: { 'User-Agent': 'x', Accept: 'application/json' } });
  const okBody = await ok.json();
  check('replay: routed success returns the recorded body with meta.count', ok.ok === true && ok.status === 200 && okBody.meta.count === 240);
  check('replay: the search parameter is decoded to q for the router',
    asked[0] === '"acoustic biofilm disruption" OR "sonic biofilm"');
  check('replay: ok response carries the verified cost and budget headers',
    ok.headers.get('x-ratelimit-limit-usd') === '0.1' && ok.headers.get('x-ratelimit-cost-usd') === '0.001'
      && Number(ok.headers.get('x-ratelimit-remaining-usd')) < 0.1 && ok.headers.get('X-RateLimit-Limit-USD') === '0.1');
  check('replay: text() returns the same JSON', JSON.parse(await ok.text()).meta.count === 240);

  const zero = await f(url('zero term'), {});
  const zeroBody = await zero.json();
  check('replay: valid-empty is ok with count 0 (distinct from failures)', zero.ok === true && zeroBody.meta.count === 0);

  const r429 = await f(url('budget term'), {});
  check('replay: SENTINEL_429_BUDGET is status 429, not ok, remaining-usd 0',
    r429.status === 429 && r429.ok === false && r429.headers.get('x-ratelimit-remaining-usd') === '0');
  const r500 = await f(url('server term'), {});
  check('replay: SENTINEL_500 is status 500 and not ok', r500.status === 500 && r500.ok === false);

  let timeoutErr = null;
  try { await f(url('slow term'), {}); } catch (e) { timeoutErr = e; }
  check('replay: SENTINEL_TIMEOUT rejects with an error named AbortError', timeoutErr && timeoutErr.name === 'AbortError');
  let netErr = null;
  try { await f(url('down term'), {}); } catch (e) { netErr = e; }
  check('replay: SENTINEL_NETWORK rejects with TypeError "fetch failed"',
    netErr instanceof TypeError && netErr.message === 'fetch failed');

  let unknownErr = null;
  const fBad = makeReplayFetch({ route: function () { return 'no_such_body'; } });
  try { await fBad(url('x'), {}); } catch (e) { unknownErr = e; }
  check('replay: an unknown response id fails loudly (a test bug, never silent)', unknownErr && /no recorded body/.test(unknownErr.message));

  // The failure statuses feed the real adapter's status handling.
  check('replay: failure statuses match what the adapter treats as rate_limited and api_error',
    (r429.status === 429 || r429.status === 503) && !(r500.status === 429 || r500.status === 503));

  // ---- recorder never holds a key ----
  const FAKE_KEY = 'fake-key-363';
  const rec = makeReplayFetch({ route: function () { return 'gap_primary_zero'; } });
  await rec(url('zero term'), { headers: { Authorization: 'Bearer ' + FAKE_KEY, 'User-Agent': 'x' } });
  await rec(url('zero term') + '&api_key=' + FAKE_KEY, { headers: {} });
  check('replay: recorder stores has_auth true and header names for a Bearer call',
    rec.calls[0].has_auth === true && rec.calls[0].headers_seen.indexOf('authorization') !== -1 && rec.calls[0].key_in_url === false);
  check('replay: recorder never contains the Authorization value',
    JSON.stringify(rec.calls).indexOf(FAKE_KEY) === -1 && JSON.stringify(rec.violations).indexOf(FAKE_KEY) === -1
      && Object.keys(rec).every(function (k) { return JSON.stringify(rec[k]) === undefined || JSON.stringify(rec[k]).indexOf(FAKE_KEY) === -1; }));
  check('replay: a key inside the URL is flagged key_in_url and redacted',
    rec.calls[1].key_in_url === true && rec.violations.length === 1 && rec.violations[0].kind === 'key_in_url'
      && rec.calls[1].url.indexOf('[REDACTED]') !== -1);
  check('replay: recorder call shape is { url, q, has_auth, headers_seen }',
    ['url', 'q', 'has_auth', 'headers_seen'].every(function (k) { return k in rec.calls[0]; }));

  // A built adapter URL (real buildAcademicQuery) replays without a key in the URL.
  const built = academic.SOURCES.indexOf('openalex') !== -1
    ? require('../lib/core/rs-fetcher-academic.cjs').buildAcademicQuery(GAP_TERM_363, 'openalex') : null;
  const viaBuilt = makeReplayFetch({ route: function () { return 'synonym_hits'; } });
  const builtRes = await viaBuilt(built.url, { headers: built.headers });
  check('replay: the adapter-built OpenAlex URL replays and decodes q to the gap term',
    builtRes.ok && viaBuilt.calls[0].q === GAP_TERM_363 && viaBuilt.calls[0].key_in_url === false);

  // ---- preload for spawned children ----
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-363-preload-'));
  try {
    const preload = writeReplayPreload(tmp, {});
    check('replay: writeReplayPreload writes a preload file', fs.existsSync(preload) && path.isAbsolute(preload));
    const child = spawnSync(process.execPath, ['-r', preload, '-e',
      "fetch('https://api.openalex.org/works?search=unknown%20phrase').then(function (r) { return r.json(); })"
      + ".then(function (b) { process.stdout.write(JSON.stringify({ count: b.meta.count, n: b.results.length })); })"
      + ".catch(function (e) { process.stderr.write(String(e)); process.exit(3); });"],
      { encoding: 'utf8', timeout: 20000 });
    check('replay: a child with the preload gets the default route (gap_primary_zero) from fetch',
      child.status === 0 && child.stdout === JSON.stringify({ count: 0, n: 0 }), child.stderr);

    const routeMod = path.join(tmp, 'route.cjs');
    fs.writeFileSync(routeMod, "module.exports = function (q) { return q === 'known phrase' ? 'prior_review_two' : 'gap_primary_zero'; };\n");
    const preload2 = writeReplayPreload(path.join(tmp, 'two'), { routeModulePath: routeMod });
    const child2 = spawnSync(process.execPath, ['-r', preload2, '-e',
      "fetch('https://api.openalex.org/works?search=known%20phrase').then(function (r) { return r.json(); })"
      + ".then(function (b) { process.stdout.write(String(b.meta.count)); });"],
      { encoding: 'utf8', timeout: 20000 });
    check('replay: the preload honors a supplied route module', child2.status === 0 && child2.stdout === '2', child2.stderr);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  // ---- static hygiene of the replay helper and fixtures ----
  const helperSrc = fs.readFileSync(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'), 'utf8');
  const both = helperSrc + manifestRaw + JSON.stringify(bodies);
  check('replay: helper, manifest and bodies hold no em-dash or en-dash', both.indexOf(EM_DASH) === -1 && both.indexOf(EN_DASH) === -1);
  check('replay: helper never records an Authorization value (no header value stored)',
    !/headers_seen:\s*\w*\.?(get|values)/.test(helperSrc) && /has_auth/.test(helperSrc));
}


async function main() {
  roomLegs();
  await replayLegs();

  check('net guard: no network attempt in this test', NET.attempts() === 0, 'attempts=' + NET.attempts());
  const code = summary();
  process.exit(code);
}

main().catch(function (e) {
  console.log('FAIL: unexpected error: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
