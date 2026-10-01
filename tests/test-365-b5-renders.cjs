#!/usr/bin/env node
'use strict';

/*
 * Phase 365-12 -- B5: every remaining per-claim renderer names the claim's
 * standing in words from the ONE shared map (D-19).
 *
 * Legs:
 *   B1..B4  room home facts, held claims, graph export rows, one-map static scan
 *   B5..B7  unsupported findings, research preflight gaps, Brain packet unchanged
 *   B8..B10 presentation graph node detail panel, end-to-end carry, dashboard
 *
 * Plain node:assert/strict on scratch rooms. No em-dash or en-dash in this
 * file: the checks spell those characters as escapes. Exit 0 pass, 1 fail,
 * 77 env gap.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const verification = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'verification.cjs'));
const { STANDING_WORDS, claimStanding } = verification;
const { getRoomHomeView } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-home.cjs'));
const { getGraphExport } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'graph-export.cjs'));

const DASHES = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');

let failures = 0;
async function check(label, fn) {
  try {
    const note = await fn();
    process.stdout.write('  ok - ' + label + (note ? ' (' + note + ')' : '') + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('  FAIL - ' + label + ' :: ' + String((e && e.message) || e).split('\n')[0] + '\n');
  }
}

function setStatus(db, id, status) {
  db.prepare('UPDATE nodes SET review_status = ? WHERE id = ?').run(status, id);
}

// A scratch room with four claims at known standings:
//   cNone  held, no check            -> none
//   cAsk   held, asked of a model    -> model_only
//   cSrc   confirmed, source edge    -> source_edge
//   cLoc   confirmed, located source -> located_source
function seedStandings(db) {
  const c = {};
  c.none = fx.seedClaim(db, { text: 'Held claim with no check at all.', variant: 'b5-none' });
  c.ask = fx.seedClaim(db, { text: 'Held claim only asked of a model.', variant: 'b5-ask' });
  c.src = fx.seedClaim(db, { text: 'Confirmed claim with a source document.', variant: 'b5-src' });
  c.loc = fx.seedClaim(db, { text: 'Confirmed claim with a located source.', variant: 'b5-loc' });
  fx.recordAsk(db, c.ask, { rung: 2 });
  c.srcEv = fx.addSourceEdge(db, c.src, { url: 'https://example.org/a', retrieved_at: '2026-09-30', variant: 'b5-src' });
  c.locEv = fx.addSourceEdge(db, c.loc, { url: 'https://example.org/b', retrieved_at: '2026-09-30', locator: 'section 2', variant: 'b5-loc' });
  setStatus(db, c.none, 'needs_evidence');
  setStatus(db, c.ask, 'needs_evidence');
  setStatus(db, c.src, 'confirmed');
  setStatus(db, c.loc, 'confirmed');
  return c;
}

// ---------------------------------------------------------------------------
// Task 1 legs: B1..B4
// ---------------------------------------------------------------------------
async function runTaskOneLegs(room) {
  const db = fx.openFresh(room.room);
  let c;
  try {
    c = seedStandings(db);

    await check('B1 room home facts name each claim standing in STANDING_WORDS words; every existing key stays', () => {
      const view = getRoomHomeView(db, 'b5-room', {});
      const byId = new Map(view.confirmedFacts.map((r) => [r.id, r]));
      assert.ok(byId.has(c.src) && byId.has(c.loc), 'both confirmed claims are facts');
      const src = byId.get(c.src);
      const loc = byId.get(c.loc);
      assert.equal(src.standing, 'source_edge');
      assert.equal(src.standing_words, STANDING_WORDS.source_edge.label);
      assert.equal(loc.standing, 'located_source');
      assert.equal(loc.standing_words, STANDING_WORDS.located_source.label);
      for (const k of ['id', 'type', 'summary', 'reviewStatus', 'confidence', 'lastSeenAt']) {
        assert.ok(Object.prototype.hasOwnProperty.call(src, k), 'fact row keeps ' + k);
      }
      const keys = Object.keys(view).sort();
      for (const k of ['currentThesis', 'confirmedFacts', 'riskyAssumptions', 'evidence', 'contradictions',
        'openQuestions', 'recentChanges', 'bankedOpportunities', 'nextMove']) {
        assert.ok(keys.includes(k), 'room home keeps ' + k);
      }
    });

    await check('B2 room home held_claims lists needs_evidence claims with standing words and the move that releases them', () => {
      const view = getRoomHomeView(db, 'b5-room', {});
      assert.ok(Array.isArray(view.held_claims));
      const byId = new Map(view.held_claims.map((r) => [r.id, r]));
      assert.equal(view.held_claims.length, 2, 'exactly the two held claims');
      const ask = byId.get(c.ask);
      const none = byId.get(c.none);
      assert.ok(ask && none, 'both held claims are listed');
      assert.equal(ask.standing, 'model_only');
      assert.equal(ask.standing_words, STANDING_WORDS.model_only.label);
      assert.equal(ask.moves_when, STANDING_WORDS.model_only.moves_when);
      assert.equal(none.standing, 'none');
      assert.equal(none.moves_when, STANDING_WORDS.none.moves_when);
      assert.ok(/held claim only asked/i.test(ask.text), 'the claim text is shown, got ' + JSON.stringify(ask.text));
      assert.deepEqual(Object.keys(ask).sort(), ['id', 'moves_when', 'standing', 'standing_words', 'text']);
      // a held claim is neither a fact nor a risky assumption: it was invisible before
      assert.ok(!view.confirmedFacts.some((r) => r.id === c.ask));
      assert.ok(!view.riskyAssumptions.some((r) => r.id === c.ask));
      // empty list when none held
      setStatus(db, c.none, 'confirmed');
      setStatus(db, c.ask, 'confirmed');
      const after = getRoomHomeView(db, 'b5-room', {});
      assert.deepEqual(after.held_claims, []);
      setStatus(db, c.none, 'needs_evidence');
      setStatus(db, c.ask, 'needs_evidence');
    });
  } finally {
    try { db.close(); } catch (_e) { /* ignore */ }
  }

  await check('B3 graph export claim rows gain verification_standing and verification_words (equal to claimStanding); other rows keep the 7 keys', async () => {
    const out = await getGraphExport(room.room, {});
    assert.equal(out.ok, true, 'export ok: ' + (out.error || ''));
    const nodes = new Map(out.elements.nodes.map((n) => [n.data.id, n.data]));
    const verifyDb = fx.openFresh(room.room);
    try {
      for (const [key, id] of Object.entries({ none: c.none, ask: c.ask, src: c.src, loc: c.loc })) {
        const d = nodes.get(id);
        assert.ok(d, 'claim ' + key + ' is in the export');
        const st = claimStanding(verifyDb, id).standing;
        assert.equal(d.verification_standing, st, key + ' standing equals claimStanding');
        assert.equal(d.verification_words, STANDING_WORDS[st].label, key + ' words come from the one map');
      }
    } finally {
      try { verifyDb.close(); } catch (_e) { /* ignore */ }
    }
    const base = ['color', 'degree', 'id', 'knowledge_type', 'label', 'review_status', 'type'];
    let nonClaim = 0;
    for (const d of nodes.values()) {
      if (d.type === 'claim') continue;
      nonClaim += 1;
      assert.deepEqual(Object.keys(d).sort(), base, 'non-claim row ' + d.id + ' is unchanged');
    }
    assert.ok(nonClaim >= 1, 'the fixture holds at least one non-claim row');
    return nonClaim + ' non-claim rows unchanged';
  });

  await check('B4 one map: no STANDING_WORDS label string is written in lib, scripts or commands outside verification.cjs', () => {
    const labels = Object.values(STANDING_WORDS).map((w) => w.label);
    assert.equal(labels.length, 4);
    const own = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'verification.cjs');
    const hits = [];
    function walk(dir, exts) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full, exts); continue; }
        if (!exts.some((x) => e.name.endsWith(x))) continue;
        if (full === own) continue;
        let text;
        try { text = fs.readFileSync(full, 'utf8'); } catch (_e) { continue; }
        for (const l of labels) {
          if (text.indexOf(l) !== -1) hits.push(path.relative(REPO_ROOT, full) + ' :: ' + l);
        }
      }
    }
    walk(path.join(REPO_ROOT, 'lib'), ['.cjs', '.js', '.mjs']);
    walk(path.join(REPO_ROOT, 'scripts'), ['.cjs', '.js', '.mjs']);
    walk(path.join(REPO_ROOT, 'commands'), ['.md']);
    assert.deepEqual(hits, [], 'a label string is written outside the one map');
  });

  await check('B0 this test file carries no em-dash or en-dash', () => {
    assert.ok(!DASHES.test(fs.readFileSync(__filename, 'utf8')));
  });
}

async function main() {
  let room;
  try {
    room = fx.makeRoom365('b5-renders');
  } catch (e) {
    process.stdout.write('SKIP: scratch room unavailable: ' + ((e && e.message) || e) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  try {
    await runTaskOneLegs(room);
  } finally {
    fx.cleanup(room);
  }
  if (failures > 0) {
    process.stdout.write('FAILED: ' + failures + ' leg(s)\n');
    return 1;
  }
  process.stdout.write('PASS: test-365-b5-renders\n');
  return 0;
}

main().then((code) => process.exit(code), (e) => {
  process.stdout.write('FATAL: ' + ((e && e.stack) || e) + '\n');
  process.exit(1);
});
