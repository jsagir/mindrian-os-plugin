'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 175-02 -- deck-design-rules.cjs (the pure rule helpers for the
 * deck-design ruleset --check).
 *
 * The deck-design ruleset is a real value lever (Hebbia ISD in-line source
 * citation; Beautiful.ai Brand-Kit brand auto-binding + logo -> mindrian-os.com;
 * AI-generated-image provenance footers per the 173-RESEARCH-tavily.md guidance:
 * bottom-right, 8-10pt, "AI: <tool>, <year>"). It starts WARN this phase and
 * hard-gates later (D-04d, CIRS deferred-enforcement, mirroring R6/R11), so every
 * finding this module returns carries severity "warn"; the hard-FAIL flip is a
 * future amendment, NOT this phase.
 *
 * This is a pure, zero-dependency CJS module: Node built-ins only, no Brain, no
 * network (Canon Part 8). The three checkers are pure functions of the deck HTML
 * string; they do NOT read the filesystem. DESIGN_SYSTEM may reference the
 * palette token path as a constant string only.
 *
 * Exports:
 *   DESIGN_SYSTEM         the default brand: name + logo_link + palette source.
 *   PROVENANCE_FORMAT     the AI-image provenance footer contract.
 *   checkSourceLinks      WARN per sourced claim that lacks a resolvable href.
 *   checkImageProvenance  WARN per AI image that lacks a conformant footer.
 *   checkBrandBinding     WARN when the default brand / logo binding is missing.
 *
 * House rule: hyphens only, no em-dashes. No fenced code in comments.
 */

// The default Brand-Kit the brand-binding check validates against. The logo
// links to the canonical MindrianOS web surface (mindrian-os.com); the palette
// token source is a constant string reference (the checkers never read it).
const DESIGN_SYSTEM = Object.freeze({
  name: 'MindrianOS Design System',
  logo_link: 'https://mindrian-os.com',
  palette_source: 'references/visual/palette.json',
});

// The AI-generated-image provenance footer contract (173-RESEARCH-tavily.md
// section 3): a CONSISTENT bottom-right location, an 8-10pt size band, and a
// "AI: <tool>, <year>" template (e.g. "AI: Adobe Firefly, 2025").
const PROVENANCE_FORMAT = Object.freeze({
  position: 'bottom-right',
  min_pt: 8,
  max_pt: 10,
  template: 'AI: <tool>, <year>',
});

// ---- small pure HTML helpers (regex over the string; no DOM, no deps) ----

// Find all tags (open tags) carrying a given attribute marker, returning each
// tag's full source and the slice of HTML that follows it up to a boundary.
function findTagsWithAttr(html, attrPattern) {
  const out = [];
  // Match an opening tag that carries the attribute. Non-greedy to a single tag.
  const re = new RegExp('<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\b' + attrPattern + '[^>]*>', 'g');
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ tag: m[0], tagName: m[1], index: m.index, after: html.slice(m.index, m.index + 600) });
  }
  return out;
}

// Read a double- or single-quoted attribute value from a tag's source string.
function attrValue(tagSource, attrName) {
  const re = new RegExp('\\b' + attrName + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
  const m = tagSource.match(re);
  if (!m) return null;
  return (m[2] !== undefined ? m[2] : m[3]) || '';
}

// ---- checkSourceLinks ----
//
// A sourced claim is a slide element bearing a sourced marker (a data-sourced
// attribute or a citation token). It must carry an accompanying resolvable
// hyperlink -- an href to a source artifact -- either ON the element itself or
// within the element's immediate following content. Each unlinked sourced claim
// yields one warn finding. A deck with no sourced claims, or where every sourced
// claim carries an href, yields an empty array.
function checkSourceLinks(html) {
  const findings = [];
  if (typeof html !== 'string' || html.length === 0) return findings;

  const sourced = findTagsWithAttr(html, 'data-sourced');
  for (const el of sourced) {
    const label = attrValue(el.tag, 'data-sourced') || 'a sourced claim';
    // A resolvable hyperlink is an href present on the element OR in the slice
    // of HTML that immediately follows the sourced element (its rendered body).
    const hasHrefOnEl = /\bhref\s*=\s*("|')\s*https?:/i.test(el.tag);
    // The following slice up to the closing of this element / next block.
    const bodyEndsAt = el.after.search(new RegExp('</' + el.tagName + '\\s*>', 'i'));
    const body = bodyEndsAt > -1 ? el.after.slice(0, bodyEndsAt) : el.after;
    const hasHrefInBody = /\bhref\s*=\s*("|')\s*https?:/i.test(body);
    if (!hasHrefOnEl && !hasHrefInBody) {
      findings.push({
        rule: 'source-links',
        severity: 'warn',
        message: 'Sourced claim has no resolvable hyperlink: ' + label,
      });
    }
  }
  return findings;
}

// ---- checkImageProvenance ----
//
// An AI-generated image is an img flagged as AI-generated (a data-ai attribute
// or a generated-image marker class). For each, require a provenance footer
// matching the bottom-right 8-10pt "AI: <tool>, <year>" format. A missing or
// malformed footer yields one warn finding. A deck with no AI images, or where
// every AI image has a conformant footer, yields an empty array.
function checkImageProvenance(html) {
  const findings = [];
  if (typeof html !== 'string' || html.length === 0) return findings;

  // AI image markers: data-ai="..." OR class containing "ai-generated".
  const aiImgs = [];
  const reImg = /<img\b[^>]*>/gi;
  let m;
  while ((m = reImg.exec(html)) !== null) {
    const tag = m[0];
    const isAi = /\bdata-ai\s*=/i.test(tag) ||
      /\bclass\s*=\s*("|')[^"']*ai-generated[^"']*("|')/i.test(tag);
    if (isAi) aiImgs.push({ tag, index: m.index });
  }

  for (const img of aiImgs) {
    // The provenance footer is a sibling element near the image carrying the
    // "AI: <tool>, <year>" text. Scan a window around the image for a conformant
    // footer: the template text AND a bottom-right position cue AND an 8-10pt
    // size cue. Pure string scan; the renderer emits the footer adjacent.
    const windowText = html.slice(Math.max(0, img.index - 200), img.index + 600);
    const hasTemplate = /AI:\s*[^,<]+,\s*(19|20)\d\d/i.test(windowText);
    const hasPosition = /bottom-right|right:[^;]*;[^}]*bottom:|bottom:[^;]*;[^}]*right:|ai-provenance/i.test(windowText);
    const ptMatch = windowText.match(/(\d{1,2})\s*pt/i);
    const pt = ptMatch ? parseInt(ptMatch[1], 10) : null;
    const hasSize = pt !== null && pt >= PROVENANCE_FORMAT.min_pt && pt <= PROVENANCE_FORMAT.max_pt;
    if (!(hasTemplate && hasPosition && hasSize)) {
      findings.push({
        rule: 'image-provenance',
        severity: 'warn',
        message: 'AI-generated image lacks a conformant provenance footer ' +
          '(bottom-right, ' + PROVENANCE_FORMAT.min_pt + '-' + PROVENANCE_FORMAT.max_pt +
          'pt, "' + PROVENANCE_FORMAT.template + '")',
      });
    }
  }
  return findings;
}

// ---- checkBrandBinding ----
//
// Confirm the deck binds the MindrianOS Design System by default: a logo anchor
// whose href is https://mindrian-os.com. A logo link that is not mindrian-os.com
// (and no user-brand override marker) yields one warn finding. A user-brand
// override marker (data-user-brand) present means the brand check passes (the
// user brand overrides the default per R7).
function checkBrandBinding(html) {
  const findings = [];
  if (typeof html !== 'string') return findings;

  // A user-brand override anywhere in the deck means the default binding is
  // intentionally replaced; the check passes.
  if (/\bdata-user-brand\b/i.test(html)) return findings;

  // Find the logo anchor: an <a> carrying class="logo" (or a logo marker).
  const logoAnchors = [];
  const reA = /<a\b[^>]*>/gi;
  let m;
  while ((m = reA.exec(html)) !== null) {
    const tag = m[0];
    if (/\bclass\s*=\s*("|')[^"']*\blogo\b[^"']*("|')/i.test(tag) ||
        /\bdata-logo\b/i.test(tag)) {
      logoAnchors.push(tag);
    }
  }

  if (logoAnchors.length === 0) {
    findings.push({
      rule: 'brand-binding',
      severity: 'warn',
      message: 'No logo anchor found; the default ' + DESIGN_SYSTEM.name +
        ' binds a logo linking to ' + DESIGN_SYSTEM.logo_link,
    });
    return findings;
  }

  const bound = logoAnchors.some((tag) => {
    const href = attrValue(tag, 'href');
    return href === DESIGN_SYSTEM.logo_link;
  });
  if (!bound) {
    findings.push({
      rule: 'brand-binding',
      severity: 'warn',
      message: 'Logo anchor does not link to ' + DESIGN_SYSTEM.logo_link +
        ' (the default ' + DESIGN_SYSTEM.name + ' binding)',
    });
  }
  return findings;
}

module.exports = {
  DESIGN_SYSTEM,
  PROVENANCE_FORMAT,
  checkSourceLinks,
  checkImageProvenance,
  checkBrandBinding,
};
