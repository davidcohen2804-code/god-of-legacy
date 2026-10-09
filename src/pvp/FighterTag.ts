// A fighter's tag in a battle (Tekken-style), under the feet (MapleStory's place for a name — never over the head): a
// slanted dark plate with the name in the fight's lettering, a bar and a notch pointing up at the fighter in the class
// colour, and YOU on your own. One texture per tag (drawn at 2x for a crisp zoom), shared by a samurai's doubles.
import Phaser from 'phaser';

const RES = 2;
/** The tag image's scale (its texture is drawn at RES x). */
export const TAG_SCALE = 1 / RES;
const NAME_FONT = "'Exo 2', 'Segoe UI', sans-serif";
const CHIP_FONT = "Inter, 'Segoe UI', sans-serif";
/** Plate height, slant, side padding, the notch over it (world px). */
const H = 23, SLANT = 8, PAD = 13, POINT = 6;

/** The tag's lettering, loaded (a canvas draws only a face the page already has). */
export function tagFontsReady(): Promise<unknown> {
  const f = document.fonts;
  if (!f?.load) return Promise.resolve();
  return Promise.all([f.load(`italic 800 16px ${NAME_FONT}`), f.load(`italic 700 10px ${CHIP_FONT}`)]).catch(() => undefined);
}

/** The texture key of a fighter's tag (drawn the first time). */
export function fighterTag(scene: Phaser.Scene, name: string, color: string, you: boolean): string {
  const label = name.toUpperCase(), key = `ftag|${you ? 1 : 0}|${color}|${label}`;
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas'), g = c.getContext('2d')!;
  g.font = `italic 800 16px ${NAME_FONT}`;
  const tw = Math.ceil(g.measureText(label).width) + 2; // (+ the italic's lean)
  const chip = you ? 30 : 0, W = tw + PAD * 2 + SLANT + chip; // (YOU: its chip, then the name)
  c.width = W * RES; c.height = (H + POINT + 1) * RES;
  g.scale(RES, RES);
  // the notch, up at the fighter's feet
  g.beginPath(); g.moveTo(W / 2 - 6, POINT + 0.5); g.lineTo(W / 2 + 6, POINT + 0.5); g.lineTo(W / 2, 0); g.closePath();
  g.fillStyle = color; g.fill();
  g.translate(0, POINT); // the plate under it: dark metal, the class colour along the top, a line of light along the bottom
  const plate = () => { g.beginPath(); g.moveTo(SLANT, 0); g.lineTo(W, 0); g.lineTo(W - SLANT, H); g.lineTo(0, H); g.closePath(); };
  plate();
  const fill = g.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, 'rgba(38,45,64,0.96)'); fill.addColorStop(1, 'rgba(6,8,14,0.96)');
  g.fillStyle = fill; g.fill();
  g.save(); plate(); g.clip();
  g.fillStyle = color; g.fillRect(0, 0, W, 3);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, H - 1, W, 1);
  g.restore();
  // YOU: a white chip before the name
  let x = SLANT / 2 + PAD;
  if (you) {
    const cx = SLANT / 2 + 8, cy = 6, cw = 30, ch = 13;
    g.beginPath(); g.moveTo(cx + 3, cy); g.lineTo(cx + cw, cy); g.lineTo(cx + cw - 3, cy + ch); g.lineTo(cx, cy + ch); g.closePath();
    g.fillStyle = '#ffffff'; g.fill();
    g.font = `italic 700 9.5px ${CHIP_FONT}`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#0b0d12';
    g.fillText('YOU', cx + cw / 2, cy + ch / 2 + 0.5);
    x = cx + cw + 8;
  }
  // the name
  g.font = `italic 800 16px ${NAME_FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowOffsetY = 1.5; g.shadowBlur = 0;
  g.fillStyle = '#ffffff'; g.fillText(label, x, (H + 3) / 2 + 1);
  scene.textures.addCanvas(key, c);
  return key;
}
