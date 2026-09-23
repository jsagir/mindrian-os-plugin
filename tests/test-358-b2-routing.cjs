'use strict';

// Phase 358-08, Task 1 (RED). Routing spec legs T1-T5 for
// lib/core/frame-provenance.cjs resolveQuestionTurn / QUESTION_TURN_PATTERNS /
// QUESTION_TURN_EXAMPLES, plus routing-text legs W1-W3 for commands/room.md
// and skills/room/SKILL.md (navigator requirement 2026-09-23 item 1: Larry
// triggers the question door relevantly).
//
// Hermetic: HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME point at fresh
// scratch dirs before any require, CLAUDE_ACTIVE_ROOM / MINDRIAN_MCP_FIRST /
// MINDRIAN_BRAIN_KEY deleted. This file needs no room (pure spec + text
// checks), but the hermetic env is set anyway for consistency with the
// sibling test-358-b2-cli.cjs and to keep require('../lib/core/navigation.cjs')
// (pulled in transitively by frame-provenance.cjs) from touching a real home.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const ROOM_MD_PATH = path.join(REPO_ROOT, 'commands', 'room.md');
const SKILL_MD_PATH = path.join(REPO_ROOT, 'skills', 'room', 'SKILL.md');

const HOME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-routing-home-'));
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-routing-roomshome-'));
process.env.HOME = HOME_DIR;
process.env.MINDRIAN_HOME = HOME_DIR;
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.MINDRIAN_BRAIN_KEY;

const frameProvenance = require('../lib/core/frame-provenance.cjs');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    const detail = e && e.message ? e.message : String(e);
    process.stdout.write('FAIL - ' + label + '\n');
    process.stdout.write('  ' + detail + '\n');
  }
}

function resolve(u) {
  return frameProvenance.resolveQuestionTurn(u);
}

function assertDoorIntent(u, expectedDoor, expectedIntent) {
  const r = resolve(u);
  assert.ok(r && typeof r === 'object', 'result is not an object: ' + JSON.stringify(r));
  assert.equal(r.door, expectedDoor, 'utterance: ' + JSON.stringify(u) + ' door mismatch, got ' + JSON.stringify(r));
  if (expectedIntent !== undefined) {
    assert.equal(r.intent, expectedIntent, 'utterance: ' + JSON.stringify(u) + ' intent mismatch, got ' + JSON.stringify(r));
  }
}

// ---------------------------------------------------------------------------
// T1: change corpus -> question_set / change
// ---------------------------------------------------------------------------

const CHANGE_CORPUS = [
  'Our question is now: which camera works with sunglasses?',
  'Change our governing question to which camera works with sunglasses',
  "Let's reframe the question: should the checkpoint move north?",
  "Record the room's governing question: which camera solves the delay?",
  'The tasking changed, so we need to look again at the checkpoint',
  'Set our question to which camera works with sunglasses',
];

CHANGE_CORPUS.forEach((phrase, i) => {
  check('T1: change corpus [' + i + '] -> question_set/change :: ' + phrase, () => {
    assertDoorIntent(phrase, 'question_set', 'change');
  });
});

// ---------------------------------------------------------------------------
// T2: ask corpus -> question_read / ask or history
// ---------------------------------------------------------------------------

const ASK_CORPUS = [
  ['What is our governing question?', 'ask'],
  ['Where did our question come from?', 'history'],
  ['Show me the question history', 'history'],
  ['How has our question changed?', 'history'],
  ["What's the room's question?", 'ask'],
];

ASK_CORPUS.forEach(([phrase, intent], i) => {
  check('T2: ask corpus [' + i + '] -> question_read/' + intent + ' :: ' + phrase, () => {
    assertDoorIntent(phrase, 'question_read', intent);
  });
});

// ---------------------------------------------------------------------------
// T3: unrelated corpus -> door null
// ---------------------------------------------------------------------------

const UNRELATED_CORPUS = [
  'What is a camera?',
  'I have a question about the bridge',
  'Question: how long is the bridge?',
  'Any questions before we file?',
  'Check the bridge claim against the field note, exercise 02',
  'Summarize the room',
  'Can you answer this question for me: which camera is cheapest?',
  "That's a good question",
  'Record that I checked the bridge claim',
  "Let's change the plan",
  'The question of cost is still open',
  'Show me the room',
  'What is the question behind the cost estimate about?',
  'Please update the claim about the bridge',
];

UNRELATED_CORPUS.forEach((phrase, i) => {
  check('T3: unrelated corpus [' + i + '] -> door null :: ' + phrase, () => {
    assertDoorIntent(phrase, null);
  });
});

// ---------------------------------------------------------------------------
// T4: self-consistency with QUESTION_TURN_EXAMPLES
// ---------------------------------------------------------------------------

check('T4: QUESTION_TURN_EXAMPLES.change and .ask exist as frozen arrays', () => {
  const examples = frameProvenance.QUESTION_TURN_EXAMPLES;
  assert.ok(examples, 'QUESTION_TURN_EXAMPLES missing');
  assert.ok(Array.isArray(examples.change) && examples.change.length > 0, 'change examples missing');
  assert.ok(Array.isArray(examples.ask) && examples.ask.length > 0, 'ask examples missing');
});

(function selfConsistencyChange() {
  const examples = (frameProvenance.QUESTION_TURN_EXAMPLES && frameProvenance.QUESTION_TURN_EXAMPLES.change) || [];
  examples.forEach((phrase, i) => {
    const filled = phrase.replace('...', 'which camera works with sunglasses?');
    check('T4: change example [' + i + '] resolves to question_set :: ' + filled, () => {
      assertDoorIntent(filled, 'question_set');
    });
  });
})();

(function selfConsistencyAsk() {
  const examples = (frameProvenance.QUESTION_TURN_EXAMPLES && frameProvenance.QUESTION_TURN_EXAMPLES.ask) || [];
  examples.forEach((phrase, i) => {
    const filled = phrase + '?';
    check('T4: ask example [' + i + '] resolves to question_read :: ' + filled, () => {
      assertDoorIntent(filled, 'question_read');
    });
  });
})();

// ---------------------------------------------------------------------------
// T5: robustness
// ---------------------------------------------------------------------------

check('T5: resolveQuestionTurn(null) returns door null without throwing', () => {
  const r = resolve(null);
  assert.equal(r.door, null);
});

check('T5: resolveQuestionTurn(42) returns door null without throwing', () => {
  const r = resolve(42);
  assert.equal(r.door, null);
});

check("T5: resolveQuestionTurn('') returns door null without throwing", () => {
  const r = resolve('');
  assert.equal(r.door, null);
});

check('T5: resolveQuestionTurn(10000-char string) returns door null without throwing', () => {
  const r = resolve('x'.repeat(10000));
  assert.equal(r.door, null);
});

check("T5: curly apostrophes in \"What’s the room’s question?\" still resolve to question_read", () => {
  assertDoorIntent("What’s the room’s question?", 'question_read', 'ask');
});

check('T5: QUESTION_TURN_PATTERNS is frozen (top-level and each named array)', () => {
  const p = frameProvenance.QUESTION_TURN_PATTERNS;
  assert.ok(p, 'QUESTION_TURN_PATTERNS missing');
  assert.equal(Object.isFrozen(p), true, 'QUESTION_TURN_PATTERNS itself not frozen');
  ['history', 'change', 'ask'].forEach((k) => {
    assert.ok(Array.isArray(p[k]), 'QUESTION_TURN_PATTERNS.' + k + ' is not an array');
    assert.equal(Object.isFrozen(p[k]), true, 'QUESTION_TURN_PATTERNS.' + k + ' not frozen');
  });
});

check('T5: QUESTION_TURN_EXAMPLES is frozen (top-level and each named array)', () => {
  const e = frameProvenance.QUESTION_TURN_EXAMPLES;
  assert.ok(e, 'QUESTION_TURN_EXAMPLES missing');
  assert.equal(Object.isFrozen(e), true, 'QUESTION_TURN_EXAMPLES itself not frozen');
  ['change', 'ask'].forEach((k) => {
    assert.ok(Array.isArray(e[k]), 'QUESTION_TURN_EXAMPLES.' + k + ' is not an array');
    assert.equal(Object.isFrozen(e[k]), true, 'QUESTION_TURN_EXAMPLES.' + k + ' not frozen');
  });
});

// ---------------------------------------------------------------------------
// W1-W3: routing text legs (commands/room.md, skills/room/SKILL.md)
// ---------------------------------------------------------------------------

const ROUTING_HEADER = '## When Larry routes a turn to the question door';
const DO_NOT_ROUTE_SENTENCE = "An ordinary question asked in conversation is not the room's governing question; do not route it here.";

let w1Ok = false;
let w2Ok = false;
let w3Ok = false;

check('W1: commands/room.md description line names "governing question", not the bare word "questions"', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');
  const m = src.match(/^description:.*$/m);
  assert.ok(m, 'description line not found');
  assert.match(m[0], /governing question/i);
  assert.equal(/\bquestions\b/i.test(m[0]), false, 'description must not use the bare word "questions": ' + m[0]);
  w1Ok = true;
});

check('W2: commands/room.md has the routing header, every QUESTION_TURN_EXAMPLES phrase verbatim, and the do-not-route sentence', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');
  assert.ok(src.includes(ROUTING_HEADER), 'routing header missing');
  const sectionMatch = src.match(/## When Larry routes a turn to the question door\n[\s\S]*?(?=\n## |$)/);
  assert.ok(sectionMatch, 'routing section body not found');
  const section = sectionMatch[0];
  const examples = frameProvenance.QUESTION_TURN_EXAMPLES;
  assert.ok(examples, 'QUESTION_TURN_EXAMPLES missing, cannot verify verbatim quoting');
  const allPhrases = [].concat(examples.change || [], examples.ask || []);
  assert.ok(allPhrases.length > 0, 'no example phrases to check');
  allPhrases.forEach((phrase) => {
    assert.ok(section.includes(phrase), 'routing section missing verbatim phrase: ' + phrase);
  });
  assert.ok(section.includes(DO_NOT_ROUTE_SENTENCE), 'routing section missing the do-not-route sentence');
  w2Ok = true;
});

check('W3: skills/room/SKILL.md mirrors the same routing header and do-not-route sentence', () => {
  const src = fs.readFileSync(SKILL_MD_PATH, 'utf8');
  assert.ok(src.includes(ROUTING_HEADER), 'routing header missing from skill mirror');
  assert.ok(src.includes(DO_NOT_ROUTE_SENTENCE), 'do-not-route sentence missing from skill mirror');
  w3Ok = true;
});

const routingTextChecked = [w1Ok, w2Ok, w3Ok].filter(Boolean).length;
process.stdout.write('routing text: ' + routingTextChecked + ' of 3 checked\n');

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
