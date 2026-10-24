import sys
from PIL import Image, ImageFilter
import numpy as np
from collections import deque
def cut(src, dst, T=14):
    im=np.asarray(Image.open(src).convert('RGB')).astype(np.int32); h,w,_=im.shape
    bgc=np.concatenate([im[0],im[-1],im[:,0],im[:,-1]]).mean(0)
    d=np.abs(im-bgc).max(2); bg=np.zeros((h,w),bool); q=deque()
    for x in range(w): q.append((0,x)); q.append((h-1,x))
    for y in range(h): q.append((y,0)); q.append((y,w-1))
    while q:
        y,x=q.popleft()
        if bg[y,x] or d[y,x]>T: continue
        bg[y,x]=True
        if y>0: q.append((y-1,x))
        if y<h-1: q.append((y+1,x))
        if x>0: q.append((y,x-1))
        if x<w-1: q.append((y,x+1))
    a=np.where(bg,0,255).astype(np.uint8)
    A=Image.fromarray(a).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rgba=Image.open(src).convert('RGB'); rgba.putalpha(A); rgba.save(dst)
    ys,xs=np.where(a>0); print(dst,'bg',bgc.round(1),'bbox x',xs.min(),xs.max(),'y',ys.min(),ys.max())
for s,d in zip(sys.argv[1::2], sys.argv[2::2]): cut(s,d)
