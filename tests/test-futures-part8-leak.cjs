#!/usr/bin/env node
/**
 * Phase 156 Plan 04 -- the FW-11 adversarial Part 8 egress tripwire.
 *
 * Mirrors tests/test-navigation-packet-part8-leak.cjs: an adversarial boundary
 * scan over ALL new Phase-156 code (lib/core/futures/*.cjs + commands/futures.md)
 * asserting ZERO user-content-to-Brain / user-content-to-external paths. The
 * ONLY external call in the phase is the FW-13 SIGNAL fetch, and it carries a
 * GENERIC DOMAIN HANDLE only -- never a consequence body, room artifact text, or
 * personal identifier.
 *
 * This is the phase's locality FLOOR (Canon Part 8: LOCAL data -> BRAIN: NO).
 *
 * Two kinds of assertion:
 *   (A) STATIC source scan: the futures sources carry no Brain-write / external
 *       call that could carry user content (the only fetch is fetchCorpus, and
 *       the orchestrator passes it ONLY the genericDomainHandle output).
 *   (B) RUNTIME adversarial: seed a consequence carrying a planted SECRET body +
 *       an email, drive the SIGNAL path with an injected recording corpus, and
 *       prove the planted content appears NOWHERE in any query that reaches
 *       fetchCorpus. Then prove the real fetchCorpus audit rejects the planted
 *       body outright (pre-egress, zero fetch).
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUITE = 'test-futures-part8-leak';
const REPO = path.join(__dirname, '..');
const orch = require(path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const realCorpus = require(path.join(REPO, 'lib', 'core', 'research-corpus.cjs'));
const realCache = require(path.join(REPO, 'lib', 'core', 'research-cache.cjs'));

function pass(msg) { process.stdout.write('  ok - ' + msg + '\n'); }

// The full surface the FW-11 floor covers: every new Phase-156 code file.
const FUTURES_SOURCES = [
  'lib/core/futures/orchestrator.cjs',
  'lib/core/futures/causal-cue.cjs',
  'lib/core/futures/subsystem-render.cjs',
  'commands/futures.md',
];

// The planted body opens with generic-looking words (a realistic seed phrase)
// and buries the sensitive payload (a SECRET marker, proprietary numbers, an
// email) DEEP in the body. The Part 8 floor: the deep room payload can never
// cross to fetchCorpus, and the real audit fails closed on it.
const PLANTED_BODY = 'urban mobility automation trends then SECRETROOMBODY the proprietary financial model projects 47x return for investor jonathan@example.com';

(async () => {
  let tmp;
  try {
    // =====================================================================
    // (A) STATIC source scan over all new futures code.
    // =====================================================================

    for (const rel of FUTURES_SOURCES) {
      const p = path.join(REPO, rel);
      assert.ok(fs.existsSync(p), 'FW-11 surface file exists: ' + rel);
      const src = fs.readFileSync(p, 'utf8');

      // A1. No Brain-write / Brain-mutation call (the canonical breach: writing
      //     user bytes to the Brain). The futures pipeline NEVER writes to Brain.
      assert.ok(!/mcp__brain_(write|store|upsert|ingest)/.test(src), rel + ': no Brain-write MCP call');
      assert.ok(!/brain[._-]?write|writeBrain|sendToBrain|ingestToBrain/i.test(src), rel + ': no brain-write helper call');

      // A2. No raw external HTTP egress in the futures code itself. External
      //     SIGNAL fetching is delegated to research-corpus.fetchCorpus (which
      //     owns the single audited egress chokepoint); the futures code must
      //     not open its own fetch/http/curl path that could carry room bytes.
      assert.ok(!/\bfetch\s*\(/.test(src), rel + ': no raw fetch( call (egress delegated to fetchCorpus chokepoint)');
      assert.ok(!/https?:\/\/(?!github\.com)/.test(src), rel + ': no hardcoded external http(s) endpoint');
      assert.ok(!/child_process[\s\S]{0,40}curl|execSync\(['"]curl/.test(src), rel + ': no curl egress');
    }
    pass('static scan: no Brain-write / raw external egress in any futures source');

    // A3. The orchestrator's ONLY corpus call passes the genericDomainHandle
    //     output to fetchCorpus -- never a raw consequence body. Assert the
    //     fetchCorpus query argument is the `handle` variable (the clamped
    //     generic handle), not a body field.
    const orchSrc = fs.readFileSync(path.join(REPO, 'lib/core/futures/orchestrator.cjs'), 'utf8');
    // The single fetchCorpus call site must pass query: handle (the clamp output).
    assert.ok(/corpus\.fetchCorpus\(\{\s*source,\s*query:\s*handle/.test(orchSrc.replace(/\s+/g, ' ').replace(/ /g, ' ')) ||
      /fetchCorpus\(\{ source, query: handle/.test(orchSrc),
      'the orchestrator passes the clamped generic handle to fetchCorpus (not a body)');
    // No fetchCorpus call passes a *.body / consequence body straight through.
    assert.ok(!/fetchCorpus\([^)]*\.body/.test(orchSrc), 'no fetchCorpus call passes a .body field');
    pass('static scan: the SIGNAL fetch query is the clamped generic handle only');

    // =====================================================================
    // (B) RUNTIME adversarial: planted room content must not reach fetchCorpus.
    // =====================================================================
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-part8-'));

    const seen = [];
    const recordingCorpus = {
      fetchCorpus: async (args) => { seen.push(args.query); return []; },
    };

    // Drive seedGrounding + perRingResearch + runSignalResearch with the planted
    // body as the input "query" / domain handle. The genericDomainHandle clamp
    // must strip the planted payload before fetchCorpus sees it.
    await orch.seedGrounding(tmp, PLANTED_BODY, { corpus: recordingCorpus, cache: realCache });
    await orch.runSignalResearch(tmp, PLANTED_BODY, { corpus: recordingCorpus, cache: realCache });
    const ring = [{ id: 'x', ring: 1, parent_id: null, domain: 'Economic', horizon: 'mid', confidence: 0.5, label: 'l' }];
    await orch.perRingResearch(tmp, ring, PLANTED_BODY, { corpus: recordingCorpus, cache: realCache });

    assert.ok(seen.length >= 1, 'the SIGNAL path fired at least one fetch');
    for (const q of seen) {
      assert.ok(!/SECRETROOMBODY/.test(q), 'tripwire: SECRETROOMBODY never reaches fetchCorpus (got: ' + q + ')');
      assert.ok(!/jonathan@example\.com/.test(q), 'tripwire: the email never reaches fetchCorpus');
      assert.ok(!/proprietary|47x return|financial model/.test(q), 'tripwire: the deep proprietary body never reaches fetchCorpus');
      assert.ok(q.split(' ').length <= 6, 'tripwire: every fetchCorpus query is a bounded generic handle');
    }
    pass('runtime: planted room content (SECRET body + email) never reaches fetchCorpus');

    // B2. The REAL fetchCorpus audit chokepoint rejects the planted body outright
    //     (pre-egress; zero fetch). Defense-in-depth: even if the clamp were
    //     bypassed, the shipped audit fails closed.
    let threw = false;
    try {
      await realCorpus.fetchCorpus({ source: 'openalex', query: PLANTED_BODY, limit: 1 });
    } catch (_e) {
      threw = true;
    }
    assert.strictEqual(threw, true, 'the real fetchCorpus audit rejects the planted user-content body pre-egress');
    pass('runtime: the real research-corpus audit chokepoint fails closed on the planted body');

    // B3. The chaining handoffs make ZERO Brain/external call -- the resolver is
    //     plugin-local. surfaceChainingHandoffs over a planted-body consequence
    //     must not surface the body anywhere in its output.
    const planted = [
      { id: 'p1', ring: 1, parent_id: null, domain: 'Technological', horizon: 'near', confidence: 0.7, label: PLANTED_BODY, body: PLANTED_BODY },
      { id: 'p2', ring: 2, parent_id: 'p1', domain: 'Economic', horizon: 'mid', confidence: 0.6, label: 'effect' },
    ];
    const handoffs = orch.surfaceChainingHandoffs(tmp, planted, { bridges: [{ source: 'p1', target: 'p2', hsi_score: 0.7, crossDomain: true }] });
    const serialized = JSON.stringify(handoffs);
    assert.ok(!/SECRETROOMBODY/.test(serialized), 'surfaceChainingHandoffs output carries no room body');
    assert.ok(!/jonathan@example\.com/.test(serialized), 'surfaceChainingHandoffs output carries no email');
    pass('runtime: chaining handoffs surface zero room content (resolver is plugin-local)');

    process.stdout.write(SUITE + ': PASS\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(SUITE + ': FAIL: ' + err.message + '\n' + (err.stack || '') + '\n');
    process.exit(1);
  } finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
  }
})();
