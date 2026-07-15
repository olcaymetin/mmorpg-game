import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { GameState, Player, PlacedObjectState } from "../schema/GameState";

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
}

interface PlacedObject {
  id: string;
  type: string;
  x: number;
  y: number;
  scale: number;
  imageObj?: Phaser.GameObjects.Image;
}

// ─── Scene ───────────────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  // ── Colyseus ───────────────────────────────────────────────────────────────
  private room!: Room<GameState>;
  private localId!: string;

  // ── Entities (one per player) ──────────────────────────────────────────────
  private entities = new Map<string, PlayerEntity>();

  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  // ── Tilemap & Object Editor ────────────────────────────────────────────────
  private map!: Phaser.Tilemaps.Tilemap;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private editorMode = false;
  
  // Brush type: "tile" | "eraser" | "object"
  private currentBrushType = "tile";
  private currentTileIndex = 0;
  private currentObjectName = "marketplace";

  // Placed Objects list
  private placedObjects: PlacedObject[] = [];
  private selectedObjectId: string | null = null;
  private selectionGraphics!: Phaser.GameObjects.Graphics;

  // Drag Panning & Dragging Objects
  private isDraggingCamera = false;
  private isDraggingObject = false;
  private clickedGameObject = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  // ── State variables ────────────────────────────────────────────────────────
  private lastSentMs = 0;
  private isMoving = false;

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

    // Load building images
    this.load.image("marketplace", "assets/marketplace.png");
    this.load.image("bank", "assets/bank.png");
    this.load.image("games", "assets/games.png");
    this.load.image("blacksmith", "assets/blacksmith.png");
    this.load.image("shop", "assets/shop.png");
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
    this.layer = this.map.createBlankLayer("terrain_layer", tileset)!;
    this.layer.setScale(2); // Scale 16x16 tiles to 32x32

    // 4. Initialize Selection Graphics Overlay
    this.selectionGraphics = this.add.graphics();
    this.selectionGraphics.setDepth(99999);

    // 5. Clamp camera to world bounds
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    // 6. Register keys
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    // 7. Bind Colyseus state callbacks
    this.bindStateSync();

    // 8. Editor paint, erase & drag inputs
    this.setupEditorInputs();

    // 9. React editor events
    this.game.events.on("editor-brush-selected", (brush: { type: string; index?: number; name?: string }) => {
      this.currentBrushType = brush.type;
      if (brush.type === "tile" && brush.index !== undefined) {
        this.currentTileIndex = brush.index;
      } else if (brush.type === "object" && brush.name) {
        this.currentObjectName = brush.name;
      }
    });

    this.game.events.on("editor-mode-changed", (enabled: boolean) => {
      this.editorMode = enabled;
      this.selectionGraphics.clear();
      if (!enabled) {
        this.deselectObject();
        this.cameras.main.startFollow(this.entities.get(this.localId)!.container, true, 0.08, 0.08);
      }
    });

    this.game.events.on("editor-object-delete-requested", (id: string) => {
      this.room.send("object-delete", { id });
    });

    this.game.events.on("editor-object-scale-changed", (payload: { id: string; scale: number }) => {
      const obj = this.placedObjects.find(o => o.id === payload.id);
      if (obj) {
        obj.scale = payload.scale;
        this.room.send("object-place", { id: obj.id, type: obj.type, x: obj.x, y: obj.y, scale: obj.scale });
      }
    });

    // 10. Load fallback: if client has legacy map in local storage, allow importing
    this.checkLegacyLocalMap();

    // 11. Mouse wheel zoom (middle mouse wheel) and responsive scale resize
    const getMinZoom = () => {
      return Math.max(this.scale.width / WORLD_W, this.scale.height / WORLD_H);
    };

    const initialMinZoom = getMinZoom();
    if (this.cameras.main.zoom < initialMinZoom) {
      this.cameras.main.setZoom(initialMinZoom);
    }

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
      const minZoom = Math.max(gameSize.width / WORLD_W, gameSize.height / WORLD_H);
      if (this.cameras.main.zoom < minZoom) {
        this.cameras.main.setZoom(minZoom);
      }
    });
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
  }

  // ─── Grid Overlay Drawing ──────────────────────────────────────────────────

  private drawGridOverlay(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0f2405, 1); // Dark background
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Grid lines
    g.lineStyle(1, 0x1d470d, 0.45);
    for (let x = 0; x <= WORLD_W; x += TILE_SIZE) {
      g.moveTo(x, 0);
      g.lineTo(x, WORLD_H);
    }
    for (let y = 0; y <= WORLD_H; y += TILE_SIZE) {
      g.moveTo(0, y);
      g.lineTo(WORLD_W, y);
    }
    g.strokePath();

    // Map boundary border
    g.lineStyle(2, 0x55ff22, 0.7);
    g.strokeRect(1, 1, WORLD_W - 2, WORLD_H - 2);
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

      if (tileX >= 0 && tileX < 50 && tileY >= 0 && tileY < 40) {
        if (this.currentBrushType === "tile") {
          this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: this.currentTileIndex });
        } else if (this.currentBrushType === "eraser" && !this.clickedGameObject) {
          this.room.send("tile-update", { x: tileX, y: tileY, tileIndex: -1 });
        }
      }
    };

    // ─── Click / Drag Input Handlers ───
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) { // Left Click
        if (this.editorMode && !this.clickedGameObject) {
          if (this.currentBrushType === "object") {
            // Place building object on server
            const uniqueId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.room.send("object-place", {
              id: uniqueId,
              type: this.currentObjectName,
              x: pointer.worldX,
              y: pointer.worldY,
              scale: 0.15
            });
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
        const newScrollX = Phaser.Math.Clamp(this.cameraStartX - dx, 0, WORLD_W - this.cameras.main.width);
        const newScrollY = Phaser.Math.Clamp(this.cameraStartY - dy, 0, WORLD_H - this.cameras.main.height);
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
      if (!this.editorMode) return;
      this.clickedGameObject = true;

      if (pointer.button === 0) { // Left click on object
        const id = gameObject.getData("id");
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
      gameObject.x = dragX;
      gameObject.y = dragY;
      
      const id = gameObject.getData("id");
      const obj = this.placedObjects.find(o => o.id === id);
      if (obj) {
        obj.x = dragX;
        obj.y = dragY;
      }
      this.drawSelectionOutline();
    });

    this.input.on("dragend", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
      this.isDraggingObject = false;
      const id = gameObject.getData("id");
      this.room.send("object-move", { id, x: gameObject.x, y: gameObject.y });
    });
  }

  // ─── Selection Management ──────────────────────────────────────────────────

  private selectObject(id: string): void {
    this.selectedObjectId = id;
    const obj = this.placedObjects.find(o => o.id === id);
    if (obj) {
      this.game.events.emit("editor-object-selected", {
        id: obj.id,
        type: obj.type,
        scale: obj.scale,
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

  private spawnLocalObject(type: string, x: number, y: number, scale = 0.15, id: string): PlacedObject {
    // Destroy previous representation if it exists
    this.destroyLocalObject(id);

    const img = this.add.image(x, y, type);
    img.setScale(scale);
    img.setOrigin(0.5, 0.8);
    img.setInteractive({ draggable: true });
    img.setData("id", id);

    this.input.setDraggable(img);

    const obj: PlacedObject = {
      id,
      type,
      x,
      y,
      scale,
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

      (player as any).onChange(() => {
        const entity = this.entities.get(sessionId);
        if (entity) {
          entity.container.setPosition(player.x, player.y);
          
          const animKey = `${player.skin}_${player.state}_${player.direction}`;
          if (entity.sprite.anims.currentAnim?.key !== animKey) {
            entity.sprite.play(animKey, true);
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
    mapData.onAdd((tileIndex: number, key: string) => {
      const [xStr, yStr] = key.split(",");
      const tx = parseInt(xStr, 10);
      const ty = parseInt(yStr, 10);
      this.map.putTileAt(tileIndex, tx, ty, true, this.layer);
    });

    mapData.onChange((tileIndex: number, key: string) => {
      const [xStr, yStr] = key.split(",");
      const tx = parseInt(xStr, 10);
      const ty = parseInt(yStr, 10);
      this.map.putTileAt(tileIndex, tx, ty, true, this.layer);
    });

    mapData.onRemove((_tileIndex: number, key: string) => {
      const [xStr, yStr] = key.split(",");
      const tx = parseInt(xStr, 10);
      const ty = parseInt(yStr, 10);
      this.map.removeTileAt(tx, ty, true, true, this.layer);
    });

    // 3. Placed Buildings Sync
    placedObjects.onAdd((objState: PlacedObjectState, id: string) => {
      this.spawnLocalObject(objState.type, objState.x, objState.y, objState.scale, id);
    });

    placedObjects.onChange((objState: PlacedObjectState, id: string) => {
      const obj = this.placedObjects.find(o => o.id === id);
      if (obj) {
        obj.x = objState.x;
        obj.y = objState.y;
        obj.scale = objState.scale;
        if (obj.imageObj) {
          obj.imageObj.x = objState.x;
          obj.imageObj.y = objState.y;
          obj.imageObj.setScale(objState.scale);
        }
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
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 40; y++) {
        const t = this.map.getTileAt(x, y, true, this.layer);
        if (t && t.index !== -1) {
          mapDataPayload[`${x},${y}`] = t.index;
        }
      }
    }
    const placedObjectsPayload = this.placedObjects.map(o => ({
      id: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      scale: o.scale,
    }));
    return JSON.stringify({ mapData: mapDataPayload, placedObjects: placedObjectsPayload }, null, 2);
  }

  public importJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      this.room.send("tile-update-bulk", {
        mapData: parsed.mapData || {},
        placedObjects: parsed.placedObjects || [],
      });
      return true;
    } catch (e) {
      console.error("Failed to import JSON map data", e);
      return false;
    }
  }

  private checkLegacyLocalMap(): void {
    const rawMap = localStorage.getItem("mmorpg_map_data");
    const rawObjs = localStorage.getItem("mmorpg_placed_objects");
    if (rawMap || rawObjs) {
      console.log("[Migration] Found legacy map data in browser localStorage.");
      // Expose to window so React HUD can offer automatic upload
      (window as any).mmorpg_legacy_map = {
        mapData: rawMap ? JSON.parse(rawMap) : {},
        placedObjects: rawObjs ? JSON.parse(rawObjs) : [],
      };
    }
  }

  // ─── Entity management ───────────────────────────────────────────────────

  private spawnPlayer(player: Player, sessionId: string): void {
    const isLocal = sessionId === this.localId;

    const container = this.add.container(player.x, player.y);

    // ── Shadow ───────────────────────────────────────────────────────────────
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillEllipse(0, 16, 18, 7);

    // ── Character Sprite ─────────────────────────────────────────────────────
    const sprite = this.add.sprite(0, -6, player.skin);
    sprite.play(`${player.skin}_idle_${player.direction}`);

    // ── Name tag ──────────────────────────────────────────────────────────────
    const label = isLocal ? "▶ YOU" : sessionId.slice(0, 5);
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

    container.add([shadow, sprite, tag]);
    this.entities.set(sessionId, { container, sprite });

    if (isLocal) {
      this.cameras.main.startFollow(container, true, 0.08, 0.08);
    }
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

  update(time: number): void {
    // ── 1. depth Y-Sorting ──
    this.layer.setDepth(0); // Ground is always at the bottom
    
    // Sort players depth
    this.entities.forEach(entity => {
      entity.container.setDepth(entity.container.y);
    });

    // Sort placed building objects depth
    this.placedObjects.forEach(obj => {
      if (obj.imageObj) {
        obj.imageObj.setDepth(obj.y);
      }
    });

    if (this.editorMode) {
      this.drawSelectionOutline();
      return;
    }

    // 2. Read movement inputs
    const left  = this.cursors.left.isDown  || this.keyA.isDown;
    const right = this.cursors.right.isDown || this.keyD.isDown;
    const up    = this.cursors.up.isDown    || this.keyW.isDown;
    const down  = this.cursors.down.isDown  || this.keyS.isDown;

    const dx = right ? 1 : left ? -1 : 0;
    const dy = down  ? 1 : up   ? -1 : 0;

    const isNowMoving = dx !== 0 || dy !== 0;

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
  }
}
