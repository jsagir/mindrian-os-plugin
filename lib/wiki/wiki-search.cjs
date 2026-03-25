'use strict';
/**
 * wiki-search.cjs — FlexSearch full-text index for room wiki pages
 *
 * Builds an instant search index from scanRoom() page data.
 * Provides search with highlighted excerpts.
 */

const { Index } = require('flexsearch');

let searchIndex = null;
let pageStore = new Map(); // id -> { title, section, content }

/**
 * Build search index from pages Map (output of scanRoom).
 * @param {Map} pages - Map of pageId -> page object
 */
function buildSearchIndex(pages) {
  searchIndex = new Index({ tokenize: 'forward', resolution: 9 });
  pageStore = new Map();

  let numId = 0;
  const idToNum = new Map();
  const numToId = new Map();

  for (const [id, page] of pages) {
    // Strip markdown syntax for cleaner search text
    const plainContent = stripMarkdown(page.content);
    const searchText = `${page.title} ${plainContent}`;

    idToNum.set(id, numId);
    numToId.set(numId, id);
    searchIndex.add(numId, searchText);

    pageStore.set(id, {
      title: page.title,
      section: page.section,
      content: plainContent,
      numId
    });

    numId++;
  }

  // Store mapping for result enrichment
  searchIndex._numToId = numToId;
}

/**
 * Search the index and return enriched results.
 * @param {string} query - Search query
 * @param {number} [limit=20] - Max results
 * @returns {Array<{id, title, section, excerpt}>}
 */
function search(query, limit) {
  limit = limit || 20;
  if (!searchIndex || !query || !query.trim()) return [];

  const numResults = searchIndex.search(query, { limit });
  const results = [];

  for (const numId of numResults) {
    const id = searchIndex._numToId.get(numId);
    if (!id) continue;

    const stored = pageStore.get(id);
    if (!stored) continue;

    const excerpt = buildExcerpt(stored.content, query, 150);

    results.push({
      id,
      title: stored.title,
      section: stored.section,
      excerpt
    });
  }

  return results;
}

/**
 * Drop and rebuild the search index.
 * @param {Map} pages - Fresh pages Map
 */
function rebuildIndex(pages) {
  buildSearchIndex(pages);
}

/**
 * Build a 150-char excerpt around the first match with <mark> highlighting.
 */
function buildExcerpt(content, query, maxLen) {
  maxLen = maxLen || 150;
  const lower = content.toLowerCase();
  const queryLower = query.toLowerCase().trim();
  const pos = lower.indexOf(queryLower);

  let start, end, text;

  if (pos === -1) {
    // No exact match — show beginning of content
    text = content.slice(0, maxLen);
  } else {
    // Center the excerpt around the match
    const pad = Math.floor((maxLen - queryLower.length) / 2);
    start = Math.max(0, pos - pad);
    end = Math.min(content.length, start + maxLen);
    text = content.slice(start, end);
  }

  // Highlight all occurrences of query terms in excerpt
  const escaped = queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const highlighted = text.replace(re, '<mark>$1</mark>');

  const prefix = start && start > 0 ? '...' : '';
  const suffix = end && end < content.length ? '...' : '';

  return `${prefix}${highlighted}${suffix}`;
}

/**
 * Strip markdown syntax for search indexing.
 */
function stripMarkdown(text) {
  return text
    .replace(/^---[\s\S]*?---/, '')       // frontmatter
    .replace(/```[\s\S]*?```/g, '')       // code blocks
    .replace(/`[^`]+`/g, '')             // inline code
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links
    .replace(/\[\[([^\]]+)\]\]/g, '$1')       // wikilinks
    .replace(/#{1,6}\s+/g, '')               // headings
    .replace(/[*_~]+/g, '')                  // emphasis
    .replace(/[-|]+/g, ' ')                  // table separators
    .replace(/\n+/g, ' ')                   // newlines
    .replace(/\s+/g, ' ')                   // collapse spaces
    .trim();
}

module.exports = { buildSearchIndex, search, rebuildIndex };
