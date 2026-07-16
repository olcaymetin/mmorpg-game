import React, { useState, useEffect, useRef } from "react";
import "./ChatPanel.css";

interface ChatMsg {
  id: string;
  senderName: string;
  channel: string;
  text: string;
  timestamp: number;
}

interface DM {
  fromSessionId: string;
  fromName: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  room: any;
  myName: string;
}

const CHANNELS = [
  { id: "global", label: "🌍 Global" },
  { id: "tr",     label: "🇹🇷 Türkçe" },
  { id: "en",     label: "🇬🇧 English" },
  { id: "es",     label: "🇪🇸 Español" },
  { id: "zh",     label: "🇨🇳 中文" },
  { id: "ar",     label: "🇸🇦 العربية" },
  { id: "de",     label: "🇩🇪 Deutsch" },
  { id: "fr",     label: "🇫🇷 Français" },
  { id: "pt",     label: "🇵🇹 Português" },
  { id: "ja",     label: "🇯🇵 日本語" },
];

const ChatPanel: React.FC<ChatPanelProps> = ({ room, myName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState("global");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [dms, setDms] = useState<DM[]>([]);
  const [dmOpen, setDmOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!room) return;
    const onStateChange = () => {
      const msgs: ChatMsg[] = [];
      room.state.chatMessages.forEach((m: any) => {
        msgs.push({
          id: m.id,
          senderName: m.senderName,
          channel: m.channel,
          text: m.text,
          timestamp: m.timestamp,
        });
      });
      setMessages(msgs);
      if (!isOpen) setUnread(u => u + 1);
    };
    room.state.chatMessages.onAdd(() => onStateChange());

    // DM listener
    room.onMessage("dm-received", (msg: DM) => {
      setDms(prev => [...prev, msg]);
      if (!dmOpen) setUnread(u => u + 1);
    });

    return () => {};
  }, [room, isOpen, dmOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !room) return;
    room.send("chat-message", { channel, text });
    setInput("");
  };

  const filtered = messages.filter(m => m.channel === channel || m.channel === "global" && channel === "global");
  const channelFiltered = channel === "global" ? messages : messages.filter(m => m.channel === channel);

  return (
    <div className="chat-panel-wrapper">
      {/* Toggle button */}
      <button className="chat-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        💬 Chat
        {unread > 0 && <span className="chat-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {isOpen && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <span className="chat-header-title">💬 Global Chat</span>
            <button className="chat-close-btn" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* Channel tabs */}
          <div className="chat-channels">
            {CHANNELS.map(ch => (
              <button
                key={ch.id}
                className={`chat-channel-btn ${channel === ch.id ? "active" : ""}`}
                onClick={() => setChannel(ch.id)}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {channelFiltered.length === 0 && (
              <p className="chat-empty">No messages yet. Say hello! 👋</p>
            )}
            {channelFiltered.map(m => (
              <div key={m.id} className="chat-message">
                <span className="chat-sender">{m.senderName}</span>
                <span className="chat-text">{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form className="chat-input-form" onSubmit={sendMessage}>
            <input
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Message [${CHANNELS.find(c => c.id === channel)?.label || channel}]…`}
              maxLength={200}
            />
            <button type="submit" className="chat-send-btn">➤</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
