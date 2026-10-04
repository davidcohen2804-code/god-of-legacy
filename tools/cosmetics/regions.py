# split the warrior into recolourable regions per frame: chest (upper plate), gloves, boots (lower plate), pants (blue cloth)
import json, numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); B=json.load(open(G+'src/data/blade-lines.json'))
keys=sys.argv[1:] or list(B)
for key in keys:
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); H=cc.get('h',352); fx=W//2; fy=310+H-352
  a=np.array(Image.open(G+'public/'+key).convert('RGBA')).astype(int)
  arm=np.array(Image.open(G+'public/'+key[:-4]+'_armor.png'))[...,3]>0
  cut=np.array(Image.open(G+'public/'+key[:-4]+'_cut.png'))[...,3]>0; cut=nd.binary_dilation(cut,iterations=3)
  hair=np.array(Image.open(G+'public/'+key[:-4]+'_hair.png'))[...,3]>0
  R,Gc,Bc,A=[a[...,i] for i in range(4)]
  mx=np.maximum(np.maximum(R,Gc),Bc); mn=np.minimum(np.minimum(R,Gc),Bc); sat=(mx-mn)/np.maximum(mx,1)
  blue=(A>150)&(Bc>R+10)&(Bc>Gc+4)&(sat>0.22)&~cut&~arm
  out={k:np.zeros(arm.shape,bool) for k in ('chest','gloves','boots','pants')}
  yy,xx=np.mgrid[0:H,0:W]
  for r in range(a.shape[0]//H):
    for k in range(a.shape[1]//W):
      sl=(slice(r*H,(r+1)*H),slice(k*W,(k+1)*W))
      body=A[sl]>120; ys,xs=np.nonzero(body)
      if len(ys)==0: continue
      hm=hair[sl]; hy=np.nonzero(hm.any(1))[0]
      top=hy.min() if len(hy) else ys.min(); bot=fy
      Hh=max(40,bot-top)
      m=arm[sl]
      # shield = big blue component (+ its rim)
      bl=blue[sl]; lab,n=nd.label(bl); shield=np.zeros_like(bl)
      for i in range(1,n+1):
        c=lab==i
        if c.sum()>=900: shield|=c
      # shield = everything enclosed by its gold rim (the rim is a closed loop)
      Rs,Gs,Bs=R[sl],Gc[sl],Bc[sl]; gold=(A[sl]>150)&(Rs>140)&(Gs>90)&(Bs<90)&(Rs>Bs*1.8)
      g2=nd.binary_closing(gold,iterations=2); filled=nd.binary_fill_holes(g2)&~g2
      lab2,n2=nd.label(filled)
      for i in range(1,n2+1):
        c=lab2==i
        if c.sum()>=500 and (c&bl).sum()>c.sum()*0.3: shield|=nd.binary_dilation(c,iterations=2)
      shield_zone=nd.binary_dilation(shield,iterations=9)
      hip=top+Hh*0.62
      # boots: per column, plate within bootH of the lowest plate pixel in that column (works for raised feet), below the hip
      bootH=Hh*0.13; legs=m&(yy>hip)
      low=np.where(legs.any(0), H-1-np.argmax(legs[::-1],axis=0), -1)
      boots=legs&(yy>low[None,:]-bootH)
      # gloves: plate near the sword hilt + plate of the shield arm touching the shield (above the hip)
      gl=np.zeros_like(m); ln=B[key][r][k] if r<len(B[key]) and k<len(B[key][r]) else None
      if ln: hx,hyy=fx+ln[0],fy+ln[1]; gl|=m&((xx-hx)**2+(yy-hyy)**2<22**2)
      if shield.any(): gl|=m&nd.binary_dilation(shield,iterations=5)&(yy<hip)&~nd.binary_dilation(shield,iterations=0)
      gl=nd.binary_closing(gl,iterations=1)&m
      out['gloves'][sl]=gl
      out['boots'][sl]=boots&~gl
      out['chest'][sl]=m&~gl&~boots
      pm=np.zeros_like(bl)
      for i in range(1,n+1):
        c=lab==i; s_=c.sum(); cy=np.nonzero(c)[0].mean()
        if not (s_<900 and cy>hip-Hh*0.12 and cy<top+Hh*0.95 and not (c&shield_zone).any()): continue
        cxs=np.nonzero(c)[1].mean(); lx=np.nonzero(legs.any(0))[0]
        if len(lx)==0 or cxs<lx.min()-4 or cxs>lx.max()+4: continue
        if not (nd.binary_dilation(c,iterations=3)&m).any(): continue
        pm|=c
      out['pants'][sl]=pm
  for kname,m in out.items():
    o=np.zeros((*m.shape,4),np.uint8); o[...,3]=np.where(m,255,0)
    Image.fromarray(o).save(G+'public/'+key[:-4]+f'_{kname}.png',optimize=True)
  if len(keys)<4:
    v=a.copy().astype(np.uint8)
    for kname,col in zip(('chest','gloves','boots','pants'),([0,255,0,255],[255,0,255,255],[255,255,0,255],[0,255,255,255])): v[out[kname]]=col
    Image.fromarray(v).save('/tmp/claude-0/cos/reg_'+(name or key.split('/')[-1][:-4])+'.png')
print('ok')
