#!/usr/bin/env node
'use strict';

/**
 * MindrianOS -- Pitch Deck Generator
 *
 * Generates a 10-slide HTML pitch deck from any room/ directory.
 * Uses YC Seed Deck structure with Chart.js data visualizations,
 * De Stijl dark theme, and MINDRIAN branding.
 *
 * Reads room data to auto-populate:
 *   - Venture name, stage, founder from STATE.md
 *   - Problem definition from problem-definition/
 *   - Market data from market-analysis/
 *   - Solution from solution-design/
 *   - Competition from competitive-analysis/
 *   - Business model from business-model/
 *   - Team from team/
 *   - Financials from financial-model/
 *
 * Usage:
 *   node scripts/generate-deck.cjs ./room
 *   node scripts/generate-deck.cjs ./room --output ./deck.html
 *
 * Zero npm dependencies -- uses only Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');

// ── Helpers ──

function readMd(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function extractFrontmatter(content, key) {
  const m = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : '';
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

function readSection(roomDir, section) {
  const dir = path.join(roomDir, section);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'ROOM.md' && f !== 'MINTO.md')
    .map(f => {
      const content = readMd(path.join(dir, f));
      return { file: f, title: extractTitle(content) || f, content };
    });
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function summarize(content, maxLen = 200) {
  // Strip frontmatter and headers, get first paragraph
  const text = content.replace(/---[\s\S]*?---/, '').replace(/^#+\s.+$/gm, '').trim();
  const para = text.split('\n\n').find(p => p.trim().length > 30) || text;
  const clean = para.replace(/\n/g, ' ').trim();
  return clean.length > maxLen ? clean.substring(0, maxLen - 3) + '...' : clean;
}

// ── Main ──

const roomDir = path.resolve(process.argv[2] || './room');
const outputFlag = process.argv.indexOf('--output');
const outputPath = outputFlag > -1 ? process.argv[outputFlag + 1] : path.join(roomDir, 'exports', 'deck.html');

if (!fs.existsSync(roomDir)) {
  console.error(`Room not found: ${roomDir}`);
  process.exit(1);
}

// Read room data
const stateMd = readMd(path.join(roomDir, 'STATE.md'));
const roomName = extractFrontmatter(stateMd, 'room_name') || path.basename(path.dirname(roomDir));
const stage = extractFrontmatter(stateMd, 'venture_stage') || 'Pre-Opportunity';

const problems = readSection(roomDir, 'problem-definition');
const markets = readSection(roomDir, 'market-analysis');
const solutions = readSection(roomDir, 'solution-design');
const competition = readSection(roomDir, 'competitive-analysis');
const businessModel = readSection(roomDir, 'business-model');
const team = readSection(roomDir, 'team');
const financials = readSection(roomDir, 'financial-model');
const meetings = readSection(roomDir, 'meetings');

const totalArtifacts = problems.length + markets.length + solutions.length +
  competition.length + businessModel.length + team.length + financials.length + meetings.length;

// Extract key content
const problemSummary = problems.length > 0 ? summarize(problems[0].content, 300) : 'Problem definition not yet captured. Run /mos:diagnose to classify your problem type.';
const solutionSummary = solutions.length > 0 ? summarize(solutions[0].content, 300) : 'Solution design not yet captured. Run /mos:explore-domains to start.';
const marketSummary = markets.length > 0 ? summarize(markets[0].content, 300) : 'Market analysis not yet captured.';
const competitionSummary = competition.length > 0 ? summarize(competition[0].content, 300) : 'Competitive analysis not yet captured.';
const teamSummary = team.length > 0 ? summarize(team[0].content, 300) : 'Team profiles not yet captured.';

// Find founder name from team section
let founderName = 'Founder';
for (const t of team) {
  const nameMatch = t.content.match(/(?:title|name|founder):\s*(.+)/im);
  if (nameMatch) { founderName = nameMatch[1].trim(); break; }
}

console.log(`Generating deck for: ${roomName} (${stage})`);
console.log(`  Sections: ${[problems, markets, solutions, competition, businessModel, team, financials].filter(s => s.length > 0).length}`);
console.log(`  Artifacts: ${totalArtifacts}`);

// ── Build HTML ──

const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
${require("../lib/ui/design-system.cjs").mosStyleTag()}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="MindrianOS generate-deck.cjs">
<title>${esc(roomName)} - Pitch Deck - MindrianOS</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--red:#A63D2F;--blue:#1E3A6E;--yellow:#C8A43C;--green:#2A6B5E;--bg:#0a0a0f;--surface:#12121a;--border:#1a1a2a;--cream:#f5f0e8;--muted:#888}
body{background:var(--bg);color:var(--cream);font-family:'Inter',system-ui,sans-serif;overflow:hidden}
.header{position:fixed;top:0;left:0;right:0;z-index:100;background:var(--bg);display:flex;align-items:center;padding:8px 20px;gap:12px;height:40px}
.header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--red) 30%,var(--blue) 50%,var(--yellow) 70%,var(--green) 100%)}
.logo{display:flex;align-items:center;gap:6px;text-decoration:none}
.logo svg{height:16px;width:auto}
.logo span{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--muted);letter-spacing:1.5px}
.deck-title{font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:1px}
.back{font-size:10px;color:#555;text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:4px;margin-left:auto}
.back:hover{color:var(--cream);border-color:#444}
.progress{position:fixed;top:40px;left:0;height:2px;background:var(--yellow);transition:width .3s;z-index:100}
.deck{position:relative;width:100vw;height:100vh;overflow:hidden}
@media(min-width:769px){.deck{max-width:calc(100vh*16/9);max-height:calc(100vw*9/16);margin:auto;position:absolute;inset:0}}
.slide{position:absolute;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:80px 60px 60px;opacity:0;visibility:hidden;transition:opacity .4s;background:var(--bg);overflow:hidden}
.slide.active{opacity:1;visibility:visible}
.slide-label{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--yellow);margin-bottom:8px;border:1px solid var(--border);display:inline-block;padding:2px 10px;border-radius:3px}
.slide h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(28px,5vw,52px);line-height:1.1;margin-bottom:16px;letter-spacing:1px}
.slide h2 em{font-style:normal;color:var(--red)}
.slide p{font-size:clamp(14px,2vw,18px);color:#ccc;line-height:1.6;max-width:800px}
.slide-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:24px;width:100%}
.slide-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:20px}
.slide-card h3{font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--yellow);margin-bottom:8px;letter-spacing:1px}
.slide-card p{font-size:13px;color:#aaa;line-height:1.5}
.stat-row{display:flex;gap:32px;margin-top:24px}
.stat{text-align:center}.stat-val{font-size:clamp(28px,4vw,48px);font-weight:700;font-family:'Bebas Neue',sans-serif;letter-spacing:1px}.stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
.chart-container{width:100%;max-width:600px;margin-top:16px}
.trl-bar{display:flex;align-items:center;gap:12px;margin:6px 0}
.trl-label{font-size:12px;color:#aaa;width:140px;text-align:right}
.trl-track{flex:1;height:20px;background:var(--surface);border-radius:4px;overflow:hidden;border:1px solid var(--border)}
.trl-fill{height:100%;border-radius:3px;transition:width 1s}
.trl-score{font-size:11px;color:var(--cream);font-weight:600;width:60px}
.comp-table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
.comp-table th{text-align:left;padding:8px 12px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border)}
.comp-table td{padding:8px 12px;border-bottom:1px solid var(--border);color:#ccc}
.comp-table tr:first-child td{color:var(--yellow);font-weight:600}
.check{color:var(--green)}.miss{color:#444}
.timeline{display:flex;flex-direction:column;gap:12px;margin-top:16px}
.tl-item{display:flex;gap:16px;align-items:flex-start}
.tl-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:4px}
.tl-content h4{font-size:14px;color:var(--cream);margin-bottom:2px}
.tl-content p{font-size:12px;color:var(--muted)}
.cta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:24px;width:100%}
.cta-col{text-align:center}
.cta-col h4{font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--yellow);margin-bottom:8px;letter-spacing:1px}
.cta-col p{font-size:12px;color:#aaa;line-height:1.5}
.mondrian-footer{position:fixed;bottom:0;left:0;right:0;display:flex;height:3px;z-index:100}
.mondrian-footer span:nth-child(1){flex:3;background:var(--red)}.mondrian-footer span:nth-child(2){flex:1;background:var(--blue)}.mondrian-footer span:nth-child(3){flex:2;background:var(--yellow)}.mondrian-footer span:nth-child(4){flex:1;background:var(--green)}
.nav{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;z-index:100}
.nav button{background:rgba(255,255,255,.08);border:none;color:var(--cream);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;transition:all .2s}
.nav button:hover{background:rgba(255,255,255,.15)}
.nav .counter{font-size:12px;color:var(--muted)}
.mondrian-blocks{position:absolute;right:-20px;top:-20px;opacity:.15}
@media(max-width:900px){.slide{padding:60px 32px 48px}.slide-grid{grid-template-columns:1fr}.cta-grid{grid-template-columns:1fr}.stat-row{gap:16px;flex-wrap:wrap}}
@media(max-width:600px){.slide{padding:50px 20px 40px}.stat-val{font-size:28px}}
</style>
</head>
<body>

<div class="header">
<a class="logo" href="https://mindrianos-jsagirs-projects.vercel.app/" target="_blank">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="0" y="0" width="10" height="10" fill="#A63D2F"/><rect x="12" y="0" width="12" height="5" fill="#C8A43C"/><rect x="12" y="7" width="12" height="3" fill="#1E3A6E"/><rect x="0" y="12" width="5" height="12" fill="#2A6B5E"/><rect x="7" y="12" width="17" height="12" fill="#15151f" stroke="#2a2a3a" stroke-width="0.3"/></svg>
<span>MINDRIAN</span></a>
<span class="deck-title">${esc(roomName)} Pitch Deck</span>
<a class="back" href="../index.html">Back to Hub</a>
</div>

<div class="progress" id="progress"></div>

<div class="deck">

<!-- SLIDE 1: TITLE -->
<div class="slide active">
<svg class="mondrian-blocks" width="300" height="300" viewBox="0 0 300 300"><rect x="200" y="0" width="100" height="80" fill="var(--red)"/><rect x="200" y="90" width="100" height="60" fill="var(--blue)"/><rect x="200" y="160" width="60" height="140" fill="var(--yellow)"/><rect x="270" y="160" width="30" height="140" fill="var(--green)"/></svg>
<span class="slide-label">${esc(stage)}</span>
<h2>${esc(roomName)}</h2>
<p style="font-size:20px;color:var(--cream);max-width:600px;margin-bottom:24px">${esc(problemSummary.split('.')[0])}.</p>
<p style="font-size:14px;color:var(--muted)">${esc(founderName)}</p>
<div class="stat-row" style="margin-top:32px">
<div class="stat"><div class="stat-val" style="color:var(--yellow)">${totalArtifacts}</div><div class="stat-label">Artifacts</div></div>
<div class="stat"><div class="stat-val" style="color:var(--green)">${[problems, markets, solutions, competition, businessModel, team, financials].filter(s => s.length > 0).length}</div><div class="stat-label">Sections</div></div>
<div class="stat"><div class="stat-val" style="color:var(--blue)">${meetings.length}</div><div class="stat-label">Meetings</div></div>
</div>
</div>

<!-- SLIDE 2: PROBLEM -->
<div class="slide">
<span class="slide-label">The Problem</span>
<h2>Why This <em>Matters</em></h2>
<p>${esc(problemSummary)}</p>
${problems.length > 1 ? `<div class="slide-grid" style="margin-top:24px">${problems.slice(0, 4).map(p => `<div class="slide-card"><h3>${esc(p.title)}</h3><p>${esc(summarize(p.content, 150))}</p></div>`).join('')}</div>` : ''}
</div>

<!-- SLIDE 3: MARKET -->
<div class="slide">
<span class="slide-label">Market</span>
<h2>The <em>Opportunity</em></h2>
<p>${esc(marketSummary)}</p>
${markets.length > 0 ? `<div class="slide-grid" style="margin-top:24px">${markets.slice(0, 4).map(m => `<div class="slide-card"><h3>${esc(m.title)}</h3><p>${esc(summarize(m.content, 150))}</p></div>`).join('')}</div>` : '<p style="color:var(--muted);margin-top:24px">Market analysis pending. Run /mos:explore-trends</p>'}
</div>

<!-- SLIDE 4: SOLUTION -->
<div class="slide">
<span class="slide-label">The Solution</span>
<h2>How We <em>Solve</em> It</h2>
<p>${esc(solutionSummary)}</p>
${solutions.length > 1 ? `<div class="slide-grid" style="margin-top:24px">${solutions.slice(0, 4).map(s => `<div class="slide-card"><h3>${esc(s.title)}</h3><p>${esc(summarize(s.content, 150))}</p></div>`).join('')}</div>` : ''}
</div>

<!-- SLIDE 5: COMPETITION -->
<div class="slide">
<span class="slide-label">Competition</span>
<h2>The <em>Landscape</em></h2>
<p>${esc(competitionSummary)}</p>
${competition.length > 0 ? `<div class="slide-grid" style="margin-top:24px">${competition.slice(0, 4).map(c => `<div class="slide-card"><h3>${esc(c.title)}</h3><p>${esc(summarize(c.content, 150))}</p></div>`).join('')}</div>` : '<p style="color:var(--muted);margin-top:24px">Competitive analysis pending. Run /mos:challenge-assumptions</p>'}
</div>

<!-- SLIDE 6: BUSINESS MODEL -->
<div class="slide">
<span class="slide-label">Business Model</span>
<h2>How We <em>Win</em></h2>
${businessModel.length > 0 ? `<p>${esc(summarize(businessModel[0].content, 400))}</p>` : '<p style="color:var(--muted)">Business model pending. Run /mos:lean-canvas</p>'}
</div>

<!-- SLIDE 7: TEAM -->
<div class="slide">
<span class="slide-label">The Team</span>
<h2>Who <em>Builds</em> This</h2>
<p>${esc(teamSummary)}</p>
${team.length > 0 ? `<div class="slide-grid" style="margin-top:24px">${team.slice(0, 4).map(t => `<div class="slide-card"><h3>${esc(t.title)}</h3><p>${esc(summarize(t.content, 150))}</p></div>`).join('')}</div>` : ''}
</div>

<!-- SLIDE 8: FINANCIALS -->
<div class="slide">
<span class="slide-label">Financials</span>
<h2>The <em>Numbers</em></h2>
${financials.length > 0 ? `<p>${esc(summarize(financials[0].content, 400))}</p>` : '<p style="color:var(--muted)">Financial projections pending. Run /mos:build-thesis</p>'}
</div>

<!-- SLIDE 9: TRACTION -->
<div class="slide">
<span class="slide-label">Traction</span>
<h2>What's <em>Done</em></h2>
<div class="stat-row">
<div class="stat"><div class="stat-val" style="color:var(--green)">${totalArtifacts}</div><div class="stat-label">Research Artifacts</div></div>
<div class="stat"><div class="stat-val" style="color:var(--yellow)">${markets.length}</div><div class="stat-label">Market Analyses</div></div>
<div class="stat"><div class="stat-val" style="color:var(--blue)">${competition.length}</div><div class="stat-label">Competitive Studies</div></div>
<div class="stat"><div class="stat-val" style="color:var(--red)">${meetings.length}</div><div class="stat-label">Meetings Filed</div></div>
</div>
<p style="margin-top:24px;color:var(--muted)">Data Room powered by MindrianOS -- ${stage} stage</p>
</div>

<!-- SLIDE 10: CTA -->
<div class="slide">
<span class="slide-label">Next Steps</span>
<h2>The <em>Ask</em></h2>
<p style="font-size:18px;margin-bottom:32px">The research is done. The room is built. What comes next?</p>
<div class="cta-grid">
<div class="cta-col"><h4>Explore</h4><p>Browse the full Data Room with ${totalArtifacts} artifacts across ${[problems, markets, solutions, competition, businessModel, team, financials].filter(s => s.length > 0).length} sections</p></div>
<div class="cta-col"><h4>Validate</h4><p>Run /mos:validate to stress-test assumptions with evidence</p></div>
<div class="cta-col"><h4>Connect</h4><p>Built with MindrianOS -- AI innovation co-founder by Jonathan Sagir</p></div>
</div>
</div>

</div><!-- /deck -->

<div class="nav">
<button onclick="prev()">&#8592;</button>
<span class="counter"><span id="cur">1</span> / <span id="tot">10</span></span>
<button onclick="next()">&#8594;</button>
</div>

<div class="mondrian-footer"><span></span><span></span><span></span><span></span></div>

<script>
let c=1;const t=document.querySelectorAll('.slide').length;
document.getElementById('tot').textContent=t;
function show(n){if(n<1)n=1;if(n>t)n=t;c=n;document.querySelectorAll('.slide').forEach((s,i)=>s.classList.toggle('active',i===n-1));document.getElementById('cur').textContent=n;document.getElementById('progress').style.width=(n/t*100)+'%'}
function next(){show(c+1)}function prev(){show(c-1)}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();next()}if(e.key==='ArrowLeft'){e.preventDefault();prev()}if(e.key==='Home'){e.preventDefault();show(1)}if(e.key==='End'){e.preventDefault();show(t)}});
show(1);
</script>
</body>
</html>`;

// Write output
const outDir = path.dirname(outputPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, html);

console.log(`Deck generated: ${outputPath}`);
console.log(`  Venture: ${roomName} (${stage})`);
console.log(`  Slides: 10`);
console.log(`  Artifacts: ${totalArtifacts}`);
