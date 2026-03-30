/**
 * MindrianOS Plugin -- Artifact ID & Pipeline Provenance
 * Stable artifact ID computation and frontmatter injection.
 * IDs are deterministic 12-char hex hashes from room+section+title+created.
 *
 * Exports: computeArtifactId, injectArtifactId, injectPipelineProvenance
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Compute a stable artifact ID from room, section, title, and creation date.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} section - Section name (e.g. "problem-definition")
 * @param {string} title - Artifact title (first # heading or filename)
 * @param {string} created - Creation date string (e.g. "2026-03-15")
 * @returns {string} 12-char hex hash
 */
function computeArtifactId(roomDir, section, title, created) {
  const roomName = path.basename(roomDir);
  const input = roomName + ':' + section + ':' + title + ':' + created;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}

/**
 * Extract the first # heading from file content.
 * @param {string} content - File content
 * @param {string} filePath - Fallback basename
 * @returns {string}
 */
function extractTitle(content, filePath) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : path.basename(filePath, '.md');
}

/**
 * Extract a frontmatter field value from content.
 * @param {string} content - File content
 * @param {string} field - Field name
 * @returns {string}
 */
function extractField(content, field) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return '';
  const line = fmMatch[1].split('\n').find(l => l.startsWith(field + ':'));
  if (!line) return '';
  return line.slice(field.length + 1).trim().replace(/^["']|["']$/g, '');
}

/**
 * Inject artifact_id into frontmatter of a markdown file. Idempotent.
 * @param {string} filePath - Absolute path to .md file
 * @param {string} roomDir - Absolute path to room directory
 * @returns {{artifact_id: string, injected: boolean} | null} null if no frontmatter or already has ID
 */
function injectArtifactId(filePath, roomDir) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  // Must have frontmatter
  if (!content.startsWith('---\n')) return null;

  // Already has artifact_id -- idempotent
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return null;
  const frontmatter = content.slice(4, fmEnd);
  if (frontmatter.includes('artifact_id:')) return null;

  // Extract metadata
  const section = path.basename(path.dirname(filePath));
  const title = extractTitle(content, filePath);
  const created = extractField(content, 'date') || extractField(content, 'created') || '';

  const artifactId = computeArtifactId(roomDir, section, title, created);

  // Insert artifact_id line after the first ---
  const lines = content.split('\n');
  // lines[0] is '---', insert after it
  lines.splice(1, 0, `artifact_id: ${artifactId}`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  return { artifact_id: artifactId, injected: true };
}

/**
 * Inject pipeline provenance fields into frontmatter. Idempotent.
 * @param {string} filePath - Absolute path to .md file
 * @param {string} pipeline - Pipeline name (e.g. "meeting-filing")
 * @param {string} stage - Pipeline stage (e.g. "3")
 * @param {string[]} requires - What this stage requires
 * @param {string[]} provides - What this stage provides
 * @returns {{injected: boolean} | null}
 */
function injectPipelineProvenance(filePath, pipeline, stage, requires, provides) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  // Must have frontmatter
  if (!content.startsWith('---\n')) return null;

  // Already has pipeline -- idempotent
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return null;
  const frontmatter = content.slice(4, fmEnd);
  if (frontmatter.includes('pipeline:')) return null;

  // Find insertion point: after artifact_id if present, otherwise after first ---
  const lines = content.split('\n');
  let insertIdx = 1; // default: right after first ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') break;
    if (lines[i].startsWith('artifact_id:')) {
      insertIdx = i + 1;
      break;
    }
  }

  const reqYaml = requires && requires.length > 0
    ? '[' + requires.join(', ') + ']'
    : '[]';
  const provYaml = provides && provides.length > 0
    ? '[' + provides.join(', ') + ']'
    : '[]';

  const provenanceLines = [
    `pipeline: ${pipeline}`,
    `pipeline_stage: ${stage}`,
    `pipeline_requires: ${reqYaml}`,
    `pipeline_provides: ${provYaml}`,
  ];

  lines.splice(insertIdx, 0, ...provenanceLines);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  return { injected: true };
}

module.exports = {
  computeArtifactId,
  injectArtifactId,
  injectPipelineProvenance,
};
