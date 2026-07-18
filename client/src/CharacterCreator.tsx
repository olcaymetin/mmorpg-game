import React, { useRef, useEffect, useState, useCallback } from "react";

interface CharOptions {
  gender: "male" | "female";
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  clothesColor: string;
}

interface Props {
  onConfirm: (opts: CharOptions) => void;
}

const P = "/assets/pack/portraits";

const getPortraitLayers = (opts: CharOptions): string[] => {
  const g = opts.gender === "male" ? "Male" : "Female";
  const layers: string[] = [];
  layers.push(`${P}/skins/${g}/${opts.skinTone}.png`);
  layers.push(`${P}/eyes/${opts.eyeColor}.png`);
  const hairDir = opts.hairStyle === "Standard" ? "Standart" : opts.hairStyle;
  layers.push(`${P}/hair/${hairDir}/${opts.hairColor}.png`);
  if (opts.clothesColor) {
    layers.push(`${P}/clothes/${g}/${opts.clothesColor}.png`);
  }
  return layers;
};

const CANVAS_W = 192;
const CANVAS_H = 192;

function useLayeredCanvas(layers: string[]) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.imageSmoothingEnabled = false;

    const loadAll = async () => {
      for (const src of layers) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Draw only the first frame (0, 0, 64, 64) scaled to fit CANVAS_W, CANVAS_H
            ctx.drawImage(img, 0, 0, 64, 64, 0, 0, CANVAS_W, CANVAS_H);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        });
      }
    };
    loadAll();
  }, [layers]);
  return canvasRef;
}

const SKIN_TONES = ["1", "2", "3", "4"] as const;
const HAIR_STYLES = ["Standard", "Fawn", "Iridessa", "Josh", "Lyria", "Sebastian", "Silvermist"] as const;
const HAIR_COLORS = ["Black", "Blonde", "Brown", "Ginger"] as const;
const EYE_COLORS = ["Black", "Blue", "Brown", "Green"] as const;
const CLOTHES_COLORS = ["", "Blue", "Green", "Pink", "Purple", "Red"] as const;

export default function CharacterCreator({ onConfirm }: Props) {
  const [opts, setOpts] = useState<CharOptions>({
    gender: "male",
    skinTone: "1",
    hairStyle: "Standard",
    hairColor: "Black",
    eyeColor: "Black",
    clothesColor: "",
  });

  const layers = getPortraitLayers(opts);
  const canvasRef = useLayeredCanvas(layers);
  const set = useCallback(<K extends keyof CharOptions>(k: K, v: CharOptions[K]) => {
    setOpts((p) => ({ ...p, [k]: v }));
  }, []);

  const gender = opts.gender === "male" ? "Male" : "Female";
  const currentSkinPath = `${P}/skins/${gender}/${opts.skinTone}.png`;
  const currentEyesPath = `${P}/eyes/${opts.eyeColor}.png`;

  // Dynamic CSS previews using layered background images
  const skinSw = (tone: string, active: boolean): React.CSSProperties => ({
    width: 48,
    height: 48,
    borderRadius: 12,
    cursor: "pointer",
    backgroundImage: `url(${P}/skins/${gender}/${tone}.png)`,
    backgroundSize: "500% 300%",
    backgroundPosition: "0% 0%",
    backgroundRepeat: "no-repeat",
    backgroundColor: "rgba(0,0,0,0.3)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    transform: active ? "scale(1.08)" : "none",
    boxShadow: active ? "0 0 0 3px #f0c040, 0 4px 12px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.08)",
    imageRendering: "pixelated",
  });

  const hairSw = (style: string, active: boolean): React.CSSProperties => {
    const hairDir = style === "Standard" ? "Standart" : style;
    const hairPath = `${P}/hair/${hairDir}/${opts.hairColor}.png`;
    return {
      width: 52,
      height: 52,
      borderRadius: 12,
      cursor: "pointer",
      backgroundImage: `url(${hairPath}), url(${currentEyesPath}), url(${currentSkinPath})`,
      backgroundSize: "500% 300%, 500% 300%, 500% 300%",
      backgroundPosition: "0% 0%, 0% 0%, 0% 0%",
      backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      backgroundColor: "rgba(0,0,0,0.3)",
      transition: "all 0.15s ease",
      transform: active ? "scale(1.08)" : "none",
      boxShadow: active ? "0 0 0 3px #f0c040, 0 4px 12px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.08)",
      imageRendering: "pixelated",
    };
  };

  const hairColorSw = (color: string, active: boolean): React.CSSProperties => {
    const hairDir = opts.hairStyle === "Standard" ? "Standart" : opts.hairStyle;
    const hairPath = `${P}/hair/${hairDir}/${color}.png`;
    return {
      width: 48,
      height: 48,
      borderRadius: 12,
      cursor: "pointer",
      backgroundImage: `url(${hairPath}), url(${currentEyesPath}), url(${currentSkinPath})`,
      backgroundSize: "500% 300%, 500% 300%, 500% 300%",
      backgroundPosition: "0% 0%, 0% 0%, 0% 0%",
      backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      backgroundColor: "rgba(0,0,0,0.3)",
      transition: "all 0.15s ease",
      transform: active ? "scale(1.08)" : "none",
      boxShadow: active ? "0 0 0 3px #f0c040, 0 4px 12px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.08)",
      imageRendering: "pixelated",
    };
  };

  const eyeSw = (color: string, active: boolean): React.CSSProperties => {
    const eyesPath = `${P}/eyes/${color}.png`;
    return {
      width: 48,
      height: 48,
      borderRadius: 12,
      cursor: "pointer",
      backgroundImage: `url(${eyesPath}), url(${currentSkinPath})`,
      backgroundSize: "500% 300%, 500% 300%",
      backgroundPosition: "0% 0%, 0% 0%",
      backgroundRepeat: "no-repeat, no-repeat",
      backgroundColor: "rgba(0,0,0,0.3)",
      transition: "all 0.15s ease",
      transform: active ? "scale(1.08)" : "none",
      boxShadow: active ? "0 0 0 3px #f0c040, 0 4px 12px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.08)",
      imageRendering: "pixelated",
    };
  };

  const clothesSw = (color: string, active: boolean): React.CSSProperties => {
    const clothesPath = color ? `${P}/clothes/${gender}/${color}.png` : "";
    const bgImage = clothesPath ? `url(${clothesPath}), url(${currentSkinPath})` : `url(${currentSkinPath})`;
    const bgSize = clothesPath ? "500% 300%, 500% 300%" : "500% 300%";
    const bgPos = "0% 0%, 0% 0%";
    return {
      width: 48,
      height: 48,
      borderRadius: 12,
      cursor: "pointer",
      backgroundImage: bgImage,
      backgroundSize: bgSize,
      backgroundPosition: bgPos,
      backgroundRepeat: "no-repeat, no-repeat",
      backgroundColor: "rgba(0,0,0,0.2)",
      transition: "all 0.15s ease",
      transform: active ? "scale(1.08)" : "none",
      boxShadow: active ? "0 0 0 3px #f0c040, 0 4px 12px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.08)",
      imageRendering: "pixelated",
    };
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #09091e 0%, #141432 100%)",
    padding: "20px",
  };

  const panelStyle: React.CSSProperties = {
    background: "rgba(18, 18, 38, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "24px",
    padding: "36px",
    maxWidth: "880px",
    width: "100%",
    boxShadow: "0 24px 72px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255,255,255,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    maxHeight: "92vh",
    overflowY: "auto",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    textAlign: "center",
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "28px",
    color: "#f0c040",
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    textShadow: "0 0 24px rgba(240,192,64,0.35)",
  };

  const subtitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "13px",
    color: "rgba(255, 255, 255, 0.5)",
    fontFamily: "'Outfit', sans-serif",
  };

  const contentGridStyle: React.CSSProperties = {
    display: "flex",
    gap: "36px",
    flexWrap: "wrap",
  };

  const leftColStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    flex: "0 0 220px",
  };

  const canWrapStyle: React.CSSProperties = {
    borderRadius: "20px",
    overflow: "hidden",
    border: "2px solid rgba(240, 192, 64, 0.4)",
    width: "192px",
    height: "192px",
    background: "rgba(0, 0, 0, 0.4)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const genRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "10px",
    width: "100%",
  };

  const genBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 0",
    borderRadius: "12px",
    border: active ? "1px solid #f0c040" : "1px solid rgba(255, 255, 255, 0.1)",
    background: active ? "rgba(240, 192, 64, 0.15)" : "rgba(255, 255, 255, 0.03)",
    color: active ? "#f0c040" : "rgba(255,255,255,0.6)",
    cursor: "pointer",
    fontSize: "14px",
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 600,
    transition: "all 0.15s ease",
  });

  const rightColStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    minWidth: "280px",
  };

  const sectionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "rgba(255, 255, 255, 0.02)",
    padding: "14px 18px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.03)",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontFamily: "'Outfit', sans-serif",
  };

  const optionsRowStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
  };

  const labelSpanStyle = (active: boolean): React.CSSProperties => ({
    fontSize: "10px",
    fontFamily: "'Outfit', sans-serif",
    color: active ? "#f0c040" : "rgba(255,255,255,0.4)",
    marginTop: "4px",
    textAlign: "center",
    fontWeight: active ? 600 : 400,
  });

  const optionWrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "56px",
  };

  const confirmBtnStyle: React.CSSProperties = {
    padding: "14px 0",
    borderRadius: "16px",
    border: "none",
    background: "linear-gradient(135deg, #f0c040, #e08000)",
    color: "#160e00",
    fontWeight: 800,
    fontSize: "17px",
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
    boxShadow: "0 6px 28px rgba(240, 192, 64, 0.35)",
    transition: "all 0.15s ease",
    marginTop: "10px",
  };

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>🧑‍🌾 Karakterini Oluştur</h2>
          <p style={subtitleStyle}>Maceraya atılmadan önce çiftçini dilediğin gibi özelleştir</p>
        </div>

        <div style={contentGridStyle}>
          {/* Left Column: Preview & Gender */}
          <div style={leftColStyle}>
            <div style={canWrapStyle}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ imageRendering: "pixelated", display: "block" }} />
            </div>
            <div style={genRowStyle}>
              {(["male", "female"] as const).map((g) => (
                <button key={g} style={genBtnStyle(opts.gender === g)} onClick={() => set("gender", g)}>
                  {g === "male" ? "👨 Erkek" : "👩 Kız"}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Customization Sections */}
          <div style={rightColStyle}>
            {/* Ten Rengi */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>🎨 Ten Rengi</div>
              <div style={optionsRowStyle}>
                {SKIN_TONES.map((t) => (
                  <div key={t} style={optionWrapperStyle} onClick={() => set("skinTone", t)}>
                    <div style={skinSw(t, opts.skinTone === t)} />
                    <span style={labelSpanStyle(opts.skinTone === t)}>Ton {t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Göz Rengi */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>👁️ Göz Rengi</div>
              <div style={optionsRowStyle}>
                {EYE_COLORS.map((c) => (
                  <div key={c} style={optionWrapperStyle} onClick={() => set("eyeColor", c)}>
                    <div style={eyeSw(c, opts.eyeColor === c)} />
                    <span style={labelSpanStyle(opts.eyeColor === c)}>{c === "Black" ? "Siyah" : c === "Blue" ? "Mavi" : c === "Brown" ? "Kahve" : "Yeşil"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Saç Stili */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>💇 Saç Stili</div>
              <div style={optionsRowStyle}>
                {HAIR_STYLES.map((s) => {
                  const labelMap: Record<string, string> = {
                    Standard: "Klasik",
                    Fawn: "Fawn",
                    Iridessa: "Iridessa",
                    Josh: "Josh",
                    Lyria: "Lyria",
                    Sebastian: "Sebas",
                    Silvermist: "Silver",
                  };
                  return (
                    <div key={s} style={{ ...optionWrapperStyle, width: "60px" }} onClick={() => set("hairStyle", s)}>
                      <div style={hairSw(s, opts.hairStyle === s)} />
                      <span style={labelSpanStyle(opts.hairStyle === s)}>{labelMap[s]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saç Rengi */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>🎨 Saç Rengi</div>
              <div style={optionsRowStyle}>
                {HAIR_COLORS.map((c) => (
                  <div key={c} style={optionWrapperStyle} onClick={() => set("hairColor", c)}>
                    <div style={hairColorSw(c, opts.hairColor === c)} />
                    <span style={labelSpanStyle(opts.hairColor === c)}>{c === "Black" ? "Siyah" : c === "Blonde" ? "Sarı" : c === "Brown" ? "Kahve" : "Kızıl"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kıyafet */}
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>👕 Kıyafet (Başlangıç)</div>
              <div style={optionsRowStyle}>
                {CLOTHES_COLORS.map((c) => (
                  <div key={c || "naked"} style={optionWrapperStyle} onClick={() => set("clothesColor", c)}>
                    <div style={clothesSw(c, opts.clothesColor === c)} />
                    <span style={labelSpanStyle(opts.clothesColor === c)}>{c === "" ? "Çıplak" : c === "Blue" ? "Mavi" : c === "Green" ? "Yeşil" : c === "Pink" ? "Pembe" : c === "Purple" ? "Mor" : "Kırmızı"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button style={confirmBtnStyle} onClick={() => onConfirm(opts)}>✅ Oyuna Başla!</button>
      </div>
    </div>
  );
}
