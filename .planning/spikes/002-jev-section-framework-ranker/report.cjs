'use strict';
/*
 * Spike 002 report: renders results.json as a static De Stijl HTML page the
 * navigator can open and feel. No CDN, no deps, inline CSS/JS, hyphens only.
 * Usage: node report.cjs  -> writes report.html next to results.json
 */
const fs = require('node:fs');
const path = require('node:path');

const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const css = `
:root{--red:#D40920;--blue:#1356A2;--yellow:#F7D842;--black:#111;--white:#FAFAF7;--gray:#8a8a8a;--line:#111}
*{box-sizing:border-box}body{margin:0;background:var(--white);color:var(--black);font:15px/1.45 "IBM Plex Sans","Helvetica Neue",Arial,sans-serif}
header{border-bottom:6px solid var(--black);padding:20px 24px;display:flex;gap:16px;align-items:center}
.sq{width:22px;height:22px;display:inline-block;border:2px solid var(--black)}.sq.r{background:var(--red)}.sq.b{background:var(--blue)}.sq.y{background:var(--yellow)}
h1{font-size:22px;margin:0;letter-spacing:.02em}h2{font-size:16px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.08em}
main{padding:20px 24px;max-width:1180px;margin:0 auto}
.tabs{display:flex;gap:0;border:3px solid var(--black);margin:12px 0 18px;width:max-content}
.tabs button{border:0;border-right:3px solid var(--black);background:#fff;padding:8px 14px;font:inherit;cursor:pointer}
.tabs button:last-child{border-right:0}.tabs button.on{background:var(--yellow);font-weight:700}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:900px){.grid{grid-template-columns:1fr}}
.card{border:3px solid var(--black);background:#fff}.card .hd{padding:8px 12px;border-bottom:3px solid var(--black);display:flex;justify-content:space-between;align-items:center}
.card .bd{padding:10px 12px}
.row{display:grid;grid-template-columns:34px 1fr 90px 64px;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #e6e6e0}
.row:last-child{border-bottom:0}.bar{height:14px;border:2px solid var(--black);background:#fff;position:relative}
.bar i{position:absolute;left:0;top:0;bottom:0;background:var(--blue)}.bar i.hit{background:var(--red)}
.lab{font-size:12px;color:var(--gray)}.tag{display:inline-block;padding:1px 6px;border:2px solid var(--black);font-size:11px;margin-left:6px}
.tag.l2{background:var(--red);color:#fff}.tag.l1{background:var(--yellow)}.tag.l0{background:#fff}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:3px solid var(--black);margin-bottom:18px}
.kpi div{padding:10px 12px;border-right:3px solid var(--black)}.kpi div:last-child{border-right:0}.kpi b{display:block;font-size:22px}
.foot{margin-top:18px;font-size:12px;color:var(--gray)}
`;

function scenarioBlock(sid, s) {
  const items = s.ranked; // [{framework, score, confidence, label, degree}]
  const rows = items.map((it, i) => `
    <div class="row"><span class="lab">${i + 1}</span>
      <span>${esc(it.framework)}<span class="tag l${it.label}">label ${it.label}</span></span>
      <span class="bar"><i class="${it.label === 2 ? 'hit' : ''}" style="width:${Math.round((it.score / 2) * 100)}%"></i></span>
      <span class="lab">${it.score.toFixed(2)} / c${it.confidence.toFixed(2)}</span></div>`).join('');
  const m = s.metrics;
  return `<section class="scn" id="scn-${sid}" style="display:none">
    <div class="kpi">
      <div><span class="lab">Spearman: Jev vs hand label</span><b>${m.spearman_jev.toFixed(2)}</b></div>
      <div><span class="lab">Spearman: graph degree vs hand label</span><b>${m.spearman_degree.toFixed(2)}</b></div>
      <div><span class="lab">Top-5 hits on label-2 (Jev / degree)</span><b>${m.top5_jev} / ${m.top5_degree}</b></div>
      <div><span class="lab">Mean confidence: clear (0,2) vs unclear (1)</span><b>${m.conf_clear.toFixed(2)} / ${m.conf_unclear.toFixed(2)}</b></div>
    </div>
    <div class="grid">
      <div class="card"><div class="hd"><h2>${esc(sid)} - Jev ranking</h2><span class="lab">${esc(fixture.scenarios[sid].section)} / ${esc(fixture.scenarios[sid].problem_type)} / ${esc(fixture.scenarios[sid].stage)}</span></div><div class="bd">${rows}</div></div>
      <div class="card"><div class="hd"><h2>Full Theo set - top ${(s.top_full || []).length}</h2><span class="lab">${s.variant} / ${s.wall_ms} ms / ${s.scored} scored</span></div>
        <div class="bd">${(s.top_full || []).map((it, i) => `
    <div class="row"><span class="lab">${i + 1}</span>
      <span>${esc(it.framework)}${it.in_index ? '' : '<span class="tag l1">outside index</span>'}${it.stub ? '<span class="tag l0">stub description</span>' : ''}</span>
      <span class="bar"><i class="${it.in_index ? '' : 'hit'}" style="width:${Math.round((it.score / 2) * 100)}%"></i></span>
      <span class="lab">${it.score.toFixed(2)} / c${it.confidence.toFixed(2)}</span></div>`).join('')}
        <p class="lab" style="margin-top:10px">${esc(fixture.scenarios[sid].why)}</p><p class="lab">Left: the 27 hand-labeled frameworks ranked by Jev; red bar = label 2. Right: Jev's top picks over every Theo framework; red bar = a framework the current 27-name index cannot offer at all. c = confidence. Degree baseline = number of /mos: commands declaring the framework, the signal Lawrence called out as wrong.</p></div></div>
    </div></section>`;
}

const sids = Object.keys(results.scenarios);
const tabs = sids.map((sid, i) => `<button class="${i === 0 ? 'on' : ''}" data-s="${sid}">${sid} ${esc(fixture.scenarios[sid].section)}</button>`).join('');
const blocks = sids.map((sid) => scenarioBlock(sid, results.scenarios[sid])).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spike 002 - Jev section ranker</title><style>${css}</style></head>
<body><header><span class="sq r"></span><span class="sq b"></span><span class="sq y"></span><h1>Spike 002 - Jev as the section framework ranker</h1><span class="lab">${esc(results.model)} - ${esc(results.started)}</span></header>
<main><div class="tabs">${tabs}</div>${blocks}
<div class="foot">Generic handles only (Canon Part 8): section slug, problem type, stage, framework names and their Theo descriptions. Hand labels were written before any call. Variant A = one call per scenario with one Score per framework; Variant B = one call per pair (the rerank cookbook shape).</div></main>
<script>
const btns=[...document.querySelectorAll('.tabs button')];const show=s=>{document.querySelectorAll('.scn').forEach(x=>x.style.display=x.id==='scn-'+s?'':'none');btns.forEach(b=>b.classList.toggle('on',b.dataset.s===s));};
btns.forEach(b=>b.addEventListener('click',()=>show(b.dataset.s)));show('${sids[0]}');
</script></body></html>`;
fs.writeFileSync(path.join(__dirname, 'report.html'), html);
console.log('wrote report.html (' + html.length + ' bytes) for ' + sids.length + ' scenarios');
