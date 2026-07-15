import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { useColyseus } from "./hooks/useColyseus";
import { PhaserGame } from "./game/PhaserGame";

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
  const [selectedObject, setSelectedObject] = useState<{ id: string; type: string; scale: number } | null>(null);

  // Active tab inside spawning objects selector
  const [activeTab, setActiveTab] = useState<"structures" | "decorations" | "effects">("structures");

  // Legacy map migration state
  const [hasLegacyMap, setHasLegacyMap] = useState(false);

  // File input ref for importing map
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bind game events for selection sync
  useEffect(() => {
    if (!game) return;

    const handleObjectSelected = (data: { id: string; type: string; scale: number }) => {
      setSelectedObject(data);
    };

    const handleObjectDeselected = () => {
      setSelectedObject(null);
    };

    game.events.on("editor-object-selected", handleObjectSelected);
    game.events.on("editor-object-deselected", handleObjectDeselected);

    // Check for legacy local storage maps directly
    const rawMap = localStorage.getItem("mmorpg_map_data");
    const rawObjs = localStorage.getItem("mmorpg_placed_objects");
    if (rawMap || rawObjs) {
      setHasLegacyMap(true);
    }

    return () => {
      game.events.off("editor-object-selected", handleObjectSelected);
      game.events.off("editor-object-deselected", handleObjectDeselected);
    };
  }, [game]);

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

  const handleObjectDelete = () => {
    if (selectedObject && game) {
      game.events.emit("editor-object-delete-requested", selectedObject.id);
      setSelectedObject(null);
    }
  };

  const handleTilesetClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const col = Math.floor(clickX / 16);
    const row = Math.floor(clickY / 16);

    // Grid size: 32 columns x 23 rows of 16x16 tiles
    if (col >= 0 && col < 32 && row >= 0 && row < 23) {
      const index = row * 32 + col;
      handleSelectTile(index);
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
                      selectedObject.type.startsWith("vfx_") ? `Yaprak Efekti (${selectedObject.type.replace("vfx_leaves_", "").replace("_", " ")})` :
                      selectedObject.type.startsWith("decor_grass_") ? `Dekor (Çiçek/Çimen #${selectedObject.type.replace("decor_grass_", "")})` :
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
                      min="0.05"
                      max="0.45"
                      step="0.01"
                      value={selectedObject.scale}
                      onChange={handleObjectScaleChange}
                    />
                  </div>

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
                </div>
              )}

              {/* Tab 2: Customization / Decorations (11 items) */}
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

              {/* ── Terrains Tileset Selector ── */}
              <div className="section-title">Zemin Fayansları (16x16)</div>
              <div className="tileset-container">
                <div
                  className="tileset-wrapper"
                  style={{ position: "relative", width: "512px", height: "368px", cursor: "pointer" }}
                  onClick={handleTilesetClick}
                >
                  <img
                    src="/assets/terrains.png"
                    alt="terrains"
                    style={{
                      display: "block",
                      width: "512px",
                      height: "368px",
                      imageRendering: "pixelated",
                    }}
                  />
                  
                  {/* Active selection highlighting box */}
                  {selectedTile >= 0 && (
                    <div
                      className="selection-box"
                      style={{
                        position: "absolute",
                        border: "2px solid #55ff22",
                        boxShadow: "0 0 6px rgba(85, 255, 34, 0.9)",
                        width: "16px",
                        height: "16px",
                        left: `${(selectedTile % 32) * 16}px`,
                        top: `${Math.floor(selectedTile / 32) * 16}px`,
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
