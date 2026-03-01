import * as Colyseus from "colyseus.js";
import { PlayerInput, ClientMessage } from "@rotmg-lite/shared";

export class NetworkManager {
  private static instance: NetworkManager;
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;

  private constructor() {
    // In production, connect via same host. In dev (port 5173), connect to 2567.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = window.location.port === "5173" ? "2567" : window.location.port;
    const url = `${protocol}//${host}:${port}`;
    this.client = new Colyseus.Client(url);
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  async joinGame(playerName: string): Promise<Colyseus.Room> {
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
