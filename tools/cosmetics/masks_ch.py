import json, numpy as np
from PIL import Image
from scipy import ndimage as nd
exec(open('/tmp/claude-0/cos/capemask.py').read().split("if __name__")[0])
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); A=json.load(open(G+'src/data/body-anchors.json')); B=json.load(open(G+'src/data/blade-lines.json'))
for key in B:
  name=key.split('/')[-2] if '/skills/' in key else None; c=cells.get(name,{}) if name else {}
  W=c.get('w',352); H=c.get('h',352); fx=W//2; fy=310+H-352
  a=np.array(Image.open(G+'public/'+key).convert('RGBA'))
  m=cape_mask(a,W,H,A.get(key)); o=np.zeros((*m.shape,4),np.uint8); o[...,3]=np.where(m,255,0); Image.fromarray(o).save(G+'public/'+key[:-4]+'_cape.png')
  ai=a.astype(int); R,Gc,Bc,Al=[ai[...,i] for i in range(4)]
  col=(Al>100)&(R>30)&(R>Gc*1.35)&(Gc>=Bc*0.9)&(Gc<R*0.66)&~((Gc<R*0.42)&(Bc<R*0.42)&(np.abs(Gc-Bc)<R*0.16)&(R>120))
  out=np.zeros(col.shape,bool); an=A.get(key); yy,xx=np.mgrid[0:H,0:W]
  for r in range(a.shape[0]//H):
    for k in range(a.shape[1]//W):
      e=an[r][k] if an and r<len(an) and k<len(an[r]) else None
      if not e or len(e)<10: continue
      cx=fx+e[7]; hw=e[8]; hb=fy+e[9]
      box=(np.abs(xx-cx)<hw*0.8)&(yy<hb+3)&(yy>hb-hw*1.6)
      mm=col[r*H:(r+1)*H,k*W:(k+1)*W]&box
      lab,n=nd.label(nd.binary_closing(mm,iterations=1)&box)
      if n: sz=nd.sum(np.ones_like(lab),lab,range(1,n+1)); mm=mm&np.isin(lab,1+np.nonzero(sz>=max(30,sz.max()*0.08))[0])
      out[r*H:(r+1)*H,k*W:(k+1)*W]=mm
  o=np.zeros((*out.shape,4),np.uint8); o[...,3]=np.where(out,255,0); Image.fromarray(o).save(G+'public/'+key[:-4]+'_hair.png')
print('ok')
