import { Room, Client } from "colyseus";
import { GameState } from "../schemas/GameState";
import { Player } from "../schemas/Player";
import { Projectile } from "../schemas/Projectile";
import { LootBag, LootBagItem } from "../schemas/LootBag";
import { config } from "../config";
import { BiomeSpawnSystem } from "../systems/BiomeSpawnSystem";
import { EnemyAI } from "../systems/EnemyAI";
import { CombatSystem } from "../systems/CombatSystem";
import { ShootingPatternSystem } from "../systems/ShootingPatternSystem";
import { DungeonSystem } from "../systems/DungeonSystem";
import { DungeonPortal } from "../schemas/DungeonPortal";
import { generateId } from "../utils/idGenerator";
import {
  ClientMessage,
  ServerMessage,
  PlayerInput,
  EntityType,
  EnemyType,
  EnemyAIState,
  ItemCategory,
  WeaponSubtype,
  ProjectileType,
  PortalType,
  DungeonType,
  BagRarity,
  TICK_INTERVAL,
  PLAYER_RADIUS,
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  NEXUS_WIDTH,
  NEXUS_HEIGHT,
  PORTAL_X,
  PORTAL_Y,
  PORTAL_RADIUS,
  DUNGEON_PORTAL_INTERACT_RADIUS,
  INVENTORY_SIZE,
  EQUIPMENT_SLOTS,
  BAG_SIZE,
  BAG_PICKUP_RADIUS,
  BAG_LIFETIME,
  DEFAULT_WEAPON,
  DEFAULT_ABILITY,
  DEFAULT_ARMOR,
  DEFAULT_RING,
  normalizeVector,
  applyMovement,
  distanceBetween,
  computePlayerStats,
  getZoneDimensions,
  getItemCategory,
  getItemSubtype,
  ITEM_DEFS,
  rollBagDrop,
  rollBagLoot,
  rollBossLoot,
  isDungeonZone,
  DUNGEON_TO_ZONE,
  ZONE_TO_DUNGEON,
  resolveWallCollision,
} from "@rotmg-lite/shared";

// How often (in ticks) to force-touch enemy positions for filterChildren re-evaluation.
const FILTER_REFRESH_INTERVAL = 2; // every 2 ticks (100ms at 20Hz)

/** Recalculate all player stats from level + equipment. */
function recalcPlayerStats(player: Player): void {
  const eq = [
    player.equipment[0] ?? -1,
    player.equipment[1] ?? -1,
    player.equipment[2] ?? -1,
    player.equipment[3] ?? -1,
  ];
  const stats = computePlayerStats(player.level, eq);

  const oldMaxHp = player.maxHp;
  player.maxHp = stats.maxHp;
  player.cachedDamage = stats.damage;
  player.cachedShootCooldown = stats.shootCooldown;
  player.cachedSpeed = stats.speed;
  player.cachedHpRegen = stats.hpRegen;
  player.maxMana = stats.maxMana;
  player.cachedManaRegen = stats.manaRegen;
  player.cachedWeaponRange = stats.weaponRange;
  player.cachedWeaponProjSpeed = stats.weaponProjSpeed;
  player.cachedWeaponProjSize = stats.weaponProjSize;

  if (player.maxHp > oldMaxHp) {
    player.hp = Math.min(player.hp + (player.maxHp - oldMaxHp), player.maxHp);
  } else {
    player.hp = Math.min(player.hp, player.maxHp);
  }
  player.mana = Math.min(player.mana, player.maxMana);
}

export { recalcPlayerStats };

export class GameRoom extends Room<GameState> {
  maxClients = config.maxPlayers;

  private spawnSystem = new BiomeSpawnSystem();
  private enemyAI = new EnemyAI();
  private combatSystem = new CombatSystem();
  private shootingSystem = new ShootingPatternSystem();
  private dungeonSystem = new DungeonSystem();
  private tickCount = 0;

  onCreate(_options: Record<string, unknown>) {
    this.setState(new GameState());

    // Listen for player input messages — queue for processing in gameLoop
    this.onMessage(ClientMessage.Input, (client, input: PlayerInput) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const seq = typeof input.seq === "number" ? input.seq : 0;
      if (seq <= player.lastProcessedInput) return;

      if (player.pendingInputs.length >= 30) return;

      const mv = normalizeVector(input.movement?.x ?? 0, input.movement?.y ?? 0);
      const rawDt = typeof input.dt === "number" ? input.dt : TICK_INTERVAL;
      const dt = Math.min(Math.max(rawDt, 0), TICK_INTERVAL + 16);
      player.pendingInputs.push({
        seq,
        movementX: mv.x,
        movementY: mv.y,
        aimAngle: typeof input.aimAngle === "number" ? input.aimAngle : 0,
        shooting: !!input.shooting,
        useAbility: !!input.useAbility,
        dt,
      });
    });

    // Listen for return-to-nexus requests (Q key) — works from hostile and dungeons
    this.onMessage(ClientMessage.ReturnToNexus, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.zone === "nexus") return;
      this.teleportPlayerToNexus(player, client);
    });

    // Listen for respawn requests (after death)
    this.onMessage(ClientMessage.Respawn, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.alive) return;
      player.alive = true;
      player.hp = player.maxHp;
      player.mana = player.maxMana;
      this.teleportPlayerToNexus(player, client);
    });

    // Listen for portal interaction (E key)
    this.onMessage(ClientMessage.InteractPortal, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      // Check nexus portal
      if (player.zone === "nexus") {
        const dist = distanceBetween(player.x, player.y, PORTAL_X, PORTAL_Y);
        if (dist < PORTAL_RADIUS + PLAYER_RADIUS) {
          player.zone = "hostile";
          player.x = ARENA_CENTER_X + (Math.random() - 0.5) * 200;
          player.y = ARENA_CENTER_Y + (Math.random() - 0.5) * 200;
          this.removePlayerProjectiles(player.id);
          client.send(ServerMessage.ZoneChanged, { zone: "hostile" });
          return;
        }
      }

      // Check dungeon portals
      let handled = false;
      this.state.dungeonPortals.forEach((portal) => {
        if (handled) return;
        if (portal.zone !== player.zone) return;
        const dist = distanceBetween(player.x, player.y, portal.x, portal.y);
        if (dist > DUNGEON_PORTAL_INTERACT_RADIUS) return;

        if (
          portal.portalType === PortalType.InfernalPitEntrance ||
          portal.portalType === PortalType.VoidSanctumEntrance
        ) {
          // Enter dungeon
          const dungeonType = portal.dungeonType;
          const dungeonZone = DUNGEON_TO_ZONE[dungeonType];
          if (!dungeonZone) return;

          // Store return position and zone
          player.dungeonReturnX = portal.x;
          player.dungeonReturnY = portal.y;
          player.dungeonReturnZone = player.zone;

          // Only create dungeon if no player already there
          let dungeonAlreadyActive = false;
          this.state.players.forEach((p) => {
            if (p.zone === dungeonZone && p.id !== player.id)
              dungeonAlreadyActive = true;
          });
          if (!dungeonAlreadyActive) {
            this.dungeonSystem.createDungeonInstance(
              dungeonType,
              this.state
            );
          }

          // Teleport player to dungeon start (position from generated map)
          player.zone = dungeonZone;
          const spawnPos = this.dungeonSystem.getSpawnPosition(dungeonZone);
          if (spawnPos) {
            player.x = spawnPos.x;
            player.y = spawnPos.y;
          }
          this.removePlayerProjectiles(player.id);
          const dungeonSeed = this.dungeonSystem.getDungeonSeed(dungeonZone);
          client.send(ServerMessage.ZoneChanged, { zone: dungeonZone, dungeonSeed });
          handled = true;
        } else if (portal.portalType === PortalType.DungeonExit) {
          // Exit dungeon: return to the zone the player entered from
          const returnZone = portal.exitReturnZone || "hostile";
          player.zone = returnZone;
          player.x = portal.exitReturnX;
          player.y = portal.exitReturnY;
          player.hp = player.maxHp;
          player.mana = player.maxMana;
          this.removePlayerProjectiles(player.id);
          client.send(ServerMessage.ZoneChanged, { zone: returnZone });
          handled = true;
        }
      });
    });

    // Listen for item pickup from loot bag
    this.onMessage(
      ClientMessage.PickupItem,
      (client, data: { bagId: string; slotIndex: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive || player.zone === "nexus") return;

        const bag = this.state.lootBags.get(data.bagId);
        if (!bag) return;

        if (distanceBetween(player.x, player.y, bag.x, bag.y) > BAG_PICKUP_RADIUS) return;

        const slotIndex = data.slotIndex;
        if (slotIndex < 0 || slotIndex >= bag.items.length) return;
        const bagItem = bag.items[slotIndex];
        if (!bagItem || bagItem.itemType === -1) return;

        let emptySlot = -1;
        for (let i = 0; i < player.inventory.length; i++) {
          if (player.inventory[i] === -1) {
            emptySlot = i;
            break;
          }
        }
        if (emptySlot === -1) return;

        player.inventory[emptySlot] = bagItem.itemType;
        bagItem.itemType = -1;

        const allEmpty = bag.items.every((item) => item.itemType === -1);
        if (allEmpty) {
          this.state.lootBags.delete(bag.id);
          this.state.players.forEach((p) => {
            if (p.openBagId === bag.id) {
              p.openBagId = "";
              const c = this.clients.find((cl) => cl.sessionId === p.id);
              if (c) c.send(ServerMessage.BagClosed, {});
            }
          });
        } else {
          this.broadcastBagUpdate(bag);
        }
      }
    );

    // Listen for item drop from inventory
    this.onMessage(
      ClientMessage.DropItem,
      (client, data: { slotIndex: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive || player.zone === "nexus") return;

        const slotIndex = data.slotIndex;
        if (slotIndex < 0 || slotIndex >= INVENTORY_SIZE) return;
        const itemType = player.inventory[slotIndex] ?? -1;
        if (itemType === -1) return;

        player.inventory[slotIndex] = -1;

        if (player.openBagId) {
          const openBag = this.state.lootBags.get(player.openBagId);
          if (openBag) {
            const emptySlot = openBag.items.findIndex((item) => item.itemType === -1);
            const slotItem = emptySlot !== -1 ? openBag.items[emptySlot] : undefined;
            if (slotItem) {
              slotItem.itemType = itemType;
              this.broadcastBagUpdate(openBag);
              return;
            }
          }
        }

        this.spawnLootBag(player.x, player.y, BagRarity.Green, [itemType], player.zone);
      }
    );

    // Listen for equip item from inventory
    this.onMessage(
      ClientMessage.EquipItem,
      (client, data: { inventorySlot: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const slot = data.inventorySlot;
        if (slot < 0 || slot >= INVENTORY_SIZE) return;

        const itemId = player.inventory[slot] ?? -1;
        if (itemId === -1) return;

        const category = getItemCategory(itemId);
        if (category < 0 || category >= EQUIPMENT_SLOTS) return;

        const currentEquipped = player.equipment[category] ?? -1;
        player.equipment[category] = itemId;
        player.inventory[slot] = currentEquipped;

        recalcPlayerStats(player);
      }
    );

    // Spawn permanent test portals in nexus (bottom area)
    this.spawnNexusTestPortals();

    // Start the authoritative game loop
    this.setSimulationInterval(
      (deltaTime) => this.gameLoop(deltaTime),
      TICK_INTERVAL
    );

    console.log("GameRoom created");
  }

  onJoin(client: Client, options: Record<string, unknown>) {
    const player = new Player();
    player.id = client.sessionId;
    player.name =
      (typeof options?.name === "string" ? options.name : "Player") || "Player";

    player.zone = "nexus";
    player.x = NEXUS_WIDTH / 2 + (Math.random() - 0.5) * 200;
    player.y = NEXUS_HEIGHT / 2 + 200 + (Math.random() - 0.5) * 200;
    player.level = 1;
    player.xp = 0;
    player.alive = true;

    player.equipment[ItemCategory.Weapon] = DEFAULT_WEAPON;
    player.equipment[ItemCategory.Ability] = DEFAULT_ABILITY;
    player.equipment[ItemCategory.Armor] = DEFAULT_ARMOR;
    player.equipment[ItemCategory.Ring] = DEFAULT_RING;

    recalcPlayerStats(player);
    player.hp = player.maxHp;
    player.mana = player.maxMana;

    this.state.players.set(client.sessionId, player);
    console.log(`${client.sessionId} joined as "${player.name}"`);
  }

  onLeave(client: Client, _consented: boolean) {
    this.state.players.delete(client.sessionId);
    this.removePlayerProjectiles(client.sessionId);

    console.log(`${client.sessionId} left`);

    if (this.state.players.size === 0) {
      this.state.enemies.clear();
      this.state.projectiles.clear();
      this.state.lootBags.clear();
      this.state.dungeonPortals.clear();
      this.spawnSystem.reset();
    }
  }

  onDispose() {
    console.log("GameRoom disposed");
  }

  private spawnNexusTestPortals(): void {
    // Infernal Pit test portal (left side of bottom nexus)
    const infernal = new DungeonPortal();
    infernal.id = generateId("nportal");
    infernal.x = 900;
    infernal.y = 2200;
    infernal.portalType = PortalType.InfernalPitEntrance;
    infernal.zone = "nexus";
    infernal.createdAt = 0; // never expires (DungeonSystem skips nexus portals)
    infernal.dungeonType = DungeonType.InfernalPit;
    this.state.dungeonPortals.set(infernal.id, infernal);

    // Void Sanctum test portal (right side of bottom nexus)
    const voidPortal = new DungeonPortal();
    voidPortal.id = generateId("nportal");
    voidPortal.x = 1500;
    voidPortal.y = 2200;
    voidPortal.portalType = PortalType.VoidSanctumEntrance;
    voidPortal.zone = "nexus";
    voidPortal.createdAt = 0;
    voidPortal.dungeonType = DungeonType.VoidSanctum;
    this.state.dungeonPortals.set(voidPortal.id, voidPortal);
  }

  private teleportPlayerToNexus(player: Player, client: Client): void {
    player.zone = "nexus";
    player.x = NEXUS_WIDTH / 2 + (Math.random() - 0.5) * 200;
    player.y = NEXUS_HEIGHT / 2 + 200 + (Math.random() - 0.5) * 200;
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    this.removePlayerProjectiles(player.id);
    client.send(ServerMessage.ZoneChanged, { zone: "nexus" });
  }

  private removePlayerProjectiles(playerId: string): void {
    const toRemove: string[] = [];
    this.state.projectiles.forEach((proj, id) => {
      if (proj.ownerId === playerId) toRemove.push(id);
    });
    for (const id of toRemove) {
      this.state.projectiles.delete(id);
    }
  }

  private gameLoop(deltaTime: number): void {
    // 1. Process player movement and shooting
    this.state.players.forEach((player) => {
      if (!player.alive) return;

      const isNexus = player.zone === "nexus";
      const dims = getZoneDimensions(player.zone);
      const zoneW = dims.width;
      const zoneH = dims.height;

      const inputCount = player.pendingInputs.length;

      if (inputCount > 0) {
        player.pendingInputs.sort((a, b) => a.seq - b.seq);

        const now = Date.now();
        let effectiveSpeed = player.cachedSpeed;
        if (player.speedBoostUntil > 0 && now < player.speedBoostUntil) {
          effectiveSpeed = player.cachedSpeed + player.speedBoostAmount;
        } else if (player.speedBoostUntil > 0) {
          player.speedBoostUntil = 0;
          player.speedBoostAmount = 0;
        }

        // Get dungeon map for wall collision (if in dungeon)
        const dungeonMap = isDungeonZone(player.zone)
          ? this.dungeonSystem.getDungeonMap(player.zone)
          : undefined;

        for (const input of player.pendingInputs) {
          const result = applyMovement(
            player.x,
            player.y,
            input.movementX,
            input.movementY,
            effectiveSpeed,
            input.dt,
            PLAYER_RADIUS,
            zoneW,
            zoneH
          );
          player.x = result.x;
          player.y = result.y;

          // Wall collision in dungeons
          if (dungeonMap) {
            const wallResult = resolveWallCollision(player.x, player.y, PLAYER_RADIUS, dungeonMap);
            player.x = wallResult.x;
            player.y = wallResult.y;
          }

          player.aimAngle = input.aimAngle;
          player.inputShooting = input.shooting;
          player.inputUseAbility = input.useAbility;
          player.lastProcessedInput = input.seq;
        }

        player.pendingInputs.length = 0;
      }

      // Handle shooting (only outside nexus)
      if (!isNexus && player.inputShooting) {
        const now = Date.now();
        if (now - player.lastShootTime >= player.cachedShootCooldown) {
          player.lastShootTime = now;

          const weaponId = player.equipment[ItemCategory.Weapon] ?? -1;
          const weaponDef = weaponId >= 0 ? ITEM_DEFS[weaponId] : null;
          const isSword = weaponId >= 0 && getItemSubtype(weaponId) === WeaponSubtype.Sword;

          const projectileCount = weaponDef?.weaponStats?.projectileCount ?? 1;
          const spreadAngle = weaponDef?.weaponStats?.spreadAngle ?? 0;

          for (let p = 0; p < projectileCount; p++) {
            let angle = player.aimAngle;
            if (projectileCount > 1 && spreadAngle > 0) {
              const startAngle = player.aimAngle - spreadAngle / 2;
              angle = startAngle + (spreadAngle / (projectileCount - 1)) * p;
            }

            const proj = new Projectile();
            proj.id = generateId("pproj");
            proj.x = player.x;
            proj.y = player.y;
            proj.angle = angle;
            proj.ownerType = EntityType.Player;
            proj.ownerId = player.id;
            proj.speed = player.cachedWeaponProjSpeed;
            proj.damage = player.cachedDamage;
            proj.startX = player.x;
            proj.startY = player.y;
            proj.maxRange = player.cachedWeaponRange;
            proj.collisionRadius = player.cachedWeaponProjSize;
            proj.projType = isSword ? ProjectileType.SwordSlash : ProjectileType.BowArrow;
            proj.piercing = false;
            proj.zone = player.zone;

            this.state.projectiles.set(proj.id, proj);
          }
        }
      }

      // Handle ability (Space key, only outside nexus)
      if (!isNexus && player.inputUseAbility) {
        const now = Date.now();
        const abilityId = player.equipment[ItemCategory.Ability] ?? -1;
        if (abilityId >= 0) {
          const abilityDef = ITEM_DEFS[abilityId];
          const as = abilityDef?.abilityStats;
          if (as && now - player.lastAbilityTime >= as.cooldown) {
            if (player.mana >= as.manaCost) {
              player.mana -= as.manaCost;
              player.lastAbilityTime = now;

              const proj = new Projectile();
              proj.id = generateId("aproj");
              proj.x = player.x;
              proj.y = player.y;
              proj.angle = player.aimAngle;
              proj.ownerType = EntityType.Player;
              proj.ownerId = player.id;
              proj.speed = as.projectileSpeed;
              proj.damage = as.damage;
              proj.startX = player.x;
              proj.startY = player.y;
              proj.maxRange = as.range;
              proj.collisionRadius = as.projectileSize;
              proj.projType = ProjectileType.QuiverShot;
              proj.piercing = as.piercing;
              proj.zone = player.zone;

              this.state.projectiles.set(proj.id, proj);

              if (as.speedBoostAmount && as.speedBoostDuration) {
                player.speedBoostAmount = as.speedBoostAmount;
                player.speedBoostUntil = now + as.speedBoostDuration;
              }
            }
          }
        }
      }
    });

    // 2. Run enemy AI (pass dungeon maps for wall collision)
    const dungeonMaps = new Map<string, import("@rotmg-lite/shared").DungeonMapData>();
    for (const zone of ["dungeon_infernal", "dungeon_void"]) {
      const mapData = this.dungeonSystem.getDungeonMap(zone);
      if (mapData) dungeonMaps.set(zone, mapData);
    }
    this.enemyAI.update(deltaTime, this.state, this.shootingSystem, dungeonMaps);

    // 2b. The Architect minion spawning
    const now = Date.now();
    this.state.enemies.forEach((enemy) => {
      if (
        enemy.enemyType === EnemyType.TheArchitect &&
        enemy.isBoss &&
        enemy.aiState === EnemyAIState.Aggro
      ) {
        const minionCooldown = enemy.bossPhase === 2 ? 2000 : 4000;
        if (now - enemy.lastMinionSpawnTime >= minionCooldown) {
          enemy.lastMinionSpawnTime = now;
          this.dungeonSystem.spawnVoidMinion(
            enemy.x,
            enemy.y,
            enemy.zone,
            this.state
          );
        }
      }
    });

    // 3. Run combat (pass dungeon maps for projectile-wall collision)
    const events = this.combatSystem.update(deltaTime, this.state, dungeonMaps);

    // 4. Process combat events
    for (const event of events) {
      if (event.type === "playerDied" && event.playerId) {
        const player = this.state.players.get(event.playerId);
        const client = this.clients.find(
          (c) => c.sessionId === event.playerId
        );
        if (player && client) {
          client.send(ServerMessage.PlayerDied, {});
        }
      } else if (event.type === "enemyKilled") {
        const zone = event.enemyZone ?? "hostile";

        if (zone === "hostile" && event.biome !== undefined) {
          // Overworld kill: respawn + loot + dungeon portal chance
          this.spawnSystem.onEnemyKilled(event.biome);

          if (event.enemyX !== undefined && event.enemyY !== undefined) {
            const bagRarity = rollBagDrop(event.biome);
            if (bagRarity >= 0) {
              const loot = rollBagLoot(bagRarity, event.biome);
              this.spawnLootBag(event.enemyX, event.enemyY, bagRarity, loot, "hostile");
            }

            // Roll for dungeon portal spawn
            this.dungeonSystem.trySpawnDungeonPortal(
              event.biome,
              event.enemyX,
              event.enemyY,
              this.state
            );
          }
        } else if (isDungeonZone(zone)) {
          // Dungeon kill
          if (event.isBoss && event.enemyX !== undefined && event.enemyY !== undefined) {
            // Boss killed: guaranteed good loot + exit portal
            const dungeonType = ZONE_TO_DUNGEON[zone];
            if (dungeonType !== undefined) {
              const bossLoot = rollBossLoot(dungeonType);
              this.spawnLootBag(
                event.enemyX,
                event.enemyY,
                bossLoot.bagRarity,
                bossLoot.items,
                zone
              );

              // Find return position and zone from any player in this dungeon
              let returnX = ARENA_CENTER_X;
              let returnY = ARENA_CENTER_Y;
              let returnZone = "hostile";
              this.state.players.forEach((p) => {
                if (p.zone === zone) {
                  returnX = p.dungeonReturnX;
                  returnY = p.dungeonReturnY;
                  returnZone = p.dungeonReturnZone || "hostile";
                }
              });

              this.dungeonSystem.spawnExitPortal(
                event.enemyX,
                event.enemyY,
                zone,
                returnX,
                returnY,
                returnZone,
                this.state
              );
            }
          }
          // Dungeon enemies do NOT respawn
        }
      }
    }

    // 5. Run spawn system
    this.spawnSystem.update(deltaTime, this.state);

    // 5b. Run dungeon system (portal despawn, cleanup)
    this.dungeonSystem.update(deltaTime, this.state);

    // 6. HP Regeneration
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      if (player.cachedHpRegen > 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + player.cachedHpRegen * (deltaTime / 1000));
      }
    });

    // 7. Mana Regeneration
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      if (player.cachedManaRegen > 0 && player.mana < player.maxMana) {
        player.mana = Math.min(player.maxMana, player.mana + player.cachedManaRegen * (deltaTime / 1000));
      }
    });

    // 8. Bag despawn
    const bagsToRemove: string[] = [];
    this.state.lootBags.forEach((bag, id) => {
      if (now - bag.createdAt > BAG_LIFETIME) {
        bagsToRemove.push(id);
      }
    });
    for (const id of bagsToRemove) {
      this.state.players.forEach((p) => {
        if (p.openBagId === id) {
          p.openBagId = "";
          const c = this.clients.find((cl) => cl.sessionId === p.id);
          if (c) c.send(ServerMessage.BagClosed, {});
        }
      });
      this.state.lootBags.delete(id);
    }

    // 9. Bag proximity detection
    this.state.players.forEach((player) => {
      if (!player.alive || player.zone === "nexus") {
        if (player.openBagId) {
          player.openBagId = "";
          const client = this.clients.find((c) => c.sessionId === player.id);
          if (client) client.send(ServerMessage.BagClosed, {});
        }
        return;
      }

      let closestBagId = "";
      let closestDist = BAG_PICKUP_RADIUS + 1;
      this.state.lootBags.forEach((bag) => {
        if (bag.zone !== player.zone) return;
        const dist = distanceBetween(player.x, player.y, bag.x, bag.y);
        if (dist <= BAG_PICKUP_RADIUS && dist < closestDist) {
          closestDist = dist;
          closestBagId = bag.id;
        }
      });

      if (closestBagId !== player.openBagId) {
        const client = this.clients.find((c) => c.sessionId === player.id);
        if (!client) return;

        if (closestBagId) {
          player.openBagId = closestBagId;
          client.send(ServerMessage.BagOpened, { bagId: closestBagId });
        } else {
          player.openBagId = "";
          client.send(ServerMessage.BagClosed, {});
        }
      }
    });

    // 10. Periodically mark entities dirty for filterChildren
    this.tickCount++;
    if (this.tickCount >= FILTER_REFRESH_INTERVAL) {
      this.tickCount = 0;
      this.state.enemies.forEach((enemy) => {
        enemy.x = enemy.x;
      });
      this.state.lootBags.forEach((bag) => {
        bag.x = bag.x;
      });
      this.state.dungeonPortals.forEach((portal) => {
        portal.x = portal.x;
      });
    }
  }

  private spawnLootBag(
    x: number,
    y: number,
    bagRarity: number,
    itemTypes: number[],
    zone: string = "hostile"
  ): void {
    const bag = new LootBag();
    bag.id = generateId("bag");
    bag.x = x;
    bag.y = y;
    bag.bagRarity = bagRarity;
    bag.createdAt = Date.now();
    bag.zone = zone;

    for (let i = 0; i < BAG_SIZE; i++) {
      const item = new LootBagItem();
      item.itemType = i < itemTypes.length ? itemTypes[i] : -1;
      bag.items.push(item);
    }

    this.state.lootBags.set(bag.id, bag);
  }

  private broadcastBagUpdate(bag: LootBag): void {
    const items = bag.items.map((item) => item.itemType);
    this.state.players.forEach((p) => {
      if (p.openBagId !== bag.id) return;
      const c = this.clients.find((cl) => cl.sessionId === p.id);
      if (c) {
        c.send(ServerMessage.BagUpdated, {
          bagId: bag.id,
          items,
        });
      }
    });
  }
}
