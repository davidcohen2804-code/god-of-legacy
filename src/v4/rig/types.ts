// V4 rig lab — data types. Rig units = master art px (B = 768 = sole to skull top). Angles in degrees, clockwise on
// screen (y points down, as in Phaser). Placeholder art only: nothing here is used by the game.

export type Ease = 'linear' | 'step' | 'inout' | 'in' | 'out';

/** One key of a curve. `e` = the easing from this key to the next one. Values are deltas from the rest pose:
 *  rotation in degrees, translation in B units. */
export interface Key { t: number; v: number; e?: Ease }

export interface SwapKey { t: number; v: string }

/** From `t` on (until the next order key): move a slot, or every slot of `group:<name>`, so it is drawn just before
 *  `before` (a slot, or `group:<name>`). `before: null` = back to the default order. */
export interface OrderKey { t: number; move: string; before: string | null }

export interface BoneTimeline { r?: Key[]; x?: Key[]; y?: Key[] }

export interface AnimDef {
  name: string;
  /** Seconds. */
  dur: number;
  loop: boolean;
  bones: Record<string, BoneTimeline>;
  /** Corrective channels (hand poses, torso turn, face, feet): which image variant each slot of that channel shows. */
  swaps?: Record<string, SwapKey[]>;
  order?: OrderKey[];
  events?: { t: number; name: string }[];
  /** Named times (segment boundaries) used to fit gameplay phases onto the animation. */
  marks?: Record<string, number>;
}

export interface BoneDef {
  name: string;
  parent: string | null;
  /** Rest position in the parent's space, in B units. */
  x: number; y: number;
  /** Rest rotation relative to the parent, degrees. */
  r: number;
  /** Length in B units (where a child sits along the bone). */
  len: number;
}

/** Who may draw into a rig slot (exactly one wardrobe slot owns each rig slot; `overall` may use what top and bottom own). */
export type WardrobeSlot = 'body' | 'face' | 'hair' | 'head' | 'eyeacc' | 'faceacc' | 'earring' | 'top' | 'bottom' | 'overall'
  | 'gloves' | 'shoes' | 'back' | 'weapon';

export interface SlotDef {
  name: string;
  bone: string;
  /** Draw group (section 5.1 of the proposal): ground, behind, armB, legB, legF, torso, head, armF, front. */
  group: string;
  owner: WardrobeSlot;
  /** Corrective channel that picks this slot's image variant (hand pose, torso turn, face, foot). */
  channel?: string;
}

export interface RigDef {
  id: string;
  /** Rig units per B. */
  B: number;
  bones: BoneDef[];
  /** In default draw order, back to front. */
  slots: SlotDef[];
  /** Corrective channels and their allowed values; the first value is the default. */
  channels: Record<string, string[]>;
}
