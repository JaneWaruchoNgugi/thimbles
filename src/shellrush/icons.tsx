import type { FC, SVGProps } from 'react';

type I = FC<SVGProps<SVGSVGElement>>;
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const SoundOn: I = (p) => (
    <svg {...base} {...p}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);
export const SoundOff: I = (p) => (
    <svg {...base} {...p}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></svg>
);
export const Info: I = (p) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
);
export const Coins: I = (p) => (
    <svg {...base} {...p}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>
);
export const Trophy: I = (p) => (
    <svg {...base} {...p}><path d="M6 4h12v4a6 6 0 0 1-12 0z" /><path d="M6 6H3v2a3 3 0 0 0 3 3" /><path d="M18 6h3v2a3 3 0 0 1-3 3" /><path d="M9 20h6" /><path d="M12 14v6" /></svg>
);
export const Chart: I = (p) => (
    <svg {...base} {...p}><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /><path d="M19 7h-3" /><path d="M19 7v3" /></svg>
);
export const Crown: I = (p) => (
    <svg {...base} {...p}><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z" /></svg>
);
export const Flame: I = (p) => (
    <svg {...base} {...p}><path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c1.5 0 1-3-.5-5C11 5 12 3 12 3z" /></svg>
);
export const Shield: I = (p) => (
    <svg {...base} {...p}><path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const Lock: I = (p) => (
    <svg {...base} {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const Clock: I = (p) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const Headset: I = (p) => (
    <svg {...base} {...p}><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="2" y="13" width="4" height="6" rx="1.5" /><rect x="18" y="13" width="4" height="6" rx="1.5" /><path d="M20 19a4 4 0 0 1-4 3h-2" /></svg>
);
export const Diamond: I = (p) => (
    <svg {...base} {...p}><path d="M6 3h12l3 5-9 13L3 8z" /><path d="M3 8h18" /><path d="m9 3-2 5 5 13" /><path d="m15 3 2 5-5 13" /></svg>
);
export const Shuffle: I = (p) => (
    <svg {...base} {...p}><path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="M4 4l5 5" /></svg>
);
export const Hand: I = (p) => (
    <svg {...base} {...p}><path d="M8 13V5a1.5 1.5 0 0 1 3 0v6" /><path d="M11 11V4a1.5 1.5 0 0 1 3 0v7" /><path d="M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2.5-4a1.6 1.6 0 0 1 2.7-1.7L8 14" /></svg>
);
export const Eye: I = (p) => (
    <svg {...base} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const Chip: I = (p) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m18.4 5.6-2.1 2.1" /><path d="m7.7 16.3-2.1 2.1" /></svg>
);
export const Play: I = (p) => (
    <svg {...p} width={p.width ?? 20} height={p.height ?? 20} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 7 4.5z" /></svg>
);
