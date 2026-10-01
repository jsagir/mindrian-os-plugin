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
const os = require('node:os');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const verification = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'verification.cjs'));
const { STANDING_WORDS, claimStanding } = verification;
const { getRoomHomeView } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-home.cjs'));
const { getGraphExport } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'graph-export.cjs'));
const insights = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'insights.cjs'));
const { renderExplanation } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'explanation.cjs'));
const { getResearchPreflight } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'research-preflight.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

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

// ---------------------------------------------------------------------------
// Task 2 legs: B5..B7
// ---------------------------------------------------------------------------
async function runTaskTwoLegs(room) {
  const db = fx.openFresh(room.room);
  try {
    const c = seedStandings(db);

    await check('B5 findUnsupportedClaims rows gain standing and standing_words; the explanation string is unchanged', () => {
      const rows = insights.findUnsupportedClaims(db, 'room:b5');
      const byId = new Map(rows.map((r) => [r.claim.id, r]));
      for (const id of [c.none, c.ask, c.src, c.loc]) {
        const row = byId.get(id);
        assert.ok(row, 'claim ' + id + ' is unsupported (no SUPPORTS edge)');
        const st = claimStanding(db, id).standing;
        assert.equal(row.standing, st);
        assert.equal(row.standing_words, STANDING_WORDS[st].label);
        const want = renderExplanation('unsupported', {
          claim: row.claim.id, reviewStatus: row.claim.reviewStatus, lastSeenAt: row.claim.lastSeenAt,
        });
        assert.equal(row.explanation, want, 'explanation is byte-identical to the template output');
        assert.ok(row.explanation.indexOf(STANDING_WORDS[st].label) === -1, 'the explanation does not carry the new words');
      }
      assert.deepEqual(Object.keys(byId.get(c.ask)).sort(),
        ['claim', 'explanation', 'missingEvidenceFor', 'standing', 'standing_words']);
    });

    await check('B6 research preflight evidence_gaps claim entries carry standing_words', () => {
      const pre = getResearchPreflight(db, { roomDir: room.room });
      const gaps = pre.evidence_gaps.filter((g) => g && g.claim && g.claim.id === c.ask);
      assert.equal(gaps.length, 1, 'the held model-only claim shows up as one gap');
      assert.equal(gaps[0].standing_words, STANDING_WORDS.model_only.label);
      assert.equal(gaps[0].standing, 'model_only');
    });

    await check('B7 the Brain packet unsupported projection keys are unchanged and carry no standing words', async () => {
      const mocks = { jtbd: { getCurrent: () => ({ current: null }) }, operator: { getCurrent: () => ({ current: null }) } };
      const packet = await navigation.buildBrainPacket(db, 'suggest_next_move', c.none, { _mocks: mocks, roomId: 'b5' });
      const un = packet.local_graph_summary.unsupported_claims;
      assert.ok(Array.isArray(un) && un.length >= 1, 'the packet lists unsupported claims');
      // The key list captured from the PLAN_BASE version of safeUnsupportedProjection.
      const BASE_KEYS = ['claimId', 'explanation', 'lastSeenAt', 'reviewStatus', 'type'];
      for (const u of un) assert.deepEqual(Object.keys(u).sort(), BASE_KEYS);
      const wire = JSON.stringify(packet);
      for (const w of Object.values(STANDING_WORDS)) {
        assert.ok(wire.indexOf(w.label) === -1, 'no standing label crosses to the Brain');
      }
      assert.ok(wire.indexOf('standing_words') === -1 && wire.indexOf('verification_words') === -1);
    });
  } finally {
    try { db.close(); } catch (_e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Task 3 legs: B8..B10
// ---------------------------------------------------------------------------

// Load lib/graph/graph-detail-panel.js in a vm context with a minimal document
// stub. esc() builds a div, sets textContent and reads innerHTML, so the stub
// escapes on textContent assignment.
function loadPanel() {
  const content = { innerHTML: '' };
  function makeEl() {
    const el = {
      style: {},
      className: '',
      classList: { add() {}, remove() {} },
      appendChild() {},
      addEventListener() {},
      querySelector(sel) { return sel === '.gdp-content' ? content : { addEventListener() {} }; },
      _html: '',
    };
    Object.defineProperty(el, 'textContent', {
      set(v) {
        this._html = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      },
      get() { return ''; },
    });
    Object.defineProperty(el, 'innerHTML', {
      set(v) { this._html = String(v); },
      get() { return this._html; },
    });
    return el;
  }
  const sandbox = {
    document: { createElement: makeEl, body: makeEl(), addEventListener() {} },
  };
  const ctx = vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'graph', 'graph-detail-panel.js'), 'utf8');
  vm.runInContext(src, ctx);
  const panel = vm.runInContext('GraphDetailPanel', ctx);
  return { panel, content };
}

async function runTaskThreeLegs() {
  await check('B8 the node detail panel shows a Checked against row from verification_words (escaped); absent field adds nothing', () => {
    const label = STANDING_WORDS.model_only.label;
    const withRow = loadPanel();
    withRow.panel.show({ id: 'claim:1', label: 'A claim', type: 'claim', verification_words: label }, []);
    const htmlWith = withRow.content.innerHTML;
    const row = '<div class="gdp-section-row">Checked against: <span>' + label + '</span></div>';
    assert.ok(htmlWith.indexOf(row) !== -1, 'the row is rendered with the words');
    const noRow = loadPanel();
    noRow.panel.show({ id: 'claim:1', label: 'A claim', type: 'claim' }, []);
    const htmlWithout = noRow.content.innerHTML;
    assert.ok(htmlWithout.indexOf('Checked against') === -1, 'no row without the field');
    assert.equal(htmlWith.replace(row, ''), htmlWithout, 'the rest of the panel is unchanged');
    const esc = loadPanel();
    esc.panel.show({ id: 'claim:2', label: 'x', verification_words: '<img src=x onerror=alert(1)>' }, []);
    assert.ok(esc.content.innerHTML.indexOf('<img') === -1, 'the words are escaped');
    assert.ok(esc.content.innerHTML.indexOf('&lt;img') !== -1);
    const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'graph', 'graph-detail-panel.js'), 'utf8');
    const block = src.slice(src.indexOf('Phase 365-12'), src.indexOf('// Cross-section connections'));
    const code = block.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(code.indexOf('verification_words') !== -1, 'the block reads verification_words');
    assert.ok(!/score|percent|badge|color|%/i.test(code), 'no score, percent, badge or color in the new code');
  });

  await check('B9 generate-presentation carries a claim node verification_words into graph.html end to end', () => {
    let room;
    try {
      room = fx.makeRoom365('b5-pres');
    } catch (e) {
      return 'skipped: ' + ((e && e.message) || e);
    }
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-365-b5-pres-'));
    try {
      const db = fx.openFresh(room.room);
      try {
        const id = fx.seedClaim(db, { text: 'A model-only claim for the presentation.', variant: 'b5-pres' });
        fx.recordAsk(db, id, { rung: 2 });
      } finally {
        try { db.close(); } catch (_e) { /* ignore */ }
      }
      const r = spawnSync(process.execPath, [
        path.join(REPO_ROOT, 'scripts', 'generate-presentation.cjs'), room.room, '--output', out,
      ], { encoding: 'utf8', timeout: 60000 });
      assert.equal(r.status, 0, 'generate-presentation exits 0: ' + String(r.stderr || '').slice(0, 200));
      const html = fs.readFileSync(path.join(out, 'graph.html'), 'utf8');
      const want = '"verification_words":' + JSON.stringify(STANDING_WORDS.model_only.label);
      assert.ok(html.indexOf(want) !== -1, 'graph.html ROOM_DATA carries the words');
      assert.ok(html.indexOf('"verification_standing":"model_only"') !== -1);
    } finally {
      try { fs.rmSync(out, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
      fx.cleanup(room);
    }
  });

  await check('B10 the dashboard template renders no claim node detail, so it needs no hook', () => {
    const dash = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'presentation', 'dashboard.html'), 'utf8');
    assert.ok(!/GraphDetailPanel|onNodeClick/.test(dash),
      'dashboard.html gained a node detail; it must show the same verification_words row');
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
  let room2;
  try {
    room2 = fx.makeRoom365('b5-renders-2');
  } catch (e) {
    process.stdout.write('SKIP: scratch room unavailable: ' + ((e && e.message) || e) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  try {
    await runTaskTwoLegs(room2);
  } finally {
    fx.cleanup(room2);
  }
  await runTaskThreeLegs();
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
