#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-06 Plan 06 -- check-reward-before-investment CLI.
 *
 * Wraps lib/core/mva-rule-linter.cjs. Spawns the linter against commands/
 * (or argv[2]), prints a table of compliant / missing / invalid counts +
 * a Larry-voice summary line, exits 1 on any missing or invalid.
 *
 * Used by:
 *   - hooks/pre-commit (gates commands/*.md staged changes)
 *   - CI (the Feynman test runner)
 *   - manual invocation by contributors
 *
 * Per Canon Part 8: zero network, zero Brain calls, zero user-content egress.
 *
 * Exit codes:
 *   0  -- every command compliant (or directory empty); the rule holds.
 *   1  -- one or more commands missing/invalid; commit is blocked.
 *   2  -- the commands directory could not be read at all.
 */
'use strict';

const path = require('node:path');
const { scanCommands } = require('../lib/core/mva-rule-linter.cjs');

function main() {
  const target = process.argv[2] || path.join(__dirname, '..', 'commands');
  const abs = path.resolve(target);

  const result = scanCommands(abs);

  const cn = result.compliant.length;
  const mn = result.missing.length;
  const inn = result.invalid.length;

  process.stdout.write('mva-rule-linter: scanning ' + abs + '\n');
  process.stdout.write('  compliant: ' + cn + '\n');
  process.stdout.write('  missing:   ' + mn + '\n');
  process.stdout.write('  invalid:   ' + inn + '\n');

  // Catastrophic case: commands dir unreadable
  if (mn === 1 && result.missing[0].reason === 'commands_dir_read_error') {
    process.stderr.write('commands directory unreadable: ' + abs + '\n');
    process.exit(2);
  }

  if (mn > 0) {
    process.stderr.write('\nMISSING interactive_first_reward field:\n');
    for (const m of result.missing) {
      process.stderr.write('  ' + path.relative(abs, m.path) + ' (' + m.reason + ')\n');
    }
  }
  if (inn > 0) {
    process.stderr.write('\nINVALID interactive_first_reward value:\n');
    for (const v of result.invalid) {
      process.stderr.write('  ' + path.relative(abs, v.path) + ' (value="' + v.value + '")\n');
    }
  }

  if (result.ok) {
    // Larry-voice success line. Plain hyphens, no em-dashes (project hard rule).
    process.stdout.write(
      '\nAll ' + cn + ' interactive commands declare their first reward -- the rule holds.\n'
    );
    process.exit(0);
  }

  process.stderr.write(
    '\nReward-before-investment rule violated. ' +
    'See docs/reward-before-investment-rule.md.\n' +
    'Fix: declare interactive_first_reward in the frontmatter of each missing/invalid command.\n' +
    'Allowed values: reframe_question, instant_brief, schema_preview, ' +
    'calibration_distribution_preview, paragraph_preview, --none (scripting only).\n'
  );
  process.exit(1);
}

main();
