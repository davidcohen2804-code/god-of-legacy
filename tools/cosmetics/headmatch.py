# For every warrior frame: match the idle head (per view) by translation + rotation; good matches can reuse an item layer drawn on idle.
import json, numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); F=json.load(open(G+'src/data/head-frames.json'))
idle=np.array(Image.open(G+'public/assets/final/body/warrior/movement/idle.png').convert('RGBA')).astype(np.float32)
im_=np.array(Image.open(G+'public/assets/final/body/warrior/movement/idle_m.png'))[...,0]
def skinm(c):
  R,Gc,B,A=[c[...,i] for i in range(4)]
  return (A>150)&(R>170)&(Gc>110)&(Gc<215)&(B>80)&(B<190)&(R>Gc+12)&(Gc>B+8)
T=[]
for r in range(4):
  c=idle[r*352:(r+1)*352,0:352]; hm=im_[r*352:(r+1)*352,0:352]==40; sk=skinm(c)
  ys,xs=np.nonzero(hm|sk); y0,y1,x0,x1=ys.min()-2,ys.max()+2,xs.min()-2,xs.max()+2
  m=(nd.binary_dilation(hm|sk,iterations=1)&(c[...,3]>150))[y0:y1,x0:x1]
  T.append(dict(img=c[y0:y1,x0:x1,:3],m=m,y0=y0,x0=x0))
def rotT(t,ang):
  if ang==0: return t['img'],t['m']
  h,w=t['m'].shape; im=Image.fromarray(np.dstack([t['img'],t['m']*255]).astype(np.uint8)).rotate(ang,resample=Image.BILINEAR,center=(w/2,h*0.6))
  a=np.array(im).astype(np.float32); return a[...,:3],a[...,3]>200
out={}
keys=sys.argv[1:] or list(F)
for key in keys:
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); H=cc.get('h',352); fx0=W//2; fy0=310+H-352
  a=np.array(Image.open(G+'public/'+key).convert('RGBA')).astype(np.float32); pm=np.array(Image.open(G+'public/'+key[:-4]+'_m.png'))[...,0]
  rows=[]
  for r in range(a.shape[0]//H):
    row=[]; t=T[r]
    for k in range(a.shape[1]//W):
      fr=a[r*H:(r+1)*H,k*W:(k+1)*W]; h=F[key][r][k] if r<len(F[key]) and k<len(F[key][r]) else None
      hm=pm[r*H:(r+1)*H,k*W:(k+1)*W]==40
      if h: cx=fx0+h[0]; cy=fy0+h[1]
      elif hm.sum()>80: ys,xs=np.nonzero(hm); cy=ys.min(); cx=(np.percentile(xs,5)+np.percentile(xs,95))/2
      else: row.append(None); continue
      best=(1e9,0,0,0)
      for ang in (0,-8,8,-16,16,-24,24):
        img,m=rotT(t,ang); th,tw=m.shape; n=m.sum()
        if n<50: continue
        ox0=int(cx-tw/2); oy0=int(cy-4)
        for dy in range(-16,17,2):
          for dx in range(-16,17,2):
            y,x=oy0+dy,ox0+dx
            if y<0 or x<0 or y+th>H or x+tw>W: continue
            reg=fr[y:y+th,x:x+tw]
            if (reg[...,3][m]<120).mean()>0.15: continue
            e=np.abs(reg[...,:3][m]-img[m]).mean()
            if e<best[0]: best=(e,ang,x,y)
      e,ang,x,y=best
      if e<1e8:
        img,m=rotT(t,ang); th,tw=m.shape
        for ddy in (-1,0,1):
          for ddx in (-1,0,1):
            yy,xx=y+ddy,x+ddx
            if yy<0 or xx<0 or yy+th>H or xx+tw>W: continue
            reg=fr[yy:yy+th,xx:xx+tw]; ee=np.abs(reg[...,:3][m]-img[m]).mean()
            if ee<e: e,x,y=ee,xx,yy
      # transform: idle template origin (x0,y0) → here (x,y), rotated by ang about template (w/2, 0.6h)
      row.append(None if e>=1e8 else [round(float(e),1),ang,int(x-t['x0']),int(y-t['y0'])])
    rows.append(row)
  out[key]=rows
import os
if os.path.exists('headmatch.json') and sys.argv[1:]:
  prev=json.load(open('headmatch.json')); prev.update(out); out_all=prev
else: out_all=out
json.dump(out_all,open('headmatch.json','w'))
for k,v in out.items():
  es=[x[0] for rr in v for x in rr if x]
  print(k.split('/')[-2] if '/skills/' in k else k.split('/')[-1], 'frames',len(es),'good(<22)',sum(e<22 for e in es),'median',round(float(np.median(es)),1) if es else None)
