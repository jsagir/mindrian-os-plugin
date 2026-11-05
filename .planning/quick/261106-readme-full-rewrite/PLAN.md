# Quick 261106-readme-full-rewrite: rewrite the root README.md completely

Owner request: "update the README completely".

## Goal

Replace README.md with a README that leads with the job a person hires MindrianOS for, then how, then install, then what they get. Plain English, Feynman style, no em dashes, PwS spelling.

## Tasks

1. Enumerate every fact from disk (version, counts, install commands, hooks groups). State each number only with its source command in the SUMMARY. Leave out any number with no source.
2. Run the tests that pin README text before the edit: tests/test-250-doctrine-fence.cjs, tests/test-341-install-sh-retired.cjs, tests/test-first-touch-drift-scanner.cjs, tests/test-127-03-no-em-dashes.sh, tests/test-115-surfaces-grep.sh.
3. Write the new README.md. Keep the two documented update commands and the bold tagline that test-115 pins. Make no promise about phases 384 to 386 (speed fixes, cleanup, bug fixes).
4. Re-run the pinned tests, check em-dash count is 0, check no stray PWS.
5. Commit README.md, PLAN.md, SUMMARY.md with `git commit --only`.

## Limits

No other file edits unless a pinned test forces one. No push.
