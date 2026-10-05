# extract an item layer = pixels where GPT's "wearing X" sheet differs from the base sheet (after per-frame registration)
# usage: extract.py base.png edited.png out_layer.png W H
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
base=np.array(Image.open(sys.argv[1]).convert('RGBA')).astype(float); W=int(sys.argv[4]); H=int(sys.argv[5])
ed=Image.open(sys.argv[2]).convert('RGB')
rows=base.shape[0]//H; cols=base.shape[1]//W
# GPT output may be rescaled: fit to base size
ed=np.array(ed.resize((cols*W,rows*H),Image.LANCZOS)).astype(float)
R,G,B=ed[...,0],ed[...,1],ed[...,2]; mag=np.clip(((np.minimum(R,B)-G)-60)/90,0,1); eal=(1-mag)
out=np.zeros(base.shape,np.uint8); rep=[]
for r in range(rows):
  for c in range(cols):
    b=base[r*H:(r+1)*H,c*W:(c+1)*W]; e=ed[r*H:(r+1)*H,c*W:(c+1)*W]; ea=eal[r*H:(r+1)*H,c*W:(c+1)*W]
    ba=b[...,3]>128
    # register: best integer shift (±12) and scale by silhouette IoU of the lower body (unchanged part)
    best=(-1,0,0); low=np.zeros_like(ba); low[int(H*0.62):]=True
    for dy in range(-12,13,2):
      for dx in range(-12,13,2):
        sh=np.roll(np.roll(ea>0.5,dy,0),dx,1)
        iou=((sh&ba)&low).sum()/max(1,((sh|ba)&low).sum())
        if iou>best[0]: best=(iou,dy,dx)
    _,dy,dx=best
    for ddy in (dy-1,dy,dy+1):
      for ddx in (dx-1,dx,dx+1):
        sh=np.roll(np.roll(ea>0.5,ddy,0),ddx,1); iou=((sh&ba)&low).sum()/max(1,((sh|ba)&low).sum())
        if iou>best[0]: best=(iou,ddy,ddx)
    iou,dy,dx=best
    e2=np.roll(np.roll(e,dy,0),dx,1); a2=np.roll(np.roll(ea,dy,0),dx,1)
    diff=np.abs(e2-b[...,:3]).sum(2)
    ch=((a2>0.5)&((~ba)|(diff>90)))|((a2<0.5)&ba)
    ch=nd.binary_opening(ch,iterations=1); lab,n=nd.label(ch)
    if n: sz=nd.sum(ch,lab,range(1,n+1)); ch=np.isin(lab,1+np.nonzero(sz>=60)[0])
    ch=nd.binary_closing(ch,iterations=2)
    layer=np.zeros((H,W,4),np.uint8); layer[...,:3]=e2.clip(0,255).astype(np.uint8)
    keep=ch&(a2>0.5)
    # defringe: drop edge pixels that still carry magenta tint
    mt=(e2[...,0]>e2[...,1]+50)&(e2[...,2]>e2[...,1]+50); edge=keep&~nd.binary_erosion(keep,iterations=1); keep&=~(edge&mt)
    layer[...,3]=np.where(keep,255,0)
    # hair/head pixels hidden under the piece: base opaque, edited transparent, above the shoulders → erase marker (magenta)
    er=ba&(a2<0.3); ys_=np.nonzero(ba.any(1))[0]; top_=ys_.min() if len(ys_) else 0
    er[int(top_+(H-top_)*0.4):]=False; er=nd.binary_opening(er,iterations=1)
    layer[er]=[255,0,255,255]
    out[r*H:(r+1)*H,c*W:(c+1)*W]=layer; rep.append((r,c,round(iou,2),dy,dx,int(ch.sum())))
Image.fromarray(out).save(sys.argv[3]); print(rep)
