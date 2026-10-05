# bake.py idle_layer.png item_id  -> per-sheet worn layers for every warrior sheet
import json, numpy as np, sys, os
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); HM=json.load(open('/tmp/claude-0/cos/headmatch.json')); F=json.load(open(G+'src/data/head-frames.json'))
layer=Image.open(sys.argv[1]).convert('RGBA'); iid=sys.argv[2]
outdir=G+f'public/assets/final/cosmetics/warrior/{iid}/layers'; os.makedirs(outdir,exist_ok=True)
idle=np.array(Image.open(G+'public/assets/final/body/warrior/movement/idle.png').convert('RGBA')).astype(np.float32)
idle_m=np.array(Image.open(G+'public/assets/final/body/warrior/movement/idle_m.png'))[...,0]
def skinm(c):
  R,Gc,B,A=[c[...,i] for i in range(4)]
  return (A>150)&(R>170)&(Gc>110)&(Gc<215)&(B>80)&(B<190)&(R>Gc+12)&(Gc>B+8)
TT=[]
for r in range(4):
  c=idle[r*352:(r+1)*352,0:352]; hm=idle_m[r*352:(r+1)*352,0:352]==40; sk=skinm(c); ys,xs=np.nonzero(hm|sk)
  TT.append((ys.min()-2,ys.max()+2,xs.min()-2,xs.max()+2))
IF=F['assets/final/body/warrior/movement/idle.png']
for key in HM:
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); H=cc.get('h',352); fx0=W//2; fy0=310+H-352
  pm=np.array(Image.open(G+'public/'+key[:-4]+'_m.png'))[...,0]
  rows=len(HM[key]); cols=len(HM[key][0]); out=Image.new('RGBA',(cols*W,rows*H))
  for r in range(rows):
    y0,y1,x0,x1=TT[r]; th,tw=y1-y0,x1-x0; L=layer.crop((0,r*352,352,(r+1)*352))
    good=[k for k in range(cols) if HM[key][r][k]]
    for k in range(cols):
      t=HM[key][r][k]
      if not t:
        h=F[key][r][k] if r<len(F[key]) and k<len(F[key][r]) else None
        if not h: continue
        ih=IF[r][0] or [2.7,-188.0]; t=[0,0,int(round((fx0+h[0])-(176+ih[0]))),int(round((fy0+h[1])-(310+ih[1])))]
      e,ang,dx,dy=t
      big=Image.new('RGBA',(W+800,H+800)); big.alpha_composite(L,(400,400))
      if ang: big=big.rotate(ang,resample=Image.NEAREST,center=(400+x0+tw/2,400+y0+th*0.6))
      cell=big.crop((400-dx,400-dy,400-dx+W,400-dy+H))
      a=np.array(cell); mag=(a[...,0]==255)&(a[...,1]==0)&(a[...,2]==255)&(a[...,3]>0)
      hair=pm[r*H:(r+1)*H,k*W:(k+1)*W]==40
      a[mag&~hair]=0          # only hide this frame's own hair under the piece
      out.paste(Image.fromarray(a),(k*W,r*H))
  sn=name if name else key.split('/')[-1][:-4]
  out.save(f'{outdir}/{sn}.png',optimize=True)
print('ok',iid)
