import { ItemInstanceData } from "./itemStats";

// --- Character Types ---

export interface CharacterSummary {
  id: string;
  name: string;
  level: number;
  createdAt: string;
  lastPlayed: string;
}

export interface CharacterConsumables {
  healthPots: number;
  manaPots: number;
  portalGems: number;
}

export interface CharacterOrbs {
  blank: number;
  ember: number;
  shard: number;
  chaos: number;
  flux: number;
  void: number;
  prism: number;
  forge: number;
  calibrate: number;
  divine: number;
}

export interface CharacterData {
  id: string;
  accountId: string;
  name: string;
  level: number;
  xp: number;
  equipment: ItemInstanceData[];
  inventory: ItemInstanceData[];
  consumables: CharacterConsumables;
  orbs: CharacterOrbs;
}

// --- Auth Join Options ---

export interface AuthenticatedJoinOptions {
  authToken: string;
  characterId: string;
}

export interface GuestJoinOptions {
  name: string;
}

export type JoinOptions = AuthenticatedJoinOptions | GuestJoinOptions;

export function isAuthenticatedJoin(
  opts: unknown
): opts is AuthenticatedJoinOptions {
  return (
    typeof opts === "object" &&
    opts !== null &&
    "authToken" in opts &&
    "characterId" in opts
  );
}

// --- Constants ---

export const MAX_CHARACTERS_PER_ACCOUNT = 3;
export const CHARACTER_NAME_MAX_LENGTH = 16;
export const CHARACTER_NAME_MIN_LENGTH = 2;
