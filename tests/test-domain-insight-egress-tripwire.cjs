#!/usr/bin/env node
'use strict';
/*
 * Phase 155-07 Task 2 -- test-domain-insight-egress-tripwire.cjs
 *
 * Part 8 egress tripwire for the domain-insight-sweep path. Adversarial
 * in the Phase 90 forbidden-substring idiom (not decorative).
 *
 * Six behavior assertions:
 *   1. auditQueryString('John Smith PhD oncology Harvard Medical School') throws
 *      (personal name + degree -- the forbidden PII pattern that would leak CV
 *      content into a Tavily query body).
 *   2. auditQueryString('computational biology') does NOT throw (valid generic handle).
 *   3. auditQueryString('john.smith@harvard.edu') throws (email address in query).
 *   4. extractDomains('John Smith, PhD in computational biology at Harvard')
 *      returns handles that each individually pass auditQueryString without throwing
 *      (extractDomains strips PII before output).
 *
 * Two grep-gate assertions (Phase 90 forbidden-substring sweep idiom in CJS):
 *   5. domain-insight-sweep.cjs contains at least one non-comment reference to
 *      'writeClaimNode' (the navigation chokepoint is used, not bypassed).
 *   6. domain-insight-sweep.cjs contains ZERO non-comment references to
 *      'brain_query', 'mcp__brain', or 'brain-client' (no Brain MCP calls in
 *      the sweep -- Part 8 hard line).
 *
 * Exit 0 only if all assertions PASS. Exit 1 on any FAIL.
 * No em-dashes. No external deps. Pure CJS.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------- pass/fail bookkeeping ----------

let checks = 0;
let passes = 0;
const failures = [];

function check(label, ok, extra) {
  checks++;
  if (ok) {
    passes++;
    console.log('  PASS: ' + label);
  } else {
    console.log('  FAIL: ' + label + (extra ? ' -- ' + extra : ''));
    failures.push(label + (extra ? ': ' + extra : ''));
  }
}

// ---------- load modules ----------

const { auditQueryString, ExternalEgressViolation } =
  (function () {
    const m = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
    // ExternalEgressViolation is not exported from rs-egress-prompts; import separately.
    const ev = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-violations.cjs'));
    return { auditQueryString: m.auditQueryString, ExternalEgressViolation: ev.ExternalEgressViolation };
  })();

const { extractDomains } = require(path.join(REPO_ROOT, 'lib', 'core', 'shallow-doc-parser.cjs'));

// ---------- Section 1: auditQueryString throw assertions ----------

console.log('[test-domain-insight-egress-tripwire] Phase 155-07 Part 8 egress tripwire');
console.log('');
console.log('Section 1: PII-laden strings throw at auditQueryString');

// Assertion 1: full name + degree + institution should throw
(function () {
  const piiString = 'John Smith PhD oncology Harvard Medical School';
  let threw = false;
  try {
    auditQueryString(piiString, 'domain-insight-sweep');
  } catch (_e) {
    threw = true;
  }
  check(
    'auditQueryString throws on TitleCase name + PhD (PII-bearing CV fragment)',
    threw,
    'expected throw for: ' + JSON.stringify(piiString)
  );
})();

// Assertion 2: generic handle should NOT throw
(function () {
  const genericHandle = 'computational biology';
  let threw = false;
  let errMsg = '';
  try {
    auditQueryString(genericHandle, 'domain-insight-sweep');
  } catch (e) {
    threw = true;
    errMsg = e.message;
  }
  check(
    'auditQueryString does NOT throw on "computational biology" (valid generic handle)',
    !threw,
    threw ? 'unexpectedly threw: ' + errMsg : ''
  );
})();

// Assertion 3: email address in query should throw
(function () {
  const emailString = 'john.smith@harvard.edu';
  let threw = false;
  try {
    auditQueryString(emailString, 'domain-insight-sweep');
  } catch (_e) {
    threw = true;
  }
  check(
    'auditQueryString throws on email address (john.smith@harvard.edu)',
    threw,
    'expected throw for: ' + JSON.stringify(emailString)
  );
})();

// ---------- Section 2: extractDomains PII-strip assertion ----------

console.log('');
console.log('Section 2: extractDomains strips PII before output');

(function () {
  const piiCv = 'John Smith, PhD in computational biology at Harvard University';
  let handles;
  try {
    handles = extractDomains(piiCv);
  } catch (e) {
    check('extractDomains(pii-cv) did not throw', false, e.message);
    return;
  }

  check(
    'extractDomains returns an array for PII-laden input',
    Array.isArray(handles),
    'got: ' + typeof handles
  );

  if (!Array.isArray(handles)) return;

  // Each returned handle must pass auditQueryString without throwing.
  let allHandlesPass = true;
  let failingHandle = '';
  for (const h of handles) {
    try {
      auditQueryString(h, 'domain-insight-sweep');
    } catch (e) {
      allHandlesPass = false;
      failingHandle = h + ' (' + e.message + ')';
      break;
    }
  }

  check(
    'all handles from extractDomains(pii-cv) pass auditQueryString without throwing',
    allHandlesPass,
    allHandlesPass ? '' : 'failing handle: ' + failingHandle
  );
})();

// ---------- Section 3: grep-gate assertions on domain-insight-sweep.cjs ----------

console.log('');
console.log('Section 3: grep-gate assertions (Phase 90 forbidden-substring idiom in CJS)');

const SWEEP_PATH = path.join(REPO_ROOT, 'lib', 'core', 'domain-insight-sweep.cjs');

let sweepSrc;
try {
  sweepSrc = fs.readFileSync(SWEEP_PATH, 'utf8');
} catch (e) {
  check('domain-insight-sweep.cjs is readable', false, e.message);
  printSummary();
  process.exit(1);
}

// Filter non-comment lines: lines that do NOT start with '//' after trimming.
// This follows the Phase 90 idiom: header comments cannot self-invalidate.
function nonCommentLines(src) {
  return src.split('\n').filter(function (line) {
    return line.trim().slice(0, 2) !== '//';
  }).join('\n');
}

const sweepNonComment = nonCommentLines(sweepSrc);

// Assertion 5: 'writeClaimNode' must appear at least once in non-comment lines.
(function () {
  const count = (sweepNonComment.match(/writeClaimNode/g) || []).length;
  check(
    'domain-insight-sweep.cjs: writeClaimNode appears in non-comment lines (navigation chokepoint used)',
    count >= 1,
    'count: ' + count
  );
})();

// Assertion 6: no Brain MCP tokens in non-comment lines.
(function () {
  const brainTokens = ['brain_query', 'mcp__brain', 'brain-client'];
  for (const token of brainTokens) {
    const count = (sweepNonComment.split(token).length - 1);
    check(
      'domain-insight-sweep.cjs: non-comment lines contain ZERO "' + token + '" (no Brain MCP call)',
      count === 0,
      'count: ' + count
    );
  }
})();

// ---------- Summary ----------

printSummary();

function printSummary() {
  const all = checks === passes;
  console.log('');
  console.log('[test-domain-insight-egress-tripwire] ' + passes + '/' + checks + (all ? ' PASS' : ' FAIL'));
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) { console.log('  - ' + f); }
  }
  process.exit(all ? 0 : 1);
}
