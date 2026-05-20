from flask import Flask, request, jsonify, render_template, session
import sqlite3
import hashlib
import os
from datetime import datetime, timedelta
import json

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.secret_key = 'lernapp_secret_key_2024_idpa'

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

DB_PATH = os.path.join(os.path.dirname(__file__), 'lernapp.db')

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            settings TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS faecher (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            farbe TEXT DEFAULT '#4F8EF7',
            semester TEXT,
            aktiv INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS semester_labels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            reihenfolge INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS noten (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            fach_id INTEGER NOT NULL,
            note REAL NOT NULL,
            gewichtung REAL DEFAULT 1.0,
            titel TEXT,
            thema_id INTEGER,
            datum DATE NOT NULL,
            semester_label_id INTEGER,
            notiz TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (fach_id) REFERENCES faecher(id),
            FOREIGN KEY (thema_id) REFERENCES themen(id),
            FOREIGN KEY (semester_label_id) REFERENCES semester_labels(id)
        );

        CREATE TABLE IF NOT EXISTS lernmethoden (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT NOT NULL,
            beschreibung TEXT,
            empfehlung TEXT,
            ist_vordefiniert INTEGER DEFAULT 0,
            farbe TEXT DEFAULT '#4F8EF7'
        );

        CREATE TABLE IF NOT EXISTS lerneintraege (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            fach_id INTEGER NOT NULL,
            methode_id INTEGER,
            thema_id INTEGER,
            titel TEXT NOT NULL,
            beschreibung TEXT,
            dauer_minuten INTEGER NOT NULL,
            datum DATE NOT NULL,
            uhrzeit_start TEXT,
            uhrzeit_ende TEXT,
            geplant INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (fach_id) REFERENCES faecher(id),
            FOREIGN KEY (methode_id) REFERENCES lernmethoden(id),
            FOREIGN KEY (thema_id) REFERENCES themen(id)
        );

        CREATE TABLE IF NOT EXISTS themen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            fach_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            abgeschlossen INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (fach_id) REFERENCES faecher(id)
        );

        CREATE TABLE IF NOT EXISTS kalender_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            fach_id INTEGER,
            titel TEXT NOT NULL,
            beschreibung TEXT,
            datum DATE NOT NULL,
            uhrzeit_start TEXT,
            uhrzeit_ende TEXT,
            typ TEXT DEFAULT 'geplant',
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    ''')

    # Migration: add new columns to existing tables if they don't exist
    migrations = [
        "ALTER TABLE noten ADD COLUMN gewichtung REAL DEFAULT 1.0",
        "ALTER TABLE noten ADD COLUMN thema_id INTEGER",
        "ALTER TABLE noten ADD COLUMN semester_label_id INTEGER",
        "ALTER TABLE lerneintraege ADD COLUMN thema_id INTEGER",
    ]
    for sql in migrations:
        try:
            c.execute(sql)
        except Exception:
            pass

    # Default admin user
    try:
        c.execute("INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
                  ('admin', hash_password('Chur7000'), 'admin@lernapp.ch'))
        admin_id = c.lastrowid

        # Default semester labels
        sems = ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4']
        for i, s in enumerate(sems):
            c.execute("INSERT INTO semester_labels (user_id, name, reihenfolge) VALUES (?,?,?)", (admin_id, s, i))

        # Default Fächer für admin
        faecher_default = [
            ('Mathematik', '#EF4444'),
            ('Deutsch', '#3B82F6'),
            ('Englisch', '#10B981'),
            ('Wirtschaft & Recht', '#F59E0B'),
            ('Physik', '#8B5CF6'),
        ]
        for name, farbe in faecher_default:
            c.execute("INSERT INTO faecher (user_id, name, farbe) VALUES (?, ?, ?)",
                      (admin_id, name, farbe))

        # Default Lernmethoden (global, user_id=NULL = vordefiniert)
        methoden = [
            (None, 'Karteikarten', 'Lernkarten erstellen und wiederholen', 'Vokabeln, Definitionen, Formeln', 1, '#EF4444'),
            (None, 'Videos', 'Erklärvideos ansehen und nachvollziehen', 'Physik, Mathematik, Informatik', 1, '#3B82F6'),
            (None, 'Aufgaben lösen', 'Übungsaufgaben selbstständig lösen', 'Mathematik, Physik, Informatik', 1, '#10B981'),
            (None, 'Active Recall', 'Stoff aus dem Gedächtnis wiedergeben', 'Alle Fächer', 1, '#F59E0B'),
            (None, 'Zusammenfassung', 'Eigene Zusammenfassungen schreiben', 'Deutsch, Geschichte, W&R', 1, '#8B5CF6'),
            (None, 'Lesen', 'Texte und Bücher lesen', 'Deutsch, Englisch', 1, '#EC4899'),
            (None, 'Spaced Repetition', 'Wiederholung in steigenden Zeitintervallen', 'Alle Fächer', 1, '#06B6D4'),
            (None, 'Pomodoro', '25 Min. lernen, 5 Min. Pause', 'Alle Fächer', 1, '#F97316'),
            (None, 'Mind Map', 'Themen visuell als Gedankenkarte strukturieren', 'Geschichte, Biologie, W&R', 1, '#84CC16'),
        ]
        c.executemany("INSERT INTO lernmethoden (user_id, name, beschreibung, empfehlung, ist_vordefiniert, farbe) VALUES (?,?,?,?,?,?)", methoden)

        # Sample Noten für admin
        from datetime import date
        today = date.today()
        fach_ids = [row[0] for row in c.execute("SELECT id FROM faecher WHERE user_id=?", (admin_id,)).fetchall()]
        sem_ids = [row[0] for row in c.execute("SELECT id FROM semester_labels WHERE user_id=? ORDER BY reihenfolge", (admin_id,)).fetchall()]
        sample_noten = [
            (admin_id, fach_ids[0], 5.5, 1.0, 'Prüfung Algebra', str(today - timedelta(days=14)), sem_ids[0] if sem_ids else None),
            (admin_id, fach_ids[0], 4.5, 1.0, 'Test Vektoren', str(today - timedelta(days=30)), sem_ids[0] if sem_ids else None),
            (admin_id, fach_ids[1], 5.0, 1.0, 'Aufsatz', str(today - timedelta(days=7)), sem_ids[0] if sem_ids else None),
            (admin_id, fach_ids[2], 5.5, 1.0, 'Vocabulary Test', str(today - timedelta(days=10)), sem_ids[0] if sem_ids else None),
            (admin_id, fach_ids[3], 4.0, 1.0, 'Wirtschaftsrecht Prüfung', str(today - timedelta(days=20)), sem_ids[0] if sem_ids else None),
            (admin_id, fach_ids[4], 5.0, 1.0, 'Mechanik Test', str(today - timedelta(days=5)), sem_ids[0] if sem_ids else None),
        ]
        c.executemany("INSERT INTO noten (user_id, fach_id, note, gewichtung, titel, datum, semester_label_id) VALUES (?,?,?,?,?,?,?)", sample_noten)

        # Sample Lerneinträge
        sample_lernen = [
            (admin_id, fach_ids[0], 1, 'Vektoren wiederholen', 'Grundlagen geübt', 60, str(today - timedelta(days=1)), 0),
            (admin_id, fach_ids[1], 4, 'Aufsatz schreiben', '', 45, str(today - timedelta(days=2)), 0),
            (admin_id, fach_ids[2], 1, 'Vocabulary', 'Unit 5', 30, str(today - timedelta(days=1)), 0),
            (admin_id, fach_ids[3], 3, 'OR-Recht lesen', '', 50, str(today - timedelta(days=3)), 0),
            (admin_id, fach_ids[4], 2, 'Mechanik Videos', 'YouTube Playlist', 40, str(today), 0),
        ]
        c.executemany("INSERT INTO lerneintraege (user_id, fach_id, methode_id, titel, beschreibung, dauer_minuten, datum, geplant) VALUES (?,?,?,?,?,?,?,?)", sample_lernen)

    except sqlite3.IntegrityError:
        pass  # admin already exists

    conn.commit()
    conn.close()

# ─── AUTH ────────────────────────────────────────────────────────────────────

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username=? AND password_hash=?",
                        (data['username'], hash_password(data['password']))).fetchone()
    conn.close()
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'username': user['username'], 'id': user['id']})
    return jsonify({'success': False, 'message': 'Ungültige Anmeldedaten'}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if not data.get('username') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Felder ausfüllen'}), 400
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
                  (data['username'], hash_password(data['password']), data.get('email', '')))
        user_id = c.lastrowid
        # Default Semester Labels
        sems = ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4']
        for i, s in enumerate(sems):
            c.execute("INSERT INTO semester_labels (user_id, name, reihenfolge) VALUES (?,?,?)", (user_id, s, i))
        # Default Fächer
        faecher_default = [
            ('Mathematik', '#EF4444'), ('Deutsch', '#3B82F6'), ('Englisch', '#10B981'),
            ('Wirtschaft & Recht', '#F59E0B'), ('Physik', '#8B5CF6'),
        ]
        for name, farbe in faecher_default:
            c.execute("INSERT INTO faecher (user_id, name, farbe) VALUES (?, ?, ?)", (user_id, name, farbe))
        conn.commit()
        session['user_id'] = user_id
        session['username'] = data['username']
        return jsonify({'success': True, 'username': data['username'], 'id': user_id})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Benutzername bereits vergeben'}), 409
    finally:
        conn.close()

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'logged_in': False}), 401
    return jsonify({'logged_in': True, 'username': session['username'], 'id': session['user_id']})

# ─── FÄCHER ──────────────────────────────────────────────────────────────────

@app.route('/api/faecher', methods=['GET'])
def get_faecher():
    if 'user_id' not in session: return jsonify([]), 401
    conn = get_db()
    rows = conn.execute("SELECT * FROM faecher WHERE user_id=? AND aktiv=1 ORDER BY name", (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/faecher', methods=['POST'])
def add_fach():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO faecher (user_id, name, farbe) VALUES (?,?,?)",
              (session['user_id'], data['name'], data.get('farbe', '#4F8EF7')))
    fach_id = c.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'id': fach_id, 'name': data['name'], 'farbe': data.get('farbe', '#4F8EF7')})

@app.route('/api/faecher/<int:fid>', methods=['PUT'])
def update_fach(fid):
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    conn.execute("UPDATE faecher SET name=?, farbe=? WHERE id=? AND user_id=?",
                 (data['name'], data.get('farbe', '#4F8EF7'), fid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

@app.route('/api/faecher/<int:fid>', methods=['DELETE'])
def delete_fach(fid):
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    conn.execute("UPDATE faecher SET aktiv=0 WHERE id=? AND user_id=?", (fid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

# ─── SEMESTER LABELS ─────────────────────────────────────────────────────────

@app.route('/api/semester', methods=['GET'])
def get_semester():
    if 'user_id' not in session: return jsonify([]), 401
    conn = get_db()
    rows = conn.execute("SELECT * FROM semester_labels WHERE user_id=? ORDER BY reihenfolge, id", (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/semester', methods=['POST'])
def add_semester():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    c = conn.cursor()
    max_ord = conn.execute("SELECT COALESCE(MAX(reihenfolge),0) FROM semester_labels WHERE user_id=?", (session['user_id'],)).fetchone()[0]
    c.execute("INSERT INTO semester_labels (user_id, name, reihenfolge) VALUES (?,?,?)",
              (session['user_id'], data['name'], max_ord + 1))
    sid = c.lastrowid; conn.commit()
    row = conn.execute("SELECT * FROM semester_labels WHERE id=?", (sid,)).fetchone()
    conn.close()
    return jsonify(dict(row))

@app.route('/api/semester/<int:sid>', methods=['DELETE'])
def delete_semester(sid):
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    conn.execute("DELETE FROM semester_labels WHERE id=? AND user_id=?", (sid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

# ─── NOTEN ───────────────────────────────────────────────────────────────────

@app.route('/api/noten', methods=['GET'])
def get_noten():
    if 'user_id' not in session: return jsonify([]), 401
    conn = get_db()
    rows = conn.execute("""
        SELECT n.*, f.name as fach_name, f.farbe as fach_farbe,
               sl.name as semester_name, t.name as thema_name
        FROM noten n JOIN faecher f ON n.fach_id=f.id
        LEFT JOIN semester_labels sl ON n.semester_label_id=sl.id
        LEFT JOIN themen t ON n.thema_id=t.id
        WHERE n.user_id=? ORDER BY n.datum DESC
    """, (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/noten', methods=['POST'])
def add_note():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO noten (user_id, fach_id, note, gewichtung, titel, thema_id, datum, semester_label_id, notiz) VALUES (?,?,?,?,?,?,?,?,?)",
              (session['user_id'], data['fach_id'], data['note'],
               data.get('gewichtung', 1.0), data.get('titel',''),
               data.get('thema_id') or None,
               data['datum'], data.get('semester_label_id') or None, data.get('notiz','')))
    note_id = c.lastrowid
    conn.commit()
    row = conn.execute("""SELECT n.*, f.name as fach_name, f.farbe as fach_farbe,
               sl.name as semester_name, t.name as thema_name
        FROM noten n JOIN faecher f ON n.fach_id=f.id
        LEFT JOIN semester_labels sl ON n.semester_label_id=sl.id
        LEFT JOIN themen t ON n.thema_id=t.id WHERE n.id=?""", (note_id,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': note_id})

@app.route('/api/noten/<int:nid>', methods=['PUT'])
def update_note(nid):
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    conn.execute("UPDATE noten SET note=?, gewichtung=?, titel=?, thema_id=?, datum=?, semester_label_id=?, notiz=? WHERE id=? AND user_id=?",
                 (data['note'], data.get('gewichtung', 1.0), data.get('titel',''),
                  data.get('thema_id') or None,
                  data['datum'], data.get('semester_label_id') or None,
                  data.get('notiz',''), nid, session['user_id']))
    conn.commit()
    row = conn.execute("""SELECT n.*, f.name as fach_name, f.farbe as fach_farbe,
               sl.name as semester_name, t.name as thema_name
        FROM noten n JOIN faecher f ON n.fach_id=f.id
        LEFT JOIN semester_labels sl ON n.semester_label_id=sl.id
        LEFT JOIN themen t ON n.thema_id=t.id WHERE n.id=?""", (nid,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': nid})

@app.route('/api/noten/<int:nid>', methods=['DELETE'])
def delete_note(nid):
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    conn.execute("DELETE FROM noten WHERE id=? AND user_id=?", (nid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

# ─── LERNMETHODEN ────────────────────────────────────────────────────────────

@app.route('/api/lernmethoden', methods=['GET'])
def get_lernmethoden():
    if 'user_id' not in session: return jsonify([]), 401
    conn = get_db()
    rows = conn.execute("SELECT * FROM lernmethoden WHERE user_id IS NULL OR user_id=? ORDER BY ist_vordefiniert DESC, name", (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/lernmethoden', methods=['POST'])
def add_lernmethode():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO lernmethoden (user_id, name, beschreibung, empfehlung, farbe) VALUES (?,?,?,?,?)",
              (session['user_id'], data['name'], data.get('beschreibung',''), data.get('empfehlung',''), data.get('farbe','#4F8EF7')))
    mid = c.lastrowid; conn.commit()
    row = conn.execute("SELECT * FROM lernmethoden WHERE id=?", (mid,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': mid})

@app.route('/api/lernmethoden/<int:mid>', methods=['DELETE'])
def delete_lernmethode(mid):
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    conn.execute("DELETE FROM lernmethoden WHERE id=? AND user_id=?", (mid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

# ─── LERNEINTRÄGE ────────────────────────────────────────────────────────────

@app.route('/api/lerneintraege', methods=['GET'])
def get_lerneintraege():
    if 'user_id' not in session: return jsonify([]), 401
    conn = get_db()
    rows = conn.execute("""
        SELECT l.*, f.name as fach_name, f.farbe as fach_farbe, m.name as methode_name,
               t.name as thema_name
        FROM lerneintraege l
        JOIN faecher f ON l.fach_id=f.id
        LEFT JOIN lernmethoden m ON l.methode_id=m.id
        LEFT JOIN themen t ON l.thema_id=t.id
        WHERE l.user_id=? ORDER BY l.datum DESC, l.created_at DESC
    """, (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/lerneintraege', methods=['POST'])
def add_lerneintrag():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute("""INSERT INTO lerneintraege
        (user_id, fach_id, methode_id, thema_id, titel, beschreibung, dauer_minuten, datum, uhrzeit_start, uhrzeit_ende, geplant)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (session['user_id'], data['fach_id'], data.get('methode_id'),
         data.get('thema_id') or None,
         data['titel'],
         data.get('beschreibung',''), data['dauer_minuten'], data['datum'],
         data.get('uhrzeit_start',''), data.get('uhrzeit_ende',''), data.get('geplant', 0)))
    eid = c.lastrowid; conn.commit()
    row = conn.execute("""SELECT l.*, f.name as fach_name, f.farbe as fach_farbe, t.name as thema_name
        FROM lerneintraege l LEFT JOIN faecher f ON l.fach_id=f.id
        LEFT JOIN themen t ON l.thema_id=t.id WHERE l.id=?""", (eid,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': eid})

@app.route('/api/lerneintraege/<int:eid>', methods=['PUT'])
def update_lerneintrag(eid):
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    conn.execute("""UPDATE lerneintraege SET fach_id=?, methode_id=?, thema_id=?, titel=?, beschreibung=?,
        dauer_minuten=?, datum=?, uhrzeit_start=?, uhrzeit_ende=?, geplant=?
        WHERE id=? AND user_id=?""",
        (data['fach_id'], data.get('methode_id'), data.get('thema_id') or None,
         data['titel'], data.get('beschreibung',''),
         data['dauer_minuten'], data['datum'], data.get('uhrzeit_start',''),
         data.get('uhrzeit_ende',''), data.get('geplant',0), eid, session['user_id']))
    conn.commit()
    row = conn.execute("""SELECT l.*, f.name as fach_name, f.farbe as fach_farbe
        FROM lerneintraege l LEFT JOIN faecher f ON l.fach_id=f.id WHERE l.id=?""", (eid,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': eid})

@app.route('/api/lerneintraege/<int:eid>', methods=['DELETE'])
def delete_lerneintrag(eid):
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    conn.execute("DELETE FROM lerneintraege WHERE id=? AND user_id=?", (eid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

# ─── THEMEN ──────────────────────────────────────────────────────────────────

@app.route('/api/themen', methods=['GET'])
def get_themen():
    if 'user_id' not in session: return jsonify([]), 401
    conn = get_db()
    rows = conn.execute("""
        SELECT t.*, f.name as fach_name FROM themen t
        JOIN faecher f ON t.fach_id=f.id
        WHERE t.user_id=? ORDER BY t.fach_id, t.name
    """, (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/themen', methods=['POST'])
def add_thema():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO themen (user_id, fach_id, name) VALUES (?,?,?)",
              (session['user_id'], data['fach_id'], data['name']))
    tid = c.lastrowid; conn.commit()
    row = conn.execute("SELECT t.*, f.name as fach_name FROM themen t JOIN faecher f ON t.fach_id=f.id WHERE t.id=?", (tid,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': tid})

@app.route('/api/themen/<int:tid>', methods=['PUT'])
def update_thema(tid):
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    if 'name' in data:
        conn.execute("UPDATE themen SET name=? WHERE id=? AND user_id=?",
                     (data['name'], tid, session['user_id']))
    if 'abgeschlossen' in data:
        conn.execute("UPDATE themen SET abgeschlossen=? WHERE id=? AND user_id=?",
                     (data['abgeschlossen'], tid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

@app.route('/api/themen/<int:tid>', methods=['DELETE'])
def delete_thema(tid):
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    conn.execute("DELETE FROM themen WHERE id=? AND user_id=?", (tid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

# ─── STATS ───────────────────────────────────────────────────────────────────

@app.route('/api/stats/dashboard', methods=['GET'])
def dashboard_stats():
    if 'user_id' not in session: return jsonify({}), 401
    uid = session['user_id']
    conn = get_db()
    today = datetime.now().date()
    week_start = today - timedelta(days=today.weekday())

    lernzeit_woche = conn.execute("""
        SELECT COALESCE(SUM(dauer_minuten),0) as total FROM lerneintraege
        WHERE user_id=? AND datum>=? AND geplant=0
    """, (uid, str(week_start))).fetchone()['total']

    letzte_note = conn.execute("""
        SELECT n.note, n.titel, f.name as fach FROM noten n
        JOIN faecher f ON n.fach_id=f.id
        WHERE n.user_id=? ORDER BY n.datum DESC LIMIT 1
    """, (uid,)).fetchone()

    lernzeit_pro_fach = conn.execute("""
        SELECT f.name, f.farbe, COALESCE(SUM(l.dauer_minuten),0) as total
        FROM faecher f LEFT JOIN lerneintraege l ON f.id=l.fach_id AND l.user_id=? AND l.geplant=0
        WHERE f.user_id=? AND f.aktiv=1
        GROUP BY f.id ORDER BY total DESC
    """, (uid, uid)).fetchall()

    # Weighted average
    avg_noten = conn.execute("""
        SELECT f.name, f.farbe,
               CASE WHEN SUM(COALESCE(n.gewichtung,1.0))>0
                    THEN ROUND(SUM(n.note * COALESCE(n.gewichtung,1.0)) / SUM(COALESCE(n.gewichtung,1.0)), 2)
                    ELSE NULL END as avg,
               COUNT(n.id) as count
        FROM faecher f LEFT JOIN noten n ON f.id=n.fach_id AND n.user_id=?
        WHERE f.user_id=? AND f.aktiv=1
        GROUP BY f.id ORDER BY f.name
    """, (uid, uid)).fetchall()

    letzte_eintraege = conn.execute("""
        SELECT l.*, f.name as fach_name, f.farbe, m.name as methode_name
        FROM lerneintraege l JOIN faecher f ON l.fach_id=f.id
        LEFT JOIN lernmethoden m ON l.methode_id=m.id
        WHERE l.user_id=? AND l.geplant=0 ORDER BY l.datum DESC, l.created_at DESC LIMIT 5
    """, (uid,)).fetchall()

    conn.close()
    return jsonify({
        'lernzeit_woche': lernzeit_woche,
        'letzte_note': dict(letzte_note) if letzte_note else None,
        'lernzeit_pro_fach': [dict(r) for r in lernzeit_pro_fach],
        'avg_noten': [dict(r) for r in avg_noten],
        'letzte_eintraege': [dict(r) for r in letzte_eintraege],
    })

@app.route('/api/stats/auswertung', methods=['GET'])
def auswertung_stats():
    if 'user_id' not in session: return jsonify({}), 401
    uid = session['user_id']
    conn = get_db()

    lernzeit_fach = conn.execute("""
        SELECT f.name, f.farbe, COALESCE(SUM(l.dauer_minuten),0) as total
        FROM faecher f LEFT JOIN lerneintraege l ON f.id=l.fach_id AND l.user_id=? AND l.geplant=0
        WHERE f.user_id=? AND f.aktiv=1 GROUP BY f.id ORDER BY total DESC
    """, (uid, uid)).fetchall()

    lernzeit_methode = conn.execute("""
        SELECT COALESCE(m.name,'Keine Methode') as name, m.farbe,
               COALESCE(SUM(l.dauer_minuten),0) as total
        FROM lerneintraege l
        LEFT JOIN lernmethoden m ON l.methode_id=m.id
        WHERE l.user_id=? AND l.geplant=0
        GROUP BY l.methode_id ORDER BY total DESC
    """, (uid,)).fetchall()

    note_methode = conn.execute("""
        SELECT COALESCE(m.name,'Keine Methode') as methode,
               ROUND(AVG(n.note),2) as avg_note, COUNT(n.id) as count
        FROM lerneintraege l
        JOIN noten n ON l.fach_id=n.fach_id AND l.user_id=n.user_id
        LEFT JOIN lernmethoden m ON l.methode_id=m.id
        WHERE l.user_id=?
        GROUP BY l.methode_id ORDER BY avg_note DESC
    """, (uid,)).fetchall()

    verlauf = conn.execute("""
        SELECT datum, SUM(dauer_minuten) as total
        FROM lerneintraege WHERE user_id=? AND geplant=0
        GROUP BY datum ORDER BY datum DESC LIMIT 30
    """, (uid,)).fetchall()

    # Thema stats: per thema, lernzeit vs avg note
    thema_stats = conn.execute("""
        SELECT t.id, t.name, f.name as fach_name, f.farbe,
               COALESCE(SUM(l.dauer_minuten),0) as lernzeit,
               CASE WHEN COUNT(n.id)>0
                    THEN ROUND(SUM(n.note * COALESCE(n.gewichtung,1.0)) / SUM(COALESCE(n.gewichtung,1.0)),2)
                    ELSE NULL END as avg_note
        FROM themen t
        LEFT JOIN faecher f ON t.fach_id=f.id
        LEFT JOIN lerneintraege l ON l.thema_id=t.id AND l.user_id=t.user_id AND l.geplant=0
        LEFT JOIN noten n ON n.thema_id=t.id AND n.user_id=t.user_id
        WHERE t.user_id=?
        GROUP BY t.id ORDER BY lernzeit DESC
    """, (uid,)).fetchall()

    conn.close()
    lzf = [dict(r) for r in lernzeit_fach]
    lzm = [dict(r) for r in lernzeit_methode]
    nm = [{'name': dict(r).get('methode','?'), 'avg': dict(r).get('avg_note',0), 'farbe': '#6366F1'} for r in note_methode]
    vl = [{'datum': dict(r)['datum'], 'minuten': dict(r)['total']} for r in verlauf]
    ts = [dict(r) for r in thema_stats]
    return jsonify({
        'lernzeit_pro_fach':    lzf,
        'lernzeit_pro_methode': lzm,
        'noten_pro_methode':    nm,
        'verlauf_30':           vl,
        'thema_stats':          ts,
    })

# ─── KALENDER ────────────────────────────────────────────────────────────────

@app.route('/api/kalender', methods=['GET'])
def get_kalender():
    if 'user_id' not in session: return jsonify([]), 401
    conn = get_db()
    rows = conn.execute("""
        SELECT k.*, f.name as fach_name, f.farbe as fach_farbe
        FROM kalender_events k LEFT JOIN faecher f ON k.fach_id=f.id
        WHERE k.user_id=? ORDER BY k.datum, k.uhrzeit_start
    """, (session['user_id'],)).fetchall()
    learn = conn.execute("""
        SELECT l.id, l.fach_id, l.titel, l.datum, l.uhrzeit_start, l.uhrzeit_ende,
               f.name as fach_name, f.farbe as fach_farbe, 'gelernt' as typ, l.dauer_minuten
        FROM lerneintraege l JOIN faecher f ON l.fach_id=f.id
        WHERE l.user_id=? AND l.geplant=0
    """, (session['user_id'],)).fetchall()
    conn.close()
    result = [dict(r) for r in rows]
    for r in learn:
        d = dict(r)
        d['is_learn_entry'] = True
        result.append(d)
    return jsonify(result)

@app.route('/api/kalender', methods=['POST'])
def add_kalender():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute("""INSERT INTO kalender_events (user_id, fach_id, titel, beschreibung, datum, uhrzeit_start, uhrzeit_ende, typ)
                 VALUES (?,?,?,?,?,?,?,?)""",
              (session['user_id'], data.get('fach_id'), data['titel'], data.get('beschreibung',''),
               data['datum'], data.get('uhrzeit_start',''), data.get('uhrzeit_ende',''), data.get('typ','geplant')))
    kid = c.lastrowid; conn.commit()
    row = conn.execute("SELECT k.*, f.name as fach_name, f.farbe as fach_farbe FROM kalender_events k LEFT JOIN faecher f ON k.fach_id=f.id WHERE k.id=?", (kid,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': kid})

@app.route('/api/kalender/<int:kid>', methods=['DELETE'])
def delete_kalender(kid):
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    conn.execute("DELETE FROM kalender_events WHERE id=? AND user_id=?", (kid, session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

@app.route('/api/settings', methods=['GET'])
def get_settings():
    if 'user_id' not in session: return jsonify({}), 401
    conn = get_db()
    row = conn.execute("SELECT settings FROM users WHERE id=?", (session['user_id'],)).fetchone()
    conn.close()
    try:
        return jsonify(json.loads(row['settings'] or '{}'))
    except: return jsonify({})

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    conn.execute("UPDATE users SET settings=? WHERE id=?", (json.dumps(data), session['user_id']))
    conn.commit(); conn.close()
    return jsonify({'success': True})

@app.route('/api/kalender/<int:kid>', methods=['PUT'])
def update_kalender(kid):
    if 'user_id' not in session: return jsonify({}), 401
    data = request.json
    conn = get_db()
    existing = conn.execute("SELECT * FROM kalender_events WHERE id=? AND user_id=?",
                            (kid, session['user_id'])).fetchone()
    if not existing:
        conn.close(); return jsonify({}), 404
    existing = dict(existing)
    titel        = data.get('titel',         existing['titel'])
    fach_id      = data.get('fach_id',       existing['fach_id'])
    datum        = data.get('datum',         existing['datum'])
    uhrzeit      = data.get('uhrzeit_start', existing.get('uhrzeit_start',''))
    typ          = data.get('typ',           existing.get('typ','geplant'))
    conn.execute("""UPDATE kalender_events SET titel=?, fach_id=?, datum=?, uhrzeit_start=?, typ=?
                    WHERE id=? AND user_id=?""",
                 (titel, fach_id, datum, uhrzeit, typ, kid, session['user_id']))
    conn.commit()
    row = conn.execute("""SELECT k.*, f.name as fach_name, f.farbe as fach_farbe
                           FROM kalender_events k LEFT JOIN faecher f ON k.fach_id=f.id
                           WHERE k.id=?""", (kid,)).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {'id': kid})

@app.route('/')
@app.route('/dashboard')
@app.route('/noten')
@app.route('/lernen')
@app.route('/kalender')
@app.route('/statistiken')
@app.route('/methoden')
@app.route('/einstellungen')
def index():
    return render_template('index.html')

if __name__ == "__main__":
    init_db()
    print("✅ StudyFlow v3 gestartet.")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
