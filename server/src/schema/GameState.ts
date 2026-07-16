import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class CropState extends Schema {
  @type("string")  key: string = "";
  @type("string")  cropType: string = "";
  @type("int32")   stage: number = 0;
  @type("float64") plantedAt: number = 0;
  @type("string")  mapId: string = "main";
}

export class PlacedObjectState extends Schema {
  @type("string")  id: string = "";
  @type("string")  type: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") scale: number = 0.15;
  @type("float32") animSpeed: number = 1.0;
  @type("string")  mapId: string = "main";
}

export class SkillState extends Schema {
  @type("string")  name: string = "";
  @type("int32")   xp: number = 0;
  @type("int32")   level: number = 1;
}

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

export class MarketHistory extends Schema {
  @type("string")  itemType: string = "";
  @type("int32")   quantity: number = 1;
  @type("int32")   pricePerUnit: number = 1;
  @type("float64") timestamp: number = 0;
}

export class ChatMessage extends Schema {
  @type("string")  id: string = "";
  @type("string")  senderId: string = "";
  @type("string")  senderName: string = "";
  @type("string")  channel: string = "global";
  @type("string")  text: string = "";
  @type("float64") timestamp: number = 0;
}

export class AchievementState extends Schema {
  @type("string")  id: string = "";
  @type("string")  name: string = "";
  @type("string") description: string = "";
  @type("string")  emoji: string = "";
  @type("boolean") unlocked: boolean = false;
  @type("float64") unlockedAt: number = 0;
}

export class GuildState extends Schema {
  @type("string")  id: string = "";
  @type("string")  name: string = "";
  @type("int32")   level: number = 1;
  @type("int32")   xp: number = 0;
  @type("string")  ownerId: string = "";
  @type({ map: "string" }) members = new MapSchema<string>(); // sessionId -> username
}

export class Player extends Schema {
  @type("float32") x: number = 400;
  @type("float32") y: number = 300;
  @type("string")  color: string = "#ffffff";
  @type("string")  sessionId: string = "";
  @type("string")  state: string = "idle";
  @type("string")  direction: string = "down";
  @type("string")  skin: string = "farmer_1";
  @type("string")  currentMap: string = "main";

  @type("string")  username: string = "";
  @type("boolean") usernameSet: boolean = false;
  @type("string")  language: string = "en";

  // Economy
  @type({ map: "int32" }) inventory = new MapSchema<number>();
  @type("int32") gold: number = 100;
  @type("int32") gem: number = 0;
  @type("int32") coin: number = 0;
  @type({ map: "int32" }) seeds = new MapSchema<number>();

  // Stats
  @type("int32") hp: number = 100;
  @type("int32") maxHp: number = 100;
  @type("int32") shield: number = 100;
  @type("int32") maxShield: number = 100;

  // Survival
  @type("int32") hunger: number = 100;
  @type("int32") thirst: number = 100;

  // Guild
  @type("string") guildId: string = "";

  // Skills
  @type({ map: SkillState }) skills = new MapSchema<SkillState>();
  @type("int32") totalLevel: number = 1;
  @type({ map: "int32" }) skillBoosts = new MapSchema<number>();

  // Action counters
  @type({ map: "int32" }) actionCounts = new MapSchema<number>();

  // Marketplace stats
  @type("int32") marketSaleCount: number = 0;
  @type("int32") marketSaleVolume: number = 0;

  // Achievements
  @type({ map: AchievementState }) achievements = new MapSchema<AchievementState>();

  // Friends
  @type({ map: "string" }) friends = new MapSchema<string>();
  @type({ map: "string" }) friendRequests = new MapSchema<string>();

  // Fishing
  @type("int32") rodTier: number = 1;
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: "int32" }) mapData = new MapSchema<number>();
  @type({ map: "int32" }) decorData = new MapSchema<number>();
  @type({ map: PlacedObjectState }) placedObjects = new MapSchema<PlacedObjectState>();
  @type({ map: CropState }) crops = new MapSchema<CropState>();
  @type({ map: MarketListing }) marketListings = new MapSchema<MarketListing>();
  @type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
  @type([MarketHistory]) marketHistory = new ArraySchema<MarketHistory>();
  @type({ map: GuildState }) guilds = new MapSchema<GuildState>();
}
