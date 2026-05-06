'use strict';
const test = require('node:test');
test('reverse-salient-telemetry: Wave-0 placeholder (Wave 2 fills with real assertions)', () => {
  const m = require('../lib/agents/reverse-salient-agent.cjs');
  if (typeof m.detectAndSurface !== 'function') throw new Error('FAIL: detectAndSurface export missing');
  if (typeof m.emitFindingEdge !== 'function') throw new Error('FAIL: emitFindingEdge export missing');
});
