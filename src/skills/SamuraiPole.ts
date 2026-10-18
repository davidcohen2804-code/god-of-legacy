// The Samurai's Rising Sun banner (David 18 Oct 01:15 / 18:29) — one set of numbers for the engine (LegacyCourtyardScene)
// and the look (SamuraiFx): it stands `ms` after the burst, `behind` px behind where he cast. His own jump coming down
// on it — within ±`nearX` px along the field and ±`nearY` px in depth of its foot, between `low` and `top` px up —
// springs him `dist` px back on an arc `up` px high, once a landing.
export const POLE = { ms: 25000, behind: 44, nearX: 60, nearY: 42, low: 8, top: 200, dist: 360, up: 170 } as const;
