'use strict';
// Test stub for rs-engine.cjs::discoverArtifacts: reads <room>/<section>/*.md, same artifact shape.
const fs = require('node:fs'); const path = require('node:path');
function discoverArtifacts(roomDir) {
  const out = [];
  for (const sec of fs.readdirSync(roomDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort()) {
    for (const f of fs.readdirSync(path.join(roomDir, sec)).filter((x) => x.endsWith('.md') && x !== 'WHITESPACE.md').sort()) {
      const raw = fs.readFileSync(path.join(roomDir, sec, f), 'utf8');
      const m = raw.match(/^# (.+)$/m);
      out.push({ id: sec + '/' + f.replace(/\.md$/, ''), section: sec, title: m ? m[1] : f, path: sec + '/' + f, text: raw.trim() });
    }
  }
  return out;
}
module.exports = { discoverArtifacts };
