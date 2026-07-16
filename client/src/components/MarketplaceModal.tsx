import React, { useState, useEffect } from "react";
import "./MarketplaceModal.css";

interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: string;
  itemCategory: string;
  quantity: number;
  pricePerUnit: number;
  listedAt: number;
}

interface MarketHistoryEntry {
  itemType: string;
  quantity: number;
  pricePerUnit: number;
  timestamp: number;
}

interface MarketplaceModalProps {
  room: any;
  inventory: Record<string, number>;
  seeds: Record<string, number>;
  coin: number;
  mySessionId: string;
  onClose: () => void;
}

const ITEM_EMOJI: Record<string, string> = {
  Cabbage:"🥬", Carrot:"🥕", Cauliflower:"🥦", Coffee:"☕", Corn:"🌽",
  Cotton:"🌸", Grape:"🍇", Onion:"🧅", Pepper:"🌶️", Prickly_Pear:"🌵",
  Pumpkin:"🎃", Radish:"🌱", Strawberry:"🍓", Tomato:"🍅", Turnip:"🥕",
  Watermelon:"🍉", Wheat:"🌾", Fish:"🐟"
};

const MarketplaceModal: React.FC<MarketplaceModalProps> = ({
  room, inventory, seeds, coin, mySessionId, onClose
}) => {
  const [tab, setTab] = useState<"buy" | "sell" | "history">("buy");
  const [listings, setListings] = useState<Listing[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [marketHistory, setMarketHistory] = useState<MarketHistoryEntry[]>([]);
  const [sellItem, setSellItem] = useState("");
  const [sellCategory, setSellCategory] = useState<"crop"|"seed">("crop");
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState(10);
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Selected item type for detailed statistics and graph
  const [selectedDetailItem, setSelectedDetailItem] = useState<string | null>(null);

  const showMsg = (msg: string, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(""), 4000); }
    else { setNotice(msg); setTimeout(() => setNotice(""), 4000); }
  };

  useEffect(() => {
    if (!room) return;
    const refresh = () => {
      const ls: Listing[] = [];
      room.state.marketListings.forEach((l: any) => {
        ls.push({
          id: l.id,
          sellerId: l.sellerId,
          sellerName: l.sellerName,
          itemType: l.itemType,
          itemCategory: l.itemCategory,
          quantity: l.quantity,
          pricePerUnit: l.pricePerUnit,
          listedAt: l.listedAt
        });
      });
      setListings(ls.sort((a, b) => b.listedAt - a.listedAt));

      // Fetch market history
      const hist: MarketHistoryEntry[] = [];
      room.state.marketHistory.forEach((h: any) => {
        hist.push({
          itemType: h.itemType,
          quantity: h.quantity,
          pricePerUnit: h.pricePerUnit,
          timestamp: h.timestamp
        });
      });
      setMarketHistory(hist);
    };

    refresh();
    room.state.marketListings.onAdd(() => refresh());
    room.state.marketListings.onRemove(() => refresh());
    room.state.marketListings.onChange(() => refresh());
    room.state.marketHistory.onAdd(() => refresh());

    room.onMessage("market-error",   (d: any) => showMsg(d.message, true));
    room.onMessage("market-listed",  () => showMsg("✅ İlan başarıyla yayınlandı!"));
    room.onMessage("market-bought",  (d: any) => {
      setHistory(h => [...h, { type:"buy", ...d, time: Date.now() }]);
      showMsg(`✅ ${d.qty}x ${d.itemType} alındı! Toplam: ${d.totalCost} FARM`);
    });
    room.onMessage("market-cancelled", () => showMsg("✅ İlan iptal edildi."));
  }, [room]);

  const handleList = () => {
    if (!sellItem) { showMsg("Satılık bir eşya seçin.", true); return; }
    room.send("market-list", { itemType: sellItem, itemCategory: sellCategory, quantity: sellQty, pricePerUnit: sellPrice });
  };

  const handleBuy = (listing: Listing) => {
    const qty = buyQty[listing.id] || 1;
    const total = qty * listing.pricePerUnit;
    const withFee = total + Math.ceil(total * 0.025);
    if (coin < withFee) { showMsg(`Yetersiz FARM coin. Gerekli: ${withFee}.`, true); return; }
    room.send("market-buy", { listingId: listing.id, quantity: qty });
  };

  const handleCancel = (listingId: string) => {
    room.send("market-cancel", { listingId });
  };

  const cropItems = Object.entries(inventory).filter(([, q]) => q > 0).map(([k]) => k);
  const seedItems = Object.entries(seeds).filter(([, q]) => q > 0).map(([k]) => k);
  const allSellItems = sellCategory === "crop" ? cropItems : seedItems;

  // Statistics for selected detail item
  const itemHistory = marketHistory.filter(h => h.itemType === selectedDetailItem);
  const totalSold = itemHistory.reduce((sum, h) => sum + h.quantity, 0);
  const prices = itemHistory.map(h => h.pricePerUnit);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  // Custom SVG line chart points builder
  const renderPriceChart = () => {
    if (itemHistory.length < 2) return <p className="chart-info">Grafik için en az 2 satış geçmişi gerekiyor.</p>;
    
    const width = 240;
    const height = 100;
    const padding = 15;
    
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const pRange = maxP - minP || 1;

    // Build SVG path
    const points = itemHistory.map((h, i) => {
      const x = padding + (i / (itemHistory.length - 1)) * (width - padding * 2);
      const y = height - padding - ((h.pricePerUnit - minP) / pRange) * (height - padding * 2);
      return `${x},${y}`;
    });

    return (
      <svg width={width} height={height} className="history-svg">
        <polyline
          fill="none"
          stroke="#818cf8"
          strokeWidth="3"
          points={points.join(" ")}
        />
        {itemHistory.map((h, i) => {
          const x = padding + (i / (itemHistory.length - 1)) * (width - padding * 2);
          const y = height - padding - ((h.pricePerUnit - minP) / pRange) * (height - padding * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill="#c4b5fd"
              className="chart-dot"
              title={`${h.pricePerUnit} FARM`}
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`marketplace-modal ${selectedDetailItem ? "with-details" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="marketplace-main-view">
          <div className="marketplace-header">
            <h2>🛒 Pazar Yeri</h2>
            <div className="marketplace-coin">🪙 {coin} FARM</div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          {(error || notice) && (
            <div className={`market-notice ${error ? "error" : "success"}`}>
              {error || notice}
            </div>
          )}

          <div className="marketplace-tabs">
            {(["buy","sell","history"] as const).map(t => (
              <button key={t} className={`mktab ${tab===t?"active":""}`} onClick={() => { setTab(t); setSelectedDetailItem(null); }}>
                {t==="buy"?"🛍️ Satın Al":t==="sell"?"💰 Satış Yap":"📜 İşlem Geçmişi"}
              </button>
            ))}
          </div>

          {/* BUY TAB */}
          {tab === "buy" && (
            <div className="marketplace-content">
              {listings.length === 0 && <p className="market-empty">Pazarda aktif ilan yok.</p>}
              <div className="listings-grid">
                {listings.map(l => {
                  const fee = Math.ceil(l.pricePerUnit * (buyQty[l.id] || 1) * 0.025);
                  const total = l.pricePerUnit * (buyQty[l.id] || 1) + fee;
                  const isOwn = l.sellerId === mySessionId;
                  const isSelected = selectedDetailItem === l.itemType;
                  return (
                    <div
                      key={l.id}
                      className={`listing-card ${isOwn ? "own" : ""} ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedDetailItem(l.itemType)}
                    >
                      <span className="listing-emoji">{ITEM_EMOJI[l.itemType] || "📦"}</span>
                      <div className="listing-info">
                        <span className="listing-name">{l.itemType}</span>
                        <span className="listing-meta">{l.sellerName} · {l.quantity} Adet</span>
                        <span className="listing-price">{l.pricePerUnit} FARM adet</span>
                      </div>
                      {isOwn ? (
                        <button className="listing-cancel-btn" onClick={(e) => { e.stopPropagation(); handleCancel(l.id); }}>İptal Et</button>
                      ) : (
                        <div className="listing-buy-controls" onClick={e => e.stopPropagation()}>
                          <input type="number" min={1} max={l.quantity} value={buyQty[l.id]||1}
                            onChange={e => setBuyQty(prev => ({...prev,[l.id]:Math.max(1,Math.min(l.quantity,+e.target.value))}))}
                            className="qty-input" />
                          <button className="listing-buy-btn" onClick={() => handleBuy(l)}>
                            Satın Al<br/><small>{total} FARM</small>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="market-fee-note">* Alıcı işlemlerinde %2.5 işlem komisyonu alınmaktadır.</p>
            </div>
          )}

          {/* SELL TAB */}
          {tab === "sell" && (
            <div className="marketplace-content sell-form">
              <div className="sell-row">
                <label>Kategori</label>
                <div className="sell-cat-toggle">
                  <button className={sellCategory==="crop"?"active":""} onClick={()=>setSellCategory("crop")}>🌾 Mahsuller</button>
                  <button className={sellCategory==="seed"?"active":""} onClick={()=>setSellCategory("seed")}>🌱 Tohumlar</button>
                </div>
              </div>
              <div className="sell-row">
                <label>Eşya Seçin</label>
                <select value={sellItem} onChange={e=>setSellItem(e.target.value)} className="sell-select">
                  <option value="">-- Seçiniz --</option>
                  {allSellItems.map(i => (
                    <option key={i} value={i}>{ITEM_EMOJI[i] || "📦"} {i} (Mevcut: x{(sellCategory==="crop"?inventory:seeds)[i]})</option>
                  ))}
                </select>
              </div>
              <div className="sell-row">
                <label>Adet</label>
                <input type="number" min={1} max={(sellCategory==="crop"?inventory:seeds)[sellItem]||1}
                  value={sellQty} onChange={e=>setSellQty(Math.max(1,+e.target.value))} className="sell-number" />
              </div>
              <div className="sell-row">
                <label>Birim Fiyat (FARM)</label>
                <input type="number" min={1} value={sellPrice} onChange={e=>setSellPrice(Math.max(1,+e.target.value))} className="sell-number" />
              </div>
              <div className="sell-summary">
                Kazanılacak: {sellQty * sellPrice} FARM · Listeleme Ücreti (%5): {Math.ceil(sellQty*sellPrice*0.05)} FARM
              </div>
              <button className="sell-submit-btn" onClick={handleList}>📦 Listele</button>
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === "history" && (
            <div className="marketplace-content">
              {history.length === 0 && <p className="market-empty">Bu oturumda henüz işlem yapmadınız.</p>}
              {history.slice().reverse().map((h, i) => (
                <div key={i} className="history-entry">
                  <span>{h.type === "buy" ? "🛍️ Alındı" : "💰 Satıldı"}</span>
                  <span>{h.qty}x {h.itemType}</span>
                  <span className="history-cost">{h.totalCost} FARM</span>
                  <span className="history-time">{new Date(h.time).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIDE DETAIL PANEL */}
        {selectedDetailItem && (
          <div className="market-details-panel">
            <div className="detail-header">
              <h3>{ITEM_EMOJI[selectedDetailItem]} {selectedDetailItem} Analizi</h3>
              <button className="detail-close" onClick={() => setSelectedDetailItem(null)}>✕</button>
            </div>

            <div className="detail-body">
              {/* Graphic Chart */}
              <div className="detail-chart-box">
                <h4>Fiyat Geçmişi</h4>
                {renderPriceChart()}
              </div>

              {/* Statistics */}
              <div className="detail-stats">
                <div className="detail-stat-row">
                  <span>Satış Adedi:</span>
                  <strong>x{totalSold}</strong>
                </div>
                <div className="detail-stat-row">
                  <span>En Düşük Fiyat:</span>
                  <strong>{minPrice} FARM</strong>
                </div>
                <div className="detail-stat-row">
                  <span>En Yüksek Fiyat:</span>
                  <strong>{maxPrice} FARM</strong>
                </div>
                <div className="detail-stat-row">
                  <span>Ortalama Fiyat:</span>
                  <strong>{avgPrice} FARM</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceModal;
