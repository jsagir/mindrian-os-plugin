'use strict';
// Negative fixture (phase 276-07, Task 2). Pins the one-level barrel
// re-export hop's REPO-ROOT CONTAINMENT: `external` is require()'d from an
// ABSOLUTE path outside the repo root (/etc/hostname, present on every
// Linux dev/CI box this scanner runs on). This module's own shape mirrors
// lib/core/navigation.cjs's barrel pattern -- an object-literal property
// `NAME: IDENT.NAME` assignment rather than a local function definition --
// so followReexportHop finds the re-export shape and attempts the hop.
//
// resolveRepoLocalPath's `startsWith(rootWithSep)` check MUST reject the
// resolved path before any read happens: this scanner runs inside a
// pre-commit hook, and an uncontained file read here, following a
// require() argument the scanner does not control, would be an
// arbitrary-file-read primitive sitting in every developer's commit path.
//
// Expected (verified directly against locateFunctionBody /
// followReexportHop in the plan's own verification step, phase 276-07
// Task 2): the hop returns null (unresolved), never a body read from
// outside REPO_ROOT.
const external = require('/etc/hostname');

module.exports = {
  getOutsideWidget: external.getOutsideWidget,
};
