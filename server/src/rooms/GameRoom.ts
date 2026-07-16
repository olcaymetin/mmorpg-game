import { Room, Client } from "colyseus";
import { GameState, Player, PlacedObjectState, CropState, MarketListing, ChatMessage, SkillState, MarketHistory, AchievementState, GuildState } from "../schema/GameState";
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
    animSpeed?: number;
  }>;
}

interface ObjectPlaceMessage {
  id: string;
  type: string;
  x: number;
  y: number;
  scale: number;
  animSpeed?: number;
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
  free?: boolean;
}

const CROP_PRICES: Record<string, { buySeed: number; sellCrop: number }> = {
  Cabbage:      { buySeed: 5,  sellCrop: 12 },
  Carrot:       { buySeed: 8,  sellCrop: 18 },
  Cauliflower:  { buySeed: 10, sellCrop: 22 },
  Coffee:       { buySeed: 12, sellCrop: 28 },
  Corn:         { buySeed: 15, sellCrop: 35 },
  Cotton:       { buySeed: 18, sellCrop: 42 },
  Grape:        { buySeed: 25, sellCrop: 60 },
  Onion:        { buySeed: 12, sellCrop: 28 },
  Pepper:       { buySeed: 10, sellCrop: 22 },
  Prickly_Pear: { buySeed: 30, sellCrop: 75 },
  Pumpkin:      { buySeed: 20, sellCrop: 50 },
  Radish:       { buySeed: 6,  sellCrop: 14 },
  Strawberry:   { buySeed: 15, sellCrop: 35 },
  Tomato:       { buySeed: 10, sellCrop: 24 },
  Turnip:       { buySeed: 8,  sellCrop: 18 },
  Watermelon:   { buySeed: 22, sellCrop: 55 },
  Wheat:        { buySeed: 4,  sellCrop: 9 },
};

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

    // --- Survival and AFK kicking loops ---
    // Hunger decreases by -1, thirst by -2 every 20 seconds
    this.clock.setInterval(() => {
      this.state.players.forEach((player) => {
        player.hunger = Math.max(0, player.hunger - 1);
        player.thirst = Math.max(0, player.thirst - 2);
      });
    }, 20000);

    // HP decays if hunger or thirst is 0 (checks every 5 seconds, -5 HP)
    this.clock.setInterval(() => {
      this.state.players.forEach((player) => {
        if (player.hunger === 0 || player.thirst === 0) {
          player.hp = Math.max(0, player.hp - 5);
        }
      });
    }, 5000);

    // Inactivity (AFK) check: kicked after 15 minutes of zero message activity
    this.clock.setInterval(() => {
      const now = Date.now();
      this.state.players.forEach((player, sessionId) => {
        const lastAct = (player as any).lastActivityAt || now;
        if (now - lastAct > 900000) { // 15 mins
          const client = this.clients.find(c => c.sessionId === sessionId);
          if (client) {
            console.log(`[AFK] Kicking ${player.username || sessionId} due to 15m inactivity`);
            client.send("afk-kick", { reason: "15 dakika boyunca hareket edilmediği için bağlantınız kesildi." });
            client.leave();
          }
        }
      });
    }, 10000);

    /**
     * "move" message handler (authoritative server movement).
     */
    this.onMessage("move", (client: Client, msg: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      (player as any).lastActivityAt = Date.now();

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
        const mapId = player.currentMap || "main";
        let mapW = WORLD_W;
        let mapH = WORLD_H;
        if (mapId === "sub_island" || mapId === "boss_island" || mapId === "right_island") {
          mapW = 800;
          mapH = 640;
        } else if (mapId === "bottom_island") {
          mapW = 38 * 32; // 1216
          mapH = 30 * 32; // 960
        }
        player.x = Math.max(HALF, Math.min(mapW - HALF, player.x + vx));
        player.y = Math.max(HALF, Math.min(mapH - HALF, player.y + vy));
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
       const player = this.state.players.get(client.sessionId);
       const mapId = player?.currentMap || "main";
       const key = `${mapId}:${msg.x},${msg.y}`;
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
       const player = this.state.players.get(client.sessionId);
       const mapId = player?.currentMap || "main";
       if (msg.updates) {
         msg.updates.forEach(u => {
           const key = `${mapId}:${u.x},${u.y}`;
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
          obj.animSpeed = o.animSpeed !== undefined ? o.animSpeed : 1.0;
          this.state.placedObjects.set(o.id, obj);
        });
      }

      console.log(`[Import] Bulk loaded map update from client ${client.sessionId}`);
      this.triggerDebouncedSave();
    });

    /**
     * "clear-map-island" handler - clears ALL tiles and objects for the current map/island
     */
    this.onMessage("clear-map-island", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      const mapId = player?.currentMap || "main";
      const prefix = `${mapId}:`;

      // Delete all mapData keys for this island
      const mapKeysToDelete: string[] = [];
      this.state.mapData.forEach((_val: number, key: string) => {
        if (key.startsWith(prefix)) mapKeysToDelete.push(key);
      });
      mapKeysToDelete.forEach(key => this.state.mapData.delete(key));

      // Delete all decorData keys for this island
      const decorKeysToDelete: string[] = [];
      (this.state as any).decorData.forEach((_val: number, key: string) => {
        if (key.startsWith(prefix)) decorKeysToDelete.push(key);
      });
      decorKeysToDelete.forEach(key => (this.state as any).decorData.delete(key));

      // Delete all placed objects for this island
      const objKeysToDelete: string[] = [];
      this.state.placedObjects.forEach((obj: any, id: string) => {
        if ((obj.mapId || "main") === mapId) objKeysToDelete.push(id);
      });
      objKeysToDelete.forEach(id => this.state.placedObjects.delete(id));

      this.triggerDebouncedSave();
      console.log(`[Editor] Cleared island "${mapId}" — removed ${mapKeysToDelete.length} terrain, ${decorKeysToDelete.length} decor, ${objKeysToDelete.length} objects`);
    });

    /**
     * "object-place" handler - for placing a new object/building
     */
    this.onMessage("object-place", (client: Client, msg: ObjectPlaceMessage) => {
      const player = this.state.players.get(client.sessionId);
      let obj = this.state.placedObjects.get(msg.id);
      if (!obj) {
        obj = new PlacedObjectState();
        obj.id = msg.id;
        obj.type = msg.type;
        obj.mapId = player?.currentMap || "main";
      }
      obj.x = msg.x;
      obj.y = msg.y;
      obj.scale = msg.scale;
      if (msg.animSpeed !== undefined) {
        obj.animSpeed = msg.animSpeed;
      }
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
     * "player-teleport" handler - teleport to another map/island
     */
    this.onMessage("player-teleport", (client: Client, msg: { mapId: string; x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.currentMap = msg.mapId;
        player.x = msg.x;
        player.y = msg.y;
        console.log(`[Teleport] Player ${player.username || client.sessionId.slice(0, 8)} teleported to ${msg.mapId} (${msg.x}, ${msg.y})`);
      }
    });

    /**
     * "crop-plant" handler - plant a crop on a farm tile
     */
    this.onMessage("crop-plant", (client: Client, msg: CropPlantMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const mapId = player.currentMap || "main";
      const key = `${mapId}:${msg.x},${msg.y}`;
      // Don't overwrite an existing crop
      if (this.state.crops.has(key)) return;

      // Seed consumption check (skipped if msg.free is true, e.g. in editor mode)
      if (!msg.free) {
        const seedCount = player.seeds.get(msg.cropType) || 0;
        if (seedCount < 1) {
          console.log(`[Crop] Player ${client.sessionId.slice(0, 8)} tried to plant ${msg.cropType} but has no seeds.`);
          return;
        }
        player.seeds.set(msg.cropType, seedCount - 1);
      }

      const crop = new CropState();
      crop.key = key;
      crop.cropType = msg.cropType;
      crop.stage = 0;
      crop.plantedAt = Date.now();
      crop.mapId = mapId;
      this.state.crops.set(key, crop);
      this.triggerDebouncedSave();
      console.log(`[Crop] ${msg.cropType} planted at ${key} (free=${!!msg.free})`);
    });

    /**
     * "shop-buy-seed" handler - purchase seed bag from NPC shop
     */
    this.onMessage("shop-buy-seed", (client: Client, msg: { cropType: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const prices = CROP_PRICES[msg.cropType];
      if (!prices) return;

      if (player.gold >= prices.buySeed) {
        player.gold -= prices.buySeed;
        const currentSeeds = player.seeds.get(msg.cropType) || 0;
        player.seeds.set(msg.cropType, currentSeeds + 1);
        console.log(`[Shop] Player ${client.sessionId.slice(0, 8)} bought 1 ${msg.cropType} seed for ${prices.buySeed} gold.`);
      }
    });

    /**
     * "shop-sell-crop" handler - sell harvested crop for gold
     */
    this.onMessage("shop-sell-crop", (client: Client, msg: { cropType: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const prices = CROP_PRICES[msg.cropType];
      if (!prices) return;

      const currentCrops = player.inventory.get(msg.cropType) || 0;
      if (currentCrops >= 1) {
        player.inventory.set(msg.cropType, currentCrops - 1);
        player.gold += prices.sellCrop;
        console.log(`[Shop] Player ${client.sessionId.slice(0, 8)} sold 1 ${msg.cropType} for ${prices.sellCrop} gold.`);
      }
    });

    /**
     * "crop-harvest" handler - harvest a fully grown crop
     */
    this.onMessage("crop-harvest", (client: Client, msg: CropHarvestMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const mapId = player.currentMap || "main";
      const key = `${mapId}:${msg.x},${msg.y}`;
      const crop = this.state.crops.get(key);
      if (!crop) return;

      if (crop.stage >= MAX_CROP_STAGE) {
        const cropType = crop.cropType;
        const currentCount = player.inventory.get(cropType) || 0;
        player.inventory.set(cropType, currentCount + 1);
        // Grant farming XP (with boost)
        this.addSkillXP(player, "farming", 25);
        this.addActionCount(player, "harvestCount", client.sessionId);
        console.log(`[Inventory] Player ${client.sessionId.slice(0, 8)} harvested 1 ${cropType}. Total: ${currentCount + 1}`);
        this.state.crops.delete(key);
        this.triggerDebouncedSave();
        console.log(`[Crop] Harvested ${crop.cropType} at ${key}`);
      }
    });

    /**
     * "crop-remove" handler - erase a crop at specific tile (used by Eraser tool)
     */
    this.onMessage("crop-remove", (client: Client, msg: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      const mapId = player?.currentMap || "main";
      const key = `${mapId}:${msg.x},${msg.y}`;
      if (this.state.crops.has(key)) {
        this.state.crops.delete(key);
        this.triggerDebouncedSave();
        console.log(`[Crop] Removed crop at ${key}`);
      }
    });

    // ─── Chat ────────────────────────────────────────────────────────────────

    this.onMessage("chat-message", (client: Client, msg: { channel: string; text: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      (player as any).lastActivityAt = Date.now();

      // Spam Protection: 15s cooldown
      const now = Date.now();
      const lastChat = (player as any).lastChatAt || 0;
      if (now - lastChat < 15000) {
        client.send("chat-error", { message: "Lütfen mesaj göndermek için 15 saniye bekleyin." });
        return;
      }
      (player as any).lastChatAt = now;

      const text = (msg.text || "").trim().slice(0, 200);
      if (!text) return;

      const chatMsg = new ChatMessage();
      chatMsg.id = `${Date.now()}-${client.sessionId.slice(0, 4)}`;
      chatMsg.senderId = client.sessionId;
      chatMsg.senderName = player.username || `Player_${client.sessionId.slice(0, 6)}`;
      
      // Guild channel mapping: prefix with guild- ID
      if (msg.channel === "guild") {
        if (!player.guildId) {
          client.send("chat-error", { message: "Bir klanda değilsiniz." });
          return;
        }
        chatMsg.channel = `guild-${player.guildId}`;
      } else {
        chatMsg.channel = msg.channel || "global";
      }
      
      chatMsg.text = text;
      chatMsg.timestamp = Date.now();

      // Keep last 100 messages
      this.state.chatMessages.push(chatMsg);
      if (this.state.chatMessages.length > 100) {
        this.state.chatMessages.splice(0, 1);
      }
    });

    // ─── Username ─────────────────────────────────────────────────────────────

    this.onMessage("set-username", (client: Client, msg: { username: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.usernameSet) return;

      const name = (msg.username || "").trim().slice(0, 20);
      if (!name || name.length < 3) {
        client.send("username-error", { message: "Username must be 3-20 characters." });
        return;
      }

      // Check uniqueness
      let taken = false;
      this.state.players.forEach((p) => {
        if (p.sessionId !== client.sessionId && p.username.toLowerCase() === name.toLowerCase()) {
          taken = true;
        }
      });

      if (taken) {
        client.send("username-error", { message: "This username is already taken. Choose another." });
        return;
      }

      player.username = name;
      player.usernameSet = true;
      client.send("username-accepted", { username: name });
      console.log(`[Username] ${client.sessionId.slice(0, 8)} set username: ${name}`);
    });

    // ─── Marketplace ──────────────────────────────────────────────────────────

    this.onMessage("market-list", (client: Client, msg: { itemType: string; itemCategory: string; quantity: number; pricePerUnit: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const qty = Math.max(1, Math.floor(msg.quantity || 1));
      const price = Math.max(1, Math.floor(msg.pricePerUnit || 1));
      const fee = Math.ceil(qty * price * 0.05); // 5% listing fee

      // Check inventory
      if (msg.itemCategory === "crop") {
        const have = player.inventory.get(msg.itemType) || 0;
        if (have < qty) { client.send("market-error", { message: "Not enough items in inventory." }); return; }
        player.inventory.set(msg.itemType, have - qty);
      } else if (msg.itemCategory === "seed") {
        const have = player.seeds.get(msg.itemType) || 0;
        if (have < qty) { client.send("market-error", { message: "Not enough seeds." }); return; }
        player.seeds.set(msg.itemType, have - qty);
      }

      // Deduct fee in FARM coin (or gold if not enough coin)
      if (player.coin >= fee) {
        player.coin -= fee;
      } else if (player.gold >= fee) {
        player.gold -= fee;
      } else {
        client.send("market-error", { message: `Need ${fee} FARM coin for listing fee.` }); return;
      }

      const listing = new MarketListing();
      listing.id = `ml-${Date.now()}-${client.sessionId.slice(0, 4)}`;
      listing.sellerId = client.sessionId;
      listing.sellerName = player.username || `Player_${client.sessionId.slice(0, 6)}`;
      listing.itemType = msg.itemType;
      listing.itemCategory = msg.itemCategory;
      listing.quantity = qty;
      listing.pricePerUnit = price;
      listing.listedAt = Date.now();
      this.state.marketListings.set(listing.id, listing);
      client.send("market-listed", { id: listing.id });
      console.log(`[Market] ${listing.sellerName} listed ${qty}x ${msg.itemType} @ ${price} FARM each (fee: ${fee})`);
    });

    this.onMessage("market-buy", (client: Client, msg: { listingId: string; quantity: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const listing = this.state.marketListings.get(msg.listingId);
      if (!listing) { client.send("market-error", { message: "Listing not found." }); return; }
      if (listing.sellerId === client.sessionId) { client.send("market-error", { message: "Cannot buy your own listing." }); return; }

      const qty = Math.min(Math.max(1, Math.floor(msg.quantity || 1)), listing.quantity);
      const totalCost = qty * listing.pricePerUnit;
      const fee = Math.ceil(totalCost * 0.025); // 2.5% buy fee
      const totalWithFee = totalCost + fee;

      if (player.coin < totalWithFee) { client.send("market-error", { message: `Need ${totalWithFee} FARM coin.` }); return; }

      player.coin -= totalWithFee;

      // Give item to buyer
      if (listing.itemCategory === "crop") {
        const have = player.inventory.get(listing.itemType) || 0;
        player.inventory.set(listing.itemType, have + qty);
      } else if (listing.itemCategory === "seed") {
        const have = player.seeds.get(listing.itemType) || 0;
        player.seeds.set(listing.itemType, have + qty);
      }

      // Pay seller
      const seller = this.state.players.get(listing.sellerId);
      if (seller) {
        seller.coin += totalCost;
        seller.marketSaleCount += qty;
        seller.marketSaleVolume += totalCost;
        this.addActionCount(seller, "marketSales", listing.sellerId);
      }

      // Record Market History
      const hist = new MarketHistory();
      hist.itemType = listing.itemType;
      hist.quantity = qty;
      hist.pricePerUnit = listing.pricePerUnit;
      hist.timestamp = Date.now();
      this.state.marketHistory.push(hist);
      if (this.state.marketHistory.length > 200) {
        this.state.marketHistory.shift();
      }

      // Update listing quantity
      listing.quantity -= qty;
      if (listing.quantity <= 0) {
        this.state.marketListings.delete(listing.id);
      }
      client.send("market-bought", { itemType: listing.itemType, qty, totalCost: totalWithFee });
      console.log(`[Market] ${player.username || client.sessionId.slice(0,6)} bought ${qty}x ${listing.itemType}`);
    });

    this.onMessage("market-cancel", (client: Client, msg: { listingId: string }) => {
      const listing = this.state.marketListings.get(msg.listingId);
      if (!listing || listing.sellerId !== client.sessionId) return;
      const player = this.state.players.get(client.sessionId);
      if (player) {
        // Return items
        if (listing.itemCategory === "crop") {
          const have = player.inventory.get(listing.itemType) || 0;
          player.inventory.set(listing.itemType, have + listing.quantity);
        } else if (listing.itemCategory === "seed") {
          const have = player.seeds.get(listing.itemType) || 0;
          player.seeds.set(listing.itemType, have + listing.quantity);
        }
      }
      this.state.marketListings.delete(msg.listingId);
      client.send("market-cancelled", { listingId: msg.listingId });
    });

    // ─── Friend System ────────────────────────────────────────────────────────

    this.onMessage("friend-request", (client: Client, msg: { targetSessionId: string }) => {
      const player = this.state.players.get(client.sessionId);
      const target = this.state.players.get(msg.targetSessionId);
      if (!player || !target) return;
      if (target.friends.has(client.sessionId)) return; // already friends
      target.friendRequests.set(client.sessionId, player.username || client.sessionId.slice(0, 8));
    });

    this.onMessage("friend-accept", (client: Client, msg: { fromSessionId: string }) => {
      const player = this.state.players.get(client.sessionId);
      const requester = this.state.players.get(msg.fromSessionId);
      if (!player || !requester) return;
      player.friendRequests.delete(msg.fromSessionId);
      player.friends.set(msg.fromSessionId, requester.username || msg.fromSessionId.slice(0, 8));
      requester.friends.set(client.sessionId, player.username || client.sessionId.slice(0, 8));
    });

    this.onMessage("friend-reject", (client: Client, msg: { fromSessionId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.friendRequests.delete(msg.fromSessionId);
    });

    this.onMessage("dm-send", (client: Client, msg: { toSessionId: string; text: string }) => {
      const player = this.state.players.get(client.sessionId);
      const target = this.state.players.get(msg.toSessionId);
      if (!player || !target) return;
      const text = (msg.text || "").trim().slice(0, 300);
      if (!text) return;
      // Relay DM as a direct client message
      const fromName = player.username || client.sessionId.slice(0, 8);
      this.clients.find(c => c.sessionId === msg.toSessionId)?.send("dm-received", {
        fromSessionId: client.sessionId,
        fromName,
        text,
        timestamp: Date.now()
      });
    });

    // ─── Skill Boost ──────────────────────────────────────────────────────────

    // Permanent skill boost tiers (gem cost -> XP % bonus)
    const BOOST_TIERS: Array<{ cost: number; bonus: number }> = [
      { cost: 1,  bonus: 5  },
      { cost: 5,  bonus: 15 },
      { cost: 10, bonus: 30 },
      { cost: 25, bonus: 60 },
      { cost: 50, bonus: 100 },
    ];

    this.onMessage("skill-boost", (client: Client, msg: { skill: string; tierIndex: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const tier = BOOST_TIERS[msg.tierIndex];
      if (!tier) return;
      if (player.gem < tier.cost) { client.send("boost-error", { message: `Need ${tier.cost} Gem.` }); return; }
      player.gem -= tier.cost;
      const currentBoost = player.skillBoosts.get(msg.skill) || 0;
      player.skillBoosts.set(msg.skill, currentBoost + tier.bonus);
      console.log(`[Boost] ${player.username || client.sessionId.slice(0,6)} boosted ${msg.skill} by +${tier.bonus}% (total: ${currentBoost + tier.bonus}%)`);
    });

    // Instant Craft / Action speed-up using FARM coin
    this.onMessage("instant-craft", (client: Client, msg: { craftId: string; remainingSeconds: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const cost = Math.max(1, Math.ceil(msg.remainingSeconds / 10)); // kalan_saniye / 10 FARM coin
      if (player.coin < cost) {
        client.send("craft-error", { message: `Need ${cost} FARM coin.` });
        return;
      }
      player.coin -= cost;
      // Increment crafting action count
      this.addActionCount(player, "craftCount", client.sessionId);
      this.addSkillXP(player, "crafting", 40);
      client.send("craft-instanted", { craftId: msg.craftId });
    });

    // Fishing Cast handling with weights
    this.onMessage("fish-cast", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const rodLimits = [0, 5, 15, 40, 100]; // Rod T1, T2, T3, T4 max limits
      const tier = Math.max(1, Math.min(4, player.rodTier || 1));
      const maxWeight = rodLimits[tier];

      // A random fish weight between 1 and (tier * 15)
      const weight = +(Math.random() * (tier * 15) + 1).toFixed(2);

      if (weight > maxWeight) {
        client.send("fish-result", { success: false, message: `Balık Kaçtı! Çok ağır (${weight} kg). Limit: ${maxWeight} kg.` });
      } else {
        const currentFish = player.inventory.get("Fish") || 0;
        player.inventory.set("Fish", currentFish + 1);
        this.addSkillXP(player, "fishing", 25);
        this.addActionCount(player, "fishCount", client.sessionId);
        client.send("fish-result", { success: true, weight, message: `🐟 ${weight} kg ağırlığında balık yakaladın!` });
      }
    });

    // Upgrade Fishing Rod
    this.onMessage("upgrade-rod", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (player.rodTier >= 4) { client.send("rod-error", { message: "Maximum Rod Tier reached." }); return; }
      const cost = player.rodTier * 50; // T1->T2: 50, T2->T3: 100, T3->T4: 150
      if (player.coin < cost) { client.send("rod-error", { message: `Upgrade costs ${cost} FARM coin.` }); return; }
      player.coin -= cost;
      player.rodTier += 1;
      client.send("rod-upgraded", { tier: player.rodTier });
    });

    // --- Shop buy item (Water/Bread) for coin ---
    this.onMessage("shop-buy-item", (client: Client, msg: { itemName: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      (player as any).lastActivityAt = Date.now();

      if (msg.itemName === "Water") {
        if (player.coin < 5) { client.send("shop-error", { message: "Gerekli: 5 FARM Coin." }); return; }
        player.coin -= 5;
        const qty = player.inventory.get("Water") || 0;
        player.inventory.set("Water", qty + 1);
        console.log(`[Shop] Player ${client.sessionId.slice(0, 8)} bought Water for 5 Coin.`);
      } else if (msg.itemName === "Bread") {
        if (player.coin < 8) { client.send("shop-error", { message: "Gerekli: 8 FARM Coin." }); return; }
        player.coin -= 8;
        const qty = player.inventory.get("Bread") || 0;
        player.inventory.set("Bread", qty + 1);
        console.log(`[Shop] Player ${client.sessionId.slice(0, 8)} bought Bread for 8 Coin.`);
      }
    });

    // --- Use item (consume food/water) ---
    this.onMessage("use-item", (client: Client, msg: { itemName: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      (player as any).lastActivityAt = Date.now();

      const qty = player.inventory.get(msg.itemName) || 0;
      if (qty <= 0) return;

      if (msg.itemName === "Water") {
        player.inventory.set("Water", qty - 1);
        player.thirst = Math.min(100, player.thirst + 40);
        player.hp = Math.min(player.maxHp, player.hp + 10); // also restores minor HP
        client.send("item-used", { itemName: "Water", thirst: player.thirst });
      } else if (msg.itemName === "Bread") {
        player.inventory.set("Bread", qty - 1);
        player.hunger = Math.min(100, player.hunger + 50);
        player.hp = Math.min(player.maxHp, player.hp + 15); // also restores HP
        client.send("item-used", { itemName: "Bread", hunger: player.hunger });
      }
    });

    // --- Guild creation ---
    this.onMessage("guild-create", (client: Client, msg: { name: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.guildId) return;
      (player as any).lastActivityAt = Date.now();

      const name = (msg.name || "").trim().slice(0, 16);
      if (!name || name.length < 3) { client.send("guild-error", { message: "Klan ismi en az 3 karakter olmalıdır." }); return; }
      if (player.coin < 100) { client.send("guild-error", { message: "Klan kurmak için 100 FARM coin gerekiyor." }); return; }

      // Check name uniqueness
      let exists = false;
      this.state.guilds.forEach(g => {
        if (g.name.toLowerCase() === name.toLowerCase()) exists = true;
      });
      if (exists) { client.send("guild-error", { message: "Bu isimde bir klan zaten var." }); return; }

      player.coin -= 100;
      const g = new GuildState();
      g.id = `gld-${Date.now()}`;
      g.name = name;
      g.level = 1;
      g.xp = 0;
      g.ownerId = client.sessionId;
      g.members.set(client.sessionId, player.username || `Player_${client.sessionId.slice(0, 6)}`);
      
      this.state.guilds.set(g.id, g);
      player.guildId = g.id;
      client.send("guild-created", { guildId: g.id });
      console.log(`[Guild] Created guild: ${name} by ${player.username || client.sessionId}`);
    });

    // --- Guild Join ---
    this.onMessage("guild-join", (client: Client, msg: { guildId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.guildId) return;
      (player as any).lastActivityAt = Date.now();

      const g = this.state.guilds.get(msg.guildId);
      if (!g) { client.send("guild-error", { message: "Klan bulunamadı." }); return; }
      if (g.members.size >= 20) { client.send("guild-error", { message: "Klan üye sınırı aşıldı (max 20)." }); return; }

      g.members.set(client.sessionId, player.username || `Player_${client.sessionId.slice(0, 6)}`);
      player.guildId = g.id;
      console.log(`[Guild] ${player.username || client.sessionId} joined guild ${g.name}`);
    });

    // --- Guild Leave ---
    this.onMessage("guild-leave", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.guildId) return;
      (player as any).lastActivityAt = Date.now();

      const g = this.state.guilds.get(player.guildId);
      if (g) {
        g.members.delete(client.sessionId);
        if (g.ownerId === client.sessionId) {
          if (g.members.size > 0) {
            // Transfer ownership to first member
            const nextOwner = g.members.keys().next().value || "";
            g.ownerId = nextOwner;
            console.log(`[Guild] Transferred owner of ${g.name} to ${nextOwner}`);
          } else {
            // Delete guild if empty
            this.state.guilds.delete(g.id);
            console.log(`[Guild] Deleted empty guild ${g.name}`);
          }
        }
      }
      player.guildId = "";
    });

    // --- Player Report ---
    this.onMessage("player-report", (client: Client, msg: { targetSessionId: string; category: string }) => {
      const player = this.state.players.get(client.sessionId);
      const target = this.state.players.get(msg.targetSessionId);
      if (!player || !target) return;
      (player as any).lastActivityAt = Date.now();

      const reporterName = player.username || client.sessionId.slice(0, 6);
      const targetName = target.username || msg.targetSessionId.slice(0, 6);

      const logEntry = `[Report] ${new Date().toISOString()} - Reporter: ${reporterName} (ID: ${client.sessionId}) reported Target: ${targetName} (ID: ${msg.targetSessionId}) for Category: ${msg.category}\n`;
      try {
        fs.appendFileSync(path.join(__dirname, "../reports.txt"), logEntry, "utf8");
      } catch (e) {
        console.error("Failed to write report log", e);
      }

      client.send("report-success", { message: "Oyuncu başarıyla rapor edildi. Teşekkürler!" });
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

    player.hunger = 100;
    player.thirst = 100;
    player.guildId = "";
    (player as any).lastActivityAt = Date.now();

    // Assign a random skin
    const skins = ["farmer_1", "farmer_2", "body_2"];
    player.skin = skins[Math.floor(Math.random() * skins.length)];
    player.state = "idle";
    player.direction = "down";
    player.gold = 100;
    player.gem = 5;   // starter gems
    player.coin = 50; // starter FARM coin

    // HP / Shield
    player.hp = 100; player.maxHp = 100;
    player.shield = 100; player.maxShield = 100;
    player.rodTier = 1;
    player.marketSaleCount = 0;
    player.marketSaleVolume = 0;

    // Initialize all profession skills
    for (const skill of ["farming", "combat", "woodcutting", "mining", "fishing", "crafting"]) {
      const s = new SkillState();
      s.name = skill;
      s.xp = 0;
      s.level = 1;
      player.skills.set(skill, s);
    }
    player.totalLevel = 1;

    // Initialize action counters
    for (const action of ["harvestCount","woodcutCount","mineCount","fishCount","craftCount","pvpWins","marketSales"]) {
      player.actionCounts.set(action, 0);
    }

    // Initialize all achievements (locked)
    this.initAchievements(player);

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

  // ─── Skill XP Helper ─────────────────────────────────────────────────────────

  private addSkillXP(player: Player, skillName: string, baseXP: number): void {
    const skill = player.skills.get(skillName);
    if (!skill) return;
    const boost = player.skillBoosts.get(skillName) || 0;
    const earned = Math.floor(baseXP * (1 + boost / 100));
    skill.xp += earned;
    skill.level = Math.max(1, Math.floor(1 + Math.sqrt(skill.xp / 50)));
    let sum = 0; let count = 0;
    player.skills.forEach(s => { sum += s.level; count++; });
    player.totalLevel = count > 0 ? Math.max(1, Math.floor(sum / count)) : 1;
  }

  private addActionCount(player: Player, action: string, sessionId: string): void {
    const current = player.actionCounts.get(action) || 0;
    player.actionCounts.set(action, current + 1);
    this.checkAchievements(player, sessionId);
  }

  // ─── Achievement Definitions ─────────────────────────────────────────────────

  private static readonly ACHIEVEMENT_DEFS = [
    // Farming
    { id:"farm_10",   name:"Sprout",        emoji:"🌱", description:"Harvest 10 crops",    action:"harvestCount", threshold:10   },
    { id:"farm_50",   name:"Green Thumb",   emoji:"🌿", description:"Harvest 50 crops",    action:"harvestCount", threshold:50   },
    { id:"farm_100",  name:"Farmer",        emoji:"🌾", description:"Harvest 100 crops",   action:"harvestCount", threshold:100  },
    { id:"farm_500",  name:"Master Farmer", emoji:"🏅", description:"Harvest 500 crops",   action:"harvestCount", threshold:500  },
    { id:"farm_1000", name:"Legend Farmer", emoji:"🥇", description:"Harvest 1000 crops",  action:"harvestCount", threshold:1000 },
    // Woodcutting
    { id:"wood_10",   name:"Lumberjack Jr", emoji:"🌲", description:"Cut 10 trees",       action:"woodcutCount", threshold:10  },
    { id:"wood_50",   name:"Lumberjack",    emoji:"🪓", description:"Cut 50 trees",       action:"woodcutCount", threshold:50  },
    { id:"wood_100",  name:"Woodcutter",    emoji:"🏅", description:"Cut 100 trees",      action:"woodcutCount", threshold:100 },
    { id:"wood_500",  name:"Forest Master", emoji:"🥇", description:"Cut 500 trees",      action:"woodcutCount", threshold:500 },
    // Mining
    { id:"mine_10",   name:"Rock Breaker",  emoji:"⛏️", description:"Mine 10 ores",       action:"mineCount", threshold:10  },
    { id:"mine_50",   name:"Miner",         emoji:"⚒️", description:"Mine 50 ores",       action:"mineCount", threshold:50  },
    { id:"mine_100",  name:"Expert Miner",  emoji:"🏅", description:"Mine 100 ores",      action:"mineCount", threshold:100 },
    { id:"mine_500",  name:"Deep Miner",    emoji:"🥇", description:"Mine 500 ores",      action:"mineCount", threshold:500 },
    // Fishing
    { id:"fish_5",    name:"Fisherman",     emoji:"🎣", description:"Catch 5 fish",       action:"fishCount", threshold:5   },
    { id:"fish_25",   name:"Angler",        emoji:"🐟", description:"Catch 25 fish",      action:"fishCount", threshold:25  },
    { id:"fish_100",  name:"Expert Angler", emoji:"🏅", description:"Catch 100 fish",     action:"fishCount", threshold:100 },
    { id:"fish_500",  name:"Master Fisher", emoji:"🥇", description:"Catch 500 fish",     action:"fishCount", threshold:500 },
    // Crafting
    { id:"craft_5",   name:"Craftsman",     emoji:"⚙️", description:"Craft 5 items",      action:"craftCount", threshold:5   },
    { id:"craft_25",  name:"Artisan",       emoji:"🔨", description:"Craft 25 items",     action:"craftCount", threshold:25  },
    { id:"craft_100", name:"Master Crafter",emoji:"🏅", description:"Craft 100 items",    action:"craftCount", threshold:100 },
    { id:"craft_500", name:"Grand Master",  emoji:"🥇", description:"Craft 500 items",    action:"craftCount", threshold:500 },
    // PvP
    { id:"pvp_1",     name:"Fighter",       emoji:"⚔️", description:"Win 1 PvP fight",    action:"pvpWins", threshold:1   },
    { id:"pvp_10",    name:"Warrior",       emoji:"🛡️", description:"Win 10 PvP fights",  action:"pvpWins", threshold:10  },
    { id:"pvp_50",    name:"Champion",      emoji:"🏅", description:"Win 50 PvP fights",  action:"pvpWins", threshold:50  },
    { id:"pvp_250",   name:"Legend",        emoji:"🥇", description:"Win 250 PvP fights", action:"pvpWins", threshold:250 },
    // Market
    { id:"mkt_1",     name:"Merchant",      emoji:"🛒", description:"Make 1 market sale",    action:"marketSales", threshold:1   },
    { id:"mkt_10",    name:"Trader",        emoji:"💼", description:"Make 10 market sales",   action:"marketSales", threshold:10  },
    { id:"mkt_50",    name:"Broker",        emoji:"🏅", description:"Make 50 market sales",   action:"marketSales", threshold:50  },
    { id:"mkt_250",   name:"Market King",   emoji:"🥇", description:"Make 250 market sales",  action:"marketSales", threshold:250 },
  ];

  private initAchievements(player: Player): void {
    for (const def of GameRoom.ACHIEVEMENT_DEFS) {
      const a = new AchievementState();
      a.id = def.id; a.name = def.name; a.emoji = def.emoji;
      a.description = def.description; a.unlocked = false; a.unlockedAt = 0;
      player.achievements.set(def.id, a);
    }
  }

  private checkAchievements(player: Player, sessionId: string): void {
    const client = this.clients.find(c => c.sessionId === sessionId);
    for (const def of GameRoom.ACHIEVEMENT_DEFS) {
      const ach = player.achievements.get(def.id);
      if (!ach || ach.unlocked) continue;
      const count = player.actionCounts.get(def.action) || 0;
      if (count >= def.threshold) {
        ach.unlocked = true;
        ach.unlockedAt = Date.now();
        client?.send("achievement-unlocked", { id: def.id, name: def.name, emoji: def.emoji, description: def.description });
        console.log(`[Achievement] ${player.username || sessionId.slice(0,6)} unlocked: ${def.name}`);
      }
    }
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

      const placedObjects: Array<{ id: string; type: string; x: number; y: number; scale: number; animSpeed: number; mapId: string }> = [];
      this.state.placedObjects.forEach((val) => {
        placedObjects.push({ id: val.id, type: val.type, x: val.x, y: val.y, scale: val.scale, animSpeed: val.animSpeed, mapId: val.mapId || "main" });
      });

      const crops: Array<{ key: string; cropType: string; stage: number; plantedAt: number; mapId: string }> = [];
      this.state.crops.forEach((val) => {
        crops.push({ key: val.key, cropType: val.cropType, stage: val.stage, plantedAt: val.plantedAt, mapId: val.mapId || "main" });
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
          const newKey = key.includes(":") ? key : `main:${key}`;
          this.state.mapData.set(newKey, parsed.mapData[key]);
        }
      }

      if (parsed.decorData) {
        for (const key in parsed.decorData) {
          const newKey = key.includes(":") ? key : `main:${key}`;
          this.state.decorData.set(newKey, parsed.decorData[key]);
        }
      }

      if (parsed.placedObjects) {
        parsed.placedObjects.forEach((o: any) => {
          const obj = new PlacedObjectState();
          obj.id = o.id;
          obj.type = o.type;
          obj.x = o.x;
          obj.y = o.y;
          obj.scale = o.scale;
          obj.animSpeed = o.animSpeed !== undefined ? o.animSpeed : 1.0;
          obj.mapId = o.mapId || "main";
          this.state.placedObjects.set(o.id, obj);
        });
      }

      if (parsed.crops) {
        parsed.crops.forEach((c: any) => {
          const crop = new CropState();
          crop.key = c.key.includes(":") ? c.key : `main:${c.key}`;
          crop.cropType = c.cropType;
          crop.stage = c.stage;
          crop.plantedAt = c.plantedAt;
          crop.mapId = c.mapId || "main";
          this.state.crops.set(crop.key, crop);
        });
      }

      console.log(`[Persistence] Loaded. Tiles: ${this.state.mapData.size}, Objects: ${this.state.placedObjects.size}, Crops: ${this.state.crops.size}`);
    } catch (e) {
      console.error("[Persistence] Failed to read/parse save_data.json file", e);
    }
  }
}
