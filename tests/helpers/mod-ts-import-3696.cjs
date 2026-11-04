'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 04 Task 2 (D-47, D-48; R-23, R-24). Import a /mos mod TypeScript module in a test process.
 *
 * WHY: the mod's sources (ui/mos-face/hooks/*.ts) and its built dist use relative imports with no file
 * extension (for example "./commands"). The Claude Code engine resolves them. Plain Node does not: it needs
 * the extension. This helper registers one resolve hook, through node:module register, that retries an
 * extensionless relative specifier with ".ts" and then "/index.ts". Node 22.18 or later strips the types
 * (the repo floor, CLAUDE.md), so no dependency and no build step is needed. Type-only imports are erased
 * before resolution, so the "claude-code" package is never loaded.
 *
 * Use: const { importModModule } = require('./helpers/mod-ts-import-3696.cjs');
 *      const advice = await importModModule('ui/mos-face/hooks/advice.ts');
 *
 * A module that cannot be resolved fails with the specifier named. Read-only: nothing is written, and no
 * mod source is changed (D-48). The mod is imported in a test process only.
 *
 * House rule: hyphens only.
 */

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const nodeModule = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');

// The resolve hook, as module source. It runs on the loader thread.
const HOOK_SOURCE = [
  'export async function resolve(specifier, context, nextResolve) {',
  '  try {',
  '    return await nextResolve(specifier, context);',
  '  } catch (err) {',
  "    const relative = specifier.startsWith('./') || specifier.startsWith('../');",
  '    const hasExt = /\\.[a-z0-9]+$/i.test(specifier);',
  '    if (relative && !hasExt) {',
  "      for (const suffix of ['.ts', '/index.ts']) {",
  '        try { return await nextResolve(specifier + suffix, context); } catch (inner) { /* try the next suffix */ }',
  '      }',
  '    }',
  '    throw err;',
  '  }',
  '}',
].join('\n');

let registered = false;
function register() {
  if (registered) return;
  if (typeof nodeModule.register !== 'function') {
    throw new Error('mod-ts-import-3696: node:module register is not available (Node 22.18 or later is required)');
  }
  nodeModule.register('data:text/javascript,' + encodeURIComponent(HOOK_SOURCE), pathToFileURL(__filename));
  registered = true;
}

// Import a repo-relative .ts module. Returns the module namespace. A failure names the specifier.
async function importModModule(relPath) {
  register();
  const abs = path.resolve(ROOT, relPath);
  try {
    return await import(pathToFileURL(abs).href);
  } catch (err) {
    const e = new Error('importModModule failed for ' + relPath + ': ' + (err && err.message ? err.message : String(err)));
    e.cause = err;
    throw e;
  }
}

module.exports = { importModModule };
