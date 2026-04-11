/**
 * MindrianOS Plugin -- Fabric Chat (NL to SQL)
 * Translates natural language questions into SQLite SQL queries
 * against the Room's Fabric (LazyGraph), executes them, and formats results.
 *
 * Uses BYOAPI pattern: user's Claude API key for NL-to-SQL translation.
 * Designed for both Node.js (CJS) and browser (IIFE) environments.
 *
 * Exports: nlToSQL, executeAndFormat, injectContext, GRAPH_SCHEMA
 */

'use strict';

// -- Graph Schema (all 14 Thread types + node properties) --

var GRAPH_SCHEMA = {
  nodeTypes: [
    {
      name: 'Artifact',
      properties: ['id TEXT PRIMARY KEY', 'title TEXT', 'section TEXT', 'methodology TEXT', 'created TEXT', 'content_hash TEXT'],
      description: 'A markdown knowledge Entry filed in a Room Section'
    },
    {
      name: 'Section',
      properties: ['name TEXT PRIMARY KEY', 'label TEXT'],
      description: 'A domain of knowledge (problem, market, solution, team, etc.)'
    }
  ],
  edgeTypes: [
    { name: 'INFORMS', from: 'Artifact', to: 'Artifact', properties: [], description: 'One Entry references another via wikilink' },
    { name: 'CONTRADICTS', from: 'Artifact', to: 'Artifact', properties: ['confidence TEXT'], description: 'Two Entries make opposing claims (a Tension)' },
    { name: 'CONVERGES', from: 'Artifact', to: 'Artifact', properties: ['term TEXT'], description: 'Same theme in 3+ Entries (a Pattern)' },
    { name: 'ENABLES', from: 'Artifact', to: 'Artifact', properties: [], description: 'One Entry unblocks another' },
    { name: 'INVALIDATES', from: 'Artifact', to: 'Artifact', properties: [], description: 'One Entry makes another stale' },
    { name: 'BELONGS_TO', from: 'Artifact', to: 'Section', properties: [], description: 'Entry is filed in a Section' },
    { name: 'REASONING_INFORMS', from: 'Section', to: 'Section', properties: ['provides TEXT'], description: 'Minto reasoning chain between Sections' },
    { name: 'HSI_CONNECTION', from: 'Artifact', to: 'Artifact', properties: ['hsi_score REAL', 'lsa_sim REAL', 'semantic_sim REAL', 'surprise_type TEXT', 'breakthrough_potential REAL', 'tier TEXT'], description: 'Hidden Structural Insight -- a Surprise connection' },
    { name: 'REVERSE_SALIENT', from: 'Section', to: 'Section', properties: ['differential_score REAL', 'innovation_type TEXT', 'source_artifact TEXT', 'target_artifact TEXT', 'innovation_thesis TEXT'], description: 'Bottleneck -- where understanding lags behind ambition (Hughes 1983)' },
    { name: 'ANALOGOUS_TO', from: 'Artifact', to: 'Artifact', properties: ['analogy_distance TEXT', 'structural_fitness REAL', 'source_domain TEXT', 'transfer_map TEXT', 'discovery_method TEXT'], description: 'Design-by-Analogy cross-domain bridge' },
    { name: 'STRUCTURALLY_ISOMORPHIC', from: 'Section', to: 'Section', properties: ['isomorphism_score REAL', 'mapped_elements TEXT', 'source TEXT'], description: 'Identical relational topology between Sections' },
    { name: 'RESOLVES_VIA', from: 'Artifact', to: 'Artifact', properties: ['resolution_type TEXT', 'triz_principle TEXT', 'analogy_source TEXT', 'confidence REAL'], description: 'Contradiction resolved via analogy or TRIZ principle' },
    { name: 'CAUSES', from: 'Artifact', to: 'Artifact', properties: ['mechanism TEXT', 'confidence REAL', 'framework TEXT', 'direction TEXT'], description: 'One Entry directly causes or triggers effects in another' },
    { name: 'ROOT_CAUSE_OF', from: 'Artifact', to: 'Artifact', properties: ['chain_length INTEGER', 'intermediate_causes TEXT', 'confidence REAL', 'discovery_source TEXT'], description: 'Traces backward to the root cause of a problem chain' }
  ],
  sampleQueries: [
    { question: 'What entries are in the problem-definition section?', sql: "SELECT n2.title, n2.id FROM edges e JOIN nodes n1 ON e.target = n1.id JOIN nodes n2 ON e.source = n2.id WHERE e.type = 'BELONGS_TO' AND n1.id = 'problem-definition'" },
    { question: 'What contradictions exist in this room?', sql: "SELECT n1.title AS from_entry, n2.title AS to_entry, json_extract(e.properties, '$.confidence') AS confidence FROM edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'CONTRADICTS'" },
    { question: 'Show all surprises with high breakthrough potential', sql: "SELECT n1.title, n2.title, json_extract(e.properties, '$.hsi_score') AS hsi_score, json_extract(e.properties, '$.surprise_type') AS surprise_type FROM edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'HSI_CONNECTION' AND CAST(json_extract(e.properties, '$.breakthrough_potential') AS REAL) > 0.7" },
    { question: 'Which sections have bottlenecks?', sql: "SELECT n1.id AS lagging, n2.id AS leading, json_extract(e.properties, '$.differential_score') AS differential_score, json_extract(e.properties, '$.innovation_thesis') AS innovation_thesis FROM edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'REVERSE_SALIENT'" },
    { question: 'How many entries per section?', sql: "SELECT n2.id AS section, n2.title AS label, COUNT(*) AS entry_count FROM edges e JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'BELONGS_TO' GROUP BY n2.id ORDER BY entry_count DESC" },
    { question: 'What cross-domain analogies exist?', sql: "SELECT n1.title, n2.title, json_extract(e.properties, '$.analogy_distance') AS analogy_distance, json_extract(e.properties, '$.source_domain') AS source_domain FROM edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'ANALOGOUS_TO'" },
    { question: 'What causes what in this room?', sql: "SELECT n1.title AS cause, n2.title AS effect, json_extract(e.properties, '$.mechanism') AS mechanism FROM edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'CAUSES'" },
    { question: 'What are the root causes of problems?', sql: "SELECT n1.title AS root_cause, n2.title AS symptom, json_extract(e.properties, '$.chain_length') AS chain_length FROM edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id WHERE e.type = 'ROOT_CAUSE_OF'" }
  ]
};

/**
 * Build the schema description string for the NL-to-SQL system prompt.
 * @param {object} [schema] - Optional custom schema override
 * @returns {string} Schema description for LLM context
 */
function buildSchemaDescription(schema) {
  var s = schema || GRAPH_SCHEMA;
  var lines = [];

  lines.push('## SQLite Graph Schema');
  lines.push('');
  lines.push('Database: room/.mindrian/room.db');
  lines.push('Tables: nodes (id, label, section, title, metadata JSON), edges (source, target, type, weight, properties JSON)');
  lines.push('');
  lines.push('### Node Types (stored in nodes.label)');
  for (var i = 0; i < s.nodeTypes.length; i++) {
    var nt = s.nodeTypes[i];
    lines.push('- ' + nt.name + ': ' + nt.description);
    lines.push('  Properties (in metadata JSON): ' + nt.properties.join(', '));
  }

  lines.push('');
  lines.push('### Edge Types (stored in edges.type) -- 14 Thread Types');
  for (var j = 0; j < s.edgeTypes.length; j++) {
    var et = s.edgeTypes[j];
    var propsStr = et.properties.length > 0 ? ' [' + et.properties.join(', ') + ']' : '';
    lines.push('- ' + et.name + ' (' + et.from + ' -> ' + et.to + ')' + propsStr + ': ' + et.description);
  }

  lines.push('');
  lines.push('### Sample Queries');
  for (var k = 0; k < s.sampleQueries.length; k++) {
    var sq = s.sampleQueries[k];
    lines.push('Q: ' + sq.question);
    lines.push('SQL: ' + sq.sql);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build the system prompt for NL-to-SQL translation.
 * @param {object} [schema] - Optional custom schema override
 * @returns {string} System prompt
 */
function buildNlToSQLPrompt(schema) {
  var schemaDesc = buildSchemaDescription(schema);

  return [
    'You are a SQLite SQL query translator for MindrianOS.',
    'Your job is to convert natural language questions about a Room\'s knowledge graph (the Fabric) into valid SQLite SQL queries.',
    '',
    'RULES:',
    '1. Return ONLY the SQL query -- no explanation, no markdown fencing, no preamble.',
    '2. The database has two main tables: nodes (id, label, section, title, metadata JSON) and edges (source, target, type, weight, properties JSON).',
    '3. Use json_extract(properties, \'$.key\') to access edge properties and json_extract(metadata, \'$.key\') for node metadata.',
    '4. String comparisons are case-sensitive. Use LOWER() for case-insensitive matching.',
    '5. Always use meaningful column aliases (AS ...) for readability.',
    '6. If the question is ambiguous, write a broad query that returns useful results.',
    '7. For graph traversals, JOIN edges with nodes: edges e JOIN nodes n1 ON e.source = n1.id JOIN nodes n2 ON e.target = n2.id.',
    '8. LIMIT results to 25 unless the user asks for all.',
    '9. Use GROUP BY with aggregate functions (COUNT, AVG, etc.).',
    '10. For path queries use recursive CTEs: WITH RECURSIVE path AS (...).',
    '',
    schemaDesc
  ].join('\n');
}

// -- NL to SQL Translation (Browser-compatible, uses fetch) --

/**
 * Translate a natural language question to a SQLite SQL query.
 * Uses the Anthropic Messages API (BYOAPI) via fetch.
 *
 * @param {string} question - Natural language question
 * @param {string} apiKey - User's Anthropic API key
 * @param {object} [options] - Optional overrides
 * @param {object} [options.schema] - Custom graph schema
 * @param {string} [options.model] - Model ID (default: claude-haiku-4-20250414)
 * @returns {Promise<{sql: string, error?: string}>}
 */
async function nlToSQL(question, apiKey, options) {
  options = options || {};
  var model = options.model || 'claude-haiku-4-20250414';
  var systemPrompt = buildNlToSQLPrompt(options.schema);

  if (!apiKey) {
    return { sql: '', error: 'No API key provided' };
  }

  if (!question || !question.trim()) {
    return { sql: '', error: 'No question provided' };
  }

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      var errMsg = 'API error (' + response.status + ')';
      try {
        var errJson = JSON.parse(errText);
        if (errJson.error && errJson.error.message) errMsg = errJson.error.message;
      } catch (_) {}
      return { sql: '', error: errMsg };
    }

    var data = await response.json();
    var sql = '';
    if (data.content && data.content.length > 0) {
      sql = data.content[0].text.trim();
      // Strip any markdown code fencing the model might add despite instructions
      sql = sql.replace(/^```(?:sql)?\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    return { sql: sql };
  } catch (err) {
    return { sql: '', error: 'Connection error: ' + (err.message || 'unknown') };
  }
}

// Backward-compat alias
var nlToCypher = nlToSQL;

/**
 * Execute a SQL query against SQLite room.db and format results as a chat-friendly response.
 * For Node.js server-side use (requires lazygraph-ops.cjs connection).
 *
 * @param {string} sql - SQL query string
 * @param {object} conn - better-sqlite3 Database object (from lazygraph-ops openGraph)
 * @returns {Promise<{rows: Array<object>, formatted: string, error?: string}>}
 */
async function executeAndFormat(sql, conn) {
  if (!sql) {
    return { rows: [], formatted: 'No query to execute.', error: 'Empty query' };
  }

  try {
    var rows = conn.prepare(sql).all();

    if (!rows || rows.length === 0) {
      return { rows: [], formatted: 'No results found for this query.' };
    }

    // Format as markdown table
    var keys = Object.keys(rows[0]);
    var headerRow = '| ' + keys.join(' | ') + ' |';
    var sepRow = '| ' + keys.map(function() { return '---'; }).join(' | ') + ' |';
    var dataRows = rows.map(function(row) {
      return '| ' + keys.map(function(k) {
        var val = row[k];
        if (val === null || val === undefined) return '--';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }).join(' | ') + ' |';
    });

    var formatted = headerRow + '\n' + sepRow + '\n' + dataRows.join('\n');

    // Add count summary
    formatted += '\n\n*' + rows.length + ' result' + (rows.length === 1 ? '' : 's') + ' returned.*';

    return { rows: rows, formatted: formatted };
  } catch (err) {
    return { rows: [], formatted: '', error: 'Query error: ' + (err.message || 'unknown') };
  }
}

/**
 * Build a context injection string from a clicked graph element.
 * Used when Constellation node/edge clicks inject context into the chat.
 *
 * @param {string} nodeId - The ID of the clicked node (artifact id or section name)
 * @param {string} nodeType - 'Artifact' or 'Section'
 * @param {string} [label] - Display label of the node
 * @returns {string} A natural language question to inject into chat
 */
function injectContext(nodeId, nodeType, label) {
  var displayName = label || nodeId;

  if (nodeType === 'Section') {
    return 'Tell me about the ' + displayName + ' section. What entries does it contain and what are its key connections?';
  }

  if (nodeType === 'Artifact') {
    return 'Tell me about the entry "' + displayName + '". What does it connect to and what threads involve it?';
  }

  // Generic fallback
  return 'Tell me about "' + displayName + '".';
}

// -- Module exports --

// Node.js CJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GRAPH_SCHEMA: GRAPH_SCHEMA,
    buildSchemaDescription: buildSchemaDescription,
    nlToSQL: nlToSQL,
    nlToCypher: nlToCypher, // backward-compat alias
    executeAndFormat: executeAndFormat,
    injectContext: injectContext
  };
}

// Browser global
if (typeof window !== 'undefined') {
  window.FabricChat = {
    GRAPH_SCHEMA: GRAPH_SCHEMA,
    buildSchemaDescription: buildSchemaDescription,
    nlToSQL: nlToSQL,
    nlToCypher: nlToCypher, // backward-compat alias
    executeAndFormat: executeAndFormat,
    injectContext: injectContext
  };
}
