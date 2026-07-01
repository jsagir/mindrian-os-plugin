/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-02 -- APO target-prompt loader/renderer (SEED-002 Path A).
 *
 * loadTarget(path)  -> { frontmatter, body, path }  splits a command file into
 *                      its RAW YAML frontmatter block (the inner text between the
 *                      two --- fences, byte-exact) and the markdown system-prompt
 *                      body.
 * renderCandidate(target, bodyVariant) -> string     reassembles a full command
 *                      file with the frontmatter preserved BYTE-IDENTICAL and the
 *                      body swapped for a proposed variant.
 *
 * Frontmatter-parser reuse (Part 7): the repo has two frontmatter parsers under
 * lib/ (lib/core/brain-md-staleness.cjs parseFrontmatter and
 * lib/core/feynman/timeline-runner.cjs parseFrontmatter/serializeFrontmatter).
 * BOTH decode YAML into a JS object and re-serialize from that object -- a lossy
 * round-trip that drops comments, collapses arrays, and cannot reproduce a
 * nested mapping (commands/act.md carries block comments, list values, and a
 * nested `connector:` object). Neither can render the frontmatter BYTE-IDENTICAL,
 * which is this plan's hard requirement (renderCandidate must swap ONLY the body).
 * So we take the minimal `---` fence split, RETAINING the raw frontmatter block
 * verbatim rather than decoding it. This is the "else a minimal fence split"
 * branch of the reuse rule, chosen because no existing parser is byte-lossless.
 *
 * Byte-identity proof: for a unix-newline file whose first line is exactly `---`
 * and whose next `---` line closes the block,
 *   renderCandidate(loadTarget(f), loadTarget(f).body) === readFileSync(f)
 * because split('\n')/join('\n') is an exact inverse and the fences are re-emitted
 * with their original single-'\n' framing. Test 3 asserts this against the real
 * commands/act.md.
 *
 * Canon Part 8: LAB-side only. LOCAL read. Zero network, zero Brain, zero egress.
 * Node built-ins only, CJS, no runtime deps. No auto-write to commands/ (Path A):
 * this module READS the target; it never writes it back.
 */
'use strict';

const fs = require('node:fs');

const FENCE = '---';

/**
 * loadTarget(targetPath) -> { frontmatter, body, path }
 *
 * frontmatter = the RAW inner text between the opening and closing `---` fences
 *               (no fence lines), preserved byte-exact (comments, arrays, nested
 *               maps all intact).
 * body        = everything after the closing fence line.
 *
 * Throws if the file has no opening or no closing frontmatter fence.
 */
function loadTarget(targetPath) {
  const raw = fs.readFileSync(targetPath, 'utf8');
  const lines = raw.split('\n');

  if (lines[0] !== FENCE) {
    throw new Error('prompt-target: no opening frontmatter fence (---) in ' + targetPath);
  }
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === FENCE) { close = i; break; }
  }
  if (close === -1) {
    throw new Error('prompt-target: no closing frontmatter fence (---) in ' + targetPath);
  }

  const frontmatter = lines.slice(1, close).join('\n');
  const body = lines.slice(close + 1).join('\n');
  return { frontmatter, body, path: targetPath };
}

/**
 * renderCandidate(target, bodyVariant) -> string
 *
 * Reassembles `---\n<frontmatter>\n---\n<bodyVariant>`. The frontmatter block is
 * emitted byte-identical to what loadTarget captured; only the body changes.
 * Passing target.body back reproduces the original file byte-for-byte.
 */
function renderCandidate(target, bodyVariant) {
  if (!target || typeof target.frontmatter !== 'string') {
    throw new Error('renderCandidate: target must be a loadTarget() result with a string frontmatter');
  }
  const body = bodyVariant == null ? '' : String(bodyVariant);
  return FENCE + '\n' + target.frontmatter + '\n' + FENCE + '\n' + body;
}

module.exports = {
  loadTarget,
  renderCandidate,
};
