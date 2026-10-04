# one packed mask per warrior sheet: R = region label (40 hair, 80 chest, 120 gloves, 160 boots, 200 pants, 240 cape), G = sword cut (255)
import json, numpy as np, os
from PIL import Image
G='/home/claude/god-of-legacy/public/'
B=json.load(open('/home/claude/god-of-legacy/src/data/blade-lines.json'))
for key in B:
  base=G+key[:-4]; a=np.array(Image.open(G+key).convert('RGBA'))
  out=np.zeros((*a.shape[:2],4),np.uint8); out[...,3]=255
  for suf,v in [('_cape',240),('_hair',40),('_chest',80),('_gloves',120),('_boots',160),('_pants',200)]:
    m=np.array(Image.open(base+suf+'.png'))[...,3]>0; out[m,0]=v
  c=np.array(Image.open(base+'_cut.png'))[...,3]>0; out[c,1]=255
  Image.fromarray(out).save(base+'_m.png',optimize=True)
  for suf in ['_cape','_hair','_chest','_gloves','_boots','_pants','_armor','_cut']:
    if os.path.exists(base+suf+'.png'): os.remove(base+suf+'.png')
print('ok')
