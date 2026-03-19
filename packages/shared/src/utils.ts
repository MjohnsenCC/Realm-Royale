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
  BASE_HP_REGEN,
  HP_REGEN_PER_LEVEL,
  BASE_MAX_MANA,
  BASE_MANA_REGEN,
  MANA_PER_LEVEL,
  MANA_REGEN_PER_LEVEL,
  HOSTILE_WIDTH,
  HOSTILE_HEIGHT,
  TILE_SIZE,
} from "./constants";
import { ItemCategory, PlayerZone, DungeonType, StatType, getZoneBase, ArmorSubtype } from "./types";
import { DUNGEON_CONFIGS, getGeneratedDungeonDimensions } from "./dungeonMap";
import { generateNexusMap } from "./nexusMap";
import { generateVaultMap } from "./vaultMap";
import { ITEM_DEFS, getItemCategory, getItemSubtype } from "./items";
import {
  ItemInstanceData,
  isEmptyItem,
  getStatValue,
  getLockedStatValue,
  getScaledWeaponStats,
  getScaledAbilityStats,
  ARMOR_LOCKED_STAT_MULTIPLIER,
  ARMOR_LOCKED_STATS,
  LOCKED_STATS_BY_CATEGORY,
} from "./itemStats";

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
    speed: BASE_SPEED + (l - 1) * SPEED_PER_LEVEL,
    hpRegen: BASE_HP_REGEN + (l - 1) * HP_REGEN_PER_LEVEL,
  };
}

/** Accumulate stat bonuses from an item's locked + open stats. */
function accumulateItemBonuses(
  item: ItemInstanceData,
  bonuses: {
    damage: number;
    cooldownReduction: number;
    maxHp: number;
    hpRegen: number;
    manaRegen: number;
    maxMana: number;
    speed: number;
    projSpeed: number;
    physDmgReduce: number;
    magicDmgReduce: number;
    abilityDamage: number;
    abilityCooldownReduction: number;
    projSpeedPercent: number;
    critChance: number;
    critMultiplier: number;
  },
  lockedStatMultiplier: number = 1.0
): void {
  if (isEmptyItem(item)) return;

  // Locked stats — value determined by item tier (or UT range) + roll
  const category = getItemCategory(item.baseItemId);
  addLockedStatBonus(bonuses, item.lockedStat1Type, item.instanceTier, item.lockedStat1Roll, item.isUT, lockedStatMultiplier, category);
  addLockedStatBonus(bonuses, item.lockedStat2Type, item.instanceTier, item.lockedStat2Roll, item.isUT, lockedStatMultiplier, category);

  // Open stats (packed as [type, tier, roll, type, tier, roll, ...])
  for (let i = 0; i < item.openStats.length; i += 3) {
    addOpenStatBonus(bonuses, item.openStats[i], item.openStats[i + 1], item.openStats[i + 2]);
  }
}

function addLockedStatBonus(
  bonuses: {
    damage: number;
    cooldownReduction: number;
    maxHp: number;
    hpRegen: number;
    manaRegen: number;
    maxMana: number;
    speed: number;
    projSpeed: number;
    physDmgReduce: number;
    magicDmgReduce: number;
    abilityDamage: number;
    abilityCooldownReduction: number;
    projSpeedPercent: number;
    critChance: number;
    critMultiplier: number;
  },
  statType: number,
  itemTier: number,
  roll: number,
  isUT: boolean,
  multiplier: number = 1.0,
  category?: number
): void {
  if (statType < 0) return;
  const rawValue = getLockedStatValue(statType, itemTier, roll, isUT, category);
  const value = multiplier !== 1.0 ? Math.round(rawValue * multiplier) : rawValue;
  applyStatBonus(bonuses, statType, value);
}

function addOpenStatBonus(
  bonuses: {
    damage: number;
    cooldownReduction: number;
    maxHp: number;
    hpRegen: number;
    manaRegen: number;
    maxMana: number;
    speed: number;
    projSpeed: number;
    physDmgReduce: number;
    magicDmgReduce: number;
    abilityDamage: number;
    abilityCooldownReduction: number;
    projSpeedPercent: number;
    critChance: number;
    critMultiplier: number;
  },
  statType: number,
  statTier: number,
  roll: number
): void {
  if (statType < 0 || statTier <= 0) return;
  const value = getStatValue(statType, statTier, roll);
  applyStatBonus(bonuses, statType, value);
}

function applyStatBonus(
  bonuses: {
    damage: number;
    cooldownReduction: number;
    maxHp: number;
    hpRegen: number;
    manaRegen: number;
    maxMana: number;
    speed: number;
    projSpeed: number;
    physDmgReduce: number;
    magicDmgReduce: number;
    abilityDamage: number;
    abilityCooldownReduction: number;
    projSpeedPercent: number;
    critChance: number;
    critMultiplier: number;
  },
  statType: number,
  value: number
): void {
  switch (statType) {
    case StatType.AttackDamage:
      bonuses.damage += value;
      break;
    case StatType.AttackSpeed:
      bonuses.cooldownReduction += value;
      break;
    case StatType.Health:
      bonuses.maxHp += value;
      break;
    case StatType.HealthRegen:
      bonuses.hpRegen += value;
      break;
    case StatType.ManaRegen:
      bonuses.manaRegen += value;
      break;
    case StatType.Mana:
      bonuses.maxMana += value;
      break;
    case StatType.MovementSpeed:
      bonuses.speed += value;
      break;
    case StatType.PhysicalDamageReduction:
      bonuses.physDmgReduce += value;
      break;
    case StatType.MagicDamageReduction:
      bonuses.magicDmgReduce += value;
      break;
    case StatType.AbilityDamage:
      bonuses.abilityDamage += value;
      break;
    case StatType.ReducedAbilityCooldown:
      bonuses.abilityCooldownReduction += value;
      break;
    case StatType.IncreasedProjectileSpeed:
      bonuses.projSpeedPercent += value;
      break;
    case StatType.CriticalStrikeChance:
      bonuses.critChance += value;
      break;
    case StatType.CriticalStrikeMultiplier:
      bonuses.critMultiplier += value;
      break;
  }
}

/** Compute full player stats combining level + equipment bonuses. */
export function computePlayerStats(
  level: number,
  equipment: ItemInstanceData[]
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
  physDmgReduce: number;
  magicDmgReduce: number;
  abilityDamageBonus: number;
  abilityCooldownReduction: number;
  critChance: number;
  critMultiplier: number;
} {
  const base = getStatsForLevel(level);
  const bonuses = {
    damage: 0,
    cooldownReduction: 0,
    maxHp: 0,
    hpRegen: 0,
    manaRegen: 0,
    maxMana: 0,
    speed: 0,
    projSpeed: 0,
    physDmgReduce: 0,
    magicDmgReduce: 0,
    abilityDamage: 0,
    abilityCooldownReduction: 0,
    projSpeedPercent: 0,
    critChance: 0,
    critMultiplier: 0,
  };

  // Default weapon stats (fallback if no weapon)
  let weaponDamage = base.damage;
  let weaponCooldown = base.shootCooldown;
  let weaponRange = 100;
  let weaponProjSpeed = 300;
  let weaponProjSize = 5;

  // --- Weapon ---
  const weapon = equipment[ItemCategory.Weapon];
  if (weapon && !isEmptyItem(weapon)) {
    const subtype = getItemSubtype(weapon.baseItemId);
    if (weapon.isUT) {
      // UT weapons use ITEM_DEFS base values with quality roll applied
      const def = ITEM_DEFS[weapon.baseItemId];
      if (def?.weaponStats) {
        const utBase = {
          baseDamage: def.weaponStats.damage,
          baseCooldown: def.weaponStats.shootCooldown,
          baseRange: def.weaponStats.range,
          baseProjSpeed: def.weaponStats.projectileSpeed,
          baseProjSize: def.weaponStats.projectileSize,
        };
        const scaled = getScaledWeaponStats(subtype, 0, weapon.lockedStat1Roll, weapon.lockedStat2Roll, true, utBase);
        weaponDamage = scaled.damage;
        weaponCooldown = scaled.shootCooldown;
        weaponRange = scaled.range;
        weaponProjSpeed = scaled.projectileSpeed;
        weaponProjSize = scaled.projectileSize;
      }
    } else {
      const scaled = getScaledWeaponStats(subtype, weapon.instanceTier, weapon.lockedStat1Roll, weapon.lockedStat2Roll);
      weaponDamage = scaled.damage;
      weaponCooldown = scaled.shootCooldown;
      weaponRange = scaled.range;
      weaponProjSpeed = scaled.projectileSpeed;
      weaponProjSize = scaled.projectileSize;
    }
  }

  // --- UT Armor unique bonuses (beyond locked stats) ---
  const armor = equipment[ItemCategory.Armor];
  if (armor && !isEmptyItem(armor) && armor.isUT) {
    const def = ITEM_DEFS[armor.baseItemId];
    if (def?.armorStats) {
      // Only apply unique bonuses — HP and HealthRegen come from locked stats
      if (def.armorStats.manaRegenBonus) bonuses.manaRegen += def.armorStats.manaRegenBonus;
      if (def.armorStats.speedBonus) bonuses.speed += def.armorStats.speedBonus;
    }
  }

  // --- UT Ring unique bonuses (beyond locked stats) ---
  const ring = equipment[ItemCategory.Ring];
  if (ring && !isEmptyItem(ring) && ring.isUT) {
    const def = ITEM_DEFS[ring.baseItemId];
    if (def?.ringStats) {
      bonuses.speed += def.ringStats.speedBonus;
      bonuses.damage += def.ringStats.damageBonus;
      bonuses.hpRegen += def.ringStats.hpRegenBonus;
      bonuses.maxHp += def.ringStats.maxHpBonus;
      if (def.ringStats.projSpeedBonus) {
        bonuses.projSpeed += def.ringStats.projSpeedBonus;
      }
    }
  }

  // --- Accumulate locked + open stat bonuses from all equipment ---
  for (let i = 0; i < equipment.length; i++) {
    const item = equipment[i];
    if (item) {
      // Armor gets subtype-specific locked stat multiplier
      let lockedMult = 1.0;
      if (i === ItemCategory.Armor && !isEmptyItem(item)) {
        const armorSubtype = getItemSubtype(item.baseItemId);
        lockedMult = ARMOR_LOCKED_STAT_MULTIPLIER[armorSubtype] ?? 1.0;
      }
      accumulateItemBonuses(item, bonuses, lockedMult);
    }
  }

  const l = clamp(level, 1, MAX_LEVEL);
  const manaBase = BASE_MAX_MANA + (l - 1) * MANA_PER_LEVEL;
  const manaRegenBase = BASE_MANA_REGEN + (l - 1) * MANA_REGEN_PER_LEVEL;

  return {
    maxHp: base.maxHp + bonuses.maxHp,
    damage: weaponDamage + bonuses.damage,
    shootCooldown: Math.max(MIN_SHOOT_COOLDOWN, Math.round(weaponCooldown / (1 + bonuses.cooldownReduction / 100))),
    speed: base.speed + bonuses.speed,
    hpRegen: base.hpRegen + bonuses.hpRegen,
    maxMana: manaBase + bonuses.maxMana,
    manaRegen: manaRegenBase + bonuses.manaRegen,
    weaponRange,
    weaponProjSpeed: Math.round((weaponProjSpeed + bonuses.projSpeed) * (1 + bonuses.projSpeedPercent / 100)),
    weaponProjSize,
    physDmgReduce: Math.min(bonuses.physDmgReduce, 75),
    magicDmgReduce: Math.min(bonuses.magicDmgReduce, 75),
    abilityDamageBonus: bonuses.abilityDamage,
    abilityCooldownReduction: bonuses.abilityCooldownReduction,
    critChance: bonuses.critChance,
    critMultiplier: bonuses.critMultiplier,
  };
}

/** Migrate an item from the old locked-stat-tier system to the new item-tier-based system.
 *  Old items have lockedStat1Tier > 0; new items have lockedStat1Tier = 0.
 *  For old UT items (lockedStat1Type === -1, isUT === true), re-roll locked stats. */
export function migrateLockedStats(item: ItemInstanceData): ItemInstanceData {
  // Already migrated or new system
  if (item.lockedStat1Tier === 0 && item.lockedStat2Tier === 0) return item;

  // Old UT items had no locked stats — give them fresh rolls
  if (item.isUT && item.lockedStat1Type === -1) {
    const category = getItemCategory(item.baseItemId);
    const subtype = getItemSubtype(item.baseItemId);
    let lockedStats: [number, number] = [-1, -1];
    if (category === ItemCategory.Armor) {
      lockedStats = ARMOR_LOCKED_STATS[subtype] ?? LOCKED_STATS_BY_CATEGORY[category] ?? [-1, -1];
    } else if (category === ItemCategory.Ring) {
      lockedStats = LOCKED_STATS_BY_CATEGORY[category] ?? [-1, -1];
    }
    return {
      ...item,
      lockedStat1Type: lockedStats[0],
      lockedStat1Tier: 0,
      lockedStat1Roll: Math.floor(Math.random() * 101),
      lockedStat2Type: lockedStats[1],
      lockedStat2Tier: 0,
      lockedStat2Roll: Math.floor(Math.random() * 101),
    };
  }

  // Old tiered items: just clear the tier fields, keep the rolls as-is.
  // The old roll (0-100) within the old tier range is repurposed as the roll
  // within the new item-tier range. Values will shift but this is acceptable
  // for a one-time migration.
  return {
    ...item,
    lockedStat1Tier: 0,
    lockedStat2Tier: 0,
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

/** Map dungeon zone strings to DungeonType for dimension lookup. */
const ZONE_TO_DUNGEON_TYPE: Record<string, number> = {
  [PlayerZone.DungeonInfernal]: DungeonType.InfernalPit,
  [PlayerZone.DungeonVoid]: DungeonType.VoidSanctum,
};

/** Get zone dimensions for a given zone string (supports instanced zones like "hostile:1"). */
export function getZoneDimensions(zone: string): {
  width: number;
  height: number;
} {
  const base = getZoneBase(zone);
  if (base === PlayerZone.Nexus) {
    const nexus = generateNexusMap();
    return { width: nexus.width * TILE_SIZE, height: nexus.height * TILE_SIZE };
  }
  if (base === PlayerZone.Vault) {
    const vault = generateVaultMap();
    return { width: vault.width * TILE_SIZE, height: vault.height * TILE_SIZE };
  }
  const dType = ZONE_TO_DUNGEON_TYPE[base];
  if (dType !== undefined) {
    // Use actual generated dimensions if available (dynamic grid sizing)
    const generated = getGeneratedDungeonDimensions(dType);
    if (generated) {
      return {
        width: generated.width * TILE_SIZE,
        height: generated.height * TILE_SIZE,
      };
    }
    // Fallback to static config
    const config = DUNGEON_CONFIGS[dType];
    if (config) {
      return {
        width: config.tilesX * TILE_SIZE,
        height: config.tilesY * TILE_SIZE,
      };
    }
  }
  // Hostile zone uses new island map dimensions
  return { width: HOSTILE_WIDTH, height: HOSTILE_HEIGHT };
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
