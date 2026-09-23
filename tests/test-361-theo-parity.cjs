#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 361 Plan 02 Task 2 -- read-only Theo input-shape parity for the three
 * known-shape arms 361-02 Task 1 added to lib/core/part8-egress-guard.cjs
 * (framework_step, framework_techniques, case_story).
 *
 * WHY THIS FILE EXISTS: the plugin arms are hand-copied from Theo's own input
 * schemas (framework-step.ts, framework-techniques.ts) and hand-copied
 * regexes (vocabulary.ts). A hand copy drifts silently the moment either side
 * changes. This test re-derives both sides from source TEXT (no TypeScript
 * compiler, no schema library) and asserts they still agree, so a future Theo
 * change that widens or narrows a shape is CAUGHT here instead of shipping a
 * plugin arm that is quietly wrong.
 *
 * READ-ONLY, ABSOLUTELY: every access to the Theo checkout below goes through
 * fs.readFileSync. This file opens no child process of any kind against that
 * checkout and makes no filesystem change to it. The acceptance grep for this
 * plan's own hygiene rule counts occurrences of the three disallowed calls in
 * this very file's source and expects zero.
 *
 * LEGS:
 *   Leg 1 -- framework-step.ts's inputShape key set == the plugin
 *            framework_step arm's _hasExactKeys required+optional union.
 *   Leg 2 -- framework-techniques.ts's inputShape key set == the plugin
 *            framework_techniques arm's _hasExactKeys union.
 *   Leg 3 -- Theo's FRAMEWORK_NAME_PATTERN and PROCESS_STEP_ID_PATTERN regex
 *            source text equals the plugin's FRAMEWORK_NAME_RE and
 *            PROCESS_STEP_ID_RE literals, byte-for-byte.
 *   Leg 4 -- case_story: if a Theo content file named *case-story* exists,
 *            compare its inputShape keys against the plugin's case_story arm
 *            the same way as Legs 1-2 and FAIL on a difference (the D-15
 *            recheck trigger). If no such file exists yet, print a note and
 *            pass -- the plugin arm's {framework} shape is an assumption
 *            until Theo 20.1 publishes the real tool.
 *
 * Checkout resolution: MINDRIAN_THEO_CHECKOUT, default /home/jsagi/Theo. If
 * the checkout directory or any file this test needs is missing or cannot be
 * read, print "ENV GAP: Theo checkout not found" and exit 77 -- never FAIL
 * the suite for an environment the current machine simply does not have.
 *
 * exit 0  -> PASSED (all legs)
 * exit 1  -> FAILED
 * exit 77 -> SKIPPED (ENV GAP: Theo checkout not found)
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const CHECKOUT = process.env.MINDRIAN_THEO_CHECKOUT || '/home/jsagi/Theo';
const CONTENT_DIR = path.join(CHECKOUT, 'src', 'mcp', 'content');
const FRAMEWORK_STEP_PATH = path.join(CONTENT_DIR, 'framework-step.ts');
const FRAMEWORK_TECHNIQUES_PATH = path.join(CONTENT_DIR, 'framework-techniques.ts');
const VOCABULARY_PATH = path.join(CONTENT_DIR, 'vocabulary.ts');

let checks = 0;
let failed = 0;
const failures = [];

function ok(label, cond, detail) {
  checks += 1;
  if (!cond) {
    failed += 1;
    failures.push(label + (detail ? ' -- ' + detail : ''));
    console.log('FAIL: ' + label + (detail ? ' -- ' + detail : ''));
  } else {
    console.log('PASS: ' + label);
  }
}

function envGapExit(reason) {
  console.log('ENV GAP: Theo checkout not found (' + reason + ')');
  process.exit(77);
}

function readTextOrGap(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    envGapExit(label + ' unreadable at ' + filePath + ' (' + (e && e.message) + ')');
    return null; // unreachable, envGapExit exits
  }
}

// ---------------------------------------------------------------------------
// Checkout presence gate.
// ---------------------------------------------------------------------------
if (!fs.existsSync(CHECKOUT)) {
  envGapExit(CHECKOUT + ' does not exist');
}
if (!fs.existsSync(CONTENT_DIR)) {
  envGapExit(CONTENT_DIR + ' does not exist');
}

// Record the checkout's HEAD commit for the log only, reading the ref chain
// straight off disk (no process is opened to obtain it).
function readCheckoutHead() {
  try {
    const gitDir = path.join(CHECKOUT, '.git');
    const headText = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const refMatch = headText.match(/^ref:\s*(.+)$/);
    if (refMatch) {
      const refPath = path.join(gitDir, refMatch[1]);
      if (fs.existsSync(refPath)) {
        return fs.readFileSync(refPath, 'utf8').trim();
      }
      // Packed refs fallback.
      const packedPath = path.join(gitDir, 'packed-refs');
      if (fs.existsSync(packedPath)) {
        const packed = fs.readFileSync(packedPath, 'utf8');
        const line = packed.split('\n').find((l) => l.endsWith(' ' + refMatch[1]));
        if (line) return line.split(' ')[0];
      }
      return null;
    }
    return headText; // detached HEAD: HEAD itself is the sha.
  } catch (_e) {
    return null;
  }
}

const checkoutHead = readCheckoutHead();
console.log('Theo checkout HEAD (for the record): ' + (checkoutHead || 'unknown'));

// ---------------------------------------------------------------------------
// Brace-matching helpers (plain string parsing, no TypeScript compiler).
// ---------------------------------------------------------------------------

// extractBraceBlock(text, markerText): find markerText, then the next '{',
// then brace-match to its closing '}'. Returns the full '{...}' slice
// (inclusive) or null.
function extractBraceBlock(text, markerText) {
  const markerIdx = text.indexOf(markerText);
  if (markerIdx === -1) return null;
  const braceStart = text.indexOf('{', markerIdx);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(braceStart, i + 1);
    }
  }
  return null;
}

// extractTopLevelKeys(braceBlockText): collect identifier keys off the START
// of a line inside the block (the plan's own scan rule). Sufficient here
// because every describe()/regex() argument in these two Theo files is a
// method call or string literal, never itself a line starting with
// "identifier:".
function extractTopLevelKeys(braceBlockText) {
  const inner = braceBlockText.slice(1, -1);
  const keys = new Set();
  const re = /^\s*([a-z_][a-z0-9_]*)\s*:/gm;
  let m;
  while ((m = re.exec(inner)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

function theoInputShapeKeys(filePath, label) {
  const text = readTextOrGap(filePath, label);
  const block = extractBraceBlock(text, 'inputShape:');
  if (!block) {
    envGapExit(label + ': "inputShape:" block not found in ' + filePath);
  }
  return extractTopLevelKeys(block);
}

// pluginArmKeys(guardSrc, toolName): the arm block is the text from the
// FIRST occurrence of the arm's own toolName.indexOf(...) guard line to the
// next "return {" (the plan's own slice rule, anchored on the guard-line
// form rather than a bare substring so a docblock mention of the same tool
// name earlier in the file cannot be mistaken for the arm itself).
function pluginArmKeys(guardSrc, toolName) {
  const marker = "toolName.indexOf('" + toolName + "')";
  const start = guardSrc.indexOf(marker);
  if (start === -1) return null;
  const returnIdx = guardSrc.indexOf('return {', start);
  if (returnIdx === -1) return null;
  const armText = guardSrc.slice(start, returnIdx);
  const callMatch = armText.match(/_hasExactKeys\(payload,\s*(\[[^\]]*\])\s*,\s*(\[[^\]]*\])\)/);
  if (!callMatch) return null;
  const parseList = (literal) =>
    (literal.match(/'([^']*)'/g) || []).map((s) => s.slice(1, -1));
  const required = parseList(callMatch[1]);
  const optional = parseList(callMatch[2]);
  return new Set(required.concat(optional));
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

function setToSortedArray(s) {
  return Array.from(s).sort();
}

// extractPatternLiteral(text, marker): text from "marker =" to the first
// ";" after it, trimmed -- works whether the assignment is one line or wraps.
function extractPatternLiteral(text, marker) {
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const eqIdx = text.indexOf('=', idx);
  if (eqIdx === -1) return null;
  const semiIdx = text.indexOf(';', eqIdx);
  if (semiIdx === -1) return null;
  return text.slice(eqIdx + 1, semiIdx).trim();
}

const guardSrc = fs.readFileSync(GUARD_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Leg 1: framework_step key-set parity.
// ---------------------------------------------------------------------------
function leg1() {
  const theoKeys = theoInputShapeKeys(FRAMEWORK_STEP_PATH, 'framework-step.ts');
  const pluginKeys = pluginArmKeys(guardSrc, 'framework_step');
  ok(
    'Leg 1: framework_step key set matches Theo inputShape',
    pluginKeys && setsEqual(theoKeys, pluginKeys),
    'theo=' + JSON.stringify(setToSortedArray(theoKeys)) + ' plugin=' + JSON.stringify(pluginKeys ? setToSortedArray(pluginKeys) : null)
  );
}

// ---------------------------------------------------------------------------
// Leg 2: framework_techniques key-set parity.
// ---------------------------------------------------------------------------
function leg2() {
  const theoKeys = theoInputShapeKeys(FRAMEWORK_TECHNIQUES_PATH, 'framework-techniques.ts');
  const pluginKeys = pluginArmKeys(guardSrc, 'framework_techniques');
  ok(
    'Leg 2: framework_techniques key set matches Theo inputShape',
    pluginKeys && setsEqual(theoKeys, pluginKeys),
    'theo=' + JSON.stringify(setToSortedArray(theoKeys)) + ' plugin=' + JSON.stringify(pluginKeys ? setToSortedArray(pluginKeys) : null)
  );
}

// ---------------------------------------------------------------------------
// Leg 3: regex literal byte-parity.
// ---------------------------------------------------------------------------
function leg3() {
  const vocabText = readTextOrGap(VOCABULARY_PATH, 'vocabulary.ts');

  const theoFrameworkNamePattern = extractPatternLiteral(vocabText, 'export const FRAMEWORK_NAME_PATTERN');
  const theoProcessStepIdPattern = extractPatternLiteral(vocabText, 'export const PROCESS_STEP_ID_PATTERN');

  const pluginFrameworkNameRe = extractPatternLiteral(guardSrc, 'const FRAMEWORK_NAME_RE');
  const pluginProcessStepIdRe = extractPatternLiteral(guardSrc, 'const PROCESS_STEP_ID_RE');

  ok(
    'Leg 3a: FRAMEWORK_NAME_PATTERN equals plugin FRAMEWORK_NAME_RE, byte-for-byte',
    theoFrameworkNamePattern !== null && theoFrameworkNamePattern === pluginFrameworkNameRe,
    'theo=' + theoFrameworkNamePattern + ' plugin=' + pluginFrameworkNameRe
  );
  ok(
    'Leg 3b: PROCESS_STEP_ID_PATTERN equals plugin PROCESS_STEP_ID_RE, byte-for-byte',
    theoProcessStepIdPattern !== null && theoProcessStepIdPattern === pluginProcessStepIdRe,
    'theo=' + theoProcessStepIdPattern + ' plugin=' + pluginProcessStepIdRe
  );
}

// ---------------------------------------------------------------------------
// Leg 4: case_story, the D-15 recheck trigger.
// ---------------------------------------------------------------------------
function leg4() {
  let entries;
  try {
    entries = fs.readdirSync(CONTENT_DIR);
  } catch (e) {
    envGapExit('cannot list ' + CONTENT_DIR + ' (' + (e && e.message) + ')');
    return;
  }
  const caseStoryFile = entries.find((name) => name.indexOf('case-story') !== -1);
  if (!caseStoryFile) {
    console.log('case_story: not built in the Theo checkout; {framework} assumed per D-15');
    checks += 1; // counts as a passing leg (the "print and pass" branch).
    return;
  }
  const filePath = path.join(CONTENT_DIR, caseStoryFile);
  const theoKeys = theoInputShapeKeys(filePath, caseStoryFile);
  const pluginKeys = pluginArmKeys(guardSrc, 'case_story');
  ok(
    'Leg 4: case_story key set matches Theo inputShape (' + caseStoryFile + ' now exists, D-15 recheck fired)',
    pluginKeys && setsEqual(theoKeys, pluginKeys),
    'theo=' + JSON.stringify(setToSortedArray(theoKeys)) + ' plugin=' + JSON.stringify(pluginKeys ? setToSortedArray(pluginKeys) : null)
  );
}

leg1();
leg2();
leg3();
leg4();

console.log('PASSED=' + (checks - failed) + ' FAILED=' + failed + ' (checks=' + checks + ')');
if (failed > 0) {
  console.log('Failures: ' + failures.join(' | '));
  process.exit(1);
}
console.log('PASS: test-361-theo-parity (' + checks + ' checks)');
process.exit(0);
