import Phaser from "phaser";
import {
  isEmptyItem,
  getItemCategory,
  getItemSubtype,
  CLASS_NAMES,
} from "@rotmg-lite/shared";
import type { NearbyPlayerInfo } from "./SocialPanel";
import { getUIScale, getScreenWidth, getScreenHeight } from "./UIScale";
import { UI_PANEL_CORNER } from "./UITextures";
import { getItemSpriteKey, getItemOutlinedSize } from "./ItemTextures";

export class PlayerTooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bgPanel: Phaser.GameObjects.NineSlice;
  private nameText: Phaser.GameObjects.Text;
  private levelText: Phaser.GameObjects.Text;
  private classText: Phaser.GameObjects.Text;
  private equipSlots: Phaser.GameObjects.Image[] = [];
  private equipBorders: Phaser.GameObjects.Rectangle[] = [];

  private S: number;
  private tooltipWidth: number;
  private tooltipPadding: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.S = getUIScale();
    const S = this.S;

    this.tooltipPadding = Math.round(8 * S);
    this.tooltipWidth = Math.round(140 * S);
    const pad = this.tooltipPadding;

    const C = UI_PANEL_CORNER;
    this.bgPanel = new Phaser.GameObjects.NineSlice(
      scene, 0, 0, "ui-panel-dark", undefined, this.tooltipWidth, 100, C, C, C, C,
    );
    this.bgPanel.setOrigin(0, 0);

    const nameFontSize = `${Math.round(8 * S)}px`;
    const infoFontSize = `${Math.round(6 * S)}px`;

    this.nameText = new Phaser.GameObjects.Text(scene, pad, pad, "", {
      fontSize: nameFontSize,
      color: "#ffffff",
      fontFamily: "'Press Start 2P', monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);

    this.levelText = new Phaser.GameObjects.Text(scene, pad, pad + Math.round(14 * S), "", {
      fontSize: infoFontSize,
      color: "#aaaaaa",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);

    this.classText = new Phaser.GameObjects.Text(scene, pad, pad + Math.round(24 * S), "", {
      fontSize: infoFontSize,
      color: "#88aacc",
      fontFamily: "'Press Start 2P', monospace",
      stroke: "#000000",
      strokeThickness: 2,
    }).setResolution(2);

    // Equipment slots (4)
    const slotSize = Math.round(18 * S);
    const slotGap = Math.round(4 * S);
    const slotsY = pad + Math.round(38 * S);

    for (let i = 0; i < 4; i++) {
      const slotX = pad + i * (slotSize + slotGap);

      const border = new Phaser.GameObjects.Rectangle(
        scene, slotX + slotSize / 2, slotsY + slotSize / 2, slotSize, slotSize,
      );
      border.setStrokeStyle(1, 0x444466);
      border.setFillStyle(0x111122, 0.6);

      const img = new Phaser.GameObjects.Image(scene, slotX + slotSize / 2, slotsY + slotSize / 2, "__DEFAULT");
      img.setDisplaySize(slotSize - 4, slotSize - 4);
      img.setVisible(false);

      this.equipBorders.push(border);
      this.equipSlots.push(img);
    }

    // Build container
    this.container = scene.add.container(0, 0);
    this.container.setDepth(300);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    this.container.add(this.bgPanel);
    this.container.add(this.nameText);
    this.container.add(this.levelText);
    this.container.add(this.classText);
    for (const border of this.equipBorders) this.container.add(border);
    for (const img of this.equipSlots) this.container.add(img);
  }

  show(info: NearbyPlayerInfo, screenX: number, screenY: number): void {
    const S = this.S;
    const pad = this.tooltipPadding;
    const slotSize = Math.round(18 * S);
    const slotsY = pad + Math.round(38 * S);
    const totalH = slotsY + slotSize + pad;

    this.nameText.setText(info.name);
    this.levelText.setText(`Lv.${info.level}`);
    this.classText.setText(CLASS_NAMES[info.characterClass] ?? "???");

    // Equipment
    for (let i = 0; i < 4; i++) {
      const img = this.equipSlots[i];
      if (i < info.equipment.length && !isEmptyItem(info.equipment[i])) {
        const item = info.equipment[i];
        const category = getItemCategory(item.baseItemId);
        const subtype = getItemSubtype(item.baseItemId);
        const key = getItemSpriteKey(category, subtype, item.instanceTier, item.isUT);
        if (key && this.scene.textures.exists(key)) {
          img.setTexture(key);
          img.setDisplaySize(slotSize - 4, slotSize - 4);
          img.setVisible(true);
        } else {
          img.setVisible(false);
        }
      } else {
        img.setVisible(false);
      }
    }

    // Size background
    this.bgPanel.setSize(this.tooltipWidth, totalH);

    // Position: above cursor, clamped to screen
    const screenW = getScreenWidth();
    const screenH = getScreenHeight();
    let tx = screenX - this.tooltipWidth / 2;
    let ty = screenY - totalH - Math.round(10 * S);

    if (tx < 4) tx = 4;
    if (tx + this.tooltipWidth > screenW - 4) tx = screenW - 4 - this.tooltipWidth;
    if (ty < 4) ty = screenY + Math.round(10 * S); // flip below cursor

    this.container.setPosition(tx, ty);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  relayout(): void {
    this.S = getUIScale();
    const S = this.S;

    this.tooltipPadding = Math.round(8 * S);
    this.tooltipWidth = Math.round(140 * S);
    const pad = this.tooltipPadding;

    const nameFontSize = `${Math.round(8 * S)}px`;
    const infoFontSize = `${Math.round(6 * S)}px`;

    this.nameText.setPosition(pad, pad).setFontSize(nameFontSize);
    this.levelText.setPosition(pad, pad + Math.round(14 * S)).setFontSize(infoFontSize);
    this.classText.setPosition(pad, pad + Math.round(24 * S)).setFontSize(infoFontSize);

    const slotSize = Math.round(18 * S);
    const slotGap = Math.round(4 * S);
    const slotsY = pad + Math.round(38 * S);

    for (let i = 0; i < 4; i++) {
      const slotX = pad + i * (slotSize + slotGap);
      this.equipBorders[i].setPosition(slotX + slotSize / 2, slotsY + slotSize / 2);
      this.equipBorders[i].setSize(slotSize, slotSize);
      this.equipSlots[i].setPosition(slotX + slotSize / 2, slotsY + slotSize / 2);
      if (this.equipSlots[i].texture.key !== "__DEFAULT") {
        this.equipSlots[i].setDisplaySize(slotSize - 4, slotSize - 4);
      }
    }

    this.container.setVisible(false);
  }
}
