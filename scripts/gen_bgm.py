"""
生成内置古风史诗 BGM（无需外部素材）
输出：
  public/audio/bgm-shanhe.wav  —— 主菜单/编辑页（山河·恢弘）
  public/audio/bgm-zhangu.wav  —— 对局（战鼓·激昂）
运行：python scripts/gen_bgm.py
"""
import math
import os
import wave

import numpy as np

SR = 22050
RNG = np.random.default_rng(20261023)

# 五声音阶（D 宫）
D2, A2 = 73.42, 110.00
D3, E3, Fs3, A3, B3 = 146.83, 164.81, 185.00, 220.00, 246.94
D4, E4, Fs4, A4, B4 = 293.66, 329.63, 369.99, 440.00, 493.88
Cs4, D5, E5, Fs5, A5, B5, D6 = 277.18, 587.33, 659.25, 739.99, 880.00, 987.77, 1174.66

D_CHORD = [D3, A3, D4, Fs4, A4]
A_CHORD = [A2, E3, A3, Cs4, E4]


def stereo(sig, pan=0.0):
    if sig.ndim == 2:
        return sig
    pan = float(np.clip(pan, -1.0, 1.0))
    left = math.cos((pan + 1) * math.pi / 4)
    right = math.sin((pan + 1) * math.pi / 4)
    return np.stack([sig * left, sig * right], axis=1)


def place(bus, t0, sig, gain=1.0, pan=0.0):
    start = int(t0 * SR)
    if start >= len(bus):
        return
    data = stereo(sig, pan) * gain
    end = min(len(bus), start + len(data))
    bus[start:end] += data[:end - start]


def adsr(n, attack, release):
    t = np.arange(n) / SR
    dur = n / SR
    a = np.minimum(1.0, t / max(attack, 0.001))
    r = np.minimum(1.0, np.maximum(0.0, (dur - t) / max(release, 0.001)))
    return a * r


def pluck(freq, dur, amp=0.18, pan=0.15, seed=None):
    """古筝式拨弦：干净的谐波叠加 + 极短拨片噪声（避免随机噪声听感发乱）"""
    n = int(dur * SR)
    if n <= 2:
        return np.zeros(n)
    t = np.arange(n) / SR
    phase = (seed or 0) * 0.37
    x = np.zeros(n)
    for k, a, d in ((1, 1.0, 1.7), (2, 0.42, 2.5), (3, 0.2, 3.3), (4, 0.09, 4.2), (5, 0.04, 5.0)):
        x += a * np.sin(2 * np.pi * freq * k * t + phase * k) * np.exp(-t * d)
    # 拨片起音（很短，只保留质感）
    transient = filtered_noise(n, 1800, 7000) * np.exp(-t * 55) * 0.06
    x = (x + transient) * amp
    attack = int(0.004 * SR)
    if attack:
        x[:attack] *= np.linspace(0, 1, attack)
    return stereo(x, pan)


def pad(freq, dur, amp=0.05, pan=0.0, attack=0.9, release=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.35), (3, 0.16), (4, 0.08)):
        x += a * (np.sin(2 * np.pi * freq * k * 1.002 * t)
                  + np.sin(2 * np.pi * freq * k * 0.998 * t)) * 0.5
    x *= adsr(n, attack, release)
    return stereo(x * amp, pan)


def horn(freq, dur, amp=0.045, pan=-0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(1, 9):
        x += (1.0 / k) * np.sin(2 * np.pi * freq * k * t)
    x *= adsr(n, 0.35, 0.9)
    return stereo(x * amp, pan)


def filtered_noise(n, lo, hi):
    noise = RNG.normal(0, 1, n)
    spec = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mask = ((freqs >= lo) & (freqs <= hi)).astype(float)
    return np.fft.irfft(spec * mask, n)


def taiko(dur=0.55, amp=0.4, low=95, high=58, pan=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = low + (high - low) * np.exp(-t * 16)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * np.exp(-t * 8)
    click = filtered_noise(n, 100, 900) * np.exp(-t * 35) * 0.55
    return stereo((body + click) * amp, pan)


def kick(dur=0.35, amp=0.42):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 92 + (45 - 92) * (1 - np.exp(-t * 28))
    phase = 2 * np.pi * np.cumsum(f) / SR
    return stereo(np.sin(phase) * np.exp(-t * 9) * amp, 0.0)


def cymbal(dur=1.4, amp=0.12, pan=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = filtered_noise(n, 2800, 9000)
    noise /= (np.max(np.abs(noise)) + 1e-9)
    return stereo(noise * np.exp(-t * 2.6) * amp, pan)


def gong(dur=3.2, amp=0.24, pan=-0.1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f, a, d in ((98, 0.45, 1.2), (196, 0.22, 1.6), (294, 0.16, 2.0), (392, 0.1, 2.4)):
        x += a * np.sin(2 * np.pi * f * t + 0.4) * np.exp(-t * d)
    noise = filtered_noise(n, 300, 3500)
    noise /= (np.max(np.abs(noise)) + 1e-9)
    x += noise * np.exp(-t * 2.2) * 0.25
    return stereo(x * amp, pan)


def make_ir(seconds=2.2):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    decay = np.exp(-t * 2.4)
    ir_l = RNG.normal(0, 1, n) * decay
    ir_r = RNG.normal(0, 1, n) * decay
    return ir_l, ir_r


def fft_convolve(a, b):
    n = 1 << int(np.ceil(np.log2(len(a) + len(b) - 1)))
    out = np.fft.irfft(np.fft.rfft(a, n) * np.fft.rfft(b, n), n)
    return out[:len(a)]


def add_reverb(mix, wet=0.24, seconds=2.2):
    ir_l, ir_r = make_ir(seconds)
    wet_l = fft_convolve(mix[:, 0], ir_l)
    wet_r = fft_convolve(mix[:, 1], ir_r)
    wet_mix = np.stack([wet_l, wet_r], axis=1)
    peak = np.max(np.abs(wet_mix)) + 1e-9
    wet_mix /= peak
    return mix * (1 - wet) + wet_mix * wet * np.max(np.abs(mix))


def soften(mix, cutoff=6500):
    """温和低通，去掉刺耳高频，让古风听感更沉稳"""
    n = len(mix)
    spec = np.fft.rfft(mix, axis=0)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mask = 1.0 / (1.0 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec * mask[:, None], n, axis=0)


def compose(preset):
    is_battle = preset == 'battle'
    bpm = 78 if is_battle else 66
    beat = 60.0 / bpm
    bar = beat * 4
    bars = 8
    total = bar * bars
    tail = 3.0
    length = int((total + tail) * SR)
    mix = np.zeros((length, 2))

    # 每两小节一个和弦：D – A – D – A。层次少、留白多，突出恢弘感。
    blocks = [(0, 2, D_CHORD), (2, 4, A_CHORD), (4, 6, D_CHORD), (6, 8, A_CHORD)]
    for start, end, chord in blocks:
        t0 = start * bar
        dur = (end - start) * bar + 1.4
        # 三声部弦乐铺底（只取根音/五度/八度）
        for j, f in enumerate(chord[:3]):
            place(mix, t0, pad(
                f, dur,
                amp=0.06 if j == 0 else 0.045,
                pan=(-0.18 if j == 1 else 0.18),
                attack=1.4, release=2.2,
            ), 1.0)
        # 低音持续音
        place(mix, t0, pad(chord[0] / 2, dur, amp=0.038, pan=0.0,
                           attack=1.0, release=2.4), 1.0)

    # 主旋律：长音为主、句尾留白（古筝）
    if is_battle:
        melody = [
            (0, 0.0, A4, 1.8), (0, 2.0, D5, 1.8),
            (1, 0.0, E5, 1.6), (1, 1.8, D5, 2.0),
            (2, 0.0, B4, 1.8), (2, 2.0, A4, 1.8),
            (3, 0.0, D5, 3.6),
            (4, 0.0, Fs5, 1.8), (4, 2.0, E5, 1.8),
            (5, 0.0, D5, 1.8), (5, 2.0, B4, 1.8),
            (6, 0.0, A4, 1.8), (6, 2.0, B4, 1.8),
            (7, 0.0, D5, 3.8),
        ]
    else:
        melody = [
            (0, 0.0, A4, 2.2), (0, 2.2, D5, 2.2),
            (1, 0.0, E5, 2.6), (1, 2.6, D5, 2.2),
            (2, 0.0, B4, 2.2), (2, 2.2, A4, 2.2),
            (3, 0.0, D5, 4.0),
            (4, 0.0, Fs5, 2.2), (4, 2.2, E5, 2.2),
            (5, 0.0, D5, 2.6), (5, 2.6, B4, 2.2),
            (6, 0.0, A4, 2.2), (6, 2.2, B4, 2.2),
            (7, 0.0, A5, 4.0),
        ]

    for idx, (b, off, freq, dur) in enumerate(melody):
        note_sec = min(dur * beat, 4.0)
        place(mix, b * bar + off * beat,
              pluck(freq, note_sec + 0.35, amp=0.17, pan=0.22, seed=idx + 21), 1.0)
        # 战鼓曲仅在乐句起点加低八度，增加厚度但不加花
        if is_battle and b in (0, 2, 4, 6) and off == 0.0:
            place(mix, b * bar,
                  pluck(freq / 2, min(dur * beat * 0.7, 3.0) + 0.3,
                        amp=0.05, pan=-0.12, seed=idx + 91), 1.0)

    # 打击乐：只保留大鼓/大锣骨架，不做密集节奏
    place(mix, 0, gong(4.2, amp=0.18 if is_battle else 0.14), 1.0)
    if is_battle:
        for b in range(bars):
            amp = 0.30 if b % 4 == 0 else 0.16
            place(mix, b * bar, taiko(amp=amp, low=92, high=56), 1.0)
        place(mix, 0, kick(amp=0.26), 1.0)
        place(mix, 4 * bar, kick(amp=0.22), 1.0)
        place(mix, 0, cymbal(2.4, amp=0.05, pan=-0.15), 1.0)
        place(mix, 4 * bar, cymbal(2.4, amp=0.04, pan=0.15), 1.0)
    else:
        for b in (0, 4):
            place(mix, b * bar, taiko(amp=0.16, low=86, high=52), 1.0)
        # 极轻的低频脉动，保持庄重而不吵
        for b in (2, 6):
            place(mix, b * bar, taiko(amp=0.07, low=80, high=50), 1.0)

    mix = add_reverb(mix, wet=0.18)
    mix = soften(mix, 6500 if not is_battle else 6000)
    # 用混响尾音与开头做极短交叉淡化，既保证循环无缝又保留开场重音
    loop_len = int(total * SR)
    fade_len = int(0.06 * SR)
    for i in range(fade_len):
        w = i / fade_len
        mix[i] = mix[i] * w + mix[loop_len + i] * (1 - w)
    mix = mix[:loop_len]

    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.9
    return mix


def write_wav(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = np.clip(data, -1, 1)
    pcm = (pcm * 32767).astype('<i2')
    with wave.open(path, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    print(f'wrote {path}  {len(data)/SR:.1f}s  {os.path.getsize(path)/1024/1024:.2f} MB')


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    write_wav(os.path.join(root, 'public', 'audio', 'bgm-shanhe.wav'), compose('menu'))
    write_wav(os.path.join(root, 'public', 'audio', 'bgm-zhangu.wav'), compose('battle'))
