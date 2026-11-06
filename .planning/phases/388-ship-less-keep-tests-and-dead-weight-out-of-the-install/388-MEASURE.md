# Phase 388 plan 01: MEASURE report

Scope: counts and bytes of what the npm package ships, a class for every shipped file that could be dead weight, and the verdict on the auditor claim "about 2.5 MB of tests ship". No product file was changed. Everything under the heading "Measured figures (generated)" was produced by 388-measure.cjs from `npm pack --dry-run --json --ignore-scripts` (offline). `388-measure.cjs check` recomputes it from 388-pack-baseline.tsv and 388-candidates.tsv and fails when one number in this file is edited. The HEAD sha and the package version are in the first lines of the generated block.

Marks: PROVEN means the command was run in this plan and the output was read. UNVERIFIED means it was not run. ASSUMED means it is a premise.

Method note (PROVEN): the source is `npm pack --dry-run --json --ignore-scripts`, run with the npm CLI path from lib/core/npm-cli-resolve.cjs (the same spawn as scripts/check-release-payload-ceiling.cjs). It packs the work tree, not the git index. A peer session edits product files in this tree. At measurement time `git status` showed no shipped path as modified or untracked (line 2 of 388-pack-baseline.tsv: `dirty-shipped-paths=none`). HEAD moved while this plan ran (the planner saw c6c364eb3, the executor started at dd3616797). The figures here come from the HEAD in the generated block; they differ from the planner figures by the files that peers added since.

## Measured figures (generated)

HEAD: 2d4c3947bc0963090a2c28e2c090cdcf1759093a
version: 2.0.0-beta.80
entryCount: 2416
size: 14030456
unpackedSize: 46263781
baseline-files: 2416
baseline-bytes: 46263781

### Bytes and files per top folder
| folder | files | bytes |
|---|---|---|
| lib | 1397 | 31274857 |
| scripts | 392 | 7637408 |
| skills | 139 | 1607506 |
| data | 144 | 1235821 |
| commands | 113 | 1234535 |
| assets | 6 | 941219 |
| references | 115 | 883885 |
| (root files) | 7 | 848237 |
| templates | 55 | 373492 |
| agents | 17 | 137066 |
| pipelines | 19 | 55794 |
| hooks | 3 | 14158 |
| bin | 6 | 12482 |
| output-styles | 1 | 4740 |
| evals | 1 | 1853 |
| .claude-plugin | 1 | 728 |

### Bytes and files per second level of lib/
| folder | files | bytes |
|---|---|---|
| lib/ui-shell | 272 | 10612627 |
| lib/core | 652 | 9632557 |
| lib/wiki | 11 | 4941665 |
| lib/memory | 172 | 2676533 |
| lib/mcp | 91 | 1324234 |
| lib/hmi | 55 | 589738 |
| lib/workflow | 23 | 348953 |
| lib/mos-face | 26 | 282947 |
| lib/import | 26 | 167354 |
| lib/agents | 11 | 159302 |
| lib/statusline | 13 | 90005 |
| lib/brain | 5 | 81859 |
| lib/chat | 4 | 57042 |
| lib/lens-engine | 2 | 55479 |
| lib/render | 5 | 53519 |
| lib/conversation | 6 | 48873 |
| lib/quickview | 2 | 44010 |
| lib/vault | 4 | 34227 |
| lib/graph | 3 | 30526 |
| lib/sessionstart | 4 | 15756 |
| lib/state | 2 | 8874 |
| lib/presentation | 2 | 7369 |
| lib/(files) | 2 | 4963 |
| lib/parity | 1 | 2978 |
| lib/copy | 1 | 2592 |
| lib/ui | 1 | 721 |
| lib/__pycache__ | 1 | 154 |

### Bytes and files per second level of scripts/
| folder | files | bytes |
|---|---|---|
| scripts/(files) | 383 | 7438068 |
| scripts/__pycache__ | 2 | 119177 |
| scripts/hooks | 3 | 65238 |
| scripts/lib | 2 | 8794 |
| scripts/dogfood-bridge | 2 | 6131 |

### Bytes and files per class
| class | name | files | bytes | share of unpackedSize |
|---|---|---|---|---|
| T1 | test-file | 251 | 3310317 | 7.16% |
| T2 | test-runner | 2 | 158125 | 0.34% |
| T3 | fixture | 0 | 0 | 0.00% |
| T4 | bytecode-cache | 11 | 216053 | 0.47% |
| T5 | doc-in-code | 54 | 202427 | 0.44% |
| T6 | dev-tool-script | 20 | 471675 | 1.02% |
| T7 | unreached-module | 143 | 1688159 | 3.65% |
| T8 | test-only-module | 14 | 41849 | 0.09% |
| all | all candidates | 495 | 6088605 | 13.16% |

### Ten largest files of class T1 (test-file)
| class | path | bytes |
|---|---|---|
| T1 | lib/memory/brain-derivation-graceful-degradation.test.cjs | 42716 |
| T1 | lib/core/doctor/class-m-brain-smoke.test.cjs | 40760 |
| T1 | lib/core/mva-orchestrator.test.cjs | 37680 |
| T1 | lib/memory/feynman-minto-guardian.test.cjs | 37089 |
| T1 | lib/memory/test-rs-fetcher-academic.cjs | 36221 |
| T1 | lib/memory/post-compact-reinjection.test.cjs | 34410 |
| T1 | lib/memory/cross-room-aggregator.test.cjs | 34260 |
| T1 | lib/memory/orchestration-projection.test.cjs | 31831 |
| T1 | lib/memory/test-rs-fetcher-industry.cjs | 30285 |
| T1 | lib/memory/userpromptsubmit-integration.test.cjs | 30140 |

### Ten largest files of class T2 (test-runner)
| class | path | bytes |
|---|---|---|
| T2 | lib/memory/run-feynman-tests.cjs | 157044 |
| T2 | lib/import/run-all-tests.cjs | 1081 |

### Ten largest files of class T3 (fixture)
| class | path | bytes |
|---|---|---|
| T3 | (none) | 0 |

### Ten largest files of class T4 (bytecode-cache)
| class | path | bytes |
|---|---|---|
| T4 | scripts/__pycache__/rs-engine.cpython-312.pyc | 77431 |
| T4 | scripts/__pycache__/compute-hsi.cpython-312.pyc | 41746 |
| T4 | lib/core/__pycache__/rs_cache.cpython-312.pyc | 26364 |
| T4 | lib/core/__pycache__/rs_hybrid.cpython-312.pyc | 22123 |
| T4 | lib/core/__pycache__/rs_corpus.cpython-312.pyc | 21059 |
| T4 | lib/core/__pycache__/rs_math.cpython-312.pyc | 11648 |
| T4 | lib/core/__pycache__/rs_rooms.cpython-312.pyc | 8447 |
| T4 | scripts/lib/__pycache__/ensure_ml_deps.cpython-312.pyc | 5210 |
| T4 | lib/core/__pycache__/rs_corpus_exclude.cpython-312.pyc | 1712 |
| T4 | lib/core/__pycache__/__init__.cpython-312.pyc | 159 |

### Ten largest files of class T5 (doc-in-code)
| class | path | bytes |
|---|---|---|
| T5 | scripts/power-demo-prompt.md | 31925 |
| T5 | data/harness-fixtures/converged-room/references/SECTION-SCHEMA.md | 13626 |
| T5 | lib/core/research-planner/CONTEXT.md | 11686 |
| T5 | data/ROOM.md | 11541 |
| T5 | lib/render/ROOM.md | 9444 |
| T5 | lib/render/JTBD-PALETTES.md | 8458 |
| T5 | scripts/PYTHON_GATES.md | 7217 |
| T5 | lib/memory/validators/README.md | 6657 |
| T5 | data/harness-fixtures/converged-room/STATE.md | 6078 |
| T5 | lib/core/navigation/CONTEXT.md | 5990 |

### Ten largest files of class T6 (dev-tool-script)
| class | path | bytes |
|---|---|---|
| T6 | scripts/eval-larry-voice.cjs | 112072 |
| T6 | scripts/measure-355-hit-rate.cjs | 80774 |
| T6 | scripts/build-framework-command-ledger.cjs | 27078 |
| T6 | scripts/measure-relevance-signals-362.cjs | 22737 |
| T6 | scripts/measure-hook-cold-start.cjs | 22577 |
| T6 | scripts/migrate-room-sections-v275.cjs | 21962 |
| T6 | scripts/build-dist-bundles.cjs | 21387 |
| T6 | scripts/measure-larry-voice.cjs | 20607 |
| T6 | scripts/check-flagship-floor.cjs | 19428 |
| T6 | scripts/check-research-isomorphism.cjs | 18305 |

### Ten largest files of class T7 (unreached-module)
| class | path | bytes |
|---|---|---|
| T7 | lib/mcp/app-html/mindrian-platform.html | 57150 |
| T7 | scripts/brain-normalize-final.cypher | 54681 |
| T7 | scripts/v182-brain-optimize.cypher | 44518 |
| T7 | scripts/replay-card-fire.cjs | 44419 |
| T7 | scripts/release-cut-listener.cjs | 43895 |
| T7 | scripts/isolate-larry-voice.cjs | 42479 |
| T7 | scripts/extract-dogfood-stop-events.cjs | 42154 |
| T7 | scripts/skillopt-codereview.cjs | 41848 |
| T7 | scripts/spike-366.cjs | 41404 |
| T7 | scripts/forward-fork-scenarios-359.cjs | 40564 |

### Ten largest files of class T8 (test-only-module)
| class | path | bytes |
|---|---|---|
| T8 | scripts/huji-run-one-async.cjs | 16253 |
| T8 | scripts/audit-body-shape-coverage.cjs | 7323 |
| T8 | lib/workflow/f4-scope-consumer.cjs | 4796 |
| T8 | lib/workflow/f3-depth-consumer.cjs | 4274 |
| T8 | lib/hmi/f4-scope-capture-cli.cjs | 3630 |
| T8 | lib/hmi/f3-depth-capture-cli.cjs | 3324 |
| T8 | lib/core/__nav-stub.cjs | 978 |
| T8 | data/hitl-shape-declaration-fixtures/invalid-ranker-contradiction.json | 303 |
| T8 | data/hitl-shape-declaration-fixtures/valid-multi-stage.json | 287 |
| T8 | data/hitl-shape-declaration-fixtures/valid-skill-exempt.json | 244 |

### Strict test set
strict-test-set (T1+T2+T3): files 253, unpacked bytes 3468442
CLAIM-2.5MB-TESTS: REFUTED-HIGHER 3468442 unpacked bytes (strict test set T1+T2+T3 in the pack payload; rule: CONFIRMED when 2000000 to 3000000 inclusive)

## Auditor claim

The verdict line is the one that starts with `CLAIM-2.5MB-TESTS:` in the generated block above. Basis (PROVEN): unpacked bytes of the strict test set (T1 test files, T2 test runners, T3 fixtures) in the `npm pack --dry-run --json` payload, rule "CONFIRMED when 2,000,000 to 3,000,000 bytes inclusive".

- Strict test set (PROVEN): 253 files, 3,468,442 unpacked bytes. That is above the 3,000,000 upper bound, so the plan rule gives REFUTED-HIGHER: more than 2.5 MB of test-named files ship, not less.
- Parts of the strict set (PROVEN, derived from 388-pack-baseline.tsv): files named `*.test.*` are 222 files and 2,742,221 bytes (212 files and 2,620,491 bytes in lib/, 10 files and 121,730 bytes in scripts/). Files named `test-*.(cjs|js|mjs|sh|py)` are 29 files and 568,096 bytes. The two test runners (T2) are 158,125 bytes (lib/memory/run-feynman-tests.cjs is 157,044 bytes). No `__tests__` folder and no fixtures folder ships (T3 is 0 files, because package.json `files` already excludes lib/import/test-fixtures).
- Reading of the claim: the auditor figure "about 2.5 MB" is close to the `*.test.*` files alone (2.74 MB). It is not the same as the plan strict set (3.47 MB), which also counts the test-*.cjs helpers and the runners. The planner orientation figures (222 files and 2.74 MB for `*.test.*`, 29 files and 0.57 MB for test-*.cjs) are right: they are reproduced exactly above. The strict set is their sum plus the two runners.
- Zero test files from the repo `tests/` folder ship. The repo `tests/` folder is 63,202,896 bytes in 2,812 files (PROVEN, `du -sb tests` and `find tests -type f`). No payload path starts with `tests/`, `docs/` or `.planning/` (PROVEN, counted from the baseline: 0, 0, 0). So the tests that ship are the test files that live inside lib/ and scripts/, next to the code they test.
- Share: the strict set is 7.50 percent of the unpacked size. The packed (gzip) cost of these files is not measured per file (UNVERIFIED); the tarball is 14,030,456 bytes in total.

## Stale rule

`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 1 says: "`package.json:files` MUST stay this slim (~164KB, ~6 files)" and "Shipping the whole 8.5MB plugin in the npm tarball is a defect". The real payload is the entryCount and size in the generated block (about 2,416 entries, a 14.0 MB tarball, 46.3 MB unpacked). RULE 1 has not described the package since Phase 341 (the loader installs the plugin from the npm tarball and the shrinkwrap ships inside it; RULE 8 of the same file says so). This report records the fact only. The docs file was not edited.

## What the loader builds

All figures here are from commands run in this plan, in a scratch folder under the session scratchpad. The scratch folder is deleted at the end.

| Step | Figure | Mark |
|---|---|---|
| `npm pack --ignore-scripts --pack-destination <scratch>` writes mindrian_os-cli-2.0.0-beta.80.tgz | 14,030,456 bytes, equal to the `size` field of the dry run | PROVEN |
| Extract the tarball (tar -xzf): files in the extracted tree | 2,416 | PROVEN |
| Extracted tree, `du -sb` | 46,263,781 bytes, equal to `unpackedSize` | PROVEN |
| Extracted tree on disk with block rounding, `du -sk` | 51,624 KB | PROVEN |
| Extracted tree by top folder (`du -sb`) | lib 31,274,857; scripts 7,637,408; skills 1,607,506; data 1,235,821; commands 1,234,535; assets 941,219; references 883,885; templates 373,492; agents 137,066 | PROVEN |
| Install layout the loader builds | `<HOME>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/` holds the extracted package; the loader then runs `npm ci --ignore-scripts` there from the shipped npm-shrinkwrap.json (RULE 8 of docs/RELEASE-CEREMONY-RULING-SYSTEM.md; tests/test-369-installed-layout.cjs reproduces it) | PROVEN by reading the rule and the test; the loader itself was not run |
| Per machine `node_modules` tree from `npm ci` | not measured. ENV GAP: this plan ran under the rule "offline, no install from the registry", so no `npm ci` was run. The carried figure is "+460M" per machine from 369-BAKEOFF-DECISION.md (line 58 and RULE 8). It is carried, not re-measured | UNVERIFIED |
| The repo `node_modules` folder (used by the linked layout in tests/helpers/eureka-installed-layout-387.cjs, which plan 388-02 reuses) | 451,017,136 bytes. It is the dev tree, not the loader tree, so it is not a proxy for the user install | PROVEN as a number, ASSUMED as irrelevant to the user |

One network touch is disclosed: a single `npm view nonexistent-pkg-388` call to the registry was made to test reachability; it returned HTTP 404 (registry reachable). It installed nothing. No other network call was made.

## Built runtime assets, not candidates

These are built runtime assets. They are not test or doc weight. This phase does not touch them. They are listed so the owner can see the weight that stays.

| Path | Files | Bytes | Mark |
|---|---|---|---|
| lib/ui-shell/dist | 271 | 10,583,606 | PROVEN |
| lib/wiki/editor-dist | 2 | 4,802,390 (lib/wiki/editor-dist/wiki-editor.js is 4,576,832) | PROVEN |
| assets/fonts | 3 | 893,468 | PROVEN |

Together that is 16,279,464 bytes, 35.2 percent of the unpacked size. The test and dead-weight candidates in the next section total 6,088,605 bytes, 13.16 percent.

## Candidate classes

The class table is in the generated block. Readings (each row must still be proven or rejected by plan 388-02):

- T1 test-file, 251 files, 3,310,317 bytes: `*.test.*` files and `test-*` files in lib/ and scripts/. The biggest block of candidates. Reading: probably not needed at run time; plan 388-02 must check hook, doctor and data-file readers.
- T2 test-runner, 2 files, 158,125 bytes: run-feynman-tests.cjs and run-all-tests.cjs.
- T3 fixture: none ship.
- T4 bytecode-cache, 11 files, 216,053 bytes: Python `__pycache__` .pyc files for Python 3.12. They are build side effects. Python rebuilds them when needed.
- T5 doc-in-code, 54 files, 202,427 bytes: `.md` under lib/ (16 files, 67,557 bytes), scripts/ (3 files, 44,967 bytes) and data/ (35 files, 89,903 bytes). Some of these are read as prompts or templates at run time (for example data/harness-fixtures and scripts/power-demo-prompt.md); plan 388-02 must check each one.
- T6 dev-tool-script, 20 files, 471,675 bytes: scripts named build-, check-, measure-, eval-, collect-, verify-, refresh-, migrate- or generate- that the coarse reach scan does not reach. A lower bound by construction.
- T7 unreached-module, 143 files, 1,688,159 bytes: files in lib/, scripts/ or data/ that the coarse reach scan does not reach and that have no other class. A lower bound by construction. Many are scripts that only the dev-only release scripts (not shipped) or the user start by hand; plan 388-02 labels them.
- T8 test-only-module, 14 files, 41,849 bytes: reached only from test files. These are "ruled keep" by the Phase 385 owner ruling R9 and R10 (385-PROOF.md section 14: keep all test-only modules, delete none). They are listed, not proposed for exclusion unless the owner rules otherwise.

The reach scan is conservative: it counts a literal require or import, a path.join or path.resolve with literal segments, and any string literal that equals a payload path or a payload file name with its extension. A file name match counts as an edge. So a file can look "reached" because another file of the same name is cited. This makes T6 and T7 a lower bound and never a false claim of dead weight. T1 to T5 are classified by name and are candidates even when the scan reaches them; plan 388-02 decides.

Protected: no row of 388-candidates.tsv starts with commands/, skills/, agents/, pipelines/, hooks/, bin/, .claude-plugin/ or output-styles/, equals a root of the scan, or equals evals/eureka/212-critic-baseline.json (checked by `388-measure.cjs check` and by the verify grep). The eureka critic baseline ships on purpose (quick 261106-eureka-critic-baseline-ships).

## Not measured

- No test of run-time behavior on a reduced install (plan 388-02).
- The `npm ci` tree size (ENV GAP, see the loader section).
- The per-file gzip cost inside the 14.0 MB tarball.
- The Desktop copy size (built by release.sh Step 6.8 from the pack payload; not built here).
- The built assets were not opened. Whether lib/ui-shell/dist or lib/wiki/editor-dist hold dead chunks is out of scope.
- The reach scan reads text files up to 3 MB and does not read minified assets under lib/ui-shell/dist and lib/wiki/editor-dist (treated as reached).
