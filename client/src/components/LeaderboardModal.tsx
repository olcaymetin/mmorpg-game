import React, { useState } from "react";
import "./LeaderboardModal.css";

interface LeaderboardEntry {
  sessionId: string;
  username: string;
  totalLevel: number;
  gold: number;
  gem: number;
  coin: number;
  marketSaleCount: number;
  skills: Record<string, { level: number }>;
}

interface LeaderboardModalProps {
  players: LeaderboardEntry[];
  mySessionId: string;
  onClose: () => void;
  onPlayerClick?: (sessionId: string) => void;
}

type TabType = "level" | "wealth" | "farming" | "fishing" | "crafting" | "combat" | "sales" | "coin";

const SKILL_EMOJI: Record<string, string> = {
  farming: "🌾", combat: "⚔️", woodcutting: "🪓", mining: "⚒️", fishing: "🎣", crafting: "⚙️"
};

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ players, mySessionId, onClose, onPlayerClick }) => {
  const [activeTab, setActiveTab] = useState<TabType>("level");

  // Calculate sort value and primary display text based on active tab
  const getSortValue = (p: LeaderboardEntry): number => {
    switch (activeTab) {
      case "level":
        return p.totalLevel;
      case "wealth":
        return (p.gold || 0) + (p.coin || 0) * 1 + (p.gem || 0) * 100;
      case "coin":
        return p.coin || 0;
      case "sales":
        return p.marketSaleCount || 0;
      case "farming":
      case "fishing":
      case "crafting":
      case "combat":
        return p.skills[activeTab]?.level || 1;
      default:
        return 0;
    }
  };

  const getDisplayValue = (p: LeaderboardEntry): string => {
    switch (activeTab) {
      case "level":
        return `Lv. ${p.totalLevel}`;
      case "wealth":
        const totalWealth = (p.gold || 0) + (p.coin || 0) * 1 + (p.gem || 0) * 100;
        return `${totalWealth} Wealth`;
      case "coin":
        return `${p.coin || 0} FARM`;
      case "sales":
        return `${p.marketSaleCount || 0} Satış`;
      case "farming":
        return `🌾 Lv. ${p.skills.farming?.level || 1}`;
      case "fishing":
        return `🎣 Lv. ${p.skills.fishing?.level || 1}`;
      case "crafting":
        return `⚙️ Lv. ${p.skills.crafting?.level || 1}`;
      case "combat":
        return `⚔️ Lv. ${p.skills.combat?.level || 1}`;
      default:
        return "";
    }
  };

  const sorted = [...players].sort((a, b) => getSortValue(b) - getSortValue(a));

  const getMedalColor = (rank: number) => {
    if (rank === 0) return "#FFD700";
    if (rank === 1) return "#C0C0C0";
    if (rank === 2) return "#CD7F32";
    return "rgba(255,255,255,0.4)";
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "level", label: "🎖️ Seviye" },
    { id: "wealth", label: "💰 Zenginlik" },
    { id: "farming", label: "🌾 Çiftçi" },
    { id: "fishing", label: "🎣 Balıkçı" },
    { id: "crafting", label: "⚙️ Craft" },
    { id: "combat", label: "⚔️ Savaş" },
    { id: "sales", label: "🛒 Satış" },
    { id: "coin", label: "🪙 FARM Coin" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="leaderboard-modal" onClick={e => e.stopPropagation()}>
        <div className="leaderboard-header">
          <h2>🏆 Leaderboard</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="leaderboard-tabs-bar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`lb-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="leaderboard-list">
          {sorted.map((p, i) => (
            <div
              key={p.sessionId}
              className={`leaderboard-entry ${p.sessionId === mySessionId ? "me" : ""}`}
              onClick={() => onPlayerClick && onPlayerClick(p.sessionId)}
              style={{ cursor: onPlayerClick ? "pointer" : "default" }}
            >
              <span className="lb-rank" style={{ color: getMedalColor(i) }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </span>
              <span className="lb-name">
                {p.username || `Player_${p.sessionId.slice(0, 6)}`}
                {p.sessionId === mySessionId && <span className="lb-you">SEN</span>}
              </span>
              <span className="lb-level">{getDisplayValue(p)}</span>
              <div className="lb-skills">
                {Object.entries(p.skills || {}).map(([skill, s]) => (
                  <span key={skill} title={skill} className="lb-skill-chip">
                    {SKILL_EMOJI[skill] || "❓"} {s.level}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="leaderboard-empty">Henüz oyuncu bulunmuyor.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardModal;
