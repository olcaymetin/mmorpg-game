import { Schema, MapSchema, type } from "@colyseus/schema";

/**
 * PlacedObjectState — represents a building object (marketplace, bank, games, blacksmith)
 * placed in the game world, synchronized to all clients.
 */
export class PlacedObjectState extends Schema {
  @type("string")  id: string = "";
  @type("string")  type: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") scale: number = 0.15;
}

/**
 * Player — represents one connected player in the game world.
 */
export class Player extends Schema {
  @type("float32") x: number = 400;
  @type("float32") y: number = 300;
  @type("string")  color: string = "#ffffff";
  @type("string")  sessionId: string = "";
  @type("string")  state: string = "idle";       // "idle", "walk", "chop", "water", "dig", "fish"
  @type("string")  direction: string = "down";   // "down", "up", "left", "right"
  @type("string")  skin: string = "farmer_1";    // "farmer_1", "farmer_2", "body_2"
}

/**
 * GameState — the root state object for a GameRoom.
 */
export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: "int32" }) mapData = new MapSchema<number>(); // Key is "x,y" coordinate string, Value is tile index
  @type({ map: PlacedObjectState }) placedObjects = new MapSchema<PlacedObjectState>(); // Key is object ID
}
