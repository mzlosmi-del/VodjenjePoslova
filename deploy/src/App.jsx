import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── helpers ───────────────────────────────────────────────────────────────────
const formatPosaoNumber = (n) => `P${String(n).padStart(8, "0")}`;
const formatSifraKupca  = (n) => `K${String(n).padStart(5, "0")}`;
const todayISO  = () => new Date().toISOString().slice(0, 10);
const fmtDate   = s => { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}.${m}.${y}`; };
const isOverdue = iso => iso && new Date(iso) < new Date();

const dbToApp = r => ({
  id: r.id, posaoNum: r.posao_num, Posao: r.posao,
  KLIJENT: r.klijent, SifraKupca: r.sifra_kupca,
  DatumUnosa: r.datum_unosa, RokZaIsporuku: r.rok_za_isporuku,
  Unosilac: r.unosilac, Opis: r.opis,
  PoslatiNaIzradu: r.poslati_na_izradu, MontazaIsporuka: r.montaza_isporuka,
  Placanje: r.placanje, StatusIzrade: r.status_izrade,
  StatusIsporuke: r.status_isporuke, StatusMontaze: r.status_montaze,
  SpecifikacijaCene: r.specifikacija_cene,
  Obracun: r.obracun != null ? String(r.obracun) : "",
  ZavrsenPosao: r.zavrsen_posao, Fakturisano: r.fakturisano,
});
const appToDB = p => ({
  posao_num: p.posaoNum, posao: p.Posao, klijent: p.KLIJENT,
  sifra_kupca: p.SifraKupca, datum_unosa: p.DatumUnosa || null,
  rok_za_isporuku: p.RokZaIsporuku || null, unosilac: p.Unosilac,
  opis: p.Opis, poslati_na_izradu: p.PoslatiNaIzradu,
  montaza_isporuka: p.MontazaIsporuka, placanje: p.Placanje,
  status_izrade: p.StatusIzrade||false, status_isporuke: p.StatusIsporuke||false,
  status_montaze: p.StatusMontaze||false, specifikacija_cene: p.SpecifikacijaCene,
  obracun: p.Obracun ? parseFloat(p.Obracun) : null,
  zavrsen_posao: p.ZavrsenPosao||false, fakturisano: p.Fakturisano||false,
});
const dbKupacToApp = r => ({
  id: r.id, SifraKupca: r.sifra_kupca, Naziv: r.naziv,
  Grad: r.grad, Ulica: r.ulica, Broj: r.broj,
  PostanskiBroj: r.postanski_broj, Telefon: r.telefon, PIB: r.pib,
});
const appKupacToDB = k => ({
  sifra_kupca: k.SifraKupca, naziv: k.Naziv, grad: k.Grad,
  ulica: k.Ulica, broj: k.Broj, postanski_broj: k.PostanskiBroj,
  telefon: k.Telefon, pib: k.PIB,
});

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:"#0D1117", surface:"#161B22", surfaceHover:"#1C2330", surfaceRaised:"#1F2937",
  border:"#30363D", borderStrong:"#484F58",
  text:"#F0F6FF", textMid:"#B0BAC9", textSoft:"#6B7785",
  primary:"#3B82F6", primaryHover:"#60A5FA",
  primaryLight:"rgba(59,130,246,0.12)", primaryBorder:"rgba(59,130,246,0.35)",
  green:"#34D399", greenBg:"rgba(52,211,153,0.10)", greenBorder:"rgba(52,211,153,0.30)",
  amber:"#FBBF24", amberBg:"rgba(251,191,36,0.10)", amberBorder:"rgba(251,191,36,0.30)",
  red:"#F87171",   redBg:"rgba(248,113,113,0.10)",  redBorder:"rgba(248,113,113,0.30)",
  purple:"#A78BFA",purpleBg:"rgba(167,139,250,0.10)",purpleBorder:"rgba(167,139,250,0.30)",
  shadow:"0 1px 3px rgba(0,0,0,0.30)", shadowMd:"0 4px 16px rgba(0,0,0,0.40)",
  shadowLg:"0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)",
  fontHead:"'Bricolage Grotesque', sans-serif", fontBody:"'Plus Jakarta Sans', sans-serif",
  radius:"10px", radiusSm:"7px", radiusLg:"14px",
};

const ALL_TABS = [
  { key:"poslovi",   label:"Poslovi",          icon:"📋" },
  { key:"aktivni",   label:"Aktivni poslovi",  icon:"⚡" },
  { key:"zavrseni",  label:"Završeni poslovi", icon:"✅" },
  { key:"radionica", label:"Radionica",        icon:"🔧" },
  { key:"montaza",   label:"Montaža",          icon:"🏗" },
  { key:"isporuka",  label:"Isporuka",         icon:"🚚" },
  { key:"knjizenje", label:"Knjiženje",        icon:"📒" },
  { key:"kupci",     label:"Kupci",            icon:"🏢" },
  { key:"obracun",   label:"Obračun",          icon:"💰" },
  { key:"korisnici", label:"Korisnici",        icon:"👥" },
];

const montazaIsporukaOptions = ["Samo isporuka","Montaža i isporuka","Lično preuzimanje"];
const placanjeOptions        = ["Faktura","Otpremnica","Zaduženje"];

// ── responsive hook ───────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return { isMobile: w < 640, isTablet: w < 1024, width: w };
}

// ── shared styles ─────────────────────────────────────────────────────────────
const thS = { padding:"10px 14px", textAlign:"left", color:T.text, fontSize:11,
  textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700,
  borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap", background:"#1C2330", fontFamily:T.fontBody };
const tdS = { padding:"11px 14px", color:T.text, fontSize:13,
  borderBottom:`1px solid ${T.border}`, verticalAlign:"middle", fontFamily:T.fontBody };

const btnS = (variant="primary") => {
  if (variant==="primary") return {background:T.primary,border:"none",color:"#fff",borderRadius:T.radiusSm,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:T.fontBody};
  if (variant==="ghost")   return {background:"none",border:`1px solid ${T.border}`,color:T.textMid,borderRadius:T.radiusSm,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:T.fontBody};
  if (variant==="danger")  return {background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:T.radiusSm,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:T.fontBody};
  if (variant==="edit")    return {background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,color:T.primary,borderRadius:T.radiusSm,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:T.fontBody};
  return {};
};

// ── ui atoms ──────────────────────────────────────────────────────────────────
const CheckBadge = ({val}) => val
  ? <span style={{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600,fontFamily:T.fontBody}}>✓ Da</span>
  : <span style={{background:T.surfaceRaised,color:T.textSoft,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600,fontFamily:T.fontBody}}>— Ne</span>;

const InlineCheck = ({val, onChange, disabled}) => (
  <div onClick={()=>!disabled&&onChange(!val)} style={{display:"inline-flex",alignItems:"center",gap:6,cursor:disabled?"default":"pointer",userSelect:"none"}}>
    <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${val?T.green:T.border}`,background:val?T.greenBg:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
      {val && <span style={{color:T.green,fontSize:13,lineHeight:1,fontWeight:700}}>✓</span>}
    </div>
    <span style={{color:val?T.green:T.textSoft,fontSize:12,fontFamily:T.fontBody,fontWeight:val?600:400}}>{val?"Da":"Ne"}</span>
  </div>
);

const placanjeColor = p => p==="Faktura"?T.primary:p==="Otpremnica"?T.amber:T.purple;
const PlacanjeBadge = ({val}) => {
  if (!val) return <span style={{color:T.textSoft}}>—</span>;
  const c = placanjeColor(val);
  return <span style={{background:`${c}18`,color:c,border:`1px solid ${c}35`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600,fontFamily:T.fontBody}}>{val}</span>;
};

function Spinner({text="Učitavanje..."}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:60,color:T.textSoft,fontFamily:T.fontBody}}>
      <div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTopColor:T.primary,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:13}}>{text}</span>
    </div>
  );
}

function ErrBanner({msg, onDismiss}) {
  if (!msg) return null;
  return (
    <div style={{background:T.redBg,border:`1px solid ${T.redBorder}`,borderRadius:T.radiusSm,padding:"10px 14px",color:T.red,fontSize:13,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:T.fontBody}}>
      <span>⚠ {msg}</span>
      {onDismiss && <button onClick={onDismiss} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:16}}>×</button>}
    </div>
  );
}

// ── stable field ──────────────────────────────────────────────────────────────
function Field({label, value, onChange, type="text", options, readOnly, error}) {
  const [local, setLocal] = useState(value ?? "");
  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current !== value) { setLocal(value ?? ""); prevValue.current = value; }
  }, [value]);
  const commit = () => { prevValue.current = local; onChange(local); };
  const base = { width:"100%", background:readOnly?T.bg:T.surfaceRaised, border:`1px solid ${error?T.red:T.border}`,
    borderRadius:T.radiusSm, padding:"9px 12px", color:readOnly?T.textMid:T.text,
    fontSize:13, fontFamily:T.fontBody, boxSizing:"border-box", outline:"none", colorScheme:"dark" };
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4,fontFamily:T.fontBody}}>{label}</label>
      {options
        ? <select value={local} onChange={e=>{setLocal(e.target.value);onChange(e.target.value);}} style={{...base,cursor:"pointer"}}>
            <option value="">—</option>
            {options.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        : <input type={type} value={local} readOnly={readOnly}
            onChange={e=>!readOnly&&setLocal(e.target.value)}
            onBlur={!readOnly?commit:undefined}
            onKeyDown={!readOnly?e=>{if(e.key==="Enter"||e.key==="Tab")commit();}:undefined}
            style={base}/>
      }
      {error && <div style={{color:T.red,fontSize:11,marginTop:3,fontFamily:T.fontBody}}>{error}</div>}
    </div>
  );
}

function DateField({label, value, onChange, readOnly, error}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4,fontFamily:T.fontBody}}>{label}</label>
      <input type="date" value={value||""} onChange={e=>!readOnly&&onChange(e.target.value)} readOnly={readOnly}
        style={{width:"100%",background:readOnly?T.bg:T.surfaceRaised,border:`1px solid ${error?T.red:T.border}`,borderRadius:T.radiusSm,padding:"9px 12px",color:readOnly?T.textMid:T.text,fontSize:13,fontFamily:T.fontBody,boxSizing:"border-box",outline:"none",colorScheme:"dark"}}/>
      {error && <div style={{color:T.red,fontSize:11,marginTop:3}}>{error}</div>}
    </div>
  );
}

function CheckField({label, value, onChange, readOnly}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:6,fontFamily:T.fontBody}}>{label}</label>
      <div onClick={()=>!readOnly&&onChange(!value)} style={{display:"inline-flex",alignItems:"center",gap:8,cursor:readOnly?"default":"pointer",userSelect:"none"}}>
        <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${value?T.green:T.border}`,background:value?T.greenBg:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
          {value && <span style={{color:T.green,fontSize:14,fontWeight:700}}>✓</span>}
        </div>
        <span style={{color:value?T.green:T.textSoft,fontSize:13,fontFamily:T.fontBody,fontWeight:value?600:400}}>{value?"Da":"Ne"}</span>
      </div>
    </div>
  );
}

function RadioGroup({label, value, onChange, options, readOnly}) {
  const cm = {
    "Samo isporuka":{c:T.green,bg:T.greenBg,b:T.greenBorder},
    "Montaža i isporuka":{c:T.primary,bg:T.primaryLight,b:T.primaryBorder},
    "Lično preuzimanje":{c:T.purple,bg:T.purpleBg,b:T.purpleBorder},
    "Faktura":{c:T.primary,bg:T.primaryLight,b:T.primaryBorder},
    "Otpremnica":{c:T.amber,bg:T.amberBg,b:T.amberBorder},
    "Zaduženje":{c:T.purple,bg:T.purpleBg,b:T.purpleBorder},
  };
  return (
    <div style={{marginBottom:14,gridColumn:"1/-1"}}>
      {label && <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:8,fontFamily:T.fontBody}}>{label}</label>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {options.map(opt=>{
          const active=value===opt; const m=cm[opt]||{c:T.textMid,bg:T.surfaceRaised,b:T.border};
          return (
            <button key={opt} type="button" onClick={()=>!readOnly&&onChange(opt)} style={{
              background:active?m.bg:T.surfaceRaised,border:`1.5px solid ${active?m.b:T.border}`,
              color:active?m.c:T.textSoft,borderRadius:T.radiusSm,padding:"7px 16px",
              cursor:readOnly?"default":"pointer",fontSize:13,fontWeight:active?600:400,
              display:"flex",alignItems:"center",gap:7,transition:"all 0.15s",fontFamily:T.fontBody,
            }}>
              <span style={{width:11,height:11,borderRadius:"50%",border:`2px solid ${active?m.c:T.borderStrong}`,background:active?m.c:"transparent",flexShrink:0,transition:"all 0.15s"}}/>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UserSearchField({label, value, onChange, users}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const base = {width:"100%",background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"9px 12px",color:T.text,fontSize:13,fontFamily:T.fontBody,boxSizing:"border-box",colorScheme:"dark"};
  const filtered = users.filter(u => `${u.ime||""} ${u.prezime||""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{marginBottom:14,position:"relative"}}>
      <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4,fontFamily:T.fontBody}}>{label}</label>
      <div onClick={()=>setOpen(o=>!o)} style={{...base,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}}>
        <span style={{color:value?T.text:T.textSoft}}>{value||"— Izaberi korisnika —"}</span>
        <span style={{color:T.textSoft,fontSize:11,transform:open?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
      </div>
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,zIndex:3000,boxShadow:T.shadowMd,overflow:"hidden"}}>
          <div style={{padding:"8px 8px 5px"}}>
            <input autoFocus placeholder="Pretraži..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} style={{...base,fontSize:12}}/>
          </div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {filtered.length===0 ? <div style={{padding:"10px 14px",color:T.textSoft,fontSize:13}}>Nema rezultata</div>
            : filtered.map(u=>{
              const full=`${u.ime||""} ${u.prezime||""}`.trim();
              return (
                <div key={u.id} onClick={()=>{onChange(full);setOpen(false);setSearch("");}}
                  style={{padding:"9px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHover}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <span style={{color:T.text,fontSize:13,fontWeight:500}}>{full}</span>
                  {u.is_admin && <span style={{color:T.primary,fontSize:11,fontWeight:600}}>Admin</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KupacSearchField({label, sifra, naziv, kupci, onChange}) {
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const base={width:"100%",background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"9px 12px",color:T.text,fontSize:13,fontFamily:T.fontBody,boxSizing:"border-box",colorScheme:"dark"};
  const filtered=kupci.filter(k=>k.SifraKupca.toLowerCase().includes(search.toLowerCase())||k.Naziv.toLowerCase().includes(search.toLowerCase())||k.Grad.toLowerCase().includes(search.toLowerCase()));
  const display=sifra?`${sifra} — ${naziv}`:"";
  return (
    <div style={{marginBottom:14,position:"relative",gridColumn:"1/-1"}}>
      <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4,fontFamily:T.fontBody}}>{label}</label>
      <div onClick={()=>setOpen(o=>!o)} style={{...base,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}}>
        <span style={{color:display?T.text:T.textSoft}}>{display||"— Izaberi kupca —"}</span>
        <span style={{color:T.textSoft,fontSize:11,transform:open?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,zIndex:3000,boxShadow:T.shadowMd,overflow:"hidden"}}>
          <div style={{padding:"8px 8px 5px"}}>
            <input autoFocus placeholder="Pretraži..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} style={{...base,fontSize:12}}/>
          </div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {filtered.length===0?<div style={{padding:"10px 14px",color:T.textSoft,fontSize:13}}>Nema rezultata</div>
            :filtered.map(k=>(
              <div key={k.id} onClick={()=>{onChange(k);setOpen(false);setSearch("");}} style={{padding:"9px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <div><span style={{color:T.primary,fontWeight:600,fontSize:13}}>{k.SifraKupca}</span><span style={{color:T.text,fontSize:13,marginLeft:10}}>{k.Naziv}</span></div>
                <span style={{color:T.textSoft,fontSize:12}}>{k.Grad}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({title,onClose,children,wide}) {
  const {isMobile} = useBreakpoint();
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"}}>
      <div style={{background:T.surface,borderRadius:isMobile?`${T.radiusLg} ${T.radiusLg} 0 0`:T.radiusLg,padding:isMobile?"20px 16px":"28px 32px",width:isMobile?"100%":undefined,minWidth:isMobile?undefined:wide?720:560,maxWidth:isMobile?"100%":"94vw",maxHeight:isMobile?"92vh":"92vh",overflowY:"auto",boxShadow:T.shadowLg,border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{color:T.text,fontFamily:T.fontHead,margin:0,fontSize:isMobile?17:19,fontWeight:700,letterSpacing:"-0.02em"}}>{title}</h2>
          <button onClick={onClose} style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,color:T.textMid,cursor:"pointer",fontSize:18,width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({label,value,color,sub}) {
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"16px 18px",boxShadow:T.shadow,minWidth:130,flex:"1 1 130px"}}>
      <div style={{color:T.textSoft,fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5,fontFamily:T.fontBody}}>{label}</div>
      <div style={{color:color||T.text,fontSize:22,fontWeight:700,fontFamily:T.fontHead,letterSpacing:"-0.03em",lineHeight:1}}>{value}</div>
      {sub&&<div style={{color:T.textSoft,fontSize:12,marginTop:5,fontFamily:T.fontBody}}>{sub}</div>}
    </div>
  );
}

function PageHeader({title,subtitle,action}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <div>
        <h1 style={{fontFamily:T.fontHead,color:T.text,margin:"0 0 3px",fontSize:22,fontWeight:700,letterSpacing:"-0.03em"}}>{title}</h1>
        {subtitle&&<p style={{color:T.textSoft,margin:0,fontSize:13,fontFamily:T.fontBody}}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── TABLE CONTROLS (search / sort / column reorder) ───────────────────────────
function useTableControls(viewKey, defaultCols) {
  const storageKey = `cols_${viewKey}`;
  const [search,  setSearch]  = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [showColMenu, setShowColMenu] = useState(false);
  const [cols, setCols] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : defaultCols; }
    catch { return defaultCols; }
  });
  const dragCol = useRef(null);

  function saveCols(next) { setCols(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {} }
  function toggleSort(key) {
    if (sortCol===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortCol(key); setSortDir("asc"); }
  }
  function onDragStart(key) { dragCol.current = key; }
  function onDrop(key) {
    if (!dragCol.current || dragCol.current===key) return;
    const next = [...cols];
    const fromIdx = next.findIndex(c=>c.key===dragCol.current);
    const toIdx   = next.findIndex(c=>c.key===key);
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    saveCols(next);
    dragCol.current = null;
  }

  function filterAndSort(rows) {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(row => Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q)));
    }
    if (sortCol) {
      r = [...r].sort((a,b) => {
        const av = a[sortCol]; const bv = b[sortCol];
        if (av==null) return 1; if (bv==null) return -1;
        const cmp = String(av).localeCompare(String(bv), undefined, {numeric:true});
        return sortDir==="asc" ? cmp : -cmp;
      });
    }
    return r;
  }

  const SortIcon = ({colKey}) => {
    if (sortCol!==colKey) return <span style={{color:T.textSoft,fontSize:10,marginLeft:4,opacity:0.4}}>↕</span>;
    return <span style={{color:T.primary,fontSize:10,marginLeft:4}}>{sortDir==="asc"?"↑":"↓"}</span>;
  };

  const Toolbar = ({extraAction}) => {
    const [localSearch, setLocalSearch] = useState(search);
    const commit = (val) => setSearch(val);
    return (
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:"1",minWidth:180}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.textSoft,fontSize:14,pointerEvents:"none"}}>🔍</span>
          <input value={localSearch} onChange={e=>setLocalSearch(e.target.value)}
            onBlur={e=>commit(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"||e.key==="Tab")commit(localSearch); if(e.key==="Escape"){setLocalSearch("");commit("");} }}
            placeholder="Pretraži... (Enter)"
            style={{width:"100%",background:T.surfaceRaised,border:`1px solid ${localSearch?T.primaryBorder:T.border}`,borderRadius:T.radiusSm,padding:"7px 12px 7px 32px",color:T.text,fontSize:13,fontFamily:T.fontBody,outline:"none",boxSizing:"border-box",colorScheme:"dark"}}/>
          {localSearch&&<button onClick={()=>{setLocalSearch("");commit("");}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.textSoft,cursor:"pointer",fontSize:14}}>×</button>}
        </div>
        <div style={{position:"relative"}}>
          <button onClick={()=>setShowColMenu(v=>!v)} style={{...btnS("ghost"),padding:"7px 13px",fontSize:12,display:"flex",alignItems:"center",gap:5}}>
            ⚙ Kolone
          </button>
          {showColMenu&&(
            <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,zIndex:500,boxShadow:T.shadowMd,minWidth:220,padding:12}}>
              <div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Redosled kolona</div>
              <div style={{color:T.textSoft,fontSize:11,marginBottom:8}}>Prevuci da promeniš redosled</div>
              {cols.map(c=>(
                <div key={c.key} draggable onDragStart={()=>onDragStart(c.key)} onDragOver={e=>e.preventDefault()} onDrop={()=>onDrop(c.key)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:T.radiusSm,cursor:"grab",marginBottom:3,background:T.surfaceRaised,border:`1px solid ${T.border}`}}>
                  <span style={{color:T.textSoft,fontSize:12}}>⠿</span>
                  <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",flex:1,fontSize:13,color:T.text,fontFamily:T.fontBody}}>
                    <input type="checkbox" checked={c.visible} onChange={()=>saveCols(cols.map(x=>x.key===c.key?{...x,visible:!x.visible}:x))} style={{accentColor:T.primary}}/>
                    {c.label}
                  </label>
                </div>
              ))}
              <button onClick={()=>saveCols(defaultCols)} style={{...btnS("ghost"),width:"100%",marginTop:8,padding:"5px",fontSize:11}}>Resetuj</button>
              <button onClick={()=>setShowColMenu(false)} style={{...btnS("primary"),width:"100%",marginTop:6,padding:"5px",fontSize:11}}>Zatvori</button>
            </div>
          )}
        </div>
        {extraAction}
      </div>
    );
  };

  const thDraggable = (col) => ({
    style: { ...thS, cursor:"pointer", userSelect:"none" },
    draggable: true,
    onDragStart: () => onDragStart(col.key),
    onDragOver: e => e.preventDefault(),
    onDrop: () => onDrop(col.key),
    onClick: () => toggleSort(col.key),
  });

  return { search, sortCol, sortDir, cols, filterAndSort, Toolbar, SortIcon, thDraggable };
}

// ── POSAO TABLE ───────────────────────────────────────────────────────────────
// priority: 1=always show, 2=hide on tablet, 3=hide on narrow, 4=hidden by default
const POSAO_COLS_DEFAULT = [
  {key:"Posao",visible:true,label:"Posao",priority:1,w:90},
  {key:"KLIJENT",visible:true,label:"Klijent",priority:1,w:130},
  {key:"SifraKupca",visible:true,label:"Šifra",priority:3,w:70},
  {key:"DatumUnosa",visible:true,label:"Datum",priority:3,w:80},
  {key:"RokZaIsporuku",visible:true,label:"Rok",priority:2,w:80},
  {key:"Unosilac",visible:true,label:"Unosilac",priority:3,w:90},
  {key:"Opis",visible:true,label:"Opis",priority:2,w:120},
  {key:"PoslatiNaIzradu",visible:true,label:"Poslati",priority:3,w:80},
  {key:"MontazaIsporuka",visible:true,label:"Montaža/Isp.",priority:2,w:110},
  {key:"Placanje",visible:true,label:"Plaćanje",priority:2,w:90},
  {key:"StatusIzrade",visible:true,label:"Izrada",priority:1,w:70},
  {key:"StatusIsporuke",visible:true,label:"Isporuka",priority:2,w:75},
  {key:"StatusMontaze",visible:true,label:"Montaža",priority:3,w:75},
  {key:"SpecifikacijaCene",visible:true,label:"Specifikacija",priority:3,w:100},
  {key:"Obracun",visible:true,label:"Obračun",priority:2,w:100},
  {key:"ZavrsenPosao",visible:true,label:"Završen",priority:1,w:70},
  {key:"Fakturisano",visible:false,label:"Fakturisano",priority:4,w:80},
];

function PosaoTable({rows, viewKey, canEdit, onView, onEdit, onDelete, onInlineZavrsen}) {
  const ctrl = useTableControls(viewKey, POSAO_COLS_DEFAULT);
  const {isMobile} = useBreakpoint();
  const visibleCols = ctrl.cols.filter(c=>c.visible);
  const processed = ctrl.filterAndSort(rows);
  const miColor = v => v==="Montaža i isporuka"?T.primary:v==="Samo isporuka"?T.green:T.purple;

  function renderCell(p, key) {
    switch(key) {
      case "Posao":            return <span style={{color:T.primary,fontWeight:700}}>{p.Posao}</span>;
      case "KLIJENT":          return <span style={{fontWeight:500}}>{p.KLIJENT}</span>;
      case "SifraKupca":       return <span style={{color:T.textSoft,fontSize:12}}>{p.SifraKupca}</span>;
      case "DatumUnosa":       return <span style={{color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</span>;
      case "RokZaIsporuku":    return <span style={{color:isOverdue(p.RokZaIsporuku)?T.red:T.textMid,fontSize:12,fontWeight:isOverdue(p.RokZaIsporuku)?600:400}}>{fmtDate(p.RokZaIsporuku)}</span>;
      case "Unosilac":         return <span style={{color:T.textMid}}>{p.Unosilac}</span>;
      case "Opis":             return <span style={{color:T.textMid,display:"block",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.Opis}</span>;
      case "PoslatiNaIzradu":  return <span style={{background:T.surfaceRaised,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{p.PoslatiNaIzradu||"—"}</span>;
      case "MontazaIsporuka":  return p.MontazaIsporuka?<span style={{background:`${miColor(p.MontazaIsporuka)}18`,color:miColor(p.MontazaIsporuka),border:`1px solid ${miColor(p.MontazaIsporuka)}35`,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{p.MontazaIsporuka}</span>:<span style={{color:T.textSoft}}>—</span>;
      case "Placanje":         return <PlacanjeBadge val={p.Placanje}/>;
      case "StatusIzrade":     return <CheckBadge val={p.StatusIzrade}/>;
      case "StatusIsporuke":   return <CheckBadge val={p.StatusIsporuke}/>;
      case "StatusMontaze":    return <CheckBadge val={p.StatusMontaze}/>;
      case "SpecifikacijaCene":return <span style={{color:T.textMid,fontSize:12,display:"block",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.SpecifikacijaCene||"—"}</span>;
      case "Obracun":          return <span style={{fontWeight:600,color:T.green}}>{p.Obracun?`${parseFloat(p.Obracun).toLocaleString()} RSD`:"—"}</span>;
      case "ZavrsenPosao":     return onInlineZavrsen&&canEdit ? <InlineCheck val={p.ZavrsenPosao} onChange={v=>onInlineZavrsen(p.id,v)} disabled={false}/> : <CheckBadge val={p.ZavrsenPosao}/>;
      case "Fakturisano":      return <CheckBadge val={p.Fakturisano}/>;
      default:                 return <span style={{color:T.textMid}}>{String(p[key]??"—")}</span>;
    }
  }

  // Mobile card view
  if (isMobile) {
    return (
      <>
        <ctrl.Toolbar/>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {processed.length===0
            ? <div style={{textAlign:"center",color:T.textSoft,padding:40,fontFamily:T.fontBody}}>Nema zapisa</div>
            : processed.map(p=>(
              <div key={p.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}} onClick={()=>onView(p)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <span style={{color:T.primary,fontWeight:700,fontSize:15,fontFamily:T.fontHead}}>{p.Posao}</span>
                  <PlacanjeBadge val={p.Placanje}/>
                </div>
                <div style={{color:T.text,fontWeight:600,fontSize:14,marginBottom:3,fontFamily:T.fontBody}}>{p.KLIJENT}</div>
                <div style={{color:T.textSoft,fontSize:12,marginBottom:8}}>{p.Opis}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                  <CheckBadge val={p.ZavrsenPosao}/><CheckBadge val={p.StatusIzrade}/>
                </div>
                <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                  {canEdit
                    ? <><button onClick={()=>onEdit(p)} style={btnS("edit")}>Uredi</button><button onClick={()=>onDelete(p.id)} style={btnS("danger")}>Briši</button></>
                    : <button onClick={()=>onView(p)} style={btnS("ghost")}>Pregled</button>}
                </div>
              </div>
            ))
          }
        </div>
      </>
    );
  }

  // Filter cols by screen width priority
  const {width} = useBreakpoint();
  const activeCols = visibleCols.filter(col => {
    if (!col.priority) return true;
    if (col.priority===1) return true;
    if (col.priority===2) return width >= 900;
    if (col.priority===3) return width >= 1200;
    return false; // priority 4 = never auto-show
  });

  return (
    <>
      <ctrl.Toolbar/>
      <div style={{borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:T.surface,tableLayout:"fixed"}}>
          <colgroup>
            {activeCols.map(col=><col key={col.key} style={{width:col.w?`${col.w}px`:undefined}}/>)}
            <col style={{width:canEdit?"120px":"80px"}}/>
          </colgroup>
          <thead>
            <tr>
              {activeCols.map(col=>(
                <th key={col.key} {...ctrl.thDraggable(col)}>
                  <span style={{display:"flex",alignItems:"center",overflow:"hidden"}}>{col.label}<ctrl.SortIcon colKey={col.key}/></span>
                </th>
              ))}
              <th style={thS}></th>
            </tr>
          </thead>
          <tbody>
            {processed.length===0
              ? <tr><td colSpan={activeCols.length+1} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema zapisa</td></tr>
              : processed.map((p,i)=>(
                <tr key={p.id} style={{cursor:"pointer",background:i%2===0?T.surface:T.surfaceHover}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}
                  onDoubleClick={()=>onView(p)}>
                  {activeCols.map(col=>(
                    <td key={col.key} style={{...tdS,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:0}} onClick={col.key==="ZavrsenPosao"?e=>e.stopPropagation():undefined}>
                      {renderCell(p, col.key)}
                    </td>
                  ))}
                  <td style={{...tdS,whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",gap:5}}>
                      {canEdit
                        ? <><button onClick={()=>onEdit(p)} style={{...btnS("edit"),padding:"4px 9px",fontSize:11}}>Uredi</button><button onClick={()=>onDelete(p.id)} style={{...btnS("danger"),padding:"4px 9px",fontSize:11}}>Briši</button></>
                        : <button onClick={()=>onView(p)} style={{...btnS("ghost"),padding:"4px 9px",fontSize:11}}>Pregled</button>}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

function SimpleTable({rows, viewKey, columns, renderCell, emptyMsg="Nema zapisa"}) {
  const ctrl = useTableControls(viewKey, columns.map(c=>({key:c.key,label:c.label,visible:true})));
  const {isMobile} = useBreakpoint();
  const visibleCols = ctrl.cols.filter(c=>c.visible);
  const processed = ctrl.filterAndSort(rows);

  if (isMobile) {
    const firstCol = columns[0]?.key;
    const lastCol  = columns[columns.length-1]?.key;
    return (
      <>
        <ctrl.Toolbar/>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {processed.length===0
            ? <div style={{textAlign:"center",color:T.textSoft,padding:40,fontFamily:T.fontBody}}>{emptyMsg}</div>
            : processed.map(row=>(
              <div key={row.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"14px 16px",boxShadow:T.shadow}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div>{renderCell(row,firstCol)}</div>
                  <div>{renderCell(row,lastCol)}</div>
                </div>
                <div style={{color:T.text,fontWeight:600,fontSize:13,marginBottom:4}}>{renderCell(row,"KLIJENT")}</div>
                <div style={{color:T.textSoft,fontSize:12}}>{renderCell(row,"Opis")}</div>
              </div>
            ))
          }
        </div>
      </>
    );
  }

  return (
    <>
      <ctrl.Toolbar/>
      <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
        <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
          <thead><tr>
            {visibleCols.map(col=>(
              <th key={col.key} {...ctrl.thDraggable(col)}>
                <span style={{display:"flex",alignItems:"center"}}>{col.label}<ctrl.SortIcon colKey={col.key}/></span>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {processed.length===0
              ? <tr><td colSpan={visibleCols.length} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>{emptyMsg}</td></tr>
              : processed.map((row,i)=>(
                <tr key={row.id} style={{background:i%2===0?T.surface:T.surfaceHover}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                  {visibleCols.map(col=>(
                    <td key={col.key} style={tdS}>{renderCell(row,col.key)}</td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

const KUPCI_COLS_DEFAULT = [
  {key:"SifraKupca",label:"Šifra",visible:true},{key:"Naziv",label:"Naziv",visible:true},
  {key:"Grad",label:"Grad",visible:true},{key:"Ulica",label:"Ulica",visible:true},
  {key:"Broj",label:"Br.",visible:true},{key:"PostanskiBroj",label:"Poštanski",visible:true},
  {key:"Telefon",label:"Telefon",visible:true},{key:"PIB",label:"PIB",visible:true},
];

function KupciView({kupci, canEdit, onNew, onEdit, onDelete, onView}) {
  const ctrl = useTableControls("kupci", KUPCI_COLS_DEFAULT);
  const {isMobile} = useBreakpoint();
  const visibleCols = ctrl.cols.filter(c=>c.visible);
  const processed = ctrl.filterAndSort(kupci);
  return (
    <>
      <PageHeader title="Kupci" subtitle="Baza klijenata" action={canEdit&&<button onClick={onNew} style={btnS("primary")}>+ Novi kupac</button>}/>
      <ctrl.Toolbar/>
      {isMobile
        ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {processed.map(k=>(
              <div key={k.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"14px 16px"}} onClick={()=>onView(k)}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:T.primary,fontWeight:700,fontSize:13}}>{k.SifraKupca}</span>
                  <span style={{color:T.textSoft,fontSize:12}}>{k.Grad}</span>
                </div>
                <div style={{color:T.text,fontWeight:600,fontSize:14,marginBottom:6}}>{k.Naziv}</div>
                <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                  {canEdit
                    ? <><button onClick={()=>onEdit(k)} style={btnS("edit")}>Uredi</button><button onClick={()=>onDelete(k.id)} style={btnS("danger")}>Briši</button></>
                    : <button onClick={()=>onView(k)} style={btnS("ghost")}>Pregled</button>}
                </div>
              </div>
            ))}
          </div>
        : <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>
                {visibleCols.map(col=>(
                  <th key={col.key} {...ctrl.thDraggable(col)}>
                    <span style={{display:"flex",alignItems:"center"}}>{col.label}<ctrl.SortIcon colKey={col.key}/></span>
                  </th>
                ))}
                <th style={thS}></th>
              </tr></thead>
              <tbody>
                {processed.length===0
                  ? <tr><td colSpan={visibleCols.length+1} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema kupaca</td></tr>
                  : processed.map((k,i)=>(
                  <tr key={k.id} style={{background:i%2===0?T.surface:T.surfaceHover,cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}
                    onDoubleClick={()=>onView(k)}>
                    {visibleCols.map(col=>(
                      <td key={col.key} style={{...tdS,...(col.key==="SifraKupca"?{color:T.primary,fontWeight:700,fontSize:12}:col.key==="Naziv"?{fontWeight:500}:{color:T.textMid})}}>
                        {String(k[col.key]||"—")}
                      </td>
                    ))}
                    <td style={tdS} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:5}}>
                        {canEdit
                          ? <><button onClick={()=>onEdit(k)} style={btnS("edit")}>Uredi</button><button onClick={()=>onDelete(k.id)} style={btnS("danger")}>Briši</button></>
                          : <button onClick={()=>onView(k)} style={btnS("ghost")}>Pregled</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </>
  );
}

// ── LOGIN + 2FA ───────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [step,setStep]       = useState("login"); // "login" | "totp"
  const [email,setEmail]     = useState("");
  const [password,setPassword] = useState("");
  const [totpCode,setTotpCode] = useState("");
  const [error,setError]     = useState("");
  const [showPw,setShowPw]   = useState(false);
  const [loading,setLoading] = useState(false);
  const [mfaSession,setMfaSession] = useState(null); // stores factorId for verify step

  async function handleLogin() {
    setLoading(true); setError("");
    const {data,error:e} = await sb.auth.signInWithPassword({email,password});
    if (e) { setError(e.message); setLoading(false); return; }

    // Check if user has MFA enrolled
    const {data: aal} = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      // MFA required — get the factor to challenge
      const {data: factors} = await sb.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        const {data: challenge, error: ce} = await sb.auth.mfa.challenge({factorId: totp.id});
        if (ce) { setError(ce.message); setLoading(false); return; }
        setMfaSession({factorId: totp.id, challengeId: challenge.id});
        setStep("totp");
        setLoading(false);
        return;
      }
    }
    onLogin(data.user);
  }

  async function handleTotp() {
    setLoading(true); setError("");
    const {data, error:e} = await sb.auth.mfa.verify({
      factorId: mfaSession.factorId,
      challengeId: mfaSession.challengeId,
      code: totpCode.replace(/\s/g,""),
    });
    if (e) { setError("Neispravan kod: "+e.message); setLoading(false); return; }
    onLogin(data.user);
  }

  const inp = {width:"100%",background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"11px 14px",color:T.text,fontSize:14,fontFamily:T.fontBody,boxSizing:"border-box",outline:"none",colorScheme:"dark"};

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0D1117 0%,#111827 50%,#0F172A 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.fontBody,padding:"16px"}}>
      <div style={{position:"fixed",top:-120,right:-120,width:400,height:400,background:"radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:-80,left:-80,width:300,height:300,background:"radial-gradient(circle,rgba(167,139,250,0.14) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{background:T.surface,borderRadius:T.radiusLg,padding:"36px 32px",width:"100%",maxWidth:400,boxShadow:T.shadowLg,border:`1px solid ${T.border}`,position:"relative"}}>
        <div style={{marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,borderRadius:T.radius,padding:"6px 12px",marginBottom:16}}>
            <div style={{width:7,height:7,background:T.primary,borderRadius:"50%"}}/>
            <span style={{color:T.primary,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Poslovi App</span>
          </div>
          <h1 style={{fontFamily:T.fontHead,fontSize:24,fontWeight:800,color:T.text,margin:"0 0 5px",letterSpacing:"-0.04em"}}>
            {step==="totp" ? "Dvofaktorska autentikacija" : "Dobrodošli nazad"}
          </h1>
          <p style={{color:T.textSoft,fontSize:13,margin:0}}>
            {step==="totp" ? "Unesite 6-cifreni kod iz aplikacije" : "Prijavite se na svoj nalog"}
          </p>
        </div>

        {step==="login" && <>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4}}>Email adresa</label>
            <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={inp} placeholder="vas@email.com"/>
          </div>
          <div style={{marginBottom:22}}>
            <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4}}>Lozinka</label>
            <div style={{position:"relative"}}>
              <input type={showPw?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{...inp,paddingRight:42}}/>
              <button onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.textSoft,cursor:"pointer",fontSize:15}}>{showPw?"🙈":"👁"}</button>
            </div>
          </div>
          <ErrBanner msg={error}/>
          <button onClick={handleLogin} disabled={loading} style={{...btnS("primary"),width:"100%",padding:"12px",fontSize:14,opacity:loading?0.6:1}}>
            {loading?"Prijavljivanje...":"Prijavi se →"}
          </button>
        </>}

        {step==="totp" && <>
          <div style={{background:T.amberBg,border:`1px solid ${T.amberBorder}`,borderRadius:T.radiusSm,padding:"12px 14px",marginBottom:20,color:T.amber,fontSize:13,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:18}}>🔐</span>
            <span>Otvorite vašu autentikator aplikaciju (Google Authenticator, Authy...) i unesite prikazani kod.</span>
          </div>
          <div style={{marginBottom:22}}>
            <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4}}>Kod (6 cifara)</label>
            <input type="text" inputMode="numeric" maxLength={6} value={totpCode}
              onChange={e=>{setTotpCode(e.target.value.replace(/\D/g,""));setError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleTotp()}
              placeholder="123456"
              style={{...inp,fontSize:22,letterSpacing:"0.3em",textAlign:"center",fontFamily:"monospace"}}
              autoFocus/>
          </div>
          <ErrBanner msg={error}/>
          <button onClick={handleTotp} disabled={loading||totpCode.length<6} style={{...btnS("primary"),width:"100%",padding:"12px",fontSize:14,opacity:(loading||totpCode.length<6)?0.6:1}}>
            {loading?"Proveravanje...":"Potvrdi kod →"}
          </button>
          <button onClick={()=>{setStep("login");setTotpCode("");setError("");}} style={{...btnS("ghost"),width:"100%",padding:"10px",fontSize:13,marginTop:8}}>
            ← Nazad na prijavu
          </button>
        </>}
      </div>
    </div>
  );
}

// ── 2FA SETTINGS PANEL ────────────────────────────────────────────────────────
function TwoFAPanel({onClose}) {
  const [status,setStatus]   = useState("loading"); // loading | none | enrolled | setup
  const [qr,setQr]           = useState("");
  const [secret,setSecret]   = useState("");
  const [factorId,setFactorId] = useState(null);
  const [code,setCode]       = useState("");
  const [error,setError]     = useState("");
  const [saving,setSaving]   = useState(false);
  const [success,setSuccess] = useState("");

  useEffect(()=>{ checkStatus(); },[]);

  async function checkStatus() {
    const {data} = await sb.auth.mfa.listFactors();
    const totp = data?.totp?.[0];
    if (totp && totp.status==="verified") { setFactorId(totp.id); setStatus("enrolled"); }
    else setStatus("none");
  }

  async function startSetup() {
    setError(""); setSaving(true);
    const {data,error:e} = await sb.auth.mfa.enroll({factorType:"totp"});
    setSaving(false);
    if (e) { setError(e.message); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStatus("setup");
  }

  async function verifySetup() {
    setError(""); setSaving(true);
    const {data:ch, error:ce} = await sb.auth.mfa.challenge({factorId});
    if (ce) { setError(ce.message); setSaving(false); return; }
    const {error:ve} = await sb.auth.mfa.verify({factorId, challengeId:ch.id, code:code.replace(/\s/g,"")});
    setSaving(false);
    if (ve) { setError("Neispravan kod — pokušajte ponovo."); return; }
    setSuccess("2FA je uspešno aktiviran! ✓");
    setStatus("enrolled");
  }

  async function unenroll() {
    if (!window.confirm("Da li ste sigurni da želite da isključite 2FA?")) return;
    setSaving(true);
    const {error:e} = await sb.auth.mfa.unenroll({factorId});
    setSaving(false);
    if (e) { setError(e.message); return; }
    setStatus("none"); setFactorId(null); setSuccess("2FA je isključen.");
  }

  const inp = {width:"100%",background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"10px 12px",color:T.text,fontSize:16,fontFamily:"monospace",boxSizing:"border-box",outline:"none",colorScheme:"dark",letterSpacing:"0.2em",textAlign:"center"};

  return (
    <Modal title="Dvofaktorska autentikacija (2FA)" onClose={onClose}>
      <ErrBanner msg={error} onDismiss={()=>setError("")}/>
      {success && <div style={{background:T.greenBg,border:`1px solid ${T.greenBorder}`,borderRadius:T.radiusSm,padding:"10px 14px",color:T.green,fontSize:13,marginBottom:16}}>{success}</div>}

      {status==="loading" && <Spinner text="Provera statusa..."/>}

      {status==="none" && (
        <div style={{textAlign:"center",padding:"10px 0"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔓</div>
          <div style={{color:T.text,fontSize:15,fontWeight:600,marginBottom:8,fontFamily:T.fontHead}}>2FA nije aktivan</div>
          <div style={{color:T.textSoft,fontSize:13,marginBottom:24,lineHeight:1.6}}>Dodajte dodatni sloj zaštite. Koristite Google Authenticator, Authy ili drugu TOTP aplikaciju.</div>
          <button onClick={startSetup} disabled={saving} style={{...btnS("primary"),padding:"11px 28px",fontSize:14}}>
            {saving?"Generisanje...":"Aktiviraj 2FA"}
          </button>
        </div>
      )}

      {status==="setup" && (
        <div>
          <div style={{color:T.textMid,fontSize:13,marginBottom:16,lineHeight:1.6}}>
            <strong style={{color:T.text}}>Korak 1:</strong> Skenirajte QR kod u vašoj autentikator aplikaciji.
          </div>
          {qr && (
            <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
              <div style={{background:"#fff",padding:12,borderRadius:T.radius}}>
                <img src={qr} alt="QR kod" style={{width:180,height:180,display:"block"}}/>
              </div>
            </div>
          )}
          {secret && (
            <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"10px 14px",marginBottom:16,textAlign:"center"}}>
              <div style={{color:T.textSoft,fontSize:11,marginBottom:4}}>Ili unesite ručno:</div>
              <div style={{color:T.primary,fontFamily:"monospace",fontSize:13,letterSpacing:"0.1em",wordBreak:"break-all"}}>{secret}</div>
            </div>
          )}
          <div style={{color:T.textMid,fontSize:13,marginBottom:10,lineHeight:1.6}}>
            <strong style={{color:T.text}}>Korak 2:</strong> Unesite 6-cifreni kod iz aplikacije.
          </div>
          <input type="text" inputMode="numeric" maxLength={6} value={code}
            onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="123456" style={inp} autoFocus/>
          <div style={{display:"flex",gap:10,marginTop:18}}>
            <button onClick={()=>setStatus("none")} style={btnS("ghost")}>Otkaži</button>
            <button onClick={verifySetup} disabled={saving||code.length<6} style={{...btnS("primary"),flex:1,opacity:(saving||code.length<6)?0.6:1}}>
              {saving?"Verifikacija...":"Potvrdi i aktiviraj"}
            </button>
          </div>
        </div>
      )}

      {status==="enrolled" && (
        <div style={{textAlign:"center",padding:"10px 0"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔐</div>
          <div style={{color:T.green,fontSize:15,fontWeight:600,marginBottom:8,fontFamily:T.fontHead}}>2FA je aktivan</div>
          <div style={{color:T.textSoft,fontSize:13,marginBottom:24,lineHeight:1.6}}>Vaš nalog je zaštićen dvofaktorskom autentikacijom.</div>
          <button onClick={unenroll} disabled={saving} style={{...btnS("danger"),padding:"9px 22px"}}>
            {saving?"Isključivanje...":"Isključi 2FA"}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authUser,setAuthUser]       = useState(null);
  const [profile,setProfile]         = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [view,setView]               = useState("aktivni");
  const [poslovi,setPoslovi]         = useState([]);
  const [kupci,setKupci]             = useState([]);
  const [izradaOptions,setIzradaOptions] = useState([]);
  const [users,setUsers]             = useState([]);
  const [loading,setLoading]         = useState(false);
  const [globalErr,setGlobalErr]     = useState("");
  const [show2FA,setShow2FA]         = useState(false);
  const [navOpen,setNavOpen]         = useState(false);

  const [editingPosao,setEditingPosao] = useState(null);
  const [viewingPosao,setViewingPosao] = useState(null);
  const [editingKupac,setEditingKupac] = useState(null);
  const [viewingKupac,setViewingKupac] = useState(null);
  const [editingUser,setEditingUser]   = useState(null);
  const [newPosao,setNewPosao] = useState(false);
  const [newKupac,setNewKupac] = useState(false);
  const [tempData,setTempData] = useState({});
  const [tempErrors,setTempErrors] = useState({});
  const [confirmDelete,setConfirmDelete] = useState(null);
  const [saving,setSaving] = useState(false);

  const {isMobile, isTablet} = useBreakpoint();

  useEffect(()=>{
    sb.auth.getSession().then(({data:{session}})=>{
      if (session?.user) { setAuthUser(session.user); loadProfile(session.user.id); }
      else setAuthLoading(false);
    });
    const {data:{subscription}} = sb.auth.onAuthStateChange((_e,session)=>{
      if (session?.user) { setAuthUser(session.user); loadProfile(session.user.id); }
      else { setAuthUser(null); setProfile(null); setAuthLoading(false); }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  async function loadProfile(uid) {
    const {data} = await sb.from("profiles").select("*").eq("id",uid).single();
    setProfile(data);
    setAuthLoading(false);
  }

  const loadPoslovi = useCallback(async()=>{
    const {data,error} = await sb.from("poslovi").select("*").order("posao_num");
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    setPoslovi((data||[]).map(dbToApp));
  },[]);

  const loadKupci = useCallback(async()=>{
    const {data,error} = await sb.from("kupci").select("*").order("naziv");
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    setKupci((data||[]).map(dbKupacToApp));
  },[]);

  const loadIzradaOptions = useCallback(async()=>{
    const {data} = await sb.from("izrada_opcije").select("*").order("id");
    setIzradaOptions(data||[]);
  },[]);

  const loadUsers = useCallback(async()=>{
    const {data} = await sb.from("profiles").select("*");
    if (data) setUsers(data);
  },[]);

  useEffect(()=>{
    if (!profile) return;
    setLoading(true);
    Promise.all([loadPoslovi(), loadKupci(), loadIzradaOptions(), loadUsers()])
      .finally(()=>setLoading(false));
  },[profile]);

  const aktivniRows   = useMemo(()=>poslovi.filter(p=>!p.ZavrsenPosao),[poslovi]);
  const zavrseniRows  = useMemo(()=>poslovi.filter(p=>p.ZavrsenPosao),[poslovi]);
  const montazaRows   = useMemo(()=>poslovi.filter(p=>p.MontazaIsporuka==="Montaža i isporuka"),[poslovi]);
  const isporukaRows  = useMemo(()=>poslovi.filter(p=>p.MontazaIsporuka==="Samo isporuka"||p.MontazaIsporuka==="Montaža i isporuka"),[poslovi]);
  const knjigenjeRows = useMemo(()=>poslovi.filter(p=>p.ZavrsenPosao&&p.Placanje==="Faktura"),[poslovi]);
  const obracunSums   = useMemo(()=>{ const s={}; poslovi.forEach(p=>{ const k=p.Placanje||"—"; s[k]=(s[k]||0)+(parseFloat(p.Obracun)||0); }); return s; },[poslovi]);

  const perm    = tab => profile?.tab_permissions?.[tab]||"none";
  const canSee  = tab => perm(tab)!=="none";
  const canEdit = tab => perm(tab)==="edit";
  const tf = k => v => setTempData(d=>({...d,[k]:v}));

  async function inlineUpdate(id, appField, value) {
    const fieldMap = { StatusIzrade:"status_izrade", StatusIsporuke:"status_isporuke", StatusMontaze:"status_montaze", Fakturisano:"fakturisano", ZavrsenPosao:"zavrsen_posao" };
    const dbField = fieldMap[appField];
    if (!dbField) return;
    setPoslovi(ps=>ps.map(p=>p.id===id?{...p,[appField]:value}:p));
    const {error} = await sb.from("poslovi").update({[dbField]:value}).eq("id",id);
    if (error) { setGlobalErr("Greška: "+error.message); loadPoslovi(); }
  }

  function openEditPosao(p) { setEditingPosao(p.id); setTempData({...p}); setTempErrors({}); }
  async function openNewPosao() {
    const {data} = await sb.from("poslovi").select("posao_num").order("posao_num",{ascending:false}).limit(1);
    const n = data&&data.length>0 ? data[0].posao_num+1 : 1;
    const defaultUnosilac = profile ? `${profile.ime||""} ${profile.prezime||""}`.trim() : "";
    setNewPosao(true);
    setTempData({posaoNum:n,Posao:formatPosaoNumber(n),KLIJENT:"",SifraKupca:"",DatumUnosa:todayISO(),RokZaIsporuku:"",Unosilac:defaultUnosilac,Opis:"",PoslatiNaIzradu:"",MontazaIsporuka:"",Placanje:"Faktura",StatusIzrade:false,StatusIsporuke:false,StatusMontaze:false,SpecifikacijaCene:"",Obracun:"",ZavrsenPosao:false,Fakturisano:false});
    setTempErrors({});
  }
  async function savePosao() {
    setSaving(true);
    const row = appToDB(tempData);
    let error;
    if (newPosao) { ({error} = await sb.from("poslovi").insert([row])); }
    else          { ({error} = await sb.from("poslovi").update(row).eq("id",editingPosao)); }
    setSaving(false);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    await loadPoslovi(); closeModal();
  }
  async function deletePosao(id) {
    const {error} = await sb.from("poslovi").delete().eq("id",id);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    setPoslovi(ps=>ps.filter(p=>p.id!==id)); setConfirmDelete(null);
  }

  function openEditKupac(k) { setEditingKupac(k.id); setTempData({...k}); setTempErrors({}); }
  async function openNewKupac() {
    const {data} = await sb.from("kupci").select("sifra_kupca").like("sifra_kupca","K%");
    let maxNum = 0;
    (data||[]).forEach(row => { const num=parseInt((row.sifra_kupca||"").replace(/\D/g,"")); if(!isNaN(num)&&num>maxNum) maxNum=num; });
    setNewKupac(true);
    setTempData({SifraKupca:formatSifraKupca(maxNum+1),Naziv:"",Grad:"",Ulica:"",Broj:"",PostanskiBroj:"",Telefon:"",PIB:""});
    setTempErrors({});
  }
  async function saveKupac() {
    setSaving(true);
    const row = appKupacToDB(tempData);
    let error;
    if (newKupac) { ({error} = await sb.from("kupci").insert([row])); }
    else          { ({error} = await sb.from("kupci").update(row).eq("id",editingKupac)); }
    setSaving(false);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    await loadKupci(); closeModal();
  }
  async function deleteKupac(id) {
    const {error} = await sb.from("kupci").delete().eq("id",id);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    setKupci(ks=>ks.filter(k=>k.id!==id)); setConfirmDelete(null);
  }

  function openEditUser(u) { setEditingUser(u.id); setTempData({...u}); setTempErrors({}); }
  async function saveUser() {
    const e={};
    if (!tempData.ime?.trim()) e.ime="Obavezno.";
    if (!tempData.prezime?.trim()) e.prezime="Obavezno.";
    if (Object.keys(e).length) { setTempErrors(e); return; }
    setSaving(true);
    const row={ime:tempData.ime,prezime:tempData.prezime,telefon:tempData.telefon,adresa:tempData.adresa,is_admin:tempData.is_admin||false,tab_permissions:tempData.tab_permissions||{}};
    const {error} = await sb.from("profiles").update(row).eq("id",editingUser);
    setSaving(false);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    await loadUsers(); closeModal();
  }

  async function confirmDeleteAction() {
    if (confirmDelete.type==="posao") await deletePosao(confirmDelete.id);
    else if (confirmDelete.type==="kupac") await deleteKupac(confirmDelete.id);
    setConfirmDelete(null);
  }

  function closeModal() {
    setEditingPosao(null);setViewingPosao(null);setEditingKupac(null);setViewingKupac(null);
    setEditingUser(null);setNewPosao(false);setNewKupac(false);setTempData({});setTempErrors({});
  }

  async function handleLogout() { await sb.auth.signOut(); setAuthUser(null); setProfile(null); }

  if (authLoading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Spinner text="Provera sesije..."/>
    </div>
  );
  if (!authUser||!profile) return <LoginScreen onLogin={u=>{setAuthUser(u);loadProfile(u.id);}}/>;

  const visibleTabs = ALL_TABS.filter(t=>canSee(t.key));

  const df = (lbl,val,accent) => (
    <div key={lbl} style={{marginBottom:16}}>
      <div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3,fontFamily:T.fontBody}}>{lbl}</div>
      <div style={{color:accent||T.text,fontSize:14,fontWeight:accent?600:400,fontFamily:T.fontBody}}>{val||"—"}</div>
    </div>
  );
  const divider = lbl => (
    <div style={{gridColumn:"1/-1",borderTop:`1px solid ${T.border}`,paddingTop:16,marginBottom:4}}>
      <div style={{color:T.primary,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>{lbl}</div>
    </div>
  );

  const PosaoForm = () => (
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
      <Field label="Posao (automatski)" value={tempData.Posao} onChange={()=>{}} readOnly/>
      <DateField label="Datum unosa" value={tempData.DatumUnosa} onChange={tf("DatumUnosa")} readOnly={!!newPosao}/>
      <KupacSearchField label="Klijent" sifra={tempData.SifraKupca} naziv={tempData.KLIJENT} kupci={kupci} onChange={k=>setTempData(d=>({...d,SifraKupca:k.SifraKupca,KLIJENT:k.Naziv}))}/>
      <DateField label="Rok za isporuku" value={tempData.RokZaIsporuku} onChange={tf("RokZaIsporuku")}/>
      <UserSearchField label="Unosilac posla" value={tempData.Unosilac} onChange={tf("Unosilac")} users={users}/>
      <div style={{gridColumn:isMobile?"1":"1/-1"}}><Field label="Opis" value={tempData.Opis} onChange={tf("Opis")}/></div>
      <div style={{gridColumn:isMobile?"1":"1/-1"}}><Field label="Specifikacija cene" value={tempData.SpecifikacijaCene} onChange={tf("SpecifikacijaCene")}/></div>
      <Field label="Obračun (RSD)" value={tempData.Obracun} onChange={tf("Obracun")} type="number"/>
      <Field label="Poslati na izradu" value={tempData.PoslatiNaIzradu} onChange={tf("PoslatiNaIzradu")} options={izradaOptions.map(o=>o.naziv)}/>
      <RadioGroup label="Montaža / Isporuka" value={tempData.MontazaIsporuka} onChange={tf("MontazaIsporuka")} options={montazaIsporukaOptions}/>
      <RadioGroup label="Plaćanje" value={tempData.Placanje} onChange={tf("Placanje")} options={placanjeOptions}/>
      <div style={{gridColumn:isMobile?"1":"1/-1",display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:"0 16px",marginTop:4}}>
        <CheckField label="Završen posao" value={tempData.ZavrsenPosao} onChange={tf("ZavrsenPosao")}/>
        {[["Status izrade",tempData.StatusIzrade,"Radionica"],["Status isporuke",tempData.StatusIsporuke,"Isporuka"],["Status montaže",tempData.StatusMontaze,"Montaža"],["Fakturisano",tempData.Fakturisano,"Knjiženje"]].map(([lbl,val,vn])=>(
          <div key={lbl} style={{marginBottom:14}}>
            <label style={{display:"block",color:T.textSoft,fontSize:12,fontWeight:500,marginBottom:6,fontFamily:T.fontBody}}>{lbl}</label>
            <CheckBadge val={val}/>
            <div style={{color:T.textSoft,fontSize:10,marginTop:5,fontFamily:T.fontBody}}>→ <span style={{color:T.primary,fontWeight:600}}>{vn}</span></div>
          </div>
        ))}
      </div>
    </div>
  );

  const simpleCols = (cols) => cols.map(([key,label]) => ({key,label}));
  const simpleRender = (extraKey, extraRender) => (p,key) => {
    if (key==="Posao") return <span style={{color:T.primary,fontWeight:700}}>{p.Posao}</span>;
    if (key==="KLIJENT") return <span style={{fontWeight:500}}>{p.KLIJENT}</span>;
    if (key==="SifraKupca") return <span style={{color:T.textSoft,fontSize:12}}>{p.SifraKupca}</span>;
    if (key==="DatumUnosa") return <span style={{color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</span>;
    if (key==="RokZaIsporuku") return <span style={{color:isOverdue(p.RokZaIsporuku)?T.red:T.textMid,fontSize:12,fontWeight:isOverdue(p.RokZaIsporuku)?600:400}}>{fmtDate(p.RokZaIsporuku)}</span>;
    if (key==="Unosilac") return <span style={{color:T.textMid}}>{p.Unosilac}</span>;
    if (key==="Opis") return <span style={{color:T.textMid,display:"block",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.Opis}</span>;
    if (key===extraKey) return extraRender(p);
    return <span style={{color:T.textMid}}>{String(p[key]??"—")}</span>;
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.fontBody}}>

      {/* NAVBAR */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1700,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",height:54,gap:12}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{width:26,height:26,background:T.primary,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:9,height:9,background:"#fff",borderRadius:2,transform:"rotate(45deg)"}}/>
            </div>
            {!isMobile && <span style={{fontFamily:T.fontHead,fontSize:15,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Poslovi</span>}
          </div>

          {/* Desktop nav */}
          {!isMobile && (
            <nav style={{display:"flex",gap:1,flex:1,overflowX:"auto"}}>
              {visibleTabs.map(t=>(
                <button key={t.key} onClick={()=>setView(t.key)} style={{
                  background:view===t.key?T.primaryLight:"none",border:"none",
                  color:view===t.key?T.primary:T.textSoft,borderRadius:T.radiusSm,
                  padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:view===t.key?600:400,
                  transition:"all 0.15s",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",fontFamily:T.fontBody,
                }}>
                  <span>{t.icon}</span>{!isTablet && t.label}
                </button>
              ))}
            </nav>
          )}

          {isMobile && <div style={{flex:1}}/>}

          {/* User + 2FA + Logout */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {!isMobile && (
              <>
                <div style={{width:28,height:28,borderRadius:"50%",background:T.primaryLight,border:`2px solid ${T.primaryBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:T.primary}}>
                  {(profile.ime||"?")[0]}{(profile.prezime||"")[0]}
                </div>
                <div style={{lineHeight:1.3}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.text}}>{profile.ime} {profile.prezime}</div>
                  <div style={{fontSize:10,color:T.textSoft}}>{profile.is_admin?"Admin":"Korisnik"}</div>
                </div>
              </>
            )}
            <button onClick={()=>setShow2FA(true)} title="2FA podešavanja" style={{...btnS("ghost"),padding:"5px 9px",fontSize:12}}>🔐</button>
            <button onClick={handleLogout} style={{...btnS("ghost"),padding:"5px 9px",fontSize:11}}>↩</button>
            {isMobile && (
              <button onClick={()=>setNavOpen(v=>!v)} style={{...btnS("ghost"),padding:"5px 10px",fontSize:16}}>☰</button>
            )}
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {isMobile && navOpen && (
          <div style={{background:T.surface,borderTop:`1px solid ${T.border}`,padding:"8px 0",maxHeight:"60vh",overflowY:"auto"}}>
            {visibleTabs.map(t=>(
              <button key={t.key} onClick={()=>{setView(t.key);setNavOpen(false);}} style={{
                display:"flex",alignItems:"center",gap:10,width:"100%",background:view===t.key?T.primaryLight:"none",
                border:"none",color:view===t.key?T.primary:T.textMid,padding:"12px 20px",
                cursor:"pointer",fontSize:14,fontWeight:view===t.key?600:400,fontFamily:T.fontBody,textAlign:"left",
              }}>
                <span style={{fontSize:16}}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{maxWidth:1700,margin:"0 auto",padding:isMobile?"14px 12px":"22px 20px"}}>
        <ErrBanner msg={globalErr} onDismiss={()=>setGlobalErr("")}/>
        {loading && <Spinner/>}

        {!loading && <>

        {view==="poslovi" && <>
          <PageHeader title="Svi poslovi"/>
          <PosaoTable rows={poslovi} viewKey="poslovi" canEdit={canEdit("poslovi")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})}/>
        </>}

        {view==="aktivni" && <>
          <PageHeader title="Aktivni poslovi" subtitle="Završen posao = Ne"
            action={canEdit("aktivni")&&<button onClick={openNewPosao} style={btnS("primary")}>+ Novi posao</button>}/>
          <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
            <StatCard label="Aktivnih" value={aktivniRows.length} color={T.amber}/>
            <StatCard label="Ukupan obračun" value={aktivniRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.green}/>
          </div>
          <PosaoTable rows={aktivniRows} viewKey="aktivni" canEdit={canEdit("aktivni")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})}
            onInlineZavrsen={canEdit("aktivni")?(id,v)=>inlineUpdate(id,"ZavrsenPosao",v):null}/>
        </>}

        {view==="zavrseni" && <>
          <PageHeader title="Završeni poslovi"/>
          <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
            <StatCard label="Završenih" value={zavrseniRows.length} color={T.green}/>
            <StatCard label="Ukupan obračun" value={zavrseniRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.primary}/>
          </div>
          <PosaoTable rows={zavrseniRows} viewKey="zavrseni" canEdit={canEdit("zavrseni")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})}/>
        </>}

        {view==="radionica" && <>
          <PageHeader title="Radionica" subtitle="Status izrade se menja samo ovde"/>
          <SimpleTable rows={poslovi} viewKey="radionica"
            columns={simpleCols([["Posao","Posao"],["KLIJENT","Klijent"],["SifraKupca","Šifra"],["DatumUnosa","Datum"],["RokZaIsporuku","Rok"],["Unosilac","Unosilac"],["Opis","Opis"],["StatusIzrade","Status izrade"]])}
            renderCell={simpleRender("StatusIzrade",p=><InlineCheck val={p.StatusIzrade} onChange={v=>canEdit("radionica")&&inlineUpdate(p.id,"StatusIzrade",v)} disabled={!canEdit("radionica")}/>)}/>
        </>}

        {view==="montaza" && <>
          <PageHeader title="Montaža" subtitle="Status montaže se menja samo ovde"/>
          <SimpleTable rows={montazaRows} viewKey="montaza"
            columns={simpleCols([["Posao","Posao"],["KLIJENT","Klijent"],["SifraKupca","Šifra"],["DatumUnosa","Datum"],["RokZaIsporuku","Rok"],["Unosilac","Unosilac"],["Opis","Opis"],["StatusMontaze","Status montaže"]])}
            renderCell={simpleRender("StatusMontaze",p=><InlineCheck val={p.StatusMontaze} onChange={v=>canEdit("montaza")&&inlineUpdate(p.id,"StatusMontaze",v)} disabled={!canEdit("montaza")}/>)}/>
        </>}

        {view==="isporuka" && <>
          <PageHeader title="Isporuka" subtitle="Status isporuke se menja samo ovde"/>
          <SimpleTable rows={isporukaRows} viewKey="isporuka"
            columns={simpleCols([["Posao","Posao"],["KLIJENT","Klijent"],["SifraKupca","Šifra"],["DatumUnosa","Datum"],["RokZaIsporuku","Rok"],["Unosilac","Unosilac"],["Opis","Opis"],["StatusIsporuke","Status isporuke"]])}
            renderCell={simpleRender("StatusIsporuke",p=><InlineCheck val={p.StatusIsporuke} onChange={v=>canEdit("isporuka")&&inlineUpdate(p.id,"StatusIsporuke",v)} disabled={!canEdit("isporuka")}/>)}/>
        </>}

        {view==="knjizenje" && <>
          <PageHeader title="Knjiženje" subtitle="Završeni · Faktura · Fakturisano se menja ovde"/>
          <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
            <StatCard label="Za knjiženje" value={knjigenjeRows.length} color={T.primary}/>
            <StatCard label="Fakturisano" value={knjigenjeRows.filter(p=>p.Fakturisano).length} color={T.green}/>
            <StatCard label="Nije fakt." value={knjigenjeRows.filter(p=>!p.Fakturisano).length} color={T.amber}/>
            <StatCard label="Ukupan obračun" value={knjigenjeRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.textMid}/>
          </div>
          <SimpleTable rows={knjigenjeRows} viewKey="knjizenje"
            columns={simpleCols([["Posao","Posao"],["KLIJENT","Klijent"],["SifraKupca","Šifra"],["DatumUnosa","Datum"],["Opis","Opis"],["SpecifikacijaCene","Specifikacija"],["Obracun","Obračun"],["Fakturisano","Fakturisano"]])}
            renderCell={(p,key)=>{
              if (key==="Posao") return <span style={{color:T.primary,fontWeight:700}}>{p.Posao}</span>;
              if (key==="KLIJENT") return <span style={{fontWeight:500}}>{p.KLIJENT}</span>;
              if (key==="SifraKupca") return <span style={{color:T.textSoft,fontSize:12}}>{p.SifraKupca}</span>;
              if (key==="DatumUnosa") return <span style={{color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</span>;
              if (key==="Opis") return <span style={{color:T.textMid,display:"block",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.Opis}</span>;
              if (key==="SpecifikacijaCene") return <span style={{color:T.textMid,fontSize:12,display:"block",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.SpecifikacijaCene||"—"}</span>;
              if (key==="Obracun") return <span style={{fontWeight:700,color:T.green}}>{p.Obracun?`${parseFloat(p.Obracun).toLocaleString()} RSD`:"—"}</span>;
              if (key==="Fakturisano") return <InlineCheck val={p.Fakturisano} onChange={v=>canEdit("knjizenje")&&inlineUpdate(p.id,"Fakturisano",v)} disabled={!canEdit("knjizenje")}/>;
              return <span style={{color:T.textMid}}>{String(p[key]??"—")}</span>;
            }}/>
        </>}

        {view==="kupci" && <KupciView kupci={kupci} canEdit={canEdit("kupci")} onNew={openNewKupac} onEdit={openEditKupac} onDelete={id=>setConfirmDelete({type:"kupac",id})} onView={setViewingKupac}/>}

        {view==="obracun" && <>
          <PageHeader title="Obračun po načinu plaćanja"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:22}}>
            {Object.entries(obracunSums).map(([nacin,suma])=>(
              <StatCard key={nacin} label={nacin} value={suma.toLocaleString()+" RSD"} color={placanjeColor(nacin)} sub={`${poslovi.filter(p=>p.Placanje===nacin).length} poslova`}/>
            ))}
          </div>
          <div style={{background:T.surface,borderRadius:T.radius,border:`1px solid ${T.border}`,overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Plaćanje","Broj poslova","Ukupan obračun"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(obracunSums).map(([nacin,suma],i)=>(
                  <tr key={nacin} style={{background:i%2===0?T.surface:T.surfaceHover}}>
                    <td style={{...tdS,fontWeight:600}}><PlacanjeBadge val={nacin}/></td>
                    <td style={{...tdS,color:T.textMid}}>{poslovi.filter(p=>p.Placanje===nacin).length}</td>
                    <td style={{...tdS,color:T.green,fontWeight:700}}>{suma.toLocaleString()} RSD</td>
                  </tr>
                ))}
                <tr style={{borderTop:`2px solid ${T.border}`,background:T.surfaceRaised}}>
                  <td style={{...tdS,fontWeight:700,color:T.text}}>UKUPNO</td>
                  <td style={{...tdS,fontWeight:700,color:T.textMid}}>{poslovi.length}</td>
                  <td style={{...tdS,color:T.primary,fontWeight:800,fontSize:16,fontFamily:T.fontHead}}>{Object.values(obracunSums).reduce((a,b)=>a+b,0).toLocaleString()} RSD</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>}

        {view==="korisnici" && <>
          <PageHeader title="Korisnici"/>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>{["Ime","Prezime","Telefon","Adresa","Rola","Dozvole",...(profile.is_admin?[""]:[])].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map((u,i)=>(
                  <tr key={u.id} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,fontWeight:600}}>{u.ime}</td>
                    <td style={tdS}>{u.prezime}</td>
                    <td style={{...tdS,color:T.textMid}}>{u.telefon}</td>
                    <td style={{...tdS,color:T.textMid,fontSize:12}}>{u.adresa}</td>
                    <td style={tdS}>{u.is_admin?<span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600}}>Admin</span>:<span style={{background:T.surfaceRaised,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600}}>Korisnik</span>}</td>
                    <td style={tdS}><div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {ALL_TABS.map(t=>{const p=u.tab_permissions?.[t.key];if(!p||p==="none")return null;
                        return <span key={t.key} style={{background:p==="edit"?T.greenBg:T.amberBg,color:p==="edit"?T.green:T.amber,border:`1px solid ${p==="edit"?T.greenBorder:T.amberBorder}`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:600}}>{t.label}</span>;
                      })}
                    </div></td>
                    {profile.is_admin&&<td style={tdS} onClick={e=>e.stopPropagation()}><button onClick={()=>openEditUser(u)} style={btnS("edit")}>Uredi dozvole</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12,padding:"12px 16px",background:T.amberBg,border:`1px solid ${T.amberBorder}`,borderRadius:T.radiusSm,color:T.amber,fontSize:12}}>
            💡 Novi korisnici se kreiraju u <strong>Supabase → Authentication → Add user</strong>.
          </div>
        </>}

        </>}
      </div>

      {/* MODALS */}
      {(editingPosao||newPosao) && (
        <Modal title={newPosao?`Novi posao — ${tempData.Posao}`:`Uredi: ${tempData.Posao}`} onClose={closeModal} wide>
          <PosaoForm/>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16,flexWrap:"wrap"}}>
            <button onClick={closeModal} style={btnS("ghost")}>Otkaži</button>
            <button onClick={savePosao} disabled={saving} style={{...btnS("primary"),opacity:saving?0.6:1}}>{saving?"Snima...":"Sačuvaj"}</button>
          </div>
        </Modal>
      )}

      {viewingPosao && (
        <Modal title={`Posao ${viewingPosao.Posao}`} onClose={closeModal} wide>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 36px"}}>
            {df("Broj posla",viewingPosao.Posao,T.primary)}{df("Datum unosa",fmtDate(viewingPosao.DatumUnosa))}
            {df("Klijent",viewingPosao.KLIJENT)}{df("Šifra kupca",viewingPosao.SifraKupca)}
            {df("Rok za isporuku",fmtDate(viewingPosao.RokZaIsporuku))}{df("Unosilac",viewingPosao.Unosilac)}
            <div style={{gridColumn:"1/-1",marginBottom:16}}>
              <div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>Opis</div>
              <div style={{color:T.text,fontSize:14,lineHeight:1.7,background:T.surfaceRaised,borderRadius:T.radiusSm,padding:"10px 13px",border:`1px solid ${T.border}`}}>{viewingPosao.Opis||"—"}</div>
            </div>
            {divider("Finansije")}
            {df("Obračun",viewingPosao.Obracun?`${parseFloat(viewingPosao.Obracun).toLocaleString()} RSD`:"—",T.green)}
            <div style={{marginBottom:16}}><div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Plaćanje</div><PlacanjeBadge val={viewingPosao.Placanje}/></div>
            {divider("Statusi")}
            <div style={{marginBottom:14}}><div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>St. izrade</div><CheckBadge val={viewingPosao.StatusIzrade}/></div>
            <div style={{marginBottom:14}}><div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>St. isporuke</div><CheckBadge val={viewingPosao.StatusIsporuke}/></div>
            <div style={{marginBottom:14}}><div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>St. montaže</div><CheckBadge val={viewingPosao.StatusMontaze}/></div>
            <div style={{marginBottom:14}}><div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Završen</div><CheckBadge val={viewingPosao.ZavrsenPosao}/></div>
            <div style={{marginBottom:14}}><div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Fakturisano</div><CheckBadge val={viewingPosao.Fakturisano}/></div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
            <button onClick={closeModal} style={btnS("ghost")}>Zatvori</button>
            {canEdit("poslovi")&&<button onClick={()=>{openEditPosao(viewingPosao);setViewingPosao(null);}} style={btnS("primary")}>Uredi</button>}
          </div>
        </Modal>
      )}

      {(editingKupac||newKupac) && (
        <Modal title={newKupac?"Novi kupac":`Uredi: ${tempData.Naziv}`} onClose={closeModal}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
            <Field label="Šifra kupca (auto)" value={tempData.SifraKupca} onChange={tf("SifraKupca")} readOnly={newKupac}/>
            <Field label="Naziv" value={tempData.Naziv} onChange={tf("Naziv")}/>
            <Field label="Grad" value={tempData.Grad} onChange={tf("Grad")}/>
            <Field label="Ulica" value={tempData.Ulica} onChange={tf("Ulica")}/>
            <Field label="Broj" value={tempData.Broj} onChange={tf("Broj")}/>
            <Field label="Poštanski broj" value={tempData.PostanskiBroj} onChange={tf("PostanskiBroj")}/>
            <Field label="Telefon" value={tempData.Telefon} onChange={tf("Telefon")}/>
            <Field label="PIB" value={tempData.PIB} onChange={tf("PIB")}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
            <button onClick={closeModal} style={btnS("ghost")}>Otkaži</button>
            <button onClick={saveKupac} disabled={saving} style={{...btnS("primary"),opacity:saving?0.6:1}}>{saving?"Snima...":"Sačuvaj"}</button>
          </div>
        </Modal>
      )}

      {viewingKupac && (
        <Modal title={viewingKupac.Naziv} onClose={closeModal}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 36px"}}>
            {df("Šifra kupca",viewingKupac.SifraKupca,T.primary)}{df("Naziv",viewingKupac.Naziv)}
            {df("Grad",viewingKupac.Grad)}{df("Ulica i broj",`${viewingKupac.Ulica||""} ${viewingKupac.Broj||""}`.trim())}
            {df("Poštanski broj",viewingKupac.PostanskiBroj)}{df("Telefon",viewingKupac.Telefon)}
            {df("PIB",viewingKupac.PIB)}
            <div style={{gridColumn:"1/-1",borderTop:`1px solid ${T.border}`,paddingTop:14,marginTop:4}}>
              <div style={{color:T.textSoft,fontSize:12,marginBottom:8,fontWeight:500}}>Poslovi ovog kupca:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {poslovi.filter(p=>p.SifraKupca===viewingKupac.SifraKupca).length===0
                  ? <span style={{color:T.textSoft,fontSize:13}}>Nema poslova</span>
                  : poslovi.filter(p=>p.SifraKupca===viewingKupac.SifraKupca).map(p=>(
                    <span key={p.id} onClick={()=>{setViewingKupac(null);setViewingPosao(p);}} style={{background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,color:T.primary,borderRadius:T.radiusSm,padding:"4px 11px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{p.Posao}</span>
                  ))}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
            <button onClick={closeModal} style={btnS("ghost")}>Zatvori</button>
            {canEdit("kupci")&&<button onClick={()=>{openEditKupac(viewingKupac);setViewingKupac(null);}} style={btnS("primary")}>Uredi</button>}
          </div>
        </Modal>
      )}

      {editingUser && (
        <Modal title={`Dozvole: ${tempData.ime} ${tempData.prezime}`} onClose={closeModal} wide>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 22px",marginBottom:16}}>
            <Field label="Ime" value={tempData.ime} onChange={tf("ime")} error={tempErrors.ime}/>
            <Field label="Prezime" value={tempData.prezime} onChange={tf("prezime")} error={tempErrors.prezime}/>
            <Field label="Telefon" value={tempData.telefon} onChange={tf("telefon")}/>
            <div style={{gridColumn:isMobile?"1":"1/-1"}}><Field label="Adresa" value={tempData.adresa} onChange={tf("adresa")}/></div>
          </div>
          <div style={{color:T.text,fontSize:13,fontWeight:600,marginBottom:10,fontFamily:T.fontHead}}>Dozvole po karticama</div>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><th style={thS}>Kartica</th><th style={thS}>Dozvola</th></tr></thead>
              <tbody>
                {ALL_TABS.map((t,i)=>(
                  <tr key={t.key} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,fontWeight:500,fontSize:12}}>{t.icon} {t.label}</td>
                    <td style={tdS}>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[["none","Nema",T.red,T.redBg,T.redBorder],["view","Pregledaj",T.amber,T.amberBg,T.amberBorder],["edit","Uredi",T.green,T.greenBg,T.greenBorder]].map(([p,lbl,col,bg,bdr])=>{
                          const active=tempData.tab_permissions?.[t.key]===p;
                          return (
                            <label key={p} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",background:active?bg:"none",border:`1px solid ${active?bdr:T.border}`,borderRadius:T.radiusSm,padding:"3px 9px",transition:"all 0.12s"}}>
                              <input type="radio" name={`perm_${t.key}`} value={p} checked={active} onChange={()=>setTempData(d=>({...d,tab_permissions:{...d.tab_permissions,[t.key]:p}}))} style={{accentColor:col,margin:0}}/>
                              <span style={{color:active?col:T.textSoft,fontSize:11,fontWeight:active?600:400,fontFamily:T.fontBody}}>{lbl}</span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
            <button onClick={closeModal} style={btnS("ghost")}>Otkaži</button>
            <button onClick={saveUser} disabled={saving} style={{...btnS("primary"),opacity:saving?0.6:1}}>{saving?"Snima...":"Sačuvaj"}</button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(6px)",padding:16}}>
          <div style={{background:T.surface,borderRadius:T.radiusLg,padding:"32px 28px",maxWidth:380,width:"100%",boxShadow:T.shadowLg,border:`1px solid ${T.border}`,textAlign:"center"}}>
            <div style={{width:48,height:48,background:T.redBg,border:`1px solid ${T.redBorder}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:20}}>🗑</div>
            <h3 style={{color:T.text,fontFamily:T.fontHead,margin:"0 0 8px",fontSize:18,fontWeight:700}}>Potvrda brisanja</h3>
            <p style={{color:T.textMid,fontSize:13,margin:"0 0 22px",lineHeight:1.6}}>Da li ste sigurni? Ova akcija se ne može poništiti.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setConfirmDelete(null)} style={btnS("ghost")}>Otkaži</button>
              <button onClick={confirmDeleteAction} style={{...btnS("primary"),background:T.red}}>Obriši</button>
            </div>
          </div>
        </div>
      )}

      {show2FA && <TwoFAPanel onClose={()=>setShow2FA(false)}/>}
    </div>
  );
}
