import { Room, Client } from "colyseus";
import { GameState, Player, PlacedObjectState, CropState } from "../schema/GameState";
import * as fs from "fs";
import * as path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Available player colors — assigned round-robin on join */
const COLORS = [
  "#FF6B6B", // coral red
  "#4ECDC4", // teal
  "#45B7D1", // sky blue
  "#96CEB4", // mint green
  "#FFEAA7", // warm yellow
  "#DDA0DD", // plum
  "#98D8C8", // aquamarine
  "#F7DC6F", // gold
  "#BB8FCE", // lavender
  "#85C1E9", // light blue
];

const WORLD_W = 1600;
const WORLD_H = 1280;
/** Server-side movement speed in pixels per tick */
const SPEED = 4;
/** Half of player size — used for boundary clamping */
const HALF = 16;

const SAVE_FILE_PATH = fs.existsSync("/data")
  ? "/data/save_data.json"
  : path.join(__dirname, "..", "..", "save_data.json");

// ─── Message types ────────────────────────────────────────────────────────────

interface MoveMessage {
  dx: number; // expected: -1 | 0 | 1
  dy: number; // expected: -1 | 0 | 1
}

interface TileUpdateMessage {
  x: number;
  y: number;
  tileIndex: number;
  layer?: "terrain" | "decor";
}

interface TileUpdateMultiMessage {
  updates: Array<{
    x: number;
    y: number;
    tileIndex: number;
    layer?: "terrain" | "decor";
  }>;
}

interface TileUpdateBulkMessage {
  mapData: { [key: string]: number };
  decorData?: { [key: string]: number };
  placedObjects?: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    scale: number;
  }>;
}

interface ObjectPlaceMessage {
  id: string;
  type: string;
  x: number;
  y: number;
  scale: number;
}

interface ObjectMoveMessage {
  id: string;
  x: number;
  y: number;
}

interface ObjectDeleteMessage {
  id: string;
}

interface CropPlantMessage {
  x: number;
  y: number;
  cropType: string;
}

interface CropHarvestMessage {
  x: number;
  y: number;
}

// Growth stage duration in milliseconds — 5s per stage × 6 stages = 30s total
const GROWTH_INTERVAL_MS = 5_000;
// Total stages 0-6, stage 6 = fully grown / harvestable
const MAX_CROP_STAGE = 6;

// ─── Room ─────────────────────────────────────────────────────────────────────

export class GameRoom extends Room<GameState> {
  private colorIndex = 0;
  private saveTimeout: NodeJS.Timeout | null = null;
  private growthTimer: NodeJS.Timeout | null = null;

  /**
   * onCreate — called once when the room is first created.
   * We initialize state, set patch rate, and register message handlers.
   */
  onCreate(): void {
    this.setState(new GameState());

    // Broadcast state to clients at 20 fps (every 50 ms)
    this.setPatchRate(1000 / 20);

    // Load persisted map & buildings data if save file exists
    this.loadSaveData();

    // Start crop growth timer (checks every 3 seconds for responsive updates)
    this.growthTimer = setInterval(() => this.tickCropGrowth(), 3_000);

    /**
     * "move" message handler (authoritative server movement).
     */
    this.onMessage("move", (client: Client, msg: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const dx = Math.max(-1, Math.min(1, msg.dx));
      const dy = Math.max(-1, Math.min(1, msg.dy));

      if (dx !== 0 || dy !== 0) {
        // Set state to walking
        player.state = "walk";

        // Determine facing direction
        if (dx > 0) {
          player.direction = "right";
        } else if (dx < 0) {
          player.direction = "left";
        } else if (dy > 0) {
          player.direction = "down";
        } else if (dy < 0) {
          player.direction = "up";
        }

        // Apply movement
        const vx = dx * SPEED;
        const vy = dy * SPEED;
        player.x = Math.max(HALF, Math.min(WORLD_W - HALF, player.x + vx));
        player.y = Math.max(HALF, Math.min(WORLD_H - HALF, player.y + vy));
      } else {
        // If movement stops, return to idle
        if (player.state === "walk") {
          player.state = "idle";
        }
      }
    });

    /**
     * "action" message handler.
     */
    this.onMessage("action", (client: Client, msg: { type: string; direction?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.state = msg.type;
      if (msg.direction) {
        player.direction = msg.direction;
      }
    });

    /**
     * "tile-update" handler - for painting/erasing single tiles
     */
    this.onMessage("tile-update", (client: Client, msg: TileUpdateMessage) => {
       const key = `${msg.x},${msg.y}`;
       const targetMap = msg.layer === "decor" ? this.state.decorData : this.state.mapData;
       if (msg.tileIndex === -1) {
         targetMap.delete(key);
       } else {
         targetMap.set(key, msg.tileIndex);
       }
       this.triggerDebouncedSave();
    });

    /**
     * "tile-update-multi" handler - for painting multiple tiles (stamp/brush)
     */
    this.onMessage("tile-update-multi", (client: Client, msg: TileUpdateMultiMessage) => {
      if (msg.updates) {
        msg.updates.forEach(u => {
          const key = `${u.x},${u.y}`;
          const targetMap = u.layer === "decor" ? this.state.decorData : this.state.mapData;
          if (u.tileIndex === -1) {
            targetMap.delete(key);
          } else {
            targetMap.set(key, u.tileIndex);
          }
        });
        this.triggerDebouncedSave();
      }
    });

    /**
     * "tile-update-bulk" handler - for importing entire maps
     */
    this.onMessage("tile-update-bulk", (client: Client, msg: TileUpdateBulkMessage) => {
      // Clear current state first
      this.state.mapData.clear();
      this.state.decorData.clear();
      this.state.placedObjects.clear();

      if (msg.mapData) {
        for (const key in msg.mapData) {
          this.state.mapData.set(key, msg.mapData[key]);
        }
      }

      if (msg.decorData) {
        for (const key in msg.decorData) {
          this.state.decorData.set(key, msg.decorData[key]);
        }
      }

      // Set new placed objects
      if (msg.placedObjects) {
        msg.placedObjects.forEach(o => {
          const obj = new PlacedObjectState();
          obj.id = o.id;
          obj.type = o.type;
          obj.x = o.x;
          obj.y = o.y;
          obj.scale = o.scale;
          this.state.placedObjects.set(o.id, obj);
        });
      }

      console.log(`[Import] Bulk loaded map update from client ${client.sessionId}`);
      this.triggerDebouncedSave();
    });

    /**
     * "object-place" handler - for placing a new object/building
     */
    this.onMessage("object-place", (client: Client, msg: ObjectPlaceMessage) => {
      const obj = new PlacedObjectState();
      obj.id = msg.id;
      obj.type = msg.type;
      obj.x = msg.x;
      obj.y = msg.y;
      obj.scale = msg.scale;
      this.state.placedObjects.set(msg.id, obj);
      this.triggerDebouncedSave();
    });

    /**
     * "object-move" handler - for dragging an object
     */
    this.onMessage("object-move", (client: Client, msg: ObjectMoveMessage) => {
      const obj = this.state.placedObjects.get(msg.id);
      if (obj) {
        obj.x = msg.x;
        obj.y = msg.y;
        this.triggerDebouncedSave();
      }
    });

    /**
     * "object-delete" handler - for removing a building
     */
    this.onMessage("object-delete", (client: Client, msg: ObjectDeleteMessage) => {
      this.state.placedObjects.delete(msg.id);
      this.triggerDebouncedSave();
    });

    /**
     * "crop-plant" handler - plant a crop on a farm tile
     */
    this.onMessage("crop-plant", (client: Client, msg: CropPlantMessage) => {
      const key = `${msg.x},${msg.y}`;
      // Don't overwrite an existing crop
      if (this.state.crops.has(key)) return;

      const crop = new CropState();
      crop.key = key;
      crop.cropType = msg.cropType;
      crop.stage = 0;
      crop.plantedAt = Date.now();
      this.state.crops.set(key, crop);
      this.triggerDebouncedSave();
      console.log(`[Crop] ${msg.cropType} planted at ${key}`);
    });

    /**
     * "crop-harvest" handler - harvest a fully grown crop
     */
    this.onMessage("crop-harvest", (client: Client, msg: CropHarvestMessage) => {
      const key = `${msg.x},${msg.y}`;
      const crop = this.state.crops.get(key);
      if (!crop) return;

      if (crop.stage >= MAX_CROP_STAGE) {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          const cropType = crop.cropType;
          const currentCount = player.inventory.get(cropType) || 0;
          player.inventory.set(cropType, currentCount + 1);
          console.log(`[Inventory] Player ${client.sessionId.slice(0, 8)} harvested 1 ${cropType}. Total: ${currentCount + 1}`);
        }
        this.state.crops.delete(key);
        this.triggerDebouncedSave();
        console.log(`[Crop] Harvested ${crop.cropType} at ${key}`);
      }
    });
  }

  /**
   * onJoin — called for each new client connection.
   */
  onJoin(client: Client): void {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.x = WORLD_W / 2 + (Math.random() * 80 - 40);
    player.y = WORLD_H / 2 + (Math.random() * 80 - 40);
    player.color = COLORS[this.colorIndex++ % COLORS.length];

    // Assign a random skin
    const skins = ["farmer_1", "farmer_2", "body_2"];
    player.skin = skins[Math.floor(Math.random() * skins.length)];
    player.state = "idle";
    player.direction = "down";

    this.state.players.set(client.sessionId, player);
    console.log(
      `[JOIN]  ${client.sessionId.slice(0, 8)}… → color=${player.color} skin=${player.skin} x=${player.x.toFixed(0)} y=${player.y.toFixed(0)}`
    );
  }

  /**
   * onLeave — removes the player from state.
   */
  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(`[LEAVE] ${client.sessionId.slice(0, 8)}…`);
  }

  onDispose(): void {
    if (this.growthTimer) clearInterval(this.growthTimer);
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
  }

  // ─── Crop Growth ──────────────────────────────────────────────────────────────

  private tickCropGrowth(): void {
    const now = Date.now();
    let changed = false;

    this.state.crops.forEach((crop, key) => {
      if (crop.stage >= MAX_CROP_STAGE) return;

      const elapsed = now - crop.plantedAt;
      const expectedStage = Math.min(
        MAX_CROP_STAGE,
        Math.floor(elapsed / GROWTH_INTERVAL_MS)
      );

      if (expectedStage > crop.stage) {
        crop.stage = expectedStage;
        changed = true;
        console.log(`[Crop] ${crop.cropType} at ${key} grew to stage ${crop.stage}`);
      }
    });

    if (changed) this.triggerDebouncedSave();
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  private triggerDebouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveData();
    }, 2000); // Save to disk 2 seconds after the last edit action
  }

  private saveData(): void {
    try {
      const mapData: { [key: string]: number } = {};
      this.state.mapData.forEach((val, key) => { mapData[key] = val; });

      const decorData: { [key: string]: number } = {};
      this.state.decorData.forEach((val, key) => { decorData[key] = val; });

      const placedObjects: Array<{ id: string; type: string; x: number; y: number; scale: number }> = [];
      this.state.placedObjects.forEach((val) => {
        placedObjects.push({ id: val.id, type: val.type, x: val.x, y: val.y, scale: val.scale });
      });

      const crops: Array<{ key: string; cropType: string; stage: number; plantedAt: number }> = [];
      this.state.crops.forEach((val) => {
        crops.push({ key: val.key, cropType: val.cropType, stage: val.stage, plantedAt: val.plantedAt });
      });

      const payload = { mapData, decorData, placedObjects, crops };
      fs.writeFileSync(SAVE_FILE_PATH, JSON.stringify(payload, null, 2), "utf8");
      console.log(`[Persistence] Saved successfully. Tiles: ${this.state.mapData.size}, Crops: ${this.state.crops.size}`);
    } catch (e) {
      console.error("[Persistence] Failed to write save_data.json", e);
    }
  }

  private loadSaveData(): void {
    if (!fs.existsSync(SAVE_FILE_PATH)) {
      console.log(`[Persistence] No save file found at: ${SAVE_FILE_PATH}. Starting with blank map.`);
      return;
    }

    try {
      const raw = fs.readFileSync(SAVE_FILE_PATH, "utf8");
      const parsed = JSON.parse(raw);

      if (parsed.mapData) {
        for (const key in parsed.mapData) {
          this.state.mapData.set(key, parsed.mapData[key]);
        }
      }

      if (parsed.decorData) {
        for (const key in parsed.decorData) {
          this.state.decorData.set(key, parsed.decorData[key]);
        }
      }

      if (parsed.placedObjects) {
        parsed.placedObjects.forEach((o: any) => {
          const obj = new PlacedObjectState();
          obj.id = o.id; obj.type = o.type;
          obj.x = o.x; obj.y = o.y; obj.scale = o.scale;
          this.state.placedObjects.set(o.id, obj);
        });
      }

      if (parsed.crops) {
        parsed.crops.forEach((c: any) => {
          const crop = new CropState();
          crop.key = c.key; crop.cropType = c.cropType;
          crop.stage = c.stage; crop.plantedAt = c.plantedAt;
          this.state.crops.set(c.key, crop);
        });
      }

      console.log(`[Persistence] Loaded. Tiles: ${this.state.mapData.size}, Objects: ${this.state.placedObjects.size}, Crops: ${this.state.crops.size}`);
    } catch (e) {
      console.error("[Persistence] Failed to read/parse save_data.json file", e);
    }
  }
}
