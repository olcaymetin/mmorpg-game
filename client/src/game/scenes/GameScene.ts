import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { GameState, Player, PlacedObjectState } from "../schema/GameState";
import { EXTRA_PACK_SPRITESHEETS } from "../../App";
import { NPC, spawnNPCs } from "./NPCSystem";

// ─── World & rendering constants ──────────────────────────────────────────────
export const WORLD_W  = 1600; // 50 columns * 32px
export const WORLD_H  = 1280; // 40 rows * 32px
const TILE_SIZE        = 32;   // grid cell size in pixels
const SEND_INTERVAL_MS = 50;   // throttle: max 1 send per 50 ms = 20 fps

// ─── Types ───────────────────────────────────────────────────────────────────

interface SceneData {
  room: Room<GameState>;
  sessionId: string;
}

interface PlayerEntity {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  isLayered?: boolean;
  layers?: {
    skin: Phaser.GameObjects.Sprite;
    eyes?: Phaser.GameObjects.Sprite;
    hair?: Phaser.GameObjects.Sprite;
    beard?: Phaser.GameObjects.Sprite;
    clothes?: Phaser.GameObjects.Sprite;
    acc?: Phaser.GameObjects.Sprite;
    tool?: Phaser.GameObjects.Sprite;
    mount?: Phaser.GameObjects.Sprite;
  };
}

interface PlacedObject {
  id: string;
  type: string;
  x: number;
  y: number;
  scale: number;
  angle?: number;
  flipX?: boolean;
  blocked?: boolean;
  imageObj?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
}

// ─── Scene ───────────────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  // ── Colyseus ───────────────────────────────────────────────────────────────
  private room!: Room<GameState>;
  private localId!: string;

  // ── Entities (one per player) ──────────────────────────────────────────────
  private entities = new Map<string, PlayerEntity>();

  // ── NPCs ─────────────────────────────────────────────────────────────────
  private npcs: NPC[] = [];

  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // ── Tilemap & Object Editor ────────────────────────────────────────────────
  private map!: Phaser.Tilemaps.Tilemap;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private decorLayer!: Phaser.Tilemaps.TilemapLayer;
  private editorMode = false;
  
  // Brush type: "tile" | "eraser" | "object"
  private currentBrushType = "tile";
  private currentTileIndex = 0;
  private currentTileStamp: { width: number; height: number; tiles: number[][] } | null = null;
  private currentObjectName = "marketplace";
  private activeBrushRotationStep = 0;
  private activeBrushFlipX = false;
  private activeBrushFlipY = false;
  private paintOnTop = false;

  // Placed Objects list
  private placedObjects: PlacedObject[] = [];
  private selectedObjectId: string | null = null;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private activePlayTool: string | null = null;
  private lastPlacedTime = 0;

  // ── Client-side prediction ────────────────────────────────────────────────
  private localX = 0; // predicted local player X
  private localY = 0; // predicted local player Y
  private lastSentMs = 0;
  private isMoving = false;
  private isFishingTimelineActive = false;
  private localFishingDir: string | null = null;
  private lineDrawStart: { x: number; y: number } | null = null;
  private tempLineGraphics: Phaser.GameObjects.Graphics | null = null;


  // Drag Panning & Dragging Objects
  private isDraggingCamera = false;
  private isDraggingObject = false;
  private clickedGameObject = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  // Su tile GID aralıkları (terrains.png, startGid=0, 32 sütun)
  // Mavi hexagonal su deseni ve geçiş tile'ları
  private static readonly WATER_TILE_GIDS: ReadonlySet<number> = new Set([
    // terrains.png'deki su tile'ları — satır×32+sütun formatında
    // Satır 0: su köşe geçişleri (sütun 3-8)
    3, 4, 5, 6, 7, 8,
    // Satır 1: ana su tile'ları (sütun 3-8)
    35, 36, 37, 38, 39, 40,
    // Satır 2: su alt geçişleri (sütun 3-8)
    67, 68, 69, 70, 71, 72,
  ]);

  public currentMapId = "main";
  public mapWidth = 1600;
  public mapHeight = 1280;
  private lastTeleportTime = 0;
  private lastTeleportCheckTime = 0;
  private gridOverlayGraphics!: Phaser.GameObjects.Graphics;

  // ── State variables ────────────────────────────────────────────────────────
  public virtualLeft = false;
  public virtualRight = false;
  public virtualUp = false;
  public virtualDown = false;


  // ── Crop Farming ───────────────────────────────────────────────────────────
  // Maps tile key "x,y" -> the sprite shown on that tile
  private cropSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private selectedSeed = ""; // empty = not in seed mode

  // Crop metadata: plantH = the pixel row where the number strip begins
  // (i.e. only pixels 0..plantH-1 contain actual plant art — no numbers below)
  // Values verified by pixel analysis of each PNG file.
  static readonly CROP_META: Record<string, { frameH: number; plantH: number }> = {
    Cabbage:      { frameH: 32, plantH: 16 }, Carrot:       { frameH: 32, plantH: 16 },
    Cauliflower:  { frameH: 32, plantH: 16 }, Coffee:       { frameH: 64, plantH: 32 },
    Corn:         { frameH: 64, plantH: 32 }, Cotton:       { frameH: 32, plantH: 16 },
    Grape:        { frameH: 96, plantH: 64 }, Onion:        { frameH: 64, plantH: 32 },
    Pepper:       { frameH: 32, plantH: 16 }, Pineapple:    { frameH: 64, plantH: 32 },
    Prickly_Pear: { frameH: 96, plantH: 48 }, Pumpkin:      { frameH: 64, plantH: 32 },
    Radish:       { frameH: 32, plantH: 16 }, Strawberry:   { frameH: 32, plantH: 16 },
    Tomato:       { frameH: 64, plantH: 32 }, Turnip:       { frameH: 48, plantH: 32 },
    Watermelon:   { frameH: 64, plantH: 32 }, Wheat:        { frameH: 32, plantH: 16 },
    Zuchini:      { frameH: 64, plantH: 32 },
  };

  constructor() {
    super({ key: "GameScene" });
  }

  // ─── Phaser lifecycle ─────────────────────────────────────────────────────

  preload(): void {
    // Load character spritesheets (48x64 frame cells, 128 columns, 13 rows)
    this.load.spritesheet("farmer_1", "assets/characters/Farmer_1_16x16.png", {
      frameWidth: 48,
      frameHeight: 64,
    });
    this.load.spritesheet("farmer_2", "assets/characters/Farmer_2_16x16.png", {
      frameWidth: 48,
      frameHeight: 64,
    });
    this.load.spritesheet("body_2", "assets/characters/Body_2_16x16.png", {
      frameWidth: 48,
      frameHeight: 64,
    });

    // Load terrains spritesheet (16x16 tiles)
    this.load.spritesheet("terrains", "assets/terrains.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet("zemin2", "assets/zemin2.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet("iskele", "assets/iskele.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet("dekor2", "assets/dekor2.png", {
      frameWidth: 16,
      frameHeight: 16,
    });

    // Load building images
    this.load.image("marketplace", "assets/marketplace.png");
    this.load.image("bank", "assets/bank.png");
    this.load.image("games", "assets/games.png");
    this.load.image("blacksmith", "assets/blacksmith.png");
    this.load.image("shop", "assets/shop.png");
    this.load.image("gem_trader", "assets/gem_trader.png");
    this.load.image("farmer_npc", "assets/farmer_npc.png");
    this.load.image("fences", "assets/fences.png");
    this.load.image("silo", "assets/silo.png");
    this.load.image("silo2", "assets/silo2.png");
    this.load.image("nft_house", "assets/nft_house.png");
    this.load.image("yon_up", "assets/yon_up.png");
    this.load.image("yon_down", "assets/yon_down.png");
    this.load.image("yon_left", "assets/yon_left.png");
    this.load.image("yon_right", "assets/yon_right.png");

    // Preload mine assets
    this.load.image("rock_big", "assets/rock_big.png");
    this.load.image("rock_big_blue", "assets/rock_big_blue.png");
    this.load.image("rock_big_red", "assets/rock_big_red.png");
    this.load.image("rock_medium", "assets/rock_medium.png");
    this.load.image("rock_medium_gold", "assets/rock_medium_gold.png");
    this.load.image("rock_medium_silver", "assets/rock_medium_silver.png");
    this.load.image("rock_small", "assets/rock_small.png");
    this.load.image("rock_small_bronze", "assets/rock_small_bronze.png");
    this.load.image("rock_small_silver", "assets/rock_small_silver.png");

    // Preload new house / crafting table assets
    this.load.image("house_barn_small", "assets/house_barn_small.png");
    this.load.image("house_farmer_2", "assets/house_farmer_2.png");
    this.load.image("house_stable", "assets/house_stable.png");
    this.load.image("house_oven", "assets/house_oven.png");
    this.load.image("table_tailor", "assets/table_tailor.png");
    this.load.image("table_woodwork", "assets/table_woodwork.png");

    // Load gift effects as spritesheets
    this.load.spritesheet("vfx_leaf_single", "assets/gift/Modern_Farm_vfx_Falling_Leaf_16x16.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("vfx_leaves_1", "assets/gift/Modern_Farm_vfx_Falling_Leaves_16x16.png", { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet("vfx_leaves_2", "assets/gift/Modern_Farm_vfx_Falling_Leaves_2_16x16.png", { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet("vfx_leaves_3", "assets/gift/Modern_Farm_vfx_Falling_Leaves_3_16x16.png", { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet("vfx_leaves_brown", "assets/gift/Modern_Farm_vfx_Falling_Leaves_Brown_16x16.png", { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet("vfx_leaves_yellow", "assets/gift/Modern_Farm_vfx_Falling_Leaves_Yellow_16x16.png", { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet("vfx_smoke", "assets/gift/Stone_Oven_Smoke_Effect_16x16.png", { frameWidth: 64, frameHeight: 64 });

    // Load customization items
    for (let i = 1; i <= 11; i++) {
      this.load.image(`decor_grass_${i}`, `assets/customization/Grass_Tufts_Flowers_${i}.png`);
    }
    this.load.spritesheet("decor_sheet_gorsel", "assets/customization/gorsel.png", { frameWidth: 16, frameHeight: 16 });

    // Load ahir assets
    const ahirFiles = [
      { key: "ahir_front_green", file: "Front_Hayloft_Green_16x16.png" },
      { key: "ahir_front_grey", file: "Front_Hayloft_Grey_16x16.png" },
      { key: "ahir_front_red", file: "Front_Hayloft_Red_16x16.png" },
      { key: "ahir_front_yellow", file: "Front_Hayloft_Yellow_16x16.png" },
      { key: "ahir_green_bottom_inside", file: "Hayloft_Green_Bottom_Inside_16x16.png" },
      { key: "ahir_grey_bottom_inside", file: "Hayloft_Grey_Bottom_Inside_16x16.png" },
      { key: "ahir_middle_modular_inside", file: "Hayloft_Middle_Modular_Inside_16x16.png" },
      { key: "ahir_red_bottom_inside", file: "Hayloft_Red_Bottom_Inside_16x16.png" },
      { key: "ahir_upper_inside", file: "Hayloft_Upper_Inside_16x16.png" },
      { key: "ahir_yellow_bottom_inside", file: "Hayloft_Yellow_Bottom_Inside_16x16.png" },
      { key: "ahir_roof_middle_modular", file: "Roof_Hayloft_Middle_Modular_16x16.png" },
      { key: "ahir_roof_top", file: "Roof_Hayloft_Top_16x16.png" }
    ];
    for (const fileObj of ahirFiles) {
      this.load.image(fileObj.key, `assets/ahir/${fileObj.file}`);
    }

    this.load.spritesheet("farm_tile_sheet", "assets/tarla.png", { frameWidth: 418, frameHeight: 418 });

    // Load material gift items as spritesheets
    this.load.spritesheet("mg_stable_gate", "assets/material_gift/Stable_Gate_16x16.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("mg_stable_gate_lb", "assets/material_gift/Stable_Gate_Light_Brown_16x16.png", { frameWidth: 32, frameHeight: 25 });
    this.load.spritesheet("mg_well", "assets/material_gift/Well_16x16.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("mg_crate_1", "assets/material_gift/Wooden_Crate_1_16x16.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("mg_crate_2", "assets/material_gift/Wooden_Crate_2_16x16.png", { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet("mg_wooden_gate", "assets/material_gift/Wooden_Gate_16x16.png", { frameWidth: 32, frameHeight: 32 });

    // Hediye Balıklar - Animasyonlu Balık Spotu GIF'leri
    for (let i = 1; i <= 6; i++) {
      this.load.spritesheet(
        `mg_gift_fish_${i}`,
        `assets/pack/objects/exterior/gift_balik/best_fish_point_${i}.png`,
        { frameWidth: 16, frameHeight: 16 }
      );
    }

    // Load crop growth stage images as plain images — frames are defined manually
    // in create() to exclude the 16px stage-number strip at the bottom.
    for (const cropName of Object.keys(GameScene.CROP_META)) {
      const fileName = `${cropName}_Growth_Stages_16x16.png`;
      this.load.image(`crop_${cropName}`, `assets/crops/${fileName}`);
    }

    // ─── Farm RPG Pack Character Spritesheets Preload ────────────────────────
    const charBase = "assets/pack/char";

    // 1. Skins
    for (let t = 1; t <= 4; t++) {
      this.load.spritesheet(`pack_skin_${t}_idle`, `${charBase}/idle/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_skin_${t}_walk`, `${charBase}/walk/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_skin_${t}_run`, `${charBase}/run/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // 2. Hairs
    const stylesList = ["Standard", "Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist"];
    const colorsList = ["Black", "Blonde", "Brown", "Ginger"];
    for (const s of stylesList) {
      for (const c of colorsList) {
        this.load.spritesheet(`pack_hair_${s}_${c}_idle`, `${charBase}/idle/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_hair_${s}_${c}_walk`, `${charBase}/walk/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_hair_${s}_${c}_run`, `${charBase}/run/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      }
    }

    // 3. Clothes
    const clothesList = ["Blue", "Green", "Pink", "Purple", "Red", "White"];
    for (const c of clothesList) {
      this.load.spritesheet(`pack_clothes_${c}_idle`, `${charBase}/idle/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_clothes_${c}_walk`, `${charBase}/walk/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_clothes_${c}_run`, `${charBase}/run/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // 4. Beards
    const beardsList = ["Black", "Blonde", "Brown", "Ginger"];
    for (const b of beardsList) {
      this.load.spritesheet(`pack_beard_${b}_idle`, `${charBase}/idle/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_beard_${b}_walk`, `${charBase}/walk/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_beard_${b}_run`, `${charBase}/run/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // 5. Accessories
    const accsList = ["Beret", "Wizard", "Pirate", "Farm", "Santa_hat", "Leprechaun", "Cook", "Chicken", "Cow", "Frog", "Deer"];
    for (const a of accsList) {
      this.load.spritesheet(`pack_acc_${a}_idle`, `${charBase}/idle/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_acc_${a}_walk`, `${charBase}/walk/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_acc_${a}_run`, `${charBase}/run/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // 6. Eyes
    const gendersList = ["Male", "Female"];
    const eyeColorsList = ["Black", "Blue", "Brown", "Green"];
    for (const g of gendersList) {
      for (const ec of eyeColorsList) {
        this.load.spritesheet(`pack_eyes_${g}_${ec}_idle`, `${charBase}/idle/eyes/${g}/${ec}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_eyes_${g}_${ec}_walk`, `${charBase}/walk/eyes/${g}/${ec}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_eyes_${g}_${ec}_run`, `${charBase}/run/eyes/${g}/${ec}.png`, { frameWidth: 32, frameHeight: 32 });
      }
    }

    // 6.5. Mounts & Riders Preload
    // 6.5.1 Mounts (At & Bisiklet)
    for (let c = 1; c <= 5; c++) {
      this.load.spritesheet(`pack_ride_horse_mount_${c}_idle`, `assets/pack/char/mount_horse_idle/mount/${c}.png`, { frameWidth: 32, frameHeight: 48 });
      this.load.spritesheet(`pack_ride_horse_mount_${c}_walk`, `assets/pack/char/mount_horse_walk/mount/${c}.png`, { frameWidth: 32, frameHeight: 48 });
      this.load.spritesheet(`pack_ride_horse_mount_${c}_run`, `assets/pack/char/mount_horse_run/mount/${c}.png`, { frameWidth: 32, frameHeight: 48 });
    }
    const bikeColors = ["Blue", "Green", "Orange", "Pink", "Red"];
    for (const c of bikeColors) {
      this.load.spritesheet(`pack_ride_bicycle_mount_${c.toLowerCase()}_idle`, `assets/pack/char/mount_bicycle_idle/mount/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_bicycle_mount_${c.toLowerCase()}_run`, `assets/pack/char/mount_bicycle_run/mount/${c}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // 6.5.2 Riders skins
    for (let t = 1; t <= 4; t++) {
      this.load.spritesheet(`pack_ride_horse_skin_${t}_idle`, `assets/pack/char/mount_horse_idle/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_skin_${t}_walk`, `assets/pack/char/mount_horse_walk/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_skin_${t}_run`, `assets/pack/char/mount_horse_run/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });

      this.load.spritesheet(`pack_ride_bicycle_skin_${t}_idle`, `assets/pack/char/mount_bicycle_idle/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_bicycle_skin_${t}_run`, `assets/pack/char/mount_bicycle_run/skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // 6.5.3 Riders cosmetics
    for (const s of stylesList) {
      for (const c of colorsList) {
        this.load.spritesheet(`pack_ride_horse_hair_${s}_${c}_idle`, `assets/pack/char/mount_horse_idle/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_ride_horse_hair_${s}_${c}_walk`, `assets/pack/char/mount_horse_walk/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_ride_horse_hair_${s}_${c}_run`, `assets/pack/char/mount_horse_run/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });

        this.load.spritesheet(`pack_ride_bicycle_hair_${s}_${c}_idle`, `assets/pack/char/mount_bicycle_idle/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_ride_bicycle_hair_${s}_${c}_run`, `assets/pack/char/mount_bicycle_run/hair/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      }
    }
    for (const c of clothesList) {
      this.load.spritesheet(`pack_ride_horse_clothes_${c}_idle`, `assets/pack/char/mount_horse_idle/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_clothes_${c}_walk`, `assets/pack/char/mount_horse_walk/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_clothes_${c}_run`, `assets/pack/char/mount_horse_run/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });

      this.load.spritesheet(`pack_ride_bicycle_clothes_${c}_idle`, `assets/pack/char/mount_bicycle_idle/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_bicycle_clothes_${c}_run`, `assets/pack/char/mount_bicycle_run/clothes/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
    }
    for (const b of beardsList) {
      this.load.spritesheet(`pack_ride_horse_beard_${b}_idle`, `assets/pack/char/mount_horse_idle/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_beard_${b}_walk`, `assets/pack/char/mount_horse_walk/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_beard_${b}_run`, `assets/pack/char/mount_horse_run/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });

      this.load.spritesheet(`pack_ride_bicycle_beard_${b}_idle`, `assets/pack/char/mount_bicycle_idle/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_bicycle_beard_${b}_run`, `assets/pack/char/mount_bicycle_run/acc/Beard/${b}.png`, { frameWidth: 32, frameHeight: 32 });
    }
    for (const a of accsList) {
      this.load.spritesheet(`pack_ride_horse_acc_${a}_idle`, `assets/pack/char/mount_horse_idle/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_acc_${a}_walk`, `assets/pack/char/mount_horse_walk/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_horse_acc_${a}_run`, `assets/pack/char/mount_horse_run/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });

      this.load.spritesheet(`pack_ride_bicycle_acc_${a}_idle`, `assets/pack/char/mount_bicycle_idle/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_ride_bicycle_acc_${a}_run`, `assets/pack/char/mount_bicycle_run/acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
    }
    for (const g of gendersList) {
      for (const ec of eyeColorsList) {
        this.load.spritesheet(`pack_ride_horse_eyes_${g}_${ec}_idle`, `assets/pack/char/mount_horse_idle/eyes/${g}/${ec}.png`, { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet(`pack_ride_bicycle_eyes_${g}_${ec}_idle`, `assets/pack/char/mount_bicycle_idle/eyes/${g}/${ec}.png`, { frameWidth: 32, frameHeight: 32 });
      }
    }

    // ─── 6.6. New Action Animations (Damage, Death, Fishing, Carrying, etc.) ───

    // Damage (16 frames, 2 per direction)
    for (let t = 1; t <= 4; t++) {
      this.load.spritesheet(`pack_skin_${t}_damage`, `${charBase}/action/damage.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Death (20 frames, 2 per direction)
    for (let t = 1; t <= 4; t++) {
      this.load.spritesheet(`pack_skin_${t}_death`, `${charBase}/action/death.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // New action preloads are now managed dynamically via the sharedActions loop below

    // ─── Action Animations Preload (Skins, Eyes, Hair, Clothes, Weapons) ───
    const actionNames = ["sword_attack", "bow_attack", "mage", "broomstick", "damage", "death"];

    // Skins (Tones 1..4)
    for (let t = 1; t <= 4; t++) {
      this.load.spritesheet(`pack_skin_${t}_sword_attack`, `assets/pack/char/action/sword_attack/Skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_skin_${t}_bow_attack`, `assets/pack/char/action/bow_attack/Skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_skin_${t}_mage`, `assets/pack/char/action/mage/Skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_skin_${t}_broomstick`, `assets/pack/char/action/broomstick/Skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_skin_${t}_damage`, `assets/pack/char/action/damage/Skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_skin_${t}_death`, `assets/pack/char/action/death/Skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Eyes
    for (const g of gendersList) {
      for (const ec of eyeColorsList) {
        actionNames.forEach(act => {
          this.load.spritesheet(`pack_eyes_${g}_${ec}_${act}`, `assets/pack/char/action/${act}/Eyes/${g}/${ec}.png`, { frameWidth: 32, frameHeight: 32 });
        });
      }
    }

    // Hair
    for (const s of stylesList) {
      for (const c of colorsList) {
        actionNames.forEach(act => {
          this.load.spritesheet(`pack_hair_${s}_${c}_${act}`, `assets/pack/char/action/${act}/Hair's/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
        });
      }
    }

    // Clothes
    for (const c of clothesList) {
      actionNames.forEach(act => {
        this.load.spritesheet(`pack_clothes_${c}_${act}`, `assets/pack/char/action/${act}/Clothers/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      });
    }

    // Accessories for action animations
    for (const a of accsList) {
      actionNames.forEach(act => {
        this.load.spritesheet(`pack_acc_${a}_${act}`, `assets/pack/char/action/${act}/Acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      });
    }

    // Weapons (Sword & Bow)
    for (let tier = 1; tier <= 10; tier++) {
      this.load.spritesheet(`pack_weapon_Sword_${tier}_sword_attack`, `assets/pack/char/action/sword_attack/Weapons/Sword/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_weapon_Bow_${tier}_bow_attack`, `assets/pack/char/action/bow_attack/Weapons/Bow and Arrow/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Broomstick Mounts
    for (let c = 1; c <= 3; c++) {
      this.load.spritesheet(`pack_ride_broomstick_mount_${c}_broomstick`, `assets/pack/char/action/broomstick/Broomstick/${c}.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // Shared action folders loading (Farming, Tools, Fishing, Carrying, Sleep, Sit, etc.)
    const sharedActions = [
      { act: "pickaxe_attack", folder: "pickaxe_hoe_net" },
      { act: "hoe_attack", folder: "pickaxe_hoe_net" },
      { act: "axe_attack", folder: "axe_scythe" },
      { act: "scythe_attack", folder: "axe_scythe" },
      { act: "shovel_attack", folder: "shovel" },
      { act: "watering", folder: "watering" },
      { act: "fishing_cast", folder: "fishing_cast" },
      { act: "fishing_wait", folder: "fishing_wait" },
      { act: "fishing_bite", folder: "fishing_bite" },
      { act: "fishing_reel", folder: "fishing_reel" },
      { act: "fishing_catch", folder: "fishing_catch" },
      { act: "carry_idle", folder: "carry_idle" },
      { act: "carry_walk", folder: "carry_walk" },
      { act: "carry_run", folder: "carry_run" },
      { act: "sit", folder: "sit" },
      { act: "sleep", folder: "sleep" },
      { act: "petting", folder: "petting" },
      { act: "climbing", folder: "climbing" },
      { act: "flute", folder: "flute" },
      { act: "umbrella_idle", folder: "umbrella_idle" },
      { act: "umbrella_walk", folder: "umbrella_walk" },
      { act: "umbrella_run", folder: "umbrella_run" },
      { act: "swim_idle", folder: "swim_idle" },
      { act: "swim_outwater", folder: "swim_outwater" },
      { act: "swim_submerged", folder: "swim_submerged" },
      { act: "swim_swim", folder: "swim_swim" }
    ];

    sharedActions.forEach(item => {
      // Skins
      for (let t = 1; t <= 4; t++) {
        this.load.spritesheet(`pack_skin_${t}_${item.act}`, `assets/pack/char/action/${item.folder}/Skins/${t}.png`, { frameWidth: 32, frameHeight: 32 });
      }
      // Eyes
      for (const g of gendersList) {
        for (const ec of eyeColorsList) {
          this.load.spritesheet(`pack_eyes_${g}_${ec}_${item.act}`, `assets/pack/char/action/${item.folder}/Eyes/${g}/${ec}.png`, { frameWidth: 32, frameHeight: 32 });
        }
      }
      // Hair
      for (const s of stylesList) {
        for (const c of colorsList) {
          this.load.spritesheet(`pack_hair_${s}_${c}_${item.act}`, `assets/pack/char/action/${item.folder}/Hair's/${s}/${c}.png`, { frameWidth: 32, frameHeight: 32 });
        }
      }
      // Clothes
      for (const c of clothesList) {
        this.load.spritesheet(`pack_clothes_${c}_${item.act}`, `assets/pack/char/action/${item.folder}/Clothers/Farm/${c}.png`, { frameWidth: 32, frameHeight: 32 });
      }

      // Accessories
      for (const a of accsList) {
        this.load.spritesheet(`pack_acc_${a}_${item.act}`, `assets/pack/char/action/${item.folder}/Acc/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      }
    });

    // Load weapon layers for tool attacks
    for (let tier = 1; tier <= 10; tier++) {
      this.load.spritesheet(`pack_weapon_Pickaxe_${tier}_pickaxe_attack`, `assets/pack/char/action/pickaxe_hoe_net/Weapons/Pickaxe/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_weapon_Hoe_${tier}_hoe_attack`, `assets/pack/char/action/pickaxe_hoe_net/Weapons/Hoe/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_weapon_Axe_${tier}_axe_attack`, `assets/pack/char/action/axe_scythe/Weapons/Axe/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_weapon_Sickle_${tier}_scythe_attack`, `assets/pack/char/action/axe_scythe/Weapons/Sickle/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_weapon_Shovel_${tier}_shovel_attack`, `assets/pack/char/action/shovel/Weapons/Shovel/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_weapon_Watering_${tier}_watering`, `assets/pack/char/action/watering/Weapons/Watering/${tier}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`pack_weapon_Fishing_Rod_${tier}_fishing_cast`, `assets/pack/char/action/fishing_cast/Weapons/${tier}.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`pack_weapon_Fishing_Rod_${tier}_fishing_wait`, `assets/pack/char/action/fishing_wait/Weapons/${tier}.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`pack_weapon_Fishing_Rod_${tier}_fishing_bite`, `assets/pack/char/action/fishing_bite/Weapons/${tier}.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`pack_weapon_Fishing_Rod_${tier}_fishing_reel`, `assets/pack/char/action/fishing_reel/Weapons/${tier}.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet(`pack_weapon_Fishing_Rod_${tier}_fishing_catch`, `assets/pack/char/action/fishing_catch/Weapons/${tier}.png`, { frameWidth: 64, frameHeight: 64 });
    }

    // ─── 6.7. Horse Extended Animations (Lower, Eating) ───
    for (let c = 1; c <= 5; c++) {
      this.load.spritesheet(`pack_ride_horse_mount_${c}_lower`, `assets/pack/char/mount_horse_lower/lower/${c}.png`, { frameWidth: 32, frameHeight: 48 });
      this.load.spritesheet(`pack_ride_horse_mount_${c}_eating`, `assets/pack/char/mount_horse_eating/eating/${c}.png`, { frameWidth: 32, frameHeight: 48 });
    }

    // ─── 6.8. Bear Enemy ───
    this.load.spritesheet("bear_idle", `${charBase}/enemy/bear_idle.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bear_walk", `${charBase}/enemy/bear_walk.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bear_run", `${charBase}/enemy/bear_run.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bear_attack", `${charBase}/enemy/bear_attack.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bear_hit", `${charBase}/enemy/bear_hit.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("bear_dead", `${charBase}/enemy/bear_dead.png`, { frameWidth: 32, frameHeight: 32 });

    // ─── 6.9. NPC Spritesheets ───
    this.load.spritesheet("npc_banker", `${charBase}/npc/banker.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("npc_blacksmith", `${charBase}/npc/blacksmith.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("npc_pirate", `${charBase}/npc/pirate.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("npc_mermaid", `${charBase}/npc/mermaid.png`, { frameWidth: 32, frameHeight: 32 });

    // ─── 6.10. Projectile Effects ───
    this.load.image("proj_arrow", `${charBase}/projectiles/arrow.png`);
    this.load.image("proj_magic", `${charBase}/projectiles/magic.png`);


    // 7. New Tilesets
    this.load.image("tileset_spring", "assets/pack/tilesets/Tileset_Grass_Spring.png");
    this.load.image("tileset_summer", "assets/pack/tilesets/Tileset_Grass_Summer.png");
    this.load.image("tileset_fall", "assets/pack/tilesets/Tileset_Grass_Fall.png");
    this.load.image("tileset_winter", "assets/pack/tilesets/Tileset_Grass_Winter.png");
    this.load.image("tileset_path", "assets/pack/tilesets/Path_tiles.png");
    this.load.image("tileset_barn", "assets/pack/tilesets/Barn_tileset.png");
    this.load.image("tileset_cave", "assets/pack/tilesets/Cave_Water_Ground_animations_tiles.png");

    // 8. Sliced Trees & Flora
    const treeSheets = [
      { key: "pack_tree_birch_tree", path: "assets/pack/objects/trees/Birch_Tree.png", fw: 64, fh: 96 },
      { key: "pack_tree_mahogany_tree", path: "assets/pack/objects/trees/Mahogany_Tree.png", fw: 64, fh: 96 },
      { key: "pack_tree_maple_tree", path: "assets/pack/objects/trees/Maple_Tree.png", fw: 56, fh: 96 },
      { key: "pack_tree_pine_tree", path: "assets/pack/objects/trees/Pine_Tree.png", fw: 64, fh: 96 },
      { key: "pack_tree_big_old_tree", path: "assets/pack/objects/trees/DeepForest/Big_old_Tree.png", fw: 128, fh: 160 },
      { key: "pack_tree_bushes", path: "assets/pack/objects/trees/DeepForest/bushes.png", fw: 48, fh: 48 },
      { key: "pack_tree_fantasy_mushroom", path: "assets/pack/objects/trees/DeepForest/Fantasy_Mushroom.png", fw: 32, fh: 48 },
      { key: "pack_tree_root", path: "assets/pack/objects/trees/DeepForest/Root.png", fw: 32, fh: 48 },
      { key: "pack_tree_root_water_1", path: "assets/pack/objects/trees/DeepForest/Root_Water_1.png", fw: 32, fh: 48 },
      { key: "pack_tree_root_water_2", path: "assets/pack/objects/trees/DeepForest/Root_Water_2.png", fw: 32, fh: 48 },
      { key: "pack_tree_root_water_3", path: "assets/pack/objects/trees/DeepForest/Root_Water_3.png", fw: 32, fh: 48 },
      { key: "pack_tree_tree", path: "assets/pack/objects/trees/DeepForest/Tree.png", fw: 32, fh: 48 },
      { key: "pack_tree_tree_water_1", path: "assets/pack/objects/trees/Mine/Tree_Water_1.png", fw: 32, fh: 48 },
      { key: "pack_tree_tree_water_2", path: "assets/pack/objects/trees/Mine/Tree_Water_2.png", fw: 32, fh: 48 },
      { key: "pack_tree_tree_water_3", path: "assets/pack/objects/trees/Mine/Tree_Water_3.png", fw: 32, fh: 48 }
    ];
    for (const s of treeSheets) {
      this.load.spritesheet(s.key, s.path, { frameWidth: s.fw, frameHeight: s.fh });
    }

    // 9. Exterior Props (as Spritesheets)
    const exteriorSheets = [
      { key: "pack_ext_bus", path: "assets/pack/objects/exterior/Bus.png", fw: 128, fh: 128 },
      { key: "pack_ext_chest", path: "assets/pack/objects/exterior/chest.png", fw: 32, fh: 32 },
      { key: "pack_ext_cotton_candy_cart", path: "assets/pack/objects/exterior/Cotton_candy_cart.png", fw: 64, fh: 48 },
      { key: "pack_ext_halloween_content", path: "assets/pack/objects/exterior/Halloween_Content.png", fw: 48, fh: 48 },
      { key: "pack_ext_ice_cream_car", path: "assets/pack/objects/exterior/ice_cream_car.png", fw: 96, fh: 64 },
      { key: "pack_ext_ice_cream_cart", path: "assets/pack/objects/exterior/ice_cream_cart.png", fw: 64, fh: 48 },
      { key: "pack_ext_newsstand", path: "assets/pack/objects/exterior/Newsstand.png", fw: 32, fh: 48 },
      { key: "pack_ext_picnic", path: "assets/pack/objects/exterior/Picnic.png", fw: 96, fh: 48 },
      { key: "pack_ext_playground", path: "assets/pack/objects/exterior/Playground.png", fw: 96, fh: 96 },
      { key: "pack_ext_playground_1", path: "assets/pack/objects/exterior/playground_1.png", fw: 64, fh: 48 },
      { key: "pack_ext_popcorn_", path: "assets/pack/objects/exterior/Popcorn_.png", fw: 48, fh: 48 },
      { key: "pack_ext_scarescrow", path: "assets/pack/objects/exterior/Scarescrow.png", fw: 32, fh: 32 },
      { key: "pack_ext_snowman", path: "assets/pack/objects/exterior/Snowman.png", fw: 32, fh: 32 },
      { key: "pack_ext_water_fountain", path: "assets/pack/objects/exterior/Water_fountain.png", fw: 64, fh: 64 },
      { key: "pack_ext_well_", path: "assets/pack/objects/exterior/Well_.png", fw: 64, fh: 96 },
      { key: "pack_ext_exterior_sheet", path: "assets/pack/objects/exterior/Exterior.png", fw: 32, fh: 32 },
      { key: "pack_props_water_summer", path: "assets/pack/objects/props/PropsWater_Summer.png", fw: 32, fh: 32 },
      { key: "pack_props_water", path: "assets/pack/objects/props/Props_Water.png", fw: 32, fh: 32 }
    ];
    for (const s of exteriorSheets) {
      this.load.spritesheet(s.key, s.path, { frameWidth: s.fw, frameHeight: s.fh });
    }

    // 10. Interior Props (as Spritesheets)
    const interiorSheets = [
      { key: "pack_int_beds", path: "assets/pack/objects/interior/Beds.png", fw: 32, fh: 64 },
      { key: "pack_int_blacksmith", path: "assets/pack/objects/interior/Blacksmith.png", fw: 64, fh: 48 },
      { key: "pack_int_chairs", path: "assets/pack/objects/interior/Chairs.png", fw: 16, fh: 32 },
      { key: "pack_int_fireplace", path: "assets/pack/objects/interior/Fireplace.png", fw: 32, fh: 64 },
      { key: "pack_int_cats_furniture", path: "assets/pack/objects/interior/cats_furniture.png", fw: 32, fh: 32 },
      { key: "pack_int_sofa_and_armchair", path: "assets/pack/objects/interior/Sofa_and_armchair.png", fw: 32, fh: 32 },
      { key: "pack_int_tables_and_desks", path: "assets/pack/objects/interior/Tables_and_desks.png", fw: 32, fh: 32 },
      { key: "pack_int_xmas", path: "assets/pack/objects/interior/Xmas.png", fw: 32, fh: 48 },
      { key: "pack_int_school", path: "assets/pack/objects/interior/School.png", fw: 32, fh: 32 },
      { key: "pack_int_temple", path: "assets/pack/objects/interior/Temple.png", fw: 32, fh: 32 }
    ];
    for (const s of interiorSheets) {
      this.load.spritesheet(s.key, s.path, { frameWidth: s.fw, frameHeight: s.fh });
    }

    // 10.5 Custom Closet image & custom frames
    this.load.image("pack_int_closet", "assets/pack/objects/interior/Closet.png");

    // 11. Houses (Single images or custom grids)
    this.load.image("pack_ext_tiny_house", "assets/pack/objects/exterior/Houses/Tiny House.png");
    this.load.image("pack_ext_upgrade_house", "assets/pack/objects/exterior/Houses/Upgrade House.png");
    this.load.image("pack_ext_dog_house", "assets/pack/objects/exterior/Houses/dog house.png");
    for (let i = 1; i <= 8; i++) {
      this.load.spritesheet(`pack_ext_house_${i}`, `assets/pack/objects/exterior/Houses/${i}.png`, { frameWidth: 128, frameHeight: 112 });
    }

    // 12. Workbenches
    const benches = [
      { key: "pack_bench_alchemy", path: "assets/pack/objects/workbenches/Alchemy Table.png", fw: 32, fh: 32 },
      { key: "pack_bench_anvil", path: "assets/pack/objects/workbenches/Anvil.png", fw: 32, fh: 32 },
      { key: "pack_bench_beehive", path: "assets/pack/objects/workbenches/Beehive.png", fw: 16, fh: 32 },
      { key: "pack_bench_butter_churn", path: "assets/pack/objects/workbenches/Butter Churn.png", fw: 32, fh: 32 },
      { key: "pack_bench_cheese_press", path: "assets/pack/objects/workbenches/Cheese Press.png", fw: 32, fh: 64 },
      { key: "pack_bench_fermentation_barrel", path: "assets/pack/objects/workbenches/fermentation barrel.png", fw: 32, fh: 32 },
      { key: "pack_bench_furnace", path: "assets/pack/objects/workbenches/Furnace.png", fw: 32, fh: 32 },
      { key: "pack_bench_jam_maker", path: "assets/pack/objects/workbenches/Jam Maker.png", fw: 32, fh: 64 },
      { key: "pack_bench_kitchen_pot", path: "assets/pack/objects/workbenches/Kitchen pot.png", fw: 32, fh: 32 },
      { key: "pack_bench_sawmill", path: "assets/pack/objects/workbenches/Sawmill.png", fw: 16, fh: 16 },
      { key: "pack_bench_sharpening_station", path: "assets/pack/objects/workbenches/Sharpening Station.png", fw: 16, fh: 16 },
      { key: "pack_bench_tear", path: "assets/pack/objects/workbenches/Tear.png", fw: 32, fh: 32 },
      { key: "pack_bench_workbench", path: "assets/pack/objects/workbenches/Workbench.png", fw: 32, fh: 32 }
    ];
    for (const b of benches) {
      this.load.spritesheet(b.key, b.path, { frameWidth: b.fw, frameHeight: b.fh });
    }

    // 13. Fence & Bridge
    this.load.spritesheet("pack_ext_bridge_beach", "assets/pack/objects/exterior/FenceAndBridge/Bridge Beach.png", { frameWidth: 128, frameHeight: 224 });
    this.load.spritesheet("pack_ext_bridge", "assets/pack/objects/exterior/FenceAndBridge/Bridge.png", { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet("pack_ext_fence_iron", "assets/pack/objects/exterior/FenceAndBridge/Fence Iron.png", { frameWidth: 48, frameHeight: 96 });
    this.load.spritesheet("pack_ext_fence_stone", "assets/pack/objects/exterior/FenceAndBridge/Fence Stone.png", { frameWidth: 48, frameHeight: 80 });
    this.load.spritesheet("pack_ext_fence_wood", "assets/pack/objects/exterior/FenceAndBridge/Fence Wood.png", { frameWidth: 96, frameHeight: 160 });
    this.load.spritesheet("pack_ext_white_fence", "assets/pack/objects/exterior/FenceAndBridge/White Fence.png", { frameWidth: 80, frameHeight: 80 });

    // 14. Animals & Pets
    const animals = [
      { key: "pack_animal_chicken_black", path: "assets/pack/animals/Farm/Chicken/Chicken Black.png", fw: 16, fh: 16 },
      { key: "pack_animal_chicken_evil", path: "assets/pack/animals/Farm/Chicken/Chicken Evil.png", fw: 16, fh: 16 },
      { key: "pack_animal_chicken_white", path: "assets/pack/animals/Farm/Chicken/Chicken White.png", fw: 16, fh: 16 },
      { key: "pack_animal_chicken_baby", path: "assets/pack/animals/Farm/Chicken/Baby Chicken Yellow.png", fw: 16, fh: 16 },
      { key: "pack_animal_cow_common_f", path: "assets/pack/animals/Farm/Cow/Common Cow/Female Cow Black.png", fw: 32, fh: 32 },
      { key: "pack_animal_cow_common_m", path: "assets/pack/animals/Farm/Cow/Common Cow/Male Cow Brown.png", fw: 32, fh: 32 },
      { key: "pack_animal_cow_baby", path: "assets/pack/animals/Farm/Cow/Common Cow/Baby Cow Blonde.png", fw: 32, fh: 32 },
      { key: "pack_animal_sheep_f", path: "assets/pack/animals/Farm/Sheep/Sheep Female.png", fw: 32, fh: 32 },
      { key: "pack_animal_sheep_m", path: "assets/pack/animals/Farm/Sheep/Sheep Male.png", fw: 32, fh: 32 },
      { key: "pack_animal_pig_pink", path: "assets/pack/animals/Farm/Pig/Pig Pink.png", fw: 32, fh: 32 },
      { key: "pack_animal_pig_mud", path: "assets/pack/animals/Farm/Pig/Pig Mud Pink.png", fw: 32, fh: 32 },
      { key: "pack_animal_goat_f", path: "assets/pack/animals/Farm/Goat/Goat Female Blonde.png", fw: 32, fh: 32 },
      { key: "pack_animal_duck_mallad", path: "assets/pack/animals/Farm/Ducks/Duck Mallad.png", fw: 16, fh: 16 },
      { key: "pack_animal_cat_black", path: "assets/pack/animals/Pets/Cats/1/Black.png", fw: 32, fh: 32 },
      { key: "pack_animal_cat_ginger", path: "assets/pack/animals/Pets/Cats/1/Ginger.png", fw: 32, fh: 32 },
      { key: "pack_animal_dog_1", path: "assets/pack/animals/Pets/Dogs/Premade/1/1.png", fw: 32, fh: 32 },
      { key: "pack_animal_capybara", path: "assets/pack/animals/Forest/Capybara/Brown Capybara.png", fw: 32, fh: 32 }
    ];
    for (const a of animals) {
      this.load.spritesheet(a.key, a.path, { frameWidth: a.fw, frameHeight: a.fh });
    }

    // 15. Extra Assets Spritesheets
    for (const s of EXTRA_PACK_SPRITESHEETS) {
      const cleanPath = s.path.startsWith("/") ? s.path.substring(1) : s.path;
      this.load.spritesheet(s.key, cleanPath, { frameWidth: s.fw, frameHeight: s.fh });
    }
  }

  private getLayerForTileIndex(tileIndex: number): "terrain" | "decor" {
    const cleanIndex = tileIndex & 0xFFFF;
    if ((cleanIndex >= 2000 && cleanIndex < 3000) || (cleanIndex >= 4000 && cleanIndex < 6000)) {
      return "decor";
    }
    return "terrain";
  }

  private isWaterTileAt(worldX: number, worldY: number): boolean {
    if (!this.map || !this.layer) return false;
    // Calculate tile coordinate
    const tileX = Math.floor(worldX / 32);
    const tileY = Math.floor(worldY / 32);
    const tile = this.map.getTileAt(tileX, tileY, true, this.layer);
    if (!tile) return false;
    
    // GID values are stored on the tile's index property.
    // If the index matches one of the known water tiles, block it.
    const cleanIndex = tile.index & 0xFFFF;
    if (GameScene.WATER_TILE_GIDS.has(cleanIndex)) {
      // It's a water tile. But is there a dock or bridge object on top of it?
      // Check if world coordinate overlaps with any dock/bridge object bounding box!
      for (const obj of this.placedObjects) {
        if (
          obj.type.startsWith("pack_ext_bridge") ||
          obj.type.startsWith("pack_ext_dock") ||
          obj.type.startsWith("pack_dock_") ||
          obj.type.startsWith("pack_iskele_") ||
          obj.type.startsWith("iskele:")
        ) {
          if (obj.imageObj) {
            const bounds = obj.imageObj.getBounds();
            // Pad bounds slightly to prevent getting stuck on seams (4px padding)
            if (
              worldX >= bounds.x - 4 &&
              worldX <= bounds.x + bounds.width + 4 &&
              worldY >= bounds.y - 4 &&
              worldY <= bounds.y + bounds.height + 4
            ) {
              return false; // Not blocked! Player is on a dock/bridge.
            }
          }
        }
      }
      return true; // Blocked: it is water and no dock/bridge is here.
    }
    return false; // Not a water tile.
  }

  startFishingSequence() {
    if (!this.room) return;

    this.isFishingTimelineActive = true;

    // 1. Send casting state
    this.room.send("action", { type: "fishing_cast" });

    // 2. Play Cast animation for 2 seconds
    this.time.addEvent({
      delay: 2000,
      callback: () => {
        if (!this.isFishingTimelineActive) return;
        this.room.send("action", { type: "fishing_wait" });

        this.time.addEvent({
          delay: 25000,
          callback: () => {
            if (!this.isFishingTimelineActive) return;
            this.room.send("action", { type: "fishing_bite" });

            this.time.addEvent({
              delay: 1500,
              callback: () => {
                if (!this.isFishingTimelineActive) return;
                this.room.send("action", { type: "fishing_reel" });

                this.time.addEvent({
                  delay: 1000,
                  callback: () => {
                    if (!this.isFishingTimelineActive) return;
                    this.room.send("action", { type: "fishing_catch" });

                    this.time.addEvent({
                      delay: 1000, // Show catch animation for 1 second
                      callback: () => {
                        if (!this.isFishingTimelineActive) return;
                        this.room.send("fish-cast");
                        this.room.send("action", { type: "idle" });
                        this.isFishingTimelineActive = false;
                        this.localFishingDir = null;
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  // Geçilmez (blocked) nesnelerin bounding box kontrolü — client prediction için
  private isBlockedByLocalObject(worldX: number, worldY: number): boolean {
    for (const obj of this.placedObjects) {
      if (!obj.blocked) continue;
      if (obj.imageObj) {
        const bounds = obj.imageObj.getBounds();
        // Oyuncu 16x16 — merkezden kontrol
        if (
          worldX >= bounds.x &&
          worldX <= bounds.x + bounds.width &&
          worldY >= bounds.y &&
          worldY <= bounds.y + bounds.height
        ) {
          return true;
        }
      }
    }
    return false;
  }
 
  // Helpers for line segment intersection (CCW algorithm)
  private ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  }

  private lineIntersect(
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number
  ): boolean {
    return this.ccw(ax, ay, cx, cy, dx, dy) !== this.ccw(bx, by, cx, cy, dx, dy) &&
           this.ccw(ax, ay, bx, by, cx, cy) !== this.ccw(ax, ay, bx, by, dx, dy);
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    
    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  private isBlockedByLocalLine(oldX: number, oldY: number, newX: number, newY: number): boolean {
    const oy = oldY + 34;
    const ny = newY + 34;
    for (const obj of this.placedObjects) {
      if (obj.type !== "collision_line") continue;
      
      const x1 = obj.x;
      const y1 = obj.y;
      const x2 = obj.scale; // x2
      const y2 = obj.angle ?? 0; // y2
      
      if (this.lineIntersect(oldX, oy, newX, ny, x1, y1, x2, y2)) {
        return true;
      }
    }
    return false;
  }

  private getDefaultScaleForType(type: string): number {
    if (type === "collision_blocker" || type === "collision_line") {
      return 1.0;
    }
    if (type === "farm_tile" || type === "farm_tile_hoed" || type === "farm_tile_watered") {
      return 0.07655;
    }
    if (type === "nft_house") {
      return 0.12;
    }
    if (type === "yon_up" || type === "yon_down" || type === "yon_left" || type === "yon_right") {
      return 0.15; // 296x374 scaled to ~44x56px
    }
    if (type.startsWith("silo")) {
      return 1.0;
    }
    if (type.startsWith("pack_") || type.startsWith("ahir_") || type.startsWith("decor_grass_") || type.startsWith("decor_gorsel_") || type.startsWith("vfx_") || type.startsWith("mg_") || type.startsWith("rock_") || type.startsWith("house_") || type.startsWith("table_")) {
      return 2.0;
    }
    return 0.15;
  }

  create(data: SceneData): void {
    this.room = data.room;
    this.localId = data.sessionId;

    // 1. Setup sprite slicing animations for all character skins
    this.createAnimations();

    // 2. Draw basic grid background
    this.drawGridOverlay();

    // 3. Initialize Tilemap & Blank layer
    this.map = this.make.tilemap({
      tileWidth: 16,
      tileHeight: 16,
      width: 50,
      height: 40,
    });
    const tileset = this.map.addTilesetImage("terrains", "terrains", 16, 16)!;
    const fencesTileset = this.map.addTilesetImage("fences", "fences", 16, 16, 0, 0, 2000)!;
    const zemin2Tileset = this.map.addTilesetImage("zemin2", "zemin2", 16, 16, 0, 0, 3000)!;
    const iskeleTileset = this.map.addTilesetImage("iskele", "iskele", 16, 16, 0, 0, 4000)!;
    const dekor2Tileset = this.map.addTilesetImage("dekor2", "dekor2", 16, 16, 0, 0, 5000)!;
    const springTileset = this.map.addTilesetImage("tileset_spring", "tileset_spring", 16, 16, 0, 0, 6000)!;
    const summerTileset = this.map.addTilesetImage("tileset_summer", "tileset_summer", 16, 16, 0, 0, 7000)!;
    const fallTileset   = this.map.addTilesetImage("tileset_fall", "tileset_fall", 16, 16, 0, 0, 8000)!;
    const winterTileset = this.map.addTilesetImage("tileset_winter", "tileset_winter", 16, 16, 0, 0, 9000)!;
    const pathTileset   = this.map.addTilesetImage("tileset_path", "tileset_path", 16, 16, 0, 0, 10000)!;
    const barnTileset   = this.map.addTilesetImage("tileset_barn", "tileset_barn", 16, 16, 0, 0, 11000)!;
    const caveTileset   = this.map.addTilesetImage("tileset_cave", "tileset_cave", 16, 16, 0, 0, 12000)!;

    const allTilesets = [
      tileset, fencesTileset, zemin2Tileset, iskeleTileset, dekor2Tileset,
      springTileset, summerTileset, fallTileset, winterTileset, pathTileset, barnTileset, caveTileset
    ];
    this.layer = this.map.createBlankLayer("terrain_layer", allTilesets)!;
    this.layer.setScale(2); // Scale 16x16 tiles to 32x32

    this.decorLayer = this.map.createBlankLayer("decor_layer", allTilesets)!;
    this.decorLayer.setScale(2);

    // 4. Initialize Selection Graphics Overlay
    this.selectionGraphics = this.add.graphics();
    this.selectionGraphics.setDepth(99999);

    // 5. Clamp camera to world bounds
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // 6. Register keys
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 7. Bind Colyseus state callbacks
    this.bindStateSync();

    // 8. Editor paint, erase & drag inputs
    this.setupEditorInputs();

    // 9. React editor events
    this.game.events.on("editor-brush-selected", (brush: { type: string; index?: number; name?: string; cropType?: string }) => {
      this.currentBrushType = brush.type;
      this.activeBrushRotationStep = 0;
      this.activeBrushFlipX = false;
      this.activeBrushFlipY = false;
      this.activePlayTool = null; // Clear active play tool when editor brush is chosen
      if (brush.type === "tile" && brush.index !== undefined) {
        this.currentTileIndex = brush.index;
        this.currentTileStamp = null;
        this.selectedSeed = "";
      } else if (brush.type === "object" && brush.name) {
        this.currentObjectName = brush.name;
        this.selectedSeed = "";
      } else if (brush.type === "seed") {
        this.selectedSeed = brush.cropType || "";
      }
    });

    this.game.events.on("play-tool-selected", (data: { tool: string | null }) => {
      this.activePlayTool = data.tool;
      if (data.tool) {
        this.selectedSeed = "";
      }
    });

    this.game.events.on("editor-paint-on-top-changed", (enabled: boolean) => {
      this.paintOnTop = enabled;
    });

    this.game.events.on("clear-island", () => {
      if (this.room) {
        this.room.send("clear-map-island");
      }
    });

    this.game.events.on("editor-tile-stamp-selected", (stamp: { width: number; height: number; tiles: number[][] }) => {
      this.currentBrushType = "tile";
      this.currentTileStamp = stamp;
    });

    this.game.events.on("editor-mode-changed", (enabled: boolean) => {
      this.editorMode = enabled;
      this.selectionGraphics.clear();
      
      // Update visibility of all collision_blockers and collision_lines
      this.placedObjects.forEach(obj => {
        if ((obj.type === "collision_blocker" || obj.type === "collision_line") && obj.imageObj) {
          obj.imageObj.setVisible(enabled);
        }
      });

      if (!enabled) {
        this.deselectObject();
        const player = this.entities.get(this.localId);
        if (player && player.container) {
          this.cameras.main.startFollow(player.container, true, 1, 1);
        }
      }
    });

    this.game.events.on("editor-object-delete-requested", (id: string) => {
      console.log("[Client GameScene] editor-object-delete-requested received for ID:", id);
      this.room.send("object-delete", { id });
    });

    this.game.events.on("editor-object-scale-changed", (payload: { id: string; scale: number; save?: boolean }) => {
      console.log("[Client GameScene] editor-object-scale-changed:", payload);
      const obj = this.placedObjects.find(o => o.id === payload.id);
      if (obj) {
        obj.scale = payload.scale;
        if (obj.imageObj) {
          obj.imageObj.setScale(payload.scale);
        }
        this.drawSelectionOutline();

        // Only save to server when dragging ends (payload.save === true)
        if (payload.save) {
          const stateObj = this.room.state.placedObjects.get(obj.id);
          const animSpeed = stateObj ? stateObj.animSpeed : 1.0;
          this.room.send("object-place", {
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            scale: obj.scale,
            animSpeed: animSpeed
          });
        }
      }
    });

    this.game.events.on("editor-object-speed-changed", (payload: { id: string; speed: number; save?: boolean }) => {
      console.log("[Client GameScene] editor-object-speed-changed:", payload);
      const obj = this.placedObjects.find(o => o.id === payload.id);
      if (obj) {
        if (obj.imageObj && (obj.type.startsWith("vfx_") || obj.type.startsWith("mg_"))) {
          (obj.imageObj as Phaser.GameObjects.Sprite).anims.timeScale = payload.speed;
        }
        // Only save to server when dragging ends (payload.save === true)
        if (payload.save) {
          this.room.send("object-place", {
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            scale: obj.scale,
            animSpeed: payload.speed
          });
        }
      }
    });

    this.game.events.on("editor-object-rotation-changed", (payload: { id: string; angle: number; save?: boolean }) => {
      console.log("[Client GameScene] editor-object-rotation-changed:", payload);
      const obj = this.placedObjects.find(o => o.id === payload.id);
      if (obj) {
        obj.angle = payload.angle;
        if (obj.imageObj) {
          obj.imageObj.setAngle(payload.angle);
        }
        this.drawSelectionOutline();

        if (payload.save) {
          const stateObj = this.room.state.placedObjects.get(obj.id);
          const animSpeed = stateObj ? stateObj.animSpeed : 1.0;
          const flipX = stateObj ? stateObj.flipX : false;
          this.room.send("object-place", {
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            scale: obj.scale,
            animSpeed: animSpeed,
            angle: payload.angle,
            flipX: flipX
          });
        }
      }
    });

    this.game.events.on("editor-object-flip-changed", (payload: { id: string; flipX: boolean; save?: boolean }) => {
      console.log("[Client GameScene] editor-object-flip-changed:", payload);
      const obj = this.placedObjects.find(o => o.id === payload.id);
      if (obj) {
        obj.flipX = payload.flipX;
        if (obj.imageObj) {
          obj.imageObj.setFlipX(payload.flipX);
        }
        this.drawSelectionOutline();

        if (payload.save) {
          const stateObj = this.room.state.placedObjects.get(obj.id);
          const animSpeed = stateObj ? stateObj.animSpeed : 1.0;
          const angle = stateObj ? stateObj.angle : 0;
          this.room.send("object-place", {
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            scale: obj.scale,
            animSpeed: animSpeed,
            angle: angle,
            flipX: payload.flipX
          });
        }
      }
    });

    // Geçilmez (blocked) toggle handler
    this.game.events.on("editor-object-blocked-changed", (payload: { id: string; blocked: boolean }) => {
      const obj = this.placedObjects.find(o => o.id === payload.id);
      if (obj) {
        obj.blocked = payload.blocked;
        // Görsel: blocked ise hafif kırmızı tint, değilse normal
        if (obj.imageObj) {
          obj.imageObj.setTint(payload.blocked ? 0xff8888 : 0xffffff);
        }
        this.drawSelectionOutline();
        // Sunucuya gönder
        this.room.send("object-set-blocked", { id: obj.id, blocked: payload.blocked });
      }
    });

    // Keyboard bindings for Rotate (R) and Flip (F)
    this.input.keyboard!.on("keydown-R", () => {
      if (this.editorMode && this.selectedObjectId) {
        const obj = this.placedObjects.find(o => o.id === this.selectedObjectId);
        if (obj && obj.imageObj) {
          const nextAngle = (obj.imageObj.angle + 90) % 360;
          this.game.events.emit("editor-object-rotation-changed", {
            id: this.selectedObjectId,
            angle: nextAngle,
            save: true
          });
        }
      }
    });

    this.input.keyboard!.on("keydown-F", () => {
      if (this.editorMode && this.selectedObjectId) {
        const obj = this.placedObjects.find(o => o.id === this.selectedObjectId);
        if (obj && obj.imageObj) {
          const nextFlip = !obj.imageObj.flipX;
          this.game.events.emit("editor-object-flip-changed", {
            id: this.selectedObjectId,
            flipX: nextFlip,
            save: true
          });
        }
      }
    });

    // 10. Load fallback: if client has legacy map in local storage, allow importing
    this.checkLegacyLocalMap();

    // Create animations for VFX and Material Gift items
    this.createGIFAnimations();

    // Build crop textures: define frames that exclude the 16px number strip
    this.buildCropTextures();

    // Slice decor_sheet_gorsel into individual texture frames at runtime
    const sheet = this.textures.get("decor_sheet_gorsel");
    if (sheet) {
      for (let i = 0; i < 44; i++) {
        const frame = (sheet.frames as Record<number, Phaser.Textures.Frame>)[i];
        if (frame) {
          const canvas = document.createElement("canvas");
          canvas.width = 16;
          canvas.height = 16;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(
              sheet.getSourceImage() as HTMLImageElement,
              frame.cutX, frame.cutY, 16, 16,
              0, 0, 16, 16
            );
            this.textures.addCanvas(`decor_gorsel_${i}`, canvas);
          }
        }
      }
    }

    // 11. Mouse wheel zoom (middle mouse wheel) and responsive scale resize
    const getMinZoom = () => {
      return Math.max(this.scale.width / this.mapWidth, this.scale.height / this.mapHeight);
    };

    const initialMinZoom = getMinZoom();
    if (this.cameras.main.zoom < initialMinZoom) {
      this.cameras.main.setZoom(initialMinZoom);
    }

    // 12. Spawn NPCs
    this.npcs = spawnNPCs(this);

    this.input.on("wheel", (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number
    ) => {
      const zoomFactor = 0.001;
      const currentZoom = this.cameras.main.zoom;
      const minZoom = getMinZoom();
      const newZoom = Phaser.Math.Clamp(currentZoom - deltaY * zoomFactor, minZoom, 3.0);
      this.cameras.main.setZoom(newZoom);
    });

    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      const minZoom = Math.max(gameSize.width / this.mapWidth, gameSize.height / this.mapHeight);
      if (this.cameras.main.zoom < minZoom) {
        this.cameras.main.setZoom(minZoom);
      }
    });

    // 12. Crop state synchronization
    if (this.room) {
      this.room.state.crops.onAdd((crop: any, key: string) => {
        this.renderCropSprite(key, crop.cropType, crop.stage);
        crop.onChange(() => { this.renderCropSprite(key, crop.cropType, crop.stage); });
      });
      this.room.state.crops.onRemove((_crop: any, key: string) => {
        const sprite = this.cropSprites.get(key);
        if (sprite) { sprite.destroy(); this.cropSprites.delete(key); }
      });
      this.room.state.crops.forEach((crop: any, key: string) => {
        this.renderCropSprite(key, crop.cropType, crop.stage);
        crop.onChange(() => { this.renderCropSprite(key, crop.cropType, crop.stage); });
      });
    }
  }

  // ─── Crop Farming Helpers ─────────────────────────────────────────────────

  /**
   * For each crop, create a brand-new canvas texture that contains ONLY the
   * plant pixels (rows 0..plantH-1). This physically removes the number strip
   * from the texture data, so it can never appear regardless of how Phaser
   * renders the sprite.
   */
  private buildCropTextures(): void {
    for (const [cropName, meta] of Object.entries(GameScene.CROP_META)) {
      const { plantH } = meta;
      const cleanKey = `crop_clean_${cropName}`;
      if (this.textures.exists(cleanKey)) continue;

      const sourceTex = this.textures.get(`crop_${cropName}`);
      const sourceImg = sourceTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;

      // Draw only the top plantH rows of the source image onto a new canvas
      const canvas = document.createElement("canvas");
      canvas.width = 7 * 16;  // 112px — 7 frames side by side
      canvas.height = plantH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(sourceImg as CanvasImageSource, 0, 0, 7 * 16, plantH, 0, 0, 7 * 16, plantH);

      // Register the clean canvas as a new Phaser texture with 7 frames
      const tex = this.textures.addCanvas(cleanKey, canvas);
      if (tex) {
        for (let i = 0; i < 7; i++) {
          tex.add(i, 0, i * 16, 0, 16, plantH);
        }
      }
    }
  }

  /** Called by React HUD to set the selected seed type and switch to seed brush */
  public setSelectedSeed(cropType: string): void {
    this.selectedSeed = cropType;
    this.currentBrushType = cropType ? "seed" : "tile";
    (window as any).mmorpg_selected_seed = cropType;
  }

  /** Render or update a crop sprite at tile position encoded as "x,y" */
  private renderCropSprite(key: string, cropType: string, stage: number): void {
    let mapId = "main";
    let coords = key;
    if (key.includes(":")) {
      const parts = key.split(":");
      mapId = parts[0];
      coords = parts[1];
    }

    // If this crop belongs to a different map, make sure it is destroyed locally
    if (mapId !== this.currentMapId) {
      const sprite = this.cropSprites.get(key);
      if (sprite) {
        sprite.destroy();
        this.cropSprites.delete(key);
      }
      return;
    }

    const [tx, ty] = coords.split(",").map(Number);
    const meta = GameScene.CROP_META[cropType];
    if (!meta) return;

    // Use the pre-processed clean texture (no number strip)
    const textureKey = `crop_clean_${cropType}`;
    // Bottom of tile — plant grows upward with origin (0.5, 1.0)
    const worldX = tx * 16 + 8;
    const worldY = (ty + 1) * 16;

    let sprite = this.cropSprites.get(key);
    if (!sprite) {
      sprite = this.add.sprite(worldX, worldY, textureKey, stage);
      sprite.setOrigin(0.5, 1.0);
      sprite.setDepth(5);
      this.cropSprites.set(key, sprite);
    } else {
      sprite.setFrame(stage);
    }
  }


  // ─── Animation Helper ─────────────────────────────────────────────────────

  private createAnimations(): void {
    const skins = ["farmer_1", "farmer_2", "body_2"];
    const dirs = ["right", "up", "left", "down"];

    const animSpecs = [
      { key: "idle",  row: 1, count: 6,  frameRate: 8,  repeat: -1 },
      { key: "walk",  row: 2, count: 6,  frameRate: 10, repeat: -1 },
      { key: "dig",   row: 3, count: 9,  frameRate: 12, repeat: 0  },
      { key: "water", row: 7, count: 14, frameRate: 16, repeat: 0  },
      { key: "chop",  row: 9, count: 10, frameRate: 14, repeat: 0  },
      { key: "fish",  row: 11, count: 32, frameRate: 8,  repeat: -1 },
    ];

    skins.forEach(skin => {
      animSpecs.forEach(anim => {
        dirs.forEach((dir, dirIndex) => {
          const animKey = `${skin}_${anim.key}_${dir}`;
          const startFrame = (anim.row * 128) + (dirIndex * anim.count);
          const endFrame = startFrame + anim.count - 1;

          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(skin, { start: startFrame, end: endFrame }),
            frameRate: anim.frameRate,
            repeat: anim.repeat,
          });
        });
      });
    });
    // ─── Farm RPG Pack Character Anim Generator ──────────────────────────────
    const directionsList = ["down", "right", "up", "left"];
    const packDirections = ["down", "down_diagonal", "up", "up_diagonal", "right", "right_diagonal", "left", "left_diagonal"];

    const buildAnims = (keyPrefix: string) => {
      // 1. Idle (16 frames, 4 frames per direction)
      const idleKey = `${keyPrefix}_idle`;
      if (this.textures.exists(idleKey)) {
        directionsList.forEach((dir) => {
          const dirIndex = packDirections.indexOf(dir);
          const realDirIndex = dirIndex / 2;
          const start = realDirIndex * 4;
          const end = start + 3;
          this.anims.create({
            key: `${idleKey}_${dir}`,
            frames: this.anims.generateFrameNumbers(idleKey, { start, end }),
            frameRate: 6,
            repeat: -1,
          });
        });
      }

      // 2. Walk (24 frames, 6 frames per direction)
      const walkKey = `${keyPrefix}_walk`;
      if (this.textures.exists(walkKey)) {
        directionsList.forEach((dir) => {
          const dirIndex = packDirections.indexOf(dir);
          const realDirIndex = dirIndex / 2;
          const start = realDirIndex * 6;
          const end = start + 5;
          this.anims.create({
            key: `${walkKey}_${dir}`,
            frames: this.anims.generateFrameNumbers(walkKey, { start, end }),
            frameRate: 10,
            repeat: -1,
          });
        });
      }

      // 3. Run (32 frames, 8 frames per direction)
      const runKey = `${keyPrefix}_run`;
      if (this.textures.exists(runKey)) {
        directionsList.forEach((dir) => {
          const dirIndex = packDirections.indexOf(dir);
          const realDirIndex = dirIndex / 2;
          const start = realDirIndex * 8;
          const end = start + 7;
          this.anims.create({
            key: `${runKey}_${dir}`,
            frames: this.anims.generateFrameNumbers(runKey, { start, end }),
            frameRate: 12,
            repeat: -1,
          });
        });
      }
    };

    // Build skins
    for (let t = 1; t <= 4; t++) {
      buildAnims(`pack_skin_${t}`);
    }

    // Build hairs
    const styles = ["Standard", "Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist"];
    const colors = ["Black", "Blonde", "Brown", "Ginger"];
    for (const s of styles) {
      for (const c of colors) {
        buildAnims(`pack_hair_${s}_${c}`);
      }
    }

    // Build clothes
    const cColors = ["Blue", "Green", "Pink", "Purple", "Red"];
    for (const c of cColors) {
      buildAnims(`pack_clothes_${c}`);
    }

    // Build beards
    const bColors = ["Black", "Blonde", "Brown", "Ginger"];
    for (const b of bColors) {
      buildAnims(`pack_beard_${b}`);
    }

    // Build accessories
    const accs = ["Beret", "Wizard", "Pirate", "Farm", "Santa_hat", "Leprechaun", "Cook", "Chicken", "Cow", "Frog", "Deer"];
    for (const a of accs) {
      buildAnims(`pack_acc_${a}`);
    }

    // Build eyes (idle, walk, run)
    const genders = ["Male", "Female"];
    const eyeColors = ["Black", "Blue", "Brown", "Green"];
    for (const g of genders) {
      for (const ec of eyeColors) {
        buildAnims(`pack_eyes_${g}_${ec}`);
      }
    }

    // ─── Binek Animasyonları Oluşturucu (Mount Anims Builder) ────────────────────────
    const buildMountAnims = (keyPrefix: string, type: "horse" | "bicycle") => {
      if (type === "horse") {
        // Horse Idle (8 directions, 1 frame per direction)
        const idleKey = `${keyPrefix}_idle`;
        if (this.textures.exists(idleKey)) {
          directionsList.forEach((dir) => {
            const dirIndex = packDirections.indexOf(dir);
            this.anims.create({
              key: `${idleKey}_${dir}`,
              frames: [{ key: idleKey, frame: dirIndex }],
              frameRate: 1,
              repeat: -1,
            });
          });
        }
        
        // Horse Walk (8 directions, 2 frames per direction)
        const walkKey = `${keyPrefix}_walk`;
        if (this.textures.exists(walkKey)) {
          directionsList.forEach((dir) => {
            const dirIndex = packDirections.indexOf(dir);
            const start = dirIndex * 2;
            const end = start + 1;
            this.anims.create({
              key: `${walkKey}_${dir}`,
              frames: this.anims.generateFrameNumbers(walkKey, { start, end }),
              frameRate: 6,
              repeat: -1,
            });
          });
        }

        // Horse Run (8 directions, 3 frames per direction)
        const runKey = `${keyPrefix}_run`;
        if (this.textures.exists(runKey)) {
          directionsList.forEach((dir) => {
            const dirIndex = packDirections.indexOf(dir);
            const start = dirIndex * 3;
            const end = start + 2;
            this.anims.create({
              key: `${runKey}_${dir}`,
              frames: this.anims.generateFrameNumbers(runKey, { start, end }),
              frameRate: 10,
              repeat: -1,
            });
          });
        }
      } else {
        // Bicycle Idle (8 directions, 1 frame per direction)
        const idleKey = `${keyPrefix}_idle`;
        if (this.textures.exists(idleKey)) {
          directionsList.forEach((dir) => {
            const dirIndex = packDirections.indexOf(dir);
            this.anims.create({
              key: `${idleKey}_${dir}`,
              frames: [{ key: idleKey, frame: dirIndex }],
              frameRate: 1,
              repeat: -1,
            });
          });
        }

        // Bicycle Run/Ride (8 directions, 2 frames per direction)
        const runKey = `${keyPrefix}_run`;
        if (this.textures.exists(runKey)) {
          directionsList.forEach((dir) => {
            const dirIndex = packDirections.indexOf(dir);
            const start = dirIndex * 2;
            const end = start + 1;
            this.anims.create({
              key: `${runKey}_${dir}`,
              frames: this.anims.generateFrameNumbers(runKey, { start, end }),
              frameRate: 10,
              repeat: -1,
            });
          });
        }
      }
    };

    // Build binek anims
    // 1. Mounts
    for (let c = 1; c <= 5; c++) {
      buildMountAnims(`pack_ride_horse_mount_${c}`, "horse");
    }
    const bikeColorsList = ["blue", "green", "orange", "pink", "red"];
    for (const c of bikeColorsList) {
      buildMountAnims(`pack_ride_bicycle_mount_${c}`, "bicycle");
    }

    // 2. Rider Skins
    for (let t = 1; t <= 4; t++) {
      buildMountAnims(`pack_ride_horse_skin_${t}`, "horse");
      buildMountAnims(`pack_ride_bicycle_skin_${t}`, "bicycle");
    }

    // 3. Rider Hairs
    for (const s of styles) {
      for (const c of colors) {
        buildMountAnims(`pack_ride_horse_hair_${s}_${c}`, "horse");
        buildMountAnims(`pack_ride_bicycle_hair_${s}_${c}`, "bicycle");
      }
    }

    // 4. Rider Clothes
    for (const c of cColors) {
      buildMountAnims(`pack_ride_horse_clothes_${c}`, "horse");
      buildMountAnims(`pack_ride_bicycle_clothes_${c}`, "bicycle");
    }

    // 5. Rider Beards
    for (const b of bColors) {
      buildMountAnims(`pack_ride_horse_beard_${b}`, "horse");
      buildMountAnims(`pack_ride_bicycle_beard_${b}`, "bicycle");
    }

    // 6. Rider Accessories
    for (const a of accs) {
      buildMountAnims(`pack_ride_horse_acc_${a}`, "horse");
      buildMountAnims(`pack_ride_bicycle_acc_${a}`, "bicycle");
    }

    // 7. Rider Eyes (idle only)
    for (const g of genders) {
      for (const ec of eyeColors) {
        const hEyeKey = `pack_ride_horse_eyes_${g}_${ec}_idle`;
        if (this.textures.exists(hEyeKey)) {
          directionsList.forEach((dir) => {
            const dirIndex = packDirections.indexOf(dir);
            this.anims.create({
              key: `${hEyeKey}_${dir}`,
              frames: [{ key: hEyeKey, frame: dirIndex }],
              frameRate: 1,
              repeat: -1,
            });
          });
        }
        const bEyeKey = `pack_ride_bicycle_eyes_${g}_${ec}_idle`;
        if (this.textures.exists(bEyeKey)) {
          directionsList.forEach((dir) => {
            const dirIndex = packDirections.indexOf(dir);
            this.anims.create({
              key: `${bEyeKey}_${dir}`,
              frames: [{ key: bEyeKey, frame: dirIndex }],
              frameRate: 1,
              repeat: -1,
            });
          });
        }
      }
    }

    // ─── 8. Action Animations ────────────────────────────────────────────────
    const actionDirs = ["down", "right", "up", "left"];
    const packDirs = ["down", "down_diagonal", "up", "up_diagonal", "right", "right_diagonal", "left", "left_diagonal"];
    const actionAnims = [
      // Damage (16 frames = 4 per direction)
      { suffix: "_damage", totalFrames: 16, dirCount: 4, frameRate: 12, repeat: 0 },
      // Death (16 frames = 4 per direction)
      { suffix: "_death", totalFrames: 16, dirCount: 4, frameRate: 10, repeat: 0 },
      // Fishing Cast (60 frames = 15 per direction)
      { suffix: "_fishing_cast", totalFrames: 60, dirCount: 4, frameRate: 10, repeat: 0 },
      // Fishing Wait (16 frames = 4 per direction)
      { suffix: "_fishing_wait", totalFrames: 16, dirCount: 4, frameRate: 6, repeat: -1 },
      // Fishing Bite (32 frames = 8 per direction)
      { suffix: "_fishing_bite", totalFrames: 32, dirCount: 4, frameRate: 12, repeat: 0 },
      // Fishing Reel (16 frames = 4 per direction)
      { suffix: "_fishing_reel", totalFrames: 16, dirCount: 4, frameRate: 10, repeat: 0 },
      // Fishing Catch (16 frames = 4 per direction)
      { suffix: "_fishing_catch", totalFrames: 16, dirCount: 4, frameRate: 10, repeat: 0 },
      // Carrying Idle (16 frames = 4 per direction)
      { suffix: "_carry_idle", totalFrames: 16, dirCount: 4, frameRate: 6, repeat: -1 },
      // Carrying Walk (24 frames = 6 per direction)
      { suffix: "_carry_walk", totalFrames: 24, dirCount: 4, frameRate: 8, repeat: -1 },
      // Carrying Run (32 frames = 8 per direction)
      { suffix: "_carry_run", totalFrames: 32, dirCount: 4, frameRate: 10, repeat: -1 },
      // Sit (4 frames = 1 per direction)
      { suffix: "_sit", totalFrames: 4, dirCount: 4, frameRate: 1, repeat: -1 },
      // Sleep (6 frames = 1 direction)
      { suffix: "_sleep", totalFrames: 6, dirCount: 1, frameRate: 4, repeat: -1 },
      // Petting (12 frames = 3 per direction)
      { suffix: "_petting", totalFrames: 12, dirCount: 4, frameRate: 10, repeat: 0 },
      // Climbing (5 frames = 1 direction)
      { suffix: "_climbing", totalFrames: 5, dirCount: 1, frameRate: 10, repeat: -1 },
      // Flute (18 frames = 1 direction)
      { suffix: "_flute", totalFrames: 18, dirCount: 1, frameRate: 8, repeat: -1 },
      // Mage (24 frames = 6 per direction)
      { suffix: "_mage", totalFrames: 24, dirCount: 4, frameRate: 12, repeat: 0 },
      // Swim Idle (16 frames = 4 per direction)
      { suffix: "_swim_idle", totalFrames: 16, dirCount: 4, frameRate: 6, repeat: -1 },
      // Swim Outwater (12 frames = 3 per direction)
      { suffix: "_swim_outwater", totalFrames: 12, dirCount: 4, frameRate: 10, repeat: 0 },
      // Swim Submerged (12 frames = 3 per direction)
      { suffix: "_swim_submerged", totalFrames: 12, dirCount: 4, frameRate: 8, repeat: -1 },
      // Swim Swim (16 frames = 4 per direction)
      { suffix: "_swim_swim", totalFrames: 16, dirCount: 4, frameRate: 10, repeat: -1 },
      // Broomstick (16 frames, 8 directions, 2 frames per direction)
      { suffix: "_broomstick", totalFrames: 16, dirCount: 8, frameRate: 8, repeat: -1 },
      // Sword Attack (40 frames = 10 per direction)
      { suffix: "_sword_attack", totalFrames: 40, dirCount: 4, frameRate: 14, repeat: 0 },
      // Bow Attack (28 frames = 7 per direction)
      { suffix: "_bow_attack", totalFrames: 28, dirCount: 4, frameRate: 12, repeat: 0 },
      // Pickaxe Attack (24 frames = 6 per direction)
      { suffix: "_pickaxe_attack", totalFrames: 24, dirCount: 4, frameRate: 14, repeat: 0 },
      // Hoe Attack (24 frames = 6 per direction)
      { suffix: "_hoe_attack", totalFrames: 24, dirCount: 4, frameRate: 14, repeat: 0 },
      // Shovel Attack (20 frames = 5 per direction)
      { suffix: "_shovel_attack", totalFrames: 20, dirCount: 4, frameRate: 14, repeat: 0 },
      // Axe Attack (24 frames = 6 per direction)
      { suffix: "_axe_attack", totalFrames: 24, dirCount: 4, frameRate: 14, repeat: 0 },
      // Scythe Attack (24 frames = 6 per direction)
      { suffix: "_scythe_attack", totalFrames: 24, dirCount: 4, frameRate: 14, repeat: 0 },
      // Watering (32 frames = 8 per direction)
      { suffix: "_watering", totalFrames: 32, dirCount: 4, frameRate: 12, repeat: 0 },
    ];

    const buildActionAnims = (keyPrefix: string, suffix: string, totalFrames: number, dirCount: number, frameRate: number, repeat: number) => {
      const fullKey = `${keyPrefix}${suffix}`;
      if (!this.textures.exists(fullKey)) return;

      if (dirCount === 1) {
        // Single animation (no directions)
        const animKey = `${fullKey}_anim`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(fullKey, { start: 0, end: totalFrames - 1 }),
            frameRate: frameRate,
            repeat: repeat,
          });
        }
      } else {
        // Directional variant (4 or 8 directions)
        const dirs = ["down", "right", "up", "left"];
        dirs.forEach((dir) => {
          let dirIndex = 0;
          if (dirCount === 4) {
            // Mage/Archer order: 0: down, 1: up, 2: right, 3: left
            const mageDirs = ["down", "up", "right", "left"];
            dirIndex = mageDirs.indexOf(dir);
          } else {
            // 8 directions order (sword_attack, damage, death, broomstick)
            dirIndex = packDirs.indexOf(dir);
          }

          const framesPerDir = totalFrames / dirCount;
          const start = dirIndex * Math.floor(framesPerDir);
          const end = start + Math.ceil(framesPerDir) - 1;
          const animKey = `${fullKey}_${dir}`;
          if (!this.anims.exists(animKey)) {
            this.anims.create({
              key: animKey,
              frames: this.anims.generateFrameNumbers(fullKey, { start, end }),
              frameRate: frameRate,
              repeat: repeat,
            });
          }
        });
      }
    };

    const gendersList = ["Male", "Female"];
    const eyeColorsList = ["Black", "Blue", "Brown", "Green"];
    const stylesList = ["Standard", "Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist"];
    const colorsList = ["Black", "Blonde", "Brown", "Ginger"];
    const clothesList = ["Blue", "Green", "Pink", "Purple", "Red", "White"];
    const accsList = ["Beret", "Wizard", "Pirate", "Farm", "Santa_hat", "Leprechaun", "Cook", "Chicken", "Cow", "Frog", "Deer"];

    // Register all action anims for skins, eyes, hair, clothes, weapons, and broomsticks!
    actionAnims.forEach(anim => {
      // 1. Skins
      for (let t = 1; t <= 4; t++) {
        buildActionAnims(`pack_skin_${t}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
      }
      // 2. Eyes
      for (const g of gendersList) {
        for (const ec of eyeColorsList) {
          buildActionAnims(`pack_eyes_${g}_${ec}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        }
      }
      // 3. Hair
      for (const s of stylesList) {
        for (const c of colorsList) {
          buildActionAnims(`pack_hair_${s}_${c}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        }
      }
      // 4. Clothes
      for (const c of clothesList) {
        buildActionAnims(`pack_clothes_${c}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
      }

      // 4.5. Accessories
      for (const a of accsList) {
        buildActionAnims(`pack_acc_${a}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
      }
      // 5. Weapons
      for (let tier = 1; tier <= 10; tier++) {
        buildActionAnims(`pack_weapon_Sword_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Bow_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Pickaxe_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Hoe_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Axe_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Sickle_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Shovel_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Watering_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
        buildActionAnims(`pack_weapon_Fishing_Rod_${tier}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
      }
      // 6. Broomstick Mounts
      for (let c = 1; c <= 3; c++) {
        buildActionAnims(`pack_ride_broomstick_mount_${c}`, anim.suffix, anim.totalFrames, anim.dirCount, anim.frameRate, anim.repeat);
      }
    });

    // ─── 9. Horse Extended Animations (Lower, Eating) ────────────────────────
    const horseLowerEat = ["lower", "eating"];
    for (const action of horseLowerEat) {
      for (let c = 1; c <= 5; c++) {
        const mountKey = `pack_ride_horse_mount_${c}_${action}`;
        if (this.textures.exists(mountKey)) {
          actionDirs.forEach((dir) => {
            const dirIndex = packDirs.indexOf(dir);
            const animKey = `${mountKey}_${dir}`;
            if (!this.anims.exists(animKey)) {
              this.anims.create({
                key: animKey,
                frames: [{ key: mountKey, frame: dirIndex }],
                frameRate: 1,
                repeat: -1,
              });
            }
          });
        }
      }
    }

    // ─── 10. Bear Enemy Animations ───────────────────────────────────────────
    const bearAnims = [
      { key: "bear", suffix: "idle", count: 16, rate: 6 },
      { key: "bear", suffix: "walk", count: 24, rate: 10 },
      { key: "bear", suffix: "run", count: 32, rate: 14 },
      { key: "bear", suffix: "attack", count: 15, rate: 12 },
      { key: "bear", suffix: "hit", count: 10, rate: 14 },
      { key: "bear", suffix: "dead", count: 15, rate: 8 },
    ];
    for (const ba of bearAnims) {
      const sheetKey = `bear_${ba.suffix}`;
      if (this.textures.exists(sheetKey)) {
        this.anims.create({
          key: `${sheetKey}_anim`,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: ba.count - 1 }),
          frameRate: ba.rate,
          repeat: ba.suffix === "dead" ? 0 : -1,
        });
      }
    }

    // ─── 11. NPC Animations ──────────────────────────────────────────────────
    const npcAnims = [
      { key: "npc_banker", suffix: "idle", count: 16, rate: 6 },
      { key: "npc_banker", suffix: "walk", count: 24, rate: 10 },
      { key: "npc_banker", suffix: "run", count: 32, rate: 14 },
      { key: "npc_blacksmith", suffix: "idle", count: 16, rate: 6 },
      { key: "npc_blacksmith", suffix: "walk", count: 24, rate: 10 },
      { key: "npc_blacksmith", suffix: "pickaxe", count: 20, rate: 12 },
      { key: "npc_pirate", suffix: "idle", count: 16, rate: 6 },
      { key: "npc_pirate", suffix: "walk", count: 24, rate: 10 },
      { key: "npc_mermaid", suffix: "idle", count: 16, rate: 6 },
      { key: "npc_mermaid", suffix: "swim", count: 24, rate: 10 },
    ];
    for (const na of npcAnims) {
      const sheetKey = na.key;
      if (this.textures.exists(sheetKey)) {
        this.anims.create({
          key: `${na.key}_${na.suffix}`,
          frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: na.count - 1 }),
          frameRate: na.rate,
          repeat: -1,
        });
      }
    }

    // Custom closet frames registration
    const closetTex = this.textures.get("pack_int_closet");
    if (closetTex) {
      for (let r = 0; r < 12; r++) {
        for (let b = 0; b < 6; b++) {
          const blockX = b * 112;
          const y = r * 48;
          closetTex.add(`frame_c1_${r}_${b}`, 0, blockX, y, 32, 48);
          closetTex.add(`frame_c2_${r}_${b}`, 0, blockX + 32, y, 32, 48);
          closetTex.add(`frame_c3_${r}_${b}`, 0, blockX + 64, y, 48, 48);
        }
      }
    }
  }

  // ─── Grid Overlay Drawing ──────────────────────────────────────────────────

  private drawGridOverlay(): void {
    if (!this.gridOverlayGraphics) {
      this.gridOverlayGraphics = this.add.graphics();
    }
    this.gridOverlayGraphics.clear();
    this.gridOverlayGraphics.fillStyle(0x0f2405, 1); // Dark background
    this.gridOverlayGraphics.fillRect(0, 0, this.mapWidth, this.mapHeight);

    // Grid lines
    this.gridOverlayGraphics.lineStyle(1, 0x1d470d, 0.45);
    for (let x = 0; x <= this.mapWidth; x += TILE_SIZE) {
      this.gridOverlayGraphics.moveTo(x, 0);
      this.gridOverlayGraphics.lineTo(x, this.mapHeight);
    }
    for (let y = 0; y <= this.mapHeight; y += TILE_SIZE) {
      this.gridOverlayGraphics.moveTo(0, y);
      this.gridOverlayGraphics.lineTo(this.mapWidth, y);
    }
    this.gridOverlayGraphics.strokePath();

    // Map boundary border
    this.gridOverlayGraphics.lineStyle(2, 0x55ff22, 0.7);
    this.gridOverlayGraphics.strokeRect(1, 1, this.mapWidth - 2, this.mapHeight - 2);
  }

  // ─── Editor Painter / Eraser / Panning / Dragging Inputs ────────────────────

  private setupEditorInputs(): void {
    // Disable default browser context menu on canvas
    this.input.mouse!.disableContextMenu();

    const handlePaint = (pointer: Phaser.Input.Pointer) => {
      if (!this.editorMode) return;
      if (pointer.button !== 0) return; // Only left-click paints/erases
      if (this.isDraggingCamera || this.isDraggingObject) return;

      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      const maxCols = this.mapWidth / TILE_SIZE;
      const maxRows = this.mapHeight / TILE_SIZE;

      if (tileX >= 0 && tileX < maxCols && tileY >= 0 && tileY < maxRows) {
        if (this.currentBrushType === "tile") {
          if (this.currentTileStamp) {
            const updates: Array<{ x: number; y: number; tileIndex: number; layer: "terrain" | "decor" }> = [];
            for (let r = 0; r < this.currentTileStamp.height; r++) {
              for (let c = 0; c < this.currentTileStamp.width; c++) {
                const tx = tileX + c;
                const ty = tileY + r;
                if (tx >= 0 && tx < maxCols && ty >= 0 && ty < maxRows) {
                  const tileIndex = this.currentTileStamp.tiles[r][c];
                  const layer = this.paintOnTop ? "decor" : this.getLayerForTileIndex(tileIndex);
                  updates.push({
                    x: tx,
                    y: ty,
                    tileIndex,
                    layer
                  });
                }
              }
            }
            if (updates.length > 0) {
              this.room.send("tile-update-multi", { updates });
            }
          } else {
            const layer = this.paintOnTop ? "decor" : this.getLayerForTileIndex(this.currentTileIndex);
            const encodedIndex = this.currentTileIndex + (this.activeBrushRotationStep << 16) + (this.activeBrushFlipX ? 1 << 18 : 0) + (this.activeBrushFlipY ? 1 << 19 : 0);
            this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: encodedIndex, layer });
          }
        } else if (this.currentBrushType === "eraser_line") {
          // Delete any collision blocker on this tile
          const targetX = tileX * 32 + 16;
          const targetY = tileY * 32 + 16;
          const blockerToDelete = this.placedObjects.find(obj => obj.type === "collision_blocker" && obj.x === targetX && obj.y === targetY);
          if (blockerToDelete) {
            this.room.send("object-delete", { id: blockerToDelete.id });
          }

          // Delete any collision line near the pointer
          const lineToDelete = this.placedObjects.find(obj => {
            if (obj.type !== "collision_line") return false;
            const dist = this.distToSegment(pointer.worldX, pointer.worldY, obj.x, obj.y, obj.scale, obj.angle ?? 0);
            return dist <= 16;
          });
          if (lineToDelete) {
            this.room.send("object-delete", { id: lineToDelete.id });
          }
        } else if (this.currentBrushType === "eraser" && !this.clickedGameObject) {
          if (this.paintOnTop) {
            // Layering mode: peel one layer at a time (decor first, then terrain)
            const decorTile = this.map.getTileAt(tileX, tileY, true, this.decorLayer);
            if (decorTile && decorTile.index !== -1) {
              this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: -1, layer: "decor" });
            } else {
              this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: -1, layer: "terrain" });
              this.room.send("crop-remove", { x: tileX, y: tileY });
            }
          } else {
            // Normal mode: erase both layers at once
            this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: -1, layer: "decor" });
            this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: -1, layer: "terrain" });
            this.room.send("crop-remove", { x: tileX, y: tileY });
          }
        }
      }
    };

    // ─── Click / Drag Input Handlers ───
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) { // Left Click
        const tileX = Math.floor(pointer.worldX / 16);
        const tileY = Math.floor(pointer.worldY / 16);
        const tileKey = `${this.currentMapId}:${tileX},${tileY}`;
        const crop = this.room?.state.crops.get(tileKey);

        const localPlayerState = this.room?.state.players.get(this.localId);
        const eqWeapon = localPlayerState?.equippedWeapon || "";
        const parts = eqWeapon.split(":");
        const toolName = parts[1] || "";
        const isFishing = (localPlayerState?.state?.startsWith("fishing_")) || this.isFishingTimelineActive;

         if (!this.editorMode && toolName === "Fishing_Rod" && !isFishing) {
          // Find if there is a fish spot near the click (within 32 pixels in world coordinates)
          const clickedFishObj = this.placedObjects.find(obj => {
            const assetDef = this.room?.state.customAssets.get(obj.type);
            const isFishType = obj.type.toLowerCase().includes("fish") || 
                               obj.type.toLowerCase().includes("bubbles") || 
                               obj.type.toLowerCase().includes("balık") ||
                               (assetDef && (
                                 assetDef.label.toLowerCase().includes("fish") || 
                                 assetDef.label.toLowerCase().includes("balık") || 
                                 assetDef.path.toLowerCase().includes("fish") || 
                                 assetDef.path.toLowerCase().includes("bubbles")
                               ));
            
            if (!isFishType) return false;
            
            const clickDist = Phaser.Math.Distance.Between(obj.x, obj.y, pointer.worldX, pointer.worldY);
            return clickDist <= 32;
          });

          if (clickedFishObj) {
            const localPlayer = this.entities.get(this.localId);
            if (localPlayer) {
              const px = localPlayer.container.x;
              const py = localPlayer.container.y;
              const distance = Phaser.Math.Distance.Between(px, py, clickedFishObj.x, clickedFishObj.y);
              
              if (distance > 40) {
                // Show floating error message and return
                this.showFloatingText("Balık tutmak için spota daha çok yaklaşmalısın! 🚶‍♂️", px, py - 40, "#ff5555");
                return;
              }
              
              // Face the player directly towards the clicked fish spot
              let fishDir = "down";
              const dx = clickedFishObj.x - px;
              const dy = clickedFishObj.y - py;
              if (Math.abs(dx) > Math.abs(dy)) {
                fishDir = dx > 0 ? "right" : "left";
              } else {
                fishDir = dy > 0 ? "down" : "up";
              }
              
              // Set local override direction instantly to prevent network latency rotation issues
              this.localFishingDir = fishDir;
              this.updatePlayerLayers(localPlayer, localPlayerState, this.localId);
              
              // Inform server of direction
              this.room.send("move", { dx: 0, dy: 0, dir: fishDir });
              
              // Start the fishing sequence
              this.startFishingSequence();
              return;
            }
          }
        }

        if (crop && crop.stage >= 6) {
          // Harvest if fully grown (works in both play and edit modes!)
          this.room?.send("crop-harvest", { x: tileX, y: tileY });
          return;
        }

        // Play mode seed planting! (Requires and consumes purchased seeds)
        if (!this.editorMode && this.selectedSeed) {
          if (!crop) {
            // Check if ground tile is farmland (GID 227 or 451) on either terrain or decor layer
            const terrainTile = this.map.getTileAt(tileX, tileY, true, this.layer);
            const decorTile = this.map.getTileAt(tileX, tileY, true, this.decorLayer);
            const terrainGid = terrainTile ? terrainTile.index : -1;
            const decorGid = decorTile ? decorTile.index : -1;
            
            // Check if there is a farm_tile_hoed object at this grid position
            let hasFarmObject = false;
            this.placedObjects.forEach(obj => {
              if (obj.type === "farm_tile_hoed") {
                const ox = Math.floor(obj.x / 16);
                const oy = Math.floor(obj.y / 16);
                if (ox === tileX && oy === tileY) {
                  hasFarmObject = true;
                }
              }
            });

            const isFarmland = (
              terrainGid === 227 || terrainGid === 228 || terrainGid === 451 || terrainGid === 452 ||
              decorGid === 227 || decorGid === 228 || decorGid === 451 || decorGid === 452 ||
              hasFarmObject
            );
            if (!isFarmland) {
              alert("⚠️ Sadece hazırlanmış tarla toprağı üzerine ekim yapabilirsiniz!");
              return;
            }
            this.room?.send("crop-plant", { x: tileX, y: tileY, cropType: this.selectedSeed, free: false });
            this.game.events.emit("crop-planted", { cropType: this.selectedSeed });
          }
          return;
        }

        if (this.editorMode && !this.clickedGameObject) {
          if (this.currentBrushType === "object") {
            if (this.currentObjectName === "collision_line") {
              this.lineDrawStart = { x: pointer.worldX, y: pointer.worldY };
              this.tempLineGraphics = this.add.graphics();
              return;
            }

            const now = Date.now();
            if (now - this.lastPlacedTime < 250) {
              return;
            }
            this.lastPlacedTime = now;

            // Place building object on server
            const uniqueId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const defaultScale = this.getDefaultScaleForType(this.currentObjectName);
            let posX = pointer.worldX;
            let posY = pointer.worldY;
            // Snaps farm_tiles to 16px grid, collision_blockers to 32px grid
            if (
              this.currentObjectName === "farm_tile" || 
              this.currentObjectName === "farm_tile_hoed" || 
              this.currentObjectName === "farm_tile_watered"
            ) {
              posX = Math.floor(pointer.worldX / 16) * 16 + 8;
              posY = Math.floor(pointer.worldY / 16) * 16 + 8;
            } else if (this.currentObjectName === "collision_blocker") {
              posX = Math.floor(pointer.worldX / 32) * 32 + 16;
              posY = Math.floor(pointer.worldY / 32) * 32 + 16;
              // Prevent duplicate blockers on click
              const exists = this.placedObjects.some(obj => obj.type === "collision_blocker" && obj.x === posX && obj.y === posY);
              if (exists) return;
            }
            this.room.send("object-place", {
              id: uniqueId,
              type: this.currentObjectName,
              x: posX,
              y: posY,
              scale: defaultScale
            });
          } else if (this.currentBrushType === "seed" && this.selectedSeed) {
            // Plant a crop on the clicked tile
            if (!crop) {
              // Check if ground tile is farmland (GID 227 or 451) on either terrain or decor layer
              const terrainTile = this.map.getTileAt(tileX, tileY, true, this.layer);
              const decorTile = this.map.getTileAt(tileX, tileY, true, this.decorLayer);
              const terrainGid = terrainTile ? terrainTile.index : -1;
              const decorGid = decorTile ? decorTile.index : -1;
              
              // Check if there is a farm_tile object at this grid position (allow all stages in editor)
              let hasFarmObject = false;
              this.placedObjects.forEach(obj => {
                if (obj.type === "farm_tile" || obj.type === "farm_tile_hoed" || obj.type === "farm_tile_watered") {
                  const ox = Math.floor(obj.x / 16);
                  const oy = Math.floor(obj.y / 16);
                  if (ox === tileX && oy === tileY) {
                    hasFarmObject = true;
                  }
                }
              });

              const isFarmland = (
                terrainGid === 227 || terrainGid === 228 || terrainGid === 451 || terrainGid === 452 ||
                decorGid === 227 || decorGid === 228 || decorGid === 451 || decorGid === 452 ||
                hasFarmObject
              );
              if (!isFarmland) {
                alert("⚠️ Sadece hazırlanmış tarla toprağı üzerine ekim yapabilirsiniz!");
                return;
              }
              this.room?.send("crop-plant", { x: tileX, y: tileY, cropType: this.selectedSeed, free: true });
            }
          } else {
            handlePaint(pointer);
          }
        }
      }
      
      // ─── Drag Panning (Right Click) ───
      else if (pointer.button === 2 && this.editorMode) {
        this.cameras.main.stopFollow();
        this.isDraggingCamera = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = this.cameras.main.scrollX;
        this.cameraStartY = this.cameras.main.scrollY;

        // Also check harvest if in seed mode
        if (this.currentBrushType === "seed") {
          const tileX = Math.floor(pointer.worldX / 16);
          const tileY = Math.floor(pointer.worldY / 16);
          const tileKey = `${this.currentMapId}:${tileX},${tileY}`;
          const crop = this.room?.state.crops.get(tileKey);
          if (crop && crop.stage >= 6) {
            this.room?.send("crop-harvest", { x: tileX, y: tileY });
          }
        }
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // Paint if left dragging
      if (pointer.isDown && pointer.button === 0) {
        handlePaint(pointer);
      }
      
      // Pan if right dragging
      else if (this.isDraggingCamera && pointer.button === 2) {
        const dx = pointer.x - this.dragStartX;
        const dy = pointer.y - this.dragStartY;
         const newScrollX = Phaser.Math.Clamp(this.cameraStartX - dx, 0, this.mapWidth - this.cameras.main.width);
         const newScrollY = Phaser.Math.Clamp(this.cameraStartY - dy, 0, this.mapHeight - this.cameras.main.height);
        this.cameras.main.setScroll(newScrollX, newScrollY);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2) {
        this.isDraggingCamera = false;
      }
      // Reset clicked flag at end of frame
      this.time.delayedCall(10, () => {
        this.clickedGameObject = false;
      });
    });

    // ─── Object Click / Drag handlers ───
    this.input.on("gameobjectdown", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const type = gameObject.getData("type");
      const id = gameObject.getData("id");

      if (!this.editorMode) {
        if (pointer.button === 0 && type === "farmer_npc") {
          this.game.events.emit("open-farmer-shop");
        }
        if (pointer.button === 0 && (type === "marketplace" || type === "shop")) {
          this.game.events.emit("open-marketplace");
        }
        if (pointer.button === 0 && type === "player") {
          const sid = gameObject.getData("sessionId");
          this.game.events.emit("open-player-profile", { sessionId: sid });
        }
        // NPC Click Handlers
        if (pointer.button === 0 && type === "npc") {
          const npcKey = gameObject.getData("npcKey");
          if (npcKey === "banker") {
            this.game.events.emit("open-farmer-shop");
          } else if (npcKey === "blacksmith") {
            this.game.events.emit("open-marketplace");
          }
        }

        // Farm Tile Interactions in Play Mode
        if (pointer.button === 0 && (type === "farm_tile" || type === "farm_tile_hoed" || type === "farm_tile_watered")) {
          const imgObj = gameObject as Phaser.GameObjects.Image;
          const tileX = Math.floor(imgObj.x / 16);
          const tileY = Math.floor(imgObj.y / 16);
          const tileKey = `${this.currentMapId}:${tileX},${tileY}`;
          const crop = this.room?.state.crops.get(tileKey);

          // 1. Tool usage
          if (this.activePlayTool === "hoe") {
            if (type === "farm_tile") {
              this.room?.send("use-tool-on-object", { id, tool: "hoe" });
            } else {
              alert("⚠️ Bu tarla zaten kazılmış!");
            }
            return;
          }
          if (this.activePlayTool === "watering_can") {
            if (type === "farm_tile_hoed") {
              if (crop) {
                this.room?.send("use-tool-on-object", { id, tool: "watering_can" });
              } else {
                alert("⚠️ Önce tohum ekmelisiniz!");
              }
            } else if (type === "farm_tile_watered") {
              alert("⚠️ Bu tarla zaten sulanmış!");
            } else {
              alert("⚠️ Önce tarlayı çapa ile kazıp tohum ekmelisiniz!");
            }
            return;
          }

          // 2. Planting seed
          if (this.selectedSeed) {
            if (type === "farm_tile") {
              alert("⚠️ Önce tarlayı çapa ile kazmanız gerekiyor!");
              return;
            }
            if (type === "farm_tile_watered") {
              alert("⚠️ Bu tarlaya zaten ekin ekilmiş!");
              return;
            }
            if (!crop) {
              this.room?.send("crop-plant", { x: tileX, y: tileY, cropType: this.selectedSeed, free: false });
              this.game.events.emit("crop-planted", { cropType: this.selectedSeed });
            }
            return;
          }

          // 3. Harvesting crop
          if (crop && crop.stage >= 6) {
            this.room?.send("crop-harvest", { x: tileX, y: tileY });
            return;
          }
        }
        return;
      }
      this.clickedGameObject = true;

      if (pointer.button === 0) { // Left click on object
        if (this.currentBrushType === "eraser") {
          this.room.send("object-delete", { id });
        } else {
          this.selectObject(id);
        }
      }
    });

    this.input.on("dragstart", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (!this.editorMode) return;
      this.isDraggingObject = true;
      this.selectObject(gameObject.getData("id"));
    });

    this.input.on("drag", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
      if (!this.editorMode) return;
      let posX = dragX;
      let posY = dragY;
      const type = gameObject.getData("type") as string;
      // Sadece tarla tile'ları sürüklenirken ızgaraya hizalanır, diğerleri serbest
      if (type === "farm_tile" || type === "farm_tile_hoed" || type === "farm_tile_watered") {
        posX = Math.floor(dragX / 16) * 16 + 8;
        posY = Math.floor(dragY / 16) * 16 + 8;
      }
      gameObject.x = posX;
      gameObject.y = posY;
      
      const id = gameObject.getData("id");
      const obj = this.placedObjects.find(o => o.id === id);
      if (obj) {
        obj.x = posX;
        obj.y = posY;
      }
      this.drawSelectionOutline();
    });

    this.input.on("dragend", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
      this.isDraggingObject = false;
      const id = gameObject.getData("id");
      this.room.send("object-move", { id, x: gameObject.x, y: gameObject.y });
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.editorMode) return;
      if (this.lineDrawStart && this.tempLineGraphics) {
        this.tempLineGraphics.clear();
        this.tempLineGraphics.lineStyle(3, 0xff0000, 0.85);
        this.tempLineGraphics.strokeLineShape(new Phaser.Geom.Line(this.lineDrawStart.x, this.lineDrawStart.y, pointer.worldX, pointer.worldY));
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.editorMode) return;
      if (this.lineDrawStart) {
        if (this.tempLineGraphics) {
          this.tempLineGraphics.destroy();
          this.tempLineGraphics = null;
        }

        const dist = Phaser.Math.Distance.Between(this.lineDrawStart.x, this.lineDrawStart.y, pointer.worldX, pointer.worldY);
        if (dist > 5) {
          const uniqueId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          this.room.send("object-place", {
            id: uniqueId,
            type: "collision_line",
            x: this.lineDrawStart.x,
            y: this.lineDrawStart.y,
            scale: pointer.worldX, // x2
            angle: pointer.worldY  // y2
          });
        }
        this.lineDrawStart = null;
      }
    });

    // R Key - Rotate hovered tile in editor mode
    this.input.keyboard!.on("keydown-R", () => {
      if (!this.editorMode) return;
      
      const pointer = this.input.activePointer;
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      const maxCols = this.mapWidth / TILE_SIZE;
      const maxRows = this.mapHeight / TILE_SIZE;

      if (tileX >= 0 && tileX < maxCols && tileY >= 0 && tileY < maxRows) {
        let tile = this.map.getTileAt(tileX, tileY, true, this.decorLayer);
        let layer: "decor" | "terrain" = "decor";
        
        if (!tile || tile.index === -1) {
          tile = this.map.getTileAt(tileX, tileY, true, this.layer);
          layer = "terrain";
        }

        if (tile && tile.index !== -1) {
          const currentRotStep = Math.round(tile.rotation / (Math.PI / 2)) % 4;
          const nextRotStep = (currentRotStep + 1) % 4;
          const isFlipX = tile.flipX ? 1 : 0;
          const isFlipY = tile.flipY ? 1 : 0;
          const encodedIndex = tile.index + (nextRotStep << 16) + (isFlipX << 18) + (isFlipY << 19);
          
          this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: encodedIndex, layer });
        }
      }
      
      // Also update brush rotation if they are holding a tile
      this.activeBrushRotationStep = (this.activeBrushRotationStep + 1) % 4;
    });

    // F Key - Flip hovered tile horizontally in editor mode
    this.input.keyboard!.on("keydown-F", () => {
      if (!this.editorMode) return;

      const pointer = this.input.activePointer;
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      const maxCols = this.mapWidth / TILE_SIZE;
      const maxRows = this.mapHeight / TILE_SIZE;

      if (tileX >= 0 && tileX < maxCols && tileY >= 0 && tileY < maxRows) {
        let tile = this.map.getTileAt(tileX, tileY, true, this.decorLayer);
        let layer: "decor" | "terrain" = "decor";
        
        if (!tile || tile.index === -1) {
          tile = this.map.getTileAt(tileX, tileY, true, this.layer);
          layer = "terrain";
        }

        if (tile && tile.index !== -1) {
          const currentRotStep = Math.round(tile.rotation / (Math.PI / 2)) % 4;
          const nextFlipX = tile.flipX ? 0 : 1;
          const isFlipY = tile.flipY ? 1 : 0;
          const encodedIndex = tile.index + (currentRotStep << 16) + (nextFlipX << 18) + (isFlipY << 19);

          this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: encodedIndex, layer });
        }
      }

      this.activeBrushFlipX = !this.activeBrushFlipX;
    });

    // H Key - Toggle Horse Mount
    this.input.keyboard!.on("keydown-H", () => {
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        return;
      }
      const localPlayer = this.room.state.players.get(this.room.sessionId);
      if (!localPlayer) return;

      const isCurrentlyRidingHorse = localPlayer.isRiding && localPlayer.mountType && localPlayer.mountType.indexOf("horse") !== -1;
      if (isCurrentlyRidingHorse) {
        this.room.send("toggle-mount", { mountType: "none" });
      } else {
        this.room.send("toggle-mount", { mountType: "horse_1" });
      }
    });

    // B Key - Toggle Bicycle Mount
    this.input.keyboard!.on("keydown-B", () => {
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        return;
      }
      const localPlayer = this.room.state.players.get(this.room.sessionId);
      if (!localPlayer) return;

      const isCurrentlyRidingBicycle = localPlayer.isRiding && localPlayer.mountType && localPlayer.mountType.indexOf("bicycle") !== -1;
      if (isCurrentlyRidingBicycle) {
        this.room.send("toggle-mount", { mountType: "none" });
      } else {
        this.room.send("toggle-mount", { mountType: "bicycle_blue" });
      }
    });

    // G Key - Toggle Broomstick Mount
    this.input.keyboard!.on("keydown-G", () => {
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        return;
      }
      const localPlayer = this.room.state.players.get(this.room.sessionId);
      if (!localPlayer) return;

      const isCurrentlyRidingBroom = localPlayer.isRiding && localPlayer.mountType && localPlayer.mountType.indexOf("broomstick") !== -1;
      if (isCurrentlyRidingBroom) {
        this.room.send("toggle-mount", { mountType: "none" });
      } else {
        this.room.send("toggle-mount", { mountType: "broomstick_1" });
      }
    });
  }

  // ─── Selection Management ──────────────────────────────────────────────────

  private selectObject(id: string): void {
    this.selectedObjectId = id;
    const obj = this.placedObjects.find(o => o.id === id);
    if (obj) {
      const stateObj = this.room.state.placedObjects.get(id);
      const animSpeed = stateObj ? stateObj.animSpeed : 1.0;
      this.game.events.emit("editor-object-selected", {
        id: obj.id,
        type: obj.type,
        scale: obj.scale,
        animSpeed: animSpeed,
      });
      this.drawSelectionOutline();
    }
  }

  private deselectObject(): void {
    this.selectedObjectId = null;
    this.selectionGraphics.clear();
    this.game.events.emit("editor-object-deselected");
  }

  private drawSelectionOutline(): void {
    this.selectionGraphics.clear();
    if (!this.editorMode || !this.selectedObjectId) return;

    const obj = this.placedObjects.find(o => o.id === this.selectedObjectId);
    if (obj && obj.imageObj) {
      const bounds = obj.imageObj.getBounds();
      // Draw green dashed-like selector border
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      this.selectionGraphics.lineStyle(2, 0x55ff22, 1);
      this.selectionGraphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      
      // Handles
      this.selectionGraphics.fillStyle(0x55ff22, 1);
      this.selectionGraphics.fillRect(bounds.x - 4, bounds.y - 4, 8, 8);
      this.selectionGraphics.fillRect(bounds.x + bounds.width - 4, bounds.y - 4, 8, 8);
      this.selectionGraphics.fillRect(bounds.x - 4, bounds.y + bounds.height - 4, 8, 8);
      this.selectionGraphics.fillRect(bounds.x + bounds.width - 4, bounds.y + bounds.height - 4, 8, 8);
    }
  }

  // ─── Local Objects Spawning ───────────────────────────────────────────────

  private spawnLocalObject(type: string, x: number, y: number, scale = 0.15, id: string, animSpeed = 1.0): PlacedObject {
    // Destroy previous representation if it exists
    this.destroyLocalObject(id);

    const isAnimated = type.startsWith("vfx_") || type.startsWith("mg_");
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    if (type === "collision_blocker") {
      // Create a translucent red rectangle (32x32) for visual feedback in editor mode
      const rect = this.add.rectangle(x, y, 32, 32, 0xff0000, 0.45);
      rect.setStrokeStyle(1.5, 0xff0000, 0.85);
      rect.setOrigin(0.5, 0.5);
      rect.setDepth(99999); // Draw on top
      rect.setVisible(this.editorMode);
      img = rect as any;
    } else if (type === "collision_line") {
      const graphics = this.add.graphics();
      graphics.lineStyle(3, 0xff0000, 0.8);
      const objState = this.room?.state.placedObjects.get(id);
      const x2 = objState ? objState.scale : x;
      const y2 = objState ? objState.angle : y;
      graphics.strokeLineShape(new Phaser.Geom.Line(x, y, x2, y2));
      graphics.setDepth(99999);
      graphics.setVisible(this.editorMode);
      img = graphics as any;
    } else if (type.startsWith("decor_gorsel_")) {
      const frameStr = type.substring("decor_gorsel_".length);
      const frameIdx = parseInt(frameStr, 10) || 0;
      img = this.add.image(x, y, "decor_sheet_gorsel", frameIdx);
    } else if (type === "farm_tile") {
      img = this.add.image(x, y, "farm_tile_sheet", 0);
    } else if (type === "farm_tile_hoed") {
      img = this.add.image(x, y, "farm_tile_sheet", 1);
    } else if (type === "farm_tile_watered") {
      img = this.add.image(x, y, "farm_tile_sheet", 2);
    } else if (type.includes(":")) {
      const parts = type.split(":");
      const sheetKey = parts[0];
      const frameStr = parts[1];
      const parsedInt = parseInt(frameStr, 10);
      const frameVal = isNaN(parsedInt) ? frameStr : parsedInt;
      img = this.add.sprite(x, y, sheetKey, frameVal);
    } else {
      const isPackSpritesheet = type.startsWith("pack_") && 
                                !type.startsWith("pack_ride_") && 
                                !type.startsWith("pack_acc_") && 
                                !type.startsWith("pack_eyes_") && 
                                !type.startsWith("pack_hair_") &&
                                !type.startsWith("pack_clothes_") &&
                                !type.startsWith("pack_beard_");
      if (isPackSpritesheet) {
        if (type === "pack_int_closet") {
          img = this.add.sprite(x, y, type, "frame_c1_0_0");
        } else {
          img = this.add.sprite(x, y, type, 0);
        }
      } else {
        img = isAnimated ? this.add.sprite(x, y, type) : this.add.image(x, y, type);
      }
    }
    
    img.setScale(scale);
    const objState = this.room?.state.placedObjects.get(id);
    if (objState) {
      img.setAngle(objState.angle || 0);
      img.setFlipX(objState.flipX || false);
    }
    if (type === "farm_tile" || type === "farm_tile_hoed" || type === "farm_tile_watered") {
      img.setOrigin(0.5, 0.5);
      img.setDepth(1.5);
    } else if (
      type.startsWith("pack_ext_bridge") ||
      type.startsWith("pack_ext_fence_") ||
      type.startsWith("pack_ext_white_fence") ||
      type.startsWith("pack_fences_tilemap") ||
      type.startsWith("pack_ext_dock") ||
      type.startsWith("pack_int_floor") ||
      type.startsWith("pack_dock_") ||
      type.startsWith("pack_iskele_") ||
      type.startsWith("iskele:")
    ) {
      // Floor-level objects: always render BELOW the player character
      img.setOrigin(0.5, 0.5);
      img.setDepth(1);
    } else {
      img.setOrigin(0.5, 0.8);
      img.setDepth(y);
    }
    // Precise hit area for structures to prevent click-stealing through transparent space
    const isStructure = type === "bank" || type === "games" || type === "blacksmith" || type === "shop" || type === "gem_trader" || type === "farmer_npc" || type === "marketplace" || type === "nft_house";
    if (isStructure) {
      const width = img.width;
      const height = img.height;
      // Define a hit area that is centered horizontally and covers the bottom-middle part where the building sits
      const hitWidth = width * 0.45;
      const hitHeight = height * 0.45;
      const hitX = (width - hitWidth) / 2;
      const hitY = height * 0.45;
      img.setInteractive(new Phaser.Geom.Rectangle(hitX, hitY, hitWidth, hitHeight), Phaser.Geom.Rectangle.Contains);
    } else {
      img.setInteractive({ draggable: true });
    }
    img.setData("id", id);
    img.setData("type", type);

    if (isAnimated) {
      const sprite = img as Phaser.GameObjects.Sprite;
      sprite.play(`${type}_anim`);
      sprite.anims.timeScale = animSpeed;
    }

    this.input.setDraggable(img);

    const stateObjForBlocked = this.room?.state.placedObjects.get(id);
    const isBlocked = stateObjForBlocked ? (stateObjForBlocked.blocked ?? false) : false;
    if (isBlocked) {
      img.setTint(0xff8888); // Kırmızımsı tint — geçilmez göstergesi
    }

    const obj: PlacedObject = {
      id,
      type,
      x,
      y,
      scale,
      angle: stateObjForBlocked ? stateObjForBlocked.angle : 0,
      blocked: isBlocked,
      imageObj: img,
    };

    this.placedObjects.push(obj);
    return obj;
  }

  private destroyLocalObject(id: string): void {
    const idx = this.placedObjects.findIndex(o => o.id === id);
    if (idx !== -1) {
      const obj = this.placedObjects[idx];
      if (obj.imageObj) {
        obj.imageObj.destroy();
      }
      this.placedObjects.splice(idx, 1);
      if (this.selectedObjectId === id) {
        this.deselectObject();
      }
    }
  }

  // ─── Colyseus State Bindings ───────────────────────────────────────────────

  private bindStateSync(): void {
    const { players, mapData, placedObjects } = this.room.state;

    // 1. Players Sync
    players.onAdd((player: Player, sessionId: string) => {
      this.spawnPlayer(player, sessionId);

      // Seed local prediction coords when first spawned
      if (sessionId === this.localId) {
        this.localX = player.x;
        this.localY = player.y;
      }

      (player as any).onChange(() => {
        const entity = this.entities.get(sessionId);

        if (entity) {
          if (sessionId === this.localId) {
            // Client-side prediction: only hard-correct if server drifted > 50px (lag spike / cheat)
            const drift = Math.hypot(this.localX - player.x, this.localY - player.y);
            if (drift > 50) {
              this.localX = player.x;
              this.localY = player.y;
              entity.container.setPosition(player.x, player.y);
            }
          } else {
            // For other players, always trust server
            entity.container.setPosition(player.x, player.y);
          }

          if (entity.isLayered) {
            this.updatePlayerLayers(entity, player, sessionId);
          } else {
            const animKey = `${player.skin}_${player.state}_${player.direction}`;
            if (entity.sprite.anims.currentAnim?.key !== animKey) {
              entity.sprite.play(animKey, true);
            }
          }
        }

        // Update player visibility
        this.updatePlayerVisibilities();

        // If local player changed map, reload map
        if (sessionId === this.localId) {
          const serverMap = player.currentMap || "main";
          if (serverMap !== this.currentMapId) {
            this.currentMapId = serverMap;
            // Update boundaries
            if (this.currentMapId === "sub_island" || this.currentMapId === "boss_island" || this.currentMapId === "right_island") {
              this.mapWidth = 25 * TILE_SIZE;
              this.mapHeight = 20 * TILE_SIZE;
            } else if (this.currentMapId === "bottom_island") {
              this.mapWidth = 38 * TILE_SIZE;
              this.mapHeight = 30 * TILE_SIZE;
            } else {
              this.mapWidth = 50 * TILE_SIZE;
              this.mapHeight = 40 * TILE_SIZE;
            }
            this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);

            // Clamp camera zoom to the new map's minimum zoom to prevent showing black boundaries
            const minZoom = Math.max(this.scale.width / this.mapWidth, this.scale.height / this.mapHeight);
            if (this.cameras.main.zoom < minZoom) {
              this.cameras.main.setZoom(minZoom);
            }

            // Sync local prediction coords on map change
            this.localX = player.x;
            this.localY = player.y;

            this.redrawMap();
          }
        }
      });
    });

    players.onRemove((_player: Player, sessionId: string) => {
      const entity = this.entities.get(sessionId);
      if (entity) {
        entity.container.destroy();
        this.entities.delete(sessionId);
      }
    });

    // 2. Map Tiles Sync
    mapData.onAdd((arg1: any, arg2: any) => {
      try {
        const parsed = this.parseTileSchemaKey(arg1, arg2);
        if (parsed && parsed.mapId === this.currentMapId) {
          const tileIndex = typeof arg1 === "number" ? arg1 : (typeof arg2 === "number" ? arg2 : null);
          if (tileIndex === null || tileIndex === undefined) return;
          console.log(`[Sync Map] onAdd tile:${tileIndex} at x:${parsed.tx}, y:${parsed.ty}`);
          this.putTileWithEncoding(tileIndex, parsed.tx, parsed.ty, this.layer);
        }
      } catch (e) {
        console.error("Error in mapData.onAdd:", e, arg1, arg2);
      }
    });

    mapData.onChange((arg1: any, arg2: any) => {
      try {
        const parsed = this.parseTileSchemaKey(arg1, arg2);
        if (parsed && parsed.mapId === this.currentMapId) {
          const tileIndex = typeof arg1 === "number" ? arg1 : (typeof arg2 === "number" ? arg2 : null);
          if (tileIndex === null || tileIndex === undefined) return;
          console.log(`[Sync Map] onChange tile:${tileIndex} at x:${parsed.tx}, y:${parsed.ty}`);
          this.putTileWithEncoding(tileIndex, parsed.tx, parsed.ty, this.layer);
        }
      } catch (e) {
        console.error("Error in mapData.onChange:", e, arg1, arg2);
      }
    });

    mapData.onRemove((arg1: any, arg2: any) => {
      try {
        const parsed = this.parseTileSchemaKey(arg1, arg2);
        if (parsed && parsed.mapId === this.currentMapId) {
          console.log(`[Sync Map] onRemove at x:${parsed.tx}, y:${parsed.ty}`);
          this.map.removeTileAt(parsed.tx, parsed.ty, false, true, this.layer);
        }
      } catch (e) {
        console.error("Error in mapData.onRemove:", e, arg1, arg2);
      }
    });

    // 2b. Decor/Fence Tiles Sync
    const decorData = (this.room.state as any).decorData;
    if (decorData) {
      decorData.onAdd((arg1: any, arg2: any) => {
        try {
          const parsed = this.parseTileSchemaKey(arg1, arg2);
          if (parsed && parsed.mapId === this.currentMapId) {
            const tileIndex = typeof arg1 === "number" ? arg1 : (typeof arg2 === "number" ? arg2 : null);
            if (tileIndex === null || tileIndex === undefined) return;
            console.log(`[Sync Decor] onAdd tile:${tileIndex} at x:${parsed.tx}, y:${parsed.ty}`);
            this.putTileWithEncoding(tileIndex, parsed.tx, parsed.ty, this.decorLayer);
          }
        } catch (e) {
          console.error("Error in decorData.onAdd:", e, arg1, arg2);
        }
      });

      decorData.onChange((arg1: any, arg2: any) => {
        try {
          const parsed = this.parseTileSchemaKey(arg1, arg2);
          if (parsed && parsed.mapId === this.currentMapId) {
            const tileIndex = typeof arg1 === "number" ? arg1 : (typeof arg2 === "number" ? arg2 : null);
            if (tileIndex === null || tileIndex === undefined) return;
            console.log(`[Sync Decor] onChange tile:${tileIndex} at x:${parsed.tx}, y:${parsed.ty}`);
            this.putTileWithEncoding(tileIndex, parsed.tx, parsed.ty, this.decorLayer);
          }
        } catch (e) {
          console.error("Error in decorData.onChange:", e, arg1, arg2);
        }
      });

      decorData.onRemove((arg1: any, arg2: any) => {
        try {
          const parsed = this.parseTileSchemaKey(arg1, arg2);
          if (parsed && parsed.mapId === this.currentMapId) {
            console.log(`[Sync Decor] onRemove at x:${parsed.tx}, y:${parsed.ty}`);
            this.map.removeTileAt(parsed.tx, parsed.ty, false, true, this.decorLayer);
          }
        } catch (e) {
          console.error("Error in decorData.onRemove:", e, arg1, arg2);
        }
      });
    }

    // Custom Assets Sync
    const customAssets = (this.room.state as any).customAssets;
    if (customAssets) {
      customAssets.onAdd((assetState: any, key: string) => {
        if (!this.textures.exists(key)) {
          console.log(`[Phaser] Dynamically preloading custom asset: ${key} from path: ${assetState.path}`);
          this.load.spritesheet(key, assetState.path, { frameWidth: assetState.fw, frameHeight: assetState.fh });
          this.load.once(`filecomplete-spritesheet-${key}`, () => {
            console.log(`[Phaser] Dynamically loaded custom asset: ${key}`);
            // Force re-rendering of any placed objects that use this texture
            this.placedObjects.forEach(obj => {
              if (obj.type.startsWith(key + ":")) {
                this.spawnLocalObject(obj.type, obj.x, obj.y, obj.scale, obj.id);
              }
            });
          });
          this.load.start();
        }
      });
    }

    // 3. Placed Buildings Sync
    placedObjects.onAdd((objState: PlacedObjectState, id: string) => {
      const objMapId = objState.mapId || "main";
      if (objMapId === this.currentMapId) {
        this.spawnLocalObject(objState.type, objState.x, objState.y, objState.scale, id, objState.animSpeed);
      }
    });

    placedObjects.onChange((objState: PlacedObjectState, id: string) => {
      const objMapId = objState.mapId || "main";
      if (objMapId === this.currentMapId) {
        const obj = this.placedObjects.find(o => o.id === id);
        if (obj) {
          obj.x = objState.x;
          obj.y = objState.y;
          obj.scale = objState.scale;
          obj.angle = objState.angle;
          if (obj.imageObj) {
            obj.imageObj.x = objState.x;
            obj.imageObj.y = objState.y;
            obj.imageObj.setScale(objState.scale);
            obj.imageObj.setAngle(objState.angle || 0);
            obj.imageObj.setFlipX(objState.flipX || false);
            obj.imageObj.setDepth(objState.type === "farm_tile" || objState.type === "farm_tile_hoed" || objState.type === "farm_tile_watered" ? 1.5 : objState.y);
            if (objState.type.startsWith("vfx_") || objState.type.startsWith("mg_")) {
              (obj.imageObj as Phaser.GameObjects.Sprite).anims.timeScale = objState.animSpeed !== undefined ? objState.animSpeed : 1.0;
            }
          }
        } else {
          this.spawnLocalObject(objState.type, objState.x, objState.y, objState.scale, id, objState.animSpeed);
        }
      } else {
        this.destroyLocalObject(id);
      }
      this.drawSelectionOutline();
    });

    placedObjects.onRemove((_objState: PlacedObjectState, id: string) => {
      this.destroyLocalObject(id);
    });
  }

  // ─── Import / Export utilities ─────────────────────────────────────────────

  public getExportJSON(): string {
    const mapDataPayload: { [key: string]: number } = {};
    const decorDataPayload: { [key: string]: number } = {};
    const maxCols = this.mapWidth / TILE_SIZE;
    const maxRows = this.mapHeight / TILE_SIZE;
    for (let x = 0; x < maxCols; x++) {
      for (let y = 0; y < maxRows; y++) {
        const t = this.map.getTileAt(x, y, true, this.layer);
        if (t && t.index !== -1) {
          mapDataPayload[`${x},${y}`] = t.index;
        }
        const d = this.map.getTileAt(x, y, true, this.decorLayer);
        if (d && d.index !== -1) {
          decorDataPayload[`${x},${y}`] = d.index;
        }
      }
    }
    const placedObjectsPayload = this.placedObjects.map(o => {
      const stateObj = this.room.state.placedObjects.get(o.id);
      return {
        id: o.id,
        type: o.type,
        x: o.x,
        y: o.y,
        scale: o.scale,
        animSpeed: stateObj ? stateObj.animSpeed : 1.0,
      };
    });
    return JSON.stringify({ mapData: mapDataPayload, decorData: decorDataPayload, placedObjects: placedObjectsPayload }, null, 2);
  }

  public importJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      this.room.send("tile-update-bulk", {
        mapData: parsed.mapData || {},
        decorData: parsed.decorData || {},
        placedObjects: parsed.placedObjects || [],
      });
      return true;
    } catch (e) {
      console.error("Failed to import JSON map data", e);
      return false;
    }
  }

  private checkLegacyLocalMap(): void {
    // Legacy check is handled inside React App.tsx on load
  }

  // ─── Entity management ───────────────────────────────────────────────────

  private spawnPlayer(player: Player, sessionId: string): void {
    const isLocal = sessionId === this.localId;

    // Clean up existing container if any to prevent duplicates/ghost weapons
    if (this.entities.has(sessionId)) {
      const existing = this.entities.get(sessionId);
      if (existing && existing.container) {
        existing.container.destroy();
      }
      this.entities.delete(sessionId);
    }

    const container = this.add.container(player.x, player.y);
    container.setScale(2.4);

    // ── Shadow ───────────────────────────────────────────────────────────────
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillEllipse(0, 14, 18, 7);

    // ── Name tag ──────────────────────────────────────────────────────────────
    const label = isLocal ? "▶ YOU" : (player.username || sessionId.slice(0, 5));
    const tag = this.add
      .text(0, -28, label, {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "7px",
        color: player.color,
        stroke: "#000000",
        strokeThickness: 3.5,
        resolution: 2,
      })
      .setOrigin(0.5, 1);

    let sprite: Phaser.GameObjects.Sprite;
    let isLayered = false;
    let layersObj: any = undefined;

    if (player.skin === "pack_char") {
      isLayered = true;
      // Stacking order: shadow -> skin -> eyes -> beard -> clothes -> hair -> acc -> tag
      const skinTone = player.skinTone || "1";
      const mountSpr = this.add.sprite(0, 10, "").setVisible(false);
      const skinSpr = this.add.sprite(0, 10, `pack_skin_${skinTone}_idle`);
      const eyesSpr = this.add.sprite(0, 10, `pack_eyes_${(player.gender || "male") === "male" ? "Male" : "Female"}_${player.eyeColor || "Black"}_idle`);
      const beardSpr = this.add.sprite(0, 10, `pack_beard_${player.beardColor || "Black"}_idle`).setVisible(false);
      const clothesSpr = this.add.sprite(0, 10, `pack_clothes_${player.clothesColor || "Blue"}_idle`).setVisible(false);
      const hairSpr = this.add.sprite(0, 10, `pack_hair_${player.hairStyle || "Standard"}_${player.hairColor || "Black"}_idle`).setVisible(false);
      const accSpr = this.add.sprite(0, 10, `pack_acc_${player.accItem || "Beret"}_idle`).setVisible(false);
      const toolSpr = this.add.sprite(0, 0, "").setVisible(false);
      toolSpr.setScale(0.65);

      sprite = skinSpr;

      container.add([shadow, mountSpr, skinSpr, eyesSpr, beardSpr, clothesSpr, hairSpr, accSpr, toolSpr, tag]);

      layersObj = {
        mount: mountSpr,
        skin: skinSpr,
        eyes: eyesSpr,
        beard: beardSpr,
        clothes: clothesSpr,
        hair: hairSpr,
        acc: accSpr,
        tool: toolSpr,
      };
    } else {
      sprite = this.add.sprite(0, -6, player.skin);
      sprite.play(`${player.skin}_idle_${player.direction}`);
      container.add([shadow, sprite, tag]);
    }

    const entity: PlayerEntity = { container, sprite, isLayered, layers: layersObj };
    this.entities.set(sessionId, entity);

    if (isLayered) {
      this.updatePlayerLayers(entity, player, sessionId);
    }

    if (!isLocal) {
      container.setSize(32, 48);
      container.setInteractive();
      container.setData("type", "player");
      container.setData("sessionId", sessionId);
    }

    if (isLocal) {
      this.cameras.main.startFollow(container, true, 1, 1);
    }
    this.updatePlayerVisibilities();
  }

  private updatePlayerLayers(entity: PlayerEntity, player: any, sessionId: string): void {
    if (!entity.isLayered || !entity.layers) return;

    const layers = entity.layers;
    const state = player.state || "idle";
    const isMoving = state === "walk";
    const isLocal = sessionId === this.localId;
    let dir = player.direction || "down";
    if (isLocal && this.isFishingTimelineActive && this.localFishingDir) {
      dir = this.localFishingDir;
    }

    const isRiding = player.isRiding && player.mountType && player.mountType !== "none";
    const mountType = isRiding ? player.mountType : "none";
    const isHorse = isRiding && mountType.indexOf("horse") !== -1;
    const isBicycle = isRiding && mountType.indexOf("bicycle") !== -1;
    const isBroomstick = isRiding && mountType.indexOf("broomstick") !== -1;

    let keyPrefix = "pack";
    let animType = isMoving ? "walk" : "idle";

    const extraActions = [
      "fishing_cast", "fishing_wait", "fishing_bite", "fishing_reel", "fishing_catch",
      "carry_idle", "carry_walk", "carry_run", "carry_pickup", "throwing_items",
      "sit", "sleep", "petting", "climbing", "flute",
      "umbrella_idle", "umbrella_walk", "umbrella_run",
      "swim_idle", "swim_outwater", "swim_submerged", "swim_swim"
    ];
    const isAction = state === "sword_attack" || state === "bow_attack" || state === "mage" ||
                     state === "pickaxe_attack" || state === "hoe_attack" || state === "axe_attack" ||
                     state === "scythe_attack" || state === "shovel_attack" || state === "watering" ||
                     state === "damage" || state === "death" ||
                     extraActions.includes(state);

    if (isAction) {
      animType = state;
    } else if (isHorse) {
      keyPrefix = "pack_ride_horse";
      animType = isMoving ? "run" : "idle";
    } else if (isBicycle) {
      keyPrefix = "pack_ride_bicycle";
      animType = isMoving ? "run" : "idle";
    } else if (isBroomstick) {
      keyPrefix = "pack";
      animType = "broomstick";
    }

    // Helper function to play layer animations with fallbacks
    const playLayerAnim = (sprite: Phaser.GameObjects.Sprite, keyBase: string, type: string, fallbackBase?: string) => {
      const key = `${keyBase}_${type}`;
      const dirAnim = `${key}_${dir}`;
      const singleAnim = `${key}_anim`;
      
      if (this.anims.exists(dirAnim)) {
        sprite.setVisible(true);
        if (sprite.texture.key !== key) sprite.setTexture(key);
        if (sprite.anims.currentAnim?.key !== dirAnim) sprite.play(dirAnim, true);
      } else if (this.anims.exists(singleAnim)) {
        sprite.setVisible(true);
        if (sprite.texture.key !== key) sprite.setTexture(key);
        if (sprite.anims.currentAnim?.key !== singleAnim) sprite.play(singleAnim, true);
      } else if (fallbackBase) {
        const fbKey = `${fallbackBase}_idle`;
        const fbAnim = `${fbKey}_${dir}`;
        sprite.setVisible(true);
        if (sprite.texture.key !== fbKey) sprite.setTexture(fbKey);
        if (sprite.anims.currentAnim?.key !== fbAnim) sprite.play(fbAnim, true);
      } else {
        sprite.setVisible(false);
      }
    };

    // 0. Mount Layer
    if (layers.mount) {
      if (isRiding) {
        layers.mount.setVisible(true);
        let mountKey = "";
        let mountAnim = "";
        if (isHorse) {
          const horseNum = mountType.split("_")[1] || "1";
          mountKey = `pack_ride_horse_mount_${horseNum}_${animType}`;
          mountAnim = `${mountKey}_${dir}`;
        } else if (isBicycle) {
          const bikeColor = mountType.split("_")[1] || "blue";
          mountKey = `pack_ride_bicycle_mount_${bikeColor}_${animType}`;
          mountAnim = `${mountKey}_${dir}`;
        } else if (isBroomstick) {
          const broomstickNum = mountType.split("_")[1] || "1";
          mountKey = `pack_ride_broomstick_mount_${broomstickNum}_broomstick`;
          mountAnim = `${mountKey}_${dir}`;
          layers.mount.setY(10);
        }

        if (mountKey && this.textures.exists(mountKey)) {
          if (layers.mount.texture.key !== mountKey) {
            layers.mount.setTexture(mountKey);
          }
          if (layers.mount.anims.currentAnim?.key !== mountAnim) {
            layers.mount.play(mountAnim, true);
          }
        }
      } else {
        layers.mount.setVisible(false);
      }
    }

    // 1. Skin Layer
    const skinTone = player.skinTone || "1";
    playLayerAnim(layers.skin, `${keyPrefix}_skin_${skinTone}`, animType);

    // 2. Eyes Layer
    if (layers.eyes) {
      const g = (player.gender || "male") === "male" ? "Male" : "Female";
      const ec = player.eyeColor || "Black";
      playLayerAnim(layers.eyes, `${keyPrefix}_eyes_${g}_${ec}`, animType, `${keyPrefix}_eyes_${g}_${ec}`);
    }

    // 3. Hair Layer
    if (layers.hair) {
      const hStyle = player.hairStyle || "Standard";
      const hColor = player.hairColor || "Black";
      playLayerAnim(layers.hair, `${keyPrefix}_hair_${hStyle}_${hColor}`, animType, `${keyPrefix}_hair_${hStyle}_${hColor}`);
    }

    // 4. Clothes Layer
    if (layers.clothes) {
      let cColor = player.clothesColor || "Blue";
      let hasArmor = false;
      let armorTier = "";
      
      if (player.equippedChestplate && player.equippedChestplate !== "none" && player.equippedChestplate.indexOf("none") === -1) {
        armorTier = player.equippedChestplate.split(":")[0];
        hasArmor = true;
      } else if (player.equippedLeggings && player.equippedLeggings !== "none" && player.equippedLeggings.indexOf("none") === -1) {
        armorTier = player.equippedLeggings.split(":")[0];
        hasArmor = true;
      }

      const getTierTint = (tier: string): number => {
        if (tier.includes("Wood")) return 0x8B5A2B;      // Wood brown
        if (tier.includes("Cooper")) return 0xCD7F32;    // Copper orange-brown
        if (tier.includes("Iron")) return 0x909497;      // Iron steel gray
        if (tier.includes("Gold")) return 0xFFD700;      // Gold yellow
        if (tier.includes("Platinum")) return 0xE5E4E2;  // Platinum light gray
        if (tier.includes("Crimson")) return 0xDC143C;   // Crimson red
        if (tier.includes("Frost")) return 0x87CEEB;     // Frost sky blue
        if (tier.includes("Shadow")) return 0x4B0082;    // Shadow dark indigo/purple
        if (tier.includes("Fairy")) return 0xFF69B4;     // Fairy hot pink
        if (tier.includes("Obsidian")) return 0x1C1C1C;  // Obsidian dark charcoal/black
        return 0xFFFFFF;
      };

      if (hasArmor) {
        cColor = "White";
        playLayerAnim(layers.clothes, `${keyPrefix}_clothes_${cColor}`, animType, `${keyPrefix}_clothes_${cColor}`);
        layers.clothes.setTint(getTierTint(armorTier));
      } else {
        playLayerAnim(layers.clothes, `${keyPrefix}_clothes_${cColor}`, animType, `${keyPrefix}_clothes_${cColor}`);
        layers.clothes.clearTint();
      }
    }

    // 5. Beard Layer
    if (layers.beard) {
      const bColor = player.beardColor || "";
      if (bColor) {
        playLayerAnim(layers.beard, `${keyPrefix}_beard_${bColor}`, animType, `${keyPrefix}_beard_${bColor}`);
      } else {
        layers.beard.setVisible(false);
      }
    }

    // 6. Accessories Layer
    if (layers.acc) {
      let accItem = player.accItem || "";
      let hasHelmet = false;
      let helmetTier = "";
      
      if (player.equippedHelmet && player.equippedHelmet !== "none" && player.equippedHelmet.indexOf("none") === -1) {
        helmetTier = player.equippedHelmet.split(":")[0];
        hasHelmet = true;
      }

      const getTierTint = (tier: string): number => {
        if (tier.includes("Wood")) return 0x8B5A2B;      // Wood brown
        if (tier.includes("Cooper")) return 0xCD7F32;    // Copper orange-brown
        if (tier.includes("Iron")) return 0x909497;      // Iron steel gray
        if (tier.includes("Gold")) return 0xFFD700;      // Gold yellow
        if (tier.includes("Platinum")) return 0xE5E4E2;  // Platinum light gray
        if (tier.includes("Crimson")) return 0xDC143C;   // Crimson red
        if (tier.includes("Frost")) return 0x87CEEB;     // Frost sky blue
        if (tier.includes("Shadow")) return 0x4B0082;    // Shadow dark indigo/purple
        if (tier.includes("Fairy")) return 0xFF69B4;     // Fairy hot pink
        if (tier.includes("Obsidian")) return 0x1C1C1C;  // Obsidian dark charcoal/black
        return 0xFFFFFF;
      };

      if (hasHelmet) {
        // Use wizard hat for magical tiers, beret for physical armor tiers
        if (helmetTier.includes("Frost") || helmetTier.includes("Shadow") || helmetTier.includes("Obsidian")) {
          accItem = "Wizard";
        } else {
          accItem = "Beret";
        }
        
        playLayerAnim(layers.acc, `${keyPrefix}_acc_${accItem}`, animType, `${keyPrefix}_acc_${accItem}`);
        layers.acc.setTint(getTierTint(helmetTier));
      } else {
        if (accItem) {
          playLayerAnim(layers.acc, `${keyPrefix}_acc_${accItem}`, animType, `${keyPrefix}_acc_${accItem}`);
          layers.acc.clearTint();
        } else {
          layers.acc.setVisible(false);
        }
      }
    }

    // 7. Tool/Weapon Layer (layers.tool)
    const toolSpr = layers.tool;
    if (toolSpr) {
      const eqWeapon = player.equippedWeapon || "";
      if (eqWeapon && !isRiding) {
        const parts = eqWeapon.split(":");
        const tierName = parts[0] || "";
        const toolName = parts[1] || "";
        
        const getTierNum = (tName: string): number => {
          const num = parseInt(tName.split(".")[0]);
          return isNaN(num) ? 1 : num;
        };
        const tierNum = getTierNum(tierName);

        // Custom weapon mappings for action states
        const activeActionMap: Record<string, string> = {
          "sword_attack": "Sword",
          "bow_attack": "Bow",
          "mage": "Staff",
          "pickaxe_attack": "Pickaxe",
          "hoe_attack": "Hoe",
          "axe_attack": "Axe",
          "scythe_attack": "Sickle",
          "shovel_attack": "Shovel",
          "watering": "Watering",
          "fishing_cast": "Fishing_Rod",
          "fishing_wait": "Fishing_Rod",
          "fishing_bite": "Fishing_Rod",
          "fishing_reel": "Fishing_Rod",
          "fishing_catch": "Fishing_Rod"
        };

        if (isAction && activeActionMap[state] && toolName === activeActionMap[state]) {
          // Animated Weapon Spritesheet
          toolSpr.setVisible(true);
          toolSpr.setScale(1.0);
          if (state.startsWith("fishing_")) {
            toolSpr.setPosition(0, 0); // 64x64 frame centering
          } else {
            toolSpr.setPosition(0, 10); // 32x32 frame offset
          }
          toolSpr.setAngle(0);
          toolSpr.setFlipX(false);
          
          const weaponPrefix = `pack_weapon_${activeActionMap[state]}_${tierNum}`;
          playLayerAnim(toolSpr, weaponPrefix, animType);
        } else {
          // If player has a mismatching weapon equipped, or is in idle/movement (keep weapon sheathed)
          toolSpr.setVisible(false);
        }
      } else {
        toolSpr.setVisible(false);
      }
    }

    // Reset local player attack state when skin animation finishes playing (excluding fishing states which are managed by timeline)
    const isFishingState = state.startsWith("fishing_");
    if (isLocal && isAction && !isFishingState) {
      layers.skin.once("animationcomplete", () => {
        const lp = this.room.state.players.get(this.localId);
        if (lp && lp.state === state) {
          this.room.send("action", { type: "idle" });
        }
      });
    }
  }

  private updatePlayerVisibilities(): void {
    this.entities.forEach((entity, sessionId) => {
      const statePlayer = this.room.state.players.get(sessionId);
      if (statePlayer) {
        const playerMap = statePlayer.currentMap || "main";
        if (playerMap === this.currentMapId) {
          entity.container.setVisible(true);
        } else {
          entity.container.setVisible(false);
        }
      }
    });
  }

  private parseTileSchemaKey(arg1: any, arg2: any): { key: string; mapId: string; tx: number; ty: number } | null {
    let key = "";
    if (typeof arg1 === "string" && (arg1.includes(",") || arg1.includes(":"))) {
      key = arg1;
    } else if (typeof arg2 === "string" && (arg2.includes(",") || arg2.includes(":"))) {
      key = arg2;
    }
    if (!key) return null;

    let mapId = "main";
    let coords = key;
    if (key.includes(":")) {
      const parts = key.split(":");
      mapId = parts[0];
      coords = parts[1];
    }
    if (!coords || !coords.includes(",")) return null;

    const [xStr, yStr] = coords.split(",");
    const tx = parseInt(xStr, 10);
    const ty = parseInt(yStr, 10);
    if (isNaN(tx) || isNaN(ty)) return null;

    return { key, mapId, tx, ty };
  }

  private putTileWithEncoding(tileIndex: number, tx: number, ty: number, layer: Phaser.Tilemaps.TilemapLayer): void {
    if (tileIndex === -1) {
      this.map.removeTileAt(tx, ty, false, true, layer);
      return;
    }
    const cleanIndex = tileIndex & 0xFFFF;
    const rotVal = (tileIndex >> 16) & 3;
    const flipX = ((tileIndex >> 18) & 1) === 1;
    const flipY = ((tileIndex >> 19) & 1) === 1;

    const tile = this.map.putTileAt(cleanIndex, tx, ty, true, layer);
    if (tile) {
      tile.rotation = rotVal * (Math.PI / 2);
      tile.flipX = flipX;
      tile.flipY = flipY;
    }
  }

  private redrawMap(): void {
    // Clear tilemap (terrain & decor)
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        this.map.removeTileAt(x, y, true, true, this.layer);
        this.map.removeTileAt(x, y, true, true, this.decorLayer);
      }
    }

    // Destroy local object representation
    this.placedObjects.forEach(obj => {
      if (obj.imageObj) obj.imageObj.destroy();
    });
    this.placedObjects = [];

    // Destroy crop sprites
    this.cropSprites.forEach(sprite => {
      sprite.destroy();
    });
    this.cropSprites.clear();

    // Redraw grid
    this.drawGridOverlay();

    // Re-fill tiles from schema mapData
    this.room.state.mapData.forEach((tileIndex: number, key: string) => {
      let mapId = "main";
      let coords = key;
      if (key.includes(":")) {
        const parts = key.split(":");
        mapId = parts[0];
        coords = parts[1];
      }
      if (mapId === this.currentMapId) {
        const [xStr, yStr] = coords.split(",");
        const tx = parseInt(xStr, 10);
        const ty = parseInt(yStr, 10);
        this.putTileWithEncoding(tileIndex, tx, ty, this.layer);
      }
    });

    // Re-fill decor tiles from schema decorData
    const decorData = (this.room.state as any).decorData;
    if (decorData) {
      decorData.forEach((tileIndex: number, key: string) => {
        let mapId = "main";
        let coords = key;
        if (key.includes(":")) {
          const parts = key.split(":");
          mapId = parts[0];
          coords = parts[1];
        }
        if (mapId === this.currentMapId) {
          const [xStr, yStr] = coords.split(",");
          const tx = parseInt(xStr, 10);
          const ty = parseInt(yStr, 10);
          this.putTileWithEncoding(tileIndex, tx, ty, this.decorLayer);
        }
      });
    }

    // Re-spawn placed objects
    this.room.state.placedObjects.forEach((val: any, id: string) => {
      const objMapId = val.mapId || "main";
      if (objMapId === this.currentMapId) {
        this.spawnLocalObject(val.type, val.x, val.y, val.scale, id, val.animSpeed);
      }
    });

    // Re-spawn crops
    this.room.state.crops.forEach((val: any, key: string) => {
      const cropMapId = val.mapId || "main";
      if (cropMapId === this.currentMapId) {
        this.renderCropSprite(key, val.cropType, val.stage);
      }
    });

    this.updatePlayerVisibilities();
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    // ── 0. NPC AI Update ──
    for (const npc of this.npcs) {
      npc.update(time);
    }

    // ── 1. depth Y-Sorting ──
    this.layer.setDepth(0); // Ground is always at the bottom
    this.decorLayer.setDepth(1); // Fences/decors on top of ground, under players
    
    // Sort players depth
    this.entities.forEach((entity) => {
      entity.container.setDepth(entity.container.y);
    });

    if (this.editorMode) {
      this.drawSelectionOutline();
      return;
    }

    // Spacebar Key listener (Attack/Action)
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      const isTyping = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
      if (!isTyping) {
        const localPlayerState = this.room.state.players.get(this.localId);
        if (localPlayerState) {
          const eqWeapon = localPlayerState.equippedWeapon || "";
          const parts = eqWeapon.split(":");
          const toolName = parts[1] || "";
          
          let attackState = "";
          if (toolName === "Sword") attackState = "sword_attack";
          else if (toolName === "Bow") attackState = "bow_attack";
          else if (toolName === "Staff") attackState = "mage";
          else if (toolName === "Axe") attackState = "axe_attack";
          else if (toolName === "Pickaxe") attackState = "pickaxe_attack";
          else if (toolName === "Shovel") attackState = "shovel_attack";
          else if (toolName === "Sickle") attackState = "scythe_attack";
          else if (toolName === "Hoe") attackState = "hoe_attack";
          else if (toolName === "Watering_can") attackState = "watering";

          
          const currentAction = localPlayerState.state;
          const isAlreadyAttacking = currentAction === "sword_attack" || currentAction === "bow_attack" || currentAction === "mage" ||
                                     currentAction === "pickaxe_attack" || currentAction === "hoe_attack" || currentAction === "axe_attack" ||
                                     currentAction === "scythe_attack" || currentAction === "shovel_attack" || currentAction === "watering" ||
                                     currentAction === "fishing_cast" || currentAction === "fishing_wait" || currentAction === "fishing_bite" ||
                                     currentAction === "fishing_reel" || currentAction === "fishing_catch";
          
          if (attackState && !isAlreadyAttacking) {
            this.room.send("action", { type: attackState, direction: localPlayerState.direction || "down" });
          }
        }
      }
    }

    // 2. Read movement inputs
    const left  = this.cursors.left.isDown  || this.keyA.isDown  || this.virtualLeft;
    const right = this.cursors.right.isDown || this.keyD.isDown  || this.virtualRight;
    const up    = this.cursors.up.isDown    || this.keyW.isDown  || this.virtualUp;
    const down  = this.cursors.down.isDown  || this.keyS.isDown  || this.virtualDown;

    const localPlayerState = this.room?.state.players.get(this.localId);
    const isFishing = (localPlayerState?.state?.startsWith("fishing_")) || this.isFishingTimelineActive;

    let dx = right ? 1 : left ? -1 : 0;
    let dy = down  ? 1 : up   ? -1 : 0;

    if (isFishing) {
      dx = 0;
      dy = 0;
    }

    const isNowMoving = dx !== 0 || dy !== 0;

    // Client-Side Prediction & Soft Reconciliation:
    const localEntity = this.entities.get(this.localId);
    if (localEntity) {
      if (isNowMoving) {
        // Server moves at 4px per 50ms = 0.08px/ms. Scale by delta for frame-rate independence.
        const spd = 0.08 * delta;
        const newX = Math.max(16, Math.min(this.mapWidth - 16, this.localX + dx * spd));
        const newY = Math.max(16, Math.min(this.mapHeight - 16, this.localY + dy * spd));

        const startX = this.localX;
        const startY = this.localY;

        // Su tile kontrolü: bottom_island'da su tile'larına girişi engelle
        if (this.currentMapId === "bottom_island") {
          const canMoveXY = !this.isWaterTileAt(newX, newY);
          const canMoveX  = !this.isWaterTileAt(newX, this.localY);
          const canMoveY  = !this.isWaterTileAt(this.localX, newY);
          if (canMoveXY) {
            this.localX = newX;
            this.localY = newY;
          } else if (canMoveX) {
            this.localX = newX;
          } else if (canMoveY) {
            this.localY = newY;
          }
        } else {
          this.localX = newX;
          this.localY = newY;
        }

        // Geçilmez (blocked) nesneler için client-side collision — tüm haritalar
        if (this.isBlockedByLocalObject(this.localX, this.localY)) {
          // Kayan collision: X eksenini dene
          if (!this.isBlockedByLocalObject(this.localX, this.localY - dy * spd)) {
            this.localY = this.localY - dy * spd;
          } else if (!this.isBlockedByLocalObject(this.localX - dx * spd, this.localY)) {
            this.localX = this.localX - dx * spd;
          } else {
            // Tamamen blokla — geri dön
            this.localX = this.localX - dx * spd;
            this.localY = this.localY - dy * spd;
          }
        }

        // Custom collision lines crossing check
        if (this.isBlockedByLocalLine(startX, startY, this.localX, this.localY)) {
          if (!this.isBlockedByLocalLine(startX, startY, this.localX, startY)) {
            this.localY = startY;
          } else if (!this.isBlockedByLocalLine(startX, startY, startX, this.localY)) {
            this.localX = startX;
          } else {
            this.localX = startX;
            this.localY = startY;
          }
        }
      }
      
      // Soft reconciliation: gradually nudge predicted coordinates to server coordinates
      const playerState = this.room.state.players.get(this.localId);
      if (playerState) {
        this.localX = Phaser.Math.Linear(this.localX, playerState.x, 0.15);
        this.localY = Phaser.Math.Linear(this.localY, playerState.y, 0.15);
      }
      
      localEntity.container.setPosition(this.localX, this.localY);
    }

    // Send movement to server (throttled to 20/fps) for authoritative position
    if (isNowMoving) {
      if (time - this.lastSentMs >= SEND_INTERVAL_MS) {
        this.room.send("move", { dx, dy });
        this.lastSentMs = time;
        this.isMoving = true;
      }
    } else {
      if (this.isMoving) {
        this.room.send("move", { dx: 0, dy: 0 });
        this.isMoving = false;
      }
    }

    // Teleport Check (Throttled to run once every 150ms to optimize performance!)
    const localPlayer = this.entities.get(this.localId);
    if (localPlayer && time - this.lastTeleportTime > 2000) {
      if (time - this.lastTeleportCheckTime > 150) {
        this.lastTeleportCheckTime = time;
        const px = localPlayer.container.x;
        const py = localPlayer.container.y;

        for (const obj of this.placedObjects) {
          if (obj.type.startsWith("yon_")) {
            const dist = Phaser.Math.Distance.Between(px, py, obj.x, obj.y);
            if (dist < 45) {
              if (obj.type === "yon_up" && this.currentMapId === "main") {
                console.log(`[Teleport] Up arrow triggered. Teleporting to sub_island...`);
                this.lastTeleportTime = time;
                this.room.send("player-teleport", { mapId: "sub_island", x: 400, y: 580 });
                break;
              } else if (obj.type === "yon_down" && this.currentMapId === "sub_island") {
                console.log(`[Teleport] Down arrow triggered. Teleporting to main...`);
                this.lastTeleportTime = time;
                
                // Find target position on main map (near first yon_up)
                let targetX = 800;
                let targetY = 1200;
                this.room.state.placedObjects.forEach((val: any) => {
                  if (val.type === "yon_up" && (val.mapId || "main") === "main") {
                    targetX = val.x;
                    targetY = val.y + 48; // Offset down so we don't immediately re-teleport
                  }
                });

                this.room.send("player-teleport", { mapId: "main", x: targetX, y: targetY });
                break;
              } else if (obj.type === "yon_left" && this.currentMapId === "main") {
                console.log(`[Teleport] Left arrow triggered. Teleporting to left_island...`);
                this.lastTeleportTime = time;
                this.room.send("player-teleport", { mapId: "left_island", x: 1500, y: obj.y });
                break;
              } else if (obj.type === "yon_right" && this.currentMapId === "left_island") {
                console.log(`[Teleport] Right arrow triggered. Teleporting to main...`);
                this.lastTeleportTime = time;
                
                // Find target position on main map (near first yon_left)
                let targetX = 100;
                let targetY = 600;
                this.room.state.placedObjects.forEach((val: any) => {
                  if (val.type === "yon_left" && (val.mapId || "main") === "main") {
                    targetX = val.x + 48; // Offset to the right so we don't immediately re-teleport
                    targetY = val.y;
                  }
                });

                this.room.send("player-teleport", { mapId: "main", x: targetX, y: targetY });
                break;
              } else if (obj.type === "yon_down" && this.currentMapId === "main") {
                console.log(`[Teleport] Down arrow triggered on main. Teleporting to bottom_island...`);
                this.lastTeleportTime = time;
                this.room.send("player-teleport", { mapId: "bottom_island", x: obj.x, y: 100 });
                break;
              } else if (obj.type === "yon_up" && this.currentMapId === "bottom_island") {
                console.log(`[Teleport] Up arrow triggered on bottom_island. Teleporting to main...`);
                this.lastTeleportTime = time;
                
                // Find target position on main map (near first yon_down on main)
                let targetX = 800;
                let targetY = 1200;
                this.room.state.placedObjects.forEach((val: any) => {
                  if (val.type === "yon_down" && (val.mapId || "main") === "main") {
                    targetX = val.x;
                    targetY = val.y - 48; // Offset up so we don't immediately re-teleport
                  }
                });

                this.room.send("player-teleport", { mapId: "main", x: targetX, y: targetY });
                break;
              } else if (obj.type === "yon_down" && this.currentMapId === "bottom_island") {
                console.log(`[Teleport] Down arrow triggered on bottom_island. Teleporting to boss_island...`);
                this.lastTeleportTime = time;
                this.room.send("player-teleport", { mapId: "boss_island", x: 400, y: 100 }); // spawn near the top of boss_island
                break;
              } else if (obj.type === "yon_up" && this.currentMapId === "boss_island") {
                console.log(`[Teleport] Up arrow triggered on boss_island. Teleporting to bottom_island...`);
                this.lastTeleportTime = time;
                
                // Find target position on bottom_island map (near first yon_down on bottom_island)
                let targetX = 600;
                let targetY = 900;
                this.room.state.placedObjects.forEach((val: any) => {
                  if (val.type === "yon_down" && val.mapId === "bottom_island") {
                    targetX = val.x;
                    targetY = val.y - 48; // Offset up so we don't immediately re-teleport
                  }
                });

                this.room.send("player-teleport", { mapId: "bottom_island", x: targetX, y: targetY });
                break;
              } else if (obj.type === "yon_right" && this.currentMapId === "main") {
                console.log(`[Teleport] Right arrow triggered on main. Teleporting to right_island...`);
                this.lastTeleportTime = time;
                this.room.send("player-teleport", { mapId: "right_island", x: 100, y: obj.y }); // spawn near the left of right_island
                break;
              } else if (obj.type === "yon_left" && this.currentMapId === "right_island") {
                console.log(`[Teleport] Left arrow triggered on right_island. Teleporting to main...`);
                this.lastTeleportTime = time;
                
                // Find target position on main map (near first yon_right on main)
                let targetX = 1500;
                let targetY = 600;
                this.room.state.placedObjects.forEach((val: any) => {
                  if (val.type === "yon_right" && (val.mapId || "main") === "main") {
                    targetX = val.x - 48; // Offset to the left so we don't immediately re-teleport
                    targetY = val.y;
                  }
                });

                this.room.send("player-teleport", { mapId: "main", x: targetX, y: targetY });
                break;
              }
            }
          }
        }
      }
    }
  }

  private createGIFAnimations(): void {
    const anims = [
      { key: "vfx_leaf_single", end: 14 },
      { key: "vfx_leaves_1", end: 23 },
      { key: "vfx_leaves_2", end: 23 },
      { key: "vfx_leaves_3", end: 23 },
      { key: "vfx_leaves_brown", end: 23 },
      { key: "vfx_leaves_yellow", end: 23 },
      { key: "vfx_smoke", end: 5 },
      { key: "mg_stable_gate", end: 11 },
      { key: "mg_stable_gate_lb", end: 11 },
      { key: "mg_well", end: 23 },
      { key: "mg_crate_1", end: 19 },
      { key: "mg_crate_2", end: 19 },
      { key: "mg_wooden_gate", end: 20 },
      { key: "mg_gift_fish_1", end: 3 },
      { key: "mg_gift_fish_2", end: 3 },
      { key: "mg_gift_fish_3", end: 3 },
      { key: "mg_gift_fish_4", end: 3 },
      { key: "mg_gift_fish_5", end: 3 },
      { key: "mg_gift_fish_6", end: 3 },
    ];

    const fishAnims = anims.filter(a => a.key.startsWith("mg_gift_fish_"));
    const otherAnims = anims.filter(a => !a.key.startsWith("mg_gift_fish_"));

    otherAnims.forEach(a => {
      if (!this.anims.exists(`${a.key}_anim`)) {
        this.anims.create({
          key: `${a.key}_anim`,
          frames: this.anims.generateFrameNumbers(a.key, { start: 0, end: a.end }),
          frameRate: 10,
          repeat: -1,
        });
      }
    });

    // Balık Spotları: daha yavaş, doğal yüzme animasyonu (3fps varsayılan)
    // Kullanıcı editörde balık spotunu seçip "Animasyon Hızı" slider'ı ile ayarlayabilir
    fishAnims.forEach(a => {
      if (!this.anims.exists(`${a.key}_anim`)) {
        this.anims.create({
          key: `${a.key}_anim`,
          frames: this.anims.generateFrameNumbers(a.key, { start: 0, end: a.end }),
          frameRate: 3,   // yavaş, doğal görünüm — slider ile 0.1x→5x çarpanla ayarlanabilir
          repeat: -1,
        });
      }
    });
  }

  showFloatingText(text: string, x: number, y: number, color: string = "#ff3333") {
    const textObj = this.add.text(x, y - 20, text, {
      fontFamily: "Outfit, Arial, sans-serif",
      fontSize: "14px",
      color: color,
      stroke: "#000000",
      strokeThickness: 3,
      align: "center"
    });
    textObj.setOrigin(0.5);
    textObj.setDepth(100000);
    
    this.tweens.add({
      targets: textObj,
      y: y - 50,
      alpha: 0,
      duration: 2000,
      onComplete: () => {
        textObj.destroy();
      }
    });
  }
}
