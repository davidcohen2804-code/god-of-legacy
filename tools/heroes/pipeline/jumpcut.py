"""jumpcut.py <hero> <video> f1,f2,...f7 [act]: place the jump clip's frames (feet on y=700, hips on x=384, scale from frame 0's standing height)."""
import sys,pickle,json,os,glob,numpy as np
sys.path.insert(0,'/home/claude/god-of-legacy/tools/heroes/pipeline')
from integrate import hip_x
from PIL import Image
h,v,fr=sys.argv[1],sys.argv[2],[int(x) for x in sys.argv[3].split(',')]; act='jump_clip'; HX=int(sys.argv[4]) if len(sys.argv)>4 else 384; W=HX+384
A=pickle.load(open(v+'.keyed.pkl','rb')); M=f'/home/claude/god-of-legacy/tools/heroes/motion/{h}'
m0=A[0][...,3]>128; y0=np.where(m0.any(1))[0]; S=509/(y0[-1]-y0[0])
for f in glob.glob(f'{M}/{act}_[0-9]*.png'): os.remove(f)
def desp(a):
    a=a.astype(int); a[...,1]=np.minimum(a[...,1],np.maximum(a[...,0],a[...,2])); return a.astype(np.uint8)
for n,i in enumerate(fr,1):
    a=desp(A[i]); m=a[...,3]>128; ys,xs=np.where(m); cx=hip_x(m); bot=ys.max()
    im=Image.fromarray(a).resize((round(a.shape[1]*S),round(a.shape[0]*S)),Image.LANCZOS)
    C=Image.new('RGBA',(W,768)); C.paste(im,(round(HX-cx*S),round(700-bot*S)),im); C.save(f'{M}/{act}_{n:02d}.png'); print(n,i,C.getbbox())
mj=f'{M}/motion.json'; J=json.load(open(mj)); J['animations'][act]={'frames':len(fr),'source':f'pixverse {os.path.basename(v)}'}
if HX!=384: J['animations'][act]['hip_x']=HX; json.dump(J,open(mj,'w'),indent=2)
