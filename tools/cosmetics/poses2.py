import json, numpy as np, pickle
from PIL import Image
from scipy import ndimage as nd
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); H=json.load(open('headmatch.json'))
S=128; NREP=48
def skinm(c):
  R,Gc,B,A=[c[...,i].astype(int) for i in range(4)]
  return (A>150)&(R>170)&(Gc>110)&(Gc<215)&(B>80)&(B<190)&(R>Gc+12)&(Gc>B+8)
items=[]
for key,v in H.items():
  if key.endswith('idle.png'): continue
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); Hh=cc.get('h',352)
  a=np.array(Image.open(G+'public/'+key).convert('RGBA')); pm=np.array(Image.open(G+'public/'+key[:-4]+'_m.png'))[...,0]
  for r,row in enumerate(v):
    for c,x in enumerate(row):
      if not (x is None or x[0]>44 or abs(x[1])>=16): continue
      fr=a[r*Hh:(r+1)*Hh,c*W:(c+1)*W]; hm=pm[r*Hh:(r+1)*Hh,c*W:(c+1)*W]==40; sk=skinm(fr); m=hm|sk
      if m.sum()<80: continue
      lab,n=nd.label(nd.binary_dilation(m,iterations=3)); sz=nd.sum(m,lab,range(1,n+1)); m=(lab==1+int(np.argmax(sz)))&m
      ys,xs=np.nonzero(m); cy,cx=int((ys.min()+ys.max())/2),int((xs.min()+xs.max())/2)
      y0,x0=cy-S//2,cx-S//2; crop=np.zeros((S,S,4),np.uint8); hc=np.zeros((S,S),bool)
      sy0,sx0=max(0,y0),max(0,x0); sy1,sx1=min(Hh,y0+S),min(W,x0+S)
      crop[sy0-y0:sy1-y0,sx0-x0:sx1-x0]=fr[sy0:sy1,sx0:sx1]; hc[sy0-y0:sy1-y0,sx0-x0:sx1-x0]=hm[sy0:sy1,sx0:sx1]
      flip=(r==2)
      if flip: crop=crop[:, ::-1].copy(); hc=hc[:, ::-1].copy()
      # head-focused feature: hair mask + gray, central 80px
      g=crop[...,:3].mean(2)*(crop[...,3]/255); cen=slice(24,104)
      f=np.concatenate([np.array(Image.fromarray(hc[cen,cen].astype(np.uint8)*255).resize((20,20),Image.BILINEAR)).ravel()*1.5,
                        np.array(Image.fromarray(g[cen,cen].astype(np.uint8)).resize((20,20),Image.BILINEAR)).ravel()])
      items.append(dict(key=key,r=r,c=c,y0=y0,x0=x0,W=W,H=Hh,flip=flip,feat=f.astype(np.float32),crop=crop,hair=hc))
X=np.stack([i['feat'] for i in items]); D=np.abs(X[:,None]-X[None]).mean(2)
# k-medoids-ish: farthest-point seeds then assign
reps=[int(np.argmax(D.sum(1)))]
while len(reps)<NREP: reps.append(int(np.argmax(D[:,reps].min(1))))
for _ in range(5):
  assign=np.array(reps)[np.argmin(D[:,reps],1)]
  reps=[int(min(np.nonzero(assign==rp)[0],key=lambda i:D[i,assign==rp].sum())) for rp in reps]
assign=np.array(reps)[np.argmin(D[:,reps],1)]
print('frames',len(items),'reps',len(reps),'worst member dist',round(float(D[np.arange(len(items)),assign].max()),1),'median',round(float(np.median(D[np.arange(len(items)),assign])),1))
# atlas 8 x 6 of 128 on magenta
atlas=Image.new('RGBA',(8*S,6*S),(255,0,255,255))
for i,rp in enumerate(reps):
  t=Image.new('RGBA',(S,S),(255,0,255,255)); t.alpha_composite(Image.fromarray(items[rp]['crop'])); atlas.paste(t,((i%8)*S,(i//8)*S))
atlas.convert('RGB').save('head_poses.png')
for it in items: it.pop('feat')
pickle.dump(dict(items=items,reps=reps,assign=assign.tolist()),open('poses2.pkl','wb'))
