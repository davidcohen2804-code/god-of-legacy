import json, numpy as np, sys
from PIL import Image
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); HM=json.load(open('headmatch.json'))
layer=Image.open(sys.argv[1]).convert('RGBA'); key=sys.argv[2]; out=sys.argv[3]
idle_m=np.array(Image.open(G+'public/assets/final/body/warrior/movement/idle_m.png'))[...,0]
# template rect per view (same as headmatch)
from scipy import ndimage as nd
idle=np.array(Image.open(G+'public/assets/final/body/warrior/movement/idle.png').convert('RGBA')).astype(np.float32)
def skinm(c):
  R,Gc,B,A=[c[...,i] for i in range(4)]
  return (A>150)&(R>170)&(Gc>110)&(Gc<215)&(B>80)&(B<190)&(R>Gc+12)&(Gc>B+8)
TT=[]
for r in range(4):
  c=idle[r*352:(r+1)*352,0:352]; hm=idle_m[r*352:(r+1)*352,0:352]==40; sk=skinm(c); ys,xs=np.nonzero(hm|sk)
  TT.append((ys.min()-2,ys.max()+2,xs.min()-2,xs.max()+2))
name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
W=cc.get('w',352); H=cc.get('h',352)
body=Image.open(G+'public/'+key).convert('RGBA'); rows=body.height//H; cols=body.width//W
res=Image.new('RGBA',(cols*W,rows*H),(60,70,60,255))
for r in range(rows):
  y0,y1,x0,x1=TT[r]; th,tw=y1-y0,x1-x0
  L=layer.crop((0,r*352,352,(r+1)*352))
  for k in range(cols):
    cell=body.crop((k*W,r*H,(k+1)*W,(r+1)*H)); bg=Image.new('RGBA',(W,H),(60,70,60,255)); bg.alpha_composite(cell)
    t=HM[key][r][k] if r<len(HM[key]) and k<len(HM[key][r]) else None
    if t:
      e,ang,dx,dy=t
      big=Image.new('RGBA',(W+400,H+400)); big.alpha_composite(L,(200,200))
      big=big.rotate(ang,resample=Image.BICUBIC,center=(200+x0+tw/2,200+y0+th*0.6))
      bg.alpha_composite(big,(dx-200,dy-200)) if dx-200>=0 else bg.paste(big,(dx-200,dy-200),big)
    res.paste(bg,(k*W,r*H))
res.convert('RGB').save(out)
