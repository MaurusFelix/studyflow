/* dashboard.js */
function initPageScript() {
  // Show zeros immediately, then update with real data
  renderDashboardStatic();
  renderDashboard();
}

function renderDashboardStatic() {
  const sc = document.getElementById('dash-stats');
  if (sc) sc.innerHTML = `
    <div class="stat-card"><div class="stat-icon">⏱️</div><div class="stat-label">Lernzeit diese Woche</div><div class="stat-val">0h <span style="font-size:1.15rem">0m</span></div><div class="stat-sub">0 Minuten total</div></div>
    <div class="stat-card"><div class="stat-icon">🎓</div><div class="stat-label">Aktive Fächer</div><div class="stat-val">${SF.faecher.length}</div><div class="stat-sub">Schuljahr ${new Date().getFullYear()}</div></div>
    <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-label">Letzte Note</div><div class="stat-val">–</div><div class="stat-sub">Noch keine Noten</div></div>
    <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-label">Gesamtdurchschnitt</div><div class="stat-val">–</div><div class="stat-sub">Über alle Fächer</div></div>`;
  const dei = document.getElementById('dash-eintraege');
  if (dei) dei.innerHTML = emptyHTML('📚', 'Noch keine Lerneinträge', 'Starte deine erste Lerneinheit unter "Lernen"');
}

async function renderDashboard() {
  const d = await api('GET', '/stats/dashboard');
  const lernstd = Math.floor((d.lernzeit_woche || 0) / 60);
  const lernmin = (d.lernzeit_woche || 0) % 60;
  const avg = (d.avg_noten || []).filter(f => f.avg);
  const gesAvg = avg.length ? (avg.reduce((s, f) => s + f.avg, 0) / avg.length).toFixed(2) : '–';
  const ln = d.letzte_note;

  const sc = document.getElementById('dash-stats');
  if (sc) sc.innerHTML = `
    <div class="stat-card fade-in">
      <div class="stat-icon">⏱️</div><div class="stat-label">Lernzeit diese Woche</div>
      <div class="stat-val">${lernstd}h <span style="font-size:1.15rem">${lernmin}m</span></div>
      <div class="stat-sub">${d.lernzeit_woche || 0} Minuten total</div>
    </div>
    <div class="stat-card fade-in" style="animation-delay:.05s">
      <div class="stat-icon">🎓</div><div class="stat-label">Aktive Fächer</div>
      <div class="stat-val">${SF.faecher.length}</div>
      <div class="stat-sub">Schuljahr ${new Date().getFullYear()}</div>
    </div>
    <div class="stat-card fade-in" style="animation-delay:.1s">
      <div class="stat-icon">📝</div><div class="stat-label">Letzte Note</div>
      <div class="stat-val">${ln ? ln.note : '–'}</div>
      <div class="stat-sub">${ln ? ln.fach + ' · ' + ln.titel : 'Noch keine Noten'}</div>
    </div>
    <div class="stat-card fade-in" style="animation-delay:.15s">
      <div class="stat-icon">⭐</div><div class="stat-label">Gesamtdurchschnitt</div>
      <div class="stat-val">${gesAvg}</div>
      <div class="stat-sub">Über alle Fächer</div>
    </div>`;

  const lzf = d.lernzeit_pro_fach || [];
  destroyChart('ch-dash-fach');
  if (lzf.length && document.getElementById('ch-dash-fach')) {
    SF.charts['ch-dash-fach'] = new Chart(document.getElementById('ch-dash-fach'), {
      type: 'bar',
      data: { labels: lzf.map(f=>f.name), datasets:[{data:lzf.map(f=>+(f.total/60).toFixed(1)),backgroundColor:lzf.map(f=>f.farbe+'CC'),borderRadius:8,borderSkipped:false}] },
      options: chOpts('Stunden'),
    });
  }
  const nd = (d.avg_noten||[]).filter(f=>f.avg);
  destroyChart('ch-dash-noten');
  if (nd.length && document.getElementById('ch-dash-noten')) {
    SF.charts['ch-dash-noten'] = new Chart(document.getElementById('ch-dash-noten'), {
      type: 'bar',
      data: { labels: nd.map(f=>f.name), datasets:[{data:nd.map(f=>f.avg),backgroundColor:nd.map(f=>f.farbe+'CC'),borderRadius:8,borderSkipped:false}] },
      options: {...chOpts('Note'), scales:{x:{...chScale(),min:1,max:6},y:chScale()}},
    });
  }
  const ee = d.letzte_eintraege || [];
  const dei = document.getElementById('dash-eintraege');
  if (dei) dei.innerHTML = ee.length
    ? ee.map(e => entryHTML(e, false)).join('')
    : emptyHTML('📚', 'Noch keine Lerneinträge', 'Starte deine erste Lerneinheit unter "Lernen"');
}
