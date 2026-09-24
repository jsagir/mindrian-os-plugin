#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 19 (HIPS-06, HIPS-01, D-15, D-41, D-42, D-53) -- RED until
 * Task 2 (the atomic schema bump) and Task 3 (the writer + fire-once ledger
 * + evidence bag) land.
 *
 * Pins every v2 promise: the atomic bump keeps probeGuard available (the
 * critic-tags probe is decoupled from the side-channel schema version),
 * buildSideChannelPayload/validateClosedSchema accept the v2 key set (v1
 * plus stamp + opportunity_handle) and reject every poisoned shape,
 * writeStampedSideChannel only ever writes a validated payload,
 * sensorEureka's evidence bag carries the stamp fields and the fire-once
 * dedup ledger, and markEurekaReachSurfaced is an idempotent atomic ledger
 * writer. The sensor stays zod-free and never requires verification-stamp.cjs
 * or writes a file during a call.
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { check, summary } = hygiene.makeChecker('355-19 side-channel v2 + fire-once (D-15, D-42, D-53)');

const REPO = path.join(__dirname, '..');
const runnerMod = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-reach-runner.cjs'));
const sensorMod = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'));
const { sensorEureka } = sensorMod;

function tmpRoom(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-19-' + label + '-'));
  return dir;
}

function writeSideChannel(roomDir, payloadObj) {
  const side = path.join(roomDir, '.mindrian');
  fs.mkdirSync(side, { recursive: true });
  const file = path.join(side, 'last-eureka.json');
  if (typeof payloadObj === 'string') {
    fs.writeFileSync(file, payloadObj, 'utf8');
  } else {
    fs.writeFileSync(file, JSON.stringify(payloadObj), 'utf8');
  }
  return file;
}

function writeLedger(roomDir, obj) {
  const side = path.join(roomDir, '.mindrian');
  fs.mkdirSync(side, { recursive: true });
  const file = path.join(side, 'eureka-reach-ledger.json');
  if (typeof obj === 'string') {
    fs.writeFileSync(file, obj, 'utf8');
  } else {
    fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
  }
  return file;
}

const VERIFIED_STAMP = {
  verification: 'strong',
  backend: 'theo',
  direction: 'structural_transfer',
  judge: 'none',
  path: { nodes: ['Reverse Salient Analysis', 'Six Thinking Hats'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
};

const UNVERIFIED_STAMP = {
  verification: 'unverified',
  backend: 'unavailable',
  direction: 'none',
  judge: 'none',
  reason: 'backend_unavailable',
};

const PAIR = [{ handle: 'n1', text: 'alpha beta gamma delta' }, { handle: 'n2', text: 'omega psi chi phi' }];

function stubCriticCleared() {
  return {
    criticRule: function () { return { verdict: 'general_shallow', confidence: 'high', reasoning_tag: 'passes_all_gates' }; },
    loadCriticTags: function () { return { schema_version: 1, verdicts: ['transferable', 'restatement', 'pseudoscience', 'general_shallow'], domain_tags: ['unknown'] }; },
    stageA: function () { return Promise.resolve({ pass: true, features: {} }); },
    assembleCriticPayload: function (f) { return Object.assign({}, f, { schema_version: 1 }); },
  };
}

function firingScore() {
  return {
    semantic: 0.8, lexical: 0.2, signed_diff: 0.6, abs_diff: 0.6,
    direction: 'structural_transfer', passes: true, band: 'breakthrough',
    provenance: { semantic_model: 'stub-model' },
  };
}

async function main() {
  // -----------------------------------------------------------------------
  // 1. probeGuard() still available:true after the bump (critic tags v1,
  //    decoupled from SIDE_CHANNEL_SCHEMA_VERSION).
  // -----------------------------------------------------------------------
  {
    check('runnerMod exports CRITIC_TAGS_SCHEMA_VERSION === 1', runnerMod.CRITIC_TAGS_SCHEMA_VERSION === 1);
    check('runnerMod SIDE_CHANNEL_SCHEMA_VERSION === 2', runnerMod.SIDE_CHANNEL_SCHEMA_VERSION === 2);
    const g = await runnerMod.probeGuard({ criticProbeFn: stubCriticCleared });
    check('probeGuard({criticProbeFn: v1-tags stub}) -> available true', g && g.available === true, g && JSON.stringify(g));
  }

  // -----------------------------------------------------------------------
  // 2. buildSideChannelPayload v2 shape: schema_version 2, v1 keys + stamp +
  //    opportunity_handle; both null when absent.
  // -----------------------------------------------------------------------
  {
    const a = { handle: 'n042' };
    const b = { handle: 'n317' };
    const noStampPayload = runnerMod.buildSideChannelPayload(firingScore(), { verdict: 'transferable', confidence: 'high', tags: [] }, a, b, {});
    check('buildSideChannelPayload with no stamp -> schema_version 2', noStampPayload && noStampPayload.schema_version === 2);
    check('buildSideChannelPayload with no stamp -> stamp null', noStampPayload && noStampPayload.stamp === null);
    check('buildSideChannelPayload with no stamp -> opportunity_handle null', noStampPayload && noStampPayload.opportunity_handle === null);
    check(
      'buildSideChannelPayload with no stamp -> exactly the v1 keys + stamp + opportunity_handle',
      noStampPayload && Object.keys(noStampPayload).sort().join(',') === 'bridge,guard,opportunity_handle,provenance,scanned_at,schema_version,stamp'
    );

    const withStampPayload = runnerMod.buildSideChannelPayload(
      firingScore(), { verdict: 'transferable', confidence: 'high', tags: [] }, a, b,
      { stamp: VERIFIED_STAMP, opportunityHandle: 'opp-handle-1' }
    );
    check('buildSideChannelPayload with a stamp + handle -> schema_version 2', withStampPayload && withStampPayload.schema_version === 2);
    check('buildSideChannelPayload with a stamp -> stamp object present', withStampPayload && withStampPayload.stamp && typeof withStampPayload.stamp === 'object');
    check(
      'buildSideChannelPayload stamp sub-object has exactly the closed key set',
      withStampPayload && withStampPayload.stamp &&
        Object.keys(withStampPayload.stamp).sort().join(',') === 'backend,direction,judge,path_edges,path_nodes,reason,verification'
    );
    check('buildSideChannelPayload stamp.verification === strong', withStampPayload && withStampPayload.stamp && withStampPayload.stamp.verification === 'strong');
    check('buildSideChannelPayload stamp.path_nodes byte-equal', withStampPayload && withStampPayload.stamp &&
      JSON.stringify(withStampPayload.stamp.path_nodes) === JSON.stringify(['Reverse Salient Analysis', 'Six Thinking Hats']));
    check('buildSideChannelPayload stamp.path_edges byte-equal', withStampPayload && withStampPayload.stamp &&
      JSON.stringify(withStampPayload.stamp.path_edges) === JSON.stringify(['EXTENDS']));
    check('buildSideChannelPayload stamp.reason null on a verified stamp', withStampPayload && withStampPayload.stamp && withStampPayload.stamp.reason === null);
    check('buildSideChannelPayload opportunity_handle carried through', withStampPayload && withStampPayload.opportunity_handle === 'opp-handle-1');

    const unverifiedStampPayload = runnerMod.buildSideChannelPayload(
      firingScore(), { verdict: 'transferable', confidence: 'high', tags: [] }, a, b,
      { stamp: UNVERIFIED_STAMP, opportunityHandle: 'opp-handle-2' }
    );
    check('buildSideChannelPayload unverified stamp.reason carried', unverifiedStampPayload && unverifiedStampPayload.stamp && unverifiedStampPayload.stamp.reason === 'backend_unavailable');
    check('buildSideChannelPayload unverified stamp.path_nodes empty', unverifiedStampPayload && unverifiedStampPayload.stamp && unverifiedStampPayload.stamp.path_nodes.length === 0);
  }

  // -----------------------------------------------------------------------
  // 3. validateClosedSchema: accepts both v2 shapes, rejects every poison.
  // -----------------------------------------------------------------------
  {
    const a = { handle: 'n042' };
    const b = { handle: 'n317' };
    const guard = { verdict: 'transferable', confidence: 'high', tags: [] };

    const noStampPayload = runnerMod.buildSideChannelPayload(firingScore(), guard, a, b, {});
    check('validateClosedSchema accepts the no-stamp v2 shape', runnerMod.validateClosedSchema(noStampPayload) === true);

    const withStampPayload = runnerMod.buildSideChannelPayload(firingScore(), guard, a, b, { stamp: VERIFIED_STAMP, opportunityHandle: 'opp-handle-1' });
    check('validateClosedSchema accepts the with-stamp v2 shape', runnerMod.validateClosedSchema(withStampPayload) === true);

    // Reject: a v1 payload (no stamp/opportunity_handle keys at all).
    const v1Payload = {
      schema_version: 1,
      scanned_at: noStampPayload.scanned_at,
      guard: noStampPayload.guard,
      bridge: noStampPayload.bridge,
      provenance: noStampPayload.provenance,
    };
    check('validateClosedSchema rejects a v1 payload', runnerMod.validateClosedSchema(v1Payload) === false);

    // Reject: an extra top-level key.
    const extraTopKey = Object.assign({}, noStampPayload, { extra_field: 'nope' });
    check('validateClosedSchema rejects an extra top-level key', runnerMod.validateClosedSchema(extraTopKey) === false);

    // Reject: an extra stamp key.
    const extraStampKey = Object.assign({}, withStampPayload, { stamp: Object.assign({}, withStampPayload.stamp, { extra: 'nope' }) });
    check('validateClosedSchema rejects an extra stamp key', runnerMod.validateClosedSchema(extraStampKey) === false);

    // Reject: a stamp verification outside TIERS.
    const badTier = Object.assign({}, withStampPayload, { stamp: Object.assign({}, withStampPayload.stamp, { verification: 'certain' }) });
    check('validateClosedSchema rejects a stamp verification outside TIERS', runnerMod.validateClosedSchema(badTier) === false);

    // Reject: a stamp field holding a number.
    const numericField = Object.assign({}, withStampPayload, { stamp: Object.assign({}, withStampPayload.stamp, { backend: 0.87 }) });
    check('validateClosedSchema rejects a stamp field holding a number', runnerMod.validateClosedSchema(numericField) === false);

    // Reject: a path_nodes entry longer than 128 chars.
    const longNode = Object.assign({}, withStampPayload, {
      stamp: Object.assign({}, withStampPayload.stamp, { path_nodes: ['x'.repeat(129), 'Six Thinking Hats'] }),
    });
    check('validateClosedSchema rejects a path_nodes entry > 128 chars', runnerMod.validateClosedSchema(longNode) === false);

    // Reject: a path_nodes entry containing a newline.
    const newlineNode = Object.assign({}, withStampPayload, {
      stamp: Object.assign({}, withStampPayload.stamp, { path_nodes: ['Reverse Salient Analysis\nSMUGGLED', 'Six Thinking Hats'] }),
    });
    check('validateClosedSchema rejects a path_nodes entry containing a newline', runnerMod.validateClosedSchema(newlineNode) === false);

    // Reject: a path_edges entry not matching /^[A-Z][A-Z_]{0,63}$/.
    const badEdge = Object.assign({}, withStampPayload, {
      stamp: Object.assign({}, withStampPayload.stamp, { path_edges: ['extends-lowercase'] }),
    });
    check('validateClosedSchema rejects a path_edges entry outside the closed charset', runnerMod.validateClosedSchema(badEdge) === false);
  }

  // -----------------------------------------------------------------------
  // 4. writeStampedSideChannel: atomic write only when validation passes.
  // -----------------------------------------------------------------------
  {
    const dir = tmpRoom('writer-ok');
    const res = runnerMod.writeStampedSideChannel(dir, {
      score: firingScore(),
      guard: { verdict: 'transferable', confidence: 'high', tags: [] },
      a: { handle: 'n042' },
      b: { handle: 'n317' },
      stamp: VERIFIED_STAMP,
      opportunityHandle: 'opp-handle-3',
      now: 1720000000000,
    });
    check('writeStampedSideChannel returns ok:true on a valid input', res && res.ok === true, res && JSON.stringify(res));
    const written = res && res.ok ? JSON.parse(fs.readFileSync(path.join(dir, '.mindrian', 'last-eureka.json'), 'utf8')) : null;
    check('writeStampedSideChannel wrote a schema_version 2 payload', written && written.schema_version === 2);
    check('writeStampedSideChannel wrote the opportunity_handle', written && written.opportunity_handle === 'opp-handle-3');

    const badDir = tmpRoom('writer-bad');
    const badRes = runnerMod.writeStampedSideChannel(badDir, {
      score: firingScore(),
      guard: { verdict: 'transferable', confidence: 'high', tags: [] },
      a: { handle: 'n042' },
      b: { handle: 'n317' },
      stamp: { verification: 'made_up_tier', backend: 'theo', direction: 'none', judge: 'none' },
    });
    check('writeStampedSideChannel returns ok:false + reason on an invalid stamp', badRes && badRes.ok === false && typeof badRes.reason === 'string', badRes && JSON.stringify(badRes));
    check('writeStampedSideChannel writes nothing on an invalid input', fs.existsSync(path.join(badDir, '.mindrian', 'last-eureka.json')) === false);
  }

  // -----------------------------------------------------------------------
  // 5. sensorEureka evidence bag on a fresh v2 payload: opportunity_handle +
  //    the six stamp_* fields; stamp_path equals formatPathText for a
  //    verified stamp and '' otherwise; no evidence value except the
  //    pre-existing differential is a non-integer number.
  // -----------------------------------------------------------------------
  {
    const formatMod = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
    const guard = { available: true, verdict: 'transferable', confidence: 'high', tags: ['passes_all_gates'] };
    const bridge = { a_handle: 'n042', b_handle: 'n317', surprise_type: 'structural_transfer', band: 'breakthrough', differential_quantized: 0.57 };

    const verifiedPayload = {
      schema_version: 2,
      scanned_at: new Date().toISOString(),
      guard: guard,
      bridge: bridge,
      provenance: { model: 'stub', method: 'test' },
      stamp: {
        verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none',
        reason: null, path_nodes: ['Reverse Salient Analysis', 'Six Thinking Hats'], path_edges: ['EXTENDS'],
      },
      opportunity_handle: 'opp-handle-4',
    };
    const dir1 = tmpRoom('sensor-verified');
    writeSideChannel(dir1, verifiedPayload);
    const r1 = sensorEureka({}, {}, { roomDir: dir1 });
    check('sensorEureka fires on a fresh v2 payload with a verified stamp', !!r1, r1);
    if (r1) {
      check('sensorEureka evidence carries opportunity_handle', r1.evidence.opportunity_handle === 'opp-handle-4');
      check('sensorEureka evidence carries stamp_verification', r1.evidence.stamp_verification === 'strong');
      check('sensorEureka evidence carries stamp_backend', r1.evidence.stamp_backend === 'theo');
      check('sensorEureka evidence carries stamp_direction', r1.evidence.stamp_direction === 'structural_transfer');
      check('sensorEureka evidence carries stamp_judge', r1.evidence.stamp_judge === 'none');
      check('sensorEureka evidence stamp_reason is empty string for a verified stamp', r1.evidence.stamp_reason === '');
      check(
        'sensorEureka evidence stamp_path equals formatPathText(nodes, edges)',
        r1.evidence.stamp_path === formatMod.formatPathText(['Reverse Salient Analysis', 'Six Thinking Hats'], ['EXTENDS'])
      );
      const nonIntegerNumbers = Object.keys(r1.evidence).filter((k) => {
        const v = r1.evidence[k];
        return typeof v === 'number' && !Number.isInteger(v);
      });
      check(
        'sensorEureka evidence: the only non-integer number is the pre-existing differential',
        JSON.stringify(nonIntegerNumbers) === JSON.stringify(['differential']),
        JSON.stringify(nonIntegerNumbers)
      );
    }

    const unverifiedPayload = Object.assign({}, verifiedPayload, {
      stamp: { verification: 'unverified', backend: 'unavailable', direction: 'none', judge: 'none', reason: 'backend_unavailable', path_nodes: [], path_edges: [] },
      opportunity_handle: 'opp-handle-5',
    });
    const dir2 = tmpRoom('sensor-unverified');
    writeSideChannel(dir2, unverifiedPayload);
    const r2 = sensorEureka({}, {}, { roomDir: dir2 });
    check('sensorEureka fires on a fresh v2 payload with an unverified stamp', !!r2, r2);
    if (r2) {
      check('sensorEureka evidence stamp_path is empty string for an unverified stamp', r2.evidence.stamp_path === '');
      check('sensorEureka evidence stamp_reason carries the unverified reason', r2.evidence.stamp_reason === 'backend_unavailable');
    }
  }

  // -----------------------------------------------------------------------
  // 6. Fire-once dedup ledger: present handle -> null; corrupt ledger ->
  //    null; no ledger -> fires.
  // -----------------------------------------------------------------------
  {
    const guard = { available: true, verdict: 'transferable', confidence: 'high', tags: [] };
    const bridge = { a_handle: 'n042', b_handle: 'n317', surprise_type: 'structural_transfer', band: 'breakthrough', differential_quantized: 0.57 };
    function payloadWithHandle(handle) {
      return {
        schema_version: 2,
        scanned_at: new Date().toISOString(),
        guard: guard,
        bridge: bridge,
        provenance: { model: 'stub', method: 'test' },
        stamp: null,
        opportunity_handle: handle,
      };
    }

    const dirNoLedger = tmpRoom('dedup-no-ledger');
    writeSideChannel(dirNoLedger, payloadWithHandle('opp-fresh'));
    check('sensorEureka fires when no ledger exists', !!sensorEureka({}, {}, { roomDir: dirNoLedger }));

    const dirPresent = tmpRoom('dedup-present');
    writeSideChannel(dirPresent, payloadWithHandle('opp-already-surfaced'));
    writeLedger(dirPresent, { schema_version: 1, entries: { 'opp-already-surfaced': { at: new Date().toISOString() } } });
    check('sensorEureka returns null when the handle is already in the ledger', sensorEureka({}, {}, { roomDir: dirPresent }) === null);

    const dirCorrupt = tmpRoom('dedup-corrupt');
    writeSideChannel(dirCorrupt, payloadWithHandle('opp-corrupt-ledger'));
    writeLedger(dirCorrupt, '{ not json');
    check('sensorEureka returns null when the ledger is corrupt (fail closed)', sensorEureka({}, {}, { roomDir: dirCorrupt }) === null);

    const dirOtherHandle = tmpRoom('dedup-other-handle');
    writeSideChannel(dirOtherHandle, payloadWithHandle('opp-not-yet-surfaced'));
    writeLedger(dirOtherHandle, { schema_version: 1, entries: { 'some-other-handle': { at: new Date().toISOString() } } });
    check('sensorEureka fires when the ledger exists but has no entry for this handle', !!sensorEureka({}, {}, { roomDir: dirOtherHandle }));
  }

  // -----------------------------------------------------------------------
  // 7. markEurekaReachSurfaced: atomic ledger create/update, idempotent.
  // -----------------------------------------------------------------------
  {
    check('runnerMod exports EUREKA_REACH_LEDGER_RELPATH', typeof runnerMod.EUREKA_REACH_LEDGER_RELPATH === 'string' && runnerMod.EUREKA_REACH_LEDGER_RELPATH.indexOf('eureka-reach-ledger.json') !== -1, runnerMod.EUREKA_REACH_LEDGER_RELPATH);

    const dir = tmpRoom('mark-fresh');
    const res1 = runnerMod.markEurekaReachSurfaced(dir, 'opp-mark-1');
    check('markEurekaReachSurfaced ok:true creating a fresh ledger', res1 && res1.ok === true, res1 && JSON.stringify(res1));
    const ledgerPath = path.join(dir, '.mindrian', 'eureka-reach-ledger.json');
    check('markEurekaReachSurfaced wrote the ledger file', fs.existsSync(ledgerPath));
    let ledger1 = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    check('markEurekaReachSurfaced ledger has the entry', ledger1.entries && Object.prototype.hasOwnProperty.call(ledger1.entries, 'opp-mark-1'));

    const res2 = runnerMod.markEurekaReachSurfaced(dir, 'opp-mark-2');
    check('markEurekaReachSurfaced ok:true updating an existing ledger', res2 && res2.ok === true);
    const ledger2 = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    check('markEurekaReachSurfaced preserves the earlier entry', ledger2.entries && Object.prototype.hasOwnProperty.call(ledger2.entries, 'opp-mark-1'));
    check('markEurekaReachSurfaced adds the new entry', ledger2.entries && Object.prototype.hasOwnProperty.call(ledger2.entries, 'opp-mark-2'));

    const res3 = runnerMod.markEurekaReachSurfaced(dir, 'opp-mark-1');
    check('markEurekaReachSurfaced is idempotent (re-marking the same handle stays ok:true)', res3 && res3.ok === true);
    const ledger3 = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    check('markEurekaReachSurfaced idempotent re-mark keeps exactly two entries', Object.keys(ledger3.entries).length === 2, JSON.stringify(Object.keys(ledger3.entries)));

    // The ledger now dedups the sensor: mark, then the fixture with that
    // handle must return null.
    const guard = { available: true, verdict: 'transferable', confidence: 'high', tags: [] };
    const bridge = { a_handle: 'n042', b_handle: 'n317', surprise_type: 'structural_transfer', band: 'breakthrough', differential_quantized: 0.57 };
    writeSideChannel(dir, {
      schema_version: 2, scanned_at: new Date().toISOString(), guard: guard, bridge: bridge,
      provenance: { model: 'stub', method: 'test' }, stamp: null, opportunity_handle: 'opp-mark-1',
    });
    check('after markEurekaReachSurfaced, sensorEureka now returns null for that handle', sensorEureka({}, {}, { roomDir: dir }) === null);
  }

  // -----------------------------------------------------------------------
  // 8. Static leg: the sensor's source requires neither zod nor
  //    verification-stamp.cjs, and writes no file during a call.
  // -----------------------------------------------------------------------
  {
    const sensorSrc = fs.readFileSync(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'), 'utf8');
    const codeLines = hygiene.nonCommentLines(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs')).join('\n');
    check("sensor-eureka.cjs source never requires 'zod'", !/require\(\s*['"]zod['"]\s*\)/.test(codeLines));
    check('sensor-eureka.cjs source never requires verification-stamp.cjs', codeLines.indexOf('verification-stamp.cjs') === -1);
    check('sensor-eureka.cjs source never calls writeFileSync/renameSync', !/writeFileSync|renameSync/.test(codeLines));
    void sensorSrc;

    const dir = tmpRoom('write-spy');
    const guard = { available: true, verdict: 'transferable', confidence: 'high', tags: [] };
    const bridge = { a_handle: 'n042', b_handle: 'n317', surprise_type: 'structural_transfer', band: 'breakthrough', differential_quantized: 0.57 };
    writeSideChannel(dir, {
      schema_version: 2, scanned_at: new Date().toISOString(), guard: guard, bridge: bridge,
      provenance: { model: 'stub', method: 'test' }, stamp: null, opportunity_handle: null,
    });
    const before = new Set(fs.readdirSync(path.join(dir, '.mindrian')));
    sensorEureka({}, {}, { roomDir: dir });
    const after = new Set(fs.readdirSync(path.join(dir, '.mindrian')));
    check('sensorEureka writes no new file during a call', before.size === after.size && [...after].every((f) => before.has(f)), JSON.stringify([...after]));
  }
}

main()
  .catch((e) => {
    console.log('FAIL: uncaught error in test-355-side-channel-v2.cjs -- ' + (e && e.stack ? e.stack : e));
    check('no uncaught error', false, e && e.message);
  })
  .then(() => {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + wasKeyPresent);
    process.exit(summary());
  });
