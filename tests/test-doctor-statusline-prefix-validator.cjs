// Locks the 2026-07-02 doctor false-positive: the class-G statusline validator
// must accept the brand-hexagon-led renderer format ("⬡ · ...") on the brand
// hexagon lead, not the frozen literal "⬡ MindrianOS". (The 2026-07-02
// statusline-context-aware pass dropped the static "👤 Larry" persona chip per
// Ruling 1; the hexagon alone now leads. The validator only anchors on the ⬡/🏠
// brand lead, so it stays green across that format change.)
const assert = require('node:assert');

// The validator predicate as it now lives in the class-G runner
// (lib/core/doctor/statusline-visibility-module.cjs). Phase 217 Plan 05 moved
// checkStatuslineVisibility (with this validator) out of scripts/doctor.cjs into
// the registry-driven runner; the predicate itself is byte-identical.
const validPrefix = (out) => out.startsWith('⬡') || out.startsWith('🏠');
// The OLD frozen predicate, for regression proof.
const oldPrefix = (out) => out.startsWith('⬡ MindrianOS') || out.startsWith('🏠 MindrianOS');

let pass = 0, fail = 0;
const chk = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + label); } };

// The real, current renderer output (brand-hexagon-led; persona chip dropped by
// Ruling 1, binary 🧠on brain chip by Ruling 2, honest "Next: --" by Ruling 3c).
const live = '⬡ · 📂 MindrianOS ✅ · 🧠on · Next: -- · 📊 ░░░░░░░░░░ 0% · 🟢 · v1.15.0';
chk(validPrefix(live) === true,  'new validator ACCEPTS the brand-hexagon-led statusline');
chk(oldPrefix(live)  === false,  'old validator REJECTED it (this was the shipped bug)');

// Alt brand glyph + old word form still accepted.
chk(validPrefix('🏠 Larry · room') === true, 'accepts 🏠 brand lead');
chk(validPrefix('⬡ MindrianOS v1.15.0') === true, 'still accepts the classic ⬡ MindrianOS form');
// Genuine garbage is still rejected.
chk(validPrefix('Error: something broke') === false, 'rejects non-brand garbage');
chk(validPrefix('ExperimentalWarning: SQLite') === false, 'rejects a leaked node warning line');

// The class-G runner source carries the loosened predicate (guards against silent
// revert). Phase 217 Plan 05 relocated the validator from scripts/doctor.cjs into
// lib/core/doctor/statusline-visibility-module.cjs; the pin follows the code.
const src = require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','core','doctor','statusline-visibility-module.cjs'),'utf8');
chk(src.includes("out.startsWith('⬡') || out.startsWith('🏠')"), 'class-G runner carries the brand-hexagon validator');
chk(!src.includes("out.startsWith('⬡ MindrianOS')"), 'class-G runner no longer carries the frozen-word validator');

console.log(`\ndoctor statusline-prefix validator: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
