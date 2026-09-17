'use strict';

// Regression test for .planning/debug/reach-suggestions-labeled-with-raw-claim-ids.md
//
// Defect: a reach/suggestion label rendered a raw internal claim node id (e.g.
// "claim:<sessionId>:<hash>") instead of the claim's resolved text, because
// scripts/intent-classifier.cjs's pickNodeDisplayName (reached via
// buildDialSlotContext) never checked properties.text -- the ONLY field a
// `claim` node (lib/core/navigation/typed-claim.cjs writeClaimNode) actually
// stores its human-readable content under -- before falling back to the raw
// node id.
//
// This test proves, end to end through the PRODUCTION functions (no
// reimplementation): a claim-shaped cortex node with a non-empty
// properties.text resolves that text as the {topic} slot, and the fully
// rendered context_block label never contains a bare `claim:` id substring.
//
// Pure: in-memory fixtures only. No room.db, no network.

const path = require('path');
const ic = require(path.join(__dirname, '..', 'scripts', 'intent-classifier.cjs'));
const { composeLabel } = require(path.join(__dirname, '..', 'lib', 'hmi', 'dial-label-composer.cjs'));

let failures = 0;
function ok(cond, label) {
  if (cond) {
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    failures += 1;
    process.stdout.write('  FAIL: ' + label + '\n');
  }
}

// A claim node exactly as lib/core/navigation/typed-claim.cjs writeClaimNode
// + lib/core/navigation/room-context.cjs legD would shape it: id is the
// opaque 'claim:'+sessionId+':'+hash form, properties carries knowledge_type
// + text (the atomic claim sentence) and NEVER name/label/title.
const CLAIM_NODE = {
  id: 'claim:sess-42:984a59d2',
  type: 'claim',
  properties: {
    knowledge_type: 'fact',
    text: 'the pricing model needs a usage-based tier',
    conditions: '',
    counter_conditions: '',
    valid_from: '',
    valid_until: '',
    source_speaker: '',
    source_segment: '',
  },
  review_status: 'proposed',
};

// ---------------------------------------------------------------------------
// Test 1: buildDialSlotContext resolves {topic} from the claim's properties.text
// (via the cortexNodes fallback rung), NOT the raw node id, when relevantNodes
// does not resolve a topic.
// ---------------------------------------------------------------------------
(function testTopicResolvesClaimText() {
  process.stdout.write('Test 1: buildDialSlotContext resolves claim properties.text, not the raw id\n');

  const slots = ic.buildDialSlotContext(
    { relevantNodes: [], cortexNodes: [CLAIM_NODE] },
    '/home/user/rooms/my-room'
  );

  ok(slots && slots.topic === 'the pricing model needs a usage-based tier',
    'topic resolves to the claim\'s properties.text');
  ok(slots && typeof slots.topic === 'string' && slots.topic.indexOf('claim:') === -1,
    'topic never contains the raw claim: id prefix');
})();

// ---------------------------------------------------------------------------
// Test 2: the fully rendered context_block label (the exact template family
// implicated by the tester's report -- "Bring back what we worked out on
// {topic}.") never contains a bare claim:<id> substring end to end.
// ---------------------------------------------------------------------------
(function testRenderedLabelNeverLeaksClaimId() {
  process.stdout.write('Test 2: rendered context_block label never leaks a raw claim id\n');

  const slots = ic.buildDialSlotContext(
    { relevantNodes: [], cortexNodes: [CLAIM_NODE] },
    '/home/user/rooms/my-room'
  );
  const composed = composeLabel('context_block', slots);

  ok(!composed.degraded, 'label composed from the resolved slot, not the degraded fallback');
  ok(typeof composed.label === 'string' && composed.label.length > 0, 'label renders non-empty');
  ok(composed.label.indexOf('claim:') === -1,
    'rendered label never contains a raw claim:<id> substring: "' + composed.label + '"');
  ok(composed.label.indexOf('the pricing model needs a usage-based tier') !== -1,
    'rendered label carries the claim\'s resolved text');
})();

// ---------------------------------------------------------------------------
// Test 3: relevantNodes (when it resolves a real topic) still wins over
// cortexNodes -- this fix must not change the existing resolution order.
// ---------------------------------------------------------------------------
(function testRelevantNodesStillTakesPriority() {
  process.stdout.write('Test 3: relevantNodes topic still wins over a claim cortexNode\n');

  const slots = ic.buildDialSlotContext(
    { relevantNodes: [{ id: 'Pricing Model' }], cortexNodes: [CLAIM_NODE] },
    '/home/user/rooms/my-room'
  );
  ok(slots && slots.topic === 'Pricing Model',
    'relevantNodes[0] display name still takes priority over the cortexNodes fallback');
})();

// ---------------------------------------------------------------------------

if (failures > 0) {
  process.stdout.write('\n' + failures + ' assertion(s) FAILED\n');
  process.exit(1);
}
process.stdout.write('\nAll reach-label claim-text assertions passed.\n');
process.exit(0);
