# 01 g_confirmed
grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next "review_status *= *'confirmed'|review_status='confirmed'|confirmed_claim|confirmedCount|confirmed_count|'confirmed'" lib/core/room-state* lib/core/navigation lib/core/navigation.cjs scripts/room-analysis* lib/wiki lib/export* 2>/dev/null | cut -c1-200 | head -50
# 02 g_counts
grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next "COUNT\(.*\).*review_status|review_status.*COUNT\(|GROUP BY review_status|confirmed_nodes|confirmedNodes|confirmed nodes|n_confirmed|confirmed:" lib scripts hooks ui/shell 2>/dev/null | grep -v '\.test\.' | cut -c1-220 | head -40
# 03 g_banner
echo banner-tokens: $(grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'internal_draft|working_paper|externally_shareable' lib scripts hooks commands ui agents skills references | wc -l); echo readiness-word: $(grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'readiness' lib scripts hooks commands ui agents skills | wc -l); grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'readiness' lib scripts hooks commands ui | cut -c1-160 | head -12; echo; grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'confirmed_claim_count' lib scripts ui commands | wc -l
# 04 g_sql
grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next "FROM nodes WHERE review_status|review_status *= *'confirmed'|review_status IN|WHERE review_status" lib scripts | grep -vE 'test|\.test' | cut -c1-210 | head -30
# 05 run_isolated
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); node /tmp/claude-1000/-home-jsagi/cd7fca86-da84-4084-9260-f655b86621f9/scratchpad/h11.cjs
# 06 g_stats
grep -nE 'review_status|confirmed|COUNT' lib/core/lazygraph-ops.cjs lib/core/graph-ops.cjs scripts/mindrian-tools.cjs | cut -c1-200 | head -20; grep -n 'WhitespaceZone\|whitespace_zone\|whitespace-zone' -r lib --include=*.cjs -l --exclude-dir=dist | head -5
