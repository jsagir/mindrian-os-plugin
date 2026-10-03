// After `next build`: copy .next/static and public/ into the standalone output, which the standalone
// server serves neither of on its own, then strip the traced node_modules tree. RULE 8 forbids a vendored
// tree in the tarball; the navigator ruled 2026-10-03 that next, react and react-dom are root dependencies
// installed per machine, so server.js resolves them from the plugin root's node_modules. Run by `npm run build`.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const standalone = join(here, '.next', 'standalone');
if (!existsSync(join(standalone, 'server.js'))) {
  console.error('postbuild: no .next/standalone/server.js');
  process.exit(1);
}
if (existsSync(join(here, 'public'))) cpSync(join(here, 'public'), join(standalone, 'public'), { recursive: true });
mkdirSync(join(standalone, '.next'), { recursive: true });
rmSync(join(standalone, '.next', 'static'), { recursive: true, force: true });
cpSync(join(here, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });

// Strip every node_modules directory the file tracer left in the output (the top one and any nested).
function strip(dir) {
  let removed = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = join(dir, e.name);
    if (e.name === 'node_modules') {
      rmSync(p, { recursive: true, force: true });
      removed += 1;
    } else {
      removed += strip(p);
    }
  }
  return removed;
}
const stripped = strip(standalone);
console.log('postbuild: copied static into .next/standalone, stripped ' + stripped + ' node_modules director' + (stripped === 1 ? 'y' : 'ies'));
