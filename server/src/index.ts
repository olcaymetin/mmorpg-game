import express from "express";
import path from "path";
import cors from "cors";
import { createServer } from "http";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom";

const PORT = Number(process.env.PORT) || 2567;

// ─── Express setup ─────────────────────────────────────────────────────────────

const app = express();

// Allow cross-origin requests from the Vite dev server (port 5173)
app.use(cors({ origin: "*" }));
app.use(express.json());

// Colyseus monitor dashboard — useful for inspecting rooms & clients
// Visit: http://localhost:2567/colyseus
app.use("/colyseus", monitor());

// Serve the built Vite client as static files.
// When running via tunnel, friends access the game through this same port.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));

// SPA fallback — serve index.html for all non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

// ─── Colyseus game server ─────────────────────────────────────────────────────

const httpServer = createServer(app);

const gameServer = new Server({ server: httpServer });

// Register our game room under the key "game_room"
// Clients join with: client.joinOrCreate("game_room")
gameServer.define("game_room", GameRoom);

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, "0.0.0.0", () => {
  // Detect local IP for display purposes
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  let lanIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        lanIP = net.address;
        break;
      }
    }
  }

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║        🎮  MMORPG Game Server               ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Local    : ws://localhost:${PORT}             ║`);
  console.log(`║  Network  : ws://${lanIP}:${PORT}          ║`);
  console.log(`║  Monitor  : http://${lanIP}:${PORT}/colyseus  ║`);
  console.log("╚══════════════════════════════════════════════╝\n");
});
