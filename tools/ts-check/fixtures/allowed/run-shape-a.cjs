// Runs the allowed shape-(a) fixture with Node's own type stripping (no build step).
const { sum } = require('./shape-a.ts');
const value = sum({ a: 2, b: 3 });
console.log('shape-a sum=' + value);
if (value !== 5) process.exit(1);
