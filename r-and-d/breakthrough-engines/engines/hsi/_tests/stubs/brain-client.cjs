'use strict';
// Controlled through globalThis.__BRAIN = { available, write(cypher), askOp(name, args) }
const b = () => globalThis.__BRAIN || { available: false };
module.exports = {
  isAvailable: () => !!b().available,
  write: async (c) => (b().write ? b().write(c) : null),
  query: async () => null,
  askOp: async (n, a) => (b().askOp ? b().askOp(n, a) : null),
};
