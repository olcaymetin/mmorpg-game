import React, { useState, useEffect } from "react";
import "./CraftTimer.css";

export interface CraftTimerEntry {
  id: string;
  label: string;
  emoji: string;
  durationMs: number;
  startedAt: number;
}

interface CraftTimerProps {
  timers: CraftTimerEntry[];
  onRemove: (id: string) => void;
  onInstant?: (id: string, remainingSeconds: number) => void;
}

const CraftTimer: React.FC<CraftTimerProps> = ({ timers, onRemove, onInstant }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // Auto-remove completed timers
  useEffect(() => {
    timers.forEach(t => {
      const elapsed = now - t.startedAt;
      if (elapsed >= t.durationMs) {
        setTimeout(() => onRemove(t.id), 1200);
      }
    });
  }, [now, timers, onRemove]);

  if (timers.length === 0) return null;

  return (
    <div className="craft-timer-stack">
      {timers.map(t => {
        const elapsed = now - t.startedAt;
        const progress = Math.min(1, elapsed / t.durationMs);
        const remaining = Math.max(0, Math.ceil((t.durationMs - elapsed) / 1000));
        const done = progress >= 1;
        const instantCost = Math.max(1, Math.ceil(remaining / 10));

        return (
          <div key={t.id} className={`craft-timer-card ${done ? "done" : ""}`}>
            <span className="craft-timer-emoji">{t.emoji}</span>
            <div className="craft-timer-info">
              <span className="craft-timer-label">{t.label}</span>
              {done ? (
                <span className="craft-timer-done">✅ Tamamlandı!</span>
              ) : (
                <div className="craft-timer-row">
                  <span className="craft-timer-remaining">{remaining}s kaldı</span>
                  {onInstant && (
                    <button
                      className="craft-timer-instant-btn"
                      onClick={() => onInstant(t.id, remaining)}
                      title="Anında bitir"
                    >
                      ⚡ {instantCost} FARM
                    </button>
                  )}
                </div>
              )}
              <div className="craft-timer-bar">
                <div className="craft-timer-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CraftTimer;
