import * as Colyseus from "colyseus.js";
import { PlayerInput, ClientMessage } from "@rotmg-lite/shared";
import { getServerUrl } from "./ServerConfig";

export class NetworkManager {
  private static instance: NetworkManager;
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;

  private constructor() {
    this.client = new Colyseus.Client(getServerUrl());
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  async joinGame(playerName: string): Promise<Colyseus.Room> {
    this.client = new Colyseus.Client(getServerUrl());
    this.room = await this.client.joinOrCreate("game_room", {
      name: playerName,
    });
    return this.room;
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

  sendZoneReady(): void {
    this.room?.send(ClientMessage.ZoneReady);
  }

  sendUseHealthPot(): void {
    this.room?.send(ClientMessage.UseHealthPot);
  }

  sendUseManaPot(): void {
    this.room?.send(ClientMessage.UseManaPot);
  }

  sendUsePortalGem(targetX: number, targetY: number): void {
    this.room?.send(ClientMessage.UsePortalGem, { targetX, targetY });
  }

  getRoom(): Colyseus.Room | null {
    return this.room;
  }

  getSessionId(): string {
    return this.room?.sessionId ?? "";
  }

  async leave(): Promise<void> {
    await this.room?.leave();
    this.room = null;
  }
}
