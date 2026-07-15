/**
 * Client-side schema mirror of the server's GameState.
 *
 * WHY "defineTypes" instead of @type decorators?
 * Vite uses esbuild for TypeScript compilation, which does NOT support
 * "emitDecoratorMetadata". @colyseus/schema's @type decorator relies on
 * this metadata. To avoid the incompatibility, we use the functional
 * `defineTypes()` API, which is fully equivalent and works in any bundler.
 */
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

// ─── Player ──────────────────────────────────────────────────────────────────

export class Player extends Schema {
  x!: number;
  y!: number;
  color!: string;
  sessionId!: string;
  state!: string;
  direction!: string;
  skin!: string;
}

defineTypes(Player, {
  x: "float32",
  y: "float32",
  color: "string",
  sessionId: "string",
  state: "string",
  direction: "string",
  skin: "string",
});

// ─── GameState ────────────────────────────────────────────────────────────────

export class GameState extends Schema {
  players!: MapSchema<Player>;
}

defineTypes(GameState, {
  players: { map: Player },
});
