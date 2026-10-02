#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick 261002-cud Task 3 (SEED-104 residual): the room-only coverage check behind leaf ws:extraction_failure
 * stops exact-phrase-matching long zone terms. localRoomCheck backs the exact phrase with strict-majority
 * content-token coverage: a long zone term the room names in other words is no longer "0 room artifacts".
 *
 *   K1  a seven-word term finds an artifact that holds four of its content tokens (the evidence-room false negative)
 *   K2  an artifact holding only three of the seven tokens stays out
 *   K3  an exact phrase still counts; a phrase nothing matches counts 0
 *   K4  a single-token term keeps substring semantics
 *   K5  function words never count toward coverage
 *   K6  the walk invariants hold: dot-directories are never opened, symlinks are skipped
 *   K7  zero network attempts; the return shape is unchanged; no em-dash or en-dash in the touched files
 *
 * The fixture is a hand-built temp room with synthetic wording. No room.db is needed.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-rc-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-rc-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MOS_366_LIVE;
delete process.env.MOS_366_THEO_REPLAY;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-seed104-room-check-tokens');
const quick = require(path.join(REPO_ROOT, 'lib/core/research-planner/quick.cjs'));

const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
const TERM7 = 'gallium oxide choline chloride deep eutectic solvent';

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}

const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-rc-room-'));
function put(rel, body) {
  const f = path.join(room, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body, 'utf8');
}
put('opportunity-bank/gap-oxide-stability.md', '# Gap - gallium oxide stability in choline chloride DES\n\nThe film thins when the bath is left standing overnight.\n');
put('problem-definition/notes.md', '# Notes\n\nThe oxide skin, the choline salt and the chloride ion each matter a little.\n');
put('market-analysis/field.md', '# Field note\n\nTeams talk about acoustic biofilm disruption in marine hulls.\n');
put('market-analysis/plural.md', '# Plural\n\nSeveral biofilms were observed on the coupons.\n');
put('market-analysis/function-words.md', '# Function words\n\nOf the in the matter, only stability was discussed.\n');
put('market-analysis/two-content.md', '# Two\n\nThe oxide is soluble in the solvent.\n');
put('.mindrian/hidden.md', TERM7 + '\n');
// a symlinked md inside a section that would otherwise match
try { fs.symlinkSync(path.join(room, 'opportunity-bank/gap-oxide-stability.md'), path.join(room, 'problem-definition/linked.md')); } catch (_e) { /* symlinks unavailable: leg still holds */ }

function paths(r) { return r.artifacts.map(function (a) { return a.path; }); }

(async function main() {
  await leg('K1 a seven-word term finds the artifact that holds four of its content tokens', function () {
    const r = quick.localRoomCheck(room, [TERM7]);
    const hit = r.artifacts.filter(function (a) { return a.section === 'opportunity-bank' && a.path === 'opportunity-bank/gap-oxide-stability.md'; });
    return (r.flagged === true && hit.length === 1) || JSON.stringify(r);
  });

  await leg('K2 an artifact holding only three of the seven tokens stays out', function () {
    const r = quick.localRoomCheck(room, [TERM7]);
    return paths(r).indexOf('problem-definition/notes.md') === -1 || JSON.stringify(r);
  });

  await leg('K3 an exact phrase still counts; a phrase nothing matches counts 0', function () {
    const a = quick.localRoomCheck(room, ['acoustic biofilm disruption']);
    const b = quick.localRoomCheck(room, ['zzz nothing matches this phrase']);
    return (paths(a).indexOf('market-analysis/field.md') !== -1 && b.artifact_count === 0 && b.flagged === false) || JSON.stringify([a, b]);
  });

  await leg('K4 a single-token term keeps substring semantics', function () {
    const r = quick.localRoomCheck(room, ['biofilm']);
    return paths(r).indexOf('market-analysis/plural.md') !== -1 || JSON.stringify(r);
  });

  await leg('K5 function words never count toward coverage', function () {
    const r = quick.localRoomCheck(room, ['stability of the oxide in the solvent']);
    const p = paths(r);
    return (p.indexOf('market-analysis/function-words.md') === -1 && p.indexOf('market-analysis/two-content.md') !== -1) || JSON.stringify(r);
  });

  await leg('K6 dot-directories are never opened and symlinks are skipped', function () {
    const r = quick.localRoomCheck(room, [TERM7]);
    const p = paths(r);
    const dot = p.some(function (x) { return x.charAt(0) === '.' || x.indexOf('/.') !== -1; });
    return (!dot && p.indexOf('problem-definition/linked.md') === -1) || JSON.stringify(r);
  });

  await leg('K7 zero network attempts; the return shape is unchanged; no dash in the touched files', function () {
    const r = quick.localRoomCheck(room, [TERM7, '', 'biofilm', '   ']);
    const keys = Object.keys(r).sort().join(',');
    const files = ['lib/core/research-planner/quick.cjs', 'tests/test-seed104-room-check-tokens.cjs'];
    const dirty = files.filter(function (f) { return DASH_RE.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')); });
    return (net.attempts() === 0 && keys === 'artifact_count,artifacts,flagged,terms_checked' && r.terms_checked === 2 && dirty.length === 0)
      || 'attempts ' + net.attempts() + ' keys ' + keys + ' checked ' + r.terms_checked + ' dash ' + dirty.join(',');
  });

  net.restore();
  process.exit(C.summary());
})();
