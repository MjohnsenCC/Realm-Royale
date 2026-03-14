import * as Colyseus from "colyseus.js";
import { PlayerInput, ClientMessage, ServerMessage, AuthenticatedJoinOptions, GuestJoinOptions, ChatChannel } from "@rotmg-lite/shared";
import { getServerUrl } from "./ServerConfig";

export class NetworkManager {
  private static instance: NetworkManager;
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private currentRtt: number = 0;

  private constructor() {
    this.client = new Colyseus.Client(getServerUrl());
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  async joinGame(options: string | AuthenticatedJoinOptions | GuestJoinOptions): Promise<Colyseus.Room> {
    this.client = new Colyseus.Client(getServerUrl());
    const joinOpts = typeof options === "string" ? { name: options } : options;
    this.room = await this.client.joinOrCreate("game_room", joinOpts);
    this.startPingTracking();
    return this.room;
  }

  getRtt(): number {
    return this.currentRtt;
  }

  private startPingTracking(): void {
    if (!this.room) return;
    this.room.onMessage(ServerMessage.Pong, (data: { t: number }) => {
      this.currentRtt = Date.now() - data.t;
    });
    this.pingIntervalId = setInterval(() => {
      this.room?.send(ClientMessage.Ping, { t: Date.now() });
    }, 2000);
    // Send initial ping immediately
    this.room.send(ClientMessage.Ping, { t: Date.now() });
  }

  private stopPingTracking(): void {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    this.currentRtt = 0;
  }

  sendInput(input: PlayerInput): void {
    this.room?.send(ClientMessage.Input, input);
  }

  sendReturnToNexus(): void {
    this.room?.send(ClientMessage.ReturnToNexus);
  }

  sendRespawn(): void {
    this.room?.send(ClientMessage.Respawn);
  }

  sendInteractPortal(): void {
    this.room?.send(ClientMessage.InteractPortal);
  }

  sendOpenVault(): void {
    this.room?.send(ClientMessage.OpenVault);
  }

  sendZoneReady(): void {
    this.room?.send(ClientMessage.ZoneReady);
  }

  sendUsePortalGem(targetX: number, targetY: number): void {
    this.room?.send(ClientMessage.UsePortalGem, { targetX, targetY });
  }

  sendUsePortalGemVault(): void {
    this.room?.send(ClientMessage.UsePortalGemVault);
  }

  sendOpenCraftingTable(): void {
    this.room?.send(ClientMessage.OpenCraftingTable);
  }

  sendChatMessage(text: string, channel: ChatChannel): void {
    this.room?.send(ClientMessage.ChatMessage, { text, channel });
  }

  getRoom(): Colyseus.Room | null {
    return this.room;
  }

  getSessionId(): string {
    return this.room?.sessionId ?? "";
  }

  async leave(): Promise<void> {
    this.stopPingTracking();
    await this.room?.leave();
    this.room = null;
  }
}
