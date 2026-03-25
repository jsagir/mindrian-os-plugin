/**
 * MindrianOS Plugin -- Opportunity Bank + Funding Operations
 * Core operations for opportunity-bank/ and funding/ room sections.
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { discoverSections } = require('./section-registry.cjs');

/**
 * Parse YAML frontmatter from a markdown string.
 * Simple regex/split parsing (no yaml library -- follows existing codebase pattern).
 * Handles scalar values, simple lists (- item), and nested objects.
 *
 * @param {string} content - Markdown file content
 * @returns {Object} Parsed frontmatter key-value pairs
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') return {};

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result = {};
  const lines = yaml.split('\n');

  let currentKey = null;
  let currentList = null;
  let currentObj = null;
  let currentObjKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level key: value
    const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (topMatch) {
      // Flush any pending list/object
      if (currentList !== null && currentKey) {
        result[currentKey] = currentList;
        currentList = null;
      }
      if (currentObj !== null && currentObjKey !== null) {
        if (!result[currentKey]) result[currentKey] = [];
        result[currentKey].push(currentObj);
        currentObj = null;
        currentObjKey = null;
      }

      currentKey = topMatch[1];
      const val = topMatch[2].trim();

      if (val === '' || val === 'null') {
        // Could be a list or object starting on next line
        result[currentKey] = null;
      } else if (val === 'true') {
        result[currentKey] = true;
      } else if (val === 'false') {
        result[currentKey] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        result[currentKey] = parseFloat(val);
      } else {
        // Remove surrounding quotes if present
        result[currentKey] = val.replace(/^["']|["']$/g, '');
      }
      continue;
    }

    // List item (  - value)
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      if (currentList === null) currentList = [];

      const itemVal = listMatch[1].trim();

      // Check if this is a nested object field (  - key: value)
      const nestedMatch = itemVal.match(/^([a-z_]+):\s*(.+)$/);
      if (nestedMatch) {
        // Flush previous object if starting a new one
        if (currentObj !== null) {
          if (!Array.isArray(result[currentKey])) result[currentKey] = [];
          result[currentKey].push(currentObj);
        }
        currentObj = {};
        currentObjKey = currentKey;
        currentObj[nestedMatch[1]] = nestedMatch[2].replace(/^["']|["']$/g, '').trim();
      } else {
        // Simple list item
        currentList.push(itemVal.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Nested object field (    key: value) -- continuation of a list object
    const nestedFieldMatch = line.match(/^\s{4,}([a-z_]+):\s*(.+)$/);
    if (nestedFieldMatch && currentObj !== null) {
      currentObj[nestedFieldMatch[1]] = nestedFieldMatch[2].replace(/^["']|["']$/g, '').trim();
      continue;
    }
  }

  // Flush any pending list/object
  if (currentList !== null && currentKey) {
    result[currentKey] = currentList;
  }
  if (currentObj !== null && currentKey) {
    if (!Array.isArray(result[currentKey])) result[currentKey] = [];
    result[currentKey].push(currentObj);
  }

  return result;
}

/**
 * Parse opportunity artifact frontmatter.
 * @param {string} content - Opportunity markdown file content
 * @returns {Object} Parsed opportunity fields
 */
function parseOpportunityFrontmatter(content) {
  return parseFrontmatter(content);
}

/**
 * Parse funding STATUS.md frontmatter.
 * @param {string} content - STATUS.md file content
 * @returns {{ stage: string|null, outcome: string|null, source_opportunity: string|null, deadline: string|null, last_updated: string|null, transition_history: Array|null }}
 */
function parseFundingStatus(content) {
  const fm = parseFrontmatter(content);
  return {
    stage: fm.stage || null,
    outcome: fm.outcome || null,
    source_opportunity: fm.source_opportunity || null,
    deadline: fm.deadline || null,
    last_updated: fm.last_updated || null,
    transition_history: fm.transition_history || null,
  };
}

/**
 * List opportunities in room/opportunity-bank/.
 * Scans for .md files (excluding STATE.md), parses frontmatter for each.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ opportunities: Array<{filename, funder, program, deadline, relevance_score, status}>, count: number }}
 */
function listOpportunities(roomDir) {
  const oppDir = path.join(path.resolve(roomDir), 'opportunity-bank');
  if (!fs.existsSync(oppDir)) return { opportunities: [], count: 0 };

  let files;
  try {
    files = fs.readdirSync(oppDir).filter(f => f.endsWith('.md') && f !== 'STATE.md');
  } catch (e) {
    return { opportunities: [], count: 0 };
  }

  const opportunities = files.map(filename => {
    const filePath = path.join(oppDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fm = parseOpportunityFrontmatter(content);
      return {
        filename,
        funder: fm.funder || null,
        program: fm.program || null,
        deadline: fm.deadline || null,
        relevance_score: fm.relevance_score != null ? fm.relevance_score : null,
        status: fm.status || null,
      };
    } catch (e) {
      return { filename, funder: null, program: null, deadline: null, relevance_score: null, status: null };
    }
  });

  return { opportunities, count: opportunities.length };
}

/**
 * List funding entries in room/funding/.
 * Scans for subdirectories, reads STATUS.md from each.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ entries: Array<{name, stage, outcome, deadline, source_opportunity}>, count: number }}
 */
function listFunding(roomDir) {
  const fundDir = path.join(path.resolve(roomDir), 'funding');
  if (!fs.existsSync(fundDir)) return { entries: [], count: 0 };

  let dirEntries;
  try {
    dirEntries = fs.readdirSync(fundDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'));
  } catch (e) {
    return { entries: [], count: 0 };
  }

  const entries = dirEntries.map(entry => {
    const statusPath = path.join(fundDir, entry.name, 'STATUS.md');
    try {
      const content = fs.readFileSync(statusPath, 'utf-8');
      const st = parseFundingStatus(content);
      return {
        name: entry.name,
        stage: st.stage,
        outcome: st.outcome,
        deadline: st.deadline,
        source_opportunity: st.source_opportunity,
      };
    } catch (e) {
      return { name: entry.name, stage: null, outcome: null, deadline: null, source_opportunity: null };
    }
  });

  return { entries, count: entries.length };
}

/**
 * Read opportunity-bank/STATE.md content.
 * @param {string} roomDir - Path to room directory
 * @returns {string|null} STATE.md content or null if missing
 */
function getOpportunityBankState(roomDir) {
  const statePath = path.join(path.resolve(roomDir), 'opportunity-bank', 'STATE.md');
  try {
    return fs.readFileSync(statePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

/**
 * Read funding/STATE.md content.
 * @param {string} roomDir - Path to room directory
 * @returns {string|null} STATE.md content or null if missing
 */
function getFundingState(roomDir) {
  const statePath = path.join(path.resolve(roomDir), 'funding', 'STATE.md');
  try {
    return fs.readFileSync(statePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Domain-to-funding-category mapping for API queries
// ---------------------------------------------------------------------------
const DOMAIN_CATEGORY_MAP = {
  'artificial-intelligence': 'ST',
  'machine-learning': 'ST',
  'natural-language-processing': 'ST',
  'software': 'ST',
  'robotics': 'ST',
  'biotech': 'HL',
  'health': 'HL',
  'healthcare': 'HL',
  'medical': 'HL',
  'clean-energy': 'EN',
  'energy': 'EN',
  'climate': 'EN',
  'environment': 'ENV',
  'education': 'ED',
  'agriculture': 'AG',
  'food': 'AG',
  'transportation': 'T',
  'infrastructure': 'ISS',
  'housing': 'HU',
  'community-development': 'CD',
};

// Geography to eligibility mapping
const GEO_ELIGIBILITY_MAP = {
  'United States': ['us-entity'],
  'US': ['us-entity'],
  'Israel': ['international'],
  'EU': ['international'],
  'UK': ['international'],
};

/**
 * Build a grant query from room context.
 * Reads room STATE.md, problem-definition/ for domain context.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ keyword: string, fundingCategories: string[], eligibilities: string[], geography: string, ventureStage: string } | { insufficient: true, reason: string }}
 */
function buildGrantQuery(roomDir) {
  const resolved = path.resolve(roomDir);

  // Read room STATE.md for venture context
  const statePath = path.join(resolved, 'STATE.md');
  let stateContent = '';
  try {
    stateContent = fs.readFileSync(statePath, 'utf-8');
  } catch (_e) {
    // No state file
  }

  const stateFm = parseFrontmatter(stateContent);

  // Read problem-definition for domain context
  const probDir = path.join(resolved, 'problem-definition');
  let problemText = '';
  if (fs.existsSync(probDir)) {
    try {
      const files = fs.readdirSync(probDir).filter(f => f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md');
      for (const f of files) {
        try {
          problemText += ' ' + fs.readFileSync(path.join(probDir, f), 'utf-8');
        } catch (_e) { /* skip */ }
      }
    } catch (_e) { /* skip */ }
  }

  // Check for sufficient context
  const domainKeywords = stateFm.domain_keywords || [];
  if ((!domainKeywords || domainKeywords.length === 0) && problemText.trim().length < 50) {
    return {
      insufficient: true,
      reason: 'Room needs domain_keywords in STATE.md or content in problem-definition/ for context-driven grant discovery. Add your venture domain, geography, and team type to STATE.md.',
    };
  }

  // Build keyword from domain keywords + problem text extraction
  const keywordParts = Array.isArray(domainKeywords) ? [...domainKeywords] : [];

  // Extract key terms from problem text (first 200 chars of body, after frontmatter)
  if (problemText) {
    const body = problemText.replace(/^---[\s\S]*?---/, '').trim();
    const firstSentence = body.split(/[.!?\n]/).filter(s => s.trim().length > 10)[0] || '';
    if (firstSentence) {
      // Extract significant words (5+ chars, not common words)
      const stopWords = new Set(['about', 'their', 'these', 'those', 'which', 'where', 'through', 'between', 'using', 'based', 'should', 'would', 'could']);
      const terms = firstSentence.toLowerCase().match(/[a-z]{5,}/g) || [];
      const significant = terms.filter(t => !stopWords.has(t)).slice(0, 3);
      keywordParts.push(...significant);
    }
  }

  // Deduplicate and build keyword string (max 100 chars for API compat)
  const uniqueKeywords = [...new Set(keywordParts)];
  let keyword = uniqueKeywords.join(' ');
  if (keyword.length > 100) keyword = keyword.slice(0, 97) + '...';

  // Map domain keywords to funding categories
  const fundingCategories = [];
  for (const kw of (Array.isArray(domainKeywords) ? domainKeywords : [])) {
    const cat = DOMAIN_CATEGORY_MAP[kw];
    if (cat && !fundingCategories.includes(cat)) fundingCategories.push(cat);
  }

  // Geography and eligibility
  const geography = stateFm.geography || 'United States';
  const eligibilities = GEO_ELIGIBILITY_MAP[geography] || [];

  // Venture stage
  const ventureStage = stateFm.venture_stage || 'unknown';

  return {
    keyword,
    fundingCategories,
    eligibilities,
    geography,
    ventureStage,
  };
}

/**
 * Search Grants.gov API (v1).
 * POST to https://api.grants.gov/v1/api/search2.
 *
 * @param {{ keyword: string, fundingCategories?: string[] }} query
 * @returns {Promise<{ results: Array, error: string|null }>}
 */
async function searchGrantsGov(query) {
  const url = 'https://api.grants.gov/v1/api/search2';
  const body = {
    keyword: query.keyword || '',
    oppStatuses: 'posted',
    rows: 25,
    sortBy: 'openDate|desc',
  };
  if (query.fundingCategories && query.fundingCategories.length > 0) {
    body.fundingCategories = query.fundingCategories.join('|');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { results: [], error: `Grants.gov API returned ${resp.status}` };
    }

    const data = await resp.json();
    const hits = (data.oppHits || []).map(h => ({
      title: h.title || h.oppTitle || '',
      funder: h.agencyName || h.agency || '',
      program: h.oppNumber || '',
      amount: h.awardCeiling || null,
      deadline: h.closeDate || null,
      source: 'grants-gov',
      source_url: `https://grants.gov/search-results-detail/${h.id || h.oppId || ''}`,
      opportunity_id: h.oppNumber || h.id || '',
    }));

    return { results: hits, error: null };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Grants.gov API timeout (10s)' : `Grants.gov API error: ${e.message}`;
    return { results: [], error: msg };
  }
}

/**
 * Search Simpler Grants API.
 * POST to https://api.simpler.grants.gov/v1/opportunities/search.
 *
 * @param {{ keyword: string }} query
 * @returns {Promise<{ results: Array, error: string|null }>}
 */
async function searchSimplerGrants(query) {
  const url = 'https://api.simpler.grants.gov/v1/opportunities/search';
  const keyword = (query.keyword || '').slice(0, 100);
  const body = {
    query: keyword,
    filters: { opportunity_status: { one_of: ['posted'] } },
    pagination: { page_size: 25, sort_by: [{ order_by: 'relevancy' }] },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { results: [], error: `Simpler Grants API returned ${resp.status}` };
    }

    const data = await resp.json();
    const items = (data.data || []).map(item => ({
      title: item.opportunity_title || '',
      funder: item.agency_name || item.agency || '',
      program: item.opportunity_number || '',
      amount: item.award_ceiling || null,
      deadline: item.close_date || null,
      source: 'simpler-grants',
      source_url: `https://simpler.grants.gov/opportunity/${item.opportunity_id || ''}`,
      opportunity_id: item.opportunity_number || item.opportunity_id || '',
    }));

    return { results: items, error: null };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Simpler Grants API timeout (10s)' : `Simpler Grants API error: ${e.message}`;
    return { results: [], error: msg };
  }
}

/**
 * Compute relevance score for an opportunity against room context.
 *
 * @param {Object} opp - Opportunity data (title, funder, program, etc.)
 * @param {Object} queryContext - Output from buildGrantQuery
 * @returns {{ score: number, reasoning: string }}
 */
function computeRelevance(opp, queryContext) {
  let score = 0;
  const reasons = [];

  // Domain fit: check if title/program contains domain keywords
  const titleLower = ((opp.title || '') + ' ' + (opp.program || '')).toLowerCase();
  const keywords = queryContext.keyword ? queryContext.keyword.toLowerCase().split(/\s+/) : [];
  let domainHits = 0;
  for (const kw of keywords) {
    if (kw.length >= 4 && titleLower.includes(kw)) domainHits++;
  }
  if (domainHits >= 2) {
    score += 0.35;
    reasons.push('Strong domain keyword match');
  } else if (domainHits >= 1) {
    score += 0.2;
    reasons.push('Partial domain keyword match');
  }

  // Eligibility check (if geography matches)
  if (queryContext.geography === 'United States') {
    score += 0.15;
    reasons.push('US entity eligible');
  }

  // Has deadline (actionable)
  if (opp.deadline) {
    score += 0.1;
    reasons.push('Has defined deadline');
  }

  // Has funding amount (quantifiable)
  if (opp.amount && opp.amount > 0) {
    score += 0.1;
    reasons.push('Funding amount specified');
  }

  // Stage match: early-stage grants (SBIR/STTR/seed) match pre-revenue
  if (queryContext.ventureStage && /pre-revenue|seed|early/i.test(queryContext.ventureStage)) {
    if (/sbir|sttr|seed|phase\s*i|early.stage/i.test(titleLower)) {
      score += 0.2;
      reasons.push('Stage-appropriate (early-stage grant)');
    }
  }

  // Baseline relevance (it was returned by keyword search)
  score += 0.1;

  // Cap at 1.0
  score = Math.min(1.0, Math.round(score * 100) / 100);

  return {
    score,
    reasoning: reasons.join('. ') || 'Returned by keyword search',
  };
}

/**
 * Scan for opportunities using room context.
 * Calls buildGrantQuery, then both grant APIs, merges + deduplicates + scores.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ query_context: Object, results: Array, api_errors: string[] }>}
 */
async function scanOpportunities(roomDir) {
  const queryContext = buildGrantQuery(roomDir);

  if (queryContext.insufficient) {
    return {
      query_context: queryContext,
      results: [],
      api_errors: [],
    };
  }

  // Call both APIs concurrently
  const [grantsGovResult, simplerResult] = await Promise.allSettled([
    searchGrantsGov(queryContext),
    searchSimplerGrants(queryContext),
  ]);

  const allResults = [];
  const apiErrors = [];

  // Collect Grants.gov results
  if (grantsGovResult.status === 'fulfilled') {
    allResults.push(...grantsGovResult.value.results);
    if (grantsGovResult.value.error) apiErrors.push(grantsGovResult.value.error);
  } else {
    apiErrors.push(`Grants.gov: ${grantsGovResult.reason}`);
  }

  // Collect Simpler Grants results
  if (simplerResult.status === 'fulfilled') {
    allResults.push(...simplerResult.value.results);
    if (simplerResult.value.error) apiErrors.push(simplerResult.value.error);
  } else {
    apiErrors.push(`Simpler Grants: ${simplerResult.reason}`);
  }

  // Deduplicate by opportunity_id (prefer first seen)
  const seen = new Set();
  const deduped = [];
  for (const opp of allResults) {
    const key = opp.opportunity_id || opp.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(opp);
  }

  // Compute relevance scores
  const scored = deduped.map(opp => {
    const rel = computeRelevance(opp, queryContext);
    return {
      ...opp,
      relevance_score: rel.score,
      relevance_reasoning: rel.reasoning,
    };
  });

  // Sort by relevance descending
  scored.sort((a, b) => b.relevance_score - a.relevance_score);

  return {
    query_context: queryContext,
    results: scored,
    api_errors: apiErrors,
  };
}

/**
 * File an opportunity to room/opportunity-bank/.
 * Creates a dated artifact file following opportunity-template.md schema.
 *
 * @param {string} roomDir - Path to room directory
 * @param {Object} opportunityData - Opportunity data to file
 * @returns {{ filed: boolean, path: string }}
 */
function fileOpportunity(roomDir, opportunityData) {
  const resolved = path.resolve(roomDir);
  const oppDir = path.join(resolved, 'opportunity-bank');

  // Create directory if needed
  if (!fs.existsSync(oppDir)) {
    fs.mkdirSync(oppDir, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const slug = (opportunityData.program || opportunityData.title || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const filename = `${today}-${slug}.md`;
  const filePath = path.join(oppDir, filename);

  // Build frontmatter
  const fm = [
    '---',
    'methodology: opportunity-scan',
    `created: ${today}`,
    `source: ${opportunityData.source || 'manual'}`,
  ];
  if (opportunityData.source_url) fm.push(`source_url: ${opportunityData.source_url}`);
  if (opportunityData.opportunity_id) fm.push(`opportunity_id: "${opportunityData.opportunity_id}"`);
  fm.push(`funder: ${opportunityData.funder || 'Unknown'}`);
  fm.push(`program: ${opportunityData.program || opportunityData.title || 'Unknown'}`);
  fm.push(`amount_floor: ${opportunityData.amount_floor || 0}`);
  fm.push(`amount_ceiling: ${opportunityData.amount_ceiling || opportunityData.amount || 0}`);
  if (opportunityData.deadline) fm.push(`deadline: ${opportunityData.deadline}`);
  fm.push(`relevance_score: ${opportunityData.relevance_score || 0}`);
  fm.push(`relevance_reasoning: "${(opportunityData.relevance_reasoning || '').replace(/"/g, '\\"')}"`);
  fm.push('status: filed');
  fm.push('rejection: null');
  fm.push('---');

  // Build body
  const body = [
    '',
    `# ${opportunityData.title || opportunityData.program || 'Opportunity'}`,
    '',
    '## Overview',
    '',
    `Filed from ${opportunityData.source || 'manual'} scan on ${today}.`,
  ];
  if (opportunityData.funder) body.push(`Funder: ${opportunityData.funder}`);
  if (opportunityData.amount) body.push(`Award: up to $${Number(opportunityData.amount).toLocaleString()}`);
  if (opportunityData.deadline) body.push(`Deadline: ${opportunityData.deadline}`);

  const content = fm.join('\n') + '\n' + body.join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');

  return { filed: true, path: filePath };
}

/**
 * Reject an opportunity, capturing the reason as data.
 * Appends rejection record to opportunity-bank/STATE.md.
 *
 * @param {string} roomDir - Path to room directory
 * @param {Object} opportunityData - Opportunity data being rejected
 * @param {string} reason - Rejection reason (rejection IS data)
 * @returns {{ rejected: boolean, reason: string }}
 */
function rejectOpportunity(roomDir, opportunityData, reason) {
  const resolved = path.resolve(roomDir);
  const oppDir = path.join(resolved, 'opportunity-bank');

  // Create directory if needed
  if (!fs.existsSync(oppDir)) {
    fs.mkdirSync(oppDir, { recursive: true });
  }

  const statePath = path.join(oppDir, 'STATE.md');
  let stateContent = '';
  try {
    stateContent = fs.readFileSync(statePath, 'utf-8');
  } catch (_e) {
    stateContent = '---\nsection: opportunity-bank\n---\n\n# Opportunity Bank\n';
  }

  // Append rejection record
  const today = new Date().toISOString().split('T')[0];
  const title = opportunityData.title || opportunityData.program || 'Unknown';
  const record = `\n## Rejections\n\n- **${today}** -- ${title}: ${reason}\n`;

  if (stateContent.includes('## Rejections')) {
    // Append to existing rejections section
    stateContent = stateContent.replace(
      /(## Rejections\n)/,
      `$1\n- **${today}** -- ${title}: ${reason}\n`
    );
  } else {
    stateContent += record;
  }

  fs.writeFileSync(statePath, stateContent, 'utf-8');

  return { rejected: true, reason };
}

// ---------------------------------------------------------------------------
// Funding lifecycle stages (sequential, no skipping, no backward)
// ---------------------------------------------------------------------------
const FUNDING_STAGES = ['discovered', 'researched', 'applying', 'submitted'];
const VALID_OUTCOMES = ['awarded', 'rejected', 'withdrawn'];

/**
 * Create a funding entry from an opportunity-bank source.
 * Creates room/funding/{slug}/ with STATUS.md and metadata.yaml.
 *
 * @param {string} roomDir - Path to room directory
 * @param {string} slug - Slug for the funding folder name
 * @param {string} sourceOpportunityPath - Filename (without extension) of source in opportunity-bank
 * @returns {{ created: boolean, path: string, slug: string }}
 */
function createFunding(roomDir, slug, sourceOpportunityPath) {
  const resolved = path.resolve(roomDir);
  const fundDir = path.join(resolved, 'funding', slug);

  // Create directory tree if needed
  if (!fs.existsSync(fundDir)) {
    fs.mkdirSync(fundDir, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];

  // Read source opportunity for metadata
  const sourceFile = sourceOpportunityPath.endsWith('.md')
    ? sourceOpportunityPath
    : `${sourceOpportunityPath}.md`;
  const sourcePath = path.join(resolved, 'opportunity-bank', sourceFile);
  let sourceFm = {};
  try {
    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    sourceFm = parseFrontmatter(sourceContent);
  } catch (_e) {
    // Source may not exist — proceed with defaults
  }

  // Wikilink reference (without .md extension)
  const sourceRef = sourceOpportunityPath.replace(/\.md$/, '');

  // Build STATUS.md
  const statusContent = [
    '---',
    'stage: discovered',
    'outcome: null',
    `source_opportunity: "[[opportunity-bank/${sourceRef}]]"`,
    sourceFm.deadline ? `deadline: ${sourceFm.deadline}` : 'deadline: null',
    `last_updated: ${today}`,
    'transition_history:',
    '  - stage: discovered',
    `    date: ${today}`,
    '    note: "Created from opportunity scan"',
    '---',
    '',
    `# ${sourceFm.program || slug} -- Funding Lifecycle`,
    '',
    `## Current Stage: Discovered`,
    '',
    `Promoted from [[opportunity-bank/${sourceRef}]] on ${today}.`,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(fundDir, 'STATUS.md'), statusContent, 'utf-8');

  // Build metadata.yaml
  const metadataContent = [
    `funder: ${sourceFm.funder || 'Unknown'}`,
    `program: ${sourceFm.program || slug}`,
    `amount_floor: ${sourceFm.amount_floor || 0}`,
    `amount_ceiling: ${sourceFm.amount_ceiling || 0}`,
    `deadline: ${sourceFm.deadline || 'null'}`,
    `source_url: ${sourceFm.source_url || 'null'}`,
    `created: ${today}`,
  ].join('\n') + '\n';

  fs.writeFileSync(path.join(fundDir, 'metadata.yaml'), metadataContent, 'utf-8');

  return { created: true, path: fundDir, slug };
}

/**
 * Update a funding entry's stage.
 * Validates sequential stage transition (no skipping, no backward).
 *
 * @param {string} roomDir - Path to room directory
 * @param {string} slug - Funding entry slug
 * @param {string} newStage - Target stage
 * @param {string} [note] - Transition note
 * @returns {{ updated: boolean, previousStage?: string, newStage?: string, error?: string }}
 */
function updateFundingStage(roomDir, slug, newStage, note) {
  const resolved = path.resolve(roomDir);
  const statusPath = path.join(resolved, 'funding', slug, 'STATUS.md');

  let content;
  try {
    content = fs.readFileSync(statusPath, 'utf-8');
  } catch (_e) {
    return { updated: false, error: `Funding entry not found: ${slug}` };
  }

  const fm = parseFundingStatus(content);
  const currentStage = fm.stage;

  // Validate stage transition
  const currentIdx = FUNDING_STAGES.indexOf(currentStage);
  const newIdx = FUNDING_STAGES.indexOf(newStage);

  if (newIdx === -1) {
    return { updated: false, error: `Invalid stage: ${newStage}. Valid stages: ${FUNDING_STAGES.join(', ')}` };
  }
  if (currentIdx === -1) {
    return { updated: false, error: `Current stage unknown: ${currentStage}` };
  }
  if (newIdx !== currentIdx + 1) {
    return { updated: false, error: `Cannot transition from ${currentStage} to ${newStage}. Next valid stage: ${FUNDING_STAGES[currentIdx + 1] || 'none (already at final stage)'}` };
  }

  const today = new Date().toISOString().split('T')[0];
  const transitionNote = note || `Advanced to ${newStage}`;

  // Update frontmatter in content
  // Replace stage line
  content = content.replace(/^stage:\s*\S+/m, `stage: ${newStage}`);
  // Replace last_updated line
  content = content.replace(/^last_updated:\s*\S+/m, `last_updated: ${today}`);

  // Append to transition_history (insert before the closing ---)
  const historyEntry = `  - stage: ${newStage}\n    date: ${today}\n    note: "${transitionNote}"`;

  // Find the end of frontmatter and insert before it
  const fmEndMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmEndMatch) {
    const fmBody = fmEndMatch[1];
    const updatedFmBody = fmBody + '\n' + historyEntry;
    content = content.replace(fmEndMatch[0], `---\n${updatedFmBody}\n---`);
  }

  // Update body heading
  const stageTitle = newStage.charAt(0).toUpperCase() + newStage.slice(1);
  content = content.replace(/## Current Stage:\s*\S+/, `## Current Stage: ${stageTitle}`);

  fs.writeFileSync(statusPath, content, 'utf-8');

  return { updated: true, previousStage: currentStage, newStage };
}

/**
 * Set the outcome attribute on a funding entry.
 * Outcome is separate from stage per CONTEXT.md decision.
 *
 * @param {string} roomDir - Path to room directory
 * @param {string} slug - Funding entry slug
 * @param {string} outcome - One of: awarded, rejected, withdrawn
 * @returns {{ set: boolean, outcome?: string, error?: string }}
 */
function setFundingOutcome(roomDir, slug, outcome) {
  const resolved = path.resolve(roomDir);
  const statusPath = path.join(resolved, 'funding', slug, 'STATUS.md');

  if (!VALID_OUTCOMES.includes(outcome)) {
    return { set: false, error: `Invalid outcome: ${outcome}. Valid: ${VALID_OUTCOMES.join(', ')}` };
  }

  let content;
  try {
    content = fs.readFileSync(statusPath, 'utf-8');
  } catch (_e) {
    return { set: false, error: `Funding entry not found: ${slug}` };
  }

  const fm = parseFundingStatus(content);

  // 'awarded' and 'rejected' only valid after Submitted (or any stage for withdrawn)
  if (outcome !== 'withdrawn') {
    if (fm.stage !== 'submitted') {
      return { set: false, error: `Outcome '${outcome}' can only be set at 'submitted' stage (current: ${fm.stage}). Use 'withdrawn' to exit at any stage.` };
    }
  }

  const today = new Date().toISOString().split('T')[0];

  // Update outcome in frontmatter
  content = content.replace(/^outcome:\s*\S+/m, `outcome: ${outcome}`);
  content = content.replace(/^last_updated:\s*\S+/m, `last_updated: ${today}`);

  fs.writeFileSync(statusPath, content, 'utf-8');

  return { set: true, outcome };
}

/**
 * Compute and write funding/STATE.md from all funding entries.
 * Aggregates pipeline: count by stage, upcoming deadlines, stale entries.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ total: number, by_stage: Object, upcoming_deadlines: Array, stale_entries: Array }}
 */
function computeFundingState(roomDir) {
  const resolved = path.resolve(roomDir);
  const fundDir = path.join(resolved, 'funding');

  if (!fs.existsSync(fundDir)) {
    fs.mkdirSync(fundDir, { recursive: true });
  }

  const { entries, count } = listFunding(roomDir);

  const byStage = {};
  for (const stage of FUNDING_STAGES) byStage[stage] = 0;
  const upcomingDeadlines = [];
  const staleEntries = [];
  const today = new Date();
  const staleThreshold = 14; // days

  for (const entry of entries) {
    if (entry.stage && byStage[entry.stage] !== undefined) {
      byStage[entry.stage]++;
    }

    // Track upcoming deadlines
    if (entry.deadline) {
      const dl = new Date(entry.deadline);
      if (dl > today) {
        upcomingDeadlines.push({ name: entry.name, deadline: entry.deadline, stage: entry.stage });
      }
    }

    // Check staleness by reading last_updated from STATUS.md
    const statusPath = path.join(fundDir, entry.name, 'STATUS.md');
    try {
      const content = fs.readFileSync(statusPath, 'utf-8');
      const fm = parseFundingStatus(content);
      if (fm.last_updated) {
        const lastUpdate = new Date(fm.last_updated);
        const daysSince = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
        if (daysSince > staleThreshold) {
          staleEntries.push({ name: entry.name, stage: entry.stage, days_since_update: daysSince });
        }
      }
    } catch (_e) { /* skip */ }
  }

  // Sort deadlines by date ascending
  upcomingDeadlines.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  // Build STATE.md content
  const todayStr = today.toISOString().split('T')[0];
  const stateLines = [
    '---',
    'section: funding',
    `last_computed: ${todayStr}`,
    `total_entries: ${count}`,
    '---',
    '',
    '# Funding Pipeline',
    '',
    '## Pipeline Summary',
    '',
    `Total entries: ${count}`,
    '',
    '| Stage | Count |',
    '|-------|-------|',
  ];

  for (const stage of FUNDING_STAGES) {
    stateLines.push(`| ${stage} | ${byStage[stage]} |`);
  }

  if (upcomingDeadlines.length > 0) {
    stateLines.push('', '## Upcoming Deadlines', '');
    for (const d of upcomingDeadlines) {
      stateLines.push(`- **${d.deadline}** -- ${d.name} (${d.stage})`);
    }
  }

  if (staleEntries.length > 0) {
    stateLines.push('', '## Needs Attention (stale > 14 days)', '');
    for (const s of staleEntries) {
      stateLines.push(`- **${s.name}** -- ${s.days_since_update} days since update (${s.stage})`);
    }
  }

  stateLines.push('');

  fs.writeFileSync(path.join(fundDir, 'STATE.md'), stateLines.join('\n'), 'utf-8');

  return { total: count, by_stage: byStage, upcoming_deadlines: upcomingDeadlines, stale_entries: staleEntries };
}

/**
 * Compute and write opportunity-bank/STATE.md from all opportunity artifacts.
 * Aggregates: total, count by status, recent additions, top by relevance.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ total: number, by_status: Object, recent: Array, top_relevance: Array }}
 */
function computeOpportunityBankState(roomDir) {
  const resolved = path.resolve(roomDir);
  const oppDir = path.join(resolved, 'opportunity-bank');

  if (!fs.existsSync(oppDir)) {
    fs.mkdirSync(oppDir, { recursive: true });
  }

  const { opportunities, count } = listOpportunities(roomDir);

  const byStatus = {};
  const recent = [];
  const topRelevance = [];

  for (const opp of opportunities) {
    const status = opp.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Read created date from frontmatter
    const filePath = path.join(oppDir, opp.filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fm = parseFrontmatter(content);
      if (fm.created) {
        recent.push({ filename: opp.filename, created: fm.created, funder: opp.funder });
      }
    } catch (_e) { /* skip */ }

    if (opp.relevance_score != null) {
      topRelevance.push({ filename: opp.filename, relevance_score: opp.relevance_score, funder: opp.funder, program: opp.program });
    }
  }

  // Sort recent by date descending
  recent.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  // Sort top relevance descending
  topRelevance.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

  // Build STATE.md
  const todayStr = new Date().toISOString().split('T')[0];
  const stateLines = [
    '---',
    'section: opportunity-bank',
    `last_computed: ${todayStr}`,
    `total_opportunities: ${count}`,
    '---',
    '',
    '# Opportunity Bank',
    '',
    `## Summary`,
    '',
    `Total opportunities: ${count}`,
    '',
    '| Status | Count |',
    '|--------|-------|',
  ];

  for (const [status, cnt] of Object.entries(byStatus)) {
    stateLines.push(`| ${status} | ${cnt} |`);
  }

  if (recent.length > 0) {
    stateLines.push('', '## Recent Additions', '');
    for (const r of recent.slice(0, 5)) {
      stateLines.push(`- ${r.created} -- ${r.funder || r.filename}`);
    }
  }

  if (topRelevance.length > 0) {
    stateLines.push('', '## Top by Relevance', '');
    for (const t of topRelevance.slice(0, 5)) {
      stateLines.push(`- **${t.relevance_score}** -- ${t.program || t.filename} (${t.funder || 'Unknown'})`);
    }
  }

  stateLines.push('');

  fs.writeFileSync(path.join(oppDir, 'STATE.md'), stateLines.join('\n'), 'utf-8');

  return { total: count, by_status: byStatus, recent: recent.slice(0, 5), top_relevance: topRelevance.slice(0, 5) };
}

module.exports = {
  listOpportunities,
  listFunding,
  parseOpportunityFrontmatter,
  parseFundingStatus,
  getOpportunityBankState,
  getFundingState,
  buildGrantQuery,
  searchGrantsGov,
  searchSimplerGrants,
  scanOpportunities,
  fileOpportunity,
  rejectOpportunity,
  createFunding,
  updateFundingStage,
  setFundingOutcome,
  computeFundingState,
  computeOpportunityBankState,
  FUNDING_STAGES,
  VALID_OUTCOMES,
};
