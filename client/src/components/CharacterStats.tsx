import React from "react";
import "./CharacterStats.css";

interface CharacterStatsProps {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  hunger: number;
  maxHunger: number;
  thirst: number;
  maxThirst: number;
  username: string;
  totalLevel: number;
}

const CharacterStats: React.FC<CharacterStatsProps> = ({
  hp,
  maxHp,
  shield,
  maxShield,
  hunger,
  maxHunger,
  thirst,
  maxThirst,
  username,
  totalLevel
}) => {
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, (shield / maxShield) * 100));
  const hungerPct = Math.max(0, Math.min(100, (hunger / maxHunger) * 100));
  const thirstPct = Math.max(0, Math.min(100, (thirst / maxThirst) * 100));

  return (
    <div className="char-stats-container">
      <div className="char-avatar">🧑‍🌾</div>
      <div className="char-details">
        <div className="char-meta">
          <span className="char-name">{username || "Misafir"}</span>
          <span className="char-level">Lv.{totalLevel}</span>
        </div>
        
        {/* HP Bar */}
        <div className="stat-bar-wrapper">
          <div className="stat-bar hp-bar" style={{ width: `${hpPct}%` }} />
          <span className="stat-text">❤️ {hp}/{maxHp}</span>
        </div>

        {/* Shield Bar */}
        <div className="stat-bar-wrapper">
          <div className="stat-bar shield-bar" style={{ width: `${shieldPct}%` }} />
          <span className="stat-text">🛡️ {shield}/{maxShield}</span>
        </div>

        {/* Hunger Bar */}
        <div className="stat-bar-wrapper">
          <div className="stat-bar hunger-bar" style={{ width: `${hungerPct}%` }} />
          <span className="stat-text">🍗 Açlık: {hunger}/{maxHunger}</span>
        </div>

        {/* Thirst Bar */}
        <div className="stat-bar-wrapper">
          <div className="stat-bar thirst-bar" style={{ width: `${thirstPct}%` }} />
          <span className="stat-text">💧 Susuzluk: {thirst}/{maxThirst}</span>
        </div>
      </div>
    </div>
  );
};

export default CharacterStats;
