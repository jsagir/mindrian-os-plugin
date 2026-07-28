'use strict';
/*
 * Phase 173-01 -- publish-needs map test (R2/R7 validator + R6 default-lane mapper).
 *
 * Asserts the seven plan behaviors:
 *   1. the committed map passes `node scripts/check-publish-needs.cjs` (exit 0)
 *   2. a mutated fixture with a FAKE resolves_to fails the validator (exit 1)
 *   3. a mutated fixture with a MISSING shows fails the validator (exit 1)
 *   4. defaultLaneForRoleBlend({founder:0.7,researcher:0.3}) === 'get-into-world'
 *   5. defaultLaneForRoleBlend({researcher:0.8,founder:0.2}) === 'find-broken'
 *   6. defaultLaneForRoleBlend({}) === 'know-stand'
 *   7. defaultLaneForRoleBlend(null) === 'know-stand'
 *
 * The two failure cases run the validator against a tmp-dir mutated fixture so the
 * committed map is never touched. The validator resolves data/publish-needs.json
 * relative to its own __dirname, so we copy the script + a mutated map + the real
 * command-registry + a stub skills/ tree into a tmp repo-root mirror and run it there.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REAL_MAP = path.join(REPO_ROOT, 'data', 'publish-needs.json');
const REAL_REGISTRY = path.join(REPO_ROOT, 'data', 'command-registry.json');
const REAL_SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-publish-needs.cjs');

const {
  defaultLaneForRoleBlend,
  LANES,
  DEFAULT_LANE,
} = require('../lib/core/publish-needs-default-lane.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// --- helper: run a check-publish-needs.cjs against a mirror repo-root that
// carries a (possibly mutated) data/publish-needs.json. Returns the exit code. ---
function runValidatorWithMap(mapObject) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-needs-'));
  fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'skills', 'mos-deck-engine'), { recursive: true });
  // The script reads ../data/publish-needs.json + ../data/command-registry.json
  // + ../skills/<handle>/ relative to its own location in scripts/.
  fs.writeFileSync(path.join(tmp, 'data', 'publish-needs.json'), JSON.stringify(mapObject, null, 2));
  fs.copyFileSync(REAL_REGISTRY, path.join(tmp, 'data', 'command-registry.json'));
  fs.copyFileSync(REAL_SCRIPT, path.join(tmp, 'scripts', 'check-publish-needs.cjs'));
  // Stub SKILL.md so the mos-deck-engine handle resolves in the mirror.
  fs.writeFileSync(path.join(tmp, 'skills', 'mos-deck-engine', 'SKILL.md'), '# stub');
  try {
    execFileSync(process.execPath, [path.join(tmp, 'scripts', 'check-publish-needs.cjs')], {
      stdio: 'pipe',
    });
    return 0;
  } catch (e) {
    return (e && typeof e.status === 'number') ? e.status : 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 1. committed map passes the validator (exit 0). Run the REAL script in place.
(function () {
  let code = 0;
  try {
    execFileSync(process.execPath, [REAL_SCRIPT], { stdio: 'pipe' });
  } catch (e) {
    code = (e && typeof e.status === 'number') ? e.status : 1;
  }
  ok('committed map passes check-publish-needs.cjs (exit 0)', code === 0);
})();

// Load the real map to mutate from a clean baseline.
const baseMap = JSON.parse(fs.readFileSync(REAL_MAP, 'utf8'));

// 2. fake resolves_to -> validator fails (exit 1).
(function () {
  const mutated = JSON.parse(JSON.stringify(baseMap));
  mutated.jobs[0].resolves_to = '/mos:does-not-exist';
  const code = runValidatorWithMap(mutated);
  ok('mutated fixture with a fake resolves_to fails (exit 1)', code === 1);
})();

// 3. missing shows -> validator fails (exit 1).
(function () {
  const mutated = JSON.parse(JSON.stringify(baseMap));
  delete mutated.jobs[0].shows;
  const code = runValidatorWithMap(mutated);
  ok('mutated fixture with a missing shows fails (exit 1)', code === 1);
})();

// 4-7. the role_blend -> default lane mapper (R6).
ok("founder-dominant -> 'get-into-world'",
  defaultLaneForRoleBlend({ founder: 0.7, researcher: 0.3 }) === 'get-into-world');
ok("researcher-dominant -> 'find-broken'",
  defaultLaneForRoleBlend({ researcher: 0.8, founder: 0.2 }) === 'find-broken');
ok("empty role_blend -> 'know-stand'",
  defaultLaneForRoleBlend({}) === 'know-stand');
ok("null role_blend -> 'know-stand'",
  defaultLaneForRoleBlend(null) === 'know-stand');

// Extra fences (cheap, lock the contract the selector + map depend on).
ok("investor-dominant -> 'find-broken' (thesis/red-team is a find-what's-broken job)",
  defaultLaneForRoleBlend({ investor: 0.9, founder: 0.1 }) === 'find-broken');
ok('all-zero weights -> DEFAULT_LANE',
  defaultLaneForRoleBlend({ founder: 0, researcher: 0 }) === DEFAULT_LANE);
ok('LANES is the 4 frozen ids',
  Array.isArray(LANES) && LANES.length === 4 &&
  ['know-stand', 'find-broken', 'make-land', 'get-into-world'].every((l) => LANES.indexOf(l) !== -1));
ok("DEFAULT_LANE is 'know-stand'", DEFAULT_LANE === 'know-stand');

console.log('\npublish-needs map test: ' + pass + ' assertions passed');
