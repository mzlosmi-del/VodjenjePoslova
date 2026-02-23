import { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── helpers ───────────────────────────────────────────────────────────────────
const formatPosaoNumber = (n) => `P${String(n).padStart(8, "0")}`;
const todayISO  = () => new Date().toISOString().slice(0, 10);
const fmtDate   = s => { if (!s) return "—"; const [y,m,d] = s.split("-"); return `${d}.${m}.${y}`; };
const isOverdue = iso => iso && new Date(iso) < new Date();

// DB row → app object (snake_case → camelCase/Serbian field names)
const dbToApp = r => ({
  id:               r.id,
  posaoNum:         r.posao_num,
  Posao:            r.posao,
  KLIJENT:          r.klijent,
  SifraKupca:       r.sifra_kupca,
  DatumUnosa:       r.datum_unosa,
  RokZaIsporuku:    r.rok_za_isporuku,
  Unosilac:         r.unosilac,
  Opis:             r.opis,
  PoslatiNaIzradu:  r.poslati_na_izradu,
  MontazaIsporuka:  r.montaza_isporuka,
  Placanje:         r.placanje,
  StatusIzrade:     r.status_izrade,
  StatusIsporuke:   r.status_isporuke,
  StatusMontaze:    r.status_montaze,
  SpecifikacijaCene:r.specifikacija_cene,
  Obracun:          r.obracun != null ? String(r.obracun) : "",
  ZavrsenPosao:     r.zavrsen_posao,
  Fakturisano:      r.fakturisano,
});

// app object → DB row
const appToDB = p => ({
  posao_num:          p.posaoNum,
  posao:              p.Posao,
  klijent:            p.KLIJENT,
  sifra_kupca:        p.SifraKupca,
  datum_unosa:        p.DatumUnosa || null,
  rok_za_isporuku:    p.RokZaIsporuku || null,
  unosilac:           p.Unosilac,
  opis:               p.Opis,
  poslati_na_izradu:  p.PoslatiNaIzradu,
  montaza_isporuka:   p.MontazaIsporuka,
  placanje:           p.Placanje,
  status_izrade:      p.StatusIzrade   || false,
  status_isporuke:    p.StatusIsporuke || false,
  status_montaze:     p.StatusMontaze  || false,
  specifikacija_cene: p.SpecifikacijaCene,
  obracun:            p.Obracun ? parseFloat(p.Obracun) : null,
  zavrsen_posao:      p.ZavrsenPosao   || false,
  fakturisano:        p.Fakturisano    || false,
});

const dbKupacToApp = r => ({
  id:            r.id,
  SifraKupca:    r.sifra_kupca,
  Naziv:         r.naziv,
  Grad:          r.grad,
  Ulica:         r.ulica,
  Broj:          r.broj,
  PostanskiBroj: r.postanski_broj,
  Telefon:       r.telefon,
  PIB:           r.pib,
});

const appKupacToDB = k => ({
  sifra_kupca:    k.SifraKupca,
  naziv:          k.Naziv,
  grad:           k.Grad,
  ulica:          k.Ulica,
  broj:           k.Broj,
  postanski_broj: k.PostanskiBroj,
  telefon:        k.Telefon,
  pib:            k.PIB,
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
  shadow:"0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)",
  shadowMd:"0 4px 16px rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.25)",
  shadowLg:"0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)",
  fontHead:"'Bricolage Grotesque', sans-serif",
  fontBody:"'Plus Jakarta Sans', sans-serif",
  radius:"10px", radiusSm:"7px", radiusLg:"14px",
};
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap";

// ── tabs ──────────────────────────────────────────────────────────────────────
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

// ── shared styles ─────────────────────────────────────────────────────────────
const thS = {padding:"10px 14px",textAlign:"left",color:T.textSoft,fontSize:11,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",background:T.bg,fontFamily:T.fontBody};
const tdS = {padding:"11px 14px",color:T.text,fontSize:13,borderBottom:`1px solid ${T.border}`,verticalAlign:"middle",fontFamily:T.fontBody};

const btnS = (variant="primary") => {
  if (variant==="primary") return {background:T.primary,border:"none",color:"#fff",borderRadius:T.radiusSm,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:T.fontBody};
  if (variant==="ghost")   return {background:"none",border:`1px solid ${T.border}`,color:T.textMid,borderRadius:T.radiusSm,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:T.fontBody};
  if (variant==="danger")  return {background:"none",border:`1px solid ${T.redBorder}`,color:T.red,borderRadius:T.radiusSm,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:T.fontBody};
  if (variant==="edit")    return {background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,color:T.primary,borderRadius:T.radiusSm,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:T.fontBody};
  return {};
};

// ── status helpers ─────────────────────────────────────────────────────────────
const CheckBadge = ({val}) => val
  ? <span style={{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600,fontFamily:T.fontBody}}>✓ Da</span>
  : <span style={{background:T.surfaceRaised,color:T.textSoft,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600,fontFamily:T.fontBody}}>— Ne</span>;

const InlineCheck = ({val, onChange, disabled}) => (
  <label style={{display:"flex",alignItems:"center",gap:6,cursor:disabled?"default":"pointer"}}>
    <div onClick={()=>!disabled&&onChange(!val)} style={{
      width:18,height:18,borderRadius:4,border:`2px solid ${val?T.green:T.border}`,
      background:val?T.greenBg:"transparent",display:"flex",alignItems:"center",justifyContent:"center",
      cursor:disabled?"default":"pointer",flexShrink:0,transition:"all 0.15s",
    }}>
      {val && <span style={{color:T.green,fontSize:13,lineHeight:1,fontWeight:700}}>✓</span>}
    </div>
    <span style={{color:val?T.green:T.textSoft,fontSize:12,fontFamily:T.fontBody,fontWeight:val?600:400}}>{val?"Da":"Ne"}</span>
  </label>
);

const placanjeColor = p => p==="Faktura"?T.primary:p==="Otpremnica"?T.amber:T.purple;
const PlacanjeBadge = ({val}) => {
  const c = placanjeColor(val);
  return val
    ? <span style={{background:`${c}18`,color:c,border:`1px solid ${c}35`,borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:600,fontFamily:T.fontBody}}>{val}</span>
    : <span style={{color:T.textSoft}}>—</span>;
};

// ── loading spinner ────────────────────────────────────────────────────────────
function Spinner({text="Učitavanje..."}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:60,color:T.textSoft,fontFamily:T.fontBody}}>
      <div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTopColor:T.primary,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{fontSize:13}}>{text}</span>
    </div>
  );
}

// ── error banner ───────────────────────────────────────────────────────────────
function ErrBanner({msg,onDismiss}) {
  if (!msg) return null;
  return (
    <div style={{background:T.redBg,border:`1px solid ${T.redBorder}`,borderRadius:T.radiusSm,padding:"10px 14px",color:T.red,fontSize:13,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:T.fontBody}}>
      <span>⚠ {msg}</span>
      {onDismiss && <button onClick={onDismiss} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>}
    </div>
  );
}

// ── components ─────────────────────────────────────────────────────────────────
function Modal({title,onClose,children,wide}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.70)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"}}>
      <div style={{background:T.surface,borderRadius:T.radiusLg,padding:"28px 32px",minWidth:wide?720:560,maxWidth:"94vw",maxHeight:"92vh",overflowY:"auto",boxShadow:T.shadowLg,border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{color:T.text,fontFamily:T.fontHead,margin:0,fontSize:19,fontWeight:700,letterSpacing:"-0.02em"}}>{title}</h2>
          <button onClick={onClose} style={{background:T.surfaceRaised,border:`1px solid ${T.border}`,color:T.textMid,cursor:"pointer",fontSize:18,lineHeight:1,width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({label,value,onChange,type="text",options,readOnly,error}) {
  const base={width:"100%",background:readOnly?T.bg:T.surfaceRaised,border:`1px solid ${error?T.red:T.border}`,borderRadius:T.radiusSm,padding:"9px 12px",color:readOnly?T.textMid:T.text,fontSize:13,fontFamily:T.fontBody,boxSizing:"border-box",cursor:readOnly?"default":"text",outline:"none",colorScheme:"dark"};
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4,fontFamily:T.fontBody}}>{label}</label>
      {options
        ? <select value={value||""} onChange={e=>onChange(e.target.value)} style={{...base,cursor:"pointer"}}><option value="">—</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>
        : <input type={type} value={value||""} onChange={e=>!readOnly&&onChange(e.target.value)} readOnly={readOnly} style={base}/>
      }
      {error && <div style={{color:T.red,fontSize:11,marginTop:3,fontFamily:T.fontBody}}>{error}</div>}
    </div>
  );
}

function DateField({label,value,onChange,readOnly,error}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",color:T.textMid,fontSize:12,fontWeight:500,marginBottom:4,fontFamily:T.fontBody}}>{label}</label>
      <input type="date" value={value||""} onChange={e=>!readOnly&&onChange(e.target.value)} readOnly={readOnly}
        style={{width:"100%",background:readOnly?T.bg:T.surfaceRaised,border:`1px solid ${error?T.red:T.border}`,borderRadius:T.radiusSm,padding:"9px 12px",color:readOnly?T.textMid:T.text,fontSize:13,fontFamily:T.fontBody,boxSizing:"border-box",outline:"none",colorScheme:"dark"}}/>
      {error && <div style={{color:T.red,fontSize:11,marginTop:3}}>{error}</div>}
    </div>
  );
}

function CheckField({label,value,onChange,readOnly}) {
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

function RadioGroup({label,value,onChange,options,readOnly}) {
  const colorMap = {
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
          const active=value===opt;
          const m=colorMap[opt]||{c:T.textMid,bg:T.surfaceRaised,b:T.border};
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

function KupacSearchField({label,sifra,naziv,kupci,onChange}) {
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
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,zIndex:3000,boxShadow:T.shadowMd,overflow:"hidden"}}>
          <div style={{padding:"8px 8px 5px"}}>
            <input autoFocus placeholder="Pretraži..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} style={{...base,fontSize:12}}/>
          </div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {filtered.length===0
              ? <div style={{padding:"10px 14px",color:T.textSoft,fontSize:13}}>Nema rezultata</div>
              : filtered.map(k=>(
                <div key={k.id} onClick={()=>{onChange(k);setOpen(false);setSearch("");}} style={{padding:"9px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <div><span style={{color:T.primary,fontWeight:600,fontSize:13}}>{k.SifraKupca}</span><span style={{color:T.text,fontSize:13,marginLeft:10}}>{k.Naziv}</span></div>
                  <span style={{color:T.textSoft,fontSize:12}}>{k.Grad}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function PageHeader({title,subtitle,action}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
      <div>
        <h1 style={{fontFamily:T.fontHead,color:T.text,margin:"0 0 3px",fontSize:24,fontWeight:700,letterSpacing:"-0.03em"}}>{title}</h1>
        {subtitle && <p style={{color:T.textSoft,margin:0,fontSize:13,fontFamily:T.fontBody}}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({label,value,color,sub}) {
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,padding:"18px 22px",boxShadow:T.shadow,minWidth:160}}>
      <div style={{color:T.textSoft,fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5,fontFamily:T.fontBody}}>{label}</div>
      <div style={{color:color||T.text,fontSize:24,fontWeight:700,fontFamily:T.fontHead,letterSpacing:"-0.03em",lineHeight:1}}>{value}</div>
      {sub && <div style={{color:T.textSoft,fontSize:12,marginTop:5,fontFamily:T.fontBody}}>{sub}</div>}
    </div>
  );
}

// ── FULL POSLOVI TABLE ─────────────────────────────────────────────────────────
function PosaoTable({rows,canEdit,onView,onEdit,onDelete}) {
  const miColor = v => v==="Montaža i isporuka"?T.primary:v==="Samo isporuka"?T.green:T.purple;
  return (
    <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
      <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
        <thead>
          <tr>{["Posao","Klijent","Šifra","Datum","Rok isporuke","Unosilac","Opis","Poslati","Montaža/Isporuka","Plaćanje","St. izrade","St. isporuke","St. montaže","Specifikacija","Obračun","Završen","Fakturisano",""].map(h=><th key={h} style={thS}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={18} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema zapisa</td></tr>
            : rows.map((p,i)=>(
              <tr key={p.id} style={{cursor:"pointer",background:i%2===0?T.surface:T.surfaceHover}}
                onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}
                onDoubleClick={()=>onView(p)}>
                <td style={{...tdS,color:T.primary,fontWeight:700}}>{p.Posao}</td>
                <td style={{...tdS,fontWeight:500}}>{p.KLIJENT}</td>
                <td style={{...tdS,color:T.textSoft,fontSize:12}}>{p.SifraKupca}</td>
                <td style={{...tdS,color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</td>
                <td style={{...tdS,color:isOverdue(p.RokZaIsporuku)?T.red:T.textMid,fontSize:12,fontWeight:isOverdue(p.RokZaIsporuku)?600:400}}>{fmtDate(p.RokZaIsporuku)}</td>
                <td style={{...tdS,color:T.textMid}}>{p.Unosilac}</td>
                <td style={{...tdS,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.textMid}}>{p.Opis}</td>
                <td style={tdS}><span style={{background:T.surfaceRaised,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{p.PoslatiNaIzradu||"—"}</span></td>
                <td style={tdS}>{p.MontazaIsporuka?<span style={{background:`${miColor(p.MontazaIsporuka)}18`,color:miColor(p.MontazaIsporuka),border:`1px solid ${miColor(p.MontazaIsporuka)}35`,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{p.MontazaIsporuka}</span>:<span style={{color:T.textSoft}}>—</span>}</td>
                <td style={tdS}><PlacanjeBadge val={p.Placanje}/></td>
                <td style={tdS}><CheckBadge val={p.StatusIzrade}/></td>
                <td style={tdS}><CheckBadge val={p.StatusIsporuke}/></td>
                <td style={tdS}><CheckBadge val={p.StatusMontaze}/></td>
                <td style={{...tdS,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.textMid,fontSize:12}}>{p.SpecifikacijaCene||"—"}</td>
                <td style={{...tdS,fontWeight:600,color:T.green}}>{p.Obracun?`${parseFloat(p.Obracun).toLocaleString()} RSD`:"—"}</td>
                <td style={tdS}><CheckBadge val={p.ZavrsenPosao}/></td>
                <td style={tdS}><CheckBadge val={p.Fakturisano}/></td>
                <td style={tdS} onClick={e=>e.stopPropagation()}>
                  <div style={{display:"flex",gap:5}}>
                    {canEdit
                      ? <><button onClick={()=>onEdit(p)} style={btnS("edit")}>Uredi</button><button onClick={()=>onDelete(p.id)} style={btnS("danger")}>Briši</button></>
                      : <button onClick={()=>onView(p)} style={btnS("ghost")}>Pregled</button>
                    }
                  </div>
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
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
      <link href={FONT_LINK} rel="stylesheet"/>
      <div style={{position:"fixed",top:-120,right:-120,width:400,height:400,background:"radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:-80,left:-80,width:300,height:300,background:"radial-gradient(circle,rgba(167,139,250,0.14) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{background:T.surface,borderRadius:T.radiusLg,padding:"40px 44px",width:400,boxShadow:T.shadowLg,border:`1px solid ${T.border}`,position:"relative"}}>
        <div style={{marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,borderRadius:T.radius,padding:"6px 12px",marginBottom:18}}>
            <div style={{width:7,height:7,background:T.primary,borderRadius:"50%"}}/>
            <span style={{color:T.primary,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Poslovi App</span>
          </div>
          <h1 style={{fontFamily:T.fontHead,fontSize:26,fontWeight:800,color:T.text,margin:"0 0 5px",letterSpacing:"-0.04em"}}>Dobrodošli nazad</h1>
          <p style={{color:T.textSoft,fontSize:13,margin:0}}>Prijavite se na svoj nalog</p>
        </div>
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
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authUser,setAuthUser]     = useState(null);   // Supabase auth user
  const [profile,setProfile]       = useState(null);   // profiles row
  const [authLoading,setAuthLoading] = useState(true);

  const [view,setView]             = useState("aktivni");
  const [poslovi,setPoslovi]       = useState([]);
  const [kupci,setKupci]           = useState([]);
  const [izradaOptions,setIzradaOptions] = useState([]);
  const [users,setUsers]           = useState([]);      // all profiles (admin only)
  const [loading,setLoading]       = useState(false);
  const [globalErr,setGlobalErr]   = useState("");

  const [editingPosao,setEditingPosao] = useState(null);
  const [viewingPosao,setViewingPosao] = useState(null);
  const [editingKupac,setEditingKupac] = useState(null);
  const [viewingKupac,setViewingKupac] = useState(null);
  const [editingUser,setEditingUser]   = useState(null);
  const [newPosao,setNewPosao]   = useState(false);
  const [newKupac,setNewKupac]   = useState(false);
  const [newUser,setNewUser]     = useState(false);
  const [tempData,setTempData]   = useState({});
  const [tempErrors,setTempErrors] = useState({});
  const [confirmDelete,setConfirmDelete] = useState(null);
  const [saving,setSaving]       = useState(false);

  // ── auth listener ────────────────────────────────────────────────────────────
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

  // ── data loaders ─────────────────────────────────────────────────────────────
  const loadPoslovi = useCallback(async()=>{
    const {data,error} = await sb.from("poslovi").select("*").order("posao_num");
    if (error) { setGlobalErr("Greška pri učitavanju poslova: "+error.message); return; }
    setPoslovi((data||[]).map(dbToApp));
  },[]);

  const loadKupci = useCallback(async()=>{
    const {data,error} = await sb.from("kupci").select("*").order("naziv");
    if (error) { setGlobalErr("Greška pri učitavanju kupaca: "+error.message); return; }
    setKupci((data||[]).map(dbKupacToApp));
  },[]);

  const loadIzradaOptions = useCallback(async()=>{
    const {data} = await sb.from("izrada_opcije").select("*").order("id");
    setIzradaOptions(data||[]);
  },[]);

  const loadUsers = useCallback(async()=>{
    const {data,error} = await sb.from("profiles").select("*");
    if (!error) setUsers(data||[]);
  },[]);

  useEffect(()=>{
    if (!profile) return;
    setLoading(true);
    Promise.all([loadPoslovi(), loadKupci(), loadIzradaOptions()])
      .finally(()=>setLoading(false));
    if (profile.is_admin) loadUsers();
  },[profile]);

  // ── derived rows ──────────────────────────────────────────────────────────────
  const aktivniRows   = useMemo(()=>poslovi.filter(p=>!p.ZavrsenPosao),[poslovi]);
  const zavrseniRows  = useMemo(()=>poslovi.filter(p=>p.ZavrsenPosao),[poslovi]);
  const montazaRows   = useMemo(()=>poslovi.filter(p=>p.MontazaIsporuka==="Montaža i isporuka"),[poslovi]);
  const isporukaRows  = useMemo(()=>poslovi.filter(p=>p.MontazaIsporuka==="Samo isporuka"||p.MontazaIsporuka==="Montaža i isporuka"),[poslovi]);
  const knjigenjeRows = useMemo(()=>poslovi.filter(p=>p.ZavrsenPosao&&p.Placanje==="Faktura"),[poslovi]);
  const obracunSums   = useMemo(()=>{const s={};poslovi.forEach(p=>{const k=p.Placanje||"—";s[k]=(s[k]||0)+(parseFloat(p.Obracun)||0);});return s;},[poslovi]);

  // ── permissions ───────────────────────────────────────────────────────────────
  const perm    = tab => profile?.tab_permissions?.[tab]||"none";
  const canSee  = tab => perm(tab)!=="none";
  const canEdit = tab => perm(tab)==="edit";
  const tf = k => v => setTempData(d=>({...d,[k]:v}));

  // ── inline field update (Radionica / Montaža / Isporuka / Knjiženje) ─────────
  async function inlineUpdate(id, appField, value) {
    const fieldMap = {
      StatusIzrade:"status_izrade", StatusIsporuke:"status_isporuke",
      StatusMontaze:"status_montaze", Fakturisano:"fakturisano",
    };
    const dbField = fieldMap[appField];
    if (!dbField) return;
    // optimistic update
    setPoslovi(ps=>ps.map(p=>p.id===id?{...p,[appField]:value}:p));
    const {error} = await sb.from("poslovi").update({[dbField]:value}).eq("id",id);
    if (error) { setGlobalErr("Greška pri ažuriranju: "+error.message); loadPoslovi(); }
  }

  // ── next posao num ────────────────────────────────────────────────────────────
  async function getNextPosaoNum() {
    const {data} = await sb.from("poslovi").select("posao_num").order("posao_num",{ascending:false}).limit(1);
    return data&&data.length>0 ? data[0].posao_num+1 : 1;
  }

  // ── posao CRUD ────────────────────────────────────────────────────────────────
  function openEditPosao(p){setEditingPosao(p.id);setTempData({...p});setTempErrors({});}
  async function openNewPosao(){
    const n = await getNextPosaoNum();
    setNewPosao(true);
    setTempData({posaoNum:n,Posao:formatPosaoNumber(n),KLIJENT:"",SifraKupca:"",DatumUnosa:todayISO(),RokZaIsporuku:"",Unosilac:"",Opis:"",PoslatiNaIzradu:"",MontazaIsporuka:"",Placanje:"Faktura",StatusIzrade:false,StatusIsporuke:false,StatusMontaze:false,SpecifikacijaCene:"",Obracun:"",ZavrsenPosao:false,Fakturisano:false});
    setTempErrors({});
  }
  async function savePosao(){
    setSaving(true);
    const row = appToDB(tempData);
    let error;
    if (newPosao) {
      ({error} = await sb.from("poslovi").insert([row]));
    } else {
      ({error} = await sb.from("poslovi").update(row).eq("id",editingPosao));
    }
    setSaving(false);
    if (error) { setGlobalErr("Greška pri snimanju: "+error.message); return; }
    await loadPoslovi();
    closeModal();
  }

  async function deletePosao(id){
    const {error} = await sb.from("poslovi").delete().eq("id",id);
    if (error) { setGlobalErr("Greška pri brisanju: "+error.message); return; }
    setPoslovi(ps=>ps.filter(p=>p.id!==id));
    setConfirmDelete(null);
  }

  // ── kupac CRUD ────────────────────────────────────────────────────────────────
  function openEditKupac(k){setEditingKupac(k.id);setTempData({...k});setTempErrors({});}
  function openNewKupac(){setNewKupac(true);setTempData({SifraKupca:"",Naziv:"",Grad:"",Ulica:"",Broj:"",PostanskiBroj:"",Telefon:"",PIB:""});setTempErrors({});}
  async function saveKupac(){
    setSaving(true);
    const row = appKupacToDB(tempData);
    let error;
    if (newKupac) {
      ({error} = await sb.from("kupci").insert([row]));
    } else {
      ({error} = await sb.from("kupci").update(row).eq("id",editingKupac));
    }
    setSaving(false);
    if (error) { setGlobalErr("Greška pri snimanju: "+error.message); return; }
    await loadKupci();
    closeModal();
  }

  async function deleteKupac(id){
    const {error} = await sb.from("kupci").delete().eq("id",id);
    if (error) { setGlobalErr("Greška pri brisanju: "+error.message); return; }
    setKupci(ks=>ks.filter(k=>k.id!==id));
    setConfirmDelete(null);
  }

  // ── user CRUD (profiles table) ────────────────────────────────────────────────
  function openEditUser(u){setEditingUser(u.id);setTempData({...u});setTempErrors({});}
  function openNewUser(){setNewUser(true);setTempData({ime:"",prezime:"",telefon:"",adresa:"",is_admin:false,tab_permissions:Object.fromEntries(ALL_TABS.map(t=>[t.key,"none"]))});setTempErrors({});}
  async function saveUser(){
    const e={};
    if(!tempData.ime?.trim())e.ime="Obavezno.";
    if(!tempData.prezime?.trim())e.prezime="Obavezno.";
    if(Object.keys(e).length){setTempErrors(e);return;}
    setSaving(true);
    const row={ime:tempData.ime,prezime:tempData.prezime,telefon:tempData.telefon,adresa:tempData.adresa,is_admin:tempData.is_admin||false,tab_permissions:tempData.tab_permissions||{}};
    const {error} = await sb.from("profiles").update(row).eq("id",editingUser);
    setSaving(false);
    if (error){setGlobalErr("Greška: "+error.message);return;}
    await loadUsers();
    closeModal();
  }

  async function confirmDeleteAction(){
    if(confirmDelete.type==="posao") await deletePosao(confirmDelete.id);
    else if(confirmDelete.type==="kupac") await deleteKupac(confirmDelete.id);
    setConfirmDelete(null);
  }

  function closeModal(){setEditingPosao(null);setViewingPosao(null);setEditingKupac(null);setViewingKupac(null);setEditingUser(null);setNewPosao(false);setNewKupac(false);setNewUser(false);setTempData({});setTempErrors({});}

  async function handleLogout(){
    await sb.auth.signOut();
    setAuthUser(null); setProfile(null);
  }

  // ── loading / auth gates ──────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <link href={FONT_LINK} rel="stylesheet"/>
      <Spinner text="Provera sesije..."/>
    </div>
  );

  if (!authUser || !profile) return <LoginScreen onLogin={u=>{setAuthUser(u);loadProfile(u.id);}}/>;

  const visibleTabs = ALL_TABS.filter(t=>canSee(t.key));

  // ── detail helpers ─────────────────────────────────────────────────────────
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

  // ── POSAO FORM ─────────────────────────────────────────────────────────────
  const PosaoForm = () => (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
      <Field label="Posao (automatski)" value={tempData.Posao} onChange={()=>{}} readOnly/>
      <DateField label="Datum unosa" value={tempData.DatumUnosa} onChange={tf("DatumUnosa")} readOnly={!!newPosao}/>
      <KupacSearchField label="Klijent" sifra={tempData.SifraKupca} naziv={tempData.KLIJENT} kupci={kupci} onChange={k=>setTempData(d=>({...d,SifraKupca:k.SifraKupca,KLIJENT:k.Naziv}))}/>
      <DateField label="Rok za isporuku" value={tempData.RokZaIsporuku} onChange={tf("RokZaIsporuku")}/>
      <Field label="Unosilac posla" value={tempData.Unosilac} onChange={tf("Unosilac")}/>
      <div style={{gridColumn:"1/-1"}}><Field label="Opis" value={tempData.Opis} onChange={tf("Opis")}/></div>
      <div style={{gridColumn:"1/-1"}}><Field label="Specifikacija cene (slobodan tekst)" value={tempData.SpecifikacijaCene} onChange={tf("SpecifikacijaCene")}/></div>
      <Field label="Obračun (RSD)" value={tempData.Obracun} onChange={tf("Obracun")} type="number"/>
      <Field label="Poslati na izradu" value={tempData.PoslatiNaIzradu} onChange={tf("PoslatiNaIzradu")} options={izradaOptions.map(o=>o.naziv)}/>
      <RadioGroup label="Montaža / Isporuka" value={tempData.MontazaIsporuka} onChange={tf("MontazaIsporuka")} options={montazaIsporukaOptions}/>
      <RadioGroup label="Plaćanje" value={tempData.Placanje} onChange={tf("Placanje")} options={placanjeOptions}/>
      <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"0 20px",marginTop:4}}>
        <CheckField label="Završen posao" value={tempData.ZavrsenPosao} onChange={tf("ZavrsenPosao")}/>
        {[["Status izrade",tempData.StatusIzrade,"Radionica"],["Status isporuke",tempData.StatusIsporuke,"Isporuka"],["Status montaže",tempData.StatusMontaze,"Montaža"],["Fakturisano",tempData.Fakturisano,"Knjiženje"]].map(([lbl,val,vn])=>(
          <div key={lbl} style={{marginBottom:14}}>
            <label style={{display:"block",color:T.textSoft,fontSize:12,fontWeight:500,marginBottom:6,fontFamily:T.fontBody}}>{lbl}</label>
            <CheckBadge val={val}/>
            <div style={{color:T.textSoft,fontSize:10,marginTop:5,fontFamily:T.fontBody}}>Menja se u: <span style={{color:T.primary,fontWeight:600}}>{vn}</span></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.fontBody}}>
      <link href={FONT_LINK} rel="stylesheet"/>

      {/* NAVBAR */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 0 rgba(255,255,255,0.04)"}}>
        <div style={{maxWidth:1700,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",height:54}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginRight:28,flexShrink:0}}>
            <div style={{width:26,height:26,background:T.primary,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:9,height:9,background:"#fff",borderRadius:2,transform:"rotate(45deg)"}}/>
            </div>
            <span style={{fontFamily:T.fontHead,fontSize:15,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Poslovi</span>
          </div>
          <nav style={{display:"flex",gap:1,flex:1,overflowX:"auto"}}>
            {visibleTabs.map(t=>(
              <button key={t.key} onClick={()=>setView(t.key)} style={{
                background:view===t.key?T.primaryLight:"none",border:"none",
                color:view===t.key?T.primary:T.textSoft,borderRadius:T.radiusSm,
                padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:view===t.key?600:400,
                transition:"all 0.15s",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",fontFamily:T.fontBody,
              }}>
                <span style={{fontSize:13}}>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          <div style={{display:"flex",alignItems:"center",gap:9,flexShrink:0,marginLeft:12}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:T.primaryLight,border:`2px solid ${T.primaryBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.primary}}>
              {(profile.ime||"?")[0]}{(profile.prezime||"")[0]}
            </div>
            <div style={{lineHeight:1.3}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text}}>{profile.ime} {profile.prezime}</div>
              <div style={{fontSize:10,color:T.textSoft}}>{profile.is_admin?"Administrator":"Korisnik"}</div>
            </div>
            <button onClick={handleLogout} style={{...btnS("ghost"),padding:"5px 11px",fontSize:11,marginLeft:4}}>Odjavi se</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1700,margin:"0 auto",padding:"22px 20px"}}>
        <ErrBanner msg={globalErr} onDismiss={()=>setGlobalErr("")}/>

        {loading && <Spinner/>}

        {!loading && <>

        {/* POSLOVI */}
        {view==="poslovi" && <>
          <PageHeader title="Svi poslovi" subtitle="Pregled svih unetih poslova"/>
          <PosaoTable rows={poslovi} canEdit={canEdit("poslovi")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})}/>
        </>}

        {/* AKTIVNI */}
        {view==="aktivni" && <>
          <PageHeader title="Aktivni poslovi" subtitle="Završen posao = Ne"
            action={canEdit("aktivni")&&<button onClick={openNewPosao} style={btnS("primary")}>+ Novi posao</button>}/>
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <StatCard label="Aktivnih" value={aktivniRows.length} color={T.amber}/>
            <StatCard label="Ukupan obračun" value={aktivniRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.green}/>
          </div>
          <PosaoTable rows={aktivniRows} canEdit={canEdit("aktivni")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})}/>
        </>}

        {/* ZAVRŠENI */}
        {view==="zavrseni" && <>
          <PageHeader title="Završeni poslovi" subtitle="Završen posao = Da"/>
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <StatCard label="Završenih" value={zavrseniRows.length} color={T.green}/>
            <StatCard label="Ukupan obračun" value={zavrseniRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.primary}/>
          </div>
          <PosaoTable rows={zavrseniRows} canEdit={canEdit("zavrseni")} onView={setViewingPosao} onEdit={openEditPosao} onDelete={id=>setConfirmDelete({type:"posao",id})}/>
        </>}

        {/* RADIONICA */}
        {view==="radionica" && <>
          <PageHeader title="Radionica" subtitle="Status izrade se menja samo ovde"/>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>{["Posao","Klijent","Šifra","Datum","Rok isporuke","Unosilac","Opis","Status izrade"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {poslovi.length===0?<tr><td colSpan={8} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema poslova</td></tr>
                :poslovi.map((p,i)=>(
                  <tr key={p.id} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,color:T.primary,fontWeight:700}}>{p.Posao}</td>
                    <td style={{...tdS,fontWeight:500}}>{p.KLIJENT}</td>
                    <td style={{...tdS,color:T.textSoft,fontSize:12}}>{p.SifraKupca}</td>
                    <td style={{...tdS,color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</td>
                    <td style={{...tdS,color:isOverdue(p.RokZaIsporuku)?T.red:T.textMid,fontWeight:isOverdue(p.RokZaIsporuku)?600:400,fontSize:12}}>{fmtDate(p.RokZaIsporuku)}</td>
                    <td style={{...tdS,color:T.textMid}}>{p.Unosilac}</td>
                    <td style={{...tdS,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.textMid}}>{p.Opis}</td>
                    <td style={tdS}><InlineCheck val={p.StatusIzrade} onChange={v=>canEdit("radionica")&&inlineUpdate(p.id,"StatusIzrade",v)} disabled={!canEdit("radionica")}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* MONTAŽA */}
        {view==="montaza" && <>
          <PageHeader title="Montaža" subtitle="Status montaže se menja samo ovde"/>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>{["Posao","Klijent","Šifra kupca","Datum","Rok isporuke","Unosilac","Opis","Status montaže"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {montazaRows.length===0?<tr><td colSpan={8} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema poslova za montažu</td></tr>
                :montazaRows.map((p,i)=>(
                  <tr key={p.id} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,color:T.primary,fontWeight:700}}>{p.Posao}</td>
                    <td style={{...tdS,fontWeight:500}}>{p.KLIJENT}</td>
                    <td style={{...tdS,color:T.textSoft,fontSize:12}}>{p.SifraKupca}</td>
                    <td style={{...tdS,color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</td>
                    <td style={{...tdS,color:isOverdue(p.RokZaIsporuku)?T.red:T.textMid,fontWeight:isOverdue(p.RokZaIsporuku)?600:400,fontSize:12}}>{fmtDate(p.RokZaIsporuku)}</td>
                    <td style={{...tdS,color:T.textMid}}>{p.Unosilac}</td>
                    <td style={{...tdS,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.textMid}}>{p.Opis}</td>
                    <td style={tdS}><InlineCheck val={p.StatusMontaze} onChange={v=>canEdit("montaza")&&inlineUpdate(p.id,"StatusMontaze",v)} disabled={!canEdit("montaza")}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* ISPORUKA */}
        {view==="isporuka" && <>
          <PageHeader title="Isporuka" subtitle="Status isporuke se menja samo ovde"/>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>{["Posao","Klijent","Šifra kupca","Datum","Rok isporuke","Unosilac","Opis","Status isporuke"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {isporukaRows.length===0?<tr><td colSpan={8} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema poslova za isporuku</td></tr>
                :isporukaRows.map((p,i)=>(
                  <tr key={p.id} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,color:T.primary,fontWeight:700}}>{p.Posao}</td>
                    <td style={{...tdS,fontWeight:500}}>{p.KLIJENT}</td>
                    <td style={{...tdS,color:T.textSoft,fontSize:12}}>{p.SifraKupca}</td>
                    <td style={{...tdS,color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</td>
                    <td style={{...tdS,color:isOverdue(p.RokZaIsporuku)?T.red:T.textMid,fontWeight:isOverdue(p.RokZaIsporuku)?600:400,fontSize:12}}>{fmtDate(p.RokZaIsporuku)}</td>
                    <td style={{...tdS,color:T.textMid}}>{p.Unosilac}</td>
                    <td style={{...tdS,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.textMid}}>{p.Opis}</td>
                    <td style={tdS}><InlineCheck val={p.StatusIsporuke} onChange={v=>canEdit("isporuka")&&inlineUpdate(p.id,"StatusIsporuke",v)} disabled={!canEdit("isporuka")}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* KNJIŽENJE */}
        {view==="knjizenje" && <>
          <PageHeader title="Knjiženje" subtitle="Završeni poslovi sa Fakturom · Fakturisano se menja samo ovde"/>
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <StatCard label="Za knjiženje" value={knjigenjeRows.length} color={T.primary}/>
            <StatCard label="Fakturisano" value={knjigenjeRows.filter(p=>p.Fakturisano).length} color={T.green}/>
            <StatCard label="Nije fakturisano" value={knjigenjeRows.filter(p=>!p.Fakturisano).length} color={T.amber}/>
            <StatCard label="Ukupan obračun" value={knjigenjeRows.reduce((s,p)=>s+(parseFloat(p.Obracun)||0),0).toLocaleString()+" RSD"} color={T.textMid}/>
          </div>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>{["Posao","Klijent","Šifra kupca","Datum","Opis","Specifikacija cene","Obračun","Fakturisano"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {knjigenjeRows.length===0?<tr><td colSpan={8} style={{...tdS,textAlign:"center",color:T.textSoft,padding:40}}>Nema poslova za knjiženje</td></tr>
                :knjigenjeRows.map((p,i)=>(
                  <tr key={p.id} style={{background:p.Fakturisano?T.greenBg:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=p.Fakturisano?T.greenBg:i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,color:T.primary,fontWeight:700}}>{p.Posao}</td>
                    <td style={{...tdS,fontWeight:500}}>{p.KLIJENT}</td>
                    <td style={{...tdS,color:T.textSoft,fontSize:12}}>{p.SifraKupca}</td>
                    <td style={{...tdS,color:T.textMid,fontSize:12}}>{fmtDate(p.DatumUnosa)}</td>
                    <td style={{...tdS,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:T.textMid}}>{p.Opis}</td>
                    <td style={{...tdS,color:T.textMid,fontSize:12,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.SpecifikacijaCene||"—"}</td>
                    <td style={{...tdS,fontWeight:700,color:T.green}}>{p.Obracun?`${parseFloat(p.Obracun).toLocaleString()} RSD`:"—"}</td>
                    <td style={tdS}><InlineCheck val={p.Fakturisano} onChange={v=>canEdit("knjizenje")&&inlineUpdate(p.id,"Fakturisano",v)} disabled={!canEdit("knjizenje")}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* KUPCI */}
        {view==="kupci" && <>
          <PageHeader title="Kupci" subtitle="Baza klijenata" action={canEdit("kupci")&&<button onClick={openNewKupac} style={btnS("primary")}>+ Novi kupac</button>}/>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:T.surface}}>
              <thead><tr>{["Šifra","Naziv","Grad","Ulica","Br.","Poštanski","Telefon","PIB",""].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {kupci.map((k,i)=>(
                  <tr key={k.id} style={{background:i%2===0?T.surface:T.surfaceHover,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover} onDoubleClick={()=>setViewingKupac(k)}>
                    <td style={{...tdS,color:T.primary,fontWeight:700,fontSize:12}}>{k.SifraKupca}</td>
                    <td style={{...tdS,fontWeight:500}}>{k.Naziv}</td>
                    <td style={{...tdS,color:T.textMid}}>{k.Grad}</td>
                    <td style={{...tdS,color:T.textMid}}>{k.Ulica}</td>
                    <td style={{...tdS,color:T.textMid}}>{k.Broj}</td>
                    <td style={{...tdS,color:T.textMid}}>{k.PostanskiBroj}</td>
                    <td style={{...tdS,color:T.textMid}}>{k.Telefon}</td>
                    <td style={{...tdS,color:T.textSoft,fontSize:12}}>{k.PIB}</td>
                    <td style={tdS} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:5}}>
                        {canEdit("kupci")
                          ? <><button onClick={()=>openEditKupac(k)} style={btnS("edit")}>Uredi</button><button onClick={()=>setConfirmDelete({type:"kupac",id:k.id})} style={btnS("danger")}>Briši</button></>
                          : <button onClick={()=>setViewingKupac(k)} style={btnS("ghost")}>Pregled</button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* OBRAČUN */}
        {view==="obracun" && <>
          <PageHeader title="Obračun po načinu plaćanja"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginBottom:24}}>
            {Object.entries(obracunSums).map(([nacin,suma])=>(
              <StatCard key={nacin} label={nacin} value={suma.toLocaleString()+" RSD"} color={placanjeColor(nacin)} sub={`${poslovi.filter(p=>p.Placanje===nacin).length} poslova`}/>
            ))}
          </div>
          <div style={{background:T.surface,borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Plaćanje","Broj poslova","Ukupan obračun"].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(obracunSums).map(([nacin,suma],i)=>(
                  <tr key={nacin} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,fontWeight:600}}><PlacanjeBadge val={nacin}/></td>
                    <td style={{...tdS,color:T.textMid}}>{poslovi.filter(p=>p.Placanje===nacin).length}</td>
                    <td style={{...tdS,color:T.green,fontWeight:700,fontSize:15}}>{suma.toLocaleString()} RSD</td>
                  </tr>
                ))}
                <tr style={{borderTop:`2px solid ${T.border}`,background:T.surfaceRaised}}>
                  <td style={{...tdS,fontWeight:700,color:T.text}}>UKUPNO</td>
                  <td style={{...tdS,fontWeight:700,color:T.textMid}}>{poslovi.length}</td>
                  <td style={{...tdS,color:T.primary,fontWeight:800,fontSize:17,fontFamily:T.fontHead}}>{Object.values(obracunSums).reduce((a,b)=>a+b,0).toLocaleString()} RSD</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>}

        {/* KORISNICI */}
        {view==="korisnici" && <>
          <PageHeader title="Korisnici" subtitle="Nalozi i dozvole — Novi korisnici se dodaju u Supabase Authentication"/>
          <div style={{overflowX:"auto",borderRadius:T.radius,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
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
                    <td style={tdS}>
                      <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                        {ALL_TABS.map(t=>{const p=u.tab_permissions?.[t.key];if(!p||p==="none")return null;
                          return <span key={t.key} style={{background:p==="edit"?T.greenBg:T.amberBg,color:p==="edit"?T.green:T.amber,border:`1px solid ${p==="edit"?T.greenBorder:T.amberBorder}`,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:600}}>{t.label}</span>;
                        })}
                      </div>
                    </td>
                    {profile.is_admin && (
                      <td style={tdS} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>openEditUser(u)} style={btnS("edit")}>Uredi dozvole</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12,padding:"12px 16px",background:T.amberBg,border:`1px solid ${T.amberBorder}`,borderRadius:T.radiusSm,color:T.amber,fontSize:12,fontFamily:T.fontBody}}>
            💡 Novi korisnici se kreiraju u <strong>Supabase → Authentication → Add user</strong>. Nakon kreiranja, pojave se ovde i možete im podesiti dozvole.
          </div>
        </>}

        </>}
      </div>

      {/* ═══ EDIT/NEW POSAO ═══ */}
      {(editingPosao||newPosao) && (
        <Modal title={newPosao?`Novi posao — ${tempData.Posao}`:`Uredi: ${tempData.Posao}`} onClose={closeModal} wide>
          <PosaoForm/>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:22,borderTop:`1px solid ${T.border}`,paddingTop:18}}>
            <button onClick={closeModal} style={btnS("ghost")}>Otkaži</button>
            <button onClick={savePosao} disabled={saving} style={{...btnS("primary"),opacity:saving?0.6:1}}>{saving?"Snima...":"Sačuvaj"}</button>
          </div>
        </Modal>
      )}

      {/* ═══ DETAIL — POSAO ═══ */}
      {viewingPosao && (
        <Modal title={`Posao ${viewingPosao.Posao}`} onClose={closeModal} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 36px"}}>
            {df("Broj posla",viewingPosao.Posao,T.primary)}
            {df("Datum unosa",fmtDate(viewingPosao.DatumUnosa))}
            {df("Klijent",viewingPosao.KLIJENT)}
            {df("Šifra kupca",viewingPosao.SifraKupca)}
            {df("Rok za isporuku",fmtDate(viewingPosao.RokZaIsporuku))}
            {df("Unosilac",viewingPosao.Unosilac)}
            <div style={{gridColumn:"1/-1",marginBottom:16}}>
              <div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>Opis</div>
              <div style={{color:T.text,fontSize:14,lineHeight:1.7,background:T.surfaceRaised,borderRadius:T.radiusSm,padding:"10px 13px",border:`1px solid ${T.border}`}}>{viewingPosao.Opis||"—"}</div>
            </div>
            <div style={{gridColumn:"1/-1",marginBottom:16}}>
              <div style={{color:T.textSoft,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>Specifikacija cene</div>
              <div style={{color:T.text,fontSize:13,background:T.surfaceRaised,borderRadius:T.radiusSm,padding:"10px 13px",border:`1px solid ${T.border}`}}>{viewingPosao.SpecifikacijaCene||"—"}</div>
            </div>
            {divider("Finansije i plaćanje")}
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

      {/* ═══ EDIT/NEW KUPAC ═══ */}
      {(editingKupac||newKupac) && (
        <Modal title={newKupac?"Novi kupac":`Uredi: ${tempData.Naziv}`} onClose={closeModal}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
            <Field label="Šifra kupca" value={tempData.SifraKupca} onChange={tf("SifraKupca")}/>
            <Field label="Naziv" value={tempData.Naziv} onChange={tf("Naziv")}/>
            <Field label="Grad" value={tempData.Grad} onChange={tf("Grad")}/>
            <Field label="Ulica" value={tempData.Ulica} onChange={tf("Ulica")}/>
            <Field label="Broj" value={tempData.Broj} onChange={tf("Broj")}/>
            <Field label="Poštanski broj" value={tempData.PostanskiBroj} onChange={tf("PostanskiBroj")}/>
            <Field label="Telefon" value={tempData.Telefon} onChange={tf("Telefon")}/>
            <Field label="PIB" value={tempData.PIB} onChange={tf("PIB")}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:22,borderTop:`1px solid ${T.border}`,paddingTop:18}}>
            <button onClick={closeModal} style={btnS("ghost")}>Otkaži</button>
            <button onClick={saveKupac} disabled={saving} style={{...btnS("primary"),opacity:saving?0.6:1}}>{saving?"Snima...":"Sačuvaj"}</button>
          </div>
        </Modal>
      )}

      {/* ═══ DETAIL — KUPAC ═══ */}
      {viewingKupac && (
        <Modal title={viewingKupac.Naziv} onClose={closeModal}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 36px"}}>
            {df("Šifra kupca",viewingKupac.SifraKupca,T.primary)}
            {df("Naziv",viewingKupac.Naziv)}
            {df("Grad",viewingKupac.Grad)}
            {df("Ulica i broj",`${viewingKupac.Ulica||""} ${viewingKupac.Broj||""}`.trim())}
            {df("Poštanski broj",viewingKupac.PostanskiBroj)}
            {df("Telefon",viewingKupac.Telefon)}
            {df("PIB",viewingKupac.PIB)}
            <div style={{gridColumn:"1/-1",borderTop:`1px solid ${T.border}`,paddingTop:14,marginTop:4}}>
              <div style={{color:T.textSoft,fontSize:12,marginBottom:8,fontWeight:500}}>Poslovi ovog kupca:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {poslovi.filter(p=>p.SifraKupca===viewingKupac.SifraKupca).length===0
                  ? <span style={{color:T.textSoft,fontSize:13}}>Nema poslova</span>
                  : poslovi.filter(p=>p.SifraKupca===viewingKupac.SifraKupca).map(p=>(
                    <span key={p.id} onClick={()=>{setViewingKupac(null);setViewingPosao(p);}} style={{background:T.primaryLight,border:`1px solid ${T.primaryBorder}`,color:T.primary,borderRadius:T.radiusSm,padding:"4px 11px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{p.Posao}</span>
                  ))
                }
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:22,borderTop:`1px solid ${T.border}`,paddingTop:18}}>
            <button onClick={closeModal} style={btnS("ghost")}>Zatvori</button>
            {canEdit("kupci")&&<button onClick={()=>{openEditKupac(viewingKupac);setViewingKupac(null);}} style={btnS("primary")}>Uredi</button>}
          </div>
        </Modal>
      )}

      {/* ═══ EDIT USER PERMISSIONS ═══ */}
      {editingUser && (
        <Modal title={`Dozvole: ${tempData.ime} ${tempData.prezime}`} onClose={closeModal} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 22px",marginBottom:16}}>
            <Field label="Ime" value={tempData.ime} onChange={tf("ime")} error={tempErrors.ime}/>
            <Field label="Prezime" value={tempData.prezime} onChange={tf("prezime")} error={tempErrors.prezime}/>
            <Field label="Telefon" value={tempData.telefon} onChange={tf("telefon")}/>
            <div style={{gridColumn:"1/-1"}}><Field label="Adresa" value={tempData.adresa} onChange={tf("adresa")}/></div>
          </div>
          <div style={{color:T.text,fontSize:13,fontWeight:600,marginBottom:10,fontFamily:T.fontHead}}>Dozvole po karticama</div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:T.radius,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><th style={thS}>Kartica</th><th style={thS}>Dozvola</th></tr></thead>
              <tbody>
                {ALL_TABS.map((t,i)=>(
                  <tr key={t.key} style={{background:i%2===0?T.surface:T.surfaceHover}} onMouseEnter={e=>e.currentTarget.style.background=T.primaryLight} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.surface:T.surfaceHover}>
                    <td style={{...tdS,fontWeight:500,fontSize:12}}>{t.icon} {t.label}</td>
                    <td style={tdS}>
                      <div style={{display:"flex",gap:8}}>
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
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:22,borderTop:`1px solid ${T.border}`,paddingTop:18}}>
            <button onClick={closeModal} style={btnS("ghost")}>Otkaži</button>
            <button onClick={saveUser} disabled={saving} style={{...btnS("primary"),opacity:saving?0.6:1}}>{saving?"Snima...":"Sačuvaj"}</button>
          </div>
        </Modal>
      )}

      {/* ═══ CONFIRM DELETE ═══ */}
      {confirmDelete && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.70)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(6px)"}}>
          <div style={{background:T.surface,borderRadius:T.radiusLg,padding:"34px 38px",maxWidth:390,width:"90vw",boxShadow:T.shadowLg,border:`1px solid ${T.border}`,textAlign:"center"}}>
            <div style={{width:48,height:48,background:T.redBg,border:`1px solid ${T.redBorder}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",fontSize:20}}>🗑</div>
            <h3 style={{color:T.text,fontFamily:T.fontHead,margin:"0 0 8px",fontSize:19,fontWeight:700}}>Potvrda brisanja</h3>
            <p style={{color:T.textMid,fontSize:13,margin:"0 0 24px",lineHeight:1.6,fontFamily:T.fontBody}}>
              Da li ste sigurni? Ova akcija se ne može poništiti.
            </p>
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
