# addone.sh <gpt_master_image> <item_id> : ONE GPT image per item (row1 idle, rows2-4 = 12 skill poses) → every warrior frame
set -e; cd /tmp/claude-0/cos
python3 - "$1" "$2" <<'PY'
import sys, numpy as np, subprocess, os, pickle
from PIL import Image
img,iid=sys.argv[1],sys.argv[2]; S=352
im=Image.open(img).convert('RGB').resize((4*S,4*S),Image.LANCZOS)
top=Image.new('RGB',(4*S,4*S),(255,0,255)); top.paste(im.crop((0,0,4*S,S)),(0,0))
# idle row → idle-format sheet (4 views in rows, col 0)
idle_edit=Image.new('RGB',(4*S,4*S),(255,0,255))
for v in range(4): 
  for c in range(4): idle_edit.paste(im.crop((v*S,0,(v+1)*S,S)),(c*S,v*S))
idle_edit.save('/tmp/claude-0/cos/m_idle.png')
pose=Image.new('RGB',(4*S,3*S)); pose.paste(im.crop((0,S,4*S,4*S)),(0,0)); pose.save('/tmp/claude-0/cos/m_pose.png')
PY
PMASK=/tmp/claude-0/cos/idle4_m.png python3 extract.py idle4.png m_idle.png "lay_$2.png" 352 352 >/dev/null
python3 bake.py "lay_$2.png" "$2" >/dev/null
MREP=1 python3 bake_poses.py "$2" m_pose.png
python3 - "$2" <<'PY'
import json,sys
p='/home/claude/god-of-legacy/src/data/cosmetics.json'; D=json.load(open(p))
for x in D['classes']['warrior']:
  if x['id']==sys.argv[1]: x['layers']=f"assets/final/cosmetics/warrior/{x['id']}/layers"; x.pop('wip',None)
json.dump(D,open(p,'w'),indent=1)
PY
echo "added $2"
