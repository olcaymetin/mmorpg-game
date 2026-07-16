import React, { useState, useEffect } from "react";
import "./GuildPanel.css";

interface GuildMember {
  sessionId: string;
  username: string;
  role: string;
}

interface GuildInfo {
  id: string;
  name: string;
  level: number;
  xp: number;
  ownerId: string;
  members: GuildMember[];
}

interface GuildPanelProps {
  room: any;
  coin: number;
  mySessionId: string;
}

const GuildPanel: React.FC<GuildPanelProps> = ({ room, coin, mySessionId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [myGuild, setMyGuild] = useState<GuildInfo | null>(null);
  const [allGuilds, setAllGuilds] = useState<{ id: string; name: string; memberCount: number }[]>([]);
  const [newGuildName, setNewGuildName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const showMsg = (m: string, isErr = false) => {
    if (isErr) { setErrorMsg(m); setTimeout(() => setErrorMsg(""), 4000); }
    else { setSuccessMsg(m); setTimeout(() => setSuccessMsg(""), 4000); }
  };

  useEffect(() => {
    if (!room) return;

    const syncGuilds = () => {
      const player = room.state.players.get(mySessionId);
      const guildsList: { id: string; name: string; memberCount: number }[] = [];
      let foundMyGuild: GuildInfo | null = null;

      room.state.guilds.forEach((g: any, gId: string) => {
        // Collect members
        const membersList: GuildMember[] = [];
        g.members.forEach((username: string, sid: string) => {
          membersList.push({
            sessionId: sid,
            username,
            role: g.ownerId === sid ? "Kurucu" : "Üye"
          });
        });

        guildsList.push({
          id: g.id,
          name: g.name,
          memberCount: g.members.size
        });

        if (player && player.guildId === gId) {
          foundMyGuild = {
            id: g.id,
            name: g.name,
            level: g.level,
            xp: g.xp,
            ownerId: g.ownerId,
            members: membersList
          };
        }
      });

      setAllGuilds(guildsList);
      setMyGuild(foundMyGuild);
    };

    syncGuilds();
    const unsub = room.onStateChange(syncGuilds);

    room.onMessage("guild-error", (d: any) => showMsg(d.message, true));
    room.onMessage("guild-created", () => showMsg("🎉 Klan başarıyla kuruldu!"));

    return () => {
      unsub();
    };
  }, [room, mySessionId]);

  const handleCreateGuild = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGuildName.trim().length < 3) {
      showMsg("Klan adı en az 3 karakter olmalıdır.", true);
      return;
    }
    if (coin < 100) {
      showMsg("Klan kurmak için 100 FARM Coin gerekir.", true);
      return;
    }
    room.send("guild-create", { name: newGuildName.trim() });
    setNewGuildName("");
  };

  const handleJoinGuild = (guildId: string) => {
    room.send("guild-join", { guildId });
  };

  const handleLeaveGuild = () => {
    if (window.confirm("Klandan çıkmak istediğinize emin misiniz?")) {
      room.send("guild-leave");
      setMyGuild(null);
    }
  };

  return (
    <div className="guild-panel-wrapper">
      <button className="guild-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        🏰 Klan
      </button>

      {isOpen && (
        <div className="guild-panel">
          <div className="guild-header">
            <h3>🏰 Klan Sistemi</h3>
            <button className="guild-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {errorMsg && <div className="guild-msg error">{errorMsg}</div>}
          {successMsg && <div className="guild-msg success">{successMsg}</div>}

          {myGuild ? (
            /* Inside Guild View */
            <div className="guild-inside-view">
              <div className="guild-meta-info">
                <h4>{myGuild.name}</h4>
                <div className="guild-level-tag">Lv. {myGuild.level}</div>
              </div>

              {/* Members List */}
              <div className="guild-members-section">
                <h5>Klan Üyeleri ({myGuild.members.length} / 20)</h5>
                <div className="guild-members-list">
                  {myGuild.members.map(m => (
                    <div key={m.sessionId} className={`member-card ${m.sessionId === mySessionId ? "me" : ""}`}>
                      <span className="member-name">{m.username}</span>
                      <span className={`member-role ${m.role === "Kurucu" ? "owner" : ""}`}>{m.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="guild-actions-footer">
                <button className="leave-guild-btn" onClick={handleLeaveGuild}>
                  🚪 Klandan Ayrıl
                </button>
              </div>
            </div>
          ) : (
            /* Outside Guild View - Create or Join */
            <div className="guild-outside-view">
              {/* Create Guild */}
              <form className="guild-create-form" onSubmit={handleCreateGuild}>
                <h5>Klan Kur (Maliyet: 100 FARM)</h5>
                <div className="guild-create-input-row">
                  <input
                    value={newGuildName}
                    onChange={e => setNewGuildName(e.target.value.slice(0, 16))}
                    placeholder="Klan adı girin..."
                    maxLength={16}
                  />
                  <button type="submit">Kur</button>
                </div>
              </form>

              {/* Join Guild */}
              <div className="guild-list-section">
                <h5>Aktif Klanlar ({allGuilds.length})</h5>
                {allGuilds.length === 0 ? (
                  <p className="guilds-empty">Henüz kurulmuş klan yok.</p>
                ) : (
                  <div className="guilds-list">
                    {allGuilds.map(g => (
                      <div key={g.id} className="guild-join-card">
                        <div className="guild-join-info">
                          <span className="guild-join-name">{g.name}</span>
                          <span className="guild-join-count">{g.memberCount} / 20 Üye</span>
                        </div>
                        <button className="guild-join-btn" onClick={() => handleJoinGuild(g.id)}>
                          Katıl
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GuildPanel;
