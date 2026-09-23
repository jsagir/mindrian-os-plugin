/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 01 Task 1 -- shared test hygiene helper every 355 test
 * requires. Every 355 test calls scrubVendorKey() and installNetGuard()
 * BEFORE requiring any repo module, and asserts attempts() === 0 as its
 * last check (Pitfall 16: TYPESAFE_API_KEY is exported in the navigator's
 * shell, so "the env var is absent" is not a valid proof by itself -- a
 * test must delete it, then prove via a static scan plus a fetch counter).
 *
 * isPureLineComment, nonCommentLines and listFilesRecursive are copied
 * (not required) from tests/test-356-tripwires.cjs and
 * tests/test-353-tripwires.cjs, keeping the URL-safe `//` handling: a naive
 * `/\/\/.*$/` strip would chop `https://api.typesafe.ai...` off a real
 * violation line entirely, the exact false-negative this idiom exists to
 * avoid. A `//` immediately preceded by `:` is left alone; only a genuine
 * standalone `//` starts a stripped comment.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// scrubVendorKey() -- deletes process.env.TYPESAFE_API_KEY and returns
// whether it was present. Never returns or logs the value itself.
// ---------------------------------------------------------------------------
function scrubVendorKey() {
  const wasPresent = Object.prototype.hasOwnProperty.call(process.env, 'TYPESAFE_API_KEY');
  delete process.env.TYPESAFE_API_KEY;
  return wasPresent;
}

// ---------------------------------------------------------------------------
// installNetGuard() -- replaces globalThis.fetch with a thrower that counts
// every attempted call. Returns { attempts, restore } so a test can prove
// attempts() === 0 as its last check.
// ---------------------------------------------------------------------------
function installNetGuard() {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = function noNetwork355() {
    count += 1;
    throw new Error('no network in 355 tests (hygiene-355 installNetGuard)');
  };
  return {
    attempts: () => count,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

// ---------------------------------------------------------------------------
// makeChecker(label) -- a small PASS/FAIL accumulator matching the house
// style used across tests/test-353-tripwires.cjs and tests/test-356-tripwires.cjs.
// summary() prints "PASS: x FAIL: y" and returns the exit code.
// ---------------------------------------------------------------------------
function makeChecker(label) {
  let pass = 0;
  let fail = 0;
  function check(name, cond, detail) {
    if (cond) {
      pass += 1;
      console.log('PASS: ' + name);
    } else {
      fail += 1;
      console.log('FAIL: ' + name + (detail ? ' (' + detail + ')' : ''));
    }
    return cond;
  }
  function summary() {
    if (label) console.log('--- ' + label + ' ---');
    console.log('PASS: ' + pass + ' FAIL: ' + fail);
    return fail === 0 ? 0 : 1;
  }
  return { check, summary };
}

// ---------------------------------------------------------------------------
// isPureLineComment(line) -- copied from tests/test-356-tripwires.cjs /
// tests/test-353-tripwires.cjs.
// ---------------------------------------------------------------------------
function isPureLineComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

// ---------------------------------------------------------------------------
// nonCommentLines(fileAbs) -- returns the array of non-comment lines in a
// file, with any trailing `//` line-comment stripped from each line, but
// never treating a URL's `://` as a comment start (copied idiom from
// tests/test-353-tripwires.cjs's nonCommentContains).
// ---------------------------------------------------------------------------
function nonCommentLines(fileAbs) {
  let raw;
  try {
    raw = fs.readFileSync(fileAbs, 'utf8');
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    if (isPureLineComment(line)) continue;
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    out.push(code);
  }
  return out;
}

// ---------------------------------------------------------------------------
// listFilesRecursive(dirAbs) -- copied from tests/test-353-tripwires.cjs.
// ---------------------------------------------------------------------------
function listFilesRecursive(dirAbs) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dirAbs, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(abs));
    else if (e.isFile()) out.push(abs);
  }
  return out;
}

module.exports = {
  scrubVendorKey,
  installNetGuard,
  makeChecker,
  isPureLineComment,
  nonCommentLines,
  listFilesRecursive,
};
