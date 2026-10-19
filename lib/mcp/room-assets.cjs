'use strict';
// Packaged startup-view assets. No network fetch and no CSS changes to other views.
const fs = require('node:fs');
const path = require('node:path');
let cached;
function startupStyles() {
  if (cached) return cached;
  const assets = path.join(__dirname, 'assets');
  const fonts = [['Figtree', 'figtree-latin-400-900.woff2', '700'], ['DM Sans', 'dm-sans-latin-400-700.woff2', '400 700']];
  let css = '';
  for (const [family, file, weight] of fonts) {
    // A missing/corrupt package asset must not remove the usable room controls.
    // Use the declared system fallback; never fetch a replacement font.
    let bytes;
    try { bytes = fs.readFileSync(path.join(assets, file)); } catch (_) { continue; }
    css += `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${bytes.toString('base64')}) format("woff2");font-style:normal;font-weight:${weight};font-display:optional}\n`;
  }
  cached = css + fs.readFileSync(path.join(__dirname, 'app-html/rooms.css'), 'utf8');
  return cached;
}
module.exports = { startupStyles };
