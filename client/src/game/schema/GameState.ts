import { Schema, MapSchema, ArraySchema, defineTypes } from "@colyseus/schema";

export class CropState extends Schema { key!: string; cropType!: string; stage!: number; plantedAt!: number; }
defineTypes(CropState, { key: "string", cropType: "string", stage: "int32", plantedAt: "float64" });

export class PlacedObjectState extends Schema { id!: string; type!: string; x!: number; y!: number; scale!: number; animSpeed!: number; }
defineTypes(PlacedObjectState, { id: "string", type: "string", x: "float32", y: "float32", scale: "float32", animSpeed: "float32" });

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

export class Player extends Schema {
  x!: number; y!: number; color!: string; sessionId!: string;
  state!: string; direction!: string; skin!: string;
  username!: string; usernameSet!: boolean; language!: string;
  inventory!: MapSchema<number>;
  gold!: number; gem!: number; coin!: number;
  seeds!: MapSchema<number>;
  hp!: number; maxHp!: number; shield!: number; maxShield!: number;
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
}
defineTypes(Player, {
  x: "float32", y: "float32", color: "string", sessionId: "string",
  state: "string", direction: "string", skin: "string",
  username: "string", usernameSet: "boolean", language: "string",
  inventory: { map: "int32" }, gold: "int32", gem: "int32", coin: "int32",
  seeds: { map: "int32" },
  hp: "int32", maxHp: "int32", shield: "int32", maxShield: "int32",
  skills: { map: SkillState }, totalLevel: "int32",
  skillBoosts: { map: "int32" },
  actionCounts: { map: "int32" },
  marketSaleCount: "int32", marketSaleVolume: "int32",
  achievements: { map: AchievementState },
  friends: { map: "string" }, friendRequests: { map: "string" },
  rodTier: "int32",
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
}
defineTypes(GameState, {
  players: { map: Player },
  mapData: { map: "int32" }, decorData: { map: "int32" },
  placedObjects: { map: PlacedObjectState },
  crops: { map: CropState },
  marketListings: { map: MarketListing },
  chatMessages: [ ChatMessage ],
  marketHistory: [ MarketHistory ],
});
