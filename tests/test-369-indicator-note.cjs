'use strict';
/*
 * Plan 369-10 (CANON369-03): pins the format of the signed session-indicator
 * design note (D-04 co-design gate).
 *
 * Checks:
 *   1. The note exists.
 *   2. It has a "Signed: navigator via AskUserQuestion, <ISO date>" line.
 *   3. It names INV-SL-1 through INV-SL-5.
 *   4. Every state word it specifies appears inside quotes.
 *   5. No emoji code points (U+1F300-U+1FAFF, U+2600-U+27BF).
 *   6. No em-dash (U+2014) or en-dash (U+2013).
 *   7. The brief exists and names four recommended answers.
 */

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.resolve(
  __dirname, '..', '.planning', 'phases',
  '369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-'
);
const NOTE = path.join(DIR, '369-SESSION-INDICATOR-DESIGN.md');
const BRIEF = path.join(DIR, '369-SESSION-INDICATOR-BRIEF.md');

const STATE_WORDS = [
  'Connected',
  'Reconnecting...',
  'Disconnected',
  'Catching up, change {n}',
  'Rebuilding the browser copy',
  'Browser copy: up to change {n}',
  'Your answer is not confirmed yet. Check now',
  'Reconnect now',
];

test('the note exists', () => {
  assert.ok(fs.existsSync(NOTE), 'missing ' + NOTE);
});

const text = fs.existsSync(NOTE) ? fs.readFileSync(NOTE, 'utf8') : '';

test('the note has a Signed line with an ISO date', () => {
  const m = text.match(/^Signed: navigator via AskUserQuestion, (\d{4}-\d{2}-\d{2}), reply: ".+"$/m);
  assert.ok(m, 'no valid Signed line');
  assert.ok(!Number.isNaN(Date.parse(m[1])), 'Signed date is not a real date');
});

test('the note names INV-SL-1 through INV-SL-5', () => {
  for (let i = 1; i <= 5; i++) {
    assert.ok(text.includes('INV-SL-' + i), 'missing INV-SL-' + i);
  }
});

test('every specified state word appears inside quotes', () => {
  for (const w of STATE_WORDS) {
    assert.ok(text.includes('"' + w + '"') || text.includes('"' + w + '" '),
      'state word not quoted: ' + w);
  }
});

test('the note has no emoji code points', () => {
  const bad = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if ((cp >= 0x1F300 && cp <= 0x1FAFF) || (cp >= 0x2600 && cp <= 0x27BF)) {
      bad.push('U+' + cp.toString(16).toUpperCase());
    }
  }
  assert.deepStrictEqual(bad, []);
});

test('the note has no em-dash or en-dash', () => {
  assert.ok(!text.includes('—'), 'em-dash found');
  assert.ok(!text.includes('–'), 'en-dash found');
});

test('the brief exists with four recommended answers', () => {
  assert.ok(fs.existsSync(BRIEF), 'missing brief');
  const brief = fs.readFileSync(BRIEF, 'utf8');
  assert.ok((brief.match(/\(Recommended\)/g) || []).length >= 4);
});
