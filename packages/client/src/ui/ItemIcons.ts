import Phaser from "phaser";
import { ItemCategory, WeaponSubtype, AbilitySubtype, ArmorSubtype, CraftingOrbType } from "@rotmg-lite/shared";
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
  } else if (category === ItemCategory.Weapon && subtype === WeaponSubtype.Wand) {
    // Wand: vertical staff with glowing orb on top
    const staffW = size * 0.1;
    const staffH = size * 0.65;
    g.fillRect(cx - staffW / 2, cy - staffH * 0.2, staffW, staffH);
    g.strokeRect(cx - staffW / 2, cy - staffH * 0.2, staffW, staffH);
    // Orb on top
    g.fillStyle(0xaa44ff, 0.8);
    g.fillCircle(cx, cy - staffH * 0.25, size * 0.15);
    g.fillStyle(color, 0.9);
  } else if (category === ItemCategory.Ability && subtype === AbilitySubtype.Quiver) {
    // Quiver: vertical rectangle with arrow tips poking out the top
    const qw = size * 0.3;
    const qh = size * 0.65;
    const qx = cx - qw / 2;
    const qy = cy - qh / 2 + size * 0.05;
    g.fillRect(qx, qy, qw, qh);
    g.strokeRect(qx, qy, qw, qh);
    // Arrow tips
    const tipH = size * 0.18;
    const tipW = size * 0.08;
    for (let ai = -1; ai <= 1; ai++) {
      const tipCx = cx + ai * (qw * 0.28);
      g.beginPath();
      g.moveTo(tipCx, qy - tipH);
      g.lineTo(tipCx - tipW / 2, qy);
      g.lineTo(tipCx + tipW / 2, qy);
      g.closePath();
      g.fillPath();
    }
  } else if (category === ItemCategory.Ability && subtype === AbilitySubtype.Helm) {
    // Helm: dome with visor slit
    const r = half * 0.6;
    g.beginPath();
    g.arc(cx, cy, r, Math.PI, 0, false);
    g.lineTo(cx + r, cy + r * 0.35);
    g.lineTo(cx - r, cy + r * 0.35);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // Visor slit
    g.lineStyle(1.5, 0x000000, 0.6);
    g.beginPath();
    g.moveTo(cx - r * 0.55, cy + r * 0.05);
    g.lineTo(cx + r * 0.55, cy + r * 0.05);
    g.strokePath();
    g.lineStyle(1, 0xffffff, 0.3);
  } else if (category === ItemCategory.Ability && subtype === AbilitySubtype.Relic) {
    // Relic: gemstone with radiating circle
    const r = half * 0.5;
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.7, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r * 0.7, cy);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // Radiating circle hint
    g.lineStyle(1, color, 0.3);
    g.strokeCircle(cx, cy, r * 1.2);
    g.lineStyle(1, 0xffffff, 0.3);
  } else if (category === ItemCategory.Ability) {
    // Fallback ability: diamond shape
    g.beginPath();
    g.moveTo(cx, cy - half * 0.7);
    g.lineTo(cx + half * 0.5, cy);
    g.lineTo(cx, cy + half * 0.7);
    g.lineTo(cx - half * 0.5, cy);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else if (category === ItemCategory.Armor && subtype === ArmorSubtype.Heavy) {
    // Heavy Armor: broad chestplate / pentagon shape
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
  } else if (category === ItemCategory.Armor && subtype === ArmorSubtype.Light) {
    // Light Armor: vest/tunic with V-neck
    const r = half * 0.6;
    g.beginPath();
    g.moveTo(cx - r, cy - r * 0.55);
    g.lineTo(cx - r * 0.15, cy - r * 0.55);
    g.lineTo(cx, cy - r * 0.1);
    g.lineTo(cx + r * 0.15, cy - r * 0.55);
    g.lineTo(cx + r, cy - r * 0.55);
    g.lineTo(cx + r * 0.75, cy + r * 0.7);
    g.lineTo(cx - r * 0.75, cy + r * 0.7);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else if (category === ItemCategory.Armor && subtype === ArmorSubtype.Mantle) {
    // Mantle: draped cloak with high collar
    const r = half * 0.65;
    g.beginPath();
    // High collar points
    g.moveTo(cx - r * 0.2, cy - r * 0.8);
    g.lineTo(cx - r * 0.35, cy - r * 0.3);
    // Left drape
    g.lineTo(cx - r, cy + r * 0.1);
    g.lineTo(cx - r * 0.7, cy + r * 0.8);
    // Bottom curve
    g.lineTo(cx, cy + r * 0.5);
    g.lineTo(cx + r * 0.7, cy + r * 0.8);
    // Right drape
    g.lineTo(cx + r, cy + r * 0.1);
    g.lineTo(cx + r * 0.35, cy - r * 0.3);
    g.lineTo(cx + r * 0.2, cy - r * 0.8);
    g.closePath();
    g.fillPath();
    g.strokePath();
  } else if (category === ItemCategory.Armor) {
    // Fallback armor: pentagon shape
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
    // Portal Gem: diamond shape
    const gh = half * 0.7;
    g.beginPath();
    g.moveTo(cx, cy - gh);
    g.lineTo(cx + gh * 0.6, cy);
    g.lineTo(cx, cy + gh);
    g.lineTo(cx - gh * 0.6, cy);
    g.closePath();
    g.fillPath();
    g.strokePath();
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
