import Phaser from "phaser";
import { NetworkManager } from "../network/NetworkManager";
import { PlayerSprite } from "../entities/PlayerSprite";
import { EnemySprite } from "../entities/EnemySprite";
import { SnapshotBuffer } from "../entities/SnapshotBuffer";
import { ProjectileSprite } from "../entities/ProjectileSprite";
import { LootBagSprite } from "../entities/LootBagSprite";
import { HUD } from "../ui/HUD";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  NEXUS_WIDTH,
  NEXUS_HEIGHT,
  PORTAL_X,
  PORTAL_Y,
  PORTAL_RADIUS,
  TILE_SIZE,
  PLAYER_RADIUS,
  TICK_INTERVAL,
  ServerMessage,
  PlayerInput,
  applyMovement,
  getBiomeAtPosition,
  BIOME_VISUALS,
} from "@rotmg-lite/shared";

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
}

export class GameScene extends Phaser.Scene {
  private network!: NetworkManager;
  private playerSprites = new Map<string, PlayerSprite>();
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
    SPACE: Phaser.Input.Keyboard.Key;
  };

  private hud!: HUD;
  private groundGraphics!: Phaser.GameObjects.Graphics;
  private portalGraphics!: Phaser.GameObjects.Graphics;
  private nexusLabels: Phaser.GameObjects.Text[] = [];

  // Zone tracking
  private localZone: string = "nexus";

  // Q key cooldown to prevent spam
  private returnToNexusCooldown: number = 0;

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

  // Track XP/level changes for visual effects
  private lastKnownXp: number = 0;
  private lastKnownLevel: number = 1;
  private isDead: boolean = false;

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

    // Draw ground for current zone
    this.groundGraphics = this.add.graphics();
    this.portalGraphics = this.add.graphics();
    this.drawGround();
    this.drawPortal();

    // No camera bounds — camera always centers on player
    this.cameras.main.removeBounds();
    this.cameras.main.setBackgroundColor("#1a2a1a");

    // Setup keyboard input (including Q for return to nexus)
    if (this.input.keyboard) {
      this.keys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        Q: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      };
    }

    // Disable browser context menu so right-click works for inventory drop
    this.input.mouse?.disableContextMenu();

    // Create HUD
    this.hud = new HUD(this);

    // Listen to state changes
    const state = room.state as unknown as DecodedState;
    this.setupStateListeners(state);

    // Listen for zone change
    room.onMessage(ServerMessage.ZoneChanged, (data: { zone: string }) => {
      this.localZone = data.zone;
      this.pendingInputs = [];
      this.isDead = false;
      this.hud.hideDeathScreen();
      this.transitionToZone(data.zone);

      // Re-show local player sprite after respawn
      const localSprite = this.playerSprites.get(this.network.getSessionId());
      if (localSprite) {
        localSprite.setVisible(true);
      }
    });

    // Set room on inventory/loot bag UIs so they can send messages
    this.hud.inventoryUI.setRoom(room);
    this.hud.lootBagUI.setRoom(room);

    // Listen for bag open/close (server proximity detection)
    room.onMessage(
      ServerMessage.BagOpened,
      (data: { bagId: string }) => {
        const bagSchema = (state.lootBags as unknown as { get(key: string): SchemaInstance | undefined }).get(data.bagId);
        if (!bagSchema) return;

        const items: number[] = [];
        const bagItems = bagSchema.items as unknown as { forEach(cb: (item: SchemaInstance) => void): void };
        if (bagItems && typeof bagItems.forEach === "function") {
          bagItems.forEach((item: SchemaInstance) => {
            items.push(item.itemType as number);
          });
        }
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

    // Listen for bag contents updates (items picked up or dropped by any player)
    room.onMessage(
      ServerMessage.BagUpdated,
      (data: { bagId: string; items: number[] }) => {
        if (this.hud.lootBagUI.getBagId() === data.bagId) {
          this.hud.lootBagUI.updateItems(data.items);
        }
      }
    );

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

    // Handle room leave/error
    room.onLeave(() => {
      this.cleanup();
    });
  }

  private transitionToZone(zone: string): void {
    // Clear and redraw ground
    this.groundGraphics.clear();
    this.portalGraphics.clear();
    this.clearNexusLabels();
    this.drawGround();

    if (zone === "hostile") {
      this.cameras.main.setBackgroundColor("#1a1a2e");
    } else {
      this.drawPortal();
      this.cameras.main.setBackgroundColor("#1a2a1a");
    }
  }

  private clearNexusLabels(): void {
    for (const label of this.nexusLabels) {
      label.destroy();
    }
    this.nexusLabels = [];
  }

  private drawGround(): void {
    this.groundGraphics.clear();

    if (this.localZone === "nexus") {
      this.drawNexusGround();
    }
    // Hostile ground is drawn per-frame in update() (viewport-based)
  }

  private drawNexusGround(): void {
    // Peaceful green-tinted stone floor (2400x2400)
    this.groundGraphics.fillStyle(0x1a2a1a, 1);
    this.groundGraphics.fillRect(0, 0, NEXUS_WIDTH, NEXUS_HEIGHT);

    // Subtle tile grid
    this.groundGraphics.lineStyle(1, 0x2a4a2a, 0.4);
    for (let x = 0; x <= NEXUS_WIDTH; x += TILE_SIZE) {
      this.groundGraphics.lineBetween(x, 0, x, NEXUS_HEIGHT);
    }
    for (let y = 0; y <= NEXUS_HEIGHT; y += TILE_SIZE) {
      this.groundGraphics.lineBetween(0, y, NEXUS_WIDTH, y);
    }

    // Decorative border
    this.groundGraphics.lineStyle(3, 0x44aa66, 0.6);
    this.groundGraphics.strokeRect(0, 0, NEXUS_WIDTH, NEXUS_HEIGHT);

    // Garden patches in corners (scaled for larger nexus)
    const cornerInset = 160;
    const patchRadius = 60;
    const patchInner = 36;
    this.groundGraphics.fillStyle(0x2a5a2a, 0.5);
    this.groundGraphics.fillCircle(cornerInset, cornerInset, patchRadius);
    this.groundGraphics.fillCircle(
      NEXUS_WIDTH - cornerInset,
      cornerInset,
      patchRadius
    );
    this.groundGraphics.fillCircle(
      cornerInset,
      NEXUS_HEIGHT - cornerInset,
      patchRadius - 10
    );
    this.groundGraphics.fillCircle(
      NEXUS_WIDTH - cornerInset,
      NEXUS_HEIGHT - cornerInset,
      patchRadius - 10
    );

    this.groundGraphics.fillStyle(0x3a6a3a, 0.3);
    this.groundGraphics.fillCircle(cornerInset, cornerInset, patchInner);
    this.groundGraphics.fillCircle(
      NEXUS_WIDTH - cornerInset,
      cornerInset,
      patchInner
    );
    this.groundGraphics.fillCircle(
      cornerInset,
      NEXUS_HEIGHT - cornerInset,
      patchInner - 6
    );
    this.groundGraphics.fillCircle(
      NEXUS_WIDTH - cornerInset,
      NEXUS_HEIGHT - cornerInset,
      patchInner - 6
    );

    // Additional garden patches along edges
    const midPatches = [
      { x: NEXUS_WIDTH / 2, y: cornerInset },
      { x: NEXUS_WIDTH / 2, y: NEXUS_HEIGHT - cornerInset },
      { x: cornerInset, y: NEXUS_HEIGHT / 2 },
      { x: NEXUS_WIDTH - cornerInset, y: NEXUS_HEIGHT / 2 },
    ];
    this.groundGraphics.fillStyle(0x2a5a2a, 0.35);
    for (const p of midPatches) {
      this.groundGraphics.fillCircle(p.x, p.y, 40);
    }

    // Center decorative circle (fountain-like)
    this.groundGraphics.lineStyle(2, 0x44aa66, 0.3);
    this.groundGraphics.strokeCircle(
      NEXUS_WIDTH / 2,
      NEXUS_HEIGHT / 2 + 120,
      100
    );
    this.groundGraphics.fillStyle(0x225533, 0.3);
    this.groundGraphics.fillCircle(
      NEXUS_WIDTH / 2,
      NEXUS_HEIGHT / 2 + 120,
      96
    );

    // Pathways from center to edges
    this.groundGraphics.lineStyle(2, 0x2a4a2a, 0.5);
    this.groundGraphics.lineBetween(
      NEXUS_WIDTH / 2,
      0,
      NEXUS_WIDTH / 2,
      NEXUS_HEIGHT
    );
    this.groundGraphics.lineBetween(
      0,
      NEXUS_HEIGHT / 2,
      NEXUS_WIDTH,
      NEXUS_HEIGHT / 2
    );

    // Nexus label
    this.clearNexusLabels();
    const label = this.add
      .text(NEXUS_WIDTH / 2, NEXUS_HEIGHT - 60, "~ The Nexus ~", {
        fontSize: "18px",
        color: "#44aa66",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setAlpha(0.5);
    this.nexusLabels.push(label);
  }

  private drawHostileGround(): void {
    this.groundGraphics.clear();

    const cam = this.cameras.main;
    const margin = 200;
    const startX =
      Math.max(0, Math.floor((cam.scrollX - margin) / TILE_SIZE)) * TILE_SIZE;
    const startY =
      Math.max(0, Math.floor((cam.scrollY - margin) / TILE_SIZE)) * TILE_SIZE;
    const endX = Math.min(ARENA_WIDTH, cam.scrollX + cam.width + margin);
    const endY = Math.min(ARENA_HEIGHT, cam.scrollY + cam.height + margin);

    // Draw biome-colored tiles within viewport
    for (let tx = startX; tx < endX; tx += TILE_SIZE) {
      for (let ty = startY; ty < endY; ty += TILE_SIZE) {
        const biome = getBiomeAtPosition(
          tx + TILE_SIZE / 2,
          ty + TILE_SIZE / 2
        );
        const visual = BIOME_VISUALS[biome];
        if (!visual) continue;

        this.groundGraphics.fillStyle(visual.groundFill, 1);
        this.groundGraphics.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        this.groundGraphics.lineStyle(
          1,
          visual.tileLineColor,
          visual.tileLineAlpha
        );
        this.groundGraphics.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
      }
    }

    // Arena border
    this.groundGraphics.lineStyle(3, 0xe94560, 0.6);
    this.groundGraphics.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  private drawPortal(): void {
    this.portalGraphics.clear();
    if (this.localZone !== "nexus") return;

    // Outer glow
    this.portalGraphics.lineStyle(4, 0x8844ff, 0.3);
    this.portalGraphics.strokeCircle(PORTAL_X, PORTAL_Y, PORTAL_RADIUS + 12);

    // Mid glow
    this.portalGraphics.lineStyle(3, 0x9955ff, 0.5);
    this.portalGraphics.strokeCircle(PORTAL_X, PORTAL_Y, PORTAL_RADIUS + 4);

    // Main ring
    this.portalGraphics.lineStyle(3, 0xaa66ff, 0.8);
    this.portalGraphics.strokeCircle(PORTAL_X, PORTAL_Y, PORTAL_RADIUS);

    // Inner fill
    this.portalGraphics.fillStyle(0x6622cc, 0.4);
    this.portalGraphics.fillCircle(PORTAL_X, PORTAL_Y, PORTAL_RADIUS - 4);

    // Bright core
    this.portalGraphics.fillStyle(0xaa66ff, 0.25);
    this.portalGraphics.fillCircle(PORTAL_X, PORTAL_Y, PORTAL_RADIUS / 2);

    // Portal label
    const label = this.add
      .text(PORTAL_X, PORTAL_Y - PORTAL_RADIUS - 20, "Enter Realm", {
        fontSize: "12px",
        color: "#aa66ff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    this.nexusLabels.push(label);
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

        // Server reconciliation for local player
        if (isLocal) {
          const lastProcessed = (player.lastProcessedInput as number) ?? 0;

          let reconX = player.x as number;
          let reconY = player.y as number;

          this.pendingInputs = this.pendingInputs.filter(
            (input) => input.seq > lastProcessed
          );

          const reconW =
            this.localZone === "nexus" ? NEXUS_WIDTH : ARENA_WIDTH;
          const reconH =
            this.localZone === "nexus" ? NEXUS_HEIGHT : ARENA_HEIGHT;

          const reconSpeed = (player.cachedSpeed as number) ?? 200;
          for (const input of this.pendingInputs) {
            const result = applyMovement(
              reconX,
              reconY,
              input.movementX,
              input.movementY,
              reconSpeed,
              input.dt,
              PLAYER_RADIUS,
              reconW,
              reconH
            );
            reconX = result.x;
            reconY = result.y;
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
    const zoneW = this.localZone === "nexus" ? NEXUS_WIDTH : ARENA_WIDTH;
    const zoneH = this.localZone === "nexus" ? NEXUS_HEIGHT : ARENA_HEIGHT;

    // Block all input while dead
    let mx = 0;
    let my = 0;
    let aimAngle = 0;
    let shooting = false;
    let useAbility = false;

    if (!this.isDead) {
      // Read input
      if (this.keys) {
        if (this.keys.A.isDown) mx -= 1;
        if (this.keys.D.isDown) mx += 1;
        if (this.keys.W.isDown) my -= 1;
        if (this.keys.S.isDown) my += 1;

        // Q key — return to nexus
        if (this.returnToNexusCooldown > 0) {
          this.returnToNexusCooldown -= delta;
        }
        if (
          this.keys.Q.isDown &&
          this.localZone === "hostile" &&
          this.returnToNexusCooldown <= 0
        ) {
          this.network.sendReturnToNexus();
          this.returnToNexusCooldown = 1000;
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

      // Space key — use ability
      if (this.keys.SPACE.isDown && this.localZone === "hostile") {
        useAbility = true;
      }

      // Only shoot if not clicking on UI panels
      const pointer = this.input.activePointer;
      const overUI =
        this.hud.inventoryUI.isOverPanel(pointer.x, pointer.y) ||
        this.hud.lootBagUI.isOverPanel(pointer.x, pointer.y);
      shooting = pointer.isDown && !overUI;
    }

    if (localSprite) {
      localSprite.setLocalAimAngle(aimAngle);
    }

    // Derive movement speed from synced cachedSpeed
    const localPlayer = state.players.get(sessionId);
    const localSpeed = (localPlayer?.cachedSpeed as number) ?? 200;

    // Client-side prediction — runs EVERY FRAME for smooth visuals
    if (localSprite) {
      this.accumulatedDt += delta;

      if (mx !== 0 || my !== 0) {
        const result = applyMovement(
          localSprite.x,
          localSprite.y,
          mx,
          my,
          localSpeed,
          delta,
          PLAYER_RADIUS,
          zoneW,
          zoneH
        );
        localSprite.setLocalPosition(result.x, result.y);
      }
    }

    // Throttled input send — at server tick rate (~20Hz).
    // Uses `while` so multiple ticks fire per frame at low fps (e.g. 10fps).
    this.inputSendTimer += delta;
    while (this.inputSendTimer >= TICK_INTERVAL) {
      this.inputSendTimer -= TICK_INTERVAL;
      const hasChanged =
        mx !== this.lastSentMX ||
        my !== this.lastSentMY ||
        shooting !== this.lastSentShooting ||
        Math.abs(aimAngle - this.lastSentAimAngle) > 0.01;

      if (hasChanged || mx !== 0 || my !== 0 || shooting) {
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
      } else {
        // Idle: discard accumulated dt so next movement start doesn't carry stale time
        this.accumulatedDt = 0;
      }
    }

    // Update all sprites
    this.playerSprites.forEach((sprite) => sprite.update(delta));
    this.enemySprites.forEach((sprite) => sprite.update(delta));
    this.projectileSprites.forEach((sprite) => sprite.update(delta));

    // Zone-based visibility filtering
    const inNexus = this.localZone === "nexus";

    // Enemies, projectiles, bags only visible in hostile zone
    this.enemySprites.forEach((sprite) => sprite.setVisible(!inNexus));
    this.projectileSprites.forEach((sprite) => sprite.setVisible(!inNexus));
    this.bagSprites.forEach((sprite) => sprite.setVisible(!inNexus));

    // Players: only show players in the same zone
    this.playerSprites.forEach((sprite) => {
      sprite.setVisible(sprite.zone === this.localZone);
    });

    // Update camera — always center on player's display position (smooth)
    if (localSprite) {
      this.cameras.main.scrollX =
        localSprite.displayX - this.cameras.main.width / 2;
      this.cameras.main.scrollY =
        localSprite.displayY - this.cameras.main.height / 2;
    }

    // Redraw hostile ground each frame (viewport-based biome tiles)
    if (!inNexus) {
      this.drawHostileGround();
    }

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
        this.localZone
      );

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

      // Update inventory UI from synced player inventory
      const inv = localPlayer.inventory as unknown as { length: number; [index: number]: number };
      if (inv && typeof inv.length === "number") {
        const items: number[] = [];
        for (let i = 0; i < inv.length; i++) {
          items.push(inv[i]);
        }
        this.hud.inventoryUI.updateInventory(items);
      }

      // Update equipment UI from synced player equipment
      const eq = localPlayer.equipment as unknown as { length: number; [index: number]: number };
      if (eq && typeof eq.length === "number") {
        const eqItems: number[] = [];
        for (let i = 0; i < eq.length; i++) {
          eqItems.push(eq[i]);
        }
        this.hud.inventoryUI.updateEquipment(eqItems);
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
    this.inputSequence = 0;
    this.pendingInputs = [];
    this.inputSendTimer = 0;
    this.accumulatedDt = 0;
    this.lastSentMX = 0;
    this.lastSentMY = 0;
    this.lastSentAimAngle = 0;
    this.lastSentShooting = false;
    this.isDead = false;
    this.lastKnownXp = 0;
    this.lastKnownLevel = 1;
    this.hud.hideDeathScreen();
    this.hud.lootBagUI.hide();
  }
}
