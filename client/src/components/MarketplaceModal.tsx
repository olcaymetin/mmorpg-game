import React, { useState, useEffect } from "react";
import "./MarketplaceModal.css";

interface Listing {
  id: string;
  sellerName: string;
  itemType: string;
  itemCategory: string;
  quantity: number;
  pricePerUnit: number;
  listedAt: number;
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
  Watermelon:"🍉", Wheat:"🌾",
};

const MarketplaceModal: React.FC<MarketplaceModalProps> = ({
  room, inventory, seeds, coin, mySessionId, onClose
}) => {
  const [tab, setTab] = useState<"buy" | "sell" | "history">("buy");
  const [listings, setListings] = useState<Listing[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [sellItem, setSellItem] = useState("");
  const [sellCategory, setSellCategory] = useState<"crop"|"seed">("crop");
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState(10);
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const showMsg = (msg: string, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(""), 4000); }
    else { setNotice(msg); setTimeout(() => setNotice(""), 4000); }
  };

  useEffect(() => {
    if (!room) return;
    const refresh = () => {
      const ls: Listing[] = [];
      room.state.marketListings.forEach((l: any) => {
        ls.push({ id: l.id, sellerName: l.sellerName, itemType: l.itemType,
          itemCategory: l.itemCategory, quantity: l.quantity, pricePerUnit: l.pricePerUnit, listedAt: l.listedAt });
      });
      setListings(ls.sort((a, b) => b.listedAt - a.listedAt));
    };
    refresh();
    room.state.marketListings.onAdd(() => refresh());
    room.state.marketListings.onRemove(() => refresh());
    room.state.marketListings.onChange(() => refresh());

    room.onMessage("market-error",   (d: any) => showMsg(d.message, true));
    room.onMessage("market-listed",  () => showMsg("✅ Listed successfully!"));
    room.onMessage("market-bought",  (d: any) => {
      setHistory(h => [...h, { type:"buy", ...d, time: Date.now() }]);
      showMsg(`✅ Bought ${d.qty}x ${d.itemType} for ${d.totalCost} FARM`);
    });
    room.onMessage("market-cancelled", () => showMsg("✅ Listing cancelled, items returned."));
  }, [room]);

  const handleList = () => {
    if (!sellItem) { showMsg("Select an item to sell.", true); return; }
    room.send("market-list", { itemType: sellItem, itemCategory: sellCategory, quantity: sellQty, pricePerUnit: sellPrice });
  };

  const handleBuy = (listing: Listing) => {
    const qty = buyQty[listing.id] || 1;
    const total = qty * listing.pricePerUnit;
    const withFee = total + Math.ceil(total * 0.025);
    if (coin < withFee) { showMsg(`Not enough FARM coin. Need ${withFee}.`, true); return; }
    room.send("market-buy", { listingId: listing.id, quantity: qty });
  };

  const handleCancel = (listingId: string) => {
    room.send("market-cancel", { listingId });
  };

  const cropItems = Object.entries(inventory).filter(([, q]) => q > 0).map(([k]) => k);
  const seedItems = Object.entries(seeds).filter(([, q]) => q > 0).map(([k]) => k);
  const allSellItems = sellCategory === "crop" ? cropItems : seedItems;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="marketplace-modal" onClick={e => e.stopPropagation()}>
        <div className="marketplace-header">
          <h2>🛒 Marketplace</h2>
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
            <button key={t} className={`mktab ${tab===t?"active":""}`} onClick={() => setTab(t)}>
              {t==="buy"?"🛍️ Buy":t==="sell"?"💰 Sell":"📜 History"}
            </button>
          ))}
        </div>

        {/* BUY TAB */}
        {tab === "buy" && (
          <div className="marketplace-content">
            {listings.length === 0 && <p className="market-empty">No listings yet. Be the first to sell!</p>}
            <div className="listings-grid">
              {listings.map(l => {
                const fee = Math.ceil(l.pricePerUnit * (buyQty[l.id] || 1) * 0.025);
                const total = l.pricePerUnit * (buyQty[l.id] || 1) + fee;
                const isOwn = l.sellerId === mySessionId;
                return (
                  <div key={l.id} className={`listing-card ${isOwn ? "own" : ""}`}>
                    <span className="listing-emoji">{ITEM_EMOJI[l.itemType] || "📦"}</span>
                    <div className="listing-info">
                      <span className="listing-name">{l.itemType}</span>
                      <span className="listing-meta">{l.sellerName} · {l.quantity} avail.</span>
                      <span className="listing-price">{l.pricePerUnit} FARM ea.</span>
                    </div>
                    {isOwn ? (
                      <button className="listing-cancel-btn" onClick={() => handleCancel(l.id)}>Cancel</button>
                    ) : (
                      <div className="listing-buy-controls">
                        <input type="number" min={1} max={l.quantity} value={buyQty[l.id]||1}
                          onChange={e => setBuyQty(prev => ({...prev,[l.id]:Math.max(1,Math.min(l.quantity,+e.target.value))}))}
                          className="qty-input" />
                        <button className="listing-buy-btn" onClick={() => handleBuy(l)}>
                          Buy<br/><small>{total} FARM</small>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="market-fee-note">* 2.5% buyer fee applies on purchases</p>
          </div>
        )}

        {/* SELL TAB */}
        {tab === "sell" && (
          <div className="marketplace-content sell-form">
            <div className="sell-row">
              <label>Category</label>
              <div className="sell-cat-toggle">
                <button className={sellCategory==="crop"?"active":""} onClick={()=>setSellCategory("crop")}>🌾 Crops</button>
                <button className={sellCategory==="seed"?"active":""} onClick={()=>setSellCategory("seed")}>🌱 Seeds</button>
              </div>
            </div>
            <div className="sell-row">
              <label>Item</label>
              <select value={sellItem} onChange={e=>setSellItem(e.target.value)} className="sell-select">
                <option value="">-- Select --</option>
                {allSellItems.map(i => (
                  <option key={i} value={i}>{ITEM_EMOJI[i] || "📦"} {i} (x{(sellCategory==="crop"?inventory:seeds)[i]})</option>
                ))}
              </select>
            </div>
            <div className="sell-row">
              <label>Quantity</label>
              <input type="number" min={1} max={(sellCategory==="crop"?inventory:seeds)[sellItem]||1}
                value={sellQty} onChange={e=>setSellQty(Math.max(1,+e.target.value))} className="sell-number" />
            </div>
            <div className="sell-row">
              <label>Price per unit (FARM)</label>
              <input type="number" min={1} value={sellPrice} onChange={e=>setSellPrice(Math.max(1,+e.target.value))} className="sell-number" />
            </div>
            <div className="sell-summary">
              Total: {sellQty * sellPrice} FARM · Listing fee (5%): {Math.ceil(sellQty*sellPrice*0.05)} FARM
            </div>
            <button className="sell-submit-btn" onClick={handleList}>📦 List on Marketplace</button>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="marketplace-content">
            {history.length === 0 && <p className="market-empty">No transactions yet this session.</p>}
            {history.slice().reverse().map((h, i) => (
              <div key={i} className="history-entry">
                <span>{h.type === "buy" ? "🛍️ Bought" : "💰 Sold"}</span>
                <span>{h.qty}x {h.itemType}</span>
                <span className="history-cost">{h.totalCost} FARM</span>
                <span className="history-time">{new Date(h.time).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceModal;
