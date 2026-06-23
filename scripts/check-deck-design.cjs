#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 175-02 -- check-deck-design.cjs (the WARN-first deck-design --check).
 *
 * A read-only LOCAL validator over a generated deck HTML file. Runs the three
 * pure rule helpers from lib/core/deck-design-rules.cjs (checkSourceLinks +
 * checkImageProvenance + checkBrandBinding) and prints each finding as a
 * "[deck-design WARN]" line to stderr, mirroring the
 * build-connector-registry.cjs methodologyCommandsMissingConnector
 * stderr-warn idiom -- but INVERTED to WARN-first: it EXITS 0 even when
 * warnings exist (D-04d, CIRS deferred-enforcement, mirroring R6/R11). The
 * hard-FAIL flip is deferred; no surface this phase depends on a hard gate
 * that is not yet law.
 *
 * Zero Brain, zero network (Canon Part 8): it reads the deck file LOCALLY and
 * runs pure string checkers. No fetch, no http, no Brain MCP.
 *
 * Usage:
 *   node scripts/check-deck-design.cjs <deck.html>        warn; exit 0 always
 *   node scripts/check-deck-design.cjs <deck.html> --strict   (RESERVED)
 *
 * --strict is RESERVED for the FUTURE hard-gate flip. When the deck-design
 * ruleset hard-gates later, --strict will exit 1 on any warning. For THIS
 * phase --strict STILL exits 0 (WARN-first) so no surface depends on a hard
 * gate that is not yet law.
 *
 * A missing file argument or an unreadable file prints a usage line to stderr
 * and exits 2 (operator error, distinct from a ruleset warning).
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const {
  checkSourceLinks,
  checkImageProvenance,
  checkBrandBinding,
} = require(path.join(REPO_ROOT, 'lib', 'core', 'deck-design-rules.cjs'));

function usage(msg) {
  if (msg) process.stderr.write('check-deck-design: ' + msg + '\n');
  process.stderr.write('Usage: node scripts/check-deck-design.cjs <deck.html> [--strict]\n');
  process.exit(2);
}

function main() {
  const args = process.argv.slice(2);
  // --strict is RESERVED for the future hard-gate flip; this phase still exits 0.
  const strict = args.includes('--strict');
  const fileArg = args.find((a) => a !== '--strict');

  if (!fileArg) {
    usage('a deck HTML file path is required');
    return; // unreachable (usage exits 2)
  }

  const deckPath = path.resolve(fileArg);
  let html;
  try {
    html = fs.readFileSync(deckPath, 'utf8');
  } catch (_e) {
    usage('cannot read deck file: ' + deckPath);
    return; // unreachable
  }

  const findings = []
    .concat(checkSourceLinks(html))
    .concat(checkImageProvenance(html))
    .concat(checkBrandBinding(html));

  for (const f of findings) {
    process.stderr.write('[deck-design WARN] (' + f.rule + ') ' + f.message + '\n');
  }

  const count = findings.length;
  if (count === 0) {
    console.log('check-deck-design: OK -- 0 warnings (' + path.basename(deckPath) + ')');
  } else {
    console.log(
      'check-deck-design: ' + count + ' warning' + (count === 1 ? '' : 's') +
      ' (' + path.basename(deckPath) + ') -- WARN-first, not failing the build (D-04d)'
    );
  }

  // WARN-first (D-04d, CIRS deferred-enforcement): exit 0 even with warnings.
  // --strict is RESERVED for the future hard-gate flip; this phase still exits 0
  // so no surface depends on a hard gate that is not yet law.
  if (strict && count > 0) {
    process.stderr.write(
      '[deck-design] --strict is RESERVED for the future hard-gate flip; ' +
      'this phase is WARN-first and exits 0 regardless (D-04d).\n'
    );
  }
  process.exit(0);
}

main();
