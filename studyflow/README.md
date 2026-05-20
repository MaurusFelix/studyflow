# StudyFlow v3 🎓

Lernplattform für die Berufsmatura — IDPA Projekt

## Dateistruktur
```
sf3/
├── app.py                    ← Flask Backend + alle API Routen
├── requirements.txt
├── templates/
│   ├── base.html             ← Jinja2 Basis (Sidebar, Topbar, Modals)
│   └── pages/
│       ├── dashboard.html    ← Übersicht + Diagramme
│       ├── noten.html        ← Fächer & Noten
│       ├── lernen.html       ← Timer + Schnelleintrag
│       ├── kalender.html     ← Drag & Drop Kalender
│       ├── statistiken.html  ← 5 Diagramme
│       ├── methoden.html     ← Lernmethoden
│       └── einstellungen.html
└── static/
    ├── css/
    │   └── style.css         ← Komplettes Styling (Outfit Font)
    └── js/
        ├── core.js           ← Shared: API, Auth, Modals, Theme
        ├── dashboard.js
        ├── noten.js
        ├── lernen.js         ← Timer + Drag & Drop Kalender Logik
        ├── kalender.js
        ├── statistiken.js    ← 5 Chart.js Diagramme
        ├── methoden.js
        └── einstellungen.js
```

## Starten
```bash
# Windows
py -m pip install flask
py app.py

# Mac / Linux
pip3 install flask
python3 app.py
```
→ http://localhost:5000
→ Login: admin / Chur7000

## Raspberry Pi
```bash
python3 -m pip install flask
python3 app.py
```
