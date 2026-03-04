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
import { ItemInstance, schemaToItemData, itemDataToSchema, updateSchemaFromData, createEmptyItemSchema } from "../schemas/ItemInstance";
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
  CraftingOrbType,
  TICK_INTERVAL,
  PLAYER_RADIUS,
  ROAD_SPEED_MULTIPLIER,
  RIVER_SPEED_MULTIPLIER,
  HOSTILE_CENTER_X,
  HOSTILE_CENTER_Y,
  PORTAL_X,
  PORTAL_Y,
  PORTAL_RADIUS,
  DUNGEON_PORTAL_INTERACT_RADIUS,
  INVENTORY_SIZE,
  EQUIPMENT_SLOTS,
  BAG_SIZE,
  BAG_PICKUP_RADIUS,
  BAG_LIFETIME,
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
  rollBossLootWithRarity,
  isDungeonZone,
  DUNGEON_TO_ZONE,
  ZONE_TO_DUNGEON,
  resolveWallCollision,
  resolveHostileCollision,
  resolveDecorationCollision,
  loadRealmMapFromJSON,
  setRealmMap,
  getRealmMap,
  isRoadAt,
  isRiverAt,
  isWaterTile,
  generateDungeonStats,
  generateNexusMap,
  getPackDef,
  isConsumableItem,
  isCraftingOrbItem,
  getConsumableSlotIndex,
  CONSUMABLE_MAX_STACKS,
  HEALTH_POT_HEAL,
  MANA_POT_RESTORE,
  HOSTILE_WIDTH,
  HOSTILE_HEIGHT,
  PORTAL_GEM_INVULN_MS,
  generateItemInstance,
  generateConsumableInstance,
  isEmptyItem,
  ItemInstanceData,
  createEmptyItemInstance,
  applyCraftingOrb,
  getScaledWeaponStats,
  getScaledAbilityStats,
} from "@rotmg-lite/shared";
import type { DungeonMapData } from "@rotmg-lite/shared";
import * as fs from "fs";
import * as path from "path";
import { ArraySchema } from "@colyseus/schema";

// How often (in ticks) to force-touch enemy positions for filterChildren re-evaluation.
const FILTER_REFRESH_INTERVAL = 2; // every 2 ticks (100ms at 20Hz)

/** Recalculate all player stats from level + equipment. */
function recalcPlayerStats(player: Player): void {
  const eq: ItemInstanceData[] = [];
  for (let i = 0; i < EQUIPMENT_SLOTS; i++) {
    const slot = player.equipment[i];
    eq.push(slot ? schemaToItemData(slot) : createEmptyItemInstance());
  }
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
  private nexusMap: DungeonMapData = generateNexusMap();
  private tickCount = 0;
  private filterFlip = false;

  onCreate(_options: Record<string, unknown>) {
    this.setState(new GameState());

    // Load realm map data for hostile zone
    this.loadRealmMap();

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
          player.invulnerable = true;
          player.invulnerableSince = Date.now();
          player.zone = "hostile";
          const spawnPos = this.getHostileSpawnPosition();
          player.x = spawnPos.x;
          player.y = spawnPos.y;
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
              this.state,
              {
                modifierIds: Array.from(portal.modifierIds) as number[],
                modifierTiers: Array.from(portal.modifierTiers) as number[],
                lootRarityBoost: portal.lootRarityBoost,
                lootQuantityBoost: portal.lootQuantityBoost,
              }
            );
          }

          // Teleport player to dungeon start (position from generated map)
          player.invulnerable = true;
          player.invulnerableSince = Date.now();
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
          player.invulnerable = true;
          player.invulnerableSince = Date.now();
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

    // Client signals loading screen is done — remove invulnerability
    this.onMessage(ClientMessage.ZoneReady, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.invulnerable = false;
    });

    // Listen for item pickup from loot bag
    this.onMessage(
      ClientMessage.PickupItem,
      (client, data: { bagId: string; slotIndex: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const bag = this.state.lootBags.get(data.bagId);
        if (!bag) return;

        if (distanceBetween(player.x, player.y, bag.x, bag.y) > BAG_PICKUP_RADIUS) return;

        const slotIndex = data.slotIndex;
        if (slotIndex < 0 || slotIndex >= bag.items.length) return;
        const bagItem = bag.items[slotIndex];
        if (!bagItem || bagItem.item.baseItemId === -1) return;

        const itemData = schemaToItemData(bagItem.item);
        const itemId = itemData.baseItemId;

        // Consumable items go to dedicated slots
        if (isConsumableItem(itemId)) {
          if (!this.addConsumableToPlayer(player, itemId)) return;
          updateSchemaFromData(bagItem.item, createEmptyItemInstance());
        }
        // Crafting orbs go to orb counter
        else if (isCraftingOrbItem(itemId)) {
          const orbType = getItemSubtype(itemId);
          this.addOrbToPlayer(player, orbType);
          updateSchemaFromData(bagItem.item, createEmptyItemInstance());
        }
        // Equipment goes to inventory
        else {
          let emptySlot = -1;
          for (let i = 0; i < player.inventory.length; i++) {
            if (player.inventory[i]!.baseItemId === -1) {
              emptySlot = i;
              break;
            }
          }
          if (emptySlot === -1) return;

          updateSchemaFromData(player.inventory[emptySlot]!, itemData);
          updateSchemaFromData(bagItem.item, createEmptyItemInstance());
        }

        const allEmpty = bag.items.every((item) => item.item.baseItemId === -1);
        if (allEmpty) {
          this.state.lootBags.delete(bag.id);
          this.state.players.forEach((p) => {
            if (p.openBagId === bag.id) {
              p.openBagId = "";
              const c = this.clients.find((cl) => cl.sessionId === p.id);
              if (c) c.send(ServerMessage.BagClosed, {});
            }
          });
        }
      }
    );

    // Listen for item drop from inventory
    this.onMessage(
      ClientMessage.DropItem,
      (client, data: { slotIndex: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const slotIndex = data.slotIndex;
        if (slotIndex < 0 || slotIndex >= INVENTORY_SIZE) return;
        const invItem = player.inventory[slotIndex];
        if (!invItem || invItem.baseItemId === -1) return;

        const itemData = schemaToItemData(invItem);
        updateSchemaFromData(invItem, createEmptyItemInstance());

        if (player.openBagId) {
          const openBag = this.state.lootBags.get(player.openBagId);
          if (openBag) {
            const emptySlot = openBag.items.findIndex((item) => item.item.baseItemId === -1);
            if (emptySlot !== -1) {
              updateSchemaFromData(openBag.items[emptySlot]!.item, itemData);
              return;
            }
          }
        }

        this.spawnLootBag(player.x, player.y, BagRarity.Green, [itemData], player.zone);
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

        const invItem = player.inventory[slot];
        if (!invItem || invItem.baseItemId === -1) return;
        const itemId = invItem.baseItemId;

        // Consumable: move from inventory to dedicated slot
        if (isConsumableItem(itemId)) {
          const slotIdx = getConsumableSlotIndex(itemId);
          const maxStack = CONSUMABLE_MAX_STACKS[slotIdx];
          const current = this.getConsumableCount(player, slotIdx);
          if (current >= maxStack) return;
          this.setConsumableCount(player, slotIdx, current + 1);
          updateSchemaFromData(invItem, createEmptyItemInstance());
          return;
        }

        // Crafting orb: add to orb counter
        if (isCraftingOrbItem(itemId)) {
          const orbType = getItemSubtype(itemId);
          this.addOrbToPlayer(player, orbType);
          updateSchemaFromData(invItem, createEmptyItemInstance());
          return;
        }

        const category = getItemCategory(itemId);
        if (category < 0 || category >= EQUIPMENT_SLOTS) return;

        // Swap equipment and inventory
        const currentEquipped = schemaToItemData(player.equipment[category]!);
        const newEquip = schemaToItemData(invItem);
        updateSchemaFromData(player.equipment[category]!, newEquip);
        updateSchemaFromData(player.inventory[slot]!, currentEquipped);

        recalcPlayerStats(player);
      }
    );

    // Listen for health potion use (F key)
    this.onMessage(ClientMessage.UseHealthPot, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;
      if (player.healthPots <= 0) return;
      if (player.hp >= player.maxHp) return;
      player.healthPots--;
      player.hp = Math.min(player.maxHp, player.hp + HEALTH_POT_HEAL);
    });

    // Listen for mana potion use (G key)
    this.onMessage(ClientMessage.UseManaPot, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;
      if (player.manaPots <= 0) return;
      if (player.mana >= player.maxMana) return;
      player.manaPots--;
      player.mana = Math.min(player.maxMana, player.mana + MANA_POT_RESTORE);
    });

    // Listen for portal gem use (right-click minimap → teleport)
    this.onMessage(
      ClientMessage.UsePortalGem,
      (client, data: { targetX: number; targetY: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (player.zone !== "hostile") return;
        if (player.portalGems <= 0) return;
        const { targetX, targetY } = data;
        if (
          typeof targetX !== "number" || typeof targetY !== "number" ||
          targetX < 0 || targetX >= HOSTILE_WIDTH ||
          targetY < 0 || targetY >= HOSTILE_HEIGHT
        ) return;
        player.portalGems--;
        player.x = targetX;
        player.y = targetY;
        player.invulnerable = true;
        player.invulnerableSince = Date.now();
        player.invulnerableUntil = Date.now() + PORTAL_GEM_INVULN_MS;
        this.removePlayerProjectiles(player.id);
      }
    );

    // Listen for crafting orb use
    this.onMessage(
      ClientMessage.UseCraftingOrb,
      (client, data: { orbType: number; location: "inventory" | "equipment"; slotIndex: number; forgeSlotIndex?: number }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const orbType = data.orbType;
        if (orbType < 0 || orbType > 7) return;
        if (!player.unlimitedOrbs && this.getOrbCount(player, orbType) <= 0) return;

        // Get target item
        let targetSchema: ItemInstance | undefined;
        if (data.location === "equipment") {
          if (data.slotIndex < 0 || data.slotIndex >= EQUIPMENT_SLOTS) return;
          targetSchema = player.equipment[data.slotIndex];
        } else {
          if (data.slotIndex < 0 || data.slotIndex >= INVENTORY_SIZE) return;
          targetSchema = player.inventory[data.slotIndex];
        }
        if (!targetSchema || targetSchema.baseItemId === -1) return;

        const itemData = schemaToItemData(targetSchema);
        const result = applyCraftingOrb(orbType, itemData, data.forgeSlotIndex);

        if (result.success) {
          if (!player.unlimitedOrbs) {
            this.setOrbCount(player, orbType, this.getOrbCount(player, orbType) - 1);
          }
          updateSchemaFromData(targetSchema, result.item);
          // Recalc stats if equipped item was modified
          if (data.location === "equipment") {
            recalcPlayerStats(player);
          }
        }
      }
    );

    // TESTING: Toggle unlimited crafting orbs
    this.onMessage(ClientMessage.ToggleUnlimitedOrbs, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.unlimitedOrbs = !player.unlimitedOrbs;
    });

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
    player.x = this.nexusMap.spawnRoom.centerX + (Math.random() - 0.5) * 80;
    player.y = this.nexusMap.spawnRoom.centerY + (Math.random() - 0.5) * 80;
    player.level = 1;
    player.xp = 0;
    player.alive = true;

    // Default equipment: T1 items with random locked stat tiers (no pre-rolled open stats)
    updateSchemaFromData(player.equipment[ItemCategory.Weapon]!, generateItemInstance(ItemCategory.Weapon, WeaponSubtype.Bow, 1, false));
    updateSchemaFromData(player.equipment[ItemCategory.Ability]!, generateItemInstance(ItemCategory.Ability, 0, 1, false));
    updateSchemaFromData(player.equipment[ItemCategory.Armor]!, generateItemInstance(ItemCategory.Armor, 0, 1, false));
    updateSchemaFromData(player.equipment[ItemCategory.Ring]!, generateItemInstance(ItemCategory.Ring, 0, 1, false));

    // Starting consumables
    player.healthPots = 3;
    player.manaPots = 3;
    player.portalGems = 5;

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
    const testRoom = this.nexusMap.rooms[2]; // south room (dungeon test portals)

    // Infernal Pit test portal (left side of test room)
    const infernal = new DungeonPortal();
    infernal.id = generateId("nportal");
    infernal.x = testRoom.centerX - 80;
    infernal.y = testRoom.centerY + 20;
    infernal.portalType = PortalType.InfernalPitEntrance;
    infernal.zone = "nexus";
    infernal.createdAt = 0; // never expires (DungeonSystem skips nexus portals)
    infernal.dungeonType = DungeonType.InfernalPit;
    const infernalStats = generateDungeonStats();
    infernal.modifierIds = new ArraySchema<number>(...infernalStats.modifierIds);
    infernal.lootRarityBoost = infernalStats.lootRarityBoost;
    infernal.lootQuantityBoost = infernalStats.lootQuantityBoost;
    infernal.modifierTiers = new ArraySchema<number>(...infernalStats.modifierTiers);
    this.state.dungeonPortals.set(infernal.id, infernal);

    // Void Sanctum test portal (right side of test room)
    const voidPortal = new DungeonPortal();
    voidPortal.id = generateId("nportal");
    voidPortal.x = testRoom.centerX + 80;
    voidPortal.y = testRoom.centerY + 20;
    voidPortal.portalType = PortalType.VoidSanctumEntrance;
    voidPortal.zone = "nexus";
    voidPortal.createdAt = 0;
    voidPortal.dungeonType = DungeonType.VoidSanctum;
    const voidStats = generateDungeonStats();
    voidPortal.modifierIds = new ArraySchema<number>(...voidStats.modifierIds);
    voidPortal.lootRarityBoost = voidStats.lootRarityBoost;
    voidPortal.lootQuantityBoost = voidStats.lootQuantityBoost;
    voidPortal.modifierTiers = new ArraySchema<number>(...voidStats.modifierTiers);
    this.state.dungeonPortals.set(voidPortal.id, voidPortal);
  }

  private getConsumableCount(player: Player, slotIndex: number): number {
    if (slotIndex === 0) return player.healthPots;
    if (slotIndex === 1) return player.manaPots;
    return player.portalGems;
  }

  private setConsumableCount(player: Player, slotIndex: number, count: number): void {
    if (slotIndex === 0) player.healthPots = count;
    else if (slotIndex === 1) player.manaPots = count;
    else player.portalGems = count;
  }

  /** Try to add a consumable to dedicated slot. */
  private addConsumableToPlayer(player: Player, itemId: number): boolean {
    const slotIdx = getConsumableSlotIndex(itemId);
    const maxStack = CONSUMABLE_MAX_STACKS[slotIdx];

    const current = this.getConsumableCount(player, slotIdx);
    if (current < maxStack) {
      this.setConsumableCount(player, slotIdx, current + 1);
      return true;
    }

    return false;
  }

  /** Add a crafting orb to the player's orb counter. */
  private addOrbToPlayer(player: Player, orbType: number): void {
    const current = this.getOrbCount(player, orbType);
    this.setOrbCount(player, orbType, current + 1);
  }

  private getOrbCount(player: Player, orbType: number): number {
    switch (orbType) {
      case CraftingOrbType.Blank: return player.orbBlank;
      case CraftingOrbType.Ember: return player.orbEmber;
      case CraftingOrbType.Shard: return player.orbShard;
      case CraftingOrbType.Chaos: return player.orbChaos;
      case CraftingOrbType.Flux: return player.orbFlux;
      case CraftingOrbType.Void: return player.orbVoid;
      case CraftingOrbType.Prism: return player.orbPrism;
      case CraftingOrbType.Forge: return player.orbForge;
      default: return 0;
    }
  }

  private setOrbCount(player: Player, orbType: number, count: number): void {
    const val = Math.max(0, Math.min(99, count));
    switch (orbType) {
      case CraftingOrbType.Blank: player.orbBlank = val; break;
      case CraftingOrbType.Ember: player.orbEmber = val; break;
      case CraftingOrbType.Shard: player.orbShard = val; break;
      case CraftingOrbType.Chaos: player.orbChaos = val; break;
      case CraftingOrbType.Flux: player.orbFlux = val; break;
      case CraftingOrbType.Void: player.orbVoid = val; break;
      case CraftingOrbType.Prism: player.orbPrism = val; break;
      case CraftingOrbType.Forge: player.orbForge = val; break;
    }
  }

  private teleportPlayerToNexus(player: Player, client: Client): void {
    player.invulnerable = true;
    player.invulnerableSince = Date.now();
    player.zone = "nexus";
    player.x = this.nexusMap.spawnRoom.centerX + (Math.random() - 0.5) * 80;
    player.y = this.nexusMap.spawnRoom.centerY + (Math.random() - 0.5) * 80;
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    this.removePlayerProjectiles(player.id);
    client.send(ServerMessage.ZoneChanged, { zone: "nexus" });
  }

  private loadRealmMap(): void {
    try {
      // Try multiple possible paths for the realm map data
      const candidates = [
        path.resolve(__dirname, "../../../shared/data/realm-map.json"),
        path.resolve(__dirname, "../../shared/data/realm-map.json"),
        path.resolve(process.cwd(), "packages/shared/data/realm-map.json"),
      ];
      let loaded = false;
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const json = fs.readFileSync(filePath, "utf-8");
          const mapData = loadRealmMapFromJSON(json);
          setRealmMap(mapData);
          console.log(
            `[GameRoom] Loaded realm map: ${mapData.width}x${mapData.height} tiles, seed=${mapData.seed}`
          );
          loaded = true;
          break;
        }
      }
      if (!loaded) {
        console.warn(
          "[GameRoom] No realm-map.json found. Run 'npm run generate:map' to generate one."
        );
      }
    } catch (err) {
      console.error("[GameRoom] Failed to load realm map:", err);
    }
  }

  private getHostileSpawnPosition(): { x: number; y: number } {
    const map = getRealmMap();
    if (map && map.spawnPoints.length > 0) {
      const sp = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)];
      return {
        x: sp.x + (Math.random() - 0.5) * 200,
        y: sp.y + (Math.random() - 0.5) * 200,
      };
    }
    // Fallback to legacy center
    return {
      x: HOSTILE_CENTER_X + (Math.random() - 0.5) * 200,
      y: HOSTILE_CENTER_Y + (Math.random() - 0.5) * 200,
    };
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

        // Get map for wall collision (nexus + dungeons)
        const dungeonMap = isDungeonZone(player.zone)
          ? this.dungeonSystem.getDungeonMap(player.zone)
          : player.zone === "nexus"
            ? this.nexusMap
            : undefined;

        for (const input of player.pendingInputs) {
          // Terrain speed modifiers in hostile zone
          let inputSpeed = effectiveSpeed;
          if (player.zone === "hostile") {
            if (isRoadAt(player.x, player.y)) {
              inputSpeed *= ROAD_SPEED_MULTIPLIER;
            } else if (isRiverAt(player.x, player.y)) {
              inputSpeed *= RIVER_SPEED_MULTIPLIER;
            }
          }

          const result = applyMovement(
            player.x,
            player.y,
            input.movementX,
            input.movementY,
            inputSpeed,
            input.dt,
            PLAYER_RADIUS,
            zoneW,
            zoneH
          );
          player.x = result.x;
          player.y = result.y;

          // Wall collision in dungeons / nexus
          if (dungeonMap) {
            const wallResult = resolveWallCollision(player.x, player.y, PLAYER_RADIUS, dungeonMap);
            player.x = wallResult.x;
            player.y = wallResult.y;
          }

          // Water collision in hostile zone
          if (player.zone === "hostile" && getRealmMap()) {
            const waterResult = resolveHostileCollision(player.x, player.y, PLAYER_RADIUS);
            player.x = waterResult.x;
            player.y = waterResult.y;
          }

          // Decoration collision in hostile zone (trees, large rocks, cacti, ruins)
          if (player.zone === "hostile" && getRealmMap()) {
            const decoResult = resolveDecorationCollision(player.x, player.y, PLAYER_RADIUS);
            player.x = decoResult.x;
            player.y = decoResult.y;
          }

          player.aimAngle = input.aimAngle;
          player.inputShooting = input.shooting;
          player.inputUseAbility = input.useAbility;
          player.lastProcessedInput = input.seq;
        }

        player.pendingInputs.length = 0;
      }

      // Handle shooting
      if (player.inputShooting) {
        const now = Date.now();
        if (now - player.lastShootTime >= player.cachedShootCooldown) {
          player.lastShootTime = now;

          const weaponSchema = player.equipment[ItemCategory.Weapon];
          const hasWeapon = weaponSchema && weaponSchema.baseItemId >= 0;
          const isSword = hasWeapon && getItemSubtype(weaponSchema.baseItemId) === WeaponSubtype.Sword;

          // Multi-projectile and spread only for UT weapons (e.g. Doom Blade)
          let projectileCount = 1;
          let spreadAngle = 0;
          if (hasWeapon && weaponSchema.isUT) {
            const weaponDef = ITEM_DEFS[weaponSchema.baseItemId];
            projectileCount = weaponDef?.weaponStats?.projectileCount ?? 1;
            spreadAngle = weaponDef?.weaponStats?.spreadAngle ?? 0;
          }

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

      // Handle ability (Space key)
      if (player.inputUseAbility) {
        const now = Date.now();
        const abilitySchema = player.equipment[ItemCategory.Ability];
        if (abilitySchema && abilitySchema.baseItemId >= 0) {
          // Get ability stats based on UT or tiered
          let abilityDamage: number, abilityRange: number, abilityProjSpeed: number;
          let abilityProjSize: number, abilityManaCost: number, abilityCooldown: number;
          let abilityPiercing = true;
          let speedBoostAmt: number | undefined, speedBoostDur: number | undefined;

          if (abilitySchema.isUT) {
            const def = ITEM_DEFS[abilitySchema.baseItemId];
            const as = def?.abilityStats;
            if (!as) return;
            abilityDamage = as.damage;
            abilityRange = as.range;
            abilityProjSpeed = as.projectileSpeed;
            abilityProjSize = as.projectileSize;
            abilityManaCost = as.manaCost;
            abilityCooldown = as.cooldown;
            abilityPiercing = as.piercing;
            speedBoostAmt = as.speedBoostAmount;
            speedBoostDur = as.speedBoostDuration;
          } else {
            const subtype = getItemSubtype(abilitySchema.baseItemId);
            const scaled = getScaledAbilityStats(subtype, abilitySchema.instanceTier);
            abilityDamage = scaled.damage;
            abilityRange = scaled.range;
            abilityProjSpeed = scaled.projectileSpeed;
            abilityProjSize = scaled.projectileSize;
            abilityManaCost = scaled.manaCost;
            abilityCooldown = scaled.cooldown;
            abilityPiercing = scaled.piercing;
          }

          if (now - player.lastAbilityTime >= abilityCooldown) {
            if (player.mana >= abilityManaCost) {
              player.mana -= abilityManaCost;
              player.lastAbilityTime = now;

              const proj = new Projectile();
              proj.id = generateId("aproj");
              proj.x = player.x;
              proj.y = player.y;
              proj.angle = player.aimAngle;
              proj.ownerType = EntityType.Player;
              proj.ownerId = player.id;
              proj.speed = abilityProjSpeed;
              proj.damage = abilityDamage;
              proj.startX = player.x;
              proj.startY = player.y;
              proj.maxRange = abilityRange;
              proj.collisionRadius = abilityProjSize;
              proj.projType = ProjectileType.QuiverShot;
              proj.piercing = abilityPiercing;
              proj.zone = player.zone;

              this.state.projectiles.set(proj.id, proj);

              if (speedBoostAmt && speedBoostDur) {
                player.speedBoostAmount = speedBoostAmt;
                player.speedBoostUntil = now + speedBoostDur;
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
    this.enemyAI.update(
      deltaTime,
      this.state,
      this.shootingSystem,
      dungeonMaps,
      (baseDef, zone) => this.dungeonSystem.getModifiedEnemyDef(baseDef, zone)
    );

    // 2b. The Architect minion spawning (scales across 3 phases)
    const now = Date.now();
    this.state.enemies.forEach((enemy) => {
      if (
        enemy.enemyType === EnemyType.TheArchitect &&
        enemy.isBoss &&
        enemy.aiState === EnemyAIState.Aggro
      ) {
        let minionCooldown: number;
        if (enemy.bossPhase === 3) minionCooldown = 1500;
        else if (enemy.bossPhase === 2) minionCooldown = 3000;
        else if (enemy.bossPhase === 1) minionCooldown = 5000;
        else minionCooldown = 999999; // Phase 0 (sleeping): no minions
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

    // 2c. Pack leader minion respawn (overworld packs)
    this.state.enemies.forEach((enemy) => {
      if (!enemy.isPackLeader || enemy.zone !== "hostile" || enemy.aiState !== EnemyAIState.Aggro) return;
      const packDef = getPackDef(enemy.enemyType);
      if (!packDef) return;
      if (now - enemy.lastMinionSpawnTime < packDef.respawnCooldown) return;

      // Count alive minions for this leader
      let aliveMinions = 0;
      this.state.enemies.forEach((other) => {
        if (other.packLeaderId === enemy.id) aliveMinions++;
      });

      if (aliveMinions < packDef.minionCount) {
        enemy.lastMinionSpawnTime = now;
        this.spawnSystem.spawnPackMinion(
          enemy.x,
          enemy.y,
          enemy.id,
          packDef.minionType,
          this.state
        );
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
          this.spawnSystem.onEnemyKilled(event.biome, event.enemyX!, event.enemyY!, event.enemyId);

          if (event.enemyX !== undefined && event.enemyY !== undefined) {
            const bagRarity = rollBagDrop(event.biome);
            if (bagRarity >= 0) {
              const lootItems = rollBagLoot(bagRarity, event.biome);
              this.spawnLootBag(event.enemyX, event.enemyY, bagRarity, lootItems, "hostile");
            }

            // Roll for dungeon portal spawn (only specific Godlands enemies)
            this.dungeonSystem.trySpawnDungeonPortal(
              event.biome,
              event.enemyX,
              event.enemyY,
              this.state,
              event.enemyType
            );
          }
        } else if (isDungeonZone(zone)) {
          // Dungeon kill: check for switch destruction
          if (event.enemyType === EnemyType.VoidSwitch) {
            const remaining = this.dungeonSystem.onSwitchDestroyed(zone, this.state);
            // Notify all players in the dungeon
            this.state.players.forEach((p) => {
              if (p.zone === zone) {
                const c = this.clients.find((cl) => cl.sessionId === p.id);
                if (c) {
                  c.send(ServerMessage.SwitchDestroyed, { remaining });
                }
              }
            });
          }

          if (event.isBoss && event.enemyX !== undefined && event.enemyY !== undefined) {
            // Boss killed: guaranteed good loot + exit portal
            const dungeonType = ZONE_TO_DUNGEON[zone];
            if (dungeonType !== undefined) {
              const dungeonStats = this.dungeonSystem.getDungeonStats(zone);

              // Apply rarity boost: increase black bag chance
              const baseBlackChance = 0.3;
              const boostedBlackChance = dungeonStats
                ? Math.min(0.8, baseBlackChance + dungeonStats.lootRarityBoost * 0.005)
                : baseBlackChance;
              const bossLoot = rollBossLootWithRarity(dungeonType, boostedBlackChance);

              // Apply quantity boost: add extra items to non-black bags
              if (dungeonStats && dungeonStats.lootQuantityBoost > 0 && bossLoot.bagRarity !== BagRarity.Black) {
                const extraItems = Math.min(4, Math.floor(dungeonStats.lootQuantityBoost / 25));
                const categories = [ItemCategory.Weapon, ItemCategory.Ability, ItemCategory.Armor, ItemCategory.Ring];
                for (let i = 0; i < extraItems; i++) {
                  const category = categories[Math.floor(Math.random() * categories.length)];
                  const tier = Math.random() < 0.5 ? 5 : 6;
                  let subtype = 0;
                  if (category === ItemCategory.Weapon) {
                    subtype = Math.random() < 0.5 ? WeaponSubtype.Sword : WeaponSubtype.Bow;
                  }
                  bossLoot.items.push(generateItemInstance(category, subtype, tier));
                }
              }

              this.spawnLootBag(
                event.enemyX,
                event.enemyY,
                bossLoot.bagRarity,
                bossLoot.items,
                zone
              );

              // Spawn exit portal at boss room center
              const dungeonMap = this.dungeonSystem.getDungeonMap(zone);
              const portalX = dungeonMap ? dungeonMap.bossRoom.centerX : event.enemyX;
              const portalY = dungeonMap ? dungeonMap.bossRoom.centerY : event.enemyY;

              // Find return position and zone from any player in this dungeon
              let returnX = HOSTILE_CENTER_X;
              let returnY = HOSTILE_CENTER_Y;
              let returnZone = "hostile";
              this.state.players.forEach((p) => {
                if (p.zone === zone) {
                  returnX = p.dungeonReturnX;
                  returnY = p.dungeonReturnY;
                  returnZone = p.dungeonReturnZone || "hostile";
                }
              });

              this.dungeonSystem.spawnExitPortal(
                portalX,
                portalY,
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
      } else if (event.type === "bossHit" && event.enemyZone) {
        this.dungeonSystem.onBossHit(event.enemyZone);
      }
    }

    // 5. Run spawn system
    this.spawnSystem.update(deltaTime, this.state);

    // 5b. Run dungeon system (portal despawn, cleanup, boss wake timer)
    const bossAwokeZones = this.dungeonSystem.update(deltaTime, this.state);
    for (const zone of bossAwokeZones) {
      this.state.players.forEach((p) => {
        if (p.zone === zone) {
          const c = this.clients.find((cl) => cl.sessionId === p.id);
          if (c) c.send(ServerMessage.BossAwakened, {});
        }
      });
    }

    // 6. HP Regeneration
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      const regenRate = player.cachedHpRegen;
      if (regenRate > 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + regenRate * (deltaTime / 1000));
      }
    });

    // 7. Mana Regeneration
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      if (player.cachedManaRegen > 0 && player.mana < player.maxMana) {
        player.mana = Math.min(player.maxMana, player.mana + player.cachedManaRegen * (deltaTime / 1000));
      }
    });

    // 7b. Clear stale invulnerability (safety net if client never sends ZoneReady)
    this.state.players.forEach((player) => {
      if (!player.invulnerable) return;
      if (player.invulnerableUntil > 0 && now >= player.invulnerableUntil) {
        player.invulnerable = false;
        player.invulnerableUntil = 0;
      } else if (player.invulnerableUntil === 0 && now - player.invulnerableSince > 5000) {
        player.invulnerable = false;
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
      if (!player.alive) {
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
    // Self-assignment (enemy.x = enemy.x) doesn't mark dirty if the value hasn't changed.
    // Alternate a sub-pixel nudge so stationary entities (switches, bags) get re-evaluated.
    this.tickCount++;
    if (this.tickCount >= FILTER_REFRESH_INTERVAL) {
      this.tickCount = 0;
      this.filterFlip = !this.filterFlip;
      const nudge = this.filterFlip ? 0.001 : -0.001;
      this.state.enemies.forEach((enemy) => {
        enemy.x += nudge;
      });
      this.state.lootBags.forEach((bag) => {
        bag.x += nudge;
      });
      this.state.dungeonPortals.forEach((portal) => {
        portal.x += nudge;
      });
    }
  }

  private spawnLootBag(
    x: number,
    y: number,
    bagRarity: number,
    items: ItemInstanceData[],
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
      const bagItem = new LootBagItem();
      if (i < items.length) {
        updateSchemaFromData(bagItem.item, items[i]);
      }
      bag.items.push(bagItem);
    }

    this.state.lootBags.set(bag.id, bag);
  }
}
