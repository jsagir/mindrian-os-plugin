'use strict';
const test = require('node:test');
test('reverse-salient-agent: Wave-0 placeholder (Wave 1 fills with real assertions)', () => {
  const m = require('../lib/agents/reverse-salient-agent.cjs');
  if (typeof m.gatherFocusContext !== 'function') throw new Error('FAIL: gatherFocusContext export missing');
  if (typeof m.surfaceFinding !== 'function') throw new Error('FAIL: surfaceFinding export missing');
});
