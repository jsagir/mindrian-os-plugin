#!/usr/bin/env node
'use strict';

/*
 * Quick 260903-ljj -- scripts/check-tool-honesty.cjs
 *
 * A LOCAL static heuristic that scans every MCP tool registration and every
 * command branch on the MindrianOS MCP surface (lib/mcp/tool-router.cjs,
 * lib/mcp/tools/*.cjs, lib/mcp/contract-version.cjs) for a description-vs-
 * behavior mismatch: a tool description that makes a first-person "does X"
 * persistence claim over a handler branch that reaches no write primitive.
 *
 * ORIGIN. RCA .planning/debug/meeting-file-meeting-false-success.md found
 * that `meeting` `file-meeting` returned a confident, no-error, filing-shaped
 * response while its handler contained no write call of any kind. That RCA's
 * own Non-Code Follow-ups section names the sweep this script performs: "a
 * broader sweep of every MCP tool in this server whose description makes a
 * first-person 'does X' claim, checked against whether the code actually
 * performs X -- file-meeting is unlikely to be the only instance." The
 * `meeting` tool itself was fixed (quick 260903-kwl) and is the load-bearing
 * NEGATION_REGRESSION fixture this script must never flag again.
 *
 * PRECEDENT (Canon Part 7, reuse before build). CLI/output contract follows
 * scripts/check-shape-declaration.cjs (the closer match under this plan's
 * C-03 decision: advisory-on-introduction, --check WARNs and exits 0 with
 * every violation enumerated, --strict restores hard-fail). Module shape
 * (pure programmatic scan API, never calls process.exit, plus a thin CLI
 * behind require.main === module) and self-allowlisting discipline
 * (ALLOWED_UNVERIFIED, shipped EMPTY) borrow from scripts/check-substrate.cjs.
 *
 * SCOPE GUARD. This script builds and runs the detector. It does NOT fix any
 * finding, and it does NOT harden the gate to blocking -- both are deliberate
 * downstream work (see the plan's threat register T-LJJ-02).
 *
 * Canon Part 8 (Graph Boundary): node:fs and node:path ONLY. Zero network,
 * zero Brain calls. The only `require()` calls this script itself performs
 * against repo modules are of navigation.cjs / navigation/edges.cjs /
 * node-insert.cjs (to enumerate their exported write-primitive names) plus,
 * at scan time, whatever repo-local module a scanned branch's own
 * require('...') statement names (read as TEXT, never evaluated -- this
 * script never requires an MCP tool file itself).
 *
 * ARCHITECTURE (six named stages, mirroring the plan's own breakdown):
 *   A. splitTopLevelArgs / maskNonCode / scanBalanced -- a hand-rolled,
 *      brace-and-string-aware forward scanner (no JS parser dependency).
 *   B. extractCommandVocabulary -- resolves z.enum(IDENT) / z.enum([...]) /
 *      z.enum([...A, ...B]) against module-level `const IDENT = [...]`
 *      arrays. A schema with no `command` key is single-purpose: vocabulary
 *      is the synthetic name '(default)'.
 *   C. splitBranches -- locates case/if branch spans inside a handler body.
 *      A branch's effective text is its own span concatenated with the
 *      shared body (the code outside every branch), because a generic
 *      fall-through handler performs its work outside any branch. Fall-
 *      through case labels (`case 'a': case 'b': { ... }`) share the
 *      following non-empty case's body -- a literal "next label" cut would
 *      wrongly starve the earlier label of its real code.
 *   D. resolveReachability -- depth 0 (does the effective text match a write
 *      primitive) then depth 1 (one hop into a called function's own body,
 *      never deeper). UNKNOWN only fires for a genuinely unresolvable
 *      repo-local callee -- never promoted to HIGH RISK.
 *   E. extractClaims -- sentence-splits the description, classifies STRONG
 *      vs WEAK persistence verbs, and applies the negation guard: a global
 *      disclaimer sentence cancels every claim for the tool.
 *   F. classifyBranch -- the claim x reachability matrix, with an in-band
 *      noWriteBanner(/ NO_WRITE_MARKER check that always wins.
 *
 * KNOWN BOUNDARIES (phase 276-06, 276-RESEARCH.md "Detector Boundaries").
 * Six named boundaries this detector does not (fully) close, each stated
 * plainly rather than left to be discovered by a false result:
 *
 *   B-1 Argument-gated writes (FALSE NEGATIVE). A write inside a guard on an
 *       optional parameter counts as reachable even when no caller supplies
 *       it. Example: lib/mcp/tools/dual-path.cjs:52 calls
 *       extractShallow(text, sessionId) with two arguments while
 *       lib/core/shallow-doc-parser.cjs:191 gates its navigation.setFocus
 *       write behind `if (opts && opts.db)`. Not closed by this phase.
 *   B-2 Barrel re-exports (FALSE UNKNOWN). lib/core/navigation.cjs is a
 *       facade of `NAME: mod.NAME` assignments, so locateFunctionBody finds
 *       no local definition and the branch reports UNKNOWN. Systemic,
 *       because navigation.cjs is the mandated Canon Part 9 chokepoint.
 *       Plan 276-07 is the owner of the one-level re-export follow.
 *   B-3 Subprocess-mediated writes (FALSE NEGATIVE). A write performed by a
 *       spawned script is invisible. Example: orchestration.rooms-open
 *       writes through a spawned room-registry.cjs. ACCEPTED as a
 *       documented boundary: a blanket "any spawn counts as a write" rule
 *       creates the opposite failure (false positives on every spawn).
 *   B-4 Dispatch-shape coverage (FALSE NEGATIVE). splitBranches recognizes
 *       top-level `switch (command)` and top-level `if (command === 'x')`.
 *       It does NOT recognize `ARRAY.includes(command)` or
 *       `command.startsWith(prefix)`, both used in this repo. Plan 276-07
 *       is the owner of the `includes()` half; `startsWith` stays
 *       documented, because a prefix maps to many commands and a
 *       prefix-dispatched tool is intentionally undifferentiated.
 *   B-5 Write-primitive semantics (conceptual, not fully tractable). "A
 *       write primitive is reachable" does not mean "the write the
 *       description promises happens." Example: `analysis` classifies OK
 *       for all its commands because pipelineState.recordStep writes a
 *       bookkeeping file, not the analysis output the description implies.
 *       Consequence stated plainly: an OK verdict means no detectable
 *       mismatch, NEVER a positive proof of honesty -- no summary anywhere
 *       may present a clean OK count as a clean surface.
 *   B-6 Parameter describe strings are never scanned (FALSE NEGATIVE, NEW
 *       in phase 276). scanAll reads only the second positional argument to
 *       server.tool(, so a claim made inside a zod .describe() string is
 *       invisible to the detector. Discovered while tracing graph_write's
 *       read_version describe string: lib/mcp/tools/graph.cjs:226 asserts
 *       "a lost update is rejected as a conflict instead of silently
 *       clobbering" while reconcile-guard.cjs:77-85 fails open on a missing
 *       node. Not closed by this phase; the CAS fail-open disclosure is
 *       plan 276-11's work.
 *
 * No em-dashes. CJS only. process.argv switch-case routing.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// ALLOWED_UNVERIFIED -- self-allowlist, ships EMPTY (mirrors
// check-substrate.cjs's ALLOWED_DIRECT_IMPORT discipline). An entry is added
// ONLY after a human has triaged a HIGH RISK finding and recorded why the
// mismatch is acceptable. Suppressing a finding before triage defeats the
// entire purpose of this script -- never pre-populate this array.
//
// ENTRY CONTRACT (phase 276-06, documented here at the declaration site
// rather than left inferable from the consumption site alone). Each entry
// is a plain object carrying exactly four required fields:
//   tool     - the tool name, matched against a row's `tool` field.
//   command  - the command/branch name (or '(default)'), matched against a
//              row's `command` field.
//   reason   - a human-written explanation of why this specific HIGH RISK
//              finding is a triaged false positive, not a real defect.
//   triaged  - who/when the triage happened (a short string; this script
//              does not enforce a format on it beyond presence).
//
// MEMBERSHIP RULE. An entry is admissible ONLY for a finding proven to be a
// false positive that the detector genuinely cannot be made to stop
// producing. A proven false positive is normally a DETECTOR FIX, not an
// allowlist entry -- adding an entry here should be the exception, made
// only when fixing the detector itself is not tractable (see the KNOWN
// BOUNDARIES block above for the boundaries that fall into this category,
// e.g. B-3's subprocess-mediated writes).
//
// TWO MECHANICAL FACTS a contributor must know before touching this array:
//   1. Suppression applies to HIGH_RISK rows ONLY. A matching entry
//      rewrites that one row's verdict to OK (see the consumption loop
//      after scanAll's row-building pass, below).
//   2. MEDIUM and UNKNOWN verdicts are NEVER suppressible by this
//      mechanism, by design, per D-276-2. There is no code path in this
//      file that lets an ALLOWED_UNVERIFIED entry touch a MEDIUM or
//      UNKNOWN row; only a HIGH_RISK row's verdict is ever rewritten.
// ---------------------------------------------------------------------------
const ALLOWED_UNVERIFIED = [];

// ---------------------------------------------------------------------------
// JS keyword / pseudo-callee exclusion set for the bare-fn( callee scan in
// Stage D. Prevents `if (`, `switch (`, `catch (` etc. from being treated as
// unresolvable callees.
// ---------------------------------------------------------------------------
const JS_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof',
  'new', 'do', 'else', 'async', 'await', 'yield', 'delete', 'void', 'in',
  'of', 'instanceof', 'case', 'default', 'try', 'finally', 'throw', 'const',
  'let', 'var', 'class', 'extends', 'super', 'this', 'null', 'true', 'false',
  'undefined',
]);

// ---------------------------------------------------------------------------
// The in-band no-write disclosure signal (quick 260903-kwl). A branch whose
// text carries either of these classifies OK regardless of any claim.
// ---------------------------------------------------------------------------
const NO_WRITE_MARKER_LITERAL = '**filed: false**';
const NO_WRITE_BANNER_CALL_RE = /noWriteBanner\s*\(/;

// ---------------------------------------------------------------------------
// Stage A -- maskNonCode / scanBalanced / splitTopLevelArgs / skipQuotedForward
//
// maskNonCode(text) returns a SAME-LENGTH string where every string/template
// literal's content (including its delimiters) and every comment are
// replaced with spaces, so structural scanning (brace matching, keyword
// search) can run on it with simple regexes, immune to a description string
// that happens to contain a brace or the word "case". Content is always
// extracted from the ORIGINAL text at the same offsets the masked text's
// structure locates -- masking never changes length or line breaks.
// ---------------------------------------------------------------------------
// Regex-literal detection (Task 3 spot-check finding, fixed per Rule 1).
// `/` is ambiguous in JS: it opens a regex literal OR is the division
// operator, decided entirely by what token precedes it. Getting this wrong
// is not cosmetic -- a regex literal containing a quote character as its
// PATTERN (e.g. `.replace(/"/g, '\\"')`, a real line in lib/core/
// user-md-ops.cjs) was being misread as a STRING-LITERAL OPEN QUOTE by the
// naive quote-scanner, which then hunted forward for the next stray `"`
// ANYWHERE in the rest of the file and masked everything in between --
// silently blanking every function definition after that point for the
// remainder of the file. This surfaced as identity_write.(default)
// spuriously classifying UNKNOWN (writeUserMdAtomic's own body, containing
// the real fs.renameSync write, had been masked to nothing). The heuristic
// below (last significant token before `/` decides regex-vs-division) is
// the same one V8 and every JS tokenizer uses.
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'yield', 'do', 'else',
]);

function looksLikeRegexStart(out, idx) {
  let j = idx - 1;
  while (j >= 0 && /\s/.test(out[j])) j -= 1;
  if (j < 0) return true; // start of file/expression -- must be a regex
  const prev = out[j];
  if (/[\w$]/.test(prev)) {
    let k = j;
    while (k >= 0 && /[\w$]/.test(out[k])) k -= 1;
    const word = out.slice(k + 1, j + 1).join('');
    return REGEX_PRECEDING_KEYWORDS.has(word);
  }
  if (prev === ')' || prev === ']') return false; // division after a call/index
  return true; // punctuation ( { , ; : = & | ! ? + - * % ^ ~ < > -- a regex can start here
}

// skipRegexLiteral(text, i) -- text[i] is the opening '/'. Character-class
// aware (a `/` inside `[...]` does not close the regex), escape aware,
// consumes trailing flags. Bails at a raw newline (a regex literal cannot
// contain one -- malformed source, not this script's problem to fix).
function skipRegexLiteral(text, i) {
  const n = text.length;
  let j = i + 1;
  let inClass = false;
  while (j < n) {
    const c = text[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '\n') return j; // malformed -- stop masking here, do not consume the newline
    if (c === '[') { inClass = true; j += 1; continue; }
    if (c === ']') { inClass = false; j += 1; continue; }
    if (c === '/' && !inClass) { j += 1; break; }
    j += 1;
  }
  while (j < n && /[a-z]/i.test(text[j])) j += 1; // flags
  return j;
}

function maskNonCode(text) {
  const out = text.split('');
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      let j = i;
      while (j < n && text[j] !== '\n') { out[j] = ' '; j += 1; }
      i = j;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k += 1) if (text[k] !== '\n') out[k] = ' ';
      i = stop;
      continue;
    }
    if (c === '/' && looksLikeRegexStart(out, i)) {
      const stop = skipRegexLiteral(text, i);
      for (let k = i; k < stop && k < n; k += 1) if (text[k] !== '\n') out[k] = ' ';
      i = stop;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === c) { j += 1; break; }
        j += 1;
      }
      for (let k = i; k < j && k < n; k += 1) if (text[k] !== '\n') out[k] = ' ';
      i = j;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '`') { j += 1; break; }
        j += 1;
      }
      for (let k = i; k < j && k < n; k += 1) if (text[k] !== '\n') out[k] = ' ';
      i = j;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

// scanBalanced(maskedStr, startIdx) -- maskedStr[startIdx] must be one of
// ( { [ (string/comment content already blanked, so brace-matching on the
// masked text is immune to a brace embedded in a string). Returns the index
// of the matching close, or -1.
function scanBalanced(maskedStr, startIdx) {
  const pairMap = { '(': ')', '{': '}', '[': ']' };
  if (!pairMap[maskedStr[startIdx]]) return -1;
  let depth = 0;
  for (let i = startIdx; i < maskedStr.length; i += 1) {
    const c = maskedStr[i];
    if (c === '(' || c === '{' || c === '[') {
      depth += 1;
    } else if (c === ')' || c === '}' || c === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// computeDepthArray(maskedStr) -- depths[i] is the bracket nesting depth
// BEFORE the character at i is processed. Lets any position's depth be
// looked up in O(1) once computed.
function computeDepthArray(maskedStr) {
  const depths = new Array(maskedStr.length);
  let depth = 0;
  for (let i = 0; i < maskedStr.length; i += 1) {
    depths[i] = depth;
    const c = maskedStr[i];
    if (c === '(' || c === '{' || c === '[') depth += 1;
    else if (c === ')' || c === '}' || c === ']') depth -= 1;
  }
  return depths;
}

// skipQuotedForward(text, i, q) -- text[i] is the opening quote character q.
// Returns the index AFTER the matching unescaped closing quote.
function skipQuotedForward(text, i, q) {
  let j = i + 1;
  while (j < text.length) {
    if (text[j] === '\\') { j += 2; continue; }
    if (text[j] === q) return j + 1;
    j += 1;
  }
  return text.length;
}

function unescapeSimple(raw, quoteChar) {
  return raw.replace(/\\(.)/g, (full, ch) => {
    if (ch === 'n') return '\n';
    if (ch === 't') return '\t';
    if (ch === quoteChar) return quoteChar;
    if (ch === '\\') return '\\';
    return ch;
  });
}

// extractStringLiteralConcat(text) -- unwraps a string literal, joining any
// `+` concatenation of adjacent literals (single/double/backtick), ignoring
// comments and non-literal punctuation (+, whitespace) between them.
function extractStringLiteralConcat(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = skipQuotedForward(text, i, c);
      const raw = text.slice(i + 1, Math.max(i + 1, end - 1));
      out += unescapeSimple(raw, c);
      i = end;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '`') { j += 1; break; }
        j += 1;
      }
      out += text.slice(i + 1, Math.max(i + 1, j - 1));
      i = j;
      continue;
    }
    i += 1;
  }
  return out;
}

// splitTopLevelArgs(text) -- top-level comma split, brace/paren/bracket and
// string/comment aware (via an internal maskNonCode pass). Returns the raw
// ORIGINAL-text span of each argument, trimmed, empty entries dropped.
function splitTopLevelArgs(text) {
  const masked = maskNonCode(text);
  const args = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < masked.length; i += 1) {
    const c = masked[i];
    if (c === '(' || c === '{' || c === '[') {
      depth += 1;
    } else if (c === ')' || c === '}' || c === ']') {
      depth -= 1;
    } else if (c === ',' && depth === 0) {
      args.push(text.slice(start, i));
      start = i + 1;
    }
  }
  args.push(text.slice(start));
  return args.map((s) => s.trim()).filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// resolveWritePrimitives() -- the run-time-derived write-primitive
// vocabulary. Requires navigation.cjs, navigation/edges.cjs and
// node-insert.cjs, takes every EXPORTED FUNCTION whose name matches the
// prefix set write / log / set / store / promote / confirm / insert at a
// camelCase word boundary, and unions that with a small fixed Node-builtin
// list this repo does not own (fs write primitives) plus the two SQLite
// execution forms '.run(' and '.exec('. Never hardcodes the resulting name
// list -- a future navigation writer is covered automatically because this
// enumerates module.exports at run time, every scan.
// ---------------------------------------------------------------------------
const WRITE_PRIMITIVE_PREFIXES = ['write', 'log', 'set', 'store', 'promote', 'confirm', 'insert'];
const FIXED_FS_PRIMITIVES = [
  'writeFileSync', 'writeFile', 'appendFileSync', 'appendFile',
  'mkdirSync', 'rmSync', 'rmdirSync', 'renameSync', 'unlinkSync',
  'copyFileSync', 'cpSync', 'createWriteStream',
];
const SQLITE_DOT_FORMS = ['.run(', '.exec('];

function isCamelCasePrefixMatch(name, prefix) {
  if (name.length <= prefix.length) return false;
  if (name.slice(0, prefix.length) !== prefix) return false;
  const nextChar = name[prefix.length];
  return nextChar === nextChar.toUpperCase() && nextChar !== nextChar.toLowerCase();
}

function resolveWritePrimitives() {
  const names = new Set(FIXED_FS_PRIMITIVES);
  const sources = [
    path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'),
    path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'),
    path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs'),
  ];
  for (const src of sources) {
    try {
      // eslint-disable-next-line import/no-dynamic-require
      const mod = require(src);
      for (const key of Object.keys(mod)) {
        if (typeof mod[key] !== 'function') continue;
        for (const prefix of WRITE_PRIMITIVE_PREFIXES) {
          if (isCamelCasePrefixMatch(key, prefix)) {
            names.add(key);
            break;
          }
        }
      }
    } catch (_e) {
      // Module unavailable at scan time -- degrade, never throw (Canon Part 8:
      // this is a read-only static analyzer, not a runtime dependency of the
      // modules it inspects).
    }
  }
  const escaped = Array.from(names).map((nm) => nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const combinedRe = escaped.length > 0 ? new RegExp('\\b(?:' + escaped.join('|') + ')\\s*\\(') : null;
  return {
    names,
    dotForms: SQLITE_DOT_FORMS.slice(),
    test(maskedText) {
      if (combinedRe && combinedRe.test(maskedText)) return true;
      for (const form of this.dotForms) {
        if (maskedText.indexOf(form) !== -1) return true;
      }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// Stage B -- extractCommandVocabulary(schemaText, fileText)
// ---------------------------------------------------------------------------
function resolveIdentifierArray(ident, fileText, fileMasked) {
  const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\bconst\\s+' + escaped + '\\s*=\\s*\\[');
  const m = re.exec(fileMasked);
  if (!m) return [];
  const openIdx = fileMasked.indexOf('[', m.index);
  if (openIdx === -1) return [];
  const closeIdx = scanBalanced(fileMasked, openIdx);
  if (closeIdx === -1) return [];
  const arrText = fileText.slice(openIdx + 1, closeIdx);
  const items = splitTopLevelArgs(arrText);
  const out = [];
  for (const item of items) {
    const s = extractStringLiteralConcat(item);
    if (s) out.push(s);
  }
  return out;
}

function resolveCommandVocabulary(innerText, fileText, fileMasked) {
  const trimmed = innerText.trim();
  const maskedInner = maskNonCode(trimmed);
  if (maskedInner.trim().startsWith('[')) {
    const openIdx = maskedInner.indexOf('[');
    const closeIdx = scanBalanced(maskedInner, openIdx);
    const arrInner = trimmed.slice(openIdx + 1, closeIdx === -1 ? trimmed.length : closeIdx);
    const items = splitTopLevelArgs(arrInner);
    const out = [];
    const seen = new Set();
    for (const item of items) {
      const it = item.trim();
      if (it.startsWith('...')) {
        const ident = it.slice(3).trim();
        for (const c of resolveIdentifierArray(ident, fileText, fileMasked)) {
          if (!seen.has(c)) { seen.add(c); out.push(c); }
        }
      } else {
        const s = extractStringLiteralConcat(it);
        if (s && !seen.has(s)) { seen.add(s); out.push(s); }
      }
    }
    return out;
  }
  return resolveIdentifierArray(trimmed, fileText, fileMasked);
}

function extractCommandVocabulary(schemaText, fileText, fileMasked) {
  const masked = maskNonCode(schemaText);
  const re = /command\s*:\s*z\.enum\s*\(/;
  const m = re.exec(masked);
  if (!m) return ['(default)'];
  const parenIdx = masked.indexOf('(', m.index);
  if (parenIdx === -1) return ['(default)'];
  const closeParen = scanBalanced(masked, parenIdx);
  if (closeParen === -1) return ['(default)'];
  const inner = schemaText.slice(parenIdx + 1, closeParen);
  const vocab = resolveCommandVocabulary(inner, fileText, fileMasked);
  return vocab.length > 0 ? vocab : ['(default)'];
}

// ---------------------------------------------------------------------------
// findServerToolCalls(fileText) -- every `server.tool(` occurrence, brace-
// matched via the masked file text. Returns [{ innerText }].
// ---------------------------------------------------------------------------
function findServerToolCalls(fileText, fileMasked) {
  const calls = [];
  const re = /server\.tool\s*\(/g;
  let m;
  while ((m = re.exec(fileMasked)) !== null) {
    const openParen = fileMasked.indexOf('(', m.index);
    if (openParen === -1) continue;
    const closeParen = scanBalanced(fileMasked, openParen);
    if (closeParen === -1) continue;
    calls.push({ innerText: fileText.slice(openParen + 1, closeParen) });
  }
  return calls;
}

// extractHandlerBody(handlerArgText) -- the 4th server.tool( argument is
// `async ({ ... }[, extra]) => { ... }`. Returns the text INSIDE the arrow
// function's block body, or null if the handler is not block-bodied
// (unexpected shape for this codebase -- degrade rather than guess).
function extractHandlerBody(handlerArgText) {
  const masked = maskNonCode(handlerArgText);
  const arrowIdx = masked.indexOf('=>');
  if (arrowIdx === -1) return null;
  let i = arrowIdx + 2;
  while (i < masked.length && /\s/.test(masked[i])) i += 1;
  if (masked[i] !== '{') return null;
  const close = scanBalanced(masked, i);
  if (close === -1) return null;
  return handlerArgText.slice(i + 1, close);
}

// ---------------------------------------------------------------------------
// Stage C -- splitBranches(handlerBodyText)
// Returns { branchMap: { [command]: ownText }, sharedBodyText }.
// ---------------------------------------------------------------------------
function splitBranches(handlerBodyText) {
  const masked = maskNonCode(handlerBodyText);
  const depths = computeDepthArray(masked);
  const consumed = [];
  const branchMap = {};

  // ---- switch (command) { case 'x': ... } ----
  const switchRe = /\bswitch\s*\(\s*command\s*\)\s*\{/g;
  let sm;
  while ((sm = switchRe.exec(masked)) !== null) {
    if (depths[sm.index] !== 0) continue; // only a top-level switch on command
    const openBrace = masked.indexOf('{', sm.index);
    if (openBrace === -1) continue;
    const closeBrace = scanBalanced(masked, openBrace);
    if (closeBrace === -1) continue;
    const baseDepth = depths[openBrace] + 1;

    const labelRe = /\bcase\s+|\bdefault\s*:/g;
    labelRe.lastIndex = openBrace + 1;
    const labels = [];
    let lm;
    while ((lm = labelRe.exec(masked)) !== null) {
      if (lm.index >= closeBrace) break;
      if (depths[lm.index] !== baseDepth) continue;
      const isCase = /^case/.test(lm[0]);
      if (isCase) {
        // D-1 fix (phase 276-06): lm[0].length already swallowed the
        // blanked-out quoted command value, because labelRe runs over
        // masked text where every string literal (delimiters included) is
        // replaced by spaces, so \bcase\s+ greedily matches straight
        // through to the following colon. Anchor at lm.index + 4 (the
        // literal length of the token "case") instead, then skip
        // whitespace in the ORIGINAL handlerBodyText, not masked -- both
        // halves are required, changing only one leaves idx still past the
        // real quote character.
        let idx = lm.index + 4;
        while (idx < masked.length && /\s/.test(handlerBodyText[idx])) idx += 1;
        const qc = handlerBodyText[idx];
        if (qc !== "'" && qc !== '"' && qc !== '`') continue;
        const endQ = skipQuotedForward(handlerBodyText, idx, qc);
        const raw = handlerBodyText.slice(idx + 1, Math.max(idx + 1, endQ - 1));
        const value = unescapeSimple(raw, qc);
        let colonIdx = endQ;
        while (colonIdx < masked.length && masked[colonIdx] !== ':') colonIdx += 1;
        labels.push({ isDefault: false, command: value, labelStart: lm.index, bodyStart: colonIdx + 1 });
      } else {
        const colonIdx = lm.index + lm[0].length - 1;
        labels.push({ isDefault: true, command: null, labelStart: lm.index, bodyStart: colonIdx + 1 });
      }
    }
    labels.sort((a, b) => a.labelStart - b.labelStart);
    for (let li = 0; li < labels.length; li += 1) {
      const nextStart = li + 1 < labels.length ? labels[li + 1].labelStart : closeBrace;
      labels[li].spanEnd = nextStart;
      labels[li].ownRaw = handlerBodyText.slice(labels[li].bodyStart, nextStart);
    }
    // Fall-through grouping: a case label whose own span is empty (a bare
    // `case 'a': case 'b': { ... }` fall-through) shares the body of the
    // NEXT label that actually carries code. A literal "runs to the next
    // case" cut would wrongly starve the earlier label's real behavior and
    // manufacture a false HIGH RISK on ordinary JS fall-through syntax --
    // this is Rule 1 (auto-fix bug). CORRECTION (phase 276-06): this
    // comment previously claimed the grouping was "verified against real
    // fall-through in this codebase (room_content's new-project/setup/
    // update/help group)". That verification could not have happened as
    // stated, because D-1 (the case-label regex running over masked text)
    // made the switch path produce zero labels, so no fall-through group
    // was ever exercised before this phase's fix. What is actually true
    // after the D-1 fix: the grouping IS exercised by room_content's
    // new-project/setup/update/help fall-through group, and it is verified
    // by tests/test-276-tool-honesty-switch-branches.cjs as of phase 276.
    // It was NOT verified before that test existed.
    for (let li = 0; li < labels.length; li += 1) {
      const lab = labels[li];
      if (lab.isDefault) {
        consumed.push([lab.bodyStart, lab.spanEnd]);
        continue;
      }
      let body = lab.ownRaw;
      let endIdx = lab.spanEnd;
      let k = li;
      while (body.trim() === '' && k + 1 < labels.length) {
        k += 1;
        body = labels[k].ownRaw;
        endIdx = labels[k].spanEnd;
      }
      consumed.push([lab.bodyStart, endIdx]);
      const existing = branchMap[lab.command] || '';
      branchMap[lab.command] = existing + '\n' + body;
    }
  }

  // ---- if (command === 'x') / else if (command === 'x') { ... } ----
  const ifRe = /(?:\belse\s+if|\bif)\s*\(/g;
  let im;
  while ((im = ifRe.exec(masked)) !== null) {
    if (depths[im.index] !== 0) continue; // only a top-level if in the handler body
    const parenIdx = masked.indexOf('(', im.index);
    if (parenIdx === -1) continue;
    const closeParen = scanBalanced(masked, parenIdx);
    if (closeParen === -1) continue;
    const condOriginal = handlerBodyText.slice(parenIdx + 1, closeParen);
    const cmdRe = /command\s*===\s*(['"`])([\s\S]*?)\1/g;
    const matchedCommands = [];
    let cm;
    while ((cm = cmdRe.exec(condOriginal)) !== null) {
      matchedCommands.push(cm[2]);
    }
    if (matchedCommands.length === 0) continue; // not a command-comparison if
    let i = closeParen + 1;
    while (i < masked.length && /\s/.test(masked[i])) i += 1;
    if (masked[i] !== '{') continue; // no-brace single statement -- unexpected here, skip
    const blockClose = scanBalanced(masked, i);
    if (blockClose === -1) continue;
    const ownText = handlerBodyText.slice(i + 1, blockClose);
    consumed.push([i + 1, blockClose]);
    for (const cmd of matchedCommands) {
      const existing = branchMap[cmd] || '';
      branchMap[cmd] = existing + '\n' + ownText;
    }
  }

  consumed.sort((a, b) => a[0] - b[0]);
  let sharedBody = '';
  let cursor = 0;
  for (const [s, e] of consumed) {
    if (s > cursor) sharedBody += handlerBodyText.slice(cursor, s);
    cursor = Math.max(cursor, e);
  }
  sharedBody += handlerBodyText.slice(cursor);

  return { branchMap, sharedBodyText: sharedBody };
}

// ---------------------------------------------------------------------------
// Stage D -- resolveReachability
// ---------------------------------------------------------------------------
// Matches BOTH `const X = require('path')` and destructured
// `const { a, b: c } = require('path')` (routers overwhelmingly use the
// destructured form for one-off helpers, e.g. room-open.cjs's openRoom,
// user-md-ops.cjs's writeUserMdAtomic -- missing this shape left every such
// callee unresolvable and produced false HIGH RISK findings, caught by
// Task 3's own spot-check requirement and fixed here per Rule 1).
function collectRequireBindings(fileText, fileMasked) {
  const map = {};
  const re = /\b(?:const|let|var)\s*(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(/g;
  let m;
  while ((m = re.exec(fileMasked)) !== null) {
    const lhs = m[1];
    const openParen = fileMasked.indexOf('(', m.index + m[0].length - 1);
    if (openParen === -1) continue;
    const closeParen = scanBalanced(fileMasked, openParen);
    if (closeParen === -1) continue;
    const argText = fileText.slice(openParen + 1, closeParen);
    const pathVal = extractStringLiteralConcat(argText);
    if (!pathVal) continue;
    if (lhs.startsWith('{')) {
      const inner = lhs.slice(1, lhs.lastIndexOf('}'));
      for (const rawPart of inner.split(',')) {
        const part = rawPart.trim();
        if (!part || part.startsWith('...')) continue;
        const colonIdx = part.indexOf(':');
        const localName = (colonIdx === -1 ? part : part.slice(colonIdx + 1)).split('=')[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(localName)) map[localName] = pathVal;
      }
    } else {
      map[lhs] = pathVal;
    }
  }
  return map;
}

function resolveRepoLocalPath(reqPath, fromFileAbsPath, repoRoot) {
  if (typeof reqPath !== 'string' || reqPath.length === 0) return null;
  if (reqPath.startsWith('node:')) return null;
  if (!reqPath.startsWith('.') && !reqPath.startsWith('/')) return null; // npm package
  const base = path.dirname(fromFileAbsPath);
  const resolved = path.resolve(base, reqPath);
  const rootWithSep = repoRoot.endsWith(path.sep) ? repoRoot : repoRoot + path.sep;
  if (resolved !== repoRoot && !resolved.startsWith(rootWithSep)) return null;
  let candidate = resolved;
  if (!fs.existsSync(candidate)) {
    if (fs.existsSync(candidate + '.cjs')) candidate = candidate + '.cjs';
    else if (fs.existsSync(candidate + '.js')) candidate = candidate + '.js';
    else return null;
  } else if (fs.statSync(candidate).isDirectory()) {
    return null; // no index-resolution needed for this scan's known callees
  }
  return candidate;
}

function readModuleCached(absPath, cache) {
  if (cache.has(absPath)) return cache.get(absPath);
  let src = null;
  try {
    src = fs.readFileSync(absPath, 'utf8');
  } catch (_e) {
    src = null;
  }
  cache.set(absPath, src);
  return src;
}

// locateFunctionBody(sourceText, fnName, bodyCache, cacheKeyPrefix) -- finds
// `function fn(`, `async function fn(`, `fn: function(`, `fn: (`, `fn = (`
// (with optional async), or an ES6 shorthand `fn(...) {`. Brace-matches the
// body via the masked text; for an expression-bodied arrow (no `{`), takes
// the text up to the next top-level `;`. Returns the body text, or null.
function locateFunctionBody(sourceText, fnName, bodyCache, cacheKeyPrefix) {
  const cacheKey = cacheKeyPrefix ? cacheKeyPrefix + '::' + fnName : null;
  if (cacheKey && bodyCache && bodyCache.has(cacheKey)) return bodyCache.get(cacheKey);

  const masked = maskNonCode(sourceText);
  const escaped = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp('\\bfunction\\s+' + escaped + '\\s*\\('),
    new RegExp('\\basync\\s+function\\s+' + escaped + '\\s*\\('),
    new RegExp('\\b' + escaped + '\\s*:\\s*(?:async\\s+)?function\\s*\\('),
    new RegExp('\\b' + escaped + '\\s*=\\s*(?:async\\s*)?\\('),
    new RegExp('\\b' + escaped + '\\s*:\\s*(?:async\\s*)?\\('),
    new RegExp('\\b' + escaped + '\\s*\\('), // shorthand method -- loosest, checked last
  ];

  let result = null;
  for (const re of patterns) {
    const m = re.exec(masked);
    if (!m) continue;
    const parenIdx = masked.indexOf('(', m.index);
    if (parenIdx === -1) continue;
    const parenClose = scanBalanced(masked, parenIdx);
    if (parenClose === -1) continue;
    let i = parenClose + 1;
    while (i < masked.length && /\s/.test(masked[i])) i += 1;
    if (masked.slice(i, i + 2) === '=>') {
      i += 2;
      while (i < masked.length && /\s/.test(masked[i])) i += 1;
    }
    if (masked[i] === '{') {
      const close = scanBalanced(masked, i);
      if (close === -1) continue;
      result = sourceText.slice(i + 1, close);
      break;
    }
    // Expression-bodied arrow, or a shorthand-method false match with no
    // body brace at all: only accept if a `{` genuinely follows within a
    // short lookahead; otherwise this pattern candidate is not a real
    // function definition here, try the next.
    if (i < masked.length && masked[i] !== ';' && masked[i] !== ',' && masked[i] !== ')') {
      let depth = 0;
      let j = i;
      while (j < masked.length) {
        const c = masked[j];
        if (c === '(' || c === '{' || c === '[') depth += 1;
        else if (c === ')' || c === '}' || c === ']') {
          if (depth === 0) break;
          depth -= 1;
        } else if (c === ';' && depth === 0) break;
        j += 1;
      }
      result = sourceText.slice(i, j);
      break;
    }
  }

  if (cacheKey && bodyCache) bodyCache.set(cacheKey, result);
  return result;
}

// bodyReachesWrite -- the depth-1 hop itself. "Test that body at depth 0"
// (the plan's own words) means testing the RESOLVED function's own text for
// a write primitive; in practice a resolved function very commonly delegates
// to a SAME-FILE local helper one more step down (pipeline-state.cjs's
// recordStep -> write -> fs.writeFileSync; room-open.cjs's openRoom ->
// several local helpers), and stopping at a flat text match on the directly-
// resolved body alone missed those, producing a real false HIGH RISK
// (caught by Task 3's own spot-check requirement, fixed here per Rule 1).
// This still never crosses a SECOND require() boundary (that would be depth
// 2, out of scope) -- it only chases bare same-file calls within the ONE
// already-crossed module, bounded by maxDepth and a visited-set so a
// mutually-recursive local helper pair cannot loop forever.
function bodyReachesWrite(bodyText, sourceText, primitives, bodyCache, cacheKeyPrefix, visited, maxDepth) {
  const masked = maskNonCode(bodyText);
  if (primitives.test(masked)) return true;
  if (maxDepth <= 0) return false;
  const bareRe = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = bareRe.exec(masked)) !== null) {
    const fnName = m[1];
    if (JS_KEYWORDS.has(fnName) || fnName === 'require') continue;
    const key = cacheKeyPrefix + '::' + fnName;
    if (visited.has(key)) continue;
    visited.add(key);
    const fnBody = locateFunctionBody(sourceText, fnName, bodyCache, cacheKeyPrefix);
    if (fnBody === null) continue;
    if (bodyReachesWrite(fnBody, sourceText, primitives, bodyCache, cacheKeyPrefix, visited, maxDepth - 1)) return true;
  }
  return false;
}

const LOCAL_CHASE_MAX_DEPTH = 3;

function resolveReachability(effectiveText, opts) {
  const masked = maskNonCode(effectiveText);
  if (opts.primitives.test(masked)) return 'WRITES';

  let unresolved = false;

  const dotRe = /([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = dotRe.exec(masked)) !== null) {
    const modName = m[1];
    const fnName = m[2];
    const reqPath = opts.fileRequireMap[modName];
    if (!reqPath) continue; // not a require-bound identifier -- not a candidate
    const resolvedAbs = resolveRepoLocalPath(reqPath, opts.filePath, opts.repoRoot);
    if (!resolvedAbs) continue; // external / non-repo-local -- not inspectable, skip
    const modSrc = readModuleCached(resolvedAbs, opts.moduleCache);
    if (modSrc === null) { unresolved = true; continue; }
    const fnBody = locateFunctionBody(modSrc, fnName, opts.bodyCache, resolvedAbs);
    if (fnBody === null) { unresolved = true; continue; }
    if (bodyReachesWrite(fnBody, modSrc, opts.primitives, opts.bodyCache, resolvedAbs, new Set(), LOCAL_CHASE_MAX_DEPTH)) {
      return 'WRITES';
    }
  }

  const bareRe = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = bareRe.exec(masked)) !== null) {
    const fnName = m[1];
    if (JS_KEYWORDS.has(fnName) || fnName === 'require') continue;

    // A bare call may be a DESTRUCTURED import bound to a repo-local
    // require() (e.g. `const { openRoom } = require('../core/room-open.cjs')`
    // then a bare `openRoom(...)` call) -- resolve it exactly like a dotted
    // external call before falling back to a same-file local definition.
    const reqPath = opts.fileRequireMap[fnName];
    if (reqPath) {
      const resolvedAbs = resolveRepoLocalPath(reqPath, opts.filePath, opts.repoRoot);
      if (!resolvedAbs) continue; // external (npm/node-builtin) -- not inspectable, skip
      const modSrc = readModuleCached(resolvedAbs, opts.moduleCache);
      if (modSrc === null) { unresolved = true; continue; }
      const fnBody = locateFunctionBody(modSrc, fnName, opts.bodyCache, resolvedAbs);
      if (fnBody === null) { unresolved = true; continue; }
      if (bodyReachesWrite(fnBody, modSrc, opts.primitives, opts.bodyCache, resolvedAbs, new Set(), LOCAL_CHASE_MAX_DEPTH)) {
        return 'WRITES';
      }
      continue;
    }

    const fnBody = locateFunctionBody(opts.fileText, fnName, opts.bodyCache, opts.filePath);
    if (fnBody === null) continue; // no local definition, no require binding -- builtin/global, skip
    if (bodyReachesWrite(fnBody, opts.fileText, opts.primitives, opts.bodyCache, opts.filePath, new Set(), LOCAL_CHASE_MAX_DEPTH)) {
      return 'WRITES';
    }
  }

  return unresolved ? 'UNKNOWN' : 'NO_WRITE';
}

// ---------------------------------------------------------------------------
// Stage E -- extractClaims(description, vocabulary)
// ---------------------------------------------------------------------------
const STRONG_VERBS = [
  'file', 'files', 'filed', 'filing', 'write', 'writes', 'writing', 'wrote',
  'persist', 'save', 'saves', 'saving', 'store', 'stores', 'storing',
  'insert', 'mint', 'mints', 'archive', 'archives', 'commit',
];
const WEAK_VERBS = [
  'generate', 'build', 'index', 'rebuild', 'render', 'update', 'add', 'log',
  'produce', 'publish', 'snapshot',
];
const CREATE_NOUNS = ['node', 'entry', 'artifact', 'file', 'room', 'record'];
const NEGATION_PATTERNS = [
  /\bwrites?\s+nothing\b/i,
  /\bdoes\s+not\s+write\b/i,
  /\bnever\s+writes?\b/i,
  /\bnothing\s+is\s+written\b/i,
  /\bno\s+writes?\s+occurs?\b/i,
  /\breference\s+only\b/i,
];

function sentenceHasNegation(sentence) {
  return NEGATION_PATTERNS.some((re) => re.test(sentence));
}

// isLocallyNegated -- a verb occurrence immediately preceded OR followed by
// a bare negator (no/not/never) is a claim about the ABSENCE of the write,
// not a claim of the write itself ("mints no second resolver", "creates not
// a single record"). This is distinct from sentenceHasNegation's fixed
// GLOBAL-disclaimer phrases: those cancel every claim for the whole tool;
// this only voids the ONE verb occurrence it wraps, so a sentence carrying
// both a negated verb and a separate genuine claim still registers the
// genuine one. Found via Task 3's own spot-check requirement (chain_resolve
// /chain_run/framework_run's "mints no second resolver" false HIGH RISK) and
// fixed here per Rule 1, not papered over with an ALLOWED_UNVERIFIED entry.
function isLocallyNegated(lower, matchIndex, matchLength) {
  const before = lower.slice(Math.max(0, matchIndex - 20), matchIndex);
  const after = lower.slice(matchIndex + matchLength, matchIndex + matchLength + 20);
  return /\b(?:no|not|never)\b\s*$/.test(before) || /^\s*(?:no|not|never)\b/.test(after);
}

// isPartOfHyphenatedToken -- \b treats a hyphen as a word boundary, so a
// verb match can land INSIDE a hyphenated command-literal token rather than
// standing alone in prose ("rooms-archive" trips a bare \barchive\b match;
// "scout-hsi" would trip a hypothetical "hsi" hit the same way). A verb
// immediately touching a hyphen on either side is part of a compound
// identifier, not a real prose verb usage. Found via Task 3's own spot-check
// requirement (orchestration's "Manage rooms (..., rooms-archive, ...)"
// parenthetical command list producing a false HIGH RISK for every listed
// command) and fixed here per Rule 1, not papered over with an
// ALLOWED_UNVERIFIED entry.
function isPartOfHyphenatedToken(lower, matchIndex, matchLength) {
  const before = lower[matchIndex - 1];
  const after = lower[matchIndex + matchLength];
  return before === '-' || after === '-';
}

// isEnumeratedCommandName -- a verb-shaped token that is actually one of the
// SCANNED TOOL'S OWN command names, sitting inside its own command
// enumeration (phase 276-07, F-2 through F-8: `export`'s description names
// "publish" and "snapshot" as WEAK_VERBS, but both are literal
// EXPORT_COMMANDS entries inside "Choose by audience: dashboard for..., ...,
// publish to push an artifact outward, ...", a COMMAND LIST, not a prose
// claim about what the tool does). Same disease class as
// isPartOfHyphenatedToken (a command-literal token misread as a verb), but
// for a BARE unhyphenated command name sitting in its own tool's
// parenthetical/enumerated command list rather than inside a hyphenated
// compound.
//
// Two INDEPENDENT signals are both required, so a single command name used
// as a genuine verb in an ordinary sentence still counts as a claim:
//   1. The token is a member of the tool's OWN resolved command vocabulary
//      (passed in, already resolved by extractCommandVocabulary -- this
//      function does not re-derive it).
//   2. The token sits in an ENUMERATION CONTEXT: it touches a list separator
//      (a comma, or the word "and"/"or") on at least one side, OR sits
//      inside a parenthetical, AND the sentence names at least two OTHER
//      members of the same command vocabulary (a lone command-shaped word
//      next to "and" is still ambiguous; a real multi-member enumeration is
//      not).
//
// Err toward COUNTING the verb when only one signal holds: a missed guard
// leaves a visible false positive (this phase's own subject), while an
// over-broad guard hides a real defect invisibly (the disease this whole
// phase exists to cure) -- the asymmetry is deliberate, not an oversight.
function isEnumeratedCommandName(sentence, matchIndex, matchLength, vocabulary) {
  if (!vocabulary || vocabulary.length === 0) return false;
  const lower = sentence.toLowerCase();
  const word = lower.slice(matchIndex, matchIndex + matchLength);
  const isVocabMember = vocabulary.some((c) => c !== '(default)' && c.toLowerCase() === word);
  if (!isVocabMember) return false;

  const before = lower.slice(Math.max(0, matchIndex - 12), matchIndex);
  const after = lower.slice(matchIndex + matchLength, matchIndex + matchLength + 12);
  const touchesComma = /,\s*$/.test(before) || /^\s*,/.test(after);
  const touchesAndOr = /\b(?:and|or)\s*$/.test(before) || /^\s*(?:and|or)\b/.test(after);
  const openCount = (lower.slice(0, matchIndex).match(/\(/g) || []).length;
  const closeCount = (lower.slice(0, matchIndex).match(/\)/g) || []).length;
  const insideParen = openCount > closeCount;
  if (!touchesComma && !touchesAndOr && !insideParen) return false;

  const namedHere = sentenceNamesCommand(sentence, vocabulary);
  const others = namedHere.filter((c) => c.toLowerCase() !== word);
  return others.length >= 2;
}

// FILE_NOUN_DEMOTION_WORDS / isFileNounUsage -- demotes the bare STRONG_VERBS
// entry 'file' from a verb reading when immediately followed by a noun that
// makes it read as a compound noun phrase ("file contents", "file path",
// "file system") rather than the verb "to file" (phase 276-07, F-10 Bug A:
// context_assemble's "Never returns raw file contents." was read as a
// POSITIVE STRONG persistence claim, because "Never returns raw " intervenes
// between the negator and "file", wider than isLocallyNegated's adjacency
// window). This narrow noun-phrase demotion is chosen over widening
// isLocallyNegated's window repo-wide, because it fixes the exact defect
// (a STRONG-verb-shaped noun phrase) without loosening the negation check
// for every OTHER sentence on this surface -- narrower effect, per the
// plan's own instruction to implement whichever of the two is narrower.
// Widening the negation window was evaluated and NOT needed: no other known
// finding depends on a negator separated from its verb by intervening
// words, so adding that broader change now would be an untested surface
// increase with no proven case behind it. Only the bare 'file' entry is
// demoted this way; 'files'/'filed'/'filing' are unaffected, and 'file'
// itself stays a real write verb everywhere else on this surface --
// STRONG_VERBS itself is NOT modified.
const FILE_NOUN_DEMOTION_WORDS = ['contents', 'path', 'paths', 'name', 'names', 'system'];
function isFileNounUsage(lower, matchIndex, matchLength) {
  const after = lower.slice(matchIndex + matchLength, matchIndex + matchLength + 12);
  return new RegExp('^\\s+(?:' + FILE_NOUN_DEMOTION_WORDS.join('|') + ')\\b').test(after);
}

function classifySentenceVerbTier(sentence, vocabulary) {
  const lower = sentence.toLowerCase();
  for (const v of STRONG_VERBS) {
    const re = new RegExp('\\b' + v + '\\b', 'g');
    let vm;
    while ((vm = re.exec(lower)) !== null) {
      if (isPartOfHyphenatedToken(lower, vm.index, vm[0].length)) continue;
      if (isEnumeratedCommandName(sentence, vm.index, vm[0].length, vocabulary)) continue;
      if (v === 'file' && isFileNounUsage(lower, vm.index, vm[0].length)) continue;
      if (!isLocallyNegated(lower, vm.index, vm[0].length)) return 'STRONG';
    }
  }
  if (/\bcreates?\b/.test(lower)) {
    const cm = lower.match(/\bcreates?\b/);
    if (cm && !isPartOfHyphenatedToken(lower, cm.index, cm[0].length) && !isLocallyNegated(lower, cm.index, cm[0].length)) {
      for (const n of CREATE_NOUNS) {
        if (new RegExp('\\b' + n + 's?\\b').test(lower)) return 'STRONG';
      }
    }
  }
  for (const v of WEAK_VERBS) {
    const re = new RegExp('\\b' + v + '\\b', 'g');
    let vm;
    while ((vm = re.exec(lower)) !== null) {
      if (isPartOfHyphenatedToken(lower, vm.index, vm[0].length)) continue;
      if (isEnumeratedCommandName(sentence, vm.index, vm[0].length, vocabulary)) continue;
      if (!isLocallyNegated(lower, vm.index, vm[0].length)) return 'WEAK';
    }
  }
  return null;
}

function sentenceNamesCommand(sentence, vocabulary) {
  const named = [];
  for (const cmd of vocabulary) {
    if (cmd === '(default)') continue;
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?<![\\w-])' + escaped + '(?![\\w-])', 'i');
    if (re.test(sentence)) named.push(cmd);
  }
  return named;
}

function extractClaims(description, vocabulary) {
  const result = { globalCancel: false, perCommand: {}, toolScoped: null };
  if (!description) return result;
  const sentences = description
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    if (sentenceHasNegation(sentence)) {
      result.globalCancel = true;
      continue;
    }
    const tier = classifySentenceVerbTier(sentence, vocabulary);
    if (!tier) continue;
    const namedCommands = sentenceNamesCommand(sentence, vocabulary);
    if (namedCommands.length > 0) {
      for (const cmd of namedCommands) {
        const existing = result.perCommand[cmd];
        if (!existing || (existing.tier === 'WEAK' && tier === 'STRONG')) {
          result.perCommand[cmd] = { tier, phrase: sentence };
        }
      }
    } else if (!result.toolScoped || (result.toolScoped.tier === 'WEAK' && tier === 'STRONG')) {
      result.toolScoped = { tier, phrase: sentence };
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stage F -- classifyBranch
// ---------------------------------------------------------------------------
function classifyBranch(ctx) {
  const hasBanner = NO_WRITE_BANNER_CALL_RE.test(ctx.effectiveText)
    || ctx.effectiveText.indexOf(NO_WRITE_MARKER_LITERAL) !== -1;
  if (hasBanner) {
    return { verdict: 'OK', reason: 'in-band no-write marker present (noWriteBanner( or ' + NO_WRITE_MARKER_LITERAL + ')' };
  }
  if (ctx.claims.globalCancel) {
    return { verdict: 'OK', reason: 'description carries a global no-write disclaimer' };
  }
  if (ctx.reachability === 'WRITES') {
    return { verdict: 'OK', reason: 'a write primitive is reachable' };
  }

  const cmdClaim = ctx.claims.perCommand[ctx.command];
  if (cmdClaim) {
    if (ctx.reachability === 'UNKNOWN') {
      return {
        verdict: 'UNKNOWN',
        reason: 'claims "' + cmdClaim.phrase + '" but reachability could not be resolved (unresolved callee)',
        claim: cmdClaim,
      };
    }
    if (cmdClaim.tier === 'STRONG') {
      return {
        verdict: 'HIGH_RISK',
        reason: 'claims "' + cmdClaim.phrase + '" but no write primitive is reachable',
        claim: cmdClaim,
      };
    }
    return {
      verdict: 'MEDIUM',
      reason: 'weak claim "' + cmdClaim.phrase + '" with no reachable write',
      claim: cmdClaim,
    };
  }

  const toolClaim = ctx.claims.toolScoped;
  if (toolClaim) {
    if (ctx.reachability === 'UNKNOWN') {
      return {
        verdict: 'UNKNOWN',
        reason: 'tool-scoped claim "' + toolClaim.phrase + '" but reachability could not be resolved',
        claim: toolClaim,
      };
    }
    if (toolClaim.tier === 'STRONG') {
      if (ctx.anyBranchWrites) {
        return {
          verdict: 'LOW',
          reason: 'tool-scoped claim "' + toolClaim.phrase + '" -- a sibling command in this tool does write',
          claim: toolClaim,
        };
      }
      return {
        verdict: 'HIGH_RISK',
        reason: 'tool-scoped claim "' + toolClaim.phrase + '" and no command in this tool reaches a write',
        claim: toolClaim,
      };
    }
    return {
      verdict: 'MEDIUM',
      reason: 'weak tool-scoped claim "' + toolClaim.phrase + '" with no reachable write',
      claim: toolClaim,
    };
  }

  return { verdict: 'OK', reason: 'no persistence claim found for this command' };
}

// ---------------------------------------------------------------------------
// defaultScanFiles(repoRoot) -- the complete scan set, enumerated at run
// time: lib/mcp/tool-router.cjs, lib/mcp/tools/*.cjs (sorted), and
// lib/mcp/contract-version.cjs. Nothing else in lib/mcp/ calls server.tool(
// (verified by grep during planning).
// ---------------------------------------------------------------------------
function defaultScanFiles(repoRoot) {
  const files = [];
  const toolRouter = path.join(repoRoot, 'lib', 'mcp', 'tool-router.cjs');
  if (fs.existsSync(toolRouter)) {
    files.push({ absPath: toolRouter, relPath: 'lib/mcp/tool-router.cjs' });
  }
  const toolsDir = path.join(repoRoot, 'lib', 'mcp', 'tools');
  if (fs.existsSync(toolsDir)) {
    for (const f of fs.readdirSync(toolsDir).filter((x) => x.endsWith('.cjs')).sort()) {
      files.push({ absPath: path.join(toolsDir, f), relPath: 'lib/mcp/tools/' + f });
    }
  }
  const contractVersion = path.join(repoRoot, 'lib', 'mcp', 'contract-version.cjs');
  if (fs.existsSync(contractVersion)) {
    files.push({ absPath: contractVersion, relPath: 'lib/mcp/contract-version.cjs' });
  }
  return files;
}

// ---------------------------------------------------------------------------
// scanAll(opts) -- the pure programmatic scan API. Never calls process.exit.
// opts: { repoRoot, primitives, files: [{absPath, relPath}] }
// Returns { rows, toolCount, branchCount }.
// rows[]: { tool, command, file, verdict, reason, claimPhrase }
// verdict in {'OK','LOW','MEDIUM','HIGH_RISK','UNKNOWN'}.
// ---------------------------------------------------------------------------
function scanAll(opts) {
  const o = opts || {};
  const repoRoot = o.repoRoot || REPO_ROOT;
  const primitives = o.primitives || resolveWritePrimitives();
  const files = o.files || defaultScanFiles(repoRoot);
  const moduleCache = new Map();
  const bodyCache = new Map();
  const rows = [];
  let toolCount = 0;
  let branchCount = 0;

  for (const f of files) {
    let fileText;
    try {
      fileText = fs.readFileSync(f.absPath, 'utf8');
    } catch (_e) {
      continue;
    }
    const fileMasked = maskNonCode(fileText);
    const fileRequireMap = collectRequireBindings(fileText, fileMasked);
    const toolCalls = findServerToolCalls(fileText, fileMasked);

    for (const call of toolCalls) {
      const args = splitTopLevelArgs(call.innerText);
      if (args.length < 4) continue;
      const [nameArg, descArg, schemaArg, handlerArg] = args;
      const toolName = extractStringLiteralConcat(nameArg);
      if (!toolName) continue;
      const description = extractStringLiteralConcat(descArg);
      const vocabulary = extractCommandVocabulary(schemaArg, fileText, fileMasked);
      const handlerBodyText = extractHandlerBody(handlerArg);
      if (handlerBodyText === null) continue;

      toolCount += 1;
      const claims = extractClaims(description, vocabulary);
      const { branchMap, sharedBodyText } = splitBranches(handlerBodyText);

      const reachByCommand = {};
      for (const cmd of vocabulary) {
        const ownText = branchMap[cmd] || '';
        const effectiveText = ownText + '\n' + sharedBodyText;
        reachByCommand[cmd] = {
          effectiveText,
          verdict: resolveReachability(effectiveText, {
            primitives,
            fileText,
            filePath: f.absPath,
            repoRoot,
            fileRequireMap,
            moduleCache,
            bodyCache,
          }),
        };
      }
      const anyBranchWrites = Object.keys(reachByCommand).some((cmd) => reachByCommand[cmd].verdict === 'WRITES');

      for (const cmd of vocabulary) {
        branchCount += 1;
        const info = reachByCommand[cmd];
        const verdictInfo = classifyBranch({
          command: cmd,
          effectiveText: info.effectiveText,
          claims,
          reachability: info.verdict,
          anyBranchWrites,
        });
        rows.push({
          tool: toolName,
          command: cmd,
          file: f.relPath,
          verdict: verdictInfo.verdict,
          reason: verdictInfo.reason,
          claimPhrase: verdictInfo.claim ? verdictInfo.claim.phrase : null,
        });
      }
    }
  }

  for (const row of rows) {
    if (row.verdict !== 'HIGH_RISK') continue;
    const allowed = ALLOWED_UNVERIFIED.find((a) => a.tool === row.tool && a.command === row.command);
    if (allowed) {
      row.verdict = 'OK';
      row.reason = 'allow-listed (triaged): ' + allowed.reason;
    }
  }

  return { rows, toolCount, branchCount };
}

// ---------------------------------------------------------------------------
// checkTree(opts) -- scanAll() plus the verdict-bucketed summary the CLI and
// doctor --acceptance gate consume.
// ---------------------------------------------------------------------------
function checkTree(opts) {
  const { rows, toolCount, branchCount } = scanAll(opts);
  return {
    rows,
    toolCount,
    branchCount,
    highRisk: rows.filter((r) => r.verdict === 'HIGH_RISK'),
    medium: rows.filter((r) => r.verdict === 'MEDIUM'),
    low: rows.filter((r) => r.verdict === 'LOW'),
    unknown: rows.filter((r) => r.verdict === 'UNKNOWN'),
    ok: rows.filter((r) => r.verdict === 'OK'),
  };
}

// ---------------------------------------------------------------------------
// CLI, matching scripts/check-shape-declaration.cjs's contract.
//   --check           : ADVISORY. 0 high-risk -> one-line OK, exit 0.
//                        N high-risk -> WARN block enumerating each, exit 0.
//   --check --strict  : N high-risk -> hard-fail block, exit 1.
//   --report          : full per-branch table (every verdict), exit 0.
//   (no flag)          : usage, exit 2.
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--report')) {
    const { rows, toolCount, branchCount } = scanAll();
    console.log('check-tool-honesty --report: ' + toolCount + ' tool(s), ' + branchCount + ' branch(es) scanned');
    console.log('');
    for (const r of rows) {
      console.log('[' + r.verdict + '] ' + r.tool + '.' + r.command + ' (' + r.file + '): ' + r.reason);
    }
    return;
  }

  if (argv.includes('--check')) {
    const strict = argv.includes('--strict');
    const report = checkTree();
    if (report.highRisk.length === 0) {
      console.log(
        'check-tool-honesty: OK (' + report.toolCount + ' tool(s), ' +
          report.branchCount + ' branch(es) scanned, 0 high-risk)' +
          (strict ? ' [strict mode]' : '')
      );
      return;
    }
    if (strict) {
      console.error('TOOL HONESTY VIOLATION:');
      for (const f of report.highRisk) {
        console.error('  - ' + f.tool + '.' + f.command + ': ' + f.verdict + ' -- claims "' + (f.claimPhrase || '') + '" but no write primitive is reachable');
      }
      console.error('Recovery: fix the description or wire the write, or add a triaged entry to ALLOWED_UNVERIFIED in scripts/check-tool-honesty.cjs with a stated reason.');
      console.error('strict mode: exiting 1 (--strict restores the hard-fail contract)');
      process.exit(1);
      return;
    }
    console.error(
      'WARN: tool-honesty advisory: ' + report.highRisk.length +
        ' high-risk finding(s) detected; not blocking (run with --strict to restore hard-fail)'
    );
    for (const f of report.highRisk) {
      console.error('WARN:   - ' + f.tool + '.' + f.command + ': ' + f.verdict + ' -- claims "' + (f.claimPhrase || '') + '" but no write primitive is reachable');
    }
    console.error('Recovery: fix the description or wire the write, or add a triaged entry to ALLOWED_UNVERIFIED in scripts/check-tool-honesty.cjs with a stated reason.');
    return;
  }

  console.error('usage: node scripts/check-tool-honesty.cjs [--check [--strict] | --report]');
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  scanAll,
  checkTree,
  classifyBranch,
  extractClaims,
  resolveWritePrimitives,
  splitTopLevelArgs,
  ALLOWED_UNVERIFIED,
  // Exposed for finer-grained testing / debugging, not part of the load-
  // bearing nine-assertion contract.
  maskNonCode,
  scanBalanced,
  extractStringLiteralConcat,
  extractCommandVocabulary,
  splitBranches,
  resolveReachability,
  defaultScanFiles,
};
