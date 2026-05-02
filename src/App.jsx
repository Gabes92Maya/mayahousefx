import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kdkmolutucldwkmomghb.supabase.co";
const SUPABASE_KEY = "sb_publishable_G2LArtM7YgWdLoTWBAOd7g_ymvVzsoI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmt    = (n,d=2) => new Intl.NumberFormat("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fmtUSD = (n) => (n<0?"-$":"$")+fmt(Math.abs(n));
const fmtPct = (n) => (n>=0?"+":"")+fmt(n)+"%";
const getDaysInMonth     = (y,m) => new Date(y,m+1,0).getDate();
const getFirstDayOfMonth = (y,m) => { const d=new Date(y,m,1).getDay(); return d===0?6:d-1; };
const PALETTE = ["#0ea5e9","#8b5cf6","#f59e0b","#ec4899","#f43f5e","#10b981","#06b6d4","#f97316","#a78bfa","#34d399"];
const T = {
  dark:  { bg:"#0c1018",surface:"#141923",surfaceAlt:"#1a2233",surfaceHover:"#1e2840",border:"#232e42",text:"#e6eaf4",textSub:"#7d8fa8",textMuted:"#3d4f66",positive:"#22d07a",negative:"#f0476a",posLight:"rgba(34,208,122,0.08)",negLight:"rgba(240,71,106,0.08)",sidebar:"#0a0d14" },
  light: { bg:"#eef1f8",surface:"#ffffff", surfaceAlt:"#f2f5fc",surfaceHover:"#e8edf8",border:"#d4dae8",text:"#0d1526",textSub:"#4a5568",textMuted:"#94a3b8",positive:"#16a34a",negative:"#dc2626",posLight:"rgba(22,163,74,0.08)",negLight:"rgba(220,38,38,0.08)",sidebar:"#161d2e" },
};

// ═══════════════════════════════════════════════════════════
// MT5 HTML PARSER — Fixed for AXI/MT5 format
// Column layout: 0=openTime 1=ticket 2=symbol 3=type 4=EMPTY
//   5=volume 6=openPrice 7=SL 8=TP 9=closeTime 10=closePrice
//   11=commission 12=swap 13=profit
// ═══════════════════════════════════════════════════════════
function parseMT5Report(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const rows = doc.querySelectorAll("tr");

  const trades = [];
  let inPositions = false;

  for (const row of rows) {
    const rowText = row.textContent;

    // Start collecting after "Positions" header
    if (!inPositions) {
      if (rowText.includes("Positions")) inPositions = true;
      continue;
    }
    // Stop at "Orders" section
    if (rowText.includes("Orders") || rowText.includes("Deals")) break;

    const cells = row.querySelectorAll("td");
    if (cells.length < 14) continue;

    const openTime = cells[0]?.textContent?.trim();
    // Must match date pattern like "2026.03.27 08:07:15"
    if (!openTime || !/^\d{4}\.\d{2}\.\d{2}/.test(openTime)) continue;

    try {
      const closeTime  = cells[9]?.textContent?.trim() || "";
      const commission = parseFloat(cells[11]?.textContent?.trim()) || 0;
      const swap       = parseFloat(cells[12]?.textContent?.trim()) || 0;
      // Remove spaces and non-breaking spaces from profit
      const profitRaw  = (cells[13]?.textContent || "0").replace(/[\s\u00a0]/g, "");
      const profit     = parseFloat(profitRaw) || 0;
      const net        = profit + commission + swap;

      // Convert "2026.03.27 08:16:37" → "2026-03-27"
      const closeDate = closeTime.slice(0, 10).replace(/\./g, "-");
      const openDate  = openTime.slice(0, 10).replace(/\./g, "-");

      if (!closeDate || closeDate.length < 10) continue;

      trades.push({
        openDate, closeDate,
        symbol:     cells[2]?.textContent?.trim() || "",
        type:       cells[3]?.textContent?.trim() || "",
        volume:     parseFloat(cells[5]?.textContent?.trim()) || 0,
        openPrice:  parseFloat(cells[6]?.textContent?.trim()) || 0,
        closePrice: parseFloat(cells[10]?.textContent?.trim()) || 0,
        commission, swap, profit, net,
      });
    } catch { continue; }
  }

  if (trades.length === 0) return null;

  // Aggregate daily P&L
  const dailyPnL = {};
  for (const t of trades) {
    if (!dailyPnL[t.closeDate]) dailyPnL[t.closeDate] = { pnl: 0, trades: 0, wins: 0 };
    dailyPnL[t.closeDate].pnl    += t.net;
    dailyPnL[t.closeDate].trades += 1;
    if (t.net > 0) dailyPnL[t.closeDate].wins += 1;
  }

  const totalPnL    = trades.reduce((s,t) => s + t.net, 0);
  const grossProfit = trades.filter(t => t.net > 0).reduce((s,t) => s + t.net, 0);
  const grossLoss   = trades.filter(t => t.net < 0).reduce((s,t) => s + t.net, 0);
  const wins        = trades.filter(t => t.net > 0).length;
  const losses      = trades.filter(t => t.net < 0).length;
  const winRate     = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const profitFactor= Math.abs(grossLoss) > 0 ? grossProfit / Math.abs(grossLoss) : 0;
  const symbols     = [...new Set(trades.map(t => t.symbol))];
  const sortedDates = Object.keys(dailyPnL).sort();

  return {
    trades, dailyPnL, totalPnL, grossProfit, grossLoss,
    wins, losses, winRate, profitFactor, symbols,
    totalTrades: trades.length,
    firstDate: sortedDates[0] || "",
    lastDate:  sortedDates[sortedDates.length - 1] || "",
  };
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ open, onClose, onImported, userId, t }) {
  const [step,      setStep]      = useState(1);
  const [parsed,    setParsed]    = useState(null);
  const [accName,   setAccName]   = useState("");
  const [provider,  setProvider]  = useState("");
  const [type,      setType]      = useState("Capital Propio");
  const [cost,      setCost]      = useState("0");
  const [withdrawn, setWithdrawn] = useState("0");
  const [iniBalance,setIniBalance]= useState("");
  const [color,     setColor]     = useState("#0ea5e9");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const fileRef = useRef();

  const reset = () => {
    setStep(1); setParsed(null); setAccName(""); setProvider("");
    setType("Capital Propio"); setCost("0"); setWithdrawn("0");
    setIniBalance(""); setColor("#0ea5e9"); setLoading(false); setError("");
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setError("");

    // Try multiple encodings
    const tryParse = (text) => {
      const result = parseMT5Report(text);
      if (result && result.totalTrades > 0) {
        setParsed(result);
        // Auto-suggest name
        const nameGuess = f.name.replace(/ReportHistory-?/, "").replace(/\.[^.]+$/, "");
        setAccName(nameGuess ? `Cuenta ${nameGuess}` : "Mi cuenta MT5");
        setStep(2);
        return true;
      }
      return false;
    };

    // First try UTF-16 (most common for MT5)
    const readerUtf16 = new FileReader();
    readerUtf16.onload = (ev) => {
      if (tryParse(ev.target.result)) return;
      // Fallback: try UTF-8
      const readerUtf8 = new FileReader();
      readerUtf8.onload = (ev2) => {
        if (!tryParse(ev2.target.result)) {
          setError("No se encontraron trades. Asegúrate de exportar el 'Informe detallado' (no el extracto) desde MT5.");
        }
      };
      readerUtf8.readAsText(f, "UTF-8");
    };
    readerUtf16.readAsText(f, "UTF-16");
  };

  const handleImport = async () => {
    if (!accName || !iniBalance) { setError("Completa nombre y balance inicial."); return; }
    setLoading(true); setError("");
    try {
      const initBal = parseFloat(iniBalance) || 0;
      const currBal = Math.round((initBal + parsed.totalPnL) * 100) / 100;

      const { data: acc, error: accErr } = await supabase.from("mt_accounts").insert({
        user_id: userId, name: accName, provider, type,
        cost: parseFloat(cost) || 0, withdrawn: parseFloat(withdrawn) || 0,
        color, status: "Live",
        initial_balance: initBal,
        current_balance: currBal,
        start_date: parsed.firstDate || new Date().toISOString().split("T")[0],
        login: "imported", server: "MT5-Import",
      }).select().single();

      if (accErr) throw accErr;

      // Insert daily P&L
      const pnlRows = Object.entries(parsed.dailyPnL).map(([date, d]) => ({
        user_id:     userId,
        account_id:  acc.id,
        date,
        pnl:         Math.round(d.pnl * 100) / 100,
        trades_count: d.trades,
      }));

      if (pnlRows.length > 0) {
        const { error: pnlErr } = await supabase.from("daily_pnl")
          .upsert(pnlRows, { onConflict: "account_id,date" });
        if (pnlErr) throw pnlErr;
      }

      onImported();
      onClose();
      reset();
    } catch (e) {
      setError(e.message || "Error importando");
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:20,padding:32,width:"min(560px,93vw)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <h2 style={{fontSize:17,fontWeight:700,color:t.text}}>Importar reporte MT5</h2>
            <p style={{fontSize:12,color:t.textMuted,marginTop:3}}>Sube el HTML exportado desde MetaTrader 5</p>
          </div>
          <button onClick={()=>{onClose();reset();}} style={{background:"none",border:"none",color:t.textMuted,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>

        {/* Steps indicator */}
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          {["Archivo","Configurar"].map((s,i)=>(
            <div key={s} style={{flex:1,textAlign:"center"}}>
              <div style={{height:3,borderRadius:2,background:step>i?"#0ea5e9":t.border,marginBottom:6,transition:"background 0.3s"}}/>
              <span style={{fontSize:10,color:step>i?"#0ea5e9":t.textMuted,fontWeight:step>i?700:400}}>{s}</span>
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step===1&&(
          <div>
            <div onClick={()=>fileRef.current?.click()}
              style={{border:`2px dashed ${t.border}`,borderRadius:14,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:t.surfaceAlt,transition:"border-color 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#0ea5e9"}
              onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
              <div style={{fontSize:40,marginBottom:12}}>📄</div>
              <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>Haz clic para subir el archivo HTML</div>
              <div style={{fontSize:12,color:t.textMuted}}>Reporte exportado desde MT5 · Formato .html</div>
              <input ref={fileRef} type="file" accept=".html,.htm" onChange={handleFile} style={{display:"none"}}/>
            </div>
            {error&&<div style={{marginTop:12,background:t.negLight,border:`1px solid ${t.negative}30`,borderRadius:9,padding:"10px 14px",fontSize:12,color:t.negative}}>{error}</div>}
            <div style={{marginTop:16,background:t.surfaceAlt,borderRadius:10,padding:"14px 16px",border:`1px solid ${t.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:t.textSub,marginBottom:8}}>📋 Cómo exportar desde MT5:</div>
              <div style={{fontSize:12,color:t.textMuted,lineHeight:1.8}}>
                1. Abre <b style={{color:t.textSub}}>MetaTrader 5</b><br/>
                2. Ve a la pestaña <b style={{color:t.textSub}}>"Historial de cuenta"</b> (panel inferior)<br/>
                3. Clic derecho → <b style={{color:t.textSub}}>"Guardar como informe detallado"</b><br/>
                4. Guarda como <b style={{color:t.textSub}}>HTML</b> y súbelo aquí
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step===2&&parsed&&(
          <div>
            {/* Preview stats */}
            <div style={{background:t.surfaceAlt,borderRadius:12,padding:16,marginBottom:20,border:`1px solid ${t.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:t.positive,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>✅ {parsed.totalTrades} trades encontrados</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[
                  {l:"Trades",v:parsed.totalTrades},
                  {l:"Win Rate",v:fmtPct(parsed.winRate)},
                  {l:"Profit Factor",v:fmt(parsed.profitFactor)},
                  {l:"Gross Profit",v:fmtUSD(parsed.grossProfit)},
                  {l:"Gross Loss",v:fmtUSD(parsed.grossLoss)},
                  {l:"P&L Neto",v:fmtUSD(parsed.totalPnL)},
                  {l:"Desde",v:parsed.firstDate},
                  {l:"Hasta",v:parsed.lastDate},
                  {l:"Símbolos",v:parsed.symbols.slice(0,3).join(", ")+(parsed.symbols.length>3?"...":"")},
                ].map(s=>(
                  <div key={s.l} style={{background:t.surface,borderRadius:8,padding:"8px 10px",border:`1px solid ${t.border}`}}>
                    <div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{s.l}</div>
                    <div style={{fontSize:12,fontWeight:700,color:t.text}}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Config fields */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
              <div style={{gridColumn:"1/-1",marginBottom:12}}>
                <label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Nombre de la cuenta</label>
                <input value={accName} onChange={e=>setAccName(e.target.value)} placeholder="AXI Capital Propio"
                  style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Broker / Proveedor</label>
                <input value={provider} onChange={e=>setProvider(e.target.value)} placeholder="AXI"
                  style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Tipo</label>
                <select value={type} onChange={e=>setType(e.target.value)}
                  style={{width:"100%",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}>
                  <option>Capital Propio</option><option>Fondeo</option><option>Futuros</option><option>Otro</option>
                </select>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Balance inicial ($)</label>
                <input value={iniBalance} onChange={e=>setIniBalance(e.target.value)} type="number" placeholder="5000"
                  style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Inversión / Costo ($)</label>
                <input value={cost} onChange={e=>setCost(e.target.value)} type="number" placeholder="0"
                  style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Total retirado ($)</label>
                <input value={withdrawn} onChange={e=>setWithdrawn(e.target.value)} type="number" placeholder="0"
                  style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
              </div>
              <div style={{marginBottom:16,gridColumn:"1/-1"}}>
                <label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Color</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {PALETTE.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent",boxShadow:color===c?`0 0 0 2px ${c}`:"none",transition:"all 0.1s"}}/>)}
                </div>
              </div>
            </div>

            {/* Balance preview */}
            {iniBalance&&(
              <div style={{background:`${color}12`,border:`1px solid ${color}30`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
                <div style={{fontSize:11,color:t.textMuted,marginBottom:4}}>Balance actual calculado</div>
                <div style={{fontSize:20,fontWeight:700,color:parsed.totalPnL>=0?t.positive:t.negative}}>{fmtUSD((parseFloat(iniBalance)||0)+parsed.totalPnL)}</div>
                <div style={{fontSize:11,color:t.textMuted,marginTop:2}}>{fmtUSD(parseFloat(iniBalance)||0)} inicial + {fmtUSD(parsed.totalPnL)} P&L neto</div>
              </div>
            )}

            {error&&<div style={{background:t.negLight,border:`1px solid ${t.negative}30`,borderRadius:9,padding:"10px 14px",fontSize:12,color:t.negative,marginBottom:12}}>{error}</div>}

            <div style={{display:"flex",gap:9}}>
              <button onClick={()=>setStep(1)} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:t.textSub,fontSize:13,fontWeight:600,cursor:"pointer"}}>← Volver</button>
              <button onClick={handleImport} disabled={loading||!accName||!iniBalance}
                style={{flex:2,padding:"11px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,cursor:loading?"wait":"pointer",opacity:loading||!accName||!iniBalance?0.6:1}}>
                {loading?`Importando ${parsed.totalTrades} trades...`:`📥 Importar ${parsed.totalTrades} trades`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Spark({ data, color, w=60, h=22 }) {
  if(!data||data.length<2) return null;
  const mn=Math.min(...data),mx=Math.max(...data),r=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/r)*h}`).join(" ");
  return <svg width={w} height={h} style={{overflow:"visible",flexShrink:0,display:"block"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function StatusBadge({status}) {
  const map={Live:{bg:"#052e1690",c:"#4ade80",b:"#22c55e28"},"Evaluación":{bg:"#1c140090",c:"#fbbf24",b:"#f59e0b28"},Inactiva:{bg:"#1e1b3490",c:"#a78bfa",b:"#8b5cf628"},Suspendida:{bg:"#1a001090",c:"#fb7185",b:"#f43f5e28"}};
  const s=map[status]||map.Inactiva;
  return <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,background:s.bg,color:s.c,border:`1px solid ${s.b}`,letterSpacing:"0.06em",textTransform:"uppercase"}}>{status}</span>;
}
function StatBox({label,value,sub,color,icon,t}) {
  return (
    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:14,padding:"18px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</span>
        <span style={{fontSize:15,opacity:0.6}}>{icon}</span>
      </div>
      <div style={{fontSize:22,fontWeight:700,color:color||t.text,letterSpacing:"-0.02em"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:t.textMuted,marginTop:4}}>{sub}</div>}
    </div>
  );
}
function AccountRow({ acc, expanded, onToggle, onDelete, t }) {
  const pnl=acc.current_balance-acc.initial_balance, pct=acc.initial_balance>0?(pnl/acc.initial_balance)*100:0, pos=pnl>=0;
  return (
    <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${expanded?acc.color+"60":t.border}`,transition:"border-color 0.2s",marginBottom:6}}>
      <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",background:expanded?t.surfaceAlt:t.surface,cursor:"pointer",transition:"background 0.15s"}}
        onMouseEnter={e=>{if(!expanded)e.currentTarget.style.background=t.surfaceHover;}}
        onMouseLeave={e=>{if(!expanded)e.currentTarget.style.background=t.surface;}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:acc.color,flexShrink:0,boxShadow:`0 0 6px ${acc.color}80`}}/>
        <div style={{flex:1,minWidth:0}}>
          <span style={{fontSize:13,fontWeight:600,color:t.text}}>{acc.name}</span>
          <span style={{fontSize:11,color:t.textMuted,marginLeft:10}}>{acc.provider} · {acc.type}</span>
        </div>
        <StatusBadge status={acc.status}/>
        <div style={{textAlign:"right",minWidth:100}}><div style={{fontSize:13,fontWeight:700,color:t.text}}>{fmtUSD(acc.current_balance)}</div></div>
        <div style={{minWidth:80,textAlign:"right"}}><span style={{fontSize:12,fontWeight:700,color:pos?t.positive:t.negative}}>{fmtPct(pct)}</span></div>
        <span style={{color:t.textMuted,fontSize:12,marginLeft:4,transition:"transform 0.2s",display:"inline-block",transform:expanded?"rotate(90deg)":"rotate(0deg)"}}>›</span>
      </div>
      {expanded&&(
        <div style={{background:t.surfaceAlt,borderTop:`1px solid ${t.border}`,padding:"14px 16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:14}}>
            {[
              {l:"Balance inicial",v:fmtUSD(acc.initial_balance),c:t.textSub},
              {l:"Balance actual",v:fmtUSD(acc.current_balance),c:t.text},
              {l:"P&L",v:`${fmtUSD(pnl)} (${fmtPct(pct)})`,c:pos?t.positive:t.negative},
              {l:"Inversión",v:fmtUSD(acc.cost),c:t.negative},
              {l:"Retirado",v:fmtUSD(acc.withdrawn),c:t.positive},
              {l:"Bficio neto",v:fmtUSD(acc.withdrawn-acc.cost),c:(acc.withdrawn-acc.cost)>=0?t.positive:t.negative},
              {l:"Inicio",v:acc.start_date||"-",c:t.textSub},
              {l:"Fuente",v:"📥 CSV importado",c:t.textSub},
            ].map(s=>(<div key={s.l} style={{background:t.surface,borderRadius:8,padding:"8px 12px",border:`1px solid ${t.border}`}}><div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{s.l}</div><div style={{fontSize:12,fontWeight:700,color:s.c}}>{s.v}</div></div>))}
          </div>
          <button onClick={e=>{e.stopPropagation();onDelete(acc.id);}} style={{padding:"7px 14px",borderRadius:8,border:"none",background:t.negLight,color:t.negative,fontSize:12,cursor:"pointer"}}>🗑 Eliminar</button>
        </div>
      )}
    </div>
  );
}

function PerformanceCalendar({ userId, accounts, t }) {
  const [year,setYear]=useState(new Date().getFullYear());
  const [month,setMonth]=useState(new Date().getMonth());
  const [dailyData,setDailyData]=useState({});
  const [editDay,setEditDay]=useState(null);
  const [editVal,setEditVal]=useState("");
  const [filterAcc,setFilterAcc]=useState("all");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    const fetch_ = async () => {
      setLoading(true);
      const start=`${year}-${String(month+1).padStart(2,"0")}-01`;
      const end=`${year}-${String(month+1).padStart(2,"0")}-${getDaysInMonth(year,month)}`;
      let q=supabase.from("daily_pnl").select("*").eq("user_id",userId).gte("date",start).lte("date",end);
      if(filterAcc!=="all") q=q.eq("account_id",filterAcc);
      const {data}=await q;
      const map={};
      (data||[]).forEach(r=>{ map[r.date]=(map[r.date]||0)+r.pnl; });
      setDailyData(map);
      setLoading(false);
    };
    fetch_();
  },[year,month,filterAcc,userId]);

  const days=getDaysInMonth(year,month), firstDay=getFirstDayOfMonth(year,month);
  const mk=(d)=>`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const values=Array.from({length:days},(_,i)=>dailyData[mk(i+1)]??null);
  const maxAbs=Math.max(...values.filter(v=>v!==null).map(Math.abs),1);
  const monthTotal=values.filter(v=>v!==null).reduce((a,b)=>a+b,0);
  const winD=values.filter(v=>v!==null&&v>0).length, lossD=values.filter(v=>v!==null&&v<0).length;
  const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAY_NAMES=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const cellBg=(val)=>{if(val===null)return t.surfaceAlt;const i=Math.min(Math.abs(val)/maxAbs,1);return val>0?`rgba(34,208,122,${0.1+i*0.65})`:`rgba(240,71,106,${0.1+i*0.65})`;};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Calendario</h1><p style={{fontSize:12,color:t.textMuted,marginTop:3}}>P&L diario real · datos de tus cuentas importadas</p></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1)}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,color:t.text,cursor:"pointer",fontSize:14}}>‹</button>
          <span style={{fontSize:13,fontWeight:700,color:t.text,minWidth:130,textAlign:"center"}}>{MONTHS[month]} {year}</span>
          <button onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1)}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,color:t.text,cursor:"pointer",fontSize:14}}>›</button>
        </div>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:t.textMuted,fontWeight:600}}>Ver:</span>
        <button onClick={()=>setFilterAcc("all")} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filterAcc==="all"?"#0ea5e9":t.border}`,background:filterAcc==="all"?"rgba(14,165,233,0.1)":"transparent",color:filterAcc==="all"?"#0ea5e9":t.textMuted}}>Todas</button>
        {accounts.map(a=>(<button key={a.id} onClick={()=>setFilterAcc(a.id)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filterAcc===a.id?a.color:t.border}`,background:filterAcc===a.id?a.color+"18":"transparent",color:filterAcc===a.id?a.color:t.textMuted,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:a.color,display:"inline-block"}}/>{a.name}</button>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        {[{l:"Total del mes",v:fmtUSD(monthTotal),c:monthTotal>=0?t.positive:t.negative},{l:"Días positivos",v:winD,c:t.positive},{l:"Días negativos",v:lossD,c:t.negative},{l:"Win rate",v:fmtPct((winD/(winD+lossD||1))*100),c:t.positive}].map(s=>(
          <div key={s.l} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px"}}><div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:4}}>{s.l}</div><div style={{fontSize:20,fontWeight:700,color:s.c,letterSpacing:"-0.02em"}}>{s.v}</div></div>
        ))}
      </div>
      <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:16,padding:20}}>
        {loading&&<div style={{textAlign:"center",padding:12,color:t.textMuted,fontSize:12}}>Cargando...</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:8}}>
          {DAY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:t.textMuted,padding:"3px 0",textTransform:"uppercase",letterSpacing:"0.07em"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:days}).map((_,i)=>{
            const d=i+1,key=mk(d),val=dailyData[key]??null;
            return(<div key={d} onClick={()=>{setEditDay(key);setEditVal(String(val??""));}}
              style={{borderRadius:9,padding:"8px 6px",background:cellBg(val),border:`1px solid ${val!==null?(val>0?"rgba(34,208,122,0.25)":"rgba(240,71,106,0.25)"):t.border}`,cursor:"pointer",minHeight:56,transition:"opacity 0.12s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.72"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <div style={{fontSize:10,fontWeight:600,color:t.textMuted,marginBottom:3}}>{d}</div>
              {val!==null?<div style={{fontSize:11,fontWeight:700,color:val>=0?t.positive:t.negative,letterSpacing:"-0.01em"}}>{val>=0?"+":""}{fmt(val,0)}</div>:<div style={{fontSize:16,color:t.textMuted,opacity:0.18,textAlign:"center",marginTop:2}}>·</div>}
            </div>);
          })}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:12,justifyContent:"flex-end"}}>
          <span style={{fontSize:10,color:t.textMuted}}>Pérdida</span>
          {[0.12,0.32,0.55,0.75].map(o=><div key={o} style={{width:14,height:14,borderRadius:3,background:`rgba(240,71,106,${o})`}}/>)}
          <div style={{width:14,height:14,borderRadius:3,background:t.surfaceAlt,border:`1px solid ${t.border}`}}/>
          {[0.12,0.32,0.55,0.75].map(o=><div key={o} style={{width:14,height:14,borderRadius:3,background:`rgba(34,208,122,${o})`}}/>)}
          <span style={{fontSize:10,color:t.textMuted}}>Ganancia</span>
        </div>
      </div>
      {editDay&&(<div onClick={()=>setEditDay(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(4px)"}}><div onClick={e=>e.stopPropagation()} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:16,padding:28,width:300}}><div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:3}}>Editar P&L</div><div style={{fontSize:11,color:t.textMuted,marginBottom:14}}>{editDay}</div><input value={editVal} onChange={e=>setEditVal(e.target.value)} type="number" style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 14px",color:t.text,fontSize:16,fontWeight:600,outline:"none",marginBottom:14,fontFamily:"inherit"}}/><div style={{display:"flex",gap:9}}><button onClick={()=>setEditDay(null)} style={{flex:1,padding:"9px",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:t.textSub,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button><button onClick={async()=>{const v=parseFloat(editVal)||0;setDailyData(p=>({...p,[editDay]:v}));if(filterAcc!=="all")await supabase.from("daily_pnl").upsert({user_id:userId,account_id:filterAcc,date:editDay,pnl:v},{onConflict:"account_id,date"});setEditDay(null);}} style={{flex:2,padding:"9px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Guardar</button></div></div></div>)}
    </div>
  );
}

function LandingPage({ onGoToLogin }) {
  const features=[{icon:"📊",title:"Dashboard Consolidado",desc:"Fondeo, capital propio y futuros en una sola vista."},{icon:"📥",title:"Importa tu historial MT5",desc:"Sube el reporte HTML y tu P&L diario aparece automáticamente."},{icon:"📅",title:"Calendario de P&L",desc:"Heatmap diario. Identifica tus mejores y peores días."},{icon:"🗂️",title:"Grupos y Familias",desc:"Organiza tus cuentas como quieras."},{icon:"📈",title:"ROI Real",desc:"Beneficio neto real: retirado menos invertido."},{icon:"🔒",title:"Multi-perfil",desc:"Cada usuario tiene su propio espacio privado."}];
  return (
    <div style={{minHeight:"100vh",background:"#080c14",color:"#e6eaf4",fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}.fade-up{animation:fadeUp 0.7s ease forwards}.hero-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(14,165,233,0.4)}.feature-card:hover{transform:translateY(-4px);border-color:#0ea5e940}`}</style>
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"16px 48px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(8,12,20,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid #141923"}}>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:"-0.03em"}}><span style={{color:"#0ea5e9"}}>Mayahouse</span><span style={{color:"#e6eaf4"}}>FX</span></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onGoToLogin} style={{padding:"8px 20px",borderRadius:8,border:"1px solid #232e42",background:"transparent",color:"#7d8fa8",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Iniciar sesión</button>
          <button className="hero-btn" onClick={onGoToLogin} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit"}}>Comenzar</button>
        </div>
      </nav>
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"120px 24px 80px",textAlign:"center",position:"relative"}}>
        <div style={{position:"absolute",top:"30%",left:"50%",transform:"translate(-50%,-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(14,165,233,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div className="fade-up" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",borderRadius:20,border:"1px solid #0ea5e930",background:"rgba(14,165,233,0.06)",marginBottom:28}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#22d07a",display:"inline-block",animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:12,color:"#0ea5e9",fontWeight:600}}>Tu plataforma de trading, a tu manera</span>
        </div>
        <h1 className="fade-up" style={{fontSize:"clamp(38px,6vw,72px)",fontWeight:900,lineHeight:1.08,letterSpacing:"-0.04em",marginBottom:24,maxWidth:820,animationDelay:"0.2s"}}>
          Controla cada cuenta.{" "}
          <span style={{fontFamily:"'Instrument Serif',serif",fontStyle:"italic",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Mide tu verdadero ROI.</span>
        </h1>
        <p className="fade-up" style={{fontSize:"clamp(15px,2vw,19px)",color:"#7d8fa8",maxWidth:560,lineHeight:1.65,marginBottom:40,animationDelay:"0.3s"}}>Importa tu historial de MT5 y visualiza todo tu rendimiento real en segundos.</p>
        <div className="fade-up" style={{display:"flex",gap:12,justifyContent:"center",animationDelay:"0.4s"}}>
          <button className="hero-btn" onClick={onGoToLogin} style={{padding:"14px 32px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit"}}>Entrar al dashboard →</button>
        </div>
      </section>
      <section style={{padding:"80px 48px",maxWidth:1100,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:56}}><h2 style={{fontSize:"clamp(28px,4vw,44px)",fontWeight:800,letterSpacing:"-0.03em",color:"#e6eaf4"}}>Todo lo que un trader necesita</h2></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>
          {features.map((f,i)=>(<div key={i} className="feature-card" style={{background:"#141923",border:"1px solid #232e42",borderRadius:16,padding:"26px 28px",transition:"all 0.25s"}}><div style={{fontSize:28,marginBottom:14}}>{f.icon}</div><div style={{fontSize:16,fontWeight:700,color:"#e6eaf4",marginBottom:8}}>{f.title}</div><div style={{fontSize:13,color:"#7d8fa8",lineHeight:1.6}}>{f.desc}</div></div>))}
        </div>
      </section>
      <footer style={{borderTop:"1px solid #141923",padding:"28px 48px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{fontSize:14,fontWeight:800}}><span style={{color:"#0ea5e9"}}>Mayahouse</span><span style={{color:"#3d4f66"}}>FX</span></div>
        <div style={{fontSize:11,color:"#3d4f66"}}>© 2026 MayahouseFX · Todos los derechos reservados</div>
      </footer>
    </div>
  );
}

function LoginPage({ onLogin, onBack }) {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState(""), [password,setPassword]=useState(""), [name,setName]=useState("");
  const [error,setError]=useState(""), [loading,setLoading]=useState(false), [showPass,setShowPass]=useState(false);
  const handleLogin = async () => {
    setError(""); if(!email||!password){setError("Completa todos los campos.");return;} setLoading(true);
    const {data,error:e}=await supabase.auth.signInWithPassword({email,password});
    if(e){setError("Correo o contraseña incorrectos.");setLoading(false);return;}
    const {data:prof}=await supabase.from("profiles").select("*").eq("id",data.user.id).single();
    onLogin({...data.user,name:prof?.name||email,avatar:prof?.avatar||email.slice(0,2).toUpperCase()});
  };
  const handleRegister = async () => {
    setError(""); if(!name||!email||!password){setError("Completa todos los campos.");return;}
    if(password.length<8){setError("La contraseña debe tener al menos 8 caracteres.");return;} setLoading(true);
    const {data,error:e}=await supabase.auth.signUp({email,password,options:{data:{name,avatar:name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}}});
    if(e){setError(e.message);setLoading(false);return;}
    onLogin({...data.user,name,avatar:name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)});
  };
  return (
    <div style={{minHeight:"100vh",background:"#080c14",display:"flex",fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.login-input:focus{border-color:#0ea5e9!important;outline:none}`}</style>
      <div style={{flex:1,background:"linear-gradient(135deg,#0c1018,#0d1526)",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"40px 48px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-100,right:-100,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(14,165,233,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:18,fontWeight:800}}><span style={{color:"#0ea5e9"}}>Mayahouse</span><span style={{color:"#e6eaf4"}}>FX</span></div>
          <button onClick={onBack} style={{fontSize:12,color:"#3d4f66",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>← Volver</button>
        </div>
        <div style={{animation:"fadeUp 0.7s ease forwards"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#0ea5e9",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:16}}>Performance Tracker</div>
          <h2 style={{fontSize:"clamp(28px,3vw,42px)",fontWeight:900,letterSpacing:"-0.04em",lineHeight:1.1,color:"#e6eaf4",marginBottom:20}}>Tu portafolio.<br/><span style={{fontFamily:"'Instrument Serif',serif",fontStyle:"italic",color:"#0ea5e9"}}>Todo claro.</span></h2>
          <p style={{fontSize:14,color:"#7d8fa8",lineHeight:1.65,maxWidth:380}}>Importa tu historial MT5 y ve tu P&L real día a día.</p>
          <div style={{marginTop:36,display:"flex",flexDirection:"column",gap:12}}>
            {["Importa reporte HTML desde MT5 en 1 clic","Calendario de P&L diario con heatmap","Dashboard consolidado de todas tus cuentas","ROI y beneficio neto en tiempo real"].map(f=>(
              <div key={f} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"rgba(34,208,122,0.15)",border:"1px solid #22d07a40",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:10,color:"#22d07a"}}>✓</span></div>
                <span style={{fontSize:13,color:"#7d8fa8"}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:"#141923",border:"1px solid #232e42",borderRadius:14,padding:"18px 20px"}}>
          <div style={{fontSize:13,color:"#7d8fa8",lineHeight:1.6,marginBottom:12,fontStyle:"italic"}}>"Finalmente puedo ver en un solo lugar cuánto llevo invertido y cuál es mi ROI real."</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff"}}>GM</div>
            <div><div style={{fontSize:12,fontWeight:700,color:"#e6eaf4"}}>Gabriel Maya</div><div style={{fontSize:11,color:"#3d4f66"}}>Trader · AXI + FTMO</div></div>
          </div>
        </div>
      </div>
      <div style={{width:"min(480px,100%)",background:"#0c1018",display:"flex",flexDirection:"column",justifyContent:"center",padding:"48px 40px",borderLeft:"1px solid #141923"}}>
        <div style={{animation:"fadeUp 0.6s ease forwards"}}>
          <div style={{display:"flex",background:"#141923",borderRadius:12,padding:4,marginBottom:32,border:"1px solid #232e42"}}>
            {[{id:"login",label:"Iniciar sesión"},{id:"register",label:"Crear cuenta"}].map(tab=>(
              <button key={tab.id} onClick={()=>{setMode(tab.id);setError("");}} style={{flex:1,padding:"9px 0",borderRadius:9,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mode===tab.id?"#1a2233":"transparent",color:mode===tab.id?"#e6eaf4":"#3d4f66",transition:"all 0.2s"}}>{tab.label}</button>
            ))}
          </div>
          <h3 style={{fontSize:22,fontWeight:800,color:"#e6eaf4",marginBottom:6,letterSpacing:"-0.02em"}}>{mode==="login"?"Bienvenido de vuelta":"Crea tu cuenta"}</h3>
          <p style={{fontSize:13,color:"#3d4f66",marginBottom:28}}>{mode==="login"?"Ingresa tus datos para acceder":"Completa el formulario para comenzar"}</p>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {mode==="register"&&(<div><label style={{fontSize:11,color:"#7d8fa8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Nombre completo</label><input className="login-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Gabriel Maya" style={{width:"100%",background:"#141923",border:"1px solid #232e42",borderRadius:10,padding:"12px 16px",color:"#e6eaf4",fontSize:14,fontFamily:"inherit"}}/></div>)}
            <div><label style={{fontSize:11,color:"#7d8fa8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Correo electrónico</label><input className="login-input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="tu@correo.com" style={{width:"100%",background:"#141923",border:"1px solid #232e42",borderRadius:10,padding:"12px 16px",color:"#e6eaf4",fontSize:14,fontFamily:"inherit"}}/></div>
            <div><label style={{fontSize:11,color:"#7d8fa8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Contraseña</label>
              <div style={{position:"relative"}}>
                <input className="login-input" value={password} onChange={e=>setPassword(e.target.value)} type={showPass?"text":"password"} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())} style={{width:"100%",background:"#141923",border:"1px solid #232e42",borderRadius:10,padding:"12px 44px 12px 16px",color:"#e6eaf4",fontSize:14,fontFamily:"inherit"}}/>
                <button onClick={()=>setShowPass(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#3d4f66",cursor:"pointer",fontSize:16}}>{showPass?"🙈":"👁"}</button>
              </div>
            </div>
            {error&&<div style={{background:"rgba(240,71,106,0.1)",border:"1px solid rgba(240,71,106,0.3)",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#f0476a"}}>{error}</div>}
            <button onClick={mode==="login"?handleLogin:handleRegister} disabled={loading} style={{padding:"13px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"wait":"pointer",fontFamily:"inherit",marginTop:4,opacity:loading?0.7:1}}>
              {loading?"Cargando...":(mode==="login"?"Entrar →":"Crear cuenta →")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [dark,setDark]=useState(true);
  const t=dark?T.dark:T.light;
  const [accounts,setAccounts]=useState([]);
  const [view,setView]=useState("dashboard");
  const [expandedId,setExpandedId]=useState(null);
  const [importModal,setImportModal]=useState(false);
  const [loadingData,setLoadingData]=useState(true);

  const fetchData = async () => {
    setLoadingData(true);
    const {data}=await supabase.from("mt_accounts").select("*").eq("user_id",user.id).order("created_at");
    setAccounts(data||[]);
    setLoadingData(false);
  };
  useEffect(()=>{ fetchData(); },[user.id]);

  const deleteAccount = async (id) => {
    if(!window.confirm("¿Eliminar esta cuenta y todo su historial?")) return;
    await supabase.from("daily_pnl").delete().eq("account_id",id);
    await supabase.from("balance_history").delete().eq("account_id",id);
    await supabase.from("mt_accounts").delete().eq("id",id);
    setAccounts(p=>p.filter(a=>a.id!==id));
  };

  const SS=useMemo(()=>{
    const ti=accounts.reduce((s,a)=>s+a.cost,0), tw=accounts.reduce((s,a)=>s+a.withdrawn,0);
    const tc=accounts.reduce((s,a)=>s+a.current_balance,0), tini=accounts.reduce((s,a)=>s+a.initial_balance,0);
    const pnl=tc-tini, nb=tw-ti, roi=ti>0?(nb/ti)*100:0;
    return{live:accounts.filter(a=>a.status==="Live").length,ti,tw,tc,pnl,nb,roi};
  },[accounts]);

  const navs=[{id:"dashboard",icon:"▦",label:"Dashboard"},{id:"accounts",icon:"◈",label:"Cuentas"},{id:"calendar",icon:"⊞",label:"Calendario"},{id:"monthly",icon:"≡",label:"Mensual"}];

  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.text,fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",display:"flex"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#232e42;border-radius:3px}button{font-family:inherit}select option{background:#141923}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{width:212,background:t.sidebar,borderRight:`1px solid ${t.border}`,display:"flex",flexDirection:"column",padding:"22px 0",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{padding:"0 20px 20px"}}>
          <div style={{fontSize:15,fontWeight:800,letterSpacing:"-0.03em",marginBottom:10}}><span style={{color:"#0ea5e9"}}>Mayahouse</span><span style={{color:"#e6eaf4"}}>FX</span></div>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#ffffff08",borderRadius:10,padding:"8px 10px",border:`1px solid ${t.border}`}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{user.avatar}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:10,color:t.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div></div>
          </div>
        </div>
        {navs.map(n=>(<button key={n.id} onClick={()=>setView(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",border:"none",cursor:"pointer",background:view===n.id?"rgba(14,165,233,0.09)":"transparent",color:view===n.id?"#0ea5e9":"#5a6d85",fontSize:13,fontWeight:view===n.id?700:500,borderLeft:view===n.id?"2px solid #0ea5e9":"2px solid transparent",transition:"all 0.13s",textAlign:"left",width:"100%"}}><span style={{fontSize:13}}>{n.icon}</span>{n.label}</button>))}
        <div style={{flex:1}}/>
        <div style={{padding:"0 12px",marginBottom:9}}><button onClick={()=>setDark(d=>!d)} style={{width:"100%",padding:"8px 0",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:"#5a6d85",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{dark?"☀️ Modo Claro":"🌙 Modo Oscuro"}</button></div>
        <div style={{padding:"0 12px",marginBottom:9}}><button onClick={()=>setImportModal(true)} style={{width:"100%",padding:"10px 0",borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>📥 Importar MT5</button></div>
        <div style={{padding:"0 12px"}}><button onClick={onLogout} style={{width:"100%",padding:"8px 0",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:"#5a6d85",fontSize:11,fontWeight:600,cursor:"pointer"}}>← Cerrar sesión</button></div>
      </div>

      <div style={{marginLeft:212,flex:1,padding:"32px 36px",maxWidth:"calc(100vw - 212px)"}}>
        {loadingData?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",flexDirection:"column",gap:16}}>
            <div style={{fontSize:32,animation:"spin 1s linear infinite"}}>⟳</div>
            <div style={{color:t.textMuted,fontSize:14}}>Cargando...</div>
          </div>
        ):(
          <>
          {view==="dashboard"&&(<>
            <div style={{marginBottom:24}}><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Dashboard</h1><p style={{color:t.textMuted,fontSize:12,marginTop:3}}>Bienvenido, {user.name?.split(" ")[0]} · {accounts.length} cuentas</p></div>
            {accounts.length===0?(
              <div style={{textAlign:"center",padding:"80px 20px",background:t.surface,border:`2px dashed ${t.border}`,borderRadius:16}}>
                <div style={{fontSize:48,marginBottom:16}}>📥</div>
                <h3 style={{fontSize:18,fontWeight:700,color:t.text,marginBottom:8}}>Importa tu primer reporte MT5</h3>
                <p style={{fontSize:13,color:t.textMuted,marginBottom:24,maxWidth:400,margin:"0 auto 24px"}}>Exporta el historial detallado desde MetaTrader 5 y súbelo aquí.</p>
                <button onClick={()=>setImportModal(true)} style={{padding:"12px 28px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>📥 Importar ahora</button>
              </div>
            ):(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:11,marginBottom:20}}>
                  <StatBox t={t} icon="🟢" label="Cuentas" value={accounts.length} sub={`${SS.live} activas`} color={t.positive}/>
                  <StatBox t={t} icon="💸" label="Invertido" value={fmtUSD(SS.ti)} color={t.negative}/>
                  <StatBox t={t} icon="💰" label="Retirado" value={fmtUSD(SS.tw)} color={t.positive}/>
                  <StatBox t={t} icon="📈" label="P&L Total" value={fmtUSD(SS.pnl)} color={SS.pnl>=0?t.positive:t.negative}/>
                  <StatBox t={t} icon="⚡" label="Beneficio Neto" value={fmtUSD(SS.nb)} color={SS.nb>=0?t.positive:t.negative}/>
                  <StatBox t={t} icon="🚀" label="ROI" value={fmtPct(SS.roi)} color={SS.roi>=0?t.positive:t.negative}/>
                </div>
                <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Capital por cuenta</div>
                  <div style={{display:"flex",flexDirection:"column",gap:9}}>
                    {accounts.slice().sort((a,b)=>b.current_balance-a.current_balance).map(a=>{
                      const pp=a.initial_balance>0?((a.current_balance-a.initial_balance)/a.initial_balance)*100:0, pct2=SS.tc>0?(a.current_balance/SS.tc)*100:0;
                      return(<div key={a.id} style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:a.color,flexShrink:0}}/>
                        <div style={{width:140,fontSize:11,color:t.textSub,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                        <div style={{flex:1,height:6,background:t.surfaceAlt,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct2}%`,height:"100%",background:a.color,borderRadius:4,opacity:0.75}}/></div>
                        <div style={{width:90,textAlign:"right",fontSize:12,color:t.text,fontWeight:600}}>{fmtUSD(a.current_balance)}</div>
                        <div style={{width:58,textAlign:"right",fontSize:11,fontWeight:700,color:pp>=0?t.positive:t.negative}}>{fmtPct(pp)}</div>
                      </div>);
                    })}
                  </div>
                </div>
              </>
            )}
          </>)}
          {view==="accounts"&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <div><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Mis Cuentas</h1><p style={{color:t.textMuted,fontSize:12,marginTop:3}}>{accounts.length} cuentas</p></div>
              <button onClick={()=>setImportModal(true)} style={{padding:"9px 18px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>📥 Importar MT5</button>
            </div>
            {accounts.length===0?(<div style={{textAlign:"center",padding:"60px 20px",background:t.surface,border:`2px dashed ${t.border}`,borderRadius:16}}><div style={{fontSize:40,marginBottom:12}}>📭</div><p style={{color:t.textMuted,fontSize:13}}>No tienes cuentas importadas aún</p></div>):(accounts.map(a=><AccountRow key={a.id} acc={a} expanded={expandedId===a.id} onToggle={()=>setExpandedId(expandedId===a.id?null:a.id)} onDelete={deleteAccount} t={t}/>))}
          </>)}
          {view==="calendar"&&<PerformanceCalendar userId={user.id} accounts={accounts} t={t}/>}
          {view==="monthly"&&(<>
            <div style={{marginBottom:22}}><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Resumen Mensual</h1></div>
            {accounts.map(a=>{
              const pnl=a.current_balance-a.initial_balance, pct=a.initial_balance>0?(pnl/a.initial_balance)*100:0, nb=a.withdrawn-a.cost;
              return(<div key={a.id} style={{border:`1px solid ${t.border}`,borderLeft:`3px solid ${a.color}`,borderRadius:10,padding:"14px 18px",marginBottom:8,background:t.surface,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:t.text}}>{a.name}</div><div style={{fontSize:11,color:t.textMuted}}>{a.provider} · {a.type}</div></div>
                {[{l:"Balance",v:fmtUSD(a.current_balance),c:t.text},{l:"P&L",v:`${fmtUSD(pnl)} (${fmtPct(pct)})`,c:pnl>=0?t.positive:t.negative},{l:"Inversión",v:fmtUSD(a.cost),c:t.negative},{l:"Retirado",v:fmtUSD(a.withdrawn),c:t.positive},{l:"Neto",v:fmtUSD(nb),c:nb>=0?t.positive:t.negative}].map(s=>(<div key={s.l} style={{textAlign:"right"}}><div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{s.l}</div><div style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</div></div>))}
              </div>);
            })}
            {accounts.length>0&&(<div style={{background:t.surface,border:`2px solid rgba(14,165,233,0.18)`,borderRadius:14,padding:"20px 24px",marginTop:12}}><div style={{fontSize:10,fontWeight:700,color:"#0ea5e9",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16}}>Totales</div><div style={{display:"flex",gap:24,flexWrap:"wrap"}}>{[{l:"Invertido",v:fmtUSD(SS.ti),c:t.negative},{l:"Retirado",v:fmtUSD(SS.tw),c:t.positive},{l:"Beneficio neto",v:fmtUSD(SS.nb),c:SS.nb>=0?t.positive:t.negative},{l:"P&L",v:fmtUSD(SS.pnl),c:SS.pnl>=0?t.positive:t.negative},{l:"ROI",v:fmtPct(SS.roi),c:SS.roi>=0?t.positive:t.negative}].map(s=>(<div key={s.l}><div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:5}}>{s.l}</div><div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div></div>))}</div></div>)}
          </>)}
          </>
        )}
      </div>
      <ImportModal open={importModal} onClose={()=>setImportModal(false)} onImported={fetchData} userId={user.id} t={t}/>
    </div>
  );
}

export default function MayahouseFX() {
  const [screen,setScreen]=useState("landing");
  const [user,setUser]=useState(null);
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        supabase.from("profiles").select("*").eq("id",session.user.id).single().then(({data:prof})=>{
          setUser({...session.user,name:prof?.name||session.user.email,avatar:prof?.avatar||session.user.email?.slice(0,2).toUpperCase()});
          setScreen("dashboard");
        });
      }
    });
  },[]);
  const handleLogin=(u)=>{ setUser(u); setScreen("dashboard"); };
  const handleLogout=async()=>{ await supabase.auth.signOut(); setUser(null); setScreen("landing"); };
  if(screen==="landing") return <LandingPage onGoToLogin={()=>setScreen("login")}/>;
  if(screen==="login")   return <LoginPage onLogin={handleLogin} onBack={()=>setScreen("landing")}/>;
  if(screen==="dashboard") return <Dashboard user={user} onLogout={handleLogout}/>;
  return null;
}
