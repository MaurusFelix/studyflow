/* kalender.js */
const cal = { date: new Date(), view: 'monat', dragEv: null };

function initPageScript() { renderKalender(); renderUpcoming(); }

function renderKalender() {
  document.getElementById('cal-title').textContent =
    ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][cal.date.getMonth()] + ' ' + cal.date.getFullYear();
  if (cal.view === 'monat') renderMonat(); else renderWoche();
  renderUpcoming();
}
function calPrev() { cal.view === 'monat' ? cal.date.setMonth(cal.date.getMonth()-1) : cal.date.setDate(cal.date.getDate()-7); renderKalender(); }
function calNext() { cal.view === 'monat' ? cal.date.setMonth(cal.date.getMonth()+1) : cal.date.setDate(cal.date.getDate()+7); renderKalender(); }
function calToday() { cal.date = new Date(); renderKalender(); }
function setCalView(v) {
  cal.view = v;
  document.getElementById('vbtn-monat').classList.toggle('active', v === 'monat');
  document.getElementById('vbtn-woche').classList.toggle('active', v === 'woche');
  renderKalender();
}

function renderMonat() {
  const body = document.getElementById('cal-body');
  const y = cal.date.getFullYear(), m = cal.date.getMonth();
  const first = new Date(y, m, 1);
  const startDay = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];
  let html = '';
  // Leading days
  for (let i = 0; i < startDay; i++) {
    const d = new Date(y, m, -startDay+i+1);
    html += `<div class="cal-cell other" data-date="${d.toISOString().split('T')[0]}"><div class="cal-date">${d.getDate()}</div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d).toISOString().split('T')[0];
    const evs = SF.kalender.filter(e => e.datum === date);
    const isToday = date === today;
    const evHTML = evs.slice(0,3).map(e => {
      const fach = SF.faecher.find(f => f.id === e.fach_id);
      const bg = fach ? fach.farbe : '#6366F1';
      return `<div class="cal-ev" style="background:${bg}" draggable="true"
        ondragstart="calDragStart(event,${e.id})" title="${e.titel}">
        ${e.uhrzeit_start ? e.uhrzeit_start.slice(0,5)+' ' : ''}${e.titel}
      </div>`;
    }).join('');
    const more = evs.length > 3 ? `<div class="cal-more">+${evs.length-3} mehr</div>` : '';
    html += `<div class="cal-cell${isToday?' today':''}" data-date="${date}"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="calDrop(event,'${date}')"
      onclick="openAddEvent('${date}')">
      <div class="cal-date">${d}</div>
      ${evHTML}${more}
    </div>`;
  }
  body.innerHTML = html;
}

function renderWoche() {
  const body = document.getElementById('cal-body');
  const d = new Date(cal.date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  const today = new Date().toISOString().split('T')[0];
  let html = '';
  for (let i = 0; i < 7; i++) {
    const date = d.toISOString().split('T')[0];
    const evs = SF.kalender.filter(e => e.datum === date);
    const isToday = date === today;
    const evHTML = evs.map(e => {
      const fach = SF.faecher.find(f => f.id === e.fach_id);
      const bg = fach ? fach.farbe : '#6366F1';
      return `<div class="cal-ev" style="background:${bg}" draggable="true"
        ondragstart="calDragStart(event,${e.id})">${e.uhrzeit_start?e.uhrzeit_start.slice(0,5)+' ':''}${e.titel}</div>`;
    }).join('');
    html += `<div class="cal-cell${isToday?' today':''}" style="min-height:120px" data-date="${date}"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="calDrop(event,'${date}')"
      onclick="openAddEvent('${date}')">
      <div class="cal-date">${d.getDate()}</div>${evHTML}
    </div>`;
    d.setDate(d.getDate() + 1);
  }
  body.innerHTML = html;
}

function renderUpcoming() {
  const el = document.getElementById('upcoming-events');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const upcoming = SF.kalender.filter(e => e.datum >= today).sort((a,b) => a.datum.localeCompare(b.datum)).slice(0,5);
  el.innerHTML = upcoming.length
    ? upcoming.map(e => {
        const fach = SF.faecher.find(f => f.id === e.fach_id);
        const bg = fach ? fach.farbe : '#6366F1';
        return `<div class="entry-item">
          <div class="entry-dot" style="background:${bg}"></div>
          <div class="entry-info">
            <div class="entry-title">${e.titel}</div>
            <div class="entry-meta">${fmtDate(e.datum)}${e.uhrzeit_start?' · '+e.uhrzeit_start.slice(0,5):''}${fach?' · '+fach.name:''}</div>
          </div>
          <button class="btn-icon" onclick="delEvent(${e.id})">🗑️</button>
        </div>`;
      }).join('')
    : emptyHTML('📅', 'Keine bevorstehenden Termine', 'Klick auf einen Kalendertag um einen Termin zu planen');
}

function calDragStart(e, eid) { cal.dragEv = eid; e.dataTransfer.effectAllowed = 'move'; }
async function calDrop(e, date) {
  e.preventDefault();
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  if (!cal.dragEv) return;
  const r = await api('PUT', '/kalender/' + cal.dragEv, { datum: date });
  if (r.id) { SF.kalender = SF.kalender.map(ev => ev.id === cal.dragEv ? r : ev); renderKalender(); }
  cal.dragEv = null;
}
async function delEvent(eid) {
  if (!confirm('Termin löschen?')) return;
  await api('DELETE', '/kalender/' + eid);
  SF.kalender = SF.kalender.filter(e => e.id !== eid);
  renderKalender();
  toast('Termin gelöscht', 'ok');
}
