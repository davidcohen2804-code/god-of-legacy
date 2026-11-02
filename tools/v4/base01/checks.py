# BASE-01's pipeline checks (the art director's Gate 5 plan, before 500+ items):
#   R14 source integrity: the template and the master the build used are the ones in the repository; every catalog
#       row's picture exists at the master's size and is the very file the build cut (its checksum); what was packed
#       for the game (the atlas page and its data) is exactly what the build generated, frame by frame and pixel by
#       pixel; the atlas holds every accepted item's pieces and nothing of a rejected one; the package manifest names the
#       same sources.
#   R16 failure isolation: a rejected source changes nothing that was accepted: the same catalog built with every
#       negative fixture mixed in (build B) against the catalog alone (build A): every accepted item's pieces identical
#       (pixels and data), its report identical, the packed atlas page identical, and no piece of a rejected source
#       anywhere.
# (R15, visual regression against approved fixtures, is the lab's job: renders, not files.)
#
# Usage: python3 checks.py r14 <build> [assets dir] [package dir]
#        python3 checks.py r16 <build A> <build B>
# Prints PASS or FAIL per check with what it measured; exits 1 when one fails.
import hashlib, json, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../..'))


def sha1(path): return hashlib.sha1(open(path, 'rb').read()).hexdigest()[:12]


def catalog(path=None):
    import csv
    path = path or os.path.join(HERE, 'catalog.csv')
    rows = csv.DictReader(l for l in open(path) if l.strip() and not l.lstrip().startswith('#'))
    return [{k.strip(): (v or '').strip() for k, v in r.items()} for r in rows]


def frame_png(build, name):
    return np.asarray(Image.open(os.path.join(build, name + '.png')).convert('RGBA'))


RESULTS = []


def check(cid, name, ok, detail):
    RESULTS.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} {cid} {name}\n     {detail}")


def r14(build, assets=None, package=None):
    assets = assets or os.path.join(REPO, 'src/v4/base01/assets')
    package = package or os.path.join(HERE, 'package')
    T = json.load(open(os.path.join(HERE, 'template.json')))
    P = json.load(open(os.path.join(build, 'parts.json')))
    V = P.get('versions', {})
    # the template and the master
    bad = []
    if V.get('template') != T.get('version', T['id']): bad.append(f"template {V.get('template')} (repository {T.get('version')})")
    if V.get('master') != sha1(os.path.join(HERE, T['master'])): bad.append(f"master {V.get('master')} (repository {sha1(os.path.join(HERE, T['master']))})")
    check('R14a', 'The build used the repository\'s template and master', not bad, '; '.join(bad) or f"template {V.get('template')}, master {V.get('master')}, exporter {V.get('exporter')}")
    # every catalog row's picture: present, the master's size, the very file the build cut
    bad, n = [], 0
    rows = catalog()
    for r in rows:
        if r.get('body', 'base01') != T['id']: continue
        n += 1
        pic = r['picture'] if os.path.isabs(r['picture']) else os.path.join(HERE, r['picture'])
        if not os.path.exists(pic): bad.append(f"{r['id']}: no picture"); continue
        if r['slot'] != 'weapon':
            size = list(Image.open(pic).size)
            if size != list(T['size']): bad.append(f"{r['id']}: {size[0]} x {size[1]} px (the master is {T['size'][0]} x {T['size'][1]})")
        want = V.get('sources', {}).get(r['id'])
        if want is None: bad.append(f"{r['id']}: not in the build")
        elif want != sha1(pic): bad.append(f"{r['id']}: the picture changed since the build ({sha1(pic)}, built from {want})")
    check('R14b', 'Every catalog row\'s picture: present, at the master\'s size, the very file the build cut', not bad, '; '.join(bad[:6]) or f"{n} rows")
    # the packed atlas: exactly what the build generated
    A = json.load(open(os.path.join(assets, 'base01.json')))
    page = np.asarray(Image.open(os.path.join(assets, 'base01.png')).convert('RGBA'))
    bad = []
    names_b, names_a = set(P['frames']), {f['name'] for f in A['frames']}
    if names_a != names_b: bad.append(f"frames only packed: {sorted(names_a - names_b)[:4]}, only built: {sorted(names_b - names_a)[:4]}")
    for f in A['frames']:
        meta = P['frames'].get(f['name'])
        if not meta: continue
        if [f['w'], f['h']] != [meta['w'], meta['h']]: bad.append(f"{f['name']}: packed {f['w']} x {f['h']}, built {meta['w']} x {meta['h']}"); continue
        if abs(f['px'] * f['w'] - meta['pivot'][0]) > 0.01 or abs(f['py'] * f['h'] - meta['pivot'][1]) > 0.01: bad.append(f"{f['name']}: pivot")
        for k in ('rows', 'skirt'):
            if f.get(k) != meta.get(k): bad.append(f"{f['name']}: {k}")
        region = page[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']]
        src = frame_png(build, f['name'])
        # (the page keeps straight alpha; fully transparent pixels may carry any colour)
        diff = np.abs(region.astype(int) - src.astype(int))
        diff[(region[..., 3] == 0) & (src[..., 3] == 0)] = 0
        if diff.max() > 0: bad.append(f"{f['name']}: the atlas differs from the build by up to {diff.max()} in {int((diff.max(2) > 0).sum())} px")
    check('R14c', 'The game\'s atlas is exactly what the build generated: every frame, its size, anchor, data and pixels', not bad, '; '.join(bad[:6]) or f"{len(A['frames'])} frames on a {page.shape[1]} x {page.shape[0]} page, pixel-identical")
    # the atlas's items: every accepted one, nothing of a rejected one
    acc = {r['id'] for r in P['report'] if r.get('accepted')}
    rej = {r['id'] for r in P['report'] if not r.get('accepted')}
    items_a = {it['id'] for it in A['items']} - {'base01_body'}
    bad = []
    if items_a != acc: bad.append(f"packed but not accepted: {sorted(items_a - acc)}; accepted but not packed: {sorted(acc - items_a)}")
    leak = [n for n in names_a if n.split('/')[0] in rej]
    if leak: bad.append(f"pieces of rejected sources: {leak[:4]}")
    for it in A['items']:
        for p in it['parts']:
            if p['frame'] not in names_a: bad.append(f"{it['id']}: no frame {p['frame']}")
    check('R14d', 'The atlas holds every accepted item\'s pieces and nothing of a rejected source', not bad, '; '.join(bad[:6]) or f"{len(items_a)} accepted items, {len(rej)} rejected, no stray piece")
    # the package manifest names the same sources and versions
    mpath = os.path.join(package, 'manifest.json')
    if os.path.exists(mpath):
        M = json.load(open(mpath))
        bad = []
        for k in ('template', 'exporter', 'master'):
            if M['versions'].get(k) != V.get(k): bad.append(f"{k}: manifest {M['versions'].get(k)}, build {V.get(k)}")
        for it in M['items']:
            if it['id'] == 'base01_body': continue
            if it['source']['sha1'] != V.get('sources', {}).get(it['id']): bad.append(f"{it['id']}: manifest source {it['source']['sha1']}")
        check('R14e', 'The package manifest names the build\'s versions and sources', not bad, '; '.join(bad[:6]) or f"{len(M['items'])} items")


def pack(build):
    out = tempfile.mkdtemp(prefix='r16pack_', dir=os.path.dirname(os.path.abspath(build)))
    subprocess.run([sys.executable, os.path.join(HERE, 'pack.py'), build, out], check=True, capture_output=True)
    return out


def r16(a, b):
    PA, PB = json.load(open(os.path.join(a, 'parts.json'))), json.load(open(os.path.join(b, 'parts.json')))
    accA = {r['id'] for r in PA['report'] if r.get('accepted')}
    accB = {r['id'] for r in PB['report'] if r.get('accepted')}
    rejB = {r['id'] for r in PB['report'] if not r.get('accepted')}
    neg = {r['id'] for r in catalog(os.path.join(HERE, 'catalog_negative.csv'))}
    bad = []
    if accB - accA - neg: bad.append(f"accepted only with the bad sources mixed in: {sorted(accB - accA - neg)}")
    if accA - accB: bad.append(f"accepted alone, refused with the bad sources mixed in: {sorted(accA - accB)}")
    check('R16a', 'The same items are accepted with every negative fixture mixed into the catalog', not bad, '; '.join(bad) or f"{len(accA)} accepted either way; mixed in: {len(neg)} fixtures, {len(rejB)} rejected ({len(neg) - len(rejB)} accepted on purpose: {sorted(accB & neg)})")
    # every accepted item's pieces and report, identical
    bad, frames = [], 0
    ia = {it['id']: it for it in PA['items']}; ib = {it['id']: it for it in PB['items']}
    ra = {r['id']: r for r in PA['report']}; rb = {r['id']: r for r in PB['report']}
    for i in sorted(accA & accB):
        if ia.get(i) != ib.get(i): bad.append(f"{i}: its pieces or coverage differ")
        if ra.get(i) != rb.get(i): bad.append(f"{i}: its checks differ")
        for p in (ia.get(i) or {}).get('parts', []):
            n = p['frame']; frames += 1
            if PA['frames'].get(n) != PB['frames'].get(n): bad.append(f"{n}: data"); continue
            if not np.array_equal(frame_png(a, n), frame_png(b, n)): bad.append(f"{n}: pixels")
    for n in ('base',):
        for f in [f for f in PA['frames'] if f.startswith('base/')]:
            frames += 1
            if PA['frames'][f] != PB['frames'].get(f) or not np.array_equal(frame_png(a, f), frame_png(b, f)): bad.append(f"{f}: the body differs")
    check('R16b', 'Every accepted item\'s pieces (pixels and data) and checks are identical with the bad sources mixed in', not bad, '; '.join(bad[:6]) or f"{frames} frames and {len(accA & accB)} reports identical")
    # nothing of a rejected source, and every accepted item's pieces on the packed atlas identical (the page may place
    # them elsewhere when a fixture accepted on purpose adds pieces of its own)
    leak = [n for n in PB['frames'] if n.split('/')[0] in rejB]
    pa, pb = pack(a), pack(b)
    ja, jb = json.load(open(os.path.join(pa, 'base01.json'))), json.load(open(os.path.join(pb, 'base01.json')))
    ima, imb = np.asarray(Image.open(os.path.join(pa, 'base01.png')).convert('RGBA')), np.asarray(Image.open(os.path.join(pb, 'base01.png')).convert('RGBA'))
    fb = {f['name']: f for f in jb['frames']}
    detail = [f"pieces of rejected sources: {leak[:4]}"] if leak else []
    packed_leak = [f['name'] for f in jb['frames'] if f['name'].split('/')[0] in rejB]
    if packed_leak: detail.append(f"rejected pieces on the atlas: {packed_leak[:4]}")
    extra = sorted({f['name'].split('/')[0] for f in jb['frames']} - {f['name'].split('/')[0] for f in ja['frames']})
    if set(extra) - neg: detail.append(f"other pieces on the atlas: {extra}")
    for f in ja['frames']:
        g = fb.get(f['name'])
        if g is None: detail.append(f"{f['name']}: missing"); continue
        if {k: v for k, v in f.items() if k not in ('x', 'y')} != {k: v for k, v in g.items() if k not in ('x', 'y')}: detail.append(f"{f['name']}: data"); continue
        ra_ = ima[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']]; rb_ = imb[g['y']:g['y'] + g['h'], g['x']:g['x'] + g['w']]
        if not np.array_equal(ra_, rb_): detail.append(f"{f['name']}: pixels")
    if ja['rig'] != jb['rig']: detail.append('the rig differs')
    ib_ = {it['id']: it for it in jb['items']}
    for it in ja['items']:
        if ib_.get(it['id']) != it: detail.append(f"{it['id']}: its packed entry differs")
    shutil.rmtree(pa, ignore_errors=True); shutil.rmtree(pb, ignore_errors=True)
    check('R16c', 'No piece of a rejected source anywhere; every accepted item packed identically (data and pixels)', not detail, '; '.join(detail[:6]) or f"{len(ja['frames'])} frames and {len(ja['items'])} items identical on the atlas; fixtures accepted on purpose add only their own pieces ({', '.join(extra) or 'none'})")

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'r14': r14(*sys.argv[2:5])
    elif cmd == 'r16': r16(sys.argv[2], sys.argv[3])
    else: raise SystemExit(f'unknown check {cmd}')
    sys.exit(0 if all(RESULTS) else 1)
