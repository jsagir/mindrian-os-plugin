'use strict';
// Companion module for tests/fixtures/tool-honesty/unresolvable.cjs (phase
// 276-07, Task 3). Deliberately does NOT define or re-export `doSomething`
// -- no local function definition, no `NAME: mod.NAME` barrel property --
// so a caller resolving `helper.doSomething()` against this module's text
// finds nothing by either of locateFunctionBody's two paths (direct
// definition or the one-level re-export hop). unrelatedExport exists only
// so this file is a plausible module, not an empty file.
function unrelatedExport() {
  return 'not the function being called';
}

module.exports = { unrelatedExport };
