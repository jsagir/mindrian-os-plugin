R=/home/jsagi/dev/MindrianOS-Plugin; TB=$(mktemp -d /tmp/phase0-bin-XXXX); ln -s /home/jsagi/.local/bin/python3.9 $TB/python3
for PY in 312 39; do for P in registry-create scaffold-skeleton auto-create birth-room; do
  export HOME=$(mktemp -d /tmp/phase0-home-XXXX); export MINDRIAN_ROOMS_HOME=$HOME/MindrianRooms; mkdir -p $MINDRIAN_ROOMS_HOME
  PP=$PATH; [ $PY = 39 ] && PP=$TB:$PATH
  env PATH=$PP HOME=$HOME MINDRIAN_ROOMS_HOME=$MINDRIAN_ROOMS_HOME node $R/.planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/SW-01/paths.cjs $P
done; done
# --- 02: after birthRoom under 3.9 and 3.12, is the room in the registry?
for PY in 312 39; do export HOME=$(mktemp -d /tmp/phase0-home-XXXX); export MINDRIAN_ROOMS_HOME=$HOME/MindrianRooms; mkdir -p $MINDRIAN_ROOMS_HOME
 PP=$PATH; [ $PY = 39 ] && PP=$TB:$PATH
 env PATH=$PP node $R/.planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/SW-01/paths.cjs birth-room
 cat $MINDRIAN_ROOMS_HOME/.rooms/registry.json 2>&1 | head -20; bash $R/scripts/room-registry list
done
