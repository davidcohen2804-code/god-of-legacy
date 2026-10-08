// HUD adapter contract (from the HUD package docs/HUD_STATE.ts, adapted to this project).
// The scene builds this snapshot from its existing state each frame; it is NOT a second game store.
// Future systems (resources, effects, cooldowns, combos, score) plug in by filling these fields.

/** Portrait source: a dedicated portrait file, or a crop of a full-body preview (source pixels). */
export interface PortraitRef { url: string; crop?: { x: number; y: number; w: number; imgW: number; imgH: number } }

export interface HudEffect { id: string; label: string; iconUrl: string; harmful: boolean; expiresAtMs?: number }

export interface HudSlot {
  id: string;
  label: string;
  hotkey: string;
  iconUrl?: string;
  assigned: boolean;
  enabled: boolean;
  pressed: boolean;
  /** Action lock / hard control: cannot execute now (aria-disabled + "Busy"), visual state unchanged. */
  busy?: boolean;
  /** Only real cooldowns from the game, on the adapter clock (`now` passed to update). */
  cooldown: null | { endTimeMs: number; durationMs: number };
  /** Signature (6) / Ultimate (7): stronger slot trim, same control scheme. */
  tier?: 'signature' | 'ultimate';
}

export interface HudMarker { id: string; kind: 'player' | 'remote' | 'enemy' | 'npc' | 'quest' | 'portal'; x: number; y: number }

export interface HudState {
  mode: 'pve' | 'pvp';
  player: {
    id: string; name: string; level: number; portrait?: PortraitRef;
    hp: number; maxHp: number;
    /** null => resource row hidden (no MP/energy system yet). */
    resource: null | { kind: 'mp' | 'energy'; value: number; max: number };
    /** Progress to the next level; omitted => the EXP bar shows empty. */
    exp?: { value: number; max: number };
    effects: HudEffect[];
    /** Job name under / beside the name. */
    job?: string;
    /** Gold carried (PvE). */
    gold?: number;
    /** HP / MP potion hotkeys (PvE). */
    potions?: { id: string; name: string; iconUrl: string; count: number; hotkey: string }[];
  };
  /** null => target panel hidden. */
  target: null | { id: string; name: string; type: string; portrait?: PortraitRef; hp: number; maxHp: number; effects: HudEffect[];
    /** Combat state chip (AERIAL / DOWN / STAND) and combo-protection gauges (0..1 of each threshold). */
    state?: string; gauges?: { stand: number; air: number; down: number } };
  slots: HudSlot[];
  /** bounds: the stretch of the world the minimap shows (square, around the player); image: where its picture lies in
   *  world px (default: exactly bounds). */
  minimap: null | { label: string; bounds: { minX: number; minY: number; width: number; height: number }; imageUrl?: string; image?: { x: number; y: number; w: number; h: number }; markers: HudMarker[] };
  /** PvP only. score/kills/deaths reserved, not displayed. */
  room: null | { label: string; playerCount: number; maxPlayers?: number; score?: number; kills?: number; deaths?: number };
  /** Transient combo / chain / stun / next-hit presentation (no combo system yet => null). */
  combatFeedback: null | { count?: number; chain?: string; hitStun?: boolean; nextHit?: string; expiresAtMs: number };
}
