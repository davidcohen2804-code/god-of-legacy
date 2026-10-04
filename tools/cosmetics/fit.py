# tilt + position per frame by fitting the idle hair mask (same view) to the frame's hair mask (rotation search, IoU)
import json, numpy as np, os
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); B=json.load(open(G+'src/data/blade-lines.json'))
OV=json.load(open('tilt_override.json')) if os.path.exists('tilt_override.json') else {}
def main(m):
  lab,n=nd.label(nd.binary_dilation(m,iterations=2))
  if n==0: return m
  sz=nd.sum(m,lab,range(1,n+1)); return (lab==1+int(np.argmax(sz)))&m
idle=np.array(Image.open(G+'public/assets/final/body/warrior/movement/idle_hair.png'))[...,3]>0
T=[]
for r in range(4):
  m=main(idle[r*352:(r+1)*352,0:352]); ys,xs=np.nonzero(m)
  cy,cx=ys.mean(),xs.mean(); top=ys.min(); ccx=(np.percentile(xs,2)+np.percentile(xs,98))/2
  T.append(dict(m=m,cy=cy,cx=cx,top_off=top-cy,ccx_off=ccx-cx))
def rot(m,ang,cy,cx):
  im=Image.fromarray((m*255).astype(np.uint8)); return np.array(im.rotate(ang,center=(cx,cy),resample=Image.BILINEAR))>127
def fitone(m,t,H,W):
  ys,xs=np.nonzero(m); cy,cx=ys.mean(),xs.mean()
  tm=np.zeros((H,W),bool); dy,dx=int(round(cy-t['cy'])),int(round(cx-t['cx']))
  ys2,xs2=np.nonzero(t['m']); ys2=ys2+dy; xs2=xs2+dx; ok=(ys2>=0)&(ys2<H)&(xs2>=0)&(xs2<W); tm[ys2[ok],xs2[ok]]=True
  best=(-1,0)
  for ang in range(-70,71,10):
    rm=rot(tm,ang,cy,cx); iou=(rm&m).sum()/max(1,(rm|m).sum())
    if iou>best[0]: best=(iou,ang)
  if best[0]<0.4:
    for ang in list(range(-130,-70,10))+list(range(80,131,10)):
      rm=rot(tm,ang,cy,cx); iou=(rm&m).sum()/max(1,(rm|m).sum())
      if iou>best[0]+0.05: best=(iou,ang)
  return (best[0],best[1],cy,cx)
out={}
for key in B:
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); H=cc.get('h',352); fx0=W//2; fy0=310+H-352
  hm=np.array(Image.open(G+'public/'+key[:-4]+'_hair.png'))[...,3]>0
  body=np.array(Image.open(G+'public/'+key).convert('RGBA')).astype(int)
  R_,G_,B_,A_=[body[...,i] for i in range(4)]
  loose=(A_>150)&(R_>55)&(R_<200)&(G_>25)&(G_<120)&(B_<85)&(R_>G_*1.3)&(G_>B_*1.05)&~((G_<R_*0.42)&(B_<R_*0.42))
  rows=[]
  for r in range(hm.shape[0]//H):
    row=[]; t=T[r]
    for k in range(hm.shape[1]//W):
      cands=[main(hm[r*H:(r+1)*H,k*W:(k+1)*W])]
      lo=loose[r*H:(r+1)*H,k*W:(k+1)*W]
      lab,n=nd.label(nd.binary_closing(lo,iterations=2))
      if n:
        sz=nd.sum(lo,lab,range(1,n+1))
        for i in np.argsort(-sz)[:3]: cands.append((lab==i+1)&lo)
      res=None
      for m in cands:
        if m.sum()<120: continue
        rr=fitone(m,t,H,W)
        if res is None or rr[0]>res[0]: res=rr+(m,)
      if res is None: row.append(None); continue
      iou,ang,cy,cx,m=res
      fk=f'{key}|{r}|{k}'
      if fk in OV: ang=OV[fk]
      # crown point = template crown offset rotated by ang (PIL rotate: CCW positive, y down)
      a=np.radians(ang); ox,oy=t['ccx_off'],t['top_off']
      px=cx+ox*np.cos(a)+oy*np.sin(a); py=cy-ox*np.sin(a)+oy*np.cos(a)
      row.append([round(float(px-fx0),1),round(float(py-fy0),1),float(-ang),round(float(iou),2)])
    rows.append(row)
  out[key]=rows
json.dump(out,open(G+'src/data/head-frames.json','w'),separators=(',',':'))
low=[(k.split('/')[-2],r,c,x[3],x[2]) for k,v in out.items() for r,row in enumerate(v) for c,x in enumerate(row) if x and x[3]<0.45]
print(len(low)); print(low[:40])
