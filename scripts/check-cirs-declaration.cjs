#!/usr/bin/env node
'use strict';

/*
 * check-cirs-declaration.cjs -- the Canon Part 11 R12 gate hook.
 *
 * R12 (forward-declaration and explainability): every future phase that
 * adds / modifies / removes an invocable surface (a file under commands/,
 * skills/, or agents/), OR that consumes the invocation spine, MUST carry a
 * conformant `cirs_relationship:` frontmatter block AND `11` in `canon_parts`
 * (the canon_parts-11 auto-derivation rule). A triggered phase without a
 * conformant declaration is gate-FAILED.
 *
 * Schema source: docs/CIRS-RELATIONSHIP-CONTRACT.md.
 *
 * checkCirsDeclaration(planFrontmatter) -> { ok, errors[] } is the pure core.
 * The CLI `--check <planpath...>` mode parses LOCAL plan files and exits
 * non-zero on any error with a recovery line. Reads LOCAL plan files only:
 * zero Brain, zero network (Canon Part 8). Mirrors the --check exit-code +
 * recovery-line idiom of scripts/build-connector-registry.cjs.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');

// The five structured fields of a conformant cirs_relationship block.
const REQUIRED_REL_FIELDS = [
  'surfaces_added',
  'surfaces_modified',
  'surfaces_removed',
  'spine_consumed',
  'gate_impact',
];

// A surface-touching path: a file under commands/, skills/, or agents/.
const SURFACE_RE = /(^|\/)(commands|skills|agents)\//;

// ---------------------------------------------------------------------------
// surfaceTouching(files): does any files_modified path touch an invocable
// surface (commands/ skills/ agents/)? The surface-touching trigger.
// ---------------------------------------------------------------------------
function surfaceTouching(files) {
  if (!Array.isArray(files)) return false;
  return files.some((f) => typeof f === 'string' && SURFACE_RE.test(f));
}

// ---------------------------------------------------------------------------
// spineConsuming(rel): does the declared cirs_relationship list any spine
// asset under spine_consumed? The spine-consuming trigger. (A non-empty
// spine_consumed is the declaration that the phase consumes the spine; absence
// of any block is handled by the surface trigger.)
// ---------------------------------------------------------------------------
function spineConsuming(rel) {
  return !!(
    rel &&
    Array.isArray(rel.spine_consumed) &&
    rel.spine_consumed.length > 0
  );
}

// ---------------------------------------------------------------------------
// relConformant(rel): all five structured fields present AND explanation prose
// non-empty. Returns { ok, errors[] }.
// ---------------------------------------------------------------------------
function relConformant(rel) {
  const errors = [];
  if (!rel || typeof rel !== 'object' || Array.isArray(rel)) {
    errors.push('cirs_relationship block is missing or not a map');
    return { ok: false, errors };
  }
  for (const field of REQUIRED_REL_FIELDS) {
    if (!(field in rel)) {
      errors.push('cirs_relationship is missing required field: ' + field);
    }
  }
  const expl = rel.explanation;
  if (typeof expl !== 'string' || expl.trim() === '') {
    errors.push('cirs_relationship.explanation prose is missing or empty');
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// checkCirsDeclaration(fm): the pure R12 core.
//   - If neither trigger fires, no declaration is required -> ok.
//   - If a trigger fires: require a conformant cirs_relationship block AND
//     `11` in canon_parts (the auto-derivation rule).
// Returns { ok, errors[] }.
// ---------------------------------------------------------------------------
function checkCirsDeclaration(fm) {
  const errors = [];
  const f = fm && typeof fm === 'object' ? fm : {};
  const files = Array.isArray(f.files_modified) ? f.files_modified : [];
  const rel = f.cirs_relationship;
  const canonParts = Array.isArray(f.canon_parts) ? f.canon_parts : [];

  const touchesSurface = surfaceTouching(files);
  const consumesSpine = spineConsuming(rel);
  const triggered = touchesSurface || consumesSpine;

  if (!triggered) {
    // Untriggered: no declaration required. (If a block is present anyway, the
    // auto-derivation rule below still applies so the two cannot disagree.)
    if (rel !== undefined && rel !== null) {
      const has11 = canonParts.map(String).includes('11');
      if (!has11) {
        errors.push(
          'cirs_relationship is declared but canon_parts is missing 11 ' +
            '(the canon_parts-11 auto-derivation rule, R12)'
        );
      }
    }
    return { ok: errors.length === 0, errors };
  }

  // Triggered: a conformant block is mandatory.
  const conf = relConformant(rel);
  for (const e of conf.errors) errors.push(e);

  // The canon_parts-11 auto-derivation rule: declaring (or being required to
  // declare) a cirs_relationship implies 11 in canon_parts.
  const has11 = canonParts.map(String).includes('11');
  if (!has11) {
    errors.push(
      'a CIRS-triggered phase must carry 11 in canon_parts ' +
        '(the canon_parts-11 auto-derivation rule, R12)'
    );
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// parsePlanFrontmatter(md): extract the fields R12 needs from a plan's YAML
// frontmatter -- files_modified (dash-list), canon_parts (inline JSON array),
// and the nested cirs_relationship map (five fields + explanation). A focused
// descent mirroring the parseConnectorFrontmatter idiom in
// build-connector-registry.cjs; reads LOCAL bytes only.
// ---------------------------------------------------------------------------
function coerceScalar(v) {
  const s = String(v).trim();
  if (s === '' || s === 'null' || s === '~') return s === '' ? '' : null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  // Inline JSON array, e.g. [2, 3, 11] or ["a", "b"].
  if (/^\[.*\]$/.test(s)) {
    try {
      return JSON.parse(s.replace(/'/g, '"'));
    } catch (_e) {
      // fall through to string strip
    }
  }
  return s.replace(/^["']|["']$/g, '');
}

function parsePlanFrontmatter(md) {
  if (typeof md !== 'string') return {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return {};
  const out = {};
  let key = null; // current top-level dash-list key

  let inRel = false;
  let relObj = null;
  let relKey = null;

  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    const indented = /^\s+\S/.test(line);

    if (inRel) {
      if (line.trim() === '' || indented) {
        if (line.trim() === '') continue;
        const noComment = line.replace(/\s+#.*$/, '');
        const subKv = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(noComment);
        if (subKv) {
          relKey = subKv[1];
          const sv = subKv[2].trim();
          relObj[relKey] = sv === '' ? [] : coerceScalar(sv);
          continue;
        }
        const subDash = /^\s+-\s+(.*)$/.exec(noComment);
        if (subDash && relKey) {
          if (!Array.isArray(relObj[relKey])) relObj[relKey] = [];
          relObj[relKey].push(subDash[1].replace(/^["']|["']$/g, ''));
          continue;
        }
        continue;
      }
      // Non-indented line ends the cirs_relationship block.
      inRel = false;
      out.cirs_relationship = relObj;
      relObj = null;
      relKey = null;
      // fall through to parse this line as a top-level line
    }

    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      if (key === 'cirs_relationship' && v === '') {
        inRel = true;
        relObj = {};
        relKey = null;
        continue;
      }
      out[key] = v === '' ? undefined : coerceScalar(v);
      if (v === '') out[key] = []; // empty top-level scalar starts a dash-list
    } else if (key && /^\s*-\s+/.test(line)) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, ''));
    }
  }

  if (inRel && relObj) out.cirs_relationship = relObj;
  return out;
}

// ---------------------------------------------------------------------------
// CLI --check <planpath...>
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf('--check');
  if (idx === -1) {
    console.error('usage: node scripts/check-cirs-declaration.cjs --check <planpath...>');
    process.exit(2);
    return;
  }
  const planPaths = argv.slice(idx + 1).filter((a) => !a.startsWith('--'));
  if (planPaths.length === 0) {
    console.error('usage: node scripts/check-cirs-declaration.cjs --check <planpath...>');
    process.exit(2);
    return;
  }

  const allErrors = [];
  for (const p of planPaths) {
    let md;
    try {
      md = fs.readFileSync(p, 'utf8');
    } catch (_e) {
      allErrors.push(p + ': cannot read plan file');
      continue;
    }
    const fm = parsePlanFrontmatter(md);
    const res = checkCirsDeclaration(fm);
    if (!res.ok) {
      for (const e of res.errors) allErrors.push(p + ': ' + e);
    }
  }

  if (allErrors.length) {
    console.error(allErrors.join('\n'));
    console.error(
      'Recovery: add a conformant cirs_relationship: block (and 11 in canon_parts) ' +
        'per docs/CIRS-RELATIONSHIP-CONTRACT.md, then re-run.'
    );
    process.exit(1);
    return;
  }
  console.log('check-cirs-declaration: OK (' + planPaths.length + ' plan(s))');
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    checkCirsDeclaration,
    parsePlanFrontmatter,
    surfaceTouching,
    spineConsuming,
    relConformant,
  };
}
