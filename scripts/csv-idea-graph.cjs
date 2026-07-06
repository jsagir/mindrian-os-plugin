#!/usr/bin/env node
'use strict';

/*
 * csv-idea-graph.cjs -- build a standalone De Stijl knowledge-graph HTML from the
 * JHU tech-transfer CSVs, visualizing cross-domain diagnostic <-> therapeutic
 * idea relationships (lens3) plus an optional inventor-bridge layer (lens1).
 *
 * Ad-hoc script in the import-jhu-tech-csv.cjs precedent (quick-task follow-up).
 * The parseCsvLine / parseCsv helpers below are COPIED VERBATIM (with attribution)
 * from scripts/import-jhu-tech-csv.cjs -- same minimal RFC4180 splitter, zero deps.
 *
 * DESIGN: "Problem-District Map" (a section-cluster skeleton over the cross-domain
 * graph). Instead of an undifferentiated blob of every tech + every pair + every
 * inventor, the graph now reads as ~44 named "districts" (the promoted
 * shared_problems), with each technology pulled into a tight puff around its home
 * district by the template's own invisible cluster-edge lever, and the inventor
 * layer demoted to an off-by-default toggle. The three moves:
 *
 *   1. Section nodes (structure layer, classes 'section-group'): one crisp De Stijl
 *      box per PROMOTED shared_problem. Problems are tiered by pair-count:
 *        - Tier 3 (>= TIER3_MIN_PAIRS pairs): full "primary" districts, colored border.
 *        - Tier 2 (TIER2_MIN_PAIRS..TIER3-1 pairs): "minor" districts, muted grey border.
 *        - Tier 1 (< TIER2_MIN_PAIRS pairs): the long tail -> collapsed into ONE grey
 *          'sec-other' super-node, class 'longtail', hidden by default on boot.
 *      The district label carries the pair-count ("NEURODEGENERATION - 59") so weight
 *      is legible without a tap (Sections are non-tappable signposts by template design:
 *      the tap/mouseover handlers early-return on section-group).
 *
 *   2. BELONGS_TO edges (classes 'cluster-edge', invisible): every technology emits
 *      exactly ONE edge to its PRIMARY Section. The template's >30-node path reads
 *      data.type==='BELONGS_TO', sets member._section=target, and generates its own
 *      opacity-0 cluster-edge Section->member; cose (structure nodeRepulsion 50000,
 *      cluster-edge elasticity 200) then packs each district into a distinct region.
 *      Primary-Section choice is TIER-FIRST and deterministic: pick the HIGHEST tier
 *      the tech participates in, then the problem where it has the most pair
 *      appearances, ties broken by global pair-count then name. A tech lands in
 *      'sec-other' ONLY if EVERY problem it touches is tier 1 (per-TECHNOLOGY collapse).
 *      A tech's other memberships stay in data.problems (its Summary) and surface as
 *      its visible cross-district pair wires.
 *
 *   3. Pair edges (classes 'converges', gold dotted): the lens3 rows are DE-DUPLICATED
 *      to distinct unordered (diagnostic, therapeutic) pairs (rows sharing a pair merge
 *      into one edge whose gloss concatenates every shared_problem + every source row
 *      for citation). Each edge is tagged data.edge_scope 'intra'|'cross' (same home
 *      Section vs different) -- most edges are intra-district and collapse into short
 *      in-puff texture, leaving the cross-district wires as the actual cross-domain
 *      signal. Inventor bridges (lens1) sit on the 'intelligence' layer so the injected
 *      applyPreset('room') hides them (and their CO_INVENTED edges) on arrival.
 *
 * DATA HYGIENE (load-bearing): shared_problem strings are NORMALIZED before any
 * counting -- curly vs straight apostrophes are unified (parkinson's is split 23+9
 * across two spellings in the raw data), and tuberculosis / "tuberculosis (tb)" and
 * hiv / hiv/aids are aliased -- otherwise the district weights and the pair dedup
 * would double-count. Tier thresholds are tunable constants (TIER3_MIN_PAIRS /
 * TIER2_MIN_PAIRS), not hard-coded magic.
 *
 * HONEST NOUNS (carried into every summary/gloss): these are 386 techs-in-pairs (a
 * subset of the 2117-tech catalog), 1038 CANDIDATE cross-domain pairs across 84 raw
 * (81 normalized) shared_problems, 0 critic-verified. They are candidates, not
 * verified opportunities.
 *
 * Boot state (zero edits to the shared template on disk -- surgical string
 * replacements on the OUTPUT copy only, same precedent as the refresh/empty-state
 * patches): the injected loadGraph runs
 *     var data=<JSON>; initGraph(data); applyPreset('room'); cy.nodes('.longtail').hide();
 * so the default view is the district map with the inventor layer AND the long-tail
 * hidden, recoverable via the existing Content/Intelligence toggle buttons.
 *
 * What it produces (all under evals/eureka/ by default):
 *   1. jhtv-idea-graph.json       -- the graph data (dashboard template schema).
 *   2. jhtv-idea-graph.html       -- the tight structure-first DEFAULT map (long tail
 *      + inventors hidden on boot).
 *   3. jhtv-idea-graph-full.html  -- the full opt-in map (long tail shown; inventors
 *      still one toggle away). An anti-drown pair: read the tight default, open the
 *      full map when you want everything.
 *
 * Canon Part 8: pure LOCAL read + local file write. Zero network. Nothing here
 * touches room.db or any ~/MindrianRooms path (read-only CSV inputs only).
 *
 * NO em-dashes anywhere in this file or its output (CLAUDE.md HARD RULE). clean()
 * downgrades em/en dashes to hyphens on every text field, and a final sweep
 * downgrades the template head's own pre-existing long dashes.
 *
 * Usage:
 *   node scripts/csv-idea-graph.cjs [csvDir] [outJson] [outHtml] [templatePath]
 * Defaults:
 *   csvDir       = /mnt/c/Users/jsagi/Downloads/jhu-tech
 *   outJson      = evals/eureka/jhtv-idea-graph.json
 *   outHtml      = evals/eureka/jhtv-idea-graph.html
 *   templatePath = dashboard/index.html
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Tunable knobs -- promotion cutoffs (NOT hard-coded magic in the body).
// ---------------------------------------------------------------------------
const TIER3_MIN_PAIRS = 10; // >= this many pairs -> full "primary" district
const TIER2_MIN_PAIRS = 5;  // >= this and < TIER3 -> "minor" district; below -> long tail

// ---------------------------------------------------------------------------
// parseCsvLine / parseCsv -- COPIED VERBATIM from scripts/import-jhu-tech-csv.cjs
// (attribution per the ad-hoc-script precedent). Minimal RFC4180 field splitter,
// handles quoted fields with embedded commas / newlines and escaped "" quotes.
// ---------------------------------------------------------------------------
function parseCsvLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

function parseCsv(text) {
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const lines = clean.split(/\r\n|\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]);
  const rows = [];
  let i = 1;
  while (i < lines.length) {
    let raw = lines[i];
    let parsed = parseCsvLine(raw);
    let guard = 0;
    while (parsed.length < header.length && i + 1 < lines.length && guard < 20) {
      i += 1;
      raw += '\n' + lines[i];
      parsed = parseCsvLine(raw);
      guard += 1;
    }
    const row = {};
    for (let c = 0; c < header.length; c += 1) row[header[c]] = parsed[c] !== undefined ? parsed[c] : '';
    rows.push(row);
    i += 1;
  }
  return { header, rows };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readCsv(p) {
  return parseCsv(fs.readFileSync(p, 'utf-8')).rows;
}

// Long-dash matcher built from escapes so no em-dash byte appears in this source
// (U+2014 em-dash, U+2013 en-dash). Used to downgrade both to a hyphen.
const LONG_DASH = new RegExp('[\\u2014\\u2013]', 'g');
// Curly single quotes (U+2019 right, U+2018 left) -> straight apostrophe.
const CURLY_APOS = new RegExp('[\\u2019\\u2018]', 'g');

function clean(s) {
  // Collapse whitespace and downgrade em-dash / en-dash to a hyphen so no CSV
  // description can smuggle an em-dash into the output (CLAUDE.md HARD RULE).
  return (s || '').replace(LONG_DASH, '-').replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  const t = clean(s);
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, '') + '...';
}

// Normalize a shared_problem string BEFORE counting. Unifies curly/straight
// apostrophes and aliases near-duplicate disease names so district weights and the
// pair dedup do not double-count (data-hygiene graft -- load-bearing).
function normProblem(s) {
  let t = clean(s).replace(CURLY_APOS, "'").toLowerCase();
  if (!t) return 'unspecified';
  if (t === 'tuberculosis (tb)' || t === 'tb') t = 'tuberculosis';
  if (t === 'hiv/aids' || t === 'hiv / aids' || t === 'aids') t = 'hiv';
  return t;
}

function slugify(s) {
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

// De Stijl palette (from dashboard/index.html SECTION_COLORS + a few distinct hues).
const COLOR = {
  diagnostic: '#1E3A6E', // deep blue
  therapeutic: '#A63D2F', // De Stijl red
  inventor: '#6B4E8B', // amethyst (distinct from both tech colors)
  minor: '#5C5A56', // muted grey border for tier-2 minor districts
  other: '#3A3A3A', // dark grey for the long-tail catch-all
};

// Distinct saturated De Stijl-family hues for tier-3 primary districts. This is the
// optional "therapeutic-area meta-grouping" graft rendered as a color FAMILY (a
// deterministic palette cycle by rank), NOT a derived therapeutic-area taxonomy -- it
// gives the map a memorable colored geography at zero interaction cost. Assigned to
// districts in descending pair-count so the biggest neighborhoods spread across hues.
const DISTRICT_PALETTE = [
  '#A63D2F', // red
  '#1E3A6E', // blue
  '#C8A43C', // gold
  '#2D6B4A', // green
  '#6B4E8B', // amethyst
  '#B5651D', // ochre
  '#3D6B7A', // teal
  '#8B3A5A', // plum
];

// ---------------------------------------------------------------------------
// Build the graph from the CSVs
// ---------------------------------------------------------------------------
function buildGraph(csvDir) {
  const lens3Path = path.join(csvDir, 'lens3_crossdomain_pairs.csv');
  const enginePath = path.join(csvDir, 'jhu_technologies_engine.csv');
  const lens1Path = path.join(csvDir, 'lens1_inventor_clusters.csv');

  const lens3 = readCsv(lens3Path);
  const engineRows = readCsv(enginePath);
  const lens1 = fs.existsSync(lens1Path) ? readCsv(lens1Path) : [];

  // Engine enrichment map: c_number -> row.
  const engine = {};
  for (const r of engineRows) {
    const c = clean(r.c_number);
    if (c) engine[c] = r;
  }

  // numeric tech_id -> c_number (derived from lens3 itself; complete for all nodes).
  const idToC = {};

  // ---- Pass 1: scan lens3 rows, accumulate everything we need to tier + assign ----
  const problemCount = {};          // normalized problem -> pair (row) count
  const techInfo = new Map();       // c_number -> { side, title, problems:Map(problem->count), rows:Set }
  const pairMap = new Map();        // 'diag|ther' -> { diag, ther, problems:Set, rows:[] }

  function ensureTech(cNumber, side, title) {
    if (!techInfo.has(cNumber)) {
      techInfo.set(cNumber, { side: side, title: clean(title), problems: new Map(), rows: new Set() });
    }
    return techInfo.get(cNumber);
  }

  lens3.forEach((r, idx) => {
    const rowNum = idx + 1; // 1-based data row (header excluded)
    const diagC = clean(r.diagnostic_case);
    const therC = clean(r.therapeutic_case);
    const problem = normProblem(r.shared_problem);
    const diagId = clean(r.diag_tech_id);
    const therId = clean(r.ther_tech_id);
    if (diagId) idToC[diagId] = diagC;
    if (therId) idToC[therId] = therC;
    if (!diagC || !therC) return; // skip malformed rows (should not occur)

    problemCount[problem] = (problemCount[problem] || 0) + 1;

    const dInfo = ensureTech(diagC, 'diagnostic', r.diagnostic_title);
    const tInfo = ensureTech(therC, 'therapeutic', r.therapeutic_title);
    dInfo.problems.set(problem, (dInfo.problems.get(problem) || 0) + 1);
    tInfo.problems.set(problem, (tInfo.problems.get(problem) || 0) + 1);
    dInfo.rows.add(rowNum);
    tInfo.rows.add(rowNum);

    // Diagnostic and therapeutic sets are disjoint in this data, so an ordered key
    // (diag|ther) already uniquely identifies the unordered pair.
    const key = diagC + '|' + therC;
    if (!pairMap.has(key)) pairMap.set(key, { diag: diagC, ther: therC, problems: new Set(), rows: [] });
    const pm = pairMap.get(key);
    pm.problems.add(problem);
    pm.rows.push(rowNum);
  });

  // ---- Tier each problem by pair count ----
  function tierOf(problem) {
    const n = problemCount[problem] || 0;
    if (n >= TIER3_MIN_PAIRS) return 3;
    if (n >= TIER2_MIN_PAIRS) return 2;
    return 1;
  }

  // Promoted problems = tier 3 + tier 2 (each becomes its own Section box). Tier 1
  // problems collapse into the single 'sec-other' long-tail super-node.
  const promoted = Object.keys(problemCount).filter((p) => tierOf(p) >= 2);
  // Rank promoted by pair count (desc) then name so the palette + layout are stable.
  promoted.sort((a, b) => (problemCount[b] - problemCount[a]) || (a < b ? -1 : 1));
  const tier1Problems = Object.keys(problemCount).filter((p) => tierOf(p) === 1);

  const sectionIdOf = {}; // problem -> section node id
  promoted.forEach((p) => { sectionIdOf[p] = 'sec-' + slugify(p); });
  const OTHER_ID = 'sec-other';

  // ---- Per-technology PRIMARY Section (tier-first, deterministic) ----
  // Pick the HIGHEST tier the tech participates in; within that tier the problem
  // with the most pair-appearances; ties -> global pair-count -> name. A tech is
  // long-tail ONLY if its highest tier is 1 (every problem it touches is tier 1).
  function primaryFor(cNumber) {
    const probs = Array.from(techInfo.get(cNumber).problems.entries()); // [problem, count]
    let maxTier = 1;
    probs.forEach(([p]) => { const t = tierOf(p); if (t > maxTier) maxTier = t; });
    const inTier = probs.filter(([p]) => tierOf(p) === maxTier);
    inTier.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];                                  // most appearances
      if (problemCount[b[0]] !== problemCount[a[0]]) return problemCount[b[0]] - problemCount[a[0]]; // global weight
      return a[0] < b[0] ? -1 : 1;                                           // name
    });
    return { problem: inTier[0][0], tier: maxTier };
  }

  const primaryOf = {}; // c_number -> { problem, tier, sectionId, longtail }
  for (const c of techInfo.keys()) {
    const pr = primaryFor(c);
    const longtail = pr.tier === 1;
    primaryOf[c] = {
      problem: pr.problem,
      tier: pr.tier,
      sectionId: longtail ? OTHER_ID : sectionIdOf[pr.problem],
      longtail: longtail,
    };
  }

  // ---- Section nodes (structure layer) ----
  const sectionNodes = [];
  const belongsEdges = [];
  let paletteIdx = 0;
  promoted.forEach((p) => {
    const tier = tierOf(p);
    const count = problemCount[p];
    // tier 3 -> a saturated palette hue (colored geography); tier 2 -> muted grey.
    const color = tier === 3 ? DISTRICT_PALETTE[(paletteIdx++) % DISTRICT_PALETTE.length] : COLOR.minor;
    const members = Object.keys(primaryOf).filter((c) => primaryOf[c].sectionId === sectionIdOf[p]).length;
    const summary = '[cite] lens3_crossdomain_pairs.csv: district for the shared_problem "'
      + p + '" (tier ' + tier + ', ' + count + ' candidate pairs; ' + members
      + ' technologies anchored here). District weight = candidate-pair count, not a verified count.';
    sectionNodes.push({
      data: {
        id: sectionIdOf[p],
        label: p + ' - ' + count,
        color: color,
        degree: 0,
        layer: 'structure',
        tier: tier,
        pair_count: count,
        member_count: members,
        summary: summary,
        citation: 'lens3_crossdomain_pairs.csv shared_problem "' + p + '"',
      },
      classes: 'section-group',
    });
  });

  // The long-tail catch-all: one grey structure super-node, class 'longtail' so the
  // injected cy.nodes('.longtail').hide() drops it (and its members) from the default
  // view. Browsable on demand via the Content-layer toggle or the detail-panel
  // relationship links from a named-district tech that reaches into it.
  const longtailTechCount = Object.keys(primaryOf).filter((c) => primaryOf[c].longtail).length;
  sectionNodes.push({
    data: {
      id: OTHER_ID,
      label: 'other problems - ' + tier1Problems.length + ' rare problems',
      color: COLOR.other,
      degree: 0,
      layer: 'structure',
      tier: 1,
      pair_count: tier1Problems.reduce((s, p) => s + problemCount[p], 0),
      member_count: longtailTechCount,
      summary: '[cite] lens3_crossdomain_pairs.csv: catch-all for ' + tier1Problems.length
        + ' rare shared_problems (each < ' + TIER2_MIN_PAIRS + ' candidate pairs). '
        + longtailTechCount + ' technologies land here only because EVERY problem they touch is rare. '
        + 'Hidden by default; toggle Content off/on or follow a district bridge to browse.',
      citation: 'lens3_crossdomain_pairs.csv (tier-1 long tail)',
    },
    classes: 'section-group longtail',
  });

  // ---- Dedup pair edges (converges) ----
  const pairEdges = [];
  const degree = {};
  function bump(id) { degree[id] = (degree[id] || 0) + 1; }
  for (const pm of pairMap.values()) {
    bump(pm.diag);
    bump(pm.ther);
    const homeA = primaryOf[pm.diag].sectionId;
    const homeB = primaryOf[pm.ther].sectionId;
    const scope = homeA === homeB ? 'intra' : 'cross';
    const probList = Array.from(pm.problems);
    const probStr = probList.slice(0, 4).join('; ') + (probList.length > 4 ? ('; +' + (probList.length - 4) + ' more') : '');
    const rowStr = pm.rows.slice(0, 6).join(', ') + (pm.rows.length > 6 ? (', +' + (pm.rows.length - 6) + ' more') : '');
    const gloss = "shares the candidate problem(s) '" + probStr + "' with [lens3_crossdomain_pairs.csv rows "
      + rowStr + ']';
    pairEdges.push({
      data: {
        id: 'e-pair-' + pm.diag + '-' + pm.ther,
        source: pm.diag,
        target: pm.ther,
        type: 'CONVERGES',
        label: probList[0] + (probList.length > 1 ? (' +' + (probList.length - 1)) : ''),
        shared_problems: probList,
        edge_scope: scope,
        gloss: gloss,
        citation: 'lens3_crossdomain_pairs.csv rows ' + pm.rows.join(', '),
      },
      classes: 'converges',
    });
  }

  // ---- BELONGS_TO cluster edges (one per tech -> its primary Section) ----
  // Classed 'cluster-edge' so they render invisible (opacity 0, events no). These are
  // the navigability lever: the template reads data.type==='BELONGS_TO', sets
  // member._section=target, and cose packs each district into its own region.
  for (const c of techInfo.keys()) {
    const pr = primaryOf[c];
    const rowsList = Array.from(techInfo.get(c).rows).sort((a, b) => a - b);
    const rowsStr = rowsList.slice(0, 8).join(', ') + (rowsList.length > 8 ? ', ...' : '');
    belongsEdges.push({
      data: {
        id: 'belongs-' + c,
        source: c,
        target: pr.sectionId,
        type: 'BELONGS_TO',
        label: '',
        gloss: "primary problem: '" + pr.problem + "' (tier " + pr.tier
          + ') [lens3_crossdomain_pairs.csv rows ' + rowsStr + ']',
        citation: 'lens3_crossdomain_pairs.csv rows ' + rowsStr,
      },
      classes: 'cluster-edge' + (pr.longtail ? ' longtail' : ''),
    });
  }

  // ---- Optional lens1 inventor-bridge layer (intelligence layer) ----
  // Include only inventors whose cluster touches >=2 techs already in the lens3 graph
  // -- the inventors who BRIDGE cross-domain pairs. Every inventor edge connects two
  // nodes that both exist (no orphans). Hidden by default via applyPreset('room').
  const inventorNodes = [];
  const inventorEdges = [];
  let inventorIdx = 0;
  for (const r of lens1) {
    const inventor = clean(r.inventor);
    if (!inventor) continue;
    const techIds = clean(r.tech_ids).split('|').map((x) => x.trim()).filter(Boolean);
    const matched = [];
    const seen = new Set();
    for (const tid of techIds) {
      const c = idToC[tid];
      if (c && techInfo.has(c) && !seen.has(c)) { seen.add(c); matched.push(c); }
    }
    if (matched.length < 2) continue;

    inventorIdx += 1;
    const invId = 'inv-' + inventorIdx;
    const domSpanned = clean(r.domains_spanned);
    const coherence = clean(r.coherence);
    const disclosures = clean(r.disclosures);
    const invSummary = '[cite] lens1_inventor_clusters.csv inventor "' + inventor + '". '
      + 'Bridges ' + matched.length + ' cross-domain technologies here; '
      + disclosures + ' total disclosures, ' + domSpanned + ' domains spanned ('
      + coherence + ' coherence).';
    inventorNodes.push({
      data: {
        id: invId,
        label: inventor,
        color: COLOR.inventor,
        degree: matched.length,
        layer: 'intelligence',
        section: 'inventor-bridge',
        summary: invSummary,
        citation: 'lens1_inventor_clusters.csv inventor ' + inventor,
      },
      classes: 'inventor',
    });
    matched.forEach((c, k) => {
      inventorEdges.push({
        data: {
          id: invId + '-' + k,
          source: invId,
          target: c,
          type: 'CO_INVENTED',
          label: inventor,
          gloss: 'is a bridging inventor of [lens1_inventor_clusters.csv "' + inventor + '"]',
          citation: 'lens1_inventor_clusters.csv inventor ' + inventor,
        },
        classes: 'references',
      });
    });
  }
  inventorEdges.forEach((e) => { bump(e.data.target); }); // credit the tech for degree/sizing

  // ---- Materialize tech nodes ----
  const techNodes = [];
  for (const [cNumber, info] of techInfo.entries()) {
    const eng = engine[cNumber] || {};
    const pr = primaryOf[cNumber];
    const rowsList = Array.from(info.rows).sort((a, b) => a - b);
    const rowsStr = rowsList.slice(0, 12).join(', ') + (rowsList.length > 12 ? ', ...' : '');
    const title = info.title || clean(eng.title) || '';
    const label = cNumber + ' ' + truncate(title, 38);
    const domain = clean(eng.domain);
    const field = clean(eng.field);
    const description = clean(eng.description);
    // All problems this tech touches (its cross-domain reach), with the primary marked.
    const allProblems = Array.from(info.problems.keys());
    const problemsStr = allProblems.map((p) => (p === pr.problem ? p + ' (primary)' : p)).join('; ');
    const citation = 'lens3_crossdomain_pairs.csv (' + info.side + '-side, rows: ' + rowsStr
      + '); jhu_technologies_engine.csv ' + cNumber;
    const descSnippet = description ? (' -- ' + truncate(description, 200)) : '';
    const summary = '[cite] ' + citation + '. Primary district: ' + pr.problem + ' (tier ' + pr.tier + '). '
      + 'All candidate problems: ' + problemsStr + '. Domain: ' + (domain || 'n/a')
      + '; Field: ' + (field || 'n/a') + '.' + descSnippet;
    techNodes.push({
      data: {
        id: cNumber,
        label: label,
        color: info.side === 'diagnostic' ? COLOR.diagnostic : COLOR.therapeutic,
        degree: degree[cNumber] || 0,
        layer: 'content',
        section: info.side,
        methodology: field || '',
        summary: summary,
        cnumber: cNumber,
        title: title,
        domain: domain,
        primary_problem: pr.problem,
        primary_tier: pr.tier,
        problems: allProblems,
        pair_count: rowsList.length,
        citation: citation,
      },
      classes: 'tech ' + info.side + (pr.longtail ? ' longtail' : ''),
    });
  }

  const nodes = techNodes.concat(sectionNodes, inventorNodes);
  const allEdges = pairEdges.concat(belongsEdges, inventorEdges);

  // ---- Default-visible estimate (what the boot state leaves on screen) ----
  const visibleSections = promoted.length; // OTHER is hidden (longtail)
  const visibleTechCount = techNodes.filter((n) => n.classes.indexOf('longtail') === -1).length;
  const visiblePairEdges = pairEdges.filter((e) => {
    return primaryOf[e.data.source] && primaryOf[e.data.target]
      && !primaryOf[e.data.source].longtail && !primaryOf[e.data.target].longtail;
  }).length;
  const crossVisible = pairEdges.filter((e) => e.data.edge_scope === 'cross'
    && !primaryOf[e.data.source].longtail && !primaryOf[e.data.target].longtail).length;

  return {
    nodes: nodes,
    edges: allEdges,
    stats: {
      techNodes: techNodes.length,
      sectionNodes: sectionNodes.length,
      inventorNodes: inventorNodes.length,
      pairEdges: pairEdges.length,
      belongsEdges: belongsEdges.length,
      inventorEdges: inventorEdges.length,
      diagnostic: techNodes.filter((n) => n.data.section === 'diagnostic').length,
      therapeutic: techNodes.filter((n) => n.data.section === 'therapeutic').length,
      problemCount: problemCount,
      distinctProblems: Object.keys(problemCount).length,
      promotedProblems: promoted.length,
      tier3: promoted.filter((p) => tierOf(p) === 3).length,
      tier2: promoted.filter((p) => tierOf(p) === 2).length,
      tier1: tier1Problems.length,
      longtailTechs: longtailTechCount,
      intraPairs: pairEdges.filter((e) => e.data.edge_scope === 'intra').length,
      crossPairs: pairEdges.filter((e) => e.data.edge_scope === 'cross').length,
      defaultVisibleNodes: visibleSections + visibleTechCount,
      defaultVisibleSections: visibleSections,
      defaultVisibleTechs: visibleTechCount,
      defaultVisibleEdges: visiblePairEdges,
      defaultVisibleCrossEdges: crossVisible,
    },
  };
}

// ---------------------------------------------------------------------------
// Inject inline graph JSON into the dashboard template (replicates
// scripts/generate-standalone's python heredoc, in CJS, hyphen-only title).
// bootTail is appended after initGraph(data) inside loadGraph (the boot-state lever).
// ---------------------------------------------------------------------------
function injectStandalone(templatePath, graphJsonText, titleSuffix, bootTail) {
  const template = fs.readFileSync(templatePath, 'utf-8');

  const startMarker = 'function loadGraph() {';
  const endMarker = '    }\n\n    // '; // loadGraph closes with '    }' then blank + next comment
  const startIdx = template.indexOf(startMarker);
  const endIdx = startIdx === -1 ? -1 : template.indexOf(endMarker, startIdx);

  const tail = bootTail ? ('\n      ' + bootTail) : '';
  const newFunc = 'function loadGraph() {\n      var data = ' + graphJsonText
    + ';\n      initGraph(data);' + tail + '\n    }';

  let result;
  if (startIdx === -1 || endIdx === -1) {
    // Fallback: regex (same shape as the python fallback).
    const oldPattern = /function loadGraph\(\)[\s\S]*?\n    \}/;
    result = template.replace(oldPattern, newFunc);
    if (result === template) {
      throw new Error('loadGraph() replacement failed -- template structure changed.');
    }
  } else {
    result = template.slice(0, startIdx) + newFunc + template.slice(endIdx + '    }'.length);
  }

  if (result === template) {
    throw new Error('loadGraph() replacement produced no change.');
  }

  // Static, em-dash-free title + header (we deliberately do NOT set meta.roomName,
  // so the template's runtime title-builder, which would insert an em-dash, never
  // fires; these static strings are the only title source).
  const TITLE = 'JHTV Cross-Domain Idea Graph' + (titleSuffix ? (' - ' + titleSuffix) : '');
  result = result.replace('<title>MindrianOS Data Room</title>', '<title>' + TITLE + '</title>');
  result = result.replace(
    '<span class="header-title" id="header-title">Mindrian Data Room</span>',
    '<span class="header-title" id="header-title">' + TITLE + '</span>'
  );

  // Export metadata (mirrors generate-standalone).
  const exportMeta = '\n'
    + '  <meta name="generator" content="MindrianOS -- AI Innovation Co-Founder">\n'
    + '  <meta name="description" content="JHU tech-transfer cross-domain idea graph (Problem-District Map) generated by MindrianOS.">\n'
    + '  <meta name="creator" content="MindrianOS by Jonathan Sagir">';
  result = result.replace('</head>', exportMeta + '\n</head>');

  // Disable the Refresh button (no server behind a standalone export).
  result = result.replace(
    'id="btn-refresh">Refresh</button>',
    'id="btn-refresh" disabled style="opacity:0.3;cursor:default" title="Standalone export -- refresh not available">Exported</button>'
  );

  // Generalize the empty-state trigger. The template keys the "Your Data Room is
  // empty" overlay on the count of 'artifact'-classed nodes; this idea graph's
  // meaningful content is its technology nodes (not room artifacts), so widen the
  // trigger to "zero nodes total" -- otherwise the overlay would float over a fully
  // rendered graph. Surgical post-process (generate-standalone precedent).
  result = result.replace(
    'if (artifactNodes.length === 0) {',
    'if (data.elements.nodes.length === 0) {'
  );

  // Surgical hover fix (OUTPUT copy only -- the shared template on disk is untouched):
  // the node-hover handler sets connectedEdges opacity:1 + width:3, which would drag
  // a hovered tech's invisible BELONGS_TO cluster-edge to its Section into view (and
  // the mouseout reset never restores cluster-edge width to 0, so those district
  // spokes would accumulate on every hover). Excluding .cluster-edge from the hover
  // width-set keeps them at their stylesheet width 0 (invisible) permanently. Same
  // class of surgical string replacement as the empty-state / refresh patches above.
  result = result.replace(
    "node.connectedEdges().style({ 'opacity': 1, 'width': 3 });",
    "node.connectedEdges().not('.cluster-edge').style({ 'opacity': 1, 'width': 3 });"
  );

  // Final sweep: downgrade the template head's pre-existing em-dashes (and any
  // en-dashes) to hyphens. The inline JSON is already em-dash-free (clean()
  // sanitizes every text field), so this only touches template-owned chrome.
  result = result.replace(LONG_DASH, '-');

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(argv) {
  const repoRoot = path.resolve(__dirname, '..');
  const csvDir = argv[0] || '/mnt/c/Users/jsagi/Downloads/jhu-tech';
  const outJson = path.resolve(argv[1] || path.join(repoRoot, 'evals', 'eureka', 'jhtv-idea-graph.json'));
  const outHtml = path.resolve(argv[2] || path.join(repoRoot, 'evals', 'eureka', 'jhtv-idea-graph.html'));
  const templatePath = path.resolve(argv[3] || path.join(repoRoot, 'dashboard', 'index.html'));
  const outHtmlFull = outHtml.replace(/\.html$/, '-full.html');

  const { nodes, edges, stats } = buildGraph(csvDir);

  // Top-10 shared_problem districts by pair count.
  const top = Object.entries(stats.problemCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => ({ shared_problem: k, pairs: v }));

  const graph = {
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'MindrianOS csv-idea-graph (JHTV Problem-District Map)',
      source: 'lens3_crossdomain_pairs.csv + jhu_technologies_engine.csv + lens1_inventor_clusters.csv',
      design: 'Problem-District Map: shared_problem Section districts + BELONGS_TO cluster lever + off-by-default inventor layer',
      honest_nouns: '386 techs-in-pairs (subset of 2117 catalog); 1038 candidate pairs (919 deduped) across 84 raw / 81 normalized shared_problems; 0 critic-verified. Candidates, not verified opportunities.',
      // NOTE: roomName deliberately omitted (see injectStandalone / em-dash rule).
    },
    elements: { nodes: nodes, edges: edges },
    intelligence: {
      summary: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        tech_nodes: stats.techNodes,
        section_nodes: stats.sectionNodes,
        diagnostic_techs: stats.diagnostic,
        therapeutic_techs: stats.therapeutic,
        inventor_bridges: stats.inventorNodes,
        distinct_shared_problems_normalized: stats.distinctProblems,
        promoted_districts: stats.promotedProblems,
        tier3_primary_districts: stats.tier3,
        tier2_minor_districts: stats.tier2,
        tier1_longtail_problems: stats.tier1,
        longtail_techs: stats.longtailTechs,
        dedup_pair_edges: stats.pairEdges,
        intra_district_pairs: stats.intraPairs,
        cross_district_pairs: stats.crossPairs,
        default_visible_nodes: stats.defaultVisibleNodes,
        default_visible_edges: stats.defaultVisibleEdges,
      },
      top_shared_problems: top,
    },
  };

  const graphJsonText = JSON.stringify(graph, null, 2);

  // --- Orphan check: every edge endpoint must be a real node id ---
  const nodeIds = new Set(nodes.map((n) => n.data.id));
  const orphans = [];
  for (const e of edges) {
    if (!nodeIds.has(e.data.source)) orphans.push({ edge: e.data.id, missing: e.data.source });
    if (!nodeIds.has(e.data.target)) orphans.push({ edge: e.data.id, missing: e.data.target });
  }

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, graphJsonText, 'utf-8');

  // DEFAULT (tight) map: district skeleton + techs, inventor layer AND long tail
  // hidden on boot.
  const htmlDefault = injectStandalone(
    templatePath, graphJsonText, 'District Map',
    "applyPreset('room'); cy.nodes('.longtail').hide();"
  );
  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.writeFileSync(outHtml, htmlDefault, 'utf-8');

  // FULL (opt-in) map: long tail shown; inventor layer still one toggle away
  // (applyPreset('room') hides only the intelligence layer). Anti-drown companion.
  const htmlFull = injectStandalone(
    templatePath, graphJsonText, 'Full Map', "applyPreset('room');"
  );
  fs.writeFileSync(outHtmlFull, htmlFull, 'utf-8');

  // --- Open-ability checks on the emitted DEFAULT HTML ---
  const hasInline = htmlDefault.indexOf('var data = {') !== -1;
  const hasFetch = htmlDefault.indexOf("fetch('graph.json") !== -1;
  const hasBoot = htmlDefault.indexOf("cy.nodes('.longtail').hide()") !== -1;

  const report = {
    design: 'Problem-District Map',
    outputs: { json: outJson, html: outHtml, html_full: outHtmlFull },
    counts: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      tech_nodes: stats.techNodes,
      section_nodes: stats.sectionNodes,
      diagnostic_techs: stats.diagnostic,
      therapeutic_techs: stats.therapeutic,
      inventor_nodes: stats.inventorNodes,
      pair_edges: stats.pairEdges,
      belongs_to_edges: stats.belongsEdges,
      inventor_edges: stats.inventorEdges,
    },
    districts: {
      distinct_problems_normalized: stats.distinctProblems,
      tier3_primary: stats.tier3,
      tier2_minor: stats.tier2,
      tier1_longtail_problems: stats.tier1,
      total_section_nodes: stats.sectionNodes,
      longtail_techs: stats.longtailTechs,
    },
    edge_scope: { intra: stats.intraPairs, cross: stats.crossPairs },
    default_view: {
      visible_nodes: stats.defaultVisibleNodes,
      visible_sections: stats.defaultVisibleSections,
      visible_techs: stats.defaultVisibleTechs,
      visible_pair_edges: stats.defaultVisibleEdges,
      visible_cross_edges: stats.defaultVisibleCrossEdges,
      note: 'inventor layer + long-tail hidden on boot; vs today 481 loose nodes / 1362 edges',
    },
    top_shared_problems: top,
    layers: { structure: 'Section districts', content: 'technologies', intelligence: 'inventor bridges (off by default)' },
    sanity: {
      orphan_edges: orphans.length,
      orphan_sample: orphans.slice(0, 5),
      html_bytes: Buffer.byteLength(htmlDefault, 'utf-8'),
      html_has_inline_json: hasInline,
      html_still_has_fetch: hasFetch,
      html_has_boot_longtail_hide: hasBoot,
    },
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main(process.argv.slice(2));
