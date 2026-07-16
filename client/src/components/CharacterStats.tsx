import React from "react";
import "./CharacterStats.css";

interface CharacterStatsProps {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  username: string;
  totalLevel: number;
}

const CharacterStats: React.FC<CharacterStatsProps> = ({
  hp,
  maxHp,
  shield,
  maxShield,
  username,
  totalLevel
}) => {
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, (shield / maxShield) * 100));

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
      </div>
    </div>
  );
};

export default CharacterStats;
