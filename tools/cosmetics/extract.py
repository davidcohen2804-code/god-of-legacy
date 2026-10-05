# extract an item layer = pixels where GPT's "wearing X" sheet differs from the base sheet (after per-frame registration)
# usage: extract.py base.png edited.png out_layer.png W H
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
base=np.array(Image.open(sys.argv[1]).convert('RGBA')).astype(float); import os
PM=np.array(Image.open(os.environ['PMASK']))[...,0] if os.environ.get('PMASK') else None; W=int(sys.argv[4]); H=int(sys.argv[5])
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
    _hz=__import__('os').environ.get('HEADZONE')
    if _hz:
      _x,_y,_r=[float(v) for v in _hz.split(',')]; _yy,_xx=np.mgrid[0:H,0:W]; low=((_xx-_x)**2+(_yy-_y)**2)>(_r*1.3)**2

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
    if iou<0.86:
      # scale search (GPT sometimes redraws a row slightly bigger): rescale the edited cell about the feet point
      bestS=(-1,1.0)
      low=np.zeros_like(ba); low[int(H*0.55):]=True
      for scl in (0.86,0.9,0.94,0.97,1.0,1.03,1.06,1.1):
        if scl!=1.0:
          im=Image.fromarray(np.dstack([e,ea*255]).clip(0,255).astype(np.uint8)).resize((round(W*scl),round(H*scl)),Image.LANCZOS)
          cv=Image.new('RGBA',(W,H)); fxp,fyp=W//2,310+H-352
          cv.paste(im,(round(fxp-fxp*scl),round(fyp-fyp*scl)))
          arr=np.array(cv).astype(float); ec,ac=arr[...,:3],arr[...,3]/255
        else: ec,ac=e,ea
        for dy in range(-16,17,4):
          for dx in range(-16,17,4):
            sh=np.roll(np.roll(ac>0.5,dy,0),dx,1); iou=((sh&ba)&low).sum()/max(1,((sh|ba)&low).sum())
            if iou>bestS[0]: bestS=(iou,scl,ec,ac)
      _,scl,e,ea=bestS
      best=(-1,0,0)
      for dy in range(-16,17):
        for dx in range(-16,17):
          sh=np.roll(np.roll(ea>0.5,dy,0),dx,1); iou2=((sh&ba)&low).sum()/max(1,((sh|ba)&low).sum())
          if iou2>best[0]: best=(iou2,dy,dx)
      iou,dy,dx=best
    e2=np.roll(np.roll(e,dy,0),dx,1); a2=np.roll(np.roll(ea,dy,0),dx,1)
    diff=np.abs(e2-b[...,:3]).sum(2)
    strong=((a2>0.5)&((~ba)|(diff>90)))|((a2<0.5)&ba)
    weak=(a2>0.5)&(diff>55)
    lab_,n_=nd.label(weak|strong)
    keepw=nd.binary_dilation(strong,iterations=2)   # weak changes count only right next to a clear change (dark hat over dark hair)
    ch=strong|(weak&keepw)
    holes=nd.binary_fill_holes(ch)&~ch; hl,hn=nd.label(holes)
    if hn: hs=nd.sum(holes,hl,range(1,hn+1)); ch|=np.isin(hl,1+np.nonzero(hs<350)[0])   # only pinholes inside the piece
    ch=(ch&(a2>0.5))|((a2<0.5)&ba)
    bR,bG,bB=b[...,0],b[...,1],b[...,2]
    bskin=(ba)&(bR>170)&(bG>110)&(bG<215)&(bB>80)&(bB<190)&(bR>bG+12)&(bG>bB+8)
    eR,eG,eB=e2[...,0],e2[...,1],e2[...,2]
    eskin=(eR>150)&(eG>95)&(eB>70)&(eR>eG+10)&(eG>eB+5)
    ch&=~(nd.binary_dilation(bskin,iterations=1)&eskin)        # GPT's re-drawn face stays out
    if PM is not None:
      reg_=PM[r*H:(r+1)*H,c*W:(c+1)*W]; arm=np.isin(reg_,[80,120,160,240])
      ch&=~(arm&(diff<160))
      if _hz: ch&=~((reg_==0)&ba&(diff<160))   # pose sheets: re-drawn sword/shield/skin stays out                                      # re-drawn armor/cape stays out
    lab3,n3=nd.label(nd.binary_dilation(ch&(a2>0.5),iterations=1))
    if n3:
      s3=nd.sum(ch&(a2>0.5),lab3,range(1,n3+1)); ch=(ch&~(a2>0.5))|((a2>0.5)&ch&np.isin(lab3,1+np.nonzero(s3>=s3.max()*0.25)[0]))  # the piece, not stray redraw noise
    ys_=np.nonzero((ba|(a2>0.5)).any(1))[0]; zt=ys_.min(); zb=int(zt+(ys_.max()-zt)*float(__import__('os').environ.get('ZONE','0.42')))
    zone=np.zeros_like(ch); zone[:zb]=True
    hz=__import__('os').environ.get('HEADZONE')
    if hz:  # pose sheets: the head sits at a fixed point of every cell
      hx_,hy_,hr_=[float(v) for v in hz.split(',')]; yy_,xx_=np.mgrid[0:H,0:W]; zone=((xx_-hx_)**2+(yy_-hy_)**2)<hr_**2
    ch&=zone   # item zone
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
