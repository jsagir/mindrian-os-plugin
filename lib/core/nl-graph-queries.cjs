/**
 * MindrianOS Plugin -- Natural Language Graph Query Templates
 * Maps natural language intent patterns to parameterized SQL queries.
 * Larry/host LLM calls translateQuery(intent, params) to get SQL
 * that lazygraph-ops.cjs queryGraph can execute.
 *
 * Exports: translateQuery, executeNLQuery, QUERY_TEMPLATES
 */

'use strict';

/**
 * Query template definitions mapping intent names to parameterized SQL builders.
 * Each template has: description, params (required parameter names), build function.
 * build() returns { sql, bindings } for use with node:sqlite prepared statements.
 */
const QUERY_TEMPLATES = {

  contradictions: {
    description: 'Find artifacts that contradict a given artifact or section',
    params: ['target'],
    build: (p) => ({
      sql: "SELECT e.source, json_extract(n.properties, '$.title') AS title, json_extract(e.properties, '$.confidence') AS confidence FROM edges e JOIN nodes n ON e.source = n.id WHERE e.type = 'CONTRADICTS' AND e.target = ?",
      bindings: [p.target]
    })
  },

  neighbors: {
    description: 'Find all nodes connected to a given node (incoming + outgoing)',
    params: ['nodeId'],
    build: (p) => ({
      sql: "SELECT 'outgoing' AS direction, e.target AS neighbor, e.type AS rel, json_extract(n.properties, '$.title') AS title FROM edges e JOIN nodes n ON e.target = n.id WHERE e.source = ? UNION ALL SELECT 'incoming' AS direction, e.source AS neighbor, e.type AS rel, json_extract(n.properties, '$.title') AS title FROM edges e JOIN nodes n ON e.source = n.id WHERE e.target = ?",
      bindings: [p.nodeId, p.nodeId]
    })
  },

  path: {
    description: 'Find shortest path between two nodes (up to 2 hops)',
    params: ['from', 'to'],
    build: (p) => ({
      sql: "SELECT e1.source AS start, e1.type AS rel1, e1.target AS mid, e2.type AS rel2, e2.target AS end FROM edges e1 JOIN edges e2 ON e1.target = e2.source WHERE e1.source = ? AND e2.target = ? UNION ALL SELECT source AS start, type AS rel1, target AS mid, NULL AS rel2, NULL AS end FROM edges WHERE source = ? AND target = ?",
      bindings: [p.from, p.to, p.from, p.to]
    })
  },

  stats: {
    description: 'Graph statistics: node and edge counts by type',
    params: [],
    build: () => ({
      sql: "SELECT 'nodes' AS category, type, COUNT(*) AS count FROM nodes GROUP BY type UNION ALL SELECT 'edges' AS category, type, COUNT(*) AS count FROM edges GROUP BY type",
      bindings: []
    })
  },

  section_artifacts: {
    description: 'List all artifacts in a section with titles',
    params: ['section'],
    build: (p) => ({
      sql: "SELECT id, json_extract(properties, '$.title') AS title, json_extract(properties, '$.methodology') AS methodology, json_extract(properties, '$.created') AS created FROM nodes WHERE type = 'Artifact' AND json_extract(properties, '$.section') = ?",
      bindings: [p.section]
    })
  },

  hsi_connections: {
    description: 'Find high-surprise HSI connections sorted by score',
    params: ['min_score'],
    build: (p) => ({
      sql: "SELECT e.source, e.target, json_extract(e.properties, '$.hsi_score') AS hsi_score, json_extract(e.properties, '$.surprise_type') AS surprise_type, json_extract(n1.properties, '$.title') AS source_title, json_extract(n2.properties, '$.title') AS target_title FROM edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'HSI_CONNECTION' AND CAST(json_extract(e.properties, '$.hsi_score') AS REAL) >= ? ORDER BY CAST(json_extract(e.properties, '$.hsi_score') AS REAL) DESC",
      bindings: [p.min_score || 0.5]
    })
  },

  reverse_salients: {
    description: 'Find reverse salients (lagging sections)',
    params: [],
    build: () => ({
      sql: "SELECT e.source, e.target, json_extract(e.properties, '$.differential_score') AS diff_score, json_extract(e.properties, '$.innovation_type') AS innovation_type, json_extract(e.properties, '$.innovation_thesis') AS thesis FROM edges e WHERE e.type = 'REVERSE_SALIENT' ORDER BY CAST(json_extract(e.properties, '$.differential_score') AS REAL) DESC",
      bindings: []
    })
  },

  causal_claims: {
    description: 'Find causal claims with their cause-mechanism-effect chains',
    params: [],
    build: () => ({
      sql: "SELECT id, json_extract(properties, '$.cause') AS cause, json_extract(properties, '$.mechanism') AS mechanism, json_extract(properties, '$.effect') AS effect, json_extract(properties, '$.confidence') AS confidence, json_extract(properties, '$.domain') AS domain FROM nodes WHERE type = 'CausalClaim' ORDER BY CAST(json_extract(properties, '$.confidence') AS REAL) DESC",
      bindings: []
    })
  },

  whitespace_zones: {
    description: 'Find whitespace zones (innovation gaps) with hypotheses',
    params: [],
    build: () => ({
      sql: "SELECT id, json_extract(properties, '$.brain_framework') AS framework, json_extract(properties, '$.hypothesis') AS hypothesis, json_extract(properties, '$.strategic_rank') AS strategic_rank, json_extract(properties, '$.exploration_status') AS status FROM nodes WHERE type = 'WhitespaceZone' ORDER BY CAST(json_extract(properties, '$.strategic_rank') AS REAL) DESC",
      bindings: []
    })
  },

  convergence: {
    description: 'Find artifacts that converge (appear in 3+ edge types as source)',
    params: [],
    build: () => ({
      sql: "SELECT e.source AS artifact, json_extract(n.properties, '$.title') AS title, COUNT(DISTINCT e.type) AS edge_type_count, GROUP_CONCAT(DISTINCT e.type) AS edge_types FROM edges e JOIN nodes n ON e.source = n.id GROUP BY e.source HAVING COUNT(DISTINCT e.type) >= 3 ORDER BY edge_type_count DESC",
      bindings: []
    })
  },

};

/**
 * Translate a natural language intent to parameterized SQL.
 * @param {string} intent - Query intent key (e.g. 'contradictions', 'neighbors')
 * @param {object} [params={}] - Parameters for the query template
 * @returns {{ sql: string, bindings: Array, description: string } | { error: string }}
 */
function translateQuery(intent, params = {}) {
  const template = QUERY_TEMPLATES[intent];
  if (!template) {
    const available = Object.keys(QUERY_TEMPLATES).join(', ');
    return { error: `Unknown query intent: '${intent}'. Available: ${available}` };
  }

  // Validate required params
  for (const required of template.params) {
    if (params[required] === undefined || params[required] === null) {
      return { error: `Missing required parameter '${required}' for intent '${intent}'` };
    }
  }

  const { sql, bindings } = template.build(params);
  return { sql, bindings, description: template.description };
}

/**
 * Execute a natural language query against the graph.
 * Convenience wrapper: translates intent to SQL, executes via prepared statement.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} intent - Query intent key
 * @param {object} [params={}] - Parameters for the query template
 * @returns {{ rows: Array<object>, description: string, intent: string } | { error: string }}
 */
function executeNLQuery(conn, intent, params = {}) {
  const translated = translateQuery(intent, params);
  if (translated.error) {
    return { error: translated.error };
  }

  try {
    const stmt = conn.prepare(translated.sql);
    const rows = translated.bindings.length > 0
      ? stmt.all(...translated.bindings)
      : stmt.all();
    return { rows, description: translated.description, intent };
  } catch (e) {
    return { error: `Query execution failed: ${e.message}`, intent };
  }
}

module.exports = {
  translateQuery,
  executeNLQuery,
  QUERY_TEMPLATES,
};
