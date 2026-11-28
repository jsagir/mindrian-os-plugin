#!/usr/bin/env node
'use strict';
// Phase 400.2.1 (S10): a refused handle on the search card carries one fixed guidance sentence. The live run refused the
// nature handle "how organisms use signals they cannot explain" (7 words; the limit is 6) with no hint.
const path = require('node:path');
const assert = require('node:assert/strict');

const fx = require(path.join(__dirname, 'fixtures', 'persona-run-4002.cjs'));
const { door, NO_KEYS } = fx;

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) { queue.push({ label, fn }); }

/** Plan a run with the given handles and nature handle; returns the plan-research output. */
function planWith(handles, nature) {
  const room = fx.harborRoom();
  fx.roomDbMod.closeRoomDb(fx.roomDbMod.openRoomDb(room));
  const env = fx.envOf();
  const res = fx.runToAccepted(room, env);
  for (const h of fx.RESEARCH) fx.writeHandles(res, h, handles[h], nature);
  const out = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, fx.opts(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  return out;
}

check('N1. a 7-word nature handle is refused for shape with the nature guidance (1 to 6 words, an example)', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const out = planWith(fx.GOOD, 'how organisms use signals they cannot explain');
    assert.equal(out.plan.hats.green.nature.state, 'not_planned:handle_not_generic_shape');
    const shown = out.refused_shown;
    const n = shown.find(r => r.hat === 'green' && r.lens === 'nature');
    assert.ok(n, JSON.stringify(shown));
    assert.equal(n.reason, 'handle_not_generic_shape');
    assert.equal(n.guidance, door.NATURE_GUIDANCE.handle_not_generic_shape);
    assert.ok(/1 to 6 lower-case words/.test(n.guidance));
    assert.ok(!n.guidance.includes('signals'), 'the guidance holds no handle text');
  });
});

check('N2. a normal handle with too many words gets the normal guidance (1 to 4 words, the qualifier is added)', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const handles = Object.assign({}, fx.GOOD, { black: ['supply chains', 'long tail retainer pricing risk'] });
    const shown = planWith(handles).refused_shown;
    const b = shown.find(r => r.hat === 'black');
    assert.ok(b, JSON.stringify(shown));
    assert.equal(b.reason, 'handle_not_generic_shape');
    assert.equal(b.guidance, door.REFUSAL_GUIDANCE.handle_not_generic_shape);
    assert.ok(/1 to 4 lower-case words/.test(b.guidance));
  });
});

check('N3. every guidance sentence is fixed text of 300 characters or fewer; a reason with no entry gets no key', () => {
  for (const t of [door.REFUSAL_GUIDANCE, door.NATURE_GUIDANCE]) {
    assert.ok(Object.isFrozen(t));
    for (const v of Object.values(t)) assert.ok(typeof v === 'string' && v.length > 0 && v.length <= 300);
  }
  assert.equal(Object.prototype.hasOwnProperty.call(door.REFUSAL_GUIDANCE, 'string_not_in_plan'), false);
});

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed += 1; console.log('ok: ' + t.label); } catch (e) { failed += 1; console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e))); }
  }
  fx.cleanup();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
