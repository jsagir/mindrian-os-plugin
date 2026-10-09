'use strict';
function insertNode(_conn, id, type, props, opts) {
  const g = globalThis.__GRAPH;
  if (g && type === 'Section') g.sections[id] = true;
}
module.exports = { insertNode };
