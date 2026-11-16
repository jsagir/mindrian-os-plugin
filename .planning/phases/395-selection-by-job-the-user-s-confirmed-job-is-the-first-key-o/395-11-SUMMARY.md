# 395-11 Summary: optional Eureka engine setup in the install flow

Date: 2026-11-16. Base `57bd73c68`. Owner rulings 30, 31, 34. Committed before its cold check (ruling 38); the cold check reads this commit.

## What changed

* `lib/core/eureka/eureka-engine-enable.cjs`: mode `--setup`; without `--approved-via` it prints the consent card, exits 2 and runs nothing; with approval it runs the engine's public setup script from the pinned commit `EUREKA_SETUP_COMMIT = 9b91d252f532366b7a1958cbbf2d98eaaa9753eb` (POSIX `curl | bash`, Windows `irm | iex`), allowlisted child environment, parses the 3 last-line forms, saves the engine folder through the existing `--path` code; `--check` with no engine offers `--setup` first, then `--path`.
* `bin/cli.js`: after the install, an interactive (y/N, default No) offer; `--eureka`, `--no-eureka`.
* `commands/eureka.md`, `commands/setup.md` (and their skill mirrors), `README.md`, `docs/integrations/mindrian-eureka-engine.md`, a RULE 5 note in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` (the pinned commit moves before a cut).
* Tests: new `tests/test-395-eureka-setup.cjs` (17 arms); 2 planned changes in `tests/test-387-eureka-engine-enable.cjs`; `tests/run-all-395.sh` lists the new file.

## What ran

* New test: 16 fail before, 17 of 17 after (stub script, fake curl, no network). Gates equal before and after. `run-all-395.sh` 12 of 12; suites 387 and 374 pass; 30 nearby tests same state; the 6 failing files fail the same way on untouched code.
* `tests/test-314-command.cjs` K15 failed before the commit only (it checks that `commands/eureka.md` has no diff against HEAD; its content conditions hold). Re-run after this commit below.
* Not run: suites 36925 and 3696; Windows and macOS; the real setup with network (the owner's done check, plan section 8).

## Known limits

* The setup scripts are pinned, but they clone or pull the engine at `main`; the engine code is not pinned until the eureka repo adds `MINDRIAN_EUREKA_REF` (requested from session jsagi-96).
* The setup takes about 1.3 GB on disk and adds 1 line to `~/.bashrc` and `~/.zshrc` (the card says so).
