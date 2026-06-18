#!/usr/bin/env node
/**
 * Phase 163 Plan 06 -- the five-check adversarial structured verdict
 * (WAVE 6 VERIFY; the harness-as-code property 6 -- "adversarial verify returns a
 * structured verdict, not a vibe").
 *
 * Mirrors the futures VERIFICATION 5-check pattern + the run-all-156.sh sweep
 * philosophy. The verdict is ADVERSARIAL: it assumes every Phase-163 surface is
 * hostile until proven compliant, and it returns a structured { passed, findings }
 * over FIVE checks:
 *
 *   (1) ROOM.md / nesting        -- run a TTA pipeline + Stage 7 over a tmp room
 *       and assert every created folder under opportunity-bank/ carries a ROOM.md
 *       and every artifact sits in its own named folder (CLAUDE.md decisions 15+16).
 *   (2) frozen-edge-set          -- ALLOWED_EDGE_TYPES has the four domain edges
 *       (DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO) AND the full prior
 *       FLOOR is preserved AND the domain edge-linker (DOMAIN_EDGE_SUBSET) REJECTS
 *       a non-domain edge (no leak of an arbitrary type into the domain writers).
 *       Never asserts .size (additive extensions must not regress the floor).
 *   (3) Part 9 proposed-not-confirmed -- a truth-claim domain (taxonomy absent) +
 *       a Stage 7 venture-truth step land review_status 'proposed', never
 *       'confirmed'; a taxonomy domain (taxonomy:true) is the only path to a
 *       system-confirmed status (the carve-out).
 *   (4) Part 8 leak              -- delegate to the leak-scan suite (assert it
 *       exits zero).
 *   (5) exclusive ownership      -- run the orchestrator + Stage 7 over a tmp room
 *       and assert ZERO writes land outside room/opportunity-bank/ (walk the room
 *       tree; any file outside opportunity-bank/ -- other than the .mindrian
 *       room.db substrate -- is a finding).
 *
 * Each check pushes a { check, passed, detail } into findings[]; the suite exits
 * non-zero (and prints the findings) if ANY check failed, so a real defect is
 * surfaced as a FINDING rather than silently passed.
 *
 * Pure node:test/assert + node:sqlite (the in-memory migrated-nodes schema from
 * test-typed-domain.cjs). Zero npm deps. NO em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SUITE = 'test-trending-to-absurd-verdict';
const REPO = path.resolve(__dirname, '..');

const orch = require(path.join(REPO, 'lib', 'core', 'trending-to-absurd', 'orchestrator.cjs'));
const stage7 = require(path.join(REPO, 'lib', 'core', 'trending-to-absurd', 'stage7-roadmap.cjs'));
const { ALLOWED_EDGE_TYPES } = require(path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs'));
const { linkDomainToRelated } = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-domain.cjs'));
const { writeDomainNode } = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-domain.cjs'));

// The structured verdict accumulator.
const findings = [];
function record(check, passed, detail) {
  findings.push({ check, passed, detail });
}

// In-memory db with the Phase-109-migrated nodes schema + the edges table (the
// freshDb idiom from tests/test-typed-domain.cjs:44-69). No SKIP path.
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

// Recursively collect every file path under a directory (relative to root).
function walkFiles(root, base) {
  base = base || root;
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

// Collect every directory under a root (for the ROOM.md-per-folder check).
function walkDirs(root) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      const full = path.join(root, ent.name);
      out.push(full);
      out.push(...walkDirs(full));
    }
  }
  return out;
}

async function runVerdict() {
  // =====================================================================
  // CHECK 1 -- ROOM.md / nesting (CLAUDE.md decisions 15 + 16).
  // =====================================================================
  {
    const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-verdict-c1-'));
    try {
      // Drive a real TTA filing pass (the Wave-4 registrar) + a Stage 7 roadmap.
      const consequences = [
        { id: 'c1', ring: 1, parent_id: null, horizon: 'near', confidence: 0.5, domain: 'Technological', label: 'absurd extreme one', body: '', horizon_spec: '3-10yr' },
        { id: 'c2', ring: 1, parent_id: null, horizon: 'long', confidence: 0.4, domain: 'Social', label: 'absurd extreme two', body: '', horizon_spec: '50yr' },
      ];
      await orch.registerTrendArtifacts(roomDir, consequences, { seed: 'ai-everywhere' });
      await stage7.generateStage7Roadmap(roomDir, [
        { id: 'opp-1', label: 'Absurd autonomous labs', domain: 'Biotech', confidence: 0.5 },
      ], { seed: 'ai-everywhere' });

      const oppBank = path.join(path.resolve(roomDir), 'opportunity-bank');
      const subFindings = [];

      // Every directory the TTA harness OWNS must carry a ROOM.md (ICM Layer 0,
      // CLAUDE.md decision 15). The harness owns its trending-to-absurd-* subtree
      // under opportunity-bank/ (T-163-10 exclusive ownership); it does NOT own
      // the opportunity-bank/ root itself (that is a room-scaffold concern, given
      // its ROOM.md at room-creation time, not by this harness). So the adversarial
      // scope is every TTA-owned folder (a folder whose name carries the TTA seed
      // prefix) plus every descendant of it.
      const PREFIX = orch.TTA_SEED_PREFIX;
      const ownedRoots = walkDirs(oppBank).filter((d) => path.basename(d).indexOf(PREFIX) !== -1);
      const owned = new Set();
      for (const r of ownedRoots) {
        owned.add(r);
        for (const d of walkDirs(r)) owned.add(d);
      }
      const dirs = Array.from(owned);
      if (dirs.length === 0) {
        subFindings.push('no TTA-owned folder was created under opportunity-bank/ (the harness filed nothing)');
      }
      for (const d of dirs) {
        if (!fs.existsSync(path.join(d, 'ROOM.md'))) {
          subFindings.push('TTA-owned folder missing ROOM.md: ' + path.relative(roomDir, d));
        }
      }

      // Every artifact .md (other than ROOM.md) must sit in its OWN named folder
      // (decision 16: never a bare .md in a section root). We assert each non-ROOM
      // .md file's basename (sans .md) matches its containing folder name.
      const files = walkFiles(oppBank);
      for (const f of files) {
        const bn = path.basename(f);
        if (bn === 'ROOM.md') continue;
        if (!bn.endsWith('.md')) continue;
        const folderName = path.basename(path.dirname(f));
        const artifactName = bn.replace(/\.md$/, '');
        if (folderName !== artifactName) {
          subFindings.push('artifact not in its own named folder: ' + path.relative(roomDir, f) + ' (folder=' + folderName + ')');
        }
      }

      if (subFindings.length === 0) {
        record('room_md_nesting', true, 'every opportunity-bank/ folder carries a ROOM.md and every artifact sits in its own named folder (' + dirs.length + ' folders, ' + files.length + ' files checked)');
      } else {
        record('room_md_nesting', false, subFindings.join('; '));
      }
    } catch (e) {
      record('room_md_nesting', false, 'threw: ' + (e && e.message ? e.message : String(e)));
    } finally {
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  }

  // =====================================================================
  // CHECK 2 -- frozen-edge-set (the floor + the four domain edges + no leak).
  // =====================================================================
  {
    const subFindings = [];

    // 2a. The four domain edges are members.
    const DOMAIN_EDGES = ['DECOMPOSED_INTO', 'PART_OF', 'TAGGED_WITH', 'RELATED_TO'];
    for (const e of DOMAIN_EDGES) {
      if (!ALLOWED_EDGE_TYPES.has(e)) subFindings.push('domain edge missing from ALLOWED_EDGE_TYPES: ' + e);
    }

    // 2b. The full prior FLOOR is preserved (every additive type through the
    // Phase 150.8 trio). NEVER assert .size -- assert membership of the floor.
    const FLOOR = [
      'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
      'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
      'AFFILIATED_WITH', 'PIVOTED', 'SELECTED_REACH', 'FEEDS_INTO', 'VALIDATES',
      'STATES', 'SUPPORTS', 'DESCRIBES', 'REFINES', 'ROOT_CAUSES', 'INSTANTIATES',
    ];
    for (const e of FLOOR) {
      if (!ALLOWED_EDGE_TYPES.has(e)) subFindings.push('prior FLOOR edge dropped: ' + e);
    }

    // 2c. The Set is frozen (a constitutional property).
    if (!Object.isFrozen(ALLOWED_EDGE_TYPES)) subFindings.push('ALLOWED_EDGE_TYPES is not frozen');

    // 2d. The domain edge-linker REJECTS a non-domain edge -- no leak of an
    // arbitrary type into the domain writers. INFORMS is a real cascade type, so
    // it is a legal member of the frozen Set but NOT a member of the domain
    // subset; linkDomainToRelated must reject it as a failure entry, never write it.
    const db = freshDb();
    try {
      const r = linkDomainToRelated(db, {
        domainId: 'domain:biotech',
        relations: [
          { targetId: 'focus_area:car-t', edge: 'DECOMPOSED_INTO' },
          { targetId: 'claim:c-1', edge: 'INFORMS' },          // legal frozen type, NOT a domain edge
          { targetId: 'claim:c-2', edge: 'TOTALLY_MADE_UP' },  // not in the frozen Set at all
        ],
      });
      if (r.written !== 1) subFindings.push('domain linker wrote ' + r.written + ' edges (expected 1; the non-domain types must be rejected)');
      const rejected = (r.failures || []).map((f) => f.edge);
      if (!rejected.includes('INFORMS')) subFindings.push('domain linker did NOT reject the non-domain INFORMS edge (leak risk)');
      if (!rejected.includes('TOTALLY_MADE_UP')) subFindings.push('domain linker did NOT reject the made-up edge');
      // Defense-in-depth: only the one domain edge landed in the edges table.
      const cnt = db.prepare('SELECT COUNT(*) AS n FROM edges').get();
      if (cnt.n !== 1) subFindings.push('edges table holds ' + cnt.n + ' rows (expected 1; a non-domain edge leaked through)');
    } catch (e) {
      subFindings.push('domain linker threw: ' + (e && e.message ? e.message : String(e)));
    } finally {
      db.close();
    }

    if (subFindings.length === 0) {
      record('frozen_edge_set', true, 'the four domain edges are members, the full prior FLOOR is preserved, the Set is frozen, and the domain linker rejects every non-domain edge type');
    } else {
      record('frozen_edge_set', false, subFindings.join('; '));
    }
  }

  // =====================================================================
  // CHECK 3 -- Part 9 proposed-not-confirmed (the human-confirm constitution).
  // =====================================================================
  {
    const subFindings = [];
    const db = freshDb();
    try {
      // 3a. A truth-claim domain (taxonomy absent) lands 'proposed', never confirmed.
      const claim = writeDomainNode(db, { domainType: 'domain', name: 'Truth Claim Domain', sessionId: 's1' });
      if (!claim.ok) subFindings.push('truth-claim domain write failed: ' + claim.reason);
      else {
        const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claim.node_id);
        if (!row || row.review_status !== 'proposed') subFindings.push('truth-claim domain review_status is ' + (row && row.review_status) + ' (expected proposed)');
      }

      // 3b. A taxonomy domain (taxonomy:true) is the ONLY path to system-confirmed
      // (the Part 9 v1.5 audit-node carve-out). It carries 'confirmed'.
      const taxo = writeDomainNode(db, { domainType: 'focus_area', name: 'Taxonomy Label', sessionId: 's1', taxonomy: true });
      if (!taxo.ok) subFindings.push('taxonomy domain write failed: ' + taxo.reason);
      else {
        const trow = db.prepare('SELECT review_status, created_by FROM nodes WHERE id = ?').get(taxo.node_id);
        if (!trow || trow.review_status !== 'confirmed') subFindings.push('taxonomy domain review_status is ' + (trow && trow.review_status) + ' (expected confirmed via the carve-out)');
        if (!trow || trow.created_by !== 'system') subFindings.push('taxonomy domain created_by is ' + (trow && trow.created_by) + ' (expected system bookkeeping)');
      }
    } catch (e) {
      subFindings.push('domain-node Part 9 check threw: ' + (e && e.message ? e.message : String(e)));
    } finally {
      db.close();
    }

    // 3c. A Stage 7 venture-truth roadmap step lands 'proposed', never confirmed
    // (the in-object steps AND the on-disk artifact).
    const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-verdict-c3-'));
    try {
      const out = await stage7.generateStage7Roadmap(roomDir, [
        { id: 'opp-1', label: 'Absurd autonomous labs', domain: 'Biotech', confidence: 0.5 },
      ], { seed: 'ai-everywhere' });
      let sawTruthClaim = false;
      for (const entry of out.roadmap) {
        for (const s of entry.mitigation_steps.concat(entry.innovation_steps)) {
          if (s.truth_claim === true) {
            sawTruthClaim = true;
            if (s.review_status !== 'proposed') subFindings.push('Stage 7 truth-claim step review_status is ' + s.review_status + ' (expected proposed)');
          }
          if (s.review_status === 'confirmed') subFindings.push('Stage 7 step is auto-confirmed (Part 9 role 5 breach)');
        }
      }
      if (!sawTruthClaim) subFindings.push('Stage 7 produced no truth-claim step to gate (cannot prove the proposed-not-confirmed path)');
      const md = fs.readFileSync(out.filed[0].path, 'utf8');
      if (!/review_status:\s*proposed/.test(md)) subFindings.push('the on-disk Stage 7 roadmap does not record review_status: proposed');
      if (/review_status:\s*confirmed/.test(md)) subFindings.push('the on-disk Stage 7 roadmap is confirmed (Part 9 breach)');
    } catch (e) {
      subFindings.push('Stage 7 Part 9 check threw: ' + (e && e.message ? e.message : String(e)));
    } finally {
      fs.rmSync(roomDir, { recursive: true, force: true });
    }

    if (subFindings.length === 0) {
      record('part9_proposed_not_confirmed', true, 'truth-claim domain + Stage 7 venture-truth step land proposed; only the taxonomy carve-out reaches system-confirmed');
    } else {
      record('part9_proposed_not_confirmed', false, subFindings.join('; '));
    }
  }

  // =====================================================================
  // CHECK 4 -- Part 8 leak (delegate to the leak-scan suite).
  // =====================================================================
  {
    const leakSuite = path.join(__dirname, 'test-trending-to-absurd-part8-leak.cjs');
    try {
      execFileSync(process.execPath, [leakSuite], { stdio: 'pipe' });
      record('part8_leak', true, 'the Part 8 leak scan over all Phase-163 surfaces exits zero (no Brain-write / raw-fetch / external-http token)');
    } catch (e) {
      const out = (e && e.stdout ? e.stdout.toString() : '') + (e && e.stderr ? e.stderr.toString() : '');
      record('part8_leak', false, 'the Part 8 leak scan FAILED: ' + out.split('\n').filter((l) => l.indexOf('-') !== -1).join(' | ').slice(0, 300));
    }
  }

  // =====================================================================
  // CHECK 5 -- exclusive ownership (zero writes outside opportunity-bank/).
  // =====================================================================
  {
    const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tta-verdict-c5-'));
    try {
      const consequences = [
        { id: 'c1', ring: 1, parent_id: null, horizon: 'near', confidence: 0.5, domain: 'Technological', label: 'absurd extreme one', body: '', horizon_spec: '3-10yr' },
      ];
      await orch.registerTrendArtifacts(roomDir, consequences, { seed: 'ai-everywhere' });
      await stage7.generateStage7Roadmap(roomDir, [
        { id: 'opp-1', label: 'Absurd autonomous labs', domain: 'Biotech', confidence: 0.5 },
      ], { seed: 'ai-everywhere' });

      const resolved = path.resolve(roomDir);
      const oppBank = path.join(resolved, 'opportunity-bank');
      const subFindings = [];
      // Walk the WHOLE room tree; every file must live under opportunity-bank/ --
      // EXCEPT the .mindrian/ room.db substrate the registrar opens (that is the
      // SQL local-mind, not an opportunity-bank escape; the Wave-4 orchestrator
      // test carves it out identically).
      const allFiles = walkFiles(resolved);
      for (const f of allFiles) {
        if (f.startsWith(oppBank + path.sep)) continue;
        if (f.indexOf(path.sep + '.mindrian' + path.sep) !== -1) continue;
        subFindings.push('write escaped opportunity-bank/: ' + path.relative(resolved, f));
      }
      if (subFindings.length === 0) {
        record('exclusive_ownership', true, 'every TTA + Stage 7 write landed under opportunity-bank/ (the .mindrian room.db substrate excepted); zero ownership escape (' + allFiles.length + ' files walked)');
      } else {
        record('exclusive_ownership', false, subFindings.join('; '));
      }
    } catch (e) {
      record('exclusive_ownership', false, 'threw: ' + (e && e.message ? e.message : String(e)));
    } finally {
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  }

  // ---------------------------------------------------------------------
  // The structured verdict.
  // ---------------------------------------------------------------------
  const passed = findings.every((f) => f.passed);
  const verdict = { passed, findings };

  console.log(SUITE);
  for (const f of findings) {
    console.log('  ' + (f.passed ? 'ok' : 'XX') + ' - ' + f.check + ': ' + f.detail);
  }
  console.log('\nVERDICT: ' + JSON.stringify({ passed: verdict.passed, checks: findings.map((f) => ({ check: f.check, passed: f.passed })) }));

  if (!passed) {
    console.error('\n' + SUITE + ': FAIL -- adversarial verdict found ' + findings.filter((f) => !f.passed).length + ' defect(s) above.');
    process.exit(1);
  }
  console.log('\n' + SUITE + ': PASS (' + findings.length + '/' + findings.length + ' checks; the constitution holds)');
  process.exit(0);
}

runVerdict().catch((e) => {
  console.error(SUITE + ': FAIL (verdict harness threw): ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
