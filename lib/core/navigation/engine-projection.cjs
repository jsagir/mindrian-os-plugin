'use strict';

// Purpose-bound, read-only projection for attached analysis engines.
// The caller supplies an explicit set of already-authorized node IDs. This
// module returns only selected content fields and edges induced by that set.
// It never resolves a room path, expands a neighborhood, or writes the graph.

const crypto = require('node:crypto');

const MAX_NODE_IDS = 2500;
const MAX_TEXT_CHARS = 4096;
const MAX_EDGES = 20000;
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const QUERY_CHUNK = 300;
const EXCLUDED_TYPES = new Set([
  'memory_event', 'focus', 'audit', 'memory_artifact', 'navigator_persona',
  'HatState', 'requirement', 'planning_artifact',
]);
const TEXT_KEYS = Object.freeze(['text', 'description', 'content', 'body', 'statement', 'claim', 'summary', 'abstract']);
const TITLE_KEYS = Object.freeze(['title', 'name', 'label']);
const ATTRIBUTE_KEYS = Object.freeze([
  'domain', 'problem_type', 'knowledge_type', 'epistemic_type', 'category', 'section', 'status',
]);
const EDGE_ATTRIBUTE_KEYS = Object.freeze([
  'effectiveness', 'confidence', 'transform', 'created_at',
  'evidence', 'pws_confidence', 'quarantine_source',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
}

function parseProperties(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function firstString(properties, keys) {
  for (const key of keys) {
    if (typeof properties[key] === 'string' && properties[key].trim()) return properties[key].trim();
  }
  return '';
}

function projectNode(row) {
  const properties = parseProperties(row.properties);
  const fullText = firstString(properties, TEXT_KEYS);
  const title = firstString(properties, TITLE_KEYS) || row.type || row.id;
  const text = fullText.slice(0, MAX_TEXT_CHARS);
  const attrs = {};
  for (const key of ATTRIBUTE_KEYS) {
    const value = properties[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') attrs[key] = value;
  }
  if (typeof row.review_status === 'string' && row.review_status) attrs.review_status = row.review_status;
  return {
    node: {
      id: row.id,
      labels: [row.type],
      name: title,
      text,
      attrs,
      source_ref: 'mindrian-graph://node/' + encodeURIComponent(row.id),
      text_sha256: sha256(fullText),
      text_truncated: fullText.length > text.length,
    },
    truncated: fullText.length > text.length,
  };
}

function projectEngineSnapshot(db, request) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('a caller-owned read-only database handle is required');
  const input = request && typeof request === 'object' ? request : {};
  const ids = input.node_ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_NODE_IDS) {
    throw new TypeError('node_ids must contain between 1 and ' + MAX_NODE_IDS + ' explicit IDs');
  }
  if (ids.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)) {
    throw new TypeError('each node ID must be a non-empty string of at most 200 characters');
  }
  if (new Set(ids).size !== ids.length) throw new TypeError('node_ids must be unique');
  if (typeof input.scope_id !== 'string' || !input.scope_id) throw new TypeError('scope_id must come from MindrianOS room identity');

  const sortedIds = [...ids].sort();
  const found = new Map();
  const nodeColumns = new Set(db.prepare('PRAGMA table_info(nodes)').all().map((column) => column.name));
  const reviewStatusSelect = nodeColumns.has('review_status') ? 'review_status' : 'NULL AS review_status';
  for (let offset = 0; offset < sortedIds.length; offset += QUERY_CHUNK) {
    const chunk = sortedIds.slice(offset, offset + QUERY_CHUNK);
    const marks = chunk.map(() => '?').join(',');
    const rows = db.prepare('SELECT id, type, properties, ' + reviewStatusSelect + ' FROM nodes WHERE id IN (' + marks + ')').all(...chunk);
    for (const row of rows) found.set(row.id, row);
  }

  const nodes = [];
  let excludedCount = 0;
  let truncatedTextCount = 0;
  let emptyTextCount = 0;
  for (const id of sortedIds) {
    const row = found.get(id);
    if (!row) continue;
    if (EXCLUDED_TYPES.has(row.type)) { excludedCount += 1; continue; }
    const projected = projectNode(row);
    nodes.push(projected.node);
    if (projected.truncated) truncatedTextCount += 1;
    if (!projected.node.text) emptyTextCount += 1;
  }
  const includedIds = nodes.map((node) => node.id);
  const edges = [];
  let edgesTruncated = false;
  const edgeColumns = new Set(db.prepare('PRAGMA table_info(edges)').all().map((column) => column.name));
  const edgePropertiesSelect = edgeColumns.has('properties') ? ', properties' : '';
  for (let offset = 0; offset < includedIds.length && !edgesTruncated; offset += QUERY_CHUNK) {
    const sourceChunk = includedIds.slice(offset, offset + QUERY_CHUNK);
    const sourceMarks = sourceChunk.map(() => '?').join(',');
    // Keep both endpoint predicates bounded and avoid returning any edge that
    // leaves the caller's explicit selection.
    for (let targetOffset = 0; targetOffset < includedIds.length && !edgesTruncated; targetOffset += QUERY_CHUNK) {
      const targetChunk = includedIds.slice(targetOffset, targetOffset + QUERY_CHUNK);
      const targetMarks = targetChunk.map(() => '?').join(',');
      const remaining = MAX_EDGES + 1 - edges.length;
      if (remaining <= 0) { edgesTruncated = true; break; }
      const rows = db.prepare(
        'SELECT source, target, type' + edgePropertiesSelect + ' FROM edges WHERE source IN (' + sourceMarks + ') AND target IN (' + targetMarks + ') ' +
        'ORDER BY source, target, type LIMIT ?'
      ).all(...sourceChunk, ...targetChunk, remaining);
      for (const row of rows) {
        if (edges.length === MAX_EDGES) { edgesTruncated = true; break; }
        const edge = { s: row.source, t: row.target, type: row.type };
        const properties = parseProperties(row.properties);
        const attrs = {};
        for (const key of EDGE_ATTRIBUTE_KEYS) {
          const value = properties[key];
          if ((key === 'effectiveness' || key === 'confidence') && typeof value === 'number' && Number.isFinite(value)) attrs[key] = value;
          if (key === 'transform' && typeof value === 'string') attrs[key] = value.slice(0, 1000);
          if (key === 'created_at' && typeof value === 'string') attrs[key] = value.slice(0, 128);
          if (key === 'evidence' && typeof value === 'string') attrs[key] = value.slice(0, 2000);
          if (key === 'pws_confidence' && ['low', 'medium', 'high'].includes(value)) attrs[key] = value;
          if (key === 'quarantine_source' && typeof value === 'string') attrs[key] = value.slice(0, 200);
        }
        if (Object.keys(attrs).length) edge.attrs = attrs;
        edges.push(edge);
      }
    }
  }

  const omissions = {
    requested_nodes: ids.length,
    missing_nodes: ids.length - found.size,
    excluded_system_nodes: excludedCount,
    empty_text_nodes: emptyTextCount,
    text_truncated_nodes: truncatedTextCount,
    edges_truncated: edgesTruncated,
  };
  const content = { scope_id: input.scope_id, nodes, edges, omissions };
  const snapshotId = sha256(stableJson(content));
  const snapshot = {
    nodes,
    edges,
    meta: {
      scope_id: input.scope_id,
      snapshot_id: snapshotId,
      projection_version: 'mindrian.engine-graph-projection.v3',
      selection_policy: 'explicit_node_ids_only',
      edge_policy: 'induced_edges_only',
      complete: omissions.missing_nodes === 0 && omissions.excluded_system_nodes === 0 &&
        omissions.empty_text_nodes === 0 && omissions.text_truncated_nodes === 0 && !edgesTruncated,
      omissions,
      omission_policy: {
        unselected_nodes: 'not queried',
        excluded_node_types: Array.from(EXCLUDED_TYPES),
        source_paths_and_unlisted_properties: 'omitted',
        per_node_text_limit_chars: MAX_TEXT_CHARS,
        edge_limit: MAX_EDGES,
      },
      generated_at: new Date().toISOString(),
      source_text_is_untrusted: true,
    },
  };
  const outputBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  if (outputBytes > MAX_OUTPUT_BYTES) {
    throw new RangeError('projected graph exceeds the ' + MAX_OUTPUT_BYTES + ' byte output limit; select fewer nodes');
  }
  return {
    ok: true,
    partial: !snapshot.meta.complete,
    projection_complete: snapshot.meta.complete,
    projection_omissions: omissions,
    scope_id: input.scope_id,
    snapshot_id: snapshotId,
    snapshot,
    handoff: {
      next_tool: 'scout_run_workflow',
      graph_capability: 'graph.explore_local_relationships',
      artifact_capability: 'graph.prepare_artifact_bundle',
      note: 'Send snapshot plus scope_id and snapshot_id to Eureka. Eureka returns analysis only; MindrianOS resolves references, applies review, and owns graph writes.',
    },
  };
}

module.exports = { projectEngineSnapshot, MAX_NODE_IDS, MAX_TEXT_CHARS, MAX_EDGES, MAX_OUTPUT_BYTES, EXCLUDED_TYPES, EDGE_ATTRIBUTE_KEYS };
