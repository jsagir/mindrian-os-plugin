# 01 grep
grep -rnIiE 'checkpoint|session limit|context_pct|resume command|--resume' lib hooks scripts commands --include=*.cjs --include=*.js --include=*.json --include=*.md --include=*.sh --include=*.ts -l | head -60
# 02 context_pct
grep -rnI --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'context_pct' lib hooks scripts commands
# 03 resume
grep -rnIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'resume (command|id|token)|checkpoint_id|checkpointId|resume_command|/mos:resume|--resume' lib hooks scripts commands | head -40
# 04 ckcounts
for p in checkpoint_id checkpointId resume_command pending_operation_ids; do echo "$p: $(grep -rnIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next "$p" lib hooks scripts commands agents skills | wc -l)"; done
# 06 g_hooks
grep -nE 'PreCompact|SessionEnd|Stop|PostCompact|SessionStart' hooks/hooks.json | head -20; sed -n 1,30p scripts/restore-post-compact-context.cjs | head -30; grep -n 'checkpoint\|resume' scripts/context-monitor | head
