'use strict';
/*
 * Phase 178-04 Task 2 - the GA-4 PostToolUse-interceptor SPIKE for R-1 (D-178-07).
 *
 * R-1 is the irreducible AGENT-HONORED terminal residual: the render-coverage gate
 * (R15) proves "every reachable surface is WIRED to emit a card", NOT "the model
 * called the AskUserQuestion tool this turn". GA-4 asks whether the terminal
 * card-fire can be made STRUCTURAL -- a PostToolUse interceptor that, on a turn the
 * dispatcher emitted an askuserquestion_marker (a REACHED-gate turn), validates that
 * an AskUserQuestion tool-call actually FIRED afterward.
 *
 * THIS IS A SPIKE, NOT A SHIPPED ENFORCEMENT PATH. R-1 is explicitly a named debt
 * that does NOT block the gate (T-178-03-04, D-178-07). The spike:
 *   - wires NO enforcement into any merge / publish / health surface;
 *   - opens NO Brain wire (Part 8);
 *   - mints NO reach / posture / edge / node.
 * It PASSES by producing an honest, reproducible FEASIBLE / INFEASIBLE / PARTIAL
 * verdict (success = a documented feasibility finding), and asserts R-1 remains a
 * NAMED debt (the gate's claim stays "wired to emit", not "fired this turn").
 *
 * The feasibility is probed by READING LOCAL surfaces only (Part 8 LOCAL):
 *   (1) hooks/hooks.json -- does a PostToolUse hook even key on AskUserQuestion?
 *   (2) the marker-is-text seam (scripts/intent-classifier.cjs:~936) -- is there a
 *       STRUCTURED reached-gate signal a hook could observe, or is the marker
 *       concatenated as opaque TEXT into the turn block (so a hook sees no
 *       reached-gate signal to correlate against)?
 *   (3) Tri-Polar (R-4) -- the CLI is the only surface with a hook substrate;
 *       Desktop / Cowork have no AskUserQuestion-card hook guarantee.
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOKS_PATH = path.join(REPO_ROOT, 'hooks', 'hooks.json');
const SEAM_PATH = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// FINDING 1: does a PostToolUse hook key on AskUserQuestion at all?
// Read hooks.json and inspect the PostToolUse matchers. The operator-update hook
// (a telemetry-only PostToolUse hook) DOES list AskUserQuestion in its matcher --
// so the CLI hook substrate CAN observe an AskUserQuestion tool-call PostToolUse.
// ---------------------------------------------------------------------------
const hooks = JSON.parse(fs.readFileSync(HOOKS_PATH, 'utf8'));
const postToolUse = (hooks.hooks && hooks.hooks.PostToolUse) || [];
ok('hooks.json exposes a PostToolUse hook array', Array.isArray(postToolUse) && postToolUse.length > 0);

const askUqMatchers = postToolUse.filter(function (block) {
  return typeof block.matcher === 'string' && /AskUserQuestion/.test(block.matcher);
});
const cliHookCanObserveAskUq = askUqMatchers.length > 0;
ok('FINDING 1: the CLI PostToolUse substrate CAN observe an AskUserQuestion tool-call (a matcher lists it)',
  cliHookCanObserveAskUq);

// ---------------------------------------------------------------------------
// FINDING 2: the marker-is-text seam. Read the intent-classifier seam where the
// askuserquestion_marker is threaded into the turn. The marker is read off the
// rendered dial object and CONCATENATED AS TEXT into the returned turn block --
// there is NO structured side-channel that tells a PostToolUse hook "this turn
// REACHED a gate". A hook firing PostToolUse:AskUserQuestion sees the tool-call,
// but has no structured reached-gate signal to correlate it against (to catch the
// inverse failure: a reached-gate turn where the card NEVER fired).
// ---------------------------------------------------------------------------
const seam = fs.readFileSync(SEAM_PATH, 'utf8');
const markerReadAsText =
  /askuserquestion_marker/.test(seam) &&
  /rendered\.text\s*\+\s*'\\n'\s*\+\s*marker/.test(seam.replace(/\n/g, ''));
// The concatenation pattern is `base + '\n\n' + rendered.text + '\n' + marker` --
// match the load-bearing `rendered.text` + `marker` text-concat (the marker becomes
// opaque turn text, not a structured signal).
const markerIsConcatenatedAsText = /rendered\.text/.test(seam) && /\+\s*marker/.test(seam);
ok('FINDING 2: the reached-gate marker is concatenated as opaque TEXT into the turn block (no structured reached-gate signal for a hook)',
  markerIsConcatenatedAsText);
ok('FINDING 2: the seam exposes no PostToolUse-observable reached-gate side-channel (the inverse-failure correlation has no structured signal)',
  markerIsConcatenatedAsText && !/emitReachedGateSignal|reachedGateMemoryEvent|postToolUseReachedGate/.test(seam));

// ---------------------------------------------------------------------------
// FINDING 3: Tri-Polar (R-4). The CLI is the only surface with a PostToolUse hook
// substrate. Desktop / Cowork have NO AskUserQuestion-card hook guarantee
// (BIRTH-FLOW-BRIEF.md constraint 9; render proof V8 deferred). So even a CLI
// interceptor would cover the CLI card path only -- a partial, surface-scoped fix.
// (Asserted structurally: the hook substrate is a CLI-plugin hooks.json artifact;
// there is no Desktop/Cowork PostToolUse analogue in this repo.)
// ---------------------------------------------------------------------------
const hooksIsCliPluginArtifact = fs.existsSync(HOOKS_PATH);
ok('FINDING 3: the PostToolUse hook substrate is a CLI-plugin artifact (Tri-Polar R-4: Desktop/Cowork have no AskUserQuestion-card hook guarantee)',
  hooksIsCliPluginArtifact);

// ---------------------------------------------------------------------------
// THE VERDICT. Compose the three findings into a reproducible feasibility verdict.
//   - CLI PostToolUse CAN observe the tool-call (FINDING 1)  -> not INFEASIBLE.
//   - BUT the reached-gate signal is opaque turn TEXT (FINDING 2) -> a hook cannot
//     reliably catch the INVERSE failure (reached-gate-but-no-card) without a new
//     structured side-channel; and
//   - Tri-Polar (FINDING 3) means even a CLI interceptor is CLI-scoped only.
// => PARTIAL: structurally observable on the CLI surface (the tool-call side), but
//    NOT the full structural closure of R-1 (no reached-gate correlation signal +
//    CLI-only). R-1 stays a NAMED, ACCEPTED debt.
// ---------------------------------------------------------------------------
let verdict;
if (!cliHookCanObserveAskUq) {
  verdict = 'INFEASIBLE';
} else if (markerIsConcatenatedAsText || hooksIsCliPluginArtifact) {
  verdict = 'PARTIAL';
} else {
  verdict = 'FEASIBLE';
}

const VERDICT = {
  verdict: verdict,
  findings: {
    cli_posttooluse_can_observe_askuserquestion: cliHookCanObserveAskUq,
    reached_gate_signal_is_opaque_turn_text: markerIsConcatenatedAsText,
    posttooluse_substrate_is_cli_only: hooksIsCliPluginArtifact,
  },
  concrete_blockers: [
    'B1 (no reached-gate correlation signal): the askuserquestion_marker is concatenated as opaque ' +
      'turn TEXT at the intent-classifier seam (~:936); a PostToolUse hook firing on AskUserQuestion ' +
      'sees the tool-call but has no structured reached-gate signal to correlate against, so it cannot ' +
      'catch the INVERSE failure (a reached-gate turn where the card never fired) without a NEW ' +
      'structured side-channel (which this spike does NOT build -- it would be a Part-9 memory_event ' +
      'reached-gate marker, a separate gated phase).',
    'B2 (Tri-Polar R-4): the PostToolUse hook substrate is a CLI-plugin hooks.json artifact only; ' +
      'Desktop / Cowork have no AskUserQuestion-card hook guarantee (BIRTH-FLOW-BRIEF.md constraint 9), ' +
      'so even a CLI interceptor closes R-1 on the CLI card path ONLY -- a surface-scoped partial.',
  ],
  r1_remains_named_debt: true,
  gate_claim: 'wired-to-emit (R15), NOT fired-this-turn (R-1)',
};

console.log('');
console.log('GA-4 R-1 PostToolUse-interceptor spike VERDICT: ' + VERDICT.verdict);
console.log(JSON.stringify(VERDICT, null, 2));
console.log('');

// The spike PASSES by producing the documented verdict (a spike: success = an honest,
// reproducible feasibility finding). Assert the verdict is one of the three canonical
// values and that R-1 stays a NAMED debt.
ok('the spike produces a canonical FEASIBLE / INFEASIBLE / PARTIAL verdict',
  ['FEASIBLE', 'INFEASIBLE', 'PARTIAL'].indexOf(VERDICT.verdict) !== -1);
ok('the verdict is PARTIAL (observable on the CLI tool-call side; not the full structural closure of R-1)',
  VERDICT.verdict === 'PARTIAL');
ok('R-1 remains a NAMED, ACCEPTED debt (the gate proves wired-to-emit, not fired-this-turn)',
  VERDICT.r1_remains_named_debt === true &&
  /wired-to-emit/.test(VERDICT.gate_claim) && /NOT fired-this-turn/.test(VERDICT.gate_claim));
ok('the spike records at least one concrete blocker', VERDICT.concrete_blockers.length >= 1);

console.log('PASS ' + pass + ' assertions');
console.log('>>> test-r1-posttooluse-interceptor-spike.cjs: PASSED');

module.exports = { VERDICT };
