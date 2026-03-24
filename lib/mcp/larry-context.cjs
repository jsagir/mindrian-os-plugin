/**
 * Larry Personality Context Loader for MCP
 *
 * Loads Larry's personality files (voice-dna, lexicon, assessment-philosophy)
 * and provides compact (for tool descriptions) and full (for prompt injection) versions.
 */

'use strict';

const path = require('path');
const { safeReadFile } = require('../core/index.cjs');

/**
 * Load Larry personality context from references/personality/ files.
 *
 * @param {string} pluginRoot - Root of the plugin repository
 * @returns {{ compact: string, full: string }}
 *   - compact: First ~500 chars of voice-dna.md (for tool descriptions)
 *   - full: All 3 personality files concatenated with headers (for prompt context)
 */
function loadLarryContext(pluginRoot) {
  const personalityDir = path.join(pluginRoot, 'references', 'personality');

  const voiceDna = safeReadFile(path.join(personalityDir, 'voice-dna.md')) || '';
  const lexicon = safeReadFile(path.join(personalityDir, 'lexicon.md')) || '';
  const assessment = safeReadFile(path.join(personalityDir, 'assessment-philosophy.md')) || '';

  // Compact: first ~500 chars of voice DNA for tool description hints
  const compact = voiceDna.slice(0, 500).trim();

  // Full: all 3 files concatenated with section headers
  const full = [
    "## Larry's Voice DNA",
    voiceDna,
    '',
    '## Lexicon',
    lexicon,
    '',
    '## Assessment Philosophy',
    assessment
  ].join('\n');

  return { compact, full };
}

module.exports = { loadLarryContext };
