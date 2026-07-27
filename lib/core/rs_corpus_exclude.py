"""Canonical RS corpus exclude-list (SEED-018 fix, Phase 200-01).

The ONE source of truth for which directories and files the RS room-artifact
walkers skip. Before this module, three walkers each kept their own SKIP_DIRS
copy (lib/core/rs_hybrid.py, lib/core/rs_rooms.py, scripts/rs-engine.py) and the
copies DRIFTED: rs-engine.py had .heal-backup (Phase 140-02) but the other two did
not, so the SEED-018 hybrid-mode run walked into .heal-backup and inflated
room_count to 706. Importing this shared source in all three walkers makes that
drift impossible.

Phase 233-03 migrated the FOURTH walker, scripts/compute-hsi.py, which was never
brought over in Phase 200-01 and had drifted the same way: its local literal never
learned .snapshots or sub-rooms, so it scored backup state-dumps and sub-room
content as its top HSI pairs and hsi-to-graph.cjs then wrote zero edges (RCA
.planning/debug/graph-derive-silent-clear-dead-api-derivation.md, Section 9
Defect #4). Four walkers, one source.

Contract: room-artifact walkers do `from rs_corpus_exclude import SKIP_DIRS,
SKIP_FILES, MIN_BODY_CHARS` and keep no local literal. LOCAL only, no network,
no Brain. Pure data module (Python stdlib only). No em-dashes.
"""

# Directories we never descend into: tooling / metadata / backups / caches, not
# room artifacts. The first six are the historical set; then the SEED-018
# additions that the hybrid-mode corpus pollution exposed; then the Phase 233-03
# additions (RCA Section 9 Defect #4).
#
# Phase 233-03 rationale for the last three:
#   .snapshots  historical STATE dumps. Near-duplicates of each other, so a
#               similarity scanner ranks them as its top "discoveries" and buries
#               every real artifact pair (motj: 207 artifacts, top-20 pairs all
#               backup noise).
#   sub-rooms   a sub-room is a FULL room with its OWN room.db (Phase 169
#               NESTED_WITHIN). Its content belongs to its own graph; walking it
#               from the parent both double-counts it and produces ids that can
#               never resolve to a node in the parent's db.
#   .context    per-session scaffold (last-session.md, learning-progress.md), not
#               venture content. Named in 233-CONTEXT.md's dot-dir list.
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
    ".snapshots",
    "sub-rooms",
    ".context",
}

# Room-scaffold files that are never venture content.
SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md"}

# Minimum post-frontmatter body length to treat a .md file as an artifact. Shared
# so Mode A (rs-engine.py), Mode C hybrid (rs_hybrid.py), and rs_rooms.py agree.
MIN_BODY_CHARS = 50
