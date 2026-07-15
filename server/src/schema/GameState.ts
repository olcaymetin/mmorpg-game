import { Schema, MapSchema, type } from "@colyseus/schema";

/**
 * Player — represents one connected player in the game world.
 * All fields decorated with @type are synchronized to every client
 * via Colyseus's binary delta-patch protocol.
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
 * `players` is a MapSchema keyed by sessionId.
 */
export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
