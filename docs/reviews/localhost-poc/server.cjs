'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.MINDRIAN_POC_PORT || process.argv[2] || 3196);
const HOST = '127.0.0.1';
const graphPath = path.join(DATA, 'graph.json');
const documentPath = path.join(DATA, 'workspace.md');

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }
function readBody(req) { return new Promise((resolve, reject) => { let b = ''; req.on('data', c => { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', () => resolve(b)); req.on('error', reject); }); }
function graph() { return readJson(graphPath, { nodes: [], edges: [] }); }
function graphAnswer(question) {
  const q = String(question || '').toLowerCase();
  const g = graph();
  const terms = q.split(/\W+/).filter(x => x.length > 2);
  const hits = g.nodes.filter(n => terms.some(t => JSON.stringify(n).toLowerCase().includes(t))).slice(0, 8);
  const relatedIds = new Set(hits.map(n => n.id));
  const edges = g.edges.filter(e => relatedIds.has(e.source) || relatedIds.has(e.target)).slice(0, 10);
  if (!hits.length) return { answer: 'The local graph has no matching nodes. Try a concept such as customer, urgency, handoff, or budget.', nodes: [], edges: [] };
  return { answer: `The local graph found ${hits.length} relevant node${hits.length === 1 ? '' : 's'} and ${edges.length} related connection${edges.length === 1 ? '' : 's'}.`, nodes: hits, edges };
}
function serveFile(res, file, type) { try { const body = fs.readFileSync(file); res.writeHead(200, { 'Content-Type': type }); res.end(body); } catch (_) { res.writeHead(404); res.end('not found'); } }

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && u.pathname === '/') return serveFile(res, path.join(ROOT, 'index.html'), 'text/html; charset=utf-8');
  if (req.method === 'GET' && u.pathname === '/app.js') return serveFile(res, path.join(ROOT, 'app.js'), 'text/javascript; charset=utf-8');
  if (req.method === 'GET' && u.pathname === '/styles.css') return serveFile(res, path.join(ROOT, 'styles.css'), 'text/css; charset=utf-8');
  if (req.method === 'GET' && u.pathname === '/api/graph') return json(res, 200, graph());
  if (req.method === 'GET' && u.pathname === '/api/document') return json(res, 200, { markdown: fs.readFileSync(documentPath, 'utf8'), updatedAt: fs.statSync(documentPath).mtime.toISOString() });
  if (req.method === 'POST' && u.pathname === '/api/document') {
    try { const b = JSON.parse(await readBody(req)); if (typeof b.markdown !== 'string' || b.markdown.length > 1e6) return json(res, 400, { error: 'invalid document' }); fs.writeFileSync(documentPath, b.markdown); return json(res, 200, { ok: true, updatedAt: new Date().toISOString() }); }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (req.method === 'POST' && u.pathname === '/api/graph/ask') { try { const b = JSON.parse(await readBody(req)); return json(res, 200, graphAnswer(b.question)); } catch (e) { return json(res, 400, { error: e.message }); } }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, HOST, () => process.stdout.write(`MindrianOS localhost POC: http://${HOST}:${PORT}/\n`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
