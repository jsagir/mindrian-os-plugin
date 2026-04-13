'use strict';

/**
 * Phase 80 Stage 02 -- Person Detector (pure function).
 *
 * detectPeople(fileEntries, opts) runs a 5-tier detection ladder against
 * vault-scanner file entries and returns a deduplicated array of detected
 * people matching the MANIFEST.json people[] schema subset.
 *
 * Detection tiers (highest to lowest confidence):
 *   1. frontmatter          -- attendees/author/team/contributors YAML
 *   2. attendees_header     -- "## Attendees" or "## Participants" list
 *   3. mentions             -- "@Name" style mentions
 *   4. first_last_repeated  -- First Last capitalized pair >= 3 distinct files
 *   5. ner                  -- LLM NER sweep (STUB, returns nothing)
 *
 * Role detection is keyword-based against a sliding window around each name
 * occurrence. See references/import-config.md for the role bucket keywords.
 *
 * Pure: no fs writes, no child_process, no AI calls. Body access goes
 * through opts.bodyLoader (default is fs.readFileSync(source_abs_path)) so
 * tests can pass synthetic content.
 */

const fs = require('node:fs');

// Keyword order matters: longer/more-specific keywords MUST come before their
// substrings so "co-founder" beats "founder", "board member" beats "board".
const ROLE_BUCKETS = {
  'core-team':   ['co-founder', 'cofounder', 'founder', 'ceo', 'cto', 'coo', 'cfo', 'head of', 'vp', 'our team', 'we built', 'team lead'],
  'consultants': ['consultant', 'contractor', 'freelance', 'hired', 'retained', 'engaged'],
  'advisors':    ['advisor', 'mentor', 'guidance', 'advised us', 'coach'],
  'investors':   ['investor', 'vc', 'fund', 'angel', 'seed round', 'series a', 'series b', 'series c', 'cap table', 'term sheet'],
  'board':       ['board member', 'chairman', 'director', 'sits on the board', 'board seat']
};

const STOPWORDS_2WORD = new Set([
  'new york', 'los angeles', 'san francisco', 'project plan', 'action items',
  'next steps', 'key insights', 'data room', 'team sync', 'team meeting',
  'problem definition', 'solution design', 'business model'
]);

const TIER_RANK = {
  frontmatter: 5,
  attendees_header: 4,
  mentions: 3,
  first_last_repeated: 2,
  ner: 1
};

const TIER_CONFIDENCE = {
  frontmatter: 0.97,
  attendees_header: 0.88,
  mentions: 0.75,
  first_last_repeated: 0.60,
  ner: 0.45
};

const ATTENDEES_HEADER_RE = /##\s*(?:Attendees|Participants)\s*\n((?:\s*[-*]\s*.+\n?)+)/i;
const MENTION_RE = /(?:^|\s)@([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
// Use lookahead so overlapping pairs like "Today Eli Zarchin" yield both
// "Today Eli" AND "Eli Zarchin" -- the stopword filter discards common
// false-positives like "Today Morning".
const FIRST_LAST_RE = /\b([A-Z][a-z]+)(?=\s+([A-Z][a-z]+)\b)/g;

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function inferRole(name, content) {
  const haystack = String(content || '').toLowerCase();
  const needle = name.toLowerCase();
  const idx = haystack.indexOf(needle);
  if (idx === -1) return { bucket: 'unassigned', evidence: 'no match' };
  const window = haystack.slice(Math.max(0, idx - 80), idx + needle.length + 80);
  for (const bucket of Object.keys(ROLE_BUCKETS)) {
    for (const kw of ROLE_BUCKETS[bucket]) {
      if (window.indexOf(kw) !== -1) {
        return { bucket: bucket, evidence: kw };
      }
    }
  }
  return { bucket: 'unassigned', evidence: 'no match' };
}

function detectPeople(fileEntries, opts) {
  opts = opts || {};
  const loader = opts.bodyLoader || function (f) {
    try { return fs.readFileSync(f.source_abs_path, 'utf8'); } catch (e) { return ''; }
  };
  const exclude = new Set((opts.excludeNames || []).map(slugify));
  const registry = new Map();

  function record(name, fileId, tier, content) {
    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (STOPWORDS_2WORD.has(trimmed.toLowerCase())) return;
    const slug = slugify(trimmed);
    if (!slug || exclude.has(slug)) return;

    const existing = registry.get(slug);
    const role = inferRole(trimmed, content);

    if (!existing) {
      registry.set(slug, {
        name: trimmed,
        slug: slug,
        detection_tier: tier,
        detection_confidence: TIER_CONFIDENCE[tier],
        role_guess: role.bucket,
        role_evidence: role.evidence,
        mention_files: [fileId]
      });
      return;
    }

    // merge mention_files
    if (existing.mention_files.indexOf(fileId) === -1) {
      existing.mention_files.push(fileId);
    }
    // upgrade to higher tier if applicable
    if (TIER_RANK[tier] > TIER_RANK[existing.detection_tier]) {
      existing.detection_tier = tier;
      existing.detection_confidence = TIER_CONFIDENCE[tier];
    }
    // upgrade role if existing was unassigned and new finding has real role
    if (existing.role_guess === 'unassigned' && role.bucket !== 'unassigned') {
      existing.role_guess = role.bucket;
      existing.role_evidence = role.evidence;
    }
  }

  // First pass: gather bodies + run tiers 1, 2, 3 per file
  const bodies = new Map(); // fileId -> body string
  for (const f of fileEntries) {
    let body = '';
    try { body = loader(f) || ''; } catch (e) { body = ''; }
    bodies.set(f.id, body);

    // Tier 1: frontmatter
    const fm = f.source_frontmatter || {};
    const fmKeys = ['attendees', 'author', 'team', 'contributors'];
    for (const key of fmKeys) {
      const v = fm[key];
      if (!v) continue;
      if (Array.isArray(v)) {
        for (const n of v) record(String(n), f.id, 'frontmatter', body);
      } else if (typeof v === 'string') {
        record(v, f.id, 'frontmatter', body);
      }
    }

    // Tier 2: ## Attendees / ## Participants header
    const am = body.match(ATTENDEES_HEADER_RE);
    if (am) {
      const lines = am[1].split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*[-*]\s*(.+?)\s*$/);
        if (m && m[1]) record(m[1], f.id, 'attendees_header', body);
      }
    }

    // Tier 3: @mentions
    MENTION_RE.lastIndex = 0;
    let mm;
    while ((mm = MENTION_RE.exec(body)) !== null) {
      record(mm[1], f.id, 'mentions', body);
    }
  }

  // Tier 4: first_last_repeated -- capitalized pair across >= 3 distinct files
  const candidateFiles = new Map(); // "First Last" -> Set(fileId)
  for (const f of fileEntries) {
    const body = bodies.get(f.id) || '';
    FIRST_LAST_RE.lastIndex = 0;
    const seenInFile = new Set();
    let m;
    while ((m = FIRST_LAST_RE.exec(body)) !== null) {
      const full = m[1] + ' ' + m[2];
      // advance at least one char to avoid infinite loop on zero-width match
      if (FIRST_LAST_RE.lastIndex === m.index) FIRST_LAST_RE.lastIndex += 1;
      if (STOPWORDS_2WORD.has(full.toLowerCase())) continue;
      if (seenInFile.has(full)) continue;
      seenInFile.add(full);
      if (!candidateFiles.has(full)) candidateFiles.set(full, new Set());
      candidateFiles.get(full).add(f.id);
    }
  }
  for (const entry of candidateFiles.entries()) {
    const full = entry[0];
    const fileSet = entry[1];
    if (fileSet.size < 3) continue;
    const slug = slugify(full);
    // If already in registry via a higher tier, just merge mention_files
    if (registry.has(slug)) {
      const existing = registry.get(slug);
      for (const fid of fileSet) {
        if (existing.mention_files.indexOf(fid) === -1) existing.mention_files.push(fid);
      }
      continue;
    }
    // Record once per file so mention_files captures all
    for (const fid of fileSet) {
      const body = bodies.get(fid) || '';
      record(full, fid, 'first_last_repeated', body);
    }
  }

  // Tier 5: NER stub -- intentionally empty. Deferred to a future LLM pass.

  return Array.from(registry.values());
}

module.exports = {
  detectPeople: detectPeople,
  slugify: slugify,
  inferRole: inferRole,
  ROLE_BUCKETS: ROLE_BUCKETS,
  STOPWORDS_2WORD: STOPWORDS_2WORD,
  TIER_RANK: TIER_RANK,
  TIER_CONFIDENCE: TIER_CONFIDENCE
};
