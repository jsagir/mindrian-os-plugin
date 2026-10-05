# 01 g_basket
grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'basket|F\.8|filing.*(card|gate)' lib/core/research-planner lib/hmi lib/workflow lib/mcp/tools --include=*.cjs -l | head -20; echo; grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'preview|destination|consequence|default' lib/core/research-planner/filing*.cjs lib/core/research-planner/basket*.cjs 2>/dev/null | cut -c1-170 | head -30
# 02 g_render
grep -rnIE --exclude-dir=dist --exclude-dir=node_modules --exclude-dir=.next 'buildBasket|default_on' lib scripts --include=*.cjs | grep -v 'test' | cut -c1-190 | head -20
