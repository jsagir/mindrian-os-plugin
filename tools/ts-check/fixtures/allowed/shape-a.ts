// Allowed shape (a): CommonJS .ts, import type, require, module.exports.
import type { Pair } from './types.ts';

const dep = require('./dep.cjs') as { add(a: number, b: number): number };

function sum(p: Pair): number {
  return dep.add(p.a, p.b);
}

module.exports = { sum };
