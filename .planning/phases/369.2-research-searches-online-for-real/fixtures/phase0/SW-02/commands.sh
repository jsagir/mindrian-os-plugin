# run from /home/jsagi/dev/MindrianOS-Plugin ; isolated HOME per run
TB=$(mktemp -d /tmp/phase0-bin-XXXX); ln -s /home/jsagi/.local/bin/python3.9 $TB/python3
for V in 312 39; do
  export HOME=$(mktemp -d /tmp/phase0-home-XXXX); export MINDRIAN_ROOMS_HOME=$HOME/MindrianRooms; mkdir -p $MINDRIAN_ROOMS_HOME
  if [ $V = 39 ]; then export PATH=$TB:$PATH; fi
  python3 --version
  mkdir -p $MINDRIAN_ROOMS_HOME/p0room
  bash scripts/room-registry create p0room $MINDRIAN_ROOMS_HOME/p0room "P0" idea; echo create_exit=$?
  bash scripts/room-registry set-active p0room; echo setactive_exit=$?
  bash scripts/room-registry get-active; echo getactive_exit=$?
  bash scripts/resolve-room $MINDRIAN_ROOMS_HOME/p0room; echo resolve_exit=$?
  bash scripts/on-cwd-changed $MINDRIAN_ROOMS_HOME/p0room; echo oncwd_exit=$?
done
# --- second sequence (02-): registry created under 3.12 with rooms a,b; then set-active / on-cwd-changed / resolve-room --adopt under 3.9 shim
TB=$(mktemp -d /tmp/phase0-bin-XXXX); ln -s /home/jsagi/.local/bin/python3.9 $TB/python3
export HOME=$(mktemp -d /tmp/phase0-home-XXXX); export MINDRIAN_ROOMS_HOME=$HOME/MindrianRooms; mkdir -p $MINDRIAN_ROOMS_HOME/a $MINDRIAN_ROOMS_HOME/b
bash scripts/room-registry create a $MINDRIAN_ROOMS_HOME/a A idea; bash scripts/room-registry create b $MINDRIAN_ROOMS_HOME/b B idea   # python3.12
cp $MINDRIAN_ROOMS_HOME/.rooms/registry.json /tmp/reg.before
export PATH=$TB:$PATH ; python3 --version
bash scripts/room-registry set-active a ; echo exit=$?
bash scripts/on-cwd-changed $MINDRIAN_ROOMS_HOME/a ; echo exit=$?   # expects registry unchanged
diff registry before/after
# adopt leg: legacy room/ dir, no registry
W=$(mktemp -d /tmp/phase0-ws-XXXX); mkdir $W/room; MINDRIAN_ROOMS_HOME=$W/none bash scripts/resolve-room $W --adopt
# --- 03: adopt control under 3.12 and under 3.9, bash -x trace tail
W=$(mktemp -d /tmp/phase0-ws-XXXX); mkdir $W/room; HOME=$W MINDRIAN_ROOMS_HOME=$W/none bash scripts/resolve-room $W --adopt   # 3.12
W=$(mktemp -d /tmp/phase0-ws-XXXX); mkdir $W/room; PATH=$TB:$PATH HOME=$W MINDRIAN_ROOMS_HOME=$W/none bash scripts/resolve-room $W --adopt   # 3.9
