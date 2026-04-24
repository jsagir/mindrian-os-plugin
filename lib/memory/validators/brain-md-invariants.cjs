/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 90-05 -- BRAIN.md invariants validator.
 *
 * Registry-compatible drop-in for the Phase 88-13 guardian. Auto-
 * discovered by scripts/feynman-minto-guardian.cjs's validator loader.
 * Zero guardian.cjs edits required; the guardian's loadValidators()
 * walks lib/memory/validators/*.cjs on every invocation.
 *
 * Contract (see lib/memory/validators/README.md):
 *   module.exports = {
 *     id:           'brain-md-invariants',
 *     severity_map: { critical, error, warning, info },
 *     scope:        'section',
 *     validate(sectionDir, ctx) -> { severity, violations[] },
 *   }
 *
 * This is the THIRD independent Canon Part 8 enforcement layer:
 *   1. Plan 90-00 validateSchema (documents + scans frontmatter leaks).
 *   2. Plan 90-01 prompt-builder allow-list (hard block at emission).
 *   3. THIS validator (body-text scan at read-time / commit-time).
 *
 * Defense-in-depth by design: a bug in any ONE detector still produces
 * detection via the other two.
 *
 * Three checks beyond the wrapped 90-00 schema validation:
 *   A) Staleness vs triple. Compare BRAIN.md governing_thought_hash
 *      against sha256 of the current triple.reasoning.governing_thought.
 *      Mismatch -> staleness/warning with action_hint 'enqueue_regen'.
 *   B) brain_graph_version drift. Compare BRAIN.md brain_graph_version
 *      against .mindrian/brain-schema-cache.json.current_graph_version.
 *      Drift -> staleness/warning.
 *   C) Cross-file Canon Part 8 body scan. Run a frozen regex set over
 *      the BRAIN.md body text. Each distinct hit -> canon_boundary/
 *      warning with action_hint 'canon_part8_review'. Capped at 5 per
 *      BRAIN.md to avoid spam.
 *
 * Fail-open: any unexpected throw is caught by the guardian's
 * validator runner (Phase 88-13 Test 12). This validator does NOT
 * swallow its own exceptions; the guardian owns that contract. Internal
 * best-effort reads (cache file, triple field access) are guarded
 * individually so a missing cache never produces a violation.
 *
 * BRAIN.md absent -> {violations:[]}. Absence is a valid default
 * state (mirrors Phase 88-13 stale-lifecycle.cjs behavior for missing
 * ledger files).
 *
 * Pure CJS, node built-ins only (fs, path, crypto). Zero npm deps.
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const schema = require('../../core/brain-md-schema.cjs');

// folder-memory is loaded lazily so the validator's top-level require
// graph stays minimal and a hypothetical unavailability never crashes
// require-time. When the guardian runs in on-stop / session-start mode
// it does NOT pre-populate ctx.triple for section-scoped validators, so
// we read the triple ourselves via readTriple. Every I/O path stays
// fail-open: a missing MINTO.md simply skips Check A silently.
let _folderMemory = null;
function lazyFolderMemory() {
  if (_folderMemory !== null) return _folderMemory;
  try {
    _folderMemory = require('../../core/folder-memory.cjs');
  } catch (_e) {
    _folderMemory = false;
  }
  return _folderMemory;
}

// ---------- Constants ----------

const SEVERITY_MAP = Object.freeze({
  critical: 3,
  error: 2,
  warning: 1,
  info: 0,
});

// Violation categories this validator emits. Kept in sync with the
// schema module's CATEGORIES. Declared here so `severity_map` (required
// by the guardian registry loader) is stable and auditable.
const SEVERITY_BY_CATEGORY = Object.freeze({
  existence: 'critical',
  schema: 'error',
  staleness: 'warning',
  attribution: 'error',
  canon_boundary: 'warning',
  coherence: 'warning',
});

// Hard cap on canon_boundary violations per BRAIN.md to prevent one
// noisy file from drowning the invariant report.
const CANON_BOUNDARY_CAP = 5;

// Frozen regex set -- MUST mirror the spirit of the Plan 90-00 scanner
// but applies to BRAIN.md BODY text (not just frontmatter scalars). The
// canon_boundary message carries the human-readable `hint` so downstream
// reviewers know which pattern matched.
const FORBIDDEN_PATTERNS = Object.freeze([
  { re: /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/, hint: 'email-like pattern' },
  { re: /\$[0-9][\d,.]*[KMB]?\b/, hint: 'currency magnitude' },
  {
    re: /\b(Lawrence|Jonathan|Nimrod|Oren|Dror)\s+said\b/i,
    hint: 'quoted-person attribution',
  },
  { re: /\bmeeting with\b/i, hint: 'meeting fragment' },
  { re: /\b\d{3}-\d{2}-\d{4}\b/, hint: 'SSN-like pattern' },
  {
    re: /\b\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/,
    hint: 'phone-like pattern',
  },
]);

// Categories that REQUIRE a parsed frontmatter (cannot run if we never
// got a usable fm object). If the schema wrapping short-circuits on a
// parse error, the validator skips these checks.
const STALENESS_CATEGORY = 'staleness';
const CANON_BOUNDARY_CATEGORY = 'canon_boundary';
const SCHEMA_CATEGORY = 'schema';

// ---------- Helpers ----------

function safeReadText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function safeReadJson(p) {
  const raw = safeReadText(p);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// Best-effort frontmatter extractor. Returns { fm, body } on success;
// { fm: null, body: '' } if the file is malformed. We do NOT emit a
// schema violation from here (the wrapped validateSchema already
// reports that with a precise message); we just bail out of the checks
// that depend on parsed frontmatter.
function splitFrontmatterAndBody(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { fm: null, body: '' };
  }
  const re = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const m = raw.match(re);
  if (!m) return { fm: null, body: '' };

  const fm = {};
  const fmText = m[1];
  const body = m[2] || '';
  const lines = fmText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || /^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!match) {
      return { fm: null, body: body };
    }
    const key = match[1];
    const rest = match[2].trim();
    fm[key] = unquoteOrCast(rest);
  }
  return { fm: fm, body: body };
}

function unquoteOrCast(raw) {
  if (raw.length === 0) return '';
  if (raw[0] === '"') {
    if (raw.length < 2 || raw[raw.length - 1] !== '"') return raw;
    return raw.slice(1, -1);
  }
  if (raw[0] === "'") {
    if (raw.length < 2 || raw[raw.length - 1] !== "'") return raw;
    return raw.slice(1, -1);
  }
  if (raw === 'null' || raw === '~') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(raw)) {
    const f = parseFloat(raw);
    if (Number.isFinite(f)) return f;
  }
  return raw;
}

function gthHashOf(text) {
  const s = typeof text === 'string' ? text : '';
  return 'sha256:' + crypto.createHash('sha256').update(s).digest('hex');
}

function pushViolation(list, category, severity, message, extras) {
  const v = { category: category, severity: severity, message: message };
  if (extras && typeof extras === 'object') {
    for (const k of Object.keys(extras)) {
      if (extras[k] !== undefined) v[k] = extras[k];
    }
  }
  list.push(v);
}

function aggregateSeverity(violations) {
  const order = ['info', 'warning', 'error', 'critical'];
  let max = -1;
  for (const v of violations) {
    const i = order.indexOf(v.severity);
    if (i > max) max = i;
  }
  return max === -1 ? null : order[max];
}

// ---------- Schema wrapping (Plan 90-00) ----------
//
// Wraps validateSchema and copies its violation records through. The
// schema module already normalizes severity + category; we just
// forward. The field + action_hint properties are preserved.

function runSchemaCheck(brainMdPath, violations) {
  let res;
  try {
    res = schema.validateSchema(brainMdPath);
  } catch (_e) {
    // Defensive: if the schema validator itself throws, surface a
    // single schema/error so the downstream audit is visible. The
    // guardian's fail-open still protects session-start and
    // pre-commit.
    pushViolation(
      violations,
      SCHEMA_CATEGORY,
      'error',
      'brain-md-schema.validateSchema threw unexpectedly'
    );
    return { shortCircuit: true };
  }
  if (!res || !Array.isArray(res.violations)) {
    return { shortCircuit: false };
  }
  // Copy violations into our list byte-identically (preserving field +
  // action_hint). The guardian auto-stamps validator id later.
  for (const v of res.violations) {
    if (!v || typeof v !== 'object') continue;
    const extras = {};
    if (v.field !== undefined) extras.field = v.field;
    if (v.action_hint !== undefined) extras.action_hint = v.action_hint;
    pushViolation(violations, v.category, v.severity, v.message, extras);
  }
  // If the schema validator returned CRITICAL (existence) or a parse-
  // delimiter error, we short-circuit the staleness + canon_boundary
  // checks: without a parsed frontmatter we can't compare hashes, and
  // without a parsed frontmatter+body we risk double-reporting the
  // same shape break. The short-circuit also prevents cascading noise
  // in Test 13 (parse-failure case).
  const isFatal = res.violations.some(function (v) {
    if (!v || typeof v !== 'object') return false;
    if (v.category === 'existence') return true;
    if (v.category === 'schema' && v.severity === 'error') {
      // Only delimiter / parse-failure messages warrant short-circuit;
      // missing-field errors are still informative alongside runtime
      // checks. We treat messages that mention "delimiter" or "parse"
      // as fatal-for-runtime-checks.
      return /delimiter|parse/i.test(v.message || '');
    }
    return false;
  });
  return { shortCircuit: isFatal };
}

// ---------- Check A: staleness vs triple ----------

function runStalenessCheck(fm, triple, violations) {
  if (!fm || !triple || !triple.reasoning) return;
  const fileHash = fm.governing_thought_hash;
  if (typeof fileHash !== 'string' || fileHash.length === 0) return;
  const currentGt = triple.reasoning.governing_thought;
  // If there's no current governing_thought (e.g. MINTO absent), we
  // cannot meaningfully compare. Skip silently; the 90-00 schema layer
  // already flags missing fields.
  if (typeof currentGt !== 'string' || currentGt.length === 0) return;
  const expected = gthHashOf(currentGt);
  if (expected === fileHash) return;
  pushViolation(
    violations,
    STALENESS_CATEGORY,
    'warning',
    'BRAIN.md governing_thought_hash does not match current triple (derivation stale, enqueue regen)',
    {
      field: 'governing_thought_hash',
      action_hint: 'enqueue_regen',
    }
  );
}

// ---------- Check B: brain_graph_version drift ----------

function runGraphVersionDriftCheck(fm, roomDir, violations) {
  if (!fm || !roomDir) return;
  const fileVersion = fm.brain_graph_version;
  if (typeof fileVersion !== 'number' || !Number.isSafeInteger(fileVersion)) {
    return;
  }
  const cachePath = path.join(roomDir, '.mindrian', 'brain-schema-cache.json');
  const cache = safeReadJson(cachePath);
  if (!cache || typeof cache !== 'object') return;
  const currentVersion = cache.current_graph_version;
  if (
    typeof currentVersion !== 'number' ||
    !Number.isSafeInteger(currentVersion)
  ) {
    return;
  }
  if (currentVersion === fileVersion) return;
  pushViolation(
    violations,
    STALENESS_CATEGORY,
    'warning',
    'BRAIN.md brain_graph_version ' +
      fileVersion +
      ' does not match current Brain graph version ' +
      currentVersion +
      ' (graph_version drift)',
    {
      field: 'brain_graph_version',
      action_hint: 'enqueue_regen',
    }
  );
}

// ---------- Check C: cross-file canon boundary scan ----------

function runCanonBoundaryScan(body, violations) {
  if (typeof body !== 'string' || body.length === 0) return;
  let count = 0;
  for (const p of FORBIDDEN_PATTERNS) {
    if (count >= CANON_BOUNDARY_CAP) break;
    if (p.re.test(body)) {
      pushViolation(
        violations,
        CANON_BOUNDARY_CATEGORY,
        'warning',
        'Possible Canon Part 8 leak in BRAIN.md body: ' +
          p.hint +
          ' matched. Review for user-content seepage.',
        {
          field: 'body',
          action_hint: 'canon_part8_review',
        }
      );
      count += 1;
    }
  }
}

// ---------- validate ----------

function validate(sectionDir, ctx) {
  const violations = [];
  // Guardian always passes a string sectionDir. Be defensive anyway.
  if (typeof sectionDir !== 'string' || sectionDir.length === 0) {
    return { severity: null, violations: violations };
  }

  const brainMdPath = path.join(sectionDir, 'BRAIN.md');
  // Absence is valid (mirrors stale-lifecycle.cjs behavior on missing
  // ledger files). Return zero violations.
  let stat;
  try {
    stat = fs.statSync(brainMdPath);
  } catch (_e) {
    return { severity: null, violations: violations };
  }
  if (!stat || !stat.isFile()) {
    return { severity: null, violations: violations };
  }

  // --- Schema wrapping (Plan 90-00 validateSchema) ---
  const schemaOutcome = runSchemaCheck(brainMdPath, violations);
  if (schemaOutcome.shortCircuit) {
    // Existence-critical or delimiter/parse-error. The staleness and
    // canon_boundary checks need a parsed frontmatter; running them
    // against a malformed file produces noise, not signal.
    return {
      severity: aggregateSeverity(violations),
      violations: violations,
    };
  }

  // --- Local parse for runtime checks ---
  const raw = safeReadText(brainMdPath);
  if (raw === null) {
    return {
      severity: aggregateSeverity(violations),
      violations: violations,
    };
  }
  const parsed = splitFrontmatterAndBody(raw);
  const fm = parsed.fm;
  const body = parsed.body;

  // If fm is null here, the wrapped schema already emitted an error;
  // runtime checks would double-report. Bail.
  if (!fm) {
    return {
      severity: aggregateSeverity(violations),
      violations: violations,
    };
  }

  // --- Check A: staleness vs live triple ---
  //
  // When called by the Phase 88-13 guardian in session-start / on-stop
  // / pre-commit mode, ctx does NOT carry a pre-computed triple (the
  // guardian passes {roomDir, kind, now}). We fall back to reading the
  // section's MINTO.md via folder-memory.readTriple. If folder-memory
  // is unavailable or readTriple throws unexpectedly, we skip the
  // check rather than synthesize a false violation -- fail-open.
  let triple = ctx && ctx.triple ? ctx.triple : null;
  if (!triple) {
    const fm2 = lazyFolderMemory();
    if (fm2 && typeof fm2.readTriple === 'function') {
      try {
        triple = fm2.readTriple(sectionDir);
      } catch (_e) {
        triple = null;
      }
    }
  }
  runStalenessCheck(fm, triple, violations);

  // --- Check B: brain_graph_version drift ---
  // Prefer ctx.roomDir (set by the guardian); fall back to the
  // section's parent directory as a sensible default when called
  // outside the guardian (e.g. direct unit tests with only a roomDir
  // in context).
  const roomDir =
    (ctx && typeof ctx.roomDir === 'string' && ctx.roomDir.length > 0)
      ? ctx.roomDir
      : path.dirname(sectionDir);
  runGraphVersionDriftCheck(fm, roomDir, violations);

  // --- Check C: canon_boundary body scan ---
  runCanonBoundaryScan(body, violations);

  return {
    severity: aggregateSeverity(violations),
    violations: violations,
  };
}

module.exports = {
  id: 'brain-md-invariants',
  severity_map: SEVERITY_MAP,
  scope: 'section',
  validate: validate,
  // Exported for downstream introspection + traceability. Not required
  // by the registry loader, but useful to Phase 91 and the 90-08
  // graceful-degradation suite.
  SEVERITY_BY_CATEGORY: SEVERITY_BY_CATEGORY,
  FORBIDDEN_PATTERNS: FORBIDDEN_PATTERNS,
  CANON_BOUNDARY_CAP: CANON_BOUNDARY_CAP,
};
