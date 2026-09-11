#!/usr/bin/env node
'use strict';

/**
 * Quick 260910-hni, Task 3 -- the live end-to-end smoke over the whole
 * Theo `brain_ask` composition path this quick task built: brainClient.ask()
 * (Task 1's `_composeTheoAsk`) -> `wrapDirective` (Task 2's `grounding`
 * additive field) -> the brainRoute-equivalent command-slug mapping (Task
 * 2's `opt.commands` push).
 *
 * SKIP CONTRACT (load-bearing): `brainClient.isAvailable()` is checked
 * BEFORE anything else runs, and prints a leading `SKIP:` line as the very
 * first line of stdout when the Brain is unreachable or no key resolves --
 * `tests/run-all-339.sh`'s `run_may_skip` recognizes that line and counts
 * this arm SKIPPED, never PASSED. An unavailable Brain must never render a
 * false PASS (the whole reason FLIP-08 / this task's own truths table
 * exists). Hand-rolled script (mirrors tests/test-339-origin-single-source.cjs's
 * precedent), NOT node:test -- node:test's own TAP preamble ("TAP version
 * 13") would otherwise beat the SKIP line to stdout's first line.
 *
 * Question content, Canon Part 8: the live question below is a generic
 * methodology handle ("framework chain analysis sequence"), never user
 * artifacts, meeting text, or personal identifiers -- the same ALLOW-class
 * text tests/test-254-ambiguous-disclosure.cjs already uses for this exact
 * reason.
 *
 * KNOWN_METHODOLOGIES is NOT exported from lib/mcp/brain-router.cjs (its
 * module.exports is `{ recommend, validateChain }` only). Per this task's
 * own instruction, that list is RE-DERIVED here verbatim rather than adding
 * a new export the rest of the repo has no other reason to carry. Anyone
 * who edits brain-router.cjs's KNOWN_METHODOLOGIES must update this copy
 * too; there is no automated drift check for it (a stated, accepted gap,
 * not an oversight -- adding one is out of this quick task's scope).
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const brainClient = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs'));
const { wrapDirective } = require(path.join(REPO_ROOT, 'lib', 'core', 'directive-envelope.cjs'));

// Re-derived verbatim from lib/mcp/brain-router.cjs:117-126 (not exported).
const KNOWN_METHODOLOGIES = [
  'lean-canvas', 'think-hats', 'structure-argument', 'beautiful-question',
  'build-knowledge', 'challenge-assumptions', 'validate', 'map-unknowns',
  'diagnose', 'score-innovation', 'explore-domains', 'analyze-needs',
  'user-needs', 'analyze-systems', 'analyze-timing', 'find-bottlenecks',
  'root-cause', 'systems-thinking', 'macro-trends', 'explore-trends',
  'explore-futures', 'dominant-designs', 'scenario-plan',
  'find-connections', 'build-thesis', 'compare-ventures', 'research',
  'deep-grade', 'grade', 'leadership',
];

// The same lowercase-and-strip-to-[a-z-] normalization brainRoute() applies
// to a rawChain entry (lib/mcp/brain-router.cjs's mappedChain construction)
// before matching it against KNOWN_METHODOLOGIES.
function normalizeSlug(name) {
  return typeof name === 'string' ? name.toLowerCase().replace(/[^a-z-]/g, '') : '';
}

async function main() {
  const available = await Promise.resolve(brainClient.isAvailable());
  if (!available) {
    // MUST be the first line of stdout -- run-all-339.sh's run_may_skip
    // greps for a leading SKIP line to distinguish an honest skip from a
    // false PASS.
    console.log('SKIP: Brain not available (no key or unreachable); live e2e not run');
    process.exit(0);
    return;
  }

  const question = 'framework chain analysis sequence';
  const raw = await brainClient.ask(question);

  if (raw == null) {
    console.log('SKIP: Brain reported available but the live brain_ask call returned null (transport failure); live e2e not run');
    process.exit(0);
    return;
  }
  if (raw && typeof raw === 'object' && raw.error) {
    console.log('SKIP: live brain_ask call returned an error sentinel (' + raw.error + '); live e2e not run');
    process.exit(0);
    return;
  }

  const envelope = wrapDirective(raw, raw.mode_signals || {});

  let failed = 0;
  function check(label, cond) {
    if (cond) {
      console.log('  ok  ' + label);
    } else {
      failed += 1;
      console.log('  FAIL  ' + label);
    }
  }

  check(
    'directive.guided.framework is a non-empty string',
    !!(envelope.directive && envelope.directive.guided
      && typeof envelope.directive.guided.framework === 'string'
      && envelope.directive.guided.framework.length > 0)
  );
  check(
    'next_gate.options has at least one entry',
    !!(envelope.next_gate && Array.isArray(envelope.next_gate.options) && envelope.next_gate.options.length > 0)
  );
  check(
    'grounding.rows has at least one row',
    !!(envelope.grounding && Array.isArray(envelope.grounding.rows) && envelope.grounding.rows.length > 0)
  );
  check(
    "mode_rationale is not 'brain_unreachable'",
    envelope.mode_rationale !== 'brain_unreachable'
  );

  // Quick 260911-ddd (DDD-01): command-bearing-first partition, theo_rank,
  // and grounding.option_order, proven live against the real Brain.
  const liveOptions = (envelope.next_gate && Array.isArray(envelope.next_gate.options))
    ? envelope.next_gate.options
    : [];
  const anyLiveOptionHasCommand = liveOptions.some((o) => Array.isArray(o.commands) && o.commands.length > 0);
  check(
    'when any option carries a command, options[0].commands.length > 0 (command-bearing-first partition)',
    !anyLiveOptionHasCommand
      || (liveOptions[0] && Array.isArray(liveOptions[0].commands) && liveOptions[0].commands.length > 0)
  );
  check(
    'options[0].theo_rank is a finite number',
    !!(liveOptions[0] && Number.isFinite(liveOptions[0].theo_rank))
  );
  check(
    "grounding.option_order === 'command_bearing_first'",
    !!(envelope.grounding && envelope.grounding.option_order === 'command_bearing_first')
  );

  // Honest coverage reporting over the brainRoute-equivalent slug mapping:
  // never a silent pass either way.
  const options = (envelope.next_gate && Array.isArray(envelope.next_gate.options)) ? envelope.next_gate.options : [];
  const frameworkNames = options.map((o) => o && o.framework).filter((f) => typeof f === 'string');
  const matchedSlugs = frameworkNames
    .map(normalizeSlug)
    .filter((slug) => KNOWN_METHODOLOGIES.some((m) => m === slug || slug.includes(m)));
  const zeroEdgeCount = options.filter((o) => !Array.isArray(o.commands) || o.commands.length === 0).length;

  if (matchedSlugs.length > 0) {
    console.log('  ok  brainRoute-equivalent slug mapping matched: ' + matchedSlugs.join(', '));
  } else {
    console.log(
      '  COVERAGE: no returned framework name normalized onto a KNOWN_METHODOLOGIES slug; '
        + zeroEdgeCount + ' of ' + options.length + ' next_gate.options had zero command edges.'
    );
  }

  console.log('');
  console.log('Live end-to-end summary:');
  console.log('  question: ' + question);
  console.log('  directive.guided.framework: ' + JSON.stringify(envelope.directive && envelope.directive.guided && envelope.directive.guided.framework));
  console.log('  directive.guided.stage: ' + JSON.stringify(envelope.directive && envelope.directive.guided && envelope.directive.guided.stage));
  console.log('  next_gate.options.length: ' + options.length);
  console.log('  grounding.rows.length: ' + (envelope.grounding && Array.isArray(envelope.grounding.rows) ? envelope.grounding.rows.length : 0));
  console.log('  grounding.chain_status: ' + JSON.stringify(envelope.grounding && envelope.grounding.chain_status));
  console.log('  mode_rationale: ' + envelope.mode_rationale);

  if (failed > 0) {
    console.log('');
    console.log('Phase 339 (quick/260910-hni) live e2e smoke: FAIL (' + failed + ' failures)');
    process.exit(1);
  }
  console.log('');
  console.log('Phase 339 (quick/260910-hni) live e2e smoke: PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
