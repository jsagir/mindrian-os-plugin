'use strict';
// M:OS Canonical Design System loader. Returns the single-source CSS bundle so every
// HTML generator inlines the SAME design system. Defensive: never throws.
const fs = require('node:fs');
const path = require('node:path');
let _css = null;
function readDesignSystemCss() {
  if (_css !== null) return _css;
  try {
    const p = path.join(__dirname, '..', '..', 'skills', 'ui-system', 'design-system', 'mos-design-system.css');
    _css = fs.readFileSync(p, 'utf8');
  } catch (_e) { _css = ''; }
  return _css;
}
function mosStyleTag() {
  const css = readDesignSystemCss();
  return css ? '<style data-mos="v1.1">\n' + css + '\n</style>' : '';
}
module.exports = { readDesignSystemCss, mosStyleTag };
