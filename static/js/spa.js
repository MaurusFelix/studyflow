/* ═══════════════════════════════════════════════════════
   StudyFlow v4 — spa.js (Single Page App)
   Catppuccin Mocha/Latte | Alle Features aus Requirements
═══════════════════════════════════════════════════════ */

const SF = {
  user: null, faecher: [], noten: [], methoden: [],
  eintraege: [], themen: [], kalender: [], semester: [],
  charts: {}, selColor: '#CBA6F7', selMethodeColor: '#CBA6F7',
  curPage: 'dashboard',
};

const PAGE_TITLES = {
  dashboard:'Übersicht', noten:'Noten', lernen:'Lernen',
  kalender:'Planung', statistiken:'Statistiken',
  methoden:'Lernmethoden', einstellungen:'Einstellungen'
};

/* ── API ──────────────────────────────────────────────── */
async function api(method, path, data) {
  const o = { method, credentials:'include', headers:{'Content-Type':'application/json'} };
  if (data) o.body = JSON.stringify(data);
  try { const r = await fetch('/api'+path, o); return r.json(); } catch { return {}; }
}

/* ── INIT ─────────────────────────────────────────────── */
async function init() {
  applyTheme();
  buildColorDots('fach-cdots', '#CBA6F7');
  buildColorDots('methode-cdots', '#CBA6F7');
  document.getElementById('login-pw').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('reg-pw').addEventListener('keydown', e => { if(e.key==='Enter') doRegister(); });
  document.addEventListener('click', e => {
    const wrap = document.getElementById('note-thema-wrap');
    if (wrap && !wrap.contains(e.target)) closeThemaDropdown();
  });

  const me = await api('GET', '/me');
  if (!me.logged_in) {
    showLanding();
  } else {
    SF.user = me;
    await loadAll();
    setUserUI();
    showApp();
    showPage('dashboard');
  }
}

function showLanding() {
  document.getElementById('landing').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
function showApp() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

function setUserUI() {
  const u = SF.user?.username || '';
  const savedPic = localStorage.getItem('sf-pic');
  const av = document.getElementById('sidebar-uav');
  if (av) { av.innerHTML = savedPic ? `<img src="${savedPic}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">` : u[0]?.toUpperCase() || '?'; }
  const un = document.getElementById('sidebar-uname'); if(un) un.textContent = u;
  const su = document.getElementById('settings-uname'); if(su) su.textContent = u;
  const pi = document.getElementById('profile-initials'); if(pi) pi.textContent = u[0]?.toUpperCase() || '?';
  const pimg = document.getElementById('profile-img');
  if (pimg && savedPic) { pimg.src = savedPic; pimg.style.display = 'block'; if(pi) pi.style.display = 'none'; }
  const td = document.getElementById('toggle-dark');
  if (td) td.checked = localStorage.getItem('sf-dark') !== '0';
}

async function loadAll() {
  const [f,n,m,l,t,k,s] = await Promise.all([
    api('GET','/faecher'), api('GET','/noten'), api('GET','/lernmethoden'),
    api('GET','/lerneintraege'), api('GET','/themen'), api('GET','/kalender'),
    api('GET','/semester')
  ]);
  SF.faecher   = Array.isArray(f)?f:[];
  SF.noten     = Array.isArray(n)?n:[];
  SF.methoden  = Array.isArray(m)?m:[];
  SF.eintraege = Array.isArray(l)?l:[];
  SF.themen    = Array.isArray(t)?t:[];
  SF.kalender  = Array.isArray(k)?k:[];
  SF.semester  = Array.isArray(s)?s:[];
  fillFachDrops(); fillMethodeDrops(); fillSemesterDrops();
  fillSettingsThemaFach();
}

/* ── AUTH ─────────────────────────────────────────────── */
async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pw').value;
  const err = document.getElementById('login-err');
  if (!u||!p) { showErr(err,'Bitte beide Felder ausfüllen'); return; }
  const r = await api('POST', '/login', {username:u, password:p});
  if (r.success) {
    document.getElementById('login-user').value = '';
    document.getElementById('login-pw').value = '';
    if(err) err.style.display='none';
    SF.user = r;
    await loadAll();
    setUserUI();
    closeModal('login');
    showApp();
    showPage('dashboard');
    toast('Willkommen zurück, '+u+'!', 'ok');
  } else { showErr(err, r.message||'Login fehlgeschlagen'); }
}

async function doRegister() {
  const u = document.getElementById('reg-user').value.trim();
  const e = document.getElementById('reg-email').value.trim();
  const p = document.getElementById('reg-pw').value;
  const err = document.getElementById('reg-err');
  if (!u||!p) { showErr(err,'Benutzername und Passwort erforderlich'); return; }
  if (p.length<6) { showErr(err,'Passwort muss mind. 6 Zeichen haben'); return; }
  const r = await api('POST', '/register', {username:u, email:e, password:p});
  if (r.success) {
    ['reg-user','reg-email','reg-pw'].forEach(id=>document.getElementById(id).value='');
    if(err) err.style.display='none';
    SF.user = r;
    await loadAll();
    setUserUI();
    closeModal('register');
    showApp();
    showPage('dashboard');
    toast('Willkommen, '+u+'! Deine Fächer sind bereit.', 'ok');
  } else { showErr(err, r.message||'Registrierung fehlgeschlagen'); }
}

async function doLogout() {
  await api('POST','/logout');
  SF.user=null; SF.faecher=[]; SF.noten=[]; SF.methoden=[];
  SF.eintraege=[]; SF.themen=[]; SF.kalender=[]; SF.semester=[];
  Object.values(SF.charts).forEach(c=>{try{c.destroy();}catch{}});
  SF.charts={};
  showLanding();
}

/* ── NAVIGATION ───────────────────────────────────────── */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.style.display='none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-'+name);
  if (pg) pg.style.display='block';
  const nv = document.getElementById('nv-'+name);
  if (nv) nv.classList.add('active');
  document.getElementById('topbar-title').textContent = PAGE_TITLES[name]||name;
  const ta = document.getElementById('topbar-actions');
  const actionMap = {
    noten: `<button class="btn btn-s btn-sm" onclick="openAddFach()"><svg width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-plus"/></svg> Fach</button><button class="btn btn-p btn-sm" onclick="openAddNote()"><svg width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-plus"/></svg> Note</button>`,
    lernen: `<button class="btn btn-s btn-sm" onclick="openThemenModal()">Themen</button>`,
    kalender: `<button class="btn btn-p btn-sm" onclick="openAddEvent()"><svg width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-plus"/></svg> Termin</button>`,
    methoden: `<button class="btn btn-p btn-sm" onclick="openAddMethode()"><svg width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-plus"/></svg> Eigene Methode</button>`,
  };
  ta.innerHTML = actionMap[name] || '';
  SF.curPage = name;
  if (window.innerWidth<=900) document.getElementById('sidebar').classList.remove('open');
  const renders = {
    dashboard: renderDashboard, noten: renderNoten,
    lernen: () => { renderLernen(); setTodayDates(); fillFachDrops(); fillMethodeDrops(); },
    kalender: renderKalender, statistiken: renderStatistiken,
    methoden: renderMethoden, einstellungen: renderSettingsPage,
  };
  if (renders[name]) renders[name]();
}

/* ── THEME ────────────────────────────────────────────── */
function applyTheme() {
  const dark = localStorage.getItem('sf-dark') !== '0'; // default dark
  document.documentElement.setAttribute('data-theme', dark?'dark':'light');
  ['theme-track','theme-track-land'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.toggle('active', !dark); // active = light
  });
  const td = document.getElementById('toggle-dark'); if(td) td.checked=dark;
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme')==='dark';
  const next = !cur;
  document.documentElement.setAttribute('data-theme', next?'dark':'light');
  localStorage.setItem('sf-dark', next?'1':'0');
  ['theme-track','theme-track-land'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.toggle('active', !next);
  });
  const td = document.getElementById('toggle-dark'); if(td) td.checked=next;
  Object.values(SF.charts).forEach(c=>{try{c.destroy();}catch{}}); SF.charts={};
  const rr={statistiken:renderStatistiken,dashboard:renderDashboard};
  if(rr[SF.curPage]) rr[SF.curPage]();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

/* ── MODAL ────────────────────────────────────────────── */
function openModal(name) {
  const el = document.getElementById('modal-'+name);
  if(el) { el.classList.add('open'); setTimeout(()=>el.querySelector('input,select')?.focus(),80); }
}
function closeModal(name) { document.getElementById('modal-'+name)?.classList.remove('open'); }
function closeModalOutside(e,name) { if(e.target===document.getElementById('modal-'+name)) closeModal(name); }

/* ── TOAST ────────────────────────────────────────────── */
function toast(msg,type='ok') {
  const w=document.getElementById('toast-wrap');
  const t=document.createElement('div'); t.className='toast '+type; t.textContent=msg;
  w.appendChild(t); setTimeout(()=>t.remove(),3200);
}

/* ── HELPERS ──────────────────────────────────────────── */
function showErr(el,msg){if(el){el.style.display='block';el.textContent=msg;}}
function fmtDate(d){if(!d)return'–';const p=d.split('-');return p[2]+'.'+p[1]+'.'+p[0];}
function fmtMin(m){
  if(!m)return'0 Min.';
  if(m<60)return m+' Min.';
  const h=Math.floor(m/60), min=m%60;
  if(min===0)return h+' Std.';
  return h+' Std. '+min+' Min.';
}
function getCS(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function setTodayDates(){
  const t=new Date().toISOString().split('T')[0];
  ['note-datum','lernen-datum','quick-datum','event-datum'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=t;});
}
function destroyChart(id){if(SF.charts[id]){try{SF.charts[id].destroy();}catch{}delete SF.charts[id];}}
function emptyHTML(icon,title,sub){return`<div class="empty"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;}
function iconBtn(iconId,onclick,title='',extraClass=''){
  return`<button class="btn-icon ${extraClass}" onclick="${onclick}" title="${title}">
    <svg><use href="#${iconId}"/></svg></button>`;
}
function chScale(){return{ticks:{color:getCS('--text2'),font:{family:'Outfit',weight:'600',size:11}},grid:{color:getCS('--border')}};}
function chOpts(){return{responsive:true,plugins:{legend:{display:false},tooltip:{bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'}}},scales:{x:chScale(),y:chScale()}};}

/* ── DROPDOWNS ────────────────────────────────────────── */
function fillFachDrops(){
  const opts=SF.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  ['note-fach','lernen-fach','quick-fach','thema-fach','timer-fach'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.innerHTML=opts||'<option value="">— Kein Fach —</option>';
  });
  const ef=document.getElementById('event-fach');
  if(ef)ef.innerHTML='<option value="">Kein Fach</option>'+opts;
}
function fillMethodeDrops(){
  const el=document.getElementById('lernen-methode');
  if(el)el.innerHTML='<option value="">— Methode —</option>'+SF.methoden.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
}
function fillSemesterDrops(){
  const el=document.getElementById('note-sem');
  if(el)el.innerHTML='<option value="">— Semester —</option>'+SF.semester.map(s=>`<option value="${s.name}">${s.name}</option>`).join('');
}
function fillSettingsThemaFach(){
  const sel=document.getElementById('settings-thema-fach');
  if(!sel||!SF.faecher.length)return;
  sel.innerHTML=SF.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  renderSettingsThemen();
}

/* ── COLOR DOTS ───────────────────────────────────────── */
const PRESET_COLORS=['#F38BA8','#FAB387','#F9E2AF','#A6E3A1','#94E2D5','#89DCEB','#89B4FA','#CBA6F7','#F5C2E7','#EBA0AC'];
function buildColorDots(containerId='fach-cdots',currentColor=null){
  const el=document.getElementById(containerId);if(!el)return;
  const active=currentColor||(containerId.includes('methode')?SF.selMethodeColor:SF.selColor);
  el.innerHTML=PRESET_COLORS.map(c=>`<div class="cdot${c===active?' sel':''}" style="background:${c}" onclick="selColorFor('${containerId}','${c}')"></div>`).join('');
}
function selColorFor(containerId,c){
  if(containerId.includes('methode'))SF.selMethodeColor=c;else SF.selColor=c;
  document.querySelectorAll(`#${containerId} .cdot`).forEach(d=>d.classList.toggle('sel',d.style.background===c||d.style.backgroundColor===c));
}

/* ── FÄCHER ───────────────────────────────────────────── */
function openAddFach(){buildColorDots('fach-cdots');document.getElementById('new-fach-name').value='';openModal('fach');}
async function saveFach(){
  const name=document.getElementById('new-fach-name').value.trim();
  if(!name){toast('Bitte Fachname eingeben','err');return;}
  const r=await api('POST','/faecher',{name,farbe:SF.selColor});
  if(r.id){SF.faecher.push(r);fillFachDrops();fillSettingsThemaFach();document.getElementById('new-fach-name').value='';closeModal('fach');toast('Fach "'+name+'" hinzugefügt','ok');if(SF.curPage==='noten')renderNoten();if(SF.curPage==='einstellungen')renderSettingsFaecher();}
}
async function delFach(fid){
  if(!confirm('Fach und alle Daten löschen?'))return;
  await api('DELETE','/faecher/'+fid);
  SF.faecher=SF.faecher.filter(f=>f.id!==fid);
  SF.noten=SF.noten.filter(n=>n.fach_id!==fid);
  SF.eintraege=SF.eintraege.filter(e=>e.fach_id!==fid);
  fillFachDrops();fillSettingsThemaFach();toast('Fach gelöscht','ok');
  if(SF.curPage==='noten')renderNoten();if(SF.curPage==='einstellungen')renderSettingsFaecher();
}
async function renameFach(fid){
  const f=SF.faecher.find(x=>x.id===fid);if(!f)return;
  const name=prompt('Fachname:',f.name);
  if(!name||name===f.name)return;
  const r=await api('PUT','/faecher/'+fid,{name,farbe:f.farbe});
  if(r.success){f.name=name;fillFachDrops();renderSettingsFaecher();toast('Fach umbenannt','ok');}
}

/* ── NOTEN ────────────────────────────────────────────── */
function weightedAvg(noten){
  if(!noten.length)return null;
  const sg=noten.reduce((s,n)=>s+(n.gewichtung||1.0),0);
  const sw=noten.reduce((s,n)=>s+n.note*(n.gewichtung||1.0),0);
  return sg>0?(sw/sg).toFixed(2):null;
}

function renderNoten(){
  const el=document.getElementById('noten-list');if(!el)return;
  if(!SF.faecher.length){el.innerHTML=emptyHTML('📚','Keine Fächer','Gehe zu Einstellungen und füge dein erstes Fach hinzu.');return;}
  el.innerHTML=SF.faecher.map(fach=>{
    const fn=SF.noten.filter(n=>n.fach_id===fach.id);
    const avg=weightedAvg(fn);
    const hasGew=fn.some(n=>(n.gewichtung||1)!==1);
    const ac=!avg?'avg-none':+avg>=5?'avg-good':+avg>=4?'avg-ok':'avg-bad';
    const rows=fn.length?fn.map(n=>{
      const nc=n.note>=5?'nb-good':n.note>=4?'nb-ok':'nb-bad';
      const gew=n.gewichtung||1.0;
      const gewBadge=gew!==1?`<span class="gewichtung-badge">×${gew}</span>`:'';
      const themaChip=n.thema_name?`<span class="chip" style="margin-left:4px"><svg width="10" height="10" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle"><use href="#ic-tag"/></svg> ${n.thema_name}</span>`:'';
      return`<tr>
        <td><div class="nb ${nc}">${n.note}</div></td>
        <td>${n.titel||'–'}${themaChip}</td>
        <td>${gewBadge}</td>
        <td>${fmtDate(n.datum)}</td>
        <td>${n.semester?`<span class="chip">${n.semester}</span>`:'–'}</td>
        <td><div style="display:flex;gap:4px;justify-content:flex-end">
          ${iconBtn('ic-edit',`openEditNote(${n.id})`,'Bearbeiten')}
          ${iconBtn('ic-trash',`delNote(${n.id})`,'Löschen','btn-icon-danger')}
        </div></td>
      </tr>`;}).join(''):`<tr><td colspan="6" style="text-align:center;padding:28px 20px"><div style="color:var(--text3);font-size:.84rem">Noch keine Noten</div><button class="btn btn-p btn-sm" style="margin-top:10px" onclick="openAddNoteForFach(${fach.id})">+ Erste Note</button></td></tr>`;
    return`<div class="fach-card ${fn.length?'open':''}" id="fc-${fach.id}">
      <div class="fach-hd" onclick="toggleFach(${fach.id})">
        <div class="fach-hd-l">
          <div class="fach-bar" style="background:${fach.farbe}"></div>
          <div><div class="fach-name">${fach.name}</div><div class="fach-cnt">${fn.length} Note${fn.length!==1?'n':''}</div></div>
          <div class="avg ${ac}">⌀ ${avg?avg+(hasGew?' (gew.)':''):'–'}</div>
        </div>
        <span class="fach-chev"><svg><use href="#ic-chev-r"/></svg></span>
      </div>
      <div class="fach-body">
        <table class="notes-tbl">
          <thead><tr><th>Note</th><th>Thema / Titel</th><th>Gewichtung</th><th>Datum</th><th>Semester</th><th style="text-align:right">Aktionen</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="fach-foot">
          <button class="btn btn-p btn-sm" onclick="openAddNoteForFach(${fach.id})">+ Note hinzufügen</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function toggleFach(id){document.getElementById('fc-'+id)?.classList.toggle('open');}

function openAddNote(){
  document.getElementById('note-edit-id').value='';
  document.getElementById('modal-note-title').textContent='Note hinzufügen';
  document.getElementById('note-val').value='';
  document.getElementById('note-gewichtung').value='1.0';
  document.getElementById('note-thema-id').value='';
  document.getElementById('note-thema-search').value='';
  document.getElementById('note-datum').value=new Date().toISOString().split('T')[0];
  const errEl=document.getElementById('note-err');if(errEl)errEl.style.display='none';
  openModal('note');
}
function openAddNoteForFach(fid){openAddNote();document.getElementById('note-fach').value=fid;_themaDropFachId=fid;}
function openEditNote(nid){
  const n=SF.noten.find(x=>x.id===nid);if(!n)return;
  document.getElementById('note-edit-id').value=nid;
  document.getElementById('modal-note-title').textContent='Note bearbeiten';
  document.getElementById('note-fach').value=n.fach_id;
  document.getElementById('note-val').value=n.note;
  document.getElementById('note-gewichtung').value=n.gewichtung||1.0;
  document.getElementById('note-sem').value=n.semester||'';
  document.getElementById('note-datum').value=n.datum;
  document.getElementById('note-thema-id').value=n.thema_id||'';
  document.getElementById('note-thema-search').value=n.thema_name||'';
  _themaDropFachId=n.fach_id;
  const errEl=document.getElementById('note-err');if(errEl)errEl.style.display='none';
  openModal('note');
}
async function saveNote(){
  const fid=+document.getElementById('note-fach').value;
  const val=+document.getElementById('note-val').value;
  const gew=parseFloat(document.getElementById('note-gewichtung').value)||1.0;
  const sem=document.getElementById('note-sem').value;
  const datum=document.getElementById('note-datum').value;
  const eid=document.getElementById('note-edit-id').value;
  const thema_id=+document.getElementById('note-thema-id').value||null;
  const errEl=document.getElementById('note-err');if(errEl)errEl.style.display='none';
  if(!fid||!val||!datum){showErr(errEl,'Fach, Note und Datum erforderlich');return;}
  if(val<1||val>6){showErr(errEl,'Note muss zwischen 1 und 6 sein');return;}
  if(gew<=0){showErr(errEl,'Gewichtung muss grösser als 0 sein');return;}
  let r;
  if(eid){r=await api('PUT','/noten/'+eid,{fach_id:fid,note:val,gewichtung:gew,semester:sem,thema_id,datum});if(r.id)SF.noten=SF.noten.map(n=>n.id===+eid?r:n);}
  else{r=await api('POST','/noten',{fach_id:fid,note:val,gewichtung:gew,semester:sem,thema_id,datum});if(r.id)SF.noten.push(r);}
  if(r.id){closeModal('note');toast(eid?'Note aktualisiert':'Note gespeichert','ok');renderNoten();}
  else toast('Fehler beim Speichern','err');
}
async function delNote(nid){
  if(!confirm('Note löschen?'))return;
  await api('DELETE','/noten/'+nid);
  SF.noten=SF.noten.filter(n=>n.id!==nid);
  toast('Note gelöscht','ok');renderNoten();
}

/* ── THEMA SEARCH DROPDOWN ────────────────────────────── */
let _themaDropFachId=null;
function loadThemenNote(){
  const fid=+document.getElementById('note-fach')?.value;
  _themaDropFachId=fid;
  document.getElementById('note-thema-id').value='';
  document.getElementById('note-thema-search').value='';
  renderThemaDropdown('');
}
function renderThemaDropdown(filter){
  const fid=_themaDropFachId||+document.getElementById('note-fach')?.value;
  const dd=document.getElementById('note-thema-dropdown');if(!dd)return;
  const search=filter.toLowerCase().trim();
  let themen=SF.themen.filter(t=>t.fach_id===fid);
  if(search)themen=themen.filter(t=>t.name.toLowerCase().includes(search));
  const selId=+document.getElementById('note-thema-id')?.value;
  let html='';
  if(!themen.length&&!search){
    html=`<div class="sel-option sel-option-empty">Noch keine Themen für dieses Fach</div>`;
  } else {
    html=themen.map(t=>`<div class="sel-option ${selId===t.id?'selected':''}" onclick="selectThema(${t.id},'${t.name.replace(/'/g,"\\'")}')">
      <svg width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><use href="#ic-tag"/></svg>${t.name}</div>`).join('');
  }
  if(search&&!themen.find(t=>t.name.toLowerCase()===search)){
    html+=`<div class="sel-option sel-option-new" onclick="createAndSelectThema('${filter.replace(/'/g,"\\'")}')">
      <svg width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><use href="#ic-plus"/></svg>«${filter}» als neues Thema erstellen</div>`;
  }
  if(!html)html=`<div class="sel-option sel-option-empty">Keine Übereinstimmungen</div>`;
  dd.innerHTML=html;
}
function filterThemaDropdown(){const val=document.getElementById('note-thema-search').value;renderThemaDropdown(val);if(val==='')document.getElementById('note-thema-id').value='';}
function openThemaDropdown(){loadThemenNote();document.getElementById('note-thema-dropdown').classList.add('open');}
function closeThemaDropdown(){document.getElementById('note-thema-dropdown')?.classList.remove('open');}
function selectThema(id,name){document.getElementById('note-thema-id').value=id;document.getElementById('note-thema-search').value=name;closeThemaDropdown();}
async function createAndSelectThema(name){
  const fid=_themaDropFachId||+document.getElementById('note-fach')?.value;
  if(!fid||!name.trim())return;
  const r=await api('POST','/themen',{fach_id:fid,name:name.trim()});
  if(r.id){SF.themen.push(r);selectThema(r.id,r.name);toast('Thema erstellt','ok');}
}
function themaSearchKeydown(e){
  const dd=document.getElementById('note-thema-dropdown');
  const items=dd?.querySelectorAll('.sel-option:not(.sel-option-empty)');
  if(e.key==='Escape'){closeThemaDropdown();return;}
  if(e.key==='Enter'&&items?.length){items[0].click();return;}
}

/* ── LERNEN ───────────────────────────────────────────── */
const timer={running:false,sec:0,iv:null};
function renderLernen(){
  const el=document.getElementById('lernen-list');if(!el)return;
  const ee=SF.eintraege.filter(e=>!e.geplant);
  const cnt=document.getElementById('lernen-count');if(cnt)cnt.textContent=`${ee.length} Eintrag${ee.length!==1?'e':''}`;
  el.innerHTML=ee.length?ee.map(e=>entryHTML(e,true)).join(''):emptyHTML('📚','Noch keine Einträge','Nutze den Timer oder den Schnelleintrag');
}
function entryHTML(e,showActions){
  const fach=SF.faecher.find(f=>f.id===e.fach_id)||{};
  const fname=e.fach_name||fach.name||'Unbekannt';
  const ffarbe=e.fach_farbe||fach.farbe||'#999';
  const meth=SF.methoden.find(m=>m.id===e.methode_id);
  const actions=showActions?`<div class="entry-actions">${iconBtn('ic-edit',`openEditLernen(${e.id})`,'Bearbeiten')}${iconBtn('ic-trash',`delEintrag(${e.id})`,'Löschen','btn-icon-danger')}</div>`:'';
  return`<div class="entry-item"><div class="entry-dot" style="background:${ffarbe}"></div><div class="entry-info"><div class="entry-title">${e.titel}</div><div class="entry-meta">${fname} · ${fmtDate(e.datum)}${meth?' · '+meth.name:''}</div></div><div class="entry-dur">${fmtMin(e.dauer_minuten)}</div>${actions}</div>`;
}
function updateTimerFachLabel(){const sel=document.getElementById('timer-fach');const lbl=document.getElementById('timer-fach-lbl');if(lbl&&sel)lbl.textContent=sel.options[sel.selectedIndex]?.text||'Kein Fach gewählt';}
function toggleTimer(){
  if(timer.running){clearInterval(timer.iv);timer.running=false;document.getElementById('timer-startstop').textContent='▶ Fortsetzen';document.getElementById('timer-state-lbl').textContent='Pausiert';}
  else{timer.running=true;timer.iv=setInterval(()=>{timer.sec++;updateTimerDisplay();},1000);document.getElementById('timer-startstop').textContent='⏸ Pause';document.getElementById('timer-state-lbl').textContent='Läuft';}
}
function updateTimerDisplay(){
  const h=Math.floor(timer.sec/3600),m=Math.floor((timer.sec%3600)/60),s=timer.sec%60;
  document.getElementById('timer-display').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const ring=document.getElementById('ring-fill');if(ring)ring.style.strokeDashoffset=502.65*(1-Math.min(timer.sec/3600,1));
}
function resetTimer(){clearInterval(timer.iv);timer.running=false;timer.sec=0;updateTimerDisplay();document.getElementById('timer-startstop').textContent='▶ Starten';document.getElementById('timer-state-lbl').textContent='Bereit';}
async function saveTimerEntry(){
  if(timer.sec<30){toast('Mindestens 30 Sekunden','err');return;}
  const fid=+document.getElementById('timer-fach').value;if(!fid){toast('Fach auswählen','err');return;}
  const dauer=Math.round(timer.sec/60)||1;
  const fach=SF.faecher.find(f=>f.id===fid);
  const r=await api('POST','/lerneintraege',{fach_id:fid,titel:'Timer-Sitzung '+(fach?.name||''),dauer_minuten:dauer,datum:new Date().toISOString().split('T')[0],geplant:0});
  if(r.id){SF.eintraege.push(r);resetTimer();renderLernen();toast(dauer+' Min. gespeichert!','ok');}
}
function loadThemenQuick(){const fid=+document.getElementById('quick-fach')?.value;const sel=document.getElementById('quick-thema');if(!sel)return;const ts=SF.themen.filter(t=>t.fach_id===fid&&!t.abgeschlossen);sel.innerHTML='<option value="">— Thema —</option>'+ts.map(t=>`<option value="${t.name}">${t.name}</option>`).join('');}
function applyThemaQuick(){const v=document.getElementById('quick-thema')?.value;if(v)document.getElementById('quick-titel').value=v;}
async function quickSave(){
  const fid=+document.getElementById('quick-fach').value;
  const titel=document.getElementById('quick-titel').value.trim();
  const dauer=+document.getElementById('quick-dauer').value;
  const datum=document.getElementById('quick-datum').value;
  if(!fid||!titel||!dauer||!datum){toast('Alle Pflichtfelder ausfüllen','err');return;}
  const r=await api('POST','/lerneintraege',{fach_id:fid,titel,dauer_minuten:dauer,datum,geplant:0});
  if(r.id){SF.eintraege.push(r);document.getElementById('quick-titel').value='';document.getElementById('quick-dauer').value='';renderLernen();toast('Eintrag gespeichert','ok');}
}
function openAddLernen(){
  document.getElementById('lernen-edit-id').value='';
  document.getElementById('lernen-modal-title').textContent='Lerneintrag';
  ['lernen-desc','lernen-dauer','lernen-titel'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('lernen-datum').value=new Date().toISOString().split('T')[0];
  openModal('lernen');
}
function openEditLernen(eid){
  const e=SF.eintraege.find(x=>x.id===eid);if(!e)return;
  document.getElementById('lernen-edit-id').value=eid;
  document.getElementById('lernen-modal-title').textContent='Eintrag bearbeiten';
  document.getElementById('lernen-fach').value=e.fach_id;
  document.getElementById('lernen-methode').value=e.methode_id||'';
  document.getElementById('lernen-titel').value=e.titel;
  document.getElementById('lernen-desc').value=e.beschreibung||'';
  document.getElementById('lernen-dauer').value=e.dauer_minuten;
  document.getElementById('lernen-datum').value=e.datum;
  openModal('lernen');
}
async function saveLerneintrag(){
  const fid=+document.getElementById('lernen-fach').value;
  const mid=+document.getElementById('lernen-methode').value||null;
  const titel=document.getElementById('lernen-titel').value.trim();
  const desc=document.getElementById('lernen-desc').value.trim();
  const dauer=+document.getElementById('lernen-dauer').value;
  const datum=document.getElementById('lernen-datum').value;
  const eid=document.getElementById('lernen-edit-id').value;
  if(!fid||!titel||!dauer||!datum){toast('Fach, Titel, Dauer und Datum erforderlich','err');return;}
  let r;
  if(eid){r=await api('PUT','/lerneintraege/'+eid,{fach_id:fid,methode_id:mid,titel,beschreibung:desc,dauer_minuten:dauer,datum});if(r.id)SF.eintraege=SF.eintraege.map(e=>e.id===+eid?r:e);}
  else{r=await api('POST','/lerneintraege',{fach_id:fid,methode_id:mid,titel,beschreibung:desc,dauer_minuten:dauer,datum});if(r.id)SF.eintraege.push(r);}
  if(r.id){closeModal('lernen');toast(eid?'Eintrag aktualisiert':'Eintrag gespeichert','ok');renderLernen();}
}
async function delEintrag(eid){
  if(!confirm('Eintrag löschen?'))return;
  await api('DELETE','/lerneintraege/'+eid);
  SF.eintraege=SF.eintraege.filter(e=>e.id!==eid);toast('Eintrag gelöscht','ok');renderLernen();
}
function loadThemenLernen(){const fid=+document.getElementById('lernen-fach')?.value;const sel=document.getElementById('lernen-thema-sel');if(!sel)return;const ts=SF.themen.filter(t=>t.fach_id===fid&&!t.abgeschlossen);sel.innerHTML='<option value="">— Thema —</option>'+ts.map(t=>`<option value="${t.name}">${t.name}</option>`).join('');}
function applyThemaLernen(){const v=document.getElementById('lernen-thema-sel')?.value;if(v)document.getElementById('lernen-titel').value=v;}

/* ── THEMEN MODAL ─────────────────────────────────────── */
function openThemenModal(){
  const el=document.getElementById('thema-fach');
  if(el&&SF.faecher.length)el.innerHTML=SF.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  renderThemenList();openModal('themen');
}
function renderThemenList(){
  const fid=+document.getElementById('thema-fach')?.value;
  const el=document.getElementById('themen-list');if(!el)return;
  const ts=SF.themen.filter(t=>t.fach_id===fid);
  if(!ts.length){el.innerHTML='<p style="color:var(--text3);font-size:.82rem;padding:8px 0">Noch keine Themen.</p>';return;}
  el.innerHTML=ts.map(t=>`<div class="thema-row"><span class="${t.abgeschlossen?'thema-done':''} thema-row-name">${t.name}</span>
    ${iconBtn(t.abgeschlossen?'ic-undo':'ic-check',`toggleThema(${t.id})`,t.abgeschlossen?'Wiederherstellen':'Abschliessen')}
    ${iconBtn('ic-trash',`delThema(${t.id})`,'Löschen','btn-icon-danger')}</div>`).join('');
}
async function addThema(){
  const name=document.getElementById('thema-name').value.trim();
  const fid=+document.getElementById('thema-fach').value;
  if(!name||!fid)return;
  const r=await api('POST','/themen',{fach_id:fid,name});
  if(r.id){SF.themen.push(r);document.getElementById('thema-name').value='';renderThemenList();}
}
async function toggleThema(tid){
  const t=SF.themen.find(x=>x.id===tid);if(!t)return;
  const r=await api('PUT','/themen/'+tid,{abgeschlossen:t.abgeschlossen?0:1});
  if(r.id||r.success){SF.themen=SF.themen.map(x=>x.id===tid?{...x,abgeschlossen:t.abgeschlossen?0:1}:x);renderThemenList();}
}
async function delThema(tid){await api('DELETE','/themen/'+tid);SF.themen=SF.themen.filter(t=>t.id!==tid);renderThemenList();}

/* ── METHODEN ─────────────────────────────────────────── */
function renderMethoden(){
  const el=document.getElementById('methoden-grid');if(!el)return;
  if(!SF.methoden.length){el.innerHTML=emptyHTML('⚡','Keine Methoden','Füge deine erste Lernmethode hinzu.');return;}
  el.innerHTML=SF.methoden.map(m=>{
    const isOwn=!m.ist_vordefiniert;
    return`<div class="meth-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div class="meth-badge" style="background:${m.farbe||'#CBA6F7'}">${m.name[0]}</div>
        <div style="display:flex;gap:4px;align-items:center">
          ${isOwn?`<span style="font-size:.65rem;font-weight:700;color:var(--text3);background:var(--bg2);border:1px solid var(--border);padding:2px 7px;border-radius:6px">Eigene</span>`:''}
          ${isOwn?iconBtn('ic-trash',`delMethode(${m.id})`,'Löschen','btn-icon-danger'):''}
        </div>
      </div>
      <div class="meth-name">${m.name}</div>
      <div class="meth-desc">${m.beschreibung||'–'}</div>
      ${m.empfehlung?`<div class="meth-for"><svg width="11" height="11" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-tag"/></svg> ${m.empfehlung}</div>`:''}
    </div>`;
  }).join('');
}
function openAddMethode(){buildColorDots('methode-cdots','#CBA6F7');SF.selMethodeColor='#CBA6F7';['m-name','m-desc','m-empf'].forEach(id=>document.getElementById(id).value='');openModal('methode');}
async function saveMethode(){
  const name=document.getElementById('m-name').value.trim();
  const desc=document.getElementById('m-desc').value.trim();
  const empf=document.getElementById('m-empf').value.trim();
  if(!name){toast('Name erforderlich','err');return;}
  const r=await api('POST','/lernmethoden',{name,beschreibung:desc,empfehlung:empf,farbe:SF.selMethodeColor});
  if(r.id){SF.methoden.push(r);fillMethodeDrops();closeModal('methode');toast('Methode gespeichert','ok');renderMethoden();}
}
async function delMethode(mid){
  if(!confirm('Methode löschen?'))return;
  await api('DELETE','/lernmethoden/'+mid);
  SF.methoden=SF.methoden.filter(m=>m.id!==mid);renderMethoden();toast('Methode gelöscht','ok');
}

/* ── KALENDER ─────────────────────────────────────────── */
const cal={date:new Date(),view:'monat',dragEv:null,selEvId:null,dragging:false};
function renderKalender(){
  const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const el=document.getElementById('cal-title');if(el)el.textContent=months[cal.date.getMonth()]+' '+cal.date.getFullYear();
  if(cal.view==='monat')renderMonat();else renderWoche();
  renderUpcoming();
}
function calPrev(){cal.view==='monat'?cal.date.setMonth(cal.date.getMonth()-1):cal.date.setDate(cal.date.getDate()-7);renderKalender();}
function calNext(){cal.view==='monat'?cal.date.setMonth(cal.date.getMonth()+1):cal.date.setDate(cal.date.getDate()+7);renderKalender();}
function calToday(){cal.date=new Date();renderKalender();}
function setCalView(v){cal.view=v;document.getElementById('vbtn-monat').classList.toggle('active',v==='monat');document.getElementById('vbtn-woche').classList.toggle('active',v==='woche');renderKalender();}
function renderMonat(){
  const body=document.getElementById('cal-body');if(!body)return;
  const y=cal.date.getFullYear(),m=cal.date.getMonth();
  const startDay=(new Date(y,m,1).getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const today=new Date().toISOString().split('T')[0];
  let html='';
  for(let i=0;i<startDay;i++){const d=new Date(y,m,-startDay+i+1);html+=`<div class="cal-cell other"><div class="cal-date">${d.getDate()}</div></div>`;}
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(y,m,d).toISOString().split('T')[0];
    const evs=SF.kalender.filter(e=>e.datum===date&&!e.is_learn_entry);
    const isToday=date===today;
    const evHTML=evs.slice(0,3).map(e=>{const fach=SF.faecher.find(f=>f.id===e.fach_id);const bg=fach?fach.farbe:'#6366F1';return`<div class="cal-ev" style="background:${bg}" draggable="true" ondragstart="calDragStart(event,${e.id})" ondragend="calDragEnd()" onclick="event.stopPropagation();showEventDetail(${e.id})" title="${e.titel}">${e.uhrzeit_start?e.uhrzeit_start.slice(0,5)+' ':''}${e.titel}</div>`;}).join('');
    const more=evs.length>3?`<div class="cal-more">+${evs.length-3} mehr</div>`:'';
    html+=`<div class="cal-cell${isToday?' today':''}" data-date="${date}" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="calDrop(event,'${date}')" onclick="calCellClick(event,'${date}')"><div class="cal-date">${d}</div>${evHTML}${more}</div>`;
  }
  body.innerHTML=html;
}
function renderWoche(){
  const body=document.getElementById('cal-body');if(!body)return;
  const d=new Date(cal.date);d.setDate(d.getDate()-((d.getDay()+6)%7));
  const today=new Date().toISOString().split('T')[0];let html='';
  for(let i=0;i<7;i++){
    const date=d.toISOString().split('T')[0];
    const evs=SF.kalender.filter(e=>e.datum===date&&!e.is_learn_entry);
    const isToday=date===today;
    const evHTML=evs.map(e=>{const fach=SF.faecher.find(f=>f.id===e.fach_id);const bg=fach?fach.farbe:'#6366F1';return`<div class="cal-ev" style="background:${bg}" draggable="true" ondragstart="calDragStart(event,${e.id})" ondragend="calDragEnd()" onclick="event.stopPropagation();showEventDetail(${e.id})">${e.uhrzeit_start?e.uhrzeit_start.slice(0,5)+' ':''}${e.titel}</div>`;}).join('');
    html+=`<div class="cal-cell${isToday?' today':''}" style="min-height:120px" data-date="${date}" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="calDrop(event,'${date}')" onclick="calCellClick(event,'${date}')"><div class="cal-date">${d.getDate()}</div>${evHTML}</div>`;
    d.setDate(d.getDate()+1);
  }
  body.innerHTML=html;
}
function renderUpcoming(){
  const el=document.getElementById('upcoming-events');if(!el)return;
  const today=new Date().toISOString().split('T')[0];
  const upcoming=SF.kalender.filter(e=>e.datum>=today&&!e.is_learn_entry).sort((a,b)=>a.datum.localeCompare(b.datum)).slice(0,5);
  el.innerHTML=upcoming.length?upcoming.map(e=>{const fach=SF.faecher.find(f=>f.id===e.fach_id);const bg=fach?fach.farbe:'#6366F1';return`<div class="entry-item"><div class="entry-dot" style="background:${bg}"></div><div class="entry-info"><div class="entry-title">${e.titel}</div><div class="entry-meta">${fmtDate(e.datum)}${e.uhrzeit_start?' · '+e.uhrzeit_start.slice(0,5):''}${fach?' · '+fach.name:''}</div></div>${iconBtn('ic-trash',`delEvent(${e.id})`,'Löschen','btn-icon-danger')}</div>`;}).join(''):emptyHTML('📅','Keine Termine','Klick auf einen Kalendertag um einen Termin zu planen');
}
function showEventDetail(eid){
  const e=SF.kalender.find(x=>x.id===eid);if(!e)return;
  cal.selEvId=eid;
  const fach=SF.faecher.find(f=>f.id===e.fach_id);
  document.getElementById('ev-detail-title').textContent=e.titel;
  document.getElementById('ev-detail-info').textContent=fmtDate(e.datum)+(e.uhrzeit_start?' · '+e.uhrzeit_start.slice(0,5):'')+(fach?' · '+fach.name:'');
  openModal('event-detail');
}
async function delEventFromDetail(){
  if(!cal.selEvId)return;
  await api('DELETE','/kalender/'+cal.selEvId);
  SF.kalender=SF.kalender.filter(e=>e.id!==cal.selEvId);
  closeModal('event-detail');renderKalender();toast('Termin gelöscht','ok');
}
function openAddEvent(date){
  const ef=document.getElementById('event-fach');
  if(ef)ef.innerHTML='<option value="">Kein Fach</option>'+SF.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  document.getElementById('event-titel').value='';
  document.getElementById('event-start').value='';
  document.getElementById('event-datum').value=date||new Date().toISOString().split('T')[0];
  openModal('event');
}
async function saveEvent(){
  const titel=document.getElementById('event-titel').value.trim();
  const fid=+document.getElementById('event-fach').value||null;
  const datum=document.getElementById('event-datum').value;
  const start=document.getElementById('event-start').value;
  if(!titel||!datum){toast('Titel und Datum erforderlich','err');return;}
  const r=await api('POST','/kalender',{titel,fach_id:fid,datum,uhrzeit_start:start});
  if(r.id){SF.kalender.push(r);closeModal('event');toast('Termin gespeichert','ok');renderKalender();}
}
async function delEvent(eid){
  if(!confirm('Termin löschen?'))return;
  await api('DELETE','/kalender/'+eid);
  SF.kalender=SF.kalender.filter(e=>e.id!==eid);renderKalender();toast('Termin gelöscht','ok');
}
function calCellClick(ev,date){if(cal.dragging)return;openAddEvent(date);}
function calDragStart(ev,eid){cal.dragEv=eid;cal.dragging=true;ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',String(eid));}
function calDragEnd(){setTimeout(()=>{cal.dragging=false;},200);}
async function calDrop(ev,date){
  ev.preventDefault();ev.stopPropagation();
  document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
  const eid=cal.dragEv||+ev.dataTransfer.getData('text/plain');if(!eid){cal.dragging=false;return;}
  const ev_obj=SF.kalender.find(e=>e.id===eid);
  if(ev_obj?.is_learn_entry){toast('Lerneinträge können nicht verschoben werden','err');cal.dragEv=null;return;}
  const r=await api('PUT','/kalender/'+eid,{datum:date});
  if(r.id||r.titel){SF.kalender=SF.kalender.map(e=>e.id===eid?{...e,...r}:e);renderKalender();toast('Termin verschoben','ok');}
  cal.dragEv=null;
}

/* ── DASHBOARD ────────────────────────────────────────── */
async function renderDashboard(){
  const d=await api('GET','/stats/dashboard');
  const lernstd=Math.floor((d.lernzeit_woche||0)/60);
  const lernmin=(d.lernzeit_woche||0)%60;
  const avg=(d.avg_noten||[]).filter(f=>f.avg);
  const gesAvg=avg.length?(avg.reduce((s,f)=>s+f.avg,0)/avg.length).toFixed(2):'–';
  const ln=d.letzte_note;
  const sc=document.getElementById('dash-stats');
  if(sc)sc.innerHTML=`
    <div class="stat-card fade-in"><div class="stat-icon"><svg width="24" height="24"><use href="#ic-clock"/></svg></div><div class="stat-label">Lernzeit diese Woche</div><div class="stat-val">${lernstd}h <span style="font-size:1.15rem">${lernmin}m</span></div><div class="stat-sub">${d.lernzeit_woche||0} Min. total</div></div>
    <div class="stat-card fade-in" style="animation-delay:.05s"><div class="stat-icon"><svg width="24" height="24"><use href="#ic-note"/></svg></div><div class="stat-label">Aktive Fächer</div><div class="stat-val">${SF.faecher.length}</div><div class="stat-sub">Schuljahr ${new Date().getFullYear()}</div></div>
    <div class="stat-card fade-in" style="animation-delay:.1s"><div class="stat-icon"><svg width="24" height="24"><use href="#ic-chart"/></svg></div><div class="stat-label">Letzte Note</div><div class="stat-val">${ln?ln.note:'–'}</div><div class="stat-sub">${ln?ln.fach+' · '+ln.titel:'Noch keine Noten'}</div></div>
    <div class="stat-card fade-in" style="animation-delay:.15s"><div class="stat-icon"><svg width="24" height="24"><use href="#ic-zap"/></svg></div><div class="stat-label">Gesamtdurchschnitt</div><div class="stat-val">${gesAvg}</div><div class="stat-sub">Über alle Fächer</div></div>`;
  const lzf=d.lernzeit_pro_fach||[];
  destroyChart('ch-dash-fach');
  if(document.getElementById('ch-dash-fach'))SF.charts['ch-dash-fach']=new Chart(document.getElementById('ch-dash-fach'),{type:'bar',data:{labels:lzf.length?lzf.map(f=>f.name):SF.faecher.map(f=>f.name),datasets:[{data:lzf.length?lzf.map(f=>+(f.total/60).toFixed(1)):SF.faecher.map(()=>0),backgroundColor:lzf.length?lzf.map(f=>f.farbe+'CC'):SF.faecher.map(f=>f.farbe+'CC'),borderRadius:8,borderSkipped:false}]},options:chOpts()});
  const nd=(d.avg_noten||[]).filter(f=>f.avg);
  destroyChart('ch-dash-noten');
  if(document.getElementById('ch-dash-noten'))SF.charts['ch-dash-noten']=new Chart(document.getElementById('ch-dash-noten'),{type:'bar',data:{labels:nd.length?nd.map(f=>f.name):SF.faecher.map(f=>f.name),datasets:[{data:nd.length?nd.map(f=>f.avg):SF.faecher.map(()=>0),backgroundColor:nd.length?nd.map(f=>f.farbe+'CC'):SF.faecher.map(f=>f.farbe+'CC'),borderRadius:8,borderSkipped:false}]},options:{...chOpts(),scales:{x:chScale(),y:{...chScale(),min:1,max:6}}}});
  const ee=d.letzte_eintraege||[];
  const dei=document.getElementById('dash-eintraege');
  if(dei)dei.innerHTML=ee.length?ee.map(e=>entryHTML(e,false)).join(''):emptyHTML('📚','Noch keine Lerneinträge','Starte deine erste Lerneinheit unter "Lernen"');
}

/* ── STATISTIKEN ──────────────────────────────────────── */
async function renderStatistiken(){
  const d=await api('GET','/stats/auswertung');

  // Radar
  destroyChart('ch-radar');
  const elR=document.getElementById('ch-radar');
  if(elR){
    const rdata=SF.faecher.filter(f=>SF.eintraege.some(e=>e.fach_id===f.id)||SF.noten.some(n=>n.fach_id===f.id));
    if(rdata.length>=3){
      const maxLz=Math.max(1,...rdata.map(f=>SF.eintraege.filter(e=>e.fach_id===f.id).reduce((s,e)=>s+e.dauer_minuten,0)));
      SF.charts['ch-radar']=new Chart(elR,{type:'radar',data:{labels:rdata.map(f=>f.name),datasets:[
        {label:'Lernzeit (norm.)',data:rdata.map(f=>{const lz=SF.eintraege.filter(e=>e.fach_id===f.id).reduce((s,e)=>s+e.dauer_minuten,0);return+(lz/maxLz*6).toFixed(1);}),borderColor:getCS('--accent'),backgroundColor:getCS('--acc-soft'),borderWidth:2.5,pointBackgroundColor:getCS('--accent')},
        {label:'Notendurchschnitt',data:rdata.map(f=>{const ns=SF.noten.filter(n=>n.fach_id===f.id);if(!ns.length)return 0;const sg=ns.reduce((s,n)=>s+(n.gewichtung||1),0),sw=ns.reduce((s,n)=>s+n.note*(n.gewichtung||1),0);return sg>0?+(sw/sg).toFixed(2):0;}),borderColor:getCS('--green'),backgroundColor:'rgba(166,227,161,.18)',borderWidth:2.5,pointBackgroundColor:getCS('--green')}
      ]},options:{responsive:true,plugins:{legend:{labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11}}},tooltip:{bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'}}},scales:{r:{grid:{color:getCS('--border')},angleLines:{color:getCS('--border')},ticks:{display:false},pointLabels:{color:getCS('--text2'),font:{family:'Outfit',weight:'600',size:12}},min:0,max:6}}}});
    } else {
      SF.charts['ch-radar']=new Chart(elR,{type:'radar',data:{labels:SF.faecher.length?SF.faecher.map(f=>f.name):['Fach 1','Fach 2','Fach 3'],datasets:[{label:'Keine Daten',data:SF.faecher.length?SF.faecher.map(()=>0):[0,0,0],borderColor:getCS('--border2'),backgroundColor:'transparent',borderWidth:1}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{r:{grid:{color:getCS('--border')},angleLines:{color:getCS('--border')},ticks:{display:false},pointLabels:{color:getCS('--text3'),font:{family:'Outfit',size:11}},min:0,max:6}}}});
    }
  }

  // Lernzeit pro Fach (Doughnut)
  const lzf=d.lernzeit_pro_fach||[];
  destroyChart('ch-stat-fach');
  const elF=document.getElementById('ch-stat-fach');
  if(elF){
    if(lzf.length)SF.charts['ch-stat-fach']=new Chart(elF,{type:'doughnut',data:{labels:lzf.map(f=>f.name),datasets:[{data:lzf.map(f=>+(f.total/60).toFixed(2)),backgroundColor:lzf.map(f=>f.farbe+'CC'),borderWidth:0}]},options:{responsive:true,cutout:'65%',plugins:{legend:{position:'right',labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11},boxWidth:12,borderRadius:4,padding:12}},tooltip:{callbacks:{label:ctx=>' '+fmtMin(lzf[ctx.dataIndex].total)}}}}});
    else SF.charts['ch-stat-fach']=new Chart(elF,{type:'doughnut',data:{labels:['Keine Daten'],datasets:[{data:[1],backgroundColor:[getCS('--border2')],borderWidth:0}]},options:{responsive:true,cutout:'65%',plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  }

  // Lernzeit pro Methode
  const mzm=d.lernzeit_pro_methode||[];
  destroyChart('ch-stat-meth');
  const elM=document.getElementById('ch-stat-meth');
  if(elM){
    if(mzm.length)SF.charts['ch-stat-meth']=new Chart(elM,{type:'bar',data:{labels:mzm.map(m=>m.name),datasets:[{data:mzm.map(m=>+(m.total/60).toFixed(2)),backgroundColor:mzm.map(m=>(m.farbe||'#CBA6F7')+'CC'),borderRadius:8,borderSkipped:false}]},options:{...chOpts(),plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtMin(mzm[ctx.dataIndex].total)}}}}});
    else SF.charts['ch-stat-meth']=new Chart(elM,{type:'bar',data:{labels:['Keine Daten'],datasets:[{data:[0],backgroundColor:getCS('--border2'),borderRadius:8}]},options:{...chOpts(),plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  }

  // Noten pro Methode
  const nm=d.noten_pro_methode||[];
  destroyChart('ch-note-meth');
  const elNM=document.getElementById('ch-note-meth');
  if(elNM){
    if(nm.length)SF.charts['ch-note-meth']=new Chart(elNM,{type:'bar',data:{labels:nm.map(m=>m.name),datasets:[{data:nm.map(m=>+m.avg),backgroundColor:nm.map(m=>(m.farbe||'#CBA6F7')+'CC'),borderRadius:8,borderSkipped:false}]},options:{...chOpts(),scales:{x:chScale(),y:{...chScale(),min:0,max:6}}}});
    else SF.charts['ch-note-meth']=new Chart(elNM,{type:'bar',data:{labels:['Keine Daten'],datasets:[{data:[0],backgroundColor:getCS('--border2'),borderRadius:8}]},options:{...chOpts(),plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  }

  // Verlauf 30 Tage
  const vl=d.verlauf_30||[];
  destroyChart('ch-verlauf');
  const elV=document.getElementById('ch-verlauf');
  if(elV){
    const today=new Date();
    const labels=Array.from({length:30},(_,i)=>{const dd=new Date(today);dd.setDate(dd.getDate()-29+i);return dd.toISOString().split('T')[0].slice(5);});
    const dataMap=Object.fromEntries(vl.map(v=>[v.datum.slice(5),v.minuten]));
    SF.charts['ch-verlauf']=new Chart(elV,{type:'line',data:{labels,datasets:[{data:labels.map(l=>dataMap[l]||0),borderColor:getCS('--accent'),backgroundColor:getCS('--acc-soft'),fill:true,tension:0.4,pointRadius:3,borderWidth:2}]},options:{...chOpts(),plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtMin(ctx.parsed.y)}}}}});
  }

  // Themen-Statistik
  const ts=d.thema_stats||[];
  destroyChart('ch-themen');
  const elT=document.getElementById('ch-themen');
  if(elT){
    if(ts.length)SF.charts['ch-themen']=new Chart(elT,{type:'bar',data:{labels:ts.map(t=>t.thema),datasets:[{label:'Lernzeit (Std.)',data:ts.map(t=>+(t.lernzeit/60).toFixed(2)),backgroundColor:getCS('--accent')+'BB',borderRadius:6,yAxisID:'y'},{label:'Ø Note',data:ts.map(t=>t.avg_note||0),backgroundColor:getCS('--green')+'BB',borderRadius:6,yAxisID:'y2'}]},options:{responsive:true,plugins:{legend:{labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11}}},tooltip:{callbacks:{label:ctx=>ctx.dataset.label==='Lernzeit (Std.)'?' '+fmtMin(ts[ctx.dataIndex].lernzeit):' Ø '+(ctx.parsed.y||0).toFixed(2)}}},scales:{x:chScale(),y:{...chScale(),position:'left',title:{display:true,text:'Stunden',color:getCS('--text3'),font:{family:'Outfit'}}},y2:{...chScale(),position:'right',min:0,max:6,grid:{drawOnChartArea:false},title:{display:true,text:'Note',color:getCS('--text3'),font:{family:'Outfit'}}}}}});
    else SF.charts['ch-themen']=new Chart(elT,{type:'bar',data:{labels:['Keine Daten'],datasets:[{data:[0],backgroundColor:getCS('--border2'),borderRadius:8}]},options:{...chOpts(),plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  }
}

/* ── EINSTELLUNGEN ────────────────────────────────────── */
function renderSettingsPage(){setUserUI();renderSettingsFaecher();fillSettingsThemaFach();renderSemesterSettings();}

function renderSettingsFaecher(){
  const el=document.getElementById('settings-faecher');if(!el)return;
  if(!SF.faecher.length){el.innerHTML='<p style="color:var(--text3);font-size:.82rem;padding:8px 0">Noch keine Fächer.</p>';return;}
  el.innerHTML=SF.faecher.map(f=>`<div class="settings-row">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:14px;height:14px;border-radius:4px;background:${f.farbe};flex-shrink:0"></div>
      <div><div class="settings-lbl">${f.name}</div><div class="settings-sub">${SF.noten.filter(n=>n.fach_id===f.id).length} Noten · ${SF.eintraege.filter(e=>e.fach_id===f.id).length} Einträge</div></div>
    </div>
    <div class="settings-row-actions">
      ${iconBtn('ic-edit',`renameFach(${f.id})`,'Umbenennen')}
      ${iconBtn('ic-trash',`delFach(${f.id})`,'Löschen','btn-icon-danger')}
    </div></div>`).join('');
}

function renderSettingsThemen(){
  const el=document.getElementById('settings-themen');if(!el)return;
  const fid=+document.getElementById('settings-thema-fach')?.value;
  if(!fid){el.innerHTML='<p style="color:var(--text3);font-size:.82rem">Fach oben auswählen</p>';return;}
  const ts=SF.themen.filter(t=>t.fach_id===fid);
  if(!ts.length){el.innerHTML='<p style="color:var(--text3);font-size:.82rem">Noch keine Themen für dieses Fach.</p>';return;}
  el.innerHTML=ts.map(t=>`<div class="thema-row" id="thema-row-${t.id}">
    <span class="${t.abgeschlossen?'thema-done':''} thema-row-name" id="thema-name-${t.id}">${t.name}</span>
    <div style="display:flex;gap:4px;flex-shrink:0">
      ${iconBtn(t.abgeschlossen?'ic-undo':'ic-check',`settingsToggleThema(${t.id})`,t.abgeschlossen?'Wiederherstellen':'Abschliessen')}
      ${iconBtn('ic-edit',`startRenameThema(${t.id})`,'Umbenennen')}
      ${iconBtn('ic-trash',`settingsDelThema(${t.id})`,'Löschen','btn-icon-danger')}
    </div></div>`).join('');
}
function startRenameThema(tid){
  const nameEl=document.getElementById('thema-name-'+tid);if(!nameEl)return;
  const curName=nameEl.textContent.trim();
  const input=document.createElement('input');input.className='thema-edit-input';input.value=curName;
  nameEl.replaceWith(input);input.focus();input.select();
  input.addEventListener('keydown',async e=>{if(e.key==='Enter')await commitRenameThema(tid,input.value.trim());else if(e.key==='Escape')renderSettingsThemen();});
  input.addEventListener('blur',async()=>{if(!document.getElementById('thema-name-'+tid))await commitRenameThema(tid,input.value.trim());});
}
async function commitRenameThema(tid,newName){
  if(!newName){renderSettingsThemen();return;}
  const t=SF.themen.find(x=>x.id===tid);
  if(!t||newName===t.name){renderSettingsThemen();return;}
  const r=await api('PUT','/themen/'+tid,{name:newName});
  if(r.id||r.success){SF.themen=SF.themen.map(x=>x.id===tid?{...x,name:newName}:x);toast('Thema umbenannt','ok');}
  renderSettingsThemen();
}
async function settingsToggleThema(tid){
  const t=SF.themen.find(x=>x.id===tid);if(!t)return;
  const newVal=t.abgeschlossen?0:1;
  await api('PUT','/themen/'+tid,{abgeschlossen:newVal});
  SF.themen=SF.themen.map(x=>x.id===tid?{...x,abgeschlossen:newVal}:x);
  renderSettingsThemen();
}
async function settingsDelThema(tid){
  await api('DELETE','/themen/'+tid);
  SF.themen=SF.themen.filter(t=>t.id!==tid);renderSettingsThemen();toast('Thema gelöscht','ok');
}
async function settingsAddThema(){
  const name=document.getElementById('settings-thema-new').value.trim();
  const fid=+document.getElementById('settings-thema-fach')?.value;
  if(!name||!fid){toast('Thema und Fach erforderlich','err');return;}
  const r=await api('POST','/themen',{fach_id:fid,name});
  if(r.id){SF.themen.push(r);document.getElementById('settings-thema-new').value='';renderSettingsThemen();toast('Thema hinzugefügt','ok');}
}

/* ── SEMESTER SETTINGS ────────────────────────────────── */
function renderSemesterSettings(){
  const el=document.getElementById('settings-semester');if(!el)return;
  if(!SF.semester.length){el.innerHTML='<p style="color:var(--text3);font-size:.82rem;padding:8px 0">Noch keine Semester.</p>';return;}
  el.innerHTML=`<div class="semester-tags">`+SF.semester.map(s=>`
    <span class="semester-tag">${s.name}
      <button class="semester-tag-del" onclick="delSemester(${s.id})" title="Löschen">
        <svg><use href="#ic-x"/></svg>
      </button>
    </span>`).join('')+`</div>`;
}
async function addSemester(name){
  if(!name?.trim())return;
  const r=await api('POST','/semester',{name:name.trim()});
  if(r.id){SF.semester.push(r);fillSemesterDrops();renderSemesterSettings();toast('Semester hinzugefügt','ok');}
}
async function delSemester(sid){
  await api('DELETE','/semester/'+sid);
  SF.semester=SF.semester.filter(s=>s.id!==sid);fillSemesterDrops();renderSemesterSettings();toast('Semester gelöscht','ok');
}

/* ── PROFIL BILD ──────────────────────────────────────── */
function uploadProfilePic(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const data=ev.target.result;localStorage.setItem('sf-pic',data);
    const pimg=document.getElementById('profile-img');const pi=document.getElementById('profile-initials');
    if(pimg){pimg.src=data;pimg.style.display='block';}if(pi)pi.style.display='none';
    const sav=document.getElementById('sidebar-uav');
    if(sav)sav.innerHTML=`<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`;
    toast('Profilbild gespeichert','ok');
  };reader.readAsDataURL(file);
}
function removeProfilePic(){
  localStorage.removeItem('sf-pic');
  const pimg=document.getElementById('profile-img');const pi=document.getElementById('profile-initials');
  if(pimg)pimg.style.display='none';if(pi)pi.style.display='block';
  const sav=document.getElementById('sidebar-uav');if(sav&&SF.user)sav.textContent=SF.user.username[0].toUpperCase();
  toast('Profilbild entfernt','ok');
}

window.addEventListener('DOMContentLoaded', init);
