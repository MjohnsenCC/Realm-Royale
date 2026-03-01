import {
  MAX_LEVEL,
  BASE_MAX_HP,
  HP_PER_LEVEL,
  BASE_DAMAGE,
  DAMAGE_PER_LEVEL,
  BASE_SHOOT_COOLDOWN,
  COOLDOWN_REDUCTION_PER_LEVEL,
  MIN_SHOOT_COOLDOWN,
  BASE_SPEED,
  SPEED_PER_LEVEL,
  MAX_SPEED,
  BASE_HP_REGEN,
  HP_REGEN_PER_LEVEL,
  BASE_MAX_MANA,
  BASE_MANA_REGEN,
  MANA_PER_LEVEL,
  MANA_REGEN_PER_LEVEL,
} from "./constants";
import { ItemCategory } from "./types";
import { ITEM_DEFS } from "./items";

/** Cumulative XP required to reach a given level. Level 1 = 0 XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * level * level;
}

/** Derive current level from cumulative XP. */
export function getPlayerLevel(xp: number): number {
  if (xp <= 0) return 1;
  const n = Math.floor(Math.sqrt(xp / 50));
  return clamp(Math.max(1, n), 1, MAX_LEVEL);
}

/** Get stat values for a given level. */
export function getStatsForLevel(level: number) {
  const l = clamp(level, 1, MAX_LEVEL);
  return {
    maxHp: BASE_MAX_HP + (l - 1) * HP_PER_LEVEL,
    damage: BASE_DAMAGE + (l - 1) * DAMAGE_PER_LEVEL,
    shootCooldown: Math.max(MIN_SHOOT_COOLDOWN, BASE_SHOOT_COOLDOWN - (l - 1) * COOLDOWN_REDUCTION_PER_LEVEL),
    speed: Math.min(MAX_SPEED, BASE_SPEED + (l - 1) * SPEED_PER_LEVEL),
    hpRegen: BASE_HP_REGEN + (l - 1) * HP_REGEN_PER_LEVEL,
  };
}

/** Compute full player stats combining level + equipment bonuses. */
export function computePlayerStats(
  level: number,
  equipment: number[]
): {
  maxHp: number;
  damage: number;
  shootCooldown: number;
  speed: number;
  hpRegen: number;
  maxMana: number;
  manaRegen: number;
  weaponRange: number;
  weaponProjSpeed: number;
  weaponProjSize: number;
} {
  const base = getStatsForLevel(level);
  let maxHpBonus = 0;
  let damageBonus = 0;
  let speedBonus = 0;
  let hpRegenBonus = 0;
  let maxManaBonus = 0;

  // Weapon stats (fallback if no weapon)
  let weaponDamage = base.damage;
  let weaponCooldown = base.shootCooldown;
  let weaponRange = 100;
  let weaponProjSpeed = 300;
  let weaponProjSize = 5;

  const weaponId = equipment[ItemCategory.Weapon] ?? -1;
  if (weaponId >= 0) {
    const def = ITEM_DEFS[weaponId];
    if (def?.weaponStats) {
      weaponDamage = def.weaponStats.damage;
      weaponCooldown = def.weaponStats.shootCooldown;
      weaponRange = def.weaponStats.range;
      weaponProjSpeed = def.weaponStats.projectileSpeed;
      weaponProjSize = def.weaponStats.projectileSize;
    }
  }

  // Armor
  const armorId = equipment[ItemCategory.Armor] ?? -1;
  if (armorId >= 0) {
    const def = ITEM_DEFS[armorId];
    if (def?.armorStats) {
      maxHpBonus += def.armorStats.maxHpBonus;
    }
  }

  // Ring
  const ringId = equipment[ItemCategory.Ring] ?? -1;
  if (ringId >= 0) {
    const def = ITEM_DEFS[ringId];
    if (def?.ringStats) {
      speedBonus += def.ringStats.speedBonus;
      damageBonus += def.ringStats.damageBonus;
      hpRegenBonus += def.ringStats.hpRegenBonus;
      maxHpBonus += def.ringStats.maxHpBonus;
      maxManaBonus += def.ringStats.maxManaBonus;
    }
  }

  const l = clamp(level, 1, MAX_LEVEL);
  const manaBase = BASE_MAX_MANA + (l - 1) * MANA_PER_LEVEL;
  const manaRegenBase = BASE_MANA_REGEN + (l - 1) * MANA_REGEN_PER_LEVEL;

  return {
    maxHp: base.maxHp + maxHpBonus,
    damage: weaponDamage + damageBonus,
    shootCooldown: weaponCooldown,
    speed: Math.min(MAX_SPEED, base.speed + speedBonus),
    hpRegen: base.hpRegen + hpRegenBonus,
    maxMana: manaBase + maxManaBonus,
    manaRegen: manaRegenBase,
    weaponRange,
    weaponProjSpeed,
    weaponProjSize,
  };
}

export function distanceBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  return distanceBetween(x1, y1, x2, y2) < r1 + r2;
}

export function normalizeVector(
  x: number,
  y: number
): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/**
 * Apply a single movement input to a position. Used by both server (authoritative)
 * and client (prediction + reconciliation) to guarantee identical results.
 */
export function applyMovement(
  x: number,
  y: number,
  inputX: number,
  inputY: number,
  speed: number,
  dt: number,
  radius: number,
  arenaW: number,
  arenaH: number
): { x: number; y: number } {
  const norm = normalizeVector(inputX, inputY);
  const dist = speed * (dt / 1000);
  return {
    x: clamp(x + norm.x * dist, radius, arenaW - radius),
    y: clamp(y + norm.y * dist, radius, arenaH - radius),
  };
}
