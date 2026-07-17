import { Schema, MapSchema, ArraySchema, defineTypes } from "@colyseus/schema";

export class CropState extends Schema { key!: string; cropType!: string; stage!: number; plantedAt!: number; mapId!: string; }
defineTypes(CropState, { key: "string", cropType: "string", stage: "int32", plantedAt: "float64", mapId: "string" });

export class PlacedObjectState extends Schema { id!: string; type!: string; x!: number; y!: number; scale!: number; animSpeed!: number; mapId!: string; angle!: number; flipX!: boolean; }
defineTypes(PlacedObjectState, { id: "string", type: "string", x: "float32", y: "float32", scale: "float32", animSpeed: "float32", mapId: "string", angle: "float32", flipX: "boolean" });

export class SkillState extends Schema { name!: string; xp!: number; level!: number; }
defineTypes(SkillState, { name: "string", xp: "int32", level: "int32" });

export class MarketListing extends Schema {
  id!: string; sellerId!: string; sellerName!: string;
  itemType!: string; itemCategory!: string; quantity!: number; pricePerUnit!: number; listedAt!: number;
}
defineTypes(MarketListing, { id: "string", sellerId: "string", sellerName: "string", itemType: "string", itemCategory: "string", quantity: "int32", pricePerUnit: "int32", listedAt: "float64" });

export class MarketHistory extends Schema { itemType!: string; quantity!: number; pricePerUnit!: number; timestamp!: number; }
defineTypes(MarketHistory, { itemType: "string", quantity: "int32", pricePerUnit: "int32", timestamp: "float64" });

export class ChatMessage extends Schema { id!: string; senderId!: string; senderName!: string; channel!: string; text!: string; timestamp!: number; }
defineTypes(ChatMessage, { id: "string", senderId: "string", senderName: "string", channel: "string", text: "string", timestamp: "float64" });

export class AchievementState extends Schema { id!: string; name!: string; description!: string; emoji!: string; unlocked!: boolean; unlockedAt!: number; }
defineTypes(AchievementState, { id: "string", name: "string", description: "string", emoji: "string", unlocked: "boolean", unlockedAt: "float64" });

export class GuildState extends Schema { id!: string; name!: string; level!: number; xp!: number; ownerId!: string; members!: MapSchema<string>; }
defineTypes(GuildState, { id: "string", name: "string", level: "int32", xp: "int32", ownerId: "string", members: { map: "string" } });

export class Player extends Schema {
  x!: number; y!: number; color!: string; sessionId!: string;
  state!: string; direction!: string; skin!: string;
  username!: string; usernameSet!: boolean; language!: string;
  inventory!: MapSchema<number>;
  gold!: number; gem!: number; coin!: number;
  seeds!: MapSchema<number>;
  hp!: number; maxHp!: number; shield!: number; maxShield!: number;
  hunger!: number; thirst!: number;
  guildId!: string;
  skills!: MapSchema<SkillState>;
  totalLevel!: number;
  skillBoosts!: MapSchema<number>;
  actionCounts!: MapSchema<number>;
  marketSaleCount!: number;
  marketSaleVolume!: number;
  achievements!: MapSchema<AchievementState>;
  friends!: MapSchema<string>;
  friendRequests!: MapSchema<string>;
  rodTier!: number;
  currentMap!: string;
  characterCreated!: boolean;
  gender!: string;
  skinTone!: string;
  hairStyle!: string;
  hairColor!: string;
  eyeColor!: string;
  clothesColor!: string;
  beardColor!: string;
  accItem!: string;
  equippedHelmet!: string;
  equippedChestplate!: string;
  equippedLeggings!: string;
  equippedBoots!: string;
  equippedWeapon!: string;
  mountType!: string;
  isRiding!: boolean;
  ownedCosmetics!: MapSchema<boolean>;
}
defineTypes(Player, {
  x: "float32", y: "float32", color: "string", sessionId: "string",
  state: "string", direction: "string", skin: "string",
  username: "string", usernameSet: "boolean", language: "string",
  inventory: { map: "int32" }, gold: "int32", gem: "int32", coin: "int32",
  seeds: { map: "int32" },
  hp: "int32", maxHp: "int32", shield: "int32", maxShield: "int32",
  hunger: "int32", thirst: "int32",
  guildId: "string",
  skills: { map: SkillState }, totalLevel: "int32",
  skillBoosts: { map: "int32" },
  actionCounts: { map: "int32" },
  marketSaleCount: "int32", marketSaleVolume: "int32",
  achievements: { map: AchievementState },
  friends: { map: "string" }, friendRequests: { map: "string" },
  rodTier: "int32",
  currentMap: "string",
  characterCreated: "boolean",
  gender: "string",
  skinTone: "string",
  hairStyle: "string",
  hairColor: "string",
  eyeColor: "string",
  clothesColor: "string",
  beardColor: "string",
  accItem: "string",
  equippedHelmet: "string",
  equippedChestplate: "string",
  equippedLeggings: "string",
  equippedBoots: "string",
  equippedWeapon: "string",
  mountType: "string",
  isRiding: "boolean",
  ownedCosmetics: { map: "boolean" }
});

export class CustomAssetState extends Schema {
  key!: string;
  path!: string;
  label!: string;
  fw!: number;
  fh!: number;
  scale!: number;
  width!: number;
  height!: number;
}
defineTypes(CustomAssetState, {
  key: "string",
  path: "string",
  label: "string",
  fw: "int32",
  fh: "int32",
  scale: "float32",
  width: "int32",
  height: "int32"
});

export class GameState extends Schema {
  players!: MapSchema<Player>;
  mapData!: MapSchema<number>;
  decorData!: MapSchema<number>;
  placedObjects!: MapSchema<PlacedObjectState>;
  crops!: MapSchema<CropState>;
  marketListings!: MapSchema<MarketListing>;
  chatMessages!: ArraySchema<ChatMessage>;
  marketHistory!: ArraySchema<MarketHistory>;
  guilds!: MapSchema<GuildState>;
  customAssets!: MapSchema<CustomAssetState>;
}
defineTypes(GameState, {
  players: { map: Player },
  mapData: { map: "int32" }, decorData: { map: "int32" },
  placedObjects: { map: PlacedObjectState },
  crops: { map: CropState },
  marketListings: { map: MarketListing },
  chatMessages: [ ChatMessage ],
  marketHistory: [ MarketHistory ],
  guilds: { map: GuildState },
  customAssets: { map: CustomAssetState }
});
