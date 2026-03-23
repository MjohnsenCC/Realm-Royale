import Phaser from "phaser";
import {
  DUNGEON_MODIFIER_DEFS,
  DungeonModifierId,
  PortalType,
  getModifierTierValue,
} from "@rotmg-lite/shared";
import { getUIScale } from "./UIScale";
import { addText } from "./TextFactory";
import { UI_PANEL_CORNER } from "./UITextures";

const BASE_TOOLTIP_WIDTH = 240;
const BASE_TOOLTIP_PADDING = 8;
const BASE_BANNER_HEIGHT = 28;
const BASE_STAT_ICON_SIZE = 18;

export class DungeonTooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bgPanel: Phaser.GameObjects.NineSlice;
  private bgOverlay: Phaser.GameObjects.Graphics;

  // Banner
  private nameText: Phaser.GameObjects.Text;
  private difficultyBadge: Phaser.GameObjects.Text;

  // Locked stats (loot bonuses)
  private lockedStatPool: Phaser.GameObjects.Text[] = [];

  // Open stats (modifiers) — icon + text
  private openStatPool: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }[] = [];

  // Divider positions
  private dividerYs: number[] = [];

  private S: number;
  private tooltipWidth: number;
  private padding: number;
  private bannerHeight: number;
  private statIconSize: number;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    const S = this.S;

    this.tooltipWidth = Math.round(BASE_TOOLTIP_WIDTH * S);
    this.padding = Math.round(BASE_TOOLTIP_PADDING * S);
    this.bannerHeight = Math.round(BASE_BANNER_HEIGHT * S);
    this.statIconSize = Math.round(BASE_STAT_ICON_SIZE * S);

    const pad = this.padding;
    const nameFontSize = `${Math.round(8 * S)}px`;
    const badgeFontSize = `${Math.round(7 * S)}px`;
    const statFontSize = `${Math.round(6 * S)}px`;
    const wrapWidth = this.tooltipWidth - pad * 2;

    const fontFamily = "'Press Start 2P', monospace";
    const stroke = "#000000";
    const strokeThickness = 2;

    this.container = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(250)
      .setVisible(false);

    const C = UI_PANEL_CORNER;
    this.bgPanel = scene.add
      .nineslice(0, 0, "ui-panel-tooltip", undefined, 100, 100, C, C, C, C)
      .setOrigin(0, 0);
    this.container.add(this.bgPanel);

    this.bgOverlay = scene.add.graphics();
    this.container.add(this.bgOverlay);

    // Dungeon name — left-aligned in banner
    this.nameText = addText(scene, pad, this.bannerHeight / 2, "", {
        fontSize: nameFontSize,
        color: "#ffffff",
        fontFamily,
        fontStyle: "bold",
        stroke,
        strokeThickness,
      })
      .setOrigin(0, 0.5)
      .setWordWrapWidth(this.tooltipWidth - pad * 2 - Math.round(50 * S));
    this.container.add(this.nameText);

    // Difficulty badge — right-aligned in banner
    this.difficultyBadge = addText(scene, this.tooltipWidth - pad, this.bannerHeight / 2, "", {
        fontSize: badgeFontSize,
        color: "#aaaaaa",
        fontFamily,
        stroke,
        strokeThickness,
      })
      .setOrigin(1, 0.5);
    this.container.add(this.difficultyBadge);

    // Locked stat pool (2 entries: rarity + quantity)
    for (let i = 0; i < 2; i++) {
      const txt = addText(scene, pad, 0, "", {
          fontSize: statFontSize,
          color: "#ffffff",
          fontFamily,
          align: "left",
          stroke,
          strokeThickness,
        })
        .setOrigin(0, 0)
        .setWordWrapWidth(wrapWidth)
        .setVisible(false);
      this.container.add(txt);
      this.lockedStatPool.push(txt);
    }

    // Open stat pool (5 entries, each with icon + text)
    const iconX = pad + this.statIconSize / 2;
    const statTextX = pad + this.statIconSize + Math.round(3 * S);
    for (let i = 0; i < 5; i++) {
      const icon = scene.add
        .image(iconX, 0, "dungeon-stat-icon-t1")
        .setDisplaySize(this.statIconSize, this.statIconSize)
        .setVisible(false);
      this.container.add(icon);

      const txt = addText(scene, statTextX, 0, "", {
          fontSize: statFontSize,
          color: "#66bbff",
          fontFamily,
          align: "left",
          stroke,
          strokeThickness,
        })
        .setOrigin(0, 0)
        .setWordWrapWidth(wrapWidth - this.statIconSize - Math.round(3 * S))
        .setVisible(false);
      this.container.add(txt);

      this.openStatPool.push({ icon, text: txt });
    }
  }

  show(
    portalType: number,
    modifierIds: number[],
    modifierTiers: number[],
    lootRarityBoost: number,
    lootQuantityBoost: number,
  ): void {
    if (this.visible) return;

    this.clearAll();

    const S = this.S;
    const pad = this.padding;

    // --- Banner ---
    let dungeonName = "Dungeon";
    let nameColor = "#ffffff";
    let borderColor = 0x666688;
    let bannerColor = 0x666688;
    if (portalType === PortalType.InfernalPitEntrance) {
      dungeonName = "The Infernal Pit";
      nameColor = "#ff4400";
      borderColor = 0xff4400;
      bannerColor = 0xff4400;
    } else if (portalType === PortalType.VoidSanctumEntrance) {
      dungeonName = "The Void Sanctum";
      nameColor = "#8833ee";
      borderColor = 0x8833ee;
      bannerColor = 0x8833ee;
    } else if (portalType === PortalType.DeepJungleEntrance) {
      dungeonName = "The Deep Jungle";
      nameColor = "#22aa22";
      borderColor = 0x22aa22;
      bannerColor = 0x22aa22;
    }

    this.nameText.setText(dungeonName);
    this.nameText.setColor(nameColor);

    let diffLabel = "Unknown";
    let diffColor = "#ffffff";
    if (portalType === PortalType.InfernalPitEntrance) {
      diffLabel = "Hard";
      diffColor = "#ff8844";
    } else if (portalType === PortalType.VoidSanctumEntrance) {
      diffLabel = "Extreme";
      diffColor = "#ff4444";
    } else if (portalType === PortalType.DeepJungleEntrance) {
      diffLabel = "Easy";
      diffColor = "#44ff44";
    }
    this.difficultyBadge.setText(diffLabel);
    this.difficultyBadge.setColor(diffColor);

    // Dynamic banner height
    const bannerH = Math.max(this.bannerHeight, this.nameText.height + Math.round(8 * S));
    this.nameText.setY(bannerH / 2);
    this.difficultyBadge.setY(bannerH / 2);

    // --- Spacing (match ItemTooltip) ---
    const sectionGap = Math.round(8 * S);
    const lineGap = Math.round(3 * S);
    const itemGap = Math.round(6 * S);
    let currentY = bannerH + itemGap;

    // --- Locked stats (loot bonuses) ---
    currentY += sectionGap;
    this.dividerYs.push(currentY);
    currentY += sectionGap;

    const rarityTitle = "Loot Rarity: ";
    setStatTextWithTitle(this.lockedStatPool[0], rarityTitle, `${rarityTitle}+${Math.round(lootRarityBoost)}%`, "#44ff44");
    this.lockedStatPool[0].setY(currentY);
    this.lockedStatPool[0].setVisible(true);
    currentY += this.lockedStatPool[0].height + lineGap;

    const quantityTitle = "Loot Quantity: ";
    setStatTextWithTitle(this.lockedStatPool[1], quantityTitle, `${quantityTitle}+${Math.round(lootQuantityBoost)}%`, "#44ff44");
    this.lockedStatPool[1].setY(currentY);
    this.lockedStatPool[1].setVisible(true);
    currentY += this.lockedStatPool[1].height + lineGap;

    // --- Open stats (modifiers) ---
    if (modifierIds.length > 0) {
      currentY += sectionGap;
      this.dividerYs.push(currentY);
      currentY += sectionGap;

      const statTextX = pad + this.statIconSize + Math.round(3 * S);
      const statWrapW = this.tooltipWidth - pad * 2 - this.statIconSize - Math.round(3 * S);

      for (let i = 0; i < modifierIds.length && i < 5; i++) {
        const modId = modifierIds[i];
        const def = DUNGEON_MODIFIER_DEFS[modId];
        if (!def) continue;

        const tier = modifierTiers[i] ?? 1;
        const pct = getModifierTierValue(modId, tier);
        const valueStr = modId === DungeonModifierId.EnemyCountUp
          ? `(+${pct} enemies)`
          : `(${pct}%)`;

        const entry = this.openStatPool[i];
        const titleStr = def.name + ": ";
        const descStr = def.description + " " + valueStr;

        entry.text.setX(statTextX);
        entry.text.setWordWrapWidth(statWrapW);
        entry.text.setLineSpacing(Math.round(4 * S));
        setStatTextWithTitle(entry.text, titleStr, titleStr + descStr, "#66bbff");
        entry.text.setVisible(true);

        const tierKey = `dungeon-stat-icon-t${Math.min(Math.max(tier, 1), 5)}`;
        entry.icon.setTexture(tierKey);
        entry.icon.setDisplaySize(this.statIconSize, this.statIconSize);
        const rowH = Math.max(entry.text.height, this.statIconSize);
        entry.text.setY(currentY + (rowH - entry.text.height) / 2);
        entry.icon.setY(currentY + rowH / 2);
        entry.icon.setVisible(true);

        currentY += rowH + Math.round(7 * S);
      }
    }

    const totalHeight = currentY + pad;
    this.drawBgAndPosition(totalHeight, bannerH, borderColor, bannerColor);
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) return;
    this.container.setVisible(false);
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  relayout(): void {
    this.S = getUIScale();
    const S = this.S;
    this.tooltipWidth = Math.round(BASE_TOOLTIP_WIDTH * S);
    this.padding = Math.round(BASE_TOOLTIP_PADDING * S);
    this.bannerHeight = Math.round(BASE_BANNER_HEIGHT * S);
    this.statIconSize = Math.round(BASE_STAT_ICON_SIZE * S);

    const pad = this.padding;
    const nameFontSize = `${Math.round(8 * S)}px`;
    const badgeFontSize = `${Math.round(7 * S)}px`;
    const statFontSize = `${Math.round(6 * S)}px`;
    const wrapWidth = this.tooltipWidth - pad * 2;

    // Name
    this.nameText.setX(pad);
    this.nameText.setFontSize(nameFontSize);
    this.nameText.setWordWrapWidth(this.tooltipWidth - pad * 2 - Math.round(50 * S));

    // Difficulty badge
    this.difficultyBadge.setX(this.tooltipWidth - pad);
    this.difficultyBadge.setFontSize(badgeFontSize);

    // Locked stat pool
    for (const txt of this.lockedStatPool) {
      txt.setX(pad);
      txt.setFontSize(statFontSize);
      txt.setWordWrapWidth(wrapWidth);
    }

    // Open stat pool
    const iconX = pad + this.statIconSize / 2;
    const statTextX = pad + this.statIconSize + Math.round(3 * S);
    for (const entry of this.openStatPool) {
      entry.icon.setX(iconX);
      entry.icon.setDisplaySize(this.statIconSize, this.statIconSize);
      entry.text.setX(statTextX);
      entry.text.setFontSize(statFontSize);
      entry.text.setWordWrapWidth(wrapWidth - this.statIconSize - Math.round(3 * S));
    }

    this.hide();
  }

  private clearAll(): void {
    this.nameText.setText("");
    this.difficultyBadge.setText("");
    this.dividerYs = [];
    for (const txt of this.lockedStatPool) {
      txt.setText("").setVisible(false);
    }
    for (const entry of this.openStatPool) {
      entry.icon.setVisible(false);
      entry.text.setText("").setVisible(false);
    }
  }

  private drawBgAndPosition(totalHeight: number, bannerH: number, borderColor: number, bannerColor: number): void {
    const S = this.S;
    const pad = this.padding;

    // NineSlice background panel
    this.bgPanel.setSize(this.tooltipWidth, totalHeight);
    this.bgPanel.setPosition(0, 0);

    // Overlay: banner tint, separator, dividers
    this.bgOverlay.clear();

    // Colored banner at top
    this.bgOverlay.fillStyle(bannerColor, 0.35);
    this.bgOverlay.fillRect(0, 0, this.tooltipWidth, bannerH);

    // Separator line below banner
    this.bgOverlay.lineStyle(1, bannerColor, 0.5);
    this.bgOverlay.beginPath();
    this.bgOverlay.moveTo(0, bannerH);
    this.bgOverlay.lineTo(this.tooltipWidth, bannerH);
    this.bgOverlay.strokePath();

    // Divider lines
    this.bgOverlay.lineStyle(1, 0x555566, 0.6);
    for (const y of this.dividerYs) {
      this.bgOverlay.beginPath();
      this.bgOverlay.moveTo(pad, y);
      this.bgOverlay.lineTo(this.tooltipWidth - pad, y);
      this.bgOverlay.strokePath();
    }

    // Position: bottom-right corner of the screen
    const tx = this.scene.scale.width - this.tooltipWidth - Math.round(17 * S);
    const ty = this.scene.scale.height - totalHeight - Math.round(17 * S);
    this.container.setPosition(tx, ty);
    this.container.setVisible(true);
  }
}

/**
 * Sets text with a title prefix in white and the rest in descColor.
 * Uses a single Phaser Text object: first lets Phaser render the full text
 * normally, then repaints the title portion in white on the canvas and
 * re-uploads to WebGL.
 */
function setStatTextWithTitle(
  textObj: Phaser.GameObjects.Text,
  titleStr: string,
  fullText: string,
  descColor: string,
): void {
  textObj.setColor(descColor);
  textObj.setText(fullText);

  const canvas = textObj.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const style = textObj.style as any;
  const resolution = style.resolution ?? 1;
  const strokeThickness = style.strokeThickness ?? 0;
  const strokeColor = style.stroke ?? "#000000";
  const metrics = style.metrics;

  ctx.save();
  ctx.scale(resolution, resolution);
  style.syncFont(canvas, ctx);
  style.syncStyle(canvas, ctx);

  const padding = (textObj as any).padding ?? { left: 0, top: 0 };
  ctx.translate(padding.left, padding.top);

  const lineX = strokeThickness / 2;
  const lineY = (strokeThickness / 2) + metrics.ascent;

  if (strokeThickness > 0) {
    style.syncShadow(ctx, style.shadowStroke);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeThickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeText(titleStr, lineX, lineY);
  }

  style.syncShadow(ctx, style.shadowFill);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(titleStr, lineX, lineY);

  ctx.restore();

  const renderer = (textObj as any).renderer;
  if (renderer && renderer.gl) {
    const source = textObj.frame.source;
    source.glTexture = renderer.canvasToTexture(canvas, source.glTexture, true);
  }
}
