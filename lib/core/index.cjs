/**
 * MindrianOS Plugin — Shared Core Helpers
 * Pure Node.js built-ins only. No npm dependencies.
 *
 * Replicates the GSD gsd-tools.cjs output pattern:
 * - JSON to stdout for structured data
 * - Large payloads (>50KB) written to tmpfile with @file: prefix
 * - Errors to stderr with exit 1
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/** Root of the plugin repository */
const PLUGIN_ROOT = path.resolve(__dirname, '../..');

/**
 * Output structured result to stdout.
 * If raw mode, write rawValue directly.
 * Otherwise JSON-stringify; if >50KB, write to tmpfile with @file: prefix.
 */
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(os.tmpdir(), `mindrian-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

/**
 * Write error message to stderr and exit 1.
 */
function error(msg) {
  process.stderr.write('ERROR: ' + msg + '\n');
  process.exit(1);
}

/**
 * Read file contents safely. Returns string or null if not found.
 */
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

module.exports = { output, error, safeReadFile, PLUGIN_ROOT };
