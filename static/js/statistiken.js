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

function fmtMinTooltip(m) {
  if (!m) return '0 Min.';
  if (m < 60) return m + ' Min.';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (min === 0) return h + ' Std.';
  return h + ' Std. ' + min + ' Min.';
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
        data: { labels: lzf.map(f=>f.name), datasets:[{data:lzf.map(f=>+(f.total/60).toFixed(2)),backgroundColor:lzf.map(f=>f.farbe+'CC'),borderWidth:0}] },
        options: { responsive:true, cutout:'65%',
          plugins:{
            legend:{position:'right',labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11},boxWidth:12,borderRadius:4,padding:12}},
            tooltip:{
              bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'},
              callbacks:{label: ctx => ' ' + fmtMinTooltip(lzf[ctx.dataIndex].total)}
            }
          }
        }
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
        data:{labels:mzm.map(m=>m.name),datasets:[{data:mzm.map(m=>+(m.total/60).toFixed(2)),backgroundColor:mzm.map(m=>(m.farbe||'#CBA6F7')+'CC'),borderRadius:8,borderSkipped:false}]},
        options: { ...chOpts('Stunden'),
          plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtMinTooltip(mzm[ctx.dataIndex].total)}}}
        }
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
        data:{labels:nm.map(m=>m.name),datasets:[{data:nm.map(m=>+m.avg),backgroundColor:nm.map(m=>(m.farbe||'#CBA6F7')+'CC'),borderRadius:8,borderSkipped:false}]},
        options:{...chOpts('Note'),scales:{x:chScale(),y:{...chScale(),min:0,max:6}}},
      });
    } else { emptyChart('ch-note-meth','Note'); }
  }

  // 4. Verlauf 30 Tage (volle Breite)
  const vl = d.verlauf_30 || [];
  destroyChart('ch-verlauf');
  const elV = document.getElementById('ch-verlauf');
  if (elV) {
    const today = new Date();
    const labels = Array.from({length:30},(_,i)=>{const dd=new Date(today);dd.setDate(dd.getDate()-29+i);return dd.toISOString().split('T')[0].slice(5);});
    const dataMap = Object.fromEntries(vl.map(v=>[v.datum.slice(5),v.minuten]));
    const vals = labels.map(l => dataMap[l] || 0);
    SF.charts['ch-verlauf'] = new Chart(elV, {
      type:'line',
      data:{labels,datasets:[{data:vals,borderColor:getCS('--accent'),backgroundColor:getCS('--acc-soft'),fill:true,tension:0.4,pointRadius:3,borderWidth:2}]},
      options:{...chOpts('Minuten'),
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtMinTooltip(ctx.parsed.y)}}}
      }
    });
  }

  // 5. Radar (Lernzeit & Noten) — transparent fill
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
            {
              label:'Lernzeit (norm.)',
              data:rdata.map(f=>{const lz=SF.eintraege.filter(e=>e.fach_id===f.id).reduce((s,e)=>s+e.dauer_minuten,0);return+(lz/maxLz*6).toFixed(1);}),
              borderColor:getCS('--accent'),
              backgroundColor:getCS('--acc-soft'),  // semi-transparent
              borderWidth:2.5,
              pointBackgroundColor:getCS('--accent'),
            },
            {
              label:'Notendurchschnitt',
              data:rdata.map(f=>{
                const ns=SF.noten.filter(n=>n.fach_id===f.id);
                if (!ns.length) return 0;
                const sg=ns.reduce((s,n)=>s+(n.gewichtung||1),0);
                const sw=ns.reduce((s,n)=>s+n.note*(n.gewichtung||1),0);
                return sg>0?+(sw/sg).toFixed(2):0;
              }),
              borderColor:getCS('--green'),
              backgroundColor:'rgba(166,227,161,.18)',
              borderWidth:2.5,
              pointBackgroundColor:getCS('--green'),
            }
          ]
        },
        options:{
          responsive:true,
          plugins:{
            legend:{labels:{color:getCS('--text'),font:{family:'Outfit',weight:'600',size:11}}},
            tooltip:{bodyFont:{family:'Outfit'},titleFont:{family:'Outfit',weight:'700'}}
          },
          scales:{r:{
            grid:{color:getCS('--border')},
            angleLines:{color:getCS('--border')},
            ticks:{display:false},
            pointLabels:{color:getCS('--text2'),font:{family:'Outfit',weight:'600',size:12}},
            min:0,max:6
          }}
        }
      });
    } else {
      SF.charts['ch-radar'] = new Chart(elR, {
        type:'radar',
        data:{labels:SF.faecher.length?SF.faecher.map(f=>f.name):['Fach 1','Fach 2','Fach 3'],datasets:[{label:'Keine Daten',data:SF.faecher.length?SF.faecher.map(()=>0):[0,0,0],borderColor:getCS('--border2'),backgroundColor:'transparent',borderWidth:1}]},
        options:{responsive:true,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{r:{grid:{color:getCS('--border')},angleLines:{color:getCS('--border')},ticks:{display:false},pointLabels:{color:getCS('--text3'),font:{family:'Outfit',size:11}},min:0,max:6}}}
      });
    }
  }

  // 6. Themen-Lernzeit-Vergleich
  const ts = d.thema_stats || [];
  destroyChart('ch-themen');
  const elT = document.getElementById('ch-themen');
  if (elT) {
    if (ts.length) {
      SF.charts['ch-themen'] = new Chart(elT, {
        type: 'bar',
        data: {
          labels: ts.map(t => t.thema),
          datasets: [
            {
              label: 'Lernzeit',
              data: ts.map(t => +(t.lernzeit/60).toFixed(2)),
              backgroundColor: getCS('--accent') + 'BB',
              borderRadius: 6,
              yAxisID: 'y',
            },
            {
              label: 'Ø Note',
              data: ts.map(t => t.avg_note || 0),
              backgroundColor: getCS('--green') + 'BB',
              borderRadius: 6,
              yAxisID: 'y2',
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: getCS('--text'), font: { family: 'Outfit', weight: '600', size: 11 } } },
            tooltip: {
              bodyFont: { family: 'Outfit' }, titleFont: { family: 'Outfit', weight: '700' },
              callbacks: {
                label: ctx => {
                  if (ctx.dataset.label === 'Lernzeit') return ' ' + fmtMinTooltip(ts[ctx.dataIndex].lernzeit);
                  return ' Ø ' + (ctx.parsed.y || 0).toFixed(2);
                }
              }
            }
          },
          scales: {
            x: chScale(),
            y: { ...chScale(), position: 'left', title: { display: true, text: 'Stunden', color: getCS('--text3'), font: { family: 'Outfit' } } },
            y2: { ...chScale(), position: 'right', min: 0, max: 6, grid: { drawOnChartArea: false },
              title: { display: true, text: 'Note', color: getCS('--text3'), font: { family: 'Outfit' } } }
          }
        }
      });
    } else {
      SF.charts['ch-themen'] = new Chart(elT, {
        type: 'bar',
        data: { labels: ['Keine Daten'], datasets: [{ data: [0], backgroundColor: getCS('--border2'), borderRadius: 8 }] },
        options: { ...chOpts(''), plugins: { legend: { display: false }, tooltip: { enabled: false } } }
      });
    }
  }
}
