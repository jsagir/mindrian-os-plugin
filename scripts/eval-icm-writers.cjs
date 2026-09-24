#!/usr/bin/env node
'use strict';
/*
 * scripts/eval-icm-writers.cjs -- Phase 353 Plan 03 Task 2 (RULE-22, RULE-23,
 * D-353-4, T-353-19..22).
 *
 * The fixture-only dev-time writer eval runner. Grades the five writers
 * Phase 353 ships (scaffolder, ruling writer, MINTO refresher, claim filer,
 * entity extractor) against the checklists in evals/icm/checklists/*.md, on
 * fixture rooms under tests/fixtures/icm-rooms/ ONLY. Never a real room, and
 * the router refuses a --room outside that fixture tree as the FIRST thing
 * it does, before any other file read (T-353-19).
 *
 * CJS. Zero new npm dependencies (gray-matter is already a shipped
 * dependency, used here exactly as every other frontmatter reader in this
 * repo uses it). Native `fetch` for the vendor half (Node 22). No async/
 * await surface outside this file's own main flow; every grading helper
 * stays synchronous except the one vendor call.
 *
 * De Stijl report: the renderer is PORTED from
 * .planning/spikes/002-jev-section-framework-ranker/report.cjs (the
 * navigator-approved source; no shared renderer module exists in this repo
 * at HEAD). Same contract: static HTML, no CDN, no deps, inline CSS, hyphens
 * only. Every string interpolated into the HTML is escaped (T-353-22).
 *
 * Egress ceiling: `assertEgressCeiling` and the Jev client (`jev`, `pool`,
 * `loadKey`) are REUSED from scripts/build-section-command-ledger.cjs
 * (Plan 02's own shipped client), not re-authored here -- the two callers
 * share one ceiling (T-353-20, T-353-21). The dev-time key is read only
 * from the operator's own shell or the local secrets file at a fixed
 * dotfile path under the operator's home directory; this file never prints
 * it, never persists it, and never resolves a room's location from it.
 *
 * The vendor half (`kind: jev` checklist items) runs ONLY when the dev-time
 * key resolves; with no key, it SKIPS LOUDLY and the code half still
 * completes with a full report (D-353-4, T-353-23). The code half (`kind:
 * code` checklist items) always runs, with no key and no network at all.
 *
 * `--room <path>` resolves the path (following any symlink) and REFUSES,
 * with a named reason and a non-zero exit, unless the resolved path is
 * under the resolved tests/fixtures/icm-rooms prefix -- computed by prefix
 * containment on the resolved absolute path, never by a substring match. A
 * relative path, a `..` traversal and a symlink that escapes the prefix are
 * all refused (T-353-19).
 *
 * This file contains no path under a real venture-room home directory and
 * resolves no room location from the operating system's home-directory
 * lookup; grading always targets a path under tests/fixtures/icm-rooms/, or
 * nothing runs.
 *
 * No em-dashes anywhere in this file (CLAUDE.md hard rule).
 *
 * CLI:
 *   node scripts/eval-icm-writers.cjs [--room <path> [--room <path> ...]]
 *                                     [--out <path>] [--code-only]
 *   --room        grade this fixture room; repeatable; default = every
 *                 fixture room under tests/fixtures/icm-rooms/
 *   --out         write the JSON report here instead of
 *                 evals/icm/last-run.json (the HTML sibling is derived by
 *                 replacing the .json extension with .html)
 *   --code-only   never attempt the vendor half, even when a key resolves
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const FIXTURE_ROOT = path.resolve(ROOT, 'tests', 'fixtures', 'icm-rooms');
const EVALS_DIR = path.join(ROOT, 'evals', 'icm');
const DEFAULT_OUT_JSON = path.join(EVALS_DIR, 'last-run.json');
const BASELINE_PATH = path.join(EVALS_DIR, 'claude-judge-baseline.json');

// The Plan 02 Jev client shape and the Canon Part 8 egress ceiling it made
// executable: reused verbatim rather than re-authored (T-353-20/T-353-21).
// Requiring this module never fires a vendor call -- build-section-command-
// ledger.cjs only runs its own main() under `require.main === module`.
const ledgerBuilder = require(path.join(ROOT, 'scripts', 'build-section-command-ledger.cjs'));

// ---------------------------------------------------------------------------
// The fixture-prefix guard (T-353-19). Resolves symlinks via realpathSync so
// an escaping symlink is caught, not merely a textual `..`. Prefix
// containment on the RESOLVED absolute path, never a substring match.
// ---------------------------------------------------------------------------
function resolveAndContain(roomArg) {
  const resolvedPath = path.resolve(process.cwd(), roomArg);
  let real;
  try {
    real = fs.realpathSync(resolvedPath);
  } catch (_e) {
    // Path does not exist yet (or is unreadable): still resolve textually so
    // a traversal attempt is caught even before the target exists.
    real = resolvedPath;
  }
  const prefixWithSep = FIXTURE_ROOT + path.sep;
  const within = (real === FIXTURE_ROOT) || real.indexOf(prefixWithSep) === 0;
  return { real: real, within: within };
}

function refuse(roomArg) {
  // eslint-disable-next-line no-console
  console.error('eval-icm-writers: refused -- ' + roomArg + ' is outside tests/fixtures/icm-rooms (D-353-4: never a real room)');
  process.exit(1);
}

function listDefaultFixtureRooms() {
  let entries;
  try {
    entries = fs.readdirSync(FIXTURE_ROOT, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(FIXTURE_ROOT, e.name))
    .sort();
}

function parseArgv(argv) {
  const out = { rooms: [], out: null, codeOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--room') { out.rooms.push(argv[++i]); }
    else if (a === '--out') { out.out = argv[++i]; }
    else if (a === '--code-only') { out.codeOnly = true; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Escaping (T-353-22): every string interpolated into the HTML report.
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------------------
// Item helpers.
// ---------------------------------------------------------------------------
function codeItem(checklist, itemId, ok, detail, room) {
  return { checklist: checklist, item_id: itemId, kind: 'code', ok: !!ok, verdict: null, detail: String(detail || ''), room: room || null };
}

function jevItem(checklist, itemId, wire, room) {
  return { checklist: checklist, item_id: itemId, kind: 'jev', ok: null, verdict: null, confidence: null, probabilities: null, detail: 'not yet graded', wire: wire, room: room || null };
}

// ---------------------------------------------------------------------------
// Governing-thought extraction (MINTO refresher, Item 1). Degrades: when no
// `## Governing Thought` heading exists, the whole body below the H1 title
// is the candidate text -- the fixture MINTO.md stubs carry no heading at
// all, and treating the body as the candidate is the honest reading of
// "is there real prose here, or only the shipped template placeholder".
// ---------------------------------------------------------------------------
const MINTO_PLACEHOLDER_SNIPPET = 'will be populated when the first';

function extractGoverningThought(raw) {
  const body = String(raw || '').replace(/^#[^\n]*\n/, '');
  const headingIdx = body.indexOf('## Governing Thought');
  if (headingIdx === -1) return body.trim();
  const afterHeading = body.slice(headingIdx + '## Governing Thought'.length);
  const nextHeadingIdx = afterHeading.indexOf('\n##');
  const slice = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);
  return slice.trim();
}

// ---------------------------------------------------------------------------
// gradeScaffolder: Items 1 and 2 (block presence, fingerprint recompute) on
// the room AFTER the map + self blocks have been built. Item 3 (missing
// root recreated) is graded separately on its own fresh copy.
// ---------------------------------------------------------------------------
function gradeScaffolder(tmpRoom, map, roomMapMod, roomLabel) {
  const items = [];

  let allBlockedHaveBlock = true;
  let noArtifactHasBlock = true;
  const presenceDetail = [];
  for (const node of map.nodes) {
    const dirAbs = node.path === '.' ? tmpRoom : path.join(tmpRoom, node.path);
    const roomMdPath = path.join(dirAbs, 'ROOM.md');
    let hasBlock = false;
    if (fs.existsSync(roomMdPath)) {
      try {
        const fm = matter(fs.readFileSync(roomMdPath, 'utf8')).data;
        hasBlock = !!(fm && fm.icm_self);
      } catch (_e) { hasBlock = false; }
    }
    if (roomMapMod.SELF_BLOCK_KINDS.has(node.kind)) {
      if (!hasBlock) { allBlockedHaveBlock = false; presenceDetail.push(node.path + ':missing-block'); }
    } else if (node.kind === 'artifact' && hasBlock) {
      noArtifactHasBlock = false; presenceDetail.push(node.path + ':unexpected-block');
    }
  }
  items.push(codeItem('scaffolder', 'item-1-block-presence',
    allBlockedHaveBlock && noArtifactHasBlock,
    presenceDetail.length > 0 ? presenceDetail.join('; ') : 'every blocked-kind dir carries icm_self; no artifact dir does', roomLabel));

  let fpOk = true;
  const fpDetail = [];
  for (const node of map.nodes) {
    if (!roomMapMod.SELF_BLOCK_KINDS.has(node.kind)) continue;
    const dirAbs = node.path === '.' ? tmpRoom : path.join(tmpRoom, node.path);
    const roomMdPath = path.join(dirAbs, 'ROOM.md');
    if (!fs.existsSync(roomMdPath)) { fpOk = false; fpDetail.push(node.path + ':no-room-md'); continue; }
    let fm;
    try { fm = matter(fs.readFileSync(roomMdPath, 'utf8')).data; } catch (_e) { fm = null; }
    const claimed = fm && fm.icm_self && fm.icm_self.fingerprint;
    const recomputed = roomMapMod.mapFingerprint([node]);
    if (claimed !== recomputed) { fpOk = false; fpDetail.push(node.path + ':fingerprint-mismatch'); }
  }
  items.push(codeItem('scaffolder', 'item-2-fingerprint',
    fpOk, fpDetail.length > 0 ? fpDetail.join('; ') : 'every block fingerprint recomputes to the same value', roomLabel));

  return items;
}

function gradeScaffolderRootRecreate(originalRoomDir, roomMapMod, roomLabel) {
  const tmp = fs.mkdtempSync(path.join(FIXTURE_TMP_BASE(), 'root-recreate-'));
  try {
    fs.cpSync(originalRoomDir, tmp, { recursive: true });
    const rootRoomMd = path.join(tmp, 'ROOM.md');
    try { fs.unlinkSync(rootRoomMd); } catch (_e) { /* already absent */ }
    const map = roomMapMod.buildRoomMap(tmp);
    roomMapMod.writeSelfBlocks(tmp, map);
    let ok = fs.existsSync(rootRoomMd);
    let detail = 'root ROOM.md recreated from the identity template';
    if (ok) {
      try {
        const fm = matter(fs.readFileSync(rootRoomMd, 'utf8')).data;
        ok = !!(fm && fm.icm_self);
        if (!ok) detail = 'root ROOM.md recreated but carries no icm_self block';
      } catch (_e) { ok = false; detail = 'recreated root ROOM.md failed to parse'; }
    } else {
      detail = 'root ROOM.md was not recreated';
    }
    return [codeItem('scaffolder', 'item-3-missing-root-recreated', ok, detail, roomLabel)];
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
  }
}

// ---------------------------------------------------------------------------
// gradeRulingWriter: Items 1-4 (code) run the real generator
// (writeSectionContracts) on the tmp copy and inspect its own output. Item 5
// (jev) grades whether the generated methodology sequence fits the job.
// ---------------------------------------------------------------------------
const RULING_HEADINGS = [
  '## 1. Job', '## 2. Methodology sequence', '## 3. Writing rules',
  '## 4. Gates', '## 5. Checks', '## 6. Commands that write here',
];

function gradeRulingWriter(tmpRoom, sectionSlugs, sectionRegistry, ledger, scaffoldMod, roomLabel) {
  const items = [];
  const result = { contracts_created: [], ruling_regenerated: [], warnings: [], errors: [] };
  try {
    scaffoldMod.writeSectionContracts(tmpRoom, sectionSlugs, result);
  } catch (e) {
    items.push(codeItem('ruling-writer', 'item-1-six-parts', false, 'writeSectionContracts threw: ' + (e && e.message), roomLabel));
    return items;
  }

  let allSixPresent = true;
  let orderOk = true;
  let fmOk = true;
  let fpOk = true;
  let tailOk = true;
  const detail1 = []; const detail2 = []; const detail3 = []; const detail4 = [];
  let gradedAny = false;

  for (const slug of sectionSlugs) {
    const canonRow = sectionRegistry.getSectionJob(slug);
    if (!canonRow || !canonRow.job_id) continue; // undeclared job: falls back to verbatim copy, out of scope for this checklist
    const contextPath = path.join(tmpRoom, slug, 'CONTEXT.md');
    if (!fs.existsSync(contextPath)) { allSixPresent = false; detail1.push(slug + ':no-context-md'); continue; }
    gradedAny = true;
    const raw = fs.readFileSync(contextPath, 'utf8');
    const parsed = matter(raw);

    let lastIdx = -1;
    for (const h of RULING_HEADINGS) {
      const idx = raw.indexOf(h);
      if (idx === -1) { allSixPresent = false; detail1.push(slug + ':missing:' + h); }
      else if (idx <= lastIdx) { orderOk = false; detail2.push(slug + ':out-of-order:' + h); }
      lastIdx = idx;
    }

    const fm = parsed.data || {};
    if (typeof fm.icm_layer !== 'number' || typeof fm.job_id !== 'string'
      || typeof fm.ruling_fingerprint !== 'string' || typeof fm.generated_at !== 'string') {
      fmOk = false; detail3.push(slug + ':frontmatter-shape');
    }

    const rebuilt = scaffoldMod.buildRulingBlock(canonRow, ledger);
    if (fm.ruling_fingerprint !== rebuilt.fingerprint) { fpOk = false; detail3.push(slug + ':fingerprint-mismatch'); }

    const templatePath = path.join(ROOT, 'templates', 'room-skeleton', 'section-contracts', slug + '.md');
    if (fs.existsSync(templatePath)) {
      const template = fs.readFileSync(templatePath, 'utf8');
      const endMarker = '<!-- mos:ruling:end -->';
      const endIdx = raw.indexOf(endMarker);
      const landedTail = endIdx === -1 ? '' : raw.slice(endIdx + endMarker.length).replace(/^\n+/, '');
      const templateTail = template.replace(/^\n+/, '');
      if (landedTail.trim() !== templateTail.trim()) { tailOk = false; detail4.push(slug + ':tail-mismatch'); }
    }
  }

  if (!gradedAny) {
    items.push(codeItem('ruling-writer', 'item-1-six-parts', false, 'no section with a declared job was available to grade', roomLabel));
    return items;
  }

  items.push(codeItem('ruling-writer', 'item-1-six-parts', allSixPresent, detail1.join('; ') || 'all six parts present', roomLabel));
  items.push(codeItem('ruling-writer', 'item-2-frontmatter-keys', fmOk, detail3.join('; ') || 'frontmatter carries all four generated keys', roomLabel));
  items.push(codeItem('ruling-writer', 'item-3-fingerprint-recomputes', fpOk, detail3.join('; ') || 'ruling_fingerprint recomputes to the same value', roomLabel));
  items.push(codeItem('ruling-writer', 'item-4-authored-prose-preserved', tailOk, detail4.join('; ') || 'authored prose below the end marker is byte-preserved', roomLabel));
  items.push(jevItem('ruling-writer', 'item-5-sequence-fits-job', {
    name: 'methodology sequence fit',
    jtbd: 'Score whether the named framework sequence is a plausible first-move order for this job',
    glossary: 'A Score question over the section job and its ordered framework names only',
    judge: 'Does the named framework sequence in this state read as a plausible first-move order for a section doing this job?',
    pass: 'the sequence is a plausible first-move order for a section doing this job',
    fail: 'the sequence is not a plausible first-move order: premature, off-job, or out of order',
  }, roomLabel));
  // Order check kept structurally distinct from presence (recorded, never silently folded):
  if (!orderOk) items[0].detail += (items[0].detail ? '; ' : '') + 'order violations: ' + detail2.join('; ');

  return items;
}

// ---------------------------------------------------------------------------
// gradeMintoRefresher: Item 1 (code), Item 2 (jev).
// ---------------------------------------------------------------------------
function gradeMintoRefresher(tmpRoom, sectionSlugs, roomLabel) {
  const items = [];
  const targets = ['.'].concat(sectionSlugs);
  let ok = true;
  const detail = [];
  let gradedAny = false;

  for (const rel of targets) {
    const dirAbs = rel === '.' ? tmpRoom : path.join(tmpRoom, rel);
    const mintoPath = path.join(dirAbs, 'MINTO.md');
    if (!fs.existsSync(mintoPath)) continue;
    gradedAny = true;
    const raw = fs.readFileSync(mintoPath, 'utf8');
    const gt = extractGoverningThought(raw);
    const nonTemplate = gt.length > 0 && gt.indexOf(MINTO_PLACEHOLDER_SNIPPET) === -1;
    if (!nonTemplate) { ok = false; detail.push(rel + ':empty-or-template'); }
  }

  if (!gradedAny) {
    items.push(codeItem('minto-refresher', 'item-1-governing-thought-present', false, 'no MINTO.md was found to grade', roomLabel));
    return items;
  }

  items.push(codeItem('minto-refresher', 'item-1-governing-thought-present', ok,
    detail.length > 0 ? detail.join('; ') : 'every governing thought is present and non-template', roomLabel));
  items.push(jevItem('minto-refresher', 'item-2-summarizes-artifacts', {
    name: 'governing thought summary fit',
    jtbd: 'Noul: does this governing thought plausibly summarize a section holding these artifact titles',
    glossary: 'the section slug, the governing thought text, and a titles-only artifact list',
    judge: 'Does the governing thought in this state plausibly summarize a section holding these artifact titles?',
    pass: 'the governing thought plausibly summarizes a section holding those artifact titles',
    fail: 'the governing thought does not summarize them: it is generic, template text, or about something else',
  }, roomLabel));
  return items;
}

// ---------------------------------------------------------------------------
// gradeClaimFiler: Items 1 and 2 (code, via the real filing gate + anchor
// machinery on a scratch room db under the tmp copy), Item 3 (jev).
// ---------------------------------------------------------------------------
function gradeClaimFiler(tmpRoom, sectionSlug, roomLabel) {
  const items = [];
  let roomDbMod; let navigation; let nodeInsert;
  try {
    roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
    navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
    nodeInsert = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  } catch (e) {
    items.push(codeItem('claim-filer', 'item-1-anchor-edge', false, 'db module unavailable: ' + (e.code || e.message), roomLabel));
    return items;
  }

  let db = null;
  try {
    db = roomDbMod.openRoomDb(tmpRoom);
    const sessionId = 'eval-icm-writers-session';
    nodeInsert.insertNode(db, 'claim:eval-focus-target', 'claim', JSON.stringify({ section: sectionSlug }), {
      source_path: 'eval:353-03', created_by: 'system', epistemic_type: 'observation', review_status: 'proposed',
    });
    navigation.setFocus(db, sessionId, 'claim:eval-focus-target', 'user');
    const focusSection = navigation.resolveFocusSection(db, sessionId);
    const gateResult = navigation.evaluateFilingGate({
      section: focusSection.ok ? focusSection.section : null, servesJtbd: null, mode: 'flag',
    });
    const claimResult = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'eval-icm-writers grading claim for ' + sectionSlug,
      sessionId: sessionId, sourceSegment: 'eval-icm-writers-seg-1',
    });

    let anchored = false;
    if (claimResult.ok && gateResult.section_job) {
      const mint = navigation.mintJtbdAnchor(db, gateResult.section_job);
      if (mint.ok) {
        const edgeResult = navigation.writeEdge(db, {
          source_id: claimResult.node_id,
          target_id: navigation.JTBD_ANCHOR_ID(gateResult.section_job),
          edge_type: 'SOURCED_FROM',
          properties: { relation: 'sourced_from', origin: 'eval_icm_writers' },
        });
        anchored = !!(edgeResult && edgeResult.ok === true);
      }
    }

    items.push(codeItem('claim-filer', 'item-1-anchor-edge', anchored,
      anchored ? 'SOURCED_FROM edge minted to a jtbd: anchor' : 'no anchor edge landed', roomLabel));
    const gateVerdictKnown = gateResult.verdict === 'match' || gateResult.verdict === 'mismatch' || gateResult.verdict === 'unresolved';
    items.push(codeItem('claim-filer', 'item-2-serves-jtbd-honored', gateVerdictKnown,
      'gate verdict: ' + gateResult.verdict, roomLabel));
    items.push(jevItem('claim-filer', 'item-3-epistemic-type-plausible', {
      name: 'epistemic type plausibility',
      jtbd: 'Score whether the chosen epistemic_type fits the structural shape of this claim',
      glossary: 'the epistemic_type enum value and a claim shape summary only; never the claim text',
      judge: 'Is the epistemic type in this state a plausible fit for a claim of this shape?',
      pass: 'the epistemic type is a plausible fit for a claim of that shape',
      fail: 'the epistemic type is an implausible fit for a claim of that shape',
    }, roomLabel));
  } catch (e) {
    items.push(codeItem('claim-filer', 'item-1-anchor-edge', false, 'threw: ' + (e && e.message), roomLabel));
  } finally {
    if (db) { try { roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ } }
  }
  return items;
}

// ---------------------------------------------------------------------------
// gradeEntityExtractor: Item 1 (code), Item 2 (jev). Grades the shared-entity
// slug/hash producer (cross-room-aggregator.cjs's _test surface) against the
// room's own authored governing-thought text, so the input is real writer
// output, never a synthesized string.
// ---------------------------------------------------------------------------
const TEMPLATE_WORDS = ['unknown', 'placeholder', 'tbd', 'todo', 'fixme', 'lorem', 'sample'];

function gradeEntityExtractor(tmpRoom, roomLabel) {
  const items = [];
  let aggregator;
  try {
    aggregator = require(path.join(ROOT, 'lib', 'core', 'cross-room-aggregator.cjs'));
  } catch (e) {
    items.push(codeItem('entity-extractor', 'item-1-no-template-words', false, 'module unavailable: ' + (e.code || e.message), roomLabel));
    return items;
  }
  const safeSlug = aggregator._test && aggregator._test.safeSlug;
  if (typeof safeSlug !== 'function') {
    items.push(codeItem('entity-extractor', 'item-1-no-template-words', false, 'safeSlug not exported on the _test surface', roomLabel));
    return items;
  }

  const raw = fs.readFileSync(path.join(tmpRoom, 'MINTO.md'), 'utf8');
  const gt = extractGoverningThought(raw) || 'unnamed concept';
  const slug = safeSlug(gt);
  const lower = slug.toLowerCase();
  const hasTemplateWord = TEMPLATE_WORDS.some((w) => lower === w || lower.indexOf(w) !== -1);
  const ok = !hasTemplateWord && slug.length > 0;

  items.push(codeItem('entity-extractor', 'item-1-no-template-words', ok,
    ok ? 'extracted slug carries no template word: "' + slug + '"' : 'extracted slug carries a template word: "' + slug + '"', roomLabel));
  items.push(jevItem('entity-extractor', 'item-2-names-a-concept', {
    name: slug,
    jtbd: 'Score whether this slug reads as a single concept handle rather than a truncated sentence fragment',
    glossary: 'the normalized slug only; the raw source sentence stays local',
    judge: 'Does the slug in this state read as a single concept handle rather than a truncated sentence fragment?',
    pass: 'the slug reads as a single concept or noun-phrase handle, for example market-size',
    fail: 'the slug reads as a truncated sentence fragment, for example we-do-not-actually-know-who',
  }, roomLabel));
  return items;
}

// ---------------------------------------------------------------------------
// The Canon Part 8 egress payload for a jev item. Shaped to fit
// assertEgressCeiling's allowed key sets exactly (state: section/
// problem_type/stage/candidates; candidate: name/jtbd/glossary/description).
// ---------------------------------------------------------------------------
function buildJevPayload(item) {
  const wire = item.wire || {};
  return {
    model: 'jev-latest',
    state: {
      section: item.room || null,
      problem_type: null,
      stage: null,
      candidates: {
        [item.item_id]: {
          name: String(wire.name || item.item_id).slice(0, 140),
          jtbd: String(wire.jtbd || '').slice(0, 140),
          glossary: String(wire.glossary || '').slice(0, 140),
        },
      },
    },
    questions: {
      [item.item_id]: {
        type: 'choice',
        instructions: { judge: String(wire.judge || wire.jtbd || '').slice(0, 200) },
        criteria: { pass: String(wire.pass || '').slice(0, 200), fail: String(wire.fail || '').slice(0, 200) },
      },
    },
  };
}

// resolveJevItems: builds and ceiling-checks every jev payload regardless of
// key presence (the ceiling holds even when the vendor call never happens);
// only fires the actual vendor call when a key resolves and --code-only was
// not passed.
async function resolveJevItems(items, opts) {
  const jevFn = (opts && opts.jevFn) || ledgerBuilder.jev;
  for (const it of items) {
    if (it.kind !== 'jev') continue;
    const payload = buildJevPayload(it);
    ledgerBuilder.assertEgressCeiling(payload); // throws before any fetch on a ceiling violation
    if (!opts.keyPresent || opts.codeOnly) {
      // Named skip, but never the key's own env var name inside the shipped
      // artifact (the console line above already carries that name for the
      // operator; the persisted item detail stays key-name-free).
      it.detail = 'SKIP: jev half -- no vendor key resolved this run';
      continue;
    }
    try {
      const res = await jevFn(opts.key, payload);
      const answer = res && res.json && res.json.answers && res.json.answers[it.item_id];
      if (res && res.status === 200 && answer && (answer.choice === 'pass' || answer.choice === 'fail')) {
        it.verdict = answer.choice;
        it.ok = answer.choice === 'pass';
        it.confidence = typeof answer.confidence === 'number' ? answer.confidence : null;
        it.probabilities = answer.probabilities || null;
        it.jev_model = res.json.model || null;
        it.detail = 'jev responded: ' + answer.choice + ' (confidence ' + it.confidence + ')';
      } else {
        it.verdict = null;
        it.ok = null;
        it.confidence = null;
        it.detail = 'jev responded with an unrecognized shape (status ' + (res && res.status) + ')';
      }
    } catch (e) {
      it.verdict = null;
      it.ok = null;
      it.detail = 'jev call threw: ' + (e && e.message);
    }
  }
  return items;
}

function computeAgreement(items, baseline) {
  const answered = items.filter((i) => i.kind === 'jev' && i.verdict !== null && i.verdict !== undefined);
  if (answered.length === 0 || !baseline || !Array.isArray(baseline.items)) return null;
  const baselineMap = new Map();
  for (const b of baseline.items) baselineMap.set(b.checklist + '|' + b.item_id, b.verdict);
  let match = 0; let compared = 0;
  for (const it of answered) {
    const key = it.checklist + '|' + it.item_id;
    if (!baselineMap.has(key)) continue;
    compared += 1;
    if (baselineMap.get(key) === it.verdict) match += 1;
  }
  if (compared === 0) return null;
  return match / compared;
}

function loadBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (_e) {
    return null;
  }
}

function readPluginVersion() {
  try {
    const rv = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
    return rv.readRepoVersion(__dirname).version;
  } catch (_e) {
    return null;
  }
}

// A dedicated per-invocation tmp base so a stale directory from a crashed
// prior run never collides with this run's own scratch copies.
let _tmpBaseCache = null;
function FIXTURE_TMP_BASE() {
  if (_tmpBaseCache) return _tmpBaseCache;
  const os = require('node:os');
  _tmpBaseCache = os.tmpdir();
  return _tmpBaseCache;
}

// ---------------------------------------------------------------------------
// gradeRoom: copies the fixture room into a scratch tmpdir (never mutates
// the tracked fixture tree), builds the map + self blocks + ruling docs for
// real, then grades every writer's checklist against that scratch copy.
// ---------------------------------------------------------------------------
function gradeRoom(originalRoomDir) {
  const roomLabel = path.basename(originalRoomDir);
  const tmpRoom = fs.mkdtempSync(path.join(FIXTURE_TMP_BASE(), 'eval-icm-' + roomLabel + '-'));
  const items = [];
  try {
    fs.cpSync(originalRoomDir, tmpRoom, { recursive: true });

    const roomMapMod = require(path.join(ROOT, 'lib', 'core', 'room-map.cjs'));
    const map = roomMapMod.buildRoomMap(tmpRoom);
    roomMapMod.writeRoomMap(tmpRoom, map);
    roomMapMod.writeSelfBlocks(tmpRoom, map);

    items.push(...gradeScaffolder(tmpRoom, map, roomMapMod, roomLabel));
    items.push(...gradeScaffolderRootRecreate(originalRoomDir, roomMapMod, roomLabel));

    const sectionRegistry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
    const scaffoldMod = require(path.join(ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs'));
    let ledger = null;
    try {
      ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-command-ledger.json'), 'utf8'));
    } catch (_e) { ledger = null; }
    const sectionSlugs = map.nodes.filter((n) => n.kind === 'section').map((n) => n.path);

    items.push(...gradeRulingWriter(tmpRoom, sectionSlugs, sectionRegistry, ledger, scaffoldMod, roomLabel));
    items.push(...gradeMintoRefresher(tmpRoom, sectionSlugs, roomLabel));
    if (sectionSlugs.length > 0) items.push(...gradeClaimFiler(tmpRoom, sectionSlugs[0], roomLabel));
    items.push(...gradeEntityExtractor(tmpRoom, roomLabel));
  } finally {
    try { fs.rmSync(tmpRoom, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
  }
  return { items: items, roomLabel: { room: roomLabel, path: path.relative(ROOT, originalRoomDir) } };
}

// ---------------------------------------------------------------------------
// De Stijl report. Ported from
// .planning/spikes/002-jev-section-framework-ranker/report.cjs: no CDN, no
// deps, inline CSS, hyphens only. Every interpolated string is escaped.
// ---------------------------------------------------------------------------
function renderHtml(lastRun) {
  const css = ':root{--red:#D40920;--blue:#1356A2;--yellow:#F7D842;--black:#111;--white:#FAFAF7;--gray:#8a8a8a}'
    + '*{box-sizing:border-box}body{margin:0;background:var(--white);color:var(--black);font:15px/1.45 "IBM Plex Sans","Helvetica Neue",Arial,sans-serif}'
    + 'header{border-bottom:6px solid var(--black);padding:20px 24px;display:flex;gap:16px;align-items:center}'
    + '.sq{width:22px;height:22px;display:inline-block;border:2px solid var(--black)}.sq.r{background:var(--red)}.sq.b{background:var(--blue)}.sq.y{background:var(--yellow)}'
    + 'h1{font-size:22px;margin:0;letter-spacing:.02em}'
    + 'main{padding:20px 24px;max-width:1180px;margin:0 auto}'
    + '.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:3px solid var(--black);margin-bottom:18px}'
    + '.kpi div{padding:10px 12px;border-right:3px solid var(--black)}.kpi div:last-child{border-right:0}.kpi b{display:block;font-size:22px}'
    + 'table{width:100%;border-collapse:collapse;border:3px solid var(--black)}'
    + 'th,td{border-bottom:1px solid #e6e6e0;padding:6px 10px;text-align:left;font-size:13px}'
    + 'th{background:var(--yellow);border-bottom:3px solid var(--black)}'
    + '.lab{font-size:12px;color:var(--gray)}'
    + '.foot{margin-top:18px;font-size:12px;color:var(--gray)}';

  const rows = lastRun.items.map((it) => {
    const verdict = it.ok === true ? 'pass' : it.ok === false ? 'fail' : 'skip';
    return '<tr><td>' + esc(it.room) + '</td><td>' + esc(it.checklist) + '</td><td>' + esc(it.item_id) + '</td>'
      + '<td>' + esc(it.kind) + '</td><td>' + esc(verdict) + '</td><td>' + esc(it.detail || '') + '</td></tr>';
  }).join('');

  const agreementLabel = lastRun.agreement === null ? 'unmeasured' : (lastRun.agreement * 100).toFixed(0) + '%';

  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>ICM section ruling system - writer eval</title><style>' + css + '</style></head>'
    + '<body><header><span class="sq r"></span><span class="sq b"></span><span class="sq y"></span>'
    + '<h1>ICM section ruling system - writer eval</h1>'
    + '<span class="lab">' + esc(lastRun.run_at) + ' - plugin ' + esc(lastRun.plugin_version || 'unknown') + '</span></header>'
    + '<main><div class="kpi">'
    + '<div><span class="lab">code</span><b>' + lastRun.code_pass + '/' + lastRun.code_total + '</b></div>'
    + '<div><span class="lab">jev</span><b>' + lastRun.jev_pass + '/' + lastRun.jev_total + '</b></div>'
    + '<div><span class="lab">agreement</span><b>' + esc(agreementLabel) + '</b></div>'
    + '<div><span class="lab">key present</span><b>' + (lastRun.key_present ? 'yes' : 'no') + '</b></div>'
    + '</div><table><thead><tr><th>room</th><th>checklist</th><th>item</th><th>kind</th><th>verdict</th><th>detail</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table>'
    + '<p class="foot">Fixture rooms only (D-353-4). No em-dashes, hyphens only. No CDN, no deps, inline CSS only, '
    + 'ported from the Spike 002 report renderer.</p></main></body></html>';
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const flags = parseArgv(argv);

  // FIRST: validate every --room before any other file read (T-353-19).
  const roomsToGrade = [];
  if (flags.rooms.length > 0) {
    for (const r of flags.rooms) {
      const { real, within } = resolveAndContain(r);
      if (!within) { refuse(r); return; }
      roomsToGrade.push(real);
    }
  } else {
    roomsToGrade.push(...listDefaultFixtureRooms());
  }

  for (const r of roomsToGrade) {
    if (!fs.existsSync(r)) {
      // eslint-disable-next-line no-console
      console.error('eval-icm-writers: room not found: ' + r);
      process.exit(1);
      return;
    }
  }

  const key = flags.codeOnly ? null : ledgerBuilder.loadKey();
  const keyPresent = !!key;
  if (!keyPresent) {
    // eslint-disable-next-line no-console
    console.log('SKIP: jev half -- no TYPESAFE_API_KEY');
  }

  const allItems = [];
  const roomSummaries = [];
  for (const roomDir of roomsToGrade) {
    const graded = gradeRoom(roomDir);
    allItems.push(...graded.items);
    roomSummaries.push(graded.roomLabel);
  }

  await resolveJevItems(allItems, { keyPresent: keyPresent, codeOnly: flags.codeOnly, key: key });

  const codeItems = allItems.filter((i) => i.kind === 'code');
  // jev_total counts every jev-kind item this run GRADED against (whether
  // answered or skipped), never just the answered subset -- "0/4 (skipped)"
  // must stay visibly distinct from "0/0 (no jev items exist)" (T-353-23).
  const jevItemsAll = allItems.filter((i) => i.kind === 'jev');
  const codePass = codeItems.filter((i) => i.ok === true).length;
  const jevPass = jevItemsAll.filter((i) => i.ok === true).length;
  const baseline = loadBaseline();
  const agreement = computeAgreement(allItems, baseline);

  const lastRun = {
    run_at: new Date().toISOString(),
    plugin_version: readPluginVersion(),
    rooms: roomSummaries,
    items: allItems.map((i) => {
      // Never carry `wire` (the payload shape) or any key material into the
      // shipped artifact; keep only the graded verdict shape.
      const out = { checklist: i.checklist, item_id: i.item_id, kind: i.kind, ok: i.ok, verdict: i.verdict, confidence: i.confidence ?? null, probabilities: i.probabilities ?? null, detail: i.detail, room: i.room };
      return out;
    }),
    code_pass: codePass,
    code_total: codeItems.length,
    jev_pass: jevPass,
    jev_total: jevItemsAll.length,
    agreement: agreement,
    jev_model: (allItems.find((i) => i.jev_model) || {}).jev_model || null,
    key_present: keyPresent,
  };

  const outJsonPath = flags.out ? path.resolve(process.cwd(), flags.out) : DEFAULT_OUT_JSON;
  const outHtmlPath = outJsonPath.replace(/\.json$/, '.html');
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, JSON.stringify(lastRun, null, 2) + '\n');
  fs.writeFileSync(outHtmlPath, renderHtml(lastRun));

  // eslint-disable-next-line no-console
  console.log('eval-icm-writers: wrote ' + outJsonPath);
  // eslint-disable-next-line no-console
  console.log('code: ' + codePass + '/' + codeItems.length + '  jev: ' + jevPass + '/' + jevItemsAll.length + ' (key_present=' + keyPresent + ')');
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('eval-icm-writers: ' + (e && e.stack || e));
    process.exit(1);
  });
} else {
  module.exports = {
    resolveAndContain,
    listDefaultFixtureRooms,
    parseArgv,
    esc,
    extractGoverningThought,
    gradeRoom,
    buildJevPayload,
    resolveJevItems,
    computeAgreement,
    renderHtml,
  };
}
