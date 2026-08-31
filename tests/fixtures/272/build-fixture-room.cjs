#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/fixtures/272/build-fixture-room.cjs
 *
 * ONE-SHOT GENERATOR, not a test. Run once to produce tests/fixtures/272/room/
 * (a real disk-backed fixture room) and tests/272-corpus.json (the 20-pair
 * probe corpus). Both outputs are committed to the repo as fixture data,
 * matching how other phases commit tests/fixtures/* trees.
 *
 * Run: node tests/fixtures/272/build-fixture-room.cjs
 *
 * Why 96 artifacts across 4 sections x 6 topic clusters (RESEARCH.md Finding
 * F-1, Wave 0 Gaps): rs_math.py's build_tfidf_svd clamps
 * effective_components = max(1, min(80, n_rows - 1, n_terms - 1)). The
 * seed-sensitivity regime F-1 measured only appears when n_components <<
 * n_features -- with 4 sections x 6 topics x 4 artifacts = 96 artifacts,
 * n_rows - 1 = 95 > 80, so the clamp binds at 80 as long as the surviving
 * vocabulary (after stop_words='english' + max_df=0.5 filtering) also stays
 * above 80 distinct terms. Each topic's word bank appears in only 16 of 96
 * docs (4 sections x 4 artifacts), well under the max_df=0.5 (48-doc)
 * ceiling, so topic vocabulary is not filtered out. This is verified
 * EMPIRICALLY (not just asserted here) in Task 2's generate-baseline.py,
 * which asserts effective_components == 80 before writing the baseline
 * fixture.
 *
 * Content is synthetic but topically coherent: 6 distinct topic clusters
 * (authentication, billing, onboarding-ux, data-pipeline,
 * notification-delivery, performance-tuning), each with its own ~24-word
 * vocabulary bank, combined into varied per-artifact sentences via a seeded
 * PRNG so phrasing differs artifact-to-artifact within a cluster (not the
 * same paragraph copy-pasted, which would degenerate the TF-IDF vocabulary).
 *
 * Matches scripts/rs-engine.py's discover_artifacts/extract_title contract:
 *   - artifact_id = <section>/<filename-stem>
 *   - title extracted via the first "# Heading" line (extract_title)
 *   - body must be >= 50 chars after extract_body (frontmatter strip; no
 *     frontmatter here, so body == the file content minus the title line
 *     comfortably clears the floor -- every generated body targets 350+
 *     chars, well above the floor)
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOM_DIR = path.join(__dirname, 'room');
const CORPUS_PATH = path.join(__dirname, '..', '..', '272-corpus.json');

const SECTIONS = ['problem-definition', 'assumptions', 'research', 'decisions'];

const ARTIFACTS_PER_TOPIC_PER_SECTION = 4; // 4 sections x 6 topics x 4 = 96 artifacts

const TOPICS = [
  {
    slug: 'authentication',
    label: 'authentication',
    words: [
      'login', 'password', 'session', 'token', 'credential', 'multifactor',
      'oauth', 'biometric', 'lockout', 'expiry', 'refresh', 'identity',
      'verification', 'hashing', 'salt', 'bruteforce', 'phishing',
      'singlesignon', 'passkey', 'revocation', 'fingerprint', 'challenge',
      'throttle', 'audit',
    ],
  },
  {
    slug: 'billing',
    label: 'billing',
    words: [
      'invoice', 'subscription', 'proration', 'refund', 'chargeback',
      'currency', 'tax', 'ledger', 'payment', 'gateway', 'dunning',
      'receipt', 'discount', 'coupon', 'renewal', 'arrears',
      'reconciliation', 'surcharge', 'installment', 'creditnote',
      'invoiceline', 'settlement', 'payout', 'writeoff',
    ],
  },
  {
    slug: 'onboarding-ux',
    label: 'onboarding',
    words: [
      'welcome', 'tutorial', 'checklist', 'activation', 'tooltip',
      'walkthrough', 'milestone', 'setup', 'wizard', 'invite', 'trial',
      'firstrun', 'guidance', 'progress', 'completion', 'empty state',
      'stepper', 'nudge', 'sample data', 'guided tour', 'confetti',
      'skip button', 'placeholder', 'quickstart',
    ],
  },
  {
    slug: 'data-pipeline',
    label: 'data pipeline',
    words: [
      'ingestion', 'transform', 'schema', 'partition', 'batch',
      'streaming', 'retry', 'backfill', 'lineage', 'checkpoint',
      'throughput', 'latency', 'dedupe', 'watermark', 'sink', 'source',
      'orchestrator', 'consumer', 'offset', 'compaction', 'shard',
      'idempotency', 'materialize', 'staleness',
    ],
  },
  {
    slug: 'notification-delivery',
    label: 'notification',
    words: [
      'delivery', 'digest', 'template', 'throttling', 'unsubscribe',
      'webhook', 'push', 'escalation', 'retrypolicy', 'channel',
      'preference', 'mute', 'batching', 'deliverywindow', 'inbox',
      'bounce', 'suppression', 'deeplink', 'quiethours', 'fanout',
      'subscriber', 'digestcadence', 'opt-in', 'deliverability',
    ],
  },
  {
    slug: 'performance-tuning',
    label: 'performance',
    words: [
      'latency', 'caching', 'indexing', 'profiling', 'bottleneck',
      'throughput', 'concurrency', 'memory', 'garbagecollection',
      'benchmark', 'regression', 'scaling', 'tuning', 'hotspot',
      'threadpool', 'coldstart', 'warmup', 'contention', 'pagefault',
      'p99latency', 'prefetch', 'batching', 'flamegraph', 'sampling',
    ],
  },
];

const SECTION_FRAMES = {
  'problem-definition': [
    'The core problem is that {clause}.',
    'Users repeatedly report friction because {clause}.',
    'Left unresolved, {clause}, and adoption stalls.',
    'The recurring symptom teams flag is that {clause}.',
  ],
  assumptions: [
    'We assume that {clause}.',
    'This plan holds as valid the claim that {clause}, pending validation.',
    'A working assumption going into this cycle: {clause}.',
    'Until proven otherwise, we treat it as given that {clause}.',
  ],
  research: [
    'Prior research on comparable products shows {clause}.',
    'Field notes from three pilot teams confirm {clause}.',
    'Benchmarking across vendors surfaced evidence that {clause}.',
    'A literature scan of similar systems found that {clause}.',
  ],
  decisions: [
    'Decision: we will proceed on the basis that {clause}.',
    'After review, the team decided that {clause}.',
    'The agreed direction is that {clause}, effective this cycle.',
    'Ruling: going forward, {clause}.',
  ],
};

function mulberry32(seed) {
  let s = seed;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function titleCase(s) {
  return s
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function buildClause(topicLabel, words) {
  const w0 = words[0] || 'the system';
  const w1 = words[1] || 'related components';
  const w2 = words[2] || 'behavior';
  const w3 = words[3] || 'configuration';
  const w4 = words[4] || 'timing';
  return (
    `${topicLabel} handling of ${w0} interacts with ${w1}; teams noted that ` +
    `${w2} depends on ${w3} and ${w4}, especially under real production load`
  );
}

function generateBody(sectionKey, topicLabel, words, rng) {
  const frames = SECTION_FRAMES[sectionKey];
  const shuffled = shuffle(words, rng);
  const sentences = [];
  for (let s = 0; s < 4; s += 1) {
    const frame = frames[s % frames.length];
    const slice = shuffled.slice(s * 5, s * 5 + 5);
    const clause = buildClause(topicLabel, slice);
    sentences.push(frame.replace('{clause}', clause));
  }
  return sentences.join(' ');
}

function generateRoom() {
  fs.rmSync(ROOM_DIR, { recursive: true, force: true });
  fs.mkdirSync(ROOM_DIR, { recursive: true });

  // Room-root identity file (skipped by discover_artifacts -- room-root files
  // are not part of any section, and STATE.md is also in SKIP_FILES). Present
  // purely so the fixture room reads as a real room on disk.
  fs.writeFileSync(
    path.join(ROOM_DIR, 'STATE.md'),
    '# Room State\n\nSynthetic fixture room for Phase 272 (rank-agreement gate).\n' +
      'Generated entirely by tests/fixtures/272/build-fixture-room.cjs -- no real ' +
      'user or venture data, per Canon Part 8.\n'
  );

  const allArtifacts = [];
  let seedCounter = 1000;

  for (const section of SECTIONS) {
    fs.mkdirSync(path.join(ROOM_DIR, section), { recursive: true });
    for (const topic of TOPICS) {
      for (let idx = 1; idx <= ARTIFACTS_PER_TOPIC_PER_SECTION; idx += 1) {
        seedCounter += 1;
        const rng = mulberry32(seedCounter);
        const body = generateBody(section, topic.label, topic.words, rng);
        const filenameStem = `${topic.slug}-${pad2(idx)}`;
        const filename = `${filenameStem}.md`;
        const title = `${titleCase(topic.label)} ${titleCase(section)} Note ${idx}`;
        const content = `# ${title}\n\n${body}\n`;
        fs.writeFileSync(path.join(ROOM_DIR, section, filename), content);
        allArtifacts.push({
          id: `${section}/${filenameStem}`,
          section,
          topicSlug: topic.slug,
          topicLabel: topic.label,
          title,
        });
      }
    }
  }

  return allArtifacts;
}

function buildCorpus(allArtifacts) {
  const rng = mulberry32(424242);
  const pairs = [];
  const seen = new Set();
  let guard = 0;

  while (pairs.length < 20 && guard < 20000) {
    guard += 1;
    const a = allArtifacts[Math.floor(rng() * allArtifacts.length)];
    const b = allArtifacts[Math.floor(rng() * allArtifacts.length)];
    if (a.id === b.id) continue;
    const key = [a.id, b.id].sort().join('||');
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
  }

  const queries = pairs.map(([a, b], i) => {
    const sameTopic = a.topicSlug === b.topicSlug;
    const sameSection = a.section === b.section;
    let expectedRelationship;
    if (sameTopic && !sameSection) {
      expectedRelationship =
        `structural transfer candidate: same ${a.topicLabel} pattern applied ` +
        `across ${a.section} -> ${b.section}`;
    } else if (!sameTopic && sameSection) {
      expectedRelationship =
        `differential candidate: ${a.topicLabel} and ${b.topicLabel} concerns ` +
        `coexist within the ${a.section} section`;
    } else if (sameTopic && sameSection) {
      expectedRelationship =
        `close variant: two ${a.topicLabel} notes filed in the same ` +
        `${a.section} section`;
    } else {
      expectedRelationship =
        `cross-cutting candidate between ${a.topicLabel}/${a.section} and ` +
        `${b.topicLabel}/${b.section}, no shared topic or section`;
    }
    return {
      id: `Q${pad2(i + 1)}`,
      source_artifact_id: a.id,
      target_artifact_id: b.id,
      expected_relationship: expectedRelationship,
    };
  });

  return {
    schema_version: '1',
    phase: '272',
    purpose:
      'Phase 272 room-artifact rank-agreement probe corpus -- 20 hand-selected ' +
      'artifact pairs from the Phase 272 synthetic fixture room, used only as ' +
      'documentation of representative pair relationships for future ' +
      'maintainers. This is NOT the 127.1 harness: it is not a Brain-' +
      'methodology query corpus (Phase 127.1 uses 1024-dim ' +
      'multilingual-e5-large query embeddings and is not reusable as data -- ' +
      'wrong dimensionality, wrong content). This corpus does NOT gate ' +
      'anything numerically itself; the rank-agreement gate in ' +
      'tests/272-rank-agreement.test.cjs compares the FULL pairwise output of ' +
      'the fixture room, not just these 20 named pairs. Schema modeled on ' +
      'tests/127.1-graphrag-overlap-corpus.json (schema_version, phase, ' +
      'purpose, source, queries[]) reusing SHAPE only, per RESEARCH.md ' +
      'Correction C-2.',
    source: 'tests/fixtures/272/room',
    queries,
  };
}

function main() {
  const allArtifacts = generateRoom();
  console.log(`Generated ${allArtifacts.length} artifacts under ${ROOM_DIR}`);

  const corpus = buildCorpus(allArtifacts);
  fs.writeFileSync(CORPUS_PATH, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(`Wrote ${corpus.queries.length} corpus queries to ${CORPUS_PATH}`);
}

main();
