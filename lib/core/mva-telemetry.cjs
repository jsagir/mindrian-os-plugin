/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 121-01 -- mva-telemetry shim. Delegates to lib/core/telemetry/writer.cjs
 * (the Canon Part 9 chokepoint), with a legacy dual-write to the historical
 * ~/.mindrian/telemetry/v1.13/mva.jsonl path so existing readers keep working.
 * TODO(v1.14.0): delete this shim; callers must import lib/core/telemetry/writer.cjs directly.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const writer = require('./telemetry/writer.cjs');
const validator = require('./telemetry/validator.cjs');
const schema = require('./telemetry/schema.cjs');

const EVENT_TYPES = Object.freeze([
  'mva_pipeline_started', 'mva_agent_returned', 'mva_brief_rendered',
  'mva_option_selected', 'mva_brief_deployed', 'mva_pipeline_failed',
]);

const ALLOWED_FIELDS = Object.freeze({
  mva_pipeline_started: schema.ALLOWED_FIELDS.mva_pipeline_started,
  mva_agent_returned:   schema.ALLOWED_FIELDS.mva_agent_returned,
  mva_brief_rendered:   schema.ALLOWED_FIELDS.mva_brief_rendered,
  mva_option_selected:  schema.ALLOWED_FIELDS.mva_option_selected,
  mva_brief_deployed:   schema.ALLOWED_FIELDS.mva_brief_deployed,
  mva_pipeline_failed:  schema.ALLOWED_FIELDS.mva_pipeline_failed,
});

function _homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function _legacyMvaPath() {
  return path.join(_homeDir(), '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
}

function emit(event, payload) {
  writer.emit(event, payload); // Canon Part 8 gate + unified events-YYYY-WNN.jsonl append.
  try {
    const sid = (typeof process.env.CLAUDE_SESSION_ID === 'string' && process.env.CLAUDE_SESSION_ID.length > 0)
      ? process.env.CLAUDE_SESSION_ID.slice(0, schema.MAX_STRING_LEN) : 'default';
    const record = Object.assign({ event: event, timestamp: new Date().toISOString(), session_id: sid }, payload);
    fs.mkdirSync(path.dirname(_legacyMvaPath()), { recursive: true });
    fs.appendFileSync(_legacyMvaPath(), JSON.stringify(record) + '\n', 'utf8');
  } catch (_) { /* best-effort legacy dual-write */ }
}

module.exports = {
  emit: emit,
  validateEventPayload: validator.validateEventPayload,
  EVENT_TYPES: EVENT_TYPES,
  ALLOWED_FIELDS: ALLOWED_FIELDS,
  telemetryDir: writer.telemetryDir,
  telemetryFile: writer.telemetryFile,
};
