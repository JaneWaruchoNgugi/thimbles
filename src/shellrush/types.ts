export type DifficultyId = 'easy' | 'medium' | 'hard' | 'extreme';

export interface Difficulty {
    id: DifficultyId;
    label: string;
    shells: number;
    multiplier: number;
    /** Plain-language risk/reward hint shown on the card */
    blurb: string;
    /** Accent theme colour used across the UI + arena */
    color: string;
}

export type GamePhase =
    | 'idle'        // shells down, waiting for a bet
    | 'peek'        // shells lifted, gem glowing, countdown running
    | 'shuffling'   // shells covering gem, swapping around
    | 'picking'     // shells settled, player must choose
    | 'revealing'   // chosen shell lifting
    | 'result';     // outcome shown

export type Outcome = 'win' | 'loss';

export interface RoundResult {
    outcome: Outcome;
    payout: number;
}

export interface Stats {
    totalBets: number;
    totalWins: number;
    biggestWin: number;
    maxStreak: number;
    currentStreak: number;
}

export interface LivePlayer {
    name: string;
    bet: number;
    multiplier: number;
    status: 'WON' | 'LOST';
}
