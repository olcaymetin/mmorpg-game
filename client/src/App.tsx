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
import CharacterCreator from "./CharacterCreator";




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

const COSMETICS_LIST = [
  { key: "hair_Fawn", type: "hairStyle", value: "Fawn", label: "Fawn Saç Stili", price: 200, category: "💇 Saç" },
  { key: "hair_Iridessa", type: "hairStyle", value: "Iridessa", label: "Iridessa Saç Stili", price: 200, category: "💇 Saç" },
  { key: "hair_Josh", type: "hairStyle", value: "Josh", label: "Josh Saç Stili", price: 200, category: "💇 Saç" },
  { key: "hair_Lyria", type: "hairStyle", value: "Lyria", label: "Lyria Saç Stili", price: 200, category: "💇 Saç" },
  { key: "hair_Sebastian", type: "hairStyle", value: "Sebastian", label: "Sebastian Saç Stili", price: 200, category: "💇 Saç" },
  { key: "hair_Silvermist", type: "hairStyle", value: "Silvermist", label: "Silvermist Saç Stili", price: 200, category: "💇 Saç" },

  { key: "clothes_Blue", type: "clothesColor", value: "Blue", label: "Mavi Tulum", price: 100, category: "👕 Kıyafet" },
  { key: "clothes_Green", type: "clothesColor", value: "Green", label: "Yeşil Tulum", price: 100, category: "👕 Kıyafet" },
  { key: "clothes_Pink", type: "clothesColor", value: "Pink", label: "Pembe Tulum", price: 150, category: "👕 Kıyafet" },
  { key: "clothes_Purple", type: "clothesColor", value: "Purple", label: "Mor Tulum", price: 150, category: "👕 Kıyafet" },
  { key: "clothes_Red", type: "clothesColor", value: "Red", label: "Kırmızı Tulum", price: 100, category: "👕 Kıyafet" },

  { key: "beard_Black", type: "beardColor", value: "Black", label: "Siyah Sakal", price: 80, category: "🧔 Sakal" },
  { key: "beard_Blonde", type: "beardColor", value: "Blonde", label: "Sarı Sakal", price: 80, category: "🧔 Sakal" },
  { key: "beard_Brown", type: "beardColor", value: "Brown", label: "Kahverengi Sakal", price: 80, category: "🧔 Sakal" },
  { key: "beard_Ginger", type: "beardColor", value: "Ginger", label: "Kızıl Sakal", price: 80, category: "🧔 Sakal" },

  { key: "acc_Beret", type: "accItem", value: "Beret", label: "Ressam Beresi", price: 120, category: "👒 Aksesuar" },
  { key: "acc_Wizard", type: "accItem", value: "Wizard", label: "Büyücü Şapkası", price: 300, category: "👒 Aksesuar" },
  { key: "acc_Pirate", type: "accItem", value: "Pirate", label: "Korsan Şapkası", price: 250, category: "👒 Aksesuar" },
  { key: "acc_Farm", type: "accItem", value: "Farm", label: "Hasır Şapka", price: 80, category: "👒 Aksesuar" },
  { key: "acc_Santa_hat", type: "accItem", value: "Santa_hat", label: "Noel Baba Şapkası", price: 200, category: "👒 Aksesuar" },
  { key: "acc_Leprechaun", type: "accItem", value: "Leprechaun", label: "Leprikon Şapkası", price: 180, category: "👒 Aksesuar" },
  { key: "acc_Cook", type: "accItem", value: "Cook", label: "Aşçı Şapkası", price: 120, category: "👒 Aksesuar" },
  { key: "acc_Chicken", type: "accItem", value: "Chicken", label: "Tavuk Şapkası", price: 200, category: "👒 Aksesuar" },
  { key: "acc_Cow", type: "accItem", value: "Cow", label: "İnek Şapkası", price: 200, category: "👒 Aksesuar" },
  { key: "acc_Frog", type: "accItem", value: "Frog", label: "Kurbağa Şapkası", price: 200, category: "👒 Aksesuar" },
  { key: "acc_Deer", type: "accItem", value: "Deer", label: "Geyik Boynuzu", price: 200, category: "👒 Aksesuar" },
];

const TILESETS_CONFIG: Record<string, { startGid: number; cols: number; rows: number; width: number; height: number; url: string; label: string }> = {
  terrains: { startGid: 0, cols: 32, rows: 23, width: 512, height: 368, url: "/assets/terrains.png", label: "🌱 Çimenler" },
  fences: { startGid: 2000, cols: 32, rows: 17, width: 512, height: 272, url: "/assets/fences.png", label: "🪵 Çitler" },
  zemin2: { startGid: 3000, cols: 5, rows: 27, width: 80, height: 432, url: "/assets/zemin2.png", label: "🧱 Taş/Zemin" },
  iskele: { startGid: 4000, cols: 9, rows: 4, width: 144, height: 64, url: "/assets/iskele.png", label: "⚓ İskele" },
  dekor2: { startGid: 5000, cols: 7, rows: 12, width: 112, height: 192, url: "/assets/dekor2.png", label: "🏡 Dekorasyon" },
  spring: { startGid: 6000, cols: 24, rows: 40, width: 384, height: 640, url: "/assets/pack/tilesets/Tileset_Grass_Spring.png", label: "🌸 Bahar" },
  summer: { startGid: 7000, cols: 24, rows: 40, width: 384, height: 640, url: "/assets/pack/tilesets/Tileset_Grass_Summer.png", label: "☀️ Yaz" },
  fall: { startGid: 8000, cols: 24, rows: 40, width: 384, height: 640, url: "/assets/pack/tilesets/Tileset_Grass_Fall.png", label: "🍁 Sonbahar" },
  winter: { startGid: 9000, cols: 24, rows: 40, width: 384, height: 640, url: "/assets/pack/tilesets/Tileset_Grass_Winter.png", label: "❄️ Kış" },
  path: { startGid: 10000, cols: 24, rows: 16, width: 384, height: 256, url: "/assets/pack/tilesets/Path_tiles.png", label: "🛣️ Yollar" },
  barn: { startGid: 11000, cols: 12, rows: 15, width: 192, height: 240, url: "/assets/pack/tilesets/Barn_tileset.png", label: "🏚️ Ahır" },
  cave: { startGid: 12000, cols: 24, rows: 16, width: 384, height: 256, url: "/assets/pack/tilesets/Cave_Water_Ground_animations_tiles.png", label: "🌋 Mağara" }
};

export const EXTRA_PACK_SPRITESHEETS = [
  // Mine & Dungeon
  { key: "pack_mine_bonfire_fish", path: "/assets/pack/objects/exterior/Mine and Dungeon/bonfire Fish.png", fw: 32, fh: 32, label: "Balıklı Ateş", scale: 2.0, category: "others", sheetW: 288, sheetH: 32 },
  { key: "pack_mine_bonfire", path: "/assets/pack/objects/exterior/Mine and Dungeon/bonfire.png", fw: 32, fh: 32, label: "Kamp Ateşi", scale: 2.0, category: "others", sheetW: 96, sheetH: 32 },
  { key: "pack_mine_door", path: "/assets/pack/objects/exterior/Mine and Dungeon/Door.png", fw: 32, fh: 64, label: "Maden Kapısı", scale: 2.0, category: "others", sheetW: 128, sheetH: 64 },
  { key: "pack_mine_fire_light", path: "/assets/pack/objects/exterior/Mine and Dungeon/Fire light.png", fw: 48, fh: 48, label: "Ateş Işığı", scale: 2.0, category: "others", sheetW: 144, sheetH: 48 },
  { key: "pack_mine_lamp", path: "/assets/pack/objects/exterior/Mine and Dungeon/Lamp .png", fw: 16, fh: 16, label: "Maden Lambası", scale: 2.0, category: "others", sheetW: 48, sheetH: 16 },
  { key: "pack_mine_lava_stone", path: "/assets/pack/objects/exterior/Mine and Dungeon/Lava Stone.png", fw: 32, fh: 32, label: "Lav Taşı", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_mine_props", path: "/assets/pack/objects/exterior/Mine and Dungeon/Mine props.png", fw: 32, fh: 48, label: "Vagon/Ray", scale: 2.0, category: "others", sheetW: 64, sheetH: 240 },
  { key: "pack_mine_props_general", path: "/assets/pack/objects/exterior/Mine and Dungeon/Props Mine.png", fw: 32, fh: 48, label: "Maden Dekoru", scale: 2.0, category: "others", sheetW: 320, sheetH: 240 },
  { key: "pack_mine_statue", path: "/assets/pack/objects/exterior/Mine and Dungeon/statue.png", fw: 64, fh: 96, label: "Maden Heykeli", scale: 2.0, category: "others", sheetW: 256, sheetH: 192 },
  { key: "pack_mine_mineral_stone", path: "/assets/pack/objects/exterior/Mine and Dungeon/stone with minerals.png", fw: 16, fh: 16, label: "Cevherli Taş", scale: 2.0, category: "others", sheetW: 176, sheetH: 272 },
  { key: "pack_mine_symbols", path: "/assets/pack/objects/exterior/Mine and Dungeon/Symbols.png", fw: 16, fh: 16, label: "Maden Sembolü", scale: 2.0, category: "others", sheetW: 128, sheetH: 192 },
  { key: "pack_mine_trap_2", path: "/assets/pack/objects/exterior/Mine and Dungeon/Trap 2.png", fw: 32, fh: 32, label: "Tuzak 2", scale: 2.0, category: "others", sheetW: 128, sheetH: 96 },
  { key: "pack_mine_trap", path: "/assets/pack/objects/exterior/Mine and Dungeon/Trap.png", fw: 32, fh: 32, label: "Tuzak 1", scale: 2.0, category: "others", sheetW: 64, sheetH: 96 },
  { key: "pack_mine_web_spider", path: "/assets/pack/objects/exterior/Mine and Dungeon/web spider.png", fw: 32, fh: 32, label: "Örümcek Ağı", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_mine_wood_moss", path: "/assets/pack/objects/exterior/Mine and Dungeon/wood moss.png", fw: 16, fh: 16, label: "Yosunlu Odun", scale: 2.0, category: "others", sheetW: 48, sheetH: 32 },

  // Interior new items
  { key: "pack_int_basketball", path: "/assets/pack/objects/interior/basketball.png", fw: 16, fh: 16, label: "Basketbol", scale: 2.0, category: "playground", sheetW: 208, sheetH: 224 },
  { key: "pack_int_candle_1", path: "/assets/pack/objects/interior/Candle_1.png", fw: 16, fh: 32, label: "Mum 1", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_int_candle_2", path: "/assets/pack/objects/interior/Candle_2.png", fw: 16, fh: 32, label: "Mum 2", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_int_candle_3", path: "/assets/pack/objects/interior/Candle_3.png", fw: 16, fh: 32, label: "Mum 3", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_int_candle_4", path: "/assets/pack/objects/interior/candle_4.png", fw: 16, fh: 32, label: "Mum 4", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_int_candle_5", path: "/assets/pack/objects/interior/Candle_5.png", fw: 16, fh: 32, label: "Mum 5", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_int_candle_6", path: "/assets/pack/objects/interior/Candle_6.png", fw: 16, fh: 32, label: "Mum 6", scale: 2.0, category: "others", sheetW: 64, sheetH: 32 },
  { key: "pack_int_candle_small", path: "/assets/pack/objects/interior/candle.png", fw: 16, fh: 16, label: "Küçük Mum", scale: 2.0, category: "others", sheetW: 64, sheetH: 16 },
  { key: "pack_int_cats_furniture_new", path: "/assets/pack/objects/interior/cats_furniture.png", fw: 32, fh: 32, label: "Kedi Eşyası", scale: 2.0, category: "others", sheetW: 400, sheetH: 128 },
  { key: "pack_int_doors_windows", path: "/assets/pack/objects/interior/Doors,_windows_and_curtains.png", fw: 32, fh: 32, label: "Kapı/Pencere/Perde", scale: 2.0, category: "others", sheetW: 256, sheetH: 256 },
  { key: "pack_int_dressers", path: "/assets/pack/objects/interior/Dressers.png", fw: 32, fh: 32, label: "Şifonyer", scale: 2.0, category: "closets", sheetW: 256, sheetH: 160 },
  { key: "pack_int_hospital_wing", path: "/assets/pack/objects/interior/hospital_wing.png", fw: 32, fh: 32, label: "Hastane Eşyası", scale: 2.0, category: "others", sheetW: 320, sheetH: 128 },
  { key: "pack_int_school", path: "/assets/pack/objects/interior/School.png", fw: 32, fh: 32, label: "Okul Eşyası", scale: 2.0, category: "others", sheetW: 400, sheetH: 256 },
  { key: "pack_int_temple", path: "/assets/pack/objects/interior/Temple.png", fw: 32, fh: 32, label: "Tapınak Eşyası", scale: 2.0, category: "others", sheetW: 192, sheetH: 80 },
  { key: "pack_int_xmas", path: "/assets/pack/objects/interior/Xmas.png", fw: 32, fh: 32, label: "Yılbaşı Eşyası", scale: 2.0, category: "others", sheetW: 208, sheetH: 224 },

  // Props new items
  { key: "pack_props_clouds", path: "/assets/pack/objects/props/clouds.png", fw: 48, fh: 32, label: "Bulut", scale: 2.0, category: "others", sheetW: 144, sheetH: 96 },
  { key: "pack_props_ground_stones", path: "/assets/pack/objects/props/Ground_stones.png", fw: 16, fh: 16, label: "Yer Taşları", scale: 2.0, category: "exterior", sheetW: 128, sheetH: 48 },
  { key: "pack_props_leaf", path: "/assets/pack/objects/props/Leaf.png", fw: 16, fh: 16, label: "Yer Yaprakları", scale: 2.0, category: "exterior", sheetW: 32, sheetH: 32 },
  { key: "pack_props_shaders_winter", path: "/assets/pack/objects/props/Shaders_Winter.png", fw: 48, fh: 48, label: "Kış Gölgeleri", scale: 2.0, category: "exterior", sheetW: 144, sheetH: 192 },
  { key: "pack_props_smoke", path: "/assets/pack/objects/props/Smoke.png", fw: 32, fh: 32, label: "Duman", scale: 2.0, category: "effects", sheetW: 288, sheetH: 64 },
  { key: "pack_props_sprash", path: "/assets/pack/objects/props/Sprash.png", fw: 16, fh: 16, label: "Su Sıçraması", scale: 2.0, category: "effects", sheetW: 64, sheetH: 16 },
  { key: "pack_props_stones", path: "/assets/pack/objects/props/Stones.png", fw: 16, fh: 16, label: "Taşlar (Bahar)", scale: 2.0, category: "exterior", sheetW: 128, sheetH: 32 },
  { key: "pack_props_stones_winter", path: "/assets/pack/objects/props/Stones_.png", fw: 32, fh: 32, label: "Taşlar (Kış)", scale: 2.0, category: "exterior", sheetW: 96, sheetH: 64 },
  { key: "pack_props_stones_summer", path: "/assets/pack/objects/props/Stones_Summer.png", fw: 16, fh: 16, label: "Taşlar (Yaz)", scale: 2.0, category: "exterior", sheetW: 64, sheetH: 32 },
  { key: "pack_props_water_props", path: "/assets/pack/objects/props/Water_props.png", fw: 16, fh: 16, label: "Su Dekoru", scale: 2.0, category: "beach", sheetW: 64, sheetH: 16 },
  { key: "pack_props_water_stones", path: "/assets/pack/objects/props/water_stones.png", fw: 16, fh: 16, label: "Su Taşları", scale: 2.0, category: "beach", sheetW: 48, sheetH: 48 },
  { key: "pack_props_wood", path: "/assets/pack/objects/props/wood.png", fw: 16, fh: 16, label: "Odun", scale: 2.0, category: "exterior", sheetW: 64, sheetH: 16 },

  // Trees and Effects
  { key: "pack_tree_trunks", path: "/assets/pack/objects/Tree/TREE TRUNKS copiar.png", fw: 16, fh: 16, label: "Ağaç Kütüğü", scale: 2.0, category: "trees", sheetW: 128, sheetH: 32 },
  { key: "pack_tree_effects_leaf", path: "/assets/pack/objects/Tree/Common/Effects/Effects.png", fw: 32, fh: 48, label: "Yaprak Döküm", scale: 2.0, category: "effects", sheetW: 96, sheetH: 336 },
  { key: "pack_tree_fx_dark", path: "/assets/pack/objects/Tree/Common/Effects/FX Effects Dark Forest leafs 2.png", fw: 32, fh: 48, label: "Kara Yaprak Efekti", scale: 2.0, category: "effects", sheetW: 96, sheetH: 48 },
  { key: "pack_tree_fx_orange", path: "/assets/pack/objects/Tree/Common/Effects/FX Effects Orange Leafs Fall 2.png", fw: 32, fh: 48, label: "Sarı Yaprak Efekti", scale: 2.0, category: "effects", sheetW: 96, sheetH: 48 },
  { key: "pack_tree_fx_purple", path: "/assets/pack/objects/Tree/Common/Effects/FX Effects Pupple Leafs Fall 2.png", fw: 32, fh: 48, label: "Mor Yaprak Efekti 2", scale: 2.0, category: "effects", sheetW: 96, sheetH: 48 },
  { key: "pack_tree_fx_purple_1", path: "/assets/pack/objects/Tree/Common/Effects/FX Effects Pupple Leafs Fall.png", fw: 32, fh: 48, label: "Mor Yaprak Efekti 1", scale: 2.0, category: "effects", sheetW: 96, sheetH: 48 },
  { key: "pack_tree_fx_red", path: "/assets/pack/objects/Tree/Common/Effects/FX Effects Red Leafs Fall.png", fw: 32, fh: 48, label: "Kızıl Yaprak Efekti", scale: 2.0, category: "effects", sheetW: 96, sheetH: 48 },
  { key: "pack_tree_fx_snow", path: "/assets/pack/objects/Tree/Common/Effects/FX Effects Snow Leafs Winter 2.png", fw: 32, fh: 48, label: "Kar Yaprak Efekti", scale: 2.0, category: "effects", sheetW: 96, sheetH: 48 },
  { key: "pack_tree_old_birch", path: "/assets/pack/objects/Tree/Old/Common/Birch Tree-Sheet copiar.png", fw: 48, fh: 96, label: "Eski Huş Ağacı", scale: 2.0, category: "trees", sheetW: 480, sheetH: 96 },
  {key: "pack_tree_old_maple", path: "/assets/pack/objects/Tree/Old/Common/Maple Tree copiar.png", fw: 48, fh: 96, label: "Eski Akçaağaç", scale: 2.0, category: "trees", sheetW: 624, sheetH: 96 },
  { key: "pack_tree_old_pine", path: "/assets/pack/objects/Tree/Old/Common/Pine Tree copiar.png", fw: 48, fh: 96, label: "Eski Çam Ağacı", scale: 2.0, category: "trees", sheetW: 432, sheetH: 96 },

  // İskeleler / Docks
  { key: "pack_dock_iskele", path: "/assets/pack/objects/exterior/iskele.png", fw: 16, fh: 16, label: "Mavi İskele", scale: 2.0, category: "dock", sheetW: 144, sheetH: 64 },
  { key: "pack_dock_tahta_iskele", path: "/assets/pack/objects/exterior/tahta iskele.png", fw: 16, fh: 16, label: "Tahta İskele", scale: 2.0, category: "dock", sheetW: 208, sheetH: 144 }
];

const PACK_TREES = [
  // Birch Tree (64x96)
  { key: "pack_tree_birch_tree:0", sheetKey: "pack_tree_birch_tree", path: "/assets/pack/objects/trees/Birch_Tree.png", label: "Huş (Bahar)", fw: 64, fh: 96, col: 0, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_birch_tree:1", sheetKey: "pack_tree_birch_tree", path: "/assets/pack/objects/trees/Birch_Tree.png", label: "Huş (Sonbahar)", fw: 64, fh: 96, col: 1, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_birch_tree:2", sheetKey: "pack_tree_birch_tree", path: "/assets/pack/objects/trees/Birch_Tree.png", label: "Huş (Kış)", fw: 64, fh: 96, col: 2, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_birch_tree:3", sheetKey: "pack_tree_birch_tree", path: "/assets/pack/objects/trees/Birch_Tree.png", label: "Huş (Ölü)", fw: 64, fh: 96, col: 3, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },
  
  // Mahogany Tree (64x96)
  { key: "pack_tree_mahogany_tree:0", sheetKey: "pack_tree_mahogany_tree", path: "/assets/pack/objects/trees/Mahogany_Tree.png", label: "Maun (İlkbahar)", fw: 64, fh: 96, col: 0, row: 0, sheetW: 384, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_mahogany_tree:1", sheetKey: "pack_tree_mahogany_tree", path: "/assets/pack/objects/trees/Mahogany_Tree.png", label: "Maun (Yaz)", fw: 64, fh: 96, col: 1, row: 0, sheetW: 384, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_mahogany_tree:2", sheetKey: "pack_tree_mahogany_tree", path: "/assets/pack/objects/trees/Mahogany_Tree.png", label: "Maun (Sonbahar)", fw: 64, fh: 96, col: 2, row: 0, sheetW: 384, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_mahogany_tree:3", sheetKey: "pack_tree_mahogany_tree", path: "/assets/pack/objects/trees/Mahogany_Tree.png", label: "Maun (Kış)", fw: 64, fh: 96, col: 3, row: 0, sheetW: 384, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_mahogany_tree:4", sheetKey: "pack_tree_mahogany_tree", path: "/assets/pack/objects/trees/Mahogany_Tree.png", label: "Maun (Ölü)", fw: 64, fh: 96, col: 4, row: 0, sheetW: 384, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_mahogany_tree:5", sheetKey: "pack_tree_mahogany_tree", path: "/assets/pack/objects/trees/Mahogany_Tree.png", label: "Maun (Kütük)", fw: 64, fh: 96, col: 5, row: 0, sheetW: 384, sheetH: 96, scale: 2.0 },

  // Pine Tree (64x96)
  { key: "pack_tree_pine_tree:0", sheetKey: "pack_tree_pine_tree", path: "/assets/pack/objects/trees/Pine_Tree.png", label: "Çam (Yeşil)", fw: 64, fh: 96, col: 0, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_pine_tree:1", sheetKey: "pack_tree_pine_tree", path: "/assets/pack/objects/trees/Pine_Tree.png", label: "Çam (Mavi)", fw: 64, fh: 96, col: 1, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_pine_tree:2", sheetKey: "pack_tree_pine_tree", path: "/assets/pack/objects/trees/Pine_Tree.png", label: "Çam (Karlı)", fw: 64, fh: 96, col: 2, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },
  { key: "pack_tree_pine_tree:3", sheetKey: "pack_tree_pine_tree", path: "/assets/pack/objects/trees/Pine_Tree.png", label: "Çam (Kuru)", fw: 64, fh: 96, col: 3, row: 0, sheetW: 256, sheetH: 96, scale: 2.0 },

  // Maple Tree (56x96)
  { key: "pack_tree_maple_tree:0", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Bahar)", fw: 56, fh: 96, col: 0, row: 0, sheetW: 224, sheetH: 192, scale: 2.0 },
  { key: "pack_tree_maple_tree:1", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Yaz)", fw: 56, fh: 96, col: 1, row: 0, sheetW: 224, sheetH: 192, scale: 2.0 },
  { key: "pack_tree_maple_tree:2", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Sonbahar)", fw: 56, fh: 96, col: 2, row: 0, sheetW: 224, sheetH: 192, scale: 2.0 },
  { key: "pack_tree_maple_tree:3", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Kızıl)", fw: 56, fh: 96, col: 3, row: 0, sheetW: 224, sheetH: 192, scale: 2.0 },
  { key: "pack_tree_maple_tree:4", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Kış)", fw: 56, fh: 96, col: 0, row: 1, sheetW: 224, sheetH: 192, scale: 2.0 },
  { key: "pack_tree_maple_tree:5", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Kuru)", fw: 56, fh: 96, col: 1, row: 1, sheetW: 224, sheetH: 192, scale: 2.0 },
  { key: "pack_tree_maple_tree:6", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Kütük 1)", fw: 56, fh: 96, col: 2, row: 1, sheetW: 224, sheetH: 192, scale: 2.0 },
  { key: "pack_tree_maple_tree:7", sheetKey: "pack_tree_maple_tree", path: "/assets/pack/objects/trees/Maple_Tree.png", label: "Akçaağaç (Kütük 2)", fw: 56, fh: 96, col: 3, row: 1, sheetW: 224, sheetH: 192, scale: 2.0 },

  // Big Old Tree (128x160)
  { key: "pack_tree_big_old_tree:0", sheetKey: "pack_tree_big_old_tree", path: "/assets/pack/objects/trees/DeepForest/Big_old_Tree.png", label: "Kocaman Yaşlı Ağaç", fw: 128, fh: 160, col: 0, row: 0, sheetW: 128, sheetH: 160, scale: 1.0 },

  // Sliced bushes (48x48, 144x288, 3x6 = 18 frames)
  ...Array.from({ length: 18 }, (_, i) => ({
    key: `pack_tree_bushes:${i}`,
    sheetKey: "pack_tree_bushes",
    path: "/assets/pack/objects/trees/DeepForest/bushes.png",
    label: `Çalı #${i + 1}`,
    fw: 48,
    fh: 48,
    col: i % 3,
    row: Math.floor(i / 3),
    sheetW: 144,
    sheetH: 288,
    scale: 1.5,
  })),

  // Sliced mushrooms (32x48, 96x288, 3x6 = 18 frames)
  ...Array.from({ length: 18 }, (_, i) => ({
    key: `pack_tree_fantasy_mushroom:${i}`,
    sheetKey: "pack_tree_fantasy_mushroom",
    path: "/assets/pack/objects/trees/DeepForest/Fantasy_Mushroom.png",
    label: `Mantar #${i + 1}`,
    fw: 32,
    fh: 48,
    col: i % 3,
    row: Math.floor(i / 3),
    sheetW: 96,
    sheetH: 288,
    scale: 1.5,
  })),

  // Sliced roots (32x48, 96x240, 3x5 = 15 frames)
  ...Array.from({ length: 15 }, (_, i) => ({
    key: `pack_tree_root:${i}`,
    sheetKey: "pack_tree_root",
    path: "/assets/pack/objects/trees/DeepForest/Root.png",
    label: `Kök #${i + 1}`,
    fw: 32,
    fh: 48,
    col: i % 3,
    row: Math.floor(i / 3),
    sheetW: 96,
    sheetH: 240,
    scale: 1.5,
  })),
];

const PACK_EXTERIOR_PROPS = [
  // Bus (128x128, 896x128, 7 frames)
  ...Array.from({ length: 7 }, (_, i) => ({
    key: `pack_ext_bus:${i}`,
    sheetKey: "pack_ext_bus",
    path: "/assets/pack/objects/exterior/Bus.png",
    label: `Otobüs #${i + 1}`,
    fw: 128,
    fh: 128,
    col: i,
    row: 0,
    sheetW: 896,
    sheetH: 128,
    scale: 1.0,
  })),
  // Chest (32x32, 256x32, 8 frames)
  ...Array.from({ length: 8 }, (_, i) => ({
    key: `pack_ext_chest:${i}`,
    sheetKey: "pack_ext_chest",
    path: "/assets/pack/objects/exterior/chest.png",
    label: `Sandık #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i,
    row: 0,
    sheetW: 256,
    sheetH: 32,
    scale: 1.5,
  })),
  // Scarecrow (32x32, 256x32, 8 frames)
  ...Array.from({ length: 8 }, (_, i) => ({
    key: `pack_ext_scarescrow:${i}`,
    sheetKey: "pack_ext_scarescrow",
    path: "/assets/pack/objects/exterior/Scarescrow.png",
    label: `Korkuluk #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i,
    row: 0,
    sheetW: 256,
    sheetH: 32,
    scale: 1.5,
  })),
  // Snowman (32x32, 96x32, 3 frames)
  ...Array.from({ length: 3 }, (_, i) => ({
    key: `pack_ext_snowman:${i}`,
    sheetKey: "pack_ext_snowman",
    path: "/assets/pack/objects/exterior/Snowman.png",
    label: `Kardan Adam #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i,
    row: 0,
    sheetW: 96,
    sheetH: 32,
    scale: 1.5,
  })),
  // Water fountain (64x64, 192x128, 6 frames)
  ...Array.from({ length: 6 }, (_, i) => ({
    key: `pack_ext_water_fountain:${i}`,
    sheetKey: "pack_ext_water_fountain",
    path: "/assets/pack/objects/exterior/Water_fountain.png",
    label: `Fıskiye #${i + 1}`,
    fw: 64,
    fh: 64,
    col: i % 3,
    row: Math.floor(i / 3),
    sheetW: 192,
    sheetH: 128,
    scale: 1.5,
  })),
  // Well (64x96, 128x192, 4 frames)
  ...Array.from({ length: 4 }, (_, i) => ({
    key: `pack_ext_well_:${i}`,
    sheetKey: "pack_ext_well_",
    path: "/assets/pack/objects/exterior/Well_.png",
    label: `Kuyu #${i + 1}`,
    fw: 64,
    fh: 96,
    col: i % 2,
    row: Math.floor(i / 2),
    sheetW: 128,
    sheetH: 192,
    scale: 1.5,
  })),
  // Cotton Candy Cart (64x48)
  { key: "pack_ext_cotton_candy_cart:0", sheetKey: "pack_ext_cotton_candy_cart", path: "/assets/pack/objects/exterior/Cotton_candy_cart.png", label: "Pamuk Şeker", fw: 64, fh: 48, col: 0, row: 0, sheetW: 64, sheetH: 48, scale: 1.5 },
  // Ice cream car (96x64)
  { key: "pack_ext_ice_cream_car:0", sheetKey: "pack_ext_ice_cream_car", path: "/assets/pack/objects/exterior/ice_cream_car.png", label: "Dondurma Ar.", fw: 96, fh: 64, col: 0, row: 0, sheetW: 96, sheetH: 64, scale: 1.5 },
  // Ice cream cart (64x48)
  { key: "pack_ext_ice_cream_cart:0", sheetKey: "pack_ext_ice_cream_cart", path: "/assets/pack/objects/exterior/ice_cream_cart.png", label: "Dondurma Tez.", fw: 64, fh: 48, col: 0, row: 0, sheetW: 64, sheetH: 48, scale: 1.5 },
  // Newsstand (32x48)
  { key: "pack_ext_newsstand:0", sheetKey: "pack_ext_newsstand", path: "/assets/pack/objects/exterior/Newsstand.png", label: "Gazete Bayii", fw: 32, fh: 48, col: 0, row: 0, sheetW: 32, sheetH: 48, scale: 1.5 },
  // Picnic (96x48, 384x144, 12 frames)
  ...Array.from({ length: 12 }, (_, i) => ({
    key: `pack_ext_picnic:${i}`,
    sheetKey: "pack_ext_picnic",
    path: "/assets/pack/objects/exterior/Picnic.png",
    label: `Piknik #${i + 1}`,
    fw: 96,
    fh: 48,
    col: i % 4,
    row: Math.floor(i / 4),
    sheetW: 384,
    sheetH: 144,
    scale: 1.5,
  })),
  // Playground (96x96, 288x192, 6 frames)
  ...Array.from({ length: 6 }, (_, i) => ({
    key: `pack_ext_playground:${i}`,
    sheetKey: "pack_ext_playground",
    path: "/assets/pack/objects/exterior/Playground.png",
    label: `Oyun Parkı #${i + 1}`,
    fw: 96,
    fh: 96,
    col: i % 3,
    row: Math.floor(i / 3),
    sheetW: 288,
    sheetH: 192,
    scale: 1.5,
  })),
];

const PACK_PLAYGROUND_PROPS = [
  // Playground (96x96, 288x192, 6 frames)
  ...Array.from({ length: 6 }, (_, i) => ({
    key: `pack_ext_playground:${i}`,
    sheetKey: "pack_ext_playground",
    path: "/assets/pack/objects/exterior/Playground.png",
    label: `Park Teması #${i + 1}`,
    fw: 96,
    fh: 96,
    col: i % 3,
    row: Math.floor(i / 3),
    sheetW: 288,
    sheetH: 192,
    scale: 1.5,
  })),
  // playground_1 (64x48, 256x144, 4x3 = 12 frames)
  ...Array.from({ length: 12 }, (_, i) => ({
    key: `pack_ext_playground_1:${i}`,
    sheetKey: "pack_ext_playground_1",
    path: "/assets/pack/objects/exterior/playground_1.png",
    label: `Okul/Park #${i + 1}`,
    fw: 64,
    fh: 48,
    col: i % 4,
    row: Math.floor(i / 4),
    sheetW: 256,
    sheetH: 144,
    scale: 1.5,
  })),
];

const PACK_BEACH_PROPS = [
  // PropsWater_Summer (32x32, 160x128, 5x4 = 20 frames)
  ...Array.from({ length: 20 }, (_, i) => ({
    key: `pack_props_water_summer:${i}`,
    sheetKey: "pack_props_water_summer",
    path: "/assets/pack/objects/props/PropsWater_Summer.png",
    label: `Plaj/Yaz #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 5,
    row: Math.floor(i / 5),
    sheetW: 160,
    sheetH: 128,
    scale: 1.5,
  })),
  // Props_Water (32x32, 160x128, 5x4 = 20 frames)
  ...Array.from({ length: 20 }, (_, i) => ({
    key: `pack_props_water:${i}`,
    sheetKey: "pack_props_water",
    path: "/assets/pack/objects/props/Props_Water.png",
    label: `Su/Liman #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 5,
    row: Math.floor(i / 5),
    sheetW: 160,
    sheetH: 128,
    scale: 1.5,
  })),
  // Slices from Exterior.png for Beach towels/umbrellas/docks/boats etc.
  // Exterior.png is 512x176. Frame size 32x32.
  ...Array.from({ length: 80 }, (_, i) => ({
    key: `pack_ext_exterior_sheet:${i}`,
    sheetKey: "pack_ext_exterior_sheet",
    path: "/assets/pack/objects/exterior/Exterior.png",
    label: `Plaj/Dış #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 16,
    row: Math.floor(i / 16),
    sheetW: 512,
    sheetH: 176,
    scale: 1.5,
  })),
];

// Sliced interior beds (32x64, 384x512, 96 beds)
const PACK_BEDS = Array.from({ length: 96 }, (_, i) => ({
  key: `pack_int_beds:${i}`,
  sheetKey: "pack_int_beds",
  path: "/assets/pack/objects/interior/Beds.png",
  label: `Yatak #${i + 1}`,
  fw: 32,
  fh: 64,
  col: i % 12,
  row: Math.floor(i / 12),
  sheetW: 384,
  sheetH: 512,
  scale: 1.0,
}));

// Sliced interior chairs (16x32, 304x224, 133 chairs)
const PACK_CHAIRS = Array.from({ length: 133 }, (_, i) => ({
  key: `pack_int_chairs:${i}`,
  sheetKey: "pack_int_chairs",
  path: "/assets/pack/objects/interior/Chairs.png",
  label: `Sandalye #${i + 1}`,
  fw: 16,
  fh: 32,
  col: i % 19,
  row: Math.floor(i / 19),
  sheetW: 304,
  sheetH: 224,
  scale: 1.5,
}));

// Sliced interior closets (32x48 and 48x48, using precise layout blocks of 112px width containing 3 closets each)
const buildPackClosets = () => {
  const list = [];
  let idx = 1;
  for (let r = 0; r < 12; r++) {
    for (let b = 0; b < 6; b++) {
      const blockX = b * 112;
      const y = r * 48;
      // Closet 1 (16px closet centered in 32px frame)
      list.push({
        key: `pack_int_closet:frame_c1_${r}_${b}`,
        sheetKey: "pack_int_closet",
        path: "/assets/pack/objects/interior/Closet.png",
        label: `Dolap #${idx++}`,
        fw: 32,
        fh: 48,
        x: blockX,
        y: y,
        col: 0, // Fallback fields
        row: 0,
        sheetW: 672,
        sheetH: 576,
        scale: 1.0,
      });
      // Closet 2 (16px closet centered in 32px frame)
      list.push({
        key: `pack_int_closet:frame_c2_${r}_${b}`,
        sheetKey: "pack_int_closet",
        path: "/assets/pack/objects/interior/Closet.png",
        label: `Dolap #${idx++}`,
        fw: 32,
        fh: 48,
        x: blockX + 32,
        y: y,
        col: 0,
        row: 0,
        sheetW: 672,
        sheetH: 576,
        scale: 1.0,
      });
      // Closet 3 (32px closet centered in 48px frame)
      list.push({
        key: `pack_int_closet:frame_c3_${r}_${b}`,
        sheetKey: "pack_int_closet",
        path: "/assets/pack/objects/interior/Closet.png",
        label: `Dolap #${idx++}`,
        fw: 48,
        fh: 48,
        x: blockX + 64,
        y: y,
        col: 0,
        row: 0,
        sheetW: 672,
        sheetH: 576,
        scale: 1.0,
      });
    }
  }
  return list;
};
const PACK_CLOSETS = buildPackClosets();

// Sliced Evler (Houses)
const PACK_HOUSES = [
  { key: "pack_ext_tiny_house:0", sheetKey: "pack_ext_tiny_house", path: "/assets/pack/objects/exterior/Houses/Tiny House.png", label: "Küçük Ev", fw: 688, fh: 480, x: 0, y: 0, col: 0, row: 0, sheetW: 688, sheetH: 480, scale: 0.2 },
  { key: "pack_ext_upgrade_house:0", sheetKey: "pack_ext_upgrade_house", path: "/assets/pack/objects/exterior/Houses/Upgrade House.png", label: "Gelişmiş Ev", fw: 608, fh: 208, x: 0, y: 0, col: 0, row: 0, sheetW: 608, sheetH: 208, scale: 0.25 },
  { key: "pack_ext_dog_house:0", sheetKey: "pack_ext_dog_house", path: "/assets/pack/objects/exterior/Houses/dog house.png", label: "Köpek Kulübesi", fw: 384, fh: 288, x: 0, y: 0, col: 0, row: 0, sheetW: 384, sheetH: 288, scale: 0.25 },
  ...Array.from({ length: 8 }, (_, i) => ({
    key: `pack_ext_house_${i + 1}:0`,
    sheetKey: `pack_ext_house_${i + 1}`,
    path: `/assets/pack/objects/exterior/Houses/${i + 1}.png`,
    label: `Renkli Ev #${i + 1}`,
    fw: 128,
    fh: 112,
    x: 0,
    y: 0,
    col: 0,
    row: 0,
    sheetW: 128,
    sheetH: 112,
    scale: 0.6
  }))
];

// Sliced Tezgahlar (Workbenches)
const PACK_WORKBENCHES = [
  { key: "pack_bench_alchemy:0", sheetKey: "pack_bench_alchemy", path: "/assets/pack/objects/workbenches/Alchemy Table.png", label: "Simya Masası", fw: 32, fh: 32, col: 0, row: 0, sheetW: 96, sheetH: 32, scale: 1.2 },
  { key: "pack_bench_anvil:0", sheetKey: "pack_bench_anvil", path: "/assets/pack/objects/workbenches/Anvil.png", label: "Demirci Örsü", fw: 32, fh: 32, col: 0, row: 0, sheetW: 192, sheetH: 192, scale: 1.2 },
  { key: "pack_bench_beehive:0", sheetKey: "pack_bench_beehive", path: "/assets/pack/objects/workbenches/Beehive.png", label: "Arı Kovanı", fw: 16, fh: 32, col: 0, row: 0, sheetW: 112, sheetH: 32, scale: 1.2 },
  { key: "pack_bench_butter_churn:0", sheetKey: "pack_bench_butter_churn", path: "/assets/pack/objects/workbenches/Butter Churn.png", label: "Yayık (Tereyağ)", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 32, scale: 1.2 },
  { key: "pack_bench_cheese_press:0", sheetKey: "pack_bench_cheese_press", path: "/assets/pack/objects/workbenches/Cheese Press.png", label: "Peynir Presi", fw: 32, fh: 64, col: 0, row: 0, sheetW: 128, sheetH: 64, scale: 1.0 },
  { key: "pack_bench_fermentation_barrel:0", sheetKey: "pack_bench_fermentation_barrel", path: "/assets/pack/objects/workbenches/fermentation barrel.png", label: "Mayalama Fıçısı", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 32, scale: 1.2 },
  { key: "pack_bench_furnace:0", sheetKey: "pack_bench_furnace", path: "/assets/pack/objects/workbenches/Furnace.png", label: "Eritme Fırını", fw: 32, fh: 32, col: 0, row: 0, sheetW: 160, sheetH: 32, scale: 1.2 },
  { key: "pack_bench_jam_maker:0", sheetKey: "pack_bench_jam_maker", path: "/assets/pack/objects/workbenches/Jam Maker.png", label: "Reçel Yapıcı", fw: 32, fh: 64, col: 0, row: 0, sheetW: 128, sheetH: 64, scale: 1.0 },
  { key: "pack_bench_kitchen_pot:0", sheetKey: "pack_bench_kitchen_pot", path: "/assets/pack/objects/workbenches/Kitchen pot.png", label: "Yemek Kazanı", fw: 32, fh: 32, col: 0, row: 0, sheetW: 160, sheetH: 32, scale: 1.2 },
  { key: "pack_bench_sawmill:0", sheetKey: "pack_bench_sawmill", path: "/assets/pack/objects/workbenches/Sawmill.png", label: "Hızar Tezgahı", fw: 16, fh: 16, col: 0, row: 0, sheetW: 32, sheetH: 16, scale: 1.5 },
  { key: "pack_bench_sharpening_station:0", sheetKey: "pack_bench_sharpening_station", path: "/assets/pack/objects/workbenches/Sharpening Station.png", label: "Bileme Taşı", fw: 16, fh: 16, col: 0, row: 0, sheetW: 32, sheetH: 16, scale: 1.5 },
  { key: "pack_bench_tear:0", sheetKey: "pack_bench_tear", path: "/assets/pack/objects/workbenches/Tear.png", label: "Dokuma Tezgahı", fw: 32, fh: 32, col: 0, row: 0, sheetW: 256, sheetH: 32, scale: 1.2 },
  { key: "pack_bench_workbench:0", sheetKey: "pack_bench_workbench", path: "/assets/pack/objects/workbenches/Workbench.png", label: "Çalışma Masası", fw: 32, fh: 32, col: 0, row: 0, sheetW: 32, sheetH: 32, scale: 1.2 }
];

// Sliced Çitler ve Köprüler (Fence & Bridge)
const PACK_FENCES_BRIDGES = [
  { key: "pack_ext_bridge_beach:0", sheetKey: "pack_ext_bridge_beach", path: "/assets/pack/objects/exterior/FenceAndBridge/Bridge Beach.png", label: "Kumsal Köprü", fw: 128, fh: 224, col: 0, row: 0, sheetW: 128, sheetH: 224, scale: 0.5 },
  { key: "pack_ext_bridge:0", sheetKey: "pack_ext_bridge", path: "/assets/pack/objects/exterior/FenceAndBridge/Bridge.png", label: "Tahta Köprü", fw: 128, fh: 128, col: 0, row: 0, sheetW: 128, sheetH: 128, scale: 0.5 },
  { key: "pack_ext_fence_iron:0", sheetKey: "pack_ext_fence_iron", path: "/assets/pack/objects/exterior/FenceAndBridge/Fence Iron.png", label: "Demir Çit", fw: 48, fh: 96, col: 0, row: 0, sheetW: 48, sheetH: 96, scale: 0.8 },
  { key: "pack_ext_fence_stone:0", sheetKey: "pack_ext_fence_stone", path: "/assets/pack/objects/exterior/FenceAndBridge/Fence Stone.png", label: "Taş Çit", fw: 48, fh: 80, col: 0, row: 0, sheetW: 48, sheetH: 80, scale: 0.8 },
  { key: "pack_ext_fence_wood:0", sheetKey: "pack_ext_fence_wood", path: "/assets/pack/objects/exterior/FenceAndBridge/Fence Wood.png", label: "Tahta Çit", fw: 96, fh: 160, col: 0, row: 0, sheetW: 96, sheetH: 160, scale: 0.8 },
  { key: "pack_ext_white_fence:0", sheetKey: "pack_ext_white_fence", path: "/assets/pack/objects/exterior/FenceAndBridge/White Fence.png", label: "Beyaz Çit", fw: 80, fh: 80, col: 0, row: 0, sheetW: 80, sheetH: 80, scale: 0.8 }
];

// Sliced Hayvanlar (Animals)
const PACK_ANIMALS = [
  // Chickens
  { key: "pack_animal_chicken_black:0", sheetKey: "pack_animal_chicken_black", path: "/assets/pack/animals/Farm/Chicken/Chicken Black.png", label: "Kara Tavuk", fw: 16, fh: 16, col: 0, row: 0, sheetW: 64, sheetH: 112, scale: 1.8 },
  { key: "pack_animal_chicken_evil:0", sheetKey: "pack_animal_chicken_evil", path: "/assets/pack/animals/Farm/Chicken/Chicken Evil.png", label: "Şeytani Tavuk", fw: 16, fh: 16, col: 0, row: 0, sheetW: 64, sheetH: 112, scale: 1.8 },
  { key: "pack_animal_chicken_white:0", sheetKey: "pack_animal_chicken_white", path: "/assets/pack/animals/Farm/Chicken/Chicken White.png", label: "Ak Tavuk", fw: 16, fh: 16, col: 0, row: 0, sheetW: 64, sheetH: 112, scale: 1.8 },
  { key: "pack_animal_chicken_baby:0", sheetKey: "pack_animal_chicken_baby", path: "/assets/pack/animals/Farm/Chicken/Baby Chicken Yellow.png", label: "Sarı Civciv", fw: 16, fh: 16, col: 0, row: 0, sheetW: 64, sheetH: 112, scale: 1.5 },
  // Cows
  { key: "pack_animal_cow_common_f:0", sheetKey: "pack_animal_cow_common_f", path: "/assets/pack/animals/Farm/Cow/Common Cow/Female Cow Black.png", label: "İnek (Siyah)", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 288, scale: 1.3 },
  { key: "pack_animal_cow_common_m:0", sheetKey: "pack_animal_cow_common_m", path: "/assets/pack/animals/Farm/Cow/Common Cow/Male Cow Brown.png", label: "Boğa (Kahve)", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 288, scale: 1.3 },
  { key: "pack_animal_cow_baby:0", sheetKey: "pack_animal_cow_baby", path: "/assets/pack/animals/Farm/Cow/Common Cow/Baby Cow Blonde.png", label: "Benekli Buzağı", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 288, scale: 1.1 },
  // Sheep & Pig & Goat & Duck
  { key: "pack_animal_sheep_f:0", sheetKey: "pack_animal_sheep_f", path: "/assets/pack/animals/Farm/Sheep/Sheep Female.png", label: "Koyun", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 288, scale: 1.3 },
  { key: "pack_animal_sheep_m:0", sheetKey: "pack_animal_sheep_m", path: "/assets/pack/animals/Farm/Sheep/Sheep Male.png", label: "Koç", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 288, scale: 1.3 },
  { key: "pack_animal_pig_pink:0", sheetKey: "pack_animal_pig_pink", path: "/assets/pack/animals/Farm/Pig/Pig Pink.png", label: "Domuz", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 288, scale: 1.3 },
  { key: "pack_animal_pig_mud:0", sheetKey: "pack_animal_pig_mud", path: "/assets/pack/animals/Farm/Pig/Pig Mud Pink.png", label: "Çamurlu Domuz", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 288, scale: 1.3 },
  { key: "pack_animal_goat_f:0", sheetKey: "pack_animal_goat_f", path: "/assets/pack/animals/Farm/Goat/Goat Female Blonde.png", label: "Keçi", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 320, scale: 1.3 },
  { key: "pack_animal_duck_mallad:0", sheetKey: "pack_animal_duck_mallad", path: "/assets/pack/animals/Farm/Ducks/Duck Mallad.png", label: "Ördek", fw: 16, fh: 16, col: 0, row: 0, sheetW: 64, sheetH: 224, scale: 1.8 },
  // Pets
  { key: "pack_animal_cat_black:0", sheetKey: "pack_animal_cat_black", path: "/assets/pack/animals/Pets/Cats/1/Black.png", label: "Kedi (Siyah)", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 416, scale: 1.3 },
  { key: "pack_animal_cat_ginger:0", sheetKey: "pack_animal_cat_ginger", path: "/assets/pack/animals/Pets/Cats/1/Ginger.png", label: "Kedi (Tekir)", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 416, scale: 1.3 },
  { key: "pack_animal_dog_1:0", sheetKey: "pack_animal_dog_1", path: "/assets/pack/animals/Pets/Dogs/Premade/1/1.png", label: "Köpek", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 384, scale: 1.3 },
  // Forest
  { key: "pack_animal_capybara:0", sheetKey: "pack_animal_capybara", path: "/assets/pack/animals/Forest/Capybara/Brown Capybara.png", label: "Kapibara", fw: 32, fh: 32, col: 0, row: 0, sheetW: 128, sheetH: 544, scale: 1.3 }
];

// Sliced interior tables (32x32, 512x384, 192 tables) & Sofas (32x32, 320x192, 60 sofas)
const PACK_TABLES_SOFAS = [
  ...Array.from({ length: 192 }, (_, i) => ({
    key: `pack_int_tables_and_desks:${i}`,
    sheetKey: "pack_int_tables_and_desks",
    path: "/assets/pack/objects/interior/Tables_and_desks.png",
    label: `Masa #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 16,
    row: Math.floor(i / 16),
    sheetW: 512,
    sheetH: 384,
    scale: 1.0,
  })),
  ...Array.from({ length: 60 }, (_, i) => ({
    key: `pack_int_sofa_and_armchair:${i}`,
    sheetKey: "pack_int_sofa_and_armchair",
    path: "/assets/pack/objects/interior/Sofa_and_armchair.png",
    label: `Koltuk #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 10,
    row: Math.floor(i / 10),
    sheetW: 320,
    sheetH: 192,
    scale: 1.0,
  })),
];

// Sliced other interior items (Blacksmith, Xmas, School, Temple, Cats, Fireplace)
const PACK_INTERIOR_OTHERS = [
  // Fireplace (32x64, 256x256, 32 items)
  ...Array.from({ length: 32 }, (_, i) => ({
    key: `pack_int_fireplace:${i}`,
    sheetKey: "pack_int_fireplace",
    path: "/assets/pack/objects/interior/Fireplace.png",
    label: `Şömine #${i + 1}`,
    fw: 32,
    fh: 64,
    col: i % 8,
    row: Math.floor(i / 8),
    sheetW: 256,
    sheetH: 256,
    scale: 1.0,
  })),
  // Xmas (32x48, 208x224, 24 items)
  ...Array.from({ length: 24 }, (_, i) => ({
    key: `pack_int_xmas:${i}`,
    sheetKey: "pack_int_xmas",
    path: "/assets/pack/objects/interior/Xmas.png",
    label: `Yılbaşı #${i + 1}`,
    fw: 32,
    fh: 48,
    col: i % 6,
    row: Math.floor(i / 6),
    sheetW: 208,
    sheetH: 224,
    scale: 1.0,
  })),
  // Cats Furniture (32x32, 400x128, 48 items)
  ...Array.from({ length: 48 }, (_, i) => ({
    key: `pack_int_cats_furniture:${i}`,
    sheetKey: "pack_int_cats_furniture",
    path: "/assets/pack/objects/interior/cats_furniture.png",
    label: `Kedi Eşyası #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 12,
    row: Math.floor(i / 12),
    sheetW: 400,
    sheetH: 128,
    scale: 1.0,
  })),
  // Blacksmith (64x48, 256x96, 8 items)
  ...Array.from({ length: 8 }, (_, i) => ({
    key: `pack_int_blacksmith:${i}`,
    sheetKey: "pack_int_blacksmith",
    path: "/assets/pack/objects/interior/Blacksmith.png",
    label: `Demirhane #${i + 1}`,
    fw: 64,
    fh: 48,
    col: i % 4,
    row: Math.floor(i / 4),
    sheetW: 256,
    sheetH: 96,
    scale: 1.0,
  })),
  // Temple (32x32, 192x80, 12 items)
  ...Array.from({ length: 12 }, (_, i) => ({
    key: `pack_int_temple:${i}`,
    sheetKey: "pack_int_temple",
    path: "/assets/pack/objects/interior/Temple.png",
    label: `Tapınak #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 6,
    row: Math.floor(i / 6),
    sheetW: 192,
    sheetH: 80,
    scale: 1.0,
  })),
  // School (32x32, 400x256, 96 items)
  ...Array.from({ length: 96 }, (_, i) => ({
    key: `pack_int_school:${i}`,
    sheetKey: "pack_int_school",
    path: "/assets/pack/objects/interior/School.png",
    label: `Okul #${i + 1}`,
    fw: 32,
    fh: 32,
    col: i % 12,
    row: Math.floor(i / 12),
    sheetW: 400,
    sheetH: 256,
    scale: 1.0,
  })),
];

const EQUIP_TIERS = [
  { id: "1._Wood", label: "Tahta", color: "#8B5A2B" },
  { id: "2._Cooper", label: "Bakır", color: "#D2691E" },
  { id: "3._Iron", label: "Demir", color: "#A9A9A9" },
  { id: "4._Gold", label: "Altın", color: "#FFD700" },
  { id: "5._Platinum", label: "Platin", color: "#E5E4E2" },
  { id: "6._Crimson", label: "Kızıl", color: "#DC143C" },
  { id: "7._Frost", label: "Buz", color: "#00FFFF" },
  { id: "8._Shadow", label: "Gölge", color: "#4B0082" },
  { id: "9._Fairy", label: "Peri", color: "#FF69B4" },
  { id: "9._Obsidian", label: "Obsidyen", color: "#800080" }
];

const EQUIP_WEAPONS = [
  { name: "Sword", label: "Kılıç", icon: "Sword.png", desc: "Saldırı gücünü artırır" },
  { name: "Bow", label: "Yay", icon: "Bow.png", desc: "Menzilli saldırı gücü" },
  { name: "Staff", label: "Asa", icon: "Staff.png", desc: "Büyü saldırı gücü" }
];

const EQUIP_ARMORS = [
  { name: "Helmet", slot: "helmet", label: "Kask", icon: "Helmet.png", desc: "Kalkan koruması sağlar" },
  { name: "Chestplate", slot: "chestplate", label: "Zırh", icon: "Chestplate.png", desc: "Yüksek kalkan koruması" },
  { name: "Leggings", slot: "leggings", label: "Pantolon", icon: "Leggings.png", desc: "Orta kalkan koruması" },
  { name: "Boots", slot: "boots", label: "Botlar", icon: "Boots.png", desc: "Kalkan ve hafif koruma" }
];

const EQUIP_TOOLS = [
  { name: "Axe", label: "Balta", icon: "Axe.png", desc: "Ağaç kesmek için kullanılır" },
  { name: "Pickaxe", label: "Kazma", icon: "Pickaxe.png", desc: "Maden kazmak için kullanılır" },
  { name: "Shovel", label: "Kürek", icon: "Shovel.png", desc: "Toprak kazmak için kullanılır" },
  { name: "Sickle", label: "Orak", icon: "Sickle.png", desc: "Ekin biçmek için kullanılır" },
  { name: "Fishing_Rod", label: "Olta", icon: "Fishing_Rod.png", desc: "Balık tutmak için kullanılır" },
  { name: "Watering_can", label: "Sulama Bidonu", icon: "Watering_can.png", desc: "Ekinleri sulamak için kullanılır" }
];

const COSMETIC_HATS = [
  { id: "Beret", label: "Bere" },
  { id: "Chicken", label: "Tavuk Şapkası" },
  { id: "Cook", label: "Aşçı Şapkası" },
  { id: "Cow", label: "İnek Şapkası" },
  { id: "Deer", label: "Geyik Şapkası" },
  { id: "Farm", label: "Çiftçi Şapkası" },
  { id: "Frog", label: "Kurbağa Şapkası" },
  { id: "Leprechaun", label: "Cüce Şapkası" },
  { id: "pirate_eye_patch", label: "Korsan Göz Bandı" },
  { id: "Pirate", label: "Korsan Şapkası" },
  { id: "Santa_hat", label: "Noel Baba Şapkası" },
  { id: "Wizard", label: "Büyücü Şapkası" }
];

const getAttackBonus = (key: string) => {
  if (!key) return 0;
  const parts = key.split(":");
  const tier = parts[0];
  if (tier.includes("Wood")) return 5;
  if (tier.includes("Cooper")) return 12;
  if (tier.includes("Iron")) return 25;
  if (tier.includes("Gold")) return 50;
  if (tier.includes("Platinum")) return 75;
  if (tier.includes("Crimson")) return 110;
  if (tier.includes("Frost")) return 150;
  if (tier.includes("Shadow")) return 200;
  if (tier.includes("Fairy")) return 270;
  if (tier.includes("Obsidian")) return 380;
  return 0;
};

const getShieldBonus = (key: string) => {
  if (!key) return 0;
  const parts = key.split(":");
  const tier = parts[0];
  if (tier.includes("Wood")) return 10;
  if (tier.includes("Cooper")) return 25;
  if (tier.includes("Iron")) return 50;
  if (tier.includes("Gold")) return 100;
  if (tier.includes("Platinum")) return 150;
  if (tier.includes("Crimson")) return 220;
  if (tier.includes("Frost")) return 300;
  if (tier.includes("Shadow")) return 400;
  if (tier.includes("Fairy")) return 550;
  if (tier.includes("Obsidian")) return 800;
  return 0;
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
  const [shopTab, setShopTab] = useState<"buy" | "sell" | "survival" | "cosmetics">("buy");
  const [ownedCosmetics, setOwnedCosmetics] = useState<Record<string, boolean>>({});
  const [myAppearance, setMyAppearance] = useState({
    gender: "male",
    skinTone: "1",
    hairStyle: "Standard",
    hairColor: "Black",
    eyeColor: "Black",
    clothesColor: "",
    beardColor: "",
    accItem: "",
  });

  // Inventory UI tabs: "crops" (mahsuller), "seeds" (tohumlar), "survival" (yiyecek/su), or "tools" (araçlar)
  const [inventoryTab, setInventoryTab] = useState<"crops" | "seeds" | "survival" | "tools">("crops");
  const [selectedInventoryTool, setSelectedInventoryTool] = useState<string | null>(null);

  // Survival
  const [hunger, setHunger] = useState(100);
  const [thirst, setThirst] = useState(100);

  // AFK Kick status
  const [afkKickReason, setAfkKickReason] = useState("");

  const [activeTab, setActiveTab] = useState<"structures" | "decorations" | "effects" | "materials" | "seeds" | "mining" | "ahir">("structures");
  const [decorCategory, setDecorCategory] = useState<"trees" | "exterior" | "beds" | "chairs" | "tables" | "closets" | "others" | "playground" | "beach" | "houses" | "workbenches" | "fences" | "animals" | "custom" | "dock">("trees");

  // Equipment states
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);
  const [equipCategory, setEquipCategory] = useState<"weapons" | "armors" | "tools" | "hats">("weapons");
  const [equippedHelmet, setEquippedHelmet] = useState("");
  const [equippedChestplate, setEquippedChestplate] = useState("");
  const [equippedLeggings, setEquippedLeggings] = useState("");
  const [equippedBoots, setEquippedBoots] = useState("");
  const [equippedWeapon, setEquippedWeapon] = useState("");
  const [mountType, setMountType] = useState("none");
  // isRiding removed
  const [customAssetFile, setCustomAssetFile] = useState<File | null>(null);
  const [customAssetLabel, setCustomAssetLabel] = useState("");
  const [customAssetFw, setCustomAssetFw] = useState(32);
  const [customAssetFh, setCustomAssetFh] = useState(32);
  const [customAssetScale, setCustomAssetScale] = useState(1.0);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);

  // Selection box start/end for multi-tile selection
  const [selectionStart, setSelectionStart] = useState<{ col: number; row: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ col: number; row: number } | null>(null);
  const [isSelectingTileset, setIsSelectingTileset] = useState(false);

  // Active tileset tab (terrains or fences)
  const [activeTileset, setActiveTileset] = useState<keyof typeof TILESETS_CONFIG>("terrains");
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
  const [characterCreated, setCharacterCreated] = useState(true); // default true to avoid flicker on initial load
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

  // Auto-backup to localStorage every 20 seconds
  useEffect(() => {
    if (!game) return;
    const interval = setInterval(() => {
      try {
        const scene = game.scene.keys.GameScene as any;
        if (scene) {
          const json = scene.getExportJSON();
          localStorage.setItem("mmorpg_map_backup_auto", json);
        }
      } catch (e) {
        console.error("Auto-backup failed", e);
      }
    }, 20000);
    return () => clearInterval(interval);
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
        setCharacterCreated(player.characterCreated === undefined ? true : player.characterCreated);
        setTotalLevel(player.totalLevel || 1);

        // Sync cosmetics
        if (player.ownedCosmetics) {
          const cosmetics: Record<string, boolean> = {};
          player.ownedCosmetics.forEach((val: boolean, key: string) => { cosmetics[key] = val; });
          setOwnedCosmetics(cosmetics);
        }
        setMyAppearance({
          gender: player.gender || "male",
          skinTone: player.skinTone || "1",
          hairStyle: player.hairStyle || "Standard",
          hairColor: player.hairColor || "Black",
          eyeColor: player.eyeColor || "Black",
          clothesColor: player.clothesColor || "",
          beardColor: player.beardColor || "",
          accItem: player.accItem || "",
        });

        setEquippedHelmet(player.equippedHelmet || "");
        setEquippedChestplate(player.equippedChestplate || "");
        setEquippedLeggings(player.equippedLeggings || "");
        setEquippedBoots(player.equippedBoots || "");
        setEquippedWeapon(player.equippedWeapon || "");
        setMountType(player.mountType || "none");
        // isRiding sync removed

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



  const handleSelectEraser = () => {
    setSelectedTile(-1);
    setSelectedObject(null);
    if (game) {
      game.events.emit("editor-brush-selected", { type: "eraser" });
    }
  };

  const renderSlicedButton = (item: any) => {
    const fw = item.fw;
    const fh = item.fh;
    const x = item.x !== undefined ? item.x : item.col * fw;
    const y = item.y !== undefined ? item.y : item.row * fh;
    
    const maxThumbSize = 40;
    const ratio = Math.min(maxThumbSize / fw, maxThumbSize / fh, 1.0);
    const displayW = Math.round(fw * ratio);
    const displayH = Math.round(fh * ratio);
    const bgSizeW = Math.round(item.sheetW * ratio);
    const bgSizeH = Math.round(item.sheetH * ratio);
    const bgPosX = -Math.round(x * ratio);
    const bgPosY = -Math.round(y * ratio);

    return (
      <button
        key={item.key}
        className={`obj-btn ${selectedTile === -2 && selectedObjectName === item.key ? "obj-btn--active" : ""}`}
        onClick={() => handleSelectObjectBrush(item.key)}
        style={{ padding: "6px 2px", display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div
          style={{
            width: `${displayW}px`,
            height: `${displayH}px`,
            backgroundImage: `url(${item.path})`,
            backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
            backgroundPosition: `${bgPosX}px ${bgPosY}px`,
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
            margin: "0 auto 4px"
          }}
        />
        <span style={{ fontSize: "8px", textAlign: "center", display: "block", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.label}
        </span>
      </button>
    );
  };

  const renderExtraCategory = (categoryName: string) => {
    const list: any[] = [];
    EXTRA_PACK_SPRITESHEETS.forEach(sheet => {
      if (sheet.category !== categoryName) return;
      const cols = Math.floor(sheet.sheetW / sheet.fw) || 1;
      const rows = Math.floor(sheet.sheetH / sheet.fh) || 1;
      const total = cols * rows;
      for (let i = 0; i < total; i++) {
        list.push({
          key: `${sheet.key}:${i}`,
          sheetKey: sheet.key,
          path: sheet.path,
          label: `${sheet.label} #${i + 1}`,
          fw: sheet.fw,
          fh: sheet.fh,
          col: i % cols,
          row: Math.floor(i / cols),
          sheetW: sheet.sheetW,
          sheetH: sheet.sheetH,
          scale: sheet.scale
        });
      }
    });
    return list.map(renderSlicedButton);
  };

  const handleSelectObjectBrush = (name: string) => {
    setSelectedTile(-2);
    setSelectedObjectName(name);
    setSelectedObject(null);
    if (game) {
      game.events.emit("editor-brush-selected", { type: "object", name });
    }
  };

  const getTabBtnStyle = (tabName: "structures" | "decorations" | "effects" | "materials" | "seeds" | "mining" | "ahir") => {
    const isActive = activeTab === tabName;
    return {
      flex: "1 1 auto",
      textAlign: "center" as const,
      background: isActive ? "rgba(74, 222, 128, 0.15)" : "rgba(255, 255, 255, 0.03)",
      border: isActive ? "1px solid rgba(74, 222, 128, 0.35)" : "1px solid rgba(255, 255, 255, 0.05)",
      color: isActive ? "#4ade80" : "rgba(255, 255, 255, 0.6)",
      fontFamily: '"Courier New", monospace',
      fontWeight: "bold" as const,
      fontSize: tabName === "structures" || tabName === "decorations" || tabName === "effects" ? "10px" : "9px",
      padding: "6px 8px",
      cursor: "pointer",
      borderRadius: "4px",
      transition: "all 0.15s ease",
      textShadow: isActive ? "0 0 5px rgba(74, 222, 128, 0.4)" : "none",
    };
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
    setSelectedInventoryTool(null);
    if (game) {
      game.events.emit("play-tool-selected", { tool: null });
    }
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
    const config = TILESETS_CONFIG[activeTileset];
    const maxRow = config.rows;
    const maxCol = config.cols;

    if (col >= 0 && col < maxCol && row >= 0 && row < maxRow) {
      setSelectionStart({ col, row });
      setSelectionEnd({ col, row });
      setIsSelectingTileset(true);
      setSelectedObject(null);
      
      const startGid = config.startGid;
      const colsCount = config.cols;
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

    const config = TILESETS_CONFIG[activeTileset];
    const maxRow = config.rows - 1;
    const maxCol = config.cols - 1;
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
    const config = TILESETS_CONFIG[activeTileset];
    const startGid = config.startGid;
    const colsCount = config.cols;

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

  const handleUploadCustomAsset = async () => {
    if (!customAssetFile) {
      alert("Lütfen bir resim dosyası seçin!");
      return;
    }
    if (!customAssetLabel.trim()) {
      alert("Lütfen obje için bir isim girin!");
      return;
    }
    
    setIsUploadingAsset(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        if (!base64Data) {
          alert("Dosya okunamadı.");
          setIsUploadingAsset(false);
          return;
        }
        
        const img = new Image();
        img.onload = async () => {
          try {
            const response = await fetch("/api/upload-asset", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                name: customAssetLabel,
                base64Data: base64Data
              })
            });
            
            const resData = await response.json();
            if (!response.ok || !resData.url) {
              throw new Error(resData.error || "Yükleme hatası!");
            }
            
            const uniqueKey = `custom_${Date.now()}`;
            room?.send("add-custom-asset", {
              key: uniqueKey,
              path: resData.url,
              label: customAssetLabel,
              fw: customAssetFw,
              fh: customAssetFh,
              scale: customAssetScale,
              width: img.width,
              height: img.height
            });
            
            alert(`🎉 '${customAssetLabel}' başarıyla yüklendi ve oyuna eklendi!`);
            setCustomAssetFile(null);
            setCustomAssetLabel("");
            setIsUploadingAsset(false);
          } catch (uploadErr: any) {
            console.error(uploadErr);
            alert(`⚠️ Yükleme Hatası: ${uploadErr.message}`);
            setIsUploadingAsset(false);
          }
        };
        img.onerror = () => {
          alert("Resim yüklenemedi. Formatı bozuk olabilir.");
          setIsUploadingAsset(false);
        };
        img.src = base64Data;
      };
      reader.readAsDataURL(customAssetFile);
    } catch (err: any) {
      console.error(err);
      alert(`⚠️ Hata: ${err.message}`);
      setIsUploadingAsset(false);
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
            <button className="chip chip--clickable" onClick={() => setIsEquipmentOpen(true)} style={{ background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.4)", color: "#93c5fd" }}>👤 Karakter</button>
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

              <div className="section-title">Harita Kaydet / Yükle</div>
              <div className="brush-row" style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn--secondary" onClick={handleExportMap} style={{ flex: 1, fontSize: "10px" }}>
                  💾 Dışa Aktar (JSON)
                </button>
                <button className="btn btn--secondary" onClick={handleImportMapClick} style={{ flex: 1, fontSize: "10px" }}>
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
              <div className="brush-row" style={{ marginTop: "6px" }}>
                <button
                  className="btn btn--secondary"
                  onClick={() => {
                    const backup = localStorage.getItem("mmorpg_map_backup_auto");
                    if (backup) {
                      if (window.confirm("⚠️ Son 20 saniye içinde tarayıcınıza kaydedilmiş otomatik yedeği haritaya yüklemek istediğinizden emin misiniz?")) {
                        const scene = game?.scene.keys.GameScene as any;
                        if (scene && scene.importJSON(backup)) {
                          alert("Yerel yedek başarıyla haritaya yüklendi!");
                        }
                      }
                    } else {
                      alert("Henüz oluşturulmuş otomatik bir yedek bulunamadı. Lütfen bir süre düzenleme yapın.");
                    }
                  }}
                  style={{ width: "100%", fontSize: "10px", backgroundColor: "#3b82f6", color: "#fff" }}
                  title="Son yaptığınız değişikliklerin tarayıcıdaki otomatik yedeğini geri yükler."
                >
                  🔄 Yerel Yedekten Yükle
                </button>
              </div>

              <div className="section-title" style={{ marginTop: "12px" }}>Özel Obje / Fotoğraf Yükle</div>
              <div style={{ padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "8px", color: "rgba(255,255,255,0.6)", marginBottom: "2px" }}>Görsel Seç (.png, .jpg):</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCustomAssetFile(file);
                      if (file && !customAssetLabel) {
                        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        setCustomAssetLabel(baseName);
                      }
                    }}
                    style={{ fontSize: "9px", width: "100%", color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "8px", color: "rgba(255,255,255,0.6)", marginBottom: "2px" }}>Obje İsmi:</label>
                  <input
                    type="text"
                    placeholder="Örn: BenimMasam"
                    value={customAssetLabel}
                    onChange={(e) => setCustomAssetLabel(e.target.value)}
                    style={{ fontSize: "9px", width: "100%", color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "8px", color: "rgba(255,255,255,0.6)", marginBottom: "2px" }}>Görsel Dilim Genişliği (W):</label>
                    <input
                      type="number"
                      value={customAssetFw}
                      onChange={(e) => setCustomAssetFw(Math.max(1, parseInt(e.target.value) || 32))}
                      style={{ fontSize: "9px", width: "100%", color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "8px", color: "rgba(255,255,255,0.6)", marginBottom: "2px" }}>Görsel Dilim Yüksekliği (H):</label>
                    <input
                      type="number"
                      value={customAssetFh}
                      onChange={(e) => setCustomAssetFh(Math.max(1, parseInt(e.target.value) || 32))}
                      style={{ fontSize: "9px", width: "100%", color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "8px", color: "rgba(255,255,255,0.6)", marginBottom: "2px" }}>Obje Boyutu (Scale): {customAssetScale.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={customAssetScale}
                    onChange={(e) => setCustomAssetScale(parseFloat(e.target.value) || 1.0)}
                    style={{ width: "100%" }}
                  />
                </div>
                <button
                  className="btn btn--primary"
                  onClick={handleUploadCustomAsset}
                  disabled={isUploadingAsset}
                  style={{ width: "100%", padding: "6px", fontSize: "10px", marginTop: "4px", display: "flex", justifyContent: "center", alignItems: "center" }}
                >
                  {isUploadingAsset ? "Yükleniyor..." : "📤 Yükle ve Oyuna Ekle"}
                </button>
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
                      selectedObject.type.startsWith("ahir_") ? `Ahır Parçası (${
                        selectedObject.type === "ahir_front_green" ? "Ön Yeşil" :
                        selectedObject.type === "ahir_front_grey" ? "Ön Gri" :
                        selectedObject.type === "ahir_front_red" ? "Ön Kızıl" :
                        selectedObject.type === "ahir_front_yellow" ? "Ön Sarı" :
                        selectedObject.type === "ahir_green_bottom_inside" ? "Alt Yeşil (İç)" :
                        selectedObject.type === "ahir_grey_bottom_inside" ? "Alt Gri (İç)" :
                        selectedObject.type === "ahir_red_bottom_inside" ? "Alt Kızıl (İç)" :
                        selectedObject.type === "ahir_yellow_bottom_inside" ? "Alt Sarı (İç)" :
                        selectedObject.type === "ahir_middle_modular_inside" ? "Orta (İç)" :
                        selectedObject.type === "ahir_upper_inside" ? "Üst (İç)" :
                        selectedObject.type === "ahir_roof_middle_modular" ? "Çatı Orta (Mod)" :
                        selectedObject.type === "ahir_roof_top" ? "Çatı Üst" :
                        "Bilinmeyen"
                      })` :
                      selectedObject.type === "farm_tile" ? "Boş Tarla Toprağı (Kuru)" :
                      selectedObject.type === "farm_tile_hoed" ? "Boş Tarla Toprağı (Kazılmış)" :
                      selectedObject.type === "farm_tile_watered" ? "Boş Tarla Toprağı (Sulanmış)" :
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
                        selectedObject.type === "farm_tile" ||
                        selectedObject.type === "farm_tile_hoed" ||
                        selectedObject.type === "farm_tile_watered" ||
                        selectedObject.type.startsWith("ahir_") ||
                        selectedObject.type.startsWith("decor_grass_") ||
                        selectedObject.type.startsWith("decor_gorsel_") ||
                        selectedObject.type.startsWith("vfx_") ||
                        selectedObject.type.startsWith("mg_") ||
                        selectedObject.type.startsWith("silo") ||
                        selectedObject.type.startsWith("rock_") ||
                        selectedObject.type.startsWith("house_") ||
                        selectedObject.type.startsWith("table_")
                          ? "0.01" // allow fine tuning for farm_tile scale snaps
                          : "0.05"
                      }
                      max={
                        selectedObject.type === "farm_tile" ||
                        selectedObject.type === "farm_tile_hoed" ||
                        selectedObject.type === "farm_tile_watered" ||
                        selectedObject.type.startsWith("ahir_") ||
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
                        selectedObject.type === "farm_tile" ||
                        selectedObject.type === "farm_tile_hoed" ||
                        selectedObject.type === "farm_tile_watered" ||
                        selectedObject.type.startsWith("ahir_") ||
                        selectedObject.type.startsWith("decor_grass_") ||
                        selectedObject.type.startsWith("decor_gorsel_") ||
                        selectedObject.type.startsWith("vfx_") ||
                        selectedObject.type.startsWith("mg_") ||
                        selectedObject.type.startsWith("silo") ||
                        selectedObject.type.startsWith("rock_") ||
                        selectedObject.type.startsWith("house_") ||
                        selectedObject.type.startsWith("table_")
                          ? "0.005" // allow very precise steps for scale snaps
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

                  {/* Yön Döndürme & Yatay Çevirme Kontrolleri */}
                  <div style={{ display: "flex", gap: "8px", margin: "10px 0" }}>
                    <button
                      className="btn btn--secondary"
                      style={{ flex: 1, fontSize: "10px", padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                      onClick={() => {
                        if (!game) return;
                        const scene = game.scene.keys.GameScene as any;
                        if (scene && selectedObject) {
                          const currentObj = scene.placedObjects.find((o: any) => o.id === selectedObject.id);
                          const currentAngle = currentObj?.imageObj ? currentObj.imageObj.angle : 0;
                          const nextAngle = (currentAngle + 90) % 360;
                          game.events.emit("editor-object-rotation-changed", {
                            id: selectedObject.id,
                            angle: nextAngle,
                            save: true
                          });
                        }
                      }}
                      title="Objeyi saat yönünde 90 derece döndürür (Klavye: R)"
                    >
                      🔄 90° Döndür
                    </button>
                    <button
                      className="btn btn--secondary"
                      style={{ flex: 1, fontSize: "10px", padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                      onClick={() => {
                        if (!game) return;
                        const scene = game.scene.keys.GameScene as any;
                        if (scene && selectedObject) {
                          const currentObj = scene.placedObjects.find((o: any) => o.id === selectedObject.id);
                          const currentFlip = currentObj?.imageObj ? currentObj.imageObj.flipX : false;
                          const nextFlip = !currentFlip;
                          game.events.emit("editor-object-flip-changed", {
                            id: selectedObject.id,
                            flipX: nextFlip,
                            save: true
                          });
                        }
                      }}
                      title="Objeyi yatay olarak aynalar/çevirir (Klavye: F)"
                    >
                      ↔️ Yatay Çevir
                    </button>
                  </div>

                  <button className="btn btn--danger" onClick={handleObjectDelete}>
                    🗑️ Objeyi Haritadan Sil
                  </button>
                </div>
              )}

              {/* ── Spawning Objects Selector ── */}
              <div className="section-title">Büyük Objeler & Efektler</div>
              
              {/* Tab Navigation Buttons */}
              <div 
                className="editor-tabs"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "12px",
                  background: "rgba(0, 0, 0, 0.4)",
                  padding: "6px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.08)"
                }}
              >
                <button
                  className={`tab-btn ${activeTab === "structures" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("structures")}
                  style={getTabBtnStyle("structures")}
                >
                  🏰 Yapı & NPC
                </button>
                <button
                  className={`tab-btn ${activeTab === "decorations" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("decorations")}
                  style={getTabBtnStyle("decorations")}
                >
                  🌿 Dekor (Foto)
                </button>
                <button
                  className={`tab-btn ${activeTab === "effects" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("effects")}
                  style={getTabBtnStyle("effects")}
                >
                  ✨ Efekt (GIF)
                </button>
                <button
                  className={`tab-btn ${activeTab === "mining" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("mining")}
                  style={getTabBtnStyle("mining")}
                >
                  ⛏️ Maden
                </button>
                <button
                  className={`tab-btn ${activeTab === "materials" ? "tab-btn--active" : ""}`}
                  onClick={() => setActiveTab("materials")}
                  style={getTabBtnStyle("materials")}
                >
                  📦 Malzeme Gift
                </button>
                <button
                  className={`tab-btn ${activeTab === "seeds" ? "tab-btn--active" : ""}`}
                  onClick={() => {
                    setActiveTab("seeds");
                    if (game) game.events.emit("editor-brush-selected", { type: "seed", cropType: "" });
                  }}
                  style={getTabBtnStyle("seeds")}
                >
                  🌾 Tohum Ek
                </button>
                <button
                  className={`tab-btn ${activeTab === "ahir" ? "tab-btn--active" : ""}`}
                  onClick={() => {
                    setActiveTab("ahir");
                    handleSelectObjectBrush("ahir_front_green");
                  }}
                  style={getTabBtnStyle("ahir")}
                >
                  🐴 Ahır
                </button>
              </div>

              {/* Tab 1: Structures & NPCs */}
              {activeTab === "structures" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <button
                    className={`obj-btn ${selectedTile === -2 && selectedObjectName === "farm_tile" ? "obj-btn--active" : ""}`}
                    onClick={() => handleSelectObjectBrush("farm_tile")}
                  >
                    <img src="/assets/farm_tile.jpg" alt="farm_tile" className="obj-thumb" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                    <span>Boş Tarla (Obje)</span>
                  </button>

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

              {/* Tab 2: Customization / Decorations */}
              {activeTab === "decorations" && (
                <>
                  {/* Decor Sub-Categories Row */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px" }}>
                    {[
                      { id: "trees", label: "🌳 Ağaç" },
                      { id: "exterior", label: "🏡 Dış" },
                      { id: "playground", label: "🎡 Park" },
                      { id: "beach", label: "🏖️ Plaj" },
                      { id: "houses", label: "🏠 Ev" },
                      { id: "workbenches", label: "🛠️ Tezgah" },
                      { id: "fences", label: "🪵 Çit" },
                      { id: "animals", label: "🐄 Hayvan" },
                      { id: "beds", label: "🛏️ Yatak" },
                      { id: "chairs", label: "🪑 Sandalye" },
                      { id: "tables", label: "🛋️ Masa" },
                      { id: "closets", label: "🚪 Dolap" },
                      { id: "others", label: "🧸 Diğer" },
                      { id: "dock", label: "🌉 İskele" },
                      { id: "custom", label: "📤 Özel" }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setDecorCategory(cat.id as any)}
                        style={{
                          flex: "1 1 auto",
                          fontSize: "8px",
                          padding: "4px 6px",
                          borderRadius: "4px",
                          border: decorCategory === cat.id ? "1px solid #4ade80" : "1px solid rgba(255,255,255,0.1)",
                          background: decorCategory === cat.id ? "rgba(74, 222, 128, 0.15)" : "rgba(0,0,0,0.2)",
                          color: decorCategory === cat.id ? "#4ade80" : "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontFamily: 'monospace'
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="object-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                    {decorCategory === "trees" && (
                      <>
                        {PACK_TREES.map(renderSlicedButton)}
                        {renderExtraCategory("trees")}
                      </>
                    )}
                    {decorCategory === "exterior" && (
                      <>
                        {PACK_EXTERIOR_PROPS.map(renderSlicedButton)}
                        {renderExtraCategory("exterior")}
                      </>
                    )}
                    {decorCategory === "playground" && (
                      <>
                        {PACK_PLAYGROUND_PROPS.map(renderSlicedButton)}
                        {renderExtraCategory("playground")}
                      </>
                    )}
                    {decorCategory === "beach" && (
                      <>
                        {PACK_BEACH_PROPS.map(renderSlicedButton)}
                        {renderExtraCategory("beach")}
                      </>
                    )}
                    {decorCategory === "houses" && PACK_HOUSES.map(renderSlicedButton)}
                    {decorCategory === "workbenches" && PACK_WORKBENCHES.map(renderSlicedButton)}
                    {decorCategory === "fences" && PACK_FENCES_BRIDGES.map(renderSlicedButton)}
                    {decorCategory === "animals" && PACK_ANIMALS.map(renderSlicedButton)}
                    {decorCategory === "beds" && PACK_BEDS.map(renderSlicedButton)}
                    {decorCategory === "chairs" && PACK_CHAIRS.map(renderSlicedButton)}
                    {decorCategory === "tables" && PACK_TABLES_SOFAS.map(renderSlicedButton)}
                    {decorCategory === "closets" && (
                      <>
                        {PACK_CLOSETS.map(renderSlicedButton)}
                        {renderExtraCategory("closets")}
                      </>
                    )}
                    {decorCategory === "others" && (
                      <>
                        {PACK_INTERIOR_OTHERS.map(renderSlicedButton)}
                        {renderExtraCategory("others")}
                      </>
                    )}
                    {decorCategory === "dock" && renderExtraCategory("dock")}
                    {decorCategory === "custom" && (() => {
                        const customList: any[] = [];
                        if (room?.state.customAssets) {
                          room.state.customAssets.forEach((asset: any) => {
                            const cols = Math.floor(asset.width / asset.fw) || 1;
                            const rows = Math.floor(asset.height / asset.fh) || 1;
                            const totalFrames = cols * rows;
                            
                            for (let i = 0; i < totalFrames; i++) {
                              customList.push({
                                key: `${asset.key}:${i}`,
                                sheetKey: asset.key,
                                path: asset.path,
                                label: `${asset.label} (Kare #${i + 1})`,
                                fw: asset.fw,
                                fh: asset.fh,
                                col: i % cols,
                                row: Math.floor(i / cols),
                                sheetW: asset.width,
                                sheetH: asset.height,
                                scale: asset.scale
                              });
                            }
                          });
                        }
                        
                        if (customList.length === 0) {
                          return (
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", textAlign: "center", width: "100%", padding: "20px", gridColumn: "span 3" }}>
                              Henüz yüklenmiş özel obje yok. Aşağıdaki "Özel Obje Yükle" bölümünden ekleyebilirsiniz.
                            </div>
                          );
                        }
                        
                        return customList.map(renderSlicedButton);
                      })()}
                    </div>
                  </>
              )}

              {/* Tab 3: VFX / Gifts (Gifs) */}
              {activeTab === "effects" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
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
                  {renderExtraCategory("effects")}
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

              {/* Tab 5b: Ahır (Modular Barn Components) */}
              {activeTab === "ahir" && (
                <div className="object-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {[
                    { key: "ahir_front_green", name: "Ahır Önü (Yeşil)", file: "Front_Hayloft_Green_16x16.png" },
                    { key: "ahir_front_grey", name: "Ahır Önü (Gri)", file: "Front_Hayloft_Grey_16x16.png" },
                    { key: "ahir_front_red", name: "Ahır Önü (Kızıl)", file: "Front_Hayloft_Red_16x16.png" },
                    { key: "ahir_front_yellow", name: "Ahır Önü (Sarı)", file: "Front_Hayloft_Yellow_16x16.png" },
                    { key: "ahir_green_bottom_inside", name: "Ahır Altı Y. (İç)", file: "Hayloft_Green_Bottom_Inside_16x16.png" },
                    { key: "ahir_grey_bottom_inside", name: "Ahır Altı G. (İç)", file: "Hayloft_Grey_Bottom_Inside_16x16.png" },
                    { key: "ahir_red_bottom_inside", name: "Ahır Altı K. (İç)", file: "Hayloft_Red_Bottom_Inside_16x16.png" },
                    { key: "ahir_yellow_bottom_inside", name: "Ahır Altı S. (İç)", file: "Hayloft_Yellow_Bottom_Inside_16x16.png" },
                    { key: "ahir_middle_modular_inside", name: "Ahır Orta (İç)", file: "Hayloft_Middle_Modular_Inside_16x16.png" },
                    { key: "ahir_upper_inside", name: "Ahır Üstü (İç)", file: "Hayloft_Upper_Inside_16x16.png" },
                    { key: "ahir_roof_middle_modular", name: "Çatı Orta (Mod)", file: "Roof_Hayloft_Middle_Modular_16x16.png" },
                    { key: "ahir_roof_top", name: "Çatı Üst", file: "Roof_Hayloft_Top_16x16.png" }
                  ].map(obj => (
                    <button
                      key={obj.key}
                      className={`obj-btn obj-btn--small ${selectedTile === -2 && selectedObjectName === obj.key ? "obj-btn--active" : ""}`}
                      onClick={() => handleSelectObjectBrush(obj.key)}
                    >
                      <img src={`/assets/ahir/${obj.file}`} alt={obj.name} className="obj-thumb obj-thumb--small" style={{ height: "24px", objectFit: "contain" }} />
                      <span style={{ fontSize: "6px" }}>{obj.name}</span>
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
              <div className="section-title">Zemin & Çit Fayansları (16x16) {selectedTile >= 0 ? `[Seçilen ID: ${selectedTile}]` : ""}</div>

              {/* Sub-Tabs to switch between Terrains and Fences */}
              <div className="editor-tabs" style={{ marginTop: "6px", marginBottom: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {Object.entries(TILESETS_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`tab-btn ${activeTileset === key ? "tab-btn--active" : ""}`}
                    onClick={() => setActiveTileset(key as any)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>

              <div className="tileset-container" style={{ overflow: "auto", maxHeight: "280px" }}>
                <div
                  className="tileset-wrapper"
                  style={{
                    position: "relative",
                    width: `${TILESETS_CONFIG[activeTileset].width}px`,
                    height: `${TILESETS_CONFIG[activeTileset].height}px`,
                    cursor: "pointer"
                  }}
                  onMouseDown={handleTilesetMouseDown}
                  onMouseMove={handleTilesetMouseMove}
                  onMouseUp={handleTilesetMouseUp}
                  onMouseLeave={handleTilesetMouseUp}
                >
                  <img
                    src={TILESETS_CONFIG[activeTileset].url}
                    alt="tileset"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      display: "block",
                      width: `${TILESETS_CONFIG[activeTileset].width}px`,
                      height: `${TILESETS_CONFIG[activeTileset].height}px`,
                      imageRendering: "pixelated",
                      userSelect: "none",
                    }}
                  />
                  
                  {/* Active single selection highlighting box */}
                  {(() => {
                    const cfg = TILESETS_CONFIG[activeTileset];
                    const localIndex = selectedTile - cfg.startGid;
                    const isValid = localIndex >= 0 && localIndex < (cfg.cols * cfg.rows);
                    if (!isValid) return null;

                    const col = localIndex % cfg.cols;
                    const row = Math.floor(localIndex / cfg.cols);

                    return (
                      <div
                        className="selection-box"
                        style={{
                          position: "absolute",
                          border: "2px solid #55ff22",
                          boxShadow: "0 0 6px rgba(85, 255, 34, 0.9)",
                          width: "16px",
                          height: "16px",
                          left: `${col * 16}px`,
                          top: `${row * 16}px`,
                          pointerEvents: "none",
                        }}
                      />
                    );
                  })()}

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
              <button
                className={`shop-tab-btn ${shopTab === "cosmetics" ? "shop-tab-btn--active" : ""}`}
                onClick={() => setShopTab("cosmetics")}
              >
                💇 Kozmetik / Berber
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
              ) : shopTab === "survival" ? (
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
              ) : (
                /* COSMETICS SHOP TAB */
                <div className="shop-list" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {COSMETICS_LIST.map((cosm) => {
                    const isOwned = cosm.key === "hair_Standard" || !!ownedCosmetics[cosm.key];
                    const isEquipped = (myAppearance as any)[cosm.type] === cosm.value;

                    return (
                      <div key={cosm.key} className="shop-item" style={{ borderLeft: isEquipped ? "4px solid #f0c040" : "4px solid transparent" }}>
                        <span style={{ fontSize: "24px", padding: "6px", width: "40px", textAlign: "center" }}>
                          {cosm.type === "hairStyle" ? "💇" : cosm.type === "clothesColor" ? "👕" : cosm.type === "beardColor" ? "🧔" : "👒"}
                        </span>
                        <div className="shop-item-info">
                          <span className="shop-item-name">{cosm.label}</span>
                          <span className="shop-item-price" style={{ color: isOwned ? "#888" : "#f1c40f" }}>
                            {isOwned ? "✅ Sahip Olunuyor" : `💰 ${cosm.price} Altın`}
                          </span>
                          <span className="shop-item-stock">{cosm.category}</span>
                        </div>
                        {isEquipped ? (
                          <button
                            className="shop-action-btn"
                            style={{ background: "#27ae60", color: "#fff", cursor: "default" }}
                            disabled
                          >
                            Kuşanıldı
                          </button>
                        ) : isOwned ? (
                          <button
                            className="shop-action-btn shop-action-btn--buy"
                            onClick={() => room?.send("equip-cosmetic", { type: cosm.type, value: cosm.value })}
                          >
                            Kuşan
                          </button>
                        ) : (
                          <button
                            className="shop-action-btn shop-action-btn--buy"
                            disabled={gold < cosm.price}
                            onClick={() => room?.send("buy-cosmetic", { itemKey: cosm.key })}
                          >
                            Satın Al
                          </button>
                        )}
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
      {connected && !editMode && (
        <div className="inventory-card">
          <div className="inventory-title">🎒 Envanterim (Çantam)</div>
          
          {/* Sub-tabs inside inventory card */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
            <button
              onClick={() => {
                setInventoryTab("crops");
                setSelectedInventorySeed(null);
                setSelectedInventoryTool(null);
                if (game) {
                  game.events.emit("editor-brush-selected", { type: "none" });
                  game.events.emit("play-tool-selected", { tool: null });
                }
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
              onClick={() => {
                setInventoryTab("seeds");
                setSelectedInventoryTool(null);
                if (game) game.events.emit("play-tool-selected", { tool: null });
              }}
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
              onClick={() => {
                setInventoryTab("survival");
                setSelectedInventorySeed(null);
                setSelectedInventoryTool(null);
                if (game) {
                  game.events.emit("editor-brush-selected", { type: "none" });
                  game.events.emit("play-tool-selected", { tool: null });
                }
              }}
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
            <button
              onClick={() => {
                setInventoryTab("tools");
                setSelectedInventorySeed(null);
                if (game) game.events.emit("editor-brush-selected", { type: "none" });
              }}
              style={{
                flex: 1,
                background: inventoryTab === "tools" ? "rgba(74, 222, 128, 0.2)" : "rgba(255,255,255,0.05)",
                border: "1px solid " + (inventoryTab === "tools" ? "rgba(74, 222, 128, 0.4)" : "rgba(255,255,255,0.1)"),
                borderRadius: "6px",
                color: inventoryTab === "tools" ? "#4ade80" : "rgba(255,255,255,0.7)",
                fontSize: "9px",
                padding: "4px 2px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🛠️ Araçlar
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
            ) : inventoryTab === "survival" ? (
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
            ) : (
              /* TOOLS TAB ITEMS LIST */
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", width: "100%" }}>
                <div
                  className={`inventory-item ${selectedInventoryTool === "hoe" ? "inventory-item--selected" : ""}`}
                  style={{ cursor: "pointer", flex: "1 1 calc(50% - 4px)", minWidth: "80px" }}
                  onClick={() => {
                    const next = selectedInventoryTool === "hoe" ? null : "hoe";
                    setSelectedInventoryTool(next);
                    if (game) {
                      game.events.emit("play-tool-selected", { tool: next });
                    }
                  }}
                  title="Çapa: Boş tarlayı sürer"
                >
                  <span style={{ fontSize: "24px" }}>⛏️</span>
                  <div className="inventory-details">
                    <span className="inventory-name" style={{ fontSize: "10px" }}>Çapa</span>
                    <span className="inventory-qty" style={{ color: "#4ade80" }}>Hazır</span>
                  </div>
                </div>

                <div
                  className={`inventory-item ${selectedInventoryTool === "watering_can" ? "inventory-item--selected" : ""}`}
                  style={{ cursor: "pointer", flex: "1 1 calc(50% - 4px)", minWidth: "80px" }}
                  onClick={() => {
                    const next = selectedInventoryTool === "watering_can" ? null : "watering_can";
                    setSelectedInventoryTool(next);
                    if (game) {
                      game.events.emit("play-tool-selected", { tool: next });
                    }
                  }}
                  title="Sulama Kabı: Ekili tarlayı sular"
                >
                  <span style={{ fontSize: "24px" }}>💧</span>
                  <div className="inventory-details">
                    <span className="inventory-name" style={{ fontSize: "10px" }}>Sulama Kabı</span>
                    <span className="inventory-qty" style={{ color: "#4ade80" }}>Hazır</span>
                  </div>
                </div>
              </div>
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

      {/* ── Character & Equipment Modal ── */}
      {isEquipmentOpen && room && (
        <div className="modal-overlay" style={{ zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}>
          <div className="modal-content" style={{
            background: "rgba(20, 25, 40, 0.95)",
            border: "2px solid rgba(59, 130, 246, 0.4)",
            borderRadius: "16px",
            width: "800px",
            maxWidth: "95%",
            height: "550px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            overflow: "hidden",
            color: "#fff",
            fontFamily: "monospace"
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(59, 130, 246, 0.1)" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", color: "#60a5fa", display: "flex", alignItems: "center", gap: "8px" }}>
                👤 Karakter & Ekipman Paneli
              </h2>
              <button 
                onClick={() => setIsEquipmentOpen(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "18px" }}
                onMouseOver={e => e.currentTarget.style.color = "#fff"}
                onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
              >
                ✕
              </button>
            </div>

            {/* Split Body */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Left Side: Character Sheet */}
              <div style={{ width: "300px", borderRight: "1px solid rgba(255,255,255,0.08)", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", background: "rgba(0,0,0,0.15)" }}>
                
                {/* Profile Box */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "28px" }}>🧙‍♂️</div>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px", color: "#e2e8f0" }}>{myUsername || "Oyuncu"}</div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>Seviye: {totalLevel}</div>
                  </div>
                </div>

                {/* Equipment Paper Doll */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "bold", color: "#60a5fa" }}>Giyili Eşyalar</div>
                  
                  {/* Slots Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    {[
                      { slot: "helmet", label: "Kask", icon: "🧢", val: equippedHelmet },
                      { slot: "acc", label: "Şapka", icon: "👒", val: myAppearance.accItem },
                      { slot: "chestplate", label: "Zırh", icon: "🛡️", val: equippedChestplate },
                      { slot: "leggings", label: "Pantolon", icon: "👖", val: equippedLeggings },
                      { slot: "boots", label: "Bot", icon: "🥾", val: equippedBoots },
                      { slot: "weapon", label: "Alet/Silah", icon: "⚔️", val: equippedWeapon },
                    ].map(s => {
                      const [tierId, itemType] = s.val ? s.val.split(":") : ["", ""];
                      // Determine preview
                      let content = <div style={{ fontSize: "18px", opacity: 0.3 }}>{s.icon}</div>;
                      let tooltip = "Boş";
                      
                      if (s.val) {
                        if (s.slot === "acc") {
                          tooltip = `Şapka: ${s.val}`;
                          content = (
                            <div style={{
                              width: "32px",
                              height: "32px",
                              backgroundImage: `url(/assets/pack/char/idle/acc/${s.val}.png)`,
                              backgroundSize: "512px 32px",
                              backgroundPosition: "0px 0px",
                              imageRendering: "pixelated"
                            }} />
                          );
                        } else {
                          tooltip = `${itemType} (${tierId.replace(/^\d+\._/, "")})`;
                          // no-op
                          content = (
                            <img 
                              src={`/assets/pack/icons/RPG_icons/Weapons_and_Armor/${tierId}/${itemType}.png`}
                              alt={itemType} 
                              style={{ width: "24px", height: "24px", imageRendering: "pixelated", objectFit: "cover", objectPosition: "left", aspectRatio: "1/1" } as any} 
                            />
                          );
                        }
                      }

                      return (
                        <div key={s.slot} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                          <button
                            onClick={() => {
                              if (s.val) {
                                room.send("equip-item", { slot: s.slot, itemKey: "" });
                              }
                            }}
                            title={s.val ? `${tooltip} (Çıkarmak için tıkla)` : "Boş"}
                            style={{
                              width: "56px",
                              height: "56px",
                              background: s.val ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.02)",
                              border: s.val ? "1px solid rgba(59, 130, 246, 0.5)" : "1px solid rgba(255,255,255,0.08)",
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: s.val ? "pointer" : "default",
                              transition: "all 0.2s"
                            }}
                            onMouseOver={e => { if (s.val) e.currentTarget.style.borderColor = "#ef4444"; }}
                            onMouseOut={e => { if (s.val) e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)"; }}
                          >
                            {content}
                          </button>
                          <span style={{ fontSize: "8px", color: s.val ? "#4ade80" : "#64748b" }}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mount / Vehicle Selector */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "bold", color: "#4ade80", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🐎 Binekler & Araçlar</span>
                    {mountType !== "none" && (
                      <button 
                        onClick={() => room.send("toggle-mount", { mountType: "none" })}
                        style={{ fontSize: "8px", background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", color: "#f87171", cursor: "pointer", fontFamily: "'Press Start 2P', monospace" }}
                      >
                        İn
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "8px", color: "#94a3b8", marginBottom: "4px" }}>Atlar (Hızlı - %80):</div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {[
                          { id: "horse_1", icon: "🐎", label: "Kahve" },
                          { id: "horse_2", icon: "🦄", label: "Beyaz" },
                          { id: "horse_3", icon: "🐴", label: "Kızıl" },
                          { id: "horse_4", icon: "🦓", label: "Siyah" },
                          { id: "horse_5", icon: "🦌", label: "Alaca" },
                        ].map(m => (
                          <button
                            key={m.id}
                            onClick={() => room.send("toggle-mount", { mountType: m.id })}
                            style={{
                              padding: "4px 8px",
                              background: mountType === m.id ? "rgba(74, 222, 128, 0.2)" : "rgba(255,255,255,0.04)",
                              border: mountType === m.id ? "1px solid #4ade80" : "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "4px",
                              color: mountType === m.id ? "#4ade80" : "#fff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontFamily: "'Press Start 2P', monospace",
                              fontSize: "6px"
                            }}
                          >
                            <span>{m.icon}</span>
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "8px", color: "#94a3b8", marginBottom: "4px" }}>Bisikletler (Orta - %50):</div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {[
                          { id: "bicycle_blue", color: "#60a5fa", label: "Mavi" },
                          { id: "bicycle_red", color: "#f87171", label: "Kızıl" },
                          { id: "bicycle_green", color: "#4ade80", label: "Yeşil" },
                          { id: "bicycle_orange", color: "#fbbf24", label: "Turuncu" },
                          { id: "bicycle_pink", color: "#f472b6", label: "Pembe" },
                        ].map(m => (
                          <button
                            key={m.id}
                            onClick={() => room.send("toggle-mount", { mountType: m.id })}
                            style={{
                              padding: "4px 8px",
                              background: mountType === m.id ? "rgba(96, 165, 250, 0.2)" : "rgba(255,255,255,0.04)",
                              border: mountType === m.id ? `1px solid ${m.color}` : "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "4px",
                              color: mountType === m.id ? m.color : "#fff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontFamily: "'Press Start 2P', monospace",
                              fontSize: "6px"
                            }}
                          >
                            <span style={{ color: m.color }}>🚲</span>
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "7px", color: "#94a3b8", textAlign: "center", marginTop: "4px" }}>
                    Kısayollar: <strong>H</strong> (At) | <strong>B</strong> (Bisiklet)
                  </div>
                </div>

                {/* Stats Panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "bold", color: "#60a5fa", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "4px" }}>İstatistikler</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#f87171" }}>❤️ Can (HP):</span>
                      <strong style={{ color: "#ef4444" }}>{hp} / {maxHp}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#60a5fa" }}>🛡️ Kalkan:</span>
                      <strong style={{ color: "#3b82f6" }}>{shield} / {maxShield}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#fbbf24" }}>⚔️ Hasar (Atk):</span>
                      <strong style={{ color: "#f59e0b" }}>{10 + (equippedWeapon ? getAttackBonus(equippedWeapon) : 0)}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Side: Inventory Vault */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                
                {/* Vault Tabs */}
                <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "8px 12px", gap: "6px" }}>
                  {[
                    { id: "weapons", label: "⚔️ Silahlar" },
                    { id: "armors", label: "🛡️ Zırhlar" },
                    { id: "tools", label: "🪓 Aletler" },
                    { id: "hats", label: "👒 Şapkalar" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setEquipCategory(tab.id as any)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: equipCategory === tab.id ? "1px solid #3b82f6" : "1px solid transparent",
                        background: equipCategory === tab.id ? "rgba(59, 130, 246, 0.15)" : "transparent",
                        color: equipCategory === tab.id ? "#60a5fa" : "rgba(255,255,255,0.6)",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Items List Grid */}
                <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
                  {equipCategory === "hats" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {COSMETIC_HATS.map(hat => {
                        const isEquipped = myAppearance.accItem === hat.id;
                        return (
                          <div key={hat.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{
                              width: "32px",
                              height: "32px",
                              backgroundImage: `url(/assets/pack/char/idle/acc/${hat.id}.png)`,
                              backgroundSize: "512px 32px",
                              backgroundPosition: "0px 0px",
                              imageRendering: "pixelated",
                              marginBottom: "6px"
                            }} />
                            <div style={{ fontSize: "10px", fontWeight: "bold", textAlign: "center", marginBottom: "8px", minHeight: "24px" }}>{hat.label}</div>
                            <button
                              onClick={() => room.send("equip-item", { slot: "acc", itemKey: isEquipped ? "" : hat.id })}
                              style={{
                                padding: "4px 10px",
                                fontSize: "9px",
                                borderRadius: "4px",
                                border: isEquipped ? "1px solid #ef4444" : "1px solid #10b981",
                                background: isEquipped ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                                color: isEquipped ? "#f87171" : "#34d399",
                                cursor: "pointer",
                                width: "100%"
                              }}
                            >
                              {isEquipped ? "Çıkar" : "Kuşan"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {EQUIP_TIERS.map(tier => {
                        let list: any[] = [];
                        let slotName = "";
                        if (equipCategory === "weapons") {
                          list = EQUIP_WEAPONS;
                          slotName = "weapon";
                        } else if (equipCategory === "armors") {
                          list = EQUIP_ARMORS;
                        } else {
                          list = EQUIP_TOOLS;
                          slotName = "weapon";
                        }

                        return (
                          <div key={tier.id} style={{ border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", background: "rgba(0,0,0,0.1)", padding: "10px", marginBottom: "12px" }}>
                            <div style={{ fontSize: "11px", fontWeight: "bold", color: tier.color, marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>
                              ⚔️ {tier.label} Serisi
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                              {list.map(item => {
                                const itemKey = `${tier.id}:${item.name}`;
                                const currentSlot = equipCategory === "armors" ? item.slot : slotName;
                                const isEquipped = currentSlot === "weapon" ? equippedWeapon === itemKey : (
                                  currentSlot === "helmet" ? equippedHelmet === itemKey : (
                                    currentSlot === "chestplate" ? equippedChestplate === itemKey : (
                                      currentSlot === "leggings" ? equippedLeggings === itemKey : equippedBoots === itemKey
                                    )
                                  )
                                );

                                // Stats display
                                let statText = "";
                                if (equipCategory === "weapons") {
                                  statText = `+${getAttackBonus(itemKey)} Hasar`;
                                } else if (equipCategory === "armors") {
                                  statText = `+${getShieldBonus(itemKey)} Kalkan`;
                                } else {
                                  statText = "Alet";
                                }

                                return (
                                  <div key={item.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <img 
                                      src={`/assets/pack/icons/RPG_icons/Weapons_and_Armor/${tier.id}/${item.icon}`}
                                      alt={item.name} 
                                      style={{ width: "24px", height: "24px", imageRendering: "pixelated", marginBottom: "4px", objectFit: "cover", objectPosition: "left", aspectRatio: "1/1" } as any} 
                                    />
                                    <div style={{ fontSize: "9px", fontWeight: "bold" }}>{item.label}</div>
                                    <div style={{ fontSize: "7px", color: "#64748b", margin: "2px 0 6px" }}>{statText}</div>
                                    <button
                                      onClick={() => room.send("equip-item", { slot: currentSlot, itemKey: isEquipped ? "" : itemKey })}
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "8px",
                                        borderRadius: "4px",
                                        border: isEquipped ? "1px solid #ef4444" : "1px solid #3b82f6",
                                        background: isEquipped ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                                        color: isEquipped ? "#f87171" : "#60a5fa",
                                        cursor: "pointer",
                                        width: "100%",
                                        fontWeight: "bold"
                                      }}
                                    >
                                      {isEquipped ? "Çıkar" : "Kuşan"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

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

      {/* ── Character Creator Modal ──────────────────────────────────────── */}
      {isLoggedIn && room && sessionId && !characterCreated && (
        <CharacterCreator
          onConfirm={(opts) => {
            room.send("character-create", opts);
          }}
        />
      )}
    </div>
  );
};

export default App;
