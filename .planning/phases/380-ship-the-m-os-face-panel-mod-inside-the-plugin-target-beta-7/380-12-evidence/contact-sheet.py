import json, re, math, sys
from PIL import Image, ImageDraw
grids=json.load(open('grids.json'))
fx=open('/home/jsagi/dev/MindrianOS-Plugin-release/ui/mos-face/tests/face-fixture.ts').read()
canon=json.loads(re.search(r'export const CANON[^=]*= (\{.*\})\n', fx, re.S).group(1))
S=160
def num(a,k,d=0): return float(a.get(k,d))
def canon_img(recs):
    img=Image.new('RGB',(400,400),'white'); d=ImageDraw.Draw(img)
    tr=None
    for r in recs:
        a=r['attrs']; p=r['part']
        if p=='bar': 
            m=re.match(r'translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)',a['transform']); tr=tuple(map(float,m.groups())); continue
        x,y,w,h=num(a,'x'),num(a,'y'),num(a,'width'),num(a,'height')
        fill=a.get('fill'); st=a.get('stroke'); sw=num(a,'stroke-width')
        if p=='barRect':
            tx,ty,deg=tr; rad=math.radians(deg)
            pts=[(x,y),(x+w,y),(x+w,y+h),(x,y+h)]
            pts=[(tx+px*math.cos(rad)-py*math.sin(rad), ty+px*math.sin(rad)+py*math.cos(rad)) for px,py in pts]
            d.polygon(pts, fill=fill, outline=st if sw else None, width=int(sw)); continue
        if p=='frame':
            d.rectangle([x-sw/2,y-sw/2,x+w+sw/2-1,y+h+sw/2-1],outline=st,width=int(sw)); continue
        d.rectangle([x,y,x+w-1,y+h-1],fill=fill,outline=st if sw else None,width=int(sw))
    return img.resize((S,S),Image.LANCZOS)
ids=[g['id'] for g in grids['12']]
sizes=['6','8','12','16']
W=S*len(ids)+10*(len(ids)+1); H=(S+10)*(1+len(sizes))+10
sheet=Image.new('RGB',(W,H),(200,200,200))
for i,id in enumerate(ids):
    sheet.paste(canon_img(canon[id]),(10+i*(S+10),10))
    for j,n in enumerate(sizes):
        g=[x for x in grids[n] if x['id']==id][0]['grid']
        im=Image.new('RGB',(int(n),int(n)))
        for r,row in enumerate(g):
            for c,hx in enumerate(row): im.putpixel((c,r),tuple(int(hx[k:k+2],16) for k in (1,3,5)))
        sheet.paste(im.resize((S,S),Image.NEAREST),(10+i*(S+10),10+(j+1)*(S+10)))
sheet.save(sys.argv[1])
