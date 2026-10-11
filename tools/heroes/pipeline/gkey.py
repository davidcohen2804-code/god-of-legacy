import numpy as np
from PIL import Image
from scipy import ndimage
def key(path):
    a=np.array(Image.open(path).convert('RGB')).astype(np.float32); H,W,_=a.shape
    r,g,b=a[...,0],a[...,1],a[...,2]
    gr=g-np.maximum(r,b)
    bgm=(gr>18)
    # smooth background model from green pixels
    small=4; ys,xs=np.where(bgm[::small,::small]); ys*=small; xs*=small
    yy,xx=np.mgrid[0:H,0:W]
    def basis(x,y): return np.stack([np.ones_like(x),x/W,y/H,(x/W)**2,(y/H)**2,x*y/(W*H)],-1).astype(np.float32)
    X=basis(xs,ys); G=basis(xx,yy); bg=np.zeros_like(a)
    for c in range(3): bg[...,c]=G@np.linalg.lstsq(X,a[ys,xs,c],rcond=None)[0]
    d=np.sqrt(((a-bg)**2).sum(2))
    fg=(d>38)&~(gr>22)
    fg=ndimage.binary_opening(fg,iterations=1)
    lab,k=ndimage.label(fg); sz=ndimage.sum(fg,lab,range(1,k+1)); big=np.argmax(sz)+1
    near=ndimage.binary_dilation(lab==big,iterations=25)
    keep=np.isin(lab,np.unique(lab[near&fg]))&~((yy<0.12*H)&(xx>0.72*W)&(lab!=big))
    cl=ndimage.binary_closing(keep,iterations=1); holes=ndimage.binary_fill_holes(cl)&~cl
    hl,hk=ndimage.label(holes); hs=ndimage.sum(holes,hl,range(1,hk+1))
    solid=cl|np.isin(hl,[j+1 for j in range(hk) if hs[j]<60])
    edge=ndimage.binary_dilation(solid,iterations=1)&~ndimage.binary_erosion(solid,iterations=1)
    soft=np.clip((d-20)/40,0,1)
    al=np.where(ndimage.binary_erosion(solid,iterations=1),1.0,np.where(edge,soft,0.0))
    al=ndimage.gaussian_filter(al,0.5)*ndimage.binary_dilation(solid,iterations=1)
    rgb=np.where(al[...,None]>0.02,(a-(1-al[...,None])*bg)/np.maximum(al[...,None],0.02),0)
    # despill green
    rgb[...,1]=np.minimum(rgb[...,1],np.maximum(rgb[...,0],rgb[...,2])*1.02+6)
    return np.concatenate([np.clip(rgb,0,255),al[...,None]*255],2).astype(np.uint8)
