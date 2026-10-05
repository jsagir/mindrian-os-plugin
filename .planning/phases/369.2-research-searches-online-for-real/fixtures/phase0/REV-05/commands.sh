export HOME=$(mktemp -d /tmp/phase0-home-XXXX); D=$HOME/bare; mkdir -p $D; node --version
node -e "const m=require('/home/jsagi/dev/MindrianOS-Plugin/lib/core/room-db.cjs');const fs=require('fs');try{const db=m.openRoomDb('$D',{create:true});console.log('opened ok; exists=',fs.existsSync('$D/.mindrian/room.db'));console.log(JSON.stringify(db.prepare(\"select count(*) c from nodes\").get()));m.closeRoomDb(db)}catch(e){console.log('THROW',e.code,e.message)}"
# supported-path reproduction: see SW-01/ (birthRoom, autoCreatePlaceholderRoom) - no ERR_SQLITE_ERROR in outputs
grep -n 'ERR_SQLITE' ../SW-01/0-312-*.out ../SW-01/0-39-*.out || echo "no ERR_SQLITE in supported-path outputs"
