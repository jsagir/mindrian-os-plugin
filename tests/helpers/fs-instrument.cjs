'use strict';
// Phase 109 Wave 0 helper. fs proxy with allow-list for room.db plus WAL/SHM/journal companions.
// Used by tests/test-navigation-acceptance.cjs (Plan 109-10) to assert ZERO non-SQLite filesystem reads
// during the navigation flow. Per RESEARCH section 10.2.

const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_PATH_PATTERNS = [
  /\.mindrian\/room\.db$/,
  /\.mindrian\/room\.db-wal$/,
  /\.mindrian\/room\.db-shm$/,
  /\.mindrian\/room\.db-journal$/,
];

const WRAPPED_METHODS = [
  'readFile',
  'readFileSync',
  'open',
  'openSync',
  'createReadStream',
  'readdir',
  'readdirSync',
  'stat',
  'statSync',
  'lstat',
  'lstatSync',
];

const STATE = { calls: [], throwOnViolation: false, originals: {}, installed: false };

function isAllowed(target) {
  if (typeof target !== 'string') return false;
  const abs = path.resolve(target);
  return ALLOWED_PATH_PATTERNS.some((rx) => rx.test(abs));
}

function wrap(name) {
  const original = fs[name];
  STATE.originals[name] = original;
  fs[name] = function instrumented(...args) {
    const target = args[0];
    if (!isAllowed(target)) {
      STATE.calls.push({
        method: name,
        target: typeof target === 'string' ? target : String(target),
        stack: new Error().stack.split('\n').slice(2, 5).join('\n'),
      });
      if (STATE.throwOnViolation) {
        throw new Error('[fs-instrument] DISALLOWED ' + name + '(' + target + ')');
      }
    }
    return original.apply(fs, args);
  };
}

function install(opts) {
  const options = opts || {};
  if (STATE.installed) {
    throw new Error('[fs-instrument] install called twice without uninstall');
  }
  STATE.calls.length = 0;
  STATE.throwOnViolation = options.throwOnViolation === true;
  WRAPPED_METHODS.forEach(wrap);
  STATE.installed = true;
}

function uninstall() {
  if (!STATE.installed) return;
  WRAPPED_METHODS.forEach((name) => {
    if (STATE.originals[name]) {
      fs[name] = STATE.originals[name];
      delete STATE.originals[name];
    }
  });
  STATE.installed = false;
}

function calls() {
  return STATE.calls.slice();
}

module.exports = { install, uninstall, calls, isAllowed, ALLOWED_PATH_PATTERNS, WRAPPED_METHODS };
