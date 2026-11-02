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
  /** A second hand on a held weapon (a staff in both hands): solved onto the weapon after every evaluation. */
  hold?: HoldDef;
}

/** A second grip on a held weapon. The weapon stays a rigid child of its own hand; this arm (upper arm, forearm,
 *  hand) is solved every frame by two-bone IK so that its grip bone sits on the weapon's axis `at` B units from the
 *  weapon's own grip, turned along the weapon. The elbow bends the way the animation's keys bend it. */
export interface HoldDef { arm: [string, string, string]; grip: string; weapon: string; at: number }

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
  /** A joint cap: drawn at the bone's origin, turned by this fraction of the bone's rotation against its parent
   *  (0.5 = half way), so the piece covering a shoulder or an elbow bends less than the limb under it. */
  blend?: number;
  /** Follow-through: each frame the piece keeps this share of its last turn toward where its bone puts it (0 = none),
   *  never more than `lagMax` degrees behind (a coat's tail swinging a moment after the leg). */
  lag?: number;
  lagMax?: number;
  /** A cloth strip: the slot's picture is drawn bent along these chain bones (the first is the slot's bone), top edge
   *  at the bone's origin minus the frame's pivot. Its top follows the parent's rest direction (pinned at the clasps). */
  strip?: string[];
  /** A limb strip (the body template's arms and legs, and every item drawn on them): the slot's picture is the limb
   *  drawn straight, top to bottom, bent along two bones: straight along the first, round about the joint between them
   *  (radius `bend`, B), straight along the second. Rows are tied to the joints: the top joint is `top` B below the
   *  picture's top edge, the middle and end joints follow at the bones' lengths, and `bottom` B of picture go on past
   *  the end joint. Every picture on the slot is cut to that same layout, so they all bend the same way. */
  limb?: { bones: [string, string]; top: number; bottom: number; bend: number };
  /** A skirt (the art director's skirt garment profile): the slot's picture is a skirt's cloth below its waistband, and
   *  its frame carries the line it hangs from and its hem (frame px, at evenly spaced columns: `customData.skirt`). The
   *  picture is drawn as one fan of columns, each turning about its own point on the hang line (the waistband never
   *  moves against the slot's bone): the back edge as far back as the thigh swung furthest back, the front edge as far
   *  forward as the thigh swung furthest forward, the columns between in proportion, so it answers both thighs and
   *  never one leg alone. A thigh lifted past `from` degrees lifts its edge `lift` times as much again, and the cloth on
   *  that side rides up over it by `rise` B per radian (a raised knee carries the cloth over it, not through it; under the
   *  waistband the rise is hidden). The edges follow through: a thigh pushes its edge out at once, and the cloth falls
   *  back keeping `lag` of each frame's turn, never more than `lagMax` degrees behind. */
  skirt?: { thighs: [string, string]; from: number; lift: number; rise: number; lag: number; lagMax: number };
}

/** An item's settings for one of the rig's optional attachment chains (a cloth piece that swings on its own: a tabard,
 *  coat tails). The chain's bones exist in the rig; the item that hangs something on them places and tunes them. */
export interface AttachSpec {
  /** The rig's attachment chain (RigDef.attach). */
  chain: string;
  /** Where the chain hangs from on its parent bone (B units, the parent's rest frame), its rest angle against the parent
   *  (degrees; 90 = straight down the hips) and its links' lengths (B). */
  at: [number, number]; rest: number; lens: number[];
  /** Spring: stiffness, damping, response per link to forward speed and to vertical speed (degrees per unit), limit. */
  k: number; c: number; gainV: number[]; gainZ: number[]; limit: number;
  /** How far each link after the first swings back when the one above it is pushed away from its rest angle (0..1). */
  hang?: number;
  /** Bones it must stay in front of (e.g. the thighs): the first link is never further back than the most forward of
   *  them, plus `margin` degrees, so a raised knee lifts the cloth instead of passing through it. */
  clearOf?: string[]; margin?: number;
  /** How much the piece keeps the direction it hangs in at the stance when the hips tip (0 = turns with the hips, as a
   *  rigid piece; 1 = keeps hanging the same way). Measured from the rig's `attachRef`, so the stance itself is untouched. */
  gravity?: number;
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
  /** Optional attachment chains (name → bones, parent first): idle and rigid unless a worn item hangs a piece on them
   *  (AttachSpec); they come after the body's bones, so the body's own motion never depends on them. */
  attach?: Record<string, string[]>;
  /** Per attachment chain: its parent's world angle (degrees) in the stance the items' rest angles are drawn for
   *  (AttachSpec.gravity). */
  attachRef?: Record<string, number>;
}
