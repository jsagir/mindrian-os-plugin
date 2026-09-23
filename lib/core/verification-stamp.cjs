/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 06 (HIPS-04, D-08..D-14, D-17, D-48, D-49, D-54). The ONE
 * verification adapter: it resolves a finding's two ends to canon Framework
 * names locally, asks Theo `find_connections` once per distinct pair, and
 * computes the tier and every degradation outcome in this module. A lying
 * stamp (fabricated path, invented tier, dropped finding, snapped internal
 * id, hidden outage) is unrepresentable: the schema rejects it, or a test
 * catches it.
 *
 * THE ONE WIRE DOOR (D-09, THEO-04): this module calls
 * `brainClient.callTool('find_connections', { from, to })` exactly once, and
 * nothing else in this file ever issues a network call. `deps.callTool` is
 * how every test drives this module offline; `brain-client.cjs` is required
 * LAZILY, only inside the Theo-call path, only when `deps.callTool` is
 * absent, so requiring this module never opens a socket and never risks a
 * load-time throw on a hook path (mirrors
 * lib/core/strategy/taxonomy-climb.cjs's own "ONE wire door" header). The
 * Part 8 belt already lives inside `brain-client.cjs::callTool`
 * (:655-677) -- this module does not duplicate it, it composes with it.
 * `limit` and `maxHops` are NEVER sent (D-09): the Part 8 recognizer for
 * `find_connections` admits `{from, to}` plus an optional integer `maxHops`
 * only, and this module never opts in to that optional key.
 *
 * READ-ONLY POSTURE (D-17): one Theo read, zero writes, zero Jev, zero key
 * handling of its own (the key lives inside brain-client.cjs). See POSTURE
 * below: `autonomous_safe: true`, reversibility `n/a (read-only)`,
 * consequence `low`, `writes: 'none'`. A stamp is never a material step.
 *
 * THEO RULE 3 -- NO CROSS-RUN CACHE (D-12): `stampFindings` keeps a per-run
 * `Map` memo only, alive for the lifetime of one call, then discarded. Two
 * separate `stampFindings` calls always re-ask Theo for the same pair; there
 * is no module-level cache, no disk cache, nothing that survives past the
 * `await Promise.all(...)` that pool() drives. Dedup happens WITHIN a run
 * (identical pairs share one Theo call, run through a pool of 4), never
 * ACROSS runs.
 *
 * LOCAL RESOLUTION ONLY (D-10, D-48): `resolveEndpoint` never guesses, never
 * fuzzy-matches, never folds case, and never asks Theo to resolve a name --
 * it is an exact `Set.has` against the local `data/framework-names.json`
 * snapshot (`framework_names` + `curated_extras`), tried in order:
 * frontmatter `framework:`, then `methodology:` (normalized to `/mos:` +
 * slug, looked up in `data/command-registry.json`'s `frameworks[0]`), then
 * the finding's own title. A miss stamps `unverified` / `not_called` /
 * `handle_unresolved` and calls Theo zero times for that finding.
 *
 * DEGRADATION NEVER DROPS A FINDING AND NEVER INVENTS A PATH (D-13, D-54):
 * every branch below ends in either a fully-formed verified stamp with a
 * byte-true path, or an honest `unverified` stamp naming a real backend and
 * reason. There is no silent fallback and no default-to-success.
 *
 * NON-FRAMEWORK NODES RENDER BY LABEL CLASS, NEVER BY INTERNAL ID (T-355-29):
 * a Theo path can route through a `BrainRecord` or `DomainConcept` node
 * carrying an internal record id (the live probe this phase's research ran
 * found exactly this on the very first call). This module replaces any node
 * whose `pathLabels` entry is not `'Framework'` with `'[' + label + ']'`
 * before it ever reaches a Stamp, a formatted line, or a filed property.
 *
 * JEV SEAM (D-14): `judge` is the zod literal `'none'` at runtime this
 * phase. Theo's rule 1 forbids model judgment inside Theo; a future amended
 * rule (proxied typed judgment under a stated policy, Theo as keyholder
 * never as judge) is being drafted on the Theo side (SEED-015) for direct
 * navigator approval. Until that lands, the only Jev-facing branch this
 * module would ever grow is a documented seam, not code: a future
 * `judgeCitation(stamp, claimText)` call, gated on `PHASE_355_JUDGE_ENABLED`
 * or an equivalent flag, would sit right here, call a dev-time-only Jev
 * client (never this module, never a hook path, never a user machine), and
 * only ever WIDEN the `judge` enum additively (never remove `'none'`). No
 * such call exists in this file today.
 *
 * Canon Part 8: only exact canon Framework names cross the wire, never room
 * or user content, never an opaque room.db node id (D-10: those never leave
 * the machine to begin with -- the resolver only ever sends what it already
 * matched against the local snapshot).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const directionConvention = require('./direction-convention.cjs');

// ---------------------------------------------------------------------------
// pool(items, n, fn) -- copied verbatim (D-55 forbids requiring scripts/ from
// lib/) from scripts/jev-devtime-client.cjs's own `pool`. n workers pull from
// a shared index; every item runs exactly once; results land at their
// original index regardless of completion order.
// ---------------------------------------------------------------------------
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

// ---------------------------------------------------------------------------
// TIERS / BACKENDS / REASONS (D-13, D-54). REASONS order is load-bearing:
// UNAVAILABLE_REASONS is the 2nd-8th entries, THEO_REASONS is the last five.
// ---------------------------------------------------------------------------
const TIERS = Object.freeze(['strong', 'indirect', 'unverified']);
const BACKENDS = Object.freeze(['theo', 'unavailable', 'not_called']);
const REASONS = Object.freeze([
  'handle_unresolved',     // 1st -- backend not_called
  'backend_unavailable',   // 2nd
  'tool_not_listed',       // 3rd
  'egress_refused',        // 4th
  'tier_denied',           // 5th
  'rate_limited',          // 6th
  'invalid_key',           // 7th
  'text_reply',            // 8th
  'endpoint_unresolved',   // 9th  -- backend theo
  'no_path_within_3_hops', // 10th
  'co_sourced_only',       // 11th
  'no_lateral_relation',   // 12th
  'malformed_response',    // 13th
]);
const UNAVAILABLE_REASONS = Object.freeze(REASONS.slice(1, 8));
const THEO_REASONS = Object.freeze(REASONS.slice(8));

// D-49: the closed lateral / anchor edge-type vocabulary. ADDRESSES_PROBLEM_TYPE
// is deliberately NOT a member of LATERAL_EDGE_TYPES -- it is not ADDRESSES.
const LATERAL_EDGE_TYPES = Object.freeze(new Set([
  'EXTENDS', 'CONTRASTS_WITH', 'COMPLEMENTS', 'PRODUCES_INPUT_FOR', 'FEEDS_INTO',
  'ADDRESSES', 'SUPPORTS', 'PRECEDES', 'REQUIRES_KNOWLEDGE_OF', 'GUARDED_BY',
]));
const ANCHOR_EDGE_TYPES = Object.freeze(new Set([
  'SOURCED_FROM', 'PART_OF', 'INSTANCE_OF', 'HAS_CHUNK', 'EXTRACTED_FROM', 'MENTIONS',
]));

// D-17: this module's declared posture. One read-only Theo call, no writes.
const POSTURE = Object.freeze({
  autonomous_safe: true,
  reversibility: 'n/a (read-only)',
  consequence: 'low',
  writes: 'none',
});

const NONE_DIRECTION = directionConvention.NONE;
const DIRECTIONS = directionConvention.DIRECTIONS;

// ---------------------------------------------------------------------------
// Stamp (zod). A lying stamp is unrepresentable:
//   - .strict() at both levels rejects any extra key (a smuggled score).
//   - a `path` may only appear on a verified (strong/indirect) stamp.
//   - a `reason` may only appear on an unverified stamp, and only a reason
//     legal for that stamp's own backend (not_called/unavailable/theo).
//   - `strong` demands 1-2 hops (edges.length), `indirect` demands exactly 3.
//   - a verified stamp's path must carry at least one lateral edge (D-49).
// ---------------------------------------------------------------------------
const PathSchema = z.object({
  nodes: z.array(z.string().min(1).max(128)).min(2).max(4),
  labels: z.array(z.string().min(1).max(64)).min(2).max(4),
  edges: z.array(z.string().regex(/^[A-Z][A-Z_]{0,63}$/)).min(1).max(3),
}).strict();

const Stamp = z.object({
  verification: z.enum(TIERS),
  backend: z.enum(BACKENDS),
  direction: z.enum([...DIRECTIONS, NONE_DIRECTION]),
  judge: z.literal('none'),
  path: PathSchema.optional(),
  reason: z.enum(REASONS).optional(),
}).strict().superRefine((val, ctx) => {
  if (val.path) {
    const { nodes, labels, edges } = val.path;
    if (edges.length !== nodes.length - 1 || edges.length !== labels.length - 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'path shape mismatch: edges.length must equal nodes.length - 1 and labels.length - 1' });
    }
  }

  const isVerified = val.verification === 'strong' || val.verification === 'indirect';

  if (isVerified) {
    if (val.backend !== 'theo') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['backend'], message: 'a verified stamp must carry backend theo' });
    }
    if (val.reason !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'a verified stamp must not carry a reason' });
    }
    if (!val.path) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['path'], message: 'a verified stamp must carry a path' });
    } else {
      const hops = val.path.edges.length;
      if (val.verification === 'strong' && !(hops === 1 || hops === 2)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['path', 'edges'], message: 'strong requires 1-2 hops' });
      }
      if (val.verification === 'indirect' && hops !== 3) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['path', 'edges'], message: 'indirect requires exactly 3 hops' });
      }
      const hasLateral = val.path.edges.some((e) => LATERAL_EDGE_TYPES.has(e));
      if (!hasLateral) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['path', 'edges'], message: 'a verified stamp requires at least one lateral edge' });
      }
    }
  } else {
    // unverified
    if (val.path !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['path'], message: 'an unverified stamp must not carry a path' });
    }
    if (val.reason === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'an unverified stamp must carry a reason' });
    } else {
      if (val.backend === 'unavailable' && UNAVAILABLE_REASONS.indexOf(val.reason) === -1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'backend unavailable requires an UNAVAILABLE_REASONS reason' });
      }
      if (val.backend === 'theo' && THEO_REASONS.indexOf(val.reason) === -1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'backend theo (unverified) requires a THEO_REASONS reason' });
      }
      if (val.backend === 'not_called' && val.reason !== 'handle_unresolved') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'backend not_called requires reason handle_unresolved' });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Local resolution (D-10, D-48). No module-level cache: each call site reads
// the two data files fresh, so a refreshed snapshot is picked up without a
// process restart.
// ---------------------------------------------------------------------------
function loadFrameworkNames() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const raw = fs.readFileSync(path.join(repoRoot, 'data', 'framework-names.json'), 'utf8');
  const parsed = JSON.parse(raw);
  const names = new Set();
  for (const n of (Array.isArray(parsed.framework_names) ? parsed.framework_names : [])) names.add(n);
  for (const n of (Array.isArray(parsed.curated_extras) ? parsed.curated_extras : [])) names.add(n);
  return names;
}

function loadCommandFrameworks() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const raw = fs.readFileSync(path.join(repoRoot, 'data', 'command-registry.json'), 'utf8');
  const parsed = JSON.parse(raw);
  const map = new Map();
  const commands = Array.isArray(parsed.commands) ? parsed.commands : [];
  for (const c of commands) {
    if (c && typeof c.command === 'string') map.set(c.command, Array.isArray(c.frameworks) ? c.frameworks : []);
  }
  return map;
}

function _stripQuotes(s) {
  if (typeof s !== 'string' || s.length < 2) return s;
  const first = s[0];
  const last = s[s.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) return s.slice(1, -1);
  return s;
}

/*
 * extractCarried(text, title): reads ONLY a leading `---` frontmatter block
 * (D-48: `framework:` key only -- never `frameworks:`, never a body scan)
 * and returns { framework, methodology, title }, trimmed, surrounding quotes
 * stripped. A missing block, or a missing key, yields null for that field.
 */
function extractCarried(text, title) {
  const result = {
    framework: null,
    methodology: null,
    title: typeof title === 'string' ? title : null,
  };
  if (typeof text !== 'string') return result;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return result;
  const frontmatter = m[1];
  const fwMatch = frontmatter.match(/^framework:[ \t]*(.+)$/m);
  if (fwMatch) result.framework = _stripQuotes(fwMatch[1].trim());
  const methMatch = frontmatter.match(/^methodology:[ \t]*(.+)$/m);
  if (methMatch) result.methodology = _stripQuotes(methMatch[1].trim());
  return result;
}

/*
 * resolveEndpoint(carried, ctx): exact, local, in order framework ->
 * methodology -> title. No fuzzy matching, no case folding, no Theo lookup.
 * ctx = { names: Set, registry: Map } (defaults to the loaders above when
 * absent). Returns { name, via } or { name: null, via: null } on a miss.
 */
function resolveEndpoint(carried, ctx) {
  const names = (ctx && ctx.names) || loadFrameworkNames();
  const registry = (ctx && ctx.registry) || loadCommandFrameworks();

  if (carried && typeof carried.framework === 'string' && carried.framework.length > 0) {
    if (names.has(carried.framework)) return { name: carried.framework, via: 'framework' };
  }
  if (carried && typeof carried.methodology === 'string' && carried.methodology.length > 0) {
    const raw = carried.methodology;
    const slug = raw.indexOf('/mos:') === 0 ? raw : '/mos:' + raw.replace(/^\/+/, '');
    const frameworks = registry.get(slug);
    if (Array.isArray(frameworks) && frameworks.length > 0 && names.has(frameworks[0])) {
      return { name: frameworks[0], via: 'methodology' };
    }
  }
  if (carried && typeof carried.title === 'string' && carried.title.length > 0) {
    if (names.has(carried.title)) return { name: carried.title, via: 'title' };
  }
  return { name: null, via: null };
}

// ---------------------------------------------------------------------------
// tierFromHops(h): 1-2 -> strong, 3 -> indirect, anything else -> 'unverified'
// (a hop count Theo's own maxHops:3 search should never produce; treated as
// malformed_response by the caller).
// ---------------------------------------------------------------------------
function tierFromHops(h) {
  if (h === 1 || h === 2) return 'strong';
  if (h === 3) return 'indirect';
  return 'unverified';
}

// A permissive passthrough schema for one raw Theo path entry -- validates
// shape only (arrays of strings, integer hops), never business rules.
const RawPathEntrySchema = z.object({
  path: z.array(z.string()),
  pathLabels: z.array(z.string()),
  edges: z.array(z.string()),
  hops: z.number().int(),
}).passthrough();

/*
 * choosePath(paths): validates every entry against the permissive shape
 * schema, keeps the min-hop set, then picks deterministically: a lateral
 * edge beats none, an all-Framework interior beats a provenance-routed one,
 * then lexical order of (path joined) + (edges joined) breaks the final tie.
 * Returns { valid, chosen } -- chosen is null when nothing validates.
 */
function choosePath(paths) {
  const valid = [];
  if (Array.isArray(paths)) {
    for (const p of paths) {
      const parsed = RawPathEntrySchema.safeParse(p);
      if (parsed.success) valid.push(parsed.data);
    }
  }
  if (valid.length === 0) return { valid, chosen: null };

  const minHops = Math.min(...valid.map((v) => v.hops));
  const atMin = valid.filter((v) => v.hops === minHops);

  const hasLateral = (v) => v.edges.some((e) => LATERAL_EDGE_TYPES.has(e));
  const allFramework = (v) => v.pathLabels.every((l) => l === 'Framework');
  const lexKey = (v) => v.path.join('|') + '|' + v.edges.join('|');

  atMin.sort((a, b) => {
    const la = hasLateral(a) ? 0 : 1;
    const lb = hasLateral(b) ? 0 : 1;
    if (la !== lb) return la - lb;
    const fa = allFramework(a) ? 0 : 1;
    const fb = allFramework(b) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const ka = lexKey(a);
    const kb = lexKey(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });

  return { valid, chosen: atMin[0] };
}

function _normDirection(direction) {
  if (DIRECTIONS.indexOf(direction) !== -1) return direction;
  return NONE_DIRECTION;
}

function _renderNodes(chosen) {
  return chosen.path.map((node, i) => (chosen.pathLabels[i] === 'Framework' ? node : '[' + chosen.pathLabels[i] + ']'));
}

/*
 * _theoOutcomeFor(fromHandle, toHandle, deps): the direction-agnostic half of
 * the degradation waterfall (D-13, D-54). Returns
 *   { backend, reason, path: {nodes,labels,edges} | null, tier, pathsCount, chosen, ms }
 * `path` is set (and `reason` absent) only on a verified outcome.
 * `deps.callTool` drives every test offline; brain-client.cjs is required
 * lazily only when it is absent (the ONE wire door, see header).
 */
async function _theoOutcomeFor(fromHandle, toHandle, deps) {
  const t0 = Date.now();
  const done = (backend, reason, extra) => Object.assign({
    backend, reason: reason || undefined, path: null, tier: null, pathsCount: 0, chosen: null, ms: Date.now() - t0,
  }, extra || {});

  if (!fromHandle || !toHandle) {
    return done('not_called', 'handle_unresolved');
  }

  let callTool = deps && typeof deps.callTool === 'function' ? deps.callTool : null;
  if (!callTool) {
    // Lazy require: the ONE wire door, only reached when the caller supplied
    // no deps.callTool (i.e. not under test).
    callTool = require('./brain-client.cjs').callTool;
  }

  let res;
  try {
    res = await callTool('find_connections', { from: fromHandle, to: toHandle });
  } catch (_e) {
    res = null;
  }

  if (res === null || res === undefined) {
    return done('unavailable', 'backend_unavailable');
  }
  if (typeof res === 'string' || Array.isArray(res)) {
    return done('unavailable', 'text_reply');
  }
  if (typeof res !== 'object') {
    return done('unavailable', 'backend_unavailable');
  }
  if (typeof res.error === 'string') {
    if (res.error === 'egress_blocked') return done('unavailable', 'egress_refused');
    if (res.error === 'tier_denied' || res.error === 'rate_limited' || res.error === 'invalid_key') {
      return done('unavailable', res.error);
    }
    if (/unknown[_ ]tool|not (found|listed)/i.test(res.error)) {
      return done('unavailable', 'tool_not_listed');
    }
    return done('unavailable', 'backend_unavailable');
  }
  if (typeof res.text === 'string'
    && !Object.prototype.hasOwnProperty.call(res, 'paths')
    && !Object.prototype.hasOwnProperty.call(res, 'refusals')) {
    return done('unavailable', 'text_reply');
  }
  if (!Object.prototype.hasOwnProperty.call(res, 'paths')) {
    if (Array.isArray(res.refusals)) return done('theo', 'endpoint_unresolved');
    return done('theo', 'malformed_response');
  }

  const pathsCount = Array.isArray(res.paths) ? res.paths.length : 0;
  const { valid, chosen } = choosePath(res.paths);

  if (!Array.isArray(res.paths) || (res.paths.length > 0 && valid.length === 0)) {
    return done('theo', 'malformed_response', { pathsCount });
  }
  if (res.paths.length === 0) {
    return done('theo', 'no_path_within_3_hops', { pathsCount });
  }

  const hopCheckOk = chosen.edges.length === chosen.hops
    && chosen.path.length - 1 === chosen.hops
    && chosen.pathLabels.length - 1 === chosen.hops;
  if (!hopCheckOk) {
    return done('theo', 'malformed_response', { pathsCount });
  }

  const tier = tierFromHops(chosen.hops);
  if (tier !== 'strong' && tier !== 'indirect') {
    return done('theo', 'malformed_response', { pathsCount });
  }

  const hasLateral = chosen.edges.some((e) => LATERAL_EDGE_TYPES.has(e));
  const chosenSummary = { labels: chosen.pathLabels, edges: chosen.edges, hops: chosen.hops };
  if (!hasLateral) {
    const allAnchor = chosen.edges.every((e) => ANCHOR_EDGE_TYPES.has(e));
    return done('theo', allAnchor ? 'co_sourced_only' : 'no_lateral_relation', { pathsCount, chosen: chosenSummary });
  }

  return {
    backend: 'theo',
    reason: undefined,
    tier,
    path: { nodes: _renderNodes(chosen), labels: chosen.pathLabels, edges: chosen.edges },
    pathsCount,
    chosen: chosenSummary,
    ms: Date.now() - t0,
  };
}

function _composeStamp(outcome, finding) {
  const direction = _normDirection(finding && finding.direction);
  const fromVia = (finding && finding.fromVia) || null;
  const toVia = (finding && finding.toVia) || null;

  let raw;
  if (outcome.path) {
    raw = { verification: outcome.tier, backend: 'theo', direction, judge: 'none', path: outcome.path };
  } else {
    raw = { verification: 'unverified', backend: outcome.backend, direction, judge: 'none', reason: outcome.reason };
  }

  let stamp;
  try {
    stamp = Stamp.parse(raw);
  } catch (_e) {
    // Defensive: the waterfall above should never build an un-parseable
    // stamp. If it somehow does, degrade to an honest malformed_response
    // rather than throw out of a producer's render path.
    stamp = Stamp.parse({ verification: 'unverified', backend: 'theo', direction: NONE_DIRECTION, judge: 'none', reason: 'malformed_response' });
  }

  return {
    stamp,
    detail: { from_via: fromVia, to_via: toVia, paths_count: outcome.pathsCount, chosen: outcome.chosen, ms: outcome.ms },
  };
}

/*
 * stampFindingDetailed({ fromHandle, toHandle, direction, fromVia, toVia }, deps)
 * -> { stamp, detail }. fromHandle/toHandle are already-resolved canon names
 * (or null on a resolution miss) -- callers run extractCarried +
 * resolveEndpoint themselves per side before calling this. detail never
 * contains internal Theo ids or room text.
 */
async function stampFindingDetailed(finding, deps) {
  const fromHandle = finding && finding.fromHandle;
  const toHandle = finding && finding.toHandle;
  const outcome = await _theoOutcomeFor(fromHandle, toHandle, deps);
  return _composeStamp(outcome, finding);
}

/*
 * stampFinding(finding, deps) -> Stamp only (the thin entry point most
 * producers call).
 */
async function stampFinding(finding, deps) {
  const { stamp } = await stampFindingDetailed(finding, deps);
  return stamp;
}

/*
 * stampFindings(findings, deps) -> Stamp[] aligned to input order. A per-run
 * Map memo, keyed on fromHandle + '\u0000' + toHandle, dedups Theo calls for
 * repeated pairs; the deduped pair list runs through pool(4). No finding is
 * ever dropped: a finding with a missing handle is resolved individually
 * (zero Theo calls for it) and still produces a stamp at its own index.
 * The memo is DIRECTION-AGNOSTIC (D-12 caches the Theo outcome, not the
 * final direction-specific stamp), so two findings sharing a pair but
 * carrying different directions each get their own correctly-directed stamp
 * from one shared Theo call.
 */
async function stampFindings(findings, deps) {
  const list = Array.isArray(findings) ? findings : [];
  const pairKeyOf = (f) => (f && f.fromHandle && f.toHandle ? f.fromHandle + '\u0000' + f.toHandle : null);

  const uniquePairs = [];
  const seenKeys = new Set();
  for (const f of list) {
    const key = pairKeyOf(f);
    if (key === null || seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniquePairs.push({ key, fromHandle: f.fromHandle, toHandle: f.toHandle });
  }

  const memo = new Map();
  await pool(uniquePairs, 4, async (entry) => {
    const outcome = await _theoOutcomeFor(entry.fromHandle, entry.toHandle, deps);
    memo.set(entry.key, outcome);
  });

  const out = [];
  for (const f of list) {
    const key = pairKeyOf(f);
    if (key !== null && memo.has(key)) {
      out.push(_composeStamp(memo.get(key), f).stamp);
    } else {
      const outcome = await _theoOutcomeFor(f && f.fromHandle, f && f.toHandle, deps);
      out.push(_composeStamp(outcome, f).stamp);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// toNodeProps / fromNodeProps (D-37): flat enums + arrays only, so a stamp
// rides a room.db node's `extraProps` merge (no DDL) with no nested object.
// ---------------------------------------------------------------------------
function toNodeProps(stamp) {
  const props = {
    verification: stamp.verification,
    backend: stamp.backend,
    direction: stamp.direction,
    judge: stamp.judge,
    path: stamp.path ? stamp.path.nodes.slice() : [],
    path_labels: stamp.path ? stamp.path.labels.slice() : [],
    path_edges: stamp.path ? stamp.path.edges.slice() : [],
    path_len: stamp.path ? stamp.path.edges.length : 0,
  };
  if (stamp.reason !== undefined) props.reason = stamp.reason;
  return props;
}

function fromNodeProps(props) {
  const obj = {
    verification: props.verification,
    backend: props.backend,
    direction: props.direction,
    judge: props.judge,
  };
  if (props.reason !== undefined && props.reason !== null) obj.reason = props.reason;
  if (Array.isArray(props.path) && props.path.length > 0) {
    obj.path = {
      nodes: props.path,
      labels: Array.isArray(props.path_labels) ? props.path_labels : [],
      edges: Array.isArray(props.path_edges) ? props.path_edges : [],
    };
  }
  return Stamp.parse(obj);
}

module.exports = {
  Stamp,
  REASONS,
  UNAVAILABLE_REASONS,
  THEO_REASONS,
  BACKENDS,
  TIERS,
  LATERAL_EDGE_TYPES,
  ANCHOR_EDGE_TYPES,
  POSTURE,
  extractCarried,
  resolveEndpoint,
  loadFrameworkNames,
  loadCommandFrameworks,
  tierFromHops,
  choosePath,
  stampFinding,
  stampFindingDetailed,
  stampFindings,
  toNodeProps,
  fromNodeProps,
};
