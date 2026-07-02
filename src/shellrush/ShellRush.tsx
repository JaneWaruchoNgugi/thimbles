import { useEffect, useMemo, useState } from 'react';
import './shellrush.css';
import { useShellRush } from './useShellRush';
import { LiveArena3D } from './LiveArena3D';
import { LiveGame } from './LiveGame';
import { BET_PRESETS, CHIP_COLORS, DIFFICULTIES, HOW_TO_PLAY, PLAYER_NAMES, SEED_LIVE } from './data';
import type { LivePlayer } from './types';
import * as Icon from './icons';

const HOW_TO_ICONS = [Icon.Coins, Icon.Chart, Icon.Diamond, Icon.Shuffle, Icon.Hand, Icon.Trophy];

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ShellRush() {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const [liveOpen, setLiveOpen] = useState(false);
    const [balance, setBalance] = useState(4976); // shared wallet (solo + live)
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
        <div className="sr-root" style={{ ['--accent' as string]: game.difficulty.color }}>
            <div className="sr-grain" aria-hidden />

            {/* HEADER */}
            <header className="sr-header">
                <div className="sr-brand">
                    <span className="sr-logo-mark"><Icon.Diamond width={22} height={22} /></span>
                    <h1>SHELL<span>RUSH</span></h1>
                    {/*<span className="sr-live"><i />LIVE</span>*/}
                </div>
                <div className="sr-header-right">
                    <div className="sr-balance">
                        <span>BALANCE</span>
                        <strong>KES {fmt(game.balance)}</strong>
                    </div>
                    <button
                        className="sr-icon-btn"
                        onClick={() => setSoundEnabled((s) => !s)}
                        aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
                    >
                        {soundEnabled ? <Icon.SoundOn /> : <Icon.SoundOff />}
                    </button>
                </div>
            </header>

            {/* ARENA ROW */}
            <section className="sr-arena-row">
                <aside className="sr-difficulty">
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

                    <div className="sr-arena-head">{phaseLabel}</div>
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
                </div>
            </section>

            {/* BET PANEL */}
            <section className="sr-panel sr-bet">
                <div className="sr-bet-head">
                    <span className="sr-panel-title sr-label-cyan">
                        <span className="sr-label-ico chip"><Icon.Chip width={16} height={16} /></span>BET AMOUNT
                    </span>
                    <button className="sr-howto" onClick={() => setSheetOpen(true)}>
                        <Icon.Info width={16} height={16} /> HOW TO PLAY
                    </button>
                </div>

                <div className="sr-bet-controls">
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
                        {/*<button*/}
                        {/*    className={`sr-preset sr-preset-other${showOther ? ' active' : ''}`}*/}
                        {/*    onClick={() => setShowOther(true)}*/}
                        {/*    disabled={game.phase !== 'idle'}*/}
                        {/*>*/}
                        {/*    OTHER*/}
                        {/*</button>*/}
                    </div>

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
                </div>

                <div className="sr-startbox">
                    {/*<div className="sr-potential">*/}
                    {/*    <span className="sr-panel-title sr-label-gold">*/}
                    {/*        <span className="sr-label-ico trophy"><Icon.Trophy width={16} height={16} /></span>YOU WIN*/}
                    {/*    </span>*/}
                    {/*    <div className="sr-potential-inner">*/}
                    {/*        <span className="sr-coin"><Icon.Coins width={22} height={22} /></span>*/}
                    {/*        <strong>{fmt(game.potentialWin)}</strong>*/}
                    {/*        <em>KES</em>*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                    <span className="sr-startbox-div" aria-hidden />
                    <button className="sr-start" onClick={game.startGame} disabled={!game.canStart}>
                        {game.phase === 'idle'
                            ? (game.balance < game.betAmount
                                ? 'ADD MONEY FIRST'
                                : <><Icon.Play width={22} height={22} /> PLAY NOW</>)
                            : 'PLAYING…'}
                    </button>
                </div>
            </section>

            {/* STATS */}
            <section className="sr-stats">
                <StatCard icon={<Icon.Coins />} label="TOTAL BETS" value={String(game.stats.totalBets)} tone="gold" />
                <StatCard icon={<Icon.Trophy />} label="TOTAL WINS" value={String(game.stats.totalWins)} tone="gold" />
                <StatCard icon={<Icon.Chart />} label="WIN RATE" value={`${game.winRate.toFixed(2)}%`} tone="cyan" />
                <StatCard icon={<Icon.Crown />} label="BIGGEST WIN" value={`KES ${game.stats.biggestWin}`} tone="gold" />
                <StatCard icon={<Icon.Flame />} label="MAX STREAK" value={`${game.stats.maxStreak} wins`} tone="pink" />
            </section>

            {/* BOTTOM PANELS */}
            <section className="sr-bottom">
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

                <button className="sr-panel sr-livegame" onClick={() => setLiveOpen(true)}>
                    <div className="sr-livegame-head">
                        <span className="sr-panel-title"><i className="sr-dot" />LIVE GAME</span>
                        <small>Tap to join →</small>
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

            {/* LIVE GAME — full-screen, clock-synced shared rounds */}
            {liveOpen && (
                <LiveGame
                    balance={balance}
                    setBalance={setBalance}
                    soundEnabled={soundEnabled}
                    onClose={() => setLiveOpen(false)}
                />
            )}
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
