cd /home/jsagi/dev/MindrianOS-Plugin
git rev-parse --short HEAD; node lib/core/repo-version.cjs
node -e "const d=require('./lib/lens-engine/source-lens-driver.cjs');console.log(JSON.stringify(d._internal.LENS_TO_SOURCE));console.log('patent=',d._internal.LENS_TO_SOURCE.patent)"
grep -n "patent" skills/research/SKILL.md | head -20
