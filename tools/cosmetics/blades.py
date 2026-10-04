# per-frame blade line (hilt -> tip) relative to the feet anchor, from the *_weapon.png blade masks (warrior sheets)
import json, glob, numpy as np
from PIL import Image
from scipy import ndimage as nd
import sys; sys.path.insert(0,'/tmp/claude-0/clean')
from wmask import hsv
P='/home/claude/god-of-legacy/public/'
cells=json.load(open('/home/claude/god-of-legacy/src/data/body-cells.json'))
out={}
for f in sorted(glob.glob(P+'assets/final/body/warrior/movement/*.png')+glob.glob(P+'assets/final/skills/warrior/*/body.png')):
  if f.endswith('_weapon.png'): continue
  wf=f[:-4]+'_weapon.png'
  try: w=np.array(Image.open(wf))[...,3]>0; full=np.array(Image.open(f).convert('RGBA')); b=full[...,3]>100
  except FileNotFoundError: continue
  key=f[len(P):]; c=cells.get(key.split('/')[-2],{}) if '/skills/' in key else {}
  W=c.get('w',352); H=c.get('h',352); fx=W//2; fy=310+H-352
  rows=[]
  for r in range(b.shape[0]//H):
    row=[]
    for k in range(b.shape[1]//W):
      m=w[r*H:(r+1)*H,k*W:(k+1)*W]; bb=b[r*H:(r+1)*H,k*W:(k+1)*W]
      if m.sum()<60:  # mask missed this blade: elongated bright low-saturation component straight from the art
        h_,s_,v_,al_=hsv(full[r*H:(r+1)*H,k*W:(k+1)*W]); cand=(al_>0.5)&(v_>0.55)&(s_<0.25)
        lab,n=nd.label(cand); m=np.zeros_like(cand)
        for i in range(1,n+1):
          ys,xs=np.nonzero(lab==i)
          if len(xs)<40: continue
          ev=np.linalg.eigvalsh(np.cov(np.vstack([xs,ys]).astype(float)))
          if ev[1]>12*max(ev[0],1e-3) and np.sqrt(ev[1])>12: m|=lab==i
      lab,n=nd.label(nd.binary_dilation(m,iterations=2))
      if n==0: row.append(None); continue
      sz=nd.sum(m,lab,range(1,n+1)); comp=(lab==1+int(np.argmax(sz)))&m
      ys,xs=np.nonzero(comp)
      if len(xs)<60: row.append(None); continue
      P2=np.vstack([xs,ys]).astype(float); mu=P2.mean(1,keepdims=True); ev,evec=np.linalg.eigh(np.cov(P2-mu)); d=evec[:,1]
      t=d@(P2-mu); a=mu[:,0]+d*t.min(); z=mu[:,0]+d*t.max()
      if t.max()-t.min()<(60 if r in (1,2) else 34): row.append(None); continue
      by,bx=np.nonzero(bb&~m); cb=np.array([bx.mean(),by.mean()])
      if np.linalg.norm(a-cb)>np.linalg.norm(z-cb): a,z=z,a   # hilt = end nearer the body
      row.append([round(float(a[0]-fx),1),round(float(a[1]-fy),1),round(float(z[0]-fx),1),round(float(z[1]-fy),1)])
    idx=[i for i,x in enumerate(row) if x]
    if idx: row=[x if x else row[min(idx,key=lambda j:abs(j-i))] for i,x in enumerate(row)]
    rows.append(row)
  out[key]=rows
FIX=json.load(open('/tmp/claude-0/clean/blade_fix.json'))  # hand-verified per-frame corrections (None = sword not visible)
for fk,v in FIX.items():
  k,r,c=fk.split('|'); r=int(r); c=int(c)
  if k in out and r<len(out[k]) and c<len(out[k][r]): out[k][r][c]=v
json.dump(out,open('/home/claude/god-of-legacy/src/data/blade-lines.json','w'),separators=(',',':'))
print(len(out), sum(1 for v in out.values() for r in v for x in r if x))
