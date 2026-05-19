-- ══════════════════════════════════════════════════════════════════
-- StudyFlow – SQLite Datenbankschema
-- Ausführen: sqlite3 lernapp.db < setup.sql
-- ══════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── BENUTZER ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,           -- SHA-256 Hash
    email         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings      TEXT    DEFAULT '{}'        -- JSON für User-Einstellungen
);

-- ── FÄCHER ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faecher (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL,
    name     TEXT    NOT NULL,
    farbe    TEXT    DEFAULT '#4F8EF7',        -- Hex-Farbe für UI
    semester TEXT,
    aktiv    INTEGER DEFAULT 1,                -- 0 = gelöscht (soft delete)
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── NOTEN ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS noten (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    fach_id    INTEGER NOT NULL,
    note       REAL    NOT NULL,               -- z.B. 5.5
    titel      TEXT,                           -- z.B. "Prüfung Vektoren"
    datum      DATE    NOT NULL,
    semester   TEXT,                           -- "1", "2", "3", "4"
    notiz      TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (fach_id) REFERENCES faecher(id)
);

-- ── LERNMETHODEN ────────────────────────────────────────────────────
-- user_id = NULL  →  vordefinierte Methode (für alle sichtbar)
-- user_id = X     →  eigene Methode des Benutzers X
CREATE TABLE IF NOT EXISTS lernmethoden (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER,                  -- NULL = vordefiniert
    name             TEXT    NOT NULL,
    beschreibung     TEXT,
    empfehlung       TEXT,                     -- empfohlene Fächer
    ist_vordefiniert INTEGER DEFAULT 0,
    farbe            TEXT    DEFAULT '#4F8EF7'
);

-- ── LERNEINTRÄGE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lerneintraege (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    fach_id         INTEGER NOT NULL,
    methode_id      INTEGER,
    titel           TEXT    NOT NULL,
    beschreibung    TEXT,
    dauer_minuten   INTEGER NOT NULL,
    datum           DATE    NOT NULL,
    uhrzeit_start   TEXT,                      -- "HH:MM"
    uhrzeit_ende    TEXT,
    geplant         INTEGER DEFAULT 0,         -- 0=erledigt, 1=geplant
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (fach_id)   REFERENCES faecher(id),
    FOREIGN KEY (methode_id) REFERENCES lernmethoden(id)
);

-- ── THEMEN / TITEL ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS themen (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    fach_id        INTEGER NOT NULL,
    name           TEXT    NOT NULL,
    abgeschlossen  INTEGER DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users(id),
    FOREIGN KEY (fach_id)  REFERENCES faecher(id)
);

-- ── KALENDER EVENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kalender_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    fach_id        INTEGER,
    titel          TEXT    NOT NULL,
    beschreibung   TEXT,
    datum          DATE    NOT NULL,
    uhrzeit_start  TEXT,
    uhrzeit_ende   TEXT,
    typ            TEXT    DEFAULT 'geplant',  -- 'geplant' | 'gelernt'
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ══════════════════════════════════════════════════════════════════
-- STANDARD-DATEN (werden von app.py beim Start automatisch eingefügt)
-- Hier nur zur Dokumentation:
--
-- Admin-Benutzer: username='admin', passwort='Chur7000'
-- Passwort-Hash = SHA256('Chur7000')
--
-- Vordefinierte Lernmethoden:
--   Karteikarten, Videos, Aufgaben lösen, Active Recall,
--   Zusammenfassung, Lesen
--
-- Standard-Fächer pro Benutzer (bei Registrierung):
--   Mathematik (#EF4444), Deutsch (#3B82F6), Englisch (#10B981),
--   Wirtschaft & Recht (#F59E0B), Physik (#8B5CF6)
-- ══════════════════════════════════════════════════════════════════
