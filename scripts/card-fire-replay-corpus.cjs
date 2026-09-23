'use strict';
// Phase 357-01 -- the Phase 357 replay corpus loader.
//
// DEV-TIME ONLY. Never required from lib/ or hooks/. Reads fixture files
// only; makes zero network calls. This is the single seam every later 357
// plan (harness, labeler, extractor, fixes) consumes -- nothing re-parses
// the fixture files on its own (357-01-PLAN.md objective).
//
// Corpus layout (D-01): tests/fixtures/card-fire-replay/ holds one JSON
// file per non-238 source (debug-cases.json, live-2026-09-23.json,
// dogfood.json), each with a meta block carrying sanitization_statement.
// Source (a), the 238 corpus, is NOT copied -- it is read in place through
// adapt238 below, because existing tests import that file directly and a
// copy would drift.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'card-fire-replay');
const CORPUS_238_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'card-fire-corpus-238.json');

const SOURCES = Object.freeze(['238', 'debug', 'live', 'dogfood']);

const SOURCE_FILES = Object.freeze({
  debug: 'debug-cases.json',
  live: 'live-2026-09-23.json',
  dogfood: 'dogfood.json',
});

const LABEL_ORIGINS = Object.freeze(['hand', 'jev', 'local', 'human']);

const ENVELOPE_MODES = Object.freeze(['direct', 'transcript', 'sidechannel', 'transcript+sidechannel']);

const EM_DASH = String.fromCharCode(0x2014);

// ---------------------------------------------------------------------
// adapt238: turns the 238 corpus's {expect_fire, text} entries into D-02
// shaped entries, per-state (RESEARCH Finding 6). Half A (expect_fire ===
// false) emits one 'direct' entry, healthy sidechannel, uncorroborated,
// expected pass. Half B (expect_fire === true) emits two entries: one
// healthy+corroborated (state 2), one unavailable+uncorroborated (state 3),
// both expected block. The 238 file itself is never copied or rewritten.
// ---------------------------------------------------------------------
function adapt238(corpus) {
  const entries = [];
  const rawEntries = (corpus && Array.isArray(corpus.entries)) ? corpus.entries : [];

  for (const e of rawEntries) {
    if (!e || typeof e !== 'object') continue;
    if (e.expect_fire === false) {
      entries.push({
        id: '238:' + e.id + ':s1',
        source: '238',
        envelope: {
          mode: 'direct',
          output_text: e.text,
          ran_entries: [],
          sidechannel_health: 'healthy',
          reach_corroborated: false,
        },
        expected_verdict_class: 'pass',
        label_origin: 'hand',
        why: e.why,
      });
    } else if (e.expect_fire === true) {
      entries.push({
        id: '238:' + e.id + ':s2',
        source: '238',
        envelope: {
          mode: 'direct',
          output_text: e.text,
          ran_entries: [],
          sidechannel_health: 'healthy',
          reach_corroborated: true,
        },
        expected_verdict_class: 'block',
        label_origin: 'hand',
        why: e.why,
      });
      entries.push({
        id: '238:' + e.id + ':s3',
        source: '238',
        envelope: {
          mode: 'direct',
          output_text: e.text,
          ran_entries: [],
          sidechannel_health: 'unavailable',
          reach_corroborated: false,
        },
        expected_verdict_class: 'block',
        label_origin: 'hand',
        why: e.why,
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------
// containsEmDash: deep-scans an entry (or any value) for U+2014 in any
// string, anywhere. Used by validateEntry's em-dash rule.
// ---------------------------------------------------------------------
function containsEmDash(value) {
  if (typeof value === 'string') return value.indexOf(EM_DASH) !== -1;
  if (Array.isArray(value)) return value.some(containsEmDash);
  if (value && typeof value === 'object') {
    return Object.keys(value).some((k) => containsEmDash(value[k]));
  }
  return false;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isNonNegativeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isNonNegativeInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

// ---------------------------------------------------------------------
// validateEnvelopeModeShape: the mode-specific field rules (direct /
// transcript / sidechannel), shared between a top-level envelope and any
// envelope.steps[] prior-step envelope (same rules, per D-02 / R-I).
// ---------------------------------------------------------------------
function validateEnvelopeModeShape(envelope, errors, prefix) {
  const mode = envelope.mode;

  if (mode === 'direct') {
    if (typeof envelope.sidechannel_health !== 'string' || !envelope.sidechannel_health) {
      errors.push(prefix + 'direct mode requires a string envelope.sidechannel_health');
    }
    if (typeof envelope.reach_corroborated !== 'boolean') {
      errors.push(prefix + 'direct mode requires a boolean envelope.reach_corroborated');
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'gate_is_fresh')) {
      errors.push(prefix + 'direct mode forbids envelope.gate_is_fresh (deriveTurnSignals ignores it)');
    }
  }

  if (mode.indexOf('transcript') !== -1) {
    if (!Array.isArray(envelope.transcript) || envelope.transcript.length === 0) {
      errors.push(prefix + 'mode "' + mode + '" requires a non-empty envelope.transcript array');
    } else {
      envelope.transcript.forEach((rec, i) => {
        if (!rec || typeof rec !== 'object') {
          errors.push(prefix + 'transcript[' + i + '] must be an object');
          return;
        }
        if (rec.type !== 'user' && rec.type !== 'assistant') {
          errors.push(prefix + 'transcript[' + i + '].type must be "user" or "assistant"');
        }
        if (!rec.message || typeof rec.message !== 'object') {
          errors.push(prefix + 'transcript[' + i + '].message must be an object with role and content');
        }
      });
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'output_text')) {
      errors.push(prefix + 'mode "' + mode + '" forbids envelope.output_text (transcript is the source)');
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'preceding_user_text')) {
      errors.push(prefix + 'mode "' + mode + '" forbids envelope.preceding_user_text');
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'preceding_user_text_source')) {
      errors.push(prefix + 'mode "' + mode + '" forbids envelope.preceding_user_text_source');
    }
  }

  if (mode.indexOf('sidechannel') !== -1) {
    if (!Array.isArray(envelope.sidechannel_records) || envelope.sidechannel_records.length === 0) {
      errors.push(prefix + 'mode "' + mode + '" requires a non-empty envelope.sidechannel_records array');
    } else {
      envelope.sidechannel_records.forEach((rec, i) => {
        if (!rec || typeof rec !== 'object') {
          errors.push(prefix + 'sidechannel_records[' + i + '] must be an object');
          return;
        }
        if (!isNonEmptyString(rec.entry)) {
          errors.push(prefix + 'sidechannel_records[' + i + '].entry must be a non-empty string');
        }
        if (!isNonEmptyString(rec.shape)) {
          errors.push(prefix + 'sidechannel_records[' + i + '].shape must be a non-empty string');
        }
        if (!isNonNegativeNumber(rec.age_ms)) {
          errors.push(prefix + 'sidechannel_records[' + i + '].age_ms must be a non-negative number');
        }
      });
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'ran_entries')) {
      errors.push(prefix + 'mode "' + mode + '" forbids envelope.ran_entries');
    }
  }
}

// ---------------------------------------------------------------------
// validateEntry(entry, fileMeta): returns an array of error strings.
// Empty array means valid. Never throws.
// ---------------------------------------------------------------------
function validateEntry(entry, fileMeta) {
  const errors = [];

  if (!entry || typeof entry !== 'object') {
    return ['entry must be an object'];
  }

  if (!isNonEmptyString(entry.id)) {
    errors.push('id must be a non-empty string');
  }
  if (SOURCES.indexOf(entry.source) === -1) {
    errors.push('source must be one of: ' + SOURCES.join(', '));
  }
  if (entry.expected_verdict_class !== 'block' && entry.expected_verdict_class !== 'pass') {
    errors.push('expected_verdict_class must be "block" or "pass"');
  }
  if (LABEL_ORIGINS.indexOf(entry.label_origin) === -1) {
    errors.push('label_origin must be one of: ' + LABEL_ORIGINS.join(', '));
  }
  if (!isNonEmptyString(entry.why)) {
    errors.push('why must be a non-empty string');
  }

  const envelope = entry.envelope;
  if (!envelope || typeof envelope !== 'object') {
    errors.push('envelope must be an object');
  } else {
    if (ENVELOPE_MODES.indexOf(envelope.mode) === -1) {
      errors.push('envelope.mode must be one of: ' + ENVELOPE_MODES.join(', '));
    } else {
      if ((entry.source === 'live' || entry.source === 'dogfood') && envelope.mode.indexOf('transcript') === -1) {
        errors.push('source "' + entry.source + '" requires envelope.mode to contain "transcript" (R-I)');
      }
      validateEnvelopeModeShape(envelope, errors, 'envelope.');

      if (envelope.steps !== undefined) {
        if (!Array.isArray(envelope.steps)) {
          errors.push('envelope.steps must be an array when present');
        } else {
          envelope.steps.forEach((step, i) => {
            if (!step || typeof step !== 'object' || ENVELOPE_MODES.indexOf(step.mode) === -1) {
              errors.push('envelope.steps[' + i + '].mode must be one of: ' + ENVELOPE_MODES.join(', '));
            } else {
              validateEnvelopeModeShape(step, errors, 'envelope.steps[' + i + '].');
            }
          });
        }
      }

      if (envelope.counters !== undefined) {
        if (!envelope.counters || typeof envelope.counters !== 'object') {
          errors.push('envelope.counters must be an object when present');
        } else {
          if (!isNonNegativeInt(envelope.counters.retry)) {
            errors.push('envelope.counters.retry must be a non-negative integer');
          }
          if (!isNonNegativeInt(envelope.counters.session)) {
            errors.push('envelope.counters.session must be a non-negative integer');
          }
        }
      }
    }
  }

  if (entry.known_miss !== undefined) {
    if (entry.expected_verdict_class !== 'block') {
      errors.push('known_miss is only allowed when expected_verdict_class is "block"');
    }
    if (!entry.known_miss || typeof entry.known_miss !== 'object' || !isNonEmptyString(entry.known_miss.reason)) {
      errors.push('known_miss must be an object with a non-empty reason');
    }
  }

  if (entry.known_false_block !== undefined) {
    if (entry.expected_verdict_class !== 'pass') {
      errors.push('known_false_block is only allowed when expected_verdict_class is "pass"');
    }
    if (!entry.known_false_block || typeof entry.known_false_block !== 'object' || !isNonEmptyString(entry.known_false_block.reason)) {
      errors.push('known_false_block must be an object with a non-empty reason');
    }
  }

  if (entry.envelope_partial !== undefined) {
    if (typeof entry.envelope_partial !== 'boolean') {
      errors.push('envelope_partial must be a boolean when present');
    }
    if (entry.source !== 'dogfood') {
      errors.push('envelope_partial is only allowed on dogfood entries');
    }
  }

  if (!fileMeta || !isNonEmptyString(fileMeta.sanitization_statement)) {
    errors.push('fileMeta.sanitization_statement must be a non-empty string');
  }

  if (containsEmDash(entry)) {
    errors.push('entry contains an em-dash (U+2014); hyphens only');
  }

  return errors;
}

// ---------------------------------------------------------------------
// loadCorpus({corpusDir, include238, sources}): reads the 238 adapter plus
// every present SOURCE_FILES file in corpusDir. Never throws: a malformed
// file becomes an error string and loading continues.
// ---------------------------------------------------------------------
function loadCorpus(opts) {
  const options = opts || {};
  const corpusDir = options.corpusDir || CORPUS_DIR;
  const include238 = options.include238 !== false;
  const wantSources = Array.isArray(options.sources) ? options.sources : null;

  const entries = [];
  const files = {};
  const errors = [];
  const seenIds = new Set();

  function wantSource(src) {
    return !wantSources || wantSources.indexOf(src) !== -1;
  }

  function addEntries(list, fileMeta, sourceKey, filePath) {
    let count = 0;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object' || !isNonEmptyString(entry.id)) {
        errors.push(filePath + ': entry missing a valid id, skipped');
        continue;
      }
      if (entry.source !== sourceKey) {
        errors.push(filePath + ': entry "' + entry.id + '" has source "' + entry.source + '", expected "' + sourceKey + '"');
        continue;
      }
      if (seenIds.has(entry.id)) {
        errors.push('duplicate entry id: ' + entry.id);
        continue;
      }
      const entryErrors = validateEntry(entry, fileMeta);
      if (entryErrors.length > 0) {
        errors.push(entry.id + ': ' + entryErrors.join('; '));
        continue;
      }
      seenIds.add(entry.id);
      entries.push(entry);
      count += 1;
    }
    return count;
  }

  if (include238 && wantSource('238')) {
    try {
      delete require.cache[require.resolve(CORPUS_238_PATH)];
      const corpus238 = require(CORPUS_238_PATH);
      const fileMeta = corpus238 && corpus238.meta;
      const adapted = adapt238(corpus238);
      const count = addEntries(adapted, fileMeta, '238', CORPUS_238_PATH);
      files['238'] = { path: CORPUS_238_PATH, meta: fileMeta || null, count };
    } catch (e) {
      errors.push(CORPUS_238_PATH + ': failed to read/parse (' + e.message + ')');
    }
  }

  for (const sourceKey of Object.keys(SOURCE_FILES)) {
    if (!wantSource(sourceKey)) continue;
    const fileName = SOURCE_FILES[sourceKey];
    const filePath = path.join(corpusDir, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const fileMeta = parsed && parsed.meta;
      const list = (parsed && Array.isArray(parsed.entries)) ? parsed.entries : [];
      const count = addEntries(list, fileMeta, sourceKey, filePath);
      files[sourceKey] = { path: filePath, meta: fileMeta || null, count };
    } catch (e) {
      errors.push(filePath + ': failed to read/parse (' + e.message + ')');
    }
  }

  return { entries, files, errors };
}

// ---------------------------------------------------------------------
// readPrePhase(corpusDir): returns the parsed pre-phase.json, or null if
// it is absent or malformed. Never throws.
// ---------------------------------------------------------------------
function readPrePhase(corpusDir) {
  const dir = corpusDir || CORPUS_DIR;
  const filePath = path.join(dir, 'pre-phase.json');
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

module.exports = {
  CORPUS_DIR,
  CORPUS_238_PATH,
  SOURCES,
  SOURCE_FILES,
  LABEL_ORIGINS,
  ENVELOPE_MODES,
  adapt238,
  validateEntry,
  loadCorpus,
  readPrePhase,
};
