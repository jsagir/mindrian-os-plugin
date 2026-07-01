"""Canonical RS corpus exclude-list (SEED-018 fix, Phase 200-01).

The ONE source of truth for which directories and files the RS room-artifact
walkers skip. Before this module, three walkers each kept their own SKIP_DIRS
copy (lib/core/rs_hybrid.py, lib/core/rs_rooms.py, scripts/rs-engine.py) and the
copies DRIFTED: rs-engine.py had .heal-backup (Phase 140-02) but the other two did
not, so the SEED-018 hybrid-mode run walked into .heal-backup and inflated
room_count to 706. Importing this shared source in all three walkers makes that
drift impossible.

Contract: room-artifact walkers do `from rs_corpus_exclude import SKIP_DIRS,
SKIP_FILES, MIN_BODY_CHARS` and keep no local literal. LOCAL only, no network,
no Brain. Pure data module (Python stdlib only). No em-dashes.
"""

# Directories we never descend into: tooling / metadata / backups / caches, not
# room artifacts. The first six are the historical set; the rest are the SEED-018
# additions that the hybrid-mode corpus pollution exposed.
SKIP_DIRS = {
    ".lazygraph",
    ".git",
    ".mindrian",
    "node_modules",
    ".obsidian",
    ".heal-backup",
    ".private",
    ".intelligence",
    ".room-graph",
    ".rs-engine-checkpoints",
    ".session-binding",
    ".cache",
}

# Room-scaffold files that are never venture content.
SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md"}

# Minimum post-frontmatter body length to treat a .md file as an artifact. Shared
# so Mode A (rs-engine.py), Mode C hybrid (rs_hybrid.py), and rs_rooms.py agree.
MIN_BODY_CHARS = 50
