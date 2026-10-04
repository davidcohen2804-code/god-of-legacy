# per-sheet cut mask for sword skins: original blade mask ∪ capsule along the verified blade line (hilt → tip)
import json, numpy as np
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
B=json.load(open(G+'src/data/blade-lines.json')); cells=json.load(open(G+'src/data/body-cells.json'))
BEH={}
OV=json.load(open('/tmp/claude-0/clean/behind_override.json'))  # hand-checked: 1 behind / 0 in front
for key,rows in B.items():
  name=key.split('/')[-2] if '/skills/' in key else None; c=cells.get(name,{}) if name else {}
  W=c.get('w',352); H=c.get('h',352); fx=W//2; fy=310+H-352
  body=np.array(Image.open(G+'public/'+key).convert('RGBA')); wm=np.array(Image.open(G+'public/'+key[:-4]+'_weapon.png'))[...,3]>0
  cut=np.zeros(wm.shape,bool); yy,xx=np.mgrid[0:H,0:W]
  a=body.astype(int); R_,G_,B_=a[...,0],a[...,1],a[...,2]
  hairm=(a[...,3]>150)&(R_>90)&(R_<210)&(G_>35)&(G_<120)&(B_<80)&(R_>G_*1.35)&(G_>B_*1.1)
  beh=[]
  for r,row in enumerate(rows):
    brow=[]; beh.append(brow)
    for k,ln in enumerate(row):
      if not ln: brow.append(0); continue  # sword hidden: nothing to cut (also drop stray mask bits)
      hx,hy,tx,ty=fx+ln[0],fy+ln[1],fx+ln[2],fy+ln[3]; dx,dy=tx-hx,ty-hy; L=max(1e-3,np.hypot(dx,dy)); ux,uy=dx/L,dy/L
      t=(xx-hx)*ux+(yy-hy)*uy; d=np.abs(-(xx-hx)*uy+(yy-hy)*ux)
      cap=(t>-4)&(t<L+8)&(d<10)
      m=wm[r*H:(r+1)*H,k*W:(k+1)*W]
      hm=hairm[r*H:(r+1)*H,k*W:(k+1)*W]; onhair=(cap&hm).sum()/max(1,cap.sum())
      behind = onhair>0.06
      ov=OV.get(f'{key}|{r}|{k}')
      if ov is not None: behind = bool(ov)   # blade crosses the head: it is behind the body (only its visible original pixels are replaced)
      brow.append(1 if behind else 0)
      near=(t>-30)&(t<L+14)&(d<26)   # original mask only near the line (guard/blade), not stray bits elsewhere
      cut[r*H:(r+1)*H,k*W:(k+1)*W]=(m&near) if behind else cap|(m&near)  # back view: sword is behind the body, keep the body intact
  out=np.zeros((*cut.shape,4),np.uint8); out[...,3]=np.where(cut,255,0)
  Image.fromarray(out).save(G+'public/'+key[:-4]+'_cut.png',optimize=True)
  BEH[key]=beh
json.dump(BEH,open(G+'src/data/blade-behind.json','w'),separators=(',',':'))
print('ok',len(B))
