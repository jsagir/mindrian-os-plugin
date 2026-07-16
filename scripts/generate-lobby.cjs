#!/usr/bin/env node
/*
 * MindrianOS -- Lobby Generator (v1.9.9)
 *
 * Produces index.html: the 3-door hub landing page (the "lobby", not the "museum").
 *
 * DESIGN CONTRACT (reference: my-finance-room.vercel.app target):
 *   - Black full-bleed header
 *   - Eyebrow label (uppercase tracked): VENTURE NAME · STAGE: X
 *   - Massive editorial display title (tagline or venture name)
 *   - One-line subtitle from problem-definition
 *   - Yellow 20px section break bar
 *   - Three cards on cream body:
 *       Door 1 (LEFT, yellow fill)  -- adaptive, top-ranked deliverable
 *       Door 2 (CENTER, white card) -- MANDATORY Full Data Room -> hub.html
 *       Door 3 (RIGHT, red fill)    -- adaptive, 2nd-ranked deliverable
 *   - Black footer with Mondrian bar
 *   - Logo top-right (v1.9.8 brand lockup)
 *   - "Made by Mindrian" footer (v1.9.8 brand lockup)
 *
 * DOOR SELECTION:
 *   Door 2 is always Full Data Room.
 *   Doors 1 and 3 are picked by priority from detected deliverables:
 *     Feynman Deck > Bank of Opportunities > Investment Thesis >
 *     Mullins 7 Domains > Deep Grade > Six Hats > Challenge > Meetings > Graph
 *   If fewer than 2 detected, fill with "starter" invitation doors.
 *
 * USAGE:
 *   node generate-lobby.cjs <room-path>
 *   node generate-lobby.cjs <room-path> --output ./custom-index.html
 */

const fs = require('fs');
const path = require('path');

// ── Theme (shared with generate-hub.cjs v1.9.8 palette) ──────────────────
const THEME = {
  red:    '#A63D2F',
  blue:   '#1E3A6E',
  yellow: '#C8A43C',
  teal:   '#2A6B5E',
  cream:  '#F5F0E8',
  dark:   '#1a1a1a',
  white:  '#ffffff',
  gray500: '#888888',
  gray700: '#444444',
};

// ── Escape ────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Parse frontmatter ─────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

// ── Read STATE.md ─────────────────────────────────────────────────────────
function readRoomState(roomPath) {
  const statePath = path.join(roomPath, 'STATE.md');
  if (!fs.existsSync(statePath)) {
    return {
      ventureName: path.basename(roomPath),
      ventureStage: 'Pre-Opportunity',
      tagline: null,
      author: null,
      computed: new Date().toISOString(),
    };
  }
  const content = fs.readFileSync(statePath, 'utf8');
  const fm = parseFrontmatter(content);
  return {
    ventureName: fm.venture_name || path.basename(roomPath),
    ventureStage: fm.venture_stage || 'Pre-Opportunity',
    tagline: fm.tagline || null,
    author: fm.author || null,
    computed: fm.computed || new Date().toISOString(),
  };
}

// ── Resolve tagline (STATE.md field OR fallback to problem statement) ────
function resolveTagline(roomPath, state) {
  if (state.tagline) return state.tagline;

  // Fallback: first sentence of first non-ROOM.md problem-definition artifact
  const pdDir = path.join(roomPath, 'problem-definition');
  if (fs.existsSync(pdDir)) {
    const files = fs.readdirSync(pdDir).filter(f => f.endsWith('.md') && f !== 'ROOM.md');
    if (files.length > 0) {
      // Handle nested: pdDir/artifact-name/artifact-name.md OR pdDir/artifact.md
      let firstContent = null;
      for (const f of files) {
        const fp = path.join(pdDir, f);
        if (fs.statSync(fp).isFile()) {
          firstContent = fs.readFileSync(fp, 'utf8');
          break;
        }
      }
      // Also try nested dirs
      if (!firstContent) {
        const dirs = fs.readdirSync(pdDir).filter(d => {
          try { return fs.statSync(path.join(pdDir, d)).isDirectory(); } catch { return false; }
        });
        for (const d of dirs) {
          const nested = path.join(pdDir, d, `${d}.md`);
          if (fs.existsSync(nested)) {
            firstContent = fs.readFileSync(nested, 'utf8');
            break;
          }
        }
      }
      if (firstContent) {
        // Strip frontmatter
        const stripped = firstContent.replace(/^---\n[\s\S]*?\n---\n/, '');
        // Find first real paragraph (skip headings)
        const lines = stripped.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('#')) continue;
          if (line.startsWith('>')) continue;
          if (line.length < 20) continue;
          // Return first sentence
          const sentence = line.split(/(?<=[.!?])\s/)[0];
          return sentence.replace(/[*_`]/g, '').substring(0, 200);
        }
      }
    }
  }
  return `A ${state.ventureStage.toLowerCase()} stage venture documented with the PWS methodology.`;
}

// ── Detect deliverables in the room ──────────────────────────────────────
function detectDeliverables(roomPath) {
  const exists = (...parts) => fs.existsSync(path.join(roomPath, ...parts));
  const hasDirContents = (dir) => {
    const full = path.join(roomPath, dir);
    if (!fs.existsSync(full)) return false;
    try {
      return fs.readdirSync(full).filter(f => f !== 'ROOM.md' && !f.startsWith('.')).length > 0;
    } catch { return false; }
  };
  const scanForFramework = (section, framework) => {
    const dir = path.join(roomPath, section);
    if (!fs.existsSync(dir)) return false;
    const walk = (d, depth = 0) => {
      if (depth > 3) return false;
      let hit = false;
      try {
        for (const entry of fs.readdirSync(d)) {
          const full = path.join(d, entry);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            if (walk(full, depth + 1)) return true;
          } else if (entry.endsWith('.md')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.match(new RegExp(`framework:\\s*${framework}`, 'i'))) return true;
            if (entry.toLowerCase().includes(framework.toLowerCase().replace(/-/g, ''))) return true;
          }
        }
      } catch {}
      return hit;
    };
    return walk(dir);
  };

  return {
    feynmanDeck: exists('exports', 'presentation.html'),
    bankOfOpportunities: hasDirContents('opportunity-bank') || exists('exports', 'opportunities.html'),
    investmentThesis: scanForFramework('business-model', 'build-thesis') || scanForFramework('financial-model', 'build-thesis'),
    mullins7Domains: scanForFramework('business-model', 'mullins'),
    deepGrade: scanForFramework('competitive-analysis', 'deep-grade') || scanForFramework('business-model', 'deep-grade'),
    sixHatsPersonas: hasDirContents('personas') || scanForFramework('solution-design', 'six-hats'),
    challengeAssumptions: scanForFramework('competitive-analysis', 'challenge-assumptions'),
    meetingIntelligence: hasDirContents('meetings'),
    knowledgeGraph: exists('exports', 'dashboard.html') || exists('dashboard', 'index.html'),
  };
}

// ── Door catalog: priority-ordered, with copy + destinations ─────────────
function buildDoorCatalog(state) {
  return [
    {
      id: 'feynmanDeck',
      eyebrow: 'INVESTMENT NARRATIVE',
      title: 'The Feynman Deck',
      body: `Ten slides. First-principles decomposition of what ${state.ventureName} actually is -- as if the reader has 90 seconds and one question: "What is this, really?"`,
      cta: 'VIEW PRESENTATION',
      href: 'presentation.html',
    },
    {
      id: 'bankOfOpportunities',
      eyebrow: 'BANK OF OPPORTUNITIES',
      title: 'Opportunities',
      body: `Live funding sources matched to ${state.ventureName} at ${state.ventureStage} stage. Ranked by fit. Tracked through lifecycle.`,
      cta: 'VIEW OPPORTUNITIES',
      href: 'opportunities.html',
      tag: 'LIVE SCAN',
    },
    {
      id: 'investmentThesis',
      eyebrow: 'INVESTMENT THESIS',
      title: 'The Thesis',
      body: `A full investment thesis -- Ten Questions gate plus six-category deep dive. The GO / NO-GO argument in one document.`,
      cta: 'READ THESIS',
      href: 'thesis.html',
    },
    {
      id: 'mullins7Domains',
      eyebrow: 'MULLINS 7 DOMAINS',
      title: 'The Road Test',
      body: `John Mullins' opportunity-screening framework applied to ${state.ventureName}. Seven domains across market, industry, and team. Weakest domain caps the opportunity.`,
      cta: 'VIEW SCORE',
      href: 'mullins.html',
    },
    {
      id: 'deepGrade',
      eyebrow: 'DEEP GRADE',
      title: 'The Report Card',
      body: `Calibrated venture assessment scored against 100+ real projects. Six-component weighted grading with letter grade and percentile ranking.`,
      cta: 'SEE GRADE',
      href: 'grade.html',
    },
    {
      id: 'sixHatsPersonas',
      eyebrow: 'SIX HATS PERSPECTIVES',
      title: 'The Room of Personas',
      body: `Six AI perspective lenses (De Bono) generated from the room data. Each hat challenges the venture from a different angle.`,
      cta: 'MEET THE ROOM',
      href: 'personas.html',
    },
    {
      id: 'challengeAssumptions',
      eyebrow: "DEVIL'S ADVOCATE",
      title: 'Load-Bearing Assumptions',
      body: `Every claim that could break ${state.ventureName} -- stress-tested before the market does it for you. Top assumptions ranked by fragility.`,
      cta: 'READ CHALLENGE',
      href: 'challenge.html',
    },
    {
      id: 'meetingIntelligence',
      eyebrow: 'MEETING INTELLIGENCE',
      title: 'The Transcripts',
      body: `Institutional knowledge extracted from recorded meetings. Action items, commitments, and contradictions -- the things people actually said.`,
      cta: 'BROWSE MEETINGS',
      href: 'meetings.html',
    },
    {
      id: 'knowledgeGraph',
      eyebrow: 'KNOWLEDGE GRAPH',
      title: 'The Map',
      body: `Interactive Cytoscape view of every artifact and its connections. Click any node to read the source. See where the room's thinking lives.`,
      cta: 'OPEN GRAPH',
      href: 'dashboard.html',
    },
  ];
}

// ── Select the three doors ────────────────────────────────────────────────
function selectDoors(deliverables, catalog, state) {
  // Door 2 is ALWAYS Full Data Room (mandatory middle)
  const doorCenter = {
    eyebrow: 'DATA ROOM',
    title: 'The Full Room',
    body: `Every filed artifact across all sections -- the original submission, the deep grade baseline, the six hats consent test, and the Devil's Advocate pass on the load-bearing assumptions.`,
    cta: 'BROWSE DATA ROOM',
    href: 'hub.html',
    mandatory: true,
  };

  // Flanks: rank available deliverables, pick top 2
  const available = catalog.filter(d => deliverables[d.id]);

  // Starter fallbacks for empty-ish rooms (used when < 2 deliverables)
  const starters = [
    {
      eyebrow: 'START HERE',
      title: 'Define The Problem',
      body: `Every venture begins with a clear problem statement. Run /mos:diagnose to classify what kind of problem you are solving, then /mos:root-cause to trace it to the source.`,
      cta: 'RUN /mos:diagnose',
      href: '#starter-diagnose',
      starter: true,
    },
    {
      eyebrow: 'NEXT STEP',
      title: 'Explore The Market',
      body: `The problem only matters if someone feels it. Run /mos:analyze-needs to map user jobs and opportunities, then /mos:macro-trends for the broader landscape.`,
      cta: 'RUN /mos:analyze-needs',
      href: '#starter-market',
      starter: true,
    },
  ];

  let doorLeft, doorRight;
  if (available.length >= 2) {
    doorLeft = available[0];
    doorRight = available[1];
  } else if (available.length === 1) {
    doorLeft = available[0];
    doorRight = starters[1];
  } else {
    doorLeft = starters[0];
    doorRight = starters[1];
  }

  return { doorLeft, doorCenter, doorRight };
}

// ── Mindrian SVG logo (top-right, v1.9.8 brand lockup) ───────────────────
function getMindrianSVG(textFill = '#F5F0E8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="28" viewBox="0 0 240 48" aria-label="Mindrian">
  <rect x="0" y="4" width="12" height="40" fill="${THEME.red}"/>
  <rect x="14" y="4" width="4" height="40" fill="${THEME.blue}"/>
  <rect x="20" y="4" width="8" height="40" fill="${THEME.yellow}"/>
  <rect x="30" y="4" width="4" height="40" fill="${THEME.teal}"/>
  <text x="44" y="34" font-size="28" fill="${textFill}" font-family="'Bebas Neue', sans-serif" font-weight="400" letter-spacing="0.06em">MINDRIAN</text>
</svg>`;
}

// ── CSS ───────────────────────────────────────────────────────────────────
function getLobbyCSS() {
  return `
:root {
  --red:    ${THEME.red};
  --blue:   ${THEME.blue};
  --yellow: ${THEME.yellow};
  --teal:   ${THEME.teal};
  --cream:  ${THEME.cream};
  --dark:   ${THEME.dark};
  --white:  ${THEME.white};
  --gray-500: ${THEME.gray500};
  --gray-700: ${THEME.gray700};
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: var(--cream);
  color: var(--dark);
  line-height: 1.55;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
}

/* ── HEADER (black, full-bleed, editorial) ── */
.lobby-header {
  background: var(--dark);
  color: var(--white);
  padding: 0;
  position: relative;
}

.lobby-header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 48px 56px 64px;
  position: relative;
}

.lobby-logo {
  position: absolute;
  top: 36px;
  right: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--gray-500);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  z-index: 2;
}
.lobby-logo:hover { color: var(--cream); }

.lobby-eyebrow {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: #6EC5C5;
  margin-bottom: 36px;
}

.lobby-title {
  font-family: 'Space Grotesk', 'DM Sans', sans-serif;
  font-size: clamp(56px, 8vw, 120px);
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -0.03em;
  margin: 0 0 24px;
  max-width: 12ch;
  color: var(--white);
}

.lobby-subtitle {
  font-size: clamp(15px, 1.4vw, 19px);
  font-weight: 400;
  line-height: 1.55;
  color: #a8a8a8;
  max-width: 72ch;
}

/* ── Yellow section break ── */
.lobby-break {
  height: 20px;
  background: var(--yellow);
}

/* ── Doors grid ── */
.lobby-doors {
  max-width: 1280px;
  margin: 0 auto;
  padding: 72px 56px 96px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 28px;
  flex: 1;
}

.door {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 40px 32px 32px;
  min-height: 440px;
  border-radius: 4px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  overflow: hidden;
}

.door:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.12);
}

.door::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 6px;
  background: currentColor;
  opacity: 0.2;
}

.door-left {
  background: var(--yellow);
  color: var(--dark);
}

.door-center {
  background: var(--white);
  color: var(--dark);
  border: 1px solid rgba(0,0,0,0.08);
}

.door-right {
  background: var(--red);
  color: var(--cream);
}

.door-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.85;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.door-tag {
  display: inline-block;
  margin-left: auto;
  padding: 3px 8px;
  font-size: 9px;
  letter-spacing: 1.5px;
  background: rgba(0,0,0,0.15);
  border-radius: 2px;
}

.door-right .door-tag {
  background: rgba(255,255,255,0.18);
}

.door-title {
  font-family: 'Space Grotesk', 'DM Sans', sans-serif;
  font-size: clamp(28px, 2.8vw, 42px);
  font-weight: 700;
  line-height: 1.0;
  letter-spacing: -0.02em;
  margin: 8px 0 24px;
  max-width: 12ch;
}

.door-body {
  font-size: 14px;
  line-height: 1.6;
  flex-grow: 1;
  opacity: 0.92;
}

.door-cta {
  margin-top: 28px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 20px;
  border-top: 1px solid currentColor;
  opacity: 0.9;
}

.door:hover .door-cta { opacity: 1; }

/* ── FOOTER ── */
.lobby-footer {
  background: var(--dark);
  color: var(--gray-500);
  margin-top: auto;
}

.lobby-footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 40px 56px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.lobby-footer-signature {
  flex: 1 1 100%;
  text-align: center;
  color: var(--cream);
  font-weight: 600;
  padding: 14px 0 6px;
  order: 3;
}

.lobby-footer-signature a {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.lobby-footer-left { order: 1; }
.lobby-footer-right { order: 2; }

.lobby-mondrian {
  display: flex;
  height: 6px;
}
.lobby-mondrian span:nth-child(1) { flex: 3; background: var(--red); }
.lobby-mondrian span:nth-child(2) { flex: 1; background: var(--blue); }
.lobby-mondrian span:nth-child(3) { flex: 2; background: var(--yellow); }
.lobby-mondrian span:nth-child(4) { flex: 1; background: var(--teal); }

/* ── Responsive ── */
@media (max-width: 960px) {
  .lobby-doors { grid-template-columns: 1fr; padding: 48px 28px 72px; }
  .lobby-header-inner { padding: 40px 28px 48px; }
  .lobby-logo { position: static; margin-bottom: 24px; }
  .lobby-footer-inner { padding: 32px 28px 20px; }
}
`;
}

// ── Render a single door ──────────────────────────────────────────────────
function renderDoor(door, num, position) {
  const numStr = String(num).padStart(2, '0');
  const tag = door.tag ? `<span class="door-tag">${escapeHtml(door.tag)}</span>` : '';
  return `<a class="door door-${position}" href="${escapeHtml(door.href)}">
  <div class="door-number">${numStr} · ${escapeHtml(door.eyebrow)}${tag}</div>
  <h2 class="door-title">${escapeHtml(door.title)}</h2>
  <p class="door-body">${escapeHtml(door.body)}</p>
  <div class="door-cta">${escapeHtml(door.cta)} →</div>
</a>`;
}

// ── Main generator ────────────────────────────────────────────────────────
function generateLobby(roomPath, options = {}) {
  const abs = path.resolve(roomPath);
  if (!fs.existsSync(abs)) {
    console.error(`Room not found: ${abs}`);
    process.exit(1);
  }

  const state = readRoomState(abs);
  const tagline = resolveTagline(abs, state);
  const deliverables = detectDeliverables(abs);
  const catalog = buildDoorCatalog(state);
  const { doorLeft, doorCenter, doorRight } = selectDoors(deliverables, catalog, state);

  const year = new Date().getFullYear();
  const authorLine = state.author
    ? `${state.author.toUpperCase()} · ${year}`
    : `${state.ventureName.toUpperCase()} · ${year}`;

  const eyebrow = `${state.ventureName.toUpperCase()} · STAGE: ${state.ventureStage.toUpperCase()}`;
  const displayTitle = state.tagline || state.ventureName;

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
${require("../lib/ui/design-system.cjs").mosStyleTag()}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(state.ventureName)} | MindrianOS Lobby</title>
<meta name="description" content="${escapeHtml(tagline)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${getLobbyCSS()}</style>
</head>
<body>

<!-- HEADER -->
<header class="lobby-header">
  <div class="lobby-header-inner">
    <a class="lobby-logo" href="https://mindrianos-jsagirs-projects.vercel.app/" target="_blank" rel="noopener">
      ${getMindrianSVG('#F5F0E8')}
    </a>
    <div class="lobby-eyebrow">${escapeHtml(eyebrow)}</div>
    <h1 class="lobby-title">${escapeHtml(displayTitle)}.</h1>
    <p class="lobby-subtitle">${escapeHtml(tagline)}</p>
  </div>
</header>

<!-- Yellow section break -->
<div class="lobby-break"></div>

<!-- DOORS -->
<main class="lobby-doors">
  ${renderDoor(doorLeft, 1, 'left')}
  ${renderDoor(doorCenter, 2, 'center')}
  ${renderDoor(doorRight, 3, 'right')}
</main>

<!-- FOOTER -->
<footer class="lobby-footer">
  <div class="lobby-footer-inner">
    <div class="lobby-footer-left">PWS METHODOLOGY · PROF. LAWRENCE ARONHIME, JOHNS HOPKINS</div>
    <div class="lobby-footer-right">${escapeHtml(authorLine)}</div>
    <div class="lobby-footer-signature">
      <a href="https://mindrianos-jsagirs-projects.vercel.app/" target="_blank" rel="noopener">
        ${getMindrianSVG('#F5F0E8')}
        <span>Made by Mindrian</span>
      </a>
    </div>
  </div>
  <div class="lobby-mondrian"><span></span><span></span><span></span><span></span></div>
</footer>

</body>
</html>
`;

  // Write output
  const outputPath = options.output || path.join(abs, 'exports', 'index.html');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');

  // Report
  console.log(`Lobby generated: ${outputPath}`);
  console.log(`  Venture: ${state.ventureName}`);
  console.log(`  Stage: ${state.ventureStage}`);
  console.log(`  Tagline: ${state.tagline ? '(from STATE.md)' : '(fallback from problem-definition)'}`);
  console.log(`  Door 1 (LEFT): ${doorLeft.title}${doorLeft.starter ? ' [STARTER]' : ''}`);
  console.log(`  Door 2 (CENTER): ${doorCenter.title} [MANDATORY]`);
  console.log(`  Door 3 (RIGHT): ${doorRight.title}${doorRight.starter ? ' [STARTER]' : ''}`);
  console.log(`  Deliverables detected: ${Object.entries(deliverables).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'none'}`);
  return outputPath;
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const roomPath = args.find(a => !a.startsWith('--')) || '.';
  const outputIdx = args.indexOf('--output');
  const output = outputIdx >= 0 ? args[outputIdx + 1] : null;
  generateLobby(roomPath, { output });
}

module.exports = { generateLobby };
