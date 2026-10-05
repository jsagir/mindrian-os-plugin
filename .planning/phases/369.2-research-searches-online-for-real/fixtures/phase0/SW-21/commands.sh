R=/home/jsagi/dev/MindrianOS-Plugin
export HOME=$(mktemp -d /tmp/phase0-home-XXXX)
ps -eo pid,args | grep -E 'mindrian-mcp|next-server|ui-shell' | grep -v grep > $HOME/ps.before
node $R/lib/ui-shell/launch.cjs status ; echo exit=$?
# start with stubbed browser opener (so no real browser opens) and non-TTY stdout (this is the captured-session shape)
timeout 150 node -e "require('$R/lib/ui-shell/launch.cjs').main(['start'],{openBrowser:async()=>false,isTTY:false}).then(c=>{console.log('main returned',c);process.exit(c)})" | cat ; echo "pipe_exit=${PIPESTATUS[0]}"
node $R/lib/ui-shell/launch.cjs status ; echo exit=$?
node $R/lib/ui-shell/launch.cjs stop ; echo exit=$?
ps -eo pid,args | grep -E 'mindrian-mcp|next-server|ui-shell' | grep -v grep > $HOME/ps.after
diff $HOME/ps.before $HOME/ps.after
