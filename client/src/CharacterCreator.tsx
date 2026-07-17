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
  const hairDir = opts.hairStyle === "Standard" ? "Standart" : opts.hairStyle;
  layers.push(`${P}/hair/${hairDir}/${opts.hairColor}.png`);
  if (opts.clothesColor) {
    layers.push(`${P}/clothes/${g}/${opts.clothesColor}.png`);
  }
  return layers;
};

const CANVAS_W = 160;
const CANVAS_H = 192;

function useLayeredCanvas(layers: string[]) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const loadAll = async () => {
      for (const src of layers) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H); resolve(); };
          img.onerror = () => resolve();
          img.src = src;
        });
      }
    };
    loadAll();
  }, [layers]);
  return canvasRef;
}

const SKIN_TONES = ["1","2","3","4"] as const;
const HAIR_STYLES = ["Standard","Fawn","Iridessa","Josh","Lyria","Sebastian","Silvermist"] as const;
const HAIR_COLORS = ["Black","Blonde","Brown","Ginger"] as const;
const EYE_COLORS  = ["Black","Blue","Brown","Green"] as const;
const CLOTHES_COLORS = ["","Blue","Green","Pink","Purple","Red"] as const;

const HAIR_HEX:Record<string,string> = {Black:"#1a1a1a",Blonde:"#f5d97f",Brown:"#8B5E3C",Ginger:"#c94c1a"};
const EYE_HEX:Record<string,string>  = {Black:"#1a1a1a",Blue:"#4a90e2",Brown:"#8B5E3C",Green:"#2ecc71"};
const CLOTHES_HEX:Record<string,string> = {"":"#555",Blue:"#4a90e2",Green:"#27ae60",Pink:"#e91e8c",Purple:"#9b59b6",Red:"#e74c3c"};

export default function CharacterCreator({ onConfirm }: Props) {
  const [opts, setOpts] = useState<CharOptions>({
    gender:"male", skinTone:"1", hairStyle:"Standard", hairColor:"Black", eyeColor:"Black", clothesColor:"",
  });
  const layers = getPortraitLayers(opts);
  const canvasRef = useLayeredCanvas(layers);
  const set = useCallback(<K extends keyof CharOptions>(k:K, v:CharOptions[K]) => setOpts(p=>({...p,[k]:v})),[]);

  const ov:React.CSSProperties = {position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#080818 0%,#181840 100%)"};
  const panel:React.CSSProperties = {background:"rgba(16,16,36,0.98)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"28px 32px",maxWidth:780,width:"95vw",boxShadow:"0 20px 80px rgba(0,0,0,0.8)",display:"flex",flexDirection:"column",gap:20,maxHeight:"92vh",overflowY:"auto"};
  const title:React.CSSProperties = {textAlign:"center",margin:0,fontSize:26,color:"#f0c040",fontFamily:"'Outfit',sans-serif",textShadow:"0 0 20px rgba(240,192,64,0.4)"};
  const body:React.CSSProperties = {display:"flex",gap:28,flexWrap:"wrap"};
  const preCol:React.CSSProperties = {display:"flex",flexDirection:"column",alignItems:"center",gap:12,flex:"0 0 180px"};
  const canWrap:React.CSSProperties = {borderRadius:16,overflow:"hidden",border:"2px solid rgba(240,192,64,0.3)",width:160,height:192,imageRendering:"pixelated"};
  const canv:React.CSSProperties = {imageRendering:"pixelated",display:"block"};
  const genRow:React.CSSProperties = {display:"flex",gap:8};
  const genBtn = (a:boolean):React.CSSProperties => ({padding:"6px 14px",borderRadius:10,border:a?"1px solid #f0c040":"1px solid rgba(255,255,255,0.15)",background:a?"rgba(240,192,64,0.2)":"rgba(255,255,255,0.05)",color:a?"#f0c040":"#ccc",cursor:"pointer",fontSize:13,fontFamily:"'Outfit',sans-serif"});
  const optCol:React.CSSProperties = {flex:1,display:"flex",flexDirection:"column",gap:14,minWidth:240};
  const sec:React.CSSProperties = {display:"flex",flexDirection:"column",gap:6};
  const secT:React.CSSProperties = {fontSize:11,fontWeight:700,color:"#777",letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif"};
  const chipRow:React.CSSProperties = {display:"flex",flexWrap:"wrap",gap:6};
  const chip = (a:boolean):React.CSSProperties => ({padding:"4px 12px",borderRadius:20,border:a?"1px solid #f0c040":"1px solid rgba(255,255,255,0.12)",background:a?"rgba(240,192,64,0.18)":"rgba(255,255,255,0.04)",color:a?"#f0c040":"#bbb",cursor:"pointer",fontSize:12,fontFamily:"'Outfit',sans-serif"});
  const swatchW:React.CSSProperties = {display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"};
  const swatch = (bg:string,a:boolean):React.CSSProperties => ({width:28,height:28,borderRadius:8,backgroundColor:bg,outline:a?"3px solid #f0c040":"2px solid rgba(255,255,255,0.1)"});
  const swL:React.CSSProperties = {fontSize:9,fontFamily:"'Outfit',sans-serif",color:"#999"};
  const skinSw = (tone:string,a:boolean):React.CSSProperties => ({width:44,height:44,borderRadius:10,cursor:"pointer",backgroundImage:`url(/assets/pack/portraits/skins/${opts.gender==="male"?"Male":"Female"}/${tone}.png)`,backgroundSize:"cover",backgroundPosition:"center top",outline:a?"3px solid #f0c040":"2px solid rgba(255,255,255,0.15)",imageRendering:"pixelated"});
  const confirmBtn:React.CSSProperties = {padding:"13px 0",borderRadius:14,border:"none",background:"linear-gradient(135deg,#f0c040,#e08000)",color:"#1a1000",fontWeight:700,fontSize:16,cursor:"pointer",fontFamily:"'Outfit',sans-serif",boxShadow:"0 4px 24px rgba(240,192,64,0.3)"};

  return (
    <div style={ov}>
      <div style={panel}>
        <h2 style={title}>🧑‍🌾 Karakterini Oluştur</h2>
        <div style={body}>
          <div style={preCol}>
            <div style={canWrap}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={canv}/>
            </div>
            <div style={genRow}>
              {(["male","female"] as const).map(g=>(
                <button key={g} style={genBtn(opts.gender===g)} onClick={()=>set("gender",g)}>
                  {g==="male"?"👨 Erkek":"👩 Kız"}
                </button>
              ))}
            </div>
          </div>
          <div style={optCol}>
            <div style={sec}>
              <div style={secT}>🎨 Ten Rengi</div>
              <div style={{display:"flex",gap:10}}>
                {SKIN_TONES.map(t=><div key={t} style={skinSw(t,opts.skinTone===t)} onClick={()=>set("skinTone",t)}/>)}
              </div>
            </div>
            <div style={sec}>
              <div style={secT}>💇 Saç Stili</div>
              <div style={chipRow}>
                {HAIR_STYLES.map(s=><button key={s} style={chip(opts.hairStyle===s)} onClick={()=>set("hairStyle",s)}>{s}</button>)}
              </div>
            </div>
            <div style={sec}>
              <div style={secT}>🎨 Saç Rengi</div>
              <div style={chipRow}>
                {HAIR_COLORS.map(c=>(
                  <div key={c} style={swatchW} onClick={()=>set("hairColor",c)}>
                    <div style={swatch(HAIR_HEX[c],opts.hairColor===c)}/>
                    <span style={{...swL,color:opts.hairColor===c?"#f0c040":"#999"}}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={sec}>
              <div style={secT}>👁️ Göz Rengi</div>
              <div style={chipRow}>
                {EYE_COLORS.map(c=>(
                  <div key={c} style={swatchW} onClick={()=>set("eyeColor",c)}>
                    <div style={swatch(EYE_HEX[c],opts.eyeColor===c)}/>
                    <span style={{...swL,color:opts.eyeColor===c?"#f0c040":"#999"}}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={sec}>
              <div style={secT}>👕 Kıyafet (Başlangıç)</div>
              <div style={chipRow}>
                {CLOTHES_COLORS.map(c=>(
                  <div key={c||"naked"} style={swatchW} onClick={()=>set("clothesColor",c)}>
                    <div style={swatch(CLOTHES_HEX[c],opts.clothesColor===c)}/>
                    <span style={{...swL,color:opts.clothesColor===c?"#f0c040":"#999"}}>{c||"Çıplak"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <button style={confirmBtn} onClick={()=>onConfirm(opts)}>✅ Oyuna Başla!</button>
      </div>
    </div>
  );
}
