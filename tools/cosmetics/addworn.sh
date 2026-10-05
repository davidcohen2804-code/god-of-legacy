# addworn.sh <gpt_image> <item_id>   — extract from the idle "wearing" sheet, bake into every warrior sheet, quantize, register
set -e
cd /tmp/claude-0/cos
python3 extract.py idle4.png "$1" "lay_$2.png" 352 352 >/dev/null
python3 bake.py "lay_$2.png" "$2" >/dev/null
D=/home/claude/god-of-legacy/public/assets/final/cosmetics/warrior/$2/layers
for f in $D/*.png; do python3 -c "
import sys; from PIL import Image
im=Image.open(sys.argv[1]).convert('RGBA'); im.quantize(colors=255,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(sys.argv[1],optimize=True)" $f; done
python3 - "$2" <<'PY'
import json,sys
p='/home/claude/god-of-legacy/src/data/cosmetics.json'; D=json.load(open(p))
for x in D['classes']['warrior']:
  if x['id']==sys.argv[1]: x['layers']=f"assets/final/cosmetics/warrior/{x['id']}/layers"; x.pop('wip',None)
json.dump(D,open(p,'w'),indent=1)
PY
echo "added $2 $(du -sh $D | cut -f1)"
