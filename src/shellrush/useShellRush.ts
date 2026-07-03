import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DifficultyId, GamePhase, Outcome, RoundResult, Stats } from './types';
import { DIFFICULTIES, MIN_BET } from './data';
import { sfx } from './sound';

const SHUFFLE_MS = 3800;
const REVEAL_MS = 950;
const RESULT_MS = 3600;
const COUNTDOWN_FROM = 3;

interface Options {
    soundEnabled: boolean;
    balance: number;
    setBalance: Dispatch<SetStateAction<number>>;
}

export function useShellRush({ soundEnabled, balance, setBalance }: Options) {
    const [betAmount, setBetAmount] = useState(10);
    const [difficultyId, setDifficultyId] = useState<DifficultyId>('easy');
    const [phase, setPhase] = useState<GamePhase>('idle');
    const [gemShellId, setGemShellId] = useState(0);
    const [pickedSlot, setPickedSlot] = useState<number | null>(null);
    const [result, setResult] = useState<RoundResult | null>(null);
    const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
    const [recentResults, setRecentResults] = useState<Outcome[]>([
        'win', 'loss', 'win', 'loss', 'win', 'win', 'loss', 'win', 'loss', 'win',
    ]);
    const [stats, setStats] = useState<Stats>({
        totalBets: 24,
        totalWins: 14,
        biggestWin: 230,
        maxStreak: 5,
        currentStreak: 2,
    });

    const difficulty = useMemo(
        () => DIFFICULTIES.find((d) => d.id === difficultyId)!,
        [difficultyId],
    );
    const shellCount = difficulty.shells;
    const potentialWin = betAmount * difficulty.multiplier;
    const winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets) * 100 : 0;

    const soundRef = useRef(soundEnabled);
    soundRef.current = soundEnabled;
    const play = useCallback((fn: () => void) => {
        if (soundRef.current) fn();
    }, []);

    // Timers we may need to clear on unmount / new round.
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const later = useCallback((fn: () => void, ms: number) => {
        const id = setTimeout(fn, ms);
        timers.current.push(id);
        return id;
    }, []);
    const clearTimers = useCallback(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    }, []);
    useEffect(() => () => clearTimers(), [clearTimers]);

    const canStart = phase === 'idle' && balance >= betAmount && betAmount >= MIN_BET;

    const setDifficultySafe = useCallback((id: DifficultyId) => {
        setPhase((p) => {
            if (p !== 'idle') return p;
            setDifficultyId(id);
            return p;
        });
    }, []);

    const adjustBet = useCallback((delta: number) => {
        setPhase((p) => {
            if (p !== 'idle') return p;
            setBetAmount((b) => Math.max(MIN_BET, b + delta));
            return p;
        });
    }, []);

    const setBet = useCallback((value: number) => {
        setPhase((p) => {
            if (p !== 'idle') return p;
            setBetAmount(Math.max(MIN_BET, Math.round(value)));
            return p;
        });
    }, []);

    const startGame = useCallback(() => {
        if (phase !== 'idle' || balance < betAmount || betAmount < MIN_BET) return;
        clearTimers();
        play(sfx.start);
        setBalance((b) => b - betAmount);
        setResult(null);
        setPickedSlot(null);
        setGemShellId(Math.floor(Math.random() * shellCount));
        setCountdown(COUNTDOWN_FROM);
        setPhase('peek');
    }, [phase, balance, betAmount, shellCount, clearTimers, play, setBalance]);

    // Countdown ticker during the "peek" phase, then hand off to shuffling.
    useEffect(() => {
        if (phase !== 'peek') return;
        setCountdown(COUNTDOWN_FROM);
        play(sfx.tick);
        let n = COUNTDOWN_FROM;
        const iv = setInterval(() => {
            n -= 1;
            if (n <= 0) {
                clearInterval(iv);
                setPhase('shuffling');
                return;
            }
            setCountdown(n);
            play(sfx.tick);
        }, 850);
        return () => clearInterval(iv);
    }, [phase, play]);

    // Shuffle runs on the canvas; here we just time the transition to picking.
    // The whoosh is fired per real swap via `playSwap` (below) so it stays in sync.
    useEffect(() => {
        if (phase !== 'shuffling') return;
        const id = later(() => setPhase('picking'), SHUFFLE_MS);
        return () => clearTimeout(id);
    }, [phase, later]);

    // Called by the arena on each visible cup swap.
    const playSwap = useCallback(() => play(sfx.swap), [play]);

    const finishRound = useCallback(
        (won: boolean) => {
            const payout = won ? Math.round(betAmount * difficulty.multiplier) : 0;
            setResult({ outcome: won ? 'win' : 'loss', payout });
            if (won) setBalance((b) => b + payout);
            play(won ? sfx.win : sfx.loss);
            const outcome: Outcome = won ? 'win' : 'loss';
            setRecentResults((r) => [outcome, ...r].slice(0, 11));
            setStats((s) => {
                const currentStreak = won ? s.currentStreak + 1 : 0;
                return {
                    totalBets: s.totalBets + 1,
                    totalWins: s.totalWins + (won ? 1 : 0),
                    biggestWin: Math.max(s.biggestWin, payout),
                    currentStreak,
                    maxStreak: Math.max(s.maxStreak, currentStreak),
                };
            });
            setPhase('result');
            later(() => {
                setPhase('idle');
                setResult(null);
                setPickedSlot(null);
            }, RESULT_MS);
        },
        [betAmount, difficulty.multiplier, play, later, setBalance],
    );

    // Called by the arena when the player taps a shell.
    const pickSlot = useCallback(
        (slot: number, isGem: boolean) => {
            if (phase !== 'picking') return;
            play(sfx.pick);
            setPickedSlot(slot);
            setPhase('revealing');
            later(() => finishRound(isGem), REVEAL_MS);
        },
        [phase, play, later, finishRound],
    );

    return {
        // state
        balance,
        betAmount,
        difficulty,
        difficultyId,
        shellCount,
        phase,
        gemShellId,
        pickedSlot,
        result,
        countdown,
        recentResults,
        stats,
        potentialWin,
        winRate,
        canStart,
        // actions
        setDifficulty: setDifficultySafe,
        adjustBet,
        setBet,
        startGame,
        pickSlot,
        playSwap,
    };
}

export type ShellRushApi = ReturnType<typeof useShellRush>;
