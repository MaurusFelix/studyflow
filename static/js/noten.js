/* noten.js */
function initPageScript() { renderNoten(); setTodayDates(); }

function weightedAvg(noten) {
  if (!noten.length) return null;
  const sumGew = noten.reduce((s, n) => s + (n.gewichtung || 1.0), 0);
  const sumWert = noten.reduce((s, n) => s + n.note * (n.gewichtung || 1.0), 0);
  return sumGew > 0 ? (sumWert / sumGew).toFixed(2) : null;
}

function renderNoten() {
  const el = document.getElementById('noten-list');
  if (!el) return;
  if (!SF.faecher.length) {
    el.innerHTML = emptyHTML('📚', 'Keine Fächer vorhanden', 'Gehe zu Einstellungen und füge dein erstes Fach hinzu.');
    return;
  }
  el.innerHTML = SF.faecher.map(fach => {
    const fn  = SF.noten.filter(n => n.fach_id === fach.id);
    const avg = weightedAvg(fn);
    const ac  = !avg ? 'avg-none' : +avg >= 5 ? 'avg-good' : +avg >= 4 ? 'avg-ok' : 'avg-bad';
    const rows = fn.length
      ? fn.map(n => {
          const nc = n.note >= 5 ? 'nb-good' : n.note >= 4 ? 'nb-ok' : 'nb-bad';
          const gew = (n.gewichtung || 1.0);
          const gewLabel = gew !== 1.0
            ? `<span class="gewichtung-badge">×${gew}</span>` : '';
          const themaLabel = n.thema_name
            ? `<span class="chip" style="margin-left:4px"><svg width="10" height="10" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle"><use href="#ic-tag"/></svg> ${n.thema_name}</span>` : '';
          return `<tr>
            <td><div class="nb ${nc}">${n.note}</div></td>
            <td>
              ${n.titel || '–'}
              ${themaLabel}
            </td>
            <td style="white-space:nowrap">${gewLabel}</td>
            <td>${fmtDate(n.datum)}</td>
            <td>${n.semester ? `<span class="chip">` + n.semester + `</span>` : '–'}</td>
            <td>
              <div style="display:flex;gap:4px;justify-content:flex-end">
                ${iconBtn('ic-edit', `openEditNote(${n.id})`, 'Bearbeiten')}
                ${iconBtn('ic-trash', `delNote(${n.id})`, 'Löschen', 'btn-icon-danger')}
              </div>
            </td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="6" style="text-align:center;padding:28px 20px">
          <div style="color:var(--text3);font-size:.84rem">Noch keine Noten eingetragen</div>
          <button class="btn btn-p btn-sm" style="margin-top:10px" onclick="openAddNoteForFach(${fach.id})">
            <svg width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-plus"/></svg>
            Erste Note hinzufügen
          </button>
        </td></tr>`;

    return `<div class="fach-card ${fn.length ? 'open' : ''}" id="fc-${fach.id}">
      <div class="fach-hd" onclick="toggleFach(${fach.id})">
        <div class="fach-hd-l">
          <div class="fach-bar" style="background:${fach.farbe}"></div>
          <div>
            <div class="fach-name">${fach.name}</div>
            <div class="fach-cnt">${fn.length} Note${fn.length !== 1 ? 'n' : ''}</div>
          </div>
          <div class="avg ${ac}">⌀ ${avg ? avg + (fn.some(n=>(n.gewichtung||1)!==1) ? ' (gew.)' : '') : '–'}</div>
        </div>
        <span class="fach-chev"><svg><use href="#ic-chevron-right"/></svg></span>
      </div>
      <div class="fach-body">
        <table class="notes-tbl">
          <thead><tr>
            <th>Note</th><th>Thema / Titel</th><th>Gewichtung</th><th>Datum</th><th>Semester</th>
            <th style="text-align:right">Aktionen</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="fach-foot">
          <button class="btn btn-p btn-sm" onclick="openAddNoteForFach(${fach.id})">
            <svg width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-plus"/></svg>
            Note hinzufügen
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleFach(id) {
  document.getElementById('fc-' + id)?.classList.toggle('open');
}
