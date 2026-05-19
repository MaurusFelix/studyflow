/* ═══════════════════════════════════════════════════════════
   StudyFlow — app.js
═══════════════════════════════════════════════════════════ */
const COLORS = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6366F1'];
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const state = {
  user:null, faecher:[], noten:[], methoden:[], eintraege:[], themen:[], kalender:[],
  charts:{}, selColor:'#EF4444',
  calDate:new Date(), calView:'monat',
  timer:{running:false, sec:0, iv:null, goalMin:0},
  dragEv:null
};

/* ─── API ─────────────────────────────────────────────── */
async function api(method,path,data){
  const o={method,credentials:'include',headers:{'Content-Type':'application/json'}};
  if(data) o.body=JSON.stringify(data);
  try{const r=await fetch('/api'+path,o);return r.json();}catch{return{};}
}

/* ─── INIT ────────────────────────────────────────────── */
async function init(){
  const me=await api('GET','/me');
  if(me.logged_in){state.user=me;await enterApp();}
  buildColorDots();
  document.getElementById('login-pw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  document.getElementById('reg-pw').addEventListener('keydown',e=>{if(e.key==='Enter')doRegister();});
}
async function enterApp(){
  document.getElementById('landing').style.display='none';
  document.getElementById('app').classList.add('active');
  document.getElementById('sidebar-uname').textContent=state.user.username;
  document.getElementById('sidebar-uav').textContent=state.user.username[0].toUpperCase();
  document.getElementById('settings-uname').textContent=state.user.username;
  await loadAll();
  showPage('dashboard');
  setTodayDates();
}
async function loadAll(){
  const [f,n,m,l,t,k]=await Promise.all([
    api('GET','/faecher'),api('GET','/noten'),api('GET','/lernmethoden'),
    api('GET','/lerneintraege'),api('GET','/themen'),api('GET','/kalender')
  ]);
  state.faecher=Array.isArray(f)?f:[];
  state.noten=Array.isArray(n)?n:[];
  state.methoden=Array.isArray(m)?m:[];
  state.eintraege=Array.isArray(l)?l:[];
  state.themen=Array.isArray(t)?t:[];
  state.kalender=Array.isArray(k)?k:[];
  fillFachDrops();fillMethodeDrops();
}
function setTodayDates(){
  const t=new Date().toISOString().split('T')[0];
  ['note-datum','lernen-datum','quick-datum','event-datum'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value=t;
  });
}

/* ─── AUTH ────────────────────────────────────────────── */
async function doLogin(){
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pw').value;
  const err=document.getElementById('login-err');
  if(!u||!p){showErr(err,'Bitte alle Felder ausfüllen');return;}
  const r=await api('POST','/login',{username:u,password:p});
  if(r.success){state.user=r;closeModal('login');await enterApp();}
  else showErr(err,r.message||'Ungültige Anmeldedaten');
}
async function doRegister(){
  const u=document.getElementById('reg-user').value.trim();
  const e=document.getElementById('reg-email').value.trim();
  const p=document.getElementById('reg-pw').value;
  const err=document.getElementById('reg-err');
  if(!u||!p){showErr(err,'Pflichtfelder ausfüllen');return;}
  if(p.length<6){showErr(err,'Passwort min. 6 Zeichen');return;}
  const r=await api('POST','/register',{username:u,email:e,password:p});
  if(r.success){state.user=r;closeModal('register');await enterApp();toast('🎉 Willkommen, '+u+'!','ok');}
  else showErr(err,r.message||'Fehler');
}
async function doLogout(){
  await api('POST','/logout');
  state.user=null;
  document.getElementById('app').classList.remove('active');
  document.getElementById('landing').style.display='flex';
  Object.values(state.charts).forEach(c=>{try{c.destroy();}catch{}});
  state.charts={};
}

/* ─── NAV ─────────────────────────────────────────────── */
const PAGE_TITLES={dashboard:'Übersicht',noten:'Noten',lernen:'Lernen',kalender:'Planung',statistiken:'Statistiken',methoden:'Lernmethoden',einstellungen:'Einstellungen'};
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nv').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.getElementById('nv-'+name).classList.add('active');
  document.getElementById('topbar-title').textContent=PAGE_TITLES[name]||name;
  if(window.innerWidth<=900)closeSidebar();
  const map={dashboard:renderDashboard,noten:renderNoten,lernen:renderLernen,kalender:renderKalender,statistiken:renderStatistiken,methoden:renderMethoden,einstellungen:renderSettings};
  if(map[name]) map[name]();
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');}

/* ─── DASHBOARD ───────────────────────────────────────── */
async function renderDashboard(){
  const d=await api('GET','/stats/dashboard');
  const lernstd=Math.floor((d.lernzeit_woche||0)/60);
  const lernmin=(d.lernzeit_woche||0)%60;
  const avg=d.avg_noten||[];
  const withAvg=avg.filter(f=>f.avg);
  const gesAvg=withAvg.length?(withAvg.reduce((s,f)=>s+f.avg,0)/withAvg.length).toFixed(2):'–';
  const ln=d.letzte_note;

  document.getElementById('dash-stats').innerHTML=`
    <div class="scard fade-anim"><div class="sico">⏱️</div><div class="slbl">Lernzeit diese Woche</div>
      <div class="sval">${lernstd}h&nbsp;<span style="font-size:1.2rem">${lernmin}m</span></div>
      <div class="ssub">Total Minuten: ${d.lernzeit_woche||0}</div></div>
    <div class="scard fade-anim" style="animation-delay:.05s"><div class="sico">🎓</div><div class="slbl">Aktive Fächer</div>
      <div class="sval">${state.faecher.length}</div><div class="ssub">Schuljahr ${new Date().getFullYear()}</div></div>
    <div class="scard fade-anim" style="animation-delay:.1s"><div class="sico">📝</div><div class="slbl">Letzte Note</div>
      <div class="sval">${ln?ln.note:'–'}</div><div class="ssub">${ln?ln.fach+' · '+ln.titel:'Noch keine Noten'}</div></div>
    <div class="scard fade-anim" style="animation-delay:.15s"><div class="sico">⭐</div><div class="slbl">Gesamtdurchschnitt</div>
      <div class="sval">${gesAvg}</div><div class="ssub">Über alle Fächer</div></div>
  `;

  // Chart 1: Lernzeit pro Fach (Balken)
  const lzf=d.lernzeit_pro_fach||[];
  destroyChart('ch-dash-fach');
  if(lzf.length){
    state.charts['ch-dash-fach']=new Chart(document.getElementById('ch-dash-fach'),{
      type:'bar',
      data:{labels:lzf.map(f=>f.name),datasets:[{data:lzf.map(f=>+(f.total/60).toFixed(1)),backgroundColor:lzf.map(f=>f.farbe+'CC'),borderRadius:8,borderSkipped:false}]},
      options:chOpts('Stunden')
    });
  }

  // Chart 2: Notendurchschnitte (horizontal bar)
  const nd=(d.avg_noten||[]).filter(f=>f.avg);
  destroyChart('ch-dash-noten');
  if(nd.length){
    state.charts['ch-dash-noten']=new Chart(document.getElementById('ch-dash-noten'),{
      type:'bar',
      data:{labels:nd.map(f=>f.name),datasets:[{data:nd.map(f=>f.avg),backgroundColor:nd.map(f=>f.farbe+'CC'),borderRadius:8,borderSkipped:false}]},
      options:{...chOpts('Note'),indexAxis:'y',scales:{x:{min:1,max:6,...chScale()},y:{...chScale()}}}
    });
  }

  // Letzte Einträge
  const el=document.getElementById('dash-eintraege');
  const ee=d.letzte_eintraege||[];
  el.innerHTML=ee.length?ee.map(e=>entryHTML(e,false)).join(''): emptyHTML('📚','Noch keine Lerneinträge','Starte deinen ersten Lerneintrag');
}

/* ─── NOTEN ───────────────────────────────────────────── */
function renderNoten(){
  const el=document.getElementById('noten-list');
  if(!state.faecher.length){el.innerHTML=emptyHTML('🎓','Keine Fächer','Füge zuerst ein Fach hinzu');return;}
  el.innerHTML=state.faecher.map(fach=>{
    const fn=state.noten.filter(n=>n.fach_id===fach.id);
    const avg=fn.length?(fn.reduce((s,n)=>s+n.note,0)/fn.length).toFixed(2):null;
    const ac=!avg?'ap-none':avg>=5?'ap-good':avg>=4?'ap-ok':'ap-bad';
    const rows=fn.length?fn.map(n=>{
      const nc=n.note>=5?'ncg':n.note>=4?'nco':'ncb';
      return `<tr>
        <td><div class="nc ${nc}">${n.note}</div></td>
        <td>${n.titel||'–'}</td>
        <td>${fmtDate(n.datum)}</td>
        <td><span class="chip">Sem. ${n.semester||1}</span></td>
        <td style="text-align:right;display:flex;gap:4px;justify-content:flex-end">
          <button class="btn-ico btn-g" onclick="openEditNote(${n.id})" style="font-size:.85rem">✏️</button>
          <button class="btn-ico btn-g" onclick="delNote(${n.id})" style="font-size:.85rem">🗑️</button>
        </td></tr>`;
    }).join(''):`<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text2);font-size:.85rem">Noch keine Noten</td></tr>`;
    return `<div class="fach-card" id="fc-${fach.id}">
      <div class="fach-hd" onclick="toggleFach(${fach.id})">
        <div class="fach-hl">
          <div class="fach-stripe" style="background:${fach.farbe}"></div>
          <div><div class="fach-nm">${fach.name}</div><div class="fach-cnt">${fn.length} Note${fn.length!==1?'n':''}</div></div>
          <div class="apill ${ac}">⌀ ${avg||'–'}</div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="fach-chev">▶</span>
        </div>
      </div>
      <div class="fach-bd">
        <table class="nt"><thead><tr><th>Note</th><th>Titel</th><th>Datum</th><th>Semester</th><th style="text-align:right">Aktionen</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="fach-ft"><button class="btn btn-p btn-sm" onclick="openAddNoteForFach(${fach.id})">+ Note</button></div>
      </div>
    </div>`;
  }).join('');
}
function toggleFach(id){document.getElementById('fc-'+id)?.classList.toggle('open');}
function openAddNote(){
  document.getElementById('note-edit-id').value='';
  document.getElementById('modal-note-title').textContent='📝 Note hinzufügen';
  ['note-val','note-titel'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('note-datum').value=new Date().toISOString().split('T')[0];
  openModal('note');
}
function openAddNoteForFach(fid){openAddNote();setTimeout(()=>{document.getElementById('note-fach').value=fid;},50);}
function openEditNote(nid){
  const n=state.noten.find(x=>x.id===nid);if(!n)return;
  document.getElementById('note-edit-id').value=nid;
  document.getElementById('modal-note-title').textContent='✏️ Note bearbeiten';
  document.getElementById('note-fach').value=n.fach_id;
  document.getElementById('note-val').value=n.note;
  document.getElementById('note-sem').value=n.semester||'1';
  document.getElementById('note-titel').value=n.titel||'';
  document.getElementById('note-datum').value=n.datum;
  openModal('note');
}
async function saveNote(){
  const nid=document.getElementById('note-edit-id').value;
  const d={fach_id:+document.getElementById('note-fach').value,note:+document.getElementById('note-val').value,
    titel:document.getElementById('note-titel').value.trim(),datum:document.getElementById('note-datum').value,
    semester:document.getElementById('note-sem').value};
  if(!d.fach_id||!d.note||!d.datum){toast('Pflichtfelder ausfüllen','err');return;}
  if(nid) await api('PUT','/noten/'+nid,d); else await api('POST','/noten',d);
  closeModal('note');
  state.noten=await api('GET','/noten').then(r=>Array.isArray(r)?r:[]);
  renderNoten();toast(nid?'Note aktualisiert':'Note gespeichert ✓','ok');
}
async function delNote(nid){
  if(!confirm('Note löschen?'))return;
  await api('DELETE','/noten/'+nid);
  state.noten=state.noten.filter(n=>n.id!==nid);renderNoten();toast('Note gelöscht','ok');
}

/* ─── LERNEN ──────────────────────────────────────────── */
function renderLernen(){
  const el=document.getElementById('lernen-list');
  const ee=state.eintraege.filter(e=>!e.geplant);
  el.innerHTML=ee.length?ee.map(e=>entryHTML(e,true)).join(''): emptyHTML('📚','Noch keine Einträge','Tracke deine erste Lerneinheit');
}
function openAddLernen(){
  document.getElementById('lernen-edit-id').value='';
  document.getElementById('lernen-modal-title').textContent='📚 Lerneintrag';
  ['lernen-desc','lernen-dauer','lernen-titel'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('lernen-datum').value=new Date().toISOString().split('T')[0];
  openModal('lernen');
}
function openEditLernen(eid){
  const e=state.eintraege.find(x=>x.id===eid);if(!e)return;
  document.getElementById('lernen-edit-id').value=eid;
  document.getElementById('lernen-modal-title').textContent='✏️ Eintrag bearbeiten';
  document.getElementById('lernen-fach').value=e.fach_id;
  document.getElementById('lernen-methode').value=e.methode_id||'';
  document.getElementById('lernen-titel').value=e.titel;
  document.getElementById('lernen-desc').value=e.beschreibung||'';
  document.getElementById('lernen-dauer').value=e.dauer_minuten;
  document.getElementById('lernen-datum').value=e.datum;
  openModal('lernen');
}
async function saveLerneintrag(){
  const eid=document.getElementById('lernen-edit-id').value;
  const d={fach_id:+document.getElementById('lernen-fach').value,
    methode_id:document.getElementById('lernen-methode').value||null,
    titel:document.getElementById('lernen-titel').value.trim(),
    beschreibung:document.getElementById('lernen-desc').value.trim(),
    dauer_minuten:+document.getElementById('lernen-dauer').value,
    datum:document.getElementById('lernen-datum').value};
  if(!d.fach_id||!d.titel||!d.dauer_minuten){toast('Pflichtfelder ausfüllen','err');return;}
  if(eid) await api('PUT','/lerneintraege/'+eid,d); else await api('POST','/lerneintraege',d);
  closeModal('lernen');
  state.eintraege=await api('GET','/lerneintraege').then(r=>Array.isArray(r)?r:[]);
  renderLernen();toast(eid?'Eintrag aktualisiert':'Eintrag gespeichert ✓','ok');
}
async function delEintrag(eid){
  if(!confirm('Eintrag löschen?'))return;
  await api('DELETE','/lerneintraege/'+eid);
  state.eintraege=state.eintraege.filter(e=>e.id!==eid);renderLernen();toast('Eintrag gelöscht','ok');
}
async function quickSave(){
  const fach=document.getElementById('quick-fach').value;
  const titel=document.getElementById('quick-titel').value.trim();
  const dauer=document.getElementById('quick-dauer').value;
  const datum=document.getElementById('quick-datum').value;
  if(!fach||!titel||!dauer){toast('Fach, Titel und Dauer ausfüllen','err');return;}
  await api('POST','/lerneintraege',{fach_id:+fach,titel,dauer_minuten:+dauer,datum});
  toast('Eintrag gespeichert ✓','ok');
  document.getElementById('quick-titel').value='';document.getElementById('quick-dauer').value='';
  state.eintraege=await api('GET','/lerneintraege').then(r=>Array.isArray(r)?r:[]);
  renderLernen();
}
function loadThemenLernen(){
  const fid=+document.getElementById('lernen-fach').value;
  const sel=document.getElementById('lernen-thema-sel');
  const th=state.themen.filter(t=>t.fach_id===fid&&!t.abgeschlossen);
  sel.innerHTML='<option value="">— Thema wählen —</option>'+th.map(t=>`<option value="${t.name}">${t.name}</option>`).join('');
}
function loadThemenQuick(){
  const fid=+document.getElementById('quick-fach').value;
  const sel=document.getElementById('quick-thema');
  const th=state.themen.filter(t=>t.fach_id===fid&&!t.abgeschlossen);
  sel.innerHTML='<option value="">— Thema —</option>'+th.map(t=>`<option value="${t.name}">${t.name}</option>`).join('');
}
function applyThemaLernen(){const v=document.getElementById('lernen-thema-sel').value;if(v)document.getElementById('lernen-titel').value=v;}
function applyThemaQuick(){const v=document.getElementById('quick-thema').value;if(v)document.getElementById('quick-titel').value=v;}

/* Themen-Modal */
function openThemenModal(){
  const sel=document.getElementById('thema-fach');
  sel.innerHTML=state.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  renderThemenList();openModal('themen');
}
function renderThemenList(){
  const fid=+document.getElementById('thema-fach').value;
  const th=state.themen.filter(t=>t.fach_id===fid);
  const el=document.getElementById('themen-list');
  if(!th.length){el.innerHTML=`<div class="empty" style="padding:20px"><p>Noch keine Themen</p></div>`;return;}
  el.innerHTML=th.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:9px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--bg)">
    <span style="flex:1;font-size:.88rem;${t.abgeschlossen?'text-decoration:line-through;color:var(--text2)':''}">${t.name}</span>
    <button class="btn-ico btn-g" onclick="toggleThema(${t.id},${t.abgeschlossen?0:1})" title="${t.abgeschlossen?'Reaktivieren':'Abschliessen'}">${t.abgeschlossen?'↩️':'✅'}</button>
    <button class="btn-ico btn-g" onclick="delThema(${t.id})">🗑️</button>
  </div>`).join('');
}
async function addThema(){
  const name=document.getElementById('thema-name').value.trim();
  const fid=+document.getElementById('thema-fach').value;
  if(!name||!fid){toast('Name eingeben','err');return;}
  await api('POST','/themen',{fach_id:fid,name});
  document.getElementById('thema-name').value='';
  state.themen=await api('GET','/themen').then(r=>Array.isArray(r)?r:[]);
  renderThemenList();
}
async function toggleThema(tid,val){await api('PUT','/themen/'+tid,{abgeschlossen:val});state.themen=await api('GET','/themen').then(r=>Array.isArray(r)?r:[]);renderThemenList();}
async function delThema(tid){if(!confirm('Thema löschen?'))return;await api('DELETE','/themen/'+tid);state.themen=state.themen.filter(t=>t.id!==tid);renderThemenList();}

/* ─── TIMER ───────────────────────────────────────────── */
function toggleTimer(){
  if(state.timer.running){
    clearInterval(state.timer.iv);state.timer.running=false;
    document.getElementById('timer-startstop').textContent='▶ Fortsetzen';
    document.getElementById('timer-stateLabel').textContent='Pausiert';
  }else{
    state.timer.iv=setInterval(()=>{state.timer.sec++;updateTimerDisplay();},1000);
    state.timer.running=true;
    document.getElementById('timer-startstop').textContent='⏸ Pause';
    document.getElementById('timer-stateLabel').textContent='Läuft...';
  }
}
function resetTimer(){
  clearInterval(state.timer.iv);
  state.timer={running:false,sec:0,iv:null,goalMin:0};
  document.getElementById('timer-display').textContent='00:00:00';
  document.getElementById('timer-startstop').textContent='▶ Starten';
  document.getElementById('timer-stateLabel').textContent='Bereit';
  updateRing(0);
}
function updateTimerDisplay(){
  const s=state.timer.sec;
  const h=Math.floor(s/3600).toString().padStart(2,'0');
  const m=Math.floor((s%3600)/60).toString().padStart(2,'0');
  const sec=(s%60).toString().padStart(2,'0');
  document.getElementById('timer-display').textContent=`${h}:${m}:${sec}`;
  const goal=state.timer.goalMin*60||3600;
  updateRing(Math.min(s/goal,1));
}
function updateRing(progress){
  const r=80,circ=2*Math.PI*r;
  const fill=document.getElementById('ring-fill');
  if(fill){fill.setAttribute('stroke-dasharray',circ);fill.setAttribute('stroke-dashoffset',circ*(1-progress));}
}
function updateTimerFachLabel(){
  const sel=document.getElementById('timer-fach');
  const nm=sel.options[sel.selectedIndex]?.text||'Kein Fach';
  document.getElementById('timer-fach-lbl').textContent=nm;
}
async function saveTimerEntry(){
  const mins=Math.max(1,Math.round(state.timer.sec/60));
  const fid=document.getElementById('timer-fach').value;
  if(!fid){toast('Fach auswählen','err');return;}
  if(state.timer.sec<10){toast('Timer zu kurz','err');return;}
  await api('POST','/lerneintraege',{fach_id:+fid,titel:'Timer-Sitzung',dauer_minuten:mins,datum:new Date().toISOString().split('T')[0]});
  toast(`${mins} Minuten gespeichert ✓`,'ok');
  resetTimer();
  state.eintraege=await api('GET','/lerneintraege').then(r=>Array.isArray(r)?r:[]);
  renderLernen();
}

/* ─── KALENDER ─────────────────────────────────────────── */
function renderKalender(){
  const d=state.calDate;
  document.getElementById('cal-title').textContent=`${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if(state.calView==='monat') renderMonat();
  else renderWoche();
  renderUpcoming();
}
function renderMonat(){
  const d=state.calDate;
  const today=new Date();
  const first=new Date(d.getFullYear(),d.getMonth(),1);
  let startDay=first.getDay()-1;if(startDay<0)startDay=6;
  const daysInMonth=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  const daysInPrev=new Date(d.getFullYear(),d.getMonth(),0).getDate();
  let cells='';
  for(let i=0;i<startDay;i++){
    cells+=`<div class="ccell other"><div class="cdate">${daysInPrev-startDay+i+1}</div></div>`;
  }
  for(let i=1;i<=daysInMonth;i++){
    const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const isTd=i===today.getDate()&&d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();
    const evs=state.kalender.filter(e=>e.datum===ds);
    const evHTML=evs.slice(0,3).map(ev=>{
      const c=ev.fach_farbe||'#6366F1';const op=ev.typ==='geplant'?'BB':'EE';
      return `<div class="cev ${ev.typ||'planned'}" style="background:${c}${op}" 
        draggable="true" data-evid="${ev.id||''}" data-islearn="${ev.is_learn_entry||false}"
        ondragstart="dragStart(event,${ev.id||0},${!!ev.is_learn_entry})">${ev.titel}</div>`;
    }).join('')+(evs.length>3?`<div class="cmore">+${evs.length-3} mehr</div>`:'');
    cells+=`<div class="ccell${isTd?' today':''}" 
      ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event,'${ds}')">
      <div class="cdate">${i}</div>${evHTML}</div>`;
  }
  const rem=42-startDay-daysInMonth;
  for(let i=1;i<=rem;i++) cells+=`<div class="ccell other"><div class="cdate">${i}</div></div>`;
  document.getElementById('cal-body').innerHTML=cells;
}
function renderWoche(){
  const d=state.calDate;
  const dow=d.getDay()===0?6:d.getDay()-1;
  const monday=new Date(d);monday.setDate(d.getDate()-dow);
  const today=new Date();
  let cells='';
  for(let i=0;i<7;i++){
    const dd=new Date(monday);dd.setDate(monday.getDate()+i);
    const ds=dd.toISOString().split('T')[0];
    const isTd=dd.toDateString()===today.toDateString();
    const evs=state.kalender.filter(e=>e.datum===ds);
    const evHTML=evs.map(ev=>{
      const c=ev.fach_farbe||'#6366F1';const op=ev.typ==='geplant'?'BB':'EE';
      return `<div class="cev ${ev.typ||'planned'}" style="background:${c}${op}"
        draggable="true" data-evid="${ev.id||''}"
        ondragstart="dragStart(event,${ev.id||0},${!!ev.is_learn_entry})">${ev.titel}</div>`;
    }).join('');
    cells+=`<div class="ccell${isTd?' today':''}" style="min-height:120px"
      ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event,'${ds}')">
      <div class="cdate">${dd.getDate()}</div>${evHTML}</div>`;
  }
  document.getElementById('cal-body').innerHTML=cells;
}
/* Drag & Drop */
function dragStart(e,id,isLearn){state.dragEv={id,isLearn};e.dataTransfer.effectAllowed='move';}
function dragOver(e){e.preventDefault();e.currentTarget.classList.add('dragover');}
function dragLeave(e){e.currentTarget.classList.remove('dragover');}
async function drop(e,datum){
  e.preventDefault();e.currentTarget.classList.remove('dragover');
  if(!state.dragEv)return;
  const{id,isLearn}=state.dragEv;state.dragEv=null;
  if(isLearn){
    const entry=state.eintraege.find(x=>x.id===id);
    if(entry){entry.datum=datum;await api('PUT','/lerneintraege/'+id,{...entry,datum});}
  }else{
    const ev=state.kalender.find(x=>x.id===id&&!x.is_learn_entry);
    if(ev){ev.datum=datum;await api('PUT','/kalender/'+id,{...ev,datum});}
  }
  state.kalender=await api('GET','/kalender').then(r=>Array.isArray(r)?r:[]);
  renderKalender();toast('Termin verschoben ✓','ok');
}
function renderUpcoming(){
  const el=document.getElementById('upcoming-events');
  const today=new Date().toISOString().split('T')[0];
  const up=state.kalender.filter(e=>e.datum>=today&&!e.is_learn_entry).sort((a,b)=>a.datum.localeCompare(b.datum)).slice(0,5);
  if(!up.length){el.innerHTML=`<div style="color:var(--text2);font-size:.85rem;padding:8px 0">Keine kommenden Termine</div>`;return;}
  el.innerHTML=up.map(e=>`<div class="eitem">
    <div class="edot" style="background:${e.fach_farbe||'#6366F1'}"></div>
    <div class="einf"><div class="etit">${e.titel}</div>
    <div class="emeta">${e.fach_name||'Allgemein'} · ${fmtDate(e.datum)}${e.uhrzeit_start?' · '+e.uhrzeit_start:''}</div></div>
    <button class="btn-ico btn-g" onclick="delEvent(${e.id})">🗑️</button>
  </div>`).join('');
}
function calPrev(){state.calDate=new Date(state.calDate.getFullYear(),state.calDate.getMonth()-1,1);renderKalender();}
function calNext(){state.calDate=new Date(state.calDate.getFullYear(),state.calDate.getMonth()+1,1);renderKalender();}
function calToday(){state.calDate=new Date();renderKalender();}
function setCalView(v){
  state.calView=v;
  document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('vbtn-'+v).classList.add('active');
  renderKalender();
}
function openAddEvent(){
  document.getElementById('event-datum').value=new Date().toISOString().split('T')[0];
  document.getElementById('event-titel').value='';
  openModal('event');
}
async function saveEvent(){
  const d={titel:document.getElementById('event-titel').value.trim(),
    fach_id:document.getElementById('event-fach').value||null,
    datum:document.getElementById('event-datum').value,
    uhrzeit_start:document.getElementById('event-start').value,typ:'geplant'};
  if(!d.titel||!d.datum){toast('Titel und Datum ausfüllen','err');return;}
  await api('POST','/kalender',d);
  state.kalender=await api('GET','/kalender').then(r=>Array.isArray(r)?r:[]);
  closeModal('event');renderKalender();toast('Termin geplant ✓','ok');
}
async function delEvent(kid){
  if(!confirm('Termin löschen?'))return;
  await api('DELETE','/kalender/'+kid);
  state.kalender=state.kalender.filter(e=>e.id!==kid);renderKalender();
}

/* ─── STATISTIKEN ─────────────────────────────────────── */
async function renderStatistiken(){
  const d=await api('GET','/stats/auswertung');

  // Lernzeit pro Fach (Doughnut)
  destroyChart('ch-stat-fach');
  const lzf=(d.lernzeit_fach||[]).filter(f=>f.total>0);
  if(lzf.length){
    state.charts['ch-stat-fach']=new Chart(document.getElementById('ch-stat-fach'),{
      type:'doughnut',
      data:{labels:lzf.map(f=>f.name),datasets:[{data:lzf.map(f=>+(f.total/60).toFixed(1)),backgroundColor:lzf.map(f=>f.farbe),borderWidth:2,borderColor:getCS('--surface'),hoverOffset:10}]},
      options:{responsive:true,cutout:'65%',plugins:{legend:{position:'right',labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11},boxWidth:12,borderRadius:4,padding:12}},tooltip:{bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'}}}}
    });
  }

  // Lernzeit pro Methode (Bar)
  destroyChart('ch-stat-meth');
  const lzm=(d.lernzeit_methode||[]).filter(m=>m.total>0);
  if(lzm.length){
    state.charts['ch-stat-meth']=new Chart(document.getElementById('ch-stat-meth'),{
      type:'bar',
      data:{labels:lzm.map(m=>m.name),datasets:[{data:lzm.map(m=>+(m.total/60).toFixed(1)),backgroundColor:lzm.map(m=>(m.farbe||'#6366F1')+'CC'),borderRadius:8,borderSkipped:false}]},
      options:chOpts('Stunden')
    });
  }

  // Note vs Methode (Horizontal Bar)
  destroyChart('ch-note-meth');
  const nm=(d.note_methode||[]).filter(m=>m.avg_note);
  if(nm.length){
    state.charts['ch-note-meth']=new Chart(document.getElementById('ch-note-meth'),{
      type:'bar',
      data:{labels:nm.map(m=>m.methode),datasets:[{label:'Ø Note',data:nm.map(m=>m.avg_note),backgroundColor:'#3B82F6CC',borderRadius:8,borderSkipped:false}]},
      options:{...chOpts('Note'),indexAxis:'y',scales:{x:{min:1,max:6,...chScale()},y:{...chScale()}}}
    });
  }

  // Lernverlauf 30 Tage (Line)
  destroyChart('ch-verlauf');
  const v=(d.verlauf||[]).reverse();
  if(v.length){
    state.charts['ch-verlauf']=new Chart(document.getElementById('ch-verlauf'),{
      type:'line',
      data:{labels:v.map(x=>fmtDateShort(x.datum)),datasets:[{
        label:'Minuten',data:v.map(x=>x.total),
        borderColor:'#2563EB',backgroundColor:'#2563EB18',
        tension:.4,fill:true,pointRadius:4,pointBackgroundColor:'#2563EB',
        pointBorderColor:getCS('--surface'),pointBorderWidth:2
      }]},
      options:{...chOpts('Minuten'),scales:{x:{...chScale()},y:{...chScale(),min:0}}}
    });
  }

  // Radar: Lernzeit vs Note pro Fach
  destroyChart('ch-radar');
  const rf=state.faecher.map(f=>{
    const notenF=state.noten.filter(n=>n.fach_id===f.id);
    const avg=notenF.length?(notenF.reduce((s,n)=>s+n.note,0)/notenF.length):0;
    const lz=state.eintraege.filter(e=>e.fach_id===f.id&&!e.geplant).reduce((s,e)=>s+e.dauer_minuten,0);
    return {name:f.name,avg,lz};
  }).filter(f=>f.avg||f.lz);
  if(rf.length>=3){
    state.charts['ch-radar']=new Chart(document.getElementById('ch-radar'),{
      type:'radar',
      data:{labels:rf.map(f=>f.name),datasets:[
        {label:'Ø Note (×1000)',data:rf.map(f=>f.avg*1000),backgroundColor:'rgba(37,99,235,.15)',borderColor:'#2563EB',pointBackgroundColor:'#2563EB',borderWidth:2},
        {label:'Lernzeit (Min)',data:rf.map(f=>f.lz),backgroundColor:'rgba(124,58,237,.15)',borderColor:'#7C3AED',pointBackgroundColor:'#7C3AED',borderWidth:2}
      ]},
      options:{responsive:true,plugins:{legend:{labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11}}}},
        scales:{r:{grid:{color:getCS('--border')},angleLines:{color:getCS('--border')},ticks:{display:false},pointLabels:{color:getCS('--text2'),font:{family:'Outfit',weight:'600',size:11}}}}}
    });
  }
}

/* ─── METHODEN ─────────────────────────────────────────── */
function renderMethoden(){
  const el=document.getElementById('methoden-grid');
  el.innerHTML=state.methoden.map(m=>`<div class="mcard fade-anim">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div class="mpill" style="background:${m.farbe||'#6366F1'}">${m.ist_vordefiniert?'⭐ Standard':'✦ Eigene'}</div>
      ${!m.ist_vordefiniert?`<button class="btn-ico btn-g" onclick="delMethode(${m.id})">🗑️</button>`:''}
    </div>
    <div class="mname">${m.name}</div>
    <div class="mdesc">${m.beschreibung||'Keine Beschreibung'}</div>
    ${m.empfehlung?`<div class="mfor">📚 ${m.empfehlung}</div>`:''}
  </div>`).join('');
}
async function saveMethode(){
  const d={name:document.getElementById('m-name').value.trim(),
    beschreibung:document.getElementById('m-desc').value.trim(),
    empfehlung:document.getElementById('m-empf').value.trim(),
    farbe:COLORS[Math.floor(Math.random()*COLORS.length)]};
  if(!d.name){toast('Name eingeben','err');return;}
  await api('POST','/lernmethoden',d);
  state.methoden=await api('GET','/lernmethoden').then(r=>Array.isArray(r)?r:[]);
  closeModal('methode');renderMethoden();fillMethodeDrops();toast('Methode gespeichert ✓','ok');
}
async function delMethode(mid){
  if(!confirm('Methode löschen?'))return;
  await api('DELETE','/lernmethoden/'+mid);
  state.methoden=state.methoden.filter(m=>m.id!==mid);renderMethoden();
}

/* ─── EINSTELLUNGEN ────────────────────────────────────── */
function renderSettings(){
  document.getElementById('settings-uname').textContent=state.user?.username||'–';
  const el=document.getElementById('settings-faecher');
  el.innerHTML=state.faecher.map(f=>`<div class="srow">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:12px;height:12px;border-radius:3px;background:${f.farbe}"></div>
      <div class="slbl">${f.name}</div>
    </div>
    <button class="btn btn-g btn-xs" onclick="delFach(${f.id})">🗑️ Löschen</button>
  </div>`).join('');
  const td=document.getElementById('toggle-dark');
  if(td) td.checked=document.documentElement.getAttribute('data-theme')==='dark';
}

/* ─── FÄCHER ──────────────────────────────────────────── */
function buildColorDots(){
  const el=document.getElementById('fach-cdots');if(!el)return;
  el.innerHTML=COLORS.map(c=>`<div class="cdot${c===state.selColor?' sel':''}" style="background:${c}" onclick="selColor('${c}')"></div>`).join('');
}
function selColor(c){state.selColor=c;buildColorDots();}
async function saveFach(){
  const name=document.getElementById('new-fach-name').value.trim();
  if(!name){toast('Name eingeben','err');return;}
  const r=await api('POST','/faecher',{name,farbe:state.selColor});
  state.faecher.push(r);closeModal('fach');
  document.getElementById('new-fach-name').value='';
  fillFachDrops();renderNoten();renderSettings();toast('Fach hinzugefügt ✓','ok');
}
async function delFach(fid){
  if(!confirm('Fach löschen?'))return;
  await api('DELETE','/faecher/'+fid);
  state.faecher=state.faecher.filter(f=>f.id!==fid);
  fillFachDrops();renderNoten();renderSettings();toast('Fach entfernt','ok');
}

/* ─── DROPDOWNS ───────────────────────────────────────── */
function fillFachDrops(){
  const opts=state.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  ['note-fach','lernen-fach','quick-fach','timer-fach','thema-fach','event-fach'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML=(id==='event-fach'?'<option value="">Kein Fach</option>':'')+opts;
  });
}
function fillMethodeDrops(){
  const opts='<option value="">Keine Methode</option>'+state.methoden.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  const el=document.getElementById('lernen-methode');if(el)el.innerHTML=opts;
}

/* ─── MODAL ───────────────────────────────────────────── */
function openModal(n){document.getElementById('modal-'+n).classList.add('open');}
function closeModal(n){document.getElementById('modal-'+n).classList.remove('open');}
function closeModalOutside(e,id){if(e.target.id===id)closeModal(id.replace('modal-',''));}

/* ─── THEME ───────────────────────────────────────────── */
function toggleTheme(){
  const html=document.documentElement;
  const dark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',dark?'light':'dark');
  document.querySelectorAll('.thbtn').forEach(b=>b.textContent=dark?'🌙':'☀️');
  const td=document.getElementById('toggle-dark');if(td)td.checked=!dark;
  setTimeout(()=>{if(document.getElementById('page-statistiken').classList.contains('active'))renderStatistiken();},60);
}

/* ─── HELPERS ─────────────────────────────────────────── */
function fmtDate(d){if(!d)return'–';const p=d.split('-');return`${p[2]}.${p[1]}.${p[0]}`;}
function fmtDateShort(d){if(!d)return'';const p=d.split('-');return`${p[2]}.${p[1]}`;}
function fmtDur(m){if(!m)return'–';const h=Math.floor(m/60),min=m%60;return h?`${h}h ${min}m`:`${min}m`;}
function emptyHTML(ico,t,s){return`<div class="empty"><div class="empty-ic">${ico}</div><h3>${t}</h3><p>${s}</p></div>`;}
function entryHTML(e,actions=true){
  return`<div class="eitem fade-anim">
    <div class="edot" style="background:${e.fach_farbe||'#6366F1'}"></div>
    <div class="einf">
      <div class="etit">${e.titel}</div>
      <div class="emeta">${e.fach_name} · ${fmtDate(e.datum)}${e.methode_name?' · '+e.methode_name:''}</div>
    </div>
    <div class="edur">${fmtDur(e.dauer_minuten)}</div>
    ${actions?`<div class="eact">
      <button class="btn-ico btn-g" onclick="openEditLernen(${e.id})" style="font-size:.8rem">✏️</button>
      <button class="btn-ico btn-g" onclick="delEintrag(${e.id})" style="font-size:.8rem">🗑️</button>
    </div>`:''}
  </div>`;
}
function showErr(el,msg){el.style.display='block';el.textContent=msg;}
function toast(msg,type=''){
  const t=document.createElement('div');t.className='toast '+(type==='ok'?'ok':type==='err'?'err':type==='info'?'info':'');t.textContent=msg;
  document.getElementById('toast-wrap').appendChild(t);setTimeout(()=>t.remove(),3000);
}
function getCS(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function destroyChart(id){if(state.charts[id]){state.charts[id].destroy();delete state.charts[id];}}
function chScale(){return{ticks:{color:getCS('--text2'),font:{family:'Outfit',weight:'600',size:11}},grid:{color:getCS('--border')}};}
function chOpts(label){return{responsive:true,plugins:{legend:{display:false},tooltip:{bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'}}},scales:{x:chScale(),y:chScale()}};}

// CSS animation helper
document.head.insertAdjacentHTML('beforeend',`<style>
.fade-anim{animation:fadeIn .35s var(--ease) both}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>`);

init();
