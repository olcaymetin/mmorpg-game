import { useState, useEffect, useRef } from "react";
import * as Colyseus from "colyseus.js";
import { GameState } from "../game/schema/GameState";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseColyseusReturn {
  room: Colyseus.Room<GameState> | null;
  sessionId: string | null;
  connected: boolean;
  playerCount: number;
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useColyseus — manages the WebSocket connection lifecycle to the game server.
 *
 * - Creates a Colyseus.Client pointing to the same hostname as the page
 *   (works for localhost AND LAN IP, so friends can join without code changes)
 * - Joins or creates the "game_room" room
 * - Exposes the room, sessionId, connection status, and player count
 * - Cleans up (leaves room) when the component unmounts
 */
export function useColyseus(): UseColyseusReturn {
  const [room, setRoom] = useState<Colyseus.Room<GameState> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref so the cleanup function can call .leave()
  const roomRef = useRef<Colyseus.Room<GameState> | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        // Smart URL detection:
        // - Dev mode (Vite on :5173): connect to ws://localhost:2567
        // - Tunnel/production (served from Express): connect to same host, auto wss/ws
        const serverHost = window.location.hostname;
        const isDevMode = window.location.port === "5173";
        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsURL = isDevMode
          ? `ws://${serverHost}:2567`
          : `${wsProtocol}://${serverHost}`;
        const client = new Colyseus.Client(wsURL);

        // joinOrCreate: joins an existing room or creates a new one
        const r = await client.joinOrCreate<GameState>("game_room");

        // Guard against React StrictMode double-mount unmounting before this resolves
        if (!mounted) {
          r.leave();
          return;
        }

        roomRef.current = r;
        setRoom(r);
        setSessionId(r.sessionId);
        setConnected(true);
        setError(null);

        // Track player count via full state change callback
        r.onStateChange((state: GameState) => {
          setPlayerCount(state.players.size);
        });

        r.onLeave(() => {
          if (!mounted) return;
          setConnected(false);
          setRoom(null);
          setSessionId(null);
        });

        r.onError((code: number, msg?: string) => {
          if (!mounted) return;
          setError(`Server error [${code}]: ${msg ?? "unknown"}`);
        });
      } catch (e: unknown) {
        if (!mounted) return;
        setError(
          [
            "Cannot connect to game server.",
            "Make sure the server is running:\n  cd server && npm run dev",
            "",
            e instanceof Error ? e.message : String(e),
          ].join("\n")
        );
      }
    };

    connect();

    return () => {
      mounted = false;
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, []); // intentionally empty — connect once on mount

  return { room, sessionId, connected, playerCount, error };
}
