import Phaser from "phaser";
import { generateItemTextures } from "../ui/ItemTextures";
import { generateEntityTextures } from "../ui/EntityTextures";
import { generateUITextures } from "../ui/UITextures";

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

    // Tile spritesheet (8x8 pixel art) — all biome ground tiles in a single sheet
    // Layout: 15 columns × 7 rows, 8px spacing between tiles
    // Rows 0-1: Tier 1 (The Wild) base + variant
    // Rows 2-3: Tier 2 (The Ruins) base + variant
    // Rows 4-5: Tier 3 (Devine Hell) base + variant
    // Row 6: River, River variant, Road, Road variant
    this.load.spritesheet("tile-spreadsheet", "assets/sprites/tiles/tile-spreadsheet.png", {
      frameWidth: 8,
      frameHeight: 8,
      spacing: 8,
    });

    // Zone-specific floor tiles
    this.load.image("tile-nexus", "assets/sprites/tiles/Nexus.png");
    this.load.image("tile-vault", "assets/sprites/tiles/Vault.png");
    this.load.image("tile-infernalpit", "assets/sprites/tiles/InfernalPit.png");
    this.load.image("tile-voidsanctum", "assets/sprites/tiles/VoidSanctum.png");

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

    // Death gravestone sprite
    this.load.image("deco-gravestone", "assets/sprites/decorations/scenery_gravestone.png");

    // Item sprites (12x12 pixel art) — generic fallbacks (not in spreadsheet)
    this.load.image("item-sword", "assets/sprites/items/sword.png");
    this.load.image("item-bow", "assets/sprites/items/bow.png");
    this.load.image("item-wand", "assets/sprites/items/wand.png");
    this.load.image("item-heavy-armor", "assets/sprites/items/heavy_armor.png");
    this.load.image("item-light-armor", "assets/sprites/items/light_armor.png");
    this.load.image("item-mantle", "assets/sprites/items/mantle.png");

    // Item spritesheet (8x8 pixel art) — all tiered items + consumables
    // Layout: 13 columns × 11 rows, 8px spacing between tiles
    // Row 0: Swords t1-t12, UT sword
    // Row 1: Bows t1-t12
    // Row 2: Wands t1-t12
    // Row 3: Heavy armor t1-t12
    // Row 4: Light armor t1-t12
    // Row 5: Robes t1-t12
    // Row 6: Rings t1-t12
    // Row 7: Quivers
    // Row 8: Helms
    // Row 9: Relics
    // Row 10: Consumables (portal gem, blank orb, ember, shard, chaos, flux, void, prism, forge, calibrate, divine)
    this.load.image("items-spreadsheet", "assets/sprites/items/items-spreadsheet.png");

    // UI icons — per-tier stat icons for open stats
    for (let t = 1; t <= 6; t++) {
      this.load.image(`open-stat-icon-t${t}`, `assets/sprites/UI/stat_icons/open_stat_icon_t${t}.png`);
    }
    this.load.image("ut-stat-icon", "assets/sprites/UI/stat_icons/ut_stat_icon_0.png");

    // Portal sprites
    this.load.image("portal-the-wild", "assets/sprites/decorations/portals/realm/the-wild_portal.png");
    this.load.image("portal-the-ruins", "assets/sprites/decorations/portals/realm/the-ruin_portal.png");
    this.load.image("portal-devine-hell", "assets/sprites/decorations/portals/realm/devine-hell_portal.png");
    this.load.image("portal-infernal-pit", "assets/sprites/decorations/portals/infernal_pit_portal.png");
    this.load.image("portal-void-sanctum", "assets/sprites/decorations/portals/void_sanctum_portal.png");
    this.load.image("portal-vault", "assets/sprites/decorations/portals/vault_portal.png");
    this.load.image("portal-gem", "assets/sprites/decorations/portals/portal-gem_portal.png");

    // Loot bag sprites
    this.load.image("bag-green", "assets/sprites/items/bags/green_bag.png");
    this.load.image("bag-red", "assets/sprites/items/bags/red_bag.png");
    this.load.image("bag-black", "assets/sprites/items/bags/black_bag.png");
    this.load.image("bag-orange", "assets/sprites/items/bags/orange_bag.png");

    // UI sprites — panels (11×11 9-slice)
    this.load.image("ui-panel-dark", "assets/sprites/UI/panels/ui-panel-dark.png");
    this.load.image("ui-panel-header", "assets/sprites/UI/panels/ui-panel-header.png");
    this.load.image("ui-panel-tooltip", "assets/sprites/UI/panels/ui-panel-tooltip.png");
    this.load.image("ui-panel-overlay", "assets/sprites/UI/panels/ui-panel-overlay.png");
    this.load.image("ui-panel-chat", "assets/sprites/UI/panels/ui-panel-chat.png");

    // UI sprites — item slots (8×8)
    this.load.image("ui-slot-empty", "assets/sprites/UI/slots/ui-slot-empty.png");
    this.load.image("ui-slot-filled", "assets/sprites/UI/slots/ui-slot-filled.png");
    this.load.image("ui-slot-highlight", "assets/sprites/UI/slots/ui-slot-highlight.png");

    // UI sprites — bars
    this.load.image("ui-bar-frame", "assets/sprites/UI/bars/ui-bar-frame.png");
    this.load.image("ui-bar-hp", "assets/sprites/UI/bars/ui-bar-hp.png");
    this.load.image("ui-bar-mp", "assets/sprites/UI/bars/ui-bar-mp.png");
    this.load.image("ui-bar-xp", "assets/sprites/UI/bars/ui-bar-xp.png");
    this.load.image("ui-bar-bg", "assets/sprites/UI/bars/ui-bar-bg.png");

    // UI sprites — buttons
    this.load.image("ui-btn-default", "assets/sprites/UI/buttons/ui-btn-default.png");
    this.load.image("ui-btn-hover", "assets/sprites/UI/buttons/ui-btn-hover.png");
    this.load.image("ui-btn-pressed", "assets/sprites/UI/buttons/ui-btn-pressed.png");
    this.load.image("ui-btn-close", "assets/sprites/UI/buttons/ui-btn-close.png");
    this.load.image("ui-btn-statpanel", "assets/sprites/UI/buttons/ui-btn-statpanel.png");
    this.load.image("ui-btn-social", "assets/sprites/UI/buttons/ui-btn-social.png");
    this.load.image("ui-btn-addfriend", "assets/sprites/UI/buttons/ui-btn-addfriend.png");
    this.load.image("ui-btn-dm", "assets/sprites/UI/buttons/ui-btn-dm.png");

    // UI sprites — minimap icons (3×3)
    this.load.image("ui-icon-player", "assets/sprites/UI/icons/ui-icon-player.png");
    this.load.image("ui-icon-enemy", "assets/sprites/UI/icons/ui-icon-enemy.png");
    this.load.image("ui-icon-portal", "assets/sprites/UI/icons/ui-icon-portal.png");
    this.load.image("ui-icon-chest", "assets/sprites/UI/icons/ui-icon-chest.png");
    this.load.image("ui-icon-bag", "assets/sprites/UI/icons/ui-icon-bag.png");

    // UI sprites — minimap button icons (12×12)
    this.load.image("ui-icon-zoom-in", "assets/sprites/UI/icons/ui-icon-zoom-in.png");
    this.load.image("ui-icon-zoom-out", "assets/sprites/UI/icons/ui-icon-zoom-out.png");
    this.load.image("ui-icon-fullscreen-enter", "assets/sprites/UI/icons/ui-icon-fullscreen-enter.png");
    this.load.image("ui-icon-fullscreen-exit", "assets/sprites/UI/icons/ui-icon-fullscreen-exit.png");

    // UI sprites — misc
    this.load.image("ui-minimap-frame", "assets/sprites/UI/misc/ui-minimap-frame.png");
    this.load.image("ui-scrollbar-track", "assets/sprites/UI/misc/ui-scrollbar-track.png");
    this.load.image("ui-scrollbar-thumb", "assets/sprites/UI/misc/ui-scrollbar-thumb.png");
    this.load.image("ui-tab-active", "assets/sprites/UI/misc/ui-tab-active.png");
    this.load.image("ui-tab-inactive", "assets/sprites/UI/misc/ui-tab-inactive.png");
  }

  create() {
    generateItemTextures(this);
    generateEntityTextures(this);
    generateUITextures(this);

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
