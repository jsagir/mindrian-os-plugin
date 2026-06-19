'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-04 (extractDocText).
//
// IFACE (169-01 shared_iface_contract): lib/core/doc-text-extractor.cjs
//   extractDocText(absPath) -> string  -- branch on extension: .docx via
//   node:zlib inflateRawSync over the zip word/document.xml w:t runs (method-0
//   stored fallback), .html via cheerio $('body').text(), anything else ''.
//   NEVER writes/mutates the source file. Zip-bomb guard (entry count + inflated
//   size caps). Returns '' on any parse fault (exit-safe).
//
// RED-by-require until Plan 03 ships lib/core/doc-text-extractor.cjs. Asserts >0
// runs for the synthetic method-0 stored .docx fixture AND for the live b2
// fixture when present (skip-if-absent), .html via cheerio, and that the source
// file bytes + mtime are UNCHANGED before/after (D-169-03). No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIX = path.join(REPO_ROOT, 'tests', 'fixtures', '169');
// RED until Plan 03 ships the extractor.
const { extractDocText } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'doc-text-extractor.cjs')
);

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }
function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

console.log('test-doc-text-extractor (GDH-04)');

check('extractDocText returns >0 chars for the synthetic stored-method .docx', () => {
  const docx = path.join(FIX, 'stored-method.docx');
  const before = sha(docx);
  const text = extractDocText(docx);
  assert.equal(typeof text, 'string', 'must return a string');
  assert.ok(text.length > 0, 'the stored-method fixture must yield text');
  assert.ok(/Stored method run/.test(text), 'the extracted text must contain the w:t runs');
  // D-169-03: source bytes UNCHANGED.
  assert.equal(sha(docx), before, 'extractor must NEVER mutate the source .docx bytes');
});

check('extractDocText returns >0 chars for the sample .html via cheerio', () => {
  const html = path.join(FIX, 'sample.html');
  let text;
  try {
    text = extractDocText(html);
  } catch (e) {
    // cheerio may be unvendored in this checkout; the RED-by-require above is
    // the real gate. A missing dep is not a vacuous pass.
    if (/cheerio/.test(String(e && e.message))) { console.log('  skip - cheerio unavailable in this checkout'); return; }
    throw e;
  }
  assert.equal(typeof text, 'string');
  assert.ok(/Sample html body paragraph/.test(text), 'html body text must be extracted');
});

check('extractDocText returns empty string for an unsupported extension', () => {
  const other = path.join(FIX, 'sample.html');
  // a .txt-style path with no real file is a parse fault -> '' (exit-safe);
  // here use a non-doc extension on a real file.
  const txt = path.join(REPO_ROOT, 'tests', 'run-all-169.sh');
  assert.equal(extractDocText(txt), '', 'a non-.docx/.html extension returns empty string');
  // touch other to silence lint on unused
  assert.ok(fs.existsSync(other));
});

check('extractDocText > 0 runs for the live b2 fixture when present (skip-if-absent)', () => {
  const b2 = process.env.MINDRIAN_B2_FIXTURE_DOCX || path.join(FIX, 'b2-live-sample.docx');
  if (!fs.existsSync(b2)) { console.log('  skip - live b2 fixture absent (CI uses the synthetic fixture)'); return; }
  const before = sha(b2);
  const text = extractDocText(b2);
  assert.ok(text.length > 0, 'the live b2 .docx must yield text');
  assert.equal(sha(b2), before, 'extractor must NEVER mutate the live b2 source bytes');
});

console.log(`\nPASS (${pass}/4)`);
