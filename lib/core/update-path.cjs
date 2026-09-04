'use strict';

/*
 * lib/core/update-path.cjs -- the single source for the two-command plugin
 * update path.
 * =========================================================================
 * Phase 339 Plan 06 (FLIP-04, D-08). Three copies of this string would
 * drift, which is exactly what D-08 asks to prevent: the release doc, the
 * refusal copy, and (in future) the doctor would each retype the two
 * commands and go stale independently. This module is the one home; every
 * other surface requires it, never retypes it.
 *
 * Two command constants, and why there are two (the state-version.cjs
 * discipline): MARKETPLACE_UPDATE_COMMAND refreshes the catalog,
 * PLUGIN_UPDATE_COMMAND installs the latest version. They are two separate
 * steps a user runs in order, not one string, so they stay two exports.
 * UPDATE_PATH_SENTENCE is the third, composed export: a single line that
 * reads naturally inside a refusal render array, for callers that want one
 * sentence rather than assembling the two commands themselves.
 *
 * Byte-identity contract: both command strings MUST equal the fenced
 * ```bash block at .claude/includes/release-process.md:23-26, byte for
 * byte, with that doc's trailing `#` comments stripped.
 * tests/test-339-update-path-single-source.cjs asserts that parity in both
 * directions (doc-to-module and module-to-doc), so drift becomes a red test
 * instead of a silent no-op.
 *
 * This module deliberately refuses two things:
 *
 * 1. It does NOT read .claude/includes/release-process.md at runtime. That
 *    file is a CLAUDE.md @include, not a shipped runtime asset;
 *    package.json's `files` allowlist governs the npm tarball and
 *    release.sh Step 9.5's payload gate refuses a tarball containing docs/
 *    or .planning/, so a runtime read of a doc path is a distribution
 *    hazard. The doc is the SOURCE and
 *    tests/test-339-update-path-single-source.cjs polices the copy.
 * 2. It holds no URL, no origin and no version. Those belong to
 *    brain-client.cjs and to release.sh respectively, and a version baked
 *    into this string would be wrong the moment the next release cuts.
 *
 * Pure CJS, zero requires (in practice, no deps beyond Node built-ins --
 * this module needs none at all).
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const MARKETPLACE_UPDATE_COMMAND = '/plugin marketplace update';
const PLUGIN_UPDATE_COMMAND = 'claude plugin update mos@mindrian-marketplace';
const UPDATE_PATH_SENTENCE = 'Update with two commands: ' + MARKETPLACE_UPDATE_COMMAND + ', then ' + PLUGIN_UPDATE_COMMAND + '.';

module.exports = Object.freeze({
  MARKETPLACE_UPDATE_COMMAND: Object.freeze(MARKETPLACE_UPDATE_COMMAND),
  PLUGIN_UPDATE_COMMAND: Object.freeze(PLUGIN_UPDATE_COMMAND),
  UPDATE_PATH_SENTENCE: Object.freeze(UPDATE_PATH_SENTENCE),
});

// No em-dashes.
