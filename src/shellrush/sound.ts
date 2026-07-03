// WebAudio engine — fully synthesised, zero-asset audio tuned to the game's
// neon-casino aesthetic. Provides one-shot SFX (win / loss / cup-shuffle / pick /
// tick / start) plus a looping ambient music bed. No external files, so it ships
// nothing to license and works offline.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        // master -> limiter -> speakers, so we can drive levels loud without hard clipping
        master = ctx.createGain(); master.gain.value = 1.5;
        // gentle limiter — just catches peaks, so nothing distorts but the mix stays clean
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -4; limiter.knee.value = 8; limiter.ratio.value = 6;
        limiter.attack.value = 0.004; limiter.release.value = 0.25;
        master.connect(limiter); limiter.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 4.2; sfxBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.0001; musicBus.connect(master);
        // 2s of white noise, reused for whooshes / hats / sparkle
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
}

/** Resume the context after a user gesture (browsers block audio before one). */
export function resumeAudio() {
    const a = ensure();
    if (a && a.state === 'suspended') void a.resume();
}

// ---- primitive voices ------------------------------------------------------
interface ToneOpts {
    freq: number; dur: number; type?: OscillatorType; gain?: number;
    attack?: number; delay?: number; glideTo?: number; detune?: number;
    bus?: GainNode | null;
}
function tone(o: ToneOpts) {
    const a = ensure(); if (!a) return;
    const bus = o.bus ?? sfxBus!;
    const t0 = a.currentTime + (o.delay ?? 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.dur);
    if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
    const peak = o.gain ?? 0.06;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(bus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
}

interface NoiseOpts {
    dur: number; freq: number; q?: number; gain?: number; delay?: number;
    type?: BiquadFilterType; sweepTo?: number; bus?: GainNode | null;
}
function noiseHit(o: NoiseOpts) {
    const a = ensure(); if (!a || !noise) return;
    const bus = o.bus ?? sfxBus!;
    const t0 = a.currentTime + (o.delay ?? 0);
    const src = a.createBufferSource();
    src.buffer = noise;
    const f = a.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq, t0);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + o.dur);
    f.Q.value = o.q ?? 1;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.05, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t0);
    src.stop(t0 + o.dur + 0.03);
}

/** Equal-temperament note frequency, semitones from A4 (440Hz). */
const NOTE = (semis: number) => 440 * Math.pow(2, semis / 12);

export const sfx = {
    // soft countdown pip
    tick: () => tone({ freq: 880, dur: 0.09, type: 'triangle', gain: 0.05 }),
    // rising "here we go" sweep
    start: () => {
        tone({ freq: 200, dur: 0.5, type: 'sawtooth', gain: 0.05, glideTo: 620 });
        noiseHit({ dur: 0.45, freq: 300, sweepTo: 2600, gain: 0.045, q: 0.7 });
    },
    // one cup sliding across the felt — randomised so repeats feel organic
    swap: () => {
        const base = 480 + Math.random() * 520;
        noiseHit({ dur: 0.17, freq: base, sweepTo: base * 3, gain: 0.035, q: 1.5 });
    },
    // tapping a cup
    pick: () => {
        tone({ freq: 520, dur: 0.12, type: 'square', gain: 0.05, glideTo: 300 });
        noiseHit({ dur: 0.06, freq: 1800, gain: 0.03, q: 0.8 });
    },
    // triumphant ascending arpeggio + warm chord swell + sparkle
    win: () => {
        const root = NOTE(3); // C5
        [0, 4, 7, 12, 16, 19].forEach((s, i) =>
            tone({ freq: root * Math.pow(2, s / 12), dur: 0.42, type: 'triangle', gain: 0.06, delay: i * 0.085, attack: 0.005 }));
        [0, 4, 7].forEach((s) =>
            tone({ freq: NOTE(-9) * Math.pow(2, s / 12), dur: 1.2, type: 'sawtooth', gain: 0.028, delay: 0.1, attack: 0.09 }));
        for (let i = 0; i < 7; i++)
            noiseHit({ dur: 0.13, freq: 4000 + Math.random() * 3500, gain: 0.02, delay: 0.16 + i * 0.06, q: 3 });
    },
    // gentle descending "aww"
    loss: () => {
        tone({ freq: 300, dur: 0.55, type: 'sawtooth', gain: 0.05, glideTo: 120 });
        tone({ freq: 298, dur: 0.55, type: 'sawtooth', gain: 0.04, glideTo: 118, detune: 9 });
        noiseHit({ dur: 0.4, freq: 420, sweepTo: 90, gain: 0.035, type: 'lowpass', q: 0.7, delay: 0.02 });
    },
};

// ---- background music bed --------------------------------------------------
// A clean, spacious lounge loop: a soft kick + round sine bass on the beat, and a
// bright bell melody floating an octave above. Only clear tones — no buzzy saws or
// busy percussion — so it stays crisp under the SFX. Scheduled ahead of the clock.
let musicTimer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextNoteTime = 0;

const BPM = 96;
const STEP = 60 / BPM / 2;   // eighth notes
const STEPS = 32;            // four bars of eight
const LOOKAHEAD = 0.18;

// Am – F – C – G — root + triad (semitones from A4)
const CHORDS = [
    { root: NOTE(-24), triad: [NOTE(-12), NOTE(-9), NOTE(-5)] },  // Am
    { root: NOTE(-28), triad: [NOTE(-16), NOTE(-12), NOTE(-9)] }, // F
    { root: NOTE(-21), triad: [NOTE(-9), NOTE(-5), NOTE(-2)] },   // C
    { root: NOTE(-26), triad: [NOTE(-14), NOTE(-10), NOTE(-7)] }, // G
];
const MELODY = [0, 1, 2, 1]; // chord-tone index per beat — a gentle up/down bell line

function kick(delay: number) {
    const a = ensure(); if (!a || !musicBus) return;
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.11);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    osc.connect(g).connect(musicBus);
    osc.start(t0); osc.stop(t0 + 0.22);
}

function playStep(s: number, delay: number) {
    const bar = Math.floor(s / 8) % 4;
    const chord = CHORDS[bar];
    const b = s % 8;
    // soft kick + round sine bass on beats 1 and 3
    if (b === 0 || b === 4) {
        kick(delay);
        tone({ freq: chord.root, dur: 0.8, type: 'sine', gain: 0.06, attack: 0.012, delay, bus: musicBus });
    }
    if (b % 2 === 0) {
        // clear bell melody, one chord tone per beat, an octave up
        tone({ freq: chord.triad[MELODY[b / 2]] * 2, dur: 0.55, type: 'triangle', gain: 0.04, attack: 0.008, delay, bus: musicBus });
    } else {
        // whisper-soft offbeat hat for a little motion
        noiseHit({ dur: 0.022, freq: 8000, gain: 0.005, q: 2, delay, bus: musicBus });
    }
}

function scheduler() {
    const a = ensure(); if (!a) return;
    // Idle silently until a real user gesture has resumed the context — avoids
    // creating (inaudible) nodes and spamming the browser's autoplay warning.
    if (a.state !== 'running') return;
    // resync the clock after a resume so we don't fire a catch-up burst
    if (nextNoteTime < a.currentTime) nextNoteTime = a.currentTime + 0.05;
    while (nextNoteTime < a.currentTime + LOOKAHEAD) {
        playStep(step, Math.max(0, nextNoteTime - a.currentTime));
        nextNoteTime += STEP;
        step = (step + 1) % STEPS;
    }
}

export const music = {
    start() {
        const a = ensure(); if (!a || !musicBus) return;
        if (a.state === 'suspended') void a.resume();
        musicBus.gain.cancelScheduledValues(a.currentTime);
        musicBus.gain.setTargetAtTime(1.0, a.currentTime, 0.7); // fade in (kept clean under the SFX)
        if (!musicTimer) {
            step = 0;
            nextNoteTime = a.currentTime + 0.12;
            musicTimer = setInterval(scheduler, 40);
        }
    },
    stop() {
        if (musicBus && ctx) musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
        if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
    setEnabled(on: boolean) { if (on) this.start(); else this.stop(); },
};
