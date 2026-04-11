/**
 * MindrianOS Plugin -- SQLite Battle Test
 * Heavy edge cases: SQL injection, Unicode, 1MB content, rapid writes,
 * wikilink edges, contradiction detection, corrupt DB, empty files.
 *
 * Run: node tests/test-sqlite-battle.cjs
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const lg = require('../lib/core/lazygraph-ops.cjs');

let tmpDir, roomDir, conn;

const SECTIONS = ['problem-definition', 'market-analysis', 'solution-design'];

function writeArtifact(section, name, content) {
  const filePath = path.join(roomDir, section, name + '.md');
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('SQLITE-BATTLE: Edge case stress tests', async () => {
  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'battle-'));
    roomDir = path.join(tmpDir, 'room');
    SECTIONS.forEach(s => fs.mkdirSync(path.join(roomDir, s), { recursive: true }));
    const result = await lg.openGraph(roomDir);
    conn = result.conn;
  });

  after(async () => {
    await lg.closeGraph(conn);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('BATTLE-01: SQL injection resistance', () => {
    it('indexes artifact with SQL injection in title', async () => {
      const filePath = writeArtifact('problem-definition', 'evil-test',
        "---\ndate: 2026-01-01\n---\n# Robert'); DROP TABLE nodes;--\n\nContent with 'quotes' and \"doubles\".");
      const result = await lg.indexArtifact(conn, roomDir, filePath);
      assert.ok(result.id, 'artifact indexed');
    });

    it('nodes table survives injection attempt', () => {
      const count = conn.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
      assert.ok(count >= 2, 'nodes table intact with ' + count + ' rows');
    });

    it('preserves SQL payload verbatim in title', () => {
      const row = conn.prepare("SELECT properties FROM nodes WHERE id = 'problem-definition/evil-test'").get();
      const props = JSON.parse(row.properties);
      assert.ok(props.title.includes('DROP TABLE'), 'title contains DROP TABLE literally');
    });
  });

  describe('BATTLE-02: Unicode stress', () => {
    it('indexes artifact with multi-script Unicode content', async () => {
      const filePath = writeArtifact('market-analysis', 'unicode-test',
        '---\ndate: 2026-01-01\n---\n# \u00dc\u00f6\u00e4\u00df \u5168\u89d2 \u0410\u0411\u0412\n\n\u05d0\u05d1\u05d2 \u0e01\u0e02 \ud83d\ude80\ud83c\udf0d mixed scripts');
      const result = await lg.indexArtifact(conn, roomDir, filePath);
      assert.ok(result.id, 'unicode artifact indexed');
    });

    it('preserves Unicode title through JSON roundtrip', () => {
      const row = conn.prepare("SELECT properties FROM nodes WHERE id = 'market-analysis/unicode-test'").get();
      const props = JSON.parse(row.properties);
      assert.ok(props.title.includes('\u00dc\u00f6\u00e4\u00df'), 'German umlauts preserved');
      assert.ok(props.title.includes('\u5168\u89d2'), 'CJK preserved');
      assert.ok(props.title.includes('\u0410\u0411\u0412'), 'Cyrillic preserved');
    });
  });

  describe('BATTLE-03: Wikilink edge creation', () => {
    it('creates INFORMS edge from [[wikilink]] syntax', async () => {
      const filePath = writeArtifact('problem-definition', 'with-links',
        '---\ndate: 2026-01-01\n---\n# Linked\n\nSee [[market-analysis]] for details.');
      await lg.indexArtifact(conn, roomDir, filePath);
      const edges = conn.prepare("SELECT * FROM edges WHERE type = 'INFORMS'").all();
      assert.ok(edges.length >= 1, 'at least one INFORMS edge from wikilink');
    });
  });

  describe('BATTLE-04: Contradiction detection near wikilinks', () => {
    it('creates CONTRADICTS edge when contradiction term is near wikilink', async () => {
      const filePath = writeArtifact('solution-design', 'contradict',
        '---\ndate: 2026-01-01\n---\n# Contradictions\n\nHowever, this contradicts [[problem-definition]] completely.');
      await lg.indexArtifact(conn, roomDir, filePath);
      const edges = conn.prepare("SELECT * FROM edges WHERE type = 'CONTRADICTS'").all();
      assert.ok(edges.length >= 1, 'CONTRADICTS edge detected from context');
    });
  });

  describe('BATTLE-05: Large content (1MB)', () => {
    it('indexes 1MB artifact in under 500ms', async () => {
      const filePath = writeArtifact('problem-definition', 'big-artifact',
        '---\ndate: 2026-01-01\n---\n# Big\n\n' + 'x'.repeat(1024 * 1024));
      const start = Date.now();
      const result = await lg.indexArtifact(conn, roomDir, filePath);
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 500, '1MB indexed in ' + elapsed + 'ms (limit: 500ms)');
      assert.equal(result.contentHash.length, 8, 'content hash is 8 hex chars');
    });
  });

  describe('BATTLE-06: Rapid sequential writes (50x)', () => {
    it('writes 50 artifacts without error', async () => {
      const start = Date.now();
      for (let i = 0; i < 50; i++) {
        const f = writeArtifact('market-analysis', 'rapid-' + i,
          '---\ndate: 2026-01-01\n---\n# Rapid ' + i + '\n\nContent ' + i);
        await lg.indexArtifact(conn, roomDir, f);
      }
      const elapsed = Date.now() - start;
      const count = conn.prepare("SELECT COUNT(*) as c FROM nodes WHERE type = 'Artifact'").get().c;
      assert.ok(count >= 54, 'all artifacts persisted (got ' + count + ')');
      assert.ok(elapsed < 5000, '50 writes in ' + elapsed + 'ms (limit: 5s)');
    });
  });

  describe('BATTLE-07: rebuildGraph consistency', () => {
    it('re-indexes all artifacts from filesystem', async () => {
      const preBuild = conn.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
      await lg.rebuildGraph(conn, roomDir);
      const postBuild = conn.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
      assert.ok(postBuild >= 50, 'rebuild re-created ' + postBuild + ' nodes');
    });
  });

  describe('BATTLE-08: queryGraph SQL injection safety', () => {
    it('survives injection in query string', async () => {
      await lg.queryGraph(conn, "'; DROP TABLE nodes; --");
      const count = conn.prepare('SELECT COUNT(*) as c FROM nodes').get().c;
      assert.ok(count > 0, 'nodes table survived with ' + count + ' rows');
    });

    it('returns results for valid query', async () => {
      const results = await lg.queryGraph(conn, 'SELECT id, type FROM nodes LIMIT 5');
      assert.ok(Array.isArray(results), 'returns array');
      assert.ok(results.length > 0, 'has results');
    });
  });

  describe('BATTLE-09: graphStats shape', () => {
    it('returns node counts by type and edge counts by type', async () => {
      const stats = await lg.graphStats(conn);
      assert.ok(stats.nodes, 'has nodes breakdown');
      assert.ok(stats.edges, 'has edges breakdown');
      assert.ok(stats.total, 'has totals');
      assert.ok(stats.total.nodes > 0, 'node count > 0');
      assert.ok(stats.total.edges > 0, 'edge count > 0');
    });
  });

  describe('BATTLE-10: Empty .md file', () => {
    it('handles empty file without crash', async () => {
      const filePath = writeArtifact('problem-definition', 'empty', '');
      const result = await lg.indexArtifact(conn, roomDir, filePath);
      assert.ok(result.id, 'empty file indexed with id: ' + result.id);
    });
  });

  describe('BATTLE-11: Frontmatter-only file', () => {
    it('indexes file with frontmatter but no body', async () => {
      const filePath = writeArtifact('problem-definition', 'fm-only',
        '---\ndate: 2026-01-01\nmethodology: lean-canvas\n---\n');
      const result = await lg.indexArtifact(conn, roomDir, filePath);
      assert.ok(result.id, 'frontmatter-only file indexed');
    });
  });

  describe('BATTLE-12: Corrupt database detection', () => {
    it('rejects corrupt database file', async () => {
      const corruptDir = path.join(tmpDir, 'corrupt');
      fs.mkdirSync(path.join(corruptDir, '.mindrian'), { recursive: true });
      fs.writeFileSync(path.join(corruptDir, '.mindrian', 'room.db'), 'NOT_A_DATABASE');
      await assert.rejects(
        async () => {
          const { conn: c2 } = await lg.openGraph(corruptDir);
          c2.prepare('SELECT 1').get();
        },
        /./,
        'corrupt DB throws an error'
      );
    });
  });
});
