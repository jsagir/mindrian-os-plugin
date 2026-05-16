#!/usr/bin/env node
// check-palette-consistency.cjs -- Phase 121.5-03 CI tripwire.
//
// Enforces: every 6-hex value used in any file listed in palette.json
// derived_files exists in palette.json (base + palette_a + palette_b + extended).
// Stray hex in a derived file = regression. Files not in derived_files are
// exempt from the check so unrelated repo files don't trip it.
//
// Canon Part 7 (Reuse Before Build): one source of truth. CI failure when drift.
//
// Usage:
//   node scripts/check-palette-consistency.cjs           # human output, exit 0/1
//   node scripts/check-palette-consistency.cjs --json    # JSON output

'use strict';

const fs = require('fs');
const path = require('path');

const PALETTE_PATH = path.join(__dirname, '..', 'references', 'visual', 'palette.json');

function load() {
  return JSON.parse(fs.readFileSync(PALETTE_PATH, 'utf8'));
}

function hexesFromText(text) {
  // Match 6-hex values; capture lowercase form.
  const re = /#([0-9a-fA-F]{6})\b/g;
  const out = new Set();
  let m;
  while ((m = re.exec(text)) !== null) out.add('#' + m[1].toLowerCase());
  return out;
}

function collectCanonical(palette) {
  const tiers = [palette.base, palette.palette_a_discovery, palette.palette_b_build, palette.extended];
  const all = new Set();
  for (const tier of tiers) {
    if (!tier || typeof tier !== 'object') continue;
    for (const k of Object.keys(tier)) {
      const v = tier[k];
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
        all.add(v.toLowerCase());
      }
    }
  }
  return all;
}

function check() {
  const palette = load();
  const canonical = collectCanonical(palette);
  const violations = [];
  const filesScanned = [];

  const derived = Array.isArray(palette.derived_files) ? palette.derived_files : [];
  for (const entry of derived) {
    const filePath = path.join(__dirname, '..', entry.path);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      // Missing file: skip gracefully (Canon Part 7 -- never block on a moved file)
      continue;
    }
    filesScanned.push(entry.path);
    const found = hexesFromText(content);
    for (const hex of found) {
      if (!canonical.has(hex)) {
        violations.push({ file: entry.path, stray_hex: hex });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations: violations,
    canonical_count: canonical.size,
    files_scanned: filesScanned,
  };
}

function main() {
  const json = process.argv.includes('--json');
  const result = check();
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log('canonical hexes: ' + result.canonical_count);
    console.log('files scanned:   ' + result.files_scanned.length);
    if (!result.valid) {
      console.error('');
      console.error('VIOLATIONS:');
      for (const v of result.violations) {
        console.error('  STRAY ' + v.file + ' has ' + v.stray_hex + ' not in palette.json');
      }
    } else {
      console.log('result: OK (no stray hex values in derived files)');
    }
  }
  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) main();

module.exports = { check, load, collectCanonical, hexesFromText };
