// The 3D heroes' pictures (David 24 Oct: the heroes in 3D — "throw out the characters we already made"): the 3D Beginner,
// a man or a woman, with its class's weapon, rendered once (tools/hero3d/art) in a battle stance facing right — the VS
// screen's splash, the result's, the fighter select's tiles and fighters — and its face for the HUD's portraits. No
// three.js here: the pictures are files. The painted heroes' pictures stay for ?hero3d=0.
import type { PortraitRef } from '../ui/hud/HudState';

export const ART3D = { w: 1024, h: 1536 };
const WEAPON: Record<string, string> = { warrior: 'sword', samurai: 'katana', archer: 'bow', book_mage: 'staff', gambler: 'cane' };
/** Each picture's face square (x, y, side; px) — tools/hero3d/art/meta.json. */
const FACE: Record<string, [number, number, number]> = {};

const key = (cls: string, female: boolean) => `${female ? 'f' : 'm'}_${WEAPON[cls] ?? 'sword'}`;
/** The ready heroes (the PvP roster, START HERO) as the painted ones were: the archer a woman, the rest men. */
export const heroFemale3d = (cls: string): boolean => cls === 'archer';
/** The picture of the Beginner (man / woman) with `cls`'s weapon, and its face square. */
export function art3d(cls: string, female: boolean): { url: string; w: number; h: number; face: { x: number; y: number; s: number } } {
  const k = key(cls, female), f = FACE[k] ?? [400, 160, 220];
  return { url: `assets/hero3d/art/${k}.webp`, w: ART3D.w, h: ART3D.h, face: { x: f[0], y: f[1], s: f[2] } };
}
/** The face from that picture, for a portrait. */
export function portrait3d(cls: string, female: boolean): PortraitRef {
  const a = art3d(cls, female);
  return { url: a.url, crop: { x: a.face.x, y: a.face.y, w: a.face.s, imgW: a.w, imgH: a.h } };
}
