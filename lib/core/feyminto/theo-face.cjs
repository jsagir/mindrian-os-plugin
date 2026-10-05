'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.25 plan 08 -- the Theo face renderer (the BRAIN.md face; the file name stays for its referrers).
 * layer: graph
 *
 * WHAT THIS MODULE IS. One pure function. It turns three finished inputs into the text and the frontmatter of the
 * Theo face: the Theo ask result (plan 05, lib/core/feyminto/theo-ask.cjs), the capability marker (plan 06,
 * capability.cjs, passed in as a function) and the three local command sources (plan 06, command-sources.cjs, passed
 * in as a value). It reads no file, makes no call, writes nothing; the writer that puts the result on disk is plan 17.
 *
 * WHERE THE DESIGN COMES FROM. FEYMINTO-DESIGN-v2 "THEO face": relevant guidance; why it fits the unresolved
 * question; retrieval provenance; limitations; locally checked capability availability. FEYMINTO-ICM-AUDIT change
 * 4(a): link to CONTEXT.md section 2 and add only what the contract cannot know. Amendment 7, the Subject Audit:
 * every line says where it came from and what it cannot tell you.
 *
 * SHARED PREMISE (plan 08 decision on RESEARCH Open Question 4). Theo exposes no premise field. Two or more of the
 * recommended frameworks whose framework_neighborhood results list the same chapter id share a premise: the face
 * names the frameworks and the chapter label and says their agreement is one line of reasoning, not two. This is
 * what the plugin can compute today; THEO-PREP item 3 asks Theo for a real premise field.
 *
 * HONESTY RULES THIS MODULE KEEPS.
 *   - Provenance names only the handles that crossed the wire (ask.handles_on_wire, plan 05 carry-over). None of the
 *     four Theo reads takes the section or the job, so the face says plainly that they were not sent.
 *   - A face whose question never ran says why, from the closed not-asked set, and never fills the gap with a
 *     placeholder sentinel.
 *   - Every framework, operation and command line carries a capability label and a source tag. A suggestion has not
 *     run; the Limitations section says so.
 *   - Named-field reads only. No input object is spread or copied whole into the output (Canon Part 8: nothing from
 *     the room reaches a face that is read at session start). Theo's own strings are folded to one line and capped.
 *   - The banned agreement word and the empty-answer sentinel are scrubbed from every string this module returns.
 *     They are built from pieces below so this file does not carry them either.
 *
 * Operations. Theo's find_frameworks_for_problem_type chapters carry a phase label and tool types; they are shown as
 * the operations Theo lists for the lens. No command on this install is mapped to an operation, so each is marked
 * assisted.
 */

const THEO_FACE_HEADINGS = Object.freeze([
  '## Provenance',
  '## FeyMinto: what Theo suggests for this nest',
  '## Command sources for this nest',
  '## Why it fits the unresolved question',
  '## Limitations',
  '## Shared premise',
]);
const [H_PROV, H_SUGG, H_SRC, H_FITS, H_LIM, H_SHARED] = THEO_FACE_HEADINGS;

const MAX_WHY = 3; // Canon Part 3 Shape F MAX_K
const MAX_SUGGESTED_COMMANDS = 10;
const MAX_SUGGESTED_FRAMEWORKS = 6; // the recommend_chain max_steps
const MAX_TEXT = 200;
const BRIEF_LINK = '[BRIEF.md](BRIEF.md#the-question-that-matters-now)';
const LEDGER_TAG = 'ledger, see CONTEXT.md section 2';
const OPERATION_LABEL = 'assisted: Theo lists this step; nothing on this install is mapped to run it';
const UNKNOWN_COMMAND_LABEL = 'not a command on this install';
const UNCHECKED_LABEL = 'capability not checked';

const BANNED_STEM = new RegExp(['corro', 'borat'].join('') + '\\w*', 'gi');
const EMPTY_SENTINEL = '(no ' + 'signal)';

function scrub(s) {
  return String(s).split(EMPTY_SENTINEL).join('[withheld]').replace(BANNED_STEM, '[withheld]');
}

// A Theo-supplied or local string, folded to one line, capped, scrubbed.
function clean(v) {
  if (v === null || v === undefined) return '';
  return scrub(String(v).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT));
}

// A scalar for the frontmatter list values: commas inside a name are percent-encoded so a comma-joined list splits back.
function enc(v) { return clean(v).replace(/,/g, '%2C'); }
function joinList(a) { return a.map(enc).join(','); }

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }
function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

function nameList(names) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/**
 * sharedPremise(neighborhoods): neighborhoods is an array of framework_neighborhood results as theo-ask returns them
 * ({ framework|name, chapters: [{ id, label }] }). Returns [{ chapter_id, chapter_label, frameworks }] for every
 * chapter id listed by two or more distinct frameworks, sorted by chapter id.
 */
function sharedPremise(neighborhoods) {
  const byChapter = new Map();
  const seen = new Set();
  for (const n of arr(neighborhoods)) {
    if (!isObj(n)) continue;
    const fw = clean(typeof n.name === 'string' && n.name ? n.name : n.framework);
    if (!fw || seen.has(fw.toLowerCase())) continue;
    seen.add(fw.toLowerCase());
    const ids = new Set();
    for (const c of arr(n.chapters)) {
      if (!isObj(c) || typeof c.id !== 'string' || !c.id || ids.has(c.id)) continue;
      ids.add(c.id);
      if (!byChapter.has(c.id)) byChapter.set(c.id, { chapter_id: c.id, chapter_label: clean(c.label) || clean(c.id), frameworks: [] });
      byChapter.get(c.id).frameworks.push(fw);
    }
  }
  return [...byChapter.values()]
    .filter((e) => e.frameworks.length >= 2)
    .sort((a, b) => (a.chapter_id < b.chapter_id ? -1 : a.chapter_id > b.chapter_id ? 1 : 0));
}

function capOf(capabilityFor, name, kind) {
  if (typeof capabilityFor !== 'function') return { cli: 'unknown', mcp: 'unknown', label: UNCHECKED_LABEL };
  let c = null;
  try { c = capabilityFor(name, { kind }); } catch (_e) { c = null; }
  if (!isObj(c)) return { cli: 'unknown', mcp: 'unknown', label: UNCHECKED_LABEL };
  if (c.known === false) return { cli: 'unknown', mcp: 'unknown', label: UNKNOWN_COMMAND_LABEL };
  return {
    cli: typeof c.cli === 'string' ? c.cli : 'unknown',
    mcp: typeof c.mcp === 'string' ? c.mcp : 'unknown',
    label: typeof c.label === 'string' && c.label ? clean(c.label) : UNCHECKED_LABEL,
  };
}

function bareCommand(v) { return clean(v).replace(/^\/mos:/, ''); }

// ---- the asked-result readers ------------------------------------------------------------------------------
function frameworkEntries(results) {
  const out = [];
  const seen = new Set();
  for (const r of arr(results.route).slice().sort((a, b) => (num(a && a.step) || 0) - (num(b && b.step) || 0))) {
    const name = isObj(r) ? clean(r.framework) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, read: 'recommend_chain', in_route: true });
  }
  for (const n of arr(results.neighborhoods)) {
    const name = isObj(n) ? clean(typeof n.name === 'string' && n.name ? n.name : n.framework) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, read: 'framework_neighborhood', in_route: false });
  }
  return out;
}

function operationEntries(results) {
  const order = [];
  const byPhase = new Map();
  for (const c of arr(results.chapters)) {
    if (!isObj(c)) continue;
    const label = clean(c.phaseLabel) || clean(c.phase);
    if (!label) continue;
    if (!byPhase.has(label)) { byPhase.set(label, []); order.push(label); }
    const types = byPhase.get(label);
    for (const t of arr(c.toolTypes)) {
      const tt = clean(t);
      if (tt && types.indexOf(tt) === -1) types.push(tt);
    }
  }
  return order.map((label) => ({ phase: label, tool_types: byPhase.get(label) }));
}

function commandEntries(results) {
  const order = [];
  const byName = new Map();
  for (const r of arr(results.commands)) {
    if (!isObj(r)) continue;
    const name = bareCommand(r.command);
    if (!name) continue;
    if (!byName.has(name)) { byName.set(name, { name, jtbd: clean(r.jtbd), frameworks: [] }); order.push(name); }
    const e = byName.get(name);
    if (!e.jtbd) e.jtbd = clean(r.jtbd);
    const fw = clean(r.framework);
    if (fw && e.frameworks.indexOf(fw) === -1) e.frameworks.push(fw);
  }
  return order.map((n) => byName.get(n));
}

// ---- the sections ------------------------------------------------------------------------------------------
function wireHandles(ask) {
  // Returns { known, parts[], notSent } from handles_on_wire only.
  const onWire = Array.isArray(ask.handles_on_wire) ? ask.handles_on_wire : null;
  const sent = isObj(ask.handles_sent) ? ask.handles_sent : {};
  if (!onWire) return { known: false, lens: null, frameworks: [], parts: [], notSent: [] };
  const parts = [];
  let lens = null;
  let frameworks = [];
  if (onWire.indexOf('problem_type') !== -1 && typeof sent.problem_type === 'string' && sent.problem_type) {
    lens = clean(sent.problem_type);
    parts.push('lens ' + lens);
  }
  if (onWire.indexOf('section_kind') !== -1 && typeof sent.section_kind === 'string' && sent.section_kind) parts.push('section ' + clean(sent.section_kind));
  if (onWire.indexOf('job_id') !== -1 && typeof sent.job_id === 'string' && sent.job_id) parts.push('job ' + clean(sent.job_id));
  if (onWire.indexOf('frameworks') !== -1) {
    frameworks = arr(sent.frameworks).map(clean).filter(Boolean);
    if (frameworks.length > 0) parts.push('frameworks ' + frameworks.join(', '));
  }
  const notSent = [];
  if (typeof sent.section_kind === 'string' && sent.section_kind && onWire.indexOf('section_kind') === -1) notSent.push('section');
  if (typeof sent.job_id === 'string' && sent.job_id && onWire.indexOf('job_id') === -1) notSent.push('job');
  return { known: true, lens, frameworks, parts, notSent };
}

function totalRows(rows) {
  if (!isObj(rows)) return 0;
  return ['find_frameworks', 'commands', 'route', 'neighborhood'].reduce((s, k) => s + (num(rows[k]) || 0), 0);
}

function refusalPairs(ask) {
  return arr(ask.refusals).filter(isObj).map((r) => ({ tool: clean(r.tool), kind: clean(r.kind) })).filter((r) => r.tool || r.kind);
}

function provenanceParagraph(ask, asked, wire) {
  if (!asked) {
    const line = clean(ask.not_asked_line);
    const q = num(ask.queries_sent) || 0;
    const tail = q === 0 ? 'Nothing was sent.' : q + ' ' + (q === 1 ? 'query was' : 'queries were') + ' attempted and none was answered.';
    return line + '. ' + tail;
  }
  const handles = wire.known
    ? (wire.parts.length > 0 ? wire.parts.join(', ') : 'none')
    : 'not recorded';
  let sentence = 'Asked Theo (' + (clean(ask.origin) || 'origin not recorded') + ') at ' + (clean(ask.asked_at) || 'a time not recorded') +
    ' with these handles: ' + handles + '.';
  if (wire.notSent.length === 2) sentence += ' Section and job were not sent: none of the four Theo reads takes them (THEO-PREP item 1).';
  else if (wire.notSent.length === 1) sentence += ' ' + (wire.notSent[0] === 'section' ? 'Section' : 'Job') + ' was not sent: none of the four Theo reads takes it (THEO-PREP item 1).';
  const refusals = refusalPairs(ask).map((r) => r.tool + ': ' + r.kind);
  const q = num(ask.queries_sent) || 0;
  sentence += ' ' + q + ' ' + (q === 1 ? 'query' : 'queries') + ', ' + totalRows(ask.rows_returned) + ' rows, refusals: ' + (refusals.length > 0 ? refusals.join(', ') : 'none') + '.';
  return sentence;
}

function suggestionLines(ask, asked, ctx) {
  if (!asked) return { text: clean(ask.not_asked_line), recs: [], cmds: [], fws: [] };
  const results = isObj(ask.results) ? ask.results : {};
  const lines = [];
  const recs = [];

  const fws = frameworkEntries(results);
  if (fws.length === 0) lines.push('Frameworks: Theo returned none.');
  else {
    lines.push('Frameworks (the route in order, then any neighborhood framework not in the route):');
    fws.forEach((f, i) => {
      const c = capOf(ctx.capabilityFor, f.name, 'framework');
      const tag = 'theo ' + f.read;
      lines.push('- ' + (f.in_route ? 'Step ' + (i + 1) + ': ' : '') + f.name + ' - ' + c.label + ' (source: ' + tag + ')');
      recs.push({ kind: 'framework', name: f.name, capability: c, source: tag, rank: i + 1, in_route: f.in_route });
    });
  }

  const ops = operationEntries(results);
  if (ops.length === 0) lines.push('Operations: Theo returned none.');
  else {
    lines.push('Operations Theo lists for this lens:');
    ops.forEach((o, i) => {
      const tag = 'theo find_frameworks_for_problem_type';
      lines.push('- ' + o.phase + ': ' + (o.tool_types.length > 0 ? o.tool_types.join(', ') : 'no tool types listed') + ' - ' + OPERATION_LABEL + ' (source: ' + tag + ')');
      recs.push({ kind: 'operation', name: o.phase, capability: { cli: 'assisted', mcp: 'assisted', label: OPERATION_LABEL }, source: tag, rank: i + 1 });
    });
  }

  const cmds = commandEntries(results);
  if (cmds.length === 0) lines.push('Commands: Theo returned none.');
  else {
    const shown = cmds.slice(0, MAX_SUGGESTED_COMMANDS);
    lines.push('Commands (showing ' + shown.length + ' of ' + cmds.length + '):');
    shown.forEach((e, i) => {
      const c = capOf(ctx.capabilityFor, e.name, 'command');
      const tag = 'theo commands_for_problem_type';
      const job = e.jtbd || 'no job label';
      const fw = e.frameworks.length > 0 ? ' (framework: ' + e.frameworks.join(', ') + ')' : '';
      lines.push('- /mos:' + e.name + ' - ' + job + fw + ' - ' + c.label + ' (source: ' + tag + ')');
      recs.push({ kind: 'command', name: e.name, capability: c, source: tag, rank: i + 1, frameworks: e.frameworks.slice() });
    });
  }

  let marker = null;
  if (typeof ctx.sectionMarker === 'function') {
    try { marker = ctx.sectionMarker(ctx.section); } catch (_e) { marker = null; }
  } else if (typeof ctx.sectionMarker === 'string') marker = ctx.sectionMarker;
  if (typeof marker === 'string' && marker.length > 0) lines.push(clean(marker));

  return { text: lines.join('\n'), recs, cmds: recs.filter((r) => r.kind === 'command'), fws: recs.filter((r) => r.kind === 'framework') };
}

function sourceTags(name, src) {
  const tags = [];
  if (arr(src.contract && src.contract.names).indexOf(name) !== -1) tags.push('contract');
  if (arr(src.navigator_table && src.navigator_table.names).indexOf(name) !== -1) tags.push('navigator table');
  if (arr(src.ledger && src.ledger.names).indexOf(name) !== -1) tags.push(LEDGER_TAG);
  return tags;
}

function commandSourcesText(src, capabilityFor) {
  if (!isObj(src)) return 'The command sources were not read for this render.';
  const ledger = arr(src.ledger && src.ledger.names).map(bareCommand);
  const inOther = new Set([].concat(arr(src.contract && src.contract.names), arr(src.navigator_table && src.navigator_table.names)).map(bareCommand));
  const agreeWithOther = ledger.filter((n) => inOther.has(n)).length;
  const stamp = clean(src.ledger && src.ledger.provenance && src.ledger.provenance.stamp);
  const lines = [];
  lines.push('Ledger sequence: see [CONTEXT.md section 2](CONTEXT.md) (' + ledger.length + ' names; ' + agreeWithOther +
    ' agree with another source' + (stamp ? '; stamp ' + stamp : '') + ') (source: ' + LEDGER_TAG + ')');

  const line = (n, tags) => '- /mos:' + n + ' - ' + capOf(capabilityFor, n, 'command').label + ' (source: ' + tags.join('; ') + ')';
  const agreement = arr(src.agreement).map(bareCommand);
  if (agreement.length > 0) {
    lines.push('Listed by two or more sources:');
    agreement.forEach((n) => lines.push(line(n, sourceTags(n, src))));
  }
  // contract_only and table_only compare the two authored sources with each other, so a name can sit in both the
  // agreement list (the ledger also lists it) and in contract_only. Each name is printed once, in the agreement
  // block with every source that lists it; the single-source blocks below keep only what no other source lists.
  const printed = new Set(agreement);
  const contractOnly = arr(src.contract_only).map(bareCommand).filter((n) => !printed.has(n));
  if (contractOnly.length > 0) {
    lines.push('Only the section contract lists:');
    contractOnly.forEach((n) => lines.push(line(n, sourceTags(n, src))));
  }
  const tableOnly = arr(src.table_only).map(bareCommand).filter((n) => !printed.has(n));
  if (tableOnly.length > 0) {
    lines.push('Only the navigator table lists:');
    tableOnly.forEach((n) => lines.push(line(n, sourceTags(n, src))));
  }
  const ledgerOnly = arr(src.ledger_only).length;
  if (ledgerOnly > 0) lines.push(ledgerOnly + ' more ' + (ledgerOnly === 1 ? 'name is' : 'names are') + ' only in the ledger sequence; see CONTEXT.md section 2 (source: ' + LEDGER_TAG + ')');
  return lines.join('\n');
}

function whyItFitsText(ask, asked, wire, recs, section) {
  if (!asked) return 'Nothing to fit yet: Theo was not asked (' + clean(ask.not_asked) + ').';
  const sent = isObj(ask.handles_sent) ? ask.handles_sent : {};
  const job = typeof sent.job_id === 'string' && sent.job_id ? clean(sent.job_id) : null;
  const candidates = recs.filter((r) => r.kind === 'framework').concat(recs.filter((r) => r.kind === 'command')).slice(0, MAX_WHY);
  if (candidates.length === 0) return 'Nothing to fit yet: Theo returned no framework or command for this nest.';
  return candidates.map((r) => {
    const label = r.kind === 'command' ? '/mos:' + r.name : r.name;
    let why;
    if (r.kind === 'framework' && !r.in_route) why = 'Theo returned its neighborhood because this nest named it';
    else if (wire.lens) why = 'Theo lists it for the ' + wire.lens + ' lens';
    else why = 'Theo lists it for this nest';
    const jobClause = job ? '; this nest\'s job is ' + job + ', which Theo was not sent' : '';
    return label + ': ' + why + jobClause + '; the open question this nest is working on is in ' + BRIEF_LINK + '.';
  }).join('\n');
}

function limitationsText(ask, asked, wire) {
  const lines = [];
  const q = num(ask.queries_sent) || 0;
  if (asked) {
    lines.push('Theo answered for the lens, not for this nest: its problem-type reads take no section or job (THEO-PREP item 1).');
    lines.push('recommend_chain does not know which frameworks this nest already used (THEO-PREP item 2).');
    const cov = isObj(ask.results) && isObj(ask.results.coverage) ? ask.results.coverage : null;
    if (cov && num(cov.matched) !== null && num(cov.total) !== null) {
      lines.push('Chapter coverage for this lens: ' + cov.matched + ' of ' + cov.total + '.');
    } else if (wire.lens) {
      const n = num(ask.rows_returned && ask.rows_returned.find_frameworks) || 0;
      lines.push('Theo listed ' + n + ' ' + (n === 1 ? 'chapter' : 'chapters') + ' for this lens; the total chapter count was not returned to this face.');
    }
    refusalPairs(ask).forEach((r) => lines.push('Theo refused or failed a read: ' + r.tool + ': ' + r.kind + '.'));
    lines.push('A suggestion here has not run. Runnable here means a command exists on this install, not that it was used.');
  } else {
    lines.push('Theo was not asked, so this face carries no Theo guidance (' + clean(ask.not_asked) + ').');
  }
  if (q === 0) lines.push('A zero query count is an investigation lead, not a verdict.');
  return lines.join('\n');
}

function sharedPremiseText(ask, asked) {
  if (!asked || !isObj(ask.results)) return null;
  const sp = sharedPremise(ask.results.neighborhoods);
  if (sp.length === 0) return null;
  return sp.map((e) => 'Shared premise: ' + nameList(e.frameworks) + (e.frameworks.length === 2 ? ' both' : ' all') + ' draw on ' + e.chapter_label +
    '. Their agreement is one line of reasoning, not ' + (e.frameworks.length === 2 ? 'two' : 'several') + '.').join('\n');
}

/**
 * renderTheoFace({ identity, section, ask, capabilityFor, sources, sectionMarker, now, handles })
 *   identity       the room identity result (plan 03); only .ok and .room_id are read
 *   section        the core section slug (passed to sectionMarker, nothing else)
 *   ask            the theo-ask result (asked or not asked)
 *   capabilityFor  capability.cjs capabilityFor, or a function with the same contract
 *   sources        command-sources.cjs sourcesForSection(section) result, or null
 *   sectionMarker  capability.cjs sectionMarker, or a string, or null
 *   now            clock used only when the ask carries no asked_at
 *   handles        optional nestHandles().handles for a face whose question was not asked
 * @returns {{ frontmatter: object, body: string, recommendations: object[] }}
 */
function renderTheoFace(input) {
  const inp = isObj(input) ? input : {};
  const ask = isObj(inp.ask) ? inp.ask : { asked: false, not_asked: 'no_handle_to_send', not_asked_line: '', queries_sent: 0 };
  const asked = ask.asked === true;
  const wire = asked ? wireHandles(ask) : { known: true, lens: null, frameworks: [], parts: [], notSent: [] };
  const ctx = { capabilityFor: inp.capabilityFor, sectionMarker: inp.sectionMarker, section: typeof inp.section === 'string' ? inp.section : null };

  const sugg = suggestionLines(ask, asked, ctx);
  const sections = [];
  sections.push(H_PROV + '\n\n' + provenanceParagraph(ask, asked, wire));
  sections.push(H_SUGG + '\n\n' + sugg.text);
  sections.push(H_SRC + '\n\n' + commandSourcesText(inp.sources, inp.capabilityFor));
  sections.push(H_FITS + '\n\n' + whyItFitsText(ask, asked, wire, sugg.recs, ctx.section));
  sections.push(H_LIM + '\n\n' + limitationsText(ask, asked, wire));
  const shared = sharedPremiseText(ask, asked);
  if (shared) sections.push(H_SHARED + '\n\n' + shared);
  const body = scrub(sections.join('\n\n') + '\n');

  const sent = isObj(ask.handles_sent) ? ask.handles_sent : (isObj(inp.handles) ? inp.handles : null);
  const str = (v) => (typeof v === 'string' && v ? clean(v) : null);
  const rows = isObj(ask.rows_returned) ? ask.rows_returned : null;
  const refusals = refusalPairs(ask).map((r) => r.tool + ':' + r.kind);
  const identityOk = isObj(inp.identity) && inp.identity.ok === true && typeof inp.identity.room_id === 'string' && inp.identity.room_id;

  const frontmatter = {
    face: 'feyminto-theo',
    room_id: identityOk ? clean(inp.identity.room_id) : null,
    asked,
    not_asked_reason: asked ? null : (str(ask.not_asked) || null),
    theo_origin: asked ? str(ask.origin) : null,
    handles_problem_type: sent ? str(sent.problem_type) : null,
    handles_section_kind: sent ? str(sent.section_kind) : null,
    handles_job_id: sent ? str(sent.job_id) : null,
    handles_frameworks: sent ? (arr(sent.frameworks).length > 0 ? joinList(arr(sent.frameworks)) : 'none') : null,
    handles_on_wire: asked && Array.isArray(ask.handles_on_wire) ? (ask.handles_on_wire.length > 0 ? joinList(ask.handles_on_wire) : 'none') : null,
    handles_fingerprint: str(ask.handles_fingerprint),
    queries_sent: num(ask.queries_sent),
    rows_find_frameworks: asked && rows ? num(rows.find_frameworks) : null,
    rows_commands: asked && rows ? num(rows.commands) : null,
    rows_route: asked && rows ? num(rows.route) : null,
    rows_neighborhood: asked && rows ? num(rows.neighborhood) : null,
    refusals: asked ? (refusals.length > 0 ? refusals.map(enc).join(',') : 'none') : null,
    asked_at: str(ask.asked_at) || (typeof inp.now === 'function' ? clean(inp.now()) : null),
    edit_surface: 'none: every field on this face is generated',
    edit_recorded_in: 'none (generated face)',
    suggested_commands: sugg.cmds.map((r) => enc(r.name) + ':' + r.capability.cli + ':' + r.capability.mcp).join(','),
    suggested_frameworks: sugg.fws.filter((r) => r.in_route).slice(0, MAX_SUGGESTED_FRAMEWORKS).map((r) => enc(r.name)).join(','),
  };

  const recommendations = sugg.recs.map((r) => ({
    kind: r.kind, name: r.name, capability: r.capability.label, capability_cli: r.capability.cli, capability_mcp: r.capability.mcp,
    source: r.source, rank: r.rank,
  }));
  return { frontmatter, body, recommendations };
}

module.exports = { renderTheoFace, THEO_FACE_HEADINGS, sharedPremise };
