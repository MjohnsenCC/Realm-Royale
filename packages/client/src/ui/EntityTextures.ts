import Phaser from "phaser";
import { PROJECTILE_RADIUS, ProjectileType, CharacterClass } from "@rotmg-lite/shared";

const ENEMY_SPRITE_COUNT = 6;

/** Maps a CharacterClass id to its loaded sprite texture key. */
const CLASS_SPRITE_KEYS: Record<number, string> = {
  [CharacterClass.Archer]: "sprite-player-archer",
  [CharacterClass.Warrior]: "sprite-player-warrior",
  [CharacterClass.Arcanist]: "sprite-player-arcanist",
};

/** Returns the sprite texture key for a given character class. */
export function getPlayerSpriteKey(characterClass: number): string {
  return CLASS_SPRITE_KEYS[characterClass] ?? "sprite-player-archer";
}

/** Returns the sprite texture key for a given enemy type number. */
export function getEnemySpriteKey(enemyType: number): string {
  return `sprite-enemy-${(enemyType % ENEMY_SPRITE_COUNT) + 1}`;
}

/**
 * Pre-render shared utility textures and projectile shapes.
 * Player and enemy bodies now use loaded 8×8 pixel-art sprites
 * (scaled at runtime via setDisplaySize), so all entities sharing
 * the same sprite sheet batch into a single draw call — dramatically
 * fewer draw calls than per-type procedural textures.
 *
 * Call once per scene that uses entities (GameScene.create).
 */
export function generateEntityTextures(scene: Phaser.Scene): void {
  // Shared 1×1 white pixel — used for HP bars (tinted + scaled per entity)
  if (!scene.textures.exists("pixel")) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("pixel", 1, 1);
    g.destroy();
  }

  // Projectile textures (still procedural — small, few types, already batched well)
  generateProjectileTextures(scene);
}

function generateProjectileTextures(scene: Phaser.Scene): void {
  // Enemy bullet
  if (!scene.textures.exists("proj-enemy")) {
    const r = PROJECTILE_RADIUS;
    const size = (r + 2) * 2;
    const c = r + 2;
    const g = scene.add.graphics();
    g.fillStyle(0xff4444, 1);
    g.fillCircle(c, c, r);
    g.generateTexture("proj-enemy", size, size);
    g.destroy();
  }

  // Bow arrow (default player projectile) — white, tinted per tier at runtime
  if (!scene.textures.exists("proj-arrow")) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(12, 6, 10, 4);
    g.generateTexture("proj-arrow", 24, 12);
    g.destroy();
  }

  // Sword slash
  if (!scene.textures.exists("proj-sword")) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(14, 6, 24, 8);
    g.generateTexture("proj-sword", 28, 12);
    g.destroy();
  }

  // Wand bolt
  if (!scene.textures.exists("proj-wand")) {
    const g = scene.add.graphics();
    g.fillStyle(0xaa44ff, 0.7);
    g.fillEllipse(9, 5, 14, 5);
    g.fillStyle(0xcc88ff, 1);
    g.fillEllipse(9, 5, 8, 3);
    g.generateTexture("proj-wand", 18, 10);
    g.destroy();
  }

  // Quiver shot
  if (!scene.textures.exists("proj-quiver")) {
    const g = scene.add.graphics();
    g.fillStyle(0x44aaff, 0.5);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0x88ccff, 1);
    g.fillCircle(16, 16, 8);
    g.generateTexture("proj-quiver", 32, 32);
    g.destroy();
  }

  // Helm spin
  if (!scene.textures.exists("proj-helm")) {
    const g = scene.add.graphics();
    g.fillStyle(0xff6622, 0.6);
    g.fillCircle(14, 14, 12);
    g.fillStyle(0xffaa44, 1);
    g.fillEllipse(14, 14, 20, 8);
    g.generateTexture("proj-helm", 28, 28);
    g.destroy();
  }
}
