---
quick_id: 261106-pinecone-key-default
status: complete
commits:
  - a750bd94e
files_modified:
  - scripts/consolidate-pinecone.py
  - tests/test-quick-261106-no-pinecone-key-literal.cjs
---

# Quick 261106: remove the hardcoded Pinecone key default

## Result

scripts/consolidate-pinecone.py no longer holds a default value for PINECONE_API_KEY (the hardcoded default was at line 27). The script now reads the variable from the environment. If it is missing, empty or only whitespace, the script prints a clear error to stderr and exits with code 2. The value is never printed or logged. No other behaviour changed.

## Search

- git grep over all tracked files (tests, docs, scripts, data, .planning): the exact bytes of the hardcoded default occurred in 1 file only, scripts/consolidate-pinecone.py.
- A worktree grep (tracked and untracked, excluding .git and node_modules) found the same single file.
- Other pcsk_ occurrences: .planning/debug/pinecone-inference-dead-or-live.md names the prefix in prose and holds no key bytes. No other literal exists.
- After the change, no tracked file matches the prefix followed by 20 or more key characters.

## Verification (PROVEN)

- RED: node tests/test-quick-261106-no-pinecone-key-literal.cjs failed before the change (gate 1 named scripts/consolidate-pinecone.py).
- GREEN: the same test passes after the change (gate 1 and gate 2: exit code 2 for missing, empty and blank, with a stub pinecone module).
- tests/296-pinecone-residue.sh: PASS before and after.
- tests/272-pinecone-inference.test.cjs: PASS before and after.
- python3 -m py_compile on the script: OK.

## Deviations

- The Edit tool needs the old text in its call. That text would put the key bytes in a tool call. A small Python script in the scratchpad replaced line 27 instead. The script checked the line shape and never printed the value.
- The key check sits after the pinecone import check, so a missing package still exits with code 1 first. This keeps the existing order.

## Owner actions (not done here)

- The key stays in git history. The line was tracked since 2026-03-25 (see the earlier debug note).
- The owner must check the key in the Pinecone console and revoke it. Treat it as exposed. Revoking is required whatever happens to history.
- A history rewrite is a separate owner decision. It was not done. Any clone or fork made earlier keeps the key.

## Known stubs

None.
