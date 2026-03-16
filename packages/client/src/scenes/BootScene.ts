import Phaser from "phaser";
import { generateItemTextures } from "../ui/ItemTextures";
import { generateEntityTextures } from "../ui/EntityTextures";

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

    // Boss sprites (24x24 pixel art)
    this.load.image("sprite-boss-infernal", "assets/sprites/enemies/infernal_pit_boss.png");
    this.load.image("sprite-boss-void", "assets/sprites/enemies/void_sanctum_boss.png");

    // Player projectile sprites (8x8 pixel art, facing RIGHT — rotated at runtime)
    this.load.image("proj-archer-attack", "assets/sprites/projectiles/archer_attack.png");
    this.load.image("proj-archer-ability", "assets/sprites/projectiles/archer_ability.png");
    this.load.image("proj-warrior-attack", "assets/sprites/projectiles/warrior_attack.png");
    this.load.image("proj-warrior-ability", "assets/sprites/projectiles/warror_ability.png");
    this.load.image("proj-arcanist-attack", "assets/sprites/projectiles/arcanist_attack.png");
    this.load.image("proj-arcanist-ability", "assets/sprites/projectiles/arcanist_ability.png");

    // Enemy projectile sprites (8x8 pixel art, facing RIGHT)
    for (let i = 0; i <= 5; i++) {
      this.load.image(`proj-enemy-${i}`, `assets/sprites/projectiles/enemy_projectile_${i}.png`);
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
      // Zone-specific floor tiles (nexus uses tileset spritesheet below)
      ["tile-nexus", "Nexus"], // kept as fallback
      ["tile-vault", "Vault"],
      ["tile-infernalpit", "InfernalPit"],
      ["tile-voidsanctum", "VoidSanctum"],
    ];
    for (const [key, file] of tiles) {
      this.load.image(key, `assets/sprites/tiles/${file}.png`);
    }

    // Tileset spritesheets (multi-tile, loaded from Tiled exports)
    this.load.image("tileset-nexus", "assets/sprites/tiles/NexusTileset.png");
    this.load.image("tileset-vault", "assets/sprites/tiles/VaultTileset.png");

    // Decoration sprites — trees (top/bottom split), ground objects
    for (let i = 0; i <= 3; i++) {
      this.load.image(`deco-tree-top-${i}`, `assets/sprites/decorations/Tree_top_${i}.png`);
      this.load.image(`deco-tree-bottom-${i}`, `assets/sprites/decorations/Tree_bottom_${i}.png`);
    }
    this.load.image("deco-stones-small", "assets/sprites/decorations/object_stones_0.png");
    this.load.image("deco-stone-large", "assets/sprites/decorations/scenery_stone.png");
    this.load.image("deco-shrub-large", "assets/sprites/decorations/scenery_shrub_large.png");
    this.load.image("deco-shrub-small", "assets/sprites/decorations/scenery_shrub_small.png");
    this.load.image("deco-flower-0", "assets/sprites/decorations/scenery_flower_0.png");
    for (let i = 0; i <= 4; i++) {
      this.load.image(`deco-grass-${i}`, `assets/sprites/decorations/scenery_grass_${i}.png`);
    }
    this.load.image("deco-blood-skull", "assets/sprites/decorations/scenery_blood_skull.png");
    this.load.image("deco-blood-small", "assets/sprites/decorations/scenery_blood_small.png");
    for (let i = 1; i <= 3; i++) {
      this.load.image(`deco-flowers-${i}`, `assets/sprites/decorations/scenery_flowers_${i}.png`);
    }

    // Interactive decoration sprites (12x12 pixel art)
    this.load.image("deco-chest", "assets/sprites/decorations/chest.png");
    this.load.image("deco-crafting-table", "assets/sprites/decorations/crafting_table.png");

    // Zone decoration sprites (placed via Tiled object layer)
    this.load.image("deco-torch_small", "assets/sprites/decorations/torch_small.png");
    this.load.image("deco-torch_tall", "assets/sprites/decorations/torch_tall.png");

    // Item sprites (12x12 pixel art) — one sprite per subtype, used for all tiers
    this.load.image("item-sword", "assets/sprites/items/sword.png");
    this.load.image("item-bow", "assets/sprites/items/bow.png");
    this.load.image("item-wand", "assets/sprites/items/wand.png");
    this.load.image("item-quiver", "assets/sprites/items/quiver.png");
    this.load.image("item-helm", "assets/sprites/items/helm.png");
    this.load.image("item-relic", "assets/sprites/items/relic.png");
    this.load.image("item-heavy-armor", "assets/sprites/items/heavy_armor.png");
    this.load.image("item-light-armor", "assets/sprites/items/light_armor.png");
    this.load.image("item-mantle", "assets/sprites/items/mantle.png");
    this.load.image("item-ring", "assets/sprites/items/ring.png");

    // Consumable & crafting orb sprites
    this.load.image("item-portal-gem", "assets/sprites/items/consumables/portal_gem.png");
    this.load.image("item-blank-orb", "assets/sprites/items/consumables/blank_orb.png");
    this.load.image("item-ember-orb", "assets/sprites/items/consumables/ember_orb.png");
    this.load.image("item-shard-orb", "assets/sprites/items/consumables/shard_orb.png");
    this.load.image("item-chaos-orb", "assets/sprites/items/consumables/chaos_orb.png");
    this.load.image("item-flux-orb", "assets/sprites/items/consumables/flux_orb.png");
    this.load.image("item-void-orb", "assets/sprites/items/consumables/void_orb.png");
    this.load.image("item-prism-orb", "assets/sprites/items/consumables/prism_orb.png");
    this.load.image("item-forge-orb", "assets/sprites/items/consumables/forge_orb.png");
    this.load.image("item-calibrate-orb", "assets/sprites/items/consumables/calibrate_orb.png");
    this.load.image("item-divine-orb", "assets/sprites/items/consumables/divine_forge_orb.png");

    // UI icons — per-tier stat icons for open stats
    for (let t = 1; t <= 6; t++) {
      this.load.image(`open-stat-icon-t${t}`, `assets/sprites/UI/stat_icons/open_stat_icon_t${t}.png`);
    }
    this.load.image("ut-stat-icon", "assets/sprites/UI/stat_icons/ut_stat_icon_0.png");

    // Portal sprites
    this.load.image("portal-the-wild", "assets/sprites/decorations/portals/the_wild_portal.png");
    this.load.image("portal-infernal-pit", "assets/sprites/decorations/portals/infernal_pit_portal.png");
    this.load.image("portal-void-sanctum", "assets/sprites/decorations/portals/void_sanctum_portal.png");
    this.load.image("portal-vault", "assets/sprites/decorations/portals/vault_portal.png");

    // Loot bag sprites
    this.load.image("bag-green", "assets/sprites/items/bags/green_bag.png");
    this.load.image("bag-red", "assets/sprites/items/bags/red_bag.png");
    this.load.image("bag-black", "assets/sprites/items/bags/black_bag.png");
    this.load.image("bag-orange", "assets/sprites/items/bags/orange_bag.png");
  }

  create() {
    generateItemTextures(this);
    generateEntityTextures(this);

    // Explicitly load the Google Font before showing the menu
    document.fonts.load('16px "Press Start 2P"').then(() => {
      const loadingScreen = document.getElementById("loading-screen");
      if (loadingScreen) {
        loadingScreen.classList.add("fade-out");
        loadingScreen.addEventListener("transitionend", () => loadingScreen.remove());
      }
      this.scene.start("MenuScene");
    });
  }
}
