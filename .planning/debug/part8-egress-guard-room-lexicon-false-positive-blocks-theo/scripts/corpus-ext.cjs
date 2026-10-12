'use strict';
// Extended generic-question corpus. No room text. Built from the shipped data only.
//   B: "explain <framework name>" for every name in data/framework-names.json (+ curated extras)
//   C: "how do I <command description>" for every command description in commands/*.md (filtered)
//   D: "what belongs in a <core section label>" for the 11 CORE_SECTIONS in lib/core/section-registry.cjs
const fs = require('node:fs');
const path = require('node:path');
const REPO = '/home/jsagi/dev/MindrianOS-Plugin';

function B() {
  const doc = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'framework-names.json'), 'utf8'));
  return [].concat(doc.framework_names, doc.curated_extras || []).map(function (n, i) { return { id: 'B' + (i + 1), kind: 'ext_framework', q: 'explain ' + n }; });
}
function C() {
  const dir = path.join(REPO, 'commands');
  const out = [];
  fs.readdirSync(dir).filter(function (f) { return f.endsWith('.md'); }).sort().forEach(function (f) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = t.match(/^description:\s*(.+)$/m);
    if (!m) return;
    let d = m[1].trim().replace(/^["']|["']$/g, '');
    if (d.length < 12 || d.length > 140) return;
    if (/[\/`<>@$]|\d{2,}/.test(d)) return;
    d = d.charAt(0).toLowerCase() + d.slice(1);
    out.push({ id: 'C' + (out.length + 1), kind: 'ext_command', q: 'how do I ' + d.replace(/\.$/, ''), src: f });
  });
  return out;
}
function D() {
  const txt = fs.readFileSync(path.join(REPO, 'lib', 'core', 'section-registry.cjs'), 'utf8');
  const labels = [];
  const re = /'([a-z-]+)':\s*\{\s*label:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(txt)) !== null && labels.length < 11) labels.push(m[2].toLowerCase().replace(/&/g, 'and'));
  return labels.map(function (l, i) { return { id: 'D' + (100 + i + 1), kind: 'ext_section', q: 'what belongs in a ' + l + ' section' }; });
}
const EXT = B().concat(C(), D());
module.exports = { EXT, B, C, D };
if (require.main === module) {
  const c = { B: B().length, C: C().length, D: D().length, total: EXT.length };
  process.stdout.write(JSON.stringify(c) + '\n');
  process.stdout.write(D().map(function (x) { return x.q; }).join('\n') + '\n');
}
