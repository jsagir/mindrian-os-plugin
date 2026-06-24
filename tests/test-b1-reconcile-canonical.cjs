'use strict';
/*
 * Phase 179-07 (Wave 7, FINAL) -- the reconciliation + Part-8-sweep + CIRS-conformance proof.
 *
 * Two tasks, one suite:
 *
 *   Task 1 (REQ-10, reconcile the two B1 specs): commands/new-project.md carries NO
 *   competing persona-first / arriving-with B1 starting-point gate prose; it RETAINS its
 *   B2 scaffold backend (scaffoldRoomSkeleton / blueprint gate / birthRoom). commands/ignite.md
 *   remains the ONE canonical B1 (the persona-first "Who are you arriving as?" card present in
 *   ignite, absent from new-project). One canonical B1 across the two files.
 *
 *   Task 2 (REQ-11, the phase's closing gate): a cross-cutting Part 8 leak sweep over EVERY
 *   phase-179-touched runtime surface finds zero forbidden Brain/network egress symbols and zero
 *   user-content (role_blend weights / user_id / hypothesis_text) in any Brain query payload;
 *   the 179-CONTEXT cirs_relationship block implies canon_parts 11 (R12 auto-derivation); and the
 *   CIRS born-wired gates (build-connector-registry --check + build-orchestration-projection
 *   --check + check-render-coverage --check) all exit 0 over the phase's touched surfaces.
 *
 * NO em-dashes anywhere in this file. Hyphens only. No new reach/edge/node minted.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rd = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0;
let fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log('  ok   - ' + label); }
  else { fail++; console.log('  FAIL - ' + label); }
}

// ---------------------------------------------------------------------------
// Task 1 -- reconcile the two B1 specs (REQ-10)
// ---------------------------------------------------------------------------
console.log('Task 1: reconcile the two B1 specs (new-project demotes; ignite canonical)');

const newProject = rd('commands/new-project.md');
const ignite = rd('commands/ignite.md');

// 1a. new-project.md carries NO competing persona-first / arriving-with B1 gate prose.
//     The removed B1 markers must return zero in new-project.md.
ok('new-project.md has NO "B1: STARTING POINT GATE" header',
  !/\*\*B1:\s*STARTING POINT GATE/.test(newProject));
ok('new-project.md has NO "STARTING POINT GATE" gate marker',
  !/STARTING POINT GATE/.test(newProject));
ok('new-project.md has NO "What are you arriving with?" B1 prompt',
  !/What are you arriving with\?/.test(newProject));
ok('new-project.md has NO B1 arriving-with verb labels',
  !/A solution looking for its problem/.test(newProject)
  && !/A domain or interest to explore/.test(newProject)
  && !/A defined venture or business case/.test(newProject));
ok('new-project.md fires NO B1 pickShape F.1 starting-point card',
  !/pickShape\('F\.1'[^)]*STARTING POINT/.test(newProject));
ok('new-project.md has NO B1 gate_id scratchpad journal (the demoted B1 write)',
  !/gate_id:\s*'B1'/.test(newProject));

// 1b. new-project.md RETAINS its B2 scaffold backend.
ok('new-project.md RETAINS scaffoldRoomSkeleton (B2 scaffold backend)',
  /scaffoldRoomSkeleton/.test(newProject));
ok('new-project.md RETAINS the B2 ROOM BLUEPRINT gate',
  /ROOM BLUEPRINT/.test(newProject) && /\*\*B2:\s*ROOM BLUEPRINT GATE/.test(newProject));
ok('new-project.md RETAINS birthRoom delegation prose',
  /birthRoom/.test(newProject));
ok('new-project.md points to ignite.md as the canonical B1',
  /commands\/ignite\.md/.test(newProject) && /scaffold backend/.test(newProject));

// 1c. ignite.md remains the ONE canonical B1 (persona-first card present in ignite,
//     absent from new-project). One canonical B1 across the two files.
ok('ignite.md PRESENT the canonical persona-first "Who are you arriving as?" card',
  /Who are you arriving as\?/.test(ignite));
ok('new-project.md ABSENT the canonical persona-first "Who are you arriving as?" card',
  !/Who are you arriving as\?/.test(newProject));
ok('ignite.md retains its Gate B1 -- Starting Point header (canonical B1 untouched)',
  /Gate B1 -- Starting Point/.test(ignite) || /## Gate B1/.test(ignite));

// 1d. This plan does NOT modify ignite.md (the canonical B1 was built in Waves 3-6).
//     git diff --quiet HEAD -- commands/ignite.md exits 0.
let igniteUnchanged = false;
try {
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'commands/ignite.md'], { cwd: ROOT });
  igniteUnchanged = true;
} catch (_) { igniteUnchanged = false; }
ok('commands/ignite.md is unchanged by this plan (git diff --quiet HEAD exits 0)',
  igniteUnchanged);

// 1e. No em-dashes in the two reconciled surfaces. Use unicode escapes for the
//     detector bytes so this test never trips its own no-em-dash assertion.
const EMDASH = /[\u2014\u2013]/;
ok('new-project.md has no em-dashes', !EMDASH.test(newProject));
ok('this test file has no em-dashes', !EMDASH.test(rd('tests/test-b1-reconcile-canonical.cjs')));

// ---------------------------------------------------------------------------
// Task 2 -- cross-cutting Part 8 leak sweep + CIRS R12 conformance (REQ-11)
// ---------------------------------------------------------------------------
console.log('');
console.log('Task 2: Part 8 leak sweep + CIRS R12 conformance over all touched surfaces');

// 2a. Part 8 sweep: forbidden Brain/network egress symbols over every phase-touched
//     RUNTIME source. Zero user-content egress. The forbidden-symbol regex mirrors the
//     Phase 90 / 122 release-audit sweep idiom (fetch | http | curl | brain.mindrian |
//     tavily | mcp__brain) plus the role_blend.*weight.*brain user-content-to-Brain shape.
const PART8_RUNTIME_SURFACES = [
  'scripts/check-card-fire.cjs',
  'lib/core/scratchpad-ops.cjs',
  'lib/core/abstraction-gate.cjs',
  'lib/core/navigation/abstraction-claim.cjs',
  'scripts/check-abstraction-fixture-neutral.cjs',
];
const FORBIDDEN_EGRESS = /\bfetch\s*\(|https?:\/\/|\bcurl\b|brain\.mindrian|\btavily\b|mcp__brain/i;
// The canonical Part 8 breach shape is a user-content token (role_blend weights / user_id /
// hypothesis_text) placed INTO a Brain CALL payload -- e.g. brain_query({ ... role_blend ... }),
// brain_write(... user_id ...), mcp__brain(... hypothesis_text ...). It is NOT prose that
// asserts the boundary holds. A line that co-locates a user-content token with a Brain call
// is scanned line-by-line and EXEMPTED when it carries a negation word (never / no / not /
// zero / without / skip / cross to Brain in the negated sense), so the LOCAL-only doctrine
// guarantees (which legitimately name both tokens to say they never cross) are not false-flagged.
const USER_CONTENT_TOKEN = /(role_blend|user_id|hypothesis_text)/i;
const BRAIN_CALL = /brain_query|brain_write|brain_ask|brain_consult|mcp__brain|sendPacket|translateLarryToBrain/i;
const NEGATION = /\b(never|no|not|zero|without|skip|opens? no|carries? only|local[- ]only|local only)\b/i;
function leaksUserContentToBrain(src) {
  for (const line of src.split('\n')) {
    if (USER_CONTENT_TOKEN.test(line) && BRAIN_CALL.test(line) && !NEGATION.test(line)) {
      return line.trim();
    }
  }
  return null;
}

let part8Clean = true;
for (const surf of PART8_RUNTIME_SURFACES) {
  const src = rd(surf);
  const egress = FORBIDDEN_EGRESS.test(src);
  const leak = leaksUserContentToBrain(src);
  ok('Part 8: ' + surf + ' has ZERO forbidden Brain/network egress symbols', !egress);
  ok('Part 8: ' + surf + ' never places user-content (role_blend/user_id/hypothesis_text) into a Brain call payload', leak === null);
  if (egress || leak !== null) part8Clean = false;
}
ok('Part 8: the cross-cutting sweep over all touched runtime surfaces is clean', part8Clean);

// 2b. The two reconciled command surfaces this wave touched also carry zero user-content
//     egress to Brain (doctrine-level: role_blend weights + user_id + hypothesis_text never cross).
for (const cmd of ['commands/new-project.md', 'commands/ignite.md']) {
  const src = rd(cmd);
  ok('Part 8: ' + cmd + ' never places role_blend weights / user_id / hypothesis_text into a Brain call',
    leaksUserContentToBrain(src) === null);
}

// 2b-adversarial: the breach detector is not vacuous -- a synthesized leak line trips it,
// and a synthesized negating-doctrine line does NOT (proving the exemption is scoped).
ok('Part 8: the breach detector CATCHES a synthesized leak (brain_query carrying role_blend)',
  leaksUserContentToBrain('const r = brain_query({ role_blend: weights, user_id: u });') !== null);
ok('Part 8: the breach detector EXEMPTS a negating-doctrine line (role_blend never crosses to Brain)',
  leaksUserContentToBrain('role_blend weights and hypothesis_text never cross to Brain (Part 8).') === null);

// 2c. CIRS R12 conformance: the 179-CONTEXT cirs_relationship block implies canon_parts 11
//     (declaring any cirs_relationship field auto-derives 11 in canon_parts).
const ctx = rd('.planning/phases/179-ignite-b1-starting-point-fix/179-CONTEXT.md');
ok('179-CONTEXT.md declares a cirs_relationship block', /cirs_relationship:/.test(ctx));
ok('179-CONTEXT.md cirs_relationship implies canon_parts 11 (R12 auto-derivation)',
  /cirs_relationship:/.test(ctx) && /canon_parts:\s*\[[^\]]*\b11\b/.test(ctx));

// 2d. CIRS born-wired gates exit 0 over the phase's touched surfaces (every new/modified
//     surface WIRED or EXCLUDED). Run the generators in --check mode; assert exit 0.
function checkGate(label, scriptRel) {
  let exit0 = false;
  try {
    execFileSync('node', [scriptRel, '--check'], { cwd: ROOT, stdio: 'ignore' });
    exit0 = true;
  } catch (_) { exit0 = false; }
  ok('CIRS: ' + label + ' --check exits 0 (born-wired gate green)', exit0);
}
checkGate('build-connector-registry', 'scripts/build-connector-registry.cjs');
checkGate('build-orchestration-projection', 'scripts/build-orchestration-projection.cjs');
checkGate('check-render-coverage', 'scripts/check-render-coverage.cjs');

// ---------------------------------------------------------------------------
console.log('');
console.log('  test-b1-reconcile-canonical: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
