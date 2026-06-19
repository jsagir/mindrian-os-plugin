'use strict';
/*
 * Phase 164-06 Task 1 -- the Part 8 leak scan over ALL Phase-164 surfaces.
 *
 * Canon Part 8 (the security constitution): no Phase-164 surface may egress
 * user content to the Brain, open a raw external fetch in the lib code, or carry
 * a hardcoded external http(s) endpoint. Each BONO cell + the debate
 * consolidator carry GENERIC handles only; the rest is LOCAL graph + LOCAL
 * deterministic build. This scan is the leak-net the Phase 163/166/169 precedent
 * proved catches real findings: a forbidden token in any of these surfaces is a
 * canonical breach, surfaced as a finding, never silently swallowed.
 *
 * It mirrors the run-all-166.sh / run-all-169.sh BRAIN_WRITE + RAW_FETCH +
 * external-http regex idiom (the same forbidden-token vocabulary), with comment
 * filtering so a doc comment that names fetch( as prose cannot self-invalidate
 * the count.
 *
 * THE BOUNDARY DIRECTION (Canon Part 8): LOCAL -> BRAIN is the breach; BRAIN
 * methodology -> LOCAL is ALLOWED. A documented Brain READ (brain_query /
 * brain_search / brain_schema / brain_framework_chain / brain_find_patterns)
 * carrying generic framework handles is the SANCTIONED Mode A path (Canon Part 2
 * TOOL ACCESS REMOTE BRAIN; Part 8 "Allowed Brain queries carry only generic
 * framework handles"). The canonical breach the scan catches is a Brain-WRITE
 * (mcp__brain_write/store/upsert/ingest or a write-to-Brain helper) -- a code
 * path that writes user-specific bytes to the Brain -- NOT a read host. So the
 * Brain-write token is checked across EVERY surface; the Brain-host / brain-client
 * REQUIRE check (a smuggled egress wire) is scoped to lib/script code ONLY, where
 * such a wire would live -- never over a command/agent markdown that legitimately
 * documents a generic-handle Brain read.
 *
 * EXEMPTIONS (mirroring run-all-169.sh):
 *   - api.anthropic.com is the SHIPPED Part-8-LEGAL LOCAL LLM transport (the
 *     Canon Part 8 boundary covers ONLY the Mindrian-owned Brain MCP host, NOT a
 *     stateless LLM transport). A file carrying it is exempt from the raw-fetch +
 *     external-http bans.
 *   - github.com is the repo host (never a runtime egress).
 *
 * The scan exits non-zero printing the offending file + token if ANY surface
 * carries a forbidden token. House rule: hyphens only, no em-dashes; node
 * built-ins only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ALL Phase-164 lib + command + agent surfaces. A surface absent at scan time is
// reported as a finding (a registered surface must exist by the verify wave).
const SURFACES = [
  'lib/core/bono/cell-fanout.cjs',
  'lib/core/bono/debate-composition.cjs',
  'lib/core/issue-tree.cjs',
  'lib/core/navigation/synthetic-expert.cjs',
  'lib/core/expert-library.cjs',
  'commands/bono.md',
  'commands/diagnose.md',
  'agents/persona-analyst.md',
];

// The lib/script surfaces ONLY -- the subset where a smuggled egress wire (a
// brain-client require, a Brain-host URL) could live. A command/agent markdown
// that documents a generic-handle Brain READ is NOT in this set (a read is the
// Part-8-LEGAL Mode A path, never an egress wire).
const LIB_SURFACES = new Set([
  'lib/core/bono/cell-fanout.cjs',
  'lib/core/bono/debate-composition.cjs',
  'lib/core/issue-tree.cjs',
  'lib/core/navigation/synthetic-expert.cjs',
  'lib/core/expert-library.cjs',
]);

// The canonical Part 8 breach: a Brain-write MCP call / a write-to-Brain helper.
const BRAIN_WRITE = /mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain/;
// The REAL Part 8 boundary host: the Mindrian-owned Brain MCP host (never
// api.anthropic.com). A brain-host substring / brain-client require is the breach.
const BRAIN_HOST = /mindrian-brain|brain\.mindrian|brain-client|brainClient/;
// A raw external fetch( in lib/script code. The leading char class excludes
// .fetchCorpus on a caller object (the Part-8-legal research-corpus delegation).
const RAW_FETCH = /[^a-zA-Z_.]fetch[[:space]]*\(/; // refined below per-line
const RAW_FETCH_RX = /[^a-zA-Z_.]fetch\s*\(/;
// A hardcoded external http(s) endpoint.
const EXTERNAL_HTTP = /https?:\/\//;
const ANTHROPIC_EXEMPT = /api\.anthropic\.com/;
const GITHUB_EXEMPT = /github\.com/;

// A CJS / markdown comment line lead so prose naming a forbidden token cannot
// self-invalidate the count (mirrors the run-all grep -v '^#' filtering).
function isCommentLine(line) {
  const t = line.trim();
  return t.length === 0
    || t.indexOf('//') === 0
    || t.indexOf('*') === 0
    || t.indexOf('/*') === 0
    || t.indexOf('#') === 0
    || t.indexOf('<!--') === 0;
}

const findings = [];
function record(check, passed, detail) {
  findings.push({ check: check, passed: !!passed, detail: detail });
}

for (const rel of SURFACES) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    record('surface present: ' + rel, false, 'registered Phase-164 surface is missing');
    continue;
  }
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split('\n');
  const fileHasAnthropic = ANTHROPIC_EXEMPT.test(src);
  const isLib = LIB_SURFACES.has(rel);

  let brainWriteHit = null;
  let brainHostHit = null;
  let rawFetchHit = null;
  let externalHttpHit = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isCommentLine(line)) continue;

    // The Brain-WRITE token is the canonical breach across EVERY surface (a code
    // path that writes user bytes to the Brain). A Brain READ is NOT a write.
    if (!brainWriteHit && BRAIN_WRITE.test(line)) brainWriteHit = (i + 1) + ': ' + line.trim().slice(0, 80);

    // The smuggled-egress-wire check (a Brain-host URL / brain-client require) is
    // lib/script ONLY -- a command/agent markdown documenting a generic Brain read
    // is the Part-8-legal Mode A path, not an egress wire.
    if (isLib && !brainHostHit && BRAIN_HOST.test(line)) brainHostHit = (i + 1) + ': ' + line.trim().slice(0, 80);

    // The raw-fetch ban is lib-only and lifted on a file that carries the anthropic
    // transport (the Part-8-legal LOCAL LLM path).
    if (isLib && !fileHasAnthropic && !rawFetchHit && RAW_FETCH_RX.test(line)) {
      rawFetchHit = (i + 1) + ': ' + line.trim().slice(0, 80);
    }

    // The external-http ban is lib-only (a command/agent markdown may cite a public
    // SIGNAL/source URL as documentation); it exempts api.anthropic.com + github.com.
    if (isLib && !externalHttpHit && EXTERNAL_HTTP.test(line)
        && !ANTHROPIC_EXEMPT.test(line) && !GITHUB_EXEMPT.test(line)) {
      externalHttpHit = (i + 1) + ': ' + line.trim().slice(0, 80);
    }
  }

  // The Brain-WRITE check fires on EVERY surface.
  record('no Brain-write token: ' + rel, !brainWriteHit,
    brainWriteHit ? ('FORBIDDEN Brain-write at ' + brainWriteHit) : 'zero Brain-write tokens');
  // The egress-wire checks fire on lib/script surfaces only.
  if (isLib) {
    record('no Brain-host egress wire: ' + rel, !brainHostHit,
      brainHostHit ? ('FORBIDDEN Brain-host wire at ' + brainHostHit) : 'zero Brain-host egress wires');
    record('no raw external fetch( : ' + rel, !rawFetchHit,
      rawFetchHit ? ('FORBIDDEN raw fetch( at ' + rawFetchHit)
        : (fileHasAnthropic ? 'raw-fetch ban exempt (anthropic LLM transport present)' : 'zero raw fetch( egress'));
    record('no external http(s) endpoint: ' + rel, !externalHttpHit,
      externalHttpHit ? ('FORBIDDEN external http(s) at ' + externalHttpHit) : 'zero external http(s) endpoints');
  }
}

// Reference RAW_FETCH so a linter does not flag the documented (unused) literal.
void RAW_FETCH;

(function main() {
  const passedAll = findings.every((f) => f.passed);
  process.stdout.write('bono Part 8 leak scan\n');
  process.stdout.write('=====================\n');
  for (const f of findings) {
    process.stdout.write((f.passed ? '  PASS ' : '  FAIL ') + f.check + '\n');
    if (!f.passed) process.stdout.write('       ' + f.detail + '\n');
  }
  process.stdout.write('\n');
  process.stdout.write('VERDICT: ' + JSON.stringify({
    passed: passedAll, checks: findings.length, failed: findings.filter((f) => !f.passed).length,
  }) + '\n');
  if (!passedAll) process.exit(1);
  process.exit(0);
})();
