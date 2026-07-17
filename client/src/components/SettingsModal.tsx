import React, { useState } from "react";
import "./SettingsModal.css";

// no-op

interface SettingsModalProps {
  room: any;
  myUsername: string;
  usernameSet: boolean;
  gem: number;
  skills: Record<string, { level: number; xp: number }>;
  skillBoosts: Record<string, number>;
  language: string;
  onLanguageChange: (lang: string) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { id: "en", label: "🇬🇧 English" },
  { id: "tr", label: "🇹🇷 Türkçe" },
  { id: "es", label: "🇪🇸 Español" },
  { id: "zh", label: "🇨🇳 中文" },
  { id: "ar", label: "🇸🇦 العربية" },
  { id: "de", label: "🇩🇪 Deutsch" },
  { id: "fr", label: "🇫🇷 Français" },
  { id: "pt", label: "🇵🇹 Português" },
  { id: "ja", label: "🇯🇵 日本語" },
];

const SKILLS = ["farming", "combat", "woodcutting", "mining", "fishing", "crafting"];
const SKILL_EMOJI: Record<string, string> = {
  farming: "🌾", combat: "⚔️", woodcutting: "🪓", mining: "⚒️", fishing: "🎣", crafting: "⚙️"
};

const BOOST_TIERS = [
  { cost: 1,  bonus: 5,   label: "+5% XP" },
  { cost: 5,  bonus: 15,  label: "+15% XP" },
  { cost: 10, bonus: 30,  label: "+30% XP" },
  { cost: 25, bonus: 60,  label: "+60% XP" },
  { cost: 50, bonus: 100, label: "+100% XP" },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  room, myUsername, usernameSet, gem, skills, skillBoosts, language, onLanguageChange, onClose
}) => {
  const [settingsTab, setSettingsTab] = useState<"general" | "skills">("general");
  const [usernameInput, setUsernameInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("farming");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const handleSetUsername = () => {
    if (usernameInput.trim().length < 3) { showMsg("Username must be 3-20 characters."); return; }
    setShowConfirm(true);
  };

  const confirmUsername = () => {
    room.send("set-username", { username: usernameInput.trim() });
    setShowConfirm(false);
    room.onMessage("username-accepted", (d: any) => showMsg(`✅ Username set to "${d.username}"`));
    room.onMessage("username-error",    (d: any) => showMsg(`❌ ${d.message}`));
  };

  const handleBoost = (tierIndex: number) => {
    const cost = BOOST_TIERS[tierIndex].cost;
    if (gem < cost) { showMsg(`❌ Need ${cost} Gem. You have ${gem}.`); return; }
    room.send("skill-boost", { skill: selectedSkill, tierIndex });
    room.onMessage("boost-error", (d: any) => showMsg(`❌ ${d.message}`));
    showMsg(`✅ Applied ${BOOST_TIERS[tierIndex].label} boost to ${selectedSkill}!`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {msg && <div className={`settings-msg ${msg.startsWith("❌") ? "error" : "success"}`}>{msg}</div>}

        <div className="settings-tabs">
          <button className={settingsTab==="general"?"active":""} onClick={()=>setSettingsTab("general")}>🔧 General</button>
          <button className={settingsTab==="skills"?"active":""} onClick={()=>setSettingsTab("skills")}>⚡ Skill Boost</button>
        </div>

        {/* GENERAL TAB */}
        {settingsTab === "general" && (
          <div className="settings-content">
            {/* Username */}
            <div className="settings-section">
              <h3>👤 Username</h3>
              {usernameSet ? (
                <div className="username-display">
                  <span className="username-value">{myUsername}</span>
                  <span className="username-locked">🔒 Permanent — cannot be changed</span>
                </div>
              ) : (
                <div className="username-set-form">
                  <input
                    className="settings-input"
                    placeholder="Choose your username (3-20 chars)"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value.slice(0, 20))}
                    maxLength={20}
                  />
                  <button className="settings-btn" onClick={handleSetUsername}>Set Username</button>
                  {showConfirm && (
                    <div className="confirm-box">
                      <p>⚠️ Username <strong>"{usernameInput}"</strong> cannot be changed after confirmation. Are you sure?</p>
                      <div className="confirm-btns">
                        <button className="confirm-yes" onClick={confirmUsername}>✅ Yes, Confirm</button>
                        <button className="confirm-no"  onClick={()=>setShowConfirm(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Language */}
            <div className="settings-section">
              <h3>🌍 Game Language</h3>
              <div className="lang-grid">
                {LANGUAGES.map(l => (
                  <button
                    key={l.id}
                    className={`lang-btn ${language === l.id ? "active" : ""}`}
                    onClick={() => onLanguageChange(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SKILL BOOST TAB */}
        {settingsTab === "skills" && (
          <div className="settings-content">
            <div className="boost-gem-display">💎 {gem} Gem available</div>
            <p className="boost-desc">Purchase permanent XP multipliers for each profession using Gems. Boosts stack!</p>

            {/* Skill selector */}
            <div className="skill-selector">
              {SKILLS.map(s => (
                <button
                  key={s}
                  className={`skill-sel-btn ${selectedSkill === s ? "active" : ""}`}
                  onClick={() => setSelectedSkill(s)}
                >
                  <span>{SKILL_EMOJI[s]}</span>
                  <span>{s}</span>
                  <span className="skill-lv">Lv.{skills[s]?.level || 1}</span>
                  {(skillBoosts[s] || 0) > 0 && <span className="skill-boost-badge">+{skillBoosts[s]}%</span>}
                </button>
              ))}
            </div>

            {/* Boost tiers */}
            <div className="boost-tiers">
              <h4>Boost "{selectedSkill}" — current: +{skillBoosts[selectedSkill] || 0}% XP</h4>
              {BOOST_TIERS.map((tier, i) => (
                <button
                  key={i}
                  className={`boost-tier-btn ${gem < tier.cost ? "disabled" : ""}`}
                  onClick={() => handleBoost(i)}
                  disabled={gem < tier.cost}
                >
                  <span className="boost-tier-label">{tier.label}</span>
                  <span className="boost-tier-cost">💎 {tier.cost} Gem</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
