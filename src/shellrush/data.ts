import type { Difficulty, LivePlayer } from './types';

export const DIFFICULTIES: Difficulty[] = [
    { id: 'easy', label: 'EASY', shells: 3, multiplier: 2.8, blurb: 'Best chance', color: '#6ee03a' },
    { id: 'medium', label: 'MEDIUM', shells: 4, multiplier: 3.7, blurb: 'Balanced', color: '#4fd11e' },
    { id: 'hard', label: 'HARD', shells: 5, multiplier: 4.6, blurb: 'Risky', color: '#35b814' },
    { id: 'extreme', label: 'EXTREME', shells: 6, multiplier: 5.5, blurb: 'Biggest win', color: '#22a30f' },
];

export const BET_PRESETS = [10, 20, 50, 100, 200];

/** Casino-chip colour per denomination. */
export const CHIP_COLORS: Record<number, string> = {
    10: '#3ba55d',
    20: '#2f7fc8',
    50: '#d68a1e',
    100: '#c0392b',
    200: '#8e44ad',
};
export const CHIP_OTHER = '#6b7488';

export const MIN_BET = 10;

export const HOW_TO_PLAY = [
    'Choose how much to bet',
    'Pick a level — more cups, bigger win',
    'Watch where the gem hides',
    'The cups mix up — keep watching',
    'Tap the cup hiding the gem',
    'Match it and win money!',
];

/** Pool of mock names used to keep the live table feeling alive. */
export const PLAYER_NAMES = [
    'Kamau', 'Neema', 'Brian', 'Asha', 'Kevin', 'Femi', 'Otieno', 'Halima',
    'Zawadi', 'Mwangi', 'Tabby', 'Juma', 'Nadia', 'Baraka', 'Wanjiku', 'Deng',
    'Amara', 'Kofi', 'Lulu', 'Salim', 'Njeri', 'Dede', 'Panya', 'Chidi',
];

/** Seed rows so the live table is populated on first paint (mirrors the mock). */
export const SEED_LIVE: LivePlayer[] = [
    { name: 'Kamau_557', bet: 100, multiplier: 3.7, status: 'WON' },
    { name: 'Neema_519', bet: 50, multiplier: 2.8, status: 'LOST' },
    { name: 'Brian_801', bet: 200, multiplier: 4.6, status: 'WON' },
    { name: 'Asha_220', bet: 20, multiplier: 2.8, status: 'WON' },
    { name: 'Kevin_744', bet: 100, multiplier: 3.7, status: 'LOST' },
    { name: 'Femi_163', bet: 10, multiplier: 2.8, status: 'WON' },
    { name: 'Otieno_637', bet: 50, multiplier: 3.7, status: 'LOST' },
    { name: 'Halima_419', bet: 20, multiplier: 2.8, status: 'WON' },
];
