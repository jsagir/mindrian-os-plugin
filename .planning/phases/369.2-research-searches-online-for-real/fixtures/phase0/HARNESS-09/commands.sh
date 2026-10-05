cd /home/jsagi/dev/MindrianOS-Plugin
node -e "const f=require('./lib/core/research-planner/families.cjs');const ids=Object.keys(f.FAMILIES);console.log('families',ids.length);ids.forEach(i=>console.log(' ',i,'templates',f.FAMILIES[i].templates.length,f.FAMILIES[i].templates.map(t=>t.id+':'+t.role).join(' ')));console.log('total templates',ids.reduce((n,i)=>n+f.FAMILIES[i].templates.length,0))"
echo "practice|instrument|mechanism|adjacent hits in families.cjs: $(grep -inE 'practice|instrument|mechanism|adjacent' lib/core/research-planner/families.cjs | wc -l)"
grep -inE 'practice|instrument|mechanism|adjacent|synonym' lib/core/research-planner/families.cjs | head
echo "same four words across research-planner dir:"; grep -rniE 'practice name|instrument|adjacent.domain|mechanism language' lib/core/research-planner | cut -c1-160 | head
