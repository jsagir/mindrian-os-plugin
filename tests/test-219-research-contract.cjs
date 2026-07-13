'use strict';
// Phase 219-05 Task 1 -- the D-19 research contract test suite (RED-first).
//
// Pins the four D-19 behaviors on lib/lens-engine/source-lens-driver.cjs +
// commands/research.md (the Manus-verified contract drift, confirmed locally):
//
//   Test group 1: the driver's failure path returns a typed per-provider
//     status {status, reason, counts, freshness} -- NEVER a silent ok + empty
//     arrays (T-219-29: ok:true+empty masking a research outage).
//   Test group 2: a cold/empty corpus yields research_mode
//     'insufficient_evidence', never a bare ok:true+empty; a healthy fetch is
//     'normal'; a live-fetch failure covered by the local cache is
//     'web_degraded_local_fallback'.
//   Test group 3: commands/research.md no longer claims the unshipped
//     paid -> native -> cache ordering (REALITY-TO-DOCS, planner decision:
//     the doc describes the SHIPPED cache-first order + the D-19 envelope).
//   Test group 4: the research-cache no-room-body guard -- the public
//     .mindrian/research-cache entries carry ONLY web-sourced signal data
//     (source / query_key / fetched_at / results), never room body text.
//
// Hermetic: zero network (every fetch is the injected _fetchCorpus stub), tmp
// rooms only. Standalone node script, exit 0/1.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const driver = require(path.join(REPO_ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
const researchCache = require(path.join(REPO_ROOT, 'lib', 'core', 'research-cache.cjs'));

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

function item(fields) {
  return Object.assign({
    id: 'https://example.test/x',
    title: 'web finding',
    abstract: 'public web abstract text',
    fetched_at: new Date().toISOString(),
  }, fields);
}

function preflight() {
  return {
    current_section: 'market-analysis',
    evidence_gaps: [{ summary: 'premium pricing tier revenue churn' }],
    prior_research: [],
  };
}

const LENSES = [{ lens: 'scholarly', weight: 1.0 }, { lens: 'industry', weight: 0.8 }];

// The closed D-19 mode enum every research return must draw from.
const MODES = ['normal', 'web_degraded_local_fallback', 'local_only', 'insufficient_evidence'];

async function main() {
  // =========================================================================
  // Group 1: typed per-provider status on the failure path.
  // =========================================================================
  await check('G1: an all-providers-failing run carries typed provider envelopes, never silent ok+empty', async () => {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: LENSES,
      preflight: preflight(),
      stage: 'explore',
      _fetchCorpus: async () => { throw new Error('provider down'); },
    });
    assert.ok(res, 'result exists');
    assert.ok(Array.isArray(res.providers), 'res.providers is the typed per-provider array');
    assert.ok(res.providers.length >= 1, 'at least one provider entry per attempted lens');
    for (const p of res.providers) {
      assert.equal(typeof p.provider, 'string', 'provider named');
      assert.ok(['ok', 'empty', 'error', 'skipped'].includes(p.status), 'status is a closed enum, got ' + p.status);
      assert.equal(typeof p.reason, 'string', 'reason is typed');
      assert.ok(p.counts && typeof p.counts.items === 'number', 'counts.items is numeric');
      assert.equal(typeof p.freshness, 'string', 'freshness is typed');
    }
    assert.ok(res.providers.some((p) => p.status === 'error'), 'the failure is a typed error status');
    // The anti-pattern: ok:true + empty findings with NO typed mode.
    assert.ok(typeof res.research_mode === 'string' && MODES.includes(res.research_mode),
      'a typed research_mode rides the failure return (got ' + res.research_mode + ')');
    assert.equal(res.research_mode, 'insufficient_evidence',
      'all-failed + zero items composes insufficient_evidence');
  });

  await check('G1b: existing consumer fields survive additively (ok / findings / lens_set)', async () => {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: LENSES,
      preflight: preflight(),
      stage: 'explore',
      _fetchCorpus: async () => [item({ id: 'https://oa/1', url: 'https://oa/1', abstract: 'premium pricing tier revenue' })],
    });
    assert.equal(res.ok, true, 'ok stays true');
    assert.ok(Array.isArray(res.findings), 'findings stays an array');
    assert.ok(Array.isArray(res.lens_set), 'lens_set survives');
  });

  // =========================================================================
  // Group 2: research_mode composition (cold / normal / degraded).
  // =========================================================================
  await check('G2a: a cold/empty corpus returns research_mode insufficient_evidence, never bare ok+empty', async () => {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: LENSES,
      preflight: preflight(),
      stage: 'explore',
      _fetchCorpus: async () => [],
    });
    assert.equal(res.research_mode, 'insufficient_evidence', 'cold corpus is typed');
    assert.equal(res.findings.length, 0, 'no fabricated findings');
    assert.ok(res.providers.every((p) => p.status === 'empty' || p.status === 'skipped'),
      'each provider carries the typed empty/skipped status');
  });

  await check('G2b: a healthy live fetch composes research_mode normal', async () => {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: LENSES,
      preflight: preflight(),
      stage: 'explore',
      _fetchCorpus: async () => [item({ id: 'https://oa/n', url: 'https://oa/n', abstract: 'premium pricing tier revenue' })],
    });
    assert.equal(res.research_mode, 'normal', 'healthy fetch is normal');
  });

  await check('G2c: live-fetch failure covered by a fresh cache entry composes web_degraded_local_fallback', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-rc-degrade-'));
    const roomDir = path.join(tmp, 'room');
    fs.mkdirSync(roomDir, { recursive: true });
    const topic = 'premium pricing';
    // Pre-seed the scholarly lens's source (openalex) cache so the cache-first
    // read supplies items while the live path (industry -> tavily) fails.
    researchCache.putCached(roomDir, 'openalex', topic, [
      item({ id: 'https://oa/cached', url: 'https://oa/cached', abstract: 'premium pricing tier revenue cached' }),
    ]);
    const res = await driver.runSourceLens({
      roomDir: roomDir,
      topic: topic,
      lensSet: LENSES,
      preflight: preflight(),
      stage: 'explore',
      _fetchCorpus: async () => { throw new Error('live fetch down'); },
    });
    assert.ok(res.findings.length >= 1, 'the cached items still surface');
    assert.equal(res.research_mode, 'web_degraded_local_fallback',
      'cache-covered outage is typed web_degraded_local_fallback (got ' + res.research_mode + ')');
    assert.ok(res.providers.some((p) => p.status === 'error'), 'the outage stays visible as a typed error');
    assert.ok(res.providers.some((p) => p.status === 'ok' && p.freshness === 'cached_fresh'),
      'the cache hit is typed with cached_fresh freshness');
  });

  await check('G2d: the driver exports the closed RESEARCH_MODES enum + composeResearchMode (the seam Plan 05 composes onto)', async () => {
    assert.ok(driver.RESEARCH_MODES, 'RESEARCH_MODES exported');
    for (const m of MODES) {
      assert.ok(driver.RESEARCH_MODES.includes(m), 'mode ' + m + ' is in the bank');
    }
    assert.equal(typeof driver.composeResearchMode, 'function', 'composeResearchMode exported');
    assert.equal(
      driver.composeResearchMode([{ provider: 'x', status: 'empty', reason: 'r', counts: { items: 0 }, freshness: 'unknown' }]),
      'insufficient_evidence', 'zero items composes insufficient_evidence');
    assert.equal(
      driver.composeResearchMode([{ provider: 'x', status: 'ok', reason: 'r', counts: { items: 2 }, freshness: 'live' }]),
      'normal', 'live items compose normal');
    assert.equal(
      driver.composeResearchMode(
        [{ provider: 'x', status: 'ok', reason: 'r', counts: { items: 2 }, freshness: 'local' }],
        { localOnly: true }),
      'local_only', 'the localOnly opt composes local_only');
  });

  // =========================================================================
  // Group 3: the commands/research.md drift fix (REALITY-TO-DOCS).
  // =========================================================================
  await check('G3: research.md no longer claims paid -> native -> cache; documents cache-first + the envelope', async () => {
    const doc = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'research.md'), 'utf8');
    assert.ok(!/paid\s*->\s*native/.test(doc), 'the unshipped paid -> native claim is gone');
    assert.ok(!/paid\s*(?:-|–|—)>\s*native/.test(doc), 'no dash-variant of the claim either');
    assert.ok(/cache-first/i.test(doc), 'the doc names the SHIPPED cache-first order');
    assert.ok(/research_mode/.test(doc), 'the doc names the D-19 research_mode envelope');
    assert.ok(/insufficient_evidence/.test(doc), 'the doc names the cold-corpus insufficient_evidence contract');
  });

  // =========================================================================
  // Group 4: the research-cache no-room-body guard.
  // =========================================================================
  await check('G4: public research-cache entries carry NO room body text (closed entry schema, web fields only)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-rc-guard-'));
    const roomDir = path.join(tmp, 'room');
    fs.mkdirSync(path.join(roomDir, 'market-analysis'), { recursive: true });
    // A distinctive room-artifact prose marker that must NEVER reach the cache.
    const MARKER = 'ZEBRAFISH-ROOM-SECRET-PROSE-9481';
    fs.writeFileSync(path.join(roomDir, 'market-analysis', 'notes.md'),
      '# notes\n\n' + MARKER + ' the venture plans a covert launch.\n', 'utf8');

    const res = await driver.runSourceLens({
      roomDir: roomDir,
      topic: 'premium pricing',
      lensSet: LENSES,
      preflight: {
        current_section: 'market-analysis',
        evidence_gaps: [{ summary: 'pricing tier gap' }],
        prior_research: [],
      },
      stage: 'explore',
      _fetchCorpus: async () => [item({ id: 'https://web/1', url: 'https://web/1', abstract: 'public pricing web abstract' })],
    });
    assert.equal(res.ok, true, 'run completes');

    const cacheDir = path.join(roomDir, '.mindrian', 'research-cache');
    assert.ok(fs.existsSync(cacheDir), 'the shared cache dir exists after a cached run');
    const entries = fs.readdirSync(cacheDir).filter((f) => f.endsWith('.json'));
    assert.ok(entries.length >= 1, 'at least one cache entry was written');
    const ENTRY_KEYS = new Set(['source', 'query_key', 'fetched_at', 'results']);
    for (const f of entries) {
      const raw = fs.readFileSync(path.join(cacheDir, f), 'utf8');
      assert.ok(raw.indexOf(MARKER) === -1, 'room prose marker never lands in ' + f);
      const parsed = JSON.parse(raw);
      for (const k of Object.keys(parsed)) {
        assert.ok(ENTRY_KEYS.has(k), 'cache entry key "' + k + '" is in the closed schema');
      }
      assert.ok(Array.isArray(parsed.results), 'results is the web item array');
      for (const r of parsed.results) {
        // Every cached result field is web-sourced signal data; the enum/handle/
        // url + snippet contract (D-19). No room-artifact prose fields exist.
        const rk = Object.keys(r);
        for (const k of rk) {
          assert.ok(['id', 'url', 'doi', 'title', 'abstract', 'source', 'fetched_at', 'authors', 'year', 'venue', 'score'].includes(k),
            'cached result field "' + k + '" is a web-item field');
        }
      }
    }
  });

  console.log('');
  console.log('test-219-research-contract: ' + pass + '/' + total + ' passed');
  if (failures.length > 0) {
    console.log('failures:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('test-219-research-contract crashed:', e && e.stack);
  process.exit(1);
});
