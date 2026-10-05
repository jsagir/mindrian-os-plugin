# 01 g_counts
for p in canary redact privacy_manifest 'privacy manifest' leak_canar sensitivity; do echo "$p: $(grep -rnIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next "$p" lib scripts commands hooks ui/shell/server ui/shell/client agents skills --include=*.cjs --include=*.ts --include=*.tsx --include=*.md --include=*.json --include=*.sh | wc -l)"; done
# 02 g_files
grep -rlIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'canary|redact|privacy.manifest' lib scripts commands hooks ui/shell/server agents skills --include=*.cjs --include=*.ts --include=*.md --include=*.sh | head -30
# 03 g_share
grep -nIiE 'canary|redact|strip|sanitiz|receipt|manifest|removed' commands/export.md commands/publish.md commands/snapshot.md | cut -c1-170 | head; echo; grep -nIiE 'canary|redact' lib/core/mva-deck-builder.cjs lib/hmi/brain-review-packet.cjs | cut -c1-170 | head -8
