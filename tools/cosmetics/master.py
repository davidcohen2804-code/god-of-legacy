# one sheet per item: row 1 = idle (front/right/left/back), rows 2-4 = the 12 most distinct skill head poses
import json, numpy as np, pickle
from PIL import Image
G='/home/claude/god-of-legacy/'
P=pickle.load(open('poses2.pkl','rb')); items=P['items']; S=352
X=[]
for it in items:
  hc=it['hair']; g=it['crop'][...,:3].mean(2)*(it['crop'][...,3]/255); cen=slice(24,104)
  X.append(np.concatenate([np.array(Image.fromarray(hc[cen,cen].astype(np.uint8)*255).resize((20,20),Image.BILINEAR)).ravel()*1.5,
                           np.array(Image.fromarray(g[cen,cen].astype(np.uint8)).resize((20,20),Image.BILINEAR)).ravel()]))
X=np.array(X,np.float32); D=np.abs(X[:,None]-X[None]).mean(2)
reps=[int(np.argmax(D.sum(1)))]
while len(reps)<12: reps.append(int(np.argmax(D[:,reps].min(1))))
for _ in range(6):
  assign=np.array(reps)[np.argmin(D[:,reps],1)]
  reps=[int(min(np.nonzero(assign==rp)[0],key=lambda i:D[i,assign==rp].sum())) for rp in reps]
assign=np.array(reps)[np.argmin(D[:,reps],1)]
idle=Image.open(G+'public/assets/final/body/warrior/movement/idle.png').convert('RGBA')
sh=Image.new('RGBA',(4*S,4*S),(255,0,255,255))
for v in range(4):
  c=Image.new('RGBA',(S,S),(255,0,255,255)); c.alpha_composite(idle.crop((0,v*S,S,(v+1)*S))); sh.paste(c,(v*S,0))
for j,rp in enumerate(reps):
  c=Image.new('RGBA',(S,S),(255,0,255,255)); c.alpha_composite(Image.fromarray(items[rp]['big'])); sh.paste(c,((j%4)*S,(1+j//4)*S))
sh.convert('RGB').save('item_master.png')
P['mreps']=reps; P['massign']=assign.tolist(); pickle.dump(P,open('poses2.pkl','wb'))
print('worst',round(float(D[np.arange(len(items)),assign].max()),1),'median',round(float(np.median(D[np.arange(len(items)),assign])),1))
