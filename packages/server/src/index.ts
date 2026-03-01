import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import path from "path";
import fs from "fs";
import { GameRoom } from "./rooms/GameRoom";
import { config } from "./config";

const app = express();

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

// Fallback to index.html for SPA routing
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
