#!/usr/bin/env node
'use strict';

/**
 * Phase 251 Plan 02, Task 2 (CACHE-03 analyzer) -- read-only cache hit-rate
 * report.
 * ==========================================================================
 * Usage: node scripts/cache-hitrate-report.cjs <session.jsonl> [--json]
 *
 * READ-ONLY: parses a session transcript JSONL and reports AGGREGATES ONLY
 * (counts, rates, byte totals) -- never attachment content, never user text
 * (T-251-06). This is what makes it safe to run against real
 * ~/.claude/projects transcripts and paste the output into tracked planning
 * artifacts. The script never writes anywhere.
 *
 * Parse method mirrors 251-CACHE-MEASUREMENT.md section 2 (its method
 * section is the spec):
 *   (a) UserPromptSubmit attachment entries -> NAV block count, consecutive
 *       byte-identical count (full blocks only), suppressed-marker count
 *       (NAV_UNCHANGED_MARKER imported from scripts/intent-classifier.cjs --
 *       single source of the literal).
 *   (b) per-request API usage records, deduplicated by requestId (first
 *       occurrence wins) -> cache_read / cache_creation / uncached input
 *       totals, hit rate, zero-cache-read request count.
 *   (c) sidechains (Task-tool sub-agent conversations) and any other line
 *       shape are skipped by construction (no branch matches them).
 *
 * Baseline contract: the CACHE-01 measured floor is 91.3% (worst sampled
 * session) with 2-3 zero-cache-read requests per session (session
 * start/compaction only, never injection turns). The 251-02 Task 3
 * checkpoint and any future Brain-reach verification runs THIS script so the
 * numbers stay comparable across time.
 *
 * CJS, zero dependencies, process.argv switch-router convention (the
 * gsd-tools.cjs pattern; no Commander, no yargs). No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const { NAV_UNCHANGED_MARKER } = require(path.join(__dirname, 'intent-classifier.cjs'));

function fail(message) {
  process.stderr.write('cache-hitrate-report: ' + message + '\n');
  process.exit(1);
}

// process.argv switch-router: no flags library, a plain loop with a
// switch on the token shape.
function parseArgs(argv) {
  let sessionPath = null;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--json':
        json = true;
        break;
      default:
        if (sessionPath === null) sessionPath = arg;
        break;
    }
  }
  return { sessionPath: sessionPath, json: json };
}

/**
 * Parses a session JSONL at sessionPath and returns an aggregates-only
 * report object. Throws on a missing path or a directory path; never
 * throws on malformed individual lines (skips them, real transcripts can
 * carry partial/unexpected lines).
 */
function analyzeSession(sessionPath) {
  let stat;
  try {
    stat = fs.statSync(sessionPath);
  } catch (_e) {
    throw new Error('cannot read session file: ' + sessionPath);
  }
  if (stat.isDirectory()) {
    throw new Error('path is a directory, not a session JSONL file: ' + sessionPath);
  }

  const raw = fs.readFileSync(sessionPath, 'utf8');
  const lines = raw.split('\n');

  let navBlocks = 0;
  let consecutiveIdentical = 0;
  let suppressedMarkers = 0;
  let prevFullContent = null;

  const seenRequestIds = new Set();
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let uncachedInputTokens = 0;
  let zeroCacheReadRequests = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch (_e) {
      continue; // malformed line, skip rather than crash on a real transcript
    }

    // Sidechains (Task-tool sub-agent conversations) are a separate agent
    // context, never counted against this session's main-turn cost.
    if (entry && entry.isSidechain) continue;

    if (entry && entry.type === 'attachment' && entry.hookEvent === 'UserPromptSubmit') {
      const content = entry.attachment && typeof entry.attachment.content === 'string'
        ? entry.attachment.content
        : '';
      navBlocks += 1;
      if (content === NAV_UNCHANGED_MARKER) {
        suppressedMarkers += 1;
      } else {
        if (prevFullContent !== null && content === prevFullContent) {
          consecutiveIdentical += 1;
        }
        prevFullContent = content;
      }
      continue;
    }

    if (entry && entry.type === 'assistant' && entry.message && entry.message.usage) {
      const requestId = entry.requestId;
      if (!requestId || seenRequestIds.has(requestId)) continue; // dedup: first occurrence wins
      seenRequestIds.add(requestId);

      const usage = entry.message.usage;
      const reads = Number(usage.cache_read_input_tokens) || 0;
      const writes = Number(usage.cache_creation_input_tokens) || 0;
      const uncached = Number(usage.input_tokens) || 0;

      cacheReadTokens += reads;
      cacheCreationTokens += writes;
      uncachedInputTokens += uncached;
      if (reads === 0) zeroCacheReadRequests += 1;
      continue;
    }

    // Any other line shape (user turns, tool_result lines, etc.) is skipped
    // by construction -- no branch above matches it.
  }

  const denominator = cacheReadTokens + cacheCreationTokens + uncachedInputTokens;
  const hitRate = denominator > 0 ? Math.round((cacheReadTokens / denominator) * 100) / 100 : 0;

  return {
    api_requests: seenRequestIds.size,
    hit_rate: hitRate,
    zero_cache_read_requests: zeroCacheReadRequests,
    nav_blocks: navBlocks,
    consecutive_identical: consecutiveIdentical,
    suppressed_markers: suppressedMarkers,
    cache_read_tokens: cacheReadTokens,
    cache_creation_tokens: cacheCreationTokens,
    uncached_input_tokens: uncachedInputTokens,
  };
}

function renderTable(report) {
  const lines = [
    'Cache Hit-Rate Report (aggregates only, no session content)',
    '=============================================================',
    'api_requests (deduped by requestId): ' + report.api_requests,
    'hit_rate: ' + report.hit_rate,
    'zero_cache_read_requests: ' + report.zero_cache_read_requests,
    'nav_blocks: ' + report.nav_blocks,
    'consecutive_identical: ' + report.consecutive_identical,
    'suppressed_markers: ' + report.suppressed_markers,
    'cache_read_tokens: ' + report.cache_read_tokens,
    'cache_creation_tokens: ' + report.cache_creation_tokens,
    'uncached_input_tokens: ' + report.uncached_input_tokens,
    '',
    'CACHE-01 measured floor: hit_rate >= 0.91 (worst sampled session); 2-3',
    'zero_cache_read_requests per session, attributable to session start /',
    'compaction only, never injection turns.',
  ];
  return lines.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const { sessionPath, json } = parseArgs(argv);
  if (!sessionPath) {
    fail('usage: node scripts/cache-hitrate-report.cjs <session.jsonl> [--json]');
    return;
  }

  let report;
  try {
    report = analyzeSession(sessionPath);
  } catch (e) {
    fail(e.message);
    return;
  }

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(renderTable(report) + '\n');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeSession: analyzeSession,
};
