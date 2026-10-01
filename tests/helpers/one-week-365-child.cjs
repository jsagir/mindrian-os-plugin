#!/usr/bin/env node
'use strict';

/*
 * tests/helpers/one-week-365-child.cjs -- Phase 365-02.
 *
 * The SECOND process of the one-week acceptance test: it stands in for "asking
 * the room a week later". It shares nothing with the parent but the room
 * directory on disk. Usage:
 *
 *   node tests/helpers/one-week-365-child.cjs <roomDir> <claimId>
 *
 * It opens the room in a new process, calls claim_read for the claim through a
 * captured tool server, and prints exactly one JSON line:
 *
 *   { review_status, rendered_claim, confirmed_events }
 *
 *   review_status    read through a fresh room.db handle (never a tool response)
 *   rendered_claim   the text claim_read renders for the claim
 *   confirmed_events count of status_promoted memory events on the claim whose
 *                    new status is confirmed
 *
 * It exits 0 after printing; it never judges. Exit 2 only on a usage or load
 * fault, so the parent can tell a broken child from a red verdict.
 * No em-dashes.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const path = require('node:path');

async function main() {
  const roomDir = process.argv[2];
  const claimId = process.argv[3];
  if (!roomDir || !claimId) {
    process.stderr.write('usage: one-week-365-child.cjs <roomDir> <claimId>\n');
    return 2;
  }
  const REPO_ROOT = path.resolve(__dirname, '..', '..');
  const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const claimVerify = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'claim-verify.cjs'));

  const handlers = new Map();
  const server = {
    tool: (name, _d, _s, h) => handlers.set(name, h),
    registerTool: (name, _c, h) => handlers.set(name, h),
  };
  claimVerify.register(server, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' });

  const raw = await handlers.get('claim_read')({ claim_id: claimId }, { sessionId: 'one-week-365-child' });
  let payload = null;
  try { payload = JSON.parse(raw.content[0].text); } catch (_e) { payload = null; }
  const renderedClaim = payload && payload.rendered && typeof payload.rendered.claim === 'string'
    ? payload.rendered.claim : '';

  const db = openRoomDb(roomDir);
  let reviewStatus = null;
  let confirmedEvents = 0;
  try {
    const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claimId);
    reviewStatus = row ? row.review_status : null;
    const events = db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' "
      + "AND json_extract(properties, '$.event_type') = 'status_promoted' "
      + "AND json_extract(properties, '$.target_node_id') = ?"
    ).all(claimId);
    for (const e of events) {
      let p = {};
      try { p = JSON.parse(e.properties); } catch (_x) { p = {}; }
      if (p && p.new_status === 'confirmed') confirmedEvents += 1;
    }
  } finally {
    closeRoomDb(db);
  }

  process.stdout.write(JSON.stringify({
    review_status: reviewStatus,
    rendered_claim: renderedClaim,
    confirmed_events: confirmedEvents,
  }) + '\n');
  return 0;
}

main().then((code) => { process.exitCode = code; }, (e) => {
  process.stderr.write('child fault: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 2;
});
