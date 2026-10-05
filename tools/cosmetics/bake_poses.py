# bake_poses.py <gpt_pose_atlas.png> <item_id> : hat drawn by GPT on the 48 head poses → every hard frame (members aligned to their pose)
import json, numpy as np, pickle, sys, subprocess
from PIL import Image
G='/home/claude/god-of-legacy/'
P=pickle.load(open('/tmp/claude-0/cos/poses2.pkl','rb')); items,reps,assign=P['items'],P['reps'],P['assign']
subprocess.run(['python3','/tmp/claude-0/cos/extract.py','/tmp/claude-0/cos/head_poses_base.png',sys.argv[1],'/tmp/claude-0/cos/pl.png','128','128'],check=True,capture_output=True)
PL=np.array(Image.open('/tmp/claude-0/cos/pl.png').convert('RGBA')); S=128; iid=sys.argv[2]
rl={rp:PL[(i//8)*S:(i//8+1)*S,(i%8)*S:(i%8+1)*S] for i,rp in enumerate(reps)}
outdir=G+f'public/assets/final/cosmetics/warrior/{iid}/layers'
sheets={}
def sheet(key):
  if key not in sheets:
    name=key.split('/')[-2] if '/skills/' in key else key.split('/')[-1][:-4]
    sheets[key]=(f'{outdir}/{name}.png', np.array(Image.open(f'{outdir}/{name}.png').convert('RGBA')))
  return sheets[key][1]
for i,it in enumerate(items):
  rp=assign[i]; L=rl[rp]; rh=items[rp]['hair']; mh=it['hair']
  best=(-1,0,0)
  for dy in range(-12,13):
    for dx in range(-12,13):
      sh=np.roll(np.roll(rh,dy,0),dx,1); s=(sh&mh).sum()/max(1,(sh|mh).sum())
      if s>best[0]: best=(s,dy,dx)
  _,dy,dx=best; lay=np.roll(np.roll(L,dy,0),dx,1)
  if it['flip']: lay=lay[:, ::-1]
  mh2=mh[:, ::-1] if it['flip'] else mh
  mag=(lay[...,0]==255)&(lay[...,1]==0)&(lay[...,2]==255)&(lay[...,3]>0); lay=lay.copy(); lay[mag&~mh2]=0
  op=(lay[...,3]>0)&~mag
  if op.any():  # hide only hair poking out ABOVE the hat body (per column: bottom of the first solid run from the top)
    top=np.argmax(op,axis=0); has=op.any(0); run=np.cumprod(op[::1] | ~np.arange(op.shape[0])[:,None].__ge__(top[None,:]),axis=0).astype(bool)&op
    bot=np.where(has, run.shape[0]-1-np.argmax(run[::-1],axis=0), -1)
    yy=np.arange(op.shape[0])[:,None]; under=(yy<=bot[None,:]-2)&has[None,:]&mh2&~op
    lay[under]=[255,0,255,255]
  sh=sheet(it['key']); W,H=it['W'],it['H']; r,c=it['r'],it['c']
  cell=sh[r*H:(r+1)*H,c*W:(c+1)*W]; cell[...]=0   # replace this frame's idle-transfer piece entirely
  y0,x0=it['y0'],it['x0']; sy0,sx0=max(0,y0),max(0,x0); sy1,sx1=min(H,y0+S),min(W,x0+S)
  cell[sy0:sy1,sx0:sx1]=lay[sy0-y0:sy1-y0,sx0-x0:sx1-x0]
for k,(p,a) in sheets.items():
  im=Image.fromarray(a); im.quantize(colors=255,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(p,optimize=True)
print('poses baked',iid,len(items))
