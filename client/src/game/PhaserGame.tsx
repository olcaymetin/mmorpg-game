import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { GameState } from "./schema/GameState";
import { GameScene } from "./scenes/GameScene";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhaserGameProps {
  room: Room<GameState>;
  sessionId: string;
  onGameReady: (game: Phaser.Game) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * PhaserGame — React component that hosts a Phaser.Game instance.
 *
 * Design decisions:
 *  - The game is created ONCE (empty deps array in useEffect).
 *  - Scenes are NOT listed in the Phaser config; instead we add "GameScene"
 *    manually after the READY event so we can pass `room` and `sessionId`
 *    as init data via game.scene.add(key, class, autoStart, initData).
 *  - On unmount, game.destroy(true) cleans up the canvas and all listeners.
 *  - pixelArt: true + antialias: false gives the crisp retro pixel look.
 */
export const PhaserGame: React.FC<PhaserGameProps> = ({ room, sessionId, onGameReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // Guard: avoid double-init (React StrictMode runs effects twice in dev)
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,          // WebGL → Canvas fallback
      parent: containerRef.current,
      backgroundColor: "#1a3d0a",
      scene: [],                  // No scenes — added manually below
      scale: {
        mode: Phaser.Scale.RESIZE,        // Automatically resize canvas to fit container
        width: "100%",
        height: "100%",
      },
      render: {
        pixelArt: true,    // Crisp pixel rendering — no bilinear smoothing
        antialias: false,
      },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    /**
     * Wait for Phaser to finish booting before adding the scene.
     * game.scene.add(key, class, autoStart=true, initData) passes
     * `{ room, sessionId }` directly into GameScene.init(data).
     */
    game.events.once(Phaser.Core.Events.READY, () => {
      game.scene.add("GameScene", GameScene, true, { room, sessionId });
      onGameReady(game);
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      id="phaser-container"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
};
