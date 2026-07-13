'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 219-05 -- explored-artifact: the Minto-shaped explored writer.
 *
 * "The explored output must read as ANALYZED... not a candidate one-liner"
 * (219-CONTEXT specifics -- the navigator complaint REQ-4 fixes). This writer
 * composes the Minto shape from the chain outputs -- governing thought (the
 * WELL-DEFINED problem statement the canon's conceptual-until-defined mandate
 * demands), SCQA structure, MECE sections covering the deep-research findings
 * + diffusion/timing verdict + analogies + web validation, and the citations
 * list (url + accessed) -- and files it NESTED per Decision 16:
 *
 *     opportunity-bank/<section>/<name>/<name>.md
 *
 * D-08 (locked): Minto rides the EXISTING structure-argument machinery, not a
 *   new composer. The PROSE normally arrives from the chain's resolver-run
 *   structure-argument step (opts.minto: { governing_thought, situation,
 *   complication, question, answer }); this writer maps fields, assembles the
 *   document deterministically from the chain trace when no composed prose is
 *   supplied (field mapping is Claude's discretion per the plan), and gates
 *   EVERY draft through lib/core/feynman-minto-invariants.cjs. A failed
 *   invariant returns { ok:false, violations } and does NOT file (T-219-19:
 *   LLM output is never injected as unvalidated truth).
 *
 * Decision 16 nesting + bankOpportunity reuse: bankOpportunity files FLAT;
 *   this writer extends the filing to the Obsidian nested-folder convention
 *   while REUSING its problem_hash dedup contract (opportunityHash +
 *   parseFrontmatter from the SAME shipped modules) -- a re-exploration of
 *   the same problem UPDATES in place, never duplicates.
 *
 * The <section> segment comes from the opportunity node's props.section (the
 *   216 field contract: a real domain slug or the honest 'unknown', NEVER an
 *   ICM type name -- the deny-list below mirrors eureka-portfolio-report.cjs).
 *
 * D-17: the explored transition goes through navigation.advanceOpportunityStage
 *   on BOTH the lifecycle axis and the stage axis with actor / reason /
 *   evidence_ids / formula_version -- append-only stage_history, prior entries
 *   immutable.
 *
 * D-21: STATE.md recompute fires via opportunity-ops
 *   computeOpportunityBankState (best-effort); the artifact registers as a
 *   memory_artifact graph citizen through navigation.writeMemoryArtifactNode;
 *   directory identities render from the room-skeleton scaffold template via
 *   research-filing.ensureDirIdentity (never hand-minted); post-filing
 *   extraction (D-16 item 2) runs via research-filing.runPostFilingExtraction
 *   unless the caller batches it (opts.postFilingExtraction === false, the
 *   explore-chain combined-pass path).
 *
 * Canon Part 9: all writes via navigation (writeMemoryArtifactNode /
 *   linkOpportunityEvidence / advanceOpportunityStage / the extraction batch).
 *   Zero raw INSERT (grep-gated). engine_mode ('engine' |
 *   'llm_manual_baseline') rides the frontmatter -- D-20 manual output is
 *   excluded from calibration sets by that marker.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const navigation = require('../navigation.cjs');
const invariants = require('../feynman-minto-invariants.cjs');
const { opportunityHash } = require('../opportunity-extractor.cjs');
const { parseFrontmatter } = require('../opportunity-ops.cjs');
const researchFiling = require('./research-filing.cjs');

const FORMULA_VERSION = 'HarvestIndex_v1';
const SCHEMA_VERSION = 'explored-opportunity/1';

// The 216 field contract deny-list (mirrors eureka-portfolio-report.cjs
// ICM_TYPE_DENY): ICM/system type values never masquerade as a section slug.
const ICM_TYPE_DENY = new Set([
  'section', 'artifact', 'memory_artifact', 'memory_event', 'causalclaim',
  'causal_claim', 'whitespacezone', 'whitespace_zone', 'breakthrough',
  'opportunity', 'company', 'technology', 'market', 'domain', 'subdomain',
  'focus_area', 'frame',
]);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function slugify(text) {
  const s = String(text == null ? '' : text).toLowerCase();
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sectionSlug(v) {
  if (typeof v !== 'string' || v.length === 0) return 'unknown';
  const s = slugify(v);
  if (s.length === 0 || s.indexOf(':') !== -1) return 'unknown';
  if (ICM_TYPE_DENY.has(s.replace(/-/g, '_')) || ICM_TYPE_DENY.has(s)) return 'unknown';
  return s;
}

function yamlQuote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Pull one leg's text from the chain trace (summary + finding lines).
function legText(chainTrace, leg, fallback) {
  const entry = (Array.isArray(chainTrace) ? chainTrace : [])
    .find((t) => t && t.step && t.step.leg === leg && isPlainObject(t.chain_output));
  if (!entry) return fallback;
  const out = entry.chain_output;
  const lines = [];
  if (typeof out.summary === 'string' && out.summary.length > 0) lines.push(out.summary);
  if (Array.isArray(out.findings)) {
    for (const f of out.findings) {
      if (!isPlainObject(f)) continue;
      const bits = [f.title, f.summary].filter((s) => typeof s === 'string' && s.length > 0);
      if (bits.length > 0) lines.push('- ' + bits.join(': '));
    }
  }
  if (Array.isArray(out.results) && out.results.length > 0) {
    lines.push('Room-corpus evidence: ' + out.results.map((r) => String(r.path || r.node_id || '')).join(', '));
  }
  if (typeof out.provenance === 'string' && out.provenance.length > 0) {
    lines.push('(' + out.provenance + ')');
  }
  return lines.length > 0 ? lines.join('\n') : fallback;
}

// Strip em/en dashes defensively (the invariants validator warns on them and
// a warning fails the gate; chain/LLM prose may carry them).
function noDashes(s) {
  return String(s == null ? '' : s).replace(/[–—]/g, '-');
}

// Recursive dedup scan: find an existing explored/banked artifact carrying
// the same problem_hash anywhere under opportunity-bank/ (flat legacy files
// AND nested Decision-16 folders). Reuses the SAME parseFrontmatter contract
// bankOpportunity's flat scan uses.
function findByProblemHash(bankDir, hashPrefix) {
  if (!fs.existsSync(bankDir)) return null;
  const stack = [bankDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { entries = []; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (!e.name.endsWith('.md') || e.name === 'STATE.md' || e.name === 'ROOM.md') continue;
      try {
        const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
        if (fm && fm.problem_hash === hashPrefix) return p;
      } catch (_e) { /* skip unreadable */ }
    }
  }
  return null;
}

/**
 * composeExploredArtifact(params) -> Promise<result>
 *
 * params = { roomDir, db, opportunityNodeId, chainTrace, citations, sessionId,
 *            actor?, engineMode?, evidenceIds?, researchArtifactNodeId?,
 *            minto?, postFilingExtraction? }
 *
 * Returns { ok:true, relPath, absPath, artifact_node_id, evidence_edges,
 *           updated, extraction } on success;
 *         { ok:false, violations } on an invariant-rejected draft (NOT filed);
 *         { ok:false, reason } on any other refusal. Never throws.
 */
async function composeExploredArtifact(params) {
  try {
    if (!isPlainObject(params)) return { ok: false, reason: 'invalid_params' };
    const {
      roomDir, db, opportunityNodeId, chainTrace, citations, sessionId,
    } = params;
    if (typeof roomDir !== 'string' || roomDir.length === 0 || !db
      || typeof opportunityNodeId !== 'string' || opportunityNodeId.length === 0) {
      return { ok: false, reason: 'invalid_params' };
    }
    const actor = (typeof params.actor === 'string' && params.actor.length > 0) ? params.actor : 'navigator';
    const engineMode = (typeof params.engineMode === 'string' && params.engineMode.length > 0)
      ? params.engineMode : 'engine';
    const cites = Array.isArray(citations)
      ? citations.filter((c) => isPlainObject(c) && typeof c.url === 'string' && c.url.length > 0)
      : [];
    const evidenceIds = Array.isArray(params.evidenceIds)
      ? params.evidenceIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [];

    // ---- the opportunity node (name / section / jtbd) ----
    const row = db.prepare('SELECT id, properties FROM nodes WHERE id = ?').get(opportunityNodeId);
    if (!row) return { ok: false, reason: 'opportunity_not_found' };
    let props = {};
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
    const name = (isPlainObject(props) && typeof props.name === 'string' && props.name.length > 0)
      ? props.name : opportunityNodeId;
    const section = sectionSlug(isPlainObject(props) ? props.section : 'unknown');
    const nameSlug = slugify(name).slice(0, 50) || 'opportunity';

    // ---- the Minto composition (D-08 field mapping) ----
    const minto = isPlainObject(params.minto) ? params.minto : {};
    const research = legText(chainTrace, 'deep_research', 'No deep-research output captured.');
    const diffusion = legText(chainTrace, 'diffusion_timing', 'No diffusion/timing output captured.');
    const analogies = legText(chainTrace, 'analogies', 'No analogy output captured.');
    const validation = legText(chainTrace, 'web_validation', 'No web-validation output captured.');

    const governingThought = noDashes(
      typeof minto.governing_thought === 'string' && minto.governing_thought.length > 0
        ? minto.governing_thought
        : 'The well-defined problem behind "' + name + '": the evidence-backed opportunity '
          + 'analysis below turns a conceptual signal into an actionable problem statement '
          + 'with cited research, timing, and analog grounding.'
    );
    const situation = noDashes(typeof minto.situation === 'string' && minto.situation.length > 0
      ? minto.situation
      : 'The room graph surfaced "' + name + '" as a qualified opportunity in the '
        + section + ' section.');
    const complication = noDashes(typeof minto.complication === 'string' && minto.complication.length > 0
      ? minto.complication
      : 'As surfaced it was conceptual: a connection without a defined problem, cost, or actor.');
    const question = noDashes(typeof minto.question === 'string' && minto.question.length > 0
      ? minto.question
      : 'What well-defined, evidence-backed problem does this opportunity resolve, and is the timing right?');
    const answer = noDashes(typeof minto.answer === 'string' && minto.answer.length > 0
      ? minto.answer
      : governingThought);

    const problemHash = opportunityHash(name).slice(0, 8);
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    const fm = [
      '---',
      'schema_version: ' + yamlQuote(SCHEMA_VERSION),
      'governing_thought: ' + yamlQuote(governingThought),
      'problem: ' + yamlQuote(noDashes(name)),
      'problem_hash: ' + yamlQuote(problemHash),
      'status: ' + yamlQuote('explored'),
      'engine_mode: ' + yamlQuote(engineMode),
      'section: ' + yamlQuote(section),
      'created: ' + yamlQuote(today),
      'last_generated_at: ' + yamlQuote(nowIso),
    ];
    if (cites.length > 0) {
      fm.push('citations:');
      for (const c of cites) {
        fm.push('  - url: ' + String(c.url));
        fm.push('    accessed: ' + yamlQuote(typeof c.accessed === 'string' ? c.accessed.slice(0, 10) : today));
      }
    } else {
      fm.push('citations: []');
    }
    fm.push('---');

    const bodyLines = [
      '',
      '# ' + noDashes(name),
      '',
      '## Governing Thought',
      '',
      governingThought,
      '',
      '## SCQA',
      '',
      '### Situation',
      '',
      situation,
      '',
      '### Complication',
      '',
      complication,
      '',
      '### Question',
      '',
      question,
      '',
      '### Answer',
      '',
      answer,
      '',
      '## Deep Research Findings',
      '',
      noDashes(research),
      '',
      '## Diffusion and Timing',
      '',
      noDashes(diffusion),
      '',
      '## Analogies',
      '',
      noDashes(analogies),
      '',
      '## Web Validation',
      '',
      noDashes(validation),
      '',
      '## Citations',
      '',
    ];
    if (cites.length > 0) {
      for (const c of cites) {
        bodyLines.push('- ' + c.url + ' (accessed ' + (typeof c.accessed === 'string' ? c.accessed.slice(0, 10) : today) + ')');
      }
    } else {
      bodyLines.push('- none (offline degrade: room-corpus evidence only)');
    }
    bodyLines.push('');
    const content = fm.join('\n') + '\n' + bodyLines.join('\n');

    // ---- the invariants gate BEFORE any filing (T-219-19) ----
    const scratchDir = path.join(roomDir, '.mindrian');
    fs.mkdirSync(scratchDir, { recursive: true });
    const draftPath = path.join(scratchDir, 'explored-draft-' + process.pid + '-'
      + crypto.randomBytes(4).toString('hex') + '.md');
    fs.writeFileSync(draftPath, content, 'utf8');
    let verdict;
    try {
      verdict = invariants.validate(draftPath);
    } finally {
      try { fs.unlinkSync(draftPath); } catch (_e) { /* best-effort */ }
    }
    if (!verdict || verdict.valid !== true) {
      return { ok: false, violations: (verdict && verdict.violations) || [{ message: 'validator unavailable' }] };
    }

    // ---- Decision 16 nested filing with the problem_hash update-in-place ----
    const bankDir = path.join(roomDir, 'opportunity-bank');
    const existing = findByProblemHash(bankDir, problemHash);
    let absPath;
    let updated = false;
    if (existing && path.dirname(existing) !== bankDir) {
      // An existing NESTED artifact for this problem: update in place.
      absPath = existing;
      updated = true;
    } else {
      // Fresh nested placement (a flat legacy dedup hit keeps its flat file
      // untouched; the explored artifact is the nested Decision-16 citizen).
      const dirAbs = path.join(bankDir, section, nameSlug);
      fs.mkdirSync(dirAbs, { recursive: true });
      researchFiling._internal.ensureDirIdentity(path.join(bankDir, section), section,
        'Opportunity-bank section folder for ' + section + ' (Decision 16 nesting).');
      researchFiling._internal.ensureDirIdentity(dirAbs, nameSlug,
        'Explored opportunity artifact folder (the folder IS the artifact).');
      absPath = path.join(dirAbs, nameSlug + '.md');
    }
    researchFiling._internal.atomicWrite(absPath, content);
    const relPath = path.relative(roomDir, absPath).replace(/\\/g, '/');

    // ---- the graph citizen: memory_artifact node via navigation ----
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const artNode = navigation.writeMemoryArtifactNode(db, {
      section: path.dirname(relPath).replace(/\\/g, '/'),
      kind: 'USER',
      path: relPath,
      hash: hash,
    });
    if (!artNode || artNode.ok !== true) {
      return { ok: false, reason: 'artifact_node_write_failed', detail: artNode && artNode.reason, relPath: relPath };
    }

    // ---- >=2 typed evidence edges (SUPPORTS to the graph evidence; INFORMS
    // from the research corpus artifact) via linkOpportunityEvidence ----
    let evidenceEdges = 0;
    for (const evId of evidenceIds) {
      const w = navigation.linkOpportunityEvidence(db, {
        opportunity_id: opportunityNodeId,
        target_id: evId,
        edge_type: 'SUPPORTS',
        properties: { relation: 'supports', origin: 'explore_chain' },
      });
      if (w && w.ok === true) evidenceEdges += 1;
    }
    if (typeof params.researchArtifactNodeId === 'string' && params.researchArtifactNodeId.length > 0) {
      const w = navigation.linkOpportunityEvidence(db, {
        opportunity_id: opportunityNodeId,
        target_id: params.researchArtifactNodeId,
        edge_type: 'INFORMS',
        properties: { relation: 'informs', origin: 'explore_chain_research' },
      });
      if (w && w.ok === true) evidenceEdges += 1;
    }
    {
      // The explored artifact itself backs the analysis (INFORMS).
      const w = navigation.linkOpportunityEvidence(db, {
        opportunity_id: opportunityNodeId,
        target_id: artNode.node_id,
        edge_type: 'INFORMS',
        properties: { relation: 'informs', origin: 'explored_artifact' },
      });
      if (w && w.ok === true) evidenceEdges += 1;
    }

    // ---- D-17: the explored transition, append-only, BOTH axes ----
    const evidenceForHistory = evidenceIds.length > 0
      ? evidenceIds
      : [artNode.node_id];
    const lifecycleAdvance = navigation.advanceOpportunityStage(db, {
      node_id: opportunityNodeId,
      axis: 'lifecycle',
      to: 'explored',
      actor: actor,
      reason: 'explored via chain',
      evidence_ids: evidenceForHistory,
      formula_version: FORMULA_VERSION,
    });
    if (!lifecycleAdvance || lifecycleAdvance.ok !== true) {
      return { ok: false, reason: 'lifecycle_advance_failed', detail: lifecycleAdvance && lifecycleAdvance.reason, relPath: relPath };
    }
    navigation.advanceOpportunityStage(db, {
      node_id: opportunityNodeId,
      axis: 'stage',
      to: 'explored',
      actor: actor,
      reason: 'explored via chain',
      evidence_ids: evidenceForHistory,
      formula_version: FORMULA_VERSION,
    });

    // ---- D-21: STATE.md recompute (best-effort, the existing op) ----
    try {
      // eslint-disable-next-line global-require
      const oppOps = require('../opportunity-ops.cjs');
      if (typeof oppOps.computeOpportunityBankState === 'function') {
        oppOps.computeOpportunityBankState(roomDir);
      }
    } catch (_e) { /* recompute is enhancement, never load-bearing (Tier 0) */ }

    // ---- D-16 item 2: post-filing extraction (skippable for the combined
    // explore-chain pass; standalone callers get it by default) ----
    let extraction = null;
    if (params.postFilingExtraction !== false) {
      extraction = await researchFiling.runPostFilingExtraction(
        roomDir,
        (typeof sessionId === 'string' && sessionId.length > 0) ? sessionId : 'explore-chain',
        [relPath]
      );
    }

    return {
      ok: true,
      relPath: relPath,
      absPath: absPath,
      artifact_node_id: artNode.node_id,
      evidence_edges: evidenceEdges,
      updated: updated,
      extraction: extraction,
    };
  } catch (e) {
    return { ok: false, reason: 'compose_explored_threw', detail: String(e && e.message || '').slice(0, 120) };
  }
}

module.exports = {
  composeExploredArtifact,
  SCHEMA_VERSION,
  FORMULA_VERSION,
};
