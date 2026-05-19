/* methoden.js */
function initPageScript() { renderMethoden(); }

function renderMethoden() {
  const el = document.getElementById('methoden-grid');
  if (!el) return;
  if (!SF.methoden.length) {
    el.innerHTML = emptyHTML('⚡', 'Keine Methoden', 'Füge deine erste Lernmethode hinzu.');
    return;
  }
  el.innerHTML = SF.methoden.map(m => {
    const isOwn = !m.ist_vordefiniert;
    const delBtn = isOwn
      ? iconBtn('ic-trash', `delMethode(${m.id})`, 'Löschen', 'btn-icon-danger')
      : '';
    return `<div class="meth-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div class="meth-badge" style="background:${m.farbe || '#CBA6F7'}">${m.name[0]}</div>
        <div style="display:flex;gap:4px">
          ${isOwn ? `<span style="font-size:.65rem;font-weight:700;color:var(--text3);background:var(--bg2);border:1px solid var(--border);padding:2px 7px;border-radius:6px;align-self:center">Eigene</span>` : ''}
          ${delBtn}
        </div>
      </div>
      <div class="meth-name">${m.name}</div>
      <div class="meth-desc">${m.beschreibung || '–'}</div>
      ${m.empfehlung ? `<div class="meth-for">
        <svg width="11" height="11" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-tag"/></svg>
        ${m.empfehlung}
      </div>` : ''}
    </div>`;
  }).join('');
}

async function delMethode(mid) {
  if (!confirm('Methode löschen?')) return;
  await api('DELETE', '/lernmethoden/' + mid);
  SF.methoden = SF.methoden.filter(m => m.id !== mid);
  fillMethodeDrops();
  renderMethoden();
  toast('Methode gelöscht', 'ok');
}
