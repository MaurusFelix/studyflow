/* einstellungen.js */
function initPageScript() { renderSettings(); setTodayDates(); }

function renderSettings() {
  const dark = localStorage.getItem('sf-dark') === '1';
  const td = document.getElementById('toggle-dark');
  if (td) td.checked = dark;
  const su = document.getElementById('settings-uname');
  if (su && SF.user) su.textContent = SF.user.username;
  renderSettingsFaecher();
  renderSettingsThemen();
}

function renderSettingsFaecher() {
  const el = document.getElementById('settings-faecher');
  if (!el) return;
  if (!SF.faecher.length) {
    el.innerHTML = '<p style="color:var(--text3);font-size:.82rem;padding:8px 0">Noch keine Fächer vorhanden.</p>';
    return;
  }
  el.innerHTML = SF.faecher.map(f => `
    <div class="settings-row">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:14px;height:14px;border-radius:4px;background:${f.farbe};flex-shrink:0"></div>
        <div>
          <div class="settings-lbl">${f.name}</div>
          <div class="settings-sub">${SF.noten.filter(n=>n.fach_id===f.id).length} Noten · ${SF.eintraege.filter(e=>e.fach_id===f.id).length} Einträge</div>
        </div>
      </div>
      <button class="btn btn-danger btn-xs" onclick="delFach(${f.id})">Löschen</button>
    </div>`).join('');
}

function renderSettingsThemen() {
  const el = document.getElementById('settings-themen');
  if (!el) return;
  const fid = +document.getElementById('settings-thema-fach')?.value;
  if (!fid) { el.innerHTML = '<p style="color:var(--text3);font-size:.82rem">Fach oben auswählen</p>'; return; }
  const ts = SF.themen.filter(t => t.fach_id === fid);
  if (!ts.length) { el.innerHTML = '<p style="color:var(--text3);font-size:.82rem">Noch keine Themen für dieses Fach.</p>'; return; }
  el.innerHTML = ts.map(t => `
    <div class="thema-row">
      <span class="${t.abgeschlossen?'thema-done':''}" style="flex:1;font-size:.88rem">${t.name}</span>
      <button class="btn-icon btn-xs" onclick="settingsToggleThema(${t.id})">${t.abgeschlossen?'↩️':'✅'}</button>
      <button class="btn-icon btn-xs" onclick="settingsDelThema(${t.id})">🗑️</button>
    </div>`).join('');
}

async function settingsToggleThema(tid) {
  const t = SF.themen.find(x => x.id === tid);
  if (!t) return;
  const r = await api('PUT', '/themen/' + tid, { abgeschlossen: t.abgeschlossen ? 0 : 1 });
  if (r.id) { SF.themen = SF.themen.map(x => x.id === tid ? r : x); renderSettingsThemen(); }
}
async function settingsDelThema(tid) {
  await api('DELETE', '/themen/' + tid);
  SF.themen = SF.themen.filter(t => t.id !== tid);
  renderSettingsThemen();
  toast('Thema gelöscht', 'ok');
}
async function settingsAddThema() {
  const name = document.getElementById('settings-thema-new').value.trim();
  const fid = +document.getElementById('settings-thema-fach')?.value;
  if (!name || !fid) { toast('Thema und Fach erforderlich', 'err'); return; }
  const r = await api('POST', '/themen', { fach_id: fid, name });
  if (r.id) {
    SF.themen.push(r);
    document.getElementById('settings-thema-new').value = '';
    renderSettingsThemen();
    toast('✅ Thema hinzugefügt', 'ok');
  }
}
