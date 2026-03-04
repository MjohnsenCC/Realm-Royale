import Phaser from "phaser";
import { ItemCategory, WeaponSubtype, ConsumableSubtype, CraftingOrbType } from "@rotmg-lite/shared";
import { TIER_COLORS, ORB_DEFINITIONS } from "@rotmg-lite/shared";

/**
 * Draw an item icon shape on a Phaser Graphics object.
 * Shape is determined by item category and subtype.
 */
export function drawItemIcon(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  category: number,
  subtype: number,
  color: number
): void {
  const half = size / 2;

  g.fillStyle(color, 0.9);
  g.lineStyle(1, 0xffffff, 0.3);

  if (category === ItemCategory.Weapon && subtype === WeaponSubtype.Sword) {
    // Sword: vertical blade with crossguard
    const bw = size * 0.18;
    const bh = size * 0.7;
    // Blade
    g.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    g.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    // Crossguard
    const gw = size * 0.5;
    const gh = size * 0.12;
    g.fillRect(cx - gw / 2, cy + bh * 0.1, gw, gh);
    g.strokeRect(cx - gw / 2, cy + bh * 0.1, gw, gh);
  } else if (category === ItemCategory.Weapon && subtype === WeaponSubtype.Bow) {
    // Bow: arc with string
    g.beginPath();
    g.arc(cx - half * 0.3, cy, half * 0.8, -Math.PI * 0.4, Math.PI * 0.4, false);
    g.strokePath();
    // String (straight line)
    const topY = cy - Math.sin(Math.PI * 0.4) * half * 0.8;
    const botY = cy + Math.sin(Math.PI * 0.4) * half * 0.8;
    const stringX = cx - half * 0.3 + Math.cos(Math.PI * 0.4) * half * 0.8;
    g.lineStyle(1, color, 0.9);
    g.beginPath();
    g.moveTo(stringX, topY);
    g.lineTo(stringX, botY);
    g.strokePath();
    // Arrow
    g.lineStyle(1, 0xffffff, 0.3);
    g.fillStyle(color, 0.9);
    g.beginPath();
    g.moveTo(cx + half * 0.5, cy);
    g.lineTo(cx + half * 0.2, cy - half * 0.15);
    g.lineTo(cx + half * 0.2, cy + half * 0.15);
    g.closePath();
    g.fillPath();
  } else if (category === ItemCategory.Ability) {
    // Quiver/Ability: diamond shape
    g.beginPath();
    g.moveTo(cx, cy - half * 0.7);
    g.lineTo(cx + half * 0.5, cy);
    g.lineTo(cx, cy + half * 0.7);
    g.lineTo(cx - half * 0.5, cy);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else if (category === ItemCategory.Armor) {
    // Shield: pentagon shape
    const r = half * 0.65;
    g.beginPath();
    g.moveTo(cx - r, cy - r * 0.6);
    g.lineTo(cx + r, cy - r * 0.6);
    g.lineTo(cx + r, cy + r * 0.2);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r, cy + r * 0.2);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else if (category === ItemCategory.Ring) {
    // Ring: circle outline
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(cx, cy, half * 0.45);
    // Small gem on top
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy - half * 0.45, half * 0.15);
  } else if (category === ItemCategory.Consumable) {
    if (subtype === ConsumableSubtype.HealthPot || subtype === ConsumableSubtype.ManaPot) {
      // Potion bottle
      const bw = size * 0.35;
      const bh = size * 0.55;
      g.fillRect(cx - bw / 2, cy - bh / 2 + size * 0.05, bw, bh);
      g.strokeRect(cx - bw / 2, cy - bh / 2 + size * 0.05, bw, bh);
      // Neck
      g.fillRect(cx - bw / 4, cy - bh / 2 - size * 0.12, bw / 2, size * 0.17);
      g.strokeRect(cx - bw / 4, cy - bh / 2 - size * 0.12, bw / 2, size * 0.17);
    } else if (subtype === ConsumableSubtype.PortalGem) {
      // Gem: diamond shape
      const gh = half * 0.7;
      g.beginPath();
      g.moveTo(cx, cy - gh);
      g.lineTo(cx + gh * 0.6, cy);
      g.lineTo(cx, cy + gh);
      g.lineTo(cx - gh * 0.6, cy);
      g.closePath();
      g.fillPath();
      g.strokePath();
    }
  } else if (category === ItemCategory.CraftingOrb) {
    // Crafting orb: circle with inner glow
    const orbColor = ORB_DEFINITIONS[subtype]?.color ?? color;
    g.fillStyle(orbColor, 0.9);
    g.fillCircle(cx, cy, half * 0.5);
    g.lineStyle(1, 0xffffff, 0.4);
    g.strokeCircle(cx, cy, half * 0.5);
    // Inner highlight
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(cx - half * 0.12, cy - half * 0.15, half * 0.15);
  }
}

/**
 * Get the slot border color based on item tier.
 * Uses tier colors for tiered items, gold for UT.
 */
export function getSlotBorderColor(tier: number): number {
  if (tier === 13) return 0xffdd00; // UT gold
  return 0x666666; // All tiered items use grey border
}
