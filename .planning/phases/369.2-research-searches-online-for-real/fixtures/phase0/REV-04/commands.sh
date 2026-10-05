# read-only searches for the run ids
for id in 32664e65 3f4b1d0a; do echo "== $id under ~/MindrianRooms (file names)"; find /home/jsagi/MindrianRooms -iname "*$id*" 2>/dev/null | head; echo "== $id under ~/.mindrian (file names)"; find /home/jsagi/.mindrian -iname "*$id*" 2>/dev/null | head; done
echo "== research-runs dirs anywhere under MindrianRooms"; find /home/jsagi/MindrianRooms -type d -name research-runs 2>/dev/null | head
echo "== content grep for ids (files list, -l, no content printed)"; grep -rIl --exclude-dir=node_modules --exclude-dir=.git -e 32664e65 -e 3f4b1d0a /home/jsagi/MindrianRooms /home/jsagi/.mindrian 2>/dev/null | head
echo "== ids in the repo planning tree (-l)"; grep -rIl -e 32664e65 -e 3f4b1d0a /home/jsagi/dev/MindrianOS-Plugin/.planning 2>/dev/null | head
