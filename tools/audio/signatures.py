#!/usr/bin/env python3
"""Each class's signature skills, a sound of their own (synthesised for the game; .ogg + .mp3 into
public/assets/audio/sfx/, like the other effects). Each class keeps one palette and every skill in it its own idea:

  warrior (wr_)  a greatsword's weight (low, wide whooshes; steel that clanks), holy gold light, the storm, the titan
  samurai (sm_)  a katana's thin bright steel (quick swishes that ring), sakura, ink, the dark and the crimson dragon
  archer  (ar_)  the bow (wood, string, the arrow's whistle and thunk), wind and leaves, fire, the sky full of arrows
  mage    (bm_)  arcane chimes (FM bells), starlight, lightning, frost, the clock of time
  gambler (gb_)  the staff (wood), cards (flick, riffle, snap), the casino (chips, coins, bells, the slot machine)

Per skill: `_c` its cast (the swing / shot / spell, timed so its strike lands with the skill's first blow), `_h` its main
hit (under the arena's boom), `_w` a wind-up at the start of a big one, a basic chain one cast per stage. What plays
when is ArenaSound's SIG table; this script prints each sound's measured loudness (the base volumes in Sound.ts come
from it: every cast about as loud as the class swings were, every hit as the class impacts).

    python3 tools/audio/signatures.py [name ...]     (needs numpy, scipy, ffmpeg with libvorbis and libmp3lame)
"""
import os
import sys

import numpy as np
from scipy.signal import fftconvolve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from impacts import SR, bp, brown, env, finish, glide, hp, lp, write  # noqa: E402

R = np.random.default_rng


# ---------------------------------------------------------------- the toolkit

def T(sec):
    return np.arange(int(round(SR * sec))) / SR


def buf(sec):
    return np.zeros(int(round(SR * sec)))


def place(b, x, start, amp=1.0):
    """Mix x into b from `start` s (its last few ms faded: a piece cut short never clicks)."""
    i = int(round(start * SR))
    n = min(x.size, b.size - i)
    if n > 0:
        y = x[:n] * amp
        k = min(n, int(SR * 0.006))
        y[n - k:] = y[n - k:] * np.linspace(1, 0, k)
        b[i:i + n] += y
    return b


def rise(t, a):
    return np.clip(t / max(a, 1e-5), 0, 1)


def svf(x, fc, q=1.0, mode='bp'):
    """A state-variable filter whose cutoff (and Q) may move every sample (a blade's sweep, a gust rising)."""
    n = x.size
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    q = np.broadcast_to(np.asarray(q, dtype=float), (n,))
    g = np.tan(np.pi * np.clip(fc, 20.0, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k)); a2 = g * a1; a3 = g * a2
    A1, A2, A3, X = a1.tolist(), a2.tolist(), a3.tolist(), x.tolist()
    B = [0.0] * n; L = [0.0] * n
    c1 = c2 = 0.0
    for i in range(n):
        v3 = X[i] - c2
        v1 = A1[i] * c1 + A2[i] * v3
        v2 = c2 + A2[i] * c1 + A3[i] * v3
        c1 = 2.0 * v1 - c1; c2 = 2.0 * v2 - c2
        B[i] = v1; L[i] = v2
    band = np.asarray(B); low = np.asarray(L)
    if mode == 'bp':
        return band * k  # (unity at the centre)
    if mode == 'lp':
        return low
    return x - k * band - low


def swoosh(dur, f0, f1, f2, rng, peak=0.45, q=2.0, shape=2.0, tail=4.5, whistle=0.0, wq=18.0):
    """A blade through the air: noise through a band that follows its speed (f0 -> f1 at the fastest -> f2), loudest at
    `peak` (a fraction of dur); `whistle`: the edge singing (a narrow band riding the same sweep)."""
    t = T(dur); u = t / dur
    up = np.clip(u / peak, 0, 1); dn = np.clip((u - peak) / (1 - peak), 0, 1)
    fc = np.where(u < peak, f0 * (f1 / f0) ** up, f1 * (f2 / f1) ** dn)
    a = np.where(u < peak, up ** shape, np.exp(-dn * tail))
    x = svf(rng.standard_normal(t.size), fc, q) * a
    if whistle:
        x += svf(rng.standard_normal(t.size), fc * 1.55, wq) * a * whistle * np.sqrt(wq / 2)
    n = min(t.size, int(SR * 0.004)); x[-n:] *= np.linspace(1, 0, n)
    return x


def air(dur, peak, tail, rng, f=260, amp=0.5):
    """The weight behind a big swing: low moving air."""
    t = T(dur); u = t / dur
    a = np.where(u < peak, (u / peak) ** 2, np.exp(-(u - peak) / (1 - peak) * tail))
    return lp(brown(t.size, rng), f) * a * amp * 0.8


def ring(dur, f0, parts, rng, att=0.0006, beat=0.0, glide_to=1.0, gtau=0.08):
    """Struck metal: partials (ratio, amp, decay s) — `beat`: each one doubled a hair off (it shimmers); `glide_to`:
    the pitch bends there (a rising cut's ring)."""
    t = T(dur); x = np.zeros_like(t)
    bend = glide_to + (1 - glide_to) * np.exp(-t / gtau)
    for r, a, tau in parts:
        ph = rng.uniform(0, 2 * np.pi)
        w = 2 * np.pi * np.cumsum(f0 * r * bend) / SR
        x += a * np.sin(w + ph) * np.exp(-t / tau)
        if beat:
            x += a * 0.5 * np.sin(w * (1 + beat) + ph + 1.0) * np.exp(-t / tau)
    return x * rise(t, att)


def thud(dur, f0, f1, tau, ftau=0.03, att=0.002):
    t = T(dur)
    return np.sin(glide(t, f0, f1, ftau)) * env(t, att, tau)


def hiss(dur, lo, hi, att, tau, rng):
    t = T(dur)
    return bp(rng.standard_normal(t.size), lo, min(hi, SR * 0.45)) * env(t, att, tau)


def click(dur, rng, f=3000, tau=0.0015, amp=1.0):
    t = T(dur)
    return hp(rng.standard_normal(t.size), f) * env(t, 0.0002, tau) * amp


def knock(dur, f, tau, rng, click_amp=0.5):
    """Wood: a damped tone and a short click on top."""
    t = T(dur)
    tone = np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / tau) * rise(t, 0.0004)
    c = bp(rng.standard_normal(t.size), 1200, 4500) * np.exp(-t / 0.003) * click_amp
    return tone + c


def pluck(dur, f, rng, decay=0.993, bright=0.6):
    """A plucked string (Karplus-Strong): a bow's string."""
    n = int(SR * dur); N = max(2, int(round(SR / f)))
    seed = rng.uniform(-1, 1, N)
    sm = np.convolve(seed, [0.25, 0.5, 0.25], 'same')
    b = (bright * seed + (1 - bright) * sm).tolist()
    y = [0.0] * n
    for i in range(n):
        y[i] = b[i] if i < N else decay * 0.5 * (y[i - N] + y[i - N - 1])
    y = np.asarray(y)
    return y - lp(y, 30)


def bell(dur, f, ratio=1.4, index=2.0, tau=0.5, itau=0.12, att=0.0008):
    """An FM bell (the mage's chimes, the casino's dings)."""
    t = T(dur)
    i = index * np.exp(-t / itau)
    return np.sin(2 * np.pi * f * t + i * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t / tau) * rise(t, att)


def saw(f, cap=6000.0):
    """A band-limited sawtooth following the frequency f (an array)."""
    f = np.asarray(f, float)
    ph = 2 * np.pi * np.cumsum(f) / SR
    k_max = int(cap / max(20.0, f.min()))
    x = np.zeros_like(ph)
    for k in range(1, k_max + 1):
        w = np.clip((cap - k * f) / (0.25 * cap), 0, 1)
        if not w.any():
            break
        x += w * np.sin(k * ph) / k
    return x


def formants(x, fs):
    """A voice's vowel: bands (centre, gain, width)."""
    y = np.zeros_like(x)
    for f, g, w in fs:
        y += bp(x, max(30, f - w / 2), f + w / 2, order=2) * g
    return y


def taiko(dur, rng, f0=150, f1=72, tau=0.3, slap=0.6):
    t = T(dur)
    m1 = np.sin(glide(t, f0, f1, 0.05)) * env(t, 0.002, tau)
    m2 = np.sin(glide(t, f0 * 1.59, f1 * 1.59, 0.05) + 0.7) * env(t, 0.002, tau * 0.35) * 0.35
    s = lp(rng.standard_normal(t.size), 1400) * env(t, 0.0008, 0.012) * slap
    return m1 + m2 + s


GONG = [(1.0, 1.0, 1.8), (1.48, 0.6, 1.3), (1.99, 0.5, 1.1), (2.43, 0.35, 0.8), (2.97, 0.3, 0.6), (3.49, 0.22, 0.45), (4.12, 0.15, 0.3)]
BELL = [(0.5, 0.55, 2.2), (1.0, 0.7, 1.4), (1.19, 0.45, 1.0), (1.5, 0.35, 0.8), (2.0, 0.5, 0.7), (2.51, 0.3, 0.45), (3.0, 0.22, 0.35), (4.07, 0.15, 0.22)]


def clink(dur, rng, f=None, amp=1.0):
    """A coin / a chip: small, bright, inharmonic."""
    t = T(dur); f = f or rng.uniform(3000, 6500)
    x = np.zeros_like(t)
    for r, a, tau in ((1, 1, rng.uniform(0.04, 0.12)), (1.52 + rng.uniform(-0.05, 0.05), 0.55, 0.05), (2.33, 0.35, 0.03), (3.1, 0.2, 0.018)):
        x += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6)) * np.exp(-t / tau)
    x += hp(rng.standard_normal(t.size), 4000) * env(t, 0.0003, 0.0015) * 0.5
    return x * rise(t, 0.0003) * amp


def flick(rng, snap=1.0, air_amp=0.45):
    """A card off the thumb: the snap, then its air (fft)."""
    t = T(0.08)
    x = hp(rng.standard_normal(t.size), 2500) * env(t, 0.0002, 0.0022) * snap
    x += bp(rng.standard_normal(t.size), 1500, 6500) * env(t, 0.002, 0.022) * air_amp
    return x


def grains(n, times, amps, kernels, rng):
    """Many small sounds (clicks, crackles, thunks): each time one of the kernels."""
    out = np.zeros(n)
    times = np.asarray(times, float); amps = np.broadcast_to(np.asarray(amps, float), times.shape)
    which = rng.integers(len(kernels), size=times.size)
    for j, k in enumerate(kernels):
        imp = np.zeros(n)
        for tm, a in zip(times[which == j], amps[which == j]):
            i = int(tm * SR)
            if 0 <= i < n:
                imp[i] += a
        if imp.any():
            out += fftconvolve(imp, k)[:n]
    return out


def slow(rng, n, f):
    """Slow random wandering (std 1): a flicker, a flutter, a roughness."""
    y = lp(rng.standard_normal(n), f, order=2)
    return y / (y.std() + 1e-12)


def crackle_kernels(rng, hpf=2500, taus=(0.0008, 0.0015, 0.0025)):
    ks = []
    for tau in taus:
        t = T(tau * 8)
        ks.append(hp(rng.standard_normal(t.size), hpf) * np.exp(-t / tau))
    return ks


def arc(dur, rng, f=95.0, jit=0.3, cap=4000, hpf=350, flicker=True):
    """An electric arc: a buzz whose pitch jumps, flickering on and off."""
    t = T(dur)
    hold = np.repeat(rng.uniform(1 - jit, 1 + jit, int(dur * 220) + 2), SR // 220 + 1)[:t.size]
    x = hp(saw(f * hold, cap=cap), hpf)
    if flicker:
        g = (slow(rng, t.size, 90) > -0.7).astype(float)
        x *= lp(g, 400)
    return x


def rustle(dur, rng, rate=400, lo=2500, hi=9000, amp=1.0):
    """Leaves / petals / paper: a dense crowd of tiny bright grains."""
    n = int(SR * dur)
    times = np.sort(rng.uniform(0, dur, int(rate * dur)))
    k = [bp(rng.standard_normal(int(SR * 0.012)), lo, hi) * np.exp(-np.arange(int(SR * 0.012)) / SR / tau) for tau in (0.0015, 0.003, 0.005)]
    return grains(n, times, rng.uniform(0.2, 1, times.size), k, rng) * amp


def flange(x, d0=0.0008, d1=0.006, rate=1.2, mix=0.9):
    """A sweeping comb (the mage's wave: noise that sings as it passes)."""
    t = np.arange(x.size) / SR
    d = d0 + (d1 - d0) * (0.5 - 0.5 * np.cos(2 * np.pi * rate * t))
    return x + mix * np.interp(t - d, t, x, left=0)


def growl(dur, rng, f0=70, f1=120, f2=80, amp=1.0):
    """A dragon's roar: a rough low voice (pitch up, then down), its throat (formants) and breath."""
    t = T(dur); u = t / dur
    f = np.where(u < 0.35, f0 + (f1 - f0) * np.clip(u / 0.35, 0, 1) ** 0.7, f1 + (f2 - f1) * np.clip((u - 0.35) / 0.65, 0, 1) ** 1.4)
    f = f * (1 + 0.05 * slow(rng, t.size, 25))  # (rough)
    src = saw(f, cap=5000) + saw(f * 0.5, cap=2500) * 0.6  # (a subharmonic: bigger than a man)
    breath = lp(rng.standard_normal(t.size), 3000) * (0.5 + 0.5 * np.sin(np.cumsum(2 * np.pi * f) / SR))
    v = formants(src * 0.7 + breath * 0.5, ((520, 1.0, 180), (950, 0.7, 220), (2400, 0.35, 400), (3300, 0.15, 500)))
    a = np.where(u < 0.12, (u / 0.12) ** 1.5, np.where(u < 0.6, 1.0, np.cos(np.pi / 2 * np.clip((u - 0.6) / 0.4, 0, 1)) ** 2))
    return v * a * amp


def whistle(dur, f0, f1, rng, q=30.0):
    """An arrow's whistle (a narrow band of air gliding in pitch)."""
    t = T(dur)
    fc = f0 * (f1 / f0) ** (t / dur)
    a = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    y = svf(rng.standard_normal(t.size), fc, q)
    return y / (y.std() + 1e-12) * 0.35 * a


def reverse(x, fade=0.004):
    y = x[::-1].copy()
    n = int(SR * fade); y[:n] *= np.linspace(0, 1, n)
    return y


def chord_pad(dur, freqs, att, tau, cap=4000, vib=0.0):
    t = T(dur); x = np.zeros_like(t)
    for i, f in enumerate(freqs):
        fv = f * (1 + vib * np.sin(2 * np.pi * (5 + i * 0.3) * t + i))
        x += saw(np.full(t.size, 1.0) * fv, cap=cap) * (1 / (1 + i * 0.25))
    return x * env(t, att, tau)


# ---------------------------------------------------------------- WARRIOR: the Judge — a greatsword's weight, holy gold light, the storm, the titan

def wr_swing(seed, f0, f1, f2, dur, peak, body=0.5, whistle=0.1):
    rng = R(seed); x = buf(dur + 0.06)
    place(x, swoosh(dur, f0, f1, f2, rng, peak=peak, q=2.2, shape=2.2, tail=6.0, whistle=whistle, wq=14) + air(dur, peak, 6.0, rng, 240, body), 0)
    return x


def wr_iron_1():  # Iron Chain 1: a slash (the cast is timed so the swing's peak lands on the blow: lead 150 ms)
    return finish(wr_swing(101, 220, 1250, 420, 0.34, 0.45), 0.85, 1.3)


def wr_iron_2():  # 2: the backhand (a hair higher)
    return finish(wr_swing(102, 260, 1450, 470, 0.32, 0.47), 0.85, 1.3)


def wr_iron_3():  # 3: the double cut (two blades 170 ms apart)
    x = buf(0.52)
    place(x, wr_swing(103, 240, 1350, 450, 0.3, 0.45), 0)
    place(x, wr_swing(104, 290, 1600, 520, 0.3, 0.45), 0.17, 0.9)
    return finish(x, 0.85, 1.3)


def wr_iron_4():  # 4: the finisher — wound up, heavier, lower, the blade turning in his hands first (a short scrape)
    rng = R(105); x = wr_swing(105, 160, 980, 300, 0.5, 0.55, body=0.85, whistle=0.06)
    scrape = svf(rng.standard_normal(int(SR * 0.12)), np.linspace(2600, 3400, int(SR * 0.12)), 9) * env(T(0.12), 0.02, 0.04) * 0.25
    place(x, scrape, 0.02)
    return finish(x, 0.86, 1.35)


def wr_iron_hit(seed):  # a blow of the chain: steel cleaving in — a dull clank, the slap, the weight
    rng = R(seed); t = T(0.42)
    x = thud(0.42, 170, 70, 0.06, 0.025)
    x += bp(rng.standard_normal(t.size), 500, 3200) * env(t, 0.0008, 0.02) * 0.9
    x += ring(0.42, rng.uniform(950, 1150), [(1, 0.5, 0.05), (1.73, 0.4, 0.035), (2.61, 0.3, 0.025), (3.9, 0.18, 0.015)], rng) * 0.6
    x += click(0.42, rng, 3500, 0.004, 0.5)
    return finish(x, 0.85, 1.6)


def wr_iron_fin():  # the finisher's blow: KLANG-thud, the long stun in it
    rng = R(106); t = T(0.75)
    x = thud(0.75, 140, 52, 0.11, 0.035) * 1.1
    x += bp(rng.standard_normal(t.size), 300, 2500) * env(t, 0.001, 0.035)
    x += ring(0.75, 640, [(1, 0.5, 0.14), (1.62, 0.45, 0.1), (2.47, 0.35, 0.08), (3.33, 0.25, 0.05), (4.71, 0.15, 0.03)], rng, beat=0.004) * 0.6
    x += click(0.75, rng, 3000, 0.005, 0.6)
    return finish(x, 0.86, 1.7)


def wr_rise_c():  # Rising Slash: the blade sweeps up through the three cuts (vwoo-SHIING, rising)
    rng = R(110); dur = 0.6
    x = swoosh(dur, 300, 3000, 3800, rng, peak=0.42, q=2.4, shape=1.8, tail=6, whistle=0.4, wq=16)
    x += air(dur, 0.4, 6, rng, 300, 0.35)
    t = T(dur)
    x += np.sin(2 * np.pi * np.cumsum(700 * (1 + 1.2 * np.clip(t / 0.3, 0, 1))) / SR) * env(t, 0.12, 0.12) * 0.3  # (the steel's glide up)
    return finish(x, 0.85, 1.3)


def wr_rise_h():  # the launch: a bright TCHING, and the air lifting him
    rng = R(111); x = buf(0.75); t = T(0.75)
    place(x, ring(0.75, 2350, [(1, 0.6, 0.18), (1.41, 0.45, 0.12), (2.08, 0.3, 0.08), (2.9, 0.2, 0.05)], rng, beat=0.003, glide_to=1.05, gtau=0.1), 0)
    place(x, thud(0.5, 190, 80, 0.05), 0, 0.85)
    place(x, click(0.3, rng, 2500, 0.006, 0.7), 0)
    place(x, swoosh(0.45, 500, 2600, 3200, rng, peak=0.3, q=2.5, tail=4), 0.02, 0.6)
    return finish(x, 0.86, 1.5)


def wr_quake_c():  # Ground Breaker: the heave down (falling; lead 300 ms: it peaks on the smash)
    rng = R(120); dur = 0.42; x = buf(0.5)
    place(x, swoosh(dur, 1100, 500, 180, rng, peak=0.75, q=1.6, shape=2.5, tail=7) + air(dur, 0.78, 7, rng, 200, 0.9), 0)
    return finish(x, 0.85, 1.3)


def wr_quake_h():  # the smash: stone splits, rubble, then the living quake rolling under the floor (~1.5 s)
    rng = R(121); t = T(1.7); x = buf(1.7)
    x += thud(1.7, 120, 40, 0.18, 0.05) * 1.2
    x += lp(rng.standard_normal(t.size), 1800) * env(t, 0.001, 0.05) * 1.2
    for s, a in ((0.0, 1.0), (0.025, 0.7), (0.06, 0.5)):
        place(x, hp(rng.standard_normal(int(SR * 0.15)), 700) * env(T(0.15), 0.0008, 0.02), s, a)
    times = 0.03 + rng.exponential(0.12, 40); times = times[times < 0.6]
    ks = [knock(0.05, f, 0.012, rng, 0.6) for f in (380, 520, 700)]
    x += grains(t.size, times, 0.35 * np.exp(-times / 0.25), ks, rng)  # (rubble)
    trem = 0.55 + 0.45 * np.sin(2 * np.pi * 7.5 * t + 0.3 * np.sin(2 * np.pi * 1.3 * t))
    shape = np.clip(t / 0.08, 0, 1) * np.exp(-np.maximum(0, t - 0.25) / 0.55)
    x += lp(brown(t.size, rng), 110) * trem * shape * 1.4  # (the quake following you)
    x += lp(rng.standard_normal(t.size), 400) * trem * shape * 0.12
    return finish(x, 0.86, 1.5)


def wr_rush_c():  # Impaling Rush: the charge across the arena — a jet of wind building, the blade dragging, his feet
    rng = R(130); dur = 0.6; t = T(dur); x = buf(dur)
    x += swoosh(dur, 220, 950, 650, rng, peak=0.62, q=1.6, shape=1.2, tail=6) + air(dur, 0.6, 6, rng, 220, 0.6)
    scrape = sum(svf(rng.standard_normal(t.size), f, 22) for f in (1200, 2650, 4100))
    x += scrape * (0.14 + 0.2 * np.clip(t / 0.4, 0, 1)) * np.exp(-np.maximum(0, t - 0.4) / 0.05) * (0.6 + 0.4 * (lp(rng.standard_normal(t.size), 40) > 0))
    for s in (0.06, 0.18, 0.3, 0.42):
        place(x, thud(0.12, 120, 60, 0.03) + click(0.12, rng, 1500, 0.004, 0.3), s, 0.85)
    return finish(x, 0.84, 1.3)


def wr_rush_h():  # he rips it upward in a burst of light: a tearing rip, a holy major chord flashing, the air up
    rng = R(131); dur = 1.35; t = T(dur); x = buf(dur)
    rip = svf(rng.standard_normal(int(SR * 0.16)), np.linspace(800, 4200, int(SR * 0.16)), 1.6) * env(T(0.16), 0.002, 0.05)
    place(x, rip, 0, 1.1)
    place(x, thud(0.4, 160, 60, 0.07), 0, 0.9)
    light = np.zeros_like(t)
    for f, a in ((440, 0.5), (554.4, 0.4), (659.3, 0.4), (880, 0.35), (1318.5, 0.2)):
        for h, ha in ((1, 1), (2, 0.35), (3, 0.15)):
            light += a * ha * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6))
    x += light * env(t, 0.006, 0.42) * 0.3
    for k in range(9):  # (sparkles of it)
        place(x, bell(0.35, rng.choice([1760, 2217, 2637, 3520]), ratio=2.0, index=1.0, tau=0.12), 0.03 + k * 0.035, 0.12)
    place(x, swoosh(0.5, 600, 3000, 3600, rng, peak=0.3, q=2, tail=4), 0.02, 0.5)
    return finish(x, 0.86, 1.45)


def wr_storm_w():  # Blade Storm, the wind-up: the sword raised to the sky (a rising ring), the thunder gathering
    rng = R(140); dur = 0.7; t = T(dur); x = buf(dur)
    x += ring(dur, 1800, [(1, 0.5, 0.25), (1.5, 0.3, 0.2), (2.3, 0.2, 0.15)], rng, att=0.08, beat=0.003, glide_to=1.4, gtau=0.25) * 0.5
    x += lp(brown(t.size, rng), 90) * np.clip(t / 0.32, 0, 1) ** 1.5 * np.exp(-np.maximum(0, t - 0.32) / 0.1) * 1.2
    times = 0.2 + rng.exponential(0.1, 10); x += grains(t.size, times, rng.uniform(0.1, 0.35, 10), crackle_kernels(rng), rng)
    return finish(x, 0.82, 1.3)


def wr_storm_c():  # the storm: lightning crackling round him and light swords erupting from the floor all around (2.6 s)
    rng = R(141); dur = 3.3; t = T(dur); x = buf(dur)
    drone = (lp(brown(t.size, rng), 70) * 1.2 + np.sin(2 * np.pi * 49 * t) * 0.25) * env(t, 0.15, 0.9)
    x += drone
    for k in range(15):  # (each sword: a quick rising ring and its own small whoosh)
        s = 0.02 + k * 0.09 + rng.uniform(-0.02, 0.03)
        f = rng.uniform(2200, 4200)
        sw = ring(0.5, f, [(1, 0.6, rng.uniform(0.12, 0.25)), (1.5, 0.35, 0.1), (2.2, 0.2, 0.06)], rng, beat=0.004, glide_to=1.08, gtau=0.03)
        place(sw, swoosh(0.08, 900, 4200, 4500, rng, peak=0.8, q=2.5, tail=3), 0, 0.8)
        place(x, sw, s, 0.4 * (1 - 0.35 * k / 15))
    times = rng.uniform(0, 2.3, 60); x += grains(t.size, times, rng.uniform(0.1, 0.5, 60) * np.exp(-times / 1.4), crackle_kernels(rng), rng)
    for s in (0.25, 0.9, 1.6):  # (arcs of lightning)
        place(x, arc(0.09, rng, f=rng.uniform(80, 120)) * env(T(0.09), 0.002, 0.04), s, 0.3)
    return finish(x, 0.84, 1.3)


def wr_storm_h():  # a light sword strikes: TZZING, the snap of it
    rng = R(142); dur = 0.85; x = buf(dur)
    place(x, ring(dur, 3100, [(1, 0.6, 0.2), (1.42, 0.4, 0.14), (2.0, 0.3, 0.09), (2.83, 0.15, 0.05)], rng, beat=0.005), 0)
    place(x, click(0.2, rng, 2000, 0.005, 0.9), 0)
    place(x, arc(0.06, rng, f=110) * env(T(0.06), 0.001, 0.025), 0.0, 0.5)
    place(x, thud(0.35, 170, 70, 0.05), 0, 0.8)
    return finish(x, 0.85, 1.5)


def wr_titan_w():  # Titan's Verdict, the wind-up (0.77 s, the music already ducking): his roar and the titan of light rising
    rng = R(150); dur = 0.8; t = T(dur); u = t / dur
    sw = (u ** 2.2) * np.clip((dur - t) / 0.03, 0, 1)
    pitch = 1 + 0.03 * u
    chord = np.zeros_like(t)
    for f, a in ((73.4, 1.0), (110, 0.8), (146.8, 0.7), (185, 0.55), (220, 0.5), (293.7, 0.3)):
        chord += saw(f * pitch * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t + f)), cap=4500) * a
    voice = formants(chord, ((650, 1.0, 160), (1080, 0.6, 200), (2650, 0.35, 380))) * 2.2
    sub = np.sin(2 * np.pi * np.cumsum(36 + 20 * u) / SR) * 0.6
    rush = svf(rng.standard_normal(t.size), 200 * (1800 / 200) ** u, 1.4) * 0.5
    return finish((voice + sub + rush) * sw, 0.84, 1.25)


def wr_titan_h():  # the giant sword driven into the floor: a colossal bell of judgment, the crunch, the golden shockwave
    rng = R(151); dur = 3.0; t = T(dur); x = buf(dur)
    x += ring(dur, 98.0, [(r, a, min(tau, 0.9)) for r, a, tau in BELL], rng, att=0.002, beat=0.002) * 0.9
    x += thud(dur, 110, 38, 0.3, 0.06) * 1.0
    x += lp(rng.standard_normal(t.size), 2000) * env(t, 0.001, 0.08) * 1.1
    for s, a in ((0, 1), (0.03, 0.6)):
        place(x, hp(rng.standard_normal(int(SR * 0.2)), 600) * env(T(0.2), 0.0008, 0.03), s, a)
    place(x, swoosh(0.75, 3000, 900, 350, rng, peak=0.15, q=1.2, tail=3.5), 0.03, 0.7)
    return finish(x, 0.87, 1.4)


def wr_titan_end():  # the last blow (the knockdown): the struck floor's lightning — KZZT, the floor taking it
    rng = R(152); dur = 0.85; t = T(dur); x = buf(dur)
    place(x, arc(0.3, rng, f=85, jit=0.4) * env(T(0.3), 0.002, 0.12), 0, 0.7)
    times = rng.exponential(0.12, 30); x += grains(t.size, times, rng.uniform(0.2, 0.6, 30) * np.exp(-times / 0.3), crackle_kernels(rng), rng)
    place(x, thud(0.7, 120, 42, 0.16, 0.05), 0, 1.0)
    place(x, click(0.2, rng, 1200, 0.008, 0.9), 0)
    return finish(x, 0.86, 1.5)


# ---------------------------------------------------------------- SAMURAI: thin bright steel, sakura, ink, the dark, the crimson dragon

def sm_swish(seed, dur=0.16, f0=1400, f1=6500, f2=2600, peak=0.4, whistle=0.25):
    x = buf(dur + 0.04)
    return place(x, swoosh(dur, f0, f1, f2, R(seed), peak=peak, q=3.5, shape=1.8, tail=6, whistle=whistle, wq=25), 0)


def sm_quick_1():  # Quick Slash 1 (lead 60 ms)
    return finish(sm_swish(201), 0.84, 1.2)


def sm_quick_2():  # 2: the backhand
    return finish(sm_swish(202, f0=1600, f1=7000, f2=3000), 0.84, 1.2)


def sm_quick_3():  # 3: the cross cut (two blades 60 ms apart)
    x = buf(0.26); place(x, sm_swish(203, 0.15), 0); place(x, sm_swish(204, 0.15, 1800, 7600, 3200), 0.06, 0.9)
    return finish(x, 0.84, 1.2)


def sm_quick_4():  # 4: the rising cut (it lifts him): rising, and a thin ring gliding up
    rng = R(205); x = buf(0.42); place(x, sm_swish(205, 0.26, 1200, 7500, 9000, peak=0.42, whistle=0.3), 0)
    place(x, ring(0.36, 3200, [(1, 0.3, 0.1), (1.5, 0.2, 0.07)], rng, att=0.04, glide_to=1.2, gtau=0.08) * 0.35, 0.05)
    return finish(x, 0.84, 1.2)


def sm_quick_hit(seed):  # a cut landing: tsk-shk (bright, short; the steel just rings)
    rng = R(seed); t = T(0.28)
    x = click(0.28, rng, 2800, 0.008, 1.0)
    x += ring(0.28, rng.uniform(3200, 3600), [(1, 0.4, 0.035), (1.5, 0.3, 0.025), (2.05, 0.2, 0.015)], rng)
    x += thud(0.28, 220, 110, 0.025) * 0.6
    x += bp(rng.standard_normal(t.size), 1000, 5000) * env(t, 0.001, 0.02) * 0.6
    return finish(x, 0.85, 1.5)


def sm_quick_fin():  # the rising cut lands (the launch): tsching~ and the air
    rng = R(206); x = buf(0.85)
    place(x, click(0.3, rng, 2500, 0.01, 1.0), 0)
    place(x, ring(0.85, 3000, [(1, 0.55, 0.22), (1.47, 0.4, 0.15), (2.13, 0.25, 0.09), (2.9, 0.15, 0.05)], rng, beat=0.003, glide_to=1.04), 0)
    place(x, thud(0.3, 200, 90, 0.04), 0, 0.7)
    place(x, swoosh(0.3, 1500, 6000, 7000, rng, peak=0.3, q=3, tail=4), 0.01, 0.4)
    return finish(x, 0.86, 1.5)


HUNDRED = 0.0538  # (Hundred Cuts' blows in the arena: 54 ms apart, the last at 673 ms)


def sm_hundred_c():  # Hundred Cuts: a storm of cuts (one on each blow) over a whirr, rising into the last (lead 36 ms)
    rng = R(210); dur = 0.8; t = T(dur); x = buf(dur)
    for k in range(12):
        f1 = 6200 + 900 * (k % 3) + rng.uniform(-300, 300)
        place(x, sm_swish(211 + k, 0.09, 1800, f1, 3000, peak=0.4, whistle=0.2), k * HUNDRED, 0.55 + 0.45 * k / 11)
    whirr = bp(rng.standard_normal(t.size), 700, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi / HUNDRED * t)) * env(t, 0.15, 0.5) * 0.3
    x += whirr * np.clip((0.66 - t) / 0.03, 0, 1)
    place(x, swoosh(0.1, 1500, 7000, 7000, rng, peak=0.95, q=3, tail=3), 0.6, 0.7)
    return finish(x, 0.84, 1.2)


def sm_hundred_h():  # the last cut blasts him away: ZAN! and a taiko under it
    rng = R(220); dur = 1.45; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1500) * env(t, 0.0006, 0.03) * 1.2
    x += ring(dur, 2250, [(1, 0.7, 0.35), (1.47, 0.5, 0.25), (2.13, 0.35, 0.15), (2.89, 0.25, 0.1)], rng, beat=0.002) * 0.7
    x += taiko(dur, rng, 150, 72, 0.35, 0.7) * 1.0
    place(x, swoosh(0.35, 1200, 5000, 3000, rng, peak=0.2, q=2, tail=4), 0.0, 0.5)
    return finish(x, 0.87, 1.5)


def sm_swallow_c():  # Swallow Cut: a crescent rising, then turning back like a swallow (a chirp of it in the air)
    rng = R(230); x = buf(0.42)
    place(x, sm_swish(231, 0.2, 1300, 7000, 8500, peak=0.5, whistle=0.3), 0)
    place(x, sm_swish(232, 0.2, 6000, 2400, 1000, peak=0.3, whistle=0.25), 0.13, 0.9)
    for s, f0, f1 in ((0.06, 5200, 6400), (0.17, 6400, 5000), (0.21, 5600, 6600)):
        t = T(0.05); place(x, np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * t / 0.05) / SR) * np.sin(np.pi * t / 0.05) ** 2 * 0.16, s)
    return finish(x, 0.84, 1.2)


def sm_swallow_h():  # the crescent throws him up: a ring bending upward, the lift
    rng = R(233); x = buf(0.85)
    place(x, click(0.2, rng, 2600, 0.008, 0.9), 0)
    place(x, ring(0.85, 2600, [(1, 0.6, 0.25), (1.5, 0.4, 0.16), (2.2, 0.25, 0.1)], rng, beat=0.003, glide_to=1.07, gtau=0.12), 0)
    place(x, thud(0.3, 190, 85, 0.04), 0, 0.7)
    place(x, swoosh(0.4, 900, 4500, 5500, rng, peak=0.35, q=2.4, tail=4), 0.02, 0.55)
    return finish(x, 0.86, 1.5)


def sm_shadow_c():  # Shadow Step: a blink — the air drawn in backwards and cut off (the pass), a low displacement, ink
    rng = R(240); x = buf(0.46)
    pre = reverse(swoosh(0.16, 600, 4800, 6000, rng, peak=0.25, q=2.2, tail=4))
    place(x, pre, 0)
    place(x, thud(0.2, 110, 45, 0.06), 0.15, 0.8)
    place(x, lp(rng.standard_normal(int(SR * 0.3)), 900) * env(T(0.3), 0.004, 0.1), 0.155, 0.45)
    return finish(x, 0.84, 1.3)


def sm_shadow_h():  # the cut as he passes: shk, and a splash of ink
    rng = R(241); dur = 0.38; t = T(dur); x = buf(dur)
    x += click(dur, rng, 3000, 0.006, 0.9)
    x += ring(dur, 3400, [(1, 0.35, 0.05), (1.5, 0.25, 0.03)], rng)
    splash = bp(rng.standard_normal(t.size), 400, 2600) * env(t, 0.006, 0.09) * (0.7 + 0.3 * np.sin(2 * np.pi * 31 * t))
    place(x, splash, 0.02, 0.7)
    x += thud(dur, 200, 90, 0.035) * 0.6
    return finish(x, 0.85, 1.4)


def sm_iai_w():  # Iai Strike, the hand on the sheath: the thumb pushes the guard (a crisp click), a glint
    rng = R(250); x = buf(0.9)
    place(x, ring(0.15, 3800, [(1, 0.5, 0.02), (1.55, 0.35, 0.012)], rng) + click(0.15, rng, 3000, 0.001, 0.8), 0)
    place(x, bell(0.85, 5200, ratio=2.0, index=0.6, tau=0.2, att=0.01) * 0.25, 0.05)
    return finish(x, 0.7, 1.1)


def sm_iai_c():  # the lightning draw: a flick of air and SHIIING
    rng = R(251); x = buf(1.6)
    place(x, swoosh(0.07, 2000, 9000, 9000, rng, peak=0.6, q=3, tail=3) * 0.9, 0)
    place(x, ring(1.55, 2900, [(1, 0.8, 0.45), (1.5, 0.5, 0.32), (2.2, 0.35, 0.22), (3.1, 0.2, 0.14)], rng, att=0.004, beat=0.0025), 0.03, 0.45)
    return finish(x, 0.84, 1.2)


def sm_iai_h():  # the decisive cut: zan — a beat — the dull drum of it, a crimson spray
    rng = R(252); dur = 1.25; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1800) * env(t, 0.0005, 0.025) * 1.1
    x += ring(dur, 2700, [(1, 0.5, 0.2), (1.5, 0.3, 0.14)], rng, beat=0.002) * 0.4
    place(x, taiko(1.1, rng, 120, 58, 0.3, 0.4), 0.09, 1.0)
    spray = hp(rng.standard_normal(t.size), 3000) * env(t, 0.03, 0.22) * (0.6 + 0.4 * (lp(rng.standard_normal(t.size), 30) > 0))
    place(x, spray, 0.04, 0.22)
    return finish(x, 0.86, 1.5)


def sm_blossom_c():  # Blossom Storm: a swirl of petals and afterimages — a gust fluttering, a koto line rising on the cuts
    rng = R(260); dur = 1.1; t = T(dur); x = buf(dur)
    flutter = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(18 + 5 * slow(rng, t.size, 5)) / SR)
    x += bp(rng.standard_normal(t.size), 800, 4200) * flutter * env(t, 0.25, 0.22) * 0.6
    x += rustle(dur, rng, 300, 3000, 9000, 0.25) * env(t, 0.1, 0.25)
    for k, (s, f) in enumerate(((0.0, 587.3), (0.14, 698.5), (0.28, 784.0), (0.42, 880.0))):
        place(x, pluck(0.5, f, R(261 + k), decay=0.992, bright=0.7) * env(T(0.5), 0.001, 0.25), s, 0.7)
        place(x, pluck(0.5, f * 2, R(271 + k), decay=0.99, bright=0.5) * env(T(0.5), 0.001, 0.15), s + 0.012, 0.25)
        place(x, sm_swish(265 + k, 0.1, 2000, 7000, 3500, whistle=0.15), s, 0.15)
    for k in range(6):  # (wind chimes in the gust)
        place(x, bell(0.5, rng.choice([1760.0, 2093.0, 2349.3, 2637.0]), ratio=2.76, index=0.5, tau=0.15), 0.1 + rng.uniform(0, 0.5), 0.08)
    return finish(x, 0.84, 1.25)


def sm_blossom_h():  # the last cut throws him high: a burst of blossom chimes, petals flung up, the slice
    rng = R(270); dur = 1.6; t = T(dur); x = buf(dur)
    for f, a in ((1174.7, 1.0), (1760, 0.8), (1396.9, 0.7), (2093, 0.5), (2637, 0.35)):
        place(x, bell(dur, f, ratio=3.5, index=1.2, tau=0.55, itau=0.08), rng.uniform(0, 0.02), 0.18 * a)
    place(x, click(0.2, rng, 2500, 0.009, 1.0), 0)
    place(x, thud(0.4, 190, 80, 0.05), 0, 0.75)
    place(x, swoosh(0.55, 700, 4000, 5000, rng, peak=0.3, q=1.8, tail=3.5), 0.01, 0.6)
    x += rustle(dur, rng, 500, 3000, 9000, 0.3) * env(t, 0.02, 0.3)
    return finish(x, 0.86, 1.4)


def sm_eclipse_w():  # Dragon Eclipse, the dark (1.35 s): a deep drone, a gong swelling backwards into the moment, a heartbeat
    rng = R(280); dur = 1.38; t = T(dur); u = t / dur
    x = (np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 82.4 * t) * 0.3 + lp(saw(np.full(t.size, 55.0), 3000), 800) * 0.6) * u ** 1.3
    g = ring(1.6, 98, GONG, rng, beat=0.003)
    x += reverse(g)[-t.size:] * 0.9
    for s in (0.42, 0.56, 0.92, 1.06):
        place(x, thud(0.25, 70, 45, 0.07), s, 0.45)
    x *= np.clip((dur - t) / 0.02, 0, 1)
    return finish(x, 0.82, 1.2)


def sm_eclipse_c():  # eight cuts out of the dark from eight sides (34 ms apart), then the air drawn for the colossal one
    rng = R(281); dur = 0.46; x = buf(dur)
    for k in range(8):
        place(x, sm_swish(282 + k, 0.07, 2200, 8000 + 600 * (k % 2), 3500, peak=0.4, whistle=0.2), k * 0.034, 0.75 + 0.25 * (k % 2))
    place(x, reverse(swoosh(0.12, 800, 5000, 6000, rng, peak=0.3, q=2, tail=4)), 0.21, 0.6)
    return finish(x, 0.84, 1.25)


def sm_eclipse_h():  # the crimson dragon's cut: its roar, the colossal slice, the great drum
    rng = R(290); dur = 2.1; t = T(dur); x = buf(dur)
    place(x, growl(1.0, rng, 68, 118, 75), 0.02, 0.9)
    x += hp(rng.standard_normal(t.size), 1200) * env(t, 0.0006, 0.04) * 1.2
    x += ring(dur, 1600, [(1, 0.6, 0.4), (1.47, 0.45, 0.3), (2.13, 0.3, 0.2), (2.89, 0.2, 0.12)], rng, beat=0.003) * 0.55
    x += taiko(dur, rng, 110, 52, 0.5, 0.8) * 1.1
    place(x, swoosh(0.6, 2500, 600, 300, rng, peak=0.12, q=1.2, tail=3), 0.0, 0.5)
    return finish(x, 0.87, 1.4)


# ---------------------------------------------------------------- ARCHER: the bow (wood, string, whistle, thunk), wind and leaves, fire, the sky full of arrows

def twang(rng, f=145, dur=0.22, decay=0.99, thwip=1.0, whistle_amp=0.12):
    """A bow shot: the string, the thwip of the release, the arrow's whistle leaving."""
    x = buf(dur + 0.12)
    s = pluck(dur, f, rng, decay=decay, bright=0.75) * env(T(dur), 0.0005, dur * 0.35)
    place(x, s, 0, 0.9)
    place(x, hp(rng.standard_normal(int(SR * 0.05)), 1800) * env(T(0.05), 0.0004, 0.01), 0, 0.6 * thwip)
    place(x, thud(0.08, 160, 90, 0.015), 0, 0.35 * thwip)
    place(x, whistle(0.14, 3300, 2500, rng, 20), 0.01, whistle_amp)
    return x


def ar_double_c():  # Double Shot: two fast arrows (70 ms apart)
    x = buf(0.42); place(x, twang(R(301), 145), 0); place(x, twang(R(302), 162), 0.07, 0.9)
    return finish(x, 0.84, 1.3)


def ar_charged_c():  # the charged arrow: the bow drawn hard (it creaks), a deep twang, the arrow tearing off (lead 160 ms)
    rng = R(303); x = buf(0.62)
    times = np.sort(0.16 * (1 - rng.random(22) ** 1.7))
    kn = [knock(0.03, f, 0.006, rng, 0.3) for f in (240, 330, 410)]
    place(x, grains(int(SR * 0.17), times, rng.uniform(0.2, 0.5, 22) * (0.4 + times / 0.16), kn, rng), 0)
    place(x, svf(rng.standard_normal(int(SR * 0.16)), 380, 12) * env(T(0.16), 0.1, 0.05) * 0.3, 0)
    place(x, twang(rng, 105, 0.3, 0.993, thwip=1.4, whistle_amp=0.18), 0.16)
    place(x, swoosh(0.3, 600, 3200, 2400, rng, peak=0.2, q=2, tail=4), 0.16, 0.6)
    return finish(x, 0.84, 1.3)


def ar_arrow_hit(seed):  # an arrow thunks in
    rng = R(seed); dur = 0.24; t = T(dur)
    x = click(dur, rng, 2500, 0.001, 0.9)
    x += np.sin(2 * np.pi * rng.uniform(600, 760) * t) * env(t, 0.0004, 0.018) * 0.7
    x += thud(dur, 180, 90, 0.03) * 0.7
    x += bp(rng.standard_normal(t.size), 600, 3000) * env(t, 0.001, 0.012) * 0.5
    return finish(x, 0.85, 1.5)


def ar_charged_h():  # the charged arrow hits: a heavy THOCK and a gust of leaves
    rng = R(305); dur = 0.65; t = T(dur); x = buf(dur)
    x += click(dur, rng, 2000, 0.0015, 1.0)
    x += knock(dur, 420, 0.035, rng, 0.8) * 0.9
    x += thud(dur, 140, 55, 0.09, 0.03) * 1.0
    x += ring(dur, 310, [(1, 0.5, 0.18), (2.0, 0.3, 0.12), (3.01, 0.2, 0.08)], rng, att=0.003) * 0.35  # (the shaft humming in him)
    return finish(x, 0.86, 1.5)


def ar_rise_c():  # Rising Arrow: an arrow strikes the floor, a column of wind rises (swirling, leaves in it)
    rng = R(310); dur = 1.0; t = T(dur); x = buf(dur)
    place(x, knock(0.12, 380, 0.02, rng, 0.9) + click(0.12, rng, 2200, 0.0012, 0.7), 0)
    fc = 250 * (2400 / 250) ** np.clip(t / 0.55, 0, 1)
    swirl = 0.65 + 0.35 * np.sin(2 * np.pi * 8 * t)
    x += svf(rng.standard_normal(t.size), fc, 3.0) * swirl * env(t, 0.12, 0.22) * 1.5
    x += svf(rng.standard_normal(t.size), fc * 1.8 * (1 + 0.04 * np.sin(2 * np.pi * 8 * t)), 25) * env(t, 0.15, 0.2) * 3.0  # (the vortex whistling)
    x += rustle(dur, rng, 350, 2500, 8000, 0.35) * env(t, 0.25, 0.18)
    return finish(x, 0.84, 1.3)


def ar_rise_h():  # the wind throws him up: a gust bursting upward, leaves scattering
    rng = R(311); dur = 0.6; t = T(dur); x = buf(dur)
    place(x, swoosh(0.45, 400, 2600, 3200, rng, peak=0.28, q=1.8, tail=4), 0, 1.0)
    x += rustle(dur, rng, 600, 2500, 9000, 0.4) * env(t, 0.01, 0.2)
    x += thud(dur, 160, 70, 0.05) * 0.7
    return finish(x, 0.85, 1.4)


def flames(dur, rng, amp=1.0, crackles=40):
    t = T(dur)
    roar = lp(brown(t.size, rng), 700) * np.clip(0.7 + 0.3 * slow(rng, t.size, 14), 0.2, 1.3)
    times = rng.uniform(0, dur, crackles)
    cr = grains(t.size, times, rng.uniform(0.1, 0.6, crackles), crackle_kernels(rng, 1800, (0.0006, 0.0012, 0.002)), rng)
    return (roar + cr) * amp


def ar_fire_c():  # Fireball Arrow: the twang, the arrow catching fire (fwoomp), the fireball roaring away
    rng = R(320); dur = 0.75; t = T(dur); x = buf(dur)
    place(x, twang(rng, 130, 0.22), 0, 0.8)
    ign = lp(rng.standard_normal(t.size), 1200) * env(t, 0.03, 0.15)
    x += ign * 0.9
    x += flames(dur, rng, 0.9, 30) * env(t, 0.04, 0.25)
    return finish(x, 0.84, 1.35)


def ar_fire_h():  # it bursts: KA-BOOM, the fire roaring on, crackling down
    rng = R(321); dur = 1.6; t = T(dur); x = buf(dur)
    n = rng.standard_normal(t.size)
    x += svf(n, 300 + 7700 * np.exp(-t / 0.08), 0.8, 'lp') * env(t, 0.001, 0.12) * 1.3
    x += thud(dur, 90, 35, 0.25, 0.05) * 1.1
    x += flames(dur, rng, 1.0, 70) * env(t, 0.02, 0.45) * 0.9
    return finish(x, 0.87, 1.5)


def ar_storm_c():  # Hunter's Rain: dozens of arrows loosed into the sky — a volley of twangs, a cloud of whistles going up
    rng = R(330); dur = 1.15; t = T(dur); x = buf(dur)
    for k in range(7):
        place(x, twang(R(331 + k), rng.uniform(120, 175), 0.18, whistle_amp=0.0), k * 0.035 + rng.uniform(0, 0.01), 0.55)
    for k in range(18):
        s = rng.uniform(0.03, 0.55); d = rng.uniform(0.35, 0.6); f0 = rng.uniform(2300, 3600)
        place(x, whistle(d, f0, f0 * 1.35, rng, 28), s, 0.16 * (1 - s))
    place(x, swoosh(0.6, 400, 2200, 3000, rng, peak=0.3, q=1.3, tail=3), 0.02, 0.5)
    return finish(x, 0.84, 1.3)


def ar_storm_h():  # the last of the rain: a cluster of thunks
    rng = R(340); dur = 0.45; t = T(dur); x = buf(dur)
    for k in range(6):
        place(x, ar_arrow_hit(341 + k), rng.uniform(0, 0.09), 0.5)
    x += thud(dur, 150, 60, 0.06) * 0.7
    return finish(x, 0.85, 1.5)


def ar_volley_c():  # Air Volley: the leap (hup, the air), five shots from the air on its five arrows (in the arena), each a bit higher
    rng = R(350); dur = 0.95; x = buf(dur)
    place(x, swoosh(0.4, 300, 1600, 800, rng, peak=0.35, q=1.5, tail=4) + air(0.4, 0.35, 4, rng, 300, 0.6), 0, 0.8)
    for k, s in enumerate((0.073, 0.207, 0.341, 0.475, 0.609)):
        place(x, twang(R(351 + k), 150 + 9 * k, 0.2, whistle_amp=0.16), s, 0.75)
    return finish(x, 0.84, 1.3)


def ar_volley_h():  # the last arrow of the volley lands: a thunk with a green zing
    rng = R(360); x = buf(0.6)
    place(x, ar_arrow_hit(361), 0, 0.9)
    place(x, bell(0.58, 2800, ratio=2.01, index=1.5, tau=0.13), 0.005, 0.3)
    place(x, thud(0.3, 160, 65, 0.05), 0, 0.6)
    return finish(x, 0.85, 1.5)


def ar_skyrain_w():  # Sky Rain, the wind-up (0.8 s): she races across the screen (a rush past, her feet), the bow drawn to the sky
    rng = R(370); dur = 0.85; t = T(dur); x = buf(dur)
    place(x, swoosh(0.6, 500, 2600, 700, rng, peak=0.42, q=1.3, shape=1.6, tail=3.5), 0, 1.0)
    for k in range(8):
        place(x, thud(0.06, 150, 90, 0.015) + click(0.06, rng, 2500, 0.002, 0.3) + knock(0.06, 230, 0.01, rng, 0.4) * 0.5, 0.05 + k * 0.058, 0.75)
    times = np.sort(0.56 + 0.2 * (1 - rng.random(14) ** 1.6))
    kn = [knock(0.03, f, 0.006, rng, 0.3) for f in (250, 340)]
    x += grains(t.size, times, rng.uniform(0.15, 0.4, 14), kn, rng)
    place(x, np.sin(2 * np.pi * np.cumsum(1500 * (2.1 ** (T(0.25) / 0.25))) / SR) * np.sin(np.pi * T(0.25) / 0.25) ** 2 * 0.1, 0.58)
    return finish(x, 0.83, 1.3)


def ar_skyrain_c():  # the whole sky pours arrows: a cloud of whistles coming down, the air full, the patter growing
    rng = R(371); dur = 1.8; t = T(dur); x = buf(dur)
    for k in range(60):
        s = abs(rng.normal(0.55, 0.35)) % 1.3; d = rng.uniform(0.35, 0.6); f0 = rng.uniform(3600, 4800)
        place(x, whistle(d, f0, f0 * 0.42, rng, 30), s, rng.uniform(0.06, 0.12))
    x += lp(rng.standard_normal(t.size), 3000) * env(t, 0.5, 0.6) * 0.18
    times = 0.2 + rng.uniform(0, 1.4, 90) ** 1.2; times = times[times < dur]
    ks = [knock(0.04, f, 0.01, rng, 0.8) for f in (520, 640, 780)]
    x += grains(t.size, times, rng.uniform(0.1, 0.35, times.size) * np.clip(times / 1.2, 0.2, 1), ks, rng)
    x *= np.exp(-np.maximum(0, t - 1.5) / 0.08)
    return finish(x, 0.84, 1.3)


def ar_skyrain_h():  # the last wave crashes down on them: arrows hammering in, the floor shaking, leaves and dust
    rng = R(380); dur = 1.0; t = T(dur); x = buf(dur)
    times = rng.uniform(0, 0.13, 30)
    ks = [knock(0.05, f, 0.012, rng, 1.0) for f in (480, 620, 760)]
    x += grains(t.size, times, rng.uniform(0.3, 0.7, 30), ks, rng)
    x += thud(dur, 110, 45, 0.25, 0.05) * 1.1
    x += lp(rng.standard_normal(t.size), 1500) * env(t, 0.002, 0.06) * 0.8
    x += lp(brown(t.size, rng), 300) * env(t, 0.01, 0.35) * 0.6  # (the floor shaking, dust)
    return finish(x, 0.87, 1.5)


# ---------------------------------------------------------------- BOOK MAGE: arcane chimes, starlight, lightning, frost, the clock of time

def bm_bolt(seed, f0=2200, f1=800):
    rng = R(seed); dur = 0.4; t = T(dur); x = buf(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x += np.sin(ph + 2.5 * np.exp(-t / 0.06) * np.sin(ph * 1.5)) * env(t, 0.002, 0.07) * 0.8
    x += bp(rng.standard_normal(t.size), 1500, 5000) * env(t, 0.004, 0.05) * 0.35
    for k in range(3):
        place(x, bell(0.12, rng.uniform(4000, 7000), ratio=2.0, index=1.0, tau=0.04), 0.01 + 0.02 * k, 0.15)
    return finish(x, 0.84, 1.3)


def bm_bolt_c1():  # Arcane Bolt: a bolt (pew, with a sparkle)
    return bm_bolt(401)


def bm_bolt_c2():  # the second bolt, a hair higher
    return bm_bolt(402, 2500, 900)


def bm_lance_c():  # the arcane lance: a whine charging (lead 150 ms), then VWOOM and its bright trail
    rng = R(403); dur = 0.7; x = buf(dur)
    tc = T(0.15)
    whine = np.sin(2 * np.pi * np.cumsum(600 * (3 ** (tc / 0.15))) / SR) * (tc / 0.15) ** 2 * 0.3
    place(x, whine, 0)
    t2 = T(0.55)
    sub = np.sin(glide(t2, 90, 45, 0.08)) * env(t2, 0.003, 0.12)
    ph = 2 * np.pi * 180 * t2
    growl_ = np.sin(ph + 4 * np.exp(-t2 / 0.15) * np.sin(ph * 0.5)) * env(t2, 0.003, 0.12) * 0.5
    trail = bp(rng.standard_normal(t2.size), 2000, 7000) * env(t2, 0.005, 0.2) * 0.35
    place(x, sub + growl_ + trail, 0.15)
    return finish(x, 0.85, 1.35)


def bm_bolt_h(seed=410):  # a bolt lands: a crystalline pop
    rng = R(seed); dur = 0.55; t = T(dur)
    x = bell(dur, rng.uniform(2400, 2800), ratio=2.76, index=2.0, tau=0.11) * 0.8
    x += bp(rng.standard_normal(t.size), 1000, 4000) * env(t, 0.001, 0.015) * 0.6
    x += thud(dur, 200, 100, 0.025) * 0.6
    return finish(x, 0.85, 1.4)


def bm_lance_h():  # the lance hits: a shimmering burst, a deep whump, a glassy ring
    rng = R(420); dur = 1.3; t = T(dur); x = buf(dur)
    for k in range(8):
        place(x, bell(1.2, rng.uniform(1500, 6000), ratio=rng.choice([1.4, 2.76, 3.5]), index=1.5, tau=rng.uniform(0.15, 0.3)), rng.uniform(0, 0.08), 0.13)
    x += thud(dur, 110, 50, 0.15, 0.04) * 1.0
    x += ring(dur, 2100, [(1, 0.5, 0.4), (2.76, 0.25, 0.2)], rng) * 0.3
    x += bp(rng.standard_normal(t.size), 600, 5000) * env(t, 0.001, 0.03) * 0.7
    return finish(x, 0.86, 1.4)


def bm_wave_c():  # Arcane Wave: a wide wave across the floor — air that sings as it sweeps (a moving comb), a low hum
    rng = R(430); dur = 0.85; t = T(dur)
    n = bp(rng.standard_normal(t.size), 300, 4000)
    x = flange(n, 0.0006, 0.005, rate=1.4) * env(t, 0.06, 0.22) * 0.9
    x += (np.sin(2 * np.pi * 98 * t) + 0.6 * np.sin(2 * np.pi * 147 * t)) * env(t, 0.05, 0.16) * 0.35
    return finish(x, 0.84, 1.3)


def bm_wave_h():  # it lifts him: a soft whomp and a sparkle rising (three chimes)
    rng = R(431); dur = 0.9; t = T(dur); x = buf(dur)
    x += thud(dur, 130, 60, 0.1) * 0.9
    x += lp(rng.standard_normal(t.size), 500) * env(t, 0.003, 0.05) * 0.6
    for k, f in enumerate((1318.5, 1661.2, 1975.5)):
        place(x, bell(0.75, f, ratio=3.5, index=1.0, tau=0.2), 0.02 + k * 0.05, 0.3)
    return finish(x, 0.85, 1.4)


def bm_astral_c():  # Astral Lift: a hand of starlight reaching (a glitter swelling in backwards) and seizing him (hwump)
    rng = R(440); dur = 0.6; x = buf(dur)
    g = buf(0.3)
    for k in range(14):
        place(g, bell(0.25, rng.uniform(2000, 6500), ratio=2.0, index=1.0, tau=0.08), rng.uniform(0, 0.08), 0.2)
    place(x, reverse(g), 0)
    t2 = T(0.25)
    place(x, np.sin(glide(t2, 150, 70, 0.04)) * env(t2, 0.002, 0.06) + lp(rng.standard_normal(t2.size), 600) * env(t2, 0.002, 0.03) * 0.5, 0.25, 0.9)
    return finish(x, 0.84, 1.3)


def bm_astral_h():  # the starlight throws him up: a deep whoom, stars cascading, a shimmering chord
    rng = R(441); dur = 1.6; t = T(dur); x = buf(dur)
    x += thud(dur, 70, 38, 0.25, 0.05) * 1.0
    x += lp(rng.standard_normal(t.size), 400) * env(t, 0.002, 0.1) * 0.7
    for k in range(40):
        s = rng.exponential(0.22)
        if s < 1.0:
            place(x, bell(0.35, rng.uniform(2000, 8000), ratio=2.0, index=0.8, tau=0.06), s, 0.12 * np.exp(-s / 0.5))
    pad = sum(bell(dur, f, ratio=1.0, index=0.4, tau=0.45, itau=0.3, att=0.01) for f in (523.3, 659.3, 784.0, 987.8))
    x += pad * 0.12
    return finish(x, 0.86, 1.35)


def zap(rng, dur=0.06, amp=1.0):
    return (arc(dur, rng, f=rng.uniform(90, 140)) * env(T(dur), 0.001, dur * 0.4) + click(dur, rng, 2500, 0.002, 0.6)) * amp


def bm_chain_c():  # Lightning Chain: the charge snapping out (lead 40 ms), then the leaps to the next foes (100 ms apart)
    rng = R(450); dur = 0.62; t = T(dur); x = buf(dur)
    place(x, arc(0.05, rng, 70) * (T(0.05) / 0.05) ** 2 * 0.5, 0)
    for k, s in enumerate((0.14, 0.24, 0.34, 0.44)):
        place(x, zap(rng, 0.07, 0.55 * (1 - 0.15 * k)), s)
    x += grains(t.size, rng.uniform(0.04, 0.5, 30), rng.uniform(0.05, 0.25, 30), crackle_kernels(rng), rng)
    return finish(x, 0.82, 1.3)


def bm_chain_h():  # the lightning seizes him: KRZZAK, the arc buzzing on him
    rng = R(451); dur = 0.72; t = T(dur); x = buf(dur)
    x += click(dur, rng, 1000, 0.006, 1.0)
    x += svf(rng.standard_normal(t.size), 800 + 5200 * np.exp(-t / 0.05), 0.8, 'lp') * env(t, 0.001, 0.05) * 0.6
    place(x, arc(0.45, rng, f=120, jit=0.45, cap=6000) * env(T(0.45), 0.002, 0.2), 0.01, 1.0)
    x += grains(t.size, rng.exponential(0.12, 40), rng.uniform(0.1, 0.5, 40), crackle_kernels(rng), rng)
    x += thud(dur, 80, 40, 0.12) * 0.5
    return finish(x, 0.86, 1.5)


def ice_thrust(rng):
    dur = 0.3; t = T(dur); x = buf(dur)
    x += grains(t.size, rng.uniform(0, 0.03, 30), rng.uniform(0.2, 0.6, 30), crackle_kernels(rng, 3500, (0.0005, 0.001)), rng)
    x += click(dur, rng, 2500, 0.005, 0.8)
    f = rng.uniform(3200, 4400)
    x += np.sin(2 * np.pi * np.cumsum(f * (1 + 0.02 * np.sin(2 * np.pi * 40 * t))) / SR) * env(t, 0.002, 0.07) * 0.25
    x += thud(dur, 160, 80, 0.03) * 0.6
    return x


def bm_spikes_c():  # Glacial Spikes: three rows of ice bursting up from the floor (crunch, crack, a glassy screech), frost
    rng = R(460); dur = 0.85; t = T(dur); x = buf(dur)
    for k, s in enumerate((0.0, 0.06, 0.12)):
        place(x, ice_thrust(rng), s, 0.8 - 0.1 * k)
    x += hp(rng.standard_normal(t.size), 4000) * env(t, 0.05, 0.18) * 0.2
    return finish(x, 0.84, 1.35)


def bm_spikes_h():  # an ice spike throws him up, chilled: the crack, a glassy tinkle, the knock
    rng = R(461); dur = 0.75; t = T(dur); x = buf(dur)
    place(x, ice_thrust(rng), 0, 1.0)
    for k in range(10):
        s = rng.exponential(0.12)
        if s < 0.5:
            place(x, bell(0.25, rng.uniform(3000, 8000), ratio=2.76, index=0.6, tau=0.05), s, 0.15)
    x += thud(dur, 150, 65, 0.06) * 0.8
    return finish(x, 0.85, 1.5)


def bm_field_c():  # Storm Field: a field of storm — whirling wind, an electric hum, its pulses (vwump-tzz, 240 ms apart in the arena) drawing them in
    rng = R(470); dur = 1.05; t = T(dur); x = buf(dur)
    wind = bp(rng.standard_normal(t.size), 400, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * 4 * t)) * env(t, 0.2, 0.8) * 0.6
    hum = lp(saw(np.full(t.size, 60.0), 1200) + 0.5 * saw(np.full(t.size, 120.4), 1200), 900) * env(t, 0.15, 0.9) * 0.3
    x += wind + hum * (0.8 + 0.2 * (lp(rng.standard_normal(t.size), 20) > 0))
    for s in (0.0, 0.24, 0.48):
        place(x, thud(0.3, 120, 55, 0.09), s, 0.8); place(x, zap(rng, 0.05, 0.4), s, 0.8)
    x += grains(t.size, rng.uniform(0, 0.75, 30), rng.uniform(0.05, 0.25, 30), crackle_kernels(rng), rng)
    x *= np.exp(-np.maximum(0, t - 0.74) / 0.08)
    return finish(x, 0.84, 1.3)


def bm_field_h():  # the last pulse throws them up: a thunderclap (KRA-KA-BOOM), the rumble
    rng = R(471); dur = 1.25; t = T(dur); x = buf(dur)
    for s, a in ((0.0, 1.0), (0.03, 0.7), (0.07, 0.5)):
        place(x, click(0.2, rng, 800, 0.008, a), s)
    x += svf(rng.standard_normal(t.size), 150 + 2500 * np.exp(-t / 0.1), 0.8, 'lp') * env(t, 0.002, 0.3) * 1.2
    roll = 0.6 + 0.4 * np.sin(2 * np.pi * 3.3 * t) * np.sin(2 * np.pi * 1.1 * t)
    x += lp(brown(t.size, rng), 160) * env(t, 0.02, 0.5) * roll * 1.5  # (the thunder rolling)
    x += thud(dur, 90, 38, 0.2, 0.05) * 1.0
    return finish(x, 0.87, 1.4)


def tick(rng, f=1.0, amp=1.0):
    """A clock's tick: a woody click with a metal body."""
    dur = 0.1; t = T(dur)
    x = click(dur, rng, 2000, 0.001, 1.0)
    x += ring(dur, 2300 * f, [(1, 0.5, 0.02), (1.61, 0.35, 0.012)], rng)
    x += np.sin(2 * np.pi * 800 * f * t) * env(t, 0.0005, 0.01) * 0.5
    return x * amp


def bm_time_w():  # Time Collapse, the clock opens (0.9 s): its tick-tock, a glassy swell rising into the stop
    rng = R(480); dur = 0.92; t = T(dur); x = buf(dur)
    for k, s in enumerate((0.0, 0.25, 0.5, 0.75)):
        place(x, tick(rng, 1.0 if k % 2 == 0 else 0.75), s, 0.8)
    sw = hp(rng.standard_normal(t.size), 3000) * (t / dur) ** 3 * 0.5
    x += sw
    x += sum(np.sin(2 * np.pi * f * t) for f in (1318.5, 1760.0)) * (t / dur) ** 2.5 * 0.12
    x *= np.clip((dur - t) / 0.02, 0, 1)
    return finish(x, 0.82, 1.2)


def bm_time_c():  # the hands stop: everything frozen in time (a held glassy chord, beating), the clock cracking bit by bit
    rng = R(481); dur = 1.32; t = T(dur); x = buf(dur)
    place(x, knock(0.2, 300, 0.05, rng, 1.0) + ring(0.2, 2100, [(1, 0.4, 0.08), (1.48, 0.3, 0.05)], rng), 0, 0.9)
    frozen = sum(np.sin(2 * np.pi * f * t + i) + 0.6 * np.sin(2 * np.pi * f * 1.003 * t) for i, f in enumerate((1318.5, 1760.0, 2349.3)))
    x += frozen * env(t, 0.25, 2.0) * 0.1 * np.clip((1.3 - t) / 0.1, 0, 1)
    place(x, tick(rng, 0.9, 0.5), 0.26)
    times = 0.3 + 0.95 * rng.random(45) ** 0.5
    x += grains(t.size, times, rng.uniform(0.1, 0.45, 45) * (times / 1.25), crackle_kernels(rng, 3000, (0.0006, 0.0012)), rng)
    return finish(x, 0.82, 1.25)


def bm_time_h():  # the clock collapses: a shattering blast, glass raining, the deep boom under it
    rng = R(482); dur = 1.7; t = T(dur); x = buf(dur)
    x += hp(rng.standard_normal(t.size), 1500) * env(t, 0.0008, 0.06) * 1.1
    for k in range(40):
        s = rng.exponential(0.18)
        if s < 0.9:
            place(x, bell(0.5, rng.uniform(2500, 9000), ratio=2.76, index=0.7, tau=rng.uniform(0.04, 0.1)), s, 0.18 * np.exp(-s / 0.5))
    x += thud(dur, 60, 30, 0.35, 0.06) * 1.2
    x += lp(rng.standard_normal(t.size), 800) * env(t, 0.002, 0.1) * 0.6
    return finish(x, 0.87, 1.4)


# ---------------------------------------------------------------- GAMBLER: the staff (wood), cards, the casino

def gb_deck_1():  # Cut the Deck 1: the staff's jab (lead 50 ms)
    rng = R(501); x = place(buf(0.18), swoosh(0.13, 700, 2600, 1500, rng, peak=0.38, q=2.2, tail=6), 0)
    return finish(x, 0.84, 1.2)


def gb_deck_2():  # 2: the back swing — the staff whirring round
    rng = R(502); dur = 0.22; t = T(dur)
    x = place(buf(0.27), swoosh(dur, 500, 1900, 700, rng, peak=0.4, q=2.0, tail=6) * (0.75 + 0.25 * np.sin(2 * np.pi * 30 * t)), 0)
    return finish(x, 0.84, 1.2)


def gb_deck_3():  # 3: two charged cards flicked (fft-fft and their pink fizz)
    rng = R(503); dur = 0.3; t = T(dur); x = buf(dur)
    place(x, flick(rng), 0); place(x, flick(rng, 0.9), 0.06)
    x += hp(rng.standard_normal(t.size), 5000) * (0.6 + 0.4 * np.sin(2 * np.pi * 60 * t)) * env(t, 0.01, 0.08) * 0.25
    return finish(x, 0.84, 1.2)


def gb_deck_4():  # 4: the rising swing — up, and a little bell at the top (lead 100 ms)
    rng = R(504); x = buf(0.75)
    place(x, swoosh(0.28, 500, 2800, 3400, rng, peak=0.4, q=2, tail=5), 0)
    place(x, bell(0.65, 2093, ratio=1.0, index=0.3, tau=0.16), 0.1, 0.18)
    return finish(x, 0.84, 1.2)


def gb_staff_hit(seed):  # a staff blow: a wooden TOK, the body, a chip
    rng = R(seed); dur = 0.32; t = T(dur)
    x = knock(dur, rng.uniform(520, 600), 0.025, rng, 0.9) * 0.9
    x += thud(dur, 180, 80, 0.035) * 0.8
    x += bp(rng.standard_normal(t.size), 600, 3000) * env(t, 0.001, 0.012) * 0.5
    place(x, clink(0.25, rng, amp=0.15), 0.01)
    return finish(x, 0.85, 1.5)


def gb_deck_fin():  # the rising swing lands (the launch): TOK-DING, chips flying
    rng = R(505); dur = 0.85; x = buf(dur)
    place(x, knock(0.3, 480, 0.04, rng, 1.0), 0, 1.0)
    place(x, thud(0.35, 170, 70, 0.05), 0, 0.8)
    place(x, bell(0.8, 2093, ratio=2.0, index=0.8, tau=0.22), 0.01, 0.35)
    for k in range(3):
        place(x, clink(0.2, rng, amp=0.3), 0.03 + k * 0.04)
    return finish(x, 0.86, 1.5)


def riffle_(dur, n, rng, accel=0.0, amp=1.0):
    """Cards riffling: clicks (each a tiny flick), faster as it goes if accel."""
    x = buf(dur + 0.05); u = np.linspace(0, 1, n)
    times = dur * (u ** (1 + accel) if accel else u) + rng.uniform(0, dur / n * 0.3, n)
    for s in times:
        place(x, flick(rng, rng.uniform(0.4, 0.9), 0.2), s, amp)
    return x


def gb_deal_w():  # Charged Deal, the fan: a riffle opening, the charge humming up
    rng = R(510); dur = 0.27; t = T(dur); x = buf(dur)
    place(x, riffle_(0.18, 18, rng, accel=0.0, amp=1.0), 0)
    x += np.sin(2 * np.pi * np.cumsum(300 * (2 ** (t / dur))) / SR) * (t / dur) ** 2 * 0.3
    x += hp(rng.standard_normal(t.size), 5000) * (t / dur) ** 2 * 0.08
    return finish(x, 0.8, 1.2)


def gb_deal_c():  # the three cards thrown (fft-fft-fft) with their charged zip
    rng = R(511); dur = 0.32; t = T(dur); x = buf(dur)
    for k in range(3):
        place(x, flick(rng, 1.0, 0.5), k * 0.035)
    place(x, swoosh(0.22, 900, 5000, 6500, rng, peak=0.3, q=4, tail=4, whistle=0.3, wq=20), 0.0, 0.7)
    x += hp(rng.standard_normal(t.size), 4500) * (0.6 + 0.4 * np.sin(2 * np.pi * 70 * t)) * env(t, 0.01, 0.1) * 0.2
    for k in range(5):  # (pink sparks off the charged cards)
        place(x, bell(0.25, rng.uniform(3500, 6500), ratio=1.5, index=1.2, tau=0.06), 0.02 + k * 0.03, 0.15)
    return finish(x, 0.84, 1.2)


def gb_deal_h(seed=512):  # a card sticks in: thk, and it fizzes (charged)
    rng = R(seed); dur = 0.5; t = T(dur); x = buf(dur)
    x += click(dur, rng, 2500, 0.0015, 0.9)
    x += bp(rng.standard_normal(t.size), 1200, 5000) * env(t, 0.001, 0.01) * 0.6
    x += thud(dur, 170, 85, 0.025) * 0.5
    fizz = hp(rng.standard_normal(t.size), 4000) * (slow(rng, t.size, 80) > 0.3) * env(t, 0.01, 0.12)
    place(x, fizz, 0.01, 0.35)
    return finish(x, 0.84, 1.4)


def gb_vault_c():  # Staff Vault: the staff planted on the floor (tok), the vault's arc through the air
    rng = R(520); dur = 0.42; x = buf(dur)
    place(x, knock(0.15, 330, 0.03, rng, 1.0), 0, 0.8)
    place(x, swoosh(0.34, 400, 1600, 600, rng, peak=0.45, q=1.6, tail=4) + air(0.34, 0.45, 4, rng, 280, 0.4), 0.04, 0.9)
    return finish(x, 0.84, 1.25)


def gb_vault_h():  # the landing double kick (the launch): dum-DUM, air up, chips rattling
    rng = R(521); dur = 0.55; t = T(dur); x = buf(dur)
    for s, a in ((0.0, 0.7), (0.07, 1.0)):
        place(x, thud(0.3, 150, 60, 0.05) + bp(rng.standard_normal(int(SR * 0.3)), 400, 2500) * env(T(0.3), 0.001, 0.012) * 0.5, s, a)
    place(x, swoosh(0.35, 500, 2400, 2800, rng, peak=0.3, q=2, tail=4), 0.07, 0.4)
    for k in range(3):
        place(x, clink(0.2, rng, amp=0.25), 0.09 + k * 0.03)
    return finish(x, 0.86, 1.5)


def gb_fuse_c():  # Fuse Slam: the staff brought down overhead (falling; lead 240 ms)
    rng = R(530); dur = 0.32
    x = place(buf(0.38), swoosh(dur, 2600, 1300, 900, rng, peak=0.75, q=1.8, shape=2.2, tail=7) + air(dur, 0.78, 7, rng, 260, 0.5), 0)
    return finish(x, 0.84, 1.25)


def gb_fuse_h():  # KTOK! the staff smashes down, and the floor is charged: a fuse sputtering, an electric hum
    rng = R(531); dur = 0.95; t = T(dur); x = buf(dur)
    place(x, knock(0.3, 260, 0.05, rng, 1.2), 0, 1.0)
    x += thud(dur, 110, 45, 0.12, 0.04) * 1.0
    x += click(dur, rng, 1500, 0.004, 0.8)
    spark = hp(rng.standard_normal(t.size), 3000) * (slow(rng, t.size, 60) > 0.4) * env(t, 0.05, 0.4) * np.clip((0.9 - t) / 0.1, 0, 1)
    x += spark * 0.35
    x += grains(t.size, rng.uniform(0.05, 0.8, 40), rng.uniform(0.1, 0.35, 40), crackle_kernels(rng, 2000), rng)
    x += hp(saw(np.full(t.size, 100.0), 2000), 400) * env(t, 0.05, 0.4) * 0.08
    return finish(x, 0.86, 1.5)


def gb_show_w():  # Showdown, the wind-up: the hand flies off his shoulder (cards riffling through the air)
    rng = R(540); dur = 0.38; t = T(dur); x = buf(dur)
    place(x, riffle_(0.3, 20, rng, accel=0.4, amp=0.55), 0)
    x += bp(rng.standard_normal(t.size), 1200, 5000) * env(t, 0.15, 0.12) * 0.35
    return finish(x, 0.8, 1.2)


def gb_show_c():  # the cards stand in a row and turn over one by one (a snap and a rising note each: C E G C)
    rng = R(541); dur = 0.48; x = buf(dur)
    for k, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
        place(x, flick(rng, 1.0, 0.3), k * 0.1)
        place(x, bell(0.3, f, ratio=1.0, index=0.6, tau=0.14), k * 0.1 + 0.004, 0.3)
    place(x, reverse(swoosh(0.1, 800, 4000, 5000, rng, peak=0.3, q=2, tail=4)), 0.3, 0.35)
    return finish(x, 0.84, 1.2)


def gb_show_h():  # the last card bursts (the Hand shown): a casino stab — a bright chord, bells over it, chips everywhere
    rng = R(542); dur = 1.25; t = T(dur); x = buf(dur)
    stab = lp(chord_pad(dur, (523.3, 659.3, 784.0, 1046.5), 0.004, 0.32, cap=5000), 3500)
    x += stab * 0.35
    for f in (2093.0, 2637.0, 3136.0):
        place(x, bell(1.2, f, ratio=1.0, index=0.8, tau=0.26), 0.005, 0.15)
    x += thud(dur, 150, 60, 0.08) * 0.8
    x += bp(rng.standard_normal(t.size), 800, 6000) * env(t, 0.001, 0.03) * 0.6
    for k in range(8):
        place(x, clink(0.25, rng, amp=0.25), rng.uniform(0.01, 0.25))
    return finish(x, 0.86, 1.4)


def gb_jack_w():  # Jackpot, the wind-up (0.9 s): the lever pulled (ka-chunk), the reels spinning up (clacks faster and faster)
    rng = R(550); dur = 0.92; t = T(dur); x = buf(dur)
    place(x, knock(0.2, 220, 0.04, rng, 1.0) + ring(0.2, 900, [(1, 0.3, 0.05), (2.3, 0.2, 0.03)], rng), 0, 0.9)
    place(x, knock(0.2, 300, 0.03, rng, 1.0), 0.09, 0.7)
    s, times = 0.15, []
    while s < 0.9:
        times.append(s); s += 1 / (8 + 40 * ((s - 0.15) / 0.75) ** 1.3)
    ks = [knock(0.03, f, 0.005, rng, 0.8) for f in (1500, 1800, 2100)]
    x += grains(t.size, times, np.full(len(times), 0.35), ks, rng)
    x += svf(rng.standard_normal(t.size), 300 * (5 ** np.clip((t - 0.15) / 0.75, 0, 1)), 2.0) * np.clip((t - 0.1) / 0.6, 0, 1) * 0.3
    x *= np.clip((dur - t) / 0.02, 0, 1)
    return finish(x, 0.82, 1.2)


def gb_jack_c():  # 7 · 7 · 7: three reels stop (CLUNK + a ding, rising), the jackpot bell ringing, coins pouring out
    rng = R(551); dur = 1.32; t = T(dur); x = buf(dur)
    for k, (s, f) in enumerate(((0.0, 1568.0), (0.15, 1975.5), (0.3, 2349.3))):
        place(x, knock(0.15, 260, 0.03, rng, 1.0) + thud(0.15, 160, 80, 0.03) * 0.6, s, 0.8)
        place(x, bell(0.4, f, ratio=2.0, index=0.8, tau=0.2), s + 0.005, 0.3)
    s = 0.42; k = 0
    while s < 1.25:  # (the alarm bell: two tones trilling)
        place(x, bell(0.09, 1318.5 if k % 2 else 1046.5, ratio=3.0, index=1.5, tau=0.04), s, 0.22)
        s += 1 / 12; k += 1
    times = 0.42 + rng.exponential(0.3, 70); times = times[times < 1.3]
    for s in times:
        place(x, clink(0.2, rng, amp=rng.uniform(0.08, 0.2)), s)
    x *= np.clip((dur - t) / 0.03, 0, 1)
    return finish(x, 0.84, 1.25)


def gb_jack_h():  # the last blast smashes them down: an explosion of coins
    rng = R(552); dur = 1.05; t = T(dur); x = buf(dur)
    x += thud(dur, 100, 40, 0.2, 0.05) * 1.1
    x += lp(rng.standard_normal(t.size), 2500) * env(t, 0.001, 0.06) * 0.9
    times = rng.exponential(0.12, 70); times = times[times < 0.8]
    for s in times:
        place(x, clink(0.2, rng, amp=rng.uniform(0.1, 0.3) * np.exp(-s / 0.4)), s)
    return finish(x, 0.87, 1.5)


SOUNDS = {
    # warrior
    'wr_iron_1': wr_iron_1, 'wr_iron_2': wr_iron_2, 'wr_iron_3': wr_iron_3, 'wr_iron_4': wr_iron_4,
    'wr_iron_hit_1': lambda: wr_iron_hit(107), 'wr_iron_hit_2': lambda: wr_iron_hit(108), 'wr_iron_fin': wr_iron_fin,
    'wr_rise_c': wr_rise_c, 'wr_rise_h': wr_rise_h, 'wr_quake_c': wr_quake_c, 'wr_quake_h': wr_quake_h,
    'wr_rush_c': wr_rush_c, 'wr_rush_h': wr_rush_h, 'wr_storm_w': wr_storm_w, 'wr_storm_c': wr_storm_c, 'wr_storm_h': wr_storm_h,
    'wr_titan_w': wr_titan_w, 'wr_titan_h': wr_titan_h, 'wr_titan_end': wr_titan_end,
    # samurai
    'sm_quick_1': sm_quick_1, 'sm_quick_2': sm_quick_2, 'sm_quick_3': sm_quick_3, 'sm_quick_4': sm_quick_4,
    'sm_quick_hit_1': lambda: sm_quick_hit(207), 'sm_quick_hit_2': lambda: sm_quick_hit(208), 'sm_quick_fin': sm_quick_fin,
    'sm_hundred_c': sm_hundred_c, 'sm_hundred_h': sm_hundred_h, 'sm_swallow_c': sm_swallow_c, 'sm_swallow_h': sm_swallow_h,
    'sm_shadow_c': sm_shadow_c, 'sm_shadow_h': sm_shadow_h, 'sm_iai_w': sm_iai_w, 'sm_iai_c': sm_iai_c, 'sm_iai_h': sm_iai_h,
    'sm_blossom_c': sm_blossom_c, 'sm_blossom_h': sm_blossom_h, 'sm_eclipse_w': sm_eclipse_w, 'sm_eclipse_c': sm_eclipse_c, 'sm_eclipse_h': sm_eclipse_h,
    # archer
    'ar_double_c': ar_double_c, 'ar_charged_c': ar_charged_c, 'ar_arrow_hit_1': lambda: ar_arrow_hit(304), 'ar_arrow_hit_2': lambda: ar_arrow_hit(306),
    'ar_charged_h': ar_charged_h, 'ar_rise_c': ar_rise_c, 'ar_rise_h': ar_rise_h, 'ar_fire_c': ar_fire_c, 'ar_fire_h': ar_fire_h,
    'ar_storm_c': ar_storm_c, 'ar_storm_h': ar_storm_h, 'ar_volley_c': ar_volley_c, 'ar_volley_h': ar_volley_h,
    'ar_skyrain_w': ar_skyrain_w, 'ar_skyrain_c': ar_skyrain_c, 'ar_skyrain_h': ar_skyrain_h,
    # book mage
    'bm_bolt_c1': bm_bolt_c1, 'bm_bolt_c2': bm_bolt_c2, 'bm_lance_c': bm_lance_c, 'bm_bolt_h_1': lambda: bm_bolt_h(410), 'bm_bolt_h_2': lambda: bm_bolt_h(411),
    'bm_lance_h': bm_lance_h, 'bm_wave_c': bm_wave_c, 'bm_wave_h': bm_wave_h, 'bm_astral_c': bm_astral_c, 'bm_astral_h': bm_astral_h,
    'bm_chain_c': bm_chain_c, 'bm_chain_h': bm_chain_h, 'bm_spikes_c': bm_spikes_c, 'bm_spikes_h': bm_spikes_h,
    'bm_field_c': bm_field_c, 'bm_field_h': bm_field_h, 'bm_time_w': bm_time_w, 'bm_time_c': bm_time_c, 'bm_time_h': bm_time_h,
    # gambler
    'gb_deck_1': gb_deck_1, 'gb_deck_2': gb_deck_2, 'gb_deck_3': gb_deck_3, 'gb_deck_4': gb_deck_4,
    'gb_staff_hit_1': lambda: gb_staff_hit(506), 'gb_staff_hit_2': lambda: gb_staff_hit(507), 'gb_deck_fin': gb_deck_fin,
    'gb_deal_w': gb_deal_w, 'gb_deal_c': gb_deal_c, 'gb_deal_h': gb_deal_h, 'gb_vault_c': gb_vault_c, 'gb_vault_h': gb_vault_h,
    'gb_fuse_c': gb_fuse_c, 'gb_fuse_h': gb_fuse_h, 'gb_show_w': gb_show_w, 'gb_show_c': gb_show_c, 'gb_show_h': gb_show_h,
    'gb_jack_w': gb_jack_w, 'gb_jack_c': gb_jack_c, 'gb_jack_h': gb_jack_h,
}


def loudness(x):
    """The loudest 100 ms (RMS): how loud it is heard."""
    w = int(SR * 0.1)
    if x.size <= w:
        return float(np.sqrt(np.mean(x ** 2)))
    c = np.cumsum(np.concatenate([[0], x ** 2]))
    return float(np.sqrt(((c[w:] - c[:-w]) / w).max()))


def cut_short(x):
    """How loud it still is when it ends (the last 40 ms before the fade, against its loudest): over ~3 % it is cut off."""
    n = int(SR * 0.04); e = int(SR * 0.025)
    end = np.sqrt(np.mean(x[-n - e:-e] ** 2)) if x.size > n + e else 0
    return float(end / (loudness(x) + 1e-12))


if __name__ == '__main__':
    names = sys.argv[1:] or list(SOUNDS)
    for name in names:
        x = SOUNDS[name]()
        if os.environ.get('DRY'):
            c = cut_short(x)
            print(name, f'{x.size / SR:.2f} s', f'loud {loudness(x):.3f}', f'end {c:.3f}' + ('  <-- CUT' if c > 0.03 else ''))
            continue
        write(name, x)
        print('   loud', f'{loudness(x):.3f}')
