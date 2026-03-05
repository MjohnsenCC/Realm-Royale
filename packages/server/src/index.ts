import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import path from "path";
import fs from "fs";
import { GameRoom } from "./rooms/GameRoom";
import { config } from "./config";
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
} from "./auth/google";
import { createSessionToken, validateSessionToken } from "./auth/session";
import { findOrCreateAccount } from "./db/accounts";
import {
  getCharactersByAccount,
  createCharacter,
  deleteCharacter,
} from "./db/characters";
import {
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_NAME_MIN_LENGTH,
} from "@rotmg-lite/shared";

const app = express();
app.set("trust proxy", true);
app.use(express.json());

// --- Auth middleware ---

interface AuthRequest extends Request {
  accountId?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = validateSessionToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.accountId = payload.accountId;
  next();
}

// --- Auth Routes ---

app.get("/auth/google", (_req, res) => {
  try {
    const redirectUri = `${_req.protocol}://${_req.get("host")}/auth/google/callback`;
    res.redirect(getGoogleAuthUrl(redirectUri));
  } catch (err) {
    console.error("Google auth redirect error:", err);
    res.status(500).send("Auth configuration error");
  }
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("Missing authorization code");
      return;
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/auth/google/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const userInfo = await getGoogleUserInfo(tokens.access_token);
    const account = await findOrCreateAccount(
      userInfo.sub,
      userInfo.email,
      userInfo.name
    );
    const sessionToken = createSessionToken(account.id);

    // In local dev, redirect to the Vite dev server so HMR and latest code are used
    const host = req.get("host") || "";
    const baseUrl = host.startsWith("localhost") ? "http://localhost:5173" : "";
    res.redirect(`${baseUrl}/#auth=${sessionToken}`);
  } catch (err) {
    console.error("Google auth callback error:", err);
    const host = req.get("host") || "";
    const baseUrl = host.startsWith("localhost") ? "http://localhost:5173" : "";
    res.redirect(`${baseUrl}/#auth_error=true`);
  }
});

// --- Character API Routes ---

app.get("/api/characters", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const characters = await getCharactersByAccount(req.accountId!);
    res.json(characters);
  } catch (err) {
    console.error("Fetch characters error:", err);
    res.status(500).json({ error: "Failed to fetch characters" });
  }
});

app.post("/api/characters", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (
      typeof name !== "string" ||
      name.trim().length < CHARACTER_NAME_MIN_LENGTH ||
      name.trim().length > CHARACTER_NAME_MAX_LENGTH
    ) {
      res.status(400).json({
        error: `Name must be ${CHARACTER_NAME_MIN_LENGTH}-${CHARACTER_NAME_MAX_LENGTH} characters`,
      });
      return;
    }

    const character = await createCharacter(req.accountId!, name.trim());
    res.status(201).json(character);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create character";
    console.error("Create character error:", err);
    res.status(400).json({ error: message });
  }
});

app.delete(
  "/api/characters/:id",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const deleted = await deleteCharacter(req.params.id, req.accountId!);
      if (!deleted) {
        res.status(404).json({ error: "Character not found" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Delete character error:", err);
      res.status(500).json({ error: "Failed to delete character" });
    }
  }
);

// --- Static file serving ---

// Serve static client files in production
// In Docker/production: client dist is at ../../client/dist relative to server dist
// Fallback: try ../packages/client/dist for workspace root execution
const possiblePaths = [
  path.resolve(__dirname, "../../client/dist"),
  path.resolve(__dirname, "../../../packages/client/dist"),
  path.resolve(process.cwd(), "packages/client/dist"),
];

let clientBuildPath = possiblePaths[0];
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    clientBuildPath = p;
    break;
  }
}

// HTML: no-cache (always revalidate to get latest version)
// Hashed assets (JS/CSS): long-term cache (Vite adds content hashes)
app.use(
  express.static(clientBuildPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else if (filePath.includes("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

// Fallback to index.html for SPA routing (must be last)
app.get("*", (_req, res) => {
  const indexPath = path.join(clientBuildPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Client not built yet. Run: npm run build -w packages/client");
  }
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game_room", GameRoom);

// Bind to 0.0.0.0 so Fly.io proxy can reach the server
gameServer.listen(config.port, "0.0.0.0").then(() => {
  console.log(`Game server listening on 0.0.0.0:${config.port}`);
});
