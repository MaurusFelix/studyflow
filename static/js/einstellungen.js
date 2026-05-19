/* einstellungen.js */
function initPageScript() {
  renderSettings();
  setTodayDates();
  // Fill fach dropdown
  const sel = document.getElementById('settings-thema-fach');
  if (sel && SF.faecher.length) {
    sel.innerHTML = SF.faecher.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
    renderSettingsThemen();
  }
  // Load profile pic
  const saved = localStorage.getItem('sf-pic');
  const initEl = document.getElementById('profile-initials');
  const imgEl  = document.getElementById('profile-img');
  if (initEl && SF.user) initEl.textContent = SF.user.username[0].toUpperCase();
  if (saved && imgEl) { imgEl.src = saved; imgEl.style.display = 'block'; if(initEl) initEl.style.display='none'; }
}

function renderSettings() {
  const dark = localStorage.getItem('sf-dark') !== '0';
  const td = document.getElementById('toggle-dark');
  if (td) td.checked = dark;
  const su = document.getElementById('settings-uname');
  if (su && SF.user) su.textContent = SF.user.username;
  renderSettingsFaecher();
  renderSettingsThemen();
  renderSemesterSettings();
}

/* ── FÄCHER ───────────────────────────────────────────── */
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
      <div class="settings-row-actions">
        ${iconBtn('ic-edit', `renameFach(${f.id})`, 'Umbenennen')}
        ${iconBtn('ic-trash', `delFach(${f.id})`, 'Löschen', 'btn-icon-danger')}
      </div>
    </div>`).join('');
}

/* ── THEMEN ───────────────────────────────────────────── */
function renderSettingsThemen() {
  const el = document.getElementById('settings-themen');
  if (!el) return;
  const fid = +document.getElementById('settings-thema-fach')?.value;
  if (!fid) { el.innerHTML = '<p style="color:var(--text3);font-size:.82rem">Fach oben auswählen</p>'; return; }
  const ts = SF.themen.filter(t => t.fach_id === fid);
  if (!ts.length) { el.innerHTML = '<p style="color:var(--text3);font-size:.82rem">Noch keine Themen für dieses Fach.</p>'; return; }
  el.innerHTML = ts.map(t => `
    <div class="thema-row" id="thema-row-${t.id}">
      <span class="${t.abgeschlossen?'thema-done':''} thema-row-name" id="thema-name-${t.id}">${t.name}</span>
      <div style="display:flex;gap:4px;flex-shrink:0">
        ${iconBtn(t.abgeschlossen ? 'ic-undo' : 'ic-check', `settingsToggleThema(${t.id})`, t.abgeschlossen ? 'Wiederherstellen' : 'Abschliessen')}
        ${iconBtn('ic-edit', `startRenameThema(${t.id})`, 'Umbenennen')}
        ${iconBtn('ic-trash', `settingsDelThema(${t.id})`, 'Löschen', 'btn-icon-danger')}
      </div>
    </div>`).join('');
}

function startRenameThema(tid) {
  const nameEl = document.getElementById('thema-name-' + tid);
  if (!nameEl) return;
  const currentName = nameEl.textContent.trim();
  const input = document.createElement('input');
  input.className = 'thema-edit-input';
  input.value = currentName;
  nameEl.replaceWith(input);
  input.focus();
  input.select();
  input.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      await commitRenameThema(tid, input.value.trim());
    } else if (e.key === 'Escape') {
      renderSettingsThemen();
    }
  });
  input.addEventListener('blur', async () => {
    if (document.getElementById('thema-name-' + tid) === null) {
      await commitRenameThema(tid, input.value.trim());
    }
  });
}

async function commitRenameThema(tid, newName) {
  if (!newName) { renderSettingsThemen(); return; }
  const t = SF.themen.find(x => x.id === tid);
  if (!t || newName === t.name) { renderSettingsThemen(); return; }
  const r = await api('PUT', '/themen/' + tid, { name: newName });
  if (r.id || r.success) {
    SF.themen = SF.themen.map(x => x.id === tid ? { ...x, name: newName } : x);
    toast('Thema umbenannt', 'ok');
  }
  renderSettingsThemen();
}

async function settingsToggleThema(tid) {
  const t = SF.themen.find(x => x.id === tid);
  if (!t) return;
  const r = await api('PUT', '/themen/' + tid, { abgeschlossen: t.abgeschlossen ? 0 : 1 });
  if (r.id || r.success) { SF.themen = SF.themen.map(x => x.id === tid ? {...x, abgeschlossen: t.abgeschlossen?0:1} : x); renderSettingsThemen(); }
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
    toast('Thema hinzugefügt', 'ok');
  }
}

/* ── SEMESTER ─────────────────────────────────────────── */
function renderSemesterSettings() {
  const el = document.getElementById('settings-semester');
  if (!el) return;
  if (!SF.semester.length) {
    el.innerHTML = '<p style="color:var(--text3);font-size:.82rem;padding:8px 0">Noch keine Semester vorhanden.</p>';
    return;
  }
  el.innerHTML = `<div class="semester-tags">` +
    SF.semester.map(s => `
      <span class="semester-tag">
        ${s.name}
        <button class="semester-tag-del" onclick="delSemester(${s.id})" title="Löschen">
          <svg><use href="#ic-x"/></svg>
        </button>
      </span>`).join('') +
    `</div>`;
}

/* ── PROFILE PIC ─────────────────────────────────────── */
function uploadProfilePic(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const data = ev.target.result;
    localStorage.setItem('sf-pic', data);
    document.getElementById('profile-img').src = data;
    document.getElementById('profile-img').style.display = 'block';
    document.getElementById('profile-initials').style.display = 'none';
    const sav = document.getElementById('sidebar-uav');
    if (sav) sav.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`;
    toast('Profilbild gespeichert', 'ok');
  };
  reader.readAsDataURL(file);
}
function removeProfilePic() {
  localStorage.removeItem('sf-pic');
  document.getElementById('profile-img').style.display = 'none';
  document.getElementById('profile-initials').style.display = 'block';
  toast('Profilbild entfernt', 'ok');
}
