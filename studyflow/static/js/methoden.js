/* methoden.js */
function initPageScript() { renderMethoden(); }

const METHODEN_INFO = {
  'Karteikarten': { icon: '🃏', desc: 'Lernkarten erstellen und durch aktives Abrufen wiederholen. Ideal für Definitionen, Vokabeln und Formeln.' },
  'Videos': { icon: '🎥', desc: 'Erklärvideos ansehen, pausieren und nachvollziehen. Gut für visuelle Lerner bei komplexen Themen.' },
  'Aufgaben lösen': { icon: '✏️', desc: 'Übungsaufgaben selbstständig lösen und Fehler analysieren. Effektiv für Mathematik und Naturwissenschaften.' },
  'Active Recall': { icon: '🧠', desc: 'Stoff ohne Hilfsmittel aus dem Gedächtnis wiedergeben. Eine der wissenschaftlich wirksamsten Methoden.' },
  'Zusammenfassung': { icon: '📄', desc: 'Eigene strukturierte Zusammenfassungen schreiben. Hilft beim Verstehen und Behalten von Texten.' },
  'Lesen': { icon: '📖', desc: 'Lehrbücher und Texte aktiv lesen, wichtiges markieren und Notizen machen.' },
  'Spaced Repetition': { icon: '🔄', desc: 'Wiederholung in steigenden Zeitintervallen. Maximiert Langzeitgedächtnis mit minimalem Aufwand.' },
  'Pomodoro': { icon: '🍅', desc: '25 Minuten konzentriert lernen, 5 Minuten Pause. Steigert Fokus und verhindert Ermüdung.' },
  'Mind Map': { icon: '🗺️', desc: 'Themen visuell als Gedankenkarte strukturieren. Fördert vernetztes Denken und Überblick.' },
};

function renderMethoden() {
  const el = document.getElementById('methoden-grid');
  if (!el) return;
  if (!SF.methoden.length) {
    el.innerHTML = emptyHTML('⚡', 'Keine Methoden', 'Es wurden keine Lernmethoden gefunden.');
    return;
  }
  el.innerHTML = SF.methoden.map(m => {
    const info = METHODEN_INFO[m.name] || { icon: '⚡', desc: m.beschreibung || '–' };
    const isOwn = !m.ist_vordefiniert;
    return `<div class="meth-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:44px;height:44px;border-radius:12px;background:${m.farbe||'#6366F1'}22;display:flex;align-items:center;justify-content:center;font-size:1.4rem">${info.icon}</div>
          <div>
            <div class="meth-name">${m.name}</div>
            <div style="font-size:.72rem;font-weight:700;color:${isOwn?'var(--accent)':'var(--text3)'};text-transform:uppercase;letter-spacing:.05em">${isOwn?'Eigene':'Standard'}</div>
          </div>
        </div>
        ${isOwn ? `<button class="btn-icon" onclick="delMethode(${m.id})" title="Löschen">🗑️</button>` : ''}
      </div>
      <p style="font-size:.84rem;color:var(--text2);line-height:1.65;margin-bottom:12px">${info.desc}</p>
      ${m.empfehlung ? `<div class="meth-for">📚 ${m.empfehlung}</div>` : ''}
    </div>`;
  }).join('');
}

async function delMethode(mid) {
  if (!confirm('Methode löschen?')) return;
  await api('DELETE', '/lernmethoden/' + mid);
  SF.methoden = SF.methoden.filter(m => m.id !== mid);
  renderMethoden();
  toast('Methode gelöscht', 'ok');
}
