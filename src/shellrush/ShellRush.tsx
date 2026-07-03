import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import './shellrush.css';
import { useShellRush } from './useShellRush';
import { LiveArena3D } from './LiveArena3D';
import { BET_PRESETS, CHIP_COLORS, DIFFICULTIES, HOW_TO_PLAY, PLAYER_NAMES, SEED_LIVE } from './data';
import type { LivePlayer } from './types';
import * as Icon from './icons';

const CONFETTI_COLORS = ['#3fe05f', '#4fd11e', '#a6f24c', '#f4d03f', '#f43f6f', '#5fd8ff'];

const HOW_TO_ICONS = [Icon.Coins, Icon.Chart, Icon.Diamond, Icon.Shuffle, Icon.Hand, Icon.Trophy];

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
    balance: number;
    setBalance: Dispatch<SetStateAction<number>>;
    soundEnabled: boolean;
    onToggleSound: () => void;
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    onClose: () => void; // back to the live landing page
}

/** Solo "mini game" — the full Thimbles experience, opened as an overlay from LIVE. */
export function ShellRush({ balance, setBalance, soundEnabled, onToggleSound, isFullscreen, toggleFullscreen, onClose }: Props) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [arenaSeed, setArenaSeed] = useState(1);
    const game = useShellRush({ soundEnabled, balance, setBalance });

    // fresh shuffle each round for the 3D arena
    useEffect(() => {
        if (game.phase === 'peek') setArenaSeed(Math.floor(Math.random() * 2 ** 31));
    }, [game.phase]);

    const phaseLabel = useMemo(() => {
        switch (game.phase) {
            case 'peek': return 'WATCH THE GEM';
            case 'shuffling': return 'KEEP WATCHING…';
            case 'picking': return 'PICK A CUP';
            case 'revealing': return 'LET’S SEE…';
            case 'result': return game.result?.outcome === 'win' ? 'YOU WON!' : 'TRY AGAIN';
            default: return 'TAP PLAY TO START';
        }
    }, [game.phase, game.result]);

    // Live table ticker — synthetic players flowing in to feel alive.
    const [live, setLive] = useState<LivePlayer[]>(SEED_LIVE);
    const [online, setOnline] = useState(1248);
    useEffect(() => {
        const iv = setInterval(() => {
            const diff = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
            const name = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
            const row: LivePlayer = {
                name: `${name}_${100 + Math.floor(Math.random() * 899)}`,
                bet: BET_PRESETS[Math.floor(Math.random() * BET_PRESETS.length)],
                multiplier: diff.multiplier,
                status: Math.random() < 0.55 ? 'WON' : 'LOST',
            };
            setLive((prev) => [row, ...prev].slice(0, 8));
            setOnline((o) => Math.max(900, o + Math.floor((Math.random() - 0.5) * 24)));
        }, 2600);
        return () => clearInterval(iv);
    }, []);

    return (
        <div className="sr-root sr-overlay" style={{ ['--accent' as string]: game.difficulty.color }}>
            <div className="sr-grain" aria-hidden />
            <div className="sr-ambient" aria-hidden />

            {/* HEADER */}
            <header className="sr-header">
                <div className="sr-brand">
                    <button className="sr-back-btn" onClick={onClose} aria-label="Back to live game" title="Back to live">‹</button>
                    <span className="sr-logo-mark"><Icon.Diamond width={22} height={22} /></span>
                    <h1>THIM<span>BLES</span></h1>
                </div>
                <div className="sr-header-right">
                    <div className="sr-balance">
                        <span>BALANCE</span>
                        <strong>KES {fmt(game.balance)}</strong>
                    </div>
                    <button
                        className="sr-icon-btn"
                        onClick={onToggleSound}
                        aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
                    >
                        {soundEnabled ? <Icon.SoundOn /> : <Icon.SoundOff />}
                    </button>
                    <button
                        className="sr-icon-btn"
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Icon.Compress /> : <Icon.Expand />}
                    </button>
                </div>
            </header>

            {/* STAGE: level rail · arena · info side */}
            <main className="sr-stage">
                <aside className="sr-rail sr-difficulty">
                    <span className="sr-panel-title">CHOOSE A LEVEL</span>
                    <div className="sr-diff-list">
                        {DIFFICULTIES.map((d) => (
                            <button
                                key={d.id}
                                className={`sr-diff${game.difficultyId === d.id ? ' active' : ''}`}
                                style={{ ['--c' as string]: d.color }}
                                onClick={() => game.setDifficulty(d.id)}
                                disabled={game.phase !== 'idle'}
                            >
                                <span className="sr-diff-mult">{d.multiplier.toFixed(1)}×</span>
                                <b>{d.label}</b>
                                <small>{d.shells} cups · {d.blurb}</small>
                                <em>Win KES {fmt(game.betAmount * d.multiplier)}</em>
                            </button>
                        ))}
                    </div>
                </aside>

                <div className="sr-arena">
                    <LiveArena3D
                        phase={game.phase}
                        shellCount={game.shellCount}
                        gemShellId={game.gemShellId}
                        pickedSlot={game.pickedSlot}
                        seed={arenaSeed}
                        onPick={game.pickSlot}
                        onSwap={game.playSwap}
                    />

                    {/* recent results — live strip, top-left inside the arena */}
                    <div className="sr-recent-strip">
                        <span className="sr-recent-strip-title">RECENT RESULTS</span>
                        <div className="sr-recent-strip-chips">
                            {game.recentResults.slice(0, 9).map((r, i) => (
                                <span key={i} className={`sr-rchip ${r}`}>{r === 'win' ? 'W' : 'L'}</span>
                            ))}
                        </div>
                    </div>

                    {game.phase === 'peek' && (
                        <div className="sr-countdown" key={game.countdown}>
                            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" /></svg>
                            <span>{game.countdown}<small>SEC</small></span>
                        </div>
                    )}
                    <div className={`sr-arena-foot${game.phase === 'result' ? ` ${game.result?.outcome}` : ''}`}>
                        {game.phase === 'result' && game.result?.outcome === 'win'
                            ? `+ KES ${fmt(game.result.payout)}`
                            : phaseLabel}
                    </div>

                    {/* WIN / LOSS celebration — impossible to miss */}
                    {game.phase === 'result' && game.result && (
                        <div className={`sr-outcome ${game.result.outcome}`} aria-live="polite">
                            {game.result.outcome === 'win' ? (
                                <>
                                    <div className="sr-confetti" aria-hidden>
                                        {Array.from({ length: 28 }).map((_, i) => (
                                            <span
                                                key={i}
                                                style={{
                                                    left: `${Math.random() * 100}%`,
                                                    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                                                    animationDuration: `${1.5 + Math.random() * 1.4}s`,
                                                    animationDelay: `${Math.random() * 0.35}s`,
                                                    ['--dx' as string]: `${(Math.random() * 2 - 1) * 90}px`,
                                                    ['--rot' as string]: `${360 + Math.random() * 600}deg`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="sr-win-card">
                                        <span className="sr-win-trophy"><Icon.Trophy width={40} height={40} /></span>
                                        <span className="sr-win-title">YOU WON!</span>
                                        <span className="sr-win-amt">+ KES {fmt(game.result.payout)}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="sr-loss-card">
                                    <span className="sr-loss-title">SO CLOSE</span>
                                    <span className="sr-loss-sub">Better luck next round</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <aside className="sr-side">
                    {/* STATS */}
                    <div className="sr-stats">
                        <StatCard icon={<Icon.Coins />} label="TOTAL BETS" value={String(game.stats.totalBets)} tone="gold" />
                        <StatCard icon={<Icon.Trophy />} label="TOTAL WINS" value={String(game.stats.totalWins)} tone="gold" />
                        <StatCard icon={<Icon.Chart />} label="WIN RATE" value={`${game.winRate.toFixed(2)}%`} tone="cyan" />
                        <StatCard icon={<Icon.Crown />} label="BIGGEST WIN" value={`KES ${game.stats.biggestWin}`} tone="gold" />
                        <StatCard icon={<Icon.Flame />} label="MAX STREAK" value={`${game.stats.maxStreak} wins`} tone="pink" />
                    </div>

                    <button className="sr-panel sr-livegame" onClick={onClose}>
                        <div className="sr-livegame-head">
                            <span className="sr-panel-title"><i className="sr-dot" />LIVE GAME</span>
                            <small>Back to live →</small>
                        </div>
                        <div className="sr-livegame-scene">
                            <span className="sr-mini-gem" />
                            <span className="sr-mini-shell" />
                            <span className="sr-mini-shell" />
                            <span className="sr-mini-shell" />
                            <span className="sr-scanline" />
                            <span className="sr-livegame-cta">▶ PLAY LIVE</span>
                        </div>
                    </button>

                    <div className="sr-panel sr-livetable">
                        <div className="sr-livetable-head">
                            <span className="sr-panel-title"><i className="sr-dot" />LIVE TABLE</span>
                            <small>{online.toLocaleString()} ONLINE</small>
                        </div>
                        <div className="sr-table">
                            <div className="sr-tr sr-th">
                                <span>PLAYER</span><span>BET</span><span>WON</span><span>RESULT</span>
                            </div>
                            {live.map((p, i) => (
                                <div className="sr-tr" key={`${p.name}-${i}`}>
                                    <span className="sr-player">{p.name}</span>
                                    <span>{p.bet}</span>
                                    <span className="sr-mult">{p.status === 'WON' ? fmt(p.bet * p.multiplier) : '—'}</span>
                                    <span className={`sr-status ${p.status.toLowerCase()}`}>{p.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="sr-panel sr-guide">
                        <span className="sr-panel-title">HOW TO PLAY</span>
                        <ol>
                            {HOW_TO_PLAY.map((step, i) => {
                                const Ico = HOW_TO_ICONS[i];
                                return (
                                    <li key={i}>
                                        <span className="sr-guide-ico"><Ico width={16} height={16} /></span>
                                        <em>{i + 1}</em> {step}
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </aside>
            </main>

            {/* BET DOCK — control deck across the bottom */}
            <section className="sr-panel sr-dock">
                <div className="sr-dock-chips">
                    <span className="sr-panel-title sr-label-cyan">
                        <span className="sr-label-ico chip"><Icon.Chip width={16} height={16} /></span>BET AMOUNT
                    </span>
                    <div className="sr-presets">
                        {BET_PRESETS.map((v) => {
                            const active = !showOther && game.betAmount === v;
                            return (
                                <button
                                    key={v}
                                    className={`sr-preset${active ? ' active' : ''}`}
                                    style={{ ['--chip' as string]: CHIP_COLORS[v] }}
                                    onClick={() => { setShowOther(false); game.setBet(v); }}
                                    disabled={game.phase !== 'idle'}
                                >
                                    <span className="sr-chip-face">{v}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="sr-dock-payout">
                    <span className="sr-panel-title sr-label-gold">
                        <span className="sr-label-ico trophy"><Icon.Trophy width={16} height={16} /></span>YOU WIN
                    </span>
                    <div className="sr-dock-payout-val">
                        <span className="sr-coin"><Icon.Coins width={20} height={20} /></span>
                        <strong>{fmt(game.potentialWin)}</strong>
                        <em>KES</em>
                    </div>
                </div>

                <div className="sr-dock-actions">
                    <div className="sr-stepper">
                        <button className="sr-step-btn" onClick={() => game.adjustBet(-10)} disabled={game.phase !== 'idle'} aria-label="Decrease bet">–</button>
                        {showOther ? (
                            <div className="sr-bet-field">
                                <input
                                    type="number"
                                    className="sr-bet-input"
                                    value={game.betAmount}
                                    min={10}
                                    onChange={(e) => game.setBet(Number(e.target.value) || 10)}
                                    disabled={game.phase !== 'idle'}
                                />
                                <span className="sr-bet-unit">KES</span>
                            </div>
                        ) : (
                            <div className="sr-bet-field">
                                <strong className="sr-bet-num">{game.betAmount}</strong>
                                <span className="sr-bet-unit">KES</span>
                            </div>
                        )}
                        <button className="sr-step-btn" onClick={() => game.adjustBet(10)} disabled={game.phase !== 'idle'} aria-label="Increase bet">+</button>
                    </div>

                    <button className="sr-start" onClick={game.startGame} disabled={!game.canStart}>
                        {game.phase === 'idle'
                            ? (game.balance < game.betAmount
                                ? 'ADD MONEY FIRST'
                                : <><Icon.Play width={22} height={22} /> PLAY NOW</>)
                            : 'PLAYING…'}
                    </button>

                    <button className="sr-howto" onClick={() => setSheetOpen(true)}>
                        <Icon.Info width={16} height={16} /> HOW TO PLAY
                    </button>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="sr-footer">
                <Trust icon={<Icon.Shield />} title="FAIR PLAY" sub="Everyone has a fair chance" />
                <Trust icon={<Icon.Lock />} title="SAFE" sub="Your money is protected" />
                <Trust icon={<Icon.Clock />} title="LIVE" sub="Play with others now" />
                <Trust icon={<Icon.Headset />} title="HELP 24/7" sub="We’re always here" />
            </footer>

            {/* HOW TO PLAY BOTTOM SHEET */}
            <div className={`sr-sheet-scrim${sheetOpen ? ' open' : ''}`} onClick={() => setSheetOpen(false)}>
                <div className={`sr-sheet${sheetOpen ? ' open' : ''}`} onClick={(e) => e.stopPropagation()}>
                    <div className="sr-sheet-grip" />
                    <h2>How to play</h2>
                    <p className="sr-sheet-lead">
                        Watch where the gem hides, then tap the cup covering it after the cups mix up. Match it and win money!
                    </p>
                    <ol className="sr-sheet-steps">
                        {HOW_TO_PLAY.map((step, i) => {
                            const Ico = HOW_TO_ICONS[i];
                            return (
                                <li key={i}>
                                    <span className="sr-guide-ico"><Ico width={18} height={18} /></span>
                                    <div><b>Step {i + 1}</b><span>{step}</span></div>
                                </li>
                            );
                        })}
                    </ol>
                    <div className="sr-sheet-mults">
                        {DIFFICULTIES.map((d) => (
                            <div key={d.id} style={{ ['--c' as string]: d.color }}>
                                <b>{d.label}</b><span>{d.shells} cups · {d.blurb}</span><em>{d.multiplier.toFixed(1)}× your bet</em>
                            </div>
                        ))}
                    </div>
                    <button className="sr-start" onClick={() => setSheetOpen(false)}>GOT IT</button>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
    return (
        <div className={`sr-stat tone-${tone}`}>
            <span className="sr-stat-ico">{icon}</span>
            <small>{label}</small>
            <strong>{value}</strong>
        </div>
    );
}

function Trust({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
    return (
        <div className="sr-trust">
            <span>{icon}</span>
            <div><b>{title}</b><small>{sub}</small></div>
        </div>
    );
}
