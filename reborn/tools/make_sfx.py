"""GOD OF LEGACY — REBORN: the katana's sound effects, synthesized here (numpy only; outputs committed as 16-bit mono
WAV, which Godot imports). M3 review (GPT): three distinct sword swings and impacts, the third heavier.
  swing_1/2/3 — a blade cutting air: band-passed noise whose centre sweeps up and back down as the blade passes,
                with a faint whistle; 1 short and light, 2 a long wide sweep, 3 lower and fuller.
  impact_1/2/3 — the blade biting a straw-wrapped post: a sharp transient, a mid "thwack", the straw's crackle and
                a body thump; 3 deeper and longer, with a low boom.
  evade       — Shadow Step's genuine evasion (M4 Stage C, GPT's v1.4: a distinctive sound): a soft airy rush as the
                blade cuts through his shadow, and a glassy fracture — a few inharmonic partials struck at once,
                falling a little in pitch and ringing out quickly.
  seal        — Explosive Seal planted (M4 Stage D, GPT's v1.6: synthesized placeholders): a soft palm thump and a
                glassy tone rising a little as the sigil forms.
  seal_tick   — the mark's pulses: a short bright tick over a low hum (pitched up for each later pulse).
  detonation  — the mark bursting: a sharp crack, a noise burst and a deep falling boom with a crackling tail.
  execution_swing / execution_impact — Phantom Execution: a long, heavy whoosh; a deeper impact than any basic strike.
Placeholder quality (synthesized, not recorded): to be replaced or layered in the audio pass.
Usage: python3 make_sfx.py <out dir>"""
import struct
import sys
import wave

import numpy as np

SR = 44100
OUT = sys.argv[1]
rng = np.random.default_rng(23)


def save(name, x, gain=0.9):
    x = x / max(1e-9, np.max(np.abs(x))) * gain
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(f'{OUT}/{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(name, len(x) / SR, 's')


def svf_band(x, fc, q):
    """A state-variable band-pass whose centre `fc` (Hz, per sample) moves over time."""
    y = np.zeros_like(x)
    low = band = 0.0
    for i in range(len(x)):
        f = 2.0 * np.sin(np.pi * min(fc[i], SR * 0.45) / SR)
        high = x[i] - low - q * band
        band += f * high
        low += f * band
        y[i] = band
    return y


def one_pole_low(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s
        y[i] = s
    return y


def env(n, attack, release, curve=2.0):
    """Rise over `attack` (fraction of n), fall over the rest."""
    t = np.linspace(0, 1, n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    r = np.clip((1 - t) / max(1 - attack, 1e-4), 0, 1) ** curve
    return np.minimum(a, 1.0) * r


def swing(dur, f_lo, f_hi, peak_at, q, whistle=0.0, body=0.0):
    n = int(SR * dur)
    t = np.linspace(0, 1, n)
    # the blade's speed: a bell around peak_at
    speed = np.exp(-((t - peak_at) / 0.22) ** 2)
    fc = f_lo + (f_hi - f_lo) * speed
    noise = rng.standard_normal(n)
    # two band-pass stages (steeper skirts: a "woosh", not a hiss), the air above 4 kHz rolled off
    x = one_pole_low(svf_band(svf_band(noise, fc, q), fc, q), 4000) * speed ** 1.5
    if whistle:
        ph = np.cumsum(2 * np.pi * (fc * 1.6) / SR)
        x += whistle * np.sin(ph) * speed ** 3
    if body:
        x += body * one_pole_low(noise, 260) * speed ** 2
    return x * env(n, 0.15, 0.85, 1.4)


def impact(dur, thump_f0, thump_f1, thump_len, thwack_fc, crackle, boom=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = np.zeros(n)
    # the bite: a very short broadband click
    click = rng.standard_normal(n) * np.exp(-t / 0.0025)
    x += 0.9 * click
    # the thwack: a mid noise burst
    thw = svf_band(rng.standard_normal(n), np.full(n, thwack_fc), 0.9) * np.exp(-t / 0.035)
    x += 1.4 * thw
    # the straw: a dry crackle — sparse grains for a while
    grains = (rng.random(n) < 0.02) * rng.standard_normal(n)
    x += crackle * svf_band(grains, np.full(n, 2600.0), 1.2) * np.exp(-t / 0.09)
    # the body: a falling sine thump
    f = thump_f1 + (thump_f0 - thump_f1) * np.exp(-t / (thump_len * 0.35))
    ph = np.cumsum(2 * np.pi * f / SR)
    x += 1.2 * np.sin(ph) * np.exp(-t / thump_len)
    if boom:
        bf = 38 + 30 * np.exp(-t / 0.08)
        x += boom * np.sin(np.cumsum(2 * np.pi * bf / SR)) * np.exp(-t / 0.22) * np.clip(t / 0.006, 0, 1)
    fade = np.clip((dur - t) / 0.03, 0, 1)
    return x * fade


save('swing_1', swing(0.17, 420, 1700, 0.42, 0.45, whistle=0.04), 0.75)
save('swing_2', swing(0.26, 300, 1300, 0.5, 0.4, whistle=0.03, body=0.3), 0.8)
save('swing_3', swing(0.30, 200, 950, 0.48, 0.35, whistle=0.02, body=0.8), 0.9)
save('impact_1', impact(0.22, 190, 95, 0.05, 900, 0.8), 0.8)
save('impact_2', impact(0.26, 170, 80, 0.07, 760, 1.0), 0.85)
save('impact_3', impact(0.55, 140, 46, 0.14, 560, 1.3, boom=1.6), 0.95)


def evade(dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    rush = one_pole_low(svf_band(rng.standard_normal(n), np.full(n, 2300.0), 0.6), 6500)
    x = 0.9 * rush * np.exp(-((t - 0.035) / 0.03) ** 2)
    for f, a, d in [(1480, 0.5, 0.17), (2210, 0.45, 0.12), (3370, 0.32, 0.09), (4690, 0.22, 0.06)]:
        fr = f * (1 - 0.05 * (1 - np.exp(-t / 0.09)))
        x += a * np.sin(np.cumsum(2 * np.pi * fr / SR)) * np.exp(-t / d) * np.clip(t / 0.002, 0, 1)
    return x * np.clip((dur - t) / 0.03, 0, 1)


save('evade', evade(0.42), 0.7)


def seal(dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 70 + 60 * np.exp(-t / 0.03)
    x = 0.9 * np.sin(np.cumsum(2 * np.pi * f / SR)) * np.exp(-t / 0.06)
    x += 0.5 * svf_band(rng.standard_normal(n), np.full(n, 900.0), 0.8) * np.exp(-t / 0.04)
    for fr, a, d in [(880, 0.4, 0.22), (1324, 0.3, 0.18), (2210, 0.18, 0.12)]:
        ff = fr * (1 + 0.04 * (1 - np.exp(-t / 0.12)))
        x += a * np.sin(np.cumsum(2 * np.pi * ff / SR)) * np.exp(-t / d) * np.clip(t / 0.01, 0, 1)
    return x * np.clip((dur - t) / 0.03, 0, 1)


def seal_tick(dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = 0.7 * np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.012)
    x += 0.5 * np.sin(2 * np.pi * 1300 * t) * np.exp(-t / 0.03)
    x += 0.35 * np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.06)
    return x * np.clip((dur - t) / 0.02, 0, 1)


def detonation(dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = 1.0 * rng.standard_normal(n) * np.exp(-t / 0.004)
    x += 1.2 * svf_band(rng.standard_normal(n), np.full(n, 420.0), 0.7) * np.exp(-t / 0.08)
    bf = 32 + 40 * np.exp(-t / 0.07)
    x += 2.0 * np.sin(np.cumsum(2 * np.pi * bf / SR)) * np.exp(-t / 0.3) * np.clip(t / 0.005, 0, 1)
    grains = (rng.random(n) < 0.015) * rng.standard_normal(n)
    x += 0.8 * svf_band(grains, np.full(n, 3000.0), 1.2) * np.exp(-t / 0.25)
    return x * np.clip((dur - t) / 0.05, 0, 1)


save('seal', seal(0.4), 0.75)
save('seal_tick', seal_tick(0.14), 0.55)
save('detonation', detonation(0.9), 0.95)
save('execution_swing', swing(0.42, 150, 760, 0.55, 0.3, whistle=0.015, body=1.1), 0.9)
save('execution_impact', impact(0.85, 120, 36, 0.2, 470, 1.5, boom=2.4), 0.97)
