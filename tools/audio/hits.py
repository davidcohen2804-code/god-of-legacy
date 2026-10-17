#!/usr/bin/env python3
"""The blows themselves: every damaging hit in the arena lands with one of these under its skill's own sound — per class
and per weight (light: a basic blow or a burst's small one, medium: a skill's blow, heavy: the main hit). The aim is the
crunch and weight of the arcade brawlers David plays (inspiration only, nothing taken from them): a hit is layered —

  the crack     the contact: a bright transient a millisecond or two long (a heavy blow cracks twice)
  the body      the punch: a short falling thump and the slap of the blow in the middle of the spectrum
  the crunch    a noise burst driven into hard saturation and decimated — the gritty bite that makes it sound hard
  the material  the class's own: the greatsword's steel cleaving (warrior), the katana's slice and ring (samurai), an
                arrow's thunk in wood and flesh (archer), an arcane crack, zap and sparkle (book mage), the staff's wooden
                TOK and a card's slap (gambler)
  the tail      the decay: dust and grit, longer and lower the heavier the blow

Three takes of each (a blow never repeats exactly). Written as imp_<class>_<l|m|h>_<1..3> (.ogg + .mp3) into
public/assets/audio/sfx/; ArenaSound plays them under each skill's own hit (Sound.ts: SFX imp_*).

    python3 tools/audio/hits.py [wr sm ar bm gb]     (needs numpy, scipy, ffmpeg)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from impacts import SR, bp, brown, env, finish, hp, lp, write  # noqa: E402
from signatures import T, arc, bell, buf, click, crackle_kernels, grains, knock, place, ring, rustle, swoosh, thud  # noqa: E402

R = np.random.default_rng

# per weight: length, the body's thump (from, to, decay), the slap's band and decay, the crunch (decay, drive, hold), the tail
W = {
    'l': dict(dur=0.26, body=(215, 115, 0.032), bamp=0.55, slap=(800, 3400, 0.011), samp=0.85, crunch=(0.008, 5.0, 2), camp=0.5, tail=0.045, tamp=0.18, k=0.62),
    'm': dict(dur=0.42, body=(175, 68, 0.06), bamp=0.9, slap=(550, 3000, 0.019), samp=1.0, crunch=(0.016, 6.5, 3), camp=0.72, tail=0.085, tamp=0.32, k=0.85),
    'h': dict(dur=0.8, body=(145, 44, 0.13), bamp=1.25, slap=(380, 2600, 0.03), samp=1.1, crunch=(0.034, 8.0, 3), camp=1.0, tail=0.19, tamp=0.6, k=1.0),
}


def crunch(rng, dur, lo, hi, tau, drive, hold):
    """The bite: band noise slammed into saturation, then held every few samples (its aliasing is the grit)."""
    t = T(dur)
    n = bp(rng.standard_normal(t.size), lo, hi) * env(t, 0.0004, tau)
    n = np.tanh(drive * n / (np.abs(n).max() + 1e-9))
    if hold > 1:
        n = n[(np.arange(t.size) // hold) * hold]
    return n * env(t, 0.0004, tau * 1.4)


def blow(rng, w):
    """The common layers: crack, body, slap, crunch, tail."""
    p = W[w]; dur = p['dur']; t = T(dur); x = buf(dur)
    place(x, click(0.03, rng, rng.uniform(2000, 2800), 0.0011 if w != 'h' else 0.0016, 1.0), 0)
    if w == 'h':
        place(x, click(0.03, rng, 1800, 0.0014, 0.75), 0.007)  # (a heavy blow cracks twice)
    f0, f1, tau = p['body']
    x += thud(dur, f0 * rng.uniform(0.95, 1.05), f1, tau, 0.025) * p['bamp']
    lo, hi, st = p['slap']
    x += bp(rng.standard_normal(t.size), lo, hi) * env(t, 0.0007, st) * p['samp']
    ct, drive, hold = p['crunch']
    place(x, crunch(rng, ct * 6, 300, 4200, ct, drive, hold), 0.0015, p['camp'])
    tl = lp(rng.standard_normal(t.size), 1600 if w != 'h' else 1100) * env(t, 0.004, p['tail']) * p['tamp']
    if w == 'h':
        tl += lp(brown(t.size, rng), 160) * env(t, 0.01, 0.22) * 0.8  # (the floor taking it)
    x += tl
    n = {'l': 4, 'm': 8, 'h': 16}[w]
    times = np.minimum(0.01 + rng.exponential(p['tail'] * 0.6, n), p['tail'] * 1.6)  # (all close behind the blow: a stray one late reads as a glitch)
    x += grains(t.size, times, rng.uniform(0.1, 0.3, n) * p['k'], crackle_kernels(rng, 2600, (0.0005, 0.001)), rng)  # (grit)
    return x


# ---------------------------------------------------------------- the materials

def steel(rng, w):  # the warrior's greatsword cleaving in: a short clang of heavy steel, the chunk of the cut, armour rattling
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    f = {'l': 1150, 'm': 900, 'h': 680}[w] * rng.uniform(0.96, 1.04); tau = {'l': 0.045, 'm': 0.085, 'h': 0.16}[w]
    place(x, ring(dur, f, [(1, 0.5, tau), (1.53, 0.42, tau * 0.7), (2.41, 0.3, tau * 0.5), (3.72, 0.2, tau * 0.3)], rng, beat=0.004), 0, 0.42 * k)
    t = T(0.12); place(x, bp(rng.standard_normal(t.size), 180, 900) * env(t, 0.001, 0.03), 0.002, 0.7 * k)  # (the chunk)
    if w == 'h':
        place(x, ring(dur, 420, [(1, 0.5, 0.25), (1.62, 0.35, 0.16), (2.31, 0.25, 0.1)], rng, beat=0.003), 0.004, 0.35)  # (the clang under it)
    n = {'l': 3, 'm': 5, 'h': 9}[w]
    for _ in range(n):  # (armour rattling)
        place(x, ring(0.05, rng.uniform(2600, 4200), [(1, 0.4, 0.012), (1.47, 0.25, 0.008)], rng), min(0.09, 0.012 + rng.exponential(0.025)), 0.12 * k)
    return x


def katana(rng, w):  # the samurai's katana: the slice going through (shk), its thin ring; a heavy cut adds the deep zan
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    place(x, swoosh(0.045, 3200, 9500, 7000, rng, peak=0.25, q=3.0, tail=5), 0, 0.75 * k)
    f = {'l': 5200, 'm': 4600, 'h': 3900}[w] * rng.uniform(0.97, 1.03); tau = {'l': 0.05, 'm': 0.09, 'h': 0.16}[w]
    place(x, ring(dur, f, [(1, 0.45, tau), (1.38, 0.3, tau * 0.6), (2.06, 0.18, tau * 0.35)], rng, beat=0.005), 0.003, 0.28 * k)
    if w != 'l':
        t = T(0.14); z = lp(rng.standard_normal(t.size), 2400) * env(t, 0.002, 0.04)
        place(x, z, 0.004, 0.55 if w == 'h' else 0.3)  # (zan)
    if w == 'h':
        t = T(0.2); place(x, hp(rng.standard_normal(t.size), 600) * env(t, 0.002, 0.05) * np.exp(-t / 0.08), 0.01, 0.35)  # (the spray)
    return x


def arrowhead(rng, w):  # the archer's arrow (or boot) going in: a wooden thunk, the shaft's shudder, splinters
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    t = T(dur)
    place(x, knock(dur, {'l': 760, 'm': 640, 'h': 520}[w] * rng.uniform(0.95, 1.05), {'l': 0.012, 'm': 0.018, 'h': 0.026}[w], rng, 0.9), 0, 0.8 * k)
    sh = np.sin(2 * np.pi * np.cumsum(185 * (1 + 0.06 * np.sin(2 * np.pi * 28 * t))) / SR) * env(t, 0.003, {'l': 0.04, 'm': 0.07, 'h': 0.12}[w])
    x += sh * 0.35 * k  # (the shaft shuddering)
    n = {'l': 4, 'm': 7, 'h': 14}[w]
    x += grains(t.size, np.minimum(0.004 + rng.exponential(0.025, n), 0.09), rng.uniform(0.2, 0.5, n) * k, [knock(0.03, f, 0.005, rng, 0.6) for f in (900, 1300, 1700)], rng)  # (splinters)
    if w == 'h':
        place(x, rustle(0.3, rng, 450, 2500, 9000, 0.35) * env(T(0.3), 0.005, 0.08), 0.004)  # (leaves)
    return x


def arcane(rng, w):  # the book mage's spell biting: a crystalline crack, the zap of it, sparkles; a heavy one bursts in a chord
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    f = {'l': 2600, 'm': 2200, 'h': 1800}[w] * rng.uniform(0.96, 1.04)
    place(x, bell(dur, f, ratio=2.76, index=3.5, tau={'l': 0.04, 'm': 0.07, 'h': 0.12}[w], itau=0.02), 0, 0.35 * k)
    zd = {'l': 0.03, 'm': 0.05, 'h': 0.08}[w]
    place(x, arc(zd, rng, f=rng.uniform(110, 160), jit=0.5) * env(T(zd), 0.001, zd * 0.4), 0.002, 0.45 * k)
    for i in range({'l': 2, 'm': 4, 'h': 7}[w]):
        place(x, bell(0.18, rng.uniform(3500, 7500), ratio=2.0, index=0.8, tau=0.04), 0.01 + rng.uniform(0, 0.07), 0.1 * k)
    if w == 'h':
        t = T(dur); x += sum(np.sin(2 * np.pi * fr * t + i) for i, fr in enumerate((880.0, 1108.7, 1318.5))) * env(t, 0.004, 0.16) * 0.09
    return x


def staff(rng, w):  # the gambler's staff (or a card): the wooden TOK, the card's slap, chips; a heavy one a bat's crack
    p = W[w]; dur = p['dur']; x = buf(dur); k = p['k']
    place(x, knock(dur, {'l': 720, 'm': 610, 'h': 470}[w] * rng.uniform(0.95, 1.05), {'l': 0.02, 'm': 0.03, 'h': 0.045}[w], rng, 1.0), 0, 0.85 * k)
    place(x, hp(rng.standard_normal(T(0.02).size), 3200) * env(T(0.02), 0.0002, 0.003), 0.001, 0.5 * k)  # (a card's slap)
    n = {'l': 2, 'm': 4, 'h': 8}[w]
    for _ in range(n):  # (chips)
        place(x, ring(0.06, rng.uniform(3000, 5500), [(1, 0.4, 0.02), (1.52, 0.25, 0.012)], rng), min(0.11, 0.01 + rng.exponential(0.035)), 0.09 * k)
    if w == 'h':
        t = T(0.1); place(x, hp(rng.standard_normal(t.size), 1400) * env(t, 0.0005, 0.012), 0.003, 0.7)  # (the bat's crack)
        place(x, knock(0.2, 380, 0.05, rng, 0.8), 0.004, 0.5)
    return x


MAT = {'wr': steel, 'sm': katana, 'ar': arrowhead, 'bm': arcane, 'gb': staff}
SEED = {'wr': 2100, 'sm': 2200, 'ar': 2300, 'bm': 2400, 'gb': 2500}


def make(cls, w, take):
    rng = R(SEED[cls] + {'l': 0, 'm': 30, 'h': 60}[w] + take)
    x = blow(rng, w) + MAT[cls](rng, w)
    return finish(x, 0.88, 3, 2.4)


if __name__ == '__main__':
    classes = sys.argv[1:] or list(MAT)
    for c in classes:
        for w in 'lmh':
            for take in (1, 2, 3):
                write(f'imp_{c}_{w}_{take}', make(c, w, take))
