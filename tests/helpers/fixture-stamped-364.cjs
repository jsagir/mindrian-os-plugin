'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 14 shared stamped-finding fixture (layer: graph).
 *
 * buildStampedRoom(rootDir, state, opts) -> Promise<{ roomDir, ids, stamp, marker }>
 *
 * Nine reproducible room states in which a Phase 355 stamped eureka finding is
 * on file, filed through the 355 writer itself (fileStampedOpportunity, inside
 * BEGIN / COMMIT, runMode 'ambient', exactly as lib/core/ambient-run.cjs calls
 * it for the 355.1 ambient run), so the finding is as 355 files one and never
 * hand-built:
 *
 *   stamped_strong_ambient   ratified goal plus a strong-stamped candidate (ambient)
 *   stamped_unverified_theo  an unverified / theo / no_path_within_3_hops stamp (navigator)
 *   stamped_not_called       an unverified / not_called / handle_unresolved stamp
 *   stamped_tampered         the writer given a lying raw stamp (strong, no path)
 *   stamped_qualified        the strong finding advanced to lifecycle qualified
 *   stamped_retired          the strong finding advanced to lifecycle retired
 *   stamped_no_what          the `empty` base (no WHAT) plus a stamped finding
 *   stamped_366_shape        the eureka-perspective filer's shape (filing.cjs)
 *   stamped_plus_rs          the `rs_finding` base plus a stamped finding
 *
 * ids: { goal, opportunity, a, b, reverse_salient }. a and b are the two ends
 * the finding depends on (Artifact nodes). The finding carries score 0.87 so
 * a leg can prove no decimal from it reaches an entry result or a card.
 *
 * REQUIRE ORDER: require this module only AFTER the caller has isolated the
 * process (HOME, USERPROFILE and MINDRIAN_ROOMS_HOME at mkdtemp dirs,
 * CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID deleted). Repo modules load
 * lazily inside buildStampedRoom.
 *
 * Order: every node is minted first; the 355 writer then adds the finding and
 * its SOURCED_FROM edges to ends that already exist (nodes before edges).
 * Writers run only here, inside the test fixture. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const STAMPED_STATES = Object.freeze([
  'stamped_strong_ambient', 'stamped_unverified_theo', 'stamped_not_called',
  'stamped_tampered', 'stamped_qualified', 'stamped_retired', 'stamped_no_what',
  'stamped_366_shape', 'stamped_plus_rs',
]);

const END_A = 'fx364/a';
const END_B = 'fx364/b';
const SCORE = 0.87;

async function buildStamp(state) {
  const verificationStamp = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs'));
  if (state === 'stamped_unverified_theo') {
    return verificationStamp.Stamp.parse({
      verification: 'unverified', backend: 'theo', direction: 'structural_transfer', judge: 'none', reason: 'no_path_within_3_hops',
    });
  }
  if (state === 'stamped_not_called') {
    return verificationStamp.Stamp.parse({
      verification: 'unverified', backend: 'not_called', direction: 'structural_transfer', judge: 'none', reason: 'handle_unresolved',
    });
  }
  if (state === 'stamped_tampered') {
    // a lying stamp: strong with no path. The 355 writer does not validate it.
    return { verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none' };
  }
  const { makeReplayCallTool } = require(path.join(REPO_ROOT, 'tests/helpers/theo-replay-355.cjs'));
  const stub = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/355/theo-stub-responses.json'), 'utf8'));
  return verificationStamp.stampFinding({
    fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'structural_transfer',
  }, { callTool: makeReplayCallTool(stub) });
}

/**
 * buildStampedRoom(rootDir, state, opts)
 *   rootDir  an existing (mkdtemp) directory; the room is <rootDir>/<opts.name || state>
 *   state    one of STAMPED_STATES
 */
async function buildStampedRoom(rootDir, state, opts) {
  if (STAMPED_STATES.indexOf(state) === -1) throw new Error('fixture-stamped-364: unknown state ' + state);
  const o = opts || {};
  const name = o.name || state;
  const base = state === 'stamped_no_what' ? 'empty' : (state === 'stamped_plus_rs' ? 'rs_finding' : 'stated_goal');
  const { buildEntryRoom, MARKER } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-364.cjs'));
  const built = buildEntryRoom(rootDir, base, { name: name });
  const roomDir = built.roomDir;

  // the 355 filer reads pws_stage from the ROOM.md frontmatter
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: fixture-364-stamped\npws_stage: extend_opportunity\n---\n# Stamped fixture room\n');

  const stamp = await buildStamp(state);
  const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
  const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
  const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
  const fileStampedOpportunity = require(path.join(REPO_ROOT, 'lib/core/research-planner/filing-stamped.cjs')).fileStampedOpportunity;
  const verificationStamp = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs'));

  const titleA = 'Brine outfall chemistry ' + MARKER;
  const titleB = 'Intake coating physics ' + MARKER;
  const ids = {
    goal: built.ids.goal, opportunity: null, a: END_A, b: END_B, reverse_salient: built.ids.reverse_salient,
  };

  const db = roomDb.openRoomDb(roomDir);
  try {
    // 1. nodes first: the two ends the finding depends on
    insertNode(db, END_A, 'Artifact', JSON.stringify({ title: titleA }), { source_path: 'test:fixture-364-stamped', epistemic_type: 'observation' });
    insertNode(db, END_B, 'Artifact', JSON.stringify({ title: titleB }), { source_path: 'test:fixture-364-stamped', epistemic_type: 'observation' });

    // 2. the finding, through the 355 writer or the 366 perspective filer shape
    if (state === 'stamped_366_shape') {
      const extraProps = Object.assign({}, verificationStamp.toNodeProps(stamp), {
        pws_stage: 'extend_opportunity',
        engine_mode: 'navigator',
        pair_perspective: 'eureka',
        evidence_ids: [END_A, END_B],
      });
      const w = navigation.writeOpportunityNode(db, {
        name: 'Research cross connection - ' + MARKER,
        sessionId: 'fixture-364-14',
        lifecycle: 'candidate',
        lens: 'research-planner',
        extraProps: extraProps,
        actor: 'research-planner',
        reason: 'research candidate',
        evidence_ids: [END_A, END_B],
      });
      if (!w || w.ok !== true) throw new Error('fixture-stamped-364: writeOpportunityNode refused ' + JSON.stringify(w));
      ids.opportunity = w.node_id;
    } else {
      let nodeId = null;
      db.exec('BEGIN');
      try {
        nodeId = fileStampedOpportunity(db, {
          a: { handle: END_A, text: titleA },
          b: { handle: END_B, text: titleB },
          stamp: stamp,
          producer: 'eureka',
          roomDir: roomDir,
          runMode: state === 'stamped_unverified_theo' ? 'navigator' : 'ambient',
          reason: 'ambient stamped finding',
          score: SCORE,
        });
        if (!nodeId) throw new Error('fixture-stamped-364: fileStampedOpportunity returned null');
        db.exec('COMMIT');
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
        throw e;
      }
      ids.opportunity = nodeId;
    }

    // 3. a lifecycle advance after the commit, through the typed writer only
    if (state === 'stamped_qualified' || state === 'stamped_retired') {
      const adv = navigation.advanceOpportunityStage(db, {
        node_id: ids.opportunity,
        axis: 'lifecycle',
        to: state === 'stamped_qualified' ? 'qualified' : 'retired',
        actor: 'fixture',
        reason: 'fixture',
        evidence_ids: [],
        formula_version: 'fixture-364-14',
      });
      if (!adv || adv.ok !== true) throw new Error('fixture-stamped-364: advanceOpportunityStage refused ' + JSON.stringify(adv));
    }
  } finally {
    roomDb.closeRoomDb(db);
  }
  return { roomDir: roomDir, ids: ids, stamp: stamp, marker: MARKER, score: SCORE };
}

module.exports = { buildStampedRoom, STAMPED_STATES, END_A, END_B, SCORE };
