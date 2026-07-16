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
        {/* Up Area Button */}
        <button
          className="dpad-btn dpad-up"
          onMouseDown={(e) => handleStart("up", e)}
          onMouseUp={() => handleEnd("up")}
          onMouseLeave={() => handleEnd("up")}
          onTouchStart={(e) => handleStart("up", e)}
          onTouchEnd={() => handleEnd("up")}
          onTouchCancel={() => handleEnd("up")}
          aria-label="Move Up"
        />

        {/* Left Area Button */}
        <button
          className="dpad-btn dpad-left"
          onMouseDown={(e) => handleStart("left", e)}
          onMouseUp={() => handleEnd("left")}
          onMouseLeave={() => handleEnd("left")}
          onTouchStart={(e) => handleStart("left", e)}
          onTouchEnd={() => handleEnd("left")}
          onTouchCancel={() => handleEnd("left")}
          aria-label="Move Left"
        />

        {/* Right Area Button */}
        <button
          className="dpad-btn dpad-right"
          onMouseDown={(e) => handleStart("right", e)}
          onMouseUp={() => handleEnd("right")}
          onMouseLeave={() => handleEnd("right")}
          onTouchStart={(e) => handleStart("right", e)}
          onTouchEnd={() => handleEnd("right")}
          onTouchCancel={() => handleEnd("right")}
          aria-label="Move Right"
        />

        {/* Down Area Button */}
        <button
          className="dpad-btn dpad-down"
          onMouseDown={(e) => handleStart("down", e)}
          onMouseUp={() => handleEnd("down")}
          onMouseLeave={() => handleEnd("down")}
          onTouchStart={(e) => handleStart("down", e)}
          onTouchEnd={() => handleEnd("down")}
          onTouchCancel={() => handleEnd("down")}
          aria-label="Move Down"
        />
      </div>
    </div>
  );
};

export default VirtualDPad;
