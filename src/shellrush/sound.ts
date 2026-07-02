// Tiny WebAudio helper — synthesised blips so the game has audio with zero assets.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
    }
    return ctx;
}

function blip(freq: number, duration: number, type: OscillatorType, gain = 0.06, delay = 0) {
    const a = ac();
    if (!a) return;
    if (a.state === 'suspended') void a.resume();
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
}

export const sfx = {
    tick: () => blip(880, 0.08, 'square', 0.04),
    start: () => { blip(320, 0.12, 'sawtooth', 0.05); blip(480, 0.14, 'sawtooth', 0.04, 0.06); },
    swap: () => blip(220 + Math.random() * 120, 0.05, 'triangle', 0.025),
    pick: () => blip(660, 0.09, 'square', 0.05),
    win: () => { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.18, 'triangle', 0.06, i * 0.09)); },
    loss: () => { blip(180, 0.3, 'sawtooth', 0.05); blip(120, 0.4, 'sawtooth', 0.05, 0.08); },
};
