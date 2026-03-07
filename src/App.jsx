import { useState, useRef, useCallback, createContext, useContext } from "react";

/* ── Tone colours ─────────────────────────────────────────────────── */
// Set VITE_API_URL in your .env file to your Cloudflare Worker URL
const API_URL = import.meta.env.VITE_API_URL || "https://api.anthropic.com";

const TC = { 1:"#E05C5C", 2:"#4DB882", 3:"#5B8DD9", 4:"#B05CD9", 0:"#999" };

/* ── Theme ────────────────────────────────────────────────────────── */
const DARK = {
  bg:"#0F0E0C", surface:"#161412", surface2:"#1A1714", border:"#2A2420",
  border2:"#3A3028", text:"#E8E0D0", text2:"#C0B090", text3:"#9A8E80",
  muted:"#7A6E60", faint:"#5A5048", fainter:"#4A4038", ghost:"#2A2420",
  accent:"#C0392B", accentBg:"#C0392B22", accentBorder:"#C0392B55",
  inputBg:"#161412", btnText:"#fff", scrollThumb:"#2A2420",
};
const LIGHT = {
  bg:"#F5F0EB", surface:"#FFFFFF", surface2:"#F0EBE4", border:"#D8D0C4",
  border2:"#C8BEB0", text:"#1A1410", text2:"#3A2E20", text3:"#6A5848",
  muted:"#7A6858", faint:"#9A8878", fainter:"#B0A090", ghost:"#E8E0D4",
  accent:"#C0392B", accentBg:"#C0392B18", accentBorder:"#C0392B44",
  inputBg:"#FFFFFF", btnText:"#fff", scrollThumb:"#C8BEB0",
};
const Th = createContext(DARK);
const useT = () => useContext(Th);

/* ── Global CSS ───────────────────────────────────────────────────── */
const globalCSS = (t) => `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${t.bg};}
  input::placeholder{color:${t.fainter};}
  input:focus{border-color:${t.accent} !important;outline:none;}
  textarea:focus{border-color:${t.accent} !important;outline:none;}
  button:disabled{opacity:0.4;cursor:not-allowed;}
  ::-webkit-scrollbar{width:5px;}
  ::-webkit-scrollbar-track{background:${t.bg};}
  ::-webkit-scrollbar-thumb{background:${t.scrollThumb};border-radius:3px;}
  @keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:${t.accent};animation:pulse 1.2s ease-in-out infinite;}
  .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
  .fade-in{animation:fadeIn .2s ease both;}
  .reader-layout{display:flex;gap:20px;align-items:flex-start;}
  .info-pane{flex:0 0 280px;position:sticky;top:20px;background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:16px;max-height:88vh;overflow-y:auto;}
  .article-pane{flex:1 1 55%;min-width:0;}
  .paste-cols{display:flex;gap:24px;align-items:flex-start;}
  .paste-en{flex:0 0 38%;min-width:0;}
  .paste-zh{flex:1 1 55%;min-width:0;}
  @media(max-width:700px){
    .reader-layout,.paste-cols{flex-direction:column;}
    .info-pane{flex:none!important;width:100%!important;position:static!important;max-height:none!important;}
    .article-pane,.paste-en,.paste-zh{width:100%!important;flex:none!important;}
    .hdr{flex-wrap:wrap;gap:8px;}
    .mpad{padding:12px 10px!important;}
    .modebtn{padding:7px 10px!important;font-size:12px!important;}
  }
`;

const isChinese = c => /[\u4e00-\u9fff\u3400-\u4dbf]/u.test(c);
const isChineseText = s => [...s].some(isChinese);

/* ── API helpers ──────────────────────────────────────────────────── */
async function callAPI(userMsg, systemMsg, maxTokens = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  try {
    const res = await fetch(`${API_URL}/v1/messages`, {
      method:"POST", signal:controller.signal,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:maxTokens,
        system:systemMsg, messages:[{role:"user",content:userMsg}],
      }),
    });
    clearTimeout(timeout);
    const body = await res.text();
    if (!res.ok) throw new Error("HTTP " + res.status + ": " + body.slice(0,120));
    const d = JSON.parse(body);
    if (d.error) throw new Error("API: " + d.error.message);
    const raw = d.content?.[0]?.text || "";
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("No JSON found. Got: " + raw.slice(0,120));
    return JSON.parse(raw.slice(s, e+1));
  } catch(err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  }
}

async function callAPIText(userMsg, systemMsg, maxTokens = 1000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  try {
    const res = await fetch(`${API_URL}/v1/messages`, {
      method:"POST", signal:controller.signal,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:maxTokens,
        system:systemMsg, messages:[{role:"user",content:userMsg}],
      }),
    });
    clearTimeout(timeout);
    const body = await res.text();
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = JSON.parse(body);
    if (d.error) throw new Error("API: " + d.error.message);
    return d.content?.[0]?.text || "";
  } catch(err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  }
}

/* ── Shared segmentation pipeline ────────────────────────────────── */
async function segmentChunk(chunk) {
  const raw = await callAPIText(
    `Split this Chinese text into words. Text: ${chunk}

Output one word per line, tab-separated, no headers:
CHINESE_WORD\tPINYIN\tENGLISH_GLOSS\tSOUNDS_LIKE

SOUNDS_LIKE is an English phonetic respelling like "way jee bye kuh" for 维基百科 or "nee how" for 你好.
Punctuation (。，！？…、"") gets its own line: 。\t\t\t
Pinyin uses tone marks. Gloss is 1-3 words.
Output ONLY the lines.`,
    "Chinese language expert. Output only tab-separated lines, no explanation, no headers.",
    3000
  );
  return raw.trim().split("\n").map(line => {
    const p = line.split("\t");
    return { zh:(p[0]||"").trim(), pinyin:(p[1]||"").trim(), en_gloss:(p[2]||"").trim(), sounds_like:(p[3]||"").trim() };
  }).filter(s => s.zh.length > 0);
}

async function segmentText(body) {
  const CHUNK = 200;
  if (body.length <= CHUNK) return segmentChunk(body);
  // Split at sentence/clause boundaries to keep chunks coherent
  const chunks = [];
  let start = 0;
  while (start < body.length) {
    let end = Math.min(start + CHUNK, body.length);
    if (end < body.length) {
      const b1 = body.lastIndexOf("。", end);
      if (b1 > start + 60) { end = b1 + 1; }
      else {
        const b2 = body.lastIndexOf("，", end);
        if (b2 > start + 60) end = b2 + 1;
      }
    }
    chunks.push(body.slice(start, end));
    start = end;
  }
  const results = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const segs = await segmentChunk(chunk);
    results.push(...segs);
    if (chunks.indexOf(chunk) < chunks.length - 1) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

async function fetchCharMap(body) {
  const uniqueChars = [...new Set([...body].filter(isChinese))];
  if (!uniqueChars.length) return {};
  const raw = await callAPIText(
    `For each of these Chinese characters: ${uniqueChars.join(" ")}
Output one line per character (pipe-separated):
CHAR|PINYIN|TONE|MEANING1,MEANING2|HSK

Example: 水|shuǐ|3|water,river|1
TONE is 1-4 or 0. HSK is 1-6 or 0 if unknown. Output ONLY the lines.`,
    "Output only pipe-separated lines, one per character. No headers, no explanation.",
    3000
  );
  const map = {};
  raw.trim().split("\n").forEach(line => {
    const p = line.split("|");
    if (p.length >= 4 && p[0].trim()) {
      map[p[0].trim()] = {
        pinyin: p[1]?.trim()||"", tone: parseInt(p[2])||0,
        meanings: (p[3]||"").split(",").map(m=>m.trim()).filter(Boolean),
        hsk_level: parseInt(p[4])||null,
      };
    }
  });
  return map;
}

/* ── Small UI pieces ──────────────────────────────────────────────── */
function Dots() {
  return <span style={{display:"inline-flex",gap:5,alignItems:"center"}}>
    <span className="dot"/><span className="dot"/><span className="dot"/>
  </span>;
}

function Sec({label, children}) {
  const t = useT();
  return <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
    <div style={{fontSize:9,letterSpacing:"0.2em",color:t.faint,textTransform:"uppercase",marginBottom:6,fontFamily:"monospace"}}>{label}</div>
    {children}
  </div>;
}

/* ── Word span ────────────────────────────────────────────────────── */
function SegSpan({ seg, charMap, showPinyin, showGloss, isActive, onClick }) {
  const t = useT();
  const [hov, setHov] = useState(false);
  const hasZh = seg.zh && [...seg.zh].some(isChinese);
  if (!hasZh) return <span style={{color:t.fainter, display:"inline-block"}}>{seg.zh}</span>;
  const zhChars = [...seg.zh];
  // Build per-character colored spans for the Chinese text
  const firstCh = zhChars.find(isChinese);
  const firstCached = charMap[firstCh];
  const firstToneColor = firstCached ? (TC[firstCached.tone]||TC[0]) : t.muted;
  const activeBg = firstToneColor + "22";
  return (
    <span onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        display:"inline-flex", flexDirection:"column", alignItems:"center",
        cursor:"pointer", margin:"0 2px", verticalAlign:"top", padding:"1px 3px", borderRadius:3,
        background: isActive?activeBg: hov?t.accentBg:"transparent",
        borderBottom:`2px solid ${isActive?firstToneColor: hov?t.accentBorder:"transparent"}`,
        transition:"all 0.1s",
      }}>
      <span style={{fontSize:20, lineHeight:1.2, transition:"color 0.1s"}}>
        {zhChars.map((ch, ci) => {
          const cached = charMap[ch];
          const chColor = isChinese(ch) ? (cached ? TC[cached.tone]||TC[0] : t.text2) : t.fainter;
          const col = hov && !isActive ? t.text : chColor;
          return <span key={ci} style={{color:col}}>{ch}</span>;
        })}
      </span>
      {showPinyin && (seg.sounds_like || seg.pinyin) && (
        <span style={{fontSize:10, color:isActive?firstToneColor:t.faint, lineHeight:1.3, fontFamily:"monospace"}}>
          {seg.sounds_like || seg.pinyin}
        </span>
      )}
      {showGloss && seg.en_gloss && (
        <span style={{fontSize:9, color:t.fainter, lineHeight:1.2, maxWidth:64, textAlign:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
          {seg.en_gloss}
        </span>
      )}

    </span>
  );
}

/* ── Info panel (sidebar for reader, overlay for paste) ──────────── */
function InfoPanel({ ps, charMap }) {
  const t = useT();
  const basic = charMap[ps?.char];
  const toneColor = basic ? (TC[basic.tone]||TC[0]) : t.accent;

  if (!ps || ps.status==="idle") return (
    <div style={{textAlign:"center",padding:"32px 12px",color:t.fainter,fontSize:13,lineHeight:1.8}}>
      <div style={{fontSize:26,color:t.ghost,marginBottom:10}}>←</div>
      Click any word to explore it.
    </div>
  );

  return (
    <div>
      <div style={{fontSize:ps.word?.length>1?42:56, fontWeight:"bold", lineHeight:1, marginBottom:4, textShadow:`0 0 22px ${toneColor}44`}}>
        {[...(ps.word||ps.char||"")].map((ch,i) => {
          const cc = charMap[ch];
          const col = isChinese(ch) ? (cc ? TC[cc.tone]||TC[0] : toneColor) : toneColor;
          return <span key={i} style={{color:col}}>{ch}</span>;
        })}
      </div>
      <div style={{fontSize:14, color:t.muted, marginBottom:8, fontFamily:"monospace"}}>
        {ps.segSounds || ps.segPinyin || basic?.pinyin || ""}
      </div>

      {ps.status==="loading-detail" && !ps.detail && (
        <div style={{color:t.faint,fontSize:12,paddingTop:6}}><Dots/></div>
      )}

      {ps.detail && <>
        {ps.detail.sounds_like && (
          <div style={{fontSize:14, color:t.text2, fontFamily:"monospace", marginBottom:4}}>
            "{ps.detail.sounds_like}"
          </div>
        )}
        {ps.detail.pronunciation_note && (
          <div style={{fontSize:12, color:t.text3, marginBottom:8, lineHeight:1.6}}>
            {ps.detail.pronunciation_note}
          </div>
        )}
        {ps.detail.era && (
          <div style={{fontSize:11, color:t.faint, marginBottom:10, fontStyle:"italic"}}>
            {ps.detail.era}
          </div>
        )}
        {ps.detail.definitions?.length>0 && (
          <Sec label="Definitions">
            {ps.detail.definitions.map((m,i)=>(
              <div key={i} style={{marginBottom:9,paddingBottom:9,borderBottom:`1px solid ${t.surface2}`}}>
                <span style={{display:"inline-block",background:t.surface2,borderRadius:3,color:t.faint,fontSize:10,padding:"2px 6px",marginRight:7,fontFamily:"monospace"}}>{m.part_of_speech}</span>
                <span style={{fontSize:13,color:t.text2,lineHeight:1.6}}>{m.definition}</span>
              </div>
            ))}
          </Sec>
        )}
        {ps.detail.etymology && (
          <Sec label="Origin">
            <div style={{fontSize:12,color:t.text3,lineHeight:1.8,fontStyle:"italic"}}>{ps.detail.etymology}</div>
          </Sec>
        )}
        {ps.detail.components?.length>0 && (
          <Sec label="Components">
            {ps.detail.components.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:t.bg,borderRadius:4,padding:"5px 9px",marginBottom:4}}>
                <span style={{fontSize:18,minWidth:22,color:t.text}}>{c.part}</span>
                <span style={{fontSize:11,color:t.faint,minWidth:46,fontFamily:"monospace"}}>{c.sounds_like||c.pinyin}</span>
                <span style={{fontSize:12,color:t.muted}}>{c.meaning}</span>
              </div>
            ))}
          </Sec>
        )}
        {ps.detail.compounds?.length>0 && (
          <Sec label="Common Compounds">
            {ps.detail.compounds.slice(0,4).map((c,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"baseline",padding:"5px 0",borderBottom:`1px solid ${t.surface2}`}}>
                <span style={{fontSize:15,minWidth:38,color:t.text}}>{c.word}</span>
                <span style={{fontSize:11,color:t.faint,minWidth:50,fontFamily:"monospace"}}>{c.sounds_like||c.pinyin}</span>
                <span style={{fontSize:12,color:t.muted}}>{c.meaning}</span>
              </div>
            ))}
          </Sec>
        )}
        {ps.detail.example && (
          <Sec label="Example">
            <div style={{fontSize:13,letterSpacing:"0.04em",marginBottom:2,color:t.text}}>{ps.detail.example.zh}</div>
            <div style={{fontSize:11,color:t.faint,marginBottom:2,fontFamily:"monospace"}}>{ps.detail.example.sounds_like||ps.detail.example.pinyin}</div>
            <div style={{fontSize:12,color:t.muted,fontStyle:"italic"}}>{ps.detail.example.en}</div>
          </Sec>
        )}
        {ps.detail.stroke_count && (
          <div style={{marginTop:10,fontSize:10,color:t.fainter,fontFamily:"monospace"}}>{ps.detail.stroke_count} strokes</div>
        )}
      </>}
    </div>
  );
}

/* ── Dictionary components ────────────────────────────────────────── */
function DictSec({label,children}) {
  const t = useT();
  return <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
    <div style={{fontSize:9,letterSpacing:"0.2em",color:t.faint,textTransform:"uppercase",marginBottom:7,fontFamily:"monospace"}}>{label}</div>
    {children}
  </div>;
}

function DictZh({ d, onLookup }) {
  const t = useT();
  return (
    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,padding:"22px 24px"}}>
      <div style={{fontSize:50,fontWeight:"bold",lineHeight:1.1,marginBottom:4,color:t.text}}>{d.word}</div>
      {d.traditional&&d.traditional!==d.word&&<div style={{fontSize:12,color:t.faint,marginBottom:4}}>Traditional: {d.traditional}</div>}
      {d.sounds_like&&<div style={{fontSize:16,color:t.text2,fontFamily:"monospace",marginBottom:10}}>"{d.sounds_like}"</div>}

      {d.components?.length>0&&<DictSec label="Character Breakdown">
        {d.components.map((c,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:t.bg,borderRadius:4,padding:"6px 10px",marginBottom:4}}>
            <span style={{fontSize:20,minWidth:24,color:t.text}}>{c.char}</span>
            <span style={{fontSize:11,color:t.faint,minWidth:52,fontFamily:"monospace"}}>{c.sounds_like||c.pinyin}</span>
            <span style={{fontSize:12,color:t.muted}}>{c.meaning}</span>
          </div>
        ))}
      </DictSec>}

      {d.construction&&<DictSec label="Character Construction">
        <div style={{fontSize:12,color:t.text3,lineHeight:1.8}}>{d.construction}</div>
      </DictSec>}

      {d.meanings?.length>0&&<DictSec label="Definitions">
        {d.meanings.map((m,i)=>(
          <div key={i} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${t.surface2}`}}>
            <span style={{display:"inline-block",background:t.surface2,borderRadius:3,color:t.faint,fontSize:10,padding:"2px 6px",marginRight:8,fontFamily:"monospace"}}>{m.part_of_speech}</span>
            <span style={{fontSize:14,color:t.text2,lineHeight:1.6}}>{m.definition}</span>
            {m.example_zh&&<div style={{marginTop:7,paddingLeft:12,borderLeft:`2px solid ${t.border}`}}>
              <div style={{fontSize:14,letterSpacing:"0.04em",marginBottom:2,color:t.text}}>{m.example_zh}</div>
              {(m.example_sounds_like||m.example_pinyin)&&<div style={{fontSize:11,color:t.faint,marginBottom:2,fontFamily:"monospace"}}>{m.example_sounds_like||m.example_pinyin}</div>}
              <div style={{fontSize:12,color:t.muted,fontStyle:"italic"}}>{m.example_en}</div>
            </div>}
          </div>
        ))}
      </DictSec>}

      {d.etymology&&<DictSec label="Etymology">
        <div style={{fontSize:12,color:t.text3,lineHeight:1.8,fontStyle:"italic"}}>{d.etymology}</div>
      </DictSec>}

      {d.related_words?.length>0&&<DictSec label="Related Words">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
          {d.related_words.map((w,i)=>(
            <div key={i} onClick={()=>onLookup&&onLookup(w.word)}
              onMouseEnter={e=>e.currentTarget.style.borderColor=t.accentBorder}
              onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}
              style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:6,padding:"9px 11px",cursor:"pointer",transition:"border-color 0.15s"}}>
              <div style={{fontSize:20,marginBottom:2,color:t.text}}>{w.word}</div>
              <div style={{fontSize:11,color:t.faint,marginBottom:3,fontFamily:"monospace"}}>{w.sounds_like||w.pinyin}</div>
              <div style={{fontSize:11,color:t.muted,lineHeight:1.4}}>{w.meaning}</div>
            </div>
          ))}
        </div>
      </DictSec>}

      {d.cultural_note&&<DictSec label="Cultural Note">
        <div style={{fontSize:12,color:t.text3,lineHeight:1.8,fontStyle:"italic"}}>{d.cultural_note}</div>
      </DictSec>}
    </div>
  );
}

function DictEn({ d, onLookup }) {
  const t = useT();
  return (
    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,padding:"22px 24px"}}>
      <div style={{fontSize:38,fontWeight:"bold",lineHeight:1.1,marginBottom:4,color:t.text}}>{d.english_word}</div>
      <div style={{fontSize:11,color:t.faint,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:18}}>English → Chinese</div>
      {d.entries?.map((entry,ei)=>(
        <div key={ei} style={{marginBottom:22,paddingBottom:22,borderBottom:`1px solid ${t.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{display:"inline-block",background:t.surface2,borderRadius:3,color:t.faint,fontSize:10,padding:"2px 6px",fontFamily:"monospace"}}>{entry.part_of_speech}</span>
            <span style={{fontSize:14,color:t.text2}}>{entry.meaning_en}</span>
          </div>
          {entry.chinese_translations?.map((tr,ti)=>(
            <div key={ti}
              onClick={()=>onLookup&&onLookup(tr.word)}
              onMouseEnter={e=>e.currentTarget.style.borderLeftColor=t.accent}
              onMouseLeave={e=>e.currentTarget.style.borderLeftColor=Object.values(TC)[ti%4]||t.accent}
              style={{background:t.bg,borderRadius:6,padding:"12px 14px",marginBottom:8,cursor:"pointer",borderLeft:`3px solid ${Object.values(TC)[ti%4]||t.accent}`,transition:"border-left-color 0.15s"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontSize:26,fontWeight:"bold",color:t.text}}>{tr.word}</span>
                <span style={{fontSize:14,color:t.muted}}>{tr.pinyin}</span>
                {tr.sounds_like&&<span style={{fontSize:12,color:t.text2,fontFamily:"monospace"}}>"{tr.sounds_like}"</span>}
              </div>
              {tr.literal_meaning&&<div style={{fontSize:12,color:t.faint,marginBottom:5,fontStyle:"italic"}}>lit. "{tr.literal_meaning}"</div>}
              {tr.example_zh&&<div style={{paddingLeft:10,borderLeft:`2px solid ${t.border}`,marginBottom:4}}>
                <div style={{fontSize:13,letterSpacing:"0.04em",marginBottom:2,color:t.text}}>{tr.example_zh}</div>
                {(tr.example_sounds_like||tr.example_pinyin)&&<div style={{fontSize:11,color:t.faint,marginBottom:2,fontFamily:"monospace"}}>{tr.example_sounds_like||tr.example_pinyin}</div>}
                <div style={{fontSize:12,color:t.muted,fontStyle:"italic"}}>{tr.example_en}</div>
              </div>}
              {tr.notes&&<div style={{fontSize:11,color:t.faint,marginTop:4,fontStyle:"italic"}}>↳ {tr.notes}</div>}
            </div>
          ))}
        </div>
      ))}
      {d.usage_note&&(
        <div style={{background:t.bg,borderRadius:6,padding:"12px 14px",border:`1px solid ${t.border}`}}>
          <div style={{fontSize:9,letterSpacing:"0.2em",color:t.faint,textTransform:"uppercase",marginBottom:6,fontFamily:"monospace"}}>Usage Note</div>
          <div style={{fontSize:13,color:t.text3,lineHeight:1.7,fontStyle:"italic"}}>{d.usage_note}</div>
        </div>
      )}
    </div>
  );
}

/* ── Style helpers (theme-dependent) ─────────────────────────────── */
function makeS(t) {
  return {
    inp: {background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:6,color:t.text,padding:"10px 14px",fontSize:14,fontFamily:"inherit",flex:1,minWidth:0},
    btn: {background:t.accent,border:"none",borderRadius:6,color:t.btnText,padding:"10px 18px",fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:"bold",letterSpacing:"0.04em",whiteSpace:"nowrap"},
    outBtn: {background:"transparent",border:`1px solid ${t.border}`,borderRadius:6,color:t.muted,padding:"10px 16px",fontSize:13,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"},
    toggle: (on) => ({background:on?t.accentBg:t.surface,border:`1px solid ${on?t.accentBorder:t.border}`,borderRadius:20,color:on?t.accent:t.faint,padding:"4px 13px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}),
    sugg: {background:t.surface2,border:`1px solid ${t.border}`,borderRadius:20,color:t.muted,padding:"6px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit"},
    card: {background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,padding:"20px 22px",marginBottom:12},
  };
}

const READER_SUGG = ["冰 Ice","饺子 Dumplings","太空 Space","功夫 Kung Fu","茶 Tea","书法 Calligraphy","龙舟 Dragon Boat","半导体 Semiconductors"];
const DICT_SUGG_ZH = ["水","龙","爱","学","冰","心"];
const DICT_SUGG_EN = ["can","light","time","know"];

/* ═══════════════════════════════════════════════════════════════════ */
export default function Zidian() {
  const [dark, setDark] = useState(true);
  const t = dark ? DARK : LIGHT;
  const S = makeS(t);

  const [mode, setMode] = useState("reader");
  const [toast, setToast] = useState(null);

  /* ── reader state ── */
  const [topicInput, setTopicInput] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");
  const [sections, setSections] = useState([]);
  const [charMap, setCharMap] = useState({});
  const [panelState, setPanelState] = useState({status:"idle",char:null,word:null,segPinyin:null,detail:null});
  const [articleLoading, setArticleLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [articleError, setArticleError] = useState(null);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showGloss, setShowGloss] = useState(false);
  const [showSounds, setShowSounds] = useState(false);

  /* ── dict state ── */
  const [dictInput, setDictInput] = useState("");
  const [dictResult, setDictResult] = useState(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictError, setDictError] = useState(null);

  /* ── paste state ── */
  const [pasteInput, setPasteInput] = useState("");
  const [pasteData, setPasteData] = useState(null);
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteError, setPasteError] = useState(null);
  const [pastePanel, setPastePanel] = useState({status:"idle",char:null,word:null,segPinyin:null,detail:null});
  const [pastePinyin, setPastePinyin] = useState(true);
  const [pasteGloss, setPasteGloss] = useState(false);
  const [pasteSounds, setPasteSounds] = useState(false);

  const detailCache = useRef({});
  const pasteDetailCache = useRef({});
  const usedAngles = useRef([]);
  const bgFetchActive = useRef(false);

  const bgFetchWords = async (segments, cache) => {
    const unique = [...new Set(segments.filter(s => [...s.zh].some(isChinese)).map(s => s.zh))]
      .filter(w => !cache.current[w]);
    if (!unique.length) return;
    bgFetchActive.current = true;
    const BATCH = 2; // fetch 2 at a time
    for (let i = 0; i < unique.length; i += BATCH) {
      if (!bgFetchActive.current) break;
      const batch = unique.slice(i, i + BATCH).filter(w => !cache.current[w]);
      await Promise.all(batch.map(async (zh) => {
        try {
          const detail = await callAPI(
            `Explain the Chinese word/character "${zh}". Return ONLY raw JSON: {sounds_like: "phonetic respelling like 'nee-how' for 你好 — ONLY the syllables, no extra explanation", pronunciation_note: "only include this field if there is something genuinely tricky about pronouncing this word that the syllables alone don't convey, otherwise omit entirely", era: "1-2 sentences on the origin always including year in parens, e.g. Originated in Classical Chinese oracle bone script (~1200 BC) or Modern coinage adopted from Japanese (~1900s)", definitions: [{part_of_speech: "noun/verb/adj/etc", definition: "clear English definition"}], etymology: "2-3 sentences on origin and visual logic", components: [{part, sounds_like: "phonetic respelling", meaning}], compounds: [{word, sounds_like: "phonetic respelling", meaning}], example: {zh, sounds_like: "phonetic respelling of full sentence", en}, stroke_count: number}`,
            "Chinese linguistics expert. Return only raw JSON, no markdown."
          );
          cache.current[zh] = detail;
        } catch(e) { /* skip */ }
      }));
      if (i + BATCH < unique.length) await new Promise(r => setTimeout(r, 350));
    }
    bgFetchActive.current = false;
  };

  const patchMissingChars = async (text, updateFn) => {
    const missing = [...new Set([...text].filter(isChinese))].filter(ch => !charMap[ch]);
    if (!missing.length) return;
    try {
      const raw = await callAPIText(
        "For each: " + missing.join(" ") + "\nOutput CHAR|PINYIN|TONE|MEANING1,MEANING2|HSK per line. Example: 水|shuǐ|3|water,river|1. Output ONLY lines.",
        "Output only pipe-separated lines.", 3000
      );
      const extra = {};
      raw.trim().split("\n").forEach(line => {
        const p = line.split("|");
        if (p.length >= 4 && p[0].trim()) extra[p[0].trim()] = { pinyin:p[1]?.trim()||"", tone:parseInt(p[2])||0, meanings:(p[3]||"").split(",").map(m=>m.trim()).filter(Boolean) };
      });
      if (Object.keys(extra).length) updateFn(extra);
    } catch(e) {}
  };
  const [collapsed, setCollapsed] = useState({});
  const toggleCollapse = (i) => setCollapsed(prev => ({...prev, [i]: !prev[i]}));
  const mergeCharMap = (nd) => setCharMap(prev=>({...prev,...nd}));

  /* ── toast helper ── */
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  /* ── article generation ── */
  const generateSection = async (topic, angles, seed) => {
    const usedStr = angles.length ? `Already covered: ${angles.slice(-3).join("; ")}. Pick a different angle.` : "";
    const rawText = await callAPIText(
      `Topic: "${topic}". Seed:${seed}. ${usedStr}
Write a short Chinese passage (40-50 Chinese characters). One angle: surprising fact, how-it-works, historical moment, or cultural custom. Clear and direct, like a magazine.

Output in EXACTLY this format:
ANGLE: two to four word label
TITLE_ZH: Chinese title
TITLE_EN: English title
ZH: Chinese passage text here
EN: English translation here

No extra lines. No markdown. Just those 5 lines.`,
      "Output exactly 5 labeled lines: ANGLE, TITLE_ZH, TITLE_EN, ZH, EN. Nothing else."
    );
    const lines = {};
    rawText.trim().split("\n").forEach(line => {
      const c = line.indexOf(":");
      if (c > 0) lines[line.slice(0,c).trim().toUpperCase()] = line.slice(c+1).trim();
    });
    const body = lines["ZH"] || "";
    const segments = await segmentText(body);
    await new Promise(r => setTimeout(r, 300));
    const charData = await fetchCharMap(body);
    return { art:{ angle:lines["ANGLE"]||"fact", title_zh:lines["TITLE_ZH"]||topic, title_en:lines["TITLE_EN"]||topic, segments, body_en:lines["EN"]||"" }, charData };
  };

  const generateArticle = async () => {
    if (!topicInput.trim()) return;
    setArticleLoading(true); setSections([]); setCharMap({}); setArticleError(null);
    setPanelState({status:"idle",char:null,word:null,segPinyin:null,detail:null});
    usedAngles.current = []; detailCache.current = {}; setCollapsed({});
    bgFetchActive.current = false;
    try {
      const seed = Math.floor(Math.random()*99999);
      const { art, charData } = await generateSection(topicInput, [], seed);
      if (!art.segments?.length) throw new Error("No segments returned — try again.");
      usedAngles.current = [art.angle];
      setSections([art]); setCurrentTopic(topicInput); mergeCharMap(charData);
      bgFetchActive.current = false;
      setTimeout(() => bgFetchWords(art.segments, detailCache), 1200);
      setTimeout(() => patchMissingChars(art.segments.map(s=>s.zh).join(""), mergeCharMap), 3000);
    } catch(e) { setArticleError(e.message||"Failed to generate."); }
    setArticleLoading(false);
  };

  const loadMore = async () => {
    setMoreLoading(true);
    try {
      const seed = Math.floor(Math.random()*99999);
      const { art, charData } = await generateSection(currentTopic, usedAngles.current, seed);
      if (art.segments?.length) {
        usedAngles.current = [...usedAngles.current, art.angle];
        setSections(prev=>[...prev, art]); mergeCharMap(charData);
        setTimeout(() => bgFetchWords(art.segments, detailCache), 1200);
      }
    } catch(e) { console.error(e); }
    setMoreLoading(false);
  };

  /* ── word click (shared) ── */
  const handleWordClick = useCallback(async (seg, cache, setPanel, copy=true) => {
    const firstCh = [...seg.zh].find(isChinese);
    if (!firstCh) return;
    if (copy) {
      try { await navigator.clipboard.writeText(seg.zh); showToast("Copied " + seg.zh); } catch {}
    }
    const key = seg.zh;
    if (cache.current[key]) {
      setPanel({status:"done",char:firstCh,word:seg.zh,segPinyin:seg.pinyin,segSounds:seg.sounds_like||"",detail:cache.current[key]});
      return;
    }
    setPanel({status:"loading-detail",char:firstCh,word:seg.zh,segPinyin:seg.pinyin,segSounds:seg.sounds_like||"",detail:null});
    try {
      const detail = await callAPI(
        `Explain the Chinese word/character "${seg.zh}". Return ONLY raw JSON: {sounds_like: "phonetic respelling like 'nee-how' for 你好 — ONLY the syllables, no extra explanation", pronunciation_note: "only include this field if there is something genuinely tricky about pronouncing this word that the syllables alone don't convey, otherwise omit entirely", era: "1-2 sentences on the origin always including year in parens, e.g. Originated in Classical Chinese oracle bone script (~1200 BC) or Modern coinage adopted from Japanese (~1900s)", definitions: [{part_of_speech: "noun/verb/adj/etc", definition: "clear English definition"}], etymology: "2-3 sentences on origin and visual logic", components: [{part, sounds_like: "phonetic respelling", meaning}], compounds: [{word, sounds_like: "phonetic respelling", meaning}], example: {zh, sounds_like: "phonetic respelling of full sentence", en}, stroke_count: number}`,
        "Chinese linguistics expert. Return only raw JSON, no markdown."
      );
      cache.current[key] = detail;
      setPanel({status:"done",char:firstCh,word:seg.zh,segPinyin:seg.pinyin,segSounds:seg.sounds_like||"",detail});
    } catch(e) { console.error(e); }
  }, []);

  const handleSegClick = useCallback((seg) => handleWordClick(seg, detailCache, setPanelState), [handleWordClick]);
  const handlePasteClick = useCallback((seg) => handleWordClick(seg, pasteDetailCache, setPastePanel), [handleWordClick]);

  /* ── paste processing ── */
  const processPaste = async () => {
    if (!pasteInput.trim()) return;
    const zhText = pasteInput.trim();
    if (!isChineseText(zhText)) {
      setPasteError("No Chinese characters found. Please paste Chinese text.");
      return;
    }
    setPasteLoading(true); setPasteData(null); setPasteError(null);
    setPastePanel({status:"idle",char:null,word:null,segPinyin:null,detail:null});
    pasteDetailCache.current = {};
    try {
      const translation = await callAPIText(
        `Translate this Chinese text to English naturally:\n${zhText}\n\nOutput ONLY the English translation, nothing else.`,
        "You are a Chinese-English translator. Output only the translation.",
        3000
      );
      await new Promise(r => setTimeout(r, 400));
      const segments = await segmentText(zhText);
      await new Promise(r => setTimeout(r, 400));
      const charData = await fetchCharMap(zhText);
      setPasteData({ segments, charMap:charData, translation:translation.trim(), original:zhText });
      setTimeout(() => bgFetchWords(segments, pasteDetailCache), 1200);
      setTimeout(() => {
        const allCh = segments.map(s=>s.zh).join("");
        const miss = [...new Set([...allCh].filter(isChinese))].filter(ch => !charData[ch]);
        if (!miss.length) return;
        callAPIText("For each: " + miss.join(" ") + "\nOutput CHAR|PINYIN|TONE|MEANING1,MEANING2|HSK per line. Example: 水|shuǐ|3|water,river|1. Output ONLY lines.", "Output only pipe-separated lines.", 3000)
          .then(raw => {
            const extra = {};
            raw.trim().split("\n").forEach(line => {
              const p = line.split("|");
              if (p.length >= 4 && p[0].trim()) extra[p[0].trim()] = { pinyin:p[1]?.trim()||"", tone:parseInt(p[2])||0, meanings:(p[3]||"").split(",").map(m=>m.trim()).filter(Boolean) };
            });
            if (Object.keys(extra).length) setPasteData(prev => prev ? {...prev, charMap:{...prev.charMap,...extra}} : prev);
          }).catch(()=>{});
      }, 3000);
    } catch(e) { setPasteError(e.message||"Failed to process."); }
    setPasteLoading(false);
  };

  /* ── dict ── */
  const lookupDict = async (overrideWord) => {
    const word = overrideWord || dictInput;
    if (!word.trim()) return;
    if (overrideWord) setDictInput(overrideWord);
    setDictLoading(true); setDictResult(null); setDictError(null);
    const isZh = isChineseText(word);
    try {
      let data;
      if (isZh) {
        data = await callAPI(
          `Chinese dictionary entry for: "${word}". Return ONLY raw JSON: {word, sounds_like: "phonetic respelling like 'shway' for 水", traditional, meanings: [{part_of_speech, definition, example_zh, example_sounds_like: "phonetic respelling of example", example_en}], construction: "1-2 sentences on how the character is built — what strokes or radicals make it up and why", etymology: "2-3 sentences on historical origin", components: [{char, sounds_like: "phonetic respelling", meaning}], related_words: [{word, sounds_like: "phonetic respelling", meaning}] (max 6), cultural_note: "1-2 interesting sentences"}`,
          "Chinese language expert. Return only raw JSON, no markdown."
        );
        data.mode = "zh";
      } else {
        data = await callAPI(
          `Bilingual dictionary entry for the English word: "${word}". Multiple distinct meanings. Return ONLY raw JSON: {english_word: "${word}", entries: [{meaning_en: "this sense", part_of_speech: "noun/verb/etc", chinese_translations: [{word, pinyin, sounds_like: "phonetic respelling", literal_meaning: "what characters mean literally", example_zh, example_pinyin, example_en, notes: "when to use vs others (optional)"}]}], usage_note: "important note about differences"}`,
          "Bilingual Chinese-English dictionary expert. Return only raw JSON, no markdown."
        );
        data.mode = "en";
      }
      setDictResult(data);
    } catch(e) { setDictError("Lookup failed — " + (e.message||"try again.")); }
    setDictLoading(false);
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <Th.Provider value={t}>
      <style>{globalCSS(t)}</style>

      {/* Copy toast */}
      {toast && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:t.accent,color:"#fff",borderRadius:20,padding:"7px 18px",fontSize:13,fontFamily:"Georgia,serif",zIndex:9999,pointerEvents:"none",animation:"toastIn .2s ease both",whiteSpace:"nowrap"}}>
          {toast}
        </div>
      )}

      <div style={{fontFamily:"'Georgia','Noto Serif SC',serif",background:t.bg,color:t.text,minHeight:"100vh",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <div className="hdr" style={{background:t.surface,borderBottom:`1px solid ${t.border}`,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:28,color:t.accent,fontWeight:"bold",lineHeight:1,textShadow:`0 0 16px ${t.accent}44`}}>字</span>
            <div>
              <div style={{fontSize:10,letterSpacing:"0.3em",color:t.accent,fontFamily:"monospace",fontWeight:"bold"}}>ZÌDIǍN</div>
              <div style={{fontSize:11,color:t.muted}}>Interactive Chinese Reader</div>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {/* Dark/light toggle */}
            <button onClick={()=>setDark(d=>!d)}
              style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:20,color:t.muted,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
              {dark ? "☀ Light" : "☾ Dark"}
            </button>

            {/* Mode tabs */}
            <div style={{display:"flex",background:t.bg,borderRadius:6,padding:3,gap:2}}>
              {[["reader","阅 Reader"],["paste","文 Text"],["dict","词 Dictionary"]].map(([id,lbl])=>(
                <button key={id} className="modebtn"
                  onClick={()=>setMode(id)}
                  style={{background:mode===id?t.accent:"transparent",border:"none",color:mode===id?"#fff":t.muted,padding:"7px 14px",borderRadius:4,cursor:"pointer",fontSize:13,fontFamily:"inherit",transition:"all 0.15s"}}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mpad" style={{flex:1,padding:"18px 20px",maxWidth:1140,width:"100%",margin:"0 auto"}}>

          {/* ════ READER ════ */}
          {mode==="reader" && (
            <>
              <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                <input style={S.inp} value={topicInput} onChange={e=>setTopicInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&generateArticle()} placeholder="Enter any topic…"/>
                <button style={S.btn} onClick={generateArticle} disabled={articleLoading||moreLoading}>
                  {articleLoading ? <Dots/> : sections.length ? "↺ New" : "生成 Generate"}
                </button>
              </div>

              {(sections.length>0 || articleLoading) && (
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={()=>setShowPinyin(v=>!v)} style={S.toggle(showPinyin)}>{showPinyin?"✓ ":""}拼 Pinyin</button>
                  <button onClick={()=>setShowGloss(v=>!v)} style={S.toggle(showGloss)}>{showGloss?"✓ ":""}英 English</button>
                  <div style={{display:"flex",gap:10,marginLeft:4,alignItems:"center"}}>
                    {[["1st","#E05C5C"],["2nd","#4DB882"],["3rd","#5B8DD9"],["4th","#B05CD9"]].map(([lbl,col])=>(
                      <span key={lbl} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:t.faint}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:col,display:"inline-block",flexShrink:0}}/>
                        {lbl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="reader-layout">
                <div className="article-pane">
                  {articleLoading && (
                    <div style={{...S.card,textAlign:"center",padding:"32px 24px"}}>
                      <div style={{marginBottom:10}}><Dots/></div>
                      <div style={{color:t.faint,fontSize:13}}>Generating passage…</div>
                    </div>
                  )}
                  {articleError && !articleLoading && (
                    <div style={{background:dark?"#1A0E0E":"#FFF0F0",border:`1px solid ${dark?"#4A2020":"#E0A0A0"}`,borderRadius:8,padding:"16px 20px",color:dark?"#C06060":"#A02020",fontSize:13,lineHeight:1.7,marginBottom:12}}>
                      <strong>Generation failed.</strong>
                      <div style={{marginTop:6,fontFamily:"monospace",fontSize:11,wordBreak:"break-all"}}>{articleError}</div>
                      <button onClick={generateArticle} style={{...S.btn,marginTop:10,fontSize:12,padding:"6px 14px"}}>Retry</button>
                    </div>
                  )}
                  {sections.map((sec,si)=>{
                    const isCollapsed = collapsed[si];
                    return (
                      <div key={si} className="fade-in" style={S.card}>
                        {/* Header row — always visible, click to collapse */}
                        <div onClick={()=>toggleCollapse(si)}
                          style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",marginBottom:isCollapsed?0:12}}>
                          <div>
                            {si>0 && <div style={{fontSize:10,color:t.fainter,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>▸ {sec.angle}</div>}
                            <span style={{fontSize:19,fontWeight:"bold",color:t.text}}>{sec.title_zh}</span>
                            <span style={{fontSize:11,color:t.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginLeft:10}}>{sec.title_en}</span>
                          </div>
                          <span style={{fontSize:12,color:t.fainter,marginLeft:12,flexShrink:0}}>{isCollapsed ? "▸" : "▾"}</span>
                        </div>
                        {/* Collapsible body */}
                        {!isCollapsed && <>
                          <div style={{lineHeight:showGloss?3.8:showPinyin?3.1:2.2,letterSpacing:"0.05em",wordBreak:"break-word"}}>
                            {sec.segments.map((seg,i)=>(
                              <SegSpan key={i} seg={seg} charMap={charMap} showPinyin={showPinyin} showGloss={showGloss}
                                isActive={panelState.word===seg.zh}
                                onClick={()=>handleSegClick(seg)}/>
                            ))}
                          </div>
                          <div style={{height:1,background:t.border,margin:"14px 0"}}/>
                          <div style={{fontSize:12,color:t.faint,lineHeight:1.8,fontStyle:"italic"}}>{sec.body_en}</div>
                        </>}
                      </div>
                    );
                  })}
                  {sections.length>0 && !articleLoading && (
                    <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:4,flexWrap:"wrap"}}>
                      <button onClick={loadMore} disabled={moreLoading} style={S.outBtn}>
                        {moreLoading ? <span><Dots/>&nbsp; Loading…</span> : "+ More"}
                      </button>
                      <button style={S.outBtn} onClick={()=>{
                        const allCollapsed = sections.every((_,i)=>collapsed[i]);
                        const next = {};
                        if (!allCollapsed) sections.forEach((_,i)=>next[i]=true);
                        setCollapsed(next);
                      }}>
                        {sections.every((_,i)=>collapsed[i]) ? "▸ Expand all" : "▾ Collapse all"}
                      </button>
                    </div>
                  )}
                  {!sections.length && !articleLoading && !articleError && (
                    <div style={{textAlign:"center",padding:"40px 20px"}}>
                      <div style={{fontSize:60,color:t.ghost,marginBottom:12,lineHeight:1}}>阅</div>
                      <div style={{fontSize:13,color:t.faint,marginBottom:16,lineHeight:1.8}}>
                        Generate a passage on any topic.<br/>Click any word to copy it and see its breakdown.
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
                        {READER_SUGG.map(s=><button key={s} style={S.sugg} onClick={()=>setTopicInput(s.split(" ")[0])}>{s}</button>)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="info-pane">
                  <InfoPanel ps={panelState} charMap={charMap}/>
                </div>
              </div>
            </>
          )}

          {/* ════ PASTE ════ */}
          {mode==="paste" && (
            <>
              {!pasteData ? (
                <div style={{maxWidth:680}}>
                  <div style={{fontSize:13,color:t.faint,marginBottom:10,lineHeight:1.7}}>
                    Paste any Chinese text below. It will be split into clickable words with pinyin, and translated on the left.
                  </div>
                  <textarea
                    value={pasteInput}
                    onChange={e=>setPasteInput(e.target.value)}
                    placeholder="粘贴中文文本在这里…"
                    style={{...S.inp,width:"100%",height:140,resize:"vertical",display:"block",fontFamily:"'Noto Serif SC',serif",fontSize:16,lineHeight:1.8,marginBottom:10}}
                  />
                  <button style={S.btn} onClick={processPaste} disabled={pasteLoading||!pasteInput.trim()}>
                    {pasteLoading ? <Dots/> : "分析 Analyze"}
                  </button>
                  {pasteError && <div style={{marginTop:12,color:dark?"#C06060":"#A02020",fontSize:13}}>{pasteError}</div>}
                </div>
              ) : (
                <>
                  <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                    <button onClick={()=>{setPasteData(null);setPasteInput("");}} style={S.outBtn}>← New text</button>
                    <button onClick={()=>setPastePinyin(v=>!v)} style={S.toggle(pastePinyin)}>{pastePinyin?"✓ ":""}拼 Pinyin</button>
                    <button onClick={()=>setPasteGloss(v=>!v)} style={S.toggle(pasteGloss)}>{pasteGloss?"✓ ":""}英 English</button>

                  </div>

                  <div className="reader-layout">
                    <div className="article-pane">
                      <div style={S.card}>
                        <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
                          <div style={{flex:"1 1 55%",minWidth:0}}>
                            <div style={{fontSize:9,letterSpacing:"0.2em",color:t.faint,textTransform:"uppercase",marginBottom:10,fontFamily:"monospace"}}>中文</div>
                            <div style={{lineHeight:pasteGloss?3.8:pastePinyin?3.1:2.2,letterSpacing:"0.05em",wordBreak:"break-word"}}>
                              {pasteData.segments.map((seg,i)=>(
                                <SegSpan key={i} seg={seg} charMap={pasteData.charMap} showPinyin={pastePinyin} showGloss={pasteGloss}
                                  isActive={pastePanel.word===seg.zh}
                                  onClick={()=>handlePasteClick(seg)}/>
                              ))}
                            </div>
                          </div>
                          <div style={{flex:"0 0 38%",minWidth:180,borderLeft:`1px solid ${t.border}`,paddingLeft:20}}>
                            <div style={{fontSize:9,letterSpacing:"0.2em",color:t.faint,textTransform:"uppercase",marginBottom:10,fontFamily:"monospace"}}>English</div>
                            <div style={{fontSize:13,color:t.faint,lineHeight:1.9,fontStyle:"italic"}}>{pasteData.translation}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="info-pane">
                      <InfoPanel ps={pastePanel} charMap={pasteData.charMap}/>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ════ DICTIONARY ════ */}
          {mode==="dict" && (
            <div style={{maxWidth:700}}>
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                <input style={S.inp} value={dictInput} onChange={e=>setDictInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&lookupDict()} placeholder="Chinese character/word, or English word…"/>
                <button style={S.btn} onClick={()=>lookupDict()} disabled={dictLoading}>
                  {dictLoading?<Dots/>:"查 Lookup"}
                </button>
              </div>
              {dictError && <div style={{background:dark?"#1A0E0E":"#FFF0F0",border:`1px solid ${dark?"#4A2020":"#E0A0A0"}`,borderRadius:8,padding:"12px 16px",color:dark?"#C06060":"#A02020",fontSize:13,marginBottom:12}}>{dictError}</div>}
              {dictResult && !dictLoading && (
                <div className="fade-in">
                  {dictResult.mode==="zh"
                    ? <DictZh d={dictResult} onLookup={w=>lookupDict(w)}/>
                    : <DictEn d={dictResult} onLookup={w=>lookupDict(w)}/>}
                </div>
              )}
              {!dictResult && !dictLoading && (
                <div style={{textAlign:"center",padding:"44px 20px"}}>
                  <div style={{fontSize:60,color:t.ghost,marginBottom:12,lineHeight:1}}>典</div>
                  <div style={{fontSize:13,color:t.faint,marginBottom:8,lineHeight:1.8}}>Chinese input → character dictionary</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:14}}>
                    {DICT_SUGG_ZH.map(w=><button key={w} style={{...S.sugg,fontSize:18}} onClick={()=>lookupDict(w)}>{w}</button>)}
                  </div>
                  <div style={{fontSize:13,color:t.faint,marginBottom:8,lineHeight:1.8}}>English input → translations by meaning</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
                    {DICT_SUGG_EN.map(w=><button key={w} style={S.sugg} onClick={()=>lookupDict(w)}>{w}</button>)}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </Th.Provider>
  );
}
