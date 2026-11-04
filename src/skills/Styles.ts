// Fighting styles (David 4 Nov 04:27–05:45 — the styles page he approved): a hero changes style in the middle of a fight —
// his look, his weapon and his whole kit — in one quick move, even in the middle of a combo. The class's own kit is its
// first style; each new style is a full kit of its own (FinalKit: its skills carry `style`), worn on its own painted body.
// The Archer first: the Spirit Archer (the bow) and the Deadeye Sniper (GPT's design, scratchpad styles/archer_styles.md).

export interface StyleDef {
  id: string;
  name: string;
  /** Its painted body (a hero atlas key, tools/heroes/cut.py) — the class's own while it is not cut yet. */
  body?: string;
  /** Its colour: the switch's flash, its name on the call. */
  accent: number;
}

export const STYLES: Record<string, StyleDef[]> = {
  archer: [
    { id: 'bow', name: 'Spirit Archer', accent: 0x7ee35a },
    { id: 'sniper', name: 'Deadeye Sniper', body: 'archer_sniper', accent: 0xd8925a }, // (brushed copper: the rifle's receiver)
    { id: 'cannon', name: 'Recoil Cannoneer', body: 'archer_cannon', accent: 0xe0703a }, // (warm terracotta: the breech's pressure glow)
  ],
  // The Samurai second (David 4 Nov 14:59: a chain of different tools — a different fighter running in): the katana, his own
  // kit, and the Shuriken Assassin (GPT's design, scratchpad styles/samurai_styles.md) — the masked shinobi with the big
  // four-point star that goes out and comes home.
  samurai: [
    { id: 'katana', name: 'Crimson Katana', accent: 0xe0404e },
    { id: 'shuriken', name: 'Shuriken Assassin', body: 'samurai_assassin', accent: 0xc4d0de }, // (polished gunmetal: the big star's steel)
  ],
  // The Warrior third: the Lion Knight of the longsword, his own kit, and the Siege Warden (GPT's design, scratchpad
  // styles/warrior_styles.md) — the Lion Knight of the Iron Gate: a towering folding shield that opens into two iron wings
  // and shuts on the foe like a lion's jaws; iron, momentum and leverage, no holy light.
  warrior: [
    { id: 'longsword', name: 'Lion Longsword', accent: 0xe8b84a },
    { id: 'siege', name: 'Siege Warden', body: 'warrior_siege', accent: 0xe6dcc3 }, // (aged ivory: the gate's heraldic bands)
  ],
  // The Gambler fourth: the card gambler, his own kit, and the Radiant Duelist (GPT's design, scratchpad
  // styles/gambler_styles.md) — the cane unfolded into the Crown Staff, a two-handed staff of solid violet-white light; a
  // stage fencer who tells you what he will do and dares you to stop it.
  gambler: [
    { id: 'card', name: 'Card Gambler', accent: 0xff3ad6 },
    { id: 'radiant', name: 'Radiant Duelist', body: 'gambler_radiant', accent: 0xd9c8ff }, // (violet-white: the Crown Staff's light)
  ],
  // The Book Mage fifth: the book of spells, her own kit, and the Sailwright (GPT's design, scratchpad styles/mage_styles.md)
  // — the book unfolded into the Aether Sail, a seven-rib war fan: controlled force, not weather.
  book_mage: [
    { id: 'book', name: 'Arcane Tome', accent: 0x9fb4ff },
    { id: 'wind', name: 'Sailwright', body: 'book_mage_wind', accent: 0xa8f0d8 }, // (pale mint: the fan's rim)
  ],
};

export const stylesOf = (cls: string): StyleDef[] => STYLES[cls] ?? [];
/** The class a style's painted body belongs to (its atlas loads with the class's own). */
export const styleBodyClass = (body: string): string | undefined => Object.keys(STYLES).find((c) => STYLES[c].some((s) => s.body === body));
/** The class's own style (its original kit): its skills carry no `style`. */
export const baseStyle = (cls: string): string => STYLES[cls]?.[0]?.id ?? '';
export const styleDef = (cls: string, id: string): StyleDef | undefined => STYLES[cls]?.find((s) => s.id === id);
/** The style after this one (the switch key goes round them). */
export function nextStyle(cls: string, id: string): string {
  const list = stylesOf(cls); if (list.length < 2) return id;
  const i = list.findIndex((s) => s.id === id);
  return list[(i + 1) % list.length].id;
}

/** The switch into a style is a cast of its own hidden skill (FinalKit): it runs as every skill does — the cancel windows
 *  after a landed blow, the hit-stop, being hit out of it, the PvP cast message the other screens play. */
export const switchId = (cls: string, style: string): string => `style_${cls}_${style}`;
export function styleOfSwitch(id: string): { cls: string; style: string } | null {
  const m = /^style_([a-z_]+)_([a-z]+)$/.exec(id);
  return m && styleDef(m[1], m[2]) ? { cls: m[1], style: m[2] } : null;
}

/** GPT's switch (the styles page): 0–60 ms the weapon goes (one tight accent), 60–150 the change behind a compact flash —
 *  the new style is committed at 150 — 150–240 the new weapon lands in its ready pose and the next attack flows.
 *  Real time (not the fight's pace), never a light column or a zoom; hit before 150 ms, no change. */
export const SWITCH = { commitMs: 150, totalMs: 240, /** between two switches (no switching back and forth for free) */ cooldownMs: 700 };
