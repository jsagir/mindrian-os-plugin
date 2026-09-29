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
 *   Leg 4 -- case_story, a full pin of Theo 20.1-04's case-story.ts contract
 *            (361-09). D-15 is resolved by Theo 20.1-04 and pinned here: a
 *            later Theo change to the shape fails this test and names the leg.
 *            Leg 4a (keys): the Theo inputShape key set equals the plugin
 *              case_story arm's _hasExactKeys union {case_name, framework_name}.
 *            Leg 4b (optionality): the plugin arm's required list is empty,
 *              both Theo inputShape values start with handle(, and Theo's
 *              function handle( carries .optional().
 *            Leg 4c (handle schema): Theo's handle() carries
 *              .regex(FRAMEWORK_NAME_PATTERN) and .max(128); the plugin guard
 *              gates case_name on FRAMEWORK_NAME_RE and framework_name on
 *              _isKnownFrameworkHandle (Leg 3a pins the regex byte-for-byte).
 *            Leg 4d (exactly-one-of): Theo's case-story.ts carries the
 *              EXACTLY_ONE_OF refusal, and the plugin guard declines the
 *              both-keys shape while proving the framework_name shape.
 *            Informational only (never a pass or fail): whether this Theo
 *            checkout's src/mcp/content/index.ts registers case_story yet
 *            (registration is Theo 20.1-16; the arm is correct either way).
 *            If no case-story file exists (an older checkout), print a note
 *            and pass.
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
// pluginArmKeyLists returns {required, optional} arrays (null when the arm or
// its _hasExactKeys call is not found); pluginArmKeys is the thin union
// wrapper Legs 1-2 and 4a use.
function pluginArmKeyLists(guardSrc, toolName) {
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
  return { required: required, optional: optional };
}

function pluginArmKeys(guardSrc, toolName) {
  const lists = pluginArmKeyLists(guardSrc, toolName);
  if (!lists) return null;
  return new Set(lists.required.concat(lists.optional));
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
// Leg 4: case_story, a full pin of Theo 20.1-04's contract (361-09).
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
    console.log("case_story: no case-story file in this Theo checkout; the plugin arm pins Theo 20.1-04's exactly-one-of {case_name | framework_name}");
    checks += 1; // counts as a passing leg (the "print and pass" branch).
    return;
  }
  const filePath = path.join(CONTENT_DIR, caseStoryFile);
  const caseStoryText = readTextOrGap(filePath, caseStoryFile);

  // Leg 4a: keys.
  const theoKeys = theoInputShapeKeys(filePath, caseStoryFile);
  const pluginKeys = pluginArmKeys(guardSrc, 'case_story');
  ok(
    'Leg 4a: case_story key set matches Theo inputShape (' + caseStoryFile + ')',
    pluginKeys && setsEqual(theoKeys, pluginKeys),
    'theo=' + JSON.stringify(setToSortedArray(theoKeys)) + ' plugin=' + JSON.stringify(pluginKeys ? setToSortedArray(pluginKeys) : null)
  );

  // Leg 4b: optionality.
  const lists = pluginArmKeyLists(guardSrc, 'case_story');
  const inputShapeBlock = extractBraceBlock(caseStoryText, 'inputShape:') || '';
  const handleBlock = extractBraceBlock(caseStoryText, 'function handle(') || '';
  const caseNameIsHandle = /^\s*case_name:\s*handle\(/m.test(inputShapeBlock);
  const frameworkNameIsHandle = /^\s*framework_name:\s*handle\(/m.test(inputShapeBlock);
  const handleOptional = handleBlock.indexOf('.optional()') !== -1;
  ok(
    'Leg 4b: case_story optionality (plugin required list empty, both Theo keys are handle(), handle() is .optional())',
    lists !== null && lists.required.length === 0 && caseNameIsHandle && frameworkNameIsHandle && handleOptional,
    'pluginRequired=' + JSON.stringify(lists ? lists.required : null) +
      ' case_name=handle(:' + caseNameIsHandle +
      ' framework_name=handle(:' + frameworkNameIsHandle +
      ' handle().optional():' + handleOptional
  );

  // Leg 4c: handle schema.
  const handleRegex = handleBlock.indexOf('.regex(FRAMEWORK_NAME_PATTERN)') !== -1;
  const handleMax = handleBlock.indexOf('.max(128)') !== -1;
  const pluginCaseNameCharset = guardSrc.indexOf('FRAMEWORK_NAME_RE.test(payload.case_name)') !== -1;
  const pluginFrameworkNameCanonical = guardSrc.indexOf('_isKnownFrameworkHandle(payload.framework_name)') !== -1;
  ok(
    'Leg 4c: case_story handle schema (Theo .regex(FRAMEWORK_NAME_PATTERN) and .max(128); plugin gates case_name on FRAMEWORK_NAME_RE and framework_name on _isKnownFrameworkHandle)',
    handleRegex && handleMax && pluginCaseNameCharset && pluginFrameworkNameCanonical,
    'theoRegex=' + handleRegex + ' theoMax128=' + handleMax +
      ' pluginCaseNameCharset=' + pluginCaseNameCharset +
      ' pluginFrameworkNameCanonical=' + pluginFrameworkNameCanonical
  );

  // Leg 4d: exactly-one-of.
  const theoExactlyOneOf = caseStoryText.indexOf('EXACTLY_ONE_OF') !== -1;
  let bothDeclined = false;
  let frameworkNameProven = false;
  try {
    const guard = require(GUARD_PATH);
    bothDeclined = guard._proveKnownToolShape({ case_name: 'Betamax vs VHS', framework_name: 'Dominant Design' }, 'case_story') === null;
    const proven = guard._proveKnownToolShape({ framework_name: 'Dominant Design' }, 'case_story');
    frameworkNameProven = !!proven && proven.class === 'known_tool_shape';
  } catch (e) {
    console.log('Leg 4d: plugin guard could not be loaded (' + (e && e.message) + ')');
  }
  ok(
    'Leg 4d: case_story exactly-one-of (Theo carries EXACTLY_ONE_OF; plugin declines both keys and proves framework_name)',
    theoExactlyOneOf && bothDeclined && frameworkNameProven,
    'theoExactlyOneOf=' + theoExactlyOneOf + ' pluginBothDeclined=' + bothDeclined + ' pluginFrameworkNameProven=' + frameworkNameProven
  );

  // Informational only, never a pass or fail.
  const indexPath = path.join(CONTENT_DIR, 'index.ts');
  if (fs.existsSync(indexPath)) {
    let registered = false;
    try {
      registered = /registerCaseStory\(\s*server/.test(fs.readFileSync(indexPath, 'utf8'));
    } catch (_e) {
      registered = false;
    }
    console.log('case_story registered on this Theo checkout: ' + (registered ? 'yes' : 'no'));
  }
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
