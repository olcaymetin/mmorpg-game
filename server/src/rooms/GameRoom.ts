import { Room, Client } from "colyseus";
import { GameState, Player } from "../schema/GameState";

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

// ─── Message types ────────────────────────────────────────────────────────────

interface MoveMessage {
  dx: number; // expected: -1 | 0 | 1
  dy: number; // expected: -1 | 0 | 1
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export class GameRoom extends Room<GameState> {
  private colorIndex = 0;

  /**
   * onCreate — called once when the room is first created.
   * We initialize state, set patch rate, and register message handlers.
   */
  onCreate(): void {
    this.setState(new GameState());

    // Broadcast state to clients at 20 fps (every 50 ms)
    this.setPatchRate(1000 / 20);

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
        // (Unless they are doing a lock-in action, don't override it)
        if (player.state === "walk") {
          player.state = "idle";
        }
      }
    });

    /**
     * "action" message handler.
     * Triggers lock-in actions (chopping, fishing, tilling, watering).
     * Format: { type: "chop" | "fish" | "dig" | "water" | "idle", direction?: "down" | "up" | "left" | "right" }
     */
    this.onMessage("action", (client: Client, msg: { type: string; direction?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.state = msg.type;
      if (msg.direction) {
        player.direction = msg.direction;
      }
    });
  }

  /**
   * onJoin — called for each new client connection.
   * Creates a Player entry in state with a unique color, skin, and spawn position.
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
}
