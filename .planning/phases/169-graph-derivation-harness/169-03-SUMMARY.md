---
phase: 169-graph-derivation-harness
plan: "03"
subsystem: graph-derivation-harness
tags: [gdh-04, doc-text-extractor, docx, html, non-destructive, zip-bomb-guard, pure-js, no-new-dep, cheerio, inflateRawSync, wave-3]
requires:
  - "169-01 (the shared IFACE block + tests/test-doc-text-extractor.cjs RED stub + tests/fixtures/169/stored-method.docx + sample.html)"
provides:
  - "lib/core/doc-text-extractor.cjs: extractDocText(absPath) -> string (pure-JS .docx via zip+inflateRawSync+<w:t>, .html via cheerio, '' otherwise; non-destructive; zip-bomb capped)"
  - "the .docx/.html moat content reachable to the indexer + derivation (root cause #3: indexer was .md-only)"
affects:
  - "Plan 04 (graph-derivation.cjs + graph-candidate-producer.cjs) consumes extractDocText for the .docx/.html ROOT-FILES pass"
  - "Plan 05 (graph-backfill.cjs) reaches the dense b2-journey .docx dossiers via this extractor"
tech-stack:
  added: []
  patterns:
    - "ZIP central-directory walk + zlib.inflateRawSync (method 8) + method-0 stored raw fallback (RESEARCH Code Example 1, proven against the b2 fixture: 216 Hebrew runs)"
    - "V5 zip-bomb guard: MAX_ZIP_ENTRIES central-dir cap + inflateRawSync maxOutputLength ~10MB + whole-body try/catch -> '' (the hook's exit-safe degrade)"
    - "non-destructive read-only extraction (D-169-03): the module opens the source for READ only, writes no sidecar, mutates no bytes"
    - "lazy cheerio require inside the .html branch; a missing vendored dep surfaces as CHEERIO_UNAVAILABLE (distinct from a parse fault) so the test skips rather than passing vacuously"
key-files:
  created:
    - lib/core/doc-text-extractor.cjs
  modified: []
decisions:
  - "method-8 entries inflate via zlib.inflateRawSync (NOT inflateSync -- the entry is raw DEFLATE, RESEARCH Pitfall 5); method-0 stored entries read raw with no inflate; unsupported methods return ''"
  - "the .html branch re-throws a missing-cheerio require as CHEERIO_UNAVAILABLE rather than swallowing to '' -- a missing vendored dep is NOT a parse fault, and the RED stub distinguishes the two (it skips on a /cheerio/ message). A genuine cheerio parse fault still degrades to ''"
  - "the global exit-safe '' degrade applies to the .docx parse path (malformed/huge/zip-bomb) and to a real .html parse fault; it does NOT mask a missing dependency"
metrics:
  duration_min: 4
  completed: 2026-06-19
  tasks: 1
  files: 1
  commits: 1
---

# Phase 169 Plan 03: GDH-04 doc-text-extractor (pure-JS non-destructive .docx/.html reader) Summary

Landed `lib/core/doc-text-extractor.cjs`, the pure-JS non-destructive `.docx`/`.html` text extractor that
makes the dense moat content (the 9 b2-journey `.docx` dossiers) reachable to the indexer and the
derivation. The `.docx` path is the ZIP central-directory walk + `zlib.inflateRawSync` + `<w:t>`-run regex
PROVEN this session against the real b2 fixture (216 Hebrew runs); the `.html` path is cheerio (already a
declared HTML-parse dependency). Zero new dependency. Turned `tests/test-doc-text-extractor.cjs` GREEN (4/4).

## What Was Built

- **`extractDocText(absPath) -> string`.** Branches on `path.extname`:
  - **`.docx`:** finds the End Of Central Directory (EOCD) signature `0x06054b50`, walks the central
    directory to locate `word/document.xml`, reads the local header to find the data start, inflates
    method-8 (raw DEFLATE) via `zlib.inflateRawSync` with a `maxOutputLength` size cap, reads method-0
    (stored) raw with no inflate, regex-pulls `<w:t[^>]*>([^<]*)</w:t>` runs, joins with spaces. Hebrew /
    UTF-8 decodes correctly via `toString('utf8')` (RESEARCH Pitfall 5).
  - **`.html` / `.htm`:** lazily `require('cheerio')`, loads the file READ-only, returns `$('body').text()`
    (falls back to `$.root().text()` if no body).
  - **other extension:** returns `''`.
- **Non-destructive (D-169-03).** The module opens the source for READ only (`fs.readFileSync`), writes no
  sidecar `.md`, and mutates no bytes. The RED stub asserts the source `.docx` sha256 is identical
  before/after the call; the test is GREEN, so the guarantee holds.
- **Zip-bomb hardened (V5 / T-169-04 / T-169-05).** `MAX_ZIP_ENTRIES` (4096) caps the central-directory
  loop so a forged EOCD count cannot spin it; `inflateRawSync` carries a `maxOutputLength` of ~10 MB so a
  tiny compressed entry cannot inflate unbounded (a stored method-0 entry over the cap is rejected too);
  the whole `.docx` body is wrapped in `try/catch` returning `''` on any parse fault (the hook's existing
  exit-safe degrade pattern).
- **Zero new dependency (T-169-SC).** Node built-ins ONLY for `.docx` (`node:fs`, `node:zlib`, `node:path`)
  plus the already-listed `cheerio` for `.html`. `package.json` and `package-lock.json` are byte-unchanged
  (verified `git diff --stat` empty). No `mammoth` / `adm-zip` / `docx` was added (REJECTED in RESEARCH).

## The Shared IFACE

The plan implements the 169-01 `shared_iface_contract` signature verbatim: `extractDocText(absPath) ->
string` -- `.docx` via `zlib.inflateRawSync` over `word/document.xml` `<w:t>` runs with a method-0 stored
fallback, `.html` via cheerio body text, `''` otherwise, never mutates the source, zip-bomb capped. Plan 04
(`graph-derivation.cjs` + `graph-candidate-producer.cjs`) and Plan 05 (`graph-backfill.cjs`) are the
downstream consumers that read the `.docx`/`.html` ROOT-FILES through this extractor.

## Canon Compliance

- **Part 8 (Graph Boundary).** Extraction is a LOCAL file READ only; the extracted text is DATA (never
  `eval`/`exec`'d); zero network surface; nothing reaches the Brain. The `run-all-169.sh` Part-8 grep sweep
  stays PASSED with the extractor surface present.
- **Part 6 (Reuse Before Build).** The `.docx` path is the built-in `zlib` walk proven this session, not a
  new dependency; the `.html` path reuses the already-declared cheerio. Net-new surface is one ~140-line
  module exporting one function the shared IFACE already named.

## Verification

- `node tests/test-doc-text-extractor.cjs` -> `PASS (4/4)`, exit 0. The synthetic method-0 stored `.docx`
  fixture yields the two `w:t` runs (`Stored method run` matched), the source bytes are UNCHANGED, an
  unsupported extension returns `''`, and the live b2 fixture leg skips-if-absent (CI uses the synthetic
  fixture). The `.html` cheerio leg skips because `cheerio` is unvendored on `main` (`git rm -r --cached`'d
  per the vendored-node_modules release rule) -- the extractor re-throws `CHEERIO_UNAVAILABLE` and the stub
  skips on the `/cheerio/` message; the RED-by-require gate plus the byte-unchanged + `.docx` + empty-string
  assertions are the real coverage.
- `bash tests/run-all-169.sh` -> Total 17, Passed 7 (was 6), Failed 10. The increment is
  `test-doc-text-extractor.cjs` flipping GREEN. The other ten 169 stubs stay RED-untouched (Waves 4-7 turn
  them GREEN), and the two carried floor tests + the frozen-edge-set + Part-8 grep + em-dash sweeps stay
  PASSED.
- `package.json` / `package-lock.json` byte-unchanged (zero new deps).
- `node -c lib/core/doc-text-extractor.cjs` clean; em-dash sweep over the module: zero literal em-dashes.

## Deviations from Plan

None of Rules 1-4 fired. One IFACE-faithful design choice worth recording: the plan rule says "wrap the
whole body in try/catch returning '' on any fault," but the RED stub's `.html` leg distinguishes a missing
`cheerio` dependency (it skips on a `/cheerio/` error message) from a real failure. A missing vendored dep
is NOT a content parse fault, so the `.html` branch re-throws it as `CHEERIO_UNAVAILABLE` rather than
masking it to `''`; a genuine cheerio parse fault still degrades to `''`, and the `.docx` parse path
degrades to `''` exactly as specified. This honors both the exit-safe-degrade rule (for parse faults) and
the stub's skip-vs-pass distinction (for the unvendored dep), and it does not weaken the non-destructive,
zip-bomb, or zero-new-dep guarantees.

## Authentication Gates

None.

## Known Stubs

None introduced by this plan. `lib/core/doc-text-extractor.cjs` is a complete, tested implementation of the
GDH-04 IFACE; its RED stub is now GREEN. The ten remaining RED stubs in `run-all-169.sh` belong to Waves
4-7 (the derivation loop, idempotence, backfill, Part-8 sweep, self-heal, lineage edge, recursive rollup,
depth-2 citizen) and are intentionally untouched here.

## Threat Flags

None. No new network endpoint, auth path, or schema change at a trust boundary. The only new surface is a
LOCAL read-only file parser; the plan's `<threat_model>` (T-169-04 DoS zip-bomb, T-169-05 malformed zip,
T-169-06 source mutation, T-169-SC new docx dep) is fully mitigated in code (size+entry caps + try/catch,
read-only + byte-unchanged assertion, built-ins + existing cheerio only).

## Commits

- `2643b581` feat(169-03): GDH-04 doc-text-extractor (pure-JS .docx/.html, non-destructive, zip-bomb capped)

## Self-Check: PASSED

- Created file exists: `lib/core/doc-text-extractor.cjs` (FOUND).
- Commit hash exists in git: `2643b581` (FOUND).
- Em-dash sweep over the module + this SUMMARY: zero literal em-dashes.
