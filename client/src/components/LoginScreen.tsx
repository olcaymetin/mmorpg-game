import React, { useState } from "react";
import "./LoginScreen.css";

interface LoginScreenProps {
  onLogin: (isAdmin: boolean) => void;
}

const ADMIN_PASSWORD = "2202";

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      localStorage.setItem("login_type", "admin");
      onLogin(true);
    } else {
      setError("Wrong password. Try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem("login_type", "guest");
    onLogin(false);
  };

  return (
    <div className="login-screen">
      <div className="login-bg-anim" />
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">🌾</span>
          <h1 className="login-title">FarmWorld MMO</h1>
          <p className="login-subtitle">The multiplayer farming adventure</p>
        </div>

        <div className="login-buttons">
          <button className="login-btn login-btn--phantom" disabled>
            <span className="login-btn-icon">👻</span>
            <span className="login-btn-text">
              <strong>Connect Phantom Wallet</strong>
              <small>Coming Soon</small>
            </span>
            <span className="login-btn-badge">SOON</span>
          </button>

          <button className="login-btn login-btn--guest" onClick={handleGuestLogin}>
            <span className="login-btn-icon">🎮</span>
            <span className="login-btn-text">
              <strong>Play as Guest</strong>
              <small>Quick start — no account needed</small>
            </span>
          </button>

          <button
            className={`login-btn login-btn--admin ${showAdmin ? "active" : ""}`}
            onClick={() => setShowAdmin(!showAdmin)}
          >
            <span className="login-btn-icon">🔑</span>
            <span className="login-btn-text">
              <strong>Admin Login</strong>
              <small>Editor & admin privileges</small>
            </span>
          </button>

          {showAdmin && (
            <form className="admin-form" onSubmit={handleAdminLogin}>
              <input
                type="password"
                className="admin-input"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoFocus
              />
              <button type="submit" className="admin-submit">Unlock →</button>
              {error && <p className="admin-error">{error}</p>}
            </form>
          )}
        </div>

        <p className="login-footer">
          FarmWorld MMO © 2025 · v0.1.0-alpha
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
