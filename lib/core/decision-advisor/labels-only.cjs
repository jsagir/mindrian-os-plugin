'use strict';
// Phase 399-04 (D-03, I-11): the labels-only validator.
// Only labels may reach a decision provider: job ids and their vocabulary summaries, definition levels,
// command names and their registry teaching text, and the fixed question templates.
// Every key and every string leaf is checked by exact code-point membership in those closed sets.
// A request that carries anything else is REFUSED, never stripped (the refuse-never-strip idiom of
// scripts/jev-devtime-client.cjs). Pure: no network, no environment read.
// Phase 400-07 (CY-06): the Cynefin closed sets join the catalog additively: context.cause_effect_domain
// (5 domain ids) and the fits_domain_v1 and move_type_v1 templates (5 move ids with fixed glosses).
// Phase 400: catalogFingerprint is the one skew check shared by the plugin client and the decision relay (Pitfall 12).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const axes = require('../problem-axes.cjs');

const REFUSAL_REASONS = Object.freeze([
  'not_an_object',
  'unknown_key',
  'free_text_outside_label_set',
  'unknown_job',
  'unknown_command',
  'unknown_template',
  'unknown_type',
  'too_deep',
  'too_many_nodes',
  'not_finite',
  'body_not_render_of_validated_request',
]);

const MAX_DEPTH = 8;
const MAX_NODES = 200000;
const TOP_KEYS = ['context', 'questions'];
const CONTEXT_KEYS = ['job_id', 'job_summary', 'definition_level', 'wicked', 'last_command', 'cause_effect_domain'];
const QUESTION_KEYS = ['type', 'template', 'subject', 'options'];
const QUESTION_ID = /^q\d{4}$/;

let cached = null;

function adapter() {
  // Lazy: adapter.cjs requires this file at load time.
  return require('./adapter.cjs');
}

function buildLabelCatalog(opts) {
  const o = opts || {};
  if (!o.vocabulary && !o.registry && cached) return cached;
  const root = path.resolve(__dirname, '..', '..', '..');
  const vocab = o.vocabulary || JSON.parse(fs.readFileSync(path.join(root, 'data', 'job-vocabulary.json'), 'utf8'));
  const registry = o.registry || JSON.parse(fs.readFileSync(path.join(root, 'data', 'command-registry.json'), 'utf8'));
  const jobs = new Map();
  for (const id of Object.keys(vocab.jobs || {})) {
    const s = vocab.jobs[id] && vocab.jobs[id].summary;
    if (typeof s === 'string' && s.length) jobs.set(id, s);
  }
  const commands = new Map();
  for (const c of registry.commands || []) {
    if (c && typeof c.command === 'string' && typeof c.teaching === 'string' && c.teaching.length) {
      commands.set(c.command, c.teaching);
    }
  }
  const A = adapter();
  const catalog = {
    jobs,
    commands,
    definitionLevels: new Set(axes.DEFINITION_LEVELS),
    templates: new Set(Object.keys(A.QUESTION_TEMPLATES).concat(Object.keys(A.DOMAIN_TEMPLATES))),
    domains: new Set(axes.CAUSE_EFFECT_DOMAINS),
    moveTypes: new Set(axes.MOVE_TYPES),
  };
  if (!o.vocabulary && !o.registry) cached = catalog;
  return catalog;
}

// Canonical JSON: object keys sorted at every depth, array order kept.
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
    return out;
  }
  return v;
}

function sortedPairs(entries) {
  return Array.from(entries).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

let cachedFingerprint = null;

// One sha256 over the canonical catalog. The client and the relay both call this function, so a
// catalog skew between them (vocabulary, registry teaching text, template wording, move glosses)
// shows as two different values. Map and object insertion order do not change the value.
// opts.templates and opts.moveTypeGlosses are test seams; the defaults are the adapter maps.
function catalogFingerprint(catalog, opts) {
  const o = opts || {};
  const seam = Boolean(o.templates || o.moveTypeGlosses);
  const isDefault = !catalog || catalog === cached;
  if (isDefault && !seam && cachedFingerprint) return cachedFingerprint;
  const cat = catalog || buildLabelCatalog();
  const A = adapter();
  const templates = o.templates || Object.assign({}, A.QUESTION_TEMPLATES, A.DOMAIN_TEMPLATES);
  const glosses = o.moveTypeGlosses || A.MOVE_TYPE_GLOSSES;
  const doc = {
    v: 1,
    jobs: sortedPairs(cat.jobs.entries()),
    commands: sortedPairs(cat.commands.entries()),
    definition_levels: Array.from(cat.definitionLevels || axes.DEFINITION_LEVELS),
    domains: Array.from(cat.domains || axes.CAUSE_EFFECT_DOMAINS),
    move_types: Array.from(cat.moveTypes || axes.MOVE_TYPES),
    templates: sortedPairs(Object.keys(templates).map((id) => [id, canon(templates[id])])),
    move_type_glosses: canon(glosses),
    none_option: [A.NONE_OPTION_ID, A.NONE_OPTION_GLOSS],
  };
  const value = crypto.createHash('sha256').update(JSON.stringify(doc), 'utf8').digest('hex');
  if (isDefault && !seam && cat === cached) cachedFingerprint = value;
  return value;
}

function refuse(reason, p) {
  return { ok: false, reason, path: p };
}

// Walk every value. Iterative, so a circular or deep input cannot overflow the stack.
function scan(root) {
  const stack = [[root, 0, '$']];
  let nodes = 0;
  while (stack.length) {
    const [v, depth, p] = stack.pop();
    nodes += 1;
    if (nodes > MAX_NODES) return refuse('too_many_nodes', p);
    if (depth > MAX_DEPTH) return refuse('too_deep', p);
    const t = typeof v;
    if (v === null || t === 'string' || t === 'boolean') continue;
    if (t === 'number') {
      if (!Number.isFinite(v)) return refuse('not_finite', p);
      continue;
    }
    if (t !== 'object') return refuse('not_an_object', p);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) stack.push([v[i], depth + 1, p + '[' + i + ']']);
    } else {
      for (const k of Object.keys(v)) stack.push([v[k], depth + 1, p + '.' + k]);
    }
  }
  return null;
}

function isPlain(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function extraKey(obj, allowed) {
  for (const k of Object.keys(obj)) if (allowed.indexOf(k) === -1) return k;
  return null;
}

function validateQuestion(q, qp, catalog, A, ctx) {
  if (!isPlain(q)) return refuse('not_an_object', qp);
  const extra = extraKey(q, QUESTION_KEYS);
  if (extra !== null) return refuse('unknown_key', qp + '.' + extra);
  if (typeof q.template !== 'string' || !catalog.templates.has(q.template)) return refuse('unknown_template', qp + '.template');
  const spec = A.templateSpec(q.template);
  if (!spec) return refuse('unknown_template', qp + '.template');
  // A domain template asks about the domain named in the context; without one it has no meaning.
  if (spec.needs_domain && !(ctx && 'cause_effect_domain' in ctx)) return refuse('unknown_template', qp + '.template');
  if (q.type !== spec.type) return refuse('unknown_type', qp + '.type');
  if (spec.needs === 'subject') {
    if ('options' in q) return refuse('unknown_key', qp + '.options');
    if (typeof q.subject !== 'string' || !catalog.commands.has(q.subject)) return refuse('unknown_command', qp + '.subject');
    return null;
  }
  // needs options
  if ('subject' in q) return refuse('unknown_key', qp + '.subject');
  const opts = q.options;
  const none = A.NONE_OPTION_ID;
  let ids;
  if (Array.isArray(opts)) {
    ids = opts;
    for (let i = 0; i < ids.length; i += 1) {
      if (typeof ids[i] !== 'string' || (ids[i] !== none && !catalog.commands.has(ids[i]))) return refuse('unknown_command', qp + '.options[' + i + ']');
    }
  } else if (isPlain(opts)) {
    ids = Object.keys(opts);
    for (const id of ids) {
      if (id !== none && !catalog.commands.has(id)) return refuse('unknown_command', qp + '.options.' + id);
      const gloss = id === none ? A.NONE_OPTION_GLOSS : catalog.commands.get(id);
      if (opts[id] !== gloss) return refuse('free_text_outside_label_set', qp + '.options.' + id);
    }
  } else {
    return refuse('unknown_command', qp + '.options');
  }
  if (ids.length === 0) return refuse('unknown_command', qp + '.options');
  if (new Set(ids).size !== ids.length) return refuse('unknown_command', qp + '.options');
  return null;
}

function validateStructure(req, catalog) {
  const A = adapter();
  if (!isPlain(req)) return refuse('not_an_object', '$');
  const extra = extraKey(req, TOP_KEYS);
  if (extra !== null) return refuse('unknown_key', '$.' + extra);
  const ctx = req.context;
  if (!isPlain(ctx)) return refuse('not_an_object', '$.context');
  if (!isPlain(req.questions)) return refuse('not_an_object', '$.questions');
  const cx = extraKey(ctx, CONTEXT_KEYS);
  if (cx !== null) return refuse('unknown_key', '$.context.' + cx);
  if (typeof ctx.job_id !== 'string' || !catalog.jobs.has(ctx.job_id)) return refuse('unknown_job', '$.context.job_id');
  if ('job_summary' in ctx && ctx.job_summary !== catalog.jobs.get(ctx.job_id)) return refuse('free_text_outside_label_set', '$.context.job_summary');
  if ('definition_level' in ctx && (typeof ctx.definition_level !== 'string' || !catalog.definitionLevels.has(ctx.definition_level))) {
    return refuse('free_text_outside_label_set', '$.context.definition_level');
  }
  if ('wicked' in ctx && typeof ctx.wicked !== 'boolean') return refuse('not_an_object', '$.context.wicked');
  if ('last_command' in ctx && (typeof ctx.last_command !== 'string' || !catalog.commands.has(ctx.last_command))) {
    return refuse('unknown_command', '$.context.last_command');
  }
  if ('cause_effect_domain' in ctx) {
    const domains = catalog.domains || new Set(axes.CAUSE_EFFECT_DOMAINS);
    if (typeof ctx.cause_effect_domain !== 'string' || !domains.has(ctx.cause_effect_domain)) {
      return refuse('free_text_outside_label_set', '$.context.cause_effect_domain');
    }
  }
  const ids = Object.keys(req.questions);
  if (ids.length === 0) return refuse('not_an_object', '$.questions');
  for (const id of ids) {
    if (!QUESTION_ID.test(id)) return refuse('unknown_key', '$.questions.' + id);
    const bad = validateQuestion(req.questions[id], '$.questions.' + id, catalog, A, ctx);
    if (bad) return bad;
  }
  return null;
}

// Never throws. Returns { ok: true } or { ok: false, reason, path }.
function validateNeutralRequest(req, catalog) {
  try {
    const cat = catalog || buildLabelCatalog();
    const scanned = scan(req);
    if (scanned) return scanned;
    const bad = validateStructure(req, cat);
    return bad || { ok: true };
  } catch (_e) {
    return refuse('not_an_object', '$');
  }
}

function jsonEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !jsonEqual(a[k], b[k])) return false;
  }
  return true;
}

// A body is acceptable only when it is exactly the provider render of a validated request.
// `providers` is a test seam; the default is the adapter's PROVIDERS.
function validateProviderBody(providerId, body, req, catalog, providers) {
  try {
    const cat = catalog || buildLabelCatalog();
    const v = validateNeutralRequest(req, cat);
    if (!v.ok) return v;
    const A = adapter();
    const table = providers || A.PROVIDERS;
    const provider = table && Object.prototype.hasOwnProperty.call(table, providerId) ? table[providerId] : null;
    if (!provider) return refuse('body_not_render_of_validated_request', 'provider');
    const model = body && typeof body === 'object' ? body.model : undefined;
    const expected = provider.buildBody(A.renderRequest(req, cat), { model });
    return jsonEqual(body, expected) ? { ok: true } : refuse('body_not_render_of_validated_request', 'body');
  } catch (_e) {
    return refuse('body_not_render_of_validated_request', 'body');
  }
}

module.exports = { buildLabelCatalog, validateNeutralRequest, validateProviderBody, REFUSAL_REASONS, catalogFingerprint };
