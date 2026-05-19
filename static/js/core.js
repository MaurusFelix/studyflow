/* ═══════════════════════════════════════════════════════
   StudyFlow v4 — core.js
═══════════════════════════════════════════════════════ */

const SF = {
  user: null,
  faecher: [], noten: [], methoden: [],
  eintraege: [], themen: [], kalender: [],
  semester: [],
  charts: {}, selColor: '#CBA6F7', selMethodeColor: '#CBA6F7',
};

/* ── API ──────────────────────────────────────────────── */
async function api(method, path, data) {
  const o = { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } };
  if (data) o.body = JSON.stringify(data);
  try { const r = await fetch('/api' + path, o); return r.json(); } catch { return {}; }
}

/* ── INIT ─────────────────────────────────────────────── */
async function init() {
  const isAppPage = document.body.classList.contains('app-page');
  if (!isAppPage) return;
  const me = await api('GET', '/me');
  if (!me.logged_in) { window.location.href = '/'; return; }
  SF.user = me;
  const av = document.getElementById('sidebar-uav');
  const un = document.getElementById('sidebar-uname');
  const savedPic = localStorage.getItem('sf-pic');
  if (av) {
    if (savedPic) av.innerHTML = `<img src="${savedPic}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`;
    else av.textContent = me.username[0].toUpperCase();
  }
  if (un) un.textContent = me.username;
  await loadAll();
  if (typeof initPageScript === 'function') initPageScript();
}

async function loadAll() {
  const [f, n, m, l, t, k, s] = await Promise.all([
    api('GET', '/faecher'), api('GET', '/noten'), api('GET', '/lernmethoden'),
    api('GET', '/lerneintraege'), api('GET', '/themen'), api('GET', '/kalender'),
    api('GET', '/semester')
  ]);
  SF.faecher   = Array.isArray(f) ? f : [];
  SF.noten     = Array.isArray(n) ? n : [];
  SF.methoden  = Array.isArray(m) ? m : [];
  SF.eintraege = Array.isArray(l) ? l : [];
  SF.themen    = Array.isArray(t) ? t : [];
  SF.kalender  = Array.isArray(k) ? k : [];
  SF.semester  = Array.isArray(s) ? s : [];
  fillFachDrops();
  fillMethodeDrops();
  fillSemesterDrops();
}

/* ── AUTH ─────────────────────────────────────────────── */
async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pw').value;
  const err = document.getElementById('login-err');
  if (!u || !p) { showErr(err, 'Bitte beide Felder ausfüllen'); return; }
  const r = await api('POST', '/login', { username: u, password: p });
  if (r.success) {
    document.getElementById('login-user').value = '';
    document.getElementById('login-pw').value = '';
    window.location.href = '/dashboard';
  } else {
    showErr(err, r.message || 'Login fehlgeschlagen');
  }
}

async function doRegister() {
  const u = document.getElementById('reg-user').value.trim();
  const e = document.getElementById('reg-email').value.trim();
  const p = document.getElementById('reg-pw').value;
  const err = document.getElementById('reg-err');
  if (!u || !p) { showErr(err, 'Benutzername und Passwort erforderlich'); return; }
  if (p.length < 6) { showErr(err, 'Passwort muss mind. 6 Zeichen haben'); return; }
  const r = await api('POST', '/register', { username: u, email: e, password: p });
  if (r.success) {
    document.getElementById('reg-user').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-pw').value = '';
    window.location.href = '/dashboard';
  } else {
    showErr(err, r.message || 'Registrierung fehlgeschlagen');
  }
}

async function doLogout() {
  await api('POST', '/logout');
  window.location.href = '/';
}

/* ── THEME ────────────────────────────────────────────── */
function applyTheme() {
  const dark = localStorage.getItem('sf-dark') !== '0'; // default dark
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  ['theme-track','theme-track-land'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', !dark); // active = light mode
  });
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = !cur;
  document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  localStorage.setItem('sf-dark', next ? '1' : '0');
  ['theme-track','theme-track-land'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', !next);
  });
  const td = document.getElementById('toggle-dark');
  if (td) td.checked = next;
  Object.values(SF.charts).forEach(c => { try { c.destroy(); } catch {} });
  SF.charts = {};
  if (typeof initPageScript === 'function') initPageScript();
}

/* ── SIDEBAR ──────────────────────────────────────────── */
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

/* ── MODAL ────────────────────────────────────────────── */
function openModal(name) {
  const el = document.getElementById('modal-' + name);
  if (el) { el.classList.add('open'); setTimeout(() => el.querySelector('input,select')?.focus(), 80); }
}
function closeModal(name) {
  const el = document.getElementById('modal-' + name);
  if (el) el.classList.remove('open');
}
function closeModalOutside(e, name) {
  if (e.target === document.getElementById('modal-' + name)) closeModal(name);
}

/* ── TOAST ────────────────────────────────────────────── */
function toast(msg, type = 'ok') {
  const w = document.getElementById('toast-wrap');
  if (!w) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ── HELPERS ──────────────────────────────────────────── */
function showErr(el, msg) { if (el) { el.style.display = 'block'; el.textContent = msg; } }
function fmtDate(d) {
  if (!d) return '–';
  const p = d.split('-');
  return p[2] + '.' + p[1] + '.' + p[0];
}
function fmtMin(m) {
  if (!m) return '0 Min.';
  if (m < 60) return m + ' Min.';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (min === 0) return h + ' Std.';
  return h + ' Std. ' + min + ' Min.';
}
function getCS(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function setTodayDates() {
  const t = new Date().toISOString().split('T')[0];
  ['note-datum','lernen-datum','quick-datum','event-datum'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = t;
  });
}
function destroyChart(id) {
  if (SF.charts[id]) { try { SF.charts[id].destroy(); } catch {} delete SF.charts[id]; }
}
function emptyHTML(icon, title, sub) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}
function iconBtn(iconId, onclick, title='', extraClass='') {
  return `<button class="btn-icon ${extraClass}" onclick="${onclick}" title="${title}">
    <svg><use href="#${iconId}"/></svg>
  </button>`;
}
function entryHTML(e, showActions) {
  const fach = SF.faecher.find(f => f.id === e.fach_id) || {};
  const fname = e.fach_name || fach.name || 'Unbekannt';
  const ffarbe = e.fach_farbe || fach.farbe || '#999';
  const meth = SF.methoden.find(m => m.id === e.methode_id);
  const actions = showActions ? `
    <div class="entry-actions">
      ${iconBtn('ic-edit', `openEditLernen(${e.id})`, 'Bearbeiten')}
      ${iconBtn('ic-trash', `delEintrag(${e.id})`, 'Löschen', 'btn-icon-danger')}
    </div>` : '';
  return `<div class="entry-item">
    <div class="entry-dot" style="background:${ffarbe}"></div>
    <div class="entry-info">
      <div class="entry-title">${e.titel}</div>
      <div class="entry-meta">${fname} · ${fmtDate(e.datum)}${meth?' · '+meth.name:''}</div>
    </div>
    <div class="entry-dur">${fmtMin(e.dauer_minuten)}</div>
    ${actions}
  </div>`;
}

/* ── CHART HELPERS ────────────────────────────────────── */
function chScale() {
  return { ticks: { color: getCS('--text2'), font: { family: 'Outfit', weight: '600', size: 11 } }, grid: { color: getCS('--border') } };
}
function chOpts(label) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { bodyFont: { family: 'Outfit' }, titleFont: { family: 'Outfit', weight: '700' } }
    },
    scales: { x: chScale(), y: chScale() }
  };
}

/* ── DROPDOWNS ────────────────────────────────────────── */
function fillFachDrops() {
  const opts = SF.faecher.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  const optsBlank = '<option value="">Kein Fach</option>' + opts;
  ['note-fach','lernen-fach','quick-fach','thema-fach','settings-thema-fach'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts || '<option value="">— Kein Fach —</option>';
  });
  const ef = document.getElementById('event-fach');
  if (ef) ef.innerHTML = optsBlank;
  const tf = document.getElementById('timer-fach');
  if (tf) tf.innerHTML = opts;
  updateTimerFachLabel?.();
}
function fillMethodeDrops() {
  const opts = SF.methoden.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  const el = document.getElementById('lernen-methode');
  if (el) el.innerHTML = '<option value="">— Methode —</option>' + opts;
}
function fillSemesterDrops() {
  const opts = SF.semester.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  const el = document.getElementById('note-sem');
  if (el) el.innerHTML = '<option value="">— Semester —</option>' + opts;
  if (typeof renderSettings === 'function') renderSemesterSettings?.();
}

/* ── THEMA SEARCH DROPDOWN (Note-Modal) ───────────────── */
let _themaDropFachId = null;

function loadThemenNote() {
  const fid = +document.getElementById('note-fach')?.value;
  _themaDropFachId = fid;
  document.getElementById('note-thema-id').value = '';
  document.getElementById('note-thema-search').value = '';
  renderThemaDropdown('');
}

function renderThemaDropdown(filter) {
  const fid = _themaDropFachId || +document.getElementById('note-fach')?.value;
  const dd = document.getElementById('note-thema-dropdown');
  if (!dd) return;
  const search = filter.toLowerCase().trim();
  let themen = SF.themen.filter(t => t.fach_id === fid);
  if (search) themen = themen.filter(t => t.name.toLowerCase().includes(search));

  let html = '';
  if (themen.length === 0 && !search) {
    html = `<div class="sel-option sel-option-empty">Noch keine Themen für dieses Fach</div>`;
  } else {
    html = themen.map(t => {
      const selId = document.getElementById('note-thema-id')?.value;
      const isSel = +selId === t.id;
      return `<div class="sel-option ${isSel?'selected':''}" onclick="selectThema(${t.id},'${t.name.replace(/'/g,'\\'')}')">
        <svg width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><use href="#ic-tag"/></svg>
        ${t.name}
      </div>`;
    }).join('');
  }
  // "Neu erstellen"-Option
  if (search && !themen.find(t => t.name.toLowerCase() === search)) {
    html += `<div class="sel-option sel-option-new" onclick="createAndSelectThema('${filter.replace(/'/g,'\\'')}')">
      <svg width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><use href="#ic-plus"/></svg>
      «${filter}» als neues Thema erstellen
    </div>`;
  }
  if (!html) html = `<div class="sel-option sel-option-empty">Keine Übereinstimmungen</div>`;
  dd.innerHTML = html;
}

function filterThemaDropdown() {
  const val = document.getElementById('note-thema-search').value;
  renderThemaDropdown(val);
  // Clear selection if text changed
  if (val === '') document.getElementById('note-thema-id').value = '';
}

function openThemaDropdown() {
  loadThemenNote();
  document.getElementById('note-thema-dropdown').classList.add('open');
}

function closeThemaDropdown() {
  document.getElementById('note-thema-dropdown')?.classList.remove('open');
}

function selectThema(id, name) {
  document.getElementById('note-thema-id').value = id;
  document.getElementById('note-thema-search').value = name;
  closeThemaDropdown();
}

async function createAndSelectThema(name) {
  const fid = _themaDropFachId || +document.getElementById('note-fach')?.value;
  if (!fid || !name.trim()) return;
  const r = await api('POST', '/themen', { fach_id: fid, name: name.trim() });
  if (r.id) {
    SF.themen.push(r);
    selectThema(r.id, r.name);
    toast('Thema erstellt', 'ok');
  }
}

function themaSearchKeydown(e) {
  const dd = document.getElementById('note-thema-dropdown');
  const items = dd?.querySelectorAll('.sel-option:not(.sel-option-empty)');
  if (e.key === 'Escape') { closeThemaDropdown(); return; }
  if (e.key === 'Enter' && items?.length) { items[0].click(); return; }
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  const wrap = document.getElementById('note-thema-wrap');
  if (wrap && !wrap.contains(e.target)) closeThemaDropdown();
});

/* ── FACH MODAL ───────────────────────────────────────── */
const PRESET_COLORS = ['#F38BA8','#FAB387','#F9E2AF','#A6E3A1','#94E2D5','#89DCEB','#89B4FA','#CBA6F7','#F5C2E7','#EBA0AC'];
function buildColorDots(containerId = 'fach-cdots', currentColor = null) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const active = currentColor || SF.selColor;
  el.innerHTML = PRESET_COLORS.map(c =>
    `<div class="cdot${c===active?' sel':''}" style="background:${c}" onclick="selColorFor('${containerId}','${c}')"></div>`
  ).join('');
}
function selColorFor(containerId, c) {
  if (containerId === 'methode-cdots') SF.selMethodeColor = c;
  else SF.selColor = c;
  document.querySelectorAll(`#${containerId} .cdot`).forEach(d =>
    d.classList.toggle('sel', d.style.background === c || d.style.backgroundColor === c)
  );
}
// Legacy
function buildColorDots_legacy() { buildColorDots('fach-cdots'); }
function selColor(c) { selColorFor('fach-cdots', c); }

function openAddFach() { buildColorDots('fach-cdots'); openModal('fach'); }
async function saveFach() {
  const name = document.getElementById('new-fach-name').value.trim();
  if (!name) { toast('Bitte Fachname eingeben', 'err'); return; }
  const r = await api('POST', '/faecher', { name, farbe: SF.selColor });
  if (r.id) {
    SF.faecher.push(r);
    fillFachDrops();
    document.getElementById('new-fach-name').value = '';
    closeModal('fach');
    toast('Fach "' + name + '" hinzugefügt', 'ok');
    if (typeof renderNoten === 'function') renderNoten();
    if (typeof renderSettingsFaecher === 'function') renderSettingsFaecher();
  } else { toast('Fehler beim Speichern', 'err'); }
}
async function delFach(fid) {
  if (!confirm('Fach und alle Noten/Einträge dazu löschen?')) return;
  await api('DELETE', '/faecher/' + fid);
  SF.faecher = SF.faecher.filter(f => f.id !== fid);
  fillFachDrops();
  toast('Fach gelöscht', 'ok');
  if (typeof renderNoten === 'function') renderNoten();
  if (typeof renderSettingsFaecher === 'function') renderSettingsFaecher();
}
async function renameFach(fid) {
  const f = SF.faecher.find(x => x.id === fid);
  if (!f) return;
  const name = prompt('Fachname:', f.name);
  if (!name || name === f.name) return;
  const r = await api('PUT', '/faecher/' + fid, { name, farbe: f.farbe });
  if (r.success) {
    f.name = name;
    fillFachDrops();
    toast('Fach umbenannt', 'ok');
    if (typeof renderNoten === 'function') renderNoten();
    if (typeof renderSettingsFaecher === 'function') renderSettingsFaecher();
  }
}

/* ── NOTE MODAL ───────────────────────────────────────── */
function openAddNote() {
  document.getElementById('note-edit-id').value = '';
  document.getElementById('modal-note-title').innerHTML = '<svg><use href="#ic-note"/></svg> Note hinzufügen';
  ['note-val'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('note-gewichtung').value = '1.0';
  document.getElementById('note-thema-id').value = '';
  document.getElementById('note-thema-search').value = '';
  document.getElementById('note-datum').value = new Date().toISOString().split('T')[0];
  const errEl = document.getElementById('note-err');
  if (errEl) errEl.style.display = 'none';
  openModal('note');
}
function openAddNoteForFach(fid) {
  openAddNote();
  document.getElementById('note-fach').value = fid;
  _themaDropFachId = fid;
}
function openEditNote(nid) {
  const n = SF.noten.find(x => x.id === nid);
  if (!n) return;
  document.getElementById('note-edit-id').value = nid;
  document.getElementById('modal-note-title').innerHTML = '<svg><use href="#ic-edit"/></svg> Note bearbeiten';
  document.getElementById('note-fach').value    = n.fach_id;
  document.getElementById('note-val').value     = n.note;
  document.getElementById('note-gewichtung').value = n.gewichtung || 1.0;
  document.getElementById('note-sem').value     = n.semester || '';
  document.getElementById('note-datum').value   = n.datum;
  document.getElementById('note-thema-id').value = n.thema_id || '';
  document.getElementById('note-thema-search').value = n.thema_name || '';
  _themaDropFachId = n.fach_id;
  const errEl = document.getElementById('note-err');
  if (errEl) errEl.style.display = 'none';
  openModal('note');
}
async function saveNote() {
  const fid   = +document.getElementById('note-fach').value;
  const val   = +document.getElementById('note-val').value;
  const gew   = parseFloat(document.getElementById('note-gewichtung').value) || 1.0;
  const sem   = document.getElementById('note-sem').value;
  const datum = document.getElementById('note-datum').value;
  const eid   = document.getElementById('note-edit-id').value;
  const thema_id = +document.getElementById('note-thema-id').value || null;
  const errEl = document.getElementById('note-err');
  if (errEl) errEl.style.display = 'none';
  if (!fid || !val || !datum) { showErr(errEl, 'Fach, Note und Datum erforderlich'); return; }
  if (val < 1 || val > 6) { showErr(errEl, 'Note muss zwischen 1 und 6 sein'); return; }
  if (gew <= 0) { showErr(errEl, 'Gewichtung muss grösser als 0 sein'); return; }
  let r;
  if (eid) {
    r = await api('PUT', '/noten/' + eid, { fach_id: fid, note: val, gewichtung: gew, semester: sem, thema_id, datum });
    if (r.id) SF.noten = SF.noten.map(n => n.id === +eid ? r : n);
  } else {
    r = await api('POST', '/noten', { fach_id: fid, note: val, gewichtung: gew, semester: sem, thema_id, datum });
    if (r.id) SF.noten.push(r);
  }
  if (r.id) {
    closeModal('note');
    toast(eid ? 'Note aktualisiert' : 'Note gespeichert', 'ok');
    if (typeof renderNoten === 'function') renderNoten();
  }
}
async function delNote(nid) {
  if (!confirm('Note löschen?')) return;
  await api('DELETE', '/noten/' + nid);
  SF.noten = SF.noten.filter(n => n.id !== nid);
  toast('Note gelöscht', 'ok');
  if (typeof renderNoten === 'function') renderNoten();
}

/* ── LERNEINTRAG MODAL ────────────────────────────────── */
function openAddLernen() {
  document.getElementById('lernen-edit-id').value = '';
  document.getElementById('lernen-modal-title').innerHTML = '<svg><use href="#ic-clock"/></svg> Lerneintrag';
  ['lernen-desc','lernen-dauer','lernen-titel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('lernen-datum').value = new Date().toISOString().split('T')[0];
  openModal('lernen');
}
function openEditLernen(eid) {
  const e = SF.eintraege.find(x => x.id === eid);
  if (!e) return;
  document.getElementById('lernen-edit-id').value  = eid;
  document.getElementById('lernen-modal-title').innerHTML = '<svg><use href="#ic-edit"/></svg> Eintrag bearbeiten';
  document.getElementById('lernen-fach').value     = e.fach_id;
  document.getElementById('lernen-methode').value  = e.methode_id || '';
  document.getElementById('lernen-titel').value    = e.titel;
  document.getElementById('lernen-desc').value     = e.beschreibung || '';
  document.getElementById('lernen-dauer').value    = e.dauer_minuten;
  document.getElementById('lernen-datum').value    = e.datum;
  openModal('lernen');
}
async function saveLerneintrag() {
  const fid   = +document.getElementById('lernen-fach').value;
  const mid   = +document.getElementById('lernen-methode').value || null;
  const titel = document.getElementById('lernen-titel').value.trim();
  const desc  = document.getElementById('lernen-desc').value.trim();
  const dauer = +document.getElementById('lernen-dauer').value;
  const datum = document.getElementById('lernen-datum').value;
  const eid   = document.getElementById('lernen-edit-id').value;
  if (!fid || !titel || !dauer || !datum) { toast('Fach, Titel, Dauer und Datum erforderlich', 'err'); return; }
  let r;
  if (eid) {
    r = await api('PUT', '/lerneintraege/' + eid, { fach_id: fid, methode_id: mid, titel, beschreibung: desc, dauer_minuten: dauer, datum });
    if (r.id) SF.eintraege = SF.eintraege.map(e => e.id === +eid ? r : e);
  } else {
    r = await api('POST', '/lerneintraege', { fach_id: fid, methode_id: mid, titel, beschreibung: desc, dauer_minuten: dauer, datum });
    if (r.id) SF.eintraege.push(r);
  }
  if (r.id) {
    closeModal('lernen');
    toast(eid ? 'Eintrag aktualisiert' : 'Eintrag gespeichert', 'ok');
    if (typeof renderLernen === 'function') renderLernen();
  }
}
async function delEintrag(eid) {
  if (!confirm('Eintrag löschen?')) return;
  await api('DELETE', '/lerneintraege/' + eid);
  SF.eintraege = SF.eintraege.filter(e => e.id !== eid);
  toast('Eintrag gelöscht', 'ok');
  if (typeof renderLernen === 'function') renderLernen();
}

/* ── THEMEN ───────────────────────────────────────────── */
function openThemenModal() {
  const el = document.getElementById('thema-fach');
  if (el && SF.faecher.length) { el.innerHTML = SF.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join(''); }
  renderThemenList();
  openModal('themen');
}
function renderThemenList() {
  const fid = +document.getElementById('thema-fach')?.value;
  const el = document.getElementById('themen-list');
  if (!el) return;
  const ts = SF.themen.filter(t => t.fach_id === fid);
  if (!ts.length) { el.innerHTML = '<p style="color:var(--text3);font-size:.82rem;padding:8px 0">Noch keine Themen für dieses Fach.</p>'; return; }
  el.innerHTML = ts.map(t => `
    <div class="thema-row">
      <span class="${t.abgeschlossen ? 'thema-done' : ''} thema-row-name">${t.name}</span>
      ${iconBtn(t.abgeschlossen ? 'ic-undo' : 'ic-check', `toggleThema(${t.id})`, t.abgeschlossen ? 'Wiederherstellen' : 'Abschliessen')}
      ${iconBtn('ic-trash', `delThema(${t.id})`, 'Löschen', 'btn-icon-danger')}
    </div>`).join('');
}
async function addThema() {
  const name = document.getElementById('thema-name').value.trim();
  const fid = +document.getElementById('thema-fach').value;
  if (!name || !fid) return;
  const r = await api('POST', '/themen', { fach_id: fid, name });
  if (r.id) {
    SF.themen.push(r);
    document.getElementById('thema-name').value = '';
    renderThemenList();
    loadThemenQuick?.();
    loadThemenLernen?.();
  }
}
async function toggleThema(tid) {
  const t = SF.themen.find(x => x.id === tid);
  if (!t) return;
  const r = await api('PUT', '/themen/' + tid, { abgeschlossen: t.abgeschlossen ? 0 : 1 });
  if (r.id) { SF.themen = SF.themen.map(x => x.id === tid ? r : x); renderThemenList(); }
}
async function delThema(tid) {
  await api('DELETE', '/themen/' + tid);
  SF.themen = SF.themen.filter(t => t.id !== tid);
  renderThemenList();
}

/* ── METHODE MODAL ────────────────────────────────────── */
function openAddMethode() {
  buildColorDots('methode-cdots', '#CBA6F7');
  SF.selMethodeColor = '#CBA6F7';
  openModal('methode');
}
async function saveMethode() {
  const name = document.getElementById('m-name').value.trim();
  const desc = document.getElementById('m-desc').value.trim();
  const empf = document.getElementById('m-empf').value.trim();
  if (!name) { toast('Name erforderlich', 'err'); return; }
  const r = await api('POST', '/lernmethoden', { name, beschreibung: desc, empfehlung: empf, farbe: SF.selMethodeColor });
  if (r.id) {
    SF.methoden.push(r);
    fillMethodeDrops();
    document.getElementById('m-name').value = '';
    document.getElementById('m-desc').value = '';
    document.getElementById('m-empf').value = '';
    closeModal('methode');
    toast('Methode gespeichert', 'ok');
    if (typeof renderMethoden === 'function') renderMethoden();
  }
}

/* ── KALENDER EVENT MODAL ─────────────────────────────── */
function openAddEvent(date) {
  const el = document.getElementById('modal-event');
  if (!el) return;
  document.getElementById('event-titel').value = '';
  document.getElementById('event-start').value = '';
  document.getElementById('event-datum').value = date || new Date().toISOString().split('T')[0];
  const ef = document.getElementById('event-fach');
  if (ef) ef.innerHTML = '<option value="">Kein Fach</option>' + SF.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
  openModal('event');
}
async function saveEvent() {
  const titel = document.getElementById('event-titel').value.trim();
  const fid   = +document.getElementById('event-fach').value || null;
  const datum = document.getElementById('event-datum').value;
  const start = document.getElementById('event-start').value;
  if (!titel || !datum) { toast('Titel und Datum erforderlich', 'err'); return; }
  const r = await api('POST', '/kalender', { titel, fach_id: fid, datum, uhrzeit_start: start });
  if (r.id) {
    SF.kalender.push(r);
    closeModal('event');
    toast('Termin gespeichert', 'ok');
    if (typeof renderKalender === 'function') renderKalender();
  }
}

/* ── SEMESTER ─────────────────────────────────────────── */
async function addSemester(name) {
  if (!name?.trim()) return;
  const r = await api('POST', '/semester', { name: name.trim() });
  if (r.id) {
    SF.semester.push(r);
    fillSemesterDrops();
    if (typeof renderSemesterSettings === 'function') renderSemesterSettings();
    toast('Semester hinzugefügt', 'ok');
  }
}
async function delSemester(sid) {
  await api('DELETE', '/semester/' + sid);
  SF.semester = SF.semester.filter(s => s.id !== sid);
  fillSemesterDrops();
  if (typeof renderSemesterSettings === 'function') renderSemesterSettings();
  toast('Semester gelöscht', 'ok');
}

window.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  const lp = document.getElementById('login-pw');
  const rp = document.getElementById('reg-pw');
  if (lp) lp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  if (rp) rp.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  buildColorDots('fach-cdots');
  buildColorDots('methode-cdots', '#CBA6F7');
  init();
});
