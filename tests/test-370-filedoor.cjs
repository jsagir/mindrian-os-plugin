#!/usr/bin/env node
'use strict';
/*
 * tests/test-370-filedoor.cjs -- Phase 370 plan 05 (REV370-09).
 *
 * The MCP filing door artifact_file (lib/mcp/tools/views.cjs fileArtifact)
 * refuses a review artifact that carries an internal name or breaks the fixed
 * shape. Owner answer O8 = FRONTMATTER: a file is a review by its frontmatter
 * (methodology grade or deep-grade, or a review_contract key), never by path.
 * The refusal is pre-write: no directory, file, memory_event or node.
 *
 * Arms:
 *   W1 a violating review is refused, nothing written, no body text echoed
 *   W2 a clean review files as before
 *   W3 a non-review that holds a denylist word files normally
 *   W4 a review with swapped sections is refused with rule shape_order
 *   W5 soft terms follow soft_terms.policy of the contract
 *   W6 stated limit: a leaking body with no frontmatter is not refused
 *   W7 a classified review whose check throws is refused as unavailable
 *
 * Canon Part 8: local only, no Brain call. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const H = require(path.join(__dirname, 'helpers', 'review-contract-370.cjs'));
const REPO = H.ROOT;
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const views = require(path.join(REPO, 'lib', 'mcp', 'tools', 'views.cjs'));

const rep = H.reporter('test-370-filedoor');
console.log('test-370-filedoor');

const PLANTED = [
  'SystemArchetypeAgent', 'LeveragePointAgent', 'IntersectionOpportunityFinderAgent',
  'NEO4J', 'Network Analysis MCP', 'artifact_file', 'lib/core/example.cjs',
  '/mos:challenge-assumptions', 'Theo',
];

const contract = H.realContract();
const policy = contract.soft_terms && contract.soft_terms.policy;

const scratch = makeScratchRoom('filedoor370');
const room = scratch.room;
const db = openRoomDb(room);

function door(section, filename, content) {
  return views._internal.fileArtifact(db, room, { section, filename, content });
}
function exists(section, filename) {
  return fs.existsSync(path.join(room, section, filename + '.md'));
}
function countEvents() {
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM memory_events WHERE event_type = 'mcp_client_event_logged'").get();
    return row ? row.n : -1;
  } catch (_) { return -1; }
}

rep.arm('W1 violating review refused before any write', () => {
  const pre = H.readFixture('pre-fix.md');
  const eventsBefore = countEvents();
  const r = door('competitive-analysis', 'review-one', pre);
  rep.eq(r.ok, false, 'ok must be false');
  rep.eq(r.reason, 'review_contract_violation', 'reason');
  rep.ok(Array.isArray(r.violations) && r.violations.length > 0, 'violations must be a non-empty array');
  for (const v of r.violations) {
    rep.eq(Object.keys(v).sort().join(','), 'class,line,rule,tier', 'violation keys');
  }
  rep.eq(typeof r.contract_version, 'number', 'contract_version');
  const dump = JSON.stringify(r);
  for (const s of PLANTED) rep.ok(dump.indexOf(s) === -1, 'result must not echo "' + s + '"');
  rep.ok(!exists('competitive-analysis', 'review-one'), 'file must not exist');
  rep.ok(!fs.existsSync(path.join(room, 'competitive-analysis')), 'section directory must not exist');
  rep.ok(r.artifact_id === undefined, 'no artifact_id returned');
  rep.eq(countEvents(), eventsBefore, 'no memory event logged');
});

rep.arm('W2 clean review files as before', () => {
  const post = H.readFixture('post-fix.md');
  const r = door('competitive-analysis', 'review-two', post);
  rep.eq(r.ok, true, 'ok must be true, got ' + JSON.stringify(r));
  rep.ok(exists('competitive-analysis', 'review-two'), 'file must exist');
  const onDisk = fs.readFileSync(path.join(room, 'competitive-analysis', 'review-two.md'), 'utf8');
  rep.ok(onDisk.indexOf('# Review: Harbor tide table') !== -1, 'body is kept');
  rep.ok(onDisk.indexOf('## Strategic Challenge') !== -1, 'last section is kept');
});

rep.arm('W3 non-review with a denylist word files normally', () => {
  const r = door('notes', 'plain-note', '# Notes\n\nWe may store the graph in Neo4j one day.\n');
  rep.eq(r.ok, true, 'ok must be true, got ' + JSON.stringify(r));
  rep.ok(exists('notes', 'plain-note'), 'file must exist');
  const r2 = door('notes', 'other-front', '---\ntitle: Notes\n---\n# Notes\n\nNeo4j is a graph store.\n');
  rep.eq(r2.ok, true, 'a header without review keys is not a review');
});

rep.arm('W4 swapped sections refused with rule shape_order', () => {
  const swapped = H.rawReview([
    '## Executive Summary', '## Faculty Questions', '## Reality Check',
    '## Expert Conversations', '## Research Validation + Reframe', '## Strategic Challenge',
  ]);
  const r = door('competitive-analysis', 'review-swapped', swapped);
  rep.eq(r.ok, false, 'ok must be false');
  rep.eq(r.reason, 'review_contract_violation', 'reason');
  rep.ok(r.violations.some((v) => v.rule === 'shape_order'), 'a shape_order violation is expected, got ' + JSON.stringify(r.violations));
  rep.ok(!exists('competitive-analysis', 'review-swapped'), 'file must not exist');
});

rep.arm('W5 soft terms follow soft_terms.policy (' + policy + ')', () => {
  const post = H.readFixture('post-fix.md');
  const withSoft = post + '\nWe store the tide rows in a database.\n';
  if (policy === 'strict') {
    const r = door('competitive-analysis', 'soft-strict', withSoft);
    rep.eq(r.ok, false, 'strict must refuse');
    rep.ok(r.violations.some((v) => v.class === 'soft_term'), 'soft_term violation');
  } else if (policy === 'exempt_if_in_source') {
    // No student source in the room yet: the soft term is refused.
    const roomNoSource = makeScratchRoom('filedoor370b');
    const dbB = openRoomDb(roomNoSource.room);
    try {
      const rNo = views._internal.fileArtifact(dbB, roomNoSource.room, { section: 'competitive-analysis', filename: 'soft-nosource', content: withSoft });
      rep.eq(rNo.ok, false, 'no source: must refuse');
      rep.ok(rNo.violations.some((v) => v.class === 'soft_term'), 'soft_term violation without source');
      // A student section file that holds the word exempts it.
      fs.mkdirSync(path.join(roomNoSource.room, 'problem-definition'), { recursive: true });
      fs.writeFileSync(path.join(roomNoSource.room, 'problem-definition', 'notes.md'), H.readFixture('source-student.md'));
      const rYes = views._internal.fileArtifact(dbB, roomNoSource.room, { section: 'competitive-analysis', filename: 'soft-source', content: withSoft });
      rep.eq(rYes.ok, true, 'source holds the word: must file, got ' + JSON.stringify(rYes));
    } finally {
      closeRoomDb(dbB);
      roomNoSource.cleanup();
    }
  } else if (policy === 'compound_only') {
    const r = door('competitive-analysis', 'soft-compound', withSoft);
    rep.eq(r.ok, true, 'compound_only must file a bare soft term, got ' + JSON.stringify(r));
  } else {
    throw new Error('unknown soft_terms.policy ' + policy);
  }
});

rep.arm('W6 stated limit: leaking body with no frontmatter is not refused', () => {
  // This is a stated, tested limit of the door (owner answer O8 FRONTMATTER).
  // The cover for this case is the pre-file wrapper in the command step and
  // the doctor template lint (plans 370-08, 370-09, 370-10).
  const body = '# Review of the Cedar Wharf tide service\n\nSystemArchetypeAgent scored it high. See Neo4j and artifact_file.\n';
  const r = door('competitive-analysis', 'no-header', body);
  rep.eq(r.ok, true, 'a review with no frontmatter is not classified, so it files; got ' + JSON.stringify(r));
  rep.ok(exists('competitive-analysis', 'no-header'), 'file must exist');
});

rep.arm('W7 classified review whose check throws is refused as unavailable', () => {
  const rc = require(path.join(REPO, 'lib', 'core', 'review-contract.cjs'));
  const orig = rc.checkReview;
  rc.checkReview = function () { throw new Error('forced failure'); };
  try {
    const r = door('competitive-analysis', 'review-throw', H.readFixture('post-fix.md'));
    rep.eq(r.ok, false, 'ok must be false');
    rep.eq(r.reason, 'review_contract_unavailable', 'reason');
    rep.ok(!exists('competitive-analysis', 'review-throw'), 'file must not exist');
    // A throw in classification alone is treated as not a review.
    const origIs = rc.isReviewArtifact;
    rc.isReviewArtifact = function () { throw new Error('forced classification failure'); };
    try {
      const r2 = door('competitive-analysis', 'review-classthrow', H.readFixture('post-fix.md'));
      rep.eq(r2.ok, true, 'classification throw is treated as non-review, got ' + JSON.stringify(r2));
    } finally {
      rc.isReviewArtifact = origIs;
    }
  } finally {
    rc.checkReview = orig;
  }
});

try { closeRoomDb(db); } catch (_) { /* best effort */ }
scratch.cleanup();
rep.done();
