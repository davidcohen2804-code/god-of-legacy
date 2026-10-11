#!/usr/bin/env python3
"""Turn a PixVerse green-screen clip into painted motion frames for tools/heroes/motion/<cls>/.

  integrate.py loop  <cls> <act> <video.mp4> [--start N] [--period N] [--face PX]
      a looping cycle (walk / run): keys every frame, finds the cycle period on the legs, cuts one cycle from
      the first contact frame, scales so the face matches the hero's idle face, feet on y=700, hips at x=384.
  integrate.py hits  <cls> <video.mp4> --plan 'hurt:21,24,27,30,33,36;launched:81,84,87,90,93,96;...'
      the hit states from the 8 s wide-shot clip (frame numbers are 0-based video frames).
Scale is by the face width (idle_01 of the hero vs the clip), the most stable size cue across poses.
"""
import sys, os, glob, json, argparse, subprocess, tempfile, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gkey import key

ROOT = '/home/claude/god-of-legacy'

def face_w(a):
    im = a.astype(int); r, g, b, al = [im[..., i] for i in range(4)]
    m = (al > 128) & (r > 150) & (g > 100) & (b > 80) & (r > g) & (g > b) & (r - b > 40) & (r - b < 140)
    lab, k = ndimage.label(m)
    if k == 0: return None
    sz = ndimage.sum(m, lab, range(1, k + 1)); i = int(np.argmax(sz)) + 1; ys, xs = np.where(lab == i)
    return xs.max() - xs.min()

def largest(a):
    m = a[..., 3] > 40; lab, k = ndimage.label(m)
    if k <= 1: return a
    sz = ndimage.sum(m, lab, range(1, k + 1)); keep = lab == (int(np.argmax(sz)) + 1)
    a = a.copy(); a[..., 3] = np.where(keep, a[..., 3], 0); return a

def key_video(video, workdir):
    os.makedirs(workdir, exist_ok=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', video, f'{workdir}/f_%03d.png'], check=True)
    fs = sorted(glob.glob(f'{workdir}/f_*.png'))
    from concurrent.futures import ProcessPoolExecutor
    with ProcessPoolExecutor(8) as ex: keyed = list(ex.map(key, fs))
    return [largest(a) for a in keyed]

def place(a, S, cx, bottom, out):
    im = Image.fromarray(a); im = im.resize((max(1, round(im.width * S)), max(1, round(im.height * S))), Image.LANCZOS)
    C = Image.new('RGBA', (768, 768), (0, 0, 0, 0)); C.paste(im, (round(384 - cx * S), round(700 - bottom * S)), im); C.save(out)

def hip_x(m):
    ys = np.where(m.any(1))[0]; t, b = ys[0], ys[-1]; band = m[t + int((b - t) * 0.35):t + int((b - t) * 0.55)]
    xs = np.where(band)[1]; return xs.mean() if len(xs) else np.where(m)[1].mean()

def hero_face(cls):
    """The face width at the motion canvas scale (standing height 509 px): from the painted idle when the hero has
    one, else from the green reference picture scaled to that height."""
    p = f'{ROOT}/tools/heroes/motion/{cls}/idle_01.png'
    if os.path.exists(p): return face_w(np.array(Image.open(p).convert('RGBA')))
    ref = f'{os.path.dirname(os.path.abspath(__file__))}/../refs/{cls}_green.jpg'
    a = np.array(Image.open(ref).convert('RGB')); m = ~((a[..., 1] > 180) & (a[..., 0] < 110) & (a[..., 2] < 110))
    ys = np.where(m.any(1))[0]; h = ys[-1] - ys[0]; S = 509 / h
    rgba = np.dstack([a, (m * 255).astype(np.uint8)]); im = Image.fromarray(rgba).resize((round(a.shape[1] * S), round(a.shape[0] * S)), Image.LANCZOS)
    return face_w(np.array(im))

def cmd_loop(args):
    out = f'{ROOT}/tools/heroes/motion/{args.cls}'
    A = key_video(args.video, tempfile.mkdtemp())
    masks = [a[..., 3] > 128 for a in A]
    ys = [np.where(m.any(1))[0] for m in masks]; top = min(y[0] for y in ys); bot = max(y[-1] for y in ys); h = bot - top
    L = [m[top + int(h * 0.55):bot + 1] for m in masks]; n = len(L)
    if args.period: period = args.period
    else:
        best = sorted((np.mean([(L[i] ^ L[i + p]).sum() / max(1, (L[i] | L[i + p]).sum()) for i in range(0, n - p)]), p) for p in range(8, 60))
        half = best[0][1]; period = half * 2 if args.act == 'run' else half  # the XOR metric finds the half cycle for a run (mirrored legs)
        # walk: the legs differ enough (sword side) that the full cycle usually wins; take the best p whose double is not also a strong minimum
        if args.act == 'walk':
            cands = [p for d, p in best[:6]]; period = max(cands) if max(cands) < 1.5 * min(cands) * 2 else best[0][1]
    bottoms = [int(y[-1]) for y in ys]
    start = args.start if args.start is not None else int(np.argmax([bottoms[i] for i in range(0, 12)]))
    idx = list(range(start, start + period))
    ground = max(bottoms[i] for i in idx)
    y0 = np.where(masks[0].any(1))[0]; S = 509.0 / (y0[-1] - y0[0]) * (args.scale or 1.0)  # frame 0 = the standing reference pose
    hx = np.mean([hip_x(masks[i]) for i in idx])
    bk = f'{os.path.dirname(os.path.abspath(__file__))}/{args.cls}_{args.act}_prev'; os.makedirs(bk, exist_ok=True)
    for f in glob.glob(f'{out}/{args.act}_[0-9]*.png'): shutil.move(f, f'{bk}/{os.path.basename(f)}')
    for k, i in enumerate(idx, 1): place(A[i], S, hx, ground, f'{out}/{args.act}_{k:02d}.png')
    mj = f'{out}/motion.json'; m = json.load(open(mj)) if os.path.exists(mj) else {'canvas': [768, 768], 'ground_y': 700, 'hip_x': 384, 'animations': {}}
    m['animations'][args.act] = {'frames': period, 'source': f'pixverse {os.path.basename(args.video)}'}
    if args.cycle: m['animations'][args.act]['cycle_canvas'] = args.cycle
    json.dump(m, open(mj, 'w'), indent=2)
    print(args.cls, args.act, 'period', period, 'start', start, 'scale', round(S, 3), 'ground', ground)

def cmd_hits(args):
    out = f'{ROOT}/tools/heroes/motion/{args.cls}'
    A = key_video(args.video, tempfile.mkdtemp())
    masks = [a[..., 3] > 128 for a in A]
    y0 = np.where(masks[0].any(1))[0]; S = 509.0 / (y0[-1] - y0[0]) * (args.scale or 1.0); G = int(y0[-1])
    plan = {p.split(':')[0]: [int(x) for x in p.split(':')[1].split(',')] for p in args.plan.split(';')}
    for act, idx in plan.items():
        for f in glob.glob(f'{out}/{act}_[0-9]*.png'): os.remove(f)
        for n, i in enumerate(idx, 1):
            m = masks[i]; ys, xs = np.where(m)
            lying = act in ('down', 'down_impact') or (act == 'getup' and n <= 3)
            cx = (xs.min() + xs.max()) / 2 if lying else hip_x(m)
            place(A[i], S, cx, min(ys.max(), G + 8), f'{out}/{act}_{n:02d}.png')
    mj = f'{out}/motion.json'; m = json.load(open(mj))
    ms = {'hurt': [50, 50, 60, 60, 80, 100], 'launched': [60, 60, 70, 70, 80, 80], 'down_impact': [60, 80, 120], 'down': [400, 400], 'getup': [90] * 7, 'stance': [500]}
    for act, idx in plan.items():
        m['animations'][act] = {'frames': len(idx), 'loop': act == 'down', 'frame_ms': (ms.get(act) or [80] * len(idx))[:len(idx)]}
    m['hit_source'] = f'pixverse {os.path.basename(args.video)}'; json.dump(m, open(mj, 'w'), indent=2)
    print(args.cls, 'hits', {k: len(v) for k, v in plan.items()}, 'scale', round(S, 3))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd')
    a = sub.add_parser('loop'); a.add_argument('cls'); a.add_argument('act'); a.add_argument('video'); a.add_argument('--start', type=int); a.add_argument('--period', type=int); a.add_argument('--scale', type=float); a.add_argument('--cycle', type=float)
    b = sub.add_parser('hits'); b.add_argument('cls'); b.add_argument('video'); b.add_argument('--plan', required=True); b.add_argument('--scale', type=float)
    args = ap.parse_args(); {'loop': cmd_loop, 'hits': cmd_hits}[args.cmd](args)
