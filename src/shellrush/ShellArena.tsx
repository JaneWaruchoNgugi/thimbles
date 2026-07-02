import { useEffect, useRef } from 'react';
import type { GamePhase } from './types';
import { sfx } from './sound';
import { mulberry32 } from './rng';

interface Props {
    phase: GamePhase;
    shellCount: number;
    gemShellId: number;
    pickedSlot: number | null;
    accent: string;
    soundEnabled: boolean;
    onPick: (slot: number, isGem: boolean) => void;
    /** When set, the shuffle is deterministic — every device with the same seed ends identically. */
    seed?: number;
}

interface Shell {
    id: number;
    slot: number;
    x: number;
    // swap animation
    ax: number;
    bx: number;
    t: number;      // elapsed ms
    dur: number;    // 0 when idle
    arc: number;
    teleport: boolean;
    alpha: number;
    lift: number;
    liftTarget: number;
    glow: number;
    glowTarget: number;
    trail: { x: number; y: number; life: number }[];
}

interface Pulse { x: number; y: number; r: number; maxR: number; life: number; }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

export function ShellArena(props: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    useEffect(() => {
        if (!canvasRef.current || !wrapRef.current) return;
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        const maybeCtx = canvas.getContext('2d');
        if (!maybeCtx) return;
        const ctx: CanvasRenderingContext2D = maybeCtx;

        let W = 0;
        let H = 0;
        let dpr = 1;
        let raf = 0;
        let last = performance.now();

        // Engine state
        let shells: Shell[] = [];
        let phaseLocal: GamePhase = 'idle';
        let shuffleStart = 0;
        let nextSwapAt = 0;
        let nextFakeGlowAt = 0;
        let shake = 0;
        let pulses: Pulse[] = [];
        let hoverSlot = -1;
        let gemPulse = 0;
        // deterministic (seeded) shuffle plan
        let swapPlan: { a: number; b: number }[] = [];
        let swapAt: number[] = [];
        let swapIdx = 0;

        // cached, blurred lounge background (re-rendered only on resize)
        const bg = document.createElement('canvas');
        const bctx = bg.getContext('2d');

        // cup sprite (rendered art with transparent background)
        const cupImg = new Image();
        let cupReady = false;
        const cupAspect = { w: 787, h: 1003 };
        cupImg.onload = () => { cupReady = true; cupAspect.w = cupImg.width; cupAspect.h = cupImg.height; };
        cupImg.src = '/cup.png';

        const platformY = () => H * 0.67;
        const shellW = () => Math.min(H * 0.31, (W * 0.9) / propsRef.current.shellCount * 0.8);
        const shellH = () => shellW() * 1.18;
        const slotX = (slot: number) => {
            const n = propsRef.current.shellCount;
            const usable = W * 0.9;
            const start = (W - usable) / 2;
            return start + (usable / n) * (slot + 0.5);
        };

        function rebuild(n: number) {
            shells = Array.from({ length: n }, (_, i) => ({
                id: i,
                slot: i,
                x: slotX(i),
                ax: slotX(i),
                bx: slotX(i),
                t: 0,
                dur: 0,
                arc: 0,
                teleport: false,
                alpha: 1,
                lift: 0,
                liftTarget: 0,
                glow: 0,
                glowTarget: 0,
                trail: [],
            }));
        }

        function shellAtSlot(slot: number) {
            return shells.find((s) => s.slot === slot);
        }

        function startSwap(a: Shell, b: Shell, teleport: boolean) {
            const sa = a.slot;
            a.slot = b.slot;
            b.slot = sa;
            const dur = teleport ? 360 : 440;
            const dist = Math.abs(slotX(a.slot) - a.x);
            for (const s of [a, b]) {
                s.ax = s.x;
                s.bx = slotX(s.slot);
                s.t = 0;
                s.dur = dur;
                s.teleport = teleport;
                s.arc = teleport ? 0 : Math.min(shellH() * 0.7, dist * 0.35) * (s === a ? 1 : -1);
            }
            if (propsRef.current.soundEnabled) sfx.swap();
        }

        function scheduleSwaps(now: number) {
            const P = propsRef.current;
            if (now < nextSwapAt) return;
            if (now > shuffleStart + 3800 - 650) return; // let shells settle before pick
            const idle = shells.filter((s) => s.dur === 0);
            if (idle.length < 2) {
                nextSwapAt = now + 120;
                return;
            }
            const a = idle[Math.floor(Math.random() * idle.length)];
            let b = idle[Math.floor(Math.random() * idle.length)];
            let guard = 0;
            while (b === a && guard++ < 10) b = idle[Math.floor(Math.random() * idle.length)];
            if (b === a) return;
            const teleport = Math.random() < 0.22 && Math.abs(a.slot - b.slot) >= 2;
            startSwap(a, b, teleport);
            void P;
            nextSwapAt = now + 320 + Math.random() * 180;
        }

        // Deterministic shuffle: apply the pre-built seeded plan by index.
        function applyPlanSwaps(now: number) {
            while (swapIdx < swapPlan.length && now >= shuffleStart + swapAt[swapIdx]) {
                const { a, b } = swapPlan[swapIdx];
                const sa = shellAtSlot(a);
                const sb = shellAtSlot(b);
                if (sa && sb && sa !== sb) startSwap(sa, sb, false);
                swapIdx++;
            }
        }

        function buildSwapPlan(seed: number, n: number) {
            const rng = mulberry32(seed);
            const count = 6 + Math.floor(rng() * 3); // 6–8 swaps
            swapPlan = [];
            swapAt = [];
            for (let i = 0; i < count; i++) {
                const a = Math.floor(rng() * n);
                let b = Math.floor(rng() * n);
                let g = 0;
                while (b === a && g++ < 10) b = Math.floor(rng() * n);
                if (b === a) b = (a + 1) % n;
                swapPlan.push({ a, b });
                swapAt.push(500 + i * 470);
            }
            swapIdx = 0;
        }

        function scheduleFakeGlow(now: number) {
            if (now < nextFakeGlowAt) return;
            const P = propsRef.current;
            const decoys = shells.filter((s) => s.id !== P.gemShellId);
            if (decoys.length) {
                const d = decoys[Math.floor(Math.random() * decoys.length)];
                d.glowTarget = 1;
                setTimeout(() => { d.glowTarget = 0; }, 420);
            }
            nextFakeGlowAt = now + 700 + Math.random() * 500;
        }

        function onPhaseChange(from: GamePhase, to: GamePhase) {
            const P = propsRef.current;
            if (to === 'peek') {
                shells.forEach((s) => { s.liftTarget = 1; s.glowTarget = 0; s.trail = []; });
                gemPulse = 0;
            } else if (to === 'shuffling') {
                shells.forEach((s) => { s.liftTarget = 0; s.glowTarget = 0; });
                shuffleStart = performance.now();
                nextSwapAt = shuffleStart + 500;
                nextFakeGlowAt = shuffleStart + 900;
                if (P.seed != null) buildSwapPlan(P.seed >>> 0, P.shellCount);
                else swapPlan = [];
            } else if (to === 'picking') {
                shells.forEach((s) => { s.glowTarget = 0; });
            } else if (to === 'revealing') {
                const picked = P.pickedSlot != null ? shellAtSlot(P.pickedSlot) : undefined;
                if (picked) picked.liftTarget = 1;
            } else if (to === 'result') {
                const picked = P.pickedSlot != null ? shellAtSlot(P.pickedSlot) : undefined;
                const won = !!picked && picked.id === P.gemShellId;
                if (won && picked) {
                    picked.glowTarget = 1;
                    shake = 1;
                    const gx = slotX(picked.slot);
                    const gy = platformY();
                    for (let i = 0; i < 3; i++) {
                        pulses.push({ x: gx, y: gy, r: shellW() * 0.4, maxR: shellW() * (2.4 + i * 0.7), life: 1 });
                    }
                } else {
                    // reveal where the gem actually was
                    const gemShell = shells.find((s) => s.id === P.gemShellId);
                    if (gemShell) { gemShell.liftTarget = 1; gemShell.glowTarget = 1; }
                }
            } else if (to === 'idle') {
                shells.forEach((s) => { s.liftTarget = 0; s.glowTarget = 0; s.trail = []; });
                pulses = [];
            }
            void from;
        }

        // ---- Drawing ----
        // Build the deep purple/magenta neon-lounge backdrop once per resize.
        function renderBackground() {
            if (!bctx) return;
            bg.width = Math.max(1, Math.round(W * dpr));
            bg.height = Math.max(1, Math.round(H * dpr));
            const c = bctx;
            c.setTransform(dpr, 0, 0, dpr, 0, 0);
            c.clearRect(0, 0, W, H);

            // base wall gradient — deep green top into near-black
            const base = c.createLinearGradient(0, 0, 0, H);
            base.addColorStop(0, '#0c2113');
            base.addColorStop(0.45, '#08160c');
            base.addColorStop(1, '#03100a');
            c.fillStyle = base;
            c.fillRect(0, 0, W, H);

            // green glow bloom behind the cups
            const bloom = c.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, W * 0.6);
            bloom.addColorStop(0, 'rgba(70,205,90,0.26)');
            bloom.addColorStop(0.5, 'rgba(40,170,80,0.12)');
            bloom.addColorStop(1, 'rgba(40,170,80,0)');
            c.fillStyle = bloom;
            c.fillRect(0, 0, W, H);

            // blurred neon panels (casino bokeh) — greens + a couple of warm accents
            const palette = ['#5be23a', '#2fd11e', '#12b36a', '#8ef23c', '#39e08a', '#a6f24c'];
            c.save();
            c.filter = 'blur(9px)';
            for (let i = 0; i < 46; i++) {
                const rx = ((i * 73 + 17) % 100) / 100;
                const ry = ((i * 41 + 7) % 100) / 100;
                const x = rx * W;
                const y = ry * H * 0.6;
                const pw = 5 + ((i * 13) % 14);
                const ph = 22 + ((i * 29) % 70);
                c.globalAlpha = 0.18 + ((i * 17) % 10) / 22;
                c.fillStyle = palette[i % palette.length];
                const rr = 3;
                c.beginPath();
                c.roundRect(x - pw / 2, y - ph / 2, pw, ph, rr);
                c.fill();
            }
            // soft round bokeh
            for (let i = 0; i < 16; i++) {
                const x = ((i * 89 + 31) % 100) / 100 * W;
                const y = ((i * 57 + 11) % 100) / 100 * H * 0.5;
                const r = 6 + ((i * 11) % 16);
                c.globalAlpha = 0.1 + ((i * 7) % 6) / 40;
                c.fillStyle = palette[(i + 2) % palette.length];
                c.beginPath();
                c.arc(x, y, r, 0, Math.PI * 2);
                c.fill();
            }
            c.restore();

            // cinematic vignette
            const vig = c.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, W * 0.75);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, 'rgba(0,0,0,0.6)');
            c.fillStyle = vig;
            c.fillRect(0, 0, W, H);
        }

        function drawBackground() {
            // blit the cached backdrop at device resolution (unaffected by camera shake)
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(bg, 0, 0);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function drawPlatform(accent: string) {
            const cx = W / 2;
            const cy = platformY() + shellH() * 0.18;
            const rx = W * 0.46;
            const ry = rx * 0.28;
            const { r, g, b } = hexToRgb(accent);
            const purple = { r: 22, g: 168, b: 96 };

            ctx.save();

            // soft cast shadow beneath the platform
            const sh = ctx.createRadialGradient(cx, cy + ry * 0.5, 0, cx, cy + ry * 0.5, rx * 1.05);
            sh.addColorStop(0, 'rgba(0,0,0,0.55)');
            sh.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = sh;
            ctx.beginPath();
            ctx.ellipse(cx, cy + ry * 0.55, rx * 1.05, ry * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();

            // elevated side wall (gives the disc thickness)
            const wallH = ry * 0.5;
            const wall = ctx.createLinearGradient(0, cy, 0, cy + wallH);
            wall.addColorStop(0, 'rgba(20,44,26,0.95)');
            wall.addColorStop(1, 'rgba(6,16,10,0.95)');
            ctx.fillStyle = wall;
            ctx.beginPath();
            ctx.ellipse(cx, cy + wallH, rx, ry, 0, 0, Math.PI, false);
            ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
            ctx.closePath();
            ctx.fill();

            // glossy top disc
            const disc = ctx.createRadialGradient(cx, cy - ry * 0.3, ry * 0.1, cx, cy, rx);
            disc.addColorStop(0, 'rgba(34,56,36,0.98)');
            disc.addColorStop(0.55, 'rgba(14,28,18,0.98)');
            disc.addColorStop(1, 'rgba(7,16,10,0.98)');
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = disc;
            ctx.fill();

            // top-edge specular sheen
            ctx.save();
            ctx.clip();
            const gloss = ctx.createLinearGradient(0, cy - ry, 0, cy);
            gloss.addColorStop(0, 'rgba(150,220,140,0.22)');
            gloss.addColorStop(1, 'rgba(150,220,140,0)');
            ctx.fillStyle = gloss;
            ctx.fillRect(cx - rx, cy - ry, rx * 2, ry);
            ctx.restore();

            // concentric neon rings (cyan + purple), glowing
            const ring = (scale: number, col: { r: number; g: number; b: number }, a: number, lw: number) => {
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx * scale, ry * scale, 0, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${a})`;
                ctx.lineWidth = lw;
                ctx.shadowColor = `rgb(${col.r},${col.g},${col.b})`;
                ctx.shadowBlur = 22;
                ctx.stroke();
            };
            ring(1.0, { r, g, b }, 0.9, 3);       // bright outer edge
            ring(0.82, purple, 0.6, 2);
            ring(0.6, { r, g, b }, 0.7, 2);
            ring(0.4, purple, 0.45, 1.5);
            ctx.restore();
        }

        function drawGem(x: number, y: number, scale: number, alpha: number) {
            const s = shellW() * 0.28 * scale;
            const pulse = 1 + Math.sin(gemPulse * 4) * 0.08;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y - s * 0.2);
            // halo
            const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.4 * pulse);
            halo.addColorStop(0, 'rgba(120,240,255,0.55)');
            halo.addColorStop(0.4, 'rgba(80,200,255,0.25)');
            halo.addColorStop(1, 'rgba(80,200,255,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(0, 0, s * 2.4 * pulse, 0, Math.PI * 2);
            ctx.fill();
            // diamond
            ctx.shadowColor = '#7ff0ff';
            ctx.shadowBlur = 24;
            const grad = ctx.createLinearGradient(0, -s, 0, s);
            grad.addColorStop(0, '#eaffff');
            grad.addColorStop(0.5, '#5fd8ff');
            grad.addColorStop(1, '#2f9bd6');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.8, -s * 0.2);
            ctx.lineTo(0, s);
            ctx.lineTo(-s * 0.8, -s * 0.2);
            ctx.closePath();
            ctx.fill();
            // facet
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-s * 0.8, -s * 0.2);
            ctx.lineTo(s * 0.8, -s * 0.2);
            ctx.moveTo(0, -s);
            ctx.lineTo(0, s);
            ctx.stroke();
            ctx.restore();
        }


        function drawShell(s: Shell, accent: string, highlight: boolean) {
            const w = shellW();
            const h = shellH();
            const cx = s.x;
            const baseY = platformY() - s.lift * (h * 0.95);
            const { r, g, b } = hexToRgb(accent);
            const glow = Math.max(s.glow, highlight ? 0.9 : 0);

            ctx.save();
            ctx.globalAlpha = s.alpha;

            // soft dark contact shadow on the platform
            const ringY = platformY() + h * 0.04;
            ctx.save();
            ctx.globalAlpha = s.alpha * 0.5 * (1 - s.lift * 0.6);
            const under = ctx.createRadialGradient(cx, ringY, 0, cx, ringY, w * 0.7);
            under.addColorStop(0, 'rgba(0,0,0,0.55)');
            under.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = under;
            ctx.beginPath();
            ctx.ellipse(cx, ringY, w * 0.66, w * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // trail (behind the cup)
            for (const p of s.trail) {
                ctx.globalAlpha = s.alpha * p.life * 0.35;
                const tg = ctx.createRadialGradient(p.x, baseY - h * 0.4, 0, p.x, baseY - h * 0.4, w * 0.5);
                tg.addColorStop(0, `rgba(${r},${g},${b},0.8)`);
                tg.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = tg;
                ctx.beginPath();
                ctx.ellipse(p.x, baseY - h * 0.45, w * 0.42, h * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = s.alpha;

            const topW = w * 0.64;
            const botW = w;
            const topY = baseY - h;

            // glow behind cup when active
            if (glow > 0.01) {
                ctx.save();
                ctx.shadowColor = accent;
                ctx.shadowBlur = 30 * glow;
                ctx.strokeStyle = `rgba(${r},${g},${b},${glow})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(cx, baseY - h * 0.5, botW * 0.52, h * 0.55, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // ---- draw the cup sprite (green top / dark body / engraved silver band) ----
            const spriteW = w * 1.14;
            const spriteH = spriteW * (cupAspect.h / cupAspect.w);
            const spriteX = cx - spriteW / 2;
            const spriteBottom = baseY + h * 0.1;
            const spriteY = spriteBottom - spriteH;

            if (cupReady) {
                ctx.drawImage(cupImg, spriteX, spriteY, spriteW, spriteH);
            } else {
                // simple fallback while the sprite loads
                ctx.fillStyle = '#12160c';
                ctx.beginPath();
                ctx.moveTo(cx - botW / 2, baseY);
                ctx.lineTo(cx - topW / 2, topY);
                ctx.lineTo(cx + topW / 2, topY);
                ctx.lineTo(cx + botW / 2, baseY);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }

        function drawCup(s: Shell, accent: string, hovered: boolean) {
            drawShell(s, accent, hovered);
        }

        // A bouncing "YOUR PICK" pin above the cup the player selected.
        function drawPickMarker(x: number) {
            const bob = Math.sin(gemPulse * 6) * shellH() * 0.03;
            const y = platformY() - shellH() * 1.12 + bob;
            const s = shellW() * 0.15;
            ctx.save();
            ctx.translate(x, y);

            // glowing pill label
            ctx.shadowColor = '#6cff3a';
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#7dff45';
            ctx.font = `700 ${Math.max(9, s * 0.7)}px Rajdhani, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = 'YOUR PICK';
            const tw = ctx.measureText(label).width;
            const padX = s * 0.6;
            const pillW = tw + padX * 2;
            const pillH = s * 1.5;
            ctx.beginPath();
            ctx.roundRect(-pillW / 2, -pillH / 2 - s * 0.4, pillW, pillH, pillH / 2);
            ctx.fillStyle = 'rgba(10,26,12,0.92)';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#7dff45';
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#c8ffa0';
            ctx.fillText(label, 0, -s * 0.4);

            // downward pointer
            ctx.shadowColor = '#6cff3a';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#7dff45';
            ctx.beginPath();
            ctx.moveTo(-s * 0.55, pillH / 2 - s * 0.4);
            ctx.lineTo(s * 0.55, pillH / 2 - s * 0.4);
            ctx.lineTo(0, pillH / 2 + s * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        function drawPulses() {
            for (const p of pulses) {
                ctx.save();
                ctx.globalAlpha = p.life * 0.6;
                ctx.strokeStyle = `rgba(130,240,80,${p.life})`;
                ctx.lineWidth = 4 * p.life + 1;
                ctx.shadowColor = '#6cff3a';
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        function frame(now: number) {
            const dt = Math.min(48, now - last);
            last = now;
            const P = propsRef.current;

            // sync with react props
            if (shells.length !== P.shellCount && (P.phase === 'idle' || phaseLocal === 'idle')) {
                rebuild(P.shellCount);
            }
            if (P.phase !== phaseLocal) {
                const from = phaseLocal;
                phaseLocal = P.phase;
                onPhaseChange(from, P.phase);
            }

            gemPulse += dt / 1000;

            // per-shell updates
            for (const s of shells) {
                if (s.dur > 0) {
                    s.t += dt;
                    const t = Math.min(1, s.t / s.dur);
                    if (s.teleport) {
                        s.alpha = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
                        s.x = t < 0.5 ? s.ax : s.bx;
                    } else {
                        s.x = lerp(s.ax, s.bx, easeInOut(t));
                    }
                    // trail while moving fast
                    if (P.phase === 'shuffling') {
                        s.trail.push({ x: s.x, y: 0, life: 1 });
                        if (s.trail.length > 10) s.trail.shift();
                    }
                    if (t >= 1) { s.dur = 0; s.x = s.bx; s.alpha = 1; s.arc = 0; }
                } else {
                    // settle to slot when idle (e.g. after difficulty change)
                    const target = slotX(s.slot);
                    if (Math.abs(s.x - target) > 0.5) s.x = lerp(s.x, target, 0.2);
                    else s.x = target;
                    s.alpha = lerp(s.alpha, 1, 0.2);
                }
                // decay trail
                for (const p of s.trail) p.life -= dt / 260;
                s.trail = s.trail.filter((p) => p.life > 0);
                // ease lift + glow
                s.lift += (s.liftTarget - s.lift) * Math.min(1, dt / 140);
                s.glow += (s.glowTarget - s.glow) * Math.min(1, dt / 120);
            }

            if (P.phase === 'shuffling') {
                if (P.seed != null) applyPlanSwaps(now);
                else scheduleSwaps(now);
                scheduleFakeGlow(now);
            }

            // pulses + shake
            for (const p of pulses) { p.r += dt * 0.5; p.life -= dt / 900; }
            pulses = pulses.filter((p) => p.life > 0 && p.r < p.maxR);
            shake *= Math.pow(0.9, dt / 16);
            if (shake < 0.01) shake = 0;

            // ---- render ----
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            drawBackground();

            const sx = shake ? (Math.random() - 0.5) * shake * 16 : 0;
            const sy = shake ? (Math.random() - 0.5) * shake * 16 : 0;
            ctx.save();
            ctx.translate(sx, sy);

            drawPlatform(P.accent);

            const showGemUnder = (slot: number) => {
                const gemShell = shells.find((sh) => sh.id === P.gemShellId);
                return !!gemShell && gemShell.slot === slot;
            };
            const gemVisible = P.phase === 'peek'
                || ((P.phase === 'revealing' || P.phase === 'result') && (() => {
                    const gemShell = shells.find((sh) => sh.id === P.gemShellId);
                    return !!gemShell && gemShell.lift > 0.4;
                })());

            // Draw gem first if it should show under a lifted shell
            if (gemVisible) {
                const gemShell = shells.find((sh) => sh.id === P.gemShellId);
                if (gemShell) {
                    const reveal = Math.max(gemShell.lift, P.phase === 'peek' ? 1 : 0);
                    drawGem(slotX(gemShell.slot), platformY(), reveal, Math.min(1, reveal + 0.2));
                }
            }
            void showGemUnder;

            // draw shells back-to-front (higher lift on top, and by y)
            const order = [...shells].sort((a, b) => a.lift - b.lift);
            for (const s of order) {
                const isPicked = (P.phase === 'picking' || P.phase === 'revealing') && s.slot === P.pickedSlot;
                const hovered = (P.phase === 'picking' && s.slot === hoverSlot) || isPicked;
                drawCup(s, P.accent, hovered);
            }

            // "YOUR PICK" marker above the cup the player chose
            if ((P.phase === 'picking' || P.phase === 'revealing') && P.pickedSlot != null) {
                drawPickMarker(slotX(P.pickedSlot));
            }

            drawPulses();
            ctx.restore();

            raf = requestAnimationFrame(frame);
        }

        // ---- sizing ----
        function resize() {
            const rect = wrap.getBoundingClientRect();
            W = rect.width;
            H = rect.height;
            dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;
            renderBackground();
            // reposition shells to new slot coords
            for (const s of shells) { if (s.dur === 0) s.x = slotX(s.slot); }
        }

        rebuild(propsRef.current.shellCount);
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrap);
        raf = requestAnimationFrame(frame);

        // ---- pointer ----
        function pointToSlot(clientX: number, clientY: number) {
            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const w = shellW();
            const baseY = platformY();
            let best = -1;
            let bestD = Infinity;
            for (const s of shells) {
                const dx = Math.abs(x - s.x);
                const dy = Math.abs(y - (baseY - shellH() * 0.5));
                if (dx < w * 0.6 && dy < shellH() * 0.9) {
                    const d = dx;
                    if (d < bestD) { bestD = d; best = s.slot; }
                }
            }
            return best;
        }

        function onMove(e: PointerEvent) {
            if (propsRef.current.phase !== 'picking') { hoverSlot = -1; return; }
            hoverSlot = pointToSlot(e.clientX, e.clientY);
            canvas.style.cursor = hoverSlot >= 0 ? 'pointer' : 'default';
        }
        function onLeave() { hoverSlot = -1; }
        function onDown(e: PointerEvent) {
            if (propsRef.current.phase !== 'picking') return;
            const slot = pointToSlot(e.clientX, e.clientY);
            if (slot < 0) return;
            const shell = shells.find((s) => s.slot === slot);
            if (!shell) return;
            propsRef.current.onPick(slot, shell.id === propsRef.current.gemShellId);
        }

        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerleave', onLeave);
        canvas.addEventListener('pointerdown', onDown);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerleave', onLeave);
            canvas.removeEventListener('pointerdown', onDown);
        };
    }, []);

    return (
        <div className="arena-canvas-wrap" ref={wrapRef}>
            <canvas ref={canvasRef} />
        </div>
    );
}
