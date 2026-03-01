import { SERVER_PORT, TICK_RATE, MAX_PLAYERS } from "@rotmg-lite/shared";

export const config = {
  port: Number(process.env.PORT) || SERVER_PORT,
  tickRate: TICK_RATE,
  maxPlayers: MAX_PLAYERS,
};
