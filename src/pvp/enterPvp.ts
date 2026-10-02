import Phaser from 'phaser';
import { CharacterStore } from '../characters/CharacterStore';
import { ensurePvpRoomInUrl } from './Room';

/** Enter the PvP arena with the selected saved character; without one, go to Character Select (never auto-create). */
export function enterPvp(scene: Phaser.Scene): void {
  const room = ensurePvpRoomInUrl(); // ?mode=pvp&room=ID — shareable link
  if (!CharacterStore.getSelectedCharacter()) { scene.scene.start('CharacterSelectScene'); return; }
  scene.scene.start('LegacyCourtyardScene', { pvpRoom: room });
}
