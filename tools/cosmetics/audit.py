import numpy as np, json, sys, os
from PIL import Image
G='/home/claude/god-of-legacy/'
P=json.load(open('params.json')); F=json.load(open(G+'src/data/head-frames.json')); cells=json.load(open(G+'src/data/body-cells.json'))
HW=[58,54,56,51]
def cap(im):
  a=np.array(im)[...,3]>128; ys=np.nonzero(a.any(1))[0]; top=ys.min(); h=ys.max()-top
  band=a[top:top+int(h*0.3)]; xs=np.nonzero(band.any(0))[0]; return xs.min(),xs.max(),top
def render(key,s):
  name=key.split('/')[-2] if '/skills/' in key else None; cc=cells.get(name,{}) if name else {}
  W=cc.get('w',352); H=cc.get('h',352); fx0=W//2; fy0=310+H-352
  body=Image.open(G+'public/'+key).convert('RGBA'); cols=body.width//W; rows=body.height//H
  out=Image.new('RGB',(cols*150,rows*170),(30,30,30))
  for r in range(rows):
    for k in range(cols):
      cell=body.crop((k*W,r*H,(k+1)*W,(r+1)*H)); bg=Image.new('RGBA',cell.size,(60,70,60,255)); bg.alpha_composite(cell)
      f=F[key][r][k]
      if f:
        cx,top,tilt=f[0],f[1],f[2]; kk,lift,dx=P[str(s)][r]
        im=Image.open(f'h{s}{r}.png'); cx0,cx1,ct=cap(im); sc=(HW[r]*kk)/(cx1-cx0)
        im=im.resize((round(im.width*sc),round(im.height*sc)),Image.LANCZOS)
        # pivot = crown centre at the hair top line
        px=(cx0+cx1)/2*sc; py=ct*sc
        big=Image.new('RGBA',(im.width*3,im.height*3)); big.alpha_composite(im,(im.width,im.height))
        big=big.rotate(-tilt,center=(im.width+px,im.height+py),resample=Image.BICUBIC)
        ox=round(fx0+cx+dx*HW[r]-(im.width+px)); oy=round(fy0+top-lift*HW[r]-(im.height+py))
        bg.alpha_composite(big,(ox,oy)) if ox>=0 and oy>=0 else bg.paste(big,(ox,oy),big)
      t=bg.crop((fx0-120,fy0-300,fx0+120,fy0+40)).resize((150,212)).crop((0,0,150,170))
      out.paste(t.convert('RGB'),(k*150,r*170))
  return out
if __name__=='__main__':
  key=sys.argv[1]; s=int(sys.argv[2]); im=render(key,s); im.save(os.environ.get('OUT','au.png'))
