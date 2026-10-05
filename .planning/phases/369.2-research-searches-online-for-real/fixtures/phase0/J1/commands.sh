M=/home/jsagi/dev/mindrian-marketplace/plugins/mos-desktop; P=/home/jsagi/dev/MindrianOS-Plugin
git -C /home/jsagi/dev/mindrian-marketplace log --oneline -1
git -C /home/jsagi/dev/mindrian-marketplace status --short | head -5
ls $M | head -30
for D in $M $P/lib/ui-shell/dist; do
  echo "== $D"
  echo -n "all paths: "; find $D -not -path '*/.git/*' | wc -l
  echo -n "paths with char outside [A-Za-z0-9._/-]: "; find $D -not -path '*/.git/*' | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | wc -l
  echo -n "  bracket names ([ or ]): "; find $D -not -path '*/.git/*' | LC_ALL=C grep -E '[][]' | wc -l
  echo -n "  @ names: "; find $D -not -path '*/.git/*' | LC_ALL=C grep -E '@' | wc -l
  echo -n "  other outside-set (neither bracket nor @): "; find $D -not -path '*/.git/*' | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | LC_ALL=C grep -vE '[][@]' | wc -l
done
echo "== Desktop copy: outside lib/ui-shell/dist"
echo -n "bad paths outside: "; find $M -not -path '*/.git/*' -not -path "$M/lib/ui-shell/dist*" | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | wc -l
echo -n "files under Desktop copy lib/ui-shell/dist: "; find $M/lib/ui-shell/dist -type f 2>/dev/null | wc -l
echo -n "bad paths in plugin repo outside lib/ui-shell/dist (git-tracked): "; git -C $P ls-files | grep -v '^lib/ui-shell/dist' | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | wc -l
echo -n "bad paths in plugin repo inside lib/ui-shell/dist (git-tracked): "; git -C $P ls-files lib/ui-shell/dist | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | wc -l
# --- 02 detail
M=/home/jsagi/dev/mindrian-marketplace/plugins/mos-desktop
echo -n "Desktop copy bad paths, files only: "; find $M -type f | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | wc -l
echo -n "Desktop copy bad paths, dirs only: "; find $M -type d | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | wc -l
echo -n "paths with both bracket and @: "; find $M | LC_ALL=C grep -E '@' | LC_ALL=C grep -E '[][]' | wc -l
echo "plugin repo tracked bad paths outside dist:"; git -C /home/jsagi/dev/MindrianOS-Plugin ls-files | grep -v '^lib/ui-shell/dist' | LC_ALL=C grep -E '[^A-Za-z0-9._/-]'
echo "plugin dist: files only:"; find /home/jsagi/dev/MindrianOS-Plugin/lib/ui-shell/dist -type f | wc -l
# --- 03 exclusion search
cd /home/jsagi/dev/MindrianOS-Plugin
grep -n 'ui-shell' scripts/release-lib/build-desktop-artifact.cjs scripts/release-lib/desktop-copy-gate.sh scripts/release.sh package.json .npmignore 2>&1
grep -n '"!lib/ui-shell' package.json || echo "no '!lib/ui-shell' exclusion in package.json files"
sed -n 260,272p scripts/release-lib/desktop-copy-gate.sh
git -C /home/jsagi/dev/mindrian-marketplace log --oneline -1
git -C /home/jsagi/dev/mindrian-marketplace ls-files plugins/mos-desktop/lib/ui-shell/dist | wc -l
git -C /home/jsagi/dev/mindrian-marketplace ls-files plugins/mos-desktop | wc -l
git -C /home/jsagi/dev/mindrian-marketplace ls-files plugins/mos-desktop | LC_ALL=C grep -E '[^A-Za-z0-9._/-]' | wc -l
git -C /home/jsagi/dev/mindrian-marketplace remote -v | head -2
