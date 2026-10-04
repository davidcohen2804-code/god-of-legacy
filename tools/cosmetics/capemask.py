import numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
def cape_mask(a, W, H, anch=None):
  R,G,B,A=[a[...,i].astype(int) for i in range(4)]
  base=(A>100)&(R>45)&(G<R*0.5)&(B<R*0.5)&(np.abs(G-B)<R*0.16)
  out=np.zeros(base.shape,bool)
  for r in range(a.shape[0]//H):
    for k in range(a.shape[1]//W):
      m=base[r*H:(r+1)*H,k*W:(k+1)*W].copy()
      an=anch[r][k] if anch and r<len(anch) and k<len(anch[r]) else None
      if an and len(an)>9:
        fx=W//2; fy=310+H-352; cx=fx+an[7]; hw=an[8]; hb=fy+an[9]
        yy,xx=np.mgrid[0:H,0:W]; m&=~((np.abs(xx-cx)<hw*0.75)&(yy<hb+6))
      mc=nd.binary_closing(m,iterations=2)&(A[r*H:(r+1)*H,k*W:(k+1)*W]>100)
      lab,n=nd.label(nd.binary_opening(mc,iterations=1))
      if n==0: continue
      sz=nd.sum(np.ones_like(lab),lab,range(1,n+1)); keep=np.isin(lab,1+np.nonzero(sz>250)[0])
      keep=nd.binary_dilation(keep,iterations=2)&mc
      out[r*H:(r+1)*H,k*W:(k+1)*W]=keep
  return out
if __name__=='__main__':
  a=np.array(Image.open(sys.argv[1]).convert('RGBA'))[:, :352*3]
  import json; A=json.load(open('/home/claude/god-of-legacy/src/data/body-anchors.json'))['assets/final/body/warrior/movement/idle.png']
  m=cape_mask(a,352,352,A); o=a.copy(); o[m]=[0,255,0,255]; Image.fromarray(o).save('/tmp/claude-0/cos/capemask.png')
