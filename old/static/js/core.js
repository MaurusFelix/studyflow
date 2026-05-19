/* ═══════════════════════════════════════════════════════
   StudyFlow v3 — core.js
   Globaler State + API + Helpers (alle Seiten laden dies)
═══════════════════════════════════════════════════════ */

/* ── GLOBALER STATE ───────────────────────────────────── */
const SF = {
  user: null,
  faecher: [], noten: [], methoden: [],
  eintraege: [], themen: [], kalender: [],
  charts: {}, selColor: '#EF4444',
};

/* ── API HELPER ───────────────────────────────────────── */
async function api(method, path, data) {
  const o = { method, credentials: 'include', headers: { 'Content-Type': 'application/json' } };
  if (data) o.body = JSON.stringify(data);
  try { const r = await fetch('/api' + path, o); return r.json(); } catch { return {}; }
}

/* ── INIT (läuft auf jeder Seite) ─────────────────────── */
async function init() {
  // CSS handles landing vs app visibility via body.land-page / body.app-page
  // Only load data if we're on an app page (Flask already redirects if not logged in)
  const isAppPage = document.body.classList.contains('app-page');
  if (!isAppPage) return; // Landing page — nothing to load

  const me = await api('GET', '/me');
  if (!me.logged_in) {
    window.location.href = '/';
    return;
  }
  SF.user = me;
  const av = document.getElementById('sidebar-uav');
  const un = document.getElementById('sidebar-uname');
  const su = document.getElementById('settings-uname');
  const savedPic = localStorage.getItem('sf-pic');
  if (av) {
    if (savedPic) av.innerHTML = `<img src="${savedPic}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`;
    else av.textContent = me.username[0].toUpperCase();
  }
  if (un) un.textContent = me.username;
  if (su) su.textContent = me.username;
  await loadAll();
  if (typeof initPageScript === 'function') initPageScript();
}

function showLanding() {
  document.getElementById('landing').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
function showApp() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const u = SF.user.username;
  const av = document.getElementById('sidebar-uav');
  const un = document.getElementById('sidebar-uname');
  const su = document.getElementById('settings-uname');
  if (av) av.textContent = u[0].toUpperCase();
  if (un) un.textContent = u;
  if (su) su.textContent = u;
}

async function loadAll() {
  const [f, n, m, l, t, k] = await Promise.all([
    api('GET', '/faecher'), api('GET', '/noten'), api('GET', '/lernmethoden'),
    api('GET', '/lerneintraege'), api('GET', '/themen'), api('GET', '/kalender')
  ]);
  SF.faecher   = Array.isArray(f) ? f : [];
  SF.noten     = Array.isArray(n) ? n : [];
  SF.methoden  = Array.isArray(m) ? m : [];
  SF.eintraege = Array.isArray(l) ? l : [];
  SF.themen    = Array.isArray(t) ? t : [];
  SF.kalender  = Array.isArray(k) ? k : [];
  fillFachDrops();
  fillMethodeDrops();
}

/* ── LOGIN / REGISTER / LOGOUT ────────────────────────── */
async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pw').value;
  const err = document.getElementById('login-err');
  if (!u || !p) { showErr(err, 'Bitte beide Felder ausfüllen'); return; }
  const r = await api('POST', '/login', { username: u, password: p });
  if (r.success) {
    // Felder leeren
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
    // Felder leeren
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
  const dark = localStorage.getItem('sf-dark') === '1';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const tb = document.getElementById('theme-btn');
  if (tb) tb.textContent = dark ? '☀️' : '🌙';
  const td = document.getElementById('toggle-dark');
  if (td) td.checked = dark;
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = !cur;
  document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  localStorage.setItem('sf-dark', next ? '1' : '0');
  const tb = document.getElementById('theme-btn');
  if (tb) tb.textContent = next ? '☀️' : '🌙';
  const td = document.getElementById('toggle-dark');
  if (td) td.checked = next;
  // Re-render charts to pick up new colors
  Object.values(SF.charts).forEach(c => { try { c.destroy(); } catch {} });
  SF.charts = {};
  if (typeof initPageScript === 'function') initPageScript();
}

/* ── SIDEBAR ──────────────────────────────────────────── */
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

/* ── MODAL ────────────────────────────────────────────── */
function openModal(name) {
  const el = document.getElementById('modal-' + name);
  if (el) { el.classList.add('open'); el.querySelector('input,select')?.focus(); }
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
  return Math.floor(m / 60) + 'h ' + (m % 60 ? (m % 60) + 'm' : '');
}
function getCS(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function setTodayDates() {
  const t = new Date().toISOString().split('T')[0];
  ['note-datum', 'lernen-datum', 'quick-datum', 'event-datum'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = t;
  });
}
function destroyChart(id) {
  if (SF.charts[id]) { try { SF.charts[id].destroy(); } catch {} delete SF.charts[id]; }
}
function emptyHTML(icon, title, sub) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}
function entryHTML(e, showActions) {
  // Use embedded fach_name/fach_farbe if available (from JOIN), fallback to SF.faecher
  const fach = SF.faecher.find(f => f.id === e.fach_id) || {};
  const fname = e.fach_name || fach.name || 'Unbekannt';
  const ffarbe = e.fach_farbe || fach.farbe || '#999';
  const meth = SF.methoden.find(m => m.id === e.methode_id);
  const actions = showActions ? `
    <div class="entry-actions">
      <button class="btn-icon" onclick="openEditLernen(${e.id})">✏️</button>
      <button class="btn-icon" onclick="delEintrag(${e.id})">🗑️</button>
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

/* ── FACH DROPDOWNS ───────────────────────────────────── */
function fillFachDrops() {
  const opts = SF.faecher.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  const optsBlank = '<option value="">Kein Fach</option>' + opts;
  ['note-fach','lernen-fach','quick-fach','thema-fach'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts || '<option value="">— Kein Fach —</option>';
  });
  const ef = document.getElementById('event-fach');
  if (ef) ef.innerHTML = optsBlank;
  // Timer
  const tf = document.getElementById('timer-fach');
  if (tf) tf.innerHTML = opts;
  updateTimerFachLabel?.();
}
function fillMethodeDrops() {
  const opts = SF.methoden.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  const el = document.getElementById('lernen-methode');
  if (el) el.innerHTML = '<option value="">— Methode —</option>' + opts;
}

/* ── FACH MODAL ───────────────────────────────────────── */
const PRESET_COLORS = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6366F1'];
function buildColorDots() {
  const el = document.getElementById('fach-cdots');
  if (!el) return;
  el.innerHTML = PRESET_COLORS.map(c =>
    `<div class="cdot${c===SF.selColor?' sel':''}" style="background:${c}" onclick="selColor('${c}')"></div>`
  ).join('');
}
function selColor(c) {
  SF.selColor = c;
  document.querySelectorAll('.cdot').forEach(d => d.classList.toggle('sel', d.style.background === c || d.style.backgroundColor === c));
}
function openAddFach() { buildColorDots(); openModal('fach'); }
async function saveFach() {
  const name = document.getElementById('new-fach-name').value.trim();
  if (!name) { toast('Bitte Fachname eingeben', 'err'); return; }
  const r = await api('POST', '/faecher', { name, farbe: SF.selColor });
  if (r.id) {
    SF.faecher.push(r);
    fillFachDrops();
    document.getElementById('new-fach-name').value = '';
    closeModal('fach');
    toast('✅ Fach "' + name + '" hinzugefügt', 'ok');
    if (typeof renderNoten === 'function') renderNoten();
    if (typeof renderSettings === 'function') renderSettings();
  } else {
    toast('Fehler beim Speichern', 'err');
  }
}
async function delFach(fid) {
  if (!confirm('Fach und alle Noten/Einträge dazu löschen?')) return;
  await api('DELETE', '/faecher/' + fid);
  SF.faecher = SF.faecher.filter(f => f.id !== fid);
  fillFachDrops();
  toast('Fach gelöscht', 'ok');
  if (typeof renderNoten === 'function') renderNoten();
  if (typeof renderSettings === 'function') renderSettings();
}

/* ── NOTE MODAL ───────────────────────────────────────── */
function openAddNote() {
  document.getElementById('note-edit-id').value = '';
  document.getElementById('modal-note-title').textContent = '📝 Note hinzufügen';
  ['note-val','note-titel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('note-datum').value = new Date().toISOString().split('T')[0];
  openModal('note');
}
function openAddNoteForFach(fid) {
  openAddNote();
  document.getElementById('note-fach').value = fid;
}
function openEditNote(nid) {
  const n = SF.noten.find(x => x.id === nid);
  if (!n) return;
  document.getElementById('note-edit-id').value = nid;
  document.getElementById('modal-note-title').textContent = '✏️ Note bearbeiten';
  document.getElementById('note-fach').value  = n.fach_id;
  document.getElementById('note-val').value   = n.note;
  document.getElementById('note-sem').value   = n.semester || 1;
  document.getElementById('note-titel').value = n.titel || '';
  document.getElementById('note-datum').value = n.datum;
  openModal('note');
}
async function saveNote() {
  const fid = +document.getElementById('note-fach').value;
  const val = +document.getElementById('note-val').value;
  const sem = document.getElementById('note-sem').value;
  const titel = document.getElementById('note-titel').value.trim();
  const datum = document.getElementById('note-datum').value;
  const eid = document.getElementById('note-edit-id').value;
  if (!fid || !val || !datum) { toast('Fach, Note und Datum erforderlich', 'err'); return; }
  if (val < 1 || val > 6) { toast('Note muss zwischen 1 und 6 sein', 'err'); return; }
  let r;
  if (eid) {
    r = await api('PUT', '/noten/' + eid, { fach_id: fid, note: val, semester: sem, titel, datum });
    if (r.id) SF.noten = SF.noten.map(n => n.id === +eid ? r : n);
  } else {
    r = await api('POST', '/noten', { fach_id: fid, note: val, semester: sem, titel, datum });
    if (r.id) SF.noten.push(r);
  }
  if (r.id) {
    closeModal('note');
    toast(eid ? '✅ Note aktualisiert' : '✅ Note gespeichert', 'ok');
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
  document.getElementById('lernen-modal-title').textContent = '📚 Lerneintrag';
  ['lernen-desc','lernen-dauer','lernen-titel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('lernen-datum').value = new Date().toISOString().split('T')[0];
  openModal('lernen');
}
function openEditLernen(eid) {
  const e = SF.eintraege.find(x => x.id === eid);
  if (!e) return;
  document.getElementById('lernen-edit-id').value = eid;
  document.getElementById('lernen-modal-title').textContent = '✏️ Eintrag bearbeiten';
  document.getElementById('lernen-fach').value    = e.fach_id;
  document.getElementById('lernen-methode').value = e.methode_id || '';
  document.getElementById('lernen-titel').value   = e.titel;
  document.getElementById('lernen-desc').value    = e.beschreibung || '';
  document.getElementById('lernen-dauer').value   = e.dauer_minuten;
  document.getElementById('lernen-datum').value   = e.datum;
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
    toast(eid ? '✅ Eintrag aktualisiert' : '✅ Eintrag gespeichert', 'ok');
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
      <span class="${t.abgeschlossen ? 'thema-done' : ''}" style="flex:1">${t.name}</span>
      <button class="btn-icon" onclick="toggleThema(${t.id})">${t.abgeschlossen ? '↩️' : '✅'}</button>
      <button class="btn-icon" onclick="delThema(${t.id})">🗑️</button>
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
async function saveMethode() {
  const name = document.getElementById('m-name').value.trim();
  const desc = document.getElementById('m-desc').value.trim();
  const empf = document.getElementById('m-empf').value.trim();
  if (!name) { toast('Name erforderlich', 'err'); return; }
  const r = await api('POST', '/lernmethoden', { name, beschreibung: desc, empfehlung: empf });
  if (r.id) {
    SF.methoden.push(r);
    fillMethodeDrops();
    closeModal('methode');
    toast('✅ Methode gespeichert', 'ok');
    if (typeof renderMethoden === 'function') renderMethoden();
  }
}

/* ── KALENDER EVENT MODAL ─────────────────────────────── */
function openAddEvent(date) {
  const el = document.getElementById('modal-event');
  if (!el) { console.error('modal-event not found'); return; }
  document.getElementById('event-titel').value = '';
  document.getElementById('event-start').value = '';
  document.getElementById('event-datum').value = date || new Date().toISOString().split('T')[0];
  // Fill fach dropdown for event
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
    toast('✅ Termin gespeichert', 'ok');
    if (typeof renderKalender === 'function') renderKalender();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  // Always: keyboard shortcuts + color dots (needed on landing)
  const lp = document.getElementById('login-pw');
  const rp = document.getElementById('reg-pw');
  if (lp) lp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  if (rp) rp.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  buildColorDots();
  init();
});
