'use strict';
// SEED-026 W3 (Phase 162-03 Task 1): adversarial Canon Part 8 leak test +
// brain-boundary-scan over the getGraphExport payload.
//
// WHY THIS EXISTS: getGraphExport is a BROAD READ that can land in a deployable
// present/ HTML artifact (graph.html + dashboard). Per Canon Part 8 + the
// Black-hat HIGH risk, the published payload MUST be adversarially proven clean:
// it must NEVER carry a correlation_id, a Brain-correlated id, a raw source_path,
// a meeting-transcript-shaped prose blob, a personal identifier, a proprietary
// number string, or a raw secret -- even when those bytes are sitting in the
// room.db node properties the export reads. The whitelist in graph-export.cjs
// makes the boundary structural; THIS test attacks that whitelist by construction.
//
// Mirrors the 9-tripwire idiom in tests/test-navigation-packet-part8-leak.cjs:
// seed hostile values into node properties, serialize the WHOLE export, assert
// every hostile byte is absent. Extends tests/test-graph-export.cjs lines 127-144
// (the existing single-node whitelist test) with: 6+ distinct hostile vectors,
// a per-node EXACT-key-set structural assertion (catches a future field-addition
// leak), and a benign negative control (the scan is not over-broad).
//
// Canon Part 8: tests are LOCAL only, zero Brain egress. No network surface here.
//
// Run: node tests/test-graph-export-part8-leak.cjs

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const lgOps = require('../lib/core/lazygraph-ops.cjs');
const { getGraphExport } = require('../lib/core/navigation/graph-export.cjs');

let pass = 0;
let fail = 0;
function ok(name) { pass += 1; console.log('  PASS ' + name); }
function bad(name, e) { fail += 1; console.log('  FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); }
async function test(name, fn) { try { await fn(); ok(name); } catch (e) { bad(name, e); } }

function tmpRoom(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'ge-p8-leak-'));
}

// Seed nodes (and optional edges) into a fresh room.db. FK is ON in openGraph,
// so nodes are inserted before edges (mirrors tests/test-graph-export.cjs seedDb).
async function seedDb(roomDir, nodes, edges) {
  const { db, conn } = await lgOps.openGraph(roomDir);
  for (const n of nodes) {
    conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run(n.id, n.type, JSON.stringify(n.properties || {}));
  }
  for (const e of (edges || [])) {
    conn.prepare('INSERT INTO edges (source, target, type) VALUES (?, ?, ?)').run(e.source, e.target, e.type);
  }
  await lgOps.closeGraph(db);
}

// The Canon Part 8 whitelist: node.data may carry EXACTLY these keys and no
// others. A future field-addition leak (someone adds source_path to node.data)
// is caught by asserting the exact key set per node.
const ALLOWED_NODE_DATA_KEYS = ['id', 'label', 'type', 'knowledge_type', 'color', 'degree', 'review_status'];

(async () => {
  console.log('SEED-026 graph-export Part 8 adversarial leak test (boundary-scan)');

  // ---- 1. Boundary-scan: 6+ hostile vectors absent from the serialized export ----
  await test('boundary-scan: no hostile byte (correlation_id/brain_id/source_path/transcript/personal/proprietary/secret) reaches the export', async () => {
    const room = tmpRoom('ge-p8-scan-');

    // Every distinct leak vector, seeded into node properties. The label-bearing
    // title is BENIGN on purpose (see the negative control below); all the
    // HOSTILE bytes live in non-whitelisted property keys.
    const HOSTILE = {
      correlation_id: 'CORRELATE-LOCAL-VS-BRAIN-0xDEADBEEF',          // the load-bearing Part 8 vector
      brain_id: 'BRAIN-NODE-998877',                                  // Brain-correlated id must never egress
      source_path: '/home/jsagi/secret/ventures/decision-financials.md', // raw absolute source path
      transcript: 'T'.repeat(900) + ' MEETING-TRANSCRIPT-SECRETPROSE',// transcript-shaped prose blob
      personal: 'patient-jane-doe-ssn-078-05-1120',                  // personal identifier (HIPAA-shaped)
      proprietary: 'ARR-4200000-burn-380000-runway-11mo',            // proprietary number string
      secret: 'sk-live-DO-NOT-EGRESS-7Hk2',                          // raw secret
    };

    await seedDb(room,
      [
        { id: 'c1', type: 'claim', properties: Object.assign({ knowledge_type: 'fact', title: 'Unit economics hold' }, HOSTILE) },
        { id: 'd1', type: 'decision', properties: Object.assign({ title: 'Proceed to seed round' }, HOSTILE) },
        { id: 'o1', type: 'opportunity', properties: Object.assign({ title: 'Adjacent market entry' }, HOSTILE) },
        { id: 'gt', type: 'governing_thought', properties: Object.assign({ title: 'We win on time-to-decision' }, HOSTILE) },
      ],
      [
        { source: 'gt', target: 'c1', type: 'STATES' },
        { source: 'c1', target: 'd1', type: 'INFORMS' },
        { source: 'd1', target: 'o1', type: 'ENABLES' },
      ]
    );

    const r = await getGraphExport(room);
    assert.strictEqual(r.ok, true, 'export ok');
    assert.strictEqual(r.cold_start, false, 'real room, not cold-start');

    const serialized = JSON.stringify(r);

    // The boundary-scan: NONE of the hostile bytes appear anywhere in the payload.
    for (const [vector, value] of Object.entries(HOSTILE)) {
      assert.ok(!serialized.includes(value),
        'hostile vector "' + vector + '" leaked into the serialized export');
    }
    // Belt-and-suspenders distinctive-token sweep (regex, vector-independent).
    assert.ok(!/CORRELATE-LOCAL-VS-BRAIN/.test(serialized), 'no correlation_id token');
    assert.ok(!/BRAIN-NODE-\d+/.test(serialized), 'no brain_id token');
    assert.ok(!/\/home\/jsagi\//.test(serialized), 'no absolute /home path');
    assert.ok(!/SECRETPROSE/.test(serialized), 'no transcript prose token');
    assert.ok(!/sk-live-/.test(serialized), 'no raw secret token');

    // No string field anywhere in the payload is transcript-length (>500 chars).
    function deepFindLong(obj, depth) {
      if (depth > 12) return false;
      if (typeof obj === 'string') return obj.length > 500;
      if (Array.isArray(obj)) return obj.some((x) => deepFindLong(x, depth + 1));
      if (obj && typeof obj === 'object') return Object.values(obj).some((x) => deepFindLong(x, depth + 1));
      return false;
    }
    assert.ok(!deepFindLong(r, 0), 'no string field exceeds 500 chars (no transcript blob)');

    fs.rmSync(room, { recursive: true, force: true });
  });

  // ---- 2. Structural: node.data has EXACTLY the whitelist keys (no extras) ----
  await test('structural: every node.data key set equals exactly the Part 8 whitelist', async () => {
    const room = tmpRoom('ge-p8-keys-');
    await seedDb(room,
      [
        { id: 'c1', type: 'claim', properties: { knowledge_type: 'mental_model', title: 'Benign claim', correlation_id: 'LEAK-X', source_path: '/home/jsagi/x.md' } },
        { id: 'a1', type: 'assumption', properties: { title: 'Benign assumption', secret: 'nope' } },
        { id: 'gt', type: 'governing_thought', properties: { title: 'Benign GT' } },
      ],
      []
    );
    const r = await getGraphExport(room);
    assert.ok(r.elements.nodes.length >= 3, 'all seeded knowledge nodes rendered');
    const want = ALLOWED_NODE_DATA_KEYS.slice().sort();
    for (const n of r.elements.nodes) {
      const got = Object.keys(n.data).sort();
      assert.deepStrictEqual(got, want,
        'node ' + n.data.id + ' data keys must equal the whitelist exactly (got ' + JSON.stringify(got) + ')');
      // Explicit forbidden-key assertions (redundant with the exact-set check,
      // but they name the specific leak vectors for a clearer failure message).
      assert.ok(!('properties' in n.data), 'node.data never carries the raw properties blob');
      assert.ok(!('source_path' in n.data), 'node.data never carries source_path');
      assert.ok(!('correlation_id' in n.data), 'node.data never carries correlation_id');
      assert.ok(!('brain_id' in n.data), 'node.data never carries brain_id');
    }
    fs.rmSync(room, { recursive: true, force: true });
  });

  // ---- 3. Negative control: a BENIGN allowed label DOES survive ----
  // Proves the scan is not over-broad: the export still publishes the local
  // render fields it is supposed to (label), so the boundary blocks hostile bytes
  // WITHOUT blanking the legitimate viz.
  await test('negative control: a benign title survives as the node label (scan is not over-broad)', async () => {
    const room = tmpRoom('ge-p8-benign-');
    const BENIGN = 'Quantum brain imaging unlocks early diagnosis';
    await seedDb(room,
      [{ id: 'c1', type: 'claim', properties: { knowledge_type: 'fact', title: BENIGN, correlation_id: 'LEAK-BENIGN-TEST' } }],
      []
    );
    const r = await getGraphExport(room);
    const serialized = JSON.stringify(r);
    // The benign title IS present (positive control)...
    assert.ok(serialized.includes(BENIGN), 'benign title must survive as the label');
    const c1 = r.elements.nodes.find((n) => n.data.id === 'c1');
    assert.ok(c1, 'claim node rendered');
    assert.strictEqual(c1.data.label, BENIGN, 'benign title is the label');
    // ...while the hostile correlation_id sitting on the SAME node is still gone.
    assert.ok(!serialized.includes('LEAK-BENIGN-TEST'), 'correlation_id on a benign node is still blocked');
    fs.rmSync(room, { recursive: true, force: true });
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
