import React, { useState, useEffect } from "react";
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
      game.events.emit("editor-mode-toggled", nextMode);
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
      game.events.emit("editor-object-scale", { id: selectedObject.id, scale: newScale });
    }
  };

  const handleObjectDelete = () => {
    if (selectedObject && game) {
      game.events.emit("editor-object-delete", selectedObject.id);
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

              {/* ── Action Brushes ── */}
              <div className="brush-row">
                <button
                  className={`btn btn--eraser ${selectedTile === -1 ? "btn--active" : ""}`}
                  onClick={handleSelectEraser}
                >
                  🧹 Silgi (Eraser)
                </button>
              </div>

              {/* ── Placed Object Settings (Visible when a building is selected) ── */}
              {selectedObject && (
                <div className="object-settings-card">
                  <div className="card-title">Seçili Obje Ayarları</div>
                  <div className="card-detail">
                    Tip: <b>{selectedObject.type === "bank" ? "Banka" : selectedObject.type === "games" ? "Ev" : selectedObject.type === "blacksmith" ? "Demirci" : "Market"}</b>
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
              <div className="section-title">Büyük Objeler (Fotoğraf)</div>
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
              </div>

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
