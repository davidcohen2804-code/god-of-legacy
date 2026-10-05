# qc.py <base_sheet_noalpha_or_alpha.png> <gpt_image> <cell> [HEADZONE] : flags cells where GPT moved/changed the figure or the piece is missing
import sys, os, subprocess, re, numpy as np
from PIL import Image
base,img,cell=sys.argv[1],sys.argv[2],int(sys.argv[3])
env=dict(os.environ)
if len(sys.argv)>4: env['HEADZONE']=sys.argv[4]
out=subprocess.run(['python3','/tmp/claude-0/cos/extract.py',base,img,'/tmp/claude-0/cos/qc_layer.png',str(cell),str(cell)],capture_output=True,text=True,env=env).stdout
rep=re.findall(r"\((\d+), (\d+), np\.float64\(([\d.]+)\), (-?\d+), (-?\d+), (\d+)\)",out)
L=np.array(Image.open('/tmp/claude-0/cos/qc_layer.png'))
bad=[]
for r,c,iou,dy,dx,n in rep:
  r,c=int(r),int(c); piece=(L[r*cell:(r+1)*cell,c*cell:(c+1)*cell,3]>0)&~((L[r*cell:(r+1)*cell,c*cell:(c+1)*cell,0]==255)&(L[r*cell:(r+1)*cell,c*cell:(c+1)*cell,1]==0))
  if float(iou)<0.8 or piece.sum()<900: bad.append((r+1,c+1,round(float(iou),2),int(piece.sum())))
print('cells',len(rep),'bad',bad)
