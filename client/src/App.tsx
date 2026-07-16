import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { useColyseus } from "./hooks/useColyseus";
import { PhaserGame } from "./game/PhaserGame";

const cropLabels: Record<string, string> = {
  Cabbage: "Lahana",
  Carrot: "Havuç",
  Cauliflower: "Karnabahar",
  Coffee: "Kahve",
  Corn: "Mısır",
  Cotton: "Pamuk",
  Grape: "Üzüm",
  Onion: "Soğan",
  Pepper: "Biber",
  Pineapple: "Ananas",
  Prickly_Pear: "Kaktüs",
  Pumpkin: "Kabak",
  Radish: "Turp",
  Strawberry: "Çilek",
  Tomato: "Domates",
  Turnip: "Şalgam",
  Watermelon: "Karpuz",
  Wheat: "Buğday",
  Zuchini: "Kabak (Z)",
};

const cropCoordinates: Record<string, { col: number; row: number }> = {
  Cabbage:      { col: 0,  row: 0 }, // Green leafy head
  Carrot:       { col: 4,  row: 0 }, // Carrot
  Cauliflower:  { col: 4,  row: 1 }, // Cauliflower
  Coffee:       { col: 0,  row: 2 }, // Coffee bean
  Corn:         { col: 8,  row: 0 }, // Corn cob
  Cotton:       { col: 0,  row: 1 }, // Cotton (using garlic as white cotton bulb)
  Grape:        { col: 10, row: 1 }, // Grape (Purple grapes)
  Onion:        { col: 7,  row: 0 }, // Onion
  Pepper:       { col: 10, row: 0 }, // Red Pepper
  Pineapple:    { col: 6,  row: 2 }, // Pineapple
  Prickly_Pear: { col: 12, row: 0 }, // Cactus Pear (Beetroot-like dark purple/pink fruit)
  Pumpkin:      { col: 4,  row: 2 }, // Pumpkin
  Radish:       { col: 2,  row: 0 }, // Radish
  Strawberry:   { col: 12, row: 1 }, // Strawberry
  Tomato:       { col: 6,  row: 0 }, // Tomato
  Turnip:       { col: 3,  row: 0 }, // Yellowish Turnip
  Watermelon:   { col: 8,  row: 2 }, // Watermelon
  Wheat:        { col: 5,  row: 0 }, // Wheat (Parsnip/Root shape substitute)
  Zuchini:      { col: 5,  row: 2 }, // Zucchini / squash
};

const cropSeedBagIndices: Record<string, number> = {
  Cabbage: 0,
  Carrot: 1,
  Corn: 2,
  Cauliflower: 3,
  Coffee: 4,
  Cotton: 5,
  Grape: 6,
  Onion: 7,
  Pepper: 8,
  Prickly_Pear: 9,
  Pumpkin: 10,
  Radish: 11,
  Strawberry: 12,
  Tomato: 13,
  Turnip: 14,
  Watermelon: 15,
  Wheat: 16,
};

const CROP_PRICES: Record<string, { buySeed: number; sellCrop: number }> = {
  Cabbage:      { buySeed: 5,  sellCrop: 12 },
  Carrot:       { buySeed: 8,  sellCrop: 18 },
  Cauliflower:  { buySeed: 10, sellCrop: 22 },
  Coffee:       { buySeed: 12, sellCrop: 28 },
  Corn:         { buySeed: 15, sellCrop: 35 },
  Cotton:       { buySeed: 18, sellCrop: 42 },
  Grape:        { buySeed: 25, sellCrop: 60 },
  Onion:        { buySeed: 12, sellCrop: 28 },
  Pepper:       { buySeed: 10, sellCrop: 22 },
  Prickly_Pear: { buySeed: 30, sellCrop: 75 },
  Pumpkin:      { buySeed: 20, sellCrop: 50 },
  Radish:       { buySeed: 6,  sellCrop: 14 },
  Strawberry:   { buySeed: 15, sellCrop: 35 },
  Tomato:       { buySeed: 10, sellCrop: 24 },
  Turnip:       { buySeed: 8,  sellCrop: 18 },
  Watermelon:   { buySeed: 22, sellCrop: 55 },
  Wheat:        { buySeed: 4,  sellCrop: 9 },
};

/**
 * App — root React component.
 *
 * Implements a floating HUD and a collapsible Map Editor sidebar.
 * Emits events to Phaser to sync Editor Mode toggles, Selected Tiles,
 * and building object settings (placement, scaling, deletion).
 */
const App: React.FC = () => {
  const { room, sessionId, connected, playerCount, error } = useColyseus();
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Brush state: -1 = Eraser, -2 = Object, 0+ = Tile index
  const [selectedTile, setSelectedTile] = useState(0);
  const [selectedObjectName, setSelectedObjectName] = useState("marketplace");

  // Selected object properties (for scaling/deletion)
  const [selectedObject, setSelectedObject] = useState<{ id: string; type: string; scale: number; animSpeed?: number } | null>(null);

  // Local player's inventory, gold, and seeds
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [gold, setGold] = useState(100);
  const [seeds, setSeeds] = useState<Record<string, number>>({});
  const [selectedInventorySeed, setSelectedInventorySeed] = useState<string | null>(null);

  // Shop state
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"buy" | "sell">("buy");

  // Inventory UI tabs: "crops" (mahsuller) or "seeds" (tohumlar)
  const [inventoryTab, setInventoryTab] = useState<"crops" | "seeds">("crops");

  // Active tab inside spawning objects selector
  const [activeTab, setActiveTab] = useState<"structures" | "decorations" | "effects" | "materials" | "seeds">("structures");

  // Selection box start/end for multi-tile selection
  const [selectionStart, setSelectionStart] = useState<{ col: number; row: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ col: number; row: number } | null>(null);
  const [isSelectingTileset, setIsSelectingTileset] = useState(false);

  // Active tileset tab (terrains or fences)
  const [activeTileset, setActiveTileset] = useState<"terrains" | "fences">("terrains");

  // Legacy map migration state
  const [hasLegacyMap, setHasLegacyMap] = useState(false);

  // File input ref for importing map
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bind game events for selection sync and shop opening
  useEffect(() => {
    if (!game) return;

    const handleObjectSelected = (data: { id: string; type: string; scale: number; animSpeed?: number }) => {
      setSelectedObject(data);
    };

    const handleObjectDeselected = () => {
      setSelectedObject(null);
    };

    const handleOpenShop = () => {
      setIsShopOpen(true);
    };

    game.events.on("editor-object-selected", handleObjectSelected);
    game.events.on("editor-object-deselected", handleObjectDeselected);
    game.events.on("open-farmer-shop", handleOpenShop);

    // Check for legacy local storage maps directly
    const rawMap = localStorage.getItem("mmorpg_map_data");
    const rawObjs = localStorage.getItem("mmorpg_placed_objects");
    if (rawMap || rawObjs) {
      setHasLegacyMap(true);
    }

    return () => {
      game.events.off("editor-object-selected", handleObjectSelected);
      game.events.off("editor-object-deselected", handleObjectDeselected);
      game.events.off("open-farmer-shop", handleOpenShop);
    };
  }, [game]);

  // Synchronize player inventory, gold, and seeds from Colyseus GameState
  useEffect(() => {
    if (!room) return;

    const updatePlayerState = () => {
      const player = room.state.players.get(room.sessionId);
      if (player) {
        setGold(player.gold !== undefined ? player.gold : 100);

        if (player.inventory) {
          const inv: Record<string, number> = {};
          player.inventory.forEach((val, key) => {
            inv[key] = val;
          });
          setInventory(inv);
        }

        if (player.seeds) {
          const sd: Record<string, number> = {};
          player.seeds.forEach((val, key) => {
            sd[key] = val;
          });
          setSeeds(sd);
        }
      }
    };

    // Initial check
    updatePlayerState();

    // Subscribe to state change
    const unsubscribe = room.onStateChange(() => {
      updatePlayerState();
    });

    return () => {
      unsubscribe();
    };
  }, [room, sessionId]);


  const handleToggleEditMode = () => {
    const nextMode = !editMode;
    setEditMode(nextMode);
    setSelectedObject(null);
    if (game) {
      game.events.emit("editor-mode-changed", nextMode);
    }
  };

  const handleSelectTile = (tileIndex: number) => {
    setSelectedTile(tileIndex);
    setSelectedObject(null);
    if (game) {
      game.events.emit("editor-brush-selected", { type: "tile", index: tileIndex });
    }
  };

  const handleSelectEraser = () => {
    setSelectedTile(-1);
    setSelectedObject(null);
    if (game) {
      game.events.emit("editor-brush-selected", { type: "eraser" });
    }
  };

  const handleSelectObjectBrush = (name: string) => {
    setSelectedTile(-2);
    setSelectedObjectName(name);
    setSelectedObject(null);
    if (game) {
      game.events.emit("editor-brush-selected", { type: "object", name });
    }
  };

  const handleObjectScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    if (selectedObject && game) {
      setSelectedObject({ ...selectedObject, scale: newScale });
      game.events.emit("editor-object-scale-changed", { id: selectedObject.id, scale: newScale });
    }
  };

  const handleObjectSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    if (selectedObject && game) {
      setSelectedObject({ ...selectedObject, animSpeed: newSpeed });
      game.events.emit("editor-object-speed-changed", { id: selectedObject.id, speed: newSpeed });
    }
  };

  const handleSelectInventorySeed = (cropId: string) => {
    if (selectedInventorySeed === cropId) {
      setSelectedInventorySeed(null);
      if (game) {
        game.events.emit("editor-brush-selected", { type: "none" });
      }
    } else {
      setSelectedInventorySeed(cropId);
      if (game) {
        game.events.emit("editor-brush-selected", { type: "seed", cropType: cropId });
      }
    }
  };

  const handleObjectDelete = () => {
    if (selectedObject && game) {
      game.events.emit("editor-object-delete-requested", selectedObject.id);
      setSelectedObject(null);
    }
  };

  const getSelectionRect = () => {
    if (!selectionStart || !selectionEnd) return null;
    const colStart = Math.min(selectionStart.col, selectionEnd.col);
    const colEnd = Math.max(selectionStart.col, selectionEnd.col);
    const rowStart = Math.min(selectionStart.row, selectionEnd.row);
    const rowEnd = Math.max(selectionStart.row, selectionEnd.row);

    return {
      left: colStart * 16,
      top: rowStart * 16,
      width: (colEnd - colStart + 1) * 16,
      height: (rowEnd - rowStart + 1) * 16,
      colsCount: colEnd - colStart + 1,
      rowsCount: rowEnd - rowStart + 1,
      colStart,
      rowStart,
    };
  };

  const handleTilesetMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const col = Math.floor(clickX / 16);
    const row = Math.floor(clickY / 16);
    const maxRow = activeTileset === "fences" ? 17 : 23;

    if (col >= 0 && col < 32 && row >= 0 && row < maxRow) {
      setSelectionStart({ col, row });
      setSelectionEnd({ col, row });
      setIsSelectingTileset(true);
      setSelectedObject(null);
    }
  };

  const handleTilesetMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingTileset || !selectionStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const maxRow = activeTileset === "fences" ? 16 : 22;
    const col = Math.max(0, Math.min(31, Math.floor(clickX / 16)));
    const row = Math.max(0, Math.min(maxRow, Math.floor(clickY / 16)));

    setSelectionEnd({ col, row });
  };

  const handleTilesetMouseUp = () => {
    if (!isSelectingTileset || !selectionStart || !selectionEnd) return;
    setIsSelectingTileset(false);

    const colStart = Math.min(selectionStart.col, selectionEnd.col);
    const colEnd = Math.max(selectionStart.col, selectionEnd.col);
    const rowStart = Math.min(selectionStart.row, selectionEnd.row);
    const rowEnd = Math.max(selectionStart.row, selectionEnd.row);

    const w = colEnd - colStart + 1;
    const h = rowEnd - rowStart + 1;
    const startGid = activeTileset === "fences" ? 2000 : 0;

    if (w === 1 && h === 1) {
      // Single tile selection
      const index = startGid + (rowStart * 32 + colStart);
      setSelectedTile(index);
      if (game) {
        game.events.emit("editor-brush-selected", { type: "tile", index });
      }
    } else {
      // Multi-tile stamp selection
      setSelectedTile(-3); // -3 represents custom stamp
      const tiles: number[][] = [];
      for (let r = rowStart; r <= rowEnd; r++) {
        const rowTiles = [];
        for (let c = colStart; c <= colEnd; c++) {
          rowTiles.push(startGid + (r * 32 + c));
        }
        tiles.push(rowTiles);
      }
      if (game) {
        game.events.emit("editor-tile-stamp-selected", { width: w, height: h, tiles });
      }
    }
  };

  // ─── Import / Export handlers ───

  const handleExportMap = () => {
    if (!game) return;
    const scene = game.scene.keys.GameScene as any;
    if (scene) {
      const json = scene.getExportJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `mmorpg_map_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleImportMapClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !game) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const scene = game.scene.keys.GameScene as any;
      if (scene) {
        const success = scene.importJSON(text);
        if (success) {
          alert("Harita başarıyla içe aktarıldı!");
        } else {
          alert("Harita dosyası çözümlenemedi. Lütfen geçerli bir JSON harita dosyası seçin.");
        }
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be selected again
    e.target.value = "";
  };

  const handleMigrateLegacyMap = () => {
    const rawMap = localStorage.getItem("mmorpg_map_data");
    const rawObjs = localStorage.getItem("mmorpg_placed_objects");
    if ((rawMap || rawObjs) && room) {
      room.send("tile-update-bulk", {
        mapData: rawMap ? JSON.parse(rawMap) : {},
        placedObjects: rawObjs ? JSON.parse(rawObjs) : []
      });
      setHasLegacyMap(false);
      // Remove legacy items to avoid prompting again
      localStorage.removeItem("mmorpg_map_data");
      localStorage.removeItem("mmorpg_placed_objects");
      alert("Yerel haritanız sunucuya başarıyla taşındı!");
    }
  };

  return (
    <div className="app">
      {/* ── HUD overlay ─────────────────────────────────────────────────── */}
      <div className="hud" aria-label="HUD">
        {/* Status chip */}
        <div className="chip chip--status">
          <span className={`dot ${connected ? "dot--on" : "dot--off"}`} aria-hidden="true" />
          <span>
            {connected
              ? `Online · ${playerCount} player${playerCount !== 1 ? "s" : ""}`
              : "Connecting…"}
          </span>
        </div>

        {/* Gold chip */}
        {connected && (
          <div className="chip" style={{ background: "rgba(241, 196, 15, 0.2)", border: "1px solid rgba(241, 196, 15, 0.4)", color: "#f1c40f", fontWeight: "bold" }}>
            🪙 {gold} Altın
          </div>
        )}

        {/* Edit mode toggle */}
        {connected && (
          <button
            className={`chip chip--clickable chip--edit ${editMode ? "chip--active" : ""}`}
            onClick={handleToggleEditMode}
            aria-label="Toggle Edit Mode"
          >
            <span>{editMode ? "🛠️ Editör Açık" : "🧱 Haritayı Düzenle"}</span>
          </button>
        )}

        {/* Controls hint */}
        {!editMode ? (
          <div className="chip chip--controls" aria-label="Controls">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
            <span className="sep">or</span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>←</kbd>
            <kbd>→</kbd>
            <span className="sep">to move</span>
          </div>
        ) : (
          <div className="chip chip--controls" aria-label="Editor Controls">
            <span className="editor-alert">
              🖱️ Sol Tık: Çiz/Seç/Koy | 🖱️ Sağ Tık + Sürükle: Haritayı Kaydır | ⚙️ Orta Tekerlek: Zoom
            </span>
          </div>
        )}

        {/* Session ID (shown once connected) */}
        {sessionId && (
          <div className="chip chip--id">
            ID&nbsp;<code className="id-badge">{sessionId.slice(0, 8)}</code>
          </div>
        )}
      </div>

      {/* ── Editor panel sidebar ─────────────────────────────────────────── */}
      {editMode && connected && (
        <div className={`editor-panel ${isCollapsed ? "editor-panel--collapsed" : ""}`}>
          {isCollapsed ? (
            <button
              className="editor-toggle-collapsed"
              onClick={() => setIsCollapsed(false)}
            >
              ◀ Fayans Seçiciyi Aç
            </button>
          ) : (
            <>
              <div className="editor-panel-header">
                <h3 className="editor-panel-title">Editör Paneli</h3>
                <button
                  className="btn btn--minimize"
                  onClick={() => setIsCollapsed(true)}
                  title="Gizle"
                >
                  ▶ Gizle
                </button>
              </div>

              {/* ── Legacy Migration Banner ── */}
              {hasLegacyMap && (
                <div className="legacy-migration-card">
                  <span className="warning-label">💡 Tarayıcınızda eski bir harita tasarımı bulundu!</span>
                  <button className="btn btn--primary" onClick={handleMigrateLegacyMap}>
                    Haritayı Sunucuya Yükle 🚀
                  </button>
                </div>
              )}

              {/* ── Action Brushes ── */}
              <div className="brush-row">
                <button
                  className={`btn btn--eraser ${selectedTile === -1 ? "btn--active" : ""}`}
                  onClick={handleSelectEraser}
                >
                  🧹 Silgi (Eraser)
                </button>
              </div>

              {/* ── Import / Export Harita Dosyası ── */}
              <div className="section-title">Harita Kaydet / Yükle</div>
              <div className="brush-row" style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn--secondary" onClick={handleExportMap} style={{ flex: 1 }}>
                  💾 Dışa Aktar (JSON)
                </button>
                <button className="btn btn--secondary" onClick={handleImportMapClick} style={{ flex: 1 }}>
                  📂 İçe Aktar (JSON)
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  style={{ display: "none" }}
                />
              </div>

              {/* ── Placed Object Settings (Visible when a building is selected) ── */}
              {selectedObject && (
                <div className="object-settings-card">
                  <div className="card-title">Seçili Obje Ayarları</div>
                  <div className="card-detail">
                    Tip: <b>{
                      selectedObject.type === "bank" ? "Banka" :
                      selectedObject.type === "games" ? "Ev" :
                      selectedObject.type === "blacksmith" ? "Demirci" :
                      selectedObject.type === "shop" ? "Dükkan" :
                      selectedObject.type === "gem_trader" ? "Cevher Tüccarı" :
                      selectedObject.type === "farmer_npc" ? "Çiftçi NPC" :
                      selectedObject.type === "vfx_leaf_single" ? "Tek Yaprak" :
                      selectedObject.type === "vfx_smoke" ? "Fırın Dumanı" :
                      selectedObject.type === "mg_stable_gate" ? "Ahır Kapısı" :
                      selectedObject.type === "mg_stable_gate_lb" ? "Açık K. Ahır Kapısı" :
                      selectedObject.type === "mg_well" ? "Kuyu" :
                      selectedObject.type === "mg_crate_1" ? "Tahta Sandık 1" :
                      selectedObject.type === "mg_crate_2" ? "Tahta Sandık 2" :
                      selectedObject.type === "mg_wooden_gate" ? "Tahta Kapı" :
                      selectedObject.type === "silo" ? "Silo 1" :
                      selectedObject.type === "silo2" ? "Silo 2" :
                      selectedObject.type.startsWith("vfx_") ? `Yaprak Efekti (${selectedObject.type.replace("vfx_leaves_", "").replace("_", " ")})` :
                      selectedObject.type.startsWith("decor_grass_") ? `Dekor (Çiçek/Çimen #${selectedObject.type.replace("decor_grass_", "")})` :
                      selectedObject.type.startsWith("decor_gorsel_") ? `Görsel Dekor #${selectedObject.type.replace("decor_gorsel_", "")}` :
                      "Market"
                    }</b>
                  </div>
                  
                  <div className="slider-group">
                    <label htmlFor="scale-slider">
                      Boyut (Ölçek): <b>{Math.round(selectedObject.scale * 100)}%</b>
                    </label>
                    <input
                      id="scale-slider"
                      type="range"
                      min={
                        selectedObject.type.startsWith("decor_grass_") ||
                        selectedObject.type.startsWith("decor_gorsel_") ||
                        selectedObject.type.startsWith("vfx_") ||
                        selectedObject.type.startsWith("mg_") ||
                        selectedObject.type.startsWith("silo")
                          ? "0.5"
                          : "0.05"
                      }
                      max={
                        selectedObject.type.startsWith("decor_grass_") ||
                        selectedObject.type.startsWith("decor_gorsel_") ||
                        selectedObject.type.startsWith("vfx_") ||
                        selectedObject.type.startsWith("mg_") ||
                        selectedObject.type.startsWith("silo")
                          ? "5.0"
                          : "0.50"
                      }
                      step={
                        selectedObject.type.startsWith("decor_grass_") ||
                        selectedObject.type.startsWith("decor_gorsel_") ||
                        selectedObject.type.startsWith("vfx_") ||
                        selectedObject.type.startsWith("mg_") ||
                        selectedObject.type.startsWith("silo")
                          ? "0.1"
                          : "0.01"
                      }
                      value={selectedObject.scale}
                      onChange={handleObjectScaleChange}
                    />
                  </div>

                  {/* Animation Speed Slider (Visible only for animated objects like VFX/gifts) */}
                  {(selectedObject.type.startsWith("vfx_") || selectedObject.type.startsWith("mg_")) && (
                    <div className="slider-group" style={{ marginTop: "10px" }}>
                      <label htmlFor="speed-slider">
                        Animasyon Hızı: <b>{Math.round((selectedObject.animSpeed !== undefined ? selectedObject.animSpeed : 1.0) * 100)}%</b>
                      </label>
                      <input
                        id="speed-slider"
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        value={selectedObject.animSpeed !== undefined ? selectedObject.animSpeed : 1.0}
                        onChange={handleObjectSpeedChange}
                      />
                    </div>
                  )}

                  <button className="btn btn--danger" onClick={handleObjectDelete}>
                    🗑️ Objeyi Haritadan Sil
                  </button>
                </div>
              )}

              {/* ── Spawning Objects Selector ── */}
              <div className="section-title">Büyük Objeler & Efektler</div>
              
              {/* Tab Navigation Buttons */}
              <div className="editor-tabs">
                <button
                  className={`tab-btn ${activeTab === "structures" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("structures")}
                >
                  🏰 Yapı & NPC
                </button>
                <button
                  className={`tab-btn ${activeTab === "decorations" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("decorations")}
                >
                  🌿 Dekor (Foto)
                </button>
                <button
                  className={`tab-btn ${activeTab === "effects" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("effects")}
                >
                  ✨ Efekt (GIF)
                </button>
                <button
                  className={`tab-btn ${activeTab === "materials" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("materials")}
                  style={{ fontSize: "9px" }}
                >
                  📦 Malzeme Gift
                </button>
                <button
                  className={`tab-btn ${activeTab === "seeds" ? "tab-btn--active" : ""}`}
                  onClick={() => {
                    setActiveTab("seeds");
                    // Clear any object brush when switching to seeds
                    if (game) game.events.emit("editor-brush-selected", { type: "seed", cropType: "" });
                  }}
                  style={{ fontSize: "9px" }}
                >
                  🌾 Tohum Ek
                </button>
              </div>

              {/* Tab 1: Structures & NPCs */}
              {activeTab === "structures" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "marketplace" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("marketplace")}
                  >
                    <img src="/assets/marketplace.png" alt="market" className="obj-thumb" />
                    <span>Market</span>
                  </button>
                  
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "bank" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("bank")}
                  >
                    <img src="/assets/bank.png" alt="bank" className="obj-thumb" />
                    <span>Banka</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "games" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("games")}
                  >
                    <img src="/assets/games.png" alt="house" className="obj-thumb" />
                    <span>Ev</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "blacksmith" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("blacksmith")}
                  >
                    <img src="/assets/blacksmith.png" alt="blacksmith" className="obj-thumb" />
                    <span>Demirci</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "shop" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("shop")}
                  >
                    <img src="/assets/shop.png" alt="shop" className="obj-thumb" />
                    <span>Dükkan</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "gem_trader" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("gem_trader")}
                  >
                    <img src="/assets/gem_trader.png" alt="gem trader" className="obj-thumb" />
                    <span>Cevher Tüccarı</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "farmer_npc" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("farmer_npc")}
                  >
                    <img src="/assets/farmer_npc.png" alt="farmer npc" className="obj-thumb" />
                    <span>Çiftçi NPC</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "silo" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("silo")}
                  >
                    <img src="/assets/silo.png" alt="silo" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Silo 1</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "silo2" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("silo2")}
                  >
                    <img src="/assets/silo2.png" alt="silo2" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Silo 2</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "nft_house" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("nft_house")}
                  >
                    <img src="/assets/nft_house.png" alt="nft house" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>NFT Evi</span>
                  </button>
                </div>
              )}

              {/* Tab 2: Customization / Decorations (11 items + 24 custom sheet items) */}
              {activeTab === "decorations" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {Array.from({ length: 11 }, (_, i) => i + 1).map(idx => (
                    <button
                      key={`decor-${idx}`}
                      className={`obj-btn obj-btn--small ${selectedTile === -2 && selectedObjectName === `decor_grass_${idx}` ? "obj-btn--active" : ""}`}
                      onClick={() => handleSelectObjectBrush(`decor_grass_${idx}`)}
                    >
                      <img src={`/assets/customization/Grass_Tufts_Flowers_${idx}.png`} alt={`decor-${idx}`} className="obj-thumb obj-thumb--small" />
                      <span style={{ fontSize: "6px" }}>Dekor #{idx}</span>
                    </button>
                  ))}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 17, 18, 19, 22, 23, 24, 28, 29, 30, 38].map(frameIdx => {
                    const col = frameIdx % 11;
                    const row = Math.floor(frameIdx / 11);
                    return (
                      <button
                        key={`decor-gorsel-${frameIdx}`}
                        className={`obj-btn obj-btn--small ${selectedTile === -2 && selectedObjectName === `decor_gorsel_${frameIdx}` ? "obj-btn--active" : ""}`}
                        onClick={() => handleSelectObjectBrush(`decor_gorsel_${frameIdx}`)}
                      >
                        <div
                          className="obj-thumb obj-thumb--small"
                          style={{
                            width: "16px",
                            height: "16px",
                            backgroundImage: "url('/assets/customization/görsel.png')",
                            backgroundSize: `${11 * 16}px ${4 * 16}px`,
                            backgroundPosition: `-${col * 16}px -${row * 16}px`,
                            imageRendering: "pixelated",
                            margin: "0 auto",
                          }}
                        />
                        <span style={{ fontSize: "6px" }}>Görsel #{frameIdx}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tab 3: VFX / Gifts (Gifs) */}
              {activeTab === "effects" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "vfx_leaf_single" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("vfx_leaf_single")}
                  >
                    <img src="/assets/gift/Modern_Farm_vfx_Falling_Leaf_16x16.gif" alt="leaf" className="obj-thumb" />
                    <span>Tek Yaprak</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "vfx_leaves_1" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("vfx_leaves_1")}
                  >
                    <img src="/assets/gift/Modern_Farm_vfx_Falling_Leaves_16x16.gif" alt="leaves1" className="obj-thumb" />
                    <span>Yapraklar 1</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "vfx_leaves_2" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("vfx_leaves_2")}
                  >
                    <img src="/assets/gift/Modern_Farm_vfx_Falling_Leaves_2_16x16.gif" alt="leaves2" className="obj-thumb" />
                    <span>Yapraklar 2</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "vfx_leaves_3" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("vfx_leaves_3")}
                  >
                    <img src="/assets/gift/Modern_Farm_vfx_Falling_Leaves_3_16x16.gif" alt="leaves3" className="obj-thumb" />
                    <span>Yapraklar 3</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "vfx_leaves_brown" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("vfx_leaves_brown")}
                  >
                    <img src="/assets/gift/Modern_Farm_vfx_Falling_Leaves_Brown_16x16.gif" alt="leaves_brown" className="obj-thumb" />
                    <span>K.rengi Yaprak</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "vfx_leaves_yellow" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("vfx_leaves_yellow")}
                  >
                    <img src="/assets/gift/Modern_Farm_vfx_Falling_Leaves_Yellow_16x16.gif" alt="leaves_yellow" className="obj-thumb" />
                    <span>Sarı Yaprak</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "vfx_smoke" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("vfx_smoke")}
                  >
                    <img src="/assets/gift/Stone_Oven_Smoke_Effect_16x16.gif" alt="smoke" className="obj-thumb" />
                    <span>Fırın Dumanı</span>
                  </button>
                </div>
              )}

              {/* Tab 4: Material Gift (Gifs) */}
              {activeTab === "materials" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "mg_stable_gate" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("mg_stable_gate")}
                  >
                    <img src="/assets/material_gift/Stable_Gate_16x16.gif" alt="stable gate" className="obj-thumb" />
                    <span>Ahır Kapısı</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "mg_stable_gate_lb" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("mg_stable_gate_lb")}
                  >
                    <img src="/assets/material_gift/Stable_Gate_Light_Brown_16x16.gif" alt="stable gate lb" className="obj-thumb" />
                    <span>Açık K. Kapı</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "mg_well" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("mg_well")}
                  >
                    <img src="/assets/material_gift/Well_16x16.gif" alt="well" className="obj-thumb" />
                    <span>Kuyu</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "mg_crate_1" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("mg_crate_1")}
                  >
                    <img src="/assets/material_gift/Wooden_Crate_1_16x16.gif" alt="crate 1" className="obj-thumb" />
                    <span>Tahta Sandık 1</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "mg_crate_2" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("mg_crate_2")}
                  >
                    <img src="/assets/material_gift/Wooden_Crate_2_16x16.gif" alt="crate 2" className="obj-thumb" />
                    <span>Tahta Sandık 2</span>
                  </button>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "mg_wooden_gate" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("mg_wooden_gate")}
                  >
                    <img src="/assets/material_gift/Wooden_Gate_16x16.gif" alt="wooden gate" className="obj-thumb" />
                    <span>Tahta Kapı</span>
                  </button>
                </div>
              )}

              {/* Tab 5: Tohum (Crop Seeds) */}
              {activeTab === "seeds" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                  {[
                    { id: "Cabbage",      label: "Lahana",         frameH: 32 },
                    { id: "Carrot",       label: "Havuç",          frameH: 32 },
                    { id: "Cauliflower",  label: "Karnabahar",     frameH: 32 },
                    { id: "Coffee",       label: "Kahve",          frameH: 64 },
                    { id: "Corn",         label: "Mısır",          frameH: 64 },
                    { id: "Cotton",       label: "Pamuk",          frameH: 32 },
                    { id: "Grape",        label: "Üzüm",           frameH: 96 },
                    { id: "Onion",        label: "Soğan",          frameH: 64 },
                    { id: "Pepper",       label: "Biber",          frameH: 32 },
                    { id: "Prickly_Pear", label: "Kaktüs",         frameH: 96 },
                    { id: "Pumpkin",      label: "Kabak",          frameH: 64 },
                    { id: "Radish",       label: "Turp",           frameH: 32 },
                    { id: "Strawberry",   label: "Çilek",          frameH: 32 },
                    { id: "Tomato",       label: "Domates",        frameH: 64 },
                    { id: "Turnip",       label: "Şalgam",         frameH: 48 },
                    { id: "Watermelon",   label: "Karpuz",         frameH: 64 },
                    { id: "Wheat",        label: "Buğday",         frameH: 32 },
                  ].map(crop => (
                    <button
                      key={crop.id}
                      className={`obj-btn obj-btn--small ${selectedObjectName === `seed_${crop.id}` ? "obj-btn--active" : ""}`}
                      onClick={() => {
                        setSelectedObjectName(`seed_${crop.id}`);
                        setSelectedTile(-3);
                        if (game) game.events.emit("editor-brush-selected", { type: "seed", cropType: crop.id });
                      }}
                      title={`${crop.label} — Sol tıkla: ek, Sağ tıkla (olgunsa): hasat`}
                    >
                      <div style={{
                        width: "16px",
                        height: "16px",
                        backgroundImage: "url('/assets/pickup_items.png')",
                        backgroundSize: "224px 160px",
                        backgroundPosition: `-${(cropCoordinates[crop.id]?.col || 0) * 16}px -${(cropCoordinates[crop.id]?.row || 0) * 16}px`,
                        imageRendering: "pixelated",
                        margin: "0 auto",
                      }} />
                      <span style={{ fontSize: "6px" }}>{crop.label}</span>
                    </button>
                  ))}
                </div>
              )}

               {/* ── Terrains Tileset Selector ── */}
              <div className="section-title">Zemin & Çit Fayansları (16x16)</div>

              {/* Sub-Tabs to switch between Terrains and Fences */}
              <div className="editor-tabs" style={{ marginTop: "6px", marginBottom: "8px" }}>
                <button
                  className={`tab-btn ${activeTileset === "terrains" ? "tab-btn--active" : ""}`}
                  onClick={() => {
                    setActiveTileset("terrains");
                    setSelectedTile(0);
                    if (game) game.events.emit("editor-brush-selected", { type: "tile", index: 0 });
                  }}
                >
                  🏞️ Zeminler
                </button>
                <button
                  className={`tab-btn ${activeTileset === "fences" ? "tab-btn--active" : ""}`}
                  onClick={() => {
                    setActiveTileset("fences");
                    setSelectedTile(2000);
                    if (game) game.events.emit("editor-brush-selected", { type: "tile", index: 2000 });
                  }}
                >
                  🚧 Çitler (Şeffaf)
                </button>
              </div>

              <div className="tileset-container">
                <div
                  className="tileset-wrapper"
                  style={{
                    position: "relative",
                    width: "512px",
                    height: activeTileset === "fences" ? "272px" : "368px",
                    cursor: "pointer"
                  }}
                  onMouseDown={handleTilesetMouseDown}
                  onMouseMove={handleTilesetMouseMove}
                  onMouseUp={handleTilesetMouseUp}
                  onMouseLeave={handleTilesetMouseUp}
                >
                  <img
                    src={activeTileset === "fences" ? "/assets/fences.png" : "/assets/terrains.png"}
                    alt="tileset"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      display: "block",
                      width: "512px",
                      height: activeTileset === "fences" ? "272px" : "368px",
                      imageRendering: "pixelated",
                      userSelect: "none",
                    }}
                  />
                  
                  {/* Active single selection highlighting box */}
                  {((selectedTile >= 2000 && activeTileset === "fences") || 
                    (selectedTile >= 0 && selectedTile < 2000 && activeTileset === "terrains")) && (
                    <div
                      className="selection-box"
                      style={{
                        position: "absolute",
                        border: "2px solid #55ff22",
                        boxShadow: "0 0 6px rgba(85, 255, 34, 0.9)",
                        width: "16px",
                        height: "16px",
                        left: `${((selectedTile >= 2000 ? selectedTile - 2000 : selectedTile) % 32) * 16}px`,
                        top: `${Math.floor((selectedTile >= 2000 ? selectedTile - 2000 : selectedTile) / 32) * 16}px`,
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* Multi-tile selection preview (during drag or when stamp is selected) */}
                  {getSelectionRect() && (selectedTile === -3 || isSelectingTileset) && (
                    <div
                      className="selection-box selection-box--stamp"
                      style={{
                        position: "absolute",
                        border: "2px solid #3b82f6",
                        boxShadow: "0 0 8px rgba(59, 130, 246, 0.9)",
                        backgroundColor: "rgba(59, 130, 246, 0.15)",
                        left: `${getSelectionRect()!.left}px`,
                        top: `${getSelectionRect()!.top}px`,
                        width: `${getSelectionRect()!.width}px`,
                        height: `${getSelectionRect()!.height}px`,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              </div>
              
              <div className="editor-panel-tip">
                * <b>Çizim</b>: Zemin fayansı/Obje seçip haritaya <b>Sol Tık</b> yapın.<br/>
                * <b>Taşıma</b>: Yerleştirilen objeyi farenizle basılı tutup sürükleyin.<br/>
                * <b>Ayarlar</b>: Objeyi düzenlemek için üzerine <b>Sol Tık</b> yapıp seçin.
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Farmer Shop Modal ── */}
      {isShopOpen && (
        <div className="shop-overlay">
          <div className="shop-modal">
            <div className="shop-header">
              <span className="shop-title">🌾 Çiftçi NPC Pazarı</span>
              <button className="shop-close" onClick={() => setIsShopOpen(false)}>✕</button>
            </div>
            
            <div className="shop-gold-display">
              🪙 Kalan Altın: <span className="gold-amount">{gold} Altın</span>
            </div>

            <div className="shop-tabs">
              <button
                className={`shop-tab-btn ${shopTab === "buy" ? "shop-tab-btn--active" : ""}`}
                onClick={() => setShopTab("buy")}
              >
                📥 Tohum Satın Al
              </button>
              <button
                className={`shop-tab-btn ${shopTab === "sell" ? "shop-tab-btn--active" : ""}`}
                onClick={() => setShopTab("sell")}
              >
                📤 Mahsul Satış
              </button>
            </div>

            <div className="shop-body">
              {shopTab === "buy" ? (
                <div className="shop-list">
                  {Object.entries(CROP_PRICES).map(([cropName, price]) => {
                    const label = cropLabels[cropName] || cropName;
                    const bagIndex = cropSeedBagIndices[cropName] || 0;
                    return (
                      <div key={cropName} className="shop-item">
                        <div
                          className="shop-item-icon"
                          style={{
                            backgroundImage: "url('/assets/seed_bags_32x32.png')",
                            backgroundSize: "544px 32px",
                            backgroundPosition: `-${bagIndex * 32}px 0px`,
                            imageRendering: "pixelated",
                          }}
                        />
                        <div className="shop-item-info">
                          <span className="shop-item-name">{label} Tohumu</span>
                          <span className="shop-item-price">💰 {price.buySeed} Altın</span>
                        </div>
                        <button
                          className="shop-action-btn shop-action-btn--buy"
                          disabled={gold < price.buySeed}
                          onClick={() => room?.send("shop-buy-seed", { cropType: cropName })}
                        >
                          Satın Al
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="shop-list">
                  {Object.entries(CROP_PRICES).map(([cropName, price]) => {
                    const label = cropLabels[cropName] || cropName;
                    const qty = inventory[cropName] || 0;
                    const colRow = cropCoordinates[cropName] || { col: 0, row: 0 };
                    return (
                      <div key={cropName} className="shop-item" style={{ opacity: qty > 0 ? 1 : 0.5 }}>
                        <div
                          className="shop-item-icon"
                          style={{
                            backgroundImage: "url('/assets/pickup_items.png')",
                            backgroundSize: "224px 160px",
                            backgroundPosition: `-${colRow.col * 16}px -${colRow.row * 16}px`,
                            imageRendering: "pixelated",
                          }}
                        />
                        <div className="shop-item-info">
                          <span className="shop-item-name">{label}</span>
                          <span className="shop-item-price">💰 {price.sellCrop} Altın</span>
                          <span className="shop-item-stock">Envanter: x{qty}</span>
                        </div>
                        <button
                          className="shop-action-btn shop-action-btn--sell"
                          disabled={qty <= 0}
                          onClick={() => room?.send("shop-sell-crop", { cropType: cropName })}
                        >
                          Sat
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Inventory Panel ── */}
      {connected && (
        <div className="inventory-card">
          <div className="inventory-title">🎒 Envanterim (Çantam)</div>
          
          {/* Sub-tabs inside inventory card */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
            <button
              onClick={() => {
                setInventoryTab("crops");
                setSelectedInventorySeed(null);
                if (game) game.events.emit("editor-brush-selected", { type: "none" });
              }}
              style={{
                flex: 1,
                background: inventoryTab === "crops" ? "rgba(74, 222, 128, 0.2)" : "rgba(255,255,255,0.05)",
                border: "1px solid " + (inventoryTab === "crops" ? "rgba(74, 222, 128, 0.4)" : "rgba(255,255,255,0.1)"),
                borderRadius: "6px",
                color: inventoryTab === "crops" ? "#4ade80" : "rgba(255,255,255,0.7)",
                fontSize: "10px",
                padding: "4px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🥦 Mahsuller
            </button>
            <button
              onClick={() => setInventoryTab("seeds")}
              style={{
                flex: 1,
                background: inventoryTab === "seeds" ? "rgba(74, 222, 128, 0.2)" : "rgba(255,255,255,0.05)",
                border: "1px solid " + (inventoryTab === "seeds" ? "rgba(74, 222, 128, 0.4)" : "rgba(255,255,255,0.1)"),
                borderRadius: "6px",
                color: inventoryTab === "seeds" ? "#4ade80" : "rgba(255,255,255,0.7)",
                fontSize: "10px",
                padding: "4px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🌱 Tohumlar
            </button>
          </div>

          <div className="inventory-items">
            {inventoryTab === "crops" ? (
              Object.keys(inventory).length === 0 || Object.values(inventory).every(qty => qty <= 0) ? (
                <div className="inventory-empty">Çanta boş. Ekin topla!</div>
              ) : (
                Object.entries(inventory).map(([cropName, qty]) => {
                  if (qty <= 0) return null;
                  const label = cropLabels[cropName] || cropName;
                  return (
                    <div key={cropName} className="inventory-item">
                      <div
                        className="inventory-thumb"
                        style={{
                          backgroundImage: "url('/assets/pickup_items.png')",
                          backgroundSize: "224px 160px",
                          backgroundPosition: `-${(cropCoordinates[cropName]?.col || 0) * 16}px -${(cropCoordinates[cropName]?.row || 0) * 16}px`,
                          imageRendering: "pixelated",
                        }}
                      />
                      <div className="inventory-details">
                        <span className="inventory-name" title={label}>{label}</span>
                        <span className="inventory-qty">x{qty}</span>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              Object.keys(seeds).length === 0 || Object.values(seeds).every(qty => qty <= 0) ? (
                <div className="inventory-empty">Tohum yok. NPC'den satın al!</div>
              ) : (
                Object.entries(seeds).map(([cropName, qty]) => {
                  if (qty <= 0) return null;
                  const label = cropLabels[cropName] || cropName;
                  const bagIndex = cropSeedBagIndices[cropName] || 0;
                  const isSelected = selectedInventorySeed === cropName;
                  return (
                    <div
                      key={cropName}
                      className={`inventory-item ${isSelected ? "inventory-item--selected" : ""}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSelectInventorySeed(cropName)}
                      title="Ekmek için seç / iptal et"
                    >
                      <div
                        className="inventory-thumb"
                        style={{
                          backgroundImage: "url('/assets/seed_bags_32x32.png')",
                          backgroundSize: "544px 32px",
                          backgroundPosition: `-${bagIndex * 32}px 0px`,
                          imageRendering: "pixelated",
                        }}
                      />
                      <div className="inventory-details">
                        <span className="inventory-name" title={`${label} Tohumu`}>{label} Toh.</span>
                        <span className="inventory-qty">x{qty}</span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      )}

      {/* ── Error overlay ───────────────────────────────────────────────── */}
      {error && (
        <div className="error-overlay" role="alert" aria-live="assertive">
          <span className="error-icon">⚠️</span>
          <strong className="error-title">Connection Error</strong>
          <p className="error-body">{error}</p>
        </div>
      )}

      {/* ── Game or loading state ────────────────────────────────────────── */}
      {room && sessionId ? (
        <PhaserGame room={room} sessionId={sessionId} onGameReady={setGame} />
      ) : !error ? (
        <div className="loader" aria-label="Connecting">
          <div className="spinner" aria-hidden="true" />
          <span>Connecting to server…</span>
        </div>
      ) : null}
    </div>
  );
};

export default App;
