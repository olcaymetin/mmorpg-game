import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { useColyseus } from "./hooks/useColyseus";
import { PhaserGame } from "./game/PhaserGame";
import LoginScreen from "./components/LoginScreen";
import ChatPanel from "./components/ChatPanel";
import MarketplaceModal from "./components/MarketplaceModal";
import SettingsModal from "./components/SettingsModal";
import LeaderboardModal from "./components/LeaderboardModal";
import CraftTimer, { CraftTimerEntry } from "./components/CraftTimer";
import CharacterStats from "./components/CharacterStats";
import FriendsPanel from "./components/FriendsPanel";
import PlayerProfileModal from "./components/PlayerProfileModal";
import GuildPanel from "./components/GuildPanel";



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
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

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
  const [shopTab, setShopTab] = useState<"buy" | "sell" | "survival">("buy");

  // Inventory UI tabs: "crops" (mahsuller), "seeds" (tohumlar), or "survival" (yiyecek/su)
  const [inventoryTab, setInventoryTab] = useState<"crops" | "seeds" | "survival">("crops");

  // Survival
  const [hunger, setHunger] = useState(100);
  const [thirst, setThirst] = useState(100);

  // AFK Kick status
  const [afkKickReason, setAfkKickReason] = useState("");

  // Active tab inside spawning objects selector
  const [activeTab, setActiveTab] = useState<"structures" | "decorations" | "effects" | "materials" | "seeds" | "mining">("structures");

  // Selection box start/end for multi-tile selection
  const [selectionStart, setSelectionStart] = useState<{ col: number; row: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ col: number; row: number } | null>(null);
  const [isSelectingTileset, setIsSelectingTileset] = useState(false);

  // Active tileset tab (terrains or fences)
  const [activeTileset, setActiveTileset] = useState<"terrains" | "fences" | "zemin2" | "iskele" | "dekor2">("terrains");
  const [paintOnTop, setPaintOnTop] = useState(false);

  // Legacy map migration state
  const [hasLegacyMap, setHasLegacyMap] = useState(false);

  // File input ref for importing map
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Login ───────────────────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("login_type"));
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("login_type") === "admin");

  // ── New currency: gem & coin (FARM) ─────────────────────────────────────────
  const [gem, setGem] = useState(0);
  const [coin, setCoin] = useState(0);

  // ── Player info ─────────────────────────────────────────────────────────────
  const [myUsername, setMyUsername] = useState("");
  const [usernameSet, setUsernameSet] = useState(false);
  const [language, setLanguage] = useState("en");

  // ── Skills (farming, combat, etc.) ──────────────────────────────────────────
  const [skills, setSkills] = useState<Record<string, { level: number; xp: number }>>({});
  const [skillBoosts, setSkillBoosts] = useState<Record<string, number>>({});
  const [totalLevel, setTotalLevel] = useState(1);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [shield, setShield] = useState(100);
  const [maxShield, setMaxShield] = useState(100);

  // ── Modals & Profiles ────────────────────────────────────────────────────────
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // ── Craft timers ────────────────────────────────────────────────────────────
  const [craftTimers, setCraftTimers] = useState<CraftTimerEntry[]>([]);
  const removeCraftTimer = useCallback((id: string) => {
    setCraftTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  // Bind game events for selection sync and shop opening
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      originalLog(...args);
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      setDebugLogs(prev => [msg, ...prev].slice(0, 15));
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      const msg = "❌ " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      setDebugLogs(prev => [msg, ...prev].slice(0, 15));
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

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

    const handleOpenMarket = () => {
      setIsMarketOpen(true);
    };

    const handleCropPlanted = (data: { cropType: string }) => {
      const growthDuration = 30_000; // 30 seconds = 6 stages × 5s
      const entry: CraftTimerEntry = {
        id: `crop-${Date.now()}`,
        label: `${data.cropType} growing…`,
        emoji: "🌱",
        durationMs: growthDuration,
        startedAt: Date.now(),
      };
      setCraftTimers(prev => [...prev, entry]);
    };

    const handleOpenPlayerProfile = (data: { sessionId: string }) => {
      setSelectedProfileId(data.sessionId);
    };

    game.events.on("editor-object-selected", handleObjectSelected);
    game.events.on("editor-object-deselected", handleObjectDeselected);
    game.events.on("open-farmer-shop", handleOpenShop);
    game.events.on("open-marketplace", handleOpenMarket);
    game.events.on("crop-planted", handleCropPlanted);
    game.events.on("open-player-profile", handleOpenPlayerProfile);

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
      game.events.off("open-marketplace", handleOpenMarket);
      game.events.off("crop-planted", handleCropPlanted);
      game.events.off("open-player-profile", handleOpenPlayerProfile);
    };
  }, [game]);

  // Colyseus message listeners
  useEffect(() => {
    if (!room) return;

    const handleAchievement = (ach: { id: string; name: string; emoji: string; description: string }) => {
      alert(`🏅 BAŞARIM KİLİDİ AÇILDI: ${ach.emoji} ${ach.name} - ${ach.description}`);
    };

    const handleCraftInstanted = (d: { craftId: string }) => {
      removeCraftTimer(d.craftId);
    };

    const handleAfkKick = (d: { reason: string }) => {
      setAfkKickReason(d.reason);
    };

    const handleReportSuccess = (d: { message: string }) => {
      alert(`🚨 Rapor Gönderildi: ${d.message}`);
    };

    room.onMessage("achievement-unlocked", handleAchievement);
    room.onMessage("craft-instanted", handleCraftInstanted);
    room.onMessage("afk-kick", handleAfkKick);
    room.onMessage("report-success", handleReportSuccess);

    return () => {
      // no-op
    };
  }, [room, removeCraftTimer]);


  // Synchronize player inventory, gold, and seeds from Colyseus GameState
  useEffect(() => {
    if (!room) return;

    const updatePlayerState = () => {
      const player = room.state.players.get(room.sessionId);
      if (player) {
        setGold(player.gold !== undefined ? player.gold : 100);
        setGem(player.gem !== undefined ? player.gem : 0);
        setCoin(player.coin !== undefined ? player.coin : 0);
        setMyUsername(player.username || "");
        setUsernameSet(!!player.usernameSet);
        setTotalLevel(player.totalLevel || 1);

        setHp(player.hp !== undefined ? player.hp : 100);
        setMaxHp(player.maxHp !== undefined ? player.maxHp : 100);
        setShield(player.shield !== undefined ? player.shield : 100);
        setMaxShield(player.maxShield !== undefined ? player.maxShield : 100);

        setHunger(player.hunger !== undefined ? player.hunger : 100);
        setThirst(player.thirst !== undefined ? player.thirst : 100);

        if (player.inventory) {
          const inv: Record<string, number> = {};
          player.inventory.forEach((val: number, key: string) => { inv[key] = val; });
          setInventory(inv);
        }

        if (player.seeds) {
          const sd: Record<string, number> = {};
          player.seeds.forEach((val: number, key: string) => { sd[key] = val; });
          setSeeds(sd);
        }

        if (player.skills) {
          const sk: Record<string, { level: number; xp: number }> = {};
          player.skills.forEach((s: any, name: string) => { sk[name] = { level: s.level, xp: s.xp }; });
          setSkills(sk);
        }

        if (player.skillBoosts) {
          const boosts: Record<string, number> = {};
          player.skillBoosts.forEach((val: number, key: string) => { boosts[key] = val; });
          setSkillBoosts(boosts);
        }
      }

      // Collect all players for leaderboard
      const playersList: any[] = [];
      room.state.players.forEach((p: any, sid: string) => {
        const sk: Record<string, { level: number }> = {};
        if (p.skills) p.skills.forEach((s: any, n: string) => { sk[n] = { level: s.level }; });
        playersList.push({
          sessionId: sid,
          username: p.username || "",
          totalLevel: p.totalLevel || 1,
          gold: p.gold || 0,
          gem: p.gem || 0,
          coin: p.coin || 0,
          marketSaleCount: p.marketSaleCount || 0,
          skills: sk
        });
      });
      setAllPlayers(playersList);
    };

    // Initial check
    updatePlayerState();

    // Subscribe to state change
    const onStateChangeCallback = () => {
      updatePlayerState();
    };
    room.onStateChange(onStateChangeCallback);

    return () => {
      try {
        room.onStateChange.remove(onStateChangeCallback);
      } catch (e) {}
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
      game.events.emit("editor-object-scale-changed", { id: selectedObject.id, scale: newScale, save: false });
    }
  };

  const handleObjectScaleRelease = () => {
    if (selectedObject && game) {
      console.log("[React App.tsx] Scale released, saving to server:", selectedObject.scale);
      game.events.emit("editor-object-scale-changed", { id: selectedObject.id, scale: selectedObject.scale, save: true });
    }
  };

  const handleObjectSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    if (selectedObject && game) {
      setSelectedObject({ ...selectedObject, animSpeed: newSpeed });
      game.events.emit("editor-object-speed-changed", { id: selectedObject.id, speed: newSpeed, save: false });
    }
  };

  const handleObjectSpeedRelease = () => {
    if (selectedObject && game) {
      const speed = selectedObject.animSpeed !== undefined ? selectedObject.animSpeed : 1.0;
      console.log("[React App.tsx] Speed released, saving to server:", speed);
      game.events.emit("editor-object-speed-changed", { id: selectedObject.id, speed: speed, save: true });
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
    console.log("[React App.tsx] handleObjectDelete triggered for:", selectedObject?.id);
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
    const maxRow = activeTileset === "fences" ? 17 : (activeTileset === "zemin2" ? 27 : (activeTileset === "iskele" ? 4 : (activeTileset === "dekor2" ? 12 : 23)));
    const maxCol = activeTileset === "zemin2" ? 5 : (activeTileset === "iskele" ? 9 : (activeTileset === "dekor2" ? 7 : 32));

    if (col >= 0 && col < maxCol && row >= 0 && row < maxRow) {
      setSelectionStart({ col, row });
      setSelectionEnd({ col, row });
      setIsSelectingTileset(true);
      setSelectedObject(null);
      // Immediately switch brush to tile mode on tile panel click
      // (this sets the brush type even if eraser was selected before)
      const startGid = activeTileset === "fences" ? 2000 : (activeTileset === "zemin2" ? 3000 : (activeTileset === "iskele" ? 4000 : (activeTileset === "dekor2" ? 5000 : 0)));
      const colsCount = activeTileset === "zemin2" ? 5 : (activeTileset === "iskele" ? 9 : (activeTileset === "dekor2" ? 7 : 32));
      const index = startGid + (row * colsCount + col);
      setSelectedTile(index);
      if (game) {
        game.events.emit("editor-brush-selected", { type: "tile", index });
      }
    }
  };

  const handleTilesetMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingTileset || !selectionStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const maxRow = activeTileset === "fences" ? 16 : (activeTileset === "zemin2" ? 26 : (activeTileset === "iskele" ? 3 : (activeTileset === "dekor2" ? 11 : 22)));
    const maxCol = activeTileset === "zemin2" ? 4 : (activeTileset === "iskele" ? 8 : (activeTileset === "dekor2" ? 6 : 31));
    const col = Math.max(0, Math.min(maxCol, Math.floor(clickX / 16)));
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
    const startGid = activeTileset === "fences" ? 2000 : (activeTileset === "zemin2" ? 3000 : (activeTileset === "iskele" ? 4000 : (activeTileset === "dekor2" ? 5000 : 0)));
    const colsCount = activeTileset === "zemin2" ? 5 : (activeTileset === "iskele" ? 9 : (activeTileset === "dekor2" ? 7 : 32));

    if (w === 1 && h === 1) {
      // Single tile selection
      const index = startGid + (rowStart * colsCount + colStart);
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
          rowTiles.push(startGid + (r * colsCount + c));
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

  const getProfilePlayerData = () => {
    if (!room || !selectedProfileId) return null;
    const p = room.state.players.get(selectedProfileId);
    if (!p) return null;

    const sk: Record<string, { level: number; xp: number }> = {};
    if (p.skills) {
      p.skills.forEach((s: any, name: string) => {
        sk[name] = { level: s.level, xp: s.xp };
      });
    }

    const ac: Record<string, number> = {};
    if (p.actionCounts) {
      p.actionCounts.forEach((v: number, k: string) => {
        ac[k] = v;
      });
    }

    const achs: any[] = [];
    if (p.achievements) {
      p.achievements.forEach((a: any) => {
        achs.push({
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          description: a.description,
          unlocked: !!a.unlocked,
          unlockedAt: a.unlockedAt
        });
      });
    }

    return {
      sessionId: selectedProfileId,
      username: p.username || "",
      totalLevel: p.totalLevel || 1,
      color: p.color || "#ffffff",
      skin: p.skin || "farmer_1",
      hp: p.hp !== undefined ? p.hp : 100,
      maxHp: p.maxHp !== undefined ? p.maxHp : 100,
      shield: p.shield !== undefined ? p.shield : 100,
      maxShield: p.maxShield !== undefined ? p.maxShield : 100,
      rodTier: p.rodTier !== undefined ? p.rodTier : 1,
      marketSaleCount: p.marketSaleCount || 0,
      marketSaleVolume: p.marketSaleVolume || 0,
      skills: sk,
      actionCounts: ac,
      achievements: achs
    };
  };

  const profileData = getProfilePlayerData();
  const myPlayerObj = room?.state.players.get(sessionId || "");
  const isFriendRelation = !!(myPlayerObj?.friends.has(selectedProfileId || ""));
  const hasSentFriendRequest = !!(room?.state.players.get(selectedProfileId || "")?.friendRequests.has(sessionId || ""));

  const handleAddFriend = (targetId: string) => {
    if (!room) return;
    room.send("friend-request", { targetSessionId: targetId });
  };

  const handleInstantCraft = (id: string, remainingSeconds: number) => {
    if (!room) return;
    room.send("instant-craft", { craftId: id, remainingSeconds });
  };

  const handleReportPlayer = (targetId: string, category: string) => {
    if (!room) return;
    room.send("player-report", { targetSessionId: targetId, category });
  };

  return (
    <div className="app">
      {/* ── Login Screen Gate ───────────────────────────────────────────── */}
      {!isLoggedIn && (
        <LoginScreen onLogin={(admin) => { setIsAdmin(admin); setIsLoggedIn(true); }} />
      )}

      {/* ── HUD overlay ─────────────────────────────────────────────────── */}
      <div className="hud" aria-label="HUD">
        {/* Status chip */}
        {connected && !editMode && (
          <div className="chip chip--status">
            <span className={`dot ${connected ? "dot--on" : "dot--off"}`} aria-hidden="true" />
            <span>
              {connected
                ? `Online · ${playerCount} player${playerCount !== 1 ? "s" : ""}`
                : "Connecting…"}
            </span>
          </div>
        )}

        {/* Currency chips */}
        {connected && !editMode && (
          <>
            <div className="chip" style={{ background: "rgba(241,196,15,0.2)", border: "1px solid rgba(241,196,15,0.4)", color: "#f1c40f", fontWeight: "bold" }}>
              🥇 {gold} Gold
            </div>
            <div className="chip" style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#c4b5fd", fontWeight: "bold" }}>
              💎 {gem} Gem
            </div>
            <div className="chip" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "#86efac", fontWeight: "bold" }}>
              🪙 {coin} FARM
            </div>
          </>
        )}

        {/* HUD action buttons */}
        {connected && !editMode && (
          <>
            <button className="chip chip--clickable" onClick={() => setIsMarketOpen(true)}>🛒 Market</button>
            <button className="chip chip--clickable" onClick={() => setIsLeaderboardOpen(true)}>🏆 Leaderboard</button>
            <button className="chip chip--clickable" onClick={() => setIsSettingsOpen(true)}>⚙️ Settings</button>
          </>
        )}

        {/* Edit mode toggle — only shown for admin (always visible to toggle back!) */}
        {connected && isAdmin && (
          <button
            className={`chip chip--clickable chip--edit ${editMode ? "chip--active" : ""}`}
            onClick={handleToggleEditMode}
            aria-label="Toggle Edit Mode"
          >
            <span>{editMode ? "🧱 Editörden Çık" : "🧱 Haritayı Düzenle"}</span>
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
        {sessionId && !editMode && (
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
              <div className="brush-row" style={{ display: "flex", gap: "8px" }}>
                <button
                  className={`btn btn--eraser ${selectedTile === -1 ? "btn--active" : ""}`}
                  onClick={handleSelectEraser}
                  style={{ flex: 1 }}
                >
                  🧹 Silgi (Eraser)
                </button>
                <button
                  className={`btn ${paintOnTop ? "btn--active" : ""}`}
                  onClick={() => {
                    const nextVal = !paintOnTop;
                    setPaintOnTop(nextVal);
                    if (game) game.events.emit("editor-paint-on-top-changed", nextVal);
                  }}
                  style={{ flex: 1, fontSize: "10px", backgroundColor: paintOnTop ? "#55ff22" : "", color: paintOnTop ? "#000" : "" }}
                  title="Açık olduğunda, çizdiğiniz zeminler altındaki zeminleri silmeden üst üste biner."
                >
                  Layering: {paintOnTop ? "Açık 🟢" : "Kapalı 🔴"}
                </button>
              </div>

              {/* ── Danger Zone: Clear Island ── */}
              <div className="brush-row" style={{ marginTop: "6px" }}>
                <button
                  className="btn btn--danger"
                  style={{ width: "100%", fontSize: "10px", opacity: 0.8 }}
                  title="Bu adanın tüm zemin, dekor ve objelerini siler. GERİ ALINAMAZ!"
                  onClick={() => {
                    if (window.confirm("⚠️ Bu ada (harita bölgesi) üzerindeki TÜM zemin, çit ve objeleri silmek istediğinizden emin misiniz? Bu işlem GERİ ALINAMAZ!")) {
                      if (game) {
                        game.events.emit("clear-island");
                      }
                    }
                  }}
                >
                  🗑️ Bu Adayı Tamamen Temizle
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

              {/* ── Debug Console overlay ── */}
              <div className="section-title" style={{ marginTop: "10px", color: "#ef4444" }}>Ağ & Silme Debug Konsolu</div>
              <div style={{
                background: "#0d0e12",
                color: "#4ade80",
                fontFamily: "Consolas, monospace",
                fontSize: "10px",
                padding: "8px",
                height: "120px",
                overflowY: "auto",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "6px",
                whiteSpace: "pre-wrap",
                marginBottom: "10px"
              }}>
                {debugLogs.length === 0 ? "İşlem yapıldıkça loglar burada belirecektir..." : debugLogs.join('\n')}
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
                      selectedObject.type === "rock_big" ? "Büyük Kaya" :
                      selectedObject.type === "rock_big_blue" ? "Mavi Kaya (Büyük)" :
                      selectedObject.type === "rock_big_red" ? "Kızıl Kaya (Büyük)" :
                      selectedObject.type === "rock_medium" ? "Orta Kaya" :
                      selectedObject.type === "rock_medium_gold" ? "Altın Kaya (Orta)" :
                      selectedObject.type === "rock_medium_silver" ? "Gümüş Kaya (Orta)" :
                      selectedObject.type === "rock_small" ? "Küçük Kaya" :
                      selectedObject.type === "rock_small_bronze" ? "Bronz Kaya (Küçük)" :
                      selectedObject.type === "rock_small_silver" ? "Gümüş Kaya (Küçük)" :
                      selectedObject.type === "house_barn_small" ? "Küçük Ahır (Görsel)" :
                      selectedObject.type === "house_farmer_2" ? "Çiftçi Evi 2 (Görsel)" :
                      selectedObject.type === "house_stable" ? "Harici Ahır (Görsel)" :
                      selectedObject.type === "house_oven" ? "Taş Fırın 1 (Görsel)" :
                      selectedObject.type === "table_tailor" ? "Terzi Masası (Görsel)" :
                      selectedObject.type === "table_woodwork" ? "Marangoz Masası (Görsel)" :
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
                        selectedObject.type.startsWith("silo") ||
                        selectedObject.type.startsWith("rock_") ||
                        selectedObject.type.startsWith("house_") ||
                        selectedObject.type.startsWith("table_")
                          ? "0.5"
                          : "0.05"
                      }
                      max={
                        selectedObject.type.startsWith("decor_grass_") ||
                        selectedObject.type.startsWith("decor_gorsel_") ||
                        selectedObject.type.startsWith("vfx_") ||
                        selectedObject.type.startsWith("mg_") ||
                        selectedObject.type.startsWith("silo") ||
                        selectedObject.type.startsWith("rock_") ||
                        selectedObject.type.startsWith("house_") ||
                        selectedObject.type.startsWith("table_")
                          ? "5.0"
                          : "0.50"
                      }
                      step={
                        selectedObject.type.startsWith("decor_grass_") ||
                        selectedObject.type.startsWith("decor_gorsel_") ||
                        selectedObject.type.startsWith("vfx_") ||
                        selectedObject.type.startsWith("mg_") ||
                        selectedObject.type.startsWith("silo") ||
                        selectedObject.type.startsWith("rock_") ||
                        selectedObject.type.startsWith("house_") ||
                        selectedObject.type.startsWith("table_")
                          ? "0.1"
                          : "0.01"
                      }
                      value={selectedObject.scale}
                      onChange={handleObjectScaleChange}
                      onMouseUp={handleObjectScaleRelease}
                      onTouchEnd={handleObjectScaleRelease}
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
                        onMouseUp={handleObjectSpeedRelease}
                        onTouchEnd={handleObjectSpeedRelease}
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
                  className={`tab-btn ${activeTab === "mining" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("mining")}
                  style={{ fontSize: "9px" }}
                >
                  ⛏️ Maden
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

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "yon_up" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("yon_up")}
                  >
                    <img src="/assets/yon_up.png" alt="yon up" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Yön: Yukarı</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "yon_down" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("yon_down")}
                  >
                    <img src="/assets/yon_down.png" alt="yon down" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Yön: Aşağı</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "yon_left" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("yon_left")}
                  >
                    <img src="/assets/yon_left.png" alt="yon left" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Yön: Sol</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "yon_right" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("yon_right")}
                  >
                    <img src="/assets/yon_right.png" alt="yon right" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Yön: Sağ</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "house_barn_small" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("house_barn_small")}
                  >
                    <img src="/assets/house_barn_small.png" alt="barn_small" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Küçük Ahır (Görsel)</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "house_farmer_2" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("house_farmer_2")}
                  >
                    <img src="/assets/house_farmer_2.png" alt="farmer_house_2" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Çiftçi Evi 2 (Görsel)</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "house_stable" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("house_stable")}
                  >
                    <img src="/assets/house_stable.png" alt="stable" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Harici Ahır (Görsel)</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "house_oven" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("house_oven")}
                  >
                    <img src="/assets/house_oven.png" alt="oven" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Taş Fırın (Görsel)</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "table_tailor" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("table_tailor")}
                  >
                    <img src="/assets/table_tailor.png" alt="tailor" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Terzi Masası (Görsel)</span>
                  </button>

                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "table_woodwork" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("table_woodwork")}
                  >
                    <img src="/assets/table_woodwork.png" alt="woodwork" className="obj-thumb" style={{ height: "48px", objectFit: "contain" }} />
                    <span>Marangoz Masası (Görsel)</span>
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

              {/* Tab 6: Maden (Mining Rocks) */}
              {activeTab === "mining" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                  {[
                    { id: "rock_big",            label: "Büyük Kaya" },
                    { id: "rock_big_blue",       label: "Mavi Kaya (B)" },
                    { id: "rock_big_red",        label: "Kızıl Kaya (B)" },
                    { id: "rock_medium",         label: "Orta Kaya" },
                    { id: "rock_medium_gold",    label: "Altın Kaya (O)" },
                    { id: "rock_medium_silver",  label: "Gümüş Kaya (O)" },
                    { id: "rock_small",          label: "Küçük Kaya" },
                    { id: "rock_small_bronze",   label: "Bronz Kaya (K)" },
                    { id: "rock_small_silver",   label: "Gümüş Kaya (K)" },
                  ].map(rock => (
                    <button
                      key={rock.id}
                      className={`obj-btn obj-btn--small ${selectedTile === -2 && selectedObjectName === rock.id ? "obj-btn--active" : ""}`}
                      onClick={() => handleSelectObjectBrush(rock.id)}
                    >
                      <img src={`/assets/${rock.id}.png`} alt={rock.label} className="obj-thumb obj-thumb--small" style={{ objectFit: "contain", height: "24px" }} />
                      <span style={{ fontSize: "6px" }}>{rock.label}</span>
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
                  onClick={() => setActiveTileset("terrains")}
                >
                  🏞️ Zeminler
                </button>
                <button
                  className={`tab-btn ${activeTileset === "fences" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTileset("fences")}
                >
                  🚧 Çitler (Şeffaf)
                </button>
                <button
                  className={`tab-btn ${activeTileset === "zemin2" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTileset("zemin2")}
                >
                  🧱 Zemin 2
                </button>
                <button
                  className={`tab-btn ${activeTileset === "iskele" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTileset("iskele")}
                >
                  🪵 İskele
                </button>
                <button
                  className={`tab-btn ${activeTileset === "dekor2" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTileset("dekor2")}
                >
                  🏡 Dekor 2
                </button>
              </div>

              <div className="tileset-container">
                <div
                  className="tileset-wrapper"
                  style={{
                    position: "relative",
                    width: activeTileset === "zemin2" ? "80px" : (activeTileset === "iskele" ? "144px" : (activeTileset === "dekor2" ? "112px" : "512px")),
                    height: activeTileset === "zemin2" ? "432px" : (activeTileset === "iskele" ? "64px" : (activeTileset === "dekor2" ? "192px" : (activeTileset === "fences" ? "272px" : "368px"))),
                    cursor: "pointer"
                  }}
                  onMouseDown={handleTilesetMouseDown}
                  onMouseMove={handleTilesetMouseMove}
                  onMouseUp={handleTilesetMouseUp}
                  onMouseLeave={handleTilesetMouseUp}
                >
                  <img
                    src={activeTileset === "zemin2" ? "/assets/zemin2.png" : (activeTileset === "iskele" ? "/assets/iskele.png" : (activeTileset === "dekor2" ? "/assets/dekor2.png" : (activeTileset === "fences" ? "/assets/fences.png" : "/assets/terrains.png")))}
                    alt="tileset"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      display: "block",
                      width: activeTileset === "zemin2" ? "80px" : (activeTileset === "iskele" ? "144px" : (activeTileset === "dekor2" ? "112px" : "512px")),
                      height: activeTileset === "zemin2" ? "432px" : (activeTileset === "iskele" ? "64px" : (activeTileset === "dekor2" ? "192px" : (activeTileset === "fences" ? "272px" : "368px"))),
                      imageRendering: "pixelated",
                      userSelect: "none",
                    }}
                  />
                  
                  {/* Active single selection highlighting box */}
                  {((selectedTile >= 5000 && activeTileset === "dekor2") ||
                    (selectedTile >= 4000 && selectedTile < 5000 && activeTileset === "iskele") ||
                    (selectedTile >= 3000 && selectedTile < 4000 && activeTileset === "zemin2") ||
                    (selectedTile >= 2000 && selectedTile < 3000 && activeTileset === "fences") || 
                    (selectedTile >= 0 && selectedTile < 2000 && activeTileset === "terrains")) && (
                    <div
                      className="selection-box"
                      style={{
                        position: "absolute",
                        border: "2px solid #55ff22",
                        boxShadow: "0 0 6px rgba(85, 255, 34, 0.9)",
                        width: "16px",
                        height: "16px",
                        left: `${((selectedTile >= 5000 ? selectedTile - 5000 : (selectedTile >= 4000 ? selectedTile - 4000 : (selectedTile >= 3000 ? selectedTile - 3000 : (selectedTile >= 2000 ? selectedTile - 2000 : selectedTile)))) % (activeTileset === "zemin2" ? 5 : (activeTileset === "iskele" ? 9 : (activeTileset === "dekor2" ? 7 : 32)))) * 16}px`,
                        top: `${Math.floor((selectedTile >= 5000 ? selectedTile - 5000 : (selectedTile >= 4000 ? selectedTile - 4000 : (selectedTile >= 3000 ? selectedTile - 3000 : (selectedTile >= 2000 ? selectedTile - 2000 : selectedTile)))) / (activeTileset === "zemin2" ? 5 : (activeTileset === "iskele" ? 9 : (activeTileset === "dekor2" ? 7 : 32)))) * 16}px`,
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
              {shopTab === "survival" ? (
                <>🪙 Kalan Coin: <span className="gold-amount">{coin} FARM</span></>
              ) : (
                <>💰 Kalan Altın: <span className="gold-amount">{gold} Altın</span></>
              )}
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
              <button
                className={`shop-tab-btn ${shopTab === "survival" ? "shop-tab-btn--active" : ""}`}
                onClick={() => setShopTab("survival")}
              >
                🍗 Yiyecek/Su Al
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
              ) : shopTab === "sell" ? (
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
              ) : (
                /* SURVIVAL SHOP TAB */
                <div className="shop-list">
                  <div className="shop-item">
                    <span style={{ fontSize: "28px", padding: "6px" }}>💧</span>
                    <div className="shop-item-info">
                      <span className="shop-item-name">Temiz Su</span>
                      <span className="shop-item-price">🪙 5 FARM Coin</span>
                      <span className="shop-item-stock">Susuzluğu +40 giderir. Can +10.</span>
                    </div>
                    <button
                      className="shop-action-btn shop-action-btn--buy"
                      disabled={coin < 5}
                      onClick={() => room?.send("shop-buy-item", { itemName: "Water" })}
                    >
                      Satın Al
                    </button>
                  </div>

                  <div className="shop-item">
                    <span style={{ fontSize: "28px", padding: "6px" }}>🍞</span>
                    <div className="shop-item-info">
                      <span className="shop-item-name">Taze Ekmek</span>
                      <span className="shop-item-price">🪙 8 FARM Coin</span>
                      <span className="shop-item-stock">Açlığı +50 giderir. Can +15.</span>
                    </div>
                    <button
                      className="shop-action-btn shop-action-btn--buy"
                      disabled={coin < 8}
                      onClick={() => room?.send("shop-buy-item", { itemName: "Bread" })}
                    >
                      Satın Al
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Inventory Panel ── */}
      {connected && !editMode && (
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
                fontSize: "9px",
                padding: "4px 2px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🥦 Mahsul
            </button>
            <button
              onClick={() => setInventoryTab("seeds")}
              style={{
                flex: 1,
                background: inventoryTab === "seeds" ? "rgba(74, 222, 128, 0.2)" : "rgba(255,255,255,0.05)",
                border: "1px solid " + (inventoryTab === "seeds" ? "rgba(74, 222, 128, 0.4)" : "rgba(255,255,255,0.1)"),
                borderRadius: "6px",
                color: inventoryTab === "seeds" ? "#4ade80" : "rgba(255,255,255,0.7)",
                fontSize: "9px",
                padding: "4px 2px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🌱 Tohum
            </button>
            <button
              onClick={() => setInventoryTab("survival")}
              style={{
                flex: 1,
                background: inventoryTab === "survival" ? "rgba(74, 222, 128, 0.2)" : "rgba(255,255,255,0.05)",
                border: "1px solid " + (inventoryTab === "survival" ? "rgba(74, 222, 128, 0.4)" : "rgba(255,255,255,0.1)"),
                borderRadius: "6px",
                color: inventoryTab === "survival" ? "#4ade80" : "rgba(255,255,255,0.7)",
                fontSize: "9px",
                padding: "4px 2px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🍗 Gıda/Su
            </button>
          </div>

          <div className="inventory-items">
            {inventoryTab === "crops" ? (
              // Filter out Water & Bread from general crops list
              Object.keys(inventory).filter(k => k !== "Water" && k !== "Bread").length === 0 || 
              Object.entries(inventory).filter(([k]) => k !== "Water" && k !== "Bread").every(([, qty]) => qty <= 0) ? (
                <div className="inventory-empty">Çanta boş. Ekin topla!</div>
              ) : (
                Object.entries(inventory).map(([cropName, qty]) => {
                  if (qty <= 0 || cropName === "Water" || cropName === "Bread") return null;
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
            ) : inventoryTab === "seeds" ? (
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
            ) : (
              /* SURVIVAL TAB ITEMS LIST */
              (inventory["Water"] || 0) <= 0 && (inventory["Bread"] || 0) <= 0 ? (
                <div className="inventory-empty">Yiyecek veya suyunuz yok.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                  {(inventory["Water"] || 0) > 0 && (
                    <div className="inventory-item" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span style={{ fontSize: "20px" }}>💧</span>
                      <div className="inventory-details" style={{ flex: 1, marginLeft: "10px" }}>
                        <span className="inventory-name">Temiz Su</span>
                        <span className="inventory-qty">x{inventory["Water"]}</span>
                      </div>
                      <button
                        onClick={() => room?.send("use-item", { itemName: "Water" })}
                        style={{
                          background: "rgba(34, 197, 94, 0.2)",
                          border: "1px solid rgba(34, 197, 94, 0.4)",
                          color: "#86efac",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          padding: "4px 8px",
                          cursor: "pointer"
                        }}
                      >
                        İç
                      </button>
                    </div>
                  )}

                  {(inventory["Bread"] || 0) > 0 && (
                    <div className="inventory-item" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span style={{ fontSize: "20px" }}>🍞</span>
                      <div className="inventory-details" style={{ flex: 1, marginLeft: "10px" }}>
                        <span className="inventory-name">Ekmek</span>
                        <span className="inventory-qty">x{inventory["Bread"]}</span>
                      </div>
                      <button
                        onClick={() => room?.send("use-item", { itemName: "Bread" })}
                        style={{
                          background: "rgba(34, 197, 94, 0.2)",
                          border: "1px solid rgba(34, 197, 94, 0.4)",
                          color: "#86efac",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          padding: "4px 8px",
                          cursor: "pointer"
                        }}
                      >
                        Ye
                      </button>
                    </div>
                  )}
                </div>
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
        <PhaserGame key="phaser-game-instance" room={room} sessionId={sessionId} onGameReady={setGame} />
      ) : !error ? (
        <div className="loader" aria-label="Connecting">
          <div className="spinner" aria-hidden="true" />
          <span>Connecting to server…</span>
        </div>
      ) : null}

      {/* ── Chat Panel ──────────────────────────────────────────────────── */}
      {/* ── Chat Panel ──────────────────────────────────────────────────── */}
      {room && !editMode && (
        <ChatPanel room={room} myName={myUsername || `Player_${sessionId?.slice(0,6) || "?"}`} />
      )}

      {/* ── Friends List Panel ──────────────────────────────────────────── */}
      {room && sessionId && !editMode && (
        <FriendsPanel room={room} players={allPlayers} mySessionId={sessionId} />
      )}

      {/* ── Character HUD Stats ─────────────────────────────────────────── */}
      {isLoggedIn && !editMode && (
        <CharacterStats
          hp={hp}
          maxHp={maxHp}
          shield={shield}
          maxShield={maxShield}
          hunger={hunger}
          maxHunger={100}
          thirst={thirst}
          maxThirst={100}
          username={myUsername}
          totalLevel={totalLevel}
        />
      )}

      {/* ── Guild System Panel ──────────────────────────────────────────── */}
      {room && sessionId && !editMode && (
        <GuildPanel room={room} coin={coin} mySessionId={sessionId} />
      )}

      {/* ── Craft Timer HUD ─────────────────────────────────────────────── */}
      <CraftTimer timers={craftTimers} onRemove={removeCraftTimer} onInstant={handleInstantCraft} />

      {/* ── Marketplace Modal ───────────────────────────────────────────── */}
      {isMarketOpen && room && (
        <MarketplaceModal
          room={room}
          inventory={inventory}
          seeds={seeds}
          coin={coin}
          mySessionId={sessionId || ""}
          onClose={() => setIsMarketOpen(false)}
        />
      )}

      {/* ── Settings Modal ──────────────────────────────────────────────── */}
      {isSettingsOpen && room && (
        <SettingsModal
          room={room}
          myUsername={myUsername}
          usernameSet={usernameSet}
          gem={gem}
          skills={skills}
          skillBoosts={skillBoosts}
          language={language}
          onLanguageChange={setLanguage}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* ── Leaderboard Modal ───────────────────────────────────────────── */}
      {isLeaderboardOpen && (
        <LeaderboardModal
          players={allPlayers}
          mySessionId={sessionId || ""}
          onClose={() => setIsLeaderboardOpen(false)}
          onPlayerClick={(sid) => {
            setIsLeaderboardOpen(false);
            setSelectedProfileId(sid);
          }}
        />
      )}

      {/* ── Player Profile Modal ────────────────────────────────────────── */}
      {selectedProfileId && profileData && (
        <PlayerProfileModal
          player={profileData}
          isMe={selectedProfileId === sessionId}
          isFriend={isFriendRelation}
          hasSentRequest={hasSentFriendRequest}
          onAddFriend={handleAddFriend}
          onReportPlayer={handleReportPlayer}
          onClose={() => setSelectedProfileId(null)}
        />
      )}

      {/* ── AFK Kick Overlay ────────────────────────────────────────────── */}
      {afkKickReason && (
        <div className="error-overlay" style={{ background: "rgba(10, 15, 30, 0.98)" }}>
          <span className="error-icon" style={{ fontSize: "48px" }}>💤</span>
          <strong className="error-title" style={{ fontSize: "20px", marginTop: "12px" }}>Bağlantı Kesildi</strong>
          <p className="error-body" style={{ margin: "8px 0 20px" }}>{afkKickReason}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              background: "rgba(59, 130, 246, 0.25)",
              border: "1px solid rgba(59, 130, 246, 0.45)",
              color: "#93c5fd",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "background 0.2s"
            }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(59, 130, 246, 0.4)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(59, 130, 246, 0.25)"}
          >
            Yeniden Bağlan
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
