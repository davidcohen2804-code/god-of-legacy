import json, numpy as np
from PIL import Image
G='/home/claude/god-of-legacy/'
cells=json.load(open(G+'src/data/body-cells.json')); B=json.load(open(G+'src/data/blade-lines.json')); HD=json.load(open('heads.json'))
REF=[r[0][5] for r in HD['assets/final/body/warrior/movement/idle.png']]
OV=json.load(open('tilt_override.json')) if __import__('os').path.exists('tilt_override.json') else {}
out={}
for key in B:
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); H=cc.get('h',352); fx0=W//2; fy0=310+H-352
  hm=np.array(Image.open(G+'public/'+key[:-4]+'_hair.png'))[...,3]>0
  rows=[]
  for r in range(hm.shape[0]//H):
    row=[]
    for k in range(hm.shape[1]//W):
      m=hm[r*H:(r+1)*H,k*W:(k+1)*W]
      if m.sum()<120: row.append(None); continue
      from scipy import ndimage as nd
      lab,n=nd.label(nd.binary_dilation(m,iterations=2)); sz=nd.sum(m,lab,range(1,n+1)); m=(lab==1+int(np.argmax(sz)))&m
      ys,xs=np.nonzero(m); top=ys.min(); cx=(np.percentile(xs,2)+np.percentile(xs,98))/2
      d=HD[key][r][k]; tilt=0.0
      if r in (1,2) and d and d[5] is not None:
        t=d[5]-REF[r]; tilt=float(np.clip(t,-40,40)) if abs(t)>8 else 0.0
      o=OV.get(f'{key}|{r}|{k}')
      if o is not None: tilt=o
      row.append([round(float(cx-fx0),1),round(float(top-fy0),1),round(tilt,1)])
    rows.append(row)
  out[key]=rows
json.dump(out,open(G+'src/data/head-frames.json','w'),separators=(',',':'))
print('ok')
