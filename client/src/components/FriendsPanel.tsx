import React, { useState, useEffect } from "react";
import "./FriendsPanel.css";

interface FriendsPanelProps {
  room: any;
  players: any[]; // all online players from App.tsx
  mySessionId: string;
}

const FriendsPanel: React.FC<FriendsPanelProps> = ({ room, players, mySessionId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<{ sessionId: string; username: string; online: boolean }[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<{ sessionId: string; username: string }[]>([]);
  const [activeDm, setActiveDm] = useState<{ sessionId: string; username: string } | null>(null);
  const [dmText, setDmText] = useState("");
  const [dmHistory, setDmHistory] = useState<Record<string, { sender: string; text: string; time: number }[]>>({});
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!room) return;

    const syncFriends = () => {
      const myPlayer = room.state.players.get(mySessionId);
      if (!myPlayer) return;

      // Sync Friend Requests
      const reqs: { sessionId: string; username: string }[] = [];
      myPlayer.friendRequests.forEach((val: string, key: string) => {
        reqs.push({ sessionId: key, username: val });
      });
      setIncomingRequests(reqs);

      // Sync Friends List (and check who is online in player map)
      const list: { sessionId: string; username: string; online: boolean }[] = [];
      myPlayer.friends.forEach((val: string, key: string) => {
        const isOnline = room.state.players.has(key);
        list.push({ sessionId: key, username: val, online: isOnline });
      });
      setFriendsList(list);
    };

    syncFriends();

    // Listen to changes
    const unsub = room.onStateChange(() => {
      syncFriends();
    });

    // Listen to incoming DMs
    const handleDm = (msg: { fromSessionId: string; fromName: string; text: string; timestamp: number }) => {
      setDmHistory(prev => {
        const hist = prev[msg.fromSessionId] || [];
        return {
          ...prev,
          [msg.fromSessionId]: [...hist, { sender: msg.fromName, text: msg.text, time: msg.timestamp }]
        };
      });
      if (activeDm?.sessionId !== msg.fromSessionId) {
        setUnreadCount(c => c + 1);
      }
    };
    room.onMessage("dm-received", handleDm);

    return () => {
      unsub();
    };
  }, [room, mySessionId, activeDm]);

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    // Prompt username
    const username = prompt("Arkadaş eklemek istediğiniz oyuncunun adını yazın:");
    if (!username) return;

    // Find sessionId by username
    const found = players.find(p => p.username.toLowerCase() === username.trim().toLowerCase());
    if (!found) {
      alert("Oyuncu bulunamadı ya da çevrimdışı.");
      return;
    }
    if (found.sessionId === mySessionId) {
      alert("Kendinizi arkadaş ekleyemezsiniz.");
      return;
    }

    room.send("friend-request", { targetSessionId: found.sessionId });
    alert("Arkadaşlık isteği gönderildi!");
  };

  const acceptRequest = (fromId: string) => {
    room.send("friend-accept", { fromSessionId: fromId });
  };

  const rejectRequest = (fromId: string) => {
    room.send("friend-reject", { fromSessionId: fromId });
  };

  const sendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmText.trim() || !activeDm) return;
    
    room.send("dm-send", { toSessionId: activeDm.sessionId, text: dmText.trim() });
    
    // Add to local history
    setDmHistory(prev => {
      const hist = prev[activeDm.sessionId] || [];
      return {
        ...prev,
        [activeDm.sessionId]: [...hist, { sender: "Sen", text: dmText.trim(), time: Date.now() }]
      };
    });
    setDmText("");
  };

  return (
    <div className="friends-panel-wrapper">
      <button className="friends-toggle-btn" onClick={() => { setIsOpen(!isOpen); setUnreadCount(0); }}>
        👥 Arkadaşlar {unreadCount > 0 && <span className="friends-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="friends-panel">
          <div className="friends-header">
            <h3>👥 Arkadaşlar</h3>
            <button className="friends-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div className="friends-actions">
            <button className="add-friend-btn" onClick={handleSendRequest}>➕ Arkadaş Ekle</button>
          </div>

          {/* Incoming requests */}
          {incomingRequests.length > 0 && (
            <div className="friends-requests-section">
              <h4>Gelen İstekler ({incomingRequests.length})</h4>
              <div className="requests-list">
                {incomingRequests.map(r => (
                  <div key={r.sessionId} className="request-card">
                    <span>{r.username}</span>
                    <div className="req-btns">
                      <button className="req-btn accept" onClick={() => acceptRequest(r.sessionId)}>Kabul</button>
                      <button className="req-btn reject" onClick={() => rejectRequest(r.sessionId)}>Red</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          <div className="friends-list-section">
            <h4>Arkadaşlarım</h4>
            {friendsList.length === 0 && <p className="friends-empty">Henüz arkadaşınız yok.</p>}
            <div className="friends-list">
              {friendsList.map(f => (
                <div key={f.sessionId} className="friend-card" onClick={() => setActiveDm(f)}>
                  <span className={`online-status-dot ${f.online ? "online" : "offline"}`} />
                  <span className="friend-name">{f.username}</span>
                  <span className="friend-meta">{f.online ? "Çevrimiçi" : "Çevrimdışı"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DM Modal / Overlay */}
      {activeDm && (
        <div className="dm-chatbox">
          <div className="dm-header">
            <span className="dm-title">💬 {activeDm.username} ile Mesajlaşma</span>
            <button className="dm-close" onClick={() => setActiveDm(null)}>✕</button>
          </div>
          <div className="dm-messages">
            {(dmHistory[activeDm.sessionId] || []).map((m, i) => (
              <div key={i} className={`dm-msg ${m.sender === "Sen" ? "mine" : "theirs"}`}>
                <span className="dm-sender">{m.sender}</span>
                <p className="dm-text">{m.text}</p>
              </div>
            ))}
          </div>
          <form className="dm-input-form" onSubmit={sendDm}>
            <input
              className="dm-input"
              value={dmText}
              onChange={e => setDmText(e.target.value)}
              placeholder="Mesaj gönder..."
              maxLength={200}
            />
            <button type="submit" className="dm-send-btn">Gönder</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default FriendsPanel;
