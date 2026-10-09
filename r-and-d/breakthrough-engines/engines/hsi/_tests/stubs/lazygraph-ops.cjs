'use strict';
// In-memory stand-in for lib/core/lazygraph-ops.cjs. State lives on globalThis.__GRAPH so tests can seed and inspect it.
function state() {
  if (!globalThis.__GRAPH) globalThis.__GRAPH = { nodes: {}, sections: {}, edges: [], deleted: [], zones: [], links: [], near: [], begun: 0, committed: 0 };
  return globalThis.__GRAPH;
}
function conn() {
  const g = state();
  return {
    prepare(sql) {
      return {
        run(...a) {
          if (/^BEGIN/.test(sql)) g.begun++;
          else if (/^COMMIT/.test(sql)) g.committed++;
          else if (/^DELETE FROM edges/.test(sql)) g.deleted.push(sql);
          else if (/^INSERT INTO edges/.test(sql)) g.edges.push({ source: a[0], target: a[1], type: a[2], props: JSON.parse(a[3]) });
        },
        get(id) {
          if (/FROM nodes WHERE id = \? AND type = 'Artifact'/.test(sql)) return g.nodes[id] ? { id } : undefined;
          if (/type = 'Section'/.test(sql)) return g.sections[id] ? { id } : undefined;
          return undefined;
        },
        all(id) {
          if (/BELONGS_TO/.test(sql)) return (g.nodes[id] && g.nodes[id].section) ? [{ section_name: g.nodes[id].section }] : [];
          return [];
        },
      };
    },
  };
}
async function openGraph() { return { db: { closed: false }, conn: conn() }; }
async function closeGraph(db) { db.closed = true; }
async function addWhitespaceZone(_c, props) { state().zones.push(props); }
async function linkWhitespaceToArtifact(_c, zoneId, artifactId, w) {
  if (typeof artifactId !== 'string') throw new Error('artifact id must be a string');
  if (!state().nodes[artifactId]) throw new Error('artifact not in graph: ' + artifactId);
  state().links.push({ zoneId, artifactId, w });
}
async function linkWhitespaceToSection(_c, zoneId, section, w) { state().near.push({ zoneId, section, w }); }
module.exports = { openGraph, closeGraph, addWhitespaceZone, linkWhitespaceToArtifact, linkWhitespaceToSection };
