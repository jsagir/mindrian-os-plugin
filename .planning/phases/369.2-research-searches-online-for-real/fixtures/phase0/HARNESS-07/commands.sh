# 01 g_caps
grep -rnIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'max_?concurren|concurrency|maxParallel|max_parallel|per.lane|lane.budget|token.budget|reserved|admission|max_agents|maxAgents|fan.?out' commands/act.md commands/act-swarm.md lib/core/chain-executor.cjs lib/workflow pipelines 2>/dev/null | head -80
# 02 g_cap
grep -rnE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'resolveFanoutCap|MAX_CONCURRENT_SUBAGENTS|FANOUT_CEIL|fanout_cap' lib commands scripts agents | head -40
# 03 g_planner
grep -rnIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'counterevidence|reserved|reserve|budget|maxLeaves|max_leaves|cap\b|stop_reason' lib/core/research-planner/deep.cjs lib/core/research-planner/planner.cjs lib/core/research-planner/plan.cjs | head -40; echo; grep -rcIiE 'budget|reserve' lib/core/research-planner/*.cjs
# 04 g_counts
echo cap-hits $(grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'resolveFanoutCap|FUTURES_FANOUT_CAP|MAX_CONCURRENT_SUBAGENTS' lib commands | wc -l); echo reserve-hits $(grep -rnIiE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'reserved_(synthesis|counterevidence)|reserve.*(synthesis|counterevidence)|admission' lib commands agents | wc -l)
