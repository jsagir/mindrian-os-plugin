#!/usr/bin/env node
'use strict';

/**
 * query-semantic-scholar.cjs -- Semantic Scholar External Corpus Fetcher
 * =======================================================================
 * Queries Semantic Scholar API based on room content keywords. Extracts
 * query terms from whitespace-embeddings.json artifact titles and
 * interpretation-results.json problem types/frameworks. Caches results
 * with 7-day TTL at room/.mindrian/external-corpus-cache.json.
 *
 * Usage:
 *   node scripts/query-semantic-scholar.cjs ROOM_DIR [--max-papers 50] [--force-refresh]
 *
 * Output:
 *   {room_dir}/.mindrian/external-papers.json
 *
 * API: GET https://api.semanticscholar.org/graph/v1/paper/search
 *   - Free, no auth needed for basic search
 *   - Rate limit: max 1 request per second
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { roomDir: null, maxPapers: 50, forceRefresh: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: node scripts/query-semantic-scholar.cjs ROOM_DIR [options]

Queries Semantic Scholar API based on room content keywords.
Fetches academic papers relevant to the room's domain for
cross-domain whitespace detection.

Arguments:
  ROOM_DIR              Path to room directory (required)

Options:
  --max-papers N        Maximum papers to fetch (default: 50)
  --force-refresh       Ignore cache, fetch fresh results
  --help, -h            Show this help message

Output:
  {ROOM_DIR}/.mindrian/external-papers.json
  {ROOM_DIR}/.mindrian/external-corpus-cache.json (cache with 7-day TTL)

API: Semantic Scholar (free, no authentication required)
`);
      process.exit(0);
    } else if (args[i] === '--max-papers' && args[i + 1]) {
      parsed.maxPapers = parseInt(args[i + 1], 10) || 50;
      i++;
    } else if (args[i] === '--force-refresh') {
      parsed.forceRefresh = true;
    } else if (!args[i].startsWith('--') && !parsed.roomDir) {
      parsed.roomDir = args[i];
    }
  }

  if (!parsed.roomDir) {
    console.error('Error: ROOM_DIR is required.\nRun with --help for usage.');
    process.exit(1);
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Keyword extraction from room data
// ---------------------------------------------------------------------------

/**
 * Extract keywords from whitespace-embeddings.json artifact titles/sections
 * and interpretation-results.json problem types/framework names.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {string[]} Array of query strings (3-5 queries)
 */
function extractRoomKeywords(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  const keywords = new Set();
  const phrases = [];

  // Source 1: whitespace-embeddings.json -- artifact titles and sections
  const embPath = path.join(mindrianDir, 'whitespace-embeddings.json');
  if (fs.existsSync(embPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(embPath, 'utf-8'));
      const embeddings = data.embeddings || [];
      for (const emb of embeddings) {
        if (emb.title) {
          // Extract meaningful words from titles (skip short/common words)
          const words = emb.title
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3)
            .map(w => w.toLowerCase());
          words.forEach(w => keywords.add(w));
        }
        if (emb.section) {
          // Section names are good domain indicators
          const sectionWords = emb.section
            .replace(/-/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3)
            .map(w => w.toLowerCase());
          sectionWords.forEach(w => keywords.add(w));
        }
      }
    } catch (e) {
      // Silently skip if file is malformed
    }
  }

  // Source 2: interpretation-results.json -- problem types and framework names
  const interpPath = path.join(mindrianDir, 'interpretation-results.json');
  if (fs.existsSync(interpPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(interpPath, 'utf-8'));

      // Extract problem types
      if (data.zones) {
        for (const zone of data.zones) {
          if (zone.problem_type) {
            phrases.push(zone.problem_type.replace(/-/g, ' '));
          }
          if (zone.nearest_frameworks) {
            for (const fw of zone.nearest_frameworks) {
              phrases.push(fw.replace(/-/g, ' '));
            }
          }
        }
      }

      // Extract framework names from gap interpretations
      if (data.gap_interpretations) {
        for (const gi of data.gap_interpretations) {
          if (gi.brain_framework) {
            phrases.push(gi.brain_framework.replace(/-/g, ' '));
          }
        }
      }
    } catch (e) {
      // Silently skip
    }
  }

  // Source 3: topic-forest labels if available
  const forestPath = path.join(mindrianDir, 'topic-forest.json');
  if (fs.existsSync(forestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(forestPath, 'utf-8'));
      if (data.topics) {
        for (const topic of data.topics) {
          if (topic.label) {
            phrases.push(topic.label);
          }
        }
      }
    } catch (e) {
      // Silently skip
    }
  }

  // Remove common stop words
  const stopWords = new Set([
    'about', 'after', 'also', 'analysis', 'before', 'between', 'could',
    'definition', 'design', 'does', 'each', 'first', 'from', 'have',
    'into', 'just', 'like', 'make', 'many', 'more', 'most', 'much',
    'need', 'only', 'other', 'over', 'should', 'some', 'such', 'than',
    'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
    'through', 'under', 'very', 'what', 'when', 'where', 'which',
    'while', 'will', 'with', 'would', 'your', 'been', 'being', 'both',
    'model', 'section', 'room', 'state', 'execution', 'team', 'plan',
  ]);

  const filteredKeywords = [...keywords].filter(w => !stopWords.has(w));

  // Build 3-5 query strings by grouping keywords
  const queryStrings = [];

  // Add phrase-based queries first (from interpretation + topic forest)
  const uniquePhrases = [...new Set(phrases)].slice(0, 3);
  for (const phrase of uniquePhrases) {
    queryStrings.push(phrase);
  }

  // Group remaining keywords into queries of 3-4 words
  const remaining = filteredKeywords.filter(
    w => !uniquePhrases.some(p => p.toLowerCase().includes(w))
  );

  for (let i = 0; i < remaining.length && queryStrings.length < 5; i += 3) {
    const group = remaining.slice(i, i + 3).join(' ');
    if (group.trim()) {
      queryStrings.push(group);
    }
  }

  // Fallback: if no keywords found, try room directory name
  if (queryStrings.length === 0) {
    const roomName = path.basename(roomDir).replace(/-/g, ' ');
    if (roomName.length > 3) {
      queryStrings.push(roomName);
    }
  }

  return queryStrings.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if cached data is still valid (within 7-day TTL).
 *
 * @param {string} cachePath - Path to cache file
 * @param {boolean} forceRefresh - If true, always return null
 * @returns {object|null} Cached data or null if expired/missing
 */
function checkCache(cachePath, forceRefresh) {
  if (forceRefresh) return null;
  if (!fs.existsSync(cachePath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const cacheTime = new Date(data.timestamp).getTime();
    const now = Date.now();

    if (now - cacheTime < CACHE_TTL_MS) {
      return data;
    }
  } catch (e) {
    // Corrupted cache, treat as miss
  }

  return null;
}

/**
 * Write cache file.
 *
 * @param {string} cachePath - Path to cache file
 * @param {string[]} queries - Query strings used
 * @param {object[]} papers - Fetched papers
 */
function writeCache(cachePath, queries, papers) {
  const data = {
    timestamp: new Date().toISOString(),
    queries,
    papers,
  };

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Semantic Scholar API
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.semanticscholar.org/graph/v1/paper/search';
const FIELDS = 'paperId,title,abstract,year,citationCount,fieldsOfStudy';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Sleep for specified milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Query Semantic Scholar API for a single query string.
 *
 * @param {string} query - Search query
 * @param {number} limit - Max results per query
 * @returns {Promise<object[]>} Array of paper objects
 */
async function searchPapers(query, limit = 10) {
  const url = `${API_BASE}?query=${encodeURIComponent(query)}&limit=${limit}&fields=${FIELDS}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MindrianOS/1.9.0 (whitespace-detection)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`  Rate limited on query "${query}", skipping`);
        return [];
      }
      console.error(`  API error ${response.status} for query "${query}", skipping`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error(`  Timeout on query "${query}" (${REQUEST_TIMEOUT_MS}ms), skipping`);
    } else {
      console.error(`  Network error on query "${query}": ${e.message}`);
    }
    return [];
  }
}

/**
 * Fetch papers across multiple queries, deduplicating by paperId.
 *
 * @param {string[]} queries - Array of query strings
 * @param {number} maxPapers - Total paper cap
 * @returns {Promise<object[]>} Deduplicated papers
 */
async function fetchAllPapers(queries, maxPapers) {
  const seen = new Set();
  const allPapers = [];

  const perQueryLimit = Math.ceil(maxPapers / Math.max(queries.length, 1));

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`  Query ${i + 1}/${queries.length}: "${query}"`);

    const papers = await searchPapers(query, Math.min(perQueryLimit, 20));

    for (const paper of papers) {
      if (!paper.paperId || seen.has(paper.paperId)) continue;
      // Filter: require non-empty abstract and year >= 2015
      if (!paper.abstract || paper.abstract.length < 10) continue;
      if (paper.year && paper.year < 2015) continue;

      seen.add(paper.paperId);
      allPapers.push({
        paperId: paper.paperId,
        title: paper.title || '',
        abstract: paper.abstract,
        year: paper.year || null,
        citationCount: paper.citationCount || 0,
        fieldsOfStudy: paper.fieldsOfStudy || [],
      });

      if (allPapers.length >= maxPapers) break;
    }

    if (allPapers.length >= maxPapers) break;

    // Rate limit: 1 request per second
    if (i < queries.length - 1) {
      await sleep(1100);
    }
  }

  return allPapers;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { roomDir, maxPapers, forceRefresh } = parseArgs();

  // Validate room directory
  const resolvedRoom = path.resolve(roomDir);
  if (!fs.existsSync(resolvedRoom) || !fs.statSync(resolvedRoom).isDirectory()) {
    console.error(`Error: ${resolvedRoom} is not a directory`);
    process.exit(1);
  }

  const mindrianDir = path.join(resolvedRoom, '.mindrian');
  const cachePath = path.join(mindrianDir, 'external-corpus-cache.json');
  const outputPath = path.join(mindrianDir, 'external-papers.json');

  // Step 1: Check cache
  const cached = checkCache(cachePath, forceRefresh);
  if (cached) {
    const papers = cached.papers || [];
    console.log(`Semantic Scholar: ${papers.length} papers from cache (TTL: 7 days)`);
    console.log(`  Queries: ${(cached.queries || []).join('; ')}`);
    console.log(`  Cached at: ${cached.timestamp}`);

    // Write output from cache
    fs.mkdirSync(mindrianDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      source: 'semantic_scholar',
      timestamp: cached.timestamp,
      from_cache: true,
      papers,
    }, null, 2), 'utf-8');

    console.log(`  Output: ${outputPath}`);
    return;
  }

  // Step 2: Extract room keywords
  console.log('Semantic Scholar: extracting room keywords...');
  const queries = extractRoomKeywords(resolvedRoom);

  if (queries.length === 0) {
    console.log('No relevant papers found. Room may need more content first.');
    fs.mkdirSync(mindrianDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      source: 'semantic_scholar',
      timestamp: new Date().toISOString(),
      from_cache: false,
      papers: [],
    }, null, 2), 'utf-8');
    return;
  }

  console.log(`  Generated ${queries.length} queries from room content`);

  // Step 3: Query Semantic Scholar API
  console.log(`Fetching papers (max ${maxPapers})...`);

  let papers;
  try {
    papers = await fetchAllPapers(queries, maxPapers);
  } catch (e) {
    console.error(`\nNetwork error: Could not reach Semantic Scholar API.`);
    console.error(`  Error: ${e.message}`);
    console.error(`  If you have cached data, run without --force-refresh.`);

    // Write empty output
    fs.mkdirSync(mindrianDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      source: 'semantic_scholar',
      timestamp: new Date().toISOString(),
      from_cache: false,
      error: e.message,
      papers: [],
    }, null, 2), 'utf-8');
    return;
  }

  // Step 4: Write cache
  writeCache(cachePath, queries, papers);

  // Step 5: Write output
  fs.mkdirSync(mindrianDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    source: 'semantic_scholar',
    timestamp: new Date().toISOString(),
    from_cache: false,
    papers,
  }, null, 2), 'utf-8');

  // Summary
  console.log(`\nSemantic Scholar: ${papers.length} papers fetched across ${queries.length} queries`);
  if (papers.length > 0) {
    const fields = new Set();
    papers.forEach(p => (p.fieldsOfStudy || []).forEach(f => fields.add(f)));
    console.log(`  Fields: ${[...fields].slice(0, 10).join(', ') || 'none detected'}`);
    console.log(`  Year range: ${Math.min(...papers.filter(p => p.year).map(p => p.year))}-${Math.max(...papers.filter(p => p.year).map(p => p.year))}`);
    console.log(`  Top cited: "${papers.sort((a, b) => b.citationCount - a.citationCount)[0].title}" (${papers[0].citationCount} citations)`);
  }
  console.log(`  Cache: ${cachePath} (7-day TTL)`);
  console.log(`  Output: ${outputPath}`);
}

main().catch(e => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
});
