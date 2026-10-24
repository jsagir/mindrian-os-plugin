#!/bin/bash
S=$S
export PLAYWRIGHT_BROWSERS_PATH=/home/jsagi/.cache/ms-playwright
cd /home/jsagi/dev/MindrianOS-Plugin-release && echo "load $(cut -d' ' -f1-3 /proc/loadavg)" && node ui/mos-face/scripts/capture-shots.cjs --plugin $S/subject --out $S/raw-band --session-home --scenarios wide,std,narrow,nocolor,small,chip
cd $S && bash runall.sh pane-wide pane-std pane-narrow pane-nocolor pane-small tree-inline-60 tree-small tree-big tree-toosmall sent-denied sent-answered job-hint explore-list installed-wide
echo ALLDONE
