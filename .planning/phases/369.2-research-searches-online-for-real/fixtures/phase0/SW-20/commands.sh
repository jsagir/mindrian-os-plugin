# 3.12 control, 3.9 shim, and no-python3 (Windows stand-in). Registry built with 3.12 first (rooms a,b; active b).
R=/home/jsagi/dev/MindrianOS-Plugin; NODE=$(command -v node)
TB=$(mktemp -d /tmp/phase0-bin-XXXX); ln -s /home/jsagi/.local/bin/python3.9 $TB/python3
NP=$(mktemp -d /tmp/phase0-nopy-XXXX); for f in /usr/bin/*; do case $(basename $f) in python*|pydoc*) ;; *) ln -s $f $NP/ ;; esac; done; ln -sf $NODE $NP/node
for MODE in 312 39 nopy; do
  export HOME=$(mktemp -d /tmp/phase0-home-XXXX); export MINDRIAN_ROOMS_HOME=$HOME/MindrianRooms; mkdir -p $MINDRIAN_ROOMS_HOME/a $MINDRIAN_ROOMS_HOME/b
  bash $R/scripts/room-registry create a $MINDRIAN_ROOMS_HOME/a A idea; bash $R/scripts/room-registry create b $MINDRIAN_ROOMS_HOME/b B idea   # python3.12 (PATH default)
  case $MODE in 312) P=$PATH;; 39) P=$TB:$PATH;; nopy) P=$NP;; esac
  env PATH=$P HOME=$HOME MINDRIAN_ROOMS_HOME=$MINDRIAN_ROOMS_HOME node fixtures/phase0/SW-20/run.cjs
done
