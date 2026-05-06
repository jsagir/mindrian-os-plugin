'use strict';
const test = require('node:test');
test('reverse-salient-persona: Wave-0 placeholder (Wave 2 fills with real assertions)', () => {
  const m = require('../lib/agents/reverse-salient-agent.cjs');
  if (typeof m.composeFinding !== 'function') throw new Error('FAIL: composeFinding export missing');
  if (typeof m.gatherBrainContext !== 'function') throw new Error('FAIL: gatherBrainContext export missing');
});
