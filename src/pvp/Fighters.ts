// The PvP arena's fighters: the select screen's roster — the four ready heroes (START HERO) — and you as the chosen one.
import { CharacterStore } from '../characters/CharacterStore';
import type { Character } from '../characters/CharacterTypes';
import HERO_ATLAS from '../data/hero-atlas.json';
import type { PortraitRef } from '../ui/hud/HudState';

/** A hero's VS splash (the approved battle-stance art, facing right): file, size, the face square on it and the class colours;
 *  `win` = the victory pose (same canvas), when there is one; `card` = no splash yet, this is the hero's card instead. */
export interface HeroVs { url: string; w: number; h: number; face: { x: number; y: number; s: number }; color: string; glow: string; win?: string; card?: boolean }
const VS_W = 1024, VS_H = 1536;
/** Each hero's colours (VS screen, battle HUD, select tiles). */
const COLOR: Record<string, [string, string]> = {
  warrior: ['#f0b24a', 'rgba(255,168,56,.58)'],
  samurai: ['#ff3a4e', 'rgba(255,40,64,.58)'],
  book_mage: ['#52b4ff', 'rgba(64,166,255,.58)'],
  archer: ['#86d957', 'rgba(112,206,72,.52)'],
  gambler: ['#e45cff', 'rgba(214,72,255,.55)'],
};
/** The heroes that have a battle-stance splash (assets/final/heroes/<cls>/vs.webp): the face square on it. */
const FACE: Record<string, [number, number, number]> = {
  warrior: [559, 200, 170],
  samurai: [470, 240, 190],
  book_mage: [440, 150, 170],
  archer: [430, 270, 170],
  gambler: [541, 130, 177],
};
/** The heroes that have a victory pose (assets/final/heroes/<cls>/win.webp). */
const WIN = new Set(['samurai', 'warrior', 'book_mage', 'archer', 'gambler']);
const colorOf = (cls: string): [string, string] => COLOR[cls] ?? ['#c9d2e6', 'rgba(170,184,214,.5)'];
/** A hero's colour (the battle tag over its head, the HUD). */
export const classColor = (cls: string): string => colorOf(cls)[0];
export function heroVs(cls: string): HeroVs | undefined {
  const f = FACE[cls], [color, glow] = colorOf(cls);
  return f ? { url: `assets/final/heroes/${cls}/vs.webp`, w: VS_W, h: VS_H, face: { x: f[0], y: f[1], s: f[2] }, color, glow, win: WIN.has(cls) ? `assets/final/heroes/${cls}/win.webp` : undefined } : undefined;
}
/** A hero's art for the VS screen, the result and the select tiles: its splash — else (none yet) its card. */
export function heroArt(cls: string): HeroVs | undefined {
  const v = heroVs(cls); if (v) return v;
  const c = heroCard(cls), [color, glow] = colorOf(cls);
  return c ? { url: c.file, w: c.w, h: c.h, face: c.face, color, glow, card: true } : undefined;
}
/** The battle HUD's portrait of a hero: the face on its VS splash. */
export function heroVsPortrait(cls: string): PortraitRef | undefined {
  const v = heroVs(cls);
  return v ? { url: v.url, crop: { x: v.face.x, y: v.face.y, w: v.face.s, imgW: v.w, imgH: v.h } } : undefined;
}

/** The roster, in its order on the select screen. */
export const ROSTER = ['warrior', 'samurai', 'book_mage', 'archer', 'gambler'] as const;
/** The heroes' level (as START HERO: every job and skill open). */
const HERO_LEVEL = 100;

/** A hero's card (the approved model picture): file, size, and the face square on it (x, y, size). */
export function heroCard(cls: string): { file: string; w: number; h: number; face: { x: number; y: number; s: number } } | null {
  const c = (HERO_ATLAS as unknown as Record<string, { card?: [number, number, number, number, number] }>)[cls]?.card;
  return c ? { file: `assets/final/heroes/${cls}/card.png`, w: c[0], h: c[1], face: { x: c[2], y: c[3], s: c[4] } } : null;
}

/** You in the arena as `cls`: that ready hero, under your selected character's name. A copy, nothing of it is saved. */
export function fighterFor(cls: string): Character {
  const sel = CharacterStore.getSelectedCharacter();
  return CharacterStore.heroOf(cls, sel?.name ?? 'Player', HERO_LEVEL);
}
