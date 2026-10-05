cd /home/jsagi/dev/MindrianOS-Plugin
B=lib/core/brain-client.cjs
echo "== MINDRIAN_BRAIN_KEY"; grep -n 'MINDRIAN_BRAIN_KEY' $B
echo "== Authorization / Bearer"; grep -nE "Authorization|Bearer" $B
echo "== no_key"; grep -n "no_key" $B
echo "== Tier 0"; grep -nE "Tier 0|tier 0|tier0|TIER_0" $B
echo "== counts"; for p in 'MINDRIAN_BRAIN_KEY' 'Authorization|Bearer' 'no_key' 'Tier 0|tier 0|tier0|TIER_0'; do echo -n "$p: "; grep -cE "$p" $B; done
echo -n "distinct lines matching any: "; grep -nE 'MINDRIAN_BRAIN_KEY|Authorization|Bearer|no_key|Tier 0|tier 0|tier0|TIER_0' $B | wc -l
# --- 02 key-gate call sites (reads that feed the gate) and the resolver
echo "== getApiKey( / isAvailable( / ensureAvailable( / resolveBrainKey( sites in brain-client"; grep -nE 'getApiKey\(|isAvailable\(|ensureAvailable\(|resolveBrainKey\(' lib/core/brain-client.cjs
echo -n "count: "; grep -cE 'getApiKey\(|isAvailable\(|ensureAvailable\(|resolveBrainKey\(' lib/core/brain-client.cjs
echo "== resolve-brain-key.cjs key sites"; grep -nE 'MINDRIAN_BRAIN_KEY|mindrian.env|no_key|not_found' lib/core/resolve-brain-key.cjs | head -20
echo "== refusal returned when no key"; grep -nE "reason: *'(no_key|brain_unavailable)|'no_key'|no_key" lib/core/refusal-messaging.cjs | head
# --- 03 no-key probes (isolated HOME, no ~/.mindrian.env, MINDRIAN_BRAIN_KEY unset, neutral cwd /tmp so repo .env is not read)
F=/home/jsagi/dev/MindrianOS-Plugin/.planning/phases/369.2-research-searches-online-for-real/fixtures/phase0
H=$(mktemp -d /tmp/phase0-home-XXXX)
(cd /tmp && env -u MINDRIAN_BRAIN_KEY MINDRIAN_DISABLE_AUTO_REGISTER=1 HOME=$H node $F/J2/keyprobe.cjs)   # 03a: registration disabled, zero network to /register
H=$(mktemp -d /tmp/phase0-home-XXXX)
(cd /tmp && env -u MINDRIAN_BRAIN_KEY HOME=$H node $F/J2/keyprobe.cjs)   # 03b: product default (one silent POST /register with a random install UUID only)
# --- 04 Theo bare
U=https://theo-mcp.onrender.com/mcp
H1='Content-Type: application/json'; H2='Accept: application/json, text/event-stream'
curl -sS -m 60 -D - -o /tmp/p0-nokey.body -X POST $U -H "$H1" -H "$H2" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
curl -sS -m 60 -D - -o /tmp/p0-bad.body -X POST $U -H "$H1" -H "$H2" -H 'Authorization: Bearer invalid' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# --- 05 tool counts (parse the SSE data line of each saved body)
for f in nokey badkey; do echo -n "$f tools: "; sed -n 's/^data: //p' $f.body | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.result.tools.length)})"; done
# --- 06 doctor / pws-brain-mcp
cd /home/jsagi/dev/MindrianOS-Plugin
grep -n 'pws-brain-mcp' scripts/doctor.cjs
grep -rn 'pws-brain-mcp' lib scripts hooks bin --include=*.cjs --include=*.js --include=*.sh --include=*.json 2>/dev/null | grep -v '/test' | grep -v node_modules | head -30
python3 -c "import json;d=json.load(open('/home/jsagi/.claude.json'));print('top-level mcpServers has pws-brain-mcp:','pws-brain-mcp' in (d.get('mcpServers') or {}))"
