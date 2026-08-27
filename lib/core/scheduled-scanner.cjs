'use strict';

/**
 * MindrianOS Plugin -- Scheduled Scanner (SCHED-03, SCHED-04, SCHED-05, SCHED-07)
 *
 * Three scanning capabilities for proactive intelligence:
 *   1. Competitor analysis - web search for room domain competitors
 *   2. Grant discovery - extends opportunity-ops.scanOpportunities
 *   3. Context-relevant news - web search for venture domain developments
 *
 * All results filed to room/intelligence/ with provenance timestamps.
 * Designed to be called by Cowork scheduled tasks (commands/scheduled-tasks.md).
 *
 * Note: Web search functions return structured query objects for the LLM to
 * execute via WebSearch/Tavily tools. The scanner module handles filing results,
 * not the search execution itself (since search tools are LLM-invoked).
 *
 * @module scheduled-scanner
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Parse simple YAML frontmatter from markdown.
 * @param {string} content
 * @returns {Object}
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') return {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/);
    if (kv) {
      const val = kv[2].trim().replace(/^["']|["']$/g, '');
      result[kv[1]] = val;
    }
  }
  return result;
}

/**
 * Ensure directory exists.
 * @param {string} dir
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Get today's date string.
 * @returns {string} YYYY-MM-DD
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read room domain keywords and context from STATE.md.
 * @param {string} roomDir
 * @returns {{ domainKeywords: string[], ventureStage: string, roomName: string, geography: string }}
 */
function readRoomContext(roomDir) {
  const statePath = path.join(roomDir, 'STATE.md');
  let domainKeywords = [];
  let ventureStage = 'unknown';
  let roomName = path.basename(roomDir);
  let geography = 'United States';

  if (fs.existsSync(statePath)) {
    try {
      const content = fs.readFileSync(statePath, 'utf8');
      const fm = parseFrontmatter(content);
      if (fm.domain_keywords) {
        domainKeywords = fm.domain_keywords.split(/[,;]\s*/).map(k => k.trim()).filter(Boolean);
      }
      if (fm.venture_stage) ventureStage = fm.venture_stage;
      if (fm.name || fm.room_name) roomName = (fm.name || fm.room_name).trim();
      if (fm.geography) geography = fm.geography;
    } catch (_e) { /* skip */ }
  }

  return { domainKeywords, ventureStage, roomName, geography };
}

// ---------------------------------------------------------------------------
// 1. Competitor Analysis (SCHED-03)
// ---------------------------------------------------------------------------

/**
 * Extract tracked competitors from room.
 * Checks: competitive-analysis/*.md filenames and content, .config.json.
 *
 * @param {string} roomDir
 * @returns {string[]} Competitor names
 */
function extractCompetitors(roomDir) {
  const competitors = new Set();

  // 1. competitive-analysis/ filenames and content
  const compDir = path.join(roomDir, 'competitive-analysis');
  if (fs.existsSync(compDir)) {
    try {
      const files = fs.readdirSync(compDir).filter(f => f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md');
      for (const file of files) {
        // Filename as competitor name (strip .md, replace hyphens)
        const name = file.replace(/\.md$/, '').replace(/-/g, ' ');
        if (name.length > 2) competitors.add(name);

        // Also check content for explicit competitor names
        try {
          const content = fs.readFileSync(path.join(compDir, file), 'utf8');
          const nameMatch = content.match(/^competitor:\s*(.+)$/m) || content.match(/^company:\s*(.+)$/m);
          if (nameMatch) competitors.add(nameMatch[1].trim().replace(/^["']|["']$/g, ''));
        } catch (_e) { /* skip */ }
      }
    } catch (_e) { /* skip */ }
  }

  // 2. .config.json tracked_competitors
  const configPath = path.join(roomDir, '.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (Array.isArray(config.tracked_competitors)) {
        for (const c of config.tracked_competitors) {
          if (typeof c === 'string' && c.length > 2) competitors.add(c);
        }
      }
    } catch (_e) { /* skip */ }
  }

  return [...competitors].slice(0, 10);
}

/**
 * Build competitor search queries for LLM execution.
 *
 * @param {string} roomDir
 * @returns {{ queries: Array<{competitor: string, searchQuery: string}>, competitors: string[], outputPath: string } | { insufficient: true, reason: string }}
 */
function buildCompetitorQueries(roomDir) {
  const competitors = extractCompetitors(roomDir);
  if (competitors.length === 0) {
    return {
      insufficient: true,
      reason: 'No competitors tracked. Add competitor analysis files to room/competitive-analysis/ or set tracked_competitors in room/.config.json.',
    };
  }

  const queries = competitors.slice(0, 5).map(competitor => ({
    competitor,
    searchQuery: `"${competitor}" funding OR launch OR pivot OR acquisition OR partnership`,
  }));

  const intelDir = path.join(roomDir, 'intelligence');
  const outputPath = path.join(intelDir, `competitors-${today()}.md`);

  return { queries, competitors: competitors.slice(0, 5), outputPath };
}

/**
 * File competitor analysis results.
 *
 * @param {string} roomDir
 * @param {Array<{competitor: string, findings: string[], contradictions: string[]}>} results
 * @returns {{ outputPath: string, written: boolean }}
 */
function fileCompetitorResults(roomDir, results) {
  const intelDir = path.join(roomDir, 'intelligence');
  ensureDir(intelDir);

  const outputPath = path.join(intelDir, `competitors-${today()}.md`);
  const lines = [];

  lines.push('---');
  lines.push('type: competitor-watch');
  lines.push(`date: ${today()}`);
  lines.push(`competitors_scanned: ${results.length}`);
  lines.push(`contradictions_found: ${results.reduce((acc, r) => acc + r.contradictions.length, 0)}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`source: scheduled-scanner`);
  lines.push('---');
  lines.push('');
  lines.push(`# Competitor Watch - ${today()}`);
  lines.push('');

  for (const r of results) {
    lines.push(`## ${r.competitor}`);
    lines.push('');
    lines.push('**Recent Activity:**');
    if (r.findings.length === 0) {
      lines.push('- No significant recent activity found');
    } else {
      for (const finding of r.findings) {
        lines.push(`- ${finding}`);
      }
    }
    lines.push('');
    lines.push('**Room Contradictions:**');
    if (r.contradictions.length === 0) {
      lines.push('- None detected');
    } else {
      for (const c of r.contradictions) {
        lines.push(`- CONTRADICTION: ${c}`);
      }
    }
    lines.push('');
  }

  try {
    fs.writeFileSync(outputPath, lines.join('\n'));
    return { outputPath, written: true };
  } catch (e) {
    return { outputPath, written: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// 2. Grant Discovery (SCHED-04)
// ---------------------------------------------------------------------------

/**
 * Run grant discovery scan and file results.
 * Extends opportunity-ops.scanOpportunities with filing to intelligence/.
 *
 * @param {string} roomDir
 * @returns {Promise<{ outputPath: string, written: boolean, resultCount: number, apiErrors: string[] }>}
 */
async function scanAndFileGrants(roomDir) {
  const opportunityOps = require('./opportunity-ops.cjs');
  const intelDir = path.join(roomDir, 'intelligence');
  ensureDir(intelDir);

  const outputPath = path.join(intelDir, `grants-${today()}.md`);

  try {
    const scanResult = await opportunityOps.scanOpportunities(roomDir);

    if (scanResult.query_context && scanResult.query_context.insufficient) {
      const lines = [
        '---',
        'type: grant-discovery',
        `date: ${today()}`,
        'results: 0',
        `generated: ${new Date().toISOString()}`,
        'source: scheduled-scanner',
        '---',
        '',
        `# Grant Discovery - ${today()}`,
        '',
        `**Skipped:** ${scanResult.query_context.reason}`,
        '',
      ];
      fs.writeFileSync(outputPath, lines.join('\n'));
      return { outputPath, written: true, resultCount: 0, apiErrors: [], skipped: true, reason: scanResult.query_context.reason };
    }

    const results = scanResult.results || [];
    const apiErrors = scanResult.api_errors || [];

    const lines = [];
    lines.push('---');
    lines.push('type: grant-discovery');
    lines.push(`date: ${today()}`);
    lines.push(`results: ${results.length}`);
    lines.push(`api_errors: ${apiErrors.length}`);
    lines.push(`generated: ${new Date().toISOString()}`);
    lines.push('source: scheduled-scanner');
    lines.push('---');
    lines.push('');
    lines.push(`# Grant Discovery - ${today()}`);
    lines.push('');

    if (results.length === 0) {
      lines.push('No matching grants found in this scan.');
      if (apiErrors.length > 0) {
        lines.push('');
        lines.push('**API Errors:**');
        for (const err of apiErrors) {
          lines.push(`- ${err}`);
        }
      }
    } else {
      // Top results by relevance
      const sorted = [...results].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
      const top = sorted.slice(0, 15);

      lines.push(`Found ${results.length} opportunities. Top ${top.length} by relevance:`);
      lines.push('');

      for (const opp of top) {
        lines.push(`### ${opp.title}`);
        lines.push('');
        lines.push(`- **Funder:** ${opp.funder || 'Unknown'}`);
        lines.push(`- **Program:** ${opp.program || 'N/A'}`);
        if (opp.amount) lines.push(`- **Amount:** $${Number(opp.amount).toLocaleString()}`);
        if (opp.deadline) lines.push(`- **Deadline:** ${opp.deadline}`);
        lines.push(`- **Relevance:** ${Math.round((opp.relevance_score || 0) * 100)}%`);
        if (opp.source_url) lines.push(`- **Source:** [${opp.source}](${opp.source_url})`);
        lines.push('');
      }
    }

    fs.writeFileSync(outputPath, lines.join('\n'));
    return { outputPath, written: true, resultCount: results.length, apiErrors };
  } catch (e) {
    return { outputPath, written: false, resultCount: 0, apiErrors: [e.message] };
  }
}

// ---------------------------------------------------------------------------
// 3. Context-Relevant News (SCHED-05)
// ---------------------------------------------------------------------------

/**
 * Build news search queries from room domain context.
 *
 * @param {string} roomDir
 * @returns {{ queries: Array<{topic: string, searchQuery: string}>, outputPath: string } | { insufficient: true, reason: string }}
 */
function buildNewsQueries(roomDir) {
  const context = readRoomContext(roomDir);
  if (context.domainKeywords.length === 0) {
    return {
      insufficient: true,
      reason: 'Room needs domain_keywords in STATE.md for context-relevant news scanning.',
    };
  }

  const queries = [];

  // Main domain query
  const mainKeywords = context.domainKeywords.slice(0, 3).join(' ');
  queries.push({
    topic: 'Domain developments',
    searchQuery: `${mainKeywords} latest developments OR breakthrough OR announcement`,
  });

  // Regulatory/policy query
  queries.push({
    topic: 'Regulatory updates',
    searchQuery: `${mainKeywords} regulation OR policy OR compliance ${context.geography}`,
  });

  // Investment/market query
  if (context.ventureStage !== 'unknown') {
    queries.push({
      topic: 'Market & investment',
      searchQuery: `${mainKeywords} investment OR funding OR market growth ${new Date().getFullYear()}`,
    });
  }

  const intelDir = path.join(roomDir, 'intelligence');
  const outputPath = path.join(intelDir, `news-${today()}.md`);

  return { queries, outputPath };
}

/**
 * File news scan results.
 *
 * @param {string} roomDir
 * @param {Array<{topic: string, items: Array<{title: string, summary: string, url: string}>}>} results
 * @returns {{ outputPath: string, written: boolean }}
 */
function fileNewsResults(roomDir, results) {
  const intelDir = path.join(roomDir, 'intelligence');
  ensureDir(intelDir);

  const outputPath = path.join(intelDir, `news-${today()}.md`);
  const totalItems = results.reduce((acc, r) => acc + r.items.length, 0);

  const lines = [];
  lines.push('---');
  lines.push('type: domain-news');
  lines.push(`date: ${today()}`);
  lines.push(`topics_scanned: ${results.length}`);
  lines.push(`items_found: ${totalItems}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('source: scheduled-scanner');
  lines.push('---');
  lines.push('');
  lines.push(`# Domain News - ${today()}`);
  lines.push('');

  for (const r of results) {
    lines.push(`## ${r.topic}`);
    lines.push('');
    if (r.items.length === 0) {
      lines.push('No significant news found.');
    } else {
      for (const item of r.items) {
        lines.push(`### ${item.title}`);
        lines.push('');
        lines.push(item.summary);
        if (item.url) lines.push(`[Source](${item.url})`);
        lines.push('');
      }
    }
    lines.push('');
  }

  try {
    fs.writeFileSync(outputPath, lines.join('\n'));
    return { outputPath, written: true };
  } catch (e) {
    return { outputPath, written: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Competitor fan-out consolidation (RADAR-22, Phase 265 Plan 15)
// ---------------------------------------------------------------------------

/**
 * One shared entity is usually just the industry noun ("the market",
 * "the sector"); two independent named entities in common is a genuine
 * co-occurrence worth treating as the same real-world event.
 */
const SAME_EVENT_ENTITY_OVERLAP = 2;

/**
 * Merge per-competitor research results into one report-ready set.
 *
 * PURE FUNCTION: no `fs`, no network reach, no `Date.now()` beyond comparing
 * the dates already present on the supplied findings. The caller (the scout
 * orchestrator or the Cowork scheduled-tasks Competitor Watch surface) is the
 * SOLE writer of the intelligence report; this function only computes.
 *
 * Two tracked competitors are frequently parties to the SAME event (an
 * acquisition, a joint venture, a shared funding round, one competitor
 * acquiring another). Dispatched agents never see each other's output, so
 * without this pass a shared event is reported twice and the naive
 * `contradictions_found` count double-counts it. This function is the single
 * place that dedup and consolidation logic lives, so `/mos:scout` and
 * `commands/scheduled-tasks.md` Task 3 both call ONE implementation.
 *
 * A failed competitor is NEVER invisible. This repo has a tracked silent-skip
 * bug class (see docs/RCA-TEMPLATE.md-filed incidents and the "false success
 * / silent skip" watch item in the repo's own decision log) where a degraded
 * step silently shrank a "scanned" count instead of surfacing the failure.
 * Every `ok: false` entry is returned in `failed` and counted in
 * `competitors_failed`; `competitors_scanned` counts ONLY succeeded
 * competitors, so the two numbers can never silently collapse into one
 * misleading total.
 *
 * @param {Array<{
 *   competitor: string,
 *   ok: boolean,
 *   findings?: Array<{text: string, source_url?: string, date?: string, entities?: string[]}>,
 *   contradictions?: Array<{claim: string, new_finding: string}>,
 *   error?: string
 * }>} results One entry per dispatched competitor. `ok: false` entries carry
 *   `error` and empty arrays.
 * @param {Object} [opts] Reserved for future tuning; unused today.
 * @returns {{
 *   findings: Array,
 *   contradictions: Array,
 *   competitors_requested: number,
 *   competitors_scanned: number,
 *   competitors_failed: number,
 *   failed: Array<{competitor: string, error: string}>,
 *   cross_item_flags: Array<{finding: string, affects: string[]}>
 * }}
 */
function consolidateCompetitorFindings(results, opts) {
  opts = opts || {}; // reserved, unused today -- keeps the signature stable for future tuning
  const list = Array.isArray(results) ? results : [];

  const competitors_requested = list.length;
  const succeeded = list.filter((r) => r && r.ok !== false);
  const failedEntries = list.filter((r) => r && r.ok === false);
  const failed = failedEntries.map((r) => ({
    competitor: r.competitor,
    error: r.error || 'unknown error',
  }));

  // Tracked-competitor roster, for the cross-item name scan below. Derived
  // from the dispatched set itself -- only tracked competitors are ever
  // dispatched (Step 4a's honest refusal keeps an empty roster from reaching
  // this function at all).
  const roster = [...new Set(list.map((r) => r && r.competitor).filter(Boolean))].sort();

  // ---- 1. Same-event dedup ACROSS DIFFERENT competitors ----
  // Do NOT dedup within a single competitor's own findings -- that is a
  // different problem and the fan-out does not create it.
  const tagged = [];
  for (const r of succeeded) {
    const findingsArr = Array.isArray(r.findings) ? r.findings : [];
    for (const f of findingsArr) tagged.push({ competitor: r.competitor, finding: f });
  }

  function entitySet(f) {
    return new Set(Array.isArray(f.entities) ? f.entities : []);
  }
  function overlapCount(a, b) {
    let n = 0;
    for (const e of a) if (b.has(e)) n++;
    return n;
  }
  function sameEvent(a, b) {
    if (a.finding.source_url && b.finding.source_url && a.finding.source_url === b.finding.source_url) {
      return true;
    }
    if (a.finding.date && b.finding.date && a.finding.date === b.finding.date) {
      if (overlapCount(entitySet(a.finding), entitySet(b.finding)) >= SAME_EVENT_ENTITY_OVERLAP) {
        return true;
      }
    }
    return false;
  }

  const groups = [];
  const assigned = new Array(tagged.length).fill(-1);
  for (let i = 0; i < tagged.length; i++) {
    if (assigned[i] !== -1) continue;
    const groupIdx = groups.length;
    groups.push([i]);
    assigned[i] = groupIdx;
    for (let j = i + 1; j < tagged.length; j++) {
      if (assigned[j] !== -1) continue;
      if (tagged[j].competitor === tagged[i].competitor) continue; // same-competitor: not this pass's problem
      const matches = groups[groupIdx].some((k) => sameEvent(tagged[k], tagged[j]));
      if (matches) {
        groups[groupIdx].push(j);
        assigned[j] = groupIdx;
      }
    }
  }

  const findings = [];
  for (const group of groups) {
    const members = group.map((i) => tagged[i]);
    if (members.length === 1) {
      findings.push(Object.assign({}, members[0].finding, { competitor: members[0].competitor }));
      continue;
    }
    // Deterministic attribution: alphabetically first competitor.
    const involvedCompetitors = [...new Set(members.map((m) => m.competitor))].sort();
    const primary = members.find((m) => m.competitor === involvedCompetitors[0]);
    findings.push(
      Object.assign({}, primary.finding, {
        competitor: involvedCompetitors[0],
        cross_referenced: involvedCompetitors,
      })
    );
  }

  // ---- 2. Contradiction dedup ----
  // A contradiction whose `new_finding` text is identical to another
  // contradiction's `new_finding` describes the SAME external event (the
  // natural signal at this layer, since contradictions do not carry their
  // own date/entities/source_url). Keep the first occurrence in input order
  // for determinism -- this is the specific arithmetic bug the phase
  // research names: the naive `contradictions_found` count double-counts a
  // shared event.
  const taggedContradictions = [];
  for (const r of succeeded) {
    const contras = Array.isArray(r.contradictions) ? r.contradictions : [];
    for (const c of contras) taggedContradictions.push({ competitor: r.competitor, contradiction: c });
  }

  const seenNewFindings = new Set();
  const contradictions = [];
  for (const tc of taggedContradictions) {
    const key = tc.contradiction && tc.contradiction.new_finding;
    if (key !== undefined && seenNewFindings.has(key)) continue;
    if (key !== undefined) seenNewFindings.add(key);
    contradictions.push(Object.assign({}, tc.contradiction, { competitor: tc.competitor }));
  }

  // ---- 3. Cross-item consistency surface ----
  // A REPORT surface for Step 6's Intelligence Strip, not an auto-edit. A
  // contradiction naming more than one tracked competitor may invalidate a
  // claim about a competitor OTHER than the one it was filed against (the
  // research's example: "the market has no incumbent at scale" contradicts
  // competitor A but also invalidates the same claim about competitor B).
  const cross_item_flags = [];
  for (const tc of taggedContradictions) {
    const text = [tc.contradiction && tc.contradiction.claim, tc.contradiction && tc.contradiction.new_finding]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const mentioned = roster.filter((name) => name && text.includes(String(name).toLowerCase()));
    const affects = [...new Set(mentioned)].sort();
    if (affects.length > 1) {
      cross_item_flags.push({ finding: tc.contradiction.new_finding, affects });
    }
  }

  return {
    findings,
    contradictions,
    competitors_requested,
    competitors_scanned: succeeded.length,
    competitors_failed: failedEntries.length,
    failed,
    cross_item_flags,
  };
}

// ---------------------------------------------------------------------------
// Unified scan runner
// ---------------------------------------------------------------------------

/**
 * Run all scheduled scans that can execute autonomously (grant discovery).
 * Competitor and news scans return query objects for LLM execution.
 *
 * @param {string} roomDir
 * @returns {Promise<{ grants: object, competitorQueries: object, newsQueries: object }>}
 */
async function runAllScans(roomDir) {
  const [grants, competitorQueries, newsQueries] = await Promise.allSettled([
    scanAndFileGrants(roomDir),
    Promise.resolve(buildCompetitorQueries(roomDir)),
    Promise.resolve(buildNewsQueries(roomDir)),
  ]);

  return {
    grants: grants.status === 'fulfilled' ? grants.value : { error: String(grants.reason) },
    competitorQueries: competitorQueries.status === 'fulfilled' ? competitorQueries.value : { error: String(competitorQueries.reason) },
    newsQueries: newsQueries.status === 'fulfilled' ? newsQueries.value : { error: String(newsQueries.reason) },
  };
}

module.exports = {
  // Competitor analysis
  extractCompetitors,
  buildCompetitorQueries,
  fileCompetitorResults,

  // Grant discovery
  scanAndFileGrants,

  // News scanning
  buildNewsQueries,
  fileNewsResults,

  // Unified
  runAllScans,

  // Competitor fan-out consolidation (RADAR-22, Phase 265 Plan 15)
  consolidateCompetitorFindings,
  SAME_EVENT_ENTITY_OVERLAP,

  // Helpers (for testing)
  readRoomContext,
};
