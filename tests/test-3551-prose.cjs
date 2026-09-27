#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 12 Task 1 (RED) -- test-3551-prose: AC8 and the prose
 * half of AMB-06 / AMB-07. Pins the fallback wording (auto-explore is
 * documented as the fallback, never the way in) and the same-words-
 * everywhere rule (Larry's ambient-findings SKILL rule, four recorded
 * prose fixtures, and the composer's framed card all say the same thing).
 *
 * Frontmatter parsing: this repo's own precedent
 * (tests/test-355-tri-polar.cjs) strips the frontmatter block and never
 * parses it -- the stamp there is built directly in JS. That precedent
 * does not cover this plan's need (frontmatter carries surface/signal/
 * framing/stamp, and the test must read them back to build the SAME
 * stamp the body claims to render), so this file ships its own minimal
 * indentation-based YAML-subset parser (parseFrontmatterYaml below),
 * scoped to exactly the shape tests/fixtures/355/prose/*.md already uses
 * (scalar/null/quoted-empty-string values, one level of nested object,
 * inline JSON-style arrays). Documented here as the read_first
 * substitution this plan's own instruction anticipated ("parse
 * frontmatter with the same local helper 355-23's tri-polar test uses");
 * no such helper exists to reuse, so one is written fresh, scoped
 * narrowly, and recorded as a deviation in this plan's SUMMARY.
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). Uses hygiene's own
 * makeChecker (PASS/FAIL accumulator, never throws mid-run) so every leg
 * reports rather than aborting on the first missing fixture -- the RED
 * run needs to show every gap at once.
 *
 * House rule: hyphens only, no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-3551-prose');
const { check } = checker;

const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const dialLabelComposer = require(path.join(REPO, 'lib', 'hmi', 'dial-label-composer.cjs'));

const FRAMING_IDS = directionConvention.FRAMING_IDS;
const FRAMING_PHRASES = directionConvention.FRAMING_PHRASES;

const PROSE_DIR = path.join(REPO, 'tests', 'fixtures', '3551', 'prose');
const SKILL_PATH = path.join(REPO, 'skills', 'larry-personality', 'SKILL.md');
const AUTO_EXPLORE_PATH = path.join(REPO, 'commands', 'auto-explore.md');

const PRODUCER_COMMAND_PATHS = [
  path.join(REPO, 'commands', 'eureka.md'),
  path.join(REPO, 'commands', 'auto-explore.md'),
  path.join(REPO, 'commands', 'scout.md'),
  path.join(REPO, 'commands', 'find-connections.md'),
  path.join(REPO, 'commands', 'find-bottlenecks.md'),
  path.join(REPO, 'commands', 'whitespace.md'),
];

// ---------------------------------------------------------------------------
// readFileSafe -- null on any read failure (a missing fixture during RED is
// a FAIL check, never an uncaught exception that aborts the rest of the run).
// ---------------------------------------------------------------------------
function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// parseFrontmatterYaml(text) -> plain object. A minimal indentation-based
// YAML-subset parser scoped to this repo's own fixture shape: scalar values,
// `null`, single-quoted-empty-string (`''`), one level of nested mapping
// (e.g. `stamp:` then indented `verification:`, `path:` then a further
// indented `nodes:`/`edges:`), and inline JSON-style arrays
// (`["a", "b"]`) -- exactly the desktop-verified.md precedent's own style.
// Never a general YAML parser; two or more levels of unindented list items,
// multi-line scalars and anchors/aliases are all out of scope by design.
// ---------------------------------------------------------------------------
function parseFrontmatterYaml(yamlText) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const rawLine of yamlText.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const indentMatch = rawLine.match(/^ */);
    const indent = indentMatch ? indentMatch[0].length : 0;
    const line = rawLine.trim();
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueRaw = line.slice(colonIdx + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    if (valueRaw === '') {
      const child = {};
      parent[key] = child;
      stack.push({ indent: indent, obj: child });
    } else if (valueRaw === 'null') {
      parent[key] = null;
    } else if (valueRaw.charAt(0) === '[') {
      try {
        parent[key] = JSON.parse(valueRaw);
      } catch (_e) {
        parent[key] = [];
      }
    } else if (
      (valueRaw.charAt(0) === '"' && valueRaw.charAt(valueRaw.length - 1) === '"') ||
      (valueRaw.charAt(0) === "'" && valueRaw.charAt(valueRaw.length - 1) === "'")
    ) {
      parent[key] = valueRaw.slice(1, -1);
    } else {
      parent[key] = valueRaw;
    }
  }
  return root;
}

// parseFixture(raw) -> { data, body } or null on a malformed/missing block.
function parseFixture(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  return { data: parseFrontmatterYaml(m[1]), body: m[2] };
}

// ---------------------------------------------------------------------------
// Render guards -- shared across every fixture body and the negative control.
// ---------------------------------------------------------------------------
const DECIMAL_TOKEN_RE = /(?<![0-9A-Za-z.])(0?\.[0-9]+|1\.0+)(?![0-9.])/;
const PERCENT_TOKEN_RE = /[0-9]+%/;
const COUNT_NEXT_TO_FINDING_RE = /\b[0-9]+\s+(findings?|connections?|opportunities?)\b/i;
const PRAISE_TOKEN_RE = /\b(great|amazing|excellent|brilliant)\b/i;
const EM_DASH_CHAR = String.fromCharCode(0x2014);

function renderGuardViolations(text) {
  const violations = [];
  if (DECIMAL_TOKEN_RE.test(text)) violations.push('decimal');
  if (PERCENT_TOKEN_RE.test(text)) violations.push('percent');
  if (COUNT_NEXT_TO_FINDING_RE.test(text)) violations.push('count_next_to_finding_word');
  if (PRAISE_TOKEN_RE.test(text)) violations.push('praise_token');
  if (text.indexOf(EM_DASH_CHAR) !== -1) violations.push('em_dash');
  return violations;
}

const DE_STIJL_GLYPHS = ['🟦', '🟥', '🟨', '⬛', '⬜']; // blue, red, yellow, black, white squares

console.log('test-3551-prose:');

// =============================================================================
// SECTION A -- the SKILL subsection (Larry's ambient-findings rule).
// =============================================================================

const skillRaw = readFileSafe(SKILL_PATH) || '';
const skillSubsectionMatches = skillRaw.match(/### Ambient findings \(Phase 355\.1\)/g) || [];
check('SKILL.md contains "### Ambient findings (Phase 355.1)" exactly once', skillSubsectionMatches.length === 1,
  'found ' + skillSubsectionMatches.length + ' occurrences');

const crossConnectionIdx = skillRaw.indexOf('## Cross-connection stamps (Phase 355)');
const ambientIdx = skillRaw.indexOf('### Ambient findings (Phase 355.1)');
const nextH2Idx = crossConnectionIdx === -1 ? -1 : skillRaw.indexOf('\n## ', crossConnectionIdx + 1);
check('the subsection is placed inside the Cross-connection stamps (Phase 355) section',
  crossConnectionIdx !== -1 && ambientIdx !== -1 && ambientIdx > crossConnectionIdx &&
  (nextH2Idx === -1 || ambientIdx < nextH2Idx));

// The subsection body: from ambientIdx to the next '## ' or '### ' heading of
// equal-or-higher level, or end of file.
let ambientSectionText = '';
if (ambientIdx !== -1) {
  const rest = skillRaw.slice(ambientIdx + '### Ambient findings (Phase 355.1)'.length);
  const nextHeadingMatch = rest.match(/\n(## |### )/);
  ambientSectionText = nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;
}

for (const framingId of FRAMING_IDS) {
  const phrase = FRAMING_PHRASES[framingId];
  check('SKILL ambient-findings subsection quotes FRAMING_PHRASES.' + framingId + ' verbatim',
    ambientSectionText.indexOf(phrase) !== -1, 'expected to find: ' + phrase);
}

const autoExploreLinesInSkill = ambientSectionText.split(/\r?\n/).filter((l) => l.indexOf('/mos:auto-explore') !== -1);
check('SKILL ambient-findings subsection names /mos:auto-explore at least once', autoExploreLinesInSkill.length > 0);
check('every SKILL line naming /mos:auto-explore also contains "fallback"',
  autoExploreLinesInSkill.length > 0 && autoExploreLinesInSkill.every((l) => l.indexOf('fallback') !== -1));

check('SKILL ambient-findings subsection carries no digit next to a finding/connection/opportunity word',
  !COUNT_NEXT_TO_FINDING_RE.test(ambientSectionText));
check('SKILL ambient-findings subsection carries no praise token (great/amazing/excellent/brilliant)',
  !PRAISE_TOKEN_RE.test(ambientSectionText));
check('SKILL ambient-findings subsection carries no em-dash (U+2014)',
  ambientSectionText.indexOf(EM_DASH_CHAR) === -1);

// =============================================================================
// SECTION B -- the four prose fixtures.
// =============================================================================

const FIXTURE_FILES = [
  'desktop-find-the-problem.md',
  'desktop-pursue-or-drop.md',
  'cowork-neutral.md',
  'desktop-room-delta-fallback.md',
];

let fixtureDirEntries = [];
try {
  fixtureDirEntries = fs.readdirSync(PROSE_DIR).filter((n) => n.endsWith('.md'));
} catch (_e) {
  fixtureDirEntries = [];
}
check('exactly four fixture files exist under tests/fixtures/3551/prose/',
  fixtureDirEntries.length === 4, 'found ' + fixtureDirEntries.length + ': ' + fixtureDirEntries.join(', '));

const parsedFixtures = {};
for (const fileName of FIXTURE_FILES) {
  const raw = readFileSafe(path.join(PROSE_DIR, fileName));
  const parsed = raw ? parseFixture(raw) : null;
  parsedFixtures[fileName] = parsed;
  check('fixture ' + fileName + ' exists and parses (frontmatter + body)', !!parsed, 'file missing or malformed');
}

function expectFrontmatterShape(fileName, expectedSurface, expectedSignal) {
  const parsed = parsedFixtures[fileName];
  if (!parsed) return;
  const data = parsed.data;
  check(fileName + ': frontmatter surface === "' + expectedSurface + '"', data.surface === expectedSurface, 'got ' + JSON.stringify(data.surface));
  check(fileName + ': frontmatter signal === "' + expectedSignal + '"', data.signal === expectedSignal, 'got ' + JSON.stringify(data.signal));
  check(fileName + ': frontmatter carries a framing key', Object.prototype.hasOwnProperty.call(data, 'framing'));
  check(fileName + ': frontmatter carries a stamp key', Object.prototype.hasOwnProperty.call(data, 'stamp'));
}

expectFrontmatterShape('desktop-find-the-problem.md', 'desktop', 'eureka_bridge');
expectFrontmatterShape('desktop-pursue-or-drop.md', 'desktop', 'eureka_bridge');
expectFrontmatterShape('cowork-neutral.md', 'cowork', 'eureka_bridge');
expectFrontmatterShape('desktop-room-delta-fallback.md', 'desktop', 'room_delta');

// Every fixture body opens with one De Stijl glyph.
for (const fileName of FIXTURE_FILES) {
  const parsed = parsedFixtures[fileName];
  if (!parsed) continue;
  const trimmedBody = parsed.body.replace(/^\s+/, '');
  const opensWithGlyph = DE_STIJL_GLYPHS.some((g) => trimmedBody.indexOf(g) === 0);
  check(fileName + ': body opens with one De Stijl glyph from the Larry SKILL list', opensWithGlyph);
}

// Render guards, every fixture.
for (const fileName of FIXTURE_FILES) {
  const parsed = parsedFixtures[fileName];
  if (!parsed) continue;
  const violations = renderGuardViolations(parsed.body);
  check(fileName + ': body carries zero render-guard violations', violations.length === 0, 'violations: ' + violations.join(', '));
}

// Negative control: a planted '0.91' must be CAUGHT (proves the guard is not vacuous).
(function negativeControlLeg() {
  const anyParsed = parsedFixtures['desktop-find-the-problem.md'];
  const sampleBody = (anyParsed && anyParsed.body) || 'Checked: strong. The methodology graph links them in one step.';
  const plantedBody = sampleBody + '\n\n(planted negative control: 0.91)';
  const violations = renderGuardViolations(plantedBody);
  check('negative control: a planted 0.91 decimal is caught by the render guard', violations.indexOf('decimal') !== -1,
    'violations: ' + violations.join(', '));
})();

// =============================================================================
// SECTION C -- tri-polar: the eureka_bridge fixtures carry the same words as
// formatStampLines(stamp, 'desktop') and composeLabel('deep_research', ...).
// =============================================================================

function checkTriPolar(fileName, framingId) {
  const parsed = parsedFixtures[fileName];
  if (!parsed) return;
  const stamp = parsed.data.stamp;
  if (!stamp || typeof stamp !== 'object') {
    check(fileName + ': tri-polar leg skipped, no stamp object to compare (fixture missing/malformed)', false);
    return;
  }

  const framingPhrase = FRAMING_PHRASES[framingId];
  check(fileName + ': body contains FRAMING_PHRASES.' + framingId + ' verbatim',
    parsed.body.indexOf(framingPhrase) !== -1);

  let desktopLines;
  try {
    desktopLines = verificationStampFormat.formatStampLines(stamp, 'desktop');
  } catch (e) {
    check(fileName + ': formatStampLines(stamp, "desktop") must not throw', false, String(e && e.message));
    return;
  }
  for (const line of desktopLines) {
    check(fileName + ': body contains a formatStampLines(stamp, "desktop") sentence verbatim ("' + line.slice(0, 24) + '...")',
      parsed.body.indexOf(line) !== -1);
  }

  // composeLabel('deep_research', ...) for the SAME stamp -- same framing
  // phrase, same formatted path text.
  const pathText = (stamp.verification === 'strong' || stamp.verification === 'indirect')
    ? verificationStampFormat.formatPathText(stamp.path.nodes, stamp.path.edges)
    : '';
  const slotContext = {
    signal: 'eureka_bridge',
    stamp_verification: stamp.verification,
    stamp_path: pathText,
    framing: framingId,
  };
  let composed;
  try {
    composed = dialLabelComposer.composeLabel('deep_research', slotContext);
  } catch (e) {
    check(fileName + ': composeLabel("deep_research", ...) must not throw', false, String(e && e.message));
    return;
  }
  check(fileName + ': composeLabel output contains the same framing phrase', composed.label.indexOf(framingPhrase) !== -1);
  if (pathText) {
    check(fileName + ': composeLabel output contains the same formatted path text', composed.label.indexOf(pathText) !== -1);
  }
}

checkTriPolar('desktop-find-the-problem.md', 'find_the_problem');
checkTriPolar('desktop-pursue-or-drop.md', 'pursue_or_drop');
checkTriPolar('cowork-neutral.md', 'neutral');

// The room_delta fallback fixture: no framing/stamp, names /mos:auto-explore
// on a line that also contains 'fallback', and says the run could not start.
(function checkFallbackFixture() {
  const fileName = 'desktop-room-delta-fallback.md';
  const parsed = parsedFixtures[fileName];
  if (!parsed) return;
  const lines = parsed.body.split(/\r?\n/);
  const fallbackLine = lines.find((l) => l.indexOf('/mos:auto-explore') !== -1);
  check(fileName + ': names /mos:auto-explore on a line', !!fallbackLine);
  check(fileName + ': that line also contains "fallback"', !!fallbackLine && fallbackLine.indexOf('fallback') !== -1);
  check(fileName + ': body says the run could not start on this surface',
    /could not start on this surface/i.test(parsed.body));
})();

// =============================================================================
// SECTION D -- AC8: commands/auto-explore.md is the fallback, never the way in.
// =============================================================================

const autoExploreRaw = readFileSafe(AUTO_EXPLORE_PATH) || '';
const autoExploreFrontmatterMatch = autoExploreRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
const autoExploreData = autoExploreFrontmatterMatch ? parseFrontmatterYaml(autoExploreFrontmatterMatch[1]) : {};
const autoExploreBody = autoExploreFrontmatterMatch ? autoExploreFrontmatterMatch[2] : autoExploreRaw;

check('auto-explore.md frontmatter description contains "fallback"',
  typeof autoExploreData.description === 'string' && autoExploreData.description.indexOf('fallback') !== -1);
check('auto-explore.md body contains "fallback"', autoExploreBody.indexOf('fallback') !== -1);

const sensorTriggers = (autoExploreData.connector && autoExploreData.connector.sensor_triggers) || [];
check('auto-explore.md connector.sensor_triggers lists SENS-01', sensorTriggers.indexOf('SENS-01') !== -1,
  'got ' + JSON.stringify(sensorTriggers));
check('auto-explore.md connector.sensor_triggers lists SENS-21', sensorTriggers.indexOf('SENS-21') !== -1,
  'got ' + JSON.stringify(sensorTriggers));

check('grep -c \'hitl_shape: "F.3"\' commands/auto-explore.md prints 1',
  (autoExploreRaw.match(/hitl_shape: "F\.3"/g) || []).length === 1);

// No line in any of the six command files or the new SKILL subsection
// contains both a /mos: command and the word "breakthrough".
function linesWithCommandAndBreakthrough(text) {
  return text.split(/\r?\n/).filter((l) => /\/mos:/.test(l) && /breakthrough/i.test(l));
}
for (const p of PRODUCER_COMMAND_PATHS) {
  const raw = readFileSafe(p) || '';
  const hits = linesWithCommandAndBreakthrough(raw);
  check(path.basename(p) + ': no line contains both a /mos: command and "breakthrough"', hits.length === 0,
    'hits: ' + JSON.stringify(hits));
}
(function skillBreakthroughLeg() {
  const hits = linesWithCommandAndBreakthrough(ambientSectionText);
  check('SKILL ambient-findings subsection: no line contains both a /mos: command and "breakthrough"', hits.length === 0,
    'hits: ' + JSON.stringify(hits));
})();

console.log('');
const exitCode = checker.summary();

assert_attempts_zero();
function assert_attempts_zero() {
  if (netGuard.attempts() !== 0) {
    console.log('FAIL: installNetGuard must record zero fetch attempts (Pitfall 16)');
    process.exitCode = 1;
  }
  netGuard.restore();
}

process.exitCode = process.exitCode || exitCode;
