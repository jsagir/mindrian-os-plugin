#!/usr/bin/env node
/**
 * Unit tests for lib/vault/wikilink-builder.cjs
 *
 * Zero-dependency test runner using Node's built-in `assert`.
 * Run: node lib/vault/wikilink-builder.test.cjs
 */

'use strict';

const assert = require('assert');
const wb = require('./wikilink-builder.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`  ok  ${name}\n`);
  } catch (err) {
    failed += 1;
    process.stdout.write(`  FAIL ${name}\n    ${err.message}\n`);
  }
}

const profiles = [
  {
    name: 'avital-leibovich',
    displayName: 'Avital Leibovich',
    path: '/room/team/advisors/avital-leibovich/PROFILE.md',
    category: 'advisors',
  },
  {
    name: 'avital-only',
    displayName: 'Avital',
    path: '/room/team/advisors/avital-only/PROFILE.md',
    category: 'advisors',
  },
  {
    name: 'lawrence-aronhime',
    displayName: 'Lawrence Aronhime',
    path: '/room/team/mentors/lawrence-aronhime/PROFILE.md',
    category: 'mentors',
  },
];

// Test 1: first occurrence only
test('buildTeamLinks replaces first occurrence only', () => {
  const input = 'Lawrence Aronhime said X. Later Lawrence Aronhime said Y.';
  const out = wb.buildTeamLinks(input, profiles, {});
  const link = '[[team/mentors/lawrence-aronhime/PROFILE.md|Lawrence Aronhime]]';
  assert.ok(out.includes(link), 'expected link inserted');
  // Only one link
  const count = out.split(link).length - 1;
  assert.strictEqual(count, 1, `expected exactly 1 link, got ${count}`);
  // Second occurrence is untouched plain text
  assert.ok(out.endsWith('Later Lawrence Aronhime said Y.'), 'second occurrence preserved');
});

// Test 2: longest-name preference
test('buildTeamLinks prefers longer name over prefix (Avital Leibovich > Avital)', () => {
  const input = 'Meeting with Avital Leibovich today.';
  const out = wb.buildTeamLinks(input, profiles, {});
  assert.ok(
    out.includes('[[team/advisors/avital-leibovich/PROFILE.md|Avital Leibovich]]'),
    'longer name should win'
  );
  assert.ok(
    !out.includes('[[team/advisors/avital-only/PROFILE.md|Avital]]'),
    'shorter prefix should not link'
  );
});

// Test 3: self-link skipped
test('buildTeamLinks skips self-link when ownProfilePath matches', () => {
  const input = '# Lawrence Aronhime\n\nLawrence Aronhime is a mentor.';
  const out = wb.buildTeamLinks(input, profiles, {
    ownProfilePath: '/room/team/mentors/lawrence-aronhime/PROFILE.md',
  });
  assert.strictEqual(out, input, 'content should be unchanged when processing own profile');
});

// Test 4: frontmatter skipped
test('buildTeamLinks skips frontmatter region', () => {
  const input =
    '---\nauthor: Lawrence Aronhime\n---\nBody text by Lawrence Aronhime here.';
  const out = wb.buildTeamLinks(input, profiles, {});
  // Frontmatter author line unchanged
  assert.ok(out.includes('author: Lawrence Aronhime'), 'frontmatter untouched');
  // Body got linked
  assert.ok(
    out.includes('Body text by [[team/mentors/lawrence-aronhime/PROFILE.md|Lawrence Aronhime]] here.'),
    'body should be linked'
  );
});

// Test 5: idempotence
test('buildTeamLinks is idempotent (running twice = same output)', () => {
  const input = 'Lawrence Aronhime opened the meeting.';
  const once = wb.buildTeamLinks(input, profiles, {});
  const twice = wb.buildTeamLinks(once, profiles, {});
  assert.strictEqual(once, twice, 'second pass should not change output');
});

// Test 6: buildSectionLink
test('buildSectionLink returns exact format and honors display override', () => {
  assert.strictEqual(
    wb.buildSectionLink('business-model'),
    '[[business-model/ROOM.md|business-model]]'
  );
  assert.strictEqual(
    wb.buildSectionLink('business-model', { display: 'Business Model' }),
    '[[business-model/ROOM.md|Business Model]]'
  );
});

// Test 7: buildMeetingLink
test('buildMeetingLink strips date prefix and title-cases', () => {
  const out = wb.buildMeetingLink('2026-04-09-align-strategy-session');
  assert.strictEqual(
    out,
    '[[meetings/2026-04-09-align-strategy-session/summary.md|Align Strategy Session]]'
  );
});

// Test 8: buildFiledToFooter
test('buildFiledToFooter returns both lines / one line appropriately', () => {
  const both = wb.buildFiledToFooter({
    targetPath: 'market-analysis/2026-04-09-tam.md',
    meetingSlug: '2026-04-09-align-strategy-session',
  });
  assert.ok(both.includes('-> Full artifact: [[market-analysis/2026-04-09-tam.md]]'));
  assert.ok(
    both.includes('<- Source meeting: [[meetings/2026-04-09-align-strategy-session/summary.md|Align Strategy Session]]')
  );
  assert.strictEqual(both.split('\n').length, 2, 'should be 2 lines');

  const one = wb.buildFiledToFooter({
    targetPath: null,
    meetingSlug: '2026-04-09-align-strategy-session',
  });
  assert.strictEqual(one.split('\n').length, 1, 'should be 1 line');
  assert.ok(one.startsWith('<- Source meeting:'));
});

// Test 9: injectFiledToFooter idempotent + placement
test('injectFiledToFooter inserts after frontmatter and is idempotent', () => {
  const input = '---\nmeeting_id: 2026-04-09-align-strategy-session\n---\nBody.';
  const once = wb.injectFiledToFooter(input, {
    targetPath: 'market-analysis/2026-04-09-tam.md',
    meetingSlug: '2026-04-09-align-strategy-session',
  });
  assert.ok(once.includes('-> Full artifact: [[market-analysis/2026-04-09-tam.md]]'));
  assert.ok(once.includes('<- Source meeting: [[meetings/2026-04-09-align-strategy-session/summary.md|Align Strategy Session]]'));
  // Lines sit after frontmatter close
  const fmIdx = once.indexOf('\n---');
  const arrowIdx = once.indexOf('-> Full artifact');
  assert.ok(arrowIdx > fmIdx, 'footer should be after frontmatter close');

  const twice = wb.injectFiledToFooter(once, {
    targetPath: 'market-analysis/2026-04-09-tam.md',
    meetingSlug: '2026-04-09-align-strategy-session',
  });
  assert.strictEqual(once, twice, 'second injection should be a no-op');
});

// Test 10: graceful zero-profile behavior
test('buildTeamLinks with zero team profiles returns content unchanged', () => {
  const input = 'Some body text mentioning Lawrence Aronhime.';
  assert.strictEqual(wb.buildTeamLinks(input, [], {}), input);
  assert.strictEqual(wb.buildTeamLinks(input, null, {}), input);
});

// ---------- Summary ----------
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
process.stdout.write('PASS\n');
process.exit(0);
