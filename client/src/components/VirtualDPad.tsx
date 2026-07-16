import React from "react";
import "./VirtualDPad.css";

interface VirtualDPadProps {
  game: any;
}

const VirtualDPad: React.FC<VirtualDPadProps> = ({ game }) => {
  const setDirection = (dir: "up" | "down" | "left" | "right", active: boolean) => {
    if (!game) return;
    const scene = game.scene.getScene("GameScene") as any;
    if (scene) {
      if (dir === "up") scene.virtualUp = active;
      if (dir === "down") scene.virtualDown = active;
      if (dir === "left") scene.virtualLeft = active;
      if (dir === "right") scene.virtualRight = active;
    }
  };

  const handleStart = (dir: "up" | "down" | "left" | "right", e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDirection(dir, true);
  };

  const handleEnd = (dir: "up" | "down" | "left" | "right") => {
    setDirection(dir, false);
  };

  return (
    <div className="dpad-container" aria-label="Virtual Controls">
      <div className="dpad-cross">
        {/* Up Button */}
        <button
          className="dpad-btn dpad-up"
          onMouseDown={(e) => handleStart("up", e)}
          onMouseUp={() => handleEnd("up")}
          onMouseLeave={() => handleEnd("up")}
          onTouchStart={(e) => handleStart("up", e)}
          onTouchEnd={() => handleEnd("up")}
          onTouchCancel={() => handleEnd("up")}
          aria-label="Move Up"
        >
          <svg viewBox="0 0 24 24" className="arrow-svg">
            <path d="M12 4l-8 8h6v8h4v-8h6z" />
          </svg>
        </button>

        {/* Left Button */}
        <button
          className="dpad-btn dpad-left"
          onMouseDown={(e) => handleStart("left", e)}
          onMouseUp={() => handleEnd("left")}
          onMouseLeave={() => handleEnd("left")}
          onTouchStart={(e) => handleStart("left", e)}
          onTouchEnd={() => handleEnd("left")}
          onTouchCancel={() => handleEnd("left")}
          aria-label="Move Left"
        >
          <svg viewBox="0 0 24 24" className="arrow-svg">
            <path d="M4 12l8-8v6h8v4h-8v6z" />
          </svg>
        </button>

        {/* Center Core Decorator */}
        <div className="dpad-center" />

        {/* Right Button */}
        <button
          className="dpad-btn dpad-right"
          onMouseDown={(e) => handleStart("right", e)}
          onMouseUp={() => handleEnd("right")}
          onMouseLeave={() => handleEnd("right")}
          onTouchStart={(e) => handleStart("right", e)}
          onTouchEnd={() => handleEnd("right")}
          onTouchCancel={() => handleEnd("right")}
          aria-label="Move Right"
        >
          <svg viewBox="0 0 24 24" className="arrow-svg">
            <path d="M20 12l-8 8v-6h-8v-4h8v-6z" />
          </svg>
        </button>

        {/* Down Button */}
        <button
          className="dpad-btn dpad-down"
          onMouseDown={(e) => handleStart("down", e)}
          onMouseUp={() => handleEnd("down")}
          onMouseLeave={() => handleEnd("down")}
          onTouchStart={(e) => handleStart("down", e)}
          onTouchEnd={() => handleEnd("down")}
          onTouchCancel={() => handleEnd("down")}
          aria-label="Move Down"
        >
          <svg viewBox="0 0 24 24" className="arrow-svg">
            <path d="M12 20l8-8h-6v-8h-4v8h-6z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VirtualDPad;
