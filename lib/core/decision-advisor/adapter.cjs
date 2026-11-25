'use strict';
// Phase 399-04 (D-04, I-04): the provider-neutral decision adapter.
// One interface: a shared context plus typed questions (yes_no, choice, score) in,
// per-question probabilities out. Providers are pure body builders and response parsers.
// This module holds NO network code. askDecisionModel() sends through an injected transport
// function; the real transport is a dev-time script behind the egress policy (plan 05).
// The name `decide` is not used here: it belongs to the one governed reach path.
const labels = require('./labels-only.cjs');

const QUESTION_TYPES = Object.freeze(['yes_no', 'choice', 'score']);
const NONE_OPTION_ID = 'none_of_these';
const NONE_OPTION_GLOSS = 'None of these commands fits the job now.';

// Fixed question wording. serves_job_v1 reproduces the recorded yes/no run word for word.
const QUESTION_TEMPLATES = Object.freeze({
  serves_job_v1: Object.freeze({
    type: 'yes_no',
    needs: 'subject',
    prefix: 'Would running this command help a user get this job done? Command ',
  }),
  next_command_v1: Object.freeze({
    type: 'choice',
    needs: 'options',
    instructions: 'Which command should run next to get this job done? Pick the best fit, or ' + NONE_OPTION_ID + '.',
  }),
  fit_score_v1: Object.freeze({
    type: 'score',
    needs: 'subject',
    prefix: 'How well does this command fit the job? Command ',
    levels: Object.freeze(['Poor fit', 'Partial fit', 'Strong fit']),
  }),
});

// Phase 400-07 (CY-06): the Cynefin templates. They live in their own map so QUESTION_TEMPLATES keeps
// exactly its 3 ids (the 399 pin). fits_domain_v1 needs context.cause_effect_domain; move_type_v1 renders
// the 5 move types with fixed glosses, and a caller may not send options for it.
const DOMAIN_TEMPLATES = Object.freeze({
  fits_domain_v1: Object.freeze({
    type: 'yes_no',
    needs: 'subject',
    needs_domain: true,
    prefix: 'Does this command fit a situation in the cause and effect domain named above? Command ',
  }),
  move_type_v1: Object.freeze({
    type: 'choice',
    needs: 'subject',
    move_options: true,
    prefix: 'Which move does this command make? Command ',
  }),
});

const MOVE_TYPE_GLOSSES = Object.freeze({
  categorize: 'Sort the facts under a known practice.',
  analyze: 'Study the parts with expert analysis.',
  probe: 'Run a small safe-to-fail test and watch what happens.',
  act: 'Act at once to make the situation stable.',
  slice: 'Break the situation into parts that each fit one domain.',
});

// One lookup for both template maps: QUESTION_TEMPLATES first, then DOMAIN_TEMPLATES, else null.
function templateSpec(id) {
  if (typeof id !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(QUESTION_TEMPLATES, id)) return QUESTION_TEMPLATES[id];
  if (Object.prototype.hasOwnProperty.call(DOMAIN_TEMPLATES, id)) return DOMAIN_TEMPLATES[id];
  return null;
}

const PROVIDER_FILES = Object.freeze({ gemini: './providers/gemini.cjs', jev: './providers/jev.cjs' });
const PROVIDERS = {};
for (const id of Object.keys(PROVIDER_FILES)) {
  // Lazy getters: the neutral layer loads without either provider.
  Object.defineProperty(PROVIDERS, id, {
    enumerable: true,
    get() { return require(PROVIDER_FILES[id]); },
  });
}
Object.freeze(PROVIDERS);

function renderContext(context, catalog) {
  const cat = catalog || labels.buildLabelCatalog();
  let s = 'Job to be done: ' + context.job_id + '. ' + cat.jobs.get(context.job_id);
  if (context.definition_level) s += ' Problem definition level: ' + context.definition_level + '.';
  if (context.cause_effect_domain) s += ' Cause and effect domain: ' + context.cause_effect_domain + '.';
  if (context.wicked === true) s += ' Wicked problem: yes.';
  if (context.last_command) s += ' Already run: ' + context.last_command + '.';
  return s;
}

function renderQuestion(q, cat) {
  const spec = templateSpec(q.template);
  if (spec.needs === 'subject') {
    const instructions = spec.prefix + q.subject + ': ' + cat.commands.get(q.subject);
    const out = { type: spec.type, instructions };
    if (spec.move_options) {
      const moves = cat.moveTypes ? Array.from(cat.moveTypes) : Object.keys(MOVE_TYPE_GLOSSES);
      out.options = {};
      for (const m of moves) out.options[m] = MOVE_TYPE_GLOSSES[m];
    }
    if (spec.levels) out.levels = spec.levels.slice();
    return out;
  }
  const ids = (Array.isArray(q.options) ? q.options : Object.keys(q.options)).filter((id) => id !== NONE_OPTION_ID);
  const options = {};
  for (const id of ids) options[id] = cat.commands.get(id);
  options[NONE_OPTION_ID] = NONE_OPTION_GLOSS;
  return { type: spec.type, instructions: spec.instructions, options };
}

// Fail closed: an invalid request has no render.
function renderRequest(req, catalog) {
  const cat = catalog || labels.buildLabelCatalog();
  const v = labels.validateNeutralRequest(req, cat);
  if (!v.ok) throw new Error('decision-advisor: request refused: ' + v.reason + ' at ' + v.path);
  const questions = {};
  for (const id of Object.keys(req.questions)) questions[id] = renderQuestion(req.questions[id], cat);
  return { context: renderContext(req.context, cat), questions };
}

function chunkRequest(req, maxQuestions) {
  if (!Number.isInteger(maxQuestions) || maxQuestions < 1) throw new RangeError('maxQuestions must be a positive integer');
  const ids = Object.keys(req.questions);
  const chunks = [];
  for (let i = 0; i < ids.length; i += maxQuestions) {
    const questions = {};
    for (const id of ids.slice(i, i + maxQuestions)) questions[id] = req.questions[id];
    chunks.push({ context: req.context, questions });
  }
  return chunks;
}

// opts: { provider: 'gemini' | 'jev', transport, catalog, providers (test seam), model }
// transport(body, { provider, chunkIndex }) must resolve to the parsed JSON response.
async function askDecisionModel(req, opts) {
  const o = opts || {};
  const cat = o.catalog || labels.buildLabelCatalog();
  const table = o.providers || PROVIDERS;
  const first = labels.validateNeutralRequest(req, cat);
  if (!first.ok) return { ok: false, reason: first.reason, path: first.path };
  const provider = typeof o.provider === 'string' && Object.prototype.hasOwnProperty.call(table, o.provider) ? table[o.provider] : null;
  if (!provider) return { ok: false, reason: 'unknown_provider' };
  if (typeof o.transport !== 'function') return { ok: false, reason: 'no_transport' };
  const chunks = chunkRequest(req, provider.MAX_QUESTIONS);
  const answers = {};
  const usage = { input_tokens: 0, output_tokens: 0 };
  for (let i = 0; i < chunks.length; i += 1) {
    const rendered = renderRequest(chunks[i], cat);
    const body = provider.buildBody(rendered, { model: o.model });
    const checked = labels.validateProviderBody(o.provider, body, chunks[i], cat, table);
    if (!checked.ok) return { ok: false, reason: checked.reason, path: checked.path };
    let response;
    try {
      response = await o.transport(body, { provider: o.provider, chunkIndex: i });
    } catch (_e) {
      return { ok: false, reason: 'transport_error' };
    }
    const parsed = provider.parseResponse(response, rendered.questions);
    Object.assign(answers, parsed.answers);
    usage.input_tokens += parsed.usage.input_tokens;
    usage.output_tokens += parsed.usage.output_tokens;
  }
  return { ok: true, provider: o.provider, chunks: chunks.length, answers, usage };
}

module.exports = {
  QUESTION_TYPES,
  QUESTION_TEMPLATES,
  DOMAIN_TEMPLATES,
  MOVE_TYPE_GLOSSES,
  templateSpec,
  NONE_OPTION_ID,
  NONE_OPTION_GLOSS,
  PROVIDERS,
  renderContext,
  renderRequest,
  chunkRequest,
  askDecisionModel,
};
