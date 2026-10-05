# crown point per frame = top of the head's hair (the hair component touching the face), tilt from the template fit when reliable
import json, numpy as np
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); F=json.load(open(G+'src/data/head-frames.json')); HD=json.load(open('heads.json'))
REF=[r[0][5] for r in HD['assets/final/body/warrior/movement/idle.png']]
idleF=F['assets/final/body/warrior/movement/idle.png']
for key in F:
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); H=cc.get('h',352); fx0=W//2; fy0=310+H-352
  a=np.array(Image.open(G+'public/'+key).convert('RGBA')).astype(int); pm=np.array(Image.open(G+'public/'+key[:-4]+'_m.png'))[...,0]
  R,Gc,Bc,A=[a[...,i] for i in range(4)]
  skin=(A>150)&(R>170)&(Gc>110)&(Gc<215)&(Bc>80)&(Bc<190)&(R>Gc+12)&(Gc>Bc+8)
  for r,row in enumerate(F[key]):
    for k,h in enumerate(row):
      if not h: continue
      sl=(slice(r*H,(r+1)*H),slice(k*W,(k+1)*W)); hm=pm[sl]==40; sk=skin[sl]
      lab,n=nd.label(nd.binary_dilation(hm,iterations=2))
      if n==0: continue
      sl_,sn=nd.label(sk)
      if sn: ss=nd.sum(sk,sl_,range(1,sn+1)); face=sl_==1+int(np.argmax(ss))
      else: face=sk
      near=nd.binary_dilation(face,iterations=5); best=None
      for i in range(1,n+1):
        c=(lab==i)&hm; s=c.sum()
        if s<60: continue
        if not (c&near).any(): continue
        score=s
        if best is None or score>best[0]: best=(score,c)
      if best is None:
        if sk.sum()>20: row[k]=None
        continue
      c=best[1]; ys,xs=np.nonzero(c); top=ys.min(); band=c[top:top+6]; bx=np.nonzero(band.any(0))[0]
      cx=(np.percentile(xs,5)+np.percentile(xs,95))/2
      tilt=h[2] if h[3]>=0.45 else 0.0
      if h[3]<0.45 and r in (1,2):
        d=HD[key][r][k]
        if d and d[5] is not None: tilt=float(np.clip(-(d[5]-REF[r]),-40,40)) if abs(d[5]-REF[r])>10 else 0.0
      # crown = top centre of the hair, measured like the idle template (centre of the hair's width at its top)
      h[0]=round(float(cx-fx0),1); h[1]=round(float(top-fy0),1); h[2]=tilt
for key in F:
  for row in F[key]:
    idx=[i for i,h in enumerate(row) if h]
    if not idx: continue
    for i,h in enumerate(row):
      if h is None: row[i]=list(row[min(idx,key=lambda j:abs(j-i))])  # missed frame: nearest good frame of the same move
json.dump(F,open(G+'src/data/head-frames.json','w'),separators=(',',':'))
print(F['assets/final/skills/warrior/blade_storm/body.png'][1][3:6], F['assets/final/skills/warrior/rising_slash/body.png'][1][2:5])
print('idle',F['assets/final/body/warrior/movement/idle.png'][1][0], idleF[1][0])
