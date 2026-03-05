export interface GameServer {
  id: string;
  name: string;
  url: string;
}

export const SERVERS: GameServer[] = [
  {
    id: "eu",
    name: "Europe",
    url: "wss://rotmg-lite.fly.dev",
  },
  {
    id: "us",
    name: "US East",
    url: "wss://rotmg-lite-us.fly.dev",
  },
];

const STORAGE_KEY = "selectedServer";

export function getSelectedServerId(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SERVERS.some((s) => s.id === stored)) {
    return stored;
  }
  return "eu";
}

export function setSelectedServerId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function getServerUrl(): string {
  if (window.location.port === "5173") {
    return "ws://localhost:2567";
  }
  const server = SERVERS.find((s) => s.id === getSelectedServerId());
  return server?.url ?? SERVERS[0].url;
}
