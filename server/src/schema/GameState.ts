import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

/**
 * CropState — represents a planted crop on a farm tile.
 */
export class CropState extends Schema {
  @type("string")  key: string = "";        // "x,y" coordinate
  @type("string")  cropType: string = "";   // "Pumpkin", "Tomato", etc.
  @type("int32")   stage: number = 0;       // 0-6 growth stage
  @type("float64") plantedAt: number = 0;   // Unix timestamp (ms)
}

/**
 * PlacedObjectState — represents a building object placed in the game world.
 */
export class PlacedObjectState extends Schema {
  @type("string")  id: string = "";
  @type("string")  type: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") scale: number = 0.15;
  @type("float32") animSpeed: number = 1.0;
}

/**
 * SkillState — XP and level for a single profession.
 */
export class SkillState extends Schema {
  @type("string")  name: string = "";
  @type("int32")   xp: number = 0;
  @type("int32")   level: number = 1;
}

/**
 * MarketListing — a single item listed on the marketplace.
 */
export class MarketListing extends Schema {
  @type("string")  id: string = "";
  @type("string")  sellerId: string = "";
  @type("string")  sellerName: string = "";
  @type("string")  itemType: string = "";
  @type("string")  itemCategory: string = "";
  @type("int32")   quantity: number = 1;
  @type("int32")   pricePerUnit: number = 1;
  @type("float64") listedAt: number = 0;
}

/**
 * ChatMessage — a single chat message.
 */
export class ChatMessage extends Schema {
  @type("string")  id: string = "";
  @type("string")  senderId: string = "";
  @type("string")  senderName: string = "";
  @type("string")  channel: string = "global";
  @type("string")  text: string = "";
  @type("float64") timestamp: number = 0;
}

/**
 * Player — represents one connected player in the game world.
 */
export class Player extends Schema {
  @type("float32") x: number = 400;
  @type("float32") y: number = 300;
  @type("string")  color: string = "#ffffff";
  @type("string")  sessionId: string = "";
  @type("string")  state: string = "idle";
  @type("string")  direction: string = "down";
  @type("string")  skin: string = "farmer_1";

  // Username (set once, permanent)
  @type("string")  username: string = "";
  @type("boolean") usernameSet: boolean = false;

  // Language preference
  @type("string")  language: string = "en";

  // Economy
  @type({ map: "int32" }) inventory = new MapSchema<number>();
  @type("int32") gold: number = 100;
  @type("int32") gem: number = 0;
  @type("int32") coin: number = 0; // FARM coin
  @type({ map: "int32" }) seeds = new MapSchema<number>();

  // Skills (farming, combat, woodcutting, mining, fishing, crafting)
  @type({ map: SkillState }) skills = new MapSchema<SkillState>();
  @type("int32") totalLevel: number = 1;

  // Skill boosts (permanent XP multipliers per skill, stored as % bonus)
  @type({ map: "int32" }) skillBoosts = new MapSchema<number>();

  // Friend system
  @type({ map: "string" }) friends = new MapSchema<string>();        // sessionId -> username
  @type({ map: "string" }) friendRequests = new MapSchema<string>(); // fromSessionId -> fromUsername
}

/**
 * GameState — the root state object for a GameRoom.
 */
export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: "int32" }) mapData = new MapSchema<number>();
  @type({ map: "int32" }) decorData = new MapSchema<number>();
  @type({ map: PlacedObjectState }) placedObjects = new MapSchema<PlacedObjectState>();
  @type({ map: CropState }) crops = new MapSchema<CropState>();
  @type({ map: MarketListing }) marketListings = new MapSchema<MarketListing>();
  @type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
}
