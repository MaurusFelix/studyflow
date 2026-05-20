/* statistiken.js */
function initPageScript() { renderStatistiken(); }

function emptyChart(id, label) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  SF.charts[id] = new Chart(el, {
    type: 'bar',
    data: { labels: ['Noch keine Daten'], datasets: [{ data: [0], backgroundColor: getCS('--border2'), borderRadius: 8 }] },
    options: { ...chOpts(label), plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
}

async function renderStatistiken() {
  const d = await api('GET', '/stats/auswertung');

  // 1. Doughnut: Lernzeit pro Fach
  destroyChart('ch-stat-fach');
  const lzf = d.lernzeit_pro_fach || [];
  const elFach = document.getElementById('ch-stat-fach');
  if (elFach) {
    if (lzf.length) {
      SF.charts['ch-stat-fach'] = new Chart(elFach, {
        type: 'doughnut',
        data: { labels: lzf.map(f=>f.name), datasets:[{data:lzf.map(f=>+(f.total/60).toFixed(1)),backgroundColor:lzf.map(f=>f.farbe+'CC'),borderWidth:0}] },
        options: { responsive:true, cutout:'65%', plugins:{legend:{position:'right',labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11},boxWidth:12,borderRadius:4,padding:12}},tooltip:{bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'}}}}
      });
    } else {
      SF.charts['ch-stat-fach'] = new Chart(elFach, {
        type: 'doughnut',
        data: { labels: ['Noch keine Daten'], datasets:[{data:[1],backgroundColor:[getCS('--border2')],borderWidth:0}] },
        options: { responsive:true, cutout:'65%', plugins:{legend:{display:false},tooltip:{enabled:false}}}
      });
    }
  }

  // 2. Lernzeit pro Methode
  const mzm = d.lernzeit_pro_methode || [];
  destroyChart('ch-stat-meth');
  const elMeth = document.getElementById('ch-stat-meth');
  if (elMeth) {
    if (mzm.length) {
      SF.charts['ch-stat-meth'] = new Chart(elMeth, {
        type: 'bar',
        data:{labels:mzm.map(m=>m.name),datasets:[{data:mzm.map(m=>+(m.total/60).toFixed(1)),backgroundColor:mzm.map(m=>m.farbe+'CC'),borderRadius:8,borderSkipped:false}]},
        options: chOpts('Stunden'),
      });
    } else { emptyChart('ch-stat-meth','Stunden'); }
  }

  // 3. Noten pro Methode
  const nm = d.noten_pro_methode || [];
  destroyChart('ch-note-meth');
  const elNM = document.getElementById('ch-note-meth');
  if (elNM) {
    if (nm.length) {
      SF.charts['ch-note-meth'] = new Chart(elNM, {
        type: 'bar',
        data:{labels:nm.map(m=>m.name),datasets:[{data:nm.map(m=>+m.avg),backgroundColor:nm.map(m=>(m.farbe||'#6366F1')+'CC'),borderRadius:8,borderSkipped:false}]},
        options:{...chOpts('Note'),scales:{x:{...chScale(),min:1,max:6},y:chScale()}},
      });
    } else { emptyChart('ch-note-meth','Note'); }
  }

  // 4. Verlauf 30 Tage
  const vl = d.verlauf_30 || [];
  destroyChart('ch-verlauf');
  const elV = document.getElementById('ch-verlauf');
  if (elV) {
    // Always show last 7 days even if empty
    const today = new Date();
    const labels = Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-6+i);return d.toISOString().split('T')[0].slice(5);});
    const dataMap = Object.fromEntries((vl).map(v=>[v.datum.slice(5),v.minuten]));
    const vals = labels.map(l => dataMap[l] || 0);
    SF.charts['ch-verlauf'] = new Chart(elV, {
      type:'line',
      data:{labels,datasets:[{data:vals,borderColor:getCS('--accent'),backgroundColor:getCS('--acc-soft'),fill:true,tension:0.4,pointRadius:3,borderWidth:2}]},
      options: chOpts('Minuten'),
    });
  }

  // 5. Radar
  destroyChart('ch-radar');
  const elR = document.getElementById('ch-radar');
  if (elR) {
    const rdata = SF.faecher.filter(f => SF.eintraege.some(e=>e.fach_id===f.id) || SF.noten.some(n=>n.fach_id===f.id));
    if (rdata.length >= 3) {
      const maxLz = Math.max(1,...rdata.map(f=>SF.eintraege.filter(e=>e.fach_id===f.id).reduce((s,e)=>s+e.dauer_minuten,0)));
      SF.charts['ch-radar'] = new Chart(elR, {
        type:'radar',
        data:{
          labels:rdata.map(f=>f.name),
          datasets:[
            {label:'Lernzeit (norm.)',data:rdata.map(f=>{const lz=SF.eintraege.filter(e=>e.fach_id===f.id).reduce((s,e)=>s+e.dauer_minuten,0);return+(lz/maxLz*6).toFixed(1);}),borderColor:getCS('--accent'),backgroundColor:getCS('--acc-soft'),borderWidth:2},
            {label:'Notendurchschnitt',data:rdata.map(f=>{const ns=SF.noten.filter(n=>n.fach_id===f.id);return ns.length?+(ns.reduce((s,n)=>s+n.note,0)/ns.length).toFixed(2):0;}),borderColor:getCS('--green'),backgroundColor:'rgba(22,163,74,.15)',borderWidth:2}
          ]
        },
        options:{responsive:true,plugins:{legend:{labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11}}},tooltip:{bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'}}},scales:{r:{grid:{color:getCS('--border')},angleLines:{color:getCS('--border')},ticks:{display:false},pointLabels:{color:getCS('--text2'),font:{family:'Outfit',weight:'600',size:11}},min:0,max:6}}}
      });
    } else {
      SF.charts['ch-radar'] = new Chart(elR, {
        type:'radar',
        data:{labels:SF.faecher.length?SF.faecher.map(f=>f.name):['Fach 1','Fach 2','Fach 3'],datasets:[{label:'Keine Daten',data:SF.faecher.length?SF.faecher.map(()=>0):[0,0,0],borderColor:getCS('--border2'),backgroundColor:'transparent',borderWidth:1}]},
        options:{responsive:true,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{r:{grid:{color:getCS('--border')},angleLines:{color:getCS('--border')},ticks:{display:false},pointLabels:{color:getCS('--text3'),font:{family:'Outfit',size:11}},min:0,max:6}}}
      });
    }
  }
}
