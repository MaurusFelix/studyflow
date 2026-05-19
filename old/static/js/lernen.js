/* lernen.js */
const timer = { running: false, sec: 0, iv: null };

function initPageScript() {
  renderLernen();
  setTodayDates();
  fillFachDrops();
  fillMethodeDrops();
  updateTimerFachLabel();
}

function renderLernen() {
  const el = document.getElementById('lernen-list');
  if (!el) return;
  const ee = SF.eintraege.filter(e => !e.geplant);
  el.innerHTML = ee.length
    ? ee.map(e => entryHTML(e, true)).join('')
    : emptyHTML('📚', 'Noch keine Einträge', 'Nutze den Timer oder den Schnelleintrag');
}

/* ── TIMER ─────────────────────────────────────────────── */
function updateTimerFachLabel() {
  const sel = document.getElementById('timer-fach');
  const lbl = document.getElementById('timer-fach-lbl');
  if (lbl && sel) lbl.textContent = sel.options[sel.selectedIndex]?.text || 'Kein Fach gewählt';
}
function toggleTimer() {
  if (timer.running) {
    clearInterval(timer.iv);
    timer.running = false;
    document.getElementById('timer-startstop').textContent = '▶ Fortsetzen';
    document.getElementById('timer-state-lbl').textContent = 'Pausiert';
  } else {
    timer.running = true;
    timer.iv = setInterval(() => { timer.sec++; updateTimerDisplay(); }, 1000);
    document.getElementById('timer-startstop').textContent = '⏸ Pause';
    document.getElementById('timer-state-lbl').textContent = 'Läuft';
  }
}
function updateTimerDisplay() {
  const h = Math.floor(timer.sec / 3600);
  const m = Math.floor((timer.sec % 3600) / 60);
  const s = timer.sec % 60;
  document.getElementById('timer-display').textContent =
    `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  // Ring animation (502.65 = 2πr, r=80)
  const maxSec = 3600;
  const prog = Math.min(timer.sec / maxSec, 1);
  const offset = 502.65 * (1 - prog);
  const ring = document.getElementById('ring-fill');
  if (ring) ring.style.strokeDashoffset = offset;
}
function resetTimer() {
  clearInterval(timer.iv);
  timer.running = false;
  timer.sec = 0;
  updateTimerDisplay();
  document.getElementById('timer-startstop').textContent = '▶ Starten';
  document.getElementById('timer-state-lbl').textContent = 'Bereit';
}
async function saveTimerEntry() {
  if (timer.sec < 30) { toast('Mindestens 30 Sekunden aufnehmen', 'err'); return; }
  const fid = +document.getElementById('timer-fach').value;
  if (!fid) { toast('Bitte ein Fach auswählen', 'err'); return; }
  const dauer = Math.round(timer.sec / 60) || 1;
  const fach = SF.faecher.find(f => f.id === fid);
  const r = await api('POST', '/lerneintraege', {
    fach_id: fid, titel: 'Timer-Sitzung ' + (fach?.name || ''),
    dauer_minuten: dauer, datum: new Date().toISOString().split('T')[0], geplant: 0
  });
  if (r.id) {
    SF.eintraege.push(r);
    resetTimer();
    renderLernen();
    toast('✅ ' + dauer + ' Minuten gespeichert!', 'ok');
  }
}

/* ── SCHNELLEINTRAG ───────────────────────────────────── */
function loadThemenQuick() {
  const fid = +document.getElementById('quick-fach')?.value;
  const sel = document.getElementById('quick-thema');
  if (!sel) return;
  const ts = SF.themen.filter(t => t.fach_id === fid && !t.abgeschlossen);
  sel.innerHTML = '<option value="">— Thema auswählen —</option>' + ts.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
}
function applyThemaQuick() {
  const v = document.getElementById('quick-thema')?.value;
  if (v) document.getElementById('quick-titel').value = v;
}
async function quickSave() {
  const fid   = +document.getElementById('quick-fach').value;
  const titel = document.getElementById('quick-titel').value.trim();
  const dauer = +document.getElementById('quick-dauer').value;
  const datum = document.getElementById('quick-datum').value;
  if (!fid || !titel || !dauer || !datum) { toast('Alle Pflichtfelder ausfüllen', 'err'); return; }
  const r = await api('POST', '/lerneintraege', { fach_id: fid, titel, dauer_minuten: dauer, datum, geplant: 0 });
  if (r.id) {
    SF.eintraege.push(r);
    document.getElementById('quick-titel').value = '';
    document.getElementById('quick-dauer').value = '';
    renderLernen();
    toast('✅ Eintrag gespeichert', 'ok');
  }
}

/* ── LERNEN MODAL THEMEN ──────────────────────────────── */
function loadThemenLernen() {
  const fid = +document.getElementById('lernen-fach')?.value;
  const sel = document.getElementById('lernen-thema-sel');
  if (!sel) return;
  const ts = SF.themen.filter(t => t.fach_id === fid && !t.abgeschlossen);
  sel.innerHTML = '<option value="">— Thema auswählen —</option>' + ts.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
}
function applyThemaLernen() {
  const v = document.getElementById('lernen-thema-sel')?.value;
  if (v) document.getElementById('lernen-titel').value = v;
}
