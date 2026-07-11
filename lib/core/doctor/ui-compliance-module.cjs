'use strict';
/*
 * lib/core/doctor/ui-compliance-module.cjs -- Phase 217 Plan 03 (D-01/D-02).
 *
 * The class-F "UI Ruling System compliance" doctor check, migrated verbatim out
 * of the doctor CLI inline main() block into a registry-driven
 * cadence:always runner. Check-only (fix_supported:false in the registry -- D-13
 * kept --fix detect-only; the contract-parity gate enforces the no-fix
 * declaration by asserting this module exports NO fix()).
 *
 * WHAT IT DOES (three sub-checks, unchanged):
 *   (a) commands/*.md frontmatter must declare a body_shape.
 *   (b) scripts/*.cjs must not use forbidden box chars / unauthorized glyphs.
 *   (c) renderer files must carry the Zone 1 header + Zone 4 action patterns.
 *
 * Contract: check(ctx) -> { status: 'ok'|'warn', detail: string, violations,
 *   counts, ... }. ctx.flags.scanCommandsDir / ctx.flags.scanScriptsDir override
 *   the scanned dirs (the --scan-commands / --scan-scripts CLI seam the class-F
 *   test relies on); absent flags fall back to <repo-root>/commands and
 *   <repo-root>/scripts.
 *
 * Canon Part 8: LOCAL file reads only. Zero network. It NEVER back-requires the
 * doctor CLI (circular). The three module-level constants + the two file
 * scanners moved here with the check body so the runner is self-contained.
 */

const fs = require('node:fs');
const path = require('node:path');

// Forbidden box-drawing chars (D-13). Unicode escapes ONLY -- writing the raw
// glyphs here would make this scanner flag its own source.
const FORBIDDEN_BOX_CHARS = new RegExp(
  '[' +
  '\\u256D\\u256E\\u256F\\u2570' +  // curved corners (top-l/r, bottom-r/l)
  '\\u250C\\u2510\\u2514\\u2518' +  // light corners
  '\\u2502' +                       // light vertical
  '\\u2500\\u2501' +                // horizontal (light + heavy)
  ']'
);

// Forbidden glyphs (D-13). Unicode escapes ONLY for the same reason. Bare
// U+26A0 WARNING SIGN is APPROVED per the 12-glyph vocabulary; only U+26A0
// followed by U+FE0F (variation selector forcing emoji presentation) is forbidden.
const FORBIDDEN_GLYPHS = new RegExp(
  '[\\u2717\\u2718\\u2715]' +  // ballot X variants + multiplication X
  '|\\u274C' +                  // cross mark
  '|\\u2753' +                  // black question mark ornament
  '|\\u2755' +                  // white exclamation mark ornament
  '|\\u2757' +                  // heavy exclamation mark
  '|\\u26A0\\uFE0F'             // warning sign with emoji presentation
);

// Carve-out: scripts/context-monitor is the documented emoji exception
// (SKILL.md section 3 + 2026-04-14 user directive).
const FILES_EMOJI_CARVE_OUT = ['context-monitor'];

// Renderer-pattern detection (sub-check c). A file is treated as a renderer if
// it contains lines.push(. Renderers must include the Zone 1 header pattern
// (-- WORD -- WORD --) and the Zone 4 action pattern.
const RENDERER_INDICATOR = /lines\.push\(/;
const ZONE_1_RENDERER_PATTERN = /-- [\w-]+(?: -- [\w-]+)+ --/;
const ZONE_4_RENDERER_PATTERN = /▶ \/mos:/;

function extractFrontmatterField(filePath, field) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch (_) { return null; }
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/m);
  if (!m) return null;
  const fm = m[1];
  const fieldRegex = new RegExp('^' + field + ':\\s*(.+)$', 'm');
  const fieldMatch = fm.match(fieldRegex);
  return fieldMatch ? fieldMatch[1].trim() : null;
}

function isCarveOutFile(filePath) {
  for (const carve of FILES_EMOJI_CARVE_OUT) {
    if (filePath.endsWith(carve) || filePath.endsWith(carve + '.cjs')) return true;
  }
  return false;
}

// Scan a single .cjs file line-by-line for forbidden box chars + glyphs.
// Returns an array of violation entries {kind, file, line, snippet, char}.
function scanScriptFile(filePath, repoRoot) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch (_) { return []; }
  const violations = [];
  const relFile = repoRoot ? path.relative(repoRoot, filePath) : filePath;
  const carveOut = isCarveOutFile(filePath);
  const fileLines = content.split('\n');
  for (let i = 0; i < fileLines.length; i++) {
    const ln = fileLines[i];
    const boxMatch = ln.match(FORBIDDEN_BOX_CHARS);
    if (boxMatch) {
      violations.push({
        kind: 'unauthorized-box-char',
        file: relFile,
        line: i + 1,
        char: boxMatch[0],
        snippet: ln.trim().slice(0, 80),
      });
    }
    if (!carveOut) {
      const glyphMatch = ln.match(FORBIDDEN_GLYPHS);
      if (glyphMatch) {
        violations.push({
          kind: 'unauthorized-glyph',
          file: relFile,
          line: i + 1,
          char: glyphMatch[0],
          snippet: ln.trim().slice(0, 80),
        });
      }
    }
  }
  // Sub-check (c): renderer Zone 1 + Zone 4 patterns. Best-effort; only flag
  // when the file IS a renderer (contains lines.push() calls) AND is missing
  // the canonical patterns.
  if (RENDERER_INDICATOR.test(content)) {
    if (!ZONE_1_RENDERER_PATTERN.test(content)) {
      violations.push({
        kind: 'renderer-missing-zone1',
        file: relFile,
        line: 0,
        detail: 'renderer file lacks Zone 1 header pattern (-- X -- Y --)',
      });
    }
    if (!ZONE_4_RENDERER_PATTERN.test(content)) {
      violations.push({
        kind: 'renderer-missing-zone4',
        file: relFile,
        line: 0,
        detail: 'renderer file lacks Zone 4 action footer pattern (>/mos: marker)',
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// check(ctx) -- read-only UI-compliance scan. NEVER mutates.
// ---------------------------------------------------------------------------
function check(ctx) {
  const c = ctx || {};
  const flags = (c.flags && typeof c.flags === 'object') ? c.flags : {};
  // The runner sits at lib/core/doctor/, so the repo root is three '..' hops up
  // (doctor -> core -> lib -> repo root).
  const repoRoot = flags.repoRoot || path.resolve(__dirname, '..', '..', '..');
  const commandsDir = flags.scanCommandsDir || path.join(repoRoot, 'commands');
  const scriptsDir = flags.scanScriptsDir || path.join(repoRoot, 'scripts');

  const violations = [];

  // Sub-check (a): commands/*.md frontmatter body_shape presence.
  if (fs.existsSync(commandsDir)) {
    let cmdFiles;
    try {
      cmdFiles = fs.readdirSync(commandsDir).filter(function (f) { return f.endsWith('.md'); });
    } catch (_) { cmdFiles = []; }
    for (const f of cmdFiles) {
      const filePath = path.join(commandsDir, f);
      const bodyShape = extractFrontmatterField(filePath, 'body_shape');
      if (!bodyShape) {
        violations.push({
          kind: 'missing-body-shape',
          file: path.relative(repoRoot, filePath),
          detail: 'frontmatter is missing body_shape field',
        });
      }
    }
  }

  // Sub-check (b) + (c): scripts/*.cjs scan.
  if (fs.existsSync(scriptsDir)) {
    let scriptFiles;
    try {
      scriptFiles = fs.readdirSync(scriptsDir).filter(function (f) { return f.endsWith('.cjs'); });
    } catch (_) { scriptFiles = []; }
    for (const f of scriptFiles) {
      const filePath = path.join(scriptsDir, f);
      const fileViolations = scanScriptFile(filePath, repoRoot);
      for (const v of fileViolations) violations.push(v);
    }
  }

  // Aggregate counts per kind for the report consumer.
  const counts = {
    missingBodyShape: 0,
    unauthorizedBoxChar: 0,
    unauthorizedGlyph: 0,
    rendererMissingZone1: 0,
    rendererMissingZone4: 0,
  };
  for (const v of violations) {
    if (v.kind === 'missing-body-shape') counts.missingBodyShape += 1;
    else if (v.kind === 'unauthorized-box-char') counts.unauthorizedBoxChar += 1;
    else if (v.kind === 'unauthorized-glyph') counts.unauthorizedGlyph += 1;
    else if (v.kind === 'renderer-missing-zone1') counts.rendererMissingZone1 += 1;
    else if (v.kind === 'renderer-missing-zone4') counts.rendererMissingZone4 += 1;
  }

  return {
    status: violations.length === 0 ? 'ok' : 'warn',
    // Non-empty detail on EVERY path (D-03 rule 9).
    detail: violations.length === 0
      ? 'ui-compliance: 0 violation(s) across scanned commands/ + scripts/ surfaces'
      : violations.length + ' violation(s) across commands/ and scripts/',
    violations,
    counts,
    fixable: false, // D-13: --fix is detect-only.
    fixDeferredTo: '95.2 or human review',
    scannedDirs: { commands: commandsDir, scripts: scriptsDir },
  };
}

module.exports = {
  check,
  // exported for hermetic unit tests:
  scanScriptFile,
  extractFrontmatterField,
};
