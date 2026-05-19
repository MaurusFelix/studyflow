/* noten.js */
function initPageScript() { renderNoten(); setTodayDates(); }

function renderNoten() {
  const el = document.getElementById('noten-list');
  if (!el) return;
  if (!SF.faecher.length) {
    el.innerHTML = emptyHTML('🎓', 'Keine Fächer vorhanden', 'Gehe zu Einstellungen und füge dein erstes Fach hinzu.');
    return;
  }
  // Always show all faecher, open by default if has notes
  el.innerHTML = SF.faecher.map(fach => {
    const fn  = SF.noten.filter(n => n.fach_id === fach.id);
    const avg = fn.length ? (fn.reduce((s, n) => s + n.note, 0) / fn.length).toFixed(2) : null;
    const ac  = !avg ? 'avg-none' : +avg >= 5 ? 'avg-good' : +avg >= 4 ? 'avg-ok' : 'avg-bad';
    const rows = fn.length
      ? fn.map(n => {
          const nc = n.note >= 5 ? 'nb-good' : n.note >= 4 ? 'nb-ok' : 'nb-bad';
          return `<tr>
            <td><div class="nb ${nc}">${n.note}</div></td>
            <td>${n.titel || '–'}</td>
            <td>${fmtDate(n.datum)}</td>
            <td><span class="chip">Sem. ${n.semester || 1}</span></td>
            <td>
              <div style="display:flex;gap:4px;justify-content:flex-end">
                <button class="btn-icon" onclick="openEditNote(${n.id})">✏️</button>
                <button class="btn-icon" onclick="delNote(${n.id})">🗑️</button>
              </div>
            </td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="5" style="text-align:center;padding:28px 20px">
          <div style="color:var(--text3);font-size:.84rem">Noch keine Noten eingetragen</div>
          <button class="btn btn-p btn-sm" style="margin-top:10px" onclick="openAddNoteForFach(${fach.id})">+ Erste Note hinzufügen</button>
        </td></tr>`;

    return `<div class="fach-card ${fn.length ? 'open' : ''}" id="fc-${fach.id}">
      <div class="fach-hd" onclick="toggleFach(${fach.id})">
        <div class="fach-hd-l">
          <div class="fach-bar" style="background:${fach.farbe}"></div>
          <div>
            <div class="fach-name">${fach.name}</div>
            <div class="fach-cnt">${fn.length} Note${fn.length !== 1 ? 'n' : ''}</div>
          </div>
          <div class="avg ${ac}">⌀ ${avg || '–'}</div>
        </div>
        <span class="fach-chev">▶</span>
      </div>
      <div class="fach-body">
        <table class="notes-tbl">
          <thead><tr>
            <th>Note</th><th>Titel</th><th>Datum</th><th>Semester</th>
            <th style="text-align:right">Aktionen</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="fach-foot">
          <button class="btn btn-p btn-sm" onclick="openAddNoteForFach(${fach.id})">+ Note hinzufügen</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleFach(id) {
  document.getElementById('fc-' + id)?.classList.toggle('open');
}
