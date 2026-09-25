#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 02 Task 1 (test-first, AMB-01) -- pins every behavior
 * line of navigation.readRoomDeltaFacts, the room-delta statement home,
 * before the module exists (RED), then against the shipped module (GREEN).
 * Every class (a)-(e) is exercised through navigation.readRoomDeltaFacts
 * ONLY (never lib/core/navigation/room-delta-facts.cjs's own module path),
 * except the one leg that proves they are the SAME function object.
 *
 * hygiene-355 preamble runs BEFORE any repo require, per every 355/355.1
 * test's own discipline; attempts() === 0 is the LAST check.
 *
 * SKIP-77 when node:sqlite is unavailable (the experimental built-in every
 * room.db test in this repo gates on).
 *
 * Run: node tests/test-3551-delta-classes.cjs
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const path = require('node:path');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping delta-class reader test\n');
  process.exit(77);
}

const fs = require('node:fs');
const os = require('node:os');

const navigation = require('../lib/core/navigation.cjs');

let checks = 0;
let passed = 0;
function check(label, cond, detail) {
  checks += 1;
  if (cond) {
    passed += 1;
    process.stdout.write('PASS: ' + label + '\n');
  } else {
    process.stdout.write('FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
  return cond;
}

const HEX12 = /^[0-9a-f]{12}$/;

async function main() {
  // Load the fixture helper (already shipped by plan 355.1-01) and the
  // module under test INSIDE main() so a require-time throw (the module
  // absent, the RED state) is caught by the outer catch below and reported
  // as a clean FAIL rather than an uncaught crash.
  let fixtureRoom3551;
  try {
    fixtureRoom3551 = require('./helpers/fixture-room-3551.cjs');
  } catch (e) {
    process.stdout.write('FAIL: require tests/helpers/fixture-room-3551.cjs -- ' + (e && e.message) + '\n');
    process.stdout.write('PASS: 0 FAIL: 1\n');
    process.exitCode = 1;
    return;
  }

  let roomDeltaFactsModule = null;
  let requireError = null;
  try {
    roomDeltaFactsModule = require('../lib/core/navigation/room-delta-facts.cjs');
  } catch (e) {
    requireError = e;
  }

  check(
    'navigation.readRoomDeltaFacts is a function',
    typeof navigation.readRoomDeltaFacts === 'function'
  );

  if (typeof navigation.readRoomDeltaFacts !== 'function') {
    process.stdout.write('FAIL: navigation.readRoomDeltaFacts is not exported yet'
      + (requireError ? ' -- ' + requireError.message : '') + '\n');
    process.stdout.write('PASS: ' + passed + ' FAIL: ' + (checks - passed) + '\n');
    process.exitCode = 1;
    return;
  }

  check(
    'navigation.readRoomDeltaFacts is the SAME function object as '
      + "require('lib/core/navigation/room-delta-facts.cjs').readRoomDeltaFacts",
    !!roomDeltaFactsModule && navigation.readRoomDeltaFacts === roomDeltaFactsModule.readRoomDeltaFacts
  );

  const { buildDeltaRoom, MARKER_PREFIX } = fixtureRoom3551;

  // -------------------------------------------------------------------
  // Fresh-room shape: exactly the six keys.
  // -------------------------------------------------------------------
  const room = buildDeltaRoom('delta-classes');
  try {
    const db0 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let fresh;
    try {
      fresh = navigation.readRoomDeltaFacts(db0, room.roomDir, {
        since: { claims_created_at: 0, artifacts_created_at: 0 },
      });
    } finally {
      if (db0) navigation.closeRoomDbForCaller(db0);
    }
    check('readRoomDeltaFacts returns an object on a fresh room', !!fresh && typeof fresh === 'object');
    const keys = fresh ? Object.keys(fresh).sort() : [];
    const expectedKeys = ['artifacts', 'children', 'claims', 'contradicts_keys', 'schema_variant', 'stage_hash'].sort();
    check('fresh-room result has exactly the six keys', JSON.stringify(keys) === JSON.stringify(expectedKeys),
      'got ' + JSON.stringify(keys));
    check('fresh-room result is frozen', fresh ? Object.isFrozen(fresh) : false);

    // -------------------------------------------------------------------
    // (a) claims: count + max_created_at, then since-bound.
    // -------------------------------------------------------------------
    room.addClaims(5);
    const dbA1 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let afterFive;
    try {
      afterFive = navigation.readRoomDeltaFacts(db_or(dbA1), room.roomDir, {
        since: { claims_created_at: 0, artifacts_created_at: 0 },
      });
    } finally {
      if (dbA1) navigation.closeRoomDbForCaller(dbA1);
    }
    check('(a) claims.count === 5 after addClaims(5)',
      !!afterFive && !!afterFive.claims && afterFive.claims.count === 5,
      JSON.stringify(afterFive && afterFive.claims));
    check('(a) claims.max_created_at is an integer',
      !!afterFive && !!afterFive.claims && Number.isInteger(afterFive.claims.max_created_at),
      JSON.stringify(afterFive && afterFive.claims));

    const watermark = afterFive && afterFive.claims ? afterFive.claims.max_created_at : 0;
    room.addClaims(2);
    const dbA2 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let afterTwoMore;
    try {
      afterTwoMore = navigation.readRoomDeltaFacts(dbA2, room.roomDir, {
        since: { claims_created_at: watermark, artifacts_created_at: 0 },
      });
    } finally {
      if (dbA2) navigation.closeRoomDbForCaller(dbA2);
    }
    check('(a) since-bound claims.count === 2 after a further addClaims(2)',
      !!afterTwoMore && !!afterTwoMore.claims && afterTwoMore.claims.count === 2,
      JSON.stringify(afterTwoMore && afterTwoMore.claims));

    // -------------------------------------------------------------------
    // (b) contradicts_keys: one 12-hex entry, sorted, stable across calls.
    // -------------------------------------------------------------------
    room.addContradicts();
    const dbB1 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let afterContra;
    try {
      afterContra = navigation.readRoomDeltaFacts(dbB1, room.roomDir, {});
    } finally {
      if (dbB1) navigation.closeRoomDbForCaller(dbB1);
    }
    check('(b) contradicts_keys has length 1',
      !!afterContra && Array.isArray(afterContra.contradicts_keys) && afterContra.contradicts_keys.length === 1,
      JSON.stringify(afterContra && afterContra.contradicts_keys));
    const key1 = afterContra && afterContra.contradicts_keys ? afterContra.contradicts_keys[0] : '';
    check('(b) the entry is 12 lowercase hex chars', HEX12.test(key1), key1);
    const sortedCopy = afterContra && afterContra.contradicts_keys ? afterContra.contradicts_keys.slice().sort() : [];
    check('(b) contradicts_keys is sorted', JSON.stringify(afterContra && afterContra.contradicts_keys) === JSON.stringify(sortedCopy));

    const dbB2 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let afterContraAgain;
    try {
      afterContraAgain = navigation.readRoomDeltaFacts(dbB2, room.roomDir, {});
    } finally {
      if (dbB2) navigation.closeRoomDbForCaller(dbB2);
    }
    check('(b) a second call returns the identical array',
      JSON.stringify(afterContra && afterContra.contradicts_keys) === JSON.stringify(afterContraAgain && afterContraAgain.contradicts_keys));

    // -------------------------------------------------------------------
    // (c) stage_hash: two different hashes, then null on empty/no-frontmatter.
    // -------------------------------------------------------------------
    room.setStage('Design');
    const dbC1 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let stageDesign;
    try {
      stageDesign = navigation.readRoomDeltaFacts(dbC1, room.roomDir, {});
    } finally {
      if (dbC1) navigation.closeRoomDbForCaller(dbC1);
    }
    check('(c) stage_hash after setStage(Design) is 12 lowercase hex chars',
      !!stageDesign && HEX12.test(stageDesign.stage_hash), JSON.stringify(stageDesign && stageDesign.stage_hash));

    room.setStage('Investment');
    const dbC2 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let stageInvestment;
    try {
      stageInvestment = navigation.readRoomDeltaFacts(dbC2, room.roomDir, {});
    } finally {
      if (dbC2) navigation.closeRoomDbForCaller(dbC2);
    }
    check('(c) setStage(Design) then setStage(Investment) yields two different hashes',
      !!stageDesign && !!stageInvestment && stageDesign.stage_hash !== stageInvestment.stage_hash);

    room.setStage(null);
    const dbC3 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let stageEmpty;
    try {
      stageEmpty = navigation.readRoomDeltaFacts(dbC3, room.roomDir, {});
    } finally {
      if (dbC3) navigation.closeRoomDbForCaller(dbC3);
    }
    check('(c) setStage(null) (empty STATE.md) yields stage_hash === null',
      !!stageEmpty && stageEmpty.stage_hash === null);

    // STATE.md with no frontmatter.
    fs.writeFileSync(path.join(room.roomDir, 'STATE.md'), '# no frontmatter here\n', 'utf8');
    const dbC4 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let stageNoFm;
    try {
      stageNoFm = navigation.readRoomDeltaFacts(dbC4, room.roomDir, {});
    } finally {
      if (dbC4) navigation.closeRoomDbForCaller(dbC4);
    }
    check('(c) a STATE.md with no frontmatter yields stage_hash === null',
      !!stageNoFm && stageNoFm.stage_hash === null);

    // -------------------------------------------------------------------
    // (d) children: two child rooms, sorted, 12-hex each.
    // -------------------------------------------------------------------
    room.addChildRoom('child-a');
    room.addChildRoom('child-b');
    const dbD1 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let withChildren;
    try {
      withChildren = navigation.readRoomDeltaFacts(dbD1, room.roomDir, { registryHome: room.roomsHome });
    } finally {
      if (dbD1) navigation.closeRoomDbForCaller(dbD1);
    }
    check('(d) children has length 2',
      !!withChildren && Array.isArray(withChildren.children) && withChildren.children.length === 2,
      JSON.stringify(withChildren && withChildren.children));
    const childrenAllHex = !!withChildren && Array.isArray(withChildren.children)
      && withChildren.children.every(function (h) { return HEX12.test(h); });
    check('(d) every child entry is 12-hex', childrenAllHex, JSON.stringify(withChildren && withChildren.children));
    const childrenSortedCopy = withChildren && withChildren.children ? withChildren.children.slice().sort() : [];
    check('(d) children is sorted', JSON.stringify(withChildren && withChildren.children) === JSON.stringify(childrenSortedCopy));

    // An unreadable registry yields children === null.
    const unreadableRegistryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-noreg-'));
    const dbD2 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let noRegistry;
    try {
      noRegistry = navigation.readRoomDeltaFacts(dbD2, room.roomDir, { registryHome: unreadableRegistryHome });
    } finally {
      if (dbD2) navigation.closeRoomDbForCaller(dbD2);
      try { fs.rmSync(unreadableRegistryHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    }
    check('(d) an unreadable registry yields children === null', !!noRegistry && noRegistry.children === null,
      JSON.stringify(noRegistry && noRegistry.children));

    // -------------------------------------------------------------------
    // (e) artifacts: count + since-bound, same shape as (a).
    // -------------------------------------------------------------------
    const dbE0 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let beforeArtifact;
    try {
      beforeArtifact = navigation.readRoomDeltaFacts(dbE0, room.roomDir, {
        since: { claims_created_at: 0, artifacts_created_at: 0 },
      });
    } finally {
      if (dbE0) navigation.closeRoomDbForCaller(dbE0);
    }
    const artifactWatermark = beforeArtifact && beforeArtifact.artifacts && Number.isInteger(beforeArtifact.artifacts.max_created_at)
      ? beforeArtifact.artifacts.max_created_at : 0;
    room.addArtifact();
    const dbE1 = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
    let afterArtifact;
    try {
      afterArtifact = navigation.readRoomDeltaFacts(dbE1, room.roomDir, {
        since: { claims_created_at: 0, artifacts_created_at: artifactWatermark },
      });
    } finally {
      if (dbE1) navigation.closeRoomDbForCaller(dbE1);
    }
    check('(e) artifacts.count === 1 after addArtifact()',
      !!afterArtifact && !!afterArtifact.artifacts && afterArtifact.artifacts.count === 1,
      JSON.stringify(afterArtifact && afterArtifact.artifacts));

    // -------------------------------------------------------------------
    // No value anywhere leaks the marker, the slug or a path separator.
    // -------------------------------------------------------------------
    const serialized = JSON.stringify(withChildren);
    check('(d) result carries no SECRET-3551- marker', serialized.indexOf(MARKER_PREFIX) === -1);
    check('(d) result carries no room slug', serialized.indexOf(room.slug) === -1);
    check('(d) result carries no path separator', serialized.indexOf(path.sep) === -1 && serialized.indexOf('/') === -1);
  } finally {
    room.cleanup();
  }

  // -------------------------------------------------------------------
  // A handle whose nodes table lacks created_at yields claims === null and
  // artifacts === null, never 0. Built through the SAME fixture helper's
  // write door, then STATE.md is left as-is (stage_hash unaffected).
  // -------------------------------------------------------------------
  const legacyRoom = buildDeltaRoom('legacy-schema');
  try {
    legacyRoom.addClaims(1);
    const legacyDb = navigation.openRoomDbReadOnlyForCaller(legacyRoom.roomDir);
    // Simulate a legacy (no created_at) nodes table by wrapping the real
    // handle so PRAGMA table_info(nodes) reports no created_at column,
    // without mutating the on-disk schema of a fixture other tests share.
    const wrapped = legacyDb ? {
      prepare: function (sql) {
        if (/PRAGMA table_info\(nodes\)/.test(sql)) {
          return {
            all: function () {
              return [{ name: 'id' }, { name: 'type' }, { name: 'properties' }];
            },
          };
        }
        return legacyDb.prepare(sql);
      },
    } : null;
    let legacyFacts;
    try {
      legacyFacts = navigation.readRoomDeltaFacts(wrapped, legacyRoom.roomDir, {
        since: { claims_created_at: 0, artifacts_created_at: 0 },
      });
    } finally {
      if (legacyDb) navigation.closeRoomDbForCaller(legacyDb);
    }
    check('legacy schema (no created_at): claims === null, never 0',
      !!legacyFacts && legacyFacts.claims === null, JSON.stringify(legacyFacts && legacyFacts.claims));
    check('legacy schema (no created_at): artifacts === null, never 0',
      !!legacyFacts && legacyFacts.artifacts === null, JSON.stringify(legacyFacts && legacyFacts.artifacts));
    check('legacy schema: schema_variant is legacy',
      !!legacyFacts && legacyFacts.schema_variant === 'legacy', JSON.stringify(legacyFacts && legacyFacts.schema_variant));
  } finally {
    legacyRoom.cleanup();
  }

  // -------------------------------------------------------------------
  // A stub handle whose prepare throws yields null for every SQL class and
  // the call does not throw.
  // -------------------------------------------------------------------
  const throwRoom = buildDeltaRoom('throw-handle');
  try {
    const throwingDb = {
      prepare: function () {
        throw new Error('stub handle: prepare always throws');
      },
    };
    let stubFacts = null;
    let threw = false;
    try {
      stubFacts = navigation.readRoomDeltaFacts(throwingDb, throwRoom.roomDir, {
        since: { claims_created_at: 0, artifacts_created_at: 0 },
      });
    } catch (_e) {
      threw = true;
    }
    check('a throwing stub handle does not throw out of readRoomDeltaFacts', !threw);
    check('a throwing stub handle: claims === null', !!stubFacts && stubFacts.claims === null);
    check('a throwing stub handle: contradicts_keys === null', !!stubFacts && stubFacts.contradicts_keys === null);
    check('a throwing stub handle: artifacts === null', !!stubFacts && stubFacts.artifacts === null);
    check('a throwing stub handle: schema_variant is unreadable',
      !!stubFacts && stubFacts.schema_variant === 'unreadable', JSON.stringify(stubFacts && stubFacts.schema_variant));
  } finally {
    throwRoom.cleanup();
  }

  check('no network attempts (installNetGuard)', netGuard.attempts() === 0);

  process.stdout.write('PASS: ' + passed + ' FAIL: ' + (checks - passed) + '\n');
  process.exitCode = (checks === passed) ? 0 : 1;
}

// db_or(db) -- a tiny identity helper kept for readability at call sites
// that open-then-immediately-read (no transformation; documents intent).
function db_or(db) {
  return db;
}

main().catch(function (e) {
  process.stdout.write('FATAL: ' + (e && e.stack || e) + '\n');
  process.exitCode = 1;
});
