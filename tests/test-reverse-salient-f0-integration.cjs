'use strict';
const test = require('node:test');
test('reverse-salient-f0-integration: Wave-0 placeholder (Wave 2 fills with real assertions)', () => {
  const m = require('../lib/agents/reverse-salient-agent.cjs');
  if (typeof m.surfaceFinding !== 'function') throw new Error('FAIL: surfaceFinding export missing');
  if (typeof m.detectAndSurface !== 'function') throw new Error('FAIL: detectAndSurface export missing');
});
