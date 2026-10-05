# bake_poses.py <item_id> <gpt_sheet1> <gpt_sheet2> <gpt_sheet3> : piece drawn by GPT on the 48 skill poses → every hard frame
import json, numpy as np, pickle, sys, subprocess, os
from PIL import Image
G='/home/claude/god-of-legacy/'
P=pickle.load(open('/tmp/claude-0/cos/poses2.pkl','rb')); items,reps,assign=P['items'],P['reps'],P['assign']
iid=sys.argv[1]; S=352; rl={}
for s,img in enumerate(sys.argv[2:5]):
  if img=='-': continue
  out=f'/tmp/claude-0/cos/pl{s}.png'
  subprocess.run(['python3','/tmp/claude-0/cos/extract.py',f'/tmp/claude-0/cos/skill_poses_{s+1}_base.png',img,out,'352','352'],check=True,capture_output=True,env={**os.environ,'HEADZONE':'176,150,80','PMASK':f'/tmp/claude-0/cos/skill_poses_{s+1}_m.png'})
  L=np.array(Image.open(out).convert('RGBA'))
  for j,rp in enumerate(reps[s*16:(s+1)*16]): rl[rp]=L[(j//4)*S:(j//4+1)*S,(j%4)*S:(j%4+1)*S]
outdir=G+f'public/assets/final/cosmetics/warrior/{iid}/layers'; sheets={}
def sheet(key):
  if key not in sheets:
    name=key.split('/')[-2] if '/skills/' in key else key.split('/')[-1][:-4]
    sheets[key]=(f'{outdir}/{name}.png', np.array(Image.open(f'{outdir}/{name}.png').convert('RGBA')))
  return sheets[key][1]
for i,it in enumerate(items):
  rp=assign[i]
  if rp not in rl: continue
  L=rl[rp]; rh=items[rp]['hair']; mh=it['hair']; best=(-1,0,0)
  for dy in range(-12,13):
    for dx in range(-12,13):
      sh=np.roll(np.roll(rh,dy,0),dx,1); s_=(sh&mh).sum()/max(1,(sh|mh).sum())
      if s_>best[0]: best=(s_,dy,dx)
  _,dy,dx=best; lay=np.roll(np.roll(L,dy,0),dx,1)
  W,H=it['W'],it['H']; r,c=it['r'],it['c']; oy,ox=it['oy'],it['ox']
  big=np.zeros((H,W,4),np.uint8)
  sy0,sx0=max(0,oy),max(0,ox); sy1,sx1=min(H,oy+S),min(W,ox+S)
  big[sy0:sy1,sx0:sx1]=lay[sy0-oy:sy1-oy,sx0-ox:sx1-ox]
  if it['flip']: big=big[:, ::-1]
  pm=np.array(Image.open(G+'public/'+it['key'][:-4]+'_m.png'))[r*H:(r+1)*H,c*W:(c+1)*W,0]==40
  mag=(big[...,0]==255)&(big[...,1]==0)&(big[...,2]==255)&(big[...,3]>0); big[mag&~pm]=0
  op=(big[...,3]>0)&~mag
  if op.any():
    top=np.argmax(op,axis=0); has=op.any(0); run=np.cumprod(op|~(np.arange(H)[:,None]>=top[None,:]),axis=0).astype(bool)&op
    bot=np.where(has,H-1-np.argmax(run[::-1],axis=0),-1); yy=np.arange(H)[:,None]
    big[(yy<=bot[None,:]-2)&has[None,:]&pm&~op]=[255,0,255,255]
  sheet(it['key'])[r*H:(r+1)*H,c*W:(c+1)*W]=big
for k,(p,a) in sheets.items():
  Image.fromarray(a).quantize(colors=255,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(p,optimize=True)
print('poses baked',iid,len(items))
