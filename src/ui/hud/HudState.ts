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
  /** Only real cooldowns from the game, on the adapter clock (`now` passed to update). */
  cooldown: null | { endTimeMs: number; durationMs: number };
}

export interface HudMarker { id: string; kind: 'player' | 'remote' | 'enemy' | 'npc' | 'quest'; x: number; y: number }

export interface HudState {
  mode: 'pve' | 'pvp';
  player: {
    id: string; name: string; level: number; portrait?: PortraitRef;
    hp: number; maxHp: number;
    /** null => resource row hidden (no MP/energy system yet). */
    resource: null | { kind: 'mp' | 'energy'; value: number; max: number };
    effects: HudEffect[];
  };
  /** null => target panel hidden. */
  target: null | { id: string; name: string; type: string; portrait?: PortraitRef; hp: number; maxHp: number; effects: HudEffect[] };
  slots: HudSlot[];
  minimap: null | { label: string; bounds: { minX: number; minY: number; width: number; height: number }; imageUrl?: string; markers: HudMarker[] };
  /** PvP only. score/kills/deaths reserved, not displayed. */
  room: null | { label: string; playerCount: number; maxPlayers?: number; score?: number; kills?: number; deaths?: number };
  /** Transient combo / chain / stun / next-hit presentation (no combo system yet => null). */
  combatFeedback: null | { count?: number; chain?: string; hitStun?: boolean; nextHit?: string; expiresAtMs: number };
}
