import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // No assets to load — we use procedural graphics
  }

  create() {
    this.scene.start("MenuScene");
  }
}
