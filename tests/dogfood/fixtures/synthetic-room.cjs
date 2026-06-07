'use strict';
/*
 * Phase 146-01 -- the shared synthetic (obviously-FICTIONAL) fixture-room builder
 * used by every ACPT dogfood driver.
 *
 * THE THREAT MODEL (T-146-03, Tampering): no real client data ever enters a
 * fixture. The default room slug is "acme-fictional-widgets-DOGFOOD" and every
 * fixture body is synthetic. The dogfood-acceptance gate (Canon Part 6,
 * Product-as-Venture) proves the loop FIRES against the REAL shipped units; it
 * NEVER needs real venture content to do so.
 *
 * makeSyntheticRoom(opts) returns an absolute roomDir under os.tmpdir() with a
 * created .mindrian/ directory, plus a cleanup() that removes it. Options:
 *
 *   contradict     (bool)  when true, writes the SENS-06 CASC-01 side-channel
 *                          (<roomDir>/.mindrian/last-cascade.json) carrying a
 *                          CONTRADICT newFinding -- the shipped contract that
 *                          scripts/post-write writes and the SENS-06 detector
 *                          (lib/core/insight-sensors.cjs) reads. This is what
 *                          makes the REAL contradiction sensor FIRE.
 *   sentinel       (str)   an obviously-fictional sentinel string written into
 *                          the side-channel finding body. ACPT-01 Test D asserts
 *                          this NEVER appears in the chosen_rationale (Part 8).
 *   activeRegistry (bool)  when true, also writes a rooms-home with a
 *                          .rooms/registry.json so explain-decision's
 *                          resolveActiveRoomDir resolves THIS room. The room is
 *                          created UNDER the rooms-home in that mode (so the
 *                          registry path resolves), and the returned object
 *                          carries roomsHome for the caller to set
 *                          MINDRIAN_ROOMS_HOME.
 *
 * Modeled on makePopulatedContradictRoom in
 * tests/test-nav01-populated-room-engine-fires.cjs, generalized for reuse.
 *
 * Pure node built-ins. House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_SLUG = 'acme-fictional-widgets-DOGFOOD';

/**
 * Build a synthetic fixture room.
 *
 * @param {object} [opts]
 * @returns {{ roomDir: string, slug: string, roomsHome: (string|null), cleanup: function }}
 */
function makeSyntheticRoom(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const slug = typeof o.slug === 'string' && o.slug.length > 0 ? o.slug : DEFAULT_SLUG;
  const contradict = o.contradict === true;
  const activeRegistry = o.activeRegistry === true;
  const sentinel = typeof o.sentinel === 'string' ? o.sentinel : '';

  let roomsHome = null;
  let roomDir;

  if (activeRegistry) {
    // A rooms-home holding the room + a .rooms/registry.json so
    // explain-decision's resolveActiveRoomDir resolves the fixture.
    roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'acpt-home-'));
    roomDir = path.join(roomsHome, slug);
    fs.mkdirSync(roomDir, { recursive: true });
    const regDir = path.join(roomsHome, '.rooms');
    fs.mkdirSync(regDir, { recursive: true });
    const registry = {
      active: slug,
      rooms: {
        [slug]: { path: slug },
      },
    };
    fs.writeFileSync(path.join(regDir, 'registry.json'), JSON.stringify(registry), 'utf8');
  } else {
    roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acpt-room-'));
  }

  const mdir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mdir, { recursive: true });

  if (contradict) {
    // The shipped CASC-01 side-channel: a CONTRADICT newFinding makes the REAL
    // SENS-06 detector surface reach_id 'contradiction' posture 'pull_back'.
    // The finding body carries the (fictional) sentinel so Part-8 Test D can
    // prove the rationale never echoes user content.
    const finding = { type: 'CONTRADICT', confidence: 0.9 };
    if (sentinel.length > 0) finding.message = sentinel;
    const payload = {
      proactive_intelligence: {
        newFindings: [finding],
      },
    };
    fs.writeFileSync(path.join(mdir, 'last-cascade.json'), JSON.stringify(payload), 'utf8');
  }

  function cleanup() {
    const target = roomsHome || roomDir;
    try { fs.rmSync(target, { recursive: true, force: true }); } catch (_e) {}
  }

  return { roomDir: roomDir, slug: slug, roomsHome: roomsHome, cleanup: cleanup };
}

module.exports = {
  makeSyntheticRoom: makeSyntheticRoom,
  DEFAULT_SLUG: DEFAULT_SLUG,
};
