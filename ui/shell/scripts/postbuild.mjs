// After `next build`: copy .next/static and public/ into the standalone output, which the standalone
// server serves neither of on its own. Run by `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
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
console.log('postbuild: copied static into .next/standalone');
