import React, { useState } from "react";
import "./PlayerProfileModal.css";

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  unlockedAt: number;
}

interface PlayerProfileModalProps {
  player: {
    sessionId: string;
    username: string;
    totalLevel: number;
    color: string;
    skin: string;
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    rodTier: number;
    marketSaleCount: number;
    marketSaleVolume: number;
    skills: Record<string, { level: number; xp: number }>;
    actionCounts: Record<string, number>;
    achievements: Achievement[];
  };
  isMe: boolean;
  isFriend: boolean;
  hasSentRequest: boolean;
  onAddFriend: (sessionId: string) => void;
  onReportPlayer?: (targetSessionId: string, category: string) => void;
  onClose: () => void;
}

const SKILL_EMOJIS: Record<string, string> = {
  farming: "🌾 Farming",
  combat: "⚔️ Combat",
  woodcutting: "🪓 Woodcutting",
  mining: "⚒️ Mining",
  fishing: "🎣 Fishing",
  crafting: "⚙️ Crafting"
};

const REPORT_CATEGORIES = [
  { id: "spam", label: "🚫 Spam" },
  { id: "insult", label: "🤬 Hakaret" },
  { id: "cheat", label: "⚡ Hile" },
  { id: "ad", label: "📢 Reklam" }
];

const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  isMe,
  isFriend,
  hasSentRequest,
  onAddFriend,
  onReportPlayer,
  onClose
}) => {
  const [showReport, setShowReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState("");

  const handleReport = (category: string) => {
    if (onReportPlayer) {
      onReportPlayer(player.sessionId, category);
      setReportSuccess("Oyuncu başarıyla bildirildi!");
      setTimeout(() => {
        setReportSuccess("");
        setShowReport(false);
      }, 2500);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <div className="profile-header" style={{ borderBottomColor: player.color }}>
          <div className="profile-avatar-circle" style={{ backgroundColor: player.color }}>
            🧑‍🌾
          </div>
          <div className="profile-identity">
            <h2>{player.username || `Player_${player.sessionId.slice(0, 6)}`}</h2>
            <span className="profile-title">Seviye {player.totalLevel} Oyuncu</span>
          </div>
          
          <div className="profile-action-btns">
            {!isMe && (
              <>
                {isFriend ? (
                  <span className="relationship-badge friend">🤝 Arkadaş</span>
                ) : hasSentRequest ? (
                  <span className="relationship-badge requested">📨 İstek Gönderildi</span>
                ) : (
                  <button className="add-friend-action" onClick={() => onAddFriend(player.sessionId)}>
                    ➕ Arkadaş Ekle
                  </button>
                )}
                
                <button className="report-player-btn" onClick={() => setShowReport(!showReport)}>
                  🚨 Rapor Et
                </button>
              </>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Report dropdown overlay */}
        {showReport && (
          <div className="report-overlay-box">
            <h4>🚨 Oyuncuyu Rapor Et</h4>
            {reportSuccess ? (
              <p className="report-success-text">{reportSuccess}</p>
            ) : (
              <div className="report-options">
                <p>Lütfen raporlama nedeninizi seçin:</p>
                <div className="report-btns-grid">
                  {REPORT_CATEGORIES.map(cat => (
                    <button key={cat.id} className="report-cat-btn" onClick={() => handleReport(cat.id)}>
                      {cat.label}
                    </button>
                  ))}
                </div>
                <button className="report-cancel" onClick={() => setShowReport(false)}>Vazgeç</button>
              </div>
            )}
          </div>
        )}

        <div className="profile-grid">
          {/* Left Column - Stats & Skills */}
          <div className="profile-left">
            <div className="profile-section">
              <h3>📊 Karakter Özellikleri</h3>
              <div className="profile-stats-list">
                <div className="profile-stat-row">
                  <span>❤️ Can (HP)</span>
                  <strong>{player.hp} / {player.maxHp}</strong>
                </div>
                <div className="profile-stat-row">
                  <span>🛡️ Kalkan</span>
                  <strong>{player.shield} / {player.maxShield}</strong>
                </div>
                <div className="profile-stat-row">
                  <span>🎣 Olta Seviyesi</span>
                  <strong>Tier {player.rodTier} (max {(player.rodTier || 1) * 20} kg)</strong>
                </div>
                <div className="profile-stat-row">
                  <span>🛒 Market Satış Adedi</span>
                  <strong>{player.marketSaleCount || 0}</strong>
                </div>
              </div>
            </div>

            <div className="profile-section">
              <h3>🌾 Meslek Seviyeleri</h3>
              <div className="profile-skills-grid">
                {Object.entries(SKILL_EMOJIS).map(([key, label]) => {
                  const sk = player.skills[key] || { level: 1, xp: 0 };
                  return (
                    <div key={key} className="profile-skill-card">
                      <span className="skill-card-name">{label}</span>
                      <strong className="skill-card-lv">Lv.{sk.level}</strong>
                      <span className="skill-card-xp">{sk.xp} XP</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Achievements */}
          <div className="profile-right">
            <div className="profile-section">
              <h3>🏅 Başarımlar ({player.achievements.filter(a => a.unlocked).length} / {player.achievements.length})</h3>
              <div className="profile-achievements-list">
                {player.achievements.map(ach => (
                  <div key={ach.id} className={`profile-ach-card ${ach.unlocked ? "unlocked" : "locked"}`}>
                    <span className="ach-emoji">{ach.emoji}</span>
                    <div className="ach-info">
                      <span className="ach-name">{ach.name}</span>
                      <span className="ach-desc">{ach.description}</span>
                    </div>
                    {ach.unlocked && <span className="ach-badge">AÇIK</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfileModal;
