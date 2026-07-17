import fs from "fs";
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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Setup static uploads folder
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// Upload API route
app.post("/api/upload-asset", (req, res) => {
  try {
    const { name, base64Data } = req.body;
    if (!name || !base64Data) {
      return res.status(400).json({ error: "Missing name or base64Data" });
    }
    
    // Clean base64 prefix
    const cleanedData = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanedData, 'base64');
    
    // Save as unique ID
    const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeName}_${fileId}.png`;
    const filepath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filepath, buffer);
    console.log(`[Upload] Saved custom asset: ${filename}`);
    
    res.json({ url: `/uploads/${filename}` });
  } catch (err: any) {
    console.error("[Upload] Error saving file:", err);
    res.status(500).json({ error: err.message });
  }
});

// Colyseus monitor dashboard — useful for inspecting rooms & clients
// Visit: http://localhost:2567/colyseus
app.use("/colyseus", monitor());

// Serve the built Vite client as static files.
// __dirname = server/dist → go up two levels to reach client/dist
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
console.log(`[Static] Serving client from: ${clientDist}`);
app.use(express.static(clientDist));

// SPA fallback — serve index.html for all non-API routes
app.get("*", (_req, res) => {
  const indexPath = path.join(clientDist, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`[Static] index.html not found at ${indexPath}`, err.message);
      res.status(200).send(`
        <html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;text-align:center;padding:50px">
          <h1>🎮 MMORPG Server Running</h1>
          <p>Server is live but client build is missing.</p>
          <p>Path checked: ${indexPath}</p>
        </body></html>
      `);
    }
  });
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
