import { Room, Client } from "colyseus";
import { GameState } from "../schemas/GameState";
import { Player } from "../schemas/Player";
import { Projectile } from "../schemas/Projectile";
import { config } from "../config";
import { BiomeSpawnSystem } from "../systems/BiomeSpawnSystem";
import { EnemyAI } from "../systems/EnemyAI";
import { CombatSystem } from "../systems/CombatSystem";
import { ShootingPatternSystem } from "../systems/ShootingPatternSystem";
import { generateId } from "../utils/idGenerator";
import {
  ClientMessage,
  ServerMessage,
  PlayerInput,
  EntityType,
  TICK_INTERVAL,
  PLAYER_RADIUS,
  PROJECTILE_SPEED,
  PROJECTILE_RANGE,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  NEXUS_WIDTH,
  NEXUS_HEIGHT,
  PORTAL_X,
  PORTAL_Y,
  PORTAL_RADIUS,
  normalizeVector,
  applyMovement,
  distanceBetween,
  getStatsForLevel,
} from "@rotmg-lite/shared";

// How often (in ticks) to force-touch enemy positions for filterChildren re-evaluation.
// Colyseus only re-evaluates filters on changed children — enemies beyond AI_UPDATE_RANGE
// never get position updates, so the filter would never remove them from a departing client.
const FILTER_REFRESH_INTERVAL = 2; // every 2 ticks (100ms at 20Hz)

export class GameRoom extends Room<GameState> {
  maxClients = config.maxPlayers;

  private spawnSystem = new BiomeSpawnSystem();
  private enemyAI = new EnemyAI();
  private combatSystem = new CombatSystem();
  private shootingSystem = new ShootingPatternSystem();
  private tickCount = 0;

  onCreate(_options: Record<string, unknown>) {
    this.setState(new GameState());

    // Listen for player input messages — queue for processing in gameLoop
    this.onMessage(ClientMessage.Input, (client, input: PlayerInput) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const seq = typeof input.seq === "number" ? input.seq : 0;
      if (seq <= player.lastProcessedInput) return; // reject duplicate/old inputs

      // Cap queue size to prevent abuse
      if (player.pendingInputs.length >= 30) return;

      const mv = normalizeVector(input.movement?.x ?? 0, input.movement?.y ?? 0);
      // Cap client dt to prevent speed hacking (TICK_INTERVAL + one frame of jitter)
      const rawDt = typeof input.dt === "number" ? input.dt : TICK_INTERVAL;
      const dt = Math.min(Math.max(rawDt, 0), TICK_INTERVAL + 16);
      player.pendingInputs.push({
        seq,
        movementX: mv.x,
        movementY: mv.y,
        aimAngle: typeof input.aimAngle === "number" ? input.aimAngle : 0,
        shooting: !!input.shooting,
        dt,
      });
    });

    // Listen for return-to-nexus requests (Q key)
    this.onMessage(ClientMessage.ReturnToNexus, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.zone !== "hostile") return;
      this.teleportPlayerToNexus(player, client);
    });

    // Listen for respawn requests (after death)
    this.onMessage(ClientMessage.Respawn, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.alive) return;
      player.alive = true;
      this.teleportPlayerToNexus(player, client);
    });

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

    // Spawn in nexus with level-1 stats
    player.zone = "nexus";
    player.x = NEXUS_WIDTH / 2 + (Math.random() - 0.5) * 200;
    player.y = NEXUS_HEIGHT / 2 + 200 + (Math.random() - 0.5) * 200;
    player.level = 1;
    player.xp = 0;
    const stats = getStatsForLevel(1);
    player.maxHp = stats.maxHp;
    player.hp = stats.maxHp;
    player.cachedDamage = stats.damage;
    player.cachedShootCooldown = stats.shootCooldown;
    player.cachedSpeed = stats.speed;
    player.cachedHpRegen = stats.hpRegen;
    player.alive = true;

    this.state.players.set(client.sessionId, player);
    console.log(`${client.sessionId} joined as "${player.name}"`);
  }

  onLeave(client: Client, _consented: boolean) {
    // Remove player
    this.state.players.delete(client.sessionId);

    // Remove their projectiles
    const toRemove: string[] = [];
    this.state.projectiles.forEach((proj, id) => {
      if (proj.ownerId === client.sessionId) {
        toRemove.push(id);
      }
    });
    for (const id of toRemove) {
      this.state.projectiles.delete(id);
    }

    console.log(`${client.sessionId} left`);

    // Reset world if zero total players remain
    if (this.state.players.size === 0) {
      this.state.enemies.clear();
      this.state.projectiles.clear();
      this.spawnSystem.reset();
    }
  }

  onDispose() {
    console.log("GameRoom disposed");
  }

  private teleportPlayerToNexus(player: Player, client: Client): void {
    player.zone = "nexus";
    player.x = NEXUS_WIDTH / 2 + (Math.random() - 0.5) * 200;
    player.y = NEXUS_HEIGHT / 2 + 200 + (Math.random() - 0.5) * 200;
    player.hp = player.maxHp;

    // Remove this player's projectiles
    const toRemove: string[] = [];
    this.state.projectiles.forEach((proj, id) => {
      if (proj.ownerId === player.id) toRemove.push(id);
    });
    for (const id of toRemove) {
      this.state.projectiles.delete(id);
    }

    client.send(ServerMessage.ZoneChanged, { zone: "nexus" });
  }

  private gameLoop(deltaTime: number): void {
    // 1. Process player movement and shooting (input queue per player)
    this.state.players.forEach((player) => {
      if (!player.alive) return;

      // Determine arena bounds based on zone
      const isNexus = player.zone === "nexus";
      const zoneW = isNexus ? NEXUS_WIDTH : ARENA_WIDTH;
      const zoneH = isNexus ? NEXUS_HEIGHT : ARENA_HEIGHT;

      const inputCount = player.pendingInputs.length;

      if (inputCount > 0) {
        // Sort by sequence to ensure order
        player.pendingInputs.sort((a, b) => a.seq - b.seq);

        for (const input of player.pendingInputs) {
          const result = applyMovement(
            player.x,
            player.y,
            input.movementX,
            input.movementY,
            player.cachedSpeed,
            input.dt,
            PLAYER_RADIUS,
            zoneW,
            zoneH
          );
          player.x = result.x;
          player.y = result.y;

          player.aimAngle = input.aimAngle;
          player.inputShooting = input.shooting;
          player.lastProcessedInput = input.seq;
        }

        // Clear the queue
        player.pendingInputs.length = 0;
      }

      // Portal detection: nexus players walking into portal region
      if (isNexus) {
        const dist = distanceBetween(player.x, player.y, PORTAL_X, PORTAL_Y);
        if (dist < PORTAL_RADIUS + PLAYER_RADIUS) {
          player.zone = "hostile";
          player.x =
            ARENA_CENTER_X + (Math.random() - 0.5) * 200;
          player.y =
            ARENA_CENTER_Y + (Math.random() - 0.5) * 200;

          const client = this.clients.find(
            (c) => c.sessionId === player.id
          );
          if (client) {
            client.send(ServerMessage.ZoneChanged, { zone: "hostile" });
          }
        }
      }

      // Handle shooting (only in hostile zone)
      if (!isNexus && player.inputShooting) {
        const now = Date.now();
        if (now - player.lastShootTime >= player.cachedShootCooldown) {
          player.lastShootTime = now;

          const proj = new Projectile();
          proj.id = generateId("pproj");
          proj.x = player.x;
          proj.y = player.y;
          proj.angle = player.aimAngle;
          proj.ownerType = EntityType.Player;
          proj.ownerId = player.id;
          proj.speed = PROJECTILE_SPEED;
          proj.damage = player.cachedDamage;
          proj.startX = player.x;
          proj.startY = player.y;
          proj.maxRange = PROJECTILE_RANGE;

          this.state.projectiles.set(proj.id, proj);
        }
      }
    });

    // 2. Run enemy AI
    this.enemyAI.update(deltaTime, this.state, this.shootingSystem);

    // 3. Run combat (projectile movement, collisions, damage, XP)
    const events = this.combatSystem.update(deltaTime, this.state);

    // 4. Process combat events
    for (const event of events) {
      if (event.type === "playerDied" && event.playerId) {
        const player = this.state.players.get(event.playerId);
        const client = this.clients.find(
          (c) => c.sessionId === event.playerId
        );
        if (player && client) {
          // Send death notification — client shows death screen, waits for respawn click
          client.send(ServerMessage.PlayerDied, {});
        }
      } else if (event.type === "enemyKilled" && event.biome !== undefined) {
        this.spawnSystem.onEnemyKilled(event.biome);
      }
    }

    // 5. Run spawn system
    this.spawnSystem.update(deltaTime, this.state);

    // 6. HP Regeneration
    this.state.players.forEach((player) => {
      if (!player.alive) return;
      if (player.cachedHpRegen > 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + player.cachedHpRegen * (deltaTime / 1000));
      }
    });

    // 7. Periodically mark all enemies dirty so @filterChildren re-evaluates
    //    for clients that moved away from stationary enemies
    this.tickCount++;
    if (this.tickCount >= FILTER_REFRESH_INTERVAL) {
      this.tickCount = 0;
      this.state.enemies.forEach((enemy) => {
        // Setting x to itself triggers Schema's change tracking setter,
        // causing Colyseus to re-run the filterChildren callback on next encode.
        enemy.x = enemy.x;
      });
    }
  }
}
