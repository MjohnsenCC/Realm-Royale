import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";
import { PlayerSprite } from "../entities/PlayerSprite";
import { EnemySprite } from "../entities/EnemySprite";
import { SnapshotBuffer } from "../entities/SnapshotBuffer";
import { ProjectileSprite } from "../entities/ProjectileSprite";
import { LootBagSprite } from "../entities/LootBagSprite";
import { HUD } from "../ui/HUD";
import { CraftingUI } from "../ui/CraftingUI";
import { StatsPanel } from "../ui/StatsPanel";
import { DungeonTooltip } from "../ui/DungeonTooltip";
import { getUIScale } from "../ui/UIScale";
import {
  HOSTILE_WIDTH,
  HOSTILE_HEIGHT,
  HOSTILE_TILES,
  HOSTILE_TILE_SIZE,
  REALM_PORTAL_1_X,
  REALM_PORTAL_1_Y,
  REALM_PORTAL_2_X,
  REALM_PORTAL_2_Y,
  PORTAL_RADIUS,
  CRAFTING_TABLE_X,
  CRAFTING_TABLE_Y,
  CRAFTING_TABLE_RADIUS,
  CRAFTING_TABLE_INTERACT_RADIUS,
  TILE_SIZE,
  PLAYER_RADIUS,
  ROAD_SPEED_MULTIPLIER,
  RIVER_SPEED_MULTIPLIER,
  TICK_INTERVAL,
  ServerMessage,
  ClientMessage,
  PlayerInput,
  PortalType,
  ProjectileType,
  EntityType,
  ItemCategory,
  WeaponSubtype,
  applyMovement,
  getZoneDimensions,
  isDungeonZone,
  computePlayerStats,
  getItemSubtype,
  getScaledAbilityStats,
  DUNGEON_VISUALS,
  REALM_BIOME_VISUALS,
  isHostileZone,
  getZoneInstance,
  getDungeonTypeFromZone,
  DUNGEON_PORTAL_RADIUS,
  DUNGEON_PORTAL_INTERACT_RADIUS,
  generateDungeonMap,
  generateNexusMap,
  resolveWallCollision,
  resolveHostileCollision,
  resolveDecorationCollision,
  loadRealmMapFromJSON,
  setRealmMap,
  getRealmMap,
  isRoadAt,
  isRiverAt,
  DungeonTile,
  ITEM_DEFS,
  circlesOverlap,
  ENEMY_DEFS,
  HITBOX_PADDING,
  isEmptyItem,
  createEmptyItemInstance,
} from "@rotmg-lite/shared";
import type { DungeonMapData, ItemInstanceData } from "@rotmg-lite/shared";

// Colyseus schema decoded types (client-side generic)
interface SchemaInstance {
  listen(
    prop: string,
    callback: (value: unknown, prev: unknown) => void,
    immediate?: boolean
  ): () => void;
  onChange(callback: () => void): () => void;
  [key: string]: unknown;
}

interface MapSchemaInstance {
  onAdd(
    callback: (item: SchemaInstance, key: string) => void,
    triggerAll?: boolean
  ): () => void;
  onRemove(
    callback: (item: SchemaInstance, key: string) => void
  ): () => void;
  forEach(callback: (item: SchemaInstance, key: string) => void): void;
  get(key: string): SchemaInstance | undefined;
  size: number;
}

interface DecodedState {
  players: MapSchemaInstance;
  enemies: MapSchemaInstance;
  projectiles: MapSchemaInstance;
  lootBags: MapSchemaInstance;
  dungeonPortals: MapSchemaInstance;
}

export class GameScene extends Phaser.Scene {
  private network!: NetworkManager;
  private playerSprites = new Map<string, PlayerSprite>();
  private lastHitSeqMap = new Map<string, number>();
  private enemySprites = new Map<string, EnemySprite>();
  private enemySnapshotCache = new Map<string, SnapshotBuffer>();
  private projectileSprites = new Map<string, ProjectileSprite>();
  private bagSprites = new Map<string, LootBagSprite>();

  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    Q: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    G: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    SHIFT: Phaser.Input.Keyboard.Key;
    U: Phaser.Input.Keyboard.Key;
    P: Phaser.Input.Keyboard.Key;
  };

  private hud!: HUD;
  private groundGraphics!: Phaser.GameObjects.Graphics;
  private portalGraphics!: Phaser.GameObjects.Graphics;
  private nexusLabels: Phaser.GameObjects.Text[] = [];
  private decodedState!: DecodedState;

  // Zone tracking
  private localZone: string = "nexus";
  // Cached dungeon stats for in-dungeon shift tooltip
  private cachedDungeonStats: {
    portalType: number;
    modifierIds: number[];
    modifierTiers: number[];
    lootRarityBoost: number;
    lootQuantityBoost: number;
  } | null = null;

  // Dungeon portal sprites
  private dungeonPortalSprites = new Map<
    string,
    { graphics: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; x: number; y: number; portalType: number }
  >();

  // "Press E" proximity prompt
  private pressEText!: Phaser.GameObjects.Text;

  // Dungeon tooltip (shows stats when near a portal)
  private dungeonTooltip!: DungeonTooltip;
  private craftingUI!: CraftingUI;
  private statsPanel!: StatsPanel;
  private nearCraftingTable: boolean = false;

  // Q key cooldown to prevent spam
  private returnToNexusCooldown: number = 0;

  // E key (portal interact) cooldown
  private portalInteractCooldown: number = 0;

  // F key (health pot) cooldown
  private healthPotCooldown: number = 0;

  // G key (mana pot) cooldown
  private manaPotCooldown: number = 0;

  // Dungeon map data (for rendering and client-side prediction)
  private dungeonSeed: number = 0;
  private currentDungeonMap: DungeonMapData | null = null;
  private nexusMap: DungeonMapData = generateNexusMap();

  // Hostile zone chunk-based tilemap system
  private static readonly CHUNK_SIZE = 64; // tiles per chunk axis
  private static readonly CHUNK_LOAD_RADIUS = 2; // load (2R+1)^2 = 25 chunks max
  private static readonly CHUNKS_PER_AXIS = Math.ceil(HOSTILE_TILES / 64); // 32

  private hostileChunks: Map<
    string,
    {
      cx: number;
      cy: number;
      biomeTilemap: Phaser.Tilemaps.Tilemap;
      biomeLayer: Phaser.Tilemaps.TilemapLayer;
      decoBaseTilemap: Phaser.Tilemaps.Tilemap;
      decoBaseLayer: Phaser.Tilemaps.TilemapLayer | null;
      decoCanopyTilemap: Phaser.Tilemaps.Tilemap;
      decoCanopyLayer: Phaser.Tilemaps.TilemapLayer | null;
    }
  > = new Map();

  private hostileChunkDecoIndex: Map<
    string,
    {
      base: Array<{ tileX: number; tileY: number; type: number }>;
      canopy: Array<{ tileX: number; tileY: number; type: number }>;
    }
  > | null = null;

  private lastChunkCX: number = -1;
  private lastChunkCY: number = -1;

  // Client-side prediction & reconciliation
  private inputSequence: number = 0;
  private pendingInputs: Array<{
    seq: number;
    movementX: number;
    movementY: number;
    dt: number;
  }> = [];

  // Input throttling: send at server tick rate (~20Hz)
  private inputSendTimer: number = 0;
  private accumulatedDt: number = 0; // frame deltas accumulated since last send
  private lastSentMX: number = 0;
  private lastSentMY: number = 0;
  private lastSentAimAngle: number = 0;
  private lastSentShooting: boolean = false;
  private lastSentUseAbility: boolean = false;

  // Client-side predicted projectiles (visual only — server remains authoritative)
  private predictedProjectiles: Array<{
    sprite: ProjectileSprite;
    angle: number;
    projType: number;
    startX: number;
    startY: number;
    maxRange: number;
    createdAt: number;
    confirmed: boolean;
    serverProjectileId?: string;
    collisionRadius: number;
    damage: number;
    piercing: boolean;
    hitEnemies: Set<string>;
  }> = [];
  private lastLocalShootTime: number = 0;
  private lastLocalAbilityTime: number = 0;

  // Track XP/level changes for visual effects
  private lastKnownXp: number = 0;
  private lastKnownLevel: number = 1;
  private isDead: boolean = false;

  // Loading screen state
  private isLoadingZone: boolean = false;
  private loadingStartTime: number = 0;
  private loadingOverlay: Phaser.GameObjects.Graphics | null = null;
  private loadingText: Phaser.GameObjects.Text | null = null;
  private loadingSubText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    this.network = NetworkManager.getInstance();
    const room = this.network.getRoom();
    if (!room) {
      this.scene.start("MenuScene");
      return;
    }

    this.localZone = "nexus";
    this.currentDungeonMap = this.nexusMap; // enable wall collision in nexus

    // Draw ground for current zone
    this.groundGraphics = this.add.graphics().setDepth(-1);
    this.portalGraphics = this.add.graphics();
    this.drawGround();
    this.drawPortal();

    // No camera bounds — camera always centers on player
    this.cameras.main.removeBounds();
    this.cameras.main.setBackgroundColor("#0a0a0a");

    // Setup keyboard input (including Q for return to nexus)
    if (this.input.keyboard) {
      this.keys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        Q: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        F: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
        G: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G),
        SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        SHIFT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
        U: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U),
        P: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      };
    }

    // Disable browser context menu so right-click works for inventory drop
    this.input.mouse?.disableContextMenu();

    // Create HUD
    this.hud = new HUD(this);

    // Portal gem: right-click minimap → teleport
    this.hud.setPortalGemCallback((worldX: number, worldY: number) => {
      this.network.sendUsePortalGem(worldX, worldY);
    });

    // Create crafting UI
    this.craftingUI = new CraftingUI(this);
    this.craftingUI.setRoom(room);
    this.hud.dragManager.setCraftingUI(this.craftingUI);

    // Create stats panel
    this.statsPanel = new StatsPanel(this);
    this.hud.setStatsButtonCallback(() => this.toggleStatsPanel());

    // Create dungeon tooltip (shows portal stats above minimap)
    this.dungeonTooltip = new DungeonTooltip(this);

    // Listen to state changes
    const state = room.state as unknown as DecodedState;
    this.decodedState = state;
    this.setupStateListeners(state);

    // Listen for zone change
    room.onMessage(ServerMessage.ZoneChanged, (data: { zone: string; dungeonSeed?: number }) => {
      this.localZone = data.zone;
      this.pendingInputs = [];
      this.isDead = false;
      this.hud.hideDeathScreen();

      // Generate dungeon map from seed if entering a dungeon, or use nexus map
      if (isDungeonZone(data.zone) && data.dungeonSeed !== undefined) {
        this.dungeonSeed = data.dungeonSeed;
        this.currentDungeonMap = generateDungeonMap(data.dungeonSeed, getDungeonTypeFromZone(data.zone)!);
      } else if (data.zone === "nexus") {
        this.currentDungeonMap = this.nexusMap;
      } else {
        this.currentDungeonMap = null;
      }

      // Show loading screen with zone name (and difficulty for dungeons)
      const displayInfo = this.getZoneDisplayInfo(data.zone);
      this.showLoadingScreen(displayInfo.name, displayInfo.color, displayInfo.difficulty, displayInfo.difficultyColor);

      // Hide local player sprite during loading
      const localSprite = this.playerSprites.get(this.network.getSessionId());
      if (localSprite) {
        localSprite.setVisible(false);
      }

      // Load realm map data for hostile zone (if not already loaded)
      const MIN_LOADING_MS = 2000;

      // Finish transition: swap zone visuals, show player, fade out loading screen
      const finishTransition = () => {
        this.transitionToZone(data.zone);

        const sprite = this.playerSprites.get(this.network.getSessionId());
        if (sprite) {
          sprite.setVisible(true);
        }
        this.hideLoadingScreen();
        this.network.sendZoneReady();
      };

      // Ensure loading screen is visible for at least MIN_LOADING_MS, then run
      // heavy work (if any) and finish. Uses double-rAF so the loading screen
      // paints at full opacity before any synchronous work begins.
      const scheduleTransition = (work?: () => void) => {
        // Wait for the loading screen to be fully painted
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Run heavy prep work (JSON parsing, grid building) while loading screen is visible
            if (work) work();

            // Ensure minimum display time
            const elapsed = Date.now() - this.loadingStartTime;
            const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
            this.time.delayedCall(remaining, finishTransition);
          });
        });
      };

      if (isHostileZone(data.zone) && !getRealmMap()) {
        // Fetch realm map JSON from server assets
        fetch("/assets/realm-map.json")
          .then((resp) => resp.text())
          .then((json) => {
            scheduleTransition(() => {
              const mapData = loadRealmMapFromJSON(json);
              setRealmMap(mapData);
              console.log(
                `[GameScene] Loaded realm map: ${mapData.width}x${mapData.height}, seed=${mapData.seed}`
              );
            });
          })
          .catch((err) => {
            console.error("[GameScene] Failed to load realm map:", err);
            scheduleTransition(); // proceed anyway with fallback rendering
          });
      } else {
        scheduleTransition();
      }
    });

    // "Press E" floating prompt (hidden until near a portal)
    this.pressEText = this.add
      .text(0, 0, "Press E", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(150)
      .setVisible(false);

    // Listen for dungeon portal state changes
    this.setupDungeonPortalListeners(state);

    // Set room on inventory/loot bag UIs so they can send messages
    this.hud.inventoryUI.setRoom(room);
    this.hud.lootBagUI.setRoom(room);
    this.hud.dragManager.setRoom(room);

    // Listen for bag open/close (server proximity detection)
    room.onMessage(
      ServerMessage.BagOpened,
      (data: { bagId: string }) => {
        const bagSchema = (state.lootBags as unknown as { get(key: string): SchemaInstance | undefined }).get(data.bagId);
        if (!bagSchema) return;

        const items = readBagItems(bagSchema);
        this.hud.lootBagUI.show(
          data.bagId,
          bagSchema.bagRarity as number,
          items
        );
      }
    );

    room.onMessage(ServerMessage.BagClosed, () => {
      this.hud.lootBagUI.hide();
    });

    // Listen for death notification — show death screen, hide player, wait for respawn
    room.onMessage(ServerMessage.PlayerDied, () => {
      this.isDead = true;

      // Hide local player sprite
      const localSprite = this.playerSprites.get(this.network.getSessionId());
      if (localSprite) {
        localSprite.setVisible(false);
      }

      // Show death overlay with respawn button
      this.hud.showDeathScreen(() => {
        this.network.sendRespawn();
      });
    });

    // Listen for switch destruction and boss awakening (Void Sanctum)
    room.onMessage(ServerMessage.SwitchDestroyed, (data: { remaining: number }) => {
      if (data.remaining > 0) {
        this.showDungeonNotification(`Void Switch destroyed! ${data.remaining} remaining...`);
      } else {
        this.showDungeonNotification("All switches destroyed! The Architect stirs...");
      }
    });

    room.onMessage(ServerMessage.BossAwakened, () => {
      this.showDungeonNotification("The boss has awakened!");
    });

    // Handle room leave/error
    room.onLeave(() => {
      this.cleanup();
    });
  }

  private showDungeonNotification(message: string): void {
    const cam = this.cameras.main;
    const text = this.add
      .text(cam.width / 2, cam.height * 0.25, message, {
        fontSize: "18px",
        color: "#00ccff",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    // Fade out and destroy after 3 seconds
    this.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 30,
      duration: 3000,
      ease: "Power2",
      onComplete: () => text.destroy(),
    });
  }

  private transitionToZone(zone: string): void {
    // Clear and redraw ground
    this.groundGraphics.clear();
    this.portalGraphics.clear();
    this.clearNexusLabels();
    this.clearDungeonPortalSprites();
    this.destroyHostileTilemap();
    this.drawGround();

    if (zone === "nexus") {
      this.drawPortal();
      this.cameras.main.setBackgroundColor("#0a0a0a");
    } else if (isDungeonZone(zone)) {
      // Dark background so wall areas appear as dark void
      this.cameras.main.setBackgroundColor("#080808");
    } else {
      // Hostile zone: ocean-colored background, tilemap handles land
      this.cameras.main.setBackgroundColor("#0a1a3e");
      this.createHostileTilemap();
    }

    this.rebuildDungeonPortals();
  }

  private getZoneDisplayInfo(zone: string): { name: string; color: string; difficulty?: string; difficultyColor?: string } {
    if (isDungeonZone(zone)) {
      const dungeonType = getDungeonTypeFromZone(zone);
      const visuals = dungeonType !== undefined ? DUNGEON_VISUALS[dungeonType] : undefined;
      if (visuals) {
        const color = dungeonType === 0 ? "#ff4400" : "#8833ee";
        const difficulty = dungeonType === 0 ? "Hard" : "Extreme";
        const difficultyColor = dungeonType === 0 ? "#ff8844" : "#ff4444";
        return { name: visuals.name, color, difficulty, difficultyColor };
      }
      return { name: "Dungeon", color: "#ffffff" };
    }
    if (isHostileZone(zone)) {
      const inst = getZoneInstance(zone) || "1";
      return { name: `Realm ${inst}`, color: "#e94560" };
    }
    return { name: "Nexus", color: "#44aa66" };
  }

  private loadingDifficultyText: Phaser.GameObjects.Text | null = null;

  private showLoadingScreen(zoneName: string, zoneColor: string, difficulty?: string, difficultyColor?: string): void {
    this.hideLoadingScreen();
    this.isLoadingZone = true;

    const { width, height } = this.scale;
    const S = getUIScale();

    this.loadingOverlay = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(200);
    this.loadingOverlay.fillStyle(0x000000, 1);
    this.loadingOverlay.fillRect(0, 0, width, height);

    this.loadingText = this.add
      .text(width / 2, height / 2 - Math.round(20 * S), zoneName, {
        fontSize: `${Math.round(36 * S)}px`,
        color: zoneColor,
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    // Show difficulty for dungeons
    if (difficulty) {
      this.loadingDifficultyText = this.add
        .text(width / 2, height / 2 + Math.round(20 * S), `Difficulty: ${difficulty}`, {
          fontSize: `${Math.round(14 * S)}px`,
          color: difficultyColor ?? "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(201);
    }

    this.loadingSubText = this.add
      .text(width / 2, height / 2 + Math.round(50 * S), "Entering...", {
        fontSize: `${Math.round(16 * S)}px`,
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    // Start fully opaque so loading screen is visible immediately
    this.loadingStartTime = Date.now();
  }

  private hideLoadingScreen(): void {
    this.isLoadingZone = false;

    const overlay = this.loadingOverlay;
    const text = this.loadingText;
    const subText = this.loadingSubText;
    const diffText = this.loadingDifficultyText;
    this.loadingOverlay = null;
    this.loadingText = null;
    this.loadingSubText = null;
    this.loadingDifficultyText = null;

    const targets = [overlay, text, subText, diffText].filter(Boolean);
    if (targets.length > 0) {
      this.tweens.add({
        targets,
        alpha: 0,
        duration: 400,
        ease: "Power2",
        onComplete: () => {
          overlay?.destroy();
          text?.destroy();
          subText?.destroy();
          diffText?.destroy();
        },
      });
    }
  }

  private clearNexusLabels(): void {
    for (const label of this.nexusLabels) {
      label.destroy();
    }
    this.nexusLabels = [];
    for (const label of this.realmPortalLabels) {
      label.destroy();
    }
    this.realmPortalLabels = [];
  }

  private drawGround(): void {
    this.groundGraphics.clear();

    if (this.localZone === "nexus") {
      this.drawNexusGround();
    } else if (isDungeonZone(this.localZone)) {
      this.drawDungeonGround();
    }
    // Hostile ground is drawn per-frame in update() (viewport-based)
  }

  private drawNexusGround(): void {
    const mapData = this.nexusMap;
    const { tiles, width, height } = mapData;
    const groundFill = 0x1a2a1a;
    const lineColor = 0x2a4a2a;
    const edgeColor = 0x44aa66;

    // Draw floor tiles
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty * width + tx] === DungeonTile.Floor) {
          const px = tx * TILE_SIZE;
          const py = ty * TILE_SIZE;
          this.groundGraphics.fillStyle(groundFill, 1);
          this.groundGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.groundGraphics.lineStyle(1, lineColor, 0.4);
          this.groundGraphics.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Draw highlighted edges where floor meets wall
    this.groundGraphics.lineStyle(2, edgeColor, 0.6);
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty * width + tx] !== DungeonTile.Floor) continue;
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;
        if (tx === 0 || tiles[ty * width + (tx - 1)] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px, py, px, py + TILE_SIZE);
        }
        if (tx === width - 1 || tiles[ty * width + (tx + 1)] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
        }
        if (ty === 0 || tiles[(ty - 1) * width + tx] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px, py, px + TILE_SIZE, py);
        }
        if (ty === height - 1 || tiles[(ty + 1) * width + tx] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
        }
      }
    }

    // Draw crafting table in east room
    const ctx = CRAFTING_TABLE_X;
    const cty = CRAFTING_TABLE_Y;
    const ctr = CRAFTING_TABLE_RADIUS;

    // Table surface
    this.groundGraphics.fillStyle(0x553311, 0.9);
    this.groundGraphics.fillRoundedRect(ctx - ctr, cty - ctr * 0.6, ctr * 2, ctr * 1.2, 6);
    this.groundGraphics.lineStyle(2, 0x886633, 0.8);
    this.groundGraphics.strokeRoundedRect(ctx - ctr, cty - ctr * 0.6, ctr * 2, ctr * 1.2, 6);

    // Anvil/rune symbol
    this.groundGraphics.fillStyle(0xaa8844, 0.7);
    this.groundGraphics.fillCircle(ctx, cty, 12);
    this.groundGraphics.lineStyle(2, 0xddaa55, 0.6);
    this.groundGraphics.strokeCircle(ctx, cty, 12);
    this.groundGraphics.strokeCircle(ctx, cty, 18);

    // Nexus label at spawn center
    this.clearNexusLabels();
    const label = this.add
      .text(mapData.spawnRoom.centerX, mapData.spawnRoom.centerY + 60, "~ The Nexus ~", {
        fontSize: "18px",
        color: "#44aa66",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setAlpha(0.5);
    this.nexusLabels.push(label);

    // Crafting table label
    const craftLabel = this.add
      .text(ctx, cty + ctr * 0.6 + 14, "Crafting Table", {
        fontSize: "12px",
        color: "#ddaa55",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
    this.nexusLabels.push(craftLabel);
  }

  private drawHostileGround(): void {
    this.updateHostileChunks();
  }

  /**
   * Prepare chunk-based hostile tilemap rendering.
   * Generates tileset textures and pre-indexes decorations by chunk.
   * Actual tilemap creation happens per-frame in updateHostileChunks().
   */
  private createHostileTilemap(): void {
    this.destroyHostileTilemap();

    const mapData = getRealmMap();
    if (!mapData) {
      // Fallback: draw simple colored ground if no map data
      this.groundGraphics.fillStyle(0x1a1a2e, 1);
      this.groundGraphics.fillRect(0, 0, HOSTILE_WIDTH, HOSTILE_HEIGHT);
      return;
    }

    const ts = HOSTILE_TILE_SIZE; // 40px per tile (matches TILE_SIZE)
    const numTiles = 18; // 16 biomes + river + road
    const RIVER_TILE = 16;

    // Generate tileset texture: 18 colored squares in a horizontal strip
    const tilesetKey = "realm-biome-tileset-v2";
    if (!this.textures.exists(tilesetKey)) {
      const canvas = document.createElement("canvas");
      canvas.width = ts * numTiles;
      canvas.height = ts;
      const ctx = canvas.getContext("2d")!;
      for (let i = 0; i < numTiles; i++) {
        if (i < 16) {
          const visual = REALM_BIOME_VISUALS[i];
          if (visual) {
            const hex = visual.groundFill.toString(16).padStart(6, "0");
            ctx.fillStyle = `#${hex}`;
          } else {
            ctx.fillStyle = "#ff00ff"; // debug magenta
          }
        } else if (i === RIVER_TILE) {
          ctx.fillStyle = "#2a6a9a";
        } else {
          ctx.fillStyle = "#8a7a5a";
        }
        ctx.fillRect(i * ts, 0, ts, ts);

        // Grid line border (matches nexus/dungeon tile style)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(i * ts + 0.5, 0.5, ts - 1, ts - 1);
      }
      this.textures.addCanvas(tilesetKey, canvas);
    }

    // --- Decoration tileset texture ---
    const TALL_TYPES = new Set([0, 1, 2, 3]); // TreePalm, TreeOak, TreePine, TreeDead
    const decoTileCount = 24; // 0-11 base, 12-23 canopy
    const decoTilesetKey = "realm-decoration-tileset";
    if (!this.textures.exists(decoTilesetKey)) {
      const decoCanvas = document.createElement("canvas");
      decoCanvas.width = ts * decoTileCount;
      decoCanvas.height = ts;
      const dctx = decoCanvas.getContext("2d")!;
      dctx.clearRect(0, 0, decoCanvas.width, decoCanvas.height);
      for (let i = 0; i < 12; i++) {
        this.drawDecorationTile(dctx, i, ts, false);
      }
      for (let i = 0; i < 12; i++) {
        this.drawDecorationTile(dctx, i + 12, ts, true);
      }
      this.textures.addCanvas(decoTilesetKey, decoCanvas);
    }

    // --- Pre-index decorations by chunk ---
    const CS = GameScene.CHUNK_SIZE;
    this.hostileChunkDecoIndex = new Map();

    for (const deco of mapData.decorations) {
      const baseCX = Math.floor(deco.tileX / CS);
      const baseCY = Math.floor(deco.tileY / CS);
      const baseKey = `${baseCX},${baseCY}`;

      let bucket = this.hostileChunkDecoIndex.get(baseKey);
      if (!bucket) {
        bucket = { base: [], canopy: [] };
        this.hostileChunkDecoIndex.set(baseKey, bucket);
      }
      bucket.base.push(deco);

      // Canopy for tall trees goes into the chunk containing (tileX, tileY - 1)
      if (TALL_TYPES.has(deco.type) && deco.tileY > 0) {
        const canopyTY = deco.tileY - 1;
        const canopyCX = Math.floor(deco.tileX / CS);
        const canopyCY = Math.floor(canopyTY / CS);
        const canopyKey = `${canopyCX},${canopyCY}`;

        let canopyBucket = this.hostileChunkDecoIndex.get(canopyKey);
        if (!canopyBucket) {
          canopyBucket = { base: [], canopy: [] };
          this.hostileChunkDecoIndex.set(canopyKey, canopyBucket);
        }
        canopyBucket.canopy.push({
          tileX: deco.tileX,
          tileY: canopyTY,
          type: deco.type + 12,
        });
      }
    }

    // Reset chunk tracking — actual chunks load on the first update frame
    this.lastChunkCX = -1;
    this.lastChunkCY = -1;
  }

  /** Load/unload hostile tilemap chunks based on player position. */
  private updateHostileChunks(): void {
    const mapData = getRealmMap();
    if (!mapData) return;

    const sessionId = this.network.getSessionId();
    const localSprite = this.playerSprites.get(sessionId);
    if (!localSprite) return;

    const CS = GameScene.CHUNK_SIZE;
    const ts = HOSTILE_TILE_SIZE;
    const R = GameScene.CHUNK_LOAD_RADIUS;
    const CHUNKS = GameScene.CHUNKS_PER_AXIS;

    // Player's current chunk
    const cx = Math.floor(localSprite.displayX / (CS * ts));
    const cy = Math.floor(localSprite.displayY / (CS * ts));

    // Early exit if player hasn't changed chunks
    if (cx === this.lastChunkCX && cy === this.lastChunkCY) return;
    this.lastChunkCX = cx;
    this.lastChunkCY = cy;

    // Compute set of needed chunk keys
    const needed = new Set<string>();
    for (let dx = -R; dx <= R; dx++) {
      for (let dy = -R; dy <= R; dy++) {
        const ncx = cx + dx;
        const ncy = cy + dy;
        if (ncx >= 0 && ncx < CHUNKS && ncy >= 0 && ncy < CHUNKS) {
          needed.add(`${ncx},${ncy}`);
        }
      }
    }

    // Unload chunks no longer needed
    for (const [key, chunk] of this.hostileChunks) {
      if (!needed.has(key)) {
        this.destroyChunk(chunk);
        this.hostileChunks.delete(key);
      }
    }

    // Load new chunks
    for (const key of needed) {
      if (!this.hostileChunks.has(key)) {
        const sep = key.indexOf(",");
        const chunkCX = parseInt(key.substring(0, sep), 10);
        const chunkCY = parseInt(key.substring(sep + 1), 10);
        const chunk = this.createChunk(chunkCX, chunkCY, mapData);
        if (chunk) {
          this.hostileChunks.set(key, chunk);
        }
      }
    }
  }

  /** Create the three small tilemaps for a single chunk. */
  private createChunk(
    cx: number,
    cy: number,
    mapData: NonNullable<ReturnType<typeof getRealmMap>>
  ): {
    cx: number;
    cy: number;
    biomeTilemap: Phaser.Tilemaps.Tilemap;
    biomeLayer: Phaser.Tilemaps.TilemapLayer;
    decoBaseTilemap: Phaser.Tilemaps.Tilemap;
    decoBaseLayer: Phaser.Tilemaps.TilemapLayer | null;
    decoCanopyTilemap: Phaser.Tilemaps.Tilemap;
    decoCanopyLayer: Phaser.Tilemaps.TilemapLayer | null;
  } | null {
    const CS = GameScene.CHUNK_SIZE;
    const ts = HOSTILE_TILE_SIZE;
    const RIVER_TILE = 16;
    const ROAD_TILE = 17;

    const startX = cx * CS;
    const startY = cy * CS;
    const chunkW = Math.min(CS, mapData.width - startX);
    const chunkH = Math.min(CS, mapData.height - startY);
    if (chunkW <= 0 || chunkH <= 0) return null;

    const worldX = startX * ts;
    const worldY = startY * ts;

    // --- Biome tile data ---
    const tileData: number[][] = [];
    for (let y = 0; y < chunkH; y++) {
      const row: number[] = [];
      const mapY = startY + y;
      for (let x = 0; x < chunkW; x++) {
        const idx = mapY * mapData.width + (startX + x);
        let tile = mapData.biomes[idx];
        if (mapData.rivers[idx] > 0 && tile !== 0 && tile !== 1 && tile !== 15) {
          tile = RIVER_TILE;
        }
        if (mapData.roads[idx] > 0) {
          tile = ROAD_TILE;
        }
        row.push(tile);
      }
      tileData.push(row);
    }

    const biomeMap = this.make.tilemap({
      data: tileData,
      tileWidth: ts,
      tileHeight: ts,
    });
    const biomeTileset = biomeMap.addTilesetImage(
      "biomes",
      "realm-biome-tileset-v2",
      ts,
      ts,
      0,
      0
    );
    if (!biomeTileset) {
      biomeMap.destroy();
      return null;
    }
    const biomeLayer = biomeMap.createLayer(0, biomeTileset, worldX, worldY);
    if (!biomeLayer) {
      biomeMap.destroy();
      return null;
    }
    biomeLayer.setDepth(-1);

    // --- Decoration data from pre-indexed buckets ---
    const key = `${cx},${cy}`;
    const decoEntries = this.hostileChunkDecoIndex?.get(key);

    // Base decoration layer
    const baseData: number[][] = [];
    for (let y = 0; y < chunkH; y++) {
      baseData.push(new Array(chunkW).fill(-1));
    }
    if (decoEntries) {
      for (const d of decoEntries.base) {
        const lx = d.tileX - startX;
        const ly = d.tileY - startY;
        if (lx >= 0 && lx < chunkW && ly >= 0 && ly < chunkH) {
          baseData[ly][lx] = d.type;
        }
      }
    }

    const decoBaseMap = this.make.tilemap({
      data: baseData,
      tileWidth: ts,
      tileHeight: ts,
    });
    const decoBaseTileset = decoBaseMap.addTilesetImage(
      "decorations-base",
      "realm-decoration-tileset",
      ts,
      ts,
      0,
      0
    );
    let decoBaseLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    if (decoBaseTileset) {
      decoBaseLayer = decoBaseMap.createLayer(
        0,
        decoBaseTileset,
        worldX,
        worldY
      );
      if (decoBaseLayer) decoBaseLayer.setDepth(-0.5);
    }

    // Canopy decoration layer
    const canopyData: number[][] = [];
    for (let y = 0; y < chunkH; y++) {
      canopyData.push(new Array(chunkW).fill(-1));
    }
    if (decoEntries) {
      for (const d of decoEntries.canopy) {
        const lx = d.tileX - startX;
        const ly = d.tileY - startY;
        if (lx >= 0 && lx < chunkW && ly >= 0 && ly < chunkH) {
          canopyData[ly][lx] = d.type;
        }
      }
    }

    const decoCanopyMap = this.make.tilemap({
      data: canopyData,
      tileWidth: ts,
      tileHeight: ts,
    });
    const decoCanopyTileset = decoCanopyMap.addTilesetImage(
      "decorations-canopy",
      "realm-decoration-tileset",
      ts,
      ts,
      0,
      0
    );
    let decoCanopyLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    if (decoCanopyTileset) {
      decoCanopyLayer = decoCanopyMap.createLayer(
        0,
        decoCanopyTileset,
        worldX,
        worldY
      );
      if (decoCanopyLayer) decoCanopyLayer.setDepth(10);
    }

    return {
      cx,
      cy,
      biomeTilemap: biomeMap,
      biomeLayer,
      decoBaseTilemap: decoBaseMap,
      decoBaseLayer,
      decoCanopyTilemap: decoCanopyMap,
      decoCanopyLayer,
    };
  }

  /** Destroy all Phaser objects in a single chunk. */
  private destroyChunk(chunk: {
    biomeTilemap: Phaser.Tilemaps.Tilemap;
    biomeLayer: Phaser.Tilemaps.TilemapLayer;
    decoBaseTilemap: Phaser.Tilemaps.Tilemap;
    decoBaseLayer: Phaser.Tilemaps.TilemapLayer | null;
    decoCanopyTilemap: Phaser.Tilemaps.Tilemap;
    decoCanopyLayer: Phaser.Tilemaps.TilemapLayer | null;
  }): void {
    if (chunk.decoCanopyLayer) chunk.decoCanopyLayer.destroy();
    chunk.decoCanopyTilemap.destroy();
    if (chunk.decoBaseLayer) chunk.decoBaseLayer.destroy();
    chunk.decoBaseTilemap.destroy();
    chunk.biomeLayer.destroy();
    chunk.biomeTilemap.destroy();
  }

  private drawDecorationTile(
    ctx: CanvasRenderingContext2D,
    type: number,
    ts: number,
    isCanopy: boolean
  ): void {
    const ox = type * ts;
    // For canopy tiles (12-23), map back to base type (0-11)
    const baseType = isCanopy ? type - 12 : type;
    switch (baseType) {
      case 0: { // TreePalm
        if (isCanopy) {
          // Crown only — rendered in the tile above the trunk
          ctx.fillStyle = "#228B22";
          ctx.beginPath();
          ctx.arc(ox + 20, 24, 10, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Trunk only — bottom of the tree
          ctx.fillStyle = "#8B6914";
          ctx.fillRect(ox + 17, 4, 6, 36);
        }
        break;
      }
      case 1: { // TreeOak
        if (isCanopy) {
          ctx.fillStyle = "#2E8B2E";
          ctx.beginPath();
          ctx.arc(ox + 20, 24, 12, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#6B4226";
          ctx.fillRect(ox + 17, 4, 6, 36);
        }
        break;
      }
      case 2: { // TreePine
        if (isCanopy) {
          ctx.fillStyle = "#1A5C1A";
          ctx.beginPath();
          ctx.moveTo(ox + 20, 6);
          ctx.lineTo(ox + 8, 38);
          ctx.lineTo(ox + 32, 38);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = "#5C4033";
          ctx.fillRect(ox + 18, 4, 4, 36);
        }
        break;
      }
      case 3: { // TreeDead
        if (isCanopy) {
          // Bare branches in the canopy tile
          ctx.strokeStyle = "#4A3728";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox + 20, 38);
          ctx.lineTo(ox + 12, 20);
          ctx.moveTo(ox + 20, 34);
          ctx.lineTo(ox + 28, 18);
          ctx.moveTo(ox + 12, 20);
          ctx.lineTo(ox + 8, 12);
          ctx.moveTo(ox + 28, 18);
          ctx.lineTo(ox + 32, 10);
          ctx.stroke();
        } else {
          // Trunk
          ctx.fillStyle = "#4A3728";
          ctx.fillRect(ox + 18, 0, 4, 40);
        }
        break;
      }
      case 4: { // RockSmall — ground level, no canopy
        if (!isCanopy) {
          ctx.fillStyle = "#7A7A7A";
          ctx.beginPath();
          ctx.arc(ox + 20, 24, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 5: { // RockLarge — ground level, no canopy
        if (!isCanopy) {
          ctx.fillStyle = "#6A6A6A";
          ctx.beginPath();
          ctx.moveTo(ox + 14, 28);
          ctx.lineTo(ox + 10, 18);
          ctx.lineTo(ox + 16, 10);
          ctx.lineTo(ox + 26, 10);
          ctx.lineTo(ox + 30, 20);
          ctx.lineTo(ox + 26, 28);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#8A8A8A";
          ctx.beginPath();
          ctx.moveTo(ox + 16, 12);
          ctx.lineTo(ox + 24, 12);
          ctx.lineTo(ox + 20, 16);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 6: { // Bush — ground level, no canopy
        if (!isCanopy) {
          ctx.fillStyle = "#3A7A2A";
          ctx.beginPath();
          ctx.arc(ox + 20, 24, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 7: { // Cactus — ground level, no canopy
        if (!isCanopy) {
          ctx.fillStyle = "#2D7A2D";
          ctx.fillRect(ox + 17, 10, 6, 26);
          ctx.fillRect(ox + 11, 16, 6, 4);
          ctx.fillRect(ox + 11, 12, 4, 8);
          ctx.fillRect(ox + 23, 20, 6, 4);
          ctx.fillRect(ox + 25, 16, 4, 8);
        }
        break;
      }
      case 8: { // Flower — ground level, no canopy
        if (!isCanopy) {
          ctx.fillStyle = "#4A8A3A";
          ctx.fillRect(ox + 19, 22, 2, 10);
          ctx.fillStyle = "#E06080";
          for (const [cx, cy] of [[20, 18], [16, 22], [24, 22], [20, 26]]) {
            ctx.beginPath();
            ctx.arc(ox + cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#FFDD44";
          ctx.beginPath();
          ctx.arc(ox + 20, 22, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 9: { // Mushroom — ground level, no canopy
        if (!isCanopy) {
          ctx.fillStyle = "#D4C4A0";
          ctx.fillRect(ox + 18, 24, 4, 10);
          ctx.fillStyle = "#CC4444";
          ctx.beginPath();
          ctx.arc(ox + 20, 24, 8, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(ox + 17, 21, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ox + 23, 21, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 10: { // Bones — ground level, no canopy
        if (!isCanopy) {
          ctx.strokeStyle = "#D4D0C0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox + 12, 14);
          ctx.lineTo(ox + 28, 28);
          ctx.moveTo(ox + 28, 14);
          ctx.lineTo(ox + 12, 28);
          ctx.stroke();
          ctx.fillStyle = "#D4D0C0";
          for (const [cx, cy] of [[12, 14], [28, 28], [28, 14], [12, 28]]) {
            ctx.beginPath();
            ctx.arc(ox + cx, cy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 11: { // Ruins — ground level, no canopy
        if (!isCanopy) {
          ctx.fillStyle = "#6A6A5A";
          ctx.fillRect(ox + 8, 20, 10, 16);
          ctx.fillStyle = "#5A5A4A";
          ctx.fillRect(ox + 22, 14, 10, 22);
          ctx.fillStyle = "#7A7A6A";
          ctx.beginPath();
          ctx.arc(ox + 18, 30, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
  }

  private destroyHostileTilemap(): void {
    for (const chunk of this.hostileChunks.values()) {
      this.destroyChunk(chunk);
    }
    this.hostileChunks.clear();
    this.hostileChunkDecoIndex = null;
    this.lastChunkCX = -1;
    this.lastChunkCY = -1;
  }

  private realmPortalLabels: Phaser.GameObjects.Text[] = [];

  private drawPortal(): void {
    this.portalGraphics.clear();
    // Clean up old labels
    for (const lbl of this.realmPortalLabels) lbl.destroy();
    this.realmPortalLabels = [];

    if (this.localZone !== "nexus") return;

    const portals = [
      { x: REALM_PORTAL_1_X, y: REALM_PORTAL_1_Y, label: "Realm 1" },
      { x: REALM_PORTAL_2_X, y: REALM_PORTAL_2_Y, label: "Realm 2" },
    ];

    for (const p of portals) {
      // Outer glow
      this.portalGraphics.lineStyle(4, 0x8844ff, 0.3);
      this.portalGraphics.strokeCircle(p.x, p.y, PORTAL_RADIUS + 12);

      // Mid glow
      this.portalGraphics.lineStyle(3, 0x9955ff, 0.5);
      this.portalGraphics.strokeCircle(p.x, p.y, PORTAL_RADIUS + 4);

      // Main ring
      this.portalGraphics.lineStyle(3, 0xaa66ff, 0.8);
      this.portalGraphics.strokeCircle(p.x, p.y, PORTAL_RADIUS);

      // Inner fill
      this.portalGraphics.fillStyle(0x6622cc, 0.4);
      this.portalGraphics.fillCircle(p.x, p.y, PORTAL_RADIUS - 4);

      // Bright core
      this.portalGraphics.fillStyle(0xaa66ff, 0.25);
      this.portalGraphics.fillCircle(p.x, p.y, PORTAL_RADIUS / 2);

      // Label
      const lbl = this.add.text(p.x, p.y - PORTAL_RADIUS - 14, p.label, {
        fontSize: "12px",
        color: "#aa66ff",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(6);
      this.realmPortalLabels.push(lbl);
    }
  }

  private setupStateListeners(state: DecodedState): void {
    // Players
    state.players.onAdd((player, sessionId) => {
      const isLocal = sessionId === this.network.getSessionId();
      const sprite = new PlayerSprite(
        this,
        player.x as number,
        player.y as number,
        player.name as string,
        isLocal
      );
      sprite.setZone((player.zone as string) ?? "nexus");
      this.playerSprites.set(sessionId, sprite);

      // Listen for zone changes on this player
      player.listen("zone", (newZone: unknown) => {
        const s = this.playerSprites.get(sessionId);
        if (s) {
          s.setZone(newZone as string);
        }
      });

      // Listen for property changes
      player.onChange(() => {
        const s = this.playerSprites.get(sessionId);
        if (!s) return;

        s.updateFromServer(
          player.x as number,
          player.y as number,
          player.aimAngle as number,
          player.hp as number,
          player.maxHp as number
        );

        // Update zone from schema
        s.setZone((player.zone as string) ?? "nexus");

        // Damage indicator for local player
        if (isLocal) {
          const currentHitSeq = (player.lastHitSeq as number) ?? 0;
          const prevHitSeq = this.lastHitSeqMap.get(sessionId) ?? 0;
          if (currentHitSeq > prevHitSeq) {
            const amount = (player.lastHitAmount as number) ?? 0;
            const dmgType = (player.lastHitDamageType as number) ?? 0;
            s.showDamage(amount, dmgType === 1);
          }
          this.lastHitSeqMap.set(sessionId, currentHitSeq);
        }

        // Server reconciliation for local player
        if (isLocal) {
          const lastProcessed = (player.lastProcessedInput as number) ?? 0;

          let reconX = player.x as number;
          let reconY = player.y as number;

          this.pendingInputs = this.pendingInputs.filter(
            (input) => input.seq > lastProcessed
          );

          const reconDims = getZoneDimensions(this.localZone);
          const reconW = reconDims.width;
          const reconH = reconDims.height;

          const reconSpeed = (player.cachedSpeed as number) ?? 200;
          for (const input of this.pendingInputs) {
            // Terrain speed modifiers in hostile zone
            let inputReconSpeed = reconSpeed;
            if (isHostileZone(this.localZone)) {
              if (isRoadAt(reconX, reconY)) {
                inputReconSpeed *= ROAD_SPEED_MULTIPLIER;
              } else if (isRiverAt(reconX, reconY)) {
                inputReconSpeed *= RIVER_SPEED_MULTIPLIER;
              }
            }

            const result = applyMovement(
              reconX,
              reconY,
              input.movementX,
              input.movementY,
              inputReconSpeed,
              input.dt,
              PLAYER_RADIUS,
              reconW,
              reconH
            );
            reconX = result.x;
            reconY = result.y;
            // Wall collision in dungeons / nexus
            if (this.currentDungeonMap) {
              const wallResult = resolveWallCollision(reconX, reconY, PLAYER_RADIUS, this.currentDungeonMap);
              reconX = wallResult.x;
              reconY = wallResult.y;
            }
            // Water collision in hostile zone
            if (isHostileZone(this.localZone) && getRealmMap()) {
              const waterResult = resolveHostileCollision(reconX, reconY, PLAYER_RADIUS);
              reconX = waterResult.x;
              reconY = waterResult.y;
            }
            // Decoration collision in hostile zone
            if (isHostileZone(this.localZone) && getRealmMap()) {
              const decoResult = resolveDecorationCollision(reconX, reconY, PLAYER_RADIUS);
              reconX = decoResult.x;
              reconY = decoResult.y;
            }
          }

          // Detect large corrections (zone change, desync) and snap immediately
          const errX = reconX - s.x;
          const errY = reconY - s.y;
          if (errX * errX + errY * errY > 2500) {
            // >50px error: teleport instantly
            s.teleportTo(reconX, reconY);
          } else {
            // Small correction: absorb into visual offset, decays smoothly
            s.applyCorrectedPosition(reconX, reconY);
          }
        }
      });
    });

    state.players.onRemove((_player, sessionId) => {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) {
        sprite.destroy();
        this.playerSprites.delete(sessionId);
      }
    });

    // Enemies
    state.enemies.onAdd((enemy, id) => {
      // Restore cached SnapshotBuffer if enemy re-enters sync radius
      const cachedBuffer = this.enemySnapshotCache.get(id);
      if (cachedBuffer) this.enemySnapshotCache.delete(id);

      const sprite = new EnemySprite(
        this,
        enemy.x as number,
        enemy.y as number,
        enemy.enemyType as number,
        enemy.hp as number,
        enemy.maxHp as number,
        cachedBuffer
      );
      this.enemySprites.set(id, sprite);

      enemy.onChange(() => {
        const s = this.enemySprites.get(id);
        if (s) {
          s.updateFromServer(
            enemy.x as number,
            enemy.y as number,
            enemy.hp as number,
            enemy.maxHp as number
          );
        }
      });
    });

    state.enemies.onRemove((_enemy, id) => {
      const sprite = this.enemySprites.get(id);
      if (sprite) {
        // Cache buffer so re-entering enemies resume interpolation seamlessly
        this.enemySnapshotCache.set(id, sprite.getSnapshotBuffer());
        sprite.destroy();
        this.enemySprites.delete(id);
      }
      // Evict oldest cache entries if too many accumulate (from killed enemies)
      if (this.enemySnapshotCache.size > 200) {
        const excess = this.enemySnapshotCache.size - 200;
        let deleted = 0;
        for (const key of this.enemySnapshotCache.keys()) {
          if (deleted >= excess) break;
          this.enemySnapshotCache.delete(key);
          deleted++;
        }
      }
    });

    // Projectiles
    state.projectiles.onAdd((proj, id) => {
      // --- Local player projectile matching ---
      // Match by FIFO order + projType (not angle) using synced ownerId.
      // Angle-based matching breaks when the player rotates quickly because
      // the server uses the aimAngle from the last input in the batch, which
      // can differ significantly from the angle used for the client prediction.
      if (
        (proj.ownerType as number) === EntityType.Player &&
        (proj.ownerId as string) === this.network.getSessionId()
      ) {
        const pt = (proj.projType as number) ?? 0;
        let matchIdx = -1;
        for (let i = 0; i < this.predictedProjectiles.length; i++) {
          const p = this.predictedProjectiles[i];
          if (p.serverProjectileId) continue; // already matched
          if (p.projType !== pt) continue;
          matchIdx = i;
          break;
        }

        if (matchIdx >= 0) {
          // Confirm the predicted sprite so it stays alive (no 500ms timeout).
          this.predictedProjectiles[matchIdx].confirmed = true;
          this.predictedProjectiles[matchIdx].serverProjectileId = id;
          return;
        }

        // No prediction yet — clock drift caused server to fire first.
        // Create a retroactive prediction linked to this server projectile.
        const projSprite = new ProjectileSprite(
          this,
          proj.x as number,
          proj.y as number,
          EntityType.Player,
          proj.angle as number,
          proj.speed as number,
          pt
        );
        this.predictedProjectiles.push({
          sprite: projSprite,
          angle: proj.angle as number,
          projType: pt,
          startX: proj.x as number,
          startY: proj.y as number,
          maxRange: 9999, // server removal handles cleanup via serverProjectileId
          createdAt: performance.now(),
          confirmed: true,
          serverProjectileId: id,
          collisionRadius: 0, // server handles hit detection
          damage: 0,
          piercing: false,
          hitEnemies: new Set(),
        });
        // Re-sync local timer to prevent continued drift
        if (pt === ProjectileType.QuiverShot) {
          this.lastLocalAbilityTime = performance.now();
        } else {
          this.lastLocalShootTime = performance.now();
        }
        return;
      }

      // --- Enemy or other-player projectile — render from server state ---
      const sprite = new ProjectileSprite(
        this,
        proj.x as number,
        proj.y as number,
        proj.ownerType as number,
        proj.angle as number,
        proj.speed as number,
        (proj.projType as number) ?? 0
      );

      this.projectileSprites.set(id, sprite);

      proj.onChange(() => {
        const s = this.projectileSprites.get(id);
        if (s) {
          s.updateFromServer(proj.x as number, proj.y as number);
        }
      });
    });

    state.projectiles.onRemove((_proj, id) => {
      const sprite = this.projectileSprites.get(id);
      if (sprite) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }

      // Also remove any confirmed predicted projectile linked to this server projectile
      const ppIdx = this.predictedProjectiles.findIndex(
        (pp) => pp.serverProjectileId === id
      );
      if (ppIdx >= 0) {
        this.predictedProjectiles[ppIdx].sprite.destroy();
        this.predictedProjectiles.splice(ppIdx, 1);
      }
    });

    // Loot Bags
    state.lootBags.onAdd((bag, id) => {
      const sprite = new LootBagSprite(
        this,
        bag.x as number,
        bag.y as number,
        bag.bagRarity as number
      );
      this.bagSprites.set(id, sprite);

      bag.onChange(() => {
        const s = this.bagSprites.get(id);
        if (s) {
          s.update(bag.x as number, bag.y as number);
        }
      });
    });

    state.lootBags.onRemove((_bag, id) => {
      const sprite = this.bagSprites.get(id);
      if (sprite) {
        sprite.destroy();
        this.bagSprites.delete(id);
      }
    });
  }

  update(_time: number, delta: number): void {
    const room = this.network.getRoom();
    if (!room) return;

    const state = room.state as unknown as DecodedState;
    const sessionId = this.network.getSessionId();
    const localSprite = this.playerSprites.get(sessionId);

    // Zone-appropriate bounds
    const zoneDims = getZoneDimensions(this.localZone);
    const zoneW = zoneDims.width;
    const zoneH = zoneDims.height;

    // Block all input while dead
    let mx = 0;
    let my = 0;
    let aimAngle = 0;
    let shooting = false;
    let useAbility = false;

    if (!this.isDead && !this.isLoadingZone) {
      // Read input
      if (this.keys) {
        if (this.keys.A.isDown) mx -= 1;
        if (this.keys.D.isDown) mx += 1;
        if (this.keys.W.isDown) my -= 1;
        if (this.keys.S.isDown) my += 1;

        // Q key — return to nexus (works from hostile and dungeons)
        if (this.returnToNexusCooldown > 0) {
          this.returnToNexusCooldown -= delta;
        }
        if (
          this.keys.Q.isDown &&
          this.localZone !== "nexus" &&
          this.returnToNexusCooldown <= 0
        ) {
          this.network.sendReturnToNexus();
          this.returnToNexusCooldown = 1000;
        }

        // E key — interact with portals or crafting table
        if (this.portalInteractCooldown > 0) {
          this.portalInteractCooldown -= delta;
        }
        if (
          this.keys.E.isDown &&
          this.portalInteractCooldown <= 0
        ) {
          if (this.nearCraftingTable) {
            this.openCraftingUI(state, sessionId);
          } else {
            this.network.sendInteractPortal();
          }
          this.portalInteractCooldown = 500;
        }

        // F key — use health potion
        if (this.healthPotCooldown > 0) {
          this.healthPotCooldown -= delta;
        }
        if (this.keys.F.isDown && this.healthPotCooldown <= 0) {
          this.network.sendUseHealthPot();
          this.healthPotCooldown = 500;
        }

        // G key — use mana potion
        if (this.manaPotCooldown > 0) {
          this.manaPotCooldown -= delta;
        }
        if (this.keys.G.isDown && this.manaPotCooldown <= 0) {
          this.network.sendUseManaPot();
          this.manaPotCooldown = 500;
        }

        // U key — TESTING: give 999 of each crafting orb
        if (Phaser.Input.Keyboard.JustDown(this.keys.U) && this.craftingUI.isVisible()) {
          this.craftingUI.giveTestOrbs();
        }

        // P key — toggle stats panel
        if (Phaser.Input.Keyboard.JustDown(this.keys.P)) {
          this.toggleStatsPanel();
        }
      }

      // Calculate aim angle
      if (localSprite) {
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y
        );
        aimAngle = Math.atan2(
          worldPoint.y - localSprite.displayY,
          worldPoint.x - localSprite.displayX
        );
      }

      // Space key — use ability (hostile + dungeons)
      if (this.keys.SPACE.isDown) {
        useAbility = true;
      }

      // Only shoot if not clicking on UI panels and not dragging items
      const pointer = this.input.activePointer;
      const overUI = this.hud.isOverPanel(pointer.x, pointer.y) || this.craftingUI.isVisible();
      const isDragging = this.hud.dragManager.isDragging();
      shooting = pointer.isDown && !overUI && !isDragging;
    }

    if (localSprite) {
      localSprite.setLocalAimAngle(aimAngle);
    }

    // Derive movement speed from synced cachedSpeed
    const localPlayer = state.players.get(sessionId);
    const localSpeed = (localPlayer?.cachedSpeed as number) ?? 200;

    // --- Immediate input send on shooting/ability START ---
    // When shooting or ability transitions false→true, send input immediately
    // instead of waiting for the next 50ms tick. Eliminates up to 50ms of delay.
    const shootingJustStarted = shooting && !this.lastSentShooting;
    const abilityJustStarted = useAbility && !this.lastSentUseAbility;

    if ((shootingJustStarted || abilityJustStarted) && this.inputSendTimer < TICK_INTERVAL) {
      this.inputSequence++;
      const sendDt = Math.min(this.accumulatedDt, TICK_INTERVAL);
      this.accumulatedDt = Math.max(0, this.accumulatedDt - sendDt);

      if (localSprite) {
        this.pendingInputs.push({
          seq: this.inputSequence,
          movementX: mx,
          movementY: my,
          dt: sendDt,
        });
        if (this.pendingInputs.length > 60) {
          this.pendingInputs = this.pendingInputs.slice(-30);
        }
      }

      const input: PlayerInput = {
        seq: this.inputSequence,
        movement: { x: mx, y: my },
        aimAngle,
        shooting,
        useAbility,
        dt: sendDt,
      };
      this.network.sendInput(input);
      this.lastSentMX = mx;
      this.lastSentMY = my;
      this.lastSentAimAngle = aimAngle;
      this.lastSentShooting = shooting;
      this.lastSentUseAbility = useAbility;
      // Reset tick timer so the regular throttled loop doesn't double-send
      this.inputSendTimer = 0;
    }

    // --- Client-side predicted projectile spawning ---
    // Spawn visual-only projectiles instantly so shooting/abilities feel responsive.
    if (localSprite && localPlayer) {
      const now = performance.now();
      const eqData = readEquipmentData(localPlayer);
      const level = (localPlayer.level as number) ?? 1;

      // Predicted weapon projectiles
      if (shooting) {
        const weaponItem = eqData[ItemCategory.Weapon];
        if (weaponItem && !isEmptyItem(weaponItem)) {
          const stats = computePlayerStats(level, eqData);
          if (now - this.lastLocalShootTime >= stats.shootCooldown) {
            this.lastLocalShootTime = now;
            const isSword = getItemSubtype(weaponItem.baseItemId) === WeaponSubtype.Sword;
            // UT weapons may have multi-projectile
            let projectileCount = 1;
            let spreadAngle = 0;
            if (weaponItem.isUT) {
              const weaponDef = ITEM_DEFS[weaponItem.baseItemId];
              projectileCount = weaponDef?.weaponStats?.projectileCount ?? 1;
              spreadAngle = weaponDef?.weaponStats?.spreadAngle ?? 0;
            }

            for (let p = 0; p < projectileCount; p++) {
              let angle = aimAngle;
              if (projectileCount > 1 && spreadAngle > 0) {
                const startAngle = aimAngle - spreadAngle / 2;
                angle = startAngle + (spreadAngle / (projectileCount - 1)) * p;
              }
              const projSprite = new ProjectileSprite(
                this,
                localSprite.displayX,
                localSprite.displayY,
                EntityType.Player,
                angle,
                stats.weaponProjSpeed,
                isSword ? ProjectileType.SwordSlash : ProjectileType.BowArrow
              );
              this.predictedProjectiles.push({
                sprite: projSprite,
                angle,
                projType: isSword ? ProjectileType.SwordSlash : ProjectileType.BowArrow,
                startX: localSprite.displayX,
                startY: localSprite.displayY,
                maxRange: stats.weaponRange,
                createdAt: now,
                confirmed: false,
                collisionRadius: stats.weaponProjSize,
                damage: stats.damage,
                piercing: false,
                hitEnemies: new Set(),
              });
            }
          }
        }
      }

      // Predicted ability projectiles
      if (useAbility) {
        const abilityItem = eqData[ItemCategory.Ability];
        if (abilityItem && !isEmptyItem(abilityItem)) {
          // Get ability stats (UT uses ITEM_DEFS, tiered uses templates)
          let as: { damage: number; range: number; projectileSpeed: number; projectileSize: number; manaCost: number; cooldown: number; piercing: boolean } | null = null;
          if (abilityItem.isUT) {
            const abilityDef = ITEM_DEFS[abilityItem.baseItemId];
            if (abilityDef?.abilityStats) {
              as = abilityDef.abilityStats;
            }
          } else {
            const subtype = getItemSubtype(abilityItem.baseItemId);
            as = getScaledAbilityStats(subtype, abilityItem.instanceTier, abilityItem.lockedStat1Tier, abilityItem.lockedStat2Tier);
          }
          if (as && now - this.lastLocalAbilityTime >= as.cooldown) {
            const mana = (localPlayer.mana as number) ?? 0;
            if (mana >= as.manaCost) {
              this.lastLocalAbilityTime = now;
              const projSprite = new ProjectileSprite(
                this,
                localSprite.displayX,
                localSprite.displayY,
                EntityType.Player,
                aimAngle,
                as.projectileSpeed,
                ProjectileType.QuiverShot
              );
              this.predictedProjectiles.push({
                sprite: projSprite,
                angle: aimAngle,
                projType: ProjectileType.QuiverShot,
                startX: localSprite.displayX,
                startY: localSprite.displayY,
                maxRange: as.range,
                createdAt: now,
                confirmed: false,
                collisionRadius: as.projectileSize,
                damage: as.damage,
                piercing: as.piercing,
                hitEnemies: new Set(),
              });
            }
          }
        }
      }
    }

    // Client-side prediction — runs EVERY FRAME for smooth visuals
    if (localSprite) {
      this.accumulatedDt += delta;

      if (mx !== 0 || my !== 0) {
        // Terrain speed modifiers in hostile zone
        let predSpeed = localSpeed;
        if (isHostileZone(this.localZone)) {
          if (isRoadAt(localSprite.x, localSprite.y)) {
            predSpeed *= ROAD_SPEED_MULTIPLIER;
          } else if (isRiverAt(localSprite.x, localSprite.y)) {
            predSpeed *= RIVER_SPEED_MULTIPLIER;
          }
        }

        const result = applyMovement(
          localSprite.x,
          localSprite.y,
          mx,
          my,
          predSpeed,
          delta,
          PLAYER_RADIUS,
          zoneW,
          zoneH
        );
        let predX = result.x;
        let predY = result.y;
        // Wall collision in dungeons / nexus
        if (this.currentDungeonMap) {
          const wallResult = resolveWallCollision(predX, predY, PLAYER_RADIUS, this.currentDungeonMap);
          predX = wallResult.x;
          predY = wallResult.y;
        }
        // Water collision in hostile zone
        if (isHostileZone(this.localZone) && getRealmMap()) {
          const waterResult = resolveHostileCollision(predX, predY, PLAYER_RADIUS);
          predX = waterResult.x;
          predY = waterResult.y;
        }
        // Decoration collision in hostile zone
        if (isHostileZone(this.localZone) && getRealmMap()) {
          const decoResult = resolveDecorationCollision(predX, predY, PLAYER_RADIUS);
          predX = decoResult.x;
          predY = decoResult.y;
        }
        localSprite.setLocalPosition(predX, predY);
      }
    }

    // Throttled input send — at server tick rate (~20Hz).
    // Cap at 2 sends per frame to prevent flooding during frame drops.
    this.inputSendTimer += delta;
    let inputsSentThisFrame = 0;
    while (this.inputSendTimer >= TICK_INTERVAL && inputsSentThisFrame < 2) {
      inputsSentThisFrame++;
      this.inputSendTimer -= TICK_INTERVAL;
      const hasChanged =
        mx !== this.lastSentMX ||
        my !== this.lastSentMY ||
        shooting !== this.lastSentShooting ||
        useAbility !== this.lastSentUseAbility ||
        Math.abs(aimAngle - this.lastSentAimAngle) > 0.01;

      if (hasChanged || mx !== 0 || my !== 0 || shooting || useAbility) {
        this.inputSequence++;
        // Each iteration consumes at most one tick's worth of dt
        const sendDt = Math.min(this.accumulatedDt, TICK_INTERVAL);
        this.accumulatedDt = Math.max(0, this.accumulatedDt - sendDt);

        // Push ONE pending input for reconciliation (matches what server will process)
        if (localSprite) {
          this.pendingInputs.push({
            seq: this.inputSequence,
            movementX: mx,
            movementY: my,
            dt: sendDt,
          });

          if (this.pendingInputs.length > 60) {
            this.pendingInputs = this.pendingInputs.slice(-30);
          }
        }

        const input: PlayerInput = {
          seq: this.inputSequence,
          movement: { x: mx, y: my },
          aimAngle,
          shooting,
          useAbility,
          dt: sendDt,
        };
        this.network.sendInput(input);
        this.lastSentMX = mx;
        this.lastSentMY = my;
        this.lastSentAimAngle = aimAngle;
        this.lastSentShooting = shooting;
        this.lastSentUseAbility = useAbility;
      } else {
        // Idle: discard accumulated dt so next movement start doesn't carry stale time
        this.accumulatedDt = 0;
      }
    }
    // Clamp timer to prevent unbounded accumulation after frame drops
    if (this.inputSendTimer > TICK_INTERVAL * 2) {
      this.inputSendTimer = TICK_INTERVAL;
    }

    // Update all sprites
    this.playerSprites.forEach((sprite) => sprite.update(delta));
    this.enemySprites.forEach((sprite) => sprite.update(delta));
    this.projectileSprites.forEach((sprite) => sprite.update(delta));

    // Update and clean up predicted projectiles (range exhaustion + safety timeout + hit detection)
    const nowCleanup = performance.now();
    for (let i = this.predictedProjectiles.length - 1; i >= 0; i--) {
      const pp = this.predictedProjectiles[i];
      pp.sprite.update(delta);

      // Client-side hit detection: check predicted projectile against visible enemies
      let hitSomething = false;
      this.enemySprites.forEach((enemy, enemyId) => {
        if (hitSomething) return;
        if (pp.hitEnemies.has(enemyId)) return;
        const enemyRadius = enemy.getRadius();
        if (circlesOverlap(pp.sprite.x, pp.sprite.y, pp.collisionRadius, enemy.x, enemy.y, enemyRadius + HITBOX_PADDING)) {
          enemy.showPredictedDamage(pp.damage);
          pp.hitEnemies.add(enemyId);
          if (!pp.piercing) {
            hitSomething = true;
          }
        }
      });

      if (hitSomething) {
        pp.sprite.destroy();
        this.predictedProjectiles.splice(i, 1);
        continue;
      }

      const dx = pp.sprite.x - pp.startX;
      const dy = pp.sprite.y - pp.startY;
      const distSq = dx * dx + dy * dy;
      const expired = pp.confirmed
        ? distSq > pp.maxRange * pp.maxRange
        : distSq > pp.maxRange * pp.maxRange || nowCleanup - pp.createdAt > 500;
      if (expired) {
        pp.sprite.destroy();
        this.predictedProjectiles.splice(i, 1);
      }
    }

    // Zone-based visibility filtering
    const inNexus = this.localZone === "nexus";

    // Enemies only visible outside nexus; projectiles and bags visible everywhere
    this.enemySprites.forEach((sprite) => sprite.setVisible(!inNexus));
    this.projectileSprites.forEach((sprite) => sprite.setVisible(true));
    for (const pp of this.predictedProjectiles) pp.sprite.setVisible(true);
    this.bagSprites.forEach((sprite) => sprite.setVisible(true));

    // Dungeon portal sprites: always visible (server filterChildren handles zone filtering)
    this.dungeonPortalSprites.forEach((ps) => {
      ps.graphics.setVisible(true);
      ps.label.setVisible(true);
    });

    // Players: only show players in the same zone
    this.playerSprites.forEach((sprite) => {
      sprite.setVisible(sprite.zone === this.localZone);
    });

    // Update camera — always center on player's display position (rounded to avoid tile seams)
    if (localSprite) {
      this.cameras.main.scrollX = Math.round(
        localSprite.displayX - this.cameras.main.width / 2
      );
      this.cameras.main.scrollY = Math.round(
        localSprite.displayY - this.cameras.main.height / 2
      );
    }

    // Redraw hostile ground each frame (viewport-based biome tiles)
    if (isHostileZone(this.localZone)) {
      this.drawHostileGround();
    }

    // Update "Press E" proximity prompt
    this.updatePressEPrompt(localSprite);

    // Update dungeon tooltip (shows stats when near a dungeon entrance portal)
    this.updateDungeonTooltip(localSprite);

    // Update HUD
    if (localPlayer) {
      const currentXp = localPlayer.xp as number;
      const currentLevel = (localPlayer.level as number) ?? 1;

      this.hud.update(
        localPlayer.hp as number,
        localPlayer.maxHp as number,
        (localPlayer.mana as number) ?? 0,
        (localPlayer.maxMana as number) ?? 100,
        currentXp,
        currentLevel,
        state.players.size,
        localSprite?.displayX ?? 0,
        localSprite?.displayY ?? 0,
        this.playerSprites,
        this.enemySprites,
        this.localZone,
        (localPlayer.healthPots as number) ?? 0,
        (localPlayer.manaPots as number) ?? 0,
        (localPlayer.portalGems as number) ?? 0
      );

      // Update stats panel if visible
      if (this.statsPanel.isVisible()) {
        this.statsPanel.update(currentLevel, this.hud.inventoryUI.getEquipment());
      }

      // XP gain floating text
      if (currentXp > this.lastKnownXp && this.lastKnownXp > 0 && localSprite) {
        const gained = currentXp - this.lastKnownXp;
        this.hud.showXpGain(localSprite.displayX, localSprite.displayY, gained);
      }

      // Level-up visual effect
      if (currentLevel > this.lastKnownLevel && this.lastKnownLevel > 0 && localSprite) {
        this.hud.showLevelUp(localSprite.displayX, localSprite.displayY, currentLevel);
      }

      this.lastKnownXp = currentXp;
      this.lastKnownLevel = currentLevel;

      // Update inventory UI from synced player inventory (ItemInstance schemas)
      const invItems = readInventoryData(localPlayer);
      this.hud.inventoryUI.updateInventory(invItems);

      // Update equipment UI from synced player equipment (ItemInstance schemas)
      const eqItems = readEquipmentData(localPlayer);
      this.hud.inventoryUI.updateEquipment(eqItems);

      // Update crafting UI if open (sync selected item + orb counts each frame)
      if (this.craftingUI.isVisible()) {
        const slotIdx = this.craftingUI.getCurrentSlotIndex();
        if (slotIdx >= 0) {
          const sourceItems = this.craftingUI.getCurrentLocation() === "equipment" ? eqItems : invItems;
          if (slotIdx < sourceItems.length) {
            this.craftingUI.updateItem(sourceItems[slotIdx]);
          }
        }
        this.craftingUI.updateOrbCounts(readOrbCounts(localPlayer));

        // Close crafting UI if player walks away from table
        if (!this.nearCraftingTable) {
          this.craftingUI.hide();
        }
      }

      // Update loot bag if open (schema auto-syncs, so re-read items each frame)
      if (this.hud.lootBagUI.isVisible()) {
        const bagId = this.hud.lootBagUI.getBagId();
        if (bagId) {
          const bagSchema = (this.decodedState?.lootBags as unknown as { get(key: string): SchemaInstance | undefined })?.get(bagId);
          if (bagSchema) {
            const bagItems = readBagItems(bagSchema);
            this.hud.lootBagUI.updateItems(bagItems);
          }
        }
      }
    }
  }

  private cleanup(): void {
    this.playerSprites.forEach((s) => s.destroy());
    this.playerSprites.clear();
    this.enemySprites.forEach((s) => s.destroy());
    this.enemySprites.clear();
    this.enemySnapshotCache.clear();
    this.projectileSprites.forEach((s) => s.destroy());
    this.projectileSprites.clear();
    this.bagSprites.forEach((s) => s.destroy());
    this.bagSprites.clear();
    this.clearNexusLabels();
    this.clearDungeonPortalSprites();
    this.pressEText?.destroy();
    this.dungeonTooltip?.hide();
    this.craftingUI?.hide();
    this.statsPanel?.hide();
    this.inputSequence = 0;
    this.pendingInputs = [];
    this.inputSendTimer = 0;
    this.accumulatedDt = 0;
    this.lastSentMX = 0;
    this.lastSentMY = 0;
    this.lastSentAimAngle = 0;
    this.lastSentShooting = false;
    this.lastSentUseAbility = false;
    for (const pp of this.predictedProjectiles) pp.sprite.destroy();
    this.predictedProjectiles = [];
    this.lastLocalShootTime = 0;
    this.lastLocalAbilityTime = 0;
    this.isDead = false;
    this.lastKnownXp = 0;
    this.lastKnownLevel = 1;
    this.hud.hideDeathScreen();
    this.hud.lootBagUI.hide();
    this.hideLoadingScreen();
  }

  // --- Dungeon Portal Methods ---

  private setupDungeonPortalListeners(state: DecodedState): void {
    state.dungeonPortals.onAdd((portal, id) => {
      const px = portal.x as number;
      const py = portal.y as number;
      const pType = portal.portalType as number;

      const graphics = this.add.graphics().setDepth(5);
      this.drawDungeonPortalGraphics(graphics, px, py, pType);

      let labelText = "Dungeon Portal";
      let labelColor = "#ffffff";
      if (pType === PortalType.InfernalPitEntrance) {
        labelText = "The Infernal Pit";
        labelColor = "#ff4400";
      } else if (pType === PortalType.VoidSanctumEntrance) {
        labelText = "The Void Sanctum";
        labelColor = "#6600cc";
      } else if (pType === PortalType.DungeonExit) {
        labelText = "Exit";
        labelColor = "#44ff44";
      }

      const label = this.add
        .text(px, py - DUNGEON_PORTAL_RADIUS - 16, labelText, {
          fontSize: "11px",
          color: labelColor,
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(6);

      this.dungeonPortalSprites.set(id, { graphics, label, x: px, y: py, portalType: pType });
    });

    state.dungeonPortals.onRemove((_portal, id) => {
      const ps = this.dungeonPortalSprites.get(id);
      if (ps) {
        ps.graphics.destroy();
        ps.label.destroy();
        this.dungeonPortalSprites.delete(id);
      }
    });
  }

  private drawDungeonPortalGraphics(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    portalType: number
  ): void {
    let color = 0xffffff;
    let glowColor = 0xaaaaaa;
    if (portalType === PortalType.InfernalPitEntrance) {
      color = 0xff4400;
      glowColor = 0xff6622;
    } else if (portalType === PortalType.VoidSanctumEntrance) {
      color = 0x6600cc;
      glowColor = 0x8833ee;
    } else if (portalType === PortalType.DungeonExit) {
      color = 0x44ff44;
      glowColor = 0x66ff66;
    }

    // Outer glow
    graphics.lineStyle(4, glowColor, 0.3);
    graphics.strokeCircle(x, y, DUNGEON_PORTAL_RADIUS + 10);

    // Mid ring
    graphics.lineStyle(3, color, 0.5);
    graphics.strokeCircle(x, y, DUNGEON_PORTAL_RADIUS + 3);

    // Main ring
    graphics.lineStyle(3, color, 0.8);
    graphics.strokeCircle(x, y, DUNGEON_PORTAL_RADIUS);

    // Inner fill
    graphics.fillStyle(color, 0.25);
    graphics.fillCircle(x, y, DUNGEON_PORTAL_RADIUS - 4);

    // Bright core
    graphics.fillStyle(color, 0.15);
    graphics.fillCircle(x, y, DUNGEON_PORTAL_RADIUS / 2);
  }

  private clearDungeonPortalSprites(): void {
    this.dungeonPortalSprites.forEach((ps) => {
      ps.graphics.destroy();
      ps.label.destroy();
    });
    this.dungeonPortalSprites.clear();
  }

  private rebuildDungeonPortals(): void {
    if (!this.decodedState) return;
    this.decodedState.dungeonPortals.forEach((portal, id) => {
      if (this.dungeonPortalSprites.has(id)) return;
      // Only rebuild portals belonging to the current zone
      if ((portal.zone as string) !== this.localZone) return;
      const px = portal.x as number;
      const py = portal.y as number;
      const pType = portal.portalType as number;

      const graphics = this.add.graphics().setDepth(5);
      this.drawDungeonPortalGraphics(graphics, px, py, pType);

      let labelText = "Dungeon Portal";
      let labelColor = "#ffffff";
      if (pType === PortalType.InfernalPitEntrance) {
        labelText = "The Infernal Pit";
        labelColor = "#ff4400";
      } else if (pType === PortalType.VoidSanctumEntrance) {
        labelText = "The Void Sanctum";
        labelColor = "#6600cc";
      } else if (pType === PortalType.DungeonExit) {
        labelText = "Exit";
        labelColor = "#44ff44";
      }

      const label = this.add
        .text(px, py - DUNGEON_PORTAL_RADIUS - 16, labelText, {
          fontSize: "11px",
          color: labelColor,
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(6);

      this.dungeonPortalSprites.set(id, { graphics, label, x: px, y: py, portalType: pType });
    });
  }

  private drawDungeonGround(): void {
    const dungeonType = getDungeonTypeFromZone(this.localZone);
    const visual = dungeonType !== undefined ? DUNGEON_VISUALS[dungeonType] : undefined;
    if (!visual) return;

    const mapData = this.currentDungeonMap;
    if (!mapData) {
      // Fallback: simple fill if no map data yet
      this.groundGraphics.fillStyle(visual.groundFill, 1);
      const dims = getZoneDimensions(this.localZone);
      this.groundGraphics.fillRect(0, 0, dims.width, dims.height);
      return;
    }

    const { tiles, width, height } = mapData;

    // Draw tiles
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;
        const tile = tiles[ty * width + tx];

        if (tile === DungeonTile.Floor) {
          // Floor tile: colored fill + grid line
          this.groundGraphics.fillStyle(visual.groundFill, 1);
          this.groundGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.groundGraphics.lineStyle(1, visual.tileLineColor, visual.tileLineAlpha);
          this.groundGraphics.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        // Wall tiles: skip rendering (transparent, black background shows through)
      }
    }

    // Draw highlighted edges where floor meets wall for visual clarity
    this.groundGraphics.lineStyle(2, visual.tileLineColor, 0.6);
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty * width + tx] !== DungeonTile.Floor) continue;
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        // Left edge
        if (tx === 0 || tiles[ty * width + (tx - 1)] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px, py, px, py + TILE_SIZE);
        }
        // Right edge
        if (tx === width - 1 || tiles[ty * width + (tx + 1)] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
        }
        // Top edge
        if (ty === 0 || tiles[(ty - 1) * width + tx] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px, py, px + TILE_SIZE, py);
        }
        // Bottom edge
        if (ty === height - 1 || tiles[(ty + 1) * width + tx] === DungeonTile.Wall) {
          this.groundGraphics.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
        }
      }
    }

    // Dungeon name label near spawn room
    this.clearNexusLabels();
    const label = this.add
      .text(
        mapData.spawnRoom.centerX,
        mapData.spawnRoom.centerY + (mapData.spawnRoom.h * TILE_SIZE) / 2 + 20,
        `~ ${visual.name} ~`,
        {
          fontSize: "14px",
          color: "#" + visual.tileLineColor.toString(16).padStart(6, "0"),
          fontFamily: "monospace",
        }
      )
      .setOrigin(0.5)
      .setAlpha(0.5);
    this.nexusLabels.push(label);
  }

  private updatePressEPrompt(localSprite: PlayerSprite | undefined): void {
    if (!localSprite || this.isDead) {
      this.pressEText.setVisible(false);
      return;
    }

    const px = localSprite.x;
    const py = localSprite.y;
    let nearPortal = false;
    let portalX = 0;
    let portalY = 0;

    // Check nexus realm portals
    if (this.localZone === "nexus") {
      const realmPortals = [
        { x: REALM_PORTAL_1_X, y: REALM_PORTAL_1_Y },
        { x: REALM_PORTAL_2_X, y: REALM_PORTAL_2_Y },
      ];
      for (const rp of realmPortals) {
        const dx = px - rp.x;
        const dy = py - rp.y;
        if (dx * dx + dy * dy < (PORTAL_RADIUS + 20) * (PORTAL_RADIUS + 20)) {
          nearPortal = true;
          portalX = rp.x;
          portalY = rp.y;
          break;
        }
      }
    }

    // Check crafting table in nexus
    this.nearCraftingTable = false;
    if (!nearPortal && this.localZone === "nexus") {
      const dx = px - CRAFTING_TABLE_X;
      const dy = py - CRAFTING_TABLE_Y;
      if (dx * dx + dy * dy < CRAFTING_TABLE_INTERACT_RADIUS * CRAFTING_TABLE_INTERACT_RADIUS) {
        nearPortal = true;
        portalX = CRAFTING_TABLE_X;
        portalY = CRAFTING_TABLE_Y;
        this.nearCraftingTable = true;
      }
    }

    // Check dungeon portals
    if (!nearPortal) {
      this.dungeonPortalSprites.forEach((ps) => {
        if (nearPortal) return;
        const dx = px - ps.x;
        const dy = py - ps.y;
        if (dx * dx + dy * dy < DUNGEON_PORTAL_INTERACT_RADIUS * DUNGEON_PORTAL_INTERACT_RADIUS) {
          nearPortal = true;
          portalX = ps.x;
          portalY = ps.y;
        }
      });
    }

    if (nearPortal) {
      const label = this.nearCraftingTable ? "Press E to Craft" : "Press E";
      this.pressEText.setText(label);
      this.pressEText.setPosition(portalX, portalY + DUNGEON_PORTAL_RADIUS + 20);
      this.pressEText.setVisible(true);
    } else {
      this.pressEText.setVisible(false);
    }
  }

  private openCraftingUI(state: DecodedState, sessionId: string): void {
    const localPlayer = state.players.get(sessionId);
    if (!localPlayer) return;

    // Toggle: if already open, close it
    if (this.craftingUI.isVisible()) {
      this.craftingUI.hide();
      return;
    }

    // Close stats panel if open (mutual exclusion)
    if (this.statsPanel.isVisible()) {
      this.statsPanel.hide();
    }

    const orbCounts = readOrbCounts(localPlayer);
    this.craftingUI.show(orbCounts);
  }

  private toggleStatsPanel(): void {
    if (this.statsPanel.isVisible()) {
      this.statsPanel.hide();
    } else {
      // Close crafting UI if open (mutual exclusion)
      if (this.craftingUI.isVisible()) {
        this.craftingUI.hide();
      }
      this.statsPanel.show();
    }
  }

  private updateDungeonTooltip(localSprite: PlayerSprite | undefined): void {
    if (!localSprite || this.isDead) {
      this.dungeonTooltip.hide();
      return;
    }

    const px = localSprite.x;
    const py = localSprite.y;

    // Check proximity to dungeon entrance portals only
    let foundPortalType = -1;
    let foundModifierIds: number[] = [];
    let foundModifierTiers: number[] = [];
    let foundRarityBoost = 0;
    let foundQuantityBoost = 0;

    this.dungeonPortalSprites.forEach((ps, id) => {
      if (foundPortalType >= 0) return;
      // Only show tooltip for entrance portals, not exit portals
      if (
        ps.portalType !== PortalType.InfernalPitEntrance &&
        ps.portalType !== PortalType.VoidSanctumEntrance
      ) {
        return;
      }

      const dx = px - ps.x;
      const dy = py - ps.y;
      if (
        dx * dx + dy * dy <
        DUNGEON_PORTAL_INTERACT_RADIUS * DUNGEON_PORTAL_INTERACT_RADIUS
      ) {
        // Read synced data from the portal schema
        const portalSchema = this.decodedState.dungeonPortals.get(id);
        if (portalSchema) {
          const modIds: number[] = [];
          const modArray = portalSchema.modifierIds as unknown as {
            forEach(cb: (v: unknown) => void): void;
          };
          if (modArray && typeof modArray.forEach === "function") {
            modArray.forEach((v: unknown) => modIds.push(v as number));
          }

          const modTiers: number[] = [];
          const tierArray = portalSchema.modifierTiers as unknown as {
            forEach(cb: (v: unknown) => void): void;
          };
          if (tierArray && typeof tierArray.forEach === "function") {
            tierArray.forEach((v: unknown) => modTiers.push(v as number));
          }

          foundPortalType = ps.portalType;
          foundModifierIds = modIds;
          foundModifierTiers = modTiers;
          foundRarityBoost = (portalSchema.lootRarityBoost as number) ?? 0;
          foundQuantityBoost = (portalSchema.lootQuantityBoost as number) ?? 0;
        }
      }
    });

    const shiftHeld = this.keys?.SHIFT.isDown ?? false;

    if (foundPortalType >= 0) {
      // Cache for in-dungeon use
      this.cachedDungeonStats = {
        portalType: foundPortalType,
        modifierIds: foundModifierIds,
        modifierTiers: foundModifierTiers,
        lootRarityBoost: foundRarityBoost,
        lootQuantityBoost: foundQuantityBoost,
      };
      this.dungeonTooltip.show(
        foundPortalType,
        foundModifierIds,
        foundModifierTiers,
        foundRarityBoost,
        foundQuantityBoost,
        shiftHeld
      );
    } else if (shiftHeld && isDungeonZone(this.localZone) && this.cachedDungeonStats) {
      // Inside dungeon + Shift held: show cached tooltip
      const c = this.cachedDungeonStats;
      this.dungeonTooltip.show(
        c.portalType,
        c.modifierIds,
        c.modifierTiers,
        c.lootRarityBoost,
        c.lootQuantityBoost,
        true
      );
    } else {
      this.dungeonTooltip.hide();
    }
  }
}

// --- Helper: convert Colyseus ItemInstance schema to ItemInstanceData ---

function readItemSchema(schema: SchemaInstance): ItemInstanceData {
  const openStatsRaw = schema.openStats as unknown as { length: number; [i: number]: number } | undefined;
  const openStats: number[] = [];
  if (openStatsRaw && typeof openStatsRaw.length === "number") {
    for (let i = 0; i < openStatsRaw.length; i++) {
      openStats.push(openStatsRaw[i]);
    }
  }
  return {
    baseItemId: (schema.baseItemId as number) ?? -1,
    instanceTier: (schema.instanceTier as number) ?? 0,
    isUT: (schema.isUT as boolean) ?? false,
    lockedStat1Type: (schema.lockedStat1Type as number) ?? -1,
    lockedStat1Tier: (schema.lockedStat1Tier as number) ?? 0,
    lockedStat1Roll: (schema.lockedStat1Roll as number) ?? 0,
    lockedStat2Type: (schema.lockedStat2Type as number) ?? -1,
    lockedStat2Tier: (schema.lockedStat2Tier as number) ?? 0,
    lockedStat2Roll: (schema.lockedStat2Roll as number) ?? 0,
    openStats,
    forgeProtectedSlot: (schema.forgeProtectedSlot as number) ?? -1,
    forgeProtectedSlot2: (schema.forgeProtectedSlot2 as number) ?? -1,
  };
}

function readOrbCounts(player: SchemaInstance): number[] {
  const counts = new Array(10).fill(0);
  counts[0] = (player.orbBlank as number) ?? 0;
  counts[1] = (player.orbEmber as number) ?? 0;
  counts[2] = (player.orbShard as number) ?? 0;
  counts[3] = (player.orbChaos as number) ?? 0;
  counts[4] = (player.orbFlux as number) ?? 0;
  counts[5] = (player.orbVoid as number) ?? 0;
  counts[6] = (player.orbPrism as number) ?? 0;
  counts[7] = (player.orbForge as number) ?? 0;
  counts[8] = (player.orbCalibrate as number) ?? 0;
  counts[9] = (player.orbDivine as number) ?? 0;
  return counts;
}

function readInventoryData(player: SchemaInstance): ItemInstanceData[] {
  const inv = player.inventory as unknown as { length: number; forEach?: (cb: (item: SchemaInstance) => void) => void; [i: number]: SchemaInstance };
  const items: ItemInstanceData[] = [];
  if (inv && typeof inv.length === "number") {
    if (typeof inv.forEach === "function") {
      inv.forEach((itemSchema: SchemaInstance) => {
        items.push(readItemSchema(itemSchema));
      });
    } else {
      for (let i = 0; i < inv.length; i++) {
        items.push(readItemSchema(inv[i]));
      }
    }
  }
  return items;
}

function readEquipmentData(player: SchemaInstance): ItemInstanceData[] {
  const eq = player.equipment as unknown as { length: number; forEach?: (cb: (item: SchemaInstance) => void) => void; [i: number]: SchemaInstance };
  const items: ItemInstanceData[] = [];
  if (eq && typeof eq.length === "number") {
    if (typeof eq.forEach === "function") {
      eq.forEach((itemSchema: SchemaInstance) => {
        items.push(readItemSchema(itemSchema));
      });
    } else {
      for (let i = 0; i < eq.length; i++) {
        items.push(readItemSchema(eq[i]));
      }
    }
  }
  return items;
}

function readBagItems(bagSchema: SchemaInstance): ItemInstanceData[] {
  const items: ItemInstanceData[] = [];
  const bagItems = bagSchema.items as unknown as { forEach(cb: (item: SchemaInstance) => void): void };
  if (bagItems && typeof bagItems.forEach === "function") {
    bagItems.forEach((lootBagItem: SchemaInstance) => {
      // LootBagItem has an `item` field which is an ItemInstance schema
      const itemSchema = lootBagItem.item as SchemaInstance;
      if (itemSchema) {
        items.push(readItemSchema(itemSchema));
      } else {
        items.push(createEmptyItemInstance());
      }
    });
  }
  return items;
}
