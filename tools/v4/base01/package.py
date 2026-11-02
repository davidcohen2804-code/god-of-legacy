"""The importer package (Equipment Factory contract): one manifest and the preview renders of every item.

Usage: python3 package.py <build out dir> <preview renders dir> <package dir>
Reads the exporter's parts.json (items, report, versions) and catalog.csv (profiles), and the full-canvas renders made
by previews.mjs; writes <package>/manifest.json, <package>/previews/<id>_600.png and _150.png, and
<package>/previews.png (every item at both sizes with its checks, for review).
"""
import csv, json, os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = 'base01-package/1'
CATALOG_SCHEMA = 2      # id, slot, profile, body, name, picture; a weapon's profile is its motion kit


def catalog_rows():
    path = os.environ.get('B01_CATALOG') or os.path.join(HERE, 'catalog.csv')
    rows = csv.DictReader(l for l in open(path) if l.strip() and not l.lstrip().startswith('#'))
    return {r['id'].strip(): {k.strip(): (v or '').strip() for k, v in r.items()} for r in rows}


def warnings(r):
    """The exporter's measurements a reviewer should know about, in plain words."""
    w = []
    if r.get('helmet_scale', 1) > 1: w.append(f"full helmet enlarged {round((r['helmet_scale'] - 1) * 100)}% about the neck")
    if r.get('tails_px'): w.append('split coat: two tail panels on the hips, with follow-through')
    if r.get('light_outline'): w.append('light garment: dark outline and deeper folds added')
    if r.get('skin_halo_px', 0) >= 300: w.append(f"{r['skin_halo_px']} px of skin along the edges returned to the body")
    for s, v in (r.get('sleeve_reach') or {}).items():
        if v < 0.35: w.append(f'sleeve {s} reaches {v:.2f} of the upper arm: drawn on the torso, not bent with the arm')
    if 'face_lines' in r and r.get('face_covered', 1) < 0.6: w.append(f"face checked by its drawn lines: {r['face_lines']:.2f} (0.5 needed)")
    if r.get('leg_width', 1) >= 1.15: w.append(f"loose trousers ({r['leg_width']:.2f} of the leg): drawn over the boots")
    cov = r.get('coverage') or {}
    part = [k for k, v in cov.items() if 0.3 <= v < 0.85]
    if part: w.append('partly covered (the bare body shows under it): ' + ', '.join(part))
    return w


def main(build, renders, pkg):
    P = json.load(open(os.path.join(build, 'parts.json')))
    cat = catalog_rows()
    boxes = {int(k): v for k, v in json.load(open(os.path.join(renders, 'boxes.json'))).items()}
    os.makedirs(os.path.join(pkg, 'previews'), exist_ok=True)
    report = {r['id']: r for r in P['report']}
    items = []
    for it in P['items']:
        r = report.get(it['id'], {})
        row = cat.get(it['id'], {})
        prev = {}
        full = os.path.join(renders, f"{it['id']}_full.png")
        if os.path.exists(full):
            im = Image.open(full).convert('RGB')
            for size, box in boxes.items():
                name = f"previews/{it['id']}_{size}.png"
                im.crop(tuple(box)).save(os.path.join(pkg, name))
                prev[str(size)] = name
        items.append({
            'id': it['id'], 'name': it['name'], 'slot': it['slot'], 'profile': row.get('profile') or ('base' if it['slot'] == 'body' else None),
            'motion': it.get('motion'), 'source': {'picture': row.get('picture'), 'sha1': P['versions']['sources'].get(it['id'])},
            'parts': [{'part': p['part'], 'frame': p['frame'], 'size': [P['frames'].get(p['frame'], {}).get('w'), P['frames'].get(p['frame'], {}).get('h')], 'anchor': P['frames'].get(p['frame'], {}).get('pivot')} for p in it['parts']],
            'covers': it.get('covers', []), 'loose': it.get('loose', False),
            'checks': {k: v for k, v in r.items() if k not in ('id',)}, 'warnings': warnings(r), 'previews': prev,
        })
    rejected = [r for r in P['report'] if not r.get('accepted')]
    manifest = {'schema': SCHEMA, 'catalogSchema': CATALOG_SCHEMA, 'body': 'base01', 'versions': {k: v for k, v in P['versions'].items() if k != 'sources'},
                'items': items, 'rejected': [{'id': r['id'], 'reason': r.get('reason')} for r in rejected]}
    json.dump(manifest, open(os.path.join(pkg, 'manifest.json'), 'w'), indent=1, default=float)
    # review sheet: each item at 600 px (shown at half size) and at 150 px (1:1), with its checks
    F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
    w6, h6 = [(b[2] - b[0]) // 2 for b in [boxes[600]]][0], [(b[3] - b[1]) // 2 for b in [boxes[600]]][0]
    w1, h1 = boxes[150][2] - boxes[150][0], boxes[150][3] - boxes[150][1]
    cw, ch = w6 + w1 + 12, max(h6, h1) + 78
    cols = 3
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch + 34), (12, 16, 23))
    d = ImageDraw.Draw(sheet)
    v = manifest['versions']
    d.text((10, 8), f"BASE-01 package ({SCHEMA}; template {v.get('template')}, exporter {v.get('exporter')}): every item worn alone, 600 px (shown at half) and 150 px 1:1", fill=(226, 180, 92), font=F)
    for n, it in enumerate(items):
        x, y = (n % cols) * cw, 34 + (n // cols) * ch
        if it['previews']:
            a = Image.open(os.path.join(pkg, it['previews']['600'])).resize((w6, h6), Image.LANCZOS)
            b = Image.open(os.path.join(pkg, it['previews']['150']))
            sheet.paste(a, (x, y + 56)); sheet.paste(b, (x + w6 + 6, y + 56 + (h6 - h1) // 2))
        ok = it['checks'].get('accepted', True)
        d.text((x + 6, y + 4), f"{it['id']}  ({it['slot']}, {it['profile']}{', ' + it['motion'] if it.get('motion') and it['motion'] != it['profile'] else ''})", fill=(236, 229, 214), font=F)
        msg = ('accepted' if ok else 'REJECTED') + ('; ' + '; '.join(it['warnings']) if it['warnings'] else '')
        for k, line in enumerate(textwrap.wrap(msg, 98)[:2]):
            d.text((x + 6, y + 22 + 15 * k), line, fill=(116, 199, 147) if ok else (234, 127, 102), font=f)
    sheet.save(os.path.join(pkg, 'previews.png'))
    print('package', pkg, len(items), 'items', len(rejected), 'rejected')


if __name__ == '__main__':
    main(*sys.argv[1:4])
