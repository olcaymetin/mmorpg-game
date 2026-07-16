import React from "react";
import "./LeaderboardModal.css";

interface LeaderboardEntry {
  sessionId: string;
  username: string;
  totalLevel: number;
  skills: Record<string, { level: number }>;
}

interface LeaderboardModalProps {
  players: LeaderboardEntry[];
  mySessionId: string;
  onClose: () => void;
}

const SKILL_EMOJI: Record<string, string> = {
  farming: "🌾", combat: "⚔️", woodcutting: "🪓", mining: "⚒️", fishing: "🎣", crafting: "⚙️"
};

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ players, mySessionId, onClose }) => {
  const sorted = [...players].sort((a, b) => b.totalLevel - a.totalLevel);

  const getMedalColor = (rank: number) => {
    if (rank === 0) return "#FFD700";
    if (rank === 1) return "#C0C0C0";
    if (rank === 2) return "#CD7F32";
    return "rgba(255,255,255,0.4)";
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="leaderboard-modal" onClick={e => e.stopPropagation()}>
        <div className="leaderboard-header">
          <h2>🏆 Leaderboard</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="leaderboard-list">
          {sorted.map((p, i) => (
            <div
              key={p.sessionId}
              className={`leaderboard-entry ${p.sessionId === mySessionId ? "me" : ""}`}
            >
              <span className="lb-rank" style={{ color: getMedalColor(i) }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </span>
              <span className="lb-name">
                {p.username || `Player_${p.sessionId.slice(0, 6)}`}
                {p.sessionId === mySessionId && <span className="lb-you">YOU</span>}
              </span>
              <span className="lb-level">Lv. {p.totalLevel}</span>
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
            <p className="leaderboard-empty">No players online yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardModal;
