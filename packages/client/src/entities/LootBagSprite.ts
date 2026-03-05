import Phaser from "phaser";
import { BagRarity } from "@rotmg-lite/shared";

const BAG_COLORS: Record<number, number> = {
  [BagRarity.Green]: 0x44aa44,
  [BagRarity.Red]: 0xcc3333,
  [BagRarity.Black]: 0x222222,
  [BagRarity.Orange]: 0xff8800,
};

const BAG_OUTLINE_COLORS: Record<number, number> = {
  [BagRarity.Green]: 0x66cc66,
  [BagRarity.Red]: 0xff5555,
  [BagRarity.Black]: 0xffffff,
  [BagRarity.Orange]: 0xffaa44,
};

export class LootBagSprite {
  x: number = 0;
  y: number = 0;
  bagRarity: number = 0;
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, bagRarity: number) {
    this.x = x;
    this.y = y;
    this.bagRarity = bagRarity;
    this.graphics = scene.add.graphics().setDepth(7);
    this.draw();
  }

  private draw(): void {
    this.graphics.clear();
    const fillColor = BAG_COLORS[this.bagRarity] ?? 0x44aa44;
    const outlineColor = BAG_OUTLINE_COLORS[this.bagRarity] ?? 0x66cc66;

    // Draw a small diamond/pouch shape
    this.graphics.lineStyle(2, outlineColor, 1);
    this.graphics.fillStyle(fillColor, 0.9);
    const s = 10; // half-size
    this.graphics.beginPath();
    this.graphics.moveTo(this.x, this.y - s);
    this.graphics.lineTo(this.x + s, this.y);
    this.graphics.lineTo(this.x, this.y + s);
    this.graphics.lineTo(this.x - s, this.y);
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();

    // Small tie/knot at top for the "bag" look
    this.graphics.fillStyle(outlineColor, 1);
    this.graphics.fillCircle(this.x, this.y - s, 3);
  }

  update(x: number, y: number): void {
    if (x !== this.x || y !== this.y) {
      this.x = x;
      this.y = y;
      this.draw();
    }
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
