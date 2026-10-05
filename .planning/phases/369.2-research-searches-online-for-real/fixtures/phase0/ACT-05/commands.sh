cd /home/jsagi/dev/MindrianOS-Plugin
for c in 6d789ed8a affafb368 7b83bfb26 ad5991618; do git merge-base --is-ancestor $c HEAD && echo "$c ancestor of HEAD"; done
echo "-- entity decode / correction window tokens in evidence-rows.cjs and deep.cjs (count)"; grep -c -E "&lt;|&amp;|decodeEntities|unescape" lib/core/research-planner/evidence-rows.cjs lib/core/research-planner/deep.cjs
echo "-- git log -S for tokens"; for t in "&lt;" decodeEntities lane_already_closed unused_slot provider_unavailable:patent; do echo "[$t]"; git log -S"$t" --oneline -- lib/core/research-planner scripts/research-planner.cjs lib/lens-engine | head -3; done
echo "-- v16 touched files"; git show --stat --oneline affafb368 | head -12
