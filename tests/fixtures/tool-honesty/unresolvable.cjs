'use strict';
// Fixture producing a genuinely UNRESOLVABLE reachability (verdict UNKNOWN),
// phase 276-07 Task 3. Why this fixture exists: the live tree's only
// UNKNOWN row (context_assemble.(default)) was closed by this same plan's
// Task 1 (the negation demotion removed its claim entirely) and Task 2 (the
// barrel re-export hop would have resolved it anyway) -- both root-cause
// fixes, not suppressions. tests/test-276-allowed-unverified-contract.cjs's
// Group B needs a live UNKNOWN row to prove D-276-2's never-suppressible
// guard behaviorally; depending on the live tree happening to still contain
// one is fragile by construction, since closing findings is this whole
// phase's own goal. This fixture is the synthetic, permanent replacement:
// its STRONG claim ("Store ... into the room") calls a dotted method on
// a require()-bound repo-local module whose target function
// (unresolvable-target.cjs's `doSomething`) is neither locally defined nor
// re-exported there, so resolveReachability cannot resolve it and correctly
// reports UNKNOWN rather than guessing NO_WRITE or WRITES.
const { z } = require('zod');
const helper = require('./unresolvable-target.cjs');

function register(server) {
  server.tool(
    'fixture_unresolvable',
    'Store the payload into the room via an external helper.',
    {
      text: z.string().describe('input text'),
    },
    async ({ text }) => {
      return { content: [{ type: 'text', text: helper.doSomething(text) }] };
    }
  );
}

module.exports = { register };
