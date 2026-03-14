import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // Player class sprites (8x8 pixel art)
    this.load.image("sprite-player-archer", "assets/sprites/players/archer.png");
    this.load.image("sprite-player-warrior", "assets/sprites/players/warrior.png");
    this.load.image("sprite-player-arcanist", "assets/sprites/players/arcanist.png");

    // Enemy sprites (8x8 pixel art) — enemy types cycle through these
    for (let i = 1; i <= 6; i++) {
      this.load.image(`sprite-enemy-${i}`, `assets/sprites/enemies/enemy_${i}.png`);
    }

    // Tile sprites (8x8 pixel art) — biome ground tiles with variants
    const tiles: [string, string][] = [
      ["tile-ocean", "ocean"],
      ["tile-shallowwater", "ShallowWater"],
      ["tile-beach", "Beach"],
      ["tile-beach-1", "Beach_1"],
      ["tile-marsh", "Marsh"],
      ["tile-marsh-1", "Marsh_1"],
      ["tile-desert", "Desert"],
      ["tile-desert-1", "Desert_1"],
      ["tile-dryplains", "DryPlains"],
      ["tile-dryplains-1", "DryPlains_1"],
      ["tile-grassland", "Grassland"],
      ["tile-grassland-1", "Grassland_1"],
      ["tile-forest", "Forest"],
      ["tile-forest-1", "Forest_1"],
      ["tile-jungle", "Jungle"],
      ["tile-jungle-1", "Jungle_1"],
      ["tile-tundra", "Tundra"],
      ["tile-tundra-1", "Tundra_1"],
      ["tile-highland", "Highland"],
      ["tile-highland-1", "Highland_1"],
      ["tile-savanna", "Savanna"],
      ["tile-savanna-1", "Savanna_1"],
      ["tile-mountainbase", "MountainBase"],
      ["tile-mountainbase-1", "MountainBase_1"],
      ["tile-mountainpeak", "MountainPeak"],
      ["tile-mountainpeak-1", "MountainPeak_1"],
      ["tile-volcanicridge", "VolcanicRidge"],
      ["tile-volcanicridge-1", "VolcanicRidge_1"],
      ["tile-lake", "Lake"],
      // Zone-specific floor tiles
      ["tile-nexus", "Nexus"],
      ["tile-vault", "Vault"],
      ["tile-infernalpit", "InfernalPit"],
      ["tile-voidsanctum", "VoidSanctum"],
    ];
    for (const [key, file] of tiles) {
      this.load.image(key, `assets/sprites/tiles/${file}.png`);
    }
  }

  create() {
    this.scene.start("MenuScene");
  }
}
