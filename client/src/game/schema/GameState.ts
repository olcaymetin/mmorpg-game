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

// ─── CropState ───────────────────────────────────────────────────────────────

export class CropState extends Schema {
  key!: string;
  cropType!: string;
  stage!: number;
  plantedAt!: number;
}

defineTypes(CropState, {
  key: "string",
  cropType: "string",
  stage: "int32",
  plantedAt: "float64",
});

// ─── PlacedObjectState ────────────────────────────────────────────────────────

export class PlacedObjectState extends Schema {
  id!: string;
  type!: string;
  x!: number;
  y!: number;
  scale!: number;
  animSpeed!: number;
}

defineTypes(PlacedObjectState, {
  id: "string",
  type: "string",
  x: "float32",
  y: "float32",
  scale: "float32",
  animSpeed: "float32",
});

// ─── Player ──────────────────────────────────────────────────────────────────

export class Player extends Schema {
  x!: number;
  y!: number;
  color!: string;
  sessionId!: string;
  state!: string;
  direction!: string;
  skin!: string;
  inventory!: MapSchema<number>;
  gold!: number;
  seeds!: MapSchema<number>;
}

defineTypes(Player, {
  x: "float32",
  y: "float32",
  color: "string",
  sessionId: "string",
  state: "string",
  direction: "string",
  skin: "string",
  inventory: { map: "int32" },
  gold: "int32",
  seeds: { map: "int32" },
});

// ─── GameState ────────────────────────────────────────────────────────────────

export class GameState extends Schema {
  players!: MapSchema<Player>;
  mapData!: MapSchema<number>;
  decorData!: MapSchema<number>;
  placedObjects!: MapSchema<PlacedObjectState>;
  crops!: MapSchema<CropState>;
}

defineTypes(GameState, {
  players: { map: Player },
  mapData: { map: "int32" },
  decorData: { map: "int32" },
  placedObjects: { map: PlacedObjectState },
  crops: { map: CropState },
});
