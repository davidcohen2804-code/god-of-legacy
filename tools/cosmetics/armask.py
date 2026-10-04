import json, numpy as np
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); B=json.load(open(G+'src/data/blade-lines.json'))
for key in B:
  name=key.split('/')[-2] if '/skills/' in key else None; c=cells.get(name,{}) if name else {}
  W=c.get('w',352); H=c.get('h',352)
  a=np.array(Image.open(G+'public/'+key).convert('RGBA')).astype(int)
  w=np.array(Image.open(G+'public/'+key[:-4]+'_weapon.png'))[...,3]>0
  cu=np.array(Image.open(G+'public/'+key[:-4]+'_cut.png'))[...,3]>0
  bl=nd.binary_dilation(w|cu,iterations=3)
  R,Gc,Bc,A=[a[...,i] for i in range(4)]
  mx=np.maximum(np.maximum(R,Gc),Bc); mn=np.minimum(np.minimum(R,Gc),Bc); sat=(mx-mn)/np.maximum(mx,1)
  m=(A>150)&(sat<0.35)&(Bc>=R-6)&(mx>25)&~bl
  out=np.zeros(m.shape,bool)
  for r in range(a.shape[0]//H):
    for k in range(a.shape[1]//W):
      s=m[r*H:(r+1)*H,k*W:(k+1)*W]; lab,n=nd.label(nd.binary_closing(s,iterations=1))
      if n: sz=nd.sum(np.ones_like(lab),lab,range(1,n+1)); keep=np.isin(lab,1+np.nonzero(sz>=40)[0]); s=s&keep
      out[r*H:(r+1)*H,k*W:(k+1)*W]=s
  o=np.zeros((*out.shape,4),np.uint8); o[...,3]=np.where(out,255,0)
  Image.fromarray(o).save(G+'public/'+key[:-4]+'_armor.png',optimize=True)
  if key.endswith('idle.png'):
    v=a.copy(); v[out]=[0,255,0,255]; Image.fromarray(v[:, :W*3].astype(np.uint8)).save('armask.png')
print('ok')
