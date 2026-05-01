import { useState, useEffect, useMemo } from "react";

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const fmtUSD = (n) => (n < 0 ? "-$" : "$") + fmt(Math.abs(n));
const fmtPct = (n) => (n >= 0 ? "+" : "") + fmt(n) + "%";
const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const getFirstDayOfMonth = (y, m) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };

// ─── Mock users (frontend-only auth) ─────────────────────────────────────────
const MOCK_USERS = [
  { id: 1, name: "Gabriel Maya", email: "gabriel@mayahousefx.com", password: "trading123", avatar: "GM" },
  { id: 2, name: "Demo User",    email: "demo@mayahousefx.com",    password: "demo1234",   avatar: "DU" },
];

// ─── Seed Data ────────────────────────────────────────────────────────────────
const SEED_ACCOUNTS = [
  { id:1, name:"FTMO 100K #1",        provider:"FTMO",        type:"Fondeo",         broker:"MT5",       currency:"USD", initialBalance:100000, currentBalance:104230, cost:540,  withdrawn:1800, status:"Live",       startDate:"2026-01-15", color:"#0ea5e9", groupId:1, history:[100000,100800,102100,101500,103200,104230] },
  { id:2, name:"FTMO Eval #2",         provider:"FTMO",        type:"Fondeo",         broker:"MT5",       currency:"USD", initialBalance:100000, currentBalance:97800,  cost:540,  withdrawn:0,    status:"Evaluación", startDate:"2026-03-20", color:"#f43f5e", groupId:1, history:[100000,99500,98200,98800,97800] },
  { id:3, name:"Cuenta Propia AXI",    provider:"AXI",         type:"Capital Propio", broker:"MT5",       currency:"USD", initialBalance:5000,   currentBalance:6821,   cost:0,    withdrawn:500,  status:"Live",       startDate:"2025-11-01", color:"#8b5cf6", groupId:2, history:[5000,5100,5420,5800,6200,6821] },
  { id:4, name:"Pepperstone Personal", provider:"Pepperstone", type:"Capital Propio", broker:"MT5",       currency:"USD", initialBalance:3000,   currentBalance:3180,   cost:0,    withdrawn:200,  status:"Live",       startDate:"2025-09-10", color:"#10b981", groupId:2, history:[3000,3050,3120,3090,3150,3180] },
  { id:5, name:"Tradovate #1",          provider:"TakeProfit",  type:"Futuros",        broker:"Tradovate", currency:"USD", initialBalance:50000,  currentBalance:51052,  cost:150,  withdrawn:0,    status:"Live",       startDate:"2026-02-04", color:"#f59e0b", groupId:3, history:[50000,50200,50800,50500,51100,51052] },
  { id:6, name:"Tradovate #2",          provider:"TakeProfit",  type:"Futuros",        broker:"Tradovate", currency:"USD", initialBalance:150000, currentBalance:151241, cost:350,  withdrawn:3000, status:"Live",       startDate:"2026-02-04", color:"#ec4899", groupId:3, history:[150000,150500,151800,150900,152000,151241] },
];
const SEED_GROUPS = [
  { id:1, name:"Cuentas Fondeo FTMO", color:"#0ea5e9" },
  { id:2, name:"Capital Propio",      color:"#8b5cf6" },
  { id:3, name:"Futuros TakeProfit",  color:"#f59e0b" },
];
const DAILY_SEED = {
  "2026-04-01":116.66,"2026-04-02":32.14,"2026-04-05":18.26,"2026-04-06":51.74,
  "2026-04-07":63.85,"2026-04-08":40.53,"2026-04-09":52.55,"2026-04-10":41.45,
  "2026-04-12":19.66,"2026-04-13":94.40,"2026-04-14":-1084.72,"2026-04-15":-117.23,
  "2026-04-16":316.76,"2026-04-17":41.10,"2026-04-20":336.73,"2026-04-21":-26.44,
  "2026-04-22":69.42,"2026-04-23":374.98,"2026-04-27":17.14,"2026-04-28":52.92,
  "2026-04-29":128.07,"2026-04-30":14.86,
};
const PALETTE = ["#0ea5e9","#8b5cf6","#f59e0b","#ec4899","#f43f5e","#10b981","#06b6d4","#f97316","#a78bfa","#34d399"];

// ─── Themes ───────────────────────────────────────────────────────────────────
const T = {
  dark:  { bg:"#0c1018", surface:"#141923", surfaceAlt:"#1a2233", surfaceHover:"#1e2840", border:"#232e42", text:"#e6eaf4", textSub:"#7d8fa8", textMuted:"#3d4f66", positive:"#22d07a", negative:"#f0476a", posLight:"rgba(34,208,122,0.08)", negLight:"rgba(240,71,106,0.08)", sidebar:"#0a0d14" },
  light: { bg:"#eef1f8", surface:"#ffffff",  surfaceAlt:"#f2f5fc", surfaceHover:"#e8edf8", border:"#d4dae8", text:"#0d1526", textSub:"#4a5568", textMuted:"#94a3b8", positive:"#16a34a", negative:"#dc2626", posLight:"rgba(22,163,74,0.08)",    negLight:"rgba(220,38,38,0.08)",    sidebar:"#161d2e" },
};

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═════════════════════════════════════════════════════════════════════════════
function LandingPage({ onGoToLogin }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const features = [
    { icon: "📊", title: "Dashboard Consolidado", desc: "Ve todas tus cuentas de trading en un solo lugar. Capital propio, fondeo y futuros unificados." },
    { icon: "🗂️", title: "Grupos y Familias", desc: "Organiza tus cuentas por estrategia, broker o firma. Crea tus propias categorías." },
    { icon: "📅", title: "Calendario de P&L", desc: "Visualiza tu rendimiento día a día con un heatmap intuitivo. Identifica tus mejores y peores días." },
    { icon: "📈", title: "Track Record Real", desc: "Historial de balances, retiros e inversiones. Calcula tu ROI real mes a mes." },
    { icon: "🌙", title: "Modo Claro y Oscuro", desc: "Diseño profesional adaptado a tu preferencia. Cómodo para largas sesiones de análisis." },
    { icon: "🔒", title: "Perfiles Privados", desc: "Cada usuario tiene su propio acceso seguro. Tus datos son solo tuyos." },
  ];

  const stats = [
    { value: "$312K+", label: "Capital gestionado" },
    { value: "6+",     label: "Tipos de cuenta" },
    { value: "100%",   label: "Control total" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#e6eaf4", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #232e42; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-10px); } }
        @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        @keyframes gradMove { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
        .fade-up { animation: fadeUp 0.7s ease forwards; }
        .float { animation: float 4s ease-in-out infinite; }
        .hero-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(14,165,233,0.4); }
        .feature-card:hover { transform: translateY(-4px); border-color: #0ea5e940; }
        .nav-btn:hover { color: #e6eaf4; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "16px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", background: scrolled ? "rgba(8,12,20,0.92)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? "1px solid #232e42" : "none", transition: "all 0.3s" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>
          <span style={{ color: "#0ea5e9" }}>Mayahouse</span><span style={{ color: "#e6eaf4" }}>FX</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="nav-btn" onClick={onGoToLogin} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #232e42", background: "transparent", color: "#7d8fa8", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "color 0.2s", fontFamily: "inherit" }}>
            Iniciar sesión
          </button>
          <button className="hero-btn" onClick={onGoToLogin} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#0ea5e9,#8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit" }}>
            Comenzar gratis
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", position: "relative", textAlign: "center" }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", left: "30%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Badge */}
        <div className="fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, border: "1px solid #0ea5e930", background: "rgba(14,165,233,0.06)", marginBottom: 28, animationDelay: "0.1s" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d07a", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 12, color: "#0ea5e9", fontWeight: 600, letterSpacing: "0.04em" }}>Tu plataforma de trading, a tu manera</span>
        </div>

        {/* Headline */}
        <h1 className="fade-up" style={{ fontSize: "clamp(38px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.04em", marginBottom: 24, maxWidth: 820, animationDelay: "0.2s" }}>
          Controla cada cuenta.{" "}
          <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Mide tu verdadero ROI.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="fade-up" style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "#7d8fa8", maxWidth: 560, lineHeight: 1.65, marginBottom: 40, animationDelay: "0.3s" }}>
          MayahouseFX es el tracker que los traders serios necesitan. Fondeo, capital propio y futuros — todo consolidado, todo claro.
        </p>

        {/* CTAs */}
        <div className="fade-up" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", animationDelay: "0.4s" }}>
          <button className="hero-btn" onClick={onGoToLogin} style={{ padding: "14px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#0ea5e9,#8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit" }}>
            Entrar al dashboard →
          </button>
          <button style={{ padding: "14px 28px", borderRadius: 12, border: "1px solid #232e42", background: "transparent", color: "#7d8fa8", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Ver demo
          </button>
        </div>

        {/* Stats row */}
        <div className="fade-up" style={{ display: "flex", gap: 40, marginTop: 64, animationDelay: "0.5s", flexWrap: "wrap", justifyContent: "center" }}>
          {stats.map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#e6eaf4", letterSpacing: "-0.03em" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#3d4f66", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Dashboard preview */}
        <div className="fade-up float" style={{ marginTop: 64, width: "min(860px, 90vw)", borderRadius: 20, overflow: "hidden", border: "1px solid #232e42", boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px #0ea5e915", animationDelay: "0.6s", position: "relative" }}>
          <div style={{ background: "#141923", padding: "12px 20px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #232e42" }}>
            {["#f43f5e","#f59e0b","#22d07a"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
            <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#3d4f66", fontWeight: 600 }}>mayahousefx.com/dashboard</div>
          </div>
          <div style={{ background: "#0c1018", padding: 24 }}>
            {/* Mini dashboard mockup */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {[{l:"Cuentas Live",v:"5",c:"#22d07a"},{l:"P&L Total",v:"+$6,324",c:"#22d07a"},{l:"ROI",v:"+248%",c:"#0ea5e9"}].map(s=>(
                <div key={s.l} style={{ background: "#141923", borderRadius: 10, padding: "12px 16px", border: "1px solid #232e42" }}>
                  <div style={{ fontSize: 9, color: "#3d4f66", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{s.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#141923", borderRadius: 10, padding: "14px 16px", border: "1px solid #232e42" }}>
              <div style={{ fontSize: 9, color: "#3d4f66", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Capital por cuenta</div>
              {[{n:"Tradovate #2",v:"$151,241",p:"+0.83%",c:"#ec4899",w:85},{n:"FTMO 100K #1",v:"$104,230",p:"+4.23%",c:"#0ea5e9",w:62},{n:"Tradovate #1",v:"$51,052",p:"+2.10%",c:"#f59e0b",w:32}].map(r=>(
                <div key={r.n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.c, flexShrink: 0 }} />
                  <div style={{ width: 110, fontSize: 11, color: "#7d8fa8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.n}</div>
                  <div style={{ flex: 1, height: 5, background: "#1a2233", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${r.w}%`, height: "100%", background: r.c, borderRadius: 3, opacity: 0.8 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#e6eaf4", fontWeight: 600, width: 72, textAlign: "right" }}>{r.v}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#22d07a", width: 48, textAlign: "right" }}>{r.p}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "80px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Funcionalidades</div>
          <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#e6eaf4", lineHeight: 1.15 }}>
            Todo lo que un trader necesita
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} className="feature-card" style={{ background: "#141923", border: "1px solid #232e42", borderRadius: 16, padding: "26px 28px", transition: "all 0.25s", cursor: "default" }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e6eaf4", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#7d8fa8", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 580, margin: "0 auto", background: "linear-gradient(135deg, #141923, #1a2233)", border: "1px solid #232e42", borderRadius: 24, padding: "56px 40px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
          <h2 style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 14, color: "#e6eaf4" }}>
            Empieza a trackear hoy
          </h2>
          <p style={{ fontSize: 14, color: "#7d8fa8", marginBottom: 32, lineHeight: 1.65 }}>
            Accede a tu dashboard, agrega tus cuentas y empieza a ver tu rendimiento real en minutos.
          </p>
          <button className="hero-btn" onClick={onGoToLogin} style={{ padding: "14px 36px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#0ea5e9,#8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit" }}>
            Crear mi cuenta →
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #141923", padding: "28px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.03em" }}>
          <span style={{ color: "#0ea5e9" }}>Mayahouse</span><span style={{ color: "#3d4f66" }}>FX</span>
        </div>
        <div style={{ fontSize: 11, color: "#3d4f66" }}>© 2026 MayahouseFX · Todos los derechos reservados</div>
      </footer>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin, onBack }) {
  const [mode,     setMode]     = useState("login"); // login | register
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = () => {
    setError("");
    if (!email || !password) { setError("Por favor completa todos los campos."); return; }
    setLoading(true);
    setTimeout(() => {
      const user = MOCK_USERS.find(u => u.email === email && u.password === password);
      if (user) { onLogin(user); }
      else { setError("Correo o contraseña incorrectos."); setLoading(false); }
    }, 800);
  };

  const handleRegister = () => {
    setError("");
    if (!name || !email || !password) { setError("Por favor completa todos los campos."); return; }
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    setLoading(true);
    setTimeout(() => {
      const newUser = { id: Date.now(), name, email, password, avatar: name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) };
      onLogin(newUser);
    }, 800);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
        .login-input:focus { border-color: #0ea5e9 !important; outline: none; }
        .login-input { transition: border-color 0.2s; }
      `}</style>

      {/* Left panel — branding */}
      <div style={{ flex: 1, background: "linear-gradient(135deg, #0c1018 0%, #0d1526 100%)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 48px", position: "relative", overflow: "hidden" }}>
        {/* Background decoration */}
        <div style={{ position:"absolute", top:-100, right:-100, width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-80, left:-80, width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents:"none" }}/>

        {/* Logo + back */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:"-0.03em" }}>
            <span style={{color:"#0ea5e9"}}>Mayahouse</span><span style={{color:"#e6eaf4"}}>FX</span>
          </div>
          <button onClick={onBack} style={{ fontSize:12, color:"#3d4f66", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>← Volver</button>
        </div>

        {/* Center content */}
        <div style={{ animation:"fadeUp 0.7s ease forwards" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0ea5e9", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:16 }}>Performance Tracker</div>
          <h2 style={{ fontSize:"clamp(28px,3vw,42px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.1, color:"#e6eaf4", marginBottom:20 }}>
            Tu portafolio.<br/>
            <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic", color:"#0ea5e9" }}>Todo claro.</span>
          </h2>
          <p style={{ fontSize:14, color:"#7d8fa8", lineHeight:1.65, maxWidth:380 }}>
            Fondeo, capital propio y futuros en una sola vista. Calcula tu ROI real, organiza tus cuentas y toma mejores decisiones.
          </p>

          {/* Feature list */}
          <div style={{ marginTop:36, display:"flex", flexDirection:"column", gap:12 }}>
            {["Dashboard consolidado de todas tus cuentas","Calendario de P&L diario con heatmap","Grupos y familias personalizables","ROI y beneficio neto en tiempo real"].map(f=>(
              <div key={f} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:"rgba(34,208,122,0.15)", border:"1px solid #22d07a40", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:10, color:"#22d07a" }}>✓</span>
                </div>
                <span style={{ fontSize:13, color:"#7d8fa8" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom testimonial */}
        <div style={{ background:"#141923", border:"1px solid #232e42", borderRadius:14, padding:"18px 20px" }}>
          <div style={{ fontSize:13, color:"#7d8fa8", lineHeight:1.6, marginBottom:12, fontStyle:"italic" }}>
            "Finalmente puedo ver en un solo lugar cuánto llevo invertido, cuánto he retirado y cuál es mi ROI real."
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff" }}>GM</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#e6eaf4" }}>Gabriel Maya</div>
              <div style={{ fontSize:11, color:"#3d4f66" }}>Trader · Fondeo + Capital Propio</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ width:"min(480px,100%)", background:"#0c1018", display:"flex", flexDirection:"column", justifyContent:"center", padding:"48px 40px", borderLeft:"1px solid #141923" }}>
        <div style={{ animation:"fadeUp 0.6s ease forwards" }}>
          {/* Tabs */}
          <div style={{ display:"flex", background:"#141923", borderRadius:12, padding:4, marginBottom:32, border:"1px solid #232e42" }}>
            {[{id:"login",label:"Iniciar sesión"},{id:"register",label:"Crear cuenta"}].map(tab=>(
              <button key={tab.id} onClick={()=>{setMode(tab.id);setError("");}} style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background:mode===tab.id?"#1a2233":"transparent", color:mode===tab.id?"#e6eaf4":"#3d4f66", transition:"all 0.2s" }}>
                {tab.label}
              </button>
            ))}
          </div>

          <h3 style={{ fontSize:22, fontWeight:800, color:"#e6eaf4", marginBottom:6, letterSpacing:"-0.02em" }}>
            {mode==="login"?"Bienvenido de vuelta":"Crea tu cuenta"}
          </h3>
          <p style={{ fontSize:13, color:"#3d4f66", marginBottom:28 }}>
            {mode==="login"?"Ingresa tus datos para acceder a tu dashboard":"Completa el formulario para comenzar"}
          </p>

          {/* Form */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {mode==="register"&&(
              <div>
                <label style={{ fontSize:11, color:"#7d8fa8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Nombre completo</label>
                <input className="login-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Gabriel Maya"
                  style={{ width:"100%", background:"#141923", border:"1px solid #232e42", borderRadius:10, padding:"12px 16px", color:"#e6eaf4", fontSize:14, fontFamily:"inherit" }}/>
              </div>
            )}
            <div>
              <label style={{ fontSize:11, color:"#7d8fa8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Correo electrónico</label>
              <input className="login-input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="tu@correo.com"
                style={{ width:"100%", background:"#141923", border:"1px solid #232e42", borderRadius:10, padding:"12px 16px", color:"#e6eaf4", fontSize:14, fontFamily:"inherit" }}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:"#7d8fa8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Contraseña</label>
              <div style={{ position:"relative" }}>
                <input className="login-input" value={password} onChange={e=>setPassword(e.target.value)} type={showPass?"text":"password"} placeholder="••••••••"
                  onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}
                  style={{ width:"100%", background:"#141923", border:"1px solid #232e42", borderRadius:10, padding:"12px 44px 12px 16px", color:"#e6eaf4", fontSize:14, fontFamily:"inherit" }}/>
                <button onClick={()=>setShowPass(s=>!s)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#3d4f66", cursor:"pointer", fontSize:16 }}>
                  {showPass?"🙈":"👁"}
                </button>
              </div>
            </div>

            {error&&(
              <div style={{ background:"rgba(240,71,106,0.1)", border:"1px solid rgba(240,71,106,0.3)", borderRadius:9, padding:"10px 14px", fontSize:12, color:"#f0476a" }}>
                {error}
              </div>
            )}

            {mode==="login"&&(
              <div style={{ textAlign:"right", marginTop:-6 }}>
                <button style={{ fontSize:12, color:"#3d4f66", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>¿Olvidaste tu contraseña?</button>
              </div>
            )}

            <button onClick={mode==="login"?handleLogin:handleRegister} disabled={loading}
              style={{ padding:"13px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)", color:"#fff", fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer", fontFamily:"inherit", marginTop:4, opacity:loading?0.7:1, transition:"opacity 0.2s" }}>
              {loading?"Cargando...":(mode==="login"?"Entrar al dashboard →":"Crear cuenta →")}
            </button>
          </div>

          {/* Demo hint */}
          {mode==="login"&&(
            <div style={{ marginTop:20, background:"#141923", border:"1px solid #232e42", borderRadius:10, padding:"12px 16px" }}>
              <div style={{ fontSize:11, color:"#3d4f66", marginBottom:6, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>Cuenta demo</div>
              <div style={{ fontSize:12, color:"#7d8fa8" }}>
                <span style={{fontFamily:"monospace"}}>demo@mayahousefx.com</span> · contraseña: <span style={{fontFamily:"monospace"}}>demo1234</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD (same as before, condensed)
// ═════════════════════════════════════════════════════════════════════════════
function Spark({ data, color, w=60, h=22 }) {
  if (!data || data.length < 2) return null;
  const mn=Math.min(...data), mx=Math.max(...data), r=mx-mn||1;
  const pts = data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/r)*h}`).join(" ");
  return <svg width={w} height={h} style={{overflow:"visible",flexShrink:0,display:"block"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function StatusBadge({ status }) {
  const map = { Live:{bg:"#052e1690",c:"#4ade80",b:"#22c55e28"}, "Evaluación":{bg:"#1c140090",c:"#fbbf24",b:"#f59e0b28"}, Inactiva:{bg:"#1e1b3490",c:"#a78bfa",b:"#8b5cf628"}, Suspendida:{bg:"#1a001090",c:"#fb7185",b:"#f43f5e28"} };
  const s = map[status]||map.Inactiva;
  return <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,background:s.bg,color:s.c,border:`1px solid ${s.b}`,letterSpacing:"0.06em",textTransform:"uppercase"}}>{status}</span>;
}
function StatBox({ label, value, sub, color, icon, t }) {
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
function AccountRow({ acc, group, expanded, onToggle, onEdit, onDelete, t }) {
  const pnl=acc.currentBalance-acc.initialBalance, pct=(pnl/acc.initialBalance)*100, nb=acc.withdrawn-acc.cost, pos=pnl>=0;
  return (
    <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${expanded?acc.color+"60":t.border}`,transition:"border-color 0.2s",marginBottom:6}}>
      <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",background:expanded?t.surfaceAlt:t.surface,cursor:"pointer",transition:"background 0.15s"}}
        onMouseEnter={e=>{if(!expanded)e.currentTarget.style.background=t.surfaceHover;}}
        onMouseLeave={e=>{if(!expanded)e.currentTarget.style.background=t.surface;}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:acc.color,flexShrink:0,boxShadow:`0 0 6px ${acc.color}80`}}/>
        <div style={{flex:1,minWidth:0}}>
          <span style={{fontSize:13,fontWeight:600,color:t.text}}>{acc.name}</span>
          <span style={{fontSize:11,color:t.textMuted,marginLeft:10}}>{acc.provider} · {acc.broker}</span>
        </div>
        <StatusBadge status={acc.status}/>
        <div style={{textAlign:"right",minWidth:100}}><div style={{fontSize:13,fontWeight:700,color:t.text}}>{fmtUSD(acc.currentBalance)}</div></div>
        <div style={{minWidth:80,textAlign:"right"}}><span style={{fontSize:12,fontWeight:700,color:pos?t.positive:t.negative}}>{fmtPct(pct)}</span></div>
        <Spark data={acc.history} color={acc.color}/>
        <span style={{color:t.textMuted,fontSize:12,marginLeft:4,transition:"transform 0.2s",display:"inline-block",transform:expanded?"rotate(90deg)":"rotate(0deg)"}}>›</span>
      </div>
      {expanded&&(
        <div style={{background:t.surfaceAlt,borderTop:`1px solid ${t.border}`,padding:"14px 16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:14}}>
            {[{l:"Balance inicial",v:fmtUSD(acc.initialBalance),c:t.textSub},{l:"P&L",v:`${fmtUSD(pnl)} (${fmtPct(pct)})`,c:pos?t.positive:t.negative},{l:"Inversión",v:fmtUSD(acc.cost),c:t.negative},{l:"Retirado",v:fmtUSD(acc.withdrawn),c:t.positive},{l:"Beneficio neto",v:fmtUSD(nb),c:nb>=0?t.positive:t.negative},{l:"Tipo",v:acc.type,c:t.textSub},{l:"Desde",v:acc.startDate,c:t.textSub}].map(s=>(
              <div key={s.l} style={{background:t.surface,borderRadius:8,padding:"8px 12px",border:`1px solid ${t.border}`}}>
                <div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{s.l}</div>
                <div style={{fontSize:12,fontWeight:700,color:s.c}}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={e=>{e.stopPropagation();onEdit(acc);}} style={{padding:"7px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,color:t.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✏️ Editar</button>
            <button onClick={e=>{e.stopPropagation();onDelete(acc.id);}} style={{padding:"7px 14px",borderRadius:8,border:"none",background:t.negLight,color:t.negative,fontSize:12,cursor:"pointer"}}>🗑 Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}
function GroupSection({ group, accounts, expandedId, onToggle, onEdit, onDelete, onEditGroup, onDeleteGroup, t }) {
  const [open,setOpen]=useState(true);
  const total=accounts.reduce((s,a)=>s+a.currentBalance,0), pnl=accounts.reduce((s,a)=>s+(a.currentBalance-a.initialBalance),0);
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,cursor:"pointer"}} onClick={()=>setOpen(o=>!o)}>
        <div style={{width:10,height:10,borderRadius:2,background:group.color,flexShrink:0}}/>
        <span style={{fontSize:12,fontWeight:700,color:t.textSub,textTransform:"uppercase",letterSpacing:"0.08em",flex:1}}>{group.name}</span>
        <span style={{fontSize:11,color:t.textMuted}}>{accounts.length} cuenta{accounts.length!==1?"s":""}</span>
        <span style={{fontSize:11,fontWeight:700,color:t.text,marginLeft:8}}>{fmtUSD(total)}</span>
        <span style={{fontSize:11,fontWeight:700,color:pnl>=0?t.positive:t.negative,marginLeft:6}}>{fmtUSD(pnl)}</span>
        <button onClick={e=>{e.stopPropagation();onEditGroup(group);}} style={{marginLeft:8,background:"none",border:"none",color:t.textMuted,cursor:"pointer",fontSize:12,padding:"2px 6px"}}>✏️</button>
        <button onClick={e=>{e.stopPropagation();onDeleteGroup(group.id);}} style={{background:"none",border:"none",color:t.negative,cursor:"pointer",fontSize:12,padding:"2px 6px",opacity:0.7}}>🗑</button>
        <span style={{color:t.textMuted,fontSize:12,marginLeft:4,transition:"transform 0.2s",display:"inline-block",transform:open?"rotate(90deg)":"rotate(0deg)"}}>›</span>
      </div>
      {open&&(<div style={{paddingLeft:18}}>{accounts.map(a=><AccountRow key={a.id} acc={a} group={group} expanded={expandedId===a.id} onToggle={()=>onToggle(a.id)} onEdit={onEdit} onDelete={onDelete} t={t}/>)}{accounts.length===0&&<div style={{fontSize:12,color:t.textMuted,padding:"10px 16px"}}>Sin cuentas</div>}</div>)}
    </div>
  );
}
function PerformanceCalendar({ accounts, groups, t }) {
  const [year,setYear]=useState(2026),[month,setMonth]=useState(3),[daily,setDaily]=useState(DAILY_SEED),[editDay,setEditDay]=useState(null),[editVal,setEditVal]=useState(""),[filterAccId,setFilterAccId]=useState("all");
  const days=getDaysInMonth(year,month), firstDay=getFirstDayOfMonth(year,month);
  const mk=(d)=>`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const values=Array.from({length:days},(_,i)=>daily[mk(i+1)]??null);
  const maxAbs=Math.max(...values.filter(v=>v!==null).map(Math.abs),1);
  const monthTotal=values.filter(v=>v!==null).reduce((a,b)=>a+b,0);
  const winD=values.filter(v=>v!==null&&v>0).length, lossD=values.filter(v=>v!==null&&v<0).length;
  const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAY_NAMES=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const cellBg=(val)=>{if(val===null)return t.surfaceAlt;const i=Math.min(Math.abs(val)/maxAbs,1);return val>0?`rgba(34,208,122,${0.1+i*0.65})`:`rgba(240,71,106,${0.1+i*0.65})`;};
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Calendario</h1><p style={{fontSize:12,color:t.textMuted,marginTop:3}}>P&L diario · haz clic para editar</p></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1)}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,color:t.text,cursor:"pointer",fontSize:14}}>‹</button>
          <span style={{fontSize:13,fontWeight:700,color:t.text,minWidth:130,textAlign:"center"}}>{MONTHS[month]} {year}</span>
          <button onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1)}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,color:t.text,cursor:"pointer",fontSize:14}}>›</button>
        </div>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:t.textMuted,fontWeight:600}}>Ver:</span>
        <button onClick={()=>setFilterAccId("all")} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filterAccId==="all"?"#0ea5e9":t.border}`,background:filterAccId==="all"?"rgba(14,165,233,0.1)":"transparent",color:filterAccId==="all"?"#0ea5e9":t.textMuted}}>Todas</button>
        {groups.map(g=>(<button key={`g${g.id}`} onClick={()=>setFilterAccId(`group_${g.id}`)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filterAccId===`group_${g.id}`?g.color:t.border}`,background:filterAccId===`group_${g.id}`?g.color+"18":"transparent",color:filterAccId===`group_${g.id}`?g.color:t.textMuted}}>{g.name}</button>))}
        {accounts.map(a=>(<button key={a.id} onClick={()=>setFilterAccId(String(a.id))} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filterAccId===String(a.id)?a.color:t.border}`,background:filterAccId===String(a.id)?a.color+"18":"transparent",color:filterAccId===String(a.id)?a.color:t.textMuted,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:a.color,display:"inline-block"}}/>{a.name}</button>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        {[{l:"Total del mes",v:fmtUSD(monthTotal),c:monthTotal>=0?t.positive:t.negative},{l:"Días positivos",v:winD,c:t.positive},{l:"Días negativos",v:lossD,c:t.negative},{l:"Win rate diario",v:fmtPct((winD/(winD+lossD||1))*100),c:t.positive}].map(s=>(<div key={s.l} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 16px"}}><div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:4}}>{s.l}</div><div style={{fontSize:20,fontWeight:700,color:s.c,letterSpacing:"-0.02em"}}>{s.v}</div></div>))}
      </div>
      <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:16,padding:20}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:8}}>{DAY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:t.textMuted,padding:"3px 0",textTransform:"uppercase",letterSpacing:"0.07em"}}>{d}</div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:days}).map((_,i)=>{const d=i+1,key=mk(d),val=daily[key]??null;return(<div key={d} onClick={()=>{setEditDay(key);setEditVal(String(val??""));}} style={{borderRadius:9,padding:"8px 6px",background:cellBg(val),border:`1px solid ${val!==null?(val>0?"rgba(34,208,122,0.25)":"rgba(240,71,106,0.25)"):t.border}`,cursor:"pointer",minHeight:56,transition:"opacity 0.12s"}} onMouseEnter={e=>e.currentTarget.style.opacity="0.72"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}><div style={{fontSize:10,fontWeight:600,color:t.textMuted,marginBottom:3}}>{d}</div>{val!==null?<div style={{fontSize:11,fontWeight:700,color:val>=0?t.positive:t.negative,letterSpacing:"-0.01em"}}>{val>=0?"+":""}{fmt(val,0)}</div>:<div style={{fontSize:16,color:t.textMuted,opacity:0.18,textAlign:"center",marginTop:2}}>·</div>}</div>);})}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:12,justifyContent:"flex-end"}}>
          <span style={{fontSize:10,color:t.textMuted}}>Pérdida</span>
          {[0.12,0.32,0.55,0.75].map(o=><div key={o} style={{width:14,height:14,borderRadius:3,background:`rgba(240,71,106,${o})`}}/>)}
          <div style={{width:14,height:14,borderRadius:3,background:t.surfaceAlt,border:`1px solid ${t.border}`}}/>
          {[0.12,0.32,0.55,0.75].map(o=><div key={o} style={{width:14,height:14,borderRadius:3,background:`rgba(34,208,122,${o})`}}/>)}
          <span style={{fontSize:10,color:t.textMuted}}>Ganancia</span>
        </div>
      </div>
      {editDay&&(<div onClick={()=>setEditDay(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(4px)"}}><div onClick={e=>e.stopPropagation()} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:16,padding:28,width:300}}><div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:3}}>Editar P&L</div><div style={{fontSize:11,color:t.textMuted,marginBottom:14}}>{editDay}</div><input value={editVal} onChange={e=>setEditVal(e.target.value)} type="number" placeholder="Ej: 250 o -85" style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 14px",color:t.text,fontSize:16,fontWeight:600,outline:"none",marginBottom:14,fontFamily:"inherit"}}/><div style={{display:"flex",gap:9}}><button onClick={()=>setEditDay(null)} style={{flex:1,padding:"9px",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:t.textSub,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button><button onClick={()=>{setDaily(p=>({...p,[editDay]:parseFloat(editVal)||0}));setEditDay(null);}} style={{flex:2,padding:"9px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Guardar</button></div></div></div>)}
    </div>
  );
}
function MonthlyRow({ acc, expanded, onToggle, t }) {
  const pnl=acc.currentBalance-acc.initialBalance, pct=(pnl/acc.initialBalance)*100, nb=acc.withdrawn-acc.cost;
  return (
    <div style={{border:`1px solid ${expanded?acc.color+"50":t.border}`,borderLeft:`3px solid ${acc.color}`,borderRadius:10,overflow:"hidden",marginBottom:6,transition:"border-color 0.2s"}}>
      <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",background:expanded?t.surfaceAlt:t.surface,cursor:"pointer"}} onMouseEnter={e=>{if(!expanded)e.currentTarget.style.background=t.surfaceHover;}} onMouseLeave={e=>{if(!expanded)e.currentTarget.style.background=t.surface;}}>
        <div style={{flex:1,fontSize:13,fontWeight:600,color:t.text}}>{acc.name}</div>
        <span style={{fontSize:11,color:t.textMuted,marginRight:4}}>{acc.provider}</span>
        <StatusBadge status={acc.status}/>
        <div style={{textAlign:"right",minWidth:100,fontSize:13,fontWeight:700,color:t.text}}>{fmtUSD(acc.currentBalance)}</div>
        <div style={{minWidth:80,textAlign:"right",fontSize:12,fontWeight:700,color:pnl>=0?t.positive:t.negative}}>{fmtPct(pct)}</div>
        <Spark data={acc.history} color={acc.color}/>
        <span style={{color:t.textMuted,fontSize:12,marginLeft:2,transition:"transform 0.2s",display:"inline-block",transform:expanded?"rotate(90deg)":"rotate(0deg)"}}>›</span>
      </div>
      {expanded&&(<div style={{background:t.surfaceAlt,borderTop:`1px solid ${t.border}`,padding:"14px 16px"}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:9}}>{[{l:"Balance inicial",v:fmtUSD(acc.initialBalance),c:t.textSub},{l:"Balance actual",v:fmtUSD(acc.currentBalance),c:t.text},{l:"P&L $",v:fmtUSD(pnl),c:pnl>=0?t.positive:t.negative},{l:"P&L %",v:fmtPct(pct),c:pnl>=0?t.positive:t.negative},{l:"Inversión",v:fmtUSD(acc.cost),c:t.negative},{l:"Retirado",v:fmtUSD(acc.withdrawn),c:t.positive},{l:"Beneficio neto",v:fmtUSD(nb),c:nb>=0?t.positive:t.negative},{l:"ROI",v:acc.cost>0?fmtPct((nb/acc.cost)*100):"N/A",c:nb>=0?t.positive:t.negative}].map(s=>(<div key={s.l} style={{background:t.surface,borderRadius:8,padding:"8px 11px",border:`1px solid ${t.border}`}}><div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{s.l}</div><div style={{fontSize:13,fontWeight:700,color:s.c,letterSpacing:"-0.01em"}}>{s.v}</div></div>))}</div></div>)}
    </div>
  );
}
function Modal({ open, onClose, title, children, t }) {
  if(!open) return null;
  return (<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"}}><div onClick={e=>e.stopPropagation()} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:20,padding:30,width:"min(580px,93vw)",maxHeight:"88vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}><h2 style={{fontSize:17,fontWeight:700,color:t.text}}>{title}</h2><button onClick={onClose} style={{background:"none",border:"none",color:t.textMuted,fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button></div>{children}</div></div>);
}
function F({label,t,...p}){return(<div style={{marginBottom:12}}><label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>{label}</label><input {...p} style={{width:"100%",boxSizing:"border-box",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit",...p.style}}/></div>);}
function S({label,children,t,...p}){return(<div style={{marginBottom:12}}><label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>{label}</label><select {...p} style={{width:"100%",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}>{children}</select></div>);}

function Dashboard({ user, onLogout }) {
  const [dark,setDark]=useState(true);
  const t=dark?T.dark:T.light;
  const [accounts,setAccounts]=useState(()=>{try{const s=localStorage.getItem(`mhfx_acc_${user.id}`);return s?JSON.parse(s):SEED_ACCOUNTS;}catch{return SEED_ACCOUNTS;}});
  const [groups,setGroups]=useState(()=>{try{const s=localStorage.getItem(`mhfx_grp_${user.id}`);return s?JSON.parse(s):SEED_GROUPS;}catch{return SEED_GROUPS;}});
  useEffect(()=>{try{localStorage.setItem(`mhfx_acc_${user.id}`,JSON.stringify(accounts));}catch{}},[accounts,user.id]);
  useEffect(()=>{try{localStorage.setItem(`mhfx_grp_${user.id}`,JSON.stringify(groups));}catch{}},[groups,user.id]);
  const [view,setView]=useState("dashboard"),[expandedId,setExpandedId]=useState(null),[expandedMonId,setExpandedMonId]=useState(null);
  const [filterType,setFilterType]=useState("Todos"),[filterStatus,setFilterStatus]=useState("Todos"),[filterGroup,setFilterGroup]=useState("Todos");
  const emptyAcc={name:"",provider:"",type:"Fondeo",broker:"MT5",currency:"USD",initialBalance:"",currentBalance:"",cost:"0",withdrawn:"0",status:"Live",startDate:new Date().toISOString().split("T")[0],color:"#0ea5e9",groupId:""};
  const [accModal,setAccModal]=useState(false),[editAcc,setEditAcc]=useState(null),[accForm,setAccForm]=useState(emptyAcc);
  const emptyGrp={name:"",color:"#0ea5e9"};
  const [grpModal,setGrpModal]=useState(false),[editGrp,setEditGrp]=useState(null),[grpForm,setGrpForm]=useState(emptyGrp);
  const openAddAcc=()=>{setAccForm(emptyAcc);setEditAcc(null);setAccModal(true);};
  const openEditAcc=(a)=>{setAccForm({...a,initialBalance:String(a.initialBalance),currentBalance:String(a.currentBalance),cost:String(a.cost),withdrawn:String(a.withdrawn),groupId:String(a.groupId||"")});setEditAcc(a);setAccModal(true);};
  const delAcc=(id)=>{if(window.confirm("¿Eliminar esta cuenta?"))setAccounts(p=>p.filter(a=>a.id!==id));};
  const saveAcc=()=>{const p={...accForm,id:editAcc?editAcc.id:Date.now(),initialBalance:parseFloat(accForm.initialBalance)||0,currentBalance:parseFloat(accForm.currentBalance)||0,cost:parseFloat(accForm.cost)||0,withdrawn:parseFloat(accForm.withdrawn)||0,groupId:parseInt(accForm.groupId)||null};p.history=editAcc?[...(editAcc.history||[p.initialBalance]),p.currentBalance]:[p.initialBalance];setAccounts(prev=>editAcc?prev.map(a=>a.id===editAcc.id?p:a):[...prev,p]);setAccModal(false);};
  const openAddGrp=()=>{setGrpForm(emptyGrp);setEditGrp(null);setGrpModal(true);};
  const openEditGrp=(g)=>{setGrpForm({...g});setEditGrp(g);setGrpModal(true);};
  const delGrp=(id)=>{if(window.confirm("¿Eliminar este grupo?"))setGroups(p=>p.filter(g=>g.id!==id));};
  const saveGrp=()=>{const p={...grpForm,id:editGrp?editGrp.id:Date.now()};setGroups(prev=>editGrp?prev.map(g=>g.id===editGrp.id?p:g):[...prev,p]);setGrpModal(false);};
  const SS=useMemo(()=>{const ti=accounts.reduce((s,a)=>s+a.cost,0),tw=accounts.reduce((s,a)=>s+a.withdrawn,0),tc=accounts.reduce((s,a)=>s+a.currentBalance,0),tini=accounts.reduce((s,a)=>s+a.initialBalance,0),pnl=tc-tini,nb=tw-ti,roi=ti>0?(nb/ti)*100:0;return{live:accounts.filter(a=>a.status==="Live").length,ti,tw,tc,pnl,nb,roi};},[accounts]);
  const filtered=accounts.filter(a=>(filterType==="Todos"||a.type===filterType)&&(filterStatus==="Todos"||a.status===filterStatus)&&(filterGroup==="Todos"||String(a.groupId)===filterGroup));
  const ungrouped=accounts.filter(a=>!a.groupId||!groups.find(g=>g.id===a.groupId));
  const navs=[{id:"dashboard",icon:"▦",label:"Dashboard"},{id:"accounts",icon:"◈",label:"Cuentas"},{id:"calendar",icon:"⊞",label:"Calendario"},{id:"monthly",icon:"≡",label:"Mensual"}];

  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.text,fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",display:"flex"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#232e42;border-radius:3px}button{font-family:inherit}input[type=number]::-webkit-inner-spin-button{opacity:0}select option{background:#141923}`}</style>
      {/* SIDEBAR */}
      <div style={{width:212,background:t.sidebar,borderRight:`1px solid ${t.border}`,display:"flex",flexDirection:"column",padding:"22px 0",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{padding:"0 20px 20px"}}>
          <div style={{fontSize:15,fontWeight:800,letterSpacing:"-0.03em",marginBottom:10}}><span style={{color:"#0ea5e9"}}>Mayahouse</span><span style={{color:"#e6eaf4"}}>FX</span></div>
          {/* User pill */}
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#ffffff08",borderRadius:10,padding:"8px 10px",border:`1px solid ${t.border}`}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{user.avatar}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:10,color:t.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div></div>
          </div>
        </div>
        {navs.map(n=>(<button key={n.id} onClick={()=>setView(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",border:"none",cursor:"pointer",background:view===n.id?"rgba(14,165,233,0.09)":"transparent",color:view===n.id?"#0ea5e9":"#5a6d85",fontSize:13,fontWeight:view===n.id?700:500,borderLeft:view===n.id?"2px solid #0ea5e9":"2px solid transparent",transition:"all 0.13s",textAlign:"left",width:"100%"}}><span style={{fontSize:13}}>{n.icon}</span>{n.label}</button>))}
        <div style={{flex:1}}/>
        <div style={{padding:"0 12px",marginBottom:9}}><button onClick={()=>setDark(d=>!d)} style={{width:"100%",padding:"8px 0",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:"#5a6d85",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{dark?"☀️ Modo Claro":"🌙 Modo Oscuro"}</button></div>
        <div style={{padding:"0 12px",marginBottom:9}}><button onClick={openAddAcc} style={{width:"100%",padding:"10px 0",borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Agregar Cuenta</button></div>
        <div style={{padding:"0 12px"}}><button onClick={onLogout} style={{width:"100%",padding:"8px 0",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:"#5a6d85",fontSize:11,fontWeight:600,cursor:"pointer"}}>← Cerrar sesión</button></div>
      </div>
      {/* CONTENT */}
      <div style={{marginLeft:212,flex:1,padding:"32px 36px",maxWidth:"calc(100vw - 212px)"}}>
        {view==="dashboard"&&(<>
          <div style={{marginBottom:24}}><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Dashboard</h1><p style={{color:t.textMuted,fontSize:12,marginTop:3}}>Bienvenido, {user.name.split(" ")[0]} · {accounts.length} cuentas registradas</p></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:11,marginBottom:20}}>
            <StatBox t={t} icon="🟢" label="Cuentas Live" value={SS.live} sub={`de ${accounts.length} totales`} color={t.positive}/>
            <StatBox t={t} icon="💸" label="Invertido" value={fmtUSD(SS.ti)} color={t.negative}/>
            <StatBox t={t} icon="💰" label="Retirado" value={fmtUSD(SS.tw)} color={t.positive}/>
            <StatBox t={t} icon="📈" label="P&L Total" value={fmtUSD(SS.pnl)} color={SS.pnl>=0?t.positive:t.negative}/>
            <StatBox t={t} icon="⚡" label="Beneficio Neto" value={fmtUSD(SS.nb)} color={SS.nb>=0?t.positive:t.negative}/>
            <StatBox t={t} icon="🚀" label="ROI" value={fmtPct(SS.roi)} color={SS.roi>=0?t.positive:t.negative}/>
          </div>
          <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:14,padding:20,marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Capital por cuenta</div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>{accounts.slice().sort((a,b)=>b.currentBalance-a.currentBalance).map(a=>{const pp=((a.currentBalance-a.initialBalance)/a.initialBalance)*100,pct2=(a.currentBalance/SS.tc)*100;return(<div key={a.id} style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:7,height:7,borderRadius:"50%",background:a.color,flexShrink:0}}/><div style={{width:140,fontSize:11,color:t.textSub,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div><div style={{flex:1,height:6,background:t.surfaceAlt,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct2}%`,height:"100%",background:a.color,borderRadius:4,opacity:0.75}}/></div><div style={{width:90,textAlign:"right",fontSize:12,color:t.text,fontWeight:600}}>{fmtUSD(a.currentBalance)}</div><div style={{width:58,textAlign:"right",fontSize:11,fontWeight:700,color:pp>=0?t.positive:t.negative}}>{fmtPct(pp)}</div></div>);})}</div>
          </div>
          <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:14,padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:10,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.1em"}}>Abril 2026 · P&L diario</div><button onClick={()=>setView("calendar")} style={{fontSize:11,color:"#0ea5e9",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Ver calendario →</button></div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{Object.entries(DAILY_SEED).map(([date,val])=>(<div key={date} title={`${date}: ${fmtUSD(val)}`} style={{width:32,height:32,borderRadius:6,background:val>=0?`rgba(34,208,122,${Math.min(Math.abs(val)/400,1)*0.65+0.1})`:`rgba(240,71,106,${Math.min(Math.abs(val)/1200,1)*0.65+0.1})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.88)"}}>{new Date(date+"T12:00:00").getDate()}</div>))}</div>
          </div>
        </>)}
        {view==="accounts"&&(<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}><div><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Mis Cuentas</h1><p style={{color:t.textMuted,fontSize:12,marginTop:3}}>{accounts.length} cuentas · {SS.live} activas · {groups.length} grupos</p></div><div style={{display:"flex",gap:8}}><button onClick={openAddGrp} style={{padding:"9px 16px",borderRadius:9,border:`1px solid ${t.border}`,background:t.surface,color:t.textSub,fontSize:12,fontWeight:600,cursor:"pointer"}}>＋ Grupo</button><button onClick={openAddAcc} style={{padding:"9px 18px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Cuenta</button></div></div>
          <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:10,color:t.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Tipo:</span>
            {["Todos","Fondeo","Capital Propio","Futuros"].map(f=>(<button key={f} onClick={()=>setFilterType(f)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filterType===f?"#0ea5e9":t.border}`,background:filterType===f?"rgba(14,165,233,0.1)":"transparent",color:filterType===f?"#0ea5e9":t.textMuted}}>{f}</button>))}
            <div style={{width:1,background:t.border,margin:"0 3px"}}/>
            <span style={{fontSize:10,color:t.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Estado:</span>
            {["Todos","Live","Evaluación","Inactiva"].map(f=>(<button key={f} onClick={()=>setFilterStatus(f)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${filterStatus===f?"#8b5cf6":t.border}`,background:filterStatus===f?"rgba(139,92,246,0.1)":"transparent",color:filterStatus===f?"#8b5cf6":t.textMuted}}>{f}</button>))}
          </div>
          {filterType==="Todos"&&filterStatus==="Todos"&&filterGroup==="Todos"
            ?(<>{groups.map(g=>(<GroupSection key={g.id} group={g} accounts={accounts.filter(a=>a.groupId===g.id)} expandedId={expandedId} onToggle={id=>setExpandedId(expandedId===id?null:id)} onEdit={openEditAcc} onDelete={delAcc} onEditGroup={openEditGrp} onDeleteGroup={delGrp} t={t}/>))}{ungrouped.length>0&&(<div style={{marginBottom:20}}><div style={{fontSize:11,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:8,paddingLeft:4}}>Sin grupo</div><div style={{paddingLeft:18}}>{ungrouped.map(a=><AccountRow key={a.id} acc={a} group={null} expanded={expandedId===a.id} onToggle={()=>setExpandedId(expandedId===a.id?null:a.id)} onEdit={openEditAcc} onDelete={delAcc} t={t}/>)}</div></div>)}</>)
            :(<>{filtered.map(a=><AccountRow key={a.id} acc={a} group={groups.find(g=>g.id===a.groupId)||null} expanded={expandedId===a.id} onToggle={()=>setExpandedId(expandedId===a.id?null:a.id)} onEdit={openEditAcc} onDelete={delAcc} t={t}/>)}{filtered.length===0&&<div style={{textAlign:"center",padding:60,color:t.textMuted,fontSize:13}}>No hay cuentas con esos filtros</div>}</>)
          }
        </>)}
        {view==="calendar"&&<PerformanceCalendar accounts={accounts} groups={groups} t={t}/>}
        {view==="monthly"&&(<>
          <div style={{marginBottom:22}}><h1 style={{fontSize:26,fontWeight:700,letterSpacing:"-0.03em",color:t.text}}>Resumen Mensual</h1><p style={{color:t.textMuted,fontSize:12,marginTop:3}}>Track record consolidado · haz clic para ver detalles</p></div>
          {groups.map(g=>{const accs=accounts.filter(a=>a.groupId===g.id);if(accs.length===0)return null;const gtot=accs.reduce((s,a)=>s+a.currentBalance,0),gpnl=accs.reduce((s,a)=>s+(a.currentBalance-a.initialBalance),0);return(<div key={g.id} style={{marginBottom:22}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 0",borderBottom:`1px solid ${t.border}`}}><div style={{width:9,height:9,borderRadius:2,background:g.color}}/><span style={{fontSize:11,fontWeight:700,color:t.textSub,textTransform:"uppercase",letterSpacing:"0.08em",flex:1}}>{g.name}</span><span style={{fontSize:12,fontWeight:700,color:t.text}}>{fmtUSD(gtot)}</span><span style={{fontSize:12,fontWeight:700,color:gpnl>=0?t.positive:t.negative,marginLeft:10}}>{fmtUSD(gpnl)}</span></div>{accs.map(a=><MonthlyRow key={a.id} acc={a} expanded={expandedMonId===a.id} onToggle={()=>setExpandedMonId(expandedMonId===a.id?null:a.id)} t={t}/>)}</div>);})}
          {ungrouped.length>0&&(<div style={{marginBottom:22}}><div style={{fontSize:10,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:8}}>Sin grupo</div>{ungrouped.map(a=><MonthlyRow key={a.id} acc={a} expanded={expandedMonId===a.id} onToggle={()=>setExpandedMonId(expandedMonId===a.id?null:a.id)} t={t}/>)}</div>)}
          <div style={{background:t.surface,border:`2px solid rgba(14,165,233,0.18)`,borderRadius:14,padding:"20px 24px",marginTop:8}}><div style={{fontSize:10,fontWeight:700,color:"#0ea5e9",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16}}>Totales Consolidados</div><div style={{display:"flex",gap:24,flexWrap:"wrap"}}>{[{l:"Invertido",v:fmtUSD(SS.ti),c:t.negative},{l:"Retirado",v:fmtUSD(SS.tw),c:t.positive},{l:"Beneficio neto",v:fmtUSD(SS.nb),c:SS.nb>=0?t.positive:t.negative},{l:"P&L portafolio",v:fmtUSD(SS.pnl),c:SS.pnl>=0?t.positive:t.negative},{l:"ROI total",v:fmtPct(SS.roi),c:SS.roi>=0?t.positive:t.negative}].map(s=>(<div key={s.l}><div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:5}}>{s.l}</div><div style={{fontSize:20,fontWeight:700,color:s.c,letterSpacing:"-0.02em"}}>{s.v}</div></div>))}</div></div>
        </>)}
      </div>
      {/* MODALS */}
      <Modal open={accModal} onClose={()=>setAccModal(false)} title={editAcc?"Editar Cuenta":"Nueva Cuenta"} t={t}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
          <div style={{gridColumn:"1/-1"}}><F t={t} label="Nombre" value={accForm.name} onChange={e=>setAccForm(f=>({...f,name:e.target.value}))} placeholder="Ej: FTMO 100K #1"/></div>
          <F t={t} label="Proveedor" value={accForm.provider} onChange={e=>setAccForm(f=>({...f,provider:e.target.value}))} placeholder="FTMO, AXI…"/>
          <S t={t} label="Tipo" value={accForm.type} onChange={e=>setAccForm(f=>({...f,type:e.target.value}))}><option>Fondeo</option><option>Capital Propio</option><option>Futuros</option><option>Otro</option></S>
          <S t={t} label="Broker" value={accForm.broker} onChange={e=>setAccForm(f=>({...f,broker:e.target.value}))}><option>MT5</option><option>MT4</option><option>Tradovate</option><option>cTrader</option><option>TradeLocker</option><option>Otro</option></S>
          <S t={t} label="Estado" value={accForm.status} onChange={e=>setAccForm(f=>({...f,status:e.target.value}))}><option>Live</option><option>Evaluación</option><option>Inactiva</option><option>Suspendida</option></S>
          <F t={t} label="Balance Inicial ($)" type="number" value={accForm.initialBalance} onChange={e=>setAccForm(f=>({...f,initialBalance:e.target.value}))} placeholder="100000"/>
          <F t={t} label="Balance Actual ($)" type="number" value={accForm.currentBalance} onChange={e=>setAccForm(f=>({...f,currentBalance:e.target.value}))} placeholder="104500"/>
          <F t={t} label="Costo / Inversión ($)" type="number" value={accForm.cost} onChange={e=>setAccForm(f=>({...f,cost:e.target.value}))} placeholder="540"/>
          <F t={t} label="Total Retirado ($)" type="number" value={accForm.withdrawn} onChange={e=>setAccForm(f=>({...f,withdrawn:e.target.value}))} placeholder="0"/>
          <F t={t} label="Fecha inicio" type="date" value={accForm.startDate} onChange={e=>setAccForm(f=>({...f,startDate:e.target.value}))}/>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Grupo</label><select value={String(accForm.groupId||"")} onChange={e=>setAccForm(f=>({...f,groupId:e.target.value}))} style={{width:"100%",background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 13px",color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}><option value="">Sin grupo</option>{groups.map(g=><option key={g.id} value={String(g.id)}>{g.name}</option>)}</select></div>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Color</label><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{PALETTE.map(c=><div key={c} onClick={()=>setAccForm(f=>({...f,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:accForm.color===c?"3px solid #fff":"3px solid transparent",boxShadow:accForm.color===c?`0 0 0 2px ${c}`:"none",transition:"all 0.1s"}}/>)}</div></div>
        </div>
        <div style={{display:"flex",gap:9,marginTop:6}}><button onClick={()=>setAccModal(false)} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:t.textSub,fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button><button onClick={saveAcc} style={{flex:2,padding:"11px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{editAcc?"Guardar cambios":"Crear cuenta"}</button></div>
      </Modal>
      <Modal open={grpModal} onClose={()=>setGrpModal(false)} title={editGrp?"Editar Grupo":"Nuevo Grupo"} t={t}>
        <F t={t} label="Nombre del grupo" value={grpForm.name} onChange={e=>setGrpForm(f=>({...f,name:e.target.value}))} placeholder="Ej: Cuentas Fondeo FTMO"/>
        <div style={{marginBottom:16}}><label style={{display:"block",fontSize:10,color:t.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700}}>Color del grupo</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{PALETTE.map(c=><div key={c} onClick={()=>setGrpForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:6,background:c,cursor:"pointer",border:grpForm.color===c?"3px solid #fff":"3px solid transparent",boxShadow:grpForm.color===c?`0 0 0 2px ${c}`:"none",transition:"all 0.1s"}}/>)}</div></div>
        <div style={{display:"flex",gap:9,marginTop:8}}><button onClick={()=>setGrpModal(false)} style={{flex:1,padding:"11px",borderRadius:9,border:`1px solid ${t.border}`,background:"transparent",color:t.textSub,fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button><button onClick={saveGrp} style={{flex:2,padding:"11px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{editGrp?"Guardar":"Crear grupo"}</button></div>
      </Modal>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOT — manages which screen is shown
// ═════════════════════════════════════════════════════════════════════════════
export default function MayahouseFX() {
  const [screen, setScreen] = useState("landing"); // landing | login | dashboard
  const [user,   setUser]   = useState(null);

  const handleLogin = (u) => { setUser(u); setScreen("dashboard"); };
  const handleLogout = () => { setUser(null); setScreen("landing"); };

  if (screen === "landing")   return <LandingPage onGoToLogin={() => setScreen("login")} />;
  if (screen === "login")     return <LoginPage onLogin={handleLogin} onBack={() => setScreen("landing")} />;
  if (screen === "dashboard") return <Dashboard user={user} onLogout={handleLogout} />;
  return null;
}
