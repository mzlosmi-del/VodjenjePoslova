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
  { key:"uputstvo",  label:"Uputstvo",         icon:"📖" },
  { key:"changelog", label:"Istorija izmena",  icon:"🕓" },
];

const montazaIsporukaOptions = ["Samo isporuka","Montaža i isporuka","Lično preuzimanje"];
const placanjeOptions        = ["Faktura","Otpremnica","Zaduženje"];

// ── shared styles ─────────────────────────────────────────────────────────────
const thS = { padding:"10px 14px", textAlign:"left", color:T.text, fontSize:11,
  textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700,
  borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap", background:"#1C2330", fontFamily:T.fontBody };
const tdS = { padding:"11px 14px", color:T.text, fontSize:13,
  borderBottom:`1px solid ${T.border}`, verticalAlign:"middle", fontFamily:T.fontBody,
  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" };

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
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.70)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"}}>
      <div style={{background:T.surface,borderRadius:T.radiusLg,padding:"28px 32px",minWidth:wide?720:560,maxWidth:"94vw",maxHeight:"92vh",overflowY:"auto",boxShadow:T.shadowLg,border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{color:T.text,fontFamily:T.fontHead,margin:0,fontSize:19,fontWeight:700,letterSpacing:"-0.02em"}}>{title}</h2>
          <button onClick={onClose} style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,color:T.textMid,cursor:"pointer",fontSize:18,width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
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

// ── TABLE CONTROLS (search / sort / column reorder + saved layouts) ──────────
function useTableControls(viewKey, defaultCols, currentUser, canPublishLayouts) {
  const [search,  setSearch]  = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [showColMenu, setShowColMenu] = useState(false);
  const [cols, setCols] = useState(defaultCols);
  const [layouts, setLayouts] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [saveAsShared, setSaveAsShared] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [layoutsLoaded, setLayoutsLoaded] = useState(false);
  const dragCol   = useRef(null);
  const resizeCol = useRef(null);  // { key, startX, startW }

  // Load layouts and apply the user's default (or shared default) on mount
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const { data } = await sb.from("column_layouts")
        .select("*")
        .eq("view_key", viewKey)
        .order("created_at", { ascending: true });
      if (data) {
        setLayouts(data);
        // Priority: user's own default > shared layout > nothing
        const myDefault = data.find(l => l.user_id === currentUser.id && l.is_default);
        const shared    = data.find(l => l.is_shared);
        const toApply   = myDefault || shared;
        if (toApply) setCols(toApply.cols);
      }
      setLayoutsLoaded(true);
    })();
  }, [currentUser, viewKey]);

  function saveCols(next) { setCols(next); }

  async function saveLayout() {
    if (!layoutName.trim() || !currentUser) return;
    const isDefault = saveAsDefault;
    const isShared  = saveAsShared && canPublishLayouts;
    const payload   = { user_id: currentUser.id, view_key: viewKey, name: layoutName.trim(), cols, is_shared: isShared, is_default: isDefault };

    // If marking as default, clear previous default for this user+view first
    if (isDefault) {
      const prevDefault = layouts.find(l => l.user_id === currentUser.id && l.is_default && l.view_key === viewKey);
      if (prevDefault) {
        await sb.from("column_layouts").update({ is_default: false }).eq("id", prevDefault.id);
        setLayouts(prev => prev.map(l => l.id === prevDefault.id ? {...l, is_default: false} : l));
      }
    }

    const existing = layouts.find(l => l.user_id === currentUser.id && l.name === layoutName.trim() && l.view_key === viewKey);
    let result;
    if (existing) {
      result = await sb.from("column_layouts").update({ cols, is_shared: isShared, is_default: isDefault, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single();
    } else {
      result = await sb.from("column_layouts").insert([payload]).select().single();
    }
    if (result.data) {
      setLayouts(prev => existing ? prev.map(l => l.id===existing.id ? result.data : l) : [...prev, result.data]);
    }
    setShowSaveDialog(false); setLayoutName(""); setSaveAsDefault(false); setSaveAsShared(false);
  }

  async function setAsDefault(layout) {
    // Clear previous default for this user+view
    const prevDefault = layouts.find(l => l.user_id === currentUser.id && l.is_default);
    if (prevDefault && prevDefault.id !== layout.id) {
      await sb.from("column_layouts").update({ is_default: false }).eq("id", prevDefault.id);
    }
    // Set new default
    const isNowDefault = !layout.is_default;
    await sb.from("column_layouts").update({ is_default: isNowDefault }).eq("id", layout.id);
    setLayouts(prev => prev.map(l => {
      if (l.user_id === currentUser.id && l.is_default && l.id !== layout.id) return {...l, is_default: false};
      if (l.id === layout.id) return {...l, is_default: isNowDefault};
      return l;
    }));
    // Apply immediately if setting as default
    if (isNowDefault) setCols(layout.cols);
  }

  async function deleteLayout(id) {
    await sb.from("column_layouts").delete().eq("id", id);
    setLayouts(prev => prev.filter(l => l.id !== id));
  }

  async function applyLayout(layout) {
    setCols(layout.cols);
  }

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

  // ── Column resize ───────────────────────────────────────────────────────────
  function onResizeStart(e, key) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement;
    resizeCol.current = { key, startX: e.clientX, startW: th.offsetWidth };
    function onMove(ev) {
      const delta = ev.clientX - resizeCol.current.startX;
      const newW  = Math.max(40, resizeCol.current.startW + delta);
      setCols(prev => prev.map(c => c.key === key ? { ...c, width: newW } : c));
    }
    function onUp() {
      resizeCol.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",  onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
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

  // Dynamic label: use shortLabel when column is narrow (< 120px), full label otherwise
  const SHORT_THRESHOLD = 120;
  function colLabel(col) {
    if (col.shortLabel && col.width && col.width < SHORT_THRESHOLD) return col.shortLabel;
    return col.label;
  }

  const myLayouts    = layouts.filter(l => l.user_id === currentUser?.id);
  const sharedLayouts = layouts.filter(l => l.is_shared);

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
            <div style={{position:"fixed",top:"auto",right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,zIndex:500,boxShadow:T.shadowMd,width:280,padding:14}} onClick={e=>e.stopPropagation()}>

              {/* Saved layouts section */}
              {(myLayouts.length > 0 || sharedLayouts.length > 0) && (
                <div style={{marginBottom:12}}>
                  <div style={{color:T.textSoft,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>
                    Sačuvani rasporedi <span style={{color:T.textSoft,fontWeight:400,fontSize:9,marginLeft:4}}>★ = podrazumevani</span>
                  </div>
                  {sharedLayouts.map(l=>(
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                      <button onClick={()=>applyLayout(l)} style={{flex:1,textAlign:"left",background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,color:T.primary,borderRadius:T.radiusSm,padding:"5px 9px",cursor:"pointer",fontSize:12,fontFamily:T.fontBody,fontWeight:600}}>
                        🌐 {l.name}
                      </button>
                      <button onClick={()=>setAsDefault(l)} title={l.is_default?"Ukloni kao podrazumevani":"Postavi kao podrazumevani"}
                        style={{background:l.is_default?T.amberBg:"none",border:`1px solid ${l.is_default?T.amberBorder:T.border}`,color:l.is_default?T.amber:T.textSoft,borderRadius:T.radiusSm,padding:"4px 7px",cursor:"pointer",fontSize:12}}>
                        {l.is_default?"★":"☆"}
                      </button>
                      {l.user_id === currentUser?.id && (
                        <button onClick={()=>deleteLayout(l.id)} style={{background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:T.radiusSm,padding:"4px 7px",cursor:"pointer",fontSize:11}}>✕</button>
                      )}
                    </div>
                  ))}
                  {myLayouts.filter(l=>!l.is_shared).map(l=>(
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                      <button onClick={()=>applyLayout(l)} style={{flex:1,textAlign:"left",background:l.is_default?`rgba(251,191,36,0.08)`:T.surfaceRaised,border:`1px solid ${l.is_default?T.amberBorder:T.border}`,color:T.text,borderRadius:T.radiusSm,padding:"5px 9px",cursor:"pointer",fontSize:12,fontFamily:T.fontBody}}>
                        👤 {l.name}
                      </button>
                      <button onClick={()=>setAsDefault(l)} title={l.is_default?"Ukloni kao podrazumevani":"Postavi kao podrazumevani"}
                        style={{background:l.is_default?T.amberBg:"none",border:`1px solid ${l.is_default?T.amberBorder:T.border}`,color:l.is_default?T.amber:T.textSoft,borderRadius:T.radiusSm,padding:"4px 7px",cursor:"pointer",fontSize:12}}>
                        {l.is_default?"★":"☆"}
                      </button>
                      <button onClick={()=>deleteLayout(l.id)} style={{background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:T.radiusSm,padding:"4px 7px",cursor:"pointer",fontSize:11}}>✕</button>
                    </div>
                  ))}
                  <div style={{borderTop:`1px solid ${T.border}`,marginTop:8,marginBottom:8}}/>
                </div>
              )}

              {/* Column order/visibility */}
              <div style={{color:T.textSoft,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Redosled kolona</div>
              <div style={{color:T.textSoft,fontSize:11,marginBottom:8}}>Prevuci da promeniš redosled</div>
              <div style={{maxHeight:260,overflowY:"auto",marginBottom:8}}>
                {cols.map(c=>(
                  <div key={c.key} draggable onDragStart={()=>onDragStart(c.key)} onDragOver={e=>e.preventDefault()} onDrop={()=>onDrop(c.key)}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:T.radiusSm,cursor:"grab",marginBottom:3,background:T.surfaceRaised,border:`1px solid ${T.border}`}}>
                    <span style={{color:T.textSoft,fontSize:12}}>⠿</span>
                    <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",flex:1,fontSize:13,color:T.text,fontFamily:T.fontBody}}>
                      <input type="checkbox" checked={c.visible} onChange={()=>saveCols(cols.map(x=>x.key===c.key?{...x,visible:!x.visible}:x))} style={{accentColor:T.primary}}/>
                      {c.label}
                    </label>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <button onClick={()=>saveCols(defaultCols)} style={{...btnS("ghost"),flex:1,padding:"5px",fontSize:11}}>Resetuj</button>
                <button onClick={()=>{setShowSaveDialog(true);setShowColMenu(false);}} style={{...btnS("primary"),flex:1,padding:"5px",fontSize:11}}>Sačuvaj raspored</button>
              </div>
              <button onClick={()=>setShowColMenu(false)} style={{...btnS("ghost"),width:"100%",padding:"5px",fontSize:11}}>Zatvori</button>
            </div>
          )}
        </div>
        {extraAction}

        {/* Save layout dialog */}
        {showSaveDialog && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(4px)"}}>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radiusLg,padding:"24px 28px",width:360,boxShadow:T.shadowLg}}>
              <h3 style={{color:T.text,fontFamily:T.fontHead,margin:"0 0 16px",fontSize:17,fontWeight:700}}>Sačuvaj raspored kolona</h3>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4}}>Naziv rasporeda</label>
                <input value={layoutName} onChange={e=>setLayoutName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&saveLayout()}
                  placeholder="npr. Moj pregled" autoFocus
                  style={{width:"100%",background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"9px 12px",color:T.text,fontSize:13,fontFamily:T.fontBody,boxSizing:"border-box",outline:"none",colorScheme:"dark"}}/>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,cursor:"pointer"}}>
                <input type="checkbox" checked={saveAsDefault} onChange={e=>setSaveAsDefault(e.target.checked)} style={{accentColor:T.amber,width:15,height:15}}/>
                <span style={{color:T.textMid,fontSize:13}}>★ Postavi kao podrazumevani (učitava se pri svakom otvaranju)</span>
              </label>
              {canPublishLayouts && (
                <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,cursor:"pointer"}}>
                  <input type="checkbox" checked={saveAsShared} onChange={e=>setSaveAsShared(e.target.checked)} style={{accentColor:T.primary,width:15,height:15}}/>
                  <span style={{color:T.textMid,fontSize:13}}>🌐 Objavi kao zajednički raspored (vidljiv svima)</span>
                </label>
              )}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>{setShowSaveDialog(false);setLayoutName("");}} style={btnS("ghost")}>Otkaži</button>
                <button onClick={saveLayout} disabled={!layoutName.trim()} style={{...btnS("primary"),opacity:!layoutName.trim()?0.5:1}}>Sačuvaj</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const thDraggable = (col) => ({
    style: {
      ...thS,
      cursor: "pointer",
      userSelect: "none",
      position: "relative",
      width: col.width ? col.width : undefined,
      minWidth: col.width ? col.width : undefined,
    },
    draggable: true,
    onDragStart: () => onDragStart(col.key),
    onDragOver:  e => e.preventDefault(),
    onDrop:      () => onDrop(col.key),
    onClick:     () => toggleSort(col.key),
  });

  // Resize handle element — place inside <th> after the label
  // Double-click resets to auto width
  const ResizeHandle = ({ colKey }) => (
    <span
      onMouseDown={e => onResizeStart(e, colKey)}
      onDoubleClick={e => { e.stopPropagation(); setCols(prev => prev.map(c => c.key === colKey ? { ...c, width: undefined } : c)); }}
      onClick={e => e.stopPropagation()}
      title="Prevuci za promenu širine · Dupli klik za resetovanje"
      style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: 6, cursor: "col-resize",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2,
      }}
    >
      <span style={{
        width: 2, height: "60%", borderRadius: 1,
        background: T.borderStrong, opacity: 0.5,
        transition: "opacity 0.15s",
      }}/>
    </span>
  );

  return { search, sortCol, sortDir, cols, filterAndSort, Toolbar, SortIcon, thDraggable, ResizeHandle, colLabel };
}

// ── POSAO TABLE ───────────────────────────────────────────────────────────────
const POSAO_COLS_DEFAULT = [
  {key:"Posao",visible:true,label:"Posao"},{key:"KLIJENT",visible:true,label:"Klijent"},
  {key:"SifraKupca",visible:true,label:"Šifra"},{key:"DatumUnosa",visible:true,label:"Datum"},
  {key:"RokZaIsporuku",visible:true,label:"Rok isporuke"},{key:"Unosilac",visible:true,label:"Unosilac"},
  {key:"Opis",visible:true,label:"Opis"},{key:"PoslatiNaIzradu",visible:true,label:"Poslati"},
  {key:"MontazaIsporuka",visible:true,label:"Montaža/Isporuka"},{key:"Placanje",visible:true,label:"Plaćanje"},
  {key:"StatusIzrade",visible:true,label:"Status izrade",shortLabel:"Izrada",width:72},{key:"StatusIsporuke",visible:true,label:"Status isporuke",shortLabel:"Isporuka",width:78},
  {key:"StatusMontaze",visible:true,label:"Status montaže",shortLabel:"Montaža",width:76},{key:"SpecifikacijaCene",visible:true,label:"Specifikacija cene",shortLabel:"Specif."},
  {key:"Obracun",visible:true,label:"Obračun (RSD)",shortLabel:"Obračun"},{key:"ZavrsenPosao",visible:true,label:"Završen posao",shortLabel:"Završen",width:72},
  {key:"Fakturisano",visible:false,label:"Fakturisano",shortLabel:"Fakt.",width:72},
];

function PosaoTable({rows, viewKey, canEdit, onView, onEdit, onDelete, onInlineZavrsen, onCopy, currentUser, canPublishLayouts}) {
  const ctrl = useTableControls(viewKey, POSAO_COLS_DEFAULT, currentUser, canPublishLayouts);
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

  return (
    <>
      <ctrl.Toolbar/>
      <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
        <table style={{width:"max-content",minWidth:"100%",borderCollapse:"collapse",background:T.surface}}>
          <thead>
            <tr>
              {visibleCols.map(col=>(
                <th key={col.key} {...ctrl.thDraggable(col)}>
                  <span style={{display:"flex",alignItems:"center"}}>{ctrl.colLabel(col)}<ctrl.SortIcon colKey={col.key}/></span>
                  <ctrl.ResizeHandle colKey={col.key}/>
                </th>
              ))}
              <th style={thS}></th>
            </tr>
          </thead>
          <tbody>
            {processed.length===0
              ? <tr><td colSpan={visibleCols.length+1} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema zapisa</td></tr>
              : processed.map((p,i)=>(
                <tr key={p.id} style={{cursor:"pointer",background:i%2===0?T.surface:T.surfaceHover}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}
                  onDoubleClick={()=>onView(p)}>
                  {visibleCols.map(col=>(
                    <td key={col.key} style={tdS} onClick={col.key==="ZavrsenPosao"?e=>e.stopPropagation():undefined}>
                      {renderCell(p, col.key)}
                    </td>
                  ))}
                  <td style={tdS} onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",gap:5}}>
                      {canEdit
                        ? <>
                            <button onClick={()=>onEdit(p)} style={btnS("edit")}>Uredi</button>
                            {onCopy&&<button onClick={()=>onCopy(p)} title="Kopiraj posao" style={{...btnS("ghost"),padding:"5px 10px",fontSize:12}}>⧉</button>}
                            <button onClick={()=>onDelete(p.id)} style={btnS("danger")}>Briši</button>
                          </>
                        : <button onClick={()=>onView(p)} style={btnS("ghost")}>Pregled</button>}
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

function SimpleTable({rows, viewKey, columns, renderCell, emptyMsg="Nema zapisa", currentUser, canPublishLayouts}) {
  const ctrl = useTableControls(viewKey, columns.map(c=>({key:c.key,label:c.label,visible:true})), currentUser, canPublishLayouts);
  const visibleCols = ctrl.cols.filter(c=>c.visible);
  const processed = ctrl.filterAndSort(rows);

  return (
    <>
      <ctrl.Toolbar/>
      <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
        <table style={{width:"max-content",minWidth:"100%",borderCollapse:"collapse",background:T.surface}}>
          <thead><tr>
            {visibleCols.map(col=>(
              <th key={col.key} {...ctrl.thDraggable(col)}>
                <span style={{display:"flex",alignItems:"center"}}>{ctrl.colLabel(col)}<ctrl.SortIcon colKey={col.key}/></span>
                <ctrl.ResizeHandle colKey={col.key}/>
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

function KupciView({kupci, canEdit, onNew, onEdit, onDelete, onView, currentUser, canPublishLayouts}) {
  const ctrl = useTableControls("kupci", KUPCI_COLS_DEFAULT, currentUser, canPublishLayouts);
  const visibleCols = ctrl.cols.filter(c=>c.visible);
  const processed = ctrl.filterAndSort(kupci);
  return (
    <>
      <PageHeader title="Kupci" subtitle="Baza klijenata" action={canEdit&&<button onClick={onNew} style={btnS("primary")}>+ Novi kupac</button>}/>
      <ctrl.Toolbar/>
      <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
            <table style={{width:"max-content",minWidth:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>
                {visibleCols.map(col=>(
                  <th key={col.key} {...ctrl.thDraggable(col)}>
                    <span style={{display:"flex",alignItems:"center"}}>{ctrl.colLabel(col)}<ctrl.SortIcon colKey={col.key}/></span>
                    <ctrl.ResizeHandle colKey={col.key}/>
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

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [loading,setLoading]=useState(false);

  async function handleLogin() {
    setLoading(true); setError("");
    const {data,error:e} = await sb.auth.signInWithPassword({email,password});
    if (e) { setError(e.message); setLoading(false); return; }
    onLogin(data.user);
  }

  const inp={width:"100%",background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"11px 14px",color:T.text,fontSize:14,fontFamily:T.fontBody,boxSizing:"border-box",outline:"none",colorScheme:"dark"};
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0D1117 0%,#111827 50%,#0F172A 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.fontBody}}>

      <div style={{position:"fixed",top:-120,right:-120,width:400,height:400,background:"radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:-80,left:-80,width:300,height:300,background:"radial-gradient(circle,rgba(167,139,250,0.14) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{background:T.surface,borderRadius:T.radiusLg,padding:"40px 44px",width:400,boxShadow:T.shadowLg,border:`1px solid ${T.border}`,position:"relative"}}>
        <div style={{marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,borderRadius:T.radius,padding:"6px 12px",marginBottom:18}}>
            <div style={{width:7,height:7,background:T.primary,borderRadius:"50%"}}/>
            <span style={{color:T.primary,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Poslovi App</span>
          </div>
          <h1 style={{fontFamily:T.fontHead,fontSize:26,fontWeight:800,color:T.text,margin:"0 0 6px",letterSpacing:"-0.04em"}}>Dobrodošli nazad</h1>
          <p style={{color:T.textSoft,fontSize:13,margin:0}}>Prijavite se na svoj nalog</p>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:5}}>Email adresa</label>
          <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={inp} placeholder="vas@email.com"/>
        </div>
        <div style={{marginBottom:24}}>
          <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:5}}>Lozinka</label>
          <div style={{position:"relative"}}>
            <input type={showPw?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{...inp,paddingRight:44}}/>
            <button onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.textSoft,cursor:"pointer",fontSize:16}}>{showPw?"🙈":"👁"}</button>
          </div>
        </div>
        <ErrBanner msg={error}/>
        <button onClick={handleLogin} disabled={loading} style={{...btnS("primary"),width:"100%",padding:"13px",fontSize:14,opacity:loading?0.6:1}}>
          {loading?"Prijavljivanje...":"Prijavi se →"}
        </button>
      </div>
    </div>
  );
}

// ── OBRACUN VIEW ─────────────────────────────────────────────────────────────
function ObracunView({poslovi, placanjeColor}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [groupBy,  setGroupBy]  = useState("month"); // day | week | month | total
  const [tooltip,  setTooltip]  = useState(null);    // {x,y,label,items}
  const chartRef = useRef(null);

  const inp = {background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,
    padding:"7px 11px",color:T.text,fontSize:13,fontFamily:T.fontBody,outline:"none",colorScheme:"dark",boxSizing:"border-box"};

  // Filter by date
  const filtered = useMemo(() => {
    let rows = poslovi;
    if (fromDate) rows = rows.filter(p => p.DatumUnosa && p.DatumUnosa >= fromDate);
    if (toDate)   rows = rows.filter(p => p.DatumUnosa && p.DatumUnosa <= toDate);
    return rows;
  }, [poslovi, fromDate, toDate]);

  // All unique placanje types (stable order)
  const placanjeTypes = useMemo(() => {
    const s = new Set(filtered.map(p=>p.Placanje).filter(Boolean));
    return [...s].sort();
  }, [filtered]);

  // Color per placanje (cycle through palette)
  const PALETTE = [T.primary, T.green, T.amber, T.purple, T.red, "#22D3EE", "#FB923C"];
  const placanjeColorMap = useMemo(() => {
    const m = {};
    placanjeTypes.forEach((t,i) => { m[t] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [placanjeTypes]);

  // Group key function
  function getGroupKey(dateStr) {
    if (!dateStr) return "—";
    if (groupBy === "total") return "Ukupno";
    if (groupBy === "day") return dateStr; // yyyy-mm-dd
    if (groupBy === "month") return dateStr.slice(0,7); // yyyy-mm
    if (groupBy === "week") {
      const d = new Date(dateStr);
      // ISO week: find Monday
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      return d.toISOString().slice(0,10); // Monday of the week
    }
    return dateStr;
  }

  function formatGroupLabel(key) {
    if (key === "Ukupno") return "Ukupno";
    if (groupBy === "day") {
      const [y,m,d] = key.split("-"); return `${d}.${m}.${y}`;
    }
    if (groupBy === "month") {
      const [y,m] = key.split("-");
      const names = ["","Jan","Feb","Mar","Apr","Maj","Jun","Jul","Avg","Sep","Okt","Nov","Dec"];
      return `${names[parseInt(m)]} ${y}`;
    }
    if (groupBy === "week") {
      const [y,m,d] = key.split("-"); return `${d}.${m}`;
    }
    return key;
  }

  // Build chart data: array of {key, label, byPlacanje:{type->sum}, total}
  const chartData = useMemo(() => {
    const groups = {};
    filtered.forEach(p => {
      if (!p.DatumUnosa || !p.Placanje) return;
      const key = getGroupKey(p.DatumUnosa);
      if (!groups[key]) groups[key] = { key, byPlacanje: {} };
      groups[key].byPlacanje[p.Placanje] = (groups[key].byPlacanje[p.Placanje]||0) + (parseFloat(p.Obracun)||0);
    });
    const sorted = Object.values(groups).sort((a,b) => a.key.localeCompare(b.key));
    return sorted.map(g => ({
      ...g,
      label: formatGroupLabel(g.key),
      total: Object.values(g.byPlacanje).reduce((s,v)=>s+v,0),
    }));
  }, [filtered, groupBy]);

  // Summary sums
  const sums = useMemo(() => {
    const s = {};
    filtered.forEach(p => {
      if (!p.Placanje) return;
      s[p.Placanje] = (s[p.Placanje]||0) + (parseFloat(p.Obracun)||0);
    });
    return s;
  }, [filtered]);
  const totalSum = Object.values(sums).reduce((a,b)=>a+b,0);
  const hasFilter = fromDate || toDate;

  // ── SVG Bar Chart ──────────────────────────────────────────────────────────
  const BAR_H = 320;
  const PAD_L = 80; const PAD_R = 20; const PAD_T = 20; const PAD_B = 60;
  const chartW = 900; // viewBox width, scales with container
  const innerW = chartW - PAD_L - PAD_R;
  const innerH = BAR_H - PAD_T - PAD_B;

  const maxVal = useMemo(() => {
    if (!chartData.length) return 1;
    return Math.max(...chartData.map(g=>g.total), 1);
  }, [chartData]);

  // Nice Y axis ticks
  const yTicks = useMemo(() => {
    const count = 5;
    const step = Math.ceil(maxVal / count / 1000) * 1000 || 1;
    const top = step * count;
    return Array.from({length: count+1}, (_,i) => i * step);
  }, [maxVal]);
  const yMax = yTicks[yTicks.length-1] || 1;

  const barGroupW = chartData.length > 0 ? innerW / chartData.length : innerW;
  const barPad = Math.max(barGroupW * 0.15, 4);
  const barW = Math.max(barGroupW - barPad * 2, 4);

  function BarChart() {
    return (
      <svg viewBox={`0 0 ${chartW} ${BAR_H}`} style={{width:"100%",height:"auto",display:"block",overflow:"visible"}}
        onMouseLeave={()=>setTooltip(null)}>
        {/* Y gridlines + labels */}
        {yTicks.map(v => {
          const y = PAD_T + innerH - (v / yMax) * innerH;
          return (
            <g key={v}>
              <line x1={PAD_L} x2={PAD_L+innerW} y1={y} y2={y} stroke={T.border} strokeWidth="1"/>
              <text x={PAD_L-8} y={y+4} textAnchor="end" fontSize="11" fill={T.textSoft} fontFamily={T.fontBody}>
                {v>=1000000 ? `${(v/1000000).toFixed(1)}M` : v>=1000 ? `${(v/1000).toFixed(0)}k` : v}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {chartData.map((g, gi) => {
          const groupX = PAD_L + gi * barGroupW + barPad;
          let stackY = PAD_T + innerH;
          return (
            <g key={g.key} onMouseMove={e=>{
              const rect = chartRef.current?.getBoundingClientRect();
              if (rect) setTooltip({x: e.clientX-rect.left, y: e.clientY-rect.top, label: g.label, items: g.byPlacanje, total: g.total});
            }}>
              {placanjeTypes.map(type => {
                const val = g.byPlacanje[type] || 0;
                if (!val) return null;
                const bh = (val / yMax) * innerH;
                stackY -= bh;
                const color = placanjeColorMap[type];
                return (
                  <rect key={type} x={groupX} y={stackY} width={barW} height={bh}
                    fill={color} fillOpacity="0.85" rx="2"
                    style={{cursor:"pointer",transition:"fill-opacity 0.1s"}}
                    onMouseEnter={e=>e.currentTarget.setAttribute("fill-opacity","1")}
                    onMouseLeave={e=>e.currentTarget.setAttribute("fill-opacity","0.85")}/>
                );
              })}
              {/* X label */}
              <text x={groupX + barW/2} y={PAD_T+innerH+14} textAnchor="middle" fontSize="10"
                fill={T.textSoft} fontFamily={T.fontBody}
                transform={chartData.length > 10 ? `rotate(-35,${groupX+barW/2},${PAD_T+innerH+14})` : ""}>
                {g.label}
              </text>
            </g>
          );
        })}

        {/* Y axis line */}
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T+innerH} stroke={T.borderStrong} strokeWidth="1.5"/>
        {/* X axis line */}
        <line x1={PAD_L} x2={PAD_L+innerW} y1={PAD_T+innerH} y2={PAD_T+innerH} stroke={T.borderStrong} strokeWidth="1.5"/>

        {/* Empty state */}
        {chartData.length === 0 && (
          <text x={chartW/2} y={BAR_H/2} textAnchor="middle" fontSize="14" fill={T.textSoft} fontFamily={T.fontBody}>
            Nema podataka za prikaz
          </text>
        )}
      </svg>
    );
  }

  return <>
    <PageHeader title="Obračun po načinu plaćanja"/>

    {/* Filter bar */}
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"14px 20px",marginBottom:16,display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div>
        <label style={{display:"block",color:T.textSoft,fontSize:11,fontWeight:500,marginBottom:4}}>Od datuma unosa</label>
        <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{...inp,width:155}}/>
      </div>
      <div>
        <label style={{display:"block",color:T.textSoft,fontSize:11,fontWeight:500,marginBottom:4}}>Do datuma unosa</label>
        <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{...inp,width:155}}/>
      </div>
      {/* Quick range presets */}
      <div style={{display:"flex",gap:5,alignSelf:"flex-end",flexWrap:"wrap"}}>
        {[
          { label:"Prošla sedmica", fn:() => {
            const to   = new Date();
            const from = new Date(); from.setDate(from.getDate() - 7);
            setFromDate(from.toISOString().slice(0,10)); setToDate(to.toISOString().slice(0,10));
          }},
          { label:"Prošli mesec", fn:() => {
            const to   = new Date();
            const from = new Date(); from.setMonth(from.getMonth() - 1);
            setFromDate(from.toISOString().slice(0,10)); setToDate(to.toISOString().slice(0,10));
          }},
          { label:"Poslednjih 3 mes.", fn:() => {
            const to   = new Date();
            const from = new Date(); from.setMonth(from.getMonth() - 3);
            setFromDate(from.toISOString().slice(0,10)); setToDate(to.toISOString().slice(0,10));
          }},
          { label:"Prošla godina", fn:() => {
            const to   = new Date();
            const from = new Date(); from.setFullYear(from.getFullYear() - 1);
            setFromDate(from.toISOString().slice(0,10)); setToDate(to.toISOString().slice(0,10));
          }},
        ].map(({label,fn})=>(
          <button key={label} onClick={fn}
            style={{...btnS("ghost"),padding:"7px 11px",fontSize:11,whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>
      {hasFilter && (
        <button onClick={()=>{setFromDate("");setToDate("");}}
          style={{...btnS("ghost"),padding:"7px 14px",fontSize:12,alignSelf:"flex-end"}}>
          ✕ Resetuj
        </button>
      )}
      {hasFilter && (
        <div style={{color:T.textSoft,fontSize:12,alignSelf:"flex-end",paddingBottom:8}}>
          <strong style={{color:T.text}}>{filtered.length}</strong> od <strong style={{color:T.text}}>{poslovi.length}</strong> poslova
        </div>
      )}
    </div>

    {/* Stat cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:20}}>
      {Object.entries(sums).map(([nacin,suma])=>(
        <StatCard key={nacin} label={nacin} value={suma.toLocaleString()+" RSD"} color={placanjeColorMap[nacin]||placanjeColor(nacin)}
          sub={`${filtered.filter(p=>p.Placanje===nacin).length} poslova`}/>
      ))}
      {Object.keys(sums).length === 0 && (
        <div style={{gridColumn:"1/-1",color:T.textSoft,fontSize:13,padding:"16px 0"}}>Nema poslova u zadatom opsegu.</div>
      )}
    </div>

    {/* Chart */}
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"18px 20px",marginBottom:18}}>
      {/* Chart header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{color:T.text,fontSize:14,fontWeight:600,fontFamily:T.fontHead}}>Obračun po periodu</div>
        <div style={{display:"flex",gap:4}}>
          {[["day","Dan"],["week","Sedmica"],["month","Mesec"],["total","Ukupno"]].map(([k,lbl])=>(
            <button key={k} onClick={()=>setGroupBy(k)} style={{
              background:groupBy===k?T.primary:T.surfaceRaised,
              border:`1px solid ${groupBy===k?T.primary:T.border}`,
              color:groupBy===k?"#fff":T.textMid,
              borderRadius:T.radiusSm,padding:"5px 13px",cursor:"pointer",
              fontSize:12,fontWeight:groupBy===k?600:400,fontFamily:T.fontBody,
              transition:"all 0.15s",
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {placanjeTypes.length > 0 && (
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:12}}>
          {placanjeTypes.map(t=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:10,height:10,borderRadius:2,background:placanjeColorMap[t]||T.primary}}/>
              <span style={{color:T.textMid,fontSize:12,fontFamily:T.fontBody}}>{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* SVG chart */}
      <div ref={chartRef} style={{position:"relative"}}>
        <BarChart/>
        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position:"absolute",left:Math.min(tooltip.x+12, 700),top:Math.max(tooltip.y-60,0),
            background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radius,
            padding:"10px 14px",boxShadow:T.shadowMd,pointerEvents:"none",zIndex:10,minWidth:160,
          }}>
            <div style={{color:T.text,fontWeight:700,fontSize:13,marginBottom:6,fontFamily:T.fontHead}}>{tooltip.label}</div>
            {Object.entries(tooltip.items).map(([type,val])=>(
              <div key={type} style={{display:"flex",justifyContent:"space-between",gap:14,fontSize:12,color:T.textMid,marginBottom:2}}>
                <span style={{color:placanjeColorMap[type]||T.primary,fontWeight:600}}>{type}</span>
                <span style={{color:T.text,fontWeight:600}}>{val.toLocaleString()} RSD</span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${T.border}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:T.textSoft}}>Ukupno</span>
              <span style={{color:T.primary,fontWeight:700}}>{tooltip.total.toLocaleString()} RSD</span>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Summary table */}
    <div style={{background:T.surface,borderRadius:T.radius,border:`1px solid ${T.border}`,overflowX:"auto",marginBottom:18}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Plaćanje","Broj poslova","Ukupan obračun"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
        <tbody>
          {Object.entries(sums).map(([nacin,suma],i)=>(
            <tr key={nacin} style={{background:i%2===0?T.surface:T.surfaceHover}}>
              <td style={{...tdS,fontWeight:600}}><PlacanjeBadge val={nacin}/></td>
              <td style={{...tdS,color:T.textMid}}>{filtered.filter(p=>p.Placanje===nacin).length}</td>
              <td style={{...tdS,color:T.green,fontWeight:700}}>{suma.toLocaleString()} RSD</td>
            </tr>
          ))}
          {Object.keys(sums).length > 0 && (
            <tr style={{borderTop:`2px solid ${T.border}`,background:T.surfaceRaised}}>
              <td style={{...tdS,fontWeight:700,color:T.text}}>UKUPNO</td>
              <td style={{...tdS,fontWeight:700,color:T.textMid}}>{filtered.length}</td>
              <td style={{...tdS,color:T.primary,fontWeight:800,fontSize:16,fontFamily:T.fontHead}}>{totalSum.toLocaleString()} RSD</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </>;
}

// ── UPUTSTVO (Manual) ────────────────────────────────────────────────────────
// ── ChangelogView ─────────────────────────────────────────────────────────────
function ChangelogView() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filterAction, setFilterAction] = useState("sve");
  const [filterEntity, setFilterEntity] = useState("sve");
  const [filterActor,  setFilterActor]  = useState("sve");
  const [expanded, setExpanded] = useState({}); // id -> bool
  const [page, setPage]       = useState(0);
  const PAGE = 50;

  function loadLogs() {
    setLoading(true);
    sb.from("change_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }
  useEffect(loadLogs, []);

  const actors   = useMemo(() => [...new Set(logs.map(l=>l.actor))].sort(), [logs]);
  const entities = useMemo(() => [...new Set(logs.map(l=>l.entity_type))].sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      if (filterAction !== "sve" && l.action !== filterAction) return false;
      if (filterEntity !== "sve" && l.entity_type !== filterEntity) return false;
      if (filterActor  !== "sve" && l.actor !== filterActor) return false;
      if (!q) return true;
      const changesText = (l.changes||[]).map(c=>`${c.label} ${c.old} ${c.new}`).join(" ");
      return [l.actor, l.entity_label, l.action, changesText]
        .some(v => (v||"").toLowerCase().includes(q));
    });
  }, [logs, search, filterAction, filterEntity, filterActor]);

  const paged      = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(filtered.length / PAGE);

  function resetFilters() {
    setSearch(""); setFilterAction("sve"); setFilterEntity("sve"); setFilterActor("sve"); setPage(0);
  }

  const actionMeta = {
    create: { label:"Kreiranje", color:T.green,   bg:T.greenBg,     border:T.greenBorder,   icon:"✚" },
    update: { label:"Izmena",    color:T.primary,  bg:T.primaryLight, border:T.primaryBorder, icon:"✎" },
    delete: { label:"Brisanje",  color:T.red,      bg:T.redBg,       border:T.redBorder,     icon:"✕" },
  };
  const entityLabel = { posao:"Posao", kupac:"Kupac", korisnik:"Korisnik" };

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    const pad = n => String(n).padStart(2,"0");
    return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const selStyle = {
    background:T.surfaceRaised, border:`1px solid ${T.border}`, borderRadius:T.radiusSm,
    color:T.textMid, fontSize:12, padding:"6px 10px", fontFamily:T.fontBody,
    cursor:"pointer", outline:"none", colorScheme:"dark",
  };

  // Renders the expandable changes diff block
  function ChangesBlock({ log, rowIdx }) {
    const changes = log.changes || [];
    const m = actionMeta[log.action] || actionMeta.update;
    const isOpen = expanded[log.id];

    if (log.action === "delete") {
      return (
        <span style={{color:T.textSoft,fontSize:11,fontStyle:"italic"}}>Zapis je obrisan</span>
      );
    }
    if (changes.length === 0) {
      return <span style={{color:T.textSoft,fontSize:11,fontStyle:"italic"}}>Nema promena</span>;
    }
    // Show first change inline; expand for rest
    const first = changes[0];
    const rest  = changes.slice(1);
    return (
      <div>
        {/* First change always visible */}
        <ChangeLine c={first} action={log.action}/>
        {/* Rest toggled */}
        {rest.length > 0 && (
          <>
            {isOpen && rest.map((c,i) => <ChangeLine key={i} c={c} action={log.action}/>)}
            <button
              onClick={()=>setExpanded(e=>({...e,[log.id]:!e[log.id]}))}
              style={{marginTop:4,background:"none",border:`1px solid ${T.border}`,
                color:T.textSoft,borderRadius:4,padding:"1px 7px",cursor:"pointer",
                fontSize:10,fontFamily:T.fontBody}}>
              {isOpen ? `▲ Sakrij` : `▼ +${rest.length} polja`}
            </button>
          </>
        )}
      </div>
    );
  }

  function ChangeLine({ c, action }) {
    const isCreate = action === "create";
    return (
      <div style={{display:"flex",alignItems:"baseline",gap:5,marginBottom:3,flexWrap:"wrap"}}>
        <span style={{color:T.textMid,fontSize:11,fontWeight:600,minWidth:0,flexShrink:0}}>
          {c.label}
        </span>
        {!isCreate && c.old != null && c.old !== "—" && (
          <span style={{background:T.redBg,border:`1px solid ${T.redBorder}`,color:T.red,
            borderRadius:3,padding:"0px 6px",fontSize:10,maxWidth:160,overflow:"hidden",
            textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.old}>
            {c.old}
          </span>
        )}
        {!isCreate && c.old != null && c.old !== "—" && (
          <span style={{color:T.textSoft,fontSize:10}}>→</span>
        )}
        {c.new != null && (
          <span style={{background:T.greenBg,border:`1px solid ${T.greenBorder}`,color:T.green,
            borderRadius:3,padding:"0px 6px",fontSize:10,maxWidth:160,overflow:"hidden",
            textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.new}>
            {c.new}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
        marginBottom:18,gap:12,flexWrap:"wrap"}}>
        <div>
          <h1 style={{fontFamily:T.fontHead,fontSize:22,fontWeight:800,color:T.text,
            letterSpacing:"-0.03em",margin:"0 0 4px"}}>🕓 Istorija izmena</h1>
          <p style={{color:T.textSoft,fontSize:12,margin:0,fontFamily:T.fontBody}}>
            Jedan zapis po operaciji — polja grupisana u diff prikazu
          </p>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,
            borderRadius:T.radiusSm,padding:"4px 12px",fontSize:12,color:T.textMid,fontFamily:T.fontBody}}>
            {filtered.length.toLocaleString()} {filtered.length===1?"zapis":"zapisa"}
          </span>
          <button onClick={loadLogs}
            style={{background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,color:T.primary,
              borderRadius:T.radiusSm,padding:"5px 12px",cursor:"pointer",fontSize:12,
              fontWeight:600,fontFamily:T.fontBody}}>
            ↻ Osveži
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:"1 1 220px",minWidth:180}}>
          <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",
            fontSize:13,pointerEvents:"none"}}>🔍</span>
          <input value={search}
            onChange={e=>{setSearch(e.target.value);setPage(0);}}
            onKeyDown={e=>{if(e.key==="Escape"){setSearch("");setPage(0);}}}
            placeholder="Pretraži..." style={{...selStyle,width:"100%",paddingLeft:30,
              border:`1px solid ${search?T.primary:T.border}`,color:T.text,boxSizing:"border-box"}}/>
          {search && (
            <button onClick={()=>{setSearch("");setPage(0);}}
              style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",color:T.textSoft,cursor:"pointer",fontSize:14,lineHeight:1}}>
              ×
            </button>
          )}
        </div>
        <select value={filterAction} onChange={e=>{setFilterAction(e.target.value);setPage(0);}} style={selStyle}>
          <option value="sve">Sve akcije</option>
          <option value="create">Kreiranje</option>
          <option value="update">Izmena</option>
          <option value="delete">Brisanje</option>
        </select>
        <select value={filterEntity} onChange={e=>{setFilterEntity(e.target.value);setPage(0);}} style={selStyle}>
          <option value="sve">Svi entiteti</option>
          {entities.map(e=><option key={e} value={e}>{entityLabel[e]||e}</option>)}
        </select>
        <select value={filterActor} onChange={e=>{setFilterActor(e.target.value);setPage(0);}} style={selStyle}>
          <option value="sve">Svi korisnici</option>
          {actors.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        {(search||filterAction!=="sve"||filterEntity!=="sve"||filterActor!=="sve") && (
          <button onClick={resetFilters}
            style={{background:"none",border:`1px solid ${T.border}`,color:T.textMid,
              borderRadius:T.radiusSm,padding:"6px 12px",cursor:"pointer",fontSize:12,
              fontFamily:T.fontBody}}>✕ Resetuj</button>
        )}
      </div>

      {/* Summary chips */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {Object.entries(actionMeta).map(([k,m])=>{
          const cnt = filtered.filter(l=>l.action===k).length;
          if (!cnt) return null;
          return (
            <button key={k}
              onClick={()=>{setFilterAction(filterAction===k?"sve":k);setPage(0);}}
              style={{background:filterAction===k?m.bg:"none",
                border:`1px solid ${filterAction===k?m.border:T.border}`,
                color:filterAction===k?m.color:T.textSoft,borderRadius:T.radiusSm,
                padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:T.fontBody}}>
              {m.icon} {m.label} {cnt}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",
          padding:60,color:T.textSoft,fontFamily:T.fontBody,gap:12}}>
          <div style={{width:24,height:24,border:`3px solid ${T.border}`,
            borderTopColor:T.primary,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          Učitavanje...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 20px",color:T.textSoft,
          fontFamily:T.fontBody,fontSize:13}}>
          <div style={{fontSize:36,marginBottom:12}}>🕓</div>
          Nema zapisa koji odgovaraju filteru
        </div>
      ) : (
        <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",background:T.surface,
            fontFamily:T.fontBody}}>
            <thead>
              <tr>
                {["Datum i vreme","Korisnik","Akcija","Entitet","Zapis","Izmene"].map(h=>(
                  <th key={h} style={{padding:"9px 12px",textAlign:"left",color:T.textSoft,
                    fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700,
                    borderBottom:`1px solid ${T.border}`,background:"#1C2330",whiteSpace:"nowrap"}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((log, i) => {
                const m = actionMeta[log.action] || actionMeta.update;
                return (
                  <tr key={log.id||i}
                    style={{background:i%2===0?T.surface:T.surfaceHover,verticalAlign:"top"}}>
                    {/* DateTime */}
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                      <span style={{fontFamily:"monospace",fontSize:11,color:T.textMid}}>
                        {fmtDateTime(log.created_at)}
                      </span>
                    </td>
                    {/* Actor */}
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:22,height:22,borderRadius:"50%",background:T.primaryLight,
                          border:`1.5px solid ${T.primaryBorder}`,display:"flex",alignItems:"center",
                          justifyContent:"center",fontSize:8,fontWeight:700,color:T.primary,flexShrink:0}}>
                          {(log.actor||"?").split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase()}
                        </div>
                        <span style={{fontSize:12,color:T.text,fontWeight:500}}>{log.actor||"—"}</span>
                      </div>
                    </td>
                    {/* Action */}
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                      <span style={{background:m.bg,color:m.color,border:`1px solid ${m.border}`,
                        borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700}}>
                        {m.icon} {m.label}
                      </span>
                    </td>
                    {/* Entity type */}
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                      <span style={{color:T.textMid,fontSize:12}}>
                        {entityLabel[log.entity_type]||log.entity_type}
                      </span>
                    </td>
                    {/* Entity label */}
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                      <span style={{color:T.primary,fontWeight:700,fontSize:12}}>
                        {log.entity_label||"—"}
                      </span>
                    </td>
                    {/* Changes diff */}
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,minWidth:260}}>
                      <ChangesBlock log={log} rowIdx={i}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",
          gap:8,marginTop:16,fontFamily:T.fontBody}}>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
            style={{background:"none",border:`1px solid ${T.border}`,
              color:page===0?T.textSoft:T.textMid,borderRadius:T.radiusSm,
              padding:"5px 14px",cursor:page===0?"default":"pointer",
              fontSize:12,opacity:page===0?0.5:1}}>← Prethodna</button>
          <span style={{color:T.textMid,fontSize:12}}>
            Strana {page+1} od {totalPages} &nbsp;·&nbsp; {filtered.length} zapisa
          </span>
          <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}
            style={{background:"none",border:`1px solid ${T.border}`,
              color:page===totalPages-1?T.textSoft:T.textMid,borderRadius:T.radiusSm,
              padding:"5px 14px",cursor:page===totalPages-1?"default":"pointer",
              fontSize:12,opacity:page===totalPages-1?0.5:1}}>Sledeća →</button>
        </div>
      )}
    </div>
  );
}

function ManualView({ profile }) {
  const [activeId, setActiveId] = useState("opste");
  const contentRef = useRef(null);
  const sectionRefs = useRef({});

  const isAdmin = profile?.is_admin;
  const perm = tab => isAdmin ? "edit" : (profile?.tab_permissions?.[tab] || "none");
  const canSeeTab  = tab => perm(tab) !== "none";
  const canEditTab = tab => perm(tab) === "edit";

  // Sections visible to this user
  const SECTIONS = [
    { id:"opste",     title:"Opšte — navigacija i tabele", always:true },
    { id:"kolone",    title:"Rasporedi kolona",            always:true },
    { id:"poslovi",   title:"📋 Svi poslovi",             tab:"poslovi"  },
    { id:"aktivni",   title:"⚡ Aktivni poslovi",         tab:"aktivni"  },
    { id:"zavrseni",  title:"✅ Završeni poslovi",        tab:"zavrseni" },
    { id:"radionica", title:"🔧 Radionica",               tab:"radionica"},
    { id:"montaza",   title:"🏗 Montaža",                 tab:"montaza"  },
    { id:"isporuka",  title:"🚚 Isporuka",                tab:"isporuka" },
    { id:"knjizenje", title:"📒 Knjiženje",               tab:"knjizenje"},
    { id:"kupci",     title:"🏢 Kupci",                   tab:"kupci"    },
    { id:"obracun",   title:"💰 Obračun",                 tab:"obracun"  },
    { id:"korisnici", title:"👥 Korisnici",               adminOnly:true },
  ].filter(s => {
    if (s.always) return true;
    if (s.adminOnly) return isAdmin;
    return canSeeTab(s.tab);
  });

  // Scroll‑spy
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      let found = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id];
        if (el && el.getBoundingClientRect().top - 120 <= 0) found = s.id;
      }
      setActiveId(found);
    };
    container.addEventListener("scroll", handler, { passive:true });
    return () => container.removeEventListener("scroll", handler);
  }, [SECTIONS.map(s=>s.id).join()]);

  function scrollTo(id) {
    sectionRefs.current[id]?.scrollIntoView({ behavior:"smooth", block:"start" });
    setActiveId(id);
  }

  // ── Tiny shared components ────────────────────────────────────────────────
  const Sec = ({ id, children }) => (
    <div ref={el=>sectionRefs.current[id]=el} data-id={id}
      style={{scrollMarginTop:20, marginBottom:52}}>
      {children}
    </div>
  );

  const H2 = ({ children }) => (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,
      paddingBottom:12,borderBottom:`2px solid ${T.border}`}}>
      <div style={{width:4,height:24,background:T.primary,borderRadius:2,flexShrink:0}}/>
      <h2 style={{margin:0,fontFamily:T.fontHead,fontSize:20,fontWeight:800,
        color:T.text,letterSpacing:"-0.03em"}}>{children}</h2>
    </div>
  );

  const H3 = ({ children }) => (
    <h3 style={{margin:"20px 0 8px",fontFamily:T.fontHead,fontSize:14,fontWeight:700,
      color:T.text,display:"flex",alignItems:"center",gap:7}}>
      <span style={{color:T.primary,fontSize:16}}>›</span>{children}
    </h3>
  );

  const P = ({ children }) => (
    <p style={{margin:"0 0 10px",color:T.textMid,fontSize:13,lineHeight:1.8,fontFamily:T.fontBody}}>{children}</p>
  );

  const Ul = ({ items }) => (
    <ul style={{margin:"4px 0 10px",paddingLeft:18,color:T.textMid,fontSize:13,lineHeight:1.85,fontFamily:T.fontBody}}>
      {items.map((it,i)=><li key={i} style={{marginBottom:2}}>{it}</li>)}
    </ul>
  );

  const Steps = ({ items }) => (
    <div style={{margin:"8px 0 12px"}}>
      {items.map((it,i)=>(
        <div key={i} style={{display:"flex",gap:10,marginBottom:7,alignItems:"flex-start"}}>
          <div style={{flexShrink:0,width:22,height:22,borderRadius:"50%",background:T.primary,
            color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:700,fontFamily:T.fontBody,marginTop:1}}>{i+1}</div>
          <div style={{color:T.textMid,fontSize:13,lineHeight:1.7,fontFamily:T.fontBody,flex:1}}>{it}</div>
        </div>
      ))}
    </div>
  );

  const Note = ({ icon="ℹ️", color=T.primary, children }) => (
    <div style={{display:"flex",gap:9,background:`${color}10`,border:`1px solid ${color}28`,
      borderRadius:T.radiusSm,padding:"9px 13px",margin:"10px 0",fontSize:12,
      lineHeight:1.65,fontFamily:T.fontBody,color:T.textMid}}>
      <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
      <span>{children}</span>
    </div>
  );
  const Warn   = ({children}) => <Note icon="⚠️" color={T.amber}>{children}</Note>;
  const Danger = ({children}) => <Note icon="🚫" color={T.red}>{children}</Note>;
  const Tip    = ({children}) => <Note icon="💡" color={T.green}>{children}</Note>;

  const Kbd = ({children}) => (
    <kbd style={{background:T.surfaceRaised,border:`1px solid ${T.borderStrong}`,
      borderRadius:4,padding:"1px 6px",fontSize:11,fontFamily:"monospace",color:T.text}}>{children}</kbd>
  );

  const Tag = ({children,color=T.primary,bg,bdr}) => (
    <span style={{display:"inline-flex",alignItems:"center",
      background:bg||`${color}1a`,color,border:`1px solid ${bdr||color+"35"}`,
      borderRadius:4,padding:"1px 8px",fontSize:11,fontWeight:600,
      fontFamily:T.fontBody,whiteSpace:"nowrap"}}>{children}</span>
  );

  // ── Mock screenshot components ───────────────────────────────────────────
  const Frame = ({label,children,style={}}) => (
    <div style={{margin:"14px 0",borderRadius:T.radius,border:`1px solid ${T.border}`,
      overflow:"hidden",...style}}>
      {label && (
        <div style={{background:T.surfaceRaised,borderBottom:`1px solid ${T.border}`,
          padding:"5px 12px",fontSize:10,color:T.textSoft,fontFamily:T.fontBody,
          fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>
          {label}
        </div>
      )}
      <div style={{padding:14,background:T.bg}}>{children}</div>
    </div>
  );

  const MNavbar = () => (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,
      padding:"0 14px",display:"flex",alignItems:"center",height:44,gap:12,fontFamily:T.fontBody}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginRight:4}}>
        <div style={{width:20,height:20,background:T.primary,borderRadius:5,
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:7,height:7,background:"#fff",borderRadius:1.5,transform:"rotate(45deg)"}}/>
        </div>
        <span style={{fontWeight:700,color:T.text,fontSize:12,fontFamily:T.fontHead}}>Poslovi</span>
      </div>
      <div style={{display:"flex",gap:2,flex:1}}>
        {[{i:"📋",l:"Poslovi",a:false},{i:"⚡",l:"Aktivni poslovi",a:true},{i:"✅",l:"Završeni",a:false},{i:"🔧",l:"Radionica",a:false}].map((t,i)=>(
          <div key={i} style={{background:t.a?T.primaryLight:"none",color:t.a?T.primary:T.textSoft,
            borderRadius:5,padding:"3px 9px",fontSize:10,fontWeight:t.a?600:400,
            display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>
            <span>{t.i}</span><span>{t.l}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:22,height:22,borderRadius:"50%",background:T.primaryLight,
          border:`2px solid ${T.primaryBorder}`,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:8,fontWeight:700,color:T.primary}}>AN</div>
        <div>
          <div style={{fontSize:10,fontWeight:600,color:T.text}}>Ana Nikolić</div>
          <div style={{fontSize:9,color:T.textSoft}}>Korisnik</div>
        </div>
        <div style={{background:"none",border:`1px solid ${T.border}`,borderRadius:5,
          padding:"3px 10px",fontSize:10,color:T.textMid}}>Odjava</div>
      </div>
    </div>
  );

  const MToolbar = () => (
    <div style={{display:"flex",gap:8,marginBottom:8,fontFamily:T.fontBody}}>
      <div style={{flex:1,background:T.surfaceRaised,border:`1px solid ${T.border}`,
        borderRadius:T.radiusSm,padding:"6px 10px 6px 30px",fontSize:12,color:T.textSoft,position:"relative"}}>
        <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🔍</span>
        Pretraži... (Enter)
      </div>
      <div style={{background:"none",border:`1px solid ${T.border}`,color:T.textMid,
        borderRadius:T.radiusSm,padding:"6px 12px",fontSize:11}}>⚙ Kolone</div>
    </div>
  );

  const MTable = ({cols, rows}) => (
    <div style={{overflowX:"auto",borderRadius:T.radiusSm,border:`1px solid ${T.border}`}}>
      <table style={{width:"100%",borderCollapse:"collapse",background:T.surface,fontSize:11,fontFamily:T.fontBody}}>
        <thead>
          <tr>{cols.map((c,i)=>(
            <th key={i} style={{padding:"6px 10px",textAlign:"left",color:T.textSoft,
              fontSize:9,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700,
              borderBottom:`1px solid ${T.border}`,background:"#1C2330",whiteSpace:"nowrap"}}>
              {c} <span style={{opacity:.4}}>↕</span>
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>(
            <tr key={ri} style={{background:ri%2===0?T.surface:T.surfaceHover}}>
              {row.map((cell,ci)=>(
                <td key={ci} style={{padding:"6px 10px",borderBottom:`1px solid ${T.border}`,verticalAlign:"middle"}}>
                  {typeof cell==="string"
                    ? <span style={{color:T.textMid,fontSize:10}}>{cell}</span>
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const MStat = ({label,value,color,sub}) => (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,
      padding:"10px 16px",flex:"1 0 130px"}}>
      <div style={{color:T.textSoft,fontSize:9,fontWeight:600,textTransform:"uppercase",
        letterSpacing:"0.07em",marginBottom:3,fontFamily:T.fontBody}}>{label}</div>
      <div style={{color,fontSize:18,fontWeight:800,fontFamily:T.fontHead,letterSpacing:"-0.02em"}}>{value}</div>
      {sub&&<div style={{color:T.textSoft,fontSize:10,marginTop:2,fontFamily:T.fontBody}}>{sub}</div>}
    </div>
  );

  const MCheck = ({yes}) => (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,cursor:"default"}}>
      <span style={{width:15,height:15,borderRadius:3,border:`2px solid ${yes?T.green:T.border}`,
        background:yes?T.greenBg:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
        {yes&&<span style={{color:T.green,fontWeight:700,lineHeight:1}}>✓</span>}
      </span>
      <span style={{color:yes?T.green:T.textSoft,fontSize:11,fontWeight:yes?600:400,fontFamily:T.fontBody}}>{yes?"Da":"Ne"}</span>
    </span>
  );

  const MBadge = ({children,color=T.primary}) => (
    <span style={{background:`${color}18`,color,border:`1px solid ${color}35`,
      borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:600,fontFamily:T.fontBody}}>{children}</span>
  );

  const MColMenu = () => (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,
      padding:12,width:260,fontSize:11,fontFamily:T.fontBody}}>
      <div style={{color:T.textSoft,fontSize:9,fontWeight:700,textTransform:"uppercase",
        letterSpacing:"0.07em",marginBottom:7}}>
        Sačuvani rasporedi <span style={{fontWeight:400,opacity:.7}}>★ = podrazumevani</span>
      </div>
      {[{n:"Kompaktni pregled",shared:true,isDef:false},{n:"Moj pregled",shared:false,isDef:true}].map((l,i)=>(
        <div key={i} style={{display:"flex",gap:4,marginBottom:4,alignItems:"center"}}>
          <div style={{flex:1,background:l.shared?T.primaryLight:l.isDef?"rgba(251,191,36,.08)":T.surfaceRaised,
            border:`1px solid ${l.shared?T.primaryBorder:l.isDef?T.amberBorder:T.border}`,
            borderRadius:T.radiusSm,padding:"3px 8px",color:l.shared?T.primary:T.text,fontSize:10}}>
            {l.shared?"🌐":"👤"} {l.n}
          </div>
          <div style={{background:l.isDef?T.amberBg:"none",border:`1px solid ${l.isDef?T.amberBorder:T.border}`,
            color:l.isDef?T.amber:T.textSoft,borderRadius:T.radiusSm,padding:"2px 5px",fontSize:11}}>
            {l.isDef?"★":"☆"}
          </div>
          {!l.shared&&<div style={{background:"none",border:`1px solid ${T.redBorder}`,color:T.red,
            borderRadius:T.radiusSm,padding:"2px 5px",fontSize:10}}>✕</div>}
        </div>
      ))}
      <div style={{borderTop:`1px solid ${T.border}`,margin:"8px 0"}}/>
      <div style={{color:T.textSoft,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>
        Redosled kolona &nbsp;<span style={{fontWeight:400,opacity:.7}}>Prevuci da promeniš</span>
      </div>
      {["Posao","Klijent","Rok isporuke","Plaćanje","Status izrade"].map((c,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 7px",
          background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,marginBottom:3}}>
          <span style={{color:T.textSoft,cursor:"grab"}}>⠿</span>
          <input type="checkbox" defaultChecked readOnly style={{accentColor:T.primary,width:11,height:11}}/>
          <span style={{color:T.text,fontSize:11}}>{c}</span>
        </div>
      ))}
      <div style={{display:"flex",gap:5,marginTop:8}}>
        <div style={{flex:1,textAlign:"center",padding:"4px 0",border:`1px solid ${T.border}`,
          borderRadius:T.radiusSm,color:T.textMid,fontSize:10}}>Resetuj</div>
        <div style={{flex:1,textAlign:"center",padding:"4px 0",background:T.primary,
          borderRadius:T.radiusSm,color:"#fff",fontSize:10}}>Sačuvaj raspored</div>
      </div>
    </div>
  );

  const MSaveDialog = () => (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radiusLg,
      padding:"20px 22px",maxWidth:340,fontFamily:T.fontBody}}>
      <div style={{fontFamily:T.fontHead,fontWeight:700,fontSize:15,color:T.text,marginBottom:14}}>
        Sačuvaj raspored kolona
      </div>
      <div style={{marginBottom:10}}>
        <div style={{color:T.textMid,fontSize:11,fontWeight:500,marginBottom:4}}>Naziv rasporeda</div>
        <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,
          padding:"7px 10px",fontSize:12,color:T.textSoft}}>npr. Moj pregled</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8,fontSize:12,color:T.textMid}}>
        <input type="checkbox" readOnly defaultChecked style={{accentColor:T.amber,width:13,height:13}}/>
        ★ Postavi kao podrazumevani (učitava se pri svakom otvaranju)
      </div>
      {(profile?.can_publish_layouts||isAdmin) && (
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:14,fontSize:12,color:T.textMid}}>
          <input type="checkbox" readOnly style={{accentColor:T.primary,width:13,height:13}}/>
          🌐 Objavi kao zajednički raspored (vidljiv svima)
        </div>
      )}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <div style={{background:"none",border:`1px solid ${T.border}`,color:T.textMid,borderRadius:T.radiusSm,padding:"5px 14px",fontSize:12}}>Otkaži</div>
        <div style={{background:T.primary,color:"#fff",borderRadius:T.radiusSm,padding:"5px 14px",fontSize:12,fontWeight:600}}>Sačuvaj</div>
      </div>
    </div>
  );

  const MForm = () => (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:16,fontFamily:T.fontBody}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        {[["Posao (automatski)","P00000043","readonly"],["Datum unosa","15.05.2025","readonly"],
          ["Klijent","K00002 — Tehno Export",""],["Rok za isporuku","30.06.2025",""],
          ["Unosilac posla","Ana Nikolić ▼","dropdown"],["Opis","Aluminijumski profili",""],
        ].map(([lbl,val,hint],i)=>(
          <div key={i} style={{marginBottom:11,gridColumn:lbl==="Opis"?"1/-1":"auto"}}>
            <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:3}}>{lbl}</div>
            <div style={{background:hint==="readonly"?T.bg:T.surfaceRaised,border:`1px solid ${T.border}`,
              borderRadius:T.radiusSm,padding:"6px 10px",fontSize:11,
              color:hint==="readonly"?T.textSoft:T.text}}>{val}</div>
          </div>
        ))}
        <div style={{gridColumn:"1/-1",marginBottom:10}}>
          <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:3}}>Specifikacija cene</div>
          <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"6px 10px",fontSize:11,color:T.text}}>—</div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:3}}>Obračun (RSD)</div>
          <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"6px 10px",fontSize:11,color:T.text}}>95000</div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:3}}>Poslati na izradu</div>
          <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"6px 10px",fontSize:11,color:T.text}}>Tip izrade A ▼</div>
        </div>
        <div style={{gridColumn:"1/-1",marginBottom:10}}>
          <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:5}}>Montaža / Isporuka</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {[["Samo isporuka",T.green,T.greenBg,T.greenBorder,false],
              ["Montaža i isporuka",T.primary,T.primaryLight,T.primaryBorder,false],
              ["Lično preuzimanje",T.purple,T.purpleBg,T.purpleBorder,true]
            ].map(([lbl,c,bg,bdr,active],i)=>(
              <div key={i} style={{background:active?bg:T.surfaceRaised,border:`1.5px solid ${active?bdr:T.border}`,
                color:active?c:T.textSoft,borderRadius:T.radiusSm,padding:"5px 12px",
                fontSize:11,fontWeight:active?600:400,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${active?c:T.borderStrong}`,
                  background:active?c:"transparent",flexShrink:0}}/>
                {lbl}
              </div>
            ))}
          </div>
        </div>
        <div style={{gridColumn:"1/-1",marginBottom:10}}>
          <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:5}}>Plaćanje</div>
          <div style={{display:"flex",gap:7}}>
            {[["Faktura",T.primary,T.primaryLight,T.primaryBorder,false],
              ["Otpremnica",T.amber,T.amberBg,T.amberBorder,true],
              ["Zaduženje",T.purple,T.purpleBg,T.purpleBorder,false]
            ].map(([lbl,c,bg,bdr,active],i)=>(
              <div key={i} style={{background:active?bg:T.surfaceRaised,border:`1.5px solid ${active?bdr:T.border}`,
                color:active?c:T.textSoft,borderRadius:T.radiusSm,padding:"5px 12px",
                fontSize:11,fontWeight:active?600:400,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:9,height:9,borderRadius:"50%",border:`2px solid ${active?c:T.borderStrong}`,
                  background:active?c:"transparent",flexShrink:0}}/>
                {lbl}
              </div>
            ))}
          </div>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:6}}>Završen posao</div>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,cursor:"pointer"}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${T.border}`,
              background:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}/>
            <span style={{color:T.textSoft,fontSize:12}}>Ne</span>
          </div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,padding:"10px 0",borderTop:`1px solid ${T.border}`,fontSize:10,color:T.textSoft,flexWrap:"wrap",gap:16}}>
        {[["Status izrade","Radionica"],["Status isporuke","Isporuka"],["Status montaže","Montaža"],["Fakturisano","Knjiženje"]].map(([lbl,where],i)=>(
          <div key={i}>
            <div style={{marginBottom:3}}>{lbl}</div>
            <span style={{background:T.surfaceRaised,color:T.textSoft,border:`1px solid ${T.border}`,
              borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:600}}>— Ne</span>
            <div style={{fontSize:9,color:T.primary,marginTop:2}}>→ {where}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14,borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <div style={{background:"none",border:`1px solid ${T.border}`,color:T.textMid,
          borderRadius:T.radiusSm,padding:"6px 16px",fontSize:12}}>Otkaži</div>
        <div style={{background:T.primary,color:"#fff",borderRadius:T.radiusSm,
          padding:"6px 16px",fontSize:12,fontWeight:600}}>Sačuvaj</div>
      </div>
    </div>
  );

  const MBarChart = () => {
    const bars = [{l:"Jan",f:240,o:80,z:0},{l:"Feb",f:180,o:120,z:30},{l:"Mar",f:320,o:60,z:10},{l:"Apr",f:290,o:140,z:20}];
    const H=90;
    const maxV=Math.max(...bars.map(b=>b.f+b.o+b.z));
    return (
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"12px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.fontBody}}>Obračun po periodu</span>
          <div style={{display:"flex",gap:3}}>
            {["Dan","Sedmica","Mesec","Ukupno"].map((l,i)=>(
              <div key={i} style={{background:i===2?T.primary:T.surfaceRaised,
                border:`1px solid ${i===2?T.primary:T.border}`,
                color:i===2?"#fff":T.textMid,borderRadius:5,padding:"3px 9px",
                fontSize:10,fontFamily:T.fontBody,fontWeight:i===2?600:400}}>{l}</div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",height:H,paddingLeft:36,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:0,bottom:0,display:"flex",flexDirection:"column",
            justifyContent:"space-between",paddingBottom:0}}>
            {["500k","400k","300k","200k","100k","0"].map((l,i)=>(
              <div key={i} style={{color:T.textSoft,fontSize:8,fontFamily:T.fontBody,textAlign:"right",width:30}}>{l}</div>
            ))}
          </div>
          {bars.map((b,i)=>{
            const total=b.f+b.o+b.z;
            const fH=(b.f/maxV)*H; const oH=(b.o/maxV)*H; const zH=(b.z/maxV)*H;
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                <div style={{width:"70%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:H}}>
                  <div style={{width:"100%",background:T.purple,opacity:.85,height:zH,borderRadius:zH>0?"2px 2px 0 0":"0"}}/>
                  <div style={{width:"100%",background:T.amber,opacity:.85,height:oH}}/>
                  <div style={{width:"100%",background:T.primary,opacity:.85,height:fH,borderRadius:"0 0 2px 2px"}}/>
                </div>
                <span style={{fontSize:9,color:T.textSoft,marginTop:4,fontFamily:T.fontBody}}>{b.l}</span>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:12,marginTop:8,paddingLeft:36}}>
          {[{c:T.primary,l:"Faktura"},{c:T.amber,l:"Otpremnica"},{c:T.purple,l:"Zaduženje"}].map((x,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:8,height:8,borderRadius:2,background:x.c}}/>
              <span style={{fontSize:9,color:T.textSoft,fontFamily:T.fontBody}}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const MTooltip = () => (
    <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radius,
      padding:"10px 14px",display:"inline-block",boxShadow:T.shadowMd,fontFamily:T.fontBody,minWidth:160}}>
      <div style={{color:T.text,fontWeight:700,fontSize:12,marginBottom:6,fontFamily:T.fontHead}}>Mar 2025</div>
      {[["Faktura",T.primary,"320.000"],["Otpremnica",T.amber,"60.000"]].map(([t,c,v],i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:11,marginBottom:2}}>
          <span style={{color:c,fontWeight:600}}>{t}</span>
          <span style={{color:T.text,fontWeight:600}}>{v} RSD</span>
        </div>
      ))}
      <div style={{borderTop:`1px solid ${T.border}`,marginTop:6,paddingTop:6,
        display:"flex",justifyContent:"space-between",fontSize:11}}>
        <span style={{color:T.textSoft}}>Ukupno</span>
        <span style={{color:T.primary,fontWeight:700}}>380.000 RSD</span>
      </div>
    </div>
  );

  const MPermTable = () => (
    <div style={{overflowX:"auto",borderRadius:T.radiusSm,border:`1px solid ${T.border}`}}>
      <table style={{width:"100%",borderCollapse:"collapse",background:T.surface,fontSize:11,fontFamily:T.fontBody}}>
        <thead><tr>
          <th style={{padding:"6px 10px",textAlign:"left",color:T.textSoft,fontSize:9,textTransform:"uppercase",letterSpacing:".07em",fontWeight:700,borderBottom:`1px solid ${T.border}`,background:"#1C2330"}}>Kartica</th>
          <th style={{padding:"6px 10px",textAlign:"left",color:T.textSoft,fontSize:9,textTransform:"uppercase",letterSpacing:".07em",fontWeight:700,borderBottom:`1px solid ${T.border}`,background:"#1C2330"}}>Dozvola</th>
        </tr></thead>
        <tbody>
          {[["📋 Poslovi","edit",T.green,T.greenBg,T.greenBorder],
            ["⚡ Aktivni poslovi","edit",T.green,T.greenBg,T.greenBorder],
            ["🔧 Radionica","view",T.amber,T.amberBg,T.amberBorder],
            ["💰 Obračun","none",T.red,T.redBg,T.redBorder],
          ].map(([tab,lvl,c,bg,bdr],i)=>(
            <tr key={i} style={{background:i%2===0?T.surface:T.surfaceHover}}>
              <td style={{padding:"6px 10px",borderBottom:`1px solid ${T.border}`,color:T.textMid,fontSize:11}}>{tab}</td>
              <td style={{padding:"6px 10px",borderBottom:`1px solid ${T.border}`}}>
                <div style={{display:"flex",gap:5}}>
                  {[["none","Nema",T.red,T.redBg,T.redBorder],["view","Pregledaj",T.amber,T.amberBg,T.amberBorder],["edit","Uredi",T.green,T.greenBg,T.greenBorder]].map(([p,lbl,pc,pbg,pbdr])=>(
                    <label key={p} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",
                      background:lvl===p?pbg:"none",border:`1px solid ${lvl===p?pbdr:T.border}`,
                      borderRadius:T.radiusSm,padding:"2px 7px"}}>
                      <input type="radio" readOnly checked={lvl===p} style={{accentColor:pc,margin:0,width:10,height:10}}/>
                      <span style={{color:lvl===p?pc:T.textSoft,fontSize:10,fontWeight:lvl===p?600:400}}>{lbl}</span>
                    </label>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Section content functions ──────────────────────────────────────────────

  function SOpste() { return (
    <>
      <P>Aplikacija <strong style={{color:T.text}}>Poslovi</strong> je sistem za upravljanje radnim nalozima — od unosa i izrade do isporuke i fakturisanja. Svaki korisnik vidi i može menjati samo one delove za koje mu je dodeljen pristup.</P>

      <H3>Navigaciona traka</H3>
      <Frame label="Izgled navigacione trake"><MNavbar/></Frame>
      <P>Traka je uvek vidljiva na vrhu ekrana i sadrži:</P>
      <Ul items={[
        <><strong style={{color:T.text}}>Logo i naziv aplikacije</strong> — levo</>,
        <><strong style={{color:T.text}}>Kartice (tabovi)</strong> — vidite samo one za koje imate pristup; aktivna je istaknuta plavo</>,
        <><strong style={{color:T.text}}>Vaše ime, rola i dugme Odjava</strong> — desno</>,
      ]}/>
      <Note>Kada prelazite između kartica ili osvežite stranicu (<Kbd>F5</Kbd>), aplikacija automatski pamti i vraća vašu poslednju poziciju.</Note>

      <H3>Pretraga unutar tabele</H3>
      <Frame label="Toolbar — pretraga i upravljanje kolonama"><MToolbar/></Frame>
      <Steps items={[
        <>Ukucajte deo teksta u polje <strong style={{color:T.text}}>🔍 Pretraži... (Enter)</strong> — tabela se odmah filtrira pretragom kroz sve vidljive kolone istovremeno.</>,
        <>Pritisnite <Kbd>Enter</Kbd> ili <Kbd>Tab</Kbd> da primenite pretragu. Pritisnite <Kbd>Escape</Kbd> ili kliknite <strong style={{color:T.text}}>×</strong> da je obrišete.</>,
        <>Dok je pretraga aktivna, ivica polja za pretragu postaje plava kao vizuelni indikator.</>,
      ]}/>

      <H3>Sortiranje kolona</H3>
      <P>Kliknite na <strong style={{color:T.text}}>zaglavlje bilo koje kolone</strong> da sortirate tabelu po njoj. Ikonica pored naziva kolone pokazuje aktivan smer:</P>
      <div style={{display:"flex",gap:10,margin:"6px 0 10px",flexWrap:"wrap"}}>
        <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"5px 12px",fontSize:12,color:T.textMid,fontFamily:T.fontBody}}>
          Rok isporuke <span style={{color:T.primary,fontWeight:700}}>↑</span> — uzlazno
        </div>
        <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"5px 12px",fontSize:12,color:T.textMid,fontFamily:T.fontBody}}>
          Rok isporuke <span style={{color:T.primary,fontWeight:700}}>↓</span> — silazno
        </div>
        <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"5px 12px",fontSize:12,color:T.textMid,fontFamily:T.fontBody}}>
          Klijent <span style={{color:T.textSoft,opacity:.5}}>↕</span> — nije aktivno
        </div>
      </div>
      <P>Ponovnim klikom na istu kolonu menjate smer. Klik na drugu kolonu prebacuje sortiranje na nju.</P>

      <H3>Pregled zapisa (dupli klik)</H3>
      <P>Duplim klikom na bilo koji red u tabeli otvara se modalni prozor sa svim detaljima tog zapisa. Prozor se zatvara klikom na <strong style={{color:T.text}}>× dugme</strong> u uglu ili pritiskom na <Kbd>Escape</Kbd>.</P>

      <H3>Prevlačenje kolona</H3>
      <P>Zaglavlja tabele možete <strong style={{color:T.text}}>prevlačiti levo i desno</strong> mišem da promenite redosled kolona. Uhvatite zaglavlje, prevucite ga na novu poziciju i pustite — promena se odmah primenjuje. Ovo je privremeno; da biste sačuvali raspored trajno, koristite dugme <strong style={{color:T.text}}>⚙ Kolone</strong> (opisano u sledećoj sekciji).</P>

      <H3>Odjava</H3>
      <P>Kliknite dugme <strong style={{color:T.text}}>Odjava</strong> u desnom uglu navigacione trake. Sesija se odmah prekida i bićete prebačeni na ekran za prijavu.</P>
    </>
  ); }

  function SKolone() { return (
    <>
      <P>Svaka tabela u aplikaciji ima dugme <strong style={{color:T.text}}>⚙ Kolone</strong> u toolbaru iznad nje. Kroz ovaj meni možete potpuno prilagoditi koje kolone vidite i kojim redosledom — i sačuvati te postavke kao <em>raspored</em> koji se automatski primenjuje pri svakom otvaranju.</P>

      <H3>Meni za upravljanje kolonama</H3>
      <Frame label="Izgled menija ⚙ Kolone">
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
          <MColMenu/>
          <div style={{flex:1,minWidth:200,color:T.textSoft,fontSize:12,lineHeight:1.7,fontFamily:T.fontBody}}>
            <div style={{marginBottom:6}}><Tag color={T.amber}>★</Tag> — podrazumevani raspored: učitava se automatski</div>
            <div style={{marginBottom:6}}><Tag color={T.primary}>🌐</Tag> — zajednički raspored: vidljiv svim korisnicima</div>
            <div><Tag color={T.textSoft}>👤</Tag> — vaš lični raspored</div>
          </div>
        </div>
      </Frame>

      <H3>Uključivanje i isključivanje kolona</H3>
      <Steps items={[
        <>Kliknite <strong style={{color:T.text}}>⚙ Kolone</strong> u toolbaru da otvorite meni.</>,
        <>U delu <em>Redosled kolona</em> koristite <strong style={{color:T.text}}>kvačice</strong> pored svakog naziva da uključite ili isključite tu kolonu iz prikaza.</>,
        <>Promena se odmah vidi u tabeli dok meni ostaje otvoren.</>,
      ]}/>

      <H3>Promena redosleda kolona</H3>
      <Steps items={[
        <>U istom meniju, uhvatite ikonicu <strong style={{color:T.textSoft}}>⠿</strong> pored naziva kolone.</>,
        <>Prevucite je gore ili dole na željenu poziciju i pustite.</>,
        <>Ili direktno prevlačite zaglavlja kolona u tabeli (drag & drop).</>,
      ]}/>
      <Note>Kliknite <strong style={{color:T.text}}>Resetuj</strong> na dnu menija da se u potpunosti vratite na fabrički raspored kolona.</Note>

      <H3>Čuvanje rasporeda kolona</H3>
      <Frame label="Dijalog za čuvanje rasporeda"><MSaveDialog/></Frame>
      <Steps items={[
        <>Podesite kolone po želji, zatim kliknite <strong style={{color:T.text}}>Sačuvaj raspored</strong> na dnu menija.</>,
        <>Unesite naziv rasporeda (npr. <em>'Kompaktni pregled"</em>).</>,
        <>Opciono označite <strong style={{color:T.amber}}>★ Postavi kao podrazumevani</strong> — ovaj raspored će se automatski učitati pri svakom sledećem otvaranju aplikacije.</>,
        (profile?.can_publish_layouts||isAdmin) && <>Opciono označite <strong style={{color:T.primary}}>🌐 Objavi kao zajednički raspored</strong> — raspored postaje vidljiv svim korisnicima.</>,
        <>Kliknite <strong style={{color:T.text}}>Sačuvaj</strong>. Raspored se pojavljuje u meniju ⚙ Kolone.</>,
      ].filter(Boolean)}/>
      <Tip>Rasporedi su zasebni za svaku tabelu — Poslovi, Kupci i ostale tabele pamte svoje rasporede nezavisno.</Tip>

      <H3>Postavljanje podrazumevanog rasporeda (★)</H3>
      <P>Pored svakog sačuvanog rasporeda stoji dugme sa zvezdicom:</P>
      <div style={{margin:"8px 0",display:"flex",flexDirection:"column",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:10,background:T.amberBg,border:`1px solid ${T.amberBorder}`,borderRadius:T.radiusSm,padding:"7px 12px",fontFamily:T.fontBody,fontSize:12}}>
          <span style={{fontSize:16}}>★</span>
          <span style={{color:T.amber,fontWeight:600}}>Zlatna zvezda</span>
          <span style={{color:T.textMid}}>— ovaj raspored se automatski učitava pri svakom otvaranju aplikacije. Kliknite je ponovo da uklonite podrazumevani status.</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"7px 12px",fontFamily:T.fontBody,fontSize:12}}>
          <span style={{fontSize:16,color:T.textSoft}}>☆</span>
          <span style={{color:T.textSoft,fontWeight:600}}>Prazna zvezda</span>
          <span style={{color:T.textMid}}>— raspored postoji ali nije podrazumevani. Kliknite je da ga postavite kao podrazumevani.</span>
        </div>
      </div>
      <P>Samo jedan raspored može biti podrazumevani po tabeli. Kada postavite novi, prethodni automatski gubi tu ulogu. Ako nema podrazumevanog rasporeda, primenjuje se prvi pronađeni zajednički raspored (ako postoji), a inače fabrički raspored.</P>

      {(profile?.can_publish_layouts||isAdmin) && <>
        <H3>Objavljivanje zajedničkih rasporeda (🌐)</H3>
        <P>Imate dozvolu da objavljujete zajedničke rasporede. Kada čuvate raspored, označite opciju <strong style={{color:T.primary}}>🌐 Objavi kao zajednički raspored</strong>. Taj raspored biće vidljiv svim korisnicima sistema kao predlog u meniju ⚙ Kolone. Svaki korisnik može imati sopstveni podrazumevani raspored koji ima prednost pred zajedničkim.</P>
        <Note color={T.purple}>Zajednički raspored koji ste kreirali možete obrisati — samo vi i admini vidite dugme <strong style={{color:T.red}}>✕</strong> pored njega.</Note>
      </>}
    </>
  ); }

  function SPoslovi() {
    const edit = canEditTab("poslovi");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>📋 Poslovi</strong> prikazuje <em>sve</em> radne naloge u sistemu — i aktivne i završene — bez ikakvog filtera.</P>

        <H3>Tabela poslova</H3>
        <Frame label="Primer tabele svih poslova">
          <MToolbar/>
          <MTable
            cols={["Posao","Klijent","Šifra","Datum","Rok isporuke","Unosilac","Opis","Poslati","Montaža/Isporuka","Plaćanje","St. izrade","St. isporuke","St. montaže","Obračun",""]}
            rows={[
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000041</span>,"Metal d.o.o.","K00001","10.05.2025",<span style={{color:T.red,fontWeight:600,fontSize:10}}>01.04.2025</span>,"Ana K.","Metalne...",<MBadge>Tip A</MBadge>,<MBadge color={T.primary}>Montaža i is.</MBadge>,<MBadge>Faktura</MBadge>,<MCheck yes/>,<MCheck/>,<MCheck/>,"180.000 RSD",
                <div style={{display:"flex",gap:3}}><span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>Uredi</span><span style={{background:"none",border:`1px solid ${T.border}`,color:T.textMid,borderRadius:4,padding:"2px 8px",fontSize:10}}>⧉</span><span style={{background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:4,padding:"2px 8px",fontSize:10}}>Briši</span></div>],
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000042</span>,"Tehno Export","K00002","15.05.2025","30.06.2025","Petar P.","Alum...",<MBadge>Tip B</MBadge>,<MBadge color={T.green}>Samo isp.</MBadge>,<MBadge color={T.amber}>Otpremnica</MBadge>,<MCheck/>,<MCheck yes/>,<MCheck/>,"95.000 RSD",
                <div style={{display:"flex",gap:3}}><span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>Uredi</span><span style={{background:"none",border:`1px solid ${T.border}`,color:T.textMid,borderRadius:4,padding:"2px 8px",fontSize:10}}>⧉</span><span style={{background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:4,padding:"2px 8px",fontSize:10}}>Briši</span></div>],
            ]}
          />
        </Frame>

        <H3>Objašnjenje kolona</H3>
        <div style={{border:`1px solid ${T.border}`,borderRadius:T.radiusSm,overflow:"hidden",marginBottom:14}}>
          {[["Posao","Jedinstveni broj naloga u formatu P00000001 — automatski generisan."],
            ["Klijent","Naziv kupca iz baze kupaca."],
            ["Šifra","Automatska šifra kupca u formatu K00001."],
            ["Datum","Datum unosa naloga u sistem."],
            ["Rok isporuke","Planirani datum isporuke. Prikazuje se crveno ako je rok prošao."],
            ["Unosilac","Korisnik koji je uneo nalog."],
            ["Opis","Slobodan opis posla — u tabeli skraćen, u pregledu prikazan u celosti."],
            ["Poslati","Tip/opcija izrade poslan na izradu."],
            ["Montaža/Isporuka","Vrsta isporuke: Samo isporuka (zeleno) · Montaža i isporuka (plavo) · Lično preuzimanje (ljubičasto)."],
            ["Plaćanje","Faktura (plavo) · Otpremnica (narandžasto) · Zaduženje (ljubičasto)."],
            ["St. izrade / St. isporuke / St. montaže","Statusi se menjaju isključivo u odgovarajućim karticama (Radionica, Isporuka, Montaža) — ovde su samo informativni."],
            ["Obračun","Finansijski iznos posla u RSD."],
          ].map(([n,d],i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"190px 1fr",borderBottom:i<11?`1px solid ${T.border}`:"none",
              background:i%2===0?T.surface:T.surfaceHover}}>
              <div style={{padding:"7px 12px",color:T.text,fontSize:12,fontWeight:600,fontFamily:T.fontBody,borderRight:`1px solid ${T.border}`}}>{n}</div>
              <div style={{padding:"7px 12px",color:T.textSoft,fontSize:12,fontFamily:T.fontBody,lineHeight:1.5}}>{d}</div>
            </div>
          ))}
        </div>

        {edit ? <>
          <H3>Kreiranje novog posla</H3>
          <Note>Dugme <strong>+ Novi posao</strong> nalazi se u kartici <strong>⚡ Aktivni poslovi</strong> — ne ovde. Vidite ga samo ako imate dozvolu za uređivanje te kartice.</Note>
          <Steps items={[
            <>Kliknite <strong style={{color:T.text}}>+ Novi posao</strong> u gornjem desnom uglu kartice Aktivni poslovi.</>,
            <>Broj posla (<strong style={{color:T.primary}}>P00000001</strong>) i datum unosa (današnji) se automatski popunjavaju. Polje unosioca se popunjava vašim imenom.</>,
            <>Popunite sva potrebna polja u formi (detalji u nastavku).</>,
            <>Kliknite <strong style={{color:T.text}}>Sačuvaj</strong>. Posao je odmah vidljiv u svim relevantnim karticama.</>,
          ]}/>

          <H3>Forma za unos / izmenu posla</H3>
          <Frame label="Forma za unos posla"><MForm/></Frame>
          <div style={{border:`1px solid ${T.border}`,borderRadius:T.radiusSm,overflow:"hidden",marginBottom:14}}>
            {[["Posao","Automatski generisan broj. Polje je zaključano."],
              ["Datum unosa","Automatski postavljen na današnji datum pri kreiranju. Zaključan."],
              ["Klijent","Padajuća lista sa pretragom — ukucajte deo naziva ili šifre kupca da filtrirate."],
              ["Rok za isporuku","Birač datuma. Ako rok prođe, prikazuje se crveno u tabeli."],
              ["Unosilac posla","Padajuća lista korisnika sistema sa pretragom. Podrazumevano vaše ime."],
              ["Opis","Slobodan tekst — opišite sadržaj posla."],
              ["Specifikacija cene","Slobodan tekst — detaljna specifikacija cenovnika."],
              ["Obračun (RSD)","Numerička vrednost posla u dinarima."],
              ["Poslati na izradu","Padajuća lista unapred definisanih opcija izrade."],
              ["Montaža / Isporuka","Radio-dugmad: Samo isporuka · Montaža i isporuka · Lično preuzimanje."],
              ["Plaćanje","Radio-dugmad: Faktura · Otpremnica · Zaduženje."],
              ["Završen posao","Kvačica — označite kada je posao u celosti završen."],
            ].map(([n,d],i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"190px 1fr",borderBottom:i<11?`1px solid ${T.border}`:"none",
                background:i%2===0?T.surface:T.surfaceHover}}>
                <div style={{padding:"7px 12px",color:T.text,fontSize:12,fontWeight:600,fontFamily:T.fontBody,borderRight:`1px solid ${T.border}`}}>{n}</div>
                <div style={{padding:"7px 12px",color:T.textSoft,fontSize:12,fontFamily:T.fontBody,lineHeight:1.5}}>{d}</div>
              </div>
            ))}
          </div>
          <Warn>Statusi izrade, isporuke, montaže i fakturisanja prikazani su u formi samo informativno i ne mogu se menjati odavde. Menjaju se isključivo direktnim klikom u karticama Radionica, Isporuka, Montaža i Knjiženje.</Warn>

          <H3>Kopiranje posla (⧉)</H3>
          <P>Svaki red u tabeli ima dugme <strong style={{color:T.text}}>⧉</strong> između 'Uredi" i 'Briši". Klikom na njega otvara se popunjena forma za novi posao sa sledećim automatskim promenama:</P>
          <div style={{border:`1px solid ${T.border}`,borderRadius:T.radiusSm,overflow:"hidden",marginBottom:10}}>
            {[["Broj posla","Sledeći slobodan broj u nizu (automatski)","green"],
              ["Datum unosa","Današnji datum","green"],
              ["Unosilac","Vaše ime (trenutno prijavljeni korisnik)","green"],
              ["Status izrade","Ne","amber"],
              ["Status isporuke","Ne","amber"],
              ["Status montaže","Ne","amber"],
              ["Završen posao","Ne","amber"],
              ["Fakturisano","Ne","amber"],
              ["Svi ostali podaci","Prenose se neizmenjeni","primary"],
            ].map(([p,v,c],i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"190px 1fr",borderBottom:i<8?`1px solid ${T.border}`:"none",
                background:i%2===0?T.surface:T.surfaceHover}}>
                <div style={{padding:"6px 12px",color:T.text,fontSize:12,fontWeight:500,fontFamily:T.fontBody,borderRight:`1px solid ${T.border}`}}>{p}</div>
                <div style={{padding:"6px 12px",color:c==="green"?T.green:c==="amber"?T.amber:T.primary,fontSize:12,fontFamily:T.fontBody,fontWeight:600}}>→ {v}</div>
              </div>
            ))}
          </div>
          <Tip>Forma se otvara pre čuvanja — možete pregledati i izmeniti sve podatke pre nego što kliknete Sačuvaj. Kopiranje je korisno za ponavljajuće porudžbine istih klijenata.</Tip>

          <H3>Brisanje posla</H3>
          <Danger>Brisanje je <strong>trajno i ne može se poništiti</strong>. Pažljivo proverite pre potvrde.</Danger>
          <Steps items={[
            <>Kliknite <strong style={{color:T.red}}>Briši</strong> u redu koji želite obrisati.</>,
            <>Pojavljuje se dijalog za potvrdu. Kliknite crveno <strong style={{color:T.red}}>Obriši</strong> da potvrdite, ili <strong style={{color:T.textMid}}>Otkaži</strong> da odustanete.</>,
          ]}/>
        </> : <>
          <H3>Pregled posla</H3>
          <P>Duplim klikom na red ili klikom na dugme <strong style={{color:T.textMid}}>Pregled</strong> otvara se modalni prozor sa svim detaljima posla. Ne možete menjati podatke — samo ih pregledati.</P>
        </>}
      </>
    );
  }

  function SAktivni() {
    const edit = canEditTab("aktivni");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>⚡ Aktivni poslovi</strong> prikazuje samo poslove kojima je <em>Završen posao = Ne</em>. Ovo je glavna radna površina za svakodnevno praćenje tekućih naloga.</P>

        <H3>Statistike na vrhu</H3>
        <Frame label="Kartice sa statistikama">
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <MStat label="Aktivnih" value="12" color={T.amber}/>
            <MStat label="Ukupan obračun" value="1.840.000 RSD" color={T.green}/>
          </div>
        </Frame>
        <P>Dve kartice prikazuju ukupan broj aktivnih poslova i zbir svih obračuna. Vrednosti se automatski ažuriraju kada primenite pretragu u tabeli.</P>

        {edit ? <>
          <H3>Kreiranje novog posla</H3>
          <P>Kliknite <strong style={{color:T.text}}>+ Novi posao</strong> u gornjem desnom uglu. Detaljna uputstva za popunjavanje forme naći ćete u sekciji <strong style={{color:T.primary}}>📋 Svi poslovi</strong> ovog uputstva.</P>

          <H3>Inline promena statusa 'Završen"</H3>
          <P>U koloni <strong style={{color:T.text}}>Završen</strong> možete direktno kliknuti na kvačicu — bez otvaranja forme:</P>
          <Frame label="Direktna promena statusa Završen u tabeli">
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"4px 0",fontFamily:T.fontBody,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:10,color:T.textSoft,marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>Pre klika</div>
                <MCheck yes={false}/>
              </div>
              <span style={{color:T.textSoft,fontSize:18}}>→</span>
              <div>
                <div style={{fontSize:10,color:T.textSoft,marginBottom:5,textTransform:"uppercase",letterSpacing:".05em"}}>Nakon klika</div>
                <MCheck yes={true}/>
              </div>
              <div style={{background:T.greenBg,border:`1px solid ${T.greenBorder}`,borderRadius:T.radiusSm,padding:"6px 12px",fontSize:11,color:T.green,fontFamily:T.fontBody}}>
                Posao nestaje iz ovog pregleda i prelazi u ✅ Završeni poslovi
              </div>
            </div>
          </Frame>
          <P>Promena se odmah snima u bazu. Posao koji je označen kao završen nestaje iz ovog pregleda i pojavljuje se u kartici <strong style={{color:T.text}}>✅ Završeni poslovi</strong>.</P>
        </> : <>
          <P>Imate pravo pregleda — možete pregledati sve podatke ali ne možete menjati statuse niti dodavati nove poslove.</P>
        </>}
      </>
    );
  }

  function SZavrseni() {
    const edit = canEditTab("zavrseni");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>✅ Završeni poslovi</strong> prikazuje samo poslove kojima je <em>Završen posao = Da</em>. Ovo je arhiva kompletiranih radnih naloga.</P>
        <Frame label="Statistike završenih poslova">
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <MStat label="Završenih" value="87" color={T.green}/>
            <MStat label="Ukupan obračun" value="14.200.000 RSD" color={T.primary}/>
          </div>
        </Frame>
        <P>Kartice prikazuju ukupan broj završenih poslova i zbir svih obračuna za prikazani skup. Kada primenite pretragu, statistike se ažuriraju prema filtriranom skupu — korisno za analizu po klijentu ili periodu.</P>
        {edit && <Tip>Završeni poslovi se mogu kopirati dugmetom <strong style={{color:T.text}}>⧉</strong> da biste brzo kreirali sličan novi nalog — korisno za ponavljajuće porudžbine istog klijenta.</Tip>}
        {!edit && <P>Imate pravo pregleda — možete pregledati arhivirane poslove ali ih ne možete menjati.</P>}
      </>
    );
  }

  function SRadionica() {
    const edit = canEditTab("radionica");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>🔧 Radionica</strong> prikazuje <em>sve</em> poslove (i aktivne i završene) i namenjena je isključivo za evidentiranje fizičke izrade u radionici.</P>
        <Warn>Status izrade se menja <strong>samo ovde</strong> — direktnim klikom na kvačicu u tabeli. U formi za uređivanje posla taj status se prikazuje samo informativno i nije moguće menjati ga odande.</Warn>

        <H3>Tabela radionice</H3>
        <Frame label="Tabela Radionica sa inline promenama statusa">
          <MToolbar/>
          <MTable
            cols={["Posao","Klijent","Šifra","Datum","Rok","Unosilac","Opis","Status izrade"]}
            rows={[
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000041</span>,"Metal d.o.o.","K00001","10.05.2025","20.06.2025","Ana K.","Metalne kons.",<MCheck yes/>],
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000042</span>,"Tehno Export","K00002","15.05.2025","30.06.2025","Petar P.","Alum. profili",<MCheck/>],
            ]}
          />
        </Frame>

        {edit ? <>
          <H3>Promena statusa izrade</H3>
          <Steps items={[
            <>Pronađite posao u tabeli (koristite pretragu za brže pronalaženje).</>,
            <>U koloni <strong style={{color:T.text}}>Status izrade</strong> kliknite direktno na kvačicu.</>,
            <>Status se odmah menja i automatski snima — klik menja <MCheck/> u <MCheck yes/> i obrnuto.</>,
          ]}/>
        </> : <P>Imate pravo pregleda — vidite statuse ali ih ne možete menjati.</P>}
      </>
    );
  }

  function SMontaza() {
    const edit = canEditTab("montaza");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>🏗 Montaža</strong> prikazuje samo poslove kojima je tip isporuke <strong style={{color:T.primary}}>Montaža i isporuka</strong>. Namenjena je praćenju da li je montaža na terenu obavljena.</P>
        <Warn>Status montaže se menja <strong>samo ovde</strong> — direktnim klikom na kvačicu u koloni Status montaže.</Warn>
        <Note>Poslovi sa tipom isporuke <em>Samo isporuka</em> ili <em>Lično preuzimanje</em> <strong>nisu vidljivi</strong> u ovoj kartici.</Note>

        <H3>Tabela montaže</H3>
        <Frame label="Tabela Montaža">
          <MToolbar/>
          <MTable
            cols={["Posao","Klijent","Šifra","Datum","Rok","Unosilac","Opis","Status montaže"]}
            rows={[
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000041</span>,"Metal d.o.o.","K00001","10.05.2025","20.06.2025","Ana K.","Metalne kons.",<MCheck/>],
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000039</span>,"Kovač d.o.o.","K00005","01.05.2025","15.06.2025","Petar P.","Čelične kons.",<MCheck yes/>],
            ]}
          />
        </Frame>

        {edit ? <>
          <H3>Promena statusa montaže</H3>
          <Steps items={[
            <>Pronađite posao u tabeli.</>,
            <>Kliknite direktno na kvačicu u koloni <strong style={{color:T.text}}>Status montaže</strong>.</>  ,
            <>Promena se odmah snima bez dodatne potvrde.</>,
          ]}/>
        </> : <P>Imate pravo pregleda — vidite statuse ali ih ne možete menjati.</P>}
      </>
    );
  }

  function SIsporuka() {
    const edit = canEditTab("isporuka");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>🚚 Isporuka</strong> prikazuje poslove kojima je tip isporuke <strong style={{color:T.green}}>Samo isporuka</strong> ili <strong style={{color:T.primary}}>Montaža i isporuka</strong>. Ovde se evidentira da li je roba fizički isporučena kupcu.</P>
        <Warn>Status isporuke se menja <strong>samo ovde</strong> — direktnim klikom na kvačicu u koloni Status isporuke.</Warn>
        <Note>Poslovi sa tipom isporuke <em>Lično preuzimanje</em> <strong>nisu vidljivi</strong> u ovoj kartici.</Note>

        <H3>Tabela isporuke</H3>
        <Frame label="Tabela Isporuka">
          <MToolbar/>
          <MTable
            cols={["Posao","Klijent","Šifra","Datum","Rok","Unosilac","Opis","Status isporuke"]}
            rows={[
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000042</span>,"Tehno Export","K00002","15.05.2025","30.06.2025","Ana K.","Alum. profili",<MCheck/>],
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000041</span>,"Metal d.o.o.","K00001","10.05.2025","20.06.2025","Petar P.","Metalne kons.",<MCheck yes/>],
            ]}
          />
        </Frame>

        {edit ? <>
          <H3>Promena statusa isporuke</H3>
          <Steps items={[
            <>Pronađite posao u tabeli.</>,
            <>Kliknite direktno na kvačicu u koloni <strong style={{color:T.text}}>Status isporuke</strong>.</>,
            <>Promena se odmah snima bez dodatne potvrde.</>,
          ]}/>
        </> : <P>Imate pravo pregleda — vidite statuse ali ih ne možete menjati.</P>}
      </>
    );
  }

  function SKnjizenje() {
    const edit = canEditTab("knjizenje");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>📒 Knjiženje</strong> prikazuje završene poslove sa načinom plaćanja <strong style={{color:T.primary}}>Faktura</strong>. Ovde se evidentira da li je svaka faktura proknjižena u računovodstvenom sistemu.</P>
        <Note>U ovoj kartici prikazuju se <strong>isključivo</strong> završeni poslovi sa plaćanjem 'Faktura". Otpremnice i zaduženja ovde nisu vidljivi.</Note>

        <H3>Statistike knjiženja</H3>
        <Frame label="Kartice sa statistikama knjiženja">
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <MStat label="Za knjiženje" value="24" color={T.primary}/>
            <MStat label="Fakturisano" value="19" color={T.green}/>
            <MStat label="Nije fakt." value="5" color={T.amber}/>
            <MStat label="Ukupan obračun" value="8.640.000 RSD" color={T.textMid}/>
          </div>
        </Frame>
        <P>Četiri kartice prikazuju ukupan broj faktura za knjiženje, koliko je fakturisano, koliko nije, i ukupnu vrednost. Ažuriraju se prema pretrazi.</P>

        <H3>Tabela knjiženja</H3>
        <Frame label="Tabela Knjiženja">
          <MToolbar/>
          <MTable
            cols={["Posao","Klijent","Šifra","Datum","Opis","Specifikacija","Obračun","Fakturisano"]}
            rows={[
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000038</span>,"Metal d.o.o.","K00001","10.04.2025","Metalne kons.","Spec A","180.000 RSD",<MCheck yes/>],
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>P00000036</span>,"Tehno Export","K00002","01.04.2025","Alum. profili","Spec B","95.000 RSD",<MCheck/>],
            ]}
          />
        </Frame>

        {edit ? <>
          <H3>Evidentiranje fakturisanja</H3>
          <Steps items={[
            <>Pronađite posao koji je proknjižen u vašem računovodstvenom sistemu.</>,
            <>U koloni <strong style={{color:T.text}}>Fakturisano</strong> kliknite direktno na kvačicu.</>,
            <>Status se odmah menja i snima. Statistike na vrhu automatski ažuriraju sve vrednosti.</>,
          ]}/>
        </> : <P>Imate pravo pregleda — vidite statuse fakturisanja ali ih ne možete menjati.</P>}
      </>
    );
  }

  function SKupci() {
    const edit = canEditTab("kupci");
    return (
      <>
        <P>Kartica <strong style={{color:T.text}}>🏢 Kupci</strong> je baza podataka svih klijenata. Kupci se koriste pri kreiranju radnih naloga — iz padajuće liste se biraju naziv i šifra kupca koja se automatski preuzima.</P>
        <Note>Šifra kupca se automatski generiše u formatu <Tag>K00001</Tag>, <Tag>K00002</Tag>... rednim brojem pri kreiranju novog kupca — ne možete je ručno odrediti.</Note>

        <H3>Tabela kupaca</H3>
        <Frame label="Tabela Kupci">
          <MToolbar/>
          <MTable
            cols={["Šifra","Naziv","Grad","Ulica","Br.","Poštanski","Telefon","PIB",""]}
            rows={[
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>K00001</span>,"Metal d.o.o.","Beograd","Industrijska","14","11000","011/123-456","101234567",<div style={{display:"flex",gap:3}}><span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>Uredi</span><span style={{background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:4,padding:"2px 8px",fontSize:10}}>Briši</span></div>],
              [<span style={{color:T.primary,fontWeight:700,fontSize:11}}>K00002</span>,"Tehno Export","Novi Sad","Futog. put","7b","21000","021/654-321","987654321",<div style={{display:"flex",gap:3}}><span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>Uredi</span><span style={{background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:4,padding:"2px 8px",fontSize:10}}>Briši</span></div>],
            ]}
          />
        </Frame>

        <H3>Pregled detalja kupca</H3>
        <Steps items={[
          <>Duplim klikom na red ili klikom na <strong style={{color:T.textMid}}>Pregled</strong> otvorite modal sa svim podacima.</>,
          <>Pored adresnih podataka, prikazuje se i <strong style={{color:T.text}}>lista svih radnih naloga tog kupca</strong> (kao klikabilne oznake broja posla).</>,
          <>Kliknite na broj posla unutar pregleda kupca da direktno otvorite taj nalog.</>,
        ]}/>

        {edit ? <>
          <H3>Kreiranje novog kupca</H3>
          <Steps items={[
            <>Kliknite <strong style={{color:T.text}}>+ Novi kupac</strong> u gornjem desnom uglu kartice.</>,
            <>Šifra se automatski generiše (sledeća slobodna u nizu).</>,
            <>Unesite: Naziv, Grad, Ulica, Broj, Poštanski broj, Telefon, PIB.</>,
            <>Kliknite <strong style={{color:T.text}}>Sačuvaj</strong>.</>,
          ]}/>

          <H3>Izmena podataka kupca</H3>
          <Steps items={[
            <>Kliknite <strong style={{color:T.primary}}>Uredi</strong> u redu kupca (ili <em>Uredi</em> dugme unutar pregleda).</>,
            <>Izmenite željene podatke u formi.</>,
            <>Kliknite <strong style={{color:T.text}}>Sačuvaj</strong>.</>,
          ]}/>

          <H3>Brisanje kupca</H3>
          <Danger>Brisanje kupca je trajno i ne može se poništiti. Radni nalozi koji referenciraju tog kupca ostaju u bazi — šifra kupca ostaje upisana na nalogu ali kupac više neće biti dostupan u padajućoj listi.</Danger>
        </> : <P>Imate pravo pregleda — možete pregledati podatke kupaca ali ne možete dodavati, menjati niti brisati kupce.</P>}
      </>
    );
  }

  function SObracun() { return (
    <>
      <P>Kartica <strong style={{color:T.text}}>💰 Obračun</strong> pruža finansijski pregled svih poslova — ukupne iznose grupisane po načinu plaćanja, interaktivni grafikon po vremenskom periodu, i sumarnu tabelu.</P>

      <H3>Filter datuma unosa</H3>
      <Frame label="Filteri datuma">
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"12px 16px",display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end",fontFamily:T.fontBody}}>
          {["Od datuma unosa","Do datuma unosa"].map((lbl,i)=>(
            <div key={i}>
              <div style={{color:T.textSoft,fontSize:10,fontWeight:500,marginBottom:3}}>{lbl}</div>
              <div style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,
                padding:"6px 10px",fontSize:11,color:T.textSoft,width:140,fontFamily:T.fontBody}}>dd.mm.yyyy</div>
            </div>
          ))}
          <div style={{background:"none",border:`1px solid ${T.border}`,borderRadius:T.radiusSm,
            padding:"6px 12px",fontSize:11,color:T.textMid,fontFamily:T.fontBody}}>✕ Resetuj</div>
          <div style={{fontSize:11,color:T.textSoft,fontFamily:T.fontBody}}>
            <strong style={{color:T.text}}>34</strong> od <strong style={{color:T.text}}>120</strong> poslova
          </div>
        </div>
      </Frame>
      <Steps items={[
        <>Unesite <strong style={{color:T.text}}>Od datuma unosa</strong> i/ili <strong style={{color:T.text}}>Do datuma unosa</strong> da ograničite period analize.</>,
        <>Ispod filtera prikazuje se koliko poslova je uključeno od ukupnog broja u sistemu.</>,
        <>Kliknite <strong style={{color:T.text}}>✕ Resetuj</strong> da uklonite filter i prikažete sve poslove. Dugme se pojavljuje samo kad je filter aktivan.</>,
      ]}/>

      <H3>Kartice po načinu plaćanja</H3>
      <Frame label="Kartice — zbir po plaćanju">
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          <MStat label="Faktura" value="8.640.000 RSD" color={T.primary} sub="12 poslova"/>
          <MStat label="Otpremnica" value="2.100.000 RSD" color={T.amber} sub="5 poslova"/>
          <MStat label="Zaduženje" value="960.000 RSD" color={T.purple} sub="3 poslova"/>
        </div>
      </Frame>
      <P>Za svaki način plaćanja prikazuje se ukupan zbir obračuna i broj poslova u odabranom periodu. Kartice se ažuriraju u realnom vremenu prema aktivnom filteru datuma.</P>

      <H3>Grafikon — Obračun po periodu</H3>
      <Frame label="Složeni stubičasti grafikon">
        <MBarChart/>
      </Frame>
      <P>Stubičasti grafikon prikazuje iznose grupisane po vremenskim periodima. Svaki stubić je složen (stacked) — boje prikazuju doprinos svakog načina plaćanja. Pređite mišem iznad stubića da vidite tooltip sa razčlanjenim iznosima:</P>
      <Frame label="Tooltip pri prelasku mišem">
        <MTooltip/>
      </Frame>
      <P>Dugmad za grupisanje X ose (iznad grafikona):</P>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,margin:"6px 0 12px"}}>
        {[["Dan","Jedan stub po kalendarskom danu. Pogodno za kratke periode."],
          ["Sedmica","Grupisano po ISO sedmici — oznaka je datum ponedeljka te sedmice."],
          ["Mesec","Grupisano po mesecu — oznaka je npr. 'Jan 2025'. Podrazumevano."],
          ["Ukupno","Jedan jedini stub za ceo izabrani period — brzi ukupni pregled."]
        ].map(([k,d],i)=>(
          <div key={i} style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,borderRadius:T.radiusSm,padding:"8px 11px"}}>
            <div style={{color:T.text,fontSize:12,fontWeight:700,fontFamily:T.fontBody,marginBottom:3}}>{k}</div>
            <div style={{color:T.textSoft,fontSize:11,fontFamily:T.fontBody,lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>
      <Note>Kada ima više od 10 grupa, oznake na X osi se automatski nagnu pod uglom radi čitkosti.</Note>

      <H3>Sumarnu tabela</H3>
      <Frame label="Sumarnu tabela po plaćanjima">
        <div style={{overflowX:"auto",borderRadius:T.radiusSm,border:`1px solid ${T.border}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",background:T.surface,fontSize:11,fontFamily:T.fontBody}}>
            <thead><tr>{["Plaćanje","Broj poslova","Ukupan obračun"].map((h,i)=>(
              <th key={i} style={{padding:"6px 12px",textAlign:"left",color:T.textSoft,fontSize:9,textTransform:"uppercase",letterSpacing:".07em",fontWeight:700,borderBottom:`1px solid ${T.border}`,background:"#1C2330"}}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {[["Faktura",T.primary,12,"8.640.000"],["Otpremnica",T.amber,5,"2.100.000"],["Zaduženje",T.purple,3,"960.000"]].map(([t,c,n,s],i)=>(
                <tr key={i} style={{background:i%2===0?T.surface:T.surfaceHover}}>
                  <td style={{padding:"6px 12px",borderBottom:`1px solid ${T.border}`}}><MBadge color={c}>{t}</MBadge></td>
                  <td style={{padding:"6px 12px",borderBottom:`1px solid ${T.border}`,color:T.textMid}}>{n}</td>
                  <td style={{padding:"6px 12px",borderBottom:`1px solid ${T.border}`,color:T.green,fontWeight:600}}>{s} RSD</td>
                </tr>
              ))}
              <tr style={{background:T.surfaceRaised,borderTop:`2px solid ${T.border}`}}>
                <td style={{padding:"7px 12px",color:T.text,fontWeight:700,fontSize:12,fontFamily:T.fontBody}}>UKUPNO</td>
                <td style={{padding:"7px 12px",color:T.textMid,fontWeight:700,fontSize:12,fontFamily:T.fontBody}}>20</td>
                <td style={{padding:"7px 12px",color:T.primary,fontWeight:800,fontSize:13,fontFamily:T.fontHead}}>11.700.000 RSD</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Frame>
      <P>Tabela ispod grafikona prikazuje sumarni pregled po plaćanjima sa redom <strong style={{color:T.text}}>UKUPNO</strong> koji sabira sve kategorije. Vrednosti prate aktivan filter datuma.</P>
    </>
  ); }

  function SKorisnici() { return (
    <>
      <P>Kartica <strong style={{color:T.text}}>👥 Korisnici</strong> dostupna je samo administratorima. Ovde se pregledaju i uređuju dozvole za sve korisnike sistema.</P>
      <Warn>Novi korisnici se <strong>ne kreiraju ovde</strong>. Kreiraju se isključivo kroz <strong>Supabase → Authentication → Add user</strong> (email + lozinka). Nakon kreiranja, profil se automatski pojavljuje u ovoj listi.</Warn>

      <H3>Tabela korisnika</H3>
      <Frame label="Tabela korisnika sa dozvolama">
        <MToolbar/>
        <MTable
          cols={["Ime","Prezime","Telefon","Adresa","Rola","Obj. rasporede","Kartice",""]}
          rows={[
            ["Ana","Nikolić","011/111-222","Beograd",<MBadge color={T.primary}>Admin</MBadge>,<MBadge color={T.green}>✓ Da</MBadge>,<div style={{display:"flex",gap:3,flexWrap:"wrap"}}><MBadge color={T.green}>Sve</MBadge></div>,<span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>Uredi dozvole</span>],
            ["Petar","Petrović","021/222-333","Novi Sad",<MBadge color={T.textMid}>Korisnik</MBadge>,"—",<div style={{display:"flex",gap:3,flexWrap:"wrap"}}><MBadge color={T.green}>Aktivni</MBadge><MBadge color={T.amber}>Radionica</MBadge></div>,<span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>Uredi dozvole</span>],
          ]}
        />
      </Frame>
      <P>Kolona <strong style={{color:T.text}}>Obj. rasporede</strong> pokazuje da li korisnik ima pravo da objavljuje zajedničke rasporede kolona. Kolona <strong style={{color:T.text}}>Kartice</strong> prikazuje spisak kartica kojima korisnik ima pristup.</P>

      <H3>Uređivanje dozvola korisnika</H3>
      <Steps items={[
        <>Kliknite <strong style={{color:T.primary}}>Uredi dozvole</strong> u redu korisnika koji želite urediti.</>,
        <>U formi možete izmeniti osnovne podatke: <strong style={{color:T.text}}>Ime, Prezime, Telefon, Adresa</strong>.</>,
        <>Za svaku karticu postavite nivo dozvole klikom na radio-dugme.</>,
        <>Opciono: označite <strong style={{color:T.purple}}>🌐 Može da objavljuje zajedničke rasporede kolona</strong> ako korisniku treba ta mogućnost.</>,
        <>Kliknite <strong style={{color:T.text}}>Sačuvaj</strong>. Izmene stupaju na snagu odmah — korisnik će ih videti pri sledećem učitavanju stranice.</>,
      ]}/>

      <H3>Nivoi dozvola po kartici</H3>
      <Frame label="Primer tabele dozvola">
        <MPermTable/>
      </Frame>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
        {[
          ["Nema",T.red,T.redBg,T.redBorder,"Kartica nije vidljiva korisniku — ne pojavljuje se u navigaciji."],
          ["Pregledaj",T.amber,T.amberBg,T.amberBorder,"Kartica je vidljiva. Podaci se mogu čitati. Ništa se ne može menjati."],
          ["Uredi",T.green,T.greenBg,T.greenBorder,"Pun pristup — kreiranje, izmena, brisanje, kopiranje, inline promene statusa."],
        ].map(([lbl,c,bg,bdr,desc],i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",background:bg,
            border:`1px solid ${bdr}`,borderRadius:T.radiusSm,padding:"7px 12px"}}>
            <div style={{color:c,fontWeight:700,fontSize:12,fontFamily:T.fontBody,flexShrink:0,minWidth:70}}>{lbl}</div>
            <div style={{color:T.textMid,fontSize:12,fontFamily:T.fontBody,lineHeight:1.5}}>{desc}</div>
          </div>
        ))}
      </div>
      <Note color={T.purple}>Admini automatski imaju pun pristup svim karticama i mogu da objavljuju zajedničke rasporede — bez obzira na postavke dozvola.</Note>

      <H3>Napomene za administratore</H3>
      <div style={{border:`1px solid ${T.border}`,borderRadius:T.radiusSm,overflow:"hidden"}}>
        {[["Kreiranje korisnika","Obavezno kroz Supabase → Authentication → Add user. Nije moguće iz aplikacije."],
          ["Brisanje korisnika","Obavezno kroz Supabase → Authentication. Nije moguće iz aplikacije."],
          ["Resetovanje lozinke","Isključivo kroz Supabase Authentication ili Supabase Reset Password funkciju."],
          ["Postavljanje admin statusa","Direktno u Supabase tabeli profiles (polje is_admin = true) — nije dostupno iz forme."],
        ].map(([n,d],i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"200px 1fr",borderBottom:i<3?`1px solid ${T.border}`:"none",
            background:i%2===0?T.surface:T.surfaceHover}}>
            <div style={{padding:"7px 12px",color:T.text,fontSize:12,fontWeight:600,fontFamily:T.fontBody,borderRight:`1px solid ${T.border}`}}>{n}</div>
            <div style={{padding:"7px 12px",color:T.textSoft,fontSize:12,fontFamily:T.fontBody,lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>
    </>
  ); }

  const renderContent = id => {
    switch(id) {
      case "opste":     return <SOpste/>;
      case "kolone":    return <SKolone/>;
      case "poslovi":   return <SPoslovi/>;
      case "aktivni":   return <SAktivni/>;
      case "zavrseni":  return <SZavrseni/>;
      case "radionica": return <SRadionica/>;
      case "montaza":   return <SMontaza/>;
      case "isporuka":  return <SIsporuka/>;
      case "knjizenje": return <SKnjizenje/>;
      case "kupci":     return <SKupci/>;
      case "obracun":   return <SObracun/>;
      case "korisnici": return <SKorisnici/>;
      default: return null;
    }
  };

  return (
    <div style={{display:"flex",minHeight:"calc(100vh - 52px)"}}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div style={{
        width:230, flexShrink:0,
        borderRight:`1px solid ${T.border}`,
        background:T.surface,
        position:"sticky", top:52,
        height:"calc(100vh - 52px)",
        overflowY:"auto",
        padding:"18px 0",
      }}>
        <div style={{padding:"0 16px 10px",
          color:T.textSoft,fontSize:9,fontWeight:700,
          textTransform:"uppercase",letterSpacing:".09em",fontFamily:T.fontBody}}>
          Sadržaj uputstva
        </div>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>scrollTo(s.id)} style={{
            display:"block",width:"100%",textAlign:"left",
            background:activeId===s.id?T.primaryLight:"none",
            borderLeft:`3px solid ${activeId===s.id?T.primary:"transparent"}`,
            border:"none",
            color:activeId===s.id?T.primary:T.textMid,
            padding:"8px 16px",cursor:"pointer",
            fontSize:12,fontFamily:T.fontBody,
            fontWeight:activeId===s.id?600:400,
            lineHeight:1.4,
            transition:"all 0.12s",
          }}>
            {s.title}
          </button>
        ))}
        <div style={{padding:"14px 16px 0",marginTop:8,borderTop:`1px solid ${T.border}`,
          color:T.textSoft,fontSize:10,fontFamily:T.fontBody,lineHeight:1.5}}>
          {isAdmin ? "Prikazane sve sekcije" : `${SECTIONS.length} sekcija na osnovu vaših dozvola`}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div ref={contentRef} style={{
        flex:1, overflowY:"auto",
        height:"calc(100vh - 52px)",
        padding:"36px 44px",
        maxWidth:880,
      }}>

        {/* Hero */}
        <div style={{marginBottom:40,paddingBottom:32,borderBottom:`2px solid ${T.border}`}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,
            background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,
            borderRadius:T.radiusSm,padding:"3px 12px",marginBottom:14}}>
            <div style={{width:5,height:5,background:T.primary,borderRadius:"50%"}}/>
            <span style={{color:T.primary,fontSize:10,fontWeight:700,
              letterSpacing:".07em",textTransform:"uppercase",fontFamily:T.fontBody}}>
              Korisnički priručnik
            </span>
          </div>
          <h1 style={{fontFamily:T.fontHead,fontSize:32,fontWeight:800,
            color:T.text,letterSpacing:"-0.04em",lineHeight:1.1,
            margin:"0 0 12px"}}>
            Uputstvo za korišćenje
          </h1>
          <p style={{color:T.textMid,fontSize:13,lineHeight:1.8,maxWidth:560,
            margin:"0 0 16px",fontFamily:T.fontBody}}>
            Kompletno uputstvo za aplikaciju <strong style={{color:T.text}}>Poslovi</strong>.
            Prikazane su samo sekcije kojima imate pristup — sadržaj se automatski prilagođava vašim dozvolama.
          </p>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {SECTIONS.filter(s=>s.tab).map(s=>{
              const lvl = isAdmin?"edit":canEditTab(s.tab)?"edit":"view";
              const c = lvl==="edit"?T.green:T.amber;
              const bg= lvl==="edit"?T.greenBg:T.amberBg;
              const bd= lvl==="edit"?T.greenBorder:T.amberBorder;
              return (
                <span key={s.id} style={{background:bg,color:c,border:`1px solid ${bd}`,
                  borderRadius:4,padding:"2px 9px",fontSize:10,fontWeight:600,fontFamily:T.fontBody}}>
                  {s.title} — {lvl==="edit"?"Uredi":"Pregled"}
                </span>
              );
            })}
            {isAdmin && <span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:4,padding:"2px 9px",fontSize:10,fontWeight:600,fontFamily:T.fontBody}}>★ Admin — pun pristup</span>}
          </div>
        </div>

        {/* Section blocks */}
        {SECTIONS.map((s, idx) => (
          <Sec key={s.id} id={s.id}>
            <H2>{s.title}</H2>
            {renderContent(s.id)}
            {idx < SECTIONS.length-1 && (
              <div style={{borderBottom:`1px solid ${T.border}`,marginTop:44}}/>
            )}
          </Sec>
        ))}

        <div style={{marginTop:24,paddingTop:20,borderTop:`1px solid ${T.border}`,
          color:T.textSoft,fontSize:11,textAlign:"center",fontFamily:T.fontBody,lineHeight:1.6}}>
          Poslovi App · Korisnički priručnik · Sadržaj prilagođen vašim dozvolama
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authUser,setAuthUser]       = useState(null);
  const [profile,setProfile]         = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [view,setView]               = useState(()=>sessionStorage.getItem("lastView")||"aktivni");
  const [poslovi,setPoslovi]         = useState([]);
  const [kupci,setKupci]             = useState([]);
  const [izradaOptions,setIzradaOptions] = useState([]);
  const [users,setUsers]             = useState([]);
  const [loading,setLoading]         = useState(false);
  const [globalErr,setGlobalErr]     = useState("");

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

  const perm    = tab => profile?.tab_permissions?.[tab]||"none";
  const canSee  = tab => tab==="uputstvo" || (tab==="changelog" && profile?.is_admin) || perm(tab)!=="none";
  const canEdit = tab => perm(tab)==="edit";
  const tf = k => v => setTempData(d=>({...d,[k]:v}));

  async function inlineUpdate(id, appField, value) {
    const fieldMap = { StatusIzrade:"status_izrade", StatusIsporuke:"status_isporuke", StatusMontaze:"status_montaze", Fakturisano:"fakturisano", ZavrsenPosao:"zavrsen_posao" };
    const dbField = fieldMap[appField];
    if (!dbField) return;
    const oldPosao = poslovi.find(p=>p.id===id);
    const oldValue = oldPosao?.[appField];
    setPoslovi(ps=>ps.map(p=>p.id===id?{...p,[appField]:value}:p));
    const {error} = await sb.from("poslovi").update({[dbField]:value}).eq("id",id);
    if (error) { setGlobalErr("Greška: "+error.message); loadPoslovi(); return; }
    // OPT 2: only log financially significant inline fields
    if (INLINE_LOG.has(appField)) {
      await writeLog({
        entity_type:"posao", entity_id:id,
        entity_label:oldPosao?.Posao||String(id),
        action:"update",
        changes:[{ field:appField, label:INLINE_LABELS[appField], old:fmtVal(oldValue), new:fmtVal(value) }],
      });
    }
  }

  // ── Changelog helpers ─────────────────────────────────────────────────────────
  // OPT 1: one row per save, all changed fields packed into changes[] JSON
  // OPT 2: skip low-signal operational statuses (Izrada/Isporuka/Montaza)
  const POSAO_LABELS = {
    KLIJENT:"Klijent", SifraKupca:"Šifra kupca",
    DatumUnosa:"Datum unosa", RokZaIsporuku:"Rok za isporuku", Unosilac:"Unosilac",
    Opis:"Opis", PoslatiNaIzradu:"Poslati na izradu", MontazaIsporuka:"Montaža/Isporuka",
    Placanje:"Plaćanje", SpecifikacijaCene:"Specifikacija cene",
    Obracun:"Obračun (RSD)", ZavrsenPosao:"Završen posao", Fakturisano:"Fakturisano",
  };
  const KUPAC_LABELS = {
    Naziv:"Naziv", Grad:"Grad", Ulica:"Ulica", Broj:"Broj", PostanskiBroj:"Poštanski broj",
    Telefon:"Telefon", PIB:"PIB",
  };
  const USER_LABELS = {
    ime:"Ime", prezime:"Prezime", telefon:"Telefon", adresa:"Adresa",
    tab_permissions:"Dozvole", can_publish_layouts:"Objavljuje rasporede",
  };
  // OPT 2: only financially meaningful inline fields get logged
  const INLINE_LOG   = new Set(["ZavrsenPosao","Fakturisano"]);
  const INLINE_LABELS = { ZavrsenPosao:"Završen posao", Fakturisano:"Fakturisano" };

  function fmtVal(v) {
    if (v === null || v === undefined || v === "") return "—";
    if (v === true)  return "Da";
    if (v === false) return "Ne";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  // OPT 1: single INSERT per operation with changes as JSON array
  async function writeLog({ entity_type, entity_id, entity_label, action, changes }) {
    if (action === "update" && (!changes || changes.length === 0)) return;
    const actor = profile ? `${profile.ime||""} ${profile.prezime||""}`.trim() : "—";
    const { error } = await sb.from("change_log").insert([{
      actor,
      entity_type,
      entity_id:    String(entity_id),
      entity_label,
      action,
      changes:      changes || null,
      created_at:   new Date().toISOString(),
    }]);
    if (error) console.warn("change_log insert failed:", error.message);
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
  async function copyPosao(p) {
    const {data} = await sb.from("poslovi").select("posao_num").order("posao_num",{ascending:false}).limit(1);
    const n = data&&data.length>0 ? data[0].posao_num+1 : 1;
    const unosilac = profile ? `${profile.ime||""} ${profile.prezime||""}`.trim() : "";
    setNewPosao(true);
    setTempData({
      posaoNum:n, Posao:formatPosaoNumber(n),
      KLIJENT:p.KLIJENT, SifraKupca:p.SifraKupca,
      DatumUnosa:todayISO(), RokZaIsporuku:p.RokZaIsporuku||"",
      Unosilac:unosilac, Opis:p.Opis,
      PoslatiNaIzradu:p.PoslatiNaIzradu, MontazaIsporuka:p.MontazaIsporuka,
      Placanje:p.Placanje,
      StatusIzrade:false, StatusIsporuke:false, StatusMontaze:false,
      SpecifikacijaCene:p.SpecifikacijaCene, Obracun:p.Obracun,
      ZavrsenPosao:false, Fakturisano:false,
    });
    setTempErrors({});
  }

  async function savePosao() {
    setSaving(true);
    const row = appToDB(tempData);
    let error, data;
    if (newPosao) {
      ({error, data} = await sb.from("poslovi").insert([row]).select().single());
      if (!error) {
        const changes = Object.entries(POSAO_LABELS)
          .filter(([k]) => tempData[k] !== undefined && tempData[k] !== "" && tempData[k] !== false && tempData[k] !== null)
          .map(([k,lbl]) => ({ field:k, label:lbl, old:null, new:fmtVal(tempData[k]) }));
        await writeLog({ entity_type:"posao", entity_id:data?.id||"new", entity_label:tempData.Posao, action:"create", changes });
      }
    } else {
      const prev = poslovi.find(p=>p.id===editingPosao);
      ({error} = await sb.from("poslovi").update(row).eq("id",editingPosao));
      if (!error && prev) {
        const changes = Object.entries(POSAO_LABELS)
          .filter(([k]) => fmtVal(prev[k]) !== fmtVal(tempData[k]))
          .map(([k,lbl]) => ({ field:k, label:lbl, old:fmtVal(prev[k]), new:fmtVal(tempData[k]) }));
        await writeLog({ entity_type:"posao", entity_id:editingPosao, entity_label:prev.Posao, action:"update", changes });
      }
    }
    setSaving(false);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    await loadPoslovi(); closeModal();
  }
  async function deletePosao(id) {
    const posao = poslovi.find(p=>p.id===id);
    const {error} = await sb.from("poslovi").delete().eq("id",id);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    await writeLog({ entity_type:"posao", entity_id:id, entity_label:posao?.Posao||String(id), action:"delete", changes:null });
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
    let error, data;
    if (newKupac) {
      ({error, data} = await sb.from("kupci").insert([row]).select().single());
      if (!error) {
        const changes = Object.entries(KUPAC_LABELS)
          .filter(([k]) => tempData[k] !== undefined && tempData[k] !== "" && tempData[k] !== null)
          .map(([k,lbl]) => ({ field:k, label:lbl, old:null, new:fmtVal(tempData[k]) }));
        await writeLog({ entity_type:"kupac", entity_id:data?.id||"new", entity_label:tempData.Naziv||tempData.SifraKupca, action:"create", changes });
      }
    } else {
      const prev = kupci.find(k=>k.id===editingKupac);
      ({error} = await sb.from("kupci").update(row).eq("id",editingKupac));
      if (!error && prev) {
        const changes = Object.entries(KUPAC_LABELS)
          .filter(([k]) => fmtVal(prev[k]) !== fmtVal(tempData[k]))
          .map(([k,lbl]) => ({ field:k, label:lbl, old:fmtVal(prev[k]), new:fmtVal(tempData[k]) }));
        await writeLog({ entity_type:"kupac", entity_id:editingKupac, entity_label:prev.Naziv||prev.SifraKupca, action:"update", changes });
      }
    }
    setSaving(false);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    await loadKupci(); closeModal();
  }
  async function deleteKupac(id) {
    const kupac = kupci.find(k=>k.id===id);
    const {error} = await sb.from("kupci").delete().eq("id",id);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    await writeLog({ entity_type:"kupac", entity_id:id, entity_label:kupac?.Naziv||kupac?.SifraKupca||String(id), action:"delete", changes:null });
    setKupci(ks=>ks.filter(k=>k.id!==id)); setConfirmDelete(null);
  }

  function openEditUser(u) { setEditingUser(u.id); setTempData({...u}); setTempErrors({}); }
  async function saveUser() {
    const e={};
    if (!tempData.ime?.trim()) e.ime="Obavezno.";
    if (!tempData.prezime?.trim()) e.prezime="Obavezno.";
    if (Object.keys(e).length) { setTempErrors(e); return; }
    setSaving(true);
    const prev = users.find(u=>u.id===editingUser);
    const row={ime:tempData.ime,prezime:tempData.prezime,telefon:tempData.telefon,adresa:tempData.adresa,is_admin:tempData.is_admin||false,tab_permissions:tempData.tab_permissions||{},can_publish_layouts:tempData.can_publish_layouts||false};
    const {error} = await sb.from("profiles").update(row).eq("id",editingUser);
    setSaving(false);
    if (error) { setGlobalErr("Greška: "+error.message); return; }
    if (prev) {
      const changes = Object.entries(USER_LABELS)
        .filter(([k]) => fmtVal(prev[k]) !== fmtVal(tempData[k]))
        .map(([k,lbl]) => ({ field:k, label:lbl, old:fmtVal(prev[k]), new:fmtVal(tempData[k]) }));
      await writeLog({ entity_type:"korisnik", entity_id:editingUser, entity_label:`${tempData.ime} ${tempData.prezime}`.trim(), action:"update", changes });
    }
    await loadUsers();
    // If the admin edited another user's profile, that user's permissions are
    // now updated in the DB. If the admin edited their OWN profile, also
    // refresh the live profile state so canSee/canEdit/perm() update immediately.
    if (editingUser === authUser?.id) await loadProfile(authUser.id);
    closeModal();
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
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
      <Field label="Posao (automatski)" value={tempData.Posao} onChange={()=>{}} readOnly/>
      <DateField label="Datum unosa" value={tempData.DatumUnosa} onChange={tf("DatumUnosa")} readOnly={!!newPosao}/>
      <KupacSearchField label="Klijent" sifra={tempData.SifraKupca} naziv={tempData.KLIJENT} kupci={kupci} onChange={k=>setTempData(d=>({...d,SifraKupca:k.SifraKupca,KLIJENT:k.Naziv}))}/>
      <DateField label="Rok za isporuku" value={tempData.RokZaIsporuku} onChange={tf("RokZaIsporuku")}/>
      <UserSearchField label="Unosilac posla" value={tempData.Unosilac} onChange={tf("Unosilac")} users={users}/>
      <div style={{gridColumn:"1/-1"}}><Field label="Opis" value={tempData.Opis} onChange={tf("Opis")}/></div>
      <div style={{gridColumn:"1/-1"}}><Field label="Specifikacija cene" value={tempData.SpecifikacijaCene} onChange={tf("SpecifikacijaCene")}/></div>
      <Field label="Obračun (RSD)" value={tempData.Obracun} onChange={tf("Obracun")} type="number"/>
      <Field label="Poslati na izradu" value={tempData.PoslatiNaIzradu} onChange={tf("PoslatiNaIzradu")} options={izradaOptions.map(o=>o.naziv)}/>
      <RadioGroup label="Montaža / Isporuka" value={tempData.MontazaIsporuka} onChange={tf("MontazaIsporuka")} options={montazaIsporukaOptions}/>
      <RadioGroup label="Plaćanje" value={tempData.Placanje} onChange={tf("Placanje")} options={placanjeOptions}/>
      <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"0 16px",marginTop:4}}>
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
        <div style={{maxWidth:1700,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",height:52,gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginRight:8}}>
            <div style={{width:26,height:26,background:T.primary,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:9,height:9,background:"#fff",borderRadius:2,transform:"rotate(45deg)"}}/>
            </div>
            <span style={{fontFamily:T.fontHead,fontSize:15,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Poslovi</span>
          </div>
          <nav style={{display:"flex",gap:1,flex:1,overflowX:"auto"}}>
            {visibleTabs.map(t=>(
              <button key={t.key} onClick={()=>{setView(t.key);sessionStorage.setItem("lastView",t.key);if(authUser)loadProfile(authUser.id);}} style={{
                background:view===t.key?T.primaryLight:"none",border:"none",
                color:view===t.key?T.primary:T.textSoft,borderRadius:T.radiusSm,
                padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:view===t.key?600:400,
                transition:"all 0.15s",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",fontFamily:T.fontBody,
              }}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:T.primaryLight,border:`2px solid ${T.primaryBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:T.primary}}>
              {(profile.ime||"?")[0]}{(profile.prezime||"")[0]}
            </div>
            <div style={{lineHeight:1.3}}>
              <div style={{fontSize:11,fontWeight:600,color:T.text}}>{profile.ime} {profile.prezime}</div>
              <div style={{fontSize:10,color:T.textSoft}}>{profile.is_admin?"Admin":"Korisnik"}</div>
            </div>
            <button onClick={handleLogout} style={{...btnS("ghost"),padding:"5px 14px",fontSize:12}}>Odjava</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1700,margin:"0 auto",padding:"22px 20px"}}>
        <ErrBanner msg={globalErr} onDismiss={()=>setGlobalErr("")}/>
        {loading && <Spinner/>}

        {!loading && <>

        {view==="poslovi" && <>
          <PageHeader title="Svi poslovi"/>
          <PosaoTable rows={poslovi} viewKey="poslovi" canEdit={canEdit("poslovi")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})} onCopy={canEdit("poslovi")?copyPosao:null} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>
        </>}

        {view==="aktivni" && <>
          <PageHeader title="Aktivni poslovi" subtitle="Završen posao = Ne"
            action={canEdit("aktivni")&&<button onClick={openNewPosao} style={btnS("primary")}>+ Novi posao</button>}/>
          <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
            <StatCard label="Aktivnih" value={aktivniRows.length} color={T.amber}/>
            <StatCard label="Ukupan obračun" value={aktivniRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.green}/>
          </div>
          <PosaoTable rows={aktivniRows} viewKey="aktivni" canEdit={canEdit("aktivni")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})}
            onInlineZavrsen={canEdit("aktivni")?(id,v)=>inlineUpdate(id,"ZavrsenPosao",v):null} onCopy={canEdit("aktivni")?copyPosao:null} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>
        </>}

        {view==="zavrseni" && <>
          <PageHeader title="Završeni poslovi"/>
          <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
            <StatCard label="Završenih" value={zavrseniRows.length} color={T.green}/>
            <StatCard label="Ukupan obračun" value={zavrseniRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.primary}/>
          </div>
          <PosaoTable rows={zavrseniRows} viewKey="zavrseni" canEdit={canEdit("zavrseni")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})} onCopy={canEdit("zavrseni")?copyPosao:null} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>
        </>}

        {view==="radionica" && <>
          <PageHeader title="Radionica" subtitle="Status izrade se menja samo ovde"/>
          <SimpleTable rows={poslovi} viewKey="radionica"
            columns={simpleCols([["Posao","Posao"],["KLIJENT","Klijent"],["SifraKupca","Šifra"],["DatumUnosa","Datum"],["RokZaIsporuku","Rok"],["Unosilac","Unosilac"],["Opis","Opis"],["StatusIzrade","Status izrade"]])}
            renderCell={simpleRender("StatusIzrade",p=><InlineCheck val={p.StatusIzrade} onChange={v=>canEdit("radionica")&&inlineUpdate(p.id,"StatusIzrade",v)} disabled={!canEdit("radionica")}/>)} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>
        </>}

        {view==="montaza" && <>
          <PageHeader title="Montaža" subtitle="Status montaže se menja samo ovde"/>
          <SimpleTable rows={montazaRows} viewKey="montaza"
            columns={simpleCols([["Posao","Posao"],["KLIJENT","Klijent"],["SifraKupca","Šifra"],["DatumUnosa","Datum"],["RokZaIsporuku","Rok"],["Unosilac","Unosilac"],["Opis","Opis"],["StatusMontaze","Status montaže"]])}
            renderCell={simpleRender("StatusMontaze",p=><InlineCheck val={p.StatusMontaze} onChange={v=>canEdit("montaza")&&inlineUpdate(p.id,"StatusMontaze",v)} disabled={!canEdit("montaza")}/>)} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>
        </>}

        {view==="isporuka" && <>
          <PageHeader title="Isporuka" subtitle="Status isporuke se menja samo ovde"/>
          <SimpleTable rows={isporukaRows} viewKey="isporuka"
            columns={simpleCols([["Posao","Posao"],["KLIJENT","Klijent"],["SifraKupca","Šifra"],["DatumUnosa","Datum"],["RokZaIsporuku","Rok"],["Unosilac","Unosilac"],["Opis","Opis"],["StatusIsporuke","Status isporuke"]])}
            renderCell={simpleRender("StatusIsporuke",p=><InlineCheck val={p.StatusIsporuke} onChange={v=>canEdit("isporuka")&&inlineUpdate(p.id,"StatusIsporuke",v)} disabled={!canEdit("isporuka")}/>)} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>
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
            }} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>
        </>}

        {view==="kupci" && <KupciView kupci={kupci} canEdit={canEdit("kupci")} onNew={openNewKupac} onEdit={openEditKupac} onDelete={id=>setConfirmDelete({type:"kupac",id})} onView={setViewingKupac} currentUser={authUser} canPublishLayouts={profile?.can_publish_layouts||profile?.is_admin}/>}

        {view==="obracun" && <ObracunView poslovi={poslovi} placanjeColor={placanjeColor}/>}

        {view==="changelog" && profile?.is_admin && (
          <ChangelogView/>
        )}

        {view==="uputstvo" && (
          <div style={{margin:"-22px -20px"}}>
            <ManualView profile={profile} canEdit={canEdit}/>
          </div>
        )}

        {view==="korisnici" && <>
          <PageHeader title="Korisnici"/>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>{["Ime","Prezime","Telefon","Adresa","Rola","Obj. rasporede","Dozvole",...(profile.is_admin?[""]:[])].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map((u,i)=>(
                  <tr key={u.id} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,fontWeight:600}}>{u.ime}</td>
                    <td style={tdS}>{u.prezime}</td>
                    <td style={{...tdS,color:T.textMid}}>{u.telefon}</td>
                    <td style={{...tdS,color:T.textMid,fontSize:12}}>{u.adresa}</td>
                    <td style={tdS}>{u.is_admin?<span style={{background:T.primaryLight,color:T.primary,border:`1px solid ${T.primaryBorder}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600}}>Admin</span>:<span style={{background:T.surfaceRaised,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600}}>Korisnik</span>}</td>
                    <td style={tdS}>{u.can_publish_layouts||u.is_admin?<span style={{background:T.purpleBg,color:T.purple,border:`1px solid ${T.purpleBorder}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600}}>✓ Da</span>:<span style={{color:T.textSoft,fontSize:12}}>—</span>}</td>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 36px"}}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 36px"}}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 22px",marginBottom:16}}>
            <Field label="Ime" value={tempData.ime} onChange={tf("ime")} error={tempErrors.ime}/>
            <Field label="Prezime" value={tempData.prezime} onChange={tf("prezime")} error={tempErrors.prezime}/>
            <Field label="Telefon" value={tempData.telefon} onChange={tf("telefon")}/>
            <div style={{gridColumn:"1/-1"}}><Field label="Adresa" value={tempData.adresa} onChange={tf("adresa")}/></div>
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
          <div style={{marginTop:14,padding:"12px 14px",background:T.purpleBg,border:`1px solid ${T.purpleBorder}`,borderRadius:T.radiusSm,display:"flex",alignItems:"center",gap:10}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1}}>
              <input type="checkbox"
                checked={tempData.can_publish_layouts||false}
                onChange={e=>setTempData(d=>({...d,can_publish_layouts:e.target.checked}))}
                style={{accentColor:T.purple,width:15,height:15}}/>
              <div>
                <div style={{color:T.purple,fontSize:13,fontWeight:600}}>🌐 Može da objavljuje zajedničke rasporede kolona</div>
                <div style={{color:T.textSoft,fontSize:11,marginTop:2}}>Ovaj korisnik može sačuvati raspored kolona koji će biti vidljiv svim korisnicima</div>
              </div>
            </label>
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

    </div>
  );
}
