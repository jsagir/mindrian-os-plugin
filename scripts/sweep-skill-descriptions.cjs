'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 227 Plan 02 (Req 2) -- systemic sweep classifier over every
 * skills/*\/SKILL.md, looking for the same loose-description auto-fire
 * bypass pattern that let trending-to-absurd reach past ignite's F.1
 * front door before its 2026-06-24 fix (FIX 1 conversational restraint
 * doctrine, FIX 2 trigger tightening, commit 7868dfbb).
 *
 * This script only CLASSIFIES two things per skill: the literal
 * sensor_triggers value and a description-tightness verdict (tight /
 * loose). It does not decide clean-vs-broken and it does not fix
 * anything -- per D-06, a "loose" classification alone is a candidate
 * for a human look, not an automatic verdict (many loose-reading
 * descriptions belong to passive reference/utility skills that were
 * never meant to gate an auto-reach). Task 2 of this plan reads the raw
 * JSON this script writes and turns it into the final
 * 227-SWEEP-FINDINGS.md report (clean / fixed-trivial / deferred-real-work).
 *
 * Standalone, zero new dependencies: skills/ is a flat one-level
 * directory, so fs.readdirSync is sufficient -- no glob package needed
 * and none is installed in this repo.
 *
 * Never-throw-on-a-single-bad-file contract: a SKILL.md that fails to
 * parse a frontmatter block is recorded with a parse_error field and a
 * conservative "loose" tightness (never silently dropped from the
 * report -- see D-06/D-07's "zero skills silently skipped" invariant).
 */

const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const RAW_OUTPUT_PATH = path.join(
  __dirname,
  '..',
  '.planning',
  'phases',
  '227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in',
  '227-sweep-raw.json'
);

// D-06's second clause: an explicit-intent gating marker in the description
// text. Case-insensitive substring match. This exact term list is the
// planner's suggested starting set (227-CONTEXT.md leaves the precise
// regex to the executor's discretion, as long as it demonstrably catches
// the trending-to-absurd pre-fix shape and does not false-positive on the
// confirmed post-fix shape).
const TIGHT_MARKERS = [
  'only when',
  'explicitly',
  'on request',
  'do not use for',
  'never use for',
];

// Extract the raw text between the first two "---" delimiter lines.
// Returns an array of lines (frontmatter body only, delimiters excluded),
// or null if the file does not open with a "---" frontmatter block.
function extractFrontmatter(text) {
  const lines = text.split('\n');
  if (!lines[0] || lines[0].trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  return lines.slice(1, end);
}

// The literal sensor_triggers array text (e.g. "[]" or "[SENS-05]"), or
// null if the key is entirely absent from the frontmatter (36 of the 124
// skills at planning time never declare the key at all -- record that
// truthfully rather than assuming "[]").
function extractSensorTriggers(frontmatterLines) {
  const text = frontmatterLines.join('\n');
  const match = text.match(/sensor_triggers:\s*(\[[^\]]*\])/);
  if (!match) return null;
  return match[1].trim();
}

// Description extraction mirrors two shapes seen live across skills/*/SKILL.md:
//   1. A single-line scalar: `description: Some text` or `description: "Some text"`.
//   2. A folded block scalar: `description: >` (or `>-`, `|`, `|-`) followed
//      by one or more indented continuation lines, ending at the next
//      column-0 (top-level) key.
function extractDescription(frontmatterLines) {
  let startIdx = -1;
  let inline = '';
  for (let i = 0; i < frontmatterLines.length; i++) {
    const m = frontmatterLines[i].match(/^description:\s*(.*)$/);
    if (m) {
      startIdx = i;
      inline = m[1].trim();
      break;
    }
  }
  if (startIdx === -1) return '';

  const isFoldIndicator = inline === '' || /^[>|][-+]?$/.test(inline);
  if (isFoldIndicator) {
    const parts = [];
    for (let i = startIdx + 1; i < frontmatterLines.length; i++) {
      const line = frontmatterLines[i];
      if (line.length === 0) continue;
      if (/^\S/.test(line)) break; // next top-level key, folded block ends
      parts.push(line.trim());
    }
    return parts.join(' ').trim();
  }

  return inline.replace(/^["']|["']$/g, '').trim();
}

function classifyTightness(description) {
  const lower = description.toLowerCase();
  const hitMarker = TIGHT_MARKERS.find(function (marker) {
    return lower.indexOf(marker) !== -1;
  });
  return hitMarker ? 'tight' : 'loose';
}

function classifySkill(skillName, skillMdPath) {
  const text = fs.readFileSync(skillMdPath, 'utf8');
  const fm = extractFrontmatter(text);
  if (!fm) {
    return {
      skill: skillName,
      sensor_triggers: '(unparseable)',
      description: '',
      tightness: 'loose',
      parse_error: 'no frontmatter block found (file does not open with ---)',
    };
  }
  const sensorTriggersRaw = extractSensorTriggers(fm);
  const description = extractDescription(fm);
  const tightness = classifyTightness(description);
  return {
    skill: skillName,
    sensor_triggers: sensorTriggersRaw === null ? '(absent)' : sensorTriggersRaw,
    description: description,
    tightness: tightness,
  };
}

// Self-test (D-06 calibration requirement): trending-to-absurd's live,
// post-fix SKILL.md must classify as "tight" -- its description contains
// "EXPLICITLY asks" and "Do NOT use for". If this ever fails, the
// heuristic has drifted and must not be trusted against the other 123
// files without being fixed first.
function runSelfTest() {
  const refPath = path.join(SKILLS_DIR, 'trending-to-absurd', 'SKILL.md');
  const result = classifySkill('trending-to-absurd', refPath);
  if (result.tightness !== 'tight') {
    throw new Error(
      'Self-test FAILED: trending-to-absurd (the confirmed post-fix ' +
        'reference shape) classified as "' +
        result.tightness +
        '", expected "tight". The heuristic is miscalibrated -- fix it ' +
        'before trusting it against the other skills.'
    );
  }
  console.log('Self-test OK: trending-to-absurd classifies as tight (calibration reference).');
}

function main() {
  runSelfTest();

  const skillDirs = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(function (entry) {
      return entry.isDirectory();
    })
    .map(function (entry) {
      return entry.name;
    })
    .sort();

  const results = [];
  const skippedNoFile = [];
  for (const name of skillDirs) {
    const mdPath = path.join(SKILLS_DIR, name, 'SKILL.md');
    if (!fs.existsSync(mdPath)) {
      skippedNoFile.push(name);
      continue;
    }
    results.push(classifySkill(name, mdPath));
  }

  console.log(
    'Scanned ' +
      results.length +
      ' skills/*/SKILL.md files (planning-time sanity expectation: 123; ' +
      'a live count that differs is expected, not an error -- the skill ' +
      'set can change between planning and execution).'
  );
  if (skippedNoFile.length > 0) {
    console.log(
      'Skill directories with no SKILL.md (not scanned, not a defect): ' +
        skippedNoFile.join(', ')
    );
  }

  const summary = {
    total: results.length,
    tight: results.filter(function (r) {
      return r.tightness === 'tight';
    }).length,
    loose: results.filter(function (r) {
      return r.tightness === 'loose';
    }).length,
    non_empty_sensor_triggers: results.filter(function (r) {
      return r.sensor_triggers !== '[]' && r.sensor_triggers !== '(absent)' && r.sensor_triggers !== '(unparseable)';
    }).length,
  };
  console.log(
    'tight=' +
      summary.tight +
      ' loose=' +
      summary.loose +
      ' non-empty-sensor-triggers=' +
      summary.non_empty_sensor_triggers
  );

  const outDir = path.dirname(RAW_OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    RAW_OUTPUT_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        summary: summary,
        results: results,
      },
      null,
      2
    )
  );
  console.log('Raw classification written to ' + RAW_OUTPUT_PATH);
}

if (require.main === module) {
  try {
    main();
    process.exit(0);
  } catch (err) {
    console.error(String(err && err.stack ? err.stack : err));
    process.exit(1);
  }
}

module.exports = {
  extractFrontmatter: extractFrontmatter,
  extractSensorTriggers: extractSensorTriggers,
  extractDescription: extractDescription,
  classifyTightness: classifyTightness,
  classifySkill: classifySkill,
  TIGHT_MARKERS: TIGHT_MARKERS,
};
