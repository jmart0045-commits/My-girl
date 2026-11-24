import sqlite3
from pathlib import Path
DB_PATH = Path(__file__).resolve().parent.parent / "my_girl_v2.db"
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con
def init_db():
    with db() as con:
        con.execute('''CREATE TABLE IF NOT EXISTS memories(
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
            content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
        con.execute('''CREATE TABLE IF NOT EXISTS tasks(
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
            title TEXT NOT NULL, status TEXT DEFAULT 'PENDING',
            run_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
        con.execute('''CREATE TABLE IF NOT EXISTS audit(
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, action TEXT,
            approved INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
