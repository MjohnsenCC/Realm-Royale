import Phaser from "phaser";
import { BagRarity } from "@rotmg-lite/shared";

const BAG_TEXTURE_KEYS: Record<number, string> = {
  [BagRarity.Green]: "bag-green",
  [BagRarity.Red]: "bag-red",
  [BagRarity.Black]: "bag-black",
  [BagRarity.Orange]: "bag-orange",
};

export class LootBagSprite {
  x: number = 0;
  y: number = 0;
  bagRarity: number = 0;
  private sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, bagRarity: number) {
    this.x = x;
    this.y = y;
    this.bagRarity = bagRarity;
    const key = BAG_TEXTURE_KEYS[bagRarity] ?? "bag-green";
    this.sprite = scene.add.image(x, y, key).setDepth(-0.4);
  }

  update(x: number, y: number): void {
    if (x !== this.x || y !== this.y) {
      this.x = x;
      this.y = y;
      this.sprite.setPosition(x, y);
    }
  }

  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
