/**
 * Settings API
 * Persists key-value settings (e.g., app password) in SQLite.
 *
 * GET  /api/settings/:key  → get one setting
 * POST /api/settings       → set one setting
 *
 * GET  /api/auth-check     → validate password against stored app-password
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || '/app/data';

let db: any | null = null;

function getDb(): any {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = path.join(DATA_DIR, 'leads.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Seed default app-password if not set
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('app-password');
  if (!existing) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('app-password', 'leadscraper2024');
  }
  return db;
}

const router = Router();

// GET /api/settings/:key
router.get('/settings/:key', (req: Request, res: Response) => {
  try {
    const row = getDb().prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);
    if (!row) return res.status(404).json({ error: 'Key not found' });
    res.json({ key: row.key, value: row.value });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings
router.post('/settings', (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    getDb().prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `).run(key, value, value);
    res.json({ saved: key });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth-check?password=xxx
router.get('/auth-check', (req: Request, res: Response) => {
  try {
    const { password } = req.query;
    if (!password) return res.status(400).json({ valid: false, error: 'password required' });
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('app-password');
    const storedPw = row ? row.value : 'leadscraper2024';
    res.json({ valid: password === storedPw });
  } catch (e: any) {
    // On error, fall back to default password
    res.json({ valid: req.query.password === 'leadscraper2024', fallback: true });
  }
});

export default router;
