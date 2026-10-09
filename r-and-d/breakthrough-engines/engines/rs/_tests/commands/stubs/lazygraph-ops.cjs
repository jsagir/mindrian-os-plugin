'use strict';
// HAND-MADE TEST STUB for the missing lazygraph-ops module.
// In-process tests call _setFixture({authors, edges}); child-process CLI tests
// point RS_TEST_FIXTURE at a JSON file {authors, edges, rows, throw}.
const fs = require('node:fs');
let fixture = { authors: [], edges: [], rows: [] };
let closed = 0;
function load() {
  if (process.env.RS_TEST_FIXTURE) return JSON.parse(fs.readFileSync(process.env.RS_TEST_FIXTURE, 'utf8'));
  return fixture;
}
function _setFixture(f) { fixture = f; closed = 0; }
function _closedCount() { return closed; }
async function openGraph(_roomDir) {
  const f = load();
  if (f.throw) throw new Error(f.throw);
  return {
    db: { id: 'db' },
    conn: {
      prepare(sql) {
        return { all() {
          if (/FROM nodes/.test(sql)) return f.authors || [];
          if (/FROM edges e1, edges e2/.test(sql)) {
            const m = sql.match(/LIMIT (\d+)/);
            return (f.edges || []).slice(0, m ? parseInt(m[1], 10) : Infinity);
          }
          return [];
        } };
      },
      fixture: f,
    },
  };
}
async function queryGraph(conn, sql, params) {
  const f = conn.fixture || load();
  if (/rs_discoveries WHERE id = \?/.test(sql)) return (f.rows || []).filter((r) => r.id === params[0]).slice(0, 1);
  return f.rows || [];
}
async function closeGraph(_db) { closed += 1; }
module.exports = { openGraph, closeGraph, queryGraph, _setFixture, _closedCount };
