import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GamePhase } from './types';
import { LiveArena3D } from './LiveArena3D';
import { mulberry32 } from './rng';
import { BET_PRESETS, CHIP_COLORS, MIN_BET, PLAYER_NAMES } from './data';
import { sfx } from './sound';
import * as Icon from './icons';

// ---- shared round schedule (clock-driven, identical on every device) ----
const LIVE_CUPS = 3;
const LIVE_MULT = 2.8;
const BET_MS = 8000;
const SHUF_MS = 5000;
const PICK_MS = 6000;
const REVEAL_MS = 3000;
const BREAK_MS = 2000;
const CYCLE = BET_MS + SHUF_MS + PICK_MS + REVEAL_MS + BREAK_MS; // 24s

type Sub = 'betting' | 'shuffling' | 'picking' | 'reveal' | 'break';

interface Round {
    index: number;
    sub: Sub;
    gamePhase: GamePhase;
    remaining: number; // whole seconds left in this sub-phase
    gemCup: number;
}

function computeRound(now: number): Round {
    const index = Math.floor(now / CYCLE);
    const t = now - index * CYCLE;
    let sub: Sub; let gamePhase: GamePhase; let end: number;
    if (t < BET_MS) { sub = 'betting'; gamePhase = 'peek'; end = BET_MS; }
    else if (t < BET_MS + SHUF_MS) { sub = 'shuffling'; gamePhase = 'shuffling'; end = BET_MS + SHUF_MS; }
    else if (t < BET_MS + SHUF_MS + PICK_MS) { sub = 'picking'; gamePhase = 'picking'; end = BET_MS + SHUF_MS + PICK_MS; }
    else if (t < BET_MS + SHUF_MS + PICK_MS + REVEAL_MS) { sub = 'reveal'; gamePhase = 'result'; end = BET_MS + SHUF_MS + PICK_MS + REVEAL_MS; }
    else { sub = 'break'; gamePhase = 'idle'; end = CYCLE; }
    const gemCup = Math.floor(mulberry32(index)() * LIVE_CUPS);
    return { index, sub, gamePhase, remaining: Math.max(0, Math.ceil((end - t) / 1000)), gemCup };
}

interface SimPlayer { name: string; bet: number; pick: number; }
function simPlayers(index: number): SimPlayer[] {
    const rng = mulberry32((index * 2654435761) >>> 0);
    const count = 5 + Math.floor(rng() * 4);
    const out: SimPlayer[] = [];
    for (let i = 0; i < count; i++) {
        const name = `${PLAYER_NAMES[Math.floor(rng() * PLAYER_NAMES.length)]}_${100 + Math.floor(rng() * 899)}`;
        out.push({ name, bet: BET_PRESETS[Math.floor(rng() * BET_PRESETS.length)], pick: Math.floor(rng() * LIVE_CUPS) });
    }
    return out;
}

interface Entry {
    round: number;
    bet: number;
    pickedSlot: number | null;
    pickedIsGem: boolean;
    settled: boolean;
    outcome: 'win' | 'loss' | 'refund' | null;
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
    balance: number;
    setBalance: Dispatch<SetStateAction<number>>;
    soundEnabled: boolean;
    onClose: () => void;
}

export function LiveGame({ balance, setBalance, soundEnabled, onClose }: Props) {
    const [now, setNow] = useState(() => Date.now());
    const round = computeRound(now);
    const [betAmount, setBetAmount] = useState(10);
    const [entry, setEntry] = useState<Entry | null>(null);
    const [playersOpen, setPlayersOpen] = useState(false);
    const [online] = useState(() => 900 + Math.floor(Math.random() * 700));

    // tick the shared clock
    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), 150);
        return () => clearInterval(iv);
    }, []);

    // clear a stale entry once a new round begins
    useEffect(() => {
        setEntry((e) => (e && e.round !== round.index ? null : e));
    }, [round.index]);

    // settle the player's entry at reveal (once)
    const settledRef = useRef<number | null>(null);
    useEffect(() => {
        if (round.sub !== 'reveal') return;
        if (!entry || entry.round !== round.index || entry.settled) return;
        if (settledRef.current === round.index) return;
        settledRef.current = round.index;
        if (entry.pickedSlot !== null) {
            const won = entry.pickedIsGem;
            if (won) {
                setBalance((b) => b + Math.round(entry.bet * LIVE_MULT));
                if (soundEnabled) sfx.win();
            } else if (soundEnabled) sfx.loss();
            setEntry((e) => (e ? { ...e, settled: true, outcome: won ? 'win' : 'loss' } : e));
        } else {
            // placed a bet but never picked — refund, no harm
            setBalance((b) => b + entry.bet);
            setEntry((e) => (e ? { ...e, settled: true, outcome: 'refund' } : e));
        }
    }, [round.sub, round.index, entry, setBalance, soundEnabled]);

    const players = useMemo(() => simPlayers(round.index), [round.index]);
    const joined = !!entry && entry.round === round.index;
    const canBet = round.sub === 'betting' && !joined && balance >= betAmount && betAmount >= MIN_BET;

    const placeBet = () => {
        if (!canBet) return;
        if (soundEnabled) sfx.start();
        setBalance((b) => b - betAmount);
        setEntry({ round: round.index, bet: betAmount, pickedSlot: null, pickedIsGem: false, settled: false, outcome: null });
    };

    const onPick = (slot: number, isGem: boolean) => {
        setEntry((e) => {
            if (!e || e.round !== round.index || e.pickedSlot !== null) return e;
            if (soundEnabled) sfx.pick();
            return { ...e, pickedSlot: slot, pickedIsGem: isGem };
        });
    };

    const statusText = (() => {
        switch (round.sub) {
            case 'betting': return joined ? 'BET PLACED — GET READY' : 'PLACE YOUR BET';
            case 'shuffling': return 'WATCH CAREFULLY…';
            case 'picking': return joined ? (entry?.pickedSlot === null ? 'PICK A CUP NOW!' : 'LOCKED IN — GOOD LUCK') : 'ROUND IN PLAY';
            case 'reveal':
                if (!joined) return 'ROUND OVER';
                if (entry?.outcome === 'win') return `YOU WON KES ${fmt(entry.bet * LIVE_MULT)}!`;
                if (entry?.outcome === 'refund') return 'MISSED — BET REFUNDED';
                return entry?.pickedSlot === null ? 'MISSED — BET REFUNDED' : 'NOT THIS TIME';
            case 'break': return 'NEXT ROUND STARTING…';
        }
    })();

    const revealed = round.sub === 'reveal' || round.sub === 'break';

    return (
        <div className="lg-root lg-immersive">
            <div className="lg-bg" aria-hidden />
            <LiveArena3D
                phase={round.gamePhase}
                shellCount={LIVE_CUPS}
                gemShellId={round.gemCup}
                pickedSlot={joined ? (entry?.pickedSlot ?? null) : null}
                seed={round.index}
                onPick={onPick}
            />

            <div className="lg-overlay">
                <header className="lg-head">
                    <button className="lg-back" onClick={onClose}>‹ Back</button>
                    <div className="lg-title"><i className="sr-dot" />LIVE · #{round.index % 100000}</div>
                    <div className="lg-headright">
                        <button className="lg-players-btn" onClick={() => setPlayersOpen(true)}>
                            <Icon.Headset width={16} height={16} /> Players
                            <b>{players.length + (joined ? 1 : 0)}</b>
                        </button>
                        <div className="lg-balance"><span>BALANCE</span><strong>KES {fmt(balance)}</strong></div>
                    </div>
                </header>

                <div className={`lg-status ${round.sub}`}>
                    <span className="lg-phase">{statusText}</span>
                    <span className="lg-timer">{round.remaining}s</span>
                </div>

                <div className="lg-spacer">
                    <div className="lg-online"><Icon.Headset width={14} height={14} /> {online.toLocaleString()} playing now</div>
                </div>

                <div className="lg-controls">
                    {joined ? (
                    <div className="lg-joined">
                        <div className="lg-joined-info">
                            <span>YOUR BET</span>
                            <strong>KES {entry!.bet}</strong>
                        </div>
                        <div className="lg-joined-info">
                            <span>CAN WIN</span>
                            <strong className="win">KES {fmt(entry!.bet * LIVE_MULT)}</strong>
                        </div>
                        <div className="lg-joined-msg">{statusText}</div>
                    </div>
                ) : (
                    <>
                        <div className="lg-presets">
                            {BET_PRESETS.map((v) => (
                                <button
                                    key={v}
                                    className={`sr-preset${betAmount === v ? ' active' : ''}`}
                                    style={{ ['--chip' as string]: CHIP_COLORS[v] }}
                                    onClick={() => setBetAmount(v)}
                                ><span className="sr-chip-face">{v}</span></button>
                            ))}
                        </div>
                        <button className="sr-start lg-place" onClick={placeBet} disabled={!canBet}>
                            {round.sub !== 'betting'
                                ? `BETTING OPENS NEXT ROUND`
                                : balance < betAmount
                                    ? 'ADD MONEY FIRST'
                                    : <><Icon.Play width={20} height={20} /> PLACE KES {betAmount}</>}
                        </button>
                    </>
                    )}
                </div>
            </div>

            {/* slide-in live players */}
            <div className={`lg-scrim${playersOpen ? ' open' : ''}`} onClick={() => setPlayersOpen(false)} />
            <aside className={`lg-players-panel${playersOpen ? ' open' : ''}`}>
                <div className="lg-players-head">
                    <span><i className="sr-dot" />LIVE PLAYERS</span>
                    <button className="lg-players-close" onClick={() => setPlayersOpen(false)}>✕</button>
                </div>
                <div className="lg-players-list">
                    {joined && (
                        <div className="lg-prow you">
                            <span className="lg-pname">You</span>
                            <span>{entry!.bet}</span>
                            <span className={`lg-pstat ${revealed ? (entry!.outcome === 'win' ? 'won' : entry!.outcome === 'refund' ? 'refund' : 'lost') : 'in'}`}>
                                {revealed ? (entry!.outcome === 'win' ? `+${fmt(entry!.bet * LIVE_MULT)}` : entry!.outcome === 'refund' ? 'REFUND' : 'LOST') : 'IN'}
                            </span>
                        </div>
                    )}
                    {players.map((p, i) => {
                        const won = p.pick === round.gemCup;
                        return (
                            <div className="lg-prow" key={i}>
                                <span className="lg-pname">{p.name}</span>
                                <span>{p.bet}</span>
                                <span className={`lg-pstat ${revealed ? (won ? 'won' : 'lost') : 'in'}`}>
                                    {revealed ? (won ? `+${fmt(p.bet * LIVE_MULT)}` : 'LOST') : 'IN'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </aside>
        </div>
    );
}
