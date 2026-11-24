import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = path.resolve(process.cwd(), 'my_girl_v2.db');

export interface MemoryRecord {
  id: number;
  user_id: string;
  content: string;
  category: string;
  created_at: string;
}

export interface TaskRecord {
  id: number;
  user_id: string;
  title: string;
  status: string;
  category: string;
  run_at: string | null;
  created_at: string;
}

export interface AuditRecord {
  id: number;
  user_id: string;
  action: string;
  payload: string | null;
  approved: number;
  outcome: string;
  created_at: string;
}

export interface ChatMessageRecord {
  id: number;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

let database: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!database) {
    database = new DatabaseSync(DB_PATH);
    database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'note',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        category TEXT NOT NULL DEFAULT 'general',
        run_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT,
        approved INTEGER NOT NULL,
        outcome TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const taskColumns = database.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>;
    if (!taskColumns.some((col) => col.name === 'category')) {
      database.exec("ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'general'");
    }
  }
  return database;
}

export function listMemories(userId: string, limit = 100): MemoryRecord[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, user_id, content, category, created_at FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    )
    .all(userId, limit) as unknown as MemoryRecord[];
}

export function addMemory(userId: string, content: string, category = 'note'): MemoryRecord {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO memories (user_id, content, category) VALUES (?, ?, ?)'
  );
  const result = stmt.run(userId, content, category);
  return db
    .prepare('SELECT id, user_id, content, category, created_at FROM memories WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as unknown as MemoryRecord;
}

export function deleteMemoryById(userId: string, id: number): boolean {
  const db = getDb();
  const res = db
    .prepare('DELETE FROM memories WHERE user_id = ? AND id = ?')
    .run(userId, id);
  return res.changes > 0;
}

export function clearMemories(userId: string): number {
  const db = getDb();
  const res = db.prepare('DELETE FROM memories WHERE user_id = ?').run(userId);
  return Number(res.changes);
}

export function listTasks(userId: string): TaskRecord[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, user_id, title, status, category, run_at, created_at FROM tasks WHERE user_id = ? ORDER BY CASE WHEN status = \'PENDING\' THEN 0 ELSE 1 END, id DESC'
    )
    .all(userId) as unknown as TaskRecord[];
}

export function addTask(
  userId: string,
  title: string,
  runAt: string | null = null,
  category = 'general'
): TaskRecord {
  const db = getDb();
  const res = db
    .prepare('INSERT INTO tasks (user_id, title, status, category, run_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, title, 'PENDING', category, runAt);
  return db
    .prepare('SELECT id, user_id, title, status, category, run_at, created_at FROM tasks WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as unknown as TaskRecord;
}

export function updateTask(
  userId: string,
  id: number,
  updates: { status?: string; title?: string; category?: string; run_at?: string | null }
): TaskRecord | null {
  const db = getDb();
  const existing = db
    .prepare(
      'SELECT id, user_id, title, status, category, run_at, created_at FROM tasks WHERE user_id = ? AND id = ?'
    )
    .get(userId, id) as unknown as TaskRecord | undefined;
  if (!existing) return null;

  const nextStatus = updates.status ?? existing.status;
  const nextTitle = updates.title ?? existing.title;
  const nextCategory = updates.category ?? existing.category;
  const nextRunAt = updates.run_at !== undefined ? updates.run_at : existing.run_at;

  db.prepare(
    'UPDATE tasks SET status = ?, title = ?, category = ?, run_at = ? WHERE user_id = ? AND id = ?'
  ).run(nextStatus, nextTitle, nextCategory, nextRunAt, userId, id);

  return db
    .prepare(
      'SELECT id, user_id, title, status, category, run_at, created_at FROM tasks WHERE user_id = ? AND id = ?'
    )
    .get(userId, id) as unknown as TaskRecord;
}

export function deleteTaskById(userId: string, id: number): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM tasks WHERE user_id = ? AND id = ?').run(userId, id);
  return res.changes > 0;
}

export function listMessages(userId: string, limit = 60): ChatMessageRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, user_id, role, content, created_at FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    )
    .all(userId, limit) as unknown as ChatMessageRecord[];
  return rows.reverse();
}

export function addMessage(userId: string, role: 'user' | 'assistant', content: string): ChatMessageRecord {
  const db = getDb();
  const res = db
    .prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)')
    .run(userId, role, content);
  return db
    .prepare('SELECT id, user_id, role, content, created_at FROM messages WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as unknown as ChatMessageRecord;
}

export function clearMessages(userId: string): number {
  const db = getDb();
  const res = db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
  return Number(res.changes);
}

export function addAuditLog(
  userId: string,
  action: string,
  payload: string | null,
  approved: boolean,
  outcome: string
): AuditRecord {
  const db = getDb();
  const res = db
    .prepare(
      'INSERT INTO audit (user_id, action, payload, approved, outcome) VALUES (?, ?, ?, ?, ?)'
    )
    .run(userId, action, payload, approved ? 1 : 0, outcome);
  return db
    .prepare('SELECT id, user_id, action, payload, approved, outcome, created_at FROM audit WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as unknown as AuditRecord;
}

export function listAuditLogs(userId: string, limit = 50): AuditRecord[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, user_id, action, payload, approved, outcome, created_at FROM audit WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    )
    .all(userId, limit) as unknown as AuditRecord[];
}
