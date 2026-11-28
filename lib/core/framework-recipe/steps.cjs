'use strict';

const { classifyCallResult, parseReferencePhases } = require('../dominant-design/theo-structure.cjs');
const { _proveKnownToolShape } = require('../part8-egress-guard.cjs');
const { capField, MAX_ROWS, CAP_RUNIT, CAP_OTHER } = require('../research-planner/sr-steps.cjs');

const CAP_TITLE = 120;
const STEP_READ_LIMIT_MS = 2000;
const OWN_TEXT_LABEL = 'These steps come from the MindrianOS method text, not from Theo this time.';
const OWN_TEXT_REASONS = Object.freeze([
  Object.freeze({ reason: 'pws_differs', class: 'own text by row', theo_state: 'not_called', enqueue: false }),
  Object.freeze({ reason: 'unknown_framework', class: 'no call may be made here', theo_state: 'not_called', enqueue: false }),
  Object.freeze({ reason: 'route_not_cleared', class: 'no call may be made here', theo_state: 'not_called', enqueue: false }),
  ...['call_threw','theo_refusal','brain_unavailable','egress_blocked','shape_refused','refused','theo_timeout'].map(reason => Object.freeze({ reason, class: 'Theo unreachable', theo_state: 'silent', enqueue: false })),
  ...['not_served','no_steps_in_canon','step_unauthored','no_runnable_steps'].map(reason => Object.freeze({ reason, class: 'Theo has no steps', theo_state: 'silent', enqueue: true })),
]);
const NOT_AUTHORED_CODES = Object.freeze([]);
const OPEN_ITEMS_HEADING = 'Open items';
const WALK_STOP_LINE = 'Nothing is filed until the method ends. Your answers so far are in this conversation only.';
const WALK_RESTART_LINE = 'That method walk closed before its end, so nothing from it is in your room. We start again from step 1.';

function uniqueStepTitles(steps) {
  const seen = new Set();
  return (steps || []).map(step => {
    const out = Object.assign({}, step);
    const key = String(out.title || '').toLowerCase();
    if (seen.has(key)) out.title = String(out.title || '') + ' (step ' + out.n + ')';
    seen.add(key);
    return out;
  });
}

function isProcessStepId(id) {
  return typeof id === 'string' && !!_proveKnownToolShape({ framework: 'Red Teaming', step_id: id }, 'framework_step');
}

function cutPhasesSection(text) {
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  const start = lines.findIndex(line => /^## Phases\s*$/.test(line));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^## /.test(lines[i])) { end = i; break; }
  return lines.slice(start + 1, end).join('\n');
}

function readOwnText(text, ownFlow) {
  const section = cutPhasesSection(text);
  if (section === null) return { refusal: 'own_text_missing' };
  const phases = parseReferencePhases(section);
  if (phases.length < 2) return { refusal: 'own_text_missing' };
  const lines = section.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) if (/^### Phase \d+:/.test(lines[i])) starts.push(i);
  const steps = phases.map((phase, index) => {
    const from = starts[index];
    const to = index + 1 < starts.length ? starts[index + 1] : lines.length;
    let title = phase.name.split(' (')[0].trim().slice(0, CAP_TITLE);
    let bodyLines = lines.slice(from + 1, to);
    let endsWith, doneWhen;
    bodyLines = bodyLines.filter(line => {
      if (line.startsWith('What you end with:')) { endsWith = line.slice('What you end with:'.length).trim().slice(0, CAP_OTHER); return false; }
      if (line.startsWith('Done when:')) { doneWhen = line.slice('Done when:'.length).trim().slice(0, CAP_OTHER); return false; }
      return true;
    });
    const body = bodyLines.join('\n').trim().slice(0, CAP_RUNIT);
    const out = { n: index + 1, id: 'step-' + (index + 1), title, body };
    if (endsWith !== undefined) out.ends_with = endsWith;
    if (doneWhen !== undefined) out.done_when = doneWhen;
    return out;
  });
  return { steps: uniqueStepTitles(steps), flow: ownFlow || null };
}

function reasonForRefusal(code, notAuthoredCodes) {
  return (notAuthoredCodes || NOT_AUTHORED_CODES).includes(code) ? 'no_steps_in_canon' : 'theo_refusal';
}

function refusalResult(opts, code, notAuthoredCodes) {
  return ownResult(opts, reasonForRefusal(code, notAuthoredCodes));
}

function ownResult(opts, reason) {
  const own = readOwnText(opts.ownText, opts.ownFlow);
  if (own.refusal) return own;
  const record = OWN_TEXT_REASONS.find(x => x.reason === reason);
  const result = { framework: opts.framework, source: 'plugin_reference', reason, status: 'active', steps: own.steps, flow: own.flow, notices: [OWN_TEXT_LABEL] };
  if (record && record.enqueue) result.enqueue_needed = [{ framework: opts.framework, missing: ['structure'] }];
  return result;
}

function parseControl(value) {
  if (typeof value === 'string') { try { return JSON.parse(value); } catch (_) { return null; } }
  return value;
}
function rowFlow(rows, steps) {
  const byTail = new Map(steps.map(step => [String(step.id).split('::').pop(), step.n]));
  const seen = new Set(), controls = [], reasonDetail = [];
  for (const row of rows) {
    const raw = parseControl(row && row.controlJson);
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.controls) ? raw.controls : [];
    for (const control of list) {
      if (!control || typeof control.kind !== 'string' || !Array.isArray(control.action_ids)) continue;
      const key = JSON.stringify([control.kind, control.action_ids, control.condition || null, control.return_to || null]);
      if (seen.has(key)) continue;
      seen.add(key);
      const positions = control.action_ids.map(id => byTail.get(String(id).split('::').pop())).filter(Number.isFinite);
      if (!positions.length || positions.length !== control.action_ids.length) { reasonDetail.push('unknown control action'); continue; }
      const out = { kind: control.kind, steps: [...new Set(positions)] };
      if (typeof control.condition === 'string') out.condition = control.condition;
      if (typeof control.return_to === 'string') { const n = byTail.get(control.return_to.split('::').pop()); if (n) out.return_to = n; }
      controls.push(out);
    }
  }
  const flow = controls.length ? { controls } : null;
  if (!reasonDetail.length) return flow;
  return { flow, reason_detail: reasonDetail };
}

async function readSteps(input) {
  const opts = input || {};
  if (opts.play === 'own_text') return ownResult(opts, opts.playReason || 'pws_differs');
  let result;
  const limit = Number.isFinite(opts.limitMs) ? opts.limitMs : STEP_READ_LIMIT_MS;
  let timer;
  try {
    result = await Promise.race([
      Promise.resolve().then(() => opts.fetchRow()),
      new Promise(resolve => { timer = setTimeout(() => resolve(Symbol.for('404-timeout')), Math.max(0, limit)); }),
    ]);
  } catch (_) { return ownResult(opts, 'call_threw'); }
  finally { if (timer) clearTimeout(timer); }
  if (result === Symbol.for('404-timeout')) return ownResult(opts, 'theo_timeout');
  if (result && result.refusal && typeof result.refusal === 'object') return refusalResult(opts, result.refusal.code);
  const outcome = classifyCallResult('framework_step', result);
  if (outcome !== 'served') return ownResult(opts, outcome);
  const raw = result.rows[0].steps.slice(0, MAX_ROWS);
  const runnable = raw.filter(item => item && item.stepKind !== 'DEFINITION' && item.stepKind !== 'ASIDE');
  if (!runnable.length) return ownResult(opts, 'no_runnable_steps');
  if (runnable.some(item => typeof item.label !== 'string' || !item.label.trim() || typeof item.runIt !== 'string' || !item.runIt.trim())) return ownResult(opts, 'step_unauthored');
  const steps = uniqueStepTitles(runnable.map((item, index) => {
    const n = Number.isInteger(item.presentationOrder) ? item.presentationOrder : index + 1;
    const id = isProcessStepId(item.stepId) ? item.stepId : 'step-' + n;
    const authored = item.authoredContent && typeof item.authoredContent === 'object' ? item.authoredContent : {};
    const output = authored.expectedOutput || item.expectedOutput;
    const criteria = authored.transitionCriteria || item.transitionCriteria;
    const out = { n, id, title: capField('label', item.label).slice(0, CAP_TITLE), body: capField('runIt', item.runIt) };
    if (typeof output === 'string') out.ends_with = output.slice(0, CAP_OTHER);
    if (typeof criteria === 'string') out.done_when = criteria.slice(0, CAP_OTHER);
    return out;
  }));
  const built = rowFlow(runnable, steps);
  const resultOut = { framework: opts.framework, source: 'theo', reason: null, status: result.rows[0].orchestrationStatus || 'active', steps, flow: built && built.flow !== undefined ? built.flow : built, notices: [] };
  if (built && built.reason_detail) resultOut.reason_detail = built.reason_detail;
  return resultOut;
}

function artifactSourceLine(source, route) {
  if (source === 'plugin_reference') return OWN_TEXT_LABEL;
  if (source === 'theo' && route === 'chat') return 'Steps relayed by the assistant from Theo';
  if (source === 'theo') return 'Steps read from Theo through the guarded route';
  return '';
}

module.exports = { readSteps, readOwnText, uniqueStepTitles, isProcessStepId, OWN_TEXT_LABEL, OWN_TEXT_REASONS, NOT_AUTHORED_CODES, STEP_READ_LIMIT_MS, artifactSourceLine, reasonForRefusal, refusalResult, CAP_TITLE, OPEN_ITEMS_HEADING, WALK_STOP_LINE, WALK_RESTART_LINE };
