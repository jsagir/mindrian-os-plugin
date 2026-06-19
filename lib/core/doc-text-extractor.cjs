'use strict';
// Phase 169 GDH-04 (D-169-03): pure-JS, non-destructive .docx/.html text
// extractor. Built-ins ONLY for .docx (node:fs + node:zlib); cheerio (the
// already-listed HTML-parse dep) for .html. ZERO new dependency.
//
// IFACE (169-01 shared_iface_contract):
//   extractDocText(absPath) -> string
//     .docx  -> the joined word/document.xml <w:t> runs, via a ZIP
//               central-directory walk + zlib.inflateRawSync (method 8) with a
//               method-0 (stored) raw fallback. RESEARCH Code Example 1, PROVEN
//               against the b2 fixture (216 Hebrew runs).
//     .html  -> $('body').text() via cheerio (falls back to $.root().text()).
//     other  -> ''.
//
// Canon Part 8: extraction is a LOCAL file READ only; the extracted text is
// DATA (never eval/exec'd); zero network. D-169-03: the source file is NEVER
// mutated -- this module opens the file for READ only, writes no sidecar.
//
// V5 / T-169-04 / T-169-05 (zip-bomb + malformed-input hardening): the
// central-directory loop is capped at MAX_ZIP_ENTRIES, inflateRawSync is given
// a maxOutputLength size cap (MAX_INFLATED_BYTES), and the whole body is wrapped
// in try/catch returning '' on any parse fault (the hook's exit-safe degrade).
//
// No em-dashes.

const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');

// V5 caps (zip-bomb guard).
const MAX_ZIP_ENTRIES = 4096;          // a sane ceiling on central-directory entries
const MAX_INFLATED_BYTES = 10 * 1024 * 1024; // ~10 MB of inflated text, then abort

// Walk the ZIP central directory to find word/document.xml, then inflate
// (method 8) or read raw (method 0), and pull the <w:t> body runs.
function extractDocxText(absPath) {
  const buf = fs.readFileSync(absPath);
  // 1. find the End Of Central Directory (EOCD) signature 0x06054b50.
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) return '';
  let cdCount = buf.readUInt16LE(i + 10);
  const cdOff = buf.readUInt32LE(i + 16);
  // V5: cap the entry count so a forged EOCD count cannot spin the walk.
  if (cdCount > MAX_ZIP_ENTRIES) cdCount = MAX_ZIP_ENTRIES;
  // 2. walk the central directory to locate word/document.xml.
  let p = cdOff;
  let entry = null;
  for (let n = 0; n < cdCount; n++) {
    if (p < 0 || p + 46 > buf.length) break;
    if (buf.readUInt32LE(p) !== 0x02014b50) break; // central dir header sig
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42); // local header offset
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === 'word/document.xml') { entry = { lho, method, compSize }; break; }
    p += 46 + nameLen + extraLen + commLen;
  }
  if (!entry) return '';
  // 3. read the local header to find the data start.
  if (entry.lho + 30 > buf.length) return '';
  const ln = buf.readUInt16LE(entry.lho + 26);
  const le = buf.readUInt16LE(entry.lho + 28);
  const dataStart = entry.lho + 30 + ln + le;
  const comp = buf.subarray(dataStart, dataStart + entry.compSize);
  // 4. inflate (method 8 = raw DEFLATE) or read raw (method 0 = stored), with a
  // size cap so a tiny compressed entry cannot inflate to an unbounded buffer.
  let xml;
  if (entry.method === 8) {
    xml = zlib.inflateRawSync(comp, { maxOutputLength: MAX_INFLATED_BYTES }).toString('utf8');
  } else if (entry.method === 0) {
    if (comp.length > MAX_INFLATED_BYTES) return '';
    xml = comp.toString('utf8'); // stored: no inflate
  } else {
    return ''; // unsupported compression method
  }
  // 5. pull the <w:t> runs (the document body text). UTF-8 already decoded
  // above (Hebrew is multi-byte UTF-8; toString('utf8') is correct).
  const runs = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
  return runs.join(' ');
}

// Extract the body text of an .html file via cheerio. A missing cheerio module
// is surfaced (re-thrown) rather than swallowed to '' so the caller can tell a
// missing-dep apart from a parse fault; a parse fault inside cheerio degrades to
// the file's raw text stripped of tags as a last resort.
function extractHtmlText(absPath) {
  let cheerio;
  try {
    cheerio = require('cheerio');
  } catch (err) {
    // Re-throw with cheerio in the message so a missing vendored dep is
    // distinguishable from a content parse fault (it is not a parse fault).
    const e = new Error('cheerio unavailable: ' + String(err && err.message));
    e.code = 'CHEERIO_UNAVAILABLE';
    throw e;
  }
  const html = fs.readFileSync(absPath, 'utf8');
  const $ = cheerio.load(html);
  const body = $('body');
  const text = body.length ? body.text() : $.root().text();
  return text;
}

// extractDocText(absPath) -> string. Branch on extension; '' for anything else;
// '' on any parse fault (exit-safe). Never opens the source for write.
function extractDocText(absPath) {
  if (typeof absPath !== 'string' || absPath.length === 0) return '';
  const ext = path.extname(absPath).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    // A missing cheerio dep propagates (CHEERIO_UNAVAILABLE); a real parse fault
    // degrades to ''.
    try {
      return extractHtmlText(absPath);
    } catch (err) {
      if (err && err.code === 'CHEERIO_UNAVAILABLE') throw err;
      return '';
    }
  }
  if (ext === '.docx') {
    try {
      return extractDocxText(absPath);
    } catch (_err) {
      return ''; // malformed / huge / zip-bomb -> exit-safe empty string
    }
  }
  return '';
}

module.exports = { extractDocText };
