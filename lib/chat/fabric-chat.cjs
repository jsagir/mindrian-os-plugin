/**
 * MindrianOS Plugin -- Fabric Chat (NL to Cypher)
 * Translates natural language questions into KuzuDB Cypher queries
 * against the Room's Fabric (LazyGraph), executes them, and formats results.
 *
 * Uses BYOAPI pattern: user's Claude API key for NL-to-Cypher translation.
 * Designed for both Node.js (CJS) and browser (IIFE) environments.
 *
 * Exports: nlToCypher, executeAndFormat, injectContext, GRAPH_SCHEMA
 */

'use strict';

// -- Graph Schema (all 12 Thread types + node properties) --

var GRAPH_SCHEMA = {
  nodeTypes: [
    {
      name: 'Artifact',
      properties: ['id (STRING, PRIMARY KEY)', 'title (STRING)', 'section (STRING)', 'methodology (STRING)', 'created (STRING)', 'content_hash (STRING)'],
      description: 'A markdown knowledge Entry filed in a Room Section'
    },
    {
      name: 'Section',
      properties: ['name (STRING, PRIMARY KEY)', 'label (STRING)'],
      description: 'A domain of knowledge (problem, market, solution, team, etc.)'
    }
  ],
  edgeTypes: [
    { name: 'INFORMS', from: 'Artifact', to: 'Artifact', properties: [], description: 'One Entry references another via wikilink' },
    { name: 'CONTRADICTS', from: 'Artifact', to: 'Artifact', properties: ['confidence (STRING)'], description: 'Two Entries make opposing claims (a Tension)' },
    { name: 'CONVERGES', from: 'Artifact', to: 'Artifact', properties: ['term (STRING)'], description: 'Same theme in 3+ Entries (a Pattern)' },
    { name: 'ENABLES', from: 'Artifact', to: 'Artifact', properties: [], description: 'One Entry unblocks another' },
    { name: 'INVALIDATES', from: 'Artifact', to: 'Artifact', properties: [], description: 'One Entry makes another stale' },
    { name: 'BELONGS_TO', from: 'Artifact', to: 'Section', properties: [], description: 'Entry is filed in a Section' },
    { name: 'REASONING_INFORMS', from: 'Section', to: 'Section', properties: ['provides (STRING)'], description: 'Minto reasoning chain between Sections' },
    { name: 'HSI_CONNECTION', from: 'Artifact', to: 'Artifact', properties: ['hsi_score (DOUBLE)', 'lsa_sim (DOUBLE)', 'semantic_sim (DOUBLE)', 'surprise_type (STRING)', 'breakthrough_potential (DOUBLE)', 'tier (STRING)'], description: 'Hidden Structural Insight -- a Surprise connection' },
    { name: 'REVERSE_SALIENT', from: 'Section', to: 'Section', properties: ['differential_score (DOUBLE)', 'innovation_type (STRING)', 'source_artifact (STRING)', 'target_artifact (STRING)', 'innovation_thesis (STRING)'], description: 'Bottleneck -- where understanding lags behind ambition (Hughes 1983)' },
    { name: 'ANALOGOUS_TO', from: 'Artifact', to: 'Artifact', properties: ['analogy_distance (STRING)', 'structural_fitness (DOUBLE)', 'source_domain (STRING)', 'transfer_map (STRING)', 'discovery_method (STRING)'], description: 'Design-by-Analogy cross-domain bridge' },
    { name: 'STRUCTURALLY_ISOMORPHIC', from: 'Section', to: 'Section', properties: ['isomorphism_score (DOUBLE)', 'mapped_elements (STRING)', 'source (STRING)'], description: 'Identical relational topology between Sections' },
    { name: 'RESOLVES_VIA', from: 'Artifact', to: 'Artifact', properties: ['resolution_type (STRING)', 'triz_principle (STRING)', 'analogy_source (STRING)', 'confidence (DOUBLE)'], description: 'Contradiction resolved via analogy or TRIZ principle' }
  ],
  sampleQueries: [
    { question: 'What entries are in the problem-definition section?', cypher: "MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section {name: 'problem-definition'}) RETURN a.title, a.id" },
    { question: 'What contradictions exist in this room?', cypher: "MATCH (a:Artifact)-[r:CONTRADICTS]->(b:Artifact) RETURN a.title AS from_entry, b.title AS to_entry, r.confidence" },
    { question: 'Show all surprises with high breakthrough potential', cypher: "MATCH (a:Artifact)-[r:HSI_CONNECTION]->(b:Artifact) WHERE r.breakthrough_potential > 0.7 RETURN a.title, b.title, r.hsi_score, r.surprise_type" },
    { question: 'Which sections have bottlenecks?', cypher: "MATCH (s1:Section)-[r:REVERSE_SALIENT]->(s2:Section) RETURN s1.name AS lagging, s2.name AS leading, r.differential_score, r.innovation_thesis" },
    { question: 'How many entries per section?', cypher: "MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section) RETURN s.name, s.label, count(a) AS entry_count ORDER BY entry_count DESC" },
    { question: 'What cross-domain analogies exist?', cypher: "MATCH (a:Artifact)-[r:ANALOGOUS_TO]->(b:Artifact) RETURN a.title, b.title, r.analogy_distance, r.source_domain, r.structural_fitness" }
  ]
};

/**
 * Build the schema description string for the NL-to-Cypher system prompt.
 * @param {object} [schema] - Optional custom schema override
 * @returns {string} Schema description for LLM context
 */
function buildSchemaDescription(schema) {
  var s = schema || GRAPH_SCHEMA;
  var lines = [];

  lines.push('## KuzuDB Graph Schema');
  lines.push('');
  lines.push('### Node Tables');
  for (var i = 0; i < s.nodeTypes.length; i++) {
    var nt = s.nodeTypes[i];
    lines.push('- ' + nt.name + ': ' + nt.description);
    lines.push('  Properties: ' + nt.properties.join(', '));
  }

  lines.push('');
  lines.push('### Relationship Tables (12 Thread Types)');
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
    lines.push('Cypher: ' + sq.cypher);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build the system prompt for NL-to-Cypher translation.
 * @param {object} [schema] - Optional custom schema override
 * @returns {string} System prompt
 */
function buildNlToCypherPrompt(schema) {
  var schemaDesc = buildSchemaDescription(schema);

  return [
    'You are a KuzuDB Cypher query translator for MindrianOS.',
    'Your job is to convert natural language questions about a Room\'s knowledge graph (the Fabric) into valid KuzuDB Cypher queries.',
    '',
    'RULES:',
    '1. Return ONLY the Cypher query -- no explanation, no markdown fencing, no preamble.',
    '2. KuzuDB uses standard Cypher syntax. Use MATCH, WHERE, RETURN, ORDER BY, LIMIT.',
    '3. String comparisons are case-sensitive. Use toLower() for case-insensitive matching.',
    '4. Always RETURN meaningful aliases (AS ...) for readability.',
    '5. If the question is ambiguous, write a broad query that returns useful results.',
    '6. For counting, use count(*) or count(distinct ...).',
    '7. For "tell me about [X]", find the artifact by title or section and return its properties plus connections.',
    '8. LIMIT results to 25 unless the user asks for all.',
    '9. KuzuDB does not support OPTIONAL MATCH. Use separate queries if needed.',
    '10. KuzuDB does not support COLLECT or list comprehensions. Use simple aggregations.',
    '',
    schemaDesc
  ].join('\n');
}

// -- NL to Cypher Translation (Browser-compatible, uses fetch) --

/**
 * Translate a natural language question to a KuzuDB Cypher query.
 * Uses the Anthropic Messages API (BYOAPI) via fetch.
 *
 * @param {string} question - Natural language question
 * @param {string} apiKey - User's Anthropic API key
 * @param {object} [options] - Optional overrides
 * @param {object} [options.schema] - Custom graph schema
 * @param {string} [options.model] - Model ID (default: claude-haiku-4-20250414)
 * @returns {Promise<{cypher: string, error?: string}>}
 */
async function nlToCypher(question, apiKey, options) {
  options = options || {};
  var model = options.model || 'claude-haiku-4-20250414';
  var systemPrompt = buildNlToCypherPrompt(options.schema);

  if (!apiKey) {
    return { cypher: '', error: 'No API key provided' };
  }

  if (!question || !question.trim()) {
    return { cypher: '', error: 'No question provided' };
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
      return { cypher: '', error: errMsg };
    }

    var data = await response.json();
    var cypher = '';
    if (data.content && data.content.length > 0) {
      cypher = data.content[0].text.trim();
      // Strip any markdown code fencing the model might add despite instructions
      cypher = cypher.replace(/^```(?:cypher|sql)?\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    return { cypher: cypher };
  } catch (err) {
    return { cypher: '', error: 'Connection error: ' + (err.message || 'unknown') };
  }
}

/**
 * Execute a Cypher query against KuzuDB and format results as a chat-friendly response.
 * For Node.js server-side use (requires lazygraph-ops.cjs connection).
 *
 * @param {string} cypher - Cypher query string
 * @param {object} conn - KuzuDB Connection object
 * @returns {Promise<{rows: Array<object>, formatted: string, error?: string}>}
 */
async function executeAndFormat(cypher, conn) {
  if (!cypher) {
    return { rows: [], formatted: 'No query to execute.', error: 'Empty query' };
  }

  try {
    var result = await conn.query(cypher);
    var rows = await result.getAll();

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
    nlToCypher: nlToCypher,
    executeAndFormat: executeAndFormat,
    injectContext: injectContext
  };
}

// Browser global
if (typeof window !== 'undefined') {
  window.FabricChat = {
    GRAPH_SCHEMA: GRAPH_SCHEMA,
    buildSchemaDescription: buildSchemaDescription,
    nlToCypher: nlToCypher,
    executeAndFormat: executeAndFormat,
    injectContext: injectContext
  };
}
