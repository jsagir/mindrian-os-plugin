'use strict';

/**
 * Phase 386 plan 34 (E-TEST): the verdict mutation preload.
 *
 * Use: node --require tests/helpers/part8-verdict-mutation-386.cjs <test file>
 * with MUTATE_MODE set to one of:
 *   block-to-ambiguous   every block verdict of classify() and theoVerdict() becomes ambiguous
 *   ambiguous-to-allow   every ambiguous verdict becomes allow
 *   allow-to-ambiguous   every allow verdict becomes ambiguous
 *   ambiguous-to-block   every ambiguous verdict becomes block
 *
 * A test that asserts only "not allow" survives block-to-ambiguous and
 * ambiguous-to-block. The class and the reason of the verdict are kept, so only
 * the verdict word moves. The preload wraps the export of
 * lib/core/part8-egress-guard.cjs through Module._load. It edits no file on disk.
 * Because it is a --require preload (and is also passed through NODE_OPTIONS), a
 * child process that a test spawns (the hook script) is mutated too.
 *
 * Node built-ins only. No network.
 */

const Module = require('node:module');
const path = require('node:path');

const MODE = process.env.MUTATE_MODE || '';
const GUARD = path.resolve(__dirname, '..', '..', 'lib', 'core', 'part8-egress-guard.cjs');
const MAP = Object.freeze({
  'block-to-ambiguous': ['block', 'ambiguous'],
  'ambiguous-to-allow': ['ambiguous', 'allow'],
  'allow-to-ambiguous': ['allow', 'ambiguous'],
  'ambiguous-to-block': ['ambiguous', 'block'],
});

function mutate(verdict) {
  const m = MAP[MODE];
  if (!m || verdict === null || typeof verdict !== 'object' || verdict.verdict !== m[0]) return verdict;
  return Object.assign({}, verdict, { verdict: m[1] });
}

if (MAP[MODE]) {
  const origLoad = Module._load;
  const wrapped = new WeakMap();
  Module._load = function patchedLoad(request, parent, isMain) {
    const exp = origLoad.apply(this, arguments);
    let resolved = null;
    try { resolved = Module._resolveFilename(request, parent, isMain); } catch (_e) { resolved = null; }
    if (resolved !== GUARD || exp === null || typeof exp !== 'object') return exp;
    if (wrapped.has(exp)) return wrapped.get(exp);
    const proxy = new Proxy(exp, {
      get(target, prop, receiver) {
        const v = Reflect.get(target, prop, receiver);
        if ((prop === 'classify' || prop === 'theoVerdict') && typeof v === 'function') {
          return function mutatedVerdict() { return mutate(v.apply(target, arguments)); };
        }
        return v;
      },
    });
    wrapped.set(exp, proxy);
    return proxy;
  };
}
