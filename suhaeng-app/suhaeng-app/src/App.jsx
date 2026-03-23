import { useState, useRef } from "react";

/* ══════════════════════════════════════════════
   ENV — GitHub Secret에서 빌드 시 주입됨
   로컬 개발: .env 파일에 VITE_API_KEY=sk-ant-... 추가
══════════════════════════════════════════════ */
const API_KEY = import.meta.env.VITE_API_KEY || "";
// 비밀번호도 환경변수로 관리. GitHub Secret: VITE_APP_PASSWORD
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "suhaeng2025";

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const SCHOOL_TYPES = [
  { id:"일반고", label:"일반고", desc:"내신 중심 · 논술형 평가",     icon:"🏫" },
  { id:"갓반고", label:"갓반고", desc:"학력 우수 · 심화 서술형",     icon:"⭐" },
  { id:"국제고", label:"국제고", desc:"글로벌 이슈 · 영어 혼용",     icon:"🌏" },
  { id:"외고",  label:"외고",  desc:"언어·문화·국제관계",          icon:"📖" },
  { id:"영재고", label:"영재고", desc:"수학·과학 심화 · 논문 스타일", icon:"🔬" },
  { id:"과학고", label:"과학고", desc:"실험·탐구 · R&E 형식",       icon:"⚗️" },
];

const PAL = [
  {bg:"#eef4ff",bd:"#4f8ef7"},{bg:"#fff7ed",bd:"#f97316"},
  {bg:"#f0fdf4",bd:"#22c55e"},{bg:"#fdf4ff",bd:"#a855f7"},
  {bg:"#fff1f2",bd:"#ef4444"},{bg:"#f0f9ff",bd:"#0ea5e9"},
];

/* ══════════════════════════════════════════════
   API STREAM — 실제 Anthropic API 직접 호출
══════════════════════════════════════════════ */
async function callClaude(messages, onChunk) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      // 브라우저에서 직접 호출 허용 (Anthropic 정책상 명시 필요)
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      stream: true,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.type === "content_block_delta" && d.delta?.text) {
          full += d.delta.text;
          onChunk(full);
        }
      } catch {}
    }
  }
  return full;
}

/* ══════════════════════════════════════════════
   COPY
══════════════════════════════════════════════ */
function copyText(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {}
}

/* ══════════════════════════════════════════════
   PRINT
══════════════════════════════════════════════ */
function printResult(html) {
  const styleId = "__print_style__";
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = `
    @media print {
      body > *:not(#print-target) { display:none !important; }
      #print-target {
        display:block !important;
        font-family:'Noto Sans KR',sans-serif;
        font-size:13px; line-height:1.8; color:#222; padding:20px;
      }
      a { color:#3b5bdb; }
    }
  `;
  let target = document.getElementById("print-target");
  if (!target) {
    target = document.createElement("div");
    target.id = "print-target";
    target.style.cssText = "display:none";
    document.body.appendChild(target);
  }
  target.innerHTML = html;
  window.print();
  setTimeout(() => { style.textContent = ""; target.innerHTML = ""; }, 2000);
}

/* ══════════════════════════════════════════════
   PROMPT BUILDER
══════════════════════════════════════════════ */
function buildPrompt(lang, school, subject, topic, cond, extra) {
  if (lang === "en") return `
You are an expert research assistant for high school performance assessments.
Student — School: ${school} | Subject: ${subject} | Topic: ${topic} | Conditions: ${cond||"None"} | Extra: ${extra||"None"}

Output with EXACTLY these section headings (###):

### 🏫 School Type Analysis
2-3 sentences on ${school} characteristics and scoring priorities.

### 📌 Writing Directions
CRITICAL FORMAT — each direction MUST start with #### on its own line:

#### Direction 1: [Title Here]
**Core argument:** one sentence
**Why suits ${school}:** one sentence
**Structure:** intro → body keyword 1, body keyword 2 → conclusion
**Difficulty:** ⭐⭐⭐

#### Direction 2: [Title Here]
(continue for 5 or more directions)

### 📚 Recommended References (20 or more)
**[Academic Papers]** (5+) — for each: name, author, then URL on its own line starting with https://
**[News Articles]** (5+)
**[Government/Official Data]** (3+)
**[YouTube/Lectures]** (3+)
**[Other]** (2+)

### ✏️ Writing Guide
Outline example, common mistakes for ${school}, citation format, parts student must write themselves.

IMPORTANT: Put every URL on its own line as plain text starting with https://
`.trim();

  return `
당신은 대한민국 고등학교 수행평가 전문 리서치 어시스턴트입니다.
학생 정보 — 학교: ${school} | 과목: ${subject} | 주제: ${topic} | 조건: ${cond||"없음"} | 자료: ${extra||"없음"}

반드시 아래 섹션 헤더(###)로 출력하세요:

### 🏫 학교 유형 분석
${school} 수행평가 특성과 채점 핵심 요소 2~3줄.

### 📌 글쓰기 방향
중요: 각 방향은 반드시 #### 로 시작하는 별도 줄로 구분:

#### 방향 1: [제목]
**핵심 주장:** 한 문장
**${school}에 적합한 이유:** 한 문장
**논거 구조:** 서론 키워드 → 본론 키워드1, 키워드2 → 결론 키워드
**난이도:** ⭐⭐⭐

#### 방향 2: [제목]
(5개 이상 계속)

### 📚 추천 참고자료 (20개 이상)
**[논문/학술자료]** (5개 이상) — 각 자료: 제목, 저자/기관, 다음 줄에 https:// 로 시작하는 URL
**[신문·뉴스 기사]** (5개 이상)
**[공공기관·정부 자료]** (3개 이상)
**[유튜브·강의 영상]** (3개 이상)
**[기타]** (2개 이상)

### ✏️ 보고서 작성 가이드
권장 목차, ${school} 감점 주의사항, 인용 방식, 반드시 직접 써야 할 부분.

중요: 모든 URL은 반드시 별도 줄에 https://로 시작하는 완전한 형태로 작성하세요.
`.trim();
}

function buildDeepDivePrompt(lang, idx, school, subject, topic, dirText) {
  if (lang === "en") return `
Deep dive on Direction ${idx+1} for "${subject}" (${school}).
Topic: "${topic}"
Direction content: ${dirText}

1. 5+ sub-arguments with evidence
2. 10 credible sources with full URLs (each URL on its own line starting with https://)
3. Key statistics/data to cite
4. Counterarguments + rebuttals
5. Detailed outline (intro → body sections → conclusion)
`.trim();

  return `
${school} "${subject}" 수행평가 방향 ${idx+1}번 심화 분석.
주제: "${topic}"
방향 내용: ${dirText}

1. 세부 논거 5개 이상 (각 근거 포함)
2. 공신력 있는 자료 10개 이상 (각 URL을 별도 줄에 https://로 시작)
3. 활용할 핵심 통계·데이터
4. 예상 반론 + 재반박
5. 상세 개요 (서론 → 본론 각 단락 → 결론)
`.trim();
}

/* ══════════════════════════════════════════════
   PARSE RESULT
══════════════════════════════════════════════ */
function parseResult(text) {
  const sections = [];
  let curHead = null, buf = [];
  const flush = () => {
    if (curHead !== null) sections.push({ heading: curHead, body: buf.join("\n").trim() });
    buf = [];
  };
  for (const line of text.split("\n")) {
    if (line.startsWith("###")) { flush(); curHead = line.replace(/^###\s*/, "").trim(); }
    else buf.push(line);
  }
  flush();
  return sections;
}

function parseDirections(body) {
  const blocks = body.split(/\n(?=####\s)/g).map(b => b.trim()).filter(Boolean);
  const dirs = blocks.filter(b => b.startsWith("####"));
  return dirs.length >= 2 ? dirs : [];
}

/* ══════════════════════════════════════════════
   URL CHIP
══════════════════════════════════════════════ */
function UrlChip({ url }) {
  let display = url;
  try {
    const u = new URL(url);
    display = u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 24) + "…" : "");
  } catch {}
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url}
      style={{
        display:"inline-flex", alignItems:"center", gap:4,
        background:"#eef4ff", border:"1px solid #c7d2fe", borderRadius:8,
        padding:"3px 10px", fontSize:11.5, color:"#3b5bdb", textDecoration:"none",
        maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        verticalAlign:"middle", margin:"2px 0",
      }}
      onMouseEnter={e => e.currentTarget.style.background="#dbe4ff"}
      onMouseLeave={e => e.currentTarget.style.background="#eef4ff"}
    >🔗 {display}</a>
  );
}

/* ══════════════════════════════════════════════
   RICH TEXT
══════════════════════════════════════════════ */
function RichText({ text }) {
  if (!text) return null;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
      {text.split("\n").map((line, li) => {
        if (!line.trim()) return <div key={li} style={{ height:5 }} />;
        const clean = line.replace(/^####\s*/, "");
        const isDir = line.startsWith("####");
        const parts = clean.split(/(https?:\/\/[^\s)"'\]>]+)/g);
        return (
          <div key={li} style={{
            fontSize: isDir ? 14 : 13.5,
            fontWeight: isDir ? 800 : 400,
            lineHeight: 2, color: isDir ? "#1a1a2e" : "#333",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}>
            {parts.map((p, pi) => {
              if (/^https?:\/\//.test(p)) return <UrlChip key={pi} url={p} />;
              return (
                <span key={pi}>
                  {p.split(/(\*\*[^*]+\*\*)/g).map((c, ci) =>
                    /^\*\*.+\*\*$/.test(c) ? <strong key={ci}>{c.slice(2,-2)}</strong> : c
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════
   DIRECTION CARD
══════════════════════════════════════════════ */
function DirectionCard({ text, index, school, subject, topic, lang }) {
  const [devText, setDevText] = useState("");
  const [devLoading, setDevLoading] = useState(false);
  const col = PAL[index % PAL.length];
  const isKo = lang === "ko";

  const develop = async () => {
    setDevLoading(true); setDevText("");
    try {
      await callClaude(
        [{ role:"user", content: buildDeepDivePrompt(lang, index, school, subject, topic, text) }],
        chunk => setDevText(chunk)
      );
    } catch { setDevText(isKo ? "오류가 발생했습니다." : "Error. Try again."); }
    finally { setDevLoading(false); }
  };

  return (
    <div style={{
      background:"#fff", borderRadius:12, border:`1.5px solid ${col.bd}55`,
      padding:"16px 20px", marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <RichText text={text} />
      <div style={{ marginTop:14, paddingTop:12, borderTop:`1px dashed ${col.bd}44` }}>
        <button
          onClick={develop}
          disabled={devLoading}
          style={{
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"8px 18px", borderRadius:8,
            border:`2px solid ${col.bd}`,
            background: devLoading ? "#f5f5f5" : col.bg,
            color: devLoading ? "#bbb" : col.bd,
            cursor: devLoading ? "not-allowed" : "pointer",
            fontSize:12.5, fontWeight:800, fontFamily:"inherit", transition:"background .2s, color .2s",
          }}
          onMouseEnter={e => { if (!devLoading) { e.currentTarget.style.background=col.bd; e.currentTarget.style.color="#fff"; } }}
          onMouseLeave={e => { e.currentTarget.style.background=devLoading?"#f5f5f5":col.bg; e.currentTarget.style.color=devLoading?"#bbb":col.bd; }}
        >
          {devLoading
            ? <><span style={{ display:"inline-block", width:12, height:12, borderRadius:"50%", border:`2px solid ${col.bd}44`, borderTopColor:col.bd, animation:"spin .7s linear infinite" }} />{isKo?"심화 분석 중…":"Analyzing…"}</>
            : isKo ? "🔍 이 방향 더 발전시키기" : "🔍 Develop this direction further"
          }
        </button>
      </div>
      {devText && (
        <div style={{ marginTop:14, padding:"16px 18px", background:col.bg, borderRadius:10, border:`1px solid ${col.bd}55` }}>
          <div style={{ fontWeight:800, fontSize:12.5, color:col.bd, marginBottom:10, fontFamily:"'Noto Sans KR',sans-serif" }}>
            🔬 {isKo ? `심화 분석 — 방향 ${index+1}` : `Deep Dive — Direction ${index+1}`}
          </div>
          <RichText text={devText} />
          {devLoading && <div style={{ fontSize:11, color:"#bbb", marginTop:8 }}>✦ {isKo?"분석 중...":"Analyzing..."}</div>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   RESULT VIEW
══════════════════════════════════════════════ */
function ResultView({ content, school, subject, topic, lang }) {
  const sections = parseResult(content);
  if (!sections.length) return (
    <div style={{ background:"#fafafa", borderRadius:14, padding:24 }}><RichText text={content} /></div>
  );
  const isDirSection = h => /글쓰기\s*방향|writing\s*direction/i.test(h);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {sections.map((sec, si) => {
        const col = PAL[si % PAL.length];
        const dirBlocks = isDirSection(sec.heading) ? parseDirections(sec.body) : [];
        return (
          <div key={si} style={{ background:col.bg, borderRadius:16, borderLeft:`4px solid ${col.bd}`, padding:"20px 24px" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:800, color:"#1a1a2e", fontFamily:"'Noto Sans KR',sans-serif", borderBottom:`1px solid ${col.bd}33`, paddingBottom:10 }}>
              {sec.heading}
            </h3>
            {dirBlocks.length > 0
              ? dirBlocks.map((block, bi) => (
                  <DirectionCard key={bi} text={block} index={bi} school={school} subject={subject} topic={topic} lang={lang} />
                ))
              : <RichText text={sec.body} />
            }
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════
   STEP INDICATOR
══════════════════════════════════════════════ */
function StepIndicator({ current, steps }) {
  return (
    <div style={{ display:"flex", alignItems:"center", marginBottom:36 }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", flex: i < steps.length-1 ? 1 : "none" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{
              width:32, height:32, borderRadius:"50%",
              background: i < current ? "#4f8ef7" : i === current ? "#1a1a2e" : "#e8e8f0",
              color: i <= current ? "#fff" : "#aaa",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:700, transition:"all .3s",
              border: i === current ? "2px solid #4f8ef7" : "2px solid transparent",
              boxShadow: i === current ? "0 0 0 4px rgba(79,142,247,0.15)" : "none",
            }}>
              {i < current ? "✓" : i+1}
            </div>
            <span style={{ fontSize:11, color: i === current ? "#1a1a2e" : "#999", fontWeight: i === current ? 700 : 400, whiteSpace:"nowrap" }}>{label}</span>
          </div>
          {i < steps.length-1 && <div style={{ flex:1, height:2, background: i < current ? "#4f8ef7" : "#e8e8f0", margin:"0 8px", marginBottom:20, transition:"all .3s" }} />}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PASSWORD GATE
══════════════════════════════════════════════ */
function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const tryLogin = () => {
    if (pw === APP_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(145deg,#f0f4ff 0%,#faf0ff 50%,#f0fff8 100%)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Noto Sans KR',-apple-system,sans-serif",
      padding:"20px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
        @keyframes spin { to { transform:rotate(360deg) } }
        .shake { animation: shake 0.4s ease; }
      `}</style>
      <div className={shake ? "shake" : ""} style={{
        background:"#fff", borderRadius:24, padding:"44px 40px",
        boxShadow:"0 8px 48px rgba(79,142,247,0.15)",
        width:"100%", maxWidth:400, textAlign:"center",
      }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📚</div>
        <h1 style={{ margin:"0 0 6px", fontSize:22, fontWeight:900, color:"#1a1a2e" }}>수행평가 리서치 도우미</h1>
        <p style={{ margin:"0 0 32px", color:"#888", fontSize:13.5 }}>비밀번호를 입력하면 이용할 수 있어요</p>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && tryLogin()}
          placeholder="비밀번호 입력..."
          autoFocus
          style={{
            width:"100%", padding:"14px 16px", borderRadius:12, boxSizing:"border-box",
            border: error ? "2px solid #ef4444" : "2px solid #e0e0f0",
            fontSize:16, fontFamily:"inherit", outline:"none", marginBottom:8,
            textAlign:"center", letterSpacing:4,
            transition:"border-color .2s",
          }}
        />
        {error && <p style={{ margin:"0 0 12px", fontSize:13, color:"#ef4444" }}>비밀번호가 틀렸습니다</p>}
        <button
          onClick={tryLogin}
          style={{
            width:"100%", padding:"14px", borderRadius:12, border:"none",
            background:"linear-gradient(135deg,#4f8ef7,#7c5cf7)",
            color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer",
            fontFamily:"inherit", boxShadow:"0 4px 16px rgba(79,142,247,0.35)",
            marginTop: error ? 0 : 4,
          }}
        >
          입장하기 →
        </button>
        <p style={{ margin:"20px 0 0", fontSize:11.5, color:"#ccc" }}>
          이 서비스는 학습 보조 목적으로만 제공됩니다
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════ */
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [lang, setLang]         = useState("ko");
  const [step, setStep]         = useState(0);
  const [school, setSchool]     = useState("");
  const [subject, setSubject]   = useState("");
  const [topic, setTopic]       = useState("");
  const [cond, setCond]         = useState("");
  const [extra, setExtra]       = useState("");
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState("");
  const [stream, setStream]     = useState("");
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);

  const fileRef   = useRef(null);
  const resultRef = useRef(null);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  const isKo = lang === "ko";
  const STEPS = isKo ? ["학교 유형","평가 정보","참고 자료","결과 보기"] : ["School Type","Assignment","Materials","Results"];

  const addFiles = async (list) => {
    const out = [];
    for (const f of Array.from(list)) {
      const isImg = f.type.startsWith("image/"), isPDF = f.type === "application/pdf";
      if (isImg || isPDF) {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
        out.push({ name:f.name, type:f.type, base64:b64, isImg, isPDF });
      } else {
        out.push({ name:f.name, type:f.type, text:await f.text(), isText:true });
      }
    }
    setFiles(p => [...p, ...out]);
  };

  const handleGenerate = async () => {
    setStep(3); setLoading(true); setResult(""); setStream(""); setError("");
    const content = [];
    for (const f of files) {
      if (f.isImg)  content.push({ type:"image",    source:{ type:"base64", media_type:f.type, data:f.base64 } });
      if (f.isPDF)  content.push({ type:"document", source:{ type:"base64", media_type:"application/pdf", data:f.base64 } });
      if (f.isText) content.push({ type:"text", text:`[첨부: ${f.name}]\n${f.text}` });
    }
    content.push({ type:"text", text:buildPrompt(lang, school, subject, topic, cond, extra) });
    try {
      const final = await callClaude([{ role:"user", content }], chunk => setStream(chunk));
      setResult(final);
    } catch (e) {
      setError(isKo ? `오류: ${e.message}` : `Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    copyText(result || stream);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePDF = () => {
    if (resultRef.current) printResult(resultRef.current.innerHTML);
  };

  const reset = () => {
    setStep(0); setSchool(""); setSubject(""); setTopic(""); setCond(""); setExtra(""); setFiles([]);
    setResult(""); setStream(""); setError("");
  };

  const canNext = step===0 ? !!school : step===1 ? !!subject.trim() && !!topic.trim() : true;
  const displayed = result || stream;
  const INP = { width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #e0e0f0", fontSize:14, boxSizing:"border-box", outline:"none", fontFamily:"inherit" };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(145deg,#f0f4ff 0%,#faf0ff 50%,#f0fff8 100%)", fontFamily:"'Noto Sans KR',-apple-system,sans-serif", padding:"32px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth:760, margin:"0 auto" }}>
        {/* HEADER */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ display:"flex", justifyContent:"center", gap:10, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ background:"linear-gradient(135deg,#4f8ef7,#a855f7)", borderRadius:12, padding:"8px 18px" }}>
              <span style={{ color:"#fff", fontWeight:800, fontSize:12, letterSpacing:1 }}>{isKo?"수행평가 리서치 도우미":"Assessment Research Helper"}</span>
            </div>
            <button onClick={() => setLang(l => l==="ko"?"en":"ko")}
              style={{ padding:"8px 16px", borderRadius:12, border:"1.5px solid #c7d2fe", background:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, color:"#4f8ef7", fontFamily:"inherit" }}>
              {isKo?"🌐 English Mode":"🌐 한국어 모드"}
            </button>
          </div>
          <h1 style={{ margin:0, fontSize:30, fontWeight:900, color:"#1a1a2e", lineHeight:1.25 }}>
            {isKo?"수행평가":"Performance Assessment"}<br />
            <span style={{ background:"linear-gradient(90deg,#4f8ef7,#a855f7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              {isKo?"주제 & 자료 찾기":"Topic & Source Finder"}
            </span>
          </h1>
          <p style={{ margin:"12px 0 0", color:"#888", fontSize:13.5 }}>
            {isKo?"학교 유형에 맞는 글쓰기 방향 5개 이상 + 공신력 있는 자료 20개 추천":"5+ writing directions + 20+ credible sources tailored to your school type"}
          </p>
        </div>

        {/* CARD */}
        <div style={{ background:"#fff", borderRadius:24, padding:"32px 36px", boxShadow:"0 8px 40px rgba(79,142,247,0.12)" }}>
          <StepIndicator current={step} steps={STEPS} />

          {/* STEP 0 */}
          {step===0 && (
            <div>
              <h2 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"#1a1a2e" }}>{isKo?"학교 유형을 선택해주세요":"Select your school type"}</h2>
              <p style={{ margin:"0 0 24px", color:"#888", fontSize:13 }}>{isKo?"선택한 유형에 맞춰 글쓰기 방향과 자료 수준을 조정합니다":"Adjusts direction and resources to match your school"}</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {SCHOOL_TYPES.map(ty => (
                  <button key={ty.id} onClick={() => setSchool(ty.id)} style={{
                    padding:"18px 14px", borderRadius:14, border:"2px solid",
                    borderColor: school===ty.id ? "#4f8ef7" : "#e8e8f0",
                    background: school===ty.id ? "linear-gradient(135deg,#eef4ff,#f5f0ff)" : "#fafafa",
                    cursor:"pointer", textAlign:"left", transition:"all .2s",
                    boxShadow: school===ty.id ? "0 4px 20px rgba(79,142,247,0.18)" : "none",
                    transform: school===ty.id ? "translateY(-2px)" : "none",
                  }}>
                    <div style={{ fontSize:26, marginBottom:6 }}>{ty.icon}</div>
                    <div style={{ fontWeight:800, fontSize:14, color: school===ty.id ? "#2b5ce6" : "#1a1a2e", fontFamily:"'Noto Sans KR',sans-serif" }}>{ty.label}</div>
                    <div style={{ fontSize:11, color:"#888", marginTop:3, fontFamily:"'Noto Sans KR',sans-serif", lineHeight:1.4 }}>{ty.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 */}
          {step===1 && (
            <div>
              <h2 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"#1a1a2e" }}>{isKo?"수행평가 정보 입력":"Enter assignment details"}</h2>
              <p style={{ margin:"0 0 24px", color:"#888", fontSize:13 }}>{isKo?"교사가 제시한 주제와 조건을 최대한 그대로 입력해주세요":"Enter your teacher's exact topic and requirements"}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                <div>
                  <label style={{ display:"block", fontWeight:700, fontSize:13, color:"#444", marginBottom:6 }}>{isKo?"교과목":"Subject"} <span style={{ color:"#ef4444" }}>*</span></label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={isKo?"예: 사회문화, 생명과학Ⅱ, 영어독해, 국어...":"e.g. AP Biology, World History..."} style={INP} />
                </div>
                <div>
                  <label style={{ display:"block", fontWeight:700, fontSize:13, color:"#444", marginBottom:6 }}>{isKo?"수행평가 주제 / 과제 설명":"Assignment topic"} <span style={{ color:"#ef4444" }}>*</span></label>
                  <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={4}
                    placeholder={isKo?"예: '청소년 SNS 사용이 정신건강에 미치는 영향'에 대해 사회과학적 관점으로 보고서를 작성하시오. (A4 3장, 참고문헌 5개 이상)":"e.g. Write a report on the impact of social media on adolescent mental health. (3 pages, 5+ references)"}
                    style={{ ...INP, resize:"vertical", lineHeight:1.7 }} />
                </div>
                <div>
                  <label style={{ display:"block", fontWeight:700, fontSize:13, color:"#444", marginBottom:6 }}>{isKo?"추가 조건 (선택)":"Additional conditions (optional)"}</label>
                  <input value={cond} onChange={e => setCond(e.target.value)} placeholder={isKo?"예: 마감 2주, 분량 2000자, 서론-본론-결론 구조 필수...":"e.g. 2-week deadline, APA format..."} style={INP} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step===2 && (
            <div>
              <h2 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"#1a1a2e" }}>{isKo?"참고 자료 첨부 (선택)":"Attach reference materials (optional)"}</h2>
              <p style={{ margin:"0 0 20px", color:"#888", fontSize:13 }}>{isKo?"교사가 준 자료나 필수 참고문헌이 있으면 첨부하거나 붙여넣기 해주세요.":"Attach or paste any materials provided by your teacher."}</p>
              <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md,image/*"
                onChange={e => { addFiles(e.target.files); e.target.value=""; }} style={{ display:"none" }} />
              <div
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor="#4f8ef7"; e.currentTarget.style.background="#eef4ff"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor="#c7d2fe"; e.currentTarget.style.background="#f8faff"; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor="#c7d2fe"; e.currentTarget.style.background="#f8faff"; addFiles(e.dataTransfer.files); }}
                style={{ border:"2px dashed #c7d2fe", borderRadius:14, padding:"28px 20px", background:"#f8faff", textAlign:"center", cursor:"pointer", transition:"all .2s", marginBottom:14 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📎</div>
                <div style={{ fontWeight:700, fontSize:14, color:"#4f8ef7", marginBottom:4 }}>{isKo?"파일을 클릭하거나 드래그해서 첨부":"Click or drag files here"}</div>
                <div style={{ fontSize:12, color:"#aaa" }}>{isKo?"PDF · 이미지 · TXT · MD 지원":"PDF · Images · TXT · MD supported"}</div>
              </div>
              {files.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 14px" }}>
                      <span>{f.isPDF?"📄":f.isImg?"🖼️":"📝"}</span>
                      <span style={{ flex:1, fontSize:13, fontWeight:600, color:"#166534", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                      <button onClick={() => setFiles(p => p.filter((_,j) => j!==i))}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#86efac", fontSize:16, padding:0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={4}
                placeholder={isKo?"또는 교사 제공 프린트 내용, 필수 논문 제목, 수업 내용 등을 직접 붙여넣기...":"Or paste handouts, required paper titles, lesson notes..."}
                style={{ ...INP, resize:"vertical", lineHeight:1.8 }} />
              <div style={{ marginTop:12, padding:"12px 16px", background:"#fffbeb", borderRadius:10, border:"1px solid #fde68a", fontSize:12.5, color:"#92400e" }}>
                💡 {isKo?"자료 없어도 OK! AI가 주제에 맞는 자료를 직접 찾아드립니다.":"No materials? AI will find relevant sources for you!"}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step===3 && (
            <div>
              {loading && !stream && (
                <div style={{ textAlign:"center", padding:"48px 0" }}>
                  <div style={{ width:48, height:48, borderRadius:"50%", border:"4px solid #e0e0f0", borderTop:"4px solid #4f8ef7", animation:"spin .9s linear infinite", margin:"0 auto 20px" }} />
                  <p style={{ color:"#888", fontSize:14 }}>{school} {isKo?"수행평가 분석 중...":"analysis in progress..."}<br /><span style={{ fontSize:12, color:"#bbb" }}>{isKo?"자료 20개+ 수집 중, 잠시만 기다려주세요":"Gathering 20+ sources, please wait"}</span></p>
                </div>
              )}
              {error && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:12, padding:20, color:"#be123c", fontSize:14 }}>⚠️ {error}</div>}
              {displayed && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:10 }}>
                    <div>
                      <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#1a1a2e" }}>{isKo?"분석 결과":"Analysis Results"}</h2>
                      <p style={{ margin:"4px 0 0", fontSize:12, color:"#888" }}>{school} · {subject}</p>
                    </div>
                    {!loading && (
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button onClick={handleCopy}
                          style={{ padding:"8px 14px", borderRadius:8, border:`1.5px solid ${copied?"#22c55e":"#c7d2fe"}`, background:copied?"#f0fdf4":"#fff", cursor:"pointer", fontSize:12.5, fontWeight:700, color:copied?"#22c55e":"#4f8ef7", fontFamily:"inherit", transition:"all .2s" }}>
                          {copied ? (isKo?"✅ 복사됨!":"✅ Copied!") : (isKo?"📋 결과 복사":"📋 Copy Results")}
                        </button>
                        <button onClick={handlePDF}
                          style={{ padding:"8px 14px", borderRadius:8, border:"1.5px solid #d1fae5", background:"#fff", cursor:"pointer", fontSize:12.5, fontWeight:700, color:"#059669", fontFamily:"inherit" }}>
                          {isKo?"🖨️ PDF 출력":"🖨️ Print PDF"}
                        </button>
                        <button onClick={reset}
                          style={{ padding:"8px 14px", borderRadius:8, border:"1.5px solid #e0e0f0", background:"#fff", cursor:"pointer", fontSize:12.5, fontWeight:600, color:"#666", fontFamily:"inherit" }}>
                          {isKo?"↺ 다시 시작":"↺ Start Over"}
                        </button>
                      </div>
                    )}
                  </div>
                  <div ref={resultRef}>
                    <ResultView content={displayed} school={school} subject={subject} topic={topic} lang={lang} />
                  </div>
                  {loading && <div style={{ textAlign:"center", padding:"16px 0", color:"#aaa", fontSize:12 }}>✦ {isKo?"분석 중...":"Analyzing..."}</div>}
                </div>
              )}
            </div>
          )}

          {/* NAVIGATION */}
          {step < 3 && (
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:32 }}>
              <button onClick={() => setStep(s => s-1)} disabled={step===0}
                style={{ padding:"12px 24px", borderRadius:10, border:"1.5px solid #e0e0f0", background:step===0?"#f5f5f5":"#fff", color:step===0?"#ccc":"#666", cursor:step===0?"default":"pointer", fontSize:14, fontWeight:600, fontFamily:"inherit" }}>
                {isKo?"← 이전":"← Back"}
              </button>
              {step < 2
                ? <button onClick={() => setStep(s => s+1)} disabled={!canNext}
                    style={{ padding:"12px 28px", borderRadius:10, border:"none", background:canNext?"linear-gradient(135deg,#4f8ef7,#7c5cf7)":"#e8e8f0", color:canNext?"#fff":"#bbb", cursor:canNext?"pointer":"default", fontSize:14, fontWeight:700, fontFamily:"inherit", boxShadow:canNext?"0 4px 14px rgba(79,142,247,0.35)":"none" }}>
                    {isKo?"다음 →":"Next →"}
                  </button>
                : <button onClick={handleGenerate}
                    style={{ padding:"12px 28px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#4f8ef7,#7c5cf7)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700, fontFamily:"inherit", boxShadow:"0 4px 14px rgba(79,142,247,0.35)" }}>
                    {isKo?"✨ 분석 시작!":"✨ Start Analysis!"}
                  </button>
              }
            </div>
          )}
        </div>
        <p style={{ textAlign:"center", marginTop:24, fontSize:11.5, color:"#bbb" }}>
          {isKo?"보고서 본문은 직접 작성해야 합니다 · 방향 제시 및 자료 수집 목적의 도구입니다":"You must write the report yourself · This tool is for guidance and source collection only"}
        </p>
      </div>
    </div>
  );
}
