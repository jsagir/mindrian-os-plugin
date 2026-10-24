// 380 glossary hold (quick 261024-m86). Navigator ruling 2026-10-24: the glossary first sentences
// come from a private PWS glossary and do not ship. The panel ships with no glossary lines.
//
// Legs:
//   H1  ui/mos-face/hooks/glossary.ts keeps the Word type and an empty WORDS: no entry holds a term or a text.
//   H2  lib/mos-face/dist/glossary.js holds no entry and no text field (the built output ships).
//   H3  the built glossaryWords returns an empty list for every face id.
//   H4  the glossary files stay small: a pasted sentence would break the bound.
// CJS, Node built-ins only. Hermetic. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'ui', 'mos-face', 'hooks', 'glossary.ts');
const DIST = path.join(REPO, 'lib', 'mos-face', 'dist', 'glossary.js');
const VOICE = path.join(REPO, 'lib', 'mos-face', 'dist', 'voice.js');

let failed = 0;
function check(ok, label) {
  process.stdout.write((ok ? 'PASS ' : 'FAIL ') + label + '\n');
  if (!ok) failed++;
}

const src = fs.readFileSync(SRC, 'utf8');
const dist = fs.readFileSync(DIST, 'utf8');

check(/export type Word\b/.test(src), 'H1 glossary.ts keeps the Word type');
check(!/\bterm\s*:\s*["'`]/.test(src) && !/\btext\s*:\s*["'`]/.test(src), 'H1 glossary.ts holds no entry (no term or text field)');
check(!/\bterm\s*:\s*["'`]/.test(dist) && !/\btext\s*:\s*["'`]/.test(dist), 'H2 dist glossary.js holds no entry (no term or text field)');
check(!/PWS-Book|first sentence of the entry/.test(src + dist), 'H2 glossary files name no private glossary source');

// glossaryWords behaviour for every id is proved by W8 in ui/mos-face/tests/face-events.test.ts (engine run).
// The built module is ESM with extensionless imports, so this leg reads the function body instead.
function body(text) {
  const m = /export function glossaryWords\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(text);
  return m ? m[1] : null;
}
const voiceSrc = fs.readFileSync(path.join(REPO, 'ui', 'mos-face', 'hooks', 'voice.ts'), 'utf8');
const voiceDist = fs.readFileSync(VOICE, 'utf8');
for (const [label, text] of [['voice.ts', voiceSrc], ['dist voice.js', voiceDist]]) {
  const b = body(text);
  check(b !== null && /return\s*\[\s*\]/.test(b) && !/WORDS/.test(b), 'H3 ' + label + ' glossaryWords returns an empty list and reads no WORDS');
}
check(!/import\s*\{\s*WORDS\b/.test(voiceDist) || !/WORDS\[/.test(voiceDist), 'H3 dist voice.js does not index WORDS');
check(src.length < 2500 && dist.length < 2500, 'H4 glossary files stay small (src ' + src.length + ' bytes, dist ' + dist.length + ' bytes)');
process.stdout.write(failed ? 'FAILED ' + failed + '\n' : 'ALL PASSED\n');
process.exit(failed ? 1 : 0);
