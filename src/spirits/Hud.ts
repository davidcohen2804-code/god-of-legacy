// LEGACY OF SPIRITS — the gameplay HUD's own pieces (GPT, 9 Nov, step 4A): the map drawn from the game's real data
// (each place's walkable floor and its stone blocks, in the palette; the HUD's markers — the hero, the NPCs, the way
// on — stay as they are) instead of the old golden painting, and the hero's portrait from his 3D model (the head
// rendered on the select screen) instead of the old painted human face.
import type Phaser from 'phaser';
import { AREAS, ROW, WORLD_H, WORLD_W } from '../world/Areas';
import { SPIRITS } from './flag';

/** The hero's name as the spirits show it (the saved record keeps its own). */
export const spiritName = (cls: string, name: string): string => (SPIRITS.on && cls === 'samurai' ? 'Spectral Samurai' : name);

let portraitUrl: string | null = null;
/** His head and shoulders as rendered from the 3D model on the select screen (a texture kept by the game), as a picture
 *  for the HUD's round portrait; null if the select was not shown in this session. */
export function spiritPortrait(game: Phaser.Game): { url: string } | undefined {
  if (!SPIRITS.on) return undefined;
  if (!portraitUrl && game.textures.exists('spirit-portrait')) {
    const src = game.textures.get('spirit-portrait').getSourceImage() as HTMLCanvasElement;
    try { portraitUrl = src.toDataURL('image/png'); } catch { portraitUrl = null; }
  }
  return portraitUrl ? { url: portraitUrl } : undefined;
}

/** The map picture's scale (world px per picture px). */
const MAP_K = 4;
let mapUrl: string | null = null;
/** The whole strip drawn from data (a dark night ground, each place's floor in cool stone with a fine light edge, its
 *  blocks lighter with a gold edge), once; with the rectangle (world px) it covers, as the HUD's minimap takes it. */
export function spiritMinimap(): { imageUrl: string; image: { x: number; y: number; w: number; h: number } } {
  if (!mapUrl) {
    const c = document.createElement('canvas'); c.width = Math.ceil(WORLD_W / MAP_K); c.height = Math.ceil(WORLD_H / MAP_K);
    const g = c.getContext('2d')!; g.scale(1 / MAP_K, 1 / MAP_K);
    g.fillStyle = '#0e0919'; g.fillRect(0, 0, WORLD_W, WORLD_H);
    const poly = (pts: [number, number][], ox: number) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + ox, y) : g.moveTo(x + ox, y))); g.closePath(); };
    for (const a of ROW) {
      const A = AREAS[a.id]; if (!A?.walk?.length) continue;
      poly(A.walk as [number, number][], A.x);
      g.fillStyle = '#342c4f'; g.fill();
      g.lineWidth = 2 * MAP_K; g.strokeStyle = 'rgba(176,160,226,0.55)'; g.stroke();
      for (const p of (A.props ?? []).filter((q) => q.id.startsWith('block'))) {
        poly(p.foot as [number, number][], A.x);
        g.fillStyle = '#5b5080'; g.fill();
        g.lineWidth = 1.6 * MAP_K; g.strokeStyle = 'rgba(228,194,106,0.85)'; g.stroke();
      }
    }
    try { mapUrl = c.toDataURL('image/png'); } catch { mapUrl = ''; }
  }
  return { imageUrl: mapUrl ?? '', image: { x: 0, y: 0, w: WORLD_W, h: WORLD_H } };
}
