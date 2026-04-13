'use strict';

/**
 * Phase 80 Decision 15 helper -- ROOM.md scaffolder for the imports/ tree.
 *
 * The vault-import orchestrator (scripts/vault-import.cjs) MUST call
 * writeImportsRoomMd() after every fs.mkdirSync it performs inside
 * `imports/{import_id}/` so that EVERY directory in the staging tree carries
 * an ICM Layer 0 identity file. This is Locked Fix 1 / Blocker 1 from the
 * 80-CONTEXT.md plan-check, and Decision 15 in CLAUDE.md.
 *
 * The function is idempotent: if ROOM.md already exists in dirPath, it does
 * nothing and returns false. This lets the orchestrator call it freely on
 * folders that may have been written by an earlier stage.
 *
 * The output is intentionally minimal and deterministic (no LLM, no fields
 * that change between runs) so tests can pin it.
 */

const fs = require('node:fs');
const path = require('node:path');

function writeImportsRoomMd(dirPath, layerLabel, importId, stageName, purpose) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const abs = path.join(dirPath, 'ROOM.md');
  if (fs.existsSync(abs)) return false;
  const stage = stageName || '(staging)';
  const lines = [
    '---',
    'icm_layer: 0',
    'import_id: ' + importId,
    'stage: ' + stage,
    'generated_by: phase-80-vault-import',
    '---',
    '',
    '# ' + (layerLabel || 'Vault Import') + ' -- ICM Layer 0',
    '',
    'This folder is part of the Vault Import pipeline (import_id: ' + importId + ').',
    'Stage: ' + stage,
    'Purpose: ' + (purpose || 'Layer 4 working artifact for the ' + stage + ' stage.'),
    ''
  ];
  fs.writeFileSync(abs, lines.join('\n'));
  return true;
}

module.exports = { writeImportsRoomMd: writeImportsRoomMd };
